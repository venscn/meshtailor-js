import type {Vec2} from '@meshtailor/mesh-core';

/** Conservative, closed-cell triangle raster. Every cell touched by a triangle
 * is reserved; a square dilation reserves the requested per-side UV gutter.
 * Masks are only a search accelerator, never the reported geometric area. */
export interface ShapeMask {width:number;height:number;stride:number;words:Uint32Array;occupied:{row:number;word:number;bits:number}[];pad:number;rowRuns?:{lo:number;hi:number}[][];runs:{row:number;lo:number;hi:number}[];dilated?:Map<number,{row:number;word:number;bits:number}[]>}
export interface RasterPlacement {mask:ShapeMask;x:number;y:number;turn:boolean;gain:number;rotation?:number;angle?:number}
export class RasterBudget extends Error {constructor(){super('Refinement search budget reached');this.name='RasterBudget';}}
export interface RasterWork {tick():void}
const rangeBits=(lo:number,hi:number)=>((0xffffffff<<lo)&(0xffffffff>>>(31-hi)))>>>0;
export function rasterShape(triangles:readonly (readonly Vec2[])[],width:number,height:number,gain:number,turn:boolean|number,resolution:number,padding:number,work?:RasterWork):ShapeMask|null {
  const rotation=typeof turn==='boolean'?(turn?1:0):turn;
  const odd=rotation%2!==0;
  const scale=Math.sqrt(gain)*resolution,pad=0,w=Math.floor((odd?height:width)*scale)+1,h=Math.floor((odd?width:height)*scale)+1;
  if(w>resolution||h>resolution)return null;
  const stride=Math.ceil(w/32),words=new Uint32Array(stride*h);
  function paint(row:number,a:number,b:number){const first=a>>>5,last=b>>>5,base=row*stride;if(first===last){words[base+first]!|=rangeBits(a&31,b&31);return;}words[base+first]!|=0xffffffff<<(a&31);for(let j=first+1;j<last;j++)words[base+j]=0xffffffff;words[base+last]!|=0xffffffff>>>(31-(b&31));}
  for(let t=0;t<triangles.length;t++){
    if(t%128===0)work?.tick();
    const ps=triangles[t]!.map(p=>{const [x,y]=quarterTurnPoint(p,width,height,rotation);return[x*scale+pad,y*scale+pad];});
    const low=Math.max(pad,Math.floor(Math.min(...ps.map(p=>p[1]!)))),high=Math.min(h-pad-1,Math.floor(Math.max(...ps.map(p=>p[1]!))));
    for(let y=low;y<=high;y++){
      let min=Infinity,max=-Infinity;
      for(let i=0;i<3;i++){
        const a=ps[i]!,b=ps[(i+1)%3]!;
        if(a[1]!>=y&&a[1]!<=y+1){min=Math.min(min,a[0]!);max=Math.max(max,a[0]!);}
        if(a[1]!==b[1])for(const line of [y,y+1]){const u=(line-a[1]!)/(b[1]!-a[1]!);if(u>=0&&u<=1){const x=a[0]!+u*(b[0]!-a[0]!);min=Math.min(min,x);max=Math.max(max,x);}}
      }
      if(min===Infinity)continue;
      const a=Math.max(0,Math.floor(min)-pad),b=Math.min(w-1,Math.floor(max)+pad);
      for(let row=Math.max(0,y-pad);row<=Math.min(h-1,y+pad);row++)paint(row,a,b);
    }
  }
  const occupied:ShapeMask['occupied']=[];
  // Bottom / top alternating would favour some shapes; fixed order keeps the
  // same input deterministic across Node and browsers.
  for(let row=0;row<h;row++)for(let word=0;word<stride;word++){const bits=words[row*stride+word]!;if(bits)occupied.push({row,word,bits});}
  const runs:ShapeMask['runs']=[];for(let row=0;row<h;row++){let lo=-1;for(let x=0;x<=w;x++){const on=x<w&&(words[row*stride+(x>>>5)]!&(1<<(x&31)))!==0;if(on&&lo<0)lo=x;if(!on&&lo>=0){runs.push({row,lo,hi:x-1});lo=-1;}}}
  return{width:w,height:h,stride,words,occupied,pad,runs};
}
export class RasterBoard {
  readonly words:Uint32Array;readonly stride:number;
  constructor(readonly size:number,readonly gutterCells=0){this.stride=Math.ceil(size/32);this.words=new Uint32Array(size*this.stride);}
  fits(mask:ShapeMask,x:number,y:number):boolean {
    if(x<0||y<0||x+mask.width>this.size||y+mask.height>this.size)return false;
    const shift=x&31,offset=x>>>5;
    for(const s of mask.occupied){const index=(s.row+y)*this.stride+offset+s.word;if((this.words[index]!&(s.bits<<shift))!==0)return false;if(shift&&((s.bits>>>(32-shift))&(this.words[index+1]??0))!==0)return false;}
    return true;
  }
  put(mask:ShapeMask,x:number,y:number):void {
    const g=this.gutterCells;
    mask.dilated??=new Map();let occupied=mask.dilated.get(g);
    if(!occupied){
      const w=mask.width+2*g,h=mask.height+2*g,stride=Math.ceil(w/32),words=new Uint32Array(stride*h);
      for(const run of mask.runs){const a=run.lo,b=run.hi+2*g,first=a>>>5,last=b>>>5;
        for(let row=run.row;row<=run.row+2*g;row++){const base=row*stride;if(first===last)words[base+first]!|=rangeBits(a&31,b&31);else{words[base+first]!|=0xffffffff<<(a&31);for(let j=first+1;j<last;j++)words[base+j]=0xffffffff;words[base+last]!|=0xffffffff>>>(31-(b&31));}}
      }
      occupied=[];for(let row=0;row<h;row++)for(let word=0;word<stride;word++){const bits=words[row*stride+word]!;if(bits)occupied.push({row,word,bits});}mask.dilated.set(g,occupied);
    }
    const ox=x-g,oy=y-g,shift=ox&31,offset=Math.floor(ox/32);
    for(const s of occupied){const row=s.row+oy;if(row<0||row>=this.size)continue;const col=offset+s.word,index=row*this.stride+col;
      if(col>=0&&col<this.stride)this.words[index]!|=s.bits<<shift;
      if(shift&&col+1>=0&&col+1<this.stride)this.words[index+1]!|=s.bits>>>(32-shift);
    }
  }
  /** Exact right-hand extent of a blocked run in one row (exclusive). */
  private blockedEnd(row:number,x:number):number {
    while(x<this.size){const col=x>>>5,off=x&31,word=this.words[row*this.stride+col]!;
      const free=(~word)>>>off;
      if(free)return Math.min(this.size,x+(31-Math.clz32((free&-free)>>>0)));
      x=(col+1)*32;
    }return this.size;
  }
  /** Exact collision interval skipping, NOT coarse sampling. All skipped x
   * translations collide with the same occupied board run and mask run. */
  private collisionEnd(mask:ShapeMask,x:number,y:number):number {
    const shift=x&31,offset=x>>>5;
    for(const s of mask.occupied){const index=(s.row+y)*this.stride+offset+s.word;
      let bits=(this.words[index]!&(s.bits<<shift))>>>0,word=offset+s.word;
      if(!bits&&shift){bits=((s.bits>>>(32-shift))&(this.words[index+1]??0))>>>0;word++;}
      if(!bits)continue;
      const col=word*32+(31-Math.clz32((bits&-bits)>>>0)),local=col-x;
      if(!mask.rowRuns){mask.rowRuns=Array.from({length:mask.height},()=>[]);for(const r of mask.runs)mask.rowRuns[r.row]!.push({lo:r.lo,hi:r.hi});}
      const run=mask.rowRuns[s.row]!.find(r=>r.lo<=local&&local<=r.hi);
      if(!run)return x+1;
      return Math.max(x+1,this.blockedEnd(s.row+y,col)-run.lo);
    }return x;
  }
  /** Exhaustive integer translation in a window. The result is identical to
   * cell-by-cell bottom-left search, but whole impossible intervals are skipped. */
  findWindow(mask:ShapeMask,minX:number,minY:number,maxX:number,maxY:number,work?:RasterWork):{x:number;y:number}|null {
    const X=Math.min(this.size-mask.width,Math.floor(maxX)),Y=Math.min(this.size-mask.height,Math.floor(maxY));
    const lo=Math.max(0,Math.ceil(minX)),bottom=Math.max(0,Math.ceil(minY));if(X<lo||Y<bottom)return null;
    for(let y=bottom;y<=Y;y++){work?.tick();for(let x=lo;x<=X;){const next=this.collisionEnd(mask,x,y);if(next===x)return{x,y};x=next;}}return null;
  }
  find(mask:ShapeMask,work?:RasterWork,maxX=this.size-mask.width,maxY=this.size-mask.height):{x:number;y:number}|null {
    return this.findWindow(mask,0,0,maxX,maxY,work);
  }
}

/** Proper rotations only: no reflection or separate U/V scaling. */
export function quarterTurnPoint([x,y]:readonly number[],width:number,height:number,turn:number):Vec2 {
 switch(turn){case 0:return[x!,y!];case 1:return[height-y!,x!];case 2:return[width-x!,height-y!];case 3:return[y!,width-x!];default:throw Error('Quarter turn must be 0..3.');}
}
