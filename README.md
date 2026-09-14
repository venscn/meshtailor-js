# MeshTailor-JS 0.4.3

新增 **真正的边铰链展开演示 + 拓扑 UV 参数化 + 面积感知排布**。不再把曲面直接投影并用顶点插值假装折开。原有遍历、复杂网格、FBX / GLB 导入入口继续保留；这是独立 JS / TypeScript 研究工程，不是官方 MeshTailor 软件。

ZIP 包含 `.git/` 和 `.history/repository.bundle`，使用独立附注 tag **v0.4.3**。`v0.1.0`、`v0.1.1`、`v0.2.0`、`v0.3.0`、`v0.4.0`、`v0.4.1`、`v0.4.2` 不移动；各功能 / 修复 / 测试 / 文档小步提交，要求见 `AGENTS.md`。

## v0.4.3 逐岛尾段接力

默认 **逐岛接力**：前岛达到 **85%** 后下一岛才启动，最多相邻两岛重叠。也可选择严格串行，完全结束才启动下一岛。范围仍支持单个、多选、全部；“全部”不再代表同时开始。交接阈值可调 75–100%，每岛完整时长独立于选中数量，界面显示实际总时长、剩余时间和活动岛的局部进度。

等待岛保留原始 3D，完成岛精确停在最终 UV。几何位置、铰链角度、阶段按钮、队列跳转和两套播放器共用一个调度器。固定平面网停留默认关闭，可主动开启或点击阶段按钮暂停检查；去掉低帧率时丢弃超过 100ms 时间的逻辑和循环末尾固定等待，相机仍然完全手动优先。

[接力调度与本次修复](docs/RELEASE-0.4.3.md)。`npm run test:relay` 与 `npm run test:relay:browser` 分别运行纯调度回归及真实浏览器播放回归；验证范围见 [VALIDATION.md](docs/VALIDATION.md)。

## 保留的 v0.4.2 自由相机修复

**默认关闭自动跟随。** 播放、反向、循环和拖动进度不改变相机；播放中可以自由旋转、平移、缩放。主动开启跟随后，一旦操作相机就立即退出跟随，动画继续。松手后不会回弹，也不会在循环时自动恢复跟随。

新增 **“适配当前面片（保留观察方向）”**；原 3D/UV 视角按钮仍可用，但都只适配一次，不锁定相机。相同源网格重新求解 UV 和 WebGL 自动恢复不再复位视角。主 Studio 与离线页同时更新。

[相机修复详情](docs/RELEASE-0.4.2.md)。10 项策略测试、39 项真实浏览器相机回归已通过，原有展开/渲染/布局回归已复跑。完整 React/Vite 构建仍受依赖获取失败限制；具体边界见 [本轮验证记录](docs/VALIDATION.md)。

## 保留的 v0.4.1 大网格计算修复

UV 任务现在显示真实阶段、迭代/面数/排布轮次与耗时，支持取消和重试，默认 120 秒预算及主线程强制终止保护。大岛数自动选择面积感知 Shelf，优化 LSCM 稀疏迭代，不降低输入面数或跳过 UV 检查。`Auto / MaxRects / Shelf` 与时间预算可在“UV 求解与排布”调整。

[v0.4.1 修复与飞行头盔专项诊断](docs/RELEASE-0.4.1.md)。**90,112 面程序网格实测通过，不等于飞行头盔资产实测通过。** 该历史版本的真实资产验证限制见 `docs/VALIDATION-0.4.1.md`；本轮没有重跑飞行头盔专项，当前 React/Vite 联调边界见 `docs/VALIDATION.md`。

## 启动与快速体验

**无需安装运行依赖**：打开根目录 `unfold-lab.html`，默认三块真实折角带。支持 WebGL2 的浏览器可以运行；本地文件被限制时执行 `node scripts/serve-unfold-lab.mjs`，使用显示的本地地址。实验页与主 Studio 共用求解、动画、渲染和导出模块，支持内置网格和 OBJ；不是另一套简化算法。其真实浏览器交互与 Worker 已测试，详见 [验证边界](docs/VALIDATION.md)。

**完整 Studio** 使用 Node.js 22.16.0 或更新版本：

```bash
npm install
npm run dev
```

打开 Vite 显示的地址，顶栏应为 `Studio · 0.4.3`。进入“3D ↔ UV 展开动画”，点“加载三块折角带示例”，使用当前岛的阶段按钮观察沿边转动。单个 / 多选 / 全部与尾段接力 / 严格串行独立；反向播放、阶段按钮、铰链角度、临时断边、相机跟随和联动拾取均可控制。

