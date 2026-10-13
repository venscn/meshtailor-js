import { message, displayLabel } from '../../../../packages/ui-platform/src/index';
import {attachScrubSession} from './scrub-session';
import { useEffect, useRef, useMemo, useState } from 'react';
import { islandColor, islandProgress, HINGE_STAGES, type UnfoldOrder, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot, UVTarget } from '../workers/uv.worker';
import type { OverlapMode } from './overlap-policy';
import type { UnfoldPlayer, UnfoldScope } from './useUnfoldPlayer';

export function UnfoldControls({player:p,snapshot,target,onTarget,onExport,onDemo,onHingeDemo,onOverlapDemo}:{player:UnfoldPlayer;snapshot:UVSnapshot|null;target:UVTarget;onTarget:(v:UVTarget)=>void;onExport:()=>void;onDemo:()=>void;onHingeDemo:()=>void;onOverlapDemo:()=>void}){
  const [page,setPage]=useState(0),[filter,setFilter]=useState('');
  const islands=useMemo(()=>snapshot?.geometry.islands.filter(c=>!filter||String(c.id+1).includes(filter))??[],[snapshot,filter]);
  const pages=Math.max(1,Math.ceil(islands.length/40)),current=Math.min(page,pages-1),visible=islands.slice(current*40,current*40+40);
  return <section className="unfold-controls">
    <h3>{message("展开与检查")}</h3>
    <label>{message("UV 目标")}<select aria-label={message("UV target")} value={target} onChange={e=>onTarget(e.target.value as UVTarget)}><option value="generated">{message("重新展开与排布")}</option>{(target==='stitch'||target==='repack'||target==='fill'||target==='templates')&&<option value={target}>{target==='templates'?message("当前结构模板结果"):target==='fill'?message("当前轮廓精排结果"):target==='stitch'?message("当前邻岛缝合结果"):message("当前重排结果")}</option>}</select></label>
    <label>{message("播放范围")}<select aria-label={message("Unfold scope")} value={p.scope} onChange={e=>p.changeScope(e.target.value as UnfoldScope)}><option value="all">{message("全部 UV 岛")}</option><option value="single">{message("单个 UV 岛")}</option><option value="selected">{message("多选 UV 岛")}</option></select></label>
    <details open className="island-selector">
      <summary>{message("UV 岛")+" "}<span className="count">{p.active.length} / {p.all.length}</span></summary>
      <small>{message("首次点击选岛，再点岛内三角形选面。重复点击面取消。")}</small>
      <div className="button-grid two"><button onClick={()=>p.changeScope('all')}>{message("全部播放")}</button><button onClick={p.clear}>{message("清空选择")}</button></div>
      <input aria-label={message("Filter island IDs")} className="island-search" type="search" placeholder={message("搜索岛编号…")} value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}}/>
      <div className="island-list">{visible.map(c=>{
        const index=p.active.indexOf(c.id),t=islandProgress(p.progress,index,p.active.length,p.order,p.handoff,p.timeline);
        return <div key={c.id} className={`island-row ${p.selection.includes(c.id)?'selected':''}`}>
          <input type="checkbox" aria-label={message('Include island {0}',[c.id+1])} checked={index>=0} onChange={()=>p.select(c.id,null,true)}/>
          <button onClick={()=>p.select(c.id)} aria-pressed={p.selection.includes(c.id)} title={message("选择 UV 岛 {0}（不选三角形）",[c.id+1])}>
            <i style={{background:`rgb(${islandColor(c.id).map(x=>Math.round(x*255)).join(',')})`}}/>
            <b>#{c.id+1}</b><span>{c.faces.length.toLocaleString()}{" "+message("面")}</span><em>{index>=0?`${Math.round(t*100)}%`:'—'}</em>
          </button>
        </div>;
      })}</div>
      {!visible.length&&<p className="empty">{snapshot?message("没有匹配的 UV 岛"):message("UV 计算完成后显示岛列表")}</p>}
      {pages>1&&<div className="island-pagination"><button disabled={current===0} onClick={()=>setPage(current-1)}>{message("上一页")}</button><span>{current+1}/{pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>{message("下一页")}</button></div>}
      {p.scope==='single'&&<div className="button-grid two"><button disabled={!p.all.length} onClick={()=>p.nextIsland(-1)}>{message("上一个岛")}</button><button disabled={!p.all.length} onClick={()=>p.nextIsland(1)}>{message("下一个岛")}</button></div>}
    </details>
    <h3 className="section-divider">{message("播放")}</h3>
    <label>{message("方式")}<select aria-label={message("Unfold order")} value={p.order} onChange={e=>p.changeOrder(e.target.value as UnfoldOrder)}><option value="relay">{message("逐岛接力")}</option><option value="sequential">{message("严格逐岛")}</option></select></label>
    {p.order!=='sequential'&&<label>{message("接力点")+" "}<b>{Math.round(p.handoff*100)}%</b><input aria-label={message("Island handoff")} type="range" min=".75" max="1" step=".01" value={p.handoff} onChange={e=>p.changeHandoff(+e.target.value)}/></label>}
    <small>{message("队列按原始 3D 表面积从大到小；多选顺序不影响播放。")}</small>
    <label>{message("每岛基准时长 / 秒")}<input aria-label={message("Unfold duration")} type="number" min=".5" max="60" step=".5" value={p.seconds} onChange={e=>{const v=+e.target.value;if(v>=.5&&v<=60)p.setSeconds(v);}}/></label>
    <label className="check"><input aria-label={message("Skip unchanged animation spans")} type="checkbox" checked={p.skipStatic} onChange={e=>p.changeSkipStatic(e.target.checked)}/>{message("跳过无变化区间")}</label>
    <small data-testid="motion-time-savings">{message("基准")+" "}{p.duration.toFixed(1)}{" "+message("秒 / 当前倍速")+" "}{p.wallDuration.toFixed(1)}{" "+message("秒 · 静止跳过缩短")+" "}{Math.max(0,p.nominalDuration-p.duration).toFixed(1)}{" "+message("秒")}</small>
    <label>{message("向外分离")+" "}<b>{Math.round(p.separation*100)}%</b><input aria-label={message("Unfold separation")} type="range" min="0" max=".5" step=".01" value={p.separation} onChange={e=>p.setSeparation(+e.target.value)}/></label>
    <button onClick={()=>p.setSeparation(0)}>{message("原位展开")}</button>
    <small>{message("相对模型最长边；0 表示不向外移动。")}</small>
    <details><summary>{message("展开路径与阶段")}</summary>
      <label>{message("变换路径")}<select aria-label={message("Unfold path")} value={p.path} onChange={e=>p.setPath(e.target.value as UnfoldPath)}><option value="hinge">{message("铰链展开 → UV 形变 → 排布")}</option><option value="staged">{message("分离 + 顶点插值（对照）")}</option><option value="direct">{message("直接插值到 UV")}</option></select></label>
      <label className="check"><input type="checkbox" checked={p.hingeWave} onChange={e=>p.setHingeWave(e.target.checked)}/>{message("从根面依次打开铰链")}</label>
      <label className="check"><input aria-label={message("Hold rigid net")} type="checkbox" checked={p.holdNet} onChange={e=>p.changeHoldNet(e.target.checked)}/>{message("平面网额外停留")}</label>
      <small>{message("仅相邻两岛尾段交叠。等待岛留在 3D，完成岛留在 UV。")}</small>
    </details>
    <details open><summary>{message("当前播放岛 · 避遮挡")}</summary>
      <label className="check"><input aria-label={message("Playback focus dissolve")} type="checkbox" checked={p.focusMode!=='off'} onChange={e=>p.setFocusMode(e.target.checked?'ghost':'off')}/>{message("播放 / 拖动期间突出当前展开岛")}</label>
      <label>{message("突出方式")}<select aria-label={message("Playback emphasis mode")} value={p.focusMode} onChange={e=>p.setFocusMode(e.target.value as 'off'|'ghost'|'dither')}><option value="ghost">{message("其他岛整体半透明（默认）")}</option><option value="dither">{message("局部球形散点（旧方式）")}</option><option value="off">{message("关闭")}</option></select></label>
      <label>{message("其他岛不透明度")}<input aria-label={message("Playback ghost opacity")} type="range" min=".03" max=".65" step=".01" value={p.focusOpacity} onChange={e=>p.setFocusOpacity(+e.target.value)}/><small>{Math.round(p.focusOpacity*100)}{message("% · 暂停 / 松手后恢复原显示")}</small></label>
      <div data-testid="arrival-controls">
        <label>{message("到达 UV 后亮显（1× 动画秒）")}<input aria-label={message("UV arrival hold seconds")} type="number" min="0" max="5" step=".1" value={p.arrivalHoldSeconds} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))p.setArrivalHoldSeconds(Math.max(0,Math.min(5,n)));}}/></label>
        <label>{message("随后渐隐（1× 动画秒）")}<input aria-label={message("UV arrival fade seconds")} type="number" min="0" max="5" step=".1" value={p.arrivalFadeSeconds} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isFinite(n))p.setArrivalFadeSeconds(Math.max(0,Math.min(5,n)));}}/></label>
        <small>{message("随动画进度和倍速计算；回拖/倒放可复现，停住进度即停止渐隐；只在整体半透明模式生效。落位后先保持岛色，再平滑变到背景透明度，不阻塞下一岛。暂停 / 松手 / 播放结束仍立即恢复原显示。")}</small>
      </div>
      <small>{message("等待岛淡化；运动岛始终实体，完全到达目标 UV 后才进入亮显和渐隐。不改变选择、UV 或相机。")}</small>
      <details><summary>{message("旧球形散点选项（仅旧方式有效）")}</summary><label>{message("球形范围")}<input aria-label={message("Focus sphere radius")} type="range" min="1" max="3" step=".1" value={p.focusRadius} onChange={e=>p.setFocusRadius(+e.target.value)}/><small>{p.focusRadius.toFixed(1)}{" "+message("× 当前岛半径")}</small></label>
      <label>{message("遮挡面残留")}<input aria-label={message("Focus retained opacity")} type="range" min=".02" max=".8" step=".01" value={p.focusRetained} onChange={e=>p.setFocusRetained(+e.target.value)}/><small>{Math.round(p.focusRetained*100)}%</small></label></details>
      <small>{message("旧球形方式也只在播放或拖动期间启用；暂停和手势结束均恢复。")}</small>
    </details>
    <details open className="overlap-controls" data-testid="overlap-controls"><summary>{message("重叠与面片识别")}</summary>
      <label>{message("重叠提示")}<select aria-label={message("Overlap visualization")} value={p.overlapMode} onChange={e=>p.setOverlapMode(e.target.value as OverlapMode)}><option value="auto">{message("自动 · 运动岛视线叠层")}</option><option value="coplanar">{message("同岛近共面重叠")}</option><option value="projected">{message("视线叠层 · 含前后遮挡")}</option><option value="off">{message("关闭")}</option></select></label>
      <small>{p.overlapMode==='auto'?message("铰链尚未展平时也提示当前运动岛的视线叠层；静止后切为近共面提示。投影遮挡不等于碰撞。"):p.overlapMode==='projected'?message("视线叠层包含普通遮挡，不代表几何相交。"):message("近共面提示只检测当前可见表层附近的同岛面片。")}</small>
      <label className="check"><input aria-label={message("Triangle tone variation")} type="checkbox" checked={p.faceTones} onChange={e=>p.setFaceTones(e.target.checked)}/>{message("三角形明暗分色（保留岛色）")}</label>
      <label>{message("条纹强度")+" "}<b>{Math.round(p.overlapOpacity*100)}%</b><input aria-label={message("Overlap hatch opacity")} type="range" min=".1" max="1" step=".01" value={p.overlapOpacity} onChange={e=>p.setOverlapOpacity(+e.target.value)}/></label>
      <details><summary>{message("检测容差")}</summary><label>{message("距离 / 模型最长边 %")}<input aria-label={message("Overlap relative tolerance percent")} type="number" min=".0001" max="1" step=".001" value={p.overlapTolerance*100} onChange={e=>{const v=+e.target.value;if(Number.isFinite(v)&&v>=.0001&&v<=1)p.setOverlapTolerance(v/100);}}/></label><small>{message("默认 0.01%。过大会把靠得很近的平行面算作重叠；不是精确自交验证。")}</small></details>
      <button onClick={onOverlapDemo}>{message("加载铰链重叠示例")}</button>
      <small>{message("橙色斜纹 = 2 层；玫红交叉纹 = 3 层及以上。可配合视口“线框”。切换提示不暂停、不重新展开。")}</small>
    </details>
    <details><summary>{message("显示与相机")}</summary>
      <label>{message("未选择的岛")}<select aria-label={message("Unselected islands")} value={p.context} onChange={e=>p.setContext(e.target.value as 'dim'|'hidden'|'solid')}><option value="dim">{message("半透明")}</option><option value="hidden">{message("隐藏")}</option><option value="solid">{message("实体")}</option></select></label>
      <label className="check"><input type="checkbox" checked={p.checker} onChange={e=>p.setChecker(e.target.checked)}/>{message("UV 棋盘")}</label>
      <label className="check"><input type="checkbox" checked={p.labels} onChange={e=>p.setLabels(e.target.checked)}/>{message("岛编号")}</label>
      <label className="check"><input type="checkbox" checked={p.showHinges} onChange={e=>p.setShowHinges(e.target.checked)}/>{message("铰链轴与角度")}</label>
      <label className="check"><input type="checkbox" checked={p.showTemporaryCuts} onChange={e=>p.setShowTemporaryCuts(e.target.checked)}/>{message("动画临时断边")}</label>
      <label className="check"><input aria-label={message("Follow unfolding camera")} type="checkbox" checked={p.autoFrame} onChange={e=>p.setAutoFrame(e.target.checked)}/>{message("自动跟随面片")}</label>
      <small data-testid="camera-control-status">{p.autoFrame?message("操作相机将关闭跟随。"):message("手动相机 · 播放不锁定视角。")}</small>
      <button onClick={()=>p.fit('current')}>{message("适配当前面片（保留方向）")}</button>
      <div className="button-grid two"><button onClick={()=>p.fit('orbit')}>{message("适配 3D 视角")}</button><button onClick={()=>p.fit('uv')}>{message("UV 正视")}</button></div>
    </details>
    <details><summary>{message("运动检测")}</summary>
      <label>{message("相对岛尺寸容差")}<input aria-label={message("Motion relative tolerance")} type="number" min="0" max=".001" step=".000001" value={p.motionTolerance} onChange={e=>p.changeMotionTolerance(+e.target.value)}/></label>
      <small>{message("按真实顶点运动检测，与相机和遮挡无关。")}</small>
      {p.timeline?.entries[p.focusIndex]&&<small data-testid="skipped-motion-spans">{message("已跳过：")}{p.timeline.entries[p.focusIndex]!.profile.segments.filter(s=>!s.keep&&s.stage!=='主动观察停留').map(s=>displayLabel(s.stage)).join(', ')||message("无")}</small>}
    </details>
    <details><summary>{message("示例与导出")}</summary><button onClick={onHingeDemo}>{message("加载三块折角带示例")}</button><button onClick={onDemo}>{message("加载六岛立方体示例")}</button><small>{message("载入示例会替换当前模型。")}</small><button disabled={!snapshot} onClick={onExport}>{message("导出对应 OBJ + 目标 UV")}</button></details>
  </section>;
}

