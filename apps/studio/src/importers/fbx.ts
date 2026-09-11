import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import type { ImportedMesh } from '@meshtailor/mesh-core';
import { sceneToMesh, disposeImportedScene, type SceneImportOptions } from './scene-mesh';

export function parseFBX(data:ArrayBuffer,name:string,options:SceneImportOptions={}):ImportedMesh{
  // Studio intentionally renders topology, not FBX materials. Ignore texture paths
  // (including embedded textures) rather than failing on absent local image files.
  const manager=new THREE.LoadingManager();
  const placeholder=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
  placeholder.needsUpdate=true;
  const textures=new THREE.TextureLoader(manager);
  textures.load=(url)=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);return placeholder;};
  manager.addHandler(/.*/,textures);
  let scene:THREE.Group|undefined;
  try{
    scene=new FBXLoader(manager).parse(data,'');
    const result=sceneToMesh(scene,name,options);
    if(scene.animations.length)result.report.warnings.push(`${scene.animations.length} animation clip(s) ignored; imported static initial pose only.`);
    result.report.warnings.push('FBX materials/textures are not displayed. UV channel 0 is preserved as face-corner coordinates; original FBX UV index identities are not recoverable from FBXLoader.');
    return result;
  }catch(error){throw new Error(`FBX import failed: ${error instanceof Error?error.message:String(error)}. Export FBX 7.4/7.5 (Binary recommended), with polygon meshes and applied modifiers.`);}
  finally{if(scene)disposeImportedScene(scene);placeholder.dispose();}
}
