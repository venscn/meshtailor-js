# Git 历史与恢复

## 本次仓库交接包

本包直接包含 `.git/`。解压后在项目根目录运行：

```bash
git status
git log --graph --oneline --decorate --all
git tag --list 'v*' --sort=version:refname
```

不要重新 `git init`。`.git` 是隐藏目录，Finder / 文件资源管理器默认可能不显示它。

HEAD 位于 `master`，是应用 v0.2.0 之后的已提交维护快照；不是将旧版 `v0.2.0` tag 移到当前 HEAD。详见 `docs/GIT_HANDOFF.md`。

## bundle 备份

`.history/repository.bundle` 含与本包相同 HEAD 的完整可达历史、分支和发布 tag。它是打包时生成的忽略文件，不提交到 Git，避免把历史嵌入历史。

如果 `.git/` 在传输或解压中被丢弃，可以从解压后的项目根目录恢复到一个新目录：

```bash
git clone .history/repository.bundle ../meshtailor-js-restored
cd ../meshtailor-js-restored
git remote remove origin
git log --graph --oneline --decorate --all
```

这里移除的 `origin` 是刚从本地 bundle 克隆时产生的本地文件路径；不要对已经有用户远端的仓库照搬这条命令。

早期 v0.1.1 / v0.2.0 源码发布 ZIP 只附 bundle，没有直接附 `.git/`，所以需要先恢复。它们的原始内容和 tag 均未改写。

打包仓库没有远端地址、私人签名密钥或凭据，也没有为用户设置个人提交身份。日后提交请使用自己的 Git 身份配置。
