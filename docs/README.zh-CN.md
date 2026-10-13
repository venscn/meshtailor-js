[English](README.md) | [**简体中文**](README.zh-CN.md)

# 文档索引

## 使用与协作

- [快速使用指南](../START_HERE.zh-CN.md)：离线工作台、Studio、CLI、参考输出。
- [当前架构与模块边界](ARCHITECTURE.zh-CN.md)：客户端、离线工作台与 CLI 的本地职责。
- [导入格式](IMPORT-FORMATS.zh-CN.md)：OBJ / FBX / GLB / glTF 的实际范围。
- [贡献指南](../CONTRIBUTING.zh-CN.md)：开发检查、回归夹具与问题报告。
- [Git 工作流](GIT_WORKFLOW.zh-CN.md)：保留历史、小步提交与新发布。
- [持续维护](MAINTENANCE.zh-CN.md)：周期审计、自然合批与推送确认。
- [测试分类](TESTING.zh-CN.md)：现行验收、离线 QA 与历史试验。
- [资产来源与许可](../THIRD_PARTY_ASSETS.zh-CN.md)。

## 当前生成器

自 v0.4.20 起，生产生成只接受几何输入，不使用模型原 UV、原切缝或岛提示。

- [纯几何路径与约束](releases/0.4.20.md)。
- [连续结构与内在条片](releases/0.4.27.md)。
- [闭合管身与矩形条带](releases/0.4.28.md)。
- [完整环带与盖面边缘](releases/0.4.29.md)。
- [重复剖面与环件保孔](releases/0.4.30.md)：当前版本变化与形变取舍。
- [0.4.30 实际验证](../validation/v0.4.30/README.md)。

## 维护与历史

- [10 月 13 日本地维护审计](audits/2026-10-13.zh-CN.md)：完成批次、展示/resize 证据和待修的浏览器套件基线；[English](audits/2026-10-13.md)。

- [开源整理与当前验证](OPEN_SOURCE_PREPARATION.md)。
- [版本记录](../CHANGELOG.md)、[历史发布说明](releases/)。较早发布的说明文件为本目录的 `RELEASE-*.md`。
- [历史验证目录](../validation/README.md)。记录表示当次执行范围，不等于当前环境已重新执行。
- [原始早期架构全文](ARCHITECTURE-HISTORICAL-0.1-0.3.md)、[展开与 UV 背景](UNFOLDING_AND_UV.md)、[研究模型适配](MODEL_BACKEND.md)：包含原 UV 路径和研究接口的历史设计；以[当前架构](ARCHITECTURE.zh-CN.md)、生产代码和 v0.4.20 之后的约束为准。
- [损坏交付包恢复记录](../REPACK-NOTES.md)与 [0.4.26 恢复边界](repack/RECOVERY-0.4.26.md)：保留来源、哈希与真实历史缺失说明。

## 双语文档

使用指南、架构说明、贡献指南、导入格式、Git 工作流、资产说明、固定夹具说明和 [许可指南](LICENSING.zh-CN.md) 均有英中版本。当前版本另有 [英文发布摘要](releases/0.4.30.en.md)，完整原始说明保留中文。历史发布、原始日志与单次实验不批量翻译；维护双语入口时同步内容与相对链接。应用界面语言与文档语言独立。
