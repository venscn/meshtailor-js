import type {MeshData,Vec2,Vec3} from '@meshtailor/mesh-core';
import type {RawChart} from './atlas-pack.js';
/** Compare each old chart to the corresponding NEW UV subregion, removing its
 * global similarity scale. 1 means its edge proportions are unchanged. Weight
 * by 3D area so tessellation density does not dominate the result. This is a
 * geometric guard, NOT semantic recognition or a sewing-pattern certificate. */
export function uvShapeChange(mesh:MeshData,chart:RawChart,next:Map<number,[Vec2,Vec2,Vec2]>):number{
  const area=(v:[Vec2,Vec2,Vec2])=>Math.abs((v[1][0]-v[0][0])*(v[2][1]-v[0][1])-(v[1][1]-v[0][1])*(v[2][0]-v[0][0]))/2;
  let oldArea=0,newArea=0,totalWeight=0;const samples:{ratio:number;weight:number}[]=[];
  for(const [fi,old] of chart.faceUVs){const neo=next.get(fi);if(!neo)return Infinity;oldArea+=area(old);newArea+=area(neo);}
  if(!(oldArea>0&&newArea>0))return Infinity;const scale=Math.sqrt(newArea/oldArea);
  for(const [fi,old] of chart.faceUVs){const neo=next.get(fi)!,t=mesh.faces[fi]!.vertices,[a,b,c]=t.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3];
    const u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!),weight=Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!)/6;
    for(let k=0;k<3;k++){const j=(k+1)%3,l=Math.hypot(old[k]![0]-old[j]![0],old[k]![1]-old[j]![1]),m=Math.hypot(neo[k]![0]-neo[j]![0],neo[k]![1]-neo[j]![1]);if(!(l>0&&m>0))return Infinity;const r=m/l/scale;samples.push({ratio:Math.max(r,1/r),weight});totalWeight+=weight;}
  }
  samples.sort((a,b)=>a.ratio-b.ratio);let sum=0;for(const s of samples){sum+=s.weight;if(sum>=totalWeight*.99)return s.ratio;}return samples.at(-1)?.ratio??1;
}
