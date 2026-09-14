# Validation — v0.4.2

日期：2026-09-14。上一版记录保存在 `VALIDATION-0.4.1.md`。本轮只修改相机控制及对应 UI，不更换 UV 求解器或动画的顶点变换数学。

## 测试环境

Linux、Node.js 22.16.0、全局 TypeScript 5.8.3、Chromium 144.0.7559.96。浏览器使用 Xvfb 显示服务以及 ANGLE/SwiftShader 软件 WebGL，不是硬件 GPU 性能测试。最初默认 DISPLAY 无可用显示服务导致 WebGL 初始化失败；启动 Xvfb 后才执行下表真实渲染测试，没有用假渲染替代。

网络：`curl` 请求 registry.npmjs.org 失败，退出 6（Could not resolve host）。一次限制 25 秒的 npm install 未完成。依赖未安装；`npm run build` 实际失败于 `vite: not found`，退出 127。日志在 `validation/v0.4.2/npm-network-check.txt`、`full-build-attempt.txt`。没有声称安装、Vite 构建或完整 React 联调成功。

## 原版问题实测

使用 v0.4.1 随包的原始 HTML，真实滚轮将距离 5.3240036324 改为 3.8275525682。进度 0.42 -> 0.43 后，距离被自动适配改为 5.3203332708。`before-camera-repro.json` 保存完整相机快照。

## 本轮实际通过

| 测试 | 通过 | 范围 |
|---|---:|---|
| `test:camera` | 10 | 手动默认值、显式开启、手势中断、过期 props 防护、显式恢复。 |
| `test:camera:browser` | 39 | DPR 1/2；真实 RAF 播放与鼠标输入；旋转、平移、缩放后严格比较全部相机参数；反向、循环、seek、单次 fit、UV 重算、上下文恢复。 |
| `test:unfold:browser` | 24 | 真实 WebGL 像素、源/目标终点、拾取、90,112 面中间态、资源复用；另 2 项 module Worker 明确跳过。 |
| `test:lab` | 21 | 共用生产算法的离线 UI、真实 classic Worker、阶段、播放、选择、导出、错误与恢复。 |
| `test:layout` | 13 | CSS/canvas 尺寸与高 DPI 布局回归，不运行 React。 |
| `test:core` | 21 | 核心严格编译与运行；另检查 TS/TSX 语法，不等于全量 UI 类型检查。 |
| `test:complex` | 40 | 程序复杂网格、焊接、UV 与资产文件结构；不是真实 FBXLoader 解码。 |
| `test:unfold` | 33 | 对应关系、逐个/同时、选择、终点、导出。 |
| `test:hinge` | 17 | 三角形边长、共享边共点、阶段连续性、精确终点。 |
| `test:uv-worker` | 4 | 生产 UV handler 在 Node worker_threads 的数据传输和错误路径。 |
| `test:git` | 22 | Git 历史检查工具的正常与拒绝路径；正式发布审计在 tag 创建后另执行。 |

数据与日志保存在 `validation/v0.4.2/`。没有把各 suite 中含义不同的断言简单相加成“全部端到端用例”。

## 测试方式和未验证范围

浏览器通过 CDP `Page.setDocumentContent` 载入实际离线 HTML，运行相同的渲染器、计算模块和 classic Worker；相机交互使用 CDP 鼠标事件。取消指针场景另外发送真实 DOM PointerEvent；过期 props 场景故意延后 UI 的手动控制回调，检查渲染器锁存保护。

该测试覆盖默认 hinge + camera follow 的真实组合，补上之前 staged/direct 视图测试没有覆盖的默认行为。暂停或进度静止时开启跟随，也有单独检查。

受限宿主的两个原生 module Worker 检查沿用显式 `--skip-browser-worker`，未计为通过；离线 classic Worker 则确实运行并通过。未验证 Vite 模块加载、完整 React hook/DOM 端到端时序、主工程全量 UI 类型检查、FBXLoader、file:// 导航或 Safari/macOS/Windows 实机。本轮没有飞行头盔专项回归，不将程序网格视为该资产测试。

## 复跑

```bash
npm run test:camera
npm run lab:build
npm run test:camera:browser
npm run test:lab
npm run test:unfold:browser -- --skip-browser-worker
npm run test:git
npm run git:check -- --release v0.4.2
```

相机策略、核心等轻量测试需要 TypeScript（本地或全局）。浏览器测试需要 Chrome/Chromium/Edge；`CHROME_PATH` 可指定程序。无图形 Linux 的软件渲染复跑示例：

```bash
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/camera-browser-smoke.mjs
```

最终 ZIP 的独立解压、HEAD/tag、干净状态、旧 tag 身份、bundle 恢复及复跑结果另附交付验证文件，避免在被审计提交内写入自身提交哈希。
