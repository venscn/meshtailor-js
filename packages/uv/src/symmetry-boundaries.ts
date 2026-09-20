/** Reliable geometric reflection, including triangles with opposite diagonals.
 * Source UV and model/part names are deliberately outside this API.
 */
import {edgeKey, type MeshData, type MeshTopology, type Vec3} from '@meshtailor/mesh-core';
import {reflectionFrames} from './reflection-frame.js';
import {cutLocalMesh} from './cut-topology.js';
import type {UVWork} from './work.js';
export interface ReflectionCell {left:number[];right:number[]}
export interface Reflection {normal:Vec3;offset:number;tolerance:number;vertexCoverage:number;faceCoverage:number;rms:number;vertices:Map<number,number>;cells:ReflectionCell[];diagonalCells:number}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i]!,0);
const key=(ids:readonly number[])=>[...ids].sort((a,b)=>a-b).join(':');
export function findReflections(mesh:MeshData,faces:readonly number[],work?:UVWork):Reflection[]{
 if(faces.length<16)return[];const local=cutLocalMesh(mesh,faces,new Set()),ids=[...new Set(faces.flatMap(f=>[...mesh.faces[f]!.vertices]))];
 const frames=reflectionFrames(mesh,faces),result:Reflection[]=[];if(!frames.length)return[];
 const center=frames[0]!.origin,radius=Math.sqrt(Math.max(...ids.map(i=>mesh.positions[i]!.reduce((s,x,k)=>s+(x-center[k]!)**2,0)))),tol=radius*.012;if(!(tol>0))return[];
 const grid=new Map<string,number[]>();for(const i of ids){const k=mesh.positions[i]!.map(x=>Math.floor(x/tol)).join(',');const a=grid.get(k)??[];a.push(i);grid.set(k,a);}
 const nearest=(p:Vec3)=>{const a=p.map(x=>Math.floor(x/tol));let found=-1,best=tol*tol;for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const id of grid.get(`${a[0]!+x},${a[1]!+y},${a[2]!+z}`)??[]){const d=mesh.positions[id]!.reduce((s,v,k)=>s+(v-p[k]!)**2,0);if(d<best){found=id;best=d;}}return found;};
 const faceKeys=new Map(faces.map(f=>[key(mesh.faces[f]!.vertices),f])),edges=new Map<string,number[]>(),quads=new Map<string,number[]>();
 for(const f of faces){const t=mesh.faces[f]!.vertices;for(let k=0;k<3;k++){const e=edgeKey(t[k]!,t[(k+1)%3]!),a=edges.get(e)??[];a.push(f);edges.set(e,a);}}
 for(const a of edges.values())if(a.length===2){const vs=[...new Set(a.flatMap(f=>[...mesh.faces[f]!.vertices]))];if(vs.length===4)quads.set(key(vs),a);}
 for(const fr of frames){work?.check();const n=fr.normal;if(result.some(r=>Math.abs(dot(r.normal,n))>.9999))continue;let offset=dot(fr.origin,n),raw=new Map<number,number>();
  for(let pass=0;pass<3;pass++){raw=new Map();for(const id of ids){const p=mesh.positions[id]!,d=2*(dot(p,n)-offset),j=nearest(p.map((v,k)=>v-d*n[k]!) as Vec3);if(j>=0)raw.set(id,j);}let s=0,count=0;for(const[i,j]of raw)if(raw.get(j)===i){s+=(dot(mesh.positions[i]!,n)+dot(mesh.positions[j]!,n))/2;count++;}if(count)offset=s/count;}
  const vertices=new Map<number,number>();let error=0;for(const[i,j]of raw)if(raw.get(j)===i){vertices.set(i,j);const p=mesh.positions[i]!,q=mesh.positions[j]!,d=2*(dot(p,n)-offset);error+=p.reduce((s,x,k)=>s+(x-d*n[k]!-q[k]!)**2,0);}
  if(vertices.size<ids.length*.8||[...vertices].filter(([i,j])=>i!==j).length<ids.length*.6)continue;
  const used=new Set<number>(),cells:ReflectionCell[]=[];let diagonalCells=0;
  for(const f of faces){if(used.has(f))continue;const t=mesh.faces[f]!.vertices;if(!t.every(v=>vertices.has(v)))continue;const target=faceKeys.get(key(t.map(v=>vertices.get(v)!)));
   if(target!==undefined&&!used.has(target)){cells.push({left:[f],right:[target]});used.add(f);used.add(target);continue;}
   for(let k=0;k<3;k++){const pair=edges.get(edgeKey(t[k]!,t[(k+1)%3]!));if(pair?.length!==2||pair.some(x=>used.has(x)))continue;const vs=[...new Set(pair.flatMap(f=>[...mesh.faces[f]!.vertices]))];if(!vs.every(v=>vertices.has(v)))continue;const other=quads.get(key(vs.map(v=>vertices.get(v)!)));if(!other||other.some(x=>used.has(x))||other.some(x=>pair.includes(x))&&!other.every(x=>pair.includes(x)))continue;
    cells.push({left:[...pair],right:[...other]});[...pair,...other].forEach(x=>used.add(x));diagonalCells++;break;
   }
  }
  result.push({normal:n,offset,tolerance:tol,vertexCoverage:vertices.size/ids.length,faceCoverage:used.size/faces.length,rms:Math.sqrt(error/Math.max(1,vertices.size)),vertices,cells,diagonalCells});
 }
 return result.sort((a,b)=>b.faceCoverage-a.faceCoverage||a.rms-b.rms);
}
export interface SymmetryAudit {coverage:number;diagonalCells:number;matchedFaces:number;mismatchedFaces:number;splitCells:number;permutation:number[];consistent:boolean}
export function auditReflection(parts:readonly (readonly number[])[],r:Reflection):SymmetryAudit{
 const label=new Map<number,number>();parts.forEach((p,i)=>p.forEach(f=>label.set(f,i)));const counts=parts.map(()=>new Map<number,number>());
 for(const c of r.cells)for(const a of c.left)for(const b of c.right){const i=label.get(a),j=label.get(b);if(i===undefined||j===undefined)continue;counts[i]!.set(j,(counts[i]!.get(j)??0)+1);counts[j]!.set(i,(counts[j]!.get(i)??0)+1);}
 const permutation=counts.map(c=>[...c].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]?.[0]??-1);let matchedFaces=0,mismatchedFaces=0,splitCells=0;
 for(const c of r.cells){const a=new Set(c.left.map(f=>label.get(f))),b=new Set(c.right.map(f=>label.get(f)));if(a.has(undefined)||b.has(undefined))continue;const n=new Set([...c.left,...c.right]).size;matchedFaces+=n;if(a.size!==1||b.size!==1){splitCells++;mismatchedFaces+=n;}else if(permutation[[...a][0]!]!==[...b][0])mismatchedFaces+=n;}
 return{coverage:r.faceCoverage,diagonalCells:r.diagonalCells,matchedFaces,mismatchedFaces,splitCells,permutation,consistent:mismatchedFaces===0&&permutation.every((p,i)=>p>=0&&permutation[p]===i)};
}
/** Couple reliable whole cells, not individual diagonal triangles. Candidate
 * updates must keep every region connected and preserve its topology. */
