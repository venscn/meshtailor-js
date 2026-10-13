[English](TESTING.md) | [**简体中文**](TESTING.zh-CN.md)

# 测试命令与证据

按变更行为选择测试。一次通过仅适用于该命令、输入、配置和环境，不代表本仓库所有脚本通过。历史报告描述的是原先执行结果。

## 当前验收

使用 Node.js 22.16+ 和锁定安装（`npm ci`）。以下已有命令保留原名和行为：

| 命令 | 目的 | 执行时机 |
| --- | --- | --- |
| `npm test` | Vitest 包与导入器回归 | 修改其覆盖的行为 |
| `npm run check:geometry` | 严格核心编译；几何输入隔离、边界、候选契约、拓扑、统一生成策略和核心回归 | 修改几何流程或生成器 |
| `npm run check` | 单元测试、Studio 生产构建与完整类型检查 | 应用或代码变更 |
| `npm run typecheck` | 完整 TypeScript 检查 | 类型与模块边界变更 |
| `npm run test:git` / `npm run git:check` | Git 工具回归 / 实际发布身份不可变和仓库干净状态 | Git 工具变更 / 维护批次提交后 |
| `npm run test:geometry:real` | 两份 SHA 固定真实模型；原有、缺失、随机 UV 三变体；全部切缝/面角签名及 OBJ 一致 | 每次修改生成策略 |

`test:geometry:real -- --one-variant` 只是诊断捷径，**不是**必须的六次 UV 隔离验收。不能替换成同名模型，也不能仅比较岛数。测试程序可以改变或读取原 UV 作为参考，但不得让它指导生产生成。

## 按行为选择回归

保留的 `test:*` 是专项检查，不是要求每周期运行全部 npm scripts。此索引提供常用起点，不重命名无关套件：

| 行为 | 命令 |
| --- | --- |
| 导入/解析、对应关系 | `test:imports`、`test:complex`、`test:core`、`test:materials`、`test:uv-guards` |
| 几何/结构 | `test:geometry-input`、`test:geometry-boundaries`、`test:geometry-candidates`、`test:geometry-topology`、`test:geometry-policy`、`test:revolved-profile`、`test:revolved-profile:worker`、`test:tube-strips`、`test:tube-strips:worker`、`test:continuity:worker` |
| UV 有效性/排布 | `test:parameterization`、`test:atlas`、`test:atlas-pages`、`test:chart-merge`、`test:fill`、`test:fill:adaptive`、`test:fill-once`、`test:cavity-fill`、`test:fill-growth` |
| 播放/选择/相机 | `test:unfold`、`test:hinge`、`test:selection`、`test:motion`、`test:motion-time`、`test:relay`、`test:camera`、`test:arrival` |
| 传输生命周期 | `test:uv-client`、`test:uv-progress` |

读取 UV 字段本身不等于历史实验。解析/导出往返、受控动画夹具、**本次新生成** UV 的检查，仍是有意义的独立契约。例如 `test:unfold` 用合成 atlas 坐标测试动画端点，不声称这些坐标由几何自动生成。`test:geometry-policy` 故意提供过时选项/目标，断言它们被禁用或拒绝。

浏览器命令需要可用的 Chrome / Chromium / Edge（可用 `CHROME_PATH` 指定）。修改离线工作台或生产模块后需要 `npm run lab:build`。Node worker-thread 适配器不证明浏览器模块 Worker 加载、React、Three 导入器或 WebGL 已验证。

`test:geometry:browser` 保留当前纯几何策略检查，但还包含固定的 v0.4.20 岛数基线（齿轮 6、Corset 95、FlightHelmet 192）。[v0.4.30 记录](releases/0.4.30.md) 中工厂默认 Corset 81 岛、FlightHelmet 191 岛；`test:geometry-policy` 期待齿轮 5 岛。本次命令分类**没有**重跑或修复该浏览器套件。更新断言前应核对实际生成的完整面分区、面角坐标和 UI 配置，不能只为通过而降低断言。`check:full` 仍包含该浏览器套件和昂贵真实夹具套件，因此本次不能宣称这个聚合命令已通过。其他未改动浏览器套件也需要针对受影响行为重新执行。

