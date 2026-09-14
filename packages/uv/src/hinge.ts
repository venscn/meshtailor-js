import { triangleMorph, morphPoint } from './planar-morph.js';
import { motionPose } from './motion-timing.js';
import { islandProgress } from './unfold-schedule.js';
import { uvProgress, type UVWork } from './work.js';
import { buildTopology, edgeKey, type MeshData, type Vec3, type MeshTopology } from '@meshtailor/mesh-core';
import type { UnfoldGeometry, UnfoldOptions } from './unfold.js';

export interface HingeIsland {
  id:number; order:number[]; root:number; maxDepth:number;
  basis:Float64Array; turnAxis:Vec3; turnAngle:number;
  netCenter:Vec3; radius:number; uvScale:number;
  /** Atlas parity is a view orientation, never a destructive UV-coordinate edit. */
  targetOrientation:1|-1; mixedOrientation:boolean; rotationFit:boolean;
}
export interface HingeRig {
  parent:Int32Array; depth:Int32Array; edgeCorners:Int32Array; axis:Float64Array; pivot:Float64Array; angle:Float64Array;
  islands:HingeIsland[]; hingeEdges:Uint32Array; temporaryCuts:Uint32Array;
  /** Exact rigid triangle net before the separate UV distortion stage. */
  flat:Float32Array;
  /** Eight polar-fit coefficients per face; present only when required. */
  fitCoefficients?:Float64Array;
}
export const HINGE_STAGES=[
  {t:0,label:'原始 3D'}, {t:.18,label:'分块陈列'}, {t:.28,label:'转向观察'},
  {t:.70,label:'铰链展平'}, {t:.80,label:'检查平面网'}, {t:.92,label:'UV 形变'}, {t:1,label:'Atlas 排布'}
] as const;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Convert per-island clock progress to the existing geometric keyframes.
 * Removing the hold is continuous: poses at .70 and .80 are the same rigid net. */
export function hingePoseProgress(local:number,holdNet=false):number {
  const t=clamp(local);if(holdNet)return t;
  const moving=t*.9;return clamp(moving < .7 ? moving : moving+.1);
}
/** Inverse for stage buttons. Both edges of a skipped hold map to one instant. */
export function hingePlaybackProgress(pose:number,holdNet=false):number {
  const t=clamp(pose);return holdNet?t:clamp((t<=.7?t:t<.8?.7:t-.1)/.9);
}

/** One source of pose time for positions, angle labels and temporary cut lines. */
export function unfoldIslandPose(options:UnfoldOptions,index:number,count=options.selected.length):number {
  const local=islandProgress(options.progress,index,count,options.order,options.handoff,options.timeline);
  const entry=options.timeline?.entries[index];
  return entry?motionPose(entry.profile,local):options.path==='hinge'?hingePoseProgress(local,options.holdNet):local;
}

