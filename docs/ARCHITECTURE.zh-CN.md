[English](ARCHITECTURE.md) | [**简体中文**](ARCHITECTURE.zh-CN.md)

# 当前架构

MeshTailor-JS 在本机以浏览器 Studio、离线工作台或 OBJ CLI 运行，不需要业务 HTTP 后端或运维前端。Vite 与 `lab:serve` 提供前端文件，不负责生成任务或模型存储。

本文说明当前纯几何生产边界。[原始早期架构全文](ARCHITECTURE-HISTORICAL-0.1-0.3.md) 保留 v0.1–v0.3 的研究与原 UV 设计，供历史查阅。

## 应用与模块

| 位置 | 职责 |
| --- | --- |
| `apps/studio` | React/Vite 客户端；OBJ/FBX/GLB/glTF 导入适配、浏览器 Worker、控件、绘制、拾取与导出。 |
| `apps/unfold-lab` | 独立离线工作台源码，接受 OBJ 与内置网格。 |
| `apps/cli` | 本地 Node.js OBJ 检查、切缝/链 JSON 输出、生成 UV 的 OBJ 导出。 |
| `packages/mesh-core` | 几何类型、拓扑、OBJ/glTF 工具、输入隔离、样例与有边界的主动下载。 |
| `packages/chaining-seams` | 网格边链追踪、规范排序与序列化；历史原 UV 提取保留为研究/QA 工具。 |
| `packages/uv` | 几何驱动的分区/开缝、参数化、质量检查、排布、生成结果编辑与展开对应。 |
| `packages/runtime` | 几何 baseline 适配、惰性遍历/调试帧与研究候选遮罩。 |
| `packages/model` | 研究规范、训练样本工具和模型适配契约；生产生成不包含或使用学习权重。 |
| `packages/ui-platform` | 类型化英中消息、不可变展示偏好和满足对比度要求的昼夜调色板；不依赖几何或浏览器。 |
| `scripts` | 构建、Git 检查、聚焦回归、夹具工具与已分类的历史实验。 |
| `docs` / `validation` | 维护中的双语指南和按版本记录的设计/验证证据；保存的报告表示原执行范围。 |
| `unfold-lab.html` | 从源码用 `npm run lab:build` 重建的离线交付物。 |

Studio 与离线工作台共用 `packages/ui-platform`，各客户端负责自己的控件绑定与重绘生命周期。展示偏好不进入几何生成设置。已知界面文案和绘制标签提供双语；原始技术诊断与机器标识保留原文。CLI 保持稳定命令与机器可读输出。

## 生产流程

```text
本地导入 / 内置几何
  → geometryOnlyMesh（白名单位置、拓扑与几何元数据）
  → geometryGenerationOptions
  → unwrapMesh
  → 本次切缝 + 参数化/检查/排布后的面角 UV
  → UVSnapshot
  → 3D 预览 + UV 视图 + 拾取 + 新 UV 的 OBJ 导出
```

默认加载、Generate baseline 与 CLI 生成共用几何政策和生成器。模型原 UV 坐标、UV 索引、原切缝、原岛与恢复提示不能选择分区或指导自动生成。导入边界、Worker 传输和生成器入口分别执行白名单，不能先枚举整个输入 face 再删除 UV 字段。

glTF 工具移除原 `TEXCOORD_*`/`TANGENT` 属性引用和贴图依赖，保留几何、变换、蒙皮、morph 与轻量材质域身份；不宣称重写原二进制缓冲区中的未引用字节。材质身份是导入元数据，不是原 UV 布局提示。

缝合、重排、填空与模板编辑消费当前生成快照，不恢复模型原 UV。Worker 明确拒绝旧 `source` 与 `source-atlas` 目标。

## 依赖边界

```text
Studio ───────→ mesh-core / chaining-seams / runtime / uv / ui-platform
CLI ──────────→ mesh-core / chaining-seams / uv
runtime ──────→ mesh-core / chaining-seams / uv
uv ───────────→ mesh-core / chaining-seams
chaining-seams → mesh-core
model ────────→ mesh-core / chaining-seams / runtime（研究）
mesh-core ────→ 不依赖其他项目包
ui-platform ──→ 不依赖其他项目包
```

每个工作区声明直接内部导入，包括纯类型导入。跨工作区消费者通过包入口访问，不用相对路径深入其他包的 `src`。生产几何包不导入 React、DOM 控件、客户端偏好或应用实现。

离线工作台目前通过本地打包器复用 Studio 的 Worker、绘制模块与 CSS，避免重复生成器；这些源码路径仍是真实耦合，移动时必须同时更新离线构建与回归。提取共享协议与绘制政策必须有具体消费者并保留行为。

`MeshTailorBackend` 是研究推理适配器，不是 Web 服务。候选遮罩、从现有 UV 提取的训练标签与旧原布局工具不定义生产生成路径。

## 任务与展示

Studio 的 `useUVSnapshot` 负责取消任务和拒绝过时结果。`startUVJob` 构造纯几何输入，执行启动与实际时间限制，在取消时终止忙碌 Worker。返回的一个快照包含已排布面角 UV、实际切缝、对应几何、警告与诊断。

UV 绘制、当前变形 3D 拾取和导出消费同一快照。播放不会改变求解器切缝集或静默重排目标。展开是对应关系的确定性可视化，中间状态可能交叠，不是布料仿真或零形变证明。

遍历帧与惰性边历史访问器留在客户端；通过 Worker 结构克隆传输会提前实体化历史。浏览器导入器和绘制器拥有 Three.js/WebGL 资源，并在生命周期边界释放。

展示偏好使用独立版本化存储键和不可变订阅快照；React 与原生 DOM 控件消费同一语言/主题状态。Canvas 和 WebGL 根据共享色板重绘，不改变几何、对应关系、岛身份颜色、相机、选择或求解配置。存储损坏或被禁止时采用安全会话默认值。窄屏与短屏通过滚动访问控件，绘制缓冲区随宿主尺寸和有上限的设备像素比调整。

## 维护与检查

注释解释不变量、归属、约束与决策。领域算法与 UI 文字、主题 token 保持独立。区分当前行为和历史实验，保留发布 tag 与原始证据。

- 导入/包声明：依赖审计、`npm run typecheck`、Studio 构建与受影响的 CLI 行为。
- 生成策略：`npm run check:geometry`，并对两份固定真实模型执行原/缺失/随机 UV 三变体，比较全部切缝和面角坐标。
- 共享 Worker/绘制/工作台源码：重建离线 HTML，并执行相关浏览器回归。
- 语言/主题/布局：在两种语言/主题、代表性窄屏/短屏及同页动态 resize 下，检查真实控件与 Canvas/WebGL。

旧原 UV 套件保留原断言与分类，不能作为纯几何生成器验收。避免只重复静态常量或镜像实现代码的测试。

参见[贡献指南](../CONTRIBUTING.zh-CN.md)、[Git 工作流](GIT_WORKFLOW.zh-CN.md)与[文档索引](README.zh-CN.md)。[早期展开/UV 说明](UNFOLDING_AND_UV.md)与[模型适配说明](MODEL_BACKEND.md)保留历史算法/研究范围。
