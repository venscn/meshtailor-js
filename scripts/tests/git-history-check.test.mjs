import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { auditRepository } from '../git-history-check.mjs';

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), 'meshtailor git-test '));
  t.after(() => rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const cwd = join(home, 'repo');
  mkdirSync(cwd);
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(home, 'no-global-config') };
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (name, content) => writeFileSync(join(cwd, name), content);
  const pkg = version => write('package.json', JSON.stringify({ name: 'fixture', version }));
  const commit = message => { git('add', '.'); git('commit', '-m', message); };
  git('init', '-b', 'master');
  git('config', 'user.name', 'Git Audit Test');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('config', 'core.autocrlf', 'false');
  write('.gitignore', '.history/*.bundle\n');
  const baselines = [];
  for (const [i, version] of ['0.1.0', '0.1.1', '0.2.0'].entries()) {
    pkg(version); commit(`release ${version}`);
    const tag = `v${version}`;
    if (i === 2) git('tag', '-a', tag, '-m', `Release ${tag}`);
    else git('tag', tag);
    baselines.push({ tag, refObject: git('rev-parse', `refs/tags/${tag}`), commit: git('rev-parse', `${tag}^{commit}`), tagType: i === 2 ? 'tag' : 'commit', commitsSincePrevious: i === 0 ? null : 1 });
  }
  const audit = release => auditRepository({ cwd, baselines, release: release ?? null });
  return { home, cwd, env, git, write, pkg, commit, baselines, audit };
}
function fails(report, name) {
  assert.equal(report.ok, false);
  assert.ok(report.checks.some(c => c.name === name && !c.ok), `Expected failure ${name}: ${JSON.stringify(report)}`);
}

test('accepts complete clean history with three distinct original tags', t => {
  assert.equal(fixture(t).audit().ok, true);
});
test('accepts annotated release matching HEAD and package version', t => {
  assert.equal(fixture(t).audit('v0.2.0').ok, true);
});
test('rejects a missing historical tag', t => {
  const f = fixture(t); f.git('tag', '-d', 'v0.1.0'); fails(f.audit(), 'v0.1.0:ref');
});
test('rejects moving an old tag', t => {
  const f = fixture(t); f.git('tag', '-f', 'v0.1.0', 'HEAD'); fails(f.audit(), 'v0.1.0:commit');
});
test('rejects rewriting annotation even if the tagged commit is unchanged', t => {
  const f = fixture(t); f.git('tag', '-f', '-a', 'v0.2.0', '-m', 'changed annotation'); fails(f.audit(), 'v0.2.0:ref');
});
test('rejects an untracked source file', t => {
  const f = fixture(t); f.write('unexpected.txt', 'untracked'); fails(f.audit(), 'clean-worktree');
});
test('rejects unstaged changes', t => {
  const f = fixture(t); f.pkg('0.2.1'); fails(f.audit(), 'clean-worktree');
});
test('rejects staged changes', t => {
  const f = fixture(t); f.pkg('0.2.1'); f.git('add', 'package.json'); fails(f.audit(), 'clean-worktree');
});
test('allows ignored bundle artifacts without tracking recursive history', t => {
  const f = fixture(t); mkdirSync(join(f.cwd, '.history')); f.write('.history/repository.bundle', 'fixture'); assert.equal(f.audit().ok, true);
});
test('rejects two release versions on one commit', t => {
  const f = fixture(t); f.git('tag', '-a', 'v0.2.1', '-m', 'duplicate tip'); fails(f.audit(), 'v0.2.1:unique-release-commit');
});
test('allows a new annotated release after an independent release commit', t => {
  const f = fixture(t); f.pkg('0.2.1'); f.commit('release 0.2.1'); f.git('tag', '-a', 'v0.2.1', '-m', 'Release 0.2.1'); assert.equal(f.audit('v0.2.1').ok, true);
});
test('rejects a lightweight tag for a new release', t => {
  const f = fixture(t); f.pkg('0.2.1'); f.commit('release 0.2.1'); f.git('tag', 'v0.2.1'); fails(f.audit('v0.2.1'), 'release:annotated-tag');
});
test('rejects a release/package version mismatch', t => {
  const f = fixture(t); f.write('notes.txt', 'release'); f.commit('release without version bump'); f.git('tag', '-a', 'v0.2.1', '-m', 'Release 0.2.1'); fails(f.audit('v0.2.1'), 'release:version:package.json');
});
test('rejects a workspace version mismatch', t => {
  const f = fixture(t); f.pkg('0.2.1'); mkdirSync(join(f.cwd, 'packages', 'core'), { recursive: true }); f.write('packages/core/package.json', JSON.stringify({ version: '0.2.0' })); f.commit('release with mismatched workspace'); f.git('tag', '-a', 'v0.2.1', '-m', 'Release 0.2.1'); fails(f.audit('v0.2.1'), 'release:version:packages/core/package.json');
});
test('accepts a correctly versioned multi-workspace release', t => {
  const f = fixture(t); f.pkg('0.2.1');
  for (const path of ['packages/core', 'apps/studio']) { mkdirSync(join(f.cwd, path), { recursive: true }); f.write(`${path}/package.json`, JSON.stringify({ version: '0.2.1' })); }
  f.commit('release 0.2.1 workspaces'); f.git('tag', '-a', 'v0.2.1', '-m', 'Release 0.2.1'); assert.equal(f.audit('v0.2.1').ok, true);
});
test('rejects release mode when HEAD is ahead of the requested tag', t => {
  const f = fixture(t); f.write('notes.txt', 'maintenance'); f.commit('maintenance'); fails(f.audit('v0.2.0'), 'release:at-HEAD'); assert.equal(f.audit().ok, true);
});
test('accepts a clean detached release checkout', t => {
  const f = fixture(t); f.git('checkout', '--detach', 'v0.2.0'); assert.equal(f.audit('v0.2.0').ok, true);
});
test('rejects a replacement root unrelated to historical commits', t => {
  const f = fixture(t); f.git('checkout', '--orphan', 'unrelated'); f.git('commit', '-m', 'unrelated root'); fails(f.audit(), 'v0.2.0:ancestor-of-HEAD');
});
test('rejects shallow clones', t => {
  const f = fixture(t); const shallow = join(f.home, 'shallow');
  execFileSync('git', ['clone', '--depth=1', pathToFileURL(f.cwd).href, shallow], { env: f.env, stdio: 'pipe' });
  fails(auditRepository({ cwd: shallow, baselines: f.baselines }), 'complete-history');
});
test('rejects directories without a working Git repository', t => {
  const f = fixture(t); fails(auditRepository({ cwd: f.home, baselines: f.baselines }), 'repository');
});
test('audit is read-only for index, refs and status', t => {
  const f = fixture(t); const index = readFileSync(join(f.cwd, '.git', 'index')); const refs = f.git('show-ref'); const status = f.git('status', '--porcelain');
  assert.equal(f.audit().ok, true); assert.deepEqual(readFileSync(join(f.cwd, '.git', 'index')), index); assert.equal(f.git('show-ref'), refs); assert.equal(f.git('status', '--porcelain'), status);
});
test('CLI rejects invalid arguments without claiming a passed check', t => {
  const f = fixture(t); const script = fileURLToPath(new URL('../git-history-check.mjs', import.meta.url));
  for (const args of [['--release'], ['--unknown']]) {
    const r = spawnSync(process.execPath, [script, ...args], { cwd: f.cwd, encoding: 'utf8' }); assert.equal(r.status, 2); assert.match(r.stderr, /Usage:/);
  }
});
