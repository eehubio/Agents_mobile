# DFM/DFA 制造可行性 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：30  
> Agent 名称：PCB Design for Manufacturing & Assembly Feasibility Agent  
> 中文名称：DFM/DFA 制造可行性 Agent  
> 类型：程序＋规则型  
> 版本：V1.0  
>
> 定位：基于 Agent 16–29 输出的结构化 EDA 工程、Reviewed Netlist、Footprint/Padstack/3D 模型、PCB Constraint IR、Placement IR、Routing IR、DRC/SI/PI/EMC Review、Mechanical Review 和 Manufacturing Release Artifacts，结合版本化 PCB Fabrication、SMT Assembly、Stencil、Panelization、Special Process 和 Inspection Profile，对裸板制造、拼板、钢网、贴装、回流、波峰焊、选择性焊、压接、分板、检测、返修和包装进行可制造性与可装配性审查；区分硬能力违规、工艺窗口不足、加价项、良率风险和信息缺口，输出证据化 Finding、制造商匹配、工艺路线、拼板候选、成本影响、修复建议及 Release Gate。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Board Outline、Cutout、Layer、Footprint、Pad、Track、Via、Zone、Hole、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、网络置信度和 Release Level
> - Agent 20：Footprint、Padstack、Pin-Pad、Courtyard、Fabrication Property、3D Model、库版本和实例一致性
> - Agent 21：Variant、Firmware Configuration、接口速度、驱动强度和器件功能角色
> - Agent 22：ERC、器件额定值、DNP、保护、去耦和典型应用 Finding
> - Agent 23：功耗、工作模式、应力、热负载和仿真结果
> - Agent 24：Stack-up、线宽、间距、孔径、Via、阻焊、Paste、HV、阻抗、制造和装配约束
> - Agent 25：Legalized Placement IR、功能分区、器件方向、固定对象、板框、Fiducial 和 Routing Corridor
> - Agent 26：Routing IR、Track/Via/Zone、铜平衡候选、未布网络和几何结果
> - Agent 27：Native DRC、Connectivity、SI、PI、EMC、回流、阻抗和 Release Finding
> - Agent 28：3D/Mechanical、器件高度、连接器、螺丝、工具、装配顺序、公差和 Release Finding
> - Agent 29：Gerber、Drill、BOM、CPL、Assembly Drawing、Stencil、Release Manifest 和 Artifact Verification
> - Agent 31–40：MPN、生命周期、合规、库存、MOQ、封装、价格和采购数据，可作为 DFA 增强输入
> - Agent 43：EBOM/MBOM/NPI、工艺路线、工序和制造版本
> - PCB 工厂：材料、层数、铜厚、最小线宽间距、孔径、纵横比、阻焊、表面处理、特殊工艺和加价规则
> - SMT/EMS：设备、贴装精度、最小 Pin Pitch、元件尺寸/高度/重量、Nozzle、Feeder、回流、波峰焊、AOI、X-ray 和返修能力
> - 钢网厂：厚度、激光能力、纳米涂层、Step Stencil、开口规则和 Fiducial 规则
> - Panelization：V-score、铣边、Mouse Bite、工艺边、定位孔、Fiducial、托盘和分板设备能力
>
> 下游：
> - Agent 20：封装、Padstack、Courtyard、Paste、Fabrication Property 和封装方向修复
> - Agent 24：制造、装配、拼板、阻焊、钢网和特殊工艺约束
> - Agent 25：器件间距、方向、分板敏感器件、Fiducial、板边和拼板布局修复
> - Agent 26：线宽、间距、Via、铜到边、铜平衡、热焊盘、测试点和工艺相关布线修复
> - Agent 27：规则、热、SI/PI/EMC 和特殊工艺影响回归
> - Agent 28：高度、工具、装配顺序、连接器和返修空间回归
> - Agent 29：重新生成和验证生产文件
> - Agent 19：在 Workspace 中执行批准的 ECAD 变更
> - Agent 43：建立 MBOM、工艺路线、Panel/Array、工序和 NPI Gate
> - Agent 44：匹配 PCB/SMT 厂、RFQ、成本和订单
> - Agent 45：AOI、X-ray、ICT、FCT、来料和过程质量计划
>
> 核心输出：
> - DFM/DFA Input Snapshot
> - Manufacturing Capability Profile Snapshot
> - Process Route Candidate
> - Fabrication DFM Finding Set
> - Assembly DFA Finding Set
> - Stencil Manufacturability Finding Set
> - Panelization Feasibility and Candidate Set
> - Component Mountability and Process Compatibility Report
> - Special Process Requirement and Capability Match
> - Yield Risk and Process Window Report
> - Cost Adder and Lead-time Impact Report
> - Manufacturer/Assembler Compatibility Matrix
> - Rule Coverage and Effective Capability Trace
> - DFM Geometry Evidence Package
> - DFA Placement/Orientation Evidence Package
> - Panel Drawing and Panel IR Candidate
> - Repair Candidate and Upstream Feedback
> - Agent 19 Change Plan Candidate
> - Post-repair DFM/DFA Regression Report
> - Prototype/Pilot/Mass-production Release Gate
>
> 重要边界：
> - 本 Agent 检查设计相对于指定制造 Profile 的可制造性，不替代制造商 CAM、工艺工程、首件、试产和质量签核。
> - KiCad DRC 通过不代表特定工厂、特定铜厚、特定层数和特定价格等级可制造。
> - 制造商公开能力通常同时包含“推荐值”“标准能力”“高级能力”和“评估后能力”；系统必须区分，不能只保存一个最小值。
> - 不把某家工厂今天的能力硬编码为永久规则；所有 Profile 必须有来源、版本、有效期和适用条件。
> - 不把绝对最小能力当作推荐设计值；接近能力边界必须输出工艺窗口和良率风险。
> - 不把 Gerber CAM 修正视为设计已经正确；任何修改必须回写为明确的制造偏差或上游修复。
> - 不把所有拼板强制为同一尺寸或同一方式；V-score、Tab Route、Mouse Bite、混拼和托盘需按板形、器件和工艺选择。
> - 不把元件 Courtyard 无重叠判定为可贴装；还需考虑 Nozzle、Feeder、设备视觉、返修、热质量、阴影效应和分板应力。
> - 不把器件方向统一作为绝对规则；极性、光学检测、波峰焊方向、热风方向和连接器功能优先级可能不同。
> - 不把 DNP 器件自动从钢网删除；由 Variant 和 Stencil Profile 决定。
> - 不把所有 Via-in-Pad 判定为错误；必须区分未填孔、塞孔、填孔电镀、树脂填充、铜填充和 Microvia。
> - 不把阻焊桥缺失一律判定不可做；需结合 Pad Pitch、颜色、表面处理、阻焊工艺和厂商能力。
> - 不将 Acid Trap、Tombstone、Head-in-Pillow、Void、Solder Beading 等启发式风险描述为确定缺陷。
> - 不自动改变板层、材料、铜厚、表面处理、钢网厚度、Panel 数量或特殊工艺来让设计通过。
> - 不自动接受制造商对设计的 CAM 修改；必须形成 Manufacturing Deviation。
> - 不把私有生产文件、供应商能力、报价和良率数据发送给外部通用模型。
> - AI 仅用于规则资料提取、Finding 解释和工艺说明，不参与几何真值、数值阈值和 Release 判定。

---

# 1. Agent 30 的系统位置

```text
Approved PCB + Manufacturing Release Artifacts
                         ↓
Capability / Process / Variant Readiness Gate
                         ↓
Canonical Manufacturing Feature Extraction
                         ↓
Fabrication DFM Rules
                         ↓
Stencil and Assembly DFA Rules
                         ↓
Panelization and Depanelization Analysis
                         ↓
Special Process and Equipment Capability Match
                         ↓
Yield / Cost / Lead-time Classification
                         ↓
Findings, Manufacturer Matrix and Repair Candidates
                         ↓
Agent 20/24/25/26/27/28/29 Feedback
                         ↓
Agent 19 Controlled Repair
                         ↓
Regenerate Release and Full DFM/DFA Regression
```

---

# 2. DRC、DFM 和 DFA 的边界

## DRC

```text
设计是否违反当前 EDA 工程中的规则
网络是否短路、开路或未连接
几何是否满足已配置约束
```

## DFM

```text
裸板是否适合某个实际制造工艺
工艺窗口、补偿、材料和设备能否覆盖
是否需要高级工艺、加价或人工 CAM
```

## DFA

```text
器件是否能被设备稳定贴装和焊接
拼板、方向、间距、Fiducial、钢网和工序是否合理
是否适合检查、分板、返修和量产
```

三者结果不可混为一个 Pass/Fail。

---

# 3. 审查等级

```text
L0 source-data and native-rule validation
L1 deterministic geometry checks
L2 manufacturer-profile checks
L3 process-window and yield heuristics
L4 supplier CAM/DFM feedback
L5 pilot-production and measured yield correlation
```

每个 Finding 必须记录 `analysis_level`。

---

# 4. 制造能力层级

```text
recommended
standard
advanced
engineering_review
unsupported
unknown
```

---

# 5. Finding 结论层级

```text
hard_capability_violation
process_window_risk
yield_risk
cost_adder
lead_time_adder
manual_review_required
information_required
optimization_opportunity
```

---

