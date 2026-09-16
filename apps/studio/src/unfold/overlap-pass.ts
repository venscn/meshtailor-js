import {FOCUS_GLSL,uploadFocusUniforms,type FocusSphere} from './focus-policy.js';
import { cameraBasis, type OrbitCamera } from './camera-math.js';
import { diagnosticSize, overlapWorldTolerance, type OverlapMode } from './overlap-policy.js';

const MESH_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=3) in float island;
uniform mat4 mvp;
out vec3 world;
flat out uint islandID;
void main(){world=position;islandID=uint(island)+1u;gl_Position=mvp*vec4(position,1.0);}`;
const PACK = `
vec3 encode24(uint v){return vec3(float(v&255u),float((v>>8u)&255u),float((v>>16u)&255u))/255.0;}
uint decode24(vec3 v){uvec3 b=uvec3(round(v*255.0));return b.x+(b.y<<8u)+(b.z<<16u);}
`;
const SURFACE_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec3 world;flat in uint islandID;
uniform vec3 eye;uniform vec3 forward;uniform float farPlane;uniform bool eligible;
uniform vec2 pixelScale;
${FOCUS_GLSL}
layout(location=0) out vec4 normalData;
layout(location=1) out vec4 identityData;
layout(location=2) out vec4 linearData;
${PACK}
void main(){
  vec3 n=cross(dFdx(world),dFdy(world));float len=length(n);if(len<1e-20)discard;
  if(focusVisibility(world,float(islandID)-1.0)<focusThreshold(gl_FragCoord.xy*pixelScale))discard;
  normalData=vec4(n/len*.5+.5,eligible?1.0:0.0);
  identityData=vec4(encode24(islandID),1.0);
  uint depth=uint(round(clamp(dot(world-eye,forward)/farPlane,0.0,1.0)*16777215.0));
  linearData=vec4(encode24(depth),1.0);
}`;
const COUNT_FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec3 world;flat in uint islandID;
uniform sampler2D nearestNormal;uniform sampler2D nearestID;uniform sampler2D nearestLinear;
uniform vec3 eye;uniform vec3 forward;uniform vec3 right;uniform vec3 up;
uniform vec2 resolution;uniform float aspect;uniform float farPlane;uniform float tolerance;
uniform bool projected;
out vec4 result;
${PACK}
void main(){
  // Evaluate derivatives before any per-pixel rejection: derivatives inside
  // non-uniform branches/discard paths are not portable across GPU drivers.
  vec3 tangentNormal=cross(dFdx(world),dFdy(world));
  float normalLength=length(tangentNormal);
  ivec2 pixel=ivec2(gl_FragCoord.xy);
  vec4 stored=texelFetch(nearestNormal,pixel,0);
  if(stored.a<.5||decode24(texelFetch(nearestID,pixel,0).rgb)!=islandID)discard;
  if(!projected){
    if(normalLength<1e-20)discard;vec3 n=tangentNormal/normalLength;
    vec3 n0=normalize(stored.rgb*2.0-1.0);
    // A 2-degree normal gate rejects crossing faces even where their depths coincide.
    if(abs(dot(n,n0))<0.999390827)discard;
    float d=float(decode24(texelFetch(nearestLinear,pixel,0).rgb))/16777215.0*farPlane;
    vec2 ndc=gl_FragCoord.xy/resolution*2.0-1.0;
    vec3 nearest=eye+d*(forward+right*ndc.x*0.383864035*aspect+up*ndc.y*0.383864035);
    vec3 delta=world-nearest;
    if(abs(dot(delta,n0))>tolerance||abs(dot(delta,n))>tolerance)discard;
  }
  // RGBA8 + ONE,ONE blend gives an exact saturating per-pixel layer counter.
  // Dithering is disabled for all encoded/count targets. Both face windings count once.
  result=vec4(1.0/255.0,0,0,1.0/255.0);
}`;
const SCREEN_VERTEX = `#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}`;
const SCREEN_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D layers;uniform vec2 screenSize;uniform float dpr;uniform float strength;
out vec4 result;
void main(){
  float count=floor(texture(layers,gl_FragCoord.xy/screenSize).r*255.0+.5);
  if(count<2.0)discard;
  vec2 p=gl_FragCoord.xy/dpr;
  float stripe=step(.46,fract((p.x+p.y)/11.0));
  // Pattern as well as hue distinguishes 2 layers from 3+, including color-blind views.
  if(count>=3.0)stripe=max(stripe,step(.68,fract((p.x-p.y)/11.0)));
  vec3 ink=count<3.0?vec3(1.0,.60,.18):vec3(.97,.28,.57);
  result=vec4(mix(ink*.35,ink,stripe),strength);
}`;

interface Program { handle: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> }
export interface OverlapDraw {
  focusSpheres?:readonly FocusSphere[];focusRetained?:number;
  vao: WebGLVertexArrayObject;
  active: WebGLBuffer; activeCount: number;
  countActive?:WebGLBuffer;countActiveCount?:number;
  context: WebGLBuffer; contextCount: number; solidContext: boolean;
  mvp: Float32Array; camera: OrbitCamera;
  width: number; height: number; dpr: number;
  mode: Exclude<OverlapMode, 'off'|'auto'>; tolerance: number; modelScale: number; opacity: number;
}

/** GPU-only visible-surface diagnostic, NOT a mesh self-intersection solver.
 * Nearest surface (ID + normal + linear depth) -> count matching fragments -> hatch.
 * Cost is proportional to rasterized faces, not O(triangles^2); there are no readbacks
 * in normal playback. Positions/UVs/selection never change. RGB8 avoids float extensions.
 */
export class OverlapPass {
  private readonly surface: Program;
  private readonly count: Program;
  private readonly screen: Program;
  private readonly screenVAO: WebGLVertexArrayObject;
  private front: WebGLFramebuffer | null = null;
  private counter: WebGLFramebuffer | null = null;
  private depth: WebGLRenderbuffer | null = null;
  private textures: WebGLTexture[] = [];
  private width = 0;
  private height = 0;
  private readonly textureLimit: number;
  private rendered = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    // All formats and three MRT outputs are WebGL2 core, no float blending extension.
    this.textureLimit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number);
    const made: Program[] = [];
    try {
      this.surface=this.compile(MESH_VERTEX,SURFACE_FRAGMENT);made.push(this.surface);
      this.count=this.compile(MESH_VERTEX,COUNT_FRAGMENT);made.push(this.count);
      this.screen=this.compile(SCREEN_VERTEX,SCREEN_FRAGMENT);made.push(this.screen);
      this.screenVAO=gl.createVertexArray()!;
      if(!this.screenVAO)throw new Error('Cannot create overlap VAO');
    } catch (error) { for(const p of made)gl.deleteProgram(p.handle);throw error; }
  }
  private compile(vertex: string, fragment: string): Program {
    const gl=this.gl,shaders:WebGLShader[]=[];let p:WebGLProgram|null=null;
    try {
      for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){
        const s=gl.createShader(kind);if(!s)throw new Error('Cannot allocate overlap shader');shaders.push(s);
        gl.shaderSource(s,source);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Overlap shader: '+gl.getShaderInfoLog(s));
      }
      p=gl.createProgram();if(!p)throw new Error('Cannot allocate overlap program');
      for(const s of shaders)gl.attachShader(p,s);gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Overlap link: '+gl.getProgramInfoLog(p));
      return {handle:p,uniforms:new Map()};
    }catch(error){if(p)gl.deleteProgram(p);throw error;}finally{for(const s of shaders)gl.deleteShader(s);}
  }
  private u(p:Program,name:string){if(!p.uniforms.has(name))p.uniforms.set(name,this.gl.getUniformLocation(p.handle,name));return p.uniforms.get(name)!;}
  private allocate(width:number,height:number){
    const gl=this.gl,s=diagnosticSize(width,height,this.textureLimit);
    if(s.width===this.width&&s.height===this.height)return;
    this.releaseTargets();
    try {
      this.width=s.width;this.height=s.height;
      for(let i=0;i<4;i++){
        const texture=gl.createTexture();if(!texture)throw new Error('Cannot allocate overlap texture');this.textures.push(texture);
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,s.width,s.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      }
      this.front=gl.createFramebuffer();this.counter=gl.createFramebuffer();this.depth=gl.createRenderbuffer();
      if(!this.front||!this.counter||!this.depth)throw new Error('Cannot allocate overlap framebuffer');
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.front);
      for(let i=0;i<3;i++)gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,this.textures[i]!,0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1,gl.COLOR_ATTACHMENT2]);
      gl.bindRenderbuffer(gl.RENDERBUFFER,this.depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,s.width,s.height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.depth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Overlap surface framebuffer is incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.counter);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.textures[3]!,0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('Overlap count framebuffer is incomplete');
    } catch (error) {this.releaseTargets();throw error;}
    finally{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.bindRenderbuffer(gl.RENDERBUFFER,null);gl.bindTexture(gl.TEXTURE_2D,null);}
  }
  private texture(p:Program,name:string,index:number,texture:WebGLTexture){const gl=this.gl;gl.activeTexture(gl.TEXTURE0+index);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(this.u(p,name),index);}
  render(a:OverlapDraw){
    const gl=this.gl,hadDither=gl.isEnabled(gl.DITHER);
    this.rendered=false;
    try {
      this.allocate(a.width,a.height);
      const basis=cameraBasis(a.camera),far=Math.max(200,a.camera.distance*20);
      gl.disable(gl.DITHER);gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true,true,true,true);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      gl.viewport(0,0,this.width,this.height);gl.bindVertexArray(a.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.front);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const p=this.surface;gl.useProgram(p.handle);uploadFocusUniforms(gl,p.handle,a.focusSpheres??[],a.focusRetained??.12);gl.uniform2f(this.u(p,'pixelScale'),a.width/this.width,a.height/this.height);gl.uniformMatrix4fv(this.u(p,'mvp'),false,a.mvp);
      gl.uniform3fv(this.u(p,'eye'),basis.eye);gl.uniform3fv(this.u(p,'forward'),basis.forward);gl.uniform1f(this.u(p,'farPlane'),far);
      if(a.solidContext&&a.contextCount){gl.uniform1i(this.u(p,'eligible'),0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,a.context);gl.drawElements(gl.TRIANGLES,a.contextCount,gl.UNSIGNED_INT,0);}
      gl.uniform1i(this.u(p,'eligible'),1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,a.active);gl.drawElements(gl.TRIANGLES,a.activeCount,gl.UNSIGNED_INT,0);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.counter);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
      const q=this.count;gl.useProgram(q.handle);gl.uniformMatrix4fv(this.u(q,'mvp'),false,a.mvp);
      this.texture(q,'nearestNormal',0,this.textures[0]!);this.texture(q,'nearestID',1,this.textures[1]!);this.texture(q,'nearestLinear',2,this.textures[2]!);
      for(const key of ['eye','forward','right','up'] as const)gl.uniform3fv(this.u(q,key),basis[key]);
      gl.uniform2f(this.u(q,'resolution'),this.width,this.height);gl.uniform1f(this.u(q,'aspect'),a.width/a.height);
      gl.uniform1f(this.u(q,'farPlane'),far);gl.uniform1f(this.u(q,'tolerance'),overlapWorldTolerance(a.modelScale,a.tolerance,far));gl.uniform1i(this.u(q,'projected'),Number(a.mode==='projected'));
      gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,a.countActive??a.active);
      gl.drawElements(gl.TRIANGLES,a.countActiveCount??a.activeCount,gl.UNSIGNED_INT,0);
      // Only the intersection's pixels are painted; original island colors remain elsewhere.
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,a.width,a.height);gl.bindVertexArray(this.screenVAO);
      const r=this.screen;gl.useProgram(r.handle);this.texture(r,'layers',0,this.textures[3]!);
      gl.uniform2f(this.u(r,'screenSize'),a.width,a.height);gl.uniform1f(this.u(r,'dpr'),a.dpr);gl.uniform1f(this.u(r,'strength'),a.opacity);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,3);this.rendered=true;
    } finally {
      // The caller resumes its seam/hinge pass. No stale FBO, blend mode or depth writes.
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,a.width,a.height);gl.bindVertexArray(null);
      for(let i=0;i<3;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,null);}gl.activeTexture(gl.TEXTURE0);
      gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      if(hadDither)gl.enable(gl.DITHER);else gl.disable(gl.DITHER);
    }
  }
  /** Explicit debug readback for tests; never called by animation ticks or UI painting. */
  readCounts(){
    if(!this.counter||!this.rendered)return {width:0,height:0,counts:new Uint8Array()};
    const gl=this.gl,previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer|null;
    const rgba=new Uint8Array(this.width*this.height*4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.counter);gl.readBuffer(gl.COLOR_ATTACHMENT0);gl.readPixels(0,0,this.width,this.height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);
    const counts=new Uint8Array(this.width*this.height);for(let i=0;i<counts.length;i++)counts[i]=rgba[i*4]!;
    return {width:this.width,height:this.height,counts};
  }
  get size(){return {width:this.width,height:this.height};}
  releaseTargets(){const gl=this.gl;for(const t of this.textures)gl.deleteTexture(t);this.textures=[];gl.deleteFramebuffer(this.front);gl.deleteFramebuffer(this.counter);gl.deleteRenderbuffer(this.depth);this.front=this.counter=null;this.depth=null;this.width=this.height=0;this.rendered=false;}
  dispose(){this.releaseTargets();for(const p of [this.surface,this.count,this.screen])this.gl.deleteProgram(p.handle);this.gl.deleteVertexArray(this.screenVAO);}
}
