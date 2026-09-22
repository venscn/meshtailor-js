import {simpleUVBoundary} from './boundary-guard.js';
import type { Vec2, Vec3 } from '@meshtailor/mesh-core';
import type { CutMesh } from './cut-topology.js';
import { uvProgress, type UVWork } from './work.js';

const cross = (a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i]!,0);
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const det=(a:Vec2,b:Vec2,c:Vec2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

/** A genuinely planar patch keeps its silhouette (including concavities and
 * holes), instead of mapping the outer boundary to a circle. This is NOT a
 * general curved-surface projection: near-planarity and triangle validity are
 * checked by the caller. No geometry or seam variables are changed. */
export function planarShapeCandidate(mesh:CutMesh):Vec2[]|null {
  const normal:Vec3=[0,0,0];let maxArea=0,axis:Vec3=[1,0,0];
  const p=mesh.positions;if(!p.length)return null;
  for(const t of mesh.triangles){const a=sub(p[t[1]]!,p[t[0]]!),b=sub(p[t[2]]!,p[t[0]]!),n=cross(a,b),area=Math.hypot(...n);for(let k=0;k<3;k++)normal[k]!+=n[k]!;if(area>maxArea){maxArea=area;axis=a;}}
  const len=Math.hypot(...normal);if(!(len>1e-15))return null;const n=normal.map(x=>x/len) as Vec3;
  const u0=axis.map((x,i)=>x-dot(axis,n)*n[i]!) as Vec3,uLen=Math.hypot(...u0);if(!(uLen>1e-15))return null;
  const u=u0.map(x=>x/uLen) as Vec3,v=cross(n,u),origin=p[0]!;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let minD=Infinity,maxD=-Infinity;
  for(const q of p){const d=dot(sub(q,origin),n);minD=Math.min(minD,d);maxD=Math.max(maxD,d);for(let k=0;k<3;k++){min[k]=Math.min(min[k]!,q[k]!);max[k]=Math.max(max[k]!,q[k]!);}}
  const span=Math.max(...max.map((x,i)=>x-min[i]!));if(maxD-minD>span*1e-5)return null;
  return p.map(q=>{const d=sub(q,origin);return[dot(d,u),dot(d,v)] as Vec2;});
}

type Element={t:[number,number,number];gx:number[];gy:number[];area:number};
/** Free-boundary ARAP, local rotations + a sparse FEM global solve. Only one
 * vertex is pinned for translation; NO circle/square boundary constraints.
 * An injective seed is required. Backtracking prevents local flips and increases
 * in ARAP energy. Every accepted iterate also has a simple boundary; final
 * global triangle overlaps are independently checked by parameterizeChart.
 * This is an independent TS implementation, not libigl bindings. */
export interface LinearShapeConstraint {axis:0|1;ids:number[];coefficients:number[];target:number;weight:number}
export interface ShapeAnchors {boundaryStiffness?:number;interiorStiffness?:number;linearConstraints?:LinearShapeConstraint[]}
export function freeBoundaryARAP(mesh:CutMesh,seed:Vec2[],maxIterations:number,linearIterations:number,work?:UVWork,anchors:ShapeAnchors={}){
  if(!simpleUVBoundary(seed,mesh.boundaries,work))throw Error('ARAP seed violates cut-boundary contract.');
  const n=mesh.positions.length,ps=mesh.positions,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of ps)for(let k=0;k<3;k++){min[k]=Math.min(min[k]!,p[k]!);max[k]=Math.max(max[k]!,p[k]!);}
  const span=Math.max(...max.map((x,i)=>x-min[i]!)),elements:Element[]=[];let totalArea=0,uvArea=0;
  for(const t of mesh.triangles){const a=sub(ps[t[1]]!,ps[t[0]]!).map(x=>x/span) as Vec3,b=sub(ps[t[2]]!,ps[t[0]]!).map(x=>x/span) as Vec3,l=Math.hypot(...a),area=Math.hypot(...cross(a,b))/2,x=dot(a,b)/l,y=2*area/l;
    if(!(area>1e-15&&l>1e-15))throw Error('ARAP requires nondegenerate source triangles.');
    elements.push({t,gx:[-1/l,1/l,0],gy:[(x-l)/(l*y),-x/(l*y),1/y],area});totalArea+=area;uvArea+=det(seed[t[0]]!,seed[t[1]]!,seed[t[2]]!)/2;
  }
  if(!(uvArea>0))throw Error('ARAP requires consistently oriented initial UV.');
  const scale=Math.sqrt(totalArea/uvArea),origin=seed[0]!;
  let uv=seed.map(p=>[(p[0]-origin[0])*scale,(p[1]-origin[1])*scale] as Vec2);
  // Anchors refer ONLY to the validated geometry-derived seed, never model UV.
  // Their scale uses surface area, avoiding sensitivity to mesh units/density.
  // General sparse equality penalties, used for surface-to-surface reflection.
  // Expressed in the incoming seed frame; normalize exactly like all vertices.
  const constraints=(anchors.linearConstraints??[]).map(row=>{
    if(row.ids.length!==row.coefficients.length||!row.ids.length||row.ids.some(i=>!Number.isInteger(i)||i<0||i>=n)||!row.coefficients.every(Number.isFinite)||!Number.isFinite(row.target)||!Number.isFinite(row.weight)||row.weight<0||row.weight>1000||![0,1].includes(row.axis))throw Error('Invalid linear shape constraint.');
    const target=(row.target-origin[row.axis]*row.coefficients.reduce((a,x)=>a+x,0))*scale;
    return {...row,target,weight:row.weight*totalArea};
  });
  const reference=uv.map(p=>[...p] as Vec2),boundaryIds=new Set(mesh.boundaries.flat()),anchorWeights=new Float64Array(n);
  const boundaryWeight=anchors.boundaryStiffness??0,interiorWeight=anchors.interiorStiffness??0;
  if(![boundaryWeight,interiorWeight].every(x=>Number.isFinite(x)&&x>=0&&x<=1000))throw Error('Invalid shape anchor strength');
  for(const e of elements)for(const i of e.t)anchorWeights[i]+=interiorWeight*e.area/3;
  for(const i of boundaryIds)anchorWeights[i]+=boundaryWeight*totalArea/Math.max(1,boundaryIds.size);
  // Translation is eliminated exactly. FEM stiffness is SPD on this free set,
  // even for obtuse source triangles (no arbitrary positive cotangent clamping).
  const rows:Map<number,number>[]=Array.from({length:n-1},()=>new Map());
  for(const e of elements)for(let a=0;a<3;a++)for(let b=0;b<3;b++){
    const i=e.t[a]!-1,j=e.t[b]!-1;if(i<0||j<0)continue;
    rows[i]!.set(j,(rows[i]!.get(j)??0)+e.area*(e.gx[a]!*e.gx[b]!+e.gy[a]!*e.gy[b]!));
  }
  for(let i=1;i<n;i++)rows[i-1]!.set(i-1,(rows[i-1]!.get(i-1)??0)+anchorWeights[i]!);
  const offsets=new Uint32Array(n);for(let i=0;i<n-1;i++)offsets[i+1]=offsets[i]!+rows[i]!.size;
  const columns=new Uint32Array(offsets[n-1]!),values=new Float64Array(columns.length),diag=new Float64Array(n-1);
  for(let i=0;i<n-1;i++){let k=offsets[i]!;for(const [j,value] of rows[i]!){columns[k]=j;values[k++]=value;}diag[i]=rows[i]!.get(i)??0;}
  const mul=(x:Float64Array,out:Float64Array)=>{for(let i=0;i<n-1;i++){let s=0;for(let k=offsets[i]!;k<offsets[i+1]!;k++)s+=values[k]!*x[columns[k]!]!;out[i]=s;}};
  const solve=(input:Float64Array,axis:number)=>{
    const b=input.slice(),diagonal=diag.slice(),terms=constraints.filter(row=>row.axis===axis);
    for(const row of terms)row.ids.forEach((id,k)=>{if(id>0){b[id-1]+=row.weight*row.coefficients[k]!*row.target;diagonal[id-1]+=row.weight*row.coefficients[k]!**2;}});
    const apply=(x:Float64Array,out:Float64Array)=>{mul(x,out);for(const row of terms){let d=0;row.ids.forEach((id,k)=>{if(id>0)d+=row.coefficients[k]!*x[id-1]!;});row.ids.forEach((id,k)=>{if(id>0)out[id-1]+=row.weight*row.coefficients[k]!*d;});}};
    const x=Float64Array.from(uv.slice(1).map(p=>p[axis]!)),r=new Float64Array(n-1),z=r.slice(),p=r.slice(),ap=r.slice();apply(x,ap);let rz=0,bn=0;
    for(let i=0;i<x.length;i++){r[i]=b[i]!-ap[i]!;z[i]=r[i]!/Math.max(diagonal[i]!,1e-25);p[i]=z[i]!;rz+=r[i]!*z[i]!;bn+=b[i]!*b[i]!;}
    let iterations=0,residual=0;
    for(;iterations<linearIterations;iterations++){
      if(iterations%64===0)work?.check();let rr=0;for(let i=0;i<r.length;i++)rr+=r[i]!*r[i]!;residual=Math.sqrt(rr/Math.max(bn,1e-30));if(residual<1e-8)break;
      apply(p,ap);let den=0;for(let i=0;i<x.length;i++)den+=p[i]!*ap[i]!;if(!(den>0))break;
      const alpha=rz/den;let next=0;
      for(let i=0;i<x.length;i++){x[i]+=alpha*p[i]!;r[i]-=alpha*ap[i]!;z[i]=r[i]!/Math.max(diagonal[i]!,1e-25);next+=r[i]!*z[i]!;}
      const beta=next/Math.max(rz,1e-300);for(let i=0;i<x.length;i++)p[i]=z[i]!+beta*p[i]!;rz=next;
    }
    return{x,iterations,residual};
  };
  const jac=(vs:Vec2[],e:Element)=>{let a=0,b=0,c=0,d=0;for(let k=0;k<3;k++){const p=vs[e.t[k]!]!;a+=p[0]*e.gx[k]!;b+=p[0]*e.gy[k]!;c+=p[1]*e.gx[k]!;d+=p[1]*e.gy[k]!;}return[a,b,c,d];};
  const energy=(vs:Vec2[])=>{let s=0;for(const e of elements){const [a,b,c,d]=jac(vs,e) as [number,number,number,number];s+=e.area*(a*a+b*b+c*c+d*d+2-2*Math.hypot(a+d,c-b));}for(let i=0;i<n;i++)s+=anchorWeights[i]!*((vs[i]![0]-reference[i]![0])**2+(vs[i]![1]-reference[i]![1])**2);for(const row of constraints){const d=row.ids.reduce((sum,id,k)=>sum+row.coefficients[k]!*vs[id]![row.axis],0)-row.target;s+=row.weight*d*d;}return s/totalArea;};
  const initialEnergy=energy(uv);let previous=initialEnergy,iterations=0,residual=0,accepted=0,boundaryRejected=0;
  for(;iterations<maxIterations;iterations++){
    uvProgress(work,{stage:'parameterize',detail:'自由边界保形 ARAP（不固定圆形边界）',current:iterations,total:maxIterations,unit:'保形迭代'});
    const bx=new Float64Array(n-1),by=new Float64Array(n-1);
    for(const e of elements){const [a,b,c,d]=jac(uv,e) as [number,number,number,number],den=Math.hypot(a+d,c-b),co=den>1e-15?(a+d)/den:1,si=den>1e-15?(c-b)/den:0;
      for(let k=0;k<3;k++){const i=e.t[k]!-1;if(i<0)continue;bx[i]+=e.area*(co*e.gx[k]!-si*e.gy[k]!);by[i]+=e.area*(si*e.gx[k]!+co*e.gy[k]!);}
    }
    for(let i=1;i<n;i++){bx[i-1]+=anchorWeights[i]!*reference[i]![0];by[i-1]+=anchorWeights[i]!*reference[i]![1];}
    const x=solve(bx,0),y=solve(by,1);residual=Math.max(x.residual,y.residual);
    const target:Vec2[]=[[0,0],...Array.from({length:n-1},(_,i)=>[x.x[i]!,y.x[i]!] as Vec2)];let candidate:Vec2[]|null=null,next=previous;
    for(let alpha=1;alpha>=1/65536;alpha*=.5){
      const v=uv.map((p,i)=>[p[0]+alpha*(target[i]![0]-p[0]),p[1]+alpha*(target[i]![1]-p[1])] as Vec2);
      if(elements.some(e=>det(v[e.t[0]]!,v[e.t[1]]!,v[e.t[2]]!)<=e.area*1e-10))continue;
      const en=energy(v);if(Number.isFinite(en)&&en<=previous+1e-12){
        if(!simpleUVBoundary(v,mesh.boundaries,work)){boundaryRejected++;continue;}
        candidate=v;next=en;break;
      }
    }
    if(!candidate)break;uv=candidate;accepted++;const decrease=previous-next;previous=next;
    if(decrease<Math.max(1e-9,previous*1e-6))break;
  }
  let maxAnisotropy=1;
  for(const e of elements){const [a,b,c,d]=jac(uv,e) as [number,number,number,number],sum=a*a+b*b+c*c+d*d,detJ=a*d-b*c,hi=(sum+Math.sqrt(Math.max(0,sum*sum-4*detJ*detJ)))/2;
    maxAnisotropy=Math.max(maxAnisotropy,hi/Math.max(Math.abs(detJ),1e-30));}
  return {uv,iterations:iterations+1,residual,initialEnergy,energy:previous,accepted,boundaryRejected,maxAnisotropy};
}