# 6. Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "assembly_revision": "string",
  "variant_id": "uuid",
  "agent16_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_scan_hash": "sha256",
  "agent24_constraint_hash": "sha256",
  "agent25_placement_hash": "sha256",
  "agent26_routing_hash": "sha256",
  "agent27_review_hash": "sha256",
  "agent28_review_hash": "sha256",
  "agent29_release_manifest_hash": "sha256",
  "fabrication_profile_hash": "sha256",
  "assembly_profile_hash": "sha256",
  "stencil_profile_hash": "sha256",
  "panel_profile_hash": "sha256",
  "process_route_hash": "sha256",
  "policy_hash": "sha256"
}
```

---

# 7. Readiness Gate

## Blocked

```text
Project/Assembly/Variant 不一致
Agent 18 Release 太低
Agent 20 Padstack/Footprint Critical
Agent 26 Critical Net 未布
Agent 27 DRC Error
Agent 28 Critical Mechanical Finding
Agent 29 Required Artifact Verification 失败
Board Outline 无效
制造 Profile 缺失或过期
铜厚/层叠/表面处理不明确
装配工艺路线不明确
```

## Generic Review

```text
使用通用制造 Profile
无真实设备和供应商数据
仅可输出风险与候选
```

## Supplier-specific Review

```text
制造商和装配厂 Profile 已批准
工艺路线和数量等级明确
```

## Production-correlated Review

```text
已有 CAM Feedback
已有试产良率、缺陷和返修数据
```

---

# 8. Manufacturing Capability Profile

包含：

```text
supplier
site/factory
profile version
effective date
board type
material family
layer count range
finished thickness
copper weight
trace/space
annular ring
drill
aspect ratio
hole-to-copper
solder mask
silkscreen
surface finish
impedance
via process
edge process
special process
panel limits
inspection
price tier
lead-time tier
```

Profile 必须支持条件表达式，而不是只有扁平阈值。

---

# 9. Assembly Capability Profile

包含：

```text
line/site
printer
SPI
placement machines
feeder types
nozzle library
minimum/maximum component size
component height
component weight
pin pitch
placement accuracy
reflow zones
nitrogen
wave solder
selective solder
press-fit
dispensing
underfill
conformal coating
AOI
X-ray
ICT/FCT
rework
panel conveyor limits
```

---

# 10. Stencil Capability Profile

包含：

```text
material
thickness
laser capability
electroform optional
nano coating
minimum aperture
minimum web
aspect ratio
area ratio
step-up/down
maximum step
fiducials
frame
top/bottom policy
window-pane rules
fine-pitch rules
```

---

# 11. Panelization Profile

包含：

```text
minimum/maximum panel dimensions
conveyor width
preferred panel dimensions
rail width
tooling holes
global/local fiducials
V-score capability
minimum V-score spacing
tab route
mouse bite
routing tool diameter
breakaway tab
mixed design policy
array spacing
warpage limits
depanel equipment
support pallet
```

---

# 12. Process Route Candidate

```json
{
  "route_id": "uuid",
  "board_fabrication": {},
  "stencil": {},
  "smt_top": {},
  "reflow_top": {},
  "smt_bottom": {},
  "reflow_bottom": {},
  "through_hole": {},
  "wave_or_selective": {},
  "press_fit": {},
  "cleaning": {},
  "coating": {},
  "inspection": {},
  "test": {},
  "depanel": {},
  "packaging": {}
}
```

---

# 13. Canonical Manufacturing Feature IR

```json
{
  "feature_ir_version": "1.0.0",
  "board": {},
  "layers": [],
  "copper_features": [],
  "drill_features": [],
  "mask_features": [],
  "paste_features": [],
  "outline_features": [],
  "component_features": [],
  "panel_features": [],
  "special_process_features": [],
  "provenance": {}
}
```


---

# 14. Fabrication Feature 类型

```text
track
arc
pad
via
plane
zone_neck
copper_sliver
copper_island
annular_ring
hole
slot
cutout
board_edge
solder_mask_opening
solder_mask_dam
silkscreen
impedance_coupon
castellation
edge_plating
backdrill
controlled_depth
```

---

# 15. 最小线宽和间距

检查维度：

```text
outer/inner layer
copper weight
finished copper
local/global occurrence
critical length
density
same/different net
neck-down
BGA escape
etch compensation
price tier
```

输出不能只写“最小值”，而应记录：

```text
actual
recommended
standard minimum
advanced minimum
affected length/count
local density
cost/lead-time class
```

---

# 16. Copper Spacing 类型

```text
track-to-track
track-to-pad
pad-to-pad
copper-to-hole
copper-to-board-edge
copper-to-slot
copper-to-route
copper-to-vscore
copper-to-metal-part
inner-layer hole clearance
```

---

# 17. Annular Ring

检查：

```text
finished hole
drill compensation
pad diameter
registration allowance
outer/inner layer
PTH/NPTH
slot
breakout probability candidate
```

区分设计环宽与制造后的最小有效环宽。

---

# 18. Drill 和孔径

检查：

```text
minimum drill
finished hole
tool availability
plating allowance
hole tolerance
PTH/NPTH
slot width
slot length
aspect ratio
layer span
microvia depth
stacked/staggered microvia
backdrill
press-fit hole
```

---

# 19. Aspect Ratio

需绑定：

```text
board thickness
drill diameter
via type
plating requirement
material
supplier profile
```

不使用固定常数覆盖所有孔类型。

---

# 20. Hole-to-copper 和 Hole-to-hole

检查：

```text
drill wander
registration
plating
inner layer compensation
via field density
mechanical hole
routed slot
backdrill
```

---

# 21. Solder Mask

检查：

```text
mask expansion
mask-to-copper
mask dam/bridge
fine-pitch opening
shared opening
sliver
plug/tent policy
via exposure
fiducial opening
color/process capability
```

状态：

```text
dam_present
dam_absent_but_supported
shared_opening_required
sliver_risk
unmanufacturable
manual_review
```

---

# 22. Silkscreen

检查：

```text
silk-to-pad
silk-to-mask
silk-to-board-edge
minimum line
minimum text height
minimum stroke
polarity visibility
reference visibility
barcode/QR readability
```

---

# 23. Copper Balance 和 Density

检查：

```text
layer copper percentage
local window density
top/bottom imbalance
inner-pair imbalance
large copper-free area
plating density
warpage risk candidate
thieving requirement candidate
```

Copper Thieving 是制造建议，不由 Agent 自动加入生产设计。

---

# 24. Plane、Zone 和 Thermal Relief

检查：

```text
copper island
narrow neck
thermal spoke count
spoke width
thermal gap
heat-sink pad connection
high-current connection
plane void
acid trap candidate
```

---

# 25. Board Edge 和机械制造

检查：

```text
outline closure
minimum route radius
internal corner
slot width
copper-to-edge
mask-to-edge
component-to-edge
edge connector bevel
castellation
edge plating
V-score distance
tab route distance
```

---

# 26. 特殊 PCB 工艺

```text
controlled impedance
HDI
blind/buried via
microvia
stacked microvia
via-in-pad
filled and capped via
backdrill
heavy copper
metal core
copper coin
embedded component
rigid-flex
flex
edge plating
castellation
gold finger
carbon ink
peelable mask
resin plug
controlled depth milling
cavity
counterbore/countersink
press-fit
```

每个特殊工艺必须：

```text
显式识别
匹配供应商能力
映射生产文件
生成制造说明
计算加价/交期候选
进入人工确认
```

---

# 27. Via-in-Pad 分类

```text
open_via_in_pad
tented_via_in_pad
plugged_via_in_pad
resin_filled
copper_filled
filled_and_capped
microvia_in_pad
unknown_process
```

`unknown_process` 阻断量产 Gate。

---

# 28. Component Manufacturability

检查：

```text
package recognized
land pattern confidence
footprint/body compatibility
pin pitch
pad pitch
component body size
height
weight
pickup surface
nozzle availability
feeder packaging
tray/tube/tape
polarity/orientation
moisture sensitivity optional
bake requirement optional
reflow rating
bottom termination
X-ray requirement
reworkability
```

---

# 29. 元件贴装状态

```text
standard_mountable
mountable_with_special_nozzle
tray_only
manual_place
selective_process
not_supported
data_missing
```

---

# 30. Placement Spacing

检查不止 Courtyard：

```text
body-to-body
nozzle-to-neighbor
feeder/placement access
vision camera
rework nozzle
soldering iron
AOI line of sight
X-ray overlap
wave solder shadow
depanel stress zone
heat-sensitive neighbor
```

---

# 31. 贴装方向

方向规则来源：

```text
polarity standardization
machine rotation profile
wave solder direction
reflow symmetry
AOI inspection
connector function
human assembly
thermal mass
depanel direction
```

输出：

```text
required
recommended
neutral
conflicting_objectives
```

不能简单要求所有二极管、IC 或连接器同向。

---

# 32. Tombstone 和 Skew 风险

几何与工艺输入：

```text
two-terminal component
pad symmetry
paste volume symmetry
copper thermal balance
trace connection symmetry
component size
reflow profile class
orientation to conveyor
```

仅输出风险候选，不宣称必然发生。

---

# 33. BGA/QFN/LGA/Bottom-terminated

检查：

```text
pitch
pad type
mask-defined/non-mask-defined
via-in-pad process
escape geometry
paste aperture
thermal pad
window pane
void risk candidate
X-ray capability
rework capability
```

---

# 34. PTH 和混装

检查：

```text
pin-to-hole relation
lead protrusion
wave/selective/manual process
component body clearance
solder side access
thermal mass
shadowing
keepout under body
fixture/pallet requirement
```

---

# 35. Wave Solder DFA

检查：

```text
component orientation
pin pitch
shadowing
solder thieves
masking
bottom-side SMT
adhesive requirement
wave direction
connector body
clearance
pallet
```

---

# 36. Selective Solder DFA

检查：

```text
nozzle access
keepout radius
neighbor height
thermal mass
bottom-side components
board support
flux access
solder pot clearance
```

---

# 37. Press-fit DFA

检查：

```text
finished hole
tolerance
plating
annular ring
connector alignment
support fixture
insertion force path
board flex
tool access
```

---

# 38. Stencil DFA

检查：

```text
paste aperture source mapping
aperture width
web
area ratio
aspect ratio
fine pitch
thermal pad window
BGA/QFN/LGA
0201/01005 class
bottom-side heavy component
step stencil requirement
nano coating candidate
DNP policy
fiducial
```

---

# 39. Reflow DFA

检查：

```text
single/double-sided
component temperature rating
bottom-side component mass candidate
thermal mass imbalance
large copper heat sink
shadowing
paste/reflow compatibility
nitrogen requirement candidate
warpage sensitivity
moisture/bake context
```

---

# 40. Inspection DFA

检查：

```text
AOI visibility
polarity marker visibility
silkscreen reference
hidden joints
X-ray requirement
X-ray overlap
ICT test point access
FCT connector access
SPI aperture observability
```

---

# 41. Reworkability

检查：

```text
hot-air access
neighbor heat exposure
shield/heatsink removal
connector access
underfill
conformal coating
BGA rework capability
manual solder access
replaceable module
```

Agent 28 提供 3D/工具空间，Agent 30 提供工艺能力匹配。

---

# 42. Panelization 目标

同时优化：

```text
panel utilization
assembly throughput
board support
warpage
fiducials
tooling
depanel stress
component clearance
routing/V-score time
inspection
traceability
cost
```

---

# 43. Panel IR

```json
{
  "panel_ir_version": "1.0.0",
  "panel_outline": {},
  "board_instances": [],
  "rails": [],
  "tooling_holes": [],
  "global_fiducials": [],
  "local_fiducials": [],
  "vscore_lines": [],
  "routing_paths": [],
  "breakaway_tabs": [],
  "mouse_bites": [],
  "coupons": [],
  "labels": [],
  "process_direction": {},
  "provenance": {}
}
```

---

# 44. 拼板方式

```text
single_board_with_rails
array_vscore
array_tab_route
array_mouse_bite
mixed_vscore_route
carrier_pallet
customer_panel
supplier_panel
```

---

# 45. Panelization Gate

检查：

```text
panel min/max size
array spacing
rail width
conveyor support
tooling holes
global/local fiducials
component-to-panel-edge
component-to-tab
component-to-vscore
copper-to-vscore
board outline compatibility
router diameter
mouse-bite drill
depanel method
warpage candidate
```

---

# 46. V-score 检查

```text
straight full-length line
board thickness
remaining web
component clearance
copper clearance
board shape
intersection
score direction
depanel stress
```

---

# 47. Tab Route 和 Mouse Bite

检查：

```text
tab count
tab width
tab position
router diameter
mouse-bite hole diameter
pitch
residual burr
component clearance
copper clearance
stress-sensitive component
manual/tool depanel
```

---

# 48. Depanel Stress Zone

重点器件：

```text
MLCC
BGA
LGA
crystal
ceramic substrate
large connector
battery contact
board-edge sensor
```

结合：

```text
distance to tab/V-score
orientation
board thickness
depanel method
local cut direction
```

---

# 49. Fiducial

检查：

```text
global/local
diameter
mask opening
copper-free clearance
same side
quantity
geometry distribution
panel rail
component shadowing
profile requirements
```

---

# 50. Tooling Holes 和工艺边

检查：

```text
hole diameter
quantity
position
rail width
conveyor
clamp
printer
SPI
placement
AOI
wave/selective pallet
```

---

# 51. Yield Risk Model

维度：

```text
distance to capability limit
affected feature count
affected feature length/area
feature density
process interaction
equipment dependence
supplier history
pilot defect correlation
```

输出：

```text
low
moderate
high
critical
indeterminate
```

---

# 52. Process Window

```text
design nominal
recommended limit
standard capability
absolute capability
compensation range
measurement uncertainty
process variation
margin
```

---

# 53. Cost Adder

类型：

```text
advanced trace/space
small drill
high aspect ratio
HDI
special material
heavy copper
impedance
via fill/cap
backdrill
edge plating
castellation
step stencil
special nozzle
tray/manual placement
X-ray
selective solder
press-fit
underfill
coating
custom panel
```

输出：

```text
none
likely
confirmed_by_profile
quote_required
```

没有报价数据时不编造金额。

---

# 54. Lead-time Impact

```text
none
standard
extended
engineering_review
supplier_confirmation_required
```

---

# 55. Manufacturer Compatibility Matrix

每家供应商输出：

```text
hard violations
advanced requirements
manual review items
unknowns
cost adders
lead-time adders
process route compatibility
panel compatibility
inspection coverage
overall status
```

状态：

```text
compatible_standard
compatible_advanced
compatible_with_deviation
engineering_review_required
incompatible
unknown
```

---

# 56. Capability Rule IR

```json
{
  "rule_id": "uuid",
  "domain": "fabrication",
  "feature_type": "trace_width",
  "condition": {},
  "thresholds": {
    "recommended": {},
    "standard": {},
    "advanced": {}
  },
  "unsupported_condition": {},
  "cost_class": {},
  "lead_time_class": {},
  "source": {},
  "effective_date": "date",
  "confidence": {}
}
```

---

# 57. Effective Capability Trace

每个 Finding 保存：

```text
feature
board/process conditions
matched profile
matched rule
threshold tier
actual value
margin
fallback rule
rule source
profile version
```

---

# 58. Unified DFM/DFA Finding IR

```json
{
  "finding_id": "uuid",
  "domain": "assembly",
  "finding_type": "component_to_vscore_clearance",
  "analysis_level": "supplier_profile",
  "severity": "high",
  "conclusion_types": ["process_window_risk", "yield_risk"],
  "supplier_scope": [],
  "affected_objects": [],
  "actual": {},
  "required": {},
  "margin": {},
  "evidence_ids": [],
  "repair_candidates": [],
  "status": "open"
}
```

---

# 59. Severity

```text
critical
high
medium
low
info
```

Severity 与以下字段分开：

```text
manufacturability status
yield risk
cost impact
lead-time impact
confidence
```

---

# 60. Finding 状态

```text
open
needs_profile
needs_supplier_confirmation
needs_process_route
needs_part_data
needs_pilot_data
accepted
rejected
fixed
verified
waived
supplier_accepted_deviation
false_positive
superseded
```

---

# 61. Manufacturing Deviation

当工厂准备 CAM 修改或接受例外时保存：

```text
supplier
release
affected artifact/object
requested change
reason
expected effect
risk
price/lead-time
approval
return-data requirement
effective quantity/lot
```

不允许只在邮件里口头确认。

---

# 62. Repair 路由

```text
footprint/pad/paste/courtyard → Agent 20
manufacturing constraint/profile rule → Agent 24
placement/orientation/fiducial/panel layout → Agent 25
routing/copper/via/thermal connection → Agent 26
SI/PI/EMC/thermal impact → Agent 27
mechanical/tool/rework/depanel stress → Agent 28
production artifact/stencil/package → Agent 29
EDA modification execution → Agent 19
MBOM/process route → Agent 43
supplier selection/RFQ → Agent 44
inspection/test plan → Agent 45
```

---

# 63. AI 允许职责

```text
从制造商公开资料或已批准文件提取规则候选
归类工艺和特殊能力
总结 Finding 和供应商差异
生成工程师可读 DFM 报告
生成供应商确认问题清单
```

---

# 64. AI 禁止职责

```text
猜测最小线宽、孔径或间距
覆盖 Profile 阈值
生成几何测量真值
编造工厂能力、价格或良率
自动接受 CAM 修改
自动选择生产供应商
批准制造 Release
```

---

# 65. Release Gate

## Generic DFM Review

```text
源数据完整
关键几何可测量
Generic Profile 运行完成
所有 Unknown 显式报告
```

## Supplier Quote Ready

```text
指定 Supplier Profile
特殊工艺识别
Panel Candidate
BOM/CPL/Stencil 可用
Hard Violation = 0 或已形成问题清单
```

## Prototype Ready

```text
Critical Finding = 0
Hard Capability Violation = 0
人工 Review 项已确认
工艺和加价项已接受
```

## Pilot Ready

```text
Panel 和工艺路线批准
Stencil 批准
DFA High Finding 关闭
Inspection/Test Plan 完成
Supplier CAM Feedback 关闭
```

## Mass Production Ready

```text
Pilot Yield 达标
Critical/High Finding = 0 或批准 Deviation
Profile 和设备冻结
Panel/Stencil/Process Route 冻结
Release Manifest 冻结
```

---

# 66. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RESOLVING_CAPABILITY_PROFILES
→ RESOLVING_PROCESS_ROUTE
→ EXTRACTING_MANUFACTURING_FEATURES
→ RUNNING_FABRICATION_DFM
→ RUNNING_STENCIL_DFM
→ RUNNING_ASSEMBLY_DFA
→ GENERATING_PANEL_CANDIDATES
→ CHECKING_SPECIAL_PROCESSES
→ ESTIMATING_YIELD_AND_COST_CLASS
→ BUILDING_SUPPLIER_MATRIX
→ CORRELATING_FINDINGS
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_FINDINGS
COMPLETED_GENERIC_ONLY
REVIEW_REQUIRED
INPUT_BLOCKED
PROFILE_REQUIRED
PROCESS_ROUTE_REQUIRED
SUPPLIER_CONFIRMATION_REQUIRED
PANELIZATION_INFEASIBLE
SPECIAL_PROCESS_UNSUPPORTED
RELEASE_GATE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 67. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
ASSEMBLY_REVISION_MISMATCH
VARIANT_MISMATCH
AGENT18_RELEASE_TOO_LOW
AGENT20_PADSTACK_BLOCKED
AGENT26_ROUTING_BLOCKED
AGENT27_DRC_BLOCKED
AGENT28_MECHANICAL_BLOCKED
AGENT29_RELEASE_ARTIFACT_BLOCKED
FABRICATION_PROFILE_MISSING
ASSEMBLY_PROFILE_MISSING
STENCIL_PROFILE_MISSING
PANEL_PROFILE_MISSING
PROFILE_EXPIRED
PROFILE_UNAPPROVED
PROCESS_ROUTE_MISSING
MATERIAL_UNKNOWN
COPPER_WEIGHT_UNKNOWN
STACKUP_UNKNOWN
SURFACE_FINISH_UNKNOWN
TRACE_WIDTH_VIOLATION
COPPER_SPACING_VIOLATION
ANNULAR_RING_VIOLATION
DRILL_SIZE_VIOLATION
ASPECT_RATIO_VIOLATION
HOLE_TO_COPPER_VIOLATION
SOLDER_MASK_DAM_VIOLATION
SILKSCREEN_VIOLATION
COPPER_TO_EDGE_VIOLATION
BOARD_OUTLINE_VIOLATION
COPPER_BALANCE_RISK
THERMAL_RELIEF_VIOLATION
VIA_PROCESS_UNKNOWN
SPECIAL_PROCESS_UNSUPPORTED
COMPONENT_DATA_MISSING
COMPONENT_NOT_MOUNTABLE
NOZZLE_UNAVAILABLE
FEEDER_PACKAGING_UNSUPPORTED
PLACEMENT_SPACING_VIOLATION
ORIENTATION_PROCESS_CONFLICT
TOMBSTONE_RISK_HIGH
WAVE_SOLDER_INCOMPATIBLE
SELECTIVE_SOLDER_ACCESS_BLOCKED
PRESS_FIT_INCOMPATIBLE
STENCIL_APERTURE_VIOLATION
PANEL_DIMENSION_VIOLATION
V_SCORE_INCOMPATIBLE
TAB_ROUTE_INCOMPATIBLE
FIDUCIAL_INSUFFICIENT
TOOLING_HOLE_INSUFFICIENT
DEPANEL_STRESS_RISK
MANUFACTURER_INCOMPATIBLE
SUPPLIER_CONFIRMATION_REQUIRED
AGENT19_EXECUTION_FAILED
POST_REPAIR_DFM_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR
```


