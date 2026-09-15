import type { MeshData } from '@meshtailor/mesh-core';
import { extractSeamEdgesFromUV } from '@meshtailor/chaining-seams';
import { auditIslandAreas,buildSpatialNeighbors,type AreaAudit,type SpatialReport,type AtlasPacking,auditSourceUV, postprocessUV, type SourceUVAudit, type MergeReport, type PageReport, buildCharts, buildUnfoldGeometry, unwrapMesh, sourceUVPreview, UVWorkStopped, type UVWork, type UVProgress, type UnwrapOptions, type FragmentationReport, type ChartDiagnostic, type PackedChart, type UnfoldGeometry } from '@meshtailor/uv';
export type UVTarget = 'generated' | 'source' | 'stitch' | 'repack' | 'source-atlas';
export interface UVSnapshot {
  areaAudit?:AreaAudit;sourceAreaAudit?:AreaAudit;spatialReport?:SpatialReport;packingReport?:AtlasPacking['packingReport'];
  packed:PackedChart[]; geometry:UnfoldGeometry; seams:string[]; target:UVTarget; warnings:string[];
  fragmentation?:FragmentationReport; sourceAudit?:SourceUVAudit; merge?:MergeReport; pageReport?:PageReport; removedSeams?:string[];
  addedSeams?:string[]; diagnostics?:ChartDiagnostic[];
  metrics?:{occupancy:number;boxOccupancy:number;padding:number;validated:boolean;elapsedMs:number;packingMethod?:string};
  timing?:{elapsedMs:number;stages:Record<string,number>};
}
export type UVResult = {ok:true;snapshot:UVSnapshot}|{ok:false;error:string;code?:'timeout'|'invalid'};
export type UVJobProgress = UVProgress & {elapsedMs:number};
export type UVMessage = UVResult | {type:'progress';progress:UVJobProgress};
export interface UVJob {seedCharts?:PackedChart[];mesh:MeshData;edges:string[];target:UVTarget;config?:Partial<UnwrapOptions>}
export const DEFAULT_UV_BUDGET_MS=120_000;
self.onmessage=(event:MessageEvent<UVJob>)=>{
  const start=performance.now();let last:UVJobProgress|undefined;
  try{
    const {mesh,edges,target,config,seedCharts}=event.data;
    const budget=config?.timeBudgetMs??DEFAULT_UV_BUDGET_MS;
    if(!Number.isFinite(budget)||budget<1||budget>900_000)throw new Error('UV time budget must be between 1 and 900000 milliseconds.');
    if(!['generated','source','stitch','repack','source-atlas'].includes(target))throw new Error('Unknown UV target.');
    let sentAt=-Infinity,stageAt=start,stage='validate';const stages:Record<string,number>={};
    const work:UVWork={
      check(){if(performance.now()-start>budget)throw new UVWorkStopped(`UV 计算达到 ${(budget/1000).toFixed(1)} 秒预算。最后阶段：${last?.detail??'初始化'}。原网格未修改，可调整预算后重试或使用网格原始 UV。`);},
      report(progress){
        const now=performance.now();
        if(stage!==progress.stage){stages[stage]=(stages[stage]??0)+now-stageAt;stage=progress.stage;stageAt=now;}
        last={...progress,facesDone:progress.facesDone??last?.facesDone,facesTotal:progress.facesTotal??last?.facesTotal,islandsDone:progress.islandsDone??last?.islandsDone,elapsedMs:now-start};
        // Bound message traffic; progress is observation, never a synthetic completion percentage.
        if(now-sentAt>=100){sentAt=now;self.postMessage({type:'progress',progress:last} satisfies UVMessage);}
      }
    };
    work.report({stage:'validate',detail:'Worker 已启动，检查输入',facesDone:0,facesTotal:mesh.faces.length,islandsDone:0});
    work.check();let seams=(target==='source'||target==='source-atlas')?extractSeamEdgesFromUV(mesh):new Set(edges);
    let snapshot:UVSnapshot;
    if(target==='source'||target==='source-atlas'){
      work.report({stage:'charts',detail:'提取原始 UV 岛（不重新参数化或排布）'});
      const packed=sourceUVPreview(mesh,buildCharts(mesh,seams),config?.sourceUVLayout??'materials');
      const sourceAudit=auditSourceUV(packed,work);
      work.check();work.report({stage:'correspondence',detail:'原始 UV 已读取，建立动画对应',facesDone:mesh.faces.length,facesTotal:mesh.faces.length,islandsDone:packed.length});
      const sourceAreaAudit=auditIslandAreas(mesh,packed,work);
      const sourceWarnings=[config?.sourceUVLayout==='overlay'?'原样诊断：所有材质共用画框；跨材质重叠不等于原 UV 错误。':'原样诊断：按材质分框，未修正面积或重叠。展示偏移不写入导出。', '原样检查保留已有重叠、镜像复用和原面积分配；整理新 atlas 请使用“Extract + 整理”。'];
      if(sourceAudit.hasOverlaps||sourceAudit.hasDegenerate)sourceWarnings.unshift('原始 UV 检查：'+sourceAudit.domains.map(d=>`${d.name}：${d.overlapCountCapped?'至少 ':''}${d.overlapPairs} 对三角面重叠，${d.islands} 个真实岛`).join('；'));
      if(target==='source'){
        snapshot={packed,sourceAudit,sourceAreaAudit,geometry:buildUnfoldGeometry(mesh,packed,seams,work),seams:[...seams],target,warnings:sourceWarnings};
      }else{
        work.report({stage:'charts',detail:'整理原 UV：验证当前岛、面积归一、邻岛缝合与大岛优先排布'});
        const result=postprocessUV(mesh,packed,seams,config?.sourceAtlasMerge===false?'repack':'stitch',config,work);
        seams=new Set(result.seams);
        snapshot={target,sourceAudit,sourceAreaAudit,packed:result.packed,geometry:buildUnfoldGeometry(mesh,result.packed,seams,work),seams:result.seams,
          warnings:['当前显示的是整理后的新 atlas，不是未经修改的源 UV。可用“原样检查”回到原坐标。',...result.warnings],
          merge:result.merge,pageReport:result.pageReport,spatialReport:result.spatialReport,packingReport:result.packingReport,removedSeams:result.removedSeams,addedSeams:result.addedSeams,
          metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
      }
    }else if(target==='stitch'||target==='repack'){
      if(!seedCharts?.length)throw new Error('后处理需要当前已完成的 UV 快照。先生成或提取 UV，再执行邻岛缝合/只重排。');
      const result=postprocessUV(mesh,seedCharts,seams,target,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,geometry:buildUnfoldGeometry(mesh,result.packed,seams,work),seams:result.seams,target,warnings:result.warnings,merge:result.merge,pageReport:result.pageReport,spatialReport:result.spatialReport,packingReport:result.packingReport,removedSeams:result.removedSeams,addedSeams:result.addedSeams,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }else{
      const result=unwrapMesh(mesh,seams,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,geometry:buildUnfoldGeometry(mesh,result.packed,seams,work),seams:result.seams,target,warnings:result.warnings,fragmentation:result.fragmentation,merge:result.merge,pageReport:result.pageReport,spatialReport:result.spatialReport,packingReport:result.packingReport,removedSeams:result.merge?.removedSeams,addedSeams:result.addedSeams,diagnostics:result.diagnostics,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }
    snapshot.areaAudit=auditIslandAreas(mesh,snapshot.packed,work);
    const areaById=new Map(snapshot.areaAudit.islands.map(c=>[c.id,c.area3D]));
    snapshot.spatialReport??=buildSpatialNeighbors(mesh,snapshot.packed.map(c=>({id:c.id,faceUVs:c.faceUVs,area3D:areaById.get(c.id)!})),config,work);
    if(snapshot.spatialReport.truncated)snapshot.warnings.push('空间邻居采样达到比较预算；报告不完整，未发现邻居不等于没有邻居。');
    snapshot.warnings.push(`当前 ${snapshot.packed.length} 个真实岛，${snapshot.spatialReport.groups.length} 个空间关联组。邻近分组和同页摆放不等于拓扑缝合。`);
    const rig=snapshot.geometry.hinge;
    if(rig?.islands.some(i=>i.targetOrientation<0))snapshot.warnings.push('镜像 UV 岛保持原坐标；动画在刚性转向阶段对齐其正反面，避免最后形变阶段翻面。');
    if(rig?.islands.some(i=>i.mixedOrientation))snapshot.warnings.push('部分原始 UV 岛内含混合翻面：这不是整岛朝向问题，原 UV 原样保留；需要重新生成 UV 才能修复内部折叠。');
    if(rig?.islands.some(i=>i.rotationFit))snapshot.warnings.push('UV 形变对存在翻转风险的岛采用逐三角形旋转/正定伸缩插值；过程可能出现紫色临时断边，最终精确回到原目标 UV。这不是连续网格或物理布料模拟。');
    if(rig?.temporaryCuts.length)snapshot.warnings.push(`铰链教学动画有 ${rig.temporaryCuts.length/4} 条临时断边（紫色），用于解除曲面闭环；这些不是 UV 裁切，不写入导出。80–92% 单独显示向 UV 的非刚性形变。`);
    work.check();work.report({stage:'transfer',detail:'传回同一份 3D / UV 与铰链数据',facesDone:mesh.faces.length,facesTotal:mesh.faces.length,islandsDone:snapshot.packed.length});
    const buffers=new Set<ArrayBuffer>();
    const visit=(v:unknown)=>{if(ArrayBuffer.isView(v)&&v.buffer instanceof ArrayBuffer)buffers.add(v.buffer);else if(v&&typeof v==='object'&&!(v instanceof Map))for(const child of Object.values(v))visit(child);};
    visit(snapshot.geometry);work.check();
    stages[stage]=(stages[stage]??0)+performance.now()-stageAt;snapshot.timing={elapsedMs:performance.now()-start,stages};
    self.postMessage({ok:true,snapshot} satisfies UVResult,{transfer:[...buffers]});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error),code:error instanceof UVWorkStopped?'timeout':'invalid'} satisfies UVResult);}
};
