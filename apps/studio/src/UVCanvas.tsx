import { useEffect, useRef } from 'react';
import type { UVSnapshot } from './workers/uv.worker';
import { attachUVSelection, type BoxMode } from './unfold/uv-box-selection';
import { drawUVSnapshot } from './unfold/uv-drawing';
interface Props {
  snapshot:UVSnapshot|null;
  status:string|null;
  selected:readonly number[];
  focusFace?:number|null;
  checker?:boolean;
  wireframe?:boolean;
  onBox?:(ids:number[],mode:BoxMode)=>void;
  onPick?:(id:number,face:number|null,additive:boolean)=>void;
}
/** This view ONLY draws a shared snapshot; it must never run its own UV worker. */
export function UVCanvas({snapshot,status,selected,focusFace=null,checker=false,wireframe=false,onPick,onBox}:Props){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const state=useRef({snapshot,selected,onPick,onBox});state.current={snapshot,selected,onPick,onBox};
  useEffect(()=>{if(!canvas.current)return;return attachUVSelection(canvas.current,()=>state.current,(ids,mode)=>state.current.onBox?.(ids,mode),(...args)=>state.current.onPick?.(...args));},[]);
  useEffect(()=>{
    const el=host.current,c=canvas.current;if(!el||!c)return;
    const ctx=c.getContext('2d');if(!ctx)return;
    const draw=()=>{
      const w=el.clientWidth,h=el.clientHeight;if(w<=0||h<=0)return;
      const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));
      if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;
      ctx.setTransform(width/w,0,0,height/h,0,0);
      ctx.fillStyle='#1b1d1f';ctx.fillRect(0,0,w,h);
      if(snapshot)drawUVSnapshot(ctx,snapshot,w,h,{selected,focusFace,checker,wireframe});
    };
    const observer=new ResizeObserver(draw);observer.observe(el);window.addEventListener('resize',draw);draw();
    return()=>{observer.disconnect();window.removeEventListener('resize',draw);};
  },[snapshot,selected,focusFace,checker,wireframe]);
  return <div ref={host} className="uv-viewport"><canvas ref={canvas} className="uv-canvas" aria-label="UV chart preview"/><div className="uv-box-hint">拖拽框选 · Shift 加选 · Alt 反选 · Ctrl/⌘ 减选</div>{status&&<div className="uv-status" role="status">{status}</div>}</div>;
}
