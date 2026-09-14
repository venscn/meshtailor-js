import { uvProgress, rethrowUVStop, type UVWork } from './work.js';
import { buildTopology, edgeKey, type MeshData, type Vec3, type Vec2 } from '@meshtailor/mesh-core';
import { buildCharts } from './charts.js';
import { cutLocalMesh, type CutMesh } from './cut-topology.js';
import { parameterizeChart, triangleArea, type SolverOptions, type Parameterization } from './parameterize.js';
import { signedArea2 } from './uv-quality.js';
import { packAtlas, type AtlasPacking, type PackOptions, type RawChart } from './atlas-pack.js';
export interface UnwrapOptions extends SolverOptions,PackOptions { autoCut:boolean; maxChartFaces:number; maxAspect:number; minFill:number; maxStretch:number; timeBudgetMs?:number }
export interface ChartDiagnostic {id:number; sourceChart:number; faces:number; method:string; iterations:number; residual:number; fallbackReason?:string; aspect:number; fill:number; maxStretch:number}
export interface UnwrapResult extends AtlasPacking { seams:string[]; addedSeams:string[]; diagnostics:ChartDiagnostic[]; warnings:string[] }
export const DEFAULT_UNWRAP:UnwrapOptions={method:'auto',iterations:2000,tolerance:1e-9,padding:.003,rotate:true,rotationSteps:12,autoCut:true,maxChartFaces:2048,maxAspect:6,minFill:.4,maxStretch:12};
/** Connected, disk-preserving region growth. Existing seam edges are never crossed.
 * For non-disks this intentionally adds visible cuts rather than silently projecting
 * a closed surface, annulus, pinched or inconsistently oriented mesh. */
