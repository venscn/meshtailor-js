import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let passed=0;const check=(name,f)=>{f();passed++;console.log('PASS',name);};
try{const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),seam=await c.load('packages/chaining-seams/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const {mesh,edges}=demo.makeHingeDemo();
 for(const [label,value]of [['NaN gutter',{padding:NaN}],['negative gutter',{padding:-1}],['unknown solver',{method:'fake'}],['zero iterations',{iterations:0}],['invalid boundary',{minFill:2}],['invalid budget',{maxChartFaces:Infinity}],['untyped autoCut',{autoCut:'false'}]])check('Reject '+label,()=>assert.throws(()=>uv.unwrapMesh(mesh,edges,value),/settings/));
 check('A 3D zero-area face errors without dropping geometry',()=>{const m=structuredClone(mesh);m.positions[m.faces[0].vertices[1]]=[...m.positions[m.faces[0].vertices[0]]];assert.throws(()=>uv.unwrapMesh(m,edges),/degenerate/);});
 check('Solving never mutates source coordinates or caller seams',()=>{const before=JSON.stringify(mesh),old=[...edges];uv.unwrapMesh(mesh,edges);assert.equal(JSON.stringify(mesh),before);assert.deepEqual([...edges],old);});
 check('Original coincident UV islands remain topologically separate after export',()=>{
  const m=demo.makeUnfoldDemo().mesh;
  // All six cube faces deliberately share the same [0,1]^2 coordinates.
  m.faces.forEach((f,i)=>{f.uvs=i%2?[[0,0],[1,1],[0,1]]:[[0,0],[1,0],[1,1]];f.uvIndices=f.uvs.map((p,k)=>Math.floor(i/2)*4+(i%2?[0,2,3]:[0,1,2])[k]);});
  const edges=seam.extractSeamEdgesFromUV(m),packed=uv.sourceUVPreview(m,uv.buildCharts(m,edges)),out=core.parseOBJ(core.meshToOBJ(uv.meshWithPreviewUV(m,packed)));
  assert.equal(uv.buildCharts(out,seam.extractSeamEdgesFromUV(out)).length,6);assert.deepEqual([...seam.extractSeamEdgesFromUV(out)].sort(),[...edges].sort());
 });
 check('Curved rigid net records explicit temporary cycle breaks',()=>{const m=core.makeComplexExample('knot','low'),r=uv.unwrapMesh(m,seam.extractSeamEdgesFromUV(m)),g=uv.buildUnfoldGeometry(m,r.packed,new Set(r.seams));assert.ok(g.hinge.temporaryCuts.length>0);const p=uv.writeUnfoldPositions(g,{progress:.75,selected:g.islands.map(x=>x.id),order:'together',path:'hinge',separation:.5});for(const i of g.islands){let lo=Infinity,hi=-Infinity;for(const f of i.faces)for(let k=0;k<3;k++){const z=p[f*9+k*3+2];lo=Math.min(lo,z);hi=Math.max(hi,z);}assert.ok(hi-lo<1e-5);}});
 console.log(`${passed} unwrap guard regressions passed.`);
}finally{await c.cleanup();}
