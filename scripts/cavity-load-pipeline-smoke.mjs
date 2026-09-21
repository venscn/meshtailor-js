/** Actual model-load pipeline, including optional post-merge, never source UV. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {runGeometryJob} from './lib/geometry-worker.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]};
const out=arg('--out','validation/local-cavity-pipeline'),names=arg('--assets','garment,gear,Corset,FlightHelmet').split(',');
await mkdir(out,{recursive:true});const c=await compileCore(),records=[];
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),p=await c.load('apps/studio/src/unfold/load-pipeline.js');
 for(const name of names){
  const mesh=core.geometryOnlyMesh(['garment','gear'].includes(name)?core.makeComplexExample(name,'medium'):(await loadVerifiedFixture(core,'examples/verified-models',name,{geometryOnly:true})).mesh);
  const original=JSON.stringify(mesh),stages=[];
  const pipeline={...p.DEFAULT_LOAD_PIPELINE,mergeAdjacent:true,fill:true,fillBudgetSeconds:3,fillRounds:2};
  const snapshot=await runGeometryJob(c,{mesh,edges:[],target:'generated',pipeline,config:{timeBudgetMs:300000,fillCavitySearch:true,fillGrowthSteps:2}},e=>{const running=e.pipeline?.steps.find(s=>s.state==='running')?.id;if(running&&stages.at(-1)!==running)stages.push(running)});
  assert.equal(JSON.stringify(mesh),original);assert.equal(snapshot.pipeline.status,'completed');
  assert.deepEqual(snapshot.pipeline.config,pipeline);assert.equal(snapshot.pipeline.steps.find(s=>s.id==='fill').state,'completed');assert.equal(stages.filter(s=>s==='fill').length,1);
  const f=snapshot.packingReport.refinement;assert.equal(f.cavities.enabled,true);assert.equal(f.cavities.growthSteps,2);
  assert.equal(f.settings.timeBudgetMs,3000);assert.equal(f.settings.maxRounds,2);assert.ok(f.after+1e-10>=f.before);
  const faces=snapshot.packed.flatMap(c=>[...c.faceUVs.keys()]);assert.equal(faces.length,mesh.faces.length);assert.equal(new Set(faces).size,faces.length);
  const quality=uv.checkUVTriangles(snapshot.packed.flatMap(c=>[...c.faceUVs.values()]),100);assert.ok(quality.valid);
  assert.ok(stages.indexOf('fill')<stages.indexOf('correspondence'));
  records.push({name,passed:true,faces:faces.length,islands:snapshot.packed.length,stages,fill:f,pipeline:snapshot.pipeline});
  console.log('PASS',name,snapshot.packed.length,f.before,f.after,f.stop);await writeFile(out+'/report.json',JSON.stringify({scope:'Actual automatic geometry + post-merge + fill pipeline, 3s/2 rounds diagnostic budget, not maximum packing search.',passed:records.length,records},null,2));
 }
}finally{await c.cleanup()}
