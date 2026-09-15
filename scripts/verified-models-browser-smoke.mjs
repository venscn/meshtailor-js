/** Corrected, hash-pinned real assets in the production offline Worker/WebGL view.
 * This deliberately does not claim to exercise React or Three's GLTFLoader.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {compileCore} from './lib/compiled-core.mjs';
import {loadVerifiedFixture} from './lib/verified-model-fixtures.mjs';
import {startChrome,delay} from './chrome-cdp.mjs';
const arg=(key,fallback)=>{const n=process.argv.indexOf(key);return n<0?fallback:process.argv[n+1];};
const folder=arg('--models'),out=arg('--out','validation/v0.4.11/browser-real');
if(!folder)throw Error('Pass --models <corrected extracted meshtailor-test-models directory>');
await mkdir(out,{recursive:true});
const compiled=await compileCore();let browser;
const report={suite:'Corrected real assets / offline production Worker and WebGL',loaderScope:'hash-pinned static glTF decoder + production mesh assembly, NOT Three GLTFLoader or React',displayScope:'software WebGL; overlap overlay disabled for large-asset interaction/readback; exact full-atlas overlap checked independently',cases:[],assets:{}};
const test=async(name,fn)=>{console.log('START',name);const start=performance.now(),details=await fn();report.cases.push({name,passed:true,milliseconds:performance.now()-start,details});console.log('PASS',name);};
try{
 const core=await compiled.load('packages/mesh-core/src/index.js'),fixtures={};
 for(const name of ['Corset','FlightHelmet']){const f=await loadVerifiedFixture(core,folder,name);fixtures[name]=JSON.stringify(f.mesh);report.assets[name]={identity:f.identity};}
 const html=await readFile('unfold-lab.html','utf8');browser=await startChrome();
 for(const [name,sourceCount,expected,faces]of [['Corset',98,79,18324],['FlightHelmet',237,130,94722]].filter(([name])=>!arg('--asset')||name===arg('--asset'))){
  const page=await browser.page();const evaluate=page.evaluate.bind(page);page.evaluate=expression=>evaluate(expression,90000);await page.send('Page.bringToFront');await page.send('Emulation.setDeviceMetricsOverride',{width:1560,height:1000,deviceScaleFactor:1,mobile:false});
  const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html});await page.waitFor('window.lab?.ready',30000);await page.evaluate('lab.update({overlapMode:"off"})');
  await test(`${name}: real uploaded geometry enters the production Worker`,async()=>{
   await page.evaluate(`window.fixtureFailure=null;window.fixtureDone=false;window.correctFixture=JSON.parse(${JSON.stringify(fixtures[name])});window.fixtureOriginal=JSON.stringify(correctFixture);document.querySelector('#target').value='source-atlas';setTimeout(()=>lab.load({mesh:correctFixture,edges:new Set()}).then(()=>{window.fixtureDone=true;}).catch(e=>window.fixtureFailure=String(e)),0);0`);
   await page.waitFor('window.fixtureDone||window.fixtureFailure',150000);assert.equal(await page.evaluate('window.fixtureFailure'),null);
   assert.equal(await page.evaluate('lab.snapshot?.target'),'source-atlas');assert.equal(await page.evaluate('lab.mesh.faces.length'),faces);
   assert.equal(await page.evaluate('lab.snapshot.sourceAreaAudit.islands.length'),sourceCount);assert.equal(await page.evaluate('lab.snapshot.packed.length'),expected);
  });
  await test(`${name}: only two invalid original islands are locally repaired`,async()=>{const r=await page.evaluate('lab.snapshot.repair');assert.equal(r.repaired,2);assert.match(await page.evaluate('document.querySelector("#repair-summary").textContent'),/局部修复 2/);return r;});
  await test(`${name}: complete atlas has no triangle overlap, flip or degeneracy`,async()=>{const q=await page.evaluate('lab.uv.checkUVTriangles(lab.snapshot.packed.flatMap(c=>[...c.faceUVs.values()]))');assert.equal(q.triangles,faces);assert.equal(q.valid,true);return q;});
  await test(`${name}: common mean area density and original input preserved`,async()=>{assert.ok(await page.evaluate('lab.snapshot.areaAudit.islands.every(i=>Math.abs(i.densityRatio-1)<1e-6)'));assert.ok(await page.evaluate('JSON.stringify(lab.mesh)===window.fixtureOriginal'));});
  await test(`${name}: UV export/re-import preserves exact face-corner coordinates`,async()=>{assert.ok(await page.evaluate('(()=>{const a=lab.uv.meshWithPreviewUV(lab.mesh,lab.snapshot.packed),b=lab.core.parseOBJ(lab.core.meshToOBJ(a));return b.faces.length===a.faces.length&&b.faces.every((f,i)=>f.uvs.every((p,k)=>p.every((x,j)=>Math.abs(x-a.faces[i].uvs[k][j])<1e-8)));})()'));});
  await test(`${name}: final animated positions coincide with displayed atlas`,async()=>{await page.evaluate('document.querySelector("#all").click();lab.update({progress:1});lab.view.fit("uv")');assert.ok(await page.evaluate('lab.view.getPositions().every((x,i)=>Math.abs(x-lab.snapshot.geometry.target[i])<1e-5)'));});
  await test(`${name}: island-first and same-face deselect still work`,async()=>{await page.evaluate('window.firstChart=lab.snapshot.packed[0];window.firstFace=[...firstChart.faceUVs.keys()][0];lab.pick(firstChart.id,firstFace,false)');assert.equal(await page.evaluate('lab.options.focusFace'),null);await page.evaluate('lab.pick(firstChart.id,firstFace,false)');assert.equal(await page.evaluate('lab.options.focusFace'),await page.evaluate('firstFace'));await page.evaluate('lab.pick(firstChart.id,firstFace,false)');assert.equal(await page.evaluate('lab.options.focusFace'),null);});
  const summary=await page.evaluate('({islands:lab.snapshot.packed.length,repair:lab.snapshot.repair,merge:lab.snapshot.merge,timing:lab.snapshot.timing,metrics:lab.snapshot.metrics,sourceIslands:lab.snapshot.sourceAreaAudit.islands.length,groups:lab.snapshot.spatialReport.groups.length,progressEvents:lab.progressEvents.length})');report.assets[name].result=summary;
  await page.evaluate(`document.querySelector('#all').click();lab.update({progress:1});lab.view.fit('uv');document.querySelector('[data-tool=uv]').click();document.querySelector('#repair-summary').scrollIntoView({block:'center'});document.title='${name} · 正确上传资产 · 新 atlas'`);await delay(400);
  const screen=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},90000);await writeFile(join(out,`${name}-atlas.png`),Buffer.from(screen.data,'base64'));
  await test(`${name}: raw-inspection mode still restores unchanged source UV`,async()=>{await page.evaluate('document.querySelector("#inspect-source").click()');await page.waitFor('lab.ready&&lab.snapshot?.target==="source"',150000);assert.equal(await page.evaluate('lab.snapshot.packed.length'),sourceCount);assert.ok(await page.evaluate('JSON.stringify(lab.mesh)===fixtureOriginal'));});
  await test(`${name}: no unhandled browser errors or viewport overflow`,async()=>{assert.deepEqual(await page.evaluate('lab.errors'),[]);assert.equal(await page.evaluate('document.body.scrollWidth'),1560);});
 }
 report.passed=report.cases.length;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;console.error(e);}
finally{if(browser)await browser.close();await compiled.cleanup();await writeFile(join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
