import {message} from '../../../../packages/ui-platform/src/index';
import type {PeelGroup,HumanTemplateEntry} from '@meshtailor/uv';
/** Shared wording for the React inspector and the offline production workbench. */
export function describeStructure(group:PeelGroup|undefined):string {
 if(!group?.structureReason)return'';
 if(group.kind==='cap-rim')return message("完整闭合部件 {0} 面：按两条真实折边区分正反端面与完整环形侧边。当前为{1}。不移动源顶点，不读取原 UV。",[group.componentFaceCount??'',group.structureRole==='rim'?message("连续侧边：先尝试一条开缝、整圈一片"):message("完整端面：不是把周长切成一半")]);
 if(group.kind==='continuous-band')return message("两条边界之间的完整连续表面：先保持空间组完整，再决定一条开缝是否足够；不会预先分成两个角度区间。");
 const role=group.kind==='longitudinal-panels'?message("纵向结构面板 · 沿完整折边开口、保持端盖"):group.kind==='symmetric-sheet'?message("完整表面对称层片 · 沿共有几何边缘分开"):group.kind==='closed-shell'?(group.openingEdges?.length?message("回折孔壁 · 连续开缝"):message("透孔主片 · 保留 {0} 个孔",[(group.structureBoundaryLoops??1)-1])):message("双侧结构 / 窄连接片");
 const s=group.symmetry,p=group.pairedOpening;
 return message("{0}。{1}{2}纯几何生成，原 UV 不参与。",[role,s?message("本结构镜像对应覆盖 {0}%；已对应 {1} 面，分组冲突 {2} 面，异对角线单元 {3} 组。未匹配区域不宣称对称。",[(s.coverage*100).toFixed(1),s.matchedFaces,s.mismatchedFaces,s.diagonalCells]):'',p?message("对应侧缝 {0}/{1} 条真实网格边；镜像曲线最大距离 {2}% 原侧缝长度。",[p.sourceEdges,p.targetEdges,(p.relativeDeviation*100).toFixed(2)]):'']);
}

/** Exposes the accepted decision, not a claim inferred from the island count. */
export function describeBandPartition(e:HumanTemplateEntry|undefined):string {
 if(!e||e.status!=='applied')return '';
 const panels=e.plannedPanels??e.charts?.length??1;
 const metric=e.metric;
 if(metric){
  const geometry=metric.mapping==='rectangle'?message("重复截面度量：{0} 层完整截面，沿周向宽度一致；按真实剖面弧长/半径计算矩形，长宽比 {1}:1",[metric.sections,((metric.stripLength??1)/(metric.stripWidth??1)).toFixed(3)]):message("保孔环形：{0} 层完整截面，保留内外两圈边界，不增加径向切缝；厚度回折按实际剖面弧长展平",[metric.sections]);
  return message("{0}。{1} 面 → {2} 岛；最大局部方向拉伸比 {3}。不是无形变承诺；后续仅允许整体旋转、移动和等比例缩放。",[geometry,e.faces,panels,metric.maxStretch.toFixed(3)]);
 }
 const why=e.requestedPanels==='auto'?(e.budgetExpanded?message("完整片超过每岛面数预算，增加同向开缝"):panels===1?message("完整一片已通过边界、翻面、重叠和形变检查，无需第二条缝"):message("完整一片候选未通过质量检查，改用两片")): message("用户指定 {0} 片",[e.requestedPanels??panels]);
 return message("裁片决策：{0}。{1} 个面 → {2} 个 UV 岛；{3} 条真实切边。",[why,e.faces,panels,e.seamEdges?.length??0]);
}
