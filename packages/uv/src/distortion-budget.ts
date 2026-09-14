/** Area-weighted quality budget; NEVER substitutes for overlap/flip validation.
 * The maximum remains reported even when a tiny-detail outlier is tolerated.
 */
export function areaDistortionBudget(samples:readonly {area:number;stretch:number}[],percentile:number,limit:number){
  if(!(percentile>=.9&&percentile<=1&&Number.isFinite(percentile)))throw new Error('Stretch area percentile must be 0.9..1.');
  if(!(limit>=1&&Number.isFinite(limit)))throw new Error('Invalid stretch limit.');
  if(samples.some(s=>!Number.isFinite(s.area)||s.area<0||!Number.isFinite(s.stretch)||s.stretch<1))throw new Error('Invalid distortion sample.');
  const total=samples.reduce((s,v)=>s+v.area,0),sorted=[...samples].sort((a,b)=>a.stretch-b.stretch);
  let sum=0,weighted=1,maximum=1,excessArea=0;
  for(const s of sorted){maximum=Math.max(maximum,s.stretch);if(s.stretch>limit)excessArea+=s.area;}
  for(const s of sorted){sum+=s.area;weighted=s.stretch;if(sum>=total*percentile)break;}
  return {areaStretch:percentile===1?maximum:weighted,maxStretch:maximum,excessAreaRatio:total?excessArea/total:0};
}
