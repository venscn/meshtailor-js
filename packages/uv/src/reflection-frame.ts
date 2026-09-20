import type {MeshData,Vec3} from '@meshtailor/mesh-core';
/** Exact surface moments. Vertex-sampled covariance depends on a quad's
 * diagonal and may tilt the reflection plane of a perfectly symmetric grid. */
export function reflectionFrames(mesh:MeshData,faces:readonly number[]){
 const entries=faces.map(f=>{const p=mesh.faces[f]!.vertices.map(v=>mesh.positions[v]!),u=p[1]!.map((x,k)=>x-p[0]![k]!),v=p[2]!.map((x,k)=>x-p[0]![k]!),area=Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!)/2;return{p,area};}),total=entries.reduce((s,e)=>s+e.area,0);
 if(!(total>0))return[];const center=[0,1,2].map(k=>entries.reduce((s,e)=>s+e.area*e.p.reduce((t,p)=>t+p[k]!/3,0),0)/total) as Vec3;
 const m=Array.from({length:3},()=>[0,0,0]),v=[[1,0,0],[0,1,0],[0,0,1]];
 for(const e of entries){const p=e.p.map(q=>q.map((x,k)=>x-center[k]!)),sum=[0,1,2].map(k=>p.reduce((s,q)=>s+q[k]!,0));for(let a=0;a<3;a++)for(let b=0;b<3;b++)m[a]![b]!+=e.area*(p.reduce((s,q)=>s+q[a]!*q[b]!,0)+sum[a]!*sum[b]!)/(12*total);}
 for(let it=0;it<32;it++){let a=0,b=1;for(const[i,j]of[[0,1],[0,2],[1,2]])if(Math.abs(m[i!]![j!]!)>Math.abs(m[a]![b]!)){a=i!;b=j!;}if(Math.abs(m[a]![b]!)<1e-14*Math.max(1e-30,m[0]![0]!+m[1]![1]!+m[2]![2]!))break;
  const theta=.5*Math.atan2(2*m[a]![b]!,m[b]![b]!-m[a]![a]!),c=Math.cos(theta),s=Math.sin(theta),aa=m[a]![a]!,bb=m[b]![b]!,ab=m[a]![b]!;
  for(let k=0;k<3;k++)if(k!==a&&k!==b){const x=m[k]![a]!,y=m[k]![b]!;m[k]![a]=m[a]![k]=c*x-s*y;m[k]![b]=m[b]![k]=s*x+c*y;}
  m[a]![a]=c*c*aa-2*s*c*ab+s*s*bb;m[b]![b]=s*s*aa+2*s*c*ab+c*c*bb;m[a]![b]=m[b]![a]=0;
  for(let k=0;k<3;k++){const x=v[k]![a]!,y=v[k]![b]!;v[k]![a]=c*x-s*y;v[k]![b]=s*x+c*y;}
 }
 return[0,1,2].sort((a,b)=>m[b]![b]!-m[a]![a]!).map(i=>({origin:center,normal:v.map(row=>row[i]!) as Vec3}));
}
