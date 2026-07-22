# PDF/图片原理图识别 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：17  
> Agent 名称：PDF/Image Schematic Recognition & Connectivity Reconstruction Agent  
> 中文名称：PDF/图片原理图识别 Agent  
> 类型：混合型（PDF 矢量解析 + OCR + 计算机视觉 + 图算法 + 人工审核）  
> 版本：V1.0  
> 技术资料基线日期：2026-07-20  
>
> 定位：从可编辑 PDF、扫描 PDF、图片、截图和历史工程图中识别原理图页面、器件符号、位号、数值、型号、引脚、网络标签、连接线、连接点、跨页连接、层级端口和总线，生成带来源证据、置信度、未决项和人工审核记录的 Schematic Recognition IR，并映射为 Agent 16 兼容的 Schematic IR、Part IR 和 Net IR。
>
> 上游：
> - PDF、PNG、JPEG、TIFF、WebP、扫描件、屏幕截图
> - Agent 16 的 Canonical EDA IR Schema、Symbol/Part/Net 定义
> - ezPLM 项目、文档、器件库、符号库、PDF 数据手册和历史审核数据
> - 可选的 KiCad/Altium/JLCEDA 原始工程，用于训练、验证或对照
>
> 下游：
> - Agent 16：Canonical Project/Schematic/Part/Net IR
> - Agent 18 及后续电路理解、ERC、设计恢复、网表生成和 KiCad 重建 Agent
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 43：EBOM/MBOM 与 NPI
> - Agent 44：制造预检
> - Agent 45：AOI/ICT/FCT 的 RefDes、Pin、Pad 和 Net 关联
> - 原理图 Web Viewer 与人工审核工作台
>
> 重要边界：
> - 本 Agent 恢复“识别到的设计事实和候选连通关系”，不自动声称得到与源 EDA 工程完全等价的可编辑原理图。
> - 生成 KiCad 文件、自动重新布局和工程写回应由独立下游 Agent 完成。
> - 文本相近、图形相似或线条靠近不等于电气连接。
> - 交叉线是否连接必须依据 Junction Dot、显式端点、矢量路径、线型和人工审核，不能只凭像素交叉自动连接。
> - 识别结果必须区分 `observed`、`resolved`、`inferred`、`reviewed` 和 `unknown`。
> - 原始页面、渲染图、矢量对象、OCR 框、检测框、连线像素、算法版本和人工修订必须可追溯。
> - V1 核心连接图由确定性图算法构建；通用 LLM/VLM 不得直接生成或覆盖 Net Graph。
> - 私有原理图默认本地或私有部署处理，不发送给外部通用视觉模型。

---

# 1. 技术基线

## 1.1 PDF 双通道解析

PDF 页面可能包含：

```text
真实文本对象
矢量路径
嵌入图片
混合文字和扫描背景
整页扫描图
```

因此必须先分类：

```text
born_digital_vector
born_digital_mixed
scan_image
photo
screenshot
unknown
```

对于可编辑 PDF，优先提取：

```text
字符和文字块
字体和旋转
矢量线段、曲线和圆
填充圆点
页面变换矩阵
嵌入图片
```

对于扫描或图片输入，再进入 OCR 和计算机视觉流程。

## 1.2 PDF 坐标

必须保存：

```text
PDF User Space
Page Rotation
CropBox/MediaBox
Canonical Page Coordinates
Raster Pixel Coordinates
Transform Matrix
```

避免：

```text
Y 轴翻转
页面旋转
CropBox 偏移
DPI 缩放
```

导致文字和连线错位。

## 1.3 OCR

推荐本地 OCR 管线支持：

```text
文字检测
文字方向
文字识别
字符置信度
多语言
自定义字符表
模型微调
```

电子原理图的字符集重点：

```text
A-Z
a-z
0-9
+ - _ / \ . , : ;
Ω µ μ k M G m u n p
括号和方括号
```

## 1.4 图像线条检测

基础技术包括：

```text
阈值化
Canny
Hough Line
Line Segment Detection
Skeletonization
Connected Components
Morphology
Graph Tracing
```

Hough 只用于候选线段，最终 Wire Graph 需要结合端点、符号区域、文字遮挡和 Junction 语义重建。

## 1.5 本地模型推理

模型可使用：

```text
ONNX Runtime
OpenVINO
TensorRT
PyTorch private inference
```

生产输出必须记录：

```text
model name
model version
artifact hash
input hash
runtime
device
```

---

# 2. 建设目标

系统必须能够：

1. 接收 PDF、PNG、JPEG、TIFF、WebP 和 ZIP；
2. 识别加密 PDF、损坏 PDF、超大图片和恶意文件；
3. 安全渲染 PDF；
4. 识别页面尺寸、方向和旋转；
5. 识别可编辑矢量 PDF 和扫描 PDF；
6. 提取 PDF 原生文字；
7. 提取 PDF 矢量线、曲线、圆、矩形和填充对象；
8. 提取嵌入图片；
9. 为扫描页执行倾斜校正；
10. 执行透视校正；
11. 执行旋转和方向识别；
12. 执行去噪、去背景、对比度增强和二值化；
13. 保留原始图和预处理版本；
14. 自动识别图纸区域和标题栏；
15. 识别页码、图号、版本和 Sheet 信息；
16. 识别原理图页面；
17. 排除 BOM 表、说明页、波形图和机械图；
18. 识别常用电阻、电容、电感和晶体；
19. 识别二极管、LED、稳压管和桥堆；
20. 识别 BJT、MOSFET、IGBT 和晶闸管；
21. 识别运放、比较器、逻辑门和触发器；
22. 识别 IC 矩形符号和多引脚器件；
23. 识别连接器、排针、开关、继电器、保险丝和变压器；
24. 识别电源、地、测试点、网络旗标和 No Connect；
25. 支持 IEC、ANSI、KiCad、Altium 和企业自定义符号风格；
26. 识别符号方向、镜像和旋转；
27. 识别符号主体和引脚；
28. 识别引脚端点；
29. 识别引脚编号；
30. 识别引脚名称；
31. 识别引脚功能文本；
32. 识别器件位号；
33. 识别器件数值；
34. 识别器件型号；
35. 识别制造商和 MPN 候选；
36. 识别封装和备注；
37. 识别 DNP、NC、NI、NF 和可选装标记；
38. 将文字正确关联到器件；
39. 区分位号、数值、型号、引脚和普通注释；
40. 识别连接线；
41. 识别水平、垂直和斜线；
42. 识别折线和曲线；
43. 识别连接点；
44. 识别 T 形连接；
45. 识别线条交叉但不连接；
46. 识别跳线弧和桥跨符号；
47. 识别线条在文字或符号处被遮挡；
48. 补全短距离断线候选；
49. 不自动补全长距离或高歧义断线；
50. 识别 Net Label；
51. 识别 Global Label；
52. 识别 Power Label；
53. 识别 Off-page Connector；
54. 识别 Sheet Port 和 Hierarchical Port；
55. 识别 Input/Output/Bidirectional 标记；
56. 识别跨页连接；
57. 识别页面间同名网络；
58. 识别总线主干；
59. 识别 Bus Entry；
60. 识别总线成员；
61. 解析 `D[0..7]`；
62. 解析 `D0-D7`；
63. 解析 `DATA[7:0]`；
64. 解析企业自定义总线命名；
65. 识别差分对标记；
66. 识别信号方向箭头；
67. 构建页面级连接图；
68. 构建项目级跨页连接图；
69. 建立器件 Pin 到 Net 的关系；
70. 建立 Label 到 Net 的关系；
71. 建立 Bus 到 Member Net 的关系；
72. 建立 Off-page Connector 配对；
73. 识别悬空 Pin；
74. 区分显式 No Connect；
75. 识别未决连接；
76. 生成器件候选；
77. 生成 Part IR 候选；
78. 生成 Schematic IR 候选；
79. 生成 Net IR 候选；
80. 生成可选网表；
81. 为每个器件、文本和连接保存置信度；
82. 为每个 Net 保存连接证据；
83. 保存 PDF 矢量证据；
84. 保存 OCR 和检测框；
85. 保存像素级或矢量级连线证据；
86. 保存人工修订；
87. 支持 Review Queue；
88. 支持页面 Overlay；
89. 支持点击器件查看关联文字和连接；
90. 支持点击 Net 高亮全部页面连接；
91. 支持人工拆分或合并 Net；
92. 支持人工移动文字归属；
93. 支持人工确认器件类型；
94. 支持人工补充跨页连接；
95. 支持审核后的锁定状态；
96. 支持增量重跑；
97. 支持模型升级后重放；
98. 支持版本比较；
99. 支持训练样本回流；
100. 支持合成数据生成；
101. 支持由 KiCad/Agent 16 IR 生成有真值的 PDF 和图片；
102. 支持不同 DPI、压缩、噪声和扫描增强；
103. 支持不同语言和字体；
104. 支持多页批量任务；
105. 支持大图切片；
106. 支持 GPU/CPU Worker；
107. 支持任务取消和恢复；
108. 支持多租户和项目权限；
109. 支持证据保留和审计；
110. 不因 OCR 文本相同就合并器件；
111. 不因线条交叉就默认连接；
112. 不因同名 Local Label 就跨页合并；
113. 不因符号相似就强制分类；
114. 不因模型置信度高就自动生成最终网表；
115. 不静默删除低置信度对象；
116. 不用语言模型猜缺失引脚和网络；
117. 不把普通注释当作 Net Label；
118. 不把总线主干当作普通单一网络；
119. 不将跨页连接和层级端口混为一谈；
120. 不声称扫描图恢复结果与原 EDA 工程完全等价。

---

# 3. 与 Agent 16 的关系

## 3.1 Agent 16

Agent 16 的输入是原生 EDA 工程，具有明确结构。

Agent 17 的输入是：

```text
PDF
扫描件
图片
截图
历史文档
```

Agent 17 输出：

```text
Recognition Observation IR
Recognition Graph
Reviewed Schematic IR Candidate
Agent 16 Compatible IR Bundle
```

## 3.2 可信度区别

Agent 16 常见来源：

```text
explicit
library_resolved
connectivity_resolved
```

Agent 17 常见来源：

```text
vector_extracted
ocr_observed
vision_detected
geometry_resolved
label_resolved
human_reviewed
inferred
unknown
```

Agent 17 输出不能伪装成 Agent 16 的原生确定性数据。

## 3.3 IR 兼容

推荐：

```text
Recognition IR
→ Review/Validation
→ Canonical IR Adapter
→ Agent 16 Schematic/Part/Net IR
```

Canonical IR 中增加：

```text
recognition_provenance
recognition_confidence
review_status
source_page_region
```

---

# 4. 核心架构

