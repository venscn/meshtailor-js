/** Default source-atlas regressions, not just a no-source generated-path test. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];
const arg=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1]};
const out=arg('--out','validation/v0.4.19/source-features');await mkdir(out,{recursive:true});
try {
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),chain=await c.load('packages/chaining-seams/src/index.js'),pipe=await c.load('apps/studio/src/unfold/load-pipeline.js');
 const test=(name,fn)=>{const detail=fn();cases.push({name,passed:true,detail});console.log('PASS',name,detail??'');};
 const source=mesh=>{const edges=chain.extractSeamEdgesFromUV(mesh);return{edges,seed:uv.sourceUVPreview(mesh,uv.buildCharts(mesh,edges))};};
 const organize=(mesh,extra={})=>{const {edges,seed}=source(mesh);return uv.postprocessUV(mesh,seed,edges,'source-atlas',{...uv.recommendUnwrap(mesh).options,...extra});};
 const verify=(mesh,result)=>{
  const ids=result.packed.flatMap(c=>[...c.faceUVs.keys()]);assert.equal(ids.length,mesh.faces.length);assert.equal(new Set(ids).size,mesh.faces.length);
  assert.ok(uv.checkUVTriangles(result.packed.flatMap(c=>[...c.faceUVs.values()])).valid);
  const exported=uv.meshWithPreviewUV(mesh,result.packed),read=core.parseOBJ(core.meshToOBJ(exported));
  assert.equal(read.faces.length,mesh.faces.length);assert.equal(uv.buildCharts(read,chain.extractSeamEdgesFromUV(read)).length,result.packed.length);
  return{islands:result.packed.length,faces:ids.length,occupancy:result.occupancy};
 };
 const planar=(mesh,result,expected=2)=>{
  const ds=result.diagnostics.filter(d=>d.method==='planar-shape');assert.equal(ds.length,expected);
  for(const d of ds){
   const p=result.packed.find(c=>c.id===d.id),ratios=[];
   for(const [fi,t]of p.faceUVs){const v=mesh.faces[fi].vertices.map(i=>mesh.positions[i]);for(let k=0;k<3;k++)ratios.push(Math.hypot(...t[k].map((x,j)=>x-t[(k+1)%3][j]))/Math.hypot(...v[k].map((x,j)=>x-v[(k+1)%3][j])));}
   assert.ok(Math.max(...ratios)/Math.min(...ratios)<1+1e-7,'Planar face must be an exact similarity, not rectangularized');
   const local=uv.cutLocalMesh(mesh,[...p.faceUVs.keys()],new Set());assert.equal(local.boundaryLoops,2,'Original centre hole must survive');
  }
 };
 const mesh=core.makeComplexExample('gear','low'),before=JSON.stringify(mesh),s=source(mesh);
 test('Default load route really is source-atlas, not generated',()=>{assert.equal(pipe.resolveLoadPipeline(mesh,pipe.DEFAULT_LOAD_PIPELINE).target,'source-atlas');assert.equal(s.seed.length,1);const q=uv.checkUVTriangles([...s.seed[0].faceUVs.values()]);assert.equal(q.overlaps,0);assert.equal(q.degenerate,0);assert.ok(q.flipped===0||q.flipped===q.triangles);return{sourceIslands:1,sourceBoundingBox:s.seed[0].bounds};});
 const r=organize(mesh);
 test('Default organized source preserves both tooth silhouettes and holes',()=>{assert.equal(r.features.changedCharts,1);assert.equal(r.features.detectedPanels,2);assert.ok(r.packed.length>1&&r.packed.length<=8);planar(mesh,r);return verify(mesh,r);});
 test('Source coordinates and geometry are not mutated',()=>assert.equal(JSON.stringify(mesh),before));
 for(const detail of ['medium','high'])test(detail+' density keeps both complete planar features',()=>{const m=core.makeComplexExample('gear',detail),r=organize(m);planar(m,r);assert.ok(r.packed.length<=8);return verify(m,r);});
 test('Production detection has no dependency on model name',()=>{const same=organize({...mesh,name:'opaque arbitrary object'});assert.deepEqual(same.packed,r.packed);assert.deepEqual(same.features,r.features);});
 test('Geometry rotation, scale and translation do not erase planar recognition',()=>{
  const a=.73,b=.41,m={...mesh,name:'transformed',positions:mesh.positions.map(([x,y,z])=>{const X=x*Math.cos(a)-z*Math.sin(a),Z=x*Math.sin(a)+z*Math.cos(a);return[3*X+4,3*(y*Math.cos(b)-Z*Math.sin(b))-2,3*(y*Math.sin(b)+Z*Math.cos(b))+9];})};
  const r=organize(m);planar(m,r);return verify(m,r);
 });
 test('OBJ round-trip also takes the corrected source-atlas route',()=>{const m=core.parseOBJ(core.meshToOBJ(mesh)),r=organize(m);planar(m,r);return verify(m,r);});
 test('Inspect and preserve-source switches keep the original rectangular UV deliberately',()=>{const r=organize(mesh,{sourceFeaturePolicy:'preserve'});assert.equal(r.packed.length,1);assert.equal(r.features,undefined);assert.equal(source(mesh).seed.length,1);});
 test('Legacy compact objective is not silently replaced',()=>{const r=organize(mesh,{uvObjective:'compact'});assert.equal(r.features,undefined);assert.equal(r.packed.length,1);});
 test('Disabling stitching or band templates does NOT disable feature inspection',()=>{const r=organize(mesh,{sourceAtlasMerge:false,structureTemplates:false});planar(mesh,r);return verify(mesh,r);});
 test('Explicit repack changes placement only, not the whole rectangular source chart',()=>{const r=uv.postprocessUV(mesh,s.seed,s.edges,'repack');assert.equal(r.packed.length,1);assert.equal(r.features,undefined);});
 test('Disabling auto-cut explicitly opts out of structural correction',()=>{const r=organize(mesh,{autoCut:false});assert.equal(r.packed.length,1);});
 const fs=r.packed.find(p=>r.diagnostics.find(d=>d.id===p.id)?.method==='planar-shape');
 const flat={...mesh,name:'independent annular plate',faces:[...fs.faceUVs.keys()].map(f=>mesh.faces[f])};
 test('A standalone planar annulus with unrolled source UV is repaired too',()=>{const r=organize(flat);assert.equal(r.features.changedCharts,1);planar(flat,r,1);return verify(flat,r);});
 const correctFlat={...mesh,name:'already meaningful UV',faces:[...fs.faceUVs].map(([f,uvs])=>({...mesh.faces[f],uvs}))};
 test('Already meaningful planar UV is NOT unnecessarily re-solved',()=>{const r=organize(correctFlat);assert.equal(r.features.changedCharts,0);assert.equal(r.packed.length,1);assert.equal(r.diagnostics[0].method,'source-shape');});
 // Same construction family without teeth, concentric circular cross-sections,
 // or symmetry: variable-radius annular plate with beveled thickness.
 const generic={...mesh,name:'unseen lobed housing',positions:mesh.positions.map(([x,y,z])=>{const a=Math.atan2(z,x),r=Math.hypot(x,z),k=1+.13*Math.sin(a*3)+.07*Math.cos(a*5);return[x*k*.9,y*1.3,z*k*1.15];})};
 test('Asymmetric non-gear shape also retains both concave annular panels',()=>{const r=organize(generic);planar(generic,r);return verify(generic,r);});
 test('A rectangular UV on a genuinely planar rectangle remains a rectangle',()=>{const m={name:'flat panel',positions:[[0,0,0],[2,0,0],[2,1,0],[0,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[1,0],[1,.5]]},{vertices:[0,2,3],uvs:[[0,0],[1,.5],[0,.5]]}]};assert.equal(organize(m).features.changedCharts,0);});
 test('New feature boundaries prevent later stitching from swallowing the panels',()=>{const n=uv.postprocessUV(mesh,r.packed,new Set(r.seams),'stitch',{mergeOptions:{protectedSeams:r.features.protectedSeams}});const kept=uv.carrySourceFeatures(r.features,n.packed);assert.equal(kept.regions.length,r.features.regions.length);for(const g of kept.regions)assert.ok(g.charts.length);return verify(mesh,n);});
 test('Invalid feature tolerance and policy are rejected',()=>{assert.throws(()=>organize(mesh,{sourceFeatureTolerance:.5}),/feature/);assert.throws(()=>organize(mesh,{sourceFeaturePolicy:'bogus'}),/feature/);});
 test('Cancel aborts structural correction without mutating the source',()=>{assert.throws(()=>uv.postprocessUV(mesh,s.seed,s.edges,'source-atlas',{}, {check(){throw new uv.UVWorkStopped('cancelled')},report(){}}),/cancelled/);assert.equal(JSON.stringify(mesh),before);});
 await writeFile(out+'/gear-before.obj',core.meshToOBJ(mesh));await writeFile(out+'/gear-after.obj',core.meshToOBJ(uv.meshWithPreviewUV(mesh,r.packed)));
 await writeFile(out+'/report.json',JSON.stringify({passed:cases.length,cases,features:r.features,diagnostics:r.diagnostics},null,2));
} finally {await c.cleanup()}
