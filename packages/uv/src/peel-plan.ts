import {findSheetFeatures} from './sheet-features.js';
import type {ProjectionFrame} from './projection-seeds.js';
import {regularizeBinaryPartition,auditPartitionBoundary,buildTopology,edgeKey,type MeshData,type Vec3,type MeshTopology} from '@meshtailor/mesh-core';
import {buildCharts} from './charts.js';
import type {UVWork} from './work.js';

export interface PeelOptions {peelSourceHints?:boolean;peelOrientationPanels?:boolean;peelPanelArea?:number;peelFeatureArea?:number;peelMaxDepth?:number;seamBandRings?:number;groupFeatureDegrees?:number}
export interface PeelGroup {id:number;faces:number[];area3D:number;kind:'planar-feature'|'surface'|'oriented-panel'|'crease-region'|'feature-sheet';featureFrame?:ProjectionFrame;boundaryLoops?:number;boundaryRegularization?:import('@meshtailor/mesh-core').BoundaryRegularizationReport;charts:number[]}
export interface PeelReport {version:1;groups:PeelGroup[];groupSeams:string[];events:{group:number;faces:number;depth:number;action:string;detail:string}[];sourceHintCharts:number;feedbackSplits:number;totalIslands:number;note:string}
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function faceFrame(mesh:MeshData,fi:number){const f=mesh.faces[fi]!,[a,b,c]=f.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3],n=cross(sub(b,a),sub(c,a)),l=Math.hypot(...n);return{normal:n.map(x=>x/Math.max(l,1e-30)) as Vec3,area:l/2,center:a.map((x,k)=>(x+b[k]!+c[k]!)/3) as Vec3};}

/** Coarse spatial groups precede any UV solving. Connected geometry is the
 * starting point; substantial planar features and coherent crease regions
 * are separated. Opposing normals alone are not a grouping criterion.
 * Small components are NOT divided according to triangle count or local normals.
 * This is geometric grouping, not a semantic body-part classifier. */
