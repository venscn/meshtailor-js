/** Closed sweep-tube recognition and rectangular strip coordinates.
 * Only positions, oriented triangle incidences and explicit cut constraints are
 * read. No mesh names, vertex numbering conventions, source UV or source seams.
 * Conservative scope: a complete family of near-circular geometric edge loops
 * with periodic, unbranched adjacency and compatible cross-section sampling.
 */
import {edgeKey,type MeshData,type Vec2,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {shapeQuality} from './chart-quality.js';
import {triangleArea,chartAreaDensity} from './parameterize.js';
import {checkUVTriangles,signedArea2} from './uv-quality.js';
import {simpleUVBoundary} from './boundary-guard.js';
import {uvProgress,type UVWork} from './work.js';
import type {RawChart} from './atlas-pack.js';
import type {PackedChart} from './preview.js';
export interface TubeOptions {closedTubeStrips?:boolean;closedTubePanels?:number;closedTubeMaxStretch?:number}
export interface TubeCorner {face:number;corner:number}
export interface TubeStripContract {
 faces:number[];seams:string[];corners:[TubeCorner,TubeCorner,TubeCorner,TubeCorner];
 sides:TubeCorner[][];length:number;width:number;
}
export interface TubeStripReport {
 status:'applied';sourceChart:number;rings:number;verticesPerRing:number;panels:number;
 requestedPanels:number;budgetExpanded:boolean;faces:number;longitudinalEdges:number;transverseEdges:number;
 length:number;circumference:number;aspect:number;ringFitError:number;
 maxStretch:number;minAreaDensity:number;maxAreaDensity:number;charts:number[];
 note:string;
}
export interface TubeInspection {rings:Ring[];stripOffsets:number[];lengths:number[];widths:number[];edges:Map<string,number[]>}
interface Ring {vertices:number[];center:Vec3;normal:Vec3;radius:number;error:number;perimeter:number}
export interface TubePlan {raw:RawChart[];seams:Set<string>;locked:string[];contracts:TubeStripContract[];report:TubeStripReport;shapes:ReturnType<typeof shapeQuality>[]}
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:Vec3)=>Math.hypot(...a),unit=(a:Vec3):Vec3=>mul(a,1/Math.max(norm(a),1e-30));
const mod=(a:number,n:number)=>(a%n+n)%n;
function solve3(A:number[][],b:number[]):number[]|undefined {
 const m=A.map((row,i)=>[...row,b[i]!]);
 for(let j=0;j<3;j++){let k=j;for(let i=j+1;i<3;i++)if(Math.abs(m[i]![j]!)>Math.abs(m[k]![j]!))k=i;
  if(Math.abs(m[k]![j]!)<1e-12)return;[m[j],m[k]]=[m[k]!,m[j]!];const d=m[j]![j]!;for(let c=j;c<4;c++)m[j]![c]!/=d;
  for(let i=0;i<3;i++)if(i!==j){const f=m[i]![j]!;for(let c=j;c<4;c++)m[i]![c]!-=f*m[j]![c]!;}
 }return m.map(r=>r[3]!);
}
/** Circle fit in a polygon-derived plane. The fit is scale/rigid-motion invariant. */
function fitRing(mesh:MeshData,vertices:number[]):Ring|undefined {
 if(vertices.length<6||vertices.length>512)return;
 const ps=vertices.map(v=>mesh.positions[v]!),mean=mul(ps.reduce(add,[0,0,0]),1/ps.length);let normal:Vec3=[0,0,0],perimeter=0;
 for(let i=0;i<ps.length;i++){normal=add(normal,cross(sub(ps[i]!,mean),sub(ps[(i+1)%ps.length]!,mean)));perimeter+=norm(sub(ps[i]!,ps[(i+1)%ps.length]!));}
 if(norm(normal)<perimeter*perimeter*1e-5)return;normal=unit(normal);
 const scale=Math.max(...ps.map(p=>norm(sub(p,mean))));if(!(scale>0))return;
 const u=unit(sub(ps[0]!,mean)),v=unit(cross(normal,u));
 const A=Array.from({length:3},()=>[0,0,0]),b=[0,0,0];
 for(let i=0;i<ps.length;i++){const p=mul(sub(ps[i]!,mean),1/scale),x=dot(p,u),y=dot(p,v),r=[2*x,2*y,1],rhs=x*x+y*y;
  const w=(norm(sub(ps[i]!,ps[mod(i-1,ps.length)]!))+norm(sub(ps[(i+1)%ps.length]!,ps[i]!)))/perimeter;
  for(let j=0;j<3;j++){b[j]!+=w*r[j]!*rhs;for(let k=0;k<3;k++)A[j]![k]!+=w*r[j]!*r[k]!;}}
 const solution=solve3(A,b);if(!solution)return;const[cx,cy,c]=solution as [number,number,number],rad2=c+cx*cx+cy*cy;if(rad2<=0)return;
 const radius=Math.sqrt(rad2)*scale,center=add(mean,mul(add(mul(u,cx),mul(v,cy)),scale));let error=0,winding=0;
 for(let i=0;i<ps.length;i++){const a=sub(ps[i]!,center),b=sub(ps[(i+1)%ps.length]!,center);error=Math.max(error,Math.abs(dot(a,normal))/radius,Math.abs(norm(a)/radius-1));winding+=Math.atan2(dot(cross(a,b),normal),dot(a,b));}
 if(error>.035||Math.abs(winding-2*Math.PI)>.03)return;
 return {vertices,center,normal,radius,error,perimeter};
}
/** Directed-edge straightest continuation discovers closed geometric loops.
 * Unlike procedural row metadata, it survives vertex/face shuffles and reversal
 * of quad diagonals. Non-grid/adaptively remeshed tubes may be declined. */
