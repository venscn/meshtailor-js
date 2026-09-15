# Validation — v0.4.7

日期：2026-09-15。v0.4.6 原记录归档为 `VALIDATION-0.4.6.md`。本次范围是岛/面两级选择、React hook 接线、离线事件接线及石墨灰工作台 UI；没有改变 UV/铰链/分割/导出算法。

## 实际通过

| 套件 | 通过项 | 范围 |
|---|---:|---|
| selection | 20 | 首次选岛、再次选面、重复取消、跨岛清空、多选、非法索引、快速连续动作 |
| selection-browser | 39 | 两种DPR，真实2D/3D鼠标输入、双向取消、播放/相机/队列隔离、Esc；1117/900/600宽度无水平溢出 |
| camera-browser | 39 | 真实播放时自由旋转/平移/缩放、上下文恢复、一次性适配 |
| relay-browser / motion-browser | 28 / 28 | 实际RAF逐岛接力、压缩时间线、正反播放 |
| material-layout-browser | 20 | 生产Worker、六材质分框、拾取、原坐标和导出不变 |
| lab-browser | 21 | 真实离线流程、阶段跳转、Tutte、无效参数/恢复、复杂结网格 |
| layout | 13 | 旧DPR尺寸爆炸负控制、当前画布稳定性、约束视口/滚动 |
| core / complex / unfold | 21 / 40 / 33 | 严格核心TS编译、网格和对应 |
| hinge / orientation / fit-orientation | 17 / 18 / 17 | 刚性、方向、端点 |
| camera / relay / motion-time / motion | 10 / 22 / 9 / 13 | 策略、独立时序与静止检测 |
| source-layout / compact-layout | 12 / 11 | 多材质源UV与展示位置、距离约束 |
| materials / boundary-stitch / fragmentation | 9 / 10 / 12 | 材质归属、边界修复保护、分裂诊断 |
| git-tools | 22 | 发布工具正反测试 |

报告位于根目录 `validation/v0.4.7/`。`ui-syntax.json` 记录所有 Studio TSX（包括开发测试页）的语法转译，不是完整UI类型检查。`lab-build.txt` 为真正生成单文件实验页的输出。

浏览器为 Linux Chromium + 明确开启的 ANGLE/SwiftShader 软件WebGL。离线页使用共用生产求解、几何、渲染和经典浏览器Worker；其交互状态采用与React相同的纯策略，但不是React运行时。因此离线通过不能替代React hook/Studio主界面认证。

截图 `images/workbench-0.4.7.png` 为实际离线页面，不是设计概念图。

## 失败、修正和未验证

原 `lab-browser` 用 `.18/.9/2.7` 固定常数验证阶段位置，不适用于现有按每岛运动压缩的时间线。本轮首次运行在该断言失败，记录保留在 `lab-legacy-assertion.txt`；测试改成检查阶段按钮是否映射到实际有效时间线，仍检查铰链角度与真实顶点，随后完整21项通过。没有为了此断言改变动画算法。

选择浏览器测试开发时，120毫秒固定等待在软件渲染下不足以保证出现下一帧，改为等待实际播放进度增加并设置超时。DPR缓冲尺寸按canvas整数clientWidth/clientHeight计算，与生产renderer一致；DOMRect可以有亚像素，不能把小于1 CSS像素的取整差当成布局循环。窄窗口允许纵向滚动条占据宽度，但仍禁止横向溢出。这些修正没有替换真实事件或渲染器。

npm install 在25秒外层预算处退出124，没有得到依赖，日志为空；独立curl记录实际DNS错误。随后执行：

| 命令 | 真实结果 |
|---|---|
| npm run build | 退出127，vite: not found |
| npm run typecheck | 退出2，缺少 node 类型定义 |
| npm run test:selection:react | 退出1，真实React/Vite依赖检查失败，未运行内部用例 |

完整React/Vite主界面、主页面module Worker、真实React hook集成和FBX/glTF导入本轮未认证；没有使用替代React或类型存根声称成功。开发测试页包含11条待依赖就绪后执行的用例，不纳入通过数。

本轮没有重新获取或实测真实Corset / FlightHelmet，也未做macOS、Windows、Safari实机测试。未重跑的其他套件不能从旧版记录累加为本轮通过项。

`browser-regressions.json` 是第一轮批次的原始退出记录，其中lab失败是上述过期断言；以更新后的 `lab-browser.json` 21项成功和本说明解释复跑，不篡改最初批次结果。

最终ZIP将再解压检查tag、clean worktree、bundle及关键回归，结果由交付验证文件记录，不用这里预先宣称最终包已测试。
