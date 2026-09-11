import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { edgeKey, type MeshData } from '@meshtailor/mesh-core';
import type { GenerationFrame } from '@meshtailor/runtime';

interface Props { mesh:MeshData; seamEdges:Set<string>; frame?:GenerationFrame; wireframe:boolean }

export function MeshViewport({mesh,seamEdges,frame,wireframe}:Props){
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!host.current)return;
    const el=host.current; const scene=new THREE.Scene(); scene.background=new THREE.Color(0x0b0d12);
    const camera=new THREE.PerspectiveCamera(42,1,0.01,1000); const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); el.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;
    scene.add(new THREE.HemisphereLight(0xffffff,0x202431,2.1)); const dl=new THREE.DirectionalLight(0xffffff,2.2);dl.position.set(3,5,4);scene.add(dl);

    const geo=new THREE.BufferGeometry(); const pos:number[]=[];
    for(const f of mesh.faces)for(const vi of f.vertices)pos.push(...mesh.positions[vi]!);
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:0x8590a8,roughness:.78,metalness:.02,side:THREE.DoubleSide,wireframe});
    const obj=new THREE.Mesh(geo,mat);scene.add(obj);

    const seamPos:number[]=[];
    for(const key of seamEdges){const [a,b]=key.split(':').map(Number);if(mesh.positions[a!]&&mesh.positions[b!])seamPos.push(...mesh.positions[a!]!,...mesh.positions[b!]!);}
    if(seamPos.length){const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(seamPos,3));scene.add(new THREE.LineSegments(sg,new THREE.LineBasicMaterial({color:0xff5d73})));}

    if(frame){
      const candidatePositions:number[]=[];for(const vi of frame.mask.vertices){const p=mesh.positions[vi];if(p)candidatePositions.push(...p);}
      if(candidatePositions.length){const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(candidatePositions,3));scene.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0xffcf66,size:7,sizeAttenuation:false})));}
      const addMarker=(vi:number|null,color:number,scale:number)=>{if(vi===null||!mesh.positions[vi])return;const p=mesh.positions[vi]!;const g=new THREE.SphereGeometry(scale,16,12);const m=new THREE.MeshBasicMaterial({color});const s=new THREE.Mesh(g,m);s.position.set(...p);scene.add(s);};
      const box=new THREE.Box3().setFromObject(obj);const size=box.getSize(new THREE.Vector3()).length();
      addMarker(frame.previousVertex,0x52a8ff,size*.008);addMarker(frame.currentVertex,0x64e6a7,size*.012);
    }

    const box=new THREE.Box3().setFromObject(obj),center=box.getCenter(new THREE.Vector3()),size=Math.max(.1,box.getSize(new THREE.Vector3()).length());
    camera.position.copy(center).add(new THREE.Vector3(size*.75,size*.5,size*.85));camera.near=size/1000;camera.far=size*20;camera.updateProjectionMatrix();controls.target.copy(center);controls.update();
    const resize=()=>{const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
    const ro=new ResizeObserver(resize);ro.observe(el);resize();let raf=0;const tick=()=>{controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(tick);};tick();
    return()=>{cancelAnimationFrame(raf);ro.disconnect();controls.dispose();renderer.dispose();geo.dispose();mat.dispose();el.removeChild(renderer.domElement);};
  },[mesh,seamEdges,frame,wireframe]);
  return <div ref={host} className="viewport"/>;
}
