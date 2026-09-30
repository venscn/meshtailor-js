import {describeTube} from '/apps/studio/src/unfold/tube-description.js';
import {describeSurfaceSymmetry,describeSymmetrySummary} from '/apps/studio/src/unfold/symmetry-description.js';
import {renderFillGrowth} from '/apps/studio/src/unfold/fill-growth-panel.js';
import {describeStructure,describeBandPartition} from '/apps/studio/src/unfold/structure-description.js';
import {ARRIVAL_DEFAULTS,arrivalSettings} from '/apps/studio/src/unfold/arrival-presentation.js';
import {attachScrubSession} from '/apps/studio/src/unfold/scrub-session.js';
import {PipelinePanel} from '/apps/studio/src/unfold/pipeline-panel.js';
import {PipelineRecorder,readLoadPipeline,PIPELINE_STORAGE_KEY,resolveLoadPipeline,terminalPipeline} from '/apps/studio/src/unfold/load-pipeline.js';
import * as core from '/packages/mesh-core/src/index.js';
import * as uv from '/packages/uv/src/index.js';
import { makeHingeDemo, makeUnfoldDemo, makeFragmentationDemo, makeOverlapDemo } from '/apps/studio/src/unfold/demo.js';
import { UnfoldWebGLView } from '/apps/studio/src/unfold/webgl-view.js';
import { DEFAULT_AUTO_FRAME } from '/apps/studio/src/unfold/camera-policy.js';
import {attachUVSelection,applyBoxSelection} from '/apps/studio/src/unfold/uv-box-selection.js';
import { drawUVSnapshot, pickUVFace } from '/apps/studio/src/unfold/uv-drawing.js';
import {startUVJob,describeUVProgress} from '/apps/studio/src/unfold/uv-job-client.js';
import { EMPTY_INSPECTION, selectInspectionIsland, resolveInspectionPick } from '/apps/studio/src/unfold/selection-policy.js';
let inspection=EMPTY_INSPECTION;
const $=id=>document.getElementById(id);
let inspectionIndex=null, timelineGeometry=null, timelineKey='';
let chartConfig={...uv.DEFAULT_UNWRAP};
let postSeed,postHuman,postPeel,postFeatures,templateSelection;
let loadPlan;try{loadPlan=readLoadPipeline(window.localStorage);}catch{loadPlan=readLoadPipeline();}
let pipelineTrace=null,pipelineRunning=false,pipelineStarted=0,committedMesh=null,jobBackup=null;
const pipelinePanel=new PipelinePanel(plan=>{loadPlan=plan;try{localStorage.setItem(PIPELINE_STORAGE_KEY,JSON.stringify(plan));}catch{}renderPipeline();},()=>solve(loadPlan),()=>{cancel();pause();});
$('pipeline-host').append(pipelinePanel.element);
function renderPipeline(){if(mesh)pipelinePanel.update({config:loadPlan,mesh,options:chartConfig,trace:pipelineTrace,loading:pipelineRunning,inputStatus:`已读取 ${mesh.name} · ${mesh.faces.length.toLocaleString()} 面 · 离线 OBJ / 内置样例入口`});}