export function inspectClosedTube(mesh:MeshData,faces:readonly number[],cuts:ReadonlySet<string>,work?:UVWork):TubeInspection|undefined {
 if(faces.length<96)return;const local=cutLocalMesh(mesh,faces,cuts);
 if(!local.manifold||local.euler!==0||local.boundaryLoops!==0||new Set(local.sourceVertices).size!==local.positions.length)return;
 const ids=local.sourceVertices,n=ids.length,at=new Map(ids.map((v,i)=>[v,i])),adj=ids.map(()=>new Set<number>()),edges=new Map<string,number[]>();
 for(const fi of faces)for(let k=0;k<3;k++){const t=mesh.faces[fi]!.vertices,a=t[k]!,b=t[(k+1)%3]!,key=edgeKey(a,b);if(cuts.has(key))return;
  const fs=edges.get(key)??[];fs.push(fi);edges.set(key,fs);adj[at.get(a)!]!.add(at.get(b)!);adj[at.get(b)!]!.add(at.get(a)!);}
 if([...edges.values()].some(fs=>fs.length!==2))return;
 const transitions=new Map<number,number>();
 for(let a=0;a<n;a++){if((a&255)===0)work?.check();for(const b of adj[a]!){const incoming=unit(sub(local.positions[b]!,local.positions[a]!));let next=-1,best=-Infinity;
   for(const c of adj[b]!)if(c!==a){const q=dot(incoming,unit(sub(local.positions[c]!,local.positions[b]!)));if(q>best+1e-12){best=q;next=c;}}
   if(next>=0)transitions.set(a*n+b,b*n+next);
 }}
 const seen=new Set<number>(),keys=new Set<string>(),candidates:Ring[]=[];
 for(const start of transitions.keys())if(!seen.has(start)){
  work?.check();let state=start;const path:number[]=[],index=new Map<number,number>();
  while(!seen.has(state)&&!index.has(state)){if((path.length&1023)===0)work?.check();index.set(state,path.length);path.push(state);const next=transitions.get(state);if(next===undefined)break;state=next;}
  const cycle=index.has(state)?path.slice(index.get(state)!):[];for(const p of path)seen.add(p);
  if(cycle.length<6||cycle.length>512)continue;const vs=cycle.map(k=>ids[Math.floor(k/n)]!);if(new Set(vs).size!==vs.length)continue;
  const key=[...vs].sort((a,b)=>a-b).join(':');if(keys.has(key))continue;keys.add(key);const ring=fitRing(mesh,vs);if(ring)candidates.push(ring);
 }
 if(candidates.length<8)return;
 // Select the short, disjoint cross-section family, not large longitudinal
 // circles on an ordinary torus. Full coverage is mandatory, never inferred.
 candidates.sort((a,b)=>a.perimeter-b.perimeter||a.error-b.error);
 const owner=new Map<number,number>(),family:Ring[]=[];
 for(const ring of candidates)if(ring.vertices.every(v=>!owner.has(v))){const r=family.length;family.push(ring);ring.vertices.forEach(v=>owner.set(v,r));}
 if(owner.size!==n||family.length<8)return;const m=family[0]!.vertices.length;
 if(family.some(r=>r.vertices.length!==m)||Math.max(...family.map(r=>r.radius))/Math.min(...family.map(r=>r.radius))>1.25)return;
 const graph=family.map(()=>new Set<number>());
 for(const fi of faces){const rs=[...new Set(mesh.faces[fi]!.vertices.map(v=>owner.get(v)!))];if(rs.length!==2)return;graph[rs[0]!]!.add(rs[1]!);graph[rs[1]!]!.add(rs[0]!);}
 if(graph.some(v=>v.size!==2))return;
 // A cycle, not a spatial nearest-neighbor path (which would jump between the
 // crossing strands of a knot).
 const order=[0];let previous=-1,current=0;
 while(order.length<family.length){const next=[...graph[current]!].find(r=>r!==previous);if(next===undefined||order.includes(next))return;order.push(next);previous=current;current=next;}
 if(!graph[current]!.has(0))return;
 const rings=order.map(i=>({...family[i]!,vertices:[...family[i]!.vertices]})),N=rings.length;
 for(let i=0;i<N;i++){const tangent=sub(rings[(i+1)%N]!.center,rings[mod(i-1,N)]!.center),r=rings[i]!;
  if(Math.abs(dot(unit(tangent),r.normal))<.9)return;
  if(dot(tangent,r.normal)<0){r.vertices.reverse();r.normal=mul(r.normal,-1);}}
 const lengths=rings.map((r,i)=>norm(sub(r.center,rings[(i+1)%N]!.center)));
 if(lengths.some((l,i)=>l<rings[i]!.radius*.001)||lengths.reduce((a,b)=>a+b,0)<family[0]!.perimeter*3)return;
 // Each possible offset must use REAL longitudinal edges for every sector.
 // Solve cyclic phase alignment, including the last-to-first constraint. A
 // greedy seam can drift one sector per ring and reopen as a helical zipper.
 const options=rings.map((a,i)=>{const b=rings[(i+1)%N]!,list:{shift:number;cost:number}[]=[];
  for(let shift=0;shift<m;shift++){let cost=0,valid=true;for(let j=0;j<m;j++){const x=a.vertices[j]!,y=b.vertices[(j+shift)%m]!;if(!edges.has(edgeKey(x,y))){valid=false;break;}cost+=norm(sub(mesh.positions[x]!,mesh.positions[y]!))**2;}if(valid)list.push({shift,cost:cost/m});}return list;});
 if(options.some(x=>!x.length))return;
 let distance=new Float64Array(m).fill(Infinity);distance[0]=0;const parents:number[][]=[],chosen:number[][]=[];
 for(let i=0;i<N;i++){work?.check();const next=new Float64Array(m).fill(Infinity),p=Array<number>(m).fill(-1),s=Array<number>(m).fill(-1);
  for(let a=0;a<m;a++)if(Number.isFinite(distance[a]))for(const opt of options[i]!){const b=(a+opt.shift)%m,cost=distance[a]!+opt.cost;if(cost<next[b]!-1e-15){next[b]=cost;p[b]=a;s[b]=opt.shift;}}
  parents.push(p);chosen.push(s);distance=next;
 }
 if(!Number.isFinite(distance[0]))return;const shifts=Array<number>(N),offsets=Array<number>(N+1).fill(0);let end=0;
 for(let i=N-1;i>=0;i--){shifts[i]=chosen[i]![end]!;end=parents[i]![end]!;if(end<0)return;}
 for(let i=0;i<N;i++)offsets[i+1]=(offsets[i]!+shifts[i]!)%m;
 if(offsets[N]!==0)return;
 for(let i=0;i<N;i++){const list=rings[i]!.vertices;rings[i]!.vertices=list.map((_,j)=>list[(j+offsets[i]!)%m]!);}
 // Shared circumferential arc fractions preserve the same side along the whole
 // strip. Use measured edge lengths, not the procedural angular parameters.
 const widths=Array<number>(m).fill(0);
 for(const r of rings)for(let j=0;j<m;j++)widths[j]!+=norm(sub(mesh.positions[r.vertices[j]!]!,mesh.positions[r.vertices[(j+1)%m]!]!))/N;
 return {rings,stripOffsets:offsets,lengths,widths,edges};
}
export function validateTubeOptions(o:TubeOptions):void {
 if(o.closedTubeStrips!==undefined&&typeof o.closedTubeStrips!=='boolean')throw Error('closedTubeStrips must be boolean');
 if(o.closedTubePanels!==undefined&&(!Number.isInteger(o.closedTubePanels)||o.closedTubePanels<1||o.closedTubePanels>64))throw Error('closedTubePanels must be 1..64');
 if(o.closedTubeMaxStretch!==undefined&&(!Number.isFinite(o.closedTubeMaxStretch)||o.closedTubeMaxStretch<1.05||o.closedTubeMaxStretch>8))throw Error('closedTubeMaxStretch must be 1.05..8');
}
export function unfoldClosedTube(mesh:MeshData,faces:number[],sourceChart:number,seams:ReadonlySet<string>,options:TubeOptions&{maxChartFaces:number;maxStretch:number;minFill:number},work?:UVWork):TubePlan|undefined {
 validateTubeOptions(options);if(options.closedTubeStrips===false)return;
 const plan=inspectClosedTube(mesh,faces,seams,work);if(!plan)return;
 const {rings,lengths,widths,edges}=plan,N=rings.length,M=widths.length;
 const requested=options.closedTubePanels??1,minPanels=Math.ceil(N/Math.floor(options.maxChartFaces/(2*M))),panels=Math.max(requested,minPanels);
 if(!Number.isFinite(panels)||panels>N||panels>64)return;
 const stripOf=new Map<number,number>(),sectorOf=new Map<number,number>();rings.forEach((r,i)=>r.vertices.forEach((v,j)=>{stripOf.set(v,i);sectorOf.set(v,j);}));
 const starts=Array.from({length:panels+1},(_,i)=>Math.floor(i*N/panels)),groups=Array.from({length:panels},()=>[] as number[]);
 const effective=new Set(seams),locked=new Set<string>(),transverse=new Set<string>(),longitude=new Set<string>();
 for(let i=0;i<N;i++){const key=edgeKey(rings[i]!.vertices[0]!,rings[(i+1)%N]!.vertices[0]!);longitude.add(key);locked.add(key);}
 for(const i of starts.slice(0,-1))for(let j=0;j<M;j++){const key=edgeKey(rings[i]!.vertices[j]!,rings[i]!.vertices[(j+1)%M]!);transverse.add(key);locked.add(key);}
 for(const key of locked){if(!edges.has(key))return;effective.add(key);}
 const long=[0],around=[0];lengths.forEach(l=>long.push(long.at(-1)!+l));widths.forEach(l=>around.push(around.at(-1)!+l));
 const width=around[M]!,length=long[N]!,faceCoords=new Map<number,[Vec2,Vec2,Vec2]>();
 for(const fi of faces){const vs=mesh.faces[fi]!.vertices,ri=vs.map(v=>stripOf.get(v)!),ci=vs.map(v=>sectorOf.get(v)!);
  if(Math.max(...ri)-Math.min(...ri)>N/2)for(let k=0;k<3;k++)if(ri[k]===0)ri[k]=N;
  if(Math.max(...ci)-Math.min(...ci)>M/2)for(let k=0;k<3;k++)if(ci[k]===0)ci[k]=M;
  if(Math.max(...ri)-Math.min(...ri)!==1||Math.max(...ci)-Math.min(...ci)!==1)return;
  const r=Math.min(...ri),panel=starts.findIndex((s,i)=>i<panels&&r>=s&&r<starts[i+1]!);if(panel<0)return;
  groups[panel]!.push(fi);faceCoords.set(fi,ri.map((r,k)=>[long[r]!-long[starts[panel]!]!,around[ci[k]!]!]) as [Vec2,Vec2,Vec2]);
 }
 const sum=faces.reduce((s,f)=>s+signedArea2(...faceCoords.get(f)!),0);if(sum<0)for(const t of faceCoords.values())for(const p of t)p[1]=width-p[1];
 const raw:RawChart[]=[],contracts:TubeStripContract[]=[],shapes:ReturnType<typeof shapeQuality>[]=[];let maxStretch=1,minDensity=Infinity,maxDensity=0;
 for(let i=0;i<panels;i++){
  work?.check();uvProgress(work,{stage:'parameterize',detail:`闭合管身：${N} 个横截面，纵缝＋横断面开缝，矩形条带 ${i+1}/${panels}`});
  const fs=groups[i]!,cut=cutLocalMesh(mesh,fs,effective);if(!cut.disk||fs.length>options.maxChartFaces)return;
  const coords:Vec2[]=new Array(cut.positions.length),bindings:TubeCorner[]=new Array(cut.positions.length);
  cut.sourceFaces.forEach((f,ti)=>cut.triangles[ti]!.forEach((v,k)=>{const p=faceCoords.get(f)![k]!;if(coords[v]&&Math.hypot(...sub2(coords[v]!,p))>1e-10)throw Error('Tube cut corner mismatch');coords[v]=p;bindings[v]={face:f,corner:k};}));
  const quality=checkUVTriangles(fs.map(f=>faceCoords.get(f)!),100,work),shape=shapeQuality(cut,coords,1,options.maxStretch),density=chartAreaDensity(cut,coords);
  if(!quality.valid||!simpleUVBoundary(coords,cut.boundaries,work)||shape.maxStretch>Math.min(options.closedTubeMaxStretch??4,options.maxStretch)||density.min<.2||density.max>5||shape.fill<1-1e-8)return;
  maxStretch=Math.max(maxStretch,shape.maxStretch);minDensity=Math.min(minDensity,density.min);maxDensity=Math.max(maxDensity,density.max);
  const L=long[starts[i+1]!]!-long[starts[i]!]!,targets:Vec2[]=[[0,0],[L,0],[L,width],[0,width]];
  const corners=targets.map(p=>bindings[coords.findIndex(q=>Math.hypot(...sub2(p,q))<1e-9)]!);if(corners.some(p=>!p))return;
  const sides:TubeCorner[][]=Array.from({length:4},()=>[]);
  for(const v of cut.boundary){const p=coords[v]!;if(Math.abs(p[1])<1e-9)sides[0]!.push(bindings[v]!);if(Math.abs(p[0]-L)<1e-9)sides[1]!.push(bindings[v]!);if(Math.abs(p[1]-width)<1e-9)sides[2]!.push(bindings[v]!);if(Math.abs(p[0])<1e-9)sides[3]!.push(bindings[v]!);}
  const members=new Set(fs),cutSeams=[...locked].filter(e=>edges.get(e)!.some(f=>members.has(f)));
  contracts.push({faces:[...fs],seams:cutSeams,corners:corners as TubeStripContract['corners'],sides,length:L,width});
  raw.push({id:i,faceUVs:new Map(fs.map(f=>[f,faceCoords.get(f)!])),area3D:fs.reduce((s,f)=>s+triangleArea(...mesh.faces[f]!.vertices.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3]),0)});shapes.push(shape);
 }
 return {raw,seams:effective,locked:[...locked],contracts,shapes,report:{status:'applied',sourceChart,rings:N,verticesPerRing:M,panels,requestedPanels:requested,budgetExpanded:panels>requested,faces:faces.length,longitudinalEdges:longitude.size,transverseEdges:transverse.size,length,circumference:width,aspect:length/width,ringFitError:Math.max(...rings.map(r=>r.error)),maxStretch,minAreaDensity:minDensity,maxAreaDensity:maxDensity,charts:[],note:'仅几何横截面与跨环邻接。宽＝平均周长，长＝中心轨迹弧长；矩形不是等距展开或正方形拉伸。'}};
}
const sub2=(a:Vec2,b:Vec2)=>[a[0]-b[0],a[1]-b[1]] as Vec2;
/** Repack/fill may only apply similarities. Preserve the four named sides and
 * source seams, not merely a visually rectangular bounding box. */
