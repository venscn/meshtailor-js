/** A repeated meridian is a metric constraint, not a free-boundary LSCM hint.
 * Recognise complete circular sections and their unbranched profile graph using
 * geometry/edge incidence only. Equal vertex counts and authored UV are unused.
 *
 * Surface metric: ds² + r(s)² dθ². Set h(s)=integral ds/r(s), yielding a strip
 * (R θ, R h). The straight sides follow the repeated physical cross-section;
 * chamfers do not turn a cylindrical band into an unconstrained tapered chart.
 */
import {edgeKey,type Vec2,type MeshData} from '@meshtailor/mesh-core';
import {cutLocalMesh,type CutMesh} from './cut-topology.js';
import type {PackedChart} from './preview.js';
import type {UVWork} from './work.js';

export interface ProfileCoordinate {r:number;t:number;theta:number}
interface ProfileNode {r:number;t:number;s:number;h:number;vertices:number[]}
export interface RevolvedProfile {
  nodes:ProfileNode[]; nodeOf:Map<number,number>; coordinates:ProfileCoordinate[];
  length:number; conformalHeight:number; referenceRadius:number; radialError:number;
  tolerance:number; seamAngle:number; annular:boolean;
}
export interface RevolvedProfileReport {
  mapping:'rectangle'|'annulus'; sections:number; sourceMeridianLength:number;
  radiusRange:[number,number]; referenceRadius:number; conformalHeight:number;
  radialResidual:number; seamSnapDegrees:number; stripLength?:number; stripWidth?:number;
  innerRadius?:number; outerRadius?:number; maxStretch:number;
  note:string;
}
/** Compact reference contains one corner binding per cut-local vertex. Final
 * output must remain one proper similarity of this geometry-derived metric. */
export interface RevolvedMetricContract {
  faces:number[]; seams:string[]; boundaryLoops:number;
  bindings:{face:number;corner:number}[]; coordinates:Vec2[];
  mapping:'rectangle'|'annulus';
}
const TAU=2*Math.PI;
const wrap=(x:number)=>(x%TAU+TAU)%TAU;
const angularDistance=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

