import {openHandles} from './handle-cuts.js';
import { edgeKey, type MeshData } from '@meshtailor/mesh-core';
import { cutLocalMesh, type CutMesh } from './cut-topology.js';
import { uvProgress, type UVWork } from './work.js';
class Heap {
  data:[number,number][]=[];
  push(v:number,d:number){const a=this.data;let i=a.length;a.push([v,d]);while(i){const p=(i-1)>>1;if(a[p]![1]<=d)break;a[i]=a[p]!;i=p;}a[i]=[v,d];}
  pop(){const a=this.data,r=a[0]!,last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let k=i*2+1;if(k+1<a.length&&a[k+1]![1]<a[k]![1])k++;if(a[k]![1]>=last[1])break;a[i]=a[k]!;i=k;}a[i]=last;}return r;}
}
function shortest(local:CutMesh,starts:readonly number[],targets?:Set<number>,work?:UVWork){
  const adj:Map<number,number>[]=Array.from({length:local.positions.length},()=>new Map());
  for(const t of local.triangles)for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,p=local.positions[a]!,q=local.positions[b]!,w=Math.hypot(...p.map((x,i)=>x-q[i]!));adj[a]!.set(b,w);adj[b]!.set(a,w);}
  const distance=new Float64Array(adj.length).fill(Infinity),prev=new Int32Array(adj.length).fill(-1),heap=new Heap();
  for(const s of starts){distance[s]=0;heap.push(s,0);}let found=-1,visited=0;
  while(heap.data.length){const [v,d]=heap.pop();if(d!==distance[v])continue;if(visited++%512===0)work?.check();found=v;if(targets?.has(v))break;
    for(const [j,w]of adj[v]!){const next=d+w;if(next<distance[j]!){distance[j]=next;prev[j]=v;heap.push(j,next);}}
  }
  if(found<0||targets&&!targets.has(found))return [];
  const path=[found];while(prev[path.at(-1)!]!>=0)path.push(prev[path.at(-1)!]!);return path.reverse();
}
/** Direction is part of the search state. A vertex-only shortest path cannot
 * penalize alternating left/right turns, and therefore produces zipper seams on
 * otherwise smooth triangulations. This search changes real cut edges only. */
function smoothPath(local:CutMesh,starts:readonly number[],targets:Set<number>,work?:UVWork,guide?:readonly [number,number]){
  const n=local.positions.length,neighbors:Set<number>[]=Array.from({length:n},()=>new Set());
  for(const t of local.triangles)for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!;neighbors[a]!.add(b);neighbors[b]!.add(a);}
  const states:{previous:number;vertex:number;distance:number;parent:number}[]=[],ids=new Map<number,number>(),heap=new Heap();
  const ga=guide?local.positions[guide[0]]:undefined,gb=guide?local.positions[guide[1]]:undefined;
  const direction=ga&&gb?gb.map((x,k)=>x-ga[k]!):undefined,len2=direction?.reduce((s,x)=>s+x*x,0)??1;
  const deviation=(p:readonly number[])=>{if(!ga||!direction)return 0;const t=Math.max(0,Math.min(1,p.reduce((s,x,k)=>s+(x-ga[k]!)*direction[k]!,0)/Math.max(len2,1e-30)));return p.reduce((s,x,k)=>s+(x-ga[k]!-t*direction[k]!)**2,0)/Math.max(len2,1e-30);};
  const state=(p:number,v:number)=>{const key=(p+1)*n+v;let id=ids.get(key);if(id===undefined){id=states.length;states.push({previous:p,vertex:v,distance:Infinity,parent:-1});ids.set(key,id);}return id;};
  for(const v of starts){const id=state(-1,v);states[id]!.distance=0;heap.push(id,0);}
  let end=-1,steps=0;
  while(heap.data.length){const[id,d]=heap.pop(),s=states[id]!;if(d!==s.distance)continue;if((steps++&511)===0)work?.check();if(targets.has(s.vertex)){end=id;break;}
    const p=local.positions[s.vertex]!;
    for(const v of neighbors[s.vertex]!){if(v===s.previous)continue;const q=local.positions[v]!,out=q.map((x,k)=>x-p[k]!),l=Math.hypot(...out);let turn=0;
      if(s.previous>=0){const old=local.positions[s.previous]!,incoming=p.map((x,k)=>x-old[k]!),a=Math.hypot(...incoming),cos=incoming.reduce((sum,x,k)=>sum+x*out[k]!,0)/Math.max(a*l,1e-30);turn=1.5*Math.min(a,l)*(1-Math.max(-1,Math.min(1,cos)))**2;}
      const next=state(s.vertex,v),cost=d+l+turn+(guide?l*12*(deviation(p)+deviation(q))/2:0);if(cost<states[next]!.distance){states[next]!.distance=cost;states[next]!.parent=id;heap.push(next,cost);}
    }
  }
  if(end<0)return[];const path:number[]=[];for(let i=end;i>=0;i=states[i]!.parent)path.push(states[i]!.vertex);path.reverse();
  // Positive state costs may still revisit a spatial vertex with another heading.
  // Erase such loops before requesting cuts; never make a dangling mini-cycle.
  const clean:number[]=[];for(const v of path){const at=clean.indexOf(v);if(at>=0)clean.splice(at+1);else clean.push(v);}return clean;
}
/** Entire-path shape, not just successive edge turns. These are geometric
 * diagnostics; a curved surface need not admit a straight line on its edges. */
