/** Guarded seam trial tests: explicit opt-in, no speculative small fragments. */
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name);};
try{const u=await c.load('packages/uv/src/index.js');
function panel(split=true){const positions=[],faces=[],map=new Map();const n=10;for(let y=0;y<=n;y++)for(let x=0;x<=n;x++)positions.push([x/n,y/n,0]);
for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+1,d=a+n+1,e=d+1;for(const verts of [[a,b,e],[a,e,d]]){const shift=split&&x>=n/2?2:0;faces.push({vertices:verts,uvs:verts.map(i=>[positions[i][0]+shift,positions[i][1]])});map.set(faces.length-1,verts.map(i=>[.003+positions[i][0]*.994,.003+positions[i][1]*.994]));}}
return {mesh:{name:'Explicit source seam fixture',positions,faces},packed:[{id:3,faceUVs:map,bounds:[.003,.003,.997,.997],polygon:[]}]};}
const a=panel(),base={packed:a.packed,occupancy:.994**2,boxOccupancy:.994**2,padding:.003,scale:1,packingMethod:'existing',packingReport:{order:'area',placementOrder:[3],searchAttempts:0,failedFits:0,areaBoosts:[]}};
const candidates=u.largeRecutCandidates(a.mesh,a.packed);
check('A known source boundary can split one eligible large parent',()=>{assert.equal(candidates.length,1);assert.equal(candidates[0].parent,3);assert.equal(candidates[0].parts.length,2);});
check('Children retain all original faces without duplication',()=>assert.deepEqual(candidates[0].parts.flat().sort((a,b)=>a-b),a.mesh.faces.map((_,i)=>i)));
check('Both children exceed 25% of parent',()=>assert.ok(candidates[0].parts.every(p=>p.length>=50)));
check('Only original split boundary is proposed',()=>assert.equal(candidates[0].edges.length,10));
check('No arbitrary seam is invented for an uncut large island',()=>assert.equal(u.largeRecutCandidates(panel(false).mesh,panel(false).packed).length,0));
check('Small parent cannot become a recut candidate',()=>{const b=panel();b.mesh.positions.push([10,0,0],[30,0,0],[10,20,0]);b.mesh.faces.push({vertices:[121,122,123],uvs:[[0,0],[1,0],[0,1]]});assert.equal(u.largeRecutCandidates(b.mesh,b.packed).length,0);});
check('Invalid thresholds rejected',()=>{assert.throws(()=>u.largeRecutCandidates(a.mesh,a.packed,{fillRecutMinParentArea:.001}));assert.throws(()=>u.tryLargeRecut(a.mesh,base,new Set(),{fillRecutMinGain:-1}));});
const before=JSON.stringify([...a.packed[0].faceUVs]),trial=u.tryLargeRecut(a.mesh,base,new Set(),{fillMode:'area-priority',fillResolution:128,fillRounds:2,fillMaxTrials:10,fillTimeBudgetMs:3000});
check('Gainless split is rejected rather than claiming fewer blanks',()=>{assert.equal(trial.report.accepted,false);assert.ok(trial.report.trials>0);});
check('Rejected transaction returns original geometry/UV/seams',()=>{assert.equal(trial.result,base);assert.equal(trial.seams.size,0);assert.equal(JSON.stringify([...a.packed[0].faceUVs]),before);});
const untouched=u.fillCurrentUV(a.mesh,a.packed,new Set(),{fillMode:'area-priority',fillResolution:128,fillRounds:1,fillMaxTrials:1,fillWarmupPasses:0,fillTimeBudgetMs:3000});
check('Default fill never implicitly enables recut',()=>{assert.equal(untouched.packed.length,1);assert.equal(untouched.packingReport.refinement.recut,undefined);assert.equal(untouched.addedSeams.length,0);});
const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases,trial:trial.report},null,2));
}finally{await c.cleanup();}
