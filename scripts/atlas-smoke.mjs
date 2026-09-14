import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();const results=[];
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),seam=await c.load('packages/chaining-seams/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const cases=[['cube',demo.makeUnfoldDemo().mesh,demo.makeUnfoldDemo().edges],['closed-cube',demo.makeUnfoldDemo().mesh,new Set()]];
 for(const id of core.COMPLEX_EXAMPLES.map(x=>x.id)){const m=core.makeComplexExample(id,'low');cases.push([id,m,seam.extractSeamEdgesFromUV(m)]);}
 for(const [name,mesh,edges] of cases){const start=performance.now();const r=uv.unwrapMesh(mesh,edges);let count=0;
   for(const ch of r.packed){count+=ch.faceUVs.size;const q=uv.checkUVTriangles([...ch.faceUVs.values()]);assert.ok(q.valid,`${name}: ${JSON.stringify(q)}`);for(const f of ch.faceUVs.values())for(const p of f)assert.ok(p.every(v=>v>=-1e-8&&v<=1+1e-8));}
   assert.equal(count,mesh.faces.length);assert.ok(r.occupancy>0&&r.occupancy<1.000001);for(const e of edges)assert.ok(r.seams.includes(e));
   for(let i=0;i<r.packed.length;i++)for(let j=0;j<i;j++){const a=r.packed[i].bounds,b=r.packed[j].bounds;assert.ok(Math.min(a[2],b[2])-Math.max(a[0],b[0])<=0||Math.min(a[3],b[3])-Math.max(a[1],b[1])<=0);}
   const d={name,faces:mesh.faces.length,islands:r.packed.length,occupancy:r.occupancy,addedSeams:r.addedSeams.length,methods:r.diagnostics.reduce((a,v)=>(a[v.method]=(a[v.method]??0)+1,a),{}),ms:performance.now()-start};results.push(d);console.log(d);
 }
 // Non-disk input must not be projected or auto-cut when the policy is strict.
 assert.throws(()=>uv.unwrapMesh(cases[1][1],new Set(),{autoCut:false}),/cuts/);
 // Mixed-size rectangles show packing by actual area, not one square cell per island.
 const shapes=[[2,1],[1,1],[1,.5],[.5,.5]],raw=shapes.map(([w,h],id)=>({id,area3D:w*h,faceUVs:new Map([[id*2,[[0,0],[w,0],[w,h]]],[id*2+1,[[0,0],[w,h],[0,h]]]])}));
 const packed=uv.packAtlas(raw,{padding:.001});assert.ok(packed.occupancy>.7);
 const densities=packed.packed.map((p,i)=>uv.checkUVTriangles([...p.faceUVs.values()]).area/raw[i].area3D);assert.ok(Math.max(...densities)-Math.min(...densities)<1e-10);
 console.log('PASS: area-aware packing and all complex LOW assets.');
 await writeFile('/mnt/data/atlas04-results.json',JSON.stringify(results,null,2));
}finally{await c.cleanup();}
