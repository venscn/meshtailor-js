import type { MeshData } from '@meshtailor/mesh-core';
import type { UVSnapshot } from '../workers/uv.worker';
import type { UnfoldPlayer } from './useUnfoldPlayer';
export function CorrespondenceInspector({mesh,snapshot,player:p}:{mesh:MeshData;snapshot:UVSnapshot|null;player:UnfoldPlayer}){
  const fi=p.focusFace,face=fi===null?null:mesh.faces[fi];
  const chart=fi===null?snapshot?.packed.find(c=>c.id===p.selection[0]):snapshot?.packed.find(c=>c.faceUVs.has(fi));
  const coords=fi===null?null:chart?.faceUVs.get(fi);
  const fmt=(v:readonly number[])=>v.map(x=>Number(x.toPrecision(5))).join(', ');
  const diagnostic=chart?snapshot?.diagnostics?.find(d=>d.id===chart.id):undefined;
  const area=chart?snapshot?.areaAudit?.islands.find(r=>r.id===chart.id):undefined;
  const neighbors=chart?snapshot?.spatialReport?.links.filter(l=>l.a===chart.id||l.b===chart.id)??[]:[];
  return <div className="panel correspondence-panel">
    <div className="panel-title"><span>选择与对应</span><span>{face?'三角形':p.selection.length?'UV 岛':'未选择'}</span></div>
    <div className="correspondence-content">
      <div className="selection-readout" data-testid="inspection-selection" data-islands={JSON.stringify(p.selection)} data-face={fi??''}>
        <span className="eyebrow">当前选择</span>
        <strong>{p.selection.length?`UV 岛 ${p.selection.map(id=>`#${id+1}`).join(', ')}`:'未选择 UV 岛'}</strong>
        <span>{fi===null?'未选择三角形':`三角形 ${fi}`}</span>
      </div>
      <p className="selection-help">{p.selection.length?'在已选岛内点击三角形查看坐标；再次点击该面取消。':'点击任一视图或岛列表选择 UV 岛，再点击岛内三角形。'}</p>
      <div className="button-grid two"><button disabled={fi===null} onClick={p.clearFace}>取消三角形</button><button disabled={!p.selection.length} onClick={p.clear}>清空选择</button></div>
      {chart&&<dl className="property-list"><dt>UV 岛</dt><dd>#{chart.id+1}</dd><dt>三角面</dt><dd>{chart.faceUVs.size.toLocaleString()}</dd><dt>材质空间</dt><dd>{chart.uvSpaceName??chart.uvSpace??'默认'}</dd>{diagnostic&&<><dt>求解方式</dt><dd>{diagnostic.method}</dd><dt>最大形变比</dt><dd>{diagnostic.maxStretch.toFixed(2)}</dd></>}</dl>}
      {area&&<dl className="property-list" data-testid="island-area"><dt>3D 表面积占比（同域）</dt><dd>{(area.share3D*100).toFixed(4)}%</dd><dt>UV 面积占比（同域）</dt><dd>{(area.shareUV*100).toFixed(4)}%</dd><dt>相对平均面积密度</dt><dd>{area.densityRatio?.toFixed(3)??'无效'} ×</dd></dl>}
      {chart&&<details open><summary>3D 邻居 · {neighbors.length}</summary>{neighbors.map(l=><p key={`${l.a}:${l.b}`}>#{(l.a===chart.id?l.b:l.a)+1} · {l.stitchable?'共享网格边，可作为缝合候选':'空间接近，仅关联'} · {(l.distance/(snapshot?.spatialReport?.distance||1)*(snapshot?.spatialReport?.distanceRatio??0)*100).toFixed(3)}% 模型边长</p>)}<small>空间关联不改变真实岛数，未列出的关系可能被采样或预算遗漏。</small></details>}
      {face&&coords&&<div className="coordinate-table"><h4>面角坐标</h4>{face.vertices.map((vi,k)=><div className="corner-correspondence" key={k}><b>角 {k+1} <span>顶点 {vi}</span></b><code><i>3D</i>{fmt(mesh.positions[vi]!)}</code><code><i>UV</i>{fmt(coords[k]!)}</code></div>)}</div>}
      <details><summary>对应规则</summary><p>同色、同编号表示同一个 UV 岛。三角形和顶点索引从 0 开始；岛编号从 1 开始。显示分框不修改导出的原 UV 坐标。</p><p>Esc 先取消三角形，再取消岛。Shift / Ctrl / ⌘ 点击增减岛，不选择面。</p><p>三角形选择不会改变播放范围、动画进度或相机位置。</p></details>
      <details><summary>UV 质量与说明{snapshot?.warnings.length?` · ${snapshot.warnings.length} 条`:''}</summary>
        {snapshot?.metrics&&<p>有效面积 {(snapshot.metrics.occupancy*100).toFixed(1)}% · 包围盒 {(snapshot.metrics.boxOccupancy*100).toFixed(1)}%</p>}
        {snapshot?.warnings.map((w,i)=><p className="unfold-warning" key={i}>{w}</p>)}
        <p>紫色临时断边只用于展开动画，不写入导出。刚性展开与 UV 参数化为不同阶段，动画不处理自碰撞。</p>
      </details>
    </div>
  </div>;
}
