# MeshTailor-JS：Git 维护约束

适用于本仓库中的人工开发、Codex 和其他自动化开发工具。

## 必须遵守

1. 在现有 Git 历史上继续工作。开始前检查 `git status`、当前分支和 `git log`；不得用 `git init` + 整包导入替换已有历史。
2. 每个独立修复、功能、重构、测试和文档变更按逻辑小步提交。每个提交应可解释、可审查、可回退；紧密关联的实现和必要测试可以一起提交。不得积累整个版本后一次性提交，也不得事后编造开发历史。
3. 保留已经发布的提交与 tag，不执行强制改写、移动或删除发布 tag，不把不同版本标到同一个提交上。新发布使用独立的附注 tag，例如 `git tag -a v0.2.1 -m "Release v0.2.1"`。
4. 已有发布基线：`v0.1.0`、`v0.1.1`、`v0.2.0`。前两个是原有轻量 tag，最后一个是附注 tag；不为改变 tag 类型而重写旧 tag。
5. 发布前工作区和暂存区必须干净，版本号与 tag 相符，tag 必须指向待发布的 HEAD。运行适用测试，明确记录未执行、失败或受环境限制的验证。
6. 交付必须可恢复完整 Git 历史、全部发布 tag 和小步提交。优先提供含 `.git/` 的可直接使用仓库；可附完整 `.history/repository.bundle` 作为备份。不包含凭据、开发机 remote 路径或依赖目录。
7. 不自动强推远端，不覆盖用户的未提交修改。变更已有远端设置前征得用户同意。

## 日常核对

```bash
git status --short
git log --oneline --decorate -15
git tag --list 'v*' --sort=version:refname
npm run git:check
npm run test:git
```

`git:check` 验证已记录的历史基线、tag 身份、祖先链和工作区状态，不替代功能测试。
正式新发布可额外执行 `npm run git:check -- --release vX.Y.Z`。
完整规范、历史限制与交付类型见 `docs/GIT_WORKFLOW.md`。
