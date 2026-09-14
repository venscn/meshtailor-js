import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js'),seam=await c.load('packages/chaining-seams/src/index.js'),draw=await c.load('apps/studio/src/unfold/uv-drawing.js');
 const mesh={name:'overlapping-material-sheets',positions:[[0,0,0],[1,0,0],[0,1,0],[2,0,0],[3,0,0],[2,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[1,0],[0,1]],uvSpace:'A',uvSpaceName:'Leather'},{vertices:[3,4,5],uvs:[[0,0],[1,0],[0,1]],uvSpace:'B',uvSpaceName:'Metal'}]};
 const original=JSON.stringify(mesh),edges=seam.extractSeamEdgesFromUV(mesh),charts=uv.buildCharts(mesh,edges),packed=uv.sourceUVPreview(mesh,charts),g=uv.buildUnfoldGeometry(mesh,packed,edges),snap={packed,geometry:g,target:'source',seams:[...edges],warnings:[]};
 assert.equal(g.atlas.spaces.length,2);checks++;
 assert.deepEqual(packed.map(p=>[...p.faceUVs.values()]),mesh.faces.map(f=>[f.uvs]));checks++;
 assert.ok(g.atlas.spaces[0].max[0]<g.atlas.spaces[1].min[0]);checks++;
 assert.equal(g.uv[0],g.uv[6]);assert.notEqual(g.displayUV[0],g.displayUV[6]);checks++;
 for(const chart of packed){const fi=[...chart.faceUVs.keys()][0],q=uv.displayUV(chart,[.2,.2]),f=draw.uvScreenFrame(g.atlas,800,500);assert.deepEqual(draw.pickUVFace(snap,800,500,f.ox+q[0]*f.scale,f.oy-q[1]*f.scale,[]),{id:chart.id,face:fi});}checks++;
 const out=uv.writeUnfoldPositions(g,{progress:1,selected:g.islands.map(i=>i.id),order:'sequential',path:'hinge',separation:.12});assert.deepEqual(out,g.target);checks++;
 const exported=core.parseOBJ(core.meshToOBJ(uv.meshWithPreviewUV(mesh,packed)));
 assert.deepEqual(exported.faces.map(f=>f.uvs),mesh.faces.map(f=>f.uvs));checks++;
 assert.deepEqual(exported.faces.map(f=>f.uvSpace),['A','B']);checks++;
 assert.equal(JSON.stringify(mesh),original);checks++;
 const overlay=uv.sourceUVPreview(mesh,charts,'overlay');assert.deepEqual(overlay.map(p=>p.displayOffset),[[0,0],[0,0]]);checks++;
 const outOfTile=structuredClone(mesh);outOfTile.faces[0].uvs.forEach(p=>p[0]+=100);outOfTile.faces[1].uvs.forEach(p=>p[0]-=100);
 const p2=uv.sourceUVPreview(outOfTile,charts),a2=uv.atlasFrame(p2);assert.ok(a2.spaces[0].max[0]<a2.spaces[1].min[0]);checks++;
 assert.throws(()=>uv.sourceUVPreview(mesh,charts,'wrong'),/layout/);checks++;
 console.log(`${checks} source-material layout checks passed`);
}finally{await c.cleanup();}
