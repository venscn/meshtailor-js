import type { MeshData } from '@meshtailor/mesh-core';
import type { CandidateMask } from '@meshtailor/runtime';

export interface PointerStepInput { mesh:MeshData; sequence:number[]; mask:CandidateMask }
export interface PointerStepOutput { logits:Map<number,number>; eocLogit?:number; eosLogit?:number }

/** Adapter boundary for future official/converted weights. */
export interface MeshTailorBackend {
  readonly name:string;
  prepare(mesh:MeshData):Promise<void>;
  pointerStep(input:PointerStepInput):Promise<PointerStepOutput>;
  dispose?():void;
}

export class MissingWeightsBackend implements MeshTailorBackend {
  readonly name='MeshTailor-v2 (weights required)';
  async prepare(_mesh:MeshData):Promise<void>{
    throw new Error('Official MeshTailor code/checkpoint is not published yet. Use the geometric baseline or supply a converted backend.');
  }
  async pointerStep(_input:PointerStepInput):Promise<PointerStepOutput>{return {logits:new Map()};}
}
