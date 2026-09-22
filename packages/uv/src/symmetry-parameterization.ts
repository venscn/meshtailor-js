/** Reflection-aware metric relaxation. The symmetry relates barycentric surface
 * samples, not corresponding triangle/vertex IDs and not half an authored UV.
 * All actual triangles remain in the local/global solve. */
import type {Vec2} from '@meshtailor/mesh-core';
import type {CutMesh} from './cut-topology.js';
import type {SurfaceReflection,SurfacePair,SurfaceBinding,SurfaceReflectionReport} from './surface-reflection.js';
import {reflectionSummary} from './surface-reflection.js';
import {freeBoundaryARAP,type LinearShapeConstraint} from './free-boundary.js';
import {checkUVTriangles} from './uv-quality.js';
import {simpleUVBoundary} from './boundary-guard.js';
import type {UVWork} from './work.js';
export interface UVReflectionAudit {rms:number;boundaryRms:number;p95:number;max:number;axis:Vec2;center:Vec2;span:number}
export interface UVSymmetryReport {status:'constrained'|'already-symmetric'|'rejected';surface:SurfaceReflectionReport;before:UVReflectionAudit;after:UVReflectionAudit;attempted?:UVReflectionAudit;iterations:number;reason?:string}
export function bindingUV(mesh:Pick<CutMesh,'triangles'>,uv:readonly Vec2[],b:SurfaceBinding):Vec2 {const t=mesh.triangles[b.face]!;return [0,1].map(k=>t.reduce((s,v,j)=>s+uv[v]![k]!*b.weights[j]!,0)) as Vec2;}
/** Fit only rotation/translation of a 2D reflection. Unlike arbitrary affine
 * fitting, this cannot make a distorted outline look symmetric by shearing. */
export function auditUVReflection(mesh:Pick<CutMesh,'triangles'>,uv:readonly Vec2[],pairs:readonly SurfacePair[]):UVReflectionAudit{
 const samples=pairs.map(p=>({a:bindingUV(mesh,uv,p.a),b:bindingUV(mesh,uv,p.b),w:p.weight,boundary:p.boundary})),total=samples.reduce((s,p)=>s+p.w,0),center:Vec2=[0,0];
 for(const p of samples)for(let k=0;k<2;k++)center[k]!+=(p.a[k]!+p.b[k]!)*.5*p.w/Math.max(total,1e-30);
 let c=0,s=0;for(const p of samples){const ax=p.a[0]-center[0],ay=p.a[1]-center[1],bx=p.b[0]-center[0],by=p.b[1]-center[1];c+=p.w*(ax*bx-ay*by);s+=p.w*(ax*by+ay*bx);}
 const angle=.5*Math.atan2(s,c)+Math.PI/2,axis:Vec2=[Math.cos(angle),Math.sin(angle)];
 const span=2*Math.sqrt(uv.reduce((max,p)=>Math.max(max,(p[0]-center[0])**2+(p[1]-center[1])**2),0));
 let en=0,bn=0,bt=0;const errors:number[]=[];for(const p of samples){const dot=(p.a[0]-center[0])*axis[0]+(p.a[1]-center[1])*axis[1],d=Math.hypot(p.a[0]-2*dot*axis[0]-p.b[0],p.a[1]-2*dot*axis[1]-p.b[1])/Math.max(span,1e-30);en+=p.w*d*d;if(p.boundary){bn+=p.w*d*d;bt+=p.w;}errors.push(d);}
 errors.sort((a,b)=>a-b);return{rms:Math.sqrt(en/Math.max(total,1e-30)),boundaryRms:Math.sqrt(bn/Math.max(bt,1e-30)),p95:errors[Math.floor((errors.length-1)*.95)]??0,max:errors.at(-1)??0,axis,center,span};
}
export function symmetrySatisfied(a:UVReflectionAudit){return a.rms<=.012&&a.boundaryRms<=.015&&a.p95<=.03&&a.max<=.065;}
export function relaxSurfaceSymmetry(mesh:CutMesh,input:Vec2[],reflection:SurfaceReflection,iterations=40,strength=30,work?:UVWork):{uv:Vec2[];report:UVSymmetryReport;residual:number}{
 if(!Number.isInteger(iterations)||iterations<1||iterations>100||!Number.isFinite(strength)||strength<1||strength>200)throw Error('Invalid surface symmetry relaxation controls.');
 const before=auditUVReflection(mesh,input,reflection.pairs),report:UVSymmetryReport={status:'already-symmetric',surface:reflectionSummary(reflection),before,after:before,iterations:0};
 if(before.rms<.0015&&before.boundaryRms<.002&&before.max<.01)return{uv:input,report,residual:0};
 const {axis,center}=before,seed=input.map(p=>{const x=p[0]-center[0],y=p[1]-center[1];return[x*axis[0]+y*axis[1],-x*axis[1]+y*axis[0]] as Vec2;});
 const terms:LinearShapeConstraint[]=[];
 for(const p of reflection.pairs)for(const a of[0,1] as const){
   const coeff=new Map<number,number>();for(const [binding,sign]of[[p.a,1],[p.b,a===0?1:-1]] as const)mesh.triangles[binding.face]!.forEach((v,k)=>coeff.set(v,(coeff.get(v)??0)+sign*binding.weights[k]!));
   const entries=[...coeff].filter(([,w])=>Math.abs(w)>1e-14);if(!entries.length)continue;
   const confidence=Math.max(.05,1-(p.distance/.018)**2);
   terms.push({axis:a,ids:entries.map(e=>e[0]),coefficients:entries.map(e=>e[1]),target:0,weight:strength*p.weight*(p.boundary?4:1)*confidence});
 }
 const r=freeBoundaryARAP(mesh,seed,iterations,600,work,{linearConstraints:terms});
 const after=auditUVReflection(mesh,r.uv,reflection.pairs),q=checkUVTriangles(mesh.triangles.map(t=>t.map(v=>r.uv[v]!) as [Vec2,Vec2,Vec2]),100,work);
 const valid=q.valid&&simpleUVBoundary(r.uv,mesh.boundaries,work)&&r.maxAnisotropy<=100&&symmetrySatisfied(after)&&(after.rms<=before.rms+1e-5);
 report.after=after;report.iterations=r.accepted;report.status=valid?'constrained':'rejected';
 if(!valid){report.attempted=after;report.after=before;report.reason='Surface symmetry solve did not satisfy the combined reflection, injectivity and distortion contract; original valid candidate retained and explicitly flagged.';return{uv:input,report,residual:r.residual};}
 return{uv:r.uv,report,residual:r.residual};
}
