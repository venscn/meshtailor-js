import type {Vec2} from '@meshtailor/mesh-core';
import type {PackedChart} from './preview.js';
import type {RawChart,AtlasPacking} from './atlas-pack.js';
import {checkUVTriangles} from './uv-quality.js';
import {uvProgress,type UVWork} from './work.js';
import {RasterBoard,RasterBudget,rasterShape,quarterTurnPoint,type ShapeMask,type RasterPlacement} from './shape-raster.js';
export interface FillOptions {
  fillStrategy?:'adaptive'|'legacy';fillMinStep?:number;fillQuarterTurns?:2|4;
  fillMode?:'off'|'uniform'|'area-priority';fillResolution?:number;fillRounds?:number;
  /** AREA, not length. Other islands never shrink below the starting atlas. */
  fillWarmupPasses?:number;fillStep?:number;fillMaxAreaGain?:number;fillTimeBudgetMs?:number;fillMaxTrials?:number;
}
export interface FillReport {
  mode:'uniform'|'area-priority';resolution:number;before:number;after:number;beforeBox:number;afterBox:number;
  settings:{step:number;maxAreaGain:number;maxRounds:number;warmupPasses:number;timeBudgetMs:number;maxTrials:number;rotate:boolean};
  adaptive?:{strategy:string;seed:string;localAccepted:number;reflowAccepted:number;failedTrials:number;smallerAfterFailure:number;skippedAtCap:number;attempts:{id:number;tries:number;accepted:number;failed:number;nextStep:number;minStepFailed:boolean}[]};
  trials:number;accepted:number;commonAccepted:number;rounds:number;stop:'converged'|'round-limit'|'trial-budget'|'time-budget'|'raster-no-fit'|'validation-rejected';elapsedMs:number;
  order:number[];gains:{id:number;area3D:number;areaFactor:number;linearFactor:number}[];
  history:{round:number;id:number|null;occupancy:number;areaFactor:number}[];
  shapeWaste:{id:number;area3D:number;boxWaste:number;shapeFill:number}[];
  note:string;densitySpreadBefore:number;densitySpreadAfter:number;
}
interface Island {chart:PackedChart;area3D:number;areaUV:number;w:number;h:number;triangles:[Vec2,Vec2,Vec2][];cache:Map<string,ShapeMask|null>}
function area(c:PackedChart){let sum=0;for(const [a,b,d]of c.faceUVs.values())sum+=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]))*.5;return sum;}
export function validateFillOptions(o:FillOptions):void {
  if(o.fillStrategy!==undefined&&!['adaptive','legacy'].includes(o.fillStrategy))throw Error('Unknown fill strategy.');
  if(o.fillQuarterTurns!==undefined&&![2,4].includes(o.fillQuarterTurns))throw Error('Fill quarter turns must be 2 or 4.');
  if(o.fillMinStep!==undefined&&(!Number.isFinite(o.fillMinStep)||o.fillMinStep<.001||o.fillMinStep>.25))throw Error('Invalid fill minimum step.');
  if(o.fillMode!==undefined&&!['off','uniform','area-priority'].includes(o.fillMode))throw Error('Unknown fill refinement mode.');
  for(const [name,value,min,max,integer]of [
    ['fillResolution',o.fillResolution,128,1024,true],['fillRounds',o.fillRounds,1,24,true],
    ['fillWarmupPasses',o.fillWarmupPasses,0,8,true],['fillStep',o.fillStep,.005,.25,false],['fillMaxAreaGain',o.fillMaxAreaGain,1,3,false],
    ['fillTimeBudgetMs',o.fillTimeBudgetMs,50,120000,true],['fillMaxTrials',o.fillMaxTrials,1,5000,true],
  ] as const)if(value!==undefined&&(!Number.isFinite(value)||value<min||value>max||integer&&!Number.isInteger(value)))throw Error(`Invalid ${name} (${min}..${max}).`);
}
/** Shape-aware transactional improvement of an already valid atlas. Baseline is
 * immutable. Committed states cover ALL charts. No per-axis scale, no new cuts,
 * no shrink of the small islands to buy density for a large island. */