## 离线 QA

`qa:*` 在自动生产路径以外分析原 UV、已知源分区或已生成快照。它们不能替代 `check:geometry` 或两份真实模型的六变体验收。原脚本与断言保持不变。

| 命令 | 输入与边界 |
| --- | --- |
| `qa:source-layout` | 合成源 UV/材质显示与导出契约（`source-layout-smoke.mjs`） |
| `qa:source-repair` | 直接调用旧源岛修复工具，没有当前生产 Worker 入口（`source-repair-smoke.mjs`） |
| `qa:human-uv`、`qa:human-uv:integration` | 包含根据 Corset 原 UV 岛 #12 选择的区域，不能证明自动纯几何发现 |
| `qa:recut-large`、`qa:recut-large:real` | 显式原切缝重切试验；自动生产填空拒绝原切缝重切 |
| `qa:peel:fill` | 直接填空已生成的 v0.4.18 JSON 快照；需要该快照，不是新几何生成 |
| `qa:source-models` | `verified-models-smoke.mjs --mode inspect --models examples/verified-models`；只审计参考 UV，不请求 Worker 生成 |
| `qa:structure-reference` | 在生成**之后**分析原始/生成组件；默认读取 `validation/local-geometry-real` 的生成 OBJ |
| `qa:paint-reference` | 比较指定历史快照的原轮廓；必须提供 `--root <快照目录>` |

脚本支持 `--out`、`--report` 或 `--root` 时，使用新的本地输出目录，例如：

```bash
npm run qa:source-models -- --out validation/local-source-models
npm run qa:human-uv -- --out validation/local-human-uv
npm run qa:structure-reference -- --generated-root validation/local-geometry-real --out validation/local-structure-reference
```

部分归档脚本硬编码版本化输出路径；`qa:human-uv:integration` 会写 `validation/v0.4.17/integration/report.json`。这类分析在可丢弃 worktree 执行，不能把新生成报告作为原始证据提交。`qa:recut-large:real` 和 `qa:peel:fill` 需要历史中间文件，源码仓库有意没有包含全部这些文件。

## 历史实验

`history:*` 保留早期生产/UI 前提。它们可能**按设计**在当前源码失败、请求已不存在的控件，或需要未随源码提供的历史资产。不能将其作为当前验收、悄悄削弱断言、恢复已移除的源 UV 生产路径，也不能用本次失败覆盖旧报告。要重现旧版本，在独立 worktree 检查不可变 tag 及当时的前置条件。

除下面合并的资产别名外，将 `test:` 换为 `history:` 后保留原命令后缀。分类依据实际请求/断言，而非文件名：

