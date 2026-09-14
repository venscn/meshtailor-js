import type { MeshData } from '@meshtailor/mesh-core';
import type { UVSnapshot } from '../workers/uv.worker';
import type { UnfoldPlayer } from './useUnfoldPlayer';
export function CorrespondenceInspector({mesh,snapshot,player:p}:{mesh:MeshData;snapshot:UVSnapshot|null;player:UnfoldPlayer}){
  const fi=p.focusFace,face=fi===null?null:mesh.faces[fi],chart=fi===null?null:snapshot?.packed.find(c=>c.faceUVs.has(fi));
  const coords=fi===null?null:chart?.faceUVs.get(fi),fmt=(v:readonly number[])=>v.map(x=>Number(x.toPrecision(5))).join(', ');
  return <div className="panel correspondence-panel"><div className="panel-title"><span>对应关系 · Correspondence</span><span>{snapshot?.target==='source'?'原始 UV':'LSCM / Tutte 目标 UV'}</span></div><div className="correspondence-content">
    <div className="correspondence-callout">同色、同编号表示同一个 UV 岛。点击任一视图的面片，可以查看它在另一侧的对应位置。</div>
    {face&&coords&&chart?<><h4>UV 岛 #{chart.id+1} · 面片 {fi}</h4>{face.vertices.map((vi,k)=><div key={k} className="corner-correspondence"><b>角 {k+1} · 顶点 {vi}</b><code>3D [{fmt(mesh.positions[vi]!)}]</code><code>UV [{fmt(coords[k]!)}]</code></div>)}<small>面片和顶点索引从 0 开始；岛的显示编号从 1 开始。3D 坐标是导入网格的坐标，非视口归一化坐标。</small></>:<p>点击 3D / UV 中的一个三角面，查看逐角坐标。单独查看某个岛，也可直接使用左侧岛列表。</p>}
    <p><strong>一条 3D 接缝通常对应 UV 中的两条边。</strong>它们分别属于接缝的两侧；动画使用独立面角，让两边各自移动到正确位置。</p>
    <p>未选择的岛保留原网格位置；“隐藏”仅影响显示，不会删除几何或修改导出的 UV。</p>
    {snapshot?.metrics&&<p><b>有效 UV 占用 {(snapshot.metrics.occupancy*100).toFixed(1)}%</b> · 包围盒占用 {(snapshot.metrics.boxOccupancy*100).toFixed(1)}% · 所有输出三角形已检查翻面 / 退化 / 岛内重叠，岛间包围盒不相交。</p>}
    {chart&&snapshot?.diagnostics&&<p>该岛求解：{snapshot.diagnostics.find(d=>d.id===chart.id)?.method} · 最大角形变比 {snapshot.diagnostics.find(d=>d.id===chart.id)?.maxStretch.toFixed(2)}</p>}
    {snapshot?.warnings.map((w,i)=><p className="unfold-warning" key={i}>{w}</p>)}
    <p className="unfold-disclaimer">铰链模式的 0–80% 保留三角面边长，70–80% 停留在展开网；80–92% 明确展示非刚性的 UV 形变。紫色边仅为曲面闭环在教学动画中的临时断开，不是导出裁切。动画不处理自碰撞。</p>
  </div></div>;
}
