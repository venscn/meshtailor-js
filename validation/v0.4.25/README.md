# v0.4.25 验证记录

已实际执行：13项表面对应、7项约束度量、12项完整对称层片/后输出保护、两模型original/absent/random六条生产Worker路径、6条真实整模后处理路径、11项真实离线DOM/Worker/WebGL、39项相机浏览器回归，以及旧完整结构15项、离散对称12项、纯几何检查链和核心21项。

`browser.json` 与 `browser-cap.png` 为实际0.4.25离线页，非设计图。`independent-obj-qa.json` 对最终两个OBJ独立求交、检查三维坐标和面序；正确原模型夹具在 examples/verified-models，仅生成中的UV字段被完全排除。

`Corset-original-absent-random.json`、`FlightHelmet-original-absent-random.json` 含完整路径测量和误差，不是源UV坐标。两种模型的输入原/缺失/随机UV完全不影响生成结果。以时间预算终止的填空不宣称跨机器逐字节确定性。

初次未通过及修正范围见 DEVELOPMENT-ISSUES.json。完整React/Vite构建未通过：install124、build127、typecheck2；缺失依赖不是离线测试通过的替代认证。

最终ZIP的CRC、独立解压、Git身份、跟踪文件一致性与从解压包重跑的结果，见交付ZIP旁的 `meshtailor-js-0.4.25-verification.md`；这里不预先伪造尚未执行的最终ZIP检查。
