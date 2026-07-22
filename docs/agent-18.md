# Netlist 重建 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：18  
> Agent 名称：Netlist Reconstruction, Confidence & Review Agent  
> 中文名称：Netlist 重建 Agent  
> 类型：混合型（确定性图算法 + 规则引擎 + 候选排序 + 人工审核）  
> 版本：V1.0  
>
> 定位：接收 Agent 17 从 PDF、扫描件或图片中识别出的器件、Pin、Wire、Junction、Label、Port、跨页连接和 Bus Observation，经过对象归一化、Pin 身份解析、连接图构建、跨页网络解析、总线展开、冲突检测和人工审核，生成结构化 Pin-to-Net 关系、Netlist、置信度、证据链、未决连接和 Agent 16 兼容的 Part IR / Net IR。
>
> 上游：
> - Agent 16：Canonical EDA IR Schema、Part/Pin/Net 数据契约
> - Agent 17：Recognition IR、Page Graph、Part Candidate、Pin/Wire/Junction/Label/Bus Observation
> - ezPLM 元器件库、符号库、封装库、Pin Definition 和历史审核数据
> - 可选的原生 KiCad/Altium/JLCEDA 工程，用作校验真值
> - 可选的 BOM、数据手册、器件 Pin Table 和企业网络命名规则
>
> 下游：
> - Agent 16：Canonical Schematic IR、Part IR 和 Net IR
> - Agent 19 及后续 ERC、电路理解、功能块识别和设计恢复 Agent
> - Agent 31：从恢复后的 Part/RefDes 生成 BOM
> - Agent 32：器件身份和 MPN 精确解析
> - Agent 43：EBOM/MBOM 与 NPI
> - Agent 44：制造预检
> - Agent 45：AOI、ICT、FCT 的 RefDes、Pin、Pad 和 Net 关联
> - KiCad 草稿重建、网表导出、Viewer 和审核工作台
>
> 核心输出：
> - Netlist Reconstruction IR
> - Pin-to-Net Relationship
> - Page Net
> - Project Net
> - Bus Membership
> - Cross-page Link
> - Power Net Resolution
> - Connectivity Confidence
> - Ambiguous Connection Candidate
> - Conflict and Diagnostic
> - Review Patch
> - Reviewed Netlist
> - Agent 16 Compatible Part IR / Net IR
> - Netlist Fidelity Report
>
> 重要边界：
> - 本 Agent 不重新做整页 OCR，不重新识别全部符号和连线；识别职责属于 Agent 17。
> - 本 Agent 可以调用局部图像、矢量对象或 OCR 证据复核某个连接候选，但不得绕过 Agent 17 的原始观察层。
> - 本 Agent 不自动生成完整 KiCad 原理图布局，不负责 PCB Pin-Pad 映射，不负责器件替代。
> - V1 不允许通用 LLM/VLM 直接输出或覆盖 Net Graph。
> - “靠得很近”“看起来相连”“名称相似”只能生成候选，不能自动成为已发布连接。
> - 所有连接必须有来源、算法路径、置信度、规则版本和审核状态。
> - 无法确定时必须保留 `unresolved`，不能为了网表完整率强行连接。
> - 机器构建的原始 Graph、人工 Patch 和最终 Reviewed Netlist 分层保存。
> - 最终导出的 Netlist 必须满足发布 Gate，并显式列出未解析 Pin、未决跨页连接和未决 Bus Member。
> - 私有原理图、网表和器件数据默认在本地或私有部署处理，不发送给外部通用模型。

---

# 1. Agent 18 的系统位置

```text
PDF / 图片
    ↓
Agent 17 Recognition IR
    ↓
Agent 18 Netlist Reconstruction
    ↓
Agent 16 Canonical Net IR
    ↓
ERC / BOM / Design Recovery / NPI / Manufacturing / Test
```

## 1.1 Agent 17 与 Agent 18 的边界

Agent 17负责：

```text
看到了什么
在哪里
模型和 OCR 认为它是什么
```

例如：

```text
页面 2 有一条 Wire Observation
页面 2 的 U3 有一个 Pin Endpoint
该交叉点可能带 Junction Dot
```

Agent 18负责：

```text
这些观察对象构成怎样的电气网络
哪些 Pin 属于同一个 Net
哪些连接仍有歧义
```

## 1.2 Agent 16 与 Agent 18 的边界

Agent 16解析原生 EDA 文件时，连接通常来自源格式显式语义。

Agent 18的连接来自识别重建，因此 Agent 16 兼容 IR 必须增加：

```text
recognition_provenance
connectivity_confidence
review_status
release_level
source_page_regions
unresolved_relationships
```

Agent 18不能把识别结果伪装成原生 EDA 的确定性连接。

---

# 2. 建设目标

系统必须能够：

1. 接收 Agent 17 Recognition IR；
2. 校验 Recognition IR Schema 和版本；
3. 校验 Page、Coordinate Transform 和 Source Evidence；
4. 接收器件候选；
5. 接收 Pin Observation；
6. 接收 Wire Observation；
7. 接收 Junction 和 Crossing Observation；
8. 接收 Label、Port、Off-page Connector 和 Bus；
9. 保留全部原始 Object ID；
10. 建立标准化 Connectivity Object；
11. 去重重叠或重复的 Wire Segment；
12. 合并同一路径的 Vector/Raster 双重观察；
13. 不合并来源冲突的对象；
14. 建立 Pin Endpoint；
15. 建立 Wire Endpoint；
16. 建立 Junction Node；
17. 建立 Label Anchor；
18. 建立 Port Anchor；
19. 建立 Bus Entry；
20. 建立 No-connect Node；
21. 构建页面级连接图；
22. 正确处理 Wire Endpoint 相交；
23. 正确处理 T-junction；
24. 正确处理显式 Junction Dot；
25. 正确处理无 Dot 交叉；
26. 正确处理 Bridge Jump；
27. 正确处理重叠 Wire；
28. 正确处理很短的断线候选；
29. 不自动补全长距离断线；
30. 将 Pin Endpoint 绑定到器件 Pin；
31. 将 Pin Number/Pin Name 绑定到 Pin；
32. 解析多引脚 IC；
33. 解析两端和三端器件；
34. 处理多个 Pin 共用同一坐标；
35. 处理 Stacked Pin 候选；
36. 处理 Hidden Power Pin 候选；
37. 处理图中未显示 Pin Number；
38. 处理无法确定 Pin 顺序的器件；
39. 识别显式 No Connect；
40. 区分 Pin Name `NC` 与 No-connect Marker；
41. 将文字标签绑定到 Wire/Net；
42. 区分 Local Label；
43. 区分 Global Label；
44. 区分 Power Label；
45. 区分 Hierarchical Port；
46. 区分 Off-page Connector；
47. 区分普通注释；
48. 构建页面级 Page Net；
49. 为每个 Page Net 生成稳定 ID；
50. 为每个 Page Net 保存全部 Pin、Wire、Junction 和 Label；
51. 构建跨页 Link Candidate；
52. 使用显式页码和网格引用；
53. 使用 Off-page Connector；
54. 使用 Global Label；
55. 使用 Power Symbol；
56. 使用 Hierarchical Port；
57. 不用普通 Local Label 自动跨页；
58. 识别重复标签；
59. 识别同名但冲突的跨页端口；
60. 构建 Project Net；
61. 保留 Page Net 到 Project Net 的映射；
62. 解析 Bus Trunk；
63. 解析 Bus Entry；
64. 解析 Bus Member Label；
65. 解析总线范围；
66. 解析升序和降序总线；
67. 解析企业自定义总线语法；
68. 不按 Bus Entry 几何顺序猜 Member；
69. 建立 Bus Membership；
70. 识别差分对候选；
71. 不仅凭 `_P/_N` 自动创建电气约束；
72. 识别 Power Net；
73. 处理 GND、AGND、DGND、PGND；
74. 处理 VCC、VDD、VBAT、+3V3、+5V 等；
75. 区分同名电源在不同隔离域；
76. 识别 Net Alias；
77. 保留 Raw Label 和 Canonical Name；
78. 生成 Pin-to-Net 表；
79. 生成 Net-to-Pin 表；
80. 生成 RefDes-to-Net 表；
81. 生成端点级证据；
82. 生成连接置信度；
83. 生成字段置信度；
84. 生成 Link 置信度；
85. 生成未决连接；
86. 生成疑似漏线；
87. 生成疑似多连线；
88. 生成 Net Split Candidate；
89. 生成 Net Merge Candidate；
90. 生成 Cross-page Candidate；
91. 生成 Bus Member Candidate；
92. 生成 Pin Identity Candidate；
93. 识别 Duplicate RefDes；
94. 识别 Missing RefDes；
95. 识别 Duplicate Pin Number；
96. 识别 Pin Count 不匹配；
97. 识别孤立 Symbol；
98. 识别悬空 Pin；
99. 识别无端点 Wire；
100. 识别 Label 无 Anchor；
101. 识别 Junction 无连接；
102. 识别 Net 仅由文字形成；
103. 识别 No-connect 与 Wire 冲突；
104. 识别 Bus 和普通 Wire 冲突；
105. 识别跨页循环和冲突；
106. 生成 Review Queue；
107. 支持确认或拒绝 Connection Candidate；
108. 支持拆分 Net；
109. 支持合并 Net；
110. 支持补连 Pin；
111. 支持断开 Pin；
112. 支持移动 Label Anchor；
113. 支持确认 Junction；
114. 支持拒绝 Junction；
115. 支持确认跨页连接；
116. 支持解除跨页连接；
117. 支持映射 Bus Member；
118. 支持确认 Power Domain；
119. 支持修正 Pin Number；
120. 支持审核锁定；
121. 支持 Patch Replay；
122. 支持审核历史；
123. 支持机器重跑后重新应用 Patch；
124. 支持 Netlist 发布 Gate；
125. 支持 `observation_only`；
126. 支持 `candidate_netlist`；
127. 支持 `reviewed_netlist`；
128. 支持 `netlist_ready`；
129. 支持 Agent 16 Canonical IR Export；
130. 支持 EDIF-like 或简单 JSON Netlist；
131. 支持 SPICE-like Connectivity View；
132. 支持 KiCad Netlist Candidate；
133. 支持 CSV Pin-to-Net；
134. 支持 Viewer Highlight；
135. 支持点击 Net 高亮跨页对象；
136. 支持点击 Pin 查看证据；
137. 支持点击冲突查看算法路径；
138. 支持对照原生 Agent 16 IR；
139. 支持 Golden Netlist Benchmark；
140. 支持 Net Partition 对比；
141. 支持连接精度和召回率；
142. 支持 Exact Netlist Match；
143. 支持跨页 Link Accuracy；
144. 支持 Bus Membership Accuracy；
145. 支持人工审核效率指标；
146. 支持任务批量处理；
147. 支持增量重建；
148. 支持模型和规则版本化；
149. 支持 Graph Cache；
150. 支持 As-of Netlist；
151. 支持事件驱动；
152. 支持多租户和项目权限；
153. 支持对象存储；
154. 支持审计；
155. 不因 Net 名相同就自动合并全部网络；
156. 不因 Pin 靠近 Wire 就自动连接；
157. 不因 Pin Number 缺失就按数据库脚位顺序硬套；
158. 不因器件外形相似就强制套用 Pin Count；
159. 不因总线成员数量相同就按位置映射；
160. 不因网表完整率目标而填充未知连接。

---

# 3. 核心架构

```text
Recognition IR Intake
→ Schema & Evidence Validation
→ Observation Normalization
→ Object Deduplication
→ Pin Identity Resolution
→ Page Graph Construction
→ Page Net Partition
→ Label/Port Resolution
→ Cross-page Graph
→ Bus Expansion
→ Power Net Resolution
→ Connectivity Conflict Detection
→ Confidence Calculation
→ Review Queue
→ Review Patch Application
→ Netlist Release Gate
→ Canonical Export
```

---

# 4. 数据分层

## 4.1 Observation Layer

来自 Agent 17：

```text
symbol observation
pin observation
wire observation
junction observation
crossing observation
label observation
port observation
bus observation
OCR text observation
```

