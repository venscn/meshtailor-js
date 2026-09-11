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
  // v0.2.0 adds a fourth center child and an optional timeline-window row.
  // Exercise them at constrained and spacious sizes, without a React/Three surrogate.
  for (const [width,height] of [[1100,700],[1920,1080]]) {
    await load(current,2,width,height);
    await page.evaluate(`(() => {
      const summary=document.createElement('div');summary.className='operation-summary';summary.textContent='Baseline: 1500 edges, 300 chains, 2400 steps. Worker finished.';
      document.querySelector('.center').append(summary);
      document.querySelector('.notice').textContent='Import diagnostic: '+('A very long file name or error message. '.repeat(28));
      const timeline=document.querySelector('.timeline');timeline.replaceChildren();
      const title=document.createElement('div');title.className='panel-title';title.textContent='Decode timeline';
      const label=document.createElement('small');label.className='timeline-window';label.textContent='Showing 1–100 of 2400. Use slider to seek.';
      const scroll=document.createElement('div');scroll.className='timeline-scroll';
      for(let i=0;i<100;i++){const row=document.createElement('button');row.textContent='Traversal '+i;scroll.append(row);}
      timeline.append(title,label,scroll);
    })()`);
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,250))');
    const state=await page.evaluate(`(() => {
      const box=s=>document.querySelector(s).getBoundingClientRect();
      const center=box('.center'),scene=box('.scene-panel'),notice=box('.notice'),summary=box('.operation-summary');
      const timeline=box('.timeline'),scroll=box('.timeline-scroll'),el=document.querySelector('.timeline-scroll'),canvas=box('.viewport>canvas'),host=box('.viewport');
      return {sceneHeight:scene.height,centerBottom:center.bottom,summaryBottom:summary.bottom,noticeHeight:notice.height,timelineBottom:timeline.bottom,scrollBottom:scroll.bottom,scrollHeight:scroll.height,contentHeight:el.scrollHeight,canvasWidth:canvas.width,hostWidth:host.width};
    })()`);
    assert.ok(state.sceneHeight>150,'status text must not consume the 3D panel');
    assert.ok(state.noticeHeight<=111,'long import diagnostics must be bounded');
    assert.ok(state.summaryBottom<=state.centerBottom+1,'operation summary must remain within workspace');
    assert.ok(state.scrollBottom<=state.timelineBottom+1&&state.scrollHeight>40,'timeline rows must scroll inside the panel');
    assert.ok(state.contentHeight>state.scrollHeight,'100 timeline rows must not grow the panel');
    assert.equal(state.canvasWidth,state.hostWidth);
    report.cases.push({name:`complex-mesh controls and populated timeline stay bounded at ${width}x${height}`,state});
  }
  // v0.3.0: native DOM/CSS fixture for the new controls, not a React substitute.
  for (const [width,height] of [[1100,700],[1440,900]]) {
    await load(current,2,width,height);
    await page.evaluate(`(() => {
      const center=document.querySelector('.center');
      const tabs=document.createElement('div');tabs.className='view-tabs';tabs.innerHTML='<button>裁切线遍历</button><button>3D ↔ UV 展开动画</button>';center.prepend(tabs);
      const transport=document.querySelector('.debugbar');transport.className='unfold-transport';transport.innerHTML='<div class="unfold-progress"><button>3D · 0%</button><input type="range"><button>UV · 100%</button></div><div class="unfold-play-row"><button>播放展开</button><label><input type="checkbox">反向</label><label><input type="checkbox">循环</label><span>50.0%</span></div><small>分离 → 展平 → 移入 UV 位置</small>';
      const side=document.querySelector('.sidebar');side.innerHTML='<section class="unfold-controls"><h3>展开对应预览</h3><div class="island-list">'+Array.from({length:40},(_,i)=>'<div class="island-row"><input type="checkbox"><button>Island '+i+'</button></div>').join('')+'</div></section>';
      const inspector=document.querySelector('.timeline');inspector.className='panel correspondence-panel';inspector.innerHTML='<div class="panel-title">对应关系</div><div class="correspondence-content">'+('<p>逐角 3D ↔ UV 对应坐标与说明</p>'.repeat(30))+'</div>';
    })()`);
    await page.evaluate('new Promise(resolve=>setTimeout(resolve,200))');
    const state=await page.evaluate(`(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const scene=r('.scene-panel'),bar=r('.unfold-transport'),center=r('.center'),list=r('.island-list'),content=r('.correspondence-content'),panel=r('.correspondence-panel');return{sceneHeight:scene.height,barBottom:bar.bottom,centerBottom:center.bottom,listHeight:list.height,listScroll:document.querySelector('.island-list').scrollHeight,contentBottom:content.bottom,panelBottom:panel.bottom,contentScroll:document.querySelector('.correspondence-content').scrollHeight,contentHeight:content.height,canvasWidth:r('.viewport canvas').width,hostWidth:r('.viewport').width};})()`);
    assert.ok(state.sceneHeight>200);assert.ok(state.barBottom<=state.centerBottom+1);assert.ok(state.listHeight<=280&&state.listScroll>state.listHeight);assert.ok(state.contentBottom<=state.panelBottom+1&&state.contentScroll>state.contentHeight);assert.equal(state.canvasWidth,state.hostWidth);
    report.cases.push({name:`unfold transport, island list and correspondence inspector stay bounded at ${width}x${height}`,state});
  }
  report.passed = report.cases.length;
  const output = process.argv.indexOf('--report');
  if (output !== -1) await writeFile(process.argv[output + 1], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
