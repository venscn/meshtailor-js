# v0.4.2 — 播放动画不再覆盖用户相机

本版基于 v0.4.1 连续开发。修复的是相机控制权，不改变 UV 参数化、排布、接缝或铰链变换数学。

## 问题与复现

旧版主 Studio 的 `useUnfoldPlayer` 和离线实验页都默认 `autoFrame=true`。`UnfoldWebGLView.setOptions()` 在进度改变时调用 `frameCurrent()`，重写 camera.target 和 camera.distance。用户右键平移或滚轮缩放虽然当下生效，下一帧又被自动适配覆盖。原有 staged/direct 测试没有覆盖默认 hinge + autoFrame 的组合，所以未发现这个交互问题。

这次使用原封不动的 v0.4.1 离线页面、真实 Chromium WebGL 和真实滚轮事件复现：相机距离原为 5.3240，用户缩放到 3.8276，进度从 42% 变为 43% 后被改回 5.3203。原始记录在 `validation/v0.4.2/before-camera-repro.json`。不是仅根据界面描述猜测原因。

## 新行为

| 操作 | v0.4.2 行为 |
|---|---|
| 默认播放、暂停/继续、反向、循环、拖动进度 | 只改变网格姿态，不改变相机方向、观察中心或距离。 |
| 播放中左键拖动 / 右键拖动 / 滚轮 | 自由旋转 / 平移 / 缩放；动画继续，松手后不会回弹。 |
| 手动勾选“自动跟随面片” | 显式启用自动适配；暂停状态下勾选也立即生效。 |
| 自动跟随中操作相机 | 在修改相机之前立即停用跟随，同时取消 UI 勾选；不暂停动画。 |
| 松手、取消指针、进度到头或循环重播 | 不会重新启用跟随；只有再次主动勾选才恢复。 |
| “适配当前面片（保留观察方向）” | 只执行一次范围适配，保留当前 yaw/pitch，之后仍可自由操作。 |
| “适配 3D 视角” / “UV 正视” | 只执行一次指定视角适配，不把之后的动画帧绑定到相机。 |
| 在同一视图内重新求解同一源网格的 UV | 保留当前相机，不因更换对应数据而复位。 |
| WebGL 自动上下文恢复 | 重新上传几何缓冲区，但保留相机。 |
| 载入不同源网格、首次创建视图 | 允许一次初始适配，避免新网格不可见；不隐式打开持续跟随。 |

不承诺跨页面刷新、关闭视图、显式 Retry 重建或不同模型之间持久化相机。单击选岛仍保留原先选岛/暂停行为；拖动相机不是选岛操作，不暂停动画。关闭跟随后，面片可能移动到视野外，这时使用一次性适配按钮，而不是自动抢回控制权。

## 实现

`camera-policy.ts` 是独立的相机控制策略：默认手动，手势立即中断持续跟随，并锁存该中断。即使 React 下一次 effect 暂时还带着旧的 `autoFrame=true`，也不能覆盖刚刚调整的相机；UI 确认关闭后，下一次主动开启才可恢复。

渲染器在按住指针期间暂停自动适配，超过拖动阈值或滚轮输入时中断跟随。指针释放、取消和丢失捕获只清理输入状态，不恢复跟随。相机手动回调通过 ref 与 React 最新状态连接，不依赖动画帧重建 renderer。

主 Studio 和离线页使用同一套策略与渲染器；离线生成页已重新构建。新增 `sceneKey` 将源网格身份与 UV 计算结果区分开，避免每次对应数据返回都重新适配。

主要文件：`apps/studio/src/unfold/camera-policy.ts`、`webgl-view.ts`、`useUnfoldPlayer.tsx`、`UnfoldViewport.tsx`、`UnfoldControls.tsx`、`App.tsx`，以及 `apps/unfold-lab/`。

## 使用

主工程运行 `npm install`、`npm run dev`，确认顶栏为 `Studio · 0.4.2`。也可以打开包内已生成的 `unfold-lab.html`；若浏览器限制本地文件执行，运行 `node scripts/serve-unfold-lab.mjs`。

播放三块折角带或自己的网格，直接旋转、平移、缩放；默认不需要额外关掉任何选项。需要看全部面片时点一次“适配当前面片”。

专项测试：

```bash
npm run test:camera
npm run lab:build
npm run test:camera:browser
```

浏览器脚本需要 Chrome/Chromium/Edge。可通过 `CHROME_PATH` 指定程序路径。Linux 无图形会话时测试可使用 Xvfb；这是制作环境的测试配置，不是 macOS/Windows 的应用运行依赖。

## 已验证与边界

10 项控制策略测试、39 项实际浏览器相机测试通过；浏览器使用 DPR 1/2 的真实 RAF 播放、真实鼠标事件、生产 WebGL 渲染器和离线 UI/Worker。包含过期 UI 状态、单次 fit、UV 重算及 WebGL 恢复检查。原有核心、复杂输入、展开端点、铰链、布局、拾取及离线页面回归也已复跑。完整记录见 `VALIDATION.md` 和 `validation/v0.4.2/`。

制作环境 registry.npmjs.org DNS 解析失败，依赖未安装成功；`npm run build` 失败于 `vite: not found`。没有完成完整 React/Vite 主界面端到端联调、全量 UI 类型检查或真实 FBXLoader 回归。核心严格编译和 TS/TSX 语法检查不是这些检查的替代品。相机相关共用模块已真实运行测试，但没有将离线页称为完整主 Studio 联调通过。

本轮没有重新获取 Flight Helmet，也没有重做其专项诊断；这不是该资产的 UV 性能更新。测试主机为 Linux/Chromium 软件渲染，未在 macOS、Windows 或 Safari 上实测。

## Git

保留既有历史及所有旧 tag，新增独立附注 tag `v0.4.2`；在干净、已提交且 tag 指向 HEAD 的状态构建交付包。实现、集成、测试、版本及文档分步提交。ZIP 直接附 `.git/`，并附 `.history/repository.bundle` 作为完整历史备份，不需要重新初始化仓库。
