import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { MeshData, Vec2, Vec3 } from '@meshtailor/mesh-core';

export async function loadGLTFFile(file:File):Promise<MeshData>{
  const url=URL.createObjectURL(file);
  try{
    const gltf=await new GLTFLoader().loadAsync(url); gltf.scene.updateMatrixWorld(true);
    const positions:Vec3[]=[]; const faces:MeshData['faces']=[];
    gltf.scene.traverse((obj)=>{
      if(!(obj instanceof THREE.Mesh))return;
      const g=obj.geometry as THREE.BufferGeometry; const pos=g.getAttribute('position'); if(!pos)return;
      const uv=g.getAttribute('uv'); const base=positions.length; const v=new THREE.Vector3();
      for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(obj.matrixWorld);positions.push([v.x,v.y,v.z]);}
      const idx=g.index;
      const triCount=idx?idx.count/3:pos.count/3;
      for(let t=0;t<triCount;t++){
        const a=idx?idx.getX(t*3):t*3,b=idx?idx.getX(t*3+1):t*3+1,c=idx?idx.getX(t*3+2):t*3+2;
        const corner=(i:number):Vec2|null=>uv?[uv.getX(i),uv.getY(i)]:null;
        faces.push({vertices:[base+a,base+b,base+c],uvs:[corner(a),corner(b),corner(c)]});
      }
    });
    if(!positions.length||!faces.length)throw new Error('No triangle meshes found in glTF/GLB.');
    return {name:file.name,positions,faces};
  }finally{URL.revokeObjectURL(url);}
}
