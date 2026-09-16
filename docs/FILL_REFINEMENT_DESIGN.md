# UV 空白精排：实现约束

基于 cbf43b6 / v0.4.11。保留真实 Corset / FlightHelmet 夹具及全部已发布 tag。

- 独立于裁切/缝合的后处理；保持全部面、岛数、切缝、源几何与原UV。
- 从有效现有排布开始，轮廓保守栅格用于搜索（可利用凹口），不以包围矩形面积冒充有效面积。
- 先按原始3D表面积降序；逐岛小幅面积增益，移动/旋转后续岛腾位置。其余岛不得缩小，单岛面积增益有限。
- 支持严格共同密度模式与大岛优先模式。后者是有意牺牲严格等密度，不再声称最终仍逐岛等面积。
- 只保留完整、有效且实际三角形占用率提高的布局；失败回滚到前一完整解。预算耗尽返回最好已验证解；用户取消与整体任务超时继续抛出。
- 设置轮数、面积步长、面积增益上限、搜索栅格分辨率和预算。报告停止原因、每岛增益、基线/结果占用、尝试和拒绝。
- 给出高包围盒浪费岛的诊断，不因占用低就自动重切。人工检查原切缝/形变和轮廓装箱限制。
- 输出与UV编辑器/动画终点/OBJ共用数据。相机、播放、选择逻辑不变。

参考（独立TS实现，不移植第三方源码）：
- https://github.com/jpcy/xatlas/blob/master/source/xatlas/xatlas.h (padding, rotation, repeated packing)
- https://docs.blender.org/manual/en/latest/modeling/meshes/uv/editing.html (scale allocation separate from island packing)
