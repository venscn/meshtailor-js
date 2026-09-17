import {edgeKey,type MeshData} from '@meshtailor/mesh-core';
import {cutLocalMesh,type CutMesh} from './cut-topology.js';
import type {UVWork} from './work.js';

/** Primal tree / dual cotree handle cuts, without adding/removing faces.
 * Boundary loops are virtual caps in the dual graph only; no cap geometry or UV
 * is ever emitted. Leftover edges define the noncontractible handle cycles.
 * For genus-zero charts this does nothing. A rejected topology stays unchanged.
 */
export function openHandles(mesh:MeshData,faces:readonly number[],seams:ReadonlySet<string>,local:CutMesh,work?:UVWork):{local:CutMesh;added:string[]}|null{
  const genus=(2-local.boundaryLoops-local.euler)/2;
  if(!local.manifold||!Number.isInteger(genus)||genus<1||genus>8)return null;
  const n=local.positions.length,inc=new Map<string,{a:number;b:number;faces:number[];length:number}>();
  local.triangles.forEach((t,fi)=>{for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,key=edgeKey(a,b),entry=inc.get(key)??{a,b,faces:[],length:Math.hypot(...local.positions[a]!.map((x,i)=>x-local.positions[b]![i]!))};entry.faces.push(fi);inc.set(key,entry);}});
  local.boundaries.forEach((loop,i)=>{for(let k=0;k<loop.length;k++)inc.get(edgeKey(loop[k]!,loop[(k+1)%loop.length]!))?.faces.push(local.triangles.length+i);});
  const adj:{to:number;key:string;length:number}[][]=Array.from({length:n},()=>[]);
  for(const[key,e]of inc){if(e.faces.length!==2)return null;adj[e.a]!.push({to:e.b,key,length:e.length});adj[e.b]!.push({to:e.a,key,length:e.length});}
  // Deterministic Dijkstra on a sparse graph. Binary heap stores stale keys.
  const dist=new Float64Array(n).fill(Infinity),parent=new Int32Array(n).fill(-1),tree=new Set<string>(),heap:[number,number][]=[];
  const push=(v:number,d:number)=>{let i=heap.length;heap.push([v,d]);while(i){const p=(i-1)>>1;if(heap[p]![1]<=d)break;heap[i]=heap[p]!;i=p;}heap[i]=[v,d];};
  const pop=()=>{const r=heap[0]!,x=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1]![1]<heap[j]![1])j++;if(heap[j]![1]>=x[1])break;heap[i]=heap[j]!;i=j;}heap[i]=x;}return r;};
  const root=local.boundary[0]??0;dist[root]=0;push(root,0);
  while(heap.length){const[v,d]=pop();if(d!==dist[v])continue;if((v&255)===0)work?.check();for(const e of adj[v]!)if(d+e.length<dist[e.to]!){dist[e.to]=d+e.length;parent[e.to]=v;push(e.to,d+e.length);}}
  for(let i=0;i<n;i++)if(parent[i]>=0)tree.add(edgeKey(i,parent[i]!));else if(i!==root)return null;
  const count=local.triangles.length+local.boundaryLoops,dual:{to:number;key:string}[][]=Array.from({length:count},()=>[]);
  for(const[key,e]of inc)if(!tree.has(key)){const[a,b]=e.faces as [number,number];dual[a]!.push({to:b,key});dual[b]!.push({to:a,key});}
  const seen=new Uint8Array(count),q=[0],cotree=new Set<string>();seen[0]=1;
  for(let h=0;h<q.length;h++){if((h&511)===0)work?.check();for(const e of dual[q[h]!]!)if(!seen[e.to]){seen[e.to]=1;q.push(e.to);cotree.add(e.key);}}
  if(q.length!==count)return null;
  const cycles=[...inc].filter(([key])=>!tree.has(key)&&!cotree.has(key));if(cycles.length!==2*genus)return null;
  const cuts=new Set<string>();
  const climb=(v:number)=>{while(parent[v]>=0){cuts.add(edgeKey(v,parent[v]!));v=parent[v]!;}};
  for(const[key,e]of cycles){cuts.add(key);climb(e.a);climb(e.b);}
  // Remove branches not needed by a cycle; preserve boundary-attached ends.
  const boundary=new Set(local.boundaries.flat());let changed=true;
  while(changed){changed=false;const degree=new Map<number,number>();for(const key of cuts){const e=inc.get(key)!;degree.set(e.a,(degree.get(e.a)??0)+1);degree.set(e.b,(degree.get(e.b)??0)+1);}
    for(const key of [...cuts]){const e=inc.get(key)!;if(degree.get(e.a)===1&&!boundary.has(e.a)||degree.get(e.b)===1&&!boundary.has(e.b)){cuts.delete(key);changed=true;}}
  }
  const effective=new Set(seams),added:string[]=[];
  for(const key of cuts){const e=inc.get(key)!,source=edgeKey(local.sourceVertices[e.a]!,local.sourceVertices[e.b]!);if(!effective.has(source)){effective.add(source);added.push(source);}}
  if(!added.length)return null;const result=cutLocalMesh(mesh,faces,effective);
  return result.manifold&&result.euler===2-result.boundaryLoops?{local:result,added}:null;
}
