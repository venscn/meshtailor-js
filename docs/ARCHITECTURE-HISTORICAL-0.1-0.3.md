> v0.4.0 更新：UV 生产流程现为面角拓扑 → LSCM/Tutte → 检查 → 面积感知 MaxRects；动画独立使用边铰链。当前模块和限制见 [展开与 UV 架构说明](UNFOLDING_AND_UV.md)，下文保留早期工程背景。

# Architecture mapping

## 1. Data path

```text
OBJ / GLB / GLTF
      |
      v
 MeshData (V,F, per-corner UV)
      |
      +--> topology / 1-ring
      |
      +--> existing UV -> seam edge extraction
                         |
                         v
                   ChainingSeams
                         |
                         v
                 Canonical ordering
                         |
                         v
              vertex stream + EOC/EOS
```

For learned inference, the same `MeshData` also supplies vertex `(xyz, normal)` features and 2048 sampled surface `(xyz, normal)` points.

## 2. Paper model mapping

MeshTailor v2 Appendix B.3 is represented in `packages/model/src/spec.ts`.

```text
vertex xyz+normal
  -> Fourier features + raw values
  -> MLP, dp=384
  -> GraphSAGE widths 64/128/256/512
  -> concatenate graph feature + point feature
  -> projection d=512

surface 2048 x (xyz+normal)
  -> pretrained frozen point-cloud encoder
  -> shape tokens Z, width=512

vertex tokens query Z
  -> cross attention x2
  -> enhanced vertex tokens

previous candidate embeddings
  -> chain-local positional embedding
  -> RoPE
  -> decoder-only Transformer x6, d=512, conditioned on Z
  -> pointer projection against [EOC], [EOS], enhanced vertices
  -> dynamic neighbor mask
```

The repository does not fabricate unspecified paper details such as exact Fourier band count, head count, FFN ratio, or author checkpoint tensor names. Those should be filled from official code/checkpoints when released or selected explicitly for an independent reimplementation.

## 3. Mesh-native inference

`packages/runtime/src/candidate-mask.ts` is the key structural guarantee.

- At chain start, candidates are valid mesh vertices.
- From a vertex, candidates are only its 1-ring neighbors plus EOC/EOS.
- The immediately previous vertex is removed to avoid one-step backtracking.
- EOS terminates generation.

The Studio debugger uses exactly this same mask to visualize candidate points.

## 4. Canonical ordering

`packages/chaining-seams/src/canonical-order.ts` tracks patches as face sets. For each closed seam loop it blocks the loop edges in the current face adjacency graph and tests whether the patch splits into exactly two components. The area balance is:

```text
min(A1,A2) / max(A1,A2)
```

The largest patch is refined first; its most balanced valid internal loop is appended next. Remaining open chains are sorted by decreasing geometric length.

## 5. Current UV stage

`buildCharts()` is real topology cutting: face adjacency cannot cross a seam edge. `planarPackPreview()` is only the parameterization preview. This distinction is intentional because MeshTailor predicts seams; ABF++ is a downstream solver in the paper.


## 0.2.0 additions

The browser import boundary is `apps/studio/src/importers/`: OBJ retains source topology; FBX/glTF pass a Three scene through `sceneToMesh` and pure `assembleMeshParts`. Position welding is scoped per object/instance while UV lives on face corners. Imported source scenes are disposed after extraction. FBXLoader parse remains synchronous.

Complex mesh generators, the remote asset catalog, bounded geometry downloads and GLB repack helpers live in `packages/mesh-core`. They are independent of React/Three except for the later browser scene decoder. Remote download is opt-in and source/credit/hash are retained.

`seam.worker.ts` returns seam edges and ordered chains, not pre-expanded debugger frames. The main thread constructs frames with lazy edge-history getters. Structured-cloning those frames would eagerly invoke getters and negate the memory optimization; do not move frame arrays across the worker boundary. `uv.worker.ts` returns chart/preview data. Operation sequence IDs reject stale replies.

The timeline renders at most 100 nearby rows. Above 20,000 triangles, UV defaults to complete seam data rather than playback-frame updates. None of these changes replace the geometric baseline with a learned model or the planar preview with ABF++.

## v0.3.0 — Shared correspondence and unfolding

`packages/uv/src/unfold.ts` derives a per-face-corner source/target geometry from the same PackedChart faceUVs drawn by the UV view and used by target-UV export. Render corners are not welded across seams. Each face retains its source face index and chart ID. A deterministic pure function writes simultaneous/sequential, single/multi/all selected-island positions; source, target and unselected positions remain immutable.

The UV worker now returns a single UVSnapshot (packed atlas + geometry + seam set + target + warnings). `useUVSnapshot` owns cancellation and stale-result rejection; UVCanvas no longer creates its own independent worker. Generated targets use the full seam set during unfolding, never a changing traversal prefix; source targets derive seams from existing UVs and fail explicitly when UVs are incomplete.

`useUnfoldPlayer` separates scope, selection, ordering and timeline controls. `UnfoldWebGLView` updates native WebGL2 buffers and picks current morphed triangles; `uv-drawing.ts` draws/picks the shared atlas; CorrespondenceInspector displays original source and target corner coordinates. The original Three.js MeshViewport remains the traversal renderer. Both modes use consistent normalization, but they do not share a renderer instance across a mode switch.

This is presentation interpolation, not ABF++/LSCM iteration or physical cloth motion. Solver replacement must preserve the face/corner contract so preview, picking and export stay identical. See UNFOLD_PREVIEW.md and VALIDATION.md.
