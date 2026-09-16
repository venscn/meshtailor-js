import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name)};
try{const b=await c.load('apps/studio/src/unfold/uv-box-selection.js');
const rect={x0:0,y0:0,x1:1,y1:1},triangle=[[.2,.2],[.8,.2],[.2,.8]];
check('Contained actual triangle intersects',()=>assert.ok(b.triangleIntersectsRect(triangle,rect)));
check('Rectangle inside a triangle intersects',()=>assert.ok(b.triangleIntersectsRect([[-2,-2],[4,-2],[-2,4]],rect)));
check('No false selection of empty concavity from only bounds',()=>assert.ok(!b.triangleIntersectsRect([[0,2],[2,0],[2,2]],{x0:0,y0:0,x1:.3,y1:.3})));
check('Rectangle reverse direction equivalent',()=>assert.ok(b.triangleIntersectsRect(triangle,{x0:1,y0:1,x1:0,y1:0})));
check('Thin crossing edges caught',()=>assert.ok(b.triangleIntersectsRect([[-1,.5],[2,.5],[-1,.51]],rect)));
check('Plain drag replaces explicit island selection',()=>assert.deepEqual(b.applyBoxSelection([0],[2,3],[0,1,2,3],'replace'),[2,3]));
check('Shift adds',()=>assert.deepEqual(b.applyBoxSelection([0],[2,3],[0,1,2,3],'add'),[0,2,3]));
check('Alt inverts only box hits',()=>assert.deepEqual(b.applyBoxSelection([0,2],[2,3],[0,1,2,3],'invert'),[0,3]));
check('Repeated inverse restores selection',()=>{const a=b.applyBoxSelection([0,2],[2,3],[0,1,2,3],'invert');assert.deepEqual(b.applyBoxSelection(a,[2,3],[0,1,2,3],'invert'),[0,2]);});
check('Ctrl removes and ignores stale ids',()=>assert.deepEqual(b.applyBoxSelection([0,2],[2,99],[0,1,2,3],'subtract'),[0]));
check('Empty plain rectangle clears',()=>assert.deepEqual(b.applyBoxSelection([0],[],[0,1],'replace'),[]));
check('Modifier mapping and precedence',()=>{const e={altKey:false,shiftKey:false,ctrlKey:false,metaKey:false};assert.equal(b.boxSelectionMode(e),'replace');assert.equal(b.boxSelectionMode({...e,altKey:true}),'invert');assert.equal(b.boxSelectionMode({...e,metaKey:true}),'subtract');assert.equal(b.boxSelectionMode({...e,shiftKey:true}),'add');});
const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup()}
