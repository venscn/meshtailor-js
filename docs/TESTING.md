[**English**](TESTING.md) | [简体中文](TESTING.zh-CN.md)

# Test commands and evidence

Choose a command for the behavior changed. A passing result applies to that command, input, configuration, and environment; it does not certify every script in this repository. Historical reports describe their original run.

## Current acceptance

Use Node.js 22.16+ and a locked install (`npm ci`). The following existing commands retain their names and behavior:

| Command | Purpose | When to run |
| --- | --- | --- |
| `npm test` | Vitest package and importer regressions | Changes to the behavior covered by those tests |
| `npm run check:geometry` | Strict core compilation; geometry input isolation, boundaries, candidate contracts, topology, unified generation policy, and core regressions | Geometry pipeline or generator changes |
| `npm run check` | Unit tests, Studio production build, and complete TypeScript check | Application/code changes |
| `npm run typecheck` | Complete TypeScript check | Types and module boundaries |
| `npm run test:git` / `npm run git:check` | Git tool regressions / actual immutable release identities and clean repository state | Git tooling / after committing a maintenance batch |
| `npm run test:geometry:real` | Both SHA-pinned real models; original, absent, and randomized UV variants; exact seam/face-corner signature and OBJ equality | Every generation-strategy change |

`test:geometry:real -- --one-variant` is a diagnostic shortcut, **not** the required six-run UV-isolation acceptance. Do not replace real fixtures with similarly named assets or compare only island counts. Imported UVs may be varied/read by the test harness as a reference, but must never guide production generation.

## Select targeted regressions

Retained `test:*` commands are targeted checks, not an instruction to execute every npm script each cycle. This index groups useful starting points without renaming unrelated suites:

| Behavior | Commands |
| --- | --- |
| Import/parsing, correspondence | `test:imports`, `test:complex`, `test:core`, `test:materials`, `test:uv-guards` |
| Geometry/structure | `test:geometry-input`, `test:geometry-boundaries`, `test:geometry-candidates`, `test:geometry-topology`, `test:geometry-policy`, `test:revolved-profile`, `test:revolved-profile:worker`, `test:tube-strips`, `test:tube-strips:worker`, `test:continuity:worker` |
| UV validity/packing | `test:parameterization`, `test:atlas`, `test:atlas-pages`, `test:chart-merge`, `test:fill`, `test:fill:adaptive`, `test:fill-once`, `test:cavity-fill`, `test:fill-growth` |
| Playback/selection/camera | `test:unfold`, `test:hinge`, `test:selection`, `test:motion`, `test:motion-time`, `test:relay`, `test:camera`, `test:arrival` |
| Transport lifecycle | `test:uv-client`, `test:uv-progress` |

Reading a UV field does not by itself make a test historical. Parser/export round trips, controlled animation fixtures, and checks of **newly generated** UVs remain useful independent contracts. For example, `test:unfold` supplies synthetic atlas coordinates to test animation endpoints; it does not claim those coordinates were automatically generated from geometry. `test:geometry-policy` intentionally supplies obsolete options/targets and asserts that they are disabled or rejected.

Browser commands require a usable Chrome / Chromium / Edge executable (`CHROME_PATH` can select it). Offline workbench source/production module changes require `npm run lab:build`. A Node worker-thread adapter does not certify browser module-worker loading, React, Three's importer, or WebGL.

`test:geometry:browser` retains the current geometry-only policy checks, but also contains fixed v0.4.20 island-count baselines (gear 6, Corset 95, FlightHelmet 192). The [v0.4.30 record](releases/0.4.30.md) reports factory-default Corset 81 and FlightHelmet 191; `test:geometry-policy` expects gear 5. This browser suite was **not** rerun or repaired in this command-classification batch. Review its exact generated partitions, coordinates, and UI configuration before updating these assertions; do not lower them simply to obtain a green run. `check:full` still includes this browser suite and the expensive real-fixture suite, so it is not presented as a verified green aggregate here. Other unchanged browser suites also require a fresh run for the affected behavior.

