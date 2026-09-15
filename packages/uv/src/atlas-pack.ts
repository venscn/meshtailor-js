import { uvProgress, type UVWork } from './work.js';
import type { Vec2 } from '@meshtailor/mesh-core';
import type { PackedChart } from './preview.js';
export interface RawChart {id:number; faceUVs:Map<number,[Vec2,Vec2,Vec2]>; area3D:number}
export type PackingMethod = 'auto'|'maxrects'|'shelf';
export interface PackOptions { /** Internal common texel density for multiple pages. */ fixedScale?:number; padding:number; rotate:boolean; rotationSteps:number; packing?:PackingMethod }
export interface AtlasPacking {packed:PackedChart[]; occupancy:number; boxOccupancy:number; scale:number; padding:number; packingMethod:'maxrects'|'shelf'}
interface Rect {x:number;y:number;w:number;h:number}
interface OrientedChart {id:number;coords:Map<number,[Vec2,Vec2,Vec2]>;w:number;h:number;area:number}
interface Placement extends Rect { id:number;rotated:boolean }
function bounds(points:Vec2[]){let x=Infinity,y=Infinity,X=-Infinity,Y=-Infinity;for(const p of points){x=Math.min(x,p[0]);y=Math.min(y,p[1]);X=Math.max(X,p[0]);Y=Math.max(Y,p[1]);}return{x,y,w:X-x,h:Y-y};}
/** Area normalization gives all islands the SAME mean texel density. Never scale U/V independently. */
function orient(chart:RawChart,steps:number):OrientedChart{
  const values=[...chart.faceUVs.values()],points=values.flat();let area=0;
  for(const [a,b,c]of values)area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
  if(!(area>0&&chart.area3D>0))throw new Error('Cannot pack zero-area chart.');
  const density=Math.sqrt(chart.area3D/area);let best={angle:0,box:bounds(points),score:Infinity};
  for(let i=0;i<steps;i++){const angle=i/steps*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),box=bounds(points.map(([x,y])=>[x*c-y*s,x*s+y*c]));if(box.w*box.h<best.score)best={angle,box,score:box.w*box.h};}
  const c=Math.cos(best.angle),s=Math.sin(best.angle),coords=new Map<number,[Vec2,Vec2,Vec2]>();
  for(const [fi,uv]of chart.faceUVs)coords.set(fi,uv.map(([x,y])=>[(x*c-y*s-best.box.x)*density,(x*s+y*c-best.box.y)*density] as Vec2) as [Vec2,Vec2,Vec2]);
  return{id:chart.id,coords,w:best.box.w*density,h:best.box.h*density,area:chart.area3D};
}
const contains=(a:Rect,b:Rect)=>b.x>=a.x-1e-12&&b.y>=a.y-1e-12&&b.x+b.w<=a.x+a.w+1e-12&&b.y+b.h<=a.y+a.h+1e-12;
/** Independent MaxRects best-short-side-fit implementation. Bounding rectangles
 * cannot nest concave polygons; it is a heuristic, NOT an optimal atlas solver. */
function attempt(charts:OrientedChart[],scale:number,pad:number,rotate:boolean,sort:number,work?:UVWork):Placement[]|null{
  const ordered=[...charts].sort((a,b)=>sort===0?Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.area-a.area:b.w*b.h-a.w*a.h||b.area-a.area);
  let free:Rect[]=[{x:0,y:0,w:1,h:1}];const placements:Placement[]=[];
  for(const ch of ordered){work?.check();let best:Placement|null=null,bestShort=Infinity,bestLong=Infinity;
    for(const rect of free)for(const r of rotate?[false,true]:[false]){
      const w=(r?ch.h:ch.w)*scale+2*pad,h=(r?ch.w:ch.h)*scale+2*pad;
      if(w>rect.w+1e-12||h>rect.h+1e-12)continue;
      const short=Math.min(rect.w-w,rect.h-h),long=Math.max(rect.w-w,rect.h-h);
      if(short<bestShort-1e-12||Math.abs(short-bestShort)<1e-12&&long<bestLong){best={id:ch.id,x:rect.x,y:rect.y,w,h,rotated:r};bestShort=short;bestLong=long;}
    }
    if(!best)return null;placements.push(best);const used=best,next:Rect[]=[];
    for(const f of free){
      if(used.x>=f.x+f.w-1e-12||used.x+used.w<=f.x+1e-12||used.y>=f.y+f.h-1e-12||used.y+used.h<=f.y+1e-12){next.push(f);continue;}
      if(used.x>f.x+1e-12)next.push({x:f.x,y:f.y,w:used.x-f.x,h:f.h});
      if(used.x+used.w<f.x+f.w-1e-12)next.push({x:used.x+used.w,y:f.y,w:f.x+f.w-used.x-used.w,h:f.h});
      if(used.y>f.y+1e-12)next.push({x:f.x,y:f.y,w:f.w,h:used.y-f.y});
      if(used.y+used.h<f.y+f.h-1e-12)next.push({x:f.x,y:used.y+used.h,w:f.w,h:f.y+f.h-used.y-used.h});
    }
    free=next.filter((r,i)=>{if(i%64===0)work?.check();return !next.some((s,j)=>i!==j&&contains(s,r)&&(!contains(r,s)||j<i));});
  }
  return placements;
}
/** Area-aware shelf best-fit for hundreds/thousands of islands. Unlike MaxRects,
 * it has no quadratic free-rectangle containment pass after every placement.
 * The same pre-oriented shapes, common texel density, gutter and uniform scale
 * are retained. This heuristic may leave more space than polygon nesting.
 */
