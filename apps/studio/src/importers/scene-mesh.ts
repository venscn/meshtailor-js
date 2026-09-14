import * as THREE from 'three';
import { assembleMeshParts, type ImportedMesh, type MeshFace, type MeshImportOptions, type RawMeshPart, type Vec2, type Vec3 } from '@meshtailor/mesh-core';

export interface SceneImportOptions extends MeshImportOptions { includeHidden?: boolean }

/** Flatten transformed, indexed OR non-indexed triangle meshes to the core format.
 * getVertexPosition samples current morph/skin pose. Animation clips are not played.
 * Geometry welding is deliberately scoped to one source object / instance.
 */
export function sceneToMesh(root: THREE.Object3D, name: string, options: SceneImportOptions = {}): ImportedMesh {
  root.updateMatrixWorld(true);
  root.traverse(obj => { if ((obj as THREE.SkinnedMesh).isSkinnedMesh) (obj as THREE.SkinnedMesh).skeleton.update(); });
  const parts: RawMeshPart[] = [], warnings: string[] = [];
  let totalTriangles=0,totalSourceVertices=0,skinned=0;
  const materialIds=new Map<THREE.Material,string>();let unknownDomains=false;
  const maxTriangles=options.maxTriangles??300_000;
  root.traverse(obj => {
    const mesh=obj as THREE.Mesh;
    if(!mesh.isMesh)return;
    if(!options.includeHidden){let current:THREE.Object3D|null=obj;while(current){if(!current.visible)return;current=current.parent;}}
    const geometry=mesh.geometry,attribute=geometry.getAttribute('position');
    if(!attribute)return;
    if((mesh as THREE.SkinnedMesh).isSkinnedMesh)skinned++;
    const index=geometry.index,count=index?.count??attribute.count;
    const start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count);
    if(start%3 || (end-start)%3)throw new Error(`${obj.name}: triangle index count is not divisible by 3.`);
    const instances=(obj as THREE.InstancedMesh).isInstancedMesh?(obj as THREE.InstancedMesh).count:1;
    totalTriangles+=(end-start)/3*instances;
    totalSourceVertices+=attribute.count*instances;
    if(totalSourceVertices>maxTriangles*3)throw new Error('Source vertex count exceeds the import budget. Remove unused vertices or split the mesh.');
    if(totalTriangles>maxTriangles)throw new Error(`Import exceeds ${maxTriangles.toLocaleString()} triangles. Split or decimate this asset first.`);
    const uv=geometry.getAttribute('uv'),v=new THREE.Vector3();
    for(let instance=0;instance<instances;instance++){
      const transform=obj.matrixWorld.clone();
      if((obj as THREE.InstancedMesh).isInstancedMesh){const m=new THREE.Matrix4();(obj as THREE.InstancedMesh).getMatrixAt(instance,m);transform.multiply(m);}
      if(Math.abs(transform.determinant())<Number.MIN_VALUE)throw new Error(`${obj.name}: singular transform.`);
      const positions:Vec3[]=[],faces:MeshFace[]=[];
      for(let i=0;i<attribute.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(transform);positions.push([v.x,v.y,v.z]);}
      const mirrored=transform.determinant()<0;
      for(let i=start;i<end;i+=3){
        const ids:[number,number,number]=index?[index.getX(i),index.getX(i+1),index.getX(i+2)]:[i,i+1,i+2];
        // A negative world scale reverses triangle winding, including corner UV order.
        if(mirrored)[ids[1],ids[2]]=[ids[2],ids[1]];
        const corner=(j:number):Vec2|null=>uv?[uv.getX(j),uv.getY(j)]:null;
        // Material groups are in index-buffer coordinates, before mirrored winding.
        const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);
        const material=Array.isArray(mesh.material)?mesh.material[group?.materialIndex??0]:mesh.material;
        const domain=material?.userData?.meshtailorUV as {id?:string;name?:string}|undefined;
        if(material&&!materialIds.has(material))materialIds.set(material,`material:${materialIds.size}`);
        const known=!!domain?.id||!!material?.name;
        if(!known)unknownDomains=true;
        faces.push({vertices:ids,uvs:[corner(ids[0]),corner(ids[1]),corner(ids[2])],
          uvSpace:domain?.id||(known&&material?materialIds.get(material)!:`object:${parts.length}`),
          uvSpaceName:domain?.name||(known&&material?material.name:`${obj.name||'Mesh'} · 材质未知`),
          sourcePart:`object:${parts.length}`});
      }
      parts.push({name:`${obj.name||'Mesh'}${instances>1?` #${instance}`:''}`,positions,faces});
    }
  });
  if(skinned)warnings.push(`${skinned} skinned mesh(es) imported at the loaded initial pose. Animation playback is not part of this import.`);
  const result=assembleMeshParts(parts,name,{weld:'boundary',...options});
  if(unknownDomains)warnings.push('Some material identities are unavailable. Their UV views are conservatively separated by source object; this is not a recovered original atlas. Old geometry-only caches should be downloaded again.');
  result.report.warnings.push(...warnings);
  return result;
}

export function disposeImportedScene(root: THREE.Object3D): void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(obj=>{
    const mesh=obj as THREE.Mesh;
    if(mesh.geometry)geometries.add(mesh.geometry);
    for(const material of mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[]){
      materials.add(material);
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
    }
    if((obj as THREE.SkinnedMesh).isSkinnedMesh)(obj as THREE.SkinnedMesh).skeleton.dispose();
  });
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
}
