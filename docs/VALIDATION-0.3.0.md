# Validation — v0.3.0

本记录区分数据层、原生渲染器、Node Worker、完整 React Studio 和未执行测试。旧记录保留在 `VALIDATION-0.2.0.md`、`VALIDATION-0.1.1.md`、`VALIDATION-0.1.0.md`。

## 环境和实际执行结果

制作环境：Node 22.16.0、全局 TypeScript 5.8.3、Chromium 144.0.7559.96，Linux。全局编译器用于离线测试，不表示 package.json 声明的 npm 依赖树已安装。原生 WebGL 测试使用 Xvfb 显示环境及 SwiftShader 软件渲染，并非硬件显卡性能测试。

| 命令 / 脚本 | 通过数 | 实际覆盖 |
|---|---:|---|
| `test:core` | 21 | 原有网格/接缝/遍历/UV/视口数学；严格非 React 编译 |
| `test:complex` | 40 | 复杂网格、焊接、资产结构、模拟下载；不执行 Three FBXLoader |
| `test:unfold` | 33 | 六岛示例；面角拆分；0/100% 精确端点；单/多/全部；同时/逐个；可逆进度；复杂网格；原 UV；导出一致性 |
| `test:uv-worker` | 4 | 真实生产 UV job 代码在 Node worker_threads 执行，传输 Map/TypedArray；源 UV 分支；缺 UV 报错；复杂模型 |
| 原生 `test:unfold:browser`，本次显式跳过浏览器 Worker | 24 | 实际 WebGL2 着色器、像素读取、DPR 1/2、不同进度图像、3D/UV 拾取、相机、90,112 面模型、上下文丢失/恢复、清理 |
| `test:layout` | 13 | 原生 Chromium canvas/CSS；包含展开控件与坐标检查器；不执行 React |
| `test:git` | 22 | Git 基线、脏工作区、tag/版本验证工具回归 |

`test:core` 还对 **63 个 TS/TSX 源文件**做了 syntax-only 转译，结果通过。严格编译覆盖纯核心和原生渲染/相机/UV 绘制等非 React 部分；语法转译不是 React 声明类型检查。

机器可读报告与 Git 工具日志在 `docs/validation/v0.3.0/`。截图 `unfold-3d.png`、`unfold-mid.png`、`unfold-uv.png` 来自实际生产原生渲染代码的测试宿主，展示同一份逐角数据的 0%、50%、100%。**截图不是 React Studio 页面，不是完整 UI 联调证据。**

## WebGL 与 Worker 验证细节

原生浏览器测试将实际编译后的本地模块加载到离线 DOM 宿主，只改 import 地址，不替换渲染实现。它实际创建 WebGL2、编译着色器、上传网格、绘图，并通过 readPixels 检查非背景像素。实际 CDP 鼠标事件验证变形后的面片拾取、拖动相机与进度独立性。90,112 三角形机械件使用真实生成几何及源 UV，不是替代小模型。

该容器的浏览器不允许正常导航到测试服务，离线宿主中的 module Worker 加载也失败。没有更改浏览器策略。原生渲染验证改为本地离线 DOM/模块，不访问网络；浏览器 Worker 两项检查通过 **`--skip-browser-worker` 显式跳过**，报告记录在 skipped 中，未计为通过。执行命令：

```bash
# 本次 Linux 容器已有 Xvfb 和 Chromium：先提供普通本地显示环境。
Xvfb :99 -screen 0 1600x1000x24 -nolisten tcp
# 另一个终端：
DISPLAY=:99 CHROME_SOFTWARE_WEBGL=1 node scripts/unfold-browser-smoke.mjs \
  --skip-browser-worker --report /tmp/unfold-webgl.json \
  --screenshots /tmp/unfold-previews
```

这是制作环境的测试命令，不是启动应用的要求。用户运行 Studio 仍使用 `npm run dev`。测试工具默认没有跳过浏览器 Worker；该参数只应在明确记录限制时使用。

Node Worker 测试执行的是生产 `uv.worker.ts` 编译后的 handler，适配器仅将 `self/postMessage` 映射到 `parentPort`。它验证真实工作线程、structured clone、Transferable 和生成结果；**不验证浏览器 module Worker 加载、Vite URL 构建、React hook 的挂载/取消时序**。

## 尚未完成验证

本轮实际尝试 `npm install --ignore-scripts --package-lock=false --fetch-retries=0 --fetch-timeout=8000`，仍返回 `EAI_AGAIN` / `getaddrinfo registry.npmjs.org`。因此以下不宣称已通过：

- 完整 React/Vite Studio 安装、运行和浏览器 Worker 集成；完整 UI 类型检查、Vitest、Vite 生产构建。
- 原有 FBXLoader、glTF 实际导入，以及远端 Corset/Flight Helmet 资产下载。
- macOS、Windows、Safari 和用户硬件显卡的兼容性、帧率。
- 高质量 UV 参数化、无重叠/无退化保证、物理可折叠或保长度量；本次未加入这些算法。

完整真实 Studio 测试脚本已经扩展到展开页签、六岛示例、范围切换、逐个进度、多选、播放、原 UV 目标。入口：

```bash
npm install
npm run check
npm run test:imports
npm run test:browser
npm run check:full
```

这些入口使用真实依赖，不以假的 React、Three.js、FBXLoader 或编造报告代替安装和执行。无伪造锁文件。

## 对应关系的判断标准

0% 的 source buffer 与遍历视图归一化后的每角位置一致；100% 的选中面角等于共享 UV target buffer。部分选择时其余面角仍等于 source。直接插值/三段插值、同时/逐个、任意反向 seek 都通过纯函数确定，不累积形变。

右侧 UV、目标 buffer 和 OBJ 导出从同一份 `PackedChart.faceUVs` 获取坐标。该一致性不意味着生成 UV 质量已经合格；原 planar debug projection 仍可能退化，源 UV 也可能重叠。几何对应和参数化质量是两项不同的验证。
