import {buildTopology,edgeKey,type MeshData,type Vec3,type MeshTopology} from '@meshtailor/mesh-core';
import {buildCharts} from './charts.js';
import type {UVWork} from './work.js';

export interface PeelOptions {peelSourceHints?:boolean;peelOrientationPanels?:boolean;peelPanelArea?:number;peelFeatureArea?:number;peelMaxDepth?:number}
export interface PeelGroup {id:number;faces:number[];area3D:number;kind:'planar-feature'|'surface'|'oriented-panel';charts:number[]}
export interface PeelReport {version:1;groups:PeelGroup[];groupSeams:string[];events:{group:number;faces:number;depth:number;action:string;detail:string}[];sourceHintCharts:number;feedbackSplits:number;totalIslands:number;note:string}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function faceFrame(mesh:MeshData,fi:number){const f=mesh.faces[fi]!,[a,b,c]=f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3],n=cross(sub(b,a),sub(c,a)),l=Math.hypot(...n);return{normal:n.map(x=>x/Math.max(l,1e-30)) as Vec3,area:l/2,center:a.map((x,k)=>(x+b[k]!+c[k]!)/3) as Vec3};}

/** Coarse spatial groups precede any UV solving. Connected geometry is the
 * starting point; substantial continuous planar features and balanced opposing
 * panels of LARGE wrapping surfaces are separated.
 * Small components are NOT divided according to triangle count or local normals.
 * This is geometric grouping, not a semantic body-part classifier. */
