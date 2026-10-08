# GitHub 开源整理记录

整理日期：2026-10-08。基于 `v0.4.30` 继续维护，不创建新发布、不移动已有 tag。

## 清理范围

- 删除 `examples/generated-0.4.22/FlightHelmet-geometry-only.obj.gz` 的重复副本（2,832,832 字节）。它与 `examples/generated-0.4.23/FlightHelmet-before-fill.obj.gz` 逐字节相同；0.4.22 manifest 改为引用后者，输出文件名和校验值不变。
- 删除四份零字节、无引用报告：`validation/v0.4.22/install-output.txt`、`validation/v0.4.23/dependency-install.log`、`validation/v0.4.28/regressions/launch.txt`、`validation/v0.4.30/npm-install.txt`。这些文件没有执行输出，原有失败与环境限制仍保留在各版说明中。
- 删除两份无引用的同字节报告：`validation/v0.4.9/overlap-workbench-final-label.json`（保留 `overlap-workbench.json`）、`validation/v0.4.29/browser-pre-release.json`（保留 `browser-release.json`）。
- 合并逐版本的结果目录忽略规则。保留发布历史、原始夹具、历史实验脚本、失败记录和恢复证据。

去重后的恢复已执行 `node scripts/restore-structure-results.mjs` 和 `node scripts/restore-cavity-results.mjs`，全部输出通过 SHA256 校验。旧文件仍可从原提交/tag 取回。

## 文档与开发入口

README 按 [beautify-github-readme](https://github.com/oil-oil/beautify-github-readme) 的 README 模式整理，使用静态 SVG 和既有真实工作台截图；启动命令、功能与限制保持为可搜索的 Markdown。已检查 900px 浅色、360px 深色预览和本地链接，未加入依赖外部服务的徽章或图片。

新增贡献指南与文档索引，修正旧版本提示、过时导入说明和“没有包含第三方模型”的错误陈述。恢复包说明保留为历史记录。代码为 MIT，固定第三方模型与几何衍生文件保留上游许可，详见 `THIRD_PARTY_ASSETS.md`。

现有未跟踪锁文件的原始字节先备份再更新；只升级测试依赖至 Vitest 4.1.11，不改变运行时依赖范围。该版本修复 [Vitest 文件读取漏洞](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9)，同时使用已修复的 Tinypool。CI 改为锁定安装，并检查几何、单元测试、构建、类型与 Git 规则。

## 本次实际验证

环境：macOS，Node.js 25.8.2 / npm 11.11.1。CI 配置使用 Node.js 22；本机没有执行该版本的独立矩阵。

| 验证 | 结果 |
| --- | --- |
| 独立目录 `npm ci` | 通过，验证锁文件可以从干净目录安装 |
| `npm run check:geometry` | 通过，含严格核心编译、输入隔离、边界、候选、拓扑、策略与核心回归 |
| `npm run check`（Vitest 4.1.11） | 34 项通过，Studio 生产构建和完整类型检查通过 |
| `npm run test:hinge` / `npm run test:selection` | 17 项铰链与 20 项选择策略回归通过 |
| 真实 React StrictMode 选择页面 | 内置浏览器通过 CDP 执行 11 项选择/播放/重载回归；几何生成得到六个岛 |
| `npm run test:complex` | 40 项通过 |
| `npm run test:git` | 22 项通过 |
| 离线工作台重建至临时文件 | 与已跟踪 `unfold-lab.html` 逐字节相同 |
| README 的 CLI inspect / unwrap 命令 | 通过，从仓库根目录读取示例并导出新 UV |
| `npm audit` | 当前锁定依赖报告 0 项漏洞 |
| README 图片/SVG 审查 | 指定技能的 `audit_readme.py` 通过；当前入口文档本地链接均存在 |
| 可达 Git 历史常见密钥模式扫描 | 2,320 个文本 blob 未命中私钥/GitHub/AWS/OpenAI 密钥模式；不保证覆盖所有敏感数据格式 |

## 修复与验证边界

安装真实依赖后先发现 typed-array 推断错误，使用局部显式类型修正；然后修正 ASCII FBX 夹具的数字元组空格问题、原 UV 过时导入提示，以及仍构造源 UV 的旧 React 测试页面。生成策略和固定第三方几何没有改变，因此本次未重跑两份真实模型的六条全量 UV 变体；原验证仍见 `validation/v0.4.30/`。

文档命令验收还发现 npm workspace 会改变 CLI 的工作目录，使仓库根目录相对路径失效；根 `cli` 脚本改为直接启动相同 CLI 入口，未修改生成代码。

标准 `test:selection:react` 启动本机 headless Chrome 超时，改用内置浏览器验证同一真实页面。验证中还发现测试将 Escape 派发到 window，造成非 DOM 目标；已改为从 body 派发可冒泡/取消事件，两级清除与重载检查通过。没有将该页面的通过宣称为完整 Studio 浏览器套件通过。

Vite 保留大于 500 kB 的分包提示，未为消除提示改变应用架构。GitHub Actions 尚未在远端执行；本次没有创建 GitHub 仓库、修改远端配置或发布版本。
