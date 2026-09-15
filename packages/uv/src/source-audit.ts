import type { PackedChart } from './preview.js';
import { checkUVTriangles } from './uv-quality.js';
import { uvProgress, type UVWork } from './work.js';
export interface SourceUVAudit {
  domains:{id:string;name:string;islands:number;triangles:number;overlapPairs:number;overlapCountCapped:boolean;degenerate:number;negativeTriangles:number}[];
  hasOverlaps:boolean;hasDegenerate:boolean;overlapLimit:number;
}
/** Inspect all faces TOGETHER in each real source material space, ignoring the
 * presentation offset. Capped positive-area pair counts are lower bounds.
 * A negative UV orientation may be intentional mirroring, not a geometry error. */
export function auditSourceUV(packed:readonly PackedChart[],work?:UVWork,limit=100):SourceUVAudit {
  if(!Number.isInteger(limit)||limit<1)throw new Error('Invalid overlap report limit.');
  const domains=new Map<string,PackedChart[]>();for(const chart of packed){const key=chart.uvSpace??'default',list=domains.get(key)??[];list.push(chart);domains.set(key,list);}
  const result:SourceUVAudit={domains:[],hasOverlaps:false,hasDegenerate:false,overlapLimit:limit};
  for(const [id,charts]of domains){uvProgress(work,{stage:'validate',detail:`检查原始 UV 重叠：${charts[0]?.uvSpaceName??id}`});
    const quality=checkUVTriangles(charts.flatMap(c=>[...c.faceUVs.values()]),limit,work);
    result.domains.push({id,name:charts[0]?.uvSpaceName??id,islands:charts.length,triangles:quality.triangles,overlapPairs:quality.overlaps,overlapCountCapped:quality.overlaps>=limit,degenerate:quality.degenerate,negativeTriangles:quality.flipped});
    result.hasOverlaps ||= quality.overlaps>0;result.hasDegenerate ||= quality.degenerate>0;
  }return result;
}
