# KiCad/EDA 工程解析 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：16  
> Agent 名称：KiCad/EDA Project Parsing & Canonical IR Agent  
> 中文名称：KiCad/EDA 工程解析 Agent  
> 类型：程序型  
> 版本：V1.0  
> 格式资料基线日期：2026-07-20  
>
> 定位：安全解析 KiCad、Altium、嘉立创EDA/EasyEDA 等电子设计工程，将不同来源的项目、原理图、PCB、器件、网络、约束、图形、库引用和制造属性转换为统一、版本化、可验证、可追溯到源文件位置的 Canonical EDA Intermediate Representation。
>
> 核心输出：
> - Project IR
> - Schematic IR
> - PCB IR
> - Part IR
> - Net IR
> - Library IR
> - Constraint IR
> - Variant IR
> - Geometry IR
> - Source Map / Evidence IR
> - Parse Diagnostics
> - Fidelity & Completeness Report
>
> 直接下游：
> - Agent 17 及后续电路理解、设计检查和自动化 Agent
> - Agent 31 BOM 接入与标准化
> - Agent 32 MPN 精准匹配
> - Agent 42 追溯要求与实际 Genealogy
> - Agent 43 EBOM、MBOM 与 NPI 转换
> - Agent 44 PCB/SMT 制造询价
> - Agent 45 来料、生产和测试质量
> - KiCad/EDA Web Viewer
> - BOM、CPL、网表、DFM、ERC、DRC、仿真和版本比较
>
> 重要边界：
> - 本 Agent 负责解析、标准化、连接关系解析、结构验证和证据保存，不负责自动修改设计，不负责电路功能推理，不负责器件替代，不负责生成制造下单。
> - V1 以“可信解析和只读 IR”为主，不承诺无损回写全部源格式。
> - 所有自动推导必须区分 `explicit`、`resolved`、`inferred`、`unknown`。
> - 任何无法可靠解析的字段、对象或关系必须保留原始数据和诊断，不得静默丢弃或猜测。
> - 原始文件、原始对象树和 Canonical IR 分层保存。
> - 源文件坐标、对象 ID、层级路径、文件偏移或 JSON Path 必须尽可能保留。
> - 核心解析和连通性构建完全程序化，不依赖 LLM。
> - 通用大模型不得接触未获授权的私有工程文件。

---

# 1. 官方格式基线

## 1.1 KiCad

当前官方开发者文档说明：

```text
.kicad_sch
KiCad 6.0 及以上 S-expression 原理图

.kicad_pcb
S-expression PCB

.kicad_sym
符号库

.kicad_mod
封装库
```

KiCad 的 S-expression 格式使用 UTF-8、括号 Token、毫米坐标，并为原理图层级实例使用 UUID Path。

KiCad 官方还维护第三方导入格式文档，当前能力表列出 Altium、EasyEDA 等格式。该资料只作为 Parser Adapter 的行为和测试参考，不替代独立解析和验证。

## 1.2 Altium

需要支持或规划：

```text
.PrjPcb / Project metadata
.SchDoc
.PcbDoc
.SchLib
.PcbLib
.IntLib
.OutJob
.DsnWrk
Variants / Parameters / Classes / Rules
```

Altium 工程通常同时包含项目级 ASCII 元数据和专有文档容器。解析器必须：

- 显式检测文件类型和版本；
- 使用受限 CFB/OLE Stream Reader；
- 不假设不同版本 Record 完全一致；
- 未知 Record 原样保留；
- 不依赖安装 Altium Designer 才能读取基础结构；
- 可选使用 Altium 导出的 ASCII、IPC-2581、ODB++、BOM、CPL 作为交叉验证证据。

## 1.3 嘉立创EDA / EasyEDA

需要区分：

```text
EasyEDA / 嘉立创EDA 标准版
JSON 文档和压缩项目

EasyEDA Pro / 嘉立创EDA 专业版
ZIP + JSONL 或版本化项目容器
```

标准版官方文档将原理图和 PCB 描述为 JSON 对象；工程可包含多页原理图。专业版和在线平台导出结构必须由独立 Adapter 和版本清单管理，不能把所有文件都当成一种 JSON。

## 1.4 格式基线原则

格式与软件会演进，因此代码不得把本文档的版本描述当作永久事实。

每个 Adapter 必须有：

```text
format family
file extension
magic/signature
format version
editor version
adapter version
verified date
supported feature matrix
known gaps
fixture coverage
```

---

# 2. 建设目标

系统必须能够：

1. 接收单文件、目录、ZIP、工程包和 Git Commit；
2. 自动识别 KiCad、Altium、嘉立创EDA/EasyEDA 格式；
3. 检测文件扩展名与真实内容不一致；
4. 安全解压工程包；
5. 防止 Zip Slip、Zip Bomb、嵌套压缩炸弹和超大文件；
6. 建立 Source Asset Inventory；
7. 识别项目入口文件；
8. 识别工程内原理图、PCB、库、规则、输出和附件；
9. 检测工具、格式和编辑器版本；
10. 解析 KiCad Project；
11. 解析 KiCad 多层级原理图；
12. 解析 KiCad PCB；
13. 解析 KiCad Symbol Library；
14. 解析 KiCad Footprint Library；
15. 解析 KiCad Project Settings、Net Classes 和 Design Rules；
16. 支持 KiCad 6、7、8、9 以及后续兼容版本的适配机制；
17. 支持 KiCad Legacy 文件的独立 Adapter；
18. 解析 Altium Project；
19. 解析 Altium Schematic；
20. 解析 Altium PCB；
21. 解析 Altium SchLib 和 PcbLib；
22. 识别 Altium Variant、Parameter、Component Class 和 Net Class；
23. 解析嘉立创EDA/EasyEDA 标准版工程；
24. 解析嘉立创EDA/EasyEDA 专业版导出工程；
25. 解析多页原理图；
26. 解析 PCB、封装和库对象；
27. 解析元件、引脚、位号、值、字段和属性；
28. 解析 Wire、Bus、Junction、Label 和 No Connect；
29. 解析 Hierarchical Sheet、Port、Sheet Entry 和 Instance Path；
30. 解析 Net Label、Global Net、Power Net 和 Hidden Power Pin；
31. 解析差分对、Net Class、Bus 和 Harness；
32. 构建逻辑连通图；
33. 区分几何接触和电气连接；
34. 正确处理 Junction；
35. 正确处理 Cross-over without Junction；
36. 处理同名标签和层级标签；
37. 处理多单元符号；
38. 处理 DeMorgan/Alternate Symbol；
39. 处理 Gate Swap 和 Pin Swap 信息；
40. 处理 Hidden Pin 和 Stacked Pin；
41. 解析 PCB Layers 和 Stack-up；
42. 解析 Footprint、Pad、Track、Arc、Via 和 Zone；
43. 解析 Keepout、Rule Area、Board Outline 和 Cutout；
44. 解析 Net 与 Pad/Track/Via/Zone 关系；
45. 解析 Footprint Placement、Side、Rotation 和 Locked；
46. 解析 Pad Shape、Drill、Layer Set、Pin Function 和 Pin Type；
47. 解析 3D Model Reference、Offset、Scale 和 Rotation；
48. 解析 Dimension、Text、Graphic、Image 和 Group；
49. 解析 PCB Rule、Net Class、Differential Pair 和 Length Tuning；
50. 解析 Variant、DNP、Alternative Part 和 Fit/No-fit；
51. 解析 Manufacturer、MPN、Supplier SKU 和自定义字段；
52. 区分逻辑 Part、Symbol Unit、Schematic Instance、Footprint Instance；
53. 建立 Symbol Pin 到 Footprint Pad 的映射；
54. 建立 Schematic Net 到 PCB Net 的映射；
55. 检查原理图和 PCB 位号一致性；
56. 检查 Pin/Pad Number 一致性；
57. 检查 BOM 数量和 RefDes；
58. 检查 Net Name 和 Net ID；
59. 检查 Board Outline 完整性；
60. 检查未连接和悬空对象；
61. 生成统一 Project IR；
62. 生成统一 Schematic IR；
63. 生成统一 PCB IR；
64. 生成统一 Part IR；
65. 生成统一 Net IR；
66. 生成 Constraint IR；
67. 生成 Variant IR；
68. 生成 Library IR；
69. 生成 Geometry IR；
70. 生成 Source Map；
71. 生成 Parse Diagnostics；
72. 生成 Fidelity Report；
73. 生成 Completeness Report；
74. 生成 Cross-document Consistency Report；
75. 支持 IR JSON；
76. 支持 IR JSONL；
77. 支持 Protobuf 或 Arrow 的大规模表示；
78. 支持对象存储；
79. 支持数据库索引；
80. 支持增量解析；
81. 支持文件 Hash 和内容寻址；
82. 支持 Git Diff；
83. 支持工程版本比较；
84. 支持结构化变更；
85. 支持稳定 Canonical ID；
86. 支持 As-of Parse；
87. 支持 Parser Replay；
88. 支持 Adapter 升级后重建 IR；
89. 支持解析任务取消、重试和断点恢复；
90. 支持多租户和项目权限；
91. 支持工程文件加密和访问审计；
92. 支持沙箱解析；
93. 支持资源限制；
94. 支持未知 Record；
95. 支持 Opaque Node；
96. 支持源格式警告；
97. 支持损失清单；
98. 支持 Round-trip Readiness 评估；
99. V1 不自动写回源工程；
100. 不根据图形相邻猜测电气连接；
101. 不根据相同文本值合并不同元器件；
102. 不根据同名位号静默合并；
103. 不把原理图 Net 和 PCB Net 名称相同就直接认定同一对象；
104. 不把 PCB Track 交叉视为连接；
105. 不把未解析库符号当作已完整解析；
106. 不因缺少库文件就丢失嵌入式符号或封装数据；
107. 不修改原始文件；
108. 不执行工程内脚本、宏、插件或外部命令；
109. 不从不受信任路径自动下载库；
110. 不伪造解析完整度。

---

# 3. Agent 16 的系统位置

Agent 16 是设计数据基础层：

```text
EDA Source Files
       ↓
Agent 16 Canonical EDA IR
       ↓
 ┌───────────────┬────────────────┬─────────────────┐
 │ Design Agents │ BOM/Supply     │ NPI/Manufacture │
 └───────────────┴────────────────┴─────────────────┘
```

## 3.1 对 Agent 31

提供：

```text
Part IR
RefDes
Value
Quantity
DNP
Variant
Manufacturer
MPN
Supplier fields
Source evidence
```

Agent 31负责非标准 BOM 和外部表格；Agent 16负责从 EDA 工程得到确定性 BOM 事实。

## 3.2 对 Agent 32

提供：

```text
raw manufacturer
raw MPN
symbol/library id
footprint id
package hints
custom fields
source path
```

Agent 32负责精确器件身份解析。

## 3.3 对 Agent 43

提供：

```text
Schematic IR
PCB IR
Part IR
Net IR
RefDes Placement
Variant
DNP
PCB Stack-up
Design Rules
3D references
```

用于 EBOM → MBOM、Routing 和 NPI。

## 3.4 对 Agent 44

提供：

```text
board outline
layers
drills
tracks
vias
zones
stack-up
impedance constraints
placement
BOM/CPL
file consistency
```

用于制造预检和询价。

## 3.5 对 Agent 45

提供：

```text
RefDes
footprint
pad/pin
polarity
placement
net
test point
expected component
```

用于 AOI、X-Ray、ICT 和 FCT 定位。

---

# 4. 核心架构

