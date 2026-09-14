import { useMemo, useState } from 'react';
import { islandColor, islandProgress, HINGE_STAGES, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot, UVTarget } from '../workers/uv.worker';
import type { UnfoldPlayer, UnfoldScope } from './useUnfoldPlayer';
export function UnfoldControls({player:p,snapshot,target,onTarget,onExport,onDemo,onHingeDemo}:{player:UnfoldPlayer;snapshot:UVSnapshot|null;target:UVTarget;onTarget:(v:UVTarget)=>void;onExport:()=>void;onDemo:()=>void;onHingeDemo:()=>void}){
  const [page,setPage]=useState(0),[filter,setFilter]=useState('');
  const islands=useMemo(()=>snapshot?.geometry.islands.filter(c=>!filter||String(c.id+1).includes(filter))??[],[snapshot,filter]);
  const pages=Math.max(1,Math.ceil(islands.length/40)),current=Math.min(page,pages-1),visible=islands.slice(current*40,current*40+40);
  return <section className="unfold-controls">
    <h3>折叠展开 · Hinge unfolding</h3>
    <button className="primary" onClick={onHingeDemo}>加载三块折角带示例</button>
    <button onClick={onDemo}>加载六岛立方体示例</button>
    <small>此按钮替换当前网格；自己的模型可先生成裁切线，或直接选择原始 UV 目标。</small>
    <label>UV 目标<select aria-label="UV target" value={target} onChange={e=>onTarget(e.target.value as UVTarget)}><option value="generated">拓扑展开 + 面积排布（新）</option><option value="source">网格原始 UV（不重新打包）</option></select></label>
    <small>两侧视图和下方导出共用同一份 UV；原始 UV 模式使用原始 UV 接缝，而非 baseline。</small>
    <label>预览范围<select aria-label="Unfold scope" value={p.scope} onChange={e=>p.changeScope(e.target.value as UnfoldScope)}><option value="all">全部 UV 岛</option><option value="single">单个 UV 岛</option><option value="selected">多选 UV 岛</option></select></label>
    {p.scope==='single'&&<div className="button-grid two"><button disabled={!p.all.length} onClick={()=>p.nextIsland(-1)}>上一个岛</button><button disabled={!p.all.length} onClick={()=>p.nextIsland(1)}>下一个岛</button></div>}
    <label>播放方式<select aria-label="Unfold order" value={p.order} onChange={e=>p.changeOrder(e.target.value as 'together'|'sequential')}><option value="together">同时展开</option><option value="sequential">逐个展开（已完成的保留）</option></select></label>
    <label>变换路径<select aria-label="Unfold path" value={p.path} onChange={e=>p.setPath(e.target.value as UnfoldPath)}><option value="hinge">分块陈列 → 铰链展平 → UV 形变 → 排布</option><option value="staged">旧：分离 + 顶点插值（对照）</option><option value="direct">直接插值到 UV</option></select></label>
    {p.path==='hinge'&&<>
      <label className="check"><input type="checkbox" checked={p.hingeWave} onChange={e=>p.setHingeWave(e.target.checked)}/> 由根面向外逐圈打开铰链</label>
      <label className="check"><input type="checkbox" checked={p.showHinges} onChange={e=>p.setShowHinges(e.target.checked)}/> 显示青色铰链轴与旋转提示</label>
      <label className="check"><input type="checkbox" checked={p.showTemporaryCuts} onChange={e=>p.setShowTemporaryCuts(e.target.checked)}/> 显示紫色临时断边（不导出）</label>
      <label className="check"><input type="checkbox" checked={p.autoFrame} onChange={e=>p.setAutoFrame(e.target.checked)}/> 相机跟随当前面片范围</label>
      <small>70–80% 保持真实刚性展开网；80–92% 才进行向参数化 UV 的形变。曲面不被伪装成可以完全无损折纸的平面。</small>
    </>}
    <label>分离距离 <b>{p.separation.toFixed(2)}</b><input aria-label="Unfold separation" type="range" min="0" max="1.5" step=".05" value={p.separation} onChange={e=>p.setSeparation(+e.target.value)}/></label>
    <label>{p.order==='sequential'?'每个岛':'整段动画'}时长（秒）<input aria-label="Unfold duration" type="number" min=".5" max="60" step=".5" value={p.seconds} onChange={e=>{const v=+e.target.value;if(v>=.5&&v<=60)p.setSeconds(v);}}/></label>
    <small>本轮 {p.active.length} / {p.all.length} 个岛 · 总时长 {p.duration.toFixed(1)} 秒</small>
    <label>未选择的岛<select aria-label="Unselected islands" value={p.context} onChange={e=>p.setContext(e.target.value as 'dim'|'hidden'|'solid')}><option value="dim">半透明留在原网格上</option><option value="hidden">隐藏（只看选中部分）</option><option value="solid">实体留在原网格上</option></select></label>
    <label className="check"><input type="checkbox" checked={p.checker} onChange={e=>p.setChecker(e.target.checked)}/> 两侧显示 UV 棋盘</label>
    <label className="check"><input type="checkbox" checked={p.labels} onChange={e=>p.setLabels(e.target.checked)}/> 岛编号（视图最多 48 个）</label>
    <div className="button-grid two"><button onClick={()=>p.fit('orbit')}>适配 3D 视角</button><button onClick={()=>p.fit('uv')}>UV 正视</button></div>
    <button disabled={!snapshot} onClick={onExport}>导出对应 OBJ + 目标 UV</button>
    <details open className="island-selector"><summary>岛列表 · {p.active.length} 已选</summary>
      <div className="button-grid two"><button onClick={()=>p.changeScope('all')}>全部</button><button onClick={p.clear}>清空选择</button></div>
      <input aria-label="Filter island IDs" className="island-search" type="search" placeholder="按岛编号筛选" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}/>
      <div className="island-list">{visible.map(c=>{const index=p.active.indexOf(c.id),t=islandProgress(p.progress,index,p.active.length,p.order);return <div key={c.id} className={`island-row ${index>=0?'selected':''}`}>
        <input type="checkbox" aria-label={`Include island ${c.id+1}`} checked={index>=0} onChange={()=>p.select(c.id,null,true)}/>
        <button onClick={()=>p.select(c.id)} title={`仅预览岛 ${c.id+1}`}><i style={{background:`rgb(${islandColor(c.id).map(x=>Math.round(x*255)).join(',')})`}}/><b>#{c.id+1}</b><span>{c.faces.length.toLocaleString()} 面</span><em>{index>=0?Math.round(t*100)+'%':'—'}</em></button>
      </div>;})}</div>
      {pages>1&&<div className="island-pagination"><button disabled={current===0} onClick={()=>setPage(current-1)}>上一页</button><span>{current+1}/{pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>下一页</button></div>}
    </details>
  </section>;
}
export function UnfoldTransport({player:p,disabled}:{player:UnfoldPlayer;disabled:boolean}){
  const blocked=disabled||!p.active.length;
  return <div className="unfold-transport">
    {p.path==='hinge'&&<div className="hinge-stage-buttons">{HINGE_STAGES.map(s=><button key={s.t} disabled={blocked} onClick={()=>p.seek(p.order==='sequential'?(Math.min(p.active.length-1,Math.floor(p.progress*p.active.length))+s.t)/Math.max(1,p.active.length):s.t)}>{s.label}</button>)}</div>}
    <div className="unfold-progress"><button onClick={()=>p.seek(0)} disabled={disabled}>3D · 0%</button><input aria-label="Unfold progress" type="range" min="0" max="1" step=".001" value={p.progress} onChange={e=>p.seek(+e.target.value)} disabled={disabled}/><button onClick={()=>p.seek(1)} disabled={blocked}>UV · 100%</button></div>
    <div className="unfold-play-row"><button className="primary" onClick={p.toggle} disabled={blocked}>{p.playing?'暂停展开':'播放展开'}</button><label><input type="checkbox" checked={p.reverse} onChange={e=>p.setReverse(e.target.checked)}/>反向（UV → 3D）</label><label><input type="checkbox" checked={p.loop} onChange={e=>p.setLoop(e.target.checked)}/>循环</label><span>{(p.progress*100).toFixed(1)}%</span></div>
    <small>{p.path==='hinge'?'每岛：0–18% 分块 · 18–28% 转向 · 28–70% 铰链旋转 · 70–80% 保持 · 80–92% UV 形变 · 92–100% 排布':p.path==='staged'?'每岛局部进度：0–20% 分离 · 20–80% 展平 · 80–100% 移入目标 UV 位置':'在对应的 3D 面角和目标 UV 面角之间平滑插值'} · 拖动进度即暂停</small>
  </div>;
}
