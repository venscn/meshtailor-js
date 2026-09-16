/** Production Worker controls, real gear geometry and actual Canvas/WebGL output. */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {startChrome} from './chrome-cdp.mjs';
const b=await startChrome(),report={suite:'Hand-paint UV objective / real offline workbench',scope:'Offline workbench; production Worker, geometry and renderer; not React',cases:[]};
const output=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/v0.4.16/previews';await mkdir(output,{recursive:true});
try{
 const p=await b.page();await p.send('Emulation.setDeviceMetricsOverride',{width:1720,height:1120,deviceScaleFactor:1,mobile:false});
 const tree=await p.send('Page.getFrameTree');await p.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});await p.waitFor('window.lab?.ready',30000);
 const check=async(name,fn)=>{const details=await fn();report.cases.push({name,passed:true,details});console.log('PASS',name)};
 await check('Paint is default and controls are actually present',async()=>{assert.equal(await p.evaluate('document.querySelector("#uv-objective").value'),'paint');assert.equal(await p.evaluate('document.querySelector("#merge-shape-limit").value'),'1.5')});
 await check('Default gear preserves major planar panels in production worker',async()=>{
  await p.evaluate('document.querySelector("#target").value="generated";lab.load({mesh:lab.core.makeComplexExample("gear","low"),edges:new Set()});');await p.waitFor('lab.ready&&lab.snapshot?.mesh?.name?.includes("Gear")',1000).catch(()=>{});await p.waitFor('lab.ready && lab.snapshot?.diagnostics?.some(d=>d.method==="planar-shape")',30000);
  const r=await p.evaluate('({faces:lab.mesh.faces.length,islands:lab.snapshot.packed.length,methods:lab.snapshot.diagnostics.map(d=>d.method),valid:lab.snapshot.packed.every(c=>lab.uv.checkUVTriangles([...c.faceUVs.values()]).valid),covers:lab.snapshot.packed.reduce((n,p)=>n+p.faceUVs.size,0),uvs:[...lab.snapshot.packed].map(p=>[p.id,[...p.faceUVs]])})');assert.equal(r.faces,1536);assert.equal(r.covers,r.faces);assert.equal(r.islands,5);assert.equal(r.methods.filter(x=>x==='planar-shape').length,2);assert.ok(r.valid);assert.ok(!r.methods.includes('tutte'));return{faces:r.faces,islands:r.islands,methods:r.methods};
 });
 await check('Method report explains actual solve, not only selected preference',async()=>{const s=await p.evaluate('document.querySelector("#shape-methods").textContent');assert.ok(s.includes('planar-shape'));return s});
 await check('Solver controls neither move camera nor modify current completed UV until apply',async()=>{const r=await p.evaluate('(()=>{window.saved=lab.snapshot;const c=JSON.stringify(lab.view.getCamera());const e=document.querySelector("#uv-objective");e.value="compact";e.dispatchEvent(new Event("change"));return{same:lab.snapshot===saved,camera:c===JSON.stringify(lab.view.getCamera())};})()');assert.ok(r.same&&r.camera);await p.evaluate('document.querySelector("#uv-objective").value="paint"');});
 await check('Gear UV endpoint remains exact and permits island-only selection',async()=>{const r=await p.evaluate('lab.pause();lab.update({progress:1});lab.view.fitCurrent();lab.select(lab.snapshot.geometry.islands.find(i=>i.faces.length===192).id);lab.update({progress:1});({face:lab.options.focusFace,exact:lab.snapshot.geometry.islands.filter(i=>lab.options.selected.includes(i.id)).every(i=>i.faces.every(f=>[...lab.view.getPositions()].slice(f*9,f*9+9).every((x,k)=>x===lab.snapshot.geometry.target[f*9+k])))})');assert.equal(r.face,null);assert.equal(r.exact,true)});
 await p.evaluate('document.querySelector("[data-tool=uv]").click();document.querySelector("#all").click();lab.update({progress:0,context:"solid",showTemporaryCuts:false,showHinges:false});lab.view.fitCurrent();');
 await writeFile(output+'/gear-paint.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 await check('No hidden forced-circle solver or rendering error',async()=>{assert.deepEqual(await p.evaluate('lab.errors'),[]);assert.equal(await p.evaluate('lab.view.gl.getError()'),0)});
 const arg=process.argv.indexOf('--corset');if(arg>=0){
  await p.evaluate('window.objText='+JSON.stringify(await readFile(process.argv[arg+1],'utf8'))+';document.querySelector("#target").value="source";lab.load({mesh:lab.core.parseOBJ(objText),edges:lab.uv.seamsForUnfold?lab.uv.seamsForUnfold(lab.core.parseOBJ(objText)):new Set()});');
  await p.waitFor('lab.ready&&lab.mesh.faces.length===18324',45000);
  // Source inspection preserves the already-produced result; do not claim another solve.
  await p.evaluate('document.querySelector("[data-tool=animation]").click();document.querySelector("#all").click();lab.update({progress:.08,context:"solid",showTemporaryCuts:false,showHinges:false});lab.view.fitCurrent();');
  await writeFile(output+'/corset-paint.png',Buffer.from((await p.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 report.passed=report.cases.length;const a=process.argv.indexOf('--report');if(a>=0)await writeFile(process.argv[a+1],JSON.stringify(report,null,2));
}finally{await b.close()}
