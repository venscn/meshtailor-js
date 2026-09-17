import {type SourceFeatureReport} from './source-features.js';
import {applyHumanTemplates,remapHumanReport,type HumanTemplateReport} from './human-templates.js';
import {refineAtlas,describeFill} from './fill-refinement.js';
import {checkUVTriangles} from './uv-quality.js';
import type {AtlasPacking} from './atlas-pack.js';
import {repairSourceCharts,type SourceRepairReport} from './source-repair.js';
import {geometryOnlyMesh,type MeshData} from '@meshtailor/mesh-core';
import type {PackedChart} from './preview.js';
import {normalizedMesh,shapeQuality} from './chart-quality.js';
import {cutLocalMesh} from './cut-topology.js';
import type {Vec2} from '@meshtailor/mesh-core';
import {rawChartsFromPreview,mergeAdjacentCharts,type MergeReport} from './chart-merge.js';
import {packConnectedAtlas} from './atlas-pages.js';
import {recommendUnwrap,type UnwrapOptions,type ChartDiagnostic} from './unwrap.js';
import type {UVWork} from './work.js';
/** Edit an already generated atlas without reading original model UV.
 * Worker callers must attach the matching generated snapshot provenance.
 * The legacy source-atlas literal exists only for an explicit rejection. */
export function postprocessUV(input:MeshData,seed:readonly PackedChart[],seams:ReadonlySet<string>,operation:'stitch'|'repack'|'templates'|'source-atlas',options:Partial<UnwrapOptions>={},work?:UVWork){
  if(operation==='source-atlas')throw Error('Source UV organization is not supported. Generate UV from geometry first.');
  input=geometryOnlyMesh(input);

  if(operation!=='stitch'&&operation!=='repack'&&operation!=='templates')throw new Error('Unknown UV post-operation.');
  const mesh=normalizedMesh(input),opts={...recommendUnwrap(input).options,...options};
  if(!Number.isInteger(opts.maxChartFaces)||opts.maxChartFaces<8||opts.maxChartFaces>20000||!Number.isFinite(opts.maxStretch)||opts.maxStretch<1||!Number.isFinite(opts.maxAspect)||opts.maxAspect<1)throw new Error('Invalid postprocess quality settings.');
  if(opts.sourceRepairPolicy!==undefined&&!['repair','reject'].includes(opts.sourceRepairPolicy))throw new Error('Invalid source repair policy.');
  let effective=new Set(seams),repair:SourceRepairReport|undefined;
  work?.step?.('repair');
  let raw;if(opts.sourceRepairPolicy==='repair'){const prepared=repairSourceCharts(mesh,seed,seams,opts,work);raw=prepared.raw;effective=prepared.seams;repair=prepared.report;}else raw=rawChartsFromPreview(mesh,seed,work);
  let features:SourceFeatureReport|undefined,featureDiagnostics:ChartDiagnostic[]=[];
  if(opts.sourceFeaturePolicy!==undefined&&!['repair','preserve'].includes(opts.sourceFeaturePolicy))throw Error('Invalid source feature policy.');
  let human:HumanTemplateReport|undefined,templateDiagnostics:ChartDiagnostic[]=[];
  if(opts.structureTemplates!==undefined&&typeof opts.structureTemplates!=='boolean')throw Error('Invalid structural template switch.');
  if(operation!=='repack'&&opts.structureTemplates!==false&&opts.uvObjective==='paint'&&opts.autoCut&&opts.method==='auto'){
    work?.step?.('structure');
    const t=applyHumanTemplates(mesh,raw,effective,opts,work);raw=t.raw;effective=t.seams;human=t.report;templateDiagnostics=t.diagnostics;
    opts.mergeOptions={...opts.mergeOptions,protectedSeams:t.protectedSeams};
  }
  let merge:MergeReport|undefined;
  let diagnostics:ChartDiagnostic[]=raw.map(c=>{
    const local=cutLocalMesh(mesh,[...c.faceUVs.keys()],effective),vs:Vec2[]=new Array(local.positions.length);
    local.sourceFaces.forEach((fi,i)=>local.triangles[i]!.forEach((v,k)=>{vs[v]=c.faceUVs.get(fi)![k]!;}));
    const templated=templateDiagnostics.find(d=>d.id===c.id);if(templated)return templated;
    const feature=featureDiagnostics.find(d=>d.id===c.id);if(feature)return feature;
    const repaired=repair?.islands.find(i=>i.id===c.id);
    return {id:c.id,sourceChart:c.id,faces:c.faceUVs.size,method:repaired?.method??'generated-shape',iterations:repaired?.iterations??0,residual:repaired?.residual??0,...shapeQuality(local,vs,opts.stretchAreaPercentile??1,opts.maxStretch),...(repaired?.fallbackReason?{fallbackReason:repaired.fallbackReason}:{})};
  });
  if(operation==='stitch'){work?.step?.('merge');const result=mergeAdjacentCharts(mesh,raw,effective,opts,diagnostics,work);raw=result.raw;effective=result.seams;merge=result.report;diagnostics=result.diagnostics;}
  remapHumanReport(human,raw);
  work?.step?.('pack');
  const atlas=packConnectedAtlas(mesh,raw,opts,work),warnings=[operation==='templates'?'按结构模板重展当前区域；未匹配区域保留，未运行泛化邻岛缝合。':operation==='stitch'?`后处理：${merge!.before} → ${merge!.after} 个岛；接受 ${merge!.accepted} 次缝合，移除 ${merge!.removedSeams.length} 条接缝。拒绝原因 ${JSON.stringify(merge!.reasons)}。`:'只重排现有岛：岛数量和裁切不变；消除岛与岛之间的叠放，不修复岛内部折叠。','这是新 UV atlas，不保留原贴图布局；跨材质合并/分页后需要重新烘焙贴图。原始网格与源 UV 未被修改。'];
  if(human)warnings.unshift(`结构模板：识别并应用 ${human.applied} 个区域；${human.before} → ${human.after} 片（缝合前）。侧缝保持，未匹配区域沿用保形结果。`);
  if(repair?.repaired)warnings.unshift(`从原3D局部修复 ${repair.repaired} 个无效生成岛（${repair.islands.map(i=>'#'+(i.id+1)).join('、')}）；其余 ${repair.preserved} 岛先通过有效性检查，后续仍可接受轮廓检查与验证缝合；所有面保留。新UV需要重烘焙。`);
  if(merge?.budgetExhausted)warnings.push('缝合达到尝试预算；剩余岛不代表几何上不可合并。可提高预算或对当前结果再次执行后处理。');
  if(atlas.pageReport?.mode==='single')warnings.push('新 atlas 使用统一单页，不再沿用源材质作为 UV 域；未相连的几何仍是独立岛。原材质对应关系保存在页面诊断中。');
  else if(atlas.pageReport)warnings.push(`按原几何连接关系分配 ${atlas.pageReport.actual} 页；同页共享边长保留 ${(atlas.pageReport.retainedSharedBoundaryRatio*100).toFixed(1)}%。页数是软目标；不跨真实断开的组件分组。`);
  if(opts.uvObjective==='paint')warnings.unshift('手绘轮廓优先：不自动交付圆边界 Tutte；优先保留当前生成岛形状缝合，超出原形比例门槛则保留分岛。可辨识性是几何目标，不保证自动识别衣片语义。');
  return {...atlas,features,human,diagnostics,seams:[...effective],addedSeams:[...effective].filter(e=>!seams.has(e)),removedSeams:[...seams].filter(e=>!effective.has(e)),merge,repair,warnings};
}

