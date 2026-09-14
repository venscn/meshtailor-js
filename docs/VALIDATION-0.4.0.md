# Validation — v0.4.0

2026-09-14。本记录仅列实际执行的检查。v0.3.0 原记录存为 `VALIDATION-0.3.0.md`，早期版本也保留。

## 执行环境

Node 22.16.0、全局 TypeScript 5.8.3、Chromium 144、Linux、Xvfb / SwiftShader 软件渲染。不是 macOS / Windows 或硬件 GPU 实机性能测试。npm registry 的本轮访问仍实际返回 DNS `EAI_AGAIN`；日志位于 `validation/v0.4.0/npm-registry-attempt.log`。没有成功安装完整 npm 依赖树，不伪造 lockfile。

## 实际通过

| 检查 | 通过 | 范围 |
|---|---:|---|
| `test:core` | 21 | 纯核心、视口数学严格编译；70 个 TS/TSX 语法转译。语法转译不是完整 UI 类型检查。 |
| `test:complex` | 40 | 原有复杂网格 / 焊接 / 格式结构 / 模拟下载。不是实际 FBXLoader 解码。 |
| `test:unfold` | 33 | 旧模式对应关系、精确端点、选择、导出和大型网格。 |
| `test:uv-worker` | 4 | 生产 UV handler 在 Node worker_threads；Map / TypedArray 转移、source/generated、错误、复杂输入。 |
| `test:parameterization` | 一套 10 断言回归 | 折角面 LSCM / Tutte、长度比例、翻面、重叠、退化、圆筒同岛长切缝。 |
| `test:atlas` | 6 个模型 + 排布/严格策略检查 | 每面覆盖、每岛有效、单位域、不同岛包围盒无交叠、面积比例、禁止补切时拒绝非盘。 |
| `test:hinge` | 17 | 刚性边长、铰链共点、真正平面网、单/多/全部、端点、反向、连续性。 |
| `test:uv-guards` | 11 | 无效设置、零面积拒绝、源网格不变、重叠坐标 UV 身份、曲面临时断边及平面网。 |
| `test:lab` | 21 | 实际离线 UI、WebGL2 像素、DPR 1/2、按钮、单/多/全、播放/反向、导出、真实浏览器 Worker、更换求解器、错误恢复、复杂结网。无跳过项。 |
| `test:unfold:browser` | 24 | 原生渲染器老回归；真实拾取 / 相机 / 90,112 面源 UV / 上下文恢复。两项 module Worker 检查显式跳过，不算通过。 |
| `test:layout` | 13 | 原生 CSS / canvas 布局回归，不运行 React。 |
| `test:git` | 22 | Git 维护工具、不可变旧 tag、脏工作树、版本校验等。 |

机器报告、数值日志、源文件语法检查范围位于 `docs/validation/v0.4.0/`。`atlas.json` 记录六个模型的真实面积利用率和岛数，不将较低数值隐藏，也不把包围盒面积当成 UV 面积。

## 离线实验页与主 Studio 的验证区别

`test:lab` 读取打包的 **同一个 `unfold-lab.html` 文件**，通过 CDP `Page.setDocumentContent` 加载完整 DOM 和内嵌脚本。实际构造 WebGL2、draw/readPixels、启动 Worker、求解并转移数据、操作真实 DOM 控件。它执行相同的求解与渲染源代码，不是截图替代、假的库或简化模型。

该环境策略阻止 file:// 导航，也阻止 about:blank 测试宿主中的 module Worker 加载。没有更改策略。离线页因此设计为自包含 classic Worker：TypeScript 仅把生产 Worker 的静态模块图转换为 CommonJS 工厂，直接打包进 blob，没有网络 import；该真实线程通过浏览器测试。主 Studio 的 Vite module Worker 加载尚未验证。Node Worker 成功也不能替代主 Studio 的 hook / Vite 生命周期测试。

截图 `docs/images/v0.4.0/` 来自实际离线实验页及当前 renderer，不是 React Studio 截图。它们证明该页面的实际效果，但不声称浏览器 file:// 导航已在此容器实测；用户正常浏览器的本地文件入口与 Node 本地服务入口均提供，macOS / Windows / Safari 尚待实机回归。

本次原生渲染测试命令：

```bash
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/lab-browser-smoke.mjs \
  --report /tmp/lab.json --screenshots /tmp/hinge
xvfb-run -a env CHROME_SOFTWARE_WEBGL=1 node scripts/unfold-browser-smoke.mjs \
  --skip-browser-worker --report /tmp/native-webgl.json
```

Xvfb 只是此 Linux 制作环境的测试需求，用户启动 Studio 不需要它。

## 尚未完成验证

完整 React/Vite 安装与页面联调、Vitest、全量 UI 类型检查、Vite 生产构建、真实 FBXLoader/glTF 导入、远端模型下载；主 Studio module Worker 的打包加载与 React hook 的取消时序。`npm run check:full` 仍是安装真实依赖后的完整入口，没有将未执行项算作通过。

生成 UV 在有限精度和阈值下验证，不是精确几何证明。LSCM 不保证任意网格都有效；回退/补切可以报错。原 UV 不修复。MaxRects 不保证全局最优利用率，当前不做凹多边形嵌套；刚性教学动画不保证过程无碰撞，UV 形变阶段不保长。没有加入 ARAP / SLIM / ABF++ / xatlas 运行库，也没有训练权重。

所有发布 tag 与干净工作区在最终打包时另外用 `npm run git:check -- --release v0.4.0` 及 `git fsck` 检查；不可将 tag 创建前的普通回归日志当作最终发布检查。
