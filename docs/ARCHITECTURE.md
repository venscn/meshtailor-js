[**English**](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

# Current architecture

MeshTailor-JS runs locally as a browser Studio, an offline workbench, or an OBJ CLI. It does not require a business HTTP backend or an operations frontend. Vite and `lab:serve` serve frontend files; they do not own generation jobs or model storage.

This document describes the current geometry-only production boundary. The [unchanged early architecture](ARCHITECTURE-HISTORICAL-0.1-0.3.md) preserves the v0.1–v0.3 research and source-UV design as historical context.

## Applications and modules

| Location | Responsibility |
| --- | --- |
| `apps/studio` | React/Vite client; OBJ/FBX/GLB/glTF import adapters, browser Workers, controls, rendering, picking, and export. |
| `apps/unfold-lab` | Standalone offline workbench source; accepts OBJ and built-in meshes. |
| `apps/cli` | Local Node.js OBJ inspection, seam/chain JSON output, and generated-UV OBJ export. |
| `packages/mesh-core` | Geometry types, topology, OBJ/glTF helpers, input isolation, examples, and bounded opt-in downloads. |
| `packages/chaining-seams` | Mesh-edge chain tracing, canonical ordering, and serialization; historical source-UV extraction remains a research/QA utility. |
| `packages/uv` | Geometry-driven partitioning/cuts, parameterization, quality checks, packing, generated-result editing, and unfolding correspondence. |
| `packages/runtime` | Geometry baseline adapter, lazy traversal/debugger frames, and research candidate masks. |
| `packages/model` | Research specification, training-sample utilities, and model adapter contracts; no learned weights are bundled or used by production generation. |
| `scripts` | Builds, Git checks, focused regressions, fixture tooling, and classified historical experiments. |
| `docs` / `validation` | Maintained bilingual guides and versioned design/validation evidence; saved reports describe their original run. |
| `unfold-lab.html` | Offline deliverable rebuilt from source with `npm run lab:build`. |

Shared language, theme, and preference utilities are being consolidated in `packages/ui-platform`. This integration and its cross-client coverage must be confirmed against integrated source and browser checks before being described as complete. Display preferences stay outside geometry generation settings.

## Production flow

```text
local import / built-in geometry
  → geometryOnlyMesh (whitelisted positions, topology, geometry metadata)
  → geometryGenerationOptions
  → unwrapMesh
  → generated cuts + parameterized/checked/packed face-corner UVs
  → UVSnapshot
  → 3D preview + UV view + picking + generated-UV OBJ export
```

Default loading, Generate baseline, and CLI generation share the geometry policy and generator. Original UV coordinates, UV indices, seams, source islands, and recovery hints cannot choose partitions or guide automatic generation. Import boundaries, Worker transfer, and generator entry each enforce the whitelist; do not enumerate an entire input face and then delete UV fields.

The glTF helper removes original `TEXCOORD_*`/`TANGENT` attribute references and texture dependencies while preserving geometry, transforms, skins, morphs, and lightweight material-domain identity. It does not promise to rewrite unused bytes in the original binary buffer. Material identity is import metadata, not an original UV layout hint.

Stitch, repack, fill, and template edits consume the current generated snapshot. They do not restore model UVs. The Worker explicitly rejects legacy `source` and `source-atlas` targets.

## Dependency boundaries

```text
Studio ───────→ mesh-core / chaining-seams / runtime / uv
CLI ──────────→ mesh-core / chaining-seams / uv
runtime ──────→ mesh-core / chaining-seams / uv
uv ───────────→ mesh-core / chaining-seams
chaining-seams → mesh-core
model ────────→ mesh-core / chaining-seams / runtime (research)
mesh-core ────→ no other project package
```

Each workspace declares direct internal imports, including type-only imports. Cross-workspace consumers use package entry points instead of relative imports into another package's `src`. Production geometry packages do not import React, DOM controls, client preferences, or application implementations.

The offline workbench currently reuses Studio's Worker, drawing modules, and CSS through the local bundler. This avoids a second generator, but source paths are a real coupling: moving them requires updating offline builds and regressions together. Extract shared protocols and rendering policies only with a concrete consumer and preserved behavior.

`MeshTailorBackend` is a research inference adapter, not a web service. Candidate masks, training labels extracted from existing UVs, and old source-layout utilities do not define production generation.

## Jobs and presentation

Studio's `useUVSnapshot` owns cancellation and stale-result rejection. `startUVJob` constructs geometry-only input, enforces startup and wall-clock limits, and terminates busy Workers on cancellation. One returned snapshot contains packed face-corner UVs, actual seams, correspondence geometry, warnings, and diagnostics.

UV drawing, current morphed 3D picking, and export consume that snapshot. Playback never changes the solver seam set or silently repacks its target. Unfolding is deterministic correspondence visualization; intermediate poses may overlap and are not cloth simulation or a zero-distortion proof.

Traversal frames stay on the client with lazy edge-history accessors. Structured-cloning these frames across Workers would eagerly materialize histories. Browser importers and renderers own Three.js/WebGL resources and dispose them at lifecycle boundaries.

## Maintenance and checks

Comments explain invariants, ownership, constraints, and decisions. Domain algorithms stay independent of UI text and theme tokens. Keep current behavior separate from historical experiments, preserving release tags and original evidence.

- Imports/manifests: audit dependencies, run `npm run typecheck`, build Studio, and check affected CLI behavior.
- Generation strategy: run `npm run check:geometry` and both pinned real-model fixtures under original/absent/random UV variants, comparing every seam and face-corner coordinate.
- Shared Worker/drawing/workbench source: rebuild offline HTML and run relevant browser regressions.
- Language/theme/layout: check actual controls and Canvas/WebGL in both languages/themes, representative narrow/short screens, and resizing within the same page.

Legacy source-UV suites retain their assertions and classification; they are not acceptance tests for the geometry-only generator. Avoid tests that merely repeat a static literal or mirror implementation code.

See [contributing](../CONTRIBUTING.md), [Git workflow](GIT_WORKFLOW.md), and the [documentation index](README.md). [Earlier unfolding/UV notes](UNFOLDING_AND_UV.md) and [model adapter notes](MODEL_BACKEND.md) retain their historical algorithm/research scope.
