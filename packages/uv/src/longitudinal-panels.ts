import {edgeKey,type MeshData,type MeshTopology} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {framesFor,subsetComponents,type StructurePartition} from './structure-partitions.js';
import {reflectionFrames} from './reflection-frame.js';
import {detectSurfaceReflection,dot3,reflectionSummary} from './surface-reflection.js';
import type {UVWork} from './work.js';

/** A geometric strip family: continuous longitudinal crease chains bound broad
 * panels of a bent extrusion. This is NOT the generic normal-cone segmentation.
 * Every accepted major panel spans the same long direction, retains a complete
 * disk and jointly agrees with the surface reflection. End faces are retained.
 */
export function partitionLongitudinalPanels(mesh:MeshData,faces:readonly number[],hard:ReadonlySet<string>,top:MeshTopology,tolerance=.018,work?:UVWork):StructurePartition|undefined {
  if(faces.length<64||faces.length>12000)return;
  const whole=cutLocalMesh(mesh,faces,hard);if(!whole.manifold||whole.euler<1||whole.boundaryLoops>1)return;
  const members=new Set(faces);for(const key of hard)if(top.edges.get(key)?.faces.some(f=>members.has(f)))return;
  const frames=reflectionFrames(mesh,faces),axis=frames[0]?.normal;if(!axis)return;
  const verts=[...new Set(faces.flatMap(f=>[...mesh.faces[f]!.vertices]))];
  const extent=frames.map(fr=>{const d=verts.map(v=>dot3(mesh.positions[v]!,fr.normal));return Math.max(...d)-Math.min(...d);});
  if(extent[0]!<extent[1]!*2.2||extent[0]!<extent[2]!*4)return;
  const reflection=detectSurfaceReflection(whole,{tolerance},work);if(!reflection)return;
  const ff=framesFor(mesh,faces),total=faces.reduce((s,f)=>s+ff.get(f)!.area,0);
  for(const degrees of [35,30,25]){
    work?.check();const cuts=new Set(hard),cos=Math.cos(degrees*Math.PI/180);
    for(const [k,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&dot3(ff.get(e.faces[0]!)!.normal,ff.get(e.faces[1]!)!.normal)<cos)cuts.add(k);
    const pieces=subsetComponents(mesh,faces,cuts,top);
    let major=pieces.filter(p=>{if(p.length<8)return false;const area=p.reduce((s,f)=>s+ff.get(f)!.area,0),d=[...new Set(p.flatMap(f=>[...mesh.faces[f]!.vertices]))].map(i=>dot3(mesh.positions[i]!,axis)),length=Math.max(...d)-Math.min(...d);return area>=total*.035&&length>=extent[0]!*.72&&length*length/area>=5;});
    if(major.length<2||major.length>12)continue;
    let valid=true;
    for(const part of major){const local=cutLocalMesh(mesh,part,hard),v=[...new Set(part.flatMap(f=>[...mesh.faces[f]!.vertices]))],d=v.map(i=>dot3(mesh.positions[i]!,axis)),length=Math.max(...d)-Math.min(...d),area=part.reduce((s,f)=>s+ff.get(f)!.area,0);if(!local.disk||length<extent[0]!*.72||length*length/area<5){valid=false;break;}}
    if(!valid)continue;
    // Narrow bevel facets are transitions, not a request for many hair-thin
    // charts. Assign them to a directly adjacent broad longitudinal panel.
    // Whole-disk and paired-family tests below validate the atomic proposal.
    const areaOf=(p:readonly number[])=>p.reduce((sum,f)=>sum+ff.get(f)!.area,0);
    const masses=major.map(areaOf),largest=Math.max(...masses);
    const thin=new Set(major.map((p,i)=>i).filter(i=>masses[i]!<largest*.22&&masses[i]!<total*.055));
    if(thin.size&&thin.size<major.length-1){
      const owner=new Map<number,number>();major.forEach((p,i)=>p.forEach(f=>owner.set(f,i)));
      const candidate=major.map(p=>p.slice());let moved=0;
      for(const i of thin){
        const adjacent=new Set<number>();
        for(const f of major[i]!)for(const key of mesh.faces[f]!.vertices.map((v,k,t)=>edgeKey(v,t[(k+1)%3]!))){
          if(hard.has(key))continue;
          for(const other of top.edges.get(key)?.faces??[]){const j=owner.get(other);if(j!==undefined&&j!==i&&!thin.has(j))adjacent.add(j);}
        }
        const j=[...adjacent].sort((a,b)=>masses[b]!-masses[a]!)[0];
        if(j!==undefined){candidate[j]!.push(...candidate[i]!);candidate[i]=[];moved++;}
      }
      const compact=candidate.filter(p=>p.length);
      if(moved&&compact.every(p=>cutLocalMesh(mesh,p,hard).disk))major=compact;
    }
    const selected=new Set(major.flat()),rest=faces.filter(f=>!selected.has(f));if(rest.reduce((s,f)=>s+ff.get(f)!.area,0)>total*.08)continue;
    const ends=subsetComponents(mesh,rest,hard,top);if(ends.length>2||ends.some(p=>!cutLocalMesh(mesh,p,hard).disk))continue;
    const parts=[...major,...ends],labels=new Map<number,number>();parts.forEach((p,i)=>p.forEach(f=>labels.set(f,i)));
    const counts=parts.map(()=>new Map<number,number>());let mass=0;
    for(const p of reflection.pairs){if(p.boundary)continue;const i=labels.get(whole.sourceFaces[p.a.face]!)!,j=labels.get(whole.sourceFaces[p.b.face]!)!;counts[i]!.set(j,(counts[i]!.get(j)??0)+p.weight);counts[j]!.set(i,(counts[j]!.get(i)??0)+p.weight);mass+=p.weight*2;}
    const perm=counts.map(c=>[...c].sort((a,b)=>b[1]-a[1])[0]?.[0]??-1);let mismatch=0;
    counts.forEach((c,i)=>{for(const[j,w]of c)if(perm[i]!==j)mismatch+=w;});
    if(major.some((_,i)=>perm[i]!<0||perm[perm[i]!]!==i)||mismatch/Math.max(mass,1e-30)>.04)continue;
    return {parts:parts.map(p=>p.slice().sort((a,b)=>a-b)),kind:'longitudinal-panels',reason:`Complete longitudinal crease panels (${degrees} degrees), end caps retained, mirrored family conflict ${(100*mismatch/Math.max(mass,1e-30)).toFixed(3)}%; geometry only.`,score:1-mismatch/mass,surfaceReflection:reflectionSummary(reflection)};
  }
}
