/** Explicit presentation catalogue. Literal copy keys remain readable at call sites;
 * interpolated values use numbered placeholders so translations can reorder them.
 * Geometry identities and machine-readable diagnostic codes are never localized. */
export const messages = {
  "浏览器不允许保存设置，本次会话仍生效。": {
    "en": "This browser cannot save settings; they still apply to this session.",
    "zh-CN": "浏览器不允许保存设置，本次会话仍生效。"
  },
  "六岛立方体：拖动 0–100% 进度，观察同色编号的面片移入对应 UV 岛。": {
    "en": "Six-island cube: scrub 0–100% to see each numbered face move to its matching UV island.",
    "zh-CN": "六岛立方体：拖动 0–100% 进度，观察同色编号的面片移入对应 UV 岛。"
  },
  "三块折角带：点“分块陈列”，再缓慢拖动 28–70%，看各铰链真实转动。": {
    "en": "Three folded strips: choose “Separate pieces”, then scrub 28–70% to inspect real hinge rotation.",
    "zh-CN": "三块折角带：点“分块陈列”，再缓慢拖动 28–70%，看各铰链真实转动。"
  },
  "合成马鞍：在“刚性平面网”阶段看同岛重叠条纹；目标 UV 来自纯几何重新求解。": {
    "en": "Synthetic saddle: inspect same-island overlap in the rigid-net stage. Target UVs are generated from geometry.",
    "zh-CN": "合成马鞍：在“刚性平面网”阶段看同岛重叠条纹；目标 UV 来自纯几何重新求解。"
  },
  "纯几何生成：不读取原 UV / 原切缝；结构分组、规则开缝、验证后展开。": {
    "en": "Geometry-only generation: original UVs and seams are ignored; group, cut, validate, then unfold.",
    "zh-CN": "纯几何生成：不读取原 UV / 原切缝；结构分组、规则开缝、验证后展开。"
  },
  "前处理：从连通块开始，仅在必要时补切，再执行验证式邻岛缝合。生成不读取模型原 UV；新 UV 需要绘制或烘焙。": {
    "en": "Preprocess: start with connected components, add necessary cuts, then validate neighboring-island joins. Original UVs are ignored; new UVs need painting or baking.",
    "zh-CN": "前处理：从连通块开始，仅在必要时补切，再执行验证式邻岛缝合。生成不读取模型原 UV；新 UV 需要绘制或烘焙。"
  },
  "按明确侧缝重展所选结构；未匹配区域保留，原网格未修改。": {
    "en": "Re-unfold selected structures along explicit side seams; unmatched regions and source geometry are preserved.",
    "zh-CN": "按明确侧缝重展所选结构；未匹配区域保留，原网格未修改。"
  },
  "按3D表面积从大到小精排当前UV；保持全部岛与切缝，预算停止后可继续。": {
    "en": "Refine current UVs from largest to smallest 3D area; preserve all islands and seams. Continue after a budget stop.",
    "zh-CN": "按3D表面积从大到小精排当前UV；保持全部岛与切缝，预算停止后可继续。"
  },
  "后处理：基于当前岛和共享接缝尝试缝合，不重新运行 baseline。": {
    "en": "Postprocess current islands and shared seams; do not rerun baseline generation.",
    "zh-CN": "后处理：基于当前岛和共享接缝尝试缝合，不重新运行 baseline。"
  },
  "只重排当前岛；不改变岛数，不把同页摆放冒充缝合。": {
    "en": "Repack current islands without changing their count; placement on one page does not mean stitching.",
    "zh-CN": "只重排当前岛；不改变岛数，不把同页摆放冒充缝合。"
  },
  "M": {
    "en": "M",
    "zh-CN": "M"
  },
  "MeshTailor": {
    "en": "MeshTailor",
    "zh-CN": "MeshTailor"
  },
  "查看自动流程与每步执行状态": {
    "en": "View the automatic pipeline and each step's actual status",
    "zh-CN": "查看自动流程与每步执行状态"
  },
  "流程 ·": {
    "en": "Pipeline ·",
    "zh-CN": "流程 ·"
  },
  "读取输入": {
    "en": "Reading input",
    "zh-CN": "读取输入"
  },
  "执行中": {
    "en": "Running",
    "zh-CN": "执行中"
  },
  "未完成": {
    "en": "Incomplete",
    "zh-CN": "未完成"
  },
  "已完成": {
    "en": "Completed",
    "zh-CN": "已完成"
  },
  "面": {
    "en": "faces",
    "zh-CN": "面"
  },
  "导入网格": {
    "en": "Import mesh",
    "zh-CN": "导入网格"
  },
  "导出 OBJ + UV": {
    "en": "Export OBJ + UV",
    "zh-CN": "导出 OBJ + UV"
  },
  "工具与属性": {
    "en": "Tools and properties",
    "zh-CN": "工具与属性"
  },
  "工具分类": {
    "en": "Tool categories",
    "zh-CN": "工具分类"
  },
  "模型": {
    "en": "Mesh",
    "zh-CN": "模型"
  },
  "动画": {
    "en": "Animation",
    "zh-CN": "动画"
  },
  "输入已就绪 · {0} · {1} 面 · FBX/glTF 焊接 {2}（参数在导入设置）": {
    "en": "Input ready · {0} · {1} faces · FBX/glTF weld: {2} (see import settings)",
    "zh-CN": "输入已就绪 · {0} · {1} 面 · FBX/glTF 焊接 {2}（参数在导入设置）"
  },
  "本地模型": {
    "en": "Local meshes",
    "zh-CN": "本地模型"
  },
  "Cube": {
    "en": "Cube",
    "zh-CN": "立方体"
  },
  "Cylinder": {
    "en": "Cylinder",
    "zh-CN": "圆柱体"
  },
  "Torso": {
    "en": "Torso",
    "zh-CN": "躯干"
  },
  "选择 OBJ / FBX / GLB / GLTF": {
    "en": "Choose OBJ / FBX / GLB / GLTF",
    "zh-CN": "选择 OBJ / FBX / GLB / GLTF"
  },
  "可拖入文件。glTF 与配套 .bin 请一起选择。只导入网格，不显示材质贴图。": {
    "en": "Drop files here. Select glTF and its .bin together. Only geometry is imported; textures are not displayed.",
    "zh-CN": "可拖入文件。glTF 与配套 .bin 请一起选择。只导入网格，不显示材质贴图。"
  },
  "导入设置": {
    "en": "Import settings",
    "zh-CN": "导入设置"
  },
  "位置焊接（FBX / glTF）": {
    "en": "Position welding (FBX / glTF)",
    "zh-CN": "位置焊接（FBX / glTF）"
  },
  "Weld mode": {
    "en": "Weld mode",
    "zh-CN": "焊接模式"
  },
  "Boundary · 微小断边配对（默认）": {
    "en": "Boundary · pair tiny broken edges (default)",
    "zh-CN": "Boundary · 微小断边配对（默认）"
  },
  "Exact · 仅精确同坐标": {
    "en": "Exact · identical coordinates only",
    "zh-CN": "Exact · 仅精确同坐标"
  },
  "Tolerance · 容差": {
    "en": "Tolerance · within tolerance",
    "zh-CN": "Tolerance · 容差"
  },
  "Off · 保留渲染顶点索引": {
    "en": "Off · preserve render vertex indices",
    "zh-CN": "Off · 保留渲染顶点索引"
  },
  "相对包围盒容差": {
    "en": "Relative bounding-box tolerance",
    "zh-CN": "相对包围盒容差"
  },
  "Weld tolerance": {
    "en": "Weld tolerance",
    "zh-CN": "焊接容差"
  },
  "不跨对象焊接；同一对象内重合但独立的表面可能被连接。原 UV 在导入时丢弃，新的 UV 从几何生成。设置在下次导入生效。": {
    "en": "Objects are not welded together; coincident surfaces within an object may connect. Original UVs are discarded; new UVs come from geometry. Applies on the next import.",
    "zh-CN": "不跨对象焊接；同一对象内重合但独立的表面可能被连接。原 UV 在导入时丢弃，新的 UV 从几何生成。设置在下次导入生效。"
  },
  "内置样例": {
    "en": "Bundled examples",
    "zh-CN": "内置样例"
  },
  "Complex mesh": {
    "en": "Complex mesh",
    "zh-CN": "复杂网格"
  },
  "密度": {
    "en": "Detail",
    "zh-CN": "密度"
  },
  "Mesh detail": {
    "en": "Mesh detail",
    "zh-CN": "网格密度"
  },
  "Low": {
    "en": "Low",
    "zh-CN": "低"
  },
  "Medium": {
    "en": "Medium",
    "zh-CN": "中"
  },
  "High": {
    "en": "High",
    "zh-CN": "高"
  },
  "载入样例": {
    "en": "Load example",
    "zh-CN": "载入样例"
  },
  "FBX ASCII": {
    "en": "FBX ASCII",
    "zh-CN": "FBX ASCII"
  },
  "FBX Binary": {
    "en": "FBX Binary",
    "zh-CN": "FBX Binary"
  },
  "重叠碎岛测试片（非真实资产）": {
    "en": "Synthetic overlapping islands (test fixture)",
    "zh-CN": "重叠碎岛测试片（非真实资产）"
  },
  "导出当前网格": {
    "en": "Export current mesh",
    "zh-CN": "导出当前网格"
  },
  "在线模型": {
    "en": "Online models",
    "zh-CN": "在线模型"
  },
  "CC0；优先使用已下载的本地副本，否则从原站获取几何。原 UV 会丢弃，不下载贴图。": {
    "en": "CC0; prefer downloaded local copies, otherwise fetch geometry from the source. Discard original UVs and skip textures.",
    "zh-CN": "CC0；优先使用已下载的本地副本，否则从原站获取几何。原 UV 会丢弃，不下载贴图。"
  },
  "来源与许可": {
    "en": "Source and license",
    "zh-CN": "来源与许可"
  },
  "展开示例": {
    "en": "Unfolding examples",
    "zh-CN": "展开示例"
  },
  "三块折角带": {
    "en": "Three folded strips",
    "zh-CN": "三块折角带"
  },
  "六岛立方体": {
    "en": "Six-island cube",
    "zh-CN": "六岛立方体"
  },
  "Topology": {
    "en": "Topology",
    "zh-CN": "拓扑"
  },
  "Vertices": {
    "en": "Vertices",
    "zh-CN": "顶点"
  },
  "Triangles": {
    "en": "Triangles",
    "zh-CN": "三角面"
  },
  "Edges": {
    "en": "Edges",
    "zh-CN": "边"
  },
  "Boundary": {
    "en": "Boundary",
    "zh-CN": "边界"
  },
  "Manifold*": {
    "en": "Manifold*",
    "zh-CN": "流形*"
  },
  "UV charts": {
    "en": "UV charts",
    "zh-CN": "UV 岛"
  },
  "* edge-manifold check, not a repair guarantee": {
    "en": "* edge-manifold check, not a repair guarantee",
    "zh-CN": "* 仅检查边流形，不保证可修复"
  },
  "Import report": {
    "en": "Import report",
    "zh-CN": "导入报告"
  },
  "parts ·": {
    "en": "parts ·",
    "zh-CN": "部件 ·"
  },
  "source vertices →": {
    "en": "source vertices →",
    "zh-CN": "源顶点 →"
  },
  "topology vertices": {
    "en": "topology vertices",
    "zh-CN": "拓扑顶点"
  },
  "welded ·": {
    "en": "welded ·",
    "zh-CN": "已焊接 ·"
  },
  "source UV faces used（应为 0）": {
    "en": "source UV faces used (must be 0)",
    "zh-CN": "source UV faces used（应为 0）"
  },
  "导入说明 / Warnings": {
    "en": "Import notes / warnings",
    "zh-CN": "导入说明 / Warnings"
  },
  "纯几何展开": {
    "en": "Geometry-only unfolding",
    "zh-CN": "纯几何展开"
  },
  "模型原 UV、原切缝与原岛划分不会参与计算。": {
    "en": "Original UVs, seams, and island partitions never participate in generation.",
    "zh-CN": "模型原 UV、原切缝与原岛划分不会参与计算。"
  },
  "Generate baseline · 从几何重生成": {
    "en": "Generate baseline · from geometry",
    "zh-CN": "Generate baseline · 从几何重生成"
  },
  "与默认加载共用当前自动流程。原 UV 提取、恢复与旧切缝实验已移除。": {
    "en": "Uses the same automatic pipeline as default loading. Original-UV extraction, recovery, and old seam experiments are unavailable.",
    "zh-CN": "与默认加载共用当前自动流程。原 UV 提取、恢复与旧切缝实验已移除。"
  },
  "诊断": {
    "en": "Diagnostics",
    "zh-CN": "诊断"
  },
  "导出分割诊断": {
    "en": "Export segmentation diagnostics",
    "zh-CN": "导出分割诊断"
  },
  "只包含参数与统计，不包含模型几何。": {
    "en": "Parameters and statistics only; no mesh geometry.",
    "zh-CN": "只包含参数与统计，不包含模型几何。"
  },
  "视图选项": {
    "en": "View options",
    "zh-CN": "视图选项"
  },
  "Reset camera": {
    "en": "Reset camera",
    "zh-CN": "重置相机"
  },
  "wireframe": {
    "en": "wireframe",
    "zh-CN": "线框"
  },
  "X-ray traversal": {
    "en": "X-ray traversal",
    "zh-CN": "X 光遍历"
  },
  "Show all seams": {
    "en": "Show all seams",
    "zh-CN": "显示全部切缝"
  },
  "遍历使用本次已验证的实际切缝；播放不重新计算 UV。": {
    "en": "Traversal uses actual validated cuts from this result; playback never recomputes UVs.",
    "zh-CN": "遍历使用本次已验证的实际切缝；播放不重新计算 UV。"
  },
  "seam": {
    "en": "seam",
    "zh-CN": "切缝"
  },
  "candidates": {
    "en": "candidates",
    "zh-CN": "候选"
  },
  "current": {
    "en": "current",
    "zh-CN": "当前"
  },
  "previous": {
    "en": "previous",
    "zh-CN": "上一步"
  },
  "UV 计算中": {
    "en": "Computing UVs",
    "zh-CN": "UV 计算中"
  },
  "暂无 UV": {
    "en": "No UVs yet",
    "zh-CN": "暂无 UV"
  },
  "{0} 个 UV 岛": {
    "en": "{0} UV islands",
    "zh-CN": "{0} 个 UV 岛"
  },
  "查看任务": {
    "en": "View task",
    "zh-CN": "查看任务"
  },
  "3D preview mode": {
    "en": "3D preview mode",
    "zh-CN": "3D 预览模式"
  },
  "裁切线遍历": {
    "en": "Seam traversal",
    "zh-CN": "裁切线遍历"
  },
  "3D ↔ UV 展开动画": {
    "en": "3D ↔ UV unfolding",
    "zh-CN": "3D ↔ UV 展开动画"
  },
  "Toggle wireframe": {
    "en": "Toggle wireframe",
    "zh-CN": "切换线框"
  },
  "线框": {
    "en": "Wireframe",
    "zh-CN": "线框"
  },
  "适配视图": {
    "en": "Fit view",
    "zh-CN": "适配视图"
  },
  "展开视图": {
    "en": "Unfold view",
    "zh-CN": "展开视图"
  },
  "First step": {
    "en": "First step",
    "zh-CN": "第一步"
  },
  "Previous step": {
    "en": "Previous step",
    "zh-CN": "上一步"
  },
  "Next step": {
    "en": "Next step",
    "zh-CN": "下一步"
  },
  "Last step": {
    "en": "Last step",
    "zh-CN": "最后一步"
  },
  "Traversal step": {
    "en": "Traversal step",
    "zh-CN": "遍历步骤"
  },
  "Cancel": {
    "en": "Cancel",
    "zh-CN": "取消"
  },
  "重试 UV": {
    "en": "Retry UV",
    "zh-CN": "重试 UV"
  },
  "动画终点 = 右侧 UV = 导出 UV。{0} 条 UV 补切已显式叠加；紫色临时断边仅用于铰链演示。": {
    "en": "Animation endpoint = UV editor = exported UVs. {0} additional cuts are explicit; purple temporary edges are for hinge animation only.",
    "zh-CN": "动画终点 = 右侧 UV = 导出 UV。{0} 条 UV 补切已显式叠加；紫色临时断边仅用于铰链演示。"
  },
  "· candidates": {
    "en": "· candidates",
    "zh-CN": "· 候选"
  },
  "UV 编辑器": {
    "en": "UV editor",
    "zh-CN": "UV 编辑器"
  },
  "UV 预览": {
    "en": "UV preview",
    "zh-CN": "UV 预览"
  },
  "生成 UV": {
    "en": "Generated UVs",
    "zh-CN": "生成 UV"
  },
  "Decode timeline": {
    "en": "Decode timeline",
    "zh-CN": "解码时间线"
  },
  "chains": {
    "en": "chains",
    "zh-CN": "链"
  },
  "Showing": {
    "en": "Showing",
    "zh-CN": "显示"
  },
  "of": {
    "en": "of",
    "zh-CN": "共"
  },
  ". Use slider to seek.": {
    "en": ". Use slider to seek.",
    "zh-CN": "。使用滑块定位。"
  },
  "Generate seams to inspect mesh-native pointer traversal.": {
    "en": "Generate seams to inspect mesh-native pointer traversal.",
    "zh-CN": "生成切缝以检查网格指针遍历。"
  },
  "MeshTailor-JS · 几何研究工作台": {
    "en": "MeshTailor-JS · Geometry workbench",
    "zh-CN": "MeshTailor-JS · 几何研究工作台"
  },
  "左键旋转 · 右键平移 · 滚轮缩放": {
    "en": "Left drag: orbit · Right drag: pan · Wheel: zoom",
    "zh-CN": "左键旋转 · 右键平移 · 滚轮缩放"
  },
  "先选 UV 岛，再选三角形 · Esc 取消": {
    "en": "Select an island, then a triangle · Esc: clear",
    "zh-CN": "先选 UV 岛，再选三角形 · Esc 取消"
  },
  "3D view unavailable": {
    "en": "3D view unavailable",
    "zh-CN": "3D 视图不可用"
  },
  "Check browser hardware acceleration and WebGL 2 support. The rest of Studio remains available.": {
    "en": "Check browser hardware acceleration and WebGL 2 support. The rest of Studio remains available.",
    "zh-CN": "请检查浏览器硬件加速和 WebGL 2 支持；Studio 的其他部分仍可使用。"
  },
  "Retry 3D": {
    "en": "Retry 3D",
    "zh-CN": "重试 3D"
  },
  "UV chart preview": {
    "en": "UV chart preview",
    "zh-CN": "UV 岛预览"
  },
  "拖拽框选 · Shift 加选 · Alt 反选 · Ctrl/⌘ 减选": {
    "en": "Drag to select · Shift: add · Alt: toggle · Ctrl/⌘: remove",
    "zh-CN": "拖拽框选 · Shift 加选 · Alt 反选 · Ctrl/⌘ 减选"
  },
  "展开与检查": {
    "en": "Unfold and inspect",
    "zh-CN": "展开与检查"
  },
  "UV 目标": {
    "en": "UV target",
    "zh-CN": "UV 目标"
  },
  "UV target": {
    "en": "UV target",
    "zh-CN": "UV 目标"
  },
  "重新展开与排布": {
    "en": "Generate and pack",
    "zh-CN": "重新展开与排布"
  },
  "当前结构模板结果": {
    "en": "Current structure-template result",
    "zh-CN": "当前结构模板结果"
  },
  "当前轮廓精排结果": {
    "en": "Current contour-refinement result",
    "zh-CN": "当前轮廓精排结果"
  },
  "当前邻岛缝合结果": {
    "en": "Current neighboring-island joins",
    "zh-CN": "当前邻岛缝合结果"
  },
  "当前重排结果": {
    "en": "Current repacked result",
    "zh-CN": "当前重排结果"
  },
  "播放范围": {
    "en": "Playback scope",
    "zh-CN": "播放范围"
  },
  "Unfold scope": {
    "en": "Unfold scope",
    "zh-CN": "展开范围"
  },
  "全部 UV 岛": {
    "en": "All UV islands",
    "zh-CN": "全部 UV 岛"
  },
  "单个 UV 岛": {
    "en": "One UV island",
    "zh-CN": "单个 UV 岛"
  },
  "多选 UV 岛": {
    "en": "Selected UV islands",
    "zh-CN": "多选 UV 岛"
  },
  "UV 岛": {
    "en": "UV islands",
    "zh-CN": "UV 岛"
  },
  "首次点击选岛，再点岛内三角形选面。重复点击面取消。": {
    "en": "Click once to select an island, then a triangle inside it. Click the triangle again to clear it.",
    "zh-CN": "首次点击选岛，再点岛内三角形选面。重复点击面取消。"
  },
  "全部播放": {
    "en": "Play all",
    "zh-CN": "全部播放"
  },
  "清空选择": {
    "en": "Clear selection",
    "zh-CN": "清空选择"
  },
  "Filter island IDs": {
    "en": "Filter island IDs",
    "zh-CN": "筛选岛编号"
  },
  "搜索岛编号…": {
    "en": "Search island IDs…",
    "zh-CN": "搜索岛编号…"
  },
  "选择 UV 岛 {0}（不选三角形）": {
    "en": "Select UV island {0} (without selecting a triangle)",
    "zh-CN": "选择 UV 岛 {0}（不选三角形）"
  },
  "没有匹配的 UV 岛": {
    "en": "No matching UV islands",
    "zh-CN": "没有匹配的 UV 岛"
  },
  "UV 计算完成后显示岛列表": {
    "en": "Islands appear after UV generation",
    "zh-CN": "UV 计算完成后显示岛列表"
  },
  "上一页": {
    "en": "Previous page",
    "zh-CN": "上一页"
  },
  "下一页": {
    "en": "Next page",
    "zh-CN": "下一页"
  },
  "上一个岛": {
    "en": "Previous island",
    "zh-CN": "上一个岛"
  },
  "下一个岛": {
    "en": "Next island",
    "zh-CN": "下一个岛"
  },
  "播放": {
    "en": "Playback",
    "zh-CN": "播放"
  },
  "方式": {
    "en": "Order",
    "zh-CN": "方式"
  },
  "Unfold order": {
    "en": "Unfold order",
    "zh-CN": "展开顺序"
  },
  "逐岛接力": {
    "en": "Island relay",
    "zh-CN": "逐岛接力"
  },
  "严格逐岛": {
    "en": "Strictly sequential",
    "zh-CN": "严格逐岛"
  },
  "接力点": {
    "en": "Handoff",
    "zh-CN": "接力点"
  },
  "Island handoff": {
    "en": "Island handoff",
    "zh-CN": "岛接力点"
  },
  "队列按原始 3D 表面积从大到小；多选顺序不影响播放。": {
    "en": "Queue follows descending original 3D surface area; selection order does not affect playback.",
    "zh-CN": "队列按原始 3D 表面积从大到小；多选顺序不影响播放。"
  },
  "每岛基准时长 / 秒": {
    "en": "Base duration per island / seconds",
    "zh-CN": "每岛基准时长 / 秒"
  },
  "Unfold duration": {
    "en": "Unfold duration",
    "zh-CN": "展开时长"
  },
  "Skip unchanged animation spans": {
    "en": "Skip unchanged animation spans",
    "zh-CN": "跳过无变化动画区间"
  },
  "跳过无变化区间": {
    "en": "Skip unchanged spans",
    "zh-CN": "跳过无变化区间"
  },
  "基准": {
    "en": "Base",
    "zh-CN": "基准"
  },
  "秒 / 当前倍速": {
    "en": "s / current speed",
    "zh-CN": "秒 / 当前倍速"
  },
  "秒 · 静止跳过缩短": {
    "en": "s · static skip saves",
    "zh-CN": "秒 · 静止跳过缩短"
  },
  "秒": {
    "en": "s",
    "zh-CN": "秒"
  },
  "向外分离": {
    "en": "Outward separation",
    "zh-CN": "向外分离"
  },
  "Unfold separation": {
    "en": "Unfold separation",
    "zh-CN": "展开分离"
  },
  "原位展开": {
    "en": "Unfold in place",
    "zh-CN": "原位展开"
  },
  "相对模型最长边；0 表示不向外移动。": {
    "en": "Relative to the longest model side; 0 means no outward movement.",
    "zh-CN": "相对模型最长边；0 表示不向外移动。"
  },
  "展开路径与阶段": {
    "en": "Unfold path and stages",
    "zh-CN": "展开路径与阶段"
  },
  "变换路径": {
    "en": "Transform path",
    "zh-CN": "变换路径"
  },
  "Unfold path": {
    "en": "Unfold path",
    "zh-CN": "展开路径"
  },
  "铰链展开 → UV 形变 → 排布": {
    "en": "Hinges → UV morph → packing",
    "zh-CN": "铰链展开 → UV 形变 → 排布"
  },
  "分离 + 顶点插值（对照）": {
    "en": "Separation + vertex interpolation (comparison)",
    "zh-CN": "分离 + 顶点插值（对照）"
  },
  "直接插值到 UV": {
    "en": "Interpolate directly to UVs",
    "zh-CN": "直接插值到 UV"
  },
  "从根面依次打开铰链": {
    "en": "Open hinges progressively from the root face",
    "zh-CN": "从根面依次打开铰链"
  },
  "Hold rigid net": {
    "en": "Hold rigid net",
    "zh-CN": "刚性平面网停留"
  },
  "平面网额外停留": {
    "en": "Extra pause on rigid net",
    "zh-CN": "平面网额外停留"
  },
  "仅相邻两岛尾段交叠。等待岛留在 3D，完成岛留在 UV。": {
    "en": "Only adjacent islands overlap at handoff. Waiting islands stay in 3D; completed islands stay in UV space.",
    "zh-CN": "仅相邻两岛尾段交叠。等待岛留在 3D，完成岛留在 UV。"
  },
  "当前播放岛 · 避遮挡": {
    "en": "Active island · visibility",
    "zh-CN": "当前播放岛 · 避遮挡"
  },
  "Playback focus dissolve": {
    "en": "Playback focus dissolve",
    "zh-CN": "播放时淡化背景岛"
  },
  "播放 / 拖动期间突出当前展开岛": {
    "en": "Emphasize the unfolding island while playing / scrubbing",
    "zh-CN": "播放 / 拖动期间突出当前展开岛"
  },
  "突出方式": {
    "en": "Emphasis mode",
    "zh-CN": "突出方式"
  },
  "Playback emphasis mode": {
    "en": "Playback emphasis mode",
    "zh-CN": "播放突出方式"
  },
  "其他岛整体半透明（默认）": {
    "en": "Ghost other islands (default)",
    "zh-CN": "其他岛整体半透明（默认）"
  },
  "局部球形散点（旧方式）": {
    "en": "Local sphere dithering (legacy)",
    "zh-CN": "局部球形散点（旧方式）"
  },
  "关闭": {
    "en": "Off",
    "zh-CN": "关闭"
  },
  "其他岛不透明度": {
    "en": "Other-island opacity",
    "zh-CN": "其他岛不透明度"
  },
  "Playback ghost opacity": {
    "en": "Playback ghost opacity",
    "zh-CN": "背景岛不透明度"
  },
  "% · 暂停 / 松手后恢复原显示": {
    "en": "% · restore on pause / release",
    "zh-CN": "% · 暂停 / 松手后恢复原显示"
  },
  "到达 UV 后亮显（1× 动画秒）": {
    "en": "Hold on UV arrival (1× animation seconds)",
    "zh-CN": "到达 UV 后亮显（1× 动画秒）"
  },
  "UV arrival hold seconds": {
    "en": "UV arrival hold seconds",
    "zh-CN": "UV 到达亮显秒数"
  },
  "随后渐隐（1× 动画秒）": {
    "en": "Then fade (1× animation seconds)",
    "zh-CN": "随后渐隐（1× 动画秒）"
  },
  "UV arrival fade seconds": {
    "en": "UV arrival fade seconds",
    "zh-CN": "UV 到达渐隐秒数"
  },
  "随动画进度和倍速计算；回拖/倒放可复现，停住进度即停止渐隐；只在整体半透明模式生效。落位后先保持岛色，再平滑变到背景透明度，不阻塞下一岛。暂停 / 松手 / 播放结束仍立即恢复原显示。": {
    "en": "Follows animation time and speed; reverse and scrubbing reproduce the fade, stationary progress stops it. Ghost mode only. Hold the island color before fading to background opacity; the next island is not blocked. Pause, release, or playback end immediately restores the original display.",
    "zh-CN": "随动画进度和倍速计算；回拖/倒放可复现，停住进度即停止渐隐；只在整体半透明模式生效。落位后先保持岛色，再平滑变到背景透明度，不阻塞下一岛。暂停 / 松手 / 播放结束仍立即恢复原显示。"
  },
  "等待岛淡化；运动岛始终实体，完全到达目标 UV 后才进入亮显和渐隐。不改变选择、UV 或相机。": {
    "en": "Waiting islands fade; moving islands stay solid until they reach UVs. Selection, UVs, and camera are unchanged.",
    "zh-CN": "等待岛淡化；运动岛始终实体，完全到达目标 UV 后才进入亮显和渐隐。不改变选择、UV 或相机。"
  },
  "旧球形散点选项（仅旧方式有效）": {
    "en": "Legacy sphere settings (legacy mode only)",
    "zh-CN": "旧球形散点选项（仅旧方式有效）"
  },
  "球形范围": {
    "en": "Sphere radius",
    "zh-CN": "球形范围"
  },
  "Focus sphere radius": {
    "en": "Focus sphere radius",
    "zh-CN": "聚焦球半径"
  },
  "× 当前岛半径": {
    "en": "× current island radius",
    "zh-CN": "× 当前岛半径"
  },
  "遮挡面残留": {
    "en": "Occluded-face opacity",
    "zh-CN": "遮挡面残留"
  },
  "Focus retained opacity": {
    "en": "Focus retained opacity",
    "zh-CN": "聚焦残留不透明度"
  },
  "旧球形方式也只在播放或拖动期间启用；暂停和手势结束均恢复。": {
    "en": "Legacy sphere mode also applies only while playing / scrubbing; pause and gesture end restore the display.",
    "zh-CN": "旧球形方式也只在播放或拖动期间启用；暂停和手势结束均恢复。"
  },
  "重叠与面片识别": {
    "en": "Overlap and triangle identification",
    "zh-CN": "重叠与面片识别"
  },
  "重叠提示": {
    "en": "Overlap visualization",
    "zh-CN": "重叠提示"
  },
  "Overlap visualization": {
    "en": "Overlap visualization",
    "zh-CN": "重叠提示方式"
  },
  "自动 · 运动岛视线叠层": {
    "en": "Auto · moving-island line-of-sight layers",
    "zh-CN": "自动 · 运动岛视线叠层"
  },
  "同岛近共面重叠": {
    "en": "Same-island near-coplanar overlap",
    "zh-CN": "同岛近共面重叠"
  },
  "视线叠层 · 含前后遮挡": {
    "en": "Line-of-sight layers · includes occlusion",
    "zh-CN": "视线叠层 · 含前后遮挡"
  },
  "铰链尚未展平时也提示当前运动岛的视线叠层；静止后切为近共面提示。投影遮挡不等于碰撞。": {
    "en": "Show moving-island layers before hinges flatten; switch to near-coplanar checks when stationary. Projected occlusion does not mean collision.",
    "zh-CN": "铰链尚未展平时也提示当前运动岛的视线叠层；静止后切为近共面提示。投影遮挡不等于碰撞。"
  },
  "视线叠层包含普通遮挡，不代表几何相交。": {
    "en": "Line-of-sight layers include normal occlusion and do not prove geometric intersection.",
    "zh-CN": "视线叠层包含普通遮挡，不代表几何相交。"
  },
  "近共面提示只检测当前可见表层附近的同岛面片。": {
    "en": "Near-coplanar hints inspect same-island triangles near the currently visible surface.",
    "zh-CN": "近共面提示只检测当前可见表层附近的同岛面片。"
  },
  "Triangle tone variation": {
    "en": "Triangle tone variation",
    "zh-CN": "三角形明暗分色"
  },
  "三角形明暗分色（保留岛色）": {
    "en": "Vary triangle tones (preserve island colors)",
    "zh-CN": "三角形明暗分色（保留岛色）"
  },
  "条纹强度": {
    "en": "Hatch opacity",
    "zh-CN": "条纹强度"
  },
  "Overlap hatch opacity": {
    "en": "Overlap hatch opacity",
    "zh-CN": "重叠条纹不透明度"
  },
  "检测容差": {
    "en": "Detection tolerance",
    "zh-CN": "检测容差"
  },
  "距离 / 模型最长边 %": {
    "en": "Distance / longest model side %",
    "zh-CN": "距离 / 模型最长边 %"
  },
  "Overlap relative tolerance percent": {
    "en": "Overlap relative tolerance percent",
    "zh-CN": "重叠相对容差百分比"
  },
  "默认 0.01%。过大会把靠得很近的平行面算作重叠；不是精确自交验证。": {
    "en": "Default 0.01%. Larger values may count close parallel surfaces as overlap; this is not exact self-intersection validation.",
    "zh-CN": "默认 0.01%。过大会把靠得很近的平行面算作重叠；不是精确自交验证。"
  },
  "加载铰链重叠示例": {
    "en": "Load hinge-overlap example",
    "zh-CN": "加载铰链重叠示例"
  },
  "橙色斜纹 = 2 层；玫红交叉纹 = 3 层及以上。可配合视口“线框”。切换提示不暂停、不重新展开。": {
    "en": "Orange hatch: 2 layers; magenta crosshatch: 3+. Combine with wireframe. Switching hints does not pause or regenerate UVs.",
    "zh-CN": "橙色斜纹 = 2 层；玫红交叉纹 = 3 层及以上。可配合视口“线框”。切换提示不暂停、不重新展开。"
  },
  "显示与相机": {
    "en": "Display and camera",
    "zh-CN": "显示与相机"
  },
  "未选择的岛": {
    "en": "Unselected islands",
    "zh-CN": "未选择的岛"
  },
  "Unselected islands": {
    "en": "Unselected islands",
    "zh-CN": "未选择的岛"
  },
  "半透明": {
    "en": "Translucent",
    "zh-CN": "半透明"
  },
  "隐藏": {
    "en": "Hidden",
    "zh-CN": "隐藏"
  },
  "实体": {
    "en": "Solid",
    "zh-CN": "实体"
  },
  "UV 棋盘": {
    "en": "UV checkerboard",
    "zh-CN": "UV 棋盘"
  },
  "岛编号": {
    "en": "Island IDs",
    "zh-CN": "岛编号"
  },
  "铰链轴与角度": {
    "en": "Hinge axes and angles",
    "zh-CN": "铰链轴与角度"
  },
  "动画临时断边": {
    "en": "Temporary animation edges",
    "zh-CN": "动画临时断边"
  },
  "Follow unfolding camera": {
    "en": "Follow unfolding camera",
    "zh-CN": "跟随展开相机"
  },
  "自动跟随面片": {
    "en": "Follow unfolding pieces",
    "zh-CN": "自动跟随面片"
  },
  "操作相机将关闭跟随。": {
    "en": "Manual camera interaction disables following.",
    "zh-CN": "操作相机将关闭跟随。"
  },
  "手动相机 · 播放不锁定视角。": {
    "en": "Manual camera · playback does not lock the view.",
    "zh-CN": "手动相机 · 播放不锁定视角。"
  },
  "适配当前面片（保留方向）": {
    "en": "Fit current pieces (preserve direction)",
    "zh-CN": "适配当前面片（保留方向）"
  },
  "适配 3D 视角": {
    "en": "Fit 3D view",
    "zh-CN": "适配 3D 视角"
  },
  "UV 正视": {
    "en": "Front UV view",
    "zh-CN": "UV 正视"
  },
  "运动检测": {
    "en": "Motion detection",
    "zh-CN": "运动检测"
  },
  "相对岛尺寸容差": {
    "en": "Tolerance relative to island size",
    "zh-CN": "相对岛尺寸容差"
  },
  "Motion relative tolerance": {
    "en": "Motion relative tolerance",
    "zh-CN": "运动相对容差"
  },
  "按真实顶点运动检测，与相机和遮挡无关。": {
    "en": "Detect actual vertex movement independently of camera and occlusion.",
    "zh-CN": "按真实顶点运动检测，与相机和遮挡无关。"
  },
  "已跳过：": {
    "en": "Skipped:",
    "zh-CN": "已跳过："
  },
  "主动观察停留": {
    "en": "Observation hold",
    "zh-CN": "主动观察停留"
  },
  "无": {
    "en": "None",
    "zh-CN": "无"
  },
  "示例与导出": {
    "en": "Examples and export",
    "zh-CN": "示例与导出"
  },
  "加载三块折角带示例": {
    "en": "Load three-folded-strip example",
    "zh-CN": "加载三块折角带示例"
  },
  "加载六岛立方体示例": {
    "en": "Load six-island cube example",
    "zh-CN": "加载六岛立方体示例"
  },
  "载入示例会替换当前模型。": {
    "en": "Loading an example replaces the current mesh.",
    "zh-CN": "载入示例会替换当前模型。"
  },
  "导出对应 OBJ + 目标 UV": {
    "en": "Export corresponding OBJ + target UVs",
    "zh-CN": "导出对应 OBJ + 目标 UV"
  },
  "暂停展开": {
    "en": "Pause unfolding",
    "zh-CN": "暂停展开"
  },
  "播放展开": {
    "en": "Play unfolding",
    "zh-CN": "播放展开"
  },
  "反向": {
    "en": "Reverse",
    "zh-CN": "反向"
  },
  "循环": {
    "en": "Loop",
    "zh-CN": "循环"
  },
  "倍速": {
    "en": "Speed",
    "zh-CN": "倍速"
  },
  "Playback speed": {
    "en": "Playback speed",
    "zh-CN": "播放倍速"
  },
  "岛 · 剩余": {
    "en": "islands · remaining",
    "zh-CN": "岛 · 剩余"
  },
  "s": {
    "en": "s",
    "zh-CN": "s"
  },
  "3D · 0%": {
    "en": "3D · 0%",
    "zh-CN": "3D · 0%"
  },
  "Unfold progress": {
    "en": "Unfold progress",
    "zh-CN": "展开进度"
  },
  "UV · 100%": {
    "en": "UV · 100%",
    "zh-CN": "UV · 100%"
  },
  "没有播放对象": {
    "en": "Nothing to play",
    "zh-CN": "没有播放对象"
  },
  "全部在 UV 平面": {
    "en": "All on UV plane",
    "zh-CN": "全部在 UV 平面"
  },
  "全部在 3D 原位": {
    "en": "All at original 3D positions",
    "zh-CN": "全部在 3D 原位"
  },
  "下一岛准备启动": {
    "en": "Next island is preparing",
    "zh-CN": "下一岛准备启动"
  },
  "UV 求解与排布": {
    "en": "UV solver and packing",
    "zh-CN": "UV 求解与排布"
  },
  "UV objective": {
    "en": "UV objective",
    "zh-CN": "UV 目标策略"
  },
  "手绘轮廓优先（默认）": {
    "en": "Paint-friendly contours (default)",
    "zh-CN": "手绘轮廓优先（默认）"
  },
  "少岛稳健 · 旧圆边界回退": {
    "en": "Compact islands · legacy circular fallback",
    "zh-CN": "少岛稳健 · 旧圆边界回退"
  },
  "手绘模式保留主要平面凹口、齿形和孔洞；曲面使用自由边界。缝合优先保留当前生成岛轮廓，宁可留下合理的分片，不把有效形状强制挤成圆。不会自动识别衣片名称。": {
    "en": "Paint mode preserves major planar notches, teeth, and holes; curved surfaces use free boundaries. Stitching prioritizes current generated contours and keeps reasonable pieces rather than forcing shapes into circles. It does not identify garment names.",
    "zh-CN": "手绘模式保留主要平面凹口、齿形和孔洞；曲面使用自由边界。缝合优先保留当前生成岛轮廓，宁可留下合理的分片，不把有效形状强制挤成圆。不会自动识别衣片名称。"
  },
  "保形迭代预算": {
    "en": "Shape-preserving iteration budget",
    "zh-CN": "保形迭代预算"
  },
  "Paint iterations": {
    "en": "Paint iterations",
    "zh-CN": "保形迭代"
  },
  "缝合时原形比例变化上限": {
    "en": "Maximum shape-ratio change when stitching",
    "zh-CN": "缝合时原形比例变化上限"
  },
  "Merge shape limit": {
    "en": "Merge shape limit",
    "zh-CN": "缝合形状变化上限"
  },
  "去除整体旋转/缩放后，按99%源表面积检查边长比例变化；1表示保留比例。仅控制当前生成岛的缝合，不使用模型原 UV。": {
    "en": "Check edge ratios over 99% of source surface area after removing overall rotation/scale; 1 preserves ratios. Applies only to stitching generated islands, never original UVs.",
    "zh-CN": "去除整体旋转/缩放后，按99%源表面积检查边长比例变化；1表示保留比例。仅控制当前生成岛的缝合，不使用模型原 UV。"
  },
  "通用分组剥展 · 空间组与切缝分离": {
    "en": "Group and peel · separate spatial groups from cuts",
    "zh-CN": "通用分组剥展 · 空间组与切缝分离"
  },
  "Peel spatial groups": {
    "en": "Peel spatial groups",
    "zh-CN": "剥展空间组"
  },
  "空间分组 → 组内开缝 → 剥展": {
    "en": "Spatial groups → cuts within groups → peel",
    "zh-CN": "空间分组 → 组内开缝 → 剥展"
  },
  "Complete structural groups": {
    "en": "Complete structural groups",
    "zh-CN": "完整结构分组"
  },
  "完整主片／回折壁与双侧结构优先（默认）": {
    "en": "Prefer complete main sheets / folded walls and bilateral structures (default)",
    "zh-CN": "完整主片／回折壁与双侧结构优先（默认）"
  },
  "可靠镜像单元联合划线；未匹配部分不强制复制。原 UV 不参与生成。": {
    "en": "Reliable mirrored units share cuts; unmatched regions are not copied. Original UVs never guide generation.",
    "zh-CN": "可靠镜像单元联合划线；未匹配部分不强制复制。原 UV 不参与生成。"
  },
  "Surface symmetry": {
    "en": "Surface symmetry",
    "zh-CN": "表面对称"
  },
  "按表面识别并约束对称（默认）": {
    "en": "Detect and constrain symmetry on surfaces (default)",
    "zh-CN": "按表面识别并约束对称（默认）"
  },
  "在连续表面、边界和闭合折边上寻找对应；不要求左右网格相同。可靠闭合片先分层再展开；已开缝或识别不足的区域不强行镜像。新配置需重新生成才生效。": {
    "en": "Find correspondence on continuous surfaces, boundaries, and closed creases; matching left/right meshes are unnecessary. Split reliable closed sheets into layers before unfolding. Open or uncertain regions are not forced symmetric. Regenerate to apply.",
    "zh-CN": "在连续表面、边界和闭合折边上寻找对应；不要求左右网格相同。可靠闭合片先分层再展开；已开缝或识别不足的区域不强行镜像。新配置需重新生成才生效。"
  },
  "表面对称数值设置": {
    "en": "Surface symmetry parameters",
    "zh-CN": "表面对称数值设置"
  },
  "几何匹配容差 % 部件直径": {
    "en": "Geometry match tolerance % of component diameter",
    "zh-CN": "几何匹配容差 % 部件直径"
  },
  "Surface symmetry tolerance": {
    "en": "Surface symmetry tolerance",
    "zh-CN": "表面对称容差"
  },
  "对称约束强度": {
    "en": "Symmetry constraint strength",
    "zh-CN": "对称约束强度"
  },
  "Surface symmetry strength": {
    "en": "Surface symmetry strength",
    "zh-CN": "表面对称强度"
  },
  "对称松弛迭代": {
    "en": "Symmetry relaxation iterations",
    "zh-CN": "对称松弛迭代"
  },
  "Surface symmetry iterations": {
    "en": "Surface symmetry iterations",
    "zh-CN": "表面对称迭代"
  },
  "增大容差可能误认近似结构；最终仍须通过镜像误差、形变、边界和全图交叠检查。": {
    "en": "Larger tolerance may misidentify approximate structures; accepted results must still pass mirror error, distortion, boundary, and global overlap checks.",
    "zh-CN": "增大容差可能误认近似结构；最终仍须通过镜像误差、形变、边界和全图交叠检查。"
  },
  "结构片内在尺寸松弛迭代": {
    "en": "Intrinsic structure relaxation iterations",
    "zh-CN": "结构片内在尺寸松弛迭代"
  },
  "Structural relaxation iterations": {
    "en": "Structural relaxation iterations",
    "zh-CN": "结构松弛迭代"
  },
  "根据三维边长展开肩部／腰部，不让数值有效的共形种子提前结束；0 可对照关闭。": {
    "en": "Use 3D edge lengths around shoulders / waists rather than accepting a merely valid conformal seed; 0 disables this for comparison.",
    "zh-CN": "根据三维边长展开肩部／腰部，不让数值有效的共形种子提前结束；0 可对照关闭。"
  },
  "主要平面特征最小总面积 %": {
    "en": "Minimum combined planar feature area %",
    "zh-CN": "主要平面特征最小总面积 %"
  },
  "Peel feature area": {
    "en": "Peel feature area",
    "zh-CN": "剥展特征面积"
  },
  "几何折角阈值（度）": {
    "en": "Geometry crease threshold (degrees)",
    "zh-CN": "几何折角阈值（度）"
  },
  "Group feature degrees": {
    "en": "Group feature degrees",
    "zh-CN": "分组折角"
  },
  "切缝图割搜索环数": {
    "en": "Seam graph-cut search rings",
    "zh-CN": "切缝图割搜索环数"
  },
  "Seam band rings": {
    "en": "Seam band rings",
    "zh-CN": "切缝搜索环数"
  },
  "先保持完整空间连通组和主要面板，不按小附件的三角形数量切碎。投影只是种子；重叠时先开缝/自由边界松弛，失败才连通二分。不是人体或齿轮专用分类器。": {
    "en": "Preserve complete connected spatial groups and major panels rather than fragmenting small attachments by triangle count. Projection is a seed; overlap triggers cuts / free-boundary relaxation before connected bisection. This is not a human or gear classifier.",
    "zh-CN": "先保持完整空间连通组和主要面板，不按小附件的三角形数量切碎。投影只是种子；重叠时先开缝/自由边界松弛，失败才连通二分。不是人体或齿轮专用分类器。"
  },
  "空间组 →": {
    "en": "spatial groups →",
    "zh-CN": "空间组 →"
  },
  "个实际 UV 岛": {
    "en": "actual UV islands",
    "zh-CN": "个实际 UV 岛"
  },
  "反馈细分": {
    "en": "Feedback splits",
    "zh-CN": "反馈细分"
  },
  "次 · 原 UV 使用 0": {
    "en": "times · original UV use: 0",
    "zh-CN": "次 · 原 UV 使用 0"
  },
  "分组与结果对应": {
    "en": "Groups and results",
    "zh-CN": "分组与结果对应"
  },
  "组": {
    "en": "Group",
    "zh-CN": "组"
  },
  "面 →": {
    "en": "faces →",
    "zh-CN": "面 →"
  },
  "结构模板 · 人工切缝思路": {
    "en": "Structure templates · explicit seam planning",
    "zh-CN": "结构模板 · 人工切缝思路"
  },
  "Structural UV templates": {
    "en": "Structural UV templates",
    "zh-CN": "结构 UV 模板"
  },
  "先识别环带，再规划侧缝（默认）": {
    "en": "Recognize bands before planning side seams (default)",
    "zh-CN": "先识别环带，再规划侧缝（默认）"
  },
  "Closed tube strips": {
    "en": "Closed tube strips",
    "zh-CN": "闭合管身条带"
  },
  "闭合管身：纵缝＋横断面 → 矩形条带（默认）": {
    "en": "Closed tubes: longitudinal seams + cross sections → rectangular strips (default)",
    "zh-CN": "闭合管身：纵缝＋横断面 → 矩形条带（默认）"
  },
  "闭合管身横向分段": {
    "en": "Closed-tube transverse segments",
    "zh-CN": "闭合管身横向分段"
  },
  "Closed tube panels": {
    "en": "Closed tube panels",
    "zh-CN": "闭合管身片数"
  },
  "1 保留一整条；增加分段会新增横向切缝，可更紧凑装入方形 UV 页。长宽来自真实管长/周长，不能把长管压成正方形。只处理完整、可验证的周期截面族；非管状区域不强制矩形化。修改后重新生成；填空不会新增这些切缝。": {
    "en": "1 preserves one complete strip. More segments add transverse seams to fit square UV pages. Length/width follows actual tube length/circumference; long tubes are not forced square. Only verified periodic cross-section families qualify. Regenerate to apply; fill never adds these cuts.",
    "zh-CN": "1 保留一整条；增加分段会新增横向切缝，可更紧凑装入方形 UV 页。长宽来自真实管长/周长，不能把长管压成正方形。只处理完整、可验证的周期截面族；非管状区域不强制矩形化。修改后重新生成；填空不会新增这些切缝。"
  },
  "闭合管身最大方向拉伸比": {
    "en": "Maximum directional stretch for closed tubes",
    "zh-CN": "闭合管身最大方向拉伸比"
  },
  "Closed tube maximum stretch": {
    "en": "Closed tube maximum stretch",
    "zh-CN": "闭合管身最大拉伸"
  },
  "Preserve complete rim": {
    "en": "Preserve complete rim",
    "zh-CN": "保留完整侧边"
  },
  "完整侧边独立展开，不混入两张端面": {
    "en": "Unfold the complete rim independently of both end caps",
    "zh-CN": "完整侧边独立展开，不混入两张端面"
  },
  "Revolved profile metric": {
    "en": "Revolved profile metric",
    "zh-CN": "重复截面度量"
  },
  "重复截面度量：直筒/倒角侧壁保宽，径向环件保孔": {
    "en": "Repeated cross sections: preserve tube / bevel width and ring holes",
    "zh-CN": "重复截面度量：直筒/倒角侧壁保宽，径向环件保孔"
  },
  "先验证真实截面与剖面连接；不将锥面、齿面或任意曲面强制拉方。不读取原 UV。": {
    "en": "Verify actual sections and profile connectivity; do not force cones, teeth, or arbitrary curved surfaces square. Original UVs are ignored.",
    "zh-CN": "先验证真实截面与剖面连接；不将锥面、齿面或任意曲面强制拉方。不读取原 UV。"
  },
  "环带切法": {
    "en": "Band cut plan",
    "zh-CN": "环带切法"
  },
  "Band panels": {
    "en": "Band panels",
    "zh-CN": "环带片数"
  },
  "自动 · 完整一片优先": {
    "en": "Auto · prefer one complete strip",
    "zh-CN": "自动 · 完整一片优先"
  },
  "指定两侧切缝 · 两片": {
    "en": "Two explicit side seams · two panels",
    "zh-CN": "指定两侧切缝 · 两片"
  },
  "单纵缝 · 整圈一片": {
    "en": "One longitudinal seam · full loop",
    "zh-CN": "单纵缝 · 整圈一片"
  },
  "上下轴": {
    "en": "Vertical axis",
    "zh-CN": "上下轴"
  },
  "Band axis": {
    "en": "Band axis",
    "zh-CN": "环带轴"
  },
  "自动：上下边界环": {
    "en": "Auto: upper / lower boundary loops",
    "zh-CN": "自动：上下边界环"
  },
  "X": {
    "en": "X",
    "zh-CN": "X"
  },
  "Y": {
    "en": "Y",
    "zh-CN": "Y"
  },
  "Z": {
    "en": "Z",
    "zh-CN": "Z"
  },
  "侧缝方向（度）": {
    "en": "Side-seam direction (degrees)",
    "zh-CN": "侧缝方向（度）"
  },
  "Band seam angle": {
    "en": "Band seam angle",
    "zh-CN": "环带切缝角度"
  },
  "自动处理最小表面积占比（%）": {
    "en": "Minimum surface-area share for automatic handling (%)",
    "zh-CN": "自动处理最小表面积占比（%）"
  },
  "Band minimum area": {
    "en": "Band minimum area",
    "zh-CN": "环带最小面积"
  },
  "最大三角面形变比": {
    "en": "Maximum triangle distortion ratio",
    "zh-CN": "最大三角面形变比"
  },
  "Band maximum stretch": {
    "en": "Band maximum stretch",
    "zh-CN": "环带最大拉伸"
  },
  "Template selected islands": {
    "en": "Template selected islands",
    "zh-CN": "模板重展所选岛"
  },
  "仅按模板重展所选岛": {
    "en": "Re-unfold selected islands with templates",
    "zh-CN": "仅按模板重展所选岛"
  },
  "只重解显式选中的相连区域，其他岛保留形状并重排。改变已分成两片的环带时请同时选中两片。上下边界/侧缝不被后续缝合抹掉；当前视角不参与求解。修改参数后需执行，几何生成与只重排不会运行模板。": {
    "en": "Solve only explicitly selected connected regions; preserve other shapes and repack. Select both halves when changing a split band. Subsequent stitching preserves upper/lower boundaries and side seams. Camera direction is irrelevant. Execute to apply; ordinary generation and repacking do not run templates.",
    "zh-CN": "只重解显式选中的相连区域，其他岛保留形状并重排。改变已分成两片的环带时请同时选中两片。上下边界/侧缝不被后续缝合抹掉；当前视角不参与求解。修改参数后需执行，几何生成与只重排不会运行模板。"
  },
  "结构模板应用": {
    "en": "Template regions applied:",
    "zh-CN": "结构模板应用"
  },
  "区域": {
    "en": "regions",
    "zh-CN": "区域"
  },
  "源 #": {
    "en": "Source #",
    "zh-CN": "源 #"
  },
  "{0} → {1} · 最大形变 {2}": {
    "en": "{0} → {1} · max distortion {2}",
    "zh-CN": "{0} → {1} · 最大形变 {2}"
  },
  "Auto large charts": {
    "en": "Auto large charts",
    "zh-CN": "自动大岛参数"
  },
  "自动参数 · 大块重分割": {
    "en": "Auto parameters · larger regions",
    "zh-CN": "自动参数 · 大块重分割"
  },
  "Auto balanced charts": {
    "en": "Auto balanced charts",
    "zh-CN": "自动均衡参数"
  },
  "自动参数 · 均衡": {
    "en": "Auto parameters · balanced",
    "zh-CN": "自动参数 · 均衡"
  },
  "分析当前几何并填写参数，替换当前裁切方案、重新生成 UV；不读取原 UV，不从原接缝推断分组。不是在保持贴图布局的前提下合并。": {
    "en": "Analyze current geometry, replace the cut plan, and regenerate UVs. Original UVs and original seams never infer groups; texture layout is not preserved.",
    "zh-CN": "分析当前几何并填写参数，替换当前裁切方案、重新生成 UV；不读取原 UV，不从原接缝推断分组。不是在保持贴图布局的前提下合并。"
  },
  "减少碎岛 · 前处理 / 后处理": {
    "en": "Reduce fragmentation · pre / postprocessing",
    "zh-CN": "减少碎岛 · 前处理 / 后处理"
  },
  "Connected first unwrap": {
    "en": "Connected first unwrap",
    "zh-CN": "连通优先展开"
  },
  "前处理：连通优先重分割 + 自动缝合": {
    "en": "Preprocess: connected-first segmentation + stitching",
    "zh-CN": "前处理：连通优先重分割 + 自动缝合"
  },
  "先尝试完整几何连通块与必要开缝，无法通过有效性 / 形变检查才拆分；随后尝试合并相邻岛。会替换当前裁切方案。": {
    "en": "Try complete connected components and necessary cuts before splitting for validity / distortion; then try neighboring-island joins. Replaces the current cut plan.",
    "zh-CN": "先尝试完整几何连通块与必要开缝，无法通过有效性 / 形变检查才拆分；随后尝试合并相邻岛。会替换当前裁切方案。"
  },
  "Stitch current islands": {
    "en": "Stitch current islands",
    "zh-CN": "缝合当前岛"
  },
  "后处理：缝合当前邻岛": {
    "en": "Postprocess: stitch current neighbors",
    "zh-CN": "后处理：缝合当前邻岛"
  },
  "Repack current islands": {
    "en": "Repack current islands",
    "zh-CN": "重排当前岛"
  },
  "只重排当前岛": {
    "en": "Repack current islands only",
    "zh-CN": "只重排当前岛"
  },
  "缝合 = 移除共享接缝并重新求解；只重排 = 岛数不变，消除岛间叠放。当前生成 UV 保留在快照中；新 atlas 需要重烘焙，原岛内部折叠不能靠重排修好。": {
    "en": "Stitching removes a shared seam and solves again; repacking preserves island count and separates placements. Current generated UVs remain in the snapshot; new atlases need rebaking. Repacking cannot fix folds inside an island.",
    "zh-CN": "缝合 = 移除共享接缝并重新求解；只重排 = 岛数不变，消除岛间叠放。当前生成 UV 保留在快照中；新 atlas 需要重烘焙，原岛内部折叠不能靠重排修好。"
  },
  "新 UV 页分配": {
    "en": "New atlas page allocation",
    "zh-CN": "新 UV 页分配"
  },
  "Atlas page mode": {
    "en": "Atlas page mode",
    "zh-CN": "Atlas 页面模式"
  },
  "单页（默认）": {
    "en": "Single page (default)",
    "zh-CN": "单页（默认）"
  },
  "连接紧密的岛优先同页": {
    "en": "Keep strongly connected islands on the same page",
    "zh-CN": "连接紧密的岛优先同页"
  },
  "每个几何连通组一页": {
    "en": "One page per connected component",
    "zh-CN": "每个几何连通组一页"
  },
  "空间邻近 + 共享边优先同页": {
    "en": "Prefer spatial neighbors + shared edges on the same page",
    "zh-CN": "空间邻近 + 共享边优先同页"
  },
  "目标页数（软目标）": {
    "en": "Target pages (soft target)",
    "zh-CN": "目标页数（软目标）"
  },
  "Atlas page count": {
    "en": "Atlas page count",
    "zh-CN": "Atlas 页数"
  },
  "仅对新 atlas 生效，不按材质编号分页；空间模式允许近但断开的部件成为关联组；关联不等于缝合。实际页数可能更多。源材质分框不是此处的新页面。": {
    "en": "Applies only to new atlases, not material IDs. Spatial mode may group nearby disconnected parts; association is not stitching. Actual page count may be higher. Source material frames are separate.",
    "zh-CN": "仅对新 atlas 生效，不按材质编号分页；空间模式允许近但断开的部件成为关联组；关联不等于缝合。实际页数可能更多。源材质分框不是此处的新页面。"
  },
  "Post merge generated charts": {
    "en": "Post merge generated charts",
    "zh-CN": "生成后缝合岛"
  },
  "生成后自动尝试邻岛缝合": {
    "en": "Try neighboring-island joins after generation",
    "zh-CN": "生成后自动尝试邻岛缝合"
  },
  "缝合尝试预算": {
    "en": "Stitch-attempt budget",
    "zh-CN": "缝合尝试预算"
  },
  "Merge attempts": {
    "en": "Merge attempts",
    "zh-CN": "缝合尝试次数"
  },
  "自动：128–512": {
    "en": "Auto: 128–512",
    "zh-CN": "自动：128–512"
  },
  "尝试预算留空：按初始岛数 × 3 自动设置，范围 128–512；手动输入优先。闭环接口优先保留必要开缝，不强制删除整圈。": {
    "en": "Empty budget: initial island count × 3, clamped to 128–512. Explicit values take precedence. Keep necessary loop cuts rather than forcibly removing a complete seam.",
    "zh-CN": "尝试预算留空：按初始岛数 × 3 自动设置，范围 128–512；手动输入优先。闭环接口优先保留必要开缝，不强制删除整圈。"
  },
  "Reuse valid UV shapes": {
    "en": "Reuse valid UV shapes",
    "zh-CN": "复用有效 UV 形状"
  },
  "允许保留形状缝合（手绘模式优先）": {
    "en": "Allow shape-preserving joins (preferred in paint mode)",
    "zh-CN": "允许保留形状缝合（手绘模式优先）"
  },
  "沿真实共享边对齐现有 UV；保留必要开缝，限制两岛平均密度差不超过 25%，仍检查重叠与形变。不因空间靠近而焊接。": {
    "en": "Align current UVs along actual shared edges, retain necessary cuts, and limit average density differences to 25%; still validate overlap and distortion. Nearby positions alone never cause welding.",
    "zh-CN": "沿真实共享边对齐现有 UV；保留必要开缝，限制两岛平均密度差不超过 25%，仍检查重叠与形变。不因空间靠近而焊接。"
  },
  "目标岛数（不牺牲有效性）": {
    "en": "Target island count (preserve validity)",
    "zh-CN": "目标岛数（不牺牲有效性）"
  },
  "Merge target": {
    "en": "Merge target",
    "zh-CN": "目标岛数"
  },
  "Preserve material boundaries": {
    "en": "Preserve material boundaries",
    "zh-CN": "保留材质边界"
  },
  "后处理不跨源材质边界缝合": {
    "en": "Do not stitch across source material boundaries",
    "zh-CN": "后处理不跨源材质边界缝合"
  },
  "空白精排 · 大岛优先": {
    "en": "Fill vacancies · largest islands first",
    "zh-CN": "空白精排 · 大岛优先"
  },
  "Refine current atlas": {
    "en": "Refine current atlas",
    "zh-CN": "精排当前 Atlas"
  },
  "填补空白 + 大岛旧切缝试验": {
    "en": "Fill vacancies + legacy recut experiment",
    "zh-CN": "填补空白 + 大岛旧切缝试验"
  },
  "填补空白（保留当前岛 / 切缝）": {
    "en": "Fill vacancies (preserve current islands / seams)",
    "zh-CN": "填补空白（保留当前岛 / 切缝）"
  },
  "精排模式": {
    "en": "Refinement mode",
    "zh-CN": "精排模式"
  },
  "Fill mode": {
    "en": "Fill mode",
    "zh-CN": "填空模式"
  },
  "从大到小逐岛扩张": {
    "en": "Enlarge islands from largest to smallest",
    "zh-CN": "从大到小逐岛扩张"
  },
  "全岛共同放大（保持密度比例）": {
    "en": "Enlarge all islands together (preserve density ratios)",
    "zh-CN": "全岛共同放大（保持密度比例）"
  },
  "Balanced density preset": {
    "en": "Balanced density preset",
    "zh-CN": "均衡密度预设"
  },
  "密度均衡 · 1.6 倍": {
    "en": "Balanced density · 1.6×",
    "zh-CN": "密度均衡 · 1.6 倍"
  },
  "Bounded growth preset": {
    "en": "Bounded growth preset",
    "zh-CN": "有界放大预设"
  },
  "有界放大 · 3 倍": {
    "en": "Bounded growth · 3×",
    "zh-CN": "有界放大 · 3 倍"
  },
  "Fit enlargement to vacant space": {
    "en": "Fit enlargement to vacant space",
    "zh-CN": "按空位放大"
  },
  "按空位容量放大岛（仍遵守面积密度上限）": {
    "en": "Enlarge islands to fit vacancies (respect density limit)",
    "zh-CN": "按空位容量放大岛（仍遵守面积密度上限）"
  },
  "新默认允许最大 / 最小面积密度差 3 倍，优先大岛，放不下再处理小岛。保留 1.6 倍可对照旧限制；切换预设不立即计算，也不缩小现有岛。": {
    "en": "Default permits up to 3× density difference; try large islands before smaller ones. 1.6× compares the old limit. Preset changes do not compute immediately or shrink existing islands.",
    "zh-CN": "新默认允许最大 / 最小面积密度差 3 倍，优先大岛，放不下再处理小岛。保留 1.6 倍可对照旧限制；切换预设不立即计算，也不缩小现有岛。"
  },
  "每步面积增量 %": {
    "en": "Area increment per step %",
    "zh-CN": "每步面积增量 %"
  },
  "Fill step": {
    "en": "Fill step",
    "zh-CN": "填空步长"
  },
  "相对密度差上限（不限制共同放大）": {
    "en": "Relative density limit (does not limit common enlargement)",
    "zh-CN": "相对密度差上限（不限制共同放大）"
  },
  "Fill area cap": {
    "en": "Fill area cap",
    "zh-CN": "填空面积上限"
  },
  "Cavity-directed fill": {
    "en": "Cavity-directed fill",
    "zh-CN": "空洞引导精排"
  },
  "扫描真实空洞，允许等面积搬移后继续扩张": {
    "en": "Scan actual cavities; allow equal-area relocation before further growth",
    "zh-CN": "扫描真实空洞，允许等面积搬移后继续扩张"
  },
  "每岛每轮连续增长步数": {
    "en": "Growth steps per island per round",
    "zh-CN": "每岛每轮连续增长步数"
  },
  "Fill growth steps": {
    "en": "Fill growth steps",
    "zh-CN": "填空增长步数"
  },
  "共同面积放大上限": {
    "en": "Common area enlargement limit",
    "zh-CN": "共同面积放大上限"
  },
  "Fill common gain limit": {
    "en": "Fill common gain limit",
    "zh-CN": "共同增长上限"
  },
  "补充旋转步长": {
    "en": "Additional rotation step",
    "zh-CN": "补充旋转步长"
  },
  "Fill rotation step": {
    "en": "Fill rotation step",
    "zh-CN": "填空旋转步长"
  },
  "90°（快速）": {
    "en": "90° (fast)",
    "zh-CN": "90°（快速）"
  },
  "15°（更慢）": {
    "en": "15° (slower)",
    "zh-CN": "15°（更慢）"
  },
  "允许前方大岛重新排布次数": {
    "en": "Reflow attempts for preceding large islands",
    "zh-CN": "允许前方大岛重新排布次数"
  },
  "Fill reflow budget": {
    "en": "Fill reflow budget",
    "zh-CN": "填空重排预算"
  },
  "直角与补充方向共同比较；空洞扫描可先搬移，再继续增长。空间被前面大岛锁住时有限重排。共同放大与岛间密度差分开限制，小岛不缩水。报告明确剩余未尝试岛与停止原因。": {
    "en": "Compare orthogonal and additional angles. Cavity search may relocate before growing; bounded reflow can release space locked by preceding islands. Common growth and density differences have separate limits; small islands do not shrink. Reports identify untried islands and stop reasons.",
    "zh-CN": "直角与补充方向共同比较；空洞扫描可先搬移，再继续增长。空间被前面大岛锁住时有限重排。共同放大与岛间密度差分开限制，小岛不缩水。报告明确剩余未尝试岛与停止原因。"
  },
  "最小面积步长 %": {
    "en": "Minimum area step %",
    "zh-CN": "最小面积步长 %"
  },
  "Fill minimum step": {
    "en": "Fill minimum step",
    "zh-CN": "填空最小步长"
  },
  "最大轮数": {
    "en": "Maximum rounds",
    "zh-CN": "最大轮数"
  },
  "Fill rounds": {
    "en": "Fill rounds",
    "zh-CN": "填空轮数"
  },
  "轮廓搜索网格": {
    "en": "Contour search grid",
    "zh-CN": "轮廓搜索网格"
  },
  "Fill resolution": {
    "en": "Fill resolution",
    "zh-CN": "填空分辨率"
  },
  "256（快速 / 保守）": {
    "en": "256 (fast / conservative)",
    "zh-CN": "256（快速 / 保守）"
  },
  "512（默认）": {
    "en": "512 (default)",
    "zh-CN": "512（默认）"
  },
  "1024（更细 / 更慢）": {
    "en": "1024 (finer / slower)",
    "zh-CN": "1024（更细 / 更慢）"
  },
  "精排搜索预算（秒）": {
    "en": "Refinement search budget (seconds)",
    "zh-CN": "精排搜索预算（秒）"
  },
  "Fill budget": {
    "en": "Fill budget",
    "zh-CN": "填空预算"
  },
  "不缩小其他岛腾空间，不拉伸宽高。8% 面积增量约为 3.9% 边长；默认岛间密度差上限 3 倍，共同放大另限 4 倍。轮廓栅格可利用凹口，但不保证最优。仅支持有效单页；生成无重叠 UV 后再精排。可在预算停止后继续精排，不会无界累积大岛密度。": {
    "en": "Do not shrink other islands or stretch aspect ratios. 8% area is about 3.9% edge growth. Default density difference limit is 3×; common growth is separately limited to 4×. Contour rasterization uses notches but cannot guarantee an optimum. Valid single-page atlases only. Refinement may continue after a budget stop without unbounded density growth.",
    "zh-CN": "不缩小其他岛腾空间，不拉伸宽高。8% 面积增量约为 3.9% 边长；默认岛间密度差上限 3 倍，共同放大另限 4 倍。轮廓栅格可利用凹口，但不保证最优。仅支持有效单页；生成无重叠 UV 后再精排。可在预算停止后继续精排，不会无界累积大岛密度。"
  },
  "大岛旧切缝试验：": {
    "en": "Legacy recut experiment:",
    "zh-CN": "大岛旧切缝试验："
  },
  "个候选，": {
    "en": "candidates,",
    "zh-CN": "个候选，"
  },
  "接受一次切分": {
    "en": "one split accepted",
    "zh-CN": "接受一次切分"
  },
  "未接受，原岛保留": {
    "en": "not accepted; original island retained",
    "zh-CN": "未接受，原岛保留"
  },
  "可检查形状 / 切缝的岛：": {
    "en": "Islands available for shape / seam inspection:",
    "zh-CN": "可检查形状 / 切缝的岛："
  },
  "#{0}（轮廓/框 {1}%）": {
    "en": "#{0} (contour / box {1}%)",
    "zh-CN": "#{0}（轮廓/框 {1}%）"
  },
  "。只是诊断，不会自动再切。": {
    "en": ". Diagnostic only; never recuts automatically.",
    "zh-CN": "。只是诊断，不会自动再切。"
  },
  "面积与空间邻居": {
    "en": "Area and spatial neighbors",
    "zh-CN": "面积与空间邻居"
  },
  "无重叠不等于可辨识：当前生成 UV 将主要平面特征拉成陌生轮廓时，局部重新分组和剥展。其余有效原岛保留。不按模型名称识别；几何生成、只重排与填空不重解形状。": {
    "en": "No overlap does not prove recognizable shapes. Locally regroup and peel generated UVs whose major planar features have unfamiliar contours; preserve other valid islands. Model names are not classifiers. Generation, repacking, and fill do not re-solve these shapes.",
    "zh-CN": "无重叠不等于可辨识：当前生成 UV 将主要平面特征拉成陌生轮廓时，局部重新分组和剥展。其余有效原岛保留。不按模型名称识别；几何生成、只重排与填空不重解形状。"
  },
  "当前生成 UV 可辨识性：检查": {
    "en": "Generated-UV recognition: inspect",
    "zh-CN": "当前生成 UV 可辨识性：检查"
  },
  "个主要平面特征，重展": {
    "en": "major planar features; re-unfold",
    "zh-CN": "个主要平面特征，重展"
  },
  "个原岛": {
    "en": "existing islands",
    "zh-CN": "个原岛"
  },
  "个源岛 →": {
    "en": "source islands →",
    "zh-CN": "个源岛 →"
  },
  "个结果岛（缝合后）": {
    "en": "result islands (after stitching)",
    "zh-CN": "个结果岛（缝合后）"
  },
  "特征组与 UV 对应": {
    "en": "Feature / UV correspondence",
    "zh-CN": "特征组与 UV 对应"
  },
  "原 #": {
    "en": "Original #",
    "zh-CN": "原 #"
  },
  "仅重新求解含内部重叠、混合翻面或退化的岛；其余通过轮廓检查的岛保留形状。失败不返回部分 atlas，几何生成永不改坐标。": {
    "en": "Re-solve islands with internal overlap, mixed orientation, or degeneracy; preserve others that pass contour checks. Failure never returns a partial atlas. Geometry generation never moves 3D coordinates.",
    "zh-CN": "仅重新求解含内部重叠、混合翻面或退化的岛；其余通过轮廓检查的岛保留形状。失败不返回部分 atlas，几何生成永不改坐标。"
  },
  "放置顺序": {
    "en": "Placement order",
    "zh-CN": "放置顺序"
  },
  "Packing order": {
    "en": "Packing order",
    "zh-CN": "排布顺序"
  },
  "3D 面积由大到小（默认）": {
    "en": "Descending 3D area (default)",
    "zh-CN": "3D 面积由大到小（默认）"
  },
  "旧长边 / 包围盒启发式": {
    "en": "Legacy longest-edge / bounding-box heuristic",
    "zh-CN": "旧长边 / 包围盒启发式"
  },
  "小岛目标面积占比（%）": {
    "en": "Target area share for tiny islands (%)",
    "zh-CN": "小岛目标面积占比（%）"
  },
  "Tiny area fraction": {
    "en": "Tiny area fraction",
    "zh-CN": "小岛面积占比"
  },
  "小岛面积放大上限": {
    "en": "Tiny-island area enlargement cap",
    "zh-CN": "小岛面积放大上限"
  },
  "Tiny area cap": {
    "en": "Tiny area cap",
    "zh-CN": "小岛面积上限"
  },
  "默认 0 / 1：严格统一平均面积密度。面积上限 2 倍时边长最多 √2 倍。所有岛共同缩放，不独立压扁 U/V。": {
    "en": "Default 0 / 1 gives strictly uniform average area density. 2× area means at most √2× edge length. Scale all islands together; never flatten U/V independently.",
    "zh-CN": "默认 0 / 1：严格统一平均面积密度。面积上限 2 倍时边长最多 √2 倍。所有岛共同缩放，不独立压扁 U/V。"
  },
  "Spatial neighbors": {
    "en": "Spatial neighbors",
    "zh-CN": "空间邻居"
  },
  "用 3D 空间邻居辅助排布": {
    "en": "Use 3D spatial neighbors to assist packing",
    "zh-CN": "用 3D 空间邻居辅助排布"
  },
  "邻近距离（模型最长边 %）": {
    "en": "Neighbor distance (% of longest model side)",
    "zh-CN": "邻近距离（模型最长边 %）"
  },
  "Neighbor distance": {
    "en": "Neighbor distance",
    "zh-CN": "邻居距离"
  },
  "近邻只是空间关联，不能直接证明两面可缝合。表面采样会漏检；预算截断会明确报告。": {
    "en": "Proximity is only an association, not proof of a stitchable seam. Surface sampling can miss relationships; budget truncation is reported.",
    "zh-CN": "近邻只是空间关联，不能直接证明两面可缝合。表面采样会漏检；预算截断会明确报告。"
  },
  "当前": {
    "en": "Current",
    "zh-CN": "当前"
  },
  "岛 /": {
    "en": "islands /",
    "zh-CN": "岛 /"
  },
  "个空间关联组": {
    "en": "spatial groups",
    "zh-CN": "个空间关联组"
  },
  "平均面积密度异常：偏大": {
    "en": "Area-density outliers: oversized",
    "zh-CN": "平均面积密度异常：偏大"
  },
  "，偏小": {
    "en": ", undersized",
    "zh-CN": "，偏小"
  },
  "。选岛可看具体比例与邻居。": {
    "en": ". Select an island to inspect ratios and neighbors.",
    "zh-CN": "。选岛可看具体比例与邻居。"
  },
  "原样视图未修正面积或重叠。": {
    "en": "Inspection does not correct area or overlap.",
    "zh-CN": "原样视图未修正面积或重叠。"
  },
  "当前为新 atlas；原输入的重叠报告仅供对照。": {
    "en": "Current result is a new atlas; input overlap reports are comparison diagnostics only.",
    "zh-CN": "当前为新 atlas；原输入的重叠报告仅供对照。"
  },
  "原输入 UV 岛数：": {
    "en": "Input UV island count:",
    "zh-CN": "原输入 UV 岛数："
  },
  "（不按可见轮廓计数）": {
    "en": "(not counted from visible contours)",
    "zh-CN": "（不按可见轮廓计数）"
  },
  "岛 ·": {
    "en": "islands ·",
    "zh-CN": "岛 ·"
  },
  "至少 ": {
    "en": "at least",
    "zh-CN": "至少 "
  },
  "对正面积重叠 ·": {
    "en": "positive-area overlap pairs ·",
    "zh-CN": "对正面积重叠 ·"
  },
  "退化面": {
    "en": "degenerate faces",
    "zh-CN": "退化面"
  },
  "重叠可能是有意复用；需要唯一新 atlas 时使用前处理或后处理。“几何生成”只读取；“Extract + 整理”生成新 atlas，但保留原始输入。": {
    "en": "Input UV diagnostics describe historical experiments; current production generation uses only geometry and never falls back to original UVs.",
    "zh-CN": "重叠可能是有意复用；需要唯一新 atlas 时使用前处理或后处理。“几何生成”只读取；“Extract + 整理”生成新 atlas，但保留原始输入。"
  },
  "原岛局部修复：": {
    "en": "Legacy island repair:",
    "zh-CN": "原岛局部修复："
  },
  "原岛 #{0} · {1} 面 · {2}": {
    "en": "Legacy island #{0} · {1} faces · {2}",
    "zh-CN": "原岛 #{0} · {1} 面 · {2}"
  },
  "无需修复": {
    "en": "No repair needed",
    "zh-CN": "无需修复"
  },
  "其余": {
    "en": "Other",
    "zh-CN": "其余"
  },
  "岛通过有效性检查（仍须检查轮廓，后续可验证缝合），源数据未修改。": {
    "en": "islands pass validity checks (contours and later joins still need validation); source data is unchanged.",
    "zh-CN": "岛通过有效性检查（仍须检查轮廓，后续可验证缝合），源数据未修改。"
  },
  "邻岛缝合：": {
    "en": "Neighboring-island joins:",
    "zh-CN": "邻岛缝合："
  },
  "岛": {
    "en": "islands",
    "zh-CN": "岛"
  },
  "接受": {
    "en": "Accepted",
    "zh-CN": "接受"
  },
  "次 / 求解尝试": {
    "en": "times / solver attempts",
    "zh-CN": "次 / 求解尝试"
  },
  "次 · 移除": {
    "en": "times · removed",
    "zh-CN": "次 · 移除"
  },
  "条接缝": {
    "en": "seams",
    "zh-CN": "条接缝"
  },
  "保留开缝连接": {
    "en": "Partial joins retaining cuts",
    "zh-CN": "保留开缝连接"
  },
  "次 · 保留形状缝合": {
    "en": "times · shape-preserving joins",
    "zh-CN": "次 · 保留形状缝合"
  },
  "次 · 拒绝原因：": {
    "en": "times · rejection reasons:",
    "zh-CN": "次 · 拒绝原因："
  },
  "已达预算，可提高预算或对当前结果继续缝合。": {
    "en": "Budget reached; increase it or continue stitching the current result.",
    "zh-CN": "已达预算，可提高预算或对当前结果继续缝合。"
  },
  "未强行合并不能通过检查的区域。": {
    "en": "Regions failing checks were not forcibly merged.",
    "zh-CN": "未强行合并不能通过检查的区域。"
  },
  "新 atlas：": {
    "en": "New atlas:",
    "zh-CN": "新 atlas："
  },
  "页 · 同页保留": {
    "en": "pages · retained",
    "zh-CN": "页 · 同页保留"
  },
  "% 的共享边界长度；使用统一纹素密度。每页占用率见诊断 JSON。": {
    "en": "% of shared boundary length on the same page; uniform texel density. Per-page occupancy is in diagnostic JSON.",
    "zh-CN": "% 的共享边界长度；使用统一纹素密度。每页占用率见诊断 JSON。"
  },
  "分框偏移只用于对应动画与显示；不是把多张材质贴图合成一张。导出保留原坐标及材质分组。": {
    "en": "Display-frame offsets only affect correspondence and animation; they do not combine material textures. Export retains generated coordinates and material groups.",
    "zh-CN": "分框偏移只用于对应动画与显示；不是把多张材质贴图合成一张。导出保留原坐标及材质分组。"
  },
  "分区策略": {
    "en": "Segmentation policy",
    "zh-CN": "分区策略"
  },
  "Chart policy": {
    "en": "Chart policy",
    "zh-CN": "分区策略"
  },
  "大块优先 · 连通分区 + 短路径开缝": {
    "en": "Large regions · connected partitions + short-path cuts",
    "zh-CN": "大块优先 · 连通分区 + 短路径开缝"
  },
  "均衡 · 更严格的形变限制": {
    "en": "Balanced · stricter distortion limits",
    "zh-CN": "均衡 · 更严格的形变限制"
  },
  "传统碎片化参数（回归对比）": {
    "en": "Legacy fragmented parameters (regression comparison)",
    "zh-CN": "传统碎片化参数（回归对比）"
  },
  "参数化": {
    "en": "Parameterization",
    "zh-CN": "参数化"
  },
  "UV solver": {
    "en": "UV solver",
    "zh-CN": "UV 求解器"
  },
  "自动（按当前 UV 目标）": {
    "en": "Auto (according to UV objective)",
    "zh-CN": "自动（按当前 UV 目标）"
  },
  "仅 LSCM（无效时补切或报错）": {
    "en": "LSCM only (cut or report errors when invalid)",
    "zh-CN": "仅 LSCM（无效时补切或报错）"
  },
  "强制圆边界 Tutte（诊断用）": {
    "en": "Circular-boundary Tutte (diagnostic)",
    "zh-CN": "强制圆边界 Tutte（诊断用）"
  },
  "允许必要的拓扑 / 形变补切": {
    "en": "Allow necessary topology / distortion cuts",
    "zh-CN": "允许必要的拓扑 / 形变补切"
  },
  "关闭后严格保留输入接缝；无法有效求解时明确报错。所有补切都会在 3D / UV 中显示。": {
    "en": "Disabling this strictly preserves supplied seams and reports unsolvable cases. Additional cuts are visible in both 3D and UV views.",
    "zh-CN": "关闭后严格保留输入接缝；无法有效求解时明确报错。所有补切都会在 3D / UV 中显示。"
  },
  "UV 留白（每侧）": {
    "en": "UV padding (per side)",
    "zh-CN": "UV 留白（每侧）"
  },
  "允许旋转排布（不拉伸岛的宽高）": {
    "en": "Allow packing rotations (preserve aspect ratios)",
    "zh-CN": "允许旋转排布（不拉伸岛的宽高）"
  },
  "排布策略": {
    "en": "Packing strategy",
    "zh-CN": "排布策略"
  },
  "UV packing": {
    "en": "UV packing",
    "zh-CN": "UV 排布"
  },
  "自动：小岛数 MaxRects / 大岛数 Shelf": {
    "en": "Auto: MaxRects for fewer islands / Shelf for many",
    "zh-CN": "自动：小岛数 MaxRects / 大岛数 Shelf"
  },
  "MaxRects（最多 1024 岛）": {
    "en": "MaxRects (up to 1024 islands)",
    "zh-CN": "MaxRects（最多 1024 岛）"
  },
  "Shelf 面积感知快速排布": {
    "en": "Shelf · area-aware fast packing",
    "zh-CN": "Shelf 面积感知快速排布"
  },
  "自动模式超过 256 个岛改用 Shelf；不改变裁切线、留白或统一纹素密度。排布空隙可能不同。": {
    "en": "Auto switches to Shelf above 256 islands. Cuts, padding, and uniform texel density stay unchanged; vacancies may differ.",
    "zh-CN": "自动模式超过 256 个岛改用 Shelf；不改变裁切线、留白或统一纹素密度。排布空隙可能不同。"
  },
  "UV 任务预算（秒）": {
    "en": "UV task budget (seconds)",
    "zh-CN": "UV 任务预算（秒）"
  },
  "UV time budget": {
    "en": "UV time budget",
    "zh-CN": "UV 时间预算"
  },
  "单岛面数预算": {
    "en": "Face budget per island",
    "zh-CN": "单岛面数预算"
  },
  "长宽比补切阈值": {
    "en": "Aspect-ratio recut threshold",
    "zh-CN": "长宽比补切阈值"
  },
  "形变控制的源表面积比例": {
    "en": "Source-area fraction for distortion control",
    "zh-CN": "形变控制的源表面积比例"
  },
  "Stretch area percentile": {
    "en": "Stretch area percentile",
    "zh-CN": "拉伸面积百分位"
  },
  "99 表示允许最多 1% 表面积的微小细节超过软形变阈值，不因此反复切碎整岛；100 恢复最坏面控制。真实翻面、退化、交叠仍禁止。": {
    "en": "99 permits at most 1% of surface area in tiny details to exceed soft distortion limits without repeatedly fragmenting an island. 100 restores worst-face control. Flips, degeneracy, and overlaps remain prohibited.",
    "zh-CN": "99 表示允许最多 1% 表面积的微小细节超过软形变阈值，不因此反复切碎整岛；100 恢复最坏面控制。真实翻面、退化、交叠仍禁止。"
  },
  "角形变阈值（奇异值比）": {
    "en": "Angular distortion threshold (singular-value ratio)",
    "zh-CN": "角形变阈值（奇异值比）"
  },
  "区域与数值求解设置": {
    "en": "Regions and numerical solver",
    "zh-CN": "区域与数值求解设置"
  },
  "区域法线锥角（度）": {
    "en": "Region normal-cone angle (degrees)",
    "zh-CN": "区域法线锥角（度）"
  },
  "小区域表面积比": {
    "en": "Minimum region area ratio",
    "zh-CN": "小区域表面积比"
  },
  "这些区域设置在 Generate baseline 或无约束 UV 求解时生效；已经固定的接缝不会被“应用”偷偷删除。": {
    "en": "These settings apply to baseline generation or unconstrained solving. Applying parameters never silently removes fixed seams.",
    "zh-CN": "这些区域设置在 Generate baseline 或无约束 UV 求解时生效；已经固定的接缝不会被“应用”偷偷删除。"
  },
  "最大迭代": {
    "en": "Maximum iterations",
    "zh-CN": "最大迭代"
  },
  "相对残差目标": {
    "en": "Relative residual target",
    "zh-CN": "相对残差目标"
  },
  "岛 / 包围盒最小面积比": {
    "en": "Minimum island / bounding-box area ratio",
    "zh-CN": "岛 / 包围盒最小面积比"
  },
  "应用并重新展开": {
    "en": "Apply and regenerate",
    "zh-CN": "应用并重新展开"
  },
  "恢复默认（固定参数）": {
    "en": "Restore defaults (fixed parameters)",
    "zh-CN": "恢复默认（固定参数）"
  },
  "实际方法：": {
    "en": "Actual methods:",
    "zh-CN": "实际方法："
  },
  "。source-shape 为保留原形，planar-shape 为平面轮廓，arap-free 为自由边界。": {
    "en": ". source-shape preserves a current shape; planar-shape preserves planar contours; arap-free uses free boundaries.",
    "zh-CN": "。source-shape 为保留原形，planar-shape 为平面轮廓，arap-free 为自由边界。"
  },
  "分裂来源：": {
    "en": "Split origins:",
    "zh-CN": "分裂来源："
  },
  "个原几何连通分量 →": {
    "en": "original geometry components →",
    "zh-CN": "个原几何连通分量 →"
  },
  "个初始区域 →": {
    "en": "initial regions →",
    "zh-CN": "个初始区域 →"
  },
  "个最终岛；小于16面：": {
    "en": "final islands; under 16 faces:",
    "zh-CN": "个最终岛；小于16面："
  },
  "补切原因：": {
    "en": "Additional-cut reasons:",
    "zh-CN": "补切原因："
  },
  "有效 UV 占用": {
    "en": "Valid UV occupancy",
    "zh-CN": "有效 UV 占用"
  },
  "包围盒面积总和": {
    "en": "Bounding-box area sum",
    "zh-CN": "包围盒面积总和"
  },
  "%（可互相覆盖）": {
    "en": "% (boxes may overlap)",
    "zh-CN": "%（可互相覆盖）"
  },
  "条补切 ·": {
    "en": "additional cuts ·",
    "zh-CN": "条补切 ·"
  },
  "个 Tutte 岛": {
    "en": "Tutte islands",
    "zh-CN": "个 Tutte 岛"
  },
  "实际排布：": {
    "en": "Actual packing:",
    "zh-CN": "实际排布："
  },
  "生成 UV 已检查翻面、退化和正面积重叠": {
    "en": "Generated UVs were checked for flips, degeneracy, and positive-area overlap",
    "zh-CN": "生成 UV 已检查翻面、退化和正面积重叠"
  },
  "UV 计算任务": {
    "en": "UV generation task",
    "zh-CN": "UV 计算任务"
  },
  "已完成 · {0} 个岛 · {1} 秒": {
    "en": "Completed · {0} islands · {1} s",
    "zh-CN": "已完成 · {0} 个岛 · {1} 秒"
  },
  "已接受有效对应面": {
    "en": "Accepted valid corresponding faces",
    "zh-CN": "已接受有效对应面"
  },
  "面数进度不含后续排布与铰链准备；并非任务总百分比。": {
    "en": "Face progress excludes later packing and hinge preparation; it is not total task progress.",
    "zh-CN": "面数进度不含后续排布与铰链准备；并非任务总百分比。"
  },
  "取消 UV 计算": {
    "en": "Cancel UV generation",
    "zh-CN": "取消 UV 计算"
  },
  "重新计算 UV": {
    "en": "Recompute UVs",
    "zh-CN": "重新计算 UV"
  },
  "仅从几何生成 UV，不读取原始 UV 或用其回退。取消不会改变输入模型。": {
    "en": "Generate from geometry only; never read or fall back to original UVs. Cancellation leaves the input mesh unchanged.",
    "zh-CN": "仅从几何生成 UV，不读取原始 UV 或用其回退。取消不会改变输入模型。"
  },
  "选择与对应": {
    "en": "Selection and correspondence",
    "zh-CN": "选择与对应"
  },
  "三角形": {
    "en": "Triangle",
    "zh-CN": "三角形"
  },
  "未选择": {
    "en": "Nothing selected",
    "zh-CN": "未选择"
  },
  "当前选择": {
    "en": "Current selection",
    "zh-CN": "当前选择"
  },
  "UV 岛 {0}": {
    "en": "UV islands {0}",
    "zh-CN": "UV 岛 {0}"
  },
  "未选择 UV 岛": {
    "en": "No UV island selected",
    "zh-CN": "未选择 UV 岛"
  },
  "未选择三角形": {
    "en": "No triangle selected",
    "zh-CN": "未选择三角形"
  },
  "三角形 {0}": {
    "en": "Triangle {0}",
    "zh-CN": "三角形 {0}"
  },
  "在已选岛内点击三角形查看坐标；再次点击该面取消。": {
    "en": "Click a triangle inside selected islands to inspect coordinates; click again to clear it.",
    "zh-CN": "在已选岛内点击三角形查看坐标；再次点击该面取消。"
  },
  "点击任一视图或岛列表选择 UV 岛，再点击岛内三角形。": {
    "en": "Select an island in either view or the island list, then a triangle inside it.",
    "zh-CN": "点击任一视图或岛列表选择 UV 岛，再点击岛内三角形。"
  },
  "取消三角形": {
    "en": "Clear triangle",
    "zh-CN": "取消三角形"
  },
  "三角面": {
    "en": "Triangles",
    "zh-CN": "三角面"
  },
  "材质空间": {
    "en": "Material space",
    "zh-CN": "材质空间"
  },
  "默认": {
    "en": "Default",
    "zh-CN": "默认"
  },
  "求解方式": {
    "en": "Solver method",
    "zh-CN": "求解方式"
  },
  "最大形变比": {
    "en": "Maximum distortion ratio",
    "zh-CN": "最大形变比"
  },
  "几何特征保护": {
    "en": "Protected geometry features",
    "zh-CN": "几何特征保护"
  },
  "透孔主面 · 保留": {
    "en": "Main sheet · retained",
    "zh-CN": "透孔主面 · 保留"
  },
  "个孔": {
    "en": "holes",
    "zh-CN": "个孔"
  },
  "边界最大变化": {
    "en": "Maximum boundary change",
    "zh-CN": "边界最大变化"
  },
  "% 参考轮廓直径": {
    "en": "% of reference contour diameter",
    "zh-CN": "% 参考轮廓直径"
  },
  "孔面积比例": {
    "en": "Hole-area ratios",
    "zh-CN": "孔面积比例"
  },
  "度量范围": {
    "en": "Metric scope",
    "zh-CN": "度量范围"
  },
  "相对源几何投影；去除整体旋转与尺度。不是原 UV，也不是人工语义评分。": {
    "en": "Relative to source geometry projection after removing overall rotation and scale. Not original UVs or a human semantic score.",
    "zh-CN": "相对源几何投影；去除整体旋转与尺度。不是原 UV，也不是人工语义评分。"
  },
  "内在长度松弛：": {
    "en": "Intrinsic length relaxation:",
    "zh-CN": "内在长度松弛："
  },
  "次接受；能量": {
    "en": "accepted iterations; energy",
    "zh-CN": "次接受；能量"
  },
  "。不读取参考 UV。": {
    "en": ". Reference UVs are never read.",
    "zh-CN": "。不读取参考 UV。"
  },
  "结构来源": {
    "en": "Structure source",
    "zh-CN": "结构来源"
  },
  "原区域 #": {
    "en": "Original region #",
    "zh-CN": "原区域 #"
  },
  "上/下边界": {
    "en": "Upper / lower boundaries",
    "zh-CN": "上/下边界"
  },
  "个源顶点": {
    "en": "source vertices",
    "zh-CN": "个源顶点"
  },
  "真实侧缝": {
    "en": "Actual side seams",
    "zh-CN": "真实侧缝"
  },
  "条源网格边 · 不属于动画临时切缝": {
    "en": "source mesh edges · separate from temporary animation cuts",
    "zh-CN": "条源网格边 · 不属于动画临时切缝"
  },
  "同组面片": {
    "en": "Faces in the same group",
    "zh-CN": "同组面片"
  },
  "本轮实际面积增益": {
    "en": "Actual area gain in this run",
    "zh-CN": "本轮实际面积增益"
  },
  "本轮实际边长增益": {
    "en": "Actual edge-length gain in this run",
    "zh-CN": "本轮实际边长增益"
  },
  "增长停止依据": {
    "en": "Growth stop reason",
    "zh-CN": "增长停止依据"
  },
  "3D 表面积占比（同域）": {
    "en": "3D area share (same domain)",
    "zh-CN": "3D 表面积占比（同域）"
  },
  "UV 面积占比（同域）": {
    "en": "UV area share (same domain)",
    "zh-CN": "UV 面积占比（同域）"
  },
  "相对平均面积密度": {
    "en": "Relative average area density",
    "zh-CN": "相对平均面积密度"
  },
  "无效": {
    "en": "Invalid",
    "zh-CN": "无效"
  },
  "3D 邻居 ·": {
    "en": "3D neighbors ·",
    "zh-CN": "3D 邻居 ·"
  },
  "共享网格边，可作为缝合候选": {
    "en": "Shared mesh edge; stitch candidate",
    "zh-CN": "共享网格边，可作为缝合候选"
  },
  "空间接近，仅关联": {
    "en": "Spatial proximity only",
    "zh-CN": "空间接近，仅关联"
  },
  "% 模型边长": {
    "en": "% of model side length",
    "zh-CN": "% 模型边长"
  },
  "空间关联不改变真实岛数，未列出的关系可能被采样或预算遗漏。": {
    "en": "Spatial association does not change island count; sampling or budgets may omit relationships.",
    "zh-CN": "空间关联不改变真实岛数，未列出的关系可能被采样或预算遗漏。"
  },
  "面角坐标": {
    "en": "Face-corner coordinates",
    "zh-CN": "面角坐标"
  },
  "角": {
    "en": "Corner",
    "zh-CN": "角"
  },
  "顶点": {
    "en": "Vertex",
    "zh-CN": "顶点"
  },
  "3D": {
    "en": "3D",
    "zh-CN": "3D"
  },
  "UV": {
    "en": "UV",
    "zh-CN": "UV"
  },
  "对应规则": {
    "en": "Correspondence rules",
    "zh-CN": "对应规则"
  },
  "同色、同编号表示同一个 UV 岛。三角形和顶点索引从 0 开始；岛编号从 1 开始。显示分框不修改导出的原 UV 坐标。": {
    "en": "Matching colors and IDs identify one UV island. Triangles and vertices are zero-based; island IDs are one-based. Display frames do not change exported UV coordinates.",
    "zh-CN": "同色、同编号表示同一个 UV 岛。三角形和顶点索引从 0 开始；岛编号从 1 开始。显示分框不修改导出的原 UV 坐标。"
  },
  "Esc 先取消三角形，再取消岛。Shift / Ctrl / ⌘ 点击增减岛，不选择面。": {
    "en": "Esc clears the triangle before islands. Shift / Ctrl / ⌘ clicks add/remove islands without selecting faces.",
    "zh-CN": "Esc 先取消三角形，再取消岛。Shift / Ctrl / ⌘ 点击增减岛，不选择面。"
  },
  "三角形选择不会改变播放范围、动画进度或相机位置。": {
    "en": "Triangle selection never changes playback scope, progress, or camera position.",
    "zh-CN": "三角形选择不会改变播放范围、动画进度或相机位置。"
  },
  "UV 质量与说明": {
    "en": "UV quality and notes",
    "zh-CN": "UV 质量与说明"
  },
  " · {0} 条": {
    "en": " · {0} notes",
    "zh-CN": " · {0} 条"
  },
  "有效面积": {
    "en": "Occupied area",
    "zh-CN": "有效面积"
  },
  "% · 包围盒": {
    "en": "% · bounding boxes",
    "zh-CN": "% · 包围盒"
  },
  "紫色临时断边只用于展开动画，不写入导出。刚性展开与 UV 参数化为不同阶段，动画不处理自碰撞。": {
    "en": "Purple temporary edges are for unfolding animation only and are never exported. Rigid unfolding and UV parameterization are separate stages; animation does not solve self-collision.",
    "zh-CN": "紫色临时断边只用于展开动画，不写入导出。刚性展开与 UV 参数化为不同阶段，动画不处理自碰撞。"
  },
  "展开视图不可用": {
    "en": "Unfold view unavailable",
    "zh-CN": "展开视图不可用"
  },
  "Retry unfold preview": {
    "en": "Retry unfold preview",
    "zh-CN": "重试展开预览"
  },
  "尾段接力": {
    "en": "Tail relay",
    "zh-CN": "尾段接力"
  },
  "个岛": {
    "en": "islands",
    "zh-CN": "个岛"
  },
  "黄色：UV 裁切 · 青色：铰链轴 · 紫色虚线：临时断边（不导出）": {
    "en": "Yellow: UV cuts · cyan: hinge axes · purple dashes: temporary edges (not exported)",
    "zh-CN": "黄色：UV 裁切 · 青色：铰链轴 · 紫色虚线：临时断边（不导出）"
  },
  "播放时也可自由操作：拖动旋转 · 滚轮缩放 · 右键平移 · 先选岛，再选面 · 重复点击取消面 · Shift 多选": {
    "en": "Free camera during playback: drag to orbit · wheel to zoom · right-drag to pan · select island, then face · click again to clear face · Shift for multi-select",
    "zh-CN": "播放时也可自由操作：拖动旋转 · 滚轮缩放 · 右键平移 · 先选岛，再选面 · 重复点击取消面 · Shift 多选"
  },
  "Language": {
    "en": "Language",
    "zh-CN": "语言"
  },
  "Theme": {
    "en": "Theme",
    "zh-CN": "主题"
  },
  "Light": {
    "en": "Light",
    "zh-CN": "白天"
  },
  "Dark": {
    "en": "Dark",
    "zh-CN": "黑夜"
  },
  "Display preferences": {
    "en": "Display preferences",
    "zh-CN": "显示偏好"
  },
  "Ready. Choose an offline mesh or import OBJ / FBX / GLB / GLTF.": {
    "en": "Ready. Choose an offline mesh or import OBJ / FBX / GLB / GLTF.",
    "zh-CN": "已就绪。选择本地样例或导入 OBJ / FBX / GLB / GLTF。"
  },
  "Loaded {0}: {1} triangles.": {
    "en": "Loaded {0}: {1} triangles.",
    "zh-CN": "已载入 {0}：{1} 个三角面。"
  },
  "Importing mesh…": {
    "en": "Importing mesh…",
    "zh-CN": "正在导入网格…"
  },
  "Loading {0}…": {
    "en": "Loading {0}…",
    "zh-CN": "正在载入 {0}…"
  },
  "Loading bundled FBX example…": {
    "en": "Loading bundled FBX example…",
    "zh-CN": "正在载入内置 FBX 样例…"
  },
  "Operation cancelled.": {
    "en": "Operation cancelled.",
    "zh-CN": "操作已取消。"
  },
  "原始 3D": {
    "en": "Original 3D",
    "zh-CN": "原始 3D"
  },
  "分块陈列": {
    "en": "Separate pieces",
    "zh-CN": "分块陈列"
  },
  "转向观察": {
    "en": "Orient for inspection",
    "zh-CN": "转向观察"
  },
  "铰链展平": {
    "en": "Flatten hinges",
    "zh-CN": "铰链展平"
  },
  "检查平面网": {
    "en": "Inspect rigid net",
    "zh-CN": "检查平面网"
  },
  "UV 形变": {
    "en": "UV morph",
    "zh-CN": "UV 形变"
  },
  "Atlas 排布": {
    "en": "Atlas packing",
    "zh-CN": "Atlas 排布"
  },
  "validate": {
    "en": "Validate input",
    "zh-CN": "验证输入"
  },
  "topology": {
    "en": "Prepare topology",
    "zh-CN": "准备拓扑"
  },
  "charts": {
    "en": "Build regions and cuts",
    "zh-CN": "构建区域与切缝"
  },
  "parameterize": {
    "en": "Parameterize UVs",
    "zh-CN": "求解 UV"
  },
  "quality": {
    "en": "Validate UV quality",
    "zh-CN": "验证 UV 质量"
  },
  "orient": {
    "en": "Orient islands",
    "zh-CN": "调整岛方向"
  },
  "pack": {
    "en": "Pack atlas",
    "zh-CN": "排布 Atlas"
  },
  "correspondence": {
    "en": "Build 3D / UV correspondence",
    "zh-CN": "建立 3D / UV 对应"
  },
  "hinge": {
    "en": "Prepare hinge animation",
    "zh-CN": "准备铰链动画"
  },
  "transfer": {
    "en": "Transfer result",
    "zh-CN": "传输结果"
  },
  "UV progress: {0}{1} · accepted {2}/{3} faces · {4} s elapsed": {
    "en": "UV progress: {0}{1} · accepted {2}/{3} faces · {4} s elapsed",
    "zh-CN": "UV 进度：{0}{1} · 已接受 {2}/{3} 面 · 已用 {4} 秒"
  },
  "UV progress: {0}{1} · {2} s elapsed": {
    "en": "UV progress: {0}{1} · {2} s elapsed",
    "zh-CN": "UV 进度：{0}{1} · 已用 {2} 秒"
  },
  "yes": {
    "en": "yes",
    "zh-CN": "是"
  },
  "no": {
    "en": "no",
    "zh-CN": "否"
  },
  "Play": {
    "en": "Play",
    "zh-CN": "播放"
  },
  "Pause": {
    "en": "Pause",
    "zh-CN": "暂停"
  },
  "current step": {
    "en": "current step",
    "zh-CN": "当前步骤"
  },
  "3D traversal": {
    "en": "3D traversal",
    "zh-CN": "3D 遍历"
  },
  "Chain start: use Next / Play to reveal the first edge.": {
    "en": "Chain start: use Next / Play to reveal the first edge.",
    "zh-CN": "链起点：使用下一步／播放显示第一条边。"
  },
  "Drag: orbit · Wheel: zoom · Right drag: pan": {
    "en": "Drag: orbit · Wheel: zoom · Right drag: pan",
    "zh-CN": "拖动旋转 · 滚轮缩放 · 右键平移"
  },
  "Include island {0}": {
    "en": "Include island {0}",
    "zh-CN": "包含 UV 岛 {0}"
  },
  "Trefoil knot · 三叶结": {
    "en": "Trefoil knot",
    "zh-CN": "三叶结"
  },
  "Garment-like shell · 服装壳": {
    "en": "Garment-like shell",
    "zh-CN": "服装壳"
  },
  "Mechanical gear · 齿轮": {
    "en": "Mechanical gear",
    "zh-CN": "齿轮"
  },
  "Mechanical assembly · 机械装配": {
    "en": "Mechanical assembly",
    "zh-CN": "机械装配"
  },
  "Corset · 服装人台": {
    "en": "Corset",
    "zh-CN": "Corset · 服装人台"
  },
  "Flight Helmet · 飞行头盔": {
    "en": "Flight Helmet",
    "zh-CN": "Flight Helmet · 飞行头盔"
  },
  "公开服装样例；首次使用需要联网。仅获取几何和 UV。": {
    "en": "Public garment example; network is needed without a local copy. Geometry only; original UVs are discarded.",
    "zh-CN": "公开服装样例；无本地副本时需要联网。仅使用几何，原 UV 会丢弃。"
  },
  "多部件高密度模型；约 9.5 万三角面。仅获取几何和 UV。": {
    "en": "Dense multipart model; about 95,000 triangles. Geometry only; original UVs are discarded.",
    "zh-CN": "多部件高密度模型；约 9.5 万三角面。仅使用几何，原 UV 会丢弃。"
  },
  "完整闭合部件 {0} 面：按两条真实折边区分正反端面与完整环形侧边。当前为{1}。不移动源顶点，不读取原 UV。": {"en":"Complete closed component with {0} faces: two actual creases separate both end caps from the complete ring rim. Current role: {1}. Source vertices never move; original UVs are ignored.","zh-CN":"完整闭合部件 {0} 面：按两条真实折边区分正反端面与完整环形侧边。当前为{1}。不移动源顶点，不读取原 UV。"},
  "连续侧边：先尝试一条开缝、整圈一片": {"en":"Continuous rim: first try one seam and one full-loop strip","zh-CN":"连续侧边：先尝试一条开缝、整圈一片"},
  "完整端面：不是把周长切成一半": {"en":"Complete end cap: never split its perimeter in half","zh-CN":"完整端面：不是把周长切成一半"},
  "两条边界之间的完整连续表面：先保持空间组完整，再决定一条开缝是否足够；不会预先分成两个角度区间。": {"en":"Complete continuous surface between two boundaries: preserve the spatial group first, then test whether one seam suffices; do not pre-split into angular halves.","zh-CN":"两条边界之间的完整连续表面：先保持空间组完整，再决定一条开缝是否足够；不会预先分成两个角度区间。"},
  "纵向结构面板 · 沿完整折边开口、保持端盖": {"en":"Longitudinal structural panel · open along complete creases, retain end caps","zh-CN":"纵向结构面板 · 沿完整折边开口、保持端盖"},
  "完整表面对称层片 · 沿共有几何边缘分开": {"en":"Complete symmetric surface sheet · split along shared geometric edges","zh-CN":"完整表面对称层片 · 沿共有几何边缘分开"},
  "回折孔壁 · 连续开缝": {"en":"Folded hole wall · continuous seam","zh-CN":"回折孔壁 · 连续开缝"},
  "透孔主片 · 保留 {0} 个孔": {"en":"Main sheet · preserve {0} holes","zh-CN":"透孔主片 · 保留 {0} 个孔"},
  "双侧结构 / 窄连接片": {"en":"Bilateral structure / narrow connector","zh-CN":"双侧结构 / 窄连接片"},
  "{0}。{1}{2}纯几何生成，原 UV 不参与。": {"en":"{0}. {1}{2}Geometry-only generation; original UVs never participate.","zh-CN":"{0}。{1}{2}纯几何生成，原 UV 不参与。"},
  "本结构镜像对应覆盖 {0}%；已对应 {1} 面，分组冲突 {2} 面，异对角线单元 {3} 组。未匹配区域不宣称对称。": {"en":"Mirror correspondence covers {0}%; {1} matched faces, {2} group conflicts, {3} opposite-diagonal cells. Unmatched regions are not claimed symmetric.","zh-CN":"本结构镜像对应覆盖 {0}%；已对应 {1} 面，分组冲突 {2} 面，异对角线单元 {3} 组。未匹配区域不宣称对称。"},
  "对应侧缝 {0}/{1} 条真实网格边；镜像曲线最大距离 {2}% 原侧缝长度。": {"en":"Corresponding side seams have {0}/{1} real mesh edges; maximum mirror-curve deviation is {2}% of the original side-seam length.","zh-CN":"对应侧缝 {0}/{1} 条真实网格边；镜像曲线最大距离 {2}% 原侧缝长度。"},
  "重复截面度量：{0} 层完整截面，沿周向宽度一致；按真实剖面弧长/半径计算矩形，长宽比 {1}:1": {"en":"Repeated-section metric: {0} complete sections with consistent circumferential width; rectangle follows actual profile arc length/radius, aspect ratio {1}:1","zh-CN":"重复截面度量：{0} 层完整截面，沿周向宽度一致；按真实剖面弧长/半径计算矩形，长宽比 {1}:1"},
  "保孔环形：{0} 层完整截面，保留内外两圈边界，不增加径向切缝；厚度回折按实际剖面弧长展平": {"en":"Hole-preserving ring: {0} complete sections retain inner and outer boundaries without a radial seam; unfold thickness folds by actual profile arc length","zh-CN":"保孔环形：{0} 层完整截面，保留内外两圈边界，不增加径向切缝；厚度回折按实际剖面弧长展平"},
  "{0}。{1} 面 → {2} 岛；最大局部方向拉伸比 {3}。不是无形变承诺；后续仅允许整体旋转、移动和等比例缩放。": {"en":"{0}. {1} faces → {2} islands; maximum local directional stretch {3}. No zero-distortion guarantee; later operations allow only overall rotation, translation, and uniform scaling.","zh-CN":"{0}。{1} 面 → {2} 岛；最大局部方向拉伸比 {3}。不是无形变承诺；后续仅允许整体旋转、移动和等比例缩放。"},
  "完整片超过每岛面数预算，增加同向开缝": {"en":"Complete strip exceeds per-island face budget; add seams in the same direction","zh-CN":"完整片超过每岛面数预算，增加同向开缝"},
  "完整一片已通过边界、翻面、重叠和形变检查，无需第二条缝": {"en":"One complete strip passed boundary, flip, overlap, and distortion checks; no second seam is needed","zh-CN":"完整一片已通过边界、翻面、重叠和形变检查，无需第二条缝"},
  "完整一片候选未通过质量检查，改用两片": {"en":"Complete-strip candidate failed quality checks; use two panels","zh-CN":"完整一片候选未通过质量检查，改用两片"},
  "用户指定 {0} 片": {"en":"User requested {0} panels","zh-CN":"用户指定 {0} 片"},
  "裁片决策：{0}。{1} 个面 → {2} 个 UV 岛；{3} 条真实切边。": {"en":"Panel decision: {0}. {1} faces → {2} UV islands; {3} real cut edges.","zh-CN":"裁片决策：{0}。{1} 个面 → {2} 个 UV 岛；{3} 条真实切边。"},
  "本岛未建立可靠的表面对称约束；不代表几何一定不对称。已开切口、复杂连接或证据不足的区域不会强制镜像。": {"en":"No reliable surface-symmetry contract for this island; this does not prove asymmetry. Existing cuts, complex connections, or insufficient evidence never force mirroring.","zh-CN":"本岛未建立可靠的表面对称约束；不代表几何一定不对称。已开切口、复杂连接或证据不足的区域不会强制镜像。"},
  "{0} 表面采样匹配 {1}%，边界/闭合折边匹配 {2}%；原顶点近精确配对（采样） {3}%（仅诊断，不是门槛）。{4} 不改变三维网格、不复制半片，也不使用原 UV。": {"en":"{0} Surface sample match {1}%, boundary / closed-crease match {2}%; sampled near-exact vertex pairing {3}% (diagnostic only, not a threshold). {4} The 3D mesh is unchanged; no half is copied and original UVs are ignored.","zh-CN":"{0} 表面采样匹配 {1}%，边界/闭合折边匹配 {2}%；原顶点近精确配对（采样） {3}%（仅诊断，不是门槛）。{4} 不改变三维网格、不复制半片，也不使用原 UV。"},
  "表面对称已识别，但约束求解未通过；保留原有效候选，未宣称对称。": {"en":"Surface symmetry recognized but constrained solving failed; retain the valid candidate without claiming symmetric UVs.","zh-CN":"表面对称已识别，但约束求解未通过；保留原有效候选，未宣称对称。"},
  "表面对称已验证，使用三角面内的重心对应，不要求左右顶点或三角形一一配对。": {"en":"Surface symmetry validated using barycentric correspondence inside triangles; one-to-one vertex or face pairs are unnecessary.","zh-CN":"表面对称已验证，使用三角面内的重心对应，不要求左右顶点或三角形一一配对。"},
  "当前 UV 镜像均方根误差 {0}%，边界 {1}%，最大 {2}%（相对当前岛直径）。": {"en":"Current UV mirror RMS error {0}%, boundary {1}%, maximum {2}% (relative to current island diameter).","zh-CN":"当前 UV 镜像均方根误差 {0}%，边界 {1}%，最大 {2}%（相对当前岛直径）。"},
  "表面对称：{0} 个岛保留已验证约束{1}。未标注、已开缝及未识别区域不保证对称；不是全模型对称评分。": {"en":"Surface symmetry: {0} islands retain validated contracts{1}. Unmarked, cut, and unrecognized regions are not guaranteed symmetric; this is not a whole-model symmetry score.","zh-CN":"表面对称：{0} 个岛保留已验证约束{1}。未标注、已开缝及未识别区域不保证对称；不是全模型对称评分。"},
  "，{0} 个候选未通过": {"en":"; {0} candidates rejected","zh-CN":"，{0} 个候选未通过"},
  "闭合管身 · 矩形条带。当前片长/宽 {0}:1，来自中心轨迹弧长与横截面周长，不拉成正方形。{1}纵向和横向裁切均为真实网格边，原 UV 使用 0。": {"en":"Closed tube · rectangular strip. Current length/width {0}:1 follows centerline arc length and cross-section circumference, never a forced square. {1}Longitudinal and transverse cuts are actual mesh edges; original UV use: 0.","zh-CN":"闭合管身 · 矩形条带。当前片长/宽 {0}:1，来自中心轨迹弧长与横截面周长，不拉成正方形。{1}纵向和横向裁切均为真实网格边，原 UV 使用 0。"},
  "{0} 个几何截面，{1} 片；最大方向拉伸比 {2}，面积密度 {3}–{4} 倍各片平均值。{5}": {"en":"{0} geometry sections, {1} panels; maximum directional stretch {2}, area density {3}–{4}× each panel's mean. {5}","zh-CN":"{0} 个几何截面，{1} 片；最大方向拉伸比 {2}，面积密度 {3}–{4} 倍各片平均值。{5}"},
  "单片面数预算增加了横向分段。": {"en":"The per-island face budget added transverse segments.","zh-CN":"单片面数预算增加了横向分段。"},
  "本次实际放大 {0} / {1} 岛 · 新增有效 UV 面积 {2} 个百分点": {"en":"Actually enlarged {0} / {1} islands · valid UV area added: {2} percentage points","zh-CN":"本次实际放大 {0} / {1} 岛 · 新增有效 UV 面积 {2} 个百分点"},
  "{0} 个岛达到密度差上限。达到上限不表示没有空位；可主动调整上限后继续。不会自动放宽你设定的值。": {"en":"{0} islands reached the density limit. This does not imply no vacancy remains; explicitly adjust the limit to continue. Your limit is never loosened automatically.","zh-CN":"{0} 个岛达到密度差上限。达到上限不表示没有空位；可主动调整上限后继续。不会自动放宽你设定的值。"},
  "逐岛实际面积 / 边长增益（按 3D 面积排序）": {"en":"Actual island area / edge gains (ordered by 3D area)","zh-CN":"逐岛实际面积 / 边长增益（按 3D 面积排序）"},
  "面积 ×": {"en":"Area ×","zh-CN":"面积 ×"},
  "边长 ×": {"en":"Edge ×","zh-CN":"边长 ×"},
  "停止依据": {"en":"Stop reason","zh-CN":"停止依据"},
  "UV 面积 {0} → {1}；3D 表面积 {2}。倍率相对本次操作前，不是相对模型原 UV。": {"en":"UV area {0} → {1}; 3D area {2}. Factors compare the state before this operation, never original model UVs.","zh-CN":"UV 面积 {0} → {1}；3D 表面积 {2}。倍率相对本次操作前，不是相对模型原 UV。"},
  "面积 2 倍对应边长 √2 倍。仅移动 / 旋转记为 1 倍。记录来自最后提交的实际坐标；未找到更大位置不是全局不可放大的证明。": {"en":"2× area means √2× edge length. Translation / rotation alone counts as 1×. Records reflect actually committed coordinates; failing to find a larger placement is not a global proof.","zh-CN":"面积 2 倍对应边长 √2 倍。仅移动 / 旋转记为 1 倍。记录来自最后提交的实际坐标；未找到更大位置不是全局不可放大的证明。"},
  "自动叠层：运动岛视线叠层（非几何相交），静止时近共面检查": {"en":"Auto layers: moving-island line-of-sight layers (not geometric intersection), near-coplanar checks when stationary","zh-CN":"自动叠层：运动岛视线叠层（非几何相交），静止时近共面检查"},
  "重叠提示已关闭": {"en":"Overlap hints disabled","zh-CN":"重叠提示已关闭"},
  "视线叠层（含前后遮挡，非几何相交）": {"en":"Line-of-sight layers (includes occlusion, not geometric intersection)","zh-CN":"视线叠层（含前后遮挡，非几何相交）"},
  "同岛近共面重叠（当前可见表层）": {"en":"Same-island near-coplanar overlap (current visible surface)","zh-CN":"同岛近共面重叠（当前可见表层）"},
  "{0} · 橙色斜纹：2 层 · 玫红交叉纹：3 层及以上": {"en":"{0} · orange hatch: 2 layers · magenta crosshatch: 3+","zh-CN":"{0} · 橙色斜纹：2 层 · 玫红交叉纹：3 层及以上"},
  "三叶结 · Trefoil": {"en":"Trefoil knot","zh-CN":"三叶结"},
  "褶皱服装 · Garment": {"en":"Folded garment","zh-CN":"褶皱服装"},
  "倒角齿轮 · Gear": {"en":"Beveled gear","zh-CN":"倒角齿轮"},
  "机械组合 · Assembly": {"en":"Mechanical assembly","zh-CN":"机械组合"},
  "闭合曲面、非平凡环路与遮挡": {"en":"Closed surface, nontrivial loops, and occlusion","zh-CN":"闭合曲面、非平凡环路与遮挡"},
  "开放边界、连续褶皱与已有 UV": {"en":"Open boundaries and continuous folds; original UVs are discarded","zh-CN":"开放边界、连续褶皱；原 UV 会丢弃"},
  "内孔、齿形与硬表面": {"en":"Inner hole, teeth, and hard surfaces","zh-CN":"内孔、齿形与硬表面"},
  "多个不连通部件、孔洞与尺度差异": {"en":"Disconnected parts, holes, and differing scales","zh-CN":"多个不连通部件、孔洞与尺度差异"},
  "本次编辑已有生成结果": {"en":"Editing an existing generated result","zh-CN":"本次编辑已有生成结果"},
  "不读取或修复模型原 UV": {"en":"Never read or repair original model UVs","zh-CN":"不读取或修复模型原 UV"},
  "结构分析在生成阶段完成": {"en":"Structure analysis completed during generation","zh-CN":"结构分析在生成阶段完成"},
  "未启用后缝合": {"en":"Post-stitching disabled","zh-CN":"未启用后缝合"},
  "保持当前生成岛的面积": {"en":"Preserve current generated-island areas","zh-CN":"保持当前生成岛的面积"},
  "未启用：不会自动填空": {"en":"Disabled: no automatic vacancy fill","zh-CN":"未启用：不会自动填空"},
} as const;

