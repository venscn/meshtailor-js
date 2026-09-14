# Validation — v0.4.5

日期：2026-09-14。旧记录原样归档 `VALIDATION-0.4.4.md`。本版修改连通分区/自动参数、补切、原 UV 读取、镜像方向与 UV-fit 插值。

## 实际执行通过

| 测试 | 通过项 | 边界 |
|---|---:|---|
| regions | 27 | 覆盖、连通、确定性、缩放平移一致、固定缝和取消 |
| slits | 8 | 环状域窄缝、封闭域开缝、源数据不变 |
| large-charts | 53 | 四类 Low/Medium 完整 UV、最小岛、旧齿轮254复现、预算/检查仍生效 |
| seam-policy | 13 | 生产 seam/UV Node Workers、自动参数、原 UV 精确保留、遍历稳定目标 |
| orientation | 18 | 正/反绕序及90/180度目标旋转；刚性矩阵、面积、端点、导出 |
| fit-orientation | 17 | 解析180度例子、四类曲面25个UV-fit阶段采样、无翻面、精确端点 |
| large-charts-browser | 14 | DPR1/2真实离线UI、WebGL和Worker；自动按钮填写并求解、Extract、镜像动态面积 |
| core / complex | 21 / 40 | 核心严格编译、拓扑、导入文件结构；不等于 FBXLoader 实测 |
| parameterization / hinge / unwrap-guards | 10 / 17 / 11 | 原求解、刚性边长、共享铰链、连续性、质量保护 |
| unfold | 33 | 对应、选择、准确端点、导出 |
| uv-worker / uv-progress / uv-job-client | 4 / 5 / 11 | 真 handler、预算、进度与生命周期 |
| uv-large-worker | 3 | 90,112面生成/源UV完整覆盖、显式超时 |
| motion-time / motion / relay | 9 / 13 / 22 | 压缩时间线、无动作跳过、最多相邻两岛 |
| camera-policy / camera-browser | 10 / 39 | 播放中的真实相机操作和自动跟随中断 |
| relay-browser / motion-browser | 28 / 28 | 真实RAF、正反播放、静止跳过、端点/队列一致 |
| git-tools | 22 | Git检查工具正反测试；tag发布检查在最终提交后执行 |

Atlas 排布回归也执行成功；11个TSX文件额外经过 TypeScript 的语法转译。日志和测量位于 `docs/validation/v0.4.5/`；不得把这些测试相加后声称全部是完整端到端联调。

浏览器套件使用离线页与主工程共用的生产渲染和 Worker 代码，不是 React/Vite DOM 或 module Worker 联调。测试环境 Linux + Node22.16.0 + Chromium144 + ANGLE/SwiftShader 软件渲染。

## 发现并处理的开发期回归

软件WebGL最初受无活动X server的DISPLAY影响；测试启动器在明确要求软件渲染时对子进程去掉DISPLAY并指定headless Ozone。没有修改用户应用的环境。

六岛立方体演示曾意外继承新的自动大块策略，破坏它承诺的六面示例和旧时间线断言；现将教学样例显式固定为六面接缝，并重新通过对应、运动和真实浏览器测试。没有降低/删除这些旧断言。

90,112面测试以前硬编码必须用Shelf；新分区只有117岛，按现有256阈值应使用MaxRects。测试改为按真实岛数验证Auto选择，而不强行维持旧碎片数量。

## 实际未通过与未验证

npm依赖请求返回EAI_AGAIN。版本0.4.5实际执行 `npm run build`，退出127：`vite: not found`，因此完整React/Vite构建与全量UI类型检查未通过验证。语法检查不能代替它们。

FlightHelmet几何通过curl及容器下载入口均未下载成功；没有实际运行真实资产专项，也没有将它包含在ZIP。新高面数测试是程序机械件，不是头盔替身认证。

没有重跑真实FBXLoader、GLB浏览器导入、macOS/Windows/Safari实机。离线页和Node套件不能证明上述路径全部正常。

## 测量说明

旧碎片计数来自本轮修改前运行的v0.4.4源码，见 `before-fragmentation.json`。新结果取最终求解后的UV岛，不是区域生长候选数量。Low齿轮254→4是baseline对比；旧首次加载61→4是另一条路径，不能混用。全部源面保留。

旋转感知拟合避免的是有效同向三角形在插值中局部翻转，并不保证跨三角形连续、全局无重叠、无临时断边或符合物理折纸。原UV混合翻面时不谎称已经修复。

最终ZIP重新解压、发布tag、干净工作区、bundle恢复及复验见随包交付验证记录。
