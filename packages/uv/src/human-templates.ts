/** Geometry-driven seam templates. No model-name/ID-specific production branches. */
import {buildTopology,edgeKey,type MeshData,type Vec2,type Vec3} from '@meshtailor/mesh-core';
import {cutLocalMesh} from './cut-topology.js';
import {parameterizeChart,triangleArea} from './parameterize.js';
import {shapeQuality} from './chart-quality.js';
import {checkUVTriangles,signedArea2} from './uv-quality.js';
import {uvProgress,rethrowUVStop,type UVWork} from './work.js';
import type {RawChart} from './atlas-pack.js';
import type {UnwrapOptions,ChartDiagnostic} from './unwrap.js';
export interface HumanTemplateOptions {panels:1|2;axis:'auto'|'x'|'y'|'z';seamAngleDegrees:number;minAreaFraction:number;maxAnisotropy:number;selectedCharts?:number[]}
export const DEFAULT_HUMAN:HumanTemplateOptions={panels:2,axis:'auto',seamAngleDegrees:0,minAreaFraction:.005,maxAnisotropy:4};
export interface HumanTemplateEntry {
 sourceChart:number;faces:number;sourceAreaFraction:number;status:'applied'|'skipped'|'rejected';reason:string;
 template?:'cylinder-strip'|'cone-sector'|'contour-band';charts?:number[];axis?:Vec3;around?:Vec3;
 radialFitError?:number;maxAnisotropy?:number;boundaryLoops?:number;seamEdges?:string[];
 lowerBoundary?:number[];upperBoundary?:number[];panelFaces?:number[][];
}
export interface HumanTemplateReport {version:1;options:HumanTemplateOptions;before:number;after:number;applied:number;entries:HumanTemplateEntry[];protectedSeams:string[];addedSeams:string[];removedSeams:string[]}
export function humanOptions(value:Partial<HumanTemplateOptions>={}):HumanTemplateOptions{
 const o={...DEFAULT_HUMAN,...value};
 if(![1,2].includes(o.panels)||!['auto','x','y','z'].includes(o.axis)||!Number.isFinite(o.seamAngleDegrees)||o.seamAngleDegrees<-180||o.seamAngleDegrees>180||!Number.isFinite(o.minAreaFraction)||o.minAreaFraction<0||o.minAreaFraction>.25||!Number.isFinite(o.maxAnisotropy)||o.maxAnisotropy<1.1||o.maxAnisotropy>20||o.selectedCharts&&(!Array.isArray(o.selectedCharts)||o.selectedCharts.some(x=>!Number.isInteger(x)||x<0)))throw Error('Invalid structural UV template settings.');return o;
}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,x,i)=>s+x*b[i]!,0);
const sub=(a:Vec3,b:Vec3):Vec3=>a.map((x,i)=>x-b[i]!) as Vec3;
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:Vec3):Vec3=>{const l=Math.hypot(...a);return a.map(x=>x/Math.max(l,1e-30)) as Vec3;};
const mean=(ps:Vec3[]):Vec3=>ps.reduce((s,p)=>s.map((x,k)=>x+p[k]!/ps.length) as Vec3,[0,0,0] as Vec3);
const TAU=Math.PI*2,mod=(a:number)=>((a%TAU)+TAU)%TAU;
const area=(mesh:MeshData,faces:readonly number[])=>faces.reduce((s,i)=>{const t=mesh.faces[i]!.vertices;return s+triangleArea(mesh.positions[t[0]]!,mesh.positions[t[1]]!,mesh.positions[t[2]]!);},0);
function loopInfo(ps:Vec3[]){const center=mean(ps);let n:Vec3=[0,0,0],length=0;for(let i=0;i<ps.length;i++){const a=sub(ps[i]!,center),b=sub(ps[(i+1)%ps.length]!,center),c=cross(a,b);n=n.map((x,k)=>x+c[k]!) as Vec3;length+=Math.hypot(...sub(ps[i]!,ps[(i+1)%ps.length]!));}return{center,normal:unit(n),length};}
/** Two ordered cross-section loops, not merely two holes in an arbitrary patch. */
export function inspectBand(mesh:MeshData,faces:readonly number[],settings:Partial<HumanTemplateOptions>={}){
 const o=humanOptions(settings),local=cutLocalMesh(mesh,faces,new Set());
 if(local.euler!==0||local.boundaryLoops!==2||local.boundaries.some(b=>b.length<6))return{ok:false as const,reason:'not-two-ring-band',boundaryLoops:local.boundaryLoops};
 const infos=local.boundaries.map(b=>loopInfo(b.map(v=>local.positions[v]!))),A=infos[0]!,B=infos[1]!;
 if(Math.abs(dot(A.normal,B.normal))<.90)return{ok:false as const,reason:'boundary-planes-disagree',boundaryLoops:2};
 let axis:Vec3=o.axis==='auto'?unit(A.normal.map((x,k)=>x+B.normal[k]!*(dot(A.normal,B.normal)>=0?1:-1)) as Vec3):([0,1,2].map(k=>k==='xyz'.indexOf(o.axis)?1:0) as Vec3);
 const dominant=axis.reduce((m,x,k)=>Math.abs(x)>Math.abs(axis[m]!)?k:m,0);if(axis[dominant]!<0)axis=axis.map(x=>-x) as Vec3;
 let lower=0,upper=1;if(dot(A.center,axis)>dot(B.center,axis)){lower=1;upper=0;}
 const low=infos[lower]!,high=infos[upper]!,origin=mean([low.center,high.center]),span=dot(sub(high.center,low.center),axis),radius=(A.length+B.length)/(2*TAU);
 if(span<radius*.12||span>radius*12||Math.abs(dot(A.normal,axis))<.9||Math.abs(dot(B.normal,axis))<.9)return{ok:false as const,reason:'not-longitudinal-cross-sections',boundaryLoops:2};
 // Deterministic transverse principal direction. This is a configurable
 // geometric convention, not a claim to know the object's front/back semantics.
 const base:Vec3=Math.abs(axis[0])<.8?[1,0,0]:[0,0,1];let u=unit(sub(base,axis.map(x=>x*dot(base,axis)) as Vec3)),v=unit(cross(axis,u));
 let xx=0,xy=0,yy=0;for(const p of local.positions){const q=sub(p,origin),x=dot(q,u),y=dot(q,v);xx+=x*x;xy+=x*y;yy+=y*y;}
 if(Math.hypot(xx-yy,2*xy)>(xx+yy)*.025){const a=.5*Math.atan2(2*xy,xx-yy);u=unit(u.map((x,k)=>x*Math.cos(a)+v[k]!*Math.sin(a)) as Vec3);}
 const ud=u.reduce((m,x,k)=>Math.abs(x)>Math.abs(u[m]!)?k:m,0);if(u[ud]!<0)u=u.map(x=>-x) as Vec3;v=unit(cross(axis,u));
 const rad=o.seamAngleDegrees*Math.PI/180,around=u.map((x,k)=>x*Math.cos(rad)+v[k]!*Math.sin(rad)) as Vec3,across=unit(cross(axis,around));
 const coord=(p:Vec3)=>{const q=sub(p,origin),x=dot(q,around),y=dot(q,across);return{t:dot(q,axis),theta:mod(Math.atan2(y,x)),r:Math.hypot(x,y)};};
 let planeError=0;
 for(let i=0;i<2;i++){
  const lp=local.boundaries[i]!,center=infos[i]!.center,ts=lp.map(v=>coord(local.positions[v]!).theta);let winding=0,back=0;
  const delta=(j:number)=>{let d=ts[(j+1)%ts.length]!-ts[j]!;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
  for(let j=0;j<ts.length;j++)winding+=delta(j);for(let j=0;j<ts.length;j++)if(Math.sign(winding)*delta(j)<-.015)back++;
  if(Math.abs(Math.abs(winding)-TAU)>.05||back)return{ok:false as const,reason:'boundary-not-ordered-around-axis',boundaryLoops:2};
  planeError=Math.max(planeError,Math.sqrt(lp.reduce((s,v)=>s+dot(sub(local.positions[v]!,center),axis)**2,0)/lp.length)/radius);
 }
 if(planeError>.20)return{ok:false as const,reason:'boundary-not-cross-section',boundaryLoops:2};
 const coords=local.positions.map(coord),tm=coords.reduce((s,c)=>s+c.t/coords.length,0),rm=coords.reduce((s,c)=>s+c.r/coords.length,0);
 let tt=0,tr=0;for(const c of coords){tt+=(c.t-tm)**2;tr+=(c.t-tm)*(c.r-rm);}const slope=tr/Math.max(tt,1e-30),intercept=rm-slope*tm;
 const fitError=Math.sqrt(coords.reduce((s,c)=>s+(c.r-intercept-slope*c.t)**2,0)/coords.length)/rm;
 const template:NonNullable<HumanTemplateEntry['template']>=fitError<.018?(Math.abs(slope)<.025?'cylinder-strip':'cone-sector'):'contour-band';
 return{ok:true as const,local,axis,around,origin,coord,radius:rm,span,slope,intercept,template,fitError,lower:local.boundaries[lower]!.map(v=>local.sourceVertices[v]!),upper:local.boundaries[upper]!.map(v=>local.sourceVertices[v]!)};
}
export interface BandTemplateResult {raw:RawChart[];seams:Set<string>;locked:string[];entry:HumanTemplateEntry;diagnostics:ChartDiagnostic[]}
/** Atomically replace a region's UV. Plan cuts on real edges before solving. */
export function unfoldBand(mesh:MeshData,faces:readonly number[],sourceChart:number,inputSeams:ReadonlySet<string>,opts:UnwrapOptions,totalArea:number,work?:UVWork):BandTemplateResult|HumanTemplateEntry{
 const o=humanOptions(opts.humanTemplates),fraction=area(mesh,faces)/Math.max(totalArea,1e-30),base={sourceChart,faces:faces.length,sourceAreaFraction:fraction};
 if(o.selectedCharts&&!o.selectedCharts.includes(sourceChart))return{...base,status:'skipped',reason:'outside-selected-scope'};
 if(!o.selectedCharts&&(fraction<o.minAreaFraction||faces.length<16))return{...base,status:'skipped',reason:'below-structural-area-threshold'};
 if(faces.length>opts.maxChartFaces)return{...base,status:'rejected',reason:'template-face-budget'};
 work?.check();const band=inspectBand(mesh,faces,o);if(!band.ok)return{...base,status:'skipped',reason:band.reason,boundaryLoops:band.boundaryLoops};
 const protectedCuts=new Set(opts.mergeOptions?.protectedSeams??[]),edgeFaces=new Map<string,number[]>();
 for(const fi of faces)for(let k=0;k<3;k++){const f=mesh.faces[fi]!.vertices,key=edgeKey(f[k]!,f[(k+1)%3]!);const list=edgeFaces.get(key)??[];list.push(fi);edgeFaces.set(key,list);}
 const phase=new Map<number,number[]>(),groups:number[][]=Array.from({length:o.panels},()=>[]),groupOf=new Map<number,number>();
 for(const fi of faces){const a=mesh.faces[fi]!.vertices.map(v=>band.coord(mesh.positions[v]!).theta);if(Math.max(...a)-Math.min(...a)>Math.PI)for(let k=0;k<3;k++)if(a[k]!<Math.PI)a[k]!+=TAU;
  let center=a.reduce((s,x)=>s+x,0)/3;if(center>=TAU){for(let k=0;k<3;k++)a[k]!-=TAU;center-=TAU;}
  const group=o.panels===1?0:Math.min(1,Math.floor(center/Math.PI));phase.set(fi,a);groups[group]!.push(fi);groupOf.set(fi,group);
 }
 if(groups.some(g=>g.length<2))return{...base,status:'rejected',reason:'empty-side-panel'};
 const seams=new Set(inputSeams),locked:string[]=[];
 for(const [key,fs]of edgeFaces)if(fs.length===2)seams.delete(key);
 for(const [key,fs]of edgeFaces){
  if(fs.length!==2){locked.push(key);continue;}
  const [fa,fb]=fs as [number,number];let cut=groupOf.get(fa)!==groupOf.get(fb);const A=mesh.faces[fa]!.vertices,B=mesh.faces[fb]!.vertices;
  for(let k=0;k<3;k++){const j=B.indexOf(A[k]!);if(j>=0&&Math.abs(phase.get(fa)![k]!-phase.get(fb)![j]!)>1e-5)cut=true;}
  if(cut){seams.add(key);locked.push(key);}else if(protectedCuts.has(key))return{...base,status:'rejected',reason:'protected-seam-would-be-removed'};
 }
 const result:RawChart[]=[],diagnostics:ChartDiagnostic[]=[];
 try{
  for(let gi=0;gi<groups.length;gi++){
   const fs=groups[gi]!,local=cutLocalMesh(mesh,fs,seams);if(!local.disk)return{...base,status:'rejected',reason:'planned-cuts-not-one-disk-per-panel'};
   uvProgress(work,{stage:'parameterize',detail:`结构环带 #${sourceChart+1}：${o.panels===2?'两侧切缝 / 两片':'单纵缝 / 一片'}，${band.template}`});
   const refs:Vec2[]=new Array(local.positions.length),middle=(gi+.5)*TAU/o.panels;
   for(let i=0;i<fs.length;i++)for(let k=0;k<3;k++){const v=local.triangles[i]![k]!,p=band.coord(local.positions[v]!),theta=phase.get(fs[i]!)![k]!-middle;refs[v]=[theta*band.radius,p.t];}
   let uv:Vec2[],method:string,iterations=0,residual=0;
   if(band.template==='cylinder-strip'){uv=refs.map(p=>[...p]);method='human-cylinder';}
   else if(band.template==='cone-sector'){
    const k=band.slope,f=Math.abs(k)/Math.sqrt(1+k*k),sgn=Math.sign(k),R0=band.intercept/f;
    uv=local.positions.map((p,i)=>{const t=band.coord(p).t,R=(band.intercept+k*t)/f,theta=refs[i]![0]/band.radius*f;return[R*Math.sin(theta),sgn*(R*Math.cos(theta)-R0)] as Vec2;});method='human-cone';
   }else{
    const solved=parameterizeChart(local,{...opts,uvObjective:'paint',method:'lscm'},work);uv=solved.uv;iterations=solved.iterations;residual=solved.residual;method='human-contour-band';
    // Match reference handedness before rigid alignment; preserve the axial up
    // direction rather than accidentally aligning a reflected reference sideways.
    if(local.triangles.reduce((s,t)=>s+signedArea2(refs[t[0]]!,refs[t[1]]!,refs[t[2]]!),0)<0)refs.forEach(p=>p[0]*=-1);
    const center=mean(uv.map(p=>[p[0],p[1],0])),target=mean(refs.map(p=>[p[0],p[1],0]));let aa=0,bb=0;
    for(let i=0;i<uv.length;i++){const x=uv[i]![0]-center[0],y=uv[i]![1]-center[1],X=refs[i]![0]-target[0],Y=refs[i]![1]-target[1];aa+=x*X+y*Y;bb+=x*Y-y*X;}
    const angle=Math.atan2(bb,aa),co=Math.cos(angle),si=Math.sin(angle);uv=uv.map(p=>[(p[0]-center[0])*co-(p[1]-center[1])*si,(p[0]-center[0])*si+(p[1]-center[1])*co]);
   }
   if(local.triangles.reduce((s,t)=>s+signedArea2(uv[t[0]]!,uv[t[1]]!,uv[t[2]]!),0)<0)uv=uv.map(p=>[-p[0],p[1]]);
   const quality=checkUVTriangles(local.triangles.map(t=>t.map(v=>uv[v]!) as [Vec2,Vec2,Vec2]),100,work),shape=shapeQuality(local,uv,1,opts.maxStretch);
   if(!quality.valid||shape.maxStretch>Math.min(o.maxAnisotropy,opts.maxStretch)||shape.aspect>opts.maxAspect||shape.fill<opts.minFill)return{...base,status:'rejected',reason:`template-quality: flips=${quality.flipped}, overlap=${quality.overlaps}, anisotropy=${shape.maxStretch.toFixed(3)}`};
   const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();local.sourceFaces.forEach((fi,i)=>faceUVs.set(fi,local.triangles[i]!.map(v=>[...uv[v]!] as Vec2) as [Vec2,Vec2,Vec2]));
   result.push({id:sourceChart+gi,faceUVs,area3D:area(mesh,fs)});diagnostics.push({id:sourceChart+gi,sourceChart,faces:fs.length,method,iterations,residual,...shape});
  }
 }catch(error){rethrowUVStop(error);return{...base,status:'rejected',reason:'band-solve: '+(error instanceof Error?error.message:String(error))};}
 work?.check();return{raw:result,seams,locked,diagnostics,entry:{...base,status:'applied',reason:'ordered-longitudinal-seams',template:band.template,axis:band.axis,around:band.around,radialFitError:band.fitError,boundaryLoops:2,charts:[],panelFaces:groups.map(g=>[...g]),seamEdges:locked.filter(k=>edgeFaces.get(k)?.length===2),lowerBoundary:band.lower,upperBoundary:band.upper,maxAnisotropy:Math.max(...diagnostics.map(d=>d.maxStretch))}};
}
/** Runs before generic merging. Template region interfaces are protected so the
 * downstream optimizer cannot silently merge a recognizable panel away. */
export function applyHumanTemplates(mesh:MeshData,input:RawChart[],inputSeams:ReadonlySet<string>,opts:UnwrapOptions,work?:UVWork){
 const settings=humanOptions(opts.humanTemplates),report:HumanTemplateReport={version:1,options:settings,before:input.length,after:input.length,applied:0,entries:[],protectedSeams:[],addedSeams:[],removedSeams:[]};
 const total=input.reduce((s,c)=>s+c.area3D,0),out:RawChart[]=[],diagnostics:ChartDiagnostic[]=[],locked=new Set<string>();let seams=new Set(inputSeams),nextId=input.reduce((n,c)=>Math.max(n,c.id+1),0);
 if(settings.selectedCharts?.some(id=>!input.some(c=>c.id===id)))throw Error('Template selection refers to an expired or unknown island.');
 // Explicit multi-selection may include the two sides of a previously cut
 // band. Regroup ONLY selected charts that actually share source edges. On
 // rejection restore every original chart, never publish a fictitious merge.
 const tasks:RawChart[][]=[];
 if(settings.selectedCharts){
  const selected=new Set(settings.selectedCharts),parent=new Map(input.map(c=>[c.id,c.id])),owners=new Map<number,number>();
  const root=(id:number):number=>{while(parent.get(id)!==id)id=parent.get(id)!;return id;};
  for(const c of input)for(const f of c.faceUVs.keys())owners.set(f,c.id);
  for(const e of buildTopology(mesh).edges.values())if(e.faces.length===2){const a=owners.get(e.faces[0]!)!,b=owners.get(e.faces[1]!)!;if(selected.has(a)&&selected.has(b)){const A=root(a),B=root(b);if(A!==B)parent.set(Math.max(A,B),Math.min(A,B));}}
  const grouped=new Map<number,RawChart[]>();for(const c of input){const id=selected.has(c.id)?root(c.id):c.id,list=grouped.get(id)??[];list.push(c);grouped.set(id,list);}tasks.push(...grouped.values());
 }else tasks.push(...input.map(c=>[c]));
 for(const parts of tasks){const c:RawChart=parts.length===1?parts[0]!:{id:Math.min(...parts.map(c=>c.id)),area3D:parts.reduce((s,c)=>s+c.area3D,0),faceUVs:new Map(parts.flatMap(c=>[...c.faceUVs]))};work?.check();const attempt=unfoldBand(mesh,[...c.faceUVs.keys()],c.id,seams,opts,total,work);
  if(!('raw'in attempt)){out.push(...parts);report.entries.push(attempt);continue;}
  seams=attempt.seams;attempt.locked.forEach(e=>{locked.add(e);seams.add(e);});
  attempt.raw.forEach((p,i)=>{p.id=i===0?c.id:nextId++;attempt.diagnostics[i]!.id=p.id;out.push(p);attempt.entry.charts!.push(p.id);});diagnostics.push(...attempt.diagnostics);report.entries.push(attempt.entry);report.applied++;
 }
 report.after=out.length;report.protectedSeams=[...locked];report.addedSeams=[...seams].filter(e=>!inputSeams.has(e));report.removedSeams=[...inputSeams].filter(e=>!seams.has(e));
 return{raw:out,seams,report,diagnostics,protectedSeams:[...new Set([...(opts.mergeOptions?.protectedSeams??[]),...locked])]};
}
/** Merging renumbers charts. Resolve report references through immutable face IDs. */
export function remapHumanReport(report:HumanTemplateReport|undefined,raw:readonly RawChart[]):void{
 if(!report)return;const owner=new Map<number,number>();for(const p of raw)for(const f of p.faceUVs.keys())owner.set(f,p.id);
 for(const e of report.entries)if(e.panelFaces)e.charts=e.panelFaces.map(fs=>owner.get(fs[0]!)!).filter(id=>id!==undefined);
}

/** Preserve template seam constraints across later stitch/repack/fill jobs.
 * Only an explicit selection-scoped template operation may replace internal
 * template cuts; interfaces to non-selected geometry remain protected. */
export function inheritedTemplateSeams(mesh:MeshData,seed:readonly {id:number;faceUVs:Map<number,unknown>}[],report:HumanTemplateReport|undefined,reselected?:readonly number[]):string[]{
 if(!report)return[];if(!reselected)return[...report.protectedSeams];
 const ids=new Set(reselected),faces=new Set(seed.filter(c=>ids.has(c.id)).flatMap(c=>[...c.faceUVs.keys()])),topology=buildTopology(mesh);
 return report.protectedSeams.filter(key=>{const e=topology.edges.get(key);return !e||e.faces.length!==2||!e.faces.every(f=>faces.has(f));});
}
export function carryHumanTemplates(previous:HumanTemplateReport|undefined,current:HumanTemplateReport|undefined,packed:readonly {id:number;faceUVs:Map<number,unknown>}[],seams:ReadonlySet<string>):HumanTemplateReport|undefined{
 if(!previous?.applied)return current;
 const replaced=new Set(current?.entries.filter(e=>e.status==='applied').flatMap(e=>e.panelFaces?.flat()??[])??[]);
 const kept=previous.entries.filter(e=>e.status==='applied'&&!e.panelFaces?.flat().some(f=>replaced.has(f)));
 const entries=[...kept,...(current?.entries??[])];
 const report:HumanTemplateReport={...(current??previous),entries,applied:entries.filter(e=>e.status==='applied').length,after:packed.length,protectedSeams:[...new Set([...previous.protectedSeams,...(current?.protectedSeams??[])])].filter(e=>seams.has(e))};
 const owner=new Map<number,number>();for(const p of packed)for(const f of p.faceUVs.keys())owner.set(f,p.id);
 for(const e of report.entries)if(e.panelFaces)e.charts=e.panelFaces.map(fs=>owner.get(fs[0]!)!).filter(id=>id!==undefined);
 return report;
}