| 历史命令 | 保留脚本 | 过时契约证据 |
| --- | --- | --- |
| `history:browser` | `studio-smoke.mjs` | 第 104 行选择 Studio UV 目标 `source` |
| `history:unfold:browser` | `unfold-browser-smoke.mjs` | 第 72 行要求真实模块 Worker 返回 `source` 结果 |
| `history:uv-worker` | `uv-worker-smoke.mjs` | 第 28–36 行要求原 UV Worker 请求成功 |
| `history:uv-large` | `uv-large-worker-smoke.mjs` | 第 19 行将 `generated`、`source` 都作为成功 Worker 目标 |
| `history:uv-lifecycle:browser` | `uv-lifecycle-browser-smoke.mjs` | 第 24–25 行要求大型 `source` UI 请求成功 |
| `history:sample-asset` | `flight-helmet-smoke.ts` | 第 27 行默认执行 `generated` 和已移除的 `source`；还保留源种子后处理模式 |
| `history:seam-policy` | `seam-policy-smoke.mjs` | 第 15/20 行期待 `uv-seams → source`；生产接缝 Worker 拒绝 `uv-seams` |
| `history:large-charts:browser` | `large-charts-browser-smoke.mjs` | 第 15/25 行期待提取/检查原 UV，还包含较早生成数量 |
| `history:materials:browser` | `material-layout-browser-smoke.mjs` | 第 20/35 行要求原 UV 材质显示和已移除的 source-layout 控件 |
| `history:optimization:browser` | `uv-optimization-browser-smoke.mjs` | 第 9/18 行要求提取/恢复原 UV 重叠 |
| `history:source-atlas` | `source-atlas-smoke.mjs` | 第 16/18 行要求 `source`、`source-atlas` Worker 请求成功 |
| `history:area-spatial:browser` | `area-spatial-browser-smoke.mjs` | 第 10–11 行要求 source-atlas 提取和恢复原 UV |
| `history:verified-models` | `verified-models-smoke.mjs` | 第 12 行默认 source-atlas；第 32 行提交已移除的 Worker 目标；仅检查参考 UV 用 `qa:source-models` |
| `history:verified-models:browser` | `verified-models-browser-smoke.mjs` | 第 25/39 行要求 source-atlas 生成与恢复原 UV |
| `history:fill:browser` | `fill-browser-smoke.mjs` | 第 11 行先以 `source` UV 加载生产 UI，再填空 |
| `history:fill:real` | `fill-verified-models.mjs` | 调用归档真实模型程序的默认 source-atlas 模式 |
| `history:workflow:browser` | `workflow-controls-browser-smoke.mjs` | 第 6 行以目标 `source` 加载原 UV |
| `history:load-pipeline` | `load-pipeline-smoke.mjs` | 第 12 行期待完整输入 UV 选择 source-atlas |
| `history:load-pipeline:browser` | `load-pipeline-browser-smoke.mjs` | 第 10/21/24 行要求原 UV 检查/流程配置 |
| `history:load-pipeline:real` | `load-pipeline-real-smoke.mjs` | 第 8 行始终提交 source-atlas Worker 请求 |
| `history:paint-shape:browser` | `paint-workbench-smoke.mjs` | 混合套件：可选 `--corset` 分支（第 23 行）要求已移除的 `source` 检查 |
| `history:human-uv:browser` | `human-template-browser-smoke.mjs` | 第 11–12 行读取旧 source-atlas 快照并选择 source-atlas |
| `history:peel:real` | `peel-verified-real.mjs` | 第 5 行默认启用 `peelSourceHints`；`--geometry-only` 禁用提示，但不证明要求的六变体 |
| `history:peel:browser` | `peel-browser-smoke.mjs` | 第 5/13 行要求启用源提示和已移除的 `#peel-source` 控件 |
| `history:source-features` | `source-feature-smoke.mjs` | 第 30 行明确要求默认 source-atlas 路径 |
| `history:source-features:browser` | `source-feature-browser-smoke.mjs` | 第 17/22 行要求 source-atlas 特征修复与原 UV 检查 |

表中所有文件名都位于 `scripts/`；QA 表同理。没有 npm 入口的一次性 `scripts/capture-area-workbench.mjs` 也选择已移除的 `source` 目标，它仍是归档截图脚本，不是当前截图命令。

`test:flight-helmet` 与 `test:sample-asset` 原来执行完全相同的命令。两个旧 npm 名称均移除，`history:sample-asset` 是唯一明确的历史入口。脚本本身、旧发布命令、提交与 tag 不变。当前固定模型生成验收用 `test:geometry:real`，参考检查用 `qa:source-models`。其他更名按上表对应，不为这些归档套件保留含义模糊的旧 `test:*` 别名。

## 本次分类证据

2026-10-13 初始审计在 Node.js 25.8.2 执行三条原命令：load-pipeline 在第 12 行失败（实际 `generated`，期待 `source-atlas`），source-atlas 在第 16 行失败（`source` 请求被拒绝），UV-worker 在第 29 行失败（原 UV 请求被拒绝）。这些是过时断言，不是要求恢复源 UV 功能的证据。当前拒绝入口明确存在于 `apps/studio/src/workers/uv.worker.ts`，由 `test:geometry-policy` 覆盖。

本维护批次仅调整命令名和文档。原 smoke/helper 脚本与断言逐字节不变。本分类不能宣称浏览器套件、历史真实模型实验及全部可选 QA 都重新执行过。