---

# 68. 数据库设计

## 68.1 `dfm_dfa_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
variant_id UUID NOT NULL
agent29_release_id UUID NOT NULL
analysis_profile VARCHAR NOT NULL
policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
selected_process_route_id UUID NULL
selected_panel_candidate_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 68.2 `dfm_dfa_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
variant_id UUID NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_scan_hash CHAR(64) NOT NULL
agent24_constraint_hash CHAR(64) NOT NULL
agent25_placement_hash CHAR(64) NOT NULL
agent26_routing_hash CHAR(64) NOT NULL
agent27_review_hash CHAR(64) NOT NULL
agent28_review_hash CHAR(64) NOT NULL
agent29_manifest_hash CHAR(64) NOT NULL
fabrication_profile_hashes JSONB NOT NULL
assembly_profile_hashes JSONB NOT NULL
stencil_profile_hashes JSONB NOT NULL
panel_profile_hashes JSONB NOT NULL
process_route_hash CHAR(64) NULL
policy_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, snapshot_hash)
```

## 68.3 `manufacturing_capability_profiles`

```text
id UUID PK
tenant_id UUID NULL
supplier_id UUID NULL
factory_site VARCHAR NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
profile_type VARCHAR NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
source_reference JSONB NOT NULL
source_hash CHAR(64) NOT NULL
board_types JSONB NOT NULL
condition_schema JSONB NOT NULL
capability_tiers JSONB NOT NULL
cost_classes JSONB NOT NULL
lead_time_classes JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version, factory_site)
```

## 68.4 `assembly_capability_profiles`

```text
id UUID PK
tenant_id UUID NULL
supplier_id UUID NULL
line_site VARCHAR NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
equipment_manifest JSONB NOT NULL
printing_capabilities JSONB NOT NULL
placement_capabilities JSONB NOT NULL
reflow_capabilities JSONB NOT NULL
wave_capabilities JSONB NOT NULL
selective_capabilities JSONB NOT NULL
pressfit_capabilities JSONB NOT NULL
inspection_capabilities JSONB NOT NULL
rework_capabilities JSONB NOT NULL
panel_transport_capabilities JSONB NOT NULL
source_reference JSONB NOT NULL
source_hash CHAR(64) NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version, line_site)
```

## 68.5 `stencil_capability_profiles`

```text
id UUID PK
tenant_id UUID NULL
supplier_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
materials JSONB NOT NULL
thickness_options JSONB NOT NULL
laser_capabilities JSONB NOT NULL
minimum_aperture_rules JSONB NOT NULL
minimum_web_rules JSONB NOT NULL
area_ratio_rules JSONB NOT NULL
aspect_ratio_rules JSONB NOT NULL
step_stencil_rules JSONB NOT NULL
coating_rules JSONB NOT NULL
fiducial_rules JSONB NOT NULL
source_reference JSONB NOT NULL
source_hash CHAR(64) NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 68.6 `panelization_capability_profiles`

```text
id UUID PK
tenant_id UUID NULL
supplier_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
panel_dimensions JSONB NOT NULL
rail_rules JSONB NOT NULL
tooling_hole_rules JSONB NOT NULL
fiducial_rules JSONB NOT NULL
vscore_rules JSONB NOT NULL
tab_route_rules JSONB NOT NULL
mouse_bite_rules JSONB NOT NULL
array_spacing_rules JSONB NOT NULL
mixed_design_policy JSONB NOT NULL
depanel_capabilities JSONB NOT NULL
warpage_policy JSONB NOT NULL
source_reference JSONB NOT NULL
source_hash CHAR(64) NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 68.7 `capability_rules`

```text
id UUID PK
profile_id UUID NOT NULL
domain VARCHAR NOT NULL
feature_type VARCHAR NOT NULL
rule_key VARCHAR NOT NULL
conditions JSONB NOT NULL
recommended_threshold JSONB NULL
standard_threshold JSONB NULL
advanced_threshold JSONB NULL
unsupported_conditions JSONB NOT NULL
cost_class JSONB NULL
lead_time_class JSONB NULL
severity_policy JSONB NOT NULL
source_reference JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_id, rule_key)
```

## 68.8 `capability_profile_import_runs`

```text
id UUID PK
profile_id UUID NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
source_hash CHAR(64) NOT NULL
extractor_name VARCHAR NOT NULL
extractor_version VARCHAR NOT NULL
candidate_rule_count INT NOT NULL
accepted_rule_count INT NOT NULL
rejected_rule_count INT NOT NULL
ambiguous_items JSONB NOT NULL
review_status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 68.9 `dfm_process_route_candidates`

```text
id UUID PK
job_id UUID NOT NULL
route_key VARCHAR NOT NULL
route_version INT NOT NULL
fabrication_steps JSONB NOT NULL
stencil_steps JSONB NOT NULL
smt_steps JSONB NOT NULL
through_hole_steps JSONB NOT NULL
special_steps JSONB NOT NULL
inspection_steps JSONB NOT NULL
test_steps JSONB NOT NULL
depanel_steps JSONB NOT NULL
packaging_steps JSONB NOT NULL
equipment_requirements JSONB NOT NULL
supplier_requirements JSONB NOT NULL
route_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, route_key, route_version)
```

## 68.10 `manufacturing_feature_ir_versions`

```text
id UUID PK
job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
board_feature_count INT NOT NULL
copper_feature_count INT NOT NULL
drill_feature_count INT NOT NULL
mask_feature_count INT NOT NULL
paste_feature_count INT NOT NULL
component_feature_count INT NOT NULL
panel_feature_count INT NOT NULL
special_process_feature_count INT NOT NULL
feature_ir_uri TEXT NOT NULL
feature_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, ir_version)
```

## 68.11 `manufacturing_features`

```text
id UUID PK
feature_ir_version_id UUID NOT NULL
feature_key VARCHAR NOT NULL
domain VARCHAR NOT NULL
feature_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
geometry JSONB NULL
layer_scope JSONB NULL
material_context JSONB NULL
process_context JSONB NULL
measurement_values JSONB NOT NULL
variant_scope JSONB NOT NULL
feature_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(feature_ir_version_id, feature_key)
```

## 68.12 `effective_capability_traces`

```text
id UUID PK
job_id UUID NOT NULL
manufacturing_feature_id UUID NOT NULL
profile_id UUID NOT NULL
matched_rule_id UUID NULL
condition_context JSONB NOT NULL
selected_tier VARCHAR NOT NULL
actual_value JSONB NOT NULL
threshold_value JSONB NULL
margin JSONB NULL
fallback_trace JSONB NOT NULL
source_trace JSONB NOT NULL
trace_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.13 `fabrication_dfm_runs`

```text
id UUID PK
job_id UUID NOT NULL
profile_id UUID NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
rule_set_version VARCHAR NOT NULL
feature_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
finding_count INT NOT NULL
runtime_ms BIGINT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 68.14 `fabrication_dfm_findings`

```text
id UUID PK
dfm_run_id UUID NOT NULL
finding_type VARCHAR NOT NULL
feature_ids JSONB NOT NULL
capability_trace_ids JSONB NOT NULL
analysis_level VARCHAR NOT NULL
severity VARCHAR NOT NULL
conclusion_types JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
margin JSONB NULL
affected_length_count_area JSONB NOT NULL
yield_risk VARCHAR NOT NULL
cost_impact VARCHAR NOT NULL
lead_time_impact VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.15 `assembly_component_profiles`

```text
id UUID PK
job_id UUID NOT NULL
component_instance_id UUID NOT NULL
part_id UUID NULL
package_family VARCHAR NULL
body_geometry JSONB NOT NULL
land_pattern_context JSONB NOT NULL
pin_pitch JSONB NULL
height JSONB NULL
weight JSONB NULL
pickup_surface JSONB NULL
feeder_packaging JSONB NULL
polarity_context JSONB NOT NULL
thermal_context JSONB NOT NULL
inspection_context JSONB NOT NULL
rework_context JSONB NOT NULL
data_quality VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, component_instance_id)
```

## 68.16 `assembly_mountability_checks`

```text
id UUID PK
job_id UUID NOT NULL
assembly_profile_id UUID NOT NULL
component_profile_id UUID NOT NULL
placement_machine_match JSONB NOT NULL
nozzle_match JSONB NOT NULL
feeder_match JSONB NOT NULL
vision_match JSONB NOT NULL
reflow_match JSONB NOT NULL
wave_or_selective_match JSONB NOT NULL
inspection_match JSONB NOT NULL
rework_match JSONB NOT NULL
mountability_status VARCHAR NOT NULL
manual_review_items JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 68.17 `assembly_spacing_checks`

```text
id UUID PK
job_id UUID NOT NULL
component_a_id UUID NOT NULL
component_b_or_feature_ref JSONB NOT NULL
spacing_type VARCHAR NOT NULL
actual_clearance JSONB NOT NULL
required_clearance JSONB NOT NULL
equipment_context JSONB NOT NULL
process_context JSONB NOT NULL
margin JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.18 `assembly_orientation_checks`

```text
id UUID PK
job_id UUID NOT NULL
component_instance_id UUID NOT NULL
orientation_objective VARCHAR NOT NULL
actual_orientation JSONB NOT NULL
preferred_or_required_orientation JSONB NOT NULL
process_direction JSONB NULL
conflicting_objectives JSONB NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.19 `assembly_defect_risk_checks`

```text
id UUID PK
job_id UUID NOT NULL
component_instance_id UUID NOT NULL
risk_type VARCHAR NOT NULL
geometry_factors JSONB NOT NULL
paste_factors JSONB NOT NULL
thermal_factors JSONB NOT NULL
process_factors JSONB NOT NULL
risk_level VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
analysis_level VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.20 `assembly_dfa_runs`

