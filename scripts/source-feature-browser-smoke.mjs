/** Exercises the actual default model-load + production Worker, including source
 * inspection and reorganization. No substitution of the generated path. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const arg=(k,v)=>{const i=process.argv.indexOf(k);return i<0?v:process.argv[i+1]},out=arg('--out','validation/v0.4.19/browser');await mkdir(out,{recursive:true});
const browser=await startChrome(),cases=[];
try{
 const p=await browser.page();await p.send('Emulation.setDeviceMetricsOverride',{width:1680,height:1060,deviceScaleFactor:1,mobile:false});const tree=await p.send('Page.getFrameTree');await p.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});await p.waitFor('window.lab?.ready',30000);
 const test=async(name,fn)=>{const detail=await fn();cases.push({name,passed:true,detail});console.log('PASS',name,detail??'');};
 const ready=()=>p.waitFor('lab.ready&&lab.pipelineTrace?.status==="completed"',60000);
 const click=selector=>p.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 await click('[data-pipeline=standard]');
 await test('Default auto workflow repairs source features when loading actual gear',async()=>{
  await p.evaluate('void lab.load({mesh:lab.core.makeComplexExample("gear","low"),edges:new Set()},true)');await ready();
  const d=await p.evaluate('({target:lab.snapshot.target,source:lab.snapshot.sourceAudit.domains.reduce((s,c)=>s+c.islands,0),islands:lab.snapshot.packed.length,changed:lab.snapshot.features?.changedCharts,planar:lab.snapshot.diagnostics.filter(d=>d.method==="planar-shape").length,stage:lab.snapshot.pipeline.steps.find(s=>s.id==="features")})');
  assert.equal(d.target,'source-atlas');assert.equal(d.source,1);assert.equal(d.changed,1);assert.equal(d.planar,2);assert.equal(d.islands,6);assert.equal(d.stage.state,'completed');return d;
 });
 await test('Feature controls and report are visible, not hidden behind a new preset',async()=>{await click('[data-tool=uv]');assert.equal(await p.evaluate('document.querySelector("#source-features").checked'),true);assert.match(await p.evaluate('document.querySelector("#features-summary").textContent'),/重展 1 个原岛/);});
 await test('Repack carries feature identities and protected boundary seams',async()=>{await p.evaluate('window.originalFeatureFaces=JSON.stringify(lab.snapshot.features.regions.map(g=>g.faces));void lab.postprocess("repack")');await ready();assert.equal(await p.evaluate('JSON.stringify(lab.snapshot.features.regions.map(g=>g.faces))===originalFeatureFaces'),true);assert.equal(await p.evaluate('lab.snapshot.features.protectedSeams.every(s=>lab.snapshot.seams.includes(s))'),true);});
 await test('Later stitching cannot merge the planar faces back into a wrapping rectangle',async()=>{await p.evaluate('void lab.postprocess("stitch")');await ready();assert.equal(await p.evaluate('lab.snapshot.packed.length'),6);assert.equal(await p.evaluate('lab.snapshot.features.protectedSeams.every(s=>lab.snapshot.seams.includes(s))'),true);});
 await test('Inspect deliberately still displays the original one-square UV',async()=>{await p.evaluate('document.querySelector("#target").value="source";void lab.solve()');await ready();assert.equal(await p.evaluate('lab.snapshot.packed.length'),1);assert.equal(await p.evaluate('!!lab.snapshot.features'),false);});
 await test('Extract + organize also performs feature correction',async()=>{await click('#extract-uv');await ready();assert.equal(await p.evaluate('lab.snapshot.target'),'source-atlas');assert.equal(await p.evaluate('lab.snapshot.packed.length'),6);assert.equal(await p.evaluate('lab.snapshot.features.changedCharts'),1);});
 await test('Disabling source feature correction is an explicit reversible comparison',async()=>{await p.evaluate('document.querySelector("#source-features").checked=false;void lab.solve()');await ready();assert.equal(await p.evaluate('lab.snapshot.packed.length'),1);await p.evaluate('document.querySelector("#source-features").checked=true;void lab.solve()');await ready();assert.equal(await p.evaluate('lab.snapshot.packed.length'),6);});
 await test('Continued fill preserves panel geometry and feature references',async()=>{await p.evaluate('document.querySelector("#fill-budget").value=1;document.querySelector("#fill-rounds").value=2;window.beforeFill=lab.snapshot.packed.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]}));void lab.postprocess("fill")');await ready();assert.equal(await p.evaluate('JSON.stringify(lab.snapshot.packed.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})))===JSON.stringify(beforeFill)'),true);assert.equal(await p.evaluate('lab.snapshot.features.changedCharts'),1);});
 await test('Island selection still does not automatically select a triangle',async()=>{await p.evaluate('lab.select(lab.snapshot.packed[0].id)');assert.equal(await p.evaluate('lab.inspection.face'),null);});
 await test('Playback reaches exact target coordinates with manual camera retained',async()=>{await click('#all');const cam=await p.evaluate('lab.view.getCamera()');await p.evaluate('lab.update({progress:1,showHinges:false,showTemporaryCuts:false,overlapMode:"off"})');assert.deepEqual(await p.evaluate('lab.view.getCamera()'),cam);});
 await test('No browser JS/WebGL errors',async()=>{assert.deepEqual(await p.evaluate('lab.errors'),[]);assert.equal(await p.evaluate('lab.view.gl.getError()'),0);});
 // Freshly load the same DEFAULT workflow for the published screenshot (no fill).
 await p.evaluate('void lab.load({mesh:lab.core.makeComplexExample("gear","low"),edges:new Set()},true)');await ready();
 await click('[data-tool=uv]');await click('#all');await p.evaluate('lab.update({progress:0,showHinges:false,showTemporaryCuts:false,overlapMode:"off",wireframe:false});lab.view.fit("orbit");');await delay(250);
 await writeFile(out+'/gear-default.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await p.evaluate('lab.update({progress:1});lab.view.fit("uv");');await delay(250);
 await writeFile(out+'/gear-on-uv.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await writeFile(out+'/report.json',JSON.stringify({passed:cases.length,softwareWebGL:process.env.CHROME_SOFTWARE_WEBGL==='1',cases},null,2));
}finally{await browser.close();}
