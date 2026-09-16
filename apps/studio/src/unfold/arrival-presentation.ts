import { islandTimelineProgress, type UnfoldOptions } from '@meshtailor/uv';

/** Presentation-only seconds. They never extend or rescale the geometry queue. */
export interface ArrivalSettings {
  arrivalHoldSeconds?: number;
  arrivalFadeSeconds?: number;
  /** Explicit reverse playback must not create false UV arrivals. */
  playbackReverse?: boolean;
}
export const ARRIVAL_DEFAULTS = { arrivalHoldSeconds: .8, arrivalFadeSeconds: 1 };
const bounded = (v: number | undefined, fallback: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(5, v!)) : fallback;
export function arrivalSettings(o: ArrivalSettings) {
  return {
    hold: bounded(o.arrivalHoldSeconds, ARRIVAL_DEFAULTS.arrivalHoldSeconds),
    fade: bounded(o.arrivalFadeSeconds, ARRIVAL_DEFAULTS.arrivalFadeSeconds),
  };
}
export interface ArrivalState {
  id: number;
  phase: 'hold' | 'fade';
  /** 1 = full island colour, 0 = normal ghost context. */
  weight: number;
  opacity: number;
  ageSeconds: number;
}
type Input = UnfoldOptions & ArrivalSettings & {
  interactionActive?: boolean;
  focusMode?: 'off' | 'ghost' | 'dither';
  focusOpacity?: number;
};

/** Detect arrival EVENTS, not simply `localProgress === 1`. A completed island
 * cannot restart its timer on each render. Clock is monotonic visible wall time
 * supplied by the renderer, independent of animation speed and scrubbing rate. */
export class ArrivalPresentation {
  private arrivals = new Map<number, number>();
  private previous: number | null = null;
  private queueKey = '';
  private timeline: UnfoldOptions['timeline'];

  reset() {
    this.arrivals.clear();
    this.previous = null;
    this.queueKey = '';
    this.timeline = undefined;
  }

  update(o: Input, nowMs: number): ArrivalState[] {
    const enabled = o.interactionActive === true && (o.focusMode ?? 'ghost') === 'ghost';
    if (!enabled || !Number.isFinite(nowMs) || !Number.isFinite(o.progress) ||
        o.progress <= 0 || o.progress >= 1 || o.selected.length === 0) {
      this.reset();
      // Retain a session's source endpoint so a fast first frame can cross an end.
      if (enabled && o.progress === 0) this.remember(o);
      return [];
    }
    const key = this.key(o);
    if (key !== this.queueKey || o.timeline !== this.timeline) {
      this.reset();
      this.remember(o);
      return [];
    }
    if (o.playbackReverse || (this.previous !== null && o.progress < this.previous - 1e-12)) {
      this.arrivals.clear();
      this.previous = o.progress;
      return [];
    }
    if (this.previous !== null && o.progress > this.previous) {
      for (let i = 0; i < o.selected.length; i++) {
        // An already-flat zero-duration island has no arrival event to display.
        if (o.timeline && o.timeline.entries[i]?.profile.duration === 0) continue;
        const end = islandTimelineProgress(1, i, o.selected.length, o.order, o.handoff, o.timeline);
        if (this.previous < end && o.progress >= end) this.arrivals.set(o.selected[i]!, nowMs);
      }
    }
    this.previous = o.progress;
    return this.sample(o, nowMs);
  }

  private key(o: Input) {
    return JSON.stringify([o.selected, o.order, o.handoff, o.path, o.separation, o.holdNet, o.hingeWave]);
  }
  private remember(o: Input) {
    this.queueKey = this.key(o);
    this.timeline = o.timeline;
    this.previous = o.progress;
  }
  private sample(o: Input, nowMs: number): ArrivalState[] {
    const { hold, fade } = arrivalSettings(o);
    const background = Number.isFinite(o.focusOpacity) ? Math.max(.03, Math.min(.65, o.focusOpacity!)) : .18;
    const states: ArrivalState[] = [];
    for (const [id, started] of this.arrivals) {
      const age = Math.max(0, (nowMs - started) / 1000);
      if (age >= hold + fade) { this.arrivals.delete(id); continue; }
      const t = age <= hold ? 0 : Math.min(1, (age - hold) / Math.max(fade, 1e-12));
      const weight = 1 - t * t * (3 - 2 * t);
      states.push({ id, phase: age < hold ? 'hold' : 'fade', weight,
        opacity: background + (1 - background) * weight, ageSeconds: age });
    }
    return states;
  }
}
