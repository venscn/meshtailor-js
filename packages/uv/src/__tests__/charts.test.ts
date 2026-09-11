import { describe, expect, it } from 'vitest';
import { makeCube, edgeKey } from '@meshtailor/mesh-core';
import { buildCharts } from '../index.js';
it('seams split face adjacency',()=>{
  const mesh=makeCube();
  const seams=new Set([edgeKey(0,2)]);
  expect(buildCharts(mesh,seams).length).toBeGreaterThanOrEqual(1);
});
