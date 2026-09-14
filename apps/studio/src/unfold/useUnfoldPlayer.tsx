import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SEPARATION, buildMotionTimeline, motionLocal, DEFAULT_SKIP_STATIC, DEFAULT_MOTION_RELATIVE_EPSILON, DEFAULT_UNFOLD_ORDER, DEFAULT_HANDOFF, MIN_HANDOFF, unfoldDuration, sampleUnfoldSchedule, islandTimelineProgress, hingePlaybackProgress, advanceUnfoldPlayback, islandProgress, type UnfoldOrder, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
import type { UnfoldDisplay } from './webgl-view';
import { DEFAULT_AUTO_FRAME } from './camera-policy';
export type UnfoldScope='all'|'single'|'selected';
export function useUnfoldPlayer(snapshot:UVSnapshot|null){
  const [scope,setScope]=useState<UnfoldScope>('all'),[selection,setSelection]=useState<number[]>([]);
  const [order,setOrder]=useState<UnfoldOrder>(DEFAULT_UNFOLD_ORDER),[path,setPath]=useState<UnfoldPath>('hinge');
  const [handoff,setHandoff]=useState(DEFAULT_HANDOFF),[holdNet,setHoldNet]=useState(false);
  const [skipStatic,setSkipStatic]=useState(DEFAULT_SKIP_STATIC),[motionTolerance,setMotionTolerance]=useState(DEFAULT_MOTION_RELATIVE_EPSILON);
  const [inspectionIndex,setInspectionIndex]=useState<number|null>(null);
  const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[seconds,setSeconds]=useState(12);
  const [reverse,setReverse]=useState(false),[loop,setLoop]=useState(false),[separation,setSeparation]=useState(DEFAULT_SEPARATION);
  const [context,setContext]=useState<UnfoldDisplay['context']>('dim'),[checker,setChecker]=useState(false),[labels,setLabels]=useState(true);
  const [hingeWave,setHingeWave]=useState(true),[showHinges,setShowHinges]=useState(true),[showTemporaryCuts,setShowTemporaryCuts]=useState(true),[autoFrame,setAutoFrame]=useState(DEFAULT_AUTO_FRAME);
  const [focusFace,setFocusFace]=useState<number|null>(null);
  const [cameraCommand,setCameraCommand]=useState({kind:'orbit' as 'orbit'|'uv'|'current',key:0});
  const ref=useRef(0);ref.current=progress;
  const all=useMemo(()=>snapshot?.geometry.islands.map(c=>c.id)??[],[snapshot]);
  const active=useMemo(()=>scope==='all'?all:scope==='single'?[selection.find(id=>all.includes(id))??all[0]].filter((id):id is number=>id!==undefined):selection.filter(id=>all.includes(id)),[all,scope,selection]);
  const timeline=useMemo(()=>snapshot?buildMotionTimeline(snapshot.geometry,{selected:active,order,handoff,holdNet,path,separation,hingeWave},{skipStatic,relativeEpsilon:motionTolerance}):undefined,[snapshot,active,order,handoff,holdNet,path,separation,hingeWave,skipStatic,motionTolerance]);
  const nominalDuration=unfoldDuration(seconds,active.length,order,handoff);
  const duration=unfoldDuration(seconds,active.length,order,handoff,timeline);
  const schedule=sampleUnfoldSchedule(progress,active.length,order,handoff,reverse,timeline);
  const focusIndex=!playing&&inspectionIndex!==null&&inspectionIndex<active.length?inspectionIndex:schedule.focusIndex;
  const remaining=duration*(reverse?progress:1-progress);
  useEffect(()=>{setPlaying(false);setProgress(0);ref.current=0;setSelection(all.length?[all[0]!]:[]);setFocusFace(null);setInspectionIndex(null);},[snapshot]);
  useEffect(()=>{
    if(!playing||!snapshot||!active.length)return;
    let raf=0,last:number|null=null,live=true;
    const visibility=()=>{last=null;};
    const tick=(now:number)=>{
      if(!live)return;
      if(document.hidden){last=null;raf=requestAnimationFrame(tick);return;}
      const delta=last===null?0:Math.max(0,now-last);last=now;
      const next=advanceUnfoldPlayback(ref.current,delta,duration,reverse,loop);
      ref.current=next.progress;setProgress(next.progress);
      if(next.finished){setPlaying(false);return;}
      raf=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',visibility);
    raf=requestAnimationFrame(tick);return()=>{live=false;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);};
  },[playing,snapshot,active.length,duration,reverse,loop]);
  const seek=(value:number)=>{setPlaying(false);setInspectionIndex(null);const t=Math.max(0,Math.min(1,value));ref.current=t;setProgress(t);};
  const reset=()=>seek(0);
  const select=(id:number,face:number|null=null,additive=false)=>{
    if(!all.includes(id))return;reset();setFocusFace(face);
    if(additive){const base=scope==='all'?all:selection;setSelection(base.includes(id)?base.filter(x=>x!==id):[...base,id]);setScope('selected');}
    else{setScope('single');setSelection([id]);}
  };
  // Picking a face at 100% should NOT snap it back to 3D before it can be inspected.
  const pick=(id:number,face:number|null,additive:boolean)=>{
    const local=islandProgress(ref.current,active.indexOf(id),active.length,order,handoff,timeline);
    select(id,face,additive);
    if(!additive)seek(local);
  };
  const changeScope=(value:UnfoldScope)=>{reset();setScope(value);};
  const changeOrder=(value:UnfoldOrder)=>{reset();setOrder(value);};
  const changeHandoff=(value:number)=>{if(!Number.isFinite(value))return;reset();setHandoff(Math.max(MIN_HANDOFF,Math.min(1,value)));};
  const changeHoldNet=(value:boolean)=>{reset();setHoldNet(value);};
  const seekStage=(pose:number)=>{seek(islandTimelineProgress(timeline?.entries[focusIndex]?motionLocal(timeline.entries[focusIndex]!.profile,pose):hingePlaybackProgress(pose,holdNet),focusIndex,active.length,order,handoff,timeline));setInspectionIndex(focusIndex);};
  const seekQueue=(direction:number)=>{const i=Math.max(0,Math.min(active.length-1,focusIndex+direction));seek(islandTimelineProgress(reverse?1:0,i,active.length,order,handoff,timeline));setInspectionIndex(i);};
  const nextIsland=(direction:number)=>{const index=Math.max(0,all.indexOf(selection[0]??-1)),id=all[(index+direction+all.length)%all.length];if(id!==undefined)select(id);};
  const toggle=()=>{setInspectionIndex(null);if(!snapshot||!active.length)return;if(!playing&&(reverse?ref.current<=0:ref.current>=1)){ref.current=reverse?1:0;setProgress(ref.current);}setPlaying(x=>!x);};
  const fit=(kind:'orbit'|'uv'|'current')=>{setAutoFrame(false);setCameraCommand(c=>({kind,key:c.key+1}));};
  return {timeline,skipStatic,changeSkipStatic:(v:boolean)=>{reset();setSkipStatic(v);},motionTolerance,changeMotionTolerance:(v:number)=>{if(Number.isFinite(v)&&v>=0&&v<=.001){reset();setMotionTolerance(v);}},nominalDuration,handoff,changeHandoff,holdNet,changeHoldNet,schedule,focusIndex,remaining,seekStage,seekQueue,hingeWave,setHingeWave:(v:boolean)=>{reset();setHingeWave(v);},showHinges,setShowHinges,showTemporaryCuts,setShowTemporaryCuts,autoFrame,setAutoFrame,scope,selection,active,all,order,path,progress,playing,seconds,duration,reverse,loop,separation,context,checker,labels,focusFace,cameraCommand,
    select,pick,changeScope,changeOrder,nextIsland,seek,toggle,fit,pause:()=>setPlaying(false),setPath:(v:UnfoldPath)=>{reset();setPath(v);},setSeconds,setReverse,setLoop,setSeparation:(v:number)=>{reset();setSeparation(v);},setContext,setChecker,setLabels,
    clear:()=>{reset();setScope('selected');setSelection([]);setFocusFace(null);}};
}
export type UnfoldPlayer=ReturnType<typeof useUnfoldPlayer>;
