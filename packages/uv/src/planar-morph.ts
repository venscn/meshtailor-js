import type { Vec2 } from '@meshtailor/mesh-core';
/** R(t theta) ((1-t) I + t S), with S positive definite, keeps the
 * triangle Jacobian's sign. Used only in the explicitly non-rigid UV-fit phase.
 * Independent element interpolation may open temporary visualization cracks;
 * it is not a conforming mesh deformation or a collision solver. */
export function triangleMorph(p:readonly Vec2[],q:readonly Vec2[]):{coefficients:number[];unsafeLinear:boolean}|null {
  const a=p[1]![0]-p[0]![0],b=p[2]![0]-p[0]![0],c=p[1]![1]-p[0]![1],d=p[2]![1]-p[0]![1],det=a*d-b*c;
  const A=q[1]![0]-q[0]![0],B=q[2]![0]-q[0]![0],C=q[1]![1]-q[0]![1],D=q[2]![1]-q[0]![1];
  if(Math.abs(det)<1e-24)return null;
  const f00=(A*d-B*c)/det,f01=(-A*b+B*a)/det,f10=(C*d-D*c)/det,f11=(-C*b+D*a)/det,detF=f00*f11-f01*f10;
  if(!(detF>0&&Number.isFinite(detF)))return null;
  const angle=Math.atan2(f10-f01,f00+f11),co=Math.cos(angle),si=Math.sin(angle),s00=co*f00+si*f10,s11=-si*f01+co*f11,s01=((co*f01+si*f11)+(-si*f00+co*f10))*.5;
  if(!(s00>0&&s11>0&&s00*s11>s01*s01))return null;
  const trace=f00+f11,qa=detF-trace+1,qb=trace-2,mid=qa>0?Math.max(0,Math.min(1,-qb/(2*qa))):0,min=Math.min(1,detF,qa*mid*mid+qb*mid+1);
  return {coefficients:[(p[0]![0]+p[1]![0]+p[2]![0])/3,(p[0]![1]+p[1]![1]+p[2]![1])/3,(q[0]![0]+q[1]![0]+q[2]![0])/3,(q[0]![1]+q[1]![1]+q[2]![1])/3,angle,s00,s01,s11],unsafeLinear:min<1e-5*Math.max(1,detF)};
}
export function morphPoint(x:number,y:number,c:ArrayLike<number>,offset:number,t:number):Vec2 {
  const px=c[offset]!,py=c[offset+1]!,dx=x-px,dy=y-py,angle=c[offset+4]!*t,co=Math.cos(angle),si=Math.sin(angle);
  const X=(1-t+t*c[offset+5]!)*dx+t*c[offset+6]!*dy,Y=t*c[offset+6]!*dx+(1-t+t*c[offset+7]!)*dy;
  return[co*X-si*Y+px+(c[offset+2]!-px)*t,si*X+co*Y+py+(c[offset+3]!-py)*t];
}