```text
Source Asset
→ Safe Intake
→ Page Inventory
→ Page Type Classification
→ Vector/Text Extraction
→ Raster Rendering
→ Image Preprocessing
→ OCR/Text Classification
→ Symbol Detection
→ Pin/Port Detection
→ Wire/Junction/Bus Extraction
→ Spatial Association
→ Page Connectivity Graph
→ Cross-page Resolution
→ Evidence Fusion
→ Review Queue
→ Schematic Recognition IR
→ Agent 16 IR Adapter
```

---

# 5. 两路识别管线

## 5.1 Vector-first

适用：

```text
CAD 导出的 PDF
EDA Print PDF
矢量文档
```

流程：

```text
PDF text objects
PDF vector paths
PDF fill/stroke style
PDF image objects
→ geometry normalization
→ primitive classification
→ symbol/wire/text association
```

## 5.2 Raster-first

适用：

```text
扫描 PDF
手机照片
截图
低质量复印件
```

流程：

```text
render/load image
→ dewarp
→ deskew
→ denoise
→ binarize
→ OCR
→ symbol model
→ wire segmentation
→ graph reconstruction
```

## 5.3 Hybrid Fusion

混合 PDF 同时运行：

```text
native text/vector
+
raster evidence
```

矢量来源优先，但冲突必须记录。

---

# 6. 输入类型

```text
application/pdf
image/png
image/jpeg
image/tiff
image/webp
application/zip
```

ZIP 可包含：

```text
多页图片
PDF
辅助元件表
页码映射
```

---

# 7. Safe Intake

- Malware Scan；
- PDF 结构检查；
- 禁止执行 JavaScript、Launch Action 和嵌入文件；
- 限制页面数；
- 限制像素和渲染 DPI；
- 限制解压大小；
- 文件 Hash；
- 只读原始文件；
- Parser/Renderer 沙箱；
- 无默认公网。

---

# 8. Page Inventory

每页保存：

```text
page index
printed page number
sheet number
title
revision
orientation
width/height
rotation
content type
vector object count
text object count
image coverage
render DPI
```

---

# 9. Page Type Classification

类型：

```text
schematic
block_diagram
bom_table
title_page
notes
timing_diagram
waveform
pcb_drawing
mechanical_drawing
mixed
unknown
```

只对 Schematic 或 Mixed 页面进入完整电路识别。

---

# 10. 图像预处理

支持：

```text
orientation
deskew
perspective correction
dewarp
grayscale
adaptive threshold
background removal
contrast
sharpen
denoise
morphology
line-preserving cleanup
```

每个版本保存参数和输出 Hash。

---

# 11. DPI 策略

```text
preview: 150 DPI
recognition: 300-600 DPI
fine text/pin: tiled high DPI
```

不得把整张 A0 图纸无上限渲染到内存。

---

# 12. Page Coordinate System

Canonical：

```text
origin top-left
unit normalized page point or mm
x right
y down
```

同时保存：

```text
PDF coordinates
pixel coordinates
transform matrices
```

---

# 13. Text Observation

```json
{
  "text_observation_id": "uuid",
  "page_id": "uuid",
  "raw_text": "R105",
  "normalized_text": "R105",
  "polygon": [],
  "rotation": 0,
  "source": "pdf_native_text",
  "confidence": 1.0
}
```

---

# 14. OCR 字符策略

优先支持：

```text
英文字母
数字
电子单位
上下标
斜杠
中英文注释
```

需要自定义混淆表：

```text
0/O
1/I/l
5/S
8/B
2/Z
µ/u
Ω/0
-/_/~
```

纠错必须生成候选，不覆盖 Raw Text。

---

# 15. Text Role Classification

角色：

```text
reference_designator
value
part_number
manufacturer
pin_number
pin_name
net_label
bus_label
port_label
page_number
sheet_number
title
note
test_point
package
unknown
```

---

# 16. RefDes 语法

可配置模式：

```text
R123
C4
U1A
J2
TP15
Q3
D5
RN1
FB2
L3
Y1
SW2
F1
T1
K1
```

企业自定义前缀通过 Registry 管理。

---

# 17. Value 解析

识别：

```text
10k
4.7uF
100n
1%
25V
33R
0R
NC
DNP
```

Raw Value 和标准化候选分开。

---

# 18. MPN/型号识别

候选依据：

```text
字符长度和模式
附近的 RefDes/Value
元器件数据库
标题或注释排除
Manufacturer 词典
```

最终精确身份交给 Agent 32。

---

# 19. Symbol Observation

```json
{
  "symbol_observation_id": "uuid",
  "page_id": "uuid",
  "class_candidates": [
    {"class": "resistor_iec", "confidence": 0.91}
  ],
  "body_polygon": [],
  "orientation_deg": 90,
  "mirror": false,
  "source": "vision_model",
  "model_version": "symbol-detector-1.0"
}
```

---

# 20. Symbol Taxonomy

一级：

```text
passive
semiconductor
integrated_circuit
connector
switch
relay
transformer
power
ground
test
annotation
port
unknown
```

二级示例：

```text
resistor_iec
resistor_ansi
capacitor_nonpolar
capacitor_polarized
inductor
diode
zener
led
bjt_npn
mosfet_n
opamp
logic_and
connector
offpage_connector
power_symbol
ground_symbol
```

---

# 21. Generic IC

矩形多引脚器件应优先输出：

```text
generic_ic
body
pin observations
text associations
```

不因内部文字像某型号就直接推断引脚定义。

---

# 22. Pin Observation

```text
pin endpoint
body attachment point
orientation
length
pin number candidate
pin name candidate
electrical type candidate
source
confidence
```

Pin Electrical Type 通常无法从图片可靠恢复，应默认：

```text
unknown
```

除非符号形状或文字明确。

---

# 23. Port Observation

```text
off_page
hierarchical
input
output
bidirectional
passive
power
unknown
```

方向箭头只是候选，不一定表示 EDA Electrical Type。

---

# 24. 文字关联

候选关系：

```text
text → symbol
text → pin
text → wire/net
text → page
```

特征：

```text
distance
direction
alignment
font size
text role
symbol class
overlap
reading convention
```

---

# 25. Part Candidate

```json
{
  "part_candidate_id": "uuid",
  "symbol_observation_id": "uuid",
  "reference_candidates": [],
  "value_candidates": [],
  "mpn_candidates": [],
  "pin_candidates": [],
  "association_confidence": 0.88,
  "review_status": "review_required"
}
```

---

# 26. Wire Observation

来源：

```text
pdf_vector_path
raster_line_segmentation
hough_candidate
skeleton_trace
manual
```

保存：

```text
polyline
width
stroke style
color
endpoint candidates
occlusions
confidence
```

---

# 27. Wire 与 Graphic 区分

可能混淆：

```text
符号边框
标题栏
表格线
下划线
箭头
注释框
总线
连接线
```

必须结合：

```text
页面区域
线宽
颜色
端点是否接 Pin
是否形成网络图
是否属于已检测符号
```

---

# 28. Junction Observation

来源：

```text
filled dot
vector circle/fill
connected endpoint cluster
T-junction
manual
```

状态：

```text
explicit_junction
probable_junction
crossing_no_junction
ambiguous
```

---

# 29. Wire Crossing

分类：

```text
connected_with_dot
connected_t_endpoint
crossing_without_dot
bridge_jump
ambiguous
```

`ambiguous` 必须进入审核。

---

# 30. Occlusion Recovery

线可能被：

```text
文字
器件主体
页折痕
扫描污点
```

遮挡。

只允许在满足：

```text
同方向
小间隙
一致线宽
端点对齐
无冲突对象
```

时生成 `gap_bridge_candidate`。

---

# 31. Wire Graph

节点：

```text
pin_endpoint
wire_endpoint
junction
label_anchor
port_anchor
bus_entry
no_connect
```

边：

```text
wire_segment
resolved_gap
label_equivalence
cross_page_equivalence
bus_membership
```

---

# 32. Page Net

由页面连接图的 Connected Component 生成。

每个 Page Net 保存：

```text
nodes
segments
pin endpoints
labels
ports
junctions
unresolved crossings
confidence
```

---

# 33. Net Label

类型：

```text
local
global
power
offpage
hierarchical
bus
differential
unknown
```

角色不能仅通过文字内容判断，还要结合图形符号和位置。

---

# 34. Cross-page Connector

保存：

```text
connector shape
label
direction
page
sheet
grid/location
reference
continuation page candidate
```

配对依据：

```text
exact normalized label
printed page reference
connector shape
project scope
title block/sheet hierarchy
```

---

# 35. 跨页连接规则

优先：

```text
显式页码和坐标引用
显式 Sheet/Port 名
Global Label
唯一 Off-page Label
人工确认
```

仅同名普通 Local Label 不跨页合并。

---

# 36. Cross-page Link 状态

```text
explicit
verified
probable
ambiguous
missing_target
conflicting
```

只有 `explicit`、`verified` 或人工确认的关系进入发布网表。

---

# 37. Bus Observation

保存：

```text
bus polyline
bus label
member patterns
bus entries
entry-to-member mapping
direction
scope
```

---

# 38. Bus Syntax Registry

支持：

```text
D[0..7]
D[7..0]
D0-D7
D0..D7
DATA[7:0]
A<0:15>
```

企业语法可扩展。

---

# 39. Bus Entry

每个 Entry 保存：

```text
bus attachment
member wire attachment
member label
geometry
confidence
```

没有 Member Label 时不能随意按位置分配。

---

# 40. Differential Pair

候选来源：

```text
NET_P / NET_N
NET+ / NET-
explicit differential label
parallel pair annotation
```

命名规则只能生成候选，不自动成为确定性 Constraint。

---

# 41. No Connect

识别：

```text
X mark
source-specific no-connect symbol
text NC near pin
```

文字 `NC` 可能表示芯片引脚名，不能直接等于 No Connect。

---

# 42. Evidence Fusion

输入：

```text
native PDF text
native PDF vector
OCR
symbol model
line model
geometry
database candidate
human review
```

输出：

```text
resolved value
candidate list
confidence
conflict
evidence links
```

---

# 43. Confidence 分解

不要只有一个总分。

```text
detection_confidence
text_confidence
association_confidence
geometry_confidence
connectivity_confidence
cross_page_confidence
identity_confidence
review_confidence
```

---

# 44. 置信度状态

```text
high
medium
low
unknown
```

并保存原始连续分数。

---

# 45. Recognition IR

```json
{
  "recognition_ir_version": "1.0.0",
  "document_id": "uuid",
  "pages": [],
  "text_observations": [],
  "symbol_observations": [],
  "pin_observations": [],
  "wire_observations": [],
  "junction_observations": [],
  "label_observations": [],
  "bus_observations": [],
  "part_candidates": [],
  "page_nets": [],
  "cross_page_links": [],
  "review_items": [],
  "diagnostics": []
}
```

