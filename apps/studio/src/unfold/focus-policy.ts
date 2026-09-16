import {sampleUnfoldSchedule,type UnfoldGeometry,type UnfoldOptions} from '@meshtailor/uv';
export interface FocusSettings {focusMode?:'off'|'ghost'|'dither';focusRadius?:number;focusRetained?:number;/** True only during play or a live timeline gesture. */interactionActive?:boolean;focusOpacity?:number}
export interface FocusSphere {id:number;center:[number,number,number];radius:number;strength:number}
export const FOCUS_DEFAULTS={focusMode:'ghost' as const,focusRadius:1.2,focusRetained:.12,focusOpacity:.18};
export function focusSettings(s:FocusSettings){return{mode:s.focusMode==='off'?'off':s.focusMode==='dither'?'dither':'ghost',opacity:Math.max(.03,Math.min(.65,Number.isFinite(s.focusOpacity)?s.focusOpacity!:.18)),radius:Math.max(1,Math.min(3,Number.isFinite(s.focusRadius)?s.focusRadius!:1.2)),retained:Math.max(.02,Math.min(.8,Number.isFinite(s.focusRetained)?s.focusRetained!:.12))};}
const smooth=(x:number)=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
/** Sphere follows the CURRENT transformed island, not source center or future UV.
 * Both active islands in a handoff are protected; endpoints leave no stale bubble. */
export function playbackFocusSpheres(data:UnfoldGeometry,positions:Float32Array,o:UnfoldOptions&FocusSettings,modelScale:number):FocusSphere[]{
 const s=focusSettings(o);if(s.mode!=='dither'||o.interactionActive!==true)return [];
 const schedule=sampleUnfoldSchedule(o.progress,o.selected.length,o.order,o.handoff,false,o.timeline);
 return schedule.active.slice(0,2).map(a=>{
  const id=o.selected[a.index]!,island=data.islands.find(i=>i.id===id)!;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const fi of island.faces)for(let k=0;k<9;k++){const v=positions[fi*9+k]!;lo[k%3]=Math.min(lo[k%3]!,v);hi[k%3]=Math.max(hi[k%3]!,v);}
  const center=lo.map((n,i)=>(n+hi[i]!)*.5) as [number,number,number];let radius=0;
  for(const fi of island.faces)for(let k=0;k<9;k+=3)radius=Math.max(radius,Math.hypot(positions[fi*9+k]!-center[0],positions[fi*9+k+1]!-center[1],positions[fi*9+k+2]!-center[2]));
  return{id,center,radius:Math.max(radius,modelScale*.02)*s.radius,strength:smooth(a.progress/.035)*smooth((1-a.progress)/.035)};
 });
}
/** Pure counterpart for policy tests. Effects are per-fragment, never whole-island. */
export function focusVisibility(point:readonly number[],id:number,spheres:readonly FocusSphere[],retained:number):number{
 if(spheres.some(s=>s.id===id))return 1;let influence=0;
 for(const s of spheres){const d=Math.hypot(point[0]!-s.center[0],point[1]!-s.center[1],point[2]!-s.center[2]);influence=Math.max(influence,(1-smooth((d/s.radius-.75)/.25))*s.strength);}
 return 1-influence*(1-retained);
}
export const FOCUS_GLSL=`
uniform int focusCount;
uniform vec4 focusSpheres[2];
uniform ivec2 focusIDs;
uniform vec2 focusStrength;
uniform float focusRetained;
float focusVisibility(vec3 p,float chart){
  if(focusCount==0)return 1.0;
  if(chart==float(focusIDs.x)||(focusCount>1&&chart==float(focusIDs.y)))return 1.0;
  float weight=0.0;
  for(int i=0;i<2;i++){if(i>=focusCount)break;vec4 s=focusSpheres[i];float a=1.0-smoothstep(.75,1.0,length(p-s.xyz)/s.w);weight=max(weight,a*focusStrength[i]);}
  return mix(1.0,focusRetained,weight);
}
// Ordered, screen-stable 4x4 dither. Discarded samples do NOT write depth.
float focusThreshold(vec2 pixel){
  ivec2 p=ivec2(floor(pixel))%4;
  const float b[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (b[p.y*4+p.x]+.5)/16.;
}
`;
export function uploadFocusUniforms(gl:WebGL2RenderingContext,program:WebGLProgram,spheres:readonly FocusSphere[],retained:number){
 const data=new Float32Array(8),ids=new Int32Array([-1,-1]),strength=new Float32Array(2);
 spheres.slice(0,2).forEach((s,i)=>{data.set([...s.center,s.radius],i*4);ids[i]=s.id;strength[i]=s.strength;});
 const u=(name:string)=>gl.getUniformLocation(program,name);
 gl.uniform1i(u('focusCount'),Math.min(2,spheres.length));gl.uniform4fv(u('focusSpheres[0]'),data);gl.uniform2iv(u('focusIDs'),ids);gl.uniform2fv(u('focusStrength'),strength);gl.uniform1f(u('focusRetained'),retained);
}

/** Null means restore the caller's exact context/selection display. Both relay
 * entries stay opaque until their entire local timeline reaches its endpoint. */
export function playbackEmphasis(o:UnfoldOptions&FocusSettings):number[]|null {
  if(o.interactionActive!==true||focusSettings(o).mode!=='ghost')return null;
  const schedule=sampleUnfoldSchedule(o.progress,o.selected.length,o.order,o.handoff,false,o.timeline);
  const ids=schedule.active.map(a=>o.selected[a.index]!).filter(id=>id!==undefined);
  return ids.length?ids:null;
}