```text
Source Package
→ Safe Intake
→ Format Detection
→ Source Inventory
→ Source-specific Parser
→ Source AST / Object Tree
→ Source Semantic Model
→ Canonical IR Mapper
→ Connectivity Resolver
→ Cross-document Linker
→ Validator
→ Fidelity & Diagnostics
→ Storage / API / Events
```

---

# 5. 三层数据模型

## 5.1 Raw Source Layer

保存：

```text
原始文件
文件 Hash
文件字节
压缩包 Manifest
文件编码
源工具和版本
```

## 5.2 Source AST / Object Layer

保留源格式结构：

```text
S-expression AST
CFB Stream/Record Tree
JSON/JSONL Object Tree
Unknown Tokens/Records
Source locations
```

## 5.3 Canonical Semantic IR

提供跨工具统一语义：

```text
Project
Schematic
PCB
Part
Net
Constraint
Variant
Library
Geometry
Evidence
```

三层不能混在一张表中。

---

# 6. Lossless 与 Semantic 分开

目标：

```text
Lossless-ish Source Representation
+
Normalized Semantic IR
```

Canonical IR 不需要承载所有源工具私有 UI 状态，但所有无法标准化的重要节点进入：

```text
opaque_extensions
```

---

# 7. 显式、解析和推导来源

每个关键字段保存：

```text
value
provenance
source_reference
resolution_method
confidence
```

`resolution_method`：

```text
explicit
embedded
library_resolved
connectivity_resolved
cross_document_matched
derived
inferred
manual_patch
unknown
```

V1 核心连通性不允许使用模糊推断。

---

# 8. Canonical ID

ID 类型：

```text
source_asset_id
source_object_id
canonical_entity_id
instance_id
revision_id
```

推荐：

```text
UUIDv7 for persisted entities
stable hash for deterministic object identity
```

Stable Key 示例：

```text
project_hash
+ source_document_relative_path
+ source_native_uuid_or_record_id
+ object_type
```

没有 Native ID 时使用结构化 Fingerprint，但必须标记稳定性等级。

---

# 9. Stable ID 等级

```text
native_stable
path_stable
content_stable
heuristic_stable
unstable
```

不能把基于对象顺序生成的 ID 冒充永久稳定。

---

# 10. Source Map

每个 Canonical Object 可映射到一个或多个 Source Span：

```text
file
JSON path
S-expression path
CFB stream
record index
byte offset
line/column
native id
```

---

# 11. Project IR

```json
{
  "project_ir_version": "1.0.0",
  "project_id": "uuid",
  "source_format": "kicad",
  "source_format_version": "20250114",
  "source_tool_version": "9.x",
  "documents": [],
  "schematic_roots": [],
  "pcb_documents": [],
  "libraries": [],
  "variants": [],
  "settings": {},
  "diagnostics": [],
  "opaque_extensions": {}
}
```

Project IR 包含：

```text
project metadata
document graph
source tool
units
title blocks
variants
library tables
text variables
project properties
design rules
output definitions
```

---

# 12. Document Graph

节点：

```text
project
schematic root
hierarchical sheet
PCB
symbol library
footprint library
rule file
output job
attachment
```

边：

```text
contains
references
instantiates
uses_library
derived_from
paired_with
```

---

# 13. Schematic IR

```json
{
  "schematic_id": "uuid",
  "root_sheet_id": "uuid",
  "sheets": [],
  "symbol_definitions": [],
  "symbol_instances": [],
  "wires": [],
  "buses": [],
  "junctions": [],
  "labels": [],
  "ports": [],
  "no_connects": [],
  "graphics": [],
  "texts": [],
  "connectivity_graph_id": "uuid"
}
```

---

# 14. Sheet 与 Sheet Instance

必须区分：

```text
Sheet Definition
Sheet Instance
Hierarchy Path
```

同一个子页可能被多次实例化，每个实例的：

```text
RefDes
Net Scope
Parameters
Instance Path
```

可能不同。

---

# 15. Symbol Definition 与 Instance

## Definition

```text
library id
units
pins
graphics
properties
alternate representation
```

## Instance

```text
refdes
value
unit
position
rotation
mirror
fields
DNP
variant
sheet path
```

---

# 16. Multi-unit Symbol

例如：

```text
U1A
U1B
U1C
Power Unit
```

Part IR 必须把多个 Symbol Unit 组合为一个逻辑 Part Instance，同时保留每个 Unit 的位置和 Pin。

---

# 17. Pin IR

```text
pin number
pin name
electrical type
graphical shape
orientation
position
length
unit
alternate names
hidden
stacked
source
```

---

# 18. Wire 和 Segment

Wire 是几何对象，不直接等于 Net。

保存：

```text
points
stroke
source id
sheet instance
```

Connectivity Resolver 根据：

```text
端点
Junction
Pin anchor
Label
Port
No-connect
```

构建 Net。

---

# 19. Junction

必须显式处理：

```text
wire endpoint meeting
T-junction
crossing with junction
crossing without junction
overlapping segment
```

几何容差版本化，不能无限扩大吸附距离。

---

# 20. Label

类型：

```text
local
global
hierarchical
power
sheet_pin
port
net_alias
```

同名 Label 的 Scope 由源格式语义决定，不能跨所有 Sheet 粗暴全局合并。

---

# 21. Bus

表示：

```text
bus label
bus member
bus entry
bus range
alias
hierarchical passage
```

Bus 本身与成员 Net 分开。

---

# 22. No Connect

No Connect Marker 是显式设计意图：

```text
intentional_unconnected
```

不能与缺少连线混为一谈。

---

# 23. Net IR

```json
{
  "net_id": "uuid",
  "canonical_name": "/POWER/3V3",
  "display_names": ["+3V3"],
  "scope": {
    "sheet_instance_id": "uuid"
  },
  "endpoints": [],
  "segments": [],
  "labels": [],
  "aliases": [],
  "net_class_id": "uuid",
  "resolution": {
    "method": "connectivity_resolved",
    "confidence": 1.0
  }
}
```

---

# 24. Net Endpoint

```text
symbol pin
sheet pin
port
test point
footprint pad
track endpoint
via
zone
```

---

# 25. Logical Net 与 Physical Net

区分：

```text
Schematic Logical Net
PCB Physical Net
Cross-document Net Link
```

Cross-document Link 通过：

```text
source tool net mapping
netlist identifiers
refdes/pin ↔ footprint/pad
net names
document synchronization metadata
```

确定。

名称相同只能作为证据之一。

---

# 26. Net Name

保存：

```text
raw name
display name
canonical hierarchical name
aliases
generated name
source priority
```

不覆盖匿名 Net 的源工具 ID。

---

# 27. Part IR

```json
{
  "part_instance_id": "uuid",
  "logical_part_key": "U1",
  "reference": "U1",
  "value": "STM32H743",
  "symbol_units": [],
  "footprint_instance_id": "uuid",
  "fields": {},
  "manufacturer": null,
  "mpn": null,
  "variant_status": "fitted",
  "pin_pad_map": [],
  "source_refs": []
}
```

---

# 28. Part 层级

区分：

```text
Library Component Definition
Logical Part Definition
Schematic Part Instance
Symbol Unit Instance
PCB Footprint Instance
Procurement Part Identity
```

Agent 16不将这些压成一个“component”对象。

---

# 29. Pin-Pad Mapping

来源：

```text
symbol pin number
footprint pad number
source tool component link
explicit pin mapping
```

异常：

```text
missing pad
duplicate pad
non-electrical pad
stacked pin
alternate pin name
mechanical pad
```

---

# 30. Manufacturer 字段

保存全部原始字段：

```text
Manufacturer
Manufacturer Part Number
MPN
Part Number
Supplier
Supplier PN
LCSC
DigiKey
Mouser
Custom Fields
```

Canonical MPN 由 Agent 32解析，Agent 16不擅自选择某一列。

---

# 31. Variant IR

```text
variant name
fitted
not fitted
alternate part
alternate value
alternate footprint
parameter override
scope
effectivity
```

---

# 32. DNP

统一状态：

```text
fitted
dnp
optional
variant_excluded
unknown
```

保留源格式：

```text
DNP
Do Not Populate
Not Fitted
Variant
Exclude from BOM
Exclude from Board
```

---

# 33. PCB IR

```json
{
  "pcb_id": "uuid",
  "units": "mm",
  "coordinate_system": {},
  "layers": [],
  "stackup": [],
  "board_outline": [],
  "footprints": [],
  "pads": [],
  "tracks": [],
  "arcs": [],
  "vias": [],
  "zones": [],
  "keepouts": [],
  "rules": [],
  "dimensions": [],
  "graphics": [],
  "groups": [],
  "net_links": []
}
```

---

# 34. Coordinate System

必须保存：

```text
source origin
source units
axis direction
rotation convention
layer side transform
canonical transform
precision
```

Canonical 建议：

```text
millimeter
right-handed 2D board plane
rotation degrees normalized [0,360)
```

但原始坐标和值永久保留。

---

# 35. Layer IR

```text
layer id
source layer id
name
canonical role
side
type
order
copper/non-copper
visibility
```

Canonical Role：

```text
copper
solder_mask
paste
silkscreen
adhesive
courtyard
fabrication
assembly
edge
user
mechanical
unknown
```

---

# 36. Stack-up IR

```text
layer sequence
material
thickness
copper thickness
dielectric constant
loss tangent
impedance profile
source completeness
```

缺失信息为 Unknown，不从 Layer Count 猜完整 Stack-up。

---

# 37. Board Outline

表示为：

```text
closed contours
outer boundary
cutouts
slots
arcs
beziers
```

检查：

```text
open contour
self intersection
duplicate segments
ambiguous outer contour
```

---

# 38. Footprint Instance

```text
reference
value
library link
position
rotation
side
locked
attributes
pads
graphics
courtyard
fabrication
assembly
3D models
```

---

# 39. Pad IR

```text
number
name/function
type
shape
position
size
rotation
layers
drill
roundrect ratio
custom primitives
net
pin mapping
thermal settings
```

Pad Type：

```text
smd
through_hole
npth
connector
aperture
custom
unknown
```

---

# 40. Track 与 Arc

保存：

```text
start/end
center/radius or mid
width
layer
net
locked
source geometry
```

交叉 Track 只有符合源格式连接语义时才连通。

---

# 41. Via

```text
position
size
drill
start/end layers
via type
net
free/locked
tenting
fill/cap
```

Via Type：

```text
through
blind
buried
microvia
unknown
```

---

# 42. Zone

```text
outline
holes
net
layer set
priority
clearance
thermal
fill state
filled polygons
keepout flags
```

保存原始轮廓与可选填充结果，不将填充多边形当成唯一设计意图。

---

# 43. Rule Area 和 Keepout

对象级保存：

```text
scope
layers
blocked object types
constraints
source rule id
```

---

# 44. Constraint IR

类型：

```text
clearance
track width
via size
differential pair
length
matched length
impedance
creepage
hole size
placement
keepout
class
room
component clearance
```

---

# 45. Net Class

```text
name
members
clearance
track width
via
diff pair
priority
source
```

---

# 46. Differential Pair

保存：

```text
positive net
negative net
pair name
width
gap
target impedance
length target
skew target
```

识别来源必须记录，不能只靠 `_P/_N` 命名猜测并当成事实。

---

# 47. 3D Model Reference

```text
path
resolved path
format
offset
scale
rotation
availability
hash
source variable
```

禁止在解析时从不可信网络路径自动下载。

---

# 48. Library IR

```text
symbol definitions
footprint definitions
3D references
library table
nickname
search path
embedded library objects
external references
resolution status
```

---

# 49. Library Resolution

优先级：

```text
embedded/cached definition
project local library
explicit library table
approved global library snapshot
unresolved
```

禁止读取用户机器任意全局路径，除非工作区明确挂载和授权。

