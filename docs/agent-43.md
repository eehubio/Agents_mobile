# EBOM、MBOM 与 NPI 转换 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：43  
> Agent 名称：EBOM-to-MBOM & NPI Transformation Agent  
> 中文名称：EBOM、MBOM 与 NPI 转换 Agent  
> 类型：混合型（程序规则 + 模板推理 + 人工审核）  
> 版本：V1.0  
>
> 定位：将研发阶段的 Engineering BOM、设计文件、固件、测试规范和结构件数据，转换为面向具体工厂、产线、产品阶段和客户要求的 Manufacturing BOM、工艺路线、工序用料、贴片位号、辅料、损耗、烧录、测试、校准、包装、工装和 NPI 放行数据包。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规、原产地与客户条件
> - Agent 36：实时价格与库存
> - Agent 37：BOM 风险与多源供应
> - Agent 38：MOQ、SPQ 与采购包装优化
> - Agent 39：成本、报价与利润
> - Agent 40：采购计划与缺料协同
> - Agent 41：库存复用与呆滞料
> - Agent 42：物料、Lot 与成品追溯
> - ezPLM 项目、BOM、文档、固件、工艺、质量、生产、包装和变更数据
>
> 下游：
> - MBOM 与制造版本
> - BOP / Routing / Operation Material Requirement
> - SMT 位号、Feeder 和上料准备
> - 工艺辅料和损耗
> - 烧录、序列号、密钥与校准要求
> - ICT、FCT、AOI、X-ray、Burn-in 和检验规范
> - 包装 BOM、标签和出货配置
> - NPI Readiness、试产放行和量产发布
> - Agent 38 采购包装和备料
> - Agent 39 制造成本
> - Agent 40 工单、齐套和采购计划
> - Agent 42 生产 Genealogy 与追溯
> - ERP / MES / WMS / QMS / APS / Supplier Portal
>
> 重要边界：
> - 本 Agent 生成制造数据草稿、校验结果和放行包，不自动发布量产版本，不自动修改原始 EBOM，不自动创建工单，不自动替换物料。
> - EBOM 是设计意图，MBOM 是特定工厂、产线、阶段、工艺和客户上下文下的制造定义，两者必须独立版本化。
> - 工艺辅料、损耗和包装材料不能以自由文本附注代替结构化物料和规则。
> - 实际生产消耗和批次谱系由 Agent 42 记录，本 Agent 只定义计划制造结构和追溯要求。
> - AI 只可用于生成草稿说明、发现疑似缺项和推荐模板，不得替代确定性的数量、位号、版本、工艺约束和放行审批。

---

# 1. 建设目标

系统必须能够：

1. 读取标准化 EBOM；
2. 读取 KiCad、Altium、Cadence 或其他 EDA 导出的 BOM、CPL/Pick-and-Place、PCB、Gerber、ODB++、IPC-2581、装配图和网表；
3. 读取机械结构 BOM、线束、电缆、外壳、紧固件和附件；
4. 读取固件、Bootloader、FPGA Bitstream、配置文件、校准文件和测试程序；
5. 读取工厂、产线、设备、工位、工艺能力和生产日历；
6. 将 EBOM 转换为一个或多个 MBOM；
7. 支持 Prototype、EVT、DVT、PVT、Pilot、Mass Production 和 Service Build；
8. 支持工厂、法人、制造地点和外协厂差异；
9. 支持客户定制和产品 Variant；
10. 支持 EBOM Line 到 MBOM Line 的 1:1、1:N、N:1 和 N:M 映射；
11. 保留 EBOM 到 MBOM 的完整 Transformation Trace；
12. 将 DNP、Variant、Effectivity 和替代料规则带入制造版本；
13. 将电子、机械、线束、标签、包装和软件配置整合到制造视图；
14. 自动识别并补充受控模板中的常见辅料；
15. 支持焊膏、助焊剂、胶水、三防漆、导热材料、清洗剂、扎带、螺丝胶和标签等辅料；
16. 支持辅料按件、面积、长度、重量、体积、Panel、批次和工序计量；
17. 支持百分比损耗、固定 Setup 损耗、Feeder 损耗、首件、抽检、返修和报废；
18. 支持 PCB Panel、拼板、Board Position 和 Depanelization；
19. 支持 RefDes 级贴片位号和安装面；
20. 支持同一 MPN 多位号聚合和工序分组；
21. 支持贴片、插件、手焊、压接、点胶、组装、烧录、测试、校准、老化和包装；
22. 支持 Routing、Operation、Work Center 和设备要求；
23. 支持工序前置条件、输入、输出、工时和良率；
24. 支持 Feeder 类型、料带宽度、Pitch、Tray、Tube、Reel 和上料要求；
25. 支持极性、Pin 1、方向和特殊装配提示；
26. 支持钢网、治具、夹具、烧录器、测试治具和工装；
27. 支持固件版本、哈希、签名、密钥注入和序列号；
28. 支持 ICT、FCT、Boundary Scan、AOI、SPI、X-ray、Burn-in 和 Calibration；
29. 支持测试限值、覆盖率、抽样方案、失败处置和重测；
30. 支持包装 BOM、配件、说明书、标签、内盒、外箱和托盘；
31. 支持 ESD、MSL、防潮、干燥剂、湿度卡和防护要求；
32. 支持装配工作指导书草稿；
33. 支持工序检验和质量控制点；
34. 支持追溯级别和扫码要求；
35. 支持 Lot 级、序列号级和 Reference Designator 级追溯配置；
36. 支持 NPI Readiness Checklist；
37. 支持 DFM、DFA、DFT、可采购性、合规和供应风险 Gate；
38. 支持试产问题、偏差、返工和关闭；
39. 支持从 EVT/DVT/PVT 到量产的逐阶段成熟；
40. 支持 NPI Build Package；
41. 支持 Engineering Change、Deviation、Waiver 和 Effectivity；
42. 支持 EBOM Revision 与 MBOM Revision 独立演进；
43. 支持一个 EBOM 对应多个工厂 MBOM；
44. 支持一个产品不同包装和销售配置；
45. 支持多层制造和半成品；
46. 支持 Make/Buy、Phantom、Kit 和 Subcontract；
47. 支持工序级用料和 Backflush 策略；
48. 支持替代料、AVL/AML 和 Approved Substitute；
49. 支持 Agent 38、39、40 和 42 的稳定数据契约；
50. 支持发布前完整性校验；
51. 支持差异比较和影响分析；
52. 支持人工锁定和覆盖；
53. 支持审批、签署和发布；
54. 支持事件驱动和增量重算；
55. 支持版本快照和 As-of 查询；
56. 支持多租户、客户、项目和工厂隔离；
57. 支持百万级 MBOM Line 和大量位号；
58. 不因 EBOM 有某物料就默认制造现场直接采购同一包装；
59. 不因位号相同就默认工序相同；
60. 不因固件文件名相同就认为版本相同；
61. 不因测试脚本存在就认为测试已放行；
62. 不因 NPI Checklist 填完就自动量产发布；
63. 不把自由文本备注当作唯一制造要求；
64. 不覆盖历史发布版本；
65. 不允许未批准替代料进入正式 MBOM。

---

# 2. 与 Agent 31–42 的边界

## 2.1 Agent 31

提供标准 EBOM：

```text
BOM Line
Quantity per
Reference Designator
DNP
Variant
原始字段和证据
```

Agent 43 不重新解析非标准 BOM。

## 2.2 Agent 32

提供精确：

```text
Part
Manufacturer
MPN
Package Variant
Ordering Variant
Internal Part Number
Customer Part Number
```

未解析身份的 EBOM Line 不能自动发布到 MBOM。

## 2.3 Agent 33

提供：

```text
approved alternative
replacement level
site/customer scope
validation status
```

Agent 43只把已批准替代写入 AML/AVL 或 MBOM Alternate Group。

## 2.4 Agent 34

提供生命周期、EOL、PCN、料号变更。

用于制造发布 Gate 和变更影响。

## 2.5 Agent 35

提供合规、原产地、客户和目的地要求。

用于 MBOM、包装、标签和物料放行。

## 2.6 Agent 36

提供供应商 SKU、价格、库存、包装和交期。

用于制造包装和采购可行性，不直接决定 MBOM 技术结构。

## 2.7 Agent 37

提供供应风险、单一来源、生命周期和区域风险。

用于 NPI Readiness 和第二来源行动。

## 2.8 Agent 38

提供合法采购数量、包装、Reel/Tray/Tube 和备料方案。

Agent 43提供生产包装要求，Agent 38提供采购包装方案。

## 2.9 Agent 39

消费：

```text
MBOM
Routing
Labor/Machine Time
Yield
Test
Packaging
NRE
```

用于制造成本和报价。

## 2.10 Agent 40

消费：

```text
MBOM Revision
Operation Need Date
Loss
Routing
Work-order Material Requirement
```

用于计划、齐套和采购。

## 2.11 Agent 41

提供库存复用建议和可用 Lot。

Agent 43定义库存能否用于当前 MBOM、工厂和客户。

## 2.12 Agent 42

Agent 43定义：

```text
planned traceability requirement
expected genealogy
scan points
lot/serial level
```

Agent 42记录实际生产 Genealogy。

---

# 3. 核心原则

## 3.1 EBOM、MBOM、BOP 和 Routing 分开

```text
EBOM
设计结构和功能关系

MBOM
制造所需物料结构

BOP
制造过程和工序结构

Routing
工序顺序、工作中心和时间
```

不能用一张 BOM 同时承载全部语义。

## 3.2 EBOM 不可被转换过程覆盖

转换生成新 MBOM Revision：

```text
EBOM Rev C
→ MBOM Suzhou Rev M5
→ MBOM Vietnam Rev M2
```

## 3.3 MBOM 有上下文

MBOM 必须绑定：

```text
product
variant
site
factory
line family
stage
customer
effectivity
```

## 3.4 EBOM Line 到 MBOM Line 不是总是 1:1

可能：

```text
1 EBOM Line → 多个制造包装/工序用料
多个 EBOM Line → 一个 Kit
一个设计模块 → 外购成品模块
一个器件 → 主料 + 焊膏 + 胶水 + 标签
```

## 3.5 预期结构和实际生产分开

Agent 43定义计划，Agent 42记录实际。

## 3.6 位号是制造一等对象

每个 RefDes 保存：

```text
part
side
x/y
rotation
operation
machine class
polarity
mounting status
```

## 3.7 辅料必须结构化

```text
consumable material
quantity basis
operation
loss
unit
approved material
```

不能只写“适量”。

## 3.8 损耗按层级定义

```text
material
operation
batch
panel
unit
site
stage
```

避免重复叠加。

## 3.9 固件是受控制造配置

保存：

```text
artifact
version
hash
signature
target
programmer
parameters
approval
```

## 3.10 测试要求必须可执行

包含：

```text
test program
equipment
fixture
limits
coverage
sampling
result schema
failure route
```

## 3.11 包装是 MBOM 的一部分

产品出货配置必须包含包装物料和标签版本。

## 3.12 NPI 是阶段 Gate，不是一个勾选框

EVT、DVT、PVT、Pilot 和 MP 各有不同 Gate。

## 3.13 Effectivity 是核心

支持：

```text
date
serial range
lot range
work-order range
customer order
site
```

## 3.14 Change 不覆盖历史

MBOM、Routing、Work Instruction、Firmware、Test 和 Packaging 分别版本化。

## 3.15 AI 只做辅助

允许：

```text
从模板推荐疑似缺失辅料
生成工作指导书草稿
总结 NPI 风险
```

