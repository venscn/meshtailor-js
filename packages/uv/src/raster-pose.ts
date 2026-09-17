import type {Vec2} from '@meshtailor/mesh-core';
import {quarterTurnPoint} from './shape-raster.js';
export interface ShapePose {triangles:[Vec2,Vec2,Vec2][];width:number;height:number;point:(p:Vec2)=>Vec2;angle:number}
/** A proper rotation of actual triangles, not their bounding rectangles. */
export function shapePose(triangles:readonly [Vec2,Vec2,Vec2][],width:number,height:number,degrees:number):ShapePose {
  const angle=((degrees%360)+360)%360;
  if(angle%90===0){const t=angle/90,point=(p:Vec2)=>quarterTurnPoint(p,width,height,t);return{triangles:triangles.map(t=>t.map(point) as [Vec2,Vec2,Vec2]),width:t%2?height:width,height:t%2?width:height,point,angle};}
  const c=Math.cos(angle*Math.PI/180),s=Math.sin(angle*Math.PI/180);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const t of triangles)for(const[x,y]of t){const u=c*x-s*y,v=s*x+c*y;x0=Math.min(x0,u);x1=Math.max(x1,u);y0=Math.min(y0,v);y1=Math.max(y1,v);}
  const point=([x,y]:Vec2):Vec2=>[c*x-s*y-x0,s*x+c*y-y0];
  return{triangles:triangles.map(t=>t.map(point) as [Vec2,Vec2,Vec2]),width:x1-x0,height:y1-y0,point,angle};
}
