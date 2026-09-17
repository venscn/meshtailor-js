import {geometryOnlyMesh,type MeshData,type MeshAnalysis} from '@meshtailor/mesh-core';
import {canonicalOrder,traceSeamChains,type SeamChain} from '@meshtailor/chaining-seams';
import type {GeometricBaselineOptions} from '@meshtailor/runtime';
import {unwrapMesh,geometryGenerationOptions,recommendUnwrap,type UnwrapOptions} from '@meshtailor/uv';
export interface SeamJob {kind:'baseline'|'uv-seams'|'auto-large'|'auto-balanced';mesh:MeshData;options?:GeometricBaselineOptions}
export type SeamResult={ok:true;edges:string[];chains:SeamChain[];elapsedMs:number;parameters?:UnwrapOptions;analysis?:MeshAnalysis;regionCount?:number;mergedCount?:number}|{ok:false;error:string};
self.onmessage=(event:MessageEvent<SeamJob>)=>{
 const start=performance.now();try{
  if(event.data.kind==='uv-seams')throw Error('原 UV 提取已移除，请从几何生成。');
  const mesh=geometryOnlyMesh(event.data.mesh),r=recommendUnwrap(mesh,event.data.kind==='auto-balanced'?'balanced':'large');
  const parameters=geometryGenerationOptions(mesh,r.options),u=unwrapMesh(mesh,new Set(),parameters),edges=new Set(u.seams);
  self.postMessage({ok:true,edges:[...edges],chains:canonicalOrder(mesh,traceSeamChains(mesh,edges)),elapsedMs:performance.now()-start,parameters,analysis:r.analysis,regionCount:u.peel?.groups.length} satisfies SeamResult);
 }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)} satisfies SeamResult);}
};