禁止：

```text
猜测数量
猜测位号
猜测测试限值
自动发布
```

---

# 4. 核心对象

```text
EBOM Revision
EBOM Line
MBOM Revision
MBOM Line
EBOM-MBOM Mapping
Manufacturing Variant
BOP
Routing
Operation
Operation Material Requirement
RefDes Placement
Auxiliary Material
Loss Profile
Tooling
Firmware Package
Programming Requirement
Test Specification
Calibration Requirement
Packaging BOM
Work Instruction
Quality Control Point
Traceability Requirement
NPI Stage
NPI Checklist
NPI Build
Deviation
Release Package
```

---

# 5. EBOM 输入

```json
{
  "ebom_id": "uuid",
  "revision": "C",
  "product_id": "uuid",
  "variant": "standard",
  "status": "released",
  "effective_from": "2026-07-01",

  "lines": [
    {
      "line_id": "uuid",
      "part_id": "uuid",
      "quantity_per": "1",
      "unit": "each",
      "reference_designators": ["U1"],
      "dnp": false,
      "variant_rules": []
    }
  ]
}
```

---

# 6. MBOM 输出

```json
{
  "mbom_id": "uuid",
  "revision": "M1",
  "source_ebom": {
    "ebom_id": "uuid",
    "revision": "C"
  },
  "context": {
    "site_id": "suzhou",
    "stage": "pilot",
    "customer_id": null,
    "variant": "standard"
  },
  "lines": [],
  "routing_id": "uuid",
  "packaging_bom_id": "uuid",
  "status": "draft"
}
```

---

# 7. EBOM 到 MBOM Mapping

映射类型：

```text
one_to_one
one_to_many
many_to_one
many_to_many
consumed_by_subcontract
virtual_to_physical
phantom_collapse
kit_aggregation
```

每条 Mapping 保存：

```text
source lines
target lines
quantity rule
reason
transformation rule
evidence
review
```

---

# 8. MBOM Line 类型

```text
direct_material
subassembly
purchased_module
phantom
kit
consumable
auxiliary_material
tooling_consumable
packaging_material
label
documentation
software_configuration
customer_supplied_material
supplier_consigned_material
```

---

# 9. Make / Buy / Subcontract

```text
make
buy
subcontract
phantom
kit
customer_supplied
```

Subcontract 需要：

```text
issued materials
supplier process
return product
yield
traceability
ownership
```

---

# 10. 产品阶段

```text
prototype
EVT
DVT
PVT
pilot
mass_production
service_build
```

不同阶段允许不同：

```text
temporary material
manual process
rework
test coverage
traceability
approval
```

---

# 11. 制造 Variant

支持：

```text
sales variant
customer variant
regional variant
factory variant
firmware variant
packaging variant
service variant
```

Variant 规则不能只依赖文字备注。

---

# 12. Effectivity

```text
effective_from_date
effective_to_date
serial_from
serial_to
lot_from
lot_to
work_order_from
work_order_to
sales_order_scope
site_scope
```

冲突 Effectivity 必须阻断发布。

---

# 13. PCB 数据

输入：

```text
board outline
panelization
layer count
assembly side
fiducials
tooling holes
placement
rotation
footprint
pad
polarity
keepout
```

来源：

```text
KiCad
Altium
IPC-2581
ODB++
Pick-and-Place
```

---

# 14. RefDes 级定义

```json
{
  "refdes": "U1",
  "part_id": "uuid",
  "footprint": "QFN-32",
  "side": "top",
  "x_mm": "25.400",
  "y_mm": "18.200",
  "rotation_deg": "90",
  "operation_id": "smt-top",
  "polarity": "pin1",
  "mount_status": "place"
}
```

---

# 15. DNP 和 No-load

状态：

```text
place
dnp
optional
variant_excluded
engineering_only
test_only
```

DNP 位号不能进入生产需求，但保留设计证据。

---

# 16. 位号聚合

采购和工序可以按 Part 聚合数量，但必须保留：

```text
all reference designators
side
operation
variant
```

---

# 17. Panelization

保存：

```text
boards_per_panel
panel array
breakaway
rail
fiducial
tooling holes
panel loss
depanel method
```

物料需求和工时按 Board 或 Panel 正确换算。

---

# 18. SMT 工序

支持：

```text
solder paste printing
SPI
placement
reflow
AOI
X-ray
manual touch-up
```

Top 和 Bottom 可分开 Routing。

---

# 19. Feeder 和上料

要求：

```text
packaging type
tape width
pitch
reel diameter
tray
tube
feeder type
leader/trailer
orientation
minimum load quantity
```

Agent 38使用这些要求选择采购包装。

---

# 20. 插件和手工装配

支持：

```text
THT insertion
wave solder
selective solder
manual solder
press-fit
crimp
screw
adhesive
staking
```

---

# 21. 辅料

典型：

```text
solder paste
flux
solder wire
adhesive
underfill
conformal coating
cleaning agent
thermal grease
thermal pad
thread locker
tape
zip tie
label
ink
desiccant
humidity indicator
ESD bag
```

每种辅料必须有物料 ID 或受控规格。

---

# 22. 辅料用量规则

```text
per_unit
per_panel
per_batch
per_operation
per_area
per_length
per_weight
percentage_of_primary
fixed_setup
```

示例：

```yaml
material: solder-paste-SAC305
basis: board_area
rate_g_per_cm2: 0.003
setup_loss_g: 50
```

---

# 23. 损耗

```text
material scrap
setup loss
feeder loss
panel loss
process yield loss
sampling
rework
packaging damage
```

损耗不得同时在 EBOM Quantity、MBOM Quantity 和 Routing 三处重复叠加。

---

# 24. Operation Material Requirement

```json
{
  "operation_id": "smt-top",
  "mbom_line_id": "uuid",
  "quantity_per_output": "2",
  "unit": "each",
  "issue_method": "scan",
  "backflush": false,
  "loss_profile_id": "uuid",
  "traceability_level": "lot"
}
```

---

# 25. Routing

```text
operation sequence
predecessor
work center
setup time
run time
queue time
move time
inspection
yield
output
```

支持并行和合流。

---

# 26. Operation 类型

```text
material preparation
bake
solder paste
SMT top
SMT bottom
reflow
AOI
X-ray
THT
wave solder
manual assembly
cleaning
conformal coat
programming
calibration
ICT
FCT
burn-in
final inspection
packing
```

---

# 27. 工艺路线条件

```text
variant
site
line
stage
quantity range
customer
equipment availability
```

---

# 28. 工时

```text
setup_time
cycle_time
labor_time
machine_time
inspection_time
rework_allowance
```

Agent 39消费。

---

# 29. Tooling

```text
stencil
fixture
jig
programming fixture
ICT fixture
FCT fixture
depanel fixture
assembly jig
go/no-go gauge
```

保存：

```text
tooling revision
asset id
site
status
calibration
maintenance
capacity
```

---

# 30. 烧录要求

```text
target device
artifact
version
hash
signature
programmer
adapter
voltage
parameters
verification
```

---

# 31. Firmware Package

```json
{
  "firmware_package_id": "uuid",
  "version": "1.4.2",
  "artifacts": [
    {
      "type": "application",
      "uri": "s3://...",
      "sha256": "...",
      "target": "U1"
    }
  ],
  "status": "approved_for_pilot"
}
```

文件名不能作为唯一版本依据。

---

# 32. 序列号和密钥

支持：

```text
serial assignment
MAC address
IMEI
certificate
secure key
device identity
customer provisioning
```

要求：

```text
source
uniqueness
injection point
verification
traceability
security
```

---

# 33. 校准

保存：

```text
parameter
equipment
reference standard
limits
procedure
result schema
certificate
recalibration
```

---

# 34. 测试规范

```text
test type
program
fixture
equipment
input conditions
limits
coverage
sampling
retest rule
failure route
record retention
```

---

# 35. ICT / FCT / Boundary Scan

分别保存：

```text
program version
test point coverage
fixture revision
limit set
result format
```

---

# 36. AOI、SPI 和 X-ray

```text
inspection program
library version
defect classes
sampling/full inspection
review workflow
```

---

# 37. Burn-in 和老化

```text
temperature
duration
load
cycle
sample/full
failure rule
```

---

# 38. 测试覆盖率

按：

```text
requirement
net
function
failure mode
```

输出覆盖率和未覆盖项。

不能因测试脚本存在就默认覆盖充分。

---

# 39. 包装 BOM

结构：

```text
product
accessory
cable
adapter
manual
label
inner bag
foam
inner box
carton
pallet
```

---

# 40. 包装规则

```text
units per inner box
inner boxes per carton
cartons per pallet
weight
dimensions
orientation
ESD
moisture
fragile
battery
country label
customer label
```

---

# 41. 标签

```text
product label
serial label
MAC/IMEI label
carton label
pallet label
compliance mark
country of origin
customer part number
```

标签模板、数据源和版本必须受控。

---

# 42. 工作指导书

可包括：

```text
operation steps
images
tools
materials
warnings
quality points
expected output
```

AI 可根据模板生成草稿，但必须由制造工程师审核。

---

# 43. Quality Control Point

```text
incoming
in-process
first article
final
sampling
hold point
```

保存：

```text
method
criteria
record
owner
failure route
```

---

# 44. 追溯要求

```text
none
work-order
lot
serial
reference-designator
```

每个工序定义 Scan Point。

---

# 45. NPI 阶段

```text
concept
design_release
EVT
DVT
PVT
pilot
mass_production_release
```

---

# 46. NPI Readiness 维度

```text
engineering
BOM
supply
manufacturing
tooling
firmware
test
quality
compliance
packaging
traceability
cost
planning
documentation
```

---

# 47. NPI Gate

示例：

```text
EBOM released
MBOM complete
Routing complete
All identities resolved
Critical components sourced
Alternatives approved
DFM closed
DFT closed
Firmware approved
Test program approved
Fixture ready
Packaging approved
Traceability configured
Pilot issues closed
```

---

# 48. Readiness 状态

```text
not_started
in_progress
blocked
conditional
ready
waived
not_applicable
```

---

# 49. NPI Build

保存：

```text
stage
planned quantity
actual quantity
site
line
MBOM revision
routing revision
firmware version
test version
issues
yield
release decision
```

---

# 50. Pilot 问题

```text
material
process
tooling
firmware
test
quality
packaging
documentation
```

每个问题有 Owner、Due Date、Evidence 和 Closure。

---

# 51. 偏差和 Waiver

支持：

```text
temporary material deviation
process deviation
test deviation
packaging deviation
traceability waiver
```

必须有：

```text
scope
quantity
effectivity
risk
approval
expiry
```

---

# 52. Release Package

发布包包含：

```text
MBOM
BOP/Routing
Work Instructions
Firmware
Test Programs
Tooling
Packaging BOM
Labels
Quality Plan
Traceability Plan
Approved Deviations
Signatures
Hashes
```

---

# 53. 发布状态

```text
draft
review
approved_for_prototype
approved_for_EVT
approved_for_DVT
approved_for_PVT
approved_for_pilot
released_for_mass_production
obsolete
superseded
```

---

# 54. 转换流程

```text
Load Released EBOM
→ Resolve Part Identity
→ Load PCB/Mechanical/Firmware/Test Inputs
→ Select Site/Stage/Variant
→ Apply Transformation Rules
→ Build MBOM Lines
→ Build RefDes and Placement
→ Add Auxiliary Materials
→ Add Loss and Yield
→ Build BOP/Routing
→ Add Programming/Test/Calibration
→ Build Packaging BOM
→ Add Traceability and Quality Points
→ Run Readiness Gates
→ Generate Review Items
→ Approve and Publish Release Package
```