## 4.2 Reconstruction Layer

Agent 18生成：

```text
normalized pin
normalized wire
graph node
graph edge
page net
cross-page link
project net
bus membership
connection candidate
conflict
```

## 4.3 Review Layer

人工确认：

```text
review patch
review decision
reviewed relationship
lock
waiver
```

## 4.4 Published Layer

输出：

```text
reviewed netlist
pin-to-net
canonical part/net IR
release manifest
```

这四层不可混在同一对象上直接覆盖。

---

# 5. Netlist Reconstruction IR

```json
{
  "netlist_reconstruction_ir_version": "1.0.0",
  "recognition_job_id": "uuid",
  "source_document_id": "uuid",
  "pages": [],
  "parts": [],
  "pins": [],
  "graph_nodes": [],
  "graph_edges": [],
  "page_nets": [],
  "cross_page_links": [],
  "project_nets": [],
  "buses": [],
  "bus_memberships": [],
  "connection_candidates": [],
  "conflicts": [],
  "review_items": [],
  "diagnostics": [],
  "release_level": "candidate_netlist"
}
```

---

# 6. 标准化对象

## 6.1 Normalized Part

```text
part id
symbol observation id
refdes candidates
selected refdes
value candidates
MPN candidates
page
body geometry
orientation
pin ids
review status
```

## 6.2 Normalized Pin

```text
pin id
part id
endpoint coordinate
body attachment coordinate
pin number candidates
selected pin number
pin name candidates
selected pin name
electrical type candidate
visibility
source observation ids
identity confidence
```

## 6.3 Normalized Wire

```text
wire id
polyline
source observation ids
source type
stroke
endpoint nodes
occlusion
geometry confidence
```

---

# 7. Observation 去重

Agent 17可能同时输出：

```text
PDF Vector Wire
Raster Wire
Hough Segment
Skeleton Segment
```

对同一对象去重时使用：

```text
几何重叠
Hausdorff distance
方向
端点
线宽
来源优先级
页面变换
```

输出关系：

```text
same_observation
supporting_observation
conflicting_observation
independent_observation
```

矢量和栅格对象不能简单互相覆盖。

---

# 8. 来源优先级

默认：

```text
人工确认
原生 PDF 矢量/文字
高质量局部复核
Agent 17 规则解析
批准的视觉模型
低质量候选算法
```

优先级只用于候选选择，不用于删除低优先级证据。

---

# 9. Graph Node

类型：

```text
pin_endpoint
wire_endpoint
wire_bend
junction
crossing
label_anchor
port_anchor
offpage_anchor
power_anchor
bus_entry
no_connect
manual_anchor
```

---

# 10. Graph Edge

类型：

```text
wire_segment
pin_attachment
junction_merge
label_attachment
port_attachment
gap_bridge_candidate
cross_page_equivalence
power_equivalence
bus_membership
manual_connection
manual_disconnection
```

每条 Edge 保存：

```text
source
evidence
resolution method
confidence
review status
rule version
```

---

# 11. 坐标归一化

所有对象转换为统一 Page Coordinate：

```text
page-local mm or normalized point
x right
y down
```

保存：

```text
source coordinate
PDF coordinate
pixel coordinate
transform matrix
canonical coordinate
transform version
```

---

# 12. Pin Identity Resolution

输入：

```text
Pin Observation
附近 Pin Number Text
附近 Pin Name Text
器件方向
器件 Symbol Class
已知 Pin Pattern
可选器件库 Candidate
```

输出：

```text
selected pin number
selected pin name
candidate list
identity confidence
resolution status
```

---

# 13. Pin Identity 状态

```text
explicit_text
geometry_verified
library_supported
human_reviewed
ambiguous
missing
conflicting
unknown
```

---

# 14. 器件库辅助边界

器件库可以提供：

```text
预期 Pin Count
Pin Number Set
Pin Name 候选
常见电源 Pin
常见符号单元
```

但只有在器件身份足够可靠时用于验证。

禁止：

```text
因为 U1 看起来像 8 Pin IC
就直接套用数据库中某颗 8 Pin 芯片的全部 Pin
```

---

# 15. Pin Number 缺失

缺失时状态：

```text
unidentified_pin
```

可以使用内部临时 ID：

```text
U1@left-03
```

但不能伪造为 Pin 3。

---

# 16. 多单元器件

如果页面中出现：

```text
U1A
U1B
U1C
```

重建层必须区分：

```text
Logical Part U1
Symbol Unit U1A/U1B/U1C
Pin Scope
Page
```

没有充分证据时不自动合并同名但不同器件的 Unit。

---

# 17. Stacked Pin

可能情况：

```text
多个电源 Pin 画在同一个位置
多个逻辑 Pin 共用图形端点
```

状态：

```text
stacked_pin_candidate
```

需要源符号知识或人工确认。

---

# 18. Hidden Power Pin

图片中不可见的 Hidden Pin 无法仅凭页面恢复。

处理：

```text
not_observed
library_candidate
review_required
excluded_from_observed_netlist
```

不能直接写入发布网表，除非器件身份和符号库映射经过审核。

---

# 19. Pin-to-Wire Attachment

自动连接条件：

```text
Pin Endpoint 与 Wire Endpoint 精确或在受控容差内
方向和几何一致
没有符号主体遮挡冲突
没有 No-connect Marker
来源证据支持
```

近距离但不接触：

```text
attachment_candidate
```

---

# 20. 容差策略

容差由：

```text
页面 DPI
PDF 矢量精度
扫描质量
线宽
器件尺寸
Processing Profile
```

决定。

每个自动 Attachment 保存实际距离和阈值。

---

# 21. Wire Graph 构建

步骤：

```text
标准化 Polyline
→ 分割交点和端点
→ 去除重复段
→ 建立 Endpoint Node
→ 应用 Junction 语义
→ 应用 Crossing 语义
→ 绑定 Pin
→ 绑定 Label/Port
→ Connected Components
```

---

# 22. Junction 语义

## 自动连接

```text
显式填充 Dot
T-junction Endpoint
多个 Wire Endpoint 在同一点终止
人工确认
```

## 自动不连接

```text
Bridge Jump
Crossing without Dot in supported drawing convention
人工断开
```

## 必须审核

```text
低分辨率交叉
Dot 可能为扫描污点
矢量路径和栅格证据冲突
线段被文字遮挡
```

---

# 23. Crossing Classification

```text
connected
not_connected
ambiguous
manual_connected
manual_disconnected
```

任何 `ambiguous` Crossing 都不能进入 `netlist_ready`。

---

# 24. Gap Bridge Candidate

生成条件：

```text
间隙短
两侧共线
线宽一致
没有中间符号或边框
连接可降低孤立短段
```

输出：

```text
candidate only
```

默认需要审核。

---

# 25. Page Net

Connected Component 形成：

```text
page_net_id
nodes
edges
pins
labels
ports
junctions
unresolved candidates
```

---

# 26. Page Net Stable Key

推荐：

```text
page id
+ sorted endpoint source ids
+ graph topology hash
```

人工修改后生成新 Revision，不覆盖旧 Page Net。

---

# 27. Label Resolution

输入：

```text
text role
anchor geometry
wire proximity
label symbol shape
scope
page
```

状态：

```text
attached
candidate
unattached
conflicting
annotation
```

---

# 28. Local Label

仅在明确的页面或 Sheet Scope 内合并。

同名 Local Label：

```text
same page and same source convention
```

也需要规则支持，不默认跨整个项目合并。

---

# 29. Global Label

可跨页面形成 Equivalence，但必须满足：

```text
Label Type = global
Normalized Name 相同
Project Scope 相同
没有 Domain Conflict
```

---

# 30. Power Label

Power Net 解析包括：

```text
Power Symbol
Power Label
Global Power Marker
明确的 Supply Port
```

不能仅因文字看起来像 `VDD` 就自动全局合并。

---

# 31. Power Domain

保存：

```text
canonical name
raw labels
domain qualifier
page/sheet scope
isolation evidence
power symbol type
```

例如：

```text
GND
AGND
DGND
PGND
CHASSIS
```

默认不同，不可自动合并。

---

# 32. Net Alias

同一 Net 可能有多个 Label：

```text
raw labels
display label
canonical name
aliases
```

Canonical Name 选择规则版本化。

---

# 33. Off-page Connector

对象：

```text
label
source page
target page candidate
grid reference
direction
shape
page net
```

优先显式目标引用。

---

# 34. Cross-page Link

```json
{
  "link_id": "uuid",
  "source_page_net_id": "uuid",
  "target_page_net_id": "uuid",
  "link_type": "offpage",
  "normalized_name": "USB_D+",
  "resolution_method": "explicit_page_reference",
  "confidence": 1.0,
  "review_status": "verified"
}
```

---

# 35. Cross-page Link 状态

```text
explicit
verified
probable
ambiguous
missing_target
duplicate_target
conflicting
rejected
```

只有：

```text
explicit
verified
human_reviewed
```

进入最终 Project Net。

---

# 36. Project Net

由 Page Net 和已批准的 Equivalence 合并：

```text
project_net_id
page_net_ids
pins
labels
ports
aliases
bus membership
power domain
confidence
review status
```

---

# 37. Project Net 合并原则

不能仅使用：

```text
normalized label string
```

还必须考虑：

```text
label type
scope
page hierarchy
explicit reference
power domain
bus context
review state
```

---

# 38. Bus IR

```text
bus id
trunk page net or geometry
raw label
parsed syntax
index range
direction
member names
entries
scope
review status
```

---

# 39. Bus Syntax

支持 Registry：

```text
D[0..7]
D[7..0]
D0-D7
D0..D7
DATA[7:0]
A<0:15>
```

解析结果：

```text
base name
start index
end index
ordering
member names
```

---

# 40. Bus Member

必须至少有一种明确证据：

```text
Member Label
显式 Bus Entry Annotation
人工映射
源工具导出的 Member Name
```

没有明确证据：

```text
unresolved_bus_entry
```

---

# 41. Bus Entry 几何

几何用于确认：

```text
Entry 与 Bus Trunk 接触
Entry 与 Member Wire 接触
```

不用于决定该 Entry 是 D0 还是 D1。

---

# 42. Differential Pair Candidate

保存：

```text
positive net candidate
negative net candidate
naming evidence
parallel routing note
review status
```

这是候选关系，不自动进入 Constraint IR。

---

# 43. No Connect

类型：

```text
explicit_marker
textual_candidate
library_candidate
manual
```

只有显式 Marker 或人工确认成为：

```text
intentional_no_connect
```

Pin Name `NC` 仅表示器件内部 Not Connected 候选。

---

# 44. Connectivity Candidate

类型：

```text
pin_wire_attachment
wire_gap_bridge
junction_connect
crossing_disconnect
label_attachment
page_net_merge
page_net_split
cross_page_link
bus_member
power_equivalence
pin_identity
```

---

# 45. Candidate Schema

```json
{
  "candidate_id": "uuid",
  "candidate_type": "wire_gap_bridge",
  "affected_entities": ["wire-a", "wire-b"],
  "proposed_change": {},
  "evidence": [],
  "confidence_dimensions": {
    "geometry": 0.94,
    "source": 0.75,
    "topology": 0.81
  },
  "risk": "high",
  "auto_apply_allowed": false,
  "review_status": "pending"
}
```

---

# 46. Confidence 维度

```text
source_confidence
geometry_confidence
text_confidence
association_confidence
pin_identity_confidence
junction_confidence
page_connectivity_confidence
cross_page_confidence
bus_confidence
review_confidence
```

不只输出单一总分。

---

# 47. Net Confidence

建议取：

```text
minimum critical edge confidence
+
coverage metrics
+
review status
```

不能简单平均，因为一个低置信度的关键 Edge 可能改变整个 Net。

---

# 48. Net Confidence 状态

```text
verified
high
medium
low
ambiguous
blocked
unknown
```

---

# 49. Conflict Taxonomy

