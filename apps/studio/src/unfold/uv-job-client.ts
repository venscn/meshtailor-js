import {geometryOnlyMesh} from '@meshtailor/mesh-core';
import type { UVJob, UVJobProgress, UVMessage, UVSnapshot } from '../workers/uv.worker.js';
export type UVFailureCode='cancelled'|'timeout'|'startup'|'worker'|'invalid';
export class UVJobFailure extends Error {
  constructor(public readonly code:UVFailureCode,message:string){super(message);this.name='UVJobFailure';}
}
export interface UVJobClientOptions {
  createWorker:()=>Worker;
  onProgress?:(progress:UVJobProgress)=>void;
  /** Wall-clock hard limit also stops a Worker stuck inside a synchronous loop. */
  timeoutMs?:number;
  startupTimeoutMs?:number;
}
/** Shared by React and offline Lab. Termination is mandatory: a busy synchronous
 * Worker cannot receive a cooperative "cancel" message until it returns. */
export function startUVJob(job:UVJob,options:UVJobClientOptions):{result:Promise<UVSnapshot>;cancel:()=>void}{
  let worker:Worker|undefined,settled=false,hardTimer:ReturnType<typeof setTimeout>|undefined,startTimer:ReturnType<typeof setTimeout>|undefined;
  let last:UVJobProgress|undefined,resolve!:(s:UVSnapshot)=>void,reject!:(e:UVJobFailure)=>void;
  const result=new Promise<UVSnapshot>((yes,no)=>{resolve=yes;reject=no;});
  const cleanup=()=>{
    clearTimeout(hardTimer);clearTimeout(startTimer);
    if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;worker.terminate();worker=undefined;}
  };
  const fail=(code:UVFailureCode,message:string)=>{if(settled)return;settled=true;cleanup();reject(new UVJobFailure(code,message));};
  const cancel=()=>fail('cancelled','已取消 UV 计算；原网格未修改。点击“重新计算”可重试。');
  const timeout=options.timeoutMs??((job.config?.timeBudgetMs??120_000)+1000);
  const startup=Math.min(timeout,options.startupTimeoutMs??15_000);
  try{
    if(!Number.isFinite(timeout)||timeout<1||!Number.isFinite(startup)||startup<1)throw new Error('Invalid UV job timeout.');
    worker=options.createWorker();
    hardTimer=setTimeout(()=>fail('timeout',`UV 任务超过 ${(timeout/1000).toFixed(1)} 秒，已强制终止。最后阶段：${last?.detail??'等待 Worker'}。可调整预算后重试（不使用原 UV 回退）。`),timeout);
    startTimer=setTimeout(()=>fail('startup','UV Worker 未在启动时限内响应，已终止。请检查浏览器控制台中的 Worker 加载错误后重试。'),startup);
    worker.onerror=e=>fail('worker','UV Worker 执行失败：'+(e.message||'unknown error'));
    worker.onmessageerror=()=>fail('worker','UV Worker 返回数据无法解析，任务已终止。');
    worker.onmessage=(event:MessageEvent<UVMessage>)=>{
      if(settled)return;
      const data=event.data;
      if(!data||typeof data!=='object'){fail('worker','UV Worker 返回了无效消息。');return;}
      if('type' in data&&data.type==='progress'){
        if(!data.progress||typeof data.progress.detail!=='string'){fail('worker','UV Worker 返回了无效进度。');return;}
        clearTimeout(startTimer);last=data.progress;options.onProgress?.(data.progress);return;
      }
      if('ok' in data&&data.ok===true&&data.snapshot){settled=true;cleanup();resolve(data.snapshot);}
      else if('ok' in data&&data.ok===false)fail(data.code??'invalid',data.error);
      else fail('worker','UV Worker 消息协议不匹配，请刷新页面后重试。');
    };
    worker.postMessage({...job,mesh:geometryOnlyMesh(job.mesh)});
  }catch(error){fail('worker',error instanceof Error?error.message:String(error));}
  return{result,cancel};
}
export function describeUVProgress(progress:UVJobProgress|null,elapsedMs:number):string{
  const detail=progress?.detail??'启动 UV Worker';
  const count=progress?.current!==undefined&&progress.total!==undefined?` · ${progress.current}/${progress.total} ${progress.unit??''}`:'';
  const faces=progress?.facesDone!==undefined&&progress.facesTotal!==undefined?` · 已接受 ${progress.facesDone.toLocaleString()}/${progress.facesTotal.toLocaleString()} 面`:'';
  return `${detail}${count}${faces} · 已用 ${(elapsedMs/1000).toFixed(1)} 秒`;
}
