import type {MeshData} from '@meshtailor/mesh-core';
import {packAtlas,type RawChart,type AtlasPacking,type PackOptions} from './atlas-pack.js';
import {buildChartGraph,chartAffinity} from './chart-adjacency.js';
import {uvProgress,type UVWork} from './work.js';
export interface PageOptions {atlasPageMode?:'single'|'adjacency'|'components';atlasPageCount?:number}
export interface AtlasPage {id:number;charts:number[];faces:number;sourceMaterials:string[];occupancy:number;boxOccupancy:number;scale:number}
export interface PageReport {mode:'single'|'adjacency'|'components';requested:number;actual:number;geometryComponents:number;retainedSharedBoundaryRatio:number;pages:AtlasPage[]}
export interface PagedAtlas extends AtlasPacking {pageReport?:PageReport}
/** New-atlas page grouping: a maximum-affinity spanning forest. Strong shared
 * geometric boundaries stay on the same page preferentially. No UV proximity,
 * source-material enumeration, or welding is used to infer connectivity.
 * Page count is a SOFT target: disconnected components remain separate unless
 * the caller explicitly selects single-page packing. */
export function packConnectedAtlas(mesh:MeshData,raw:RawChart[],opts:Partial<PackOptions>&PageOptions={},work?:UVWork):PagedAtlas {
  const mode=opts.atlasPageMode??'single',requested=opts.atlasPageCount??2;
  if(!['single','adjacency','components'].includes(mode)||!Number.isInteger(requested)||requested<1||requested>64)throw new Error('Atlas pages: choose single/adjacency/components and a page target of 1..64.');
  if(mode==='single')return packAtlas(raw,opts,work);
  const graph=buildChartGraph(mesh,raw.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})),undefined,work),parent=new Map(raw.map(c=>[c.id,c.id]));
  const root=(i:number):number=>{let r=i;while(parent.get(r)!==r)r=parent.get(r)!;while(parent.get(i)!==i){const n=parent.get(i)!;parent.set(i,r);i=n;}return r;};
  let remaining=raw.length;
  const links=[...graph.links].sort((a,b)=>chartAffinity(b,graph.boundaries)-chartAffinity(a,graph.boundaries)||b.length-a.length||a.a-b.a||a.b-b.b);
  // Compute the actual connected lower bound independently of requested page count.
  for(const l of links){const a=root(l.a),b=root(l.b);if(a!==b){parent.set(b,a);remaining--;}}
  const components=remaining;for(const c of raw)parent.set(c.id,c.id);remaining=raw.length;
  const target=mode==='components'?components:Math.max(components,Math.min(raw.length,requested));
  if(target>64)throw new Error(`输入岛图有 ${components} 个几何连通组，需要 ${target} 页，超过 64 页显示预算。请选择单页；不会静默把不相连组件视为相连。`);
  for(const l of links){work?.check();if(remaining<=target)break;const a=root(l.a),b=root(l.b);if(a!==b){parent.set(b,a);remaining--;}}
  const groups=new Map<number,RawChart[]>();for(const c of raw){const r=root(c.id),list=groups.get(r)??[];list.push(c);groups.set(r,list);}
  const ordered=[...groups.values()].sort((a,b)=>Math.min(...a.map(c=>c.id))-Math.min(...b.map(c=>c.id)));
  const packs=ordered.map((cs,i)=>{uvProgress(work,{stage:'pack',detail:`按连接关系排布 UV 页 ${i+1}/${ordered.length}`});return packAtlas(cs,opts,work);});
  const commonScale=Math.min(...packs.map(p=>p.scale));
  // Repack at the SAME density, preserving the per-side UV gutter. Scaling each
  // completed page afterward would shrink the gutters, so do not do that.
  const equal=packs.map((p,i)=>p.scale===commonScale?p:packAtlas(ordered[i]!,{...opts,fixedScale:commonScale},work));
  const cols=Math.ceil(Math.sqrt(equal.length));
  const packed=equal.flatMap((p,i)=>p.packed.map(c=>({...c,atlasPage:i,uvSpace:`atlas-page-${i+1}`,uvSpaceName:`UV 页 ${i+1}`,displayOffset:[(i%cols)*1.15,Math.floor(i/cols)*1.15] as [number,number]})));
  let shared=0,retained=0;for(const l of graph.links){shared+=l.length;if(root(l.a)===root(l.b))retained+=l.length;}
  const pages=equal.map((p,i)=>({id:i,charts:ordered[i]!.map(c=>c.id),faces:ordered[i]!.reduce((s,c)=>s+c.faceUVs.size,0),sourceMaterials:[...new Set(ordered[i]!.flatMap(c=>[...c.faceUVs.keys()].map(fi=>mesh.faces[fi]!.uvSpace??'default')))],occupancy:p.occupancy,boxOccupancy:p.boxOccupancy,scale:p.scale}));
  return {packed,occupancy:equal.reduce((s,p)=>s+p.occupancy,0)/equal.length,boxOccupancy:equal.reduce((s,p)=>s+p.boxOccupancy,0)/equal.length,scale:commonScale,padding:equal[0]!.padding,packingMethod:equal.some(p=>p.packingMethod==='shelf')?'shelf':'maxrects',pageReport:{mode,requested,actual:pages.length,geometryComponents:components,retainedSharedBoundaryRatio:shared?retained/shared:1,pages}};
}
