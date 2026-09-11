import type { MeshData } from '@meshtailor/mesh-core';
import { buildCharts, planarPackPreview, type PackedChart } from '@meshtailor/uv';
export type UVResult={ok:true;packed:PackedChart[]}|{ok:false;error:string};
self.onmessage=(event:MessageEvent<{mesh:MeshData;edges:string[]}>)=>{
  try{const {mesh,edges}=event.data;self.postMessage({ok:true,packed:planarPackPreview(mesh,buildCharts(mesh,new Set(edges)))} satisfies UVResult);}
  catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)} satisfies UVResult);}
};
