import {buildTopology,edgeKey,type MeshData,type Vec2} from '@meshtailor/mesh-core';
import {extractSeamEdgesFromUV} from '@meshtailor/chaining-seams';
import {triangleArea} from './parameterize.js';
import {rawChartsFromPreview} from './chart-merge.js';
import {refineAtlas,type FillOptions} from './fill-refinement.js';
import type {AtlasPacking} from './atlas-pack.js';
import type {PackedChart} from './preview.js';
import {uvProgress,type UVWork} from './work.js';
export interface LargeRecutOptions {
  /** Explicit opt-in. Only restore boundaries present in SOURCE UV. */
  fillRecutLarge?:boolean;fillRecutMinParentArea?:number;fillRecutMinChildRatio?:number;fillRecutMinGain?:number;
}
export interface LargeRecutReport {
  enabled:boolean;before:number;after:number;accepted:boolean;trials:number;
  parent?:number;children?:number[];addedSeams:string[];
  candidates:{parent:number;areaFraction:number;children:number[];reason:string;occupancy?:number}[];
  note:string;
}
export function largeRecutCandidates(mesh:MeshData,packed:readonly PackedChart[],options:LargeRecutOptions={},work?:UVWork){
 const parentMin=options.fillRecutMinParentArea??.12,childMin=options.fillRecutMinChildRatio??.25;
 if(!Number.isFinite(parentMin)||parentMin<.08||parentMin>.5||!Number.isFinite(childMin)||childMin<.15||childMin>.45)throw Error('Invalid guarded large-island split limits.');
 const topology=buildTopology(mesh),original=extractSeamEdgesFromUV(mesh),areas=mesh.faces.map(f=>triangleArea(...f.vertices.map(i=>mesh.positions[i]!) as [typeof mesh.positions[number],typeof mesh.positions[number],typeof mesh.positions[number]]));
 const total=areas.reduce((a,b)=>a+b,0),sum=(faces:readonly number[])=>faces.reduce((s,f)=>s+areas[f]!,0);
 const ordered=packed.map(c=>({chart:c,area:sum([...c.faceUVs.keys()])})).sort((a,b)=>b.area-a.area||a.chart.id-b.chart.id);
 const candidates:{parent:number;areaFraction:number;parts:number[][];edges:string[]}[]=[];
 for(const {chart,area} of ordered.slice(0,3)){
  work?.check();if(area<total*parentMin||chart.faceUVs.size<64)continue;
  const faces=[...chart.faceUVs.keys()],allowed=new Set(faces);
  const components=(members:Set<number>,cuts:ReadonlySet<string>)=>{
   const pending=new Set(members),groups:number[][]=[];
   while(pending.size){const root=pending.values().next().value!,group=[root];pending.delete(root);
    for(let i=0;i<group.length;i++){const f=mesh.faces[group[i]!]!;for(let k=0;k<3;k++){const key=edgeKey(f.vertices[k]!,f.vertices[(k+1)%3]!);if(cuts.has(key))continue;for(const other of topology.edges.get(key)?.faces??[])if(pending.delete(other))group.push(other);}}groups.push(group);
   }return groups;
  };
  const groups=components(allowed,original).sort((a,b)=>sum(b)-sum(a));
  for(const a of groups.slice(0,3)){
   if(a.length===faces.length)continue;const aset=new Set(a),b=faces.filter(f=>!aset.has(f));
   if(a.length<32||b.length<32||Math.min(sum(a),sum(b))<area*childMin||components(new Set(b),new Set()).length!==1)continue;
   const edges:string[]=[];for(const fi of a){const face=mesh.faces[fi]!;for(let k=0;k<3;k++){const key=edgeKey(face.vertices[k]!,face.vertices[(k+1)%3]!);if(topology.edges.get(key)?.faces.some(f=>allowed.has(f)&&!aset.has(f)))edges.push(key);}}
   if(!edges.length||edges.some(e=>!original.has(e)))continue;
   candidates.push({parent:chart.id,areaFraction:area/total,parts:[a,b],edges:[...new Set(edges)]});break;
  }
 }
 return candidates.slice(0,2);
}
/** Transactional, opt-in experiment. Never invents a fresh arbitrary seam, never
 * splits small islands, never recursively shreds children, never silently rejoins.
 * A candidate must gain >=1 percentage point without shrinking ANY source face. */
