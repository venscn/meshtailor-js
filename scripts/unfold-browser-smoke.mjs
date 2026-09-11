/** Runs the ACTUAL native renderer, UV drawing, picking and UV worker in Chromium.
 * This is NOT the full React/Vite Studio test; use test:browser for that separate check.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { compileCore } from './lib/compiled-core.mjs';
import { browserModuleSources,moduleBootstrap } from './lib/browser-modules.mjs';
import { startChrome, delay } from './chrome-cdp.mjs';
const compiled=await compileCore(),report={suite:'Native unfold WebGL2 + shared UV canvas + real worker (not full React Studio)',softwareWebGL:process.env.CHROME_SOFTWARE_WEBGL==='1',cases:[],skipped:[]};
const html=`<!doctype html><html><head><meta charset="utf-8"><title>MeshTailor-JS · Unfold renderer regression harness</title><link rel="stylesheet" href="/studio.css"><style>
body{min-width:0;height:100vh;overflow:hidden;background:#090d14}header{height:64px;padding:16px 24px;color:#c9daef}header small{color:#7593ad;margin-left:18px}.native-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;height:calc(100vh - 104px);padding:0 16px}.native-panel{display:grid;grid-template-rows:36px minmax(0,1fr);border:1px solid #2b3f53;border-radius:12px;overflow:hidden}.native-panel h3{font-size:12px;font-weight:500;margin:0;padding:10px 14px;background:#101c28;color:#c0d8ed}#view,#uvhost{position:relative;min-width:0;min-height:0;overflow:hidden}#uv{position:absolute;width:100%;height:100%;inset:0}.harness-note{padding:10px 20px;font-size:10px;color:#708ca5}
</style></head><body><header>MeshTailor-JS · 3D ↔ UV <small>Native renderer regression harness · same geometry / UV corner mapping</small></header><main class="native-grid"><section class="native-panel"><h3 id="caption">3D cut mesh</h3><div id="view"></div></section><section class="native-panel"><h3>Shared target atlas</h3><div id="uvhost"><canvas id="uv"></canvas></div></section></main><div class="harness-note">A renderer/worker test host, not the React Studio page. UV generation remains a planar debug preview.</div><script type="module">
import * as core from '/packages/mesh-core/src/index.js';
import * as uv from '/packages/uv/src/index.js';
import { UnfoldWebGLView } from '/apps/studio/src/unfold/webgl-view.js';
import { cameraMatrix,projectPoint } from '/apps/studio/src/unfold/camera-math.js';
import { drawUVSnapshot,pickUVFace,uvScreenFrame } from '/apps/studio/src/unfold/uv-drawing.js';
import { extractSeamEdgesFromUV } from '/packages/chaining-seams/src/index.js';
window.errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
window.core=core;window.uvModule=uv;window.pickUVFace=pickUVFace;window.uvScreenFrame=uvScreenFrame;window.projectPoint=projectPoint;window.cameraMatrix=cameraMatrix;
window.mesh=core.parseOBJ(await(await fetch('/cube.obj')).text(),'UV cube');
window.seams=extractSeamEdgesFromUV(mesh);const packed=uv.planarPackPreview(mesh,uv.buildCharts(mesh,seams));
window.snapshot={packed,geometry:uv.buildUnfoldGeometry(mesh,packed,seams),target:'generated',seams:[...seams],warnings:[]};
window.options={progress:0,selected:snapshot.geometry.islands.map(i=>i.id),order:'together',path:'staged',separation:.45,context:'dim',wireframe:true,checker:false,labels:true,xray:false,focusFace:null};
window.picks=[];window.rendererErrors=[];window.view=new UnfoldWebGLView(document.querySelector('#view'),(...args)=>picks.push(args),error=>{if(error)rendererErrors.push(error);});
view.setGeometry(snapshot.geometry);
window.drawUV=()=>{const el=document.querySelector('#uvhost'),c=document.querySelector('#uv'),dpr=Math.min(devicePixelRatio,2);c.width=Math.round(el.clientWidth*dpr);c.height=Math.round(el.clientHeight*dpr);const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);drawUVSnapshot(ctx,snapshot,el.clientWidth,el.clientHeight,{selected:options.selected,focusFace:options.focusFace,checker:options.checker,wireframe:options.wireframe});};
window.update=(patch)=>{Object.assign(options,patch);view.setOptions(options);drawUV();document.querySelector('#caption').textContent='3D → UV · '+Math.round(options.progress*100)+'% · '+options.order;};
window.pixels=()=>{view.draw();const gl=view.gl,w=view.canvas.width,h=view.canvas.height,bytes=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let colored=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]>45||bytes[i+1]>45||bytes[i+2]>45)colored++;return {colored,error:gl.getError()};};
window.workerPreview=(target='generated')=>new Promise((resolve,reject)=>{const w=new Worker('/apps/studio/src/workers/uv.worker.js',{type:'module'});w.onmessage=e=>{w.terminate();if(e.data.ok)resolve(e.data.snapshot);else reject(Error(e.data.error));};w.onerror=e=>{w.terminate();reject(Error(e.message));};w.postMessage({mesh,edges:[...seams],target});});
window.changeComplex=()=>{mesh=core.makeComplexExample('assembly','high');seams=extractSeamEdgesFromUV(mesh);const packed=uv.sourceUVPreview(mesh,uv.buildCharts(mesh,seams));snapshot={packed,geometry:uv.buildUnfoldGeometry(mesh,packed,seams),target:'source',seams:[...seams],warnings:[]};view.setGeometry(snapshot.geometry);update({progress:.55,selected:snapshot.geometry.islands.map(i=>i.id),labels:false,wireframe:false});return mesh.faces.length;};
new ResizeObserver(drawUV).observe(document.querySelector('#uvhost'));update({});window.ready=true;
</script></body></html>`;
const modules=await browserModuleSources(compiled.output);
const cubeText=await readFile(join(compiled.root,'examples/cube_uv.obj'),'utf8');
const entry=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace("await(await fetch('/cube.obj')).text()",JSON.stringify(cubeText))
  .replace("new Worker('/apps/studio/src/workers/uv.worker.js',","new Worker(moduleURL('/apps/studio/src/workers/uv.worker.js'),");
modules['/entry.js']=entry;
const documentHTML=html.replace(/<script type="module">[\s\S]*?<\/script>/,'').replace('<link rel="stylesheet" href="/studio.css">','<style>'+await readFile(join(compiled.root,'apps/studio/src/styles.css'),'utf8')+'</style>');

let browser;
const check=async(name,fn)=>{const details=await fn();console.log('PASS',name);report.cases.push({name,passed:true,...(details?{details}:{})});};
try{
  browser=await startChrome();
  for(const dpr of [1,2]){
    const page=await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:dpr,mobile:false});
    const tree=await page.send('Page.getFrameTree');
    await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:documentHTML});
    await page.evaluate(moduleBootstrap(modules));
    await page.evaluate("import(moduleURL('/entry.js')).then(()=>true)").catch(error=>{console.error(browser.diagnostics());throw error;});
    await page.waitFor(`window.ready && document.querySelector('[data-testid="unfold-canvas"]')?.dataset.draws>0`,12000).catch(async error=>{console.error(await page.evaluate('({url:location.href,body:document.body.innerHTML.slice(0,300),state:document.readyState,boot:window.bootErrors,errors:window.errors,renderer:window.rendererErrors,ready:window.ready})'));throw error;});
    const canvas=`document.querySelector('[data-testid="unfold-canvas"]')`;
    await check(`DPR ${dpr}: actual WebGL2 shaders render colored mesh pixels`,async()=>{const p=await page.evaluate('pixels()');assert.equal(p.error,0);assert.ok(p.colored>2000,JSON.stringify(p));return p;});
    await check(`DPR ${dpr}: stable canvas CSS size and independent GPU drawing buffer`,async()=>{const r=await page.evaluate(`(()=>{const c=${canvas},h=c.parentElement;return {w:h.clientWidth,h:h.clientHeight,cw:c.clientWidth,ch:c.clientHeight,bw:c.width,bh:c.height}})()`);assert.equal(r.w,r.cw);assert.equal(r.h,r.ch);assert.equal(r.bw,r.w*dpr);assert.equal(r.bh,r.h*dpr);return r;});
    await page.evaluate(`window.originalCanvas=${canvas}`);
    const captures=[];
    for(const progress of [0,.5,1]){
      await page.evaluate(`update({progress:${progress}})`);await page.waitFor(`${canvas}.dataset.progress==='${progress}'`);await delay(80);
      const png=(await page.send('Page.captureScreenshot',{format:'png'})).data;captures.push(createHash('sha256').update(png).digest('hex'));
      const i=process.argv.indexOf('--screenshots');if(dpr===1&&i!==-1){await mkdir(process.argv[i+1],{recursive:true});await writeFile(join(process.argv[i+1],`unfold-${progress===0?'3d':progress===1?'uv':'mid'}.png`),Buffer.from(png,'base64'));}
    }
    await check(`DPR ${dpr}: source, intermediate and UV actually produce different rendered images`,()=>assert.equal(new Set(captures).size,3));
    await check(`DPR ${dpr}: exact UV endpoint and framebuffer still render`,async()=>{assert.equal(await page.evaluate(`${canvas}.dataset.targetError`),'0');const p=await page.evaluate('pixels()');assert.ok(p.colored>2000);assert.equal(p.error,0);return p;});
    await check(`DPR ${dpr}: backward scrubbing preserves camera and reuses canvas`,async()=>{const before=await page.evaluate('view.getCamera()');await page.evaluate('update({progress:.83});update({progress:.15});update({progress:.42});');await delay(60);assert.deepEqual(await page.evaluate('view.getCamera()'),before);assert.ok(await page.evaluate(`${canvas}===originalCanvas`));assert.ok(await page.evaluate(`(()=>{const expected=uvModule.writeUnfoldPositions(snapshot.geometry,options),actual=view.getPositions();return expected.every((v,i)=>v===actual[i]);})()`));});
    await check(`DPR ${dpr}: multi selection leaves other islands assembled`,async()=>{assert.ok(await page.evaluate(`(()=>{update({selected:[0,2],progress:1,context:'hidden'});const p=view.getPositions(),g=snapshot.geometry;return g.faceChart.every((id,fi)=>Array.from(p.slice(fi*9,fi*9+9)).every((v,k)=>v===(id===0||id===2?g.target:g.source)[fi*9+k]));})()`));});
    await check(`DPR ${dpr}: sequential schedule completes only the first island`,async()=>{await page.evaluate(`update({selected:snapshot.geometry.islands.map(i=>i.id),order:'sequential',progress:1.5/snapshot.geometry.islands.length})`);assert.equal(await page.evaluate(`${canvas}.dataset.completed`),'1');assert.equal((await page.evaluate('pixels()')).error,0);});
    if(process.argv.includes('--skip-browser-worker'))report.skipped.push({name:`DPR ${dpr}: browser module Worker`,reason:'Explicitly skipped for a restricted offline test host; not a passed worker test.'});
    else await check(`DPR ${dpr}: source / generated snapshots pass through a REAL module worker`,async()=>{assert.ok(await page.evaluate(`(async()=>{const generated=await workerPreview();const source=await workerPreview('source');return generated.packed instanceof Array&&generated.packed[0].faceUVs instanceof Map&&generated.geometry.target instanceof Float32Array&&generated.geometry.target.every((v,i)=>v===snapshot.geometry.target[i])&&source.target==='source';})()`));});
    await page.evaluate(`update({selected:snapshot.geometry.islands.map(i=>i.id),order:'together',progress:1,labels:false,context:'dim'});view.fit('uv')`);await delay(80);
    await check(`DPR ${dpr}: 2D picking returns the exact chart and source face`,async()=>{
      assert.ok(await page.evaluate(`(()=>{const chart=snapshot.packed[1],entry=[...chart.faceUVs][0],q=entry[1].reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]),el=document.querySelector('#uvhost'),f=uvScreenFrame(snapshot.geometry.atlas,el.clientWidth,el.clientHeight),hit=pickUVFace(snapshot,el.clientWidth,el.clientHeight,f.ox+q[0]*f.scale,f.oy-q[1]*f.scale,options.selected);return hit?.face===entry[0]&&hit.id===chart.id;})()`));
    });
    await check(`DPR ${dpr}: REAL 3D pointer picking follows the morphed target, not source`,async()=>{
      const point=await page.evaluate(`(()=>{const fi=snapshot.geometry.islands[1].faces[0],p=view.getPositions(),c=[0,0,0];for(let k=0;k<9;k++)c[k%3]+=p[fi*9+k]/3;const r=view.canvas.getBoundingClientRect(),s=projectPoint(c,cameraMatrix(view.getCamera(),r.width/r.height),r.width,r.height);return {x:r.left+s[0],y:r.top+s[1],fi,id:snapshot.geometry.faceChart[fi]};})()`);
      await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',buttons:0,clickCount:1});await delay(30);
      const pick=await page.evaluate('picks.at(-1)');assert.equal(pick?.[0],point.id);assert.equal(pick?.[1],point.fi);
    });
    await check(`DPR ${dpr}: orbit drag remains independent of morph progress`,async()=>{
      const p=await page.evaluate(`(()=>{const r=view.canvas.getBoundingClientRect();return {x:r.x+r.width*.6,y:r.y+r.height*.6};})()`),before=await page.evaluate('view.getCamera()');
      await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+75,y:p.y+35,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+75,y:p.y+35,button:'left',buttons:0,clickCount:1});
      assert.notDeepEqual(await page.evaluate('view.getCamera()'),before);const after=await page.evaluate('view.getCamera()');await page.evaluate('update({progress:.6})');assert.deepEqual(await page.evaluate('view.getCamera()'),after);
    });
    if(dpr===1){
      await check('90,112-triangle complex assembly: real rendered intermediate and exact original-UV endpoint',async()=>{const faces=await page.evaluate('changeComplex()');assert.equal(faces,90112);assert.equal((await page.evaluate('pixels()')).error,0);await page.evaluate('update({progress:1})');assert.equal(await page.evaluate(`${canvas}.dataset.targetError`),'0');return {triangles:faces};});
      await check('WebGL context loss/restoration reuploads geometry without replacing canvas',async()=>{await page.evaluate(`window.loseExt=view.gl.getExtension('WEBGL_lose_context');loseExt.loseContext()`);await delay(200);assert.ok((await page.evaluate('rendererErrors')).some(e=>e.includes('context lost')));await page.evaluate('loseExt.restoreContext()');await delay(500);assert.ok(await page.evaluate(`${canvas}===originalCanvas`));assert.equal((await page.evaluate('pixels()')).error,0);});
    }
    await check(`DPR ${dpr}: no uncaught exceptions; disposal removes canvas and labels`,async()=>{assert.deepEqual(await page.evaluate('errors'),[]);await page.evaluate('view.dispose()');assert.equal(await page.evaluate('document.querySelectorAll("#view canvas,#view .unfold-labels").length'),0);});
    page.close();
  }
  report.passed=report.cases.length;
  const i=process.argv.indexOf('--report');if(i!==-1)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{if(browser)await browser.close();await compiled.cleanup();}