const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
const sub=(a:ArrayLike<number>,b:ArrayLike<number>):Vec3=>[a[0]!-b[0]!,a[1]!-b[1]!,a[2]!-b[2]!];
const cross=(a:ArrayLike<number>,b:ArrayLike<number>):Vec3=>[a[1]!*b[2]!-a[2]!*b[1]!,a[2]!*b[0]!-a[0]!*b[2]!,a[0]!*b[1]!-a[1]!*b[0]!];
const dot=(a:ArrayLike<number>,b:ArrayLike<number>)=>a[0]!*b[0]!+a[1]!*b[1]!+a[2]!*b[2]!;
const unit=(a:Vec3):Vec3=>{const l=Math.hypot(...a);return l>1e-15?a.map(x=>x/l) as Vec3:[1,0,0];};
const point=(positions:ArrayLike<number>,corner:number):Vec3=>[positions[corner*3]!,positions[corner*3+1]!,positions[corner*3+2]!];
const mv=(m:ArrayLike<number>,p:ArrayLike<number>):Vec3=>[dot(m,p),m[3]!*p[0]!+m[4]!*p[1]!+m[5]!*p[2]!,m[6]!*p[0]!+m[7]!*p[1]!+m[8]!*p[2]!];
const identity=()=>new Float64Array([1,0,0,0,1,0,0,0,1]);
function rotation(axis:ArrayLike<number>,angle:number):Float64Array{
  const [x,y,z]=[axis[0]!,axis[1]!,axis[2]!],c=Math.cos(angle),s=Math.sin(angle),v=1-c;
  return new Float64Array([x*x*v+c,x*y*v-z*s,x*z*v+y*s,y*x*v+z*s,y*y*v+c,y*z*v-x*s,z*x*v-y*s,z*y*v+x*s,z*z*v+c]);
}
function multiply(a:ArrayLike<number>,b:ArrayLike<number>):Float64Array{const out=new Float64Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)out[r*3+c]=a[r*3]!*b[c]!+a[r*3+1]!*b[3+c]!+a[r*3+2]!*b[6+c]!;return out;}
function axisAngle(m:ArrayLike<number>):{axis:Vec3;angle:number}{
  // Stable matrix -> quaternion branch, including exact 180-degree rotations.
  const tr=m[0]!+m[4]!+m[8]!;let w:number,x:number,y:number,z:number;
  if(tr>0){const s=Math.sqrt(tr+1)*2;w=s/4;x=(m[7]!-m[5]!)/s;y=(m[2]!-m[6]!)/s;z=(m[3]!-m[1]!)/s;}
  else if(m[0]!>m[4]!&&m[0]!>m[8]!){const s=Math.sqrt(1+m[0]!-m[4]!-m[8]!)*2;w=(m[7]!-m[5]!)/s;x=s/4;y=(m[1]!+m[3]!)/s;z=(m[2]!+m[6]!)/s;}
  else if(m[4]!>m[8]!){const s=Math.sqrt(1+m[4]!-m[0]!-m[8]!)*2;w=(m[2]!-m[6]!)/s;x=(m[1]!+m[3]!)/s;y=s/4;z=(m[5]!+m[7]!)/s;}
  else{const s=Math.sqrt(1+m[8]!-m[0]!-m[4]!)*2;w=(m[3]!-m[1]!)/s;x=(m[2]!+m[6]!)/s;y=(m[5]!+m[7]!)/s;z=s/4;}
  if(w<0){w=-w;x=-x;y=-y;z=-z;}return{axis:unit([x,y,z]),angle:2*Math.acos(Math.max(-1,Math.min(1,w)))};
}
const scratch=new WeakMap<HingeRig,Float64Array>();
/** Compose parent rigid transforms in O(F), rather than re-walking all ancestors
 * per corner. Kept seams stay joined exactly through the entire hinge phase. */
