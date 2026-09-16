/** Real production GPU pixels, driven exclusively by animation progress. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
import {startChrome,delay} from './chrome-cdp.mjs';
const c=await compileCore();let browser;
const report={suite:'Timeline-sampled arrival presentation / production WebGL pixels',cases:[]};
const entry=`import{UnfoldWebGLView}from'/apps/studio/src/unfold/webgl-view.js';
import{cameraMatrix,projectPoint}from'/apps/studio/src/unfold/camera-math.js';
window.errors=[];window.view=new UnfoldWebGLView(document.querySelector('#view'),()=>{},e=>{if(e)errors.push(e)});
window.o={progress:.1,selected:[0,1,2],order:'relay',handoff:.85,path:'direct',separation:0,context:'solid',wireframe:false,checker:false,labels:true,overlapMode:'off',focusMode:'ghost',focusOpacity:.18,interactionActive:false,animationDurationSeconds:32.4};
const tri=[-1,-.8,0,1,-.8,0,0,1,0],source=new Float32Array([-3,0,3].flatMap(x=>tri.map((v,i)=>v+(i%3===0?x:i%3===2?.8:0))));
window.g={source,target:new Float32Array(source.map((v,i)=>i%3===2?0:v)),uv:new Float32Array(18),faceChart:new Int32Array([0,1,2]),boundaries:new Uint32Array([0,1,1,2,2,0,3,4,4,5,5,3,6,7,7,8,8,6]),islands:[0,1,2].map(id=>({id,faces:[id],sourceCenter:[(id-1)*3,0,.8],targetCenter:[(id-1)*3,0,0],direction:[0,0,1]})),atlas:{min:[0,0],max:[1,1],center:[.5,.5],scale:2.6},radius:6};
view.setGeometry(g);view.setOptions(o);view.fit('uv');
window.update=p=>{Object.assign(o,p);view.setOptions(o);view.draw()};
window.arrivals=()=>JSON.parse(view.canvas.dataset.arrivalPresentation);
window.pixel=()=>{view.draw();const gl=view.gl,p=projectPoint([-3,-.2,0],cameraMatrix(view.getCamera(),view.canvas.width/view.canvas.height),view.canvas.width,view.canvas.height),a=new Uint8Array(4);gl.readPixels(Math.round(p[0]),view.canvas.height-Math.round(p[1]),1,1,gl.RGBA,gl.UNSIGNED_BYTE,a);return[...a]};
window.at=age=>update({progress:1/2.7+age/o.animationDurationSeconds,interactionActive:true});
window.begin=()=>{update({order:'relay',animationDurationSeconds:32.4,arrivalHoldSeconds:.8,arrivalFadeSeconds:1,playbackReverse:false});at(0)};
window.ready=true;`;
try {
 const modules=await browserModuleSources(c.output);modules['/arrival-entry.js']=entry;browser=await startChrome();
 for(const dpr of [1,2]){
  const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1100,height:760,deviceScaleFactor:dpr,mobile:false});
  const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:'<body style="margin:0;background:#202124"><div id="view" style="position:absolute;inset:8px"></div></body>'});
  await page.evaluate(moduleBootstrap(modules));await page.evaluate("import(moduleURL('/arrival-entry.js'))");await page.waitFor('ready');
  const check=async(name,fn)=>{const details=await fn();report.cases.push({name:`DPR${dpr}: ${name}`,passed:true,details});console.log('PASS',name)};
  await check('Landed island stays opaque at exact UV target; successor moves',async()=>{const r=await page.evaluate('begin();window.holdPixel=pixel();({s:arrivals(),motion:JSON.parse(view.canvas.dataset.animating),pos:[...view.getPositions()].slice(0,9),target:[...g.target].slice(0,9)})');assert.equal(r.s[0].opacity,1);assert.equal(r.s[0].phase,'hold');assert.deepEqual(r.pos,r.target);assert.ok(r.motion.some(x=>x.id===1));return r});
  await check('Hold equals original opaque colour, not a flash',async()=>{const r=await page.evaluate('update({interactionActive:false});window.reference=pixel();begin();({reference,hold:pixel()})');assert.deepEqual(r.hold,r.reference)});
  await check('Stationary animation progress cannot consume hold/fade wall time',async()=>{const before=await page.evaluate('at(.4);({p:pixel(),a:arrivals()})');await delay(1050);const after=await page.evaluate('({p:pixel(),a:arrivals()})');assert.deepEqual(before,after)});
  await check('Early fade is continuous at .8 animation seconds',async()=>{const r=await page.evaluate('at(.801);({p:pixel(),a:arrivals()})');const held=await page.evaluate('holdPixel');assert.ok(r.p.slice(0,3).every((v,i)=>Math.abs(v-held[i])<=1));assert.ok(r.a[0].opacity<1)});
  await check('Middle fade GPU pixel differs from both endpoints',async()=>{const r=await page.evaluate('at(1.3);window.midPixel=pixel();window.midState=arrivals();at(1.81);window.ghostPixel=pixel();({held:holdPixel,mid:midPixel,ghost:ghostPixel,state:midState})');assert.ok(Math.abs(r.state[0].opacity-.59)<1e-10);assert.notDeepEqual(r.mid,r.held);assert.notDeepEqual(r.mid,r.ghost);return r});
  await check('Fade completion equals background pixels',async()=>{const r=await page.evaluate('window.faded=pixel();update({arrivalHoldSeconds:0,arrivalFadeSeconds:0});({faded,legacy:pixel(),states:arrivals()})');assert.deepEqual(r.faded,r.legacy);assert.deepEqual(r.states,[]);await page.evaluate('begin()')});
  await check('Scrubbing backwards restores identical colour and fade phase',async()=>{const r=await page.evaluate('at(1.3);window.forward=pixel();at(2.2);update({playbackReverse:true});at(1.3);({forward,back:pixel(),a:arrivals()})');assert.deepEqual(r.forward,r.back);assert.equal(r.a[0].phase,'fade')});
  await check('4x increments sample same track in one quarter of time',async()=>{const r=await page.evaluate('begin();window.samples=[1,4,16,64].map(rate=>{at((1.3/rate)*rate);return{rate,p:pixel(),a:arrivals()}});samples');for(const x of r){assert.deepEqual(x.p,r[0].p);assert.ok(Math.abs(x.a[0].ageSeconds-1.3)<1e-10)}});
  await check('Re-evaluating presentation does not change landed pose or camera',async()=>{const same=await page.evaluate('at(.3);window.before=JSON.stringify({p:[...view.getPositions()].slice(0,9),s:o.selected,c:view.getCamera()});at(1.3);before===JSON.stringify({p:[...view.getPositions()].slice(0,9),s:o.selected,c:view.getCamera()})');assert.equal(same,true)});
  await check('Labels use same continuous animation fade',async()=>{const r=await page.evaluate('at(1.3);view.draw();({opacity:document.querySelector("[aria-label=\\"Select island 1\\"]").style.opacity,phase:document.querySelector("[aria-label=\\"Select island 1\\"]").dataset.arrival})');assert.ok(Math.abs(+r.opacity-.61)<1e-10);assert.equal(r.phase,'fade')});
  await check('Sequential boundary never flashes all waiting islands solid',async()=>{const r=await page.evaluate('update({order:"sequential",progress:1/3,interactionActive:true});({a:arrivals(),solid:JSON.parse(view.canvas.dataset.opaqueIslands),state:view.canvas.dataset.playbackFocus})');assert.equal(r.a[0].id,0);assert.deepEqual(r.solid,[0]);assert.equal(r.state,'active');await page.evaluate('begin()')});
  await check('Pause and natural finish restore context immediately',async()=>{for(const p of [.45,1]){await page.evaluate(`update({progress:${p},interactionActive:false})`);assert.deepEqual(await page.evaluate('arrivals()'),[]);assert.equal(await page.evaluate('view.canvas.dataset.playbackFocus'),'restored')}});
  await check('Loop and re-seek are stateless, no stale wall-time events',async()=>{await page.evaluate('begin();at(1.3);update({progress:.02})');assert.deepEqual(await page.evaluate('arrivals()'),[]);await page.evaluate('at(1.3)');assert.equal((await page.evaluate('arrivals()'))[0].phase,'fade')});
  await check('No shader, Javascript or WebGL errors',async()=>{assert.deepEqual(await page.evaluate('errors'),[]);assert.equal(await page.evaluate('view.gl.getError()'),0)});
  await page.evaluate('view.dispose()');page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await c.cleanup()}
