[**English**](START_HERE.md) | [简体中文](START_HERE.zh-CN.md)

# Get started with MeshTailor-JS

Current application version: **0.4.30**. Start with the [README](README.md) for an overview, or read the [English release summary](docs/releases/0.4.30.en.md).

## Offline workbench

Open `unfold-lab.html` from the repository root in your browser. It bundles the production Worker, sample geometry, and workbench without frontend installation.

If your browser blocks local Workers, use Node.js to start a local server:

```bash
npm run lab:serve
```

Visit [http://127.0.0.1:4175](http://127.0.0.1:4175). Set `PORT` to change the port.

1. Choose a built-in sample in the Model panel, or import OBJ.
2. Loading generates UVs from geometry. After changing settings, click **Generate baseline** to generate again.
3. In the Animation panel, select an island before a triangle. Scrub the timeline to inspect the 3D-to-UV correspondence.
4. Stitch, repack, or fill as needed, then export **OBJ + UV**.

Repeated-profile metric unfolding is enabled by default. Eligible periodic sidewalls become constant-width rectangles, while shallow radial rings can preserve their inner holes. Recognition depends on geometry, not model names or original UVs. Settings and distortion tradeoffs are covered in the [release summary](docs/releases/0.4.30.en.md).

The current interface includes Chinese labels; documentation switching does not localize the application.

## Full Studio

Use Node.js **22.16+**, npm, and a WebGL2-capable browser.

```bash
npm ci
npm run dev
```

Open the Vite URL printed in the terminal. Studio accepts OBJ, FBX, GLB, and glTF. Select matching `.bin` files with glTF. Textures are not displayed, and Draco / Meshopt compression is outside the supported import scope. See [import formats](docs/IMPORT-FORMATS.md).

```bash
npm run check:geometry
npm run check
```

`check` runs unit tests, the Studio production build, and full type checking. Historical environment limits remain in their original reports; this maintenance round is recorded in [OPEN_SOURCE_PREPARATION](docs/OPEN_SOURCE_PREPARATION.md).

## CLI

The CLI accepts OBJ for geometry inspection, seam generation, and new UV export:

```bash
npm run cli -- inspect examples/cylinder.obj
npm run cli -- baseline examples/cylinder.obj cylinder-seams.json
npm run cli -- unwrap examples/cylinder.obj cylinder-uv.obj
```

These commands create the output files in the current repository directory. Choose another writable output path if preferred.

## Reference outputs and limits

```bash
npm run results:profiles
```

This restores SHA256-verified reference OBJ files to `results/v0.4.30/`. Use an external UV editor to inspect their exact layouts: this tool discards imported UVs and generates a new layout on import.

Generation does not use original UVs, seams, islands, or recovery hints. Distortion is possible, with no guarantee of semantic patterns or globally dense packing. The animation is a correspondence visualization, not a cloth simulation. Repaint or bake textures separately.
