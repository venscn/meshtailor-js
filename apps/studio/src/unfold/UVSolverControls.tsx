import { useState, useEffect } from 'react';
import { DEFAULT_UNWRAP, type UnwrapOptions } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
/** Draft settings are applied together: dragging a control never launches dozens of solvers. */
export function UVSolverControls({value,onChange,snapshot,onAuto,onProcess}:{onProcess:(operation:'connected'|'stitch'|'repack',config:UnwrapOptions)=>void;onAuto:(goal:'large'|'balanced')=>void;value:UnwrapOptions;onChange:(v:UnwrapOptions)=>void;snapshot:UVSnapshot|null}){
  const [draft,setDraft]=useState(value),patch=(v:Partial<UnwrapOptions>)=>setDraft(d=>({...d,...v}));
  useEffect(()=>setDraft(value),[value]);
  return <details className="uv-solver-controls" open><summary>UV 求解与排布</summary>
    <div className="button-grid two"><button className="primary" aria-label="Auto large charts" onClick={()=>onAuto('large')}>自动参数 · 大块重分割</button><button aria-label="Auto balanced charts" onClick={()=>onAuto('balanced')}>自动参数 · 均衡</button></div>
    <small>分析当前几何并填写参数，替换当前裁切方案、重新生成 UV；原始 UV 仍保留，可通过 Extract 对比。不是在保持贴图布局的前提下合并。</small>
    <details open><summary>减少碎岛 · 前处理 / 后处理</summary>
      <button className="primary" aria-label="Connected first unwrap" onClick={()=>onProcess('connected',{...draft,initialSegmentation:'connected',postMerge:true})}>前处理：连通优先重分割 + 自动缝合</button>
      <small>先尝试完整几何连通块与必要开缝，无法通过有效性 / 形变检查才拆分；随后尝试合并相邻岛。会替换当前裁切方案。</small>
      <div className="button-grid two"><button disabled={!snapshot} aria-label="Stitch current islands" onClick={()=>onProcess('stitch',draft)}>后处理：缝合当前邻岛</button><button disabled={!snapshot} aria-label="Repack current islands" onClick={()=>onProcess('repack',draft)}>只重排当前岛</button></div>
      <small>缝合 = 移除共享接缝并重新求解；只重排 = 岛数不变，消除岛间叠放。原 UV 在模型中保留；新 atlas 需要重烘焙，原岛内部折叠不能靠重排修好。</small>
      <label>新 UV 页分配<select aria-label="Atlas page mode" value={draft.atlasPageMode??'single'} onChange={e=>patch({atlasPageMode:e.target.value as UnwrapOptions['atlasPageMode']})}><option value="single">单页（默认）</option><option value="adjacency">连接紧密的岛优先同页</option><option value="components">每个几何连通组一页</option></select></label>
      <label>目标页数（软目标）<input aria-label="Atlas page count" type="number" min="1" max="64" value={draft.atlasPageCount??2} onChange={e=>patch({atlasPageCount:+e.target.value})}/></label>
      <small>仅对新 atlas 生效，不按材质编号分页；不跨断开的组件强行组页，实际页数可能更多。源材质分框不是此处的新页面。</small>
      <label>分割前策略<select aria-label="Initial segmentation" value={draft.initialSegmentation??'regions'} onChange={e=>patch({initialSegmentation:e.target.value as UnwrapOptions['initialSegmentation']})}><option value="regions">按法线分区（原策略）</option><option value="connected">连通块优先（不先按法线切碎）</option></select></label>
      <label className="check"><input aria-label="Post merge generated charts" type="checkbox" checked={draft.postMerge??false} onChange={e=>patch({postMerge:e.target.checked})}/>生成后自动尝试邻岛缝合</label>
      <label>缝合尝试预算<input aria-label="Merge attempts" type="number" min="0" max="2000" value={draft.mergeOptions?.maxAttempts??128} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,maxAttempts:+e.target.value}})}/></label>
      <label>目标岛数（不牺牲有效性）<input aria-label="Merge target" type="number" min="1" value={draft.mergeOptions?.targetCharts??1} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,targetCharts:+e.target.value}})}/></label>
      <label className="check"><input aria-label="Preserve material boundaries" type="checkbox" checked={draft.mergeOptions?.respectMaterials??false} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,respectMaterials:e.target.checked}})}/>后处理不跨源材质边界缝合</label>
    </details>
    {snapshot?.sourceAudit&&<div role="status" className="uv-quality-stats"><b>原 UV 的真实岛数：{snapshot.packed.length}（不按可见轮廓计数）</b>{snapshot.sourceAudit.domains.map(d=><span key={d.id}>{d.name} · {d.islands} 岛 · {d.overlapCountCapped?'至少 ':''}{d.overlapPairs} 对正面积重叠 · {d.degenerate} 退化面</span>)}<small>重叠可能是有意复用；需要唯一新 atlas 时使用前处理或后处理。Extract 只读取，不改源 UV。</small></div>}
    {snapshot?.merge&&<div role="status" className="uv-quality-stats"><b>邻岛缝合：{snapshot.merge.before} → {snapshot.merge.after} 岛</b><span>接受 {snapshot.merge.accepted} 次 / 求解尝试 {snapshot.merge.attempts} 次 · 移除 {snapshot.merge.removedSeams.length} 条接缝</span><span>拒绝原因：{JSON.stringify(snapshot.merge.reasons)}</span><span>{snapshot.merge.budgetExhausted?'已达预算，可提高预算或对当前结果继续缝合。':'未强行合并不能通过检查的区域。'}</span></div>}
    {snapshot?.pageReport&&<p>新 atlas：{snapshot.pageReport.actual} 页 · 同页保留 {(100*snapshot.pageReport.retainedSharedBoundaryRatio).toFixed(1)}% 的共享边界长度；使用统一纹素密度。每页占用率见诊断 JSON。</p>}
    <label>原始 UV 展示<select aria-label="Source UV layout" value={draft.sourceUVLayout??'materials'} onChange={e=>{const v={...draft,sourceUVLayout:e.target.value as 'materials'|'overlay'};setDraft(v);onChange(v);}}><option value="materials">按材质分框（默认，不改原 UV）</option><option value="overlay">所有材质叠加（仅诊断）</option></select></label>
    <small>分框偏移只用于对应动画与显示；不是把多张材质贴图合成一张。导出保留原坐标及材质分组。</small>
    <label>分区策略<select aria-label="Chart policy" value={draft.chartPolicy??'large'} onChange={e=>patch({chartPolicy:e.target.value as UnwrapOptions['chartPolicy']})}><option value="large">大块优先 · 连通分区 + 短路径开缝</option><option value="balanced">均衡 · 更严格的形变限制</option><option value="legacy">传统碎片化参数（回归对比）</option></select></label>
    <label>参数化<select aria-label="UV solver" value={draft.method} onChange={e=>patch({method:e.target.value as UnwrapOptions['method']})}><option value="auto">LSCM + 有效性检查 + Tutte 回退</option><option value="lscm">仅 LSCM（无效时补切或报错）</option><option value="tutte">凸边界 Tutte（稳健，拉伸较大）</option></select></label>
    <label className="check"><input type="checkbox" checked={draft.autoCut} onChange={e=>patch({autoCut:e.target.checked})}/> 允许必要的拓扑 / 形变补切</label>
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
    <label>形变控制的源表面积比例<input aria-label="Stretch area percentile" type="number" min="90" max="100" step=".1" value={(draft.stretchAreaPercentile??1)*100} onChange={e=>patch({stretchAreaPercentile:+e.target.value/100})}/></label>
    <small>99 表示允许最多 1% 表面积的微小细节超过软形变阈值，不因此反复切碎整岛；100 恢复最坏面控制。真实翻面、退化、交叠仍禁止。</small>
    <label>角形变阈值（奇异值比）<input type="number" min="1" max="1000" step="1" value={draft.maxStretch} onChange={e=>patch({maxStretch:+e.target.value})}/></label>
    <details><summary>区域与数值求解设置</summary>
      <label>区域法线锥角（度）<input type="number" min="1" max="178" value={draft.regionOptions?.normalConeDegrees??80} onChange={e=>patch({regionOptions:{...draft.regionOptions,normalConeDegrees:+e.target.value}})}/></label>
      <label>小区域表面积比<input type="number" min="0" max=".5" step=".005" value={draft.regionOptions?.minRegionAreaRatio??.01} onChange={e=>patch({regionOptions:{...draft.regionOptions,minRegionAreaRatio:+e.target.value}})}/></label>
      <small>这些区域设置在 Generate baseline 或无约束 UV 求解时生效；已经固定的接缝不会被“应用”偷偷删除。</small>
      <label>最大迭代<input type="number" min="1" max="20000" step="100" value={draft.iterations} onChange={e=>patch({iterations:+e.target.value})}/></label>
      <label>相对残差目标<input type="number" min="1e-12" max=".001" step="1e-9" value={draft.tolerance} onChange={e=>patch({tolerance:+e.target.value})}/></label>
      <label>岛 / 包围盒最小面积比<input type="number" min="0" max="1" step=".05" value={draft.minFill} onChange={e=>patch({minFill:+e.target.value})}/></label>
    </details>
    <div className="button-grid two"><button className="primary" onClick={()=>onChange({...draft})}>应用并重新展开</button><button onClick={()=>{setDraft({...DEFAULT_UNWRAP});onChange({...DEFAULT_UNWRAP});}}>恢复默认（固定参数）</button></div>
    {snapshot?.fragmentation&&<p>分裂来源：{snapshot.fragmentation.inputComponents} 个原几何连通分量 → {snapshot.fragmentation.initialCharts} 个初始区域 → {snapshot.fragmentation.outputCharts} 个最终岛；小于16面：{snapshot.fragmentation.tinyCharts}。<br/>补切原因：{Object.entries(snapshot.fragmentation.reasons).map(([k,v])=>`${k}: ${v}`).join(' · ')||'无'}。</p>}
    {snapshot?.metrics&&<div className="uv-quality-stats"><b>有效 UV 占用 {(snapshot.metrics.occupancy*100).toFixed(1)}%</b><span>包围盒占用 {(snapshot.metrics.boxOccupancy*100).toFixed(1)}%</span><span>{snapshot.addedSeams?.length??0} 条补切 · {snapshot.diagnostics?.filter(d=>d.method==='tutte').length??0} 个 Tutte 岛</span><span>实际排布：{snapshot.metrics.packingMethod??'MaxRects'}</span><span>生成 UV 已检查翻面、退化和正面积重叠</span></div>}
  </details>;
}
