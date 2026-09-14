import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js');
 const samples=[{area:99.5,stretch:2},{area:.5,stretch:1000}];
 assert.deepEqual(uv.areaDistortionBudget(samples,.99,30),{areaStretch:2,maxStretch:1000,excessAreaRatio:.005});checks++;
 assert.equal(uv.areaDistortionBudget(samples,1,30).areaStretch,1000);checks++;
 assert.equal(uv.areaDistortionBudget([{area:98,stretch:2},{area:2,stretch:100}],.99,30).areaStretch,100);checks++;
 assert.deepEqual(uv.areaDistortionBudget(samples.map(s=>({...s,area:s.area*.00001})),.99,30).areaStretch,2);checks++;
 assert.throws(()=>uv.areaDistortionBudget(samples,.89,30),/percentile/);checks++;
 const mesh=core.makeComplexExample('gear','low'),opts=uv.recommendUnwrap(mesh).options;
 assert.equal(opts.stretchAreaPercentile,.99);assert.equal(uv.recommendUnwrap(mesh,'balanced').options.stretchAreaPercentile,1);checks++;
 const r=uv.unwrapMesh(mesh,new Set(),opts),d=r.fragmentation;
 assert.equal(d.componentFaces.reduce((s,n)=>s+n,0),mesh.faces.length);checks++;
 assert.equal(d.outputCharts,r.packed.length);assert.equal(d.tinyCharts,r.packed.filter(c=>c.faceUVs.size<16).length);checks++;
 assert.equal(Object.values(d.reasons).reduce((s,n)=>s+n,0),d.events.length+d.omittedEvents);checks++;
 assert.ok(r.diagnostics.every(c=>c.areaStretch<=c.maxStretch));checks++;
 assert.ok(r.packed.every(c=>uv.checkUVTriangles([...c.faceUVs.values()]).valid));checks++;
 const cap=uv.unwrapMesh(mesh,new Set(),{...opts,maxChartFaces:256});
 assert.ok(cap.diagnostics.every(c=>c.faces<=256));assert.ok(cap.fragmentation.initialCharts>r.fragmentation.initialCharts);checks++;
 console.log(`${checks} distortion-budget and fragmentation checks passed`);
}finally{await c.cleanup();}