---

# 55. 转换规则

规则来源：

```text
part category
package family
site
line
stage
customer
process
product family
```

示例：

```yaml
rule_id: add-solder-paste-for-smt
when:
  operation: smt
  board_side: top
then:
  add_auxiliary_material: solder-paste-SAC305
  quantity_rule: board-area-profile
```

---

# 56. 规则优先级

```text
customer override
site/line override
product family
process template
global default
```

冲突必须提示，不静默选择。

---

# 57. 自动补充与审核

自动补充项分为：

```text
deterministic
template-recommended
AI-suggested
manual
```

只有 deterministic 且规则完整的项可自动通过。

---

# 58. 完整性校验

```text
all EBOM lines mapped
all MBOM parts identified
all placed refdes covered
no duplicate refdes
DNP excluded
quantity reconciliation
routing operation exists
material assigned to operation
firmware hash present
test limits present
packaging complete
traceability defined
```

---

# 59. 数量对账

```text
EBOM placed quantity
→ MBOM direct material quantity
→ Operation requirement
→ Work-order requirement
```

差异必须有 Mapping 和 Reason。

---

# 60. Change Management

变化源：

```text
EBOM ECO
PCN
supplier change
factory change
firmware change
test change
packaging change
quality issue
```

每次变化执行影响分析。

---

# 61. ECO / ECN

保存：

```text
change reason
before/after
affected EBOM
affected MBOM
affected routing
effectivity
inventory disposition
WIP disposition
customer impact
approval
```

---

# 62. MBOM 差异比较

比较：

```text
line added/removed
quantity changed
part changed
operation changed
loss changed
firmware changed
test changed
packaging changed
effectivity changed
```

---

# 63. NPI 风险

来自：

```text
unresolved part
single source
EOL
compliance gap
long lead
tooling not ready
firmware not approved
test coverage low
packaging missing
traceability gap
```

---

# 64. 标准转换请求

```json
{
  "request_id": "uuid",
  "source": {
    "ebom_id": "uuid",
    "revision": "C"
  },
  "target": {
    "site_id": "suzhou",
    "stage": "pilot",
    "variant": "standard",
    "customer_id": null
  },
  "inputs": {
    "pcb_design_revision": "pcb-rev-c",
    "mechanical_bom_revision": "mech-rev-b",
    "firmware_package_id": "uuid",
    "test_spec_id": "uuid",
    "packaging_profile_id": "uuid"
  },
  "policy_versions": {
    "transformation": "ebom-mbom-1.0.0",
    "routing": "routing-smt-v3",
    "npi_gate": "npi-pilot-v2"
  }
}
```

---

# 65. 标准结果

```json
{
  "job_id": "uuid",
  "status": "review_required",
  "mbom_id": "uuid",
  "mbom_revision": "M1",
  "summary": {
    "ebom_lines": 280,
    "mbom_lines": 315,
    "refdes_count": 1260,
    "auxiliary_material_lines": 18,
    "routing_operations": 22,
    "unmapped_ebom_lines": 0,
    "review_items": 7,
    "readiness_score": 0.91
  },
  "outputs": {
    "mbom_uri": "s3://...",
    "mapping_uri": "s3://...",
    "routing_uri": "s3://...",
    "npi_report_uri": "s3://..."
  }
}
```

---

# 66. 状态机

```text
RECEIVED
→ LOADING_EBOM
→ VALIDATING_IDENTITIES
→ LOADING_DESIGN_INPUTS
→ SELECTING_CONTEXT
→ APPLYING_TRANSFORMATION_RULES
→ BUILDING_MBOM
→ BUILDING_REFDES
→ ADDING_AUXILIARY_MATERIALS
→ APPLYING_LOSS_AND_YIELD
→ BUILDING_ROUTING
→ ADDING_TOOLING
→ ADDING_FIRMWARE
→ ADDING_TEST_AND_CALIBRATION
→ BUILDING_PACKAGING
→ ADDING_TRACEABILITY
→ RUNNING_COMPLETENESS_CHECKS
→ RUNNING_NPI_GATES
→ GENERATING_REVIEW_ITEMS
→ BUILDING_RELEASE_PACKAGE
→ COMPLETED_OR_REVIEW_REQUIRED
```

分支：

```text
COMPLETED
REVIEW_REQUIRED
PARTIALLY_CONVERTED
IDENTITY_INCOMPLETE
DESIGN_INPUT_INCOMPLETE
MAPPING_INCOMPLETE
ROUTING_INCOMPLETE
FIRMWARE_INCOMPLETE
TEST_INCOMPLETE
PACKAGING_INCOMPLETE
NPI_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 67. 错误码

```text
EBOM_NOT_FOUND
EBOM_REVISION_NOT_RELEASED
PART_IDENTITY_UNRESOLVED
DESIGN_FILE_MISSING
PLACEMENT_FILE_MISSING
MECHANICAL_BOM_MISSING
FIRMWARE_PACKAGE_MISSING
TEST_SPEC_MISSING
SITE_PROFILE_MISSING
TRANSFORMATION_RULE_CONFLICT
EBOM_LINE_UNMAPPED
MBOM_LINE_INVALID
REFDES_DUPLICATE
REFDES_UNMAPPED
DNP_CONFLICT
QUANTITY_RECONCILIATION_FAILED
AUXILIARY_MATERIAL_RULE_MISSING
LOSS_PROFILE_MISSING
ROUTING_TEMPLATE_MISSING
OPERATION_MATERIAL_UNASSIGNED
TOOLING_NOT_READY
FIRMWARE_HASH_MISSING
FIRMWARE_NOT_APPROVED
TEST_LIMIT_MISSING
TEST_PROGRAM_NOT_APPROVED
PACKAGING_PROFILE_MISSING
LABEL_TEMPLATE_MISSING
TRACEABILITY_REQUIREMENT_MISSING
EFFECTIVITY_CONFLICT
NPI_GATE_BLOCKED
RELEASE_APPROVAL_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR


---

# 68. 数据库设计

## 68.1 `ebom_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
ebom_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
source_system VARCHAR NOT NULL
source_snapshot_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
released_by UUID NULL
released_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, ebom_number, revision)
```

## 68.2 `ebom_lines`

```text
id UUID PK
ebom_revision_id UUID NOT NULL
line_number VARCHAR NOT NULL
parent_line_id UUID NULL
part_id UUID NULL
ordering_variant_id UUID NULL
internal_part_number VARCHAR NULL
quantity_per NUMERIC NOT NULL
unit VARCHAR NOT NULL
reference_designators JSONB NOT NULL
dnp BOOLEAN NOT NULL
variant_rules JSONB NOT NULL
effectivity JSONB NOT NULL
make_buy_code VARCHAR NULL
line_type VARCHAR NOT NULL
source_evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ebom_revision_id, line_number)
```

## 68.3 `mbom_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
mbom_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
source_ebom_revision_id UUID NOT NULL
site_id UUID NOT NULL
organization_id UUID NULL
line_family VARCHAR NULL
npi_stage VARCHAR NOT NULL
customer_id UUID NULL
variant_scope JSONB NOT NULL
effectivity JSONB NOT NULL
status VARCHAR NOT NULL
routing_revision_id UUID NULL
packaging_bom_revision_id UUID NULL
release_package_id UUID NULL
content_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
released_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, mbom_number, revision)
```

## 68.4 `mbom_lines`

```text
id UUID PK
mbom_revision_id UUID NOT NULL
line_number VARCHAR NOT NULL
parent_line_id UUID NULL
line_type VARCHAR NOT NULL
part_id UUID NULL
ordering_variant_id UUID NULL
internal_part_number VARCHAR NULL
description TEXT NULL
quantity_per NUMERIC NOT NULL
unit VARCHAR NOT NULL
make_buy_code VARCHAR NOT NULL
issue_method VARCHAR NULL
backflush BOOLEAN NOT NULL
operation_id UUID NULL
loss_profile_id UUID NULL
alternate_group_id UUID NULL
customer_supplied BOOLEAN NOT NULL
supplier_consigned BOOLEAN NOT NULL
traceability_level VARCHAR NOT NULL
effectivity JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(mbom_revision_id, line_number)
```

## 68.5 `ebom_mbom_mappings`

```text
id UUID PK
transformation_job_id UUID NOT NULL
source_ebom_revision_id UUID NOT NULL
target_mbom_revision_id UUID NOT NULL
mapping_type VARCHAR NOT NULL
source_line_ids JSONB NOT NULL
target_line_ids JSONB NOT NULL
quantity_rule JSONB NOT NULL
transformation_rule_id VARCHAR NULL
reason_code VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 68.6 `manufacturing_variants`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
variant_code VARCHAR NOT NULL
variant_type VARCHAR NOT NULL
customer_id UUID NULL
region VARCHAR NULL
site_id UUID NULL
firmware_variant VARCHAR NULL
packaging_variant VARCHAR NULL
rules JSONB NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, product_id, variant_code)
```

## 68.7 `bop_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
bop_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
site_id UUID NOT NULL
npi_stage VARCHAR NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
content_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
approved_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, bop_number, revision)
```

## 68.8 `routing_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
routing_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
site_id UUID NOT NULL
line_family VARCHAR NULL
npi_stage VARCHAR NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
content_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
approved_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, routing_number, revision)
```

## 68.9 `routing_operations`

```text
id UUID PK
routing_revision_id UUID NOT NULL
operation_code VARCHAR NOT NULL
sequence_number INT NOT NULL
operation_type VARCHAR NOT NULL
name VARCHAR NOT NULL
work_center_id UUID NULL
equipment_class_id UUID NULL
predecessor_operation_ids JSONB NOT NULL
setup_time_seconds NUMERIC NOT NULL
cycle_time_seconds NUMERIC NOT NULL
labor_time_seconds NUMERIC NOT NULL
queue_time_seconds NUMERIC NOT NULL
move_time_seconds NUMERIC NOT NULL
yield_rate NUMERIC NOT NULL
inspection_required BOOLEAN NOT NULL
hold_point BOOLEAN NOT NULL
work_instruction_revision_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_revision_id, operation_code)
```

## 68.10 `operation_material_requirements`

```text
id UUID PK
routing_operation_id UUID NOT NULL
mbom_line_id UUID NOT NULL
quantity_per_output NUMERIC NOT NULL
unit VARCHAR NOT NULL
quantity_basis VARCHAR NOT NULL
issue_method VARCHAR NOT NULL
backflush BOOLEAN NOT NULL
loss_profile_id UUID NULL
packaging_requirement_id UUID NULL
traceability_level VARCHAR NOT NULL
scan_point VARCHAR NULL
substitution_policy_id UUID NULL
created_at TIMESTAMPTZ
UNIQUE(routing_operation_id, mbom_line_id)
```

## 68.11 `refdes_placements`

```text
id UUID PK
mbom_revision_id UUID NOT NULL
ebom_line_id UUID NULL
mbom_line_id UUID NOT NULL
refdes VARCHAR NOT NULL
board_instance VARCHAR NULL
panel_position VARCHAR NULL
side VARCHAR NOT NULL
x_mm NUMERIC(18,6) NULL
y_mm NUMERIC(18,6) NULL
rotation_deg NUMERIC(9,4) NULL
footprint VARCHAR NULL
operation_id UUID NULL
mount_status VARCHAR NOT NULL
polarity_rule VARCHAR NULL
orientation_rule VARCHAR NULL
source_design_revision VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(mbom_revision_id, board_instance, refdes)
```

## 68.12 `panelization_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
pcb_revision VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
boards_per_panel INT NOT NULL
array_rows INT NULL
array_columns INT NULL
rail_width_mm NUMERIC NULL
panel_loss_rate NUMERIC NOT NULL
depanel_method VARCHAR NULL
fiducial_rules JSONB NOT NULL
tooling_hole_rules JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(product_id, pcb_revision, profile_version)
```

## 68.13 `auxiliary_material_rules`

```text
id UUID PK
tenant_id UUID NULL
rule_id VARCHAR NOT NULL
version VARCHAR NOT NULL
scope JSONB NOT NULL
condition_expression JSONB NOT NULL
material_part_id UUID NOT NULL
quantity_basis VARCHAR NOT NULL
quantity_expression JSONB NOT NULL
operation_type VARCHAR NOT NULL
loss_profile_id UUID NULL
priority INT NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(rule_id, version)
```

## 68.14 `manufacturing_loss_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
profile_name VARCHAR NOT NULL
version VARCHAR NOT NULL
site_id UUID NULL
line_id UUID NULL
npi_stage VARCHAR NULL
part_category_id UUID NULL
package_family VARCHAR NULL
percentage_loss NUMERIC NOT NULL
fixed_setup_loss NUMERIC NOT NULL
feeder_loss NUMERIC NOT NULL
sampling_quantity NUMERIC NOT NULL
rework_allowance NUMERIC NOT NULL
panel_loss NUMERIC NOT NULL
source_type VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, profile_name, version)
```

## 68.15 `packaging_requirements`

```text
id UUID PK
tenant_id UUID NOT NULL
requirement_name VARCHAR NOT NULL
version VARCHAR NOT NULL
part_category_id UUID NULL
package_family VARCHAR NULL
operation_type VARCHAR NULL
allowed_packaging_types JSONB NOT NULL
tape_width_mm NUMERIC NULL
pitch_mm NUMERIC NULL
reel_diameter_mm NUMERIC NULL
leader_length_mm NUMERIC NULL
trailer_length_mm NUMERIC NULL
tray_standard VARCHAR NULL
tube_profile VARCHAR NULL
orientation_rules JSONB NOT NULL
machine_compatibility JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, requirement_name, version)
```

## 68.16 `tooling_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
tooling_type VARCHAR NOT NULL
tooling_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
product_id UUID NULL
site_id UUID NULL
operation_id UUID NULL
asset_id UUID NULL
status VARCHAR NOT NULL
calibration_due_at TIMESTAMPTZ NULL
maintenance_due_at TIMESTAMPTZ NULL
capacity JSONB NOT NULL
document_uri TEXT NULL
content_hash CHAR(64) NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, tooling_number, revision)
```

## 68.17 `firmware_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
package_name VARCHAR NOT NULL
version VARCHAR NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, product_id, package_name, version)
```

## 68.18 `firmware_artifacts`

```text
id UUID PK
firmware_package_id UUID NOT NULL
artifact_type VARCHAR NOT NULL
target_refdes VARCHAR NULL
target_part_id UUID NULL
artifact_uri TEXT NOT NULL
file_name VARCHAR NOT NULL
sha256 CHAR(64) NOT NULL
signature_uri TEXT NULL
program_address VARCHAR NULL
program_parameters JSONB NOT NULL
verification_method VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.19 `programming_requirements`