export function inspectRevolvedProfile(local:CutMesh,coordinate:(p:CutMesh['positions'][number])=>ProfileCoordinate,work?:UVWork):RevolvedProfile|undefined {
  if(!local.manifold||local.euler!==0||local.boundaryLoops!==2||local.positions.length<16)return;
  const coordinates=local.positions.map(coordinate);
  const radius=Math.max(...coordinates.map(c=>c.r));
  if(!(radius>0)||coordinates.some(c=>!Number.isFinite(c.r+c.t+c.theta)||c.r<radius*.01))return;
  const tolerance=radius*5e-5, cells=new Map<string,number[]>(), clusters:{r:number;t:number;vertices:number[]}[]=[],owner=new Int32Array(coordinates.length).fill(-1);
  // Small geometric tolerance covers imported float32 noise, not arbitrary
  // pleats or eccentric sections. Ambiguous near-profile nodes are rejected.
  for(let v=0;v<coordinates.length;v++){
    if((v&255)===0)work?.check();
    const p=coordinates[v]!,x=Math.floor(p.r/tolerance),y=Math.floor(p.t/tolerance),hits:number[]=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const n of cells.get(`${x+dx}:${y+dy}`)??[]){
      const q=clusters[n]!;if(Math.hypot(q.r-p.r,q.t-p.t)<=tolerance)hits.push(n);
    }
    if(hits.length>1)return;
    let n=hits[0];if(n===undefined){n=clusters.length;clusters.push({r:p.r,t:p.t,vertices:[]});const k=`${x}:${y}`,a=cells.get(k)??[];a.push(n);cells.set(k,a);}
    owner[v]=n;clusters[n]!.vertices.push(v);
  }
  if(clusters.length<2||clusters.length>512||clusters.some(n=>n.vertices.length<8))return;
  const ringEdges=clusters.map(()=>new Map<number,Set<number>>()),adj=clusters.map(()=>new Set<number>()),edges=new Set<string>();
  for(const tri of local.triangles){
    const ns=[...new Set(tri.map(v=>owner[v]!))];if(ns.length!==2)return;
    adj[ns[0]!]!.add(ns[1]!);adj[ns[1]!]!.add(ns[0]!);
    for(let k=0;k<3;k++){const a=tri[k]!,b=tri[(k+1)%3]!;edges.add(edgeKey(a,b));if(owner[a]!==owner[b])continue;
      const map=ringEdges[owner[a]!]!;for(const[u,v]of[[a,b],[b,a]]){const set=map.get(u!)??new Set<number>();set.add(v!);map.set(u!,set);}
    }
  }
  const ends=adj.map((a,i)=>a.size===1?i:-1).filter(i=>i>=0);
  if(ends.length!==2||adj.some(a=>a.size<1||a.size>2))return;
  const boundaryNodes=local.boundaries.map(loop=>new Set(loop.map(v=>owner[v]!)));
  if(boundaryNodes.some(b=>b.size!==1)||!ends.every(i=>boundaryNodes.some(b=>b.has(i))))return;
  let radialError=0;
  for(let n=0;n<clusters.length;n++){
    work?.check();const group=clusters[n]!,map=ringEdges[n]!;
    if(map.size!==group.vertices.length||[...map.values()].some(a=>a.size!==2))return;
    const seen=new Set<number>(),ordered:number[]=[];let prev=-1,v=group.vertices[0]!;
    while(!seen.has(v)){seen.add(v);ordered.push(v);const next=[...map.get(v)!].find(j=>j!==prev);if(next===undefined)return;prev=v;v=next;}
    if(v!==ordered[0]||ordered.length!==group.vertices.length)return;
    let winding=0;for(let i=0;i<ordered.length;i++){
      const d=coordinates[ordered[(i+1)%ordered.length]!]!.theta-coordinates[ordered[i]!]!.theta;
      const a=Math.atan2(Math.sin(d),Math.cos(d));if(Math.abs(a)>Math.PI/2)return;winding+=a;
    }
    if(Math.abs(Math.abs(winding)-TAU)>1e-5)return;
    // Use section means only after membership has been frozen.
    group.r=group.vertices.reduce((s,v)=>s+coordinates[v]!.r,0)/group.vertices.length;
    group.t=group.vertices.reduce((s,v)=>s+coordinates[v]!.t,0)/group.vertices.length;
    for(const v of group.vertices)radialError=Math.max(radialError,Math.hypot(coordinates[v]!.r-group.r,coordinates[v]!.t-group.t)/radius);
  }
  if(radialError>5e-5)return;
  const start=clusters[ends[0]!]!.t<=clusters[ends[1]!]!.t?ends[0]!:ends[1]!,order=[start];let previous=-1,current=start;
  while(order.length<clusters.length){const next=[...adj[current]!].find(j=>j!==previous);if(next===undefined||order.includes(next))return;order.push(next);previous=current;current=next;}
  if(adj[current]!.size!==1)return;
  const nodes:ProfileNode[]=order.map(n=>({...clusters[n]!,s:0,h:0}));
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1]!,b=nodes[i]!,dr=b.r-a.r,L=Math.hypot(b.t-a.t,dr);if(!(L>tolerance))return;
    b.s=a.s+L;
    b.h=a.h+(Math.abs(dr)<Math.max(a.r,b.r)*1e-8?L/((a.r+b.r)*.5):L*Math.log(b.r/a.r)/dr);
  }
  const length=nodes.at(-1)!.s,conformalHeight=nodes.at(-1)!.h,referenceRadius=length/conformalHeight;
  if(!(length>0&&conformalHeight>0&&Number.isFinite(referenceRadius)))return;
  const nodeOf=new Map<number,number>();nodes.forEach((n,i)=>n.vertices.forEach(v=>nodeOf.set(local.sourceVertices[v]!,i)));
  const a=nodes[0]!,b=nodes.at(-1)!,axial=Math.max(...nodes.map(n=>n.t))-Math.min(...nodes.map(n=>n.t));
  // A shallow radial ring should first retain its inner hole. A cylinder with
  // repeated flared lips instead has a periodic rectangular strip domain.
  const annular=Math.abs(b.r-a.r)>Math.max(axial*1.1,radius*.2);
  if(!annular&&Math.abs(a.r-b.r)>radius*.03)return; // cones keep the analytic sector path
  // Snap the opening to a COMPLETE physical meridian, not to one diagonal.
  const candidates=[...nodes[0]!.vertices].sort((i,j)=>angularDistance(coordinates[i]!.theta,0)-angularDistance(coordinates[j]!.theta,0));
  let seamAngle=NaN;
  for(const v of candidates){
    const angle=coordinates[v]!.theta;let last=-1,ok=true;
    for(const node of nodes){const closest=node.vertices.reduce((best,k)=>angularDistance(coordinates[k]!.theta,angle)<angularDistance(coordinates[best]!.theta,angle)?k:best,node.vertices[0]!);
      if(angularDistance(coordinates[closest]!.theta,angle)>1e-4||(last>=0&&!edges.has(edgeKey(last,closest)))){ok=false;break;}last=closest;
    }
    if(ok){seamAngle=angle;break;}
  }
  if(!annular&&!Number.isFinite(seamAngle))return;
  return{nodes,nodeOf,coordinates,length,conformalHeight,referenceRadius,radialError,tolerance,seamAngle:Number.isFinite(seamAngle)?seamAngle:0,annular};
}

