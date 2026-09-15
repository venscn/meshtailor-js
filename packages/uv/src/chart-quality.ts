import type { MeshData, Vec2, Vec3 } from '@meshtailor/mesh-core';
import type { CutMesh } from './cut-topology.js';
import { triangleArea } from './parameterize.js';
import { signedArea2 } from './uv-quality.js';
import { areaDistortionBudget } from './distortion-budget.js';
export function normalizedMesh(mesh:MeshData):MeshData{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of mesh.positions)for(let a=0;a<3;a++){if(!Number.isFinite(p[a]))throw new Error('Nonfinite mesh coordinate.');min[a]=Math.min(min[a]!,p[a]!);max[a]=Math.max(max[a]!,p[a]!);}
  const span=Math.max(...max.map((v,i)=>v-min[i]!));if(!(span>0&&Number.isFinite(span)))throw new Error('Zero/invalid mesh extent.');
  return{...mesh,positions:mesh.positions.map(p=>p.map((v,i)=>(v-min[i]!)/span) as [number,number,number])};
}
export function shapeQuality(local:CutMesh,uv:Vec2[],percentile:number,limit:number){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,area=0,maxStretch=1;
  const distortion:{area:number;stretch:number}[]=[];
  for(const [x,y]of uv){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  for(const t of local.triangles){
    const [a,b,c]=t.map(v=>local.positions[v]!) as [Vec3,Vec3,Vec3],ab=b.map((x,i)=>x-a[i]!),ac=c.map((x,i)=>x-a[i]!),l=Math.hypot(...ab),x=ab.reduce((s,v,i)=>s+v*ac[i]!,0)/l,y=2*triangleArea(a,b,c)/l;
    const [A,B,C]=t.map(v=>uv[v]!) as [Vec2,Vec2,Vec2];area+=Math.abs(signedArea2(A,B,C))*.5;
    const j00=(B[0]-A[0])/l,j10=(B[1]-A[1])/l,j01=((C[0]-A[0])-j00*x)/y,j11=((C[1]-A[1])-j10*x)/y;
    const tr=j00*j00+j10*j10+j01*j01+j11*j11,det=(j00*j11-j01*j10)**2,hi=(tr+Math.sqrt(Math.max(0,tr*tr-4*det)))/2,lo=det/Math.max(hi,1e-30);
    const stretch=Math.sqrt(hi/Math.max(lo,1e-30));maxStretch=Math.max(maxStretch,stretch);distortion.push({area:triangleArea(a,b,c),stretch:Math.max(1,stretch)});
  }
  const w=maxX-minX,h=maxY-minY;return{aspect:Math.max(w/h,h/w),fill:area/(w*h),...areaDistortionBudget(distortion,percentile,limit)};
}
