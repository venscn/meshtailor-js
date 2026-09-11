# Changelog

## 0.1.1 — 2026-09-11

### Fixed

- HiDPI canvas intrinsic-size / CSS Grid / ResizeObserver feedback loop.
- Renderer/context recreation and camera reset on every traversal step.
- Incomplete disposal of traversal overlay resources.
- Seam/marker occlusion: explicit X-ray overlay mode and surface depth offset.
- UV canvas redraw on panel resize; panel sizing constraints.
- Camera framing for portrait views and large-offset / small-scale input meshes.
- Visible initialization/context/mesh errors instead of silent blank views.
- Invalid imports are rejected before topology rendering and do not discard the current mesh.
- Seeking pauses playback; Play restarts at the beginning after reaching the end.

### Added

- Reset camera, Show all seams, X-ray traversal, traversal direction arrow and chain-start hint.
- Dependency-free native Chromium layout regression with a v0.1.0 negative control.
- Core/view math smoke suite and real Studio browser regression entry point.
- Chinese hotfix notes, explicit validation scope, machine-readable reports and Git history bundle.

### Validation boundary

21 core/view-math cases and 9 native canvas CSS-layout cases passed. Full React/Three.js end-to-end testing, Vite build and UI declaration typecheck remain unexecuted in the assembly environment because npm dependencies could not be fetched. No claim is made that every local display failure has the same root cause.
