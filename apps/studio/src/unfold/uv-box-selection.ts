import {displayUV} from '@meshtailor/uv';
import type {UVSnapshot} from '../workers/uv.worker.js';
import {pickUVFace,uvScreenFrame} from './uv-drawing.js';
export type BoxMode='replace'|'add'|'subtract'|'invert';
export type Rect={x0:number;y0:number;x1:number;y1:number};
export function boxSelectionMode(e:{altKey:boolean;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean}):BoxMode {
  return e.altKey?'invert':e.ctrlKey||e.metaKey?'subtract':e.shiftKey?'add':'replace';
}
export function applyBoxSelection(previous:readonly number[],hits:readonly number[],all:readonly number[],mode:BoxMode):number[]{
  const valid=new Set(all),set=new Set(mode==='replace'?[]:previous.filter(id=>valid.has(id)));
  for(const id of new Set(hits))if(valid.has(id)){if(mode==='subtract'||mode==='invert'&&set.has(id))set.delete(id);else set.add(id);}
  return all.filter(id=>set.has(id));
}
type P=readonly [number,number];
/** SAT rectangle/triangle intersection; unlike island bounds it does not select
 * a hollow island when the user boxes empty space inside its hole. */
export function triangleIntersectsRect(t:readonly P[],r:Rect):boolean {
  const loX=Math.min(r.x0,r.x1),hiX=Math.max(r.x0,r.x1),loY=Math.min(r.y0,r.y1),hiY=Math.max(r.y0,r.y1);
  const axes:P[]=[[1,0],[0,1]];
  for(let i=0;i<3;i++){const a=t[i]!,b=t[(i+1)%3]!;axes.push([a[1]-b[1],b[0]-a[0]]);}
  const corners:P[]=[[loX,loY],[hiX,loY],[hiX,hiY],[loX,hiY]];
  return axes.every(([x,y])=>{
    if(x*x+y*y<1e-30)return true;
    const a=t.map(p=>p[0]*x+p[1]*y),b=corners.map(p=>p[0]*x+p[1]*y);
    return Math.min(...a)<=Math.max(...b)+1e-12&&Math.min(...b)<=Math.max(...a)+1e-12;
  });
}
export function boxUVIslands(snapshot:UVSnapshot,width:number,height:number,rect:Rect):number[]{
  if(!Object.values(rect).every(Number.isFinite)||width<=0||height<=0)return [];
  const {scale,ox,oy}=uvScreenFrame(snapshot.geometry.atlas,width,height);
  const uvRect={x0:(rect.x0-ox)/scale,x1:(rect.x1-ox)/scale,y0:(oy-rect.y0)/scale,y1:(oy-rect.y1)/scale};
  return snapshot.packed.filter(c=>[...c.faceUVs.values()].some(t=>triangleIntersectsRect(t.map(p=>displayUV(c,p)),uvRect))).map(c=>c.id);
}
interface State {snapshot:UVSnapshot|null;selected:readonly number[]}
/** Shared real pointer controller: no modifier needed to draw a box, click still
 * uses two-level island/face picking. Captures pointer; aborts on cancellation,
 * Escape or snapshot replacement. One selection transaction on release. */
export function attachUVSelection(canvas:HTMLCanvasElement,getState:()=>State,onBox:(ids:number[],mode:BoxMode)=>void,onPick:(id:number,face:number|null,additive:boolean)=>void):()=>void {
  const overlay=document.createElement('div');overlay.className='uv-selection-box';overlay.hidden=true;overlay.setAttribute('aria-hidden','true');canvas.parentElement!.append(overlay);
  canvas.style.touchAction='none';
  let drag:{id:number;x:number;y:number;mode:BoxMode;snapshot:UVSnapshot;moved:boolean}|null=null;
  const local=(e:PointerEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,r};};
  const stop=()=>{const d=drag;drag=null;overlay.hidden=true;delete canvas.dataset.boxMode;if(d&&canvas.hasPointerCapture(d.id))canvas.releasePointerCapture(d.id);};
  const down=(e:PointerEvent)=>{if(e.button!==0||drag)return;const {snapshot}=getState();if(!snapshot)return;const p=local(e);drag={id:e.pointerId,x:p.x,y:p.y,mode:boxSelectionMode(e),snapshot,moved:false};canvas.setPointerCapture(e.pointerId);};
  const move=(e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const p=local(e);drag.moved ||=Math.hypot(p.x-drag.x,p.y-drag.y)>4;if(!drag.moved)return;e.preventDefault();overlay.hidden=false;canvas.dataset.boxMode=drag.mode;overlay.dataset.mode=drag.mode;Object.assign(overlay.style,{left:Math.min(p.x,drag.x)+'px',top:Math.min(p.y,drag.y)+'px',width:Math.abs(p.x-drag.x)+'px',height:Math.abs(p.y-drag.y)+'px'});};
  const up=(e:PointerEvent)=>{if(!drag||drag.id!==e.pointerId)return;const d=drag,p=local(e),s=getState();stop();if(s.snapshot!==d.snapshot)return;
    if(d.moved){e.preventDefault();const hits=boxUVIslands(s.snapshot!,p.r.width,p.r.height,{x0:d.x,y0:d.y,x1:p.x,y1:p.y});onBox(hits,d.mode);}
    else{const hit=pickUVFace(s.snapshot!,p.r.width,p.r.height,p.x,p.y,s.selected);if(hit)onPick(hit.id,hit.face,e.shiftKey||e.ctrlKey||e.metaKey);}
  };
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&drag){e.preventDefault();stop();}};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);window.addEventListener('keydown',escape,true);
  return()=>{stop();overlay.remove();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',stop);canvas.removeEventListener('lostpointercapture',stop);window.removeEventListener('keydown',escape,true);};
}
