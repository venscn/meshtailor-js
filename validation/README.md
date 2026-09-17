# 验证记录与可再生成的文件

本次重新打包保留小型验证报告；重复的历史 OBJ、完整几何 JSON 和历史截图不再直接携带在工作目录中。之前已经提交的文件仍可通过原 Git tag 获取，没有重写历史。大文件清单见 `docs/repack/CLEANUP.json`。

最新可直接查看的结果在 `results/v0.4.18/`，原始正确模型在 `examples/verified-models/`。这些删减不影响 Studio 或离线工作台运行。

部分专项 QA 脚本需要先生成中间快照，它们不是应用运行依赖。不要把历史路径缺少中间产物解释为模型缺失。在运行有关脚本前执行：

```bash
# 生成通用剥展结果/中间快照，供 test:peel:browser、test:peel:fill 使用
npm run test:peel:real -- --out validation/v0.4.18/real

# 可选：结构模板旧 QA 需要的中间输入
node scripts/verified-models-smoke.mjs --models examples/verified-models --asset Corset --mode source-atlas --out validation/v0.4.17/real --snapshots

# 旧版截图/重切候选 QA 默认用 v0.4.13 的整理结果；需要时从原 tag 取回
# git show v0.4.17:validation/v0.4.13/real-adaptive/Corset-organized.obj > <自选输出路径>
# 或向这些 QA 脚本传 --model / --results 指定新的结果，不应冒充同一版型的对照。
```

完整主 Studio 的 React/Vite 构建与本次压缩包完整性验证是两回事。本次没有重跑完整 UI 构建；此前主入口未认证的限制仍然有效。当前新执行记录见 `docs/repack/TESTS.json`。