export function planSurfaceGroups(mesh:MeshData,cuts:ReadonlySet<string>,options:PeelOptions={},work?:UVWork):{report:PeelReport;seams:Set<string>;topology:MeshTopology}{
  if(options.seamBandRings!==undefined&&(!Number.isInteger(options.seamBandRings)||options.seamBandRings<1||options.seamBandRings>12))throw Error('seamBandRings must be an integer 1..12');
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
    // Closed polyhedra can have a meaningful face with only two triangles.
    // Do not turn every two-triangle bend of an open ribbon into a new panel.
    const minPlanarFaces=comp.faces.every(fi=>adj[fi]!.length===3)?2:4;
    for(const root of comp.faces){if(visited[root])continue;const n=frames[root]!.normal,d=dot(n,frames[root]!.center),q=[root];visited[root]=1;let area=0;
      for(let h=0;h<q.length;h++){const i=q[h]!;area+=frames[i]!.area;if((h&511)===0)work?.check();for(const j of adj[i]!)if(!visited[j]&&dot(n,frames[j]!.normal)>1-1e-8&&mesh.faces[j]!.vertices.every(v=>Math.abs(dot(n,mesh.positions[v]!)-d)<tolerance)){visited[j]=1;q.push(j);}}
      if(area>=Math.max(total*fraction,ca*.06)&&q.length>=minPlanarFaces&&q.length<comp.faces.length){for(const fi of q)planes[fi]=planeCount;planeCount++;}
    }
  }
  const seams=new Set(cuts);
  for(const [key,e]of topology.edges)if(e.faces.length===2&&planes[e.faces[0]!]!==planes[e.faces[1]!]&&(planes[e.faces[0]!]!>=0||planes[e.faces[1]!]!>=0))seams.add(key);
  // A wrapping surface is not automatically two opposing panels. Use coherent
  // crease-bounded regions as structural evidence; keep weak/isolated local
  // angles inside their parent instead of tracing every noisy normal cone.
  const oriented=new Uint8Array(mesh.faces.length);
  const degrees=options.groupFeatureDegrees??48;
  if(!Number.isFinite(degrees)||degrees<20||degrees>100)throw Error('groupFeatureDegrees must be 20..100');
  const creaseCos=Math.cos(degrees*Math.PI/180);
  for(const group of buildCharts(mesh,seams,topology)){
    const groupArea=group.faces.reduce((a,f)=>a+frames[f]!.area,0);
    if(groupArea<total*.015||group.faces.length<24||group.faces.every(f=>planes[f]!>=0))continue;
    const members=new Set(group.faces),barriers=new Set(seams);
    for(const[key,e]of topology.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&dot(frames[e.faces[0]!]!.normal,frames[e.faces[1]!]!.normal)<creaseCos)barriers.add(key);
    const pieces:number[][]=[],seen=new Set<number>();
    for(const root of group.faces)if(!seen.has(root)){
      const q=[root];seen.add(root);
      for(let h=0;h<q.length;h++){const f=mesh.faces[q[h]!]!;for(let k=0;k<3;k++){const key=edgeKey(f.vertices[k]!,f.vertices[(k+1)%3]!);if(barriers.has(key))continue;for(const j of topology.edges.get(key)?.faces??[])if(members.has(j)&&!seen.has(j)){seen.add(j);q.push(j);}}}
      pieces.push(q);
    }
    const large=pieces.filter(p=>p.length>=4&&p.reduce((a,f)=>a+frames[f]!.area,0)>=groupArea*.06);
    if(large.length<2||large.length>12)continue;
    // Attach small transition strips to their strongest edge-connected neighbor.
    const label=new Map<number,number>();large.forEach((p,i)=>p.forEach(f=>label.set(f,i)));
    let pending=group.faces.filter(f=>!label.has(f));
    for(let pass=0;pending.length&&pass<group.faces.length;pass++){
      const next:number[]=[];let changed=false;
      for(const f of pending){const votes=new Map<number,number>();const t=mesh.faces[f]!.vertices;for(let k=0;k<3;k++){
        const key=edgeKey(t[k]!,t[(k+1)%3]!),e=topology.edges.get(key);if(seams.has(key)||!e)continue;
        for(const j of e.faces){const l=label.get(j);if(l!==undefined)votes.set(l,(votes.get(l)??0)+Math.hypot(...sub(mesh.positions[e.a]!,mesh.positions[e.b]!))*(.1+Math.max(0,dot(frames[f]!.normal,frames[j]!.normal))));}
      }
      if(votes.size){const l=[...votes].sort((a,b)=>b[1]-a[1]||a[0]-b[0])[0]![0];label.set(f,l);changed=true;}else next.push(f);}
      if(!changed)break;pending=next;
    }
    if(pending.length)continue;
    let grouped=large.map((_,i)=>group.faces.filter(f=>label.get(f)===i));
    if(grouped.length===2)grouped=regularizeBinaryPartition(mesh,grouped,seams,topology,()=>work?.check(),options.seamBandRings??5).parts;
    label.clear();grouped.forEach((p,i)=>p.forEach(f=>label.set(f,i)));
    for(const[key,e]of topology.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&label.get(e.faces[0]!)!==label.get(e.faces[1]!))seams.add(key);
    for(const f of group.faces)oriented[f]=1;
  }
  // Identify readable multi-boundary sheets before opening closed handles.
  // Only fully checked projected regions become shape references. Other faces
  // remain in the model and are solved as return walls/back/transition groups.
  const featureByFace=new Map<number,{frame:ProjectionFrame;boundaryLoops:number}>();
  for(const group of buildCharts(mesh,seams,topology)){
    if(group.faces.every(f=>planes[f]!>=0))continue;
    const ar=group.faces.reduce((s,f)=>s+frames[f]!.area,0);if(ar<total*.001)continue;
    const found=findSheetFeatures(mesh,group.faces,seams,topology,work);
    if(!found.length)continue;
    const labels=new Map<number,number>();found.forEach((c,i)=>c.faces.forEach(f=>{labels.set(f,i);featureByFace.set(f,{frame:c.frame,boundaryLoops:c.boundaryLoops});}));
    const members=new Set(group.faces);
    for(const[key,e]of topology.edges)if(e.faces.length===2&&e.faces.every(f=>members.has(f))&&(labels.get(e.faces[0]!)??-1)!==(labels.get(e.faces[1]!)??-1))seams.add(key);
  }
  const groups=buildCharts(mesh,seams,topology).map(c=>({id:c.id,faces:c.faces,area3D:c.faces.reduce((s,f)=>s+frames[f]!.area,0),...(featureByFace.has(c.faces[0]!)?{featureFrame:featureByFace.get(c.faces[0]!)!.frame,boundaryLoops:featureByFace.get(c.faces[0]!)!.boundaryLoops,boundaryRegularization:featureByFace.get(c.faces[0]!)!.regularization}:{}),kind:(featureByFace.has(c.faces[0]!)?'feature-sheet':c.faces.every(f=>planes[f]===planes[c.faces[0]!]&&planes[f]!>=0)?'planar-feature':c.faces.every(f=>oriented[f])?'crease-region':'surface') as PeelGroup['kind'],charts:[]}));
  const report:PeelReport={version:1,groups,groupSeams:[...seams],events:[],sourceHintCharts:0,feedbackSplits:0,totalIslands:0,note:'纯几何：连通结构与完整平面特征优先，成组折角边界提供分组依据。不按相向法线强制二分。组内先尝试保孔求解、规则开缝，失败反馈使用长度/折角图割约束的连通分割；原 UV 从未进入生成。没有人工语义标签或模型名称特例。'};
  return{report,seams,topology};
}
class MinHeap{a:[number,number,number][]=[];push(v:number,d:number,l:number){const a=this.a;let i=a.length;a.push([v,d,l]);while(i){const p=(i-1)>>1;if(a[p]![1]<=d)break;a[i]=a[p]!;i=p;}a[i]=[v,d,l];}pop(){const a=this.a,r=a[0]!,x=a.pop()!;if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1]![1]<a[j]![1])j++;if(a[j]![1]>=x[1])break;a[i]=a[j]!;i=j;}a[i]=x;}return r;}}
/** Two connected geodesic catchments, NOT dozens of normal-cone regions.
 * Folded surfaces remain contiguous; high-curvature adjacencies cost more.
 * Existing cuts and group boundaries cannot be crossed. */
export function bisectSurface(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,topology:MeshTopology,work?:UVWork,seedFaces?:readonly [number,number],band=5):number[][]{
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
  const original=out.filter(c=>c.length);
  if(original.length!==2)return original;
  const regular=regularizeBinaryPartition(mesh,original,cuts,topology,()=>work?.check(),band);
  return regular.parts;
}

/** Repacking/filling changes UV placement, not the geometric group identity. */
export function carryPeelReport(previous:PeelReport,charts:readonly {id:number;faceUVs:Map<number,unknown>}[]):PeelReport {
  const result=structuredClone(previous),owner=new Map<number,number>();for(const g of result.groups){g.charts=[];for(const f of g.faces)owner.set(f,g.id);}
  for(const c of charts){const ids=new Set([...c.faceUVs.keys()].map(f=>owner.get(f)));if(ids.size!==1||ids.has(undefined))throw Error('UV edit crossed or lost a protected spatial-group boundary.');result.groups.find(g=>g.id===[...ids][0])!.charts.push(c.id);}
  result.totalIslands=charts.length;return result;
}
