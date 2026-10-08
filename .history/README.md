# Git 历史

本仓库沿用已有 `.git/` 历史；从 GitHub 克隆后无需再次 `git init`。历史恢复背景见 [REPACK-NOTES.md](../REPACK-NOTES.md)。

```bash
git status
git log --graph --decorate --oneline --all
git tag --list
npm run git:check
```

v0.4.18 损坏交付包的源码恢复使用 `recovery/v0.4.18-repack` 分支及 `repack-0.4.18-2` 标识；它们是历史恢复节点，不是当前版本。原始提交与可恢复 tag 继续保留，缺失历史的边界不作改写。

`.history/` 不重复保存已存在于 `.git/` 的完整 bundle。需要额外备份时可以自行生成：

```bash
git bundle create ../meshtailor-js-backup.bundle --all
git bundle verify ../meshtailor-js-backup.bundle
```

不要用交付包覆盖另一个已有用户提交的仓库，不要移动原发布 tag。版本管理约束见 [Git 工作流](../docs/GIT_WORKFLOW.md)。
