import { buildTopology, type MeshData } from '@meshtailor/mesh-core';
import { EOC, EOS } from '@meshtailor/chaining-seams';

export interface CandidateMask { vertices:number[]; allowEOC:boolean; allowEOS:boolean }

/** Paper Appendix B.3.4: 1-ring mask plus control tokens, removing immediate backtracking. */
export function candidateMask(mesh:MeshData,last:number|null,previous:number|null):CandidateMask{
  if(last===EOS) return {vertices:[],allowEOC:false,allowEOS:false};
  if(last===null || last===EOC) return {vertices:mesh.positions.map((_,i)=>i),allowEOC:false,allowEOS:false};
  const topology=buildTopology(mesh);
  const vertices=(topology.neighbors[last] ?? []).filter((v)=>v!==previous);
  return {vertices,allowEOC:true,allowEOS:true};
}
