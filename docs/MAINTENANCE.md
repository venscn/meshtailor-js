# Continuous maintenance

**English** | [简体中文](MAINTENANCE.zh-CN.md)

The project follows [AGENTS.md](../AGENTS.md) and the [Git workflow](GIT_WORKFLOW.md). Maintenance is local until the user approves a concrete upload. Never infer push approval from a previous cycle, timer, successful test or merge into develop.

## One audit cycle

1. Inspect status, current branch, recent commits, active task branches and pending batches. Preserve user edits. Use a dedicated worktree when the calling checkout is occupied.
2. Compare actual implementation and documentation. Audit dead or duplicate code, outdated instructions, contradictory semantics, declared module dependencies, localization, both themes, responsive layouts and dynamic resize. Keep historical experiments distinct from production acceptance.
3. Record only actionable findings with evidence, priority, impact, reproduction, affected files and a meaningful verification target. Recheck previously reported findings and avoid duplicates. Mark uncertainty explicitly.
4. Group findings only when they share a responsibility, root cause or required dependency. Use separate feature/fix branches for independent batches; prioritize correctness and inaccessible functionality before cosmetic cleanup. Do not force a batch merely to reduce branch count.
5. Implement bounded fixes and commit each coherent verified step. Test the actual affected contract or regression; use existing meaningful coverage instead of adding tests that mirror the implementation.
6. Review the combined result, integrate verified work locally into develop where appropriate, and record completed work, checks and remaining gaps. Leave main, remote branches and release tags unchanged.

If no actionable finding exists, do no speculative cleanup, create no empty branch or repetitive report, and wait for the next cycle. Scheduled runs stay quiet when there is no meaningful change; report completed batches, new material findings, failures or decisions requiring the user. Frequency is controlled by the Codex automation, not by a background loop in the application.

## Finding record

The current thread heartbeat runs daily at **09:00 Asia/Shanghai**, as requested by the maintainer. It audits and develops locally, and never uploads without approval. The scheduled run requires this Codex environment to be available; it is not a deployed service or an application timer.

Use `docs/audits/YYYY-MM-DD.md` for a useful cycle report. For each finding, include a stable identifier, priority, evidence, status, owning branch, natural grouping rationale, validation and remaining limitations. Historical checkpoints and previously completed feature branches are not active tasks simply because their refs still exist.

Priority: P0 for data loss/security or a broken core contract, P1 for unavailable required functionality/correctness, P2 for maintainability or misleading documentation, P3 for optional polish. A priority label is not permission to broaden scope or change remote state.

## Module requirements

The user confirmed that this project needs neither an HTTP backend nor an operations frontend. Keep the Studio client, offline workbench, CLI and shared domain packages distinct; do not add an artificial server, operations page or empty directory to satisfy a generic architecture convention. If a service is explicitly requested later, separate its responsibilities and use clear contracts. Shared presentation utilities expose localization/theme policy without making pure geometry depend on React, the DOM or HTTP.

User-facing modules must support English and simplified Chinese, light and dark themes, narrow and short screens, and resizing the same running page. Include displayed diagnostics and drawn views in verification. Preferences must never alter generator inputs, seams or face-corner output. Architecture documents describe implemented capabilities and label future work explicitly.
