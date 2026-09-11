# Git 协作与版本管理

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

## 小步开发

开始前先检查已有修改，在任务分支上围绕独立目的开发。实现必要依赖和测试可以放在同一提交；独立 UI 改动、导入修复、性能改进、测试补充、文档应拆开。

```bash
git status --short
git switch -c feat/your-task
# 修改一个可独立审查的功能或修复，运行相关检查。
git diff --check
git diff
# 明确选择本次相关文件；不要混入用户无关的修改。
git add <相关文件>
git commit -m "fix(scope): explain one logical change"
```

提交消息推荐 `feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`chore` 等前缀。不以文件数机械切分；目标是可审查与可回退的逻辑变更。禁止把已经发布的历史 squash 成一个新基线。

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
本次 Git 交接包属于后者：应用代码仍基于 v0.2.0，之后仅有 Git 规则、校验、测试与交付说明变更，没有创建 v0.2.1，也没有移动 v0.2.0。

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
# 查看后回到默认维护分支：
git switch master
```

旧 tag 中没有后来添加的工具文件，因此切到旧版后不能假定 `git:check` 等新命令仍存在。Windows PowerShell、macOS Terminal、Git Bash 可使用以上 Git 命令；本次执行环境为 Linux，未宣称运行过 macOS/Windows 原生测试。
