import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const core=await c.load('packages/mesh-core/src/index.js');
 for(const id of core.COMPLEX_EXAMPLES.map(x=>x.id)){
  const mesh=core.makeComplexExample(id,'low'),before=JSON.stringify(mesh),rec=core.recommendRegions(mesh),r=core.segmentMeshRegions(mesh,rec.options),top=core.buildTopology(mesh);
  const all=r.regions.flat();assert.equal(all.length,mesh.faces.length);assert.equal(new Set(all).size,mesh.faces.length);checks++;
  for(const faces of r.regions){const allowed=new Set(faces),seen=new Set([faces[0]]),q=[faces[0]];for(let h=0;h<q.length;h++)for(const f of top.faceNeighbors[q[h]]??[])if(allowed.has(f)&&!seen.has(f)){seen.add(f);q.push(f);}assert.equal(seen.size,faces.length);}
  checks++;assert.equal(JSON.stringify(mesh),before);checks++;
  assert.deepEqual(core.segmentMeshRegions(mesh,rec.options).regions,r.regions);checks++;
  const scaled={...mesh,positions:mesh.positions.map(p=>p.map(x=>x*17.3+123))};assert.deepEqual(core.segmentMeshRegions(scaled,core.recommendRegions(scaled).options).regions,r.regions);checks++;
  assert.ok(r.regions.length<40,`${id}: ${r.regions.length}`);checks++;
  console.log(id,{faces:mesh.faces.length,regions:r.regions.length,merged:r.mergedRegions,sizes:r.regions.map(r=>r.length)});
 }
 const mesh=core.makeComplexExample('gear','low'),o=core.recommendRegions(mesh).options,t=core.buildTopology(mesh),protectedEdges=new Set(t.edges.keys());
 const r=core.segmentMeshRegions(mesh,o,protectedEdges);assert.equal(r.regions.length,mesh.faces.length);checks++;
 assert.throws(()=>core.segmentMeshRegions(mesh,{...o,normalConeDegrees:NaN}));checks++;
 assert.throws(()=>core.segmentMeshRegions(mesh,o,new Set(),undefined,()=>{throw Error('cancel');}),/cancel/);checks++;
 console.log(`${checks} connected-region checks passed.`);
}finally{await c.cleanup();}
