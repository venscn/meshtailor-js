import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];
const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
try{
 const u=await c.load('packages/uv/src/index.js');
 const make=(id,d)=>u.createMotionProfile(id,d===0?[{from:0,to:1,stage:'static',keep:false}]:d===1?[{from:0,to:1,stage:'move',keep:true}]:[{from:0,to:d,stage:'move',keep:true},{from:d,to:1,stage:'static',keep:false}]);
 check('Removed time is not redistributed to moving spans',()=>{const p=make(0,.3),q=u.createMotionTimeline([p],.85);near(q.span,.3);near(u.unfoldDuration(12,1,'relay',.85,q),3.6);near(u.motionPose(p,.5),.15);});
 check('Skipped stage buttons collapse to the same physical instant',()=>{const p=make(0,.3);near(u.motionLocal(p,.4),u.motionLocal(p,.9));});
 check('Exact source and target endpoints preserved',()=>{for(const d of [0,.001,.7,1]){const p=make(0,d);assert.equal(u.motionPose(p,0),0);assert.equal(u.motionPose(p,1),1);}});
 check('Zero-duration queue terminates even with looping requested',()=>{const q=u.createMotionTimeline([make(0,0),make(1,0)],.85);assert.equal(q.span,0);assert.deepEqual(u.advanceUnfoldPlayback(0,0,0,false,true),{progress:1,finished:true});});
 check('Very short successor never overtakes a long predecessor',()=>{const q=u.createMotionTimeline([make(0,1),make(1,.001),make(2,1)],.75);assert.ok(q.entries[1].start>=.999);assert.ok(q.entries[1].end>q.entries[0].end);assert.ok(q.entries[2].start>=q.entries[0].end);});
 for(const order of ['relay','sequential'])check(`Variable/zero durations: no dead tail, gaps or >2 active (${order})`,()=>{
  const ds=[0,.9,.001,0,0,.1,.8,.01,1,0],q=u.createMotionTimeline(ds.map((d,i)=>make(i,d)),order==='relay'?.85:1);
  for(let k=1;k<2000;k++){const t=k/2000,s=u.sampleMotionTimeline(q,t);assert.equal(s.completed+s.waiting+s.active.length,ds.length);assert.ok(s.active.length<=2);assert.ok(s.active.length>=1,'idle interior');for(const a of s.active)if(a.index>0)assert.ok(u.motionProgress(q,t,a.index-1)>=.85-1e-9);}
  assert.equal(u.sampleMotionTimeline(q,1).completed,ds.length);
 });
 check('Stage seek and reverse read the same compacted timeline',()=>{const q=u.createMotionTimeline([make(0,.1),make(1,.75),make(2,1)],.85);for(let i=0;i<3;i++)for(const p of [.2,.7,.95])near(u.motionProgress(q,u.motionSeek(q,p,i),i),p);});
 check('Malformed profile fails explicitly',()=>{assert.throws(()=>u.createMotionProfile(0,[{from:.1,to:1,stage:'bad',keep:true}]));assert.throws(()=>u.createMotionTimeline([make(0,1)],.2));});
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({suite:'Motion-aware variable timeline',passed:cases.length,cases},null,2)+'\n');
}finally{await c.cleanup();}
