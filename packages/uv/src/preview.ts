import type { MeshData, Vec2, Vec3 } from '@meshtailor/mesh-core';
import type { UVChart } from './charts.js';

export interface PackedChart {
  /** Display-only domain offset. Stored/exported faceUVs are always unchanged. */
  displayOffset?:Vec2; uvSpace?:string; uvSpaceName?:string;
  id:number; polygon:Vec2[]; faceUVs:Map<number,[Vec2,Vec2,Vec2]>; bounds:[number,number,number,number] }

function dominantProjection(points:Vec3[]):0|1|2{
  let min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(const p of points) for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]!);max[i]=Math.max(max[i],p[i]!);}
  const spans=[max[0]-min[0],max[1]-min[1],max[2]-min[2]];
  // Drop the smallest axis to preserve the two dimensions with greatest spread.
  return spans.indexOf(Math.min(...spans)) as 0|1|2;
}
function proj(p:Vec3,drop:0|1|2):Vec2{ return drop===0?[p[1],p[2]]:drop===1?[p[0],p[2]]:[p[0],p[1]]; }

/** Fast deterministic chart preview, not ABF++. It is intentionally isolated behind the UV package. */
export function planarPackPreview(mesh:MeshData,charts:UVChart[]):PackedChart[]{
  const raw=charts.map((chart)=>{
    const drop=dominantProjection(chart.vertices.map((v)=>mesh.positions[v]!));
    const coords=new Map<number,Vec2>(); for(const v of chart.vertices) coords.set(v,proj(mesh.positions[v]!,drop));
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const p of coords.values()){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
    const w=Math.max(1e-6,maxX-minX),h=Math.max(1e-6,maxY-minY);
    const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
    for(const fi of chart.faces){const f=mesh.faces[fi]!;faceUVs.set(fi,f.vertices.map((v)=>{const q=coords.get(v)!;return [(q[0]-minX)/w,(q[1]-minY)/h] as Vec2;}) as [Vec2,Vec2,Vec2]);}
    return {chart,faceUVs,aspect:w/h};
  });
  // Shelf pack normalized chart boxes.
  const cols=Math.max(1,Math.ceil(Math.sqrt(raw.length))); const cell=1/cols; const pad=cell*0.08;
  return raw.map((r,i)=>{
    const cx=i%cols,cy=Math.floor(i/cols); const x0=cx*cell+pad,y0=cy*cell+pad; const size=cell-2*pad;
    const sx=r.aspect>=1?size:size*r.aspect, sy=r.aspect>=1?size/r.aspect:size;
    const tx=x0+(size-sx)/2,ty=y0+(size-sy)/2;
    const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
    for(const [fi,uvs] of r.faceUVs) faceUVs.set(fi,uvs.map((p)=>[tx+p[0]*sx,ty+p[1]*sy] as Vec2) as [Vec2,Vec2,Vec2]);
    return {id:r.chart.id,faceUVs,bounds:[tx,ty,tx+sx,ty+sy],polygon:[[tx,ty],[tx+sx,ty],[tx+sx,ty+sy],[tx,ty+sy]] as Vec2[]};
  });
}

export function displayUV(chart:PackedChart,uv:Vec2):Vec2 {
  return [uv[0]+(chart.displayOffset?.[0]??0),uv[1]+(chart.displayOffset?.[1]??0)];
}
