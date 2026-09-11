import type { Vec3 } from '@meshtailor/mesh-core';
export interface OrbitCamera { yaw: number; pitch: number; distance: number; target: Vec3 }
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(v:Vec3):Vec3=>{const l=Math.hypot(...v);return v.map(x=>x/l) as Vec3;};
export function cameraBasis(c:OrbitCamera){
  const eye:Vec3=[c.target[0]+Math.sin(c.yaw)*Math.cos(c.pitch)*c.distance,c.target[1]+Math.sin(c.pitch)*c.distance,c.target[2]+Math.cos(c.yaw)*Math.cos(c.pitch)*c.distance];
  const forward=norm(sub(c.target,eye)),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
  return {eye,forward,right,up};
}
/** Column-major projection * view; FOV is the same 42 degrees as the traversal viewer. */
export function cameraMatrix(c:OrbitCamera,aspect:number):Float32Array{
  const {eye,forward:f,right:r,up:u}=cameraBasis(c),z=f.map(x=>-x) as Vec3;
  const view=[r[0],u[0],z[0],0,r[1],u[1],z[1],0,r[2],u[2],z[2],0,-dot(r,eye),-dot(u,eye),-dot(z,eye),1];
  const k=1/Math.tan(21*Math.PI/180),near=.005,far=Math.max(200,c.distance*20);
  const p=[k/aspect,0,0,0,0,k,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];
  const out=new Float32Array(16);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let i=0;i<4;i++)out[col*4+row]+=p[i*4+row]!*view[col*4+i]!;
  return out;
}
export function projectPoint(p:Vec3,m:Float32Array,width:number,height:number):[number,number,number]|null{
  const w=m[3]!*p[0]+m[7]!*p[1]+m[11]!*p[2]+m[15]!;
  if(w<=0)return null;
  const x=(m[0]!*p[0]+m[4]!*p[1]+m[8]!*p[2]+m[12]!)/w;
  const y=(m[1]!*p[0]+m[5]!*p[1]+m[9]!*p[2]+m[13]!)/w;
  const z=(m[2]!*p[0]+m[6]!*p[1]+m[10]!*p[2]+m[14]!)/w;
  return [(x+1)*width/2,(1-y)*height/2,z];
}
/** Double-sided nearest-triangle picking on the CURRENT (not the original) positions. */
export function pickFace(positions:Float32Array,c:OrbitCamera,aspect:number,xNdc:number,yNdc:number,allow:(face:number)=>boolean=()=>true):number|null{
  const b=cameraBasis(c),f=Math.tan(21*Math.PI/180);
  const ray=norm(b.forward.map((x,i)=>x+b.right[i]!*xNdc*f*aspect+b.up[i]!*yNdc*f) as Vec3);
  let best=Infinity,hit:number|null=null;
  for(let i=0;i<positions.length;i+=9){
    const fi=i/9;if(!allow(fi))continue;
    const a:Vec3=[positions[i]!,positions[i+1]!,positions[i+2]!];
    const e1:Vec3=[positions[i+3]!-a[0],positions[i+4]!-a[1],positions[i+5]!-a[2]];
    const e2:Vec3=[positions[i+6]!-a[0],positions[i+7]!-a[1],positions[i+8]!-a[2]];
    const p=cross(ray,e2),det=dot(e1,p);if(Math.abs(det)<1e-12)continue;
    const s=sub(b.eye,a),u=dot(s,p)/det;if(u<0||u>1)continue;
    const q=cross(s,e1),v=dot(ray,q)/det;if(v<0||u+v>1)continue;
    const distance=dot(e2,q)/det;if(distance>0&&distance<best){best=distance;hit=fi;}
  }
  return hit;
}
