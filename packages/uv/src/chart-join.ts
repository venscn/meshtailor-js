import {type MeshData} from '@meshtailor/mesh-core';
import {cutLocalMesh,type CutMesh} from './cut-topology.js';
import type {UVWork} from './work.js';
/** Glue along one OPEN boundary chain when deleting every common seam would
 * close a handle/cycle. Remaining interface edges stay as real UV slits.
 * A joined chart must still be a disk; no nearest-position welding is used.
 */
export function joinAlongBoundaryChain(mesh:MeshData,faces:readonly number[],seams:ReadonlySet<string>,interfaceEdges:readonly string[],work?:UVWork):{local:CutMesh;seams:Set<string>;removed:string[]}|null{
  if(interfaceEdges.length<2)return null;
  const ends=new Map<string,[number,number]>(),incident=new Map<number,string[]>(),length=new Map<string,number>();
  for(const e of interfaceEdges){const [a,b]=e.split(':').map(Number) as [number,number];if(!mesh.positions[a]||!mesh.positions[b])throw new Error('Invalid shared edge');ends.set(e,[a,b]);for(const v of [a,b]){const list=incident.get(v)??[];list.push(e);incident.set(v,list);}length.set(e,Math.hypot(...mesh.positions[a]!.map((x,k)=>x-mesh.positions[b]![k]!)));}
  const used=new Set<string>(),paths:string[][]=[];
  const trace=(start:number,first:string)=>{let v=start,e=first;const path:string[]=[];
    while(!used.has(e)){used.add(e);const [a,b]=ends.get(e)!;const next=a===v?b:a;
      // Do not glue the closing edge of a loop: that would recreate the handle.
      if(next===start){if(!path.length)path.push(e);break;}
      path.push(e);v=next;const es=incident.get(v)!;if(es.length!==2)break;e=es.find(x=>x!==e)!;
    }if(path.length)paths.push(path);
  };
  for(const [v,es]of incident)if(es.length!==2)for(const e of es)if(!used.has(e))trace(v,e);
  for(const e of interfaceEdges)if(!used.has(e))trace(ends.get(e)![0],e);
  paths.sort((a,b)=>b.reduce((s,e)=>s+length.get(e)!,0)-a.reduce((s,e)=>s+length.get(e)!,0));
  // Bounded fallback for branch/pinch interfaces; large paths are preferred.
  const candidates=[...paths.slice(0,4),...[...interfaceEdges].sort((a,b)=>length.get(b)!-length.get(a)!).slice(0,2).map(e=>[e])];
  for(const path of candidates){work?.check();const candidate=new Set(seams);for(const e of path)candidate.delete(e);const local=cutLocalMesh(mesh,faces,candidate);if(local.disk)return{local,seams:candidate,removed:path};}
  return null;
}
