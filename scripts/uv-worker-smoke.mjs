/** Actual compiled production UV handler, executed in a Node worker thread.
 * The adapter only maps self/postMessage to parentPort. This does NOT validate
 * browser module-worker loading, Vite URL resolution, or the React hook.
 */
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileCore } from './lib/compiled-core.mjs';
const compiled=await compileCore();
const report={suite:'Production UV job handler in Node worker_threads (not browser Worker loading)',cases:[]};
const run=job=>new Promise((resolve,reject)=>{
  const url=pathToFileURL(join(compiled.output,'apps/studio/src/workers/uv.worker.js')).href;
  const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(data,options)=>parentPort.postMessage(data,options?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
  const timer=setTimeout(()=>{void worker.terminate();reject(Error('UV worker timed out'));},10000);
  worker.on('error',error=>{clearTimeout(timer);void worker.terminate();reject(error);});
  worker.on('message',data=>{if(data.ready){worker.postMessage(job);return;}clearTimeout(timer);void worker.terminate();resolve(data);});
});
const check=async(name,fn)=>{await fn();report.cases.push({name,passed:true});};
try{
  const core=await compiled.load('packages/mesh-core/src/index.js'),seams=await compiled.load('packages/chaining-seams/src/index.js'),uv=await compiled.load('packages/uv/src/index.js');
  const mesh=core.parseOBJ(await readFile(join(compiled.root,'examples/cube_uv.obj'),'utf8')),edges=[...seams.extractSeamEdgesFromUV(mesh)];
  await check('Generated UV worker transfers exact shared geometry, typed arrays and Maps',async()=>{
    const data=await run({mesh,edges,target:'generated'});assert.equal(data.ok,true);const s=data.snapshot;assert.equal(s.geometry.islands.length,6);assert.ok(s.packed[0].faceUVs instanceof Map);assert.ok(s.geometry.target instanceof Float32Array);
    const expected=uv.buildUnfoldGeometry(mesh,uv.planarPackPreview(mesh,uv.buildCharts(mesh,new Set(edges))),new Set(edges));assert.deepEqual(s.geometry.target,expected.target);assert.deepEqual(s.geometry.source,expected.source);
  });
  await check('Original-UV worker ignores unrelated baseline edges and preserves face UVs',async()=>{
    const data=await run({mesh,edges:[],target:'source'});assert.equal(data.ok,true);assert.equal(data.snapshot.geometry.islands.length,6);assert.deepEqual(new Set(data.snapshot.seams),new Set(edges));
    for(const c of data.snapshot.packed)for(const[fi,coords]of c.faceUVs)assert.deepEqual(coords,mesh.faces[fi].uvs);
  });
  await check('Missing source UV returns explicit error instead of a fallback or stale atlas',async()=>{
    const data=await run({mesh:core.makeCube(),edges:[],target:'source'});assert.equal(data.ok,false);assert.match(data.error,/UV/i);
  });
  await check('Complex original-UV job transfers all per-corner correspondences',async()=>{
    const m=core.makeComplexExample('assembly','medium'),data=await run({mesh:m,edges:[],target:'source'});assert.equal(data.ok,true);assert.equal(data.snapshot.geometry.target.length,m.faces.length*9);assert.ok(data.snapshot.geometry.target.every(Number.isFinite));
  });
  report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i!==-1)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await compiled.cleanup();}
