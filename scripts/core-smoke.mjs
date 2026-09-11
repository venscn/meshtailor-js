/** Strict compile + executable assertions without installing React/Three/Vite.
 * Requires a local or globally installed TypeScript compiler. Not a UI typecheck.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, writeFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
let compiler;
try { compiler = require.resolve('typescript/bin/tsc'); }
catch {
  const global = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
  compiler = join(global.stdout?.trim() || '', 'typescript/bin/tsc');
  if (global.status !== 0 || !existsSync(compiler)) throw new Error('TypeScript not found. Run npm install, or install TypeScript globally.');
}
const ts = require(join(dirname(compiler), '../lib/typescript.js'));
const output = await mkdtemp(join(tmpdir(), 'meshtailor-smoke-'));
const report = { suite: 'Strict core/view math compilation and executable regression', compiler: ts.version, node: process.version, cases: [] };
async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) result.push(...await walk(full)); else result.push(full);
  }
  return result;
}
const check = (name, fn) => { fn(); report.cases.push({ name, passed: true }); };
try {
  const compiled = spawnSync(process.execPath, [compiler, '-p', 'tsconfig.smoke.json', '--noEmit', 'false', '--outDir', output], { cwd: root, encoding: 'utf8' });
  if (compiled.status !== 0) throw new Error(`Strict core/view-math compile failed:\n${compiled.stdout}\n${compiled.stderr}`);
  report.strictCompile = 'pass';
  // Convert workspace package specifiers only in disposable emitted test files.
  await writeFile(join(output, 'package.json'), '{"type":"module"}\n');
  for (const file of await walk(output)) {
    if (!file.endsWith('.js')) continue;
    const text = (await readFile(file, 'utf8')).replace(/(['"])@meshtailor\/([\w-]+)\1/g, (_match, quote, name) => {
      let path = relative(dirname(file), join(output, 'packages', name, 'src/index.js')).split(sep).join('/');
      if (!path.startsWith('.')) path = './' + path;
      return `${quote}${path}${quote}`;
    });
    await writeFile(file, text);
  }
  const load = (path) => import(pathToFileURL(join(output, path)));
  const core = await load('packages/mesh-core/src/index.js');
  const runtime = await load('packages/runtime/src/index.js');
  const chaining = await load('packages/chaining-seams/src/index.js');
  const uv = await load('packages/uv/src/index.js');
  const model = await load('packages/model/src/index.js');
  const view = await load('apps/studio/src/viewport-math.js');
  const meshes = [core.makeCube(), core.makeCylinder(), core.makeTorsoGrid()];
  for (const mesh of meshes) {
    check(`${mesh.name}: valid real-edge traversal, final seams and UV coverage`, () => {
      const topology = core.buildTopology(mesh);
      const generated = runtime.generateGeometricSeams(mesh);
      const frames = runtime.buildGenerationFrames(mesh, generated.chains);
      assert.ok(frames.length > 1);
      assert.equal(frames.at(-1).token, chaining.EOS);
      for (const frame of frames) {
        if (frame.token >= 0) assert.ok(frame.mask.vertices.includes(frame.token));
        for (const edge of frame.revealedEdges) assert.ok(topology.edges.has(edge));
        if (frame.token >= 0 && frame.previousVertex !== null) assert.ok(topology.neighbors[frame.previousVertex].includes(frame.token));
      }
      assert.deepEqual(new Set(frames.at(-1).revealedEdges), generated.seamEdges);
      const charts = uv.buildCharts(mesh, generated.seamEdges);
      const preview = uv.planarPackPreview(mesh, charts);
      assert.equal(preview.reduce((count, chart) => count + chart.faceUVs.size, 0), mesh.faces.length);
    });
    check(`${mesh.name}: normalized display preserves input and triangles`, () => {
      const before = JSON.stringify(mesh);
      const prepared = view.prepareViewportMesh(mesh);
      assert.equal(prepared.positions.length, mesh.positions.length);
      assert.equal(prepared.triangles.length, mesh.faces.length * 9);
      assert.ok(prepared.triangles.every(Number.isFinite));
      assert.ok(prepared.radius > 0 && prepared.radius <= Math.sqrt(3) + 1e-9);
      assert.equal(JSON.stringify(mesh), before);
    });
  }
  const uvCube = core.parseOBJ(await readFile(join(root, 'examples/cube_uv.obj'), 'utf8'), 'cube_uv.obj');
  check('OBJ per-corner UV extraction still finds the 12 cube seams', () => {
    const mesh = uvCube;
    const edges = chaining.extractSeamEdgesFromUV(mesh);
    assert.equal(edges.size, 12);
  });
  check('off-origin mesh is normalized before float32 conversion', () => {
    const mesh = core.makeCube();
    mesh.positions = mesh.positions.map((p) => p.map((x, i) => x * .125 + (i + 1) * 1e8));
    const prepared = view.prepareViewportMesh(mesh);
    assert.ok(prepared.triangles.every((x) => Math.abs(x) <= 1));
    assert.ok(new Set(prepared.triangles).size > 1);
  });
  check('very small meshes do not collapse into fixed near-plane limits', () => {
    const mesh = core.makeCube(); mesh.positions = mesh.positions.map((p) => p.map((v) => v * 1e-14));
    assert.ok(view.prepareViewportMesh(mesh).radius > 1);
  });
  check('empty mesh has a clear validation failure', () => assert.throws(() => view.prepareViewportMesh({ positions: [], faces: [], name: 'empty' }), /no vertices/));
  check('NaN coordinates are rejected', () => {
    const mesh = core.makeCube(); mesh.positions[0][0] = NaN;
    assert.throws(() => view.prepareViewportMesh(mesh), /invalid coordinates/);
  });
  check('infinite coordinates are rejected', () => {
    const mesh = core.makeCube(); mesh.positions[0][0] = Infinity;
    assert.throws(() => view.prepareViewportMesh(mesh), /invalid coordinates/);
  });
  check('out-of-range face index is rejected', () => {
    const mesh = core.makeCube(); mesh.faces[0].vertices[0] = 99999;
    assert.throws(() => view.prepareViewportMesh(mesh), /missing vertex/);
  });
  check('zero-extent mesh is rejected', () => {
    const mesh = core.makeCube(); mesh.positions.forEach((p) => p.fill(0));
    assert.throws(() => view.prepareViewportMesh(mesh), /zero or unsupported/);
  });
  check('portrait camera fit uses horizontal FOV', () => {
    assert.ok(view.fitDistance(1, 42, .5) > view.fitDistance(1, 42, 1));
  });
  check('wide camera fit does not crop the vertical axis', () => assert.equal(view.fitDistance(1, 42, 2), view.fitDistance(1, 42, 1)));
  check('camera fit contains the entire bounding sphere', () => {
    for (const aspect of [.2, .5, 1, 2, 4]) {
      const half = 42 * Math.PI / 360;
      const limiting = Math.min(half, Math.atan(Math.tan(half) * aspect));
      assert.ok(view.fitDistance(1, 42, aspect) * Math.sin(limiting) > 1);
    }
  });
  check('invalid camera input is rejected', () => {
    for (const aspect of [0, -1, NaN, Infinity]) assert.throws(() => view.fitDistance(1, 42, aspect));
  });
  check('DPR is clamped independently of CSS viewport size', () => {
    assert.deepEqual(view.viewportSize(828, 652, 3), { width: 828, height: 652, dpr: 2, visible: true });
    assert.equal(view.viewportSize(828, 652, 1.25).dpr, 1.25);
  });
  check('hidden or invalid viewport sizes are skipped', () => {
    assert.equal(view.viewportSize(0, 400, 2).visible, false);
    assert.equal(view.viewportSize(Infinity, NaN, 2).visible, false);
    assert.equal(view.viewportSize(400, 400, NaN).dpr, 1);
  });
  // Parse/transpile every source, including UI, but do NOT claim this checks external UI types.
  let sourceCount = 0;
  for (const file of [...await walk(join(root, 'apps')), ...await walk(join(root, 'packages'))]) {
    if (!/\.tsx?$/.test(file) || file.endsWith('.d.ts')) continue;
    const result = ts.transpileModule(await readFile(file, 'utf8'), { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } });
    const errors = result.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error) || [];
    assert.equal(errors.length, 0, `${file}: ${errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n')}`);
    sourceCount++;
  }
  report.syntaxOnly = { sourceFiles: sourceCount, result: 'pass', fullUITypecheck: 'not performed by this script' };
  report.passed = report.cases.length;
  const reportArg = process.argv.indexOf('--report');
  if (reportArg !== -1) await writeFile(process.argv[reportArg + 1], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await rm(output, { recursive: true, force: true }); }
