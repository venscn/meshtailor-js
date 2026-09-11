# Validation record

The package was validated during assembly in two layers.

## Strict core typecheck

A globally available TypeScript 5.8.3 compiler was used with `strict: true` on all non-UI packages:

```text
packages/mesh-core
packages/chaining-seams
packages/runtime
packages/model
packages/uv
```

Result: pass.

A syntax/no-check compile was also run across all TypeScript/TSX sources, including the Studio and CLI, to catch parser/emission errors without installed third-party declarations.

## Executable smoke test

The core packages were emitted to temporary JavaScript and exercised with Node.js 22.16.0.

Observed baseline pipeline:

```text
Cube             8 vertices, 12 triangles, 12 seams, 12 chains, 36 frames, 6 charts
Cylinder        26 vertices, 48 triangles, 24 seams,  2 chains, 28 frames, 3 charts
Torso-like tube 132 vertices, 240 triangles, 100 seams, 38 chains, 176 frames, 14 charts
```

Assertions covered:

- every autoregressive vertex-to-vertex step is a real 1-ring adjacency,
- closed ring seam traces as one loop,
- `cube_uv.obj` produces 12 UV seam edges,
- training sample vertices have six channels `(xyz+normal)`,
- sampled point count is respected,
- target stream terminates in EOS,
- chart preview covers all constructed charts.

## CLI smoke test

Compiled CLI commands were run against `examples/cube_uv.obj`:

```text
inspect: 8 vertices / 12 triangles / 18 edges / manifold
uv-seams: 12 seam edges / 12 chains
```

## Dependency/build limitation in the assembly environment

The environment could not resolve `registry.npmjs.org` (`EAI_AGAIN`), so `npm install`, Vitest through the local dependency tree, and the final Vite bundle could not be executed there. This is an environment-network limitation rather than a hidden successful build.

In a normal networked environment run:

```bash
npm install
npm run check
```