```text
id UUID PK
routing_operation_id UUID NOT NULL
firmware_package_id UUID NOT NULL
programmer_type VARCHAR NOT NULL
adapter_tooling_revision_id UUID NULL
voltage_profile JSONB NOT NULL
serial_number_required BOOLEAN NOT NULL
key_injection_required BOOLEAN NOT NULL
certificate_injection_required BOOLEAN NOT NULL
verification_required BOOLEAN NOT NULL
result_schema_version VARCHAR NOT NULL
traceability_level VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.20 `test_specifications`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
test_type VARCHAR NOT NULL
spec_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
npi_stage VARCHAR NOT NULL
site_id UUID NULL
status VARCHAR NOT NULL
program_uri TEXT NULL
program_hash CHAR(64) NULL
fixture_revision_id UUID NULL
equipment_requirements JSONB NOT NULL
limits_uri TEXT NOT NULL
coverage JSONB NOT NULL
sampling_plan JSONB NOT NULL
retest_policy JSONB NOT NULL
failure_route JSONB NOT NULL
result_schema_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, spec_number, revision)
```

## 68.21 `calibration_requirements`

```text
id UUID PK
test_specification_id UUID NULL
routing_operation_id UUID NOT NULL
parameter_code VARCHAR NOT NULL
method VARCHAR NOT NULL
reference_standard VARCHAR NULL
lower_limit NUMERIC NULL
upper_limit NUMERIC NULL
unit VARCHAR NULL
equipment_class_id UUID NULL
certificate_required BOOLEAN NOT NULL
result_schema_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.22 `packaging_bom_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
packaging_bom_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
customer_id UUID NULL
region VARCHAR NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
content_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
approved_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, packaging_bom_number, revision)
```

## 68.23 `packaging_bom_lines`

```text
id UUID PK
packaging_bom_revision_id UUID NOT NULL
line_number VARCHAR NOT NULL
parent_line_id UUID NULL
part_id UUID NULL
line_type VARCHAR NOT NULL
quantity_per NUMERIC NOT NULL
unit VARCHAR NOT NULL
quantity_basis VARCHAR NOT NULL
label_template_revision_id UUID NULL
packing_level VARCHAR NOT NULL
effectivity JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(packaging_bom_revision_id, line_number)
```

## 68.24 `label_template_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
template_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
label_type VARCHAR NOT NULL
customer_id UUID NULL
region VARCHAR NULL
template_uri TEXT NOT NULL
data_schema_version VARCHAR NOT NULL
required_fields JSONB NOT NULL
status VARCHAR NOT NULL
content_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, template_number, revision)
```

## 68.25 `work_instruction_revisions`

```text
id UUID PK
tenant_id UUID NOT NULL
instruction_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
operation_type VARCHAR NOT NULL
site_id UUID NULL
product_id UUID NULL
content_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
source_type VARCHAR NOT NULL
ai_drafted BOOLEAN NOT NULL
status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, instruction_number, revision)
```

## 68.26 `quality_control_points`

```text
id UUID PK
routing_operation_id UUID NOT NULL
control_type VARCHAR NOT NULL
method VARCHAR NOT NULL
criteria_uri TEXT NOT NULL
sampling_plan JSONB NOT NULL
record_schema_version VARCHAR NOT NULL
hold_point BOOLEAN NOT NULL
failure_route JSONB NOT NULL
owner_role VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 68.27 `traceability_requirements`

```text
id UUID PK
mbom_revision_id UUID NOT NULL
routing_operation_id UUID NULL
mbom_line_id UUID NULL
traceability_level VARCHAR NOT NULL
scan_input BOOLEAN NOT NULL
scan_output BOOLEAN NOT NULL
record_lot BOOLEAN NOT NULL
record_date_code BOOLEAN NOT NULL
record_serial BOOLEAN NOT NULL
record_refdes BOOLEAN NOT NULL
record_equipment BOOLEAN NOT NULL
record_operator BOOLEAN NOT NULL
retention_policy_id UUID NULL
created_at TIMESTAMPTZ
```

## 68.28 `npi_stage_definitions`

```text
id UUID PK
tenant_id UUID NOT NULL
stage_code VARCHAR NOT NULL
version VARCHAR NOT NULL
sequence_number INT NOT NULL
entry_criteria JSONB NOT NULL
exit_criteria JSONB NOT NULL
allowed_deviation_types JSONB NOT NULL
required_approvals JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, stage_code, version)
```

## 68.29 `npi_checklist_templates`

```text
id UUID PK
tenant_id UUID NOT NULL
template_name VARCHAR NOT NULL
version VARCHAR NOT NULL
stage_code VARCHAR NOT NULL
product_family_id UUID NULL
site_id UUID NULL
items_uri TEXT NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, template_name, version)
```

## 68.30 `npi_readiness_assessments`

```text
id UUID PK
transformation_job_id UUID NOT NULL
mbom_revision_id UUID NOT NULL
stage_code VARCHAR NOT NULL
assessment_version INT NOT NULL
overall_status VARCHAR NOT NULL
overall_score NUMERIC(5,4) NULL
dimension_scores JSONB NOT NULL
blocked_item_count INT NOT NULL
conditional_item_count INT NOT NULL
ready_item_count INT NOT NULL
assessment_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(mbom_revision_id, stage_code, assessment_version)
```

## 68.31 `npi_checklist_results`

```text
id UUID PK
assessment_id UUID NOT NULL
checklist_item_id VARCHAR NOT NULL
dimension VARCHAR NOT NULL
status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
reason_codes JSONB NOT NULL
owner_role VARCHAR NULL
assigned_to UUID NULL
due_at TIMESTAMPTZ NULL
waiver_id UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
UNIQUE(assessment_id, checklist_item_id)
```

## 68.32 `npi_builds`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
stage_code VARCHAR NOT NULL
build_number VARCHAR NOT NULL
site_id UUID NOT NULL
line_id UUID NULL
planned_quantity NUMERIC NOT NULL
actual_quantity NUMERIC NULL
mbom_revision_id UUID NOT NULL
routing_revision_id UUID NOT NULL
firmware_package_id UUID NULL
test_specification_ids JSONB NOT NULL
planned_start_at TIMESTAMPTZ NULL
actual_start_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
yield_summary JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, build_number)
```

## 68.33 `npi_issues`

```text
id UUID PK
npi_build_id UUID NOT NULL
issue_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
affected_objects JSONB NOT NULL
owner_role VARCHAR NOT NULL
assigned_to UUID NULL
due_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
root_cause_reference_id UUID NULL
corrective_action_reference_id UUID NULL
closure_evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
```

## 68.34 `manufacturing_deviations`

```text
id UUID PK
tenant_id UUID NOT NULL
deviation_number VARCHAR NOT NULL
deviation_type VARCHAR NOT NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
risk_assessment JSONB NOT NULL
effectivity JSONB NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
quantity_limit NUMERIC NULL
status VARCHAR NOT NULL
requested_by UUID NOT NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, deviation_number)
```

## 68.35 `manufacturing_release_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
package_number VARCHAR NOT NULL
version VARCHAR NOT NULL
site_id UUID NOT NULL
stage_code VARCHAR NOT NULL
mbom_revision_id UUID NOT NULL
routing_revision_id UUID NOT NULL
packaging_bom_revision_id UUID NULL
firmware_package_id UUID NULL
test_specification_ids JSONB NOT NULL
tooling_revision_ids JSONB NOT NULL
work_instruction_revision_ids JSONB NOT NULL
quality_plan_uri TEXT NOT NULL
traceability_plan_uri TEXT NOT NULL
deviation_ids JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
approved_by JSONB NOT NULL
released_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, package_number, version)
```

## 68.36 `ebom_mbom_transformation_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
source_ebom_revision_id UUID NOT NULL
target_context JSONB NOT NULL
input_versions JSONB NOT NULL
policy_versions JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 68.37 `transformation_rule_executions`

```text
id UUID PK
transformation_job_id UUID NOT NULL
rule_id VARCHAR NOT NULL
rule_version VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
input_snapshot JSONB NOT NULL
output_changes JSONB NOT NULL
execution_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_required BOOLEAN NOT NULL
created_at TIMESTAMPTZ
```

## 68.38 `manufacturing_review_items`

