import type {MeshData,Vec2} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {simpleUVBoundary} from './boundary-guard.js';
import type {PeelReport} from './peel-plan.js';
import type {PackedChart} from './preview.js';
import type {UVWork} from './work.js';
/** Whole component contract: both skins AND both walls must survive. Preserving
 * one good-looking sheet cannot excuse destroying the complementary regions.
 * Packing may move/rotate/scale, but not silently cut holes into outer borders.
 */
export function validateStructureOutput(mesh:MeshData,charts:readonly PackedChart[],seams:ReadonlySet<string>,peel:PeelReport|undefined,work?:UVWork):void {
 for(const g of peel?.groups??[]){
  if(g.kind!=='cap-rim')continue;
  work?.check();const members=new Set(g.faces),seen=new Set<number>();
  const matches=charts.filter(c=>[...c.faceUVs.keys()].some(f=>members.has(f)));
  if(!matches.length||(g.structureRole==='cap'&&matches.length!==1))throw Error('A protected cap/rim region was split or lost.');
  for(const c of matches){
   const faces=[...c.faceUVs.keys()];
   if(faces.some(f=>!members.has(f)||seen.has(f)))throw Error('Cap/rim boundary crossed by a later merge.');
   faces.forEach(f=>seen.add(f));
   const local=cutLocalMesh(mesh,faces,seams),coords:Vec2[]=new Array(local.positions.length);
   if(!local.disk)throw Error('Cap/rim opening no longer defines a complete disk.');
   local.sourceFaces.forEach((f,i)=>local.triangles[i]!.forEach((v,k)=>{
    const p=c.faceUVs.get(f)![k]!;
    if(coords[v]&&Math.hypot(p[0]-coords[v]![0],p[1]-coords[v]![1])>1e-9)throw Error('Cap/rim corner mismatch.');
    coords[v]=p;
   }));
   if(!simpleUVBoundary(coords,local.boundaries,work))throw Error('Cap/rim boundary collapsed or self-contacted.');
  }
  if(seen.size!==members.size)throw Error('A protected cap/rim face was lost.');
 }
 for(const g of peel?.groups??[]){if(g.kind!=='closed-shell'&&g.kind!=='longitudinal-panels')continue;work?.check();const matches=charts.filter(c=>c.faceUVs.has(g.faces[0]!)),c=matches[0];
  if(matches.length!==1||!c||c.faceUVs.size!==g.faces.length||g.faces.some(f=>!c.faceUVs.has(f)))throw Error('Complete shell skin/wall grouping was split, merged or lost; no partial structure is accepted.');
  for(const e of g.openingEdges??[])if(!seams.has(e))throw Error('Planned wall opening was lost.');
  const local=cutLocalMesh(mesh,g.faces,seams);const expected=g.openingEdges?.length?1:g.structureBoundaryLoops;
  if(!local.manifold||local.boundaryLoops!==expected)throw Error('Complete shell boundary contract violated: a skin hole or wall opening changed.');
  const coords:Vec2[]=new Array(local.positions.length);local.sourceFaces.forEach((f,i)=>local.triangles[i]!.forEach((v,k)=>{const p=c.faceUVs.get(f)![k]!;if(coords[v]&&Math.hypot(...p.map((x,j)=>x-coords[v]![j]!))>1e-9)throw Error('Shell face corner consistency violated.');coords[v]=p;}));
  if(!simpleUVBoundary(coords,local.boundaries,work))throw Error('Shell boundary self contact or overlap: no closed-off cut accepted.');
 }
}
