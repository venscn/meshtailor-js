# GitHub 开源整理记录

整理日期：2026-10-08。基于 `v0.4.30` 继续维护，不创建新发布、不移动已有 tag。

## 清理范围

- 删除 `examples/generated-0.4.22/FlightHelmet-geometry-only.obj.gz` 的重复副本（2,832,832 字节）。它与 `examples/generated-0.4.23/FlightHelmet-before-fill.obj.gz` 逐字节相同；0.4.22 manifest 改为引用后者，输出文件名和校验值不变。
- 删除四份零字节、无引用报告：`validation/v0.4.22/install-output.txt`、`validation/v0.4.23/dependency-install.log`、`validation/v0.4.28/regressions/launch.txt`、`validation/v0.4.30/npm-install.txt`。这些文件没有执行输出，原有失败与环境限制仍保留在各版说明中。
- 删除两份无引用的同字节报告：`validation/v0.4.9/overlap-workbench-final-label.json`（保留 `overlap-workbench.json`）、`validation/v0.4.29/browser-pre-release.json`（保留 `browser-release.json`）。
- 合并逐版本的结果目录忽略规则。保留发布历史、原始夹具、历史实验脚本、失败记录和恢复证据。

去重后的恢复已执行 `node scripts/restore-structure-results.mjs` 和 `node scripts/restore-cavity-results.mjs`，全部输出通过 SHA256 校验。旧文件仍可从原提交/tag 取回。
