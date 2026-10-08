# 文档索引

## 使用与协作

- [快速使用指南](../START_HERE.md)：离线工作台、Studio、CLI、参考输出。
- [导入格式](IMPORT-FORMATS.md)：OBJ / FBX / GLB / glTF 的实际范围。
- [贡献指南](../CONTRIBUTING.md)：开发检查、回归夹具与问题报告。
- [Git 工作流](GIT_WORKFLOW.md)：保留历史、小步提交与新发布。
- [资产来源与许可](../THIRD_PARTY_ASSETS.md)。

## 当前生成器

自 v0.4.20 起，生产生成只接受几何输入，不使用模型原 UV、原切缝或岛提示。

- [纯几何路径与约束](releases/0.4.20.md)。
- [连续结构与内在条片](releases/0.4.27.md)。
- [闭合管身与矩形条带](releases/0.4.28.md)。
- [完整环带与盖面边缘](releases/0.4.29.md)。
- [重复剖面与环件保孔](releases/0.4.30.md)：当前版本变化与形变取舍。
- [0.4.30 实际验证](../validation/v0.4.30/README.md)。

## 维护与历史

- [开源整理与当前验证](OPEN_SOURCE_PREPARATION.md)。
- [版本记录](../CHANGELOG.md)、[历史发布说明](releases/)。较早发布的说明文件为本目录的 `RELEASE-*.md`。
- [历史验证目录](../validation/README.md)。记录表示当次执行范围，不等于当前环境已重新执行。
- [早期架构背景](ARCHITECTURE.md)、[展开与 UV 背景](UNFOLDING_AND_UV.md)、[模型后端](MODEL_BACKEND.md)：包含原 UV 路径和研究接口的历史设计；以当前生产代码和 v0.4.20 之后的约束为准。
- [损坏交付包恢复记录](../REPACK-NOTES.md)与 [0.4.26 恢复边界](repack/RECOVERY-0.4.26.md)：保留来源、哈希与真实历史缺失说明。
