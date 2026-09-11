# MeshTailor-JS 0.3.0

新增 **3D ↔ UV 岛展开对应动画**：可拖动进度，单个 / 多选 / 全部岛，逐个 / 同时展开，3D 与 UV 联动拾取，原始或生成 UV 目标，以及对应 UV 导出。原有遍历、复杂网格和 FBX 导入入口保留。这是独立的 TypeScript / JavaScript 研究工程，不是官方 MeshTailor 软件。

ZIP 直接包含完整 `.git/` 和 `.history/repository.bundle`。新版本为独立附注 tag **v0.3.0**；原 `v0.1.0`、`v0.1.1`、`v0.2.0` 指向不变。本版继续采用小步提交，约束见 `AGENTS.md`。上一次维护交接的历史情况仍保留在 `docs/GIT_HANDOFF.md`。

**验证边界：** 已执行严格非 React 数据/渲染层编译、真实原生 WebGL2 渲染与拾取、核心/复杂网格/对应关系/Node Worker/布局/Git 回归。npm 安装因 DNS 失败，因此完整 React/Vite 页面和浏览器 Worker 加载、全量 UI 类型检查、真实 FBXLoader 仍未认证。生成 UV 依旧是平面投影调试预览，动画不是求解器或物理展开。详见 [验证记录](docs/VALIDATION.md)。

## 启动

使用 Node.js **22.16.0 或更新版本**，在解压出的项目根目录运行：

```bash
npm install
npm run dev
```

打开 Vite 输出的地址。顶栏应显示 `Studio · 0.3.0`。启动脚本不依赖 Python；同一 npm 入口用于 macOS、Windows、Linux，但本次没有跨平台实机验证。

## 3D ↔ UV 展开预览

在主视口上方选择 **3D ↔ UV 展开动画**，点击左侧 **加载六岛立方体示例**，拖动下方 0–100% 进度或点击 **播放展开**。同色同编号的岛从网格移向右侧相同位置；选择 **UV 正视** 可直接比较最终布局。

“预览范围”提供单个、多选、全部岛；“播放方式”独立提供同时、逐个。可倒放、循环、调节时长和分离距离，或隐藏未选岛。点击两侧面片会联动选择，并显示逐角 3D / UV 坐标。

目标可选网格原始 UV，或完整接缝的生成预览 UV。两侧视图和 **导出对应 OBJ + 目标 UV** 共用同一份面角数据，100% 不会另算一套布局。原 UV 缺失会明确报错。使用自己的网格可以先生成接缝，也可直接选原 UV。详细操作、语义和限制见 [展开预览文档](docs/UNFOLD_PREVIEW.md)。

## 复杂网格

左侧 **复杂样例 · Offline** 选择模型和 Low / Medium / High，然后点击 **Load complex mesh**。这些网格由本工程确定性生成，不需要联网获取资产；首次安装 npm 依赖仍需要网络。

| 样例 | 用于观察的结构 | Medium 顶点 | Medium 三角形 | High 三角形 |
|---|---|---:|---:|---:|
| Pleated garment · 褶皱服装 | 开口、褶皱、UV 断裂 | 6,240 | 12,288 | 49,152 |
| Trefoil knot · 三叶结 | 封闭曲面、孔洞、周期 UV | 4,608 | 9,216 | 36,864 |
| Bevelled gear · 倒角齿轮 | 齿面、通孔、尖锐转折 | 3,072 | 6,144 | 24,576 |
| Multi-part assembly · 多部件机械件 | 独立部件、不同轴向与尺度 | 11,264 | 22,528 | 90,112 |

Medium 版本已经保存为 `examples/complex/*.obj`，包含逐角 UV，可用于 CLI 或导入其他软件。Low/High 在 Studio 中实时生成。褶皱服装是程序生成的裙状测试曲面，不是现实服装扫描、缝纫版型或训练集样本。

点击 **Generate baseline** → **Next / Play** 查看遍历，或点击 **Extract existing UV seams** 查看原有 UV 接缝。**Show all seams** 直接显示完整结果；首个 token 仅选择起点，还没有边。**Export current OBJ + UV** 导出当前原始网格和已有 UV，不是导出右侧 debug preview 的新参数化结果。

重新生成随包资产：

```bash
npm run assets:generate
```

`examples/manifest.json` 记录几何数量与 SHA256。

## FBX 导入

通过 **Load OBJ / FBX / GLB / GLTF** 选取 `.fbx`，或直接拖入窗口。也可点击 **FBX ASCII / FBX Binary** 加载随包测试文件；它们位于 `apps/studio/public/assets/fixtures/`，均为本工程生成的 FBX 7.4，1,584 顶点、3,072 三角形，不是第三方下载资产。

FBX 路径使用 Three.js `FBXLoader`，之后接入统一场景到拓扑转换流程。实现包含：层级变换、多个 Mesh 合并为单份分析输入、镜像缩放的绕序修正、逐角 UV0、初始 morph/skin 姿态采样。分析网格不保留可编辑场景层级；多部件之间不会焊接。

导入选项提供 **Exact / Tolerance / Off**。默认只在同一个源对象内按精确位置焊接渲染顶点，避免法线/UV 顶点拆分让遍历邻接断开，同时独立保留面角 UV。若同一对象包含本应独立的重合表面，应选择 Off；容差过大可能连接不该相连的表面。OBJ 仍使用源 position/UV 索引，不套用这组焊接选项。

**范围限制：** 本版只处理静态几何，不播放动画，不显示材质贴图，不提供 FBX 导出。FBX 曲线/NURBS、未烘焙修改器及不同导出器变体不保证兼容。建议导出三角化的 FBX 7.4/7.5 Binary；实际兼容范围和已执行测试不是同一个概念，详见 [导入格式说明](docs/IMPORT-FORMATS.md)。原始 FBX UV 索引身份不可从 FBXLoader 完整恢复，因此坐标完全重叠的独立 UV 岛不能保证区分。

