import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { compileCore } from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'Shared late-relay island timeline',cases:[]};
const check=(name,fn)=>{fn();report.cases.push({name,passed:true});console.log('PASS',name);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} vs ${b}`);
try {
  const u=await c.load('packages/uv/src/index.js');
  check('Default is 85% relay, never a whole-mesh simultaneous start',()=>{assert.equal(u.DEFAULT_UNFOLD_ORDER,'relay');assert.equal(u.DEFAULT_HANDOFF,.85);near(u.unfoldSpan(3,'relay'),2.7);});
  check('A legacy together value migrates to relay, not synchronous playback',()=>{for(let i=0;i<3;i++)near(u.islandProgress(.2,i,3,'together'),u.islandProgress(.2,i,3,'relay'));});
  check('Per-island time determines real span (3 x 12s relay = 32.4s)',()=>near(u.unfoldDuration(12,3,'relay'),32.4));
  check('Strict serial starts only after the preceding complete island',()=>{near(u.unfoldDuration(12,3,'sequential'),36);near(u.islandProgress(1/3,0,3,'sequential'),1);near(u.islandProgress(1/3,1,3,'sequential'),0);});
  check('Zero and one selection have no synthetic queue or empty tail',()=>{assert.equal(u.unfoldSpan(0,'relay'),0);near(u.unfoldDuration(12,1,'relay'),12);assert.equal(u.sampleUnfoldSchedule(0,0,'relay').focusIndex,-1);});
  check('First island only at initial interior time',()=>assert.deepEqual([0,1,2].map(i=>u.islandProgress(.1,i,3,'relay')),[.27,0,0]));
  check('Second starts at predecessor 85%, with exact predecessor endpoint preserved',()=>{const t=u.islandTimelineProgress(.86,0,3,'relay');near(u.islandProgress(t,1,3,'relay'),.01);near(u.islandProgress(t,2,3,'relay'),0);});
  check('Handoff is bounded to 75–100%, never arbitrary many concurrent islands',()=>{assert.equal(u.unfoldHandoff('relay',0),.75);assert.equal(u.unfoldHandoff('relay',2),1);});
  for(const count of [1,3,97,2000])check(`No gaps, premature starts, early last completion, or >2 active islands (${count})`,()=>{
    for(const handoff of [.75,.85,1])for(let n=0;n<=130;n++){
      const t=n/130,s=u.sampleUnfoldSchedule(t,count,'relay',handoff);
      assert.equal(s.completed+s.waiting+s.active.length,count);assert.ok(s.active.length<=2);
      if(t>0&&t<1)assert.ok(s.completed<count);
      for(const a of s.active){if(a.index)assert.ok(u.islandProgress(t,a.index-1,count,'relay',handoff)>=handoff-1e-9);}
      if(t>0&&t<1&&!s.active.length)assert.equal(handoff,1,'only an exact strict boundary has no active interval');
    }
  });
  check('Local/global stage seeking round-trips through the same timeline',()=>{for(const order of ['relay','sequential'])for(let i=0;i<5;i++)for(const p of [0,.18,.4,.75,.92,1])near(u.islandProgress(u.islandTimelineProgress(p,i,5,order),i,5,order),p);});
  check('Reverse playback is the exact forward timeline read backwards',()=>{for(let i=0;i<3;i++)for(const t of [.02,.25,.5,.75,.98])near(u.islandProgress(1-t,i,3,'relay'),1-u.islandProgress(t,2-i,3,'relay'));});
  check('Stage focus stays on oldest unfinished island in overlap; reverse chooses newest',()=>{const t=u.islandTimelineProgress(.9,0,3,'relay');assert.equal(u.sampleUnfoldSchedule(t,3,'relay').focusIndex,0);assert.equal(u.sampleUnfoldSchedule(t,3,'relay',.85,true).focusIndex,1);});
  check('Last island runs to exactly 100% without trailing empty slots',()=>{const s=u.sampleUnfoldSchedule(.999,3,'relay');assert.equal(s.active.length,1);assert.equal(s.active[0].index,2);assert.equal(u.sampleUnfoldSchedule(1,3,'relay').completed,3);});
  check('No fixed hold by default; explicit hold preserves old geometric stage timing',()=>{near(u.hingePoseProgress(.75),.675);assert.ok(u.hingePoseProgress(.79)>.8);near(u.hingePoseProgress(.75,true),.75);near(u.hingePlaybackProgress(.7),u.hingePlaybackProgress(.8));});
  check('Finite frame elapsed time is never capped to 100ms',()=>near(u.advanceUnfoldPlayback(0,1000,12).progress,1/12));
  check('Slow and fast frames integrate the same active elapsed time',()=>{let a=0,b=0;for(let i=0;i<120;i++)a=u.advanceUnfoldPlayback(a,1000/60,12).progress;for(let i=0;i<4;i++)b=u.advanceUnfoldPlayback(b,500,12).progress;near(a,b);});
  check('Non-looping endpoint stops immediately with no 650ms artificial wait',()=>assert.deepEqual(u.advanceUnfoldPlayback(.99,500,12),{progress:1,finished:true}));
  check('Forward and reverse loops wrap with elapsed remainder',()=>{near(u.advanceUnfoldPlayback(.99,500,10,false,true).progress,.04);near(u.advanceUnfoldPlayback(.01,500,10,true,true).progress,.96);});
  check('Malformed timeline input fails explicitly, rather than NaN poses',()=>{for(const fn of [()=>u.unfoldSpan(-1,'relay'),()=>u.unfoldHandoff('relay',NaN),()=>u.islandProgress(NaN,0,3,'relay'),()=>u.unfoldDuration(0,3,'relay'),()=>u.advanceUnfoldPlayback(0,Infinity,1)])assert.throws(fn);});
  report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');
} finally {await c.cleanup();}
