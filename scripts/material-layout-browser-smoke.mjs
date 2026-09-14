/** Real browser / production Worker tests with explicitly synthetic material sheets.
 * Does NOT stand in for a downloaded FlightHelmet or Corset asset or React E2E. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startChrome} from './chrome-cdp.mjs';
const report={suite:'Synthetic six-material source UVs, production Worker/WebGL and offline DOM',cases:[]};
const check=async(name,fn)=>{const detail=await fn();report.cases.push({name,passed:true,detail});console.log('PASS',name);};
const mesh={name:'六材质坐标重叠回归样例（非真实头盔）',positions:[],faces:[]};
for(let i=0;i<6;i++){
 const x=(i%3)*.7,y=Math.floor(i/3)*.65,z=(i%2)*.12,k=mesh.positions.length;
 mesh.positions.push([x,y,z],[x+.5,y,z],[x+.5,y+.45,z+.1],[x,y+.45,z+.1]);
 for(const [idx,uvs]of [[[0,1,2],[[0,0],[1,0],[1,1]]],[[0,2,3],[[0,0],[1,1],[0,1]]]])mesh.faces.push({vertices:idx.map(j=>j+k),uvs,uvSpace:`material:${i}`,uvSpaceName:`材质 ${i+1}`});
}
const browser=await startChrome();
try{
 for(const dpr of [1,2]){
  const page=await browser.page();await page.send('Emulation.setDeviceMetricsOverride',{width:1580,height:1040,deviceScaleFactor:dpr,mobile:false});
  const tree=await page.send('Page.getFrameTree');await page.send('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:await readFile(resolve('unfold-lab.html'),'utf8')});await page.waitFor('window.lab?.ready',20000);
  await page.evaluate(`document.querySelector('#target').value='source';void lab.load({mesh:${JSON.stringify(mesh)},edges:new Set()})`);await page.waitFor('lab.ready && lab.mesh.name.includes("六材质")',20000);
  await check(`DPR ${dpr}: six original material frames, exact raw UVs`,async()=>{
   const r=await page.evaluate(`({spaces:lab.snapshot.geometry.atlas.spaces.length,charts:lab.snapshot.packed.length,lines:lab.view.atlasLineCount,raw:lab.snapshot.packed.every(c=>[...c.faceUVs].every(([fi,p])=>JSON.stringify(p)===JSON.stringify(lab.mesh.faces[fi].uvs)))})`);assert.equal(r.spaces,6);assert.equal(r.charts,6);assert.equal(r.lines,48);assert.ok(r.raw);return r;
  });
  await check(`DPR ${dpr}: frames have no positive-area intersection`,async()=>{
   assert.ok(await page.evaluate(`(()=>{const a=lab.snapshot.geometry.atlas.spaces;return a.every((b,i)=>a.slice(i+1).every(c=>b.max[0]<=c.min[0]||c.max[0]<=b.min[0]||b.max[1]<=c.min[1]||c.max[1]<=b.min[1]));})()`));
  });
  await check(`DPR ${dpr}: real UV canvas mouse picks each corresponding material`,async()=>{
   // The exported screen mapping is reused via the already compiled browser module.
   for(let i=0;i<6;i++){
    const p=await page.evaluate(`(()=>{const c=lab.snapshot.packed[${i}],r=document.querySelector('#uv').getBoundingClientRect(),a=lab.snapshot.geometry.atlas;const margin=22,spanX=a.max[0]-a.min[0],spanY=a.max[1]-a.min[1],scale=Math.min((r.width-2*margin)/spanX,(r.height-2*margin)/spanY);return {x:r.x+r.width/2+((c.displayOffset[0]+.75)-a.center[0])*scale,y:r.y+r.height/2-((c.displayOffset[1]+.25)-a.center[1])*scale,id:c.id};})()`);
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',clickCount:1});await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',clickCount:1});assert.deepEqual(await page.evaluate('lab.options.selected'),[p.id]);
   }
  });
  await check(`DPR ${dpr}: deliberate overlay toggle is reversible and does not edit UV`,async()=>{
   await page.evaluate(`window.originalMesh=JSON.stringify(lab.mesh);var s=document.querySelector('#source-layout');s.value='overlay';s.dispatchEvent(new Event('change'))`);await page.waitFor('lab.ready',20000);
   assert.ok(await page.evaluate('lab.snapshot.packed.every(c=>c.displayOffset.every(x=>x===0))'));
   await page.evaluate(`var s=document.querySelector('#source-layout');s.value='materials';s.dispatchEvent(new Event('change'))`);await page.waitFor('lab.ready',20000);assert.equal(await page.evaluate('lab.snapshot.geometry.atlas.spaces.length'),6);assert.ok(await page.evaluate('JSON.stringify(lab.mesh)===originalMesh'));
  });
  await check(`DPR ${dpr}: normalized source and displayed target are exact endpoints`,async()=>{
   await page.evaluate(`document.querySelector('#all').click();lab.update({progress:0});lab.view.draw()`);assert.equal(await page.evaluate('lab.view.canvas.dataset.sourceError'),'0');
   await page.evaluate('lab.update({progress:1});lab.view.draw()');assert.equal(await page.evaluate('lab.view.canvas.dataset.targetError'),'0');assert.equal(await page.evaluate('lab.view.gl.getError()'),0);
  });
  await check(`DPR ${dpr}: OBJ export keeps material identities and raw unshifted coordinates`,async()=>{
   assert.ok(await page.evaluate(`(()=>{const m=lab.core.parseOBJ(lab.core.meshToOBJ(lab.uv.meshWithPreviewUV(lab.mesh,lab.snapshot.packed)));return m.faces.every((f,i)=>f.uvSpace===lab.mesh.faces[i].uvSpace&&JSON.stringify(f.uvs)===JSON.stringify(lab.mesh.faces[i].uvs));})()`));
  });
  await check(`DPR ${dpr}: separation is bounded and selection-independent`,async()=>{
   const r=await page.evaluate(`(()=>{const g=lab.snapshot.geometry,ids=g.islands.map(i=>i.id);lab.update({selected:[ids[0]],skipStatic:false,holdNet:true,progress:.18,separation:.12});let max=0,p=lab.view.getPositions();for(let i=0;i<p.length;i+=3)max=Math.max(max,Math.hypot(p[i]-g.source[i],p[i+1]-g.source[i+1],p[i+2]-g.source[i+2]));const a=lab.uv.hingeLayout(g,ids,.12),b=lab.uv.hingeLayout(g,[ids[0]],.12);return {max,same:JSON.stringify(a.get(ids[0]))===JSON.stringify(b.get(ids[0]))};})()`);assert.ok(r.max<=.240001&&r.max>.23);assert.ok(r.same);return r;
  });
  await check(`DPR ${dpr}: in-place control removes separation stage`,async()=>{
   await page.evaluate(`document.querySelector('#in-place').click();lab.update({skipStatic:true});`);assert.equal(await page.evaluate('lab.options.separation'),0);assert.ok(await page.evaluate(`lab.options.timeline.entries.every(e=>e.profile.segments.filter(s=>s.stage==='分离').every(s=>!s.keep))`));
  });
  await check(`DPR ${dpr}: diagnostic JSON contains no mesh positions or faces`,async()=>{
   const r=await page.evaluate(`(async()=>{const old=URL.createObjectURL;let blob;URL.createObjectURL=b=>{blob=b;return old(b)};document.querySelector('#diagnostic').click();URL.createObjectURL=old;const d=JSON.parse(await blob.text());return {version:d.version,hasGeometry:!!d.mesh||Array.isArray(d.asset?.positions)||Array.isArray(d.asset?.faces),spaces:d.uvSpaces.length};})()`);assert.equal(r.version,'0.4.6');assert.equal(r.hasGeometry,false);assert.equal(r.spaces,6);return r;
  });
  await check(`DPR ${dpr}: clean WebGL and application errors`,async()=>{assert.equal(await page.evaluate('lab.view.gl.getError()'),0);assert.deepEqual(await page.evaluate('lab.errors'),[]);});
  if(dpr===1&&process.argv.includes('--screenshot')){
   await page.evaluate(`document.querySelector('#all').click();lab.update({progress:.52,skipStatic:true,separation:.12,checker:true});lab.view.fitCurrent();lab.view.draw()`);
   await writeFile(process.argv[process.argv.indexOf('--screenshot')+1],Buffer.from((await page.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  page.close();
 }
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(report.passed,'material-layout browser checks passed.');
}finally{await browser.close();}
