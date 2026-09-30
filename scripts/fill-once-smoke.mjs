import assert from 'node:assert/strict';import{writeFile,mkdir}from'node:fs/promises';
import{compileCore}from'./lib/compiled-core.mjs';import{runGeometryJob}from'./lib/geometry-worker.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-fill-once';await mkdir(out,{recursive:true});const c=await compileCore(),tests=[];
try{const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),p=await c.load('apps/studio/src/unfold/load-pipeline.js');
 const mesh=core.makeComplexExample('gear','low'),cfg={timeBudgetMs:120000,fillMaxTrials:12,fillRounds:2,fillTimeBudgetMs:3000,fillCommonGainLimit:2,fillWarmupPasses:1,fillReflowBudget:0,fillFitVacancies:false,fillMaxAreaGain:1.6};
 const plan={...p.DEFAULT_LOAD_PIPELINE,fill:true,fillBudgetSeconds:3,fillRounds:2},resolved=p.resolveLoadPipeline(mesh,plan,cfg);
 assert.equal(resolved.config.fillMode,'off');assert.equal(resolved.config.fillMaxAreaGain,1.6);assert.equal(resolved.config.fillCommonGainLimit,2);assert.equal(resolved.config.fillFitVacancies,false);assert.equal(resolved.config.fillWarmupPasses,1);tests.push({name:'Single owner and explicit settings retained',passed:true});
 assert.equal(p.validateLoadPipeline({...plan,repairInvalid:true}).repairInvalid,false);tests.push({name:'Source UV repair cannot be re-enabled',passed:true});
 const base=await runGeometryJob(c,{mesh,target:'generated',edges:[],config:cfg,pipeline:{...plan,fill:false}});
 let fillEntries=0,lastStep;const result=await runGeometryJob(c,{mesh,target:'generated',edges:[],config:cfg,pipeline:plan},ev=>{const id=ev.pipeline?.steps.find(s=>s.state==='running')?.id;if(id!==lastStep){if(id==='fill')fillEntries++;lastStep=id;}});
 assert.ok(!base.packingReport?.refinement);assert.equal(fillEntries,1);assert.ok(result.packingReport.refinement);assert.ok(Math.abs(result.packingReport.refinement.before-base.metrics.occupancy)<1e-12,'Refinement must start at initial pack, not an already-refined intermediate');assert.equal(result.packingReport.refinement.settings.maxAreaGain,1.6);assert.equal(result.packed.length,base.packed.length);assert.deepEqual(result.seams,base.seams);assert.equal(result.pipeline.settings.fillMode,'off');tests.push({name:'Production worker fills exactly once after initial pack',passed:true,baseline:base.metrics.occupancy,refinement:result.packingReport.refinement});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));console.log('PASS fill-once',tests.length);
}finally{await c.cleanup()}
