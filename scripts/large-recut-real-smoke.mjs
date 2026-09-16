/** Optional known-boundary trials on hash-pinned input; never fake a new seam. */
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {compileCore} from './lib/compiled-core.mjs';import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const arg=(a,b)=>{const i=process.argv.indexOf(a);return i<0?b:process.argv[i+1]};const c=await compileCore(),report={assets:{}};
try{const u=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),chain=await c.load('packages/chaining-seams/src/index.js');for(const name of ['Corset','FlightHelmet']){
const input=await loadVerifiedFixture(core,'examples/verified-models',name),current=core.parseOBJ(await readFile(`${arg('--results','validation/v0.4.13/real-adaptive')}/${name}-organized.obj`,'utf8'));
assert.deepEqual(current.faces.map(f=>f.vertices),input.mesh.faces.map(f=>f.vertices));const seams=chain.extractSeamEdgesFromUV(current),packed=u.sourceUVPreview(current,u.buildCharts(current,seams)),q=u.checkUVTriangles(packed.flatMap(c=>[...c.faceUVs.values()]));assert.ok(q.valid);
const base={packed,occupancy:q.area,boxOccupancy:packed.reduce((s,c)=>s+(c.bounds[2]-c.bounds[0])*(c.bounds[3]-c.bounds[1]),0),padding:.003,scale:1,packingMethod:'existing',packingReport:{order:'area',placementOrder:[],searchAttempts:0,failedFits:0,areaBoosts:[]}};
const start=performance.now(),result=u.tryLargeRecut(input.mesh,base,seams,{fillRecutLarge:true,fillMode:'area-priority',fillResolution:512,fillRounds:4,fillMaxTrials:300,fillTimeBudgetMs:15000});
assert.equal(result.result.packed.reduce((s,c)=>s+c.faceUVs.size,0),input.mesh.faces.length);assert.ok(u.checkUVTriangles(result.result.packed.flatMap(c=>[...c.faceUVs.values()])).valid);if(result.report.accepted){assert.equal(result.result.packed.length,packed.length+1);assert.ok(result.result.occupancy>=base.occupancy+.01);}else assert.equal(result.result,base);
report.assets[name]={identity:input.identity,seconds:(performance.now()-start)/1000,beforeIslands:packed.length,afterIslands:result.result.packed.length,...result.report};console.log(name,report.assets[name]);}
await writeFile(arg('--report','validation/v0.4.13/large-recut-real.json'),JSON.stringify(report,null,2));
}finally{await c.cleanup();}
