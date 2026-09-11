import type { SeamChain } from './chains.js';
export const EOC = -1;
export const EOS = -2;

export function serializeChains(chains: SeamChain[]): number[] {
  const out:number[]=[];
  chains.forEach((chain,i)=>{
    out.push(...chain.vertices);
    if(i < chains.length-1) out.push(EOC);
  });
  out.push(EOS);
  return out;
}

export function candidateIdForToken(token:number):number {
  if(token===EOC) return 0;
  if(token===EOS) return 1;
  return token+2;
}
