import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[],models=[];
function test(name,f){const detail=f();cases.push({name,passed:true,detail});console.log('PASS',name,detail??'');}
function patch(name,fn,n=14,m=10){const mesh={name,positions:[],faces:[]};for(let j=0;j<=m;j++)for(let i=0;i<=n;i++)mesh.positions.push(fn(i/n,j/m));for(let j=0;j<m;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,d=a+n+1,e=d+1;mesh.faces.push({vertices:[a,b,e]},{vertices:[a,e,d]});}return mesh;}
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 const options={initialSegmentation:'hierarchical',peelSourceHints:false,structureTemplates:false,postMerge:false};
 const meshes=[
  patch('variable saddle',(u,v)=>[u*2-1,v*2-1,.3*Math.sin(u*5)*Math.cos(v*3)]),
  patch('folded S curtain',(u,v)=>[Math.sin(u*4.5),Math.cos(u*4.5),v*(1+.2*Math.cos(u*8))]),
  patch('twisted noncircular ribbon',(u,v)=>{const a=u*2.9,w=(v-.5)*(.3+.25*u);return[u*2,w*Math.cos(a),w*Math.sin(a)];}),
  patch('asymmetric dome',(u,v)=>{const a=(u-.5)*2,b=(v-.5)*2;return[a,b,.6*Math.exp(-a*a-b*b)];}),
  core.makeComplexExample('gear','low'),
 ];
 for(const mesh of meshes)test(mesh.name+' uses geometry-only groups and bounded peel feedback',()=>{
   const before=JSON.stringify(mesh),t=performance.now(),r=uv.unwrapMesh(mesh,new Set(),options),fs=r.packed.flatMap(c=>[...c.faceUVs.keys()]);
   assert.equal(fs.length,mesh.faces.length);assert.equal(new Set(fs).size,mesh.faces.length);assert.equal(JSON.stringify(mesh),before);assert.ok(uv.checkUVTriangles(r.packed.flatMap(p=>[...p.faceUVs.values()])).valid);assert.ok(r.diagnostics.every(d=>d.method!=='tutte'));assert.equal(r.peel.sourceHintCharts,0);assert.ok(r.packed.length<=12,'No normal-cone shards');
   for(const g of r.peel.groups){const set=new Set(g.faces);assert.ok(g.charts.length);for(const id of g.charts)assert.ok([...r.packed.find(p=>p.id===id).faceUVs.keys()].every(f=>set.has(f)),'Group boundaries cannot be swallowed');}
   const d={name:mesh.name,groups:r.peel.groups.length,islands:r.packed.length,faces:fs.length,feedback:r.peel.feedbackSplits,occupancy:r.occupancy,elapsedMs:performance.now()-t};models.push(d);return d;
 });
 test('Large opposing surfaces use at most two coarse panels, never per-tooth shards',()=>{const g=uv.planSurfaceGroups(meshes[4],new Set());assert.equal(g.report.groups.filter(p=>p.kind==='planar-feature').length,2);assert.equal(g.report.groups.length,6);assert.ok(g.report.groups.filter(p=>p.kind==='oriented-panel').every(p=>p.faces.length>=16));const disabled=uv.planSurfaceGroups(meshes[4],new Set(),{peelOrientationPanels:false});assert.equal(disabled.report.groups.length,4);});
 test('Geometry is independent of model name',()=>{const a=uv.planSurfaceGroups(meshes[4],new Set()),b=uv.planSurfaceGroups({...meshes[4],name:'unseen opaque fixture'},new Set());assert.deepEqual(a.report,b.report);});
 test('Gear face silhouette is a similarity of its real planar surface',()=>{const r=uv.unwrapMesh(meshes[4],new Set(),options),ps=r.diagnostics.filter(d=>d.method==='planar-shape');assert.equal(ps.length,2);for(const d of ps){let ratios=[];for(const [fi,t] of r.packed.find(p=>p.id===d.id).faceUVs){const v=meshes[4].faces[fi].vertices.map(i=>meshes[4].positions[i]);for(let k=0;k<3;k++)ratios.push(Math.hypot(...t[k].map((x,j)=>x-t[(k+1)%3][j]))/Math.hypot(...v[k].map((x,j)=>x-v[(k+1)%3][j])));}assert.ok(Math.max(...ratios)/Math.min(...ratios)<1+1e-8);}});
 const mesh=meshes[0],top=core.buildTopology(mesh),faces=mesh.faces.map((_,i)=>i),parts=uv.bisectSurface(mesh,faces,new Set(),top);
 test('Failure feedback produces two connected regions, not many face-normal bins',()=>{assert.equal(parts.length,2);assert.equal(new Set(parts.flat()).size,faces.length);for(const p of parts)assert.equal(uv.buildCharts({...mesh,faces:p.map(f=>mesh.faces[f])},new Set()).length,1);});
 test('Small dense disconnected objects stay whole spatial groups',()=>{const small=patch('dense miniature',(u,v)=>[u*.001,v*.001,.0001*Math.sin(u*4)],30,30),large=patch('large panel',(u,v)=>[u+3,v,0],3,3),mixed={name:'size-not-face-count',positions:[...small.positions,...large.positions],faces:[...small.faces,...large.faces.map(f=>({vertices:f.vertices.map(v=>v+small.positions.length)}))]},p=uv.planSurfaceGroups(mixed,new Set());assert.equal(p.report.groups.length,2);assert.ok(p.report.groups.some(g=>g.faces.length===1800));});
 test('Explicit user group seams are preserved by subsequent solving',()=>{const edges=new Set();for(const [key,e]of top.edges)if(e.faces.length===2&&mesh.positions[e.a][0]===0&&mesh.positions[e.b][0]===0)edges.add(key);const r=uv.unwrapMesh(mesh,edges,options);assert.ok([...edges].every(e=>r.seams.includes(e)));assert.ok(r.peel.groups.length>=2);});
 test('Malformed limits rejected; cancellation propagated',()=>{assert.throws(()=>uv.unwrapMesh(mesh,new Set(),{...options,peelFeatureArea:-1}),/peelFeature/);assert.throws(()=>uv.unwrapMesh(mesh,new Set(),{...options,peelMaxDepth:0}),/peelMaxDepth/);assert.throws(()=>uv.unwrapMesh(mesh,new Set(),options,{check(){throw new uv.UVWorkStopped('cancel')},report(){}}),/cancel/);});
 await mkdir('validation/v0.4.18/tests',{recursive:true});await writeFile('validation/v0.4.18/tests/peel.json',JSON.stringify({passed:cases.length,cases,models},null,2));
}finally{await c.cleanup()}
