# Validation — v0.4.11

日期：2026-09-15。历史 v0.4.10 验证保存在 `VALIDATION-0.4.10.md`。本文件只报告本轮实际执行；源码构建、真实模型算法、离线浏览器、完整 Studio 分开。

## 输入身份

唯一使用 `meshtailor-test-models(1).zip`（2,763,968字节，SHA256 `284decae81fda986f3c291bf4bebee473221b4eabe7078c65ed44adaf9ffb563`）。旧无 `(1)` 包不读取，不回退，不参与任何本轮统计。正确四文件现随包置于 `examples/verified-models/`，逐字节哈希门槛见专项脚本。

## 真实模型与整张 atlas

证据：`validation/v0.4.11/after-Corset-source-atlas.json`、`after-FlightHelmet-source-atlas.json`，对照旧 HEAD 的 `before-*.json`。

| 项目 | Corset | FlightHelmet |
|---|---:|---:|
| 三角形（全部保留） | 18,324 | 94,722 |
| 生产装配后连通块 | 75 | 85 |
| 源 UV 岛 / 当前新 UV 岛 | 98 / **79** | 237 / **130** |
| 修复的原 UV 岛 | #72、#73 | #6、#12 |
| 接受共享边缝合 | 19 | 107 |
| 新图最大平均密度比误差 | <1e-12 | <1e-12 |
| 全图翻面 / 退化 / 正面积交叠 | **0 / 0 / 0** | **0 / 0 / 0** |
| 导出OBJ重读岛数 | 79 | 130 |
| 本次 Node Worker 记录的完整耗时 | 2.43秒 | 23.00秒 |

这些耗时是本制作环境的单次记录，测试时存在其他并发工作，不是独占机器基准或用户机器性能保证。此前同代码执行的头盔Worker也曾约18.9秒。报告包含真实阶段耗时、面积、关联图、全部缝合事件、失败原因、输入未修改断言及导出检验；岛数不使用空间组数替代。

### 独立导出几何检查

除应用自己的 `checkUVTriangles`，还对**导出的OBJ**做了一次独立 GEOS/Shapely 2.1.2 的 STRtree + 三角形多边形求交检查。不是调用本工程UV检查器，也不是从截图猜测。

Corset检查95,760对接触候选，头盔检查534,284对候选（含正常共享边）；两者交集最大面积均为0，超过 `1e-14 UV²` 容差的正面积重叠对均为0。检查报告绑定对应OBJ的SHA256，见 `independent-geometry-check.json`。此为制作环境的独立QA，不是JS工程的运行依赖；通用应用和自带回归不要求Python/Shapely。

## 回归套件

| 套件 | 本轮结果 | 证据 |
|---|---:|---|
| 核心 / 参数化 / 展开 / 保护 / 面积 / 邻居等24个脚本 | **24套退出0** | `core/summary.json`、各日志 |
| 新局部修复 | 12项通过 | `core/source-repair.log` |
| 新保留必要开缝连接 | 9项通过 | `core/chart-join.log` |
| 新保留UV形状缝合 | 10项通过 | `core/rigid-uv-join.log` |
| 两个正确真实模型的浏览器流程 | **18项通过** | `corrected-models-browser.json` |
| 自由相机浏览器 | 39项通过 | `browser/camera-browser.json` |
| 逐岛接力浏览器 | 28项通过 | `browser/relay-browser.json` |
| 静止跳过浏览器 | 28项通过 | `browser/motion-browser.json` |
| 两级选择浏览器 | 39项通过 | `browser/selection-browser.json` |
| 叠层WebGL像素回归 | 42项通过 | `browser/overlap-browser.json` |
| 前处理/后处理工作流浏览器 | 16项通过 | `browser/uv-optimization-browser.json` |
| 面积/邻居/导出工作流浏览器 | 15项通过 | `browser/area-spatial-browser.json` |

新算法三个小套件已包含在上述24套内，不重复相加冒充更多独立测试。24套还覆盖了旧的21核心、33展开、17铰链等断言；精确计数按原始报告，不用“退出0”自动扩写为若干未执行断言。

## 浏览器范围及性能警告

实际运行 Chromium + SwiftShader（无硬件GPU）的**离线工作台与生产Worker/WebGL**。真实模型测试从哈希锁定的静态glTF/bin经生产网格装配送入浏览器，检查实际Worker岛数、局部修复、全图有效性、OBJ重读、动画终点、先岛后面/二次取消、恢复原UV、控制台与布局。截图是这两份真实输入的运行画面，版本标记0.4.11，不是设计稿或替代网格。

**大模型专项为避免软件叠层通道的额外开销，关闭了实时重叠着色；全图重叠由独立数值检查完成。** 叠层着色本身另有42项实际WebGL像素测试，但不能把它算成默认设置下94,722面头盔的流畅认证。

初次大模型调试触发15秒CDP超时；测试工具后来允许显式90秒单次命令预算（小套件默认仍15秒），不改变应用Worker120秒任务预算，也不修改算法断言。真实头盔的整组选择操作在软件渲染测试中累计约45.6秒；截图也明显慢。因此**只证明功能结果，不声称大模型交互流畅、实时帧率达标或已完成硬件GPU性能认证**。这些耗时记录在案例的 `milliseconds` 字段。

制作环境禁止通过浏览器导航到localhost（ERR_BLOCKED_BY_ADMINISTRATOR）；专项用CDP载入离线HTML并注入正确模型数据，实际Worker仍在浏览器内创建。没有称其为网络部署/HTTP完整导航联调。

## 未通过或未覆盖

本轮 `npm run build` 实际退出127（`vite: not found`）；`npm run typecheck` 实际退出2（缺少Node类型依赖）。日志在 `environment/`。不把核心严格TS编译或TSX语法检查冒充完整UI类型检查。

未成功安装React/Three/Vite依赖，因此没有完成真实 `GLTFLoader` / FBXLoader 导入、完整React页面E2E、贴图加载或生产Vite包认证。专用fixture解码器仅支持这四个固定文件，并且拒绝其他glTF格式，不替换应用加载器。

未做macOS/Windows/Safari或硬件GPU实机认证。未保证人类语义版型、全局最少岛、全局最优凹多边形装箱、全部动画姿态无自交。原始UV可能有意镜像/复用；新atlas通常需要重烘焙贴图。

## Git / 最终交付

基于原 `v0.4.10` 连续小步提交，不移动旧tag。独立附注tag为 `v0.4.11`。发布后重新解压检查、跟踪文件逐字节核对、旧tag身份、bundle独立恢复和真实模型再次运行记录写入ZIP旁的交付验证报告；不由本源码测试清单代替。
