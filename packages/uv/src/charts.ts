import { buildTopology, edgeKey, type MeshData, type MeshTopology } from '@meshtailor/mesh-core';

export interface UVChart { id:number; faces:number[]; vertices:number[] }

export function buildCharts(mesh:MeshData,seamEdges:Set<string>,cachedTopology?:MeshTopology):UVChart[]{
  const topology=cachedTopology??buildTopology(mesh);
  const unvisited=new Set(mesh.faces.keys());
  const charts:UVChart[]=[];
  while(unvisited.size){
    const root=unvisited.values().next().value as number;
    unvisited.delete(root); const faces=[root]; const queue=[root];
    for(let head=0;head<queue.length;head++){
      const fi=queue[head]!, f=mesh.faces[fi]!;
      for(const [a,b] of [[f.vertices[0],f.vertices[1]],[f.vertices[1],f.vertices[2]],[f.vertices[2],f.vertices[0]]] as const){
        const key=edgeKey(a,b); if(seamEdges.has(key)) continue;
        const e=topology.edges.get(key); if(!e) continue;
        for(const other of e.faces){ if(other!==fi && unvisited.has(other)){unvisited.delete(other);faces.push(other);queue.push(other);} }
      }
    }
    const vertices=[...new Set(faces.flatMap((fi)=>mesh.faces[fi]!.vertices))];
    charts.push({id:charts.length,faces,vertices});
  }
  return charts;
}
