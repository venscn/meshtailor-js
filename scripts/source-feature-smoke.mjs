/** Regression for the ACTUAL default route: valid rectangular source UV must
 * not suppress the recognizable planar regions of a hard-surface object. */
import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();
try {
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),chain=await c.load('packages/chaining-seams/src/index.js'),pipe=await c.load('apps/studio/src/unfold/load-pipeline.js');
 const mesh=core.makeComplexExample('gear','low'),edges=chain.extractSeamEdgesFromUV(mesh),seed=uv.sourceUVPreview(mesh,uv.buildCharts(mesh,edges));
 const plan=pipe.resolveLoadPipeline(mesh,pipe.DEFAULT_LOAD_PIPELINE,uv.recommendUnwrap(mesh).options);
 assert.equal(plan.target,'source-atlas');assert.equal(seed.length,1);
 // Until the feature gate lands, this reproduces the user-visible one-square bug.
 const result=uv.postprocessUV(mesh,seed,edges,'stitch',plan.config);
 assert.ok(result.packed.length>1,'Default source-atlas incorrectly retains the whole gear as ONE rectangular UV');
 assert.equal(result.diagnostics.filter(d=>d.method==='planar-shape').length,2,'Both planar tooth silhouettes and centre holes must survive the default entry');
 console.log('PASS default source-UV feature preservation');
} finally {await c.cleanup()}
