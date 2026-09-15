import type {MeshData,Vec2} from '@meshtailor/mesh-core';
import type {PackedChart} from './preview.js';
import type {RawChart} from './atlas-pack.js';
import type {UnwrapOptions} from './unwrap.js';
import {buildChartGraph} from './chart-adjacency.js';
import {cutLocalMesh} from './cut-topology.js';
import {openChartWithSlits} from './topology-slits.js';
import {parameterizeChart,triangleArea} from './parameterize.js';
import {checkUVTriangles,type UVQuality} from './uv-quality.js';
import {shapeQuality} from './chart-quality.js';
import {uvProgress,type UVWork} from './work.js';
export interface SourceRepairReport {
  inspected:number; repaired:number; preserved:number; addedSeams:string[];
  islands:{id:number;faces:number;before:UVQuality;method:string;iterations:number;maxStretch:number}[];
}
/** Repair ONLY invalid source islands, using their original 3D face sets. This
 * is an explicit new-atlas operation, never an edit to source coordinates.
 * It does not split/delete faces or substitute a fresh global segmentation.
 * Any failed repair aborts the transaction; no partial atlas is returned.
 */
export function repairSourceCharts(mesh:MeshData,seed:readonly PackedChart[],inputSeams:ReadonlySet<string>,opts:UnwrapOptions,work?:UVWork){
  buildChartGraph(mesh,seed.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})),undefined,work);
  const seams=new Set(inputSeams),raw:RawChart[]=[],report:SourceRepairReport={inspected:seed.length,repaired:0,preserved:0,addedSeams:[],islands:[]};
  for(const c of seed){
    work?.check();let faceUVs=new Map<number,[Vec2,Vec2,Vec2]>([...c.faceUVs].map(([fi,vs])=>[fi,vs.map(p=>[...p] as Vec2) as [Vec2,Vec2,Vec2]]));
    const before=checkUVTriangles([...faceUVs.values()],100,work),invalid=before.degenerate>0||before.overlaps>0||before.flipped!==0&&before.flipped!==before.triangles;
    if(invalid){
      uvProgress(work,{stage:'charts',detail:`局部修复原 UV 岛 #${c.id+1}（${faceUVs.size} 面），其他岛保留`});
      if(faceUVs.size>opts.maxChartFaces)throw new Error(`原 UV 岛 #${c.id+1} 修复超过单岛面数预算；提高预算或显式运行前处理。未返回部分结果。`);
      const faces=[...faceUVs.keys()];let local=cutLocalMesh(mesh,faces,seams);
      if(!local.disk&&opts.autoCut){const opened=openChartWithSlits(mesh,faces,seams,local,work);if(opened){local=opened.local;for(const e of opened.added)seams.add(e);}}
      if(!local.disk)throw new Error(`原 UV 岛 #${c.id+1} 无法在保留该岛的情况下开缝成盘；请显式运行前处理。`);
      const result=parameterizeChart(local,opts,work),shape=shapeQuality(local,result.uv,opts.stretchAreaPercentile??1,opts.maxStretch);
      if(!result.quality.valid||shape.areaStretch>opts.maxStretch||shape.aspect>opts.maxAspect||shape.fill<opts.minFill)throw new Error(`原 UV 岛 #${c.id+1} 局部修复未通过 UV/形变检查；请运行前处理。没有放宽检查或删除面。`);
      faceUVs=new Map();local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...result.uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
      report.repaired++;report.islands.push({id:c.id,faces:faces.length,before,method:result.method,iterations:result.iterations,maxStretch:shape.maxStretch});
    }else{
      report.preserved++;
      // A uniform mirror is not invalid. Normalize orientation only for new atlas.
      if(before.flipped===before.triangles)for(const vs of faceUVs.values())for(const v of vs)v[0]=-v[0];
    }
    let area3D=0;for(const fi of faceUVs.keys()){const t=mesh.faces[fi]!.vertices;area3D+=triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!);}
    raw.push({id:c.id,faceUVs,area3D});
  }
  report.addedSeams=[...seams].filter(e=>!inputSeams.has(e));
  return {raw,seams,report};
}