```text
duplicate_refdes
missing_refdes
duplicate_pin_number
missing_pin_identity
pin_count_mismatch
pin_wire_ambiguous
junction_conflict
crossing_conflict
no_connect_conflict
label_anchor_conflict
local_global_scope_conflict
cross_page_conflict
bus_member_conflict
power_domain_conflict
net_split_suspect
net_merge_suspect
orphan_wire
orphan_symbol
dangling_pin
unresolved_hidden_pin
```

---

# 50. Critical Conflict

```text
ambiguous crossing connecting critical nets
same pin assigned to two project nets
No-connect pin also connected
cross-page duplicate target
bus member assigned to multiple names
power domain accidental merge
```

Critical Conflict 必须阻断发布。

---

# 51. Pin-to-Net 输出

```json
{
  "part_id": "uuid",
  "reference": "U1",
  "pin_id": "uuid",
  "pin_number": "12",
  "pin_name": "USB_DP",
  "project_net_id": "uuid",
  "net_name": "USB_D+",
  "relationship_status": "reviewed",
  "confidence": {
    "pin_identity": 0.99,
    "connectivity": 1.0,
    "cross_page": 1.0
  },
  "evidence_ids": []
}
```

---

# 52. Pin-to-Net 状态

```text
explicit_observed
geometry_resolved
label_resolved
cross_page_resolved
human_reviewed
unresolved
conflicting
intentional_no_connect
not_observed
```

---

# 53. 待确认连接

每个 Pending Item 至少包含：

```text
页面和坐标
涉及对象
候选操作
为什么不确定
如果连接或断开会影响哪些 Net
推荐审核顺序
原图和 Overlay 链接
```

---

# 54. 影响分析

一个 Candidate 应显示：

```text
before net partition
after net partition
affected pins
affected labels
affected pages
possible short/merge risk
```

---

# 55. Review Queue 优先级

```text
Critical Net Merge/Split
Power/Ground Conflict
No-connect Conflict
Cross-page Conflict
Bus Member Conflict
Pin Identity Conflict
Ambiguous Junction
Gap Bridge
Label Association
Cosmetic Naming
```

---

# 56. Review 操作

```text
confirm_connection
reject_connection
split_net
merge_net
attach_pin
detach_pin
attach_label
detach_label
confirm_junction
reject_junction
link_cross_page
unlink_cross_page
map_bus_member
unmap_bus_member
set_pin_number
set_pin_name
confirm_no_connect
set_power_domain
lock_relationship
```

---

# 57. Patch 原则

机器 Reconstruction 不覆盖。

人工 Patch 保存：

```text
operation
target path
before
after
reviewer
reason
evidence
timestamp
version
```

---

# 58. Patch Replay

重跑后：

```text
匹配 Stable Entity
→ 检查前置条件
→ 尝试应用
→ 冲突进入 Review
```

不能无条件将旧 Patch 应用到新对象。

---

# 59. Review Lock

锁定类型：

```text
pin identity
pin-to-net
junction
cross-page link
bus membership
power domain
net name
```

模型升级不得覆盖 Lock。

---

# 60. 发布等级

```text
observation_only
page_graph_ready
candidate_netlist
reviewed_netlist
netlist_ready
canonical_ir_ready
```

---

# 61. Netlist Ready Gate

要求：

```text
所有发布 Part 有唯一 Reference 或明确匿名状态
所有发布 Pin 有唯一 Part 归属
关键 Pin 有 Pin Number 或明确 Unknown
每个 Pin 最多属于一个 Project Net
Critical Crossing 全部处理
Critical Junction 全部处理
No-connect 冲突为零
Cross-page Ambiguous 为零
Bus Member Ambiguous 为零
Power Domain Conflict 为零
Duplicate RefDes 为零
Critical Net Split/Merge Conflict 为零
```

允许保留：

```text
非关键悬空 Pin
Unknown Pin Name
未命名 Net
```

但必须显式列出。

---

# 62. 发布 Manifest

```text
source recognition job
reconstruction job
recognition IR version
reconstruction IR version
rule versions
model versions
review patch version
release level
unresolved summary
hash
approved by
approved at
```

---

# 63. Net Naming

优先级示例：

```text
人工确认名称
显式 Global/Power/Off-page Label
唯一 Local Label
器件 Pin 功能派生建议
自动生成名称
```

自动生成：

```text
N$PAGE2_0042
```

必须标记 `generated_name=true`。

---

# 64. Net Alias

同一 Net 可保存：

```text
USB_D+
USB_DP
D+
```

不能因别名不同拆成多个 Net，也不能因字符串近似自动合并。

---

# 65. ERC 前置检查

Agent 18只做结构级检查：

```text
multiple driver candidate
power-to-ground accidental merge
input-only island
unconnected required pin candidate
duplicate power domain
```

完整电气 ERC 属于后续 Agent。

---

# 66. 输出格式

## Canonical JSON

完整证据和状态。

## Pin-to-Net CSV

```text
RefDes
Pin Number
Pin Name
Net Name
Net ID
Status
Confidence
Review Status
```

## Net-to-Pin CSV

```text
Net Name
Net ID
RefDes
Pin Number
Pin Name
Page
```

## Simple Netlist JSON

用于下游编程。

## Agent 16 IR Bundle

包含：

```text
Part IR
Pin IR
Net IR
Source Map
Recognition Provenance
```

---

# 67. KiCad Netlist Candidate

可输出中间数据，但不能声称是完整 KiCad 工程。

必须包含：

```text
generated_from_recognition=true
review_level
unresolved_count
source_document_hash
```

---

# 68. SPICE-like View

只有：

```text
器件 Pin 数和 Pin Mapping 足够明确
```

时输出。

不自动假设器件模型。

---

# 69. 状态机

```text
RECEIVED
→ VALIDATING_RECOGNITION_IR
→ NORMALIZING_OBSERVATIONS
→ DEDUPLICATING_OBJECTS
→ RESOLVING_PARTS_AND_PINS
→ BUILDING_PAGE_GRAPHS
→ PARTITIONING_PAGE_NETS
→ RESOLVING_LABELS_AND_PORTS
→ RESOLVING_CROSS_PAGE_LINKS
→ RESOLVING_BUSES
→ RESOLVING_POWER_NETS
→ DETECTING_CONFLICTS
→ CALCULATING_CONFIDENCE
→ GENERATING_REVIEW_QUEUE
→ APPLYING_REVIEW_PATCHES
→ RUNNING_RELEASE_GATES
→ EXPORTING_NETLIST
→ STORING_RESULTS
```

分支：

```text
COMPLETED
COMPLETED_WITH_WARNINGS
REVIEW_REQUIRED
BLOCKED_BY_CRITICAL_CONFLICT
PARTIAL
RECOGNITION_IR_INVALID
PIN_IDENTITY_INCOMPLETE
PAGE_GRAPH_INCOMPLETE
CROSS_PAGE_INCOMPLETE
BUS_INCOMPLETE
POWER_DOMAIN_CONFLICT
PATCH_CONFLICT
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 70. 错误码

```text
RECOGNITION_JOB_NOT_FOUND
RECOGNITION_IR_NOT_FOUND
RECOGNITION_IR_VERSION_UNSUPPORTED
RECOGNITION_IR_SCHEMA_INVALID
PAGE_TRANSFORM_MISSING
SOURCE_EVIDENCE_MISSING
SYMBOL_OBSERVATION_MISSING
PIN_OBSERVATION_MISSING
WIRE_OBSERVATION_MISSING
OBJECT_DEDUPLICATION_CONFLICT
PART_REFERENCE_DUPLICATE
PART_REFERENCE_MISSING
PIN_IDENTITY_AMBIGUOUS
PIN_NUMBER_DUPLICATE
PIN_COUNT_MISMATCH
PIN_WIRE_ATTACHMENT_AMBIGUOUS
JUNCTION_AMBIGUOUS
CROSSING_AMBIGUOUS
NO_CONNECT_CONFLICT
LABEL_SCOPE_AMBIGUOUS
LABEL_ANCHOR_MISSING
PAGE_NET_CONFLICT
CROSS_PAGE_TARGET_MISSING
CROSS_PAGE_DUPLICATE_TARGET
CROSS_PAGE_CONFLICT
BUS_SYNTAX_UNKNOWN
BUS_MEMBER_UNRESOLVED
BUS_MEMBER_CONFLICT
POWER_DOMAIN_CONFLICT
NET_SPLIT_SUSPECT
NET_MERGE_SUSPECT
PIN_ASSIGNED_MULTIPLE_NETS
PATCH_PRECONDITION_FAILED
PATCH_TARGET_NOT_FOUND
RELEASE_GATE_BLOCKED
AGENT16_IR_SCHEMA_INVALID
OUTPUT_STORAGE_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 71. 数据库设计

## 71.1 `netlist_reconstruction_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NULL
source_asset_id UUID NOT NULL
recognition_job_id UUID NOT NULL
recognition_ir_version VARCHAR NOT NULL
reconstruction_profile_version VARCHAR NOT NULL
rule_versions JSONB NOT NULL
requested_outputs JSONB NOT NULL
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

## 71.2 `netlist_reconstruction_input_snapshots`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
recognition_ir_uri TEXT NOT NULL
recognition_ir_hash CHAR(64) NOT NULL
agent16_schema_versions JSONB NOT NULL
part_library_snapshot_id UUID NULL
symbol_library_snapshot_id UUID NULL
rule_bundle_versions JSONB NOT NULL
model_versions JSONB NOT NULL
source_manifest_uri TEXT NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, snapshot_hash)
```

## 71.3 `netlist_normalized_parts`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
canonical_part_candidate_id UUID NOT NULL
source_symbol_observation_id UUID NOT NULL
page_id UUID NOT NULL
logical_part_key VARCHAR NULL
selected_reference VARCHAR NULL
reference_candidates JSONB NOT NULL
selected_value VARCHAR NULL
value_candidates JSONB NOT NULL
selected_mpn_candidate VARCHAR NULL
mpn_candidates JSONB NOT NULL
body_geometry JSONB NOT NULL
orientation_deg NUMERIC NULL
mirrored BOOLEAN NOT NULL
unit_designator VARCHAR NULL
logical_parent_part_id UUID NULL
association_confidence NUMERIC(5,4) NOT NULL
identity_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
source_evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 71.4 `netlist_normalized_pins`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
part_id UUID NOT NULL
source_pin_observation_id UUID NOT NULL
page_id UUID NOT NULL
temporary_pin_key VARCHAR NOT NULL
selected_pin_number VARCHAR NULL
pin_number_candidates JSONB NOT NULL
selected_pin_name VARCHAR NULL
pin_name_candidates JSONB NOT NULL
electrical_type_candidate VARCHAR NULL
endpoint_position JSONB NOT NULL
body_attachment_position JSONB NULL
orientation_deg NUMERIC NULL
visibility_status VARCHAR NOT NULL
stacked_pin_status VARCHAR NOT NULL
identity_status VARCHAR NOT NULL
identity_confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
source_evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, temporary_pin_key)
```

## 71.5 `netlist_normalized_wires`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NOT NULL
canonical_wire_id UUID NOT NULL
polyline JSONB NOT NULL
stroke_width NUMERIC NULL
source_observation_ids JSONB NOT NULL
source_types JSONB NOT NULL
deduplication_status VARCHAR NOT NULL
geometry_confidence NUMERIC(5,4) NOT NULL
occlusion_segments JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.6 `netlist_observation_equivalence_groups`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
entity_type VARCHAR NOT NULL
normalized_entity_id UUID NOT NULL
source_observation_ids JSONB NOT NULL
relationship_types JSONB NOT NULL
selection_policy_version VARCHAR NOT NULL
conflict_status VARCHAR NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 71.7 `netlist_graph_nodes`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NOT NULL
node_type VARCHAR NOT NULL
position JSONB NULL
source_entity_type VARCHAR NOT NULL
source_entity_id UUID NOT NULL
node_properties JSONB NOT NULL
source_confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.8 `netlist_graph_edges`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
source_entity_ids JSONB NOT NULL
resolution_method VARCHAR NOT NULL
rule_id VARCHAR NULL
rule_version VARCHAR NULL
distance_metrics JSONB NULL
confidence_dimensions JSONB NOT NULL
edge_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.9 `netlist_page_graph_revisions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NOT NULL
revision_number INT NOT NULL
graph_manifest_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
node_count BIGINT NOT NULL
edge_count BIGINT NOT NULL
candidate_edge_count BIGINT NOT NULL
critical_conflict_count INT NOT NULL
source_type VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, page_id, revision_number)
```

