import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name)};
try {const f=await c.load('apps/studio/src/unfold/focus-policy.js');const o={progress:.3,selected:[10,4,8],order:'relay',handoff:.85,path:'direct',separation:0,interactionActive:true};
 check('Default is smooth full-context ghost, not a local dither bubble',()=>assert.equal(f.focusSettings({}).mode,'ghost'));
 check('First unfinished island stays opaque; waiting others ghost',()=>assert.deepEqual(f.playbackEmphasis(o),[10]));
 check('Paused mid-motion restores previous display',()=>assert.equal(f.playbackEmphasis({...o,interactionActive:false}),null));
 check('Programmatic seek alone does not create session',()=>assert.equal(f.playbackEmphasis({...o,interactionActive:undefined}),null));
 check('Handoff protects both islands',()=>assert.deepEqual(f.playbackEmphasis({...o,progress:.9/2.7}),[10,4]));
 check('An almost-complete island is still opaque',()=>assert.deepEqual(f.playbackEmphasis({...o,progress:.99999/2.7}),[10,4]));
 check('Completed island leaves motion set; arrival presentation is a separate layer',()=>assert.deepEqual(f.playbackEmphasis({...o,progress:1.0001/2.7}),[4]));
 check('Reverse at same pose protects same two actual moving islands',()=>assert.deepEqual(f.playbackEmphasis({...o,progress:1.8/2.7}),[4,8]));
 for(const progress of [0,1])check('Endpoint '+progress+' restores regardless of stale interaction flag',()=>assert.equal(f.playbackEmphasis({...o,progress}),null));
 check('Off overrides session',()=>assert.equal(f.playbackEmphasis({...o,focusMode:'off'}),null));
 check('Legacy bubble requires explicit alternative',()=>assert.equal(f.playbackEmphasis({...o,focusMode:'dither'}),null));
 check('No active islands restores',()=>assert.equal(f.playbackEmphasis({...o,selected:[]}),null));
 check('Opacity finite and bounded',()=>{assert.equal(f.focusSettings({focusOpacity:NaN}).opacity,.18);assert.equal(f.focusSettings({focusOpacity:0}).opacity,.03);assert.equal(f.focusSettings({focusOpacity:1}).opacity,.65)});
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup()}
