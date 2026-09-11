import { describe,expect,it } from 'vitest';
import { makeCube } from '@meshtailor/mesh-core';
import { candidateMask } from '../index.js';
it('restricts continuation to 1-ring and removes backtracking',()=>{
  const mesh=makeCube(); const m=candidateMask(mesh,1,0);
  expect(m.vertices).not.toContain(0); expect(m.allowEOC).toBe(true); expect(m.allowEOS).toBe(true);
});
