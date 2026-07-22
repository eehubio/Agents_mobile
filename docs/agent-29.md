# 生产文件生成 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：29  
> Agent 名称：PCB Manufacturing Release, Fabrication & Assembly Package Generation Agent  
> 中文名称：生产文件生成 Agent  
> 类型：程序型  
> 版本：V1.0  
>
> 定位：基于 Agent 16–28 输出的结构化 EDA 工程、Reviewed Netlist、库与 Pin-Pad 校验、BOM/物料数据、Firmware Variant、PCB Constraint IR、Placement IR、Routing IR、DRC/SI/PI/EMC Review 和 3D/Mechanical Review，冻结唯一的 Project Revision、Assembly Revision、Variant、制造 Profile、坐标契约和规则快照，确定性生成并交叉校验 Gerber、Drill、BOM、CPL/Pick-and-Place、装配图、制造图、钢网/Paste 文件、坐标说明、层叠和工艺说明、版本说明、校验和与 Release Manifest，形成可追溯的 Fabrication Package、Assembly Package、Stencil Package 和 Archive Package。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Board Outline、Layer、Footprint、Pad、Track、Via、Zone、Hole、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、连接置信度和 Release Level
> - Agent 20：Symbol/Footprint/3D、Pin-Pad、Padstack、库版本、模型映射和实例一致性
> - Agent 21：Firmware Variant、Board Revision、Assembly Option、PinMux 和功能配置
> - Agent 22：ERC、额定值、保护、DNP、典型应用和 BOM 相关 Finding
> - Agent 23：仿真条件、器件应力、功耗和 Variant 依赖
> - Agent 24：Stack-up、Net/Component Class、阻抗、线宽、间距、Via、HV、制造和装配约束
> - Agent 25：Legalized Placement IR、固定器件、板框、定位点和 Mechanical Profile
> - Agent 26：Routing IR、Track/Via/Zone、未布网络、长度/时延和 Router Verification
> - Agent 27：Native DRC、Connectivity、SI、PI、EMC、Waiver 和 Release Gate
> - Agent 28：3D/Mechanical、连接器、工具、装配、公差、MCAD Revision 和 Release Gate
> - Agent 19：KiCad MCP/IPC/CLI、Workspace、Jobset、Readback 和 Rollback
> - Agent 31–40：BOM 规范化、MPN、生命周期、价格、MOQ 和采购数据，可作为增强输入
> - PLM/ERP：内部料号、版本、ECO/ECN、制造商、批准供应商、替代料、批次和发布状态
> - PCB/SMT/钢网厂商 Profile：支持格式、文件命名、坐标约定、旋转规则、层命名、压缩包结构和特殊说明
>
> 下游：
> - PCB 制造商：Fabrication Package
> - SMT/EMS：Assembly Package
> - 钢网供应商：Stencil Package
> - Agent 43：EBOM/MBOM/NPI、制造版本冻结和发布
> - Agent 44：PCB/SMT RFQ、报价和订单
> - Agent 45：来料、生产、测试和质量追溯
> - PLM/ERP/MES：Release Manifest、BOM、Variant、物料和生产版本
> - Tindie/e-commerce：制造版本、装配选项和可生产性证据
> - CI/CD：可重复生成、差异检测和 Release Gate
>
> 核心输出：
> - Manufacturing Release Input Snapshot
> - Project/Assembly/Variant Release Identity
> - Manufacturing Profile Snapshot
> - Coordinate Contract
> - Layer and File Mapping Manifest
> - Gerber Layer Set
> - Gerber X2 Attribute and Job Metadata Report
> - Drill/XNC/Excellon Set
> - Drill Map and Drill Report
> - Fabrication Drawing
> - Board Stack-up and Impedance Table
> - Netlist or Intelligent Manufacturing Data Candidate
> - BOM Master、Fabrication BOM、Assembly BOM 和 Variant BOM
> - CPL/Pick-and-Place Top/Bottom
> - Centroid/Rotation Normalization Report
> - Assembly Drawing Top/Bottom
> - Paste/Stencil Gerber Top/Bottom
> - Stencil Aperture and Reduction Report
> - DNP/Variant Visualization
> - Manufacturing Notes
> - Assembly Notes
> - Coordinate and Rotation README
> - Version/Revision/ECO Release Notes
> - Fabrication Package
> - Assembly Package
> - Stencil Package
> - Intelligent Package：IPC-2581/ODB++，按能力和制造商 Profile
> - Checksums、Signatures 和 SBOM-like Artifact Manifest
> - Independent Artifact Verification Report
> - Cross-file Consistency Report
> - Release Gate and Immutable Release Manifest
>
> 重要边界：
> - 本 Agent 负责生成、校验和发布生产资料，不替代 PCB/SMT 厂商最终 CAM、DFM、工艺审核和首件确认。
> - “命令执行成功”不等于生产文件正确；必须回读、解析、几何比对和跨文件一致性验证。
> - 所有文件必须来自同一个不可变 Input Snapshot；禁止分别从不同 Git Commit、Variant、Workspace 或缓存生成。
> - Gerber、Drill、CPL、装配图和说明必须共享同一 Coordinate Contract，不能各自选择原点。
> - Bottom Side 坐标、镜像和旋转约定必须显式绑定制造商 Profile，不能用一个通用约定假设所有 SMT 厂。
> - CPL 中的坐标对象、Footprint Anchor、Body Centroid、Pin-1、Rotation Zero 和贴片机拾取中心必须区分。
> - BOM 中的 DNP、Variant、替代料、可选料和机械件不能仅靠空值或备注隐式表示。
> - BOM、CPL、装配图、Paste 和 PCB Footprint 实例必须逐位号交叉校验。
> - 钢网文件不是简单复制 Paste 层；需要检查 Aperture Reduction、Window Pane、No-Paste、Via-in-Pad、细间距、热焊盘和 Variant 策略。
> - Drill 文件必须区分 PTH、NPTH、盲埋孔、微孔、槽孔、Backdrill 和特殊孔能力。
> - 不把 Gerber 图像层当作包含完整 Stack-up、材料、网络和装配意图的智能数据。
> - IPC-2581、ODB++、Gerber X2/X3、Excellon/XNC 等能力必须按 EDA 版本和接收方 Profile 探测，不能硬编码永久支持状态。
> - 不自动删除或覆盖已发布 Release；每次发布创建新的不可变 Release ID。
> - 不直接把未经独立验证的 ZIP 发给生产商或创建订单。
> - 不自动修改 PCB、BOM 或 Variant 来“让导出通过”；应返回上游修复。
> - 不把私有工程、生产文件和供应商 Profile 发送给外部通用模型。
> - AI 仅用于版本说明和人工可读摘要，不参与几何、坐标、位号、数量和文件真值计算。

---

# 1. Agent 29 的系统位置

```text
Approved EDA + BOM + Variant + Review Gates
                         ↓
Release Identity and Snapshot Freeze
                         ↓
Manufacturing Profile and Coordinate Contract
                         ↓
Deterministic Native Exports
                         ↓
Artifact Parsing and Geometry Reconstruction
                         ↓
Cross-file Consistency Verification
                         ↓
Manufacturer/Assembler Profile Validation
                         ↓
Fabrication / Assembly / Stencil Packages
                         ↓
Checksums / Signatures / Release Manifest
                         ↓
Immutable Archive and Downstream Handoff
```

---

# 2. 为什么需要独立 Agent 29

常见生产资料错误包括：

1. Gerber 来自最新 PCB，BOM 来自上一次原理图；
2. CPL 使用辅助原点，Drill 使用绝对原点；
3. Bottom Side 在贴片厂系统中被二次镜像；
4. CPL 旋转零点与封装库方向不一致；
5. BOM 排除了 DNP，但 CPL 仍包含 DNP；
6. BOM 包含器件，PCB 上没有对应位号；
7. PCB 上有贴片器件，但 CPL 中遗漏；
8. 装配图没有标出 Variant 和 DNP；
9. Top Paste 中存在不该开口的器件；
10. Thermal Pad 钢网未做 Window Pane；
11. PTH/NPTH Drill 混在一个文件，但制造商要求分开；
12. 槽孔在 Drill 中被转换成多个圆孔；
13. Board Outline 在 Gerber 中不闭合或有重复轮廓；
14. 内层铜、阻焊、丝印和 Paste 层命名错位；
15. Fab Drawing 标注的板厚与 Stack-up 不一致；
16. 制造说明中的阻抗表与 PCB 规则不一致；
17. 版本说明写的是 Rev B，文件名还是 Rev A；
18. ZIP 中残留旧 Gerber 和临时文件；
19. 同名文件被不同操作系统大小写规则覆盖；
20. 生产商收到资料后无法判断哪个文件是最终版；
21. 外部脚本导出的 BOM 列顺序改变，MES 导入失败；
22. KiCad Jobset 成功，但其中某个 Job 继续执行后失败；
23. 3D、Assembly Drawing 和 CPL 的 Bottom 方向不一致；
24. 智能制造文件和 Gerber 包来自不同 Variant；
25. 文件内容未变但时间戳变化，无法判断是否可重现；
26. 首次生产后无法追溯当时使用的 EDA、规则、插件和 Profile。

Agent 29 的职责是：

```text
One Release Identity
→ Deterministic Export
→ Independent Verification
→ Cross-file Reconciliation
→ Immutable Manufacturing Release
```

---

# 3. Release Identity

每次发布必须唯一绑定：

```text
tenant
project
product
board
project revision
schematic revision
pcb revision
assembly revision
variant
firmware compatibility
ECO/ECN
release sequence
manufacturing profile
toolchain snapshot
```

建议 Release ID：

```text
{product}-{board}-R{revision}-{variant}-{release_sequence}
```

实际系统使用 UUID，显示名称仅供人阅读。

---

# 4. Release 类型

```text
prototype
engineering_validation
design_validation
pilot
mass_production
rework
service
archive
```

不同类型拥有不同 Gate 和文件集合。

---

