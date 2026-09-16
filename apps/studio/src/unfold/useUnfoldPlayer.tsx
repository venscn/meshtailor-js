import { useEffect, useMemo, useRef, useState } from 'react';
import { areaOrderedIslands, validPlaybackRate, DEFAULT_SEPARATION, buildMotionTimeline, motionLocal, DEFAULT_SKIP_STATIC, DEFAULT_MOTION_RELATIVE_EPSILON, DEFAULT_UNFOLD_ORDER, DEFAULT_HANDOFF, MIN_HANDOFF, unfoldDuration, sampleUnfoldSchedule, islandTimelineProgress, hingePlaybackProgress, advanceUnfoldPlayback, islandProgress, type UnfoldOrder, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
import type { UnfoldDisplay } from './webgl-view';
import { DEFAULT_AUTO_FRAME } from './camera-policy';
import { DEFAULT_OVERLAP_MODE, DEFAULT_OVERLAP_TOLERANCE, DEFAULT_OVERLAP_OPACITY, type OverlapMode } from './overlap-policy';
import { applyBoxSelection, type BoxMode } from './uv-box-selection';
import { EMPTY_INSPECTION, selectInspectionIsland, resolveInspectionPick, type InspectionSelection } from './selection-policy';
export type UnfoldScope='all'|'single'|'selected';
export function useUnfoldPlayer(snapshot:UVSnapshot|null){
  const [scope,setScope]=useState<UnfoldScope>('all'),[selection,setSelection]=useState<number[]>([]);
  const [order,setOrder]=useState<UnfoldOrder>(DEFAULT_UNFOLD_ORDER),[path,setPath]=useState<UnfoldPath>('hinge');
  const [handoff,setHandoff]=useState(DEFAULT_HANDOFF),[holdNet,setHoldNet]=useState(false);
  const [skipStatic,setSkipStatic]=useState(DEFAULT_SKIP_STATIC),[motionTolerance,setMotionTolerance]=useState(DEFAULT_MOTION_RELATIVE_EPSILON);
  const [inspectionIndex,setInspectionIndex]=useState<number|null>(null);
  const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[seconds,setSeconds]=useState(12);
  const [rate,setRateState]=useState(1);
  const rateRef=useRef(rate);rateRef.current=rate;
  const setRate=(n:number)=>setRateState(validPlaybackRate(n));
  const [reverse,setReverse]=useState(false),[loop,setLoop]=useState(false),[separation,setSeparation]=useState(DEFAULT_SEPARATION);
  const [context,setContext]=useState<UnfoldDisplay['context']>('dim'),[checker,setChecker]=useState(false),[labels,setLabels]=useState(true);
  const [hingeWave,setHingeWave]=useState(true),[showHinges,setShowHinges]=useState(true),[showTemporaryCuts,setShowTemporaryCuts]=useState(true),[autoFrame,setAutoFrame]=useState(DEFAULT_AUTO_FRAME);
  const [overlapMode,setOverlapMode]=useState<OverlapMode>(DEFAULT_OVERLAP_MODE),[overlapTolerance,setOverlapTolerance]=useState(DEFAULT_OVERLAP_TOLERANCE),[overlapOpacity,setOverlapOpacity]=useState(DEFAULT_OVERLAP_OPACITY),[faceTones,setFaceTones]=useState(true);
  const [focusFace,setFocusFace]=useState<number|null>(null);
  // Synchronous ref also handles consecutive pointer events before React paints.
  // Playback's `active` list is not an implicit inspection selection.
  const inspection=useRef<InspectionSelection>(EMPTY_INSPECTION);
  const applyInspection=(next:InspectionSelection)=>{
    inspection.current=next;
    // Face-only inspection must keep the same island array / memoized timeline.
    setSelection(previous=>previous.length===next.islands.length&&previous.every((id,i)=>id===next.islands[i])?previous:[...next.islands]);
    setFocusFace(next.face);
  };
  const clearFace=()=>applyInspection({...inspection.current,face:null});
  const [cameraCommand,setCameraCommand]=useState({kind:'orbit' as 'orbit'|'uv'|'current',key:0});
  const ref=useRef(0);ref.current=progress;
  const all=useMemo(()=>snapshot?areaOrderedIslands(snapshot.geometry,snapshot.geometry.islands.map(c=>c.id)):[],[snapshot]);
  const active=useMemo(()=>scope==='all'?all:scope==='single'?[selection.find(id=>all.includes(id))??all[0]].filter((id):id is number=>id!==undefined):all.filter(id=>selection.includes(id)),[all,scope,selection]);
  const timeline=useMemo(()=>snapshot?buildMotionTimeline(snapshot.geometry,{selected:active,order,handoff,holdNet,path,separation,hingeWave},{skipStatic,relativeEpsilon:motionTolerance}):undefined,[snapshot,active,order,handoff,holdNet,path,separation,hingeWave,skipStatic,motionTolerance]);
  const nominalDuration=unfoldDuration(seconds,active.length,order,handoff);
  const duration=unfoldDuration(seconds,active.length,order,handoff,timeline);
  const schedule=sampleUnfoldSchedule(progress,active.length,order,handoff,reverse,timeline);
  const focusIndex=!playing&&inspectionIndex!==null&&inspectionIndex<active.length?inspectionIndex:schedule.focusIndex;
  const wallDuration=duration/rate;
  const remaining=wallDuration*(reverse?progress:1-progress);
  useEffect(()=>{setPlaying(false);setProgress(0);ref.current=0;applyInspection(EMPTY_INSPECTION);setInspectionIndex(null);},[snapshot]);
  useEffect(()=>{
    if(!playing||!snapshot||!active.length)return;
    let raf=0,last:number|null=null,live=true;
    const visibility=()=>{last=null;};
    const tick=(now:number)=>{
      if(!live)return;
      if(document.hidden){last=null;raf=requestAnimationFrame(tick);return;}
      const delta=last===null?0:Math.max(0,now-last);last=now;
      const next=advanceUnfoldPlayback(ref.current,delta,duration,reverse,loop,rateRef.current);
      ref.current=next.progress;setProgress(next.progress);
      if(next.finished){setPlaying(false);return;}
      raf=requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange',visibility);
    raf=requestAnimationFrame(tick);return()=>{live=false;cancelAnimationFrame(raf);document.removeEventListener('visibilitychange',visibility);};
  },[playing,snapshot,active.length,duration,reverse,loop]);
  const seek=(value:number)=>{setPlaying(false);setInspectionIndex(null);const t=Math.max(0,Math.min(1,value));ref.current=t;setProgress(t);};
  const reset=()=>seek(0);
  const select=(id:number,_face:number|null=null,additive=false)=>{
    if(!all.includes(id))return;
    const base=additive&&scope==='all'?{islands:all,face:null}:inspection.current;
    const next=selectInspectionIsland(base,id,all,additive);
    reset();applyInspection(next);setScope(additive?'selected':'single');
  };
  const pick=(id:number,face:number|null,additive:boolean)=>{
    if(!snapshot)return;
    const next=resolveInspectionPick(inspection.current,{id,face,additive},all,snapshot.geometry.faceChart);
    if(next.kind==='none')return;
    if(next.kind==='face'){
      // A face toggle never changes the queue, pose, playback clock or camera.
      applyInspection(next.state);return;
    }
    const local=islandProgress(ref.current,active.indexOf(id),active.length,order,handoff,timeline);
    reset();applyInspection(next.state);setScope(additive?'selected':'single');
    if(!additive)seek(local); // Inspect the current pose instead of snapping to 3D.
  };
  const boxSelect=(hits:number[],mode:BoxMode)=>{const ids=applyBoxSelection(inspection.current.islands,hits,all,mode);reset();applyInspection({islands:ids,face:null});setScope('selected');};
  const changeScope=(value:UnfoldScope)=>{
    reset();setScope(value);
    const ids=value==='all'?[]:value==='single'?[selection[0]??all[0]].filter((id):id is number=>id!==undefined):selection;
    applyInspection({islands:ids,face:null});
  };
  const clear=()=>{reset();setScope('selected');applyInspection(EMPTY_INSPECTION);};
  useEffect(()=>{
    const escape=(e:KeyboardEvent)=>{
      const el=e.target as HTMLElement|null;
      if(e.key!=='Escape'||e.defaultPrevented||el?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(inspection.current.face!==null){e.preventDefault();clearFace();}
      else if(inspection.current.islands.length){e.preventDefault();clear();}
    };
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  });
  const changeOrder=(value:UnfoldOrder)=>{reset();setOrder(value);};
  const changeHandoff=(value:number)=>{if(!Number.isFinite(value))return;reset();setHandoff(Math.max(MIN_HANDOFF,Math.min(1,value)));};
  const changeHoldNet=(value:boolean)=>{reset();setHoldNet(value);};
  const seekStage=(pose:number)=>{seek(islandTimelineProgress(timeline?.entries[focusIndex]?motionLocal(timeline.entries[focusIndex]!.profile,pose):hingePlaybackProgress(pose,holdNet),focusIndex,active.length,order,handoff,timeline));setInspectionIndex(focusIndex);};
  const seekQueue=(direction:number)=>{const i=Math.max(0,Math.min(active.length-1,focusIndex+direction));seek(islandTimelineProgress(reverse?1:0,i,active.length,order,handoff,timeline));setInspectionIndex(i);};
  const nextIsland=(direction:number)=>{const index=Math.max(0,all.indexOf(selection[0]??-1)),id=all[(index+direction+all.length)%all.length];if(id!==undefined)select(id);};
  const toggle=()=>{setInspectionIndex(null);if(!snapshot||!active.length)return;if(!playing&&(reverse?ref.current<=0:ref.current>=1)){ref.current=reverse?1:0;setProgress(ref.current);}setPlaying(x=>!x);};
  const fit=(kind:'orbit'|'uv'|'current')=>{setAutoFrame(false);setCameraCommand(c=>({kind,key:c.key+1}));};
  return {rate,setRate,wallDuration,overlapMode,setOverlapMode,overlapTolerance,setOverlapTolerance,overlapOpacity,setOverlapOpacity,faceTones,setFaceTones,timeline,skipStatic,changeSkipStatic:(v:boolean)=>{reset();setSkipStatic(v);},motionTolerance,changeMotionTolerance:(v:number)=>{if(Number.isFinite(v)&&v>=0&&v<=.001){reset();setMotionTolerance(v);}},nominalDuration,handoff,changeHandoff,holdNet,changeHoldNet,schedule,focusIndex,remaining,seekStage,seekQueue,hingeWave,setHingeWave:(v:boolean)=>{reset();setHingeWave(v);},showHinges,setShowHinges,showTemporaryCuts,setShowTemporaryCuts,autoFrame,setAutoFrame,scope,selection,active,all,order,path,progress,playing,seconds,duration,reverse,loop,separation,context,checker,labels,focusFace,cameraCommand,
    select,pick,boxSelect,changeScope,changeOrder,nextIsland,seek,toggle,fit,pause:()=>setPlaying(false),setPath:(v:UnfoldPath)=>{reset();setPath(v);},setSeconds,setReverse,setLoop,setSeparation:(v:number)=>{reset();setSeparation(v);},setContext,setChecker,setLabels,
    clear,clearFace};
}
export type UnfoldPlayer=ReturnType<typeof useUnfoldPlayer>;
