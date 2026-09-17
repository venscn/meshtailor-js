/** Reproducible regression on the corrected, hash-pinned user assets.
 * No downloads, no silent fixture substitutions. See verified-model-fixtures.mjs.
 */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {compileCore} from './lib/compiled-core.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const arg=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];};
const folder=arg('--models'),destination=arg('--out','validation/v0.4.11/local'),mode=arg('--mode','source-atlas');
const names=arg('--asset','Corset,FlightHelmet').split(',');
if(!folder)throw Error('Pass --models <extracted corrected meshtailor-test-models directory>');
if(!['inspect','source-atlas','connected','generated'].includes(mode))throw Error('Mode must be inspect, source-atlas, connected or generated');
const config=JSON.parse(arg('--config','{}'));
if(!config||typeof config!=='object'||Array.isArray(config))throw Error('--config must be a JSON object');
if(mode==='connected')Object.assign(config,{initialSegmentation:'connected',postMerge:true});
const budget=Number(config.timeBudgetMs??120000);
if(!Number.isFinite(budget)||budget<=0)throw Error('Invalid worker time budget');
await mkdir(destination,{recursive:true});const compiled=await compileCore();
async function runWorker(mesh){
 const url=pathToFileURL(join(compiled.output,'apps/studio/src/workers/uv.worker.js')).href;
 const progress=[];
 return new Promise((resolve,reject)=>{
  const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(d,o)=>parentPort.postMessage(d,o?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
  let settled=false,last='';
  const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(timer);void w.terminate();error?reject(error):resolve({result,progress});};
  const timer=setTimeout(()=>finish(Error('Fixture harness hard timeout, no result accepted')),budget+30000);
  w.on('error',error=>finish(error));w.on('exit',code=>{if(!settled)finish(Error('Worker exited before result: '+code));});
  w.on('message',data=>{
   if(data.ready){w.postMessage({mesh,edges:[],target:mode==='source-atlas'?'source-atlas':'generated',config});return;}
   if(data.type==='progress'){if(data.progress.stage!==last){last=data.progress.stage;progress.push(data.progress);console.log(mesh.name,last,Math.round(data.progress.elapsedMs),data.progress.detail);}return;}
   finish(null,data);
  });
 });
}
try{
 const core=await compiled.load('packages/mesh-core/src/index.js'),uv=await compiled.load('packages/uv/src/index.js'),seamLib=await compiled.load('packages/chaining-seams/src/index.js');
 for(const name of names){
  const {mesh,report:importReport,identity}=await loadVerifiedFixture(core,folder,name);
  const original=JSON.stringify(mesh),seams=seamLib.extractSeamEdgesFromUV(mesh),charts=uv.buildCharts(mesh,seams),packed=uv.sourceUVPreview(mesh,charts,'materials');
  const report={asset:name,identity,mode,config,vertices:mesh.positions.length,faces:mesh.faces.length,importReport,components:uv.buildCharts(mesh,new Set()).length,sourceIslands:packed.length,sourceAreas:uv.auditIslandAreas(mesh,packed),sourceUV:uv.auditSourceUV(packed),invalidSource:packed.map(p=>({id:p.id+1,faces:p.faceUVs.size,q:uv.checkUVTriangles([...p.faceUVs.values()],100)})).filter(({q})=>q.degenerate||q.overlaps||q.flipped!==0&&q.flipped!==q.triangles)};
  console.log(name,'input',report.faces,report.components,report.sourceIslands,'invalid',report.invalidSource.map(c=>c.id));
  if(mode!=='inspect'){
   try{
    const {result,progress}=await runWorker(mesh);report.progress=progress;
    if(!result.ok){report.result=result;process.exitCode=1;}
    else{
     const s=result.snapshot,seen=new Set();
     for(const ch of s.packed){for(const f of ch.faceUVs.keys()){assert.ok(!seen.has(f),'Duplicate face');seen.add(f);}assert.ok(uv.checkUVTriangles([...ch.faceUVs.values()]).valid,'Invalid chart');}
     assert.equal(seen.size,mesh.faces.length);assert.ok(s.geometry.target.every(Number.isFinite),'Non-finite animation endpoint');
     const globalQuality=uv.checkUVTriangles(s.packed.flatMap(p=>[...p.faceUVs.values()]));
     // This runner's current generated modes all produce a single atlas.
     // Pooling multiple intentionally separate pages would require per-page checks.
     assert.equal(s.pageReport?.pages?.length??1,1,'Run single-page validation separately from multi-page tests');
     report.candidateQuality=globalQuality;
     if(!globalQuality.valid)await writeFile(join(destination,`${name}-REJECTED.json`),JSON.stringify({quality:globalQuality,packed:s.packed.map(p=>({...p,faceUVs:[...p.faceUVs]})),diagnostics:s.diagnostics}));
     assert.equal(globalQuality.valid,true,'Invalid pooled atlas');assert.equal(globalQuality.triangles,mesh.faces.length);
     const exported=uv.meshWithPreviewUV(mesh,s.packed),obj=core.meshToOBJ(exported),reloaded=core.parseOBJ(obj);
     assert.equal(reloaded.faces.length,mesh.faces.length);
     assert.ok(reloaded.faces.every((f,i)=>f.uvs.every((p,k)=>p.every((x,j)=>Math.abs(x-exported.faces[i].uvs[k][j])<1e-8))),'UV round-trip mismatch');
     const islands=uv.buildCharts(reloaded,seamLib.extractSeamEdgesFromUV(reloaded)).length;
     assert.equal(islands,s.packed.length,'Export changed UV island count');
     report.result={ok:true,human:s.human,diagnostics:s.diagnostics,islands:s.packed.length,timing:s.timing,metrics:s.metrics,merge:s.merge,repair:s.repair,fragmentation:s.fragmentation,areaAudit:s.areaAudit,spatialReport:s.spatialReport,pageReport:s.pageReport,packingReport:s.packingReport,warnings:s.warnings,coverage:seen.size,globalQuality,exportedFaces:reloaded.faces.length,exportedIslands:islands,areaDensityRange:[Math.min(...s.areaAudit.islands.map(i=>i.densityRatio)),Math.max(...s.areaAudit.islands.map(i=>i.densityRatio))]};
     if(process.argv.includes('--export')){await writeFile(join(destination,`${name}-organized.obj`),obj);await writeFile(join(destination,`${name}-original.obj`),core.meshToOBJ(mesh));}
     if(process.argv.includes('--snapshots'))await writeFile(join(destination,`${name}-${mode}-mesh.json`),JSON.stringify({mesh,packed:s.packed.map(p=>({...p,faceUVs:[...p.faceUVs]})),seams:s.seams,report:report.result}));
    }
   }catch(error){report.result={ok:false,error:String(error.stack??error)};process.exitCode=1;}
   console.log(name,report.result.ok?'OK '+report.result.islands:'ERROR '+report.result.error);
  }
  assert.equal(JSON.stringify(mesh),original,'Source mesh/UV mutated');report.sourceUnchanged=true;
  await writeFile(join(destination,`${name}-${mode}.json`),JSON.stringify(report,null,2)+'\n');
 }
}finally{await compiled.cleanup();}
