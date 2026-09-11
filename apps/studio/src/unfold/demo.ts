import { makeCube } from '@meshtailor/mesh-core';
import { generateGeometricSeams, buildGenerationFrames } from '@meshtailor/runtime';
import { buildCharts, planarPackPreview, meshWithPreviewUV } from '@meshtailor/uv';
/** Small deterministic, genuinely six-island demo. No external asset or model. */
export function makeUnfoldDemo(){
  const original=makeCube();
  const result=generateGeometricSeams(original,{structuralRings:0});
  const packed=planarPackPreview(original,buildCharts(original,result.seamEdges));
  const mesh=meshWithPreviewUV(original,packed);mesh.name='Six-island correspondence cube';
  return {mesh,edges:result.seamEdges,chains:result.chains,frames:buildGenerationFrames(mesh,result.chains)};
}
