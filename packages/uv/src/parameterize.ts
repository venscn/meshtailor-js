import {projectionSeeds} from './projection-seeds.js';
import {planarShapeCandidate,freeBoundaryARAP} from './free-boundary.js';
import { uvProgress, rethrowUVStop, type UVWork } from './work.js';
import type { Vec2,Vec3 } from '@meshtailor/mesh-core';
import type { CutMesh } from './cut-topology.js';
import { checkUVTriangles, type UVQuality, signedArea2 } from './uv-quality.js';
export interface SolverOptions { projectionSeed?:boolean; iterations:number; tolerance:number; method:'auto'|'lscm'|'tutte'; uvObjective?:'paint'|'compact'; paintIterations?:number }
export interface Parameterization { uv:Vec2[]; method:'lscm'|'tutte'|'planar-shape'|'arap-free'|'projected-free'; quality:UVQuality; iterations:number; residual:number; fallbackReason?:string }
export function triangleArea(a:Vec3,b:Vec3,c:Vec3):number{const u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!);return Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!)*.5;}
type Row={ids:number[];values:number[]};
/** Matrix-free, diagonally preconditioned conjugate gradients on A^T A.
 * Dirichlet/pin variables are eliminated, not weakly penalized. */
function leastSquares(rows:Row[],n:number,fixed:Map<number,number>,opts:SolverOptions,work?:UVWork){
  const free=Int32Array.from({length:n},()=>-1);let count=0;for(let i=0;i<n;i++)if(!fixed.has(i))free[i]=count++;
  const rRows:{ids:number[];values:number[];rhs:number}[]=rows.map(row=>{let rhs=0;const ids:number[]=[],values:number[]=[];row.ids.forEach((id,k)=>{if(fixed.has(id))rhs-=row.values[k]!*fixed.get(id)!;else{ids.push(free[id]!);values.push(row.values[k]!);}});return{ids,values,rhs};});
  // Flatten once. Matrix-vector products execute thousands of times per chart;
  // per-row callbacks and tiny objects here used to dominate large-mesh jobs.
  const offsets=new Uint32Array(rRows.length+1);
  for(let i=0;i<rRows.length;i++)offsets[i+1]=offsets[i]!+rRows[i]!.ids.length;
  const columns=new Uint32Array(offsets[rRows.length]!),values=new Float64Array(columns.length);
  const diag=new Float64Array(count),b=new Float64Array(count);
  for(let i=0;i<rRows.length;i++){
    const row=rRows[i]!;
    for(let k=0;k<row.ids.length;k++){
      const id=row.ids[k]!,value=row.values[k]!,j=offsets[i]!+k;
      columns[j]=id;values[j]=value;diag[id]+=value*value;b[id]+=value*row.rhs;
    }
  }
  const apply=(x:Float64Array,out:Float64Array)=>{
    out.fill(0);
    for(let i=0;i<rRows.length;i++){
      const start=offsets[i]!,end=offsets[i+1]!;let sum=0;
      for(let j=start;j<end;j++)sum+=x[columns[j]!]!*values[j]!;
      for(let j=start;j<end;j++)out[columns[j]!]+=values[j]!*sum;
    }
  };
  const result=cg(b,diag,apply,opts,work);
  const full=Float64Array.from({length:n},(_,i)=>fixed.get(i)??result.x[free[i]!]!);
  return {...result,x:full};
}
function cg(b:Float64Array,diag:Float64Array,apply:(x:Float64Array,out:Float64Array)=>void,opts:SolverOptions,work?:UVWork){
  const n=b.length,x=new Float64Array(n),r=b.slice(),z=new Float64Array(n),p=new Float64Array(n),ap=new Float64Array(n);
  const dot=(a:Float64Array,b:Float64Array)=>{let s=0;for(let i=0;i<n;i++)s+=a[i]!*b[i]!;return s;};
  const bnorm=Math.sqrt(dot(b,b));if(bnorm===0)return{x,iterations:0,residual:0};
  for(let i=0;i<n;i++){z[i]=r[i]!/Math.max(diag[i]!,1e-30);p[i]=z[i]!;}
  let rz=dot(r,z),residual=1,iterations=0;
  for(;iterations<opts.iterations;iterations++){
    if(iterations%64===0)uvProgress(work,{stage:'parameterize',detail:'迭代求解线性系统',current:iterations,total:opts.iterations,unit:'迭代上限'});
    apply(p,ap);const den=dot(p,ap);if(!(den>0)||!Number.isFinite(den))break;
    const alpha=rz/den;for(let i=0;i<n;i++){x[i]+=alpha*p[i]!;r[i]-=alpha*ap[i]!;}
    residual=Math.sqrt(dot(r,r))/bnorm;if(residual<opts.tolerance){iterations++;break;}
    for(let i=0;i<n;i++)z[i]=r[i]!/Math.max(diag[i]!,1e-30);
    const next=dot(r,z),beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]!+beta*p[i]!;rz=next;
  }
  return{x,iterations,residual};
}
function normalized(mesh:CutMesh):Vec3[]{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of mesh.positions)for(let a=0;a<3;a++){min[a]=Math.min(min[a]!,p[a]!);max[a]=Math.max(max[a]!,p[a]!);}
  const span=Math.max(...max.map((x,i)=>x-min[i]!));if(!(span>0))throw new Error('Zero-size UV chart');return mesh.positions.map(p=>p.map((x,i)=>(x-min[i]!)/span) as Vec3);
}
function lscm(mesh:CutMesh,opts:SolverOptions,work?:UVWork){
  const ps=normalized(mesh),n=ps.length,rows:Row[]=[];
  for(const t of mesh.triangles){const [a,b,c]=t.map(v=>ps[v]!) as [Vec3,Vec3,Vec3],ab=b.map((v,i)=>v-a[i]!),ac=c.map((v,i)=>v-a[i]!);const len=Math.hypot(...ab),area=triangleArea(a,b,c);
    if(!(area>1e-15&&len>1e-15))throw new Error('Degenerate 3D triangle; repair input geometry first.');
    const x=ac.reduce((s,v,i)=>s+v*ab[i]!,0)/len,y=2*area/len,den=len*y,weight=Math.sqrt(area);
    const gx=[-y,y,0].map(v=>v/den*weight),gy=[x-len,-x,len].map(v=>v/den*weight),ids=[...t,...t.map(v=>v+n)];
    rows.push({ids,values:[...gx,...gy.map(v=>-v)]},{ids,values:[...gy,...gx]});
  }
  const far=(v:number)=>mesh.boundary.reduce((best,k)=>{const d=(i:number)=>ps[i]!.reduce((s,x,j)=>s+(x-ps[v]![j]!)**2,0);return d(k)>d(best)?k:best;},mesh.boundary[0]!);
  const a=far(mesh.boundary[0]!),b=far(a),fixed=new Map([[a,0],[a+n,0],[b,1],[b+n,0]]),solved=leastSquares(rows,n*2,fixed,opts,work);
  return {uv:ps.map((_,i)=>[solved.x[i]!,solved.x[i+n]!] as Vec2),iterations:solved.iterations,residual:solved.residual};
}
/** Tutte uniform positive weights + strictly convex arc-length circle boundary.
 * This is a robustness fallback, not an angle/area-optimal method. */
