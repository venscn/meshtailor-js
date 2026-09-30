import type {Vec2} from '@meshtailor/mesh-core';
import type {CutMesh} from './cut-topology.js';
import type {UVWork} from './work.js';

/** Develop a disk's intrinsic edge metric, not its world-space silhouette.
 * Restricted to boundary-dominated sheets: a bent ribbon should not be mapped
 * via a tiny circular end opening. Conflicting cycles are measured, never torn
 * or silently overwritten. The caller must still validate the complete map.
 */
export function intrinsicStripSeed(mesh:CutMesh,work?:UVWork):Vec2[]|undefined {
  const {positions,triangles}=mesh;
  if(!mesh.disk||triangles.length>4096||mesh.boundary.length<positions.length*.8)return;
  const distance=(a:number,b:number)=>Math.hypot(...positions[a]!.map((x,k)=>x-positions[b]![k]!));
  const adj=new Map<string,number[]>(),key=(a:number,b:number)=>a<b?`${a}:${b}`:`${b}:${a}`;
  let root=0,best=0;
  triangles.forEach((t,i)=>{const [a,b,c]=t.map(v=>positions[v]!),u=b!.map((x,k)=>x-a![k]!),v=c!.map((x,k)=>x-a![k]!),area=Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!);if(area>best){best=area;root=i;}for(let k=0;k<3;k++){const e=key(t[k]!,t[(k+1)%3]!),list=adj.get(e)??[];list.push(i);adj.set(e,list);}});
  const uv:(Vec2|undefined)[]=Array(positions.length),t=triangles[root]!;uv[t[0]]=[0,0];uv[t[1]]=[distance(t[0],t[1]),0];
  const queue=[root],seen=new Set<number>();
  for(let h=0;h<queue.length;h++){
    if((h&127)===0)work?.check();const fi=queue[h]!;if(seen.has(fi))continue;const tri=triangles[fi]!,k=tri.findIndex((v,j)=>uv[v]&&uv[tri[(j+1)%3]!]);if(k<0)continue;seen.add(fi);
    const a=tri[k]!,b=tri[(k+1)%3]!,c=tri[(k+2)%3]!;
    if(!uv[c]){const A=uv[a]!,B=uv[b]!,d=Math.hypot(B[0]-A[0],B[1]-A[1]),l=distance(a,c),r=distance(b,c);if(!(d>1e-20))return;const x=(l*l-r*r+d*d)/(2*d),y2=l*l-x*x;if(y2< -l*l*1e-8)return;const y=Math.sqrt(Math.max(0,y2)),ex=(B[0]-A[0])/d,ey=(B[1]-A[1])/d;uv[c]=[A[0]+x*ex-y*ey,A[1]+x*ey+y*ex];}
    for(let j=0;j<3;j++)for(const f of adj.get(key(tri[j]!,tri[(j+1)%3]!))??[])if(!seen.has(f))queue.push(f);
  }
  if(seen.size!==triangles.length||uv.some(p=>!p||!p.every(Number.isFinite)))return;
  // Only near-isometric metrics qualify. Approximate free surfaces are not
  // accepted because one spanning tree happened to draw an attractive outline.
  for(const tri of triangles)for(let k=0;k<3;k++){const a=tri[k]!,b=tri[(k+1)%3]!,A=uv[a]!,B=uv[b]!,ratio=Math.hypot(B[0]-A[0],B[1]-A[1])/distance(a,b);if(ratio<.998||ratio>1.002)return;}
  return uv as Vec2[];
}
