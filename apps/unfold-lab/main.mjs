import * as core from '/packages/mesh-core/src/index.js';
import * as uv from '/packages/uv/src/index.js';
import { extractSeamEdgesFromUV } from '/packages/chaining-seams/src/index.js';
import { makeHingeDemo, makeUnfoldDemo } from '/apps/studio/src/unfold/demo.js';
import { UnfoldWebGLView } from '/apps/studio/src/unfold/webgl-view.js';
import { DEFAULT_AUTO_FRAME } from '/apps/studio/src/unfold/camera-policy.js';
import { drawUVSnapshot, pickUVFace } from '/apps/studio/src/unfold/uv-drawing.js';
import {startUVJob,describeUVProgress} from '/apps/studio/src/unfold/uv-job-client.js';
const $=id=>document.getElementById(id);
let inspectionIndex=null;
let mesh,seams,framedMesh=null,snapshot=null,jobHandle=null,playing=false,sequence=0;
const options={progress:0,selected:[],order:uv.DEFAULT_UNFOLD_ORDER,handoff:uv.DEFAULT_HANDOFF,holdNet:false,path:'hinge',separation:.5,context:'dim',wireframe:true,checker:false,labels:true,xray:false,focusFace:null,hingeWave:true,showHinges:true,showTemporaryCuts:true,autoFrame:DEFAULT_AUTO_FRAME};
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const view=new UnfoldWebGLView($('view'),(id,face,add)=>select(id,face,add),e=>{if(e)fail(e);},()=>{options.autoFrame=false;$('frame').checked=false;view.setOptions(options);cameraStatus();});
function cameraStatus(){$('frame').checked=options.autoFrame;$('camera-status').textContent=options.autoFrame?'自动跟随中；操作相机会立即关闭跟随，动画继续。':'手动相机：动画不改变视角。适配按钮只执行一次。';}
function fail(message){$('error').hidden=false;$('error').textContent=String(message);}
function pause(){playing=false;clockLast=null;$('play').textContent='播放展开';}
function drawUV(){if(!snapshot)return;const host=$('uvhost'),c=$('uv'),d=Math.min(devicePixelRatio,2),ctx=c.getContext('2d');c.width=Math.max(1,Math.round(host.clientWidth*d));c.height=Math.max(1,Math.round(host.clientHeight*d));ctx.setTransform(d,0,0,d,0,0);drawUVSnapshot(ctx,snapshot,host.clientWidth,host.clientHeight,options);}
function list(){if(!snapshot)return;$('islands').replaceChildren();for(const island of snapshot.geometry.islands.slice(0,100)){const row=document.createElement('div');row.className='island';const box=document.createElement('input');box.type='checkbox';box.checked=options.selected.includes(island.id);box.setAttribute('aria-label','选中岛 '+(island.id+1));box.onchange=()=>select(island.id,null,true);const b=document.createElement('button');b.innerHTML=`<i style="background:rgb(${uv.islandColor(island.id).map(x=>Math.round(x*255)).join(',')})"></i>#${island.id+1} · ${island.faces.length} 面`;b.onclick=()=>select(island.id,null,false);row.append(box,b);$('islands').append(row);}}
function select(id,face=null,add=false){pause();options.selected=add?(options.selected.includes(id)?options.selected.filter(x=>x!==id):[...options.selected,id]):[id];options.focusFace=face;options.progress=0;list();update();}
function update(patch={},focus=null){
  if(Object.hasOwn(patch,"progress"))inspectionIndex=focus;
  Object.assign(options,patch);
  view.setOptions(options);cameraStatus();drawUV();
  $('progress').value=options.progress;$('percent').textContent=(options.progress*100).toFixed(1)+'%';
  const reverse=$('reverse').checked,schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,reverse);
  const focusIndex=!playing&&inspectionIndex!==null&&inspectionIndex<options.selected.length?inspectionIndex:schedule.focusIndex;
  const local=uv.islandProgress(options.progress,focusIndex,options.selected.length,options.order,options.handoff);
  const pose=uv.hingePoseProgress(local,options.holdNet);
  $('phase').textContent=(focusIndex<0?'没有选择岛':`#${options.selected[focusIndex]+1} · `)+(pose<.18?'分离面片':pose<.28?'转向观察':pose<.70?'沿边铰链旋转':pose<.80?'刚性平面网':pose<.92?'UV 参数化形变':pose<1?'面积感知排布':'目标 UV');
  const seconds=Math.max(.5,Math.min(60,Number($('seconds').value)||12));
  const duration=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff);
  $('queue-status').textContent=`${reverse?'已折回':'已完成'} ${reverse?schedule.waiting:schedule.completed} / ${options.selected.length} · ${reverse?'待折回':'等待'} ${reverse?schedule.completed:schedule.waiting} · ${schedule.active.length?'播放中 '+schedule.active.map(a=>`#${options.selected[a.index]+1} (${(a.progress*100).toFixed(1)}%)`).join(' → '):'无活动岛'}\n总时长 ${duration.toFixed(1)} 秒 · 剩余 ${(duration*(reverse?options.progress:1-options.progress)).toFixed(1)} 秒`;
  $('handoff-label').textContent=`前岛完成 ${Math.round(options.handoff*100)}% 时接力`;
  $('handoff').disabled=options.order==='sequential';
  $('queue-prev').disabled=focusIndex<=0;$('queue-next').disabled=focusIndex<0||focusIndex>=options.selected.length-1;
}
function seekQueue(direction){pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked),index=Math.max(0,Math.min(options.selected.length-1,(inspectionIndex??schedule.focusIndex)+direction));update({progress:uv.islandTimelineProgress($('reverse').checked?1:0,index,options.selected.length,options.order,options.handoff)},index);}
function cancel(){sequence++;jobHandle?.cancel();jobHandle=null;$('cancel').disabled=true;$('solve').disabled=false;}
async function solve(){
  cancel();pause();window.lab.ready=false;window.lab.progressEvents=[];
  const token=sequence,start=performance.now();let lastProgress=null,clock;
  $('error').hidden=true;snapshot=null;view.setGeometry(null);$('islands').replaceChildren();
  const c=$('uv'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  $('status').textContent='启动 UV Worker…';$('solve').disabled=true;$('cancel').disabled=false;
  try{
    jobHandle=startUVJob({mesh,edges:[...seams],target:$('target').value,config:{...uv.DEFAULT_UNWRAP,method:$('solver').value,padding:Number($('padding').value),autoCut:$('autocut').checked,rotate:$('rotate').checked,packing:$('packing')?.value??'auto',timeBudgetMs:Number($('budget')?.value??120)*1000}},{
      createWorker:()=>{const url=window.labWorkerURL();try{return new Worker(url);}finally{URL.revokeObjectURL(url);}},
      onProgress:p=>{if(token!==sequence)return;lastProgress=p;window.lab.progressEvents.push(p);$('status').textContent=describeUVProgress(p,performance.now()-start);}
    });
    clock=setInterval(()=>{if(token===sequence)$('status').textContent=describeUVProgress(lastProgress,performance.now()-start);},500);
    const result=await jobHandle.result;if(token!==sequence)return;
    snapshot=result;jobHandle=null;options.selected=snapshot.geometry.islands.map(i=>i.id);options.progress=0;options.focusFace=null;
    view.setOptions(options);view.setGeometry(snapshot.geometry,{resetCamera:framedMesh!==mesh});framedMesh=mesh;list();update();const m=snapshot.metrics;
    $('title').textContent=`${mesh.name} · ${mesh.faces.length.toLocaleString()} 三角面 · ${snapshot.packed.length} 岛`;
    $('status').textContent=(m?`生成 UV：翻面 / 退化 / 正面积重叠检查通过\n有效面积占用 ${(m.occupancy*100).toFixed(1)}% · 包围盒 ${(m.boxOccupancy*100).toFixed(1)}%\n${m.packingMethod} 排布 · 新增 ${snapshot.addedSeams.length} 条 UV 补切\n`:'原始 UV：未修复、未重新排布\n')+`Worker 完成 · ${(snapshot.timing.elapsedMs/1000).toFixed(2)} 秒\n`+snapshot.warnings.join('\n');
    window.lab.ready=true;
  }catch(e){if(token===sequence){fail(e.message);$('status').textContent='未生成结果，原网格未修改。';}}
  finally{clearInterval(clock);if(token===sequence){jobHandle=null;$('solve').disabled=false;$('cancel').disabled=true;}}
}
function load(demo){mesh=demo.mesh;seams=demo.edges;window.lab.ready=false;return solve();}
for(const stage of uv.HINGE_STAGES){const b=document.createElement('button');b.textContent=stage.label;b.dataset.stage=stage.t;b.onclick=()=>{pause();const schedule=uv.sampleUnfoldSchedule(options.progress,options.selected.length,options.order,options.handoff,$('reverse').checked),index=inspectionIndex??schedule.focusIndex;update({progress:uv.islandTimelineProgress(uv.hingePlaybackProgress(stage.t,options.holdNet),index,options.selected.length,options.order,options.handoff)},index);};$('stages').append(b);}
$('ribbon').onclick=()=>load(makeHingeDemo());$('cube').onclick=()=>load(makeUnfoldDemo());$('complex').onclick=()=>{const m=core.makeComplexExample($('example').value,'low');load({mesh:m,edges:extractSeamEdgesFromUV(m)});};
$('file').onchange=async e=>{try{const f=e.target.files?.[0];if(f){const m=core.parseOBJ(await f.text(),f.name);await load({mesh:m,edges:extractSeamEdgesFromUV(m)});}}catch(e){fail(e.message);}};
$('solve').onclick=solve;$('cancel').onclick=()=>{cancel();$('status').textContent='已取消本次求解。';};$('target').onchange=solve;
$('all').onclick=()=>{pause();options.selected=snapshot?.geometry.islands.map(i=>i.id)??[];list();update({progress:0});};$('none').onclick=()=>{pause();options.selected=[];list();update({progress:0});};
for(const [id,key]of [['wave','hingeWave'],['frame','autoFrame'],['hinges','showHinges'],['temporary','showTemporaryCuts'],['checker','checker']])$(id).onchange=()=>update({[key]:$(id).checked});
$('handoff').oninput=()=>{pause();update({handoff:Number($('handoff').value),progress:0});};$('hold-net').onchange=()=>{pause();update({holdNet:$('hold-net').checked,progress:0});};$('queue-prev').onclick=()=>seekQueue(-1);$('queue-next').onclick=()=>seekQueue(1);$('seconds').onchange=()=>update();$('reverse').onchange=()=>update();
$('order').onchange=()=>{pause();update({order:$('order').value,progress:0});};$('context').onchange=()=>update({context:$('context').value});$('fit-current').onclick=()=>view.fitCurrent();$('orbit').onclick=()=>view.fit('orbit');$('front').onclick=()=>view.fit('uv');
$('progress').oninput=()=>{pause();update({progress:Number($('progress').value)});};$('play').onclick=()=>{if(playing){pause();return;}if(!snapshot||!options.selected.length)return;playing=true;inspectionIndex=null;clockLast=null;const reverse=$('reverse').checked;if((!reverse&&options.progress===1)||(reverse&&options.progress===0))update({progress:reverse?1:0});$('play').textContent='暂停';};
// Visibility resets the timestamp so time spent in a hidden tab is not replayed.
let clockLast=null;document.addEventListener('visibilitychange',()=>{clockLast=null;});
function tick(now){
  if(playing&&!document.hidden){
    const elapsed=clockLast===null?0:Math.max(0,now-clockLast);
    const seconds=Math.max(.5,Math.min(60,Number($('seconds').value)||12));
    const duration=uv.unfoldDuration(seconds,options.selected.length,options.order,options.handoff);
    const next=uv.advanceUnfoldPlayback(options.progress,elapsed,duration,$('reverse').checked,$('loop').checked);
    if(next.finished)pause();update({progress:next.progress});
  }
  clockLast=playing&&!document.hidden?now:null;requestAnimationFrame(tick);
}requestAnimationFrame(tick);
$('uv').onclick=e=>{if(!snapshot)return;const r=$('uv').getBoundingClientRect(),hit=pickUVFace(snapshot,r.width,r.height,e.clientX-r.left,e.clientY-r.top,options.selected);if(hit)select(hit.id,hit.face,e.shiftKey||e.ctrlKey||e.metaKey);};
$('export').onclick=()=>{if(!snapshot)return;const text=core.meshToOBJ(uv.meshWithPreviewUV(mesh,snapshot.packed)),url=URL.createObjectURL(new Blob([text],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='meshtailor-target-uv.obj';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
new ResizeObserver(drawUV).observe($('uvhost'));
window.lab={ready:false,view,options,errors,update,select,load,solve,pause,uv,core,cancel,progressEvents:[],get snapshot(){return snapshot;},get mesh(){return mesh;},get playing(){return playing;}};
await load(makeHingeDemo());
