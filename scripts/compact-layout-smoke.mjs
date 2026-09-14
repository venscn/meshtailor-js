import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const d=demo.makeUnfoldDemo(),p=uv.sourceUVPreview(d.mesh,uv.buildCharts(d.mesh,d.edges)),g=uv.buildUnfoldGeometry(d.mesh,p,d.edges),ids=g.islands.map(i=>i.id);
 const a=uv.hingeLayout(g,ids,.12),one=uv.hingeLayout(g,[ids[0]],.12);
 assert.deepEqual(a.get(ids[0]),one.get(ids[0]));checks++;
 for(const island of g.islands){assert.ok(Math.hypot(...a.get(island.id).map((v,k)=>v-island.sourceCenter[k]))<=.2400001);}checks++;
 const zero=uv.hingeLayout(g,ids,0);for(const i of g.islands)assert.deepEqual(zero.get(i.id),i.sourceCenter);checks++;
 const order=uv.hingeLayout(g,[...ids].reverse(),.12);for(const id of ids)assert.deepEqual(order.get(id),a.get(id));checks++;
 const hugeRig={...g,hinge:{...g.hinge,islands:g.hinge.islands.map(i=>({...i,radius:1e9}))}};
 assert.deepEqual(uv.hingeLayout(hugeRig,ids,.12),a);checks++;
 for(const i of g.islands)assert.ok(Math.hypot(...uv.separationOffset(i,999))<=1.0000001);checks++;
 const start=uv.writeUnfoldPositions(g,{progress:0,selected:ids,order:'together',path:'hinge',separation:.12});assert.deepEqual(start,g.source);checks++;
 const split=uv.writeUnfoldPositions(g,{progress:.18,holdNet:true,selected:[ids[0]],order:'together',path:'hinge',separation:.12});
 for(let i=0;i<split.length;i+=3)assert.ok(Math.hypot(split[i]-g.source[i],split[i+1]-g.source[i+1],split[i+2]-g.source[i+2])<=.240001);checks++;
 const end=uv.writeUnfoldPositions(g,{progress:1,selected:ids,order:'together',path:'hinge',separation:.12});assert.deepEqual(end,g.target);checks++;
 const timeline=uv.buildMotionTimeline(g,{selected:ids,order:'sequential',path:'hinge',separation:0,holdNet:false});
 for(const e of timeline.entries)assert.ok(e.profile.segments.filter(s=>s.stage==='分离').every(s=>!s.keep));checks++;
 assert.throws(()=>uv.separationOffset(g.islands[0],NaN),/Separation/);checks++;
 console.log(`${checks} compact-layout checks passed`);
}finally{await c.cleanup();}