```text
id UUID PK
job_id UUID NOT NULL
assembly_profile_id UUID NOT NULL
process_route_id UUID NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
status VARCHAR NOT NULL
component_count INT NOT NULL
mountability_failure_count INT NOT NULL
spacing_failure_count INT NOT NULL
orientation_finding_count INT NOT NULL
defect_risk_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 68.21 `assembly_dfa_findings`

```text
id UUID PK
dfa_run_id UUID NOT NULL
finding_type VARCHAR NOT NULL
component_ids JSONB NOT NULL
affected_features JSONB NOT NULL
analysis_level VARCHAR NOT NULL
severity VARCHAR NOT NULL
conclusion_types JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
yield_risk VARCHAR NOT NULL
cost_impact VARCHAR NOT NULL
lead_time_impact VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.22 `stencil_dfm_runs`

```text
id UUID PK
job_id UUID NOT NULL
stencil_profile_id UUID NOT NULL
agent29_stencil_artifact_ids JSONB NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
stencil_thickness JSONB NOT NULL
status VARCHAR NOT NULL
aperture_count INT NOT NULL
finding_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 68.23 `stencil_dfm_findings`

```text
id UUID PK
stencil_run_id UUID NOT NULL
finding_type VARCHAR NOT NULL
source_pad_ids JSONB NOT NULL
aperture_ids JSONB NOT NULL
component_ids JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
rule_trace JSONB NOT NULL
severity VARCHAR NOT NULL
yield_risk VARCHAR NOT NULL
cost_impact VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.24 `panel_generation_plans`

```text
id UUID PK
job_id UUID NOT NULL
panel_profile_id UUID NOT NULL
plan_version INT NOT NULL
board_quantity INT NOT NULL
candidate_strategy JSONB NOT NULL
optimization_objectives JSONB NOT NULL
hard_constraints JSONB NOT NULL
soft_constraints JSONB NOT NULL
seed BIGINT NULL
time_budget_ms BIGINT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, plan_version)
```

## 68.25 `panel_candidates`

```text
id UUID PK
job_id UUID NOT NULL
panel_plan_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
panel_ir_uri TEXT NOT NULL
panel_ir_hash CHAR(64) NOT NULL
panel_width JSONB NOT NULL
panel_height JSONB NOT NULL
board_count INT NOT NULL
utilization NUMERIC NOT NULL
rail_area JSONB NOT NULL
depanel_method VARCHAR NOT NULL
vscore_length JSONB NULL
routing_length JSONB NULL
tooling_summary JSONB NOT NULL
fiducial_summary JSONB NOT NULL
hard_violation_count INT NOT NULL
yield_risk VARCHAR NOT NULL
cost_class VARCHAR NOT NULL
pareto_rank INT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, candidate_key)
```

## 68.26 `panel_features`

```text
id UUID PK
panel_candidate_id UUID NOT NULL
feature_key VARCHAR NOT NULL
feature_type VARCHAR NOT NULL
geometry JSONB NOT NULL
source_reference JSONB NOT NULL
process_parameters JSONB NOT NULL
clearance_context JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(panel_candidate_id, feature_key)
```

## 68.27 `panel_dfm_findings`

```text
id UUID PK
panel_candidate_id UUID NOT NULL
finding_type VARCHAR NOT NULL
feature_ids JSONB NOT NULL
component_ids JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
severity VARCHAR NOT NULL
yield_risk VARCHAR NOT NULL
cost_impact VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.28 `special_process_requirements`

```text
id UUID PK
job_id UUID NOT NULL
process_key VARCHAR NOT NULL
process_type VARCHAR NOT NULL
source_feature_ids JSONB NOT NULL
required_parameters JSONB NOT NULL
agent29_artifact_requirements JSONB NOT NULL
inspection_requirements JSONB NOT NULL
supplier_confirmation_required BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, process_key)
```

## 68.29 `special_process_capability_matches`

```text
id UUID PK
special_process_requirement_id UUID NOT NULL
supplier_profile_id UUID NOT NULL
capability_status VARCHAR NOT NULL
matched_capabilities JSONB NOT NULL
missing_capabilities JSONB NOT NULL
manual_review_items JSONB NOT NULL
cost_impact VARCHAR NOT NULL
lead_time_impact VARCHAR NOT NULL
source_trace JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 68.30 `manufacturer_compatibility_results`

```text
id UUID PK
job_id UUID NOT NULL
supplier_id UUID NOT NULL
fabrication_profile_id UUID NULL
assembly_profile_id UUID NULL
stencil_profile_id UUID NULL
panel_profile_id UUID NULL
process_route_id UUID NULL
hard_violation_count INT NOT NULL
advanced_requirement_count INT NOT NULL
manual_review_count INT NOT NULL
unknown_count INT NOT NULL
cost_adders JSONB NOT NULL
lead_time_adders JSONB NOT NULL
inspection_coverage JSONB NOT NULL
overall_status VARCHAR NOT NULL
score_vector JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, supplier_id, process_route_id)
```

## 68.31 `yield_risk_assessments`

```text
id UUID PK
job_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
risk_model_version VARCHAR NOT NULL
capability_margin JSONB NOT NULL
feature_exposure JSONB NOT NULL
process_interactions JSONB NOT NULL
supplier_history_reference JSONB NULL
pilot_data_reference JSONB NULL
risk_level VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
explanation_trace JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 68.32 `cost_leadtime_impacts`

```text
id UUID PK
job_id UUID NOT NULL
supplier_id UUID NULL
scope_reference JSONB NOT NULL
impact_type VARCHAR NOT NULL
impact_class VARCHAR NOT NULL
reason_codes JSONB NOT NULL
profile_evidence JSONB NOT NULL
quote_required BOOLEAN NOT NULL
estimated_value JSONB NULL
currency VARCHAR NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 68.33 `manufacturing_deviations`

```text
id UUID PK
tenant_id UUID NOT NULL
job_id UUID NOT NULL
supplier_id UUID NOT NULL
release_id UUID NOT NULL
affected_scope JSONB NOT NULL
requested_change JSONB NOT NULL
reason TEXT NOT NULL
expected_effect JSONB NOT NULL
risk_summary JSONB NOT NULL
cost_leadtime JSONB NOT NULL
effective_quantity_or_lot JSONB NOT NULL
return_data_requirements JSONB NOT NULL
status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 68.34 `dfm_dfa_findings`

```text
id UUID PK
job_id UUID NOT NULL
domain VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
analysis_level VARCHAR NOT NULL
severity VARCHAR NOT NULL
conclusion_types JSONB NOT NULL
supplier_scope JSONB NOT NULL
affected_objects JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
margin JSONB NULL
yield_risk VARCHAR NOT NULL
cost_impact VARCHAR NOT NULL
lead_time_impact VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
source_finding_refs JSONB NOT NULL
evidence_ids JSONB NOT NULL
repair_candidate_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.35 `dfm_dfa_repair_candidates`

```text
id UUID PK
job_id UUID NOT NULL
finding_id UUID NOT NULL
repair_type VARCHAR NOT NULL
target_agent VARCHAR NOT NULL
scope_reference JSONB NOT NULL
proposed_change JSONB NOT NULL
expected_effect JSONB NOT NULL
side_effects JSONB NOT NULL
cost_effect JSONB NULL
verification_plan JSONB NOT NULL
risk_level VARCHAR NOT NULL
approval_policy VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.36 `dfm_dfa_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
base_release_id UUID NOT NULL
plan_version INT NOT NULL
selected_repair_ids JSONB NOT NULL
execution_routes JSONB NOT NULL
agent19_change_plan_uri TEXT NULL
upstream_feedback JSONB NOT NULL
regeneration_plan JSONB NOT NULL
regression_plan JSONB NOT NULL
risk_summary JSONB NOT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, plan_version)
```

## 68.37 `dfm_dfa_post_repair_runs`

```text
id UUID PK
change_plan_id UUID NOT NULL
agent19_execution_id UUID NULL
pre_job_id UUID NOT NULL
post_job_id UUID NULL
agent29_regenerated_release_id UUID NULL
fabrication_regression JSONB NOT NULL
stencil_regression JSONB NOT NULL
assembly_regression JSONB NOT NULL
panel_regression JSONB NOT NULL
special_process_regression JSONB NOT NULL
new_findings JSONB NOT NULL
resolved_findings JSONB NOT NULL
worsened_findings JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 68.38 `dfm_dfa_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
job_id UUID NOT NULL
finding_id UUID NULL
supplier_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
risk_acceptance TEXT NOT NULL
mitigations JSONB NOT NULL
evidence_ids JSONB NOT NULL
effective_release_id UUID NULL
effective_quantity_or_lot JSONB NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 68.39 `dfm_dfa_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
release_id UUID NOT NULL
job_id UUID NOT NULL
profile_snapshot_hash CHAR(64) NOT NULL
process_route_hash CHAR(64) NOT NULL
finding_set_hash CHAR(64) NOT NULL
selected_panel_hash CHAR(64) NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name)
```

## 68.40 `dfm_dfa_release_gate_runs`

```text
id UUID PK
job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
critical_finding_count INT NOT NULL
high_finding_count INT NOT NULL
hard_capability_violation_count INT NOT NULL
unknown_required_item_count INT NOT NULL
supplier_confirmation_pending_count INT NOT NULL
unapproved_deviation_count INT NOT NULL
panel_block_count INT NOT NULL
special_process_block_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 68.41 `dfm_dfa_reports`

```text
id UUID PK
job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
input_summary JSONB NOT NULL
profile_summary JSONB NOT NULL
fabrication_summary JSONB NOT NULL
stencil_summary JSONB NOT NULL
assembly_summary JSONB NOT NULL
panel_summary JSONB NOT NULL
special_process_summary JSONB NOT NULL
supplier_matrix_summary JSONB NOT NULL
yield_cost_summary JSONB NOT NULL
finding_counts JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, report_version)
```

---

# 69. 对象存储

```text
derived/dfm-dfa/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          input-snapshot.json
          release-manifest.json
          fabrication-profiles/
          assembly-profiles/
          stencil-profiles/
          panel-profiles/
          process-route.json
          policy.json
        features/
          manufacturing-feature-ir.json
          copper.parquet
          drills.parquet
          mask.parquet
          paste.parquet
          components.parquet
          special-processes.jsonl.zst
        fabrication/
          rule-traces/
          findings.jsonl.zst
          geometry-evidence/
          density-maps/
          drill-maps/
        assembly/
          component-profiles.jsonl.zst
          mountability.jsonl.zst
          spacing.jsonl.zst
          orientations.jsonl.zst
          defect-risks.jsonl.zst
          findings.jsonl.zst
        stencil/
          aperture-features.parquet
          rule-traces/
          findings.jsonl.zst
          overlays/
        panelization/
          plans/
          candidates/
          drawings/
          utilization/
          depanel-stress/
        special-process/
          requirements.jsonl.zst
          capability-matches.jsonl.zst
        suppliers/
          compatibility-matrix.parquet
          cost-leadtime.jsonl.zst
          confirmation-questions/
        findings/
          unified-findings.jsonl.zst
          evidence/
          repair-candidates.jsonl.zst
        changes/
          agent19-plan.json
          upstream-feedback/
          manufacturing-deviations/
          preview/
          execution/
        regression/
          source/
          release/
          fabrication/
          stencil/
          assembly/
          panel/
        reports/
          dfm-dfa-report.html
          dfm-dfa-report.pdf
          fabrication-findings.csv
          assembly-findings.csv
          stencil-findings.csv
          panel-candidates.csv
          supplier-matrix.csv
          cost-leadtime.csv
          release-gate.json
        debug/
          rule-trace.jsonl.zst
          geometry-trace.jsonl.zst
          panel-optimization-trace.jsonl.zst
          resource-usage.json
```


---

# 70. API 设计

## 70.1 Jobs

```text
POST /api/v1/dfm-dfa/jobs
POST /api/v1/dfm-dfa/jobs/batch
GET  /api/v1/dfm-dfa/jobs/{id}
GET  /api/v1/dfm-dfa/jobs/{id}/events
POST /api/v1/dfm-dfa/jobs/{id}/cancel
POST /api/v1/dfm-dfa/jobs/{id}/retry
POST /api/v1/dfm-dfa/jobs/{id}/rerun
```

## 70.2 Readiness and Inputs

```text
POST /api/v1/dfm-dfa/jobs/{id}/validate-readiness
GET  /api/v1/dfm-dfa/jobs/{id}/readiness
GET  /api/v1/dfm-dfa/jobs/{id}/input-snapshot
POST /api/v1/dfm-dfa/jobs/{id}/extract-features
GET  /api/v1/dfm-dfa/jobs/{id}/feature-ir
```

## 70.3 Capability Profiles

```text
POST /api/v1/dfm-dfa/fabrication-profiles
POST /api/v1/dfm-dfa/assembly-profiles
POST /api/v1/dfm-dfa/stencil-profiles
POST /api/v1/dfm-dfa/panel-profiles
GET  /api/v1/dfm-dfa/profiles
GET  /api/v1/dfm-dfa/profiles/{id}
POST /api/v1/dfm-dfa/profiles/{id}/validate
POST /api/v1/dfm-dfa/profiles/{id}/approve
POST /api/v1/dfm-dfa/profiles/{id}/deprecate
POST /api/v1/dfm-dfa/profiles/import-candidate
GET  /api/v1/dfm-dfa/profiles/{id}/rules
```

## 70.4 Process Routes

```text
POST /api/v1/dfm-dfa/jobs/{id}/process-route-candidates
GET  /api/v1/dfm-dfa/jobs/{id}/process-routes
POST /api/v1/dfm-dfa/jobs/{id}/select-process-route
GET  /api/v1/dfm-dfa/process-routes/{id}
```

## 70.5 Fabrication DFM

