# MeshTailor-JS

A TypeScript/JavaScript **paper-level reproduction scaffold** for **MeshTailor: Cutting Seams via Generative Mesh Traversal** (arXiv:2603.27309v2), with a functional browser Studio and a geometric fallback seam generator.

> Status: the MeshTailor project page still marks official code as **TBA** and no author checkpoint is bundled here. Therefore this repository cleanly separates two paths:
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

Requires Node.js 20+ (22 recommended).

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
- Yellow points = current 1-ring candidates, green = current vertex, blue = previous vertex, red = already generated seam.

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

The creation environment could not resolve `registry.npmjs.org`, so dependency installation and the Vite bundle could not be executed there. Core packages were nevertheless checked with a globally available TypeScript compiler in strict mode and were compiled to temporary JavaScript for executable smoke tests. The smoke test exercised Cube, Cylinder and Torso through topology -> baseline seam generation -> chain ordering -> autoregressive frames -> chart construction -> UV preview and asserted that every traversal edge is a real 1-ring mesh edge.

Run `npm run check` in a normal networked environment after `npm install` to validate the UI bundle with your installed dependency versions.

## References

- Project: https://meshtailor.github.io/
- Paper v2: https://arxiv.org/abs/2603.27309

This is an independent research reproduction scaffold and is not an official MeshTailor release.
