import {DEFAULT_FILL_DENSITY_LIMIT,auditFillGrowth,type FillGrowthSummary} from './fill-growth.js';
import {emptyWindows,type EmptyWindow} from './cavity-search.js';
import {contourEdges,rasterContour,type ContourEdges} from './contour-raster.js';
import {shapePose,type ShapePose} from './raster-pose.js';
import type {LargeRecutOptions,LargeRecutReport} from './large-recut.js';
import type {Vec2} from '@meshtailor/mesh-core';
import type {PackedChart} from './preview.js';
import type {RawChart,AtlasPacking} from './atlas-pack.js';
import {checkUVTriangles} from './uv-quality.js';
import {uvProgress,type UVWork} from './work.js';
import {RasterBoard,RasterBudget,rasterShape,quarterTurnPoint,type ShapeMask,type RasterPlacement} from './shape-raster.js';
export interface FillOptions extends LargeRecutOptions {
  fillCavitySearch?:boolean;fillGrowthSteps?:number;
  /** Fit a bounded enlargement directly to a measured empty window. */
  fillFitVacancies?:boolean;
  /** Separate shared density from bounded per-island importance. */
  fillCommonGainLimit?:number;fillRotationStep?:15|30|45|90;fillReflowBudget?:number;
  fillStrategy?:'adaptive'|'legacy';fillMinStep?:number;fillQuarterTurns?:2|4;
  fillMode?:'off'|'uniform'|'area-priority';fillResolution?:number;fillRounds?:number;
  /** AREA, not length. Other islands never shrink below the starting atlas. */
  fillWarmupPasses?:number;fillStep?:number;fillMaxAreaGain?:number;fillTimeBudgetMs?:number;fillMaxTrials?:number;
}
export interface FillReport {
  cavities?:{enabled:boolean;growthSteps:number;windowTrials:number;windowAccepted:number;relocationTrials:number;relocations:number;relocatedIds:number[];largestBefore:number;largestAfter:number;positionOnly:boolean};
  growth?:FillGrowthSummary;
  vacancyGrowth?:{enabled:boolean;trials:number;accepted:number};
  recut?:LargeRecutReport;
  search?:{commonGainLimit:number;commonGain:number;rotationStep:number;reflowBudget:number;reflowTrials:number;reflowAccepted:number;islandsTried:number;untriedIds:number[];completedSweeps:number;freeGridFraction?:number;emptyRegions?:{cells:number;bounds:number[]}[]};
  mode:'uniform'|'area-priority';resolution:number;before:number;after:number;beforeBox:number;afterBox:number;
  settings:{step:number;maxAreaGain:number;maxRounds:number;warmupPasses:number;timeBudgetMs:number;maxTrials:number;rotate:boolean};
  adaptive?:{strategy:string;seed:string;localAccepted:number;reflowAccepted:number;failedTrials:number;smallerAfterFailure:number;skippedAtCap:number;attempts:{id:number;tries:number;accepted:number;failed:number;nextStep:number;minStepFailed:boolean}[]};
  trials:number;accepted:number;commonAccepted:number;rounds:number;stop:'converged'|'round-limit'|'trial-budget'|'time-budget'|'raster-no-fit'|'validation-rejected';elapsedMs:number;
  order:number[];gains:{id:number;area3D:number;areaFactor:number;linearFactor:number}[];
  history:{round:number;id:number|null;occupancy:number;areaFactor:number}[];
  shapeWaste:{id:number;area3D:number;boxWaste:number;shapeFill:number}[];
  note:string;densitySpreadBefore:number;densitySpreadAfter:number;
}
interface Island {chart:PackedChart;area3D:number;areaUV:number;w:number;h:number;triangles:[Vec2,Vec2,Vec2][];cache:Map<string,ShapeMask|null>;poses:Map<number,ShapePose>;contour:ContourEdges|null}
function area(c:PackedChart){let sum=0;for(const [a,b,d]of c.faceUVs.values())sum+=Math.abs((b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]))*.5;return sum;}
export function validateFillOptions(o:FillOptions):void {
  if(o.fillFitVacancies!==undefined&&typeof o.fillFitVacancies!=='boolean')throw Error('Invalid fit-vacancies flag.');
  if(o.fillCavitySearch!==undefined&&typeof o.fillCavitySearch!=='boolean')throw Error('Invalid cavity-search flag.');
  if(o.fillGrowthSteps!==undefined&&(!Number.isInteger(o.fillGrowthSteps)||o.fillGrowthSteps<1||o.fillGrowthSteps>16))throw Error('fillGrowthSteps must be 1..16');
  if(o.fillRotationStep!==undefined&&![15,30,45,90].includes(o.fillRotationStep))throw Error('Fill rotation step must be 15, 30, 45 or 90 degrees.');
  if(o.fillRecutLarge!==undefined&&typeof o.fillRecutLarge!=='boolean')throw Error('Invalid recut flag.');
  if(o.fillStrategy!==undefined&&!['adaptive','legacy'].includes(o.fillStrategy))throw Error('Unknown fill strategy.');
  if(o.fillQuarterTurns!==undefined&&![2,4].includes(o.fillQuarterTurns))throw Error('Fill quarter turns must be 2 or 4.');
  if(o.fillMinStep!==undefined&&(!Number.isFinite(o.fillMinStep)||o.fillMinStep<.001||o.fillMinStep>.25))throw Error('Invalid fill minimum step.');
  if(o.fillMode!==undefined&&!['off','uniform','area-priority'].includes(o.fillMode))throw Error('Unknown fill refinement mode.');
  for(const [name,value,min,max,integer]of [
    ['fillCommonGainLimit',o.fillCommonGainLimit,1,16,false],['fillReflowBudget',o.fillReflowBudget,0,64,true],
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
  const mode=options.fillMode,R=options.fillResolution??512,roundLimit=options.fillRounds??8,step=options.fillStep??.08,cap=options.fillMaxAreaGain??DEFAULT_FILL_DENSITY_LIMIT,maxTrials=options.fillMaxTrials??Math.min(5000,Math.max(256,raw.length*roundLimit*((options.fillGrowthSteps??4)+1)+16)),budget=options.fillTimeBudgetMs??15000,start=performance.now();
  const reference=new Map(raw.map(c=>[c.id,c.area3D]));
  const items:Island[]=base.packed.map(chart=>({chart,area3D:reference.get(chart.id)!,areaUV:area(chart),w:chart.bounds[2]-chart.bounds[0],h:chart.bounds[3]-chart.bounds[1],triangles:[...chart.faceUVs.values()].map(t=>t.map(p=>[p[0]-chart.bounds[0],p[1]-chart.bounds[1]]) as [Vec2,Vec2,Vec2]),cache:new Map(),poses:new Map(),contour:null})).sort((a,b)=>b.area3D-a.area3D||a.chart.id-b.chart.id);
  for(const it of items)it.contour=contourEdges(it.triangles);
  if(items.some(i=>!(i.area3D>0&&i.areaUV>0)))throw Error('Fill requires valid positive-area charts.');
  const densities=items.map(i=>i.areaUV/i.area3D),minDensity=Math.min(...densities),spread=Math.max(...densities)/minDensity;
  const commonLimit=options.fillCommonGainLimit??4,rotationStep=options.fillRotationStep??45,reflowBudget=options.fillReflowBudget??4;
  const cavitiesEnabled=options.fillCavitySearch!==false,growthSteps=options.fillGrowthSteps??4;
  let commonGain=1;
  const report:FillReport={mode,resolution:R,settings:{step,maxAreaGain:cap,maxRounds:roundLimit,warmupPasses:mode==='area-priority'?(options.fillWarmupPasses??3):0,timeBudgetMs:budget,maxTrials,rotate:options.rotate!==false},densitySpreadBefore:spread,densitySpreadAfter:spread,before:base.occupancy,after:base.occupancy,beforeBox:base.boxOccupancy,afterBox:base.boxOccupancy,trials:0,accepted:0,commonAccepted:0,rounds:0,stop:'converged',elapsedMs:0,order:items.map(i=>i.chart.id),gains:[],history:[],shapeWaste:items.map(i=>({id:i.chart.id,area3D:i.area3D,boxWaste:Math.max(0,i.w*i.h-i.areaUV),shapeFill:i.areaUV/(i.w*i.h)})).sort((a,b)=>b.boxWaste-a.boxWaste).slice(0,10),note:'轮廓栅格只用于保守搜索；占用率为实际三角形面积。面积增益相对本次基线，不改变形状/切缝；小岛不缩小。高包围盒浪费仅供检查切缝，不能证明切缝不合理。'};
  report.search={commonGainLimit:commonLimit,commonGain,rotationStep,reflowBudget,reflowTrials:0,reflowAccepted:0,islandsTried:0,untriedIds:items.map(c=>c.chart.id),completedSweeps:0};
  report.cavities={enabled:cavitiesEnabled,growthSteps,windowTrials:0,windowAccepted:0,relocationTrials:0,relocations:0,relocatedIds:[],largestBefore:0,largestAfter:0,positionOnly:false};
  report.vacancyGrowth={enabled:mode==='area-priority'&&options.fillFitVacancies!==false,trials:0,accepted:0};
  const adaptive=options.fillStrategy!=='legacy',minStep=Math.min(step,options.fillMinStep??.005);
  const attempts=items.map(it=>({id:it.chart.id,tries:0,accepted:0,failed:0,nextStep:step,minStepFailed:false}));
  report.adaptive={strategy:adaptive?'adaptive':'legacy',seed:'none',localAccepted:0,reflowAccepted:0,failedTrials:0,smallerAfterFailure:0,skippedAtCap:0,attempts};
  let checks=0;const local={tick:()=>{if((++checks&31)===0){work?.check();if(performance.now()-start>budget)throw new RasterBudget();}}};
  const poseOf=(it:Island,angle:number)=>{if(!it.poses.has(angle))it.poses.set(angle,shapePose(it.triangles,it.w,it.h,angle));return it.poses.get(angle)!;};
  const getMask=(it:Island,gain:number,angle:number)=>{const key=`${gain.toPrecision(12)}:${angle}`;if(!it.cache.has(key)){const pose=poseOf(it,angle);it.cache.set(key,it.contour?rasterContour(it.contour.map(e=>e.map(pose.point) as [Vec2,Vec2]),pose.width,pose.height,gain,R,local):rasterShape(pose.triangles,pose.width,pose.height,gain,0,R,base.padding,local));if(it.cache.size>48)it.cache.delete(it.cache.keys().next().value!);}return it.cache.get(key)!;};
  const bestPlace=(board:RasterBoard,it:Island,gain:number,preferred?:RasterPlacement,cavityFirst=false):RasterPlacement|null=>{
    let best:RasterPlacement|null=null;
    const quarters=(options.fillQuarterTurns??(adaptive?4:2))===4?[0,90,180,270]:[0,90];
    const angles=options.rotate===false?[0]:[...new Set([...quarters,...(adaptive?Array.from({length:360/rotationStep},(_,i)=>i*rotationStep):[])])];
    if(preferred){const angle=preferred.angle??(preferred.rotation??(preferred.turn?1:0))*90,pose=poseOf(it,angle),mask=getMask(it,gain,angle);if(mask&&board.fits(mask,preferred.x,preferred.y)&&preferred.x/R+pose.width*Math.sqrt(gain)<=1-2*base.padding+1e-10&&preferred.y/R+pose.height*Math.sqrt(gain)<=1-2*base.padding+1e-10)return{...preferred,mask,gain,angle};}
    if(cavityFirst&&cavitiesEnabled){
      const windows=emptyWindows(board,18,local);let score=Infinity;
      for(const angle of angles){const pose=poseOf(it,angle),mask=getMask(it,gain,angle);if(!mask)continue;
        const maxX=Math.floor((1-2*base.padding-pose.width*Math.sqrt(gain))*R+1e-8),maxY=Math.floor((1-2*base.padding-pose.height*Math.sqrt(gain))*R+1e-8);
        for(const w of windows){if(mask.width>w.width||mask.height>w.height)continue;report.cavities!.windowTrials++;
          const p=board.findWindow(mask,w.x,w.y,Math.min(w.x+w.width-mask.width,maxX),Math.min(w.y+w.height-mask.height,maxY),local);
          if(!p)continue;const cost=(w.cells-mask.width*mask.height)+(w.x===0||w.y===0||w.x+w.width>=boardSize||w.y+w.height>=boardSize?boardSize*.02:0);
          if(cost<score){score=cost;best={...p,mask,turn:angle%180===90,gain,rotation:angle%90===0?angle/90:0,angle};}
        }
      }
      if(best){report.cavities!.windowAccepted++;return best;}
    }
    for(const angle of angles){const pose=poseOf(it,angle),mask=getMask(it,gain,angle);if(!mask)continue;
      const p=board.find(mask,local,Math.floor((1-2*base.padding-pose.width*Math.sqrt(gain))*R+1e-8),Math.floor((1-2*base.padding-pose.height*Math.sqrt(gain))*R+1e-8));
      if(p&&(!best||p.y+mask.height<best.y+best.mask.height||p.y+mask.height===best.y+best.mask.height&&p.x<best.x))best={...p,mask,turn:angle%180===90,gain,rotation:angle%90===0?angle/90:0,angle};
    }return best;
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
      out.push({mask,x,y,turn:false,rotation:0,angle:0,gain:1});board.put(mask,x,y);
    }return out;
  };
  const localArrange=(next:number[],previous:RasterPlacement[],index:number):RasterPlacement[]|null=>{
    const board=new RasterBoard(boardSize,gutter);for(let j=0;j<previous.length;j++)if(j!==index){const p=previous[j]!;board.put(p.mask,p.x,p.y);}
    const p=bestPlace(board,items[index]!,next[index]!,previous[index],true);if(!p)return null;
    const result=previous.slice();result[index]=p;return result;
  };
  const boardFor=(ps:RasterPlacement[],skip=-1)=>{const b=new RasterBoard(boardSize,gutter);ps.forEach((p,i)=>{if(i!==skip)b.put(p.mask,p.x,p.y);});return b;};
  const biggest=(ps:RasterPlacement[])=>emptyWindows(boardFor(ps),1,local)[0]?.cells??0;
  /** A neutral relocation is allowed only when the largest reserved-cell gap
   * measurably decreases, with every chart still present at its current size.
   * This unlocks growth; it is never reported as an increase in UV area.
   * A later growth sweep may move this chart again. Permit one bounded revisit
   * instead of permanently locking it because an earlier relocation succeeded. */
  const relocateIntoCavity=(ps:RasterPlacement[],gs:number[]):RasterPlacement[]|null=>{
    if(!cavitiesEnabled||report.cavities!.relocations>=Math.min(items.length*2,24)||report.trials>=maxTrials)return null;
    const windows=emptyWindows(boardFor(ps),12,local),old=windows[0]?.cells??0;if(old<boardSize*boardSize*.004)return null;
    for(const w of windows.slice(0,5)){
      for(let i=0;i<items.length;i++){
        if(report.cavities!.relocatedIds.filter(id=>id===items[i]!.chart.id).length>=2||report.trials>=maxTrials)continue;
        const current=ps[i]!,it=items[i]!;if(current.mask.width*current.mask.height>w.cells*1.7)continue;
        // Do not spend the whole budget on unusable rotations of one huge part.
        const board=boardFor(ps,i),angles=options.rotate===false?[current.angle??0]:[...new Set([current.angle??0,0,90,180,270])];
        for(const angle of angles){const mask=getMask(it,gs[i]!,angle);if(!mask||mask.width>w.width||mask.height>w.height)continue;
          report.trials++;report.cavities!.relocationTrials++;
          const p=board.findWindow(mask,w.x,w.y,w.x+w.width-mask.width,w.y+w.height-mask.height,local);if(!p)continue;
          const proposal=ps.slice();proposal[i]={...p,mask,gain:gs[i]!,turn:angle%180===90,rotation:angle%90===0?angle/90:0,angle};
          if(biggest(proposal)<old-Math.max(4,boardSize*boardSize*.001)){
            report.cavities!.relocations++;report.cavities!.relocatedIds.push(it.chart.id);return proposal;
          }
          if(report.trials>=maxTrials)return null;
        }
      }
    }return null;
  };
  let stepNow=step;
  let gains=items.map(()=>1),placements:RasterPlacement[]|null=null;
  const limitFor=(i:number)=>{
    const currentMin=Math.min(...gains.map((g,j)=>g*densities[j]!));
    return Math.max(gains[i]!,Math.min(commonLimit*cap,currentMin*Math.max(cap,spread)/densities[i]!));
  };
  /** A free window gives a conservative scale bound. Test the actual scaled
   * contour at that bound; leave every other island exactly where it is. This
   * is enlargement, not an equal-area relocation, and all density caps apply. */
  const growToVacancy=(i:number):{placement:RasterPlacement;gain:number}|null=>{
    if(!report.vacancyGrowth!.enabled||!adaptive||mode!=='area-priority'||!placements)return null;
    const allowed=limitFor(i),current=gains[i]!;if(allowed<=current*(1+minStep)-1e-10)return null;
    const board=boardFor(placements,i),windows=emptyWindows(board,18,local),it=items[i]!;
    const angles=options.rotate===false?[0]:Array.from({length:360/rotationStep},(_,k)=>k*rotationStep);
    const candidates:{angle:number;gain:number;window:EmptyWindow}[]=[];
    for(const angle of angles){const pose=poseOf(it,angle);
      for(const w of windows){
        const width=Math.min((w.width-1)/R,1-2*base.padding-w.x/R);
        const height=Math.min((w.height-1)/R,1-2*base.padding-w.y/R);
        if(!(width>0&&height>0&&pose.width>0&&pose.height>0))continue;
        const gain=Math.min(allowed,(width/pose.width)**2*(1-1e-12),(height/pose.height)**2*(1-1e-12));
        if(gain>current*(1+minStep)+1e-10)candidates.push({angle,gain,window:w});
      }
    }
    candidates.sort((a,b)=>b.gain-a.gain||a.window.cells-b.window.cells||a.angle-b.angle);
    for(const candidate of candidates.slice(0,8)){
      work?.check();if(report.trials>=maxTrials)return null;
      report.trials++;report.vacancyGrowth!.trials++;attempts[i]!.tries++;
      const {angle,gain,window:w}=candidate,mask=getMask(it,gain,angle);if(!mask)continue;
      const pose=poseOf(it,angle),maxX=Math.min(w.x+w.width-mask.width,Math.floor((1-2*base.padding-pose.width*Math.sqrt(gain))*R+1e-8));
      const maxY=Math.min(w.y+w.height-mask.height,Math.floor((1-2*base.padding-pose.height*Math.sqrt(gain))*R+1e-8));
      const p=board.findWindow(mask,w.x,w.y,maxX,maxY,local);if(!p)continue;
      return{placement:{...p,mask,gain,angle,turn:angle%180===90,rotation:angle%90===0?angle/90:0},gain};
    }return null;
  };
  try {
    uvProgress(work,{stage:'pack',detail:'轮廓精排：建立保守占用网格与留白',current:0,total:items.length,unit:'岛'});
    if(adaptive)placements=preserveSeed();
    if(cavitiesEnabled){const referenceBoard=new RasterBoard(boardSize,gutter);for(const it of items){const m=getMask(it,1,0);if(m)referenceBoard.put(m,Math.round((it.chart.bounds[0]-base.padding)*R),Math.round((it.chart.bounds[1]-base.padding)*R));}report.cavities!.largestBefore=(emptyWindows(referenceBoard,1,local)[0]?.cells??0)/(R*R);}
    if(placements)report.adaptive!.seed='current-layout';else{placements=arrange(gains);report.adaptive!.seed=placements?'contour-reflow':'no-fit';}
    // Cheap equal-density tightening first. It avoids spending an entire costly
    // coordinate-descent sweep discovering the SAME feasible gain for all islands.
    if(placements&&mode==='area-priority')for(let pass=0;pass<(options.fillWarmupPasses??3);pass++){
      if(report.trials>=maxTrials){report.stop='trial-budget';break;}
      const factor=Math.min(1+step,commonLimit/commonGain),next=gains.map(g=>g*factor);if(next.every((g,i)=>g<=gains[i]!+1e-10))break;
      report.trials++;uvProgress(work,{stage:'pack',detail:`轮廓精排：全岛共同放大试装 ${pass+1}（不改变密度比例）`});
      const proposal=arrange(next);if(!proposal)break;placements=proposal;gains=next;commonGain*=factor;report.accepted++;report.commonAccepted++;
      report.after=items.reduce((s,it,i)=>s+it.areaUV*gains[i]!,0);report.history.push({round:0,id:null,occupancy:report.after,areaFactor:gains[0]!});
    }
    if(!placements)report.stop='raster-no-fit';
    else for(let round=0;round<roundLimit;round++){
      report.rounds=round+1;let changed=0,failedLarger=false;
      if(cavitiesEnabled){uvProgress(work,{stage:'pack',detail:`空洞扫描 ${round+1}/${roundLimit} 轮：实际轮廓、孔内与边角空白（不预留实心包围框）`});const moved=relocateIntoCavity(placements!,gains);if(moved){placements=moved;changed++;attempts.forEach(a=>a.minStepFailed=false);}}
      const count=mode==='uniform'?1:items.length;
      for(let i=0;i<count;i++){
       const vacancy=growToVacancy(i);
       if(vacancy){
         if(failedLarger)report.adaptive!.smallerAfterFailure++;
         const next=placements!.slice();next[i]=vacancy.placement;placements=next;gains[i]=vacancy.gain;
         report.vacancyGrowth!.accepted++;report.accepted++;changed++;
         attempts[i]!.accepted++;attempts[i]!.minStepFailed=false;attempts[i]!.nextStep=step;
         report.adaptive!.localAccepted++;
         report.after=items.reduce((sum,it,j)=>sum+it.areaUV*gains[j]!,0);
         report.history.push({round:round+1,id:items[i]!.chart.id,occupancy:report.after,areaFactor:vacancy.gain});
         uvProgress(work,{stage:'pack',detail:`空位适配放大 #${items[i]!.chart.id+1}：面积 ${vacancy.gain.toFixed(3)} 倍，边长 ${Math.sqrt(vacancy.gain).toFixed(3)} 倍（不是搬移计数）`,current:i+1,total:count,unit:'岛'});
       }
       for(let growth=0;growth<(adaptive&&mode==='area-priority'?growthSteps:1);growth++){
        work?.check();if(report.trials>=maxTrials){report.stop='trial-budget';break;}
        const next=gains.map((g,j)=>mode==='uniform'||j===i?Math.max(g,Math.min(mode==='uniform'?g*commonLimit/commonGain:limitFor(j),g*(1+(adaptive&&mode==='area-priority'?attempts[i]!.nextStep:stepNow)))):g);
        if(next.every((g,j)=>g<=gains[j]!+1e-10)){report.adaptive!.skippedAtCap++;break;}
        report.trials++;
        uvProgress(work,{stage:'pack',detail:`空白精排 ${round+1}/${roundLimit} 轮 · ${mode==='uniform'?'共同密度':`大岛优先 #${items[i]!.chart.id+1}`} · 占用 ${(report.after*100).toFixed(2)}%`,current:i+1,total:count,unit:'岛'});
        if(failedLarger)report.adaptive!.smallerAfterFailure++;
        const stat=attempts[i]!;stat.tries++;
        let proposal:RasterPlacement[]|null=adaptive&&mode==='area-priority'?localArrange(next,placements!,i):null;
        const localAccepted=!!proposal;
        if(!proposal)proposal=arrange(next,placements!,mode==='uniform'?0:i);
        // A fixed larger prefix may trap a usable concavity. Spend a bounded
        // number of full reflows, atomically; NEVER shrink any previous island.
        if(!proposal&&adaptive&&mode==='area-priority'&&i>0&&report.search!.reflowTrials<reflowBudget){
          report.search!.reflowTrials++;proposal=arrange(next);if(proposal)report.search!.reflowAccepted++;
        }
        if(!proposal){failedLarger=true;stat.failed++;report.adaptive!.failedTrials++;stat.minStepFailed=stat.nextStep<=minStep+1e-12;if(adaptive)stat.nextStep=Math.max(minStep,stat.nextStep/2);}
        else{stat.accepted++;stat.minStepFailed=false;if(localAccepted)report.adaptive!.localAccepted++;else report.adaptive!.reflowAccepted++;}
        if(proposal){if(mode==='uniform')commonGain*=next[0]!/gains[0]!;placements=proposal;gains=next;changed++;report.accepted++;report.after=items.reduce((s,it,k)=>s+it.areaUV*gains[k]!,0);report.history.push({round:round+1,id:mode==='uniform'?null:items[i]!.chart.id,occupancy:report.after,areaFactor:next[i]!});}
        if(!proposal)break;
       }
       if(report.stop==='trial-budget')break;
      }
      if(report.stop==='trial-budget')break;
      report.search!.completedSweeps++;
      if(!changed){if(adaptive&&mode==='area-priority'){if(attempts.some((s,i)=>!s.minStepFailed&&gains[i]!<limitFor(i)-1e-10)){if(round<roundLimit-1)continue;report.stop='round-limit';break;}}else if(stepNow>.0101&&round<roundLimit-1){stepNow/=2;continue;}report.stop='converged';break;}
      if(round===roundLimit-1)report.stop='round-limit';
    }
  }catch(error){if(error instanceof RasterBudget)report.stop='time-budget';else throw error;}
  let result=base;
  if(placements&&(report.after>base.occupancy+1e-10||report.cavities!.relocations>0)){
    const byId=new Map(items.map((it,i)=>[it.chart.id,{it,p:placements![i]!,g:gains[i]!}]));
    const packed=base.packed.map(ch=>{
      const {it,p,g}=byId.get(ch.id)!,scale=Math.sqrt(g),x=base.padding+p.x/R,y=base.padding+p.y/R;
      const faceUVs=new Map<number,[Vec2,Vec2,Vec2]>();
      for(const [fi,t]of ch.faceUVs)faceUVs.set(fi,t.map(([u,v])=>{u-=ch.bounds[0];v-=ch.bounds[1];const q=poseOf(it,p.angle??(p.rotation??(p.turn?1:0))*90).point([u,v]);return[x+q[0]*scale,y+q[1]*scale];}) as [Vec2,Vec2,Vec2]);
      const pose=poseOf(it,p.angle??(p.rotation??(p.turn?1:0))*90),w=pose.width*scale,h=pose.height*scale;
      return{...ch,faceUVs,bounds:[x,y,x+w,y+h] as [number,number,number,number],polygon:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]] as Vec2[]};
    });
    work?.check();uvProgress(work,{stage:'quality',detail:'精排后检查全部 UV 三角形：翻面、退化、交叠及边距'});
    // Disjoint conservative masks already provide separation; this independent
    // geometric guard also catches transformation and implementation mistakes.
    const q=checkUVTriangles(packed.flatMap(c=>[...c.faceUVs.values()]),100,work);
    const inside=packed.every(c=>c.bounds.every(Number.isFinite)&&c.bounds[0]>=base.padding-1e-9&&c.bounds[1]>=base.padding-1e-9&&c.bounds[2]<=1-base.padding+1e-9&&c.bounds[3]<=1-base.padding+1e-9);
    work?.check();if(q.valid&&inside){report.cavities!.positionOnly=q.area<=base.occupancy+1e-10;report.after=q.area;report.afterBox=packed.reduce((s,c)=>s+(c.bounds[2]-c.bounds[0])*(c.bounds[3]-c.bounds[1]),0);result={...base,packed,occupancy:q.area,boxOccupancy:report.afterBox,packingMethod:'contour'};}
    else {report.stop='validation-rejected';report.note+=' 最终精排几何检查失败，回滚到完整基线。';}
  }
  if(result===base){report.cavities!.largestAfter=report.cavities!.largestBefore;report.after=base.occupancy;report.afterBox=base.boxOccupancy;gains=items.map(()=>1);}
  report.search!.commonGain=result===base?1:commonGain;
  report.search!.islandsTried=attempts.filter(a=>a.tries>0).length;
  report.search!.untriedIds=mode==='uniform'?[]:attempts.filter(a=>a.tries===0).map(a=>a.id);
  if(placements&&result!==base){
    const board=new RasterBoard(boardSize,gutter);for(const p of placements)board.put(p.mask,p.x,p.y);
    report.cavities!.largestAfter=(emptyWindows(board,1,{tick:()=>work?.check()})[0]?.cells??0)/(R*R);
    const seen=new Uint8Array(boardSize*boardSize),regions:{cells:number;bounds:number[]}[]=[];let empty=0;
    const free=(i:number)=>{const y=Math.floor(i/boardSize),x=i%boardSize;return (board.words[y*board.stride+(x>>>5)]!&(1<<(x&31)))===0;};
    for(let i=0;i<seen.length;i++)if(!seen[i]&&free(i)){work?.check();const queue=[i];seen[i]=1;let x0=boardSize,y0=boardSize,x1=0,y1=0;
      for(let h=0;h<queue.length;h++){const k=queue[h]!,x=k%boardSize,y=Math.floor(k/boardSize);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
        for(const j of [x>0?k-1:-1,x+1<boardSize?k+1:-1,y>0?k-boardSize:-1,y+1<boardSize?k+boardSize:-1])if(j>=0&&!seen[j]&&free(j)){seen[j]=1;queue.push(j);}}
      empty+=queue.length;regions.push({cells:queue.length,bounds:[x0/R+base.padding,y0/R+base.padding,(x1+1)/R+base.padding,(y1+1)/R+base.padding]});
    }
    report.search!.freeGridFraction=empty/(R*R);report.search!.emptyRegions=regions.sort((a,b)=>b.cells-a.cells).slice(0,5);
  }
  report.gains=items.map((it,i)=>({id:it.chart.id,area3D:it.area3D,areaFactor:gains[i]!,linearFactor:Math.sqrt(gains[i]!)}));const finalDensities=items.map((it,i)=>it.areaUV/it.area3D*gains[i]!);report.densitySpreadAfter=Math.max(...finalDensities)/Math.min(...finalDensities);report.elapsedMs=performance.now()-start;
  report.growth=auditFillGrowth(base.packed,result.packed,reference,{density:Math.max(cap,spread),absoluteGain:mode==='uniform'?commonLimit:commonLimit*cap,mode,stop:report.stop,commonAccepted:report.commonAccepted},attempts);
  return{...result,packingReport:{...base.packingReport!,refinement:report}};
}

export function describeFill(report:FillReport):string {
  const stop={converged:'本次方向/分辨率/最小步长下无可接受改进（不是全局最优证明）','round-limit':'达到轮数上限','trial-budget':'达到尝试预算','time-budget':'达到搜索时间预算','raster-no-fit':'当前分辨率未找到不缩小的完整布局','validation-rejected':'最终验证不通过，已回退'}[report.stop];
  return `空白精排：${(report.before*100).toFixed(2)}% → ${(report.after*100).toFixed(2)}%，增加 ${((report.after-report.before)*100).toFixed(2)} 个百分点；尝试 ${report.trials} 次，接受 ${report.accepted} 次。${report.adaptive?`失败大岛之后继续尝试较小岛 ${report.adaptive.smallerAfterFailure} 次；局部扩张 ${report.adaptive.localAccepted} 次。`:""}${report.search?`整轮完成 ${report.search.completedSweeps} 次；未尝试 ${report.search.untriedIds.length} 岛；大岛整体重排 ${report.search.reflowAccepted}/${report.search.reflowTrials} 次。`:''}${report.cavities?.enabled?`空洞定向放置 ${report.cavities.windowAccepted} 次，等面积搬移 ${report.cavities.relocations} 次；最大空白矩形 ${(report.cavities.largestBefore*100).toFixed(2)}% → ${(report.cavities.largestAfter*100).toFixed(2)}%（保守栅格，非纹理占用率）。`:''}${report.growth?`实际放大 ${report.growth.enlarged}/${report.growth.rows.length} 岛，面积增益 ${report.growth.minAreaFactor.toFixed(3)}–${report.growth.maxAreaFactor.toFixed(3)} 倍；${report.growth.densityLimited} 岛被密度差上限限制。`:''}${stop}。最大/最小平均面积密度 ${report.densitySpreadAfter.toFixed(3)} 倍。`;
}