```text
id UUID PK
transformation_job_id UUID NOT NULL
mbom_revision_id UUID NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
affected_objects JSONB NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
assigned_to UUID NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 68.39 `manufacturing_release_approvals`

```text
id UUID PK
release_package_id UUID NOT NULL
approval_type VARCHAR NOT NULL
approval_level VARCHAR NOT NULL
status VARCHAR NOT NULL
conditions JSONB NOT NULL
assigned_to UUID NULL
requested_at TIMESTAMPTZ NOT NULL
decided_by UUID NULL
decided_at TIMESTAMPTZ NULL
decision_note TEXT NULL
```

---

# 69. 对象存储

```text
derived/ebom-mbom-npi/
  {tenant_id}/{product_id}/
    transformation/
      {job_id}/
        input/
          ebom.json.zst
          pcb-design.json.zst
          placement.json.zst
          mechanical-bom.json.zst
          firmware-manifest.json
          test-specs.json.zst
          site-profile.json
          transformation-rules.json
        mapping/
          ebom-mbom-mapping.json.zst
          unmapped-lines.json
          mapping-trace.json.zst
        mbom/
          mbom.json.zst
          mbom-lines.json.zst
          refdes.json.zst
          auxiliary-materials.json
          loss-calculation.json
        routing/
          bop.json
          routing.json
          operations.json.zst
          operation-materials.json.zst
          tooling.json
        programming/
          firmware-manifest.json
          programming-requirements.json
        test/
          test-specifications.json
          calibration.json
          coverage.json
        packaging/
          packaging-bom.json
          label-templates.json
        traceability/
          traceability-plan.json
          scan-points.json
        npi/
          readiness.json
          checklist.json
          blockers.json
          risks.json
        release/
          manifest.json
          hashes.json
          approval-package.json
        reports/
          conversion-summary.json
          difference-report.json
          completeness-report.json
          readiness-report.html
          readiness-report.pdf
        debug/
          rule-execution.json.zst
          quantity-reconciliation.json.zst
          validation-trace.json.zst
```

---

# 70. API 设计

## 70.1 转换任务

```text
POST /api/v1/ebom-mbom/transformations
POST /api/v1/ebom-mbom/transformations/batch
GET  /api/v1/ebom-mbom/transformations/{id}
GET  /api/v1/ebom-mbom/transformations/{id}/events
POST /api/v1/ebom-mbom/transformations/{id}/rerun
POST /api/v1/ebom-mbom/transformations/{id}/cancel
```

## 70.2 EBOM / MBOM

```text
GET /api/v1/eboms/{id}/revisions/{revision}
GET /api/v1/mboms/{id}/revisions/{revision}
GET /api/v1/mboms/{id}/revisions/{revision}/lines
GET /api/v1/mboms/{id}/revisions/{revision}/refdes
GET /api/v1/mboms/{id}/revisions/{revision}/mapping
GET /api/v1/mboms/{id}/revisions/{revision}/differences
```

## 70.3 Routing / BOP

```text
GET /api/v1/routings/{id}/revisions/{revision}
GET /api/v1/routings/{id}/revisions/{revision}/operations
GET /api/v1/routings/{id}/revisions/{revision}/materials
POST /api/v1/routings/{id}/validate
```

## 70.4 Firmware / Test / Packaging

```text
GET /api/v1/manufacturing/firmware-packages/{id}
GET /api/v1/manufacturing/test-specifications/{id}
GET /api/v1/manufacturing/packaging-boms/{id}
GET /api/v1/manufacturing/label-templates/{id}
```

## 70.5 NPI

```text
POST /api/v1/npi/assessments
GET  /api/v1/npi/assessments/{id}
GET  /api/v1/npi/assessments/{id}/checklist
GET  /api/v1/npi/assessments/{id}/blockers
POST /api/v1/npi/assessments/{id}/reassess
POST /api/v1/npi/checklist-items/{id}/resolve
POST /api/v1/npi/builds
GET  /api/v1/npi/builds/{id}
GET  /api/v1/npi/builds/{id}/issues
```

## 70.6 Review 和 Release

```text
GET  /api/v1/manufacturing/reviews
GET  /api/v1/manufacturing/reviews/{id}
POST /api/v1/manufacturing/reviews/{id}/resolve
POST /api/v1/manufacturing/release-packages
GET  /api/v1/manufacturing/release-packages/{id}
POST /api/v1/manufacturing/release-packages/{id}/submit
POST /api/v1/manufacturing/release-packages/{id}/approve
POST /api/v1/manufacturing/release-packages/{id}/release
POST /api/v1/manufacturing/release-packages/{id}/supersede
```

`release` 必须验证全部签署和 Gate。

## 70.7 偏差

```text
POST /api/v1/manufacturing/deviations
GET  /api/v1/manufacturing/deviations/{id}
POST /api/v1/manufacturing/deviations/{id}/approve
POST /api/v1/manufacturing/deviations/{id}/expire
```

## 70.8 健康检查

```text
GET /health/live
GET /health/ready
GET /metrics
```

---

# 71. 输入事件

```text
ebom.released
ebom.revised
design.pcb-revision.released
design.mechanical-bom.released
firmware.package.approved
test.specification.approved
tooling.revision.approved
packaging.profile.updated
label.template.approved
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
component.market-data.ready
bom.risk.ready
inventory.reuse-plan.ready
npi.build.completed
npi.issue.closed
quality.issue.created
engineering.change.approved
```

---

# 72. 输出事件

```text
mbom.draft.ready
mbom.review.required
mbom.revision.approved
routing.draft.ready
routing.revision.approved
npi.readiness.updated
npi.blocker.detected
npi.build-package.ready
manufacturing.release-package.ready
manufacturing.release-package.released
manufacturing.change-impact.ready
```

## `manufacturing.release-package.released`

```json
{
  "event_type": "manufacturing.release-package.released",
  "event_version": "1.0",
  "release_package_id": "uuid",
  "product_id": "uuid",
  "site_id": "uuid",
  "stage": "mass_production",
  "versions": {
    "ebom": "C",
    "mbom": "M5",
    "routing": "R4",
    "firmware": "1.4.2",
    "test": "T7",
    "packaging": "P3"
  },
  "manifest_hash": "sha256",
  "released_at": "ISO-8601"
}
```

---

# 73. 规则和模板

```text
policies/
├── ebom-mbom-transformation-1.0.0.yaml
├── mapping-rules.yaml
├── make-buy-rules.yaml
├── phantom-kit-rules.yaml
├── auxiliary-materials/
│   ├── smt.yaml
│   ├── tht.yaml
│   ├── assembly.yaml
│   ├── coating.yaml
│   └── packaging.yaml
├── loss-profiles/
├── routing-templates/
│   ├── pcb-assembly.yaml
│   ├── module-assembly.yaml
│   ├── final-assembly.yaml
│   └── service-build.yaml
├── firmware-rules.yaml
├── test-rules.yaml
├── packaging-rules.yaml
├── traceability-rules.yaml
├── npi-gates/
│   ├── EVT.yaml
│   ├── DVT.yaml
│   ├── PVT.yaml
│   ├── pilot.yaml
│   └── mass-production.yaml
├── release-approvals.yaml
└── enterprise/
    └── tenant-specific/
