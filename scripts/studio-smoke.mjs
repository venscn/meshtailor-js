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
      await click(mesh); await click('Generate baseline'); await ariaClick('Last step'); await delay(150);
      assert.ok(await page.evaluate(`${canvas} === __originalCanvas && Number(${canvas}.dataset.seamCount) > 0`));
    }
    const errors = await page.evaluate('__testErrors');
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(`!document.querySelector('[role="alert"]')`));
    report.cases.push({ name: `DPR ${dpr}: rendered mesh, seams, camera persistence, seek/playback and mesh switching`, passed: true, rect });
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