# 5. Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "schematic_hash": "sha256",
  "pcb_hash": "sha256",
  "agent16_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_scan_hash": "sha256",
  "agent21_variant_hash": "sha256",
  "agent22_review_hash": "sha256",
  "agent24_constraint_hash": "sha256",
  "agent25_placement_hash": "sha256",
  "agent26_routing_hash": "sha256",
  "agent27_review_hash": "sha256",
  "agent28_review_hash": "sha256",
  "manufacturing_profile_hash": "sha256",
  "coordinate_contract_hash": "sha256",
  "toolchain_hash": "sha256"
}
```

Snapshot 创建后不可修改。

---

# 6. Release Readiness Gate

## Blocked

```text
Project Revision 不一致
Agent 18 Release 太低
Agent 20 Critical Library/Padstack Finding
Agent 26 Critical Net 未布
Agent 27 DRC Error
Agent 27 未解释 Exclusion
Agent 28 Critical Mechanical Finding
Board Outline 无效
Variant 未冻结
BOM 未冻结
坐标契约未批准
制造 Profile 不完整
```

## Prototype-only

```text
部分模型或供应链字段缺失
普通 Warning 未关闭
智能制造格式未验证
装配 Profile 为 Generic
```

## Production-capable

```text
Project/Assembly/Variant Frozen
DRC/Connectivity Pass
Critical Mechanical Pass
BOM/CPL Reconciled
Fabrication and Assembly Package Verified
Release Manifest Signed
```

---

# 7. Manufacturing Profile

包含：

```text
manufacturer/assembler identifier
profile version
accepted formats
required layer files
optional layer files
file naming
archive structure
Gerber attributes
drill format
PTH/NPTH split
slot representation
origin
units
CPL side convention
bottom mirror convention
rotation convention
BOM columns
DNP policy
stencil policy
drawing requirements
intelligent data format
maximum filename length
character encoding
checksum requirements
```

状态：

```text
approved
candidate
deprecated
blocked
```

---

# 8. Toolchain Snapshot

保存：

```text
EDA name/version
kicad-cli version
jobset hash
plugin/script version
container image digest
OS/architecture
locale
timezone
font package hash
export policy version
parser/verifier version
```

禁止使用“当前最新版”作为不可追溯依赖。

---

# 9. Coordinate Contract

统一定义：

```text
origin type
origin x/y
units
x direction
y direction
rotation direction
rotation zero axis
top side transform
bottom side transform
mirror policy
decimal precision
rounding mode
board edge reference
fiducial reference
```

---

# 10. Origin 类型

```text
absolute_board_origin
drill_place_origin
user_defined_origin
panel_origin
fixture_origin
manufacturer_defined_origin
```

所有输出必须引用同一个 Contract，例外必须显式记录。

---

# 11. Rotation Contract

区分：

```text
footprint library zero
EDA instance rotation
body orientation
pin-1 orientation
pick-up orientation
machine rotation
top/bottom transform
```

最终 CPL Rotation 通过 Profile Adapter 计算，不能直接复制 EDA Rotation。

---

# 12. Bottom Side 变换

显式保存：

```text
mirror axis
negate x/y
rotation sign
rotation offset
view from top/bottom
coordinate origin
```

必须通过 Golden Fixture 与目标 SMT Profile 验证。

---

# 13. Artifact 类型

```text
gerber_layer
gerber_job
drill
drill_map
drill_report
fabrication_drawing
assembly_drawing
bom
cpl
paste_layer
stencil_report
stackup
impedance_table
netlist
ipc2581
odbpp
gencad
step
readme
release_notes
checksum
signature
manifest
archive
```

---

# 14. Gerber Layer Set

典型层：

```text
F.Cu
In*.Cu
B.Cu
F.Mask
B.Mask
F.SilkS
B.SilkS
F.Paste
B.Paste
Edge.Cuts
User/Fab layers as required
```

具体集合由 Board Stack-up 和 Manufacturing Profile 决定。

---

# 15. Gerber 生成策略

要求：

```text
deterministic options
explicit layer list
explicit origin
explicit precision
explicit X2 policy
explicit netlist attribute policy
explicit Protel extension policy
explicit zone check/refill policy
explicit variant
```

不依赖 GUI 上一次使用的 Plot 设置，除非这些设置已被 Snapshot 和 Hash 固定。

---

# 16. Gerber 验证

检查：

```text
syntax parse
layer function
file polarity
apertures
attributes
units
format/precision
image bounds
board outline
empty required layer
unexpected non-empty layer
duplicate layer
copper layer count
mask/paste relation
silkscreen clipping
file naming
```

---

# 17. Gerber 几何回读

将 Gerber 重建为 Canonical Plot Geometry：

```text
flashes
draws
regions
apertures
polarity
attributes
```

与 PCB IR 比对：

```text
copper coverage
pad geometry
track geometry
zone geometry
mask openings
paste openings
silkscreen
board outline
```

允许的差异必须由 Plot Policy 解释。

---

# 18. Gerber X2 / X3 策略

系统保存：

```text
attribute support
component data support
EDA exporter capability
receiver capability
mapping loss
fallback
```

不把 X2/X3 标志当作万能完整制造包；接收方能力仍需 Profile 验证。

---

# 19. Gerber Job / Layer Manifest

无论 EDA 是否生成官方 Job 文件，系统都应生成自己的 Layer Manifest：

```text
artifact id
filename
layer name
layer function
copper order
polarity
hash
size
bounds
required/optional
```

---

# 20. Drill 输出

支持：

```text
Excellon
Gerber drill
XNC adapter
PTH
NPTH
blind/buried
microvia
slot
backdrill
map
report
```

---

# 21. Drill Manifest

每类孔保存：

```text
tool id
diameter
plating
start layer
end layer
shape
slot length
slot orientation
count
source pad/via/hole ids
```

---

# 22. Drill 验证

检查：

```text
tool table
unit
zero suppression
origin
PTH/NPTH split
hole count
diameter set
slot preservation
layer span
blind/buried mapping
microvia mapping
backdrill
map/report consistency
board containment
```

---

# 23. Drill 与 PCB IR 对账

逐个 Source Object 关联：

```text
pad hole
via hole
mounting hole
slot
tooling hole
castellated hole
```

不能只比较孔总数。

---

# 24. Board Outline

检查：

```text
closed
non-self-intersecting
no duplicate segment
no tiny gap
correct layer
single/multiple contour policy
cutout
slot
radius/arc
panel rail
route path intent
```

---

# 25. Fabrication Drawing

建议包含：

```text
board outline and dimensions
cutouts/slots
hole table
datum/origin
layer stack
board thickness
material
copper weight
finish
soldermask
silkscreen
controlled impedance
special via
backdrill
edge plating/castellation
tolerance
panel notes
fabrication notes
revision block
```

所有文字字段从受控 Release Data 生成，不从自由文本复制旧版。

---

# 26. Stack-up Table

字段：

```text
layer index
layer name
type
material
thickness
copper
Dk/Df condition
finished thickness
impedance usage
manufacturer adjustment policy
```

与 Agent 24 Stack-up Snapshot 对账。

---

# 27. Impedance Table

字段：

```text
impedance id
net class/interface
single/differential
target
tolerance
reference layer
signal layer
nominal width
nominal gap
model/version
notes
```

若制造商需要重新计算，必须保留目标和允许调整范围。

---

# 28. BOM 数据层次

```text
Engineering BOM
Assembly BOM
Variant BOM
Procurement BOM
Fabrication Non-electrical BOM
```

生产 Release 至少输出 Assembly BOM 和可选的 Fabrication/Mechanical BOM。

---

# 29. BOM 行模型

```text
line id
internal part number
manufacturer
manufacturer part number
description
quantity
reference designators
footprint
value
variant
populate status
approved alternates
supplier optional
lifecycle optional
customer-supplied status
notes
revision/effectivity
```

---

# 30. Populate 状态

```text
populate
dnp
optional
alternate
not_on_board
mechanical_only
consigned
customer_supplied
```

不使用空 MPN 表示 DNP。

---

# 31. BOM 聚合规则

聚合键可配置：

```text
internal part number
MPN
manufacturer
value
footprint
variant
populate status
substitution group
```

不得把相同 Value、不同额定值或不同封装的器件误聚合。

---

# 32. BOM 验证

检查：

```text
reference uniqueness
quantity equals refdes count
all populated board parts present
DNP explicit
no unknown refdes
no duplicate refdes across lines
MPN required fields
footprint consistency
variant consistency
mechanical items
approved alternates
encoding
column schema
```

---

# 33. BOM 与 PCB 对账

集合：

```text
PCB population instances
Schematic BOM instances
Assembly BOM instances
Variant DNP instances
Mechanical instances
```

输出：

```text
missing in BOM
missing on PCB
unexpected DNP
unexpected populate
footprint mismatch
variant mismatch
quantity mismatch
```

---

# 34. CPL / Pick-and-Place

输出字段：

```text
reference
x
y
rotation
side
footprint/package
value
MPN optional
populate status
height optional
feeder/package hint optional
```

---

# 35. CPL 坐标来源

位置点可为：

```text
footprint anchor
body centroid
pad centroid
manufacturer pick-up point
custom placement point
```

系统必须保存选用来源和修正 Offset。

---

# 36. CPL Rotation Normalization

流水线：

```text
library zero
+ footprint instance rotation
+ body orientation offset
+ top/bottom transform
+ manufacturer profile rotation offset
= exported machine rotation
```

每个 Footprint Family 可有 Rotation Mapping Profile。

---

# 37. CPL 验证

检查：

```text
refdes uniqueness
BOM populated set equality
side
origin
units
rotation range
finite coordinate
board containment
centroid plausibility
package mapping
DNP exclusion
bottom transform
duplicate coordinate warning
missing pick-up point
```

---

# 38. CPL Golden Fixtures

必须建立：

```text
SOIC pin-1 left
QFN pin-1 corner
SOT-23
diode polarity
polarized capacitor
USB connector
BGA
odd-shaped module
bottom-side examples
```

与目标贴片厂导入预览进行人工确认并签署 Profile。

---

# 39. Assembly Drawing

Top/Bottom 分开输出：

```text
board outline
component outline
reference designator
pin-1/polarity
DNP marking
variant
fiducials
tooling holes
connector orientation
critical notes
revision/title block
```

Bottom Drawing 必须明确视角和镜像说明。

---

# 40. Assembly Drawing 验证

检查：

```text
all populated refs visible or in table
DNP visible
no text outside page
no overlapping critical labels
pin-1 markers
polarity
top/bottom view
variant/revision
origin datum
```

视觉布局可用确定性排版算法；AI 不调整关键标记。

---

# 41. Paste / Stencil 输出

来源：

```text
F.Paste
B.Paste
custom stencil modifications
variant-specific aperture rules
manufacturer stencil profile
```

---

# 42. Stencil Aperture 类型

```text
one-to-one
reduced
expanded
window-pane
home-plate
rounded-rectangle
no-paste
split-aperture
step-stencil region
```

---

# 43. Stencil 检查

```text
paste opening exists for populated SMT pad
no paste for no-paste pad
DNP policy
thermal pad window pane
fine-pitch bridge risk
area ratio/aspect ratio candidate
via-in-pad
exposed via
paste-to-mask relation
top/bottom separation
stencil thickness profile
step region
aperture count
```

面积比等工艺判断必须绑定钢网厚度和供应商规则。

---

# 44. Variant 与 Stencil

策略：

```text
shared stencil
variant-specific stencil
manual blocking
no-paste for DNP
paste retained for option
```

必须由 Manufacturing Profile 明确，不能默认 DNP 一定删除 Paste。

---

# 45. Netlist / Intelligent Data

可选输出：

```text
IPC-D-356 netlist
IPC-2581
ODB++
GenCAD
Gerber X3 component data
```

每种格式保存：

```text
exporter capability
receiver capability
revision/version
mapping manifest
mapping loss
verification status
```

---

# 46. Intelligent Data 与传统包一致性

检查：

```text
board revision
variant
layer count
net count
component count
drill count
stackup
BOM
placements
outline
```

任何差异阻断 Production Release。

---

# 47. 文件命名

建议格式：

```text
{product}_{board}_{revision}_{variant}_{artifact_role}_{side_or_layer}.{ext}
```

要求：

```text
ASCII-safe option
length limit
no ambiguous spaces
case collision check
unique names
profile-specific aliases
```

---

# 48. Package 类型

## Fabrication Package

```text
Gerber
Drill
Drill map/report
Fab drawing
Stack-up
Impedance
Netlist/intelligent file optional
README
Manifest
```

## Assembly Package

```text
BOM
CPL
Assembly drawings
Paste layers
STEP/3D optional
Assembly notes
Variant/DNP list
README
Manifest
```

## Stencil Package

```text
Top/Bottom Paste
Aperture report
Stencil notes
Thickness/step profile
Manifest
```

## Archive Package

```text
all approved artifacts
source snapshot manifest
toolchain
checksums
signatures
release report
```

---

# 49. ZIP/Archive 安全

要求：

```text
deterministic file order
normalized timestamp policy
normalized permissions
no symlink
no absolute path
no hidden temp file
no previous release artifact
no nested unapproved archive
size limit
manifest first/last policy
```

---

# 50. Release Manifest

```json
{
  "manifest_version": "1.0.0",
  "release_id": "uuid",
  "release_name": "string",
  "project_revision": "sha",
  "assembly_revision": "string",
  "variant": "string",
  "release_type": "pilot",
  "toolchain": {},
  "coordinate_contract": {},
  "manufacturing_profiles": [],
  "artifacts": [],
  "verification_runs": [],
  "waivers": [],
  "approvals": [],
  "created_at": "timestamp"
}
```

---

# 51. Artifact Manifest Entry

```text
artifact id
role
filename
media type
format/version
variant
side/layer
size
sha256
generator
generator version
input snapshot hash
verification status
signing status
```

---

# 52. Deterministic Generation

同输入、同工具、同 Profile 应生成：

```text
same semantic content
same normalized filenames
same manifest order
same hashes where format permits
```

若格式嵌入时间戳：

```text
record nondeterministic fields
normalize when allowed
compare semantic hash
```

---

# 53. Semantic Hash

除文件 Hash 外，可保存：

```text
Gerber geometry hash
drill tool/geometry hash
BOM canonical row hash
CPL canonical placement hash
drawing semantic content hash
manifest semantic hash
```

---

# 54. Cross-file Consistency Matrix

```text
PCB IR ↔ Gerber
PCB IR ↔ Drill
PCB IR ↔ CPL
Schematic/PLM ↔ BOM
BOM ↔ CPL
BOM ↔ Assembly Drawing
CPL ↔ Assembly Drawing
Pad/Paste ↔ Stencil
Stack-up ↔ Fab Drawing
Variant ↔ all artifacts
Coordinate Contract ↔ Gerber/Drill/CPL/Drawing
Release Identity ↔ filename/title block/manifest
```

---

# 55. Independent Verification

至少使用与生成器不同的 Parser/Verifier：

```text
Gerber parser
Drill parser
CSV/BOM parser
CPL parser
PDF/SVG drawing structure checker
Archive checker
Manifest checker
```

可选：

```text
Reference Gerber syntax/viewer adapter
CAM system import smoke test
manufacturer API preview
```

---

# 56. Verification 结果

```text
pass
pass_with_warnings
candidate_only
indeterminate
fail
```

Production Release 不接受 `indeterminate` 的 Required Artifact。

---

# 57. Finding IR

```json
{
  "finding_id": "uuid",
  "domain": "cpl",
  "finding_type": "bottom_rotation_mismatch",
  "severity": "critical",
  "artifact_ids": [],
  "source_objects": [],
  "actual": {},
  "expected": {},
  "evidence_ids": [],
  "repair_route": "manufacturing_profile",
  "status": "open"
}
```

---

# 58. Finding 类型

```text
revision_mismatch
variant_mismatch
coordinate_origin_mismatch
unit_mismatch
rotation_mismatch
bottom_mirror_mismatch
missing_layer
unexpected_layer
empty_required_layer
gerber_parse_error
outline_invalid
drill_count_mismatch
drill_plating_mismatch
slot_lost
bom_refdes_mismatch
bom_quantity_mismatch
cpl_refdes_mismatch
cpl_coordinate_invalid
cpl_rotation_invalid
assembly_drawing_missing_ref
paste_missing
paste_unexpected
stencil_aperture_risk
intelligent_package_mismatch
archive_contamination
manifest_hash_mismatch
signature_invalid
profile_noncompliance
```

---

# 59. Repair 路由

```text
source project issue → Agent 16/19
library/footprint/rotation issue → Agent 20
variant/BOM issue → Agent 21/31/43
constraint/stackup issue → Agent 24
placement/centroid issue → Agent 25
routing/zone issue → Agent 26
DRC/SI/PI/EMC issue → Agent 27
mechanical/assembly issue → Agent 28
export/profile issue → Agent 29
```

Agent 29 不直接修改源工程来掩盖生产文件错误。

---

# 60. AI 允许职责

```text
生成版本说明草稿
把 Verification Finding 转换为工程师可读摘要
根据结构化 Diff 生成 Release Notes
整理制造和装配说明草稿
```

---

# 61. AI 禁止职责

```text
计算 Gerber 几何
决定 Drill Tool
生成 CPL 坐标或旋转
修改 BOM 数量
猜测 Variant
修改钢网 Aperture
伪造 CAM 预览
伪造校验结果
批准生产 Release
```

---

# 62. Release Gate

## Export Ready

```text
Input Snapshot Frozen
Toolchain Approved
Profile Approved
Coordinate Contract Approved
```

## Fabrication Ready

```text
Required Gerber Pass
Drill Reconciled
Outline Pass
Stack-up/Fab Drawing Pass
DRC Error = 0
```

## Assembly Ready

```text
BOM/CPL/Assembly Drawing Reconciled
DNP/Variant Pass
Paste/Stencil Pass
Mechanical Gate Pass
```

## Production Release

```text
All Required Artifacts Verified
Cross-file Critical Finding = 0
Unexplained Waiver = 0
Manifest Complete
Checksums/Signature Complete
Approvals Complete
Immutable Archive Created
```

---

# 63. 状态机

```text
RECEIVED
→ VALIDATING_RELEASE_IDENTITY
→ FREEZING_INPUT_SNAPSHOT
→ RESOLVING_PROFILES
→ VALIDATING_COORDINATE_CONTRACT
→ RUNNING_PRE_EXPORT_GATES
→ GENERATING_FABRICATION_ARTIFACTS
→ GENERATING_ASSEMBLY_ARTIFACTS
→ GENERATING_STENCIL_ARTIFACTS
→ GENERATING_INTELLIGENT_ARTIFACTS
→ PARSING_GENERATED_ARTIFACTS
→ VERIFYING_GEOMETRY
→ RECONCILING_CROSS_FILE_DATA
→ BUILDING_PACKAGES
→ GENERATING_MANIFEST
→ SIGNING_RELEASE
→ RUNNING_RELEASE_GATE
→ PUBLISHING_RELEASE
→ COMPLETED
```

分支：

```text
COMPLETED_PROTOTYPE_ONLY
COMPLETED_WITH_WARNINGS
REVIEW_REQUIRED
INPUT_BLOCKED
PROFILE_BLOCKED
COORDINATE_BLOCKED
EXPORT_FAILED
VERIFICATION_FAILED
CROSS_FILE_MISMATCH
SIGNING_FAILED
RELEASE_GATE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 64. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
ASSEMBLY_REVISION_MISMATCH
VARIANT_NOT_FOUND
VARIANT_NOT_FROZEN
AGENT18_RELEASE_TOO_LOW
AGENT20_LIBRARY_BLOCKED
AGENT26_UNROUTED_CRITICAL_NET
AGENT27_DRC_BLOCKED
AGENT28_MECHANICAL_BLOCKED
BOM_NOT_FROZEN
MANUFACTURING_PROFILE_MISSING
MANUFACTURING_PROFILE_UNAPPROVED
COORDINATE_CONTRACT_MISSING
COORDINATE_ORIGIN_CONFLICT
BOTTOM_TRANSFORM_AMBIGUOUS
ROTATION_PROFILE_MISSING
TOOLCHAIN_UNAPPROVED
JOBSET_NOT_FOUND
JOBSET_HASH_MISMATCH
GERBER_EXPORT_FAILED
GERBER_PARSE_FAILED
GERBER_LAYER_MISSING
GERBER_LAYER_UNEXPECTED
GERBER_REQUIRED_LAYER_EMPTY
GERBER_OUTLINE_INVALID
GERBER_GEOMETRY_MISMATCH
DRILL_EXPORT_FAILED
DRILL_PARSE_FAILED
DRILL_COUNT_MISMATCH
DRILL_TOOL_MISMATCH
DRILL_PLATING_MISMATCH
DRILL_SLOT_LOST
BOM_EXPORT_FAILED
BOM_SCHEMA_INVALID
BOM_REFDES_MISMATCH
BOM_QUANTITY_MISMATCH
BOM_VARIANT_MISMATCH
CPL_EXPORT_FAILED
CPL_SCHEMA_INVALID
CPL_REFDES_MISMATCH
CPL_COORDINATE_MISMATCH
CPL_ROTATION_MISMATCH
CPL_BOTTOM_TRANSFORM_MISMATCH
ASSEMBLY_DRAWING_EXPORT_FAILED
ASSEMBLY_DRAWING_INCOMPLETE
PASTE_EXPORT_FAILED
PASTE_GEOMETRY_MISMATCH
STENCIL_RULE_FAILED
IPC2581_EXPORT_FAILED
ODBPP_EXPORT_FAILED
INTELLIGENT_PACKAGE_MISMATCH
ARCHIVE_CONTAMINATED
ARCHIVE_PATH_INVALID
MANIFEST_INCOMPLETE
MANIFEST_HASH_MISMATCH
SIGNATURE_FAILED
RELEASE_ALREADY_EXISTS
RELEASE_GATE_BLOCKED
JOB_CANCELLED
INTERNAL_ERROR


