# Validation — v0.2.0

This record distinguishes real executed checks, simulated transport checks, and unexecuted integration checks. Historical records remain in `VALIDATION-0.1.1.md` / `VALIDATION-0.1.0.md`.

## Executed

Environment: Node v22.16.0, global TypeScript 5.8.3, Chromium 144.0.7559.96. These are assembly-time tools, not a claim that the declared npm dependency tree was installed.

| Command | Passed | Scope |
|---|---:|---|
| `node scripts/core-smoke.mjs` | 21 | strict core/view-math compile, original traversal/UV pipeline, camera math, invalid meshes |
| `node scripts/complex-smoke.mjs` | 40 | welding, UV, complex mesh topology/traversal, GLB helpers, mock downloads, actual asset hashes and FBX fixture structure |
| `node scripts/layout-smoke.mjs` | 11 | real Chromium native canvas/CSS layout; no React/Three.js |

Machine-readable results are in `docs/validation/v0.2.0/`.

The core script also performs **syntax-only** transpilation of 53 TS/TSX files. It is not a UI declaration typecheck. The complex suite validates all four procedural meshes at low/medium/high density for finite coordinates, nondegenerate triangles and edge-manifold incidence, then runs the complete baseline→chain→candidate-mask→traversal→UV coverage pipeline on medium meshes. OBJ export/import preserves tested UV seam sets, including the original UV cube.

The download cases use a mock `fetch` transport: GLB reassembly, texture stripping, failure paths, path restrictions and size checks are executable, but **no actual remote model download succeeded here**. Timings in reports measure this container only, not user hardware or GPU/browser performance.

The FBX cases validate generated file structure, binary node offsets, array decompression, polygon/UV counts and checksums. They do **not** instantiate FBXLoader. The generated ASCII/Binary fixtures are real files, not placeholders, but production import compatibility is unverified.

The layout suite reproduces the original v0.1.0 HiDPI growth as a negative control; verifies fixed DPR 1/1.25/2/3 and resize/hide/show; and adds 1100×700 and 1920×1080 layouts with long import diagnostics, a fourth status row and a 100-row timeline. This is a native canvas/CSS test, not a full GPU-rendered application test.

## Unexecuted / not certified

The environment could not resolve npm registry / asset download hosts. No successful dependency installation was achieved. The real Studio test was invoked and stopped at its explicit missing-dependency guard (record in `environment.txt`). The following remain unverified:

- Actual Three FBXLoader decoding of the ASCII/Binary fixtures or user FBX files.
- Full glTF/FBX scene import, React rendering, skin/morph behavior through installed Three.
- Complete UI TypeScript checking, Vitest integration run, Vite production bundle.
- Full Studio browser interactions, Worker integration through Vite, GPU rendering.
- Real upstream Corset / Flight Helmet retrieval and browser display.
- macOS, Windows, Safari or user GPU execution.
- General FBX exporter/version compatibility, material fidelity or animations.

No fake Three.js module, mocked FBX parser or hand-authored success log substitutes for these checks. No npm lockfile is fabricated from an uninstalled dependency tree.

## Full integration entry points

After successful `npm install`, run:

```bash
npm run test:imports
npm run check:full
```

`test:imports` uses real Three geometry, transformations, instancing, skin/morph pose, both bundled FBX encodings, malformed FBX, geometry-only GLB and glTF companion buffers. `test:browser` starts the real Studio and covers the original rendering regression plus complex sample selection, both FBX buttons and bounded timeline. They are tests to run, not tests already passed.

Browser checks require Node.js 22 plus local Chrome/Chromium/Edge and WebGL2 for the full Studio. Set `CHROME_PATH` as needed. `.github/workflows/ci.yml` is supplied for dependency-backed checks but no hosted CI run is claimed.
