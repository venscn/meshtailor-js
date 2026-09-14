import { useState } from 'react';
import { DEFAULT_UNWRAP, type UnwrapOptions } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
/** Draft settings are applied together: dragging a control never launches dozens of solvers. */
export function UVSolverControls({value,onChange,snapshot}:{value:UnwrapOptions;onChange:(v:UnwrapOptions)=>void;snapshot:UVSnapshot|null}){
  const [draft,setDraft]=useState(value),patch=(v:Partial<UnwrapOptions>)=>setDraft(d=>({...d,...v}));
  return <details className="uv-solver-controls" open><summary>UV 求解与排布</summary>
    <label>参数化<select aria-label="UV solver" value={draft.method} onChange={e=>patch({method:e.target.value as UnwrapOptions['method']})}><option value="auto">LSCM + 有效性检查 + Tutte 回退</option><option value="lscm">仅 LSCM（无效时补切或报错）</option><option value="tutte">凸边界 Tutte（稳健，拉伸较大）</option></select></label>
    <label className="check"><input type="checkbox" checked={draft.autoCut} onChange={e=>patch({autoCut:e.target.checked})}/> 允许拓扑 / 拉伸 / 长条补切</label>
    <small>关闭后严格保留输入接缝；无法有效求解时明确报错。所有补切都会在 3D / UV 中显示。</small>
    <label>UV 留白（每侧）<input type="number" min="0" max=".05" step=".001" value={draft.padding} onChange={e=>patch({padding:+e.target.value})}/></label>
    <label className="check"><input type="checkbox" checked={draft.rotate} onChange={e=>patch({rotate:e.target.checked})}/> 允许旋转排布（不拉伸岛的宽高）</label>
    <label>排布策略<select aria-label="UV packing" value={draft.packing??'auto'} onChange={e=>patch({packing:e.target.value as UnwrapOptions['packing']})}>
      <option value="auto">自动：小岛数 MaxRects / 大岛数 Shelf</option><option value="maxrects">MaxRects（最多 1024 岛）</option><option value="shelf">Shelf 面积感知快速排布</option>
    </select></label>
    <small>自动模式超过 256 个岛改用 Shelf；不改变裁切线、留白或统一纹素密度。排布空隙可能不同。</small>
    <label>UV 任务预算（秒）<input aria-label="UV time budget" type="number" min="5" max="900" step="5" value={(draft.timeBudgetMs??120000)/1000} onChange={e=>patch({timeBudgetMs:+e.target.value*1000})}/></label>
    <label>单岛面数预算<input type="number" min="8" max="20000" step="128" value={draft.maxChartFaces} onChange={e=>patch({maxChartFaces:+e.target.value})}/></label>
    <label>长宽比补切阈值<input type="number" min="1" max="100" step=".5" value={draft.maxAspect} onChange={e=>patch({maxAspect:+e.target.value})}/></label>
    <label>角形变阈值（最大奇异值比）<input type="number" min="1" max="1000" step="1" value={draft.maxStretch} onChange={e=>patch({maxStretch:+e.target.value})}/></label>
    <details><summary>数值求解设置</summary>
      <label>最大迭代<input type="number" min="1" max="20000" step="100" value={draft.iterations} onChange={e=>patch({iterations:+e.target.value})}/></label>
      <label>相对残差目标<input type="number" min="1e-12" max=".001" step="1e-9" value={draft.tolerance} onChange={e=>patch({tolerance:+e.target.value})}/></label>
      <label>岛 / 包围盒最小面积比<input type="number" min="0" max="1" step=".05" value={draft.minFill} onChange={e=>patch({minFill:+e.target.value})}/></label>
    </details>
    <div className="button-grid two"><button className="primary" onClick={()=>onChange({...draft})}>应用并重新展开</button><button onClick={()=>{setDraft({...DEFAULT_UNWRAP});onChange({...DEFAULT_UNWRAP});}}>恢复默认</button></div>
    {snapshot?.metrics&&<div className="uv-quality-stats"><b>有效 UV 占用 {(snapshot.metrics.occupancy*100).toFixed(1)}%</b><span>包围盒占用 {(snapshot.metrics.boxOccupancy*100).toFixed(1)}%</span><span>{snapshot.addedSeams?.length??0} 条补切 · {snapshot.diagnostics?.filter(d=>d.method==='tutte').length??0} 个 Tutte 岛</span><span>实际排布：{snapshot.metrics.packingMethod??'MaxRects'}</span><span>生成 UV 已检查翻面、退化和正面积重叠</span></div>}
  </details>;
}
