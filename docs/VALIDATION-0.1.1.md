# Validation — v0.1.1

This record distinguishes executed checks from unexecuted UI checks. The original release record is preserved in `VALIDATION-0.1.0.md`.

## Executed successfully

`node scripts/core-smoke.mjs --report docs/validation/core-smoke.json`

- TypeScript 5.8.3 strict compilation of the five core packages and `viewport-math.ts`.
- 21 executable cases: original seam/traversal/UV pipeline, training sample shape, display normalization, camera fit, hidden viewport sizing, and invalid input.
- Syntax-only transpilation of 41 TypeScript/TSX source files, including the UI. This is **not** a full UI typecheck.

`node scripts/layout-smoke.mjs --report docs/validation/layout-smoke.json`

- 9 real Chromium CSS/native-canvas layout cases.
- The original v0.1.0 CSS reproduces unbounded HiDPI intrinsic-width growth (bounded to eight observations by the test).
- Fixed CSS settles at DPR 1, 1.25, 2, and 3, with pixel ratio capped at 2 as in the renderer.
- Three window-resize sizes and hide/show recovery pass.
- This suite does **not** load React or Three.js. It verifies the canvas-sizing mechanism and CSS fix, not the full GPU-rendered Studio.

The JSON reports are included in `docs/validation/`.

## Not executed / not claimed

The assembly environment cannot resolve `registry.npmjs.org`; the UI dependency tree is not installed. Therefore the following are not certified by this release assembly:

- complete `npm install`;
- full UI typecheck against React/Three declarations;
- the Vitest suite through the actual dependency tree;
- Vite production bundle;
- React + Three.js end-to-end display or camera interaction;
- macOS, Windows or Safari execution.

The real Studio browser test was invoked and stopped at its explicit missing-dependency check. No success report was generated for that test.

## Full local regression

After successful dependency installation, run:

```bash
npm run check:full
```

`test:browser` starts the real Vite Studio. It tests DPR 1 and 2, successful rendering, seam steps, preservation of canvas identity and camera orientation, mesh switches, playback restart, and visible WebGL initialization errors. It does not substitute fake React or Three.js implementations.

Node.js 22 and a local Chrome/Chromium/Edge executable are needed for browser regression scripts. Set `CHROME_PATH` if autodetection does not find your browser. The full Studio test also requires actual WebGL 2 support.
