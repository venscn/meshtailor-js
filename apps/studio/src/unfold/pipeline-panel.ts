import {DEFAULT_LOAD_PIPELINE,validateLoadPipeline,type LoadPipelineConfig,type PipelineTrace,pipelineSteps,resolveLoadPipeline} from './load-pipeline.js';
import type {MeshData} from '@meshtailor/mesh-core';
import type {UnwrapOptions} from '@meshtailor/uv';
import {bilingual as b,displayPreferences,displayLabel} from '@meshtailor/ui-platform';
export interface PipelinePanelState {config:LoadPipelineConfig;mesh:MeshData;options:Partial<UnwrapOptions>;trace:PipelineTrace|null;loading:boolean;acquiring?:boolean;inputStatus?:string;error?:string|null}
const names={pending:['Pending','等待'],running:['Running','进行中'],completed:['Completed','完成'],skipped:['Skipped','跳过'],error:['Failed','失败'],cancelled:['Cancelled','已取消']} as const;
const translatePair=(pair:readonly[string,string])=>b(pair[0],pair[1]);
const stepNames={input:['Validate geometry','验证几何'],extract:['Discard original UVs','丢弃原 UV'],parameterize:['Group, cut, and unfold','分组、开缝与展开'],repair:['Validate generated UVs','验证生成 UV'],features:['Preserve geometric features','保留几何特征'],structure:['Apply structural templates','应用结构模板'],merge:['Validate neighboring-island joins','验证邻岛缝合'],pack:['Normalize and pack','归一与排布'],fill:['Refine vacancies','精排空白'],correspondence:['Build 3D / UV correspondence','建立 3D / UV 对应'],audit:['Audit output','审计结果']} as const;
/** Shared production panel: React and offline lab mount the same controls and log.
 * Trace updates never rebuild the form or steal focus from a settings input. */