let mesh,seams,framedMesh=null,snapshot=null,jobHandle=null,playing=false,sequence=0;
let scrubbing=false;
const options={...ARRIVAL_DEFAULTS,interactionActive:false,focusOpacity:.18,focusMode:'ghost',focusRadius:1.2,focusRetained:.12,overlapMode:'auto',overlapTolerance:.0001,overlapOpacity:.72,faceTones:true,skipStatic:uv.DEFAULT_SKIP_STATIC,motionTolerance:uv.DEFAULT_MOTION_RELATIVE_EPSILON,progress:0,selected:[],order:uv.DEFAULT_UNFOLD_ORDER,handoff:uv.DEFAULT_HANDOFF,holdNet:false,path:'hinge',separation:uv.DEFAULT_SEPARATION,context:'dim',wireframe:true,checker:false,labels:true,xray:false,focusFace:null,hingeWave:true,showHinges:true,showTemporaryCuts:true,autoFrame:DEFAULT_AUTO_FRAME};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const view=new UnfoldWebGLView($('view'),(id,face,add)=>pick(id,face,add),e=>{if(e)fail(e);},()=>{options.autoFrame=false;$('frame').checked=false;view.setOptions(options);cameraStatus();});
function cameraStatus(){$('frame').checked=options.autoFrame;$('camera-status').textContent=options.autoFrame?'自动跟随中；操作相机会立即关闭跟随，动画继续。':'手动相机：动画不改变视角。适配按钮只执行一次。';}
function fail(message){$('error').hidden=false;$('error').textContent=String(message);}
function pause(){playing=false;scrubbing=false;clockLast=null;options.interactionActive=false;view.setOptions(options);$('play').textContent='播放展开';}
function drawUV(){if(!snapshot)return;const host=$('uvhost'),c=$('uv'),d=Math.min(devicePixelRatio,2),ctx=c.getContext('2d');c.width=Math.max(1,Math.round(host.clientWidth*d));c.height=Math.max(1,Math.round(host.clientHeight*d));ctx.setTransform(d,0,0,d,0,0);drawUVSnapshot(ctx,snapshot,host.clientWidth,host.clientHeight,options);}
function list(){if(!snapshot)return;$('islands').replaceChildren();for(const island of snapshot.geometry.islands.slice(0,100)){const row=document.createElement('div');row.className='island'+(inspection.islands.includes(island.id)?' selected':'');const box=document.createElement('input');box.type='checkbox';box.checked=options.selected.includes(island.id);box.setAttribute('aria-label','选中岛 '+(island.id+1));box.onchange=()=>select(island.id,null,true);const b=document.createElement('button');b.innerHTML=`<i style="background:rgb(${uv.islandColor(island.id).map(x=>Math.round(x*255)).join(',')})"></i>#${island.id+1} · ${island.faces.length} 面`;b.onclick=()=>select(island.id,null,false);row.append(box,b);$('islands').append(row);}}
function clearFace(){inspection={...inspection,face:null};options.focusFace=null;update();}
function select(id,_face=null,add=false){
  if(!snapshot)return;
  const all=snapshot.geometry.islands.map(i=>i.id);
  inspection=selectInspectionIsland(add?{islands:options.selected,face:null}:inspection,id,all,add);
  pause();options.selected=[...inspection.islands];options.focusFace=null;options.progress=0;list();update();
}
function pick(id,face=null,add=false){
  if(!snapshot)return;
  const result=resolveInspectionPick(inspection,{id,face,additive:add},snapshot.geometry.islands.map(i=>i.id),snapshot.geometry.faceChart);
  if(result.kind==='none')return;
  if(result.kind==='face'){inspection=result.state;options.focusFace=inspection.face;update();return;}
  const local=uv.islandProgress(options.progress,options.selected.indexOf(id),options.selected.length,options.order,options.handoff,options.timeline);
  pause();inspection=result.state;options.selected=[...inspection.islands];options.focusFace=null;
  list();update({progress:add?0:local});
}
function selectionStatus(){
  const el=$('selection-status');if(!el)return;
  el.textContent=inspection.islands.length
    ? `UV 岛 ${inspection.islands.map(id=>'#'+(id+1)).join(', ')} · ${options.focusFace===null?'未选择三角形':`三角形 ${options.focusFace}`}`
    : '未选择 UV 岛 · 先点选岛，再点选三角形';
  el.dataset.islands=JSON.stringify(inspection.islands);el.dataset.face=String(options.focusFace??'');
  if($('clear-face'))$('clear-face').disabled=options.focusFace===null;
  if($('human-selected'))$('human-selected').disabled=!snapshot||!inspection.islands.length;
  const selected=inspection.islands[0],area=snapshot?.areaAudit?.islands.find(r=>r.id===selected);
  $('selection-area').textContent=area?`3D 面积占比 ${(area.share3D*100).toFixed(4)}% / UV 占比 ${(area.shareUV*100).toFixed(4)}% · 密度 ${area.densityRatio?.toFixed(3)??'无效'}×（同域）`:'';
  const neighbors=snapshot?.spatialReport?.links.filter(l=>l.a===selected||l.b===selected)??[];
  $('selection-neighbors').textContent=selected===undefined?'':`3D 邻居：${neighbors.map(l=>'#'+((l.a===selected?l.b:l.a)+1)+(l.stitchable?' 共享边':' 空间关联')).join(' · ')||'采样范围内未找到'}。关联不改变真实岛数。`;
  const human=snapshot?.human?.entries.find(e=>e.status==='applied'&&e.charts?.includes(selected));
  $('selection-template').textContent=human?describeBandPartition(human)+` 结构：${human.template} · 原区域 #${human.sourceChart+1} → ${human.charts.map(i=>'#'+(i+1)).join(' / ')}。上下边界：${human.lowerBoundary.length} / ${human.upperBoundary.length} 顶点 · ${human.seamEdges.length} 条真实侧缝边。` : '';
  const feature=snapshot?.diagnostics?.find(d=>d.id===selected)?.feature;
  $('selection-feature').textContent=feature?`几何特征保护：透孔主面 · 保留 ${feature.holes} 个孔。边界最大变化 ${(100*feature.boundaryMax).toFixed(2)}% 参考轮廓直径；孔面积比例 ${feature.holeAreaRatios.map(x=>x.toFixed(3)+'×').join(' / ')}。相对源几何投影，不使用原 UV，也不是人工语义评分。`:'';
  const structure=snapshot?.peel?.groups.find(g=>g.charts.includes(selected));
  $('selection-tube').textContent=describeTube(snapshot?.peel,snapshot?.packed.find(c=>c.id===selected));
  $('selection-structure').textContent=describeStructure(structure);
  $('selection-symmetry').textContent=describeSurfaceSymmetry(snapshot?.diagnostics?.find(d=>d.id===selected),snapshot?.packed.find(c=>c.id===selected),snapshot?.peel);
  const coordinates=$('selection-coordinates');
  if(coordinates){
    const fi=options.focusFace,chart=fi===null?null:snapshot?.packed.find(c=>c.faceUVs.has(fi));
    const uvs=fi===null?null:chart?.faceUVs.get(fi),face=fi===null?null:mesh?.faces[fi];
    coordinates.hidden=!face||!uvs;
    coordinates.textContent=face&&uvs?face.vertices.map((vi,k)=>`角 ${k+1} · 顶点 ${vi}\n3D  ${mesh.positions[vi].map(x=>Number(x.toPrecision(5))).join(', ')}\nUV  ${uvs[k].map(x=>Number(x.toPrecision(5))).join(', ')}`).join('\n\n'):'';
  }
}
window.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.defaultPrevented||e.target?.closest('input,textarea,select,[contenteditable=true]'))return;
  if(inspection.face!==null){e.preventDefault();clearFace();}
  else if(inspection.islands.length){e.preventDefault();$('none').click();}
});
function rebuildTimeline(){
  if(!snapshot){options.timeline=undefined;timelineGeometry=null;return;}
  options.selected=uv.areaOrderedIslands(snapshot.geometry,options.selected);
  const key=JSON.stringify([options.selected,options.order,options.handoff,options.holdNet,options.path,options.separation,options.hingeWave,options.skipStatic,options.motionTolerance]);
  if(timelineGeometry!==snapshot.geometry||timelineKey!==key){
    options.timeline=uv.buildMotionTimeline(snapshot.geometry,options,{skipStatic:options.skipStatic,relativeEpsilon:options.motionTolerance});
    timelineGeometry=snapshot.geometry;timelineKey=key;
  }
}
function update(patch={},focus=null){
  if(Object.hasOwn(patch,"progress"))inspectionIndex=focus;
  Object.assign(options,patch);
  options.interactionActive=playing||scrubbing;
  options.playbackReverse=playing&&$('reverse').checked;
  rebuildTimeline();
  options.animationDurationSeconds=uv.unfoldDuration(Math.max(.5,Math.min(60,Number($('seconds').value)||12)),options.selected.length,options.order,options.handoff,options.timeline);
  $('overlap-mode').value=options.overlapMode;$('overlap-opacity').value=options.overlapOpacity;$('face-tones').checked=options.faceTones;$('overlap-tolerance').value=options.overlapTolerance*100;
  view.setOptions(options);cameraStatus();drawUV();selectionStatus();
  $('progress').value=options.progress;$('percent').textContent=(options.progress*100).toFixed(1)+'%';
  const reverse=$('reverse').checked,schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,reverse,options.timeline);
  const focusIndex=!playing&&inspectionIndex!==null&&inspectionIndex<options.selected.length?inspectionIndex:schedule.focusIndex;
  const local=uv.islandProgress(options.progress,focusIndex,options.selected.length,options.order,options.handoff,options.timeline);
  const pose=uv.unfoldIslandPose(options,focusIndex);
  $('phase').textContent=(focusIndex<0?'没有选择岛':`#${options.selected[focusIndex]+1} · `)+(pose<.18?'分离面片':pose<.28?'转向观察':pose<.70?'沿边铰链旋转':pose<.80?'刚性平面网':pose<.92?'UV 参数化形变':pose<1?'面积感知排布':'目标 UV');
  const seconds=Math.max(.5,Math.min(60,Number($('seconds').value)||12));
  const duration=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff,options.timeline);
  $('queue-status').textContent=`${reverse?'已折回':'已完成'} ${reverse?schedule.waiting:schedule.completed} / ${options.selected.length} · ${reverse?'待折回':'等待'} ${reverse?schedule.completed:schedule.waiting} · ${schedule.active.length?'播放中 '+schedule.active.map(a=>`#${options.selected[a.index]+1} (${(a.progress*100).toFixed(1)}%)`).join(' → '):'无活动岛'}\n${$('rate').value}× 总时长 ${(duration/Number($('rate').value)).toFixed(1)} 秒（1× ${duration.toFixed(1)} 秒） · 剩余 ${(duration/Number($('rate').value)*(reverse?options.progress:1-options.progress)).toFixed(1)} 秒`;
  const nominal=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff);
  const profile=options.timeline?.entries[focusIndex]?.profile;
  $('skip-static').checked=options.skipStatic;
  $('motion-status').textContent=`自动跳过${options.skipStatic?'已开启':'已关闭'} · 1× 原队列 ${nominal.toFixed(1)} 秒 → 有效动作 ${duration.toFixed(1)} 秒 · 缩短 ${Math.max(0,nominal-duration).toFixed(1)} 秒\n`+(profile?`当前岛 ${ (profile.duration*seconds).toFixed(1)} 秒 · 已跳过：${profile.segments.filter(s=>!s.keep&&s.stage!=='主动观察停留').map(s=>s.stage).join('、')||'无'} `:'');
  $('handoff-label').textContent=`前岛有效进度至少 ${Math.round(options.handoff*100)}% 时接力`;
  $('handoff').disabled=options.order==='sequential';
  $('queue-prev').disabled=focusIndex<=0;$('queue-next').disabled=focusIndex<0||focusIndex>=options.selected.length-1;
}
function seekQueue(direction){pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked,options.timeline),index=Math.max(0,Math.min(options.selected.length-1,(inspectionIndex??schedule.focusIndex)+direction));update({progress:uv.islandTimelineProgress($('reverse').checked?1:0,index,options.selected.length,options.order,options.handoff,options.timeline)},index);}
function restoreJobBackup(){if(!jobBackup||jobBackup.mesh!==mesh)return;snapshot=jobBackup.snapshot;options.selected=jobBackup.selected;options.progress=jobBackup.progress;inspection=jobBackup.inspection;options.focusFace=inspection.face;view.setGeometry(snapshot.geometry,{resetCamera:false});rebuildTimeline();list();update();reportUV();window.lab.ready=true;}
function cancel(){sequence++;jobHandle?.cancel();jobHandle=null;$('cancel').disabled=true;$('solve').disabled=false;if(pipelineRunning){pipelineTrace=terminalPipeline(pipelineTrace,'cancelled',performance.now()-pipelineStarted,'用户取消；保留上一份完整结果');pipelineRunning=false;restoreJobBackup();renderPipeline();}}
async function solve(plan){
  // Browser click events are not serialized configuration objects.
  if(plan?.version!==2)plan=undefined;
  cancel();pause();
  if(plan){try{const resolved=resolveLoadPipeline(mesh,plan,{...chartConfig,atlasPageMode:$('atlas-page-mode').value});$('target').value=resolved.target;}catch(e){fail(e.message);return;}}
  {const p=plan?resolveLoadPipeline(mesh,plan,chartConfig):{target:$('target').value,config:chartConfig};pipelineTrace=new PipelineRecorder(p.target,p.config,plan,()=>0).snapshot();}
  pipelineRunning=true;pipelineStarted=performance.now();renderPipeline();window.lab.ready=false;window.lab.progressEvents=[];
  const token=sequence,start=performance.now();let lastProgress=null,clock;
  const backup=committedMesh===mesh?snapshot:null;
  jobBackup=backup?{mesh,snapshot:backup,selected:[...options.selected],progress:options.progress,inspection}:null;
  $('error').hidden=true;snapshot=null;inspection=EMPTY_INSPECTION;options.focusFace=null;selectionStatus();view.setGeometry(null);$('islands').replaceChildren();
  const c=$('uv'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  $('status').textContent='启动 UV Worker…';$('solve').disabled=true;$('cancel').disabled=false;
  try{
    jobHandle=startUVJob({pipeline:plan,mesh,edges:[...seams],target:$('target').value,seedCharts:postSeed,seedPolicy:postSeed?backup?.inputPolicy:undefined,seedHuman:postHuman,seedPeel:postPeel,seedFeatures:postFeatures,config:{...chartConfig,closedTubeStrips:$('closed-tube-strips').checked,closedTubePanels:Number($('closed-tube-panels').value),closedTubeMaxStretch:Number($('closed-tube-stretch').value),surfaceSymmetry:$('surface-symmetry').checked,symmetryTolerance:Number($('symmetry-tolerance').value)/100,symmetryStrength:Number($('symmetry-strength').value),symmetryIterations:Number($('symmetry-iterations').value),structureGroups:$('structure-groups').checked,structuralRelaxIterations:Number($('structure-relax').value),structureTemplates:$('structure-templates').checked,preserveRimBands:$('preserve-rim-bands').checked,humanTemplates:{panels:$('human-panels').value==='auto'?'auto':Number($('human-panels').value),axis:$('human-axis').value,seamAngleDegrees:Number($('human-angle').value),minAreaFraction:Number($('human-area').value)/100,maxAnisotropy:Number($('human-stretch').value),...($('target').value==='templates'?{selectedCharts:templateSelection}:{})},uvObjective:$('uv-objective').value,paintIterations:Number($('paint-iterations').value),fillMode:$('target').value==='fill'?$('fill-mode').value:'off',fillStep:Number($('fill-step').value)/100,peelSourceHints:false,groupFeatureDegrees:Number($('group-feature-degrees').value),seamBandRings:Number($('seam-band').value),peelFeatureArea:Number($('peel-feature').value)/100,fillFitVacancies:$('fill-fit-vacancies').checked,fillCavitySearch:$('fill-cavities').checked,fillGrowthSteps:Number($('fill-growth').value),fillCommonGainLimit:Number($('fill-common').value),fillRotationStep:Number($('fill-angle').value),fillReflowBudget:Number($('fill-reflow').value),fillMaxAreaGain:Number($('fill-cap').value),fillRecutLarge:false,fillMinStep:Number($('fill-min-step').value)/100,fillRounds:Number($('fill-rounds').value),fillResolution:Number($('fill-resolution').value),fillTimeBudgetMs:Number($('fill-budget').value)*1000,sourceFeaturePolicy:'preserve',sourceRepairPolicy:'reject',sourceAtlasMerge:false,packingOrder:$('packing-order').value,tinyIslandAreaFraction:Number($('tiny-fraction').value)/100,maxTinyAreaBoost:Number($('tiny-cap').value),spatialNeighbors:$('spatial-neighbors').checked,neighborDistanceRatio:Number($('neighbor-distance').value)/100,initialSegmentation:'hierarchical',postMerge:$('post-merge').checked,mergeOptions:{maxShapeChange:Number($('merge-shape-limit').value),reuseValidUV:$('reuse-uv-shape').checked,maxAttempts:$('merge-attempts').value===''?undefined:Number($('merge-attempts').value),targetCharts:Number($('merge-target').value),respectMaterials:$('merge-materials').checked},atlasPageMode:$('atlas-page-mode').value,atlasPageCount:Number($('atlas-page-count').value),maxChartFaces:Number($('chart-faces').value),maxStretch:Number($('chart-stretch').value),regionOptions:chartConfig.regionOptions,method:$('solver').value,padding:Number($('padding').value),autoCut:$('autocut').checked,rotate:$('rotate').checked,packing:$('packing')?.value??'auto',timeBudgetMs:Number($('budget')?.value??120)*1000}},{
      createWorker:()=>{const url=window.labWorkerURL();try{return new Worker(url);}finally{URL.revokeObjectURL(url);}},
      onProgress:p=>{if(token!==sequence)return;lastProgress=p;pipelineTrace=p.pipeline??pipelineTrace;renderPipeline();window.lab.progressEvents.push(p);$('status').textContent=describeUVProgress(p,performance.now()-start);}
    });
    clock=setInterval(()=>{if(token===sequence)$('status').textContent=describeUVProgress(lastProgress,performance.now()-start);},500);
    const result=await jobHandle.result;if(token!==sequence)return;
    snapshot=result;committedMesh=mesh;jobBackup=null;pipelineTrace=snapshot.pipeline??pipelineTrace;inspection=EMPTY_INSPECTION;jobHandle=null;options.selected=snapshot.geometry.islands.map(i=>i.id);options.progress=0;options.focusFace=null;
    rebuildTimeline();view.setOptions(options);view.setGeometry(snapshot.geometry,{resetCamera:framedMesh!==mesh});framedMesh=mesh;list();update();const m=snapshot.metrics;
    $('title').textContent=`${mesh.name} · ${mesh.faces.length.toLocaleString()} 三角面 · ${snapshot.packed.length} 岛`;
    $('status').textContent=(m?`生成 UV：翻面 / 退化 / 正面积重叠检查通过\n有效面积占用 ${(m.occupancy*100).toFixed(1)}% · 包围盒面积总和（可覆盖） ${(m.boxOccupancy*100).toFixed(1)}%\n${m.packingMethod} 排布 · 新增 ${snapshot.addedSeams.length} 条 UV 补切\n`:'生成结果：见验证状态\n')+`Worker 完成 · ${(snapshot.timing.elapsedMs/1000).toFixed(2)} 秒\n`+snapshot.warnings.join('\n')+(snapshot.fragmentation?`\n分割诊断：${snapshot.fragmentation.inputComponents} 个源分量 → ${snapshot.fragmentation.initialCharts} 个初始区域 → ${snapshot.fragmentation.outputCharts} 岛；小于16面的岛 ${snapshot.fragmentation.tinyCharts}\n补切原因：${JSON.stringify(snapshot.fragmentation.reasons)}`:'');
    $('surface-symmetry-summary').textContent=describeSymmetrySummary(snapshot.diagnostics,snapshot.peel);
    $('shape-methods').textContent=snapshot.diagnostics?'实际方法：'+Object.entries(snapshot.diagnostics.reduce((s,d)=>(s[d.method]=(s[d.method]??0)+1,s),{})).map(([m,n])=>m+': '+n).join(' · '):'';
    const fr=snapshot.packingReport?.refinement;renderFillGrowth($('fill-growth-report'),fr);$('fill-summary').textContent=fr?uv.describeFill(fr):'';$('fill-shapes').textContent=fr?'建议检查轮廓/切缝（不是自动补切）：'+fr.shapeWaste.slice(0,5).map(c=>`#${c.id+1} 轮廓/框 ${(c.shapeFill*100).toFixed(0)}%`).join('、'):'';
    reportUV();window.lab.ready=true;
  }catch(e){if(token===sequence){pipelineTrace=terminalPipeline(pipelineTrace,e.code==='cancelled'?'cancelled':e.code==='timeout'?'timeout':'error',performance.now()-pipelineStarted,e.message);fail(e.message);$('status').textContent='未生成新结果，原网格未修改。';if(backup){snapshot=backup;view.setGeometry(snapshot.geometry,{resetCamera:false});rebuildTimeline();view.setOptions(options);list();update();reportUV();window.lab.ready=true;$('status').textContent+='已恢复上一份 UV 快照。';}}}
  finally{clearInterval(clock);if(token===sequence){pipelineRunning=false;renderPipeline();jobHandle=null;$('solve').disabled=false;$('cancel').disabled=true;}}
}
function tune(goal='large'){
 const r=uv.recommendUnwrap(mesh,goal);chartConfig=r.options;$('chart-faces').value=chartConfig.maxChartFaces;$('chart-stretch').value=chartConfig.maxStretch;
 $('auto-config').textContent=`自动填写：${goal==='large'?'大块优先':'均衡'} · ${r.analysis.components} 个连通分量 · 小区域面积比 ${chartConfig.regionOptions.minRegionAreaRatio} · 不为填充率补切`;
}
function load(demo,automatic=false){
 postSeed=undefined;postHuman=undefined;postPeel=undefined;postFeatures=undefined;templateSelection=undefined;
 $('target').value='generated';mesh=core.geometryOnlyMesh(demo.mesh);seams=new Set();tune();
 $('post-merge').checked=false;$('initial-segmentation').value='hierarchical';
 window.lab.ready=false;return solve(automatic?loadPlan:undefined);
}
function autoCharts(goal){postSeed=undefined;postHuman=undefined;postPeel=undefined;postFeatures=undefined;templateSelection=undefined;tune(goal);seams=new Set();$('target').value='generated';return solve();}
function reportUV(){
 $('peel-summary').textContent=snapshot?.peel?`${snapshot.peel.groups.length} 个空间组 → ${snapshot.peel.totalIslands} 个 UV 岛；反馈二分 ${snapshot.peel.feedbackSplits} 次，原 UV 使用为 0；切缝全部来自几何。`:'选择通用剥展后显示组 / 岛和失败反馈记录。';
 const h=snapshot?.human;$('human-summary').textContent=h?`已识别 / 保留 ${h.applied} 个结构区域。`+h.entries.filter(e=>e.status!=='skipped').map(e=>` 原 #${e.sourceChart+1}：${e.status==='applied'?e.template+' → '+e.charts.map(id=>'#'+(id+1)).join(' / '):'未应用 · '+e.reason}`).join('；'):'纯几何结构报告；普通重排不改变结构。';
  const features=snapshot?.features;$('features-summary').textContent=features?`已生成 UV 可辨识性：检查 ${features.detectedPanels} 个主要平面特征，重展 ${features.changedCharts} 个原岛；${features.before} → ${features.after} 岛。保留实际凹口/孔洞轮廓，其他区域仍按空间组开缝剥展。`:'';
  const repair=snapshot?.repair;$('repair-summary').textContent=repair?`当前生成结果验证 ${repair.repaired}/${repair.inspected} 岛：${repair.islands.map(i=>'#'+(i.id+1)+' '+i.method).join('、')||'无需修复'}；其余 ${repair.preserved} 岛通过有效性检查（仍须检查轮廓）。`:'';
  const a=snapshot?.areaAudit;
  $('area-summary').textContent=a?`当前 ${snapshot.packed.length} 岛；面积密度偏大 ${a.oversized.length} / 偏小 ${a.undersized.length}。新 atlas：平均密度可在精排中有界调整。`:'';
  const n=snapshot?.spatialReport;
  $('neighbor-summary').textContent=n?`${n.islandCount} 个真实岛，${n.groups.length} 个空间关联组；${n.links.filter(l=>!l.stitchable).length} 条空间邻近关系（不是缝合）。${n.truncated?'采样比较已达预算。':''}`:'';
  $('audit-summary').textContent=snapshot?.sourceAudit?`原输入真实岛数 ${snapshot.sourceAudit.domains.reduce((n,d)=>n+d.islands,0)}；`+snapshot.sourceAudit.domains.map(d=>`${d.name}：${d.islands} 岛，${d.overlapCountCapped?'至少 ':''}${d.overlapPairs} 对重叠、${d.degenerate} 个退化面`).join('；'):'';
  $('post-summary').textContent=(snapshot?.merge?`缝合：${snapshot.merge.before} → ${snapshot.merge.after} 岛；接受 ${snapshot.merge.accepted} 次（保留开缝连接 ${snapshot.merge.partialJoins??0} 次 / 保留形状缝合 ${snapshot.merge.rigidJoins??0} 次），移除 ${snapshot.merge.removedSeams.length} 条边。${snapshot.merge.budgetExhausted?'达到尝试预算。':''}`:'')+(snapshot?.pageReport?` 按连接关系分配 ${snapshot.pageReport.actual} 页，同页共享边界 ${(snapshot.pageReport.retainedSharedBoundaryRatio*100).toFixed(1)}%。`:'');
}
function postprocess(operation){if(!snapshot)return;if(operation==='templates'){if(!inspection.islands.length)return;templateSelection=[...inspection.islands];$('structure-templates').checked=true;$('uv-objective').value='paint';$('solver').value='auto';$('autocut').checked=true;}postSeed=snapshot.packed;postHuman=snapshot.human;postPeel=snapshot.peel;postFeatures=snapshot.features;seams=new Set(snapshot.seams);$('target').value=operation;return solve();}
$('human-selected').onclick=()=>postprocess('templates');
$('post-stitch').onclick=()=>postprocess('stitch');$('post-repack').onclick=()=>postprocess('repack');$('post-fill').onclick=()=>postprocess('fill');
$('peel-groups').onclick=()=>{postSeed=undefined;postHuman=undefined;postPeel=undefined;postFeatures=undefined;templateSelection=undefined;seams=new Set();$('target').value='generated';$('post-merge').checked=false;$('initial-segmentation').value='hierarchical';$('uv-objective').value='paint';$('solver').value='auto';$('autocut').checked=true;return solve();};
$('pre-connected').onclick=()=>{postSeed=undefined;postHuman=undefined;postPeel=undefined;postFeatures=undefined;templateSelection=undefined;seams=new Set();$('target').value='generated';$('post-merge').checked=true;$('initial-segmentation').value='connected';return solve();};
async function loadVerified(id){
 try{const data=window.LAB_GEOMETRY?.[id];if(!data)throw Error('缺少纯几何样例');
 const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 return await load({mesh:JSON.parse(text),edges:new Set()},true);
 }catch(e){fail(String(e));}
}
$('verified-corset').onclick=()=>loadVerified('corset');$('verified-helmet').onclick=()=>loadVerified('flight-helmet');
$('fragment-demo').onclick=()=>{$('target').value='generated';return load(makeFragmentationDemo(2));};
$('auto-large').onclick=()=>autoCharts('large');$('auto-balanced').onclick=()=>autoCharts('balanced');
$('extract-uv').onclick=()=>{postSeed=undefined;postHuman=undefined;postPeel=undefined;postFeatures=undefined;templateSelection=undefined;seams=new Set();$('target').value='generated';return solve(loadPlan);};
for(const stage of uv.HINGE_STAGES){const b=document.createElement('button');b.textContent=stage.label;b.dataset.stage=stage.t;b.onclick=()=>{pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked,options.timeline),index=inspectionIndex??schedule.focusIndex;update({progress:uv.islandTimelineProgress((options.timeline?.entries[index]?uv.motionLocal(options.timeline.entries[index].profile,stage.t):uv.hingePlaybackProgress(stage.t,options.holdNet)),index,options.selected.length,options.order,options.handoff,options.timeline)},index);};$('stages').append(b);}
$('ribbon').onclick=()=>load(makeHingeDemo());$('cube').onclick=()=>load(makeUnfoldDemo());$('complex').onclick=()=>{const m=core.makeComplexExample($('example').value,'low');load({mesh:m,edges:new Set()},true);};
$('file').onchange=async e=>{try{const f=e.target.files?.[0];if(f){const m=core.parseOBJ(await f.text(),f.name);await load({mesh:m,edges:new Set()},true);}}catch(e){fail(e.message);}};
$('solve').onclick=solve;$('cancel').onclick=()=>{cancel();$('status').textContent='已取消本次求解。';};$('target').onchange=solve;
$('all').onclick=()=>{pause();inspection=EMPTY_INSPECTION;options.focusFace=null;options.selected=snapshot?.geometry.islands.map(i=>i.id)??[];list();update({progress:0});};$('none').onclick=()=>{pause();inspection=EMPTY_INSPECTION;options.focusFace=null;options.selected=[];list();update({progress:0});};
$('separation').oninput=()=>{pause();update({separation:Number($('separation').value),progress:0});};$('in-place').onclick=()=>{pause();$('separation').value='0';update({separation:0,progress:0});};
$('focus-dissolve').onchange=()=>{$('focus-mode').value=$('focus-dissolve').checked?'ghost':'off';update({focusMode:$('focus-mode').value});};$('focus-mode').onchange=()=>{$('focus-dissolve').checked=$('focus-mode').value!=='off';update({focusMode:$('focus-mode').value});};for(const [id,key] of [['arrival-hold','arrivalHoldSeconds'],['arrival-fade','arrivalFadeSeconds']])$(id).oninput=()=>{const n=$(id).valueAsNumber;if(!Number.isFinite(n))return;const values=arrivalSettings({[key]:n});update({[key]:id==='arrival-hold'?values.hold:values.fade});};
$('focus-opacity').oninput=()=>update({focusOpacity:Number($('focus-opacity').value)});$('focus-radius').oninput=()=>update({focusRadius:Number($('focus-radius').value)});$('focus-retained').oninput=()=>update({focusRetained:Number($('focus-retained').value)});
$('overlap-mode').onchange=()=>update({overlapMode:$('overlap-mode').value});
$('overlap-opacity').oninput=()=>update({overlapOpacity:Number($('overlap-opacity').value)});
$('overlap-tolerance').onchange=()=>{const n=Number($('overlap-tolerance').value);if(Number.isFinite(n)&&n>=.0001&&n<=1)update({overlapTolerance:n/100});};
$('overlap-demo').onclick=()=>{$('target').value='generated';return load(makeOverlapDemo());};
$('wave').onchange=()=>{pause();update({hingeWave:$('wave').checked,progress:0});};
for(const [id,key]of [['face-tones','faceTones'],['frame','autoFrame'],['hinges','showHinges'],['temporary','showTemporaryCuts'],['checker','checker']])$(id).onchange=()=>update({[key]:$(id).checked});
$('handoff').oninput=()=>{pause();update({handoff:Number($('handoff').value),progress:0});};$('skip-static').onchange=()=>{pause();update({skipStatic:$('skip-static').checked,progress:0});};$('motion-tolerance').onchange=()=>{const v=Number($('motion-tolerance').value);if(Number.isFinite(v)&&v>=0&&v<=.001){pause();update({motionTolerance:v,progress:0});}};$('hold-net').onchange=()=>{pause();update({holdNet:$('hold-net').checked,progress:0});};$('queue-prev').onclick=()=>seekQueue(-1);$('queue-next').onclick=()=>seekQueue(1);$('seconds').onchange=()=>update();$('rate').onchange=()=>update();$('reverse').onchange=()=>update();
$('order').onchange=()=>{pause();update({order:$('order').value,progress:0});};$('context').onchange=()=>update({context:$('context').value});$('fit-current').onclick=()=>view.fitCurrent();$('orbit').onclick=()=>view.fit('orbit');$('front').onclick=()=>view.fit('uv');
attachScrubSession($('progress'),active=>{playing=false;scrubbing=active;clockLast=null;$('play').textContent='播放展开';update();});
$('progress').oninput=()=>{playing=false;clockLast=null;$('play').textContent='播放展开';update({progress:Number($('progress').value)});};$('play').onclick=()=>{if(playing){pause();return;}if(!snapshot||!options.selected.length)return;scrubbing=false;playing=true;inspectionIndex=null;clockLast=null;const reverse=$('reverse').checked;if((!reverse&&options.progress===1)||(reverse&&options.progress===0))update({progress:reverse?1:0});$('play').textContent='暂停';update();};
// Visibility resets the timestamp so time spent in a hidden tab is not replayed.
let clockLast=null;document.addEventListener('visibilitychange',()=>{clockLast=null;});
function tick(now){
  if(playing&&!document.hidden){
    const elapsed=clockLast===null?0:Math.max(0,now-clockLast);
    const seconds=Math.max(.5,Math.min(60,Number($('seconds').value)||12));
    const duration=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff,options.timeline);
    const next=uv.advanceUnfoldPlayback(options.progress,elapsed,duration,$('reverse').checked,$('loop').checked,Number($('rate').value));
    if(next.finished)pause();update({progress:next.progress});
  }
  clockLast=playing&&!document.hidden?now:null;requestAnimationFrame(tick);
}requestAnimationFrame(tick);
function boxSelect(hits,mode){if(!snapshot)return;inspection={islands:applyBoxSelection(inspection.islands,hits,snapshot.geometry.islands.map(i=>i.id),mode),face:null};pause();options.selected=[...inspection.islands];options.focusFace=null;list();update({progress:0});}
attachUVSelection($('uv'),()=>({snapshot,selected:inspection.islands}),boxSelect,pick);
$('export').onclick=()=>{if(!snapshot)return;const text=core.meshToOBJ(uv.meshWithPreviewUV(mesh,snapshot.packed)),url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='meshtailor-target-uv.obj';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('diagnostic').onclick=()=>{if(!snapshot)return;const report={version:'0.4.29',asset:{name:mesh.name,vertices:mesh.positions.length,faces:mesh.faces.length},config:chartConfig,features:snapshot.features,peel:snapshot.peel,human:snapshot.human,fragmentation:snapshot.fragmentation,repair:snapshot.repair,sourceAudit:snapshot.sourceAudit,areaAudit:snapshot.areaAudit,sourceAreaAudit:snapshot.sourceAreaAudit,spatialReport:snapshot.spatialReport,packingReport:snapshot.packingReport,merge:snapshot.merge,pageReport:snapshot.pageReport,uvSpaces:snapshot.geometry.atlas.spaces,metrics:snapshot.metrics,warnings:snapshot.warnings,timing:snapshot.timing};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='meshtailor-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(drawUV).observe($('uvhost'));
if($('clear-face'))$('clear-face').onclick=clearFace;
window.lab={ready:false,loadVerified,view,options,errors,update,select,pick,boxSelect,clearFace,get inspection(){return inspection;},load,solve,postprocess,pause,uv,core,cancel,progressEvents:[],get snapshot(){return snapshot;},get mesh(){return mesh;},get playing(){return playing;},get loadPlan(){return loadPlan;},get pipelineTrace(){return pipelineTrace;}};
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>{
  for(const tab of document.querySelectorAll('[data-tool]')){
    const selected=tab===button;tab.setAttribute('aria-selected',String(selected));
    document.getElementById('lab-tools-'+tab.dataset.tool).hidden=!selected;
  }
};
if($('header-import'))$('header-import').onclick=()=>$('file').click();
if($('header-export'))$('header-export').onclick=()=>$('export').click();
if($('clear-inspection'))$('clear-inspection').onclick=()=>$('none').click();
await load(makeHingeDemo());

for(const id of ['inspect-source','peel-source','peel-panels','source-merge','source-repair','source-features','source-feature-tolerance','source-layout','fill-recut']){const el=$(id);if(el){el.disabled=true;const label=el.closest('label');(label??el).hidden=true;}}

$('fill-balanced').onclick=()=>{$('fill-cap').value='1.6';};
$('fill-bounded').onclick=()=>{$('fill-cap').value=String(uv.DEFAULT_FILL_DENSITY_LIMIT);$('fill-fit-vacancies').checked=true;};
