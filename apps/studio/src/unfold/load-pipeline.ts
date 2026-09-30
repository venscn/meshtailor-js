import type {MeshData} from '@meshtailor/mesh-core';
import {geometryGenerationOptions,type UnwrapOptions} from '@meshtailor/uv';
import type {UVOperationStep} from '../../../../packages/uv/src/work.js';
export const PIPELINE_STORAGE_KEY='meshtailor.load-pipeline.v2';
export interface LoadPipelineConfig {
  version:2; source:'geometry';
  repairInvalid:boolean; mergeAdjacent:boolean; fill:boolean;
  fillBudgetSeconds:number; fillRounds:number;
}
export const DEFAULT_LOAD_PIPELINE:Readonly<LoadPipelineConfig>=Object.freeze({version:2,source:'geometry',repairInvalid:false,mergeAdjacent:false,fill:false,fillBudgetSeconds:15,fillRounds:8});
export type PipelineTarget='generated'|'source'|'source-atlas'|'stitch'|'repack'|'fill'|'templates';
export type StepState='pending'|'running'|'completed'|'skipped'|'error'|'cancelled';
export interface PipelineStep {id:UVOperationStep;label:string;enabled:boolean;reason?:string;state:StepState;startedMs?:number;elapsedMs?:number;detail?:string}
export interface PipelineTrace {version:1;target:PipelineTarget;origin:'model-load'|'manual';status:'running'|'completed'|'error'|'cancelled'|'timeout';steps:PipelineStep[];elapsedMs:number;config?:LoadPipelineConfig;settings?:Partial<UnwrapOptions>}
/** Reject incompatible imported configs. Browser storage failure never blocks loading. */
export function validateLoadPipeline(value:unknown):LoadPipelineConfig {
  if(!value||typeof value!=='object')throw Error('流程配置必须是 JSON 对象。');
  const s=value as Record<string,unknown>;
  if(s.version!==2||s.source!=='geometry')throw Error('流程配置版本或 UV 来源无效。');
  for(const k of ['repairInvalid','mergeAdjacent','fill'])if(typeof s[k]!=='boolean')throw Error(`流程配置 ${k} 必须为布尔值。`);
  if(typeof s.fillBudgetSeconds!=='number'||!Number.isFinite(s.fillBudgetSeconds)||s.fillBudgetSeconds<1||s.fillBudgetSeconds>120)throw Error('精排搜索预算必须为 1–120 秒。');
  if(typeof s.fillRounds!=='number'||!Number.isInteger(s.fillRounds)||s.fillRounds<1||s.fillRounds>24)throw Error('精排轮数必须为 1–24。');
  return {version:2,source:'geometry',repairInvalid:false,mergeAdjacent:s.mergeAdjacent as boolean,fill:s.fill as boolean,fillBudgetSeconds:s.fillBudgetSeconds,fillRounds:s.fillRounds};
}
export function readLoadPipeline(storage?:Pick<Storage,'getItem'>):LoadPipelineConfig {
  try {
    const current=storage?.getItem(PIPELINE_STORAGE_KEY);if(current)return validateLoadPipeline(JSON.parse(current));
    const old=storage?.getItem('meshtailor.load-pipeline.v1');
    if(old){const v=JSON.parse(old);return validateLoadPipeline({...DEFAULT_LOAD_PIPELINE,fill:typeof v.fill==='boolean'?v.fill:false,fillBudgetSeconds:v.fillBudgetSeconds??15,fillRounds:v.fillRounds??8});}
  }catch{/* Old/corrupt/private storage cannot re-enable source UV. */}
  return {...DEFAULT_LOAD_PIPELINE};
}
/** Kept for callers displaying an import audit, never used to choose a generator. */
export function hasCompleteSourceUV(_mesh:MeshData):boolean {return false;}
export function resolveLoadPipeline(mesh:MeshData,value:LoadPipelineConfig,base:Partial<UnwrapOptions>={}){
  const plan=validateLoadPipeline(value);
  if(plan.fill&&base.atlasPageMode&&base.atlasPageMode!=='single')throw Error('自动填空只支持单页；请使用单页排布。');
  // The Worker owns the one post-pack fill pass. Passing fillMode here would
  // also trigger refineAtlas inside packAtlas, silently running it twice.
  // Preserve explicit user search/density settings rather than overriding them.
  return {target:'generated' as PipelineTarget,config:{...geometryGenerationOptions(mesh,base),postMerge:plan.mergeAdjacent,
    fillMode:'off',fillRecutLarge:false,fillTimeBudgetMs:plan.fillBudgetSeconds*1000,fillRounds:plan.fillRounds} as Partial<UnwrapOptions>};
}
export function pipelineSteps(target:PipelineTarget,config:Partial<UnwrapOptions>={},plan?:LoadPipelineConfig):PipelineStep[]{
  const generated=target==='generated',edit=['stitch','repack','fill','templates'].includes(target);
  const rows:[UVOperationStep,string,boolean,string?][]=[
    ['input','几何输入白名单 · 丢弃原 UV / 索引 / 提示',true],
    ['parameterize','结构分组 → 规则开缝 → 自由边界剥展',generated,'本次编辑已有生成结果'],
    ['repair','验证当前生成岛',edit&&target!=='fill','不读取或修复模型原 UV'],
    ['structure','几何结构约束 · 保留主要轮廓',target==='templates','结构分析在生成阶段完成'],
    ['merge','验证式缝合（仅当前生成岛）',target==='stitch'||generated&&config.postMerge===true,'未启用后缝合'],
    ['pack','按 3D 面积归一 · 大岛优先排布',target!=='fill','保持当前生成岛的面积'],
    ['fill','填补空白 · 多轮轮廓精排',target==='fill'||!!plan?.fill,'未启用：不会自动填空'],
    ['correspondence','建立 3D / UV 对应 · 铰链准备',true],
    ['audit','面积 / 边界诊断 · 返回纯几何结果',true],
  ];
  return rows.map(([id,label,enabled,reason])=>({id,label,enabled,state:enabled?'pending':'skipped',...(!enabled?{reason}:{} )}));
}
/** Boundaries come from actual algorithm entry points, never estimated percentages. */
export class PipelineRecorder {
  readonly trace:PipelineTrace;
  private current:PipelineStep|undefined;
  constructor(target:PipelineTarget,config:Partial<UnwrapOptions>,plan:LoadPipelineConfig|undefined,private now:()=>number){
    this.trace={version:1,target,origin:plan?'model-load':'manual',status:'running',settings:structuredClone(config),steps:pipelineSteps(target,config,plan),elapsedMs:0,...(plan?{config:{...plan}}:{})};
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
