# v0.4.25

表面重心对应、完整对称层片、带反射约束的内在松弛及后处理输出复验。真实人台/头盔生成不读原UV；完整结果与限制见 docs/releases/0.4.25.md。

# 0.4.24

## 0.4.24

- 核实旧齿轮已放大但小件受1.6倍密度差约束；新增3倍有界预设及原1.6对照。
- 真实空位容量适配等比例增长；保留小步重排、边距、无重叠、面积不缩小约束。
- 实际提交坐标计算逐岛面积/边长倍数与停止原因，不把搬移或回退算放大。
- 四模型实际结果与同上限消融如实记录；头盔限时下无提升，不宣称全局最优。
- 详见 docs/releases/0.4.24.md。

# v0.4.23

修复纵向片预算提前触发曲折分割；一般开缝比较方向候选；真实空洞精排、等面积搬移、连续小步增长和预算修正。完整说明与实际四模型结果见 `docs/releases/0.4.23.md`、`validation/v0.4.23/`。不使用原 UV，不宣称填满全部空白。

# 0.4.22

完整厚壳主片/回折壁共同切图；几何镜像及异对角线单元联合分组；成对壁面开缝；人台结构片内在尺寸松弛；完整输出契约、原UV隔离及真实工作台回归。详见 docs/releases/0.4.22.md。

# v0.4.19 · 修复默认源 UV 路径的可辨识性检查

- 先复现默认载入保留一张有效矩形UV，再修复；不再只测generated。
- 检查主要平面轮廓/孔洞与源UV的相容性，冲突原岛按真实几何重组，非冲突岛保持。
- Source-atlas/Extract两处入口接线；后续缝合、填空、报告继承特征保护。
- 低/中/高齿轮完整保留两个齿形带孔平面，源模型不变；非齿轮与变换回归。
- 保留真实repack历史，新增独立v0.4.19，不伪造丢失的v0.4.18 tag。

---

# Changelog

## 0.4.8 — 2026-09-15

- Audit actual source island counts and across-island overlaps within each source UV domain.
- Add connected-first presegmentation and transactional adjacent-island stitching; reject invalid candidates without weakening validation or replacing source data.
- Separate snapshot stitching from repacking and geometric-connectivity page grouping; preserve common page density and new export page identities.
- Expose measured attempts, rejection reasons, page membership and occupancy. Keep original UV extraction, camera, selection and playback behavior.
- Add procedural benchmark and actual offline-browser regressions; explicitly retain real-asset and full React/Vite validation limitations.
- Release from existing small-commit history with a new immutable annotated v0.4.8 tag. For 0.4.5–0.4.7 details, see the versioned release documents.

## 0.4.4 — 2026-09-14

- Analyze each island's actual transform spans; remove static time instead of redistributing it.
- Compact phase seeking, reverse playback, geometry, hinge angles and UI counters through one shared timeline.
- Use duration-bounded late overlap for short / long islands; no overtaking, triple activity or zero-motion tail.
- Add default-on skip switch, relative tolerance, actual/saved durations, per-island skipped-stage diagnostics.
- Cache O(face corners) analysis; keep opt-in teaching holds, independent camera and exact source / target endpoints.
- Preserve all published tags and release a new annotated v0.4.4 from clean committed HEAD.

## 0.4.3 — 2026-09-14

- Default to ordered island relay: start the successor at 85% of its predecessor; bound overlap to adjacent pairs and retain strict serial mode.
- Share local/global progress, duration, queue state, stage seeking, hinge angles and geometry scheduling in both Studio and offline lab. Legacy `together` inputs migrate to relay.
- Make the stationary rigid-net hold opt-in, remove capped frame elapsed time and artificial loop hold, preserve exact source/UV endpoints and free-camera behavior.
- Keep an explicitly inspected island pinned while using queue/stage controls; prioritize active island labels on fragmented meshes.
- Add shared-timeline and actual RAF/WebGL regressions; update old tests to inspect local island stages instead of assuming synchronized whole-mesh poses. See versioned release and validation documents for measured results and build limitations.
- Preserve all earlier release tags; release a new annotated v0.4.3 from clean committed HEAD.

## 0.4.2 — 2026-09-14

- Default to a manual camera in Studio and the offline lab; animation progress no longer overwrites orbit, pan or zoom.
- Keep optional follow explicitly opt-in, with immediate latched user takeover and synchronized UI; no automatic resume after release or loop.
- Add one-shot fit-current that preserves orientation; make 3D/UV fit buttons one-shot and preserve camera during same-mesh UV recompute and context recovery.
- Add 10 policy and 39 real-browser camera cases; rerun existing rendering, hinge, core and layout regressions. Full React/Vite build remains unavailable due to missing dependencies.
- Preserve all published tags and add annotated v0.4.2 from a clean committed HEAD.

Previous v0.4.0/v0.4.1 algorithm and performance changes are recorded in their versioned `docs/RELEASE-*.md` files.

## 0.3.0 — 2026-09-11

- Add reversible per-corner 3D-to-UV morph with single/multi/all island scope and simultaneous/sequential scheduling.
- Share one immutable UV snapshot across 3D, UV, correspondence inspection and target-UV OBJ export.
- Support original UV targets, generated preview targets, checker/labels, current-surface picking, orbit/UV cameras and six-island demo.
- Retain original traversal/Three.js path; use a dependency-free native WebGL2 renderer for unfolding.
- Execute 33 unfold, 4 Node UV-job, 24 native WebGL, 13 layout and existing 21 core/40 complex/22 Git-tool checks. Two browser worker cases are explicitly skipped; full React/Vite/FBX integration is not verified.
- Preserve existing version tags and small-commit history; release a new annotated v0.3.0 tag.


## 0.2.0 — 2026-09-11

- Add four offline complex meshes at three densities, UV-preserving OBJ export and two synthetic FBX 7400 fixtures.
- Add Studio FBX import and shared transformed-scene normalization with per-object welding and per-corner UVs.
- Add opt-in CC0 Corset / Flight Helmet catalog and geometry-only GLB download/cache commands; remote binaries are not bundled.
- Move seam/UV calculation to workers, reuse adjacency, lazily expose traversal history and bound timeline rows.
- Keep long diagnostics and new timeline labels from breaking the previously fixed 3D layout.
- Add pure geometry/assets tests and real Three/FBX/Studio integration test entry points.
- Executed: 21 core + 40 complex + 11 native layout cases. Real dependency-backed FBX/UI/Vite checks remain unexecuted; see docs/VALIDATION.md.


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
