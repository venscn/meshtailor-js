import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let count=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),slits=await c.load('packages/uv/src/topology-slits.js');
 const n=32,positions=[],faces=[];for(let row=0;row<3;row++)for(let i=0;i<n;i++)positions.push([(1+row*.4)*Math.cos(i/n*2*Math.PI),(1+row*.4)*Math.sin(i/n*2*Math.PI),0]);
 for(let row=0;row<2;row++)for(let i=0;i<n;i++){const a=row*n+i,b=row*n+(i+1)%n,c=b+n,d=a+n;faces.push({vertices:[a,b,c]},{vertices:[a,c,d]});}
 const m={name:'annular gear cap',positions,faces},fs=faces.map((_,i)=>i),local=uv.cutLocalMesh(m,fs,new Set());assert.equal(local.boundaryLoops,2);count++;
 const r=slits.openChartWithSlits(m,fs,new Set(),local);assert.ok(r?.local.disk);count++;
 assert.ok(r.added.length<=4);count++;assert.equal(uv.buildCharts(m,new Set(r.added)).length,1);count++;
 const p=uv.parameterizeChart(r.local);assert.ok(p.quality.valid);count++;
 assert.equal(r.local.triangles.length,faces.length);count++;
 const cube=core.makeCube(),cubeFs=cube.faces.map((_,i)=>i),closed=uv.cutLocalMesh(cube,cubeFs,new Set()),opened=slits.openChartWithSlits(cube,cubeFs,new Set(),closed);
 assert.ok(opened?.local.disk);count++;assert.equal(uv.buildCharts(cube,new Set(opened.added)).length,1);count++;
 console.log(`${count} topology-slit checks passed.`);
}finally{await c.cleanup();}
