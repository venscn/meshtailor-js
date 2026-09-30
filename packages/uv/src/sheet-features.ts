/** Geometry evidence for readable surface sheets, BEFORE any genus-opening tree.
 * A solid frame is not a single sheet: its front, back and return walls can have
 * different projection multiplicities. Keep large injective projected regions
 * (including their holes) and leave ALL remaining faces for ordinary solving.
 * No source UV, part names, model IDs, or image-space silhouettes are read.
 */
import {regularizeBinaryPartition,type BoundaryRegularizationReport,edgeKey,type MeshData,type MeshTopology,type Vec2} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {projectFrame,projectionFrames,type ProjectionFrame} from './projection-seeds.js';
import {checkUVTriangles,signedArea2} from './uv-quality.js';
import {simpleUVBoundary} from './boundary-guard.js';
import type {UVWork} from './work.js';
export interface SheetFeature {faces:number[];frame:ProjectionFrame;area3D:number;boundaryLoops:number;score:number;normalThreshold:number;regularization?:BoundaryRegularizationReport}
const area=(p:readonly number[],q:readonly number[],r:readonly number[])=>{const a=q.map((x,k)=>x-p[k]!),b=r.map((x,k)=>x-p[k]!);return Math.hypot(a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!)/2;};
export function findSheetFeatures(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,topology:MeshTopology,work?:UVWork):SheetFeature[]{
 const local=cutLocalMesh(mesh,faces,cuts);if(!local.manifold||faces.length<64)return[];
 // Open developable bands already have a coherent unfolding. Do not replace
 // them with arbitrary front/back normal partitions.
 if(local.euler>0||local.euler===0)return[];
 // A closed single-handle tube is a band, not evidence of a perforated front
 // panel. Splitting every such ring into visible caps creates tiny return strips.
 // Require a multiply-holed sheet or a closed multi-handle frame; no names/IDs.

 const areas=local.triangles.map(t=>area(local.positions[t[0]]!,local.positions[t[1]]!,local.positions[t[2]]!)),total=areas.reduce((s,a)=>s+a,0);
 const indices=new Map(faces.map((f,i)=>[f,i])),adj=faces.map(()=>[] as number[]);
 faces.forEach((f,i)=>{const t=mesh.faces[f]!.vertices;for(let k=0;k<3;k++){const key=edgeKey(t[k]!,t[(k+1)%3]!);if(cuts.has(key))continue;for(const j of topology.edges.get(key)?.faces??[]){const n=indices.get(j);if(n!==undefined&&n!==i)adj[i]!.push(n);}}});
 const candidates:SheetFeature[]=[],seenKeys=new Set<string>();
 for(const base of projectionFrames(local))for(const sign of [1,-1]){
  const frame:ProjectionFrame={...base,v:base.v.map(x=>x*sign) as [number,number,number],normal:base.normal.map(x=>x*sign) as [number,number,number]},uv=projectFrame(local.positions,frame);
  const cosine=local.triangles.map((t,i)=>signedArea2(...t.map(v=>uv[v]!) as [Vec2,Vec2,Vec2])/(2*areas[i]!));
  for(const threshold of [.15,.25,.4,.6]){
   work?.check();const seen=new Uint8Array(faces.length);
   for(let root=0;root<faces.length;root++)if(!seen[root]&&cosine[root]!>=threshold){
    const q=[root];seen[root]=1;let sum=0;
    for(let h=0;h<q.length;h++){const i=q[h]!;sum+=areas[i]!;for(const n of adj[i]!)if(!seen[n]&&cosine[n]!>=threshold){seen[n]=1;q.push(n);}}
    if(q.length<24||sum<total*.12||q.length===faces.length)continue;
    const fs=q.map(i=>faces[i]!).sort((a,b)=>a-b),key=fs.join(',');if(seenKeys.has(key))continue;seenKeys.add(key);
    const patch=cutLocalMesh(mesh,fs,cuts);if(!patch.manifold||patch.boundaryLoops<2||patch.euler!==2-patch.boundaryLoops)continue;
    const coords=projectFrame(patch.positions,frame);if(!simpleUVBoundary(coords,patch.boundaries,work))continue;
    if(!checkUVTriangles(patch.triangles.map(t=>t.map(v=>coords[v]!) as [Vec2,Vec2,Vec2]),1,work).valid)continue;
    // Tiny accidental perforations aren't meaningful features. All holes must
    // remain discernible in this geometric projection, not an arbitrary circle.
    const loopAreas=patch.boundaries.map(loop=>Math.abs(loop.reduce((s,v,k)=>{const a=coords[v]!,b=coords[loop[(k+1)%loop.length]!]!;return s+a[0]*b[1]-a[1]*b[0];},0)/2)).sort((a,b)=>b-a);
    if(loopAreas.slice(1).some(a=>a<loopAreas[0]!*.003))continue;
    candidates.push({faces:fs,frame,area3D:sum,boundaryLoops:patch.boundaryLoops,normalThreshold:threshold,score:sum*(1+.1*Math.min(3,patch.boundaryLoops-1))});
   }
  }
 }
 candidates.sort((a,b)=>b.score-a.score||b.faces.length-a.faces.length||a.faces[0]!-b.faces[0]!);
 const used=new Set<number>(),chosen:SheetFeature[]=[];
 for(const candidate of candidates){
  if(chosen.length===4)break;if(candidate.faces.some(f=>used.has(f)))continue;
  let c=candidate;
  // Normal thresholds propose a sheet, NOT a final seam. Move the actual
  // 3D face partition in a narrow band to eliminate triangle-level saw teeth.
  // Never smooth a rendered UV outline or move the original mesh vertices.
  const selected=new Set(c.faces),rest=faces.filter(f=>!selected.has(f));
  if(rest.length){
   for(const band of [5,2]){
    work?.check();
    const regular=regularizeBinaryPartition(mesh,[c.faces,rest],cuts,topology,()=>work?.check(),band),fs=regular.parts[0]!;
    if(!regular.report.movedFaces||fs.some(f=>used.has(f)))continue;
    const patch=cutLocalMesh(mesh,fs,cuts),coords=projectFrame(patch.positions,c.frame);
    if(!patch.manifold||patch.boundaryLoops!==c.boundaryLoops||patch.euler!==2-c.boundaryLoops||!simpleUVBoundary(coords,patch.boundaries,work))continue;
    if(!checkUVTriangles(patch.triangles.map(t=>t.map(v=>coords[v]!) as [Vec2,Vec2,Vec2]),1,work).valid)continue;
    const sum=fs.reduce((s,f)=>s+areas[indices.get(f)!]!,0);
    c={...c,faces:[...fs].sort((a,b)=>a-b),area3D:sum,regularization:regular.report};break;
   }
  }
  chosen.push(c);c.faces.forEach(f=>used.add(f));
 }

 return chosen;
}
