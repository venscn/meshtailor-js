import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const report={suite:'Actual saddle hinge + controls + production UV Worker and renderer',host:'Offline workbench, not React Studio',cases:[]};
const browser=await startChrome();
const check=async(name,fn)=>{const details=await fn();console.log('PASS',name);report.cases.push({name,passed:true,details});};
try {
 const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:960,deviceScaleFactor:1,mobile:false});
 const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});await page.waitFor('window.lab?.ready',20000);
 await page.evaluate(`window.layers=()=>{lab.view.draw();const r=lab.view.getOverlapCounts();let two=0,three=0,max=0;for(const n of r.counts){if(n===2)two++;if(n>=3)three++;max=Math.max(max,n);}return {two,three,max,width:r.width,height:r.height,error:lab.view.gl.getError()};};`);
 await check('new controls default to near-coplanar without pausing the player',async()=>{assert.equal(await page.evaluate('document.querySelector("#overlap-mode").value'),'coplanar');assert.equal(await page.evaluate('document.querySelector("#face-tones").checked'),true);});
 await check('real Worker builds one saddle UV island with valid final diamond',async()=>{
  await page.evaluate('document.querySelector("#overlap-demo").click()');await page.waitFor('lab.ready',20000);
  const r=await page.evaluate('({name:lab.mesh.name,faces:lab.mesh.faces.length,islands:lab.snapshot.packed.length,valid:lab.uv.checkUVTriangles([...lab.snapshot.packed[0].faceUVs.values()]).valid,hinges:lab.snapshot.geometry.hinge.angle.length})');assert.equal(r.islands,1);assert.equal(r.faces,4);assert.equal(r.valid,true);assert.ok(r.hinges>0);return r;
 });
 await page.evaluate('document.querySelector("[data-tool=animation]").click();lab.select(0);window.originalSnapshot=lab.snapshot;window.originalTarget=[...lab.snapshot.geometry.target];window.originalSource=[...lab.snapshot.geometry.source];window.originalMeshJSON=JSON.stringify(lab.mesh)');
 await check('original noncoplanar saddle is not falsely marked',async()=>{await page.evaluate('lab.update({progress:0});lab.view.fit("uv")');const r=await page.evaluate('layers()');assert.equal(r.max,1);return r;});
 await check('production hinge flatten creates a visible same-island 2-layer region',async()=>{
  await page.evaluate('document.querySelectorAll("#stages button")[3].click();lab.view.fit("uv")');const r=await page.evaluate('layers()');assert.equal(r.max,2);assert.ok(r.two>1000);assert.equal(r.error,0);return r;
 });
 await check('diagnostic toggles leave current pose, camera, snapshot and selection alone',async()=>{
  await page.evaluate('window.preserved={positions:[...lab.view.getPositions()],camera:lab.view.getCamera(),progress:lab.options.progress,selection:lab.inspection};document.querySelector("#overlap-mode").value="off";document.querySelector("#overlap-mode").dispatchEvent(new Event("change"))');
  assert.equal((await page.evaluate('layers()')).width,0);
  assert.ok(await page.evaluate('lab.snapshot===originalSnapshot&&JSON.stringify(preserved)===JSON.stringify({positions:[...lab.view.getPositions()],camera:lab.view.getCamera(),progress:lab.options.progress,selection:lab.inspection})'));
  await page.evaluate('document.querySelector("#overlap-mode").value="coplanar";document.querySelector("#overlap-mode").dispatchEvent(new Event("change"))');assert.equal((await page.evaluate('layers()')).max,2);
 });
 await check('tone, opacity and tolerance controls do not rebuild UV or timeline',async()=>{
  await page.evaluate('window.originalTimeline=lab.options.timeline;document.querySelector("#face-tones").click();document.querySelector("#overlap-opacity").value=".6";document.querySelector("#overlap-opacity").dispatchEvent(new Event("input"));document.querySelector("#overlap-tolerance").value=".02";document.querySelector("#overlap-tolerance").dispatchEvent(new Event("change"))');
  assert.ok(await page.evaluate('originalTimeline===lab.options.timeline&&originalSnapshot===lab.snapshot'));assert.equal(await page.evaluate('lab.options.overlapOpacity'),.6);assert.equal(await page.evaluate('lab.options.overlapTolerance'),.0002);assert.equal(await page.evaluate('lab.options.faceTones'),false);
 });
 await check('two-stage inspection and repeat click still cancel only triangle',async()=>{
  await page.evaluate('lab.pick(0,0,false)');assert.equal(await page.evaluate('lab.options.focusFace'),0);await page.evaluate('lab.pick(0,0,false)');assert.equal(await page.evaluate('lab.options.focusFace'),null);assert.deepEqual(await page.evaluate('lab.inspection.islands'),[0]);
 });
 await check('UV endpoint has no intra-island overlap and matches all target coordinates',async()=>{
  await page.evaluate('lab.update({progress:1});lab.view.fit("uv")');const r=await page.evaluate('layers()');assert.equal(r.max,1);assert.ok(await page.evaluate('lab.view.getPositions().every((v,i)=>v===lab.snapshot.geometry.target[i])'));return r;
 });
 await check('reverse scrubbing restores overlap without stale UV-endpoint mask',async()=>{await page.evaluate('document.querySelectorAll("#stages button")[3].click();lab.view.fit("uv")');assert.equal((await page.evaluate('layers()')).max,2);});
 await check('controls during actual playback keep advancing the same queue',async()=>{
  await page.evaluate('lab.update({progress:.55});document.querySelector("#play").click()');const before=await page.evaluate('lab.options.progress');
  await page.evaluate('document.querySelector("#overlap-mode").value="projected";document.querySelector("#overlap-mode").dispatchEvent(new Event("change"))');await delay(130);assert.equal(await page.evaluate('lab.playing'),true);assert.ok(await page.evaluate('lab.options.progress')>before);
  await page.evaluate('lab.pause();lab.update({overlapMode:"coplanar"})');
 });
 await check('manual camera gesture stays independent of diagnostic redraw',async()=>{
  const r=await page.evaluate('(()=>{const r=lab.view.canvas.getBoundingClientRect();return {x:r.x+r.width*.7,y:r.y+r.height*.5};})()');const before=await page.evaluate('lab.view.getCamera()');
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+42,y:r.y+24,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+42,y:r.y+24,button:'left',buttons:0});
  const after=await page.evaluate('lab.view.getCamera()');assert.notDeepEqual(after,before);await page.evaluate('lab.update({progress:.65});layers()');assert.deepEqual(await page.evaluate('lab.view.getCamera()'),after);
 });
 await check('high-DPI resize obeys buffer caps and the shared canvas remains stable',async()=>{
  await page.send('Emulation.setDeviceMetricsOverride',{width:1800,height:1200,deviceScaleFactor:2,mobile:false});await delay(80);const r=await page.evaluate('layers()');assert.ok(r.width*r.height<=2097152);assert.ok(r.width<=2048&&r.height<=2048);assert.equal(await page.evaluate('document.body.scrollWidth'),1800);return r;
 });
 await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:960,deviceScaleFactor:1,mobile:false});
 await check('actual context loss/restoration rebuilds diagnostic resources and keeps camera',async()=>{
  await page.evaluate('window.savedCamera=lab.view.getCamera();window.lossExt=lab.view.gl.getExtension("WEBGL_lose_context");lossExt.loseContext()');await page.waitFor('lab.view.lost');
  await delay(120);await page.evaluate('lossExt.restoreContext()');await page.waitFor('!lab.view.lost',10000);await delay(100);
  assert.deepEqual(await page.evaluate('lab.view.getCamera()'),await page.evaluate('savedCamera'));const r=await page.evaluate('layers()');assert.equal(r.error,0);assert.equal(await page.evaluate('lab.view.getOverlapState().error'),null);await page.evaluate('document.querySelector("#error").hidden=true');return r;
 });
 await check('source mesh and endpoint buffer remain byte-identical after all diagnostics',async()=>{assert.ok(await page.evaluate('originalMeshJSON===JSON.stringify(lab.mesh)&&originalTarget.every((v,i)=>v===lab.snapshot.geometry.target[i])&&originalSource.every((v,i)=>v===lab.snapshot.geometry.source[i])'));});
 await check('zero-selection and re-selection do not retain overlap ink',async()=>{await page.evaluate('lab.update({selected:[]})');assert.equal((await page.evaluate('layers()')).max,0);await page.evaluate('lab.select(0);document.querySelectorAll("#stages button")[3].click();lab.view.fit("uv")');assert.equal((await page.evaluate('layers()')).max,2);});
 await check('legend never captures pointers or changes island selection',async()=>{assert.equal(await page.evaluate('getComputedStyle(document.querySelector(".overlap-legend")).pointerEvents'),'none');assert.deepEqual(await page.evaluate('lab.inspection.islands'),[0]);});
 // Actual solved hinge-state screenshot. It is not an image mockup or a final-UV error.
 await page.evaluate('lab.update({overlapMode:"coplanar",overlapOpacity:.72,faceTones:true,showHinges:true,showTemporaryCuts:true,labels:true});document.querySelector("#overlap-mode").scrollIntoView({block:"center"})');await delay(100);
 const screenshot=process.argv.indexOf('--screenshot');if(screenshot>=0)await writeFile(process.argv[screenshot+1],Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await check('no unhandled errors',async()=>{assert.deepEqual(await page.evaluate('lab.errors'),[]);assert.equal(await page.evaluate('lab.view.gl.getError()'),0);});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS',report.passed,'cases');
} finally {await browser.close();}
