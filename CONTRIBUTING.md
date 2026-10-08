# 贡献指南

## 本地开发

使用 Node.js 22.16+ 和 npm，先安装依赖：

```bash
npm ci
npm run dev
```

目录分工：`apps/studio` 为 React/Vite 主界面，`apps/unfold-lab` 为离线工作台源码，`apps/cli` 为 OBJ CLI；`packages/mesh-core` 处理几何与拓扑，`packages/uv` 负责展开、排布与后处理。其余包提供切缝链、运行时与研究后端接口。

## 提交前验证

```bash
npm run check:geometry
npm run check
npm run test:git
```

按改动增加相关专项检查。修改生成策略时，必须执行两份真实夹具的 original / absent / random UV 三变体测试，并比较全部实际切缝和面角坐标：

```bash
npm run test:geometry:real
```

离线工作台源码或生产模块变更后，用 `npm run lab:build` 更新 `unfold-lab.html`。浏览器回归需要 Chrome / Chromium / Edge，可设置 `CHROME_PATH`；例如 `npm run test:geometry:browser`。记录环境限制，不用离线验证冒充完整 Studio 的浏览器验证。

旧 `source-atlas` / 原岛提示相关脚本属于历史实验，不是当前生成器的验收依据。请保留原断言与历史。

## 问题与补丁

报告问题时提供复现步骤、预期与实际结果、应用版本、浏览器 / Node.js 版本、触发设置和最小模型。只有可公开再分发的模型才适合作为仓库夹具；同时提供来源与许可。

保持改动聚焦，保留已有提交和 tag，按独立目的提交实现与必要回归测试。不要覆盖他人未提交的修改。详细规范见 [AGENTS.md](AGENTS.md) 和 [Git 工作流](docs/GIT_WORKFLOW.md)。

新增资产时更新 [第三方说明](THIRD_PARTY_ASSETS.md)，维护固定夹具的校验值；不要用同名下载替换已有真实模型。
