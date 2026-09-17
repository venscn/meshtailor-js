# 齿轮默认源整理对照

`gear-before.obj` 保留内置 Low 齿轮原来的一张矩形 UV。
`gear-after.obj` 是 v0.4.19 默认 source-atlas 路径的实际6岛结果，含两个完整齿形带孔平面。

导入后使用“原样检查”看这两份数据本身；“Extract + 整理”会再次求解，不适合用来检查已导出的快照。源3D顶点和面序一致，未附贴图。

复现：`npm run test:source-features -- --out validation/local-source-features`。需要本机 Node/TypeScript。
