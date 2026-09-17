/** Incomplete Cholesky(0) for a symmetric positive definite sparse system.
 * It is an acceleration only. Residuals and all geometric acceptance checks use
 * the ORIGINAL system; diagonal shifts do not change the solved objective.
 */
export function incompleteCholesky(rows:readonly ReadonlyMap<number,number>[]):((r:Float64Array,z:Float64Array)=>void)|undefined {
  const n=rows.length,pattern=rows.map((row,i)=>[...row.keys()].filter(j=>j<i).sort((a,b)=>a-b));
  const offsets=new Uint32Array(n+1);for(let i=0;i<n;i++)offsets[i+1]=offsets[i]!+pattern[i]!.length;
  const columns=new Uint32Array(offsets[n]!),values=new Float64Array(columns.length),diag=new Float64Array(n);
  for(let i=0;i<n;i++)columns.set(pattern[i]!,offsets[i]);
  for(const shift of [0,1e-4,.01,.1,1]){
    values.fill(0);diag.fill(0);let ok=true;
    for(let i=0;i<n&&ok;i++){
      for(let a=offsets[i]!;a<offsets[i+1]!;a++){
        const j=columns[a]!;let value=rows[i]!.get(j)??0,p=offsets[i]!,q=offsets[j]!;
        while(p<a&&q<offsets[j+1]!){const x=columns[p]!,y=columns[q]!;if(x===y){value-=values[p]!*values[q]!;p++;q++;}else if(x<y)p++;else q++;}
        values[a]=value/diag[j]!;
      }
      let d=(rows[i]!.get(i)??0)*(1+shift);
      for(let a=offsets[i]!;a<offsets[i+1]!;a++)d-=values[a]!*values[a]!;
      if(!(d>Math.max(1e-30,(rows[i]!.get(i)??0)*1e-12))||!Number.isFinite(d)){ok=false;break;}
      diag[i]=Math.sqrt(d);
    }
    if(ok)return(r,z)=>{
      for(let i=0;i<n;i++){let s=r[i]!;for(let k=offsets[i]!;k<offsets[i+1]!;k++)s-=values[k]!*z[columns[k]!]!;z[i]=s/diag[i]!;}
      for(let i=n-1;i>=0;i--){z[i]/=diag[i]!;for(let k=offsets[i]!;k<offsets[i+1]!;k++)z[columns[k]!]!-=values[k]!*z[i]!;}
    };
  }
  return undefined;
}
