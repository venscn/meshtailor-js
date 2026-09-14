import type { MeshData } from '@meshtailor/mesh-core';
import { extractSeamEdgesFromUV } from '@meshtailor/chaining-seams';
import { buildCharts, buildUnfoldGeometry, unwrapMesh, sourceUVPreview, type UnwrapOptions, type ChartDiagnostic, type PackedChart, type UnfoldGeometry } from '@meshtailor/uv';
export type UVTarget = 'generated' | 'source';
export interface UVSnapshot {
  packed:PackedChart[]; geometry:UnfoldGeometry; seams:string[]; target:UVTarget; warnings:string[];
  addedSeams?:string[]; diagnostics?:ChartDiagnostic[];
  metrics?:{occupancy:number;boxOccupancy:number;padding:number;validated:boolean;elapsedMs:number};
}
export type UVResult = {ok:true;snapshot:UVSnapshot}|{ok:false;error:string};
export interface UVJob {mesh:MeshData;edges:string[];target:UVTarget;config?:Partial<UnwrapOptions>}
self.onmessage=(event:MessageEvent<UVJob>)=>{
  try{
    const start=performance.now(),{mesh,edges,target,config}=event.data;
    let seams=target==='source'?extractSeamEdgesFromUV(mesh):new Set(edges);
    let snapshot:UVSnapshot;
    if(target==='source'){
      const packed=sourceUVPreview(mesh,buildCharts(mesh,seams));
      snapshot={packed,geometry:buildUnfoldGeometry(mesh,packed,seams),seams:[...seams],target,warnings:['原始 UV 原样保留，未修复重叠、镜像、退化或越界。需要重新展开时选择“拓扑展开 + 面积排布”。']};
    }else{
      const result=unwrapMesh(mesh,seams,config);seams=new Set(result.seams);
      snapshot={packed:result.packed,geometry:buildUnfoldGeometry(mesh,result.packed,seams),seams:result.seams,target,warnings:result.warnings,addedSeams:result.addedSeams,diagnostics:result.diagnostics,metrics:{occupancy:result.occupancy,boxOccupancy:result.boxOccupancy,padding:result.padding,validated:true,elapsedMs:performance.now()-start}};
    }
    const rig=snapshot.geometry.hinge;
    if(rig?.temporaryCuts.length)snapshot.warnings.push(`铰链教学动画有 ${rig.temporaryCuts.length/4} 条临时断边（紫色），用于解除曲面闭环；这些不是 UV 裁切，不写入导出。80–92% 单独显示向 UV 的非刚性形变。`);
    // Structured clone preserves Maps and typed arrays. Transfer all large numeric
    // buffers, including the rig; no accidental detached-buffer alias is reused.
    const buffers=new Set<ArrayBuffer>();
    const visit=(v:unknown)=>{if(ArrayBuffer.isView(v)&&v.buffer instanceof ArrayBuffer)buffers.add(v.buffer);else if(v&&typeof v==='object'&&!(v instanceof Map))for(const child of Object.values(v))visit(child);};
    visit(snapshot.geometry);self.postMessage({ok:true,snapshot} satisfies UVResult,{transfer:[...buffers]});
  }catch(error){self.postMessage({ok:false,error:error instanceof Error?error.message:String(error)} satisfies UVResult);}
};
