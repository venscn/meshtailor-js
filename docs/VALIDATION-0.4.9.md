# Validation — v0.4.9

日期：2026-09-15。历史 v0.4.8 验证保存在 `VALIDATION-0.4.8.md`。本版修改生产WebGL显示、重叠设置与教学示例，不改UV/铰链几何算法。

## 实际执行结果

所有证据路径相对于 `validation/v0.4.9/`。日志只移除末尾多余空行以通过Git空白检查，命令输出内容不改写。仅本表列出的本轮执行可称为本轮通过，不沿用旧包数字充数。

| 套件 | 结果 | 证据 |
|---|---:|---|
| 重叠策略 | 12项，退出0 | `overlap-policy.json` |
| 生产重叠GPU通道 | 42项，退出0 | `overlap-gpu.json`，DPR1/2、真实着色器/计数像素 |
| 实际马鞍铰链与新控件 | 17项，退出0 | `overlap-workbench.json`，生产classic UV Worker与生产renderer |
| 两级选择浏览器 | 39项，退出0 | `selection-browser.json` |
| 自由相机浏览器 | 39项，退出0 | `camera-browser.json` |
| 接力浏览器 | 28项，退出0 | `relay-browser.json` |
| 静止跳过浏览器 | 28项，退出0 | `motion-browser.json` |
| 通用原生WebGL | 24项通过，2项跳过，退出0 | `unfold-browser.json`，显式 `--skip-browser-worker` |
| 核心 | 21项，退出0 | `core.log` |
| 铰链 | 17项，退出0 | `hinge.log` |
| 纯选择策略 | 20项，退出0 | `selection.log` |
| 邻岛缝合 | 21项，退出0 | `chart-merge.log` |
| 连接分页与导出 | 14项，退出0 | `atlas-pages.log` |
| Node生产UV Worker | 4项，退出0 | `uv-worker.log` |
| 真实布局 | 13项，退出0 | `layout.log` |
| Git工具单元测试 | 22项，退出0 | `git-tools.log` |
| 严格核心TS类型检查 | 退出0 | `strict-core-typecheck.log`（无输出） |
| 3个修改TSX入口 | 0语法错误 | `tsx-syntax.json`，不是全量类型检查 |
| 独立离线页面构建 | 退出0 | `lab-build.log` |

原生通用WebGL的2个module Worker检查因opaque-origin测试宿主被显式跳过，不计为通过。新的工作台套件在HTTP宿主运行真正的classic UV Worker并通过，并不替代Vite module Worker。测试全程是Linux Chromium + ANGLE/SwiftShader软件WebGL，不是硬件GPU实机认证。

首批组合执行曾受工具单次时间上限影响；之后将每个套件作为独立进程运行并记录退出码，表中均有实际成功结果。`summary.json` 记录命令、耗时和退出状态；着色器导数求值被移至拒绝分支前之后，重叠GPU42项与工作台17项再次退出0并覆盖对应最终报告。截图按0.4.9标签重新生成。重复执行不重复相加计数。

## 针对用户问题的证据

原生GPU套件验证了完全叠合2层、部分叠合、3层、反绕序、共享边不误报、不同岛不混计、普通前后遮挡在默认模式中排除且在明确的视线模式中计入、法向非平行拒绝、容差内外、相机转动、FBO状态恢复、禁用与显式错误重试。不是只检查着色器字符串存在。

马鞍是4个相连三角形/1个UV岛，使用真实铰链树：铰链末段出现橙纹，最终有效菱形UV无重叠提示。测试验证源与目标端点、动画播放不被设置打断、相机和面选择不变。真实WebGL上下文丢失/恢复后验证重叠资源、几何和相机；离线宿主恢复后错误横幅的清理沿用测试宿主处理，不将该项扩写成完整Studio恢复UI已认证。

截图 `docs/images/overlap-0.4.9.png` 为本版真实离线工作台：条纹只在重叠三角区域，右侧显示无重叠菱形UV。没有生成式设计图，没有拿合成例冒充头盔/服装人台。

## 构建、依赖和未验证边界

`npm run build` 实际退出127，`vite: not found`，日志 `full-build.log`；`npm run typecheck` 实际退出2，缺少node类型定义，日志 `full-typecheck.log`。另行 `curl -I --max-time 6 https://registry.npmjs.org/react` 返回6，无法解析域名，日志 `registry-check.log`；不能把这一curl错误说成npm安装日志。

本轮未再次成功安装依赖，未通过完整React/Vite构建、React主页面端到端、FBX/glTF导入或module Worker联调。主Studio和离线页均接入同一生产渲染与选择模块，但两者不是同一个UI运行时。严格核心TS不包含React TSX依赖检查，语法转译也不证明React hooks或props全量正确。

没有测试真实Corset/FlightHelmet的二进制，亦未测试macOS/Windows/Safari/硬件GPU或真实显存耗尽。新通道是可见表层附近的近共面采样诊断，不是精确/全局几何交叠审计；非平行自交、深处和亚像素重叠可能不显示。

## 最终交付

内部记录对应打包前实际测试。发布使用干净提交HEAD、新附注tag v0.4.9、保留旧tag；最终ZIP解压、跟踪文件一致性、Git发布检查与bundle独立恢复，以及从解压包重跑关键测试，单独记录在外部交付验证文件。不在尚未打包前预先写“最终ZIP已通过”。
