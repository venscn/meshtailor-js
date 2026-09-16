import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
import {startChrome,delay} from './chrome-cdp.mjs';
const c=await compileCore();let browser;
const report={suite:'UV arrival hold + continuous fade: production WebGL pixels',cases:[]};
const entry=`import{UnfoldWebGLView}from'/apps/studio/src/unfold/webgl-view.js';
import{cameraMatrix,projectPoint}from'/apps/studio/src/unfold/camera-math.js';
window.errors=[];window.view=new UnfoldWebGLView(document.querySelector('#view'),()=>{},e=>{if(e)errors.push(e)});
window.now=0;view.presentationNow=()=>now;
window.o={progress:.1,selected:[0,1,2],order:'relay',handoff:.85,path:'direct',separation:0,context:'solid',wireframe:false,checker:false,labels:true,overlapMode:'off',focusMode:'ghost',focusOpacity:.18,interactionActive:false};
const tri=[-1,-.8,0,1,-.8,0,0,1,0],source=new Float32Array([-3,0,3].flatMap(x=>tri.map((v,i)=>v+(i%3===0?x:i%3===2?.8:0))));
window.g={source,target:new Float32Array(source.map((v,i)=>i%3===2?0:v)),uv:new Float32Array(18),faceChart:new Int32Array([0,1,2]),boundaries:new Uint32Array([0,1,1,2,2,0,3,4,4,5,5,3,6,7,7,8,8,6]),islands:[0,1,2].map(id=>({id,faces:[id],sourceCenter:[(id-1)*3,0,.8],targetCenter:[(id-1)*3,0,0],direction:[0,0,1]})),atlas:{min:[0,0],max:[1,1],center:[.5,.5],scale:2.6},radius:6};
view.setGeometry(g);view.setOptions(o);view.fit('uv');
window.update=(p,t)=>{if(t!==undefined)now=t;Object.assign(o,p);view.setOptions(o);view.draw()};
window.arrivals=()=>JSON.parse(view.canvas.dataset.arrivalPresentation);
window.pixel=()=>{view.draw();const gl=view.gl,p=projectPoint([-3,-.2,0],cameraMatrix(view.getCamera(),view.canvas.width/view.canvas.height),view.canvas.width,view.canvas.height),a=new Uint8Array(4);gl.readPixels(Math.round(p[0]),view.canvas.height-Math.round(p[1]),1,1,gl.RGBA,gl.UNSIGNED_BYTE,a);return[...a]};
window.begin=()=>{update({progress:.3,interactionActive:false},0);update({interactionActive:true});update({progress:1.00001/2.7},100)};
window.ready=true;`;
try {
 const modules=await browserModuleSources(c.output);modules['/arrival-entry.js']=entry;browser=await startChrome();
 for(const dpr of [1,2]){
  const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1100,height:760,deviceScaleFactor:dpr,mobile:false});
  const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:'<body style="margin:0;background:#202124"><div id="view" style="position:absolute;inset:8px"></div></body>'});
  await page.evaluate(moduleBootstrap(modules));await page.evaluate("import(moduleURL('/arrival-entry.js'))");await page.waitFor('ready');
  const check=async(name,fn)=>{const details=await fn();report.cases.push({name:`DPR${dpr}: ${name}`,passed:true,details});console.log('PASS',name)};
  await check('Landing stays opaque and at target while successor keeps moving',async()=>{const r=await page.evaluate('begin();window.holdPixel=pixel();({s:arrivals(),motion:JSON.parse(view.canvas.dataset.animating),pos:[...view.getPositions()].slice(0,9),target:[...g.target].slice(0,9)})');assert.equal(r.s[0].opacity,1);assert.equal(r.s[0].phase,'hold');assert.deepEqual(r.pos,r.target);assert.ok(r.motion.some(x=>x.id===1));return r});
  await check('Hold has exactly the opaque reference colour, not an arbitrary flash',async()=>{const r=await page.evaluate('update({interactionActive:false});window.reference=pixel();begin();({reference,hold:pixel()})');assert.deepEqual(r.hold,r.reference);return r});
  await check('Hold lasts .8 wall seconds with no progress changes',async()=>{const r=await page.evaluate('now=899;({p:pixel(),a:arrivals()})');assert.equal(r.a[0].opacity,1);assert.deepEqual(r.p,await page.evaluate('holdPixel'));});
  await check('Early fade has no abrupt material recolour',async()=>{const r=await page.evaluate('now=901;({p:pixel(),a:arrivals()})');const held=await page.evaluate('holdPixel');assert.ok(r.p.slice(0,3).every((v,i)=>Math.abs(v-held[i])<=1));assert.ok(r.a[0].opacity<1);});
  await check('True mid-fade GPU pixel differs from both endpoints',async()=>{const r=await page.evaluate('now=1400;window.midPixel=pixel();window.midState=arrivals();now=1901;window.ghostPixel=pixel();({held:holdPixel,mid:midPixel,ghost:ghostPixel,state:midState})');assert.ok(Math.abs(r.state[0].opacity-.59)<1e-12);assert.notDeepEqual(r.mid,r.held);assert.notDeepEqual(r.mid,r.ghost);return r});
  await check('Fade reaches identical legacy background pixels',async()=>{const r=await page.evaluate('window.faded=pixel();update({arrivalHoldSeconds:0,arrivalFadeSeconds:0});({faded,legacy:pixel(),states:arrivals()})');assert.deepEqual(r.faded,r.legacy);assert.deepEqual(r.states,[]);await page.evaluate('update({arrivalHoldSeconds:.8,arrivalFadeSeconds:1})');});
  await check('Fade changes no pose, selection, camera or timing',async()=>{const same=await page.evaluate('begin();window.before=JSON.stringify({p:[...view.getPositions()],s:o.selected,c:view.getCamera(),t:o.progress});now=1400;view.draw();before===JSON.stringify({p:[...view.getPositions()],s:o.selected,c:view.getCamera(),t:o.progress})');assert.equal(same,true)});
  await check('Labels ease with surface instead of snapping',async()=>{const r=await page.evaluate('begin();now=1400;view.draw();({opacity:document.querySelector("[aria-label=\\"Select island 1\\"]").style.opacity,phase:document.querySelector("[aria-label=\\"Select island 1\\"]").dataset.arrival})');assert.ok(Math.abs(+r.opacity-.61)<1e-12);assert.equal(r.phase,'fade')});
  await check('Strict sequential boundary never flashes all waiting islands solid',async()=>{const r=await page.evaluate('update({order:"sequential",progress:.32,interactionActive:false},0);update({interactionActive:true});update({progress:1/3},100);({a:arrivals(),solid:JSON.parse(view.canvas.dataset.opaqueIslands),state:view.canvas.dataset.playbackFocus})');assert.equal(r.a[0].id,0);assert.deepEqual(r.solid,[0]);assert.equal(r.state,'active');await page.evaluate('update({order:"relay"})')});
  await check('Pause restores the previous display immediately and cancels all tails',async()=>{await page.evaluate('begin();update({interactionActive:false},200)');assert.deepEqual(await page.evaluate('arrivals()'),[]);assert.equal(await page.evaluate('view.canvas.dataset.playbackFocus'),'restored')});
  await check('Reverse and loop wrap clear the previous forward arrival',async()=>{await page.evaluate('begin();update({playbackReverse:true},200)');assert.deepEqual(await page.evaluate('arrivals()'),[]);await page.evaluate('update({playbackReverse:false});begin();update({progress:.02},200)');assert.deepEqual(await page.evaluate('arrivals()'),[])});
  await check('Natural completion restores rather than adding a full-queue delay',async()=>{await page.evaluate('begin();update({progress:1,interactionActive:false},200)');assert.deepEqual(await page.evaluate('arrivals()'),[]);assert.equal(await page.evaluate('view.canvas.dataset.playbackFocus'),'restored')});
  await check('Geometry replacement clears old timers and stale IDs',async()=>{await page.evaluate('begin();view.setGeometry(g,{resetCamera:false})');assert.deepEqual(await page.evaluate('arrivals()'),[])});
  await check('Several fast arrivals have independent opacity without a two-tail cap',async()=>{const r=await page.evaluate('begin();update({progress:1.85001/2.7},1100);arrivals()');assert.equal(r.length,2);assert.ok(r[0].opacity<1);assert.equal(r[1].opacity,1)});
  await check('No shader, Javascript or WebGL errors',async()=>{assert.deepEqual(await page.evaluate('errors'),[]);assert.equal(await page.evaluate('view.gl.getError()'),0)});
  await page.evaluate('view.dispose()');page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await c.cleanup()}
