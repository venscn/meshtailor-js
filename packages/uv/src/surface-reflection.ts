/** Geometric reflection correspondence, independent of vertices/triangulation.
 * Every match binds a sampled surface point to a triangle (or boundary segment)
 * using barycentric coordinates. No UV fields, face names, or asset IDs exist in
 * this API. A best-fit plane is evidence, not permission to change geometry.
 */
import type {Vec3} from '@meshtailor/mesh-core';
import type {CutMesh} from './cut-topology.js';
import {reflectionFrames} from './reflection-frame.js';
import type {UVWork} from './work.js';

export interface SurfaceBinding {face:number;weights:[number,number,number]}
export interface SurfacePair {a:SurfaceBinding;b:SurfaceBinding;weight:number;boundary:boolean;distance:number}
export interface SurfaceReflectionReport {
  normal:Vec3;offset:number;span:number;tolerance:number;coverage:number;boundaryCoverage:number;
  rms:number;boundaryRms:number;p95:number;normalAgreement:number;sampleCount:number;
  vertexPairCoverage:number;confidence:'reliable'|'partial';
}
export interface SurfaceReflection extends SurfaceReflectionReport {pairs:SurfacePair[]}
export interface SurfaceReflectionOptions {tolerance?:number;minimumCoverage?:number;maxSamples?:number;fixedPlane?:{normal:Vec3;offset:number}}
const sub=(a:readonly number[],b:readonly number[]):Vec3=>[a[0]!-b[0]!,a[1]!-b[1]!,a[2]!-b[2]!];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const dot3=(a:readonly number[],b:readonly number[])=>a[0]!*b[0]!+a[1]!*b[1]!+a[2]!*b[2]!;
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:Vec3)=>{const l=Math.hypot(...a);return l>1e-30?scale(a,1/l):[0,0,0] as Vec3;};
export const reflected=(p:Vec3,n:Vec3,d:number)=>sub(p,scale(n,2*(dot3(p,n)-d)));
const mix=(p:readonly Vec3[],w:readonly number[]):Vec3=>[0,1,2].map(k=>p.reduce((s,q,i)=>s+q[k]!*w[i]!,0)) as Vec3;
export function bindingPosition(mesh:CutMesh,b:SurfaceBinding):Vec3 {return mix(mesh.triangles[b.face]!.map(i=>mesh.positions[i]!),b.weights);}

type Primitive={face:number;positions:[Vec3,Vec3,Vec3];normal:Vec3;area:number;lo:Vec3;hi:Vec3;center:Vec3};
type Node={lo:Vec3;hi:Vec3;left?:Node;right?:Node;ids?:number[]};
export interface SurfaceHit {face:number;point:Vec3;weights:[number,number,number];normal:Vec3;distance2:number}
/** Closest point of a closed triangle, including edge/vertex Voronoi regions.
 * Degenerate triangles are reduced to segments, never NaN barycentrics. */
