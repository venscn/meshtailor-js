# 正确上传模型：不可自动更新的回归夹具

这些文件逐字节来自用户在本对话中明确确认的 `meshtailor-test-models(1).zip`，不是旧的无 `(1)` 包，也不是另行从网上下载的版本。仅包含 glTF 与几何/UV 二进制，不包含贴图。

归档 SHA256：`284decae81fda986f3c291bf4bebee473221b4eabe7078c65ed44adaf9ffb563`。
四文件哈希由 `scripts/lib/verified-model-fixtures.mjs` 校验。测试中不回退到其他文件，不以同名文件替代。模型属于原资产内容，不因纳入本工程而重新授予工程代码的许可证；其原始出处是用户下载的 Khronos glTF-Sample-Models 的 Corset / FlightHelmet 样例目录。

```bash
npm run test:verified-models -- --models examples/verified-models --out validation/local-real --export
npm run test:verified-models:browser -- --models examples/verified-models --out validation/local-browser
```

专项解码器仅覆盖这四个固定文件中的静态、未压缩布局，随后调用生产拓扑装配；它不取代 Studio 的通用 GLTFLoader。正常 glTF 渲染若请求原贴图会缺图，专项验证只读取几何、UV和材质身份，不假装完成贴图渲染。