export function metricStripPoint(profile:RevolvedProfile,sourceVertex:number,theta:number,middle:number):Vec2 {
  const node=profile.nodes[profile.nodeOf.get(sourceVertex)!];if(!node)throw Error('Revolved section membership lost.');
  return [(theta-middle)*profile.referenceRadius,node.h*profile.referenceRadius];
}
export function metricAnnulusPoints(profile:RevolvedProfile,local:CutMesh):Vec2[]{
  const reverse=profile.nodes[0]!.r>profile.nodes.at(-1)!.r,inner=reverse?profile.nodes.at(-1)!.r:profile.nodes[0]!.r;
  return local.sourceVertices.map((source,v)=>{
    const node=profile.nodes[profile.nodeOf.get(source)!]!,rho=inner+(reverse?profile.length-node.s:node.s),theta=profile.coordinates[v]!.theta;
    return [rho*Math.cos(theta),rho*Math.sin(theta)];
  });
}
export function revolvedReport(profile:RevolvedProfile,mapping:'rectangle'|'annulus',maxStretch:number,panels=1):RevolvedProfileReport {
  const radii=profile.nodes.map(n=>n.r),inner=Math.min(profile.nodes[0]!.r,profile.nodes.at(-1)!.r);
  return{mapping,sections:profile.nodes.length,sourceMeridianLength:profile.length,radiusRange:[Math.min(...radii),Math.max(...radii)],referenceRadius:profile.referenceRadius,conformalHeight:profile.conformalHeight,radialResidual:profile.radialError,seamSnapDegrees:Math.atan2(Math.sin(profile.seamAngle),Math.cos(profile.seamAngle))*180/Math.PI,maxStretch,
    ...(mapping==='rectangle'?{stripLength:TAU*profile.referenceRadius/panels,stripWidth:profile.length}:{innerRadius:inner,outerRadius:inner+profile.length}),
    note:mapping==='rectangle'?'Geometry-derived repeated meridian; equal width at every azimuth. Chamfers retained; metric ds/r, no forced bounding-box stretch.':'Hole-preserving radial meridian length; no radial slit. Full triangle distortion and boundary checks required; not a claim of zero distortion.'};
}
export function metricContract(local:CutMesh,uv:Vec2[],seams:string[],mapping:'rectangle'|'annulus'):RevolvedMetricContract {
  const bindings:RevolvedMetricContract['bindings']=new Array(local.positions.length);
  local.triangles.forEach((tri,i)=>tri.forEach((v,k)=>{bindings[v]??={face:local.sourceFaces[i]!,corner:k};}));
  return{faces:[...local.sourceFaces],seams:[...seams],boundaryLoops:local.boundaryLoops,bindings,coordinates:uv.map(p=>[...p]),mapping};
}
/** Only uniform scale, translation and a proper rotation are permitted after
 * metric generation. All sampled vertices participate, including cut lips. */
export function validateRevolvedMetric(charts:readonly PackedChart[],seams:ReadonlySet<string>,contracts:readonly RevolvedMetricContract[],work?:UVWork,mesh?:MeshData):void{
  for(const ref of contracts){
    work?.check();const chart=charts.find(c=>c.faceUVs.has(ref.faces[0]!));
    if(!chart||chart.faceUVs.size!==ref.faces.length||ref.faces.some(f=>!chart.faceUVs.has(f)))throw Error('Revolved profile was merged, split or lost after metric generation.');
    if(ref.seams.some(e=>!seams.has(e)))throw Error('Revolved meridian opening or interface seam was removed.');
    if(mesh){
      const local=cutLocalMesh(mesh,ref.faces,seams),actual:Vec2[]=new Array(local.positions.length);
      if(!local.manifold||local.boundaryLoops!==ref.boundaryLoops||local.positions.length!==ref.coordinates.length)throw Error('Revolved opening / hole topology changed.');
      local.sourceFaces.forEach((f,i)=>local.triangles[i]!.forEach((v,k)=>{const p=chart.faceUVs.get(f)![k]!;
        if(actual[v]&&Math.hypot(p[0]-actual[v]![0],p[1]-actual[v]![1])>1e-9)throw Error('Revolved face-corner continuity changed.');actual[v]=p;
      }));
    }
    const target=ref.bindings.map(b=>chart.faceUVs.get(b.face)![b.corner]!);
    const n=target.length;if(n!==ref.coordinates.length||n<3)throw Error('Invalid revolved profile contract.');
    const ca:Vec2=[0,0],cb:Vec2=[0,0];for(let i=0;i<n;i++)for(let k=0;k<2;k++){ca[k]!+=ref.coordinates[i]![k]!/n;cb[k]!+=target[i]![k]!/n;}
    let aa=0,ab=0,den=0,span=0;for(let i=0;i<n;i++){const a=ref.coordinates[i]!,b=target[i]!,x=a[0]-ca[0],y=a[1]-ca[1],X=b[0]-cb[0],Y=b[1]-cb[1];aa+=x*X+y*Y;ab+=x*Y-y*X;den+=x*x+y*y;span=Math.max(span,Math.hypot(X,Y));}
    if(!(den>0&&span>0))throw Error('Degenerate revolved metric output.');const co=aa/den,si=ab/den;
    for(let i=0;i<n;i++){const a=ref.coordinates[i]!,b=target[i]!,x=a[0]-ca[0],y=a[1]-ca[1];if(Math.hypot(cb[0]+co*x-si*y-b[0],cb[1]+si*x+co*y-b[1])>span*2e-7)throw Error('Revolved profile metric changed after packing/stitching/fill; circumferential taper or shear is forbidden.');}
  }
}
export {wrap as wrapProfileAngle};
