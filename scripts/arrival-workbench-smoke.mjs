/** Actual RAF/range-input lifecycle; no wall-clock arrival timers or renderer mocks. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const report={suite:'Timeline arrival / actual workbench playback rates and scrub',scope:'Offline workbench and shared production modules, not React root',cases:[]};
const browser=await startChrome();
try{
 const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1080,deviceScaleFactor:1,mobile:false});
 const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});await page.waitFor('window.lab?.ready',30000);
 const check=async(name,fn)=>{const details=await fn();report.cases.push({name,passed:true,details});console.log('PASS',name)};
 await page.evaluate(`document.querySelector('[data-tool=animation]').click();window.tail=()=>JSON.parse(lab.view.canvas.dataset.arrivalPresentation);window.savedSnapshot=lab.snapshot;window.savedCamera=JSON.stringify(lab.view.getCamera());window.endP=lab.options.timeline.entries[0].end/lab.options.timeline.span;window.firstID=lab.options.selected[0];window.D=lab.options.animationDurationSeconds;window.at=age=>lab.update({progress:endP+age/D});`);
 await check('Both controls label 1x animation seconds and retain defaults',async()=>{assert.equal(await page.evaluate('Number(document.querySelector("#arrival-hold").value)'),.8);assert.equal(await page.evaluate('Number(document.querySelector("#arrival-fade").value)'),1);assert.ok(await page.evaluate('document.querySelector("#arrival-hold").closest("label").textContent.includes("1×")'));assert.equal(await page.evaluate('lab.snapshot===savedSnapshot'),true)});
 await check('Actual RAF reaches exact target before fade',async()=>{await page.evaluate('lab.pause();at(-.12);document.querySelector("#rate").value="1";document.querySelector("#play").click()');await page.waitFor('tail().some(a=>a.id===firstID)',4000);const r=await page.evaluate('({a:tail(),playing:lab.playing,geometry:lab.snapshot.geometry.islands.find(i=>i.id===firstID).faces.every(fi=>lab.view.getPositions().slice(fi*9,fi*9+9).every((v,k)=>v===lab.snapshot.geometry.target[fi*9+k]))})');assert.equal(r.playing,true);assert.equal(r.geometry,true);assert.equal(r.a.find(x=>x.id===0)?.phase??r.a[0].phase,'hold');return r;}).catch(e=>{throw e;});
 await check('Changing speed during playback uses same progress track without a reset',async()=>{const r=await page.evaluate('(()=>{const p=lab.options.progress;document.querySelector("#rate").value="4";document.querySelector("#rate").dispatchEvent(new Event("input"));return{before:p,after:lab.options.progress,playing:lab.playing,D:lab.options.animationDurationSeconds};})()');assert.equal(r.before,r.after);assert.equal(r.playing,true);assert.equal(r.D,await page.evaluate('D'));await page.waitFor('tail().some(a=>a.phase==="fade")',2000);const a=await page.evaluate('tail()[0]');assert.ok(a.ageSeconds>=.8&&a.ageSeconds<1.8);return r});
 await check('Pause immediately restores previous context',async()=>{await page.evaluate('lab.pause()');assert.deepEqual(await page.evaluate('tail()'),[]);assert.equal(await page.evaluate('lab.view.canvas.dataset.playbackFocus'),'restored')});
 // A real pressed range input drives the scrub session. Hold it still longer
 // than the entire 1x tail; unlike v0.4.15 it must not advance presentation.
 await check('Stationary held scrub freezes arrival; forward scrub advances it',async()=>{
  await page.evaluate('lab.pause();at(-.15);window.r=document.querySelector("#progress").getBoundingClientRect();window.point=age=>({x:r.x+8+(r.width-16)*(endP+age/D),y:r.y+r.height/2});');
  const a=await page.evaluate('point(.25)');await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...a,button:'left',buttons:1});
  await page.waitFor('tail().some(a=>a.phase==="hold")',3000);const held=await page.evaluate('({p:lab.options.progress,a:tail()})');await delay(2000);assert.deepEqual(await page.evaluate('({p:lab.options.progress,a:tail()})'),held);
  const b=await page.evaluate('point(1.3)');await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',...b,button:'left',buttons:1});await page.waitFor('tail().some(a=>a.phase==="fade")',3000);assert.equal(await page.evaluate('lab.playing'),false);
  const mid=await page.evaluate('tail()');assert.ok(mid[0].weight<.8&&mid[0].weight>.2);
  // Drag backwards to earlier time and reproduce the hold.
  await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',...a,button:'left',buttons:1});await page.waitFor('tail().some(a=>a.phase==="hold")',3000);
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',...a,button:'left',buttons:0});assert.deepEqual(await page.evaluate('tail()'),[]);assert.equal(await page.evaluate('lab.options.interactionActive'),false);return {held,mid};
 });
 await check('1x and 4x real RAF share animation ages but differ in wall duration',async()=>{
  const samples=[];
  for(const rate of [1,4]){
   await page.evaluate(`lab.pause();document.querySelector('#rate').value='${rate}';document.querySelector('#reverse').checked=false;at(-.05);window.measure={start:performance.now(),hold:null,fade:null,end:null};document.querySelector('#play').click();window.monitor=function(){const a=tail().find(a=>a.id===firstID);if(a&&a.phase==='hold'&&measure.hold===null)measure.hold=performance.now();if(a&&a.phase==='fade'&&measure.fade===null)measure.fade=performance.now();if((lab.options.progress-endP)*D>=1.8){measure.end=performance.now();return;}if(lab.playing)requestAnimationFrame(monitor);};requestAnimationFrame(monitor);`);
   await page.waitFor('measure.end!==null',5000);const r=await page.evaluate('lab.pause();({...measure})');samples.push({rate,elapsed:r.end-r.start,hold:r.fade-r.hold});
  }
  assert.ok(samples[1].elapsed<samples[0].elapsed*.6,'4x must compress the real hold+fade');assert.ok(samples[1].hold<samples[0].hold*.7);return samples;
 });
 await check('Reverse playback restores fade and hold in reverse order',async()=>{await page.evaluate('document.querySelector("#rate").value="1";document.querySelector("#reverse").checked=true;at(1.35);document.querySelector("#play").click()');await page.waitFor('tail().some(a=>a.phase==="fade")',1500);await page.waitFor('tail().some(a=>a.phase==="hold")',2000);await page.evaluate('lab.pause();document.querySelector("#reverse").checked=false')});
 await check('Natural playback completion restores rather than adding unscaled delay',async()=>{await page.evaluate('lab.update({progress:.998});document.querySelector("#rate").value="64";document.querySelector("#play").click()');await page.waitFor('!lab.playing&&lab.options.progress===1',3000);assert.deepEqual(await page.evaluate('tail()'),[])});
 await check('No camera resets, geometry jobs or WebGL errors',async()=>{assert.equal(await page.evaluate('JSON.stringify(lab.view.getCamera())===savedCamera'),true);assert.equal(await page.evaluate('lab.snapshot===savedSnapshot'),true);assert.deepEqual(await page.evaluate('lab.errors'),[]);assert.equal(await page.evaluate('lab.view.gl.getError()'),0)});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2));
}finally{await browser.close()}
