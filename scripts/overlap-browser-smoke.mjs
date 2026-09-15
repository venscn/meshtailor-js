/** Pixel tests against the production WebGL2 renderer, NOT a screenshot-only assertion. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
import {startChrome,delay} from './chrome-cdp.mjs';
const c=await compileCore(),report={suite:'Production overlap GPU / exact pixel-layer counts',host:'Native renderer test host, not React Studio',softwareWebGL:process.env.CHROME_SOFTWARE_WEBGL==='1',cases:[]};
let browser;
const entry=`
import {UnfoldWebGLView} from '/apps/studio/src/unfold/webgl-view.js';
import * as uv from '/packages/uv/src/index.js';
window.errors=[];window.picks=[];window.coreUV=uv;
window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.view=new UnfoldWebGLView(document.querySelector('#view'),(...p)=>picks.push(p),e=>{if(e)errors.push(e)});
window.options={progress:0,selected:[0],order:'sequential',path:'direct',separation:0,context:'hidden',wireframe:false,checker:false,labels:false,xray:false,focusFace:null,faceTones:false,overlapMode:'coplanar'};
window.tri=[-1,-.8,0,1,-.8,0,0,1,0];
window.shift=(t,x=0,y=0,z=0)=>t.map((v,i)=>v+[x,y,z][i%3]);
window.useTriangles=(triangles,ids=triangles.map(()=>0))=>{
 const source=new Float32Array(triangles.flat()),unique=[...new Set(ids)];
 window.geometry={source,target:source.slice(),uv:new Float32Array(ids.length*6),faceChart:Int32Array.from(ids),boundaries:new Uint32Array(),
 islands:unique.map(id=>({id,faces:ids.flatMap((v,i)=>v===id?[i]:[]),sourceCenter:[0,0,0],targetCenter:[0,0,0],direction:[0,0,1]})),atlas:{min:[0,0],max:[1,1],center:[.5,.5],scale:2.6},radius:2};
 options.selected=unique;options.progress=0;options.overlapMode='coplanar';options.focusFace=null;options.context='hidden';
 view.setGeometry(geometry);view.setOptions(options);view.fit('uv');view.draw();return summary();
};
window.update=(patch)=>{Object.assign(options,patch);view.setOptions(options);view.draw();return summary();};
window.summary=()=>{
 const {counts,width,height}=view.getOverlapCounts();let one=0,two=0,three=0,max=0;
 for(const n of counts){if(n===1)one++;if(n===2)two++;if(n>=3)three++;if(n>max)max=n;}
 return {one,two,three,max,width,height,error:view.gl.getError(),state:view.getOverlapState()};
};
window.colors=()=>{view.draw();const g=view.gl,a=new Uint8Array(view.canvas.width*view.canvas.height*4);g.readPixels(0,0,view.canvas.width,view.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);let amber=0,pink=0;for(let i=0;i<a.length;i+=4){if(a[i]>140&&a[i+1]>60&&a[i+1]<180&&a[i+2]<95)amber++;if(a[i]>150&&a[i+2]>90&&a[i+1]<125)pink++;}return {amber,pink,error:g.getError()};};
useTriangles([tri]);window.ready=true;
`;
const check=async(name,fn)=>{const details=await fn();console.log('PASS',name);report.cases.push({name,passed:true,details});};
try{
 const modules=await browserModuleSources(c.output);modules['/overlap-entry.js']=entry;browser=await startChrome();
 for(const dpr of [1,2]){
  const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1100,height:780,deviceScaleFactor:dpr,mobile:false});
  const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:`<html><head><style>body{margin:0;background:#1b1d1f;color:#ddd;font:13px sans-serif}h1{font-size:16px;margin:16px}#view{position:absolute;inset:65px 20px 35px;overflow:hidden}.overlap-legend{position:absolute;bottom:0;left:10px;padding:8px;background:#222c;pointer-events:none}.unfold-labels{position:absolute;inset:0;pointer-events:none}</style></head><body><h1>Production GPU overlap test · synthetic triangles · NOT a real asset</h1><div id=view></div></body></html>`});
  await page.evaluate(moduleBootstrap(modules));await page.evaluate("import(moduleURL('/overlap-entry.js'))");await page.waitFor('ready');
  const prefix=`DPR ${dpr}: `;
  await check(prefix+'GPU shaders and framebuffer complete; one face is one layer',async()=>{const r=await page.evaluate('summary()');assert.equal(r.error,0);assert.equal(r.state.error,null);assert.equal(r.max,1);assert.ok(r.one>10000);return r;});
  await check(prefix+'shared triangle edge is not double counted',async()=>{const r=await page.evaluate('useTriangles([[-1,-1,0,1,-1,0,1,1,0],[-1,-1,0,1,1,0,-1,1,0]])');assert.equal(r.max,1);assert.equal(r.two,0);return r;});
  await check(prefix+'identical same-island triangles give two layers across the full footprint',async()=>{const r=await page.evaluate('useTriangles([tri,tri])');assert.equal(r.max,2);assert.ok(r.two>10000);assert.equal(r.one,0);return r;});
  await check(prefix+'partial overlap marks only intersection, not entire faces',async()=>{const r=await page.evaluate('useTriangles([tri,shift(tri,.6,.2)])');assert.equal(r.max,2);assert.ok(r.one>10000&&r.two>1000);return r;});
  await check(prefix+'three identical faces give three layers and visible magenta hatch',async()=>{const r=await page.evaluate('useTriangles([tri,tri,tri])');assert.equal(r.max,3);assert.ok(r.three>10000);const color=await page.evaluate('colors()');assert.ok(color.pink>1000,JSON.stringify(color));assert.equal(color.error,0);return {r,color};});
  await check(prefix+'opposite winding still reveals two layers',async()=>{const r=await page.evaluate('useTriangles([tri,[...tri.slice(0,3),...tri.slice(6,9),...tri.slice(3,6)]])');assert.equal(r.max,2);assert.ok(r.two>10000);return r;});
  await check(prefix+'different islands at same coordinates are not reported as intra-island overlap',async()=>{const r=await page.evaluate('useTriangles([tri,tri],[0,1])');assert.equal(r.max,1);return r;});
  await check(prefix+'ordinary front/back occlusion is excluded by near-plane mode',async()=>{const r=await page.evaluate('useTriangles([tri,shift(tri,0,0,.4)])');assert.equal(r.max,1);return r;});
  await check(prefix+'projected mode deliberately includes occlusion and says so',async()=>{const r=await page.evaluate('update({overlapMode:"projected"})');assert.equal(r.max,2);assert.match(await page.evaluate('view.canvas.parentElement.querySelector(".overlap-legend").textContent'),/非几何相交/);return r;});
  await check(prefix+'crossing nonparallel faces are not flagged as coplanar',async()=>{const r=await page.evaluate('useTriangles([tri,[-1,-.8,-.4,1,-.8,.4,0,1,0]])');assert.equal(r.max,1);return r;});
  await check(prefix+'near-coincident faces inside the configured tolerance are counted',async()=>{const r=await page.evaluate('useTriangles([tri,shift(tri,0,0,.00005)])');assert.equal(r.max,2);assert.ok(r.two>10000);return r;});
  await check(prefix+'parallel faces outside the tolerance are not counted',async()=>{const r=await page.evaluate('useTriangles([tri,shift(tri,0,0,.01)])');assert.equal(r.max,1);return r;});
  await check(prefix+'oblique manual camera preserves near-plane classification',async()=>{await page.evaluate('useTriangles([tri,shift(tri,.2,0)]);view.camera.yaw=.7;view.camera.pitch=.45;view.draw()');const r=await page.evaluate('summary()');assert.equal(r.max,2);assert.ok(r.two>1000);return r;});
  await check(prefix+'turning diagnostics off releases targets and preserves all source/target positions and camera',async()=>{await page.evaluate('window.before={positions:[...view.getPositions()],camera:view.getCamera(),source:[...geometry.source],target:[...geometry.target]};update({overlapMode:"off"})');assert.ok(await page.evaluate('JSON.stringify(before)===JSON.stringify({positions:[...view.getPositions()],camera:view.getCamera(),source:[...geometry.source],target:[...geometry.target]})'));const r=await page.evaluate('summary()');assert.equal(r.width,0);assert.equal(r.height,0);return r;});
  await check(prefix+'re-enable recreates the buffers, without moving or repacking anything',async()=>{const r=await page.evaluate('update({overlapMode:"coplanar",faceTones:true,wireframe:true})');assert.equal(r.max,2);assert.equal(r.error,0);return r;});
  await check(prefix+'solid unselected foreground occludes diagnostics; hidden foreground does not',async()=>{
   await page.evaluate('useTriangles([tri,tri,shift(tri,0,0,.2)],[0,0,1])');const r=await page.evaluate('update({selected:[0],context:"solid"})');assert.equal(r.max,0);
   const hidden=await page.evaluate('update({context:"hidden"})');assert.equal(hidden.max,2);return {solid:r,hidden};
  });
  await check(prefix+'pose updates use current positions, no stale overlap from previous frame',async()=>{
   await page.evaluate('useTriangles([tri,tri]);geometry.target.set(shift(tri,2.2,0),9)');let a=await page.evaluate('update({progress:0})');assert.equal(a.max,2);
   a=await page.evaluate('update({progress:1})');assert.ok(a.max<=1);a=await page.evaluate('update({progress:0})');assert.equal(a.max,2);return a;
  });
  await check(prefix+'framebuffer and depth state restored after diagnostic composition',async()=>{assert.ok(await page.evaluate('view.gl.getParameter(view.gl.FRAMEBUFFER_BINDING)===null'));assert.equal(await page.evaluate('view.gl.getError()'),0);});
  if(dpr===1){
   await page.evaluate('useTriangles([tri,shift(tri,.55,.1),shift(tri,.2,.35)]);update({wireframe:true,faceTones:true})');await delay(80);
   const i=process.argv.indexOf('--screenshot');if(i>=0)await writeFile(process.argv[i+1],Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await check(prefix+'diagnostic allocation/render failure never disables the mesh viewport',async()=>{
   await page.evaluate('window.keptPositions=[...view.getPositions()];view.overlapPass.render=()=>{throw Error("simulated diagnostic failure")};update({overlapMode:"coplanar"})');
   assert.match(await page.evaluate('view.getOverlapState().error'),/simulated/);assert.ok(await page.evaluate('keptPositions.every((v,i)=>v===view.getPositions()[i])'));
   assert.equal(await page.evaluate('view.canvas.dataset.overlapMode'),'unavailable');assert.equal(await page.evaluate('view.gl.getError()'),0);
  });
  await check(prefix+'off and on explicitly retries diagnostic failure',async()=>{await page.evaluate('update({overlapMode:"off"})');const r=await page.evaluate('update({overlapMode:"coplanar"})');assert.equal(r.state.error,null);assert.ok(r.max>=2);return r;});
  await check(prefix+'no uncaught errors or silently failed diagnostics',async()=>{assert.deepEqual(await page.evaluate('errors'),[]);assert.equal(await page.evaluate('view.getOverlapState().error'),null);});
  await page.evaluate('view.dispose()');page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS',report.passed,'cases');
}finally{await browser?.close();await c.cleanup();}
