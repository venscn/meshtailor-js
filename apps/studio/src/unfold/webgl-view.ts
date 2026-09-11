import { islandColor, islandProgress, selectedIslands, uvToWorld, writeUnfoldPositions, type UnfoldGeometry, type UnfoldOptions } from '@meshtailor/uv';
import { fitDistance, viewportSize } from '../viewport-math.js';
import { cameraBasis, cameraMatrix, pickFace, projectPoint, type OrbitCamera } from './camera-math.js';
import type { Vec3 } from '@meshtailor/mesh-core';

export interface UnfoldDisplay extends UnfoldOptions {
  context: 'dim' | 'hidden' | 'solid';
  wireframe: boolean;
  checker: boolean;
  labels: boolean;
  xray: boolean;
  focusFace: number | null;
}
const VERTEX=`#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 color;
layout(location=2) in vec2 uv;
uniform mat4 mvp;
out vec3 vColor; out vec3 vWorld; out vec2 vUV; out vec3 bary;
flat out int face;
void main(){
  vColor=color; vWorld=position; vUV=uv; face=gl_VertexID/3;
  int k=gl_VertexID%3; bary=k==0?vec3(1,0,0):k==1?vec3(0,1,0):vec3(0,0,1);
  gl_Position=mvp*vec4(position,1.0);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec3 vColor; in vec3 vWorld; in vec2 vUV; in vec3 bary; flat in int face;
uniform float opacity; uniform bool wire; uniform bool checker; uniform bool lineMode;
uniform vec3 lineColor; uniform int focus;
out vec4 result;
void main(){
  if(lineMode){result=vec4(lineColor,opacity);return;}
  vec3 c=vColor;
  if(checker){float check=mod(floor(vUV.x*16.0)+floor(vUV.y*16.0),2.0);c*=mix(.7,1.0,check);}
  vec3 n=cross(dFdx(vWorld),dFdy(vWorld));float len=length(n);
  c*=len>1e-10?.78+.22*abs(n.z/len):1.0;
  if(opacity<.99)c=mix(c,vec3(.34,.39,.48),.7);
  if(face==focus)c=mix(c,vec3(1.0),.4);
  if(wire||face==focus){vec3 e=smoothstep(vec3(0.0),fwidth(bary)*1.1,bary);float edge=1.0-min(min(e.x,e.y),e.z);c=mix(c,face==focus?vec3(1.0):c*.42,edge*.82);}
  result=vec4(c,opacity);
}`;

/** Self-contained WebGL2 renderer for correspondence playback. No React or Three dependency.
 * The existing Three.js traversal viewer is left intact. CPU positions are shared by
 * drawing, boundary indices, labels and picking, so none can lag behind the animation.
 */
export class UnfoldWebGLView {
  readonly canvas: HTMLCanvasElement;
  private readonly gl: WebGL2RenderingContext;
  private readonly labelHost = document.createElement('div');
  private readonly observer: ResizeObserver;
  private program!: WebGLProgram;
  private vao!: WebGLVertexArrayObject;
  private positionBuffer!: WebGLBuffer;
  private activeBuffer!: WebGLBuffer;
  private contextBuffer!: WebGLBuffer;
  private seamBuffer!: WebGLBuffer;
  private atlasVAO!: WebGLVertexArrayObject;
  private buffers: WebGLBuffer[] = [];
  private uniforms = new Map<string, WebGLUniformLocation>();
  private data: UnfoldGeometry | null = null;
  private positions = new Float32Array(0);
  private options: UnfoldDisplay = {progress:0,selected:[],order:'together',path:'staged',separation:.45,context:'dim',wireframe:false,checker:false,labels:true,xray:false,focusFace:null};
  private active = new Set<number>();
  private activeCount=0; private contextCount=0; private seamCount=0;
  private camera: OrbitCamera = {yaw:.65,pitch:.35,distance:8,target:[0,0,0]};
  private raf=0; private disposed=false; private lost=false;
  private size={width:0,height:0,dpr:0};
  private lastSelection='';
  private pointer: {id:number;x:number;y:number;startX:number;startY:number;button:number;dragged:boolean}|null=null;
  private labels: {id:number;el:HTMLButtonElement;faces:number[]}[]=[];

