import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'Render-only overlap policy',cases:[]};
try {
 const m=await c.load('apps/studio/src/unfold/overlap-policy.js');
 const test=(name,fn)=>{fn();report.cases.push({name,passed:true});console.log('PASS',name);};
 test('auto is default; moving islands use projected diagnostics',()=>assert.equal(m.overlapSettings({}).mode,'auto'));
 test('off is preserved',()=>assert.equal(m.overlapSettings({overlapMode:'off'}).mode,'off'));
 test('invalid mode and NaN values fall back',()=>assert.deepEqual(m.overlapSettings({overlapMode:'unknown',overlapTolerance:NaN,overlapOpacity:Infinity}),m.overlapSettings({})));
 test('tolerance and alpha are bounded',()=>{const a=m.overlapSettings({overlapTolerance:-1,overlapOpacity:12});assert.equal(a.tolerance,1e-6);assert.equal(a.opacity,1);});
 test('face tones can be disabled without switching detection',()=>assert.equal(m.overlapSettings({faceTones:false}).faceTones,false));
 test('texture allocation is capped across extreme viewports',()=>{for(const [w,h] of [[800,600],[6000,4000],[12000,200],[1,8000]]){const s=m.diagnosticSize(w,h);assert.ok(s.width*s.height<=m.MAX_DIAGNOSTIC_PIXELS);assert.ok(s.width<=2048&&s.height<=2048);}});
 test('small views remain full resolution',()=>assert.deepEqual(m.diagnosticSize(800,600),{width:800,height:600}));
 test('device maximum texture size is obeyed',()=>assert.ok(m.diagnosticSize(3000,2000,512).width<=512));
 test('source scale uses longest side not island count or hinge spread',()=>assert.equal(m.sourceModelScale(new Float32Array([-1,-2,-3,1,2,3])),6));
 test('empty geometry scale stays finite',()=>assert.equal(m.sourceModelScale(new Float32Array()),1));
 test('linear depth precision floor is explicit',()=>{assert.ok(m.overlapWorldTolerance(1,1e-6,200)>1e-6);assert.equal(m.overlapWorldTolerance(10,.001,200),.01);});
 test('legend never calls projected occlusion a collision',()=>assert.ok(m.overlapLegend('projected').includes('非几何相交')));
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');
}finally{await c.cleanup();}
