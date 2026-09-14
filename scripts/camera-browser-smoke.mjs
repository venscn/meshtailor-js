/** Real RAF playback + real mouse input in the shared WebGL renderer and offline UI.
 * This is not a substitute for the separate React/Vite Studio end-to-end suite.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { startChrome, delay } from './chrome-cdp.mjs';
const report={suite:'Free camera during actual hinge playback',host:'Offline lab with production WebGL renderer, classic UV Worker, real CDP mouse input',softwareWebGL:process.env.CHROME_SOFTWARE_WEBGL==='1',cases:[]};
const browser=await startChrome();
const check=async(name,fn)=>{const details=await fn();report.cases.push({name,passed:true,...(details?{details}:{})});console.log('PASS',name);};
try {
  for(const dpr of [1,2]){
    const page=await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:dpr,mobile:false});
    const tree=await page.send('Page.getFrameTree');
    await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});
    await page.waitFor('window.lab?.ready',20000);
    const prefix=`DPR ${dpr}: `;
    const camera=()=>page.evaluate('lab.view.getCamera()');
    const progress=()=>page.evaluate('lab.options.progress');
    const point=()=>page.evaluate('(()=>{const r=lab.view.canvas.getBoundingClientRect();return {x:r.x+r.width*.56,y:r.y+r.height*.45};})()');
    const play=async(t=.36,{reverse=false,loop=false,seconds=12}={})=>{
      await page.evaluate(`lab.pause();lab.update({progress:${t},order:'together',path:'hinge',labels:false,showHinges:false});document.querySelector('#reverse').checked=${reverse};document.querySelector('#loop').checked=${loop};document.querySelector('#seconds').value='${seconds}';document.querySelector('#play').click();`);
      await page.waitFor(`lab.playing && lab.options.progress!==${t}`);
    };
    const stable=async()=>{const after=await camera(),t=await progress();await delay(180);assert.deepEqual(await camera(),after);assert.notEqual(await progress(),t,'animation must keep running');assert.equal(await page.evaluate('lab.playing'),true);return after;};
    const drag=async(button,dx,dy)=>{
      const p=await point(),buttons=button==='right'?2:1;
      await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button,buttons,clickCount:1});
      for(let i=1;i<=4;i++){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+dx*i/4,y:p.y+dy*i/4,button,buttons});await delay(25);}
      await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+dx,y:p.y+dy,button,buttons:0,clickCount:1});await delay(40);
    };
    const wheel=async(deltaY=-180)=>{await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',...await point(),deltaX:0,deltaY});await delay(60);};
    const follow=async(enabled)=>{await page.evaluate(`if(document.querySelector('#frame').checked!==${enabled})document.querySelector('#frame').click()`);};
    await check(prefix+'hinge path defaults to manual mode in UI and renderer',async()=>{assert.equal(await page.evaluate('lab.options.path'),'hinge');assert.equal(await page.evaluate('lab.options.autoFrame'),false);assert.equal(await page.evaluate('document.querySelector("#frame").checked'),false);assert.equal(await page.evaluate('lab.view.canvas.dataset.cameraMode'),'manual');});
    await check(prefix+'actual play advances geometry while preserving the whole camera',async()=>{const before=await camera();await play();await stable();assert.deepEqual(await camera(),before);assert.equal(await page.evaluate('lab.view.canvas.dataset.glError'),'0');});
    await check(prefix+'orbit drag during play changes yaw/pitch and survives later frames',async()=>{const before=await camera();await drag('left',62,25);const after=await stable();assert.notEqual(after.yaw,before.yaw);assert.notEqual(after.pitch,before.pitch);});
    await check(prefix+'right-button pan during play changes target without snap-back',async()=>{const before=await camera();await drag('right',-55,31);const after=await stable();assert.notDeepEqual(after.target,before.target);assert.equal(after.distance,before.distance);});
    await check(prefix+'wheel zoom during play remains exactly where the user leaves it',async()=>{const before=await camera();await wheel();const after=await stable();assert.ok(after.distance<before.distance);assert.deepEqual(after.target,before.target);});
    await check(prefix+'pause/resume and reverse playback never reset the manual camera',async()=>{const before=await camera();await page.evaluate('lab.pause()');await delay(100);assert.deepEqual(await camera(),before);await play(.55,{reverse:true});const t=await progress();await stable();assert.ok((await progress())<t);assert.deepEqual(await camera(),before);});
    await check(prefix+'forward and reverse loop boundaries keep the camera',async()=>{const before=await camera();await play(.997,{loop:true,seconds:1});await delay(150);assert.ok((await progress())<.8);assert.deepEqual(await camera(),before);await play(.003,{reverse:true,loop:true,seconds:1});await delay(150);assert.ok((await progress())>.2);assert.deepEqual(await camera(),before);await page.evaluate('lab.pause()');});
    await check(prefix+'scrubbing all stages and switching scope/path never performs an implicit fit',async()=>{const before=await camera();await page.evaluate(`lab.pause();for(const path of ['hinge','staged','direct'])for(const progress of [0,.18,.28,.52,.75,.86,1,.31])lab.update({path,progress});lab.select(lab.snapshot.geometry.islands[0].id);lab.update({order:'sequential',progress:.62,context:'hidden'});document.querySelector('#all').click();lab.update({path:'hinge',order:'together',context:'dim'});`);assert.deepEqual(await camera(),before);});
    await check(prefix+'opt-in follow starts immediately when paused, not only at next frame',async()=>{await page.evaluate('lab.pause();lab.update({progress:.35})');await wheel(-200);const before=await camera();await follow(true);assert.equal(await page.evaluate('lab.view.canvas.dataset.cameraMode'),'follow');assert.notEqual((await camera()).distance,before.distance);const c=await camera();await page.evaluate('lab.update({progress:.53})');assert.notDeepEqual(await camera(),c);});
    for(const kind of ['orbit','pan','zoom']){
      await check(prefix+`manual ${kind} interrupts opt-in follow, updates checkbox and keeps playback running`,async()=>{
        await follow(false);await follow(true);await play(.4);
        if(kind==='zoom')await wheel(-140);else await drag(kind==='pan'?'right':'left',40,20);
        assert.equal(await page.evaluate('document.querySelector("#frame").checked'),false);
        assert.equal(await page.evaluate('lab.options.autoFrame'),false);
        assert.equal(await page.evaluate('lab.view.canvas.dataset.cameraMode'),'manual');await stable();
      });
    }
    await check(prefix+'late enabled UI props cannot re-enable follow after a gesture',async()=>{
      await page.evaluate('lab.pause();window.originalManualCallback=lab.view.onCameraManual;window.manualNotifications=0;lab.view.onCameraManual=()=>manualNotifications++;lab.update({autoFrame:false});lab.update({autoFrame:true});');await play(.4);await wheel(-130);
      assert.equal(await page.evaluate('lab.options.autoFrame'),true,'deliberately stale parent props');assert.equal(await page.evaluate('manualNotifications'),1);
      await stable();assert.equal(await page.evaluate('lab.view.canvas.dataset.cameraMode'),'manual');
      await page.evaluate('lab.view.onCameraManual=originalManualCallback;lab.update({autoFrame:false})');
    });
    await check(prefix+'fit current selection is one-shot, keeps orbit orientation and does not pause play',async()=>{await follow(true);const before=await camera();await page.evaluate('document.querySelector("#fit-current").click()');const after=await stable();assert.equal(after.yaw,before.yaw);assert.equal(after.pitch,before.pitch);assert.equal(await page.evaluate('lab.options.autoFrame'),false);});
    await check(prefix+'3D/UV view buttons fit once and hand control straight back to the user',async()=>{await page.evaluate('document.querySelector("#front").click()');assert.equal((await camera()).yaw,0);assert.equal((await camera()).pitch,0);await stable();await drag('left',35,15);await stable();await page.evaluate('document.querySelector("#orbit").click()');assert.equal((await camera()).yaw,.38);await stable();});
    await check(prefix+'held pointer suspends follow and cancellation never re-enables it',async()=>{
      await page.evaluate('lab.pause();lab.update({autoFrame:false});lab.update({autoFrame:true})');await play(.4);
      const p=await point();await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',buttons:2,clickCount:1});const before=await camera();await delay(160);assert.deepEqual(await camera(),before);
      await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x+30,y:p.y+10,button:'right',buttons:2});
      await page.evaluate(`lab.view.canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:lab.view.pointer.id,bubbles:true}))`);
      await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x+30,y:p.y+10,button:'right',buttons:0,clickCount:1});assert.equal(await page.evaluate('lab.view.pointer'),null);await stable();
    });
    await check(prefix+'viewport resizing changes projection size, not camera pose',async()=>{const before=await camera();await page.send('Emulation.setDeviceMetricsOverride',{width:1320,height:900,deviceScaleFactor:dpr,mobile:false});await delay(160);assert.deepEqual(await camera(),before);await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:1000,deviceScaleFactor:dpr,mobile:false});await delay(100);assert.deepEqual(await camera(),before);});
    await check(prefix+'re-solving UV for the same source mesh retains the manual camera',async()=>{await page.evaluate('lab.pause()');const before=await camera();await page.evaluate('lab.solve()');await page.waitFor('lab.ready',20000);assert.deepEqual(await camera(),before);});
    if(dpr===1){
      await check('WebGL context recovery reuploads buffers without resetting the manual camera',async()=>{const before=await camera();await page.evaluate('window.loseExt=lab.view.gl.getExtension("WEBGL_lose_context");loseExt.loseContext()');await page.waitFor('lab.view.lost');await delay(100);await page.evaluate('loseExt.restoreContext()');await page.waitFor('!lab.view.lost');assert.deepEqual(await camera(),before);await page.waitFor('lab.view.canvas.dataset.glError==="0"');});
    }
    await check(prefix+'source/UV endpoints and real WebGL drawing are unchanged',async()=>{await page.evaluate('lab.update({progress:0})');assert.equal(await page.evaluate('lab.view.canvas.dataset.sourceError'),'0');await page.evaluate('lab.update({progress:1})');assert.equal(await page.evaluate('lab.view.canvas.dataset.targetError'),'0');assert.deepEqual(await page.evaluate('lab.errors'),[]);assert.equal(await page.evaluate('document.querySelectorAll("#view canvas").length'),1);});
    page.close();
  }
  report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS',report.passed,'camera browser cases');
}finally{await browser.close();}
