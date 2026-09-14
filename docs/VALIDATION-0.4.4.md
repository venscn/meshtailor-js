# Validation — v0.4.4

日期：2026-09-14。上一版记录归档至 `VALIDATION-0.4.3.md`。本版改变动作区间分析、可变时长接力与两套播放器的共用映射，不改 UV 求解/装箱或相机策略。

## 已实际执行

| 测试 | 通过 | 范围 |
|---|---:|---|
| `test:motion-time` | 9 | 静止段不占时间、零时长、短/长岛混合、最多两岛、没有空尾、正反映射和输入校验。 |
| `test:motion` | 13 | 六岛立方体、折角带、跳过区间内 13 个采样点实际不动、边界连续、完整端点、源数据不变、起终点相同但中间有动作、容差和选择。 |
| `test:motion:browser` | 28 | DPR 1/2 的真实离线页、生产 WebGL/Worker/RAF；跳过开关、缓存身份、阶段跳转、全局密集采样、真实正反播放、状态和位置一致。 |
| `test:relay:browser` | 28 | 显式关闭新自动跳过开关，验证原固定时长的对照模式，保留原数字断言，不把它当成自动时间线验证。 |
| `test:camera:browser` | 39 | 自动跳过开启；真实旋转/平移/缩放、跟随中断、循环、UV 重算和 WebGL 恢复。 |
| `test:camera` | 10 | 相机控制策略。 |
| `test:relay` | 22 | 原固定时长调度函数的兼容回归。 |
| `test:hinge` | 17 | 边长、父子铰链共点、连续性、刚性平面、精确端点与反向。 |
| `test:unfold` | 33 | 对应、选择、导出与大网格。 |
| `test:unfold:browser -- --skip-browser-worker` | 24 | 真实 WebGL、拾取、相机、90,112 面中间态；两项 module Worker 显式跳过，不计为通过。 |
| `test:layout` | 13 | 原生 CSS/canvas 布局；不是 React DOM 联调。 |
| `test:core` | 21 | 核心严格编译/运行及 TS/TSX 语法，不是完整 UI 类型检查。 |
| `test:complex` | 40 | 程序网格、焊接、UV、资产文件结构；不等于真实 FBXLoader 验证。 |
| `test:uv-worker` | 4 | 生产 handler 的 Node worker_threads 路径。 |
| `test:git` | 22 | Git 发布校验工具的正反用例；release check 在创建新 tag 后另执行。 |

结果位于 `docs/validation/v0.4.4/`；不得将不同测试计数混成一个“全量端到端”结果。最终 ZIP 解压复验和 Git/tag/bundle 核对另见交付验证文件。

## 测量与判断

六岛立方体在 12 秒基准下每岛 4.8 秒，85% 接力共 25.2 秒，而固定时间线共 63.0 秒。折角带保留铰链运动并省掉无效 UV 形变。新浏览器测试对整个队列做 401 个几何采样检查，不允许长段位置不变；实际 RAF 正反播放另记录 elapsed/expected 时间、活动岛和重叠数量。

90,112 三角形的程序机械件保留原 UV；仅新动作分析约 295 ms，结果缓存。该网格四个岛各阶段确实有动作，时间线没有被强行缩短。不把该结果称为真实 Flight Helmet 实测。

## 环境与实际失败/未验证项目

Linux、Node.js 22.16.0、全局 TypeScript、Chromium 144.0.7559.96，Xvfb + ANGLE/SwiftShader 软件 WebGL。首次直接启动 Chromium 时 DISPLAY 没有活动 X server，WebGL2 unavailable；改用 `xvfb-run` 后完成真实渲染测试。

相机测试最初使用固定 180 ms 睡眠等待下一帧，在高 DPI 软件渲染下有一次尚未等到帧。测试现在保留相机与继续播放断言，但等待真实进度变化（上限 3 秒），之后完整 39 项通过。未修改生产相机逻辑。

原生 WebGL 测试的 module/blob Worker 入口实际报错，随后用已有的 `--skip-browser-worker` 明确跳过该两项。新自动时间线浏览器测试使用真正运行的 classic Worker，不将 module Worker 标为通过。

`npm install --ignore-scripts` 在 25 秒上限内未完成；单独 `npm ping --fetch-timeout=5000 --fetch-retries=0` 实际报 `EAI_AGAIN registry.npmjs.org`。`npm run build` 实际退出 127：`vite: not found`。日志保存在本版 validation 目录。没有生成伪造锁文件，也没有声称完整 React/Vite 主界面、全量 UI 类型检查或 Vite module Worker 联调通过。

本轮未运行真实 Flight Helmet 资产、真实 FBXLoader、macOS/Windows/Safari、硬件 GPU 或 file:// 导航。离线页测试由 CDP Page.setDocumentContent 载入实际构建 HTML。

## 复跑

```bash
npm run test:motion-time
npm run test:motion
npm run lab:build
npm run test:motion:browser
npm run test:camera:browser
npm run test:relay:browser
npm run test:unfold:browser -- --skip-browser-worker
npm run git:check -- --release v0.4.4
```

无图形 Linux 可使用：

```bash
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/motion-browser-smoke.mjs
```

完整主界面测试另外需要成功安装项目依赖。
