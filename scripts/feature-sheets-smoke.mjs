/** Geometry-only structural regression. No source texture coordinate is read. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-feature-sheets';
const c=await compileCore(),tests=[];
const test=(name,f)=>{const detail=f();tests.push({name,passed:true,detail});console.log('PASS',name,detail??'')};
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),sf=await c.load('packages/uv/src/sheet-features.js'),proj=await c.load('packages/uv/src/projection-seeds.js'),guard=await c.load('packages/uv/src/boundary-guard.js'),contract=await c.load('packages/uv/src/feature-contract.js');
 const reference=[[0,0],[4,0],[4,2],[0,2],[.4,.4],[.4,1.6],[1.6,1.6],[1.6,.4],[2.4,.4],[2.4,1.6],[3.6,1.6],[3.6,.4]],loops=[[0,1,2,3],[4,5,6,7],[8,9,10,11]];
 test('Feature contract removes only global similarity, not hole meaning',()=>{const p=reference.map(([x,y])=>[4-2*y,-3+2*x]),r=contract.featureContract(reference,p,loops);assert.ok(r.valid);assert.equal(r.holes,2);assert.ok(r.boundaryMax<1e-12)});
 test('Collapsed hole cannot pass landmark contract despite preserved vertex count',()=>{const p=reference.map(v=>v.slice());for(const i of loops[1])p[i]=p[i].map((v,k)=>1+(v-1)*.01);assert.equal(contract.featureContract(reference,p,loops).valid,false)});
 test('Translated eye hole cannot pass by a global fit',()=>{const p=reference.map(v=>v.slice());for(const i of loops[2])p[i][0]-=1.5;assert.equal(contract.featureContract(reference,p,loops).valid,false)});
 test('Reflection is not an accepted similarity',()=>assert.equal(contract.featureContract(reference,reference.map(([x,y])=>[-x,y]),loops).valid,false));
 test('Malformed/nonfinite landmark inputs fail closed',()=>{assert.equal(contract.featureContract(reference,[[0,NaN]],loops).valid,false);assert.equal(contract.featureContract(reference,reference,[]).valid,false)});

 function perforatedShell(holes=2){
  const nx=36,ny=16,positions=[],faces=[];
  for(let layer=0;layer<2;layer++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const a=x/nx*3-1.5,b=y/ny*1.6-.8;positions.push([a,b,.12*a*a-.08*b*b+(layer?.06:0)]);}
  const count=(nx+1)*(ny+1),edges=new Map();
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const inHole=Array.from({length:holes},(_,h)=>({lo:Math.round((h+1)*nx/(holes+1)-3),hi:Math.round((h+1)*nx/(holes+1)+3)})).some(r=>x>=r.lo&&x<r.hi&&y>=5&&y<11);if(inHole)continue;
   const a=y*(nx+1)+x,b=a+1,d=a+nx+1,e=d+1;
   for(const t of [[a,b,e],[a,e,d]]){faces.push({vertices:[t[0],t[2],t[1]]},{vertices:t.map(v=>v+count)});for(let k=0;k<3;k++){const key=core.edgeKey(t[k],t[(k+1)%3]);if(edges.has(key))edges.delete(key);else edges.set(key,[t[k],t[(k+1)%3]])}}
  }
  for(const[a,b]of edges.values())faces.push({vertices:[a,b,b+count]},{vertices:[a,b+count,a+count]});
  return{name:'unseen warped instrument panel',positions,faces};
 }
 for(const holes of [2,3])test('Unseen warped '+holes+'-hole shell uses the same geometric rule',()=>{
  const m=perforatedShell(holes),r=uv.unwrapMesh(m,new Set(),uv.geometryGenerationOptions(m)),ds=r.diagnostics.filter(d=>d.feature?.holes===holes);
  assert.ok(ds.length>=1);assert.ok(ds.every(d=>d.feature.valid));assert.equal(r.packed.reduce((s,c)=>s+c.faceUVs.size,0),m.faces.length);assert.ok(uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()])).valid);return{islands:r.packed.length,featureSheets:ds.length};
 });
 const loaded=await loadVerifiedFixture(core,c.root+'/examples/verified-models','FlightHelmet',{geometryOnly:true}),whole=core.geometryOnlyMesh(loaded.mesh);
 // QA selects the largest closed two-handle component geometrically. This is
 // NOT a production model name/ID branch and provides no authored cut lines.
 const comps=uv.buildCharts(whole,new Set());const component=comps.filter(g=>{const t=uv.cutLocalMesh(whole,g.faces,new Set());return t.manifold&&t.euler===-2&&t.boundaryLoops===0}).sort((a,b)=>b.faces.length-a.faces.length)[0];
 assert.equal(component.faces.length,2976);
 const mesh={name:'renamed perforated shell',positions:whole.positions,faces:component.faces.map(f=>whole.faces[f])};
 let baseline,features;
 test('Actual highlighted solid is genus two, not an already open two-hole sheet',()=>{const m=uv.cutLocalMesh(mesh,mesh.faces.map((_,i)=>i),new Set());assert.equal(m.euler,-2);assert.equal(m.boundaryLoops,0)});
 test('Finds a geometrically valid readable sheet before opening handle cuts',()=>{features=sf.findSheetFeatures(mesh,mesh.faces.map((_,i)=>i),new Set(),core.buildTopology(mesh));assert.equal(features.length,1);assert.equal(features[0].boundaryLoops,3);const f=features[0];assert.ok(f.regularization.accepted);assert.equal(f.regularization.afterTeeth,0);assert.ok(f.regularization.afterLength<f.regularization.beforeLength);const l=uv.cutLocalMesh(mesh,f.faces,new Set()),p=proj.projectFrame(l.positions,f.frame);assert.ok(guard.simpleUVBoundary(p,l.boundaries));assert.ok(uv.checkUVTriangles(l.triangles.map(t=>t.map(v=>p[v]))).valid);return{faces:f.faces.length,holes:2,regularization:f.regularization}});
 test('Complete solid unwrap preserves both eye holes in primary sheet and ALL return-wall faces',()=>{baseline=uv.unwrapMesh(mesh,new Set(),uv.geometryGenerationOptions(mesh));assert.equal(baseline.packed.length,2);const d=baseline.diagnostics.find(d=>d.method==='feature-constrained');assert.ok(d?.feature.valid);assert.equal(d.feature.holes,2);const all=baseline.packed.flatMap(p=>[...p.faceUVs.keys()]);assert.equal(new Set(all).size,2976);assert.equal(all.length,2976);assert.ok(uv.checkUVTriangles(baseline.packed.flatMap(c=>[...c.faceUVs.values()])).valid);return{islands:baseline.packed.length,feature:d.feature}});
 test('Actual packed output independently retains feature holes after transforms',()=>{const r=uv.validateFeatureOutput(mesh,baseline.packed,new Set(baseline.seams),baseline.peel);assert.equal(r.size,1);assert.equal([...r.values()][0].feature.holes,2)});
 test('Dropping a protected group face fails final output validation',()=>{const charts=baseline.packed.map(p=>({...p,faceUVs:new Map(p.faceUVs)})),fc=baseline.diagnostics.find(d=>d.method==='feature-constrained').id,c=charts.find(x=>x.id===fc);c.faceUVs.delete(c.faceUVs.keys().next().value);assert.throws(()=>uv.validateFeatureOutput(mesh,charts,new Set(baseline.seams),baseline.peel),/split or merged/)});
 test('Original UV getters cannot be read in grouping or generation',()=>{const poison={...mesh,faces:mesh.faces.map(f=>({...f,get uvs(){throw Error('source UV read')},get uvIndices(){throw Error('source UV index read')}}))};const r=uv.unwrapMesh(poison,new Set(),uv.geometryGenerationOptions(poison));assert.deepEqual(r.seams,baseline.seams);assert.deepEqual(r.packed,baseline.packed)});
 test('Renaming cannot change output',()=>{const r=uv.unwrapMesh({...mesh,name:'not a helmet'},new Set(),uv.geometryGenerationOptions(mesh));assert.deepEqual(r.packed,baseline.packed)});
 for(const scale of [.001,100])test('Rotated and scaled real geometry keeps a two-hole feature, scale '+scale,()=>{
  const a=.381,b=.674,m={...mesh,positions:mesh.positions.map(([x,y,z])=>{const q=x*Math.cos(a)-y*Math.sin(a),r=x*Math.sin(a)+y*Math.cos(a);return[scale*(q*Math.cos(b)-z*Math.sin(b))+3,scale*r-4,scale*(q*Math.sin(b)+z*Math.cos(b))+2]})};
  const r=uv.unwrapMesh(m,new Set(),uv.geometryGenerationOptions(m));const ds=r.diagnostics.filter(d=>d.method==='feature-constrained');assert.ok(ds.some(d=>d.feature?.holes===2&&d.feature.valid));assert.equal(r.packed.flatMap(c=>[...c.faceUVs.keys()]).length,2976);return{islands:r.packed.length};
 });
 test('Single-handle rings are not automatically divided into tiny front/return slivers',()=>{const g=comps.filter(g=>{const t=uv.cutLocalMesh(whole,g.faces,new Set());return t.euler===0&&t.boundaryLoops===0})[0];assert.deepEqual(sf.findSheetFeatures(whole,g.faces,new Set(),core.buildTopology(whole)),[])});
 test('Explicit hard seams remain in the generated output',()=>{const t=core.buildTopology(mesh),edge=[...t.edges].find(([k,e])=>e.faces.length===2)[0],r=uv.unwrapMesh(mesh,new Set([edge]),uv.geometryGenerationOptions(mesh));assert.ok(r.seams.includes(edge))});
 test('Cancellation propagates, never substituting source coordinates',()=>assert.throws(()=>sf.findSheetFeatures(mesh,component.faces.map((_,i)=>i),new Set(),core.buildTopology(mesh),{check(){throw Error('cancel feature')}}),/cancel/));
 for(const density of ['low','medium'])test('Gear planar silhouettes and holes survive: '+density,()=>{const gear=core.geometryOnlyMesh(core.makeComplexExample('gear',density)),r=uv.unwrapMesh(gear,new Set(),uv.geometryGenerationOptions(gear));assert.equal(r.packed.length,6);assert.equal(r.diagnostics.filter(d=>d.method==='planar-shape').length,2);assert.ok(uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()])).valid)});
 await mkdir(out,{recursive:true});await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));
}catch(error){await mkdir(out,{recursive:true});await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests,error:String(error.stack??error)},null,2));throw error;}finally{await c.cleanup()}
