import {repairSourceCharts,type SourceRepairReport} from './source-repair.js';
import type {MeshData} from '@meshtailor/mesh-core';
import type {PackedChart} from './preview.js';
import {normalizedMesh} from './chart-quality.js';
import {rawChartsFromPreview,mergeAdjacentCharts,type MergeReport} from './chart-merge.js';
import {packConnectedAtlas} from './atlas-pages.js';
import {recommendUnwrap,type UnwrapOptions} from './unwrap.js';
import type {UVWork} from './work.js';
/** Explicit destructive-to-UV (not source geometry) post-operation on a captured
 * snapshot. This never silently substitutes a fresh baseline segmentation. */
export function postprocessUV(input:MeshData,seed:readonly PackedChart[],seams:ReadonlySet<string>,operation:'stitch'|'repack',options:Partial<UnwrapOptions>={},work?:UVWork){
  if(operation!=='stitch'&&operation!=='repack')throw new Error('Unknown UV post-operation.');
  const mesh=normalizedMesh(input),opts={...recommendUnwrap(input).options,...options};
  if(!Number.isInteger(opts.maxChartFaces)||opts.maxChartFaces<8||opts.maxChartFaces>20000||!Number.isFinite(opts.maxStretch)||opts.maxStretch<1||!Number.isFinite(opts.maxAspect)||opts.maxAspect<1)throw new Error('Invalid postprocess quality settings.');
  if(opts.sourceRepairPolicy!==undefined&&!['repair','reject'].includes(opts.sourceRepairPolicy))throw new Error('Invalid source repair policy.');
  let effective=new Set(seams),repair:SourceRepairReport|undefined;
  let raw;if(opts.sourceRepairPolicy==='repair'){const prepared=repairSourceCharts(mesh,seed,seams,opts,work);raw=prepared.raw;effective=prepared.seams;repair=prepared.report;}else raw=rawChartsFromPreview(mesh,seed,work);
  let merge:MergeReport|undefined;
  if(operation==='stitch'){const result=mergeAdjacentCharts(mesh,raw,effective,opts,[],work);raw=result.raw;effective=result.seams;merge=result.report;}
  const atlas=packConnectedAtlas(mesh,raw,opts,work),warnings=[operation==='stitch'?`后处理：${merge!.before} → ${merge!.after} 个岛；接受 ${merge!.accepted} 次缝合，移除 ${merge!.removedSeams.length} 条接缝。拒绝原因 ${JSON.stringify(merge!.reasons)}。`:'只重排现有岛：岛数量和裁切不变；消除岛与岛之间的叠放，不修复岛内部折叠。','这是新 UV atlas，不保留原贴图布局；跨材质合并/分页后需要重新烘焙贴图。原始网格与源 UV 未被修改。'];
  if(repair?.repaired)warnings.unshift(`从原3D局部修复 ${repair.repaired} 个无效原UV岛（${repair.islands.map(i=>'#'+(i.id+1)).join('、')}）；其余 ${repair.preserved} 岛未重新求解，所有面保留。新UV需要重烘焙。`);
  if(merge?.budgetExhausted)warnings.push('缝合达到尝试预算；剩余岛不代表几何上不可合并。可提高预算或对当前结果再次执行后处理。');
  if(atlas.pageReport?.mode==='single')warnings.push('新 atlas 使用统一单页，不再沿用源材质作为 UV 域；未相连的几何仍是独立岛。原材质对应关系保存在页面诊断中。');
  else if(atlas.pageReport)warnings.push(`按原几何连接关系分配 ${atlas.pageReport.actual} 页；同页共享边长保留 ${(atlas.pageReport.retainedSharedBoundaryRatio*100).toFixed(1)}%。页数是软目标；不跨真实断开的组件分组。`);
  return {...atlas,seams:[...effective],addedSeams:[...effective].filter(e=>!seams.has(e)),removedSeams:[...seams].filter(e=>!effective.has(e)),merge,repair,warnings};
}
