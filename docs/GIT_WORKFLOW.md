# Git collaboration and version management

**English** | [简体中文](GIT_WORKFLOW.zh-CN.md)

## Preserve the existing history

This repository was restored from the delivered v0.2.0 `.history/repository.bundle`, retaining all original commits and tags.

| Version | Commit | Original tag type |
| --- | --- | --- |
| v0.1.0 | e7d080f8353eb11c05431a141d2708f22459d2bc | Lightweight |
| v0.1.1 | 9b3a581b4d77623062370d4d474db81130febe5a | Lightweight |
| v0.2.0 | 1500f2bf2e3a9ead88c48734b6ae6604acc4d32c | Annotated |

`v0.1.0` is a snapshot import of the initially delivered source; it does not contain the original development history. That history cannot be recovered from the ZIP. Do not reconstruct a sequence of commits and present it as the original development history.
There are 6 commits in `v0.1.0..v0.1.1` and 11 commits in `v0.1.1..v0.2.0`.

Continue all subsequent work on this history. Both the referenced object and the resolved commit of every existing tag must remain unchanged.

## Branch model

Use `main` as the public integration branch and GitHub default branch. It contains the latest reviewed source and may include maintenance commits after a release tag; a tagged release remains an immutable snapshot.

Create short-lived `feature/<topic>` or `fix/<topic>` branches from `main` for an independent change. Open a pull request, run the applicable CI checks, and integrate the completed work. A permanent `develop` branch is not needed for the current workflow. Create a release maintenance branch only when actually supporting a separate version line.

The existing local `master`, `fix/*`, and `recovery/*` pointers are historical checkpoints, not active parallel development. Their commits are already ancestors of the public history. They are retained locally for recovery; initial GitHub publication needs `main` and the existing tags, not every local branch. Select refs explicitly instead of using `git push --all` or `git push --mirror`.

## Develop in small steps

Inspect existing changes before starting, then work on a task branch with one independent purpose at a time. An implementation, its necessary dependencies, and its tests may share a commit. Separate unrelated UI changes, import fixes, performance improvements, additional tests, and documentation.

```bash
git status --short
git switch -c feature/your-task
# Make one independently reviewable change and run its relevant checks.
git diff --check
git diff
# Select task-related files explicitly; preserve unrelated user changes.
git add <task-files>
git commit -m "fix(scope): explain one logical change"
```

Recommended commit prefixes include `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, and `chore`. Group commits by logical purpose, rather than file count, so each change can be reviewed and reverted. Do not squash published history into a new baseline.

Use one scope and a concrete reason, for example `fix(uv): preserve the inner boundary of a ring`. For AI-assisted work, retain the AI marker inside that same scope: `fix(uv-AI): preserve the inner boundary of a ring`. Do not use the two-scope form `fix(AI)(uv): ...`. State meaningful verification or constraints in the body, and avoid messages that claim a broader result than the files and checks demonstrate.

Before first publication, a local maintenance tail can have its messages normalized in a separate branch after a full backup. Keep the original branch and an old-to-new commit map, and preserve file trees, authors, timestamps, order, and existing tags. Published or tagged history is not rewritten for presentation. Do not invent merges, dates, or development steps to make the graph look busier.

## Publish a new version

Once a feature is complete, update the applicable versions in the root, workspaces, and UI, together with release notes and validation records, in a separate release commit. Run functional tests and confirm that the working tree is clean before creating a new annotated tag:

```bash
npm run git:check
npm run test:git
# Also run the functional tests and builds required for this change.
git status --porcelain
git tag -a vX.Y.Z -m "Release vX.Y.Z"
npm run git:check -- --release vX.Y.Z
```

`vX.Y.Z` is a placeholder: replace it with the actual version before running these commands. The check scripts do not create, move, or delete tags. Every new version must have a distinct commit; do not reuse an existing release commit. New releases require annotated tags; the historical lightweight tags are preserved exceptions.

Keep existing entries when updating `scripts/git-release-baselines.json`. After creating a new tag, record its final referenced object and resolved commit in a subsequent maintenance commit. This avoids a circular attempt to record a commit's own hash inside that commit.

These checks implement a local convention and guard against mistakes. They are not a remotely enforced policy, proof of code correctness, or signature verification. If a remote is used, configure branch and tag protection separately on the hosting service.

## Application releases and repository handovers

An **application release package** must correspond to an immutable version tag, with source exported from that clean tag/HEAD.

A **Git repository handover package** supports continued development. Its HEAD may include committed maintenance changes after a release tag, but it must identify HEAD explicitly, have a clean working tree, and must not be presented as the unchanged source of an older tag.
The early v0.2.0 Git handover was such a package: it added only Git rules, checks, tests, and delivery documentation. It neither created v0.2.1 nor moved v0.2.0. This is a historical example; the current application version is defined in the root `package.json`, and maintenance commits may follow the latest release tag.

Use an extracted repository containing `.git/` directly; do not run `git init` again. A bundle can serve as an off-site or offline backup:

```bash
git clone .history/repository.bundle ../meshtailor-js-restored
cd ../meshtailor-js-restored
git remote remove origin
```

After cloning a bundle, `origin` points to the local backup path. The final command applies only to this newly cloned recovery directory; do not use it on an existing repository with a user-configured remote.

## Inspect and compare versions

```bash
git log --graph --decorate --oneline --all
git tag --list 'v*' --sort=version:refname
git rev-parse 'v0.1.0^{commit}'
git rev-parse 'v0.2.0^{commit}'
git diff --stat v0.1.0 v0.2.0
git switch --detach v0.1.0
# Return to the previous branch after inspecting the old version:
git switch -
```

Older tags do not contain tools added later, so do not assume that newer commands such as `git:check` exist after checking out an old version. These Git commands can be used in Windows PowerShell, macOS Terminal, or Git Bash. Refer to each validation record for the platforms and scope actually tested.