```

---

# 74. 规则引擎

要求：

- JSON/YAML Schema；
- 规则版本；
- 优先级；
- 生效时间；
- Scope；
- 冲突检测；
- Dry Run；
- Explain Trace；
- Rollback；
- 禁止任意代码执行。

---

# 75. 转换模式

## 75.1 Full Conversion

生成新的 MBOM 和 Routing 草稿。

## 75.2 Incremental Conversion

只处理 EBOM、Firmware、Test 或 Packaging 的变化。

## 75.3 Site Localization

从已批准 MBOM 派生另一工厂版本。

## 75.4 Stage Promotion

从 EVT/PVT/Pilot 推进到下一阶段。

## 75.5 What-if

模拟不同工厂、路线、替代料和包装，不发布。

---

# 76. 映射优先级

```text
已批准人工 Mapping
→ 产品专用规则
→ 工厂规则
→ 产品族模板
→ 通用确定性规则
→ 模板建议
→ 人工审核
```

AI 建议永远不能覆盖已批准 Mapping。

---

# 77. AI 使用边界

可选 AI 能力：

```text
总结设计备注
从历史模板推荐疑似遗漏辅料
生成工作指导书初稿
归类 NPI Issue
总结差异和风险
```

禁止：

```text
生成未经证实的位号
自动确定辅料数量
自动生成测试限值
自动批准替代
自动签署发布
```

每项 AI 输出标记：

```text
ai_drafted = true
review_required = true
```

---

# 78. 完整性 Gate

## Hard Gate

```text
EBOM released
all required identities resolved
all placed refdes mapped
quantity reconciliation pass
routing complete
firmware artifact hash present
test limit set approved
packaging complete
traceability requirement defined
effectivity conflict absent
required approvals complete
```

## Soft Gate

```text
second source incomplete
work instruction draft
yield based on estimate
tooling delivery pending outside build date
```

---

# 79. NPI Readiness 评分

评分只做摘要，不能覆盖 Hard Gate。

分维度：

```text
engineering
supply
manufacturing
tooling
firmware
test
quality
compliance
packaging
traceability
cost
planning
```

总分低于阈值可阻断；任何 Hard Gate 失败直接阻断。

---

# 80. NPI 阶段退出标准

## EVT

```text
基本设计可制造
关键功能可验证
临时工艺允许
问题可追踪
```

## DVT

```text
设计和测试覆盖基本稳定
关键物料批准
主要 DFM/DFT 关闭
```

## PVT

```text
量产工艺、治具、测试、追溯和包装验证
产线良率接近目标
```

## Pilot

```text
正式物料和流程
小批量重复性验证
供应链和质量闭环
```

## Mass Production

```text
全部 Hard Gate
批准 Release Package
无过期关键偏差
```

---

# 81. Agent 38 集成

Agent 43输出：

```text
operation packaging requirement
minimum feeder load
leader/trailer
tray/tube requirement
production loss
need-by operation
```

Agent 38返回：

```text
purchase packaging
legal quantity
supplier allocation
```

二者差异需校验。

---

# 82. Agent 39 集成

输出：

```text
direct/auxiliary materials
routing times
machine requirements
yield
tooling
programming
test
packaging
NRE
```

用于成本核算。

---

# 83. Agent 40 集成

输出：

```text
work-order material requirement
operation need date
loss
make/buy
subcontract
routing
effectivity
```

Agent 40生成计划和齐套。

---

# 84. Agent 42 集成

Agent 43提供计划追溯：

```text
required scan points
lot/date-code capture
serial generation
refdes-level trace
firmware/test result record
```

Agent 42记录实际事件。

---

# 85. 旧数据迁移

需要识别：

```text
只有一张 BOM
BOM 中夹杂工艺备注
辅料写在 Excel 备注
Firmware 只保存文件名
Test Limit 写在 PDF
包装没有结构化 BOM
MBOM 和 Routing 没有版本
```

迁移原则：

- 原始文档不可变；
- 建立 Legacy Snapshot；
- 识别字段来源；
- Unknown 不猜；
- 逐产品审核；
- 先迁移在产和即将 NPI 产品；
- 历史产品允许较低完整度但必须标记。

---

# 86. 可观测性

Metrics：

```text
ebom_mbom_jobs_total{status,mode}
ebom_mbom_duration_seconds{step}
ebom_mbom_mapping_total{type,status}
ebom_mbom_unmapped_lines_total
ebom_mbom_refdes_total{status}
ebom_mbom_auxiliary_lines_total{source}
ebom_mbom_quantity_reconciliation_failures_total
ebom_mbom_rule_conflicts_total{rule}
ebom_mbom_review_items_total{type,severity}
npi_readiness_score{dimension,stage}
npi_blockers_total{dimension,stage}
manufacturing_release_packages_total{status,stage}
manufacturing_deviations_total{type,status}
firmware_artifact_hash_missing_total
test_spec_incomplete_total{type}
packaging_bom_incomplete_total
```

---

# 87. Dashboard

```text
EBOM-to-MBOM Mapping Coverage
Unmapped Lines
RefDes Coverage
Auxiliary Material Coverage
Routing Completeness
Firmware/Test/Packaging Readiness
NPI Gate Status
Open Blockers
Pilot Issues
Deviation Expiry
Release Package Versions
Site Localization Differences
```

---

# 88. Benchmark

## Mapping

```text
EBOM line mapping accuracy
1:N/N:1 mapping accuracy
DNP/variant/effectivity accuracy
make-buy/phantom accuracy
```

## PCB/RefDes

```text
placement import accuracy
refdes uniqueness
side/rotation/footprint
placed quantity reconciliation
```

## Materials

```text
auxiliary material rule precision/recall
loss profile application
duplicate loss prevention
operation material assignment
```

## Routing

```text
operation sequence validity
work center compatibility
time calculation
yield propagation
```

## Firmware/Test/Packaging

```text
artifact hash validation
test limit completeness
fixture version matching
packaging BOM completeness
label template field validation
```

## NPI

```text
hard gate recall
blocker precision
stage promotion correctness
release package immutability
```

## Integration

```text
Agent 38 packaging consistency
Agent 39 cost input completeness
Agent 40 work-order requirement accuracy
Agent 42 traceability contract completeness
```

---

# 89. 初始质量目标

```text
EBOM Line Mapping Coverage >= 99.9%
Placed RefDes Mapping Accuracy = 100%
DNP Exclusion Accuracy = 100%
Quantity Reconciliation Accuracy = 100%
Unapproved Alternative Release Rate = 0%
Auxiliary Material Deterministic Rule Accuracy >= 99%
Duplicate Loss Application Rate = 0%
Routing Graph Validity = 100%
Firmware Hash Presence = 100%
Approved Test Limit Presence = 100%
Packaging BOM Completeness >= 99.5%
Hard NPI Gate False-negative Rate <= 0.1%
Release Package Hash Consistency = 100%
Historical Release Immutability = 100%
Tenant/Site/Customer Isolation = 100%
```

这些是目标，不是未经测试的保证。

---

# 90. 测试集

公开仓库仅使用合成、脱敏或授权 Fixture。

## EBOM/Mapping

1. One-to-one；
2. One-to-many；
3. Many-to-one；
4. Many-to-many；
5. Phantom；
6. Kit；
7. Purchased Module；
8. Subcontract；
9. Customer Supplied；
10. DNP；
11. Variant；
12. Effectivity；
13. Unresolved Part；
14. Approved Alternative；
15. Unapproved Alternative。

## PCB/RefDes

16. Top Placement；
17. Bottom Placement；
18. Duplicate RefDes；
19. Missing RefDes；
20. Rotation；
21. Polarity；
22. Panelization；
23. Board Position；
24. DNP Placement；
25. Footprint Conflict。

## Auxiliary/Loss

26. Solder Paste；
27. Flux；
28. Adhesive；
29. Conformal Coat；
30. Thermal Material；
31. Label；
32. Per Unit；
33. Per Panel；
34. Per Area；
35. Fixed Setup；
36. Percentage Loss；
37. Feeder Loss；
38. Sampling；
39. Rework；
40. Duplicate Loss Detection。

## Routing

41. Sequential；
42. Parallel；
43. Merge；
44. Top/Bottom SMT；
45. THT；
46. Manual Assembly；
47. Programming；
48. ICT；
49. FCT；
50. Burn-in；
51. Packaging；
52. Missing Work Center；
53. Cycle Detected；
54. Yield；
55. Operation Material Missing。

## Firmware/Test

56. Firmware Hash；
57. Missing Hash；
58. Signed Artifact；
59. Wrong Target；
60. Serial Assignment；
61. Key Injection；
62. ICT Limits；
63. FCT Limits；
64. Fixture Revision；
65. Test Program Not Approved；
66. Calibration；
67. Retest；
68. Sampling；
69. Coverage Gap；
70. Result Schema。

## Packaging/NPI

71. Packaging BOM；
72. Customer Label；
73. ESD；
74. MSL；
75. Accessories；
76. EVT；
77. DVT；
78. PVT；
79. Pilot；
80. Mass Production；
81. Blocker；
82. Conditional；
83. Waiver；
84. Expired Deviation；
85. Release Package。

## Change/System

86. EBOM ECO；
87. Firmware Change；
88. Test Change；
89. Packaging Change；
90. Site Localization；
91. Incremental Conversion；
92. What-if；
93. Idempotency；
94. Historical Immutability；
95. Tenant Isolation；
96. Permission Denied；
97. Rule Conflict；
98. Replay；
99. 1M MBOM Lines；
100. Release Audit。

---

# 91. 性能要求

常规产品：

```text
EBOM 1,000 lines
RefDes 10,000
```

目标：

```text
Cached Full Conversion P95 < 60 s
Incremental Conversion P95 < 10 s
MBOM/RefDes Detail Query P95 < 500 ms
Readiness Assessment P95 < 5 s
```

大型产品：

```text
100,000 EBOM/MBOM lines
1,000,000 RefDes
```

需要：

- 分块；
- 流式 Placement 解析；
- RefDes 索引；
- 规则批量执行；
- 增量 Hash；
- 对象存储；
- 可取消任务；
- 并行验证；
- 批量写入。

---

# 92. 安全与权限

- EBOM、MBOM、Routing、Firmware、Test 和 Release Package 分权；
- 固件 Artifact、密钥和证书使用专用 Secret/Artifact 管理；
- Agent 不读取明文生产密钥；
- Release 需要 Engineering、Manufacturing、Quality 和必要的 Customer Approval；
- 客户定制 MBOM 不能暴露给其他客户；
- 工厂专用工艺和费率按权限隔离；
- AI 草稿不能进入发布包，除非已审核转为 Approved Revision；
- 文件导入防宏和恶意内容；
- HTML/PDF 模板转义；
- 所有 Release Package 保存 Hash；
- 历史发布版本不可删除；
- 不将私有设计、固件、测试限值和制造数据发送给外部通用模型；
- V1 规则和算法本地执行；
- 公开测试只使用合成或授权数据；
- 所有发布、偏差和 Effectivity 变化写审计日志。

---

# 93. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
```

批量处理：

```text
Polars
PyArrow
DuckDB
```

规则：

```text
Versioned JSON/YAML Rule Engine
JSON Schema
Restricted Expression DSL
```

工作流：

```text
Temporal / Celery / RQ
```

设计文件解析 Adapter：

```text
KiCad parser
Altium export parser
IPC-2581 / ODB++ adapter
```

文档：

```text
HTML Template
Playwright / WeasyPrint
```

V1 不依赖 LLM；可选 LLM 仅用于草稿文本。

---

# 94. 推荐仓库结构

```text
ebom-mbom-npi-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── ebom-mbom-npi-agent-spec.md
│   ├── ebom-mbom-domain-model.md
│   ├── transformation-mapping-model.md
│   ├── pcb-refdes-placement.md
│   ├── auxiliary-material-and-loss.md
│   ├── bop-routing-model.md
│   ├── firmware-programming-model.md
│   ├── test-calibration-model.md
│   ├── packaging-bom-model.md
│   ├── traceability-plan.md
│   ├── npi-readiness-gates.md
│   ├── manufacturing-release-package.md
│   ├── change-effectivity.md
│   ├── integration-agent38-42.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-ebom-and-mbom-versioned-separately.md
│       ├── 0002-ebom-mbom-mapping-is-first-class.md
│       ├── 0003-auxiliary-materials-are-structured.md
│       ├── 0004-firmware-and-test-are-manufacturing-configurations.md
│       ├── 0005-expected-plan-and-actual-genealogy-separated.md
│       └── 0006-release-packages-are-immutable.md
├── src/
│   └── ebom_mbom_npi/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── ebom.py
│       │   ├── mbom.py
│       │   ├── mapping.py
│       │   ├── routing.py
│       │   ├── operation.py
│       │   ├── refdes.py
│       │   ├── firmware.py
│       │   ├── test.py
│       │   ├── packaging.py
│       │   ├── npi.py
│       │   └── release.py
│       ├── adapters/
│       │   ├── agent31_bom.py
│       │   ├── agent32_identity.py
│       │   ├── agent33_alternatives.py
│       │   ├── agent34_lifecycle.py
│       │   ├── agent35_compliance.py
│       │   ├── agent36_market.py
│       │   ├── agent37_risk.py
│       │   ├── agent38_packaging.py
│       │   ├── agent39_cost.py
│       │   ├── agent40_planning.py
│       │   ├── agent41_inventory.py
│       │   ├── agent42_traceability.py
│       │   ├── kicad.py
│       │   ├── altium.py
│       │   ├── ipc2581.py
│       │   ├── odbpp.py
│       │   └── mechanical.py
│       ├── transformation/
│       │   ├── service.py
│       │   ├── context.py
│       │   ├── mapping.py
│       │   ├── one_to_one.py
│       │   ├── one_to_many.py
│       │   ├── many_to_one.py
│       │   ├── phantom.py
│       │   ├── kit.py
│       │   ├── make_buy.py
│       │   ├── rules.py
│       │   └── trace.py
│       ├── pcb/
│       │   ├── placement.py
│       │   ├── refdes.py
│       │   ├── panelization.py
│       │   ├── polarity.py
│       │   └── reconciliation.py
│       ├── materials/
│       │   ├── direct.py
│       │   ├── auxiliary.py
│       │   ├── consumables.py
│       │   ├── loss.py
│       │   ├── alternatives.py
│       │   └── packaging_requirements.py
│       ├── routing/
│       │   ├── builder.py
│       │   ├── templates.py
│       │   ├── graph.py
│       │   ├── work_centers.py
│       │   ├── operation_materials.py
│       │   ├── times.py
│       │   └── yield_model.py
│       ├── tooling/
│       ├── firmware/
│       │   ├── manifests.py
│       │   ├── artifacts.py
│       │   ├── hashes.py
│       │   ├── programming.py
│       │   └── provisioning.py
│       ├── testing/
│       │   ├── specifications.py
│       │   ├── limits.py
│       │   ├── coverage.py
│       │   ├── fixtures.py
│       │   ├── calibration.py
│       │   └── failure_routes.py
│       ├── packaging/
│       │   ├── bom.py
│       │   ├── labels.py
│       │   ├── hierarchy.py
│       │   ├── esd_msl.py
│       │   └── validation.py
│       ├── traceability/
│       │   ├── requirements.py
│       │   ├── scan_points.py
│       │   └── contract.py
│       ├── npi/
│       │   ├── stages.py
│       │   ├── checklist.py
│       │   ├── readiness.py
│       │   ├── gates.py
│       │   ├── builds.py
│       │   ├── issues.py
│       │   └── promotion.py
│       ├── changes/
│       │   ├── eco.py
│       │   ├── differences.py
│       │   ├── impact.py
│       │   ├── effectivity.py
│       │   └── deviations.py
│       ├── release/
│       │   ├── package.py
│       │   ├── manifest.py
│       │   ├── approvals.py
│       │   ├── hashes.py
│       │   └── publishing.py
│       ├── reviews/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── routing-templates/
├── npi-checklists/
├── work-instruction-templates/
├── report-templates/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_transformation_rules.py
    ├── compare_ebom_mbom.py
    ├── reconcile_refdes.py
    ├── validate_routing_graph.py
    ├── validate_release_package.py
    ├── replay_transformation.py
    ├── run_npi_assessment.py
    └── run_ebom_mbom_benchmark.py
```