```text
POST /api/v1/dfm-dfa/jobs/{id}/run-fabrication
GET  /api/v1/dfm-dfa/jobs/{id}/fabrication-findings
GET  /api/v1/dfm-dfa/jobs/{id}/capability-traces
GET  /api/v1/dfm-dfa/jobs/{id}/copper-density
GET  /api/v1/dfm-dfa/jobs/{id}/drill-analysis
GET  /api/v1/dfm-dfa/jobs/{id}/special-processes
```

## 70.6 Assembly DFA

```text
POST /api/v1/dfm-dfa/jobs/{id}/build-component-profiles
POST /api/v1/dfm-dfa/jobs/{id}/run-assembly
GET  /api/v1/dfm-dfa/jobs/{id}/mountability
GET  /api/v1/dfm-dfa/jobs/{id}/spacing-checks
GET  /api/v1/dfm-dfa/jobs/{id}/orientation-checks
GET  /api/v1/dfm-dfa/jobs/{id}/assembly-findings
```

## 70.7 Stencil

```text
POST /api/v1/dfm-dfa/jobs/{id}/run-stencil
GET  /api/v1/dfm-dfa/jobs/{id}/stencil-findings
GET  /api/v1/dfm-dfa/jobs/{id}/stencil-aperture-analysis
```

## 70.8 Panelization

```text
POST /api/v1/dfm-dfa/jobs/{id}/panel-plans
POST /api/v1/dfm-dfa/panel-plans/{id}/generate
GET  /api/v1/dfm-dfa/jobs/{id}/panel-candidates
GET  /api/v1/dfm-dfa/panel-candidates/{id}
GET  /api/v1/dfm-dfa/panel-candidates/{id}/findings
POST /api/v1/dfm-dfa/jobs/{id}/select-panel
```

## 70.9 Supplier Matrix

```text
POST /api/v1/dfm-dfa/jobs/{id}/match-suppliers
GET  /api/v1/dfm-dfa/jobs/{id}/supplier-matrix
GET  /api/v1/dfm-dfa/jobs/{id}/cost-leadtime
POST /api/v1/dfm-dfa/jobs/{id}/supplier-confirmation-package
```

## 70.10 Findings and Review

```text
GET  /api/v1/dfm-dfa/jobs/{id}/findings
GET  /api/v1/dfm-dfa/findings/{id}
POST /api/v1/dfm-dfa/findings/{id}/accept
POST /api/v1/dfm-dfa/findings/{id}/reject
POST /api/v1/dfm-dfa/findings/{id}/waive
POST /api/v1/dfm-dfa/findings/{id}/request-supplier-confirmation
GET  /api/v1/dfm-dfa/findings/{id}/evidence
```

## 70.11 Deviations and Repairs

```text
POST /api/v1/dfm-dfa/jobs/{id}/deviations
GET  /api/v1/dfm-dfa/jobs/{id}/deviations
POST /api/v1/dfm-dfa/deviations/{id}/approve
POST /api/v1/dfm-dfa/findings/{id}/repair-candidates
GET  /api/v1/dfm-dfa/jobs/{id}/repair-candidates
POST /api/v1/dfm-dfa/jobs/{id}/change-plan
POST /api/v1/dfm-dfa/change-plans/{id}/preview
POST /api/v1/dfm-dfa/change-plans/{id}/approve
POST /api/v1/dfm-dfa/change-plans/{id}/submit
GET  /api/v1/dfm-dfa/post-repair-runs/{id}
```

## 70.12 Baseline and Release

```text
POST /api/v1/dfm-dfa/jobs/{id}/baseline
POST /api/v1/dfm-dfa/jobs/{id}/compare-baseline
POST /api/v1/dfm-dfa/jobs/{id}/run-release-gate
GET  /api/v1/dfm-dfa/jobs/{id}/release-gate
GET  /api/v1/dfm-dfa/jobs/{id}/report
GET  /api/v1/dfm-dfa/jobs/{id}/supplier-matrix.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 71. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.variant.approved
pcb-constraints.constraint-ir-ready
pcb-placement.completed
pcb-routing.completed
pcb-review.completed
mechanical-review.completed
manufacturing-release.published
dfm-dfa.requested
supplier.capability-profile.updated
supplier.cam-feedback.received
pilot.yield-data.ready
```

## 输出事件

```text
dfm-dfa.input-blocked
dfm-dfa.profile-required
dfm-dfa.process-route-required
dfm-dfa.fabrication-completed
dfm-dfa.assembly-completed
dfm-dfa.stencil-completed
dfm-dfa.panel-candidates-ready
dfm-dfa.special-process-detected
dfm-dfa.supplier-confirmation-required
dfm-dfa.manufacturer-matrix-ready
dfm-dfa.critical-finding
dfm-dfa.feedback-to-library
dfm-dfa.feedback-to-constraints
dfm-dfa.feedback-to-placement
dfm-dfa.feedback-to-routing
dfm-dfa.feedback-to-pcb-review
dfm-dfa.feedback-to-mechanical-review
dfm-dfa.feedback-to-manufacturing-release
dfm-dfa.change-plan-ready
dfm-dfa.post-repair-validated
dfm-dfa.release-gate-blocked
dfm-dfa.completed
dfm-dfa.completed-with-findings
dfm-dfa.failed
```

---

# 72. Policy 组织

```text
policies/
├── dfm-dfa-1.0.0.yaml
├── readiness-gates.yaml
├── profile-admission.yaml
├── fabrication/
│   ├── trace-space.yaml
│   ├── annular-ring.yaml
│   ├── drills.yaml
│   ├── aspect-ratio.yaml
│   ├── hole-clearance.yaml
│   ├── solder-mask.yaml
│   ├── silkscreen.yaml
│   ├── copper-balance.yaml
│   ├── thermal-relief.yaml
│   ├── board-edge.yaml
│   └── special-process.yaml
├── assembly/
│   ├── mountability.yaml
│   ├── equipment.yaml
│   ├── spacing.yaml
│   ├── orientation.yaml
│   ├── tombstone.yaml
│   ├── bga-qfn.yaml
│   ├── pth.yaml
│   ├── wave.yaml
│   ├── selective.yaml
│   ├── press-fit.yaml
│   ├── reflow.yaml
│   ├── inspection.yaml
│   └── rework.yaml
├── stencil/
│   ├── aperture.yaml
│   ├── area-ratio.yaml
│   ├── thermal-pad.yaml
│   ├── fine-pitch.yaml
│   ├── via-in-pad.yaml
│   ├── step-stencil.yaml
│   └── variants.yaml
├── panel/
│   ├── dimensions.yaml
│   ├── rails.yaml
│   ├── fiducials.yaml
│   ├── tooling-holes.yaml
│   ├── vscore.yaml
│   ├── tab-route.yaml
│   ├── mouse-bite.yaml
│   ├── depanel-stress.yaml
│   └── optimization.yaml
├── yield/
│   ├── process-window.yaml
│   ├── exposure.yaml
│   ├── correlations.yaml
│   └── confidence.yaml
├── cost/
│   ├── adders.yaml
│   └── lead-time.yaml
├── deviations.yaml
├── repair-routing.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 73. Rule Engine

要求：

```text
typed conditions
explicit units
conditional thresholds
profile precedence
recommended/standard/advanced tiers
effective dates
rule source
rule confidence
rule coverage
explain trace
```

规则执行结果：

```text
matched
not_matched
insufficient_context
unsupported
shadowed
expired
```

---

# 74. Profile 优先级

推荐：

```text
supplier factory/site profile
→ supplier generic profile
→ enterprise approved profile
→ technology profile
→ generic conservative profile
```

禁止：

```text
unknown supplier profile
→ silently use another supplier's threshold
```

---

# 75. 几何计算

需要：

```text
robust polygon operations
offset/buffer
minimum distance
nearest feature
local density windows
medial/neck analysis
board and panel transforms
spatial index
```

所有计算使用明确单位和容差。

---

# 76. Panel Optimization

目标函数可包含：

```text
maximize panel utilization
maximize throughput
minimize routing/vscore length
minimize rails and waste
minimize depanel risk
minimize orientation changes
minimize custom tooling
maximize supplier compatibility
```

Hard Constraints 永远优先于目标函数。

---

# 77. Panel Candidate Pareto 集

至少输出：

```text
最高材料利用率
最佳 SMT 传输稳定性
最低分板风险
最低加工成本候选
平衡方案
```

---

# 78. Supplier Feedback Import

支持：

```text
CAM findings
modified Gerber preview
capability confirmation
manufacturing questions
quoted special process
lead-time confirmation
panel proposal
stencil proposal
```

任何反馈必须绑定：

```text
supplier
site
release
profile revision
artifact hash
timestamp
contact/source
```

---

# 79. Pilot Yield Correlation

输入：

```text
lot
quantity
process line
profile
defect codes
locations
repair records
inspection results
scrap
```

用途：

```text
校准风险排序
发现重复缺陷
更新企业规则候选
比较供应商
```

不能自动修改供应商官方 Profile。

---

# 80. Review Workbench

界面建议：

```text
左：Domain / Supplier / Severity / Capability Tier / Process
中：PCB、Panel、Paste 和 Component Overlay
右：Actual、Threshold、Margin、Profile、Cost、Repair
下：Fabrication、Stencil、Assembly、Panel、Suppliers、Deviations、Regression
```

---

# 81. Review 操作

```text
切换供应商 Profile
切换推荐/标准/高级能力
查看规则来源
查看局部几何
切换工艺路线
比较 Panel Candidate
查看元件贴装能力
请求供应商确认
创建 Manufacturing Deviation
选择修复
创建 Waiver
运行 Release Gate
```

---

# 82. 可观测性

```text
dfm_dfa_jobs_total{status,profile}
dfm_dfa_duration_seconds{step}
dfm_dfa_features_total{domain,type}
dfm_dfa_findings_total{domain,type,severity,conclusion}
dfm_dfa_capability_tiers_total{tier}
dfm_dfa_unknown_rules_total{domain}
dfm_dfa_component_mountability_total{status}
dfm_dfa_panel_candidates_total{status}
dfm_dfa_supplier_compatibility_total{status}
dfm_dfa_cost_adders_total{type}
dfm_dfa_deviations_total{status}
dfm_dfa_post_repair_runs_total{status}
dfm_dfa_release_gate_blocks_total{reason}
```

---

# 83. Dashboard

```text
Jobs
Input Readiness
Profile Freshness
Fabrication DFM
Drill and Via
Mask and Silk
Copper Balance
Special Processes
Component Mountability
Assembly Spacing
Orientation
Stencil
Panelization
Supplier Matrix
Yield Risk
Cost and Lead-time
Deviations
Repairs
Regression
Release Readiness
```

---

# 84. 安全与权限

- PCB、生产文件、供应商 Profile、报价和良率按租户/项目隔离；
- Profile Import Worker 默认无公网，或只允许白名单官方来源；
- 下载内容按类型和大小限制；
- 不执行网页、PDF、CSV、压缩包和供应商附件中的脚本；
- 防止 CSV Formula Injection、Zip Slip、Path Traversal 和恶意几何；
- Profile 候选必须人工批准后才能用于量产 Gate；
- 工厂能力、价格、良率和设备资料可设置企业机密等级；
- Agent 19 写入、Deviation 审批和 Release 审批权限分开；
- Critical/High Waiver 和供应商 CAM 修改支持双人审批；
- AI 只接收最小化、脱敏、结构化规则文本；
- 不将私有生产包、供应商报价和良率发给外部模型；
- Profile、Deviation、Waiver、Baseline 和 Gate 不可硬删除；
- 公开 Fixture 仅使用开源、合成、脱敏或授权数据。

---

# 85. 推荐技术栈

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

几何和优化：

```text
Shapely or equivalent robust geometry
NumPy
SciPy
OR-Tools optional
custom spatial index
custom panel optimizer
```

数据：

```text
Polars
PyArrow
DuckDB
Decimal
```

EDA/CAM：

```text
Agent 16 PCB IR
Agent 29 Gerber/Drill/Paste parsers
KiCad CLI DRC adapter
manufacturer DFM feedback adapters
```

前端：

```text
React
TypeScript
Gerber/PCB/Panel Viewer
Heatmaps
Capability Margin Overlay
Supplier Comparison
```

---

# 86. 推荐仓库结构

```text
dfm-dfa-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── dfm-dfa-agent-spec.md
│   ├── input-and-profile-gates.md
│   ├── capability-profile-model.md
│   ├── process-route-model.md
│   ├── manufacturing-feature-ir.md
│   ├── fabrication-dfm.md
│   ├── assembly-dfa.md
│   ├── stencil-dfm.md
│   ├── panelization.md
│   ├── special-processes.md
│   ├── yield-and-process-window.md
│   ├── supplier-compatibility.md
│   ├── deviations-and-feedback.md
│   ├── repair-and-agent19.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-drc-pass-is-not-dfm-pass.md
│       ├── 0002-capabilities-are-versioned-profiles.md
│       ├── 0003-recommended-is-not-absolute-minimum.md
│       ├── 0004-dfm-and-dfa-have-process-context.md
│       ├── 0005-panelization-is-multi-objective.md
│       ├── 0006-cam-changes-are-deviations.md
│       └── 0007-repairs-run-through-upstream-agents.md
├── src/
│   └── dfm_dfa/
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
│       │   ├── agent24.py
│       │   ├── agent25.py
│       │   ├── agent26.py
│       │   ├── agent27.py
│       │   ├── agent28.py
│       │   ├── agent29.py
│       │   ├── agent43.py
│       │   ├── agent44.py
│       │   └── agent45.py
│       ├── profiles/
│       │   ├── fabrication.py
│       │   ├── assembly.py
│       │   ├── stencil.py
│       │   ├── panel.py
│       │   ├── importers.py
│       │   ├── admission.py
│       │   └── effective_rules.py
│       ├── features/
│       │   ├── extractor.py
│       │   ├── copper.py
│       │   ├── drills.py
│       │   ├── mask.py
│       │   ├── paste.py
│       │   ├── outline.py
│       │   ├── components.py
│       │   └── special_process.py
│       ├── geometry/
│       │   ├── distances.py
│       │   ├── offsets.py
│       │   ├── density.py
│       │   ├── necks.py
│       │   ├── spatial.py
│       │   └── transforms.py
│       ├── fabrication/
│       │   ├── trace_space.py
│       │   ├── annular_ring.py
│       │   ├── drills.py
│       │   ├── holes.py
│       │   ├── mask.py
│       │   ├── silkscreen.py
│       │   ├── copper_balance.py
│       │   ├── thermal.py
│       │   ├── edge.py
│       │   └── special.py
│       ├── assembly/
│       │   ├── components.py
│       │   ├── equipment.py
│       │   ├── nozzles.py
│       │   ├── feeders.py
│       │   ├── spacing.py
│       │   ├── orientation.py
│       │   ├── tombstone.py
│       │   ├── bga_qfn.py
│       │   ├── pth.py
│       │   ├── wave.py
│       │   ├── selective.py
│       │   ├── pressfit.py
│       │   ├── reflow.py
│       │   ├── inspection.py
│       │   └── rework.py
│       ├── stencil/
│       │   ├── apertures.py
│       │   ├── ratios.py
│       │   ├── thermal_pad.py
│       │   ├── fine_pitch.py
│       │   ├── via_in_pad.py
│       │   └── variants.py
│       ├── panel/
│       │   ├── ir.py
│       │   ├── candidates.py
│       │   ├── optimizer.py
│       │   ├── rails.py
│       │   ├── fiducials.py
│       │   ├── tooling.py
│       │   ├── vscore.py
│       │   ├── tabs.py
│       │   ├── mouse_bites.py
│       │   ├── stress.py
│       │   └── scoring.py
│       ├── process/
│       │   ├── routes.py
│       │   ├── matching.py
│       │   └── special.py
│       ├── yield_risk/
│       │   ├── margins.py
│       │   ├── exposure.py
│       │   ├── correlations.py
│       │   └── calibration.py
│       ├── suppliers/
│       │   ├── matrix.py
│       │   ├── feedback.py
│       │   ├── confirmations.py
│       │   └── deviations.py
│       ├── findings/
│       ├── repairs/
│       ├── review/
│       ├── release/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── capability-profiles/
├── process-routes/
├── equipment-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_dfm_readiness.py
    ├── import_capability_profile.py
    ├── extract_manufacturing_features.py
    ├── run_fabrication_dfm.py
    ├── run_assembly_dfa.py
    ├── generate_panel_candidates.py
    ├── build_supplier_matrix.py
    ├── generate_dfm_repairs.py
    ├── submit_dfm_repairs.py
    └── run_dfm_dfa_benchmark.py
