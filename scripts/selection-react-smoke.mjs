/** Requires npm install. Real React StrictMode / production useUnfoldPlayer.
 * Direct hook actions test React scheduling; pointer integration is tested separately.
 */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {startChrome,delay} from './chrome-cdp.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url));
if(!existsSync(vite))throw new Error('Real React/Vite dependencies are required. Run npm install; no substitute React runtime is used.');
const server=spawn(process.execPath,[vite,'apps/studio','--host','127.0.0.1','--port','4181','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
let serverLog='',browser;
server.stdout.on('data',x=>serverLog+=x);server.stderr.on('data',x=>serverLog+=x);
const report={suite:'Real React StrictMode selection hook',cases:[]};
try{
  let ready=false;
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(serverLog);try{ready=(await fetch('http://127.0.0.1:4181/tests/selection-hook.html')).ok;}catch{}if(ready)break;await delay(100);}
  if(!ready)throw Error('Vite unavailable: '+serverLog);
  browser=await startChrome();const page=await browser.page();
  await page.send('Page.navigate',{url:'http://127.0.0.1:4181/tests/selection-hook.html'});
  await page.waitFor('window.selectionHarness?.player.all.length===6',20000);
  const run=async code=>{await page.evaluate('(()=>{const p=selectionHarness.player,s=selectionHarness.snapshot;'+code+'})()');await delay(60);};
  const state=()=>page.evaluate('(()=>{const p=selectionHarness.player;return {islands:p.selection,face:p.focusFace,active:p.active,playing:p.playing,progress:p.progress};})()');
  const check=async(name,fn)=>{await fn();report.cases.push({name,passed:true});console.log('PASS '+name);};
  const [id,face,other]=await page.evaluate('[selectionHarness.player.all[0],selectionHarness.snapshot.geometry.islands[0].faces[0],selectionHarness.player.all[1]]');
  await check('mount does not preselect a face or inspection island',async()=>{assert.deepEqual((await state()).islands,[]);assert.equal((await state()).face,null);});
  await check('first pick only selects island',async()=>{await run(`p.pick(${id},${face},false)`);assert.deepEqual((await state()).islands,[id]);assert.equal((await state()).face,null);});
  await check('second pick selects face and keeps timeline memo identity',async()=>{await run('p.seek(.4)');await run('window.savedTimeline=p.timeline');await run(`p.pick(${id},${face},false)`);assert.equal((await state()).face,face);assert.equal((await state()).progress,.4);assert.ok(await page.evaluate('selectionHarness.player.timeline===window.savedTimeline'));});
  await check('same face toggles off without changing island',async()=>{await run(`p.pick(${id},${face},false)`);assert.equal((await state()).face,null);assert.deepEqual((await state()).islands,[id]);});
  await check('rapid picks in one React batch use up-to-date inspection',async()=>{await run(`p.clear();p.pick(${id},${face},false);p.pick(${id},${face},false)`);assert.equal((await state()).face,face);});
  await check('list selection never retains triangle',async()=>{await run(`p.select(${id})`);assert.equal((await state()).face,null);});
  await check('face selection preserves multiselect queue',async()=>{await run(`p.pick(${other},null,true)`);await run(`p.pick(${id},${face},false)`);assert.deepEqual((await state()).active,[id,other]);});
  await check('face toggles do not pause real RAF playback',async()=>{await run('p.seek(.3)');await run('p.toggle()');await run(`p.pick(${id},${face},false)`);assert.ok((await state()).playing);const before=(await state()).progress;await page.waitFor(`selectionHarness.player.progress>${before}`,4000);await run('p.pause()');});
  await check('new island clears triangle instead of automatically choosing one',async()=>{await run(`p.select(${id});p.pick(${other},s.geometry.islands[1].faces[0],false)`);assert.equal((await state()).face,null);assert.deepEqual((await state()).islands,[other]);});
  await check('Escape removes face then island',async()=>{await run(`p.select(${id})`);await run(`p.pick(${id},${face},false)`);await run('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))');assert.equal((await state()).face,null);assert.deepEqual((await state()).islands,[id]);await run('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))');assert.deepEqual((await state()).islands,[]);});
  await check('new snapshot invalidates prior inspection',async()=>{await run(`p.select(${id})`);await run(`p.pick(${id},${face},false)`);await run('selectionHarness.reload()');assert.deepEqual((await state()).islands,[]);assert.equal((await state()).face,null);});
  report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log('PASS '+report.passed+' React cases');page.close();
}finally{await browser?.close();server.kill();}
