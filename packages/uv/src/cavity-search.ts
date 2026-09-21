import {RasterBoard,type RasterWork} from './shape-raster.js';
export interface EmptyWindow {x:number;y:number;width:number;height:number;cells:number}
/** Largest empty rectangles in the actual reserved-cell image, not chart AABBs.
 * Histogram enumeration is exact for the largest rectangle. A bounded,
 * spatially diverse subset supplies search proposals; it is not an optimum
 * packing certificate. Closed holes, concavities and edge gaps all participate. */
export function emptyWindows(board:RasterBoard,limit=24,work?:RasterWork):EmptyWindow[]{
 const n=board.size,heights=new Int32Array(n),best=new Map<string,EmptyWindow>(),bucket=Math.max(2,Math.floor(n/24));
 for(let y=0;y<n;y++){
  work?.tick();for(let x=0;x<n;x++)heights[x]=(board.words[y*board.stride+(x>>>5)]!&(1<<(x&31)))?0:heights[x]!+1;
  const stack:{left:number;height:number}[]=[];
  for(let x=0;x<=n;x++){
   const h=x===n?0:heights[x]!;let left=x;
   while(stack.length&&stack.at(-1)!.height>h){const s=stack.pop()!;left=s.left;const width=x-left,height=s.height;
    if(width<2||height<2)continue;const r={x:left,y:y-height+1,width,height,cells:width*height};
    const k=`${Math.floor((left+width/2)/bucket)}:${Math.floor((r.y+height/2)/bucket)}`;
    if(!best.has(k)||best.get(k)!.cells<r.cells)best.set(k,r);
   }
   if(h>0&&(!stack.length||stack.at(-1)!.height<h))stack.push({left,height:h});
  }
 }
 const result:EmptyWindow[]=[];
 for(const r of [...best.values()].sort((a,b)=>b.cells-a.cells||a.y-b.y||a.x-b.x)){
  if(result.some(q=>Math.max(0,Math.min(r.x+r.width,q.x+q.width)-Math.max(r.x,q.x))*Math.max(0,Math.min(r.y+r.height,q.y+q.height)-Math.max(r.y,q.y))>.65*Math.min(r.cells,q.cells)))continue;
  result.push(r);if(result.length===limit)break;
 }return result;
}
