import type {PackedChart} from './preview.js';

export const DEFAULT_FILL_DENSITY_LIMIT = 3;
export type FillGrowthStop = 'density-limit' | 'gain-limit' | 'no-fit-found' | 'time-budget' | 'trial-budget' | 'round-limit' | 'validation-rejected' | 'not-tried' | 'complete';
export interface FillGrowthRow {
  id:number; areaBefore:number; areaAfter:number; areaFactor:number; linearFactor:number;
  area3D:number; densityBefore:number; densityAfter:number; allowedAreaFactor:number;
  tries:number; reason:FillGrowthStop;
}
export interface FillGrowthSummary {
  enlarged:number; unchanged:number; densityLimited:number; gainLimited:number; notTried:number;
  beforeArea:number; afterArea:number; addedArea:number; maxAreaFactor:number; minAreaFactor:number;
  rows:FillGrowthRow[];
}
export function fillChartArea(chart:Pick<PackedChart,'faceUVs'>):number {
  let result=0;
  for(const [a,b,c] of chart.faceUVs.values())result+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
  return result;
}
/** Audit committed coordinates, not attempted multipliers. A translation is
 * not enlargement; a rejected proposal is never counted as a finished change. */
export function auditFillGrowth(before:PackedChart[],after:PackedChart[],areas:ReadonlyMap<number,number>,limits:{density:number;absoluteGain:number;mode:'uniform'|'area-priority';stop:string;commonAccepted:number},attempts:ReadonlyArray<{id:number;tries:number;minStepFailed:boolean}>):FillGrowthSummary {
  if(!before.length||before.length!==after.length||new Set(before.map(c=>c.id)).size!==before.length||new Set(after.map(c=>c.id)).size!==after.length)throw Error('Fill growth audit: island coverage changed.');
  const prior=new Map(before.map(c=>[c.id,c])),stats=new Map(attempts.map(a=>[a.id,a]));
  const rows:FillGrowthRow[]=after.map(c=>{
    const original=prior.get(c.id),area3D=areas.get(c.id);if(!original||!Number.isFinite(area3D)||!(area3D!>0))throw Error('Fill growth audit: island identity or 3D area missing.');
    const areaBefore=fillChartArea(original),areaAfter=fillChartArea(c);if(!Number.isFinite(areaBefore+areaAfter)||!(areaBefore>0&&areaAfter>0))throw Error('Fill growth audit: non-positive UV area.');
    return{id:c.id,areaBefore,areaAfter,areaFactor:areaAfter/areaBefore,linearFactor:Math.sqrt(areaAfter/areaBefore),area3D:area3D!,densityBefore:areaBefore/area3D!,densityAfter:areaAfter/area3D!,allowedAreaFactor:1,tries:stats.get(c.id)?.tries??0,reason:'complete'};
  });
  const minDensity=Math.min(...rows.map(r=>r.densityAfter));
  for(const r of rows){
    const densityCap=limits.mode==='uniform'?Infinity:minDensity*limits.density/r.densityBefore;
    r.allowedAreaFactor=Math.max(r.areaFactor,Math.min(limits.absoluteGain,densityCap));
    if(limits.stop==='validation-rejected')r.reason='validation-rejected';
    else if(limits.absoluteGain<=r.areaFactor+1e-8)r.reason='gain-limit';
    else if(densityCap<=r.areaFactor+1e-8)r.reason='density-limit';
    else if(limits.stop==='time-budget'||limits.stop==='trial-budget')r.reason=limits.stop;
    else if(!r.tries&&!limits.commonAccepted)r.reason='not-tried';
    else if(stats.get(r.id)?.minStepFailed)r.reason='no-fit-found';
    else if(limits.stop==='round-limit')r.reason='round-limit';
  }
  rows.sort((a,b)=>b.area3D-a.area3D||a.id-b.id);
  const beforeArea=rows.reduce((a,r)=>a+r.areaBefore,0),afterArea=rows.reduce((a,r)=>a+r.areaAfter,0);
  return{rows,beforeArea,afterArea,addedArea:afterArea-beforeArea,enlarged:rows.filter(r=>r.areaFactor>1+1e-8).length,unchanged:rows.filter(r=>Math.abs(r.areaFactor-1)<=1e-8).length,densityLimited:rows.filter(r=>r.reason==='density-limit').length,gainLimited:rows.filter(r=>r.reason==='gain-limit').length,notTried:rows.filter(r=>r.reason==='not-tried').length,maxAreaFactor:Math.max(...rows.map(r=>r.areaFactor)),minAreaFactor:Math.min(...rows.map(r=>r.areaFactor))};
}
export function describeGrowthStop(reason:FillGrowthStop):string {
  return {'density-limit':'岛间密度差达到上限','gain-limit':'面积增益达到上限','no-fit-found':'本次搜索未找到更大位置','time-budget':'搜索时间用完','trial-budget':'试装预算用完','round-limit':'达到轮数上限','validation-rejected':'候选验证拒绝，未提交','not-tried':'尚未尝试增长','complete':'本轮增长已完成'}[reason];
}