---

# 46. Reviewed Schematic IR

只有完成 Gate 后才生成：

```text
reviewed symbol instances
reviewed pins
reviewed wires
reviewed junctions
reviewed labels
reviewed nets
reviewed cross-page links
unresolved items
```

---

# 47. 发布等级

```text
observation_only
structure_recovered
connectivity_candidate
reviewed_connectivity
netlist_ready
canonical_ir_ready
```

---

# 48. Netlist Ready Gate

至少要求：

```text
所有发布器件有 RefDes 或明确匿名状态
所有发布 Pin 有唯一归属
所有 Critical Crossing 已审核
所有跨页 Ambiguous 已解决
所有 Bus Entry 已映射或排除
No-connect 冲突为零
Net Graph 无非法合并
```

---

# 49. 人工审核工作台

页面布局：

```text
左：页面缩略图和跨页导航
中：原图 + Overlay
右：属性、候选和证据
下：连接图、诊断和历史
```

---

# 50. Overlay 层

```text
OCR Text
Symbols
Pins
Wires
Junctions
Labels
Buses
Nets
Cross-page Links
Unresolved
```

可独立开关。

---

# 51. Review 操作

```text
确认/修改文字
修改文字角色
绑定文字到器件
修改符号类别
创建/删除 Pin
连接/断开 Wire
确认/取消 Junction
拆分/合并 Net
确认跨页配对
映射 Bus Member
标记 No Connect
锁定对象
```

---

# 52. Review Patch

使用路径式 Patch：

```text
add
replace
remove
split_net
merge_net
link_cross_page
unlink_cross_page
bind_text
unbind_text
confirm_junction
reject_junction
```

Patch 不覆盖机器原始观察。

---

# 53. Review 审计

保存：

```text
before
after
reviewer
timestamp
reason
evidence
patch version
```

---

# 54. Page Diagnostics

```text
low_resolution
heavy_skew
perspective_distortion
compression_artifact
text_unreadable
symbol_overlap
wire_fragmented
junction_ambiguous
title_block_confusion
mixed_content
```

---

# 55. Project Diagnostics

```text
duplicate_refdes
missing_refdes
cross_page_unresolved
bus_member_unresolved
net_conflict
page_number_missing
sheet_hierarchy_unknown
possible_missing_page
```

---

# 56. 训练数据策略

最重要的数据来源：

```text
已知 KiCad/Agent 16 IR
→ 程序化渲染 PDF/图片
→ 自动生成真值
```

真值包括：

```text
symbol boxes
pin endpoints
text roles
wire polylines
junctions
labels
page nets
cross-page links
bus membership
```

---

# 57. Domain Randomization

生成：

```text
字体变化
线宽变化
符号风格
DPI
旋转
扫描噪声
JPEG 压缩
背景阴影
折痕
局部模糊
文字遮挡
线条断裂
页面透视
```

---

# 58. 真实数据集

真实数据需：

```text
开源许可
企业授权
脱敏
人工标注
双人审核
争议保留
```

---

# 59. 防止数据泄漏

训练/验证/测试按：

```text
project
design family
sheet template
component library
time
customer/site
```

分割，不能只按页面随机拆分。

---

# 60. Symbol Model

可选模型：

```text
object detector
instance segmentation
template/reference matching
hybrid detector
```

V1 推荐：

```text
detector + geometry/pin rules
```

而不是端到端直接生成 netlist。

---

# 61. Text Model

建议：

```text
general OCR
+ schematic character fine-tune
+ role classifier
+ lexicon candidate generation
```

---

# 62. Wire Segmentation Model

可选用于低质量扫描：

```text
binary segmentation
line centerline extraction
junction heatmap
```

必须和矢量/传统算法融合。

---

# 63. Graph Reconstruction

流程：

```text
remove symbol bodies/text masks
→ retain wire evidence
→ skeletonize
→ extract endpoints/intersections
→ classify junction/crossing
→ attach pin/label/port
→ connected components
→ unresolved review
```

---

# 64. 大模型使用边界

可选用于：

```text
低置信度文字候选排序
注释与标题分类
审核页面摘要
自然语言解释诊断
```

禁止用于：

```text
直接生成 Wire Graph
凭空补线
决定交叉点连接
决定跨页 Net
覆盖 OCR Raw Text
自动发布网表
```

---

# 65. 标准输入请求

```json
{
  "recognition_job_id": "uuid",
  "source_asset_id": "uuid",
  "requested_outputs": [
    "recognition_ir",
    "review_package",
    "schematic_ir_candidate",
    "netlist_candidate"
  ],
  "language_hints": ["en", "zh"],
  "processing_profile": "engineering_drawing_v1",
  "status": "queued"
}
```

---

# 66. 标准结果

```json
{
  "recognition_job_id": "uuid",
  "status": "review_required",
  "summary": {
    "pages": 12,
    "schematic_pages": 9,
    "symbols": 426,
    "parts_with_refdes": 412,
    "page_nets": 178,
    "cross_page_links": 26,
    "ambiguous_crossings": 7,
    "unresolved_bus_entries": 3
  },
  "release_level": "connectivity_candidate",
  "outputs": {
    "recognition_ir_uri": "s3://...",
    "review_package_uri": "s3://...",
    "netlist_candidate_uri": "s3://..."
  }
}
```

---

# 67. 状态机

```text
RECEIVED
→ SECURITY_SCAN
→ PAGE_INVENTORY
→ PAGE_CLASSIFICATION
→ VECTOR_TEXT_EXTRACTION
→ RASTER_RENDERING
→ IMAGE_PREPROCESSING
→ OCR
→ SYMBOL_DETECTION
→ PIN_PORT_DETECTION
→ WIRE_JUNCTION_EXTRACTION
→ TEXT_ROLE_CLASSIFICATION
→ SPATIAL_ASSOCIATION
→ PAGE_GRAPH_BUILD
→ CROSS_PAGE_RESOLUTION
→ BUS_RESOLUTION
→ EVIDENCE_FUSION
→ VALIDATION
→ REVIEW_QUEUE
→ STORING_RESULTS
```

分支：

```text
COMPLETED
COMPLETED_WITH_WARNINGS
REVIEW_REQUIRED
PARTIAL
NO_SCHEMATIC_PAGE
PDF_ENCRYPTED
SECURITY_BLOCKED
LOW_IMAGE_QUALITY
OCR_INCOMPLETE
SYMBOL_MODEL_INCOMPLETE
CONNECTIVITY_INCOMPLETE
CROSS_PAGE_INCOMPLETE
BUS_INCOMPLETE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 68. 错误码

```text
SOURCE_ASSET_NOT_FOUND
SOURCE_FORMAT_UNSUPPORTED
PDF_PASSWORD_REQUIRED
PDF_CORRUPTED
PDF_RENDER_FAILED
PDF_ACTIVE_CONTENT_BLOCKED
ARCHIVE_SECURITY_BLOCKED
PAGE_LIMIT_EXCEEDED
PIXEL_LIMIT_EXCEEDED
PAGE_CLASSIFICATION_FAILED
PAGE_NOT_SCHEMATIC
VECTOR_EXTRACTION_FAILED
OCR_MODEL_MISSING
OCR_FAILED
OCR_LOW_CONFIDENCE
SYMBOL_MODEL_MISSING
SYMBOL_DETECTION_FAILED
PIN_DETECTION_FAILED
WIRE_EXTRACTION_FAILED
JUNCTION_AMBIGUOUS
TEXT_ROLE_AMBIGUOUS
TEXT_SYMBOL_ASSOCIATION_AMBIGUOUS
DUPLICATE_REFDES
REFDES_MISSING
CROSS_PAGE_TARGET_MISSING
CROSS_PAGE_CONFLICT
BUS_SYNTAX_UNKNOWN
BUS_MEMBER_UNRESOLVED
NET_GRAPH_CONFLICT
NO_CONNECT_CONFLICT
REVIEW_REQUIRED
IR_SCHEMA_VALIDATION_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 69. 数据库设计

## 69.1 `schematic_source_assets`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NULL
file_name TEXT NOT NULL
source_type VARCHAR NOT NULL
mime_type VARCHAR NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
size_bytes BIGINT NOT NULL
page_count INT NULL
security_status VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, sha256)
```

## 69.2 `schematic_pages`

```text
id UUID PK
source_asset_id UUID NOT NULL
page_index INT NOT NULL
printed_page_number VARCHAR NULL
sheet_number VARCHAR NULL
page_title VARCHAR NULL
revision_hint VARCHAR NULL
width_points NUMERIC NOT NULL
height_points NUMERIC NOT NULL
rotation_deg INT NOT NULL
page_type VARCHAR NOT NULL
content_mode VARCHAR NOT NULL
vector_object_count BIGINT NOT NULL
native_text_count BIGINT NOT NULL
image_coverage NUMERIC(5,4) NOT NULL
classification_confidence NUMERIC(5,4) NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(source_asset_id, page_index)
```

## 69.3 `schematic_page_renders`

```text
id UUID PK
page_id UUID NOT NULL
render_profile VARCHAR NOT NULL
dpi INT NOT NULL
width_pixels INT NOT NULL
height_pixels INT NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
transform_pdf_to_pixel JSONB NOT NULL
preprocessing_steps JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(page_id, render_profile, dpi, sha256)
```

## 69.4 `schematic_pdf_vector_objects`

```text
id UUID PK
page_id UUID NOT NULL
object_type VARCHAR NOT NULL
native_object_index BIGINT NULL
geometry JSONB NOT NULL
stroke JSONB NULL
fill JSONB NULL
clip_path JSONB NULL
transform JSONB NOT NULL
source_span JSONB NULL
classification VARCHAR NULL
classification_confidence NUMERIC(5,4) NULL
raw_payload_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 69.5 `schematic_text_observations`

```text
id UUID PK
page_id UUID NOT NULL
raw_text TEXT NOT NULL
normalized_text TEXT NULL
polygon JSONB NOT NULL
rotation_deg NUMERIC NOT NULL
font_metadata JSONB NULL
source_type VARCHAR NOT NULL
source_model_id UUID NULL
detection_confidence NUMERIC(5,4) NOT NULL
recognition_confidence NUMERIC(5,4) NOT NULL
character_confidences JSONB NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.6 `schematic_text_role_candidates`

```text
id UUID PK
text_observation_id UUID NOT NULL
role VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
normalization_candidates JSONB NOT NULL
lexicon_matches JSONB NOT NULL
rule_trace_uri TEXT NULL
model_prediction_id UUID NULL
selected BOOLEAN NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.7 `schematic_symbol_observations`

