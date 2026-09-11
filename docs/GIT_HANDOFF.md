# MeshTailor-JS Git 仓库交接说明

## 这次修改

从 v0.2.0 发布包的 `.history/repository.bundle` 恢复原始仓库，没有重新初始化或重建历史。
保留原来的 18 个提交和三个发布 tag，并在 `master` 上增加四个按逻辑拆分的维护提交：维护规范、Git 校验工具、校验测试、交付说明。网格算法、FBX 导入和 Studio 运行代码均未改变。

这不是应用 v0.2.1 发布，也不是重新定义 v0.2.0。根目录及 workspace 的应用版本保持 0.2.0；`master` 比应用 release tag 多出维护工具与文档。继续开发应使用 `master` 或从其创建任务分支。

## 已有版本

| tag | 最终提交 | 从上一版增加的提交数 |
| --- | --- | --- |
| v0.1.0 | e7d080f8353eb11c05431a141d2708f22459d2bc | 导入最初已交付的快照 |
| v0.1.1 | 9b3a581b4d77623062370d4d474db81130febe5a | 6 |
| v0.2.0 | 1500f2bf2e3a9ead88c48734b6ae6604acc4d32c | 11 |

v0.1.0 与 v0.2.0 是不同 tag、不同提交和不同源码快照。
v0.1.0 / v0.1.1 原本是轻量 tag；v0.2.0 原本是附注 tag，其 tag 对象为 `e6c2a290c0bced503a5ea65df78cb27b28aca836`。三者的引用对象均保持原样，不能为了统一类型而重写已发布 tag。

最初 v0.1.0 的开发过程没有小步历史，只有真实的快照导入提交。之后 17 个功能/修复等提交完整存在。本次不伪造无法恢复的最初开发过程。

## 核对原发布包

对三个原 ZIP 先验证随附的 SHA256，再把对应 tag 导出的每个文件与 ZIP 内文件逐字节比较。

| 版本 | tag 中跟踪文件数 | 缺失 | 内容差异 | ZIP 额外文件 |
| --- | ---: | ---: | ---: | --- |
| v0.1.0 | 59 | 0 | 0 | 无 |
| v0.1.1 | 75 | 0 | 0 | `.history/repository.bundle` |
| v0.2.0 | 112 | 0 | 0 | `.history/repository.bundle` |

可机读证据见 `GIT_SOURCE_AUDIT.json`。额外的 bundle 是未跟踪的历史备份，不是源码不一致。

## 解压即可使用

```bash
cd meshtailor-js
git status
git log --graph --decorate --oneline --all
git tag --list 'v*' --sort=version:refname
npm run git:check
npm run test:git
```

两个新增命令仅使用 Node.js 内置模块和 Git，不需先运行 `npm install`。应用本身仍按 README 安装依赖和启动。
本包不配置私人作者身份，也不指向未经用户提供的远端服务器。首次在本机提交前，应确认你自己的 `user.name` / `user.email` 已设置。

## 校验范围

`git:check` 验证：非浅仓库、干净工作区、原 tag 对象/提交不变、历史祖先链、已知版本之间的提交数量，以及发布 tag 不共用提交。`--release vX.Y.Z` 另外验证 tag 指向 HEAD、新 tag 为附注形式、根目录与 workspace 版本一致。

本次新增 22 项测试，覆盖删除 tag、移动 tag、修改附注、未提交文件、不同版本共用提交、新版轻量 tag、版本不一致、脱离历史的根、浅克隆、detached checkout、只读检查等场景。所有破坏性测试均在临时测试仓库中完成，没有改写项目 tag。

当前交接 HEAD 不等于 `v0.2.0`，所以 `npm run git:check -- --release v0.2.0` **应当失败**；这是防止把维护快照冒充旧版源码的正确行为。普通 `npm run git:check` 应通过。

本次已重新运行：Git 工具测试 22 项、核心/视图数学回归 21 项、复杂网格/UV/资产结构回归 40 项。Git 正常检查共 26 项。
未重新执行完整 React/Three.js、真实 FBXLoader、Vite 构建或浏览器 GPU 测试；本次修改不涉及这些运行代码，不将 Git 检查等同于功能验证。执行平台为 Linux + Node.js 22.16.0 + Git 2.47.3，未宣称完成 macOS / Windows 原生验证。

交付时额外检查仓库完整性、最终 ZIP 解压后工作区状态、历史/tag 与原 bundle 一致性和 bundle 克隆恢复；最终结果及交付 HEAD 记录在随包外提供的 Git 审计报告。

## 后续开发规则

根目录 `AGENTS.md` 是本项目的开发约束，面向人工与 Codex：小步提交、保持真实历史、禁止改写旧 tag、从干净已提交状态发布并保留可恢复历史。完整规则见 `GIT_WORKFLOW.md`。
