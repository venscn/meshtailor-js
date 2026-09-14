# Validation — v0.4.6

日期：2026-09-14。旧记录原样归档 `VALIDATION-0.4.5.md`。此次代码包括材质归属、显示坐标与源UV分离、保守断边配对、软形变面积控制、分裂诊断和紧凑分离布局。

## 已执行

| 套件 | 通过项 | 范围 |
|---|---:|---|
| material-domain | 9 | glTF轻量材质、重复转换稳定性、材质接缝和OBJ标签/坐标 |
| boundary-stitch | 10 | 唯一边配对、尺度、歧义保护、不跨对象、UV不变 |
| source-layout | 12 | 多材质分框、原值不改、拾取、导出、框外坐标 |
| compact-layout | 11 | 平移上限、0距离、选择不跳、半径不影响、精确端点 |
| fragmentation | 12 | 面积加权极值、真实补切计数、全部面与有效性、预算 |
| material-layout-browser | 20 | 两种DPR，真实原生WebGL与Worker、六材质测试片、鼠标拾取、叠加切换、导出诊断 |
| large-charts | 53 | 四类内置Low/Medium网格完整求解；不是Corset/FlightHelmet |
| large-charts-browser | 14 | 真实离线UI的自动按钮、Extract、镜像方向 |
| core / complex | 21 / 40 | 核心TS严格编译、网格导入核心、模型结构和mock下载 |
| unfold / hinge / orientation / fit-orientation | 33 / 17 / 18 / 17 | 对应、刚性、端点、方向和UV形变 |
| regions / slits / seam-policy | 27 / 8 / 13 | 连通分区、窄缝、生产Node Worker策略 |
| motion-time / motion / relay | 9 / 13 / 22 | 静止压缩、相邻接力、有效时长 |
| camera-policy / camera-browser | 10 / 39 | 手动相机、真实播放和鼠标、同源重算不复位 |
| relay-browser / motion-browser | 28 / 28 | 真RAF、正反播放、相机、压缩时间线 |
| uv-worker / uv-progress / uv-job-client | 4 / 5 / 11 | 生命周期、进度、超时取消 |
| uv-large-worker | 3 | 90,112面程序机械件，生成/源UV/预算失败 |
| layout / uv-lifecycle-browser | 13 / 7 | 高DPI布局，真实Worker取消/失败/重试 |
| git-tools | 22 | 发布检查工具正反回归 |

另外执行了parameterization、atlas、packing-large、unwrap-guards回归。各实际JSON/TXT位于 `docs/validation/v0.4.6/`。语法转译列表见 `ui-syntax.json`，不等于完整UI类型检查。

90,112面程序机械件：本轮生成117岛，Worker往返约14.86秒；原UV4岛约3.01秒。保留全部90,112面和UV对应；数值是此Linux环境的一次测量，不是两件远端模型的速度或岛数保证。

六材质测试片是本工程构造的12面回归输入，刻意让六套原UV坐标重合以验证分框。不是头盔网格，截图标题也明确标记了这一点。

浏览器使用Linux + Chromium + ANGLE/SwiftShader，在真实离线HTML/共用生产模块/Blob Worker上执行。不是完整React/Vite主界面E2E，更不是macOS/Windows/Safari实机认证。

## 未验证与执行中断

本轮未成功获取Corset和FlightHelmet几何二进制。公开glTF的材质信息可以读取，不能凭此计算真实连通性、求解成功率、最终岛数或真实动画效果。真实资产专项脚本已更新，但未宣称实测。

npm安装尝试未在工具上限内完成，也未产生可用依赖；随后实际运行 `npm run build` 退出127，`vite: not found`。因此完整React/Vite构建、全量UI类型检查、真实Three场景/FBXLoader/glTF导入新增集成用例未执行通过。新增Vitest用例不计入上表通过数。

两个批量命令在外层工具时限处中断；缺少成功结果的套件分别补跑，以单套JSON/TXT而不是不完整批次清单为准。浏览器生命周期7项已输出完整报告，包含它的后续批量命令在之后任务中超时。安装日志为空，不把它描述成特定DNS错误。

开发期间修正了单材质框外坐标被平移的回归，以及浏览器测试脚本全局const重声明。早先未启用软件WebGL的浏览器启动超时，最终记录使用明确的软件渲染参数。原先两项“所有岛必须铺成不重叠大网格”的断言随设计变更改成有界平移及选择不变性；刚性边长、端点和共享边等断言保留。

最终ZIP再解压的提交/tag/工作区、关键回归和bundle恢复记录随交付单独提供，不用本文件预先冒充最终包已经验证。