## Offline QA

`qa:*` commands analyze original UVs, known source partitions, or already-produced snapshots outside the automatic production path. They cannot substitute for `check:geometry` or the six real-fixture variants. Their original scripts and assertions are unchanged.

| Command | Input and boundary |
| --- | --- |
| `qa:source-layout` | Synthetic source UV/material display and export contract (`source-layout-smoke.mjs`) |
| `qa:source-repair` | Direct legacy source-chart repair utility; no current production Worker route (`source-repair-smoke.mjs`) |
| `qa:human-uv`, `qa:human-uv:integration` | Includes the Corset region selected by original UV island #12; cannot prove geometry-only automatic discovery |
| `qa:recut-large`, `qa:recut-large:real` | Explicit original-seam recut trials; automatic production fill rejects original-seam recut |
| `qa:peel:fill` | Direct fill of an already-produced v0.4.18 JSON snapshot; requires that snapshot, not a new geometry-generation run |
| `qa:source-models` | `verified-models-smoke.mjs --mode inspect --models examples/verified-models`; reference UV audit only, without a Worker generation request |
| `qa:structure-reference` | Original-vs-generated component analysis **after** generation; defaults to generated OBJ files in `validation/local-geometry-real` |
| `qa:paint-reference` | Original-outline comparisons on provided historical snapshots; requires `--root <snapshot-directory>` |

Use fresh local output directories where the script accepts `--out`, `--report`, or `--root`, for example:

```bash
npm run qa:source-models -- --out validation/local-source-models
npm run qa:human-uv -- --out validation/local-human-uv
npm run qa:structure-reference -- --generated-root validation/local-geometry-real --out validation/local-structure-reference
```

Some archived scripts hard-code versioned output paths; `qa:human-uv:integration` writes `validation/v0.4.17/integration/report.json`. Run such investigations in a disposable worktree and do not commit regenerated reports as if they were the original evidence. `qa:recut-large:real` and `qa:peel:fill` need historical intermediate files that are deliberately not all included in the source checkout.

## Historical experiments

`history:*` preserves earlier production/UI assumptions. These commands may fail on current source **by design**, request controls that no longer exist, or need omitted historical assets. Do not run them as current acceptance, silently weaken their assertions, restore removed source-UV production routes, or replace an old report with a current failed run. To reproduce a release, inspect that immutable tag and its own prerequisites in a separate worktree.

The command suffix stays the same after replacing `test:` with `history:`, except the two asset aliases consolidated below. Classification was based on the actual request/assertion, not the filename:

