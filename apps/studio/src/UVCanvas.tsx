import { useEffect, useRef } from 'react';
import type { MeshData } from '@meshtailor/mesh-core';
import { buildCharts, planarPackPreview } from '@meshtailor/uv';

export function UVCanvas({mesh,seamEdges}:{mesh:MeshData;seamEdges:Set<string>}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);canvas.width=Math.max(1,rect.width*dpr);canvas.height=Math.max(1,rect.height*dpr);
    const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);const w=rect.width,h=rect.height;ctx.fillStyle='#0b0d12';ctx.fillRect(0,0,w,h);
    const charts=buildCharts(mesh,seamEdges),packed=planarPackPreview(mesh,charts);const s=Math.min(w,h)*.9,ox=(w-s)/2,oy=(h-s)/2;
    ctx.strokeStyle='#2b3140';ctx.strokeRect(ox,oy,s,s);
    for(const chart of packed){
      const hue=(chart.id*67)%360;
      for(const [fi,uvs] of chart.faceUVs){ctx.beginPath();uvs.forEach((uv,i)=>{const x=ox+uv[0]*s,y=oy+(1-uv[1])*s;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.fillStyle=`hsla(${hue},55%,55%,.25)`;ctx.fill();ctx.strokeStyle=`hsla(${hue},70%,72%,.72)`;ctx.lineWidth=.7;ctx.stroke();}
    }
    ctx.fillStyle='#a8b0c2';ctx.font='12px ui-monospace, monospace';ctx.fillText(`${charts.length} chart${charts.length===1?'':'s'} · planar debug preview`,12,20);
  },[mesh,seamEdges]);
  return <canvas ref={ref} className="uv-canvas"/>;
}
