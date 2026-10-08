[English](START_HERE.md) | [**简体中文**](START_HERE.zh-CN.md)

# 开始使用 MeshTailor-JS

当前应用版本：**0.4.30**。项目概览见 [README](README.zh-CN.md)，版本变化见 [发布说明](docs/releases/0.4.30.md)。

## 离线工作台

直接用浏览器打开仓库根目录的 `unfold-lab.html`。它已包含生产 Worker、几何示例和工作台，不需要安装前端依赖。

如果浏览器限制本地 Worker，用 Node.js 启动本地服务：

```bash
npm run lab:serve
```

打开 [http://127.0.0.1:4175](http://127.0.0.1:4175)。可设置 `PORT` 更改端口。

1. 在“模型”中选择内置示例，或导入自己的 OBJ。
2. 加载后自动从几何生成 UV；修改设置后点击 **Generate baseline** 重新生成。
3. 在“动画”中先选 UV 岛，再选三角面；拖动进度条观察 3D 到 UV 的对应关系。
4. 按需缝合、重排或填空，然后导出 **OBJ + UV**。

默认开启“重复剖面度量展开”，可将符合条件的周期侧壁展开为等宽矩形，并让浅径向环件保留内孔。识别依据为几何，不是模型名称或原 UV。详细选项和形变取舍见 [0.4.30 发布说明](docs/releases/0.4.30.md)。

## 完整 Studio

需要 Node.js **22.16+** 和 npm；支持 WebGL2 的浏览器。

```bash
npm ci
npm run dev
```

打开终端打印的 Vite 地址。Studio 支持 OBJ、FBX、GLB 和 glTF；glTF 需同时选择对应的 `.bin`。贴图不会显示，Draco/Meshopt 压缩不在当前导入范围。见 [导入格式说明](docs/IMPORT-FORMATS.zh-CN.md)。

```bash
npm run check:geometry
npm run check
```

`check` 执行单元测试、Studio 生产构建与完整类型检查。历史版本的构建环境限制保留在原记录中；本次维护验证见 [开源整理记录](docs/OPEN_SOURCE_PREPARATION.md)。

## CLI

CLI 仅接受 OBJ，适合几何检查、切缝生成与新 UV 导出：

```bash
npm run cli -- inspect examples/cylinder.obj
npm run cli -- baseline examples/cylinder.obj cylinder-seams.json
npm run cli -- unwrap examples/cylinder.obj cylinder-uv.obj
```

## 参考输出与使用边界

```bash
npm run results:profiles
```

界面当前包含中文标签；文档切换不改变应用语言。

此命令将经过 SHA256 校验的参考 OBJ 恢复至 `results/v0.4.30/`。用外部 UV 编辑器查看原样布局；本工具导入模型后会忽略其原 UV 并重新生成。

生成不使用原 UV、切缝、岛划分或恢复提示。展开存在形变，不保证语义最优版型或全局最密排布；动画用于展示对应关系，不是布料物理模拟。新 UV 需要自行重绘或烘焙贴图。
