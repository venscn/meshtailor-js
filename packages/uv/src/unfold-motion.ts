import { separationOffset } from './presentation.js';
import { hingeLayout } from './hinge.js';
import { createMotionProfile, createMotionTimeline, type MotionSegment, type MotionTimeline } from './motion-timing.js';
import { unfoldHandoff } from './unfold-schedule.js';
import type { UnfoldGeometry, UnfoldOptions, UnfoldIsland } from './unfold.js';

export const DEFAULT_SKIP_STATIC = true;
/** Tolerance is in display-normalized world units, not screen pixels. Camera
 * motion, occlusion and symmetric-looking silhouettes never affect detection. */
export const DEFAULT_MOTION_RELATIVE_EPSILON = 1e-6;
export const DEFAULT_MOTION_ABSOLUTE_EPSILON = 1e-8;
export interface MotionAnalysisOptions {
  skipStatic?: boolean; relativeEpsilon?: number; absoluteEpsilon?: number;
}
type Span=Omit<MotionSegment,'start'|'end'>;
const norm=(x:ArrayLike<number>)=>Math.hypot(x[0]!,x[1]!,x[2]!);
function maxDelta(island:UnfoldIsland,delta:(i:number,a:number)=>number):number{
  let max=0;
  for(const fi of island.faces)for(let k=0;k<3;k++){const i=fi*9+k*3;max=Math.max(max,Math.hypot(delta(i,0),delta(i,1),delta(i,2)));}
  return max;
}
/** Analyze known transformations, not just equality of first/last frames.
 * Affine interpolation is bounded by its endpoint displacement. Orientation
 * is one axis-angle turn in [0,pi]. Hinge supports are derived from every joint's
 * actual rotation schedule, so an out-and-back motion is NEVER dropped merely
 * because its end positions happen to match its start positions. O(face corners). */
export function buildMotionTimeline(g:UnfoldGeometry,options:Omit<UnfoldOptions,'progress'>,analysis:MotionAnalysisOptions={}):MotionTimeline {
  const relative=analysis.relativeEpsilon??DEFAULT_MOTION_RELATIVE_EPSILON,absolute=analysis.absoluteEpsilon??DEFAULT_MOTION_ABSOLUTE_EPSILON;
  if(!Number.isFinite(relative)||!Number.isFinite(absolute)||relative<0||absolute<0)throw new Error('Motion tolerances must be finite and nonnegative.');
  if(!Number.isFinite(options.separation)||options.separation<0)throw new Error('Invalid motion separation.');
  const skip=analysis.skipStatic??DEFAULT_SKIP_STATIC,byID=new Map(g.islands.map(i=>[i.id,i])),ids=[...new Set(options.selected)].filter(id=>byID.has(id));
  const layout=options.path==='hinge'?hingeLayout(g,ids,options.separation):new Map<number,number[]>();
  const rigs=new Map(g.hinge?.islands.map(i=>[i.id,i])??[]);
  const profiles=ids.map(id=>{
    const island=byID.get(id)!,rig=rigs.get(id);
    const radius=rig?.radius??maxDelta(island,(i,a)=>g.source[i+a]!-island.sourceCenter[a]!);
    const epsilon=absolute+relative*Math.max(radius,1e-12),spans:Span[]=[];
    const add=(from:number,to:number,stage:string,moving:boolean,reason='无几何变化')=>spans.push({from,to,stage,keep:!skip||moving,reason:moving?undefined:reason});
    if(options.path==='hinge'){
      if(!rig||!g.hinge)throw new Error('Missing hinge data for motion analysis.');
      const center=layout.get(id)!;
      add(0,.18,'分离',Math.hypot(...island.sourceCenter.map((x,a)=>x-center[a]!))>epsilon);
      // Maximum vertex displacement under one fixed-axis rotation (angle <= pi).
      const angle=rig.turnAngle,axis=rig.turnAxis;
      const displacement=maxDelta(island,(i,a)=>{
        const p=[0,1,2].map(k=>g.source[i+k]!-island.sourceCenter[k]!);
        const dot=p[0]!*axis[0]+p[1]!*axis[1]+p[2]!*axis[2];
        // 2*sin(angle/2)*distance to axis bounds the full turn, even for points on the axis.
        return (p[a]!-dot*axis[a]!)*2*Math.sin(angle/2);
      });
      add(.18,.28,'转向',displacement>epsilon);
      // Conservatively bound tiny joint rotations by total path length. A joint
      // contributes on [depth*.6/1.6, (1+depth*.6)/1.6] in wave mode. Recentring
      // itself can move a flat island, so it also counts as hinge-stage motion.
      const angles=rig.order.filter(fi=>g.hinge!.parent[fi]!>=0&&g.hinge!.angle[fi]!==0);
      const budget=angles.reduce((s,fi)=>s+Math.abs(g.hinge!.angle[fi]!),0)*Math.max(radius*4,1e-12)*(rig.order.length+1);
      if(norm(rig.netCenter)>epsilon){add(.28,.7,'铰链',true);}
      else if(budget<=epsilon){add(.28,.7,'铰链',false);}
      else if(options.hingeWave===false){add(.28,.7,'铰链',true);}
      else{
        const windows=angles.map(fi=>{
          const d=g.hinge!.depth[fi]!/Math.max(1,rig.maxDepth)*.6;
          return [Math.max(0,d/1.6),Math.min(1,(1+d)/1.6)] as [number,number];
        }).sort((a,b)=>a[0]-b[0]);
        const merged:[number,number][]=[];
        for(const w of windows){const last=merged.at(-1);if(last&&w[0]<=last[1]+1e-12)last[1]=Math.max(last[1],w[1]);else merged.push([...w]);}
        let cursor=0;for(const [a,b]of merged){if(a>cursor+1e-12)add(.28+.42*cursor,.28+.42*a,'铰链等待',false);add(.28+.42*a,.28+.42*b,'铰链',true);cursor=b;}
        if(cursor<1-1e-12)add(.28+.42*cursor,.7,'铰链等待',false);
      }
      // Explicit pedagogical hold wins over automatic pruning. With hold off it
      // is removed even in diagnostic fixed-time mode, matching v0.4.3.
      spans.push({from:.7,to:.8,stage:'主动观察停留',keep:options.holdNet===true,reason:'用户设置的观察停留'});
      const fit=maxDelta(island,(i,a)=>(g.target[i+a]!-island.targetCenter[a]!)*rig.uvScale-g.hinge!.flat[i+a]!);
      add(.8,.92,'UV 形变',fit>epsilon);
      const pack=maxDelta(island,(i,a)=>g.target[i+a]!-((g.target[i+a]!-island.targetCenter[a]!)*rig.uvScale+center[a]!));
      add(.92,1,'排布',pack>epsilon);
    }else if(options.path==='staged'){
      add(0,.2,'分离',norm(separationOffset(island,options.separation))>epsilon);
      add(.2,.8,'展平',maxDelta(island,(i,a)=>g.target[i+a]!-island.targetCenter[a]!+island.sourceCenter[a]!-g.source[i+a]!)>epsilon);
      add(.8,1,'排布',norm(island.targetCenter.map((x,a)=>x-island.sourceCenter[a]!-separationOffset(island,options.separation)[a]!))>epsilon);
    }else{
      add(0,1,'直接变换',maxDelta(island,(i,a)=>g.target[i+a]!-g.source[i+a]!)>epsilon);
    }
    return createMotionProfile(id,spans,options.path==='hinge'&&!options.holdNet?1/.9:1);
  });
  return createMotionTimeline(profiles,unfoldHandoff(options.order,options.handoff));
}
