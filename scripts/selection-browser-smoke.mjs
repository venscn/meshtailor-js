/** Real 2D/3D input events on the shared production renderer and offline UI. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startChrome,delay} from './chrome-cdp.mjs';
const report={suite:'Island-first selection and graphite workspace',host:'Offline lab with production renderer, worker and shared selection policy; NOT full React Studio',cases:[]};
const browser=await startChrome();
const check=async(name,fn)=>{const details=await fn();report.cases.push({name,passed:true,details});console.log('PASS '+name);};
try{for(const dpr of [1,2]){
 const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:960,deviceScaleFactor:dpr,mobile:false});
 const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile('unfold-lab.html','utf8')});
 try{await page.waitFor('window.lab?.ready',20000);}catch(e){console.error(await page.evaluate('document.querySelector("#error")?.textContent'));throw e;}
 await page.evaluate(`(async()=>{window.testDrawing=await import(moduleURL('/apps/studio/src/unfold/uv-drawing.js'));window.testCamera=await import(moduleURL('/apps/studio/src/unfold/camera-math.js'));})()`);
 const state=()=>page.evaluate('({islands:lab.inspection.islands,face:lab.options.focusFace,active:lab.options.selected,progress:lab.options.progress,playing:lab.playing})');
 const faceFor=(id,k=0)=>page.evaluate(`lab.snapshot.geometry.islands.find(i=>i.id===${id}).faces[${k}]`);
 const clickPoint=async({x,y},modifiers=0)=>{await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1,modifiers});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1,modifiers});await delay(45);};
 const uvPoint=fi=>page.evaluate(`(()=>{const fi=${fi},c=lab.snapshot.packed.find(c=>c.faceUVs.has(fi)),uv=c.faceUVs.get(fi).map(p=>lab.uv.displayUV(c,p)),r=document.querySelector('#uv').getBoundingClientRect(),t=testDrawing.uvScreenFrame(lab.snapshot.geometry.atlas,r.width,r.height);return {x:r.x+t.ox+t.scale*uv.reduce((s,p)=>s+p[0]/3,0),y:r.y+t.oy-t.scale*uv.reduce((s,p)=>s+p[1]/3,0)};})()`);
 const clickUV=async(fi,mods=0)=>clickPoint(await uvPoint(fi),mods);
 const prefix=`DPR ${dpr}: `,f0=await faceFor(0),f1=await faceFor(0,1),f2=await faceFor(1),f3=await faceFor(2);
 await check(prefix+'default playback-all is not an explicit inspection selection',async()=>{const s=await state();assert.deepEqual(s.islands,[]);assert.equal(s.face,null);assert.equal(s.active.length,3);return s;});
 await check(prefix+'first real UV click selects island only',async()=>{await clickUV(f0);const s=await state();assert.deepEqual(s.islands,[0]);assert.equal(s.face,null);assert.equal(await page.evaluate('document.querySelector("#selection-coordinates").hidden'),true);return s;});
 await check(prefix+'second click selects triangle without changing geometry camera or progress',async()=>{
  await page.evaluate('lab.update({progress:.58})');const before=await page.evaluate('({p:lab.options.progress,c:JSON.stringify(lab.view.camera),g:[...lab.view.getPositions()]})');await clickUV(f0);const after=await page.evaluate('({p:lab.options.progress,c:JSON.stringify(lab.view.camera),g:[...lab.view.getPositions()]})');assert.equal((await state()).face,f0);assert.deepEqual(after,before);assert.equal(await page.evaluate('document.querySelector("#selection-coordinates").hidden'),false);
 });
 await check(prefix+'repeated click cancels triangle and preserves island',async()=>{await clickUV(f0);const s=await state();assert.equal(s.face,null);assert.deepEqual(s.islands,[0]);assert.equal(s.progress,.58);return s;});
 await check(prefix+'another triangle replaces the selected face',async()=>{await clickUV(f0);await clickUV(f1);assert.equal((await state()).face,f1);});
 await check(prefix+'first click on another island clears face and never auto-selects a new one',async()=>{await clickUV(f2);const s=await state();assert.deepEqual(s.islands,[1]);assert.equal(s.face,null);return s;});
 await check(prefix+'island-list click and number label never choose a triangle',async()=>{await clickUV(f2);await page.evaluate('document.querySelectorAll("#islands button")[0].click()');assert.equal((await state()).face,null);await clickUV(f0);await page.evaluate('document.querySelector("#view .unfold-labels button").click()');assert.equal((await state()).face,null);assert.deepEqual((await state()).islands,[0]);});
 await check(prefix+'modifier selection adds an island without selecting face',async()=>{await clickUV(f2,8);const s=await state();assert.deepEqual(s.islands,[0,1]);assert.deepEqual(s.active,[0,1]);assert.equal(s.face,null);return s;});
 await check(prefix+'picking a triangle in a multiselection does not collapse its queue',async()=>{await page.evaluate('lab.update({progress:.7})');await clickUV(f0);const s=await state();assert.equal(s.face,f0);assert.deepEqual(s.active,[0,1]);assert.equal(s.progress,.7);});
 await check(prefix+'modifier deselects island and removes stale triangle focus',async()=>{await clickUV(f0,8);assert.deepEqual((await state()).islands,[1]);assert.equal((await state()).face,null);});
 await check(prefix+'Escape first removes triangle then islands',async()=>{
  await clickUV(f2);assert.equal((await state()).face,f2);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.equal((await state()).face,null);assert.deepEqual((await state()).islands,[1]);
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});assert.deepEqual((await state()).islands,[]);
 });
 await check(prefix+'real 3D ray pick selects triangle only after explicit island selection; UV click cancels it',async()=>{
  await page.evaluate('lab.select(0);lab.update({progress:1});lab.view.fit("uv")');await delay(100);
  const r=await page.evaluate(`(()=>{const v=lab.view,r=v.canvas.getBoundingClientRect(),m=testCamera.cameraMatrix(v.camera,r.width/r.height),pos=v.getPositions();for(const fi of lab.snapshot.geometry.islands[0].faces){const p=[0,1,2].map(a=>(pos[fi*9+a]+pos[fi*9+3+a]+pos[fi*9+6+a])/3),q=testCamera.projectPoint(p,m,r.width,r.height);if(!q||q[0]<0||q[0]>r.width||q[1]<0||q[1]>r.height)continue;const hit=testCamera.pickFace(pos,v.camera,r.width/r.height,q[0]/r.width*2-1,1-q[1]/r.height*2);if(hit===fi)return {x:r.x+q[0],y:r.y+q[1],fi};}throw Error('No visible face centroid');})()`);
  await clickPoint(r);assert.equal((await state()).face,r.fi);await clickUV(r.fi);assert.equal((await state()).face,null);assert.equal((await state()).progress,1);return r;
 });
 await check(prefix+'face toggles during playback keep the clock and queue running',async()=>{
  await page.evaluate('lab.update({progress:.3});document.querySelector("#play").click()');await clickUV(f0);assert.equal((await state()).playing,true);assert.equal((await state()).face,f0);const before=(await state()).progress;await delay(120);assert.ok((await state()).progress>before);await clickUV(f0);assert.equal((await state()).face,null);assert.equal((await state()).playing,true);await page.evaluate('lab.pause()');
 });
 await check(prefix+'dragging camera never selects a triangle',async()=>{
  const r=await page.evaluate('(()=>{const r=lab.view.canvas.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.4};})()');const camera=await page.evaluate('JSON.stringify(lab.view.camera)');
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r.x+50,y:r.y+20,button:'left',buttons:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:r.x+50,y:r.y+20,button:'left',buttons:0});await delay(40);assert.equal((await state()).face,null);assert.notEqual(await page.evaluate('JSON.stringify(lab.view.camera)'),camera);
 });
 await check(prefix+'switching tool tabs keeps the mesh UV and camera',async()=>{
  await page.evaluate('window.savedSnapshot=lab.snapshot;window.savedCamera=JSON.stringify(lab.view.camera)');
  for(const name of ['mesh','uv','animation']){await page.evaluate(`document.querySelector('[data-tool="${name}"]').click()`);assert.equal(await page.evaluate(`document.querySelector('#lab-tools-${name}').hidden`),false);assert.equal(await page.evaluate('document.querySelectorAll("[role=tabpanel]:not([hidden])").length'),1);}
  assert.ok(await page.evaluate('savedSnapshot===lab.snapshot&&savedCamera===JSON.stringify(lab.view.camera)'));
 });
 await check(prefix+'new UV snapshot clears all face and island inspection',async()=>{await clickUV(f3);await clickUV(f3);await page.evaluate('document.querySelector("#cube").click()');await page.waitFor('lab.ready&&lab.snapshot.packed.length===6',20000);assert.deepEqual((await state()).islands,[]);assert.equal((await state()).face,null);});
 await check(prefix+'bounded canvas drawing buffers and independent scroll panels',async()=>{
  const r=await page.evaluate('(()=>{const c=lab.view.canvas,r=c.getBoundingClientRect();return {w:r.width,h:r.height,cw:c.clientWidth,ch:c.clientHeight,bw:c.width,bh:c.height,body:document.body.scrollWidth,width:innerWidth,sidebar:getComputedStyle(document.querySelector(".lab-tool-content")).overflowY,background:getComputedStyle(document.querySelector(".layout>aside")).backgroundImage};})()');assert.equal(r.body,r.width);assert.ok(r.h>200);assert.equal(r.bw,Math.round(r.cw*dpr));assert.equal(r.bh,Math.round(r.ch*dpr));assert.equal(r.sidebar,'auto');assert.equal(r.background,'none');return r;
 });
 if(dpr===1){
  for(const width of [1117,900,600]){await page.send('Emulation.setDeviceMetricsOverride',{width,height:960,deviceScaleFactor:1,mobile:false});await delay(130);await check(`responsive ${width}px: no horizontal overflow and visible canvas`,async()=>{const r=await page.evaluate('({body:document.body.scrollWidth,width:innerWidth,h:lab.view.canvas.clientHeight,w:lab.view.canvas.clientWidth})');assert.ok(r.body<=r.width);assert.ok(r.w>150&&r.h>120);return r;});}
  await page.send('Emulation.setDeviceMetricsOverride',{width:1500,height:960,deviceScaleFactor:1,mobile:false});await page.evaluate('document.querySelector("#ribbon").click()');await page.waitFor('lab.ready&&lab.snapshot.packed.length===3');await page.evaluate('lab.select(1);lab.update({progress:.53})');await delay(150);
  const i=process.argv.indexOf('--screenshot');if(i>=0)await writeFile(process.argv[i+1],Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
 }
 await check(prefix+'no uncaught browser errors and successful GPU draw',async()=>{assert.deepEqual(await page.evaluate('lab.errors'),[]);assert.equal(await page.evaluate('lab.view.gl.getError()'),0);});
 page.close();
}
report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.passed+' cases');
}finally{await browser.close();}
