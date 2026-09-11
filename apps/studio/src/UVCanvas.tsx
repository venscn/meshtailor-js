import { useEffect, useRef } from 'react';
import type { UVSnapshot } from './workers/uv.worker';
import { drawUVSnapshot, pickUVFace } from './unfold/uv-drawing';
interface Props {
  snapshot:UVSnapshot|null;
  status:string|null;
  selected:readonly number[];
  focusFace?:number|null;
  checker?:boolean;
  wireframe?:boolean;
  onPick?:(id:number,face:number|null,additive:boolean)=>void;
}
/** This view ONLY draws a shared snapshot; it must never run its own UV worker. */
export function UVCanvas({snapshot,status,selected,focusFace=null,checker=false,wireframe=false,onPick}:Props){
  const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const el=host.current,c=canvas.current;if(!el||!c)return;
    const ctx=c.getContext('2d');if(!ctx)return;
    const draw=()=>{
      const w=el.clientWidth,h=el.clientHeight;if(w<=0||h<=0)return;
      const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(w*dpr)),height=Math.max(1,Math.round(h*dpr));
      if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;
      ctx.setTransform(width/w,0,0,height/h,0,0);
      ctx.fillStyle='#090c11';ctx.fillRect(0,0,w,h);
      if(snapshot)drawUVSnapshot(ctx,snapshot,w,h,{selected,focusFace,checker,wireframe});
    };
    const observer=new ResizeObserver(draw);observer.observe(el);window.addEventListener('resize',draw);draw();
    return()=>{observer.disconnect();window.removeEventListener('resize',draw);};
  },[snapshot,selected,focusFace,checker,wireframe]);
  return <div ref={host} className="uv-viewport"><canvas ref={canvas} className="uv-canvas" aria-label="UV chart preview" onClick={e=>{
    if(!snapshot||!onPick||!canvas.current)return;const r=canvas.current.getBoundingClientRect(),hit=pickUVFace(snapshot,r.width,r.height,e.clientX-r.left,e.clientY-r.top,selected);
    if(hit)onPick(hit.id,hit.face,e.shiftKey||e.ctrlKey||e.metaKey);
  }}/>{status&&<div className="uv-status" role="status">{status}</div>}</div>;
}
