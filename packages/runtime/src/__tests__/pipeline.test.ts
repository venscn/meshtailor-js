import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTopology, makeCylinder, parseOBJ } from '@meshtailor/mesh-core';
import { canonicalOrder, extractSeamEdgesFromUV, traceSeamChains } from '@meshtailor/chaining-seams';
import { buildCharts, planarPackPreview } from '@meshtailor/uv';
import { buildGenerationFrames, generateGeometricSeams } from '../index.js';

describe('end-to-end reproduction plumbing',()=>{
  it('extracts OBJ UV islands into a valid autoregressive stream',()=>{
    const mesh=parseOBJ(fs.readFileSync('examples/cube_uv.obj','utf8'),'cube_uv.obj');
    const seams=extractSeamEdgesFromUV(mesh); expect(seams.size).toBe(12);
    const chains=canonicalOrder(mesh,traceSeamChains(mesh,seams));
    const frames=buildGenerationFrames(mesh,chains); expect(frames.at(-1)?.tokenLabel).toBe('[EOS]');
  });
  it('keeps every baseline traversal on the mesh graph',()=>{
    const mesh=makeCylinder(12); const result=generateGeometricSeams(mesh); const frames=buildGenerationFrames(mesh,result.chains); const topology=buildTopology(mesh);
    for(const frame of frames) if(frame.token>=0 && frame.previousVertex!==null) expect(topology.neighbors[frame.previousVertex]).toContain(frame.currentVertex);
    const charts=buildCharts(mesh,result.seamEdges); expect(planarPackPreview(mesh,charts)).toHaveLength(charts.length);
  });
});
