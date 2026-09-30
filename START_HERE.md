# MeshTailor-JS 0.4.30

解压到新目录，直接打开 **unfold-lab.html**。浏览器限制本地Worker时执行：

```bash
node scripts/serve-unfold-lab.mjs
```

## 修复的现象

机械件的直壁＋两端倒角沿周向具有完全重复的剖面，旧自由边界LSCM却将它拉成一边粗、一边细。现在先从几何恢复剖面，按真实剖面度量展开为**等宽矩形**。Medium中央孔壁长宽比约8.122:1，全部2,304面保留；缝合、重排和填空不能再把它拉歪。

同时，正确人台的三个288面浅径向环件优先保留内孔，成为**完整环形**而不是先开径向缝。保孔具有形变取舍，不表示任意曲面都能无拉伸展开。

## 开关

**UV → 结构模板 → 重复剖面度量展开（等宽侧壁 / 保孔环件）**：默认开启。

保持“手绘轮廓优先＋自动”，重新加载模型或点击Generate baseline。更改设置本身不会覆盖已有结果。Inspector会显示实际方法、层数、长宽和方向拉伸，不需要用隐藏预设。

关闭该项是显式旧算法对照；生成始终不使用模型原UV。

## 离线参考结果

```bash
npm run results:profiles
```

在 `results/v0.4.30/` 恢复机械件关闭剖面选项、开启选项和正确人台的新图。使用外部UV查看器比较精确坐标；本工具导入OBJ后会按要求忽略原UV重新生成。没有贴图，布局改变需要重绘或烘焙。

## 验证

```bash
npm run test:revolved-profile
npm run test:revolved-profile:worker
npm run lab:build
npm run test:revolved-profile:browser
```

新度量、角点/切口检查、生产Worker、真实模型UV隔离与离线浏览器已经执行；结果、失败记录及范围见 `validation/v0.4.30/README.md`。最终ZIP独立解压验收见随下载提供的验收报告。

完整Studio仍为 `npm install`、`npm run dev`。制作环境npm安装在25秒限制内未完成，实际主构建缺Vite，全量类型检查缺Node类型；已通过的严格核心编译/Worker/WebGL不等于完整React或通用FBX/GLTF导入认证。

识别针对完整圆周剖面族，不保证缺失截面边、偏心或分叉的任意网格都得到矩形；不能为了轮廓好看破坏真实齿形和褶皱。本版不修改填空算法或动画时钟。详见 `docs/releases/0.4.30.md`。