function tutte(mesh:CutMesh,opts:SolverOptions,work?:UVWork){
  const ps=normalized(mesh),n=ps.length,uv:Vec2[]=Array.from({length:n},()=>[0,0]);const boundary=new Set(mesh.boundary);
  const lens=mesh.boundary.map((v,i)=>Math.hypot(...ps[v]!.map((x,j)=>x-ps[mesh.boundary[(i+1)%mesh.boundary.length]!]![j]!))),total=lens.reduce((s,x)=>s+x,0);let length=0;
  mesh.boundary.forEach((v,i)=>{uv[v]=[Math.cos(2*Math.PI*length/total),Math.sin(2*Math.PI*length/total)];length+=lens[i]!;});
  const adj:Set<number>[]=Array.from({length:n},()=>new Set());for(const t of mesh.triangles)for(let k=0;k<3;k++){const a=t[k]!,b=t[(k+1)%3]!;adj[a]!.add(b);adj[b]!.add(a);}
  const free=new Map<number,number>();for(let i=0;i<n;i++)if(!boundary.has(i))free.set(i,free.size);
  const entries=[...free.entries()],diag=Float64Array.from(entries.map(([v])=>adj[v]!.size));
  const apply=(x:Float64Array,out:Float64Array)=>{for(const [v,id]of entries){let val=adj[v]!.size*x[id]!;for(const b of adj[v]!)if(free.has(b))val-=x[free.get(b)!]!;out[id]=val;}};
  let iterations=0,residual=0;for(let a=0;a<2;a++){const rhs=Float64Array.from(entries.map(([v])=>[...adj[v]!].reduce((s,b)=>s+(boundary.has(b)?uv[b]![a]!:0),0))),r=cg(rhs,diag,apply,opts,work);iterations=Math.max(iterations,r.iterations);residual=Math.max(residual,r.residual);for(const [v,id]of entries)uv[v]![a]=r.x[id]!;}
  return{uv,iterations,residual};
}
/** Average angular distortion can hide an almost collapsed subregion. This
 * scale-invariant, per-triangle area check is used by the generic peeling path
 * before atlas scaling, in addition to the final whole-atlas validity check. */
