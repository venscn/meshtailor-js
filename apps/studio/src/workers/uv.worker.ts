import type { MeshData } from '@meshtailor/mesh-core';
import { extractSeamEdgesFromUV } from '@meshtailor/chaining-seams';
import { buildCharts, buildUnfoldGeometry, unwrapMesh, sourceUVPreview, UVWorkStopped, type UVWork, type UVProgress, type UnwrapOptions, type ChartDiagnostic, type PackedChart, type UnfoldGeometry } from '@meshtailor/uv';
export type UVTarget = 'generated' | 'source';
export interface UVSnapshot {
  packed:PackedChart[]; geometry:UnfoldGeometry; seams:string[]; target:UVTarget; warnings:string[];
  addedSeams?:string[]; diagnostics?:ChartDiagnostic[];
  metrics?:{occupancy:number;boxOccupancy:number;padding:number;validated:boolean;elapsedMs:number;packingMethod?:string};
  timing?:{elapsedMs:number;stages:Record<string,number>};
}
export type UVResult = {ok:true;snapshot:UVSnapshot}|{ok:false;error:string;code?:'timeout'|'invalid'};
export type UVJobProgress = UVProgress & {elapsedMs:number};
export type UVMessage = UVResult | {type:'progress';progress:UVJobProgress};
export interface UVJob {mesh:MeshData;edges:string[];target:UVTarget;config?:Partial<UnwrapOptions>}
export const DEFAULT_UV_BUDGET_MS=120_000;
self.onmessage=(event:MessageEvent<UVJob>)=>{
  const start=performance.now();let last:UVJobProgress|undefined;
  try{
    const {mesh,edges,target,config}=event.data;
    const budget=config?.timeBudgetMs??DEFAULT_UV_BUDGET_MS;
    if(!Number.isFinite(budget)||budget<1||budget>900_000)throw new Error('UV time budget must be between 1 and 900000 milliseconds.');
    if(target!=='generated'&&target!=='source')throw new Error('Unknown UV target.');
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
    work.check();let seams=target==='source'?extractSeamEdgesFromUV(mesh):new Set(edges);
    let snapshot:UVSnapshot;
    if(target==='source'){
      work.report({stage:'charts',detail:'提取原始 UV 岛（不重新参数化或排布）'});
      const packed=sourceUVPreview(mesh,buildCharts(mesh,seams));
      work.check();work.report({stage:'correspondence',detail:'原始 UV 已读取，建立动画对应',facesDone:mesh.faces.length,facesTotal:mesh.faces.length,islandsDone:packed.length});
      snapshot={packed,geometry:buildUnfoldGeometry(mesh,packed,seams,work),seams:[...seams],target,warnings:['原始 UV 原样保留，未修复重叠、镜像、退化或越界。需要重新展开时选择“拓扑展开 + 面积排布”。']};
    }else{
      const result=unwrapMesh(mesh,seams,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,geometry:buildUnfoldGeometry(mesh,result.packed,seams,work),seams:result.seams,target,warnings:result.warnings,addedSeams:result.addedSeams,diagnostics:result.diagnostics,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }
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