## 71.10 `netlist_page_nets`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NOT NULL
page_graph_revision_id UUID NOT NULL
page_net_key VARCHAR NOT NULL
revision_number INT NOT NULL
generated_name VARCHAR NULL
selected_display_name VARCHAR NULL
raw_label_ids JSONB NOT NULL
graph_node_ids JSONB NOT NULL
graph_edge_ids JSONB NOT NULL
pin_ids JSONB NOT NULL
port_ids JSONB NOT NULL
junction_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
confidence_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
release_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, page_id, page_net_key, revision_number)
```

## 71.11 `netlist_label_resolutions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
source_label_observation_id UUID NOT NULL
page_id UUID NOT NULL
label_type VARCHAR NOT NULL
raw_text VARCHAR NOT NULL
normalized_text VARCHAR NULL
page_net_id UUID NULL
anchor_node_id UUID NULL
scope JSONB NOT NULL
resolution_method VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.12 `netlist_port_resolutions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
source_port_observation_id UUID NOT NULL
page_id UUID NOT NULL
port_type VARCHAR NOT NULL
raw_label VARCHAR NULL
normalized_label VARCHAR NULL
page_net_id UUID NULL
direction_candidate VARCHAR NULL
target_reference JSONB NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.13 `netlist_cross_page_link_candidates`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
source_page_net_id UUID NOT NULL
target_page_net_id UUID NULL
source_port_or_label_id UUID NOT NULL
target_port_or_label_id UUID NULL
link_type VARCHAR NOT NULL
raw_name VARCHAR NULL
normalized_name VARCHAR NULL
explicit_target_reference JSONB NULL
resolution_method VARCHAR NOT NULL
evidence JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
link_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.14 `netlist_project_net_revisions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
project_net_key VARCHAR NOT NULL
revision_number INT NOT NULL
canonical_name VARCHAR NULL
generated_name BOOLEAN NOT NULL
page_net_ids JSONB NOT NULL
cross_page_link_ids JSONB NOT NULL
pin_ids JSONB NOT NULL
raw_labels JSONB NOT NULL
aliases JSONB NOT NULL
power_domain_id UUID NULL
bus_memberships JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
confidence_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
release_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, project_net_key, revision_number)
```

## 71.15 `netlist_power_domains`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
domain_key VARCHAR NOT NULL
canonical_name VARCHAR NULL
raw_labels JSONB NOT NULL
domain_type VARCHAR NOT NULL
scope JSONB NOT NULL
isolation_evidence JSONB NOT NULL
equivalence_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, domain_key)
```

## 71.16 `netlist_bus_definitions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
source_bus_observation_id UUID NOT NULL
page_id UUID NOT NULL
raw_label VARCHAR NULL
base_name VARCHAR NULL
start_index INT NULL
end_index INT NULL
ordering VARCHAR NULL
syntax_profile VARCHAR NULL
member_names JSONB NOT NULL
scope JSONB NOT NULL
parse_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.17 `netlist_bus_memberships`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
bus_definition_id UUID NOT NULL
source_bus_entry_id UUID NOT NULL
member_name VARCHAR NULL
project_net_id UUID NULL
evidence JSONB NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
membership_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.18 `netlist_pin_to_net_relationships`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
part_id UUID NOT NULL
pin_id UUID NOT NULL
project_net_id UUID NULL
relationship_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
release_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, pin_id)
```

对于已确认 Stacked Pin，可使用独立关系扩展表，不能破坏“普通 Pin 最多属于一个 Net”的约束。

## 71.19 `netlist_no_connect_resolutions`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
pin_id UUID NOT NULL
source_no_connect_observation_id UUID NULL
no_connect_type VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
conflict_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, pin_id)
```

## 71.20 `netlist_connection_candidates`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NULL
candidate_type VARCHAR NOT NULL
affected_entity_ids JSONB NOT NULL
proposed_operation JSONB NOT NULL
before_partition_uri TEXT NULL
after_partition_uri TEXT NULL
confidence_dimensions JSONB NOT NULL
risk_level VARCHAR NOT NULL
reason_codes JSONB NOT NULL
auto_apply_allowed BOOLEAN NOT NULL
candidate_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 71.21 `netlist_conflicts`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NULL
conflict_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
affected_entity_ids JSONB NOT NULL
affected_page_net_ids JSONB NOT NULL
affected_project_net_ids JSONB NOT NULL
description TEXT NOT NULL
evidence JSONB NOT NULL
blocking BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 71.22 `netlist_review_items`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
page_id UUID NULL
review_type VARCHAR NOT NULL
priority INT NOT NULL
severity VARCHAR NOT NULL
affected_entities JSONB NOT NULL
candidate_ids JSONB NOT NULL
conflict_ids JSONB NOT NULL
impact_summary_uri TEXT NOT NULL
evidence_package_uri TEXT NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 71.23 `netlist_review_patches`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
review_item_id UUID NULL
patch_version INT NOT NULL
operation VARCHAR NOT NULL
target_path TEXT NOT NULL
preconditions JSONB NOT NULL
before_value JSONB NULL
after_value JSONB NULL
reason_code VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, patch_version)
```

## 71.24 `netlist_review_locks`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
lock_type VARCHAR NOT NULL
target_entity_type VARCHAR NOT NULL
target_entity_id UUID NOT NULL
locked_value JSONB NOT NULL
scope JSONB NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
released_by UUID NULL
released_at TIMESTAMPTZ NULL
release_reason TEXT NULL
```

## 71.25 `netlist_patch_replay_runs`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
source_patch_job_id UUID NOT NULL
target_graph_revision_id UUID NOT NULL
status VARCHAR NOT NULL
applied_count INT NOT NULL
conflict_count INT NOT NULL
skipped_count INT NOT NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 71.26 `netlist_release_gate_runs`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
gate_profile_version VARCHAR NOT NULL
requested_release_level VARCHAR NOT NULL
status VARCHAR NOT NULL
blocking_issue_count INT NOT NULL
warning_count INT NOT NULL
dimension_results JSONB NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 71.27 `netlist_release_manifests`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
release_number VARCHAR NOT NULL
release_revision INT NOT NULL
release_level VARCHAR NOT NULL
recognition_ir_hash CHAR(64) NOT NULL
reconstruction_ir_hash CHAR(64) NOT NULL
page_graph_hashes JSONB NOT NULL
project_net_hash CHAR(64) NOT NULL
rule_versions JSONB NOT NULL
review_patch_max_version INT NOT NULL
unresolved_summary JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, release_revision)
```

## 71.28 `netlist_export_artifacts`

```text
id UUID PK
release_manifest_id UUID NOT NULL
export_type VARCHAR NOT NULL
schema_or_format_version VARCHAR NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
record_count BIGINT NULL
validation_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.29 `netlist_validation_results`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
validator_id VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
validation_type VARCHAR NOT NULL
status VARCHAR NOT NULL
issue_count INT NOT NULL
metrics JSONB NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 71.30 `netlist_fidelity_reports`

```text
id UUID PK
reconstruction_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
part_coverage NUMERIC NULL
pin_identity_coverage NUMERIC NULL
pin_to_net_coverage NUMERIC NULL
page_net_coverage NUMERIC NULL
cross_page_coverage NUMERIC NULL
bus_membership_coverage NUMERIC NULL
power_domain_coverage NUMERIC NULL
reviewed_fraction NUMERIC NOT NULL
critical_unresolved_count INT NOT NULL
dimension_results JSONB NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reconstruction_job_id, report_version)
```

## 71.31 `netlist_benchmark_runs`

```text
id UUID PK
benchmark_suite_version VARCHAR NOT NULL
reconstruction_profile_version VARCHAR NOT NULL
rule_versions JSONB NOT NULL
dataset_version VARCHAR NOT NULL
status VARCHAR NOT NULL
metrics JSONB NOT NULL
result_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

---

# 72. 对象存储

```text
derived/netlist-reconstruction/
  {tenant_id}/{recognition_job_id}/
    jobs/
      {reconstruction_job_id}/
        input/
          recognition-ir.json.zst
          recognition-manifest.json
          library-snapshot.json
          rule-versions.json
        normalized/
          parts.jsonl.zst
          pins.jsonl.zst
          wires.jsonl.zst
          labels.jsonl.zst
          ports.jsonl.zst
          buses.jsonl.zst
          equivalence-groups.jsonl.zst
        page-graphs/
          {page_id}/
            revision-{n}/
              nodes.jsonl.zst
              edges.jsonl.zst
              candidates.jsonl.zst
              graph-manifest.json
              topology-trace.jsonl.zst
        page-nets/
          page-nets.jsonl.zst
          labels.jsonl.zst
          diagnostics.jsonl.zst
        cross-page/
          link-candidates.jsonl.zst
          accepted-links.jsonl.zst
          conflicts.jsonl.zst
        buses/
          definitions.jsonl.zst
          entries.jsonl.zst
          memberships.jsonl.zst
        power/
          domains.jsonl.zst
          equivalence-candidates.jsonl.zst
        project-nets/
          revisions.jsonl.zst
          pin-to-net.jsonl.zst
          net-to-pin.jsonl.zst
          aliases.jsonl.zst
        conflicts/
          critical.jsonl.zst
          warnings.jsonl.zst
        review/
          queue.jsonl.zst
          evidence-packages/
          patches.jsonl.zst
          locks.jsonl.zst
          replay-results/
        release/
          gate-result.json
          manifest.json
          reviewed-netlist.json.zst
          pin-to-net.csv
          net-to-pin.csv
          agent16-ir/
          simple-netlist.json
          kicad-netlist-candidate.xml
        reports/
          netlist-report.html
          netlist-report.pdf
          fidelity.json
          unresolved-connections.html
        debug/
          normalization-trace.jsonl.zst
          graph-build-trace.jsonl.zst
          confidence-trace.jsonl.zst
          resource-usage.json