---

# 65. 数据库设计

## 65.1 `manufacturing_release_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
product_id UUID NULL
board_id UUID NULL
release_name VARCHAR NOT NULL
release_type VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
schematic_revision VARCHAR NULL
pcb_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
variant_id UUID NOT NULL
release_sequence INT NOT NULL
manufacturing_profile_ids JSONB NOT NULL
coordinate_contract_id UUID NOT NULL
toolchain_snapshot_id UUID NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
release_manifest_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, release_name)
UNIQUE(idempotency_key)
```

## 65.2 `manufacturing_input_snapshots`

```text
id UUID PK
release_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
schematic_hash CHAR(64) NOT NULL
pcb_hash CHAR(64) NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_scan_hash CHAR(64) NOT NULL
agent21_variant_hash CHAR(64) NOT NULL
agent22_review_hash CHAR(64) NULL
agent23_result_hash CHAR(64) NULL
agent24_constraint_hash CHAR(64) NOT NULL
agent25_placement_hash CHAR(64) NOT NULL
agent26_routing_hash CHAR(64) NOT NULL
agent27_review_hash CHAR(64) NOT NULL
agent28_review_hash CHAR(64) NOT NULL
bom_snapshot_hash CHAR(64) NOT NULL
manufacturing_profile_hash CHAR(64) NOT NULL
coordinate_contract_hash CHAR(64) NOT NULL
toolchain_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, snapshot_hash)
```

## 65.3 `manufacturing_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
profile_type VARCHAR NOT NULL
supplier_identifier VARCHAR NULL
accepted_formats JSONB NOT NULL
required_artifacts JSONB NOT NULL
optional_artifacts JSONB NOT NULL
layer_mapping JSONB NOT NULL
file_naming JSONB NOT NULL
archive_structure JSONB NOT NULL
gerber_policy JSONB NOT NULL
drill_policy JSONB NOT NULL
coordinate_policy JSONB NOT NULL
rotation_policy JSONB NOT NULL
bom_schema JSONB NOT NULL
cpl_schema JSONB NOT NULL
stencil_policy JSONB NOT NULL
drawing_policy JSONB NOT NULL
intelligent_data_policy JSONB NOT NULL
encoding_policy JSONB NOT NULL
checksum_policy JSONB NOT NULL
approval_status VARCHAR NOT NULL
deprecated_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 65.4 `manufacturing_coordinate_contracts`

```text
id UUID PK
tenant_id UUID NULL
contract_name VARCHAR NOT NULL
contract_version VARCHAR NOT NULL
origin_type VARCHAR NOT NULL
origin_coordinates JSONB NOT NULL
units VARCHAR NOT NULL
x_direction VARCHAR NOT NULL
y_direction VARCHAR NOT NULL
rotation_direction VARCHAR NOT NULL
rotation_zero_axis VARCHAR NOT NULL
top_transform JSONB NOT NULL
bottom_transform JSONB NOT NULL
mirror_policy JSONB NOT NULL
decimal_precision INT NOT NULL
rounding_mode VARCHAR NOT NULL
board_edge_reference VARCHAR NOT NULL
fiducial_reference JSONB NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(contract_name, contract_version)
```

## 65.5 `manufacturing_toolchain_snapshots`

```text
id UUID PK
tenant_id UUID NULL
toolchain_name VARCHAR NOT NULL
eda_name VARCHAR NOT NULL
eda_version VARCHAR NOT NULL
cli_version VARCHAR NOT NULL
jobset_hash CHAR(64) NULL
plugin_manifest JSONB NOT NULL
script_manifest JSONB NOT NULL
container_images JSONB NOT NULL
os_architecture JSONB NOT NULL
locale VARCHAR NOT NULL
timezone VARCHAR NOT NULL
font_manifest JSONB NOT NULL
export_policy_version VARCHAR NOT NULL
parser_manifest JSONB NOT NULL
verifier_manifest JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(snapshot_hash)
```

## 65.6 `manufacturing_variants`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
variant_name VARCHAR NOT NULL
variant_version VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
populate_rules JSONB NOT NULL
dnp_rules JSONB NOT NULL
alternate_rules JSONB NOT NULL
firmware_compatibility JSONB NOT NULL
effectivity JSONB NOT NULL
source_reference JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, variant_name, variant_version)
```

## 65.7 `manufacturing_export_plans`

```text
id UUID PK
release_job_id UUID NOT NULL
plan_version INT NOT NULL
release_identity JSONB NOT NULL
artifact_jobs JSONB NOT NULL
execution_order JSONB NOT NULL
jobset_reference JSONB NULL
output_directory_policy JSONB NOT NULL
environment_policy JSONB NOT NULL
failure_policy JSONB NOT NULL
plan_uri TEXT NOT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, plan_version)
```

## 65.8 `manufacturing_export_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
export_plan_id UUID NOT NULL
artifact_role VARCHAR NOT NULL
generator_name VARCHAR NOT NULL
generator_version VARCHAR NOT NULL
command_manifest JSONB NOT NULL
input_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
exit_code INT NULL
stdout_uri TEXT NULL
stderr_uri TEXT NULL
output_manifest_uri TEXT NULL
runtime_ms BIGINT NULL
peak_memory_bytes BIGINT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 65.9 `manufacturing_artifacts`

```text
id UUID PK
release_job_id UUID NOT NULL
artifact_role VARCHAR NOT NULL
artifact_subtype VARCHAR NULL
filename VARCHAR NOT NULL
media_type VARCHAR NOT NULL
format_name VARCHAR NOT NULL
format_version VARCHAR NULL
variant_id UUID NOT NULL
side VARCHAR NULL
layer_name VARCHAR NULL
required BOOLEAN NOT NULL
artifact_uri TEXT NOT NULL
file_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NULL
size_bytes BIGINT NOT NULL
generator_run_id UUID NOT NULL
verification_status VARCHAR NOT NULL
signing_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, filename)
```

## 65.10 `manufacturing_layer_manifests`

```text
id UUID PK
release_job_id UUID NOT NULL
artifact_id UUID NOT NULL
canonical_layer_name VARCHAR NOT NULL
layer_function VARCHAR NOT NULL
copper_order INT NULL
polarity VARCHAR NULL
required BOOLEAN NOT NULL
image_bounds JSONB NOT NULL
empty_status VARCHAR NOT NULL
attribute_summary JSONB NOT NULL
source_mapping JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, canonical_layer_name, artifact_id)
```

## 65.11 `manufacturing_gerber_parse_runs`

```text
id UUID PK
artifact_id UUID NOT NULL
parser_name VARCHAR NOT NULL
parser_version VARCHAR NOT NULL
format_revision VARCHAR NULL
syntax_status VARCHAR NOT NULL
unit VARCHAR NULL
coordinate_format JSONB NULL
polarity_status VARCHAR NOT NULL
aperture_count INT NOT NULL
attribute_summary JSONB NOT NULL
geometry_summary JSONB NOT NULL
warning_count INT NOT NULL
error_count INT NOT NULL
parsed_geometry_uri TEXT NOT NULL
parsed_geometry_hash CHAR(64) NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.12 `manufacturing_gerber_geometry_checks`

```text
id UUID PK
release_job_id UUID NOT NULL
artifact_id UUID NOT NULL
source_layer_reference JSONB NOT NULL
comparison_policy_version VARCHAR NOT NULL
source_geometry_hash CHAR(64) NOT NULL
plot_geometry_hash CHAR(64) NOT NULL
missing_geometry JSONB NOT NULL
unexpected_geometry JSONB NOT NULL
allowed_differences JSONB NOT NULL
coverage_metrics JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.13 `manufacturing_drill_parse_runs`

```text
id UUID PK
artifact_id UUID NOT NULL
parser_name VARCHAR NOT NULL
parser_version VARCHAR NOT NULL
format_name VARCHAR NOT NULL
unit VARCHAR NOT NULL
zero_format VARCHAR NULL
origin JSONB NOT NULL
tool_table JSONB NOT NULL
hole_count INT NOT NULL
slot_count INT NOT NULL
plating_scope VARCHAR NOT NULL
layer_span_summary JSONB NOT NULL
parsed_geometry_uri TEXT NOT NULL
parsed_geometry_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.14 `manufacturing_drill_reconciliation_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
source_hole_count INT NOT NULL
exported_hole_count INT NOT NULL
matched_hole_count INT NOT NULL
missing_holes JSONB NOT NULL
unexpected_holes JSONB NOT NULL
diameter_mismatches JSONB NOT NULL
plating_mismatches JSONB NOT NULL
slot_mismatches JSONB NOT NULL
layer_span_mismatches JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.15 `manufacturing_bom_snapshots`

```text
id UUID PK
release_job_id UUID NOT NULL
bom_type VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
variant_id UUID NOT NULL
line_count INT NOT NULL
instance_count INT NOT NULL
column_schema JSONB NOT NULL
canonical_bom_uri TEXT NOT NULL
canonical_bom_hash CHAR(64) NOT NULL
source_manifest JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, bom_type)
```

## 65.16 `manufacturing_bom_lines`

```text
id UUID PK
bom_snapshot_id UUID NOT NULL
line_key VARCHAR NOT NULL
internal_part_number VARCHAR NULL
manufacturer VARCHAR NULL
manufacturer_part_number VARCHAR NULL
description TEXT NOT NULL
quantity NUMERIC NOT NULL
reference_designators JSONB NOT NULL
footprint VARCHAR NULL
value VARCHAR NULL
populate_status VARCHAR NOT NULL
approved_alternates JSONB NOT NULL
supplier_fields JSONB NOT NULL
mechanical BOOLEAN NOT NULL
consigned BOOLEAN NOT NULL
effectivity JSONB NOT NULL
notes TEXT NULL
line_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(bom_snapshot_id, line_key)
```

## 65.17 `manufacturing_bom_reconciliation_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
variant_id UUID NOT NULL
pcb_instance_count INT NOT NULL
schematic_instance_count INT NOT NULL
bom_instance_count INT NOT NULL
missing_in_bom JSONB NOT NULL
missing_on_pcb JSONB NOT NULL
duplicate_refdes JSONB NOT NULL
quantity_mismatches JSONB NOT NULL
footprint_mismatches JSONB NOT NULL
populate_mismatches JSONB NOT NULL
variant_mismatches JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.18 `manufacturing_cpl_snapshots`

