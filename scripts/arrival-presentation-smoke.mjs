import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];
const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name)};
try {
 const {ArrivalPresentation,arrivalSettings}=await c.load('apps/studio/src/unfold/arrival-presentation.js');
 const uv=await c.load('packages/uv/src/index.js'),a=new ArrivalPresentation();
 const o={progress:0,selected:[10,4,8],order:'relay',handoff:.85,path:'direct',separation:0,interactionActive:true,focusMode:'ghost',animationDurationSeconds:32.4};
 const end=1/2.7,at=age=>({...o,progress:end+age/32.4});
 check('Defaults are 1x animation seconds',()=>assert.deepEqual(arrivalSettings({}),{hold:.8,fade:1}));
 check('No tail before geometric arrival',()=>assert.deepEqual(a.update(at(-.01)),[]));
 check('Full colour at exact arrival',()=>assert.equal(a.update(at(0))[0].opacity,1));
 check('Hold in timeline coordinates',()=>assert.equal(a.update(at(.79))[0].phase,'hold'));
 check('Mid fade at 1.3 animation seconds',()=>assert.ok(Math.abs(a.update(at(1.3))[0].opacity-.59)<1e-12));
 check('Tail ends after 1.8 animation seconds',()=>assert.deepEqual(a.update(at(1.801)),[]));
 check('Wall time cannot advance a stationary scrub',()=>assert.deepEqual(a.update(at(.4),0),a.update(at(.4),999999)));
 check('Seeking and reversed sampling produce identical states',()=>assert.deepEqual(a.update(at(1.3)),a.update({...at(1.3),playbackReverse:true})));
 check('Direct mid-timeline seek needs no arrival event history',()=>assert.deepEqual(new ArrivalPresentation().update(at(1.3)),a.update(at(1.3))));
 check('Rewind restores hold, not stale fade',()=>{a.update(at(1.3));assert.equal(a.update(at(.2))[0].phase,'hold')});
 for(const rate of [1,2,4,8,16,64])check(rate+'x advances the same track by rate-scaled time',()=>{
  const p=uv.advanceUnfoldPlayback(end,1300/rate,32.4,false,false,rate).progress;
  assert.ok(Math.abs(a.update({...o,progress:p})[0].opacity-.59)<1e-10);
 });
 check('Rate switch is continuous and uses current progress',()=>{const p=uv.advanceUnfoldPlayback(end,200,32.4,false,false,2).progress;const q=uv.advanceUnfoldPlayback(p,112.5,32.4,false,false,8).progress;assert.ok(Math.abs(a.update({...o,progress:q})[0].opacity-.59)<1e-10)});
 for(const focusMode of ['off','dither'])check(focusMode+' disables track',()=>assert.deepEqual(a.update({...at(.2),focusMode}),[]));
 check('Pause and scrub release restore original display',()=>assert.deepEqual(a.update({...at(1.3),interactionActive:false}),[]));
 check('Both global endpoints restore display',()=>{assert.deepEqual(a.update({...o,progress:0}),[]);assert.deepEqual(a.update({...o,progress:1}),[])});
 check('Zero durations disable track',()=>assert.deepEqual(a.update({...at(0),arrivalHoldSeconds:0,arrivalFadeSeconds:0}),[]));
 check('Compressed motion end and zero-duration islands',()=>{const profiles=[.4,0,.8].map((d,i)=>({id:i,segments:[],duration:d,skipped:1-d})),timeline=uv.createMotionTimeline(profiles,.85);const s=a.update({...o,timeline,selected:[0,1,2],animationDurationSeconds:timeline.span*12,progress:(.4+.05)/timeline.span});assert.deepEqual(s.map(x=>x.id),[0]);assert.ok(Math.abs(s[0].ageSeconds-.6)<1e-10)});
 check('No mutation to selection or geometry schedule',()=>{const before=JSON.stringify(o);a.update(at(1.3));assert.equal(JSON.stringify(o),before)});
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup()}
