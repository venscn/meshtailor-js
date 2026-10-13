/** Trusted CDP contacts and targeted release/cancel events on the production renderer. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
import {startChrome,delay} from './chrome-cdp.mjs';

const compiled=await compileCore();let browser;
const report={suite:'Production unfold renderer touch navigation',host:'Native WebGL2 with trusted CDP contacts and targeted DOM release/cancel events; not React Studio or physical hardware',cases:[]};
const check=async(name,fn)=>{await fn();report.cases.push({name,passed:true});console.log('PASS '+name);};
try{
 browser=await startChrome();const modules=await browserModuleSources(compiled.output);
 for(const dpr of [1,2]){
  const page=await browser.page();
  await page.send('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:dpr,mobile:false});
  await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
  const {frameTree}=await page.send('Page.getFrameTree');
  await page.send('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<!doctype html><style>body{margin:0}#view{position:relative;width:800px;height:600px;overflow:hidden}.unfold-labels{pointer-events:none}</style><div id="view"></div><script>${moduleBootstrap(modules)}</script><script type="module">
   const core=await import(moduleURL('/packages/mesh-core/src/index.js'));
   const uv=await import(moduleURL('/packages/uv/src/index.js'));
   const {UnfoldWebGLView}=await import(moduleURL('/apps/studio/src/unfold/webgl-view.js'));
   window.cameraMath=await import(moduleURL('/apps/studio/src/unfold/camera-math.js'));
   window.errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
   const mesh=core.geometryOnlyMesh(core.makeCube()),result=uv.unwrapMesh(mesh,new Set(),uv.geometryGenerationOptions(mesh));
   window.geometry=uv.buildUnfoldGeometry(mesh,result.packed,new Set(result.seams));window.geometryBefore=JSON.stringify(geometry);
   window.picks=[];window.manual=0;window.touchIDs=[];window.touchTrace=[];
   window.view=new UnfoldWebGLView(document.querySelector('#view'),(id,face,additive)=>picks.push({id,face,additive}),error=>{if(error)errors.push(error)},()=>manual++);
   window.options={progress:1,selected:geometry.islands.map(i=>i.id),order:'sequential',path:'hinge',separation:uv.DEFAULT_SEPARATION,context:'solid',wireframe:false,checker:false,labels:false,xray:false,focusFace:null,autoFrame:false};
   view.setGeometry(geometry);view.setOptions(options);view.fit('uv');
   view.canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchIDs.push(e.pointerId)});
   for(const type of ['pointerdown','pointermove','pointerup','pointercancel','gotpointercapture','lostpointercapture'])view.canvas.addEventListener(type,e=>touchTrace.push({type,id:e.pointerId,x:e.clientX,y:e.clientY}));
   window.positionsBefore=[...view.getPositions()];window.ready=true;
  </script>`});
  try{await page.waitFor('window.ready&&view.canvas.dataset.glError==="0"',20000);}catch(error){console.error(await page.evaluate('({ready:window.ready,errors:window.errors,draws:window.view?.canvas.dataset.draws})'));throw error;}
  const camera=()=>page.evaluate('view.getCamera()');
  const count=()=>page.evaluate('picks.length');
  const finite=c=>{assert.ok([c.yaw,c.pitch,c.distance,...c.target].every(Number.isFinite));assert.ok(c.distance>=.2&&c.distance<=200);};
  const touch=async(type,points=[])=>{await page.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:1,radiusY:1,force:1}))});await delay(15);};
  const pair=()=>[{id:1,x:300,y:250},{id:2,x:500,y:250}];
  const start=async(points)=>{await touch('touchStart',[points[0]]);if(points.length>1)await touch('touchStart',points);};
  const reset=()=>page.evaluate('view.setOptions(options);view.fit("uv")');
  const prefix=`DPR ${dpr}: `;
  await check(prefix+'two captured fingers pan in screen direction without rotating or picking',async()=>{
   await reset();const before=await camera(),picked=await count(),points=pair();await start(points);
   assert.equal(await page.evaluate('touchIDs.slice(-2).every(id=>view.canvas.hasPointerCapture(id))'),true);
   await touch('touchMove',points.map(p=>({...p,x:p.x+25,y:p.y+20})));const after=await camera();
   assert.equal(after.yaw,before.yaw);assert.equal(after.pitch,before.pitch);assert.ok(Math.abs(after.distance-before.distance)<1e-10);
   const basis=await page.evaluate('cameraMath.cameraBasis(view.getCamera())'),delta=after.target.map((v,i)=>v-before.target[i]);
   assert.ok(delta.reduce((s,v,i)=>s+v*basis.right[i],0)<0);assert.ok(delta.reduce((s,v,i)=>s+v*basis.up[i],0)>0);
   await touch('touchEnd');assert.equal(await count(),picked);finite(after);
  });
  await check(prefix+'spreading zooms in, closing zooms out, and distance stays bounded',async()=>{
   await reset();let points=pair();await start(points);const before=await camera();
   points=[{id:1,x:250,y:250},{id:2,x:550,y:250}];await touch('touchMove',points);const spread=await camera();assert.ok(spread.distance<before.distance);
   points=[{id:1,x:350,y:250},{id:2,x:450,y:250}];await touch('touchMove',points);assert.ok((await camera()).distance>spread.distance);await touch('touchEnd');
   for(const [from,to]of [[[{id:1,x:399,y:250},{id:2,x:401,y:250}],[{id:1,x:100,y:250},{id:2,x:700,y:250}]],[[{id:1,x:100,y:250},{id:2,x:700,y:250}],[{id:1,x:399,y:250},{id:2,x:401,y:250}]]]){
    await reset();await start(from);await touch('touchMove',to);finite(await camera());await touch('touchEnd');
   }
  });
  await check(prefix+'individual release/cancellation resumes rotation without a jump or face pick',async()=>{
   for(const type of ['pointerup','pointercancel']){
    await reset();const picked=await count(),points=pair();await start(points);const before=await camera();
    // CDP touchEnd/cancel terminate every contact; target one DOM event while
    // retaining real browser capture and trusted moves for the remaining finger.
    await page.evaluate(`view.canvas.dispatchEvent(new PointerEvent('${type}',{pointerId:touchIDs.at(-2),pointerType:'touch',clientX:300,clientY:250,bubbles:true}))`);assert.deepEqual(await camera(),before);
    await touch('touchMove',[{...points[1],x:points[1].x+30,y:points[1].y+12}]);assert.notEqual((await camera()).yaw,before.yaw);
    await touch('touchEnd');assert.equal(await count(),picked);
   }
  });
  await check(prefix+'device cancellation clears capture and fresh touch navigation remains usable',async()=>{
   const picked=await count(),points=pair();await start(points);await touch('touchMove',points.map(p=>({...p,y:p.y+15})));await touch('touchCancel');
   assert.equal(await page.evaluate('touchIDs.slice(-2).every(id=>!view.canvas.hasPointerCapture(id))'),true);assert.equal(await count(),picked);
   const before=await camera();await start([points[0]]);await touch('touchMove',[{...points[0],x:points[0].x+35}]);await touch('touchEnd');assert.notEqual((await camera()).yaw,before.yaw);assert.equal(await count(),picked);
  });
  await check(prefix+'losing one capture preserves the companion and keeps navigation out of selection',async()=>{
   await reset();const picked=await count(),points=pair();await start(points);
   // Activate the pending captures before releasing one; an override removed
   // before gotpointercapture legitimately emits no lostpointercapture event.
   for(const p of points)p.y+=8;await touch('touchMove',points);
   assert.equal(await page.evaluate('touchIDs.slice(-2).every(id=>touchTrace.some(e=>e.type==="gotpointercapture"&&e.id===id))'),true);
   await page.evaluate('view.canvas.releasePointerCapture(touchIDs.at(-2))');
   // Pending capture loss is delivered before the released pointer's next event.
   await touch('touchMove',[{...points[0],x:points[0].x+20},{...points[1],x:points[1].x+12}]);
   assert.equal(await page.evaluate('touchTrace.some(e=>e.type==="lostpointercapture"&&e.id===touchIDs.at(-2))'),true);
   assert.equal(await page.evaluate('view.canvas.hasPointerCapture(touchIDs.at(-1))'),true);
   const before=await camera();await touch('touchMove',[{...points[0],x:points[0].x+20},{...points[1],x:points[1].x+35}]);assert.notEqual((await camera()).yaw,before.yaw);
   await touch('touchEnd');assert.equal(await count(),picked);
  });
  await check(prefix+'coincident fingers and a temporarily zero-size host keep a finite camera',async()=>{
   await reset();const points=[{id:1,x:400,y:250},{id:2,x:400,y:250}];await start(points);await touch('touchMove',points.map(p=>({...p,x:p.x+20})));finite(await camera());await touch('touchEnd');
   const ordinary=pair();await start(ordinary);const before=await camera();
   await page.evaluate('document.querySelector("#view").style.cssText="position:relative;width:0;height:0"');
   const moved=ordinary.map(p=>({...p,x:p.x+30,y:p.y+20}));await touch('touchMove',moved);assert.deepEqual(await camera(),before);
   await page.evaluate('document.querySelector("#view").style.cssText="position:relative;width:800px;height:600px"');await touch('touchMove',moved);assert.deepEqual(await camera(),before);
   await touch('touchMove',moved.map(p=>({...p,x:p.x+10})));finite(await camera());await touch('touchEnd');
  });
  await check(prefix+'touch interrupts follow once and stale props cannot snap the camera back',async()=>{
   await page.evaluate('view.setOptions({...options,autoFrame:true});manual=0');const points=pair();await start(points);await touch('touchMove',points.map(p=>({...p,x:p.x+20})));await touch('touchEnd');
   const after=await camera();assert.equal(await page.evaluate('manual'),1);await page.evaluate('view.setOptions({...options,autoFrame:true})');assert.deepEqual(await camera(),after);assert.equal(await page.evaluate('view.canvas.dataset.cameraMode'),'manual');
   await page.evaluate('view.setOptions(options)');
  });
  await check(prefix+'mouse orbit, right-button pan and wheel keep their existing camera behavior',async()=>{
   await reset();await page.send('Emulation.setTouchEmulationEnabled',{enabled:false});const picked=await count();
   const drag=async button=>{const buttons=button==='right'?2:1;await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:400,y:250,button,buttons,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:435,y:265,button,buttons});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:435,y:265,button,buttons:0,clickCount:1});};
   const before=await camera();await drag('left');const orbit=await camera();assert.notEqual(orbit.yaw,before.yaw);assert.deepEqual(orbit.target,before.target);assert.equal(orbit.distance,before.distance);
   await drag('right');const pan=await camera();assert.notDeepEqual(pan.target,orbit.target);assert.equal(pan.yaw,orbit.yaw);assert.equal(pan.pitch,orbit.pitch);assert.equal(pan.distance,orbit.distance);
   await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:400,y:250,deltaX:0,deltaY:-80});await delay(30);assert.ok((await camera()).distance<pan.distance);assert.equal(await count(),picked);
   await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:3});
  });
  await check(prefix+'a new single-finger tap still picks the current triangle after cancelled multi-touch',async()=>{
   await reset();const point=await page.evaluate(`(()=>{const r=view.canvas.getBoundingClientRect(),m=cameraMath.cameraMatrix(view.getCamera(),r.width/r.height),pos=view.getPositions();for(let fi=0;fi<geometry.faceChart.length;fi++){const p=[0,1,2].map(a=>(pos[fi*9+a]+pos[fi*9+3+a]+pos[fi*9+6+a])/3),q=cameraMath.projectPoint(p,m,r.width,r.height);if(q&&q[0]>0&&q[0]<r.width&&q[1]>0&&q[1]<r.height&&cameraMath.pickFace(pos,view.getCamera(),r.width/r.height,q[0]/r.width*2-1,1-q[1]/r.height*2)===fi)return {id:1,x:r.left+q[0],y:r.top+q[1],fi};}throw Error('No visible triangle');})()`);
   const before=await camera(),picked=await count();await start([{id:1,x:point.x,y:point.y}]);await touch('touchEnd');
   assert.equal(await count(),picked+1);assert.equal(await page.evaluate('picks.at(-1).face'),point.fi);assert.deepEqual(await camera(),before);
   assert.equal(await page.evaluate('JSON.stringify(geometry)===geometryBefore'),true);assert.deepEqual(await page.evaluate('[...view.getPositions()]'),await page.evaluate('positionsBefore'));assert.deepEqual(await page.evaluate('errors'),[]);assert.equal(await page.evaluate('view.canvas.dataset.glError'),'0');
  });
  await page.evaluate('view.dispose()');page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.passed+' touch navigation browser cases');
}finally{if(browser)await browser.close();await compiled.cleanup();}
