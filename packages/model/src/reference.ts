/** Lightweight reference math used to validate preprocessing/model ports without binding to a training framework. */
export function fourierEncode(input:number[],bands=6):number[]{
  const out=[...input];
  for(const x of input) for(let k=0;k<bands;k++){const w=Math.pow(2,k)*Math.PI;out.push(Math.sin(w*x),Math.cos(w*x));}
  return out;
}

export function meanNeighborAggregate(features:number[][],neighbors:number[][]):number[][]{
  const d=features[0]?.length ?? 0;
  return features.map((self,i)=>{
    const ns=neighbors[i] ?? []; if(!ns.length)return [...self];
    const mean=Array(d).fill(0) as number[];
    for(const n of ns) for(let j=0;j<d;j++) mean[j]!+=features[n]![j]!/ns.length;
    // Canonical GraphSAGE input to a learnable projection is concat(self, mean(neighbors)).
    return [...self,...mean];
  });
}