function treePose(g:UnfoldGeometry,rig:HingeRig,island:HingeIsland,fold:number,wave:boolean,out:Float32Array){
  let transforms=scratch.get(rig);if(!transforms){transforms=new Float64Array(g.faceChart.length*12);scratch.set(rig,transforms);}
  for(const fi of island.order){
    const offset=fi*12,parent=rig.parent[fi]!;let r=identity(),translation:Vec3=[0,0,0];
    if(parent>=0){
      const local=wave?smooth(fold*1.6-(rig.depth[fi]!/Math.max(1,island.maxDepth))*.6):smooth(fold);
      const rot=rotation(rig.axis.subarray(fi*3,fi*3+3),rig.angle[fi]!*local),pivot=rig.pivot.subarray(fi*3,fi*3+3),p=parent*12,pr=transforms.subarray(p,p+9);
      r=multiply(pr,rot);const shift=mv(pr,sub(pivot,mv(rot,pivot)));translation=[shift[0]+transforms[p+9]!,shift[1]+transforms[p+10]!,shift[2]+transforms[p+11]!];
    }
    transforms.set(r,offset);transforms.set(translation,offset+9);
    for(let k=0;k<3;k++){const p=mv(r,point(g.source,fi*3+k));for(let a=0;a<3;a++)out[fi*9+k*3+a]=p[a]!+translation[a]!;}
  }
}
export function buildHingeRig(mesh:MeshData,g:UnfoldGeometry,seams:ReadonlySet<string>,work?:UVWork,cachedTopology?:MeshTopology):HingeRig{
  const n=mesh.faces.length,parent=new Int32Array(n).fill(-2),depth=new Int32Array(n),axis=new Float64Array(n*3),pivot=new Float64Array(n*3),angle=new Float64Array(n),flat=new Float32Array(g.source.length);
  const edgeCorners=new Int32Array(n*2).fill(-1);
  uvProgress(work,{stage:'hinge',detail:'建立铰链邻接与展开树'});
  const topology=cachedTopology??buildTopology(mesh),adj:{face:number;a:number;b:number}[][]=Array.from({length:n},()=>[]);
  for(const [key,e]of topology.edges){if(e.faces.length!==2||seams.has(key))continue;const [a,b]=e.faces as [number,number];if(g.faceChart[a]!==g.faceChart[b])continue;adj[a]!.push({face:b,a:e.a,b:e.b});adj[b]!.push({face:a,a:e.a,b:e.b});}
  const normal=(fi:number)=>unit(cross(sub(point(g.source,fi*3+1),point(g.source,fi*3)),sub(point(g.source,fi*3+2),point(g.source,fi*3))));
  const islands:HingeIsland[]=[],hinges:number[]=[],kept=new Set<string>();
  for(const island of g.islands){
    work?.check();
    // Centermost triangle reduces propagation depth and makes the panel easy to inspect.
    const distance=(fi:number)=>{const c:Vec3=[0,0,0];for(let k=0;k<3;k++)for(let a=0;a<3;a++)c[a]+=g.source[fi*9+k*3+a]!/3;return Math.hypot(...sub(c,island.sourceCenter));};
    const root=island.faces.reduce((best,fi)=>distance(fi)<distance(best)?fi:best,island.faces[0]!),order=[root];parent[root]=-1;
    let maxDepth=0;
    for(let h=0;h<order.length;h++){
      if(h%256===0)work?.check();
      const fi=order[h]!;
      for(const edge of adj[fi]!){const child=edge.face;if(parent[child]!==-2)continue;parent[child]=fi;order.push(child);kept.add(edgeKey(fi,child));
        const f=mesh.faces[fi]!,a=fi*3+f.vertices.indexOf(edge.a),b=fi*3+f.vertices.indexOf(edge.b),A=point(g.source,a),B=point(g.source,b),ax=unit(sub(B,A)),np=normal(fi),nc=normal(child);
        edgeCorners.set([a,b],child*2);axis.set(ax,child*3);pivot.set(A,child*3);angle[child]=Math.atan2(dot(ax,cross(nc,np)),dot(nc,np));
        depth[child]=depth[fi]!+(Math.abs(angle[child]!)>.003?1:0);maxDepth=Math.max(maxDepth,depth[child]!);
        if(Math.abs(angle[child]!)>.003)hinges.push(a,b);
      }
    }
    // Source UVs with inconsistent connectivity may have several components under
    // one imported chart. Treat each disconnected root explicitly, never read junk transforms.
    for(const fi of island.faces)if(parent[fi]===-2){parent[fi]=-1;order.push(fi);}
    // A mirrored imported UV chart has opposite winding. A 2D SO(2) fit cannot
    // align it: blending then collapses the chart and turns it inside out at .86.
    // Orient its *rigid* net to the atlas parity first, using a proper 3D rotation
    // (reverse both V and the normal, determinant +1), not a reflection/UV edit.
    let signed=0,positive=false,negative=false;
    for(const fi of island.faces){const a=point(g.target,fi*3),b=point(g.target,fi*3+1),c=point(g.target,fi*3+2);
      const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);signed+=area;positive ||= area>1e-12;negative ||= area< -1e-12;}
    const targetOrientation:1|-1=signed<0?-1:1;
    const origin=point(g.source,root*3),u=unit(sub(point(g.source,root*3+1),origin)),normalRoot=normal(root);
    const v=cross(normalRoot,u).map(x=>x*targetOrientation),n=normalRoot.map(x=>x*targetOrientation);
    const basis=new Float64Array([...u,...v,...n]),turn=axisAngle(basis);
    const item:HingeIsland={id:island.id,order,root,maxDepth,basis,turnAxis:turn.axis,turnAngle:turn.angle,netCenter:[0,0,0],radius:0,uvScale:1,targetOrientation,mixedOrientation:positive&&negative,rotationFit:false};islands.push(item);
  }
  const rig:HingeRig={parent,depth,edgeCorners,axis,pivot,angle,islands,hingeEdges:new Uint32Array(hinges),temporaryCuts:new Uint32Array(),flat};
  const pose=new Float32Array(g.source.length);
  const sourceIslands=new Map(g.islands.map(i=>[i.id,i]));let done=0;
  for(const item of islands){
    uvProgress(work,{stage:'hinge',detail:'构建刚性平面网和临时断边',current:++done,total:islands.length,unit:'岛'});
    const source=sourceIslands.get(item.id)!;treePose(g,rig,item,1,false,pose);
    const netCenter:Vec3=[0,0,0];for(const fi of item.order)for(let k=0;k<3;k++){const p=mv(item.basis,sub(point(pose,fi*3+k),source.sourceCenter));for(let a=0;a<3;a++)netCenter[a]+=p[a]!/(item.order.length*3);}
    // Align the rigid net with target UV by a single least-squares in-plane rotation.
    let dp=0,cp=0,areaSource=0,areaUV=0;
    for(const fi of item.order){
      const s=[0,1,2].map(k=>point(g.source,fi*3+k)),t=[0,1,2].map(k=>point(g.target,fi*3+k));
      areaSource+=Math.hypot(...cross(sub(s[1]!,s[0]!),sub(s[2]!,s[0]!)))*.5;areaUV+=Math.hypot(...cross(sub(t[1]!,t[0]!),sub(t[2]!,t[0]!)))*.5;
      for(let k=0;k<3;k++){const p=sub(mv(item.basis,sub(point(pose,fi*3+k),source.sourceCenter)),netCenter),q=sub(point(g.target,fi*3+k),source.targetCenter);dp+=p[0]*q[0]+p[1]*q[1];cp+=p[0]*q[1]-p[1]*q[0];}
    }
    const alignment=rotation([0,0,1],Math.atan2(cp,dp));item.basis=multiply(alignment,item.basis);item.netCenter=mv(alignment,netCenter);
    const turn=axisAngle(item.basis);item.turnAxis=turn.axis;item.turnAngle=turn.angle;item.uvScale=areaUV>1e-20?Math.sqrt(areaSource/areaUV):1;
    for(const fi of item.order)for(let k=0;k<3;k++){
      const p=sub(mv(item.basis,sub(point(pose,fi*3+k),source.sourceCenter)),item.netCenter),q=sub(point(g.target,fi*3+k),source.targetCenter);
      flat.set(p,fi*9+k*3);item.radius=Math.max(item.radius,Math.hypot(...p),Math.hypot(...q)*item.uvScale,Math.hypot(...sub(point(g.source,fi*3+k),source.sourceCenter)));
    }
  }
  // Inspect the entire affine path analytically, not just its endpoints. When
  // any triangle would cross zero area, use positive-Jacobian polar fitting for
  // that island. Extra moving cracks are explicitly displayed below.
  for(const item of islands){
    const source=sourceIslands.get(item.id)!,fits:ReturnType<typeof triangleMorph>[]=[];let unsafe=false;
    for(const fi of item.order){
      const p=[0,1,2].map(k=>[flat[fi*9+k*3]!,flat[fi*9+k*3+1]!] as [number,number]);
      const q=[0,1,2].map(k=>[(g.target[fi*9+k*3]!-source.targetCenter[0])*item.uvScale,(g.target[fi*9+k*3+1]!-source.targetCenter[1])*item.uvScale] as [number,number]);
      const fit=triangleMorph(p,q);fits.push(fit);unsafe ||= fit?.unsafeLinear??false;
    }
    if(unsafe&&fits.every(f=>f!==null)){
      item.rotationFit=true;rig.fitCoefficients??=new Float64Array(n*8);
      item.order.forEach((fi,i)=>rig.fitCoefficients!.set(fits[i]!.coefficients,fi*8));
    }
  }
  const fitMid=new Float32Array(flat);
  for(const item of islands)if(item.rotationFit)for(const fi of item.order)for(let k=0;k<3;k++){
    const i=fi*9+k*3,p=morphPoint(flat[i]!,flat[i+1]!,rig.fitCoefficients!,fi*8,.5);fitMid[i]=p[0];fitMid[i+1]=p[1];
  }
  // Only expose non-tree edges that actually separate; coplanar cycles do not need
  // fake cracks. These are ANIMATION-ONLY cuts and are not exported as UV seams.
  const temporary:number[]=[];
  for(const [key,e]of topology.edges){if(e.faces.length!==2||seams.has(key))continue;const [a,b]=e.faces as [number,number];if(g.faceChart[a]!==g.faceChart[b])continue;
    const ca=mesh.faces[a]!.vertices.indexOf(e.a),cb=mesh.faces[b]!.vertices.indexOf(e.a),da=mesh.faces[a]!.vertices.indexOf(e.b),db=mesh.faces[b]!.vertices.indexOf(e.b);
    if(Math.hypot(...sub(point(flat,a*3+ca),point(flat,b*3+cb)))>1e-5||Math.hypot(...sub(point(flat,a*3+da),point(flat,b*3+db)))>1e-5||Math.hypot(...sub(point(fitMid,a*3+ca),point(fitMid,b*3+cb)))>1e-5||Math.hypot(...sub(point(fitMid,a*3+da),point(fitMid,b*3+db)))>1e-5)temporary.push(a*3+ca,a*3+da,b*3+cb,b*3+db);
  }
  rig.temporaryCuts=new Uint32Array(temporary);scratch.delete(rig);return rig;
}
export function hingeLayout(g:UnfoldGeometry,selected:readonly number[],gap:number):Map<number,Vec3>{
  const rig=g.hinge;if(!rig)return new Map();const set=new Set(selected),items=rig.islands.filter(i=>set.has(i.id));
  const cols=Math.max(1,Math.ceil(Math.sqrt(items.length))),rows=Math.ceil(items.length/cols),radius=Math.max(.15,...items.map(i=>i.radius)),step=radius*2+gap+.2;
  return new Map(selected.map((id,i)=>[id,[(i%cols-(cols-1)/2)*step,((rows-1)/2-Math.floor(i/cols))*step,0] as Vec3]));
}
/** 0–18 isolate; 18–28 orient; 28–70 edge-axis rigid hinge rotations;
 * 70–80 hold true net; 80–92 explicitly non-rigid UV fit; 92–100 pack.
 * Not a collision solver. Curved closed cycles open only in the teaching rig. */
