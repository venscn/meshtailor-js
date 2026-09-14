import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'UV core work progress and interruption',cases:[]};
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),demo=await c.load('apps/studio/src/unfold/demo.js');
 const {mesh,edges}=demo.makeHingeDemo(),events=[];
 const work={check(){},report(p){events.push(p);}};
 const r=uv.unwrapMesh(mesh,edges,{},work);uv.buildUnfoldGeometry(mesh,r.packed,new Set(r.seams),work);
 for(const stage of ['validate','charts','topology','parameterize','quality','orient','pack','correspondence','hinge'])assert.ok(events.some(p=>p.stage===stage),stage);
 const counts=events.filter(p=>p.facesDone!==undefined).map(p=>p.facesDone);assert.ok(counts.every((x,i)=>!i||x>=counts[i-1]));assert.equal(counts.at(-1),mesh.faces.length);
 assert.deepEqual(uv.unwrapMesh(mesh,edges),r);
 const curved=core.makeComplexExample('knot','low');const instrumented=uv.unwrapMesh(curved,new Set(),{},work),plain=uv.unwrapMesh(curved,new Set());assert.deepEqual(instrumented,plain);
 report.cases.push({name:'Instrumentation does not alter recursive distortion cuts or UV results',passed:true});
 report.cases.push({name:'Actual stages and monotonic accepted-face progress reported',passed:true});
 const stop=new uv.UVWorkStopped('injected deadline');
 const interrupt={check(){},report(p){if(p.stage==='quality')throw stop;}};
 assert.throws(()=>uv.unwrapMesh(mesh,edges,{},interrupt),e=>e===stop);
 report.cases.push({name:'Deadline during quality checks escapes both numerical fallback and recursive repair',passed:true});
 const disk=uv.cutLocalMesh(mesh,[0,1],edges);
 assert.throws(()=>uv.parameterizeChart(disk,{}, {check(){throw stop;},report(){}}),e=>e===stop);
 report.cases.push({name:'Iterative solver deadline is not swallowed by LSCM/Tutte retry',passed:true});
 assert.throws(()=>uv.unwrapMesh(core.makeCube(),new Set(),{}, {check(){throw stop;},report(){}}),e=>e===stop);
 assert.throws(()=>uv.buildUnfoldGeometry(mesh,r.packed,new Set(r.seams),{check(){throw stop;},report(){}}),e=>e===stop);
 report.cases.push({name:'Preflight and geometry building honor interruption',passed:true});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await c.cleanup();}
