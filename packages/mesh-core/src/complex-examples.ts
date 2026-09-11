import type { MeshData, MeshFace, Vec2, Vec3 } from './types.js';

export type ComplexExampleId = 'knot' | 'garment' | 'gear' | 'assembly';
export type MeshDetail = 'low' | 'medium' | 'high';
const factors: Record<MeshDetail, number> = { low: 1, medium: 2, high: 4 };
const add = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v + b[i]!) as Vec3;
const mul = (a: Vec3, s: number): Vec3 => a.map(v => v * s) as Vec3;
const dot = (a: Vec3, b: Vec3) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const unit = (p: Vec3): Vec3 => mul(p, 1 / Math.hypot(...p));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Wrapped grids share GEOMETRY vertices, but have separate face-corner UVs at u/v=1. */
function parametric(name: string, rows: number, cols: number, wrapRows: boolean, point: (u: number, v: number) => Vec3): MeshData {
  const positions: Vec3[] = [], faces: MeshFace[] = [];
  const height = wrapRows ? rows : rows + 1;
  for (let r=0;r<height;r++) for (let c=0;c<cols;c++) positions.push(point(r/rows,c/cols));
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) {
    const nr=(r+1)%height,nc=(c+1)%cols;
    const a=r*cols+c,b=nr*cols+c,d=r*cols+nc,e=nr*cols+nc;
    const ua:Vec2=[c/cols,r/rows],ub:Vec2=[c/cols,(r+1)/rows],ud:Vec2=[(c+1)/cols,r/rows],ue:Vec2=[(c+1)/cols,(r+1)/rows];
    faces.push({vertices:[a,b,e],uvs:[ua,ub,ue]},{vertices:[a,e,d],uvs:[ua,ue,ud]});
  }
  return { name, positions, faces };
}

export function makeTorusKnot(detail: MeshDetail = 'medium'): MeshData {
  const f=factors[detail];
  return parametric('Trefoil knot / 三叶结',96*f,12*f,true,(u,v)=>{
    const t=2*Math.PI*u,a=2*t,b=3*t,r=1.5+.42*Math.cos(b);
    const center:Vec3=[r*Math.cos(a),.42*Math.sin(b),r*Math.sin(a)];
    const dr=-1.26*Math.sin(b);
    const tangent=unit([dr*Math.cos(a)-2*r*Math.sin(a),1.26*Math.cos(b),dr*Math.sin(a)+2*r*Math.cos(a)]);
    const radial:Vec3=[Math.cos(a),0,Math.sin(a)];
    const normal=unit(add(radial,mul(tangent,-dot(tangent,radial))));
    const binormal=unit(cross(tangent,normal)),phi=2*Math.PI*v;
    return add(center,add(mul(normal,.16*Math.cos(phi)),mul(binormal,.16*Math.sin(phi))));
  });
}

export function makePleatedGarment(detail: MeshDetail = 'medium'): MeshData {
  const f=factors[detail];
  return parametric('Pleated garment / 褶皱裙摆',32*f,48*f,false,(u,v)=>{
    const angle=2*Math.PI*v;
    const flare=.48+.7*u*u+.17*Math.sin(Math.PI*u);
    const fold=(.025+.12*u*u)*Math.cos(12*angle+u*.5)+.018*Math.sin(24*angle-3*u);
    const radius=flare+fold;
    return [radius*Math.cos(angle),1.35-2.7*u+.045*u**4*Math.cos(12*angle),radius*.8*Math.sin(angle)];
  });
}

export function makeGearHousing(detail: MeshDetail = 'medium'): MeshData {
  const f=factors[detail];
  // Rectangular annular cross-section with chamfered corners, periodic in both axes.
  const profile: [number,number][] = [[.45,-.1],[.5,-.16],[1.24,-.16],[1.3,-.1],[1.3,.1],[1.24,.16],[.5,.16],[.45,.1]];
  return parametric('Beveled gear / 倒角齿轮',8*f,96*f,true,(u,v)=>{
    const s=u*8,i=Math.floor(s)%8,k=s-Math.floor(s),p=profile[i]!,q=profile[(i+1)%8]!;
    const r=p[0]*(1-k)+q[0]*k,y=p[1]*(1-k)+q[1]*k,a=v*2*Math.PI;
    const teeth=Math.max(0,Math.cos(24*a))**2*.19*Math.max(0,(r-.6)/.7);
    return [(r+teeth)*Math.cos(a),y,(r+teeth)*Math.sin(a)];
  });
}

export function makeMultiPartAssembly(detail: MeshDetail = 'medium'): MeshData {
  const result:MeshData={name:'Mechanical assembly / 多部件机械件',positions:[],faces:[]};
  const append=(mesh:MeshData,scale:Vec3,offset:Vec3)=>{
    const base=result.positions.length;
    for(const p of mesh.positions) result.positions.push(p.map((v,i)=>v*scale[i]!+offset[i]!) as Vec3);
    for(const face of mesh.faces) result.faces.push({...face,vertices:face.vertices.map(v=>v+base) as MeshFace['vertices']});
  };
  append(makeGearHousing(detail),[1,1,1],[0,0,0]);
  append(makeGearHousing(detail),[.72,1,.72],[2.13,.1,0]);
  append(makeGearHousing(detail),[.48,1,.48],[-1.83,-.08,0]);
  const shaft=parametric('shaft',16*factors[detail],32*factors[detail],true,(u,v)=>{
    const a=u*2*Math.PI,b=v*2*Math.PI,r=.27+.09*Math.cos(a);
    return [r*Math.cos(b),.8*Math.sin(a),r*Math.sin(b)];
  });
  append(shaft,[1,1,1],[0,0,0]);
  return result;
}

export const COMPLEX_EXAMPLES = [
  { id:'knot' as const, label:'三叶结 · Trefoil', description:'闭合曲面、非平凡环路与遮挡' },
  { id:'garment' as const, label:'褶皱服装 · Garment', description:'开放边界、连续褶皱与已有 UV' },
  { id:'gear' as const, label:'倒角齿轮 · Gear', description:'内孔、齿形与硬表面' },
  { id:'assembly' as const, label:'机械组合 · Assembly', description:'多个不连通部件、孔洞与尺度差异' },
];
export function makeComplexExample(id: ComplexExampleId, detail: MeshDetail = 'medium'): MeshData {
  if (!(detail in factors)) throw new Error('Unknown mesh detail.');
  switch(id) { case 'knot':return makeTorusKnot(detail);case 'garment':return makePleatedGarment(detail);case 'gear':return makeGearHousing(detail);case 'assembly':return makeMultiPartAssembly(detail);default:throw new Error('Unknown complex example.'); }
}
