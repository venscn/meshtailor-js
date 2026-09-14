import assert from 'node:assert/strict';import{Worker}from'node:worker_threads';import{join}from'node:path';import{pathToFileURL}from'node:url';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
function job(file,input){return new Promise((resolve,reject)=>{
 const url=pathToFileURL(join(c.output,file)).href,w=new Worker(`const{parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(d,o)=>parentPort.postMessage(d,o?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
 const timer=setTimeout(()=>{w.terminate();reject(Error('Worker test deadline'));},30000),fail=e=>{clearTimeout(timer);w.terminate();reject(e);};w.on('error',fail);
 w.on('message',d=>{if(d.ready){w.postMessage(input);return;}if(d.type==='progress')return;clearTimeout(timer);w.terminate();if(!d.ok)reject(Error(d.error));else resolve(d);});
 });}
try{
 const policy=await c.load('apps/studio/src/unfold/preview-policy.js'),core=await c.load('packages/mesh-core/src/index.js');
 const full=new Set(['0:1','1:2']),partial=new Set(['0:1']);assert.equal(policy.previewEdges('generated',full,partial),full);checks++;
 assert.equal(policy.previewEdges('generated',full,partial,true),partial);checks++;
 assert.equal(policy.previewEdges('source',full,partial).size,0);checks++;
 assert.equal(policy.previewEdges('source',full,partial),policy.previewEdges('source',full,new Set()));checks++;
 assert.equal(policy.seamTarget('uv-seams'),'source');checks++;for(const k of ['baseline','auto-large','auto-balanced'])assert.equal(policy.seamTarget(k),'generated');checks++;
 const mesh=core.makeComplexExample('gear','medium'),uv=await c.load('packages/uv/src/index.js');
 const auto=await job('apps/studio/src/workers/seam.worker.js',{kind:'auto-large',mesh});assert.equal(auto.parameters.chartPolicy,'large');assert.ok(auto.parameters.maxChartFaces>2048);checks++;
 assert.equal(auto.parameters.minFill,0);assert.ok(auto.regionCount>0);checks++;
 const generated=await job('apps/studio/src/workers/uv.worker.js',{mesh,edges:auto.edges,target:'generated',config:auto.parameters});assert.ok(generated.snapshot.packed.length<=6);checks++;
 const source=await job('apps/studio/src/workers/seam.worker.js',{kind:'uv-seams',mesh});const original=await job('apps/studio/src/workers/uv.worker.js',{mesh,edges:source.edges,target:policy.seamTarget('uv-seams')});
 assert.equal(original.snapshot.packed.length,1);checks++;
 assert.equal(original.snapshot.addedSeams,undefined);checks++;
 for(const chart of original.snapshot.packed)for(const [fi,uvs]of chart.faceUVs)assert.deepEqual(uvs,mesh.faces[fi].uvs);checks++;
 assert.ok(uv.recommendUnwrap(mesh).analysis.components>=1);checks++;
 console.log(`${checks} preview/source/automatic-worker checks passed.`);
}finally{await c.cleanup();}
