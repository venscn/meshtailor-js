import type {PeelGroup} from '@meshtailor/uv';
/** Shared wording for the React inspector and the offline production workbench. */
export function describeStructure(group:PeelGroup|undefined):string {
 if(!group?.structureReason)return'';
 const role=group.kind==='symmetric-sheet'?'完整表面对称层片 · 沿共有几何边缘分开':group.kind==='closed-shell'?(group.openingEdges?.length?'回折孔壁 · 连续开缝':`透孔主片 · 保留 ${(group.structureBoundaryLoops??1)-1} 个孔`):'双侧结构 / 窄连接片';
 const s=group.symmetry,p=group.pairedOpening;
 return `${role}。${s?`本结构镜像对应覆盖 ${(s.coverage*100).toFixed(1)}%；已对应 ${s.matchedFaces} 面，分组冲突 ${s.mismatchedFaces} 面，异对角线单元 ${s.diagonalCells} 组。未匹配区域不宣称对称。`:''}${p?`对应侧缝 ${p.sourceEdges}/${p.targetEdges} 条真实网格边；镜像曲线最大距离 ${(p.relativeDeviation*100).toFixed(2)}% 原侧缝长度。`:''}纯几何生成，原 UV 不参与。`;
}
