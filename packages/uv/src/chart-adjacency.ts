import { buildTopology, type MeshData, type MeshTopology, type Vec3 } from '@meshtailor/mesh-core';
import { triangleArea } from './parameterize.js';
import type { UVWork } from './work.js';

export interface ChartLink {
  a:number; b:number; edges:string[]; length:number;
  /** Length-weighted normal agreement, in [-1,1]. */
  normalAgreement:number;
}
export interface ChartGraph {
  links:ChartLink[]; boundaries:Map<number,number>; faceChart:Int32Array;
}
/** Geometry adjacency, NOT proximity in UV space. Only manifold, oppositely
 * oriented shared edges count. Coincident shells/vertex-only contacts are not welded. */
export function buildChartGraph(mesh:MeshData,charts:readonly {id:number;faces:readonly number[]}[],topology?:MeshTopology,work?:UVWork):ChartGraph {
  const t=topology??buildTopology(mesh),faceChart=new Int32Array(mesh.faces.length).fill(-1),ids=new Set<number>();
  for(const c of charts){if(!Number.isInteger(c.id)||c.id<0||ids.has(c.id))throw new Error('Invalid/duplicate chart ID.');ids.add(c.id);
    for(const fi of c.faces){if(!Number.isInteger(fi)||fi<0||fi>=mesh.faces.length||faceChart[fi]!==-1)throw new Error('Invalid/duplicate chart face.');faceChart[fi]=c.id;}}
  if(faceChart.some(id=>id<0))throw new Error('Charts must cover every source face exactly once.');
  const normals=mesh.faces.map(f=>{const [a,b,c]=f.vertices.map(i=>mesh.positions[i]!) as [Vec3,Vec3,Vec3];const u=b.map((v,k)=>v-a[k]!),v=c.map((x,k)=>x-a[k]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],length=2*triangleArea(a,b,c);return n.map(x=>x/Math.max(length,1e-30));});
  const boundaries=new Map<number,number>(charts.map(c=>[c.id,0])),links=new Map<string,ChartLink>();let count=0;
  for(const [key,e] of t.edges){if(count++%512===0)work?.check();const p=mesh.positions[e.a]!,q=mesh.positions[e.b]!,length=Math.hypot(...p.map((v,k)=>v-q[k]!));
    const labels=[...new Set(e.faces.map(fi=>faceChart[fi]!))];
    if(e.faces.length!==2||labels.length>1)for(const id of labels)boundaries.set(id,(boundaries.get(id)??0)+length);
    if(e.faces.length!==2||labels.length!==2||!(length>0))continue;
    const [fa,fb]=e.faces as [number,number],forward=(fi:number)=>{const vs=mesh.faces[fi]!.vertices;return vs.some((v,k)=>v===e.a&&vs[(k+1)%3]===e.b);};
    if(forward(fa)===forward(fb))continue;
    const a=Math.min(...labels),b=Math.max(...labels),pair=`${a}:${b}`;
    const link=links.get(pair)??{a,b,edges:[],length:0,normalAgreement:0};link.edges.push(key);link.length+=length;
    link.normalAgreement+=length*Math.max(-1,Math.min(1,normals[fa]!.reduce((s,v,k)=>s+v*normals[fb]![k]!,0)));links.set(pair,link);
  }
  for(const link of links.values())link.normalAgreement/=link.length;
  return {links:[...links.values()].sort((x,y)=>x.a-y.a||x.b-y.b),boundaries,faceChart};
}
/** Dimensionless shared-boundary fraction, softened by bending. Deterministic. */
export function chartAffinity(link:ChartLink,boundaries:ReadonlyMap<number,number>):number {
  return link.length/Math.max(1e-30,Math.sqrt((boundaries.get(link.a)??0)*(boundaries.get(link.b)??0)))*(.25+.75*(link.normalAgreement+1)/2);
}
