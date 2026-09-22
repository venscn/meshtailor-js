import {validateSurfaceSymmetryOutput} from './surface-symmetry-output.js';
import {validateStructureOutput} from './structure-output.js';
import {shapeQuality} from './chart-quality.js';
import type {MeshData,Vec2} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {projectFrame} from './projection-seeds.js';
import {featureContract,type FeatureContractReport} from './feature-contract.js';
import type {PeelReport} from './peel-plan.js';
import type {PackedChart} from './preview.js';
import type {UVWork} from './work.js';
/** Recheck the ACTUAL atlas after packing/fill/stitch, not a discarded seed.
 * Frame directions are intrinsic geometric evidence; projection's translation
 * and uniform scale cancel in the contract. No source texture fields are used. */
export function validateFeatureOutput(mesh:MeshData,charts:readonly PackedChart[],seams:ReadonlySet<string>,peel:PeelReport|undefined,work?:UVWork):Map<number,{feature:FeatureContractReport;shape:ReturnType<typeof shapeQuality>}>{
 validateStructureOutput(mesh,charts,seams,peel,work);
 validateSurfaceSymmetryOutput(mesh,charts,peel,work);
 const result=new Map<number,{feature:FeatureContractReport;shape:ReturnType<typeof shapeQuality>}>();if(!peel)return result;
 for(const group of peel.groups){
  if(group.kind!=='feature-sheet'||!group.featureFrame)continue;work?.check();
  const matches=charts.filter(c=>c.faceUVs.has(group.faces[0]!));const c=matches[0];
  if(matches.length!==1||!c||c.faceUVs.size!==group.faces.length||group.faces.some(f=>!c.faceUVs.has(f)))throw Error('Protected geometric sheet was split or merged during processing; previous complete result is retained.');
  const local=cutLocalMesh(mesh,group.faces,seams),uv:Vec2[]=new Array(local.positions.length);
  local.sourceFaces.forEach((f,i)=>local.triangles[i]!.forEach((v,k)=>{const p=c.faceUVs.get(f)![k]!;if(uv[v]&&Math.hypot(uv[v]![0]-p[0],uv[v]![1]-p[1])>1e-9)throw Error('Feature boundary corner mismatch');uv[v]=p;}));
  if(local.boundaryLoops!==group.boundaryLoops)throw Error('Protected hole structure changed during processing.');
  const r=featureContract(projectFrame(local.positions,group.featureFrame),uv,local.boundaries);
  if(!r.valid)throw Error('Final atlas violates geometric hole/boundary landmarks; no partial result published.');
  result.set(c.id,{feature:r,shape:shapeQuality(local,uv,1,30)});
 }
 return result;
}