function shelfAttempt(charts:OrientedChart[],scale:number,pad:number,rotate:boolean,sort:number,work?:UVWork):Placement[]|null{
  const ordered=charts.map(ch=>{
    const rotated=rotate&&ch.h>ch.w;
    return {id:ch.id,w:(rotated?ch.h:ch.w)*scale+2*pad,h:(rotated?ch.w:ch.h)*scale+2*pad,rotated};
  }).sort((a,b)=>sort===0?b.h-a.h||b.w-a.w:b.w*b.h-a.w*a.h||b.h-a.h);
  const shelves:{y:number;h:number;x:number}[]=[],placements:Placement[]=[];let top=0;
  for(const ch of ordered){work?.check();
    let best=-1,w=ch.w,h=ch.h,r=ch.rotated,waste=Infinity;
    for(let i=0;i<shelves.length;i++){
      const row=shelves[i]!;
      for(let turn=0;turn<(rotate?2:1);turn++){
        const cw=turn?ch.h:ch.w,cheight=turn?ch.w:ch.h;
        if(cheight>row.h+1e-12||row.x+cw>1+1e-12)continue;
        const score=(row.h-cheight)*cw+(1-row.x-cw)*1e-6;
        if(score<waste){waste=score;best=i;w=cw;h=cheight;r=turn?!ch.rotated:ch.rotated;}
      }
    }
    if(best<0){
      if(ch.w>1+1e-12||top+ch.h>1+1e-12)return null;
      best=shelves.length;shelves.push({y:top,h:ch.h,x:0});top+=ch.h;
    }
    const row=shelves[best]!;placements.push({id:ch.id,x:row.x,y:row.y,w,h,rotated:r});row.x+=w;
  }
  return placements;
}
export function packAtlas(charts:RawChart[],options:Partial<PackOptions>={},work?:UVWork):AtlasPacking{
  const opts={padding:.003,rotate:true,rotationSteps:12,packing:'auto' as PackingMethod,...options};
  if(!charts.length)throw new Error('Cannot pack empty atlas.');
  if(!Number.isFinite(opts.padding)||opts.padding<0||opts.padding>=.1||!Number.isInteger(opts.rotationSteps)||opts.rotationSteps<1||opts.rotationSteps>90)throw new Error('Invalid atlas packing options.');
  if(!['auto','maxrects','shelf'].includes(opts.packing))throw new Error('Invalid atlas packing method.');
  if(new Set(charts.map(c=>c.id)).size!==charts.length)throw new Error('Duplicate atlas chart IDs.');
  if(charts.length*(2*opts.padding)**2>=1)throw new Error(`Atlas padding alone exhausts the tile for ${charts.length} islands. Reduce the gutter or use fewer islands.`);
  // Explicit expensive mode is bounded, too; do not freeze for minutes by accident.
  if(opts.packing==='maxrects'&&charts.length>1024)throw new Error('MaxRects is limited to 1024 islands. Choose auto/shelf for large atlases.');
  const packingMethod=opts.packing==='auto'?(charts.length>256?'shelf':'maxrects'):opts.packing;
  const place=packingMethod==='shelf'?shelfAttempt:attempt;
  const raw=charts.map((c,i)=>{uvProgress(work,{stage:'orient',detail:'按表面积统一纹素密度与旋转方向',current:i+1,total:charts.length,unit:'岛'});return orient(c,opts.rotate?opts.rotationSteps:1);});
  let best:Placement[]|null=null,bestScale=0;
  if(opts.fixedScale!==undefined){
    if(!(opts.fixedScale>0&&Number.isFinite(opts.fixedScale)))throw new Error('Invalid fixed atlas scale.');
    for(let sort=0;sort<2&&!best;sort++){best=place(raw,opts.fixedScale,opts.padding,opts.rotate,sort,work);if(best)bestScale=opts.fixedScale;}
  }else for(let sort=0;sort<2;sort++){
    let lo=0,hi=Math.sqrt(1/raw.reduce((s,r)=>s+r.w*r.h,0));
    for(let i=0;i<28;i++){uvProgress(work,{stage:'pack',detail:`${packingMethod==='shelf'?'Shelf 大岛数快速排布':'MaxRects 排布'} · ${raw.length} 个岛`,current:sort*28+i+1,total:56,unit:'搜索轮'});const mid=(lo+hi)/2,p=place(raw,mid,opts.padding,opts.rotate,sort,work);if(p){lo=mid;if(mid>bestScale){bestScale=mid;best=p;}}else hi=mid;}
  }
  if(!best)throw new Error('Atlas packing failed: too many islands for this padding. Reduce the gutter.');
  const placements=new Map(best.map(p=>[p.id,p]));
  const packed=raw.map(r=>{
    const p=placements.get(r.id)!,x=p.x+opts.padding,y=p.y+opts.padding,faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
    for(const [fi,vs]of r.coords)faceUVs.set(fi,vs.map(([u,v])=>p.rotated?[x+(r.h-v)*bestScale,y+u*bestScale]:[x+u*bestScale,y+v*bestScale]) as [Vec2,Vec2,Vec2]);
    const w=(p.rotated?r.h:r.w)*bestScale,h=(p.rotated?r.w:r.h)*bestScale;
    return{id:r.id,faceUVs,bounds:[x,y,x+w,y+h] as [number,number,number,number],polygon:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]] as Vec2[]};
  });
  return{packed,occupancy:raw.reduce((s,r)=>s+r.area,0)*bestScale**2,boxOccupancy:raw.reduce((s,r)=>s+r.w*r.h,0)*bestScale**2,scale:bestScale,padding:opts.padding,packingMethod};
}
