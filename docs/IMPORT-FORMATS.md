# 导入格式与几何重建

当前生产导入路径自 v0.4.20 起忽略原 UV，生成只使用几何。

| 入口 | 接受格式 | 伴随文件 |
| --- | --- | --- |
| Studio | OBJ、FBX ASCII / Binary、GLB、glTF | glTF 需同时选择对应 `.bin` |
| 离线工作台 | OBJ 与内置几何示例 | 不读取 MTL / 贴图 |
| CLI | OBJ | 不读取 MTL / 贴图 |

每次选择一个主模型；glTF 与其多个几何缓冲可一起选择。材质与贴图不显示，不配置 Draco / Meshopt 解码器，推荐未压缩 GLB 或 FBX 7.4 / 7.5 Binary。

## 导入器

OBJ 使用工程内的解析器；生产导入随后通过白名单构造纯几何。FBX 使用 Three.js FBXLoader，GLB / glTF 使用 Three.js GLTFLoader；glTF 在解码前移除材质、贴图与原 UV 属性。

FBXLoader 的官方格式范围是 ASCII 7.0+ / Binary 6400+，不代表本仓库测试了所有导出器组合。参见 [Three.js 文档](https://threejs.org/docs/pages/FBXLoader.html)。

## 几何与连接性

场景适配器提取可见网格及其世界/实例变换，在初始加载姿态采样蒙皮和 morph 几何。负缩放修正三角面绕序；不播放导入动画，也不保留场景层级为编辑结构。

几何焊接限定在同一源对象/实例内，不跨对象合并重叠部件。默认采用边界焊接；还提供精确、容差和关闭模式。坐标焊接可能连接有意重合的独立表面，应按模型选择策略。焊接后退化面会被丢弃并记录；这不是通用网格修复。

场景适配器不请求 UV 属性，输出报告的 `uvFaces` 为 0。材质/对象身份可作为几何元数据保留，但原 UV 坐标、索引、切缝和岛划分不进入生成。

默认输入限制为 300,000 个三角面、源顶点数不超过该预算的三倍，以及主文件不超过 256 MiB。限制不能保证任意压缩输入的解析内存有界。

## 资源与取消

FBX 贴图请求返回占位材质，避免缺失本地图片导致导入失败；glTF 在解码前移除材质/图片引用。提取完毕后释放原场景资源。

FBXLoader 解析在主线程同步执行，尚不能中途取消。Worker 计算和可选下载可取消；任务序号拒绝过时结果。

## 回归验证

`apps/studio/public/assets/fixtures/garment-ascii.fbx` 与 `garment-binary.fbx` 是本项目生成的低密度褶皱夹具，文件身份见 [manifest](../examples/manifest.json)。写入器仅用于回归，不是通用 FBX 导出器。

```bash
npm run test:imports
```

2026-10-08 已执行真实 Three.js 集成测试：两种 FBX 夹具、世界变换、镜像绕序、对象隔离、蒙皮 / morph、实例、GLB / glTF 伴随缓冲及原 UV 属性隔离均通过。此范围不等于任意第三方 FBX 兼容认证；当前完整验证与环境限制见 [开源整理记录](OPEN_SOURCE_PREPARATION.md)。