---

# 50. Opaque Extension

```json
{
  "source_format": "altium",
  "record_type": "UnknownRecord42",
  "source_location": {},
  "raw_payload_uri": "s3://...",
  "preservation_status": "preserved"
}
```

---

# 51. Parse Diagnostic

级别：

```text
fatal
error
warning
information
debug
```

类别：

```text
format
version
encoding
syntax
structure
library
connectivity
geometry
mapping
consistency
unsupported
security
resource
```

---

# 52. Fidelity Report

维度：

```text
source files recognized
objects parsed
objects normalized
opaque objects preserved
libraries resolved
schematic connectivity
PCB connectivity
part mapping
net cross-link
geometry
constraints
variants
3D references
```

---

# 53. Completeness 状态

```text
complete
substantially_complete
partial
structure_only
failed
unknown
```

不得只输出一个百分数掩盖关键维度失败。

---

# 54. Canonical IR 版本

使用 SemVer：

```text
project_ir_version
schematic_ir_version
pcb_ir_version
part_ir_version
net_ir_version
```

Schema 变化分类：

```text
backward compatible
migration required
breaking
```

---

# 55. Parser Adapter 接口

```python
class EdaParserAdapter:
    async def detect(self, assets: list[SourceAsset]) -> DetectionResult: ...
    async def inventory(self, package: SourcePackage) -> SourceInventory: ...
    async def parse_source(self, context: ParseContext) -> SourceParseResult: ...
    async def map_to_ir(self, source: SourceParseResult) -> CanonicalIrBundle: ...
    async def validate(self, bundle: CanonicalIrBundle) -> ValidationReport: ...
```

---

# 56. Adapter Manifest

```json
{
  "adapter_id": "kicad-sexpr",
  "adapter_version": "1.0.0",
  "format_family": "kicad",
  "supported_versions": [">=6"],
  "capabilities": {
    "project": true,
    "schematic": true,
    "pcb": true,
    "symbol_library": true,
    "footprint_library": true,
    "variants": "partial"
  },
  "known_gaps": []
}
```

---

# 57. Format Detection

信号：

```text
extension
magic bytes
container signature
top-level token
JSON schema hints
project manifest
file relationships
```

输出：

```text
detected format
candidate formats
confidence
conflicts
required adapter
```

---

# 58. Safe Intake

流程：

```text
upload
→ malware scan
→ archive inspection
→ path normalization
→ size/resource policy
→ content hash
→ immutable source storage
→ parser sandbox
```

---

# 59. 压缩包安全

硬限制：

```text
max compressed size
max uncompressed size
max entry count
max nesting depth
max compression ratio
path traversal rejection
symlink rejection
device file rejection
```

---

# 60. Parser Sandbox

- 无默认互联网；
- 只读 Source Mount；
- 独立临时目录；
- CPU、内存、文件和时间限制；
- 禁止执行工程内程序；
- 禁止加载本地插件；
- 禁止启动 EDA GUI；
- 输出大小限制；
- 进程隔离；
- 结构化日志脱敏。

---

# 61. KiCad Adapter

模块：

```text
project JSON parser
S-expression lexer/parser
schematic semantic mapper
PCB semantic mapper
symbol library parser
footprint parser
rules/settings parser
legacy adapter
```

---

# 62. KiCad S-expression Parser

要求：

```text
UTF-8
quoted strings
escaped strings
numeric values
nested tokens
comments if present
unknown tokens
source span
token order
```

不要使用脆弱正则表达式解析完整文件。

---

# 63. KiCad Schematic Connectivity

步骤：

```text
instantiate sheets
→ resolve symbol pins
→ normalize coordinates
→ build geometric endpoints
→ apply junction semantics
→ attach labels
→ pass hierarchical ports
→ merge power/global nets
→ emit logical nets
```

每步可单独调试和重放。

---

# 64. KiCad PCB Connectivity

优先使用显式：

```text
net id
net name
pad net
track net
via net
zone net
```

几何只用于验证，不覆盖显式 Net Assignment。

---

# 65. Altium Adapter

模块：

```text
project metadata parser
CFB container reader
schematic record parser
PCB record parser
library parser
variant/parameter parser
rule/class parser
opaque record preservation
```

---

# 66. CFB Reader 安全

- 检查 Header；
- 限制 Stream Count；
- 限制 FAT/DIFAT 链；
- 检测循环；
- 限制 Stream Size；
- 不提取可执行内容；
- 未知 Stream 保存 Hash 和受控副本；
- 解析异常不得造成无限循环。

---

# 67. Altium Record 版本

每个 Record Parser：

```text
record type
version range
required fields
optional fields
unknown fields
source span
test fixtures
```

未知字段保留，不因新增字段使整个文件失败。

---

# 68. EasyEDA/JLCEDA Adapter

模块：

```text
standard JSON parser
compressed project parser
Pro ZIP/JSONL parser
schematic object mapper
PCB object mapper
library object mapper
shape string parser
attribute mapper
```

---

# 69. EasyEDA Shape 数据

标准版常见对象可能在 JSON 内包含顺序敏感的 Shape 字符串。

解析器必须：

```text
保存原始 Shape
按对象前缀分派
检查字段数量
允许未知尾字段
保留顺序
记录文档版本
```

不能简单按分隔符拆开后丢失转义和嵌套语义。

---

# 70. Connectivity Resolver

输入：

```text
symbol pin anchors
wires
junctions
labels
ports
sheet instances
power objects
```

输出：

```text
graph nodes
graph edges
connected components
canonical nets
diagnostics
```

---

# 71. Connectivity Graph Node

```text
pin_anchor
wire_endpoint
junction
label_anchor
sheet_port
bus_entry
no_connect
```

---

# 72. Connectivity 容差

```text
source exact coordinate
source grid
canonical epsilon
snap policy
```

默认优先源格式精确语义。

几何容差只用于处理合法格式舍入，不能把相邻但未接触对象连在一起。

---

# 73. Cross-document Linker

建立：

```text
schematic part ↔ PCB footprint
schematic pin ↔ PCB pad
logical net ↔ PCB net
project variant ↔ fitted instances
library definition ↔ instance
```

---

# 74. Link 状态

```text
explicit
verified
probable
ambiguous
missing
conflicting
```

只有 `explicit` 或 `verified` 可进入确定性下游。

---

# 75. 一致性检查

```text
duplicate refdes
missing footprint
orphan footprint
missing symbol
pin-pad mismatch
net mismatch
variant mismatch
board revision mismatch
library unresolved
outline invalid
layer mismatch
```

---

# 76. Revision Consistency

检查：

```text
project revision
schematic revision
PCB revision
BOM/CPL export metadata
Git commit
file timestamps
title block
```

Timestamp 只作证据，不单独决定一致性。

---

# 77. IR Storage

小项目：

```text
JSON + PostgreSQL index
```

大项目：

```text
JSONL / Arrow / Parquet
+ Object Storage
+ Relational index
```

图连接可选：

```text
PostgreSQL adjacency
```

---

# 78. Parse Job

```json
{
  "parse_job_id": "uuid",
  "source_package_id": "uuid",
  "requested_outputs": [
    "project_ir",
    "schematic_ir",
    "pcb_ir",
    "part_ir",
    "net_ir"
  ],
  "adapter_policy_version": "2026.07",
  "status": "queued"
}
```

---

# 79. Parse Result

```json
{
  "parse_job_id": "uuid",
  "status": "completed_with_warnings",
  "source_format": "kicad",
  "adapter": {
    "id": "kicad-sexpr",
    "version": "1.0.0"
  },
  "summary": {
    "documents": 12,
    "sheets": 8,
    "part_instances": 426,
    "footprints": 421,
    "logical_nets": 173,
    "pcb_nets": 171,
    "errors": 0,
    "warnings": 5
  },
  "outputs": {
    "project_ir_uri": "s3://...",
    "schematic_ir_uri": "s3://...",
    "pcb_ir_uri": "s3://...",
    "part_ir_uri": "s3://...",
    "net_ir_uri": "s3://...",
    "fidelity_report_uri": "s3://..."
  }
}
```

---

# 80. Parse 状态机

```text
RECEIVED
→ SECURITY_SCAN
→ UNPACKING
→ INVENTORYING
→ DETECTING_FORMAT
→ SELECTING_ADAPTER
→ PARSING_SOURCE
→ BUILDING_SOURCE_MODEL
→ MAPPING_CANONICAL_IR
→ RESOLVING_LIBRARIES
→ RESOLVING_CONNECTIVITY
→ LINKING_DOCUMENTS
→ VALIDATING
→ CALCULATING_FIDELITY
→ STORING_OUTPUTS
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_WARNINGS
PARTIAL
FORMAT_AMBIGUOUS
UNSUPPORTED_FORMAT
UNSUPPORTED_VERSION
SECURITY_BLOCKED
RESOURCE_LIMIT_EXCEEDED
SOURCE_CORRUPTED
LIBRARY_INCOMPLETE
CONNECTIVITY_INCOMPLETE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 81. 错误码

```text
SOURCE_PACKAGE_NOT_FOUND
SOURCE_PACKAGE_EMPTY
ARCHIVE_PATH_TRAVERSAL
ARCHIVE_BOMB_DETECTED
ARCHIVE_NESTING_LIMIT
MALWARE_DETECTED
FORMAT_NOT_DETECTED
FORMAT_AMBIGUOUS
FORMAT_UNSUPPORTED
FORMAT_VERSION_UNSUPPORTED
FILE_ENCODING_INVALID
SOURCE_FILE_CORRUPTED
PROJECT_ENTRY_NOT_FOUND
PROJECT_REFERENCE_MISSING
PARSER_SYNTAX_ERROR
PARSER_RESOURCE_LIMIT
UNKNOWN_RECORD_PRESERVED
LIBRARY_REFERENCE_UNRESOLVED
SYMBOL_DEFINITION_MISSING
FOOTPRINT_DEFINITION_MISSING
SHEET_REFERENCE_MISSING
HIERARCHY_CYCLE
DUPLICATE_REFDES
PIN_NUMBER_CONFLICT
PAD_NUMBER_CONFLICT
PIN_PAD_MAPPING_INCOMPLETE
SCHEMATIC_CONNECTIVITY_CONFLICT
PCB_CONNECTIVITY_CONFLICT
NET_CROSS_LINK_AMBIGUOUS
BOARD_OUTLINE_OPEN
BOARD_OUTLINE_AMBIGUOUS
LAYER_MAPPING_UNKNOWN
VARIANT_CONFLICT
IR_SCHEMA_VALIDATION_FAILED
OUTPUT_STORAGE_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 82. 数据库设计

## 82.1 `eda_source_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NULL
package_name VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
compressed_size_bytes BIGINT NOT NULL
uncompressed_size_bytes BIGINT NULL
asset_count INT NULL
security_status VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, sha256)
```

## 82.2 `eda_source_assets`

```text
id UUID PK
source_package_id UUID NOT NULL
relative_path TEXT NOT NULL
file_name TEXT NOT NULL
extension VARCHAR NULL
mime_type VARCHAR NULL
detected_format VARCHAR NULL
format_version VARCHAR NULL
editor_version VARCHAR NULL
size_bytes BIGINT NOT NULL
sha256 CHAR(64) NOT NULL
encoding VARCHAR NULL
entry_role VARCHAR NULL
security_status VARCHAR NOT NULL
storage_uri TEXT NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(source_package_id, relative_path)
```

## 82.3 `eda_format_detections`

```text
id UUID PK
source_package_id UUID NOT NULL
source_asset_id UUID NULL
candidate_format VARCHAR NOT NULL
adapter_id VARCHAR NULL
confidence NUMERIC(5,4) NOT NULL
evidence JSONB NOT NULL
conflicts JSONB NOT NULL
selected BOOLEAN NOT NULL
detected_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
```

## 82.4 `eda_parser_adapters`

```text
id UUID PK
adapter_id VARCHAR NOT NULL
adapter_version VARCHAR NOT NULL
format_family VARCHAR NOT NULL
supported_versions JSONB NOT NULL
capabilities JSONB NOT NULL
known_gaps JSONB NOT NULL
artifact_hash CHAR(64) NOT NULL
released_at TIMESTAMPTZ NOT NULL
deprecated_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(adapter_id, adapter_version)
```

## 82.5 `eda_parse_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
source_package_id UUID NOT NULL
requested_outputs JSONB NOT NULL
adapter_policy_version VARCHAR NOT NULL
selected_adapter_id VARCHAR NULL
selected_adapter_version VARCHAR NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
resource_policy_version VARCHAR NOT NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 82.6 `eda_parse_diagnostics`

