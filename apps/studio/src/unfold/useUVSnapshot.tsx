import { useEffect, useRef, useState } from 'react';
import type { UnwrapOptions, PackedChart } from '@meshtailor/uv';
import type { MeshData } from '@meshtailor/mesh-core';
import type { UVJobProgress, UVSnapshot, UVTarget } from '../workers/uv.worker';
import { startUVJob, UVJobFailure } from './uv-job-client';
export type UVPhase='starting'|'running'|'completed'|'cancelled'|'timeout'|'error';
interface State {
  seedCharts?:PackedChart[];mesh:MeshData;edges:Set<string>;target:UVTarget;config:Partial<UnwrapOptions>|undefined;
  snapshot:UVSnapshot|null;error:string|null;phase:UVPhase;progress:UVJobProgress|null;elapsedMs:number;
}
/** One cancellable worker, finite job lifetime, and one snapshot shared by BOTH views. */
export function useUVSnapshot(mesh:MeshData,edges:Set<string>,target:UVTarget,config?:Partial<UnwrapOptions>,seedCharts?:PackedChart[]){
  const completed=useRef<{mesh:MeshData;snapshot:UVSnapshot}|null>(null);
  const [state,setState]=useState<State|null>(null),[retry,setRetry]=useState(0),cancelRef=useRef<()=>void>(()=>{});
  useEffect(()=>{
    let disposed=false,done=false,job:ReturnType<typeof startUVJob>|undefined;
    const start=performance.now();
    const identity={mesh,edges,target,config,seedCharts};
    const backup=(target==='stitch'||target==='repack'||target==='source-atlas'||target==='fill')&&completed.current?.mesh===mesh?completed.current.snapshot:null;
    setState({...identity,snapshot:backup,error:null,phase:'starting',progress:null,elapsedMs:0});
    const finish=(snapshot:UVSnapshot|null,error:string|null,phase:UVPhase)=>{
      if(disposed||done)return;done=true;clearInterval(clock);
      if(snapshot)completed.current={mesh,snapshot};else if(backup)snapshot=backup;
      setState(previous=>({...identity,snapshot,error,phase,progress:previous?.progress??null,elapsedMs:performance.now()-start}));
    };
    const clock=setInterval(()=>{if(!disposed&&!done)setState(previous=>previous?{...previous,elapsedMs:performance.now()-start}:previous);},500);
    const timer=setTimeout(()=>{
      if(disposed||done)return;
      job=startUVJob({mesh,edges:[...edges],target,config,seedCharts},{
        createWorker:()=>new Worker(new URL('../workers/uv.worker.ts',import.meta.url),{type:'module'}),
        onProgress:progress=>{if(!disposed&&!done)setState({...identity,snapshot:backup,error:null,phase:'running',progress,elapsedMs:performance.now()-start});}
      });
      void job.result.then(snapshot=>finish(snapshot,null,'completed'),error=>{
        const phase=error instanceof UVJobFailure?(error.code==='cancelled'?'cancelled':error.code==='timeout'?'timeout':'error'):'error';
        finish(null,error instanceof Error?error.message:String(error),phase);
      });
    },100);
    const cancel=()=>{clearTimeout(timer);if(job)job.cancel();else finish(null,'已取消 UV 计算；原网格未修改。','cancelled');};
    cancelRef.current=cancel;
    return()=>{disposed=true;clearTimeout(timer);clearInterval(clock);job?.cancel();if(cancelRef.current===cancel)cancelRef.current=()=>{};};
  },[mesh,edges,target,config,seedCharts,retry]);
  const current=state?.mesh===mesh&&state.edges===edges&&state.target===target&&state.config===config&&state.seedCharts===seedCharts?state:null;
  const phase=current?.phase??'starting';
  return {snapshot:current?.snapshot??null,error:current?.error??null,phase,loading:phase==='starting'||phase==='running',progress:current?.progress??null,elapsedMs:current?.elapsedMs??0,cancel:()=>cancelRef.current(),retry:()=>setRetry(x=>x+1)};
}
