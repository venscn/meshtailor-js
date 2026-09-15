import { useMemo, useState } from 'react';
import { islandColor, islandProgress, HINGE_STAGES, type UnfoldOrder, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot, UVTarget } from '../workers/uv.worker';
import type { UnfoldPlayer, UnfoldScope } from './useUnfoldPlayer';

export function UnfoldControls({player:p,snapshot,target,onTarget,onExport,onDemo,onHingeDemo}:{player:UnfoldPlayer;snapshot:UVSnapshot|null;target:UVTarget;onTarget:(v:UVTarget)=>void;onExport:()=>void;onDemo:()=>void;onHingeDemo:()=>void}){
  const [page,setPage]=useState(0),[filter,setFilter]=useState('');
  const islands=useMemo(()=>snapshot?.geometry.islands.filter(c=>!filter||String(c.id+1).includes(filter))??[],[snapshot,filter]);
  const pages=Math.max(1,Math.ceil(islands.length/40)),current=Math.min(page,pages-1),visible=islands.slice(current*40,current*40+40);
  return <section className="unfold-controls">
    <h3>展开与检查</h3>
    <label>UV 目标<select aria-label="UV target" value={target} onChange={e=>onTarget(e.target.value as UVTarget)}><option value="generated">重新展开与排布</option><option value="source">保留原始 UV</option></select></label>
    <label>播放范围<select aria-label="Unfold scope" value={p.scope} onChange={e=>p.changeScope(e.target.value as UnfoldScope)}><option value="all">全部 UV 岛</option><option value="single">单个 UV 岛</option><option value="selected">多选 UV 岛</option></select></label>
    <details open className="island-selector">
      <summary>UV 岛 <span className="count">{p.active.length} / {p.all.length}</span></summary>
      <small>首次点击选岛，再点岛内三角形选面。重复点击面取消。</small>
      <div className="button-grid two"><button onClick={()=>p.changeScope('all')}>全部播放</button><button onClick={p.clear}>清空选择</button></div>
      <input aria-label="Filter island IDs" className="island-search" type="search" placeholder="搜索岛编号…" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}/>
      <div className="island-list">{visible.map(c=>{
        const index=p.active.indexOf(c.id),t=islandProgress(p.progress,index,p.active.length,p.order,p.handoff,p.timeline);
        return <div key={c.id} className={`island-row ${p.selection.includes(c.id)?'selected':''}`}>
          <input type="checkbox" aria-label={`Include island ${c.id+1}`} checked={index>=0} onChange={()=>p.select(c.id,null,true)}/>
          <button onClick={()=>p.select(c.id)} aria-pressed={p.selection.includes(c.id)} title={`选择 UV 岛 ${c.id+1}（不选三角形）`}>
            <i style={{background:`rgb(${islandColor(c.id).map(x=>Math.round(x*255)).join(',')})`}}/>
            <b>#{c.id+1}</b><span>{c.faces.length.toLocaleString()} 面</span><em>{index>=0?`${Math.round(t*100)}%`:'—'}</em>
          </button>
        </div>;
      })}</div>
      {!visible.length&&<p className="empty">{snapshot?'没有匹配的 UV 岛':'UV 计算完成后显示岛列表'}</p>}
      {pages>1&&<div className="island-pagination"><button disabled={current===0} onClick={()=>setPage(current-1)}>上一页</button><span>{current+1}/{pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>下一页</button></div>}
      {p.scope==='single'&&<div className="button-grid two"><button disabled={!p.all.length} onClick={()=>p.nextIsland(-1)}>上一个岛</button><button disabled={!p.all.length} onClick={()=>p.nextIsland(1)}>下一个岛</button></div>}
    </details>
    <h3 className="section-divider">播放</h3>
    <label>方式<select aria-label="Unfold order" value={p.order} onChange={e=>p.changeOrder(e.target.value as UnfoldOrder)}><option value="relay">逐岛接力</option><option value="sequential">严格逐岛</option></select></label>
    {p.order!=='sequential'&&<label>接力点 <b>{Math.round(p.handoff*100)}%</b><input aria-label="Island handoff" type="range" min=".75" max="1" step=".01" value={p.handoff} onChange={e=>p.changeHandoff(+e.target.value)}/></label>}
    <label>每岛基准时长 / 秒<input aria-label="Unfold duration" type="number" min=".5" max="60" step=".5" value={p.seconds} onChange={e=>{const v=+e.target.value;if(v>=.5&&v<=60)p.setSeconds(v);}}/></label>
    <label className="check"><input aria-label="Skip unchanged animation spans" type="checkbox" checked={p.skipStatic} onChange={e=>p.changeSkipStatic(e.target.checked)}/>跳过无变化区间</label>
    <small data-testid="motion-time-savings">{p.duration.toFixed(1)} 秒 · 比固定阶段缩短 {Math.max(0,p.nominalDuration-p.duration).toFixed(1)} 秒</small>
    <label>向外分离 <b>{Math.round(p.separation*100)}%</b><input aria-label="Unfold separation" type="range" min="0" max=".5" step=".01" value={p.separation} onChange={e=>p.setSeparation(+e.target.value)}/></label>
    <button onClick={()=>p.setSeparation(0)}>原位展开</button>
    <small>相对模型最长边；0 表示不向外移动。</small>
    <details><summary>展开路径与阶段</summary>
      <label>变换路径<select aria-label="Unfold path" value={p.path} onChange={e=>p.setPath(e.target.value as UnfoldPath)}><option value="hinge">铰链展开 → UV 形变 → 排布</option><option value="staged">分离 + 顶点插值（对照）</option><option value="direct">直接插值到 UV</option></select></label>
      <label className="check"><input type="checkbox" checked={p.hingeWave} onChange={e=>p.setHingeWave(e.target.checked)}/>从根面依次打开铰链</label>
      <label className="check"><input aria-label="Hold rigid net" type="checkbox" checked={p.holdNet} onChange={e=>p.changeHoldNet(e.target.checked)}/>平面网额外停留</label>
      <small>仅相邻两岛尾段交叠。等待岛留在 3D，完成岛留在 UV。</small>
    </details>
    <details><summary>显示与相机</summary>
      <label>未选择的岛<select aria-label="Unselected islands" value={p.context} onChange={e=>p.setContext(e.target.value as 'dim'|'hidden'|'solid')}><option value="dim">半透明</option><option value="hidden">隐藏</option><option value="solid">实体</option></select></label>
      <label className="check"><input type="checkbox" checked={p.checker} onChange={e=>p.setChecker(e.target.checked)}/>UV 棋盘</label>
      <label className="check"><input type="checkbox" checked={p.labels} onChange={e=>p.setLabels(e.target.checked)}/>岛编号</label>
      <label className="check"><input type="checkbox" checked={p.showHinges} onChange={e=>p.setShowHinges(e.target.checked)}/>铰链轴与角度</label>
      <label className="check"><input type="checkbox" checked={p.showTemporaryCuts} onChange={e=>p.setShowTemporaryCuts(e.target.checked)}/>动画临时断边</label>
      <label className="check"><input aria-label="Follow unfolding camera" type="checkbox" checked={p.autoFrame} onChange={e=>p.setAutoFrame(e.target.checked)}/>自动跟随面片</label>
      <small data-testid="camera-control-status">{p.autoFrame?'操作相机将关闭跟随。':'手动相机 · 播放不锁定视角。'}</small>
      <button onClick={()=>p.fit('current')}>适配当前面片（保留方向）</button>
      <div className="button-grid two"><button onClick={()=>p.fit('orbit')}>适配 3D 视角</button><button onClick={()=>p.fit('uv')}>UV 正视</button></div>
    </details>
    <details><summary>运动检测</summary>
      <label>相对岛尺寸容差<input aria-label="Motion relative tolerance" type="number" min="0" max=".001" step=".000001" value={p.motionTolerance} onChange={e=>p.changeMotionTolerance(+e.target.value)}/></label>
      <small>按真实顶点运动检测，与相机和遮挡无关。</small>
      {p.timeline?.entries[p.focusIndex]&&<small data-testid="skipped-motion-spans">已跳过：{p.timeline.entries[p.focusIndex]!.profile.segments.filter(s=>!s.keep&&s.stage!=='主动观察停留').map(s=>s.stage).join('、')||'无'}</small>}
    </details>
    <details><summary>示例与导出</summary><button onClick={onHingeDemo}>加载三块折角带示例</button><button onClick={onDemo}>加载六岛立方体示例</button><small>载入示例会替换当前模型。</small><button disabled={!snapshot} onClick={onExport}>导出对应 OBJ + 目标 UV</button></details>
  </section>;
}

