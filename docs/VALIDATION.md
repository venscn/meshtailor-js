# Validation — v0.4.12

日期：2026-09-16。上一版验证原样保存在 `VALIDATION-0.4.11.md`。本文件区分真实模型、生产Worker、离线WebGL、语法检查和完整React构建，不把一个范围的成功替代另一个。

## 正确模型、设置与对照

沿用唯一正确上传 `meshtailor-test-models(1).zip`，SHA256 `284decae81fda986f3c291bf4bebee473221b4eabe7078c65ed44adaf9ffb563`；四份glTF/bin已在 `examples/verified-models`，每次执行哈希检查。不读取旧错误压缩包，不下载替代模型。

运行：

```bash
npm run test:fill:real -- --out validation/local-fill-real
```

包装器调用原生产Worker回归：512格、4轮、8%面积步长、1.6倍面积上限、最多128次试装、90秒搜索预算，整体预算240秒，导出并重读所有面/UV。90秒是本轮测试预算，不是界面默认15秒。实际两者都在尝试预算停止，而不是用完90秒；不宣称全局最优。

| 项目 | Corset | FlightHelmet |
|---|---:|---:|
| 面数，全部保留 | 18,324 | 94,722 |
| UV岛：精排前→后→导出再读 | 79→79→79 | 130→130→130 |
| 有效几何面积占用：前→后 | 66.9154%→78.5223% | 62.4867%→71.6196% |
| 最大/最小平均面积密度比 | 1.1664 | 1.08 |
| 全图翻面/退化/正面积重叠 | 0/0/0 | 0/0/0 |
| 128次试装中接受 | 124 | 93 |
| 其中共同放大预试装 | 1 | 1 |
| 实际开始的逐岛轮数 | 2 | 1 |
| 精排及最终验证耗时 | 21.26秒 | 38.18秒 |
| 整条Worker流程耗时 | 25.79秒 | 80.78秒 |

证据在 `validation/v0.4.12/real-refined/*-source-atlas.json`。后续补充“有效配置”报告字段没有改变几何算法；最终ZIP复验单独记录。耗时可能受同机其他任务影响，不是独占机器或特定GPU基准。回归使用真实固定格式解码器 + 生产assembleMeshParts，不等于Three.GLTFLoader入口的完整认证。

## 独立导出检查

`independent-geometry.json` 使用独立Shapely2.1.2/GEOS，不调用本工程UV检查器：STRtree筛选所有三角面候选对，再计算真实多边形交集。Corset 117,370对、Helmet 653,573对，最大交集面积均0；`1e-14 UV²`容差下正面积重叠对0。所有面UV正向，0.003页边距满足；顶点、面、顺序与导入后的源OBJ逐元素一致。报告绑定实际导出OBJ的SHA256。

源JSON报告随工程；OBJ另在结果ZIP中，防止重复将大几何写进Git历史。可通过上面的命令重新导出，再用可选QA脚本：

```bash
python validation/v0.4.12/independent-geometry-check.py --root validation/local-fill-real
```

此独立QA需自行提供NumPy/Shapely，不是JS工程运行、测试或安装的必须依赖。

## 本轮测试

| 套件 | 结果/说明 | 证据 |
|---|---|---|
| 轮廓精排纯几何 | 23项通过；凹口44.68%→71.50%；共同密度、上限、失败回退、取消、边距、源不变 | `fill-unit.json` |
| 新功能真实浏览器 | 17项；实际按钮、生产Worker、连续两次填空、源不变、导出/动画目标一致、相机保留、全局超时回退 | `browser/fill.json` |
| 自由相机浏览器 | 39项 | `browser/camera.json` |
| 逐岛接力浏览器 | 28项 | `browser/relay.json` |
| 静止跳过浏览器 | 28项 | `browser/motion.json` |
| 两级选择浏览器 | 39项 | `browser/selection.json` |
| 原核心/装箱/分页/面积/源UV/合并/客户端/展开/铰链/时间线/选择/Worker | 12个独立脚本退出0 | `core/summary.txt`及各日志 |
| Git工具自身 | 22项 | `core/git.log` |
| 修改的TSX语法转译 | 无语法诊断；不是类型检查 | `environment/tsx-syntax-only.json` |

浏览器为真实Chromium软件WebGL，含真实鼠标事件和RAF；使用离线工作台与主工程共用生产模块。截图明确标记“合成验证片”，不是人台或头盔的外观图。

### 发现并修正的测试假设

初轮软件渲染的DPR2曾错过很短的双岛交接采样，使旧测试 `maximum===2` 失败；201点密集几何/调度检查仍明确出现2岛且不超过2。现在真实RAF检查观察到1–2岛，并必须访问全部6岛；完整区间的最大活动数由密集采样验证。播放基准延长后预期时长同步乘以秒数。没有修改播放算法来迎合测试。

选择测试曾假设120毫秒必然有新绘制帧。改为有3秒上限地等待实际进度增加，再继续检查未暂停、队列、面切换。初轮失败日志和一次调整测试时长时的预期乘数错误均保留在 `browser/initial/`，不抹去失败历史。

## 未通过或不在本次范围

- npm安装实际失败：`EAI_AGAIN registry.npmjs.org/@types/node`。`environment/npm-install.log`。
- 完整 `npm run build` 退出127，`vite: not found`。
- 完整 `npm run typecheck` 退出2，缺少Node类型定义。语法转译不能替代它。
- 未完成完整React/Three Studio主页面、GLTFLoader/FBX入口的端到端测试；未进行macOS/Windows/Safari实机认证。
- 不保证连续旋转全局最优、不保证填到100%、不替代裁切评审；没有实施自动二次切碎、自动贴图烘焙、多页精排或视角/语义重要性分析。

本轮实现的纯JS/TS运行不需要Python。Git版本检查和最终解压逐文件比对见外部最终交付验证报告；只有从最终ZIP实际再次执行的项目才标记为最终包复验。

### 与旧版实际OBJ逐面比较

另对随结果包提供的v0.4.11基线OBJ与新版OBJ逐面比较（`export-before-after.json`）：全部3D顶点、三角面索引/顺序相同；每个三角形UV面积均不缩小，三条边长度变化符合同一个相似变换尺度（最大误差低于1e-6）。不是只检查增益报告数字。本轮截图见 `images/fill-0.4.12.png`，显示首次有效精排后的合成凹口测试片。
