import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS',name);};
try{
 const uv=await c.load('packages/uv/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const {mesh,edges}=demo.makeHingeDemo(),atlas=uv.unwrapMesh(mesh,edges),g=uv.buildUnfoldGeometry(mesh,atlas.packed,new Set(atlas.seams));const ids=g.islands.map(i=>i.id);
 const opts={progress:0,selected:ids,order:'together',path:'hinge',separation:.6,hingeWave:true};
 const pt=(buf,fi,k)=>[buf[fi*9+k*3],buf[fi*9+k*3+1],buf[fi*9+k*3+2]],dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
 check('Three bent islands retained; no automatic triangle-per-island proxy',()=>assert.equal(ids.length,3));
 check('Visible interior hinges actually exist',()=>assert.ok(g.hinge.hingeEdges.length>=18));
 for(const order of ['together','sequential']){
 check(order+' exact 3D endpoint',()=>assert.deepEqual(uv.writeUnfoldPositions(g,{...opts,order}),g.source));
 check(order+' exact exported UV endpoint',()=>assert.deepEqual(uv.writeUnfoldPositions(g,{...opts,order,progress:1}),g.target));
 }
 for(const wave of [false,true]){
 check(`Every face edge length preserved throughout rigid phases (wave=${wave})`,()=>{
  for(const t of [.03,.18,.22,.28,.31,.42,.55,.64,.7,.77]){const out=uv.writeUnfoldPositions(g,{...opts,progress:t,hingeWave:wave});for(let fi=0;fi<mesh.faces.length;fi++)for(let k=0;k<3;k++)assert.ok(Math.abs(dist(pt(out,fi,k),pt(out,fi,(k+1)%3))-dist(pt(g.source,fi,k),pt(g.source,fi,(k+1)%3)))<2e-6);}
 });
 check(`Parent-child hinge endpoints remain welded at every pose (wave=${wave})`,()=>{
  for(const t of [.19,.29,.42,.55,.67,.75]){const out=uv.writeUnfoldPositions(g,{...opts,progress:t,hingeWave:wave});for(let fi=0;fi<mesh.faces.length;fi++){const p=g.hinge.parent[fi];if(p<0)continue;for(const vi of mesh.faces[fi].vertices)if(mesh.faces[p].vertices.includes(vi)){assert.ok(dist(pt(out,fi,mesh.faces[fi].vertices.indexOf(vi)),pt(out,p,mesh.faces[p].vertices.indexOf(vi)))<2e-6);}}}
 });
 }
 check('Rigid net is actually planar, not projection of folded vertices',()=>{
 const out=uv.writeUnfoldPositions(g,{...opts,progress:.75});for(const i of g.islands){const zs=i.faces.flatMap(fi=>[0,1,2].map(k=>out[fi*9+k*3+2]));assert.ok(Math.max(...zs)-Math.min(...zs)<2e-6);}
 });
 check('Developable ribbons need NO temporary curvature cuts',()=>assert.equal(g.hinge.temporaryCuts.length,0));
 check('All seven stage joins continuous',()=>{for(const t of [.18,.28,.7,.8,.92]){const a=uv.writeUnfoldPositions(g,{...opts,progress:t-1e-7}),b=uv.writeUnfoldPositions(g,{...opts,progress:t+1e-7});a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<2e-5));}});
 check('Backward scrub has no accumulated transform drift',()=>{const b=new Float32Array(g.source.length);uv.writeUnfoldPositions(g,{...opts,progress:.93},b);uv.writeUnfoldPositions(g,{...opts,progress:.39},b);assert.deepEqual(b,uv.writeUnfoldPositions(g,{...opts,progress:.39}));});
 check('Unselected islands do not move',()=>{const out=uv.writeUnfoldPositions(g,{...opts,selected:[ids[1]],progress:.61});for(const i of g.islands)if(i.id!==ids[1])for(const fi of i.faces)assert.deepEqual(out.slice(fi*9,fi*9+9),g.source.slice(fi*9,fi*9+9));});
 check('Workbench islands have non-overlapping bounding spheres',()=>{const layout=uv.hingeLayout(g,ids,.6);for(let i=0;i<ids.length;i++)for(let j=0;j<i;j++){const a=g.hinge.islands[i],b=g.hinge.islands[j];assert.ok(dist(layout.get(a.id),layout.get(b.id))>a.radius+b.radius);}});
 check('Single-island workbench is centered instead of using old atlas slot',()=>assert.deepEqual(uv.hingeLayout(g,[ids[2]],.6).get(ids[2]),[0,0,0]));
 console.log(`${passed} hinge regressions passed.`);
}finally{await c.cleanup();}