  constructor(private host:HTMLDivElement, private onPick:(id:number,face:number|null,additive:boolean)=>void, private onError:(error:string|null)=>void){
    this.canvas=document.createElement('canvas');
    this.canvas.dataset.testid='unfold-canvas';this.canvas.setAttribute('aria-label','3D to UV unfolding canvas');
    Object.assign(this.canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',touchAction:'none'});
    const gl=this.canvas.getContext('webgl2',{antialias:true,alpha:false});
    if(!gl)throw new Error('WebGL 2 is unavailable. Enable browser hardware acceleration, then Retry.');
    this.gl=gl;
    try{this.initialize();}catch(error){gl.getExtension('WEBGL_lose_context')?.loseContext();throw error;}
    this.labelHost.className='unfold-labels';host.append(this.canvas,this.labelHost);
    this.canvas.addEventListener('pointerdown',this.pointerDown);this.canvas.addEventListener('pointermove',this.pointerMove);
    this.canvas.addEventListener('pointerup',this.pointerUp);this.canvas.addEventListener('pointercancel',this.pointerCancel);
    this.canvas.addEventListener('wheel',this.wheel,{passive:false});this.canvas.addEventListener('contextmenu',this.contextMenu);
    this.canvas.addEventListener('webglcontextlost',this.contextLost);this.canvas.addEventListener('webglcontextrestored',this.contextRestored);
    this.observer=new ResizeObserver(this.invalidate);this.observer.observe(host);
    window.addEventListener('resize',this.invalidate);
    this.onError(null);this.invalidate();
  }
  private initialize(){
    const gl=this.gl;
    const shader=(kind:number,source:string)=>{const s=gl.createShader(kind)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Unfold shader: '+error);}return s;};
    const vs=shader(gl.VERTEX_SHADER,VERTEX),fs=shader(gl.FRAGMENT_SHADER,FRAGMENT),program=gl.createProgram()!;
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const error=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error('Unfold program: '+error);}
    this.program=program;this.uniforms.clear();
    for(const name of ['mvp','opacity','wire','checker','lineMode','lineColor','focus'])this.uniforms.set(name,gl.getUniformLocation(program,name)!);
    this.vao=gl.createVertexArray()!;this.atlasVAO=gl.createVertexArray()!;
    this.buffers=[];
    this.positionBuffer=this.buffer();this.activeBuffer=this.buffer();this.contextBuffer=this.buffer();this.seamBuffer=this.buffer();
  }
  private buffer(){const b=this.gl.createBuffer()!;this.buffers.push(b);return b;}
  private uniform(name:string){return this.uniforms.get(name)!;}
  private attribute(location:number,size:number,values:Float32Array,dynamic=false,buffer=this.buffer()){
    const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,values,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
  }
  setGeometry(data:UnfoldGeometry|null){
    this.data=data;this.positions=data?data.source.slice():new Float32Array(0);this.lastSelection='';
    if(!data){this.activeCount=this.contextCount=this.seamCount=0;this.labelHost.replaceChildren();this.labels=[];this.invalidate();return;}
    // Reuse the fixed position/index buffers; replace only the two immutable attributes.
    const gl=this.gl;
    for(const b of this.buffers.splice(4))gl.deleteBuffer(b);
    gl.bindVertexArray(this.vao);
    this.attribute(0,3,this.positions,true,this.positionBuffer);
    const colors=new Float32Array(data.source.length);
    for(let fi=0;fi<data.faceChart.length;fi++){const c=islandColor(data.faceChart[fi]!);for(let k=0;k<3;k++)colors.set(c,fi*9+k*3);}
    this.attribute(1,3,colors);this.attribute(2,2,data.uv);
    gl.bindVertexArray(this.atlasVAO);
    const a=data.atlas,points=[a.min,[a.max[0],a.min[1]],a.max,[a.min[0],a.max[1]],a.min];
    this.attribute(0,3,new Float32Array(points.flatMap(p=>uvToWorld(p as [number,number],a))));
    gl.disableVertexAttribArray(1);gl.disableVertexAttribArray(2);gl.vertexAttrib3f(1,0,0,0);gl.vertexAttrib2f(2,0,0);
    gl.bindVertexArray(null);
    this.setOptions(this.options);this.fit('orbit');
  }
  setOptions(options:UnfoldDisplay){
    this.options=options;
    if(!this.data||this.lost)return;
    const data=this.data,gl=this.gl,ids=selectedIslands(data,options.selected);
    this.active=new Set(ids);
    const key=JSON.stringify([ids,options.context]);
    if(key!==this.lastSelection){
      this.lastSelection=key;
      const active:number[]=[],context:number[]=[],lines:number[]=[];
      for(let fi=0;fi<data.faceChart.length;fi++)(this.active.has(data.faceChart[fi]!)?active:context).push(fi*3,fi*3+1,fi*3+2);
      for(let i=0;i<data.boundaries.length;i+=2)if(this.active.has(data.faceChart[Math.floor(data.boundaries[i]!/3)]!))lines.push(data.boundaries[i]!,data.boundaries[i+1]!);
      gl.bindVertexArray(this.vao);
      for(const [buffer,indices]of [[this.activeBuffer,active],[this.contextBuffer,context],[this.seamBuffer,lines]] as const){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(indices),gl.STATIC_DRAW);}
      this.activeCount=active.length;this.contextCount=context.length;this.seamCount=lines.length;
      this.makeLabels();
    }
    writeUnfoldPositions(data,options,this.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.positions);
    this.canvas.dataset.progress=String(options.progress);this.canvas.dataset.selectedCount=String(ids.length);
    this.canvas.dataset.targetError=options.progress===1&&ids.length===data.islands.length?String(this.positions.reduce((m,v,i)=>Math.max(m,Math.abs(v-data.target[i]!)),0)):'not-at-all-target';
    this.canvas.dataset.sourceError=options.progress===0?String(this.positions.reduce((m,v,i)=>Math.max(m,Math.abs(v-data.source[i]!)),0)):'not-at-source';
    this.canvas.dataset.completed=String(ids.filter((_,i)=>islandProgress(options.progress,i,ids.length,options.order)===1).length);
    this.invalidate();
  }
  private makeLabels(){
    this.labelHost.replaceChildren();this.labels=[];if(!this.data)return;
    // Bounded DOM on highly fragmented meshes. The full list is paginated in Studio.
    const islands=this.data.islands.filter(i=>this.active.has(i.id)).slice(0,48);
    for(const island of islands){
      const el=document.createElement('button');el.type='button';el.textContent=`#${island.id+1}`;el.setAttribute('aria-label',`Select island ${island.id+1}`);
      el.style.borderColor=`rgb(${islandColor(island.id).map(x=>Math.round(x*255)).join(',')})`;
      el.addEventListener('click',e=>this.onPick(island.id,null,e.shiftKey||e.ctrlKey||e.metaKey));this.labelHost.append(el);
      this.labels.push({id:island.id,el,faces:island.faces});
    }
  }
  fit(kind:'orbit'|'uv'='orbit'){
    const radius=(this.data?.radius??1.7)+this.options.separation+.25;
    this.camera={yaw:kind==='uv'?0:.65,pitch:kind==='uv'?0:.35,distance:fitDistance(radius,42,Math.max(.1,this.host.clientWidth/Math.max(1,this.host.clientHeight))),target:[0,0,0]};
    this.invalidate();
  }
  /** Public snapshot for regression diagnostics, not a second animation implementation. */
  getPositions(){return this.positions.slice();}
  getCamera(){return {...this.camera,target:[...this.camera.target]};}
  private readonly invalidate=()=>{if(!this.raf&&!this.disposed)this.raf=requestAnimationFrame(this.draw);};
  private readonly draw=()=>{
    this.raf=0;if(this.disposed||this.lost)return;
    const size=viewportSize(this.host.clientWidth,this.host.clientHeight,window.devicePixelRatio);if(!size.visible)return;
    const gl=this.gl;
    if(size.width!==this.size.width||size.height!==this.size.height||size.dpr!==this.size.dpr){this.canvas.width=Math.max(1,Math.round(size.width*size.dpr));this.canvas.height=Math.max(1,Math.round(size.height*size.dpr));this.size=size;}
    gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(.035,.045,.064,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(!this.data)return;
    const mvp=cameraMatrix(this.camera,size.width/size.height);
    gl.useProgram(this.program);gl.uniformMatrix4fv(this.uniform('mvp'),false,mvp);
    gl.uniform1i(this.uniform('checker'),Number(this.options.checker));gl.uniform1i(this.uniform('wire'),Number(this.options.wireframe));gl.uniform1i(this.uniform('focus'),this.options.focusFace??-1);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.CULL_FACE);
    gl.uniform1i(this.uniform('lineMode'),1);gl.uniform3f(this.uniform('lineColor'),.23,.31,.39);gl.uniform1f(this.uniform('opacity'),.8);
    gl.disable(gl.DEPTH_TEST);gl.bindVertexArray(this.atlasVAO);gl.drawArrays(gl.LINE_STRIP,0,5);
    gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.uniform1i(this.uniform('lineMode'),0);
    gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);
    if(this.options.context!=='hidden'&&this.contextCount){
      const dim=this.options.context==='dim';gl.depthMask(!dim);gl.uniform1f(this.uniform('opacity'),dim?.20:1);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.contextBuffer);gl.drawElements(gl.TRIANGLES,this.contextCount,gl.UNSIGNED_INT,0);
    }
    gl.depthMask(true);gl.uniform1f(this.uniform('opacity'),1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.activeBuffer);gl.drawElements(gl.TRIANGLES,this.activeCount,gl.UNSIGNED_INT,0);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.uniform1i(this.uniform('lineMode'),1);gl.uniform3f(this.uniform('lineColor'),1,.79,.44);
    if(this.options.xray)gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.seamBuffer);gl.drawElements(gl.LINES,this.seamCount,gl.UNSIGNED_INT,0);
    gl.depthMask(true);gl.bindVertexArray(null);
    this.labelHost.hidden=!this.options.labels;
    if(this.options.labels)for(const label of this.labels){
      const center:Vec3=[0,0,0];for(const fi of label.faces)for(let k=0;k<9;k++)center[k%3]+=this.positions[fi*9+k]!;
      for(let a=0;a<3;a++)center[a]/=label.faces.length*3;
      const p=projectPoint(center,mvp,size.width,size.height),visible=!!p&&p[2]>=-1&&p[2]<=1&&p[0]>=0&&p[0]<=size.width&&p[1]>=0&&p[1]<=size.height;
      label.el.hidden=!visible;if(p&&visible)label.el.style.transform=`translate(${p[0]}px,${p[1]}px) translate(-50%,-50%)`;
    }
    const error=gl.getError();if(error!==gl.NO_ERROR)this.onError(`Unfold WebGL error 0x${error.toString(16)}. Retry the preview.`);
    this.canvas.dataset.draws=String(Number(this.canvas.dataset.draws??0)+1);this.canvas.dataset.glError=String(error);this.canvas.dataset.camera=JSON.stringify(this.camera);
  };
  private readonly pointerDown=(e:PointerEvent)=>{if(e.button!==0&&e.button!==2)return;this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,dragged:false};this.canvas.setPointerCapture(e.pointerId);};
  private readonly pointerMove=(e:PointerEvent)=>{
    const p=this.pointer;if(!p||p.id!==e.pointerId)return;
    const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    p.dragged ||= Math.hypot(e.clientX-p.startX,e.clientY-p.startY)>4;
    if(!p.dragged)return;
    if(p.button===2){const b=cameraBasis(this.camera),scale=this.camera.distance*.7/Math.max(1,this.host.clientHeight);for(let i=0;i<3;i++)this.camera.target[i]+=(-dx*b.right[i]!+dy*b.up[i]!)*scale;}
    else{this.camera.yaw-=dx*.007;this.camera.pitch=Math.max(-1.48,Math.min(1.48,this.camera.pitch+dy*.007));}
    this.invalidate();
  };
  private readonly pointerUp=(e:PointerEvent)=>{
    const p=this.pointer;if(!p||p.id!==e.pointerId)return;this.pointer=null;
    if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);
    if(!p.dragged&&p.button===0&&this.data){
      const r=this.canvas.getBoundingClientRect(),fi=pickFace(this.positions,this.camera,r.width/r.height,(e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2,fi=>this.options.context!=='hidden'||this.active.has(this.data!.faceChart[fi]!));
      if(fi!==null)this.onPick(this.data.faceChart[fi]!,fi,e.shiftKey||e.ctrlKey||e.metaKey);
    }
  };
  private readonly pointerCancel=()=>{this.pointer=null;};
  private readonly wheel=(e:WheelEvent)=>{e.preventDefault();this.camera.distance=Math.max(.2,Math.min(200,this.camera.distance*Math.exp(Math.max(-300,Math.min(300,e.deltaY))*.0015)));this.invalidate();};
  private readonly contextMenu=(e:Event)=>e.preventDefault();
  private readonly contextLost=(e:Event)=>{e.preventDefault();this.lost=true;this.onError('Unfold WebGL context lost. Wait for browser recovery or use Retry.');};
  private readonly contextRestored=()=>{try{this.initialize();this.lost=false;this.setGeometry(this.data);this.onError(null);}catch(error){this.onError(String(error));}};
  dispose(){
    if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();window.removeEventListener('resize',this.invalidate);
    this.canvas.removeEventListener('pointerdown',this.pointerDown);this.canvas.removeEventListener('pointermove',this.pointerMove);this.canvas.removeEventListener('pointerup',this.pointerUp);this.canvas.removeEventListener('pointercancel',this.pointerCancel);
    this.canvas.removeEventListener('wheel',this.wheel);this.canvas.removeEventListener('contextmenu',this.contextMenu);this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.canvas.removeEventListener('webglcontextrestored',this.contextRestored);
    this.buffers.forEach(b=>this.gl.deleteBuffer(b));this.gl.deleteVertexArray(this.vao);this.gl.deleteVertexArray(this.atlasVAO);this.gl.deleteProgram(this.program);this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    this.canvas.remove();this.labelHost.remove();this.data=null;
  }
}
