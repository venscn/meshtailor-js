import type { MeshData } from '@meshtailor/mesh-core';
import { extractSeamEdgesFromUV } from '@meshtailor/chaining-seams';
import { buildCharts, buildUnfoldGeometry, planarPackPreview, sourceUVPreview, type PackedChart, type UnfoldGeometry } from '@meshtailor/uv';
export type UVTarget = 'generated' | 'source';
export interface UVSnapshot { packed: PackedChart[]; geometry: UnfoldGeometry; seams: string[]; target: UVTarget; warnings: string[] }
export type UVResult = {ok:true;snapshot:UVSnapshot}|{ok:false;error:string};
export interface UVJob {mesh:MeshData;edges:string[];target:UVTarget}
self.onmessage=(event:MessageEvent<UVJob>)=>{
  try{
    const {mesh,edges,target}=event.data;
    // Imported UVs define their own cut topology. Do not overlay unrelated baseline seams.
    const seams=target==='source'?extractSeamEdgesFromUV(mesh):new Set(edges);
    const charts=buildCharts(mesh,seams);
    const packed=target==='source'?sourceUVPreview(mesh,charts):planarPackPreview(mesh,charts);
    const geometry=buildUnfoldGeometry(mesh,packed,seams);
    const warnings=[target==='source'?'原始 UV 坐标原样保留；重叠、镜像和超出 0–1 的部分不会自动修复。':'生成目标仍为平面投影调试 UV，不是 ABF++/LSCM；曲面可能重叠或退化。'];
    if(charts.length===1)warnings.push('当前裁切仍只有 1 个连通 UV 岛。增加能切断面邻接的接缝后才会形成更多独立岛。');
    const snapshot:UVSnapshot={packed,geometry,seams:[...seams],target,warnings};
    self.postMessage({ok:true,snapshot} satisfies UVResult,{transfer:[geometry.source.buffer,geometry.target.buffer,geometry.uv.buffer,geometry.faceChart.buffer,geometry.boundaries.buffer]});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)} satisfies UVResult);}
};
