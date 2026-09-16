import type { UnfoldGeometry } from './unfold.js';
/** Stable real source-surface area order. No UV density / box / click-order bias.
 * Weak caching is safe because snapshots are immutable; this never runs per face per tick. */
const cache = new WeakMap<UnfoldGeometry, Map<number, number>>();
export function playbackAreas(data: UnfoldGeometry): ReadonlyMap<number, number> {
  let areas = cache.get(data); if (areas) return areas;
  areas = new Map();
  for (const island of data.islands) {
    let area = 0;
    for (const face of island.faces) {
      const p = face * 9, s = data.source;
      const ax=s[p+3]!-s[p]!, ay=s[p+4]!-s[p+1]!, az=s[p+5]!-s[p+2]!;
      const bx=s[p+6]!-s[p]!, by=s[p+7]!-s[p+1]!, bz=s[p+8]!-s[p+2]!;
      area += Math.hypot(ay*bz-az*by, az*bx-ax*bz, ax*by-ay*bx) * .5;
    }
    areas.set(island.id, area);
  }
  cache.set(data, areas); return areas;
}
export function areaOrderedIslands(data: UnfoldGeometry, ids: readonly number[]): number[] {
  const areas = playbackAreas(data);
  return [...new Set(ids)].filter(id=>areas.has(id)).sort((a,b)=>areas.get(b)!-areas.get(a)! || a-b);
}
export const PLAYBACK_RATES = [.25, .5, 1, 2, 4, 8, 16, 32, 64] as const;
export function validPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < .25 || rate > 64) throw new Error('Playback rate must be 0.25–64.');
  return rate;
}
export function playbackWallSeconds(baseSeconds: number, rate: number): number {
  return Math.max(0, baseSeconds) / validPlaybackRate(rate);
}
