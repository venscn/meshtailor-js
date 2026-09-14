import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name);};
try{
 const u=await c.load('packages/uv/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 function build(d){const a=u.unwrapMesh(d.mesh,d.edges);return u.buildUnfoldGeometry(d.mesh,a.packed,new Set(a.seams));}
 const cube=build(demo.makeUnfoldDemo()),ribbons=build(demo.makeHingeDemo());
 const opts=g=>({progress:0,selected:g.islands.map(i=>i.id),order:'relay',path:'hinge',separation:.45,hingeWave:true});
 check('Cube flat islands skip hinge stage without losing target UV',()=>{const o=opts(cube),t=u.buildMotionTimeline(cube,o);assert.ok(t.entries.every(e=>e.profile.segments.find(s=>s.stage==='铰链').keep===false));assert.ok(t.span<u.unfoldSpan(6,'relay'));assert.deepEqual(u.writeUnfoldPositions(cube,{...o,timeline:t,progress:1}),cube.target);console.log('cube per-island seconds at base 12:',t.entries.map(e=>12*e.profile.duration));});
 check('Developable bent ribbons keep actual hinge motion and skip redundant UV deformation',()=>{const t=u.buildMotionTimeline(ribbons,opts(ribbons));assert.ok(t.entries.every(e=>e.profile.segments.some(s=>s.stage==='铰链'&&s.keep)));assert.ok(t.entries.some(e=>e.profile.segments.some(s=>s.stage==='UV 形变'&&!s.keep)));});
 for(const [name,g]of [['cube',cube],['ribbon',ribbons]])check(`${name}: every dropped span is unchanged throughout, not just at endpoints`,()=>{
  const o=opts(g),q=u.buildMotionTimeline(g,o);for(let rank=0;rank<q.entries.length;rank++){
   const e=q.entries[rank],faces=g.islands[rank].faces;
   for(const s of e.profile.segments)if(!s.keep){
    const get=pose=>u.writeUnfoldPositions(g,{...o,holdNet:true,progress:u.islandTimelineProgress(pose,rank,q.entries.length,o.order)});
    const a=get(s.from);for(let j=1;j<=12;j++){const b=get(s.from+(s.to-s.from)*j/12);let delta=0;for(const fi of faces)for(let k=0;k<9;k++)delta=Math.max(delta,Math.abs(a[fi*9+k]-b[fi*9+k]));assert.ok(delta<1e-5,`${name} ${s.stage} moved ${delta}`);}
   }
  }
 });
 check('Stage-boundary scrub is continuous across removed time',()=>{const o=opts(cube),q=u.buildMotionTimeline(cube,o);for(let rank=0;rank<q.entries.length;rank++)for(const s of q.entries[rank].profile.segments){const time=u.motionSeek(q,u.motionLocal(q.entries[rank].profile,s.from),rank);const a=u.writeUnfoldPositions(cube,{...o,timeline:q,progress:Math.max(0,time-1e-7)}),b=u.writeUnfoldPositions(cube,{...o,timeline:q,progress:Math.min(1,time+1e-7)});for(let k=0;k<a.length;k++)assert.ok(Math.abs(a[k]-b[k])<1e-4);}});
 check('Explicit user hold is retained despite automatic skip',()=>{const q=u.buildMotionTimeline(cube,{...opts(cube),holdNet:true});assert.ok(q.entries.every(e=>e.profile.segments.find(s=>s.stage==='主动观察停留').keep));});
 check('Diagnostic skip-off retains the fixed-time schedule',()=>{const q=u.buildMotionTimeline(cube,opts(cube),{skipStatic:false});assert.ok(Math.abs(q.span-u.unfoldSpan(6,'relay'))<1e-9);});
 check('Analysis and rendering never mutate source, target, UV or hinge geometry',()=>{const before=structuredClone(ribbons);const o=opts(ribbons),timeline=u.buildMotionTimeline(ribbons,o);for(const p of [.7,.2,1,0])u.writeUnfoldPositions(ribbons,{...o,timeline,progress:p});assert.deepEqual(ribbons,before);});
 // A planar already-UV mesh can still move OUT and BACK via the staged path.
 const direct=structuredClone(cube);direct.target.set(direct.source);for(const i of direct.islands)i.targetCenter=[...i.sourceCenter];
 check('Equal overall endpoints do not remove real intermediate separation',()=>{const q=u.buildMotionTimeline(direct,{...opts(direct),path:'staged',separation:.5});assert.ok(q.entries.every(e=>e.profile.duration>.39));assert.ok(q.entries.every(e=>e.profile.segments.find(s=>s.stage==='展平').keep===false));});
 check('Entirely motionless direct path has zero duration and no phantom wait',()=>{const o={...opts(direct),path:'direct'},q=u.buildMotionTimeline(direct,o);assert.equal(q.span,0);assert.deepEqual(u.writeUnfoldPositions(direct,{...o,timeline:q,progress:1}),direct.target);});
 check('Relative tolerance still detects small but real islands',()=>{const g=structuredClone(direct);for(const i of g.islands)for(const fi of i.faces)g.target[fi*9]+=.001;const q=u.buildMotionTimeline(g,{...opts(g),path:'direct'});assert.ok(q.entries.every(e=>e.profile.duration===1));});
 check('Changing selection and separation rebuilds the actual workbench motion',()=>{const all=u.buildMotionTimeline(cube,opts(cube)),one=u.buildMotionTimeline(cube,{...opts(cube),selected:[0]});assert.equal(all.entries.length,6);assert.equal(one.entries.length,1);assert.ok(one.span<all.span);});
 check('Invalid tolerance fails explicitly',()=>assert.throws(()=>u.buildMotionTimeline(cube,opts(cube),{relativeEpsilon:NaN})));
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({suite:'Actual geometry motion pruning',passed:cases.length,cases},null,2)+'\n');
}finally{await c.cleanup();}
