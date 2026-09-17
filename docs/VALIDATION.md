# v0.4.17 验证范围

本节只统计本轮实际执行；后文旧版本记录不是本轮新认证。

## 已执行

| 测试 | 实际结果 | 文件 |
|---|---|---|
| 结构模板核心 | 17 项通过：圆柱/正负锥度、单/双片、椭圆、旋转、非均匀角采样、错误轴、保护/取消及正确人台底圈 | `validation/v0.4.17/templates/report.json` |
| 模板流程与拓扑 | 12 项通过：两条无分支边路径、端点对应上下环、选区重展、保护锁、元数据不修改旧快照、载入清理选区 | `integration/report.json` |
| 真实离线工作台 | 10 项通过：正确人台生产 Worker、224面底圈两片→一片→两片、只重排保留结构、最终UV姿态、齿轮 | `browser/report.json` |
| 统一动画秒 / 倍速、倒放、暂停的 WebGL 像素测试 | 28 项通过 | `arrival-browser.json` |
| 手动相机真实浏览器操作 | 39 项通过，DPR1/2 | `camera-browser.json` |
| 其他核心回归 | 15 个脚本均退出0：核心、参数化、铰链、到达采样、方向、队列、静止、选择、框选、载入流程、缝合、源岛修复、源atlas、精排、细交叠 | `regressions/summary.json` 与逐项日志 |
| 正确原始模型生产 UV Worker | Corset 18,324面/97岛；FlightHelmet 94,722面/179岛。全部面保留、原输入不变、全图验证及OBJ重读通过 | `real/` |
| 独立导出几何验证 | 两份完整OBJ的正面积交叠均为0、绕序正、顶点与面顺序未变 | `independent-geometry.json`；Shapely只作额外QA，不是运行依赖 |

所有相对路径都在 `validation/v0.4.17/` 下。浏览器在Linux Chromium软件WebGL中执行，截图是实际产物，没有将设计图或合成片称作完整真实资产。人台底圈几何来自同一正确夹具的源#12；生产算法不读取模型名称/编号进行分类。

本轮普通整理：人台约3.57秒，头盔约61.0秒；是本环境单次记录，不是用户机器性能承诺。未执行额外多轮填空，不能将普通排布占用率与旧精排数字混比。

## 没有通过的检查

- `npm install --no-audit --no-fund` 在30秒上限终止，退出124，没有得到可用依赖；独立DNS检查为 `registry.npmjs.org → EAI_AGAIN`。
- **完整 `npm run build` 退出127，`vite: not found`。**
- **全量 `npm run typecheck` 退出2，缺少Node类型。**
- 修改的TSX做过TypeScript语法转译，无语法错误；不代表依赖解析、完整类型检查或React运行验证通过。
- FBX/通用glTF的Three导入器、完整React主入口、macOS/Windows/Safari实机未认证。固定真实夹具解码器不是GLTFLoader模拟替代品。

因此可确认生产UV、对应几何和共享离线渲染路径；不能宣称所有前端入口通过端到端测试。完整命令/退出码及环境见 `build.txt`、`typecheck.txt`、`npm-install.status`、`environment.json`。

## 发布

基于v0.4.16真实历史小步提交，新增独立附注v0.4.17，旧tag对象与指向保留。发布前从干净HEAD构建ZIP，包含.git和恢复bundle；最终ZIP会单独重新解压检查Git、跟踪文件内容及专项回归。不要将源码测试日志等同于包装验证。

---

# 历史验证记录（不计入本次测试）