```text
id UUID PK
release_job_id UUID NOT NULL
variant_id UUID NOT NULL
profile_id UUID NOT NULL
coordinate_contract_id UUID NOT NULL
top_count INT NOT NULL
bottom_count INT NOT NULL
schema_version VARCHAR NOT NULL
canonical_cpl_uri TEXT NOT NULL
canonical_cpl_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, profile_id)
```

## 65.19 `manufacturing_cpl_rows`

```text
id UUID PK
cpl_snapshot_id UUID NOT NULL
reference_designator VARCHAR NOT NULL
source_footprint_id UUID NOT NULL
x_coordinate NUMERIC NOT NULL
y_coordinate NUMERIC NOT NULL
rotation NUMERIC NOT NULL
side VARCHAR NOT NULL
package_name VARCHAR NULL
placement_point_type VARCHAR NOT NULL
placement_offset JSONB NOT NULL
rotation_mapping_profile VARCHAR NOT NULL
populate_status VARCHAR NOT NULL
row_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(cpl_snapshot_id, reference_designator)
```

## 65.20 `manufacturing_cpl_reconciliation_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
cpl_snapshot_id UUID NOT NULL
bom_populated_count INT NOT NULL
cpl_count INT NOT NULL
missing_cpl_refs JSONB NOT NULL
unexpected_cpl_refs JSONB NOT NULL
coordinate_findings JSONB NOT NULL
rotation_findings JSONB NOT NULL
side_findings JSONB NOT NULL
board_containment_findings JSONB NOT NULL
pickup_point_findings JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.21 `manufacturing_rotation_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
manufacturer_profile_id UUID NULL
footprint_family_pattern VARCHAR NOT NULL
library_zero_definition JSONB NOT NULL
body_orientation_offset NUMERIC NOT NULL
top_transform JSONB NOT NULL
bottom_transform JSONB NOT NULL
machine_offset NUMERIC NOT NULL
golden_fixture_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version, footprint_family_pattern)
```

## 65.22 `manufacturing_drawing_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
drawing_type VARCHAR NOT NULL
variant_id UUID NOT NULL
template_name VARCHAR NOT NULL
template_version VARCHAR NOT NULL
view_policy JSONB NOT NULL
content_manifest JSONB NOT NULL
status VARCHAR NOT NULL
artifact_id UUID NULL
report_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 65.23 `manufacturing_drawing_checks`

```text
id UUID PK
drawing_run_id UUID NOT NULL
required_reference_count INT NOT NULL
visible_reference_count INT NOT NULL
missing_references JSONB NOT NULL
label_overlap_findings JSONB NOT NULL
pin1_marker_findings JSONB NOT NULL
polarity_findings JSONB NOT NULL
view_findings JSONB NOT NULL
title_block_findings JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.24 `manufacturing_stencil_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
stencil_thickness JSONB NOT NULL
top_bottom_policy VARCHAR NOT NULL
dnp_policy VARCHAR NOT NULL
aperture_rules JSONB NOT NULL
thermal_pad_rules JSONB NOT NULL
fine_pitch_rules JSONB NOT NULL
via_in_pad_rules JSONB NOT NULL
step_stencil_rules JSONB NOT NULL
area_ratio_policy JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 65.25 `manufacturing_stencil_apertures`

```text
id UUID PK
release_job_id UUID NOT NULL
side VARCHAR NOT NULL
source_pad_id UUID NOT NULL
source_footprint_id UUID NOT NULL
reference_designator VARCHAR NOT NULL
aperture_type VARCHAR NOT NULL
source_geometry JSONB NOT NULL
output_geometry JSONB NOT NULL
reduction JSONB NULL
window_pattern JSONB NULL
stencil_profile_id UUID NOT NULL
variant_policy VARCHAR NOT NULL
rule_trace JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 65.26 `manufacturing_stencil_verification_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
stencil_profile_id UUID NOT NULL
source_pad_count INT NOT NULL
aperture_count INT NOT NULL
missing_apertures JSONB NOT NULL
unexpected_apertures JSONB NOT NULL
thermal_pad_findings JSONB NOT NULL
fine_pitch_findings JSONB NOT NULL
area_ratio_findings JSONB NOT NULL
via_in_pad_findings JSONB NOT NULL
variant_findings JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.27 `manufacturing_intelligent_exports`

```text
id UUID PK
release_job_id UUID NOT NULL
format_name VARCHAR NOT NULL
format_version VARCHAR NOT NULL
exporter_capability JSONB NOT NULL
receiver_capability JSONB NOT NULL
artifact_id UUID NULL
mapping_manifest_uri TEXT NOT NULL
mapping_loss JSONB NOT NULL
verification_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 65.28 `manufacturing_cross_file_checks`

```text
id UUID PK
release_job_id UUID NOT NULL
check_type VARCHAR NOT NULL
source_artifact_ids JSONB NOT NULL
source_snapshot_refs JSONB NOT NULL
actual JSONB NOT NULL
expected JSONB NOT NULL
mismatches JSONB NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 65.29 `manufacturing_findings`

```text
id UUID PK
release_job_id UUID NOT NULL
domain VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
artifact_ids JSONB NOT NULL
source_objects JSONB NOT NULL
actual JSONB NOT NULL
expected JSONB NOT NULL
evidence_ids JSONB NOT NULL
repair_route VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 65.30 `manufacturing_packages`

```text
id UUID PK
release_job_id UUID NOT NULL
package_type VARCHAR NOT NULL
profile_id UUID NOT NULL
package_version INT NOT NULL
artifact_ids JSONB NOT NULL
archive_format VARCHAR NOT NULL
archive_uri TEXT NOT NULL
archive_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
size_bytes BIGINT NOT NULL
verification_status VARCHAR NOT NULL
signing_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, package_type, profile_id, package_version)
```

## 65.31 `manufacturing_archive_checks`

```text
id UUID PK
package_id UUID NOT NULL
file_count INT NOT NULL
duplicate_name_count INT NOT NULL
case_collision_count INT NOT NULL
hidden_file_count INT NOT NULL
symlink_count INT NOT NULL
path_violation_count INT NOT NULL
stale_artifact_count INT NOT NULL
unexpected_artifacts JSONB NOT NULL
timestamp_policy_status VARCHAR NOT NULL
permission_policy_status VARCHAR NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.32 `manufacturing_release_manifests`

```text
id UUID PK
release_job_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
release_identity JSONB NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
toolchain_snapshot_hash CHAR(64) NOT NULL
coordinate_contract_hash CHAR(64) NOT NULL
manufacturing_profile_hashes JSONB NOT NULL
artifact_entries JSONB NOT NULL
package_entries JSONB NOT NULL
verification_entries JSONB NOT NULL
waiver_entries JSONB NOT NULL
approval_entries JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
signing_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id)
```

## 65.33 `manufacturing_release_signatures`

```text
id UUID PK
release_manifest_id UUID NOT NULL
signature_type VARCHAR NOT NULL
key_reference VARCHAR NOT NULL
algorithm VARCHAR NOT NULL
signed_hash CHAR(64) NOT NULL
signature_uri TEXT NOT NULL
certificate_chain_uri TEXT NULL
verification_status VARCHAR NOT NULL
signed_by UUID NOT NULL
signed_at TIMESTAMPTZ NOT NULL
```

## 65.34 `manufacturing_release_approvals`

```text
id UUID PK
release_job_id UUID NOT NULL
approval_role VARCHAR NOT NULL
approval_scope JSONB NOT NULL
decision VARCHAR NOT NULL
comment TEXT NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
source_reference JSONB NULL
```

## 65.35 `manufacturing_release_waivers`

```text
id UUID PK
release_job_id UUID NOT NULL
finding_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
risk_acceptance TEXT NOT NULL
evidence_ids JSONB NOT NULL
mitigations JSONB NOT NULL
effective_release_type VARCHAR NOT NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 65.36 `manufacturing_release_gate_runs`

```text
id UUID PK
release_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
required_artifact_count INT NOT NULL
verified_artifact_count INT NOT NULL
critical_finding_count INT NOT NULL
high_finding_count INT NOT NULL
cross_file_mismatch_count INT NOT NULL
unapproved_waiver_count INT NOT NULL
unsigned_required_artifact_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 65.37 `manufacturing_release_publications`

```text
id UUID PK
release_job_id UUID NOT NULL
release_manifest_id UUID NOT NULL
publication_target VARCHAR NOT NULL
target_reference JSONB NOT NULL
published_package_ids JSONB NOT NULL
publication_status VARCHAR NOT NULL
external_receipt JSONB NULL
published_by UUID NOT NULL
published_at TIMESTAMPTZ NOT NULL
```

## 65.38 `manufacturing_release_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
release_id UUID NOT NULL
project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
variant_id UUID NOT NULL
manifest_hash CHAR(64) NOT NULL
artifact_semantic_hashes JSONB NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name)
```

## 65.39 `manufacturing_release_diffs`

```text
id UUID PK
base_release_id UUID NOT NULL
target_release_id UUID NOT NULL
identity_diff JSONB NOT NULL
bom_diff JSONB NOT NULL
placement_diff JSONB NOT NULL
gerber_geometry_diff JSONB NOT NULL
drill_diff JSONB NOT NULL
stencil_diff JSONB NOT NULL
drawing_diff JSONB NOT NULL
profile_diff JSONB NOT NULL
toolchain_diff JSONB NOT NULL
risk_summary JSONB NOT NULL
diff_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 65.40 `manufacturing_release_reports`

```text
id UUID PK
release_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
identity_summary JSONB NOT NULL
artifact_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
cross_file_summary JSONB NOT NULL
package_summary JSONB NOT NULL
approval_summary JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(release_job_id, report_version)
```

---

# 66. 对象存储

```text
releases/manufacturing/
  {tenant_id}/{project_id}/
    {release_id}/
      input/
        input-snapshot.json
        source-manifest.json
        variant.json
        bom-source.json
        manufacturing-profiles/
        coordinate-contract.json
        toolchain-snapshot.json
      plans/
        export-plan.json
        jobset/
        execution-manifest.json
      raw-export/
        gerber/
        drill/
        bom/
        cpl/
        drawings/
        stencil/
        intelligent/
        3d/
      parsed/
        gerber/
        drill/
        bom/
        cpl/
        drawings/
        stencil/
        intelligent/
      verification/
        layer-manifest.json
        gerber-geometry/
        drill-reconciliation/
        bom-reconciliation/
        cpl-reconciliation/
        drawing-checks/
        stencil-checks/
        intelligent-checks/
        cross-file/
        archive/
      packages/
        fabrication/
        assembly/
        stencil/
        intelligent/
        archive/
      manifests/
        release-manifest.json
        checksums.sha256
        signatures/
        approvals.json
        waivers.json
      reports/
        manufacturing-release.html
        manufacturing-release.pdf
        artifact-matrix.csv
        layer-matrix.csv
        drill-report.csv
        bom-cpl-reconciliation.csv
        stencil-report.csv
        release-diff.csv
        release-gate.json
      debug/
        command-trace.jsonl.zst
        parser-trace.jsonl.zst
        verification-trace.jsonl.zst
        resource-usage.json
```

---

# 67. API 设计

## 67.1 Release Jobs

```text
POST /api/v1/manufacturing-releases
GET  /api/v1/manufacturing-releases
GET  /api/v1/manufacturing-releases/{id}
POST /api/v1/manufacturing-releases/{id}/cancel
POST /api/v1/manufacturing-releases/{id}/retry
GET  /api/v1/manufacturing-releases/{id}/events
```

## 67.2 Snapshot and Readiness

```text
POST /api/v1/manufacturing-releases/{id}/freeze-input
GET  /api/v1/manufacturing-releases/{id}/input-snapshot
POST /api/v1/manufacturing-releases/{id}/validate-readiness
GET  /api/v1/manufacturing-releases/{id}/readiness
GET  /api/v1/manufacturing-releases/{id}/identity
```

## 67.3 Profiles

```text
POST /api/v1/manufacturing-profiles
GET  /api/v1/manufacturing-profiles
GET  /api/v1/manufacturing-profiles/{id}
POST /api/v1/manufacturing-profiles/{id}/validate
POST /api/v1/manufacturing-releases/{id}/bind-profile
GET  /api/v1/manufacturing-releases/{id}/profiles
```

## 67.4 Coordinate Contracts

```text
POST /api/v1/coordinate-contracts
GET  /api/v1/coordinate-contracts
GET  /api/v1/coordinate-contracts/{id}
POST /api/v1/coordinate-contracts/{id}/validate
GET  /api/v1/manufacturing-releases/{id}/coordinate-contract
```

## 67.5 Export Plans and Runs

```text
POST /api/v1/manufacturing-releases/{id}/export-plan
GET  /api/v1/manufacturing-releases/{id}/export-plan
POST /api/v1/manufacturing-releases/{id}/run-export
GET  /api/v1/manufacturing-releases/{id}/export-runs
GET  /api/v1/manufacturing-export-runs/{id}
GET  /api/v1/manufacturing-export-runs/{id}/logs
```

## 67.6 Artifacts

```text
GET  /api/v1/manufacturing-releases/{id}/artifacts
GET  /api/v1/manufacturing-artifacts/{id}
GET  /api/v1/manufacturing-artifacts/{id}/download
GET  /api/v1/manufacturing-artifacts/{id}/metadata
POST /api/v1/manufacturing-artifacts/{id}/reverify
```

## 67.7 Gerber and Drill

```text
POST /api/v1/manufacturing-releases/{id}/generate-gerber
POST /api/v1/manufacturing-releases/{id}/generate-drill
POST /api/v1/manufacturing-artifacts/{id}/parse-gerber
POST /api/v1/manufacturing-artifacts/{id}/parse-drill
GET  /api/v1/manufacturing-releases/{id}/layer-manifest
GET  /api/v1/manufacturing-releases/{id}/drill-manifest
POST /api/v1/manufacturing-releases/{id}/verify-gerber-geometry
POST /api/v1/manufacturing-releases/{id}/reconcile-drill
```

