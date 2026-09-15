import assert from 'node:assert/strict';import{compileCore}from'./lib/compiled-core.mjs';const c=await compileCore();let checks=0;
try{const u=await c.load('packages/uv/src/index.js'),cut=await c.load('packages/uv/src/cut-topology.js');
 const mesh={name:'octahedron',positions:[[1,0,0],[0,1,0],[-1,0,0],[0,-1,0],[0,0,1],[0,0,-1]],faces:[]};for(let i=0;i<4;i++){mesh.faces.push({vertices:[4,i,(i+1)%4]},{vertices:[5,(i+1)%4,i]});}
 const ring=['0:1','1:2','2:3','0:3'],seams=new Set(ring),faces=mesh.faces.map((_,i)=>i);assert.equal(cut.cutLocalMesh(mesh,faces,new Set()).disk,false);checks++;
 const copy=JSON.stringify(mesh),r=u.joinAlongBoundaryChain(mesh,faces,seams,ring);assert.ok(r);assert.ok(r.local.disk);checks++;
 assert.ok(r.removed.length>0&&r.removed.length<ring.length);assert.ok(r.seams.size>0);checks++;
 assert.equal(u.buildCharts(mesh,r.seams).length,1);assert.equal(r.local.sourceFaces.length,8);checks++;
 assert.deepEqual([...seams],ring);assert.equal(JSON.stringify(mesh),copy);checks++;
 const p=u.parameterizeChart(r.local);assert.ok(p.quality.valid);checks++;
 assert.equal(u.joinAlongBoundaryChain(mesh,faces,seams,[ring[0]]),null);checks++;
 assert.throws(()=>u.joinAlongBoundaryChain(mesh,faces,seams,['0:999','1:2']),/Invalid/);checks++;
 assert.throws(()=>u.joinAlongBoundaryChain(mesh,faces,seams,ring,{check(){throw new u.UVWorkStopped('stop')},report(){}}),/stop/);checks++;
 console.log(`${checks} open boundary-chain join checks passed`);
}finally{await c.cleanup();}
