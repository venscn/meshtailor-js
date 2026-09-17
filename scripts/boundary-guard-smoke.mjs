import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];
const test=(name,f)=>{f();cases.push({name,passed:true});console.log('PASS',name);};
try {
 const {simpleUVBoundary:valid}=await c.load('packages/uv/src/boundary-guard.js');
 test('Simple concave boundary is accepted',()=>assert.ok(valid([[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]],[[0,1,2,3,4,5]])));
 test('Non-adjacent crossing is rejected before ARAP commits',()=>assert.equal(valid([[0,0],[2,2],[0,2],[2,0]],[[0,1,2,3]]),false));
 test('Non-adjacent contact is rejected',()=>assert.equal(valid([[0,0],[2,0],[2,2],[1,0],[0,2]],[[0,1,2,3,4]]),false));
 test('Near-edge separated boundaries remain valid',()=>assert.ok(valid([[0,0],[1,0],[1,1],[0,1],[1.001,0],[2,0],[2,1],[1.001,1]],[[0,1,2,3],[4,5,6,7]])));
 test('Crossing multiple loops are rejected',()=>assert.equal(valid([[0,0],[1,0],[1,1],[0,1],[.5,-.5],[1.5,-.5],[1.5,.5],[.5,.5]],[[0,1,2,3],[4,5,6,7]]),false));
 test('Scale and translation do not alter verdict',()=>{const p=[[0,0],[2,2],[0,2],[2,0]];for(const s of [1e-6,2,1e5])assert.equal(valid(p.map(([x,y])=>[x*s+7,y*s-1]),[[0,1,2,3]]),false);});
 test('Non-finite input and zero-length edges rejected',()=>{assert.equal(valid([[0,0],[0,0],[1,1]],[[0,1,2]]),false);assert.equal(valid([[0,0],[NaN,0],[1,1]],[[0,1,2]]),false);});
 test('Cancellation is propagated',()=>assert.throws(()=>valid([[0,0],[1,0],[0,1]],[[0,1,2]],{check(){throw Error('cancelled')}}),/cancelled/));
 await mkdir('validation/v0.4.18/tests',{recursive:true});await writeFile('validation/v0.4.18/tests/boundary-guard.json',JSON.stringify({passed:cases.length,cases},null,2));
}finally{await c.cleanup();}
