/** Check the actual final UV coordinates, after optional stitching and packing.
 * Contracts carry only geometry-derived barycentric correspondences. They do
 * not contain the source asset UV or a copied target outline. */
import type {MeshData,Vec2} from '@meshtailor/mesh-core';
import type {SurfacePair,SurfaceReflectionReport} from './surface-reflection.js';
import {auditUVReflection,symmetrySatisfied,type UVReflectionAudit} from './symmetry-parameterization.js';
import type {PeelReport} from './peel-plan.js';
import type {PackedChart} from './preview.js';
import type {UVWork} from './work.js';
export interface SurfaceUVContract {faces:number[];pairs:SurfacePair[];baseline:UVReflectionAudit;surface:SurfaceReflectionReport}
export function validateSurfaceSymmetryOutput(mesh:MeshData,charts:readonly Pick<PackedChart,'id'|'faceUVs'>[],peel:PeelReport|undefined,work?:UVWork):Map<number,UVReflectionAudit>{
 const result=new Map<number,UVReflectionAudit>();if(!peel?.surfaceContracts?.length)return result;
 const owner=new Map<number,number>(),uvByFace=new Map<number,[Vec2,Vec2,Vec2]>();for(const c of charts)for(const[f,uv]of c.faceUVs){if(owner.has(f))throw Error('Repeated face in symmetry output');owner.set(f,c.id);uvByFace.set(f,uv);}
 for(const contract of peel.surfaceContracts){work?.check();const chart=owner.get(contract.faces[0]!);if(chart===undefined||contract.faces.some(f=>owner.get(f)!==chart))throw Error('A verified symmetric surface was split or lost during postprocessing.');
  // Barycentrics evaluate real face corners, including deliberately duplicated
  // seam vertices. No nearest-UV lookup or screen silhouette smoothing.
  const coords:Vec2[]=[],triangles:[number,number,number][]=[];const local=new Map<number,number>();
  contract.faces.forEach((f,i)=>{const t=uvByFace.get(f);if(!t||!mesh.faces[f])throw Error('Missing geometric symmetry face');local.set(f,i);triangles.push([coords.length,coords.length+1,coords.length+2]);coords.push(...t);});
  const pairs=contract.pairs.map(p=>({...p,a:{...p.a,face:local.get(p.a.face)!},b:{...p.b,face:local.get(p.b.face)!}}));
  const audit=auditUVReflection({triangles},coords,pairs);
  if(!symmetrySatisfied(audit)||audit.rms>contract.baseline.rms+2e-4||audit.boundaryRms>contract.baseline.boundaryRms+2e-4)throw Error('Final UV violates verified surface reflection after packing/stitching. Previous complete result retained.');
  result.set(chart,audit);
 }return result;
}