```text
id UUID PK
parse_job_id UUID NOT NULL
source_asset_id UUID NULL
source_object_reference JSONB NULL
severity VARCHAR NOT NULL
category VARCHAR NOT NULL
diagnostic_code VARCHAR NOT NULL
message TEXT NOT NULL
details JSONB NOT NULL
source_location JSONB NULL
preservation_status VARCHAR NULL
created_at TIMESTAMPTZ
```

## 82.7 `eda_source_object_snapshots`

```text
id UUID PK
parse_job_id UUID NOT NULL
source_asset_id UUID NOT NULL
object_type VARCHAR NOT NULL
native_object_id VARCHAR NULL
source_path JSONB NULL
source_span JSONB NULL
raw_payload_uri TEXT NOT NULL
raw_payload_hash CHAR(64) NOT NULL
parser_object_version VARCHAR NOT NULL
opaque BOOLEAN NOT NULL
created_at TIMESTAMPTZ
```

## 82.8 `eda_ir_bundles`

```text
id UUID PK
parse_job_id UUID NOT NULL
tenant_id UUID NOT NULL
project_ir_version VARCHAR NOT NULL
schematic_ir_version VARCHAR NULL
pcb_ir_version VARCHAR NULL
part_ir_version VARCHAR NULL
net_ir_version VARCHAR NULL
constraint_ir_version VARCHAR NULL
variant_ir_version VARCHAR NULL
bundle_manifest_uri TEXT NOT NULL
bundle_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(parse_job_id, bundle_hash)
```

## 82.9 `eda_projects_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_project_id UUID NOT NULL
source_format VARCHAR NOT NULL
source_format_version VARCHAR NULL
source_tool VARCHAR NULL
source_tool_version VARCHAR NULL
project_name VARCHAR NULL
document_graph_uri TEXT NOT NULL
settings_uri TEXT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ir_bundle_id, canonical_project_id)
```

## 82.10 `eda_documents_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_document_id UUID NOT NULL
document_type VARCHAR NOT NULL
source_asset_id UUID NULL
relative_path TEXT NULL
native_document_id VARCHAR NULL
parent_document_id UUID NULL
root_document_id UUID NULL
hierarchy_path VARCHAR NULL
revision_hint VARCHAR NULL
units VARCHAR NULL
coordinate_system JSONB NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ir_bundle_id, canonical_document_id)
```

## 82.11 `eda_sheet_definitions_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_sheet_definition_id UUID NOT NULL
document_id UUID NOT NULL
name VARCHAR NULL
native_id VARCHAR NULL
page_number VARCHAR NULL
title_block JSONB NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.12 `eda_sheet_instances_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_sheet_instance_id UUID NOT NULL
sheet_definition_id UUID NOT NULL
parent_sheet_instance_id UUID NULL
instance_path VARCHAR NOT NULL
instance_parameters JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ir_bundle_id, instance_path)
```

## 82.13 `eda_symbol_definitions_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_symbol_definition_id UUID NOT NULL
library_identifier VARCHAR NULL
name VARCHAR NOT NULL
unit_count INT NOT NULL
alternate_representation_count INT NOT NULL
pins_uri TEXT NOT NULL
graphics_uri TEXT NOT NULL
properties JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.14 `eda_part_instances_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_part_instance_id UUID NOT NULL
logical_part_key VARCHAR NOT NULL
reference_designator VARCHAR NULL
value VARCHAR NULL
sheet_instance_id UUID NULL
symbol_definition_id UUID NULL
unit_instance_ids JSONB NOT NULL
footprint_instance_id UUID NULL
variant_status VARCHAR NOT NULL
raw_fields JSONB NOT NULL
manufacturer_raw VARCHAR NULL
mpn_raw VARCHAR NULL
exclude_from_bom BOOLEAN NOT NULL
exclude_from_board BOOLEAN NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ir_bundle_id, canonical_part_instance_id)
```

## 82.15 `eda_symbol_unit_instances_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_symbol_unit_instance_id UUID NOT NULL
part_instance_id UUID NOT NULL
unit_number INT NOT NULL
alternate_representation VARCHAR NULL
position JSONB NOT NULL
rotation NUMERIC NULL
mirrored BOOLEAN NOT NULL
properties JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.16 `eda_pins_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_pin_id UUID NOT NULL
symbol_definition_id UUID NULL
symbol_unit_instance_id UUID NULL
pin_number VARCHAR NULL
pin_name VARCHAR NULL
electrical_type VARCHAR NULL
graphical_shape VARCHAR NULL
position JSONB NULL
orientation NUMERIC NULL
length NUMERIC NULL
hidden BOOLEAN NOT NULL
stacked BOOLEAN NOT NULL
alternate_names JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.17 `eda_schematic_objects_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_object_id UUID NOT NULL
sheet_instance_id UUID NOT NULL
object_type VARCHAR NOT NULL
geometry JSONB NOT NULL
properties JSONB NOT NULL
electrical_semantics JSONB NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

对象类型包括：

```text
wire
bus
bus_entry
junction
label
global_label
hierarchical_label
sheet_pin
no_connect
text
graphic
image
```

## 82.18 `eda_nets_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_net_id UUID NOT NULL
net_domain VARCHAR NOT NULL
canonical_name VARCHAR NULL
raw_names JSONB NOT NULL
scope JSONB NOT NULL
source_native_net_ids JSONB NOT NULL
net_class_id UUID NULL
resolution_method VARCHAR NOT NULL
resolution_confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.19 `eda_net_endpoints_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_net_endpoint_id UUID NOT NULL
net_id UUID NOT NULL
endpoint_type VARCHAR NOT NULL
target_entity_id UUID NULL
target_identifier JSONB NOT NULL
sheet_instance_id UUID NULL
position JSONB NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.20 `eda_net_segments_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
net_id UUID NOT NULL
source_object_id UUID NOT NULL
segment_type VARCHAR NOT NULL
geometry JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.21 `eda_pcb_documents_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_pcb_id UUID NOT NULL
document_id UUID NOT NULL
units VARCHAR NOT NULL
coordinate_system JSONB NOT NULL
layer_count INT NULL
board_outline_status VARCHAR NOT NULL
stackup_status VARCHAR NOT NULL
metadata JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.22 `eda_layers_ir`

```text
id UUID PK
pcb_id UUID NOT NULL
canonical_layer_id VARCHAR NOT NULL
source_layer_id VARCHAR NULL
name VARCHAR NOT NULL
canonical_role VARCHAR NOT NULL
side VARCHAR NULL
layer_type VARCHAR NULL
order_index INT NULL
copper BOOLEAN NOT NULL
properties JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(pcb_id, canonical_layer_id)
```

## 82.23 `eda_stackup_layers_ir`

```text
id UUID PK
pcb_id UUID NOT NULL
sequence_index INT NOT NULL
layer_role VARCHAR NOT NULL
material VARCHAR NULL
thickness_mm NUMERIC NULL
copper_thickness_mm NUMERIC NULL
dielectric_constant NUMERIC NULL
loss_tangent NUMERIC NULL
source_completeness VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(pcb_id, sequence_index)
```

## 82.24 `eda_board_geometry_ir`

```text
id UUID PK
pcb_id UUID NOT NULL
geometry_type VARCHAR NOT NULL
contour_role VARCHAR NULL
geometry_uri TEXT NOT NULL
closed BOOLEAN NULL
validity_status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.25 `eda_footprint_instances_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
pcb_id UUID NOT NULL
canonical_footprint_instance_id UUID NOT NULL
reference_designator VARCHAR NULL
value VARCHAR NULL
library_identifier VARCHAR NULL
position JSONB NOT NULL
rotation NUMERIC NOT NULL
side VARCHAR NOT NULL
locked BOOLEAN NOT NULL
attributes JSONB NOT NULL
part_instance_id UUID NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.26 `eda_pads_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
footprint_instance_id UUID NOT NULL
canonical_pad_id UUID NOT NULL
pad_number VARCHAR NULL
pad_name VARCHAR NULL
pad_type VARCHAR NOT NULL
shape VARCHAR NOT NULL
position JSONB NOT NULL
size JSONB NOT NULL
rotation NUMERIC NOT NULL
layer_set JSONB NOT NULL
drill JSONB NULL
net_id UUID NULL
pin_id UUID NULL
properties JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.27 `eda_tracks_vias_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
pcb_id UUID NOT NULL
canonical_object_id UUID NOT NULL
object_type VARCHAR NOT NULL
geometry JSONB NOT NULL
width NUMERIC NULL
layer_id VARCHAR NULL
layer_span JSONB NULL
drill NUMERIC NULL
net_id UUID NULL
locked BOOLEAN NOT NULL
properties JSONB NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.28 `eda_zones_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
pcb_id UUID NOT NULL
canonical_zone_id UUID NOT NULL
net_id UUID NULL
layer_set JSONB NOT NULL
priority INT NULL
outline_uri TEXT NOT NULL
filled_geometry_uri TEXT NULL
clearance JSONB NULL
thermal JSONB NULL
keepout_flags JSONB NOT NULL
fill_status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.29 `eda_constraints_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_constraint_id UUID NOT NULL
constraint_type VARCHAR NOT NULL
scope JSONB NOT NULL
parameters JSONB NOT NULL
priority INT NULL
effectivity JSONB NOT NULL
resolution_status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.30 `eda_variants_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_variant_id UUID NOT NULL
name VARCHAR NOT NULL
scope JSONB NOT NULL
part_overrides_uri TEXT NOT NULL
effectivity JSONB NOT NULL
status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.31 `eda_library_definitions_ir`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
library_type VARCHAR NOT NULL
canonical_library_object_id UUID NOT NULL
library_identifier VARCHAR NULL
name VARCHAR NOT NULL
definition_uri TEXT NOT NULL
definition_hash CHAR(64) NOT NULL
resolution_source VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
source_refs JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 82.32 `eda_cross_document_links`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
link_type VARCHAR NOT NULL
source_entity_id UUID NOT NULL
target_entity_id UUID NOT NULL
link_status VARCHAR NOT NULL
link_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence JSONB NOT NULL
created_at TIMESTAMPTZ
```

Link Type：

```text
part_to_footprint
pin_to_pad
schematic_net_to_pcb_net
symbol_to_library
footprint_to_library
variant_to_part
```

## 82.33 `eda_source_maps`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
canonical_entity_type VARCHAR NOT NULL
canonical_entity_id UUID NOT NULL
source_asset_id UUID NOT NULL
native_object_id VARCHAR NULL
source_path JSONB NULL
source_span JSONB NULL
resolution_method VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 82.34 `eda_fidelity_reports`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
dimension_results JSONB NOT NULL
recognized_object_count BIGINT NOT NULL
normalized_object_count BIGINT NOT NULL
opaque_object_count BIGINT NOT NULL
dropped_object_count BIGINT NOT NULL
critical_gap_count INT NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ir_bundle_id, report_version)
```