export function UnfoldTransport({player:p,disabled}:{player:UnfoldPlayer;disabled:boolean}){
  const blocked=disabled||!p.active.length;
  return <div className="unfold-transport">
    <div className="unfold-play-row">
      <button className="primary" onClick={p.toggle} disabled={blocked}>{p.playing?'暂停展开':'播放展开'}</button>
      <label><input type="checkbox" checked={p.reverse} onChange={e=>p.setReverse(e.target.checked)}/>反向</label>
      <label><input type="checkbox" checked={p.loop} onChange={e=>p.setLoop(e.target.checked)}/>循环</label>
      <span className="queue-summary">{p.schedule.completed} / {p.active.length} 岛 · 剩余 {p.remaining.toFixed(1)} s</span>
      <b className="play-percent">{(p.progress*100).toFixed(1)}%</b>
    </div>
    <div className="unfold-progress"><button onClick={()=>p.seek(0)} disabled={disabled}>3D · 0%</button><input aria-label="Unfold progress" type="range" min="0" max="1" step=".001" value={p.progress} onChange={e=>p.seek(+e.target.value)} disabled={disabled}/><button onClick={()=>p.seek(1)} disabled={blocked}>UV · 100%</button></div>
    {p.path==='hinge'&&<div className="hinge-stage-buttons">{HINGE_STAGES.map(s=><button key={s.t} disabled={blocked} onClick={()=>p.seekStage(s.t)}>{s.label}</button>)}</div>}
    <div className="queue-navigation" data-testid="island-schedule-status">
      <button disabled={blocked||p.focusIndex<=0} onClick={()=>p.seekQueue(-1)}>上一个岛</button>
      <span>{p.schedule.active.length?p.schedule.active.map(a=>`#${p.active[a.index]!+1} · ${(a.progress*100).toFixed(1)}%`).join(' → '):blocked?'没有播放对象':p.progress===1?'全部在 UV 平面':p.progress===0?'全部在 3D 原位':'下一岛准备启动'}</span>
      <button disabled={blocked||p.focusIndex>=p.active.length-1} onClick={()=>p.seekQueue(1)}>下一个岛</button>
    </div>
  </div>;
}