```

---

# 87. 当前工具和资料基线

实施时应核验目标版本，不把以下能力硬编码为永久事实：

- KiCad 10 PCB DRC、Custom Rules、Component Classes、Board Stack-up 和 `kicad-cli pcb drc`；
- KiCad Jobsets 和生产文件导出；
- Ucamco Gerber/XNC 官方规范；
- 目标 PCB、SMT 和钢网厂的官方 Capability、Panelization、BOM/CPL 和 Stencil 文档；
- 企业历史 CAM 修改、试产缺陷和良率数据库。

参考入口：

```text
https://docs.kicad.org/10.0/en/cli/cli.html
https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html
https://www.ucamco.com/en/gerber/downloads
```


---

# 88. Codex 分阶段实施

不要让 Codex 一次实现制造 Profile、几何 DFM、贴装设备匹配、钢网、拼板、供应商矩阵、良率模型、Agent 19 修复和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–29 的真实实现和数据契约；
2. 当前 PCB/Panel/Gerber/Drill/BOM/CPL/Paste/Assembly Drawing；
3. 当前 Agent 20 Footprint、Padstack、Courtyard、Paste 和 Fabrication Property；
4. 当前 Agent 24 制造、装配、阻焊、孔和特殊工艺约束；
5. 当前 Agent 25 Placement、方向、Fiducial、Board Edge 和 Fixed Object；
6. 当前 Agent 26 Track/Via/Zone、铜密度和未布网络；
7. 当前 Agent 27 DRC、SI/PI/EMC 和 Release Gate；
8. 当前 Agent 28 Mechanical、工具、返修、装配顺序和分板敏感对象；
9. 当前 Agent 29 生产文件、Stencil、Release Manifest 和 Verification；
10. 当前制造商 Capability Profile；
11. 当前 SMT Line、Placement Machine、Nozzle、Feeder 和 Inspection Profile；
12. 当前 Stencil、Panel、V-score、Tab Route 和 Depanel Profile；
13. 当前最小线宽、间距、环宽、孔径、纵横比、孔到铜、阻焊桥和板边规则；
14. 当前 Copper Balance、Thermal Relief 和特殊工艺检测；
15. 当前 Component Mountability、Spacing、Orientation 和 Defect Risk；
16. 当前 BGA/QFN、Wave、Selective、Press-fit、Underfill 和 Coating；
17. 当前 Panel Generator 和 Optimization；
18. 当前 CAM Feedback、Manufacturing Deviation 和 Supplier Confirmation；
19. 当前 Yield、Defect、Repair、Scrap 和 Pilot 数据；
20. 当前 Agent 19、43、44、45 的接口；
21. 当前 Review UI、API、Worker、Database、Object Storage 和 Security；
22. 当前开源、合成、脱敏或授权 Fixture；
23. 统计 Profile 覆盖、来源、版本和过期情况；
24. 统计现有 DFM/DFA 规则覆盖；
25. 统计人工 CAM 修改和供应商问询；
26. 统计拼板、贴装、钢网和分板缺陷；
27. 只运行只读扫描和安全的公开 Fixture 检查；
28. 不修改 PCB、生产文件或 Profile；
29. 不生成正式拼板或生产 Release；
30. 不调用供应商订单接口；
31. 不创建 Migration；
32. 不安装 DFM/CAM 软件；
33. 不调用外部通用模型；
34. 不读取或打印 Secret、报价、良率和客户生产数据。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Job；
- Input Snapshot；
- Fabrication/Assembly/Stencil/Panel Profile；
- Capability Rule；
- Import Run；
- Process Route；
- Manufacturing Feature IR；
- Feature；
- Effective Trace；
- Fabrication Run/Finding；
- Component Profile；
- Mountability；
- Spacing；
- Orientation；
- Defect Risk；
- Assembly Run/Finding；
- Stencil Run/Finding；
- Panel Plan/Candidate/Feature/Finding；
- Special Process；
- Supplier Match；
- Yield Risk；
- Cost/Lead-time；
- Deviation；
- Unified Finding；
- Repair；
- Change Plan；
- Regression；
- Waiver；
- Baseline；
- Gate；
- Report；
- JSON Schema。

## Phase 2：Agent 16–29 Input Gate

实现：

- Project/Assembly/Variant；
- Agent 18/20/26/27/28/29 Gate；
- Stack-up/Material/Copper/Finish；
- Required Artifacts；
- Profile Freshness；
- Generic/Supplier-specific；
- Snapshot Hash；
- Diagnostics。

## Phase 3：Capability Profile Registry

实现：

- Profile Types；
- Supplier/Site；
- Version/Effective Date；
- Source/Hash；
- Conditions；
- Tiers；
- Cost/Lead-time；
- Approval/Deprecation；
- Search；
- Diff；
- Contract Tests。

## Phase 4：Profile Import Pipeline

实现：

- Official Web/PDF/CSV/Manual Source；
- Candidate Extraction；
- Unit Normalization；
- Condition Preservation；
- Ambiguity；
- Evidence；
- Human Review；
- Approval；
- No Direct Production Use；
- Security。

## Phase 5：Rule Engine and Effective Trace

实现：

- Typed Expressions；
- Units；
- Recommended/Standard/Advanced；
- Precedence；
- Effective Dates；
- Insufficient Context；
- Shadowed/Expired；
- Explain Trace；
- Coverage；
- Deterministic Tests。

## Phase 6：Manufacturing Feature IR

实现：

- Board/Layers；
- Copper；
- Drill；
- Mask；
- Paste；
- Outline；
- Components；
- Panel；
- Special Process；
- Source Map；
- Stable Hash；
- Parquet；
- Incremental Rebuild。

## Phase 7：Geometry Kernel

实现：

- Distance；
- Offset；
- Intersection；
- Density Window；
- Neck Detection；
- Board/Panel Transform；
- Spatial Index；
- Tolerance；
- Unit Tests；
- Property Tests。

## Phase 8：Trace/Space DFM

实现：

- Inner/Outer；
- Copper Weight；
- Track/Pad/Via；
- Same/Different Net；
- Neck-down；
- Affected Length/Count；
- Tier/Cost；
- Geometry Evidence；
- Gate。

## Phase 9：Drill/Annular Ring DFM

实现：

- Finished/Tool Hole；
- Plating；
- PTH/NPTH；
- Slot；
- Annular Ring；
- Aspect Ratio；
- Hole-to-copper；
- Hole-to-hole；
- Layer Span；
- Findings。

## Phase 10：Mask/Silkscreen DFM

实现：

- Expansion；
- Dam/Bridge；
- Shared Opening；
- Sliver；
- Via Tent/Plug；
- Silk-to-pad/mask/edge；
- Text/Stroke；
- Profile Conditions；
- Evidence。

## Phase 11：Copper Balance and Thermal DFM

实现：

- Global/Local Density；
- Layer Pair；
- Top/Bottom；
- Sliver/Island；
- Neck；
- Thermal Spokes；
- Heat-sink Pad；
- Warpage Candidate；
- Thieving Candidate；
- No Auto Copper Add。

## Phase 12：Board Edge and Mechanical Fabrication

实现：

- Outline；
- Route Radius；
- Cutout/Slot；
- Copper/Mask/Component-to-edge；
- Bevel；
- Castellation；
- Edge Plating；
- V-score/Tab Distance；
- Agent 28 Link。

## Phase 13：Special Process Detector

实现：

- HDI；
- Microvia；
- Via-in-pad；
- Fill/Cap；
- Backdrill；
- Heavy Copper；
- Metal Core；
- Rigid-flex/Flex；
- Gold Finger；
- Edge Plating；
- Cavity；
- Press-fit；
- Requirement Manifest。

## Phase 14：Special Process Capability Match

实现：

- Supplier Profiles；
- Required Parameters；
- Artifact Mapping；
- Inspection；
- Manual Review；
- Cost/Lead-time；
- Unsupported；
- Confirmation Package。

## Phase 15：Component Manufacturing Profiles

实现：

- Package Family；
- Body/Land；
- Pitch；
- Size/Height/Weight；
- Pickup；
- Feeder；
- Polarity；
- Reflow/MSL optional；
- X-ray/Rework；
- Data Quality。

## Phase 16：Equipment Registry and Matching

实现：

- Placement Machines；
- Nozzles；
- Feeders；
- Vision；
- Printer/SPI；
- Reflow；
- AOI/X-ray；
- Wave/Selective；
- Press-fit；
- Approval/Version；
- Match Trace。

## Phase 17：Component Mountability

实现：

- Standard/Special Nozzle；
- Tray/Tube/Tape；
- Manual Place；
- Unsupported；
- Missing Data；
- Equipment Alternatives；
- Findings；
- Supplier Matrix Hook。

## Phase 18：Assembly Spacing

实现：

- Body；
- Nozzle；
- Vision；
- Rework；
- AOI；
- X-ray；
- Wave Shadow；
- Depanel；
- Heat-sensitive；
- 2D/3D Agent 28 Inputs；
- Evidence。

## Phase 19：Orientation Review

实现：

- Polarity；
- Machine；
- Wave Direction；
- AOI；
- Connector；
- Thermal；
- Depanel；
- Objective Conflict；
- Required/Recommended/Neutral；
- No Blanket Rotation Rule。

## Phase 20：Defect Risk Heuristics

实现：

- Tombstone；
- Skew；
- Solder Beading；
- Head-in-Pillow；
- Void Candidate；
- Shadow；
- Thermal Imbalance；
- Confidence；
- Process Context；
- Candidate-only Language。

## Phase 21：BGA/QFN/LGA DFA

实现：

- Pitch；
- Pad Definition；
- Via-in-pad；
- Paste/Thermal；
- Window Pane；
- X-ray；
- Rework；
- Escape；
- Void Candidate；
- Capability Match。

## Phase 22：PTH/Wave/Selective DFA

实现：

- Pin/Hole；
- Lead；
- Shadow；
- Solder Thief；
- Bottom SMT；
- Adhesive；
- Wave Direction；
- Selective Nozzle；
- Keepout；
- Pallet；
- Findings。

## Phase 23：Press-fit and Special Assembly

实现：

- Hole/Tolerance；
- Plating；
- Alignment；
- Support Fixture；
- Force Path；
- Board Flex；
- Tool；
- Agent 28；
- Capability Match；
- Inspection。

## Phase 24：Stencil Feature Analysis

实现：

- Source Mapping；
- Width/Web；
- Area/Aspect；
- Fine Pitch；
- Thermal Window；
- Via-in-pad；
- DNP；
- Fiducial；
- Step Requirement；
- Evidence。

## Phase 25：Stencil Capability Match

实现：

- Thickness；
- Laser；
- Step；
- Coating；
- Minimum Web/Aperture；
- Profile Tier；
- Cost/Lead-time；
- Supplier Compatibility；
- Gate。

## Phase 26：Reflow and Double-sided DFA

实现：

- Top/Bottom Sequence；
- Component Mass Candidate；
- Temperature Rating；
- Thermal Mass；
- Large Copper；
- Nitrogen Candidate；
- Warpage；
- Bake/MSL Context；
- Findings。

## Phase 27：Inspection and Rework DFA

实现：

- SPI；
- AOI；
- Polarity；
- Hidden Joints；
- X-ray；
- X-ray Overlap；
- ICT/FCT；
- Hot-air；
- Underfill/Coating；
- Shield/Heat-sink；
- Agent 28/45 Feedback。

## Phase 28：Process Route Planner

实现：

- Candidate Routes；
- Top/Bottom SMT；
- Reflow；
- PTH；
- Wave/Selective；
- Press-fit；
- Underfill/Coating；
- Inspection；
- Depanel；
- Equipment/Supplier Constraints；
- Route Hash。

## Phase 29：Panel IR and Hard Constraints

实现：

- Board Instances；
- Rails；
- Tooling；
- Fiducials；
- V-score；
- Routing；
- Tabs/Mouse Bites；
- Coupons；
- Labels；
- Direction；
- Geometry Validation。

## Phase 30：Panel Candidate Generator

实现：

- Array；
- Rotation；
- Rail；
- V-score/Route；
- Board Shapes；
- Quantity；
- Candidate Seeds；
- Determinism；
- Time Budget；
- Invalid Candidate Rejection。

## Phase 31：Panel Optimizer and Pareto

实现：

- Utilization；
- Throughput；
- Routing/V-score Length；
- Rails；
- Depanel Risk；
- Orientation；
- Tooling；
- Supplier Match；
- Pareto；
- Explain Trace。

## Phase 32：Depanel Stress and Panel DFA

实现：

- Component-to-tab/V-score；
- Copper-to-cut；
- MLCC/BGA/Crystal；
- Direction；
- Board Thickness；
- Method；
- Tool Access；
- AOI/Conveyor；
- Findings。

## Phase 33：Fiducial/Tooling/Rail Review

实现：

- Global/Local；
- Mask/Clearance；
- Distribution；
- Side；
- Rail；
- Tooling Holes；
- Conveyor；
- Printer/Placement/AOI；
- Supplier Rules。

## Phase 34：Yield Risk and Process Window

实现：

- Capability Margin；
- Exposure；
- Density；
- Process Interactions；
- Risk Level；
- Confidence；
- No Fake Yield Percentage；
- Pilot Calibration Hook；
- Explain Trace。

## Phase 35：Cost and Lead-time Classification

实现：

- Profile Cost Classes；
- Special Process；
- Equipment；
- Manual Place；
- X-ray；
- Panel；
- Quote Required；
- No Fabricated Money；
- Supplier Comparison。

## Phase 36：Supplier Compatibility Matrix

实现：

- Fabrication/Assembly/Stencil/Panel；
- Process Route；
- Hard/Advanced/Unknown；
- Cost/Lead-time；
- Inspection；
- Overall Status；
- Score Vector；
- No Auto Supplier Selection。

## Phase 37：Supplier Feedback and Deviation

实现：

- CAM Finding Import；
- Supplier Question；
- Proposed Change；
- Artifact/Release Binding；
- Deviation；
- Approval；
- Lot/Quantity Effectivity；
- Return Data；
- Audit。

## Phase 38：Unified Finding and Correlation

实现：

- Domains；
- Conclusion Types；
- Supplier Scope；
- Severity/Risk/Cost/Lead-time；
- Evidence；
- Stable Key；
- Dedup；
- Cross-domain Causal Relation；
- No Text-only Merge。

## Phase 39：Repair Routing

实现：

- Agent 20/24/25/26/27/28/29/43/44/45；
- Expected Effect；
- Side Effects；
- Cost Impact；
- Verification Plan；
- Agent 19 Plan；
- No Direct Source Mutation。

## Phase 40：Post-repair Regression

实现：

- Agent 19 Result；
- Agent 29 Regeneration；
- Fabrication；
- Stencil；
- Assembly；
- Panel；
- Special Process；
- Supplier Matrix；
- New/Resolved/Worsened；
- Rollback Recommendation。

## Phase 41：Review Workbench

实现：

- Profile Switch；
- PCB/Panel/Paste Viewer；
- Margin Overlay；
- Equipment/Component；
- Process Route；
- Supplier Matrix；
- Cost/Lead-time；
- Deviations；
- Repairs；
- Regression；
- Gate。

## Phase 42：Baseline、Waiver、CI 和 Release Gate

实现：

- Baseline；
- Profile Snapshot；
- Finding Diff；
- Waiver Scope/Expiry；
- Supplier Deviation；
- CLI；
- Gate Profiles；
- Manifest；
- Exit Codes；
- Events。

## Phase 43：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Parquet；
- Permissions；
- Audit；
- Metrics；
- Artifact Lifecycle；
- Profile Refresh Jobs。

## Phase 44：Benchmark、监控和生产发布

实现：

- Fabrication Golden；
- Assembly Golden；
- Stencil Golden；
- Panel Golden；
- Supplier Profiles；
- Yield Correlation；
- False Positive/Negative；
- Security；
- Performance；
- Feature Flags；
- Rule/Profile Rollback；
- Disaster Recovery。

## Phase 45：高级能力，可选

稳定后：

- Supplier API Capability Sync；
- CAM Tool Integration；
- Panel Nesting for Irregular Boards；
- Reflow Thermal Simulation Handoff；
- Warpage/Board Flex Solver Handoff；
- Placement Machine Program Pre-check；
- Automated NPI Defect Learning；
- 仍不自动替代供应商 CAM 和首件确认。

---

# 89. Codex 工作纪律

Codex 必须：

1. DRC、DFM、DFA 分层；
2. Input Snapshot 不可变；
3. Profile Source/Version/Effective Date；
4. Supplier Site 显式；
5. Recommended/Standard/Advanced 分开；
6. Unknown 不视为 Pass；
7. Expired Profile 不用于量产 Gate；
8. Generic Profile 不冒充 Supplier-specific；
9. Rule Condition 显式；
10. Unit 显式；
11. Copper Weight/Layer/Material 条件显式；
12. Effective Rule Trace 完整；
13. 绝对最小值不等于推荐值；
14. 过程窗口与硬能力分开；
15. 良率风险不伪造成缺陷概率；
16. 成本无数据不编造金额；
17. Lead-time 无数据只分类；
18. Gerber/Drill 与 PCB IR 交叉使用；
19. Fabrication Feature 有 Source Map；
20. Trace/Space 保存受影响长度/数量；
21. Drill 保存 Finished/Tool；
22. PTH/NPTH/Slot/Via 类型分开；
23. Aspect Ratio 按 Via 类型；
24. Mask Bridge 按工艺条件；
25. Via-in-pad 按填孔工艺；
26. Copper Balance 只生成建议；
27. Acid Trap 只作 Candidate；
28. 特殊工艺显式；
29. Component Profile 有数据质量；
30. Nozzle/Feeder/Equipment 有版本；
31. Courtyard Pass 不等于 Mountable；
32. Orientation 有目标和冲突；
33. Tombstone 等是风险候选；
34. Wave/Selective/Press-fit 有工艺路线；
35. Stencil Thickness 必填；
36. DNP Stencil Policy 显式；
37. Panel Hard Constraints 优先；
38. Panel Candidate 保存 Seed/参数；
39. V-score/Tab/Mouse Bite 分开；
40. Depanel Stress 有敏感器件；
41. Fiducial/Tooling 按产线；
42. Supplier Matrix 不自动选供应商；
43. CAM 修改转成 Deviation；
44. Deviation 有 Release/Lot Effectivity；
45. Profile Import 候选需人工批准；
46. AI 不生成阈值和几何；
47. AI 不接受制造偏差；
48. 修复按上游 Agent 路由；
49. Agent 19 写入前 Preview；
50. 修复后 Agent 29重生成；
51. 全量 DFM/DFA Regression；
52. New/Worsened 是 Gate；
53. Prototype/Pilot/Mass Production Gate 分开；
54. Pilot Yield 不自动覆盖官方能力；
55. 不发送私有资料给外部模型；
56. 不用客户生产数据做公开 Fixture；
57. 不伪造供应商、良率、成本或 Benchmark；
58. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Profile/Rule/Equipment 变化；
    - 测试命令和真实结果；
    - Fabrication DFM；
    - Assembly DFA；
    - Stencil；
    - Panel；
    - Special Process；
    - Supplier Matrix；
    - Yield/Cost；
    - Repair/Regression；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 90. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input/Profile

1. Matching Release；
2. Revision Mismatch；
3. Variant Mismatch；
4. DRC Block；
5. Mechanical Block；
6. Agent29 Artifact Block；
7. Generic Profile；
8. Supplier Profile；
9. Expired Profile；
10. Unapproved Profile；
11. Conditional Rule；
12. Tier Selection；
13. Rule Shadow；
14. Unknown Context；
15. Unit Conversion。

## Fabrication

16. Outer Trace Width；
17. Inner Trace Width；
18. Track Spacing；
19. Pad Spacing；
20. Hole-to-copper；
21. Copper-to-edge；
22. Annular Ring；
23. Minimum Drill；
24. Finished Hole；
25. Aspect Ratio；
26. PTH；
27. NPTH；
28. Slot；
29. Blind Via；
30. Microvia；
31. Solder Mask Dam；
32. Shared Opening；
33. Via Tent；
34. Silkscreen；
35. Copper Sliver；
36. Copper Island；
37. Density Imbalance；
38. Thermal Spokes；
39. Outline Radius；
40. Castellation；
41. Edge Plating；
42. Backdrill；
43. Via-in-pad Unknown；
44. Filled/Capped Via；
45. Heavy Copper。

## Assembly

46. Standard Mountable；
47. Special Nozzle；
48. Tray-only；
49. Manual Place；
50. Unsupported Component；
51. Missing Component Data；
52. Nozzle Collision；
53. Rework Spacing；
54. AOI Occlusion；
55. X-ray Overlap；
56. Orientation Required；
57. Orientation Conflict；
58. Tombstone Candidate；
59. QFN Thermal Pad；
60. BGA X-ray Required；
61. Wave Direction；
62. Wave Shadow；
63. Selective Nozzle Access；
64. Press-fit；
65. Double-sided Reflow；
66. Heavy Bottom Component；
67. MSL Data Missing；
68. Underfill；
69. Conformal Coating；
70. Rework Blocked。

## Stencil

71. Minimum Aperture；
72. Minimum Web；
73. Area Ratio；
74. Aspect Ratio；
75. Thermal Window；
76. Fine Pitch；
77. Via-in-pad；
78. Step Stencil；
79. Nano Coating Candidate；
80. DNP Shared Stencil；
81. Variant Stencil；
82. Missing Thickness；
83. Missing Fiducial；
84. Source Mapping；
85. Profile Cost Adder。

## Panelization

86. Single Board Rails；
87. V-score Array；
88. Irregular Board Tab Route；
89. Mouse Bite；
90. Panel Size；
91. Rail Width；
92. Tooling Holes；
93. Global Fiducials；
94. Local Fiducials；
95. Copper-to-vscore；
96. Component-to-tab；
97. MLCC Depanel Risk；
98. BGA Depanel Risk；
99. Router Diameter；
100. Mixed Design Policy；
101. Utilization Pareto；
102. Throughput Pareto；
103. Supplier Panel；
104. Customer Panel；
105. Panel Infeasible。

## Supplier/Workflow/Security

106. Standard Compatible；
107. Advanced Compatible；
108. Engineering Review；
109. Incompatible；
110. Unknown；
111. Special Process Match；
112. Cost Class；
113. Lead-time Class；
114. CAM Feedback Import；
115. Deviation Approval；
116. Lot Effectivity；
117. Agent 20 Repair；
118. Agent 24 Repair；
119. Agent 25 Repair；
120. Agent 26 Repair；
121. Agent 27 Regression；
122. Agent 28 Regression；
123. Agent 29 Regeneration；
124. Agent 19 Preview；
125. Post-repair Regression；
126. Baseline；
127. Waiver Expiry；
128. Malicious Profile；
129. CSV Formula Injection；
130. Path Traversal；
131. Oversized Geometry；
132. Tenant Isolation；
133. 100 Supplier Profiles；
134. 1M Features；
135. Audit Replay。

---

# 91. 初始质量目标

```text
Required Input Snapshot Trace Coverage = 100%
Capability Profile Source/Version Coverage = 100%
Expired Profile Production Use = 0
Unknown Required Capability Auto-pass = 0
Recommended/Standard/Advanced Tier Disclosure = 100%
Fabrication Finding Geometry Evidence Coverage = 100%
Component Mountability Equipment Trace Coverage = 100%
Stencil Aperture Source Mapping = 100%
Panel Hard Constraint Violation Accepted = 0
Special Process Unknown Released to Mass Production = 0
CAM Change without Deviation Record = 0
Cost Amount Fabricated without Quote Data = 0
Supplier Auto-selection = 0
AI Numeric Threshold Generation = 0
Post-repair Agent29 Regeneration Coverage = 100%
Post-repair Full DFM/DFA Regression = 100%
Private Supplier/Yield Data Sent to External Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 92. 性能要求

