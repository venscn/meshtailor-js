/** No original UV, no model-name gates. Exercise the path that used to skip a
 * known longitudinal cut because the unsplit parent exceeded a per-chart limit. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),tests=[]; const test=(name,fn)=>{const detail=fn();tests.push({name,passed:true,detail});console.log('PASS',name)};
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 for(const detail of ['low','medium']){
  const mesh=core.geometryOnlyMesh(core.makePleatedGarment(detail)),options=uv.geometryGenerationOptions(mesh);
  const baseline=JSON.stringify(mesh);let out;
  test(detail+': structured meridians are used before solver-budget partition',()=>{out=uv.unwrapMesh(mesh,new Set(),options);assert.equal(out.packed.length,2);assert.equal(out.human.applied,1);assert.equal(out.peel.feedbackSplits,0);assert.ok(out.diagnostics.every(d=>d.faces<=options.maxChartFaces));return {faces:mesh.faces.length,budget:options.maxChartFaces,panels:out.human.entries[0].plannedPanels};});
  test(detail+': real seam edges keep a constant longitudinal plane',()=>{const edgeSet=new Set(out.human.entries[0].seamEdges);assert.ok(edgeSet.size>0);for(const e of edgeSet)for(const v of e.split(':').map(Number))assert.ok(Math.abs(mesh.positions[v][2])<1e-8);assert.ok([...edgeSet].every(e=>core.buildTopology(mesh).edges.has(e)));});
  test(detail+': all faces, holes and input geometry retained',()=>{assert.equal(out.packed.reduce((n,c)=>n+c.faceUVs.size,0),mesh.faces.length);assert.equal(JSON.stringify(mesh),baseline);assert.ok(uv.checkUVTriangles(out.packed.flatMap(c=>[...c.faceUVs.values()])).valid);});
  test(detail+': per-panel limit adds only ordered meridians',()=>{const cap=Math.ceil(mesh.faces.length/4),r=uv.unwrapMesh(mesh,new Set(),{...options,maxChartFaces:cap});assert.equal(r.packed.length,4);assert.equal(r.human.entries[0].budgetExpanded,true);assert.ok(r.diagnostics.every(d=>d.faces<=cap));assert.equal(r.peel.feedbackSplits,0);});
  test(detail+': model labels and poisoned UV cannot affect the result',()=>{const m={...mesh,name:'anonymous-ribbed-shell',faces:mesh.faces.map(f=>({...f,get uvs(){throw Error('UV LEAK')},get uvIndices(){throw Error('UV INDEX LEAK')}}))};const r=uv.unwrapMesh(m,new Set(),options);assert.deepEqual(r.packed,out.packed);assert.deepEqual(r.seams,out.seams);});
 }
 const mesh=core.geometryOnlyMesh(core.makePleatedGarment('low')),opt=uv.geometryGenerationOptions(mesh),ang=.619;
 test('Rigid rotation and uniform scale retain continuous two-panel plan',()=>{const m={...mesh,positions:mesh.positions.map(([x,y,z])=>[3*(x*Math.cos(ang)-y*Math.sin(ang))+4,3*(x*Math.sin(ang)+y*Math.cos(ang))-2,3*z+1])};const r=uv.unwrapMesh(m,new Set(),opt);assert.equal(r.human.applied,1);assert.equal(r.packed.length,2);assert.equal(r.peel.feedbackSplits,0);assert.ok(uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()])).valid);});
 test('Opposite quad diagonals do not turn longitudinal cuts into a zipper',()=>{
  const m={...mesh,faces:[]};for(let i=0;i<mesh.faces.length;i+=2){const[a,b,e]=mesh.faces[i].vertices,d=mesh.faces[i+1].vertices[2];m.faces.push({vertices:[a,b,d]},{vertices:[b,e,d]});}
  const r=uv.unwrapMesh(m,new Set(),opt);assert.equal(r.human.applied,1);assert.equal(r.packed.length,2);
  for(const key of r.human.entries[0].seamEdges)for(const v of key.split(':').map(Number))assert.ok(Math.abs(m.positions[v][2])<1e-8);
  assert.ok(uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()])).valid);
 });
 if(process.argv.includes('--include-high'))test('High density respects the same direction with explicit per-panel budgets',()=>{const m=core.geometryOnlyMesh(core.makePleatedGarment('high')),o=uv.geometryGenerationOptions(m),r=uv.unwrapMesh(m,new Set(),o);assert.equal(r.human.applied,1);assert.equal(r.peel.feedbackSplits,0);assert.ok(r.diagnostics.every(d=>d.faces<=o.maxChartFaces));assert.ok(uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()])).valid);return{faces:m.faces.length,panels:r.packed.length,budget:o.maxChartFaces};});
 const get=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]};if(get('--report'))await writeFile(get('--report'),JSON.stringify({passed:tests.length,tests},null,2));
}finally{await c.cleanup()}
