# v0.4.29 validation

## Input and real reproduction

Only the repository's correct, hash-pinned Corset and FlightHelmet fixtures were used. Production reads geometry only. The original/bare/random UV variants test that source UV cannot change generated seams, every face-corner coordinate, or OBJ bytes. Original source UV is not a generation fallback.

`baseline.json` records the actual v0.4.28 screenshot-like Corset pipeline with shared-edge post-merge: 83 islands. The base was 96/96 faces, each containing some rim; each shoulder band was 144/144. The new counterpart (`worker.json`) has 80 islands, base 72/72/48 and each shoulder 288, through repack, stitch, fill and actual automatic-load-fill exactly once. With post-merge disabled, six whole-model variants return 81/191 islands (`six-geometry-variants.json`). These are different configurations, not contradictory counts.

## Executed before final packaging

| Check | Actual result |
|---|---|
| Strict core TypeScript / core runtime | 21 passed |
| Complete band, explicit two, budget, UV getter and geometry | 13 passed |
| Complete base caps/rim, cancellation-independent topology, hard cuts, rotations, sphere/gear rejection | 12 passed |
| Screenshot-like production Worker with post-merge, repack, stitch, fill, once-only auto-fill and export reload | 6 passed |
| Actual offline DOM / production Worker / Chromium software WebGL, rebuilt v0.4.29 | 11 passed |
| Full Corset and FlightHelmet, each original/absent/random UV | All six passed; per-model seams/UV/OBJ identical |
| Exported full OBJ independently checked with GEOS/Shapely | 0 positive-area overlaps, all orientations positive, geometry and face sequence unchanged |
| Git tooling tests | 22 passed |

New browser screenshots are actual application output, not design images. They show the complete 48-face rim and complete 288-face shoulder, not only a favorable half. In the preview the long thin side strip is small in UV because its real aspect is approximately 234.765:1. UV number #16/#23 is a display index, not a production model selector.

17 pre-existing regression commands were executed. 16 first completed with exit 0; geometry-policy initially asserted the old fixed-two-panel gear count (6), while auto correctly returned 5. That test now asserts 5, both planar gear features, the actual automatic one-panel decision, all previous UV isolation/baseline equivalence and validity checks. It was rerun and all 15 checks passed. Its initial failing log is retained separately. The old two-panel garment budget test explicitly requests two panels now; it retains all direction/topology/budget assertions, while new tests check automatic one-panel selection. No geometry/quality threshold was relaxed to mask test failures.

Old browser regressions passed: free camera 39, timeline-based arrival fading 28, two-level selection/layout 39. Old tube strip and Worker tests, symmetry recognition/sheets, complete structure, metric relaxation and fill-growth checks passed. Command logs and exit codes are in `regressions/`.

## Output and tradeoffs

- Corset no post-merge: 18,324 faces / 81 islands / 51.040206% ordinary occupation. SHA256 `db080e536bd83473ae69ab50b0db568c20d410311a2209f6083abf1d6642f282`.
- FlightHelmet no post-merge: 94,722 faces / 191 islands / 47.275124% ordinary occupation. SHA256 `c59824223798b7e546a46015eeb07b12220ed39761e1a323b5e1132bed4b62dd`.
- Independent intersection threshold: 1e-14 UV squared units. 109,291 / 667,220 candidate pairs tested, maximum intersection area 0 for both exports. Reference geometry comparison uses the previously generated OBJ with identical source vertices/faces, not source UV for production.

Fewer seams and a preserved thin strip make ordinary rectangular packing harder: these occupation values are below the preceding 59.9030%/53.1433% default layouts. No new packing-quality improvement is claimed. The limited 1-second fill in the lifecycle test verifies continuity and once-only execution, not the best possible occupation.

## Limitations and failures

A first browser-test startup assertion referred to `lab` before it was defined; corrected to `window.lab?.ready`, then all actual UI steps rerun. Full browser tests are software WebGL in the offline workbench, not the React/Vite main entry or physical macOS/Windows/Safari certification. Basic playback used low-overhead rendering; no general large-model frame-rate guarantee.

npm install actually failed with EAI_AGAIN; full main build exits 127 (Vite unavailable), full typecheck exits 2 (Node type package unavailable). Their logs are preserved, and neither is counted as passed. Core compile uses real installed TypeScript; it is not a simulated full build.

Cap/rim recognition is intentionally conservative (closed manifold, strong complete crease loops, valid caps, valid annular side, sufficient parent area). Smooth spheres and arbitrary branched/irregular objects are not automatically capped. Band auto keeps a whole valid candidate when available, but budget/quality constraints can still require more than one panel. Explicit 1/2 choices remain available. All source faces are retained.

Final ZIP reopening/extraction and re-executed tests are reported separately in the external delivery verification file. This README records actual pre-packaging runs, not a claim that every test was repeated after packaging.