## 82.35 `eda_validation_results`

```text
id UUID PK
ir_bundle_id UUID NOT NULL
validator_id VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
validation_type VARCHAR NOT NULL
status VARCHAR NOT NULL
issue_count INT NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 82.36 `eda_diff_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
left_ir_bundle_id UUID NOT NULL
right_ir_bundle_id UUID NOT NULL
diff_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
summary JSONB NULL
result_uri TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

---

# 83. 对象存储

```text
derived/eda-parser/
  {tenant_id}/{source_package_id}/
    source/
      original/
      manifest.json
      security-report.json
    parse/
      {parse_job_id}/
        detection/
          candidates.json
          selected-adapter.json
        source-model/
          ast/
          object-tree/
          opaque/
        canonical-ir/
          manifest.json
          project-ir.json
          documents.jsonl.zst
          schematic-ir.json.zst
          parts.jsonl.zst
          pins.jsonl.zst
          nets.jsonl.zst
          pcb-ir.json.zst
          footprints.jsonl.zst
          pads.jsonl.zst
          tracks-vias.jsonl.zst
          zones.jsonl.zst
          constraints.jsonl.zst
          variants.jsonl.zst
          libraries.jsonl.zst
          source-map.jsonl.zst
        validation/
          schema.json
          connectivity.json
          cross-document.json
          geometry.json
          variants.json
        reports/
          diagnostics.json
          completeness.json
          fidelity.json
          file-inventory.html
          parse-report.html
          parse-report.pdf
        debug/
          parser-trace.jsonl.zst
          connectivity-trace.jsonl.zst
          linking-trace.jsonl.zst
          resource-usage.json
    diffs/
      {diff_job_id}/
```

---

# 84. API 设计

## 84.1 Source Package

```text
POST /api/v1/eda/source-packages
POST /api/v1/eda/source-packages/from-git
GET  /api/v1/eda/source-packages/{id}
GET  /api/v1/eda/source-packages/{id}/assets
GET  /api/v1/eda/source-packages/{id}/security-report
```

## 84.2 Parse Jobs

```text
POST /api/v1/eda/parse-jobs
POST /api/v1/eda/parse-jobs/batch
GET  /api/v1/eda/parse-jobs/{id}
GET  /api/v1/eda/parse-jobs/{id}/events
POST /api/v1/eda/parse-jobs/{id}/cancel
POST /api/v1/eda/parse-jobs/{id}/retry
POST /api/v1/eda/parse-jobs/{id}/reparse
```

## 84.3 Detection 和 Inventory

```text
POST /api/v1/eda/source-packages/{id}/detect
GET  /api/v1/eda/source-packages/{id}/detections
GET  /api/v1/eda/source-packages/{id}/inventory
```

## 84.4 IR

```text
GET /api/v1/eda/ir-bundles/{id}
GET /api/v1/eda/ir-bundles/{id}/project
GET /api/v1/eda/ir-bundles/{id}/documents
GET /api/v1/eda/ir-bundles/{id}/schematics
GET /api/v1/eda/ir-bundles/{id}/parts
GET /api/v1/eda/ir-bundles/{id}/nets
GET /api/v1/eda/ir-bundles/{id}/pcb
GET /api/v1/eda/ir-bundles/{id}/constraints
GET /api/v1/eda/ir-bundles/{id}/variants
GET /api/v1/eda/ir-bundles/{id}/libraries
GET /api/v1/eda/ir-bundles/{id}/source-map
```

## 84.5 Query

```text
GET /api/v1/eda/ir-bundles/{id}/parts/{part_id}
GET /api/v1/eda/ir-bundles/{id}/refdes/{reference}
GET /api/v1/eda/ir-bundles/{id}/nets/{net_id}
GET /api/v1/eda/ir-bundles/{id}/where-used
GET /api/v1/eda/ir-bundles/{id}/connectivity
GET /api/v1/eda/ir-bundles/{id}/board-outline
GET /api/v1/eda/ir-bundles/{id}/placements
```

## 84.6 Validation

```text
POST /api/v1/eda/ir-bundles/{id}/validate
GET  /api/v1/eda/ir-bundles/{id}/diagnostics
GET  /api/v1/eda/ir-bundles/{id}/fidelity
GET  /api/v1/eda/ir-bundles/{id}/consistency
```

## 84.7 Diff

```text
POST /api/v1/eda/diffs
GET  /api/v1/eda/diffs/{id}
GET  /api/v1/eda/diffs/{id}/summary
GET  /api/v1/eda/diffs/{id}/details
```

## 84.8 Adapter Registry

```text
GET /api/v1/eda/adapters
GET /api/v1/eda/adapters/{id}
GET /api/v1/eda/adapters/{id}/capabilities
GET /api/v1/eda/adapters/{id}/health
```

## 84.9 Health

```text
GET /health/live
GET /health/ready
GET /metrics
```

---

# 85. 输入事件

```text
project.source-package.uploaded
project.git-revision.created
project.design-files.changed
project.reparse.requested
parser.adapter.released
parser.policy.changed
library.snapshot.updated
```

---

# 86. 输出事件

```text
eda.source-package.accepted
eda.source-package.security-blocked
eda.format.detected
eda.parse.started
eda.parse.progress
eda.parse.completed
eda.parse.completed-with-warnings
eda.parse.partial
eda.parse.failed
eda.ir.ready
eda.connectivity.ready
eda.design-consistency.issue-detected
eda.project-diff.ready
```

## `eda.ir.ready`

```json
{
  "event_type": "eda.ir.ready",
  "event_version": "1.0",
  "parse_job_id": "uuid",
  "ir_bundle_id": "uuid",
  "project_id": "uuid",
  "source_format": "kicad",
  "ir_versions": {
    "project": "1.0.0",
    "schematic": "1.0.0",
    "pcb": "1.0.0",
    "part": "1.0.0",
    "net": "1.0.0"
  },
  "fidelity_status": "substantially_complete",
  "manifest_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 87. JSON Schema

建议：

```text
schemas/
├── project-ir/
│   └── 1.0.0.json
├── schematic-ir/
│   └── 1.0.0.json
├── pcb-ir/
│   └── 1.0.0.json
├── part-ir/
│   └── 1.0.0.json
├── net-ir/
│   └── 1.0.0.json
├── constraint-ir/
├── variant-ir/
├── library-ir/
├── source-map/
└── parse-diagnostics/
```

每个 Schema：

- 禁止随意 Additional Properties，扩展进入 `extensions`；
- 使用 Decimal String 或整数内部单位处理精度；
- 坐标明确单位；
- ID 格式明确；
- Enum 可扩展时支持 `unknown` 和原始值；
- 保存 Schema Version。

---

# 88. 数值和精度

不得将所有数值直接用二进制 Float 存取再写回。

策略：

```text
source raw token
canonical decimal string
optional integer nanometer/micrometer internal form
```

坐标、角度、尺寸和钻孔保留源精度。

---

# 89. Canonical Geometry

基础：

```text
Point
LineString
Arc
Circle
Rectangle
Polygon
PolygonWithHoles
Bezier
TextBox
ImagePlacement
```

Arc 必须能表示：

```text
start/mid/end
center/radius/angles
```

并保留源表示方式。

---

# 90. Geometry Validation

```text
NaN/Infinity
invalid radius
zero-length
self-intersection
open contour
invalid polygon
unsupported custom pad primitive
```

不能因几何库自动修复而不记录变化。

---

# 91. Connectivity 验证

Golden Invariants：

```text
每个 Net Endpoint 只能属于适用 Scope 下的一个 Canonical Net
No-connect Pin 不应同时被连线
显式 Net ID 不应被几何覆盖
Hierarchical Port 应在父子实例间一致
Pin-Pad Link 应保持 Number Semantics
```

---

# 92. BOM 视图

由 Part IR 派生：

```text
reference
value
part identity raw fields
footprint
quantity
DNP
variant
source evidence
```

派生视图不是独立事实源，可由 IR 重建。

---

# 93. CPL 视图

由 PCB IR 派生：

```text
RefDes
X
Y
Rotation
Side
Footprint
Board Instance
Mount Status
```

坐标导出策略版本化。

---

# 94. Netlist 视图

支持：

```text
logical netlist
PCB netlist
pin-pad linked netlist
IPC-D-356-like test view optional
```

每个视图明确来源和完整度。

---

# 95. Project Diff

差异层级：

```text
file
document
sheet
part
field
pin
net
footprint
placement
pad
track
via
zone
constraint
variant
library
```

---

# 96. Semantic Diff

避免仅按行 Diff。

示例：

```text
RefDes moved
Footprint changed
Pin remapped
Net endpoint added
Track width changed
Zone priority changed
DNP changed
Variant alternate changed
```

---

# 97. Diff Identity Matching

优先：

```text
native UUID
stable canonical key
source path/native id
refdes + hierarchy
geometry/content fingerprint
```

Heuristic Match 必须标记。

---

# 98. 增量解析

输入变化：

```text
file hash
document graph
library snapshot
adapter version
IR schema
```

只重算受影响：

```text
document
sheet subtree
library dependency
connectivity component
cross-document links
```

V1 可先全量解析，但接口必须为增量预留。

---

# 99. Parser Cache

Cache Key：

```text
source asset hash
adapter id/version
parser policy version
library snapshot hash
IR schema version
```

---

# 100. Library Snapshot

为可重放解析保存：

```text
project-local libraries
approved global libraries
library tables
environment variables
resolved file hashes
```

没有 Snapshot 就不能保证未来 Reparse 结果一致。

---

# 101. Round-trip Readiness

等级：

```text
read_only
semantic_export_possible
same_format_partial_write
same_format_round_trip_validated
```

V1 默认：

```text
read_only
```

不要在未通过严格 Round-trip Test 前对用户声称可无损写回。

---

# 102. 可观测性

Metrics：

```text
eda_source_packages_total{format,status}
eda_source_assets_total{role,format}
eda_parse_jobs_total{adapter,status}
eda_parse_duration_seconds{adapter,step}
eda_parse_objects_total{adapter,type}
eda_parse_unknown_objects_total{adapter,type}
eda_parse_diagnostics_total{severity,category,code}
eda_library_resolution_rate{adapter}
eda_schematic_connectivity_rate{adapter}
eda_pin_pad_mapping_rate{adapter}
eda_net_cross_link_rate{adapter}
eda_board_outline_valid_rate{adapter}
eda_fidelity_status_total{adapter,status}
eda_parser_resource_usage{adapter,resource}
eda_parser_crashes_total{adapter}
eda_security_blocks_total{reason}
eda_diff_jobs_total{status}
```

---

# 103. Dashboard

```text
Parse Jobs
Format Distribution
Adapter Version
Parse Duration
Unknown/Unsupported Objects
Library Resolution
Schematic Connectivity
Pin-Pad Mapping
Schematic-PCB Net Match
Board Outline Validity
Variant Coverage
Fidelity by Project
Security Blocks
Parser Failures
Reparse Needed
```

---

# 104. Benchmark 设计

## Format Detection

```text
extension mismatch
magic bytes
mixed project
nested archive
ambiguous JSON
corrupted container
```

## KiCad

```text
hierarchical sheets
reused sheet instances
multi-unit symbols
hidden power pins
junction/crossing
bus/alias
symbol cache
footprints/custom pads
zones/keepouts
stack-up/rules
variants
```

## Altium

```text
project metadata
multi-sheet
component parameters
classes
rules
variants
SchLib/PcbLib
unknown records
CFB corruption
```

## EasyEDA/JLCEDA

```text
standard JSON
multi-page
shape strings
custom attributes
PCB JSON
compressed projects
Pro JSONL
unknown object types
```

## IR

```text
schema validation
stable ID
source map
numeric precision
opaque preservation
deterministic serialization
```

## Connectivity

```text
T junction
cross without junction
global/local/hierarchical labels
power nets
bus
stacked pins
anonymous nets
logical/physical linking
```

## Security

```text
Zip Slip
Zip Bomb
symlink
oversized stream
CFB cycle
deep JSON
path injection
malformed UTF-8
timeout
memory exhaustion
```

---

# 105. 初始质量目标

```text
Source Asset Hash Accuracy = 100%
Archive Path Traversal Escape = 0
Parser Execution of Embedded Code = 0
Known-format Detection Accuracy >= 99.99%
Raw Source Preservation = 100%
Unknown Important Object Preservation = 100%
IR Schema Validation = 100%
Deterministic Parse Hash = 100%
KiCad Explicit Net Assignment Accuracy = 100%
Schematic Connectivity Accuracy >= 99.99% on Golden Fixtures
Pin-Pad Explicit Mapping Accuracy = 100%
Board Outline Detection Accuracy >= 99.9%
DNP/Variant Preservation = 100%
Source Map Coverage >= 99.9% for normalized entities
Cross-document False Positive Link Rate <= 0.01%
Tenant/Project Isolation = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经测试的保证。

