# MeshTailor-JS 0.1.1

**3D traversal display hotfix:** see [中文修复说明](docs/HOTFIX-0.1.1.md) and [validation scope](docs/VALIDATION.md).

A TypeScript/JavaScript **paper-level reproduction scaffold** for **MeshTailor: Cutting Seams via Generative Mesh Traversal** (arXiv:2603.27309v2), with a functional browser Studio and a geometric fallback seam generator.

> No author checkpoint is bundled here. Upstream release status was not rechecked for this display-only hotfix. This repository separates two paths:
> 1. `GeometricBaseline` — runnable now, useful for the Studio/debugger and data plumbing.
> 2. `MeshTailorBackend` — the learned pointer-model boundary, ready for independently trained or future author weights.
>
> The geometric fallback must not be interpreted as reproducing the paper's learned numerical results.

## What is implemented

- Mesh-native triangle topology and 1-ring adjacency.
- OBJ reader preserving **per-corner UVs** (important for seam extraction).
- GLB/GLTF browser import through Three.js.
- UV seam extraction from per-corner UV discontinuities.
- `ChainingSeams`: maximal open paths and closed loops.
- Canonical seam ordering: loops first, largest patch first, area-balance selection, then open chains by decreasing length.
- `[EOC]` / `[EOS]` serialization and paper-compatible candidate IDs (`0/1`, vertices shifted by `+2`).
- Dynamic 1-ring candidate masking with immediate backtracking removal.
- Autoregressive traversal debugger with step/play/timeline visualization.
- Functional geometric seam baseline (dihedral saliency + structural cross-sections).
- UV chart construction by cutting face adjacency along seam edges.
- Fast planar/shelf-packed UV **debug preview** (isolated so ABF++/xatlas can replace it).
- Surface sampling with positions + normals for training examples.
- Training JSON sample generation from UV-annotated OBJ.
- CLI and browser Studio.
- Architecture constants from MeshTailor v2: 384 point features, GraphSAGE `[64,128,256,512]`, `d=512`, 2 cross-attention layers, 6-layer decoder, RoPE + chain-local position, `Tmax=400`, 2048 points, temperature `0.1`.

## Quick start

Node.js 22.x is recommended; the core checks in this release used Node.js 22.16.0. The dependency-free browser regression utilities require Node.js 22.

```bash
npm install
npm run dev
```

Open the Vite address (normally `http://localhost:5173`). The default Torso example can be used immediately: click **Generate baseline**, then use Play/Step to inspect the graph traversal.

Production build:

```bash
npm run build
```

Tests:

```bash
npm test
```

Full check:

```bash
npm run check
```

## CLI

```bash
npm run cli -- inspect examples/cube_uv.obj
npm run cli -- uv-seams examples/cube_uv.obj cube-seams.json
npm run cli -- baseline examples/torso.obj torso-seams.json
npm run cli -- training-sample examples/cube_uv.obj cube-training.json
npm run cli -- paper-spec
```

The training sample command emits:

```text
vertices: N x 6        (xyz + normal)
faces:    F x 3
points:   2048 x 6     (sampled xyz + normal)
target:   vertex ids / EOC(-1) / EOS(-2)
```

## Studio controls

- **Cube / Cylinder / Torso**: built-in test meshes.
- **Load OBJ / GLB / GLTF**: OBJ is recommended when existing UV seams matter because the custom OBJ loader retains separate position and UV indices.
- **Generate baseline**: creates usable seams without a neural checkpoint.
- **Extract existing UV seams**: reconstructs seam edges from UV island discontinuities.
- **Curvature quantile**: adjusts feature-edge selection.
- **Structural cross-sections**: adds coarse cuts perpendicular to the longest object axis.
- **Play / Step / timeline**: shows the autoregressive vertex sequence.
- **Reset camera**: fit the active mesh in the view.
- **X-ray traversal**: show traversal overlays through the mesh (enabled by default).
- **Show all seams**: show the complete result instead of only the edges revealed by the current step.
- Yellow points = candidates used to choose the displayed token (all vertices at a chain start, otherwise a masked 1-ring); green = current vertex; blue = previous vertex; red = revealed seams.
- The first token chooses a start vertex, so no seam edge exists until the next step. The viewport now explains this state.

## Learned model integration

See [`docs/MODEL_BACKEND.md`](docs/MODEL_BACKEND.md). The model package intentionally exposes a framework-neutral `MeshTailorBackend`, so weights can be served by ONNX Runtime Web, TensorFlow.js, WebGPU custom kernels, Node.js, or a remote service without changing mesh/seam/Studio code.

## UV solver note

The paper uses **ABF++ after seam generation**. This repository currently provides a deterministic planar UV preview for debugging chart topology. The cut/chart abstraction is already separated in `packages/uv`, so an ABF++, xatlas/WASM, LSCM, or Blender-backed parameterizer can replace the preview without touching seam generation.

## Repository layout

```text
apps/studio               React + Three.js browser debugger
apps/cli                  Node.js CLI
packages/mesh-core        topology, OBJ, normals, surface sampling
packages/chaining-seams   UV seam extraction, chains, canonical ordering
packages/runtime          candidate masking, debugger, geometric fallback
packages/model            paper spec, model backend interface, training samples
packages/uv               chart splitting + debug UV preview
examples                  sample OBJ meshes
docs                      architecture and model integration notes
```

## Verification performed for this package

21 executable core/view-math regression cases and 9 native Chromium canvas/CSS layout cases passed. Strict core/view-math compilation and syntax-only checks of 41 TS/TSX source files passed.

The original HiDPI canvas-width feedback loop was reproduced as a negative control. The fixed CSS remains stable at DPR 1, 1.25, 2 and 3, including window resize and hide/show.

**Not certified here:** the complete React/Three.js frontend, UI declaration typecheck, Vitest through installed dependencies, or Vite production bundle. npm registry DNS remains unavailable in the assembly environment. A native canvas CSS test must not be mistaken for a full Studio rendering test.

```bash
npm run test:core       # TypeScript required; UI dependencies not required
npm run test:layout     # Node.js 22 + Chrome/Chromium/Edge; no UI dependencies
npm run check:full      # requires npm install and WebGL 2
```

See [docs/VALIDATION.md](docs/VALIDATION.md) for exact scope and raw JSON reports. Git history can be restored using the bundle included under [.history](.history/README.md).

## References

- Project: https://meshtailor.github.io/
- Paper v2: https://arxiv.org/abs/2603.27309

This is an independent research reproduction scaffold and is not an official MeshTailor release.
