import {uvShapeChange} from './shape-preservation.js';
import {tryRigidUVJoin} from './rigid-uv-join.js';
import {joinAlongBoundaryChain} from './chart-join.js';
import { buildTopology, type MeshData, type Vec2 } from '@meshtailor/mesh-core';
import { buildChartGraph, chartAffinity, type ChartLink } from './chart-adjacency.js';
import { cutLocalMesh } from './cut-topology.js';
import { openChartWithSlits } from './topology-slits.js';
import { shapeQuality } from './chart-quality.js';
import { parameterizeChart, triangleArea } from './parameterize.js';
import { checkUVTriangles } from './uv-quality.js';
import { uvProgress, rethrowUVStop, type UVWork } from './work.js';
import type { RawChart } from './atlas-pack.js';
import type { PackedChart } from './preview.js';
import type { UnwrapOptions, ChartDiagnostic } from './unwrap.js';
export interface MergeOptions {
  maxShapeChange?:number; reuseValidUV?:boolean;maxJoinAreaRatio?:number;maxAttempts:number; targetCharts:number; respectMaterials:boolean; protectedSeams:string[];
}
export const DEFAULT_MERGE:MergeOptions={maxAttempts:128,targetCharts:1,respectMaterials:false,protectedSeams:[]};
export interface MergeReport {
  before:number;after:number;attempts:number;accepted:number;removedSeams:string[];attemptBudget?:number;partialJoins?:number;rigidJoins?:number;
  reasons:Record<string,number>;budgetExhausted:boolean;
  events:{a:number;b:number;faces:number;sharedLength:number;affinity:number;accepted:boolean;reason?:string;joinMode?:'full'|'open-chain'|'uv-similarity'}[];
}
/** Snapshot UVs may overlap BETWEEN islands; packing fixes that. Internal
 * folds/overlaps cannot be repaired by packing and are rejected explicitly. */
export function rawChartsFromPreview(mesh:MeshData,packed:readonly PackedChart[],work?:UVWork):RawChart[] {
  buildChartGraph(mesh,packed.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})),undefined,work);
  return packed.map(c=>{
    const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>([...c.faceUVs].map(([fi,vs])=>[fi,vs.map(v=>[...v] as Vec2) as [Vec2,Vec2,Vec2]]));
    const q=checkUVTriangles([...faceUVs.values()],1,work);
    if(q.degenerate||q.overlaps||(q.flipped!==0&&q.flipped!==q.triangles))throw new Error(`岛 #${c.id+1} 内部存在退化、混合翻面或重叠；重排/邻岛缝合不能保证修复。请用“前处理：连通优先重分割”。原结果未修改。`);
    // A uniformly mirrored source island is valid; normalize handedness for a NEW atlas only.
    if(q.flipped===q.triangles)for(const vs of faceUVs.values())for(const v of vs)v[0]=-v[0];
    let area3D=0;for(const fi of faceUVs.keys()){const vs=mesh.faces[fi]!.vertices;area3D+=triangleArea(mesh.positions[vs[0]]!,mesh.positions[vs[1]]!,mesh.positions[vs[2]]!);}
    return {id:c.id,faceUVs,area3D};
  });
}
/** Greedy agglomeration over REAL shared edges. Every candidate is a transaction:
 * remove its shared cut, rebuild cut topology, reparameterize, validate ALL faces,
 * accept only one valid chart. Rejected trials do not mutate prior UV or seams.
 * Quality constraints are not weakened to achieve the requested chart count. */
