import {message} from '../../../../packages/ui-platform/src/index.js';
import type {PeelReport,PackedChart} from '@meshtailor/uv';
/** Current chart identity comes from its immutable face membership, never a
 * stale island number after stitching/repacking. */
export function describeTube(peel:PeelReport|undefined,chart:PackedChart|undefined):string {
 if(!chart)return '';const contract=peel?.tubeContracts?.find(c=>chart.faceUVs.has(c.faces[0]!));if(!contract)return '';
 const report=peel?.tubeReports?.find(r=>peel.groups.find(g=>g.id===r.sourceChart)?.faces.includes(contract.faces[0]!));
 return message("闭合管身 · 矩形条带。当前片长/宽 {0}:1，来自中心轨迹弧长与横截面周长，不拉成正方形。{1}纵向和横向裁切均为真实网格边，原 UV 使用 0。",[(contract.length/contract.width).toFixed(2),report?message("{0} 个几何截面，{1} 片；最大方向拉伸比 {2}，面积密度 {3}–{4} 倍各片平均值。{5}",[report.rings,report.panels,report.maxStretch.toFixed(3),report.minAreaDensity.toFixed(3),report.maxAreaDensity.toFixed(3),report.budgetExpanded?message("单片面数预算增加了横向分段。"):'']):'']);
}
