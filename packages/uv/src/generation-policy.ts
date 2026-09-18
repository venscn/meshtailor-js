import type {MeshData} from '@meshtailor/mesh-core';
import {recommendUnwrap,type UnwrapOptions} from './unwrap.js';
/** All automatic entry points use this resolver. User-drawn explicit seams may
 * enter separately; old source islands, UV indices and inferred source seams may not. */
export function geometryGenerationOptions(mesh:MeshData,base:Partial<UnwrapOptions>={}):UnwrapOptions {
  return {...recommendUnwrap(mesh,base.chartPolicy==='balanced'?'balanced':'large').options,...base,
    initialSegmentation:'hierarchical',peelSourceHints:false,projectionSeed:true,featureFrame:undefined,
    sourceRepairPolicy:'reject',sourceFeaturePolicy:'preserve',sourceAtlasMerge:false,
    postMerge:base.postMerge??false,
    humanTemplates:base.humanTemplates?{...base.humanTemplates,selectedCharts:undefined}:undefined,
  };
}
