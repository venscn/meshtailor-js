# Git 协作与版本管理

[English](GIT_WORKFLOW.md) | **简体中文**

## 历史连续性

本仓库从已经交付的 v0.2.0 `.history/repository.bundle` 恢复，沿用所有原始提交和 tag。

| 版本 | 提交 | 原有 tag 类型 |
| --- | --- | --- |
| v0.1.0 | e7d080f8353eb11c05431a141d2708f22459d2bc | 轻量 |
| v0.1.1 | 9b3a581b4d77623062370d4d474db81130febe5a | 轻量 |
| v0.2.0 | 1500f2bf2e3a9ead88c48734b6ae6604acc4d32c | 附注 |

`v0.1.0` 是对最初交付源码的快照导入，不含其最初编写过程的逐步历史。这段历史无法从 ZIP 还原，不得把事后拆分伪装成当时的开发提交。
`v0.1.0..v0.1.1` 有 6 个提交，`v0.1.1..v0.2.0` 有 11 个提交。

之后的工作必须在这条历史上继续；旧 tag 的引用对象与最终提交均不得变化。

## 分支模型

使用 `main` 作为公开集成分支与 GitHub 默认分支。它包含最新已审查源码，可以存在发布 tag 之后的维护提交；已有 tag 始终表示不可变发布快照。

从 `main` 创建短期 `feature/<topic>` 或 `fix/<topic>` 分支处理独立改动，提交 PR、运行适用 CI 后集成。本项目当前流程不需要常驻 `develop` 分支；只有确实同时维护独立版本线时才建立发布维护分支。

现有本地 `master`、`fix/*` 和 `recovery/*` 指针是历史检查点，不代表仍在并行开发。其提交都已包含在公开历史祖先链中。本地保留供恢复，首次上传 GitHub 只需要 `main` 与既有 tag，无需上传每个旧分支。明确选择 ref，不使用 `git push --all` 或 `git push --mirror`。

## 小步开发

开始前先检查已有修改，在任务分支上围绕独立目的开发。实现必要依赖和测试可以放在同一提交；独立 UI 改动、导入修复、性能改进、测试补充、文档应拆开。

```bash
git status --short
git switch -c feature/your-task
# 修改一个可独立审查的功能或修复，运行相关检查。
git diff --check
git diff
# 明确选择本次相关文件；不要混入用户无关的修改。
git add <相关文件>
git commit -m "fix(scope): explain one logical change"
```

提交消息推荐 `feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`chore` 等前缀。不以文件数机械切分；目标是可审查与可回退的逻辑变更。禁止把已经发布的历史 squash 成一个新基线。

标题只使用一个 scope，并说明具体目的，例如 `fix(uv): preserve the inner boundary of a ring`。AI 辅助提交把标记放在同一个 scope 内：`fix(uv-AI): preserve the inner boundary of a ring`，不使用 `fix(AI)(uv): ...` 这种双 scope 格式。正文记录有意义的验证和约束，不宣称超出实际变更与检查的结果。

首次公开前，可在完整备份后，用独立分支规范本地维护段的消息。保留原分支和新旧提交映射，并保持文件树、作者、时间、顺序及已有 tag。已公开或已打 tag 的历史不因外观而改写；不为让图形复杂而补造合并、日期或开发步骤。

## 新版本发布

功能完成后，更新根目录、各 workspace 和界面中适用的版本号、发布说明及验证记录，作为独立 release 提交。运行功能测试后确认工作区干净，再创建新的附注 tag：

```bash
npm run git:check
npm run test:git
# 另外运行本次变更所需的功能测试与构建。
git status --porcelain
git tag -a vX.Y.Z -m "Release vX.Y.Z"
npm run git:check -- --release vX.Y.Z
```

上述 `vX.Y.Z` 是示意，替换为实际版本；不能照抄执行。检查脚本不会创建、移动或删除 tag。新版本必须有独立提交；不得复用既有版本提交。正式新版本要求附注 tag，历史轻量 tag 仅作为保留的例外。

更新 `scripts/git-release-baselines.json` 时保留已有条目。新 tag 创建后，在后续维护提交登记它的最终引用对象与提交，以避免把本次提交哈希写进自身形成循环。

这套校验是本地约定和防误操作工具，不是远端强制策略，不证明代码无误，也不提供签名认证；如将来使用远端，需要在真实托管服务另外配置分支/tag 保护。

## 发布包与仓库交接包不同

**应用发布包**必须对应一个不可变版本 tag，源码从干净的该 tag/HEAD 导出。

**Git 仓库交接包**用于继续开发，允许 HEAD 包含发布 tag 之后已提交的维护变更，必须明确写出 HEAD，工作区必须干净，不能把它冒称为旧 tag 原版源码。
早期 v0.2.0 Git 交接包属于后者：当时只有 Git 规则、校验、测试与交付说明变更，没有创建 v0.2.1，也没有移动 v0.2.0。这是历史示例；当前应用版本以根目录 package.json 为准，维护提交可以位于最新发布 tag 之后。

包含 `.git/` 的仓库解压后直接使用，不要再次 `git init`。bundle 可作为异地/离线备份：

```bash
git clone .history/repository.bundle ../meshtailor-js-restored
cd ../meshtailor-js-restored
git remote remove origin
```

`origin` 在 bundle 克隆后是本地备份路径，最后一条仅用于新克隆的恢复目录；不要用于已有用户远端仓库。

## 查看与比较

```bash
git log --graph --decorate --oneline --all
git tag --list 'v*' --sort=version:refname
git rev-parse 'v0.1.0^{commit}'
git rev-parse 'v0.2.0^{commit}'
git diff --stat v0.1.0 v0.2.0
git switch --detach v0.1.0
# 查看后回到此前所在分支：
git switch -
```

旧 tag 中没有后来添加的工具文件，因此切到旧版后不能假定 `git:check` 等新命令仍存在。Git 命令可在 Windows PowerShell、macOS Terminal、Git Bash 使用；各次实际验证的平台与范围以对应记录为准。
