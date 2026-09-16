/** Real WebGL/RAF/worker tests using the production modules in the offline lab. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const b=await startChrome(),cases=[];
const check=async(name,fn)=>{const details=await fn();cases.push({name,passed:true,...(details?{details}:{})});console.log('PASS',name);};
try{
 for(const dpr of [1,2]){
  const p=await b.page();await p.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:dpr,mobile:false});const tree=await p.send('Page.getFrameTree');
  await p.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});await p.waitFor('window.lab?.ready',20000);
  const prefix=`DPR ${dpr}: `,click=id=>p.evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  await check(prefix+'default automatically skips unchanged spans with camera independent',async()=>{
   assert.equal(await p.evaluate('lab.options.skipStatic'),true);assert.equal(await p.evaluate('document.getElementById("skip-static").checked'),true);assert.equal(await p.evaluate('lab.options.autoFrame'),false);
   assert.ok(await p.evaluate('lab.options.timeline.span<lab.uv.unfoldSpan(lab.options.selected.length,lab.options.order)'));
  });
  await check(prefix+'geometry profiling is cached, not rerun on every frame',async()=>{
   assert.equal(await p.evaluate('(()=>{const t=lab.options.timeline;for(let k=0;k<30;k++)lab.update({progress:k/30});return lab.options.timeline===t;})()'),true);
  });
  await click('cube');await p.waitFor('lab.ready && lab.snapshot.geometry.islands.length===6');
  await check(prefix+'flat cube skips hinge and UV fit, reducing 12s base to 4.8s per island',async()=>{
   const result=await p.evaluate('lab.options.timeline.entries.map(e=>({seconds:12*e.profile.duration,skipped:e.profile.segments.filter(s=>!s.keep).map(s=>s.stage)}))');
   assert.equal(result.length,6);for(const r of result){assert.ok(Math.abs(r.seconds-4.8)<1e-8);assert.ok(r.skipped.includes('铰链'));assert.ok(r.skipped.includes('UV 形变'));}return {islands:result};
  });
  await check(prefix+'skipped stage buttons collapse to one displayed pose',async()=>{
   await click('queue-next');await p.evaluate('document.querySelector("[data-stage=\\"0.28\\"]").click()');const a=await p.evaluate('({progress:lab.options.progress,positions:[...lab.view.getPositions()]})');
   await p.evaluate('document.querySelector("[data-stage=\\"0.92\\"]").click()');const z=await p.evaluate('({progress:lab.options.progress,positions:[...lab.view.getPositions()]})');assert.deepEqual(a,z);
  });
  await check(prefix+'scrub uses identical compact clocks for poses, state and phase labels',async()=>{
   const r=await p.evaluate(`(()=>{const g=lab.snapshot.geometry;let maxActive=0;for(let k=0;k<=200;k++){lab.update({progress:k/200});const o=lab.options,x=lab.view.getPositions(),q=o.timeline;const s=lab.uv.sampleMotionTimeline(q,o.progress);const shown=JSON.parse(lab.view.canvas.dataset.animating);if(shown.length!==s.active.length)throw Error('state mismatch');maxActive=Math.max(maxActive,shown.length);for(let i=0;i<q.entries.length;i++){const local=lab.uv.motionProgress(q,o.progress,i),island=g.islands.find(v=>v.id===q.entries[i].profile.id);for(const fi of island.faces)for(let j=0;j<9;j++){const n=fi*9+j;if(local===0&&x[n]!==g.source[n])throw Error('waiting moved');if(local===1&&x[n]!==g.target[n])throw Error('finished moved');}}}return {samples:201,maxActive};})()`);assert.equal(r.maxActive,2);return r;
  });
  await check(prefix+'no long motionless interior intervals across dense whole-queue sampling',async()=>{
   const r=await p.evaluate(`(()=>{let previous=null,staticRun=0,maxRun=0;for(let k=0;k<=400;k++){lab.update({progress:k/400});const x=lab.view.getPositions().slice();let delta=0;if(previous)for(let j=0;j<x.length;j++)delta=Math.max(delta,Math.abs(x[j]-previous[j]));staticRun=previous&&delta<1e-7?staticRun+1:0;maxRun=Math.max(maxRun,staticRun);previous=x;}return {maxStaticSamples:maxRun};})()`);assert.ok(r.maxStaticSamples<=1);return r;
  });
  await check(prefix+'skip switch restores fixed 12s stages for comparison, then re-enables compaction',async()=>{await click('skip-static');assert.equal(await p.evaluate('lab.options.skipStatic'),false);assert.equal(await p.evaluate('lab.options.timeline.entries[0].profile.duration'),1);await click('skip-static');assert.ok(await p.evaluate('lab.options.timeline.entries[0].profile.duration<.5'));});
  await check(prefix+'manual teaching hold remains opt-in even with automatic pruning enabled',async()=>{await click('hold-net');assert.equal(await p.evaluate('lab.options.timeline.entries[0].profile.segments.find(s=>s.stage==="主动观察停留").keep'),true);await click('hold-net');});
  await check(prefix+'variable duration settings invalidate cached profile once',async()=>{assert.equal(await p.evaluate(`(()=>{const old=lab.options.timeline;lab.update({separation:.9,progress:0});return lab.options.timeline!==old;})()`),true);});
  await check(prefix+'area-ordered selection and strict mode use actual selected durations',async()=>{
   await p.evaluate('lab.select(4);lab.select(0,null,true);lab.update({order:"sequential",progress:0})');const entries=await p.evaluate('lab.options.timeline.entries');assert.deepEqual(entries.map(e=>e.profile.id),[0,4]);assert.equal(entries[1].start,entries[0].end);await click('all');await p.evaluate('lab.update({order:"relay",progress:0})');
  });
  for(const reverse of [false,true])await check(prefix+`actual ${reverse?'reverse':'forward'} RAF playback finishes on shortened clock with no tail`,async()=>{
   await p.evaluate(`lab.pause();document.getElementById('seconds').value='3';document.getElementById('reverse').checked=${reverse};document.getElementById('loop').checked=false;lab.update({progress:${reverse?1:0}});window.expectedSeconds=lab.options.timeline.span*Number(document.getElementById('seconds').value);window.started=performance.now();window.ended=null;window.samples=[];document.getElementById('play').click();function sample(){samples.push({t:performance.now(),progress:lab.options.progress,active:JSON.parse(lab.view.canvas.dataset.animating)});if(lab.playing)requestAnimationFrame(sample);else ended=performance.now();}requestAnimationFrame(sample);`);
   await p.waitFor(`!lab.playing && lab.options.progress===${reverse?0:1}`,15000);await p.waitFor('ended!==null');
   const result=await p.evaluate('({elapsed:(ended-started)/1000,expected:expectedSeconds,frames:samples.length,maximum:Math.max(...samples.map(x=>x.active.length)),islands:[...new Set(samples.flatMap(x=>x.active.map(a=>a.id)))]})');
   assert.ok(result.elapsed>=result.expected-.08&&result.elapsed<result.expected+.9,JSON.stringify(result));// Software rendering may skip the short overlap interval. The dense timeline
   // test above proves it exists; real RAF must never exceed the two-island bound.
   assert.ok(result.maximum>=1&&result.maximum<=2,JSON.stringify(result));assert.equal(result.islands.length,6);return result;
  });
  await check(prefix+'endpoints exactly match source and exported target positions',async()=>{
   const v=await p.evaluate(`(()=>{lab.update({progress:0});const s=lab.view.canvas.dataset.sourceError;lab.update({progress:1});return {source:s,target:lab.view.canvas.dataset.targetError};})()`);assert.deepEqual(v,{source:'0',target:'0'});
  });
  await check(prefix+'no runtime errors or WebGL errors',async()=>{assert.deepEqual(await p.evaluate('lab.errors'),[]);assert.equal(await p.evaluate('lab.view.canvas.dataset.glError'),'0');});
  if(dpr===1){await p.evaluate('document.getElementById("seconds").value="12";lab.update({progress:.19});lab.view.fitCurrent();');await delay(150);const i=process.argv.indexOf('--screenshot');if(i>=0){const shot=await p.send('Page.captureScreenshot',{format:'png'});await writeFile(process.argv[i+1],Buffer.from(shot.data,'base64'));}}
  p.close();
 }
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({suite:'Motion-aware playback: real offline UI / production renderer',passed:cases.length,cases},null,2)+'\n');
}finally{await b.close();}
