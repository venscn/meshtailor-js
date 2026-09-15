import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];
try {
  const s=await c.load('apps/studio/src/unfold/selection-policy.js');
  const all=[2,4,7],owners=new Int32Array([2,2,4,4,7]);
  const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS '+name);};
  const pick=(state,id,face,additive=false)=>s.resolveInspectionPick(state,{id,face,additive},all,owners);
  let state=s.EMPTY_INSPECTION;
  check('empty inspection even when all islands can be in the playback queue',()=>assert.deepEqual(state,{islands:[],face:null}));
  check('first triangle hit selects only its island',()=>{const r=pick(state,2,0);assert.equal(r.kind,'island');state=r.state;assert.deepEqual(state,{islands:[2],face:null});});
  check('second hit on an explicitly selected island selects the triangle',()=>{const r=pick(state,2,0);assert.equal(r.kind,'face');state=r.state;assert.equal(state.face,0);});
  check('third hit on the same triangle clears only the face',()=>{state=pick(state,2,0).state;assert.deepEqual(state,{islands:[2],face:null});});
  check('selecting another face replaces the current face',()=>{state=pick(state,2,0).state;state=pick(state,2,1).state;assert.equal(state.face,1);});
  check('new island clears the previous face without selecting its hit face',()=>{state=pick(state,4,2).state;assert.deepEqual(state,{islands:[4],face:null});});
  check('list selection ignores ray-hit face entirely',()=>{state=s.selectInspectionIsland(state,7,all);assert.deepEqual(state,{islands:[7],face:null});});
  check('label click on the same island clears face without toggling the island',()=>{state=pick(state,7,4).state;state=pick(state,7,null).state;assert.deepEqual(state,{islands:[7],face:null});});
  check('modifier adds an island but never selects its face',()=>{state=pick(state,2,0,true).state;assert.deepEqual(state,{islands:[7,2],face:null});});
  check('face pick inside a multiselection keeps all islands',()=>{state=pick(state,2,1).state;assert.deepEqual(state,{islands:[7,2],face:1});});
  check('modifier deselects an island and clears triangle focus',()=>{state=pick(state,2,1,true).state;assert.deepEqual(state,{islands:[7],face:null});});
  check('Escape clears triangle before islands',()=>{state=pick(state,7,4).state;state=s.escapeInspection(state);assert.deepEqual(state,{islands:[7],face:null});state=s.escapeInspection(state);assert.deepEqual(state,s.EMPTY_INSPECTION);});
  for(const [name,id,face] of [['unknown island',99,0],['negative face',2,-1],['wrong owner',2,4],['out of range',2,10],['noninteger',2,0.5],['NaN',2,NaN]])
    check('reject '+name,()=>{const r=pick(state,id,face);assert.equal(r.kind,'none');assert.equal(r.state,state);});
  check('repeated select/deselect does not mutate source state',()=>{const original=Object.freeze({islands:Object.freeze([2]),face:null});assert.equal(pick(original,2,0).state.face,0);assert.deepEqual(original,{islands:[2],face:null});});
  check('rapid consecutive picks use sequential state, not a double-click special case',()=>{let x=s.EMPTY_INSPECTION;for(const expected of [null,0,null,0,null]){x=pick(x,2,0).state;assert.equal(x.face,expected);}});
  const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({suite:'Two-level inspection selection',passed:cases.length,cases},null,2)+'\n');
  console.log(`PASS ${cases.length} cases`);
} finally {await c.cleanup();}
