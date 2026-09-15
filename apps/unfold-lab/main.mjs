import * as core from '/packages/mesh-core/src/index.js';
import * as uv from '/packages/uv/src/index.js';
import { makeHingeDemo, makeUnfoldDemo, makeFragmentationDemo, makeOverlapDemo } from '/apps/studio/src/unfold/demo.js';
import { UnfoldWebGLView } from '/apps/studio/src/unfold/webgl-view.js';
import { DEFAULT_AUTO_FRAME } from '/apps/studio/src/unfold/camera-policy.js';
import { drawUVSnapshot, pickUVFace } from '/apps/studio/src/unfold/uv-drawing.js';
import {startUVJob,describeUVProgress} from '/apps/studio/src/unfold/uv-job-client.js';
import { EMPTY_INSPECTION, selectInspectionIsland, resolveInspectionPick } from '/apps/studio/src/unfold/selection-policy.js';
let inspection=EMPTY_INSPECTION;
const $=id=>document.getElementById(id);
let inspectionIndex=null, timelineGeometry=null, timelineKey='';
let chartConfig={...uv.DEFAULT_UNWRAP};
let postSeed;
let mesh,seams,framedMesh=null,snapshot=null,jobHandle=null,playing=false,sequence=0;
const options={overlapMode:'coplanar',overlapTolerance:.0001,overlapOpacity:.72,faceTones:true,skipStatic:uv.DEFAULT_SKIP_STATIC,motionTolerance:uv.DEFAULT_MOTION_RELATIVE_EPSILON,progress:0,selected:[],order:uv.DEFAULT_UNFOLD_ORDER,handoff:uv.DEFAULT_HANDOFF,holdNet:false,path:'hinge',separation:uv.DEFAULT_SEPARATION,context:'dim',wireframe:true,checker:false,labels:true,xray:false,focusFace:null,hingeWave:true,showHinges:true,showTemporaryCuts:true,autoFrame:DEFAULT_AUTO_FRAME};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const view=new UnfoldWebGLView($('view'),(id,face,add)=>pick(id,face,add),e=>{if(e)fail(e);},()=>{options.autoFrame=false;$('frame').checked=false;view.setOptions(options);cameraStatus();});
function cameraStatus(){$('frame').checked=options.autoFrame;$('camera-status').textContent=options.autoFrame?'自动跟随中；操作相机会立即关闭跟随，动画继续。':'手动相机：动画不改变视角。适配按钮只执行一次。';}
function fail(message){$('error').hidden=false;$('error').textContent=String(message);}
function pause(){playing=false;clockLast=null;$('play').textContent='播放展开';}
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
  const selected=inspection.islands[0],area=snapshot?.areaAudit?.islands.find(r=>r.id===selected);
  $('selection-area').textContent=area?`3D 面积占比 ${(area.share3D*100).toFixed(4)}% / UV 占比 ${(area.shareUV*100).toFixed(4)}% · 密度 ${area.densityRatio?.toFixed(3)??'无效'}×（同域）`:'';
  const neighbors=snapshot?.spatialReport?.links.filter(l=>l.a===selected||l.b===selected)??[];
  $('selection-neighbors').textContent=selected===undefined?'':`3D 邻居：${neighbors.map(l=>'#'+((l.a===selected?l.b:l.a)+1)+(l.stitchable?' 共享边':' 空间关联')).join(' · ')||'采样范围内未找到'}。关联不改变真实岛数。`;
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
  const key=JSON.stringify([options.selected,options.order,options.handoff,options.holdNet,options.path,options.separation,options.hingeWave,options.skipStatic,options.motionTolerance]);
  if(timelineGeometry!==snapshot.geometry||timelineKey!==key){
    options.timeline=uv.buildMotionTimeline(snapshot.geometry,options,{skipStatic:options.skipStatic,relativeEpsilon:options.motionTolerance});
    timelineGeometry=snapshot.geometry;timelineKey=key;
  }
}
function update(patch={},focus=null){
  if(Object.hasOwn(patch,"progress"))inspectionIndex=focus;
  Object.assign(options,patch);
  rebuildTimeline();
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
  $('queue-status').textContent=`${reverse?'已折回':'已完成'} ${reverse?schedule.waiting:schedule.completed} / ${options.selected.length} · ${reverse?'待折回':'等待'} ${reverse?schedule.completed:schedule.waiting} · ${schedule.active.length?'播放中 '+schedule.active.map(a=>`#${options.selected[a.index]+1} (${(a.progress*100).toFixed(1)}%)`).join(' → '):'无活动岛'}\n总时长 ${duration.toFixed(1)} 秒 · 剩余 ${(duration*(reverse?options.progress:1-options.progress)).toFixed(1)} 秒`;
  const nominal=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff);
  const profile=options.timeline?.entries[focusIndex]?.profile;
  $('skip-static').checked=options.skipStatic;
  $('motion-status').textContent=`自动跳过${options.skipStatic?'已开启':'已关闭'} · 原队列 ${nominal.toFixed(1)} 秒 → 实际 ${duration.toFixed(1)} 秒 · 缩短 ${Math.max(0,nominal-duration).toFixed(1)} 秒\n`+(profile?`当前岛 ${ (profile.duration*seconds).toFixed(1)} 秒 · 已跳过：${profile.segments.filter(s=>!s.keep&&s.stage!=='主动观察停留').map(s=>s.stage).join('、')||'无'} `:'');
  $('handoff-label').textContent=`前岛有效进度至少 ${Math.round(options.handoff*100)}% 时接力`;
  $('handoff').disabled=options.order==='sequential';
  $('queue-prev').disabled=focusIndex<=0;$('queue-next').disabled=focusIndex<0||focusIndex>=options.selected.length-1;
}
function seekQueue(direction){pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked,options.timeline),index=Math.max(0,Math.min(options.selected.length-1,(inspectionIndex??schedule.focusIndex)+direction));update({progress:uv.islandTimelineProgress($('reverse').checked?1:0,index,options.selected.length,options.order,options.handoff,options.timeline)},index);}
function cancel(){sequence++;jobHandle?.cancel();jobHandle=null;$('cancel').disabled=true;$('solve').disabled=false;}
async function solve(){
  cancel();pause();window.lab.ready=false;window.lab.progressEvents=[];
  const token=sequence,start=performance.now();let lastProgress=null,clock;
  const backup=['stitch','repack','source-atlas'].includes($('target').value)?snapshot:null;
  $('error').hidden=true;snapshot=null;inspection=EMPTY_INSPECTION;options.focusFace=null;selectionStatus();view.setGeometry(null);$('islands').replaceChildren();
  const c=$('uv'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  $('status').textContent='启动 UV Worker…';$('solve').disabled=true;$('cancel').disabled=false;
  try{
    jobHandle=startUVJob({mesh,edges:[...seams],target:$('target').value,seedCharts:postSeed,config:{...chartConfig,sourceAtlasMerge:$('source-merge').checked,packingOrder:$('packing-order').value,tinyIslandAreaFraction:Number($('tiny-fraction').value)/100,maxTinyAreaBoost:Number($('tiny-cap').value),spatialNeighbors:$('spatial-neighbors').checked,neighborDistanceRatio:Number($('neighbor-distance').value)/100,initialSegmentation:$('initial-segmentation').value,postMerge:$('post-merge').checked,mergeOptions:{maxAttempts:Number($('merge-attempts').value),targetCharts:Number($('merge-target').value),respectMaterials:$('merge-materials').checked},atlasPageMode:$('atlas-page-mode').value,atlasPageCount:Number($('atlas-page-count').value),maxChartFaces:Number($('chart-faces').value),maxStretch:Number($('chart-stretch').value),regionOptions:{...chartConfig.regionOptions,normalConeDegrees:Number($('chart-cone').value)},method:$('solver').value,padding:Number($('padding').value),autoCut:$('autocut').checked,rotate:$('rotate').checked,packing:$('packing')?.value??'auto',timeBudgetMs:Number($('budget')?.value??120)*1000}},{
      createWorker:()=>{const url=window.labWorkerURL();try{return new Worker(url);}finally{URL.revokeObjectURL(url);}},
      onProgress:p=>{if(token!==sequence)return;lastProgress=p;window.lab.progressEvents.push(p);$('status').textContent=describeUVProgress(p,performance.now()-start);}
    });
    clock=setInterval(()=>{if(token===sequence)$('status').textContent=describeUVProgress(lastProgress,performance.now()-start);},500);
    const result=await jobHandle.result;if(token!==sequence)return;
    snapshot=result;inspection=EMPTY_INSPECTION;jobHandle=null;options.selected=snapshot.geometry.islands.map(i=>i.id);options.progress=0;options.focusFace=null;
    rebuildTimeline();view.setOptions(options);view.setGeometry(snapshot.geometry,{resetCamera:framedMesh!==mesh});framedMesh=mesh;list();update();const m=snapshot.metrics;
    $('title').textContent=`${mesh.name} · ${mesh.faces.length.toLocaleString()} 三角面 · ${snapshot.packed.length} 岛`;
    $('status').textContent=(m?`生成 UV：翻面 / 退化 / 正面积重叠检查通过\n有效面积占用 ${(m.occupancy*100).toFixed(1)}% · 包围盒 ${(m.boxOccupancy*100).toFixed(1)}%\n${m.packingMethod} 排布 · 新增 ${snapshot.addedSeams.length} 条 UV 补切\n`:'原始 UV：未修复、未重新排布\n')+`Worker 完成 · ${(snapshot.timing.elapsedMs/1000).toFixed(2)} 秒\n`+snapshot.warnings.join('\n')+(snapshot.fragmentation?`\n分割诊断：${snapshot.fragmentation.inputComponents} 个源分量 → ${snapshot.fragmentation.initialCharts} 个初始区域 → ${snapshot.fragmentation.outputCharts} 岛；小于16面的岛 ${snapshot.fragmentation.tinyCharts}\n补切原因：${JSON.stringify(snapshot.fragmentation.reasons)}`:'');
    reportUV();window.lab.ready=true;
  }catch(e){if(token===sequence){fail(e.message);$('status').textContent='未生成新结果，原网格未修改。';if(backup){snapshot=backup;view.setGeometry(snapshot.geometry,{resetCamera:false});rebuildTimeline();view.setOptions(options);list();update();reportUV();window.lab.ready=true;$('status').textContent+='已恢复上一份 UV 快照。';}}}
  finally{clearInterval(clock);if(token===sequence){jobHandle=null;$('solve').disabled=false;$('cancel').disabled=true;}}
}
function tune(goal='large'){
 const r=uv.recommendUnwrap(mesh,goal);chartConfig=r.options;$('chart-faces').value=chartConfig.maxChartFaces;$('chart-cone').value=chartConfig.regionOptions.normalConeDegrees;$('chart-stretch').value=chartConfig.maxStretch;$('source-layout').value=chartConfig.sourceUVLayout??'materials';
 $('auto-config').textContent=`自动填写：${goal==='large'?'大块优先':'均衡'} · ${r.analysis.components} 个连通分量 · 小区域面积比 ${chartConfig.regionOptions.minRegionAreaRatio} · 不为填充率补切`;
}
function load(demo){postSeed=undefined;if(['stitch','repack'].includes($('target').value))$('target').value='generated';mesh=demo.mesh;seams=demo.edges;tune();$('post-merge').checked=false;$('initial-segmentation').value='regions';$('extract-uv').disabled=!mesh.faces.every(f=>f.uvs?.every(p=>p?.length===2));window.lab.ready=false;return solve();}
function autoCharts(goal){tune(goal);seams=new Set();$('target').value='generated';return solve();}
function reportUV(){
  const a=snapshot?.areaAudit;
  $('area-summary').textContent=a?`当前 ${snapshot.packed.length} 岛；面积密度偏大 ${a.oversized.length} / 偏小 ${a.undersized.length}。${snapshot.target==='source'?'原样检查未修正。':'新 atlas 已统一面积比例。'}`:'';
  const n=snapshot?.spatialReport;
  $('neighbor-summary').textContent=n?`${n.islandCount} 个真实岛，${n.groups.length} 个空间关联组；${n.links.filter(l=>!l.stitchable).length} 条空间邻近关系（不是缝合）。${n.truncated?'采样比较已达预算。':''}`:'';
  $('audit-summary').textContent=snapshot?.sourceAudit?`原输入真实岛数 ${snapshot.sourceAudit.domains.reduce((n,d)=>n+d.islands,0)}；`+snapshot.sourceAudit.domains.map(d=>`${d.name}：${d.islands} 岛，${d.overlapCountCapped?'至少 ':''}${d.overlapPairs} 对重叠、${d.degenerate} 个退化面`).join('；'):'';
  $('post-summary').textContent=(snapshot?.merge?`缝合：${snapshot.merge.before} → ${snapshot.merge.after} 岛；接受 ${snapshot.merge.accepted} 次，移除 ${snapshot.merge.removedSeams.length} 条边。${snapshot.merge.budgetExhausted?'达到尝试预算。':''}`:'')+(snapshot?.pageReport?` 按连接关系分配 ${snapshot.pageReport.actual} 页，同页共享边界 ${(snapshot.pageReport.retainedSharedBoundaryRatio*100).toFixed(1)}%。`:'');
}
function postprocess(operation){if(!snapshot)return;postSeed=snapshot.packed;seams=new Set(snapshot.seams);$('target').value=operation;return solve();}
$('post-stitch').onclick=()=>postprocess('stitch');$('post-repack').onclick=()=>postprocess('repack');
$('pre-connected').onclick=()=>{postSeed=undefined;seams=new Set();$('target').value='generated';$('post-merge').checked=true;$('initial-segmentation').value='connected';return solve();};
$('fragment-demo').onclick=()=>{$('target').value='source';return load(makeFragmentationDemo(2));};
$('auto-large').onclick=()=>autoCharts('large');$('auto-balanced').onclick=()=>autoCharts('balanced');
$('extract-uv').onclick=()=>{$('target').value='source-atlas';return solve();};
$('inspect-source').onclick=()=>{$('target').value='source';return solve();};
for(const stage of uv.HINGE_STAGES){const b=document.createElement('button');b.textContent=stage.label;b.dataset.stage=stage.t;b.onclick=()=>{pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked,options.timeline),index=inspectionIndex??schedule.focusIndex;update({progress:uv.islandTimelineProgress((options.timeline?.entries[index]?uv.motionLocal(options.timeline.entries[index].profile,stage.t):uv.hingePlaybackProgress(stage.t,options.holdNet)),index,options.selected.length,options.order,options.handoff,options.timeline)},index);};$('stages').append(b);}
$('ribbon').onclick=()=>load(makeHingeDemo());$('cube').onclick=()=>load(makeUnfoldDemo());$('complex').onclick=()=>{const m=core.makeComplexExample($('example').value,'low');load({mesh:m,edges:new Set()});};
$('file').onchange=async e=>{try{const f=e.target.files?.[0];if(f){const m=core.parseOBJ(await f.text(),f.name);await load({mesh:m,edges:new Set()});}}catch(e){fail(e.message);}};
$('source-layout').onchange=()=>{chartConfig.sourceUVLayout=$('source-layout').value;if($('target').value==='source')solve();};
$('solve').onclick=solve;$('cancel').onclick=()=>{cancel();$('status').textContent='已取消本次求解。';};$('target').onchange=solve;
$('all').onclick=()=>{pause();inspection=EMPTY_INSPECTION;options.focusFace=null;options.selected=snapshot?.geometry.islands.map(i=>i.id)??[];list();update({progress:0});};$('none').onclick=()=>{pause();inspection=EMPTY_INSPECTION;options.focusFace=null;options.selected=[];list();update({progress:0});};
$('separation').oninput=()=>{pause();update({separation:Number($('separation').value),progress:0});};$('in-place').onclick=()=>{pause();$('separation').value='0';update({separation:0,progress:0});};
$('overlap-mode').onchange=()=>update({overlapMode:$('overlap-mode').value});
$('overlap-opacity').oninput=()=>update({overlapOpacity:Number($('overlap-opacity').value)});
$('overlap-tolerance').onchange=()=>{const n=Number($('overlap-tolerance').value);if(Number.isFinite(n)&&n>=.0001&&n<=1)update({overlapTolerance:n/100});};
$('overlap-demo').onclick=()=>{$('target').value='source';return load(makeOverlapDemo());};
$('wave').onchange=()=>{pause();update({hingeWave:$('wave').checked,progress:0});};
for(const [id,key]of [['face-tones','faceTones'],['frame','autoFrame'],['hinges','showHinges'],['temporary','showTemporaryCuts'],['checker','checker']])$(id).onchange=()=>update({[key]:$(id).checked});
$('handoff').oninput=()=>{pause();update({handoff:Number($('handoff').value),progress:0});};$('skip-static').onchange=()=>{pause();update({skipStatic:$('skip-static').checked,progress:0});};$('motion-tolerance').onchange=()=>{const v=Number($('motion-tolerance').value);if(Number.isFinite(v)&&v>=0&&v<=.001){pause();update({motionTolerance:v,progress:0});}};$('hold-net').onchange=()=>{pause();update({holdNet:$('hold-net').checked,progress:0});};$('queue-prev').onclick=()=>seekQueue(-1);$('queue-next').onclick=()=>seekQueue(1);$('seconds').onchange=()=>update();$('reverse').onchange=()=>update();
$('order').onchange=()=>{pause();update({order:$('order').value,progress:0});};$('context').onchange=()=>update({context:$('context').value});$('fit-current').onclick=()=>view.fitCurrent();$('orbit').onclick=()=>view.fit('orbit');$('front').onclick=()=>view.fit('uv');
$('progress').oninput=()=>{pause();update({progress:Number($('progress').value)});};$('play').onclick=()=>{if(playing){pause();return;}if(!snapshot||!options.selected.length)return;playing=true;inspectionIndex=null;clockLast=null;const reverse=$('reverse').checked;if((!reverse&&options.progress===1)||(reverse&&options.progress===0))update({progress:reverse?1:0});$('play').textContent='暂停';};
// Visibility resets the timestamp so time spent in a hidden tab is not replayed.
let clockLast=null;document.addEventListener('visibilitychange',()=>{clockLast=null;});
function tick(now){
  if(playing&&!document.hidden){
    const elapsed=clockLast===null?0:Math.max(0,now-clockLast);
    const seconds=Math.max(.5,Math.min(60,Number($('seconds').value)||12));
    const duration=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff,options.timeline);
    const next=uv.advanceUnfoldPlayback(options.progress,elapsed,duration,$('reverse').checked,$('loop').checked);
    if(next.finished)pause();update({progress:next.progress});
  }
  clockLast=playing&&!document.hidden?now:null;requestAnimationFrame(tick);
}requestAnimationFrame(tick);
$('uv').onclick=e=>{if(!snapshot)return;const r=$('uv').getBoundingClientRect(),hit=pickUVFace(snapshot,r.width,r.height,e.clientX-r.left,e.clientY-r.top,options.selected);if(hit)pick(hit.id,hit.face,e.shiftKey||e.ctrlKey||e.metaKey);};
$('export').onclick=()=>{if(!snapshot)return;const text=core.meshToOBJ(uv.meshWithPreviewUV(mesh,snapshot.packed)),url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='meshtailor-target-uv.obj';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('diagnostic').onclick=()=>{if(!snapshot)return;const report={version:'0.4.9',asset:{name:mesh.name,vertices:mesh.positions.length,faces:mesh.faces.length},config:chartConfig,fragmentation:snapshot.fragmentation,sourceAudit:snapshot.sourceAudit,areaAudit:snapshot.areaAudit,sourceAreaAudit:snapshot.sourceAreaAudit,spatialReport:snapshot.spatialReport,packingReport:snapshot.packingReport,merge:snapshot.merge,pageReport:snapshot.pageReport,uvSpaces:snapshot.geometry.atlas.spaces,metrics:snapshot.metrics,warnings:snapshot.warnings,timing:snapshot.timing};const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='meshtailor-diagnostic.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(drawUV).observe($('uvhost'));
if($('clear-face'))$('clear-face').onclick=clearFace;
window.lab={ready:false,view,options,errors,update,select,pick,clearFace,get inspection(){return inspection;},load,solve,postprocess,pause,uv,core,cancel,progressEvents:[],get snapshot(){return snapshot;},get mesh(){return mesh;},get playing(){return playing;}};
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
