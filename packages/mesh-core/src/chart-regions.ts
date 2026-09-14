import { buildTopology } from './topology.js';
import { dot3, triangleNormal } from './math.js';
import type { MeshData, Vec3, MeshTopology } from './types.js';

export type ChartGoal = 'large' | 'balanced';
export interface RegionOptions {
  /** Angular spread from the seed, not a hard-edge seam threshold. */
  normalConeDegrees: number;
  maxChartFaces: number;
  minRegionFaces: number;
  minRegionAreaRatio: number;
}
export interface MeshAnalysis {
  faces: number; components: number; boundaryEdges: number; nonManifoldEdges: number;
  dihedral75: number; dihedral95: number;
}
export interface RegionResult {
  regions: number[][]; seamEdges: Set<string>; mergedRegions: number;
}
/** Recommendations depend on mesh scale-free topology/dihedrals, never asset names.
 * Face cap is a COMPUTE budget. Area and normals drive the geometric decisions. */
export function recommendRegions(mesh: MeshData, goal: ChartGoal = 'large'): {options:RegionOptions; analysis:MeshAnalysis} {
  const t=buildTopology(mesh),normals=mesh.faces.map(f=>triangleNormal(...f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3]));
  const adj:number[][]=Array.from({length:mesh.faces.length},()=>[]),angles:number[]=[];
  let boundaryEdges=0,nonManifoldEdges=0;
  for(const e of t.edges.values()){
    if(e.faces.length===1)boundaryEdges++;
    if(e.faces.length>2)nonManifoldEdges++;
    if(e.faces.length===2){const [a,b]=e.faces as [number,number];adj[a]!.push(b);adj[b]!.push(a);angles.push(Math.acos(Math.max(-1,Math.min(1,dot3(normals[a]!,normals[b]!))))*180/Math.PI);}
  }
  let components=0;const seen=new Uint8Array(mesh.faces.length);
  for(let i=0;i<seen.length;i++)if(!seen[i]){components++;seen[i]=1;const q=[i];for(let h=0;h<q.length;h++)for(const j of adj[q[h]!]!)if(!seen[j]){seen[j]=1;q.push(j);}}
  angles.sort((a,b)=>a-b);const at=(p:number)=>angles[Math.min(angles.length-1,Math.floor((angles.length-1)*p))]??0;
  const faces=mesh.faces.length,large=goal==='large';
  return {analysis:{faces,components,boundaryEdges,nonManifoldEdges,dihedral75:at(.75),dihedral95:at(.95)},options:{
    normalConeDegrees:(large?80:65)+Math.min(10,at(.75)*.15),
    maxChartFaces:Math.min(20000,Math.max(large?4096:2048,Math.ceil(Math.sqrt(Math.max(1,faces))*(large?96:48)/128)*128)),
    minRegionFaces:Math.max(8,Math.min(large?96:32,Math.ceil(Math.sqrt(faces)/2))),
    minRegionAreaRatio:large?.01:.0025,
  }};
}
interface Region {faces:number[];area:number;normal:Vec3;componentArea:number;adj:Map<number,number>;alive:boolean}
/** Connected normal-cone regions, followed by area-aware merging of small neighbors.
 * UV seams supplied as protectedEdges are never removed. No welding, decimation,
 * semantic part recognition or promised global optimum is performed here. */