常规工程：

```text
100–2,000 Components
2–20 Copper Layers
10k–1M Manufacturing Features
1–20 Supplier Profiles
1–20 Panel Candidates
```

目标：

```text
Readiness P95 < 15 s
Feature Extraction P95 < 60 s
Fabrication DFM P95 < 90 s
Assembly DFA P95 < 90 s
Stencil DFM P95 < 30 s
Panel Candidate Quick Mode P95 < 60 s
Supplier Matrix P95 < 30 s
Interactive Finding Query P95 < 300 ms
```

大型工程要求：

- Spatial Index；
- Feature Partition；
- Parquet；
- Incremental Cache；
- Parallel Supplier Evaluation；
- Panel Time Budget；
- Worker Pool；
- Cancel/Retry；
- Partial Diagnostics；
- 不把完整生产文件发送给 AI。

---

# 93. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/dfm-dfa-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第30个 Agent：

PCB Design for Manufacturing & Assembly Feasibility Agent /
DFM/DFA 制造可行性 Agent。

本 Agent 接收：

- Agent 16 PCB/Board/Layer/Footprint/Pad/Track/Via/Zone/Hole IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Footprint/Padstack/Courtyard/Paste/Fabrication Property；
- Agent 24 Stack-up、制造、装配和特殊工艺约束；
- Agent 25 Placement、Orientation、Fiducial 和 Board Edge；
- Agent 26 Routing/Copper/Via/Zone；
- Agent 27 DRC/SI/PI/EMC Release Gate；
- Agent 28 3D/Mechanical/Tool/Rework/Assembly；
- Agent 29 Gerber/Drill/BOM/CPL/Assembly Drawing/Stencil/Manifest；
- PCB、SMT、Stencil 和 Panel Capability Profiles；
- Process Route、Equipment、Nozzle、Feeder、Inspection 和 Pilot Yield 数据；

