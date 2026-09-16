import {DEFAULT_LOAD_PIPELINE,validateLoadPipeline,type LoadPipelineConfig,type PipelineTrace,pipelineSteps,resolveLoadPipeline} from './load-pipeline.js';
import type {MeshData} from '@meshtailor/mesh-core';
import type {UnwrapOptions} from '@meshtailor/uv';
export interface PipelinePanelState {config:LoadPipelineConfig;mesh:MeshData;options:Partial<UnwrapOptions>;trace:PipelineTrace|null;loading:boolean;inputStatus?:string;error?:string|null}
const names={pending:'等待',running:'进行中',completed:'完成',skipped:'跳过',error:'失败',cancelled:'已取消'};
/** Shared production panel: React and offline lab mount the same controls and log.
 * Trace updates never rebuild the form or steal focus from a settings input. */
export class PipelinePanel {
  readonly element=document.createElement('section');
  private state:PipelinePanelState|undefined;
  private readonly get=(id:string)=>this.element.querySelector(`[data-pipeline="${id}"]`) as HTMLInputElement;
  constructor(private onChange:(plan:LoadPipelineConfig)=>void,private onRun:()=>void,private onCancel:()=>void){
    this.element.className='pipeline-panel';this.element.dataset.testid='load-pipeline';
    this.element.innerHTML=`<h3>载入模型 · 自动处理流程</h3>
      <small data-pipeline="input">读取输入 → 解析网格 → 保留原 UV / 材质 → 拓扑准备</small>
      <div class="pipeline-presets"><button type="button" data-pipeline="standard">标准整理</button><button type="button" data-pipeline="filled">整理＋填空</button><button type="button" data-pipeline="raw">原样检查</button></div>
      <label>UV 来源<select aria-label="Load pipeline source" data-pipeline="source"><option value="auto">自动：有原 UV 则整理，否则生成</option><option value="generated">重新分区并生成 UV</option><option value="inspect">原样检查（不修改坐标）</option></select></label>
      <div class="pipeline-track">
        <label class="pipeline-toggle"><input aria-label="Pipeline repair" data-pipeline="repairInvalid" type="checkbox"><span>检查原岛 · 允许局部修复<small>只修无效原岛；关闭后遇到无效岛会报错</small></span></label>
        <label class="pipeline-toggle"><input aria-label="Pipeline merge" data-pipeline="mergeAdjacent" type="checkbox"><span>共享边验证缝合<small>通过质量检查后才连接，不按空间接近强焊</small></span></label>
        <div class="pipeline-fixed">面积归一 → 大岛优先排布<small>新 atlas 的必需步骤，不与“填空”混用</small></div>
        <label class="pipeline-toggle"><input aria-label="Pipeline fill" data-pipeline="fill" type="checkbox"><span>填补空白 · 多轮轮廓精排<small data-pipeline="fill-note"></small></span></label>
        <div class="pipeline-budget" data-pipeline="budget"><label>搜索预算 / 秒<input data-pipeline="fillBudgetSeconds" aria-label="Pipeline fill budget" type="number" min="1" max="120"></label><label>最多轮数<input data-pipeline="fillRounds" aria-label="Pipeline fill rounds" type="number" min="1" max="24"></label></div>
        <div class="pipeline-fixed">检查结果 → 建立 3D / UV 对应<small>同一结果供动画、UV 编辑器与导出使用</small></div>
      </div>
      <small data-pipeline="draft-note">修改保存在本浏览器，下一次载入生效；不会打断当前任务。</small>
      <div class="pipeline-actions"><button type="button" class="primary" data-pipeline="run">按此流程重跑当前模型</button><button type="button" data-pipeline="cancel">取消当前任务</button></div>
      <small role="alert" data-pipeline="error" hidden></small>
      <details open><summary data-pipeline="trace-title">本次实际执行</summary><ol class="pipeline-log" data-pipeline="trace"></ol></details>
      <details><summary>流程文件与执行报告</summary><div class="pipeline-presets"><button data-pipeline="export">导出配置</button><button data-pipeline="import-button">导入配置</button><button data-pipeline="report">导出执行报告</button></div><input data-pipeline="import" type="file" accept=".json,application/json" hidden><small>只包含流程和参数、模型名称与统计，不包含几何；报告里的名称可能需要脱敏。</small></details>`;
    const change=()=>{
      if(!this.state)return;
      const raw={...this.state.config,source:this.get('source').value,repairInvalid:this.get('repairInvalid').checked,mergeAdjacent:this.get('mergeAdjacent').checked,fill:this.get('fill').checked,fillBudgetSeconds:Number(this.get('fillBudgetSeconds').value),fillRounds:Number(this.get('fillRounds').value)};
      // Choosing inspection explicitly turns off mutation. Persisted/imported
      // contradictory configs are still rejected by the resolver, not ignored.
      if(raw.source==='inspect')raw.fill=false;
      try{this.onChange(validateLoadPipeline(raw));}catch(e){this.showError(String(e));}
    };
    for(const k of ['source','repairInvalid','mergeAdjacent','fill','fillBudgetSeconds','fillRounds'])this.get(k).addEventListener('change',change);
    this.get('standard').onclick=()=>this.onChange({...DEFAULT_LOAD_PIPELINE});
    this.get('filled').onclick=()=>this.onChange({...DEFAULT_LOAD_PIPELINE,fill:true});
    this.get('raw').onclick=()=>this.onChange({...DEFAULT_LOAD_PIPELINE,source:'inspect',fill:false});
    this.get('run').onclick=()=>this.onRun();this.get('cancel').onclick=()=>this.onCancel();
    this.get('export').onclick=()=>this.save('meshtailor-load-pipeline.json',this.state?.config);
    this.get('report').onclick=()=>this.save('meshtailor-pipeline-report.json',{version:1,mesh:{name:this.state?.mesh.name,faces:this.state?.mesh.faces.length},flow:this.state?.trace,parameters:this.state?.options,exportedAt:new Date().toISOString()});
    this.get('import-button').onclick=()=>this.get('import').click();
    this.get('import').onchange=async()=>{const file=this.get('import').files?.[0];if(!file)return;try{if(file.size>100_000)throw Error('流程文件过大。');this.onChange(validateLoadPipeline(JSON.parse(await file.text())));}catch(e){this.showError(String(e));}finally{this.get('import').value='';}};
  }
  private showError(message:string){this.get('error').hidden=!message;this.get('error').textContent=message;}
  private save(name:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  update(state:PipelinePanelState){
    const changed=JSON.stringify(this.state?.config)!==JSON.stringify(state.config);this.state=state;
    if(changed){this.get('source').value=state.config.source;for(const k of ['repairInvalid','mergeAdjacent','fill'] as const)this.get(k).checked=state.config[k];for(const k of ['fillBudgetSeconds','fillRounds'] as const)this.get(k).value=String(state.config[k]);}
    const raw=state.config.source==='inspect';for(const k of ['repairInvalid','mergeAdjacent','fill'])this.get(k).disabled=raw;
    this.get('budget').hidden=!state.config.fill;this.get('fill-note').textContent=state.config.fill?`已启用 · 搜索 ${state.config.fillBudgetSeconds}s / ${state.config.fillRounds} 轮，随后全量验证；不自动拆岛`:'未启用 · 加载后不会自动执行填空';
    this.get('run').disabled=state.loading;this.get('cancel').disabled=!state.loading;this.get('report').disabled=!state.trace;
    this.get('input').textContent=state.inputStatus??'输入准备完成 · 读取 / 解析 / 拓扑处理见模型导入报告';
    let configError='';let planned;
    try{const p=resolveLoadPipeline(state.mesh,state.config,state.options);planned=pipelineSteps(p.target,p.config,state.config);}catch(e){configError=String(e);}
    this.showError(state.error??configError);if(configError)this.get('run').disabled=true;
    const trace=state.trace;
    this.element.dataset.status=trace?.status??'planned';
    this.get('trace-title').textContent=trace?`${trace.origin==='model-load'?'自动流程':'手动操作'} · ${trace.status==='completed'?'已完成':trace.status==='running'?'执行中':trace.status==='cancelled'?'已取消':trace.status==='timeout'?'超时':'失败'} · ${(trace.elapsedMs/1000).toFixed(1)}s`:'下次载入的计划（尚未执行）';
    this.get('draft-note').textContent=trace?.config&&JSON.stringify(trace.config)!==JSON.stringify(state.config)?'配置已修改，仅下次载入或点击重跑生效。下方日志仍是本次实际执行，未冒充新配置已运行。':'配置保存在本浏览器；修改不会打断当前任务。步骤按依赖顺序执行，不能任意拖动。';
    const list=this.get('trace');list.replaceChildren();
    for(const row of trace?.steps??planned??[]){const li=document.createElement('li');li.dataset.step=row.id;li.dataset.state=row.state;const title=document.createElement('div'),detail=document.createElement('small'),badge=document.createElement('span');title.textContent=row.label;badge.className='pipeline-state';badge.textContent=names[row.state]+(row.elapsedMs!==undefined?` ${(row.elapsedMs/1000).toFixed(2)}s`:'');detail.textContent=row.reason??row.detail??'';li.append(title,badge,detail);list.append(li);}
  }
  dispose(){this.element.remove();}
}
