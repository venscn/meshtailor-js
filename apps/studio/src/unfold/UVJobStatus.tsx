import { message } from '@meshtailor/ui-platform';
import type { useUVSnapshot } from './useUVSnapshot';
import { describeUVProgress } from './uv-job-client';
type UVState=ReturnType<typeof useUVSnapshot>;
export function UVJobStatus({state}:{state:UVState}){
  const p=state.progress;
  return <section className="uv-job-panel" data-testid="uv-job-status" data-phase={state.phase}>
    <h3>{message("UV 计算任务")}</h3>
    <div role={state.error&&state.phase!=='cancelled'?'alert':'status'}>
      {state.loading?describeUVProgress(p,state.elapsedMs):state.error??message("已完成 · {0} 个岛 · {1} 秒",[state.snapshot?.packed.length??0,(state.elapsedMs/1000).toFixed(1)])}
    </div>
    {state.loading&&p?.facesTotal!==undefined&&<label>{message("已接受有效对应面")}<progress aria-label={message("已接受有效对应面")} max={Math.max(1,p.facesTotal)} value={p.facesDone??0}/>
      <small>{message("面数进度不含后续排布与铰链准备；并非任务总百分比。")}</small>
    </label>}
    <div className="button-grid two">
      {state.loading?<button onClick={state.cancel}>{message("取消 UV 计算")}</button>:<button onClick={state.retry}>{message("重新计算 UV")}</button>}
    </div>
    <small>{message("仅从几何生成 UV，不读取原始 UV 或用其回退。取消不会改变输入模型。")}</small>
  </section>;
}
