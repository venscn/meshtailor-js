# MeshTailor-JS 0.1.1：3D traversal 显示修复

## 问题与已确认的根因

本次基于上一轮交付的 `meshtailor-js-0.1.0.zip` 修改，不替换为另一套演示工程。

在 Chromium 中可以复现：原版 `WebGLRenderer.setPixelRatio()` 与 `setSize(w,h,false)` 配合使用，但没有约束 3D canvas 的 CSS 显示尺寸。`canvas.width/height` 是绘图缓冲区的尺寸，却同时参与了浏览器的固有尺寸布局；CSS Grid 子项又没有完整的 `min-width:0` 约束。

DPR=2 时出现如下反馈：

```text
容器宽度 828 → canvas 显示宽度 1656
容器宽度 1656 → canvas 显示宽度 3312
容器宽度 3312 → canvas 显示宽度 6624
……
```

`ResizeObserver` 会继续处理这个尺寸变化。它可以造成画面被裁切、布局失常，或最终无法正常显示。这是实际可复现的源码缺陷，但没有用户电脑的截图和控制台信息，不能断言所有显示异常都只有这一个原因。

这里的数字来自**真实 Chromium 中的原生 canvas / CSS 布局回归**；用例模拟 `setSize(...,false)` 的绘图缓冲区赋值，并未加载 React 或 Three.js，因此不能将该结果写成完整 Studio WebGL 渲染测试通过。

## 修复内容

### 1. 固定 canvas 的 CSS 尺寸，隔离绘图缓冲区

- `.viewport` 设置为定位容器，限制溢出，允许 Grid 子项收缩。
- `.viewport > canvas` 使用绝对定位与 `width:100%;height:100%;display:block`。
- 控制器也设置同样的内联尺寸，避免样式加载问题重新触发反馈。
- 修正主视口与 UV 面板的 `minmax(0,1fr)`、`min-width:0` 和 `min-height:0`。
- UV canvas 改为独立容器，并在面板大小变化时重绘。
- DPR 只影响缓冲区分辨率，仍上限为 2；没有通过禁用高 DPI 来掩盖问题。

修复后的布局用例中，容器与 canvas 的 CSS 尺寸稳定为 `828×652`，DPR=2 的绘图缓冲区为 `1656×1304`。

### 2. 不再每一步重建 WebGLRenderer

原版 `MeshViewport` 的单个 effect 依赖 `mesh / seamEdges / frame / wireframe`，任何一步变化都会销毁场景并重新创建 renderer、相机、OrbitControls。

现在拆成：

```text
组件挂载 / Retry 3D → 创建 ViewportScene
mesh 改变           → 替换模型几何并重新适配相机
frame / seams 改变  → 只更新遍历覆盖层
wireframe 改变      → 更新材质
Reset camera        → 显式复位相机
组件卸载             → 释放资源与 WebGL context
```

新增控制器文件：`apps/studio/src/viewport-scene.ts`。逐帧更新不再重建 renderer。覆盖层几何和材质在替换时单独释放，包括候选点、marker 和方向箭头。React StrictMode 的挂载清理流程保留，不以关闭 StrictMode 掩盖问题。

### 3. 遍历显示与操作

- **X-ray traversal**：默认开启，接缝与候选点不会被模型背面挡住。关闭后使用正常表面遮挡。开启状态下看见背面的线是预期行为，不代表接缝脱离网格。
- **Show all seams**：立即显示全部接缝；关闭时只显示当前步骤已经揭示的边。
- **Reset camera**：重新适配当前模型。
- 当前遍历边增加方向箭头；当前/上一顶点保留不同颜色。
- 首个 token 只是选择起点，还没有形成边，视口会提示使用 Next / Play。不要把起点没有接缝线误判为生成失败。
- `frame.mask` 保留原来的含义：**选择当前 token 前的候选集合**。UI 改称 `decision candidates`，没有偷偷将它替换为抵达当前顶点后的下一步候选集合。
- 手动拖动时间线会暂停播放；播放结束后再次 Play 会从头开始。

### 4. 视口与错误处理