export class PipelinePanel {
  readonly element=document.createElement('section');
  private state:PipelinePanelState|undefined;
  private locale=displayPreferences.getSnapshot().locale;
  private unsubscribe:()=>void;
  private readonly get=(id:string)=>this.element.querySelector(`[data-pipeline="${id}"]`) as HTMLInputElement;
  constructor(private onChange:(plan:LoadPipelineConfig)=>void,private onRun:()=>void,private onCancel:()=>void){
    this.renderForm();
    this.unsubscribe=displayPreferences.subscribe(()=>{
      const locale=displayPreferences.getSnapshot().locale;
      if(locale===this.locale)return;
      this.locale=locale;
      const focused=(document.activeElement as HTMLElement|null)?.dataset.pipeline;
      const open=[...this.element.querySelectorAll('details')].map(el=>el.open);
      // Rebuild only our explicitly authored copy on a language change. A trace
      // update still keeps inputs/focus intact, and no onChange/job is dispatched.
      this.renderForm();
      [...this.element.querySelectorAll('details')].forEach((el,i)=>{el.open=open[i]??el.open;});
      if(focused)this.get(focused)?.focus();
    });
  }
  private renderForm(){
    this.element.className='pipeline-panel';this.element.dataset.testid='load-pipeline';
    this.element.innerHTML=`<h3>${b('Model loading · automatic pipeline','载入模型 · 自动处理流程')}</h3><div class="pipeline-current" role="status" data-pipeline="current"></div>
      <small data-pipeline="input">${b('Read input → parse mesh → discard original UVs / retain geometry and materials → prepare topology','读取输入 → 解析网格 → 丢弃原 UV / 保留几何与材质 → 拓扑准备')}</small>
      <div class="pipeline-presets"><button type="button" data-pipeline="standard">${b('Standard','标准整理')}</button><button type="button" data-pipeline="filled">${b('Standard + fill','整理＋填空')}</button></div>
      <label>${b('Input policy','输入策略')}<select aria-label="${b('Load pipeline source','载入流程输入策略')}" data-pipeline="source"><option value="geometry">${b('Geometry only: group → cut → flatten (ignore original UVs)','仅几何：分组 → 开缝 → 展平（不使用原 UV）')}</option></select></label>
      <div class="pipeline-track">
        <label class="pipeline-toggle"><input aria-label="${b('Pipeline merge','流程邻岛缝合')}" data-pipeline="mergeAdjacent" type="checkbox"><span>${b('Validate shared-edge joins','共享边验证缝合')}<small>${b('Join only after quality checks; proximity never implies welding','通过质量检查后才连接，不按空间接近强焊')}</small></span></label>
        <div class="pipeline-fixed">${b('Normalize area → pack large islands first','面积归一 → 大岛优先排布')}<small>${b('Required for a new atlas; separate from vacancy refinement','新 atlas 的必需步骤，不与“填空”混用')}</small></div>
        <label class="pipeline-toggle"><input aria-label="${b('Pipeline fill','流程填空')}" data-pipeline="fill" type="checkbox"><span>${b('Fill vacancies · multiple contour-refinement rounds','填补空白 · 多轮轮廓精排')}<small data-pipeline="fill-note"></small></span></label>
        <div class="pipeline-budget" data-pipeline="budget"><label>${b('Search budget / seconds','搜索预算 / 秒')}<input data-pipeline="fillBudgetSeconds" aria-label="${b('Pipeline fill budget','流程填空预算')}" type="number" min="1" max="120"></label><label>${b('Maximum rounds','最多轮数')}<input data-pipeline="fillRounds" aria-label="${b('Pipeline fill rounds','流程填空轮数')}" type="number" min="1" max="24"></label></div>
        <div class="pipeline-fixed">${b('Check result → build 3D / UV correspondence','检查结果 → 建立 3D / UV 对应')}<small>${b('Animation, UV editor, and export share one result','同一结果供动画、UV 编辑器与导出使用')}</small></div>
      </div>
      <small data-pipeline="draft-note">${b('Changes are saved in this browser and apply on the next load; current work is uninterrupted.','修改保存在本浏览器，下一次载入生效；不会打断当前任务。')}</small>
      <div class="pipeline-actions"><button type="button" class="primary" data-pipeline="run">${b('Rerun current mesh with this pipeline','按此流程重跑当前模型')}</button><button type="button" data-pipeline="cancel">${b('Cancel current task','取消当前任务')}</button></div>
      <small role="alert" data-pipeline="error" hidden></small>
      <details open><summary data-pipeline="trace-title">${b('Actual execution','本次实际执行')}</summary><ol class="pipeline-log" data-pipeline="trace"></ol></details>
      <details><summary>${b('Pipeline files and reports','流程文件与执行报告')}</summary><div class="pipeline-presets"><button data-pipeline="export">${b('Export configuration','导出配置')}</button><button data-pipeline="import-button">${b('Import configuration','导入配置')}</button><button data-pipeline="report">${b('Export execution report','导出执行报告')}</button></div><input data-pipeline="import" type="file" accept=".json,application/json" hidden><small>${b('Pipeline, parameters, mesh names, and statistics only; no geometry. Names may need redacting.','只包含流程和参数、模型名称与统计，不包含几何；报告里的名称可能需要脱敏。')}</small></details>`;
    const change=()=>{
      if(!this.state)return;
      // Keep the compatibility field fixed; this UI never offers source-UV
      // inspection/repair, including after loading an older configuration.
      const raw={...this.state.config,source:'geometry',repairInvalid:false,mergeAdjacent:this.get('mergeAdjacent').checked,fill:this.get('fill').checked,fillBudgetSeconds:Number(this.get('fillBudgetSeconds').value),fillRounds:Number(this.get('fillRounds').value)};
      try{this.onChange(validateLoadPipeline(raw));}catch(e){this.showError(String(e));}
    };
    for(const k of ['mergeAdjacent','fill','fillBudgetSeconds','fillRounds'])this.get(k).addEventListener('change',change);
    this.get('standard').onclick=()=>this.onChange({...DEFAULT_LOAD_PIPELINE});
    this.get('filled').onclick=()=>this.onChange({...DEFAULT_LOAD_PIPELINE,fill:true});
    this.get('run').onclick=()=>this.onRun();this.get('cancel').onclick=()=>this.onCancel();
    this.get('export').onclick=()=>this.save('meshtailor-load-pipeline.json',this.state?.config);
    this.get('report').onclick=()=>this.save('meshtailor-pipeline-report.json',{version:1,mesh:{name:this.state?.mesh.name,faces:this.state?.mesh.faces.length},flow:this.state?.trace,parameters:this.state?.trace?.settings??this.state?.options,exportedAt:new Date().toISOString()});
    this.get('import-button').onclick=()=>this.get('import').click();
    this.get('import').onchange=async()=>{const file=this.get('import').files?.[0];if(!file)return;try{if(file.size>100_000)throw Error(b('Pipeline file is too large.','流程文件过大。'));this.onChange(validateLoadPipeline(JSON.parse(await file.text())));}catch(e){this.showError(String(e));}finally{this.get('import').value='';}};
    const state=this.state;if(state){this.state=undefined;this.update(state);}
  }
  private showError(message:string){this.get('error').hidden=!message;this.get('error').textContent=message;}
  private save(name:string,data:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  update(state:PipelinePanelState){
    const changed=JSON.stringify(this.state?.config)!==JSON.stringify(state.config);this.state=state;
    if(changed){this.get('source').value=state.config.source;for(const k of ['mergeAdjacent','fill'] as const)this.get(k).checked=state.config[k];for(const k of ['fillBudgetSeconds','fillRounds'] as const)this.get(k).value=String(state.config[k]);}
    for(const k of ['mergeAdjacent','fill'])this.get(k).disabled=false;
    this.get('budget').hidden=!state.config.fill;this.get('fill-note').textContent=state.config.fill?b(`Enabled · ${state.config.fillBudgetSeconds}s / ${state.config.fillRounds} rounds, then full validation; never splits islands automatically`,`已启用 · 搜索 ${state.config.fillBudgetSeconds}s / ${state.config.fillRounds} 轮，随后全量验证；不自动拆岛`):b('Disabled · no automatic fill after loading','未启用 · 加载后不会自动执行填空');
    this.get('run').disabled=state.loading;this.get('cancel').disabled=!state.loading;this.get('report').disabled=!state.trace;
    this.get('input').textContent=state.inputStatus??b('Input ready · see import report for reading / parsing / topology preparation','输入准备完成 · 读取 / 解析 / 拓扑处理见模型导入报告');
    let configError='';let planned;
    try{const p=resolveLoadPipeline(state.mesh,state.config,state.options);planned=pipelineSteps(p.target,p.config,state.config);}catch(e){configError=String(e);}
    this.showError(state.error??configError);if(configError)this.get('run').disabled=true;
    const trace=state.trace;
    this.element.dataset.status=trace?.status??'planned';
    const active=trace?.steps.find(s=>s.state==='running');
    this.get('current').textContent=state.acquiring?b('Reading and parsing mesh…','正在读取并解析模型…'):state.loading?(active?b(`Running · ${translatePair(stepNames[active.id])}`,`进行中 · ${active.label}`):b('Waiting for Worker startup…','等待 Worker 启动…')):state.error?b(`Failed · ${state.error}`,`失败 · ${state.error}`):trace?.status==='completed'?b(`Completed · ${trace.steps.find(s=>s.id==='fill')?.state==='completed'?'including fill':'fill not run'}`,`已完成 · ${trace.steps.find(s=>s.id==='fill')?.state==='completed'?'包含填补空白':'未执行填补空白'}`):trace?.status==='cancelled'?b('Cancelled · unfinished steps are not successes','已取消 · 未完成步骤不计为成功'):trace?.status==='timeout'?b('Task timed out · retaining last complete result','任务超时 · 保留上一份完整结果'):trace?.status==='error'?b('Task failed · see actual execution log','任务失败 · 详见实际步骤记录'):b('Next load will use this configuration','下次载入将按以下配置执行');
    this.get('trace-title').textContent=state.acquiring?b('Input / prerequisites running · previous calculation below','输入 / 前置任务处理中 · 下方为上一计算记录'):trace?b(`${trace.origin==='model-load'?'Automatic pipeline':'Manual operation'} · ${trace.status} · ${(trace.elapsedMs/1000).toFixed(1)}s`,`${trace.origin==='model-load'?'自动流程':'手动操作'} · ${trace.status==='completed'?'已完成':trace.status==='running'?'执行中':trace.status==='cancelled'?'已取消':trace.status==='timeout'?'超时':'失败'} · ${(trace.elapsedMs/1000).toFixed(1)}s`):b('Next-load plan (not executed)','下次载入的计划（尚未执行）');
    this.get('draft-note').textContent=trace?.config&&JSON.stringify(trace.config)!==JSON.stringify(state.config)?b('Configuration changed; applies on next load or rerun. The log still describes this actual execution.','配置已修改，仅下次载入或点击重跑生效。下方日志仍是本次实际执行，未冒充新配置已运行。'):b('Saved in this browser; changes do not interrupt the current task. Steps follow dependencies and cannot be reordered arbitrarily.','配置保存在本浏览器；修改不会打断当前任务。步骤按依赖顺序执行，不能任意拖动。');
    const list=this.get('trace');list.replaceChildren();
    for(const row of trace?.steps??planned??[]){const li=document.createElement('li');li.dataset.step=row.id;li.dataset.state=row.state;const title=document.createElement('div'),detail=document.createElement('small'),badge=document.createElement('span');title.textContent=translatePair(stepNames[row.id]);badge.className='pipeline-state';badge.textContent=translatePair(names[row.state])+(row.elapsedMs!==undefined?` ${(row.elapsedMs/1000).toFixed(2)}s`:'');detail.textContent=displayLabel(row.reason??row.detail??'');li.append(title,badge,detail);list.append(li);}
  }
  dispose(){this.unsubscribe();this.element.remove();}
}
