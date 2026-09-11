import { buildTopology, type MeshData } from '@meshtailor/mesh-core';
import { EOC, EOS } from '@meshtailor/chaining-seams';

export interface CandidateMask { vertices:number[]; allowEOC:boolean; allowEOS:boolean }

/** Build once per generation. Callers must treat the returned arrays as read-only. */
export function createCandidateMasker(mesh: MeshData): (last: number | null, previous: number | null) => CandidateMask {
  const topology = buildTopology(mesh);
  const allVertices = mesh.positions.map((_, i) => i);
  return (last, previous) => {
    if (last === EOS) return { vertices: [], allowEOC: false, allowEOS: false };
    if (last === null || last === EOC) return { vertices: allVertices, allowEOC: false, allowEOS: false };
    return { vertices: (topology.neighbors[last] ?? []).filter(v => v !== previous), allowEOC: true, allowEOS: true };
  };
}

/** Standalone convenience API; use createCandidateMasker for a complete sequence. */
export function candidateMask(mesh:MeshData,last:number|null,previous:number|null):CandidateMask {
  return createCandidateMasker(mesh)(last, previous);
}
