import type {Vec2} from '@meshtailor/mesh-core';
import type {ShapeMask,RasterWork} from './shape-raster.js';
export type ContourEdges = [Vec2,Vec2][];
/** Exact coordinate incidence only: rounding near vertices together could close
 * a genuine narrow slit. Ambiguous topology falls back to triangle rastering. */
export function contourEdges(triangles:readonly (readonly Vec2[])[]):ContourEdges|null {
  const key=([x,y]:Vec2)=>`${Object.is(x,-0)?0:x},${Object.is(y,-0)?0:y}`;
  const edges=new Map<string,{a:Vec2;b:Vec2;from:string;to:string;n:number}>();
  for(const t of triangles)for(let k=0;k<3;k++){
    const a=t[k]!,b=t[(k+1)%3]!,u=key(a),v=key(b);if(u===v)return null;
    const id=u<v?`${u}|${v}`:`${v}|${u}`,prev=edges.get(id);
    if(prev){if(prev.n!==1||prev.from!==v||prev.to!==u)return null;prev.n++;}
    else edges.set(id,{a,b,from:u,to:v,n:1});
  }
  const degree=new Map<string,{in:number;out:number}>(),boundary:ContourEdges=[];
  for(const e of edges.values())if(e.n===1){
    boundary.push([e.a,e.b]);const a=degree.get(e.from)??{in:0,out:0},b=degree.get(e.to)??{in:0,out:0};a.out++;b.in++;degree.set(e.from,a);degree.set(e.to,b);
  }
  if(!boundary.length||[...degree.values()].some(v=>v.in!==1||v.out!==1))return null;
  return boundary;
}
/** Conservative union raster from an already validated chart boundary. Interior
 * pixels + ALL boundary-touched pixels cover the domain, including holes and
 * concavities, without repeatedly rasterizing tens of thousands of inner faces.
 * All final layouts are still checked on the original triangles. */
export function rasterContour(edges:ContourEdges,width:number,height:number,gain:number,resolution:number,work?:RasterWork):ShapeMask|null {
  const scale=Math.sqrt(gain)*resolution,w=Math.floor(width*scale)+1,h=Math.floor(height*scale)+1;
  if(w>resolution||h>resolution)return null;
  const stride=Math.ceil(w/32),words=new Uint32Array(stride*h),crossings:number[][]=Array.from({length:h},()=>[]);
  const paint=(row:number,lo:number,hi:number)=>{
    lo=Math.max(0,Math.floor(lo));hi=Math.min(w-1,Math.floor(hi));if(hi<lo||row<0||row>=h)return;
    const a=lo>>>5,b=hi>>>5,offset=row*stride;
    if(a===b){words[offset+a]!|=(0xffffffff<<(lo&31))&(0xffffffff>>>(31-(hi&31)));return;}
    words[offset+a]!|=0xffffffff<<(lo&31);for(let j=a+1;j<b;j++)words[offset+j]=0xffffffff;words[offset+b]!|=0xffffffff>>>(31-(hi&31));
  };
  for(const [p,q]of edges){work?.tick();const a=[p[0]*scale,p[1]*scale],b=[q[0]*scale,q[1]*scale],dy=b[1]!-a[1]!;
    const lo=Math.max(0,Math.floor(Math.min(a[1]!,b[1]!))),hi=Math.min(h-1,Math.floor(Math.max(a[1]!,b[1]!)));
    for(let y=lo;y<=hi;y++){
      // Boundary raster is the same closed strip convention as rasterShape.
      let min=Infinity,max=-Infinity;
      for(const p of [a,b])if(p[1]!>=y&&p[1]!<=y+1){min=Math.min(min,p[0]!);max=Math.max(max,p[0]!);}
      if(dy!==0)for(const line of [y,y+1]){const t=(line-a[1]!)/dy;if(t>=0&&t<=1){const x=a[0]!+t*(b[0]!-a[0]!);min=Math.min(min,x);max=Math.max(max,x);}}
      if(min!==Infinity)paint(y,min,max);
      const center=y+.5;
      if((a[1]!<=center&&b[1]!>center)||(b[1]!<=center&&a[1]!>center))crossings[y]!.push(a[0]!+(center-a[1]!)*(b[0]!-a[0]!)/dy);
    }
  }
  for(let y=0;y<h;y++){work?.tick();const xs=crossings[y]!.sort((a,b)=>a-b);if(xs.length%2)throw Error('Contour parity is inconsistent; no partial mask accepted.');for(let i=0;i<xs.length;i+=2)paint(y,xs[i]!,xs[i+1]!);}
  const occupied:ShapeMask['occupied']=[],runs:ShapeMask['runs']=[];
  for(let y=0;y<h;y++){
    for(let j=0;j<stride;j++){const bits=words[y*stride+j]!;if(bits)occupied.push({row:y,word:j,bits});}
    let lo=-1;for(let x=0;x<=w;x++){const on=x<w&&(words[y*stride+(x>>>5)]!&(1<<(x&31)))!==0;if(on&&lo<0)lo=x;if(!on&&lo>=0){runs.push({row:y,lo,hi:x-1});lo=-1;}}
  }
  return{width:w,height:h,stride,words,pad:0,occupied,runs};
}
