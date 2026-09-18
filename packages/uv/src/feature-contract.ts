import type {Vec2} from '@meshtailor/mesh-core';
/** Geometric landmark check, not a learned/human semantic score. Both arguments
 * refer to the SAME cut vertices. Reference is a validated projection of source
 * positions, never source TEXCOORDs. Remove only global translation, proper
 * rotation and uniform scale before comparing every boundary vertex and hole. */
export interface FeatureContractReport {
  valid:boolean; boundaryLoops:number; holes:number; boundaryRMS:number;
  boundaryMax:number; holeAreaRatios:number[]; holeCenterDrift:number[];
}
export function featureContract(reference:readonly Vec2[],candidate:readonly Vec2[],loops:readonly (readonly number[])[]):FeatureContractReport {
 const fail:FeatureContractReport={valid:false,boundaryLoops:loops.length,holes:Math.max(0,loops.length-1),boundaryRMS:Infinity,boundaryMax:Infinity,holeAreaRatios:[],holeCenterDrift:[]};
 if(reference.length!==candidate.length||!loops.length||reference.some(p=>!p.every(Number.isFinite))||candidate.some(p=>!p.every(Number.isFinite)))return fail;
 const ids=[...new Set(loops.flat())];if(ids.some(v=>!reference[v])||ids.length<3)return fail;
 const center=(ps:readonly Vec2[])=>ids.reduce((s,v)=>[s[0]+ps[v]![0]/ids.length,s[1]+ps[v]![1]/ids.length] as Vec2,[0,0] as Vec2);
 const a=center(reference),b=center(candidate);let den=0,re=0,im=0;
 for(const v of ids){const x=candidate[v]![0]-b[0],y=candidate[v]![1]-b[1],u=reference[v]![0]-a[0],w=reference[v]![1]-a[1];den+=x*x+y*y;re+=x*u+y*w;im+=x*w-y*u;}
 if(!(den>0))return fail;re/=den;im/=den;
 const aligned=candidate.map(p=>{const x=p[0]-b[0],y=p[1]-b[1];return[a[0]+re*x-im*y,a[1]+im*x+re*y] as Vec2;});
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const v of ids){x0=Math.min(x0,reference[v]![0]);x1=Math.max(x1,reference[v]![0]);y0=Math.min(y0,reference[v]![1]);y1=Math.max(y1,reference[v]![1]);}
 const span=Math.hypot(x1-x0,y1-y0);if(!(span>0))return fail;
 const area=(ps:readonly Vec2[],l:readonly number[])=>l.reduce((s,v,i)=>{const p=ps[v]!,q=ps[l[(i+1)%l.length]!]!;return s+p[0]*q[1]-p[1]*q[0];},0)/2;
 const original=loops.map(l=>area(reference,l)),outer=original.reduce((best,x,i)=>Math.abs(x)>Math.abs(original[best]!)?i:best,0);
 let sum=0,max=0;for(const v of ids){const d=Math.hypot(aligned[v]![0]-reference[v]![0],aligned[v]![1]-reference[v]![1])/span;sum+=d*d;max=Math.max(max,d);}
 const ratios:number[]=[],drift:number[]=[];
 for(let i=0;i<loops.length;i++)if(i!==outer){const l=loops[i]!,ratio=area(aligned,l)/original[i]!;ratios.push(ratio);const c=l.reduce((s,v)=>[s[0]+(aligned[v]![0]-reference[v]![0])/l.length,s[1]+(aligned[v]![1]-reference[v]![1])/l.length] as Vec2,[0,0] as Vec2);drift.push(Math.hypot(...c)/span);}
 const rms=Math.sqrt(sum/ids.length);
 return{valid:rms<=.04&&max<=.12&&ratios.every(x=>Number.isFinite(x)&&x>=.5&&x<=2)&&drift.every(x=>x<=.06),boundaryLoops:loops.length,holes:loops.length-1,boundaryRMS:rms,boundaryMax:max,holeAreaRatios:ratios,holeCenterDrift:drift};
}