**验证边界：** 核心、原生 WebGL、离线完整实验页、真实离线浏览器 Worker 及 Node Worker 已实测。本轮 npm 安装未完成，完整 React/Vite 主界面、主界面 module Worker 加载、全量 UI 类型检查和真实 FBXLoader 仍未认证。不是把离线实验页测试称为完整 React 联调；也没有声称 macOS / Windows / Safari 实机认证。

## UV 展平不再是平面投影

生成目标使用：面角拓扑复制 → 盘检查与显式补切 → LSCM / Tutte → 翻面、退化、重叠检查 → 平均表面积密度统一 → 旋转与 Auto（MaxRects / Shelf）装箱。左右视图及“导出对应 OBJ + 目标 UV”共用同一份结果。原始 UV 目标仍原样保留，不修复已有重叠。

动画将 **沿边刚性旋转** 与 **必要的 UV 非刚性形变** 分开；紫色断边只服务教学刚性展开，不导出。UV 求解的实际补切则进入两个视图和导出。阶段、算法、配置、利用率、截图与局限见 [展开与 UV 说明](docs/UNFOLDING_AND_UV.md)。

MaxRects / Shelf 都不是全局最优求解器，当前不做凹形多边形嵌套。UI 区分有效 UV 面积占用和包围盒占用，不靠重叠或独立拉伸 U/V 刷满面积。当前刚性动画不是无碰撞纸片 / 材料仿真。

## 复杂网格

左侧 **复杂样例 · Offline** 选择模型和 Low / Medium / High，然后点击 **Load complex mesh**。这些网格由本工程确定性生成，不需要联网获取资产；首次安装 npm 依赖仍需要网络。

| 样例 | 用于观察的结构 | Medium 顶点 | Medium 三角形 | High 三角形 |
|---|---|---:|---:|---:|
| Pleated garment · 褶皱服装 | 开口、褶皱、UV 断裂 | 6,240 | 12,288 | 49,152 |
| Trefoil knot · 三叶结 | 封闭曲面、孔洞、周期 UV | 4,608 | 9,216 | 36,864 |
| Bevelled gear · 倒角齿轮 | 齿面、通孔、尖锐转折 | 3,072 | 6,144 | 24,576 |
| Multi-part assembly · 多部件机械件 | 独立部件、不同轴向与尺度 | 11,264 | 22,528 | 90,112 |

Medium 版本已经保存为 `examples/complex/*.obj`，包含逐角 UV，可用于 CLI 或导入其他软件。Low/High 在 Studio 中实时生成。褶皱服装是程序生成的裙状测试曲面，不是现实服装扫描、缝纫版型或训练集样本。

点击 **Generate baseline** → **Next / Play** 查看遍历，或点击 **Extract existing UV seams** 查看原有 UV 接缝。**Show all seams** 直接显示完整结果；首个 token 仅选择起点，还没有边。**Export current OBJ + UV** 导出当前原始网格和已有 UV，不是导出新求解的目标 UV；目标 UV 使用展开页的专门导出按钮。

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
npm run test:parameterization # LSCM / Tutte / slit topology
npm run test:atlas      # 有效面积、拓扑补切、六个网格
npm run test:hinge      # 17 项，真实铰链几何
npm run test:uv-guards  # 11 项，保护和导出拓扑
npm run test:lab        # 21 项，离线 UI + WebGL + 真实 Worker
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

没有增加或训练神经网络权重。`GeometricBaseline` 仍是几何启发式，`MeshTailorBackend` 仍是 learned-model 接口；生成目标现为本项目实现的 LSCM / Tutte + MaxRects；原 UV 目标保留已有 UV。没有加入 ABF++、ARAP、SLIM 或 xatlas 运行库；通过数值回归不等于所有输入已经产品级认证。复杂输入支持不代表论文效果已经复现。原有设计见 [模型后端](docs/MODEL_BACKEND.md) 和 [架构](docs/ARCHITECTURE.md)。

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

ZIP 从干净已提交的 Git HEAD 构建，`.history/repository.bundle` 保存小步提交历史，恢复方式见 [.history/README.md](.history/README.md)。[0.4.0 发布说明](docs/RELEASE-0.4.0.md)；[0.3.0 发布说明](docs/RELEASE-0.3.0.md)；[0.2.0 发布说明](docs/RELEASE-0.2.0.md)；[0.1.1 历史 README](docs/README-0.1.1.md)。
