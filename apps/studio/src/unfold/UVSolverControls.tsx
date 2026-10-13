import { message } from '../../../../packages/ui-platform/src/index.js';
import {describeSymmetrySummary} from './symmetry-description';
import {renderFillGrowth} from './fill-growth-panel';
import { useState, useEffect, useRef } from 'react';
import { DEFAULT_FILL_DENSITY_LIMIT, DEFAULT_HUMAN, DEFAULT_UNWRAP, type UnwrapOptions } from '@meshtailor/uv';
import {describeFillPresentation as describeFill} from './fill-description.js';
import {useDisplayPreferences} from '../platform/useDisplayPreferences.js';
import type { UVSnapshot } from '../workers/uv.worker';
function FillGrowthPanel({snapshot}:{snapshot:UVSnapshot|null}){
  const {locale}=useDisplayPreferences();
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(host.current)renderFillGrowth(host.current,snapshot?.packingReport?.refinement);},[snapshot,locale]);
  return <div ref={host} data-testid="fill-growth-report"/>;
}
/** Draft settings are applied together: dragging a control never launches dozens of solvers. */
export function UVSolverControls({value,onChange,snapshot,onAuto,onProcess,selectedCharts=[]}:{onProcess:(operation:'connected'|'stitch'|'repack'|'fill'|'templates',config:UnwrapOptions)=>void;onAuto:(goal:'large'|'balanced')=>void;value:UnwrapOptions;onChange:(v:UnwrapOptions)=>void;snapshot:UVSnapshot|null;selectedCharts?:number[]}){
  const [draft,setDraft]=useState(value),patch=(v:Partial<UnwrapOptions>)=>setDraft(d=>({...d,...v}));
  useEffect(()=>setDraft(value),[value]);
  return <details className="uv-solver-controls" open><summary>{message("UV 求解与排布")}</summary>
    <section className="paint-shape-controls">
      <label>{message("UV 目标")}<select aria-label={message("UV objective")} value={draft.uvObjective??'paint'} onChange={e=>patch({uvObjective:e.target.value as UnwrapOptions['uvObjective']})}><option value="paint">{message("手绘轮廓优先（默认）")}</option><option value="compact">{message("少岛稳健 · 旧圆边界回退")}</option></select></label>
      <small>{message("手绘模式保留主要平面凹口、齿形和孔洞；曲面使用自由边界。缝合优先保留当前生成岛轮廓，宁可留下合理的分片，不把有效形状强制挤成圆。不会自动识别衣片名称。")}</small>
      <label>{message("保形迭代预算")}<input aria-label={message("Paint iterations")} type="number" min="1" max="100" value={draft.paintIterations??24} onChange={e=>patch({paintIterations:+e.target.value})}/></label>
      <label>{message("缝合时原形比例变化上限")}<input aria-label={message("Merge shape limit")} type="number" min="1" max="4" step=".05" value={draft.mergeOptions?.maxShapeChange??1.5} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,maxShapeChange:+e.target.value}})}/></label>
      <small>{message("去除整体旋转/缩放后，按99%源表面积检查边长比例变化；1表示保留比例。仅控制当前生成岛的缝合，不使用模型原 UV。")}</small>
    </section>
    <details open className="peel-controls"><summary>{message("通用分组剥展 · 空间组与切缝分离")}</summary>
      <button className="primary" aria-label={message("Peel spatial groups")} onClick={()=>onProcess('connected',{...draft,initialSegmentation:'hierarchical',uvObjective:'paint',method:'auto',autoCut:true,postMerge:false})}>{message("空间分组 → 组内开缝 → 剥展")}</button>
      <label className="check"><input aria-label={message("Complete structural groups")} type="checkbox" checked={draft.structureGroups!==false} onChange={e=>patch({structureGroups:e.target.checked})}/>{message("完整主片／回折壁与双侧结构优先（默认）")}</label><small>{message("可靠镜像单元联合划线；未匹配部分不强制复制。原 UV 不参与生成。")}</small>
      <label className="check"><input aria-label={message("Surface symmetry")} type="checkbox" checked={draft.surfaceSymmetry!==false} onChange={e=>patch({surfaceSymmetry:e.target.checked})}/>{message("按表面识别并约束对称（默认）")}</label>
      <small>{message("在连续表面、边界和闭合折边上寻找对应；不要求左右网格相同。可靠闭合片先分层再展开；已开缝或识别不足的区域不强行镜像。新配置需重新生成才生效。")}</small>
      <details><summary>{message("表面对称数值设置")}</summary>
        <label>{message("几何匹配容差 % 部件直径")}<input aria-label={message("Surface symmetry tolerance")} type="number" min=".1" max="6" step=".1" value={(draft.symmetryTolerance??.018)*100} onChange={e=>patch({symmetryTolerance:+e.target.value/100})}/></label>
        <label>{message("对称约束强度")}<input aria-label={message("Surface symmetry strength")} type="number" min="1" max="200" value={draft.symmetryStrength??30} onChange={e=>patch({symmetryStrength:+e.target.value})}/></label>
        <label>{message("对称松弛迭代")}<input aria-label={message("Surface symmetry iterations")} type="number" min="1" max="100" value={draft.symmetryIterations??40} onChange={e=>patch({symmetryIterations:+e.target.value})}/></label>
        <small>{message("增大容差可能误认近似结构；最终仍须通过镜像误差、形变、边界和全图交叠检查。")}</small>
      </details>
      {snapshot&&<p data-testid="surface-symmetry-summary">{describeSymmetrySummary(snapshot.diagnostics,snapshot.peel)}</p>}
      <label>{message("结构片内在尺寸松弛迭代")}<input aria-label={message("Structural relaxation iterations")} type="number" min="0" max="100" value={draft.structuralRelaxIterations??60} onChange={e=>patch({structuralRelaxIterations:+e.target.value})}/></label><small>{message("根据三维边长展开肩部／腰部，不让数值有效的共形种子提前结束；0 可对照关闭。")}</small>
      <label>{message("主要平面特征最小总面积 %")}<input aria-label={message("Peel feature area")} type="number" min=".1" max="25" step=".1" value={(draft.peelFeatureArea??.015)*100} onChange={e=>patch({peelFeatureArea:+e.target.value/100})}/></label>
      <label>{message("几何折角阈值（度）")}<input aria-label={message("Group feature degrees")} type="number" min="20" max="100" value={draft.groupFeatureDegrees??48} onChange={e=>patch({groupFeatureDegrees:+e.target.value})}/></label>
      <label>{message("切缝图割搜索环数")}<input aria-label={message("Seam band rings")} type="number" min="1" max="12" value={draft.seamBandRings??5} onChange={e=>patch({seamBandRings:+e.target.value})}/></label>
      <small>{message("先保持完整空间连通组和主要面板，不按小附件的三角形数量切碎。投影只是种子；重叠时先开缝/自由边界松弛，失败才连通二分。不是人体或齿轮专用分类器。")}</small>
      {snapshot?.peel&&<div data-testid="peel-report"><b>{snapshot.peel.groups.length}{" "+message("空间组 →")+" "}{snapshot.peel.totalIslands}{" "+message("个实际 UV 岛")}</b><p>{message("反馈细分")+" "}{snapshot.peel.feedbackSplits}{" "+message("次 · 原 UV 使用 0")}</p><details><summary>{message("分组与结果对应")}</summary>{snapshot.peel.groups.map(g=><small key={g.id}>{message("组")+" "}{g.id+1} · {g.kind} · {g.faces.length}{" "+message("面 →")+" "}{g.charts.map(i=>'#'+(i+1)).join(', ')}<br/></small>)}</details></div>}
    </details>
    <details open className="human-template-controls"><summary>{message("结构模板 · 人工切缝思路")}</summary>
      <label className="check"><input aria-label={message("Structural UV templates")} type="checkbox" checked={draft.structureTemplates!==false} onChange={e=>patch({structureTemplates:e.target.checked})}/>{message("先识别环带，再规划侧缝（默认）")}</label>
      <label className="check"><input aria-label={message("Closed tube strips")} type="checkbox" checked={draft.closedTubeStrips!==false} onChange={e=>patch({closedTubeStrips:e.target.checked})}/>{message("闭合管身：纵缝＋横断面 → 矩形条带（默认）")}</label>
      <label>{message("闭合管身横向分段")}<input aria-label={message("Closed tube panels")} type="number" min="1" max="64" value={draft.closedTubePanels??1} onChange={e=>patch({closedTubePanels:+e.target.value})}/></label>
      <small>{message("1 保留一整条；增加分段会新增横向切缝，可更紧凑装入方形 UV 页。长宽来自真实管长/周长，不能把长管压成正方形。只处理完整、可验证的周期截面族；非管状区域不强制矩形化。修改后重新生成；填空不会新增这些切缝。")}</small>
      <label>{message("闭合管身最大方向拉伸比")}<input aria-label={message("Closed tube maximum stretch")} type="number" min="1.05" max="8" step=".1" value={draft.closedTubeMaxStretch??4} onChange={e=>patch({closedTubeMaxStretch:+e.target.value})}/></label>
      <label className="check"><input aria-label={message("Preserve complete rim")} type="checkbox" checked={draft.preserveRimBands!==false} onChange={e=>patch({preserveRimBands:e.target.checked})}/>{message("完整侧边独立展开，不混入两张端面")}</label>
      <label className="check"><input aria-label={message("Revolved profile metric")} type="checkbox" checked={draft.humanTemplates?.revolvedProfiles!==false} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,revolvedProfiles:e.target.checked}})}/>{message("重复截面度量：直筒/倒角侧壁保宽，径向环件保孔")}</label>
      <p className="hint">{message("先验证真实截面与剖面连接；不将锥面、齿面或任意曲面强制拉方。不读取原 UV。")}</p>
      <label>{message("环带切法")}<select aria-label={message("Band panels")} value={draft.humanTemplates?.panels??'auto'} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,panels:e.target.value==='auto'?'auto':+e.target.value as 1|2}})}><option value="auto">{message("自动 · 完整一片优先")}</option><option value="2">{message("指定两侧切缝 · 两片")}</option><option value="1">{message("单纵缝 · 整圈一片")}</option></select></label>
      <label>{message("上下轴")}<select aria-label={message("Band axis")} value={draft.humanTemplates?.axis??'auto'} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,axis:e.target.value as typeof DEFAULT_HUMAN.axis}})}><option value="auto">{message("自动：上下边界环")}</option><option value="x">{message("X")}</option><option value="y">{message("Y")}</option><option value="z">{message("Z")}</option></select></label>
      <label>{message("侧缝方向（度）")}<input aria-label={message("Band seam angle")} type="number" min="-180" max="180" step="5" value={draft.humanTemplates?.seamAngleDegrees??0} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,seamAngleDegrees:+e.target.value}})}/></label>
      <label>{message("自动处理最小表面积占比（%）")}<input aria-label={message("Band minimum area")} type="number" min="0" max="25" step=".1" value={(draft.humanTemplates?.minAreaFraction??.005)*100} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,minAreaFraction:+e.target.value/100}})}/></label>
      <label>{message("最大三角面形变比")}<input aria-label={message("Band maximum stretch")} type="number" min="1.1" max="20" step=".1" value={draft.humanTemplates?.maxAnisotropy??4} onChange={e=>patch({humanTemplates:{...draft.humanTemplates,maxAnisotropy:+e.target.value}})}/></label>
      <button aria-label={message("Template selected islands")} disabled={!snapshot||!selectedCharts.length} onClick={()=>onProcess('templates',{...draft,structureTemplates:true,uvObjective:'paint',method:'auto',autoCut:true,humanTemplates:{...draft.humanTemplates,selectedCharts:[...selectedCharts]}})}>{message("仅按模板重展所选岛")}</button>
      <small>{message("只重解显式选中的相连区域，其他岛保留形状并重排。改变已分成两片的环带时请同时选中两片。上下边界/侧缝不被后续缝合抹掉；当前视角不参与求解。修改参数后需执行，几何生成与只重排不会运行模板。")}</small>
      {snapshot?.human&&<div data-testid="human-template-report" className="uv-quality-stats"><b>{message("结构模板应用")+" "}{snapshot.human.applied}{" "+message("区域")}</b>{snapshot.human.entries.filter(e=>e.status!=='skipped').map((e,i)=><span key={i}>{message("源 #")}{e.sourceChart+1} · {e.status==='applied'?message("{0} → {1} · 最大形变 {2}",[e.template??'—',e.charts?.map(id=>'#'+(id+1)).join(' / ')??'—',e.maxAnisotropy?.toFixed(2)??'—']):e.reason}</span>)}</div>}
    </details>
    <div className="button-grid two"><button className="primary" aria-label={message("Auto large charts")} onClick={()=>onAuto('large')}>{message("自动参数 · 大块重分割")}</button><button aria-label={message("Auto balanced charts")} onClick={()=>onAuto('balanced')}>{message("自动参数 · 均衡")}</button></div>
    <small>{message("分析当前几何并填写参数，替换当前裁切方案、重新生成 UV；不读取原 UV，不从原接缝推断分组。不是在保持贴图布局的前提下合并。")}</small>
    <details open><summary>{message("减少碎岛 · 前处理 / 后处理")}</summary>
      <button className="primary" aria-label={message("Connected first unwrap")} onClick={()=>onProcess('connected',{...draft,initialSegmentation:'connected',postMerge:true})}>{message("前处理：连通优先重分割 + 自动缝合")}</button>
      <small>{message("先尝试完整几何连通块与必要开缝，无法通过有效性 / 形变检查才拆分；随后尝试合并相邻岛。会替换当前裁切方案。")}</small>
      <div className="button-grid two"><button disabled={!snapshot} aria-label={message("Stitch current islands")} onClick={()=>onProcess('stitch',draft)}>{message("后处理：缝合当前邻岛")}</button><button disabled={!snapshot} aria-label={message("Repack current islands")} onClick={()=>onProcess('repack',draft)}>{message("只重排当前岛")}</button></div>
      <small>{message("缝合 = 移除共享接缝并重新求解；只重排 = 岛数不变，消除岛间叠放。当前生成 UV 保留在快照中；新 atlas 需要重烘焙，原岛内部折叠不能靠重排修好。")}</small>
      <label>{message("新 UV 页分配")}<select aria-label={message("Atlas page mode")} value={draft.atlasPageMode??'single'} onChange={e=>patch({atlasPageMode:e.target.value as UnwrapOptions['atlasPageMode']})}><option value="single">{message("单页（默认）")}</option><option value="adjacency">{message("连接紧密的岛优先同页")}</option><option value="components">{message("每个几何连通组一页")}</option><option value="spatial">{message("空间邻近 + 共享边优先同页")}</option></select></label>
      <label>{message("目标页数（软目标）")}<input aria-label={message("Atlas page count")} type="number" min="1" max="64" value={draft.atlasPageCount??2} onChange={e=>patch({atlasPageCount:+e.target.value})}/></label>
      <small>{message("仅对新 atlas 生效，不按材质编号分页；空间模式允许近但断开的部件成为关联组；关联不等于缝合。实际页数可能更多。源材质分框不是此处的新页面。")}</small>
      <label className="check"><input aria-label={message("Post merge generated charts")} type="checkbox" checked={draft.postMerge??false} onChange={e=>patch({postMerge:e.target.checked})}/>{message("生成后自动尝试邻岛缝合")}</label>
      <label>{message("缝合尝试预算")}<input aria-label={message("Merge attempts")} type="number" min="0" max="2000" placeholder={message("自动：128–512")} value={draft.mergeOptions?.maxAttempts??''} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,maxAttempts:e.target.value===''?undefined:+e.target.value}})}/></label>
      <small>{message("尝试预算留空：按初始岛数 × 3 自动设置，范围 128–512；手动输入优先。闭环接口优先保留必要开缝，不强制删除整圈。")}</small>
      <label className="check"><input aria-label={message("Reuse valid UV shapes")} type="checkbox" checked={draft.mergeOptions?.reuseValidUV!==false} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,reuseValidUV:e.target.checked}})}/>{message("允许保留形状缝合（手绘模式优先）")}</label><small>{message("沿真实共享边对齐现有 UV；保留必要开缝，限制两岛平均密度差不超过 25%，仍检查重叠与形变。不因空间靠近而焊接。")}</small>
      <label>{message("目标岛数（不牺牲有效性）")}<input aria-label={message("Merge target")} type="number" min="1" value={draft.mergeOptions?.targetCharts??1} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,targetCharts:+e.target.value}})}/></label>
      <label className="check"><input aria-label={message("Preserve material boundaries")} type="checkbox" checked={draft.mergeOptions?.respectMaterials??false} onChange={e=>patch({mergeOptions:{...draft.mergeOptions,respectMaterials:e.target.checked}})}/>{message("后处理不跨源材质边界缝合")}</label>
    </details>
    <details open className="uv-fill-controls"><summary>{message("空白精排 · 大岛优先")}</summary>
      <button className="primary" aria-label={message("Refine current atlas")} disabled={!snapshot?.metrics?.validated} onClick={()=>onProcess('fill',{...draft,fillMode:draft.fillMode==='uniform'?'uniform':'area-priority'})}>{draft.fillRecutLarge?message("填补空白 + 大岛旧切缝试验"):message("填补空白（保留当前岛 / 切缝）")}</button>
      <FillGrowthPanel snapshot={snapshot}/>
      <label>{message("精排模式")}<select aria-label={message("Fill mode")} value={draft.fillMode==='uniform'?'uniform':'area-priority'} onChange={e=>patch({fillMode:e.target.value as UnwrapOptions['fillMode']})}><option value="area-priority">{message("从大到小逐岛扩张")}</option><option value="uniform">{message("全岛共同放大（保持密度比例）")}</option></select></label>
      <div className="button-grid two"><button aria-label={message("Balanced density preset")} onClick={()=>patch({fillMaxAreaGain:1.6})}>{message("密度均衡 · 1.6 倍")}</button><button aria-label={message("Bounded growth preset")} onClick={()=>patch({fillMaxAreaGain:DEFAULT_FILL_DENSITY_LIMIT,fillFitVacancies:true})}>{message("有界放大 · 3 倍")}</button></div>
      <label className="check"><input aria-label={message("Fit enlargement to vacant space")} type="checkbox" checked={draft.fillFitVacancies!==false} onChange={e=>patch({fillFitVacancies:e.target.checked})}/>{message("按空位容量放大岛（仍遵守面积密度上限）")}</label>
      <small>{message("新默认允许最大 / 最小面积密度差 3 倍，优先大岛，放不下再处理小岛。保留 1.6 倍可对照旧限制；切换预设不立即计算，也不缩小现有岛。")}</small>
      <label>{message("每步面积增量 %")}<input aria-label={message("Fill step")} type="number" min=".5" max="25" step=".5" value={(draft.fillStep??.08)*100} onChange={e=>patch({fillStep:+e.target.value/100})}/></label>
      <label>{message("相对密度差上限（不限制共同放大）")}<input aria-label={message("Fill area cap")} type="number" min="1" max="3" step=".1" value={draft.fillMaxAreaGain??DEFAULT_FILL_DENSITY_LIMIT} onChange={e=>patch({fillMaxAreaGain:+e.target.value})}/></label>
      <label className="check"><input aria-label={message("Cavity-directed fill")} type="checkbox" checked={draft.fillCavitySearch!==false} onChange={e=>patch({fillCavitySearch:e.target.checked})}/>{message("扫描真实空洞，允许等面积搬移后继续扩张")}</label>
      <label>{message("每岛每轮连续增长步数")}<input aria-label={message("Fill growth steps")} type="number" min="1" max="16" value={draft.fillGrowthSteps??4} onChange={e=>patch({fillGrowthSteps:+e.target.value})}/></label>
      <label>{message("共同面积放大上限")}<input aria-label={message("Fill common gain limit")} type="number" min="1" max="16" step=".5" value={draft.fillCommonGainLimit??4} onChange={e=>patch({fillCommonGainLimit:+e.target.value})}/></label>
      <label>{message("补充旋转步长")}<select aria-label={message("Fill rotation step")} value={draft.fillRotationStep??45} onChange={e=>patch({fillRotationStep:+e.target.value as 15|30|45|90})}><option value="90">{message("90°（快速）")}</option><option value="45">45°</option><option value="30">30°</option><option value="15">{message("15°（更慢）")}</option></select></label>
      <label>{message("允许前方大岛重新排布次数")}<input aria-label={message("Fill reflow budget")} type="number" min="0" max="64" value={draft.fillReflowBudget??4} onChange={e=>patch({fillReflowBudget:+e.target.value})}/></label>
      <small>{message("直角与补充方向共同比较；空洞扫描可先搬移，再继续增长。空间被前面大岛锁住时有限重排。共同放大与岛间密度差分开限制，小岛不缩水。报告明确剩余未尝试岛与停止原因。")}</small>
      <label>{message("最小面积步长 %")}<input aria-label={message("Fill minimum step")} type="number" min=".1" max="5" step=".1" value={(draft.fillMinStep??.005)*100} onChange={e=>patch({fillMinStep:+e.target.value/100})}/></label>
      <label>{message("最大轮数")}<input aria-label={message("Fill rounds")} type="number" min="1" max="24" value={draft.fillRounds??8} onChange={e=>patch({fillRounds:+e.target.value})}/></label>
      <label>{message("轮廓搜索网格")}<select aria-label={message("Fill resolution")} value={draft.fillResolution??512} onChange={e=>patch({fillResolution:+e.target.value})}><option value="256">{message("256（快速 / 保守）")}</option><option value="512">{message("512（默认）")}</option><option value="1024">{message("1024（更细 / 更慢）")}</option></select></label>
      <label>{message("精排搜索预算（秒）")}<input aria-label={message("Fill budget")} type="number" min="1" max="120" value={(draft.fillTimeBudgetMs??15000)/1000} onChange={e=>patch({fillTimeBudgetMs:+e.target.value*1000})}/></label>
      <small>{message("不缩小其他岛腾空间，不拉伸宽高。8% 面积增量约为 3.9% 边长；默认岛间密度差上限 3 倍，共同放大另限 4 倍。轮廓栅格可利用凹口，但不保证最优。仅支持有效单页；生成无重叠 UV 后再精排。可在预算停止后继续精排，不会无界累积大岛密度。")}</small>
      {snapshot?.packingReport?.refinement&&<div role="status" data-testid="fill-report"><p>{describeFill(snapshot.packingReport.refinement)}</p>{snapshot.packingReport.refinement.recut&&<small>{message("大岛旧切缝试验：")}{snapshot.packingReport.refinement.recut.trials}{" "+message("个候选，")}{snapshot.packingReport.refinement.recut.accepted?message("接受一次切分"):message("未接受，原岛保留")}。</small>}<small>{message("可检查形状 / 切缝的岛：")}{snapshot.packingReport.refinement.shapeWaste.slice(0,5).map(c=>message("#{0}（轮廓/框 {1}%）",[c.id+1,(c.shapeFill*100).toFixed(0)])).join('、')}{message("。只是诊断，不会自动再切。")}</small></div>}
    </details>
    <details open><summary>{message("面积与空间邻居")}</summary>
      <small>{message("无重叠不等于可辨识：当前生成 UV 将主要平面特征拉成陌生轮廓时，局部重新分组和剥展。其余有效原岛保留。不按模型名称识别；几何生成、只重排与填空不重解形状。")}</small>
      {snapshot?.features&&<div data-testid="source-feature-report" role="status" className="uv-quality-stats"><b>{message("当前生成 UV 可辨识性：检查")+" "}{snapshot.features.detectedPanels}{" "+message("个主要平面特征，重展")+" "}{snapshot.features.changedCharts}{" "+message("个原岛")}</b><span>{snapshot.features.before}{" "+message("个源岛 →")+" "}{snapshot.features.after}{" "+message("个结果岛（缝合后）")}</span><details><summary>{message("特征组与 UV 对应")}</summary>{snapshot.features.regions.map((g,i)=><small key={i}>{message("原 #")}{g.sourceChart+1} · {g.kind} · {g.faces.length}{" "+message("面 →")+" "}{g.charts.map(id=>'#'+(id+1)).join(', ')}<br/></small>)}</details></div>}
      <small>{message("仅重新求解含内部重叠、混合翻面或退化的岛；其余通过轮廓检查的岛保留形状。失败不返回部分 atlas，几何生成永不改坐标。")}</small>
      <label>{message("放置顺序")}<select aria-label={message("Packing order")} value={draft.packingOrder??'area'} onChange={e=>patch({packingOrder:e.target.value as UnwrapOptions['packingOrder']})}><option value="area">{message("3D 面积由大到小（默认）")}</option><option value="legacy">{message("旧长边 / 包围盒启发式")}</option></select></label>
      <label>{message("小岛目标面积占比（%）")}<input aria-label={message("Tiny area fraction")} type="number" min="0" max="10" step=".01" value={(draft.tinyIslandAreaFraction??0)*100} onChange={e=>patch({tinyIslandAreaFraction:+e.target.value/100})}/></label>
      <label>{message("小岛面积放大上限")}<input aria-label={message("Tiny area cap")} type="number" min="1" max="4" step=".1" value={draft.maxTinyAreaBoost??1} onChange={e=>patch({maxTinyAreaBoost:+e.target.value})}/></label>
      <small>{message("默认 0 / 1：严格统一平均面积密度。面积上限 2 倍时边长最多 √2 倍。所有岛共同缩放，不独立压扁 U/V。")}</small>
      <label className="check"><input aria-label={message("Spatial neighbors")} type="checkbox" checked={draft.spatialNeighbors??true} onChange={e=>patch({spatialNeighbors:e.target.checked})}/>{message("用 3D 空间邻居辅助排布")}</label>
      <label>{message("邻近距离（模型最长边 %）")}<input aria-label={message("Neighbor distance")} type="number" min="0" max="20" step=".1" value={(draft.neighborDistanceRatio??.02)*100} onChange={e=>patch({neighborDistanceRatio:+e.target.value/100})}/></label>
      <small>{message("近邻只是空间关联，不能直接证明两面可缝合。表面采样会漏检；预算截断会明确报告。")}</small>
    </details>
    {snapshot?.areaAudit&&<div role="status" className="uv-quality-stats"><b>{message("当前")+" "}{snapshot.packed.length}{" "+message("岛 /")+" "}{snapshot.spatialReport?.groups.length??'?'}{" "+message("个空间关联组")}</b><span>{message("平均面积密度异常：偏大")+" "}{snapshot.areaAudit.oversized.length}{message("，偏小")+" "}{snapshot.areaAudit.undersized.length}{message("。选岛可看具体比例与邻居。")}</span><span>{snapshot.target==='source'?message("原样视图未修正面积或重叠。"):message("当前为新 atlas；原输入的重叠报告仅供对照。")}</span></div>}
    {snapshot?.sourceAudit&&<div role="status" className="uv-quality-stats"><b>{message("原输入 UV 岛数：")}{snapshot.sourceAudit.domains.reduce((n,d)=>n+d.islands,0)}{message("（不按可见轮廓计数）")}</b>{snapshot.sourceAudit.domains.map(d=><span key={d.id}>{d.name} · {d.islands}{" "+message("岛 ·")+" "}{d.overlapCountCapped?message("至少 "):''}{d.overlapPairs}{" "+message("对正面积重叠 ·")+" "}{d.degenerate}{" "+message("退化面")}</span>)}<small>{message("重叠可能是有意复用；需要唯一新 atlas 时使用前处理或后处理。“几何生成”只读取；“Extract + 整理”生成新 atlas，但保留原始输入。")}</small></div>}
    {snapshot?.repair&&<div role="status" className="uv-quality-stats"><b>{message("原岛局部修复：")}{snapshot.repair.repaired} / {snapshot.repair.inspected}</b><span>{snapshot.repair.islands.map(i=>message("原岛 #{0} · {1} 面 · {2}",[i.id+1,i.faces,i.method])).join('；')||message("无需修复")}</span><span>{message("其余")+" "}{snapshot.repair.preserved}{" "+message("岛通过有效性检查（仍须检查轮廓，后续可验证缝合），源数据未修改。")}</span></div>}
    {snapshot?.merge&&<div role="status" className="uv-quality-stats"><b>{message("邻岛缝合：")}{snapshot.merge.before} → {snapshot.merge.after}{" "+message("岛")}</b><span>{message("接受")+" "}{snapshot.merge.accepted}{" "+message("次 / 求解尝试")+" "}{snapshot.merge.attempts} / {snapshot.merge.attemptBudget??'?'}{" "+message("次 · 移除")+" "}{snapshot.merge.removedSeams.length}{" "+message("条接缝")}</span><span>{message("保留开缝连接")+" "}{snapshot.merge.partialJoins??0}{" "+message("次 · 保留形状缝合")+" "}{snapshot.merge.rigidJoins??0}{" "+message("次 · 拒绝原因：")}{JSON.stringify(snapshot.merge.reasons)}</span><span>{snapshot.merge.budgetExhausted?message("已达预算，可提高预算或对当前结果继续缝合。"):message("未强行合并不能通过检查的区域。")}</span></div>}
    {snapshot?.pageReport&&<p>{message("新 atlas：")}{snapshot.pageReport.actual}{" "+message("页 · 同页保留")+" "}{(100*snapshot.pageReport.retainedSharedBoundaryRatio).toFixed(1)}{message("% 的共享边界长度；使用统一纹素密度。每页占用率见诊断 JSON。")}</p>}
    <small>{message("分框偏移只用于对应动画与显示；不是把多张材质贴图合成一张。导出保留原坐标及材质分组。")}</small>
    <label>{message("分区策略")}<select aria-label={message("Chart policy")} value={draft.chartPolicy??'large'} onChange={e=>patch({chartPolicy:e.target.value as UnwrapOptions['chartPolicy']})}><option value="large">{message("大块优先 · 连通分区 + 短路径开缝")}</option><option value="balanced">{message("均衡 · 更严格的形变限制")}</option><option value="legacy">{message("传统碎片化参数（回归对比）")}</option></select></label>
    <label>{message("参数化")}<select aria-label={message("UV solver")} value={draft.method} onChange={e=>patch({method:e.target.value as UnwrapOptions['method']})}><option value="auto">{message("自动（按当前 UV 目标）")}</option><option value="lscm">{message("仅 LSCM（无效时补切或报错）")}</option><option value="tutte">{message("强制圆边界 Tutte（诊断用）")}</option></select></label>
    <label className="check"><input type="checkbox" checked={draft.autoCut} onChange={e=>patch({autoCut:e.target.checked})}/>{" "+message("允许必要的拓扑 / 形变补切")}</label>
    <small>{message("关闭后严格保留输入接缝；无法有效求解时明确报错。所有补切都会在 3D / UV 中显示。")}</small>
    <label>{message("UV 留白（每侧）")}<input type="number" min="0" max=".05" step=".001" value={draft.padding} onChange={e=>patch({padding:+e.target.value})}/></label>
    <label className="check"><input type="checkbox" checked={draft.rotate} onChange={e=>patch({rotate:e.target.checked})}/>{" "+message("允许旋转排布（不拉伸岛的宽高）")}</label>
    <label>{message("排布策略")}<select aria-label={message("UV packing")} value={draft.packing??'auto'} onChange={e=>patch({packing:e.target.value as UnwrapOptions['packing']})}>
      <option value="auto">{message("自动：小岛数 MaxRects / 大岛数 Shelf")}</option><option value="maxrects">{message("MaxRects（最多 1024 岛）")}</option><option value="shelf">{message("Shelf 面积感知快速排布")}</option>
    </select></label>
    <small>{message("自动模式超过 256 个岛改用 Shelf；不改变裁切线、留白或统一纹素密度。排布空隙可能不同。")}</small>
    <label>{message("UV 任务预算（秒）")}<input aria-label={message("UV time budget")} type="number" min="5" max="900" step="5" value={(draft.timeBudgetMs??120000)/1000} onChange={e=>patch({timeBudgetMs:+e.target.value*1000})}/></label>
    <label>{message("单岛面数预算")}<input type="number" min="8" max="20000" step="128" value={draft.maxChartFaces} onChange={e=>patch({maxChartFaces:+e.target.value})}/></label>
    <label>{message("长宽比补切阈值")}<input type="number" min="1" max="100" step=".5" value={draft.maxAspect} onChange={e=>patch({maxAspect:+e.target.value})}/></label>
    <label>{message("形变控制的源表面积比例")}<input aria-label={message("Stretch area percentile")} type="number" min="90" max="100" step=".1" value={(draft.stretchAreaPercentile??1)*100} onChange={e=>patch({stretchAreaPercentile:+e.target.value/100})}/></label>
    <small>{message("99 表示允许最多 1% 表面积的微小细节超过软形变阈值，不因此反复切碎整岛；100 恢复最坏面控制。真实翻面、退化、交叠仍禁止。")}</small>
    <label>{message("角形变阈值（奇异值比）")}<input type="number" min="1" max="1000" step="1" value={draft.maxStretch} onChange={e=>patch({maxStretch:+e.target.value})}/></label>
    <details><summary>{message("区域与数值求解设置")}</summary>
      <label>{message("区域法线锥角（度）")}<input type="number" min="1" max="178" value={draft.regionOptions?.normalConeDegrees??80} onChange={e=>patch({regionOptions:{...draft.regionOptions,normalConeDegrees:+e.target.value}})}/></label>
      <label>{message("小区域表面积比")}<input type="number" min="0" max=".5" step=".005" value={draft.regionOptions?.minRegionAreaRatio??.01} onChange={e=>patch({regionOptions:{...draft.regionOptions,minRegionAreaRatio:+e.target.value}})}/></label>
      <small>{message("这些区域设置在 Generate baseline 或无约束 UV 求解时生效；已经固定的接缝不会被“应用”偷偷删除。")}</small>
      <label>{message("最大迭代")}<input type="number" min="1" max="20000" step="100" value={draft.iterations} onChange={e=>patch({iterations:+e.target.value})}/></label>
      <label>{message("相对残差目标")}<input type="number" min="1e-12" max=".001" step="1e-9" value={draft.tolerance} onChange={e=>patch({tolerance:+e.target.value})}/></label>
      <label>{message("岛 / 包围盒最小面积比")}<input type="number" min="0" max="1" step=".05" value={draft.minFill} onChange={e=>patch({minFill:+e.target.value})}/></label>
    </details>
    <div className="button-grid two"><button className="primary" onClick={()=>onChange({...draft})}>{message("应用并重新展开")}</button><button onClick={()=>{setDraft({...DEFAULT_UNWRAP});onChange({...DEFAULT_UNWRAP});}}>{message("恢复默认（固定参数）")}</button></div>
    {snapshot?.diagnostics&&<p data-testid="shape-methods">{message("实际方法：")}{Object.entries(snapshot.diagnostics.reduce((a,d)=>(a[d.method]=(a[d.method]??0)+1,a),{} as Record<string,number>)).map(([k,n])=>`${k}: ${n}`).join(' · ')}{message("。source-shape 为保留原形，planar-shape 为平面轮廓，arap-free 为自由边界。")}</p>}
    {snapshot?.fragmentation&&<p>{message("分裂来源：")}{snapshot.fragmentation.inputComponents}{" "+message("个原几何连通分量 →")+" "}{snapshot.fragmentation.initialCharts}{" "+message("个初始区域 →")+" "}{snapshot.fragmentation.outputCharts}{" "+message("个最终岛；小于16面：")}{snapshot.fragmentation.tinyCharts}。<br/>{message("补切原因：")}{Object.entries(snapshot.fragmentation.reasons).map(([k,v])=>`${k}: ${v}`).join(' · ')||message("无")}。</p>}
    {snapshot?.metrics&&<div className="uv-quality-stats"><b>{message("有效 UV 占用")+" "}{(snapshot.metrics.occupancy*100).toFixed(1)}%</b><span>{message("包围盒面积总和")+" "}{(snapshot.metrics.boxOccupancy*100).toFixed(1)}{message("%（可互相覆盖）")}</span><span>{snapshot.addedSeams?.length??0}{" "+message("条补切 ·")+" "}{snapshot.diagnostics?.filter(d=>d.method==='tutte').length??0}{" "+message("个 Tutte 岛")}</span><span>{message("实际排布：")}{snapshot.metrics.packingMethod??'MaxRects'}</span><span>{message("生成 UV 已检查翻面、退化和正面积重叠")}</span></div>}
  </details>;
}
