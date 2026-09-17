import {buildTopology} from './topology.js';
import type {MeshData, MeshTopology, Vec3} from './types.js';

interface Arc {to:number; rev:number; capacity:number}
/** Binary surface-label cut. Iterative blocking paths avoid JS recursion limits. */
class Flow {
  readonly edges:Arc[][];
  constructor(n:number){this.edges=Array.from({length:n},()=>[]);}
  add(a:number,b:number,capacity:number){const ra=this.edges[a]!.length,rb=this.edges[b]!.length;this.edges[a]!.push({to:b,rev:rb,capacity});this.edges[b]!.push({to:a,rev:ra,capacity:0});}
  cut(source:number,sink:number,check:()=>void):Uint8Array {
    const n=this.edges.length,level=new Int32Array(n),cursor=new Int32Array(n),eps=1e-14;
    for(let round=0;;round++){
      check();level.fill(-1);level[source]=0;const q=[source];
      for(let h=0;h<q.length;h++)for(const e of this.edges[q[h]!]!)if(e.capacity>eps&&level[e.to]<0){level[e.to]=level[q[h]!]!+1;q.push(e.to);}
      if(level[sink]<0){const reached=new Uint8Array(n);q.forEach(i=>reached[i]=1);return reached;}
      cursor.fill(0);let visits=0;
      for(;;){
        const nodes=[source],path:Arc[]=[];let found=false;
        while(nodes.length){
          if((visits++&4095)===0)check();const v=nodes.at(-1)!;
          if(v===sink){found=true;break;}
          const list=this.edges[v]!;let i=cursor[v]!;
          while(i<list.length&&(list[i]!.capacity<=eps||level[list[i]!.to]!==level[v]!+1))i++;
          cursor[v]=i;
          if(i===list.length){level[v]=-1;nodes.pop();if(path.length)path.pop();if(nodes.length)cursor[nodes.at(-1)!]++;}
          else{const e=list[i]!;nodes.push(e.to);path.push(e);}
        }
        if(!found)break;
        let amount=Infinity;for(const e of path)amount=Math.min(amount,e.capacity);
        for(let i=0;i<path.length;i++){const e=path[i]!;e.capacity-=amount;this.edges[e.to]![e.rev]!.capacity+=amount;}
      }
    }
  }
}

const sub=(a:Vec3,b:Vec3)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]] as Vec3;
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function frame(mesh:MeshData,fi:number){const[a,b,c]=mesh.faces[fi]!.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3],u=sub(b,a),v=sub(c,a),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]] as Vec3,l=Math.hypot(...normal);return{area:l/2,normal:normal.map(x=>x/Math.max(l,1e-30)) as Vec3};}
export interface BoundaryRegularizationReport {beforeLength:number;afterLength:number;beforeTeeth:number;afterTeeth:number;movedFaces:number;accepted:boolean;reason:string}
/** Inspect actual interior chart boundaries, not rendered/UV-smoothed outlines.
 * A 'tooth' is a face with at least two cut edges across locally smooth surface.
 * It is a reproducible narrow-spike proxy, NOT a semantic usability score. */
export function auditPartitionBoundary(mesh:MeshData,parts:readonly (readonly number[])[],topology=buildTopology(mesh)){
  const labels=new Int32Array(mesh.faces.length).fill(-1);parts.forEach((fs,i)=>fs.forEach(f=>labels[f]=i));
  const frames=mesh.faces.map((_,i)=>frame(mesh,i)),teeth=new Uint8Array(mesh.faces.length);let length=0,edges=0;
  for(const e of topology.edges.values())if(e.faces.length===2){const[a,b]=e.faces as [number,number];if(labels[a]<0||labels[b]<0||labels[a]===labels[b])continue;
    length+=Math.hypot(...sub(mesh.positions[e.a]!,mesh.positions[e.b]!));edges++;
    if(dot(frames[a]!.normal,frames[b]!.normal)>.94){teeth[a]++;teeth[b]++;}
  }
  return{length,edges,teeth:teeth.reduce((n,k)=>n+(k>=2?1:0),0)};
}

/** Remove jagged face-label competition in a narrow band using a length/crease
 * graph cut. Original mesh edges/vertices are untouched. Hard seams are fixed.
 * Both face-connected regions, corner-fan continuity and a minimum retained area
 * are checked before accepting; otherwise return the original partition.
 */
