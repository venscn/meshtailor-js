/** Compare the actual generated result, not visible outlines. Synthetic assets only. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'Connected-first plus validated stitching: procedural LOW benchmarks (not remote assets)',cases:[]};
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js');
 for(const id of ['gear','garment','knot','assembly']){
   const mesh=core.makeComplexExample(id,'low'),original=JSON.stringify(mesh),opts=uv.recommendUnwrap(mesh).options,t0=performance.now();
   const old=uv.unwrapMesh(mesh,new Set(),opts);const oldMs=performance.now()-t0,t1=performance.now();
   const current=uv.unwrapMesh(mesh,new Set(),{...opts,initialSegmentation:'connected',postMerge:true});
   const currentMs=performance.now()-t1,seen=current.packed.flatMap(c=>[...c.faceUVs.keys()]);
   assert.equal(new Set(seen).size,mesh.faces.length);assert.equal(seen.length,mesh.faces.length);assert.equal(JSON.stringify(mesh),original);
   for(const c of current.packed)assert.ok(uv.checkUVTriangles([...c.faceUVs.values()]).valid);
   assert.ok(uv.checkUVTriangles(current.packed.flatMap(c=>[...c.faceUVs.values()])).valid);
   const reread=core.parseOBJ(core.meshToOBJ(uv.meshWithPreviewUV(mesh,current.packed))),seam=await c.load('packages/chaining-seams/src/index.js');
   assert.equal(uv.buildCharts(reread,seam.extractSeamEdgesFromUV(reread)).length,current.packed.length);
   const item={id,faces:mesh.faces.length,oldIslands:old.packed.length,newIslands:current.packed.length,initialRegions:current.fragmentation.initialCharts,beforeMerge:current.merge.before,merges:current.merge.accepted,attempts:current.merge.attempts,budgetExhausted:current.merge.budgetExhausted,rejectionReasons:current.merge.reasons,occupancy:current.occupancy,oldMs,currentMs,allFacesAndValidUV:true};report.cases.push(item);console.log(item);
 }
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');
}finally{await c.cleanup();}
