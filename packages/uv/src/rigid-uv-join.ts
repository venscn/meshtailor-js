import {buildTopology,type MeshData,type MeshTopology,type Vec2} from '@meshtailor/mesh-core';
import type {RawChart} from './atlas-pack.js';
import {cutLocalMesh} from './cut-topology.js';
import {checkUVTriangles} from './uv-quality.js';
import {shapeQuality} from './chart-quality.js';
import type {UnwrapOptions} from './unwrap.js';
import type {UVWork} from './work.js';
/** Manual-style UV stitching, but transactional: align an existing chart with
 * a similarity transform along a real common edge; retain unmatched slits.
 * Uniform area-density discrepancy is capped before gluing. Reject all folds,
 * overlap, inconsistent shared UV vertices and excessive inherited distortion.
 * This preserves valid local shapes rather than forcing a fresh circular map.
 */
export function tryRigidUVJoin(mesh:MeshData,A:RawChart,B:RawChart,inputSeams:ReadonlySet<string>,edges:readonly string[],opts:UnwrapOptions,work?:UVWork,topology?:MeshTopology){
  const t=topology??buildTopology(mesh),limit=opts.mergeOptions?.maxJoinAreaRatio??1.25;
  const density=(c:RawChart)=>{let a=0;for(const [p,q,r]of c.faceUVs.values())a+=Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))/2;return Math.sqrt(c.area3D/a);};
  const sa=density(A),sb=density(B);if(!Number.isFinite(sa)||!Number.isFinite(sb))return null;
  const edgeUV=(chart:RawChart,e:string)=>{const edge=t.edges.get(e);if(!edge)return null;for(const fi of edge.faces){const uv=chart.faceUVs.get(fi);if(uv){const f=mesh.faces[fi]!.vertices;return [uv[f.indexOf(edge.a)]!,uv[f.indexOf(edge.b)]!] as [Vec2,Vec2];}}return null;};
  const candidates=[...edges].sort((a,b)=>{const len=(k:string)=>{const e=t.edges.get(k)!;return Math.hypot(...mesh.positions[e.a]!.map((x,i)=>x-mesh.positions[e.b]![i]!));};return len(b)-len(a);}).slice(0,6);
  const faces=[...A.faceUVs.keys(),...B.faceUVs.keys()].sort((a,b)=>a-b);
  for(const edge of candidates){work?.check();const a=edgeUV(A,edge),b=edgeUV(B,edge);if(!a||!b)continue;
    const p=a[0].map(x=>x*sa) as Vec2,q=a[1].map(x=>x*sa) as Vec2,r=b[0].map(x=>x*sb) as Vec2,s=b[1].map(x=>x*sb) as Vec2;
    const ax=q[0]-p[0],ay=q[1]-p[1],bx=s[0]-r[0],by=s[1]-r[1],den=bx*bx+by*by;if(!(den>1e-25))continue;
    const x=(ax*bx+ay*by)/den,y=(ay*bx-ax*by)/den,scale2=x*x+y*y;
    if(!Number.isFinite(scale2)||scale2>limit||scale2<1/limit)continue;
    const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
    for(const [fi,vs]of A.faceUVs)faceUVs.set(fi,vs.map(v=>[v[0]*sa,v[1]*sa] as Vec2) as [Vec2,Vec2,Vec2]);
    for(const [fi,vs]of B.faceUVs)faceUVs.set(fi,vs.map(v=>{const dx=v[0]*sb-r[0],dy=v[1]*sb-r[1];return[p[0]+x*dx-y*dy,p[1]+y*dx+x*dy] as Vec2;}) as [Vec2,Vec2,Vec2]);
    const joined:RawChart={id:A.id,faceUVs,area3D:A.area3D+B.area3D};
    const get=(c:RawChart,e:string):[Vec2,Vec2]|null=>{const ed=t.edges.get(e)!;for(const fi of ed.faces)if(c.faceUVs.has(fi)){const vs=mesh.faces[fi]!.vertices,uv=faceUVs.get(fi)!;return[uv[vs.indexOf(ed.a)]!,uv[vs.indexOf(ed.b)]!];}return null;};
    // Coordinate coincidence is only tested on already established shared edges.
    const tol=Math.max(1e-12,Math.sqrt(joined.area3D)*1e-8),seams=new Set(inputSeams);let removed=0;
    for(const e of edges){const u=get(A,e),v=get(B,e);if(u&&v&&u.every((p,k)=>Math.hypot(p[0]-v[k]![0],p[1]-v[k]![1])<=tol)){seams.delete(e);removed++;}}
    if(!removed)continue;const local=cutLocalMesh(mesh,faces,seams);if(!local.disk)continue;
    const uv:Vec2[]=new Array(local.positions.length);let consistent=true;
    local.sourceFaces.forEach((fi,i)=>local.triangles[i]!.forEach((v,k)=>{const p=faceUVs.get(fi)![k]!;if(uv[v]&&Math.hypot(uv[v]![0]-p[0],uv[v]![1]-p[1])>tol)consistent=false;else if(!uv[v])uv[v]=[...p];}));
    if(!consistent)continue;
    // Snap only the accepted equal seam variables, then validate the actual output.
    local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
    const quality=checkUVTriangles([...faceUVs.values()],1,work);if(!quality.valid)continue;
    const shape=shapeQuality(local,uv,opts.stretchAreaPercentile??1,opts.maxStretch);
    if(shape.areaStretch>opts.maxStretch||shape.aspect>opts.maxAspect||shape.fill<opts.minFill)continue;
    return {local,seams,faceUVs,uv,quality,shape,method:'uv-similarity-stitch',iterations:0,residual:0,joinAreaRatio:Math.max(scale2,1/scale2)};
  }
  return null;
}