export function mergeAdjacentCharts(mesh:MeshData,input:RawChart[],inputSeams:ReadonlySet<string>,opts:UnwrapOptions,diagnostics:ChartDiagnostic[]=[],work?:UVWork){
  const settings={...DEFAULT_MERGE,...opts.mergeOptions,maxAttempts:opts.mergeOptions?.maxAttempts??Math.min(512,Math.max(128,input.length*3))};
  if(settings.reuseValidUV!==undefined&&typeof settings.reuseValidUV!=='boolean'||!Number.isFinite(settings.maxJoinAreaRatio??1.25)||(settings.maxJoinAreaRatio??1.25)<1||(settings.maxJoinAreaRatio??1.25)>2)throw new Error('Invalid rigid UV join settings.');
  if(!Number.isInteger(settings.maxAttempts)||settings.maxAttempts<0||settings.maxAttempts>2000||!Number.isInteger(settings.targetCharts)||settings.targetCharts<1||typeof settings.respectMaterials!=='boolean'||!Array.isArray(settings.protectedSeams))throw new Error('Invalid chart merge options.');
  const paint=opts.uvObjective==='paint',shapeLimit=settings.maxShapeChange??1.5;
  if(!Number.isFinite(shapeLimit)||shapeLimit<1||shapeLimit>4)throw Error('Invalid UV shape change limit.');
  const topology=buildTopology(mesh),graph=buildChartGraph(mesh,input.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})),topology,work);
  const locked=new Set(settings.protectedSeams);for(const key of locked){const e=topology.edges.get(key);if(!e)throw new Error('Protected seam is not a mesh edge: '+key);if(e.faces.length===2&&graph.faceChart[e.faces[0]!]===graph.faceChart[e.faces[1]!]&&!inputSeams.has(key))throw new Error('Protected seam must already be a UV cut: '+key);}
  let effective=new Set(inputSeams);for(const key of locked)effective.add(key);
  // Original inter-chart cuts are explicit, including when caller supplied none.
  for(const link of graph.links)for(const key of link.edges)effective.add(key);
  const beforeSeams=new Set(effective),parent=new Map(input.map(c=>[c.id,c.id])),raw=new Map(input.map(c=>[c.id,c]));
  const versions=new Map(input.map(c=>[c.id,0])),diag=new Map(diagnostics.map(d=>[d.id,d]));
  // Fixed references prevent acceptable per-merge changes from accumulating
  // into an unrecognizable outline across a long greedy merge sequence.
  const referenceParts=new Map(input.map(c=>[c.id,[c]]));
  const root=(id:number):number=>{let r=id;while(parent.get(r)!==r)r=parent.get(r)!;while(parent.get(id)!==id){const next=parent.get(id)!;parent.set(id,r);id=next;}return r;};
  const failed=new Set<string>(),report:MergeReport={before:input.length,after:input.length,attempts:0,accepted:0,attemptBudget:settings.maxAttempts,partialJoins:0,rigidJoins:0,removedSeams:[],reasons:{},budgetExhausted:false,events:[]};
  while(raw.size>settings.targetCharts){work?.check();
    // Aggregate the original sparse interface graph, not all mesh triangles.
    const links=new Map<string,ChartLink>(),boundary=new Map(graph.boundaries);
    for(const id of boundary.keys())if(root(id)!==id){const r=root(id);boundary.set(r,(boundary.get(r)??0)+boundary.get(id)!);boundary.delete(id);}
    for(const original of graph.links){const a=root(original.a),b=root(original.b);
      if(a===b){boundary.set(a,Math.max(0,(boundary.get(a)??0)-2*original.length));continue;}
      const low=Math.min(a,b),high=Math.max(a,b),key=`${low}:${high}`,l=links.get(key)??{a:low,b:high,edges:[],length:0,normalAgreement:0};
      l.edges.push(...original.edges);l.length+=original.length;l.normalAgreement+=original.normalAgreement*original.length;links.set(key,l);
    }
    for(const l of links.values())l.normalAgreement/=l.length;
    const candidates=[...links.values()].sort((a,b)=>chartAffinity(b,boundary)-chartAffinity(a,boundary)||a.a-b.a||a.b-b.b);
    let changed=false,limited=false;
    for(const link of candidates){
      const {a,b}=link,key=`${a}:${versions.get(a)}:${b}:${versions.get(b)}`;if(failed.has(key))continue;
      const A=raw.get(a)!,B=raw.get(b)!,faces=[...A.faceUVs.keys(),...B.faceUVs.keys()].sort((x,y)=>x-y);
      const event={a,b,faces:faces.length,sharedLength:link.length,affinity:chartAffinity(link,boundary),accepted:false};
      const reject=(reason:string)=>{failed.add(key);report.reasons[reason]=(report.reasons[reason]??0)+1;if(report.events.length<1000)report.events.push({...event,reason});};
      if(link.edges.some(e=>locked.has(e))){reject('protected-seam');continue;}
      if(faces.length>opts.maxChartFaces){reject('face-budget');continue;}
      if(settings.respectMaterials&&new Set(faces.map(fi=>mesh.faces[fi]!.uvSpace??'default')).size>1){reject('material-boundary');continue;}
      if(report.attempts>=settings.maxAttempts){limited=true;break;}
      report.attempts++;uvProgress(work,{stage:'charts',detail:`邻岛缝合 ${report.attempts}/${settings.maxAttempts}：${A.faceUVs.size}+${B.faceUVs.size} 面`,current:report.attempts,total:settings.maxAttempts,unit:'尝试预算'});
      let trial=new Set(effective);for(const e of link.edges)trial.delete(e);
      try{
        let local=cutLocalMesh(mesh,faces,trial),joinMode:'full'|'open-chain'|'uv-similarity'='full';
        if(!local.disk&&opts.autoCut){const opened=openChartWithSlits(mesh,faces,trial,local,work);if(opened){local=opened.local;for(const e of opened.added)trial.add(e);}}
        if(!local.disk){const partial=joinAlongBoundaryChain(mesh,faces,effective,link.edges,work);if(partial){local=partial.local;trial=partial.seams;joinMode='open-chain';}}
        let p:{uv:Vec2[];method:string;iterations:number;residual:number;fallbackReason?:string}|undefined,shape:ReturnType<typeof shapeQuality>|undefined,reason='topology';
        // Hand-paint goal first tries to keep both existing silhouettes exactly.
        if(paint&&settings.reuseValidUV!==false){const fit=tryRigidUVJoin(mesh,A,B,effective,link.edges,opts,work,topology);if(fit){local=fit.local;trial=fit.seams;p=fit;shape=fit.shape;joinMode='uv-similarity';}}
        if(!p&&local.disk)try{const solved=parameterizeChart(local,opts,work),q=shapeQuality(local,solved.uv,opts.stretchAreaPercentile??1,opts.maxStretch);if(solved.quality.valid&&q.areaStretch<=opts.maxStretch&&q.aspect<=opts.maxAspect&&q.fill>=opts.minFill){p=solved;shape=q;}else reason='distortion';}catch(error){rethrowUVStop(error);reason='solver-invalid';}
        if(!p&&settings.reuseValidUV!==false){const fit=tryRigidUVJoin(mesh,A,B,effective,link.edges,opts,work,topology);if(fit){local=fit.local;trial=fit.seams;p=fit;shape=fit.shape;joinMode='uv-similarity';}}
        if(!p||!shape){reject(reason);continue;}
        const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...p.uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
        if(paint&&[...referenceParts.get(a)!,...referenceParts.get(b)!].some(reference=>uvShapeChange(mesh,reference,faceUVs)>shapeLimit)){reject('paint-shape-change');continue;}
        // No mutation until the complete trial has passed all numerical/UV checks.
        work?.check();referenceParts.set(a,[...referenceParts.get(a)!,...referenceParts.get(b)!]);referenceParts.delete(b);parent.set(b,a);versions.set(a,versions.get(a)!+1);raw.delete(b);raw.set(a,{id:a,faceUVs,area3D:A.area3D+B.area3D});
        diag.delete(b);diag.set(a,{id:a,sourceChart:diag.get(a)?.sourceChart??a,faces:faces.length,method:p.method,iterations:p.iterations,residual:p.residual,...shape,...(p.fallbackReason?{fallbackReason:p.fallbackReason}:{})});effective=trial;
        report.accepted++;if(joinMode==='uv-similarity')report.rigidJoins=(report.rigidJoins??0)+1;if(joinMode==='open-chain')report.partialJoins=(report.partialJoins??0)+1;report.events.push({...event,accepted:true,joinMode});changed=true;break;
      }catch(error){rethrowUVStop(error);reject('solver-invalid');}
    }
    if(limited){report.budgetExhausted=true;break;}if(!changed)break;
  }
  report.after=raw.size;report.removedSeams=[...beforeSeams].filter(e=>!effective.has(e));
  const result=[...raw.values()].sort((a,b)=>a.id-b.id),newDiagnostics:ChartDiagnostic[]=[];
  result.forEach((c,i)=>{const d=diag.get(c.id);if(d)newDiagnostics.push({...d,id:i});result[i]={...c,id:i};});
  return {raw:result,seams:effective,diagnostics:newDiagnostics,report};
}