function splitDisks(local:CutMesh,maxFaces:number,limitNormals:boolean,work?:UVWork):number[][]{
  const n=local.triangles.length,incident=new Map<string,number[]>(),adj:number[][]=Array.from({length:n},()=>[]);
  local.triangles.forEach((t,i)=>{for(let k=0;k<3;k++){const key=edgeKey(t[k]!,t[(k+1)%3]!),list=incident.get(key)??[];list.push(i);incident.set(key,list);}});
  for(const fs of incident.values())if(fs.length===2){adj[fs[0]!]!.push(fs[1]!);adj[fs[1]!]!.push(fs[0]!);}
  const normals=local.triangles.map(t=>{const [a,b,c]=t.map(v=>local.positions[v]!) as [Vec3,Vec3,Vec3],u=b.map((x,i)=>x-a[i]!),v=c.map((x,i)=>x-a[i]!),n=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!],l=Math.hypot(...n);return n.map(x=>x/Math.max(l,1e-30));});
  const unseen=new Set(local.triangles.keys()),result:number[][]=[];
  while(unseen.size){const root=unseen.values().next().value!,chosen:number[]=[],vertices=new Set<number>(),boundary=new Map<string,[number,number]>(),queue=[root];
    // A rejected face can become admissible after a neighboring attachment; retry
    // when reached through another newly accepted neighbor (bounded by degree 3).
    for(let h=0;h<queue.length&&chosen.length<maxFaces;h++){
      if(h%256===0)work?.check();
      const fi=queue[h]!;if(!unseen.has(fi))continue;const t=local.triangles[fi]!;
      if(chosen.length&&limitNormals&&normals[root]!.reduce((s,x,i)=>s+x*normals[fi]![i]!,0)<.2)continue;
      const keys=t.map((v,k)=>edgeKey(v,t[(k+1)%3]!)),shared=keys.filter(k=>boundary.has(k));
      const known=t.filter(v=>vertices.has(v)).length;
      if(chosen.length && !(shared.length===1&&known===2||shared.length===2&&known===3))continue;
      chosen.push(fi);unseen.delete(fi);t.forEach(v=>vertices.add(v));
      keys.forEach((key,k)=>{if(boundary.has(key))boundary.delete(key);else boundary.set(key,[t[k]!,t[(k+1)%3]!]);});
      for(const f of adj[fi]!)if(unseen.has(f))queue.push(f);
    }
    if(!chosen.length)throw new Error('UV chart partition made no progress.');result.push(chosen.map(i=>local.sourceFaces[i]!));
  }
  return result;
}
function normalizedMesh(mesh:MeshData):MeshData{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of mesh.positions)for(let a=0;a<3;a++){if(!Number.isFinite(p[a]))throw new Error('Nonfinite mesh coordinate.');min[a]=Math.min(min[a]!,p[a]!);max[a]=Math.max(max[a]!,p[a]!);}
  const span=Math.max(...max.map((v,i)=>v-min[i]!));if(!(span>0&&Number.isFinite(span)))throw new Error('Zero/invalid mesh extent.');
  return{...mesh,positions:mesh.positions.map(p=>p.map((v,i)=>(v-min[i]!)/span) as [number,number,number])};
}
function shapeQuality(local:CutMesh,uv:Vec2[]){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,area=0,maxStretch=1;
  for(const [x,y]of uv){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  for(const t of local.triangles){
    const [a,b,c]=t.map(v=>local.positions[v]!) as [Vec3,Vec3,Vec3],ab=b.map((x,i)=>x-a[i]!),ac=c.map((x,i)=>x-a[i]!),l=Math.hypot(...ab),x=ab.reduce((s,v,i)=>s+v*ac[i]!,0)/l,y=2*triangleArea(a,b,c)/l;
    const [A,B,C]=t.map(v=>uv[v]!) as [Vec2,Vec2,Vec2];area+=Math.abs(signedArea2(A,B,C))*.5;
    const j00=(B[0]-A[0])/l,j10=(B[1]-A[1])/l,j01=((C[0]-A[0])-j00*x)/y,j11=((C[1]-A[1])-j10*x)/y;
    const tr=j00*j00+j10*j10+j01*j01+j11*j11,det=(j00*j11-j01*j10)**2,hi=(tr+Math.sqrt(Math.max(0,tr*tr-4*det)))/2,lo=det/Math.max(hi,1e-30);
    maxStretch=Math.max(maxStretch,Math.sqrt(hi/Math.max(lo,1e-30)));
  }
  const w=maxX-minX,h=maxY-minY;return{aspect:Math.max(w/h,h/w),fill:area/(w*h),maxStretch};
}
export function unwrapMesh(input:MeshData,seams:ReadonlySet<string>,options:Partial<UnwrapOptions>={},work?:UVWork):UnwrapResult{
  const opts={...DEFAULT_UNWRAP,...options};
  if(!['auto','lscm','tutte'].includes(opts.method)||typeof opts.autoCut!=='boolean'||typeof opts.rotate!=='boolean'||!Number.isFinite(opts.padding)||opts.padding<0||opts.padding>=.1||!Number.isInteger(opts.rotationSteps)||opts.rotationSteps<1||opts.rotationSteps>90)throw new Error('Invalid UV solver or packing settings.');
  if(!(opts.maxAspect>=1&&Number.isFinite(opts.maxAspect))||!(opts.minFill>=0&&opts.minFill<=1)||!(opts.maxStretch>=1&&Number.isFinite(opts.maxStretch))||!Number.isInteger(opts.maxChartFaces)||opts.maxChartFaces<8||opts.maxChartFaces>20000||!Number.isInteger(opts.iterations)||opts.iterations<1||opts.iterations>20000||!(opts.tolerance>0&&opts.tolerance<1))throw new Error('Invalid UV solver settings.');
  uvProgress(work,{stage:'validate',detail:'检查输入几何',facesDone:0,facesTotal:input.faces.length,islandsDone:0});
  const mesh=normalizedMesh(input),topology=buildTopology(mesh),effective=new Set(seams),warnings:string[]=[];
  for(const [key,e]of topology.edges)if(e.faces.length>2){if(!opts.autoCut)throw new Error('Non-manifold edges require cuts or mesh repair.');effective.add(key);}
  for(let fi=0;fi<mesh.faces.length;fi++){if(fi%256===0)work?.check();const t=mesh.faces[fi]!.vertices;if(new Set(t).size!==3||t.some(v=>!mesh.positions[v])||triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!)<1e-15)throw new Error(`Face ${fi} is degenerate in 3D. Repair/remove it before unwrapping; no faces were silently dropped.`);}
  uvProgress(work,{stage:'charts',detail:'按接缝拆分连通岛'});
  const charts=buildCharts(mesh,effective,topology),raw:RawChart[]=[],diagnostics:ChartDiagnostic[]=[];let partitions=0,facesDone=0;
  const solve=(faces:number[],sourceChart:number,depth=0)=>{
    uvProgress(work,{stage:'topology',detail:`检查源岛 ${sourceChart+1} 的 ${faces.length} 个面（补切层 ${depth}）`,facesDone,facesTotal:mesh.faces.length,islandsDone:raw.length});
    const local=cutLocalMesh(mesh,faces,effective);
    if(!local.disk||faces.length>opts.maxChartFaces){
      if(!opts.autoCut)throw new Error(`Chart ${sourceChart+1}: requires additional cuts (Euler ${local.euler}, ${local.boundaryLoops} boundaries, ${faces.length} faces). Enable automatic cuts or edit seams.`);
      const pieces=splitDisks(local,Math.min(opts.maxChartFaces,Math.max(1,faces.length-1)),!local.disk,work);partitions++;
      for(const fs of pieces)solve(fs,sourceChart,depth+1);return;
    }
    let p:Parameterization;
    // Catch this chart's numerical failure only. Never catch a child recursion
    // after it has appended solved siblings (that could duplicate source faces).
    try{p=parameterizeChart(local,opts,work);}catch(error){
      rethrowUVStop(error);
      if(!opts.autoCut||faces.length<2||depth>20)throw error;
      partitions++;for(const fs of splitDisks(local,Math.max(1,Math.floor(faces.length/2)),true,work))solve(fs,sourceChart,depth+1);return;
    }
      const shape=shapeQuality(local,p.uv);
      if(opts.autoCut&&faces.length>16&&(shape.aspect>opts.maxAspect||shape.fill<opts.minFill||shape.maxStretch>opts.maxStretch)){partitions++;for(const fs of splitDisks(local,Math.max(1,Math.floor(faces.length/2)),shape.maxStretch>opts.maxStretch,work))solve(fs,sourceChart,depth+1);return;}
      const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
      local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...p.uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
      const area3D=local.triangles.reduce((s,t)=>s+triangleArea(local.positions[t[0]]!,local.positions[t[1]]!,local.positions[t[2]]!),0),id=raw.length;
      facesDone+=faces.length;uvProgress(work,{stage:'parameterize',detail:'已接受有效 UV 岛',facesDone,facesTotal:mesh.faces.length,islandsDone:raw.length+1});
      raw.push({id,faceUVs,area3D});diagnostics.push({id,sourceChart,faces:faces.length,method:p.method,...shape,iterations:p.iterations,residual:p.residual,...(p.fallbackReason?{fallbackReason:p.fallbackReason}:{})});
  };
  charts.forEach(chart=>solve(chart.faces,chart.id));
  const faceChart=new Int32Array(mesh.faces.length);raw.forEach(r=>{for(const fi of r.faceUVs.keys())faceChart[fi]=r.id;});
  for(const [key,e]of topology.edges){
    if(e.faces.length!==2){if(e.faces.length>1)effective.add(key);continue;}
    if(faceChart[e.faces[0]!]!==faceChart[e.faces[1]!])effective.add(key);
    const f=mesh.faces[e.faces[0]!]!.vertices,g=mesh.faces[e.faces[1]!]!.vertices;
    const direction=(t:readonly number[])=>t.some((v,i)=>v===e.a&&t[(i+1)%3]===e.b);
    if(direction(f)===direction(g))effective.add(key);
  }
  const addedSeams=[...effective].filter(e=>!seams.has(e));
  if(addedSeams.length)warnings.push(`自动新增 ${addedSeams.length} 条 UV 裁切边（原接缝保留），用于拓扑修复、控制求解规模或避免无效 UV。新增边已用于动画、2D 与导出。`);
  const fallbacks=diagnostics.filter(d=>d.method==='tutte').length;if(fallbacks)warnings.push(`${fallbacks} 个岛使用凸边界 Tutte；优先有效映射，可能有较大拉伸。`);
  const atlas=packAtlas(raw,opts,work);
  warnings.push(`占用率是有效 UV 三角形面积之和，不是包围盒面积。排布为 ${atlas.packingMethod==='shelf'?'面积感知 Shelf（大岛数快速路径）':'MaxRects'} 启发式，不宣称全局最优。`);
  return{...atlas,seams:[...effective],addedSeams,diagnostics,warnings};
}