| Historical command | Preserved script | Evidence of the obsolete contract |
| --- | --- | --- |
| `history:browser` | `studio-smoke.mjs` | Line 104 selects Studio UV target `source` |
| `history:unfold:browser` | `unfold-browser-smoke.mjs` | Line 72 requires a real `source` module-Worker result |
| `history:uv-worker` | `uv-worker-smoke.mjs` | Lines 28–36 require original-UV Worker jobs to succeed |
| `history:uv-large` | `uv-large-worker-smoke.mjs` | Line 19 runs both `generated` and `source` as successful Worker targets |
| `history:uv-lifecycle:browser` | `uv-lifecycle-browser-smoke.mjs` | Lines 24–25 require a successful large `source` UI job |
| `history:sample-asset` | `flight-helmet-smoke.ts` | Line 27 defaults to `generated` and removed `source` stages; source-seeded postprocessing modes also remain |
| `history:seam-policy` | `seam-policy-smoke.mjs` | Lines 15/20 expect `uv-seams → source`; production seam Worker rejects `uv-seams` |
| `history:large-charts:browser` | `large-charts-browser-smoke.mjs` | Lines 15/25 expect Extract/original-UV inspection, plus earlier generated counts |
| `history:materials:browser` | `material-layout-browser-smoke.mjs` | Lines 20/35 require original-UV material display and the removed source-layout control |
| `history:optimization:browser` | `uv-optimization-browser-smoke.mjs` | Lines 9/18 require raw source-overlap extraction/restoration |
| `history:source-atlas` | `source-atlas-smoke.mjs` | Lines 16/18 require successful `source` and `source-atlas` Worker targets |
| `history:area-spatial:browser` | `area-spatial-browser-smoke.mjs` | Lines 10–11 require source-atlas extraction and raw source restoration |
| `history:verified-models` | `verified-models-smoke.mjs` | Line 12 defaults to `source-atlas`; line 32 submits that removed Worker target; use `qa:source-models` for inspection only |
| `history:verified-models:browser` | `verified-models-browser-smoke.mjs` | Lines 25/39 require source-atlas generation and original-UV restoration |
| `history:fill:browser` | `fill-browser-smoke.mjs` | Line 11 seeds the production UI with `source` UVs before fill |
| `history:fill:real` | `fill-verified-models.mjs` | Delegates to the archived verified-model runner's default source-atlas mode |
| `history:workflow:browser` | `workflow-controls-browser-smoke.mjs` | Line 6 loads original UVs through target `source` |
| `history:load-pipeline` | `load-pipeline-smoke.mjs` | Line 12 expects complete imported UVs to select source-atlas |
| `history:load-pipeline:browser` | `load-pipeline-browser-smoke.mjs` | Lines 10/21/24 require source inspection/pipeline configuration |
| `history:load-pipeline:real` | `load-pipeline-real-smoke.mjs` | Line 8 always submits source-atlas Worker jobs |
| `history:paint-shape:browser` | `paint-workbench-smoke.mjs` | Mixed suite: its optional `--corset` path (line 23) requires removed `source` inspection |
| `history:human-uv:browser` | `human-template-browser-smoke.mjs` | Lines 11–12 load an old source-atlas snapshot and select source-atlas |
| `history:peel:real` | `peel-verified-real.mjs` | Line 5 enables `peelSourceHints` by default; `--geometry-only` disables hints but does not prove the required six variants |
| `history:peel:browser` | `peel-browser-smoke.mjs` | Lines 5/13 require enabled source hints and the removed `#peel-source` control |
| `history:source-features` | `source-feature-smoke.mjs` | Line 30 explicitly requires the default source-atlas route |
| `history:source-features:browser` | `source-feature-browser-smoke.mjs` | Lines 17/22 require source-atlas feature correction and source inspection |

All filenames in this table are under `scripts/`. The same applies to the QA table. The unlisted one-off `scripts/capture-area-workbench.mjs` also selects the removed `source` target; it remains an archived capture script, not a current screenshot command.

`test:flight-helmet` and `test:sample-asset` formerly executed identical commands. Both old npm names are removed; `history:sample-asset` is the single explicit historical entry. The script itself, old release instructions, commits, and tags remain intact. Use `test:geometry:real` for current pinned-model generation acceptance; use `qa:source-models` for reference inspection. Other changed names follow the tables above; no ambiguous old `test:*` compatibility aliases remain for those archived suites.

## Evidence for this classification

The initial 2026-10-13 audit ran three original commands on Node.js 25.8.2: load-pipeline failed at line 12 (`generated` versus expected `source-atlas`), source-atlas failed at line 16 (the rejected `source` request), and UV-worker failed at line 29 (the rejected original-UV job). These are obsolete assertions, not evidence that the production generator should regain source-UV support. Current rejection is explicit in `apps/studio/src/workers/uv.worker.ts` and is covered by `test:geometry-policy`.

This maintenance batch changes command names and documentation only. Original smoke/helper scripts and their assertions stay byte-for-byte unchanged. Browser suites, historical real-model experiments, and all optional QA tools are not claimed to have been rerun by this classification.
