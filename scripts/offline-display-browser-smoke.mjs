/** Actual bundled offline entry, not a replacement page or mock renderer.
 * Display-only changes must preserve solver inputs, selection and playback. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {startChrome,delay} from './chrome-cdp.mjs';

const argument=(name,fallback)=>{const index=process.argv.indexOf(name);return index<0?fallback:process.argv[index+1];};
const source=resolve(argument('--file','unfold-lab.html')),out=resolve(argument('--out','validation/local-offline-display'));
const html=await readFile(source,'utf8'),report={scope:'Actual offline HTML, DOM, Worker, Canvas and WebGL; not React Studio E2E',source,cases:[],passed:false};
await mkdir(out,{recursive:true});
const assets=JSON.parse(html.match(/window\.LAB_GEOMETRY=({[^;]+});/)?.[1]??'null');
assert.ok(assets,'The built HTML must contain the bundled geometry assets');
for(const id of ['corset','flight-helmet']){
  const mesh=JSON.parse(gunzipSync(Buffer.from(assets[id],'base64')).toString());
  assert.ok(mesh.positions.length&&mesh.faces.length);
  for(const face of mesh.faces)for(const field of ['uvs','uvIndices','sourceIsland','originalChart'])assert.equal(Object.hasOwn(face,field),false,`${id} bundled face leaked ${field}`);
}
report.bundledAssetsGeometryOnly=true;
const server=createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});response.end(html);});
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
let browser,page;
try{
  browser=await startChrome();page=await browser.page();
  await page.send('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.entryErrors=[];addEventListener("error",event=>entryErrors.push(event.message));addEventListener("unhandledrejection",event=>entryErrors.push(String(event.reason)));'});
  await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  await page.waitFor('(window.lab?.ready&&lab.snapshot?.inputPolicy==="geometry-only-v1"&&Number(lab.view.canvas.dataset.draws)>0)||window.entryErrors?.length||document.getElementById("error")?.textContent',60000);
  assert.equal(await page.evaluate('!!(window.lab?.ready&&lab.snapshot?.inputPolicy==="geometry-only-v1"&&Number(lab.view.canvas.dataset.draws)>0)'),true,JSON.stringify(await page.evaluate('({errors:entryErrors,error:document.getElementById("error")?.textContent})')));
  await page.evaluate(`window.displayBefore={
    snapshot:lab.snapshot,geometry:lab.snapshot.geometry,mesh:lab.mesh,canvas:lab.view.canvas,
    options:JSON.stringify(lab.options),camera:JSON.stringify(lab.view.getCamera()),positions:JSON.stringify(Array.from(lab.view.getPositions())),
    signature:JSON.stringify({seams:lab.snapshot.seams,packed:lab.snapshot.packed.map(chart=>[chart.id,[...chart.faceUVs]])}),
    events:lab.progressEvents.length,pipeline:localStorage.getItem('meshtailor.load-pipeline.v2'),
    fields:JSON.stringify([...document.querySelectorAll('input,select')].filter(element=>!element.id.startsWith('display-')).map(element=>[element.id,element.value,element.checked]))
  };`);
  for(const [locale,theme]of [['en','dark'],['zh-CN','light'],['en','light'],['zh-CN','dark']]){
    await page.evaluate(`for(const [id,value]of [['display-locale',${JSON.stringify(locale)}],['display-theme',${JSON.stringify(theme)}]]){const element=document.getElementById(id);element.value=value;element.dispatchEvent(new Event('change',{bubbles:true}));}`);
    const actual=await page.evaluate(`(()=>{
      const gl=lab.view.gl,pixel=new Uint8Array(4);lab.view.draw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      return {lang:document.documentElement.lang,theme:document.documentElement.dataset.theme,body:getComputedStyle(document.body).backgroundColor,
        pipeline:document.getElementById('header-pipeline').textContent,ribbon:document.getElementById('ribbon').textContent,title:document.getElementById('title').textContent,
        camera:document.getElementById('camera-status').textContent,play:document.getElementById('play').textContent,
        pixel:Array.from(pixel),uvPixel:Array.from(document.getElementById('uv').getContext('2d').getImageData(0,0,1,1).data),
        stable:lab.snapshot===displayBefore.snapshot&&lab.snapshot.geometry===displayBefore.geometry&&lab.mesh===displayBefore.mesh&&lab.view.canvas===displayBefore.canvas&&
          JSON.stringify(lab.options)===displayBefore.options&&JSON.stringify(lab.view.getCamera())===displayBefore.camera&&JSON.stringify(Array.from(lab.view.getPositions()))===displayBefore.positions,
        signature:JSON.stringify({seams:lab.snapshot.seams,packed:lab.snapshot.packed.map(chart=>[chart.id,[...chart.faceUVs]])})===displayBefore.signature,
        fields:JSON.stringify([...document.querySelectorAll('input,select')].filter(element=>!element.id.startsWith('display-')).map(element=>[element.id,element.value,element.checked]))===displayBefore.fields,
        pipelineStored:localStorage.getItem('meshtailor.load-pipeline.v2')===displayBefore.pipeline,events:lab.progressEvents.length===displayBefore.events,
        preferences:JSON.parse(localStorage.getItem('meshtailor.display.v1')??'null'),glError:gl.getError(),errors:[...entryErrors,...lab.errors],
        stripped:lab.mesh.faces.every(face=>!Object.hasOwn(face,'uvs')&&!Object.hasOwn(face,'uvIndices'))};
    })()`);
    assert.equal(actual.lang,locale);assert.equal(actual.theme,theme);
    assert.equal(actual.pipeline,locale==='en'?'Pipeline':'处理流程');assert.equal(actual.ribbon,locale==='en'?'Three folded strips':'三块折角带');
    assert.ok(actual.title.includes(locale==='en'?'triangles':'三角面'));assert.ok(actual.camera.includes(locale==='en'?'Manual camera':'手动相机'));
    for(const key of ['stable','signature','fields','pipelineStored','events','stripped'])assert.equal(actual[key],true,key+' changed during display switch');
    // Re-selecting untouched defaults is deliberately a no-op in the store.
    // Every actual preference change must be saved; reload is tested below.
    if(actual.preferences===null){assert.equal(locale,'en');assert.equal(theme,'dark');}
    else assert.deepEqual(actual.preferences,{locale,theme});
    assert.equal(actual.glError,0);assert.deepEqual(actual.errors,[]);
    const expected=theme==='dark'?[27,29,31]:[247,248,250];
    assert.equal(actual.body,`rgb(${expected.join(', ')})`);assert.deepEqual(actual.pixel.slice(0,3),expected);assert.deepEqual(actual.uvPixel.slice(0,3),expected);
    report.cases.push({locale,theme,passed:true,...actual});
    if(locale==='en'&&theme==='dark'||locale==='zh-CN'&&theme==='light')await writeFile(join(out,`${locale}-${theme}.png`),Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('PASS',locale,theme,'actual offline labels, persisted prefs, stable mesh/UV/camera/inputs, Canvas/GL palette');
  }
  await page.evaluate('lab.update({progress:.2});document.getElementById("play").click();window.playbackBefore={snapshot:lab.snapshot,geometry:lab.snapshot.geometry,progress:lab.options.progress,camera:JSON.stringify(lab.view.getCamera()),selected:JSON.stringify(lab.options.selected)};');
  const synchronous=await page.evaluate('(()=>{const progress=lab.options.progress,playing=lab.playing;document.getElementById("display-locale").value="en";document.getElementById("display-locale").dispatchEvent(new Event("change"));document.getElementById("display-theme").value="light";document.getElementById("display-theme").dispatchEvent(new Event("change"));return {progressUnchanged:lab.options.progress===progress,playingUnchanged:lab.playing===playing};})()');
  assert.deepEqual(synchronous,{progressUnchanged:true,playingUnchanged:true});
  await delay(100);
  const playback=await page.evaluate('({playing:lab.playing,stable:lab.snapshot===playbackBefore.snapshot&&lab.snapshot.geometry===playbackBefore.geometry&&JSON.stringify(lab.view.getCamera())===playbackBefore.camera&&JSON.stringify(lab.options.selected)===playbackBefore.selected,advance:lab.options.progress-playbackBefore.progress,errors:[...entryErrors,...lab.errors]})');
  report.playbackDisplaySwitch={synchronous,...playback};
  assert.equal(playback.playing,true);assert.equal(playback.stable,true);assert.ok(playback.advance>0);assert.deepEqual(playback.errors,[]);
  await page.evaluate('lab.pause()');
  await page.send('Page.reload');
  await page.waitFor('window.lab?.ready&&lab.snapshot?.inputPolicy==="geometry-only-v1"',60000);
  assert.equal(await page.evaluate('document.documentElement.lang'), 'en');assert.equal(await page.evaluate('document.documentElement.dataset.theme'),'light');
  assert.equal(await page.evaluate('document.getElementById("display-locale").value'),'en');assert.equal(await page.evaluate('document.getElementById("display-theme").value'),'light');
  assert.deepEqual(await page.evaluate('[...entryErrors,...lab.errors]'),[]);
  report.reloadPreservesPreferences=true;report.passed=true;
  console.log('PASS active playback continues without a display-induced reset; reload restores language/theme');
}catch(error){
  report.failure=String(error.stack??error);
  if(page)try{report.dom=await page.evaluate('({error:document.getElementById("error")?.textContent,status:document.getElementById("status")?.textContent,ready:window.lab?.ready,errors:window.entryErrors})');}catch{}
  throw error;
}finally{
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
}
