import {PipelineRecorder,resolveLoadPipeline,type LoadPipelineConfig,type PipelineTrace} from '../unfold/load-pipeline.js';
import {geometryOnlyMesh,GEOMETRY_INPUT_POLICY,type GeometryInputPolicy,type MeshData} from '@meshtailor/mesh-core';
import {validateHumanMetricOutput,validateTubeOutput,validateSurfaceSymmetryOutput,validateStructureOutput,validateFeatureOutput,geometryGenerationOptions,carryPeelReport, inheritedTemplateSeams,carryHumanTemplates, checkUVTriangles,fillCurrentUV,auditIslandAreas,buildSpatialNeighbors,type AreaAudit,type SpatialReport,type AtlasPacking,postprocessUV, type SourceUVAudit, type MergeReport, type PageReport, buildUnfoldGeometry, unwrapMesh, UVWorkStopped, type UVWork, type UVProgress, type UnwrapOptions, type FragmentationReport, type ChartDiagnostic, type PackedChart, type UnfoldGeometry } from '@meshtailor/uv';
export type UVTarget = 'generated' | 'source' | 'stitch' | 'repack' | 'source-atlas' | 'fill' | 'templates';
export interface UVSnapshot {
  inputPolicy:GeometryInputPolicy;
  features?:import('@meshtailor/uv').SourceFeatureReport;
  peel?:import('@meshtailor/uv').PeelReport;
  human?:import('@meshtailor/uv').HumanTemplateReport;
  pipeline?:PipelineTrace;
  repair?:import('@meshtailor/uv').SourceRepairReport;
  areaAudit?:AreaAudit;sourceAreaAudit?:AreaAudit;spatialReport?:SpatialReport;packingReport?:AtlasPacking['packingReport'];
  packed:PackedChart[]; geometry:UnfoldGeometry; seams:string[]; target:UVTarget; warnings:string[];
  fragmentation?:FragmentationReport; sourceAudit?:SourceUVAudit; merge?:MergeReport; pageReport?:PageReport; removedSeams?:string[];
  addedSeams?:string[]; diagnostics?:ChartDiagnostic[];
  metrics?:{occupancy:number;boxOccupancy:number;padding:number;validated:boolean;elapsedMs:number;packingMethod?:string};
  timing?:{elapsedMs:number;stages:Record<string,number>};
}
export type UVResult = {ok:true;snapshot:UVSnapshot}|{ok:false;error:string;code?:'timeout'|'invalid'};
export type UVJobProgress = UVProgress & {elapsedMs:number;pipeline?:PipelineTrace};
export type UVMessage = UVResult | {type:'progress';progress:UVJobProgress};
export interface UVJob {seedPolicy?:GeometryInputPolicy;seedFeatures?:import('@meshtailor/uv').SourceFeatureReport;seedPeel?:import('@meshtailor/uv').PeelReport;seedHuman?:import('@meshtailor/uv').HumanTemplateReport;pipeline?:LoadPipelineConfig;seedCharts?:PackedChart[];mesh:MeshData;edges:string[];target:UVTarget;config?:Partial<UnwrapOptions>}
export const DEFAULT_UV_BUDGET_MS=120_000;
self.onmessage=(event:MessageEvent<UVJob>)=>{
  const start=performance.now();let last:UVJobProgress|undefined;let recorder:PipelineRecorder|undefined;
  try{
    const {edges,seedCharts,seedHuman,seedPeel,pipeline}=event.data;
    // Do not enumerate input faces: even a hostile original UV getter is never read.
    const mesh=geometryOnlyMesh(event.data.mesh);
    let {target,config}=event.data;
    if(target==='source'||target==='source-atlas')throw Error('原 UV 输入路径已移除。请从几何重新生成；不会读取原坐标、原切缝或岛提示。');
    if(pipeline){const resolved=resolveLoadPipeline(mesh,pipeline,config);target=resolved.target;config=resolved.config;}
    if(target==='generated')config=geometryGenerationOptions(mesh,config);
    if(['stitch','repack','fill','templates'].includes(target)&&event.data.seedPolicy!==GEOMETRY_INPUT_POLICY)throw Error('后处理只接受当前纯几何生成的快照，不能把模型原 UV 当作种子。');
    if(config?.fillRecutLarge)throw Error('旧切缝恢复实验已移除：纯几何生成不允许读取模型原切缝。');
    if(seedCharts&&seedHuman&&['stitch','repack','fill','templates'].includes(target)){
      const locks=inheritedTemplateSeams(mesh,seedCharts,seedHuman,target==='templates'?config?.humanTemplates?.selectedCharts:undefined);
      config={...config,mergeOptions:{...config?.mergeOptions,protectedSeams:[...new Set([...(config?.mergeOptions?.protectedSeams??[]),...locks])]}};
      if(target==='fill'&&config.fillRecutLarge)throw Error('结构模板已锁定裁片边界；请关闭大岛旧接缝试验，或先显式重展所选结构。');
    }
    if(seedCharts&&seedPeel&&['stitch','repack','fill'].includes(target))config={...config,mergeOptions:{...config?.mergeOptions,protectedSeams:[...new Set([...(config?.mergeOptions?.protectedSeams??[]),...seedPeel.groupSeams,...(seedPeel.tubeContracts?.flatMap(c=>c.seams)??[])])]}};
    recorder=new PipelineRecorder(target,config??{},pipeline,()=>performance.now()-start);
    recorder.enter('input');
    const budget=config?.timeBudgetMs??DEFAULT_UV_BUDGET_MS;
    if(!Number.isFinite(budget)||budget<1||budget>900_000)throw new Error('UV time budget must be between 1 and 900000 milliseconds.');
    if(!['generated','source','stitch','repack','source-atlas','fill','templates'].includes(target))throw new Error('Unknown UV target.');
    let sentAt=-Infinity,stageAt=start,stage='validate';const stages:Record<string,number>={};
    const work:UVWork={
      step(id){
        recorder!.enter(id);sentAt=-Infinity;
        const progress={stage:last?.stage??'validate',detail:recorder!.trace.steps.find(s=>s.id===id)!.label,elapsedMs:performance.now()-start,pipeline:recorder!.snapshot()} as UVJobProgress;
        last=progress;self.postMessage({type:'progress',progress} satisfies UVMessage);
      },
      check(){if(performance.now()-start>budget)throw new UVWorkStopped(`UV 计算达到 ${(budget/1000).toFixed(1)} 秒预算。最后阶段：${last?.detail??'初始化'}。原网格未修改，可调整预算后重试（不会回退到模型原 UV）。`);},
      report(progress){
        const now=performance.now();
        if(stage!==progress.stage){stages[stage]=(stages[stage]??0)+now-stageAt;stage=progress.stage;stageAt=now;}
        recorder!.detail(progress.detail);
        last={...progress,facesDone:progress.facesDone??last?.facesDone,facesTotal:progress.facesTotal??last?.facesTotal,islandsDone:progress.islandsDone??last?.islandsDone,elapsedMs:now-start};
        // Bound message traffic; progress is observation, never a synthetic completion percentage.
        if(now-sentAt>=100){sentAt=now;self.postMessage({type:'progress',progress:{...last,pipeline:recorder!.snapshot()}} satisfies UVMessage);}
      }
    };
    work.report({stage:'validate',detail:'Worker 已启动，检查输入',facesDone:0,facesTotal:mesh.faces.length,islandsDone:0});
    work.check();let seams=new Set(edges);
    let snapshot:Omit<UVSnapshot,'geometry'|'inputPolicy'> & {geometry?:UnfoldGeometry;inputPolicy?:GeometryInputPolicy};
    if(target==='fill'){
      work.step?.('fill');
      if(!seedCharts?.length)throw new Error('精排需要一份完整 UV 结果。');
      const result=fillCurrentUV(mesh,seedCharts,seams,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,seams:result.seams,target,warnings:result.warnings,packingReport:result.packingReport,pageReport:result.pageReport,addedSeams:result.addedSeams,removedSeams:[],metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }else if(target==='stitch'||target==='repack'||target==='templates'){
      if(!seedCharts?.length)throw new Error('后处理需要当前已完成的 UV 快照。先从几何生成 UV，再执行邻岛缝合/只重排。');
      const result=postprocessUV(mesh,seedCharts,seams,target,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,seams:result.seams,target,warnings:result.warnings,features:result.features,human:result.human,diagnostics:result.diagnostics,repair:result.repair,merge:result.merge,pageReport:result.pageReport,spatialReport:result.spatialReport,packingReport:result.packingReport,removedSeams:result.removedSeams,addedSeams:result.addedSeams,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }else{
      const result=unwrapMesh(mesh,seams,config,work);seams=new Set(result.seams);
      snapshot={packed:result.packed,seams:result.seams,target,warnings:result.warnings,peel:result.peel,fragmentation:result.fragmentation,merge:result.merge,pageReport:result.pageReport,spatialReport:result.spatialReport,packingReport:result.packingReport,removedSeams:result.merge?.removedSeams,addedSeams:result.addedSeams,human:result.human,diagnostics:result.diagnostics,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:result.packingMethod}};
    }
    // A configured model-load flow executes refinement once, on the completed
    // atlas, before building expensive correspondence. No intermediate export.
    if(pipeline?.fill&&target!=='fill'){
      work.step?.('fill');
      const filled=fillCurrentUV(mesh,snapshot.packed,seams,{...config,fillMode:'area-priority',fillRecutLarge:false},work);
      seams=new Set(filled.seams);
      snapshot={...snapshot,packed:filled.packed,seams:filled.seams,
        packingReport:filled.packingReport,pageReport:filled.pageReport,
        warnings:[...snapshot.warnings,...filled.warnings],
        metrics:{occupancy:filled.occupancy,boxOccupancy:filled.boxOccupancy,padding:filled.padding,validated:true,elapsedMs:performance.now()-start,packingMethod:filled.packingMethod}};
    }
    // Validate the actual complete packed page, not only each independently
    // rescaled chart. No numerical collapse may be published as validated:true.
    if(target!=='source'){
      const pages=new Map<number,PackedChart[]>();
      for(const chart of snapshot.packed){const id=chart.atlasPage??0,list=pages.get(id)??[];list.push(chart);pages.set(id,list);}
      for(const [id,charts]of pages){const q=checkUVTriangles(charts.flatMap(c=>[...c.faceUVs.values()]),100,work);if(!q.valid)throw Error(`最终 UV 页 ${id+1} 验证失败：翻面 ${q.flipped}，退化 ${q.degenerate}，重叠 ${q.overlaps}；没有提交部分结果。`);}
    }
    if(seedCharts&&seedHuman&&['stitch','repack','fill','templates'].includes(target))snapshot.human=carryHumanTemplates(seedHuman,snapshot.human,snapshot.packed,seams);
    if(seedPeel&&seedCharts&&['stitch','repack','fill'].includes(target))snapshot.peel=carryPeelReport(seedPeel,snapshot.packed);
    
    // Validate the submitted coordinates after every path, including automatic
    // fill and standalone postprocessing; a stored recognition badge is not QA.
    validateTubeOutput(snapshot.packed,seams,snapshot.peel?.tubeContracts,work);
    validateHumanMetricOutput(snapshot.packed,seams,snapshot.human,work);
    validateStructureOutput(mesh,snapshot.packed,seams,snapshot.peel,work);
    validateSurfaceSymmetryOutput(mesh,snapshot.packed,snapshot.peel,work);
    const featureChecks=validateFeatureOutput(mesh,snapshot.packed,seams,snapshot.peel,work);
    if(featureChecks.size){
      snapshot.diagnostics??=[];
      for(const [id,checked]of featureChecks){
        const {feature,shape}=checked;
        const existing=snapshot.diagnostics.find(d=>d.id===id);
        if(existing)existing.feature=feature;
        else snapshot.diagnostics.push({id,sourceChart:-1,faces:snapshot.packed.find(c=>c.id===id)!.faceUVs.size,method:'feature-preserved-postprocess',iterations:0,residual:0,...shape,feature});
      }
      snapshot.warnings.push(`已按实际最终 UV 验证 ${featureChecks.size} 个透孔主面的孔和边界关系。其余一般曲面仅通过几何有效性检查，不代表已识别人工版型。`);
    }
    work.step?.('correspondence');
    snapshot.geometry=buildUnfoldGeometry(mesh,snapshot.packed,seams,work);
    work.step?.('audit');
    snapshot.areaAudit=auditIslandAreas(mesh,snapshot.packed,work);
    const areaById=new Map(snapshot.areaAudit.islands.map(c=>[c.id,c.area3D]));
    snapshot.spatialReport??=buildSpatialNeighbors(mesh,snapshot.packed.map(c=>({id:c.id,faceUVs:c.faceUVs,area3D:areaById.get(c.id)!})),config,work);
    if(snapshot.spatialReport.truncated)snapshot.warnings.push('空间邻居采样达到比较预算；报告不完整，未发现邻居不等于没有邻居。');
    snapshot.warnings.push(`当前 ${snapshot.packed.length} 个真实岛，${snapshot.spatialReport.groups.length} 个空间关联组。邻近分组和同页摆放不等于拓扑缝合。`);
    const rig=snapshot.geometry.hinge;
    if(rig?.islands.some(i=>i.targetOrientation<0))snapshot.warnings.push('镜像 UV 岛保持原坐标；动画在刚性转向阶段对齐其正反面，避免最后形变阶段翻面。');
    if(rig?.islands.some(i=>i.mixedOrientation))snapshot.warnings.push('部分生成结果含混合绕序，请检查输出质量报告。');
    if(rig?.islands.some(i=>i.rotationFit))snapshot.warnings.push('UV 形变对存在翻转风险的岛采用逐三角形旋转/正定伸缩插值；过程可能出现紫色临时断边，最终精确回到原目标 UV。这不是连续网格或物理布料模拟。');
    if(rig?.temporaryCuts.length)snapshot.warnings.push(`铰链教学动画有 ${rig.temporaryCuts.length/4} 条临时断边（紫色），用于解除曲面闭环；这些不是 UV 裁切，不写入导出。80–92% 单独显示向 UV 的非刚性形变。`);
    work.check();work.report({stage:'transfer',detail:'传回同一份 3D / UV 与铰链数据',facesDone:mesh.faces.length,facesTotal:mesh.faces.length,islandsDone:snapshot.packed.length});
    const buffers=new Set<ArrayBuffer>();
    const visit=(v:unknown)=>{if(ArrayBuffer.isView(v)&&v.buffer instanceof ArrayBuffer)buffers.add(v.buffer);else if(v&&typeof v==='object'&&!(v instanceof Map))for(const child of Object.values(v))visit(child);};
    visit(snapshot.geometry);work.check();
    stages[stage]=(stages[stage]??0)+performance.now()-stageAt;snapshot.timing={elapsedMs:performance.now()-start,stages};
    snapshot.pipeline=recorder.finish('completed');
    snapshot.inputPolicy=GEOMETRY_INPUT_POLICY;
    self.postMessage({ok:true,snapshot:snapshot as UVSnapshot} satisfies UVResult,{transfer:[...buffers]});
  }catch(error){
    if(recorder){const pipeline=recorder.finish(error instanceof UVWorkStopped?'timeout':'error',error instanceof Error?error.message:String(error));self.postMessage({type:'progress',progress:{stage:last?.stage??'validate',detail:error instanceof Error?error.message:String(error),elapsedMs:performance.now()-start,pipeline}} satisfies UVMessage);}
    self.postMessage({ok:false,error:error instanceof Error?error.message:String(error),code:error instanceof UVWorkStopped?'timeout':'invalid'} satisfies UVResult);}
};
