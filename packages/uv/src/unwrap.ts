import {unfoldClosedTube,validateTubeOptions,validateTubeOutput,type TubeOptions,type TubeStripContract,type TubeStripReport} from './tube-strips.js';
import {validateSurfaceSymmetryOutput,type SurfaceUVContract} from './surface-symmetry-output.js';
import {simpleUVBoundary} from './boundary-guard.js';
import {freeBoundaryARAP} from './free-boundary.js';
import {validateStructureOutput} from './structure-output.js';
import {planSurfaceGroups,bisectSurface,type PeelOptions,type PeelReport} from './peel-plan.js';
import {geometryOnlyMesh} from '@meshtailor/mesh-core';
import {checkUVTriangles,signedArea2} from './uv-quality.js';
import {unfoldBand,inspectBand,humanOptions,remapHumanReport,type HumanTemplateReport} from './human-templates.js';
import {planarShapeCandidate} from './free-boundary.js';
import { packConnectedAtlas, type PageOptions, type PageReport } from './atlas-pages.js';
import { mergeAdjacentCharts, type MergeOptions, type MergeReport } from './chart-merge.js';
import { normalizedMesh, shapeQuality } from './chart-quality.js';
import { uvProgress, rethrowUVStop, type UVWork } from './work.js';
import { paintPanelSeams,buildTopology, edgeKey, recommendRegions, segmentMeshRegions, type ChartGoal, type MeshAnalysis, type RegionOptions, type MeshData, type Vec3, type Vec2 } from '@meshtailor/mesh-core';
import { buildCharts } from './charts.js';
import { openChartWithSlits } from './topology-slits.js';
import { cutLocalMesh, type CutMesh } from './cut-topology.js';
import { parameterizeChart, triangleArea, type SolverOptions, type Parameterization } from './parameterize.js';
import { packAtlas, type AtlasPacking, type PackOptions, type RawChart } from './atlas-pack.js';
export interface UnwrapOptions extends SolverOptions,PackOptions,PageOptions,PeelOptions,TubeOptions { structuralRelaxIterations?:number; sourceFeaturePolicy?:'repair'|'preserve'; sourceFeatureTolerance?:number; structureTemplates?:boolean; humanTemplates?:Partial<import('./human-templates.js').HumanTemplateOptions>; sourceRepairPolicy?:'repair'|'reject'; sourceAtlasMerge?:boolean; initialSegmentation?:'regions'|'connected'|'hierarchical'; postMerge?:boolean; mergeOptions?:Partial<MergeOptions>; sourceUVLayout?:'materials'|'overlay'; stretchAreaPercentile?:number; chartPolicy?:ChartGoal|'legacy'; regionOptions?:Partial<RegionOptions>; autoCut:boolean; maxChartFaces:number; maxAspect:number; minFill:number; maxStretch:number; timeBudgetMs?:number }
export interface ChartDiagnostic {tube?:TubeStripReport;symmetry?:import('./symmetry-parameterization.js').UVSymmetryReport;structuralRelaxation?:{initialEnergy:number;finalEnergy:number;acceptedIterations:number};feature?:import('./feature-contract.js').FeatureContractReport;areaStretch?:number;excessAreaRatio?:number;id:number; sourceChart:number; faces:number; method:string; iterations:number; residual:number; fallbackReason?:string; aspect:number; fill:number; maxStretch:number}
export interface FragmentationReport {
  inputComponents:number;componentFaces:number[];initialCharts:number;outputCharts:number;tinyCharts:number;
  reasons:Record<string,number>;events:{reason:string;faces:number;sourceChart:number;depth:number;detail?:string}[];omittedEvents:number;
}
export interface UnwrapResult extends AtlasPacking { peel?:PeelReport; human?:HumanTemplateReport; spatialReport?:import('./spatial-neighbors.js').SpatialReport; pageReport?:PageReport; merge?:MergeReport; fragmentation:FragmentationReport; seams:string[]; addedSeams:string[]; diagnostics:ChartDiagnostic[]; warnings:string[] }
export const LEGACY_UNWRAP:UnwrapOptions={chartPolicy:'legacy',uvObjective:'compact',method:'auto',iterations:2000,tolerance:1e-9,padding:.003,rotate:true,rotationSteps:12,autoCut:true,maxChartFaces:2048,maxAspect:6,minFill:.4,maxStretch:12};
export const DEFAULT_UNWRAP:UnwrapOptions={surfaceSymmetry:true,symmetryTolerance:.018,symmetryStrength:30,symmetryIterations:40,...LEGACY_UNWRAP,initialSegmentation:'hierarchical',peelSourceHints:false,postMerge:false,structureTemplates:true,uvObjective:'paint',chartPolicy:'large',stretchAreaPercentile:.99,maxChartFaces:8192,maxAspect:24,minFill:0,maxStretch:30};
export function recommendUnwrap(mesh:MeshData,goal:ChartGoal='large'):{options:UnwrapOptions;analysis:MeshAnalysis;regions:RegionOptions;reasons:string[]}{
  const r=recommendRegions(mesh,goal),large=goal==='large';
  return{options:{...DEFAULT_UNWRAP,chartPolicy:goal,stretchAreaPercentile:large?.99:1,regionOptions:{...r.options},maxChartFaces:r.options.maxChartFaces,maxAspect:large?24:10,minFill:0,maxStretch:large?30:16},analysis:r.analysis,regions:r.options,reasons:[
    '以连通区域和表面积合并小块，不把每条局部折角都当作接缝。',
    '单岛面数按输入规模设置，属于计算预算，不是期望岛大小。',
    large?'大块模式按 99% 源表面积控制形变；仍记录最坏三角面，最多 1% 微小细节可超软阈值。翻面/交叠检查不放宽。':'均衡模式按最坏三角面的形变控制补切。',
    `输入有 ${r.analysis.components} 个面连通分量；不会跨独立部件焊接。`,
  ]};
}
/** Connected, disk-preserving region growth. Existing seam edges are never crossed.
 * For non-disks this intentionally adds visible cuts rather than silently projecting
 * a closed surface, annulus, pinched or inconsistently oriented mesh. */
