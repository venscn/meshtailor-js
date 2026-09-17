# 结构展开结果

直接打开根目录 `unfold-lab.html`，导入本目录 OBJ 并选择**原样检查**。

- `Corset-bottom-1.obj`：正确人台原 #12，单侧切缝，224面，一片。
- `Corset-bottom-2.obj`：同一224面，左右侧切缝，两片。
- `*-source-map.json`：子网格重编号到完整模型源面/顶点的映射；OBJ已去除未使用顶点，方便取景。
- `Gear-structured.obj`：实际内置Low齿轮，六岛；正反面保留齿形和中心孔。

完整人台/头盔结果、原UV对照与验证位于 `validation/v0.4.17/real/`；正确 glTF/bin 在 `examples/verified-models/`。

重新规划单/双片时，请选择完整环带（已是两片则同时选中两片），在“结构模板”中配置后点“仅按模板重展所选岛”。仅切换选项不修改当前结果。原UV和源几何未改写，导出的新UV需要相应贴图重烘焙。没有材质贴图随附。
