import assert from 'node:assert/strict';import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;try{const u=await c.load('packages/uv/src/index.js');
 const mesh={name:'two source charts',positions:[[0,0,0],[1,0,0],[0,1,0],[2,0,0],[3,0,0],[2,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[0,0],[0,0]]},{vertices:[3,4,5],uvs:[[0,0],[1,0],[0,1]]}]},copy=structuredClone(mesh),seed=u.sourceUVPreview(mesh,u.buildCharts(mesh,new Set())),options={...u.DEFAULT_UNWRAP};
 const r=u.repairSourceCharts(mesh,seed,new Set(),options);assert.equal(r.report.repaired,1);assert.equal(r.report.preserved,1);checks++;
 assert.equal(r.raw.length,2);assert.deepEqual([...r.raw[1].faceUVs], [...seed[1].faceUVs]);checks++;
 assert.ok(r.raw.every(x=>u.checkUVTriangles([...x.faceUVs.values()]).valid));checks++;
 assert.deepEqual(mesh,copy);checks++;
 assert.throws(()=>u.postprocessUV(mesh,seed,new Set(),'repack'),/内部/);checks++;
 const organized=u.postprocessUV(mesh,seed,new Set(),'repack',{sourceRepairPolicy:'repair'});assert.equal(organized.repair.repaired,1);assert.equal(organized.packed.length,2);checks++;
 assert.ok(u.auditIslandAreas(mesh,organized.packed).islands.every(i=>Math.abs(i.densityRatio-1)<1e-9));checks++;
 assert.throws(()=>u.postprocessUV(mesh,seed,new Set(),'repack',{sourceRepairPolicy:'bogus'}),/policy/);checks++;
 const zero=structuredClone(mesh);zero.positions[2]=[2,0,0];assert.throws(()=>u.repairSourceCharts(zero,seed,new Set(),options));checks++;
 const mirrored=structuredClone(seed);mirrored[1].faceUVs.get(1)[2][1]=-1;const m=u.repairSourceCharts(mesh,mirrored,new Set(),options);assert.equal(m.report.repaired,1);assert.ok(u.checkUVTriangles([...m.raw[1].faceUVs.values()]).valid);checks++;
 assert.throws(()=>u.repairSourceCharts(mesh,seed,new Set(),options,{check(){throw new u.UVWorkStopped('stop')},report(){}}),/stop/);checks++;
 const missing=seed.slice(1);assert.throws(()=>u.repairSourceCharts(mesh,missing,new Set(),options),/cover/);checks++;
 console.log(`${checks} local source UV repair checks passed`);
}finally{await c.cleanup();}