---

# 106. 测试集

公开仓库只使用开源、合成、脱敏或明确授权 Fixture。

## Intake/Security

1. Single file；
2. Directory；
3. ZIP；
4. Nested archive；
5. Zip Slip；
6. Symlink；
7. Zip Bomb；
8. Extension mismatch；
9. Corrupted file；
10. Oversized asset。

## KiCad Schematic

11. Flat schematic；
12. Hierarchy；
13. Reused child sheet；
14. Multi-unit；
15. Hidden power pin；
16. Global label；
17. Local label；
18. Hierarchical label；
19. Bus；
20. Bus alias；
21. Junction；
22. Wire crossing；
23. No connect；
24. Embedded symbol；
25. Missing external library；
26. DNP；
27. Alternate symbol；
28. Image/Text；
29. Legacy SCH；
30. Unknown future token。

## KiCad PCB

31. 2 layer；
32. 4 layer；
33. Stack-up；
34. Footprint；
35. Custom pad；
36. Through Via；
37. Blind Via；
38. Track Arc；
39. Zone；
40. Keepout；
41. Board Cutout；
42. Open Outline；
43. Differential Pair；
44. Length Rule；
45. 3D Model；
46. Locked footprint；
47. Mechanical pad；
48. Duplicate refdes；
49. Net conflict；
50. Unknown layer。

## Altium

51. PrjPcb；
52. SchDoc；
53. PcbDoc；
54. SchLib；
55. PcbLib；
56. IntLib inventory；
57. Hierarchy；
58. Multi-part；
59. Parameters；
60. Variants；
61. Classes；
62. Rules；
63. Rooms；
64. Polygon；
65. CFB unknown stream；
66. CFB cycle；
67. Future record；
68. Missing library；
69. ASCII export cross-check；
70. IPC-2581 cross-check。

## EasyEDA/JLCEDA

71. Standard schematic；
72. Multi-page；
73. Standard PCB；
74. Shape string；
75. Custom attribute；
76. Library object；
77. Compressed project；
78. Pro ZIP/JSONL；
79. Unknown shape；
80. Escaped delimiters；
81. DNP；
82. Net label；
83. Board outline；
84. Footprint/pad；
85. Import cross-check。

## Canonical IR

86. Schema；
87. Stable ID；
88. Source Map；
89. Deterministic serialization；
90. Numeric precision；
91. Part hierarchy；
92. Pin-pad mapping；
93. Logical/physical net；
94. Variant；
95. Opaque extension；
96. Semantic diff；
97. 100k objects；
98. 1M objects；
99. Cancellation；
100. Replay。

---

# 107. 性能要求

常规项目：

```text
100 schematic sheets
10,000 part instances
200,000 PCB primitives
```

目标：

```text
Format Detection P95 < 1 s
Security Inventory P95 < 5 s for 500 MB package
KiCad Full Parse P95 < 30 s
Canonical Query P95 < 500 ms
```

大型项目：

```text
1,000 sheets
100,000 parts
5,000,000 PCB primitives
```

需要：

- 流式 Lexer；
- 增量 JSON/JSONL；
- CFB Stream 按需读取；
- 分块写对象存储；
- 批量数据库导入；
- 不在内存复制全部几何；
- 可取消；
- Resource Budget；
- Backpressure；
- 大型 Geometry 使用 Arrow/Parquet。

---

# 108. 安全与权限

- 原始工程、库、3D、固件和附件按项目隔离；
- Source Package 只读；
- Parser Worker 无默认公网；
- 不执行脚本、宏、插件或 Output Job；
- 不自动运行 KiCad/Altium/EasyEDA；
- 可选 KiCad CLI 验证在独立受控容器执行；
- CFB/ZIP/JSON 解析有资源限制；
- Native Design 文件不进入公共日志；
- 诊断信息避免泄露路径和用户名；
- 下载使用短期签名 URL；
- Library Resolution 仅访问授权 Snapshot；
- 解析 Worker 不读取生产 Secret；
- 第三方 Parser 依赖固定版本并做供应链扫描；
- 对象存储加密；
- IR API 逐租户和项目鉴权；
- Source Map 可能暴露私有路径，按权限展示；
- 不将工程文件、原理图、PCB 和库发送给外部通用模型；
- 公开测试只使用开源或授权工程；
- 原始文件和审计记录按保留策略管理。

---

# 109. 推荐技术栈

核心服务：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Temporal
```

解析：

```text
自定义或 PEG/recursive-descent S-expression parser
orjson / simdjson
olefile 或受控 CFB Reader
zipfile + hardened policy
```

几何：

```text
Shapely / GEOS
pyclipper optional
```

批量：

```text
Polars
PyArrow
DuckDB
```

图：

```text
NetworkX only for small validation fixtures
custom adjacency / PostgreSQL for production
```

验证：

```text
JSON Schema
KiCad CLI optional independent validation
```

Rust 优化可选：

```text
Lexer
large geometry
CFB
connectivity
```

V1 不需要 LLM。

---

# 110. 推荐仓库结构

```text
eda-project-parser-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── eda-project-parser-agent-spec.md
│   ├── canonical-ir-overview.md
│   ├── project-ir.md
│   ├── schematic-ir.md
│   ├── pcb-ir.md
│   ├── part-ir.md
│   ├── net-ir.md
│   ├── constraint-variant-library-ir.md
│   ├── source-map-and-fidelity.md
│   ├── safe-intake-and-sandbox.md
│   ├── kicad-adapter.md
│   ├── altium-adapter.md
│   ├── easyeda-jlceda-adapter.md
│   ├── connectivity-resolver.md
│   ├── cross-document-linker.md
│   ├── semantic-diff.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-raw-source-source-model-canonical-ir-separated.md
│       ├── 0002-connectivity-is-not-visual-proximity.md
│       ├── 0003-unknown-records-are-preserved.md
│       ├── 0004-project-and-instance-hierarchy-separated.md
│       ├── 0005-logical-and-physical-nets-separated.md
│       ├── 0006-v1-is-read-only.md
│       └── 0007-library-resolution-is-snapshot-based.md
├── src/
│   └── eda_parser/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── source.py
│       │   ├── project_ir.py
│       │   ├── schematic_ir.py
│       │   ├── pcb_ir.py
│       │   ├── part_ir.py
│       │   ├── net_ir.py
│       │   ├── constraint_ir.py
│       │   ├── variant_ir.py
│       │   ├── library_ir.py
│       │   ├── source_map.py
│       │   └── diagnostics.py
│       ├── intake/
│       │   ├── upload.py
│       │   ├── archive.py
│       │   ├── inventory.py
│       │   ├── hashing.py
│       │   ├── malware.py
│       │   └── limits.py
│       ├── detection/
│       │   ├── registry.py
│       │   ├── signatures.py
│       │   ├── candidates.py
│       │   └── selector.py
│       ├── adapters/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── manifests.py
│       │   ├── kicad/
│       │   │   ├── project.py
│       │   │   ├── sexpr/
│       │   │   │   ├── lexer.py
│       │   │   │   ├── parser.py
│       │   │   │   ├── ast.py
│       │   │   │   └── source_span.py
│       │   │   ├── schematic.py
│       │   │   ├── pcb.py
│       │   │   ├── symbols.py
│       │   │   ├── footprints.py
│       │   │   ├── rules.py
│       │   │   └── legacy.py
│       │   ├── altium/
│       │   │   ├── project.py
│       │   │   ├── cfb.py
│       │   │   ├── records.py
│       │   │   ├── schematic.py
│       │   │   ├── pcb.py
│       │   │   ├── libraries.py
│       │   │   ├── variants.py
│       │   │   ├── rules.py
│       │   │   └── opaque.py
│       │   └── easyeda/
│       │       ├── detection.py
│       │       ├── standard.py
│       │       ├── pro.py
│       │       ├── shape_parser.py
│       │       ├── schematic.py
│       │       ├── pcb.py
│       │       └── libraries.py
│       ├── source_model/
│       ├── mapping/
│       │   ├── project.py
│       │   ├── schematic.py
│       │   ├── pcb.py
│       │   ├── parts.py
│       │   ├── nets.py
│       │   ├── constraints.py
│       │   ├── variants.py
│       │   └── libraries.py
│       ├── connectivity/
│       │   ├── graph.py
│       │   ├── coordinates.py
│       │   ├── junctions.py
│       │   ├── labels.py
│       │   ├── hierarchy.py
│       │   ├── buses.py
│       │   ├── resolver.py
│       │   └── trace.py
│       ├── linking/
│       │   ├── parts_footprints.py
│       │   ├── pins_pads.py
│       │   ├── nets.py
│       │   ├── libraries.py
│       │   └── confidence.py
│       ├── geometry/
│       │   ├── primitives.py
│       │   ├── transforms.py
│       │   ├── outlines.py
│       │   ├── polygons.py
│       │   └── validation.py
│       ├── validation/
│       │   ├── schema.py
│       │   ├── schematic.py
│       │   ├── pcb.py
│       │   ├── connectivity.py
│       │   ├── consistency.py
│       │   └── fidelity.py
│       ├── diff/
│       │   ├── identity.py
│       │   ├── semantic.py
│       │   └── reports.py
│       ├── storage/
│       ├── jobs/
│       ├── events/
│       ├── security/
│       └── observability/
├── schemas/
├── adapter-manifests/
├── policies/
├── migrations/
├── tests/
│   ├── fixtures/
│   │   ├── kicad/
│   │   ├── altium/
│   │   ├── easyeda/
│   │   └── security/
├── benchmark/
└── scripts/
    ├── inspect_eda_package.py
    ├── detect_eda_format.py
    ├── parse_eda_project.py
    ├── validate_ir_bundle.py
    ├── inspect_connectivity.py
    ├── compare_eda_projects.py
    ├── replay_parse_job.py
    ├── verify_source_map.py
    └── run_eda_parser_benchmark.py
