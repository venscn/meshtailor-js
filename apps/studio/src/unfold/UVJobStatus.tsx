import type { useUVSnapshot } from './useUVSnapshot';
import { describeUVProgress } from './uv-job-client';
type UVState=ReturnType<typeof useUVSnapshot>;
export function UVJobStatus({state,hasSource,onUseSource}:{state:UVState;hasSource:boolean;onUseSource:()=>void}){
  const p=state.progress;
  return <section className="uv-job-panel" data-testid="uv-job-status" data-phase={state.phase}>
    <h3>UV 计算任务</h3>
    <div role={state.error&&state.phase!=='cancelled'?'alert':'status'}>
      {state.loading?describeUVProgress(p,state.elapsedMs):state.error??`已完成 · ${state.snapshot?.packed.length??0} 个岛 · ${(state.elapsedMs/1000).toFixed(1)} 秒`}
    </div>
    {state.loading&&p?.facesTotal!==undefined&&<label>已接受有效对应面
      <progress aria-label="已接受有效对应面" max={Math.max(1,p.facesTotal)} value={p.facesDone??0}/>
      <small>面数进度不含后续排布与铰链准备；并非任务总百分比。</small>
    </label>}
    <div className="button-grid two">
      {state.loading?<button onClick={state.cancel}>取消 UV 计算</button>:<button onClick={state.retry}>重新计算 UV</button>}
      <button disabled={!hasSource} onClick={onUseSource}>使用网格原始 UV</button>
    </div>
    <small>原始 UV 仅保留已有布局，不修复重叠，也不是重新求解的结果。取消不会改变输入模型。</small>
  </section>;
}
