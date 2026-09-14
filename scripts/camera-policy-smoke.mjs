import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { compileCore } from './lib/compiled-core.mjs';
const compiled = await compileCore();
const report = { suite: 'Camera follow ownership policy', cases: [] };
const check = (name, fn) => { fn(); report.cases.push({ name, passed: true }); console.log('PASS', name); };
try {
  const { CameraFollowPolicy, DEFAULT_AUTO_FRAME } = await compiled.load('apps/studio/src/unfold/camera-policy.js');
  check('Studio and lab share a manual-camera default', () => assert.equal(DEFAULT_AUTO_FRAME, false));
  check('A new renderer never enables follow implicitly', () => assert.equal(new CameraFollowPolicy().active, false));
  check('Ordinary progress updates keep manual mode', () => { const p = new CameraFollowPolicy(); for (let i=0;i<1000;i++) { assert.equal(p.setRequested(false), false); assert.equal(p.active, false); } });
  check('An explicit enable requests an immediate fit even when paused', () => { const p=new CameraFollowPolicy(); assert.equal(p.setRequested(true), true); assert.equal(p.active, true); assert.equal(p.setRequested(true), false); });
  check('First manual input interrupts follow and signals UI exactly once', () => { const p=new CameraFollowPolicy(); p.setRequested(true); assert.equal(p.takeManualControl(), true); assert.equal(p.active, false); assert.equal(p.takeManualControl(), false); });
  check('Stale enabled props cannot override the manual camera for later frames', () => { const p=new CameraFollowPolicy(); p.setRequested(true); p.takeManualControl(); for (let i=0;i<1000;i++) { assert.equal(p.setRequested(true), false); assert.equal(p.active, false); } });
  check('Acknowledging off does not itself resume follow', () => { const p=new CameraFollowPolicy(); p.setRequested(true); p.takeManualControl(); assert.equal(p.setRequested(false), false); assert.equal(p.active, false); });
  check('Only an explicit off/on transition re-arms follow', () => { const p=new CameraFollowPolicy(); p.setRequested(true); p.takeManualControl(); p.setRequested(false); assert.equal(p.setRequested(true), true); assert.equal(p.active, true); });
  check('Manual input while already in manual mode is idempotent', () => { const p=new CameraFollowPolicy(); assert.equal(p.takeManualControl(), false); assert.equal(p.active, false); assert.equal(p.setRequested(true), true); });
  check('Explicitly disabling follow preserves manual ownership', () => { const p=new CameraFollowPolicy(); p.setRequested(true); p.setRequested(false); for (let i=0;i<5;i++) assert.equal(p.takeManualControl(), false); });
  report.passed=report.cases.length;
  const i=process.argv.indexOf('--report'); if (i>=0) await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');
} finally { await compiled.cleanup(); }