```text
id UUID PK
page_id UUID NOT NULL
body_polygon JSONB NOT NULL
orientation_deg NUMERIC NOT NULL
mirrored BOOLEAN NOT NULL
source_type VARCHAR NOT NULL
source_model_id UUID NULL
detection_confidence NUMERIC(5,4) NOT NULL
geometry_confidence NUMERIC(5,4) NOT NULL
class_candidates JSONB NOT NULL
selected_class VARCHAR NULL
style_family VARCHAR NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.8 `schematic_pin_observations`

```text
id UUID PK
symbol_observation_id UUID NOT NULL
page_id UUID NOT NULL
body_attachment_point JSONB NULL
wire_endpoint_point JSONB NOT NULL
orientation_deg NUMERIC NULL
length_pixels NUMERIC NULL
pin_number_candidates JSONB NOT NULL
pin_name_candidates JSONB NOT NULL
electrical_type_candidates JSONB NOT NULL
detection_confidence NUMERIC(5,4) NOT NULL
association_confidence NUMERIC(5,4) NOT NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.9 `schematic_port_observations`

```text
id UUID PK
page_id UUID NOT NULL
port_type VARCHAR NOT NULL
polygon JSONB NOT NULL
anchor_point JSONB NOT NULL
direction_candidate VARCHAR NULL
label_text_observation_id UUID NULL
label_candidates JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.10 `schematic_wire_observations`

```text
id UUID PK
page_id UUID NOT NULL
polyline JSONB NOT NULL
source_type VARCHAR NOT NULL
stroke_width NUMERIC NULL
stroke_style VARCHAR NULL
color JSONB NULL
endpoint_candidates JSONB NOT NULL
occlusion_segments JSONB NOT NULL
detection_confidence NUMERIC(5,4) NOT NULL
geometry_confidence NUMERIC(5,4) NOT NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.11 `schematic_junction_observations`

```text
id UUID PK
page_id UUID NOT NULL
position JSONB NOT NULL
junction_type VARCHAR NOT NULL
connected_wire_ids JSONB NOT NULL
source_type VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
source_evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.12 `schematic_crossing_observations`

```text
id UUID PK
page_id UUID NOT NULL
position JSONB NOT NULL
wire_ids JSONB NOT NULL
crossing_type VARCHAR NOT NULL
dot_evidence_id UUID NULL
bridge_evidence_id UUID NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.13 `schematic_label_observations`

```text
id UUID PK
page_id UUID NOT NULL
text_observation_id UUID NOT NULL
label_type VARCHAR NOT NULL
anchor_point JSONB NULL
associated_wire_id UUID NULL
normalized_label VARCHAR NULL
scope_candidate JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.14 `schematic_bus_observations`

```text
id UUID PK
page_id UUID NOT NULL
polyline JSONB NOT NULL
label_observation_id UUID NULL
bus_name VARCHAR NULL
member_pattern VARCHAR NULL
member_candidates JSONB NOT NULL
direction VARCHAR NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.15 `schematic_bus_entries`

```text
id UUID PK
bus_observation_id UUID NOT NULL
page_id UUID NOT NULL
bus_attachment JSONB NOT NULL
member_wire_id UUID NULL
member_label_observation_id UUID NULL
resolved_member_name VARCHAR NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.16 `schematic_part_candidates`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NOT NULL
symbol_observation_id UUID NOT NULL
reference_candidates JSONB NOT NULL
value_candidates JSONB NOT NULL
part_number_candidates JSONB NOT NULL
manufacturer_candidates JSONB NOT NULL
package_candidates JSONB NOT NULL
associated_text_ids JSONB NOT NULL
pin_observation_ids JSONB NOT NULL
variant_status_candidate VARCHAR NULL
association_confidence NUMERIC(5,4) NOT NULL
identity_confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.17 `schematic_graph_nodes`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NOT NULL
node_type VARCHAR NOT NULL
source_entity_type VARCHAR NOT NULL
source_entity_id UUID NOT NULL
position JSONB NULL
properties JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
```

## 69.18 `schematic_graph_edges`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
source_entity_ids JSONB NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

Edge Type：

```text
wire_segment
pin_attachment
label_attachment
junction_merge
gap_bridge_candidate
cross_page_equivalence
bus_membership
manual_connection
```

## 69.19 `schematic_page_nets`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NOT NULL
page_net_key VARCHAR NOT NULL
canonical_name_candidate VARCHAR NULL
graph_node_ids JSONB NOT NULL
graph_edge_ids JSONB NOT NULL
pin_observation_ids JSONB NOT NULL
label_observation_ids JSONB NOT NULL
port_observation_ids JSONB NOT NULL
connectivity_confidence NUMERIC(5,4) NOT NULL
unresolved_issue_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(recognition_job_id, page_id, page_net_key)
```

## 69.20 `schematic_cross_page_link_candidates`

```text
id UUID PK
recognition_job_id UUID NOT NULL
source_page_id UUID NOT NULL
source_port_or_label_id UUID NOT NULL
target_page_id UUID NULL
target_port_or_label_id UUID NULL
normalized_name VARCHAR NULL
link_type VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
evidence JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.21 `schematic_project_nets`

```text
id UUID PK
recognition_job_id UUID NOT NULL
project_net_key VARCHAR NOT NULL
canonical_name VARCHAR NULL
page_net_ids JSONB NOT NULL
cross_page_link_ids JSONB NOT NULL
bus_membership JSONB NOT NULL
connectivity_confidence NUMERIC(5,4) NOT NULL
release_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(recognition_job_id, project_net_key)
```

## 69.22 `schematic_recognition_evidence`

```text
id UUID PK
tenant_id UUID NOT NULL
page_id UUID NULL
evidence_type VARCHAR NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
mime_type VARCHAR NULL
geometry JSONB NULL
source_reference JSONB NOT NULL
model_or_rule_version VARCHAR NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 69.23 `schematic_recognition_models`

```text
id UUID PK
model_name VARCHAR NOT NULL
model_version VARCHAR NOT NULL
model_type VARCHAR NOT NULL
task VARCHAR NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
runtime VARCHAR NOT NULL
input_schema_version VARCHAR NOT NULL
output_schema_version VARCHAR NOT NULL
supported_styles JSONB NOT NULL
approved_scope JSONB NOT NULL
validation_report_uri TEXT NOT NULL
status VARCHAR NOT NULL
shadow_mode BOOLEAN NOT NULL
created_at TIMESTAMPTZ
UNIQUE(model_name, model_version)
```

## 69.24 `schematic_model_predictions`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NOT NULL
model_id UUID NOT NULL
prediction_type VARCHAR NOT NULL
target_entity_type VARCHAR NULL
target_entity_id UUID NULL
prediction JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
input_evidence_ids JSONB NOT NULL
inference_latency_ms INT NULL
created_at TIMESTAMPTZ
```

## 69.25 `schematic_review_items`

```text
id UUID PK
recognition_job_id UUID NOT NULL
page_id UUID NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
affected_entities JSONB NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 69.26 `schematic_review_patches`

```text
id UUID PK
recognition_job_id UUID NOT NULL
review_item_id UUID NULL
patch_version INT NOT NULL
operation VARCHAR NOT NULL
target_path TEXT NOT NULL
before_value JSONB NULL
after_value JSONB NULL
reason_code VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(recognition_job_id, patch_version)
```

## 69.27 `schematic_recognition_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
source_asset_id UUID NOT NULL
requested_outputs JSONB NOT NULL
processing_profile_version VARCHAR NOT NULL
model_versions JSONB NOT NULL
rule_versions JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
result_summary JSONB NULL
release_level VARCHAR NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 69.28 `schematic_recognition_validations`

```text
id UUID PK
recognition_job_id UUID NOT NULL
validator_id VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
validation_type VARCHAR NOT NULL
status VARCHAR NOT NULL
issue_count INT NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 69.29 `schematic_recognition_fidelity`

```text
id UUID PK
recognition_job_id UUID NOT NULL
version INT NOT NULL
overall_status VARCHAR NOT NULL
dimension_results JSONB NOT NULL
symbol_coverage NUMERIC NULL
text_coverage NUMERIC NULL
pin_coverage NUMERIC NULL
wire_coverage NUMERIC NULL
junction_coverage NUMERIC NULL
cross_page_coverage NUMERIC NULL
bus_coverage NUMERIC NULL
reviewed_fraction NUMERIC NOT NULL
critical_unresolved_count INT NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(recognition_job_id, version)
```

## 69.30 `schematic_dataset_versions`

```text
id UUID PK
dataset_name VARCHAR NOT NULL
version VARCHAR NOT NULL
dataset_type VARCHAR NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
label_schema_version VARCHAR NOT NULL
page_count BIGINT NOT NULL
project_count BIGINT NOT NULL
style_distribution JSONB NOT NULL
source_distribution JSONB NOT NULL
license_and_consent JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(dataset_name, version)
```

---

# 70. 对象存储

```text
derived/schematic-recognition/
  {tenant_id}/{source_asset_id}/
    source/
      original/
      security-report.json
      page-inventory.json
    jobs/
      {recognition_job_id}/
        pages/
          {page_index}/
            native/
              text.json
              vectors.json.zst
              images/
            renders/
              preview.png
              recognition.png
              tiles/
            preprocessing/
            ocr/
              text-observations.json.zst
              character-confidence.json.zst
            symbols/
              detections.json.zst
              crops/
            pins-ports/
            wires/
              segmentation.png
              skeleton.png
              polylines.json.zst
            junctions/
            labels/
            buses/
            graph/
              nodes.json.zst
              edges.json.zst
              page-nets.json.zst
            overlays/
        cross-page/
          links.json
          unresolved.json
        fusion/
          part-candidates.json.zst
          project-nets.json.zst
          conflicts.json
        review/
          items.json.zst
          patches.json.zst
          reviewed-ir.json.zst
        outputs/
          recognition-ir.json.zst
          schematic-ir-candidate.json.zst
          part-ir-candidate.json.zst
          net-ir-candidate.json.zst
          netlist-candidate.json
        reports/
          recognition-report.html
          recognition-report.pdf
          fidelity.json
          diagnostics.json
        debug/
          pipeline-trace.jsonl.zst
          model-predictions.jsonl.zst
          graph-trace.jsonl.zst
          resource-usage.json
