import { computeVertexNormals, sampleSurface, type MeshData } from '@meshtailor/mesh-core';
import { canonicalOrder, extractSeamEdgesFromUV, serializeChains, traceSeamChains } from '@meshtailor/chaining-seams';

export interface TrainingSample {
  name:string;
  vertices:number[][];
  faces:number[][];
  points:number[][];
  target:number[];
}
function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function buildTrainingSample(mesh:MeshData,pointCount=2048,seed=1):TrainingSample{
  const normals=mesh.normals ?? computeVertexNormals(mesh);
  const seams=extractSeamEdgesFromUV(mesh); const chains=canonicalOrder(mesh,traceSeamChains(mesh,seams));
  const points=sampleSurface(mesh,pointCount,mulberry32(seed)).map((p)=>[...p.position,...p.normal]);
  return {name:mesh.name,vertices:mesh.positions.map((p,i)=>[...p,...normals[i]!]),faces:mesh.faces.map((f)=>[...f.vertices]),points,target:serializeChains(chains)};
}
