/** Structure groups precede solver cuts. A narrow, bilateral connector is a
 * separate spatial region; its two panels are not repartitioned by normal cones.
 * Geometry only. No expected counts, fixed island ids, or source UV references.
 */
import {edgeKey,type MeshData,type MeshTopology,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {findReflections,auditReflection,coupleReflection,type Reflection,type SymmetryAudit} from './symmetry-boundaries.js';
import type {UVWork} from './work.js';
export interface StructurePartition {parts:number[][];kind:'bilateral-connector'|'closed-shell'|'longitudinal-panels'|'cap-rim';roles?:('cap'|'rim')[];surfaceReflection?:import('./surface-reflection.js').SurfaceReflectionReport;symmetry?:SymmetryAudit;reason:string;loops?:number;score:number;openings?:{faces:number[];edges:string[];paired?:import('./paired-openings.js').PairedOpening}[]}
export function framesFor(mesh:MeshData,faces:readonly number[]){return new Map(faces.map(f=>{const ps=mesh.faces[f]!.vertices.map(v=>mesh.positions[v]!),u=ps[1]!.map((x,k)=>x-ps[0]![k]!),v=ps[2]!.map((x,k)=>x-ps[0]![k]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],l=Math.hypot(...n);return[f,{normal:n.map(x=>x/Math.max(l,1e-30)),area:l/2,center:[0,1,2].map(k=>ps.reduce((s,p)=>s+p[k]!/3,0))}];}));}
export function subsetComponents(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,top:MeshTopology):number[][]{
 const members=new Set(faces),seen=new Set<number>(),out:number[][]=[];for(const f of faces)if(!seen.has(f)){const q=[f];seen.add(f);for(let i=0;i<q.length;i++){const t=mesh.faces[q[i]!]!.vertices;for(let k=0;k<3;k++){const key=edgeKey(t[k]!,t[(k+1)%3]!);if(cuts.has(key))continue;for(const g of top.edges.get(key)?.faces??[])if(members.has(g)&&!seen.has(g)){seen.add(g);q.push(g);}}}out.push(q);}return out;
}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,k)=>s+x*b[k]!,0);
export function partitionConnector(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,top:MeshTopology,work?:UVWork):StructurePartition|undefined{
 if(faces.length<96||faces.length>30000)return;
 const refl=findReflections(mesh,faces,work).find(r=>r.faceCoverage>.94);if(!refl)return;
 const frames=framesFor(mesh,faces),total=faces.reduce((s,f)=>s+frames.get(f)!.area,0),members=new Set(faces),all=faces.flatMap(f=>[...mesh.faces[f]!.vertices]),side=(p:readonly number[])=>dot(p,refl.normal)-refl.offset;
 const fullWidth=2*Math.max(...all.map(v=>Math.abs(side(mesh.positions[v]!)))),longAxes=(()=>{const a:Vec3=Math.abs(refl.normal[0])<.8?[1,0,0]:[0,1,0];const u=a.map((x,k)=>x-dot(a,refl.normal)*refl.normal[k]!) as Vec3,ul=Math.hypot(...u);for(let k=0;k<3;k++)u[k]!/=ul;const n=refl.normal,v=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]] as Vec3;return[u,v];})();
 const candidates:StructurePartition[]=[];
 for(const degree of[35,40,48]){work?.check();const blocked=new Set(cuts);for(const[k,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&dot(frames.get(e.faces[0]!)!.normal,frames.get(e.faces[1]!)!.normal)<Math.cos(degree*Math.PI/180))blocked.add(k);
  const pieces=subsetComponents(mesh,faces,blocked,top);
  for(const seed of pieces){if(seed.length<12)continue;const ar=seed.reduce((s,f)=>s+frames.get(f)!.area,0),center=seed.reduce((s,f)=>s+side(frames.get(f)!.center)*frames.get(f)!.area,0)/ar,vs=[...new Set(seed.flatMap(f=>[...mesh.faces[f]!.vertices]))],width=2*Math.max(...vs.map(v=>Math.abs(side(mesh.positions[v]!))));
   const spans=longAxes.map(n=>{const ds=vs.map(v=>dot(mesh.positions[v]!,n));return Math.max(...ds)-Math.min(...ds);}),long=Math.max(...spans);
   if(ar/total<.02||ar/total>.2||Math.abs(center)>fullWidth*.04||width>fullWidth*.4||long<width*2.5)continue;
   const selected=new Set(seed);
   // Complete short connector caps rather than leaving tiny residual triangles.
   for(const p of pieces){const ps=[...new Set(p.flatMap(f=>[...mesh.faces[f]!.vertices]))].map(v=>mesh.positions[v]!),sides=ps.map(side),pa=p.reduce((s,f)=>s+frames.get(f)!.area,0);if(pa/total>.2)continue;
    if(Math.max(...sides.map(Math.abs))<=width*.51&&Math.min(...sides)<-width*.1&&Math.max(...sides)>width*.1&&Math.abs(p.reduce((s,f)=>s+side(frames.get(f)!.center)*frames.get(f)!.area,0)/Math.max(pa,1e-30))<fullWidth*.03)p.forEach(f=>selected.add(f));
   }
   const parts=[faces.filter(f=>!selected.has(f)&&side(frames.get(f)!.center)>0),faces.filter(f=>!selected.has(f)&&side(frames.get(f)!.center)<=0),[...selected]];
   if(parts.some(p=>p.length<16||subsetComponents(mesh,p,cuts,top).length!==1||!cutLocalMesh(mesh,p,cuts).manifold))continue;
   const area=parts.map(p=>p.reduce((s,f)=>s+frames.get(f)!.area,0));if(Math.min(area[0]!,area[1]!)/Math.max(area[0]!,area[1]!)<.85||area[2]!>total*.22)continue;
   const coupled=coupleReflection(mesh,parts,refl,cuts,top,work),audit=auditReflection(coupled.parts,refl);if(audit.mismatchedFaces>Math.max(4,audit.matchedFaces*.01))continue;
   candidates.push({parts:coupled.parts,kind:'bilateral-connector',symmetry:audit,reason:'Narrow centered longitudinal connector, complete caps, paired whole panels; geometric reflection cells couple opposite diagonals.',score:long/width+audit.coverage});
  }
 }
 return candidates.sort((a,b)=>b.score-a.score)[0];
}
