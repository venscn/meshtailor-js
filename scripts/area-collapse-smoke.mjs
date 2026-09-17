import assert from 'node:assert/strict';import{readFile,mkdir,writeFile}from'node:fs/promises';import{compileCore}from'./lib/compiled-core.mjs';
const c=await compileCore();try{const pa=await c.load('packages/uv/src/parameterize.js'),{mesh}=JSON.parse(await readFile('examples/regression/collapsed-area-chart.json')),old=pa.parameterizeChart(mesh,{method:'lscm'}),density=pa.chartAreaDensity(mesh,old.uv);
assert.ok(old.quality.valid);assert.ok(density.min<1e-6,'Conformal angular success must not hide area collapse');
assert.throws(()=>pa.parameterizeChart(mesh,{projectionSeed:true}),/collaps|seam/,'Generic pipeline must request a deliberate cut rather than export almost-degenerate regions');
const scaled=old.uv.map(([u,v])=>[u*3+2,v*3-8]),d=pa.chartAreaDensity(mesh,scaled);assert.ok(Math.abs(Math.log(d.min/density.min))<1e-5);assert.ok(Math.abs(d.max-density.max)<1e-6);
const uv=await c.load('packages/uv/src/index.js'),{core:unused}=globalThis;
const plain={name:'arbitrary',positions:[[0,0,0],[1,0,0],[1,1,0],[0,1,0]],faces:[{vertices:[0,1,2]},{vertices:[0,2,3]}]},r=uv.unwrapMesh(plain,new Set(),{initialSegmentation:'hierarchical',peelSourceHints:false,structureTemplates:false,postMerge:false}),copy=JSON.stringify(r.peel);
const report=uv.carryPeelReport(r.peel,r.packed.map(p=>({...p,id:p.id+4})));assert.equal(report.groups[0].charts[0],4);assert.equal(JSON.stringify(r.peel),copy);assert.throws(()=>uv.carryPeelReport(r.peel,[{...r.packed[0],faceUVs:new Map([[999,[[0,0],[1,0],[0,1]]]])}]),/source|group/i);
await mkdir('validation/v0.4.18/tests',{recursive:true});await writeFile('validation/v0.4.18/tests/area-collapse.json',JSON.stringify({passed:7,conformalQuality:old.quality,density,guard:'explicit rejection for geometric feedback, no validity tolerance relaxation',groupCarry:true},null,2));console.log('7 area-collapse / group provenance checks passed');
}finally{await c.cleanup()}
