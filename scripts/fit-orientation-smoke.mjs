import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),morph=await c.load('packages/uv/src/planar-morph.js');
 const p=[[0,0],[2,0],[.2,1]],q=p.map(([x,y])=>[-x,-y]),coeff=morph.triangleMorph(p,q);assert.ok(coeff.unsafeLinear);checks++;
 for(let i=0;i<=100;i++){const a=p.map(([x,y])=>morph.morphPoint(x,y,coeff.coefficients,0,i/100));assert.ok(uv.signedArea2(...a)>1.99);}checks++;
 assert.equal(morph.triangleMorph(p,p.map(([x,y])=>[x,-y])),null);checks++;
 for(const id of ['gear','knot','garment','assembly']){
  const mesh=core.makeComplexExample(id,'low'),before=JSON.stringify(mesh),r=uv.unwrapMesh(mesh,new Set()),g=uv.buildUnfoldGeometry(mesh,r.packed,new Set(r.seams));
  for(const island of g.islands)for(let j=0;j<=24;j++){
   const o=uv.writeUnfoldPositions(g,{progress:.8+j*.005,holdNet:true,selected:[island.id],order:'sequential',path:'hinge',separation:.6});
   for(const fi of island.faces){const k=fi*9;assert.ok((o[k+3]-o[k])*(o[k+7]-o[k+1])-(o[k+4]-o[k+1])*(o[k+6]-o[k])>0,`${id}, face ${fi}, step ${j}`);}
  }checks++;
  const opts={progress:1,selected:g.islands.map(i=>i.id),order:'sequential',path:'hinge',separation:.6};assert.deepEqual(uv.writeUnfoldPositions(g,opts),g.target);checks++;
  assert.equal(JSON.stringify(mesh),before);checks++;
  if(id==='knot'||id==='assembly'){assert.ok(g.hinge.islands.some(i=>i.rotationFit));assert.ok(g.hinge.temporaryCuts.length);checks++;}
  console.log(id,'positive areas throughout UV fit; polar islands',g.hinge.islands.filter(i=>i.rotationFit).length);
 }
 console.log(`${checks} rotation-safe fitting checks passed.`);
}finally{await c.cleanup();}
