/** No downloads: deterministic fragmented-atlas regression, not the FlightHelmet asset. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'Large fragmented atlas',cases:[]};
try{
 const uv=await c.load('packages/uv/src/index.js');let seed=42;
 const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 const raw=Array.from({length:2000},(_,id)=>{const w=.01+random()*.1,h=.01+random()*.1;return{id,area3D:w*h,faceUVs:new Map([[2*id,[[0,0],[w,0],[w,h]]],[2*id+1,[[0,0],[w,h],[0,h]]]])};});
 const start=performance.now(),r=uv.packAtlas(raw),elapsedMs=performance.now()-start;
 assert.equal(r.packed.length,2000);assert.equal(r.packingMethod,'shelf');assert.ok(r.occupancy>0&&r.occupancy<=1);
 report.cases.push({name:'2000 islands use bounded shelf path and cover every chart',passed:true,elapsedMs,occupancy:r.occupancy});
 for(let i=0;i<r.packed.length;i++){
   const ch=r.packed[i],q=uv.checkUVTriangles([...ch.faceUVs.values()]);assert.ok(q.valid);assert.equal(ch.faceUVs.size,2);
   assert.ok(Math.abs(q.area/raw[i].area3D-r.scale*r.scale)<1e-9);
   assert.ok(ch.bounds[0]>=r.padding-1e-9&&ch.bounds[1]>=r.padding-1e-9&&ch.bounds[2]<=1-r.padding+1e-9&&ch.bounds[3]<=1-r.padding+1e-9);
   for(let j=0;j<i;j++){const a=ch.bounds,b=r.packed[j].bounds;
     const separated=a[0]-b[2]>=2*r.padding-1e-9||b[0]-a[2]>=2*r.padding-1e-9||a[1]-b[3]>=2*r.padding-1e-9||b[1]-a[3]>=2*r.padding-1e-9;
     assert.ok(separated,`Padding/overlap at ${i}/${j}`);
   }
 }
 report.cases.push({name:'All triangles valid; no overlapping boxes; gutters and equal texel density preserved',passed:true});
 assert.deepEqual(uv.packAtlas(raw).packed,r.packed);report.cases.push({name:'Packing deterministic',passed:true});
 assert.equal(uv.packAtlas(raw.slice(0,3)).packingMethod,'maxrects');
 assert.equal(uv.packAtlas(raw.slice(0,3),{packing:'shelf'}).packingMethod,'shelf');
 report.cases.push({name:'Small atlas keeps MaxRects and explicit shelf is selectable',passed:true});
 assert.throws(()=>uv.packAtlas(raw,{packing:'maxrects'}),/1024/);
 assert.throws(()=>uv.packAtlas(raw,{padding:.05}),/padding alone/);
 assert.throws(()=>uv.packAtlas(raw,{packing:'bad'}),/method/);
 assert.throws(()=>uv.packAtlas([raw[0],raw[0]]),/Duplicate/);
 report.cases.push({name:'Oversized expensive mode, impossible padding and malformed options fail explicitly',passed:true});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await c.cleanup();}