export function validateTubeOutput(charts:readonly PackedChart[],seams:ReadonlySet<string>,contracts:readonly TubeStripContract[]=[],work?:UVWork):void {
 for(const contract of contracts){work?.check();const chart=charts.find(c=>c.faceUVs.has(contract.faces[0]!));if(!chart||chart.faceUVs.size!==contract.faces.length||contract.faces.some(f=>!chart.faceUVs.has(f)))throw Error('Tube strip was merged, split or lost.');
  if(contract.seams.some(e=>!seams.has(e)))throw Error('Tube longitudinal/cross-section seam lost.');
  const read=(b:TubeCorner)=>chart.faceUVs.get(b.face)![b.corner]!;
  const [a,b,c,d]=contract.corners.map(read) as [Vec2,Vec2,Vec2,Vec2],u=sub2(b,a),v=sub2(d,a),lu=Math.hypot(...u),lv=Math.hypot(...v);
  if(!(lu>0&&lv>0)||Math.abs((lu/lv)/(contract.length/contract.width)-1)>1e-6||Math.abs(u[0]*v[0]+u[1]*v[1])>lu*lv*1e-7||Math.hypot(c[0]-b[0]-d[0]+a[0],c[1]-b[1]-d[1]+a[1])>Math.max(lu,lv)*1e-7)throw Error('Tube rectangle/aspect was distorted after parameterization.');
  const points=[a,b,c,d];for(let i=0;i<4;i++){const p=points[i]!,q=points[(i+1)%4]!,e=sub2(q,p),l=Math.hypot(...e);for(const binding of contract.sides[i]!){const w=sub2(read(binding),p),along=(w[0]*e[0]+w[1]*e[1])/(l*l);if(Math.abs(w[0]*e[1]-w[1]*e[0])>l*Math.max(lu,lv)*1e-7||along< -1e-7||along>1+1e-7)throw Error('Tube side no longer matches its declared longitudinal/circumferential boundary.');}}
 }
}
