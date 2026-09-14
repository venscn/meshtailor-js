import assert from 'node:assert/strict';import{readFile,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{startChrome}from'./chrome-cdp.mjs';
const browser=await startChrome(),report={suite:'Actual offline UI, WebGL and production UV Worker; not React/Vite E2E',cases:[]};
const check=async(name,f)=>{const detail=await f();report.cases.push({name,passed:true,detail});console.log('PASS',name);};
try{
 for(const dpr of [1,2]){
  const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1580,height:1040,deviceScaleFactor:dpr,mobile:false});const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile(resolve('unfold-lab.html'),'utf8')});await page.waitFor('window.lab?.ready',20000);
  await check(`DPR ${dpr}: default gear is large valid charts, no tiny shards`,async()=>{
   await page.evaluate('document.querySelector("#example").value="gear";document.querySelector("#complex").click()');await page.waitFor('lab.ready && lab.mesh.name.includes("gear")',20000);
   const r=await page.evaluate('({islands:lab.snapshot.packed.length,valid:lab.snapshot.metrics.validated,min:Math.min(...lab.snapshot.packed.map(c=>c.faceUVs.size)),faces:lab.mesh.faces.length})');assert.equal(r.islands,4);assert.ok(r.valid);assert.ok(r.min>=16);assert.equal(r.faces,1536);return r;
  });
  await check(`DPR ${dpr}: auto button actually fills form values and solves`,async()=>{
   await page.evaluate('document.querySelector("#chart-faces").value=256;document.querySelector("#auto-large").click()');await page.waitFor('lab.ready',20000);assert.equal(await page.evaluate('Number(document.querySelector("#chart-faces").value)'),4096);assert.equal(await page.evaluate('lab.snapshot.packed.length'),4);assert.ok(await page.evaluate('document.querySelector("#auto-config").textContent.includes("大块优先")'));
  });
  await check(`DPR ${dpr}: Extract shows original single island without adding cuts`,async()=>{
   await page.evaluate('document.querySelector("#extract-uv").click()');await page.waitFor('lab.ready && lab.snapshot.target==="source"',20000);const r=await page.evaluate('({islands:lab.snapshot.packed.length,added:lab.snapshot.addedSeams??0,exact:lab.snapshot.packed.every(c=>[...c.faceUVs].every(([fi,q])=>JSON.stringify(q)===JSON.stringify(lab.mesh.faces[fi].uvs)))})');assert.equal(r.islands,1);assert.equal(r.added,0);assert.ok(r.exact);return r;
  });
  await check(`DPR ${dpr}: resegmentation is explicit and source UV still retained`,async()=>{
   await page.evaluate('window.beforeMesh=JSON.stringify(lab.mesh);document.querySelector("#auto-large").click()');await page.waitFor('lab.ready && lab.snapshot.target==="generated"',20000);assert.equal(await page.evaluate('lab.snapshot.packed.length'),4);assert.ok(await page.evaluate('JSON.stringify(lab.mesh)===beforeMesh'));
  });
  await check(`DPR ${dpr}: exact endpoints, common UV and valid WebGL`,async()=>{
   await page.evaluate('lab.update({progress:0});lab.view.draw()');assert.equal(await page.evaluate('lab.view.canvas.dataset.sourceError'),'0');await page.evaluate('lab.update({progress:1});lab.view.fit("uv");lab.view.draw()');assert.equal(await page.evaluate('lab.view.canvas.dataset.targetError'),'0');assert.equal(await page.evaluate('lab.view.gl.getError()'),0);
   if(dpr===1&&process.argv.includes('--screenshot'))await writeFile(process.argv[process.argv.indexOf('--screenshot')+1],Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  });
  await check(`DPR ${dpr}: mirrored source atlas never collapses or flips during fit`,async()=>{
   await page.evaluate('document.querySelector("#target").value="source";void lab.load({mesh:{name:"mirrored asymmetric panel",positions:[[0,0,0],[2,0,0],[0,1,0]],faces:[{vertices:[0,1,2],uvs:[[.1,.8],[.9,.8],[.1,.2]]}]},edges:new Set()})');await page.waitFor('lab.ready && lab.mesh.name.includes("mirrored")',20000);
   const r=await page.evaluate('(()=>{lab.update({skipStatic:false,holdNet:true});const signs=[];for(const t of [.7,.8,.84,.86,.9,.92,1]){lab.update({progress:t});const p=lab.view.getPositions();signs.push((p[3]-p[0])*(p[7]-p[1])-(p[4]-p[1])*(p[6]-p[0]));}return {signs,orientation:lab.snapshot.geometry.hinge.islands[0].targetOrientation,error:lab.view.gl.getError()};})()');assert.equal(r.orientation,-1);assert.ok(r.signs.every(n=>n< -1e-5));assert.equal(r.error,0);return r;
  });
  await check(`DPR ${dpr}: no application errors`,async()=>assert.deepEqual(await page.evaluate('lab.errors'),[]));page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(report.passed,'large-chart/browser orientation checks passed.');
}finally{await browser.close();}