---

# 95. Codex 分阶段实施

不要让 Codex 一次实现全部设计文件解析、EBOM/MBOM 转换、Routing、Firmware、Test、Packaging 和 NPI 发布。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–42 的真实完成程度和接口；
2. 当前 EBOM、MBOM、BOP、Routing 和 Work Instruction；
3. 当前 Product、Variant、Customer Variant、Site Variant 和 Packaging Variant；
4. 当前 BOM Revision、Effectivity、DNP、Phantom、Kit 和 Make/Buy；
5. 当前 KiCad、Altium、CPL、Pick-and-Place、Gerber、ODB++ 或 IPC-2581 数据；
6. 当前 RefDes、Footprint、Side、X/Y、Rotation、Panel 和 Board Position；
7. 当前辅料、Consumable、损耗、Setup、Feeder、抽检和返工；
8. 当前 SMT、THT、Assembly、Programming、Test、Calibration、Burn-in 和 Packaging；
9. 当前工时、设备、Work Center、产线和工厂差异；
10. 当前 Stencil、Fixture、Jig、Programmer、ICT/FCT Fixture；
11. 当前 Firmware、Bootloader、FPGA Bitstream、Hash、Signature 和 Key Injection；
12. 当前 Test Program、Limit、Coverage、Sampling、Result Schema 和 Failure Route；
13. 当前 Packaging BOM、Accessory、Label、ESD、MSL、Carton 和 Pallet；
14. 当前 NPI Stage、Checklist、Build、Issue、Yield 和 Release；
15. 当前 ECO/ECN、Deviation、Waiver、Effectivity 和历史发布版本；
16. 当前 ERP、MES、WMS、QMS、PLM 接口；
17. 当前 Agent 38、39、40 和 42 所需的制造数据契约；
18. 当前权限、审批、签署、审计、对象存储和事件；
19. 统计未映射 EBOM Line、缺失 RefDes、非结构化辅料和自由文本工艺备注；
20. 抽样分析合成或脱敏产品；
21. 不修改业务代码；
22. 不创建 Migration；
23. 不安装依赖；
24. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- EBOM Revision/Line；
- MBOM Revision/Line；
- Mapping；
- Variant；
- Effectivity；
- BOP/Routing/Operation；
- RefDes；
- Auxiliary Material；
- Loss；
- Tooling；
- Firmware；
- Test；
- Packaging；
- Traceability；
- NPI；
- Release；
- JSON Schema。

## Phase 2：Input Snapshot 和 Adapter Contract

实现：

- Agent 31–42 Adapter；
- EDA/Mechanical Adapter；
- Firmware/Test/Packaging Adapter；
- Site Profile；
- Input Snapshot；
- Version Compatibility；
- Freshness；
- Hash；
- Idempotency。

## Phase 3：EBOM Normalization 和 Context

实现：

- Released EBOM Gate；
- Variant；
- DNP；
- Effectivity；
- Make/Buy；
- Phantom；
- Kit；
- Site/Stage/Customer Context；
- Validation。

## Phase 4：PCB、Placement 和 RefDes

实现：

- KiCad/CPL Import；
- RefDes；
- Side；
- X/Y；
- Rotation；
- Footprint；
- Polarity；
- Panel；
- Board Position；
- DNP；
- Reconciliation。

## Phase 5：EBOM-to-MBOM Mapping

实现：

- 1:1；
- 1:N；
- N:1；
- N:M；
- Phantom Collapse；
- Kit；
- Purchased Module；
- Subcontract；
- Mapping Trace；
- Review。

## Phase 6：Direct Material 和 Alternatives

实现：

- MBOM Lines；
- Operation Assignment；
- Approved Alternate Group；
- Customer/Site Scope；
- Unapproved Block；
- Make/Buy；
- Traceability Level。

## Phase 7：Auxiliary Material 和 Consumables

实现：

- Solder Paste；
- Flux；
- Adhesive；
- Coating；
- Thermal Materials；
- Labels；
- Packaging Consumables；
- Quantity Basis；
- Rule Engine；
- Review。

## Phase 8：Loss、Yield 和 Quantity Reconciliation

实现：

- Material Loss；
- Setup；
- Feeder；
- Panel；
- Sampling；
- Rework；
- Yield；
- Duplicate-loss Detection；
- EBOM/MBOM/Operation Reconciliation。

## Phase 9：BOP 和 Routing

实现：

- Routing Template；
- Operation Graph；
- Sequence/Parallel/Merge；
- Work Center；
- Equipment；
- Times；
- Yield；
- Hold Point；
- Operation Materials；
- Cycle Detection。

## Phase 10：Tooling 和 Work Instructions

实现：

- Stencil；
- Fixture；
- Jig；
- Programmer；
- Revision；
- Calibration/Maintenance；
- Work Instruction；
- Controlled AI Draft；
- Approval。

## Phase 11：Firmware 和 Programming

实现：

- Package Manifest；
- Artifact Hash；
- Signature；
- Target；
- Programming Parameters；
- Serial；
- MAC/IMEI；
- Key/Certificate Injection；
- Verification；
- Security Boundary。

## Phase 12：Test 和 Calibration

实现：

- ICT/FCT/Boundary Scan；
- AOI/SPI/X-ray；
- Test Program；
- Limits；
- Fixture；
- Coverage；
- Sampling；
- Retest；
- Failure Route；
- Calibration。

## Phase 13：Packaging BOM 和 Labels

实现：

- Accessory；
- Manual；
- Inner Bag/Box；
- Carton/Pallet；
- ESD/MSL；
- Quantity Hierarchy；
- Label Template；
- COO/Compliance；
- Customer/Region Variant。

## Phase 14：Traceability Plan

实现：

- Lot/Serial/RefDes Level；
- Scan Points；
- Date Code；
- Equipment/Operator；
- Firmware/Test Result；
- Agent 42 Contract；
- Validation。

## Phase 15：NPI Stage 和 Checklist

实现：

- EVT/DVT/PVT/Pilot/MP；
- Template；
- Dimension；
- Hard/Soft Gate；
- Evidence；
- Owner；
- Due Date；
- Waiver；
- Readiness。

## Phase 16：NPI Build 和 Issue Closure

实现：

- Build Package；
- Planned/Actual Quantity；
- MBOM/Routing/Firmware/Test Version；
- Yield；
- Issue；
- Closure；
- Promotion Criteria；
- No Auto Promotion。

## Phase 17：Change、Effectivity 和 Site Localization

实现：

- EBOM ECO；
- MBOM Change；
- Firmware/Test/Packaging Change；
- Difference；
- Impact；
- Effectivity；
- Inventory/WIP Disposition Hook；
- Site Derivation。

## Phase 18：Release Package 和 Approval

实现：

- Immutable Manifest；
- Hashes；
- MBOM/Routing/Firmware/Test/Packaging/Traceability；
- Deviation；
- Multi-role Approval；
- Release；
- Supersede；
- Audit。

## Phase 19：Agent 38–42 Integration

实现：

- Packaging Requirement；
- Cost Input；
- Planning Requirement；
- Inventory Eligibility；
- Traceability Contract；
- Event Contracts；
- Version Compatibility；
- End-to-end Fixture。

## Phase 20：API、Events、Batch 和 Incremental

实现：

- API；
- Jobs；
- Progress；
- Batch；
- Full/Incremental；
- What-if；
- Cache；
- Cancel/Resume；
- Object Storage；
- Permissions。

## Phase 21：Benchmark、监控和生产发布

实现：

- Golden Mapping；
- RefDes Reconciliation；
- Routing Graph Tests；
- Firmware/Test Validation；
- NPI Gate Tests；
- Load Test；
- Metrics；
- Dashboard；
- Feature Flag；
- Policy Rollback；
- Disaster Recovery。

## Phase 22：历史经验校准，可选

稳定后：

- 根据真实工单损耗调整 Profile 建议；
- 根据 Pilot Issue 推荐 Checklist；
- 根据历史产品推荐辅料模板；
- 仅 Shadow Mode；
- 不绕过 Hard Gate；
- 不自动修改正式规则。

---

# 96. Codex 工作纪律

Codex 必须：

1. EBOM、MBOM、BOP 和 Routing 分开；
2. EBOM Revision 不可被转换覆盖；
3. MBOM 必须绑定 Site、Stage、Variant 和 Effectivity；
4. EBOM-MBOM Mapping 是一等对象；
5. 1:1、1:N、N:1 和 N:M 分开；
6. Expected Structure 与 Agent 42 Actual Genealogy 分开；
7. Part、Ordering Variant、IPN 和 Supplier SKU 分开；
8. DNP 和 Variant 必须参与；
9. 所有 Placed RefDes 必须对账；
10. Duplicate RefDes 必须阻断；
11. Position、Side、Rotation 和 Footprint 保留来源；
12. Auxiliary Material 必须结构化；
13. “适量”不能作为正式数量；
14. Quantity Basis 和 Unit 必须明确；
15. Loss 不得重复叠加；
16. Setup/Feeder/Panel/Sampling/Rework 分开；
17. Operation Material Requirement 必须绑定工序；
18. Routing 图必须无非法循环；
19. 工时和 Yield 必须有 Profile/来源；
20. Tooling Revision、Calibration 和状态必须检查；
21. Firmware 使用 Hash，不只用文件名；
22. Key/Certificate 不以明文进入普通数据库；
23. Test Program、Limits、Fixture 和 Result Schema 分开；
24. 测试脚本存在不等于测试已批准；
25. Packaging BOM 是制造结构的一部分；
26. Label Template 和数据源必须版本化；
27. Agent 33 未批准替代不能发布；
28. Agent 34 EOL/PCN 触发影响分析；
29. Agent 35 不合规物料或标签不能发布；
30. Agent 38 的采购包装必须满足生产包装要求；
31. Agent 39 所需成本输入必须完整或标记 Estimate；
32. Agent 40 使用指定 MBOM/Routing Revision；
33. Agent 41 复用库存必须满足 MBOM Scope；
34. Agent 42 Trace Contract 必须明确；
35. NPI Score 不能覆盖 Hard Gate；
36. Checklist 填写完成不等于 Release；
37. Waiver 必须有 Scope、Effectivity、数量和到期；
38. Release Package 不可变；
39. 修改后生成新 Revision/Package；
40. AI Draft 必须标记并审核；
41. AI 不生成位号、数量、测试限值和发布决定；
42. 所有规则版本化、可解释、可回滚；
43. 发布需要多角色审批；
44. 旧数据 Unknown 不得猜测；
45. 不将设计、固件、测试和制造数据发送给外部通用模型；
46. 公开测试仅使用合成或授权数据；
47. 不伪造 Mapping、工时、良率、Readiness、测试和 Benchmark；
48. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter/Rule/Template 变化；
    - 测试命令；
    - 真实结果；
    - Mapping/RefDes/Quantity Accuracy；
    - NPI Gate 结果；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 97. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/ebom-mbom-npi-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第43个 Agent：

EBOM-to-MBOM & NPI Transformation Agent /
EBOM、MBOM 与 NPI 转换 Agent。

本 Agent 将研发阶段的：

