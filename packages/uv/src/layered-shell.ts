import {regularizeBinaryPartition,type MeshData,type MeshTopology,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {framesFor,subsetComponents} from './structure-partitions.js';
import {detectSurfaceReflection,reflectionSummary,dot3} from './surface-reflection.js';
import type {SymmetricSheets} from './symmetric-sheets.js';
import type {UVWork} from './work.js';

/** Two oppositely oriented skins joined at a physical rim. A closed thin hood
 * is not a single sheet to be opened along an arbitrary diagonal diameter.
 * Radial signs propose labels only; connectedness, crease regularity, topology
 * and reflection of BOTH complete skins decide acceptance.
 */
export function partitionLayeredShell(mesh:MeshData,faces:readonly number[],hard:ReadonlySet<string>,top:MeshTopology,tolerance=.018,work?:UVWork):SymmetricSheets|undefined {
  if(faces.length<96||faces.length>20000)return;
  const local=cutLocalMesh(mesh,faces,hard);if(!local.manifold||local.euler!==2||local.boundaryLoops!==0)return;
  const members=new Set(faces);for(const key of hard)if(top.edges.get(key)?.faces.some(f=>members.has(f)))return;
  const reflection=detectSurfaceReflection(local,{tolerance},work);if(!reflection)return;
  const frames=framesFor(mesh,faces),total=faces.reduce((s,f)=>s+frames.get(f)!.area,0);
  const center=[0,1,2].map(k=>faces.reduce((s,f)=>s+frames.get(f)!.center[k]!*frames.get(f)!.area,0)/total) as Vec3;
  const labels=new Map(faces.map(f=>{const fr=frames.get(f)!;return [f,dot3(fr.normal,fr.center.map((x,k)=>x-center[k]!))>=0?0:1];}));
  const seams=new Set(hard);for(const[k,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&labels.get(e.faces[0]!)!==labels.get(e.faces[1]!))seams.add(k);
  const components=subsetComponents(mesh,faces,seams,top).sort((a,b)=>b.reduce((s,f)=>s+frames.get(f)!.area,0)-a.reduce((s,f)=>s+frames.get(f)!.area,0));
  if(components.length<2||labels.get(components[0]![0]!)===labels.get(components[1]![0]!))return;
  // Reassign only tiny isolated sign errors; never remove their triangles.
  if(components.slice(2).reduce((s,p)=>s+p.reduce((t,f)=>t+frames.get(f)!.area,0),0)>total*.01)return;
  for(const p of components.slice(2))for(const f of p)labels.set(f,1-labels.get(f)!);
  const initial=[0,1].map(l=>faces.filter(f=>labels.get(f)===l)),candidates:SymmetricSheets[]=[];
  for(const band of [5,2]){
    work?.check();const regular=regularizeBinaryPartition(mesh,initial,hard,top,()=>work?.check(),band),parts=regular.parts;
    if(parts.some(p=>p.reduce((s,f)=>s+frames.get(f)!.area,0)<total*.20))continue;
    const locals=parts.map(p=>cutLocalMesh(mesh,p,hard));if(locals.some(l=>!l.disk))continue;
    const reflections=locals.map(l=>detectSurfaceReflection(l,{tolerance},work));
    if(reflections.some(r=>!r||Math.abs(dot3(r.normal,reflection.normal))<.995))continue;
    // A weakly offset plane on a closed round shell must agree with the rim of
    // each now-open sheet, rather than being blindly imposed on that boundary.
    candidates.push({parts,reflection:reflectionSummary(reflection),partReflections:reflections.map(r=>reflectionSummary(r!)),partCorrespondences:reflections.map(r=>r!),direction:reflection.normal,score:-regular.report.afterLength/Math.sqrt(total),reason:'Two complete radial-orientation skins; tiny sign islands reassigned, actual shared rim regularized, each disk and its own surface reflection verified before any slit. No source UV.'});
  }
  return candidates.sort((a,b)=>b.score-a.score)[0];
}
