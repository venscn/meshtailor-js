import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
const c=await compileCore(),checks=[];const test=(name,fn)=>{const detail=fn();checks.push({name,passed:true,detail});console.log('PASS',name)};
const arg=(f,d)=>{const i=process.argv.indexOf(f);return i<0?d:process.argv[i+1]};
const out=arg('--out','validation/v0.4.17/templates');await mkdir(out,{recursive:true});
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),seam=await c.load('packages/chaining-seams/src/index.js'),{normalizedMesh}=await c.load('packages/uv/src/chart-quality.js');
 const band=(slope=0,skew=false)=>{const positions=[],faces=[],n=32,m=5;for(let j=0;j<m;j++)for(let i=0;i<n;i++){const th=2*Math.PI*i/n,y=j/(m-1)*1.5,r=1+slope*y;positions.push([r*Math.cos(th)*(skew?1.4:1),y,r*Math.sin(th)]);}for(let j=0;j<m-1;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=(j+1)*n+(i+1)%n,d=(j+1)*n+i;faces.push({vertices:[a,c,b]},{vertices:[a,d,c]});}return{name:'structural ring',positions,faces};};
 const attempt=(m,settings={},seams=new Set(),protectedSeams=[])=>uv.unfoldBand(m,m.faces.map((_,i)=>i),0,seams,{...uv.DEFAULT_UNWRAP,humanTemplates:settings,mergeOptions:{protectedSeams}},m.faces.reduce((s,f)=>s+uv.triangleArea(...f.vertices.map(v=>m.positions[v])),0));
 for(const slope of [0,.25,-.25])for(const panels of [1,2])test(`Analytic ${slope===0?'cylinder':'cone '+slope}, ${panels} panel(s)`,()=>{const m=band(slope),orig=JSON.stringify(m),r=attempt(m,{panels});assert.ok(r.raw,JSON.stringify(r));assert.equal(r.raw.length,panels);assert.equal(r.raw.reduce((n,p)=>n+p.faceUVs.size,0),m.faces.length);assert.ok(r.raw.every(p=>uv.checkUVTriangles([...p.faceUVs.values()]).valid));assert.equal(JSON.stringify(m),orig);return{template:r.entry.template,maxAnisotropy:r.entry.maxAnisotropy}});
 test('Natural elliptical band uses deliberate cuts and free boundary solve',()=>{const r=attempt(band(0,true));assert.ok(r.raw,JSON.stringify(r));assert.equal(r.entry.template,'contour-band');assert.ok(r.diagnostics.every(d=>d.method==='human-contour-band'));assert.ok(r.entry.maxAnisotropy<2)});
 test('Explicit axis inconsistent with rings is rejected',()=>{const r=attempt(band(),{axis:'x'});assert.ok(!r.raw)});
 test('Zero-area planar ring is not classified as side wall',()=>{const m=band();m.positions=m.positions.map(([x,y,z])=>[x,0,z]);assert.ok(!uv.inspectBand(m,m.faces.map((_,i)=>i)).ok)});
 test('Invalid configuration throws',()=>assert.throws(()=>uv.humanOptions({panels:3}),/settings/));
 test('Tiny automatic region is skipped rather than split',()=>{const m=band(),r=uv.unfoldBand(m,m.faces.map((_,i)=>i),0,new Set(),uv.DEFAULT_UNWRAP,1e9);assert.equal(r.reason,'below-structural-area-threshold')});
 test('User protected transverse edge is not removed',()=>{const m=band(),e=core.edgeKey(m.faces[0].vertices[0],m.faces[0].vertices[1]),r=attempt(m,{panels:1},new Set([e]),[e]);assert.ok(!r.raw);assert.equal(r.reason,'protected-seam-would-be-removed')});
 test('Cancellation propagates, not a successful fallback',()=>{const m=band();assert.throws(()=>uv.unfoldBand(m,m.faces.map((_,i)=>i),0,new Set(),uv.DEFAULT_UNWRAP,10,{check(){throw new uv.UVWorkStopped('cancel')},report(){}}),/cancel/)});
 const {mesh,identity}=await loadVerifiedFixture(core,'examples/verified-models','Corset'),m=normalizedMesh(mesh),seams=seam.extractSeamEdgesFromUV(m),cs=uv.buildCharts(m,seams),bottom=cs[11];assert.equal(bottom.faces.length,224);
 const total=m.faces.reduce((s,f)=>s+uv.triangleArea(...f.vertices.map(v=>m.positions[v])),0),results=[];
 for(const panels of [1,2]){
  const r=uv.unfoldBand(m,bottom.faces,bottom.id,seams,{...uv.DEFAULT_UNWRAP,humanTemplates:{panels}},total);test(`Verified Corset original #12 ${panels} panel(s)`,()=>{assert.ok(r.raw,JSON.stringify(r));assert.equal(r.raw.length,panels);assert.equal(r.raw.reduce((s,p)=>s+p.faceUVs.size,0),224);assert.ok(r.entry.maxAnisotropy<2);return r.entry});
  const atlas=uv.packAtlas(r.raw,{...uv.DEFAULT_UNWRAP,rotate:false}),all=new Map(atlas.packed.flatMap(p=>[...p.faceUVs])),small={...mesh,faces:bottom.faces.map(i=>({...mesh.faces[i],uvs:all.get(i)}))};
  const ids=[...new Set(small.faces.flatMap(f=>f.vertices))],mapping=new Map(ids.map((id,i)=>[id,i]));const compact={...small,positions:ids.map(id=>small.positions[id]),faces:small.faces.map(f=>({...f,vertices:f.vertices.map(v=>mapping.get(v))}))};await writeFile(`${out}/Corset-bottom-${panels}.obj`,core.meshToOBJ(compact));await writeFile(`${out}/Corset-bottom-${panels}-source-map.json`,JSON.stringify({sourceChart:12,sourceFaces:bottom.faces,sourceVertices:ids}));results.push({panels,entry:r.entry,diagnostics:r.diagnostics,packed:atlas.packed.map(p=>({...p,faceUVs:[...p.faceUVs]}))});
 }
 await writeFile(`${out}/report.json`,JSON.stringify({passed:checks.length,checks,identity,results},null,2));
}finally{await c.cleanup()}
