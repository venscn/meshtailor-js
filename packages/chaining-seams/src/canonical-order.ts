import { buildTopology, distance3, edgeKey, triangleArea, type MeshData } from '@meshtailor/mesh-core';
import { chainEdgeKeys, type SeamChain } from './chains.js';

interface Patch { faces: Set<number>; area: number }

function faceArea(mesh: MeshData, fi: number): number {
  const f = mesh.faces[fi]!;
  return triangleArea(mesh.positions[f.vertices[0]]!, mesh.positions[f.vertices[1]]!, mesh.positions[f.vertices[2]]!);
}

function patch(mesh: MeshData, faces: Iterable<number>): Patch {
  const set = new Set(faces); let area=0;
  for (const fi of set) area += faceArea(mesh,fi);
  return { faces:set, area };
}

function splitPatch(mesh: MeshData, current: Patch, loop: SeamChain): [Patch,Patch] | null {
  if (!loop.closed) return null;
  const topology = buildTopology(mesh);
  const blocked = chainEdgeKeys(loop);
  // A valid internal loop must have two incident faces inside the current patch for every edge.
  for (const key of blocked) {
    const e = topology.edges.get(key);
    if (!e || e.faces.length !== 2 || !e.faces.every((fi)=>current.faces.has(fi))) return null;
  }
  const unvisited = new Set(current.faces);
  const comps: Set<number>[]=[];
  while(unvisited.size){
    const root=unvisited.values().next().value as number;
    const comp=new Set<number>([root]); unvisited.delete(root);
    const queue=[root];
    while(queue.length){
      const fi=queue.shift()!;
      const f=mesh.faces[fi]!;
      for(const [a,b] of [[f.vertices[0],f.vertices[1]],[f.vertices[1],f.vertices[2]],[f.vertices[2],f.vertices[0]]] as const){
        if(blocked.has(edgeKey(a,b))) continue;
        const e=topology.edges.get(edgeKey(a,b));
        if(!e) continue;
        for(const other of e.faces){
          if(other!==fi && current.faces.has(other) && unvisited.has(other)){
            unvisited.delete(other); comp.add(other); queue.push(other);
          }
        }
      }
    }
    comps.push(comp);
  }
  if(comps.length!==2) return null;
  return [patch(mesh,comps[0]!),patch(mesh,comps[1]!)];
}

export function chainLength(mesh: MeshData, chain: SeamChain): number {
  let len=0;
  for(let i=0;i<chain.vertices.length-1;i++) len += distance3(mesh.positions[chain.vertices[i]!]!,mesh.positions[chain.vertices[i+1]!]!);
  return len;
}

/** Implements Appendix B.2 Algorithm 1 as closely as possible on face patches. */
export function canonicalOrder(mesh: MeshData, chains: SeamChain[]): SeamChain[] {
  const loops=chains.filter((c)=>c.closed);
  const opens=chains.filter((c)=>!c.closed);
  const remaining=new Set(loops);
  let patches: Patch[]=[patch(mesh,mesh.faces.keys())];
  const ordered: SeamChain[]=[];

  while(patches.length && remaining.size){
    patches.sort((a,b)=>b.area-a.area);
    let handled=false;
    for(let pi=0;pi<patches.length;pi++){
      const p=patches[pi]!;
      const candidates: {loop:SeamChain; split:[Patch,Patch]; balance:number}[]=[];
      for(const loop of remaining){
        const split=splitPatch(mesh,p,loop);
        if(!split) continue;
        const [a,b]=split;
        if(a.area < 1e-12 || b.area < 1e-12) continue;
        candidates.push({loop,split,balance:Math.min(a.area,b.area)/Math.max(a.area,b.area)});
      }
      if(!candidates.length) continue;
      candidates.sort((a,b)=>b.balance-a.balance || a.loop.id.localeCompare(b.loop.id));
      const best=candidates[0]!;
      ordered.push(best.loop); remaining.delete(best.loop);
      patches.splice(pi,1,...best.split);
      handled=true; break;
    }
    if(!handled) break;
  }
  // Degenerate/non-separating loops remain deterministic, then open chains by decreasing 3D length.
  ordered.push(...[...remaining].sort((a,b)=>chainLength(mesh,b)-chainLength(mesh,a) || a.id.localeCompare(b.id)));
  ordered.push(...opens.sort((a,b)=>chainLength(mesh,b)-chainLength(mesh,a) || a.id.localeCompare(b.id)));
  return ordered;
}
