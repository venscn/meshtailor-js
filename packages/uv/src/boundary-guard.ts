import type {Vec2} from '@meshtailor/mesh-core';
import type {UVWork} from './work.js';

/** Check ALL non-neighbour boundary segments, not a sampled vertex test. For a
 * disk with positive triangle Jacobians, a simple boundary is the missing
 * global injectivity condition. The final triangle checker remains mandatory.
 * The sweep is scale-normalized and rejects touches between non-neighbours. */
export function simpleUVBoundary(uv:readonly Vec2[],loops:readonly (readonly number[])[],work?:UVWork):boolean {
  if(!loops.length)return false;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const loop of loops)for(const v of loop){const p=uv[v];if(!p||!p.every(Number.isFinite))return false;x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);}
  const span=Math.max(x1-x0,y1-y0);if(!(span>0))return false;
  type Edge={a:number;b:number;p:Vec2;q:Vec2;lo:number;hi:number;bottom:number;top:number};
  const edges:Edge[]=[];
  for(const loop of loops){if(loop.length<3)return false;for(let i=0;i<loop.length;i++){
    const a=loop[i]!,b=loop[(i+1)%loop.length]!,p=[(uv[a]![0]-x0)/span,(uv[a]![1]-y0)/span] as Vec2,q=[(uv[b]![0]-x0)/span,(uv[b]![1]-y0)/span] as Vec2;
    if(Math.hypot(p[0]-q[0],p[1]-q[1])<1e-13)return false;
    edges.push({a,b,p,q,lo:Math.min(p[0],q[0]),hi:Math.max(p[0],q[0]),bottom:Math.min(p[1],q[1]),top:Math.max(p[1],q[1])});
  }}
  edges.sort((a,b)=>a.lo-b.lo||a.bottom-b.bottom);let active:Edge[]=[];const eps=1e-12;
  const side=(a:Vec2,b:Vec2,c:Vec2)=>((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/Math.max(Math.hypot(b[0]-a[0],b[1]-a[1]),1e-30);
  for(let i=0;i<edges.length;i++){
    if((i&127)===0)work?.check();const e=edges[i]!;active=active.filter(a=>a.hi>=e.lo-eps);
    for(const a of active){if(a.a===e.a||a.a===e.b||a.b===e.a||a.b===e.b)continue;if(a.top<e.bottom-eps||e.top<a.bottom-eps)continue;
      const p=side(a.p,a.q,e.p),q=side(a.p,a.q,e.q),r=side(e.p,e.q,a.p),s=side(e.p,e.q,a.q);
      if((p>eps&&q>eps)||(p< -eps&&q< -eps)||(r>eps&&s>eps)||(r< -eps&&s< -eps))continue;
      return false;
    }active.push(e);
  }
  return true;
}
