/** Closed perforated shells: evaluate a COMPLETE skin/wall partition, not one
 * visible sheet plus an unstructured remainder. Seams follow closed edge-flow
 * candidates. Candidate topology and all face coverage are checked before use.
 */
import {edgeKey,type MeshData,type MeshTopology,type Vec3} from '@meshtailor/mesh-core';
import {openChartWithSlits} from './topology-slits.js';
import {mirrorOpening} from './paired-openings.js';
import {cutLocalMesh} from './cut-topology.js';
import {projectionFrames,projectFrame} from './projection-seeds.js';
import {findReflections,auditReflection,coupleReflection} from './symmetry-boundaries.js';
import {framesFor,subsetComponents,type StructurePartition} from './structure-partitions.js';
import type {UVWork} from './work.js';
interface Loop {vertices:number[];edges:string[];length:number;area:number;center:number[];bend:number}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,k)=>s+x*b[k]!,0);
const sub=(a:readonly number[],b:readonly number[])=>a.map((x,k)=>x-b[k]!);
export function traceShellLoops(mesh:MeshData,faces:readonly number[],top:MeshTopology,work?:UVWork):{loops:Loop[];frame:ReturnType<typeof projectionFrames>[0]}|undefined{
 const local=cutLocalMesh(mesh,faces,new Set()),pframes=projectionFrames(local);if(!pframes.length)return;
 // Largest projected second moment chooses a depth axis, not a world axis.
 const fr=pframes.reduce((best,fr)=>{const uv=projectFrame(local.positions,fr),span=[0,1].map(k=>Math.max(...uv.map(p=>p[k]!))-Math.min(...uv.map(p=>p[k]!)));return span[0]!*span[1]!>best.area?{fr,area:span[0]!*span[1]!}:best;},{fr:pframes[0]!,area:-1}).fr;
 const members=new Set(faces),frames=framesFor(mesh,faces),adj=new Map<number,number[]>(),angles=new Map<string,number>(),edgeFaces=new Map<string,number[]>(),candidates:{score:number;fs:number[];key:string}[]=[];
 for(const[k,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))){edgeFaces.set(k,e.faces);for(const[a,b]of[[e.a,e.b],[e.b,e.a]]){const q=adj.get(a!)??[];q.push(b!);adj.set(a!,q);}const cosine=Math.max(-1,Math.min(1,dot(frames.get(e.faces[0]!)!.normal,frames.get(e.faces[1]!)!.normal))),angle=Math.acos(cosine)*180/Math.PI;angles.set(k,angle);if(angle>40)continue;
  const x=mesh.faces[e.faces[0]!]!.vertices.find(v=>v!==e.a&&v!==e.b)!,y=mesh.faces[e.faces[1]!]!.vertices.find(v=>v!==e.a&&v!==e.b)!,q=[x,e.a,y,e.b].map(v=>mesh.positions[v]!),es=q.map((p,i)=>sub(q[(i+1)%4]!,p)),ls=es.map(e=>Math.hypot(...e));let score=angle*1.5,valid=true;
  for(let i=0;i<4;i++){const c=Math.acos(Math.max(-1,Math.min(1,-dot(es[i]!,es[(i+3)%4]!)/Math.max(1e-30,ls[i]!*ls[(i+3)%4]!))))*180/Math.PI;if(c<30||c>155){valid=false;break;}score+=Math.abs(c-90)/4;}if(valid)candidates.push({score,fs:e.faces,key:k});
 }
 candidates.sort((a,b)=>a.score-b.score);const paired=new Set<number>(),diagonals=new Set<string>();for(const c of candidates)if(!c.fs.some(f=>paired.has(f))){diagonals.add(c.key);c.fs.forEach(f=>paired.add(f));}
 const next=(a:number,b:number)=>{const ab=sub(mesh.positions[b]!,mesh.positions[a]!),len=Math.hypot(...ab);let best=-Infinity,out=-1;for(const c of adj.get(b)??[]){if(c===a)continue;const bc=sub(mesh.positions[c]!,mesh.positions[b]!),cos=dot(ab,bc)/Math.max(1e-30,len*Math.hypot(...bc));if(cos<.5)continue;const score=cos-(diagonals.has(edgeKey(b,c))?.22:0);if(score>best){best=score;out=c;}}return out;};
 const done=new Set<string>(),loops:Loop[]=[];let attempts=0;
 for(const key of edgeFaces.keys())for(const reverse of[false,true]){if((attempts++&255)===0)work?.check();const[a,b]=key.split(':').map(Number) as[number,number];let previous=reverse?b:a,current=reverse?a:b;const verts=[previous],seen=new Set(verts);let closed=false;
  for(let steps=0;steps<Math.min(2048,adj.size);steps++){if(seen.has(current)){closed=current===verts[0];break;}verts.push(current);seen.add(current);const n=next(previous,current);if(n<0)break;previous=current;current=n;}
  if(!closed||verts.length<12)continue;const edges=verts.map((v,i)=>edgeKey(v,verts[(i+1)%verts.length]!)),identity=[...edges].sort().join(',');if(done.has(identity))continue;done.add(identity);
  const coords=projectFrame(verts.map(v=>mesh.positions[v]!),fr),area=Math.abs(coords.reduce((s,p,i)=>{const q=coords[(i+1)%coords.length]!;return s+p[0]*q[1]-p[1]*q[0];},0)/2),lengths=verts.map((v,i)=>Math.hypot(...sub(mesh.positions[v]!,mesh.positions[verts[(i+1)%verts.length]!]!))),length=lengths.reduce((s,x)=>s+x,0);
  if(area<length*length*.015)continue;loops.push({vertices:verts,edges,length,area,center:[0,1].map(k=>coords.reduce((s,p)=>s+p[k]!/coords.length,0)),bend:edges.reduce((s,e,i)=>s+(angles.get(e)??0)*lengths[i]!,0)/length});
 }
 return{loops,frame:fr};
}
export function partitionClosedShell(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,top:MeshTopology,work?:UVWork):StructurePartition|undefined{
 if(faces.length<128||faces.length>24000)return;const local=cutLocalMesh(mesh,faces,cuts),handles=1-local.euler/2;if(!local.manifold||local.boundaryLoops!==0||handles<2||handles>3||!Number.isInteger(handles))return;
 const traced=traceShellLoops(mesh,faces,top,work);if(!traced)return;const {loops,frame}=traced;if(loops.length<1+2*handles)return;
 const frames=framesFor(mesh,faces),total=faces.reduce((s,f)=>s+frames.get(f)!.area,0),maxArea=Math.max(...loops.map(l=>l.area));
 const outer=loops.filter(l=>l.area>maxArea*.7&&l.bend>8).sort((a,b)=>b.bend-a.bend).slice(0,8),inner=loops.filter(l=>l.area<maxArea*.35&&l.area>maxArea*.025&&l.bend>8).sort((a,b)=>b.area-a.area);
 const families:Loop[][]=[];for(const l of inner){const fam=families.find(f=>Math.hypot(...sub(l.center,f[0]!.center))<Math.sqrt(f[0]!.area)*.45&&l.area>f[0]!.area*.4);if(fam)fam.push(l);else families.push([l]);}
 const holes=families.filter(f=>f.length>=2).sort((a,b)=>b[0]!.area-a[0]!.area).slice(0,handles);if(holes.length!==handles)return;
 const walls: {faces:number[];cuts:string[];score:number}[][]=[];
 for(const family of holes){const candidates:{faces:number[];cuts:string[];score:number}[]=[];
  for(let i=0;i<family.length;i++)for(let j=i+1;j<family.length;j++){work?.check();const a=family[i]!,b=family[j]!,set=new Set([...cuts,...a.edges,...b.edges]),parts=subsetComponents(mesh,faces,set,top);if(parts.length!==2)continue;
   for(const p of parts){const ar=p.reduce((s,f)=>s+frames.get(f)!.area,0);if(ar<total*.045||ar>total*.23||p.length<32)continue;const patch=cutLocalMesh(mesh,p,set);if(!patch.manifold||patch.euler!==0||patch.boundaryLoops!==2)continue;
    const alignment=p.reduce((s,f)=>s+Math.abs(dot(frames.get(f)!.normal,frame.normal))*frames.get(f)!.area,0)/ar;
    const score=alignment+.03*(a.length+b.length)/Math.sqrt(ar)-.003*Math.min(a.bend,b.bend);candidates.push({faces:p,cuts:[...a.edges,...b.edges],score});
   }
  }
  candidates.sort((a,b)=>a.score-b.score);const unique=candidates.filter((c,i)=>!candidates.slice(0,i).some(p=>p.faces.length===c.faces.length&&new Set(p.faces).has(c.faces[0]!)));walls.push(unique.slice(0,10));
 }
 if(walls.some(w=>!w.length))return;
 const reflection=findReflections(mesh,faces,work)[0],results:StructurePartition[]=[];let budget=0;
 const visit=(i:number,chosen:typeof walls[number])=>{if(i<holes.length){for(const w of walls[i]!)visit(i+1,[...chosen,w]);return;}
  const ids=chosen.flatMap(w=>w.faces);if(new Set(ids).size!==ids.length)return;
  for(const outside of outer){if(++budget>1000)return;work?.check();const allCuts=new Set([...cuts,...outside.edges,...chosen.flatMap(w=>w.cuts)]),parts=subsetComponents(mesh,faces,allCuts,top);if(parts.length!==handles+2)continue;
   const wallIds=new Set(ids),skins=parts.filter(p=>!wallIds.has(p[0]!));if(skins.length!==2||skins.some(p=>p.some(f=>wallIds.has(f))))continue;
   if(skins.some(p=>{const ar=p.reduce((s,f)=>s+frames.get(f)!.area,0),local=cutLocalMesh(mesh,p,allCuts);return ar<total*.18||!local.manifold||local.euler!==1-handles||local.boundaryLoops!==handles+1;}))continue;
   let ordered=[...skins,...chosen.map(w=>w.faces)];const audit=reflection?auditReflection(ordered,reflection):undefined;
   // Whole-shell score: two coherent skins and paired return walls. It does not
   // maximize one attractive front while discarding the back's complexity.
   let cost=chosen.reduce((s,w)=>s+w.score,0);for(const p of skins){const ar=p.reduce((s,f)=>s+frames.get(f)!.area,0),signed=p.reduce((s,f)=>s+dot(frames.get(f)!.normal,frame.normal)*frames.get(f)!.area,0);cost+=1-Math.abs(signed)/ar;}
   cost+=audit?4*audit.mismatchedFaces/Math.max(1,audit.matchedFaces):0;
   const areas=chosen.map(w=>w.faces.reduce((s,f)=>s+frames.get(f)!.area,0));if(reflection&&areas.length===2)cost+=Math.abs(Math.log(areas[0]!/areas[1]!));
   results.push({parts:ordered,kind:'closed-shell',symmetry:audit,loops:1+2*handles,score:-cost,reason:'Complete closed-shell partition: two multi-hole skins and coherent return walls, bounded edge-flow loop candidates; no source UV.'});
  }
 };
 visit(0,[]);results.sort((a,b)=>b.score-a.score);
 const result=results[0];if(result&&reflection){const coupled=coupleReflection(mesh,result.parts,reflection,cuts,top,work);if(coupled.accepted){result.parts=coupled.parts;result.symmetry=coupled.after;}}
 if(result){
  const labels=new Map<number,number>();result.parts.forEach((p,i)=>p.forEach(f=>labels.set(f,i)));const boundaryCuts=new Set(cuts);
  for(const[k,e]of top.edges)if(e.faces.length===2&&e.faces.every(f=>labels.has(f))&&labels.get(e.faces[0]!)!==labels.get(e.faces[1]!))boundaryCuts.add(k);
  result.openings=[];const paired=new Set<number>(),permutation=result.symmetry?.permutation;
  for(let i=2;i<result.parts.length;i++){if(paired.has(i))continue;const p=result.parts[i]!,local=cutLocalMesh(mesh,p,boundaryCuts),opened=openChartWithSlits(mesh,p,boundaryCuts,local,work);if(!opened)continue;
   result.openings.push({faces:p,edges:opened.added});paired.add(i);const j=permutation?.[i];
   if(reflection&&j!==undefined&&j>=2&&j!==i&&!paired.has(j)){
    const mirror=mirrorOpening(mesh,result.parts[j]!,boundaryCuts,opened.added,reflection,work);
    if(mirror){result.openings.push({faces:result.parts[j]!,edges:mirror.edges,paired:mirror});paired.add(j);}
   }
  }
 }
 return result;
}
