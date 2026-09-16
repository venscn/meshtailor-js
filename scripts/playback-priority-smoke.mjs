import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});console.log('PASS',name);};
try{
 const u=await c.load('packages/uv/src/index.js');
 const d={source:new Float32Array([0,0,0,1,0,0,0,1,0, 0,0,0,3,0,0,0,2,0, 0,0,0,1,0,0,0,1,0]),islands:[{id:8,faces:[0]},{id:2,faces:[1]},{id:5,faces:[2]}]};
 check('All islands sorted by source triangle area not id',()=>assert.deepEqual(u.areaOrderedIslands(d,[8,2,5]),[2,5,8]));
 check('Multi-select click order cannot override area',()=>assert.deepEqual(u.areaOrderedIslands(d,[5,8,2]),[2,5,8]));
 check('Duplicates/stale indices removed, deterministic area ties',()=>assert.deepEqual(u.areaOrderedIslands(d,[8,8,99,5]),[5,8]));
 check('Single island remains single',()=>assert.deepEqual(u.areaOrderedIslands(d,[8]),[8]));
 check('Empty queue',()=>assert.deepEqual(u.areaOrderedIslands(d,[]),[]));
 check('Area cache is snapshot scoped',()=>assert.equal(u.playbackAreas(d),u.playbackAreas(d)));
 for(const rate of u.PLAYBACK_RATES)check(`${rate}x clock and ETA`,()=>{assert.ok(Math.abs(u.advanceUnfoldPlayback(.1,1000,1327.8,false,false,rate).progress-(.1+rate/1327.8))<1e-10);assert.equal(u.playbackWallSeconds(1327.8,rate),1327.8/rate);});
 check('Rate change preserves pose and integrates remaining elapsed',()=>{let p=u.advanceUnfoldPlayback(0,1000,100,false,false,2).progress;p=u.advanceUnfoldPlayback(p,1000,100,false,false,8).progress;assert.equal(p,.1);});
 check('High speed reverse wraps loops correctly',()=>assert.ok(Math.abs(u.advanceUnfoldPlayback(.1,1000,10,true,true,32).progress-.9)<1e-10));
 check('Invalid rate rejected',()=>{for(const rate of [0,-1,NaN,Infinity,65])assert.throws(()=>u.advanceUnfoldPlayback(0,10,10,false,false,rate));});
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({suite:'playback-area-rate',passed:cases.length,cases},null,2));
}finally{await c.cleanup();}
