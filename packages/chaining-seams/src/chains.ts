import { edgeKey, type MeshData } from '@meshtailor/mesh-core';
import type { SeamEdgeSet } from './seam-extract.js';

export interface SeamChain {
  id: string;
  vertices: number[];
  closed: boolean;
}

function edgeVertices(key: string): [number, number] {
  const [a,b] = key.split(':').map(Number);
  return [a!,b!];
}

/** Decompose a seam subgraph into maximal paths and closed loops. Branch vertices terminate paths. */
export function traceSeamChains(_mesh: MeshData, seams: SeamEdgeSet): SeamChain[] {
  const adj = new Map<number, number[]>();
  for (const key of seams) {
    const [a,b] = edgeVertices(key);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push(b); adj.get(b)!.push(a);
  }
  for (const values of adj.values()) values.sort((a,b)=>a-b);
  const unused = new Set(seams);
  const chains: SeamChain[] = [];

  const walk = (start: number, next: number): number[] => {
    const vertices = [start, next];
    unused.delete(edgeKey(start,next));
    let prev = start, cur = next;
    while (true) {
      const ns = adj.get(cur) ?? [];
      if (ns.length !== 2) break;
      const candidate = ns[0] === prev ? ns[1]! : ns[0]!;
      const key = edgeKey(cur,candidate);
      if (!unused.has(key)) {
        if (candidate === start && vertices[vertices.length-1] !== start) vertices.push(start);
        break;
      }
      unused.delete(key);
      vertices.push(candidate);
      prev = cur; cur = candidate;
      if (cur === start) break;
    }
    return vertices;
  };

  const endpoints = [...adj.keys()].filter((v)=>(adj.get(v)?.length ?? 0) !== 2).sort((a,b)=>a-b);
  for (const start of endpoints) {
    for (const next of adj.get(start) ?? []) {
      if (!unused.has(edgeKey(start,next))) continue;
      const vertices = walk(start,next);
      chains.push({ id: `chain-${chains.length}`, vertices, closed: vertices.length > 2 && vertices[0] === vertices[vertices.length-1] });
    }
  }

  // Everything left belongs to degree-2 components, i.e. loops.
  while (unused.size) {
    const firstKey = [...unused].sort()[0]!;
    const [start,next] = edgeVertices(firstKey);
    const vertices = walk(start,next);
    if (vertices[vertices.length-1] !== start) {
      const last = vertices[vertices.length-1]!;
      if ((adj.get(last) ?? []).includes(start)) {
        unused.delete(edgeKey(last,start));
        vertices.push(start);
      }
    }
    chains.push({ id: `chain-${chains.length}`, vertices, closed: vertices.length > 2 && vertices[0] === vertices[vertices.length-1] });
  }
  return chains;
}

export function chainEdgeKeys(chain: SeamChain): Set<string> {
  const out = new Set<string>();
  for (let i=0;i<chain.vertices.length-1;i++) out.add(edgeKey(chain.vertices[i]!,chain.vertices[i+1]!));
  return out;
}
