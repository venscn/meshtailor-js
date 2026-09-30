/** A valid source UV can still erase recognizable surface features. This gate
 * compares substantial planar geometry with its corresponding source UV, not
 * with a model name, an island number, or the shape of the atlas bounding box.
 * Only conflicted source charts are regrouped; all others keep their UVs. */
import {buildTopology, type MeshData, type Vec2} from '@meshtailor/mesh-core';
import {planSurfaceGroups} from './peel-plan.js';
import {cutLocalMesh} from './cut-topology.js';
import {planarShapeCandidate} from './free-boundary.js';
import {uvShapeChange} from './shape-preservation.js';
import {checkUVTriangles} from './uv-quality.js';
import {unwrapMesh, type UnwrapOptions, type ChartDiagnostic} from './unwrap.js';
import {triangleArea} from './parameterize.js';
import type {RawChart} from './atlas-pack.js';
import type {UVWork} from './work.js';

export interface SourceFeatureRegion {
  sourceChart:number; faces:number[]; charts:number[];
  kind:'planar-feature'|'surface'|'oriented-panel'|'crease-region'|'feature-sheet'|'bilateral-connector'|'closed-shell'|'symmetric-sheet'|'longitudinal-panels';
}
export interface SourceFeatureReport {
  version:1; inspected:number; detectedPanels:number; changedCharts:number;
  before:number; after:number; protectedSeams:string[];
  conflicts:{sourceChart:number; faces:number; shapeChange:number; reason:string}[];
  regions:SourceFeatureRegion[];
  note:string;
}

/** Resolve chart IDs after stitching or repacking through immutable source faces.
 * Protected groups cannot be silently swallowed by later merge operations. */
export function carrySourceFeatures(report:SourceFeatureReport, charts:readonly {id:number;faceUVs:Map<number,unknown>}[]):SourceFeatureReport {
  const next=structuredClone(report),owners=new Map<number,number>();
  for(const c of charts)for(const f of c.faceUVs.keys())owners.set(f,c.id);
  const regionOwner=new Map<number,number>();
  next.regions.forEach((r,i)=>{for(const f of r.faces)regionOwner.set(f,i);});
  for(const c of charts){
    const regions=new Set([...c.faceUVs.keys()].map(f=>regionOwner.get(f)));
    if(regions.size>1 && [...regions].some(r=>r!==undefined))throw Error('UV edit crossed a protected recognizable-feature boundary.');
  }
  for(const r of next.regions){
    if(r.faces.some(f=>!owners.has(f)))throw Error('UV edit lost a source face of a recognizable feature.');
    r.charts=[...new Set(r.faces.map(f=>owners.get(f)!))];
  }
  next.after=charts.length;return next;
}