/** Improve the CURRENT complete single-page result, without area-normalizing it
 * again or starting another segmentation / stitch pass. Repeated calls retain
 * gains and cap density spread; they do not compound large-island inflation. */
export function fillCurrentUV(input:MeshData,seed:readonly PackedChart[],seams:ReadonlySet<string>,options:Partial<UnwrapOptions>={},work?:UVWork){
  input=geometryOnlyMesh(input);
  if(options.fillRecutLarge)throw Error('Original-seam recut has been removed; no source UV may be used.');
  if(options.atlasPageMode&&options.atlasPageMode!=='single'||new Set(seed.map(p=>p.atlasPage??0)).size>1)throw Error('空白精排当前只支持单页；请先选择单页排布。');
  const mesh=normalizedMesh(input),raw=rawChartsFromPreview(mesh,seed,work),padding=options.padding??.003;
  const quality=checkUVTriangles(seed.flatMap(c=>[...c.faceUVs.values()]),100,work);
  if(!quality.valid)throw Error('当前 UV 仍有翻面、退化或岛间重叠，请先“从几何生成 UV”，不能直接填空。');
  if(seed.some(c=>c.bounds[0]<padding-1e-9||c.bounds[1]<padding-1e-9||c.bounds[2]>1-padding+1e-9||c.bounds[3]>1-padding+1e-9))throw Error('当前岛不满足单页边界 / 所设留白，请先“只重排当前岛”，再精排。');
  const baseline:AtlasPacking={packed:[...seed],occupancy:quality.area,boxOccupancy:seed.reduce((s,c)=>s+(c.bounds[2]-c.bounds[0])*(c.bounds[3]-c.bounds[1]),0),scale:1,padding,packingMethod:'existing',packingReport:{order:'area',placementOrder:raw.slice().sort((a,b)=>b.area3D-a.area3D).map(c=>c.id),searchAttempts:0,failedFits:0,areaBoosts:[]}};
  let result=refineAtlas(baseline,raw,{...options,fillMode:options.fillMode==='uniform'?'uniform':'area-priority'},work);
  let effective=new Set(seams),addedSeams:string[]=[];
  const report=result.packingReport!.refinement!;
  return{...result,seams:[...effective],addedSeams,removedSeams:[] as string[],warnings:[describeFill(report),'精排仅移动、旋转和有界统一缩放 UV 岛；未改变任何源面或裁切。大岛优先模式不再严格等密度，新 UV 需要重烘焙。','轮廓包围盒可以互相覆盖，其面积总和不是实际纹理占用率。高轮廓浪费本身不触发拆分；不会读取模型旧切缝进行额外拆分。'],pageReport:{mode:'single' as const,requested:1,actual:1,geometryComponents:null,retainedSharedBoundaryRatio:1,pages:[{id:0,charts:result.packed.map(c=>c.id),faces:input.faces.length,sourceMaterials:[...new Set(input.faces.map(f=>f.uvSpace??'default'))],occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,scale:1}]}};
}
