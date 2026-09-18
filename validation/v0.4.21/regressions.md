# 本轮实际回归范围

- `npm run check:geometry`：退出0，含输入隔离、真实边界、候选接受、拓扑、统一策略、严格核心编译。
- `CHROME_SOFTWARE_WEBGL=1 npm run test:camera:browser`：39项通过。
- 同环境 `test:arrival:browser`：28项实际像素/时钟测试通过。
- 同环境 `test:selection:browser`：39项通过。
- `test:feature-sheets`：21项通过，报告见feature-tests.json。
- `test:feature-sheets:browser`：10项通过，报告见browser-features.json。

第一次未显式启用软件WebGL的相机测试没有进入页面ready；改用测试环境明确支持的软件WebGL后实际重跑。全模型背景+线框的初次播放响应超时另见browser-wireframe-limit.json，并未计为通过。后续关闭背景与线框的播放功能通过，不是性能认证。

`npm run build`退出127：缺少Vite。15秒依赖安装预算到达，未得到完整node_modules；npm ping曾返回EAI_AGAIN。没有执行成功的React主入口/通用Three.GLTFLoader/FBX回归。