本地导入默认限制 300,000 三角形和 256 MiB 主文件。这个限制不是实时性能保证，建议先用 Medium 调试。FBXLoader 本身解析尚在主线程；Cancel 不会中断已开始的同步 FBX 解析，接缝 Worker 和网络请求则可取消。

## 从网络获取更复杂的公开模型

**公开模型 · Online** 提供 Khronos glTF Sample Assets 中的 **Corset** 与 **Flight Helmet**。模型资产的原许可为 CC0-1.0，来源和署名见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。程序只取几何 buffer 与 UV，不下载贴图，将数据重新封装为独立 GLB。

可以直接点击界面按钮，也可以先缓存到项目：

```bash
npm run assets:download
# 或仅下载一个：
npm run assets:download -- --only corset
npm run assets:download -- --only flight-helmet
```

成功后会生成 `apps/studio/public/assets/remote/<id>.glb` 和附带下载时间、源地址、许可、SHA256 的 JSON 记录。Studio 优先读取这里的本地副本；否则尝试原站。下载失败会明确报错，不生成成功记录。需要下载后发布离线生产包时，先运行下载命令，再执行 `npm run build`。

**本次制作环境无法下载远端二进制模型，因此这两个网络模型没有预装进 ZIP，也没有完成实际原站端到端下载测试。** 下载/重封装逻辑已通过模拟传输的自动化测试。公开源可能变化、超时或被网络策略阻挡；离线程序网格不受影响。

## 大网格与遍历

接缝生成/UV 接缝提取和 UV chart 预览分别放入 Web Worker。拓扑邻接在一次生成中复用；遍历历史按需展开，不再为每一步预先复制全部历史边。时间线只渲染当前附近最多 100 行，滑杆仍可跳转全部步骤。

**Baseline edge budget** 默认为 1,500：只限制几何 baseline 的候选接缝边，不简化输入网格，也不截断提取出的已有 UV 接缝。超过 20,000 三角形时，UV 默认根据完整接缝集显示；可勾选“大网格也逐步更新 UV”恢复按步更新。

保留 0.1.1 的独立 CSS/drawing-buffer 尺寸、稳定 renderer、X-ray traversal、Reset camera 和可见错误提示。新增状态栏/时间线提示有独立布局回归，避免挤压 3D 视口。

## 验证与开发命令

```bash
npm run test:core       # 已执行：21 项，严格 core/view-math 编译
npm run test:complex    # 已执行：40 项，真实几何/UV/文件结构 + 模拟下载
npm run test:unfold     # 已执行：33 项，逐角对应/端点/选择/导出
npm run test:uv-worker  # 已执行：4 项，真实生产 job 在 Node Worker 运行
npm run test:unfold:browser # 原生 WebGL：本次 24 项通过，2 项浏览器 Worker 显式跳过
npm run test:layout     # 已执行：13 项，原生 Chromium canvas/CSS，无 React/Three
npm run test:imports    # 未执行：真实 Three.js/FBXLoader/glTF 导入测试
npm run check          # 未执行：安装依赖后的 Vitest + Vite + 全量类型检查
npm run test:browser    # 未执行完整流程：真实 Studio/WebGL 浏览器测试
npm run check:full      # 本地完整回归入口
```

`test:layout` / `test:browser` 需要本机 Chrome、Chromium 或 Edge；自动定位失败时设置 `CHROME_PATH` 为可执行文件路径。测试工具不以假的 Three.js/FBXLoader 替代真实库。本版没有依赖锁文件，制作环境未能成功解析和安装完整 npm 依赖树，不能宣称构建可重复性已认证。

## 原有 CLI 与模型边界

CLI 的原有输入仍为 **OBJ**；本次 FBX 支持针对浏览器 Studio，不声称 CLI 也能直接读取 FBX。

```bash
npm run cli -- inspect examples/complex/garment.obj
npm run cli -- baseline examples/complex/knot.obj knot-seams.json
npm run cli -- uv-seams examples/complex/garment.obj garment-seams.json
npm run cli -- training-sample examples/cube_uv.obj cube-training.json
npm run cli -- paper-spec
```

没有增加或训练神经网络权重。`GeometricBaseline` 仍是几何启发式，`MeshTailorBackend` 仍是 learned-model 接口；生成目标仍为 planar debug preview；原 UV 目标保留已有 UV。两者都不代表加入了 ABF++/LSCM 产品级展开。复杂输入支持不代表论文效果已经复现。原有设计见 [模型后端](docs/MODEL_BACKEND.md) 和 [架构](docs/ARCHITECTURE.md)。

## 目录与历史

```text
apps/studio/src/unfold/          展开控制、3D/UV 渲染、对应关系、示例
packages/uv/src/unfold.ts        逐面角数据、可逆变形与导出
apps/studio/src/importers/       FBX/glTF + 场景拓扑归一化
apps/studio/src/workers/         接缝和 UV Worker
apps/studio/public/assets/       随包 FBX fixture、可选下载缓存
packages/mesh-core/src/          网格生成、焊接、资产目录、GLB 工具
examples/complex/                已生成的复杂 OBJ
scripts/                        资产生成/下载、回归测试
THIRD_PARTY_ASSETS.md            来源、许可与资产是否随包
```

ZIP 从干净已提交的 Git HEAD 构建，`.history/repository.bundle` 保存小步提交历史，恢复方式见 [.history/README.md](.history/README.md)。[0.3.0 发布说明](docs/RELEASE-0.3.0.md)；[0.2.0 发布说明](docs/RELEASE-0.2.0.md)；[0.1.1 历史 README](docs/README-0.1.1.md)。
