# 实际三叶结输出

执行 `npm run results:tubes`，校验并恢复到 `results/v0.4.28/`。

- `knot-v0.4.27-generated.obj`：修复前的自动生成结果，不是模型原 UV。
- `knot-single.obj`：新生产 Worker 输出，1 个完整矩形，纵横比约 20.4426:1。
- `knot-five.obj`：相同几何，主动指定 5 个横向分段，5 个矩形，普通单页占用约 76.9372%。

全部 9,216 面保持位置、索引、顺序不变。文件哈希见 `manifest.json`，独立几何检查见 `validation/v0.4.28/independent-tubes.json`。
需要原样查看请使用外部 UV 查看器；本工具导入文件会按要求忽略文件 UV 并重新生成，不能把恢复脚本用作源 UV 回退。
