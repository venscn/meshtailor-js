#!/usr/bin/env node
/** Read-only Git provenance checks. Uses only Node.js built-ins and the Git CLI. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
export const releaseBaselines = JSON.parse(readFileSync(join(dirname(scriptPath), 'git-release-baselines.json'), 'utf8'));
const releasePattern = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Return a structured report; never edit the index, working tree, refs, or configuration. */
export function auditRepository({ cwd = process.cwd(), baselines = releaseBaselines, release = null } = {}) {
  const checks = [];
  const git = (...args) => {
    try {
      return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
    } catch { return null; }
  };
  const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
  const result = () => ({ ok: checks.every(c => c.ok), head: git('rev-parse', 'HEAD'), release, checks });
  check('repository', git('rev-parse', '--is-inside-work-tree') === 'true', 'A working Git repository is required.');
  if (!checks[0].ok) return result();
  check('complete-history', git('rev-parse', '--is-shallow-repository') === 'false', 'Shallow clones cannot certify the complete release history.');
  const status = git('status', '--porcelain=v1', '--untracked-files=all');
  check('clean-worktree', status === '', status ?? 'git status failed');
  check('baseline-manifest', Array.isArray(baselines) && baselines.length > 0, 'At least one pinned release is required.');
  if (!Array.isArray(baselines)) return result();
  let previous = null;
  for (const baseline of baselines) {
    const { tag, refObject, commit, tagType, commitsSincePrevious } = baseline;
    const ref = `refs/tags/${tag}`;
    const observedRef = git('rev-parse', '--verify', ref);
    const observedCommit = git('rev-parse', '--verify', `${ref}^{commit}`);
    check(`${tag}:ref`, observedRef === refObject, `expected ${refObject}; observed ${observedRef ?? 'missing'}`);
    check(`${tag}:commit`, observedCommit === commit, `expected ${commit}; observed ${observedCommit ?? 'missing'}`);
    check(`${tag}:type`, git('cat-file', '-t', ref) === tagType, `expected ${tagType}`);
    check(`${tag}:ancestor-of-HEAD`, git('merge-base', '--is-ancestor', commit, 'HEAD') !== null);
    if (previous) {
      check(`${tag}:ordered-history`, git('merge-base', '--is-ancestor', previous.commit, commit) !== null);
      check(`${tag}:distinct-commit`, previous.commit !== commit);
      if (Number.isInteger(commitsSincePrevious)) {
        const count = git('rev-list', '--count', `${previous.commit}..${commit}`);
        check(`${tag}:commit-count`, count !== null && Number(count) === commitsSincePrevious, `expected ${commitsSincePrevious}; observed ${count}`);
      }
    }
    previous = baseline;
  }
  const seen = new Map();
  const tags = git('tag', '--list', 'v*');
  check('list-release-tags', tags !== null);
  for (const tag of (tags ?? '').split('\n').filter(t => releasePattern.test(t))) {
    const commit = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
    check(`${tag}:unique-release-commit`, commit !== null && !seen.has(commit), seen.has(commit) ? `same commit as ${seen.get(commit)}` : commit ?? 'not a commit');
    if (commit) seen.set(commit, tag);
  }
  if (release !== null) {
    check('release:valid-name', typeof release === 'string' && releasePattern.test(release));
    if (!checks.at(-1).ok) return result();
    const ref = `refs/tags/${release}`;
    const commit = git('rev-parse', '--verify', `${ref}^{commit}`);
    check('release:at-HEAD', commit !== null && commit === git('rev-parse', 'HEAD'), `tag ${release} must point at HEAD`);
    const legacy = baselines.some(b => b.tag === release && b.tagType === 'commit');
    check('release:annotated-tag', legacy || git('cat-file', '-t', ref) === 'tag', legacy ? 'Existing legacy lightweight tag is preserved.' : 'New releases require an annotated tag.');
    const tracked = git('ls-files', '-z');
    const manifests = (tracked ?? '').split('\0').filter(p => p === 'package.json' || /^(?:apps|packages)\/[^/]+\/package\.json$/.test(p));
    check('release:root-package', manifests.includes('package.json'));
    for (const filename of manifests) {
      try {
        const pkg = JSON.parse(readFileSync(join(cwd, filename), 'utf8'));
        check(`release:version:${filename}`, pkg.version === release.slice(1), `expected ${release.slice(1)}; observed ${pkg.version}`);
      } catch (error) { check(`release:version:${filename}`, false, error.message); }
    }
  }
  return result();
}

function main() {
  const args = process.argv.slice(2);
  let release = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') json = true;
    else if (args[i] === '--release' && args[i + 1] && !args[i + 1].startsWith('-')) release = args[++i];
    else throw new Error('Usage: node scripts/git-history-check.mjs [--release vX.Y.Z] [--json]');
  }
  const report = auditRepository({ release });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const c of report.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${!c.ok && c.detail ? `: ${c.detail}` : ''}`);
    console.log(`${report.ok ? 'OK' : 'FAILED'}: ${report.checks.filter(c => c.ok).length}/${report.checks.length} checks; HEAD ${report.head}`);
    console.log('This checks Git history and release metadata, not application functionality or signatures.');
  }
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 2; }
}
