import type { MeshData } from '@meshtailor/mesh-core';
import { triangleArea } from './parameterize.js';
import type { PackedChart } from './preview.js';
import type { UVWork } from './work.js';

export interface IslandAreaRecord {
  id:number; faces:number; domain:string; area3D:number; areaUV:number;
  /** Ratios are relative to a common domain, not to unlike world/UV units. */
  share3D:number; shareUV:number; densityRatio:number|null; linearDensityRatio:number|null;
}
export interface AreaAudit {
  islands:IslandAreaRecord[]; totalArea3D:number; totalAreaUV:number;
  oversized:number[]; undersized:number[]; invalid:number[];
}
/** Sum triangle surface areas, NOT UV bounding boxes or pixel silhouettes.
 * Original overlapping UVs are counted with multiplicity deliberately: this
 * audits allocation, not atlas occupancy. No coordinates are changed. */
export function auditIslandAreas(mesh:MeshData,packed:readonly PackedChart[],work?:UVWork):AreaAudit {
  const domains=new Map<string,{a:number;u:number}>(), seen=new Set<number>();
  const records=packed.map(c=>{
    work?.check();let area3D=0,areaUV=0;
    for(const [fi,[a,b,d]] of c.faceUVs){
      if(seen.has(fi)||!mesh.faces[fi])throw new Error('Area audit: duplicate or missing source face.');seen.add(fi);
      const f=mesh.faces[fi]!,p=f.vertices.map(i=>mesh.positions[i]!);
      area3D+=triangleArea(p[0]!,p[1]!,p[2]!);
      areaUV+=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]))*.5;
    }
    const domain=c.uvSpace??'default',sum=domains.get(domain)??{a:0,u:0};sum.a+=area3D;sum.u+=areaUV;domains.set(domain,sum);
    return {id:c.id,faces:c.faceUVs.size,domain,area3D,areaUV};
  });
  if(seen.size!==mesh.faces.length)throw new Error('Area audit: charts must cover all source faces.');
  const islands=records.map(r=>{
    const sum=domains.get(r.domain)!,share3D=r.area3D/sum.a,shareUV=r.areaUV/sum.u;
    const ratio=share3D>0&&Number.isFinite(shareUV)?shareUV/share3D:null;
    const densityRatio=ratio!==null&&Number.isFinite(ratio)?ratio:null;
    return {...r,share3D,shareUV,densityRatio,linearDensityRatio:densityRatio!==null?Math.sqrt(densityRatio):null};
  });
  return {islands,totalArea3D:records.reduce((s,r)=>s+r.area3D,0),totalAreaUV:records.reduce((s,r)=>s+r.areaUV,0),
    oversized:islands.filter(r=>(r.densityRatio??0)>2).map(r=>r.id),undersized:islands.filter(r=>r.densityRatio!==null&&r.densityRatio<.5).map(r=>r.id),
    invalid:islands.filter(r=>r.densityRatio===null||!(r.area3D>0&&r.areaUV>0)).map(r=>r.id)};
}