function splitDisks(local:CutMesh,maxFaces:number,limitNormals:boolean,work?:UVWork):number[][]{
  const n=local.triangles.length,incident=new Map<string,number[]>(),adj:number[][]=Array.from({length:n},()=>[]);
  local.triangles.forEach((t,i)=>{for(let k=0;k<3;k++){const key=edgeKey(t[k]!,t[(k+1)%3]!),list=incident.get(key)??[];list.push(i);incident.set(key,list);}});
  for(const fs of incident.values())if(fs.length===2){adj[fs[0]!]!.push(fs[1]!);adj[fs[1]!]!.push(fs[0]!);}
  const normals=local.triangles.map(t=>{const [a,b,c]=t.map(v=>local.positions[v]!) as [Vec3,Vec3,Vec3],u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],l=Math.hypot(...n);return n.map(x=>x/Math.max(l,1e-30));});
  const unseen=new Set(local.triangles.keys()),result:number[][]=[];
  while(unseen.size){const root=unseen.values().next().value!,chosen:number[]=[],vertices=new Set<number>(),boundary=new Map<string,[number,number]>(),queue=[root];
    // A rejected face can become admissible after a neighboring attachment; retry
    // when reached through another newly accepted neighbor (bounded by degree 3).
    for(let h=0;h<queue.length&&chosen.length<maxFaces;h++){
      if(h%256===0)work?.check();
      const fi=queue[h]!;if(!unseen.has(fi))continue;const t=local.triangles[fi]!;
      if(chosen.length&&limitNormals&&normals[root]!.reduce((s,x,i)=>s+x*normals[fi]![i]!,0)<.2)continue;
      const keys=t.map((v,k)=>edgeKey(v,t[(k+1)%3]!)),shared=keys.filter(k=>boundary.has(k));
      const known=t.filter(v=>vertices.has(v)).length;
      if(chosen.length && !(shared.length===1&&known===2||shared.length===2&&known===3))continue;
      chosen.push(fi);unseen.delete(fi);t.forEach(v=>vertices.add(v));
      keys.forEach((key,k)=>{if(boundary.has(key))boundary.delete(key);else boundary.set(key,[t[k]!,t[(k+1)%3]!]);});
      for(const f of adj[fi]!)if(unseen.has(f))queue.push(f);
    }
    if(!chosen.length)throw new Error('UV chart partition made no progress.');result.push(chosen.map(i=>local.sourceFaces[i]!));
  }
  return result;
}
export function unwrapMesh(input:MeshData,seams:ReadonlySet<string>,options:Partial<UnwrapOptions>={},work?:UVWork):UnwrapResult{
  // Enforce no-read even for direct library callers, not only the Studio Worker.
  input=geometryOnlyMesh(input);
  if(options.peelSourceHints===true)throw Error('原 UV 提示已禁用：自动生成只使用几何。');
  validateTubeOptions(options);
  const opts={...(options.chartPolicy==='legacy'?LEGACY_UNWRAP:recommendUnwrap(input,options.chartPolicy??'large').options),...options};
  if(opts.surfaceSymmetry!==undefined&&typeof opts.surfaceSymmetry!=='boolean')throw Error('surfaceSymmetry must be boolean');
  if(opts.symmetryTolerance!==undefined&&(!Number.isFinite(opts.symmetryTolerance)||opts.symmetryTolerance<.001||opts.symmetryTolerance>.06))throw Error('symmetryTolerance must be .001..06');
  if(opts.symmetryStrength!==undefined&&(!Number.isFinite(opts.symmetryStrength)||opts.symmetryStrength<1||opts.symmetryStrength>200))throw Error('symmetryStrength must be 1..200');
  if(opts.symmetryIterations!==undefined&&(!Number.isInteger(opts.symmetryIterations)||opts.symmetryIterations<1||opts.symmetryIterations>100))throw Error('symmetryIterations must be 1..100');
  if(opts.structureTemplates!==undefined&&typeof opts.structureTemplates!=='boolean')throw Error('Invalid structural template switch.');
  if(opts.structuralRelaxIterations!==undefined&&(!Number.isInteger(opts.structuralRelaxIterations)||opts.structuralRelaxIterations<0||opts.structuralRelaxIterations>100))throw Error('structuralRelaxIterations must be 0..100');
  const hierarchical=opts.initialSegmentation==='hierarchical';
  if(opts.peelSourceHints!==undefined&&typeof opts.peelSourceHints!=='boolean')throw Error('Invalid source-hint flag.');
  if(opts.peelMaxDepth!==undefined&&(!Number.isInteger(opts.peelMaxDepth)||opts.peelMaxDepth<1||opts.peelMaxDepth>20))throw Error('peelMaxDepth must be 1..20');
  if(hierarchical)opts.projectionSeed=true;
  const useTemplates=opts.structureTemplates!==false&&opts.uvObjective==='paint'&&opts.autoCut&&opts.method==='auto';
  if(opts.initialSegmentation!==undefined&&!['regions','connected','hierarchical'].includes(opts.initialSegmentation)||opts.postMerge!==undefined&&typeof opts.postMerge!=='boolean')throw new Error('Invalid pre/post segmentation settings.');
  if(!Number.isFinite(opts.stretchAreaPercentile??1)||(opts.stretchAreaPercentile??1)<.9||(opts.stretchAreaPercentile??1)>1)throw new Error('Stretch area percentile must be 0.9..1.');
  if(!['large','balanced','legacy'].includes(opts.chartPolicy??''))throw new Error('Invalid chart policy.');
  if(!['auto','lscm','tutte'].includes(opts.method)||typeof opts.autoCut!=='boolean'||typeof opts.rotate!=='boolean'||!Number.isFinite(opts.padding)||opts.padding<0||opts.padding>=.1||!Number.isInteger(opts.rotationSteps)||opts.rotationSteps<1||opts.rotationSteps>90)throw new Error('Invalid UV solver or packing settings.');
  if(!(opts.maxAspect>=1&&Number.isFinite(opts.maxAspect))||!(opts.minFill>=0&&opts.minFill<=1)||!(opts.maxStretch>=1&&Number.isFinite(opts.maxStretch))||!Number.isInteger(opts.maxChartFaces)||opts.maxChartFaces<8||opts.maxChartFaces>20000||!Number.isInteger(opts.iterations)||opts.iterations<1||opts.iterations>20000||!(opts.tolerance>0&&opts.tolerance<1))throw new Error('Invalid UV solver settings.');
  work?.step?.('parameterize');
  uvProgress(work,{stage:'validate',detail:'检查输入几何',facesDone:0,facesTotal:input.faces.length,islandsDone:0});
  const mesh=normalizedMesh(input),topology=buildTopology(mesh),effective=new Set(seams),warnings:string[]=[];
  for(const [key,e]of topology.edges)if(e.faces.length>2){if(!opts.autoCut)throw new Error('Non-manifold edges require cuts or mesh repair.');effective.add(key);}
  for(let fi=0;fi<mesh.faces.length;fi++){if(fi%256===0)work?.check();const t=mesh.faces[fi]!.vertices;if(new Set(t).size!==3||t.some(v=>!mesh.positions[v])||triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!)<1e-15)throw new Error(`Face ${fi} is degenerate in 3D. Repair/remove it before unwrapping; no faces were silently dropped.`);}
  if(!hierarchical&&opts.autoCut&&opts.uvObjective==='paint'&&seams.size===0){
    const panels=paintPanelSeams(mesh,effective);
    if(panels.panels.length){for(const key of panels.seams)effective.add(key);warnings.push(`保留 ${panels.panels.length} 个主要平面特征面板，优先保持凹口、齿形与孔洞；没有按小平面切碎。`);}
  }
  const planned=hierarchical?planSurfaceGroups(mesh,effective,{...opts,surfaceSymmetry:opts.uvObjective==='paint'&&opts.method==='auto'&&opts.surfaceSymmetry!==false,structureGroups:opts.uvObjective==='paint'&&opts.method==='auto'&&opts.structureGroups!==false,featureSheets:opts.uvObjective==='paint'&&opts.method==='auto'},work):undefined,peel=planned?.report;
  if(planned){for(const key of planned.seams)effective.add(key);warnings.push(`通用剥展：先建立 ${peel!.groups.length} 个空间组，组内再开缝和展平；组数不是 UV 岛数。`);}
  const wholeBands=useTemplates&&buildCharts(mesh,effective,topology).some(c=>inspectBand(mesh,c.faces,opts.humanTemplates).ok);
  if(!hierarchical&&!wholeBands&&opts.autoCut&&opts.chartPolicy!=='legacy'&&effective.size===0&&opts.initialSegmentation!=='connected'){
    uvProgress(work,{stage:'charts',detail:'自动大块分区：合并相邻小区域'});
    const regionOpts={...recommendRegions(mesh,opts.chartPolicy).options,...opts.regionOptions,maxChartFaces:opts.maxChartFaces};
    const regions=segmentMeshRegions(mesh,regionOpts,effective,undefined,()=>work?.check(),topology);
    for(const key of regions.seamEdges)effective.add(key);
    warnings.push(`自动连通分区：${regions.regions.length} 个候选区域，合并 ${regions.mergedRegions} 个局部小区域；后续仍须通过 UV 验证。`);
  }
  uvProgress(work,{stage:'charts',detail:'按接缝拆分连通岛'});
  const componentFaces=buildCharts(mesh,new Set([...topology.edges].filter(([,e])=>e.faces.length>2).map(([k])=>k)),topology).map(c=>c.faces.length).sort((a,b)=>b-a);
  const fragmentation:FragmentationReport={inputComponents:componentFaces.length,componentFaces,initialCharts:0,outputCharts:0,tinyCharts:0,reasons:{},events:[],omittedEvents:0};
  const record=(reason:string,faces:number,sourceChart:number,depth:number,detail?:string)=>{fragmentation.reasons[reason]=(fragmentation.reasons[reason]??0)+1;if(fragmentation.events.length<1000)fragmentation.events.push({reason,faces,sourceChart,depth,...(detail?{detail}:{})});else fragmentation.omittedEvents++;};
  const surfaceContracts:SurfaceUVContract[]=[],tubeContracts:TubeStripContract[]=[],tubeReports:TubeStripReport[]=[];
  const charts=buildCharts(mesh,effective,topology),raw:RawChart[]=[],diagnostics:ChartDiagnostic[]=[];let partitions=0,facesDone=0;
  fragmentation.initialCharts=charts.length;
  const human:HumanTemplateReport|undefined=useTemplates?{version:1,options:humanOptions(opts.humanTemplates),before:charts.length,after:charts.length,applied:0,entries:[],protectedSeams:[],addedSeams:[],removedSeams:[]}:undefined;
  const totalArea=mesh.faces.reduce((sum,f)=>sum+triangleArea(...f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3]),0);
  const templateLocks=new Set(opts.mergeOptions?.protectedSeams??[]);
  const solve=(faces:number[],sourceChart:number,depth=0)=>{
    const event=(action:string,detail:string)=>{if(peel&&peel.events.length<2000)peel.events.push({group:sourceChart,faces:faces.length,depth,action,detail});};
    uvProgress(work,{stage:'topology',detail:`检查几何组 ${sourceChart+1} 的 ${faces.length} 个面（补切层 ${depth}）`,facesDone,facesTotal:mesh.faces.length,islandsDone:raw.length});
    const featureFrame=depth===0?peel?.groups[sourceChart]?.featureFrame:undefined;
    const solveOptions={...opts,featureFrame,symmetryPlane:depth===0&&peel?.groups[sourceChart]?.surfaceReflection?{normal:peel.groups[sourceChart]!.surfaceReflection!.normal,offset:peel.groups[sourceChart]!.surfaceReflection!.offset}:undefined};
    const structure=depth===0?peel?.groups[sourceChart]:undefined;
    if((structure?.kind==='closed-shell'||structure?.kind==='symmetric-sheet')&&faces.length>opts.maxChartFaces)throw Error(`Complete shell needs a per-chart face budget of at least ${faces.length}; current ${opts.maxChartFaces}. Do not split a protected skin merely to satisfy the solver budget.`);
    if(useTemplates&&!featureFrame&&structure?.kind!=='closed-shell'&&structure?.kind!=='symmetric-sheet'){
      const tube=unfoldClosedTube(mesh,faces,sourceChart,new Set([...effective,...templateLocks]),opts,work);
      if(tube){
        tube.report.charts=[];
        for(let i=0;i<tube.raw.length;i++){const chart=tube.raw[i]!,id=raw.length;chart.id=id;raw.push(chart);tube.report.charts.push(id);
          diagnostics.push({id,sourceChart,faces:chart.faceUVs.size,method:'closed-tube-strip',iterations:0,residual:0,...tube.shapes[i]!,tube:tube.report});}
        for(const key of tube.locked){effective.add(key);templateLocks.add(key);}tubeContracts.push(...tube.contracts);tubeReports.push(tube.report);
        event('closed-tube-strip',`${tube.report.rings} geometric cross-sections; longitudinal seam + transverse section; ${tube.report.panels} rectangles; no source UV`);
        facesDone+=faces.length;return;
      }
    }
    if(human&&!featureFrame&&structure?.kind!=='closed-shell'&&structure?.kind!=='symmetric-sheet'){
      const t=unfoldBand(mesh,faces,sourceChart,effective,opts,totalArea,work);
      if('raw' in t){
        event('analytic-seed','Validated generic ring geometry candidate; actual side cuts preserved.');
        t.entry.charts=[];for(let i=0;i<t.raw.length;i++){const p=t.raw[i]!,id=raw.length;p.id=id;raw.push(p);diagnostics.push({...t.diagnostics[i]!,id});t.entry.charts.push(id);}
        effective.clear();for(const key of t.seams)effective.add(key);for(const key of t.locked){effective.add(key);templateLocks.add(key);}
        human.applied++;human.entries.push(t.entry);facesDone+=faces.length;return;
      }else if(depth===0)human.entries.push(t);
    }
    let pendingSlits:string[]=structure?.openingEdges??[];
    let local=cutLocalMesh(mesh,faces,new Set([...effective,...pendingSlits]));
    if(pendingSlits.length){if(!local.disk)throw Error('Planned shell opening no longer defines a disk.');event('structured-opening',structure?.pairedOpening?'Geometric reflection-guided opening validated on real target edges.':'Single continuous opening of a return-wall annulus.');}
    const geometryReflection=structure?.surfaceCorrespondence;
    const localFaceIds=new Map(local.sourceFaces.map((f,i)=>[f,i]));
    const recognized=geometryReflection?{...geometryReflection,pairs:geometryReflection.pairs.map(p=>{
      const a=localFaceIds.get(p.a.face),b=localFaceIds.get(p.b.face);
      if(a===undefined||b===undefined)throw Error('Recognized surface correspondence lost its source faces.');
      return {...p,a:{...p.a,face:a},b:{...p.b,face:b}};
    })}:undefined;
    const planar=opts.uvObjective==='paint'&&opts.method==='auto'&&planarShapeCandidate(local)!==null;
    let p:Parameterization|undefined;
    // A hole is not, by itself, a reason to cut a visible panel into strips.
    if(!local.disk&&local.manifold&&local.boundaryLoops>1&&local.euler===2-local.boundaryLoops&&faces.length<=opts.maxChartFaces){
      try{p=parameterizeChart(local,{...solveOptions,projectionSeed:true},work);event('multi-boundary','Kept all boundary loops without adding a solver-only slit.');}
      catch(error){rethrowUVStop(error);event('multi-boundary-rejected',String(error));}
    }
    if(!p&&!planar&&opts.autoCut&&opts.chartPolicy!=='legacy'&&!local.disk&&faces.length<=opts.maxChartFaces){
      const opened=openChartWithSlits(mesh,faces,effective,local,work);
      if(opened){local=opened.local;pendingSlits=opened.added;if(!hierarchical)for(const key of opened.added)effective.add(key);}
    }
    const partition=(maxFaces:number,normalLimit:boolean)=>{
      if(peel){peel.feedbackSplits++;event('feedback-cut','Validated solve/shape/topology requires an additional connected bisection, not normal-cone fragmentation.');return bisectSurface(mesh,faces,effective,topology,work,undefined,opts.seamBandRings??5);}
      if(opts.chartPolicy==='legacy')return splitDisks(local,maxFaces,normalLimit,work);
      const r=segmentMeshRegions(mesh,{normalConeDegrees:normalLimit?70:170,maxChartFaces:maxFaces,minRegionFaces:Math.min(64,Math.max(8,Math.floor(faces.length*.01))),minRegionAreaRatio:.01},effective,faces,()=>work?.check(),topology);
      // Recursive children inherit region boundaries through their face subsets;
      // final exported cuts are computed from actual solved chart membership.
      return r.regions.length>1?r.regions:splitDisks(local,maxFaces,normalLimit,work);
    };
    if(!p&&!local.disk&&!planar||faces.length>opts.maxChartFaces){
      if(!opts.autoCut)throw new Error(`Chart ${sourceChart+1}: requires additional cuts (Euler ${local.euler}, ${local.boundaryLoops} boundaries, ${faces.length} faces). Enable automatic cuts or edit seams.`);
      
      record(!local.disk?'topology':'face-budget',faces.length,sourceChart,depth,`Euler ${local.euler}; boundaries ${local.boundaryLoops}`);
      const pieces=partition(Math.min(opts.maxChartFaces,Math.max(1,faces.length-1)),!local.disk);partitions++;
      for(const fs of pieces)solve(fs,sourceChart,depth+1);return;
    }
    // Catch this chart's numerical failure only. Never catch a child recursion
    // after it has appended solved siblings (that could duplicate source faces).
    try{p??=parameterizeChart(local,solveOptions,work,recognized);}catch(error){
      rethrowUVStop(error);
      if(structure?.kind==='closed-shell'||structure?.kind==='symmetric-sheet')throw Error('Complete skin/wall solve rejected; protected holes will not be opened into the outside boundary. '+String(error));
      if(!opts.autoCut||faces.length<2||depth>(opts.peelMaxDepth??20))throw error;
      
      record('solver-invalid',faces.length,sourceChart,depth,String(error));
      partitions++;for(const fs of partition(Math.max(1,Math.floor(faces.length/2)),true))solve(fs,sourceChart,depth+1);return;
    }
      if(structure?.kind==='symmetric-sheet'&&(!p.symmetryPairs||p.symmetry?.status==='rejected'))throw Error('Recognized symmetric sheet did not satisfy UV symmetry constraints.');
      let structuralRelaxation:ChartDiagnostic['structuralRelaxation'];
      // Conformal validity alone does not preserve the relative size of a
      // shoulder versus its waist. Balance the intrinsic 3D metric of verified
      // bilateral panels, without consulting any authored UV coordinates.
      if(!p.symmetryPairs&&structure?.kind==='bilateral-connector'&&opts.method==='auto'&&opts.uvObjective==='paint'&&(opts.structuralRelaxIterations??60)>0){
        try{const r=freeBoundaryARAP(local,p.uv,opts.structuralRelaxIterations??60,Math.min(opts.iterations,600),work);
          const quality=checkUVTriangles(local.triangles.map(t=>t.map(v=>r.uv[v]!) as [Vec2,Vec2,Vec2]),100,work);
          if(r.accepted&&r.energy<r.initialEnergy&&r.maxAnisotropy<=100&&quality.valid&&simpleUVBoundary(r.uv,local.boundaries,work)){
            structuralRelaxation={initialEnergy:r.initialEnergy,finalEnergy:r.energy,acceptedIterations:r.accepted};
            p={uv:r.uv,method:'arap-free',quality,iterations:r.iterations,residual:r.residual,boundaryValid:true,fallbackReason:'Intrinsic length relaxation of a geometry-derived bilateral panel; no source UV.'};
          }
        }catch(error){rethrowUVStop(error);event('structure-relax-rejected',String(error));}
      }
      const shape=shapeQuality(local,p.uv,opts.stretchAreaPercentile??1,opts.maxStretch);
      if(opts.autoCut&&faces.length>16&&((opts.uvObjective==='compact'&&shape.aspect>opts.maxAspect)||shape.fill<opts.minFill||shape.areaStretch>opts.maxStretch)){record(shape.areaStretch>opts.maxStretch?'stretch':shape.aspect>opts.maxAspect?'aspect':'fill',faces.length,sourceChart,depth,`area stretch ${shape.areaStretch}; maximum ${shape.maxStretch}`);partitions++;for(const fs of partition(Math.max(1,Math.floor(faces.length/2)),shape.areaStretch>opts.maxStretch))solve(fs,sourceChart,depth+1);return;}
      if(p.symmetryPairs&&p.symmetry&&p.symmetry.status!=='rejected'){
        surfaceContracts.push({faces:[...faces],pairs:p.symmetryPairs.map(pair=>({...pair,a:{...pair.a,face:local.sourceFaces[pair.a.face]!},b:{...pair.b,face:local.sourceFaces[pair.b.face]!}})),baseline:p.symmetry.after,surface:p.symmetry.surface});
        // Weak segmentation may be revisited elsewhere; a fully solved and
        // verified symmetric region must not be unilaterally joined afterwards.
        const members=new Set(faces);for(const[k,e]of topology.edges)if(e.faces.length===2&&e.faces.some(f=>members.has(f))&&!e.faces.every(f=>members.has(f)))templateLocks.add(k);
      }
      for(const key of pendingSlits)effective.add(key);
      event('unfold',`${p.method}; ${pendingSlits.length} internal slit edges; aspect ${shape.aspect.toFixed(2)}`);
      const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
      local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...p.uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
      const area3D=local.triangles.reduce((s,t)=>s+triangleArea(local.positions[t[0]]!,local.positions[t[1]]!,local.positions[t[2]]!),0),id=raw.length;
      facesDone+=faces.length;uvProgress(work,{stage:'parameterize',detail:'已接受有效 UV 岛',facesDone,facesTotal:mesh.faces.length,islandsDone:raw.length+1});
      raw.push({id,faceUVs,area3D});diagnostics.push({id,sourceChart,faces:faces.length,structuralRelaxation,symmetry:p.symmetry,method:p.method,...shape,iterations:p.iterations,residual:p.residual,...(p.feature?{feature:p.feature}:{}),...(p.fallbackReason?{fallbackReason:p.fallbackReason}:{})});
  };
  charts.forEach(chart=>solve(chart.faces,chart.id));
  for(const key of peel?.groupSeams??[])templateLocks.add(key);
  opts.mergeOptions={...opts.mergeOptions,protectedSeams:[...templateLocks]};
  let merge:MergeReport|undefined;
  if(opts.postMerge){work?.step?.('merge');const m=mergeAdjacentCharts(mesh,raw,effective,opts,diagnostics,work);raw.splice(0,raw.length,...m.raw);diagnostics.splice(0,diagnostics.length,...m.diagnostics);effective.clear();for(const key of m.seams)effective.add(key);merge=m.report;warnings.push(`后处理邻岛缝合：${merge.before} → ${merge.after} 岛；接受 ${merge.accepted} 次，尝试 ${merge.attempts} 次；${merge.budgetExhausted?'达到预算，不代表全局最少岛':'保留未通过拓扑/形变检查的边界'}。`);}
  const faceChart=new Int32Array(mesh.faces.length);raw.forEach(r=>{for(const fi of r.faceUVs.keys())faceChart[fi]=r.id;});
  for(const [key,e]of topology.edges){
    if(e.faces.length!==2){if(e.faces.length>1)effective.add(key);continue;}
    if(faceChart[e.faces[0]!]!==faceChart[e.faces[1]!])effective.add(key);
    const f=mesh.faces[e.faces[0]!]!.vertices,g=mesh.faces[e.faces[1]!]!.vertices;
    const direction=(t:readonly number[])=>t.some((v,i)=>v===e.a&&t[(i+1)%3]===e.b);
    if(direction(f)===direction(g))effective.add(key);
  }
  if(human){human.after=raw.length;human.protectedSeams=[...templateLocks];human.addedSeams=[...effective].filter(e=>!seams.has(e));human.removedSeams=[...seams].filter(e=>!effective.has(e));remapHumanReport(human,raw);warnings.unshift(`结构模板应用 ${human.applied} 个环带；上下边界与侧缝保持。未匹配的一般曲面使用保形求解。`);}
  const addedSeams=[...effective].filter(e=>!seams.has(e));
  if(addedSeams.length)warnings.push(`自动新增 ${addedSeams.length} 条 UV 裁切边（未启用后处理时保留原接缝；后处理移除量另列），用于拓扑修复、控制求解规模或避免无效 UV。新增边已用于动画、2D 与导出。`);
  const fallbacks=diagnostics.filter(d=>d.method==='tutte').length;if(fallbacks)warnings.push(`${fallbacks} 个岛使用凸边界 Tutte；优先有效映射，可能有较大拉伸。`);
  fragmentation.outputCharts=raw.length;fragmentation.tinyCharts=raw.filter(c=>c.faceUVs.size<16).length;
  warnings.push(`碎片诊断：输入 ${fragmentation.inputComponents} 个几何连通分量 → ${fragmentation.initialCharts} 个初始区域 → ${raw.length} 个最终岛（${fragmentation.tinyCharts} 个小于16面）。补切原因：${JSON.stringify(fragmentation.reasons)}。详细事件可导出诊断。`);
  const tolerated=diagnostics.filter(d=>d.maxStretch>opts.maxStretch&&d.areaStretch!<=opts.maxStretch);
  if(tolerated.length)warnings.push(`${tolerated.length} 个岛含超过软形变阈值的微小细节；采用 ${((opts.stretchAreaPercentile??1)*100).toFixed(1)}% 源表面积分位数避免整块反复切碎。最坏值仍报告；不豁免翻面、退化或交叠。`);
  const sym=diagnostics.filter(d=>d.symmetry), rejected=sym.filter(d=>d.symmetry!.status==='rejected');
  if(sym.length)warnings.push(`表面对称：识别 ${sym.length} 个候选，${sym.length-rejected.length} 个通过展平与最终输出约束，${rejected.length} 个未通过并明确保留原有效候选；未识别、已开缝或未通过区域不保证对称。原 UV 使用 0。`);
  work?.step?.('pack');
  const atlas=packConnectedAtlas(mesh,raw,opts,work);
  warnings.push(`占用率是有效 UV 三角形面积之和，不是包围盒面积。排布为 ${atlas.packingMethod==='shelf'?'面积感知 Shelf（大岛数快速路径）':'MaxRects'} 启发式，不宣称全局最优。`);
  if(peel){if(tubeContracts.length){peel.tubeContracts=tubeContracts;peel.tubeReports=tubeReports;}peel.surfaceContracts=surfaceContracts;peel.totalIslands=raw.length;for(const group of peel.groups){const fs=new Set(group.faces);group.charts=raw.filter(c=>[...c.faceUVs.keys()].some(f=>fs.has(f))).map(c=>c.id);}warnings.push(`通用剥展完成：${peel.groups.length} 个空间组 → ${raw.length} 个有效岛；${peel.feedbackSplits} 次反馈细分，${peel.sourceHintCharts} 个有效源形状回退。空间组边界与组内 UV 缝分别记录。`);}
  validateTubeOutput(atlas.packed,effective,tubeContracts,work);
  if(tubeReports.length)warnings.push(`闭合管身条带：${tubeReports.length} 个完整周期管状区域，按几何弧长/周长建立矩形。长宽比来自3D，单条带不保证填满正方形；可显式增加横向分段。`);
  validateStructureOutput(mesh,atlas.packed,effective,peel,work);
  validateSurfaceSymmetryOutput(mesh,atlas.packed,peel,work);
  return{...atlas,peel,human,merge,fragmentation,seams:[...effective],addedSeams,diagnostics,warnings};
}