- EBOM、BOM Revision、Variant、DNP 和 Effectivity；
- KiCad/Altium/IPC-2581/ODB++/CPL Placement；
- 机械 BOM、线束、外壳和附件；
- Firmware、Bootloader、FPGA Bitstream、配置和 Hash；
- ICT/FCT/AOI/SPI/X-ray/Calibration/Test Program；
- Packaging、Label、ESD、MSL 和客户要求；

转换为特定 Site、Stage、Variant 和 Customer Context 下的：

- MBOM；
- EBOM-MBOM Mapping；
- RefDes Placement；
- Auxiliary Material；
- Loss/Yield；
- BOP/Routing；
- Operation Material Requirement；
- Tooling；
- Programming；
- Test/Calibration；
- Packaging BOM；
- Work Instruction；
- Quality Control Point；
- Traceability Plan；
- NPI Readiness；
- Manufacturing Release Package。

本 Agent只生成草稿、校验、审批和发布包，不自动修改 EBOM、不自动创建工单、不自动替换物料、不自动量产发布。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–42 的规格和实际代码；
3. docs/ebom-mbom-npi-agent-spec.md；
4. 当前 EBOM、MBOM、BOP、Routing、Work Instruction；
5. 当前 Product/Variant/Customer/Site/Stage；
6. 当前 Revision、Effectivity、DNP、Phantom、Kit、Make/Buy；
7. 当前 KiCad、Altium、CPL、Placement、Gerber、ODB++、IPC-2581；
8. 当前 RefDes、Footprint、Side、X/Y、Rotation、Panel；
9. 当前 Auxiliary Material、Consumable、Loss、Setup、Feeder；
10. 当前 SMT/THT/Assembly/Programming/Test/Packaging Routing；
11. 当前 Work Center、Equipment、Labor/Machine Time、Yield；
12. 当前 Stencil、Fixture、Jig、Programmer；
13. 当前 Firmware Artifact、Hash、Signature、Key Injection；
14. 当前 Test Program、Limit、Coverage、Sampling、Result Schema；
15. 当前 Packaging BOM、Accessory、Label、ESD/MSL、Carton/Pallet；
16. 当前 NPI Stage、Checklist、Build、Issue、Deviation、Release；
17. 当前 ECO/ECN 和历史发布版本；
18. 当前 Agent 38–42 Integration；
19. 当前 Permission、Approval、Audit、Queue、Object Storage；
20. 脱敏、合成或授权 Fixture。

硬约束：

- EBOM/MBOM/BOP/Routing 分开；
- EBOM 不可覆盖；
- MBOM 绑定 Site/Stage/Variant/Effectivity；
- Mapping 是一等对象；
- 支持 1:1、1:N、N:1、N:M；
- Expected Plan 与 Actual Genealogy 分开；
- Part/Ordering Variant/IPN/Supplier SKU 分开；
- DNP/Variant/Effectivity 必须参与；
- 所有 Placed RefDes 对账；
- Duplicate RefDes 阻断；
- Auxiliary Material 结构化；
- 正式用量不能写“适量”；
- Loss 不重复叠加；
- Operation Material 绑定工序；
- Routing Graph 校验；
- Tooling Revision/Calibration 校验；
- Firmware 使用 Hash；
- 密钥不存明文；
- Test Program/Limit/Fixture/Result Schema 分开；
- Test Script 存在不等于 Approved；
- Packaging BOM/Label 版本化；
- Agent 33 未批准替代不得发布；
- Agent 34/35 生命周期与合规 Gate；
- Agent 38 包装满足生产要求；
- Agent 39 成本输入有来源；
- Agent 40 指定版本计划；
- Agent 41 库存复用满足 Scope；
- Agent 42 Traceability Contract 明确；
- NPI Score 不能覆盖 Hard Gate；
- Waiver 有 Scope/Effectivity/Expiry；
- Release Package 不可变；
- AI Draft 必须审核；
- AI 不生成位号、数量、测试限值或发布决定；
- 规则版本化、可解释、可回滚；
- 不将私有设计、固件、测试和制造数据发给外部模型；
- 不用真实客户数据做公开测试；
- 不伪造 Mapping、工时、良率、测试、Readiness 和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–42 的真实完成程度和接口；
3. 查找 EBOM/MBOM/BOP/Routing/Work Instruction；
4. 查找 Product/Variant/Site/Stage/Customer Context；
5. 查找 Revision/Effectivity/DNP/Phantom/Kit/Make-Buy；
6. 查找 EDA Placement、RefDes、Footprint、Side、Rotation、Panel；
7. 查找 Auxiliary Material 和非结构化工艺备注；
8. 查找 Loss/Setup/Feeder/Sampling/Rework/Yield；
9. 查找 Operation/Work Center/Equipment/Times；
10. 查找 Tooling/Fixture/Stencil/Calibration；
11. 查找 Firmware/Hash/Signature/Programming/Serial/Key；
12. 查找 ICT/FCT/AOI/SPI/X-ray/Test Limit/Coverage；
13. 查找 Packaging BOM/Label/Accessory/ESD/MSL；
14. 查找 NPI Stage/Checklist/Build/Issue/Deviation/Release；
15. 查找 ECO/ECN 和历史 Effectivity；
16. 查找 Agent 38–42 数据契约；
17. 查找审批、签署、权限、审计和发布；
18. 统计 Unmapped EBOM、Missing RefDes、Missing Auxiliary、Missing Routing、Missing Firmware/Test/Packaging；
19. 抽样分析脱敏或合成产品；
20. 在 docs/ebom-mbom-npi-implementation-plan.md 中生成实施计划；
21. 在 docs/ebom-mbom-domain-model.md 中定义 Domain Model；
22. 在 docs/transformation-mapping-model.md 中定义 Mapping；
23. 在 docs/pcb-refdes-placement.md 中定义 Placement；
24. 在 docs/auxiliary-material-and-loss.md 中定义辅料和损耗；
25. 在 docs/bop-routing-model.md 中定义 BOP/Routing；
26. 在 docs/firmware-programming-model.md 中定义烧录；
27. 在 docs/test-calibration-model.md 中定义测试和校准；
28. 在 docs/packaging-bom-model.md 中定义包装；
29. 在 docs/traceability-plan.md 中定义 Agent 42 Contract；
30. 在 docs/npi-readiness-gates.md 中定义阶段 Gate；
31. 在 docs/manufacturing-release-package.md 中定义发布包；
32. 在 docs/change-effectivity.md 中定义变更；
33. 在 docs/integration-agent38-42.md 中定义集成；
34. 在 docs/ebom-mbom-migration-plan.md 中定义旧数据迁移；
35. 在 docs/ebom-mbom-benchmark-plan.md 中定义 Benchmark；
36. 给出拟新增、拟修改和拟复用文件；
37. 给出 Phase 1 精确范围；
38. 不修改业务代码；
39. 不创建数据库 Migration；
40. 不安装依赖；
41. 不读取或打印生产 Secret；
42. 运行当前仓库已有 lint、type check、test、build 和 security scan；
43. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–42 输入契约；
- EBOM/MBOM/BOP/Routing；
- Mapping；
- RefDes/Placement/Panel；
- Auxiliary/Loss；
- Operation/Work Center/Tooling；
- Firmware/Programming；
- Test/Calibration；
- Packaging/Label；
- Traceability Plan；
- NPI Stage/Gate/Build；
- Change/Effectivity/Deviation；
- Release Package；
- Agent 38–42 Integration；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 98. 后续 Phase 提示词模板

```text
继续实现 EBOM-MBOM NPI Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–43 规格；
3. 阅读 EBOM-MBOM NPI Implementation Plan；
4. 阅读 Domain、Mapping、Placement、Auxiliary、Routing、Firmware、Test、Packaging、Traceability、NPI、Release 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- EBOM/MBOM/BOP/Routing Separation；
- Immutable Revisions；
- Mapping First-class；
- RefDes Reconciliation；
- Structured Auxiliary Material；
- No Duplicate Loss；
- Firmware/Test Hash and Approval；
- NPI Hard Gate；
- Release Package Immutability；
- Evidence/Version/Trace；
- 不公开真实客户数据；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. property/reconciliation test；
10. release/security test；
11. performance test；
12. benchmark；
13. 更新文档；
14. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Adapter/Rule/Template 变化；
- 测试命令和真实结果；
- Mapping/RefDes/Quantity Accuracy；
- NPI Gate；
- Release Consistency；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 99. MVP 演示流程

1. 选择一个已发布 EBOM Rev C；
2. 选择苏州工厂和 Pilot 阶段；
3. 加载 KiCad BOM 和 CPL；
4. Agent 32确认所有 Part；
5. 排除 DNP；
6. 导入 Top/Bottom RefDes、X/Y、Rotation；
7. 检测一个 Duplicate RefDes 并阻断；
8. 修复后重新运行；
9. 生成 1:1 EBOM-MBOM Mapping；
10. 将一个外购无线模块映射为 Purchased Module；
11. 将测试接口和编程针转换为工艺用途；
12. 根据 SMT 模板补充焊膏；
13. 根据结构模板补充螺丝胶和标签；
14. 所有辅料显示规则来源；
15. 应用 Feeder、Setup 和 Panel Loss；
16. 验证损耗没有重复；
17. 生成 SMT Top、Reflow、AOI、SMT Bottom 等 Routing；
18. 将每个 RefDes 绑定到工序；
19. 加入 Stencil 和 FCT Fixture；
20. 加载 Firmware 1.4.2；
21. 验证 Artifact SHA-256；
22. 配置序列号和 MAC 注入；
23. 加载 FCT Program 和 Limit Set；
24. 发现 Fixture Revision 不匹配，创建 Blocker；
25. 修复 Fixture 后重新评估；
26. 生成 Packaging BOM；
27. 加入 ESD Bag、Desiccant、HIC、Inner Box 和 Label；
28. 配置 Lot 和 Serial Trace Scan Point；
29. Agent 38读取 Feeder/Reel 要求；
30. Agent 39读取材料、工时、测试和包装；
31. Agent 40读取 Operation Need Date 和 Loss；
32. Agent 42读取计划 Traceability Contract；
33. 执行 Pilot NPI Checklist；
34. 发现测试覆盖率不足，状态为 Conditional；
35. 制造工程师补充测试；
36. 运行 100 台 Pilot Build；
37. 记录 Yield 和 Issue；
38. 关闭 Critical Issue；
39. 创建 Manufacturing Release Package；
40. Engineering、Manufacturing、Quality 审批；
41. 发布 Approved for Pilot；
42. 生成 Rev M2 时保留 M1；
43. 发布 `manufacturing.release-package.released`。

---

# 100. 生产上线顺序

第一阶段：

```text
Released EBOM
KiCad BOM/CPL
EBOM-MBOM Mapping
RefDes/DNP
Direct Material
Basic Routing
Quantity Reconciliation
Manual Review
```

第二阶段：

```text
Auxiliary Material
Loss/Yield
Firmware
Test
Packaging
Traceability
NPI Checklist
Release Package
```

第三阶段：

```text
Site Localization
Mechanical/IPC-2581/ODB++
Advanced Tooling
Reference Designator Trace
Multi-level Manufacturing
Historical Calibration
```

上线优先确保：

```text
研发用什么
工厂实际要领什么
在哪道工序使用
每个位号是否正确
烧录和测试版本是否唯一
包装和追溯是否完整
```

宁可让系统明确显示“该辅料、测试限值或工艺路线尚未定义”，也不要从一条含糊的工程备注里脑补出一套看似完整的量产 MBOM。制造数据最危险的状态，不是缺，而是错得很完整。
