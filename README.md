# MeshTailor-JS · 0.4.23

TypeScript / JavaScript 自动展 UV 工程。先读 [START_HERE.md](START_HERE.md)，本轮改动与实际结果见 [v0.4.23 发布说明](docs/releases/0.4.23.md)。

**生产生成只使用几何，不读取模型原 UV、原切线、原岛划分或恢复提示。** 默认载入和 Generate baseline 使用同一流程。已有原始夹具只供 UV 隔离与参考审计，不是生成回退。

```bash
# 离线工作台，无需下载前端依赖
node scripts/serve-unfold-lab.mjs
# 或直接打开 unfold-lab.html

# 完整 Studio（需要安装真实依赖）
npm install
npm run dev
```

空间分组、真实网格边开缝、保孔与自由边界展开、面积感知排布、可选多轮空洞精排。保留面积优先的逐岛接力、倍速、随动画时间的落位亮显/渐隐、自由相机、框选、先岛后面的两级选择及重叠显示。

```bash
npm run check:geometry
npm run test:longitudinal-budget
npm run test:raster-window
npm run test:cavity-fill
npm run test:cavity-load
npm run test:seams-fill:real
npm run lab:build
npm run test:cavity-fill:browser
npm run results:restore
npm run git:check -- --release v0.4.23
```

实际执行记录在 `validation/v0.4.23/`。核心 TypeScript、生产 Worker、正确模型及离线 WebGL 已执行；完整 React/Vite 主入口在制作环境未构建成功，不能将离线测试当作完整入口认证。旧 source-UV 测试是历史审计，不应作为当前生产路径的验收命令。

没有官方 MeshTailor 学习权重。几何方法不保证任意曲面的语义最优版型或全局最密排布。新 UV 需要相应重绘/烘焙贴图；本项目不自动烘焙。完整 Git 历史和旧 tag 保留，恢复历史的边界仍见 `REPACK-NOTES.md`。