```

---

# 71. API 设计

## 71.1 Source

```text
POST /api/v1/schematic-recognition/sources
GET  /api/v1/schematic-recognition/sources/{id}
GET  /api/v1/schematic-recognition/sources/{id}/pages
GET  /api/v1/schematic-recognition/sources/{id}/security-report
```

## 71.2 Jobs

```text
POST /api/v1/schematic-recognition/jobs
POST /api/v1/schematic-recognition/jobs/batch
GET  /api/v1/schematic-recognition/jobs/{id}
GET  /api/v1/schematic-recognition/jobs/{id}/events
POST /api/v1/schematic-recognition/jobs/{id}/cancel
POST /api/v1/schematic-recognition/jobs/{id}/retry
POST /api/v1/schematic-recognition/jobs/{id}/rerun
```

## 71.3 Pages 和 Observations

```text
GET /api/v1/schematic-recognition/jobs/{id}/pages
GET /api/v1/schematic-recognition/pages/{id}/render
GET /api/v1/schematic-recognition/pages/{id}/texts
GET /api/v1/schematic-recognition/pages/{id}/symbols
GET /api/v1/schematic-recognition/pages/{id}/pins
GET /api/v1/schematic-recognition/pages/{id}/wires
GET /api/v1/schematic-recognition/pages/{id}/junctions
GET /api/v1/schematic-recognition/pages/{id}/labels
GET /api/v1/schematic-recognition/pages/{id}/buses
GET /api/v1/schematic-recognition/pages/{id}/graph
```

## 71.4 Parts 和 Nets

```text
GET /api/v1/schematic-recognition/jobs/{id}/parts
GET /api/v1/schematic-recognition/jobs/{id}/page-nets
GET /api/v1/schematic-recognition/jobs/{id}/project-nets
GET /api/v1/schematic-recognition/jobs/{id}/cross-page-links
GET /api/v1/schematic-recognition/jobs/{id}/netlist
```

## 71.5 Review

```text
GET  /api/v1/schematic-recognition/reviews
GET  /api/v1/schematic-recognition/reviews/{id}
POST /api/v1/schematic-recognition/reviews/{id}/claim
POST /api/v1/schematic-recognition/reviews/{id}/patch
POST /api/v1/schematic-recognition/reviews/{id}/resolve
POST /api/v1/schematic-recognition/jobs/{id}/validate-review
POST /api/v1/schematic-recognition/jobs/{id}/publish-reviewed-ir
```

## 71.6 Validation 和 Fidelity

```text
POST /api/v1/schematic-recognition/jobs/{id}/validate
GET  /api/v1/schematic-recognition/jobs/{id}/diagnostics
GET  /api/v1/schematic-recognition/jobs/{id}/fidelity
GET  /api/v1/schematic-recognition/jobs/{id}/coverage
```

## 71.7 Models 和 Datasets

```text
GET  /api/v1/schematic-recognition/models
GET  /api/v1/schematic-recognition/models/{id}
POST /api/v1/schematic-recognition/models/{id}/validate
POST /api/v1/schematic-recognition/models/{id}/approve
POST /api/v1/schematic-recognition/models/{id}/suspend
GET  /api/v1/schematic-recognition/models/{id}/drift
GET  /api/v1/schematic-recognition/datasets
```

## 71.8 Export

```text
GET  /api/v1/schematic-recognition/jobs/{id}/recognition-ir
GET  /api/v1/schematic-recognition/jobs/{id}/agent16-ir
GET  /api/v1/schematic-recognition/jobs/{id}/netlist-candidate
POST /api/v1/schematic-recognition/jobs/{id}/export-package
```

---

# 72. 输入事件

```text
document.source.uploaded
document.revision.created
schematic.recognition.requested
schematic.model.approved
schematic.rule-profile.updated
agent16.ir-schema.released
component.library.updated
```

---

# 73. 输出事件

```text
schematic.page-inventory.ready
schematic.page-classification.ready
schematic.observations.ready
schematic.connectivity-candidate.ready
schematic.review.required
schematic.review.completed
schematic.netlist-candidate.ready
schematic.agent16-ir.ready
schematic.recognition.failed
```

## `schematic.agent16-ir.ready`

```json
{
  "event_type": "schematic.agent16-ir.ready",
  "event_version": "1.0",
  "recognition_job_id": "uuid",
  "source_asset_id": "uuid",
  "release_level": "reviewed_connectivity",
  "ir_versions": {
    "recognition": "1.0.0",
    "schematic": "1.0.0",
    "part": "1.0.0",
    "net": "1.0.0"
  },
  "critical_unresolved_count": 0,
  "manifest_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 74. Processing Profile

```text
profiles/
├── born-digital-vector.yaml
├── mixed-pdf.yaml
├── scanned-clean.yaml
├── scanned-low-quality.yaml
├── mobile-photo.yaml
├── screenshot.yaml
├── legacy-blueprint.yaml
└── enterprise/
```

每个 Profile 定义：

```text
render DPI
preprocessing
OCR model
symbol model
wire method
junction thresholds
association thresholds
review thresholds
resource budget
```

---

# 75. Rule Bundles

```text
policies/
├── schematic-recognition-1.0.0.yaml
├── page-classification.yaml
├── text-normalization.yaml
├── text-role.yaml
├── refdes-patterns.yaml
├── units-and-values.yaml
├── symbol-taxonomy.yaml
├── pin-port.yaml
├── wire-graphics-separation.yaml
├── junction-crossing.yaml
├── text-association.yaml
├── cross-page.yaml
├── bus-syntax.yaml
├── net-publishing-gates.yaml
└── enterprise/
```

---

# 76. Rule Engine

要求：

- JSON/YAML Schema；
- 受限表达式；
- 版本；
- Scope；
- 优先级；
- Effectivity；
- 冲突检测；
- Dry Run；
- Explain Trace；
- Rollback；
- 禁止任意代码执行。

---

# 77. Model Registry

模型任务：

```text
page classification
text detection
text recognition
text role
symbol detection
pin detection
port detection
wire segmentation
junction detection
crossing classification
```

每个模型声明：

```text
supported source types
DPI range
symbol styles
languages
excluded conditions
validation metrics
hardware/runtime
```

---

# 78. 模型治理

状态：

```text
development
shadow
limited_release
approved
suspended
retired
```

低质量输入或漂移时自动降级：

```text
vector/rule path
manual review
```

不得自动换用未经批准模型。

---

# 79. 关键模型指标

## OCR

```text
CER
WER
RefDes exact-match
MPN exact-match
unit-symbol accuracy
```

## Symbol

```text
mAP
per-class precision/recall
orientation accuracy
unknown rejection
```

## Pin

```text
endpoint distance
pin detection recall
symbol association accuracy
```

## Wire/Junction

```text
wire pixel F1
polyline endpoint error
junction precision/recall
crossing classification
```

## Graph

```text
net edge precision/recall
pin-to-net accuracy
net split rate
net merge rate
cross-page link accuracy
bus member accuracy
```

---

# 80. Golden Graph Benchmark

不能只测图片框。

必须对比：

```text
recognized Part Set
recognized Pin Set
recognized Net Endpoint Set
recognized Net Partition
cross-page equivalence
bus membership
```

---

# 81. Exact Net Partition

对于小型 Golden Page，比较：

```text
每个 Pin 属于哪个 Net
哪些 Pin 在同一 Connected Component
```

指标：

```text
pairwise connectivity precision
pairwise connectivity recall
adjusted rand index optional
exact page netlist match
```

---

# 82. 初始质量目标

```text
Raw Source Preservation = 100%
Page Transform Reproducibility = 100%
Native PDF Text Preservation = 100%
Vector Path Preservation = 100%
RefDes Exact-match >= 99.5% on supported clean scope
Value Exact-match >= 98.5% on supported clean scope
Symbol Detection Recall >= 99% on approved symbol classes
Pin Endpoint Recall >= 99% on approved clean scope
Explicit Junction Recall >= 99.5%
Crossing False-connect Rate <= 0.1%
Page Pin-to-Net Accuracy >= 99% on clean vector PDFs
Cross-page Link Accuracy >= 99% after required review gates
Bus Member Auto-publish Error Rate = 0%
Critical Ambiguity Auto-publish Rate = 0%
Machine Observation Overwrite Rate = 0%
Tenant/Project Isolation = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经验证的保证。

---

# 83. 测试集

公开仓库只使用开源、合成、脱敏或明确授权数据。

## Input/Page

1. Vector PDF；
2. Mixed PDF；
3. Scan PDF；
4. PNG；
5. JPEG Compression；
6. TIFF；
7. Rotated Page；
8. Skew；
9. Perspective Photo；
10. Large A0 Drawing；
11. Encrypted PDF；
12. Corrupted PDF；
13. Active Content；
14. Non-schematic Page；
15. Missing Page Number。

## Text

16. RefDes；
17. U1A；
18. Value 10k；
19. Value 4.7uF；
20. MPN；
21. Pin Number；
22. Pin Name；
23. Net Label；
24. Chinese Note；
25. 0/O Confusion；
26. 1/I/l；
27. µ/u；
28. Ω/0；
29. Rotated Text；
30. Text Over Wire。

## Symbols

31. IEC Resistor；
32. ANSI Resistor；
33. Capacitor；
34. Polarized Capacitor；
35. Inductor；
36. Diode；
37. LED；
38. Zener；
39. BJT；
40. MOSFET；
41. Opamp；
42. Logic Gate；
43. Generic IC；
44. Connector；
45. Relay；
46. Transformer；
47. Power；
48. Ground；
49. Off-page Connector；
50. Unknown Custom Symbol。

## Connectivity

51. Straight Wire；
52. Polyline；
53. T-junction；
54. Dot Junction；
55. Crossing No Dot；
56. Bridge Jump；
57. Overlap；
58. Broken Wire；
59. Text Occlusion；
60. Pin Touch；
61. Near-but-not-touch；
62. No Connect；
63. Local Label；
64. Global Label；
65. Power Label；
66. Hierarchical Port；
67. Off-page Page Reference；
68. Duplicate Off-page Label；
69. Missing Target；
70. Conflicting Target。

## Bus

71. D[0..7]；
72. D[7..0]；
73. D0-D7；
74. DATA[7:0]；
75. Bus Entry；
76. Missing Member Label；
77. Multiple Bus；
78. Bus Crossing；
79. Diff Pair Candidate；
80. Unknown Syntax。

## Review/System

81. Bind Text；
82. Correct OCR；
83. Split Net；
84. Merge Net；
85. Confirm Junction；
86. Reject Junction；
87. Cross-page Link；
88. Bus Member；
89. Patch Replay；
90. Model Upgrade；
91. Deterministic Rerun；
92. Agent 16 Export；
93. Netlist Gate；
94. Tenant Isolation；
95. Permission Denied；
96. 1,000 Pages；
97. 100k Symbols；
98. Cancellation；
99. Resource Exhaustion；
100. Audit Replay。

---

# 84. 性能要求

常规文档：

```text
20 pages
A3/A4
300-600 DPI
```

目标：

```text
Page Inventory P95 < 5 s
Vector Extraction P95 < 2 s/page
OCR + Detection P95 < 15 s/page on target GPU
Graph Build P95 < 3 s/page
Interactive Overlay Query P95 < 300 ms
```

大型图纸：

```text
1,000 pages
A0
高分辨率
```

需要：

- Page Queue；
- Tile Rendering；
- Tile Overlap；
- GPU Worker Pool；
- Vector-first；
- 图片/元数据分离；
- 流式 JSONL；
- 分区；
- Backpressure；
- 可取消；
- 断点恢复；
- 不将整页所有中间图常驻内存。

---

# 85. 可观测性

```text
schematic_recognition_jobs_total{status,profile}
schematic_pages_total{page_type,content_mode}
schematic_page_processing_seconds{step}
schematic_ocr_cer{profile,language}
schematic_refdes_exact_rate{profile}
schematic_symbol_predictions_total{class,status}
schematic_unknown_symbols_total
schematic_pin_detection_rate{profile}
schematic_wire_segments_total{source}
schematic_junctions_total{type,status}
schematic_crossing_ambiguous_total
schematic_page_nets_total
schematic_cross_page_links_total{status}
schematic_bus_entries_total{status}
schematic_review_items_total{type,severity}
schematic_net_publish_blocks_total{reason}
schematic_model_drift_total{model}
schematic_resource_usage{resource}
```

---

# 86. Dashboard

```text
Jobs and Pages
Vector vs Scan Ratio
OCR Quality
Symbol Coverage
Unknown Symbols
RefDes/Value/MPN Coverage
Pin Coverage
Wire/Junction Coverage
Ambiguous Crossings
Cross-page Link Status
Bus Resolution
Netlist Readiness
Review Queue
Model Drift
Processing Time
Resource Usage
```

---

# 87. 安全与权限

- PDF 和图片作为不可信输入；
- 禁止执行 PDF JavaScript、Launch、Embedded File；
- PDF Renderer 在沙箱运行；
- ZIP 防路径穿越和压缩炸弹；
- 限制页面、像素、DPI 和内存；
- 对象存储私有加密；
- 临时渲染定期清理；
- Source、Page、Evidence 和 Review 按租户/项目隔离；
- 原理图和器件型号可能构成商业机密；
- 不在日志输出完整 OCR 文本或工程路径；
- 下载使用短期签名 URL；
- 模型 Artifact 使用 Hash 和签名；
- OCR/视觉模型只使用批准版本；
- Worker 默认无公网；
- 不从 PDF 内 URL 自动下载内容；
- 不将原理图发送给外部通用 VLM；
- 如使用第三方 OCR 服务，必须有企业批准、数据协议和明确 Scope；
- 人工审核员按项目授权；
- Patch、发布和 Netlist Export 分权；
- 训练数据需要许可、脱敏和用途记录；
- 原始观察和人工修改不可硬删除。

---

# 88. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Temporal
Kafka / Redpanda optional
```

PDF：

```text
PyMuPDF
PDFium optional independent renderer
qpdf/mutool only in sandbox where licensed/approved
```

图像：

```text
OpenCV
scikit-image
Pillow
Shapely
```

OCR：

```text
PaddleOCR local pipeline
Tesseract optional fallback
custom schematic recognizer
```

模型：

```text
PyTorch for training
ONNX Runtime for production
TensorRT/OpenVINO optional
```

数据：

```text
Polars
PyArrow
DuckDB
```

V1 不依赖通用 LLM。

---

# 89. 推荐仓库结构

```text
schematic-recognition-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── schematic-recognition-agent-spec.md
│   ├── recognition-ir.md
│   ├── pdf-vector-raster-pipeline.md
│   ├── page-and-coordinate-model.md
│   ├── text-ocr-and-role-model.md
│   ├── symbol-and-pin-model.md
│   ├── wire-junction-connectivity.md
│   ├── cross-page-and-bus.md
│   ├── review-workbench.md
│   ├── agent16-ir-adapter.md
│   ├── dataset-and-synthetic-generation.md
│   ├── model-governance.md
│   ├── security-and-sandbox.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-vector-first-raster-second.md
│       ├── 0002-observation-and-reviewed-ir-separated.md
│       ├── 0003-crossing-is-not-a-junction.md
│       ├── 0004-llm-does-not-build-net-graph.md
│       ├── 0005-review-patches-do-not-overwrite-observations.md
│       └── 0006-netlist-requires-release-gates.md
├── src/
│   └── schematic_recognition/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── source.py
│       │   ├── page.py
│       │   ├── text.py
│       │   ├── symbol.py
│       │   ├── pin.py
│       │   ├── wire.py
│       │   ├── junction.py
│       │   ├── label.py
│       │   ├── bus.py
│       │   ├── graph.py
│       │   ├── part.py
│       │   ├── recognition_ir.py
│       │   └── review.py
│       ├── intake/
│       │   ├── upload.py
│       │   ├── pdf_security.py
│       │   ├── archive.py
│       │   ├── hashing.py
│       │   └── limits.py
│       ├── pdf/
│       │   ├── inventory.py
│       │   ├── text.py
│       │   ├── vectors.py
│       │   ├── images.py
│       │   ├── transforms.py
│       │   ├── renderer.py
│       │   └── classifier.py
│       ├── imaging/
│       │   ├── orientation.py
│       │   ├── deskew.py
│       │   ├── dewarp.py
│       │   ├── threshold.py
│       │   ├── denoise.py
│       │   ├── morphology.py
│       │   └── tiling.py
│       ├── ocr/
│       │   ├── engine.py
│       │   ├── paddle.py
│       │   ├── normalizer.py
│       │   ├── confusion.py
│       │   ├── roles.py
│       │   └── lexicons.py
│       ├── symbols/
│       │   ├── taxonomy.py
│       │   ├── detector.py
│       │   ├── vector_classifier.py
│       │   ├── orientation.py
│       │   ├── unknown.py
│       │   └── association.py
│       ├── pins/
│       │   ├── detector.py
│       │   ├── geometry.py
│       │   ├── numbers.py
│       │   └── names.py
│       ├── wires/
│       │   ├── vector.py
│       │   ├── segmentation.py
│       │   ├── hough.py
│       │   ├── skeleton.py
│       │   ├── trace.py
│       │   ├── occlusion.py
│       │   └── graphics_filter.py
│       ├── junctions/
│       │   ├── dots.py
│       │   ├── topology.py
│       │   ├── crossings.py
│       │   └── bridges.py
│       ├── labels/
│       │   ├── classifier.py
│       │   ├── anchors.py
│       │   ├── scope.py
│       │   └── normalization.py
│       ├── buses/
│       │   ├── detector.py
│       │   ├── syntax.py
│       │   ├── entries.py
│       │   └── members.py
│       ├── connectivity/
│       │   ├── nodes.py
│       │   ├── edges.py
│       │   ├── page_graph.py
│       │   ├── components.py
│       │   ├── cross_page.py
│       │   ├── validation.py
│       │   └── trace.py
│       ├── fusion/
│       │   ├── evidence.py
│       │   ├── text_symbol.py
│       │   ├── pin_wire.py
│       │   ├── conflicts.py
│       │   └── confidence.py
│       ├── review/
│       │   ├── queue.py
│       │   ├── patches.py
│       │   ├── validation.py
│       │   └── publishing.py
│       ├── export/
│       │   ├── agent16.py
│       │   ├── netlist.py
│       │   ├── overlays.py
│       │   └── reports.py
│       ├── models/
│       │   ├── registry.py
│       │   ├── inference.py
│       │   ├── validation.py
│       │   ├── drift.py
│       │   └── governance.py
│       ├── datasets/
│       │   ├── manifests.py
│       │   ├── synthetic.py
│       │   ├── rendering.py
│       │   ├── augmentation.py
│       │   └── splitting.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── processing-profiles/
├── model-registry/
├── datasets/
├── review-ui/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_schematic_source.py
    ├── render_pdf_pages.py
    ├── extract_pdf_vectors.py
    ├── run_schematic_ocr.py
    ├── inspect_wire_graph.py
    ├── validate_cross_page_links.py
    ├── export_agent16_ir.py
    ├── generate_synthetic_schematic_dataset.py
    ├── replay_recognition_job.py
    └── run_schematic_benchmark.py
```

---

# 90. 当前技术资料参考

开发前重新核验版本和许可证：

```text
PyMuPDF Documentation
https://pymupdf.readthedocs.io/

OpenCV Hough Line Transform
https://docs.opencv.org/master/d9/db0/tutorial_hough_lines.html

PaddleOCR Documentation
https://www.paddleocr.ai/

ONNX Runtime Documentation
https://onnxruntime.ai/docs/
```

这些资料用于技术选型，不应把具体模型版本永久硬编码到业务规则中。


---

# 91. Codex 分阶段实施

不要让 Codex 一次实现 PDF 解析、OCR、全部符号模型、总线、跨页、审核工作台和自动网表。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 16 的真实完成程度、IR Schema 和接口；
2. 当前 PDF、图片、OCR、图像处理和文档 Viewer；
3. 当前 PyMuPDF、PDFium、OpenCV、PaddleOCR、Tesseract 或其他依赖；
4. 当前原理图符号库和 Symbol Taxonomy；
5. 当前 KiCad/Altium/JLCEDA 原理图渲染能力；
6. 当前 Project/Schematic/Part/Net IR；
7. 当前 PDF 上传、对象存储、页面渲染和坐标变换；
8. 当前文本检测、OCR、文字框和置信度；
9. 当前符号识别、模板匹配和视觉模型；
10. 当前线段、骨架、Junction 和图算法；
11. 当前 RefDes、Value、MPN、Pin Number 和 Net Label；
12. 当前跨页连接、Sheet、Port、Bus 和 Net；
13. 当前 Review UI、Overlay、Patch 和审计；
14. 当前训练数据、开源工程和合成数据生成；
15. 当前模型注册、验证、ONNX、GPU 和漂移；
16. 当前安全沙箱、PDF Active Content、Zip Bomb、Pixel Limit；
17. 当前 API、Queue、Worker、Object Storage 和 Database；
18. 当前 Agent 31、32、43、44、45 数据契约；
19. 统计 PDF 类型、页面质量、OCR 失败、Unknown Symbol 和 Graph Gap；
20. 抽样分析开源、合成、脱敏或授权原理图；
21. 不修改业务代码；
22. 不创建 Migration；
23. 不安装依赖；
24. 不训练或部署生产模型；
25. 不调用外部通用 VLM；
26. 不读取或打印生产 Secret。

## Phase 1：Recognition IR 和 JSON Schema

实现：

- Source/Page；
- Coordinate Transform；
- Text Observation；
- Symbol Observation；
- Pin/Port；
- Wire/Junction/Crossing；
- Label；
- Bus；
- Part Candidate；
- Graph Node/Edge；
- Page Net；
- Cross-page Link；
- Project Net；
- Evidence；
- Review Patch；
- Fidelity；
- Agent 16 Adapter Contract。

## Phase 2：Safe Intake 和 Page Inventory

实现：

- PDF/Image/ZIP；
- Hash；
- Malware Hook；
- PDF Active Content Block；
- Page Limits；
- Pixel/DPI Limits；
- Archive Limits；
- Page Metadata；
- Immutable Source；
- Sandbox Contract。

## Phase 3：PDF Vector/Text Extraction

实现：

- Page Geometry；
- CropBox/Rotation；
- Native Text；
- Vector Paths；
- Fill/Stroke；
- Embedded Images；
- Source Object Index；
- PDF-to-canonical Transform；
- Preservation Tests。

## Phase 4：Raster Rendering 和 Preprocessing

实现：

- Preview/Recognition Render；
- Tile；
- Orientation；
- Deskew；
- Perspective；
- Denoise；
- Threshold；
- Line-preserving Morphology；
- Profile Version；
- Reproducibility。

## Phase 5：Page Type Classification

实现：

- Schematic；
- Block Diagram；
- BOM；
- Notes；
- Waveform；
- PCB/Mechanical；
- Mixed；
- Unknown；
- Vector/Raster Features；
- Review on Low Confidence。

## Phase 6：OCR Core

实现：

- Local OCR Adapter；
- Detection；
- Orientation；
- Recognition；
- Character Confidence；
- Multi-language；
- Raw Text Preservation；
- Tiling；
- Model Version；
- Golden Text Tests。

## Phase 7：Text Normalization 和 Role

实现：

- RefDes；
- Value；
- MPN Candidate；
- Pin Number/Name；
- Net/Bus/Port Label；
- Sheet/Page；
- Note；
- Confusion Candidates；
- Lexicon；
- No Silent Correction。

## Phase 8：Symbol Taxonomy 和 Vector Symbols

实现：

- Taxonomy Registry；
- Basic Passive；
- Diode/LED；
- Power/Ground；
- Connector；
- Port；
- Vector Primitive Grouping；
- Orientation；
- Style Family；
- Unknown Preservation。

## Phase 9：Raster Symbol Model V1

实现：

- Detector Contract；
- Approved Classes；
- Bounding Polygon；
- Orientation；
- Unknown/OOD；
- Model Registry；
- ONNX Inference；
- Shadow Mode；
- Per-class Metrics；
- No Net Generation。

## Phase 10：Pin 和 Port Detection

实现：

- Symbol Body Boundary；
- Pin Line；
- Endpoint；
- Body Attachment；
- Port Anchor；
- Pin Text Association；
- Pin Number/Name Candidate；
- Unknown Electrical Type。

## Phase 11：Text-to-Symbol/Pin Association

实现：

- Spatial Features；
- Role Compatibility；
- Alignment；
- Candidate Graph；
- Assignment；
- Conflict；
- RefDes Uniqueness；
- Part Candidate；
- Review。

## Phase 12：Vector Wire Extraction

实现：

- Path Classification；
- Segment/Polyline；
- Stroke；
- Symbol/Title-block Filtering；
- Endpoint；
- Vector Junction Dot；
- Page Wire Evidence；
- Source Map。

## Phase 13：Raster Wire Segmentation

实现：

- Line Candidate；
- Hough/LSD；
- Text/Symbol Mask；
- Skeleton；
- Polyline Tracing；
- Fragment Merge Candidate；
- Occlusion；
- Confidence；
- No Aggressive Bridging。

## Phase 14：Junction 和 Crossing

实现：

- Filled Dot；
- T-junction；
- Cross with Dot；
- Cross without Dot；
- Bridge Jump；
- Ambiguous；
- Topology Rules；
- Review Gate；
- Golden Connectivity Tests。

## Phase 15：Page Connectivity Graph

实现：

- Nodes；
- Edges；
- Pin Attachment；
- Wire Segments；
- Junction Merge；
- Label Attachment；
- Connected Components；
- Page Nets；
- Trace；
- Split/Merge Diagnostics。

## Phase 16：Labels、Ports 和 Scope

实现：

- Local/Global/Power；
- Off-page；
- Hierarchical；
- Port Direction Candidate；
- Label Anchor；
- Scope Rules；
- Annotation Exclusion；
- Page Net Naming。

## Phase 17：Cross-page Resolution

实现：

- Page/Sheet Number；
- Off-page References；
- Global Label；
- Unique Matching；
- Conflict；
- Missing Target；
- Candidate/Verified；
- Review；
- Project Net Merge。

## Phase 18：Bus 和 Differential Pair

实现：

- Bus Trunk；
- Entry；
- Syntax Registry；
- Member Expansion；
- Member Label；
- Scope；
- Unknown Syntax；
- Diff Pair Candidate；
- No Position-only Member Guessing。

## Phase 19：Evidence Fusion 和 Confidence

实现：

- Native Text/Vector；
- OCR/Vision；
- Geometry；
- Database Candidate；
- Rule Conflict；
- Confidence Dimensions；
- Selected Candidate；
- Evidence Trace；
- Unknown Propagation。

## Phase 20：Review Workbench Backend

实现：

- Review Queue；
- Severity/Priority；
- Claim；
- Patch DSL；
- Before/After；
- Validation；
- Lock；
- Replay；
- Audit；
- No Observation Overwrite。

## Phase 21：Review Workbench Frontend

实现：

- Page Viewer；
- Zoom/Pan；
- Overlay Layers；
- Symbol/Text/Pin/Wire Editing；
- Junction；
- Split/Merge Net；
- Cross-page Navigation；
- Bus Mapping；
- Evidence Panel；
- Keyboard Workflow。

## Phase 22：Agent 16 IR Adapter 和 Netlist Gate

实现：

- Reviewed Schematic；
- Part IR Candidate；
- Net IR Candidate；
- Recognition Provenance；
- Unresolved；
- Publish Gate；
- Canonical Schema Validation；
- No KiCad Write-back。

## Phase 23：Synthetic Dataset Generator

实现：

- Agent 16/KiCad Source；
- Known IR；
- PDF/Image Render；
- Symbol/Text/Pin/Wire/Junction/Net Labels；
- Cross-page/Bus Truth；
- Noise/Augmentation；
- Dataset Manifest；
- License；
- Deterministic Seed。

## Phase 24：Model Training/Validation Pipeline

实现：

- Dataset Split by Project；
- OCR Fine-tune Optional；
- Symbol Detector；
- Wire/Junction Model Optional；
- Per-class Metrics；
- Net Graph Benchmark；
- Model Card；
- Approval；
- No Direct Production Promotion。

## Phase 25：Incremental、Cache 和 Model Replay

实现：

- Page Hash；
- Processing Profile；
- Model/Rule Key；
- Page-level Cache；
- Selective Rerun；
- Review Patch Reapply；
- Model Comparison；
- Historical Bundle Preservation。

## Phase 26：API、Events、Batch 和 Storage

实现：

- APIs；
- Jobs；
- Progress；
- Batch；
- Cancel/Resume；
- Object Storage；
- JSONL；
- Pagination；
- Tenant/Project Permission；
- Event Version。

## Phase 27：Benchmark、监控和生产发布

实现：

- Golden Vector PDFs；
- Golden Scans；
- Security Corpus；
- OCR/Symbol/Pin/Wire/Junction；
- Net Partition；
- Cross-page/Bus；
- Review Productivity；
- Load Test；
- Metrics；
- Dashboard；
- Feature Flags；
- Rollback；
- Disaster Recovery。

## Phase 28：高级图纸恢复，可选

稳定后：

- Hand-drawn Schematic；
- Complex Harness；
- Color-coded Nets；
- Legacy Microfilm；
- Block Diagram to Schematic Candidate；
- VLM Low-confidence Assistant；
- 只作为 Review Suggestion；
- 不直接发布 Netlist。

---

# 92. Codex 工作纪律

Codex 必须：

1. 原始文件、页面、观察、候选、审核结果和 Canonical IR 分开；
2. Vector-first，Raster-second；
3. Native PDF Text 不被 OCR 覆盖；
4. Native Vector 不被 Raster Line 覆盖；
5. 所有坐标变换可重放；
6. Raw OCR 永久保留；
7. OCR 纠错只生成候选；
8. RefDes、Value、MPN、Pin、Net Label 角色分开；
9. Text Association 是显式关系；
10. Symbol Body、Pin 和 Port 分开；
11. Generic IC 不猜具体器件；
12. Pin Electrical Type 默认 Unknown；
13. Wire Observation 不等于 Net；
14. Graphic Line 和 Wire 分开；
15. Junction Dot、T-junction 和 Crossing 分开；
16. Crossing without Dot 不连接；
17. Bridge Jump 不连接；
18. Ambiguous Crossing 必须审核；
19. Gap Bridge 只生成候选；
20. 不补全长距离断线；
21. Label Scope 必须参与；
22. 同名 Local Label 不自动跨页；
23. Cross-page Link 有 Evidence 和状态；
24. Bus Trunk 不等于普通 Net；
25. Bus Member 不按位置猜；
26. Differential Pair 命名只生成候选；
27. No Connect 与 Pin Name `NC` 分开；
28. Page Net 和 Project Net 分开；
29. Confidence 分维度；
30. 总分不能掩盖 Critical Ambiguity；
31. Machine Observation 不被人工 Patch 覆盖；
32. Patch 可重放和撤销；
33. 发布 Netlist 前执行 Gate；
34. Agent 16 IR 保留 Recognition Provenance；
35. Agent 32负责最终 MPN；
36. 模型版本、Hash、Scope 和指标必须保存；
37. 模型 OOD 可降级到人工；
38. 模型升级不覆盖历史结果；
39. 训练/验证按项目分割；
40. 合成真值与真实标注分开；
41. 不把预测标签当训练真值；
42. 不使用通用 LLM 构建 Wire/Net Graph；
43. VLM 只能辅助低置信度审核；
44. 不将私有原理图发送给外部模型；
45. PDF/图片解析有资源限制；
46. 禁止执行 PDF Active Content；
47. 不从 PDF URL 下载内容；
48. 公开数据必须有许可；
49. 不伪造准确率、完整度、网表或 Benchmark；
50. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Model/Rule/Profile 变化；
    - 测试命令；
    - 真实结果；
    - OCR/Detection Metrics；
    - Pin/Wire/Junction Metrics；
    - Net Graph Metrics；
    - Review Gate；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 93. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/schematic-recognition-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第17个 Agent：

PDF/Image Schematic Recognition & Connectivity Reconstruction Agent /
PDF/图片原理图识别 Agent。

本 Agent 从：

- 可编辑 PDF；
- 扫描 PDF；
- PNG/JPEG/TIFF/WebP；
- 截图和历史图纸；

识别：

- 器件符号；
- 位号、数值、型号和 MPN 候选；
- Pin Number、Pin Name 和 Pin Endpoint；
- Wire、Junction、Crossing 和 No Connect；
- Net Label、Power Label、Port 和 Off-page Connector；
- 跨页连接；
- Bus、Bus Entry 和 Member；

并生成：

- Recognition Observation IR；
- Part Candidate；
- Page Connectivity Graph；
- Cross-page Project Graph；
- Reviewed Schematic IR；
- Agent 16 Compatible Schematic/Part/Net IR；
- Netlist Candidate；
- Fidelity、Diagnostics 和 Review Package。

本 Agent 不自动声称恢复结果与原 EDA 工程等价，不自动生成或覆盖 KiCad 工程，不使用 LLM/VLM 直接构建 Net Graph。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16 规格和实际代码；
3. docs/schematic-recognition-agent-spec.md；
4. 当前 PDF/Image/OCR/Viewer 代码；
5. 当前 PyMuPDF/PDFium/OpenCV/PaddleOCR/Tesseract；
6. 当前 Project/Schematic/Part/Net IR；
7. 当前 Symbol/Footprint/Part Library；
8. 当前原理图渲染、KiCad Viewer 和符号数据；
9. 当前 Text/RefDes/Value/MPN/Pin/Net Label；
10. 当前 Wire/Junction/Connectivity Graph；
11. 当前 Cross-page/Sheet/Port/Bus；
12. 当前 Review UI/Overlay/Patch/Audit；
13. 当前 Model/Dataset/ONNX/GPU/Drift；
14. 当前 Upload/ZIP/Object Storage/Hash；
15. 当前 PDF Security/Sandbox/Resource Limits；
16. 当前 Agent 31、32、43、44、45 Contracts；
17. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Source/Page/Observation/Candidate/Reviewed/Canonical 分层；
- Vector-first, Raster-second；
- Native Text/Vector 不被 OCR/Vision 覆盖；
- Coordinate Transform 可重放；
- Raw OCR 永久保留；
- OCR Correction 只生成候选；
- Text Roles 分开；
- Text Association 显式；
- Symbol/Pin/Port 分开；
- Generic IC 不猜具体 Part；
- Pin Electrical Type 默认 Unknown；
- Wire 不等于 Net；
- Graphic/Wire 分开；
- Junction/Crossing/Bridge 分开；
- Cross without Dot 不连接；
- Ambiguous Crossing 必须审核；
- Gap Bridge 只生成候选；
- Local Label 不自动跨页；
- Cross-page Link 有 Evidence/Status；
- Bus/Member 分开；
- Bus Member 不按位置猜；
- Diff Pair 只生成候选；
- No Connect 与 Pin Name NC 分开；
- Page Net/Project Net 分开；
- Confidence 分维度；
- Critical Ambiguity 不能被总分覆盖；
- Review Patch 不覆盖 Machine Observation；
- Netlist 发布前有 Gate；
- Agent 16 IR 保留 Recognition Provenance；
- Agent 32负责最终 MPN；
- Model Version/Hash/Scope/Metrics 保存；
- OOD 降级人工；
- 训练验证按 Project 分割；
- Prediction 不作为 Ground Truth；
- 不使用 LLM/VLM 构建 Wire/Net；
- VLM 只辅助低置信度审核；
- 不把私有原理图发送给外部模型；
- PDF/ZIP/Image 资源限制；
- 禁止 PDF Active Content；
- 不下载 PDF URL；
- 公开数据有许可；
- 不伪造准确率、网表、完整度和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不训练或部署模型：

1. 侦察当前仓库；
2. 检查 Agent 16 的真实完成程度和 IR Schema；
3. 查找 PDF/Image/OCR/Viewer；
4. 查找 PDF Native Text/Vector/Render；
5. 查找 Coordinate Transform；
6. 查找 Image Preprocessing；
7. 查找 OCR/Text Role/Normalization；
8. 查找 Symbol/Pin/Port Detection；
9. 查找 Wire/Junction/Crossing；
10. 查找 Page Graph/Net；
11. 查找 Cross-page/Sheet/Port；
12. 查找 Bus/Diff Pair；
13. 查找 Review UI/Overlay/Patch；
14. 查找 Agent 16 Export/Netlist；
15. 查找 Model Registry/Dataset/Synthetic Data；
16. 查找 GPU/ONNX/Worker；
17. 查找 Security/Sandbox/Resource Limits；
18. 查找 Agent 31/32/43/44/45 Contracts；
19. 统计文档类型、OCR、Unknown Symbol、Ambiguous Crossing、Cross-page Gap；
20. 抽样分析开源、合成、脱敏或授权原理图；
21. 在 docs/schematic-recognition-implementation-plan.md 中生成实施计划；
22. 在 docs/recognition-ir.md 中定义 IR；
23. 在 docs/pdf-vector-raster-pipeline.md 中定义双通道；
24. 在 docs/page-and-coordinate-model.md 中定义页面坐标；
25. 在 docs/text-ocr-and-role-model.md 中定义文字；
26. 在 docs/symbol-and-pin-model.md 中定义符号和 Pin；
27. 在 docs/wire-junction-connectivity.md 中定义连线；
28. 在 docs/cross-page-and-bus.md 中定义跨页和总线；
29. 在 docs/review-workbench.md 中定义审核；
30. 在 docs/agent16-ir-adapter.md 中定义 Agent 16 输出；
31. 在 docs/dataset-and-synthetic-generation.md 中定义数据；
32. 在 docs/model-governance.md 中定义模型治理；
33. 在 docs/security-and-sandbox.md 中定义安全；
34. 在 docs/schematic-recognition-migration-plan.md 中定义旧数据迁移；
35. 在 docs/schematic-recognition-benchmark-plan.md 中定义 Benchmark；
36. 给出拟新增、拟修改和拟复用文件；
37. 给出 Phase 1 精确范围；
38. 不修改业务代码；
39. 不创建数据库 Migration；
40. 不安装依赖；
41. 不训练模型；
42. 不调用外部 VLM；
43. 不读取或打印生产 Secret；
44. 运行当前仓库已有 lint、type check、test、build 和 security scan；
45. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16 IR 和数据契约；
- PDF Vector/Raster 能力；
- Page/Coordinate；
- OCR/Text Role；
- Symbol/Pin/Port；
- Wire/Junction/Crossing；
- Page Connectivity；
- Cross-page；
- Bus；
- Evidence/Confidence；
- Review Workbench；
- Agent 16 Export；
- Model/Dataset；
- Security/Sandbox；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 94. 后续 Phase 提示词模板

```text
继续实现 Schematic Recognition Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16 和 Agent 17 规格；
3. 阅读 Schematic Recognition Implementation Plan；
4. 阅读 Recognition IR、PDF、OCR、Symbol、Wire、Cross-page、Review、Model、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Vector-first/Raster-second；
- Observation/Reviewed/Canonical Separation；
- Raw Evidence Immutable；
- Coordinate Reproducibility；
- Crossing != Junction；
- No Guessing Connectivity；
- Cross-page Evidence；
- Bus Member Explicit；
- Review Patch Audit；
- Netlist Release Gate；
- Model Version/Scope；
- No External Private VLM；
- 不公开真实工程文件；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. OCR/model fixture test；
10. connectivity graph test；
11. patch replay test；
12. security/resource test；
13. performance test；
14. benchmark；
15. 更新文档；
16. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Model/Rule/Profile 变化；
- 测试命令和真实结果；
- OCR/Symbol/Pin Metrics；
- Wire/Junction/Net Metrics；
- Review/Release Gate；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 95. MVP 演示流程

1. 上传一份 6 页 KiCad 导出的矢量 PDF；
2. 安全检查并生成页面清单；
3. 判定 5 页为 Schematic、1 页为 Notes；
4. 从 PDF 提取 Native Text；
5. 从 PDF 提取矢量路径；
6. 同时渲染 400 DPI 作为视觉证据；
7. 识别 R、C、U、D、J 和电源符号；
8. 将 `R12`、`10k` 关联到同一电阻；
9. 将 `STM32G4...` 作为 U1 MPN Candidate；
10. 识别 U1 矩形主体和 48 个 Pin Endpoint；
11. OCR 一个 Pin Number 出现 `1/I` 歧义；
12. 保留两个候选并创建 Review Item；
13. 提取 Wire Polyline；
14. 识别 T-junction；
15. 识别一个带 Dot 的交叉；
16. 识别一个无 Dot 的交叉且不连接；
17. 识别一个 Bridge Jump；
18. 构建 Page Net；
19. 识别 `+3V3` Power Label；
20. 识别 `I2C_SCL` 和 `I2C_SDA`；
21. 识别 Off-page `USB_D+`；
22. 根据显式页码找到另一页 `USB_D+`；
23. 合并为 Project Net；
24. 识别 `D[0..7]` 总线；
25. 识别 8 个 Bus Entry；
26. 一个 Entry 缺 Member Label，保持 Unresolved；
27. Review UI 高亮该 Entry；
28. 工程师手工映射 `D3`；
29. 检查所有 Critical Crossing；
30. 生成 Reviewed Connectivity；
31. 转换为 Agent 16 Schematic/Part/Net IR；
32. 导出 Netlist Candidate；
33. 上传同一工程的 KiCad 原始文件；
34. Agent 16生成 Ground Truth；
35. 比较 Part、Pin 和 Net Partition；
36. 输出识别差异和 Fidelity；
37. 再上传低质量扫描版；
38. 运行 Raster Pipeline；
39. 低置信度符号进入 Review；
40. 原始观察和人工 Patch 全部保留；
41. 发布 `schematic.agent16-ir.ready`。

---

# 96. 生产上线顺序

第一阶段：

```text
Safe Intake
Vector PDF Text/Paths
Raster Rendering
OCR
基础 Symbol
Wire/Junction
Page Net
Review UI
Agent 16 IR Candidate
```

第二阶段：

```text
扫描图片增强
Pin Detection
Cross-page
Bus
Synthetic Dataset
Model Registry
Netlist Gate
```

第三阶段：

```text
Altium/JLCEDA 多风格
低质量扫描
高级 Unknown Symbol
Cross-process VLM Assistant
Hand-drawn Candidate
```

上线优先确保：

```text
文字和线来自页面的什么位置
交叉线到底连没连
文字到底属于器件还是网络
跨页网络为什么被合并
哪些结果还只是候选
```

宁可把一个模糊的交叉点留给工程师点一下，也不要为了追求“全自动转换”，把两条本来互不相干的网络接在一起。原理图识别中最昂贵的错误，通常不是少识别一个电阻，而是多连了一根并不存在的线。