仅对显示副本居中、缩放，并在转换成 Float32Array 前减去大坐标偏移；原始 mesh 坐标、顶点编号和 seam 数据不变。相机适配同时考虑水平与垂直视场。

WebGL 初始化失败、context 丢失、无效模型坐标等不再只显示空白。新增错误面板与 Retry 3D。导入文件在进入拓扑统计前验证，异常文件保留原有模型，并显示导入错误。

## 本次实际验证

| 验证层次 | 结果 | 范围 |
|---|---|---|
| 严格 TypeScript 编译 | 通过 | 五个 core packages 和新的 viewport-math，不包含外部 UI 类型检查 |
| 可执行核心/视口数学回归 | 21 个用例通过 | Cube/Cylinder/Torso、真实邻接遍历、UV 覆盖、训练样本、尺寸与相机数学、无效输入 |
| 原生 Chromium 布局回归 | 9 个用例通过 | 原版负对照、DPR 1/1.25/2/3、三个窗口尺寸、隐藏后重新显示 |
| TypeScript / TSX 语法转译检查 | 41 个源码文件通过 | 包括 UI 源码；不等同于完整 UI 类型检查 |
| 完整 Vite 构建 / Vitest | 未执行 | 制作环境无法解析 npm registry，依赖树不可用 |
| 完整 React + Three.js 浏览器联调 | 未执行 | 已提供真实 Studio 回归入口，实际尝试在依赖检查处停止 |

原始机器可读报告见 `docs/validation/core-smoke.json` 与 `docs/validation/layout-smoke.json`。

本次没有在真实 macOS、Windows 或 Safari 上运行完整 Studio；浏览器布局用例是在 Linux Chromium 中模拟不同 DPR。测试范围不能扩写为“所有浏览器已验证”。

## 使用

建议解压到新目录，避免与上一版源码混放。推荐 Node.js 22.x；本次核心测试使用 22.16.0。

```bash
cd meshtailor-js
npm install
npm run dev
```

界面左上角应显示 `Studio · 0.1.1`。先检查默认模型是否可见，再点击 Generate baseline，使用 Next / Play；需要立即查看完整接缝时开启 Show all seams。

没有新增第三方依赖。已有环境可以沿用依赖版本，更新源码后重新启动 Vite。不要直接以 `file://` 打开源码 HTML。

## 回归入口

```bash
# 只需 TypeScript（本地依赖或全局安装）
npm run test:core

# 只需 Node.js 22 与已安装的 Chrome/Chromium/Edge；不依赖 npm UI 包
npm run test:layout

# 需要 npm install 成功，启动真实 Vite Studio 并执行浏览器测试
npm run test:browser

# 完整检查：Vitest、生产构建、类型检查、核心与浏览器测试
npm run check:full
```

浏览器脚本会查找 macOS、Windows、Linux 的常见 Chrome/Chromium/Edge 路径。非标准安装可以指定 `CHROME_PATH`：

```bash
# macOS / Linux
CHROME_PATH="/path/to/chrome" npm run test:layout
```

```powershell
# Windows PowerShell
$env:CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:layout
```

`test:browser` 需要浏览器实际提供 WebGL 2，不能用原生布局测试替代。

## Git 与范围

修改按尺寸修复、场景生命周期、操作控制、测试、导入防护和文档分开提交。ZIP 从干净、带 `v0.1.1` 标签的 HEAD 生成，并附 `.history/repository.bundle`，可恢复 Git 历史。

本次仅修复 Studio 显示与调试相关问题，不新增神经网络训练、官方权重、ABF++ 等功能。上游代码/权重发布状态没有在这次显示热修中重新核实。

## 实现依据

- Three.js WebGLRenderer：`setSize`、`setPixelRatio`、资源释放与 context 生命周期。
- Three.js Material：`depthTest`、`depthWrite`、`polygonOffset`。
- React useEffect：依赖变化时先清理旧 effect，再运行新的 setup。

官方资料：
https://threejs.org/docs/pages/WebGLRenderer.html
https://threejs.org/docs/pages/Material.html
https://react.dev/reference/react/useEffect
