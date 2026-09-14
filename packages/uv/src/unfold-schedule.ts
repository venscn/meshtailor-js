/** Shared, seekable island timeline. Durations are in PER-ISLAND units, not
 * whole-mesh units. Geometry, labels and both players must use this mapping. */
export type UnfoldOrder = 'relay' | 'sequential' | 'together';
/** `together` is accepted only as a legacy input and now means late relay.
 * No mode starts all islands at once. */
export const DEFAULT_UNFOLD_ORDER: UnfoldOrder = 'relay';
export const DEFAULT_HANDOFF = .85;
export const MIN_HANDOFF = .75;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const finite = (x: number, name: string) => { if (!Number.isFinite(x)) throw new Error(`${name} must be finite.`); return x; };
const size = (count: number) => { if (!Number.isSafeInteger(count) || count < 0) throw new Error('Island count must be a nonnegative safe integer.'); return count; };
export function unfoldHandoff(order: UnfoldOrder, handoff = DEFAULT_HANDOFF): number {
  finite(handoff, 'Handoff');
  if (!['relay', 'sequential', 'together'].includes(order)) throw new Error('Unknown unfolding order.');
  return order === 'sequential' ? 1 : Math.max(MIN_HANDOFF, Math.min(1, handoff));
}
export function unfoldSpan(count: number, order: UnfoldOrder, handoff = DEFAULT_HANDOFF): number {
  const step = unfoldHandoff(order, handoff);
  return size(count) ? 1 + (count - 1) * step : 0;
}
export function unfoldDuration(seconds: number, count: number, order: UnfoldOrder, handoff = DEFAULT_HANDOFF): number {
  if (finite(seconds, 'Island duration') <= 0) throw new Error('Island duration must be positive.');
  return seconds * unfoldSpan(count, order, handoff);
}
export function islandProgress(progress: number, index: number, count: number, order: UnfoldOrder, handoff = DEFAULT_HANDOFF): number {
  const time = clamp(finite(progress, 'Progress')) * unfoldSpan(count, order, handoff);
  if (!Number.isInteger(index) || index < 0 || index >= count) return 0;
  // Explicit endpoints prevent a last island remaining at 99.999999%.
  if (progress >= 1) return 1;
  if (progress <= 0) return 0;
  const local = time - index * unfoldHandoff(order, handoff);
  return local < 1e-12 ? 0 : local > 1 - 1e-12 ? 1 : clamp(local);
}
export function islandTimelineProgress(local: number, index: number, count: number, order: UnfoldOrder, handoff = DEFAULT_HANDOFF): number {
  finite(local, 'Local progress');
  const span = unfoldSpan(count, order, handoff);
  if (!span || !Number.isInteger(index) || index < 0 || index >= count) return 0;
  return clamp((index * unfoldHandoff(order, handoff) + clamp(local)) / span);
}
export interface UnfoldScheduleSample {
  completed: number; waiting: number;
  active: { index: number; progress: number }[];
  /** Oldest unfinished island forward; newest unfinished island in reverse. */
  focusIndex: number;
}
/** At most two active entries, even with thousands of islands. */
export function sampleUnfoldSchedule(progress: number, count: number, order: UnfoldOrder, handoff = DEFAULT_HANDOFF, reverse = false): UnfoldScheduleSample {
  finite(progress, 'Progress');
  const span = unfoldSpan(count, order, handoff), step = unfoldHandoff(order, handoff);
  if (!count) return { completed: 0, waiting: 0, active: [], focusIndex: -1 };
  const time = clamp(progress) * span;
  let completed = Math.min(count, Math.max(0, Math.floor((time - 1 + 1e-12) / step) + 1));
  if (progress >= 1) completed = count;
  const active: UnfoldScheduleSample['active'] = [];
  for (let i = completed; i < Math.min(count, completed + 2); i++) {
    const p = islandProgress(progress, i, count, order, handoff);
    if (p > 0 && p < 1) active.push({ index: i, progress: p });
  }
  return {
    completed, waiting: count - completed - active.length, active,
    focusIndex: active.length ? active[reverse ? active.length - 1 : 0]!.index : Math.min(count - 1, completed),
  };
}
/** No frame-delta cap: low frame rate must not secretly lengthen playback.
 * Hidden-tab time is excluded by the caller resetting its RAF timestamp. */
export function advanceUnfoldPlayback(progress: number, elapsedMs: number, durationSeconds: number, reverse = false, loop = false): { progress: number; finished: boolean } {
  finite(progress, 'Progress'); finite(elapsedMs, 'Elapsed time'); finite(durationSeconds, 'Duration');
  if (elapsedMs < 0) throw new Error('Elapsed time must be nonnegative.');
  if (durationSeconds <= 0) return { progress: clamp(progress), finished: true };
  const next = clamp(progress) + (reverse ? -1 : 1) * elapsedMs / (durationSeconds * 1000);
  if (loop && (next > 1 || next < 0)) return { progress: ((next % 1) + 1) % 1, finished: false };
  return { progress: clamp(next), finished: !loop && (reverse ? next <= 0 : next >= 1) };
}
