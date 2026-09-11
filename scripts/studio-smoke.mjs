/** Full React + Three.js browser smoke. Requires npm install and working WebGL 2.
 * This uses the installed Studio, never replaces its React/Three implementations.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startChrome, delay } from './chrome-cdp.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = join(root, 'node_modules/vite/bin/vite.js');
if (!existsSync(vite)) throw new Error('Studio dependencies are not installed. Run npm install before npm run test:browser.');
const server = spawn(process.execPath, [vite, 'apps/studio', '--host', '127.0.0.1', '--port', '4179', '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
server.stdout.on('data', (chunk) => { log += chunk; });
server.stderr.on('data', (chunk) => { log += chunk; });
let browser;
const report = { suite: 'Full Studio React/Three.js browser smoke', cases: [] };
const canvas = `document.querySelector('[data-testid="mesh-canvas"]')`;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Vite exited: ${log}`);
    try { const response = await fetch('http://127.0.0.1:4179'); if (response.ok) { ready = true; break; } } catch {}
    await delay(100);
  }
  if (!ready) throw new Error(`Vite did not start: ${log}`);
  browser = await startChrome();
  for (const dpr of [1, 2]) {
    const page = await browser.page();
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: dpr, mobile: false });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__testErrors=[];window.addEventListener('error',e=>__testErrors.push(e.message));window.addEventListener('unhandledrejection',e=>__testErrors.push(String(e.reason)));` });
    await page.send('Page.navigate', { url: 'http://127.0.0.1:4179' });
    await page.waitFor(`${canvas}?.dataset.drawCalls > 0`);
    await delay(300); // Allow StrictMode's initial setup / cleanup to finish.
    const rect = await page.evaluate(`(() => {const c=${canvas},h=c.parentElement;return {w:h.clientWidth,h:h.clientHeight,cw:c.clientWidth,ch:c.clientHeight,bw:c.width,bh:c.height};})()`);
    assert.equal(rect.w, rect.cw); assert.equal(rect.h, rect.ch);
    assert.equal(rect.bw, rect.w * dpr); assert.equal(rect.bh, rect.h * dpr);
    await page.evaluate(`window.__originalCanvas=${canvas};window.__canvasInsertions=0;new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeName==='CANVAS')__canvasInsertions++;}).observe(${canvas}.parentElement,{childList:true});`);
    const click = async (text) => page.evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Missing button');b.click();})()`);
    const ariaClick = async (label) => page.evaluate(`document.querySelector('[aria-label="${label}"]').click()`);
    await click('Generate baseline');
    await page.waitFor(`${canvas}.dataset.step === '0'`);
    await ariaClick('Next step');
    await page.waitFor(`${canvas}.dataset.step === '1'`);
    assert.ok(await page.evaluate(`Number(${canvas}.dataset.seamCount)>0`));
    // Drag the real OrbitControls, wait for damping, then ensure step changes don't reset it.
    const bounds = await page.evaluate(`(() => {const r=${canvas}.getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5};})()`);
    const beforeDrag = await page.evaluate(`${canvas}.dataset.cameraPosition`);
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bounds.x, y: bounds.y, button: 'left', buttons: 1, clickCount: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bounds.x + 100, y: bounds.y + 40, button: 'left', buttons: 1 });
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bounds.x + 100, y: bounds.y + 40, button: 'left', buttons: 0, clickCount: 1 });
    await delay(2200);
    const camera = await page.evaluate(`${canvas}.dataset.cameraPosition`);
    assert.notEqual(camera, beforeDrag);
    for (let step = 0; step < 12; step++) { await ariaClick('Next step'); await delay(30); }
    const after = await page.evaluate(`${canvas}.dataset.cameraPosition`);
    const distance = Math.hypot(...camera.split(',').map((v, i) => Number(v) - Number(after.split(',')[i])));
    assert.ok(distance < .01, `Camera changed during stepping: ${distance}`);
    await page.evaluate(`document.querySelector('input[type="checkbox"]').click()`);
    await delay(100);
    assert.ok(await page.evaluate(`${canvas} === __originalCanvas && __canvasInsertions === 0`));
    await ariaClick('Last step');
    await delay(100);
    await click('Play');
    await page.waitFor(`${canvas}.dataset.step === '0' || ${canvas}.dataset.step === '1'`);
    await click('Pause');
    await click('Reset camera');
    for (const mesh of ['Cube', 'Cylinder', 'Torso']) {
      await click(mesh); await page.waitFor(`${canvas}.dataset.step === '-1'`); await click('Generate baseline'); await page.waitFor(`${canvas}.dataset.step === '0'`); await ariaClick('Last step'); await page.waitFor(`Number(${canvas}.dataset.seamCount)>0`);
      assert.ok(await page.evaluate(`${canvas} === __originalCanvas && Number(${canvas}.dataset.seamCount) > 0`));
    }
    // Load both REAL FBX fixtures through the app's file importer (not mocked data).
    for(const format of ['ASCII','Binary']){
      await click('FBX '+format);
      await page.waitFor(`document.querySelector('.scene-panel .panel-title')?.textContent.includes('garment-${format.toLowerCase()}.fbx')`);
      await page.waitFor(`!document.querySelector('.notice [role="status"]')`);
      await click('Generate baseline');await page.waitFor(`${canvas}.dataset.step === '0'`);
      await ariaClick('Last step');await page.waitFor(`Number(${canvas}.dataset.seamCount)>0`);
      assert.ok(await page.evaluate(`${canvas} === __originalCanvas`));
    }
    await click('Load complex mesh');
    await page.waitFor(`document.querySelector('.scene-panel .panel-title')?.textContent.includes('Pleated garment')`);
    await click('Generate baseline');await page.waitFor(`${canvas}.dataset.step === '0'`);
    await ariaClick('Last step');await page.waitFor(`Number(${canvas}.dataset.seamCount)>0`);
    assert.ok(await page.evaluate(`document.querySelectorAll('.timeline-scroll button').length <= 100`));
    // Actual React controls + actual browser UV worker + new native WebGL viewport.
    await click('3D ↔ UV 展开动画');await click('加载六岛立方体示例');
    const unfold=`document.querySelector('[data-testid="unfold-canvas"]')`;
    await page.waitFor(`${unfold}?.dataset.selectedCount === '6'`);
    await click('UV · 100%');await page.waitFor(`${unfold}.dataset.targetError === '0'`);
    const setValue=async(label,value,select=false)=>page.evaluate(`(()=>{const el=document.querySelector('[aria-label="${label}"]');Object.getOwnPropertyDescriptor(${select?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('${select?'change':'input'}',{bubbles:true}));})()`);
    await setValue('Unfold scope','single',true);await page.waitFor(`${unfold}.dataset.selectedCount === '1'`);
    await click('下一个岛');await click('UV · 100%');await page.waitFor(`${unfold}.dataset.completed === '1'`);
    await setValue('Unfold scope','all',true);await setValue('Unfold order','sequential',true);
    await setValue('Unfold progress','.25');await page.waitFor(`${unfold}.dataset.completed === '1'`);
    await page.evaluate(`document.querySelector('[aria-label="Include island 2"]').click()`);await page.waitFor(`${unfold}.dataset.selectedCount === '5'`);
    await click('清空选择');await page.waitFor(`${unfold}.dataset.selectedCount === '0'`);
    await setValue('Unfold scope','all',true);await setValue('Unfold order','together',true);
    await click('播放展开');await page.waitFor(`Number(${unfold}.dataset.progress)>.025`);await click('暂停展开');
    await click('UV 正视');const orbit=await page.evaluate(`${unfold}.dataset.camera`);
    await setValue('Unfold progress','.37');await page.waitFor(`${unfold}.dataset.progress === '0.37'`);assert.equal(await page.evaluate(`${unfold}.dataset.camera`),orbit);
    await setValue('UV target','source',true);await page.waitFor(`${unfold}.dataset.selectedCount === '6' && ${unfold}.dataset.progress === '0'`);
    await click('UV · 100%');await page.waitFor(`${unfold}.dataset.targetError === '0'`);
    report.cases.push({name:`DPR ${dpr}: actual React unfold controls, browser UV worker, selection, sequential progress, playback and original UV`,passed:true});
    const errors = await page.evaluate('__testErrors');
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(`!document.querySelector('[role="alert"]')`));
    report.cases.push({ name: `DPR ${dpr}: rendered mesh, FBX ASCII/Binary, complex garment, bounded timeline, camera and seek/playback`, passed: true, rect });
    page.close();
  }
  // Verify the app remains usable and shows a visible error if WebGL is unavailable.
  const page = await browser.page();
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return String(type).startsWith('webgl')?null:original.call(this,type,...args);};` });
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4179' });
  await page.waitFor(`document.querySelector('[role="alert"]')?.textContent.includes('Cannot start WebGL 2')`);
  assert.ok(await page.evaluate(`!!document.querySelector('.sidebar') && !!document.querySelector('.uv-canvas')`));
  report.cases.push({ name: 'WebGL unavailable: visible error and remaining UI retained', passed: true });
  report.passed = report.cases.length;
  const index = process.argv.indexOf('--report');
  if (index !== -1) await writeFile(process.argv[index + 1], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { if (browser) await browser.close(); server.kill(); }
