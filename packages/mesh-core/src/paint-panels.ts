import type {MeshData,Vec3} from './types.js';
import {buildTopology} from './topology.js';
import {segmentMeshRegions} from './chart-regions.js';
/** Preserve substantial planar panels before coarse normal-cone segmentation.
 * Rings, teeth and concave silhouettes belong to the panel rather than being
 * distributed among arbitrary curved regions. Small coplanar facets are ignored
 * to avoid turning a hard-surface model into hundreds of shards. */
export function paintPanelSeams(mesh:MeshData,protectedCuts:ReadonlySet<string>=new Set()){
  const topology=buildTopology(mesh),count=mesh.faces.length;
  const normals:Vec3[]=[],areas:number[]=[],planes:number[]=[];let total=0;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of mesh.positions)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k]!,p[k]!);hi[k]=Math.max(hi[k]!,p[k]!);}
  const tolerance=Math.max(...hi.map((x,i)=>x-lo[i]!))*1e-5;
  for(const f of mesh.faces){const [a,b,c]=f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3],u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!] as Vec3,len=Math.hypot(...n),unit=n.map(x=>x/Math.max(len,1e-30)) as Vec3;
    normals.push(unit);areas.push(len/2);total+=len/2;planes.push(unit.reduce((s,x,i)=>s+x*a[i]!,0));}
  const adj:number[][]=Array.from({length:count},()=>[]);
  for(const [key,e] of topology.edges)if(e.faces.length===2&&!protectedCuts.has(key)){const [a,b]=e.faces;adj[a!]!.push(b!);adj[b!]!.push(a!);}
  const seen=new Uint8Array(count),label=new Int32Array(count).fill(-1),panels:number[][]=[];
  for(let root=0;root<count;root++){
    if(seen[root])continue;const faces:number[]=[],queue=[root];seen[root]=1;let area=0;
    for(let h=0;h<queue.length;h++){const fi=queue[h]!;faces.push(fi);area+=areas[fi]!;
      for(const j of adj[fi]!)if(!seen[j]){const n=normals[root]!,q=normals[j]!;
        if(n.reduce((s,x,k)=>s+x*q[k]!,0)<1-1e-8)continue;
        if(mesh.faces[j]!.vertices.some(v=>Math.abs(n.reduce((s,x,k)=>s+x*mesh.positions[v]![k]!,0)-planes[root]!)>tolerance))continue;
        seen[j]=1;queue.push(j);
      }
    }
    if(faces.length>=16&&area>=total*.02){const id=panels.length;panels.push(faces);for(const f of faces)label[f]=id;}
  }
  const seams=new Set(protectedCuts);
  for(const [key,e]of topology.edges)if(e.faces.length===2&&label[e.faces[0]!]!==label[e.faces[1]!]&&(label[e.faces[0]!]!>=0||label[e.faces[1]!]!>=0))seams.add(key);
  if(panels.length&&seams.size){
    const rest=mesh.faces.map((_,i)=>i).filter(i=>label[i]===-1);
    if(rest.length){const side=segmentMeshRegions(mesh,{normalConeDegrees:150,maxChartFaces:20000,minRegionFaces:32,minRegionAreaRatio:.1},seams,rest,()=>{},topology);for(const e of side.seamEdges)seams.add(e);}
  }
  return{seams,panels};
}
