# v0.4.18 测量索引

`summary.json`：从实际四条生产报告提取的组/岛/源提示计数。

`real/`：新分组默认（允许有效源形状提示）人台/头盔的输入记录、报告、可复测快照和导出OBJ。`geometry-only/`：关闭源UV提示；解析结构候选仍可使用，不能说所有模板都关闭。

`tests/peel.json` 的额外通用合成组才是同时关闭源提示和结构模板。它包含多个非人体曲面，不用模型名字决策。

`fill/`：从新默认形状512格/60秒继续填空。`refill/`：仅头盔由fill结果以1024格/90秒续排；需要重现续排的可程序化快照，可重新执行脚本生成，未重复打包大型中间快照。当前最终OBJ都可导入后“原样检查”直接查看。

`qa-*.json`：7份实际OBJ的额外GEOS/Shapely校验，与文件SHA256绑定；Python/NumPy/Shapely只用于QA。

`comparison/`：相同旧v0.4.17形状、相同30秒、旧/新填空单次对照，近似持平略低。不能把不同初始形状/预算的数字混在一起比较，未宣称统计显著。

`browser/`：真实Chromium工作台10项交互、正确人台和齿轮截图。拍摄大模型关闭叠层诊断；不是完整React或GPU性能认证。

`camera-browser.json` / `arrival-browser.json`：39/28项已有交互与像素回归。

`environment/`：npm DNS失败、build失败、全量typecheck失败的实际日志。

`regressions/`：其它专项的实际输出。早期名字猜错而不存在的脚本标为missing-script-not-run，不计通过；随后实际对应脚本单列。

所有耗时为本机单次记录，搜索后还有最终质量检查。输入数据保持正确夹具哈希，未读旧错误模型ZIP。完整说明见 ../../docs/RELEASE-0.4.18.md。