```


---

# 111. Codex 分阶段实施

不要让 Codex 一次实现 KiCad、Altium、嘉立创EDA、全部连通性、所有库解析和语义 Diff。

## Phase 0：仓库侦察与格式资产盘点

Codex 必须检查：

1. 当前仓库是否已经存在 EDA Parser、Viewer、BOM Parser、KiCad Reader 或转换代码；
2. 当前支持的 KiCad 版本和文件；
3. 当前 Altium、EasyEDA/JLCEDA 导入代码；
4. 当前 `parseKicadSym`、`parseKicadMod`、KiCad Viewer、Gerber Parser 和 3D Viewer；
5. 当前工程上传、ZIP 解包、对象存储和文件 Hash；
6. 当前 Project、Schematic、PCB、Part、Net 数据结构；
7. 当前 Symbol、Footprint、3D、Library Mapping；
8. 当前 BOM、CPL、Netlist 和 DNP；
9. 当前 Hierarchical Sheet、Multi-unit、Variant 和 Design Rule；
10. 当前坐标、单位、旋转和层映射；
11. 当前 Source Map、诊断和完整度；
12. 当前 Git、Revision、Diff 和文件版本；
13. 当前 Parser Sandbox 和资源限制；
14. 当前 Zip Slip、Zip Bomb、CFB、JSON 深度和恶意文件防护；
15. 当前 API、Queue、Worker、Object Storage 和 Database；
16. 当前 Agent 31、32、43、44、45 的数据契约；
17. 当前测试工程、开源 Fixture 和授权情况；
18. 统计工程格式、版本、文件缺失和解析失败；
19. 抽样分析脱敏、开源或合成工程；
20. 不修改业务代码；
21. 不创建 Migration；
22. 不安装依赖；
23. 不执行任何工程脚本或插件；
24. 不读取用户机器全局库；
25. 不读取或打印生产 Secret。

## Phase 1：Canonical IR 和 JSON Schema

实现：

- Project IR；
- Document Graph；
- Schematic IR；
- PCB IR；
- Part IR；
- Net IR；
- Constraint IR；
- Variant IR；
- Library IR；
- Geometry；
- Source Map；
- Diagnostic；
- Fidelity；
- JSON Schema；
- Versioning。

## Phase 2：Safe Intake 和 Source Inventory

实现：

- Upload；
- ZIP/Directory；
- Path Normalization；
- Zip Slip；
- Zip Bomb；
- Symlink；
- Size/Entry/Nesting Limits；
- Hash；
- Source Asset Inventory；
- Immutable Storage；
- Malware Hook。

## Phase 3：Adapter Registry 和 Format Detection

实现：

- Adapter Manifest；
- Signature；
- Extension；
- Magic；
- Top-level Token；
- Candidate；
- Confidence；
- Conflict；
- Version Detection；
- Unsupported/Unknown；
- Adapter Health。

## Phase 4：KiCad S-expression Core

实现：

- Lexer；
- Parser；
- AST；
- Source Span；
- UTF-8；
- Numbers；
- Strings；
- Unknown Token；
- Deterministic Serialization；
- Resource Limits；
- Golden Tests。

## Phase 5：KiCad Project 和 Library Tables

实现：

- `.kicad_pro`；
- Document Inventory；
- Project Settings；
- Text Variables；
- Library Tables；
- Design Rule Reference；
- Source Asset Links；
- Missing Reference Diagnostics。

## Phase 6：KiCad Symbol 和 Footprint Libraries

实现：

- `.kicad_sym`；
- `.kicad_mod`；
- Symbol Units；
- Pins；
- Graphics；
- Footprint Pads；
- Custom Pads；
- Properties；
- 3D References；
- Embedded vs External；
- Library Snapshot。

## Phase 7：KiCad Schematic Semantic Model

实现：

- Root Sheet；
- Sheet Definition/Instance；
- Hierarchy Path；
- Symbol Definition/Instance；
- Multi-unit；
- Fields；
- Wire；
- Junction；
- Labels；
- Ports；
- Buses；
- No-connect；
- Source Map。

## Phase 8：KiCad Connectivity Resolver

实现：

- Coordinate Normalization；
- Pin Anchors；
- Wire Graph；
- Junction Semantics；
- Crossing without Junction；
- Local/Global/Hierarchical Labels；
- Power Nets；
- Sheet Port Passage；
- Bus Members；
- Diagnostics；
- Golden Netlists。

## Phase 9：KiCad PCB Semantic Model

实现：

- Layers；
- Stack-up；
- Board Outline；
- Footprints；
- Pads；
- Tracks/Arcs；
- Vias；
- Zones；
- Keepouts；
- Dimensions；
- Graphics；
- Groups；
- Rules；
- Net Classes；
- Diff Pairs；
- 3D References。

## Phase 10：KiCad Cross-document Link

实现：

- Part ↔ Footprint；
- Pin ↔ Pad；
- Logical Net ↔ PCB Net；
- RefDes；
- Net IDs；
- Conflicts；
- Orphans；
- Fidelity；
- BOM/CPL Views。

## Phase 11：KiCad Legacy Adapter

实现：

- 独立 Detection；
- Legacy Project/Schematic/Library；
- Legacy PCB where needed；
- Conversion Diagnostics；
- Opaque Preservation；
- 不与现代 Parser 混杂。

## Phase 12：EasyEDA/JLCEDA Standard Adapter

实现：

- JSON Detection；
- Multi-page；
- Schematic Object；
- Shape Parser；
- PCB Object；
- Libraries；
- Attributes；
- Nets；
- Footprints/Pads；
- Unknown Shape；
- Source Map。

## Phase 13：EasyEDA/JLCEDA Pro Adapter

实现：

- ZIP/JSONL Detection；
- Project Manifest；
- Record Streaming；
- Schematic/PCB；
- Libraries；
- Version Manifest；
- Unknown Record；
- Resource Limits；
- Golden Fixtures。

## Phase 14：Altium CFB Core

实现：

- Header；
- FAT/DIFAT；
- Directory；
- Stream；
- Mini-stream；
- Cycle/Bounds；
- Resource Limits；
- Stream Inventory；
- Unknown Stream Preservation；
- Security Tests。

## Phase 15：Altium Project、Schematic 和 Libraries

实现：

- `.PrjPcb`；
- Sheet/Hierarchy；
- Components；
- Multi-part；
- Pins；
- Wires/Ports/Labels；
- Parameters；
- SchLib；
- Variants；
- Source Map；
- Opaque Records。

## Phase 16：Altium PCB 和 Rules

实现：

- Board；
- Layers；
- Components；
- Pads；
- Tracks；
- Vias；
- Polygons；
- Rooms；
- Classes；
- Rules；
- PcbLib；
- Net Mapping；
- Unknown Records；
- Cross-check Fixtures。

## Phase 17：Cross-format Canonical Validation

实现：

- Same Design in Multiple Formats；
- Part Count；
- RefDes；
- Pin/Pad；
- Net Endpoint；
- Board Dimensions；
- Placement；
- Layer；
- Rules；
- Differences；
- Fidelity；
- Source-specific Loss。

## Phase 18：Source Map、Opaque 和 Fidelity

实现：

- Canonical-to-source；
- Native ID；
- Path/Span；
- Opaque Extension；
- Lost Object Detection；
- Completeness Dimensions；
- Human-readable Report；
- No False Complete。

## Phase 19：Semantic Diff

实现：

- Stable Identity；
- File/Document；
- Part；
- Field；
- Pin；
- Net；
- Placement；
- Pad；
- Track/Via/Zone；
- Constraint；
- Variant；
- Library；
- Heuristic Match Marking。

## Phase 20：Incremental Parse 和 Cache

实现：

- Asset Hash；
- Dependency Graph；
- Library Snapshot；
- Adapter/Schema Key；
- Partial Reparse；
- Connectivity Invalidation；
- Cache；
- Rebuild；
- Deterministic Result。

## Phase 21：API、Jobs、Events 和 Storage

实现：

- Source Package API；
- Parse Jobs；
- Progress；
- Cancel/Retry；
- IR Query；
- Validation；
- Diff；
- Object Storage；
- Streaming；
- Pagination；
- Access Control。

## Phase 22：Downstream Contracts

实现：

- Agent 31 BOM Contract；
- Agent 32 Raw Identity Contract；
- Agent 43 Design/NPI Contract；
- Agent 44 Manufacturing Preflight Contract；
- Agent 45 RefDes/Pin/Pad/Net Contract；
- Event Version；
- Contract Fixtures；
- Compatibility Tests。

## Phase 23：Parser Sandbox 和 Supply-chain Security

实现：

- Isolated Worker；
- Read-only Mount；
- No Network；
- CPU/Memory/File Limit；
- Timeout；
- Dependency Pinning；
- SBOM；
- Vulnerability Scan；
- Egress Policy；
- Audit。

## Phase 24：Benchmark、监控和生产发布

实现：

- Golden Projects；
- Security Corpus；
- Parser Fuzzing；
- Connectivity Benchmark；
- Large Project Load；
- Metrics；
- Dashboard；
- Adapter Feature Flag；
- Version Rollback；
- Replay；
- Disaster Recovery。

## Phase 25：受控导出和 Round-trip，可选

只有只读解析稳定后：

- Canonical IR → KiCad Draft；
- Same-format Patch DSL；
- Source-aware Patches；
- Round-trip Diff；
- KiCad CLI Validation；
- No Altium/EasyEDA Write Claim without Tests；
- Human Approval；
- Never Overwrite Source。

---

# 112. Codex 工作纪律

Codex 必须：

1. Raw Source、Source Object Model 和 Canonical IR 分开；
2. Project、Document、Definition 和 Instance 分开；
3. Sheet Definition 与 Sheet Instance 分开；
4. Symbol Definition、Part Instance 和 Symbol Unit 分开；
5. Footprint Definition 与 Footprint Instance 分开；
6. Schematic Logical Net 与 PCB Physical Net 分开；
7. Net Name 相同不足以自动 Cross-link；
8. Wire 几何对象不等于 Net；
9. 交叉线无 Junction 不连接；
10. Junction 语义优先于视觉猜测；
11. Hidden Pin 和 Power Pin 按源格式处理；
12. No-connect 是设计意图；
13. Bus 和 Net Member 分开；
14. Multi-unit Symbol 合并但保留 Unit；
15. RefDes Scope 和 Hierarchy 必须参与；
16. Part、Symbol、Footprint、Procurement Identity 分开；
17. Manufacturer/MPN Raw Fields 全部保留；
18. Agent 16不自行选择 Canonical MPN；
19. DNP、Exclude、Variant 分开；
20. Source Coordinates 和 Canonical Coordinates 分开；
21. 坐标单位和旋转约定显式；
22. 数值保留原始 Token 和精度；
23. Board Outline 不自动脑补闭合；
24. Track 几何交叉不自动连接；
25. PCB 显式 Net Assignment 优先；
26. Zone Outline 和 Filled Geometry 分开；
27. Stack-up Unknown 不从 Layer Count 猜；
28. Differential Pair 显式来源优先；
29. 3D 路径不从公网自动下载；
30. Library Resolution 只使用授权 Snapshot；
31. Missing Library 不丢失 Embedded/Cached Definition；
32. 未知 Token、Record、Stream 和 Shape 必须保留；
33. Unsupported 不等于忽略；
34. Opaque Object 必须计入 Fidelity；
35. Dropped Object 必须为零或显式报告；
36. Complete 不能只按 Parser 未崩溃判断；
37. Source Map 尽可能覆盖所有 Canonical Entity；
38. Stable ID 必须注明等级；
39. Heuristic Link 不得作为确定事实；
40. Parser 结果必须可重放；
41. Adapter Version、IR Version 和 Library Snapshot 必须保存；
42. Parser Upgrade 不覆盖历史 Bundle；
43. V1 只读；
44. 不通过正则解析完整 S-expression；
45. 不通过字符串 Split 粗暴解析 EasyEDA Shape；
46. CFB 链必须做循环和边界检查；
47. ZIP/JSON/CFB 需要资源限制；
48. 不执行工程内脚本、宏、插件或命令；
49. 不启动用户工程中的 Output Job；
50. 不读取用户主机任意全局库；
51. 不将工程文件发送给外部通用模型；
52. 公开 Fixture 必须开源、合成、脱敏或授权；
53. 不伪造 Format 支持、解析完整度、Net 数、测试或 Benchmark；
54. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter/Format 变化；
    - 测试命令；
    - 真实结果；
    - Object Coverage；
    - Connectivity Accuracy；
    - Source Map Coverage；
    - Fidelity；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 113. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/eda-project-parser-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第16个 Agent：

KiCad/EDA Project Parsing & Canonical IR Agent /
KiCad/EDA 工程解析 Agent。

本 Agent 安全解析：

- KiCad Project、Schematic、PCB、Symbol、Footprint 和 Rule；
- Altium Project、SchDoc、PcbDoc、SchLib、PcbLib、Variant 和 Rule；
- 嘉立创EDA/EasyEDA 标准版 JSON 工程；
- 嘉立创EDA/EasyEDA 专业版 ZIP/JSONL 工程；

并生成统一：

- Project IR；
- Schematic IR；
- PCB IR；
- Part IR；
- Net IR；
- Constraint IR；
- Variant IR；
- Library IR；
- Geometry IR；
- Source Map；
- Parse Diagnostics；
- Fidelity Report。

本 Agent只读解析，不自动修改设计，不自动生成连线，不自动猜 MPN，不自动写回源工程，不使用 LLM 构建连通性。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. docs/eda-project-parser-agent-spec.md；
3. 当前 EDA Viewer、Parser、BOM、Gerber 和 KiCad 代码；
4. 当前 parseKicadSym、parseKicadMod、KiCad PCB/Schematic Reader；
5. 当前 Project、Schematic、PCB、Part、Net 数据模型；
6. 当前 Symbol、Footprint、3D 和 Library Mapping；
7. 当前 BOM、CPL、Netlist、DNP 和 Variant；
8. 当前工程上传、ZIP、Object Storage、Hash 和 Git；
9. 当前 KiCad/Altium/EasyEDA 文件和测试 Fixture；
10. 当前坐标、单位、旋转、Layer 和 Geometry；
11. 当前 Hierarchy、Multi-unit、Junction、Label、Bus 和 Connectivity；
12. 当前 Source Map、Diagnostic、Fidelity 和 Diff；
13. 当前 Sandbox、Security、Queue、Worker、Database；
14. 当前 Agent 31、32、43、44、45 数据契约；
15. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Raw Source / Source Model / Canonical IR 分层；
- Project/Document/Definition/Instance 分开；
- Sheet Definition/Instance 分开；
- Symbol Definition/Part/Unit 分开；
- Logical Net/Physical Net 分开；
- 同名 Net 不自动 Cross-link；
- Wire 不等于 Net；
- Cross without Junction 不连接；
- No-connect 是意图；
- Bus/Net Member 分开；
- Multi-unit 保留 Unit；
- RefDes 和 Hierarchy 参与；
- Part/Symbol/Footprint/Procurement Identity 分开；
- Raw Manufacturer/MPN Fields 全保留；
- 不自行确定 Canonical MPN；
- DNP/Exclude/Variant 分开；
- Source/Canonical Coordinate 分开；
- 单位和 Rotation 明确；
- 原始数值精度保留；
- Board Outline 不脑补；
- PCB 显式 Net 优先；
- Zone Outline/Fill 分开；
- Stack-up Unknown 不猜；
- Library 只从授权 Snapshot 解析；
- Unknown Token/Record/Shape/Stream 保留；
- Unsupported 不静默丢弃；
- Fidelity 显式；
- Stable ID 标注等级；
- Heuristic Link 不作为确定事实；
- Adapter/IR/Library Snapshot 版本化；
- V1 Read-only；
- 不用正则解析完整 S-expression；
- 不粗暴 Split EasyEDA Shape；
- CFB 做循环和边界检查；
- ZIP/JSON/CFB 资源限制；
- 不执行脚本、宏、插件和 Output Job；
- 不启动 EDA GUI；
- 不访问任意全局库和公网；
- 不把工程文件发送给外部通用模型；
- 不用真实私有工程做公开 Fixture；
- 不伪造支持、完整度、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 查找所有 EDA Parser、Viewer、Importer 和 Converter；
3. 查找 KiCad Project/Schematic/PCB/Symbol/Footprint；
4. 查找 Altium/EasyEDA/JLCEDA；
5. 查找 Gerber/BOM/CPL/Netlist；
6. 查找现有 Domain Model；
7. 查找 Hierarchy/Multi-unit/Connectivity；
8. 查找 Symbol/Footprint/3D/Library Resolution；
9. 查找 Coordinate/Unit/Rotation/Layer；
10. 查找 DNP/Variant/Custom Fields；
11. 查找 Source Map/Diagnostic/Fidelity；
12. 查找 Upload/ZIP/Hash/Object Storage；
13. 查找 Git/Revision/Diff；
14. 查找 Sandbox/Resource Limit/Security；
15. 查找 Queue/Worker/API/Database；
16. 查找 Agent 31/32/43/44/45 Contracts；
17. 统计支持格式和实际完成程度；
18. 统计 Unknown、Unsupported、Missing Library 和 Parse Failures；
19. 抽样分析开源、合成、脱敏或授权工程；
20. 在 docs/eda-parser-implementation-plan.md 中生成实施计划；
21. 在 docs/canonical-ir-overview.md 中定义 IR 总体；
22. 在 docs/project-ir.md 中定义 Project IR；
23. 在 docs/schematic-ir.md 中定义 Schematic IR；
24. 在 docs/pcb-ir.md 中定义 PCB IR；
25. 在 docs/part-ir.md 中定义 Part IR；
26. 在 docs/net-ir.md 中定义 Net IR；
27. 在 docs/constraint-variant-library-ir.md 中定义其他 IR；
28. 在 docs/source-map-and-fidelity.md 中定义证据和完整度；
29. 在 docs/safe-intake-and-sandbox.md 中定义安全；
30. 在 docs/kicad-adapter.md 中定义 KiCad；
31. 在 docs/altium-adapter.md 中定义 Altium；
32. 在 docs/easyeda-jlceda-adapter.md 中定义嘉立创EDA；
33. 在 docs/connectivity-resolver.md 中定义连通性；
34. 在 docs/cross-document-linker.md 中定义跨文档映射；
35. 在 docs/semantic-diff.md 中定义 Diff；
36. 在 docs/eda-parser-migration-plan.md 中定义旧数据迁移；
37. 在 docs/eda-parser-benchmark-plan.md 中定义 Benchmark；
38. 给出拟新增、拟修改和拟复用文件；
39. 给出 Phase 1 精确范围；
40. 不修改业务代码；
41. 不创建数据库 Migration；
42. 不安装依赖；
43. 不执行任何工程文件；
44. 不读取或打印生产 Secret；
45. 运行当前仓库已有 lint、type check、test、build 和 security scan；
46. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- 现有格式支持矩阵；
- 现有 Parser/Viewer 能力；
- Project/Schematic/PCB/Part/Net IR；
- Source Model 和 Source Map；
- KiCad Adapter；
- Altium Adapter；
- EasyEDA/JLCEDA Adapter；
- Connectivity；
- Cross-document Link；
- Library Resolution；
- Geometry/Coordinate；
- Variant/DNP；
- Fidelity/Diagnostics；
- Security/Sandbox；
- API/Events；
- Agent 31/32/43/44/45 Contract；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 114. 后续 Phase 提示词模板

```text
继续实现 EDA Project Parser Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16 规格；
3. 阅读 EDA Parser Implementation Plan；
4. 阅读 IR、Adapter、Connectivity、Linking、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Raw/Source Model/Canonical IR Separation；
- Definition/Instance Separation；
- Logical/Physical Net Separation；
- Source Map；
- Unknown Preservation；
- Deterministic Parse；
- Versioned Adapter/Schema；
- No Guessing Connectivity；
- Read-only V1；
- Safe Intake/Sandbox；
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
9. parser fixture test；
10. connectivity test；
11. deterministic replay test；
12. security/fuzz test；
13. performance test；
14. benchmark；
15. 更新文档；
16. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Adapter/Format 变化；
- 测试命令和真实结果；
- Object Coverage；
- Connectivity Accuracy；
- Source Map Coverage；
- Fidelity；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 115. MVP 演示流程

