import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const c=await compileCore();const cases=[];const check=(name,f)=>{f();cases.push({name,passed:true});};
try{
 const core=await c.load('packages/mesh-core/src/index.js');
 const m=core.makeCube(),original=structuredClone(m);
 for(const f of m.faces){Object.defineProperty(f,'uvs',{get(){throw Error('SOURCE UV READ');},enumerable:true});Object.defineProperty(f,'uvIndices',{get(){throw Error('SOURCE UV INDEX READ');},enumerable:true});Object.defineProperty(f,'sourceIsland',{get(){throw Error('SOURCE ISLAND READ');},enumerable:true});}
 let g;
 check('Whitelist never reads coordinate/index/island getters',()=>{g=core.geometryOnlyMesh(m);});
 check('No UV fields survive the input boundary',()=>{for(const f of g.faces){assert.ok(!Object.hasOwn(f,'uvs'));assert.ok(!Object.hasOwn(f,'uvIndices'));assert.ok(!Object.hasOwn(f,'sourceIsland'));}});
 check('Vertex and triangle identity preserved',()=>{assert.deepEqual(g.positions,original.positions);assert.deepEqual(g.faces.map(f=>f.vertices),original.faces.map(f=>f.vertices));});
 check('Copy is detached from source geometry',()=>{g.positions[0][0]++;g.faces[0].vertices[0]++;assert.deepEqual(m.positions,original.positions);assert.deepEqual(m.faces.map(f=>f.vertices),original.faces.map(f=>f.vertices));});
 check('Material and object metadata retained explicitly',()=>{const f={vertices:[0,1,2],uvSpace:'paint',uvSpaceName:'Paint',sourcePart:'obj'};assert.deepEqual(core.geometryOnlyMesh({name:'m',positions:[[0,0,0],[1,0,0],[0,1,0]],faces:[f]}).faces,[f]);});
 await mkdir('validation/v0.4.20/tests',{recursive:true});await writeFile('validation/v0.4.20/tests/input.json',JSON.stringify({passed:cases.length,cases},null,2));console.log(cases.length+' geometry-input tests passed');
}finally{await c.cleanup();}
