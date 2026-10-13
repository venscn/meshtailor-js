/** Real production DOM panel, Canvas, and WebGL with a geometry-only result.
 * This bounded display test does not replace the full React Studio smoke check. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
import {startChrome} from './chrome-cdp.mjs';

const compiled=await compileCore();let browser;
try {
  const modules=await browserModuleSources(compiled.output);
  modules['/display-test.js']=`
    import * as core from '/packages/mesh-core/src/index.js';
    import * as uv from '/packages/uv/src/index.js';
    import {displayPreferences,getPalette} from '/packages/ui-platform/src/index.js';
    import {UnfoldWebGLView} from '/apps/studio/src/unfold/webgl-view.js';
    import {drawUVSnapshot} from '/apps/studio/src/unfold/uv-drawing.js';
    import {PipelinePanel} from '/apps/studio/src/unfold/pipeline-panel.js';
    import {renderFillGrowth} from '/apps/studio/src/unfold/fill-growth-panel.js';
    import {describeFillPresentation} from '/apps/studio/src/unfold/fill-description.js';
    import {DEFAULT_LOAD_PIPELINE} from '/apps/studio/src/unfold/load-pipeline.js';
    window.errors=[];window.addEventListener('error',e=>errors.push(e.message));
    window.display=displayPreferences;window.palette=getPalette;
    // Exercise the actual public formatter dependency chain used by the offline
    // entry; compiling alone does not detect an extensionless runtime import.
    renderFillGrowth(document.querySelector('#fill'),undefined);
    window.fillFormatterReady=typeof describeFillPresentation==='function';
    const mesh=core.geometryOnlyMesh(core.makeCube());
    const options=uv.geometryGenerationOptions(mesh);
    const result=uv.unwrapMesh(mesh,new Set(),options);
    window.snapshot={...result,geometry:uv.buildUnfoldGeometry(mesh,result.packed,new Set(result.seams))};
    window.originalSpaceNames=snapshot.geometry.atlas.spaces.map(space=>space.name);
    window.callbacks=0;window.configChanges=[];
    window.panel=new PipelinePanel(plan=>{callbacks++;configChanges.push(plan)},()=>callbacks++,()=>callbacks++);
    document.querySelector('#panel').append(panel.element);
    panel.update({mesh,options,config:{...DEFAULT_LOAD_PIPELINE,fill:true,fillBudgetSeconds:17},trace:null,loading:false});
    window.view=new UnfoldWebGLView(document.querySelector('#view'),()=>{},error=>{if(error)errors.push(error)});
    view.setGeometry(snapshot.geometry);
    view.setOptions({progress:.37,selected:snapshot.geometry.islands.map(i=>i.id),order:'sequential',path:'hinge',separation:0,context:'dim',wireframe:true,checker:false,labels:true,xray:false,focusFace:0});
    window.uvcanvas=document.querySelector('#uv');uvcanvas.width=400;uvcanvas.height=300;
    const ctx=uvcanvas.getContext('2d'),fillText=ctx.fillText.bind(ctx);
    window.uvText=[];
    ctx.fillText=(text,...args)=>{uvText.push(text);return fillText(text,...args)};
    const redraw=()=>{
      const preferences=display.getSnapshot(),colors=palette(preferences.theme);
      document.documentElement.lang=preferences.locale;
      document.documentElement.style.colorScheme=preferences.theme;
      for(const [key,value]of Object.entries(colors.tokens))document.documentElement.style.setProperty(key,value);
      window.uvText=[];
      drawUVSnapshot(ctx,snapshot,400,300,{selected:snapshot.geometry.islands.map(i=>i.id),focusFace:0,checker:false,wireframe:true});
    };
    display.subscribe(redraw);redraw();
    window.before={snapshot,geometry:snapshot.geometry,canvas:view.canvas,positions:Array.from(view.getPositions()),camera:JSON.stringify(view.getCamera())};
    window.ready=true;
  `;
  const css=(await readFile(join(compiled.root,'apps/studio/src/workspace-theme.css'),'utf8'))+(await readFile(join(compiled.root,'apps/studio/src/styles.css'),'utf8')).replace(/@import[^;]+;/g,'');
  browser=await startChrome();const page=await browser.page();
  const tree=await page.send('Page.getFrameTree');
  await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:`<!doctype html><meta charset="utf-8"><style>${css}</style><main style="display:flex;gap:12px"><div id="panel" style="width:300px"></div><div id="view" style="position:relative;width:600px;height:480px"></div><canvas id="uv"></canvas><div id="fill"></div></main>`});
  await page.evaluate(moduleBootstrap(modules));
  await page.evaluate("import(moduleURL('/display-test.js')).then(()=>true)");
  await page.waitFor('window.ready&&view.canvas.dataset.draws>0',15000);
  assert.equal(await page.evaluate('fillFormatterReady'),true);
  for(const [locale,theme]of [['en','dark'],['zh-CN','light'],['en','light'],['zh-CN','dark']]){
    const prior=await page.evaluate('Number(view.canvas.dataset.draws)');
    await page.evaluate(`display.set({locale:${JSON.stringify(locale)},theme:${JSON.stringify(theme)}})`);
    if(locale!=='en'||theme!=='dark')await page.waitFor(`Number(view.canvas.dataset.draws)>${prior}`);
    const actual=await page.evaluate(`(()=>{
      const gl=view.gl,colors=palette(display.getSnapshot().theme),pixel=new Uint8Array(4);
      // Read the displayed framebuffer in the same task as the actual draw.
      // Overlap diagnostics may legitimately leave a different clear-state value.
      view.draw();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      return {gpu:Array.from(pixel),expected:colors.clearColor,uv:Array.from(uvcanvas.getContext('2d').getImageData(0,0,1,1).data),
        caption:panel.element.querySelector('h3').textContent,lang:document.documentElement.lang,background:getComputedStyle(document.body).backgroundColor,
        stable:snapshot===before.snapshot&&snapshot.geometry===before.geometry&&view.canvas===before.canvas&&JSON.stringify(Array.from(view.getPositions()))===JSON.stringify(before.positions)&&JSON.stringify(view.getCamera())===before.camera,
        callbacks,glError:gl.getError(),budget:panel.element.querySelector('[data-pipeline="fillBudgetSeconds"]').value,
        obsoleteRepair:!!panel.element.querySelector('[data-pipeline="repairInvalid"]'),uvText,
        spaceNamesPreserved:JSON.stringify(snapshot.geometry.atlas.spaces.map(space=>space.name))===JSON.stringify(originalSpaceNames),errors};
    })()`);
    assert.equal(actual.lang,locale);assert.equal(actual.stable,true,'display changes must preserve geometry, canvas, positions, and camera');
    assert.equal(actual.callbacks,0,'a language/theme change must not dispatch a pipeline edit/run/cancel');
    assert.equal(actual.glError,0);assert.deepEqual(actual.errors,[]);assert.equal(actual.budget,'17');
    assert.equal(actual.obsoleteRepair,false,'geometry-only UI must not expose original-UV repair');
    assert.ok(actual.uvText.includes(locale==='en'?'UV page 1':'UV 页 1'),'the actual Canvas draw call must use the selected page-label language');
    assert.equal(actual.spaceNamesPreserved,true,'display localization must preserve atlas/export names');
    const rgb=actual.expected.map(channel=>Math.round(channel*255));
    assert.deepEqual(actual.gpu.slice(0,3),rgb);
    assert.deepEqual(actual.uv.slice(0,3),rgb);
    assert.equal(actual.background,`rgb(${rgb.join(', ')})`);
    assert.equal(actual.caption,locale==='en'?'Model loading · automatic pipeline':'载入模型 · 自动处理流程');
    console.log('PASS',locale,theme,'actual DOM/Canvas/GL appearance, stable geometry/camera, zero task callbacks');
  }
  const edited=await page.evaluate(`(()=>{const input=panel.element.querySelector('[data-pipeline="fill"]');input.checked=false;input.dispatchEvent(new Event('change'));return configChanges.at(-1)})()`);
  assert.equal(edited.source,'geometry');assert.equal(edited.repairInvalid,false);assert.equal(edited.fill,false);
  console.log('PASS editing a real surviving control never reads or enables original-UV repair');
  await page.evaluate('view.dispose();panel.dispose();display.set({locale:"en",theme:"light"})');
  assert.equal(await page.evaluate('document.querySelectorAll("#view canvas,#panel .pipeline-panel").length'),0);
  assert.deepEqual(await page.evaluate('errors'),[]);
  console.log('PASS disposal removes display subscribers and renderer nodes');
}finally{if(browser)await browser.close();await compiled.cleanup();}