export function coupleReflection(mesh:MeshData,parts:number[][],r:Reflection,hard:ReadonlySet<string>,topology:MeshTopology,work?:UVWork):{parts:number[][];before:SymmetryAudit;after:SymmetryAudit;accepted:boolean}{
 const before=auditReflection(parts,r),original=parts.map(p=>[...p]);const unchanged=()=>({parts:original,before,after:before,accepted:false});
 if(before.consistent||before.coverage<.8||!before.permutation.every((p,i)=>p>=0&&before.permutation[p]===i))return unchanged();
 const labels=new Map<number,number>();parts.forEach((p,l)=>p.forEach(f=>labels.set(f,l)));const old=parts.map(p=>cutLocalMesh(mesh,p,hard)),locked=new Set<number>();for(const e of hard)for(const f of topology.edges.get(e)?.faces??[])locked.add(f);
 const center=(f:number)=>mesh.faces[f]!.vertices.reduce((s,v)=>s+dot(mesh.positions[v]!,r.normal)/3,0)-r.offset;
 for(const cell of r.cells){work?.check();if([...cell.left,...cell.right].some(f=>!labels.has(f)))continue;
  const left=cell.left.reduce((s,f)=>s+center(f),0)/cell.left.length>=0?cell.left:cell.right,right=left===cell.left?cell.right:cell.left;
  let best=-1,bestCost=Infinity;for(let l=0;l<parts.length;l++){const rl=before.permutation[l]!;if(rl<0)continue;let cost=0,invalid=false;const trial=new Map<number,number>();for(const f of left)trial.set(f,l);for(const f of right){if(trial.has(f)&&trial.get(f)!==rl){invalid=true;break;}trial.set(f,rl);}if(invalid)continue;
   for(const[f,next]of trial){if(locked.has(f)&&labels.get(f)!==next){invalid=true;break;}cost+=labels.get(f)===next?0:.1;const t=mesh.faces[f]!.vertices;for(let k=0;k<3;k++){const e=topology.edges.get(edgeKey(t[k]!,t[(k+1)%3]!));for(const g of e?.faces??[])if(labels.has(g)&&!trial.has(g)&&labels.get(g)!==next)cost+=1;}}
   if(!invalid&&cost<bestCost){best=l;bestCost=cost;}
  }
  if(best>=0){for(const f of left)labels.set(f,best);for(const f of right)labels.set(f,before.permutation[best]!);}
 }
 const result=parts.map(()=>[] as number[]);for(const[f,l]of labels)result[l]!.push(f);
 for(let l=0;l<parts.length;l++){if(result[l]!.length<parts[l]!.length*.7)return unchanged();const local=cutLocalMesh(mesh,result[l]!,hard);if(!local.manifold||local.euler!==old[l]!.euler||local.boundaryLoops!==old[l]!.boundaryLoops)return unchanged();const members=new Set(result[l]),seen=new Set<number>(),q=[result[l]![0]!];seen.add(q[0]!);for(let h=0;h<q.length;h++){const t=mesh.faces[q[h]!]!.vertices;for(let k=0;k<3;k++)for(const j of topology.edges.get(edgeKey(t[k]!,t[(k+1)%3]!))?.faces??[])if(members.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}if(seen.size!==members.size)return unchanged();}
 const after=auditReflection(result,r);if(after.mismatchedFaces>=before.mismatchedFaces)return unchanged();return{parts:result.map(p=>p.sort((a,b)=>a-b)),before,after,accepted:true};
}
