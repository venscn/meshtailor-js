import type {Vec2,Vec3} from '@meshtailor/mesh-core';
import type {CutMesh} from './cut-topology.js';
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
/** Surface-weighted principal directions. These only provide candidate seeds;
 * folded/occluded projections MUST be rejected, not published or cut blindly. */
export function projectionSeeds(mesh:CutMesh):Vec2[][]{
  const center:Vec3=[0,0,0],normal:Vec3=[0,0,0],weights=new Float64Array(mesh.positions.length);let total=0;
  for(const t of mesh.triangles){const[a,b,c]=t.map(v=>mesh.positions[v]!) as [Vec3,Vec3,Vec3],n=cross(b.map((x,k)=>x-a[k]!) as Vec3,c.map((x,k)=>x-a[k]!) as Vec3),w=Math.hypot(...n);for(const v of t)weights[v]+=w/3;total+=w;for(let k=0;k<3;k++)normal[k]!+=n[k]!;}
  if(!(total>0))return[];
  mesh.positions.forEach((p,i)=>{for(let k=0;k<3;k++)center[k]!+=p[k]!*weights[i]!/total;});
  const m=Array.from({length:3},()=>[0,0,0]),v=[[1,0,0],[0,1,0],[0,0,1]];
  mesh.positions.forEach((p,i)=>{for(let a=0;a<3;a++)for(let b=0;b<3;b++)m[a]![b]!+=(p[a]!-center[a]!)*(p[b]!-center[b]!)*weights[i]!/total;});
  for(let iter=0;iter<24;iter++){let a=0,b=1;for(const [i,j]of [[0,1],[0,2],[1,2]])if(Math.abs(m[i!]![j!]!)>Math.abs(m[a]![b]!)){a=i!;b=j!;}if(Math.abs(m[a]![b]!)<1e-18)break;
    const theta=.5*Math.atan2(2*m[a]![b]!,m[b]![b]!-m[a]![a]!),c=Math.cos(theta),s=Math.sin(theta),aa=m[a]![a]!,bb=m[b]![b]!,ab=m[a]![b]!;
    for(let k=0;k<3;k++)if(k!==a&&k!==b){const x=m[k]![a]!,y=m[k]![b]!;m[k]![a]=m[a]![k]=c*x-s*y;m[k]![b]=m[b]![k]=s*x+c*y;}
    m[a]![a]=c*c*aa-2*s*c*ab+s*s*bb;m[b]![b]=s*s*aa+2*s*c*ab+c*c*bb;m[a]![b]=m[b]![a]=0;
    for(let k=0;k<3;k++){const x=v[k]![a]!,y=v[k]![b]!;v[k]![a]=c*x-s*y;v[k]![b]=s*x+c*y;}
  }
  const axes=[0,1,2].sort((a,b)=>m[b]![b]!-m[a]![a]!).map(i=>v.map(r=>r[i]!) as Vec3);
  const normals:Vec3[]=[normal,...axes],result:Vec2[][]=[];
  for(const n0 of normals){const nl=Math.hypot(...n0);if(nl<1e-12)continue;const n=n0.map(x=>x/nl) as Vec3,ref=axes.reduce((a,b)=>Math.abs(dot(a,n))<Math.abs(dot(b,n))?a:b),u0=cross(ref,n),ul=Math.hypot(...u0);if(ul<1e-12)continue;const u=u0.map(x=>x/ul) as Vec3,w=cross(n,u);
    result.push(mesh.positions.map(p=>{const d=p.map((x,k)=>x-center[k]!) as Vec3;return[dot(d,u),dot(d,w)];}));
  }return result;
}
