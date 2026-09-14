import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
  const core=await c.load('packages/mesh-core/src/index.js'),seams=await c.load('packages/chaining-seams/src/index.js');
  const input={asset:{version:'2.0'},materials:[{name:'Leather',normalTexture:{index:0}},{name:'Metal'}],images:[{uri:'texture.png'}],textures:[{}],meshes:[{primitives:[{material:0},{material:1}]}]};
  const doc=core.geometryOnlyGLTF(input);
  assert.deepEqual(doc.meshes[0].primitives.map(p=>p.material),[0,1]);checks++;
  assert.deepEqual(doc.materials.map(m=>m.extras.meshtailorUV.id),['material:0','material:1']);checks++;
  assert.equal(doc.images,undefined);assert.equal(doc.textures,undefined);assert.equal(doc.materials[0].normalTexture,undefined);checks++;
  assert.deepEqual(core.geometryOnlyGLTF(doc),doc);checks++;
  assert.equal(input.materials[0].normalTexture.index,0);checks++;
  const mesh={name:'domains',positions:[[0,0,0],[1,0,0],[0,1,0],[1,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[1,0],[0,1]],uvSpace:'leather'},{vertices:[1,3,2],uvs:[[1,0],[1,1],[0,1]],uvSpace:'metal'}]};
  assert.deepEqual([...seams.extractSeamEdgesFromUV(mesh)],['1:2']);checks++;
  const round=core.parseOBJ(core.meshToOBJ(mesh));
  assert.deepEqual(round.faces.map(f=>f.uvSpace),['leather','metal']);checks++;
  assert.deepEqual(round.faces.map(f=>f.uvs),mesh.faces.map(f=>f.uvs));checks++;
  assert.deepEqual([...seams.extractSeamEdgesFromUV(round)],['1:2']);checks++;
  console.log(`${checks} material-domain checks passed`);
}finally{await c.cleanup();}