```

---

# 73. API 设计

## 73.1 Reconstruction Jobs

```text
POST /api/v1/netlist-reconstruction/jobs
POST /api/v1/netlist-reconstruction/jobs/batch
GET  /api/v1/netlist-reconstruction/jobs/{id}
GET  /api/v1/netlist-reconstruction/jobs/{id}/events
POST /api/v1/netlist-reconstruction/jobs/{id}/cancel
POST /api/v1/netlist-reconstruction/jobs/{id}/retry
POST /api/v1/netlist-reconstruction/jobs/{id}/rerun
```

## 73.2 Normalized Objects

```text
GET /api/v1/netlist-reconstruction/jobs/{id}/parts
GET /api/v1/netlist-reconstruction/jobs/{id}/pins
GET /api/v1/netlist-reconstruction/jobs/{id}/wires
GET /api/v1/netlist-reconstruction/jobs/{id}/labels
GET /api/v1/netlist-reconstruction/jobs/{id}/ports
GET /api/v1/netlist-reconstruction/jobs/{id}/buses
```

## 73.3 Graph

```text
GET  /api/v1/netlist-reconstruction/jobs/{id}/page-graphs
GET  /api/v1/netlist-reconstruction/page-graphs/{id}
GET  /api/v1/netlist-reconstruction/page-graphs/{id}/nodes
GET  /api/v1/netlist-reconstruction/page-graphs/{id}/edges
POST /api/v1/netlist-reconstruction/page-graphs/{id}/rebuild
```

## 73.4 Nets

```text
GET /api/v1/netlist-reconstruction/jobs/{id}/page-nets
GET /api/v1/netlist-reconstruction/jobs/{id}/project-nets
GET /api/v1/netlist-reconstruction/project-nets/{id}
GET /api/v1/netlist-reconstruction/project-nets/{id}/pins
GET /api/v1/netlist-reconstruction/pins/{id}/net
GET /api/v1/netlist-reconstruction/refdes/{reference}/pins
GET /api/v1/netlist-reconstruction/refdes/{reference}/nets
```

## 73.5 Cross-page、Bus 和 Power

```text
GET /api/v1/netlist-reconstruction/jobs/{id}/cross-page-links
GET /api/v1/netlist-reconstruction/jobs/{id}/bus-memberships
GET /api/v1/netlist-reconstruction/jobs/{id}/power-domains
POST /api/v1/netlist-reconstruction/jobs/{id}/resolve-cross-page
POST /api/v1/netlist-reconstruction/jobs/{id}/resolve-buses
POST /api/v1/netlist-reconstruction/jobs/{id}/resolve-power
```

## 73.6 Candidates 和 Conflicts

```text
GET /api/v1/netlist-reconstruction/jobs/{id}/candidates
GET /api/v1/netlist-reconstruction/jobs/{id}/conflicts
GET /api/v1/netlist-reconstruction/candidates/{id}
GET /api/v1/netlist-reconstruction/conflicts/{id}
```

## 73.7 Review

```text
GET  /api/v1/netlist-reconstruction/reviews
GET  /api/v1/netlist-reconstruction/reviews/{id}
POST /api/v1/netlist-reconstruction/reviews/{id}/claim
POST /api/v1/netlist-reconstruction/reviews/{id}/patch
POST /api/v1/netlist-reconstruction/reviews/{id}/resolve
POST /api/v1/netlist-reconstruction/jobs/{id}/replay-patches
POST /api/v1/netlist-reconstruction/jobs/{id}/validate-patches
```

## 73.8 Release

```text
POST /api/v1/netlist-reconstruction/jobs/{id}/run-release-gate
GET  /api/v1/netlist-reconstruction/jobs/{id}/release-gate
POST /api/v1/netlist-reconstruction/jobs/{id}/release
GET  /api/v1/netlist-reconstruction/releases/{id}
GET  /api/v1/netlist-reconstruction/releases/{id}/manifest
```

## 73.9 Export

```text
GET /api/v1/netlist-reconstruction/releases/{id}/pin-to-net
GET /api/v1/netlist-reconstruction/releases/{id}/net-to-pin
GET /api/v1/netlist-reconstruction/releases/{id}/simple-netlist
GET /api/v1/netlist-reconstruction/releases/{id}/agent16-ir
GET /api/v1/netlist-reconstruction/releases/{id}/kicad-netlist-candidate
POST /api/v1/netlist-reconstruction/releases/{id}/export-package
```

## 73.10 Validation 和 Fidelity

```text
POST /api/v1/netlist-reconstruction/jobs/{id}/validate
GET  /api/v1/netlist-reconstruction/jobs/{id}/diagnostics
GET  /api/v1/netlist-reconstruction/jobs/{id}/fidelity
GET  /api/v1/netlist-reconstruction/jobs/{id}/coverage
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 74. 输入事件

```text
schematic.observations.ready
schematic.connectivity-candidate.ready
schematic.review.completed
schematic.agent16-ir.ready
agent16.ir-schema.released
component.pin-definition.updated
symbol.library.snapshot.updated
netlist.reconstruction.requested
netlist.rule-profile.updated
```

---

# 75. 输出事件

```text
netlist.reconstruction.started
netlist.page-graph.ready
netlist.page-net.ready
netlist.cross-page.review-required
netlist.bus.review-required
netlist.conflict.detected
netlist.review.required
netlist.review.completed
netlist.release-gate.blocked
netlist.reviewed.ready
netlist.pin-to-net.ready
netlist.agent16-ir.ready
netlist.reconstruction.failed
```

## `netlist.pin-to-net.ready`

```json
{
  "event_type": "netlist.pin-to-net.ready",
  "event_version": "1.0",
  "reconstruction_job_id": "uuid",
  "release_manifest_id": "uuid",
  "release_level": "netlist_ready",
  "summary": {
    "parts": 426,
    "pins": 2418,
    "project_nets": 173,
    "pin_to_net_resolved": 2376,
    "intentional_no_connect": 22,
    "unresolved_pins": 20,
    "critical_conflicts": 0
  },
  "manifest_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 76. Reconstruction Profiles

```text
profiles/
├── vector-pdf-strict.yaml
├── vector-pdf-balanced.yaml
├── clean-scan.yaml
├── degraded-scan.yaml
├── manual-first.yaml
├── benchmark-golden.yaml
└── enterprise/
```

每个 Profile 定义：

```text
coordinate tolerance
wire dedup tolerance
pin attachment tolerance
junction policy
gap bridge maximum
label anchor policy
cross-page threshold
bus auto-resolution policy
power-domain policy
review thresholds
release gates
```

---

# 77. Rule Bundles

```text
policies/
├── netlist-reconstruction-1.0.0.yaml
├── observation-deduplication.yaml
├── pin-identity.yaml
├── pin-wire-attachment.yaml
├── junction-crossing.yaml
├── page-net-partition.yaml
├── label-scope.yaml
├── cross-page.yaml
├── bus-syntax.yaml
├── power-domains.yaml
├── net-naming.yaml
├── conflict-detection.yaml
├── review-priority.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 78. Rule Engine

必须支持：

- JSON/YAML Schema；
- 受限表达式；
- Rule ID 和 Version；
- Scope；
- Priority；
- Effectivity；
- Conflict Detection；
- Dry Run；
- Explanation Trace；
- Rollback；
- 禁止任意代码执行。

---

# 79. Graph 算法

V1 推荐：

```text
spatial index
segment intersection
union-find / disjoint set
adjacency graph
connected components
topology hash
graph diff
```

大型页面不要使用低效的全对象两两比较。

---

# 80. 空间索引

使用：

```text
R-tree / STRtree
grid bucket
```

查询：

```text
Pin 附近 Wire
Wire 交点
Label 附近 Anchor
Junction 附近 Segment
```

---

# 81. Segment Intersection

必须处理：

```text
endpoint touch
interior crossing
collinear overlap
near miss
arc/curve approximation
```

保留数值误差和分类依据。

---

# 82. Union-Find 边界

Union-Find 只合并已经批准的连接 Edge。

候选 Edge 和 Ambiguous Crossing 不进入自动 Union。

---

# 83. Graph Revision

以下操作生成新 Revision：

```text
确认 Junction
拒绝 Junction
补连
断开
合并 Net
拆分 Net
跨页连接
Bus Member 映射
Power Domain 变更
```

旧 Revision 不覆盖。

---

# 84. Deterministic Reconstruction

相同：

```text
Recognition IR Hash
Rule Versions
Profile
Library Snapshot
Patch Set
```

必须得到相同：

```text
Graph Hash
Page Net Partition
Project Net Hash
Pin-to-Net Hash
```

---

# 85. Confidence 计算策略

推荐使用规则透明计算：

```text
edge confidence
endpoint coverage
label evidence
cross-page evidence
review status
critical minimum
```

V1 不使用不可解释的端到端“网表可信度模型”。

---

# 86. 自动应用策略

可自动应用的低风险关系：

```text
原生矢量 Wire 连续段
精确 Pin Endpoint 与 Wire Endpoint
显式 Junction Dot
显式 Off-page 页码引用
人工 Lock
```

默认只生成候选：

```text
短断线补全
低质量 Pin 接触
无 Dot 交叉
名称相似跨页连接
Bus Entry 无 Member Label
Hidden Pin
Power Domain Alias
```

---

# 87. 人工审核工作台

界面建议：

```text
左侧：页面、Net 和冲突导航
中间：原图 + Symbol/Pin/Wire/Net Overlay
右侧：候选操作、证据和置信度
底部：Before/After Net Partition、Pin-to-Net 和历史
```

---

# 88. Review Overlay

```text
Parts
Pins
Wires
Junctions
Crossings
Page Nets
Project Nets
Cross-page Links
Bus
Power Domains
No-connect
Candidates
Conflicts
```

---

# 89. Before/After 预览

拆分或合并前显示：

```text
当前 Net Pin 数
操作后 Net Pin 数
受影响页面
受影响 RefDes/Pin
可能形成的 Power-Ground Short
```

没有预览不能提交高风险 Patch。

---

# 90. 审核快捷动作

```text
点击交叉点：Connect / Disconnect / Unresolved
点击 Pin：Attach / Detach / Set Number
点击 Label：Attach / Change Scope
点击 Off-page：Link Target
点击 Bus Entry：Map Member
点击 Net：Split / Merge / Rename
```

---

# 91. Agent 16 IR Adapter

映射：

```text
Normalized Part → Part IR
Normalized Pin → Pin IR
Reviewed Project Net → Net IR
Pin-to-Net → Net Endpoint
Page → Schematic Document
Source Evidence → Source Map
```

每个对象增加：

```text
source_kind = recognized_document
recognition_job_id
reconstruction_job_id
release_manifest_id
confidence
review_status
```

---

# 92. Agent 16 Export Gate

只有：

```text
release_level >= reviewed_netlist
```

才允许输出 Agent 16 IR Candidate。

只有：

```text
release_level = netlist_ready
```

才允许输出供确定性下游使用的 Pin-to-Net Contract。

---

# 93. Agent 31 Contract

输出：

```text
RefDes
Value
MPN Raw Candidate
DNP/Optional
Page
Source Evidence
Part Confidence
```

Agent 31必须知道这是识别来源而非原生 EDA。

---

# 94. Agent 32 Contract

输出：

```text
raw MPN candidates
manufacturer candidates
package hints
pin count
value
symbol class
source text
```

Agent 32解析器件身份后，可回传 Pin Definition Candidate，但不得自动覆盖现有 Pin-to-Net。

---

# 95. Agent 43 Contract

只消费：

```text
reviewed or netlist_ready
```

用于：

```text
EBOM
RefDes
Connectivity Evidence
Design Review
```

`candidate_netlist` 不能直接进入量产 MBOM。

---

# 96. Agent 44 Contract

制造询价主要使用 Agent 16 原生 EDA 或 Agent 43 发布包。

识别恢复网表只用于：

```text
历史设计恢复
早期可行性分析
人工确认后的预检
```

不得当作自动生产文件。

---

# 97. Agent 45 Contract

可提供：

```text
RefDes
Pin Number
Pin Name
Net
Page
Evidence
```

用于 ICT/FCT 故障定位，但必须带 Release Level。

---

# 98. Fidelity Report

维度：

```text
Part Reference Coverage
Pin Detection Coverage
Pin Identity Coverage
Pin-to-Wire Coverage
Page Net Coverage
Cross-page Coverage
Bus Membership Coverage
Power Domain Coverage
Reviewed Fraction
Critical Conflict Count
```

状态：

```text
complete_for_observed_scope
substantially_complete
partial
review_required
blocked
unknown
```

---

# 99. 不可观测范围

报告必须明确：

```text
hidden pins
unprinted power pins
missing pages
cropped drawing regions
unreadable pin numbers
unresolved custom symbols
off-page target absent
bus member absent
```

“对可见内容完成”不能被描述成“对原工程完整”。

---

# 100. Benchmark

## Part/Pin

```text
RefDes uniqueness
Pin endpoint
Pin identity
Multi-unit grouping
Stacked pin
Hidden pin handling
```

## Page Graph

```text
Wire segment
Endpoint attachment
T-junction
Dot junction
Crossing no-connect
Bridge jump
Gap candidate
```

## Net Partition

```text
Pin pair connectivity precision
Pin pair connectivity recall
Net merge error
Net split error
Exact Page Net Match
```

## Cross-page

```text
Explicit page reference
Global label
Local label isolation
Duplicate target
Missing target
Conflict
```

## Bus

```text
Syntax parse
Entry attachment
Member mapping
Unknown member
Ordering
```

## Review

```text
Patch apply
Patch replay
Patch conflict
Lock
Before/After impact
Release gate
```

## Export

```text
Pin-to-Net
Net-to-Pin
Agent 16 Schema
Deterministic Hash
Audit Replay
```

---

# 101. 核心指标

