/** Transfer a geometric opening to the other side of an approximate reflection.
 * Uses a guide curve on the surface edge graph, not UVs or a triangle-id mirror.
 * Opposite diagonals may require two real edges. Reject, rather than invent an
 * edge, if the complete disk/curve-distance contract cannot be met.
 */
import {edgeKey,type MeshData,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh,type CutMesh} from './cut-topology.js';
import type {Reflection} from './symmetry-boundaries.js';
import type {UVWork} from './work.js';
const sub=(a:readonly number[],b:readonly number[])=>a.map((x,k)=>x-b[k]!);
const dist=(a:readonly number[],b:readonly number[])=>Math.hypot(...sub(a,b));
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,k)=>s+x*b[k]!,0);
function segmentDistance(p:Vec3,a:Vec3,b:Vec3){const ab=sub(b,a),v=sub(p,a),t=Math.max(0,Math.min(1,dot(v,ab)/Math.max(1e-30,dot(ab,ab))));return Math.hypot(...v.map((x,k)=>x-t*ab[k]!));}
function orderedPath(edges:readonly string[]):number[]|undefined{const adj=new Map<number,number[]>();for(const e of edges){const[a,b]=e.split(':').map(Number) as[number,number];for(const[x,y]of[[a,b],[b,a]]){const q=adj.get(x!)??[];q.push(y!);adj.set(x!,q);}}const ends=[...adj].filter(([,q])=>q.length===1);if(ends.length!==2||[...adj.values()].some(q=>q.length>2))return;const path=[ends[0]![0]];while(path.length<=edges.length){const q=adj.get(path.at(-1)!)!.filter(v=>v!==path.at(-2));if(!q.length)break;path.push(q[0]!);}return path.length===edges.length+1?path:undefined;}
class Heap{a:[number,number][]=[];push(v:number,d:number){let i=this.a.length;this.a.push([v,d]);while(i){const p=(i-1)>>1;if(this.a[p]![1]<=d)break;this.a[i]=this.a[p]!;i=p;}this.a[i]=[v,d];}pop(){const r=this.a[0]!,x=this.a.pop()!;if(this.a.length){let i=0;while(2*i+1<this.a.length){let j=2*i+1;if(j+1<this.a.length&&this.a[j+1]![1]<this.a[j]![1])j++;if(this.a[j]![1]>=x[1])break;this.a[i]=this.a[j]!;i=j;}this.a[i]=x;}return r;}}
export interface PairedOpening {edges:string[];maxDeviation:number;relativeDeviation:number;sourceEdges:number;targetEdges:number}
export function mirrorOpening(mesh:MeshData,targetFaces:readonly number[],cuts:ReadonlySet<string>,sourceEdges:readonly string[],reflection:Reflection,work?:UVWork):PairedOpening|undefined{
 const route=orderedPath(sourceEdges),local=cutLocalMesh(mesh,targetFaces,cuts);if(!route||local.boundaryLoops!==2||!local.manifold)return;
 const guide=route.map(v=>{const p=mesh.positions[v]!,h=2*(dot(p,reflection.normal)-reflection.offset);return p.map((x,k)=>x-h*reflection.normal[k]!) as Vec3;}),curveDistance=(p:Vec3)=>Math.min(...guide.slice(1).map((b,i)=>segmentDistance(p,guide[i]!,b)));
 const near=(loop:number[],p:Vec3)=>loop.reduce((best,v)=>dist(local.positions[v]!,p)<dist(local.positions[best]!,p)?v:best,loop[0]!);
 let endpoints:[number,number]|undefined,score=Infinity;for(const swap of[false,true]){const a=near(local.boundaries[swap?1:0]!,guide[0]!),b=near(local.boundaries[swap?0:1]!,guide.at(-1)!);const s=dist(local.positions[a]!,guide[0]!)+dist(local.positions[b]!,guide.at(-1)!);if(s<score){endpoints=[a,b];score=s;}}
 if(!endpoints)return;const[start,end]=endpoints,n=local.positions.length,adj=Array.from({length:n},()=>new Set<number>()),boundary=new Set(local.boundaries.flat());
 for(const t of local.triangles)for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!;adj[a]!.add(b);adj[b]!.add(a);}
 const distances=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),heap=new Heap(),band=Math.max(reflection.tolerance*2,1e-12);distances[start]=0;heap.push(start,0);let visits=0;
 while(heap.a.length){const[v,d]=heap.pop();if(d!==distances[v])continue;if(v===end)break;if((visits++&255)===0)work?.check();for(const j of adj[v]!){if(j!==end&&boundary.has(j))continue;const p=local.positions[v]!,q=local.positions[j]!,mid=p.map((x,k)=>(x+q[k]!)/2) as Vec3,c=curveDistance(mid),length=dist(p,q),cost=d+length*(1+20*(c/band)**2);if(cost<distances[j]!){distances[j]=cost;prev[j]=v;heap.push(j,cost);}}}
 if(!Number.isFinite(distances[end]))return;const target=[end];for(let v=end;v!==start;){v=prev[v]!;if(v<0)return;target.push(v);}target.reverse();const coords=target.map(v=>local.positions[v]!),edges=target.slice(1).map((v,i)=>edgeKey(local.sourceVertices[target[i]!]!,local.sourceVertices[v]!));
 if(!cutLocalMesh(mesh,targetFaces,new Set([...cuts,...edges])).disk)return;
 const sample=(ps:Vec3[])=>ps.flatMap((p,i)=>i?[p,p.map((x,k)=>(x+ps[i-1]![k]!)/2) as Vec3]:[p]);
 let maxDeviation=0;for(const p of sample(coords))maxDeviation=Math.max(maxDeviation,curveDistance(p));for(const p of sample(guide))maxDeviation=Math.max(maxDeviation,Math.min(...coords.slice(1).map((b,i)=>segmentDistance(p,coords[i]!,b))));
 const length=guide.slice(1).reduce((s,p,i)=>s+dist(p,guide[i]!),0),relativeDeviation=maxDeviation/Math.max(length,1e-30);
 if(relativeDeviation>.1||maxDeviation>reflection.tolerance*6)return;
 return{edges,maxDeviation,relativeDeviation,sourceEdges:sourceEdges.length,targetEdges:edges.length};
}
