# MeshTailor-JS v0.4.19 · 从这里开始

## 修复的是你实际点击的入口

内置齿轮自带一张有效但严重扭曲轮廓的矩形原 UV。旧版“标准整理 / 自动来源”走 `source-atlas`，保留了它；重新生成路径的齿形测试通过，不能证明默认载入也通过。本版在默认载入和 **Extract + 整理原 UV** 中增加独立的原 UV 轮廓检查。

**不必改用隐藏的新预设。** 使用“标准整理”或“整理＋填空”，UV 目标保持“手绘轮廓优先”、求解器“自动”，重新载入内置齿轮，或者点击“Extract + 整理原 UV”。默认得到 **6 岛：2 个保留完整齿形和中心孔的正反面，以及 4 个侧面/过渡面组**。侧壁自身仍可能适合带状/矩形展开，不再把整件齿轮揉成一张矩形。

你已经保存的“原样检查”或“少岛稳健”设置不会被悄悄替换。“原样检查”仍然显示原矩形，这是对照，不是已整理结果。显式关闭自动切割或轮廓检查也会保留旧取舍。

## 查看结果与检测记录

- `examples/source-feature-uv/gear-before.obj`：原样矩形 UV 对照。
- `examples/source-feature-uv/gear-after.obj`：当前默认整理的实际结果。
- 查看已导出的 OBJ 时使用 **原样检查**，避免为了查看而再次求解。
- 流程面板新增“原 UV 可辨识性 · 主要轮廓与孔洞检查”，记录实际执行/跳过状态。
- UV 设置中“整理原 UV 时检查主要轮廓与孔洞”默认开启，可查看检测到的特征、被修复的原岛及最终对应；不是只有一行泛化成功提示。

`unfold-lab.html` 是无需前端依赖的离线工作台。浏览器限制 file URL 时运行：

```bash
node scripts/serve-unfold-lab.mjs
```

完整 Studio：

```bash
npm install
npm run dev
```

## 验证入口

```bash
npm run test:source-features
npm run lab:build
npm run test:source-features:browser
npm run git:check -- --release v0.4.19
```

核心测试使用本机 Node.js 22.16+、TypeScript；浏览器回归需要 Chrome/Chromium。软件渲染环境可显式设置 `CHROME_SOFTWARE_WEBGL=1`，普通本机不要求这样设置。

**已通过的浏览器测试来自共用生产 Worker/WebGL 的离线工作台；完整 React/Vite 主入口仍未完成构建认证。** 构建尝试与具体未通过项见 `docs/VALIDATION.md`。没有将 TSX 语法转译或离线测试冒充完整主界面联调。

## 范围与 Git

本版不是识别模型名称后替换成预制 UV；对旋转/缩放/改名的网格、非齿轮异形带孔面板也运行同样的几何检查。它优先纠正可验证的主要平面轮廓/孔洞，不保证任意自由曲面的语义可读性。不会通过检测 UV 外形“像矩形/圆形”就判它错误。填空仍有预算与布局限制，本版不宣称提高纹理利用率。改变 UV 后需要重绘/烘焙贴图。

保留 `.git/` 的真实历史与旧 tag；基于 `repack-0.4.18-2` 小步开发，新增 `v0.4.19`。原 v0.4.18 缺失的开发提交仍不能恢复，不补造同名 tag。`REPACK-NOTES.md` 是之前的恢复记录；本次变更见 `docs/RELEASE-0.4.19.md`。不重复附 bundle，不含 node_modules、缓存和本轮大型几何快照。