export function chartAreaDensity(mesh:CutMesh,uv:readonly Vec2[]):{min:number;max:number}{
  let a=0,b=0;const ratios:number[]=[];
  for(const t of mesh.triangles){const area=triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!),v=Math.abs(signedArea2(uv[t[0]]!,uv[t[1]]!,uv[t[2]]!))/2;
    if(!(area>0&&v>0))return{min:0,max:Infinity};a+=area;b+=v;ratios.push(v/area);}
  const mean=b/a;let min=Infinity,max=0;for(const r of ratios){min=Math.min(min,r/mean);max=Math.max(max,r/mean);}return{min,max};
}
const areaNotCollapsed=(mesh:CutMesh,uv:readonly Vec2[])=>{const r=chartAreaDensity(mesh,uv);return r.min>=1e-3&&r.max<=200;};
export function parameterizeChart(mesh:CutMesh,options:Partial<SolverOptions>={},work?:UVWork):Parameterization{
  const opts:SolverOptions={iterations:2000,tolerance:1e-9,method:'auto',uvObjective:'paint',paintIterations:24,...options};let reason='';
  const finish=(r:ReturnType<typeof lscm>,method:Parameterization['method']):Parameterization=>{
    const signs=mesh.triangles.reduce((s,t)=>s+signedArea2(r.uv[t[0]]!,r.uv[t[1]]!,r.uv[t[2]]!),0);
    if(signs<0)r.uv.forEach(p=>p[1]*=-1);
    uvProgress(work,{stage:'quality',detail:'检查翻面、退化与正面积重叠'});
    const quality=checkUVTriangles(mesh.triangles.map(t=>t.map(v=>r.uv[v]!) as [Vec2,Vec2,Vec2]),100,work);
    return {...r,method,quality,...(reason?{fallbackReason:reason}:{})};
  };
  if(!['paint','compact'].includes(opts.uvObjective!))throw Error('Invalid UV objective.');
  if(!Number.isInteger(opts.paintIterations)||opts.paintIterations!<1||opts.paintIterations!>100)throw Error('Paint iterations must be 1..100.');
  if(opts.uvObjective==='paint'&&opts.method==='auto'){
    const uv=planarShapeCandidate(mesh);
    if(uv){const result=finish({uv,iterations:0,residual:0},'planar-shape');if(result.quality.valid)return result;}
  }
  if(opts.projectionSeed&&opts.uvObjective==='paint'&&opts.method==='auto'){
    // Projection is an initialization. Opposite-facing/occluded triangles reject
    // it BEFORE relaxation. No circular or square boundary is a final target.
    for(const uv of projectionSeeds(mesh)){
      const signs=mesh.triangles.map(t=>signedArea2(uv[t[0]]!,uv[t[1]]!,uv[t[2]]!));
      if(signs.some(x=>x>0)&&signs.some(x=>x<0))continue;
      const seed=finish({uv,iterations:0,residual:0},'projected-free');
      if(!seed.quality.valid)continue;
      try{const free=freeBoundaryARAP(mesh,seed.uv,opts.paintIterations!,Math.min(opts.iterations,600),work);
        const r=finish(free,'projected-free');if(r.quality.valid&&free.maxAnisotropy<=100&&areaNotCollapsed(mesh,r.uv)){r.fallbackReason='Valid surface projection seed, followed by free-boundary relaxation with global boundary guards.';return r;}
      }catch(e){rethrowUVStop(e);}
    }
  }
  if(!mesh.disk)throw new Error(`UV chart is not a disk: Euler=${mesh.euler}, boundaries=${mesh.boundaryLoops}`);
  if(opts.method!=='tutte'){
    try{const r=finish(lscm(mesh,opts,work),'lscm');if(r.quality.valid&&r.residual<1e-6){
      if(!opts.projectionSeed||areaNotCollapsed(mesh,r.uv))return r;
      // Conformal maps may be injective yet collapse a large surface patch to
      // almost no texels. Relax THAT valid seed before requesting another cut.
      const free=freeBoundaryARAP(mesh,r.uv,opts.paintIterations!,Math.min(opts.iterations,600),work),relaxed=finish(free,'arap-free');
      if(relaxed.quality.valid&&free.maxAnisotropy<=100&&areaNotCollapsed(mesh,relaxed.uv)){relaxed.fallbackReason='Area-collapsed conformal seed recovered by guarded free-boundary relaxation.';return relaxed;}
      reason='Conformal seed collapses a surface region; free relaxation could not recover its area. ';
    }reason+=`LSCM rejected: residual=${r.residual.toExponential(2)}, flips=${r.quality.flipped}, degenerates=${r.quality.degenerate}, overlaps>=${r.quality.overlaps}`;}
    catch(e){rethrowUVStop(e);reason=String(e);}
    if(opts.method==='lscm')throw new Error(reason);
  }
  const seed=finish(tutte(mesh,opts,work),'tutte');
  if(!seed.quality.valid||seed.residual>1e-6)throw new Error(`Tutte seed invalid; ${reason}; residual=${seed.residual}`);
  // Circular embedding is only a numerical initialization in paint mode.
  // The final boundary is unconstrained and must independently pass global checks.
  if(opts.uvObjective==='paint'&&opts.method!=='tutte'){
    const free=freeBoundaryARAP(mesh,seed.uv,opts.paintIterations!,Math.min(opts.iterations,600),work);
    const r=finish(free,'arap-free');
    if(!r.quality.valid||!free.accepted||free.maxAnisotropy>100||free.energy>free.initialEnergy+1e-8||(opts.projectionSeed&&!areaNotCollapsed(mesh,r.uv)))
      throw Error('Hand-paint shape solve rejected; circular fallback is disabled. Keep the existing separate charts or add a deliberate seam. '+reason);
    r.fallbackReason=(reason?reason+'; ':'')+`Free boundary ARAP energy ${free.initialEnergy.toPrecision(4)} -> ${free.energy.toPrecision(4)} (${free.accepted} accepted steps); no circle boundary is retained.`;
    return r;
  }
  return seed;
}