export function segmentMeshRegions(mesh:MeshData,options:RegionOptions,protectedEdges:ReadonlySet<string>=new Set(),allowedFaces?:readonly number[],check:()=>void=()=>{},topology?:MeshTopology):RegionResult {
  const o=options;
  if(!Number.isFinite(o.normalConeDegrees)||o.normalConeDegrees<1||o.normalConeDegrees>=179||!Number.isInteger(o.maxChartFaces)||o.maxChartFaces<1||!Number.isInteger(o.minRegionFaces)||o.minRegionFaces<0||!Number.isFinite(o.minRegionAreaRatio)||o.minRegionAreaRatio<0||o.minRegionAreaRatio>1)throw new Error('Invalid connected-region settings.');
  const t=topology??buildTopology(mesh),n=mesh.faces.length,allowed=new Uint8Array(n);
  for(const fi of allowedFaces??mesh.faces.map((_,i)=>i)){if(!Number.isInteger(fi)||fi<0||fi>=n)throw new Error('Invalid region face.');allowed[fi]=1;}
  const normals:Vec3[]=Array(n),area=new Float64Array(n),adj:number[][]=Array.from({length:n},()=>[]),label=new Int32Array(n).fill(-1);
  for(let i=0;i<n;i++)if(allowed[i]){
    if(i%512===0)check();const f=mesh.faces[i]!,[a,b,c]=f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3];
    normals[i]=triangleNormal(a,b,c);const u=b.map((v,j)=>v-a[j]!),v=c.map((x,j)=>x-a[j]!);
    area[i]=Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!)*.5;
  }
  for(const [key,e]of t.edges){if(e.faces.length!==2||protectedEdges.has(key))continue;const [a,b]=e.faces as [number,number];if(!allowed[a]||!allowed[b])continue;
    const forward=(fi:number)=>{const v=mesh.faces[fi]!.vertices;return v.some((x,i)=>x===e.a&&v[(i+1)%3]===e.b);};
    if(forward(a)===forward(b))continue;adj[a]!.push(b);adj[b]!.push(a);
  }
  const compArea=new Float64Array(n),visited=new Uint8Array(n);
  for(let i=0;i<n;i++)if(allowed[i]&&!visited[i]){let total=0;const queue=[i];visited[i]=1;for(let h=0;h<queue.length;h++){const fi=queue[h]!;total+=area[fi]!;for(const j of adj[fi]!)if(!visited[j]){visited[j]=1;queue.push(j);}}for(const fi of queue)compArea[fi]=total;}
  // Quantized, scale-relative tie breaks prevent float roundoff / normalization
  // from changing the seed of equal-area triangulations.
  let maxArea=0;for(const a of area)maxArea=Math.max(maxArea,a);
  const areaKey=(fi:number)=>Math.round(area[fi]!/Math.max(1e-30,maxArea)*1e10);
  const seeds=[...allowed.keys()].filter(i=>allowed[i]).sort((a,b)=>areaKey(b)-areaKey(a)||a-b),cos=Math.cos(o.normalConeDegrees*Math.PI/180),regions:Region[]=[];
  const queued=new Int32Array(n).fill(-1);
  for(const seed of seeds){if(label[seed]>=0)continue;check();const id=regions.length,r:Region={faces:[],area:0,normal:[0,0,0],componentArea:compArea[seed]!,adj:new Map(),alive:true},queue=[seed];queued[seed]=id;
    for(let h=0;h<queue.length&&r.faces.length<o.maxChartFaces;h++){
      const fi=queue[h]!;if(label[fi]>=0||Math.round(dot3(normals[seed]!,normals[fi]!)*1e10)/1e10<cos-1e-10)continue;
      label[fi]=id;r.faces.push(fi);r.area+=area[fi]!;for(let a=0;a<3;a++)r.normal[a]+=normals[fi]![a]!*area[fi]!;
      for(const j of adj[fi]!)if(label[j]<0&&queued[j]!==id){queue.push(j);queued[j]=id;}
    }
    if(!r.faces.length)throw new Error('Region growth did not accept its seed.');regions.push(r);
  }
  // Adjacency only across admissible shared edges; coincident/vertex-only parts
  // and imported protected seams are never bridged by the merging pass.
  for(let fi=0;fi<n;fi++)if(allowed[fi])for(const fj of adj[fi]!){if(fj<=fi||label[fi]===label[fj])continue;const a=label[fi]!,b=label[fj]!;
    const shared=mesh.faces[fi]!.vertices.filter(v=>mesh.faces[fj]!.vertices.includes(v)),p=mesh.positions[shared[0]!]!,q=mesh.positions[shared[1]!]!,length=Math.hypot(...p.map((v,i)=>v-q[i]!));
    regions[a]!.adj.set(b,(regions[a]!.adj.get(b)??0)+length);regions[b]!.adj.set(a,(regions[b]!.adj.get(a)??0)+length);
  }
  let mergedRegions=0;
  for(let pass=0;pass<3;pass++){
    let changed=false;const small=regions.map((r,i)=>({r,i})).filter(({r})=>r.alive).sort((a,b)=>Math.round(a.r.area/Math.max(1e-30,a.r.componentArea)*1e10)-Math.round(b.r.area/Math.max(1e-30,b.r.componentArea)*1e10)||a.i-b.i);
    for(const {r,i}of small){if(!r.alive||r.faces.length>=o.minRegionFaces&&r.area>=r.componentArea*o.minRegionAreaRatio)continue;
      check();let best=-1,cost=Infinity;
      for(const [j,shared]of r.adj){const s=regions[j]!;if(!s.alive||s.faces.length+r.faces.length>o.maxChartFaces)continue;
        const d=dot3(r.normal,s.normal)/Math.max(1e-30,Math.hypot(...r.normal)*Math.hypot(...s.normal));
        // Prefer shared boundary length and normal coherence, not random edge rank.
        const v=(1-d*.65)/Math.max(shared,1e-30);if(best<0||v<cost-Math.abs(cost)*1e-10||Math.abs(v-cost)<=Math.abs(cost)*1e-10&&j<best){cost=v;best=j;}}
      if(best<0)continue;const s=regions[best]!;s.faces.push(...r.faces);s.area+=r.area;for(let a=0;a<3;a++)s.normal[a]+=r.normal[a]!;
      for(const fi of r.faces)label[fi]=best;
      s.adj.delete(i);for(const [j,length]of r.adj){if(j===best)continue;const other=regions[j]!;other.adj.delete(i);if(!other.alive)continue;s.adj.set(j,(s.adj.get(j)??0)+length);other.adj.set(best,(other.adj.get(best)??0)+length);}
      r.alive=false;r.adj.clear();changed=true;mergedRegions++;
    }
    if(!changed)break;
  }
  const seamEdges=new Set(protectedEdges);
  for(const [key,e]of t.edges)if(e.faces.length===2&&e.faces.every(fi=>allowed[fi])&&label[e.faces[0]!]!==label[e.faces[1]!])seamEdges.add(key);
  return {regions:regions.filter(r=>r.alive).map(r=>r.faces.sort((a,b)=>a-b)),seamEdges,mergedRegions};
}
