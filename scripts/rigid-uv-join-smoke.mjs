import assert from 'node:assert/strict';import{compileCore}from'./lib/compiled-core.mjs';const c=await compileCore();let checks=0;try{const u=await c.load('packages/uv/src/index.js');
 const mesh={name:'folded joined patches',positions:[[0,0,0],[1,0,0],[0,1,0],[1,1,.1]],faces:[{vertices:[0,1,2]},{vertices:[1,3,2]}]};
 const A={id:0,area3D:.5,faceUVs:new Map([[0,[[0,0],[1,0],[0,1]]]])},B={id:1,area3D:Math.sqrt(1.02)/2,faceUVs:new Map([[1,[[3,5],[3,6],[2,6]]]])},opts=u.DEFAULT_UNWRAP,seams=new Set(['1:2']);
 const saved=structuredClone({mesh,A,B,seams}),r=u.tryRigidUVJoin(mesh,A,B,seams,['1:2'],opts);assert.ok(r);checks++;
 assert.ok(r.quality.valid);assert.equal(r.local.disk,true);checks++;
 assert.equal(r.faceUVs.size,2);assert.equal(r.seams.size,0);checks++;
 assert.deepEqual({mesh,A,B,seams},saved);checks++;
 assert.ok(r.joinAreaRatio<=1.25);assert.equal(r.iterations,0);checks++;
 const huge=structuredClone(B);for(const vs of huge.faceUVs.values())for(const p of vs){p[0]*=100;p[1]*=100;}const h=u.tryRigidUVJoin(mesh,A,huge,seams,['1:2'],opts);assert.ok(h);assert.ok(h.quality.valid);checks++;
 const warped=structuredClone(B);warped.faceUVs.set(1,[[0,0],[.01,0],[0,10]]);assert.equal(u.tryRigidUVJoin(mesh,A,warped,seams,['1:2'],opts),null);checks++;
 assert.equal(u.tryRigidUVJoin(mesh,A,B,seams,[],opts),null);checks++;
 assert.throws(()=>u.tryRigidUVJoin(mesh,A,B,seams,['1:2'],opts,{check(){throw new u.UVWorkStopped('stop')},report(){}}),/stop/);checks++;
 assert.throws(()=>u.mergeAdjacentCharts(mesh,[A,B],seams,{...opts,mergeOptions:{maxJoinAreaRatio:3}}),/Invalid/);checks++;
 console.log(`${checks} shape-preserving UV stitch checks passed`);
}finally{await c.cleanup();}