1. 上传一个包含 KiCad 工程的 ZIP；
2. Safe Intake 检查路径和压缩比例；
3. 生成 Source Asset Inventory；
4. 检测 `.kicad_pro`、`.kicad_sch`、`.kicad_pcb`；
5. 选择 `kicad-sexpr` Adapter；
6. 解析 Project Settings 和 Library Tables；
7. 解析 Root Schematic；
8. 解析两个层级子页；
9. 同一个子页被实例化两次；
10. 建立两个不同 Sheet Instance Path；
11. 解析一个多单元运放 U1A/U1B；
12. 将两个 Unit 合并到一个 Part Instance；
13. 解析 Hidden Power Unit；
14. 解析 Wire、Junction 和 Label；
15. 一处 Wire Cross 没有 Junction；
16. Connectivity Resolver 不连接该交叉点；
17. 解析 Global +3V3；
18. 解析 Local Net；
19. 输出 Logical Net IR；
20. 解析 PCB Layers 和 Stack-up；
21. 解析 Footprint、Pad、Track、Via 和 Zone；
22. 识别 Board Outline 和 Cutout；
23. 映射 U1 Part 到 PCB Footprint；
24. 映射 Symbol Pin 到 Pad；
25. 映射 Logical Net 到 PCB Net；
26. 发现两个原理图器件没有 PCB Footprint；
27. Fidelity Report 标记 Cross-document Gap；
28. 从 Part IR 生成 BOM View；
29. 从 PCB IR 生成 CPL View；
30. 查询 U1 的所有 Pins、Pads 和 Nets；
31. 查询某 Net 的全部原理图端点和 PCB 对象；
32. 修改一个电阻 Value 和 Footprint；
33. 上传新 Revision；
34. Semantic Diff 显示 Value/Footprint 变化；
35. 原始文件和旧 IR Bundle 不被覆盖；
36. 再上传一个 EasyEDA Standard 工程；
37. 生成相同 Canonical IR；
38. 使用跨格式 Fixture 比较 Part/Net/Board 数；
39. 一个未知 Shape 被保存为 Opaque Extension；
40. 发布 `eda.ir.ready`。

---

# 116. 生产上线顺序

第一阶段：

```text
Safe Intake
Canonical IR
KiCad 6+ Project/Schematic/PCB
Symbol/Footprint
Connectivity
Part/Net/Placement
Source Map
Read-only API
```

第二阶段：

```text
EasyEDA/JLCEDA Standard
KiCad Legacy
Variant/Constraint
Semantic Diff
Large Project
Downstream Contracts
```

第三阶段：

```text
EasyEDA Pro
Altium Project/Schematic/PCB
Advanced Rules
Incremental Parse
Round-trip KiCad Draft
```

上线优先确保：

```text
文件是什么格式
对象来自哪里
线到底有没有连接
同一个器件在原理图和 PCB 中是否对应
解析不了的内容有没有被明确保留和报告
```

宁可把一个未来版本的 Altium Record 标成 `unknown_record_preserved`，也不要为了让“解析成功率”好看，直接跳过去。EDA 解析最危险的不是报错，而是安静地漏掉一根线、一个 Pad 或一个 Variant，然后把一份结构完整、语义错误的 IR 交给后面的 BOM、制造和质量系统。
