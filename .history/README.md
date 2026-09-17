# Git 历史

本次压缩包直接包含 `.git/`，解压后无需 `git init` 或恢复 bundle。

```bash
git status
git log --graph --decorate --oneline --all
git tag --list
npm run git:check
```

本包保留最后完整 v0.4.17 包中的真实历史和全部旧 tag。损坏的 v0.4.18 包未写到 Git 数据，本轮只能恢复其完整源码，不能恢复当时缺失的开发提交；这一区别见根目录 `REPACK-NOTES.md`。当前为 `recovery/v0.4.18-repack` 分支及 `repack-0.4.18-1` 附注 tag。

为避免完整历史重复一遍，本包**不再附 repository.bundle**。需要额外备份时可以自行生成：

```bash
git bundle create ../meshtailor-js-backup.bundle --all
git bundle verify ../meshtailor-js-backup.bundle
```

不要用本包覆盖另一个已有用户提交的仓库；不要移动原发布 tag。本包无远端配置，也不包含凭据。
