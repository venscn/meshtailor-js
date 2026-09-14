/** Actual browser Worker/lifecycle, including a CPU-bound runaway Worker.
 * Uses the shared offline UI, not a substitute React implementation. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startChrome,delay} from './chrome-cdp.mjs';
const browser=await startChrome(),report={suite:'Actual browser UV progress/cancel/timeout/retry',cases:[]};
const check=async(name,fn)=>{const details=await fn();report.cases.push({name,passed:true,details});console.log('PASS '+name);};
try{
 const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:1,mobile:false});
 const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile(resolve('unfold-lab.html'),'utf8')});await page.waitFor('window.lab?.ready',20000);
 await check('Large solve exposes real progress while UI remains responsive',async()=>{
   await page.evaluate('window.__pulse=0;window.__pulseTimer=setInterval(()=>__pulse++,25);void lab.load({mesh:lab.core.makeComplexExample("assembly","high"),edges:new Set()});true');
   await page.waitFor('lab.progressEvents.length>=3',15000);
   assert.ok(await page.evaluate('__pulse>2'));
   const r=await page.evaluate('({events:lab.progressEvents.length,status:document.querySelector("#status").textContent,faces:lab.mesh.faces.length})');assert.equal(r.faces,90112);assert.match(r.status,/已用/);return r;
 });
 await check('Cancel stops a busy solve and prevents late snapshot display',async()=>{
   await page.evaluate('document.querySelector("#cancel").click()');await delay(500);assert.equal(await page.evaluate('lab.snapshot'),null);assert.equal(await page.evaluate('lab.ready'),false);assert.match(await page.evaluate('document.querySelector("#status").textContent'),/已取消/);
 });
 await check('Retry succeeds after cancelling a large model',async()=>{await page.evaluate('document.querySelector("#ribbon").click()');await page.waitFor('lab.ready',20000);assert.equal(await page.evaluate('lab.snapshot.packed.length'),3);});
 await check('Real solver budget failure is visible and contains no stale atlas',async()=>{await page.evaluate('document.querySelector("#budget").value=".001";void lab.load({mesh:lab.core.makeComplexExample("assembly","high"),edges:new Set()});true');await page.waitFor('!document.querySelector("#error").hidden',10000);assert.match(await page.evaluate('document.querySelector("#error").textContent'),/预算|超/);assert.equal(await page.evaluate('lab.snapshot'),null);});
 await check('Source-UV route completes the same large mesh without reparameterizing',async()=>{
   await page.evaluate('document.querySelector("#budget").value="120";document.querySelector("#target").value="source";void lab.solve();true');await page.waitFor('lab.ready',20000);
   const r=await page.evaluate('({target:lab.snapshot.target,faces:lab.snapshot.geometry.faceChart.length,ms:lab.snapshot.timing.elapsedMs})');assert.equal(r.target,'source');assert.equal(r.faces,90112);return r;
 });
 await check('Main-thread deadline actually terminates a Worker stuck in a synchronous loop',async()=>{
   const r=await page.evaluate(`(async()=>{const {startUVJob}=await import(moduleURL('/apps/studio/src/unfold/uv-job-client.js'));const url=URL.createObjectURL(new Blob(['onmessage=()=>{postMessage({type:"progress",progress:{stage:"pack",detail:"intentional test spin",elapsedMs:0}});while(true){}}'],{type:'text/javascript'}));const h=startUVJob({}, {createWorker:()=>new Worker(url),timeoutMs:200,startupTimeoutMs:1000});try{await h.result;return 'unexpected';}catch(e){return {code:e.code,message:e.message};}finally{URL.revokeObjectURL(url);}})()`);assert.equal(r.code,'timeout');assert.match(r.message,/intentional test spin/);return r;
 });
 await check('New generated job and rendering recover after all failures',async()=>{await page.evaluate('document.querySelector("#target").value="generated";document.querySelector("#ribbon").click()');await page.waitFor('lab.ready',20000);assert.deepEqual(await page.evaluate('lab.errors'),[]);await page.evaluate('lab.update({progress:1});clearInterval(__pulseTimer)');assert.equal(await page.evaluate('lab.view.canvas.dataset.targetError'),'0');});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.passed+' cases');
}finally{await browser.close();}
