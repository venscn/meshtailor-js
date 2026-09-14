import type {Vec3} from '@meshtailor/mesh-core';
import type {UnfoldIsland} from './unfold.js';
/** Ratio of the input model's longest bounding-box side (normalized to 2 units).
 * Deliberately independent of island count, island radius and queue order.
 */
export const DEFAULT_SEPARATION=.12;
export const MAX_SEPARATION=.5;
export function separationOffset(island:UnfoldIsland,ratio:number):Vec3 {
  if(!Number.isFinite(ratio)||ratio<0)throw new Error('Separation must be finite and nonnegative.');
  const distance=Math.min(MAX_SEPARATION,ratio)*2;
  return island.direction.map(v=>v*distance) as Vec3;
}
