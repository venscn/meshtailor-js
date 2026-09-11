import { islandColor, type AtlasFrame } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
export interface UVDisplay { selected:readonly number[]; focusFace:number|null; checker:boolean; wireframe:boolean }
export function uvScreenFrame(atlas:AtlasFrame,width:number,height:number){
  const sx=atlas.max[0]-atlas.min[0],sy=atlas.max[1]-atlas.min[1];
  const scale=Math.max(.01,Math.min(Math.max(1,width-44)/sx,Math.max(1,height-68)/sy));
  return {scale,ox:(width-sx*scale)/2-atlas.min[0]*scale,oy:(height-sy*scale)/2+atlas.max[1]*scale+8};
}
export function drawUVSnapshot(ctx:CanvasRenderingContext2D,snapshot:UVSnapshot,width:number,height:number,options:UVDisplay){
  const {packed,geometry}=snapshot,{scale,ox,oy}=uvScreenFrame(geometry.atlas,width,height);
  const active=new Set(options.selected);
  ctx.fillStyle='#090c11';ctx.fillRect(0,0,width,height);
  const point=(u:number,v:number)=>[ox+u*scale,oy-v*scale];
  ctx.strokeStyle='#344352';ctx.lineWidth=1;
  ctx.strokeRect(ox+geometry.atlas.min[0]*scale,oy-geometry.atlas.max[1]*scale,(geometry.atlas.max[0]-geometry.atlas.min[0])*scale,(geometry.atlas.max[1]-geometry.atlas.min[1])*scale);
  const ordered=[...packed.filter(c=>!active.has(c.id)),...packed.filter(c=>active.has(c.id))];
  for(const chart of ordered){
    const color=islandColor(chart.id).map(x=>Math.round(x*255)),selected=active.has(chart.id);
    for(const [fi,uvs]of chart.faceUVs){
      ctx.beginPath();uvs.forEach(([u,v],k)=>{const [x,y]=point(u,v);if(k)ctx.lineTo(x!,y!);else ctx.moveTo(x!,y!);});ctx.closePath();
      ctx.fillStyle=`rgba(${color.join(',')},${selected?.86:.16})`;ctx.fill();
      if(options.wireframe){ctx.lineWidth=.5;ctx.strokeStyle=`rgba(${color.join(',')},${selected?.7:.2})`;ctx.stroke();}
      if(fi===options.focusFace){ctx.lineWidth=2;ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff55';ctx.fill();ctx.stroke();}
    }
  }
  if(options.checker){
    // Canvas pattern is aligned to absolute UV units, like the shader's 16x16 grid.
    const tile=Math.max(.01,scale/16),patternCanvas=document.createElement('canvas');
    patternCanvas.width=32;patternCanvas.height=32;
    const pc=patternCanvas.getContext('2d')!;pc.fillStyle='#0000004c';pc.fillRect(0,0,16,16);pc.fillRect(16,16,16,16);
    const pattern=ctx.createPattern(patternCanvas,'repeat');
    if(pattern){pattern.setTransform(new DOMMatrix().translate(ox,oy).scale(tile/16,-tile/16));
      ctx.save();ctx.beginPath();for(const c of ordered)for(const uvs of c.faceUVs.values()){const [a,b,c]=uvs;const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);const points=area<0?[a,c,b]:uvs;points.forEach(([u,v],k)=>{const [x,y]=point(u,v);if(k)ctx.lineTo(x!,y!);else ctx.moveTo(x!,y!);});ctx.closePath();}ctx.clip();ctx.fillStyle=pattern;ctx.fillRect(0,0,width,height);ctx.restore();}
  }
  ctx.beginPath();ctx.strokeStyle='#ffca71';ctx.lineWidth=1.3;
  for(let i=0;i<geometry.boundaries.length;i+=2){const a=geometry.boundaries[i]!,b=geometry.boundaries[i+1]!;if(!active.has(geometry.faceChart[Math.floor(a/3)]!))continue;ctx.moveTo(ox+geometry.uv[a*2]!*scale,oy-geometry.uv[a*2+1]!*scale);ctx.lineTo(ox+geometry.uv[b*2]!*scale,oy-geometry.uv[b*2+1]!*scale);}
  ctx.stroke();
  ctx.font='11px ui-monospace, monospace';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const chart of packed.filter(c=>active.has(c.id)).slice(0,48)){
    const x=ox+(chart.bounds[0]+chart.bounds[2])/2*scale,y=oy-(chart.bounds[1]+chart.bounds[3])/2*scale;
    const label='#'+(chart.id+1),w=ctx.measureText(label).width+8;
    ctx.fillStyle='#09111bd9';ctx.fillRect(x-w/2,y-8,w,16);ctx.fillStyle='#e0edff';ctx.fillText(label,x,y);
  }
  ctx.textAlign='left';ctx.fillStyle='#bac7db';ctx.fillText(`${packed.length} 个 UV 岛 · 同色同编号`,12,17);
  ctx.fillStyle='#73849a';ctx.font='10px ui-monospace, monospace';ctx.fillText('U →  ·  V ↑  ·  点击面片联动 / Shift 多选',12,height-12);
}
/** Match draw ordering (selected charts are on top); list selection handles overlapping islands. */
export function pickUVFace(snapshot:UVSnapshot,width:number,height:number,x:number,y:number,selected:readonly number[]):{id:number;face:number}|null{
  const {scale,ox,oy}=uvScreenFrame(snapshot.geometry.atlas,width,height),u=(x-ox)/scale,v=(oy-y)/scale,active=new Set(selected);
  const ordered=[...snapshot.packed.filter(c=>!active.has(c.id)),...snapshot.packed.filter(c=>active.has(c.id))];
  for(let i=ordered.length-1;i>=0;i--){const chart=ordered[i]!;
    if(u<chart.bounds[0]||u>chart.bounds[2]||v<chart.bounds[1]||v>chart.bounds[3])continue;
    const faces=[...chart.faceUVs];for(let k=faces.length-1;k>=0;k--){const [fi,[a,b,c]]=faces[k]!;
      const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-16)continue;
      const s=((b[1]-c[1])*(u-c[0])+(c[0]-b[0])*(v-c[1]))/den;
      const t=((c[1]-a[1])*(u-c[0])+(a[0]-c[0])*(v-c[1]))/den;
      if(s>=-1e-8&&t>=-1e-8&&s+t<=1+1e-8)return {id:chart.id,face:fi};
    }
  }
  return null;
}