## 67.8 BOM and CPL

```text
POST /api/v1/manufacturing-releases/{id}/generate-bom
POST /api/v1/manufacturing-releases/{id}/generate-cpl
GET  /api/v1/manufacturing-releases/{id}/bom
GET  /api/v1/manufacturing-releases/{id}/cpl
POST /api/v1/manufacturing-releases/{id}/reconcile-bom
POST /api/v1/manufacturing-releases/{id}/reconcile-cpl
GET  /api/v1/manufacturing-releases/{id}/bom-cpl-matrix
```

## 67.9 Drawings and Stencil

```text
POST /api/v1/manufacturing-releases/{id}/generate-fabrication-drawing
POST /api/v1/manufacturing-releases/{id}/generate-assembly-drawings
POST /api/v1/manufacturing-releases/{id}/generate-stencil
POST /api/v1/manufacturing-releases/{id}/verify-drawings
POST /api/v1/manufacturing-releases/{id}/verify-stencil
GET  /api/v1/manufacturing-releases/{id}/stencil-report
```

## 67.10 Intelligent Outputs

```text
POST /api/v1/manufacturing-releases/{id}/generate-ipc2581
POST /api/v1/manufacturing-releases/{id}/generate-odbpp
POST /api/v1/manufacturing-releases/{id}/generate-gencad
GET  /api/v1/manufacturing-releases/{id}/mapping-loss
POST /api/v1/manufacturing-releases/{id}/verify-intelligent-data
```

## 67.11 Cross-file Verification

```text
POST /api/v1/manufacturing-releases/{id}/run-cross-file-checks
GET  /api/v1/manufacturing-releases/{id}/cross-file-checks
GET  /api/v1/manufacturing-releases/{id}/findings
GET  /api/v1/manufacturing-findings/{id}
POST /api/v1/manufacturing-findings/{id}/waive
```

## 67.12 Packaging and Release

```text
POST /api/v1/manufacturing-releases/{id}/build-packages
GET  /api/v1/manufacturing-releases/{id}/packages
GET  /api/v1/manufacturing-packages/{id}
POST /api/v1/manufacturing-packages/{id}/verify
POST /api/v1/manufacturing-releases/{id}/generate-manifest
POST /api/v1/manufacturing-releases/{id}/sign
POST /api/v1/manufacturing-releases/{id}/approve
POST /api/v1/manufacturing-releases/{id}/run-release-gate
POST /api/v1/manufacturing-releases/{id}/publish
```

## 67.13 Diff and Reports

```text
POST /api/v1/manufacturing-releases/{id}/baseline
POST /api/v1/manufacturing-releases/compare
GET  /api/v1/manufacturing-release-diffs/{id}
GET  /api/v1/manufacturing-releases/{id}/report
GET  /api/v1/manufacturing-releases/{id}/artifact-matrix.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 68. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.variant.approved
schematic-review.completed
pcb-constraints.constraint-ir-ready
pcb-placement.completed
pcb-routing.completed
pcb-review.completed
mechanical-review.completed
bom.snapshot.approved
manufacturing-release.requested
```

## 输出事件

```text
manufacturing-release.input-blocked
manufacturing-release.snapshot-frozen
manufacturing-release.profile-blocked
manufacturing-release.coordinate-blocked
manufacturing-release.export-started
manufacturing-release.artifact-generated
manufacturing-release.artifact-verification-failed
manufacturing-release.cross-file-mismatch
manufacturing-release.packages-ready
manufacturing-release.manifest-ready
manufacturing-release.signature-ready
manufacturing-release.gate-blocked
manufacturing-release.published
manufacturing-release.completed
manufacturing-release.failed
```

---

# 69. Policy 组织

```text
policies/
├── manufacturing-release-1.0.0.yaml
├── readiness-gates.yaml
├── identity/
│   ├── revisions.yaml
│   ├── variants.yaml
│   └── release-naming.yaml
├── toolchain/
│   ├── allowed-versions.yaml
│   ├── jobsets.yaml
│   └── determinism.yaml
├── coordinates/
│   ├── origins.yaml
│   ├── units.yaml
│   ├── bottom-transform.yaml
│   └── rotations.yaml
├── gerber/
│   ├── layers.yaml
│   ├── x2-x3.yaml
│   ├── precision.yaml
│   ├── naming.yaml
│   └── geometry-comparison.yaml
├── drill/
│   ├── formats.yaml
│   ├── plating.yaml
│   ├── slots.yaml
│   ├── spans.yaml
│   └── reconciliation.yaml
├── bom/
│   ├── schemas.yaml
│   ├── aggregation.yaml
│   ├── dnp.yaml
│   ├── alternates.yaml
│   └── reconciliation.yaml
├── cpl/
│   ├── schemas.yaml
│   ├── centroids.yaml
│   ├── rotation-mappings.yaml
│   ├── bottom-side.yaml
│   └── reconciliation.yaml
├── drawings/
│   ├── fabrication.yaml
│   ├── assembly.yaml
│   ├── title-block.yaml
│   └── labels.yaml
├── stencil/
│   ├── apertures.yaml
│   ├── thermal-pads.yaml
│   ├── fine-pitch.yaml
│   ├── variants.yaml
│   └── ratios.yaml
├── intelligent/
│   ├── ipc2581.yaml
│   ├── odbpp.yaml
│   ├── gencad.yaml
│   └── mapping-loss.yaml
├── packages/
│   ├── fabrication.yaml
│   ├── assembly.yaml
│   ├── stencil.yaml
│   ├── archive.yaml
│   └── deterministic-zip.yaml
├── signing.yaml
├── waivers.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 70. Export Provider 接口

```python
class ManufacturingExportProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_request(self, request) -> ValidationResult: ...
    async def export(self, request) -> ExportResult: ...
    async def explain(self, result) -> ExportTrace: ...
```

Provider 类型：

```text
kicad_cli
kicad_jobset
controlled_parser_serializer
bom_engine
drawing_engine
stencil_engine
ipc2581
odbpp
vendor_adapter
```

---

# 71. Verification Provider 接口

```python
class ManufacturingVerificationProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def parse(self, artifact) -> ParsedArtifact: ...
    async def verify(self, request) -> VerificationResult: ...
    async def compare(self, source, parsed) -> ComparisonResult: ...
```

---

# 72. Provider Admission

保存：

```text
provider name/version
supported formats
supported format revisions
determinism
known limitations
license
security profile
golden fixtures
approval status
```

`unknown` 不视为支持。

---

# 73. KiCad Jobset 策略

Jobset 适合：

```text
固定输出集合
统一命名
批量导出
重复执行
工程内可审查配置
```

Agent 仍需：

```text
冻结 Jobset Hash
显式选择 Destination
记录每个 Job 结果
独立验证每个输出
处理 stop-on-error
```

不能只记录整个 Jobset 的最终退出码。

---

# 74. BOM Engine

职责：

```text
读取 Canonical Part Instance
应用 Variant
应用 DNP
聚合
字段映射
格式化
生成 Profile-specific CSV/XLSX/JSON
```

核心 BOM 真值使用 Canonical JSON/Parquet，CSV 只是输出视图。

---

# 75. Drawing Engine

要求：

```text
deterministic layout
vector output
controlled fonts
stable title block
explicit views
reference placement strategy
collision-aware label placement
no AI raster generation
```

推荐输出：

```text
PDF
SVG
DXF optional
```

---

# 76. Stencil Engine

职责：

```text
读取 Paste Pad Geometry
应用 Variant
应用 Stencil Profile
生成 Aperture Geometry
导出 Gerber
生成 Rule Trace
```

任何自动 Aperture 修改默认需要工程 Profile 批准。

---

# 77. Parser-first 验证

生成后先解析，再打包：

```text
Export
→ Parse
→ Canonical Artifact IR
→ Verify
→ Cross-file Check
→ Package
```

解析失败的 Required Artifact 不得进入 Package。

---

# 78. Canonical Artifact IR

```json
{
  "artifact_ir_version": "1.0.0",
  "artifact_role": "gerber_layer",
  "format": {},
  "coordinate_contract": {},
  "content": {},
  "source_mapping": [],
  "semantic_hash": "sha256",
  "provenance": {}
}
```

---

# 79. Release Diff

比较：

```text
identity
variant
BOM
component population
placements
rotation
Gerber geometry
drill
stackup
stencil
drawings
profiles
toolchain
waivers
```

输出“文件 Hash 改变但语义未改变”与“语义改变”。

---

# 80. 可观测性

```text
manufacturing_release_jobs_total{status,type}
manufacturing_export_runs_total{artifact_role,status}
manufacturing_export_duration_seconds{artifact_role,provider}
manufacturing_artifacts_total{role,verification}
manufacturing_gerber_parse_failures_total{type}
manufacturing_drill_mismatches_total{type}
manufacturing_bom_mismatches_total{type}
manufacturing_cpl_mismatches_total{type}
manufacturing_stencil_findings_total{type}
manufacturing_cross_file_findings_total{type,severity}
manufacturing_package_checks_total{type,status}
manufacturing_signature_runs_total{status}
manufacturing_release_gate_blocks_total{reason}
manufacturing_release_publications_total{target,status}
```

---

# 81. Dashboard

```text
Release Identity
Input Snapshot
Profiles
Coordinate Contract
Toolchain
Export Plan
Gerber Layers
Drill
BOM
CPL
Drawings
Stencil
Intelligent Data
Cross-file Matrix
Packages
Findings
Waivers
Approvals
Signatures
Release Diff
Publication
```

---

# 82. 安全与权限

- 工程、BOM、生产文件、供应商 Profile 和发布包按租户/项目隔离；
- Export Worker 默认无公网；
- 禁止任意 Shell；命令由类型化 Builder 生成；
- 输出目录使用系统创建的独立 Workspace；
- 防止 Path Traversal、Symlink、Case Collision、Zip Slip 和旧文件污染；
- 生成前输出目录必须为空或为新目录；
- 不在原工程目录直接生成发布文件；
- Parser 和 Viewer 在隔离容器中运行；
- 限制 CPU、内存、磁盘、文件数、单文件大小和运行时间；
- 对 ZIP、ODB++ 和嵌套目录执行安全扫描；
- 发布、签名、上传和订单创建权限分离；
- Private Key 仅使用 Secret Reference/HSM/KMS，不记录密钥内容；
- Production Release 建议双人或多角色审批；
- 不允许 Agent 或 AI 自我批准；
- 不发送私有工程和生产包给外部通用模型；
- 公开 Fixture 仅使用开源、合成、脱敏或授权数据；
- Release、Manifest、Signature、Approval 和 Waiver 不可硬删除；
- 下载和发布行为写入审计日志。

---

# 83. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
```

数据：

```text
Polars
PyArrow
DuckDB
Decimal
```

EDA：

```text
KiCad CLI
KiCad Jobsets
Agent 16 parser
Agent 19 workspace/execution
```

格式：

```text
Gerber parser/verifier
Excellon/XNC parser
CSV/JSON schema
PDF/SVG structural checker
ZIP deterministic builder
XML parser for IPC-2581
ODB++ adapter optional
```

前端：

```text
React
TypeScript
Gerber/Drill Viewer
BOM/CPL Table
Layer Overlay
Cross-file Diff
Release Approval UI
```

---

# 84. 推荐仓库结构

```text
manufacturing-release-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── manufacturing-release-agent-spec.md
│   ├── release-identity-and-snapshot.md
│   ├── readiness-gates.md
│   ├── manufacturing-profiles.md
│   ├── coordinate-contract.md
│   ├── toolchain-and-jobsets.md
│   ├── gerber-generation-and-verification.md
│   ├── drill-generation-and-verification.md
│   ├── bom-generation-and-reconciliation.md
│   ├── cpl-generation-and-rotation.md
│   ├── fabrication-and-assembly-drawings.md
│   ├── stencil-generation-and-review.md
│   ├── intelligent-manufacturing-data.md
│   ├── cross-file-consistency.md
│   ├── deterministic-packaging.md
│   ├── release-manifest-and-signing.md
│   ├── release-diff.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-one-release-one-snapshot.md
│       ├── 0002-coordinate-contract-is-shared.md
│       ├── 0003-export-success-is-not-verification.md
│       ├── 0004-bom-cpl-drawing-must-reconcile.md
│       ├── 0005-stencil-is-not-raw-paste-copy.md
│       ├── 0006-releases-are-immutable.md
│       └── 0007-ai-is-not-a-production-data-generator.md
├── src/
│   └── manufacturing_release/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   ├── agent22.py
│       │   ├── agent24.py
│       │   ├── agent25.py
│       │   ├── agent26.py
│       │   ├── agent27.py
│       │   ├── agent28.py
│       │   ├── plm.py
│       │   └── erp.py
│       ├── identity/
│       │   ├── release.py
│       │   ├── revisions.py
│       │   ├── variants.py
│       │   └── snapshots.py
│       ├── profiles/
│       │   ├── manufacturing.py
│       │   ├── coordinates.py
│       │   ├── rotations.py
│       │   ├── stencil.py
│       │   └── validation.py
│       ├── toolchain/
│       │   ├── registry.py
│       │   ├── snapshots.py
│       │   ├── jobsets.py
│       │   ├── commands.py
│       │   └── workspaces.py
│       ├── exports/
│       │   ├── base.py
│       │   ├── gerber.py
│       │   ├── drill.py
│       │   ├── bom.py
│       │   ├── cpl.py
│       │   ├── drawings.py
│       │   ├── stencil.py
│       │   ├── ipc2581.py
│       │   ├── odbpp.py
│       │   ├── gencad.py
│       │   └── step.py
│       ├── parsers/
│       │   ├── gerber.py
│       │   ├── drill.py
│       │   ├── bom.py
│       │   ├── cpl.py
│       │   ├── drawings.py
│       │   ├── ipc2581.py
│       │   └── archive.py
│       ├── verification/
│       │   ├── layers.py
│       │   ├── gerber_geometry.py
│       │   ├── drill.py
│       │   ├── bom.py
│       │   ├── cpl.py
│       │   ├── drawings.py
│       │   ├── stencil.py
│       │   ├── intelligent.py
│       │   └── cross_file.py
│       ├── bom/
│       │   ├── canonical.py
│       │   ├── aggregation.py
│       │   ├── variants.py
│       │   ├── schemas.py
│       │   └── reconciliation.py
│       ├── cpl/
│       │   ├── coordinates.py
│       │   ├── centroids.py
│       │   ├── rotations.py
│       │   ├── bottom_side.py
│       │   └── reconciliation.py
│       ├── drawings/
│       │   ├── fabrication.py
│       │   ├── assembly.py
│       │   ├── labels.py
│       │   ├── title_block.py
│       │   └── validation.py
│       ├── stencil/
│       │   ├── apertures.py
│       │   ├── thermal_pads.py
│       │   ├── fine_pitch.py
│       │   ├── variants.py
│       │   └── verification.py
│       ├── packaging/
│       │   ├── fabrication.py
│       │   ├── assembly.py
│       │   ├── stencil.py
│       │   ├── archive.py
│       │   ├── deterministic_zip.py
│       │   └── validation.py
│       ├── manifests/
│       │   ├── artifacts.py
│       │   ├── release.py
│       │   ├── checksums.py
│       │   ├── signing.py
│       │   └── diff.py
│       ├── findings/
│       ├── approvals/
│       ├── release/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── manufacturing-profiles/
├── coordinate-profiles/
├── rotation-profiles/
├── stencil-profiles/
├── drawing-templates/
├── jobsets/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_release_readiness.py
    ├── freeze_release_snapshot.py
    ├── generate_manufacturing_artifacts.py
    ├── verify_gerber_and_drill.py
    ├── reconcile_bom_cpl.py
    ├── verify_stencil.py
    ├── build_release_packages.py
    ├── verify_release_manifest.py
    ├── compare_manufacturing_releases.py
    └── run_manufacturing_release_benchmark.py
```


