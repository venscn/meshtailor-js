# Validation — v0.4.3

日期：2026-09-14。旧记录保存为 `VALIDATION-0.4.2.md`。本版修改每岛播放调度、停留映射、UI / 时钟 / 阶段控制，不更换 UV 求解、UV 装箱或相机控制策略。

## 环境和限制

Linux、Node.js 22.16.0、全局 TypeScript 5.8.3、Chromium 144.0.7559.96。浏览器使用 Xvfb + ANGLE/SwiftShader 软件 WebGL。环境的初始 DISPLAY 不可用，直接启动曾返回 WebGL2 unavailable；以下渲染回归在启动 Xvfb 后真实执行，没有伪造 WebGL。

一次 npm install 被 25 秒限时中止（退出 124）。单独 `npm view react version` 返回 `EAI_AGAIN registry.npmjs.org`。`npm run build` 实际退出 127，报 `vite: not found`。未伪造安装成功、锁文件或全量 React/Vite 类型检查结果。相关日志在 `validation/v0.4.3/`。

## 已执行结果

| 测试 | 通过数 | 实际范围 |
|---|---:|---|
| `test:relay` | 22 | 共享时钟、85% 交接、严格串行、0/1/3/97/2000 岛、最多两岛、逆映射、反向、无空尾、hold、慢帧累计、循环和输入校验。 |
| `test:relay:browser` | 28 | DPR 1/2；真实 Worker、WebGL 位置缓冲、实际 RAF 完整正反播放、真实鼠标相机操作、滑杆、队列 / 阶段检查、全部 / 多选 / 空选择。 |
| `test:hinge` | 17 | 改用每岛局部时刻；边长、父子共享端点、刚性平面、连续性、反向、终点与选择。 |
| `test:camera:browser` | 39 | 真实相机旋转 / 平移 / 缩放、播放、反向循环、跟随中断、旧 props 防护、重算与上下文恢复。 |
| `test:camera` | 10 | 相机所有权策略。 |
| `test:unfold:browser` | 24 | 原生 WebGL、拾取、对应终点、资源和大网格中间态；另 2 项 module Worker 显式跳过。 |
| `test:lab` | 21 | 实际离线 UI + 共用渲染器 + classic Worker，阶段、导出、求解选项和失败恢复。 |
| `test:layout` | 13 | 原生 CSS / canvas 布局；不是 React 端到端布局测试。 |
| `test:core` | 21 | 核心严格编译和运行、TS/TSX 语法；不是全量 UI 类型检查。 |
| `test:complex` | 40 | 程序复杂网格、焊接、UV、资产文件结构；不是真实 FBXLoader。 |
| `test:unfold` | 33 | 对应、精确源 / UV 终点、选择、导出和复杂网格。 |
| `test:uv-worker` | 4 | 生产 UV handler 的 Node worker_threads 路径。 |
| `test:git` | 22 | Git 工具拒绝 / 接受路径；正式发布审计在新 tag 创建后另执行。 |

JSON / 日志位于 `validation/v0.4.3/`。不同 suite 的计数不合并宣称为全量端到端测试。

## 对新的行为做了什么检查

真实浏览器测试按 81 个全局进度采样检查真实位置缓冲：未开始岛必须精确等于源坐标，完成岛必须精确等于 UV 目标；前岛未到交接点不能启动后岛，最多两岛活动。对三岛的实际 forward / reverse RAF 播放设置每岛 1 秒，期望队列 2.7 秒；记录真实耗时和重叠帧数，且三岛必须各自进入活动状态。最终位置再与 immutable endpoint 缓冲比较。

额外测试了交接滑杆、严格串行、多选 [2,0] 顺序、队列导航后阶段按钮不误跟前岛、静止 hold 显式开关、真实相机鼠标拖动和空队列不可播放。数学铰链测试保留原边长 / 共点断言，但改成逐岛定位局部阶段；旧「所有岛在 global .75 都已经平面」断言不符合新需求，不能继续使用。

没有重跑真实 Flight Helmet 资产。未验证完整 React hook / DOM 时序、Vite module Worker 加载、真实 FBXLoader、file:// 导航、Safari/macOS/Windows 或硬件 GPU。离线页通过 CDP Page.setDocumentContent 加载实际构建 HTML，不替换生产渲染与求解模块。

## 复跑

```bash
npm run test:relay
npm run lab:build
npm run test:relay:browser
npm run test:hinge
npm run test:camera:browser
npm run test:lab
npm run test:unfold:browser -- --skip-browser-worker
npm run git:check -- --release v0.4.3
```

轻量测试需要本地或全局 TypeScript。完整主界面测试另外需要真正安装项目依赖。无图形 Linux 的真实软件 WebGL 示例：

```bash
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/relay-browser-smoke.mjs
```

最终 ZIP 解压复验、完整 HEAD/tag、旧 tag 指向、工作区及 bundle 恢复记录另附交付验证文件。