export function triangleClosest(p:Vec3,a:Vec3,b:Vec3,c:Vec3):{point:Vec3;weights:[number,number,number]} {
  const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot3(ab,ap),d2=dot3(ac,ap);
  if(Math.hypot(...cross(ab,ac))<=1e-15*Math.max(dot3(ab,ab),dot3(ac,ac),1e-30)){
    let best=Infinity,out:{point:Vec3;weights:[number,number,number]}={point:a,weights:[1,0,0]};
    const ps=[a,b,c];for(let i=0;i<3;i++){const j=(i+1)%3,v=sub(ps[j]!,ps[i]!),t=Math.max(0,Math.min(1,dot3(sub(p,ps[i]!),v)/Math.max(dot3(v,v),1e-30))),q=add(ps[i]!,scale(v,t)),d=dot3(sub(p,q),sub(p,q));if(d<best){best=d;const w:[number,number,number]=[0,0,0];w[i]=1-t;w[j]=t;out={point:q,weights:w};}}return out;
  }
  if(d1<=0&&d2<=0)return{point:a,weights:[1,0,0]};
  const bp=sub(p,b),d3=dot3(ab,bp),d4=dot3(ac,bp);if(d3>=0&&d4<=d3)return{point:b,weights:[0,1,0]};
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const t=d1/(d1-d3);return{point:add(a,scale(ab,t)),weights:[1-t,t,0]};}
  const cp=sub(p,c),d5=dot3(ab,cp),d6=dot3(ac,cp);if(d6>=0&&d5<=d6)return{point:c,weights:[0,0,1]};
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const t=d2/(d2-d6);return{point:add(a,scale(ac,t)),weights:[1-t,0,t]};}
  const va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0){const t=(d4-d3)/((d4-d3)+(d5-d6));return{point:add(b,scale(sub(c,b),t)),weights:[0,1-t,t]};}
  const den=va+vb+vc,v=vb/den,w=vc/den;return{point:add(a,add(scale(ab,v),scale(ac,w))),weights:[1-v-w,v,w]};
}
export class SurfaceIndex {
  readonly triangles:Primitive[];private readonly root:Node;
  constructor(readonly mesh:CutMesh,work?:UVWork){
    this.triangles=mesh.triangles.map((t,face)=>{const positions=t.map(i=>mesh.positions[i]!) as [Vec3,Vec3,Vec3],n=cross(sub(positions[1],positions[0]),sub(positions[2],positions[0]));return{face,positions,normal:norm(n),area:Math.hypot(...n)/2,lo:[0,1,2].map(k=>Math.min(...positions.map(p=>p[k]!))) as Vec3,hi:[0,1,2].map(k=>Math.max(...positions.map(p=>p[k]!))) as Vec3,center:mix(positions,[1/3,1/3,1/3])};});
    const build=(ids:number[],depth:number):Node=>{if(!(depth%4))work?.check();const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];for(const id of ids)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k]!,this.triangles[id]!.lo[k]!);hi[k]=Math.max(hi[k]!,this.triangles[id]!.hi[k]!);}if(ids.length<=8)return{lo,hi,ids};const axis=[0,1,2].sort((a,b)=>(hi[b]!-lo[b]!)-(hi[a]!-lo[a]!))[0]!;ids.sort((a,b)=>this.triangles[a]!.center[axis]!-this.triangles[b]!.center[axis]!||a-b);const m=ids.length>>1;return{lo,hi,left:build(ids.slice(0,m),depth+1),right:build(ids.slice(m),depth+1)};};
    this.root=build(this.triangles.map((_,i)=>i),0);
  }
  nearest(p:Vec3,maxDistance=Infinity,expectedNormal?:Vec3,normalDot=.35):SurfaceHit|undefined{
    let best=maxDistance*maxDistance,hit:SurfaceHit|undefined;
    const box=(n:Node)=>[0,1,2].reduce((s,k)=>s+Math.max(n.lo[k]!-p[k]!,0,p[k]!-n.hi[k]!)**2,0);
    const visit=(node:Node)=>{if(box(node)>best)return;if(node.ids){for(const i of node.ids){const t=this.triangles[i]!;if(expectedNormal&&dot3(expectedNormal,t.normal)<normalDot)continue;const q=triangleClosest(p,...t.positions),d=dot3(sub(q.point,p),sub(q.point,p));if(d<best||(d===best&&i<(hit?.face??Infinity))){best=d;hit={face:i,...q,normal:t.normal,distance2:d};}}}else {const a=node.left!,b=node.right!;if(box(a)<box(b)){visit(a);visit(b);}else{visit(b);visit(a);}}};visit(this.root);return hit;
  }
}
interface BoundaryEdge {a:number;b:number;face:number;ca:number;cb:number;length:number}
function boundaryEdges(mesh:CutMesh):BoundaryEdge[]{
 const edges=new Map<string,{faces:number[];e:BoundaryEdge}>();mesh.triangles.forEach((t,f)=>{for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!,key=a<b?`${a}:${b}`:`${b}:${a}`,old=edges.get(key);if(old)old.faces.push(f);else edges.set(key,{faces:[f],e:{a,b,face:f,ca:k,cb:(k+1)%3,length:Math.hypot(...sub(mesh.positions[a]!,mesh.positions[b]!))}});}});
 const boundary=[...edges.values()].filter(e=>e.faces.length===1).map(e=>e.e);if(boundary.length)return boundary;
 // Closed shallow shells have no topological boundary. A continuous physical
 // rim is nevertheless strong symmetry evidence; without it a broad flat
 // surface can admit a slightly tilted plane that does not preserve its rim.
 // Only entire degree-two crease loops enter the matcher, not isolated noise.
 const ns=mesh.triangles.map(t=>{const[a,b,c]=t.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3];return norm(cross(sub(b,a),sub(c,a)));});
 const candidates=[...edges.values()].filter(e=>e.faces.length===2&&dot3(ns[e.faces[0]!]!,ns[e.faces[1]!]!)<.5).map(e=>e.e),incident=new Map<number,number[]>();
 candidates.forEach((e,i)=>{for(const v of[e.a,e.b]){const a=incident.get(v)??[];a.push(i);incident.set(v,a);}});
 const seen=new Set<number>(),loops:BoundaryEdge[]=[];for(let i=0;i<candidates.length;i++)if(!seen.has(i)){const q=[i],vertices=new Set<number>();seen.add(i);for(let h=0;h<q.length;h++){const e=candidates[q[h]!]!;for(const v of[e.a,e.b]){vertices.add(v);for(const j of incident.get(v)??[])if(!seen.has(j)){seen.add(j);q.push(j);}}}if(q.length>=6&&[...vertices].every(v=>incident.get(v)!.length===2))loops.push(...q.map(j=>candidates[j]!));}
 return loops;
}
function boundaryNearest(p:Vec3,edges:BoundaryEdge[],mesh:CutMesh,max=Infinity):{binding:SurfaceBinding;point:Vec3;distance:number}|undefined {
 let best=max*max,found:ReturnType<typeof boundaryNearest>;
 for(const e of edges){const a=mesh.positions[e.a]!,v=sub(mesh.positions[e.b]!,a),t=Math.max(0,Math.min(1,dot3(sub(p,a),v)/Math.max(dot3(v,v),1e-30))),q=add(a,scale(v,t)),d=dot3(sub(q,p),sub(q,p));if(d<best){best=d;const weights:[number,number,number]=[0,0,0];weights[e.ca]=1-t;weights[e.cb]=t;found={binding:{face:e.face,weights},point:q,distance:Math.sqrt(d)};}}
 return found;
}
function eigenSmallest(m:number[][]):Vec3{
 const a=m.map(r=>r.slice()),v=[[1,0,0],[0,1,0],[0,0,1]];for(let it=0;it<30;it++){let p=0,q=1;for(const[i,j]of[[0,1],[0,2],[1,2]] as const)if(Math.abs(a[i]![j]!)>Math.abs(a[p]![q]!)){p=i;q=j;}if(Math.abs(a[p]![q]!)<1e-14)break;const t=.5*Math.atan2(2*a[p]![q]!,a[q]![q]!-a[p]![p]!),c=Math.cos(t),s=Math.sin(t),aa=a[p]![p]!,bb=a[q]![q]!,ab=a[p]![q]!;for(let k=0;k<3;k++)if(k!==p&&k!==q){const x=a[k]![p]!,y=a[k]![q]!;a[k]![p]=a[p]![k]=c*x-s*y;a[k]![q]=a[q]![k]=s*x+c*y;}a[p]![p]=c*c*aa-2*s*c*ab+s*s*bb;a[q]![q]=s*s*aa+2*s*c*ab+c*c*bb;a[p]![q]=a[q]![p]=0;for(let k=0;k<3;k++){const x=v[k]![p]!,y=v[k]![q]!;v[k]![p]=c*x-s*y;v[k]![q]=s*x+c*y;}}
 const i=[0,1,2].sort((i,j)=>a[i]![i]!-a[j]![j]!)[0]!;return norm(v.map(r=>r[i]!) as Vec3);
}
/** Surface quadrature plus boundary arc-length samples: neither count nor
 * distribution is set by the number of vertices on one side of the mesh. */
