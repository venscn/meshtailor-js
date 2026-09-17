# v0.4.19 · 本轮实际验证范围

本节只计入本次执行。历史记录在后面，不能当作本次通过。最终 ZIP 的解压验收另附下载校验报告。

| 检查 | 结果 | 当前记录 |
|---|---|---|
| 严格核心/Worker TypeScript 编译 | 通过；不包含完整 React TSX 依赖树 | 新/旧 smoke 每次实际编译 |
| 新 source-atlas 特征回归 | 20项通过；Low/Medium/High齿轮、任意改名/旋转/缩放、非齿轮、独立孔板、正确矩形、默认/Extract/手动重排区别、全覆盖、OBJ重读 | `validation/v0.4.19/source-features/report.json` |
| 实际默认流程的浏览器测试 | 11项通过；生产Worker、默认载入source-atlas、原样检查、Extract、保留组边界的缝合/重排/填空、选择和相机 | `validation/v0.4.19/browser/report.json` |
| 旧算法/行为回归 | 23个专项命令全部退出0；包括通用分组、结构模板、源修复、保形、面积保护、选择、框选、队列/倍速、到达状态 | `validation/v0.4.19/regressions/index.json`及各stdout |
| 上项内的真实浏览器回归 | 流程16项、手动相机39项、动画时间轴像素28项、先岛后面与交互39项通过；不是另外重复累计的测试 | 对应`*-browser.txt` |
| 正确Corset/FlightHelmet | source-atlas开启/关闭本检查各运行一次；两个模型全部源面保留、有效性和导出重读通过，输出逐字节相同 | `validation/v0.4.19/real/summary.json` |
| 独立GEOS/Shapely检查实际OBJ | 低齿轮、人台、头盔的正面积重叠均0；源3D与面序保持 | `source-features/independent-obj.json`、`real/independent-obj.json` |
| Git维护工具单测 | 22项通过 | `regressions/git-tests.txt` |
| 全部13个TSX的语法转译 | 通过；不是全量类型检查 | `environment/tsx-syntax.json` |

截图为 v0.4.19 实际离线工作台，使用默认source-atlas而不是生成路径；新默认齿轮6岛，其中两个平面逐边比例不变且保留中心孔。截图不是主React界面或设计稿。

## 两份真实模型的范围

只使用 `examples/verified-models` 中正确哈希锁定的 glTF/bin。此次运行source-atlas（不是通用剥展预设），300秒Worker预算：人台96岛、头盔177岛；主要平面候选3/4个，本检查重展0岛。两种开关的导出文件逐字节一致；不能将此结果混同于之前通用剥展的93/176岛。

独立检查阈值为1e-14 UV²，检查所有实际导出三角形的包围盒相交候选。轮廓回归还逐边验证两个齿面是3D平面的相似映射、孔边界数正确，不仅依赖整体UV有效性分数。Python仅作为额外QA，不是JS工程依赖。

## 明确没有通过/没有认证的项目

- `npm install --ignore-scripts --no-audit --no-fund` 本轮等待超过35秒未得到依赖，被超时终止。未据此宣称已完成安装，也不重复引用旧DNS日志冒充本轮结果。
- 实际 `npm run build` 退出127：`vite: not found`。日志：`environment/full-build-final.txt`。
- 实际 `npm run typecheck` 退出2：缺少 `node` 类型定义。日志：`environment/full-typecheck-final.txt`。
- 完整 React/Vite 主入口、通用 Three glTF/FBX 加载器、macOS/Windows/Safari和硬件GPU未认证。离线真实Worker/WebGL测试不是这些入口的替代认证。
- 不声称任意曲面均具备人类语义可识别性，不声称填空/岛数同时更优。本次针对默认源UV的主要平面特征被错误保留这一缺口。

## 历史验证记录（不计入本轮）

> **重新打包提示**：下文为原版本记录，原 ZIP 实际在写入中断，不能据此认定原包已经通过最终解压验收。本次校验、精简后的结果路径和 Git 恢复边界以根目录 `REPACK-NOTES.md` 为准。

# v0.4.18 · 实际验证范围

本节仅记录本轮实际运行；下面旧版本历史不计为本轮通过。

| 项目 | 实测 | 记录路径（validation/v0.4.18/） |
|---|---|---|
| 通用剥展 | 12项通过；同时关闭源提示/模板的合成测试、粗分组、显式切线、齿形与孔洞、全覆盖 | tests/peel.json |
| 自由边界防交叉 | 8项通过 | tests/boundary-guard.json |
| 实际LSCM面积塌缩反例与组身份 | 7项通过 | tests/area-collapse.json |
| 保守轮廓栅格 | 23项通过 | tests/contour-raster.json |
| 新搜索约束、回流与诊断 | 13项通过 | tests/fill-search.json |
| 原精排与其他算法 | 保留实际命令日志与退出码；未找到的旧猜测脚本名明确标记未运行，不算通过 | regressions/ |
| 正确两模型，源提示开/关四条生产流程 | 全面数保留、源输入不变、全图UV及OBJ重读通过；81/95空间组，默认93/176岛，无源提示89/251岛 | real/、geometry-only/、summary.json |
| 真实输入精排及头盔续排 | 未增切线、全部面保留；新占用74.72%/60.40%，续排头盔62.95%，预算/未访问数如实报告 | fill/、refill/ |
| 独立几何审计 | 7份实际导出OBJ：原3D/面序不变、正UV绕序、边框内、正面积交叠0（阈值1e-14） | qa-peel/geometry-only/fill/refill.json |
| 新离线工作台浏览器流程 | 10项通过：真实鼠标、生产Worker、人台/齿轮、新预设/来源元数据、动画终点 | browser/report.json |
| 手动相机浏览器回归 | 39项通过 | camera-browser.json |
| 同动画秒的到达亮显/渐隐像素回归 | 28项通过 | arrival-browser.json |

Core smoke编译包括核心与生产Worker及共享unfold TS模块，不包括完整React TSX依赖树。真实模型固定夹具使用正确 glTF/bin，不使用早先错误的网页ZIP。源几何、候选UV和实际OBJ均有报告/哈希，岛数不是空间组数。

## 明确未通过/未认证

`npm install`实际遇到 registry.npmjs.org 的 EAI_AGAIN；`npm run build`退出127（vite not found）；完整类型检查退出2（缺少node类型定义）。日志在 environment/。没有进行完整React/Vite主界面、通用Three FBX/glTF导入器、macOS/Windows/Safari实机认证。离线页通过不能冒充主入口通过。

浏览器运行Linux Chromium软件WebGL。大模型新截图关闭重叠诊断，检验分组对应与UI，不认证大模型重叠提示速度。无GPU硬件帧率或生产性能保证。

## 真实改进与限制

新方法分组不依赖模型名，能在源提示关闭时工作；并不保证任意模型都有人工语义可辨识性。源提示关闭的头盔251岛（默认176），仍有取舍。凹孔保留不意味着必须达到旧版扭曲/合并布局的占用率。同输入30秒旧/新填空对照近似持平略低，详见comparison/；不宣称全部空白已最优消除。预算到期会中断扫描，但返回最后有效整图，未尝试岛数明确报告。

所有旧tag保留，独立附注 v0.4.18 从干净HEAD发布；最终ZIP还会重新解压校验并复跑实际模型，打包后日志另附根目录 RELEASE-VERIFICATION.json。Git身份报告不会自我写入其检查的HEAD。

---

# 历史验证记录（不计入本轮）

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