---

# 85. Codex 分阶段实施

不要让 Codex 一次实现 KiCad Jobset、Gerber/Drill Parser、BOM/CPL、旋转映射、钢网、图纸、IPC-2581、签名、发布 UI 和全部厂商 Profile。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–28 的真实实现和数据契约；
2. 当前 Project/Schematic/PCB/Assembly/Variant Revision；
3. 当前 BOM、DNP、Alternate、Internal Part Number 和 Variant 数据；
4. 当前 KiCad 版本、`kicad-cli`、Jobset 和 Export 能力；
5. 当前 Gerber Plot 设置、Layer Set、X2、Origin 和 Precision；
6. 当前 Drill、PTH/NPTH、Slot、Blind/Buried、Microvia 和 Backdrill；
7. 当前 Position/CPL 导出、Bottom Transform 和 Rotation 规则；
8. 当前 BOM 导出 Preset、字段和聚合；
9. 当前 Fabrication/Assembly Drawing；
10. 当前 Paste/Stencil、Aperture 修改和 DNP 策略；
11. 当前 IPC-2581、ODB++、GenCAD、IPC-D-356 或其他智能制造格式；
12. 当前 Agent 27 DRC/Connectivity/Release Gate；
13. 当前 Agent 28 Mechanical/Assembly Release Gate；
14. 当前制造商、SMT 厂和钢网 Profile；
15. 当前文件命名、目录和 ZIP 结构；
16. 当前 Gerber、Drill、BOM、CPL Parser；
17. 当前 Geometry Comparison 和 CAM Preview；
18. 当前 BOM/CPL/Assembly Drawing 对账；
19. 当前 Release Manifest、Hash、签名和审批；
20. 当前 PLM/ERP/MES/RFQ/Order 接口；
21. 当前 Queue、Worker、Database、Object Storage 和 Security；
22. 当前开源、合成、脱敏或授权 Fixture；
23. 统计现有生产包中 Revision/Variant/Origin/Rotation 问题；
24. 统计 Gerber/Drill/BOM/CPL/Stencil 缺失和不一致；
25. 统计厂商 Profile 覆盖和人工修正步骤；
26. 统计可重复生成和 Artifact Diff 情况；
27. 只运行只读扫描和安全版本探测；
28. 可以在公开或合成 Fixture 上执行已有导出；
29. 不生成或覆盖正式 Production Release；
30. 不发布或上传给供应商；
31. 不创建采购或生产订单；
32. 不修改 PCB/BOM/Variant；
33. 不创建 Migration；
34. 不安装 EDA/Parser；
35. 不调用外部通用模型；
36. 不读取或打印 Secret、签名私钥和供应商凭证。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Release Job；
- Input Snapshot；
- Manufacturing Profile；
- Coordinate Contract；
- Toolchain Snapshot；
- Variant；
- Export Plan；
- Export Run；
- Artifact；
- Layer Manifest；
- Gerber Parse/Geometry Check；
- Drill Parse/Reconciliation；
- BOM Snapshot/Line/Reconciliation；
- CPL Snapshot/Row/Reconciliation；
- Rotation Profile；
- Drawing；
- Stencil；
- Intelligent Export；
- Cross-file Check；
- Finding；
- Package；
- Manifest；
- Signature；
- Approval；
- Waiver；
- Gate；
- Publication；
- Diff；
- JSON Schema。

## Phase 2：Agent 16–28 Input Gate

实现：

- Project Revision；
- Schematic/PCB Revision；
- Assembly Revision；
- Variant Freeze；
- Agent 18 Release；
- Agent 20 Library Gate；
- Agent 26 Routing Gate；
- Agent 27 DRC Gate；
- Agent 28 Mechanical Gate；
- BOM Freeze；
- Diagnostics；
- Prototype/Production Profile。

## Phase 3：Release Identity 和 Snapshot

实现：

- Release ID；
- Release Name；
- Release Type；
- Revision；
- Variant；
- ECO/ECN；
- Firmware Compatibility；
- Source Hash；
- Snapshot Immutable；
- Idempotency；
- Duplicate Release Gate；
- Manifest Seed。

## Phase 4：Manufacturing Profile Registry

实现：

- Fabricator；
- Assembler；
- Stencil；
- Generic；
- Version；
- Required/Optional Artifacts；
- Naming；
- Format；
- Archive；
- Coordinate；
- BOM/CPL；
- Approval/Deprecation；
- Contract Tests。

## Phase 5：Coordinate Contract

实现：

- Origin；
- Units；
- Axis；
- Rotation；
- Precision；
- Rounding；
- Top Transform；
- Bottom Transform；
- Board Datum；
- Fiducial；
- Hash；
- Visualization；
- Round-trip Tests。

## Phase 6：Rotation Mapping Profiles

实现：

- Library Zero；
- Body Offset；
- Pin-1；
- Top/Bottom；
- Machine Offset；
- Footprint Family；
- Golden Fixture；
- Approval；
- Profile Conflict；
- Audit。

## Phase 7：Toolchain Registry and Snapshot

实现：

- KiCad/CLI；
- Jobset；
- Plugins/Scripts；
- Container；
- Locale/Timezone；
- Fonts；
- Parser/Verifier；
- Version Admission；
- Hash；
- Reproducibility；
- Deprecated Toolchain Gate。

## Phase 8：Export Workspace and Typed Commands

实现：

- Fresh Workspace；
- Read-only Source Copy；
- Empty Output Directories；
- Typed Command Builder；
- Timeout；
- Exit Codes；
- Stdout/Stderr；
- Resource Limits；
- Artifact Discovery；
- No Shell Injection；
- Cleanup。

## Phase 9：KiCad Jobset Adapter

实现：

- Jobset Parse；
- Destination Selection；
- Job Ordering；
- Stop-on-error；
- Per-job Result；
- Output Mapping；
- Jobset Hash；
- Unsupported Job；
- Version Contract；
- Golden Test。

## Phase 10：Gerber Export Provider

实现：

- Explicit Layer List；
- Origin；
- Precision；
- X2 Policy；
- Netlist Attributes；
- Protel Extensions；
- Variant；
- Zone Check；
- Output Naming；
- Layer Manifest；
- Determinism。

## Phase 11：Gerber Parser

实现：

- Format/Unit；
- Aperture；
- Flash/Draw/Region；
- Polarity；
- Attributes；
- Bounds；
- Layer Function；
- Syntax Finding；
- Canonical Plot Geometry；
- Semantic Hash；
- Security Limits。

## Phase 12：Gerber Geometry Verification

实现：

- Source PCB Layer Geometry；
- Plot Geometry；
- Pads/Tracks/Zones；
- Mask；
- Paste；
- Silkscreen；
- Outline；
- Tolerance；
- Allowed Plot Difference；
- Missing/Unexpected；
- Visual Overlay；
- Gate。

## Phase 13：Layer-set and Outline Verification

实现：

- Required Layer；
- Empty Layer；
- Unexpected Layer；
- Copper Count；
- Inner Layer Order；
- Outline Closed；
- Cutouts；
- Duplicate Segments；
- Tiny Gaps；
- Self-intersection；
- File Naming；
- Profile Gate。

## Phase 14：Drill Export Provider

实现：

- Excellon/Gerber；
- Origin；
- Unit；
- Zero Format；
- PTH/NPTH Split；
- Slot Mode；
- Map；
- Report；
- Tenting；
- Precision；
- Output Manifest。

## Phase 15：Drill Parser and Reconciliation

实现：

- Tool Table；
- Plating；
- Hole/Slot；
- Layer Span；
- Blind/Buried；
- Microvia；
- Backdrill Hook；
- Source Object Mapping；
- Count/Diameter/Position；
- Slot Preservation；
- Findings；
- Gate。

## Phase 16：Fabrication Drawing Generator

实现：

- Board Dimensions；
- Hole Table；
- Origin/Datum；
- Stack-up；
- Board Thickness；
- Materials；
- Finish；
- Mask/Silk；
- Special Process；
- Revision Block；
- Vector PDF/SVG；
- Controlled Text；
- Template Version。

## Phase 17：Stack-up and Impedance Tables

实现：

- Agent 24 Snapshot；
- Layer Table；
- Material；
- Thickness/Copper；
- Dk/Df Conditions；
- Impedance Targets；
- Tolerance；
- Manufacturer Adjustment；
- Cross-check with Fab Drawing；
- Findings。

## Phase 18：Canonical BOM Engine

实现：

- Part Instances；
- Internal Part Number；
- MPN/Manufacturer；
- Populate Status；
- Variant；
- DNP；
- Alternate Groups；
- Mechanical/Consigned；
- Effectivity；
- Canonical JSON/Parquet；
- Stable Row Keys。

## Phase 19：BOM Aggregation and Export

实现：

- Configurable Group Key；
- Quantity/Refdes；
- CSV/JSON/XLSX optional；
- Column Schema；
- Encoding；
- Sorting；
- Delimiters；
- Supplier Profile；
- No Value-only Aggregation；
- Export Trace。

## Phase 20：BOM Reconciliation

实现：

- Schematic Instances；
- PCB Instances；
- Variant；
- BOM；
- DNP；
- Mechanical；
- Quantity；
- Duplicate Refdes；
- Footprint；
- MPN；
- Alternate；
- Findings；
- Gate。

## Phase 21：Canonical CPL Engine

实现：

- Footprint Instance；
- Placement Point；
- Centroid；
- Custom Offset；
- Side；
- Coordinate Contract；
- Rotation Profile；
- Populate Status；
- Stable Rows；
- Canonical JSON/Parquet。

## Phase 22：CPL Export Adapters

实现：

- Generic CSV；
- Profile-specific Columns；
- Units；
- Top/Bottom Split；
- Side Values；
- Bottom Transform；
- Rotation Range；
- Naming；
- Encoding；
- Export Trace。

## Phase 23：CPL Reconciliation

实现：

- BOM Populated Set；
- CPL Set；
- PCB Position；
- Coordinate Round-trip；
- Side；
- Rotation；
- Board Containment；
- Pick-up Point；
- Duplicate Coordinate；
- DNP；
- Golden Fixtures；
- Gate。

## Phase 24：Assembly Drawing Generator

实现：

- Top/Bottom Views；
- Board Outline；
- Component Outlines；
- Refdes；
- Pin-1/Polarity；
- DNP/Variant；
- Fiducials/Tooling；
- Connector Orientation；
- Label Placement；
- Title Block；
- Vector Output；
- View Declaration。

## Phase 25：Assembly Drawing Verification

实现：

- Populated Ref Coverage；
- DNP Visibility；
- Pin-1；
- Polarity；
- Top/Bottom；
- Label Overlap；
- Page Bounds；
- Title/Revision/Variant；
- Cross-check BOM/CPL；
- Findings。

## Phase 26：Paste and Stencil Canonical Model

实现：

- Pad Paste Geometry；
- Aperture；
- Top/Bottom；
- Variant；
- Source Mapping；
- Profile；
- Rule Trace；
- Canonical Aperture IR；
- Stable Hash。

## Phase 27：Stencil Rules Engine

实现：

- One-to-one；
- Reduction；
- Window Pane；
- Home Plate；
- No-paste；
- Split Aperture；
- Fine Pitch；
- Via-in-pad；
- Step Stencil；
- Thickness；
- Area/Aspect Candidate；
- Approval Policy。

## Phase 28：Stencil Export and Verification

实现：

- Gerber Export；
- Parser；
- Pad-to-aperture Mapping；
- Missing/Unexpected；
- DNP Policy；
- Thermal Pad；
- Fine Pitch；
- Top/Bottom；
- Profile；
- Aperture Report；
- Gate。

## Phase 29：Manufacturing Notes and README

实现：

- Fabrication Notes；
- Assembly Notes；
- Coordinate/Rotation README；
- Variant/DNP；
- Toolchain；
- Contact/Approval；
- Controlled Templates；
- Structure-to-text；
- AI Draft Optional；
- Human Approval；
- No AI Numeric Truth。

## Phase 30：Release Notes and ECO Diff

实现：

