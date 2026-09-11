import { edgeKey, type MeshData } from '@meshtailor/mesh-core';
import { EOC, EOS, serializeChains, type SeamChain } from '@meshtailor/chaining-seams';
import { candidateMask, type CandidateMask } from './candidate-mask.js';

export interface GenerationFrame {
  step:number;
  token:number;
  tokenLabel:string;
  chainIndex:number;
  currentVertex:number|null;
  previousVertex:number|null;
  mask:CandidateMask;
  revealedEdges:string[];
  message:string;
}

export function buildGenerationFrames(mesh:MeshData,chains:SeamChain[]):GenerationFrame[]{
  const tokens=serializeChains(chains); const frames:GenerationFrame[]=[]; const revealed=new Set<string>();
  let last:number|null=null,prev:number|null=null,chainIndex=0;
  for(let step=0;step<tokens.length;step++){
    const token=tokens[step]!; const mask=candidateMask(mesh,last,prev);
    if(token>=0 && last!==null && last>=0) revealed.add(edgeKey(last,token));
    const label=token===EOC?'[EOC]':token===EOS?'[EOS]':`v${token}`;
    frames.push({
      step,token,tokenLabel:label,chainIndex,currentVertex:token>=0?token:(last!==null&&last>=0?last:null),previousVertex:token>=0&&last!==null&&last>=0?last:prev,mask,
      revealedEdges:[...revealed],
      message:token===EOC?`Chain ${chainIndex+1} complete`:token===EOS?'Generation complete':last===null||last===EOC?`Start chain ${chainIndex+1} at v${token}`:`Traverse ${last} → ${token}`
    });
    if(token===EOC){chainIndex++;last=EOC;prev=null;continue;}
    if(token===EOS){last=EOS;continue;}
    prev=last!==null&&last>=0?last:null; last=token;
  }
  return frames;
}