export function planSurfaceGroups(mesh:MeshData,cuts:ReadonlySet<string>,options:PeelOptions={},work?:UVWork):{report:PeelReport;seams:Set<string>;topology:MeshTopology}{
  const fraction=options.peelFeatureArea??.015,panelFraction=options.peelPanelArea??.04;
  if(!Number.isFinite(panelFraction)||panelFraction<.01||panelFraction>.5)throw Error('peelPanelArea must be 0.01..0.5');
  if(options.peelOrientationPanels!==undefined&&typeof options.peelOrientationPanels!=='boolean')throw Error('peelOrientationPanels must be boolean');
  if(!Number.isFinite(fraction)||fraction<.001||fraction>.25)throw Error('peelFeatureArea must be 0.001..0.25');
  const topology=buildTopology(mesh),frames=mesh.faces.map((_,i)=>faceFrame(mesh,i)),total=frames.reduce((s,f)=>s+f.area,0),components=buildCharts(mesh,new Set(cuts),topology);
  const planes=new Int32Array(mesh.faces.length).fill(-1),visited=new Uint8Array(mesh.faces.length);let planeCount=0;
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];for(const p of mesh.positions)for(let k=0;k<3;k++){low[k]=Math.min(low[k]!,p[k]!);high[k]=Math.max(high[k]!,p[k]!);}
  const tolerance=Math.max(...high.map((x,i)=>x-low[i]!))*1e-5;
  const adj:number[][]=Array.from({length:mesh.faces.length},()=>[]);
  for(const [key,e]of topology.edges)if(e.faces.length===2&&!cuts.has(key)){const[a,b]=e.faces;adj[a!]!.push(b!);adj[b!]!.push(a!);}
  for(const comp of components){work?.check();const ca=comp.faces.reduce((s,f)=>s+frames[f]!.area,0);if(ca<total*fraction*2)continue;
    for(const root of comp.faces){if(visited[root])continue;const n=frames[root]!.normal,d=dot(n,frames[root]!.center),q=[root];visited[root]=1;let area=0;
      for(let h=0;h<q.length;h++){const i=q[h]!;area+=frames[i]!.area;if((h&511)===0)work?.check();for(const j of adj[i]!)if(!visited[j]&&dot(n,frames[j]!.normal)>1-1e-8&&mesh.faces[j]!.vertices.every(v=>Math.abs(dot(n,mesh.positions[v]!)-d)<tolerance)){visited[j]=1;q.push(j);}}
      if(area>=Math.max(total*fraction,ca*.06)&&q.length>=4&&q.length<comp.faces.length){for(const fi of q)planes[fi]=planeCount;planeCount++;}
    }
  }
  const seams=new Set(cuts);
  for(const [key,e]of topology.edges)if(e.faces.length===2&&planes[e.faces[0]!]!==planes[e.faces[1]!]&&(planes[e.faces[0]!]!>=0||planes[e.faces[1]!]!>=0))seams.add(key);
  // Coarse opposing-view panels on LARGE wrapping surfaces. One balanced
  // bisection per region, never recursive normal cones on tiny accessories.
  const oriented=new Uint8Array(mesh.faces.length);
  if(options.peelOrientationPanels!==false)for(const group of buildCharts(mesh,seams,topology)){
    const area=group.faces.reduce((s,f)=>s+frames[f]!.area,0);
    if(area<total*panelFraction||group.faces.length<32||group.faces.every(f=>planes[f]!>=0))continue;
    const matrix=Array.from({length:3},()=>[0,0,0]);
    for(const f of group.faces){const n=frames[f]!.normal;for(let a=0;a<3;a++)for(let b=0;b<3;b++)matrix[a]![b]!+=n[a]!*n[b]!*frames[f]!.area/area;}
    let axis:Vec3=[1,0,0],best=-1;
    for(let seed=0;seed<3;seed++){let n=[0,0,0] as Vec3;n[seed]=1;for(let k=0;k<32;k++){const x=matrix.map(r=>dot(r as Vec3,n)) as Vec3,l=Math.hypot(...x);if(l<1e-12)break;n=x.map(v=>v/l) as Vec3;}
      const score=dot(n,matrix.map(r=>dot(r as Vec3,n)) as Vec3);if(score>best){best=score;axis=n;}}
    let pos=0,neg=0,a=group.faces[0]!,b=a,hi=-Infinity,lo=Infinity;
    for(const f of group.faces){const q=dot(frames[f]!.normal,axis);if(q>.25)pos+=frames[f]!.area;if(q<-.25)neg+=frames[f]!.area;if(q>hi){hi=q;a=f;}if(q<lo){lo=q;b=f;}}
    if(pos<area*.25||neg<area*.25||a===b)continue;
    const parts=bisectSurface(mesh,group.faces,seams,topology,work,[a,b]);
    if(parts.length!==2||parts.some(p=>p.length<16||p.reduce((s,f)=>s+frames[f]!.area,0)<area*.25))continue;
    const side=new Map(parts.flatMap((fs,i)=>fs.map(f=>[f,i] as [number,number])));
    for(const f of group.faces){oriented[f]=1;for(const g of adj[f]!)if(side.has(g)&&side.get(g)!==side.get(f)){const va=mesh.faces[f]!.vertices.filter(v=>mesh.faces[g]!.vertices.includes(v));if(va.length===2)seams.add(edgeKey(va[0]!,va[1]!));}}
  }
  const groups=buildCharts(mesh,seams,topology).map(c=>({id:c.id,faces:c.faces,area3D:c.faces.reduce((s,f)=>s+frames[f]!.area,0),kind:(c.faces.every(f=>planes[f]===planes[c.faces[0]!]&&planes[f]!>=0)?'planar-feature':c.faces.every(f=>oriented[f])?'oriented-panel':'surface') as PeelGroup['kind'],charts:[]}));
  const report:PeelReport={version:1,groups,groupSeams:[...seams],events:[],sourceHintCharts:0,feedbackSplits:0,totalIslands:0,note:'空间组与UV岛分别计数。先保留完整几何组/主要平面特征，大型环绕曲面至多分成两个相向面板，再在组内开缝、尝试投影种子和自由边界剥展；只有真实求解或形变失败才反馈细分。没有按模型名称选择算法。'};
  return{report,seams,topology};
}
class MinHeap{a:[number,number,number][]=[];push(v:number,d:number,l:number){const a=this.a;let i=a.length;a.push([v,d,l]);while(i){const p=(i-1)>>1;if(a[p]![1]<=d)break;a[i]=a[p]!;i=p;}a[i]=[v,d,l];}pop(){const a=this.a,r=a[0]!,x=a.pop()!;if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1]![1]<a[j]![1])j++;if(a[j]![1]>=x[1])break;a[i]=a[j]!;i=j;}a[i]=x;}return r;}}
/** Two connected geodesic catchments, NOT dozens of normal-cone regions.
 * Folded surfaces remain contiguous; high-curvature adjacencies cost more.
 * Existing cuts and group boundaries cannot be crossed. */