```text
Pin-to-Net Precision
Pin-to-Net Recall
Pairwise Connectivity Precision
Pairwise Connectivity Recall
Exact Page Net Match Rate
Net Merge Error Rate
Net Split Error Rate
Cross-page Link Precision/Recall
Bus Membership Accuracy
Critical Ambiguity Auto-publish Rate
Patch Replay Success Rate
Reviewer Time per Critical Issue
```

---

# 102. 初始质量目标

```text
Recognition IR Preservation = 100%
Graph Build Determinism = 100%
Explicit Vector Connection Accuracy = 100%
Explicit Junction Application Accuracy = 100%
Crossing without Junction False-connect Rate <= 0.1%
Pin-to-Net Accuracy >= 99% on approved clean vector scope
Page Net Exact Match >= 98% on approved clean vector scope
Cross-page Explicit Link Accuracy = 100%
Bus Member Auto-publish Error Rate = 0%
No-connect Conflict Auto-publish Rate = 0%
Critical Conflict Auto-publish Rate = 0%
Machine Reconstruction Overwrite Rate = 0%
Review Patch Audit Coverage = 100%
Pin Assigned Multiple Nets after Release = 0%
Agent 16 Export Schema Validation = 100%
Tenant/Project Isolation = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经验证的保证。

---

# 103. 测试集

公开仓库只使用开源、合成、脱敏或明确授权数据。

## Object Normalization

1. Vector/Raster Duplicate Wire；
2. Supporting Observations；
3. Conflicting Wire Geometry；
4. Duplicate Symbol Observation；
5. Coordinate Transform；
6. Rotated Page；
7. Cropped Page；
8. Stable ID；
9. Deterministic Normalization；
10. Missing Evidence。

## Pin

11. Two-pin Resistor；
12. Three-pin Transistor；
13. Generic IC；
14. Explicit Pin Number；
15. Missing Pin Number；
16. Duplicate Pin Number；
17. Pin Name；
18. Pin near Wire；
19. Pin touching Wire；
20. Pin with No-connect；
21. Stacked Pin；
22. Hidden Pin Candidate；
23. Multi-unit U1A/U1B；
24. Missing RefDes；
25. Duplicate RefDes。

## Page Graph

26. Straight Wire；
27. Polyline；
28. T-junction；
29. Explicit Dot；
30. Cross without Dot；
31. Bridge Jump；
32. Collinear Overlap；
33. Near Miss；
34. Short Gap；
35. Long Gap；
36. Text Occlusion；
37. Symbol Body Occlusion；
38. Orphan Wire；
39. Orphan Symbol；
40. Junction Conflict；
41. Pin Attachment Candidate；
42. Manual Disconnect；
43. Manual Connect；
44. Graph Revision；
45. Topology Hash。

## Label/Power

46. Local Label；
47. Global Label；
48. Power Symbol；
49. Label no Anchor；
50. Annotation false label；
51. GND；
52. AGND；
53. DGND；
54. Power Domain Conflict；
55. Alias；
56. Generated Net Name；
57. Same Name Different Scope；
58. Multiple Labels One Net；
59. One Label Multiple Candidates；
60. Power-Ground Merge Block。

## Cross-page

61. Explicit Page Reference；
62. Off-page Exact；
63. Global Label；
64. Local Label Not Cross-page；
65. Missing Target；
66. Duplicate Target；
67. Conflicting Direction；
68. Same Label Different Hierarchy；
69. Manual Link；
70. Manual Unlink。

## Bus

71. D[0..7]；
72. D[7..0]；
73. DATA[7:0]；
74. D0-D7；
75. Bus Entry；
76. Member Label；
77. Missing Member；
78. Duplicate Member；
79. Member on Wrong Net；
80. Unknown Syntax。

## Review/Release

81. Candidate Priority；
82. Impact Preview；
83. Confirm Junction；
84. Reject Junction；
85. Split Net；
86. Merge Net；
87. Pin Number Patch；
88. Bus Member Patch；
89. Power Domain Patch；
90. Patch Replay；
91. Patch Preconditions Fail；
92. Review Lock；
93. Critical Conflict Gate；
94. Netlist Ready；
95. Agent 16 Export；
96. Pin-to-Net CSV；
97. Tenant Isolation；
98. 1000-page Project；
99. Cancellation；
100. Audit Replay。

---

# 104. 性能要求

常规项目：

```text
20 pages
500 parts
3,000 pins
5,000 wire segments
200 nets
```

目标：

```text
Normalization P95 < 5 s
Page Graph Build P95 < 3 s/page
Page Net Partition P95 < 1 s/page
Cross-page Resolution P95 < 3 s/project
Interactive Net Query P95 < 300 ms
Review Impact Preview P95 < 500 ms
```

大型项目：

```text
1,000 pages
100,000 parts
500,000 pins
2,000,000 segments
```

要求：

- Page-level Partition；
- 空间索引；
- 分区数据库；
- JSONL/Arrow；
- Graph Cache；
- 增量跨页合并；
- Worker 并行；
- Backpressure；
- 可取消和恢复；
- 不把完整图一次装入单机 NetworkX。

---

# 105. 增量重建

变化来源：

```text
Agent 17 Observation Revision
人工 Patch
Rule/Profile
Pin Library Candidate
Page Added/Removed
Cross-page Label Changed
```

只重建：

```text
受影响 Page Graph
相关 Page Net
相关 Cross-page Component
相关 Project Net
```

---

# 106. Cache Key

```text
recognition IR page hash
normalization policy
graph profile
rule versions
library snapshot
patch set hash
```

---

# 107. 可观测性

```text
netlist_reconstruction_jobs_total{status,profile}
netlist_reconstruction_duration_seconds{step}
netlist_normalized_objects_total{type}
netlist_dedup_conflicts_total{type}
netlist_graph_nodes_total{type}
netlist_graph_edges_total{type,status}
netlist_page_nets_total
netlist_project_nets_total
netlist_pin_to_net_resolved_total{status}
netlist_pin_to_net_unresolved_total{reason}
netlist_cross_page_links_total{status}
netlist_bus_memberships_total{status}
netlist_power_domain_conflicts_total
netlist_conflicts_total{type,severity}
netlist_review_items_total{type,severity,status}
netlist_patch_replay_total{status}
netlist_release_gate_blocks_total{reason}
netlist_exact_match_rate{dataset}
netlist_merge_error_rate{dataset}
netlist_split_error_rate{dataset}
```

---

# 108. Dashboard

```text
Jobs
Parts/Pins
Page Graph Coverage
Pin-to-Net Coverage
Net Confidence
Ambiguous Crossings
Junction Conflicts
Cross-page Links
Bus Members
Power Domains
No-connect Conflicts
Net Split/Merge Candidates
Review Queue
Release Readiness
Benchmark
Processing Time
```

---

# 109. 安全与权限

- Recognition IR、页面图像、网表和器件信息按租户/项目隔离；
- 所有输入作为不可信数据；
- 不执行附件、脚本或宏；
- Rule DSL 禁止任意代码；
- Patch API 需要项目和审核权限；
- Netlist Release 与普通 Review 分权；
- 高风险 Merge/Split 需要双人审批可配置；
- Source Evidence 使用短期签名 URL；
- 不在日志输出完整私有网表；
- Object Storage 加密；
- 审核历史和 Release Manifest 不可硬删除；
- Worker 默认无公网；
- 器件库只使用授权 Snapshot；
- 不从不受信任 URL 下载数据手册或库；
- 不将原理图、网表和器件连接发送给外部通用模型；
- AI 只能生成解释或审核摘要，不能写 Graph Edge；
- 公开测试只用开源、合成、脱敏或授权数据；
- Agent 16 Export 必须鉴权和审计。

---

# 110. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Temporal
```

图与几何：

```text
Shapely / GEOS
STRtree / R-tree
custom adjacency
union-find
igraph optional for offline benchmark
```

数据：

```text
Polars
PyArrow
DuckDB
```

前端：

```text
React
TypeScript
Canvas/SVG/WebGL Overlay
Zustand
```

V1 不依赖 LLM。

---

# 111. 推荐仓库结构

```text
netlist-reconstruction-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── netlist-reconstruction-agent-spec.md
│   ├── reconstruction-ir.md
│   ├── observation-normalization.md
│   ├── pin-identity-resolution.md
│   ├── page-connectivity-graph.md
│   ├── labels-ports-power.md
│   ├── cross-page-resolution.md
│   ├── bus-resolution.md
│   ├── confidence-and-conflicts.md
│   ├── review-workbench.md
│   ├── release-gates.md
│   ├── agent16-ir-adapter.md
│   ├── downstream-contracts.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-observation-reconstruction-review-release-separated.md
│       ├── 0002-ambiguous-edges-are-not-unioned.md
│       ├── 0003-pin-identity-may-remain-unknown.md
│       ├── 0004-cross-page-links-require-scope-and-evidence.md
│       ├── 0005-bus-members-are-not-position-guessed.md
│       ├── 0006-review-patches-do-not-overwrite-machine-graph.md
│       └── 0007-netlist-release-requires-hard-gates.md
├── src/
│   └── netlist_reconstruction/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── input.py
│       │   ├── part.py
│       │   ├── pin.py
│       │   ├── wire.py
│       │   ├── graph.py
│       │   ├── page_net.py
│       │   ├── project_net.py
│       │   ├── bus.py
│       │   ├── candidate.py
│       │   ├── conflict.py
│       │   ├── review.py
│       │   └── release.py
│       ├── adapters/
│       │   ├── agent17.py
│       │   ├── agent16_schema.py
│       │   ├── part_library.py
│       │   ├── symbol_library.py
│       │   └── downstream.py
│       ├── normalization/
│       │   ├── coordinates.py
│       │   ├── parts.py
│       │   ├── pins.py
│       │   ├── wires.py
│       │   ├── labels.py
│       │   ├── ports.py
│       │   ├── equivalence.py
│       │   └── trace.py
│       ├── spatial/
│       │   ├── index.py
│       │   ├── segments.py
│       │   ├── intersections.py
│       │   ├── distance.py
│       │   └── tolerances.py
│       ├── pin_identity/
│       │   ├── candidates.py
│       │   ├── text.py
│       │   ├── geometry.py
│       │   ├── library.py
│       │   ├── multi_unit.py
│       │   ├── stacked.py
│       │   └── confidence.py
│       ├── graph/
│       │   ├── nodes.py
│       │   ├── edges.py
│       │   ├── builder.py
│       │   ├── junctions.py
│       │   ├── crossings.py
│       │   ├── attachments.py
│       │   ├── union_find.py
│       │   ├── components.py
│       │   ├── revisions.py
│       │   └── hashing.py
│       ├── labels/
│       │   ├── anchors.py
│       │   ├── scopes.py
│       │   ├── aliases.py
│       │   └── naming.py
│       ├── cross_page/
│       │   ├── explicit_refs.py
│       │   ├── labels.py
│       │   ├── ports.py
│       │   ├── hierarchy.py
│       │   ├── candidates.py
│       │   └── resolver.py
│       ├── buses/
│       │   ├── syntax.py
│       │   ├── definitions.py
│       │   ├── entries.py
│       │   ├── memberships.py
│       │   └── conflicts.py
│       ├── power/
│       │   ├── symbols.py
│       │   ├── domains.py
│       │   ├── equivalence.py
│       │   └── conflicts.py
│       ├── candidates/
│       │   ├── gap_bridges.py
│       │   ├── pin_attachments.py
│       │   ├── split_merge.py
│       │   ├── cross_page.py
│       │   ├── bus_members.py
│       │   └── impact.py
│       ├── conflicts/
│       │   ├── detector.py
│       │   ├── taxonomy.py
│       │   ├── severity.py
│       │   └── blockers.py
│       ├── confidence/
│       │   ├── edges.py
│       │   ├── pins.py
│       │   ├── nets.py
│       │   ├── cross_page.py
│       │   └── trace.py
│       ├── review/
│       │   ├── queue.py
│       │   ├── patches.py
│       │   ├── locks.py
│       │   ├── replay.py
│       │   ├── impact.py
│       │   └── validation.py
│       ├── release/
│       │   ├── gates.py
│       │   ├── manifests.py
│       │   ├── approvals.py
│       │   └── integrity.py
│       ├── export/
│       │   ├── pin_to_net.py
│       │   ├── simple_netlist.py
│       │   ├── agent16.py
│       │   ├── kicad_candidate.py
│       │   └── reports.py
│       ├── validation/
│       │   ├── schema.py
│       │   ├── graph.py
│       │   ├── partition.py
│       │   ├── constraints.py
│       │   └── fidelity.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── reconstruction-profiles/
├── review-ui/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_recognition_ir.py
    ├── build_page_graph.py
    ├── inspect_net_partition.py
    ├── compare_netlists.py
    ├── replay_review_patches.py
    ├── run_release_gate.py
    ├── export_pin_to_net.py
    ├── export_agent16_ir.py
    └── run_netlist_benchmark.py
```


