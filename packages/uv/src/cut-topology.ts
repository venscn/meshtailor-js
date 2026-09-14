import { edgeKey, type MeshData, type Vec3 } from '@meshtailor/mesh-core';

export interface CutMesh {
  positions: Vec3[];
  triangles: [number, number, number][];
  sourceFaces: number[];
  sourceVertices: number[];
  boundary: number[];
  boundaries: number[][];
  disk: boolean;
  euler: number;
  boundaryLoops: number;
}
/** Union face CORNERS, not source vertex IDs: a slit can have two UV sides
 * even when both sides still belong to the SAME connected chart. */
export function cutLocalMesh(mesh: MeshData, faces: readonly number[], seams: ReadonlySet<string>): CutMesh {
  const parent = Int32Array.from({length: faces.length * 3}, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const edges = new Map<string, {a: number; b: number; ca: number; cb: number}[]>();
  faces.forEach((fi, i) => {
    const f = mesh.faces[fi]; if (!f) throw new Error(`Invalid face ${fi}`);
    for (let k=0;k<3;k++) {
      const a=f.vertices[k]!, b=f.vertices[(k+1)%3]!, key=edgeKey(a,b);
      const list=edges.get(key)??[];list.push({a,b,ca:i*3+k,cb:i*3+(k+1)%3});edges.set(key,list);
    }
  });
  for (const [key, e] of edges) if (!seams.has(key) && e.length===2) {
    const [a,b]=e;
    // Non-manifold and inconsistent winding edges become explicit borders.
    if (a!.a===b!.b && a!.b===b!.a) { union(a!.ca,b!.cb);union(a!.cb,b!.ca); }
  }
  const map=new Map<number,number>(),positions:Vec3[]=[],sourceVertices:number[]=[];
  const triangles=faces.map((fi,i)=>mesh.faces[fi]!.vertices.map((v,k)=>{
    const root=find(i*3+k);let id=map.get(root);
    if(id===undefined){id=positions.length;map.set(root,id);positions.push(mesh.positions[v]!);sourceVertices.push(v);}
    return id;
  }) as [number,number,number]);
  const localEdges=new Map<string,{a:number;b:number}[]>();
  for(const t of triangles)for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,key=edgeKey(a,b),list=localEdges.get(key)??[];list.push({a,b});localEdges.set(key,list);}
  const next=new Map<number,number>(),incoming=new Map<number,number>();let valid=true;
  for(const e of localEdges.values()){
    if(e.length>2)valid=false;
    if(e.length===1){const {a,b}=e[0]!;if(next.has(a)||incoming.has(b))valid=false;next.set(a,b);incoming.set(b,a);}
  }
  const unseen=new Set(next.keys()),loops:number[][]=[];
  while(unseen.size){const start=unseen.values().next().value!,loop:number[]=[];let v=start;
    while(unseen.has(v)){unseen.delete(v);loop.push(v);v=next.get(v)??-1;}
    if(v!==start)valid=false;loops.push(loop);
  }
  const euler=positions.length-localEdges.size+triangles.length;
  // Also detect interior pinched vertices by checking the incident face fan.
  const incident:number[][]=Array.from({length:positions.length},()=>[]);
  triangles.forEach((t,i)=>t.forEach(v=>incident[v]!.push(i)));
  for(let v=0;v<incident.length&&valid;v++){
    const fan=incident[v]!,neighbors=new Map<number,number[]>();
    for(const fi of fan){const t=triangles[fi]!,other=t.filter(x=>x!==v);for(const a of other){const list=neighbors.get(a)??[];list.push(fi);neighbors.set(a,list);}}
    const reached=new Set<number>(),queue=[fan[0]!];
    for(let h=0;h<queue.length;h++){const fi=queue[h]!;if(reached.has(fi))continue;reached.add(fi);for(const a of triangles[fi]!)if(a!==v)for(const f of neighbors.get(a)??[])if(!reached.has(f))queue.push(f);}
    if(reached.size!==fan.length)valid=false;
  }
  return {positions,triangles,sourceFaces:[...faces],sourceVertices,boundary:loops[0]??[],boundaries:loops,disk:valid&&euler===1&&loops.length===1,boundaryLoops:loops.length,euler};
}
