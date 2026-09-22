import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),tests=[];
const test=(name,fn)=>{fn();tests.push({name,passed:true});console.log('PASS',name);};
try {
 const uv=await c.load('packages/uv/src/index.js');
 const rect=(id,x,y,w,h)=>({id,bounds:[x,y,x+w,y+h],polygon:[],faceUVs:new Map([[id*2,[[x,y],[x+w,y],[x+w,y+h]]],[id*2+1,[[x,y],[x+w,y+h],[x,y+h]]]])});
 const a=rect(0,.1,.1,.1,.1),larger=rect(0,.2,.2,.2,.2),areas=new Map([[0,1]]);
 const limits={density:3,absoluteGain:12,mode:'area-priority',stop:'converged',commonAccepted:0};
 test('Audit calculates area x4 and length x2 from real coordinates',()=>{const r=uv.auditFillGrowth([a],[larger],areas,limits,[{id:0,tries:1,minStepFailed:false}]);assert.equal(r.enlarged,1);assert.ok(Math.abs(r.rows[0].areaFactor-4)<1e-10);assert.ok(Math.abs(r.rows[0].linearFactor-2)<1e-10);assert.ok(Math.abs(r.addedArea-.03)<1e-10);});
 test('Translation and identity do not masquerade as enlargement',()=>{const r=uv.auditFillGrowth([a],[rect(0,.5,.5,.1,.1)],areas,limits,[]);assert.equal(r.enlarged,0);assert.equal(r.unchanged,1);});
 test('Rollback is audited from baseline coordinates, not accepted trial count',()=>{const r=uv.auditFillGrowth([a],[a],areas,{...limits,stop:'validation-rejected',commonAccepted:8},[{id:0,tries:20,minStepFailed:false}]);assert.equal(r.enlarged,0);assert.equal(r.rows[0].reason,'validation-rejected');});
 test('Budget, untried and density limit are distinct',()=>{
  const b=rect(1,.4,.4,.1,.3),orig=[a,rect(1,.4,.4,.1,.1)],aa=new Map([[0,1],[1,1]]);
  const r=uv.auditFillGrowth(orig,[a,b],aa,{...limits,stop:'time-budget'},[]);
  assert.equal(r.rows.find(r=>r.id===1).reason,'density-limit');assert.equal(r.rows.find(r=>r.id===0).reason,'time-budget');
  const u=uv.auditFillGrowth([a],[a],areas,limits,[]);assert.equal(u.rows[0].reason,'not-tried');
 });
 test('Missing or duplicated island identity fails audit',()=>{assert.throws(()=>uv.auditFillGrowth([a],[],areas,limits,[]));assert.throws(()=>uv.auditFillGrowth([a,a],[a,a],areas,limits,[]));assert.throws(()=>uv.auditFillGrowth([a],[rect(4,0,0,1,1)],areas,limits,[]));});
 const packed=[rect(9,.003,.003,.994,.65),rect(1,.003,.7,.12,.12)];
 const raw=packed.map(p=>({...p,area3D:uv.fillChartArea(p)}));
 const area=raw.reduce((s,p)=>s+p.area3D,0);
 const base={packed,occupancy:area,boxOccupancy:area,scale:1,padding:.003,packingMethod:'existing',packingReport:{order:'area',placementOrder:[9,1],searchAttempts:0,failedFits:0,areaBoosts:[]}};
 const unchanged=JSON.stringify(base,(_,v)=>v instanceof Map?[...v]:v);
 const r=uv.refineAtlas(base,raw,{fillMode:'area-priority',fillResolution:256,fillRounds:8,fillWarmupPasses:0,fillTimeBudgetMs:10000});
 test('Largest blocked chart is kept; a smaller chart really grows',()=>{assert.deepEqual(r.packingReport.refinement.order,[9,1]);const rows=r.packingReport.refinement.growth.rows;assert.ok(Math.abs(rows[0].areaFactor-1)<1e-9);assert.ok(rows[1].areaFactor>2.9);});
 test('Capacity-directed enlargement is executed, not just relocation',()=>{assert.ok(r.packingReport.refinement.vacancyGrowth.accepted>0);assert.ok(r.occupancy>base.occupancy+.02);});
 test('New default has a finite 3x density limit, not unlimited growth',()=>{assert.equal(uv.DEFAULT_FILL_DENSITY_LIMIT,3);assert.ok(r.packingReport.refinement.densitySpreadAfter<=3+1e-8);});
 test('Explicit 1.6x cap is honoured and reported, never silently raised',()=>{const s=uv.refineAtlas(base,raw,{fillMode:'area-priority',fillResolution:256,fillMaxAreaGain:1.6,fillRounds:8,fillWarmupPasses:0,fillTimeBudgetMs:10000});assert.ok(s.packingReport.refinement.densitySpreadAfter<=1.6+1e-8);assert.ok(s.packingReport.refinement.growth.densityLimited>=1);});
 test('Repeated fill cannot evade the density cap',()=>{const s=uv.refineAtlas(r,raw,{fillMode:'area-priority',fillResolution:256,fillTimeBudgetMs:10000});assert.ok(s.packingReport.refinement.densitySpreadAfter<=3+1e-8);assert.ok(s.packingReport.refinement.gains.every(g=>g.areaFactor>=1-1e-8));});
 test('Committed area summary agrees with independently summed triangle area',()=>{const q=uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()]));assert.ok(q.valid);assert.ok(Math.abs(q.area-r.packingReport.refinement.growth.afterArea)<1e-10);assert.ok(Math.abs(q.area-r.occupancy)<1e-10);assert.equal(JSON.stringify(base,(_,v)=>v instanceof Map?[...v]:v),unchanged);});
 test('Vacancy enlargement has a working disable switch',()=>{const s=uv.refineAtlas(base,raw,{fillMode:'area-priority',fillFitVacancies:false,fillResolution:128,fillRounds:1,fillTimeBudgetMs:10000});assert.equal(s.packingReport.refinement.vacancyGrowth.accepted,0);});
 test('Invalid capacity-fit parameter is rejected',()=>assert.throws(()=>uv.validateFillOptions({fillFitVacancies:1})));
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:tests.length,tests,example:r.packingReport.refinement},null,2));
}finally{await c.cleanup();}
