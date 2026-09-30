import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';import {runGeometryJob} from './lib/geometry-worker.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-continuity-worker';await mkdir(out,{recursive:true});
const c=await compileCore(),tests=[],test=async(name,fn)=>{const detail=await fn();tests.push({name,detail,passed:true});console.log('PASS',name);};
try {
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),chain=await c.load('packages/chaining-seams/src/index.js'),lp=await c.load('apps/studio/src/unfold/load-pipeline.js');
 const mesh=core.geometryOnlyMesh((await loadVerifiedFixture(core,'examples/verified-models','Corset',{geometryOnly:true})).mesh),before=JSON.stringify(mesh),components=uv.buildCharts(mesh,new Set());
 const shoulders=components.filter(g=>g.faces.length===288&&g.faces.every(f=>mesh.faces[f].vertices.every(v=>mesh.positions[v][1]>.04&&mesh.positions[v][1]<.05)));
 const base=components.find(g=>g.faces.length===192&&Math.min(...g.faces.flatMap(f=>mesh.faces[f].vertices.map(v=>mesh.positions[v][1])))<1e-8);assert.equal(shoulders.length,2);assert.ok(base);
 const validate=s=>{
  assert.equal(s.inputPolicy,core.GEOMETRY_INPUT_POLICY);assert.equal(s.peel.sourceHintCharts,0);assert.equal(s.metrics.validated,true);
  assert.equal(s.packed.reduce((n,c)=>n+c.faceUVs.size,0),18324);assert.equal(new Set(s.packed.flatMap(c=>[...c.faceUVs.keys()])).size,18324);
  const owner=new Map(s.packed.flatMap(ch=>[...ch.faceUVs.keys()].map(f=>[f,ch.id])));
  for(const g of shoulders){assert.equal(new Set(g.faces.map(f=>owner.get(f))).size,1);const ch=s.packed.find(c=>c.id===owner.get(g.faces[0]));assert.equal(ch.faceUVs.size,288);}
  const ids=new Set(base.faces.map(f=>owner.get(f)));assert.equal(ids.size,3);assert.deepEqual([...ids].map(i=>s.packed.find(c=>c.id===i).faceUVs.size).sort((a,b)=>a-b),[48,72,72]);
  uv.validateStructureOutput(mesh,s.packed,new Set(s.seams),s.peel);assert.equal(JSON.stringify(mesh),before);
  for(const ch of s.packed)for(const[f,t] of ch.faceUVs)for(let k=0;k<3;k++)for(let d=0;d<2;d++)assert.ok(Math.abs(s.geometry.uv[f*6+k*2+d]-t[k][d])<1e-6);
  return {islands:s.packed.length,basePieces:[48,72,72],shoulderPieces:[288,288],occupancy:s.metrics.occupancy};
 };
 let s;
 await test('User screenshot path: pure geometry load with shared-edge post-merge enabled',async()=>{s=await runGeometryJob(c,{mesh,edges:[],target:'generated',pipeline:{...lp.DEFAULT_LOAD_PIPELINE,mergeAdjacent:true},config:{timeBudgetMs:300000}});return validate(s);});
 await writeFile(out+'/Corset-generated.obj',core.meshToOBJ(uv.meshWithPreviewUV(mesh,s.packed)));
 for(const target of ['repack','stitch','fill'])await test(`${target}: no cap swallowing or half-band resurrection`,async()=>{const next=await runGeometryJob(c,{mesh,edges:s.seams,target,seedCharts:s.packed,seedPeel:s.peel,seedHuman:s.human,seedPolicy:s.inputPolicy,config:{timeBudgetMs:300000,fillTimeBudgetMs:1000,fillRounds:1}});return validate(next);});
 await test('Automatic load fill executes once without changing continuity decisions',async()=>{let starts=0,last='';const r=await runGeometryJob(c,{mesh,edges:[],target:'generated',pipeline:{...lp.DEFAULT_LOAD_PIPELINE,mergeAdjacent:true,fill:true,fillBudgetSeconds:1,fillRounds:1},config:{timeBudgetMs:300000}},p=>{const id=p.pipeline?.steps.find(s=>s.state==='running')?.id;if(id&&id!==last){if(id==='fill')starts++;last=id;}});assert.equal(starts,1);assert.ok(r.packingReport.refinement);return {...validate(r),fillStarts:starts};});
 await test('Actual exported OBJ has the same face set and island topology after reload',async()=>{const obj=core.meshToOBJ(uv.meshWithPreviewUV(mesh,s.packed)),r=core.parseOBJ(obj);assert.deepEqual(r.positions,mesh.positions);assert.deepEqual(r.faces.map(f=>f.vertices),mesh.faces.map(f=>f.vertices));assert.equal(uv.buildCharts(r,chain.extractSeamEdgesFromUV(r)).length,s.packed.length);});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));
}catch(e){await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests,error:String(e.stack??e)},null,2));throw e;}finally{await c.cleanup();}