export function detectSurfaceReflection(mesh:CutMesh,options:SurfaceReflectionOptions={},work?:UVWork):SurfaceReflection|undefined{
 if(mesh.triangles.length<12||!mesh.manifold)return;
 if(options.fixedPlane&&(!Number.isFinite(options.fixedPlane.offset)||options.fixedPlane.normal.length!==3||!options.fixedPlane.normal.every(Number.isFinite)||Math.abs(Math.hypot(...options.fixedPlane.normal)-1)>1e-6))throw Error('Invalid fixed reflection plane.');
 const tol=options.tolerance??.018,minCoverage=options.minimumCoverage??.94,count=options.maxSamples??256;
 if(!Number.isFinite(tol)||tol<.001||tol>.06||!Number.isInteger(count)||count<32||count>2048||!Number.isFinite(minCoverage)||minCoverage<.8||minCoverage>1)throw Error('Invalid surface reflection options.');
 const data={name:'geometry',positions:mesh.positions,faces:mesh.triangles.map(t=>({vertices:t}))},frames=reflectionFrames(data,mesh.triangles.map((_,i)=>i));if(!frames.length)return;
 const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];for(const p of mesh.positions)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k]!,p[k]!);hi[k]=Math.max(hi[k]!,p[k]!);}const span=2*Math.sqrt(mesh.positions.reduce((max,p)=>Math.max(max,dot3(sub(p,frames[0]!.origin),sub(p,frames[0]!.origin))),0));if(!(span>0))return;
 const index=new SurfaceIndex(mesh,work),edges=boundaryEdges(mesh),total=index.triangles.reduce((s,t)=>s+t.area,0),perimeter=edges.reduce((s,e)=>s+e.length,0);
 const samples:{a:SurfaceBinding;p:Vec3;n:Vec3;weight:number;boundary:boolean}[]=[];
 let at=0,acc=0;for(let i=0;i<count;i++){const target=(i+.5)*total/count;while(at<index.triangles.length-1&&acc+index.triangles[at]!.area<target){acc+=index.triangles[at]!.area;at++;}const t=index.triangles[at]!,weights:[number,number,number]=[.2,.3,.5];const shift=i%3,w=weights.map((_,k)=>weights[(k+shift)%3]!) as [number,number,number];samples.push({a:{face:at,weights:w},p:mix(t.positions,w),n:t.normal,weight:1/count,boundary:false});}
 const bc=edges.length?Math.min(192,Math.max(48,edges.length)):0;at=0;acc=0;for(let i=0;i<bc;i++){const target=(i+.5)*perimeter/bc;while(at<edges.length-1&&acc+edges[at]!.length<target){acc+=edges[at]!.length;at++;}const e=edges[at]!,t=Math.max(0,Math.min(1,(target-acc)/Math.max(e.length,1e-30))),weights:[number,number,number]=[0,0,0];weights[e.ca]=1-t;weights[e.cb]=t;const a={face:e.face,weights};samples.push({a,p:bindingPosition(mesh,a),n:index.triangles[e.face]!.normal,weight:1/Math.max(1,bc),boundary:true});}
 const hits=(n:Vec3,d:number,limit=span*tol,stride=1)=>samples.filter((_,i)=>i%stride===0).map(s=>{const p=reflected(s.p,n,d),rn=reflected(s.n,n,0);if(s.boundary){const h=boundaryNearest(p,edges,mesh,limit);return h?{sample:s,b:h.binding,q:h.point,distance:h.distance,normal:dot3(rn,index.triangles[h.binding.face]!.normal)}:undefined;}const h=index.nearest(p,limit,rn);return h?{sample:s,b:{face:h.face,weights:h.weights},q:h.point,distance:Math.sqrt(h.distance2),normal:dot3(rn,h.normal)}:undefined;});
 // Repeated/near-repeated covariance eigenvalues do not determine an axis.
 // Search rotations inside principal planes too, then rank by actual surface
 // and boundary agreement. A diagonal of a square is not forced as its mirror.
 const normals=frames.map(f=>f.normal);
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)for(let k=1;k<12;k++){
  const a=k*Math.PI/12,n=norm(add(scale(frames[i]!.normal,Math.cos(a)),scale(frames[j]!.normal,Math.sin(a))));
  if(!normals.some(q=>Math.abs(dot3(n,q))>.99999))normals.push(n);
 }
 const coarse=options.fixedPlane?[]:normals.map(normal=>{const offset=dot3(frames[0]!.origin,normal),h=hits(normal,offset,span*.06,Math.max(1,Math.floor(samples.length/64)));
  const score=h.reduce((s,p)=>s+(p?(p.distance/span)**2+(1-p.normal)*.001:.006),0)/h.length;return {normal,origin:frames[0]!.origin,score};
 }).filter(f=>{const v=mesh.positions.map(p=>dot3(p,f.normal));return Math.max(...v)-Math.min(...v)>span*.12;}).sort((a,b)=>a.score-b.score).slice(0,4);
 const candidates:SurfaceReflection[]=[];
 for(const frame of options.fixedPlane?[{normal:options.fixedPlane.normal,origin:frames[0]!.origin,score:0}]:coarse){work?.check();let normal=frame.normal,offset=options.fixedPlane?.offset??dot3(frame.origin,normal);
  // Exclude the identity reflection of a thin planar sheet. We need both sides.
  const extent=Math.max(...mesh.positions.map(p=>dot3(p,normal)))-Math.min(...mesh.positions.map(p=>dot3(p,normal)));if(extent<span*.12)continue;
  for(let iteration=0;iteration<(options.fixedPlane?0:18);iteration++){
   const pairs=hits(normal,offset,span*.06).filter((x):x is NonNullable<typeof x>=>!!x);if(pairs.length<samples.length*.6)break;
   const sum=pairs.reduce((s,p)=>s+p.sample.weight,0),center:Vec3=[0,0,0];for(const p of pairs)for(let k=0;k<3;k++)center[k]!+=(p.sample.p[k]!+p.q[k]!)*.5*p.sample.weight/sum;
   const cov=Array.from({length:3},()=>[0,0,0]);for(const p of pairs){const a=scale(sub(p.sample.p,center),1/span),b=scale(sub(p.q,center),1/span);for(let i=0;i<3;i++)for(let j=0;j<3;j++)cov[i]![j]!+=.5*p.sample.weight*(a[i]!*b[j]!+a[j]!*b[i]!);}
   let n=eigenSmallest(cov);if(dot3(n,normal)<0)n=scale(n,-1);if(dot3(n,normal)<.98)break;const d=dot3(center,n);if(Math.abs(d-offset)<span*1e-7&&dot3(n,normal)>.99999999){normal=n;offset=d;break;}normal=n;offset=d;
  }
  const h=hits(normal,offset),accepted=h.filter((x):x is NonNullable<typeof x>=>!!x),body=accepted.filter(h=>!h.sample.boundary),border=accepted.filter(h=>h.sample.boundary),coverage=body.length/count,boundaryCoverage=bc?border.length/bc:1;
  const rms=Math.sqrt(body.reduce((s,h)=>s+(h.distance/span)**2,0)/Math.max(1,body.length)),boundaryRms=Math.sqrt(border.reduce((s,h)=>s+(h.distance/span)**2,0)/Math.max(1,border.length)),dist=accepted.map(h=>h.distance/span).sort((a,b)=>a-b),agreement=body.reduce((s,h)=>s+h.normal,0)/Math.max(1,body.length);
  const pos=samples.filter(s=>!s.boundary&&dot3(s.p,normal)-offset>span*.02).length/count,neg=samples.filter(s=>!s.boundary&&dot3(s.p,normal)-offset< -span*.02).length/count;
  if(coverage<minCoverage||boundaryCoverage<minCoverage||rms>tol*.45||boundaryRms>tol*.5||agreement<.8||Math.min(pos,neg)<.25)continue;
  // A separate diagnostic measures how many source vertices have any reflected
  // vertex. It is NEVER a gate for the surface correspondence.
  let matched=0;const step=Math.max(1,Math.ceil(mesh.positions.length/256));for(let i=0;i<mesh.positions.length;i+=step){const rp=reflected(mesh.positions[i]!,normal,offset);if(mesh.positions.some(p=>dot3(sub(p,rp),sub(p,rp))<(span*1e-4)**2))matched++;}
  candidates.push({normal,offset,span,tolerance:tol,coverage,boundaryCoverage,rms,boundaryRms,p95:dist[Math.floor((dist.length-1)*.95)]??0,normalAgreement:agreement,sampleCount:samples.length,vertexPairCoverage:matched/Math.ceil(mesh.positions.length/step),confidence:'reliable',pairs:accepted.map(h=>({a:h.sample.a,b:h.b,weight:h.sample.weight,boundary:h.sample.boundary,distance:h.distance/span}))});
 }
 candidates.sort((a,b)=>(a.rms+a.boundaryRms)-(b.rms+b.boundaryRms)||b.coverage-a.coverage);
 return candidates[0];
}
export function reflectionSummary(r:SurfaceReflection):SurfaceReflectionReport {const{pairs,...report}=r;return report;}
