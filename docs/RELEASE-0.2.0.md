# MeshTailor-JS 0.2.0 — 复杂网格与 FBX

## 交付内容

基于 0.1.1 增量开发，保留 traversal 的 DPI / renderer 生命周期修复。新增四类离线复杂网格，每类三档密度；Medium OBJ 已写入 ZIP。随包还有低密度褶皱网格的 FBX 7.4 ASCII/Binary 文件，用于导入回归。

浏览器加入 FBX 导入，并统一 FBX/glTF 的世界变换、多对象、负缩放、初始皮肤/形变姿态和逐角 UV 流程。新增 Exact/Tolerance/Off 拓扑焊接与导入报告；OBJ 原有 UV 索引逻辑保留。仅导入静态几何，不提供动画播放器、材质展示或 FBX 导出。

增加 Corset / Flight Helmet 两个有模型级许可记录的 CC0 在线入口，以及 `npm run assets:download` 缓存脚本。网络二进制未在制作环境下载成功；ZIP 不包含它们。四类程序网格与两种 FBX fixture 则实际随包。

接缝与 UV 计算进入可取消 Worker，减少重复拓扑构造和历史复制，限制时间线 DOM，增加可配置 baseline 边预算。新增状态和错误信息不再挤压 3D 视口。

## 启动与验证

```bash
npm install
npm run dev
```

顶栏版本应为 `Studio · 0.2.0`。先用 **复杂样例 · Offline → Medium → Load complex mesh**，再 **Generate baseline**。通过 **FBX ASCII / FBX Binary** 或文件上传验证本机导入路径。

已执行：21 项核心/视图数学测试，40 项几何/资产/文件结构测试，11 项原生 Chromium 画布布局测试。真实 FBXLoader、完整 React/Three.js 页面、Vite 构建因 npm 依赖无法下载而未完成验证；详情和原始报告见 `docs/VALIDATION.md`。新代码已分步 Git 提交，发布包含可恢复历史。

## 非本次实现

未训练或提供神经网络权重；没有把 baseline 说成论文 learned model。UV 保持 planar debug preview，不是 ABF++。未实现任意复杂输入的自动修复、自动减面或制造级缝纫展开。FBX 同步解析尚未 Worker 化。