export function openingPathMetrics(local:Pick<CutMesh,'positions'>,path:readonly number[]){
  if(path.length<2)return{length:0,chord:0,relativeDeviation:0,turn:0};
  const a=local.positions[path[0]!]!,b=local.positions[path.at(-1)!]!,d=b.map((x,k)=>x-a[k]!),s=d.reduce((n,x)=>n+x*x,0);let length=0,dev=0,turn=0;
  for(let i=0;i<path.length;i++){const p=local.positions[path[i]!]!,t=Math.max(0,Math.min(1,p.reduce((n,x,k)=>n+(x-a[k]!)*d[k]!,0)/Math.max(s,1e-30)));dev=Math.max(dev,p.reduce((n,x,k)=>n+(x-a[k]!-t*d[k]!)**2,0));
    if(i){const q=local.positions[path[i-1]!]!,v=p.map((x,k)=>x-q[k]!),l=Math.hypot(...v);length+=l;
      if(i>1){const r=local.positions[path[i-2]!]!,u=q.map((x,k)=>x-r[k]!),L=Math.hypot(...u);turn+=Math.min(L,l)*(1-Math.max(-1,Math.min(1,u.reduce((n,x,k)=>n+x*v[k]!,0)/Math.max(L*l,1e-30))))**2;}
    }
  }
  return{length,chord:Math.sqrt(s),relativeDeviation:Math.sqrt(dev/Math.max(s,1e-30)),turn};
}
/** Compare a free opening against a soft chord corridor with the SAME endpoints.
 * The corridor only ranks real mesh edges. It cannot draw across a hole, move
 * vertices, or straighten genuine geometry by editing the UV outline. A long
 * detour / extra oscillation is rejected instead of blindly enforcing a line. */
export function directionalOpeningPath(local:CutMesh,starts:readonly number[],targets:Set<number>,work?:UVWork){
  const original=smoothPath(local,starts,targets,work);if(original.length<3)return original;
  const before=openingPathMetrics(local,original);if(before.relativeDeviation<.005)return original;
  const guided=smoothPath(local,[original[0]!],new Set([original.at(-1)!]),work,[original[0]!,original.at(-1)!]);
  if(guided.length<2)return original;const after=openingPathMetrics(local,guided);
  return after.relativeDeviation<before.relativeDeviation*.9&&after.length<=before.length*1.08&&after.turn<=before.turn*1.05+before.length*.002?guided:original;
}
/** Open annuli/multiple boundaries by short connecting slits, retaining ONE
 * face-connected chart. Closed genus-zero charts get a long geodesic slit.
 * Accept atomically only if the resulting face-corner topology is a disk.
 * Higher-genus/pinched input falls back to explicit partitioning; not a repair guarantee. */
export function openChartWithSlits(mesh:MeshData,faces:readonly number[],seams:ReadonlySet<string>,input:CutMesh,work?:UVWork):{local:CutMesh;added:string[]}|null {
  let local=input;const candidate=new Set(seams),added:string[]=[];
  if(local.disk)return{local,added};
  if(local.boundaryLoops>32)return null;
  if(local.euler!==2-local.boundaryLoops){
    const handle=openHandles(mesh,faces,candidate,local,work);if(!handle)return null;
    local=handle.local;for(const e of handle.added){candidate.add(e);added.push(e);}
  }
  for(let attempt=0;attempt<33&&!local.disk;attempt++){
    uvProgress(work,{stage:'topology',detail:'连接边界开缝，优先保留整块'});
    let path:number[]=[];
    if(local.boundaryLoops===0){const sweep=shortest(local,[0],undefined,work);if(!sweep.length)return null;const route=shortest(local,[sweep.at(-1)!],undefined,work);path=route.length?directionalOpeningPath(local,[route[0]!],new Set([route.at(-1)!]),work):[];}
    else if(local.boundaryLoops>1){const loops=[...local.boundaries].sort((a,b)=>b.length-a.length),targets=new Set(loops.slice(1).flat());path=directionalOpeningPath(local,loops[0]!,targets,work);}
    else return null;
    if(path.length<2)return null;let changed=false;
    for(let i=1;i<path.length;i++){const a=local.sourceVertices[path[i-1]!]!,b=local.sourceVertices[path[i]!]!,key=edgeKey(a,b);if(!candidate.has(key)){candidate.add(key);added.push(key);changed=true;}}
    if(!changed)return null;
    const next=cutLocalMesh(mesh,faces,candidate);
    if(!next.disk&&(next.boundaryLoops>=local.boundaryLoops&&local.boundaryLoops>0||next.euler!==2-next.boundaryLoops))return null;
    local=next;
  }
  return local.disk?{local,added}:null;
}
