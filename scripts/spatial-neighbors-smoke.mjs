import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js');
 const mesh={name:'detached-neighbors',positions:[],faces:[]},packed=[];
 for(const [id,x]of [[0,0],[1,1.01],[2,10]]){const i=mesh.positions.length;mesh.positions.push([x,0,0],[x+1,0,0],[x+1,1,0],[x,1,0]);const fi=mesh.faces.length;mesh.faces.push({vertices:[i,i+1,i+2]},{vertices:[i,i+2,i+3]});packed.push({id,faceUVs:new Map([[fi,[[0,0],[1,0],[1,1]]],[fi+1,[[0,0],[1,1],[0,1]]]]),bounds:[0,0,1,1],polygon:[]});}
 const before=structuredClone(mesh),raw=uv.rawChartsFromPreview(mesh,packed);
 const g=uv.buildSpatialNeighbors(mesh,raw,{neighborDistanceRatio:.003});assert.equal(g.links.length,1);checks++;
 assert.equal(g.links[0].kind,'spatial');assert.equal(g.links[0].stitchable,false);checks++;
 assert.deepEqual(g.groups,[[0,1],[2]]);assert.ok(g.links[0].distance<.011);checks++;
 assert.deepEqual(uv.buildSpatialNeighbors(mesh,raw,{neighborDistanceRatio:.003}),g);checks++;
 const off=uv.buildSpatialNeighbors(mesh,raw,{spatialNeighbors:false});assert.equal(off.groups.length,3);checks++;
 assert.equal(uv.buildSpatialNeighbors(mesh,raw,{neighborDistanceRatio:.00001}).links.length,0);checks++;
 const a=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'spatial',atlasPageCount:1,neighborDistanceRatio:.003});
 assert.equal(a.pageReport.actual,2);assert.equal(a.packed.length,3);checks++;
 assert.equal(a.pageReport.geometryComponents,3);assert.equal(a.pageReport.associationComponents,2);checks++;
 assert.equal(a.packed[0].atlasPage,a.packed[1].atlasPage);assert.notEqual(a.packed[0].atlasPage,a.packed[2].atlasPage);checks++;
 assert.equal(uv.mergeAdjacentCharts(mesh,raw,new Set(),uv.DEFAULT_UNWRAP).raw.length,3,'spatial association must not invent a weld');checks++;
 for(const page of a.pageReport.pages){const triangles=a.packed.filter(c=>page.charts.includes(c.id)).flatMap(c=>[...c.faceUVs.values()]);assert.ok(uv.checkUVTriangles(triangles).valid);checks++;}
 assert.deepEqual(mesh,before);checks++;
 for(const opts of [{neighborDistanceRatio:NaN},{neighborSamples:0},{maxSpatialNeighbors:Infinity}]){assert.throws(()=>uv.buildSpatialNeighbors(mesh,raw,opts),/settings/);checks++;}
 assert.throws(()=>uv.buildSpatialNeighbors(mesh,raw,{}, {check(){throw new uv.UVWorkStopped('stop');},report(){}}),/stop/);checks++;
 console.log(`${checks} spatial-neighbor checks passed; detached near panels associate but remain 3 true islands, in 2 spatial page groups; no geometry mutation.`);
}finally{await c.cleanup();}