执行：

- Fabrication DFM；
- Assembly DFA；
- Stencil DFM；
- Panelization；
- Special Process Detection；
- Manufacturer/Assembler Compatibility；
- Process Window/Yield Risk；
- Cost/Lead-time Classification；
- Manufacturing Deviation；
- Repair/Feedback；
- Agent 19 Controlled Change；
- Agent 29 Regeneration；
- Full Regression 和 Release Gate。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–30 规格和 Agent 16–29 实际代码；
3. docs/dfm-dfa-agent-spec.md；
4. 当前 PCB/Gerber/Drill/BOM/CPL/Paste；
5. 当前 Footprint/Padstack/Courtyard；
6. 当前 Constraints/Placement/Routing；
7. 当前 DRC/Mechanical/Manufacturing Release Gates；
8. 当前 Capability Profiles；
9. 当前 Equipment/Nozzle/Feeder/Inspection；
10. 当前 Fabrication DFM；
11. 当前 Assembly DFA；
12. 当前 Stencil；
13. 当前 Panelization；
14. 当前 Special Process；
15. 当前 Supplier Feedback/Deviation；
16. 当前 Yield/Defect/Repair；
17. 当前 Agent 19/43/44/45；
18. 当前 UI/API/Worker/Storage/Security；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- DRC != DFM != DFA；
- One Immutable Input Snapshot；
- Agent 18/20/26/27/28/29 Gates；
- Versioned Supplier/Site Profiles；
- Effective Date；
- Recommended/Standard/Advanced Separation；
- Unknown != Pass；
- Expired Profile Block；
- Generic != Supplier-specific；
- Conditional Rules and Units；
- Effective Capability Trace；
- Absolute Minimum != Recommended；
- Hard Violation != Yield Risk != Cost Adder；
- No Fake Yield or Price；
- Feature Source Mapping；
- Finished/Tool Hole Separation；
- Via-in-pad Process Explicit；
- Special Processes Explicit；
- Equipment/Nozzle/Feeder Trace；
- Courtyard Pass != Mountability；
- Orientation Objectives Explicit；
- Defect Heuristics Are Candidates；
- Stencil Thickness/Profile Required；
- Panel Hard Constraints First；
- Supplier Matrix Does Not Auto-select；
- CAM Changes Become Deviations；
- Profile Import Requires Approval；
- AI Does Not Generate Thresholds；
- Repairs Routed to Upstream Agents；
- Agent 19 Workspace/Preview/Approval；
- Agent 29 Regeneration；
- Full Post-repair Regression；
- Prototype/Pilot/Mass Gates；
- 不发送私有资料给外部模型；
- 不用客户数据做公开 Fixture；
- 不伪造供应商、良率、价格和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改生产设计：

1. 侦察当前仓库；
2. 检查 Agent 16–29 Contract；
3. 查找 PCB/Gerber/Drill/BOM/CPL/Paste；
4. 查找 Footprint/Padstack/Courtyard；
5. 查找 Manufacturing Constraints；
6. 查找 Fabrication/Assembly/Stencil/Panel Profiles；
7. 查找 Capability Rule Engine；
8. 查找 Trace/Space/Drill/Mask/Copper Balance；
9. 查找 Component/Equipment/Nozzle/Feeder；
10. 查找 Assembly Spacing/Orientation/Risk；
11. 查找 Stencil；
12. 查找 Panel Generator/Optimizer；
13. 查找 Special Process；
14. 查找 Supplier Matrix；
15. 查找 CAM Feedback/Deviation；
16. 查找 Yield/Cost/Lead-time；
17. 查找 Agent 19/43/44/45；
18. 查找 UI/API/Worker/Storage/Security；
19. 统计 Profile 覆盖、版本和过期；
20. 统计 DFM/DFA 规则覆盖；
21. 统计人工 CAM 修改和缺陷；
22. 抽样分析开源、合成、脱敏或授权 Fixture；
23. 在 docs/dfm-dfa-implementation-plan.md 中生成实施计划；
24. 在 docs/input-and-profile-gates.md 中定义 Gate；
25. 在 docs/capability-profile-model.md 中定义 Profile；
26. 在 docs/process-route-model.md 中定义 Route；
27. 在 docs/manufacturing-feature-ir.md 中定义 IR；
28. 在 docs/fabrication-dfm.md 中定义 Fabrication；
29. 在 docs/assembly-dfa.md 中定义 Assembly；
30. 在 docs/stencil-dfm.md 中定义 Stencil；
31. 在 docs/panelization.md 中定义 Panel；
32. 在 docs/special-processes.md 中定义特殊工艺；
33. 在 docs/yield-and-process-window.md 中定义 Yield；
34. 在 docs/supplier-compatibility.md 中定义 Supplier Matrix；
35. 在 docs/deviations-and-feedback.md 中定义 Deviation；
36. 在 docs/repair-and-agent19.md 中定义 Repair；
37. 在 docs/release-gates.md 中定义 Gate；
38. 在 docs/ai-boundaries.md 中定义 AI；
39. 在 docs/security.md 中定义安全；
40. 在 docs/dfm-dfa-migration-plan.md 中定义旧流程迁移；
41. 在 docs/dfm-dfa-benchmark-plan.md 中定义 Benchmark；
42. 给出拟新增、拟修改和拟复用文件；
43. 给出 Phase 1 精确范围；
44. 不修改业务代码；
45. 不创建 Migration；
46. 不安装 DFM/CAM 软件；
47. 不修改 PCB/Profile/Release；
48. 不调用供应商订单接口；
49. 不调用外部通用模型；
50. 不读取或打印 Secret/Quote/Yield Data；
51. 运行仓库已有 lint、type check、test、build 和 security scan；
52. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–29 Contract；
- Input/Profile Gate；
- Capability Profile；
- Process Route；
- Manufacturing Feature IR；
- Fabrication DFM；
- Assembly DFA；
- Stencil；
- Panelization；
- Special Processes；
- Yield/Process Window；
- Cost/Lead-time；
- Supplier Matrix；
- Deviations；
- Repair/Feedback；
- Agent 19/29 Integration；
- Baseline/Waiver/Release Gate；
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

# 94. 后续 Phase 提示词模板

```text
继续实现 DFM/DFA Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–30 规格；
3. 阅读 DFM/DFA Implementation Plan；
4. 阅读 Gate、Profiles、Route、Feature IR、Fabrication、Assembly、Stencil、Panel、Supplier、Repair、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Profile Version and Effective Date；
- Recommended/Standard/Advanced；
- Evidence-grounded Geometry；
- Process Context；
- Supplier-neutral Core；
- No Fake Yield/Cost；
- Upstream Repair Routing；
- Agent 29 Regeneration；
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
9. profile/rule contract test；
10. geometry/feature test；
11. fabrication/assembly/stencil/panel test；
12. repair/regression test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Profile/Rule/Equipment 变化；
- 测试命令和真实结果；
- Fabrication DFM；
- Assembly DFA；
- Stencil；
- Panel；
- Special Process；
- Supplier Matrix；
- Yield/Cost；
- Repair/Regression；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 95. MVP 演示流程

1. 选择一块四层 MCU 控制板，带 USB-C、QFN、BGA、0201、PTH 连接器、双面 SMT 和异形板框；
2. Agent 16–28完成工程、布局、布线、DRC 和机械审查；
3. Agent 29生成并验证 Gerber、Drill、BOM、CPL、Assembly Drawing 和 Stencil；
4. 冻结 Project、Assembly 和 Standard Variant；
5. 绑定 Generic Profile、JLC 类原型 Profile、PCBWay 类标准 Profile 和一家私有 SMT 厂 Profile；
6. 建立 Process Route Candidate；
7. 提取 Manufacturing Feature IR；
8. 运行 Trace/Space 检查；
9. 发现内层某局部线距符合高级能力，但低于标准能力；
10. 输出 `compatible_advanced + cost_adder`，而不是简单 Fail；
11. 检查 Drill；
12. 发现一个机械槽被错误标为 PTH；
13. 反馈 Agent 20/29修复；
14. 检查 Annular Ring 和 Aspect Ratio；
15. 发现两个 Via 接近能力边界；
16. 检查阻焊桥；
17. QFN 相邻 Pad 无阻焊桥，但目标厂支持共享开窗；
18. 输出 `supported_with_shared_opening` 和焊接风险说明；
19. 检查 Copper Balance；
20. 发现顶底铜密度局部差异较大，输出 Warpage Candidate；
21. 识别 Via-in-Pad；
22. 其中一个 BGA Via 未指定填孔工艺；
23. 阻断量产 Gate；
24. 检查 Component Mountability；
25. 大型连接器需要 Tray，目标 SMT 厂支持；
26. 一个异形模块没有稳定 Pickup Surface；
27. 输出 Manual/Special Nozzle Review；
28. 检查 Placement Spacing；
29. AOI 相机视线被高连接器遮挡两个器件；
30. 输出 Inspection Risk；
31. 检查两端器件 Tombstone Risk；
32. 发现 Pad/Paste/Copper 热平衡不对称；
33. 反馈 Agent 20/26修复；
34. 检查 PTH 工艺；
35. 目标工艺路线选择 Selective Solder；
36. 一个 PTH Pin 周围 Nozzle Keepout 不足；
37. 反馈 Agent 25局部移动器件；
38. 检查 Stencil；
39. QFN Thermal Pad Window Pane 通过；
40. 0201 Aperture 对 0.12mm 钢网的面积比风险偏高；
41. 生成 0.10mm 钢网或 Step Stencil 候选，不自动选择；
42. 生成 Panel Candidate；
43. 候选 A：V-score，利用率高；
44. 候选 B：Tab Route，分板风险低；
45. 因异形板和板边 MLCC，V-score 候选被淘汰；
46. 输出三个 Tab Route Pareto Candidate；
47. 加入工艺边、Tooling Hole、Global/Local Fiducial；
48. 检查 Component-to-tab 和 Copper-to-route；
49. 生成 Supplier Compatibility Matrix；
50. 供应商 A 为 `compatible_advanced`；
51. 供应商 B 因 Via-in-Pad 工艺不明确为 `engineering_review_required`；
52. 私有 SMT 厂因异形模块无 Nozzle 为 `incompatible`；
53. 生成成本和交期类别，不编造报价金额；
54. 工程师批准：
55. 增大两个 Via；
56. 修正槽孔；
57. 对 BGA 指定 Filled and Capped；
58. 移动 Selective Solder 周围器件；
59. 调整两端器件 Pad/Paste；
60. 选择低分板风险 Panel；
61. Agent 19执行 ECAD 修复；
62. Agent 29重新生成 Production Artifacts；
63. Agent 30重新运行所有供应商 Profile；
64. 检查没有新增 SI、机械和生产文件问题；
65. Supplier Quote Ready Gate 通过；
66. 向 Agent 44提交 Supplier Matrix 和 Package ID，但不自动下单；
67. 试产数据返回后关联缺陷和返修；
68. 更新企业风险校准候选；
69. Pilot Gate 通过后冻结 Panel、Stencil 和 Process Route；
70. 发布 `dfm-dfa.completed`。

---

# 96. 生产上线顺序

第一阶段：

```text
Profile Registry
Manufacturing Feature IR
Trace/Space/Drill/Mask
Component Mountability
Generic/Supplier Report
Report-only
```

第二阶段：

```text
Stencil
Assembly Spacing/Orientation
Panelization
Special Process
Supplier Matrix
Agent 19/29 Regression
```

第三阶段：

```text
Equipment-level Matching
Yield Correlation
CAM Feedback
Process Route Optimization
Private Factory Deployment
NPI/MES Integration
```

上线优先确保：

```text
检查使用的是哪家工厂、哪个站点、哪个版本的能力
“不能做”“高级工艺”“容易做但良率差”和“只是会加价”是否被正确区分
拼板、钢网和贴装结论是否绑定真实工艺路线
修复设计后是否重新生成并检查生产文件
供应商 CAM 修改是否被完整记录并回流到设计和 PLM
```

一个靠谱的 DFM/DFA Agent，不应该只做一张红黄绿地图。它应该告诉工程师：哪里真的做不了，哪里只是贴着工艺悬崖走，哪里会让报价突然长胖，以及换一家工厂或换一种工艺后，答案为什么会不同。
