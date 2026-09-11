# Learned model backend

The missing artifact in the public MeshTailor release is the trained author checkpoint. Rather than couple the rest of the project to guessed tensor names, the learned path is an adapter.

```ts
interface MeshTailorBackend {
  readonly name: string;
  prepare(mesh: MeshData): Promise<void>;
  pointerStep(input: {
    mesh: MeshData;
    sequence: number[];
    mask: CandidateMask;
  }): Promise<{
    logits: Map<number, number>;
    eocLogit?: number;
    eosLogit?: number;
  }>;
}
```

## Suggested ONNX/WebGPU deployment

A practical converted model can expose either:

1. one monolithic `next_token` graph, or
2. cached `encode_mesh` + repeated `decode_step` graphs.

Recommended inputs for an independent export:

```text
vertex_features   [N,6]
adjacency/edges   [2,E] (or packed neighbor table)
surface_points    [2048,6]
sequence          [T]
chain_positions   [T]
candidate_mask    [N+2]
```

Output:

```text
logits            [N+2]
```

Candidate convention used throughout this repo:

```text
0 -> [EOC]
1 -> [EOS]
2 + vertexId -> vertex
```

The runtime should apply the dynamic mask before sampling and use temperature 0.1 to match the reported inference setting.

## Training data

`buildTrainingSample()` converts a UV-annotated mesh to the paper-facing pieces:

- vertex position + normal,
- triangle indices,
- 2048 area-weighted surface points with normals,
- seam chains extracted from UV discontinuities,
- canonical chain ordering,
- serialized target stream.

The paper specifies AdamW, learning rate 1e-4, batch size 64, 30 epochs, frozen pretrained point-cloud encoder, and maximum sequence length 400. Exact optimizer implementation and unspecified architecture hyperparameters are intentionally not guessed here.
