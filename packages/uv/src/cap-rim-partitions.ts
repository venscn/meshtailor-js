/** A near-tangent belt is NOT one half of either facing surface. Preserve the
 * complete belt bounded by two real crease loops before normal-sign sheet cuts.
 * Only closed genus-zero solids with two injective caps and a verified annulus
 * qualify. Smooth domes, arbitrary spheres, handles, and supplied cuts do not.
 */
import {type MeshData,type MeshTopology,type Vec2} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {projectionFrames,projectFrame} from './projection-seeds.js';
import {framesFor,subsetComponents,type StructurePartition} from './structure-partitions.js';
import {inspectBand} from './human-templates.js';
import {checkUVTriangles} from './uv-quality.js';
import {simpleUVBoundary} from './boundary-guard.js';
import type {UVWork} from './work.js';
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i]!,0);
export function partitionCapRim(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,top:MeshTopology,work?:UVWork):StructurePartition|undefined {
 if(faces.length<32||faces.length>24000)return;
 const members=new Set(faces);
 for(const key of cuts)if(top.edges.get(key)?.faces.some(f=>members.has(f)))return;
 const local=cutLocalMesh(mesh,faces,cuts);
 if(!local.manifold||local.euler!==2||local.boundaryLoops!==0)return;
 const frames=framesFor(mesh,faces),total=faces.reduce((s,f)=>s+frames.get(f)!.area,0);
 let best:StructurePartition|undefined;
 for(const frame of projectionFrames(local)){
  work?.check();
  const labels=new Map(faces.map(f=>{const d=dot(frames.get(f)!.normal,frame.normal);return [f,d>.35?0:d<-.35?1:2];}));
  const grouped=[0,1,2].map(l=>faces.filter(f=>labels.get(f)===l));
  if(grouped.some(p=>p.length<6))continue;
  const seams=new Set(cuts);let rimLength=0,strongLength=0,invalidEdge=false;
  for(const[key,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))){
   const a=labels.get(e.faces[0]!)!,b=labels.get(e.faces[1]!)!;
   if(a===b)continue;
   if(a!==2&&b!==2){invalidEdge=true;break;}
   seams.add(key);
   const p=mesh.positions[e.a]!,q=mesh.positions[e.b]!,len=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);rimLength+=len;
   if(dot(frames.get(e.faces[0]!)!.normal,frames.get(e.faces[1]!)!.normal)<Math.cos(35*Math.PI/180))strongLength+=len;
  }
  if(invalidEdge||!rimLength||strongLength/rimLength<.9)continue;
  const cc=subsetComponents(mesh,faces,seams,top);
  if(cc.length!==3||cc.some(p=>p.some(f=>labels.get(f)!==labels.get(p[0]!))))continue;
  let valid=true;
  for(const cap of grouped.slice(0,2)){
   if(cap.reduce((s,f)=>s+frames.get(f)!.area,0)<total*.04){valid=false;break;}
   const patch=cutLocalMesh(mesh,cap,seams);
   if(!patch.disk){valid=false;break;}
   const points=projectFrame(patch.positions,frame),tris=()=>patch.triangles.map(t=>t.map(v=>points[v]!) as [Vec2,Vec2,Vec2]);
   if(patch.triangles.reduce((s,[a,b,c])=>s+(points[b]![0]-points[a]![0])*(points[c]![1]-points[a]![1])-(points[b]![1]-points[a]![1])*(points[c]![0]-points[a]![0]),0)<0)points.forEach(p=>p[1]*=-1);
   if(!simpleUVBoundary(points,patch.boundaries,work)||!checkUVTriangles(tris(),1,work).valid){valid=false;break;}
  }
  if(!valid||!inspectBand(mesh,grouped[2]!).ok)continue;
  const score=strongLength/rimLength;
  if(!best||score>best.score)best={kind:'cap-rim',parts:grouped,roles:['cap','cap','rim'],score,reason:'Two complete cap surfaces separated from one continuous circumferential rim along two strong crease loops; tangent side faces are not assigned by a noisy normal sign.'};
 }
 return best;
}
