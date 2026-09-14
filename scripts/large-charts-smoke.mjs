import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;const report=[];
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),rt=await c.load('packages/runtime/src/index.js');
 for(const id of ['gear','garment','knot','assembly'])for(const detail of ['low','medium']){
  const m=core.makeComplexExample(id,detail),before=JSON.stringify(m),recommended=uv.recommendUnwrap(m),start=performance.now();
  const baseline=rt.generateGeometricSeams(m),r=uv.unwrapMesh(m,baseline.seamEdges,recommended.options),loaded=uv.unwrapMesh(m,new Set(),recommended.options);
  const sizes=r.packed.map(c=>c.faceUVs.size),covered=r.packed.flatMap(c=>[...c.faceUVs.keys()]);
  assert.equal(new Set(covered).size,m.faces.length);assert.equal(covered.length,m.faces.length);checks++;
  assert.equal(sizes.filter(n=>n<16).length,0,`${id}/${detail} has tiny shards`);checks++;
  assert.equal(loaded.packed.length,r.packed.length,`${id} load/baseline differs`);checks++;
  for(const chart of r.packed)assert.ok(uv.checkUVTriangles([...chart.faceUVs.values()]).valid);checks++;
  for(const key of baseline.seamEdges)assert.ok(r.seams.includes(key));assert.equal(JSON.stringify(m),before);checks++;
  assert.ok(r.packed.length<60,`${id}/${detail}: ${r.packed.length}`);checks++;
  const item={id,detail,faces:m.faces.length,islands:r.packed.length,tiny:sizes.filter(n=>n<16).length,smallest:Math.min(...sizes),largest:Math.max(...sizes),occupancy:r.occupancy,ms:performance.now()-start,settings:recommended.options};report.push(item);console.log(item);
 }
 const mesh=core.makeComplexExample('gear','low'),legacy=rt.generateGeometricSeams(mesh,{strategy:'legacy',maxEdges:1500}),old=uv.unwrapMesh(mesh,legacy.seamEdges,uv.LEGACY_UNWRAP);
 assert.equal(old.packed.length,254,'legacy reproduction must stay auditable');checks++;
 assert.ok(report[0].islands<old.packed.length/10);checks++;
 const r=uv.unwrapMesh(mesh,new Set(),{...uv.recommendUnwrap(mesh).options,maxChartFaces:256});assert.ok(r.diagnostics.every(d=>d.faces<=256));checks++;
 assert.throws(()=>uv.unwrapMesh(mesh,new Set(),{chartPolicy:'bad'}),/policy/);checks++;
 assert.throws(()=>uv.unwrapMesh(mesh,new Set(),{autoCut:false}),/cuts/);checks++;
 console.log(`${checks} large-chart checks passed.`);
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({checks,report,legacyGearLow:old.packed.length},null,2)+'\n');
}finally{await c.cleanup();}