export function regularizeBinaryPartition(mesh:MeshData,parts:readonly (readonly number[])[],protectedEdges:ReadonlySet<string>=new Set(),topology:MeshTopology=buildTopology(mesh),check:()=>void=()=>{},band=5):{parts:number[][];report:BoundaryRegularizationReport}{
  const original=parts.map(p=>[...p]),before=auditPartitionBoundary(mesh,parts,topology);
  const base:BoundaryRegularizationReport={beforeLength:before.length,afterLength:before.length,beforeTeeth:before.teeth,afterTeeth:before.teeth,movedFaces:0,accepted:false,reason:'not-binary'};
  const unchanged=(reason:string)=>({parts:original,report:{...base,reason}});
  if(parts.length!==2||parts.some(p=>p.length<3))return unchanged('not-binary');
  const faces=parts.flat(),index=new Map(faces.map((f,i)=>[f,i])),n=faces.length;
  const labels=new Uint8Array(n);parts[1]!.forEach(f=>labels[index.get(f)!]=1);
  const frames=faces.map(f=>frame(mesh,f)),adj:number[][]=Array.from({length:n},()=>[]),edges:{a:number;b:number;w:number}[]=[],locked=new Uint8Array(n),dist=new Int32Array(n).fill(-1);
  let sumLength=0,countLength=0;
  for(const[key,e]of topology.edges){if(e.faces.length!==2)continue;const a=index.get(e.faces[0]!),b=index.get(e.faces[1]!);if(a===undefined||b===undefined)continue;
    const l=Math.hypot(...sub(mesh.positions[e.a]!,mesh.positions[e.b]!));sumLength+=l;countLength++;
    adj[a]!.push(b);adj[b]!.push(a);
    if(protectedEdges.has(key)){locked[a]=locked[b]=1;continue;}
    const smooth=Math.max(0,dot(frames[a]!.normal,frames[b]!.normal));
    edges.push({a,b,w:l*(.15+.85*smooth**4)});
    if(labels[a]!==labels[b])dist[a]=dist[b]=0;
  }
  if(!edges.length)return unchanged('no-shared-boundary');
  const queue:number[]=[];for(let i=0;i<n;i++)if(dist[i]===0)queue.push(i);
  for(let h=0;h<queue.length;h++){const i=queue[h]!;if(dist[i]!>=band)continue;for(const j of adj[i]!)if(dist[j]<0){dist[j]=dist[i]!+1;queue.push(j);}}
  for(let i=0;i<n;i++)if(dist[i]<0||dist[i]!>=band)locked[i]=1;
  // Keep at least an interior/core face for each label, even on narrow bands.
  for(let label=0;label<2;label++){let best=-1,score=-Infinity;for(let i=0;i<n;i++)if(labels[i]===label){const s=(dist[i]<0?band+1:dist[i]!)+frames[i]!.area/Math.max(1e-30,sumLength*sumLength);if(s>score){score=s;best=i;}}if(best>=0)locked[best]=1;}
  const movable:number[]=[];const nodes=new Int32Array(n).fill(-1);for(let i=0;i<n;i++)if(!locked[i]){nodes[i]=movable.length;movable.push(i);}
  if(!movable.length)return unchanged('all-hard-constraints');
  const k=movable.length,s=k,t=k+1,flow=new Flow(k+2),unary=movable.map(()=>[0,0]),meanLength=sumLength/Math.max(1,countLength);
  for(let j=0;j<k;j++){const i=movable[j]!;unary[j]![1-labels[i]!] = .10*frames[i]!.area/Math.max(meanLength,1e-30);}
  for(const e of edges){const a=nodes[e.a]!,b=nodes[e.b]!;
    if(a>=0&&b>=0){flow.add(a,b,e.w);flow.add(b,a,e.w);}
    else if(a>=0)unary[a]![1-labels[e.b]!]!+=e.w;
    else if(b>=0)unary[b]![1-labels[e.a]!]!+=e.w;
  }
  for(let j=0;j<k;j++){flow.add(s,j,unary[j]![1]!);flow.add(j,t,unary[j]![0]!);}
  const reachable=flow.cut(s,t,check),next=labels.slice();movable.forEach((i,j)=>next[i]=reachable[j]?0:1);
  const result:number[][]=[[],[]];let moved=0;const oldArea=[0,0],newArea=[0,0];
  for(let i=0;i<n;i++){result[next[i]!]!.push(faces[i]!);oldArea[labels[i]!]!+=frames[i]!.area;newArea[next[i]!]!+=frames[i]!.area;if(next[i]!==labels[i])moved++;}
  if(!moved)return unchanged('already-regular');
  if(newArea.some((a,i)=>a<oldArea[i]!*.65))return unchanged('area-preservation');
  // Connectivity, including islands enclosed by the new cut, is not optional.
  for(let label=0;label<2;label++){const root=next.findIndex(x=>x===label);if(root<0)return unchanged('empty-label');const seen=new Uint8Array(n),q=[root];seen[root]=1;for(let h=0;h<q.length;h++)for(const j of adj[q[h]!]!)if(!seen[j]&&next[j]===label){seen[j]=1;q.push(j);}if(q.length!==result[label]!.length)return unchanged('connectivity');}
  // At a vertex, each label's incident faces must form a single edge-connected fan.
  const affected=new Set<number>();for(let i=0;i<n;i++)if(next[i]!==labels[i])for(const v of mesh.faces[faces[i]!]!.vertices)affected.add(v);
  const fans=new Map<number,number[]>();for(let i=0;i<n;i++)for(const v of mesh.faces[faces[i]!]!.vertices)if(affected.has(v)){const f=fans.get(v)??[];f.push(i);fans.set(v,f);}
  for(const fan of fans.values())for(let label=0;label<2;label++){const fs=fan.filter(i=>next[i]===label);if(fs.length<2)continue;const set=new Set(fs),q=[fs[0]!],seen=new Set(q);for(let h=0;h<q.length;h++)for(const j of adj[q[h]!]!)if(set.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}if(q.length!==fs.length)return unchanged('corner-fan');}
  const after=auditPartitionBoundary(mesh,result,topology);
  // A crease-aware cut can be marginally longer. Never accept a growth in teeth.
  if(after.teeth>before.teeth||after.length>before.length*1.08)return unchanged('roughness-guard');
  result.forEach(fs=>fs.sort((a,b)=>a-b));
  return{parts:result,report:{...base,afterLength:after.length,afterTeeth:after.teeth,movedFaces:moved,accepted:true,reason:'length-crease-mincut'}};
}
