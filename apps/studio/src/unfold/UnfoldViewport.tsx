import { useEffect, useRef, useState } from 'react';
import type { UnfoldGeometry } from '@meshtailor/uv';
import { UnfoldWebGLView, type UnfoldDisplay } from './webgl-view';
interface Props { geometry:UnfoldGeometry|null; options:UnfoldDisplay; onPick:(id:number,face:number|null,additive:boolean)=>void; cameraCommand:{kind:'orbit'|'uv';key:number}; status:string|null }
export function UnfoldViewport({geometry,options,onPick,cameraCommand,status}:Props){
  const host=useRef<HTMLDivElement>(null),view=useRef<UnfoldWebGLView|null>(null),pick=useRef(onPick);pick.current=onPick;
  const [error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!host.current)return;
    try{view.current=new UnfoldWebGLView(host.current,(...args)=>pick.current(...args),setError);}
    catch(error){setError(error instanceof Error?error.message:String(error));}
    return()=>{view.current?.dispose();view.current=null;};
  },[retry]);
  useEffect(()=>{try{view.current?.setGeometry(geometry);}catch(error){setError(String(error));}},[geometry,retry]);
  useEffect(()=>{try{view.current?.setOptions(options);}catch(error){setError(String(error));}},[geometry,options,retry]);
  useEffect(()=>{view.current?.fit(cameraCommand.kind);},[cameraCommand,retry]);
  return <div ref={host} className="viewport unfold-viewport" data-testid="unfold-viewport">
    {error?<div className="viewport-error" role="alert"><strong>展开视图不可用</strong><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry unfold preview</button></div>:status?<div className="uv-status" role="status">{status}</div>:<>
      <div className="unfold-badge"><b>{Math.round(options.progress*100)}%</b><span>{options.order==='sequential'?'逐个展开':'同时展开'} · {options.selected.length} 个岛</span></div>
      <div className="viewport-hint">拖动旋转 · 滚轮缩放 · 右键平移 · 点击选岛 · Shift/Ctrl/⌘ 多选</div>
    </>}
  </div>;
}
