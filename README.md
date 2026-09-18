# MeshTailor-JS · 0.4.21

TypeScript/JavaScript 自动展 UV 工程。**当前生产路径只使用几何，不使用模型原有 UV、原切缝或原岛提示。** 默认加载、Generate baseline、Runtime 默认生成及 CLI 共用几何生成策略。

先读 [START_HERE.md](START_HERE.md)。直接打开 `unfold-lab.html` 可运行已有离线工作台；它内置无 UV 的正确服装人台和飞行头盔，不需要 npm 或网络下载。完整 React + Three.js Studio 用 `npm install`、`npm run dev` 启动；本轮主入口构建的限制请读发布说明，离线通过不等于全入口认证。

流程是空间结构分组、实际网格边上的开缝、保孔／自由边界参数化、全图验证、面积感知排布与可选轮廓填空。提供3D到UV铰链演示、面积顺序接力、倍速、统一动画时间的落位渐隐、自由相机、两级选择和框选、遮挡显示、实际任务进度与取消。

新修复在 [docs/releases/0.4.21.md](docs/releases/0.4.21.md)。本版先保留多孔闭合结构的可识别主面，再展开厚度与回折面，并对实际最终UV检查孔与边界。实际护目镜主面保留双孔；人台输出本轮不变，不宣称全部曲面已适合手绘。可复现测试和剩余限制在 `validation/v0.4.21/`。

```bash
npm run check:geometry
npm run test:geometry:real
npm run lab:build
npm run test:feature-sheets
npm run test:feature-sheets:browser
npm run git:check -- --release v0.4.21
```

无官方MeshTailor学习模型/权重，当前为独立几何算法；不承诺所有自由曲面得到人工语义最优裁片。UV改变后通常需重绘或烘焙贴图，本工程不做自动烘焙。历史文档和source-UV审计工具保留用于溯源，不再代表生产默认流程；不要运行旧源提示测试来替代新纯几何生成验收。