export function refineAtlas(base:AtlasPacking,raw:RawChart[],options:FillOptions&{rotate?:boolean}={},work?:UVWork):AtlasPacking {
  validateFillOptions(options);if(!options.fillMode||options.fillMode==='off')return base;
  const mode=options.fillMode,R=options.fillResolution??512,roundLimit=options.fillRounds??8,step=options.fillStep??.08,cap=options.fillMaxAreaGain??1.6,maxTrials=options.fillMaxTrials??Math.max(256,raw.length*8),budget=options.fillTimeBudgetMs??15000,start=performance.now();
  const reference=new Map(raw.map(c=>[c.id,c.area3D]));
  const items:Island[]=base.packed.map(chart=>({chart,area3D:reference.get(chart.id)!,areaUV:area(chart),w:chart.bounds[2]-chart.bounds[0],h:chart.bounds[3]-chart.bounds[1],triangles:[...chart.faceUVs.values()].map(t=>t.map(p=>[p[0]-chart.bounds[0],p[1]-chart.bounds[1]]) as [Vec2,Vec2,Vec2]),cache:new Map()})).sort((a,b)=>b.area3D-a.area3D||a.chart.id-b.chart.id);
  if(items.some(i=>!(i.area3D>0&&i.areaUV>0)))throw Error('Fill requires valid positive-area charts.');
  const densities=items.map(i=>i.areaUV/i.area3D),minDensity=Math.min(...densities),spread=Math.max(...densities)/minDensity;
  const caps=items.map(i=>Math.min(cap,Math.max(1,cap*minDensity/(i.areaUV/i.area3D))));
  const report:FillReport={mode,resolution:R,settings:{step,maxAreaGain:cap,maxRounds:roundLimit,warmupPasses:mode==='area-priority'?(options.fillWarmupPasses??3):0,timeBudgetMs:budget,maxTrials,rotate:options.rotate!==false},densitySpreadBefore:spread,densitySpreadAfter:spread,before:base.occupancy,after:base.occupancy,beforeBox:base.boxOccupancy,afterBox:base.boxOccupancy,trials:0,accepted:0,commonAccepted:0,rounds:0,stop:'converged',elapsedMs:0,order:items.map(i=>i.chart.id),gains:[],history:[],shapeWaste:items.map(i=>({id:i.chart.id,area3D:i.area3D,boxWaste:Math.max(0,i.w*i.h-i.areaUV),shapeFill:i.areaUV/(i.w*i.h)})).sort((a,b)=>b.boxWaste-a.boxWaste).slice(0,10),note:'轮廓栅格只用于保守搜索；占用率为实际三角形面积。面积增益相对本次基线，不改变形状/切缝；小岛不缩小。高包围盒浪费仅供检查切缝，不能证明切缝不合理。'};
  const adaptive=options.fillStrategy!=='legacy',minStep=Math.min(step,options.fillMinStep??.005);
  const attempts=items.map(it=>({id:it.chart.id,tries:0,accepted:0,failed:0,nextStep:step,minStepFailed:false}));
  report.adaptive={strategy:adaptive?'adaptive':'legacy',seed:'none',localAccepted:0,reflowAccepted:0,failedTrials:0,smallerAfterFailure:0,skippedAtCap:0,attempts};
  let checks=0;const local={tick:()=>{if((++checks&31)===0){work?.check();if(performance.now()-start>budget)throw new RasterBudget();}}};
  const getMask=(it:Island,gain:number,turn:number)=>{const key=`${gain.toPrecision(12)}:${turn}`;if(!it.cache.has(key))it.cache.set(key,rasterShape(it.triangles,it.w,it.h,gain,turn,R,base.padding,local));return it.cache.get(key)!;};
  const bestPlace=(board:RasterBoard,it:Island,gain:number,preferred?:RasterPlacement):RasterPlacement|null=>{
    let best:RasterPlacement|null=null;
    const turns=options.rotate===false?[0]:(options.fillQuarterTurns??(adaptive?4:2))===4?[0,1,2,3]:[0,1];
    if(preferred){const turn=preferred.rotation??(preferred.turn?1:0),mask=getMask(it,gain,turn);if(mask&&board.fits(mask,preferred.x,preferred.y)&&preferred.x/R+(turn%2?it.h:it.w)*Math.sqrt(gain)<=1-2*base.padding+1e-10&&preferred.y/R+(turn%2?it.w:it.h)*Math.sqrt(gain)<=1-2*base.padding+1e-10)return{...preferred,mask,gain};}
    for(const rotation of turns){const turn=rotation%2!==0,mask=getMask(it,gain,rotation);if(!mask)continue;const p=board.find(mask,local,Math.floor((1-2*base.padding-(turn?it.h:it.w)*Math.sqrt(gain))*R+1e-8),Math.floor((1-2*base.padding-(turn?it.w:it.h)*Math.sqrt(gain))*R+1e-8));if(p&&p.x/R+(turn?it.h:it.w)*Math.sqrt(gain)<=1-2*base.padding+1e-10&&p.y/R+(turn?it.w:it.h)*Math.sqrt(gain)<=1-2*base.padding+1e-10&&(!best||p.y+mask.height<best.y+best.mask.height||p.y+mask.height===best.y+best.mask.height&&p.x<best.x))best={...p,mask,turn,gain,rotation};}
    return best;
  };
  /** Freeze the already larger prefix, reflow the changed island and ALL smaller
   * islands. Failure discards the full proposal, including moved small islands. */
  const arrange=(gains:number[],prefix:RasterPlacement[]=[],from=0):RasterPlacement[]|null=>{
    const board=new RasterBoard(Math.floor((1-2*base.padding)*R)+1,Math.ceil(2*base.padding*R)),result:RasterPlacement[]=[];
    for(let i=0;i<from;i++){const p=prefix[i]!;board.put(p.mask,p.x,p.y);result.push(p);}
    for(let i=from;i<items.length;i++){local.tick();const p=bestPlace(board,items[i]!,gains[i]!);if(!p)return null;board.put(p.mask,p.x,p.y);result.push(p);}return result;
  };
  const boardSize=Math.floor((1-2*base.padding)*R)+1,gutter=Math.ceil(2*base.padding*R);
  const preserveSeed=():RasterPlacement[]|null=>{
    const board=new RasterBoard(boardSize,gutter),out:RasterPlacement[]=[];
    for(const it of items){const mask=getMask(it,1,0),x=Math.round((it.chart.bounds[0]-base.padding)*R),y=Math.round((it.chart.bounds[1]-base.padding)*R);
      if(!mask||!board.fits(mask,x,y)||x/R+it.w>1-2*base.padding+1e-10||y/R+it.h>1-2*base.padding+1e-10)return null;
      out.push({mask,x,y,turn:false,rotation:0,gain:1});board.put(mask,x,y);
    }return out;
  };
  const localArrange=(next:number[],previous:RasterPlacement[],index:number):RasterPlacement[]|null=>{
    const board=new RasterBoard(boardSize,gutter);for(let j=0;j<previous.length;j++)if(j!==index){const p=previous[j]!;board.put(p.mask,p.x,p.y);}
    const p=bestPlace(board,items[index]!,next[index]!,previous[index]);if(!p)return null;
    const result=previous.slice();result[index]=p;return result;
  };
  let stepNow=step;
  let gains=items.map(()=>1),placements:RasterPlacement[]|null=null;
  try {
    uvProgress(work,{stage:'pack',detail:'轮廓精排：建立保守占用网格与留白',current:0,total:items.length,unit:'岛'});
    if(adaptive)placements=preserveSeed();
    if(placements)report.adaptive!.seed='current-layout';else{placements=arrange(gains);report.adaptive!.seed=placements?'contour-reflow':'no-fit';}
    // Cheap equal-density tightening first. It avoids spending an entire costly
    // coordinate-descent sweep discovering the SAME feasible gain for all islands.
    if(placements&&mode==='area-priority')for(let pass=0;pass<(options.fillWarmupPasses??3);pass++){
      if(report.trials>=maxTrials){report.stop='trial-budget';break;}
      const next=gains.map(g=>Math.min(cap,g*(1+step)));if(next.every((g,i)=>g<=gains[i]!+1e-10))break;
      report.trials++;uvProgress(work,{stage:'pack',detail:`轮廓精排：全岛共同放大试装 ${pass+1}（不改变密度比例）`});
      const proposal=arrange(next);if(!proposal)break;placements=proposal;gains=next;report.accepted++;report.commonAccepted++;
      report.after=items.reduce((s,it,i)=>s+it.areaUV*gains[i]!,0);report.history.push({round:0,id:null,occupancy:report.after,areaFactor:gains[0]!});
    }
    if(!placements)report.stop='raster-no-fit';
    else for(let round=0;round<roundLimit;round++){
      report.rounds=round+1;let changed=0,failedLarger=false;
      const count=mode==='uniform'?1:items.length;
      for(let i=0;i<count;i++){
        work?.check();if(report.trials>=maxTrials){report.stop='trial-budget';break;}
        const next=gains.map((g,j)=>mode==='uniform'||j===i?Math.max(g,Math.min(mode==='uniform'?cap:caps[j]!,g*(1+(adaptive&&mode==='area-priority'?attempts[i]!.nextStep:stepNow)))):g);
        if(next.every((g,j)=>g<=gains[j]!+1e-10)){report.adaptive!.skippedAtCap++;continue;}
        report.trials++;
        uvProgress(work,{stage:'pack',detail:`空白精排 ${round+1}/${roundLimit} 轮 · ${mode==='uniform'?'共同密度':`大岛优先 #${items[i]!.chart.id+1}`} · 占用 ${(report.after*100).toFixed(2)}%`,current:i+1,total:count,unit:'岛'});
        if(failedLarger)report.adaptive!.smallerAfterFailure++;
        const stat=attempts[i]!;stat.tries++;
        let proposal:RasterPlacement[]|null=adaptive&&mode==='area-priority'?localArrange(next,placements!,i):null;
        const localAccepted=!!proposal;
        if(!proposal)proposal=arrange(next,placements!,mode==='uniform'?0:i);
        if(!proposal){failedLarger=true;stat.failed++;report.adaptive!.failedTrials++;stat.minStepFailed=stat.nextStep<=minStep+1e-12;if(adaptive)stat.nextStep=Math.max(minStep,stat.nextStep/2);}
        else{stat.accepted++;stat.minStepFailed=false;if(localAccepted)report.adaptive!.localAccepted++;else report.adaptive!.reflowAccepted++;}
        if(proposal){placements=proposal;gains=next;changed++;report.accepted++;report.after=items.reduce((s,it,k)=>s+it.areaUV*gains[k]!,0);report.history.push({round:round+1,id:mode==='uniform'?null:items[i]!.chart.id,occupancy:report.after,areaFactor:next[i]!});}
      }
      if(report.stop==='trial-budget')break;
      if(!changed){if(adaptive&&mode==='area-priority'){if(attempts.some((s,i)=>!s.minStepFailed&&gains[i]!<caps[i]!-1e-10)&&round<roundLimit-1)continue;}else if(stepNow>.0101&&round<roundLimit-1){stepNow/=2;continue;}report.stop='converged';break;}
      if(round===roundLimit-1)report.stop='round-limit';
    }
  }catch(error){if(error instanceof RasterBudget)report.stop='time-budget';else throw error;}
  let result=base;
  if(placements&&report.after>base.occupancy+1e-10){
    const byId=new Map(items.map((it,i)=>[it.chart.id,{it,p:placements![i]!,g:gains[i]!}]));
    const packed=base.packed.map(ch=>{
      const {it,p,g}=byId.get(ch.id)!,scale=Math.sqrt(g),x=base.padding+p.x/R,y=base.padding+p.y/R;
      const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
      for(const [fi,t]of ch.faceUVs)faceUVs.set(fi,t.map(([u,v])=>{u-=ch.bounds[0];v-=ch.bounds[1];const q=quarterTurnPoint([u,v],it.w,it.h,p.rotation??(p.turn?1:0));return[x+q[0]*scale,y+q[1]*scale];}) as [Vec2,Vec2,Vec2]);
      const w=(p.turn?it.h:it.w)*scale,h=(p.turn?it.w:it.h)*scale;
      return{...ch,faceUVs,bounds:[x,y,x+w,y+h] as [number,number,number,number],polygon:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]] as Vec2[]};
    });
    work?.check();uvProgress(work,{stage:'quality',detail:'精排后检查全部 UV 三角形：翻面、退化、交叠及边距'});
    // Disjoint conservative masks already provide separation; this independent
    // geometric guard also catches transformation and implementation mistakes.
    const q=checkUVTriangles(packed.flatMap(c=>[...c.faceUVs.values()]),100,work);
    const inside=packed.every(c=>c.bounds.every(Number.isFinite)&&c.bounds[0]>=base.padding-1e-9&&c.bounds[1]>=base.padding-1e-9&&c.bounds[2]<=1-base.padding+1e-9&&c.bounds[3]<=1-base.padding+1e-9);
    work?.check();if(q.valid&&inside){report.after=q.area;report.afterBox=packed.reduce((s,c)=>s+(c.bounds[2]-c.bounds[0])*(c.bounds[3]-c.bounds[1]),0);result={...base,packed,occupancy:q.area,boxOccupancy:report.afterBox,packingMethod:'contour'};}
    else {report.stop='validation-rejected';report.note+=' 最终精排几何检查失败，回滚到完整基线。';}
  }
  if(result===base){report.after=base.occupancy;report.afterBox=base.boxOccupancy;gains=items.map(()=>1);}
  report.gains=items.map((it,i)=>({id:it.chart.id,area3D:it.area3D,areaFactor:gains[i]!,linearFactor:Math.sqrt(gains[i]!)}));const finalDensities=items.map((it,i)=>it.areaUV/it.area3D*gains[i]!);report.densitySpreadAfter=Math.max(...finalDensities)/Math.min(...finalDensities);report.elapsedMs=performance.now()-start;
  return{...result,packingReport:{...base.packingReport!,refinement:report}};
}

export function describeFill(report:FillReport):string {
  const stop={converged:'本次方向/分辨率/最小步长下无可接受改进（不是全局最优证明）','round-limit':'达到轮数上限','trial-budget':'达到尝试预算','time-budget':'达到搜索时间预算','raster-no-fit':'当前分辨率未找到不缩小的完整布局','validation-rejected':'最终验证不通过，已回退'}[report.stop];
  return `空白精排：${(report.before*100).toFixed(2)}% → ${(report.after*100).toFixed(2)}%，增加 ${((report.after-report.before)*100).toFixed(2)} 个百分点；尝试 ${report.trials} 次，接受 ${report.accepted} 次。${report.adaptive?`失败大岛之后继续尝试较小岛 ${report.adaptive.smallerAfterFailure} 次；局部扩张 ${report.adaptive.localAccepted} 次。`:""}${stop}。最大/最小平均面积密度 ${report.densitySpreadAfter.toFixed(3)} 倍。`;
}
