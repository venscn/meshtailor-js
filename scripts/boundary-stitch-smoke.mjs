import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const core=await c.load('packages/mesh-core/src/index.js');
 const part={name:'split render quad',positions:[[0,0,0],[1,0,0],[0,1,0],[1+1e-8,0,0],[1,1,0],[1e-8,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]},{vertices:[3,4,5],uvs:[[.2,0],[1,1],[.2,1]]}]};
 const before=JSON.stringify(part),exact=core.assembleMeshParts([part],'exact',{weld:'exact'}),fixed=core.assembleMeshParts([part],'boundary',{weld:'boundary'});
 assert.equal(exact.mesh.positions.length,6);assert.equal(fixed.mesh.positions.length,4);checks++;
 assert.equal(fixed.report.stitchedEdges,1);assert.equal(fixed.mesh.faces.length,2);checks++;
 assert.deepEqual(fixed.mesh.faces.map(f=>f.uvs),part.faces.map(f=>f.uvs));checks++;
 assert.equal(JSON.stringify(part),before);checks++;
 const far=structuredClone(part);far.positions[3][0]+=.001;far.positions[5][0]+=.001;
 assert.equal(core.assembleMeshParts([far],'gap',{weld:'boundary'}).report.stitchedEdges,0);checks++;
 const objects=part.faces.map((f,i)=>({name:`part${i}`,positions:part.positions,faces:[f]}));
 assert.equal(core.assembleMeshParts(objects,'separate',{weld:'boundary'}).report.stitchedEdges,0);checks++;
 const ambiguous=structuredClone(part);ambiguous.positions.push([1+2e-8,0,0],[1,1,1],[2e-8,1,0]);ambiguous.faces.push({vertices:[6,7,8]});
 const a=core.assembleMeshParts([ambiguous],'ambiguous',{weld:'boundary'});assert.equal(a.report.stitchedEdges,0);assert.ok(a.report.ambiguousBoundaryEdges>0);checks++;
 const tiny=structuredClone(part);tiny.positions=tiny.positions.map(p=>p.map(v=>v*.00001));
 assert.equal(core.assembleMeshParts([tiny],'scale',{weld:'boundary'}).report.stitchedEdges,1);checks++;
 const huge=structuredClone(part);huge.positions=huge.positions.map(p=>p.map(v=>v*100000));
 assert.equal(core.assembleMeshParts([huge],'scale',{weld:'boundary'}).report.stitchedEdges,1);checks++;
 assert.throws(()=>core.stitchBoundaryPairs([],[],0),/tolerance/);checks++;
 console.log(`${checks} boundary-stitch checks passed`);
}finally{await c.cleanup();}
