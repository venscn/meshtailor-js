import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const {mesh}=demo.makeFragmentationDemo(2);const original=structuredClone(mesh);
 const run=job=>new Promise((resolve,reject)=>{
  const url=pathToFileURL(join(c.output,'apps/studio/src/workers/uv.worker.js')).href;
  const w=new Worker(`const{parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=d=>parentPort.postMessage(d);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
  const timer=setTimeout(()=>{w.terminate();reject(Error('timeout'));},20000);
  w.on('error',e=>{clearTimeout(timer);w.terminate();reject(e);});w.on('message',d=>{if(d.ready)w.postMessage(job);else if(!d.type){clearTimeout(timer);w.terminate();resolve(d);}});
 });
 const raw=await run({mesh,edges:[],target:'source'});assert.ok(raw.ok);assert.equal(raw.snapshot.packed.length,12);checks++;
 assert.ok(raw.snapshot.sourceAudit.hasOverlaps);assert.ok(raw.snapshot.sourceAudit.islandOverlaps.length>0);checks++;
 const clean=await run({mesh,edges:[],target:'source-atlas'});assert.ok(clean.ok,clean.error);assert.equal(clean.snapshot.packed.length,2);checks++;
 assert.equal(clean.snapshot.sourceAreaAudit.islands.length,12);assert.equal(clean.snapshot.areaAudit.islands.length,2);checks++;
 assert.ok(clean.snapshot.sourceAudit.hasOverlaps);assert.ok(uv.checkUVTriangles(clean.snapshot.packed.flatMap(c=>[...c.faceUVs.values()])).valid);checks++;
 assert.ok(clean.snapshot.areaAudit.islands.every(i=>Math.abs(i.densityRatio-1)<1e-8));checks++;
 assert.ok(clean.snapshot.geometry.target.every(Number.isFinite));assert.equal(clean.snapshot.geometry.faceChart.length,mesh.faces.length);checks++;
 const noMerge=await run({mesh,edges:[],target:'source-atlas',config:{sourceAtlasMerge:false}});assert.ok(noMerge.ok,noMerge.error);assert.equal(noMerge.snapshot.packed.length,12);checks++;
 assert.ok(noMerge.snapshot.areaAudit.islands.every(i=>Math.abs(i.densityRatio-1)<1e-8));checks++;
 const restored=await run({mesh,edges:[],target:'source'});assert.ok(restored.ok);assert.deepEqual(restored.snapshot.packed,raw.snapshot.packed);checks++;
 assert.deepEqual(mesh,original);checks++;
 const bad=structuredClone(mesh);bad.faces[0].uvs=[[0,0],[0,0],[0,0]];
 const repaired=await run({mesh:bad,edges:[],target:'source-atlas'});assert.ok(repaired.ok,repaired.error);assert.equal(repaired.snapshot.repair.repaired,1);checks++;
 const failure=await run({mesh:bad,edges:[],target:'source-atlas',config:{sourceRepairPolicy:'reject'}});assert.equal(failure.ok,false);assert.match(failure.error,/内部/);checks++;
 const stopped=await run({mesh,edges:[],target:'source-atlas',config:{timeBudgetMs:1}});assert.equal(stopped.ok,false);assert.equal(stopped.code,'timeout');checks++;
 console.log(`${checks} production source-atlas Worker checks passed: 12 raw overlaps -> 2 validated islands; original UV and mesh preserved; repack-only stays 12; invalid source locally repaired, strict rejection and timeout retained.`);
}finally{await c.cleanup();}
