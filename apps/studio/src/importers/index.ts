import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { geometryOnlyGLTF, parseOBJ, readGLB, writeGLB, type GLTFDocument, type ImportedMesh } from '@meshtailor/mesh-core';
import { parseFBX } from './fbx';
import { sceneToMesh, disposeImportedScene, type SceneImportOptions } from './scene-mesh';

const normalize=(s:string)=>decodeURIComponent(s).replace(/\\/g,'/').replace(/^\.\//,'').split(/[?#]/)[0]!;
export function selectModelFile(files:File[]):File{
  const candidates=files.filter(f=>/\.(obj|fbx|glb|gltf)$/i.test(f.name));
  if(candidates.length!==1)throw new Error('Select exactly ONE .obj, .fbx, .glb or .gltf model. For glTF, select its .bin companion(s) at the same time.');
  return candidates[0]!;
}
export async function importMeshFiles(files:File[],options:SceneImportOptions={}):Promise<ImportedMesh>{
  const file=selectModelFile(files),ext=file.name.split('.').pop()!.toLowerCase();
  if(file.size>256*1024*1024)throw new Error('Model exceeds the 256 MiB browser import limit. Split or decimate it first.');
  if(ext==='obj'){
    const mesh=parseOBJ(await file.text(),file.name);
    if(mesh.faces.length>(options.maxTriangles??300_000))throw new Error('OBJ exceeds the configured triangle limit.');
    return {mesh,report:{parts:1,sourceVertices:mesh.positions.length,vertices:mesh.positions.length,triangles:mesh.faces.length,weldedVertices:0,droppedDegenerate:0,uvFaces:mesh.faces.filter(f=>f.uvs?.every(Boolean)).length,weld:'off',warnings:['OBJ retains original topology and UV indices. Welding settings apply to FBX/glTF only.']}};
  }
  const data=await file.arrayBuffer();
  if(ext==='fbx')return parseFBX(data,file.name,options);
  const blobs:string[]=[],manager=new THREE.LoadingManager();
  manager.setURLModifier(url=>{
    if(url.startsWith('data:')||url.startsWith('blob:'))return url;
    const wanted=normalize(url),candidates=files.filter(f=>normalize(f.webkitRelativePath||f.name)===wanted);
    if(!candidates.length)candidates.push(...files.filter(f=>f.name===wanted.split('/').pop()));
    if(candidates.length!==1)throw new Error(`Missing or ambiguous glTF resource: ${wanted}. Select its .bin file together with the .gltf. External URLs in local imports are not fetched.`);
    const blob=URL.createObjectURL(candidates[0]!);blobs.push(blob);return blob;
  });
  let scene:THREE.Group|undefined;
  try{
    let source:string|ArrayBuffer;
    if(ext==='glb'){const parsed=readGLB(data);source=writeGLB(geometryOnlyGLTF(parsed.document),parsed.binary);}
    else source=JSON.stringify(geometryOnlyGLTF(JSON.parse(new TextDecoder().decode(data)) as GLTFDocument));
    const gltf=await new GLTFLoader(manager).parseAsync(source,'');scene=gltf.scene;
    const result=sceneToMesh(scene,file.name,options);
    if(gltf.animations.length)result.report.warnings.push(`${gltf.animations.length} animation clip(s) ignored.`);
    result.report.warnings.push('Topology view: materials/images are skipped. glTF render splits are welded per object; corner UV coordinates are retained.');
    return result;
  }finally{if(scene)disposeImportedScene(scene);blobs.forEach(url=>URL.revokeObjectURL(url));}
}
export { parseFBX, sceneToMesh };
export type { SceneImportOptions };
