# Validation — v0.4.1

本记录仅列本轮实际执行的测试。前版记录保存在 `VALIDATION-0.4.0.md`，不会覆盖历史证据。日期：2026-09-14。

## 环境及限制

Linux、Node 22.16.0、全局 TypeScript 5.8.3、Chromium 144.0.7559.96，Xvfb + ANGLE/SwiftShader 软件渲染。不是 macOS / Windows 或硬件 GPU 的性能测试。

npm install 在 20 秒进程限制内未完成（退出 124）；没有安装成功或产生可信 lockfile。远端模型 raw 文件的独立下载遇到 DNS 解析失败。**本轮没有真实 Flight Helmet 几何资产**，不以程序网格代替该模型宣称通过。

## 实际结果

| 测试入口 | 通过 | 范围 |
|---|---:|---|
| `test:packing-large` | 5 | 2,000 岛、留白、有效三角形、不重叠、统一纹素密度、确定性、非法设置拒绝 |
| `test:uv-progress` | 5 | 真实阶段、截止时间跨数值回退传播、观测前后曲面求解结果一致 |
| `test:uv-client` | 11 | 可控模拟 transport：进度、完成、取消、超时、消息/启动/克隆失败与迟到结果；不是浏览器替代认证 |
| `test:uv-large` | 3 | 90,112 面生产 Node Worker generated / source 完整路径；真实预算失败 |
| `test:uv-lifecycle:browser` | 7 | 实际浏览器线程、页面响应、取消、重试、超时、同步死循环终止、原 UV 与生成恢复 |
| `test:lab` | 21 | 实际离线 UI/WebGL/Worker、拾取/动画/导出等原有行为 |
| `test:layout` | 13 | 原生 CSS/canvas 布局，不运行 React |
| `test:unfold:browser` | 24 | 原生 WebGL 回归；另 2 项 module Worker 检查显式跳过 |
| `test:core` | 21 | 核心严格编译；73 个 TS/TSX 文件语法转译，**不是完整 UI 类型检查** |
| `test:complex` | 40 | 复杂输入 / 焊接 / 格式结构；不是真实 FBXLoader 解码 |
| `test:unfold` | 33 | 对应关系、原有模式端点、选择和导出 |
| `test:uv-worker` | 4 | Node worker_threads 的生产 handler、缓冲区与错误路径 |
| `test:parameterization` | 10 断言 | LSCM/Tutte、折角与圆筒、翻面退化和重叠 |
| `test:atlas` | 6 模型与附加断言 | 全面覆盖、有效 UV、单位域、密度、显式补切策略 |
| `test:hinge` | 17 | 面边长度、铰链共点、精确终点和连续性 |
| `test:uv-guards` | 11 | 无效配置、零面积、源网格不变、曲面临时断边等 |
| `test:git` | 22 | Git 审计工具测试；最终发布审计另在 tag 建立后执行 |

JSON、日志与实际数值在 `validation/v0.4.1/`。部分测试以命名断言而不是独立测试用例计数，未将所有数值简单相加成夸大的总数。

## 大网格实测，不是飞行头盔实测

`large-worker.json`：确定性 `makeComplexExample('assembly','high')`，90,112 三角形。generated 总墙钟约 9,702.6 ms，Worker 内约 9,069.9 ms，462 岛，71 次进度。排布约 53.2 ms，采用 Shelf，有效占用约 45.85%。source 墙钟约 2,730.5 ms，保持逐角原 UV，不重新求解。

`packing.json`：2,000 个确定性矩形岛，新版排布约 90.6 ms，有效占用约 52.05%。旧版同样输入在 35 秒上限结束（退出 124）；不能将 35 秒当成其完成耗时。性能数字包括具体测试环境影响，不能承诺用户机器时长。

## 浏览器测试的边界和一次测试修正

离线实验页通过 CDP `Page.setDocumentContent` 加载实际 DOM/代码，运行共用计算、classic Worker、实际 WebGL 渲染和导出。没有替换成假的数学或渲染逻辑。没有验证 file:// 导航、Vite module Worker 加载或 React hook 的端到端时序。

原生模块 Worker 在受限 about:blank 宿主中不能正常完成，因此旧原生 suite 的 2 项检查依旧明确跳过；这不同于离线 classic Worker 已通过。没有绕过宿主策略，也没有将跳过列为通过。

原布局 suite 首次固定等待 300 ms 后负面对照未收集到足够 ResizeObserver 帧。已按逻辑独立提交改为等待实际样本条件并断开旧 observer；保持原有五次增长及至少十六倍增大断言，没有降低标准。修正后 13 项通过。初次失败和成功日志均保留。

## 复跑

先安装真实依赖（依赖轻量的测试也可使用本机已有 TypeScript）：

```bash
npm run test:uv-client
npm run test:uv-progress
npm run test:packing-large
npm run test:uv-large
npm run lab:build
npm run test:lab
npm run test:uv-lifecycle:browser
npm run git:check -- --release v0.4.1
```

本 Linux 容器测试浏览器时使用：

```bash
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/lab-browser-smoke.mjs
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/uv-lifecycle-browser-smoke.mjs
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/unfold-browser-smoke.mjs --skip-browser-worker
```

Xvfb 仅是制作环境的测试需求，不是 macOS/Windows Studio 的运行依赖。

## 尚未验证

完整 npm 安装、全量 UI 类型检查、Vitest、Vite 构建、React/Vite 主界面、主界面 module Worker 的加载、真实 FBX/glTF 导入与真实 Flight Helmet。专项 `test:flight-helmet` 必须安装依赖并提供真实 GLB 才可运行，本轮未执行。不要把语法转译、生成几何格式测试、离线实验页或 Node Worker 的成功称为这些未完成项的成功。

排布仍为启发式，可能改变布局与利用率；不做凹多边形嵌套。源 UV 不修复。计算预算明确终止昂贵任务，而不是保证任意输入都能在预算内求解。原有有限精度、材料变形、过程碰撞及未提供训练权重的限制不变。