---

# 112. Codex 分阶段实施

不要让 Codex 一次实现全部 Graph、跨页、Bus、Power、审核工作台和多种导出。

## Phase 0：仓库侦察和数据契约盘点

Codex 必须检查：

1. Agent 16 的实际 IR Schema、版本和完成程度；
2. Agent 17 的 Recognition IR、Page Graph、Part/Pin/Wire/Junction/Label/Bus 输出；
3. 当前 Pin-to-Net、Netlist、Connectivity 和 Graph 代码；
4. 当前 Symbol、Pin Definition、Part Library 和历史网表；
5. 当前页面坐标、PDF 坐标、像素坐标和 Transform；
6. 当前 Wire 去重、线段相交、空间索引和图算法；
7. 当前 Junction、Crossing、Bridge、Gap Candidate；
8. 当前 Local/Global/Power/Off-page/Hierarchical Label；
9. 当前跨页、Sheet、Port 和 Project Net；
10. 当前 Bus Syntax、Bus Entry 和 Differential Pair；
11. 当前 RefDes、Pin Number、Pin Name、Multi-unit 和 Hidden Pin；
12. 当前 No-connect；
13. 当前 Review UI、Overlay、Patch、Lock 和 Audit；
14. 当前 Netlist Export、Agent 16 Adapter 和 KiCad Candidate；
15. 当前 Benchmark、Golden Netlist 和合成数据；
16. 当前 API、Queue、Worker、Object Storage 和 Database；
17. 当前权限、Release、Manifest 和 Hash；
18. 当前 Agent 31、32、43、44、45 数据契约；
19. 统计 Ambiguous Crossing、Pin Missing、Cross-page Gap、Bus Gap 和 Duplicate RefDes；
20. 抽样分析开源、合成、脱敏或授权项目；
21. 不修改业务代码；
22. 不创建 Migration；
23. 不安装依赖；
24. 不发布网表；
25. 不调用外部通用模型；
26. 不读取或打印生产 Secret。

## Phase 1：Reconstruction IR 和 JSON Schema

实现：

- Job/Input Snapshot；
- Normalized Part；
- Normalized Pin；
- Normalized Wire；
- Graph Node/Edge；
- Page Net；
- Label/Port；
- Cross-page Link；
- Project Net；
- Bus；
- Power Domain；
- Pin-to-Net；
- Candidate；
- Conflict；
- Patch/Lock；
- Release Manifest；
- JSON Schema。

## Phase 2：Recognition IR Adapter

实现：

- Agent 17 Schema Validation；
- Version Compatibility；
- Page/Coordinate；
- Source Evidence；
- Symbol/Pin/Wire/Junction/Label/Bus Mapping；
- Unknown Preservation；
- Diagnostics；
- Input Snapshot Hash。

## Phase 3：Observation Normalization 和 Dedup

实现：

- Coordinate Transform；
- Stable IDs；
- Vector/Raster Equivalence；
- Duplicate Wire；
- Duplicate Symbol；
- Supporting/Conflicting Evidence；
- Tolerance Profile；
- Deterministic Output。

## Phase 4：Pin Identity Resolution

实现：

- Pin Number/Name Candidate；
- Text Association；
- Geometry；
- Temporary Pin Key；
- Multi-unit；
- Missing Pin；
- Duplicate Pin；
- Library-supported Validation；
- No Hard Guessing。

## Phase 5：Spatial Index 和 Segment Geometry

实现：

- STRtree/R-tree；
- Endpoint；
- Intersection；
- Collinear Overlap；
- Near Miss；
- Arc Approximation；
- Numeric Precision；
- Property Tests；
- Performance Tests。

## Phase 6：Page Graph Core

实现：

- Graph Node；
- Wire Edge；
- Pin Attachment；
- Junction；
- Crossing；
- Bridge；
- Candidate Edge；
- Union-Find；
- Graph Revision；
- Topology Hash。

## Phase 7：Junction、Crossing 和 Gap Rules

实现：

- Explicit Dot；
- T-junction；
- Cross without Dot；
- Bridge Jump；
- Ambiguous；
- Short Gap Candidate；
- No Long Gap；
- Evidence；
- Review Gate；
- Golden Tests。

## Phase 8：Page Net Partition

实现：

- Connected Components；
- Page Net Stable Key；
- Pin/Label/Port Membership；
- Generated Name；
- Unresolved Edge；
- Page Net Revision；
- Split/Merge Diagnostics。

## Phase 9：Label 和 Port Resolution

实现：

- Label Anchor；
- Local；
- Global；
- Power；
- Off-page；
- Hierarchical；
- Annotation Exclusion；
- Scope；
- Alias；
- Conflict。

## Phase 10：Cross-page Resolution

实现：

- Explicit Page Reference；
- Off-page Connector；
- Global Labels；
- Sheet/Hierarchy Scope；
- Missing/Duplicate Target；
- Candidate；
- Review；
- Project Net Component。

## Phase 11：Power Net 和 Domain

实现：

- Power Symbol；
- Supply Label；
- GND/AGND/DGND/PGND；
- Domain Registry；
- Isolation Evidence；
- Alias Candidate；
- Accidental Merge Block；
- Review。

## Phase 12：Bus Resolution

实现：

- Bus Definition；
- Syntax Registry；
- Range Expansion；
- Bus Entry；
- Member Label；
- Membership；
- Unknown Syntax；
- Conflict；
- No Position Guessing。

## Phase 13：Project Net 和 Pin-to-Net

实现：

- Page Net Equivalence；
- Project Net Revision；
- Pin-to-Net；
- No-connect；
- Alias；
- Generated Name；
- One-pin-one-net Invariant；
- Trace。

## Phase 14：Candidates 和 Impact Analysis

实现：

- Pin Attachment；
- Gap Bridge；
- Junction；
- Split/Merge；
- Cross-page；
- Bus Member；
- Power Equivalence；
- Before/After Partition；
- Risk；
- Review Priority。

## Phase 15：Conflict Detection

实现：

- Duplicate RefDes；
- Pin Conflict；
- Junction/Crossing；
- No-connect；
- Label Scope；
- Cross-page；
- Bus；
- Power；
- Split/Merge；
- Critical Blocker；
- Explanation。

## Phase 16：Confidence 和 Fidelity

实现：

- Dimension Scores；
- Critical Minimum；
- Edge/Pin/Page/Project Net；
- Coverage；
- Unobservable Scope；
- Fidelity Report；
- No Misleading Overall Score。

## Phase 17：Review Backend

实现：

- Queue；
- Claim；
- Patch；
- Preconditions；
- Lock；
- Replay；
- Conflict；
- Audit；
- Graph Revision；
- Authorization。

## Phase 18：Review Frontend

实现：

- Page Viewer；
- Pin/Wire/Net Overlay；
- Net Navigation；
- Connect/Disconnect；
- Junction；
- Split/Merge；
- Cross-page；
- Bus；
- Power；
- Before/After；
- Evidence；
- Keyboard Workflow。

## Phase 19：Release Gates 和 Manifest

实现：

- Release Levels；
- Critical Gates；
- Unresolved Summary；
- Approval；
- Manifest；
- Hash；
- Immutable Release；
- Supersede；
- Audit。

## Phase 20：Exports

实现：

- Pin-to-Net JSON/CSV；
- Net-to-Pin；
- Simple Netlist；
- Agent 16 IR；
- KiCad Netlist Candidate；
- SPICE-like View；
- Format Validation；
- Provenance。

## Phase 21：Downstream Contracts

实现：

- Agent 31；
- Agent 32；
- Agent 43；
- Agent 44；
- Agent 45；
- Event Version；
- Release-level Requirement；
- Contract Fixtures；
- Compatibility Tests。

## Phase 22：Incremental Rebuild 和 Cache

实现：

- Page Hash；
- Graph Cache；
- Affected Component；
- Patch Reapply；
- Cross-page Invalidation；
- Project Net Rebuild；
- Deterministic Hash；
- Historical Revision。

## Phase 23：API、Events、Batch 和 Storage

实现：

- APIs；
- Progress；
- Batch；
- Cancel/Resume；
- Pagination；
- Object Storage；
- JSONL；
- Permissions；
- Event Bus；
- Observability。

## Phase 24：Security 和 Audit

实现：

- Tenant/Project Isolation；
- Rule DSL Security；
- Patch/Release Permissions；
- Signed URL；
- No External Model；
- Immutable Manifest；
- Retention；
- Legal Hold；
- Audit Replay。

## Phase 25：Benchmark、监控和生产发布

实现：

- Golden Netlists；
- Agent 16 Ground Truth；
- Pairwise Connectivity；
- Exact Partition；
- Cross-page；
- Bus；
- Review Replay；
- Large Graph；
- Metrics；
- Dashboard；
- Feature Flag；
- Rollback；
- Disaster Recovery。

## Phase 26：辅助推理，可选

稳定后：

- 器件 Pin Definition 候选；
- 网络命名建议；
- ERC 候选；
- VLM 局部截图辅助审核；
- 只生成解释和候选；
- 不直接写 Graph Edge；
- 不绕过 Release Gate。

---

# 113. Codex 工作纪律

Codex 必须：

1. Observation、Reconstruction、Review 和 Published Netlist 分开；
2. Agent 17 Raw Observation 不可覆盖；
3. Vector/Raster Observation 通过 Equivalence 关联，不直接删除；
4. 坐标变换必须可重放；
5. Pin 缺少编号时保留 Unknown；
6. 不按器件外形硬套 Pin；
7. Hidden Pin 不从图片凭空生成；
8. Multi-unit 和 Logical Part 分开；
9. Wire 不等于 Net；
10. Candidate Edge 不进入 Union-Find；
11. Ambiguous Crossing 不自动连接；
12. Cross without Dot 默认不连接；
13. Bridge Jump 不连接；
14. Gap Bridge 只生成候选；
15. 长距离断线不补；
16. 自动 Pin Attachment 保存距离和阈值；
17. Junction 规则有 Evidence；
18. Page Net 和 Project Net 分开；
19. Local Label 不自动跨页；
20. Global/Power Label 仍需 Scope；
21. Off-page Link 优先显式目标引用；
22. Cross-page Link 状态明确；
23. GND、AGND、DGND 和 PGND 默认不合并；
24. Power Domain Conflict 是 Hard Gate；
25. Bus Trunk 和 Member Net 分开；
26. Bus Member 不按几何顺序猜；
27. Differential Pair 只生成候选；
28. Pin Name `NC` 不等于 No-connect；
29. 普通 Pin 发布后最多属于一个 Project Net；
30. Stacked Pin 使用显式模型；
31. Net Name 不决定 Net Identity；
32. 同名 Net 不自动合并；
33. 不同名 Label 可能是 Alias，但需证据；
34. Net Confidence 使用关键最小值，不只平均；
35. Critical Ambiguity 不能被总分掩盖；
36. Split/Merge 显示 Before/After 影响；
37. 高风险 Patch 需权限；
38. Review Patch 不覆盖机器 Graph；
39. Patch Replay 检查 Preconditions；
40. Lock 不被模型升级覆盖；
41. Release Manifest 不可变；
42. 新修改生成新 Revision；
43. Agent 16 Export 保留 Recognition Provenance；
44. Candidate Netlist 不进入量产下游；
45. Agent 43只消费 Reviewed/Ready；
46. Agent 44不能把识别网表直接当生产文件；
47. Agent 45必须看到 Release Level；
48. V1 不使用 LLM/VLM 构建 Graph；
49. AI 不写连接、不拆分或合并 Net；
50. 不将私有原理图和网表发送给外部模型；
51. 公开 Fixture 必须有许可；
52. 不伪造 Pin-to-Net、完整度、准确率或 Benchmark；
53. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Rule/Profile 变化；
    - 测试命令；
    - 真实结果；
    - Pin Identity Metrics；
    - Graph/Net Partition Metrics；
    - Cross-page/Bus Metrics；
    - Release Gate；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 114. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/netlist-reconstruction-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第18个 Agent：