- Base Release；
- Target Release；
- BOM Diff；
- Population Diff；
- Placement Diff；
- Gerber Geometry Diff；
- Drill Diff；
- Stencil Diff；
- Profile/Toolchain Diff；
- Risk Summary；
- Human-readable Release Notes。

## Phase 31：IPC-2581 Export Adapter

实现：

- Capability Discovery；
- Version/Units；
- BOM Field Mapping；
- Variant；
- Stack-up；
- Components/Placements；
- Export；
- Secure XML Parse；
- Mapping Manifest；
- Cross-check；
- Receiver Profile；
- Gate。

## Phase 32：ODB++ / GenCAD Adapters

实现：

- Capability Discovery；
- Export；
- Archive Safety；
- Parse/Inventory；
- Mapping Manifest；
- Mapping Loss；
- Cross-file Comparison；
- Receiver Profile；
- Candidate-only when incomplete。

## Phase 33：Cross-file Consistency Engine

实现：

- PCB↔Gerber；
- PCB↔Drill；
- PCB↔CPL；
- Schematic/PLM↔BOM；
- BOM↔CPL；
- BOM↔Drawing；
- CPL↔Drawing；
- Paste↔Stencil；
- Stack-up↔Fab Drawing；
- Variant/Revision/Coordinate across all；
- Finding Correlation；
- Critical Gate。

## Phase 34：Deterministic Package Builder

实现：

- Fabrication；
- Assembly；
- Stencil；
- Intelligent；
- Archive；
- Stable File Order；
- Timestamp Policy；
- Permissions；
- No Symlink；
- No Hidden Files；
- No Stale Files；
- Case Collision；
- Package Manifest；
- Semantic Hash。

## Phase 35：Archive Verification

实现：

- Reopen Archive；
- Enumerate Files；
- Hash；
- Manifest Match；
- Path Safety；
- Duplicate/Case；
- Hidden/Temp；
- Nested Archive Policy；
- Required Artifact；
- Profile Structure；
- Findings。

## Phase 36：Release Manifest

实现：

- Release Identity；
- Input Snapshot；
- Toolchain；
- Profiles；
- Coordinate Contract；
- Artifacts；
- Packages；
- Verifications；
- Waivers；
- Approvals；
- Stable Serialization；
- Semantic Hash；
- Schema Validation。

## Phase 37：Checksums and Signing

实现：

- SHA-256；
- Checksums File；
- Detached Signature；
- KMS/HSM Secret Reference；
- Key Rotation；
- Certificate Chain optional；
- Verification；
- Failure Handling；
- No Key Logging；
- Audit。

## Phase 38：Approvals and Release Gate

实现：

- Engineering；
- PCB；
- Assembly；
- Quality；
- Manufacturing；
- Role Separation；
- Waiver；
- Prototype/Production Gate；
- Required Artifacts；
- Critical Findings；
- Signature；
- Immutable State；
- Approval UI。

## Phase 39：Publication and Downstream Handoff

实现：

- PLM Archive；
- ERP/MES；
- Agent 43；
- Agent 44 RFQ/Order；
- Supplier Portal Adapter；
- Receipt；
- Retry/Idempotency；
- Publication Scope；
- No Automatic Order by Default；
- Audit。

## Phase 40：Release Diff and Baseline

实现：

- Baseline；
- Semantic Artifact Diff；
- Identity；
- BOM；
- CPL；
- Gerber；
- Drill；
- Stencil；
- Drawing；
- Toolchain/Profile；
- Waiver；
- Risk；
- Approval Comparison。

## Phase 41：Review Workbench

实现：

- Release Identity；
- Snapshot；
- Layer Viewer；
- Drill Viewer；
- BOM/CPL Matrix；
- Rotation Preview；
- Assembly Drawing；
- Stencil；
- Cross-file Findings；
- Package Tree；
- Manifest；
- Signatures；
- Approvals；
- Diff；
- Publish。

## Phase 42：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch Prototype Releases；
- Progress；
- Cancel/Retry；
- Object Storage；
- Pagination；
- Permissions；
- Audit；
- Metrics；
- Artifact Retention；
- Release Immutability。

## Phase 43：Benchmark、监控和生产发布

实现：

- Gerber Golden；
- Drill Golden；
- BOM/CPL Golden；
- Rotation Matrix；
- Bottom-side Matrix；
- Stencil；
- Intelligent Data；
- Package Determinism；
- Security；
- Performance；
- False Positive/Negative；
- Feature Flags；
- Toolchain Rollback；
- Disaster Recovery。

## Phase 44：高级能力，可选

稳定后：

- Gerber X3 Component Layer；
- Manufacturer API Preview；
- Automatic DFM Feedback Import；
- Panelization Release；
- Multi-board Product Release；
- Rigid-flex Manufacturing Package；
- Backdrill/Coupon Advanced Package；
- Digital Product Model Exchange；
- Cryptographic Transparency Log；
- 仍不自动跳过 CAM/SMT 首件确认。

---

# 86. Codex 工作纪律

Codex 必须：

1. Release Identity 在所有 Artifact 之前；
2. Snapshot 创建后不可变；
3. Project/PCB/Assembly Revision 分开；
4. Variant 显式；
5. Prototype 和 Production Gate 分开；
6. Manufacturing Profile 版本化；
7. Coordinate Contract 共享；
8. Origin 显式；
9. Unit 显式；
10. Bottom Transform 显式；
11. Rotation Profile 显式；
12. CPL Rotation 不直接复制 EDA 值；
13. Toolchain 版本/Hash 完整；
14. Jobset Hash 完整；
15. 每个 Job 单独记录结果；
16. Fresh Workspace；
17. 输出目录不复用；
18. Export Success != Verification Pass；
19. Gerber 必须独立解析；
20. Gerber Layer Function 检查；
21. Required Empty Layer 报告；
22. Gerber Geometry 回读；
23. Outline 关闭和 Cutout 检查；
24. Drill 必须解析 Tool Table；
25. PTH/NPTH 显式；
26. Slot 不可静默退化；
27. Blind/Buried/Microvia Layer Span；
28. Drill 逐 Source Object 对账；
29. BOM Canonical Truth 不是 CSV；
30. DNP 显式；
31. Alternate 显式；
32. Quantity = Refdes Count；
33. BOM 与 PCB/Schematic/Variant 对账；
34. CPL Populated Set = BOM Populated Set；
35. Placement Point 类型保存；
36. Rotation Mapping 有 Golden Fixture；
37. Bottom Side 有 Golden Fixture；
38. Assembly Drawing 有 View 声明；
39. Pin-1/Polarity 是程序真值；
40. AI 不摆放关键标签；
41. Paste 层不等于最终钢网；
42. Aperture 修改有 Profile 和 Trace；
43. Stencil Thickness 是工艺输入；
44. DNP Paste 策略显式；
45. 智能制造格式有 Mapping Manifest；
46. Receiver Capability 显式；
47. Intelligent Package 与传统包对账；
48. Cross-file 检查先于打包；
49. Package 只包含本 Release Artifact；
50. Deterministic ZIP；
51. No Symlink/Hidden/Stale；
52. Manifest 包含所有 Artifact；
53. Checksums 在打包后验证；
54. Signature 使用 Secret Reference；
55. Agent/AI 不自我批准；
56. Release 不可覆盖；
57. 发布目标和 Package Scope 显式；
58. 不自动创建生产订单；
59. Waiver 有范围、原因和审批；
60. Critical Cross-file Mismatch 不可 Waive，除非组织 Policy 明确允许并双人审批；
61. Release Diff 同时比较文件和语义；
62. AI 只写摘要草稿；
63. AI 不计算坐标、数量、孔和几何；
64. 不修改源工程让导出“好看”；
65. Source 问题返回上游 Agent；
66. 不发送私有生产文件给外部模型；
67. 不用客户生产包做公开 Fixture；
68. 不伪造 Gerber、CAM、CPL、签名或发布结果；
69. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Profile/Coordinate/Toolchain 变化；
    - 测试命令和真实结果；
    - Gerber/Drill；
    - BOM/CPL；
    - Drawing/Stencil；
    - Cross-file；
    - Package/Manifest/Signature；
    - Release Gate；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 87. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Identity and Readiness

1. Matching Revisions；
2. Project Revision Mismatch；
3. Assembly Revision Mismatch；
4. Variant Missing；
5. Variant Not Frozen；
6. BOM Not Frozen；
7. DRC Block；
8. Mechanical Block；
9. Prototype-only；
10. Production-ready；
11. Duplicate Release；
12. Snapshot Immutability；
13. Profile Deprecated；
14. Toolchain Unapproved；
15. Jobset Hash Mismatch。

## Coordinate and Rotation

16. Absolute Origin；
17. Drill Origin；
18. Custom Origin；
19. mm/in Conversion；
20. Decimal Rounding；
21. Top Rotation；
22. Bottom Mirror X；
23. Bottom Mirror Y；
24. Bottom Rotation Offset；
25. SOIC Golden；
26. QFN Golden；
27. SOT-23 Golden；
28. Diode Golden；
29. Polarized Capacitor；
30. BGA Golden；
31. Odd-shaped Module；
32. Missing Rotation Profile；
33. Coordinate Round-trip；
34. Board Containment；
35. Fiducial Datum。

## Gerber

36. Two-layer Board；
37. Four-layer Board；
38. Required Empty Layer；
39. Unexpected Layer；
40. X2 Attributes；
41. X2 Disabled Profile；
42. Aperture Macro；
43. Negative Polarity；
44. Zone Geometry；
45. Mask Opening；
46. Paste Opening；
47. Silkscreen；
48. Closed Outline；
49. Tiny Outline Gap；
50. Duplicate Outline；
51. Cutout；
52. Self-intersection；
53. Geometry Mismatch；
54. Filename Collision；
55. Parser Resource Limit。

## Drill

56. PTH；
57. NPTH；
58. Separate PTH/NPTH；
59. Slot Route；
60. Slot Alternate；
61. Blind Via；
62. Buried Via；
63. Microvia；
64. Backdrill Candidate；
65. Tool Diameter Mismatch；
66. Plating Mismatch；
67. Origin Mismatch；
68. Hole Count Mismatch；
69. Drill Map；
70. Drill Report。

## BOM

71. Basic BOM；
72. DNP；
73. Optional；
74. Mechanical Item；
75. Consigned；
76. Alternate Group；
77. Same Value Different Rating；
78. Same MPN Aggregation；
79. Duplicate Refdes；
80. Quantity Mismatch；
81. Footprint Mismatch；
82. Missing MPN；
83. Unicode Description；
84. CSV Escaping；
85. Variant Effectivity。

## CPL

86. Top Components；
87. Bottom Components；
88. Mixed Sides；
89. DNP Exclusion；
90. Missing Refdes；
91. Unexpected Refdes；
92. Invalid Coordinate；
93. Rotation Out of Range；
94. Custom Pickup Point；
95. Body Centroid；
96. Odd-shaped Connector；
97. Bottom Transform Failure；
98. BOM/CPL Equality；
99. Duplicate Coordinate Warning；
100. Through-hole Exclusion Profile。

## Drawing and Stencil

101. Top Assembly Drawing；
102. Bottom View；
103. Missing Reference Label；
104. Label Overlap；
105. Pin-1 Missing；
106. DNP Marking；
107. Revision Title Block；
108. Fab Drawing Stack-up；
109. Hole Table；
110. Thermal Pad Window Pane；
111. Fine-pitch Reduction；
112. No-paste Pad；
113. Via-in-pad；
114. DNP Shared Stencil；
115. Variant-specific Stencil；
116. Top/Bottom Stencil；
117. Step Stencil Profile；
118. Area Ratio Candidate；
119. Paste Geometry Mismatch；
120. Stencil Profile Missing。

## Intelligent Data and Cross-file

121. IPC-2581 Export；
122. IPC-2581 Variant；
123. IPC-2581 BOM Mapping；
124. ODB++ Archive；
125. GenCAD；
126. Mapping Loss；
127. Receiver Unsupported；
128. Layer Count Mismatch；
129. Component Count Mismatch；
130. Net Count Mismatch；
131. BOM/CPL Mismatch；
132. Drawing/CPL Mismatch；
133. Stack-up/Fab Drawing Mismatch；
134. Variant Across Artifacts；
135. Revision Across Artifacts。

## Package, Signing and Workflow

136. Deterministic ZIP；
137. Hidden File；
138. Symlink；
139. Path Traversal；
140. Case Collision；
141. Stale Gerber；
142. Nested Archive；
143. Manifest Complete；
144. Hash Mismatch；
145. Semantic Hash Stable；
146. Signature Pass；
147. Signature Fail；
148. Key Reference Missing；
149. Approval Separation；
150. Waiver Expiry；
151. Release Gate；
152. Immutable Release；
153. Publication Retry；
154. No Automatic Order；
155. Release Diff；
156. Tenant Isolation；
157. Malicious Gerber；
158. Malicious Excellon；
159. CSV Formula Injection；
160. XML Entity Attack；
161. Zip Bomb；
162. Export Timeout；
163. 100-board Batch Prototype；
164. 1 GB ODB++ Package；
165. Audit Replay。

---

# 88. 初始质量目标

