import { useEffect, useMemo, useRef, useState } from 'react';
import { islandProgress, type UnfoldOrder, type UnfoldPath } from '@meshtailor/uv';
import type { UVSnapshot } from '../workers/uv.worker';
import type { UnfoldDisplay } from './webgl-view';
export type UnfoldScope='all'|'single'|'selected';
export function useUnfoldPlayer(snapshot:UVSnapshot|null){
  const [scope,setScope]=useState<UnfoldScope>('all'),[selection,setSelection]=useState<number[]>([]);
  const [order,setOrder]=useState<UnfoldOrder>('together'),[path,setPath]=useState<UnfoldPath>('hinge');
  const [progress,setProgress]=useState(0),[playing,setPlaying]=useState(false),[seconds,setSeconds]=useState(12);
  const [reverse,setReverse]=useState(false),[loop,setLoop]=useState(false),[separation,setSeparation]=useState(.45);
  const [context,setContext]=useState<UnfoldDisplay['context']>('dim'),[checker,setChecker]=useState(false),[labels,setLabels]=useState(true);
  const [hingeWave,setHingeWave]=useState(true),[showHinges,setShowHinges]=useState(true),[showTemporaryCuts,setShowTemporaryCuts]=useState(true),[autoFrame,setAutoFrame]=useState(true);
  const [focusFace,setFocusFace]=useState<number|null>(null);
  const [cameraCommand,setCameraCommand]=useState({kind:'orbit' as 'orbit'|'uv',key:0});
  const ref=useRef(0);ref.current=progress;
  const all=useMemo(()=>snapshot?.geometry.islands.map(c=>c.id)??[],[snapshot]);
  const active=useMemo(()=>scope==='all'?all:scope==='single'?[selection.find(id=>all.includes(id))??all[0]].filter((id):id is number=>id!==undefined):selection.filter(id=>all.includes(id)),[all,scope,selection]);
  const duration=seconds*(order==='sequential'?Math.max(1,active.length):1);
  useEffect(()=>{setPlaying(false);setProgress(0);ref.current=0;setSelection(all.length?[all[0]!]:[]);setFocusFace(null);},[snapshot]);
  useEffect(()=>{
    if(!playing||!snapshot||!active.length)return;
    let raf=0,last=0,resetAt=0,live=true;
    const tick=(now:number)=>{
      if(!live)return;
      const delta=last?Math.min(now-last,100):0;last=now;
      if(resetAt){if(now>=resetAt){ref.current=reverse?1:0;setProgress(ref.current);resetAt=0;}raf=requestAnimationFrame(tick);return;}
      if(!document.hidden){
        ref.current=Math.max(0,Math.min(1,ref.current+(reverse?-1:1)*delta/(duration*1000)));setProgress(ref.current);
        if(reverse?ref.current<=0:ref.current>=1){if(!loop){setPlaying(false);return;}resetAt=now+650;}
      }
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);return()=>{live=false;cancelAnimationFrame(raf);};
  },[playing,snapshot,active.length,duration,reverse,loop]);
  const seek=(value:number)=>{setPlaying(false);const t=Math.max(0,Math.min(1,value));ref.current=t;setProgress(t);};
  const reset=()=>seek(0);
  const select=(id:number,face:number|null=null,additive=false)=>{
    if(!all.includes(id))return;reset();setFocusFace(face);
    if(additive){const base=scope==='all'?all:selection;setSelection(base.includes(id)?base.filter(x=>x!==id):[...base,id]);setScope('selected');}
    else{setScope('single');setSelection([id]);}
  };
  // Picking a face at 100% should NOT snap it back to 3D before it can be inspected.
  const pick=(id:number,face:number|null,additive:boolean)=>{
    const local=islandProgress(ref.current,active.indexOf(id),active.length,order);
    select(id,face,additive);
    if(!additive)seek(local);
  };
  const changeScope=(value:UnfoldScope)=>{reset();setScope(value);};
  const changeOrder=(value:UnfoldOrder)=>{reset();setOrder(value);};
  const nextIsland=(direction:number)=>{const index=Math.max(0,all.indexOf(selection[0]??-1)),id=all[(index+direction+all.length)%all.length];if(id!==undefined)select(id);};
  const toggle=()=>{if(!snapshot||!active.length)return;if(!playing&&(reverse?ref.current<=0:ref.current>=1)){ref.current=reverse?1:0;setProgress(ref.current);}setPlaying(x=>!x);};
  const fit=(kind:'orbit'|'uv')=>setCameraCommand(c=>({kind,key:c.key+1}));
  return {hingeWave,setHingeWave,showHinges,setShowHinges,showTemporaryCuts,setShowTemporaryCuts,autoFrame,setAutoFrame,scope,selection,active,all,order,path,progress,playing,seconds,duration,reverse,loop,separation,context,checker,labels,focusFace,cameraCommand,
    select,pick,changeScope,changeOrder,nextIsland,seek,toggle,fit,pause:()=>setPlaying(false),setPath,setSeconds,setReverse,setLoop,setSeparation,setContext,setChecker,setLabels,
    clear:()=>{reset();setScope('selected');setSelection([]);setFocusFace(null);}};
}
export type UnfoldPlayer=ReturnType<typeof useUnfoldPlayer>;
