/** Full-size synthetic regression, NOT the remotely hosted FlightHelmet binary. */
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'90112-face synthetic mesh in production UV Worker',cases:[]};
const run=job=>new Promise((resolve,reject)=>{
 const events=[],url=pathToFileURL(join(c.output,'apps/studio/src/workers/uv.worker.js')).href,start=performance.now();
 const w=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(d,o)=>parentPort.postMessage(d,o?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
 const timer=setTimeout(()=>{void w.terminate();reject(Error('test deadline: 90 seconds'));},90000);
 w.on('error',e=>{clearTimeout(timer);void w.terminate();reject(e);});
 w.on('message',data=>{if(data.ready){w.postMessage(job);return;}if(data.type==='progress'){events.push(data.progress);return;}clearTimeout(timer);void w.terminate();resolve({data,events,wallMs:performance.now()-start});});
});
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 const mesh=core.makeComplexExample('assembly','high');assert.equal(mesh.faces.length,90112);
 for(const target of ['generated','source']){
   const r=await run({mesh,edges:[],target});assert.equal(r.data.ok,true,r.data.error);const s=r.data.snapshot;
   assert.equal(s.geometry.target.length,mesh.faces.length*9);assert.equal(s.geometry.source.length,mesh.faces.length*9);assert.equal(s.geometry.hinge.parent.length,mesh.faces.length);
   const covered=new Set();for(const ch of s.packed)for(const fi of ch.faceUVs.keys()){assert.ok(!covered.has(fi));covered.add(fi);}assert.equal(covered.size,mesh.faces.length);
   assert.ok(s.geometry.target.every(Number.isFinite));assert.ok(r.events.length>=2);
   const counts=r.events.map(p=>p.facesDone??0);assert.ok(counts.every((n,i)=>!i||n>=counts[i-1]));
   if(target==='generated'){
     assert.ok(s.metrics.validated);assert.equal(s.metrics.packingMethod,s.packed.length>256?'shelf':'maxrects');
     for(const ch of s.packed)assert.ok(uv.checkUVTriangles([...ch.faceUVs.values()]).valid);
   }else for(const ch of s.packed)for(const [fi,coords]of ch.faceUVs)assert.deepEqual(coords,mesh.faces[fi].uvs);
   report.cases.push({name:`${target}: all 90112 faces, real progress, UV and hinge rig preserved`,passed:true,wallMs:r.wallMs,islands:s.packed.length,progressMessages:r.events.length,timing:s.timing,packing:s.metrics?.packingMethod,occupancy:s.metrics?.occupancy});
 }
 const t=await run({mesh,edges:[],target:'generated',config:{timeBudgetMs:1}});
 assert.equal(t.data.ok,false);assert.equal(t.data.code,'timeout');assert.equal(t.data.snapshot,undefined);
 report.cases.push({name:'Real Worker budget exhaustion is a timeout, never a partial successful atlas',passed:true,error:t.data.error});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await c.cleanup();}
