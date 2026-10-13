import {message} from '../../../../packages/ui-platform/src/index.js';
import {auditUVReflection, type ChartDiagnostic, type PackedChart, type PeelReport} from '@meshtailor/uv';
import type {Vec2} from '@meshtailor/mesh-core';
const audits=new WeakMap<PackedChart,{contract:NonNullable<PeelReport['surfaceContracts']>[number];value:ReturnType<typeof auditUVReflection>}>();
/** Shared status text; after fill/repack evaluate the current coordinates rather
 * than merely quoting the solver's old success label. */
export function describeSurfaceSymmetry(diagnostic:ChartDiagnostic|undefined,chart:PackedChart|undefined,peel:PeelReport|undefined):string {
 if(!chart)return '';
 const contract=peel?.surfaceContracts?.find(c=>c.faces.every(f=>chart.faceUVs.has(f)));
 let audit=diagnostic?.symmetry?.after;
 if(contract&&audits.get(chart)?.contract===contract)audit=audits.get(chart)!.value;
 else if(contract){const coords:Vec2[]=[],triangles:[number,number,number][]=[];const ids=new Map<number,number>();
  contract.faces.forEach((f,i)=>{ids.set(f,i);triangles.push([coords.length,coords.length+1,coords.length+2]);coords.push(...chart.faceUVs.get(f)!);});
  audit=auditUVReflection({triangles},coords,contract.pairs.map(p=>({...p,a:{...p.a,face:ids.get(p.a.face)!},b:{...p.b,face:ids.get(p.b.face)!}})));
  audits.set(chart,{contract,value:audit});
 }
 const s=contract?.surface??diagnostic?.symmetry?.surface;
 if(!s)return message("本岛未建立可靠的表面对称约束；不代表几何一定不对称。已开切口、复杂连接或证据不足的区域不会强制镜像。");
 const rejected=!contract&&diagnostic?.symmetry?.status==='rejected';
 return message("{0} 表面采样匹配 {1}%，边界/闭合折边匹配 {2}%；原顶点近精确配对（采样） {3}%（仅诊断，不是门槛）。{4} 不改变三维网格、不复制半片，也不使用原 UV。",[rejected?message("表面对称已识别，但约束求解未通过；保留原有效候选，未宣称对称。"):message("表面对称已验证，使用三角面内的重心对应，不要求左右顶点或三角形一一配对。"),(s.coverage*100).toFixed(1),(s.boundaryCoverage*100).toFixed(1),(s.vertexPairCoverage*100).toFixed(1),audit?message("当前 UV 镜像均方根误差 {0}%，边界 {1}%，最大 {2}%（相对当前岛直径）。",[(audit.rms*100).toFixed(3),(audit.boundaryRms*100).toFixed(3),(audit.max*100).toFixed(3)]):'']);
}
export function describeSymmetrySummary(diagnostics:readonly ChartDiagnostic[]|undefined,peel:PeelReport|undefined):string {
 const recognized=(diagnostics??[]).filter(d=>d.symmetry),rejected=recognized.filter(d=>d.symmetry!.status==='rejected').length;
 return message("表面对称：{0} 个岛保留已验证约束{1}。未标注、已开缝及未识别区域不保证对称；不是全模型对称评分。",[peel?.surfaceContracts?.length??0,rejected?message("，{0} 个候选未通过",[rejected]):'']);
}
