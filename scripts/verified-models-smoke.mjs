import {mkdir,writeFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import {Worker} from 'node:worker_threads';import {pathToFileURL} from 'node:url';
import {compileCore} from './lib/compiled-core.mjs';import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const arg=(s,d)=>{const i=process.argv.indexOf(s);return i<0?d:process.argv[i+1];};
const folder=arg('--models'),destination=arg('--out','validation/v0.4.11'),mode=arg('--mode','inspect'),names=arg('--asset','Corset,FlightHelmet').split(',');
if(!folder)throw new Error('Pass --models <extracted corrected meshtailor-test-models directory>');
await mkdir(destination,{recursive:true});const c=await compileCore();
try{const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),seamsLib=await c.load('packages/chaining-seams/src/index.js');
 for(const name of names){const {mesh,report:importReport,identity}=await loadVerifiedFixture(core,folder,name);const before=JSON.stringify(mesh),seams=seamsLib.extractSeamEdgesFromUV(mesh),charts=uv.buildCharts(mesh,seams),packed=uv.sourceUVPreview(mesh,charts,'materials');
 const report={asset:name,identity,mode,vertices:mesh.positions.length,faces:mesh.faces.length,importReport,components:uv.buildCharts(mesh,new Set()).length,sourceIslands:packed.length,sourceAreas:uv.auditIslandAreas(mesh,packed),sourceUV:uv.auditSourceUV(packed),invalidSource:packed.map(p=>({id:p.id+1,faces:p.faceUVs.size,q:uv.checkUVTriangles([...p.faceUVs.values()],100)})).filter(({q})=>q.degenerate||q.overlaps||q.flipped!==0&&q.flipped!==q.triangles)};
 console.log(name,'input',report.faces,report.components,report.sourceIslands,'invalid',report.invalidSource.map(c=>[c.id,c.faces,c.q]));
 if(mode!=='inspect'){
  const config=JSON.parse(arg('--config','{}')),budget=Number(config.timeBudgetMs??120000),target=mode==='source-atlas'?'source-atlas':'generated';if(mode==='connected')Object.assign(config,{initialSegmentation:'connected',postMerge:true});
  const url=pathToFileURL(join(c.output,'apps/studio/src/workers/uv.worker.js')).href;
  const result=await new Promise((yes,no)=>{const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(d,o)=>parentPort.postMessage(d,o?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});const timer=setTimeout(()=>{w.terminate();no(Error('Hard fixture timeout'));},budget+10000);w.on('error',no);let last='';w.on('message',d=>{if(d.ready){w.postMessage({mesh,edges:[],target,config});return;}if(d.type==='progress'){if(d.progress.stage!==last){console.log(name,d.progress.stage,Math.round(d.progress.elapsedMs),d.progress.detail);last=d.progress.stage;}return;}clearTimeout(timer);w.terminate();yes(d);});});
  if(result.ok){const s=result.snapshot;report.result={ok:true,islands:s.packed.length,timing:s.timing,metrics:s.metrics,merge:s.merge,repair:s.repair,fragmentation:s.fragmentation,areaAudit:s.areaAudit,spatialReport:s.spatialReport,pageReport:s.pageReport,packingReport:s.packingReport,warnings:s.warnings};
   const seen=new Set();for(const ch of s.packed){for(const f of ch.faceUVs.keys()){if(seen.has(f))throw Error('Duplicate face');seen.add(f);}const q=uv.checkUVTriangles([...ch.faceUVs.values()]);if(!q.valid)throw Error(`Invalid chart ${ch.id}`);}
   if(seen.size!==mesh.faces.length||!s.geometry.target.every(Number.isFinite))throw Error('Missing face / invalid animation endpoint');
   report.result.coverage=seen.size;report.result.areaDensityRange=[Math.min(...s.areaAudit.islands.map(i=>i.densityRatio)),Math.max(...s.areaAudit.islands.map(i=>i.densityRatio))];
   await writeFile(join(destination,`${name}-${mode}-mesh.json`),JSON.stringify({mesh,packed:s.packed.map(p=>({...p,faceUVs:[...p.faceUVs]})),seams:s.seams,report:report.result}));
  }else report.result=result;
  console.log(name,report.result.ok?'OK '+report.result.islands:'ERROR '+report.result.error);
 }
 if(before!==JSON.stringify(mesh))throw Error('Input mutated');
 await writeFile(join(destination,`${name}-${mode}.json`),JSON.stringify(report,null,2)+'\n');
 }
}finally{await c.cleanup();}
