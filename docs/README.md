[**English**](README.md) | [简体中文](README.zh-CN.md)

# Documentation

## User and contributor guides

| Guide | English | 简体中文 |
| --- | --- | --- |
| Getting started | [User guide](../START_HERE.md) | [使用指南](../START_HERE.zh-CN.md) |
| Import formats | [Formats and geometry](IMPORT-FORMATS.md) | [导入格式](IMPORT-FORMATS.zh-CN.md) |
| Contributing | [Contribution guide](../CONTRIBUTING.md) | [贡献指南](../CONTRIBUTING.zh-CN.md) |
| Git workflow | [History and releases](GIT_WORKFLOW.md) | [Git 工作流](GIT_WORKFLOW.zh-CN.md) |
| Licensing | [MIT scope](LICENSING.md) | [许可范围](LICENSING.zh-CN.md) |
| Asset provenance | [Sources and licenses](../THIRD_PARTY_ASSETS.md) | [资产说明](../THIRD_PARTY_ASSETS.zh-CN.md) |
| Pinned fixtures | [Fixture guide](../examples/verified-models/README.md) | [固定夹具](../examples/verified-models/README.zh-CN.md) |

## Current generator

Since v0.4.20, production generation accepts geometry only. It does not use imported UVs, original seams, or source-island hints.

- [v0.4.30 English summary](releases/0.4.30.en.md): repeated-profile rectangles, hole-preserving annuli, and distortion tradeoffs.
- [v0.4.30 full release note (Chinese)](releases/0.4.30.md) and [actual validation record (Chinese)](../validation/v0.4.30/README.md).
- Earlier algorithm notes, in their original Chinese: [geometry-only input](releases/0.4.20.md), [continuous structures](releases/0.4.27.md), [closed tube strips](releases/0.4.28.md), and [intact bands and cap rims](releases/0.4.29.md).

## Maintenance and historical records

- [Open-source preparation and validation (Chinese)](OPEN_SOURCE_PREPARATION.md).
- [Changelog](../CHANGELOG.md) and [release notes](releases/) retain their original English/Chinese entries. Earlier release notes are `RELEASE-*.md` in this directory.
- [Validation archive (Chinese)](../validation/README.md): a report describes its original run, not a fresh test in your environment.
- [Early architecture](ARCHITECTURE.md), [UV/unfolding background](UNFOLDING_AND_UV.md), and [model backend](MODEL_BACKEND.md) contain historical source-UV paths and research interfaces. Current production code and the geometry-only constraints introduced in v0.4.20 take precedence.
- [Damaged-package recovery (Chinese)](../REPACK-NOTES.md) and [v0.4.26 recovery boundaries (Chinese)](repack/RECOVERY-0.4.26.md) preserve source hashes and the limits of recoverable history.

## Language coverage

Maintained entry guides above have English and Chinese counterparts. Historical releases, raw logs, and one-off experiments retain their original language and bytes; English summaries are labeled as summaries. When updating a bilingual guide, update its counterpart and check relative links in both directions. Application UI language is independent of documentation language.
