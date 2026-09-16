import type { UVWork } from './work.js';
import type { Vec2 } from '@meshtailor/mesh-core';
export const signedArea2=(a:Vec2,b:Vec2,c:Vec2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export interface UVQuality { triangles:number; flipped:number; degenerate:number; overlaps:number; area:number; valid:boolean }
/** Positive-area intersection, not shared-edge/vertex contact. Both triangles must be nondegenerate. */
function overlaps(a:Vec2[],b:Vec2[],epsilon:number):boolean{
  for(const t of [a,b])for(let k=0;k<3;k++){
    const p=t[k]!,q=t[(k+1)%3]!,nx=-(q[1]-p[1]),ny=q[0]-p[0],len=Math.hypot(nx,ny);
    if(len===0)continue;
    const aa=a.map(v=>(v[0]*nx+v[1]*ny)/len),bb=b.map(v=>(v[0]*nx+v[1]*ny)/len);
    if(Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))<=epsilon)return false;
  }
  return true;
}
/** Scale-normalized checks with a spatial grid; no silent sampled overlap test.
 * SAT contact tolerance 1e-12 rejects thin positive slivers from similarity joins
 * that the older 1e-10 tolerance admitted; exact edge contact remains allowed. */
export function checkUVTriangles(faces: readonly [Vec2,Vec2,Vec2][], maxOverlapCount=100,work?:UVWork,onOverlap?:(a:number,b:number)=>void):UVQuality{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const f of faces)for(const p of f){if(!p.every(Number.isFinite))return {triangles:faces.length,flipped:0,degenerate:faces.length,overlaps:0,area:0,valid:false};minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
  const span=Math.max(maxX-minX,maxY-minY,1e-30),norm=faces.map(f=>f.map(p=>[(p[0]-minX)/span,(p[1]-minY)/span] as Vec2));
  let flipped=0,degenerate=0,area=0,overlapCount=0;
  const usable:boolean[]=[];
  for(const f of norm){const a=signedArea2(f[0]!,f[1]!,f[2]!);if(a< -1e-12)flipped++;if(Math.abs(a)<=1e-12)degenerate++;area+=Math.abs(a)*.5*span*span;usable.push(Math.abs(a)>1e-12);}
  const size=Math.max(1,Math.min(96,Math.ceil(Math.sqrt(faces.length)))),grid=new Map<number,number[]>();
  for(let i=0;i<norm.length;i++){
    if(i%64===0)work?.check();
    if(!usable[i])continue;const t=norm[i]!,xs=t.map(p=>p[0]),ys=t.map(p=>p[1]);
    const x0=Math.floor(Math.min(...xs)*size),x1=Math.min(size-1,Math.floor(Math.max(...xs)*size)),y0=Math.floor(Math.min(...ys)*size),y1=Math.min(size-1,Math.floor(Math.max(...ys)*size));
    const candidates=new Set<number>();for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)for(const j of grid.get(y*size+x)??[])candidates.add(j);
    for(const j of candidates)if(overlaps(t,norm[j]!,1e-12)){overlapCount++;onOverlap?.(i,j);if(overlapCount>=maxOverlapCount)break;}
    if(overlapCount>=maxOverlapCount)break;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const key=y*size+x,list=grid.get(key)??[];list.push(i);grid.set(key,list);}
  }
  return {triangles:faces.length,flipped,degenerate,overlaps:overlapCount,area,valid:flipped===0&&degenerate===0&&overlapCount===0};
}
