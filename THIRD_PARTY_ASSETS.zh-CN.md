[English](THIRD_PARTY_ASSETS.md) | [**简体中文**](THIRD_PARTY_ASSETS.zh-CN.md)

# 资产来源与许可证

最后核对：2026-10-08。根目录 [MIT License](LICENSE) 适用于工程代码与本项目自制资产；第三方模型沿用其原始许可。

## 本项目自制资产

`examples/complex/*.obj`、基础几何示例以及 `apps/studio/public/assets/fixtures/garment-*.fbx` 由本项目生成，采用 MIT 许可。生成命令为 `npm run assets:generate`，文件身份见 [examples/manifest.json](examples/manifest.json)。FBX 写入器仅用于合成测试夹具，不是通用导出器。

README 中的机械件截图来自本项目合成几何和真实工作台，不是 MeshTailor 论文训练数据。

## 仓库内包含的第三方模型

| 模型 | 原作者与分发来源 | 模型资产许可 | 上游说明 |
| --- | --- | --- | --- |
| Corset | Microsoft / UX3D；KhronosGroup 分发 | CC0-1.0 | [来源](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Corset) · [许可](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Corset/LICENSE.md) |
| Flight Helmet | 原公开模型 / Gary Hsu 的 Maya 转换；KhronosGroup 分发 | CC0-1.0 | [来源](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/FlightHelmet) · [许可](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/FlightHelmet/LICENSE.md) |

这些模型已经包含在仓库中，位置如下：

- `examples/verified-models/`：固定版本的 `.gltf` 和 `.bin` 回归夹具，未附贴图。文件校验值见 [夹具说明](examples/verified-models/README.zh-CN.md)。
- `apps/studio/public/assets/verified/`：由上述夹具生成的几何 `.glb`、压缩几何 JSON 和 [manifest](apps/studio/public/assets/verified/manifest.json)。移除了原 UV 与材质/贴图引用，供默认载入使用。
- `unfold-lab.html`：包含相同几何的离线工作台。
- `examples/generated-*/`、`examples/human-uv/`：部分参考输出保留这些模型的几何并加入生成的 UV；工程生成过程不改变原模型资产的许可。
- `validation/` 与 `docs/images/`：可能包含这些模型在本工具中的截图和诊断。

上游将模型相关文件列为 CC0-1.0，将许可说明等元数据列为 CC-BY-4.0，并排除标志和商标。这里提供原创来源摘要和上游链接，没有将上游元数据文件重新标为 MIT。

夹具使用哈希锁定的既有文件；不要用上游 `main` 的新内容覆盖它们。几何预处理可用 `npm run assets:geometry` 重现。

## 可选联网下载

`npm run assets:download` 从相同上游获取模型，移除材质/贴图引用后生成几何 GLB。下载由用户主动触发，不是启动依赖；来源、作者、许可、修改、时间和 SHA256 写入伴随记录。`main` 分支内容可能变化，下载结果与固定回归夹具分别管理。

## 依赖代码

React、Three.js、Vite 等通过 npm 安装，保留各自上游许可。FBXLoader / GLTFLoader 来自 Three.js 依赖；仓库没有打包 Autodesk SDK、神经网络权重或第三方字体。README SVG 使用系统字体。

MIT 的适用范围和再分发说明见 [许可指南](docs/LICENSING.zh-CN.md)。
