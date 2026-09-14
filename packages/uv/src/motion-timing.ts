/** Time is stored in uncompressed per-island units. Removing a span shortens
 * playback; it never stretches the remaining motion to fill the old duration. */
export interface MotionSegment {
  from: number; to: number; stage: string; keep: boolean; reason?: string;
  start: number; end: number;
}
export interface MotionProfile { id: number; segments: MotionSegment[]; duration: number; skipped: number }
export interface MotionEntry { profile: MotionProfile; start: number; end: number }
export interface MotionTimeline { entries: MotionEntry[]; span: number; skipped: number }
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function createMotionProfile(id:number,spans:readonly Omit<MotionSegment,'start'|'end'>[],rate=1):MotionProfile {
  if(!Number.isFinite(rate)||rate<=0)throw new Error('Motion rate must be positive and finite.');
  let end=0,skipped=0,previous=0;
  const segments=spans.map(s=>{
    if(!Number.isFinite(s.from)||!Number.isFinite(s.to)||Math.abs(s.from-previous)>1e-9||s.to<=s.from||s.to>1)throw new Error('Motion spans must continuously cover [0, 1].');
    previous=s.to;const duration=(s.to-s.from)*rate,start=end;
    if(s.keep)end+=duration;else skipped+=duration;
    return {...s,start,end};
  });
  if(Math.abs(previous-1)>1e-9)throw new Error('Motion spans must end at 1.');
  return {id,segments,duration:end,skipped};
}
/** Overlap is bounded by BOTH durations. A tiny successor cannot overtake its
 * predecessor or allow a third island to start before the first has finished. */
export function createMotionTimeline(profiles:readonly MotionProfile[],handoff:number):MotionTimeline {
  if(!Number.isFinite(handoff)||handoff<.75||handoff>1)throw new Error('Motion handoff must be in [0.75, 1].');
  const entries:MotionEntry[]=[];let skipped=0;
  for(const profile of profiles){
    if(!Number.isFinite(profile.duration)||profile.duration<0)throw new Error('Invalid profile duration.');
    const previous=entries.at(-1),overlap=previous?Math.min(previous.profile.duration,profile.duration)*(1-handoff):0;
    const start=previous?previous.end-overlap:0;
    entries.push({profile,start,end:start+profile.duration});skipped+=profile.skipped;
  }
  return {entries,span:entries.at(-1)?.end??0,skipped};
}
/** Skipped intervals collapse to a single instant. Deterministic in both directions. */
export function motionPose(profile:MotionProfile,local:number):number {
  if(local<=0)return 0;if(local>=1||profile.duration===0)return 1;
  const time=clamp(local)*profile.duration;
  for(const s of profile.segments)if(s.keep&&time<s.end-1e-14)return s.from+(s.to-s.from)*clamp((time-s.start)/(s.end-s.start));
  return 1;
}
export function motionLocal(profile:MotionProfile,pose:number):number {
  if(profile.duration===0)return pose<=0?0:1;
  for(const s of profile.segments)if(pose<=s.to)return clamp((s.start+(s.keep?(s.end-s.start)*clamp((pose-s.from)/(s.to-s.from)):0))/profile.duration);
  return 1;
}
export function motionProgress(timeline:MotionTimeline,progress:number,index:number):number {
  const e=timeline.entries[index];if(!e||progress<=0)return 0;
  if(progress>=1)return 1;
  const t=clamp(progress)*timeline.span;
  if(e.profile.duration===0)return t+1e-12>=e.end?1:0;
  const p=(t-e.start)/e.profile.duration;return p<1e-12?0:p>1-1e-12?1:clamp(p);
}
export function motionSeek(timeline:MotionTimeline,local:number,index:number):number {
  const e=timeline.entries[index];if(!e)return 0;
  if(timeline.span===0)return local<=0?0:1;
  return clamp((e.start+clamp(local)*e.profile.duration)/timeline.span);
}
export function sampleMotionTimeline(timeline:MotionTimeline,progress:number,reverse=false){
  const entries=timeline.entries,count=entries.length,time=clamp(progress)*timeline.span;
  // End times are monotone, including zero-duration entries: O(log islands).
  let lo=0,hi=count;
  while(lo<hi){const mid=(lo+hi)>>>1;if(entries[mid]!.end<=time+1e-12)lo=mid+1;else hi=mid;}
  const completed=progress>=1?count:lo,active:{index:number;progress:number}[]=[];
  for(let i=completed;i<Math.min(count,completed+2);i++){
    const p=motionProgress(timeline,progress,i);if(p>0&&p<1)active.push({index:i,progress:p});
  }
  return {completed,waiting:count-completed-active.length,active,focusIndex:active.length?active[reverse?active.length-1:0]!.index:Math.min(count-1,completed)};
}