export function bisectSurface(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,topology:MeshTopology,work?:UVWork,seedFaces?:readonly [number,number]):number[][]{
  if(faces.length<2)return[[...faces]];
  const ids=new Map(faces.map((f,i)=>[f,i])),frames=faces.map(f=>faceFrame(mesh,f)),adj:{j:number;cost:number}[][]=faces.map(()=>[]);
  for(let i=0;i<faces.length;i++){
    const f=mesh.faces[faces[i]!]!;for(let k=0;k<3;k++){const key=edgeKey(f.vertices[k]!,f.vertices[(k+1)%3]!);if(cuts.has(key))continue;const e=topology.edges.get(key);if(e?.faces.length!==2)continue;
      for(const fi of e.faces){const j=ids.get(fi);if(j===undefined||j===i)continue;adj[i]!.push({j,cost:Math.max(1e-12,Math.hypot(...sub(frames[i]!.center,frames[j]!.center)))*(1+2*Math.max(0,1-dot(frames[i]!.normal,frames[j]!.normal)))});}
    }
  }
  const seen=new Uint8Array(faces.length),cc:number[][]=[];
  for(let root=0;root<faces.length;root++)if(!seen[root]){const q=[root];seen[root]=1;for(let h=0;h<q.length;h++)for(const e of adj[q[h]!]!)if(!seen[e.j]){seen[e.j]=1;q.push(e.j);}cc.push(q.map(i=>faces[i]!));}
  if(cc.length>1)return cc;
  const wave=(seeds:number[])=>{const distance=new Float64Array(faces.length).fill(Infinity),label=new Int32Array(faces.length).fill(-1),heap=new MinHeap();seeds.forEach((s,i)=>{distance[s]=0;label[s]=i;heap.push(s,0,i);});let last=seeds[0]!;
    while(heap.a.length){const[v,d,l]=heap.pop();if(d!==distance[v]||l!==label[v])continue;last=v;if((v&255)===0)work?.check();for(const e of adj[v]!)if(d+e.cost<distance[e.j]!){distance[e.j]=d+e.cost;label[e.j]=l;heap.push(e.j,d+e.cost,l);}}
    return{last,label};};
  const a=seedFaces?ids.get(seedFaces[0])!:wave([0]).last,b=seedFaces?ids.get(seedFaces[1])!:wave([a]).last,{label}=wave([a,b]);const out:number[][]=[[],[]];for(let i=0;i<faces.length;i++)out[label[i]!]!.push(faces[i]!);
  return out.filter(c=>c.length);
}

/** Repacking/filling changes UV placement, not the geometric group identity. */
export function carryPeelReport(previous:PeelReport,charts:readonly {id:number;faceUVs:Map<number,unknown>}[]):PeelReport {
  const result=structuredClone(previous),owner=new Map<number,number>();for(const g of result.groups){g.charts=[];for(const f of g.faces)owner.set(f,g.id);}
  for(const c of charts){const ids=new Set([...c.faceUVs.keys()].map(f=>owner.get(f)));if(ids.size!==1||ids.has(undefined))throw Error('UV edit crossed or lost a protected spatial-group boundary.');result.groups.find(g=>g.id===[...ids][0])!.charts.push(c.id);}
  result.totalIslands=charts.length;return result;
}
