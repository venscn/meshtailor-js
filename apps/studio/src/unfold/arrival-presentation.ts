import { islandTimelineProgress, unfoldDuration, type UnfoldOptions } from '@meshtailor/uv';

/** All durations are 1x ANIMATION seconds, never wall-clock timers. */
export interface ArrivalSettings {
  arrivalHoldSeconds?: number;
  arrivalFadeSeconds?: number;
  /** Duration of the complete, static-span-compressed geometry queue at 1x. */
  animationDurationSeconds?: number;
  playbackReverse?: boolean;
}
export const ARRIVAL_DEFAULTS = { arrivalHoldSeconds: .8, arrivalFadeSeconds: 1 };
const bounded = (v: number | undefined, fallback: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(5, v!)) : fallback;
export function arrivalSettings(o: ArrivalSettings) {
  return { hold: bounded(o.arrivalHoldSeconds, .8), fade: bounded(o.arrivalFadeSeconds, 1) };
}
export interface ArrivalState {
  id: number;
  phase: 'hold' | 'fade';
  weight: number;
  opacity: number;
  /** Elapsed animation seconds since this island's complete geometric arrival. */
  ageSeconds: number;
}
type Input = UnfoldOptions & ArrivalSettings & {
  interactionActive?: boolean;
  focusMode?: 'off' | 'ghost' | 'dither';
  focusOpacity?: number;
};

/** A deterministic presentation track evaluated on the SAME clock as the mesh.
 * A seek produces the same colour in either direction. Stopping a held scrub
 * freezes this track; changing rate changes only the player's time increment.
 * No Date/performance timer, event history, or render-rate dependent arrivals.
 * Overlay tails may overlap the next island and never delay its handoff.
 */
export class ArrivalPresentation {
  reset() { /* No event state survives pause, seek, model replacement or looping. */ }
  update(o: Input, _unusedWallTime?: number): ArrivalState[] {
    if (!o.interactionActive || (o.focusMode ?? 'ghost') !== 'ghost' ||
        !Number.isFinite(o.progress) || o.progress <= 0 || o.progress >= 1) return [];
    const duration = o.animationDurationSeconds ?? unfoldDuration(12, o.selected.length, o.order, o.handoff, o.timeline);
    if (!Number.isFinite(duration) || duration <= 0) return [];
    const { hold, fade } = arrivalSettings(o);
    const background = Number.isFinite(o.focusOpacity) ? Math.max(.03, Math.min(.65, o.focusOpacity!)) : .18;
    const states: ArrivalState[] = [];
    for (let i = 0; i < o.selected.length; i++) {
      if (o.timeline?.entries[i]?.profile.duration === 0) continue;
      const end = islandTimelineProgress(1, i, o.selected.length, o.order, o.handoff, o.timeline);
      const age = (o.progress - end) * duration;
      if (age < -1e-10 || age >= hold + fade) continue;
      const elapsed = Math.max(0, age);
      const t = elapsed <= hold ? 0 : Math.min(1, (elapsed - hold) / Math.max(fade, 1e-12));
      const weight = 1 - t * t * (3 - 2 * t);
      states.push({ id: o.selected[i]!, phase: elapsed < hold ? 'hold' : 'fade', weight,
        opacity: background + (1 - background) * weight, ageSeconds: elapsed });
    }
    return states;
  }
}
