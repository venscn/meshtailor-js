/** Complete depth-monotone sheets of a closed reflection-symmetric surface.
 * A closed, shallow cap must not be opened by an arbitrary diagonal sweep.
 * Compare all geometry-derived view directions, require BOTH sheets to remain
 * whole, manifold and injectively projectable, then preserve their shared rim.
 * This is a geometric test; no cap/helmet name or authored UV is consulted.
 */
import {regularizeBinaryPartition,type MeshData,type MeshTopology,type Vec2,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {detectSurfaceReflection,reflectionSummary,dot3,type SurfaceReflectionReport} from './surface-reflection.js';
import {checkUVTriangles} from './uv-quality.js';
import {simpleUVBoundary} from './boundary-guard.js';
import {projectionFrames,projectFrame} from './projection-seeds.js';
import {subsetComponents,framesFor} from './structure-partitions.js';
import type {UVWork} from './work.js';
export interface SymmetricSheets {
  parts:number[][];reflection:SurfaceReflectionReport;partReflections:SurfaceReflectionReport[];
  direction:Vec3;score:number;reason:string;
}
export function partitionSymmetricSheets(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,top:MeshTopology,tolerance=.018,work?:UVWork):SymmetricSheets|undefined{
 if(faces.length<96||faces.length>20000)return;
 // A one-edge authored/user cut may not yet duplicate corner topology. Respect
 // the declared constraint itself, not only the Euler value after cutting.
 if(cuts.size){const members=new Set(faces);for(const key of cuts){const e=top.edges.get(key);if(e&&e.faces.some(f=>members.has(f)))return;}}
 const local=cutLocalMesh(mesh,faces,cuts);if(!local.manifold||local.euler!==2||local.boundaryLoops!==0)return;
 // Recognition precedes grouping. Low-confidence asymmetric shells continue
 // through the usual structural planner, never forced into equal halves.
 const reflection=detectSurfaceReflection(local,{tolerance},work);if(!reflection)return;
 const frames=framesFor(mesh,faces),total=faces.reduce((a,f)=>a+frames.get(f)!.area,0),candidates:SymmetricSheets[]=[];
 for(const frame of projectionFrames(local)){
  work?.check();const labels=new Map<number,number>();for(const f of faces)labels.set(f,dot3(frames.get(f)!.normal,frame.normal)>0?0:1);
  const seams=new Set(cuts);for(const[key,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>labels.has(f))&&labels.get(e.faces[0]!)!==labels.get(e.faces[1]!))seams.add(key);
  let parts=subsetComponents(mesh,faces,seams,top);if(parts.length!==2)continue;
  for(const band of [8,5,3]){const regular=regularizeBinaryPartition(mesh,parts,cuts,top,()=>work?.check(),band);if(regular.report.accepted&&(regular.report.afterTeeth<regular.report.beforeTeeth||regular.report.afterLength<regular.report.beforeLength*.995))parts=regular.parts;}
  const partReflections:SurfaceReflectionReport[]=[];let valid=true,score=0;
  for(const part of parts){
   const ar=part.reduce((s,f)=>s+frames.get(f)!.area,0);if(ar<total*.10||part.length<32){valid=false;break;}
   const patch=cutLocalMesh(mesh,part,seams);if(!patch.disk){valid=false;break;}
   const points=projectFrame(patch.positions,frame),sum=patch.triangles.reduce((s,[a,b,c])=>s+(points[b]![0]-points[a]![0])*(points[c]![1]-points[a]![1])-(points[b]![1]-points[a]![1])*(points[c]![0]-points[a]![0]),0);if(sum<0)points.forEach(p=>p[1]*=-1);
   if(!simpleUVBoundary(points,patch.boundaries,work)||!checkUVTriangles(patch.triangles.map(t=>t.map(v=>points[v]!) as [Vec2,Vec2,Vec2]),1,work).valid){valid=false;break;}
   const rr=detectSurfaceReflection(patch,{tolerance,fixedPlane:{normal:reflection.normal,offset:reflection.offset}},work);if(!rr){valid=false;break;}partReflections.push(reflectionSummary(rr));
   score+=part.reduce((s,f)=>s+Math.abs(dot3(frames.get(f)!.normal,frame.normal))*frames.get(f)!.area,0)/total;
  }
  if(valid&&partReflections.length===2)candidates.push({parts,reflection:reflectionSummary(reflection),partReflections,direction:frame.normal,score,reason:'Reliable surface reflection, then two complete depth sheets with a shared geometric rim; both boundaries and projected interiors independently checked.'});
 }
 candidates.sort((a,b)=>b.score-a.score);return candidates[0];
}
