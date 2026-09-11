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
