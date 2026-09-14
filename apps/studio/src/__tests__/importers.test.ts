/** Real Three.js + FBXLoader integration tests. Requires installed npm dependencies. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildTopology, triangleNormal, writeGLB, type GLTFDocument } from '@meshtailor/mesh-core';
import { extractSeamEdgesFromUV } from '@meshtailor/chaining-seams';
import { parseFBX, sceneToMesh, importMeshFiles } from '../importers';
import { disposeImportedScene } from '../importers/scene-mesh';
function bytes(path:string):ArrayBuffer{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;}
describe('Three scene topology adapter',()=>{
  it('keeps material groups in index order, including mirrored transforms',()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1,1,0],3));g.setIndex([0,1,2,1,3,2]);g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.addGroup(0,3,0);g.addGroup(3,3,1);
    const a=new THREE.MeshBasicMaterial(),b=new THREE.MeshBasicMaterial();a.name='Leather';b.name='Metal';const obj=new THREE.Mesh(g,[a,b]);obj.scale.x=-1;
    try{const {mesh}=sceneToMesh(obj,'groups');expect(mesh.faces.map(f=>f.uvSpaceName)).toEqual(['Leather','Metal']);expect(new Set(mesh.faces.map(f=>f.uvSpace)).size).toBe(2);expect(extractSeamEdgesFromUV(mesh).size).toBe(1);}finally{disposeImportedScene(obj);}
  });
  it('stitches unique near-coincident open boundary edges within one source object',()=>{
    const d=2e-7,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1+d,0,0,1,1,0,d,1,0],3));const obj=new THREE.Mesh(g);
    try{const r=sceneToMesh(obj,'near-boundary');expect(r.mesh.faces).toHaveLength(2);expect(r.report.stitchedEdges).toBe(1);expect(r.mesh.positions).toHaveLength(4);}finally{disposeImportedScene(obj);}
  });
  it('welds hard-normal splits in indexed geometry',()=>{
    const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);
    try{const result=sceneToMesh(root,'box');expect(result.mesh.positions).toHaveLength(8);expect(result.mesh.faces).toHaveLength(12);expect(buildTopology(result.mesh).boundaryEdges.size).toBe(0);}finally{disposeImportedScene(root);}
  });
  it('handles nonindexed render geometry and nested transforms',()=>{
    const root=new THREE.Group();root.position.set(10,20,30);const child=new THREE.Group();child.scale.set(2,3,4);root.add(child);child.add(new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(),new THREE.MeshBasicMaterial()));
    try{const {mesh}=sceneToMesh(root,'transformed');expect(mesh.positions).toHaveLength(8);expect(Math.min(...mesh.positions.map(p=>p[0]))).toBe(9);expect(Math.max(...mesh.positions.map(p=>p[1]))).toBe(21.5);}finally{disposeImportedScene(root);}
  });
  it('corrects winding and UV corner order for a mirrored parent',()=>{
    const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1],2));const mesh=new THREE.Mesh(g);mesh.scale.x=-1;
    try{const result=sceneToMesh(mesh,'mirror').mesh,face=result.faces[0]!;expect(triangleNormal(...face.vertices.map(v=>result.positions[v]!) as [THREE.Vector3Tuple,THREE.Vector3Tuple,THREE.Vector3Tuple])[2]).toBeGreaterThan(0);expect(face.uvs).toEqual([[0,0],[0,1],[1,0]]);}finally{disposeImportedScene(mesh);}
  });
  it('keeps separate overlapping objects separate',()=>{
    const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry()),new THREE.Mesh(new THREE.BoxGeometry()));
    try{expect(sceneToMesh(root,'parts').mesh.positions).toHaveLength(16);}finally{disposeImportedScene(root);}
  });
  it('samples mesh instances instead of dropping them',()=>{
    const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial(),2);mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(5,0,0));
    try{const result=sceneToMesh(mesh,'instances');expect(result.report.parts).toBe(2);expect(result.mesh.faces).toHaveLength(24);expect(Math.max(...result.mesh.positions.map(p=>p[0]))).toBe(5.5);}finally{disposeImportedScene(mesh);}
  });
  it('samples current morph-target shape',()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.morphTargetsRelative=true;g.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,2,0,0,2,0,0,2],3)];const mesh=new THREE.Mesh(g);mesh.morphTargetInfluences![0]=.5;
    try{expect(sceneToMesh(mesh,'morph').mesh.positions.every(p=>p[2]===1)).toBe(true);}finally{disposeImportedScene(mesh);}
  });
  it('samples the loaded skeletal pose',()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(12).fill(0),4));g.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));const mesh=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));bone.position.y=2;
    try{const result=sceneToMesh(mesh,'skin');expect(Math.min(...result.mesh.positions.map(p=>p[1]))).toBe(2);expect(result.report.warnings.join(' ')).toMatch(/initial pose/);}finally{disposeImportedScene(mesh);}
  });
});

describe('FBXLoader on actual bundled files',()=>{
  for(const format of ['ascii','binary'])it(`parses the ${format} FBX 7.4 garment and recovers usable adjacency`,()=>{
    const result=parseFBX(bytes(`../../public/assets/fixtures/garment-${format}.fbx`),`garment-${format}.fbx`);
    expect(result.mesh.faces).toHaveLength(3072);expect(result.mesh.positions).toHaveLength(1584);expect(result.report.uvFaces).toBe(3072);expect(buildTopology(result.mesh).boundaryEdges.size).toBe(96);expect(extractSeamEdgesFromUV(result.mesh).size).toBeGreaterThan(0);
  });
  it('shows a readable failure for a corrupt FBX',()=>expect(()=>parseFBX(new ArrayBuffer(16),'corrupt.fbx')).toThrow(/FBX import failed/));
});

function triangleGLTF(external:boolean){
  const position=new Float32Array([0,0,0,1,0,0,0,1,0]);
  const document:GLTFDocument={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],buffers:[{byteLength:36,...(external?{uri:'positions.bin'}:{})}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}],textures:[{source:0}],images:[{uri:'absent-texture.png'}]};
  return {document,binary:new Uint8Array(position.buffer)};
}
describe('Unified local import',()=>{
  // Node does not provide ProgressEvent, which Three FileLoader uses for streamed blobs.
  if(typeof globalThis.ProgressEvent==='undefined')globalThis.ProgressEvent=class extends Event{lengthComputable=false;loaded=0;total=0;constructor(type:string,init:ProgressEventInit={}){super(type);Object.assign(this,init);}} as unknown as typeof ProgressEvent;
  it('imports geometry-only GLB without trying to load its absent texture',async()=>{const {document,binary}=triangleGLTF(false);const {mesh}=await importMeshFiles([new File([writeGLB(document,binary)],'triangle.GLB')]);expect(mesh.faces).toHaveLength(1);expect(mesh.faces[0]!.uvSpace).toBe('material:0');});
  it('resolves a glTF companion .bin selected with its model',async()=>{const {document,binary}=triangleGLTF(true);const result=await importMeshFiles([new File([JSON.stringify(document)],'triangle.gltf'),new File([binary],'positions.bin')]);expect(result.mesh.faces).toHaveLength(1);});
  it('rejects missing resources and multiple main models with useful messages',async()=>{const {document}=triangleGLTF(true);await expect(importMeshFiles([new File([JSON.stringify(document)],'triangle.gltf')])).rejects.toThrow(/Missing/);await expect(importMeshFiles([new File([],'a.fbx'),new File([],'b.obj')])).rejects.toThrow(/exactly ONE/);});
});