```text
One Release / One Input Snapshot = 100%
Cross-revision Artifact Mixing = 0
Coordinate Contract Coverage = 100%
Required Gerber Parse Coverage = 100%
Required Drill Parse Coverage = 100%
Required Gerber Geometry Verification = 100%
Drill Source-object Reconciliation = 100%
BOM Populated Refdes Reconciliation = 100%
CPL Populated Refdes Reconciliation = 100%
Unapproved Rotation Profile Auto-use = 0
Bottom-side Golden Fixture Coverage = 100%
Required Assembly Drawing Refdes Coverage = 100%
Required Stencil Aperture Source Mapping = 100%
Critical Cross-file Mismatch Released = 0
Required Artifact Manifest Coverage = 100%
Required Artifact Hash Coverage = 100%
Production Release without Approval = 0
Released Package Containing Stale Artifact = 0
Released Package Symlink/Path Violation = 0
Private Artifact Sent to External General Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 89. 性能要求

常规工程：

```text
100–2,000 Components
2–20 Copper Layers
100–20,000 Drills/Vias
10–100 Output Artifacts
```

目标：

```text
Readiness P95 < 15 s
Snapshot Freeze P95 < 10 s
Native Export P95 受 EDA CLI 限制
Gerber Parse P95 < 5 s per layer
Drill Parse P95 < 5 s per file
BOM/CPL Reconciliation P95 < 10 s
Cross-file Verification P95 < 60 s
Package Build P95 < 30 s
Manifest/Checksum P95 < 15 s excluding very large intelligent packages
```

大型工程要求：

- Artifact 并行验证；
- 分层缓存；
- Geometry Semantic Hash；
- Parquet；
- Worker Pool；
- Resource Quota；
- Cancel/Retry；
- Partial Diagnostics；
- 发布前必须等待全部 Required Artifact 完成。

---

# 90. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/manufacturing-release-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第29个 Agent：

PCB Manufacturing Release, Fabrication & Assembly Package Generation Agent /
生产文件生成 Agent。

本 Agent 接收：

- Agent 16 Project/Schematic/PCB/Footprint/Pad/Track/Via/Zone/Hole IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Library/Padstack/3D 校验；
- Agent 21 Firmware/Assembly Variant；
- Agent 22 ERC/DNP/额定值和 BOM Finding；
- Agent 24 Stack-up、阻抗和制造约束；
- Agent 25 Placement、Board Outline 和固定件；
- Agent 26 Routing、Track/Via/Zone 和未布网络；
- Agent 27 DRC/SI/PI/EMC Release Gate；
- Agent 28 3D/Mechanical/Assembly Release Gate；
- PLM/ERP BOM、ECO/ECN、内部料号和版本；
- PCB、SMT 和钢网制造 Profile；

生成并验证：

- Gerber；
- Drill；
- Fabrication Drawing；
- Stack-up/Impedance；
- BOM；
- CPL/Pick-and-Place；
- Assembly Drawing；
- Paste/Stencil；
- Manufacturing/Assembly Notes；
- Coordinate/Rotation README；
- IPC-2581/ODB++/GenCAD，可选；
- Fabrication/Assembly/Stencil/Archive Package；
- Release Manifest、Checksum、Signature；
- Cross-file Consistency 和 Release Gate。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–29 规格和 Agent 16–28 实际代码；
3. docs/manufacturing-release-agent-spec.md；
4. 当前 Project/PCB/Assembly/Variant Revision；
5. 当前 BOM/DNP/Alternate/PLM 数据；
6. 当前 KiCad CLI/Jobset/Export；
7. 当前 Gerber/Drill；
8. 当前 Position/CPL/Rotation；
9. 当前 Drawings/Stencil；
10. 当前 IPC-2581/ODB++/GenCAD；
11. 当前 Manufacturing Profiles；
12. 当前 Coordinate Contracts；
13. 当前 Parser/Verifier；
14. 当前 Cross-file Reconciliation；
15. 当前 Package/Manifest/Signing；
16. 当前 PLM/ERP/MES/RFQ/Order；
17. 当前 UI/API/Worker/Storage/Security；
18. 开源、合成、脱敏或授权 Fixture。

硬约束：

- One Release = One Immutable Snapshot；
- Explicit Project/PCB/Assembly Revision；
- Explicit Variant；
- Agent 18/20/26/27/28 Gates；
- Approved Manufacturing Profile；
- Shared Coordinate Contract；
- Explicit Bottom Transform；
- Rotation Profiles with Golden Fixtures；
- Frozen Toolchain/Jobset；
- Fresh Export Workspace；
- Per-job Result；
- Export Success != Verification Pass；
- Independent Gerber/Drill Parsing；
- Gerber Geometry Round-trip；
- Drill Source-object Reconciliation；
- Explicit PTH/NPTH/Slots/Spans；
- Canonical BOM Truth；
- Explicit DNP/Alternate；
- BOM/PCB/Schematic/Variant Reconciliation；
- Canonical CPL；
- BOM Populated Set = CPL Set；
- Assembly Drawings Reconcile；
- Stencil != Raw Paste Copy；
- Stencil Profile and Rule Trace；
- Intelligent Format Mapping Manifest；
- Cross-file Checks Before Package；
- Deterministic Package；
- No Hidden/Stale/Symlink；
- Complete Manifest/Checksums；
- Secret-reference Signing；
- Role-separated Approval；
- Immutable Release；
- No Automatic Supplier Order；
- AI Does Not Generate Coordinates/Geometry/Quantity；
- 不修改源工程掩盖错误；
- 不发送私有资料给外部模型；
- 不用客户生产包做公开 Fixture；
- 不伪造 CAM、签名、发布和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不发布正式生产包：

1. 侦察当前仓库；
2. 检查 Agent 16–28 Contract；
3. 查找 Revision/Variant/BOM；
4. 查找 KiCad CLI/Jobset；
5. 查找 Gerber Export/Settings；
6. 查找 Drill/PTH/NPTH/Slots；
7. 查找 CPL/Origin/Rotation；
8. 查找 BOM Export/Aggregation；
9. 查找 Assembly/Fab Drawing；
10. 查找 Paste/Stencil；
11. 查找 IPC-2581/ODB++/GenCAD；
12. 查找 Manufacturing Profiles；
13. 查找 Coordinate/Rotation Profiles；
14. 查找 Gerber/Drill/BOM/CPL Parser；
15. 查找 Geometry/Cross-file Verification；
16. 查找 Package/Manifest/Signing；
17. 查找 Release Approval/Publication；
18. 查找 UI/API/Worker/Storage/Security；
19. 统计 Revision/Variant/Origin/Rotation 问题；
20. 统计 Gerber/Drill/BOM/CPL/Stencil 问题；
21. 统计可重复生成和 Diff；
22. 抽样分析开源、合成、脱敏或授权 Fixture；
23. 在 docs/manufacturing-release-implementation-plan.md 中生成实施计划；
24. 在 docs/release-identity-and-snapshot.md 中定义 Release；
25. 在 docs/readiness-gates.md 中定义 Gate；
26. 在 docs/manufacturing-profiles.md 中定义 Profile；
27. 在 docs/coordinate-contract.md 中定义坐标；
28. 在 docs/toolchain-and-jobsets.md 中定义工具链；
29. 在 docs/gerber-generation-and-verification.md 中定义 Gerber；
30. 在 docs/drill-generation-and-verification.md 中定义 Drill；
31. 在 docs/bom-generation-and-reconciliation.md 中定义 BOM；
32. 在 docs/cpl-generation-and-rotation.md 中定义 CPL；
33. 在 docs/fabrication-and-assembly-drawings.md 中定义图纸；
34. 在 docs/stencil-generation-and-review.md 中定义钢网；
35. 在 docs/intelligent-manufacturing-data.md 中定义智能格式；
36. 在 docs/cross-file-consistency.md 中定义交叉校验；
37. 在 docs/deterministic-packaging.md 中定义打包；
38. 在 docs/release-manifest-and-signing.md 中定义 Manifest/签名；
39. 在 docs/release-diff.md 中定义 Diff；
40. 在 docs/release-gates.md 中定义发布 Gate；
41. 在 docs/ai-boundaries.md 中定义 AI；
42. 在 docs/security.md 中定义安全；
43. 在 docs/manufacturing-release-migration-plan.md 中定义旧流程迁移；
44. 在 docs/manufacturing-release-benchmark-plan.md 中定义 Benchmark；
45. 给出拟新增、拟修改和拟复用文件；
46. 给出 Phase 1 精确范围；
47. 不修改业务代码；
48. 不创建 Migration；
49. 不安装 EDA/Parser；
50. 不修改 PCB/BOM/Variant；
51. 不生成或覆盖正式 Release；
52. 不上传供应商；
53. 不创建订单；
54. 不调用外部模型；
55. 不读取或打印 Secret/Private Key/Credential；
56. 运行仓库已有 lint、type check、test、build 和 security scan；
57. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–28 Contract；
- Release Identity/Snapshot；
- Readiness Gate；
- Manufacturing Profiles；
- Coordinate/Rotation；
- Toolchain/Jobsets；
- Gerber；
- Drill；
- Fab Drawing/Stack-up；
- BOM；
- CPL；
- Assembly Drawing；
- Stencil；
- Intelligent Formats；
- Cross-file Consistency；
- Package/Manifest/Signing；
- Approval/Publication；
- Release Diff；
- AI Boundaries；
- Security；
- API/Events；
- 旧流程迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 91. 后续 Phase 提示词模板

```text
继续实现 Manufacturing Release Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–29 规格；
3. 阅读 Manufacturing Release Implementation Plan；
4. 阅读 Identity、Gate、Profile、Coordinate、Toolchain、Gerber、Drill、BOM、CPL、Drawing、Stencil、Cross-file、Package、Manifest、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Immutable Release Snapshot；
- Shared Coordinate Contract；
- Independent Artifact Verification；
- Cross-file Reconciliation；
- Deterministic Packaging；
- Role-separated Approval；
- No Source Auto-mutation；
- No External Private Data；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Contract/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. exporter/parser contract test；
10. geometry/reconciliation test；
11. deterministic package test；
12. release gate test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Profile/Coordinate/Toolchain 变化；
- 测试命令和真实结果；
- Gerber/Drill；
- BOM/CPL；
- Drawing/Stencil；
- Cross-file；
- Package/Manifest/Signature；
- Release Gate；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 92. MVP 演示流程

1. 选择一块四层 MCU 产品板，包含 Top/Bottom SMT、PTH 连接器、USB-C、QFN、BGA、热焊盘和两个 Variant；
2. Agent 16解析工程；
3. Agent 18确认 Reviewed Netlist；
4. Agent 20确认 Footprint、Padstack 和 3D；
5. Agent 21冻结 `Standard` Variant；
6. Agent 24提供 Stack-up 和阻抗；
7. Agent 26确认关键网络全部布通；
8. Agent 27通过 DRC Gate；
9. Agent 28通过 Mechanical Assembly Gate；
10. 从 PLM 读取内部料号、MPN、DNP 和 ECO；
11. 创建 Release Identity：`Board-RC-Standard-001`；
12. 冻结 Input Snapshot；
13. 绑定 Generic Fabricator、Generic Assembler 和 0.12mm Stencil Profile；
14. 冻结 Drill/Placement Origin；
15. 校验 Bottom Transform 和 Rotation Profile；
16. 冻结 KiCad 版本、CLI 和 Jobset；
17. 在全新 Workspace 运行 Zone Refill/DRC 预门禁；
18. 导出 F.Cu、In1.Cu、In2.Cu、B.Cu、Mask、Silk、Paste 和 Edge；
19. 独立解析全部 Gerber；
20. 构建 Layer Manifest；
21. 回读 Gerber Geometry；
22. 将铜、Mask、Paste 和 Outline 与 PCB IR 比对；
23. 导出分开的 PTH 和 NPTH Drill；
24. 解析 Drill Tool Table；
25. 逐 Pad/Via/Hole 对账；
26. 导出 Drill Map 和 Report；
27. 生成 Fabrication Drawing；
28. 生成 Stack-up/Impedance Table；
29. 生成 Canonical Assembly BOM；
30. 应用 Standard Variant；
31. 明确排除 DNP；
32. 输出厂商 CSV BOM；
33. 生成 Canonical CPL；
34. 对 Top/Bottom 运行 Rotation Mapping；
35. 使用 SOIC/QFN/BGA/二极管 Golden Fixture 验证；
36. 输出厂商 CSV CPL；
37. 对账 BOM Populated Set 与 CPL；
38. 生成 Top/Bottom Assembly Drawing；
39. 标记 DNP 和 Pin-1；
40. 检查 Drawing Refdes 覆盖；
41. 读取 Paste Pad；
42. 对 QFN Thermal Pad 生成 Window Pane；
43. 检查 Fine-pitch Aperture；
44. 生成 Top/Bottom Stencil Gerber 和 Aperture Report；
45. 可选生成 IPC-2581；
46. 解析 IPC-2581 并对账 Layer、BOM 和 Placement；
47. 运行全部 Cross-file Checks；
48. 发现 Bottom 侧某 SOT-23 Rotation 与 Profile Golden Fixture 不一致；
49. 阻断 Assembly Package；
50. 修复 Rotation Profile，不修改 PCB；
51. 重新生成 CPL；
52. 对账通过；
53. 生成 Fabrication、Assembly 和 Stencil Packages；
54. 重新打开 ZIP 并验证无旧文件、隐藏文件和路径问题；
55. 生成 Release Manifest；
56. 计算 SHA-256；
57. 使用 KMS/HSM 引用完成签名；
58. PCB 工程、制造、质量三角色审批；
59. 运行 Production Release Gate；
60. 将不可变 Package 发布到 PLM；
61. 向 Agent 44提供 Package ID，用于 RFQ，但不自动下单；
62. 发布 `manufacturing-release.published`。

---

# 93. 生产上线顺序

第一阶段：

```text
Release Identity/Snapshot
Generic Profile
Coordinate Contract
KiCad Gerber/Drill
BOM/CPL
Independent Parsing
Cross-file Report
Prototype Package
```

第二阶段：

```text
Fabrication/Assembly Drawings
Stencil Engine
Rotation Golden Fixtures
Deterministic Packages
Manifest/Checksums
Production Approval
```

第三阶段：

```text
IPC-2581/ODB++
Supplier-specific Profiles
Signing/KMS
PLM/ERP/MES
Manufacturer Preview API
Panelization and Multi-board Release
```

上线优先确保：

```text
所有生产文件是否确实来自同一个版本和 Variant
Gerber、Drill、BOM、CPL 和装配图是否使用同一坐标契约
每个文件是否经过独立回读，而不是只相信导出命令
BOM、CPL、DNP、钢网和装配图的位号集合是否完全一致
发布包是否不可变、可复现、可验证并能追溯到工具链
```

一个可靠的生产文件 Agent，最终交付的不是一袋“看起来像生产资料”的文件，而是一份可以证明自己从哪里来、为什么一致、谁批准过、如何验证过的数字化制造发布。
