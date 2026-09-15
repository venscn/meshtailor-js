import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js');
 // Material IDs deliberately interleave geometric components; new pages must NOT follow them.
 const mesh={name:'two-connected-sheets',positions:[[0,0,0],[1,0,0],[0,1,0],[1,1,0],[3,0,0],[4,0,0],[3,1,0],[4,1,0]],faces:[{vertices:[0,1,3],uvSpace:'a'},{vertices:[0,3,2],uvSpace:'b'},{vertices:[4,5,7],uvSpace:'a'},{vertices:[4,7,6],uvSpace:'b'}]};
 const raw=mesh.faces.map((f,id)=>({id,faceUVs:new Map([[id,f.vertices.map(i=>mesh.positions[i].slice(0,2))]]),area3D:.5}));
 const p=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'adjacency',atlasPageCount:2});
 assert.equal(p.pageReport.actual,2);checks++;
 assert.deepEqual(p.pageReport.pages.map(p=>p.charts),[[0,1],[2,3]]);checks++;
 assert.equal(p.pageReport.retainedSharedBoundaryRatio,1);checks++;
 assert.ok(p.packed.every(c=>c.atlasPage!==undefined));checks++;
 for(const page of p.pageReport.pages){const faces=p.packed.filter(c=>c.atlasPage===page.id).flatMap(c=>[...c.faceUVs.values()]);assert.ok(uv.checkUVTriangles(faces).valid);}checks++;
 assert.ok(p.pageReport.pages.every(page=>Math.abs(page.scale-p.scale)<1e-12));checks++;
 const exported=core.parseOBJ(core.meshToOBJ(uv.meshWithPreviewUV(mesh,p.packed)));assert.deepEqual(exported.faces.map(f=>f.uvSpace),['atlas-page-1','atlas-page-1','atlas-page-2','atlas-page-2']);checks++;
 for(const c of p.packed)for(const [fi,vs]of c.faceUVs)assert.deepEqual(exported.faces[fi].uvs,vs);checks++;
 const one=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'adjacency',atlasPageCount:1});assert.equal(one.pageReport.actual,2);checks++;
 const single=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'single'});assert.ok(uv.checkUVTriangles(single.packed.flatMap(c=>[...c.faceUVs.values()])).valid);checks++;
 const g=uv.buildUnfoldGeometry(mesh,p.packed,new Set(core.buildTopology(mesh).edges.keys()));assert.equal(g.atlas.spaces.length,2);assert.deepEqual(uv.writeUnfoldPositions(g,{progress:1,selected:g.islands.map(i=>i.id),order:'sequential',path:'hinge',separation:.12}),g.target);checks++;
 const requested=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'adjacency',atlasPageCount:3});assert.equal(requested.pageReport.actual,3);checks++;
 const components=uv.packConnectedAtlas(mesh,raw,{atlasPageMode:'components',atlasPageCount:4});assert.equal(components.pageReport.actual,2);checks++;
 assert.throws(()=>uv.packConnectedAtlas(mesh,raw,{atlasPageCount:65}),/page target/);checks++;
 console.log(`${checks} connectivity-page / export checks passed.`);
}finally{await c.cleanup();}
