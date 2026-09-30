# v0.4.27 实际验证索引

- `acceptance-index.json`：本轮范围、初次失败和更正说明。
- `geometry-real.json`：正确两模型的 original / absent / random UV 六条真实生产 Worker 路径。
- `continuous-parts.json`：两个完整问题部件；大壳两层、五片纵向部件及回折侧面对照。
- `continuous-unit.json`：未见过的几何、变换、约束、原UV getter 禁读和边长测试。
- `reflection.json`：表面对称识别回归。
- `fill-once.json`：自动填空只执行一次，显式预算不被覆盖。
- `automatic-pipeline.json`：四模型实际自动生成、后缝合、精排路径；3秒/2轮功能预算，不是最佳占用率比较。
- `independent-final.json`：实际导出OBJ的独立GEOS/Shapely求交，与文件SHA256绑定。
- `browser.json`：实际完整头盔离线DOM/Worker/WebGL工作台；截图在previews。已再次使用有效的dim/hidden显示参数复跑。
- `camera-browser-smoke.json` / `arrival-browser-smoke.json` / `selection-browser-smoke.json`：39 / 28 / 39 项旧交互回归。
- `regression`：其他专项命令日志，初次connector断言失败与更正后的日志分别保留。
- `full-build`、`full-typecheck`：完整React构建缺Vite、类型检查缺Node类型，未认证。

大壳两个完整层片的形状近似镜像；排布可以整体旋转对称轴，不要求屏幕上永远竖直。分析图每片独立适配显示，不能拿显示面积比较纹素密度。不是对所有UV岛的人工可辨识性认证。

最终ZIP的CRC、完整解压、Git引用和重新执行检查由外部交付验收记录单独保存，避免在压缩包内部制造自引用哈希。通过的真实模型全流程与浏览器测试为打包前执行；最终包重新执行的范围见交付验收，不将两者混写。
