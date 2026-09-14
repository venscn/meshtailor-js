import type { MeshData } from '@meshtailor/mesh-core';
import { canonicalOrder, extractSeamEdgesFromUV, traceSeamChains, type SeamChain } from '@meshtailor/chaining-seams';
import { generateGeometricSeams, type GeometricBaselineOptions } from '@meshtailor/runtime';
import { recommendUnwrap, type UnwrapOptions } from '@meshtailor/uv';
export interface SeamJob { kind:'baseline'|'uv-seams'|'auto-large'|'auto-balanced'; mesh:MeshData; options?:GeometricBaselineOptions }
export type SeamResult={ok:true;edges:string[];chains:SeamChain[];elapsedMs:number;parameters?:UnwrapOptions;regionCount?:number;mergedCount?:number}|{ok:false;error:string};
self.onmessage=(event:MessageEvent<SeamJob>)=>{
  const start=performance.now();
  try{
    const {kind,mesh,options}=event.data;
    if(kind!=='uv-seams'){
      const goal=kind==='auto-balanced'?'balanced':kind==='auto-large'?'large':options?.goal??'large';
      const parameters=recommendUnwrap(mesh,goal).options;
      const result=generateGeometricSeams(mesh,kind.startsWith('auto-')?{strategy:'adaptive',goal}:options);
      self.postMessage({ok:true,edges:[...result.seamEdges],chains:result.chains,parameters,regionCount:result.regions,mergedCount:result.mergedRegions,elapsedMs:performance.now()-start} satisfies SeamResult);
    }else{
      const edges=extractSeamEdgesFromUV(mesh),chains=canonicalOrder(mesh,traceSeamChains(mesh,edges));
      self.postMessage({ok:true,edges:[...edges],chains,elapsedMs:performance.now()-start} satisfies SeamResult);
    }
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)} satisfies SeamResult);}
};
