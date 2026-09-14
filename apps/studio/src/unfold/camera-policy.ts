/** Playback owns mesh positions, never the camera unless the user explicitly opts in. */
export const DEFAULT_AUTO_FRAME = false;

/**
 * A manual gesture latches follow off immediately in the renderer. This also protects
 * against a React render that still carries autoFrame=true before the UI catches up.
 * Only an acknowledged off -> on request may resume following, not a new animation
 * frame, pause/resume, loop boundary, selection change, or pointer release.
 */
export class CameraFollowPolicy {
  private requested = DEFAULT_AUTO_FRAME;
  private interrupted = false;

  get active(): boolean { return this.requested && !this.interrupted; }

  /** Returns true only when following has just become active (including while paused). */
  setRequested(enabled: boolean): boolean {
    const previous = this.active;
    if (!enabled) this.interrupted = false;
    this.requested = enabled;
    return this.active && !previous;
  }

  /** Returns whether the UI needs to acknowledge an interrupted follow request. */
  takeManualControl(): boolean {
    const previous = this.active;
    this.interrupted = this.requested;
    return previous;
  }
}
