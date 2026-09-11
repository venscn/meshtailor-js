/** Browser CSS/layout test, NOT a React/Three.js end-to-end rendering test. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { startChrome } from './chrome-cdp.mjs';
const root = new URL('../', import.meta.url);
const current = await readFile(new URL('apps/studio/src/styles.css', root), 'utf8');
const original = await readFile(new URL('tests/fixtures/styles-v0.1.0.css', root), 'utf8');
const html = (css) => `<style>${css}</style><div class="app-shell"><header class="topbar">Layout regression fixture</header><main class="workspace"><aside class="sidebar">Controls</aside><section class="center"><div class="panel scene-panel"><div class="panel-title">3D traversal</div><div class="viewport"><canvas></canvas></div></div><div class="debugbar">Play</div><div class="notice">Ready</div></section><aside class="rightbar"><div class="panel uv-panel"><div class="panel-title">UV</div><div class="uv-viewport"><canvas class="uv-canvas"></canvas></div></div><div class="panel timeline">Timeline</div></aside></main><footer>CSS layout probe only — not the Studio renderer</footer></div>`;
const browser = await startChrome();
const report = { suite: 'Chromium native canvas CSS-layout regression (no React/Three.js dependencies)', cases: [] };
try {
  const page = await browser.page();
  async function load(css, ratio, width = 1440, height = 900) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: ratio, mobile: false });
    const { frameTree } = await page.send('Page.getFrameTree');
    await page.send('Page.setDocumentContent', { frameId: frameTree.frame.id, html: html(css) });
    await page.evaluate(`(() => {
      window.samples=[];window.layoutErrors=[];
      window.addEventListener('error', event=>layoutErrors.push(event.message));
      const el=document.querySelector('.viewport'),canvas=el.querySelector('canvas');
      // Mirror renderer.setPixelRatio(dpr); renderer.setSize(w,h,false):
      // only drawing-buffer attributes change, not CSS display dimensions.
      const resize=()=>{
        const w=el.clientWidth,h=el.clientHeight;
        if(w<=0||h<=0)return;
        const dpr=Math.min(devicePixelRatio,2);
        canvas.width=Math.floor(w*dpr);canvas.height=Math.floor(h*dpr);
        samples.push({hostW:w,hostH:h,canvasW:canvas.clientWidth,canvasH:canvas.clientHeight,bufferW:canvas.width,bufferH:canvas.height});
        if(samples.length>=8)observer.disconnect(); // Bound the deliberately broken fixture.
      };
      window.observer=new ResizeObserver(resize);observer.observe(el);
    })()`);
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,300))');
  }
  await load(original, 2);
  const broken = await page.evaluate('samples');
  assert.ok(broken.length >= 5 && broken.at(-1).canvasW >= broken[0].hostW * 16, 'v0.1.0 must reproduce the HiDPI growth loop');
  report.cases.push({ name: 'v0.1.0 negative control: growing HiDPI canvas reproduced', samples: broken });
  for (const dpr of [1, 1.25, 2, 3]) {
    await load(current, dpr);
    const samples = await page.evaluate('samples');
    assert.ok(samples.length > 0 && samples.length <= 2, `DPR ${dpr}: ResizeObserver must settle`);
    for (const s of samples) {
      assert.equal(s.canvasW, s.hostW); assert.equal(s.canvasH, s.hostH);
      assert.equal(s.bufferW, Math.floor(s.hostW * Math.min(dpr, 2)));
      assert.equal(s.bufferH, Math.floor(s.hostH * Math.min(dpr, 2)));
    }
    report.cases.push({ name: `fixed CSS at DPR ${dpr}`, samples });
  }
  for (const [width, height] of [[1100, 700], [1920, 1080], [1280, 800]]) {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: false });
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,250))');
    const state = await page.evaluate(`(() => {const host=document.querySelector('.viewport'),canvas=host.querySelector('canvas');return {w:host.clientWidth,h:host.clientHeight,cw:canvas.clientWidth,ch:canvas.clientHeight,bw:canvas.width,bh:canvas.height,count:samples.length};})()`);
    assert.equal(state.w, state.cw); assert.equal(state.h, state.ch);
    assert.equal(state.bw, state.w * 2); assert.equal(state.bh, state.h * 2);
    assert.ok(state.w > 0 && state.h > 0);
    report.cases.push({ name: `window resize ${width}x${height}`, state });
  }
  await page.evaluate(`document.querySelector('.scene-panel').style.display='none'`);
  await page.evaluate('new Promise(resolve=>setTimeout(resolve,100))');
  await page.evaluate(`document.querySelector('.scene-panel').style.display='grid'`);
  await page.evaluate('new Promise(resolve=>setTimeout(resolve,200))');
  const visible = await page.evaluate(`(() => {const host=document.querySelector('.viewport'),c=host.querySelector('canvas');return host.clientWidth>0 && host.clientWidth===c.clientWidth && host.clientHeight===c.clientHeight;})()`);
  assert.ok(visible);
  report.cases.push({ name: 'hidden panel becomes visible without intrinsic canvas growth', passed: true });
  report.passed = report.cases.length;
  const output = process.argv.indexOf('--report');
  if (output !== -1) await writeFile(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
