/** A seek is not a session. Only a held pointer or navigation key keeps the
 * playback emphasis active. Ending/cancelling never resumes playback. */
export function attachScrubSession(input:HTMLInputElement,onActive:(active:boolean)=>void):()=>void {
  let pointer:number|null=null,key:string|null=null,active=false;
  const nav=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown']);
  const set=(v:boolean)=>{if(active!==v){active=v;onActive(v);}};
  const end=()=>{pointer=null;key=null;set(false);};
  const down=(e:PointerEvent)=>{if(input.disabled||e.button!==0||pointer!==null)return;pointer=e.pointerId;set(true);try{input.setPointerCapture(e.pointerId);}catch{/* native control may own capture */}};
  const up=(e:PointerEvent)=>{if(pointer===e.pointerId)end();};
  const keyDown=(e:KeyboardEvent)=>{if(!input.disabled&&nav.has(e.key)){key=e.key;set(true);}};
  const keyUp=(e:KeyboardEvent)=>{if(e.key===key)end();};
  const hidden=()=>{if(document.hidden)end();};
  input.addEventListener('pointerdown',down);
  input.addEventListener('lostpointercapture',up);input.addEventListener('blur',end);
  input.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);
  window.addEventListener('pointerup',up,true);window.addEventListener('pointercancel',up,true);
  window.addEventListener('blur',end);document.addEventListener('visibilitychange',hidden);
  return()=>{end();input.removeEventListener('pointerdown',down);input.removeEventListener('lostpointercapture',up);input.removeEventListener('blur',end);input.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('pointerup',up,true);window.removeEventListener('pointercancel',up,true);window.removeEventListener('blur',end);document.removeEventListener('visibilitychange',hidden);};
}