export function repairSourceFeatures(mesh:MeshData,input:readonly RawChart[],inputSeams:ReadonlySet<string>,opts:UnwrapOptions,work?:UVWork){
  const threshold=opts.sourceFeatureTolerance??1.15;
  if(!Number.isFinite(threshold)||threshold<1.01||threshold>4)throw Error('Source feature distortion limit must be 1.01..4.');
  const fraction=opts.peelFeatureArea??.015;
  const report:SourceFeatureReport={version:1,inspected:input.length,detectedPanels:0,changedCharts:0,before:input.length,after:input.length,protectedSeams:[],conflicts:[],regions:[],note:'几何有效不等于可辨识。只重展与主要平面特征冲突的原岛；一般曲面仍使用组内开缝与自由边界求解，不按模型名称或矩形/圆形外观分类。'};
  // Ignore orientation bisection during detection. This finds actual contiguous
  // planes, including holes, rather than treating all opposing normals as panels.
  const plan=planSurfaceGroups(mesh,inputSeams,{...opts,peelOrientationPanels:false},work);
  const owner=new Map<number,RawChart>();for(const c of input)for(const f of c.faceUVs.keys())owner.set(f,c);
  const total=input.reduce((s,c)=>s+c.area3D,0),affected=new Set<number>();
  const locks=new Set(opts.mergeOptions?.protectedSeams??[]);
  for(const g of plan.report.groups){
    work?.check();const c=owner.get(g.faces[0]!);if(!c||g.faces.some(f=>owner.get(f)!==c))continue;
    if(g.area3D<Math.max(total*fraction,c.area3D*.06))continue;
    // Source UV seams are not geometric holes. Do not preserve an artificial
    // radial slit that unrolled a real planar annulus into a rectangle.
    const local=cutLocalMesh(mesh,g.faces,locks),uv=planarShapeCandidate(local);
    if(!uv)continue;
    const reference=new Map<number,[Vec2,Vec2,Vec2]>();
    local.sourceFaces.forEach((fi,i)=>reference.set(fi,local.triangles[i]!.map(v=>uv[v]!) as [Vec2,Vec2,Vec2]));
    if(!checkUVTriangles([...reference.values()],1,work).valid)continue;
    report.detectedPanels++;
    const current:RawChart={id:c.id,area3D:g.area3D,faceUVs:new Map(g.faces.map(f=>[f,c.faceUVs.get(f)!]))};
    const shapeChange=uvShapeChange(mesh,current,reference);
    if(shapeChange>threshold){
      affected.add(c.id);report.conflicts.push({sourceChart:c.id,faces:g.faces.length,shapeChange,reason:'源 UV 扭曲了可验证的平面轮廓 / 孔洞对应，不能仅因无重叠而原样保留。'});
    }
  }
  if(!affected.size)return{raw:[...input],seams:new Set(inputSeams),diagnostics:[] as ChartDiagnostic[],report};

  const topology=buildTopology(mesh),seams=new Set(inputSeams),raw:RawChart[]=[],diagnostics:ChartDiagnostic[]=[];
  let nextId=input.reduce((s,c)=>Math.max(s,c.id+1),0);
  for(const c of input){
    if(!affected.has(c.id)){raw.push(c);continue;}
    work?.check();work?.report({stage:'parameterize',detail:`原岛 #${c.id+1}：先按真实空间特征分组，再组内开缝剥展（有效矩形 UV 不再免检）`});
    const faces=[...c.faceUVs.keys()],faceSet=new Set(faces),subset:MeshData={...mesh,faces:faces.map(f=>mesh.faces[f]!)};
    const localLocks=new Set<string>();
    for(const [key,e]of topology.edges)if(e.faces.length===2&&e.faces.every(f=>faceSet.has(f))){
      if(locks.has(key))localLocks.add(key);else seams.delete(key);
    }
    // All positions are retained, so normalization is the same global similarity.
    // Disable source hints: the very source chart being rejected must not be
    // accepted again as a fallback. No nested packing refinement or post-merge.
    const nestedWork=work?{check:()=>work.check(),report:(p:Parameters<UVWork['report']>[0])=>work.report({...p,facesTotal:mesh.faces.length,facesDone:undefined})}:undefined;
    const r=unwrapMesh(subset,localLocks,{...opts,initialSegmentation:'hierarchical',peelSourceHints:false,postMerge:false,sourceFeaturePolicy:'preserve',humanTemplates:{...opts.humanTemplates,selectedCharts:undefined},fillMode:'off',fillRecutLarge:false,atlasPageMode:'single',mergeOptions:{...opts.mergeOptions,protectedSeams:[...localLocks]}},nestedWork);
    const idMap=new Map<number,number>();
    for(const p of r.packed){
      const id=idMap.size===0?c.id:nextId++;idMap.set(p.id,id);
      const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();let area3D=0;
      for(const [localFace,values]of p.faceUVs){const f=faces[localFace]!;faceUVs.set(f,values.map(v=>[...v] as Vec2) as [Vec2,Vec2,Vec2]);const t=mesh.faces[f]!.vertices;area3D+=triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!);}
      raw.push({id,faceUVs,area3D});
      const d=r.diagnostics.find(d=>d.id===p.id)!;diagnostics.push({...d,id,sourceChart:c.id});
    }
    for(const key of r.seams)seams.add(key);
    for(const key of [...(r.peel?.groupSeams??[]),...(r.human?.protectedSeams??[])])locks.add(key);
    for(const g of r.peel?.groups??[]){report.regions.push({sourceChart:c.id,faces:g.faces.map(f=>faces[f]!),charts:g.charts.map(id=>idMap.get(id)!),kind:g.kind});}
    report.changedCharts++;
  }
  report.after=raw.length;report.protectedSeams=[...locks];
  return{raw,seams,diagnostics,report};
}
