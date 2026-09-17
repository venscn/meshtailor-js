import assert from 'node:assert/strict';import {mkdir,writeFile}from'node:fs/promises';import{compileCore}from'./lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const test=(name,f)=>{const detail=f();cases.push({name,passed:true,detail});console.log(name,detail??'');};
try{
 const core=await c.load('packages/mesh-core/src/index.js');
 function grid(n=24,m=18){const positions=[],faces=[];for(let y=0;y<=m;y++)for(let x=0;x<=n;x++)positions.push([x/n,y/m,.06*Math.sin(x/n*2)]);for(let y=0;y<m;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+1,d=a+n+1,e=d+1;faces.push({vertices:[a,b,e]},{vertices:[a,e,d]});}return{name:'triangulated patch',positions,faces};}
 const mesh=grid(),before=JSON.stringify(mesh),parts=[[],[]];mesh.faces.forEach((f,fi)=>{const cell=Math.floor(fi/2),x=cell%24,y=Math.floor(cell/24),boundary=12+(y%2?2:-2);parts[x<boundary?0:1].push(fi);});
 let r;
 test('Graph cut shortens sawtooth boundary without changing geometry',()=>{r=core.regularizeBinaryPartition(mesh,parts);assert.ok(r.report.accepted);assert.ok(r.report.afterLength<r.report.beforeLength*.8);assert.equal(JSON.stringify(mesh),before);return r.report;});
 test('Every triangle still belongs to exactly one connected group',()=>{assert.equal(new Set(r.parts.flat()).size,mesh.faces.length);assert.equal(r.parts.flat().length,mesh.faces.length);});
 test('Hard seam locks cannot be moved',()=>{const t=core.buildTopology(mesh),owner=new Map(parts.flatMap((fs,i)=>fs.map(f=>[f,i]))),locks=new Set([...t.edges].filter(([,e])=>e.faces.length===2&&owner.get(e.faces[0])!==owner.get(e.faces[1])).map(([k])=>k));const q=core.regularizeBinaryPartition(mesh,parts,locks);assert.deepEqual(q.parts,parts);});
 test('No coordinate/index properties from source UV are read',()=>{const input={...mesh,faces:mesh.faces.map(f=>({...f,get uvs(){throw Error('UV accessed');}}))};assert.deepEqual(core.regularizeBinaryPartition(input,parts).parts,r.parts);});
 test('Cancelled graph cut stops promptly',()=>{assert.throws(()=>core.regularizeBinaryPartition(mesh,parts,new Set(),core.buildTopology(mesh),()=>{throw Error('cancel');}),/cancel/);});
 test('Renaming and uniform scaling do not alter the cut',()=>{const scaled={...mesh,name:'different',positions:mesh.positions.map(p=>p.map(v=>v*1.73+3))};assert.deepEqual(core.regularizeBinaryPartition(scaled,parts).parts,r.parts);});
 await mkdir('validation/v0.4.20/tests',{recursive:true});await writeFile('validation/v0.4.20/tests/boundary-regularization.json',JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup();}
