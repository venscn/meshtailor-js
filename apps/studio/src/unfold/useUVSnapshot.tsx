import { useEffect, useState } from 'react';
import type { MeshData } from '@meshtailor/mesh-core';
import type { UVJob, UVResult, UVSnapshot, UVTarget } from '../workers/uv.worker';
interface State { mesh:MeshData; edges:Set<string>; target:UVTarget; snapshot:UVSnapshot|null; error:string|null }
/** One cancellable worker and one immutable snapshot shared by BOTH views. */
export function useUVSnapshot(mesh:MeshData,edges:Set<string>,target:UVTarget){
  const [state,setState]=useState<State|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    let disposed=false,worker:Worker|undefined;
    setState(null);
    const timer=setTimeout(()=>{
      const finish=(snapshot:UVSnapshot|null,error:string|null)=>{if(!disposed)setState({mesh,edges,target,snapshot,error});worker?.terminate();};
      try{
        worker=new Worker(new URL('../workers/uv.worker.ts',import.meta.url),{type:'module'});
        worker.onmessage=(event:MessageEvent<UVResult>)=>event.data.ok?finish(event.data.snapshot,null):finish(null,event.data.error);
        worker.onerror=event=>finish(null,'UV worker failed: '+event.message);
        worker.postMessage({mesh,edges:[...edges],target} satisfies UVJob);
      }catch(error){finish(null,String(error));}
    },100);
    return()=>{disposed=true;clearTimeout(timer);worker?.terminate();};
  },[mesh,edges,target,retry]);
  const current=state?.mesh===mesh&&state.edges===edges&&state.target===target?state:null;
  return {snapshot:current?.snapshot??null,error:current?.error??null,loading:!current,retry:()=>setRetry(x=>x+1)};
}
