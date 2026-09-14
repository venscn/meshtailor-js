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
/** Open annuli/multiple boundaries by short connecting slits, retaining ONE
 * face-connected chart. Closed genus-zero charts get a long geodesic slit.
 * Accept atomically only if the resulting face-corner topology is a disk.
 * Higher-genus/pinched input falls back to explicit partitioning; not a repair guarantee. */
export function openChartWithSlits(mesh:MeshData,faces:readonly number[],seams:ReadonlySet<string>,input:CutMesh,work?:UVWork):{local:CutMesh;added:string[]}|null {
  let local=input;const candidate=new Set(seams),added:string[]=[];
  if(local.disk)return{local,added};
  if(local.boundaryLoops>32||local.euler!==2-local.boundaryLoops)return null;
  for(let attempt=0;attempt<33&&!local.disk;attempt++){
    uvProgress(work,{stage:'topology',detail:'连接边界开缝，优先保留整块'});
    let path:number[]=[];
    if(local.boundaryLoops===0){const sweep=shortest(local,[0],undefined,work);if(!sweep.length)return null;path=shortest(local,[sweep.at(-1)!],undefined,work);}
    else if(local.boundaryLoops>1){const loops=[...local.boundaries].sort((a,b)=>b.length-a.length),targets=new Set(loops.slice(1).flat());path=shortest(local,loops[0]!,targets,work);}
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
