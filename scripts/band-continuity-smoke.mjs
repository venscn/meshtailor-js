import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-band-continuity';
await mkdir(out,{recursive:true});const c=await compileCore(),tests=[];
const test=(name,fn)=>{const detail=fn();tests.push({name,detail,passed:true});console.log('PASS',name);};
try {
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 const guard=await c.load('packages/uv/src/boundary-guard.js');
 const mesh=core.geometryOnlyMesh((await loadVerifiedFixture(core,'examples/verified-models','Corset',{geometryOnly:true})).mesh);
 // A fixture selector for QA only. The production code sees no counts, names,
 // authored cuts or UVs. Inspect both actual complete shoulder components.
 const components=uv.buildCharts(mesh,new Set()).filter(g=>g.faces.length===288&&g.faces.every(f=>mesh.faces[f].vertices.every(v=>mesh.positions[v][1]>.04&&mesh.positions[v][1]<.05)));
 assert.equal(components.length,2);const start=JSON.stringify(mesh),total=mesh.faces.reduce((s,f)=>s+uv.triangleArea(...f.vertices.map(v=>mesh.positions[v])),0);
 for(const [i,co] of components.entries()){
  const options={...uv.geometryGenerationOptions(mesh),humanTemplates:{panels:'auto',minAreaFraction:0}};let single;
  test(`Shoulder ${i+1}: default one opening keeps all 288 faces`,()=>{single=uv.unfoldBand(mesh,co.faces,0,new Set(),options,total);assert.ok(single.raw,JSON.stringify(single));assert.equal(single.raw.length,1);assert.equal(single.raw[0].faceUVs.size,288);assert.equal(single.entry.requestedPanels,'auto');assert.equal(single.entry.autoAttempts.length,1);assert.equal(single.entry.reason,'whole-band-one-opening');assert.ok(single.entry.maxAnisotropy<2.1);return {panels:1,maxStretch:single.entry.maxAnisotropy};});
  test(`Shoulder ${i+1}: explicit two panels remain available`,()=>{const r=uv.unfoldBand(mesh,co.faces,0,new Set(),{...options,humanTemplates:{panels:2,minAreaFraction:0}},total);assert.equal(r.raw?.length,2);assert.equal(r.entry.requestedPanels,2);assert.equal(r.raw.reduce((s,x)=>s+x.faceUVs.size,0),288);});
  test(`Shoulder ${i+1}: source fields are never read`,()=>{const p={...mesh,name:'anonymous',faces:mesh.faces.map(f=>({vertices:f.vertices,get uvs(){throw Error('SOURCE UV');},get uvIndices(){throw Error('SOURCE UV INDEX');}}))};const r=uv.unfoldBand(p,co.faces,0,new Set(),options,total);assert.deepEqual(r.raw,single.raw);assert.deepEqual(r.seams,single.seams);});
  test(`Shoulder ${i+1}: all actual triangles and cut boundary valid`,()=>{const local=uv.cutLocalMesh(mesh,co.faces,single.seams),uvs=[];for(let j=0;j<local.sourceFaces.length;j++)local.triangles[j].forEach((v,k)=>{const q=single.raw[0].faceUVs.get(local.sourceFaces[j])[k];if(uvs[v])assert.ok(Math.hypot(...q.map((x,k)=>x-uvs[v][k]))<1e-9);uvs[v]=q;});assert.ok(local.disk);assert.ok(uv.checkUVTriangles([...single.raw[0].faceUVs.values()]).valid);assert.ok(guard.simpleUVBoundary(uvs,local.boundaries));});
  test(`Shoulder ${i+1}: face budget records necessary parallel cuts`,()=>{const r=uv.unfoldBand(mesh,co.faces,0,new Set(),{...options,maxChartFaces:144},total);assert.equal(r.raw?.length,2);assert.equal(r.entry.budgetExpanded,true);assert.equal(r.entry.reason,'continuity-first-per-panel-budget');});
 }
 test('Input geometry is unchanged',()=>assert.equal(JSON.stringify(mesh),start));
 test('Automatic is a validated setting, not an undefined numeric value',()=>{assert.equal(uv.humanOptions().panels,'auto');assert.throws(()=>uv.humanOptions({panels:'all'}));});
 test('Cancellation cannot be swallowed by the second candidate',()=>{assert.throws(()=>uv.unfoldBand(mesh,components[0].faces,0,new Set(),uv.geometryGenerationOptions(mesh),total,{check(){throw new uv.UVWorkStopped('cancel');},report(){}}),/cancel/);});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));
}finally{await c.cleanup();}
