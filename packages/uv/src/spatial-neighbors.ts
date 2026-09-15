import { buildTopology, type MeshData, type Vec3 } from '@meshtailor/mesh-core';
import { buildChartGraph, chartAffinity } from './chart-adjacency.js';
import type { RawChart } from './atlas-pack.js';
import type { UVWork } from './work.js';
export interface SpatialOptions {
  spatialNeighbors?:boolean; neighborDistanceRatio?:number; neighborSamples?:number; maxSpatialNeighbors?:number;
}
export interface IslandNeighbor {
  a:number;b:number;kind:'shared-edge'|'spatial';stitchable:boolean;score:number;distance:number;support:number;
}
export interface SpatialReport {
  links:IslandNeighbor[];groups:number[][];distance:number;distanceRatio:number;sampleCount:number;
  comparisons:number;truncated:boolean;islandCount:number;
}
interface Sample {p:Vec3;chart:number;normal:Vec3;index:number}
/** A separate association graph, NEVER a replacement for mesh connectivity.
 * Nearest surface samples support spatially close but disconnected accessories.
 * Sampling is bounded and deterministic; missing links are not proof of separation.
 * No vertex welding, face removal, seam deletion or UV equality constraints occur. */
export function buildSpatialNeighbors(mesh:MeshData,raw:readonly RawChart[],opts:SpatialOptions={},work?:UVWork):SpatialReport {
  const ratio=opts.neighborDistanceRatio??.02,limit=opts.neighborSamples??96,maxNeighbors=opts.maxSpatialNeighbors??4;
  if(!Number.isFinite(ratio)||ratio<0||ratio>.2||!Number.isInteger(limit)||limit<8||limit>512||!Number.isInteger(maxNeighbors)||maxNeighbors<1||maxNeighbors>16)throw new Error('Invalid spatial neighbor settings.');
  const topo=buildTopology(mesh),charts=raw.map(r=>({id:r.id,faces:[...r.faceUVs.keys()]})),g=buildChartGraph(mesh,charts,topo,work);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const p of mesh.positions)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k]!,p[k]!);hi[k]=Math.max(hi[k]!,p[k]!);}
  const span=Math.max(...hi.map((v,k)=>v-lo[k]!)),distance=ratio*span;
  const links:IslandNeighbor[]=g.links.map(l=>({a:l.a,b:l.b,kind:'shared-edge',stitchable:true,score:2+chartAffinity(l,g.boundaries),distance:0,support:l.edges.length}));
  const topological=new Set(links.map(l=>`${l.a}:${l.b}`));
  let comparisons=0,truncated=false,sampleCount=0;
  if(opts.spatialNeighbors!==false&&distance>0){
    const samples:Sample[]=[],boundary=new Map(raw.map(c=>[c.id,[] as Vec3[]]));
    for(const e of topo.edges.values()){
      const ids=[...new Set(e.faces.map(fi=>g.faceChart[fi]!))];
      if(e.faces.length===2&&ids.length===1)continue;
      const a=mesh.positions[e.a]!,b=mesh.positions[e.b]!,p=a.map((v,k)=>(v+b[k]!)/2) as Vec3;
      for(const id of ids)boundary.get(id)!.push(a,b,p);
    }
    for(const c of charts){
      work?.check();const points=boundary.get(c.id)!;
      // Half of the budget samples boundaries; half covers the surface interior.
      // This lets a small detail find a large panel even far from its rim.
      const add=(p:Vec3,n:Vec3)=>samples.push({p,normal:n,chart:c.id,index:samples.length});
      const budget=Math.floor(limit/2),n=Math.min(points.length,budget);
      for(let i=0;i<n;i++)add(points[Math.floor(i*points.length/n)]!,[0,0,0]);
      const count=Math.min(c.faces.length,limit-n);
      for(let i=0;i<count;i++){
        const f=mesh.faces[c.faces[Math.floor(i*c.faces.length/count)]!]!,[a,b,d]=f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3];
        const x=b.map((v,k)=>v-a[k]!),y=d.map((v,k)=>v-a[k]!),cross=[x[1]!*y[2]!-x[2]!*y[1]!,x[2]!*y[0]!-x[0]!*y[2]!,x[0]!*y[1]!-x[1]!*y[0]!];
        const len=Math.hypot(...cross);add(a.map((v,k)=>(v+b[k]!+d[k]!)/3) as Vec3,cross.map(v=>len?v/len:0) as Vec3);
      }
    }
    const grid=new Map<string,Sample[]>(),pairs=new Map<string,{a:number;b:number;distance:number;support:Set<number>;agreement:number}>();
    const cell=(p:Vec3)=>p.map((v,k)=>Math.floor((v-lo[k]!)/distance));
    outer:for(const s of samples){
      if(s.index%128===0)work?.check();const xyz=cell(s.p);sampleCount++;
      for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
        const list=grid.get(`${xyz[0]!+x},${xyz[1]!+y},${xyz[2]!+z}`)??[];
        for(const p of list){
          if(++comparisons>2_000_000){truncated=true;break outer;}
          if(p.chart===s.chart)continue;
          const a=Math.min(p.chart,s.chart),b=Math.max(p.chart,s.chart),key=`${a}:${b}`;if(topological.has(key))continue;
          const d=Math.hypot(...p.p.map((v,k)=>v-s.p[k]!));if(d>distance)continue;
          const pair=pairs.get(key)??{a,b,distance:d,support:new Set<number>(),agreement:0};
          pair.distance=Math.min(pair.distance,d);pair.support.add(p.index);pair.support.add(s.index);
          pair.agreement=Math.max(pair.agreement,p.normal.reduce((sum,v,k)=>sum+v*s.normal[k]!,0));pairs.set(key,pair);
        }
      }
      const key=xyz.join(','),list=grid.get(key)??[];list.push(s);grid.set(key,list);
    }
    const spatial=[...pairs.values()].map(p=>({a:p.a,b:p.b,kind:'spatial' as const,stitchable:false,distance:p.distance,support:p.support.size,
      score:(1-p.distance/distance)*(.25+.75*Math.min(1,p.support.size/12))*(.75+.25*p.agreement)})).sort((a,b)=>b.score-a.score||a.distance-b.distance||a.a-b.a||a.b-b.b);
    const degree=new Map<number,number>();
    for(const l of spatial){if((degree.get(l.a)??0)>=maxNeighbors||(degree.get(l.b)??0)>=maxNeighbors)continue;
      links.push(l);degree.set(l.a,(degree.get(l.a)??0)+1);degree.set(l.b,(degree.get(l.b)??0)+1);}
  }
  const parent=new Map(raw.map(c=>[c.id,c.id]));
  const root=(i:number):number=>{let r=i;while(parent.get(r)!==r)r=parent.get(r)!;return r;};
  for(const l of links){const a=root(l.a),b=root(l.b);if(a!==b)parent.set(b,a);}
  const groups=new Map<number,number[]>();for(const c of raw){const r=root(c.id),list=groups.get(r)??[];list.push(c.id);groups.set(r,list);}
  return {links,groups:[...groups.values()],distance,distanceRatio:ratio,sampleCount,comparisons,truncated,islandCount:raw.length};
}