export function writeHingePositions(g:UnfoldGeometry,options:UnfoldOptions,ids:readonly number[],out:Float32Array):Float32Array{
  const rig=g.hinge;if(!rig)throw new Error('Missing hinge rig. Recompute UV snapshot.');
  const layout=hingeLayout(g,ids,options.separation),ranks=new Map(ids.map((id,i)=>[id,i]));
  out.set(g.source);
  const sourceIslands=new Map(g.islands.map(i=>[i.id,i]));
  for(const item of rig.islands){const rank=ranks.get(item.id);if(rank===undefined)continue;
    const t=unfoldIslandPose(options,rank,ids.length),island=sourceIslands.get(item.id)!,center=layout.get(item.id)!;
    if(t===0)continue;if(t===1){for(const fi of item.order)out.set(g.target.subarray(fi*9,fi*9+9),fi*9);continue;}
    if(t<.8){
      const fold=clamp((t-.28)/.42),orient=smooth((t-.18)/.10),move=smooth(t/.18),r=rotation(item.turnAxis,item.turnAngle*orient),displacement:Vec3=island.sourceCenter.map((v,a)=>v+(center[a]!-v)*move) as Vec3;
      treePose(g,rig,item,fold,options.hingeWave!==false,out);
      for(const fi of item.order)for(let k=0;k<3;k++){const p=mv(r,sub(point(out,fi*3+k),island.sourceCenter));for(let a=0;a<3;a++)out[fi*9+k*3+a]=p[a]!-item.netCenter[a]!*smooth(fold)+displacement[a]!;}
    }else{
      const fit=smooth((t-.8)/.12),pack=smooth((t-.92)/.08);
      for(const fi of item.order)for(let corner=0;corner<3;corner++){
        const base=fi*9+corner*3,xy=item.rotationFit&&fit>0&&fit<1?morphPoint(rig.flat[base]!,rig.flat[base+1]!,rig.fitCoefficients!,fi*8,fit):null;
        for(let a=0;a<3;a++){const i=base+a,d=g.target[i]!,targetLocal=(d-island.targetCenter[a]!)*item.uvScale;
          const local=xy&&a<2?xy[a]!:rig.flat[i]!+(targetLocal-rig.flat[i]!)*fit,work=local+center[a]!;out[i]=work+(d-work)*pack;
        }
      }
    }
  }
  return out;
}

/** Remaining signed dihedral at a displayed hinge, for the on-screen angle label. */
export function hingeRemainingAngle(g:UnfoldGeometry,options:UnfoldOptions,fi:number):number {
  const rig=g.hinge;if(!rig)return 0;const id=g.faceChart[fi]!,index=options.selected.indexOf(id),island=rig.islands.find(i=>i.id===id);if(index<0||!island)return rig.angle[fi]!;
  const t=unfoldIslandPose(options,index),fold=clamp((t-.28)/.42);
  const local=options.hingeWave===false?smooth(fold):smooth(fold*1.6-rig.depth[fi]!/Math.max(1,island.maxDepth)*.6);
  return rig.angle[fi]!*(1-local);
}
