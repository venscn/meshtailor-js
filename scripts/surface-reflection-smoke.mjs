import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-surface-reflection';
await mkdir(out,{recursive:true});const c=await compileCore(),tests=[];
const test=(name,fn)=>{const detail=fn();tests.push({name,passed:true,detail});console.log('PASS',name);};
import {unequalSheet} from './lib/symmetry-fixtures.mjs';

try{const uv=await c.load('packages/uv/src/index.js'),s=await c.load('packages/uv/src/surface-reflection.js');
 for(const [p,w]of[[[.2,.3,1],[.5,.2,.3]],[[-1,0,0],[1,0,0]],[[2,0,0],[0,1,0]],[[.5,-1,0],[.5,.5,0]]])test('Triangle closest point '+p,()=>{const r=s.triangleClosest(p,[0,0,0],[1,0,0],[0,1,0]);r.weights.forEach((x,i)=>assert.ok(Math.abs(x-w[i])<1e-10));});
 test('Degenerate segment has finite barycentrics',()=>{const r=s.triangleClosest([1,.1,0],[0,0,0],[1,0,0],[2,0,0]);assert.ok(r.weights.every(Number.isFinite));assert.equal(r.point[0],1);});
 const mesh=unequalSheet(),local=uv.cutLocalMesh(mesh,mesh.faces.map((_,i)=>i),new Set());let r;
 test('Different vertex counts and diagonals still match surfaces',()=>{r=s.detectSurfaceReflection(local);assert.ok(r);assert.ok(Math.abs(r.normal[0])>.98);assert.ok(r.coverage>.95);assert.ok(r.vertexPairCoverage<.8);return s.reflectionSummary(r);});
 test('Narrow curved sheets retain their actual transverse reflection plane',()=>{const narrow={...mesh,positions:mesh.positions.map(([x,y,z])=>[x*.03,y,z])},l=uv.cutLocalMesh(narrow,narrow.faces.map((_,i)=>i),new Set()),fixed=s.detectSurfaceReflection(l,{fixedPlane:{normal:[1,0,0],offset:0}});assert.ok(fixed);assert.ok(fixed.coverage>.99);assert.ok(fixed.rms<1e-4);return s.reflectionSummary(fixed);});
 test('Reflection is an involution on positions',()=>{const p=[1,2,3],q=s.reflected(s.reflected(p,r.normal,r.offset),r.normal,r.offset);q.forEach((v,k)=>assert.ok(Math.abs(v-p[k])<1e-10));});
 test('BVH agrees with brute triangle closest points',()=>{const bvh=new s.SurfaceIndex(local);for(let k=0;k<100;k++){const p=[Math.sin(k*17)*2,Math.cos(k*11)*2,Math.sin(k)*.5];const h=bvh.nearest(p);const brute=Math.min(...local.triangles.map(t=>{const q=s.triangleClosest(p,...t.map(v=>local.positions[v])).point;return q.reduce((a,x,i)=>a+(x-p[i])**2,0);}));assert.ok(Math.abs(h.distance2-brute)<1e-10);}});
 test('Rigid rotation and scale do not require a world mirror axis',()=>{const a=.57,b=.39,rot=([x,y,z])=>{const u=x*Math.cos(a)-y*Math.sin(a),v=x*Math.sin(a)+y*Math.cos(a);return[u*Math.cos(b)-z*Math.sin(b),v,u*Math.sin(b)+z*Math.cos(b)];},mm={...mesh,positions:mesh.positions.map(p=>rot(p).map((x,i)=>x*7+[3,-8,2][i]))},ll=uv.cutLocalMesh(mm,mesh.faces.map((_,i)=>i),new Set()),rr=s.detectSurfaceReflection(ll);assert.ok(rr);assert.ok(Math.abs(s.dot3(rr.normal,rot([1,0,0])))>.98);});
 test('A planar sheet does not use its identity plane',()=>{const m=unequalSheet(false),r=s.detectSurfaceReflection(uv.cutLocalMesh(m,m.faces.map((_,i)=>i),new Set()));assert.ok(r);assert.ok(Math.abs(r.normal[2])<.01);});
 test('Forbidden UV getters cannot be accessed',()=>{for(const f of mesh.faces)Object.defineProperty(f,'uvs',{get(){throw Error('UV READ');}});assert.ok(s.detectSurfaceReflection(uv.cutLocalMesh(mesh,mesh.faces.map((_,i)=>i),new Set())));});
 test('Cancellation propagates',()=>{assert.throws(()=>s.detectSurfaceReflection(local,{}, {check(){throw Error('STOP');},report(){}}),/STOP/);});
 test('Invalid controls fail explicitly',()=>{assert.throws(()=>s.detectSurfaceReflection(local,{tolerance:2}),/Invalid/);});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));console.log('PASSED',tests.length);
}finally{await c.cleanup()}