export function UnfoldTransport({player:p,disabled}:{player:UnfoldPlayer;disabled:boolean}){
  const range=useRef<HTMLInputElement>(null),scrub=useRef(p.setScrubbing);scrub.current=p.setScrubbing;
  useEffect(()=>{if(!range.current)return;return attachScrubSession(range.current,active=>scrub.current(active));},[]);
  const blocked=disabled||!p.active.length;
  return <div className="unfold-transport">
    <div className="unfold-play-row">
      <button className="primary" onClick={p.toggle} disabled={blocked}>{p.playing?message("暂停展开"):message("播放展开")}</button>
      <label><input type="checkbox" checked={p.reverse} onChange={e=>p.setReverse(e.target.checked)}/>{message("反向")}</label>
      <label><input type="checkbox" checked={p.loop} onChange={e=>p.setLoop(e.target.checked)}/>{message("循环")}</label>
      <label>{message("倍速")}<select aria-label={message("Playback speed")} value={p.rate} onChange={e=>p.setRate(+e.target.value)}>{[.25,.5,1,2,4,8,16,32,64].map(n=><option key={n} value={n}>{n}×</option>)}</select></label>
      <span className="queue-summary">{p.schedule.completed} / {p.active.length}{" "+message("岛 · 剩余")+" "}{p.remaining.toFixed(1)}{" "+message("s")}</span>
      <b className="play-percent">{(p.progress*100).toFixed(1)}%</b>
    </div>
    <div className="unfold-progress"><button onClick={()=>p.seek(0)} disabled={disabled}>{message("3D · 0%")}</button><input ref={range} aria-label={message("Unfold progress")} type="range" min="0" max="1" step=".001" value={p.progress} onChange={e=>p.seek(+e.target.value)} disabled={disabled}/><button onClick={()=>p.seek(1)} disabled={blocked}>{message("UV · 100%")}</button></div>
    {p.path==='hinge'&&<div className="hinge-stage-buttons">{HINGE_STAGES.map(s=><button key={s.t} disabled={blocked} onClick={()=>p.seekStage(s.t)}>{displayLabel(s.label)}</button>)}</div>}
    <div className="queue-navigation" data-testid="island-schedule-status">
      <button disabled={blocked||p.focusIndex<=0} onClick={()=>p.seekQueue(-1)}>{message("上一个岛")}</button>
      <span>{p.schedule.active.length?p.schedule.active.map(a=>`#${p.active[a.index]!+1} · ${(a.progress*100).toFixed(1)}%`).join(' → '):blocked?message("没有播放对象"):p.progress===1?message("全部在 UV 平面"):p.progress===0?message("全部在 3D 原位"):message("下一岛准备启动")}</span>
      <button disabled={blocked||p.focusIndex>=p.active.length-1} onClick={()=>p.seekQueue(1)}>{message("下一个岛")}</button>
    </div>
  </div>;
}