Netlist Reconstruction, Confidence & Review Agent /
Netlist 重建 Agent。

本 Agent 接收 Agent 17 输出的：

- Part Candidate；
- Pin Observation；
- Wire Observation；
- Junction/Crossing；
- Label/Port/Off-page Connector；
- Page Graph Candidate；
- Bus/Bus Entry；
- Source Evidence；

并生成：

- Normalized Part/Pin/Wire；
- Page Connectivity Graph；
- Page Net；
- Cross-page Link；
- Project Net；
- Power Domain；
- Bus Membership；
- Pin-to-Net；
- Connection Candidate；
- Conflict；
- Review Patch；
- Reviewed Netlist；
- Agent 16 Compatible Part IR / Net IR；
- Netlist Fidelity Report。

本 Agent 不重新执行整页 OCR，不使用 LLM/VLM 直接构建 Net Graph，不为了完整率补线，不自动生成完整 KiCad 工程。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16 规格和实际 IR；
3. Agent 17 规格和实际 Recognition IR；
4. docs/netlist-reconstruction-agent-spec.md；
5. 当前 Connectivity/Graph/Netlist 代码；
6. 当前 Part/Pin/Wire/Junction/Label/Bus 数据结构；
7. 当前 Page/PDF/Pixel Coordinate Transform；
8. 当前 Symbol/Pin Definition/Part Library；
9. 当前 RefDes/Pin Number/Pin Name/Multi-unit；
10. 当前 Wire Geometry/Intersection/Spatial Index；
11. 当前 Local/Global/Power/Off-page/Hierarchical Label；
12. 当前 Cross-page/Sheet/Project Net；
13. 当前 Bus/Entry/Differential Pair；
14. 当前 Review UI/Overlay/Patch/Lock；
15. 当前 Netlist Export/Agent 16 Adapter；
16. 当前 Benchmark/Golden Netlist；
17. 当前 API/Queue/Worker/Object Storage/Database；
18. 当前 Agent 31/32/43/44/45 Contracts；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Observation/Reconstruction/Review/Published 分层；
- Raw Observation 不覆盖；
- Vector/Raster 使用 Equivalence；
- Coordinate Transform 可重放；
- Missing Pin 保留 Unknown；
- 不按外形硬套 Pin；
- Hidden Pin 不凭空生成；
- Multi-unit/Logical Part 分开；
- Wire != Net；
- Candidate Edge 不 Union；
- Ambiguous Crossing 不连接；
- Cross without Dot 不连接；
- Bridge Jump 不连接；
- Gap Bridge 只生成候选；
- 不补长距离断线；
- Pin Attachment 保存距离/阈值；
- Page Net/Project Net 分开；
- Local Label 不跨页；
- Cross-page 有 Scope/Evidence/Status；
- Power Domain 分开；
- GND/AGND/DGND/PGND 不默认合并；
- Bus/Member 分开；
- Bus Member 不按位置猜；
- Diff Pair 只生成候选；
- Pin Name NC != No-connect；
- 普通 Pin 最多属于一个 Project Net；
- Net Name != Net Identity；
- Confidence 分维度且看关键最小值；
- Split/Merge 有影响预览；
- Patch 不覆盖机器 Graph；
- Patch Replay 检查 Preconditions；
- Lock 不被升级覆盖；
- Release Manifest Immutable；
- Agent 16 Export 保留 Provenance；
- Candidate Netlist 不进入量产；
- Agent 43只消费 Reviewed/Ready；
- Agent 44不把识别网表直接当生产文件；
- Agent 45看到 Release Level；
- V1 不用 LLM/VLM 构建 Graph；
- AI 不写连接、不拆分/合并 Net；
- 不把私有原理图和网表发送给外部模型；
- 不用真实私有工程做公开 Fixture；
- 不伪造准确率、完整度和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不发布网表：

1. 侦察当前仓库；
2. 检查 Agent 16 IR Schema 和实现；
3. 检查 Agent 17 Recognition IR 和实现；
4. 查找 Connectivity/Graph/Netlist；
5. 查找 Coordinate Transform；
6. 查找 Part/Pin/Wire/Junction/Label/Bus；
7. 查找 Spatial Index/Intersection/Union-Find；
8. 查找 RefDes/Pin Identity/Multi-unit；
9. 查找 Local/Global/Power/Off-page Label；
10. 查找 Cross-page/Sheet/Project Net；
11. 查找 Bus/Entry/Diff Pair；
12. 查找 No-connect；
13. 查找 Candidate/Conflict；
14. 查找 Review UI/Overlay/Patch/Lock；
15. 查找 Release/Manifest/Export；
16. 查找 Benchmark/Golden Netlist；
17. 查找 Agent 31/32/43/44/45 Contracts；
18. 查找 API/Queue/Worker/Storage/Permission；
19. 统计 Pin Missing、Crossing Ambiguous、Cross-page Gap、Bus Gap 和 Duplicate RefDes；
20. 抽样分析开源、合成、脱敏或授权项目；
21. 在 docs/netlist-reconstruction-implementation-plan.md 中生成实施计划；
22. 在 docs/reconstruction-ir.md 中定义 IR；
23. 在 docs/observation-normalization.md 中定义归一化；
24. 在 docs/pin-identity-resolution.md 中定义 Pin；
25. 在 docs/page-connectivity-graph.md 中定义页面图；
26. 在 docs/labels-ports-power.md 中定义标签和电源；
27. 在 docs/cross-page-resolution.md 中定义跨页；
28. 在 docs/bus-resolution.md 中定义总线；
29. 在 docs/confidence-and-conflicts.md 中定义置信度和冲突；
30. 在 docs/review-workbench.md 中定义审核；
31. 在 docs/release-gates.md 中定义发布 Gate；
32. 在 docs/agent16-ir-adapter.md 中定义 Agent 16 输出；
33. 在 docs/downstream-contracts.md 中定义 Agent 31/32/43/44/45；
34. 在 docs/security.md 中定义安全；
35. 在 docs/netlist-reconstruction-migration-plan.md 中定义旧数据迁移；
36. 在 docs/netlist-reconstruction-benchmark-plan.md 中定义 Benchmark；
37. 给出拟新增、拟修改和拟复用文件；
38. 给出 Phase 1 精确范围；
39. 不修改业务代码；
40. 不创建数据库 Migration；
41. 不安装依赖；
42. 不调用外部模型；
43. 不读取或打印生产 Secret；
44. 运行当前仓库已有 lint、type check、test、build 和 security scan；
45. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/17 数据契约；
- Reconstruction IR；
- Observation Normalization；
- Pin Identity；
- Spatial/Geometry；
- Page Graph；
- Junction/Crossing；
- Page Net；
- Label/Power；
- Cross-page；
- Bus；
- Project Net/Pin-to-Net；
- Candidate/Conflict；
- Confidence/Fidelity；
- Review/Patch/Lock；
- Release Gate；
- Export；
- Downstream Contracts；
- Security；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 115. 后续 Phase 提示词模板

```text
继续实现 Netlist Reconstruction Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16、17、18 规格；
3. 阅读 Netlist Reconstruction Implementation Plan；
4. 阅读 IR、Normalization、Pin、Graph、Cross-page、Bus、Review、Release、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Observation/Reconstruction/Review/Release Separation；
- Raw Evidence Immutable；
- Candidate Edge Not Unioned；
- Crossing != Junction；
- Unknown Pin Allowed；
- Scope-aware Cross-page；
- Explicit Bus Membership；
- Power Domain Safety；
- Review Patch Audit；
- Immutable Release Manifest；
- No LLM-built Graph；
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
9. graph/net partition test；
10. patch/release test；
11. downstream contract test；
12. security test；
13. performance test；
14. benchmark；
15. 更新文档；
16. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Rule/Profile 变化；
- 测试命令和真实结果；
- Pin Identity Metrics；
- Graph/Net Metrics；
- Cross-page/Bus Metrics；
- Review/Release Gate；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 116. MVP 演示流程

1. 选择 Agent 17 已完成识别的一份 6 页原理图；
2. 加载 Recognition IR；
3. 校验每页 Coordinate Transform；
4. 合并同一根线的 Vector 与 Raster Observation；
5. 保留一处冲突 Wire Observation；
6. 生成 Normalized Part、Pin 和 Wire；
7. 为 R1、C1、U1 创建 Pin Endpoint；
8. U1 的一个 Pin Number OCR 不确定，保留两个候选；
9. 构建空间索引；
10. 绑定精确接触的 Pin 和 Wire；
11. 识别两个 T-junction；
12. 识别一个显式 Dot Junction；
13. 一个无 Dot Crossing 不连接；
14. 一个低质量 Crossing 进入 Review；
15. 一个短断线形成 Gap Candidate；
16. 不自动应用 Gap Candidate；
17. 建立每页 Graph；
18. 计算 Page Net；
19. 绑定 `+3V3` Power Label；
20. 绑定 `I2C_SCL` Local Label；
21. 识别 `USB_D+` Off-page Connector；
22. 根据显式页码连接 Page 2 和 Page 5；
23. 同名普通 Local Label 不跨页合并；
24. 构建 Project Net；
25. 识别 D[0..7] Bus；
26. 映射 7 个明确 Member；
27. 一个 Entry 缺 Label，进入 Review；
28. 检测 AGND 和 GND 的错误 Merge Candidate；
29. Hard Gate 阻止该 Merge；
30. 生成 Pin-to-Net Candidate；
31. Review UI 打开低质量 Crossing；
32. 工程师选择 Disconnect；
33. 审核 Gap Candidate 并选择 Connect；
34. 映射缺失 Bus Member D3；
35. 修正 U1 Pin Number；
36. Patch 保存但不覆盖机器 Graph；
37. 重建新 Graph Revision；
38. 运行 Critical Conflict；
39. 检查 No-connect；
40. 生成 Reviewed Netlist；
41. 导出 Pin-to-Net CSV；
42. 导出 Agent 16 Part/Net IR Candidate；
43. 与原生 KiCad Agent 16 IR 对比；
44. 计算 Net Merge、Net Split 和 Pin-to-Net 指标；
45. 创建 Release Manifest；
46. 发布 `netlist.pin-to-net.ready`。

---

# 117. 生产上线顺序

第一阶段：

```text
Agent 17 Recognition IR
Normalization
Pin Endpoint
Wire/Junction/Crossing
Page Graph
Page Net
Pin-to-Net Candidate
Review
Agent 16 IR Candidate
```

第二阶段：

```text
Cross-page
Power Domain
Bus
Patch Replay
Release Gate
Downstream Contracts
Benchmark
```

第三阶段：

```text
Large Graph Incremental
Advanced Pin Library Validation
Semantic ERC Candidates
KiCad Draft Reconstruction Handoff
```

上线优先确保：

```text
每一条连接为什么存在
每一个 Pin 到底属于哪个 Net
哪几条连接仍然只是候选
跨页和总线是如何解析的
人工修改能否完整重放和审计
```

宁可输出“U1 的这个引脚尚未确认连接”，也不要为了让网表达到 100% 完整率，把它接到最近的一根线上。网表重建里最危险的错误不是一个 Pin 保持 Unknown，而是一条错误连接被当成确定事实，继续流入 ERC、PCB 重建、制造和测试系统。
