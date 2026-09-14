import { useEffect, useRef, useState } from 'react';
import type { UnfoldGeometry } from '@meshtailor/uv';
import { UnfoldWebGLView, type UnfoldDisplay } from './webgl-view';
interface Props { geometry:UnfoldGeometry|null; options:UnfoldDisplay; onPick:(id:number,face:number|null,additive:boolean)=>void; cameraCommand:{kind:'orbit'|'uv'|'current';key:number}; sceneKey:object; onCameraManual:()=>void; status:string|null }
export function UnfoldViewport({geometry,options,onPick,cameraCommand,sceneKey,onCameraManual,status}:Props){
  const host=useRef<HTMLDivElement>(null),view=useRef<UnfoldWebGLView|null>(null),pick=useRef(onPick);pick.current=onPick;
  // Keep callbacks current without rebuilding the renderer on animation renders.
  const manual=useRef(onCameraManual);manual.current=onCameraManual;
  const scene=useRef(sceneKey);scene.current=sceneKey;
  const framedScene=useRef<object|undefined>(undefined);
  const [error,setError]=useState<string|null>(null),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!host.current)return;
    try{framedScene.current=undefined;view.current=new UnfoldWebGLView(host.current,(...args)=>pick.current(...args),setError,()=>manual.current());}
    catch(error){setError(error instanceof Error?error.message:String(error));}
    return()=>{view.current?.dispose();view.current=null;};
  },[retry]);
  useEffect(()=>{try{
    // Re-solving UV for the same source mesh preserves the user's camera. A newly
    // loaded mesh gets one initial fit, never a fit on each playback render.
    view.current?.setGeometry(geometry,{resetCamera:framedScene.current!==scene.current});
    if(geometry)framedScene.current=scene.current;
  }catch(error){setError(String(error));}},[geometry,retry]);
  useEffect(()=>{try{view.current?.setOptions(options);}catch(error){setError(String(error));}},[geometry,options,retry]);
  useEffect(()=>{if(cameraCommand.key===0)return;
    if(cameraCommand.kind==='current')view.current?.fitCurrent();else view.current?.fit(cameraCommand.kind);
  },[cameraCommand,retry]);
  return <div ref={host} className="viewport unfold-viewport" data-testid="unfold-viewport">
    {error?<div className="viewport-error" role="alert"><strong>展开视图不可用</strong><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>Retry unfold preview</button></div>:status?<div className="uv-status" role="status">{status}</div>:<>
      <div className="unfold-badge"><b>{Math.round(options.progress*100)}%</b><span>{options.order==='sequential'?'严格逐岛':'尾段接力'} · {options.selected.length} 个岛</span></div>
      <div className="hinge-legend">黄色：UV 裁切 · 青色：铰链轴 · 紫色虚线：临时断边（不导出）</div>
      <div className="viewport-hint">播放时也可自由操作：拖动旋转 · 滚轮缩放 · 右键平移 · 点击选岛 · Shift/Ctrl/⌘ 多选</div>
    </>}
  </div>;
}