export function tryLargeRecut(mesh:MeshData,base:AtlasPacking,seams:ReadonlySet<string>,options:FillOptions&LargeRecutOptions&{rotate?:boolean}={},work?:UVWork,initialSeed:readonly PackedChart[]=base.packed){
 const report:LargeRecutReport={enabled:true,before:base.occupancy,after:base.occupancy,accepted:false,trials:0,addedSeams:[],candidates:[],note:'仅尝试恢复原模型中已有的大块接缝；一次最多接受一处分为两块，子块至少占父块25%（可配置）。不是语义识别，不自动重新缝合。'};
 const gain=options.fillRecutMinGain??.01;if(!Number.isFinite(gain)||gain<.005||gain>.1)throw Error('Large recut minimum gain must be .005.. .1.');
 const candidates=largeRecutCandidates(mesh,base.packed,options,work);
 for(const candidate of candidates){
  work?.check();const id=Math.max(...base.packed.map(c=>c.id))+1,source=base.packed.find(c=>c.id===candidate.parent)!;
  const split=candidate.parts.map((faces,index)=>{const faceUVs=new Map(faces.map(f=>[f,source.faceUVs.get(f)!])),bounds:[number,number,number,number]=[Infinity,Infinity,-Infinity,-Infinity];for(const t of faceUVs.values())for(const [x,y]of t){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}return {...source,id:index?id:source.id,faceUVs,bounds,polygon:[[bounds[0],bounds[1]],[bounds[2],bounds[1]],[bounds[2],bounds[3]],[bounds[0],bounds[3]]] as Vec2[]};});
  const packed=base.packed.flatMap(c=>c.id===source.id?split:[c]);
  const raw=rawChartsFromPreview(mesh,packed,work);report.trials++;
  uvProgress(work,{stage:'pack',detail:`可选大岛切缝试验 #${source.id+1}：仅恢复原接缝，完整试装失败即回退`});
  const trial=refineAtlas({...base,packed},raw,{...options,fillWarmupPasses:0,fillRounds:Math.min(4,options.fillRounds??4),fillTimeBudgetMs:Math.min(15000,options.fillTimeBudgetMs??15000)},work);
  const event={parent:source.id,areaFraction:candidate.areaFraction,children:split.map(c=>c.id),reason:'insufficient-gain',occupancy:trial.occupancy};report.candidates.push(event);
  if(trial.occupancy<base.occupancy+gain)continue;
  const uvArea=(t:readonly Vec2[])=>Math.abs((t[1]![0]-t[0]![0])*(t[2]![1]-t[0]![1])-(t[1]![1]-t[0]![1])*(t[2]![0]-t[0]![0]))*.5;
  const originalAreas=new Map(initialSeed.flatMap(c=>[...c.faceUVs].map(([fi,t])=>[fi,uvArea(t)] as const)));
  // Two search stages must not compound a per-operation size cap.
  if(trial.packed.some(c=>[...c.faceUVs].some(([fi,t])=>{const old=originalAreas.get(fi)!;return uvArea(t)<old*(1-1e-8)||uvArea(t)>old*(options.fillMaxAreaGain??1.6)*(1+1e-8);}))) {event.reason='total-area-cap';continue;}

  // refineAtlas already tests all triangles and only accepts no-shrink rigid chart transforms.
  report.accepted=true;report.parent=source.id;report.children=split.map(c=>c.id);report.after=trial.occupancy;report.addedSeams=candidate.edges.filter(e=>!seams.has(e));event.reason='accepted';
  return {result:trial,seams:new Set([...seams,...candidate.edges]),report};
 }
 if(!candidates.length)report.note+=' 未找到符合大块、原边界与子块面积保护的候选。';
 return {result:base,seams:new Set(seams),report};
}
