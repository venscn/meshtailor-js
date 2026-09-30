# v0.4.28 实际验证

## 已完成

- `unit/report.json`：21项闭合管身/矩形生成、变体和拒绝测试。
- `worker/report.json`：8项真实生产Worker测试，含原UV/无UV/随机UV相同、5段、postprocess、一次性自动填空、OBJ重读。
- `browser/report.json`：11项真实DOM、生产Worker、Chromium软件WebGL流程。`single-strip.png`、`five-strips.png`来自该次运行，不是设计图。
- `real/report.json`：正确人台/头盔共6条原UV/无UV/随机UV生成。切线/角坐标/OBJ一致，全部源面保留；两模型输出分别与v0.4.27原交付SHA256相同，未把数字相同当成新改善。
- `independent-tubes.json`：Shapely/GEOS对两个实际Worker导出OBJ逐三角形求交，正面积重叠0、绕序正确、源3D位置和面序一致；阈值1e-14 UV²。
- `core.json`：21项严格核心回归。
- `regressions/status.txt`：13个旧专项命令全部返回0（几何输入/边界/候选/拓扑/策略、纵向片、表面反射、度量、对称片、完整结构、松弛、面积放大、Git工具）。每个实际日志另存为txt。

## 如实记录的失败和限制

首轮工作台测试发现新增Inspector没有挂载到HTML中的实际div，初始化抛出空引用。已独立提交修复并从头完成11项流程；原失败保存在 `browser-first-failure.json`。

第二次组合前台执行受到外部命令时限中断，没有被计为完整通过。之后使用独立后台进程完成整个同一浏览器脚本，保留每项断言，播放阶段关闭背景/诊断减少软件GL负担。未将缺失帧的部分执行算作成功。

`full-build.txt`：实际 `npm run build` 退出127，缺vite。
`full-typecheck.txt`：实际 `npm run typecheck` 退出2，缺Node类型。
这不影响已独立使用全局TypeScript通过的核心/Worker严格编译，但不代表完整React/Vite/Three入口通过。没有本地硬件GPU、macOS/Windows/Safari流畅性认证。

新功能只处理完整且可几何验证的周期截面族，不覆盖任意重网格或分叉管。没有宣称整模型所有UV都符合人工语义目标。动画仍是对应关系演示，不是无碰撞物理剥皮模拟。

## 复现

```bash
npm run test:tube-strips -- --out validation/local-tubes
npm run test:tube-strips:worker -- --out validation/local-tube-worker
npm run lab:build
npm run test:tube-strips:browser -- --out validation/local-tube-browser
npm run test:geometry:real -- --out validation/local-real
npm run results:tubes
```

不使用当前“原UV”作为运行种子。Python只用于独立导出QA；运行工程本身仍是JS/TS。

最终ZIP重新解压后的复跑范围、实际字节数/哈希/HEAD和检查结果在随ZIP交付的`meshtailor-js-0.4.28-verification.md`，不预先把这里的打包前结果冒称已从ZIP复跑。
