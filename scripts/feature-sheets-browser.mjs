/** Real offline DOM + production Worker/WebGL; not a React/Three loader test. */
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-feature-browser';
await mkdir(out,{recursive:true});const browser=await startChrome(),report={scope:'Actual offline workbench with bundled UV-free FlightHelmet geometry',tests:[]};let p;
const check=async(name,fn)=>{const detail=await fn();report.tests.push({name,passed:true,detail});console.log('PASS',name,detail??'')};
try{
 p=await browser.page();await p.send('Emulation.setDeviceMetricsOverride',{width:1720,height:1040,deviceScaleFactor:1,mobile:false});
 const t=await p.send('Page.getFrameTree');await p.send('Page.setDocumentContent',{frameId:t.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});
 const ev=x=>p.evaluate(x,120000),wait=async(x,ms=300000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await ev(x))return;await delay(150)}throw Error('Timeout '+x)};
 const click=async(selector)=>{await ev(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);const r=await ev(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await p.send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',buttons:1,clickCount:1});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',buttons:0,clickCount:1})};
 await wait('window.lab?.ready');
 await check('New build is actually mounted',async()=>assert.equal(await ev('document.querySelector(".version").textContent'),'0.4.21'));
 await ev('lab.pause();lab.update({wireframe:false,labels:false,showHinges:false,showTemporaryCuts:false,overlapMode:"off"});document.querySelector("#budget").value="300"');
 await click('[data-tool="mesh"]');await click('#verified-helmet');await wait('lab.ready&&lab.mesh.faces.length===94722');
 await check('Actual helmet button uses pure geometry and completes production Worker',async()=>{assert.equal(await ev('lab.mesh.faces.some(f=>"uvs"in f||"uvIndices"in f)'),false);assert.equal(await ev('lab.snapshot.inputPolicy'),'geometry-only-v1');assert.equal(await ev('lab.snapshot.metrics.validated'),true);assert.equal(await ev('lab.snapshot.packed.length'),193)});
 await ev('window.sheetId=lab.snapshot.diagnostics.find(d=>d.feature?.holes===2)?.id');
 await check('Whole-model generation retains two holes in a geometric feature sheet',async()=>{const d=await ev('lab.snapshot.diagnostics.find(d=>d.id===sheetId)');assert.equal(d.method,'feature-constrained');assert.equal(d.faces,835);assert.ok(d.feature.valid);assert.equal(d.feature.holes,2);return d.feature});
 await click('[data-tool="animation"]'); // same selectable area as normal workbench
 await ev('lab.select(sheetId);lab.update({progress:0,context:"dim",wireframe:true,labels:true});lab.view.fitCurrent()');
 await check('Selecting the protected sheet does not implicitly select a triangle',async()=>{assert.equal(await ev('lab.options.focusFace'),null);assert.deepEqual(await ev('lab.inspection.islands'),[await ev('sheetId')])});
 await check('Inspector shows measured hole contract, not a semantic score',async()=>assert.match(await ev('document.querySelector("#selection-feature").textContent'),/保留 2 个孔/));
 await ev('lab.view.camera.yaw=0;lab.view.camera.pitch=0;lab.update()');await delay(300);
 await writeFile(out+'/helmet-feature.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'},120000)).data,'base64'));
 await check('Selected sheet retains two holes at exact animation endpoint',async()=>{await ev('lab.update({progress:1});lab.view.fitCurrent()');const d=await ev('lab.snapshot.diagnostics.find(d=>d.id===sheetId)');assert.equal(d.feature.holes,2);assert.equal(await ev('lab.view.gl.getError()'),0)});
 await delay(250);await writeFile(out+'/helmet-feature-flat.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'},120000)).data,'base64'));
 await check('Playback with hidden background and no wireframe preserves user camera state',async()=>{await ev('lab.update({progress:.12,context:"hide",wireframe:false,labels:false});document.querySelector("#rate").value="4";document.querySelector("#rate").dispatchEvent(new Event("change"))');const before=await ev('JSON.stringify(lab.view.camera)');await click('#play');await wait('lab.playing||lab.options.progress>.12',20000);await wait('lab.options.progress>.12',20000);await ev('lab.pause()');assert.equal(await ev('JSON.stringify(lab.view.camera)'),before)});
 await check('Repacking cannot erase the protected boundary loops',async()=>{await ev('lab.update({wireframe:false,labels:false});void lab.postprocess("repack")');await wait('lab.ready&&lab.snapshot.target==="repack"');const ds=await ev('lab.snapshot.diagnostics.filter(d=>d.feature?.holes===2)');assert.ok(ds.length>0&&ds.every(d=>d.feature.valid));assert.equal(await ev('lab.snapshot.packed.length'),193)});
 await check('Fill validates the resulting feature shape, not only its initial seed',async()=>{await ev('document.querySelector("#fill-budget").value="1";document.querySelector("#fill-rounds").value="1";void lab.postprocess("fill")');await wait('lab.ready&&lab.snapshot.target==="fill"');assert.equal(await ev('lab.snapshot.packed.length'),193);assert.equal(await ev('lab.snapshot.diagnostics.some(d=>d.feature?.holes===2&&d.feature.valid)'),true)});
 await check('No JavaScript/WebGL failures were hidden',async()=>{assert.deepEqual(await ev('lab.errors'),[]);assert.equal(await ev('lab.view.gl.getError()'),0)});
 report.passed=report.tests.length;
}catch(e){report.error=String(e.stack??e);console.error(e);process.exitCode=1;try{report.dom=await p.evaluate('({ready:lab?.ready,error:document.querySelector("#error")?.textContent,status:document.querySelector("#status")?.textContent})')}catch{}}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
