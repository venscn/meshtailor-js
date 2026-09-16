import type {MeshData} from '@meshtailor/mesh-core';
import type {UnwrapOptions} from '@meshtailor/uv';
import type {UVOperationStep} from '../../../../packages/uv/src/work.js';
export const PIPELINE_STORAGE_KEY='meshtailor.load-pipeline.v1';
export interface LoadPipelineConfig {
  version:1; source:'auto'|'generated'|'inspect';
  repairInvalid:boolean; mergeAdjacent:boolean; fill:boolean;
  fillBudgetSeconds:number; fillRounds:number;
}
export const DEFAULT_LOAD_PIPELINE:Readonly<LoadPipelineConfig>=Object.freeze({version:1,source:'auto',repairInvalid:true,mergeAdjacent:true,fill:false,fillBudgetSeconds:15,fillRounds:8});
export type PipelineTarget='generated'|'source'|'source-atlas'|'stitch'|'repack'|'fill';
export type StepState='pending'|'running'|'completed'|'skipped'|'error'|'cancelled';
export interface PipelineStep {id:UVOperationStep;label:string;enabled:boolean;reason?:string;state:StepState;startedMs?:number;elapsedMs?:number;detail?:string}
export interface PipelineTrace {version:1;target:PipelineTarget;origin:'model-load'|'manual';status:'running'|'completed'|'error'|'cancelled'|'timeout';steps:PipelineStep[];elapsedMs:number;config?:LoadPipelineConfig}
/** Reject incompatible imported configs. Browser storage failure never blocks loading. */
export function validateLoadPipeline(value:unknown):LoadPipelineConfig {
  if(!value||typeof value!=='object')throw Error('流程配置必须是 JSON 对象。');
  const s=value as Record<string,unknown>;
  if(s.version!==1||!['auto','generated','inspect'].includes(s.source as string))throw Error('流程配置版本或 UV 来源无效。');
  for(const k of ['repairInvalid','mergeAdjacent','fill'])if(typeof s[k]!=='boolean')throw Error(`流程配置 ${k} 必须为布尔值。`);
  if(typeof s.fillBudgetSeconds!=='number'||!Number.isFinite(s.fillBudgetSeconds)||s.fillBudgetSeconds<1||s.fillBudgetSeconds>120)throw Error('精排搜索预算必须为 1–120 秒。');
  if(typeof s.fillRounds!=='number'||!Number.isInteger(s.fillRounds)||s.fillRounds<1||s.fillRounds>24)throw Error('精排轮数必须为 1–24。');
  return {version:1,source:s.source as LoadPipelineConfig['source'],repairInvalid:s.repairInvalid as boolean,mergeAdjacent:s.mergeAdjacent as boolean,fill:s.fill as boolean,fillBudgetSeconds:s.fillBudgetSeconds,fillRounds:s.fillRounds};
}
export function readLoadPipeline(storage?:Pick<Storage,'getItem'>):LoadPipelineConfig {
  try {const s=storage?.getItem(PIPELINE_STORAGE_KEY);if(s)return validateLoadPipeline(JSON.parse(s));}catch{/* corrupt, private or old storage: use versioned defaults */}
  return {...DEFAULT_LOAD_PIPELINE};
}
export function hasCompleteSourceUV(mesh:MeshData):boolean {
  return mesh.faces.length>0&&mesh.faces.every(f=>f.uvs?.length===3&&f.uvs.every(p=>p?.length===2&&p.every(Number.isFinite)));
}
export function resolveLoadPipeline(mesh:MeshData,value:LoadPipelineConfig,base:Partial<UnwrapOptions>={}){
  const plan=validateLoadPipeline(value),hasUV=hasCompleteSourceUV(mesh);
  if(plan.source==='inspect'&&!hasUV)throw Error('该模型没有完整原 UV，不能原样检查。请选择自动或重新生成。');
  if(plan.source==='inspect'&&plan.fill)throw Error('原样检查不修改 UV，不能同时启用填补空白。请改为自动整理。');
  if(plan.fill&&base.atlasPageMode&&base.atlasPageMode!=='single')throw Error('自动填补空白当前只支持单页；请将 UV 页策略设为单页。');
  const target:PipelineTarget=plan.source==='inspect'?'source':plan.source==='generated'||!hasUV?'generated':'source-atlas';
  return {target,config:{...base,sourceRepairPolicy:plan.repairInvalid?'repair':'reject',sourceAtlasMerge:plan.mergeAdjacent,postMerge:plan.mergeAdjacent,
    // No hidden nested refinement in packing. One explicit fill stage follows it.
    fillMode:'off',fillRecutLarge:false,fillTimeBudgetMs:plan.fillBudgetSeconds*1000,fillRounds:plan.fillRounds} as Partial<UnwrapOptions>};
}
export function pipelineSteps(target:PipelineTarget,config:Partial<UnwrapOptions>={},plan?:LoadPipelineConfig):PipelineStep[]{
  const source=target==='source'||target==='source-atlas',organized=target!=='source';
  const rows:[UVOperationStep,string,boolean,string?][]=[
    ['input','检查几何与任务配置',true],
    ['extract','提取原 UV 岛 · 审计原坐标',source,'本次不读取原 UV'],
    ['parameterize','连通分区 · 参数化与必要补切',target==='generated','沿用现有 UV 岛'],
    ['repair',config.sourceRepairPolicy==='reject'?'检查现有岛（局部修复关闭）':'验证现有岛 · 局部修复无效 UV', ['source-atlas','stitch','repack'].includes(target),'本次不修复原岛'],
    ['merge','尝试共享边缝合',target==='stitch'||target==='source-atlas'&&config.sourceAtlasMerge!==false||target==='generated'&&config.postMerge===true,'已禁用或本次不适用'],
    ['pack','按 3D 面积归一 · 大岛优先排布',organized&&target!=='fill','保持当前坐标 / 面积'],
    ['fill','填补空白 · 轮廓精排',target==='fill'||!!plan?.fill,'未启用：不会自动填补空白'],
    ['correspondence','建立 3D / UV 对应 · 铰链准备',true],
    ['audit','面积统计 · 空间邻居 · 返回结果',true],
  ];
  return rows.map(([id,label,enabled,reason])=>({id,label,enabled,state:enabled?'pending':'skipped',...(!enabled?{reason}:{} )}));
}
/** Boundaries come from actual algorithm entry points, never estimated percentages. */
export class PipelineRecorder {
  readonly trace:PipelineTrace;
  private current:PipelineStep|undefined;
  constructor(target:PipelineTarget,config:Partial<UnwrapOptions>,plan:LoadPipelineConfig|undefined,private now:()=>number){
    this.trace={version:1,target,origin:plan?'model-load':'manual',status:'running',steps:pipelineSteps(target,config,plan),elapsedMs:0,...(plan?{config:{...plan}}:{})};
  }
  enter(id:UVOperationStep){
    if(this.trace.status!=='running'||this.current?.id===id)return;
    const t=this.now();
    if(this.current){this.current.state='completed';this.current.elapsedMs=t-this.current.startedMs!;}
    const row=this.trace.steps.find(s=>s.id===id);
    if(!row)throw Error('Unknown pipeline step: '+id);
    row.enabled=true;delete row.reason;row.state='running';row.startedMs=t;this.current=row;this.trace.elapsedMs=t;
  }
  detail(text:string){if(this.current)this.current.detail=text;this.trace.elapsedMs=this.now();}
  snapshot(){return structuredClone(this.trace);}
  finish(status:PipelineTrace['status'],detail?:string){
    const t=this.now();this.trace.status=status;this.trace.elapsedMs=t;
    if(this.current){this.current.state=status==='completed'?'completed':status==='cancelled'?'cancelled':'error';this.current.elapsedMs=t-this.current.startedMs!;if(detail)this.current.detail=detail;}
    for(const row of this.trace.steps)if(row.state==='pending'){row.state='skipped';row.reason=status==='completed'?'本次路径未执行':'前序未完成，未执行';}
    return this.snapshot();
  }
}
export function terminalPipeline(trace:PipelineTrace|null|undefined,status:PipelineTrace['status'],elapsedMs:number,detail?:string):PipelineTrace|null{
  if(!trace)return null;const copy=structuredClone(trace);copy.status=status;copy.elapsedMs=elapsedMs;
  for(const row of copy.steps){if(row.state==='running'){row.state=status==='completed'?'completed':status==='cancelled'?'cancelled':'error';row.elapsedMs=Math.max(0,elapsedMs-(row.startedMs??0));if(detail)row.detail=detail;}else if(row.state==='pending'&&status!=='running'){row.state='skipped';row.reason='前序未完成，未执行';}}
  return copy;
}
