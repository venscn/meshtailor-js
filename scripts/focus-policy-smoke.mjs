import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name);};
try{const f=await c.load('apps/studio/src/unfold/focus-policy.js');
const sphere={id:1,center:[0,0,0],radius:2,strength:1};
check('Current island never dissolved',()=>assert.equal(f.focusVisibility([0,0,0],1,[sphere],.12),1));
check('Other surface inside sphere dissolved locally',()=>assert.ok(Math.abs(f.focusVisibility([0,0,0],2,[sphere],.12)-.12)<1e-10));
check('Same other island outside sphere stays solid',()=>assert.equal(f.focusVisibility([3,0,0],2,[sphere],.12),1));
check('Smooth feather at boundary',()=>{const v=f.focusVisibility([1.8,0,0],2,[sphere],.12);assert.ok(v>.12&&v<1);});
check('Both relay islands protected',()=>assert.equal(f.focusVisibility([0,0,0],3,[sphere,{...sphere,id:3}],.12),1));
check('Zero temporal strength means no cutaway',()=>assert.equal(f.focusVisibility([0,0,0],2,[{...sphere,strength:0}],.12),1));
const g={source:new Float32Array(9),islands:[{id:1,faces:[0]}]};
const options={focusMode:'dither',interactionActive:true,progress:.5,selected:[1],order:'sequential',separation:0,path:'direct'};
const pos=new Float32Array([10,0,0,12,0,0,10,2,0]);
check('Sphere center follows transformed vertices',()=>{const s=f.playbackFocusSpheres(g,pos,options,2)[0];assert.deepEqual(s.center,[11,1,0]);assert.ok(Math.abs(s.radius-Math.SQRT2*1.2)<1e-8);});
for(const progress of [0,1])check(`Endpoint ${progress} leaves no sphere`,()=>assert.deepEqual(f.playbackFocusSpheres(g,pos,{...options,progress},2),[]));
check('Off leaves no sphere',()=>assert.deepEqual(f.playbackFocusSpheres(g,pos,{...options,focusMode:'off'},2),[]));
check('Controls sanitized',()=>{assert.equal(f.focusSettings({focusRadius:NaN}).radius,1.2);assert.equal(f.focusSettings({focusRetained:0}).retained,.02);});
const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup();}
