# Validation — v0.4.10

日期：2026-09-15。旧记录完整保存在 `VALIDATION-0.4.9.md`。下表只列本轮实际执行，不用旧数字代替新回归。

## 已执行的本轮回归

证据路径相对于根目录 `validation/v0.4.10/`。

| 套件 | 结果 | 证据 |
|---|---:|---|
| 面积审计、真实大岛优先、受限小岛增益 | 22项通过 | `area-allocation-smoke.log` |
| 真实邻接与空间关联分离、分页与取消 | 17项通过 | `spatial-neighbors-smoke.log` |
| 生产source-atlas Worker（非模拟算法） | 13项通过 | `source-atlas-smoke.log` |
| 新入口/面积/邻居/导出真实浏览器 | 15项通过 | `area-spatial-browser.json` |
| 旧前后处理工作流浏览器 | 16项通过 | `optimization-browser.json` |
| 自由相机浏览器 | 39项通过 | `camera-browser.json` |
| 逐岛接力浏览器 | 28项通过 | `relay-browser.json` |
| 静止跳过浏览器 | 28项通过 | `motion-browser.json` |
| 两级选择浏览器 | 39项通过 | `selection-browser.json` |
| 重叠真实WebGL像素通道 | 42项通过 | `overlap-browser.json` |
| 连接分页与导出 | 14项通过 | `atlas-pages-smoke.log` |
| 邻岛缝合 | 21项通过 | `chart-merge-smoke.log` |
| 核心 | 21项通过 | `core-smoke.log` |
| 复杂网格 | 退出0，范围见原始报告 | `complex-smoke.log` |
| 铰链 | 17项通过 | `hinge-smoke.log` |
| 朝向 | 18项通过 | `orientation-smoke.log` |
| 纯选择策略 | 20项通过 | `selection-smoke.log` |
| Node生产UV Worker | 4项通过 | `uv-worker-smoke.log` |
| 2000岛装箱 | 5项通过 | `packing-large.json` |
| Git工具单元测试 | 22项通过 | `git-tools.log` |
| 严格核心TS类型检查 | 退出0 | `strict-core-typecheck.log` |
| 修改的5个TSX文件 | 0语法错误，不是完整类型检查 | `tsx-syntax.json` |
| 独立实验页构建 | 退出0 | `lab-build.log` |

浏览器为Linux Chromium + ANGLE/SwiftShader软件WebGL；新工作台测试实际执行生产classic UV Worker和生产几何/渲染/导出模块。它们不是主Studio React/Vite端到端认证。浏览器回归需要较长时间，第一轮工具时间上限曾打断组合任务/相机任务；后续独立执行完整通过。重复执行不相加计数。`browser-results.json` 记录后续五套命令的真实退出码和耗时。日志只修剪行尾空白以便Git检查，结果文本不改写。

## 对用户问题的具体证据

1. **不再把异常源比例当成已归一结果。** 合成三角片的最小源3D面积占比约0.0999%，却拥有超过900倍于平均的原UV密度。新atlas得到每岛密度比1；原输入不变。可选2倍增益实测为面积2倍，不是边长2倍。
2. **真实减少与仅分组分开。** 生产Worker中12个重叠源岛来自两个真实连通面板；整理+验证缝合得到2岛，纯重排仍12岛。3个真正断开的近邻面板保持3岛，只成为2个关联组/空间页。没有靠改计数或重叠显示冒充合并。
3. **操作与坐标一致。** 新主按钮生成source-atlas，原样按钮恢复原12岛与重叠；逐三角形检查新atlas无交叠，动画最终顶点和新UV精确一致，OBJ导出回读保持相同坐标。岛/三角形选择不触发重排。
4. **大岛优先和共同缩放。** MaxRects和Shelf均检查实际放置顺序，包含小岛提升导致目标面积相同时仍按3D面积排序的情况。诊断记录多次试装和失败轮，不只写一个固定成功标记。
5. **性能边界。** 2000个合成矩形岛使用生产Shelf，测得装箱约276.5ms、占用约42.67%；这是单独装箱阶段、无真实模型求解，不是Corset或FlightHelmet性能结论。全部2000岛检查非叠放、留白、比例与确定性。新邻居索引避免每个候选位置扫描所有已放岛，但邻近搜索仍有明确比较上限。

截图 `docs/images/area-spatial-0.4.10.png` 来自实际离线页面，标题明确为“面积比例与空间邻居 · 合成测试片”，不是服装人台或头盔；没有使用生成式设计图替代运行截图。

## 未通过/未完成的范围

本轮实际执行 `npm install --ignore-scripts --no-audit --no-fund`，12秒上限终止，未获得可用依赖；`npm run build` 退出127（vite: not found），全量 `npm run typecheck` 退出2（缺少node类型定义）。另行registry访问退出6（DNS无法解析）。命令、退出码和耗时记录在 `build-attempts.json`，各自原始输出见同名log。不能把独立curl结果伪称为npm安装输出。

真实Corset/FlightHelmet的几何二进制未取得；公开glTF元数据不能证明具体UV面积、岛数或重叠原因。**没有测量用户的98岛，也没有确认#1/#75为何叠放，不能声称它们已变成某个岛数。** 新GLB诊断脚本路径已接入source-atlas和相应报告，但依赖/资产缺失时不计通过。未执行macOS、Windows、Safari、硬件GPU实机认证。

空间邻居是有限采样近似，不是精确最近面/语义部件识别；新atlas依旧矩形装箱而非凹多边形嵌套。平均岛密度归一不能修复岛内部局部形变或原始自折叠。未连接的岛不会仅因接近被焊接；小岛/关联组数减少不冒充真实岛数减少。全部面有效性检查继续执行，错误/超时不发布伪成功半成品。

## 发布验证另行记录

本轮在现有Git历史上小步提交，版本0.4.10使用独立附注tag，所有旧tag保留。本内部文档是打包前记录；最终ZIP跟踪文件一致性、干净工作区、Git发布检查、bundle恢复，以及解压包关键回归，放入外部交付验证文件。没有在打包前预填“最终ZIP已通过”。
