# 元器件选型优化 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：14  
> Agent 名称：Electronic Component Selection, Multi-objective Optimization & Design Admission Agent  
> 中文名称：元器件选型优化 Agent  
> 类型：混合型  
> 版本：V1.0  
>
> 定位：接收 Agent 10 的 Requirement Baseline、Agent 11 的项目计划和 Gate、Agent 12 的功能架构与 Block/Interface/Power/Budget、Agent 13 的参考设计与模块复用候选，以及企业元器件数据库、厂商数据、授权分销商价格库存、生命周期、封装、EDA 库、合规和历史质量数据；将每个功能块、接口、电源节点和物料角色转换为结构化 Component Selection Contract；通过分类检索、参数范围匹配、硬约束过滤、数据证据审查、器件组合兼容性、成本与供应链风险分析和多目标优化，生成主选器件、备选器件、待验证候选和不推荐候选；输出完整排名理由、数据快照、风险、设计影响、验证计划和后续 Agent 可直接消费的选型 Baseline。
>
> 企业数据基础假设：
> - 元器件基础数据库约 110 万型号；
> - 每个元器件包含型号、厂商、分类、官网链接和 PDF 数据手册；
> - 正在按分类抽取典型参数；
> - 原理图符号约 2 万、封装约 2 万；
> - 封装映射约 90 万型号；
> - 符号映射约 10 万型号；
> - 参考设计约 2 万，其中 KiCad 工程约 2 千；
> - 功能模块约 500+；
> - 可接入 DigiKey、Mouser、Arrow、Element14、CECPORT 等授权渠道的数据；
> - 可接入企业库存、历史采购、来料、生产、质量和替代料数据。
>
> 上游：
> - Agent 10：Requirement Baseline、Constraint、Goal、Preference、Variant、Assumption、Acceptance Criteria 和 Change Impact
> - Agent 11：Project Profile、Component Selection Work Package、Milestone、Gate、Owner Role、Budget、Schedule、Long-lead Risk 和 Replan
> - Agent 12：Function、Logical Block、Physical Architecture、Port、Interface Contract、Power Tree、Mode、Processing/Memory/Bandwidth/Latency/I/O/Power/Thermal/Cost Budget 和 Architecture Baseline
> - Agent 13：Reference Design、Module Candidate、Reuse Baseline、Source Components、Modification Scope、License 和 Verification Evidence
> - 企业元器件数据库：MPN、厂商、分类、参数、Datasheet、Package、Lifecycle、EDA、Compliance 和替代关系
> - 授权分销商：价格、库存、MOQ、SPQ、包装、交期、区域和货币
> - 企业采购和库存：现有库存、历史价格、供应商、质量、退货、交期和使用项目
> - 企业策略：AVL、品牌偏好、禁用厂商、优选渠道、区域限制、产品等级、目标生命周期和成本策略
> - 质量与制造：来料缺陷、贴装良率、返修、封装可制造性、湿敏等级和工厂能力
> - 合规：RoHS、REACH、无卤、冲突矿产、车规/工业/医疗等企业要求
>
> 下游：
> - Agent 11：器件评估、样品、验证、采购、长交期和替代任务
> - Agent 12：Physical Architecture、Power、Thermal、I/O、Cost 和 Risk 更新
> - Agent 13：参考设计器件保留、替换和复用范围更新
> - 原理图方案生成 Agent：主选器件、外围要求、设计约束和 Reference Circuit
> - Agent 16：解析目标 EDA 工程中的实际器件并核对选型 Baseline
> - Agent 18：Netlist 中器件角色与接口核对
> - Agent 20：Symbol、Footprint、Pin-Pad、3D、Package Variant 和库依赖
> - Agent 21：MCU/MPU/FPGA、SDK、BSP、Driver、RTOS、协议栈和工具链支持
> - Agent 22：额定值、保护、去耦、Pin、器件使用条件和 Datasheet 证据审查
> - Agent 23：模拟、电源、时钟、控制、热和性能仿真
> - Agent 24：封装、引脚、功率、高速、布局和布线约束
> - Agent 25：器件面积、高度、功能簇、热源和固定接口布局
> - Agent 26：关键网络、差分、时钟和电源布线
> - Agent 27：SI、PI、EMC、回流和器件模型验证
> - Agent 28：封装高度、连接器、散热器、屏蔽罩和机械干涉
> - Agent 29：BOM、CPL、装配和生产文件中的正式型号
> - Agent 30：封装可贴性、特殊工艺、元件方向和 DFA 风险
> - Agent 31–45：BOM 规范化、精确匹配、替代、生命周期、合规、价格库存、风险、采购、库存、NPI、制造和质量
>
> 与 Agent 33 的边界：
> - Agent 14 面向“设计阶段主器件选型”，从功能和架构出发决定应该设计进产品的器件；
> - Agent 33 面向“已有 BOM 的替代推荐”，处理缺货、降本、EOL、国产替代或第二来源；
> - Agent 14 输出 Primary/Alternate Strategy 和设计适配范围；
> - Agent 33 在已冻结器件及其电路上下文中评估替代兼容性；
> - 两者共用参数、证据、生命周期和供应链基础设施，但不共用未经区分的评分结论。
>
> 核心输出：
> - Component Selection Input Snapshot
> - Selection Profile and Enterprise Policy Snapshot
> - Component Role and Selection Contract Set
> - Parametric Search Intent
> - Candidate Retrieval Set
> - Candidate Admission Findings
> - Normalized Parameter Comparison Matrix
> - Requirement and Architecture Coverage Matrix
> - Electrical Compatibility Report
> - Functional and Protocol Compatibility Report
> - Power, Thermal and Efficiency Report
> - Package, Footprint and Manufacturing Fit Report
> - Firmware, Toolchain and Ecosystem Fit Report
> - EDA Asset Readiness Report
> - Lifecycle and Product Longevity Report
> - Price, Inventory and Lead-time Snapshot
> - Brand, Supplier and Regional Policy Report
> - Compliance and Quality Evidence Report
> - Component Combination Compatibility Graph
> - Hard Constraint Results
> - Candidate Score Vector
> - Pareto Candidate Set
> - Primary, Alternate and Experimental Candidate Sets
> - Selection Explanation and Evidence Package
> - Sample and Validation Plan
> - Design Impact and Adaptation Work Packages
> - Component Selection Decision Record
> - Component Selection Baseline
> - Downstream Agent Packages
>
> 重要边界：
> - 本 Agent 推荐和排序，不替代专业工程师批准器件。
> - 不把搜索结果排名、广告排名或分销商热度视为技术适配性。
> - 不把同一参数名称下的典型值、最小值、最大值和保证值混为一类。
> - 不把不同工作条件下的参数直接比较。
> - 不将 Datasheet 首页营销参数视为完整设计边界。
> - 不把缺失参数自动填成行业常见值。
> - 不把参数“更高”一律视为“更好”；应根据目标范围、功耗、噪声、成本和系统约束判断。
> - 不将封装名称相同视为 Pin-to-Pin、Footprint-to-Footprint 或 Thermal Pad 相同。
> - 不将功能相似视为 Firmware、Protocol、Timing、Power Sequence 和 Safety 相同。
> - 不把当前库存视为未来量产保证。
> - 不把一个分销商的库存和价格视为全球真实供应。
> - 不把查询时刻价格用于未标明数量、货币、区域、税费和包装的长期成本结论。
> - 不把 Lifecycle 字段缺失视为 Active。
> - 不把厂商“推荐用于新设计”自动等同于覆盖目标产品寿命。
> - 不把历史采购低价自动用于当前报价。
> - 不将品牌偏好、国产化或供应商关系自动提升为硬约束，除非企业 Policy 或批准决策明确。
> - 不允许软评分抵消电气、安全、接口、尺寸、生命周期或许可证等硬约束。
> - 不将主选和备选简单定义为两个排名最高的器件；备选必须满足第二来源、切换成本和设计兼容策略。
> - 不把未经验证的“Pin-compatible”或“drop-in replacement”声明直接接受。
> - 不把仿真模型缺失视为器件不可用，但要降低验证完整度。
> - 不自动创建或修改 Symbol、Footprint、3D 和原理图；交给 Agent 20 和 Agent 19。
> - 不自动采购样品或下单；只创建采购候选和审批任务。
> - 不向外部模型发送企业私有 BOM、采购价格、供应商协议、客户用途和未发布设计。
> - 所有候选、参数、价格、库存、生命周期、评分和决策必须绑定来源、版本、时间、条件和证据。

---

# 1. Agent 14 的系统位置

```text
Agent 10 Requirement Baseline
              ↓
Agent 12 Architecture Baseline
              ↓
Component Roles and Selection Contracts
              ↓
1.1M Component Database + Official/Vendor/Distributor/Enterprise Data
              ↓
Taxonomy + Parametric + Semantic + Graph Retrieval
              ↓
Hard Constraints and Evidence Admission
              ↓
Electrical / Functional / Power / Package / Firmware / Supply Evaluation
              ↓
Combination Compatibility and Design Impact
              ↓
Score Vector + Pareto + Primary/Alternate Strategy
              ↓
Human Review and Component Selection Baseline
              ↓
Schematic / Firmware / PCB / BOM / Procurement / Manufacturing
```

---

# 2. 为什么需要独立 Agent 14

常见问题包括：

1. 工程师只在一个分销商网站按参数筛选；
2. Datasheet 参数字段命名不一致，漏掉合适器件；
3. 只看典型性能，不看保证值和工作条件；
4. 选到性能很高但功耗、成本、封装和软件生态不合适的器件；
5. 主芯片交期很长，却在 PCB 定版后才发现；
6. 器件 Active，但厂商已不推荐新设计或生态停止维护；
7. 同封装器件 Pinout、EPAD 或 NC 定义不同；
8. ADC 满足采样率，却不满足输入带宽、SNR、参考和接口吞吐；
9. MCU 外设数量满足，但 DMA、Pin Mux、Memory 和 SDK 不满足；
10. 电源芯片额定电流满足，但热、瞬态、效率和最小 On-time 不满足；
11. 连接器电流满足，但插拔寿命、方向、锁扣和机械高度不满足；
12. 备选料只是“相似器件”，并不能低成本切换；
13. 价格快照没有数量和时间，项目后期成本完全失真；
14. 库文件缺失，选型完成后还要花大量时间建库；
15. 企业已有库存和历史验证器件没有被优先利用；
16. 推荐算法过度偏向廉价器件，忽略生命周期和质量；
17. 推荐理由只给一个总分，工程师无法判断风险来自哪里；
18. 需求变化后，选型排名未重新计算；
19. 器件组合单独都满足，但组合后出现电源、时钟、接口或封装冲突；
20. 主选器件冻结后，BOM、原理图、固件和 PCB 没有绑定同一 Selection Baseline。

Agent 14 的职责是：

```text
Architecture Need
→ Component Role
→ Structured Selection Contract
→ Evidence-based Candidate Evaluation
→ Multi-objective Decision
→ Controlled Design Admission
```

---

# 3. Component Role

器件角色由功能和架构决定：

```text
processor
microcontroller
microprocessor
fpga
cpld
adc
dac
op_amp
comparator
instrumentation_amplifier
reference
sensor
transceiver
interface_bridge
memory
storage
oscillator
clock_generator
power_converter
ldo
charger
load_switch
protection
isolation
driver
motor_driver
display
connector
relay
passive
rf_frontend
antenna
security_element
```

---

# 4. Selection Scope

```text
single_component_role
component_family
critical_component_set
subsystem_component_set
complete_architecture_candidate
variant_component_set
```

---

# 5. Component Selection Contract

每个角色必须有一份结构化 Contract：

```text
role identity
required functions
hard parameters
soft objectives
interfaces
power
thermal
package
mechanical
firmware
EDA
compliance
lifecycle
supply
cost
brand policy
verification
variant
```

---

# 6. Selection Contract IR

```json
{
  "selection_contract_id": "SEL-ADC-001",
  "role": "adc",
  "target_block_id": "BLK-DAQ-001",
  "requirement_ids": [],
  "hard_constraints": [],
  "soft_objectives": [],
  "required_interfaces": [],
  "power_constraints": {},
  "thermal_constraints": {},
  "package_constraints": {},
  "firmware_constraints": {},
  "eda_requirements": {},
  "lifecycle_constraints": {},
  "supply_constraints": {},
  "cost_context": {},
  "brand_policy": {},
  "verification_requirements": {},
  "status": "candidate"
}
```

---

# 7. Constraint 类型

```text
boolean
exact
minimum
maximum
range
enumeration
formula
conditional
compatibility
presence
absence
policy
```

---

# 8. Hard Constraint

典型：

```text
required function
minimum performance
maximum power
required input/output range
required protocol/version
required safety rating
maximum package dimensions
required temperature range
required lifecycle horizon
forbidden technology
forbidden manufacturer
required compliance
required package family
```

Hard Constraint 不参与加权抵消。

---

# 9. Soft Objective

```text
price
power
performance margin
package area
height
thermal margin
availability
lead time
lifecycle confidence
brand preference
existing inventory reuse
EDA readiness
firmware ecosystem
reference design availability
manufacturing familiarity
quality history
```

---

# 10. Objective Direction

```text
minimize
maximize
target
range_preference
categorical_preference
lexicographic
```

---

# 11. Criticality

```text
safety_critical
mission_critical
performance_critical
schedule_critical
cost_critical
supply_critical
standard
optional
```

Criticality 影响验证、备选策略和权重，不改变硬约束。

---

# 12. Candidate 来源

```text
enterprise_approved
enterprise_historical
reference_design
module_library
manufacturer_catalog
authorized_distributor
public_database
engineer_manual
ai_candidate
```

---

# 13. Candidate 状态

```text
retrieved
admitted
rejected_hard
needs_data
needs_engineering_review
needs_supplier_confirmation
needs_sample_validation
shortlisted
primary_candidate
alternate_candidate
experimental_candidate
rejected
superseded
```

---

# 14. Component Identity

必须保存：

```text
manufacturer
manufacturer part number
ordering code
base part family
package variant
temperature grade
quality grade
packing option
revision
die revision optional
aliases
normalized component id
```

不得把 Base Part 和可采购 Ordering Code 混为一项。

---

# 15. Ordering Code

同一基础型号可能因以下字段不同：

```text
package
temperature
speed grade
memory
voltage
quality grade
tape/reel
tray
moisture packaging
lead finish
factory option
firmware mask
```

价格库存必须绑定 Ordering Code。

---

# 16. Parameter Model

```text
canonical parameter
source parameter name
value
unit
value type
minimum
typical
maximum
tolerance
conditions
test method
guaranteed
source
page/table
confidence
```

---

# 17. Value Classification

```text
absolute_maximum
recommended_operating
guaranteed_minimum
guaranteed_maximum
typical
characterization
derived
calculated
marketing_claim
unknown
```

Absolute Maximum 不能作为正常工作目标。

---

# 18. Condition Model

```text
temperature
supply voltage
load
frequency
gain
sample rate
mode
package
board conditions
airflow
measurement bandwidth
test circuit
```

没有条件的参数不能与有条件的保证值直接判定兼容。

---

# 19. Evidence Level

```text
official_datasheet
official_product_page
official_reference_design
official_errata
official_quality_document
authorized_distributor
enterprise_measurement
enterprise_production
independent_lab
community
ai_extracted
unknown
```

---

# 20. Parameter Extraction

优先：

```text
structured manufacturer data
existing normalized database
table parser
deterministic PDF extraction
datasheet text extraction
approved model-assisted extraction
manual
```

AI 提取必须返回 Evidence Anchor。

---

# 21. Taxonomy

器件分类必须支持：

```text
category
subcategory
function taxonomy
application taxonomy
interface taxonomy
package taxonomy
quality grade
technology
```

分类版本化，支持一器件多标签。

---

# 22. Search Intent

由 Selection Contract 构建：

```text
category
function
required parameters
preferred ranges
interfaces
power
package
temperature
quality grade
lifecycle
availability
cost context
brand policy
EDA/firmware needs
```

---

# 23. Retrieval Pipeline

```text
Identity/Family Lookup
→ Taxonomy Filter
→ Boolean Capability Filter
→ Parametric Range Search
→ Interface Graph Search
→ Reference Design/Module Relation
→ Semantic Retrieval for Descriptions
→ Candidate Union
→ Hard Constraint Pre-filter
→ Deep Evaluation
→ Rerank
```

---

# 24. Search Indexes

```text
identity index
taxonomy index
parameter/range index
interface graph
package index
manufacturer index
lifecycle index
EDA asset index
firmware ecosystem index
reference design graph
supply snapshot index
full-text index
semantic summary index
```

---

# 25. Candidate Admission Gate

候选进入深度评估前检查：

```text
normalized identity
resolvable ordering code
required data source permission
basic category match
required function not explicitly absent
datasheet or authoritative evidence
not quarantined
not prohibited by policy
package information present or flagged
lifecycle status not unknown without review
```

---

# 26. Hard Constraint Evaluation

结果：

```text
pass
fail
unknown
not_applicable
condition_mismatch
evidence_insufficient
```

`unknown` 不可自动作为 Pass。

---

# 27. Constraint Trace

```json
{
  "constraint_id": "C-ADC-RATE",
  "result": "pass",
  "target": {"minimum": "45", "unit": "MSPS"},
  "candidate": {"minimum": "65", "unit": "MSPS"},
  "conditions": {},
  "evidence_ids": [],
  "rule_version": "1.0.0"
}
```

---

# 28. Functional Compatibility

检查：

```text
core function
operating modes
channel count
resolution
architecture
calibration
self-test
diagnostics
error handling
startup behavior
shutdown behavior
```

---

# 29. Interface Compatibility

检查：

```text
protocol family
protocol version
role
direction
voltage levels
speed
clocking
lane count
data format
latency
interrupt
reset
configuration
hot plug
isolation
protection
```

---

# 30. Processor Selection

MCU/MPU/FPGA 额外检查：

```text
core architecture
performance
memory
external memory
peripherals
DMA
timers
ADC/DAC
USB/CAN/Ethernet
security
debug
boot
package
pin mux
SDK
toolchain
RTOS
driver ecosystem
long-term support
```

---

# 31. Analog Component Selection

额外检查：

```text
input range
output swing
common-mode
gain bandwidth
slew rate
noise
offset
bias current
CMRR
PSRR
distortion
stability
load
supply
temperature
package
```

---

# 32. ADC/DAC Selection

额外检查：

```text
resolution
sample/update rate
input/output bandwidth
SNR
SINAD
ENOB
THD
SFDR
latency
input structure
reference
clock
interface
channel skew
power modes
```

---

# 33. Power Component Selection

额外检查：

```text
input range
output range
current
peak current
efficiency
quiescent current
switching frequency
minimum on/off time
transient
ripple
thermal
protection
startup
sequence
reverse current
layout sensitivity
external components
```

---

# 34. Clock Component Selection

```text
frequency
accuracy
stability
jitter
phase noise
startup
output type
drive
load
temperature
aging
supply
package
```

---

# 35. Memory Selection

```text
type
capacity
width
frequency
latency
endurance
retention
temperature
interface
voltage
package
availability
firmware support
```

---

# 36. Connector Selection

```text
contacts
pitch
current
voltage
orientation
height
mating cycles
retention
locking
shielding
impedance
environmental sealing
cable availability
assembly process
```

---

# 37. Protection Component Selection

```text
working voltage
stand-off
clamp
surge/ESD rating
capacitance
leakage
response
channel count
directionality
package
failure mode
standards evidence
```

---

# 38. Passive Selection

```text
value
tolerance
voltage/current
power
temperature coefficient
ESR/ESL
frequency
dielectric/material
package
derating
reliability
```

---

# 39. Electrical Derating

企业 Policy 可定义：

```text
voltage derating
current derating
power derating
temperature margin
junction margin
capacitor bias derating
inductor saturation margin
connector current margin
```

Derating 规则必须版本化并保留依据。

---

# 40. Power Evaluation

```text
operating power
sleep power
peak power
startup/inrush
efficiency effect
rail compatibility
power sequence
thermal dissipation
battery/runtime effect
```

---

# 41. Thermal Evaluation

```text
junction temperature estimate
ambient
power dissipation
theta JA/JC/JB
board assumptions
airflow
copper area
thermal pad
heatsink
margin
simulation required
```

不能用单一 θJA 在不匹配板条件下给出精确结温结论。

---

# 42. Package Fit

检查：

```text
package family
body dimensions
pitch
ball/pad count
exposed pad
height
courtyard
assembly capability
inspection
rework
moisture sensitivity
thermal path
```

---

# 43. Pin and Footprint Compatibility

等级：

```text
same_function_and_pin
same_pin_with_parameter_change
same_footprint_different_pin_function
same_body_different_pad
adapter_possible
not_compatible
unknown
```

只有 Agent 20 验证后才能标记正式 Pin-to-Pin。

---

# 44. EDA Readiness

```text
symbol available
symbol verified
footprint available
footprint verified
pin-pad mapped
3D available
simulation model
IBIS
SPICE
STEP
license
source
version
```

EDA Ready 不等于器件技术适配。

---

# 45. Firmware and Ecosystem Fit

```text
official SDK
driver
HAL
RTOS support
Linux support
examples
reference projects
debug tools
programmer
community
security updates
known errata
maintenance status
license
```

---

# 46. Lifecycle Model

```text
active
recommended_for_new_design
not_recommended_for_new_design
last_time_buy
obsolete
discontinued
unknown
```

还需保存：

```text
source
effective date
PCN/PDN
last update
product longevity program
estimated horizon candidate
confidence
```

---

# 47. Product Longevity

目标条件：

```text
development duration
certification duration
planned production years
service years
replacement availability
qualification cost
```

Lifecycle 评估必须覆盖完整产品时间线。

---

# 48. Supply Snapshot

```text
manufacturer
distributor
region
currency
query time
available stock
factory stock
on-order
lead time
MOQ
SPQ
package
price breaks
validity
source
```

---

# 49. Stock 类型

```text
authorized_distributor_stock
manufacturer_stock
enterprise_stock
broker_stock
marketplace_stock
unknown
```

默认优先授权渠道和企业批准供应商。

---

# 50. Price Context

```text
quantity
currency
region
date
tax excluded/included
shipping excluded/included
packaging
authorized channel
contract price
spot price
```

没有 Context 的价格不能进入正式成本比较。

---

# 51. Effective Unit Cost

候选成本可包含：

```text
unit price
MOQ overbuy
SPQ overbuy
shipping allocation
tariff/tax candidate
programming
special handling
alternate qualification
EDA creation
firmware port
PCB area
thermal solution
yield risk
```

不要求 Phase 1 全部实现，但模型需支持。

---

# 52. Lead-time Evaluation

```text
reported lead time
stock coverage
project need-by
sample need-by
prototype need-by
production need-by
buffer policy
supplier confirmation
freshness
```

---

# 53. Brand Policy

```text
preferred
approved
restricted
prohibited
customer_mandated
region_preferred
strategic_partner
no_preference
```

品牌偏好是 Policy，不应由模型猜测。

---

# 54. Supplier Policy

```text
authorized_only
approved_vendor_list
multi_distributor_required
regional_source_required
single_source_allowed
broker_prohibited
```

---

# 55. Existing Inventory Reuse

评估：

```text
enterprise stock
location
lot/date code
quality status
reservation
shelf life
moisture status
project ownership
opportunity cost
```

有库存不等于可以直接使用。

---

# 56. Compliance

```text
RoHS
REACH
halogen_free
conflict_minerals
PFAS candidate
automotive grade
industrial grade
medical documentation
flammability
material declaration
country/market
```

Agent 14只验证数据与项目 Policy，不独立做法规适用性结论。

---

# 57. Quality Evidence

```text
incoming defect rate
supplier corrective actions
production defect
field return
counterfeit finding
rework rate
lot traceability
manufacturer quality report
enterprise qualification
```

历史质量需考虑样本和时间。

---

# 58. Errata

对于复杂 IC：

```text
errata version
affected revision
severity
workaround
firmware impact
hardware impact
manufacturing impact
effective date
```

Critical Errata 可形成 Hard Constraint 或 Review Gate。

---

# 59. Component Combination Graph

节点：

```text
component candidate
power rail
clock
reset
interface
bus
connector
memory
firmware driver
mechanical region
test method
```

边：

```text
compatible
requires
conflicts
powered_by
clocked_by
controlled_by
communicates_with
requires_adapter
shares_resource
```

---

# 60. Combination Compatibility

检查：

```text
voltage compatibility
logic levels
protocol
role
clock
reset
memory bus
address
chip select
pin mux
power sequence
peak power
thermal concentration
package/placement
firmware version
reference design
```

---

# 61. Candidate Set

```text
primary
alternate_same_design
alternate_with_bom_change
alternate_with_firmware_change
alternate_with_pcb_change
experimental
not_recommended
```

---

# 62. Alternate Strategy

备选不是简单的第二名：

```text
drop_in_candidate
same_footprint_candidate
dual_footprint_strategy
stuffing_option
variant_bom
daughterboard_adapter
firmware_abstraction
design_for_substitution
no_practical_alternate
```

---

# 63. Primary Candidate Gate

必须满足：

```text
all critical hard constraints pass
no critical unknown
required evidence available
package/EDA plan available
lifecycle acceptable or risk approved
supply strategy available
verification plan available
owner review complete
```

---

# 64. Candidate Score Vector

```text
hard_violation_count
critical_unknown_count
performance_margin
power_efficiency
thermal_margin
package_fit
firmware_ecosystem
EDA_readiness
reference_design_quality
lifecycle_confidence
authorized_supply_coverage
lead_time_fit
price_fit
brand_policy_fit
enterprise_inventory_fit
quality_history
compliance_evidence
adaptation_effort
architecture_uncertainty
```

---

# 65. Multi-objective Optimization

必须支持：

```text
hard constraint filtering
lexicographic objectives
weighted soft objectives
Pareto dominance
scenario-specific ranking
sensitivity analysis
```

---

# 66. Ranking Scenario

```text
balanced
lowest_cost
lowest_power
highest_performance
smallest_package
best_supply
longest_lifecycle
fastest_prototype
maximum_existing_inventory
preferred_brand
lowest_design_change
```

---

# 67. Weight Policy

权重来源：

```text
project profile
component role
criticality
project phase
enterprise policy
human decision
```

不得由模型为所有项目固定一套权重。

---

# 68. Score Normalization

支持：

```text
min-max with bounds
target distance
piecewise preference
ordinal category
risk penalty
unknown penalty
```

Normalization 必须版本化和可解释。

---

# 69. Unknown Penalty

缺失值处理：

```text
hard constraint unknown → block or review
critical objective unknown → strong penalty
optional objective unknown → policy penalty
```

不允许用同类平均值静默填补。

---

# 70. Pareto Set

至少输出：

```text
lowest cost
lowest power
highest performance margin
best lifecycle
best immediate availability
best EDA/firmware readiness
lowest adaptation effort
balanced
```

---

# 71. Sensitivity Analysis

检查：

```text
price changes
stock changes
lead-time changes
weight changes
quantity changes
lifecycle status changes
performance requirement changes
package constraints
```

若排名对轻微变化极敏感，应标记决策脆弱。

---

# 72. Robustness

候选鲁棒性维度：

```text
parameter margin
supply diversity
price volatility
lifecycle confidence
design flexibility
alternate availability
data confidence
```

---

# 73. Explainability

每个候选必须回答：

```text
为什么被检索到
通过了哪些硬约束
失败或未知哪些约束
性能余量是多少
参数来自何处
价格库存是什么时间和数量
生命周期依据是什么
需要哪些外围器件
封装和 EDA 准备情况
需要哪些硬件、固件、PCB 修改
为什么排名高于或低于其他候选
```

---

# 74. Negative Evidence

必须展示：

```text
missing data
critical errata
NRND/EOL
single-source
stock stale
unverified footprint
firmware unsupported
poor quality history
thermal uncertainty
known reference design issue
```

---

# 75. Sample Validation Plan

主选和关键备选可生成：

```text
sample quantity
source/distributor
lot/date code
evaluation board
bench tests
thermal tests
firmware bring-up
interface tests
corner conditions
comparison criteria
evidence capture
owner
gate
```

---

# 76. Design Impact

候选切换可能影响：

```text
power rails
clock/reset
pin mapping
peripherals
analog network
reference
protection
firmware
PCB footprint
placement
routing
thermal
mechanical
test
BOM
manufacturing
```

---

# 77. Adaptation Work Package

```text
component evaluation
sample procurement
symbol/footprint creation
pin mapping verification
reference design adaptation
firmware driver evaluation
simulation
thermal validation
PCB constraint update
mechanical review
supplier confirmation
quality qualification
```

---

# 78. Selection Decision Record

```text
role
selected primary
selected alternates
rejected candidates
criteria
hard constraint results
score scenarios
trade-offs
accepted risks
required validations
design impact
approvers
effective baseline
```

---

# 79. Component Selection Baseline

包含：

```text
requirement baseline
architecture baseline
reuse baseline
selection contracts
primary components
alternate strategies
ordering codes
parameter evidence
price/inventory snapshot
lifecycle snapshot
policy snapshot
validation plan
accepted risks
open questions
approvals
manifest
hash
```

Baseline 不可覆盖。

---

# 80. Downstream Package

```text
schematic component package
firmware platform package
EDA library package
simulation model package
PCB package constraint package
mechanical/thermal package
BOM and supply package
procurement sample package
verification package
```

---

# 81. AI 允许职责

```text
将需求和架构转成 Selection Contract 候选
理解参数同义词
生成语义检索候选
总结 Datasheet 限制候选
解释排名和 Trade-off
生成验证问题和 Work Package 草稿
```

---

# 82. AI 禁止职责

```text
编造参数
把典型值当保证值
自动判定 Pin-compatible
自动判断法规适用性
自动接受未知 Lifecycle
自动选择最终器件
自动批准品牌例外
自动下单
直接修改 EDA
隐藏负面证据
```

---

# 83. 状态机

```text
RECEIVED
→ VALIDATING_BASELINES
→ SNAPSHOTTING_INPUT
→ BUILDING_SELECTION_CONTRACTS
→ RETRIEVING_CANDIDATES
→ ADMITTING_CANDIDATES
→ NORMALIZING_PARAMETERS
→ EVALUATING_HARD_CONSTRAINTS
→ EVALUATING_ELECTRICAL_AND_FUNCTIONAL
→ EVALUATING_POWER_THERMAL_PACKAGE
→ EVALUATING_FIRMWARE_AND_EDA
→ EVALUATING_LIFECYCLE_SUPPLY_COST
→ EVALUATING_COMPLIANCE_AND_QUALITY
→ EVALUATING_COMBINATIONS
→ SCORING_AND_PARETO
→ GENERATING_VALIDATION_PLAN
→ GENERATING_REVIEW_PACKAGE
→ REVIEW_REQUIRED
→ BASELINING
→ COMPLETED
```

分支：

```text
COMPLETED_DRAFT_ONLY
COMPLETED_WITH_OPEN_QUESTIONS
INPUT_BLOCKED
NO_CANDIDATE_FOUND
CRITICAL_DATA_MISSING
HARD_CONSTRAINT_BLOCKED
SUPPLY_CONFIRMATION_REQUIRED
LIFECYCLE_REVIEW_REQUIRED
EDA_REVIEW_REQUIRED
FIRMWARE_REVIEW_REQUIRED
SAMPLE_VALIDATION_REQUIRED
DECISION_REQUIRED
APPROVAL_REQUIRED
BASELINE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 84. 错误码

```text
PROJECT_NOT_FOUND
REQUIREMENT_BASELINE_NOT_FOUND
ARCHITECTURE_BASELINE_NOT_FOUND
BASELINE_HASH_MISMATCH
SELECTION_PROFILE_NOT_FOUND
COMPONENT_ROLE_UNDEFINED
SELECTION_CONTRACT_INCOMPLETE
COMPONENT_DATABASE_UNAVAILABLE
TAXONOMY_UNRESOLVED
PARAMETER_SCHEMA_NOT_FOUND
CANDIDATE_NOT_FOUND
COMPONENT_IDENTITY_UNRESOLVED
ORDERING_CODE_UNRESOLVED
DATASHEET_NOT_FOUND
PARAMETER_EVIDENCE_MISSING
PARAMETER_CONDITION_MISMATCH
HARD_CONSTRAINT_FAILED
CRITICAL_UNKNOWN_BLOCKED
INTERFACE_INCOMPATIBLE
POWER_INCOMPATIBLE
THERMAL_MARGIN_NEGATIVE
PACKAGE_INCOMPATIBLE
PIN_COMPATIBILITY_UNVERIFIED
EDA_ASSET_MISSING
FIRMWARE_SUPPORT_MISSING
LIFECYCLE_UNKNOWN
LIFECYCLE_BLOCKED
PRICE_CONTEXT_MISSING
SUPPLY_SNAPSHOT_STALE
AUTHORIZED_SUPPLY_MISSING
LEAD_TIME_NOT_CONFIRMED
BRAND_POLICY_BLOCKED
COMPLIANCE_EVIDENCE_MISSING
QUALITY_RISK_BLOCKED
ERRATA_REVIEW_REQUIRED
COMBINATION_CONFLICT
ALTERNATE_STRATEGY_INCOMPLETE
VALIDATION_PLAN_INCOMPLETE
SELECTION_DECISION_REQUIRED
BASELINE_APPROVAL_MISSING
BASELINE_ALREADY_EXISTS
JOB_CANCELLED
INTERNAL_ERROR


---

# 85. 数据库设计

## 85.1 `component_selection_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
reuse_baseline_id UUID NULL
project_baseline_id UUID NULL
selection_profile_id UUID NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
selected_baseline_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 85.2 `component_selection_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
architecture_baseline_hash CHAR(64) NOT NULL
reuse_baseline_hash CHAR(64) NULL
project_baseline_hash CHAR(64) NULL
component_catalog_snapshot_hash CHAR(64) NOT NULL
parameter_schema_snapshot_hash CHAR(64) NOT NULL
eda_registry_snapshot_hash CHAR(64) NULL
firmware_registry_snapshot_hash CHAR(64) NULL
lifecycle_snapshot_hash CHAR(64) NULL
supply_snapshot_hash CHAR(64) NULL
enterprise_inventory_snapshot_hash CHAR(64) NULL
quality_snapshot_hash CHAR(64) NULL
policy_snapshot_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, snapshot_hash)
```

## 85.3 `component_selection_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
project_phase VARCHAR NULL
component_role_scope JSONB NOT NULL
required_evaluations JSONB NOT NULL
hard_constraint_policy JSONB NOT NULL
objective_policy JSONB NOT NULL
unknown_policy JSONB NOT NULL
supply_policy JSONB NOT NULL
lifecycle_policy JSONB NOT NULL
brand_policy JSONB NOT NULL
quality_policy JSONB NOT NULL
approval_policy JSONB NOT NULL
source_reference JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 85.4 `component_roles`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
role_key VARCHAR NOT NULL
role_type VARCHAR NOT NULL
title VARCHAR NOT NULL
target_function_ids JSONB NOT NULL
target_block_ids JSONB NOT NULL
target_interface_ids JSONB NOT NULL
target_power_node_ids JSONB NOT NULL
requirement_ids JSONB NOT NULL
criticality VARCHAR NOT NULL
variant_scope JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, role_key)
```

## 85.5 `component_selection_contracts`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
role_id UUID NOT NULL
contract_key VARCHAR NOT NULL
contract_version INT NOT NULL
hard_constraints JSONB NOT NULL
soft_objectives JSONB NOT NULL
required_interfaces JSONB NOT NULL
power_constraints JSONB NOT NULL
thermal_constraints JSONB NOT NULL
package_constraints JSONB NOT NULL
firmware_constraints JSONB NOT NULL
eda_requirements JSONB NOT NULL
lifecycle_constraints JSONB NOT NULL
supply_constraints JSONB NOT NULL
cost_context JSONB NOT NULL
brand_policy JSONB NOT NULL
compliance_constraints JSONB NOT NULL
quality_constraints JSONB NOT NULL
verification_requirements JSONB NOT NULL
source_reference JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, contract_key, contract_version)
```

## 85.6 `component_constraint_definitions`

```text
id UUID PK
selection_contract_id UUID NOT NULL
constraint_key VARCHAR NOT NULL
constraint_type VARCHAR NOT NULL
parameter_key VARCHAR NULL
operator VARCHAR NOT NULL
target_value JSONB NOT NULL
condition_ir JSONB NOT NULL
hard BOOLEAN NOT NULL
criticality VARCHAR NOT NULL
unknown_policy VARCHAR NOT NULL
evidence_requirement JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(selection_contract_id, constraint_key)
```

## 85.7 `component_objective_definitions`

```text
id UUID PK
selection_contract_id UUID NOT NULL
objective_key VARCHAR NOT NULL
objective_type VARCHAR NOT NULL
parameter_key VARCHAR NULL
direction VARCHAR NOT NULL
target_value JSONB NULL
preference_curve JSONB NOT NULL
weight NUMERIC NULL
lexicographic_rank INT NULL
unknown_penalty JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(selection_contract_id, objective_key)
```

## 85.8 `component_catalog_items`

```text
id UUID PK
normalized_component_id UUID NOT NULL
manufacturer_id UUID NOT NULL
base_part_number VARCHAR NOT NULL
component_family_id UUID NULL
category_id UUID NOT NULL
subcategory_id UUID NULL
title VARCHAR NOT NULL
technology JSONB NOT NULL
function_tags JSONB NOT NULL
application_tags JSONB NOT NULL
current_ordering_code_id UUID NULL
lifecycle_status VARCHAR NOT NULL
catalog_status VARCHAR NOT NULL
security_classification VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(normalized_component_id)
```

## 85.9 `component_ordering_codes`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code VARCHAR NOT NULL
package_variant_id UUID NULL
temperature_grade VARCHAR NULL
speed_grade VARCHAR NULL
quality_grade VARCHAR NULL
memory_variant JSONB NULL
voltage_variant JSONB NULL
packing_option VARCHAR NULL
lead_finish VARCHAR NULL
factory_option JSONB NULL
revision VARCHAR NULL
active BOOLEAN NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(component_id, ordering_code)
```

## 85.10 `component_parameter_definitions`

```text
id UUID PK
category_id UUID NOT NULL
parameter_key VARCHAR NOT NULL
canonical_name VARCHAR NOT NULL
data_type VARCHAR NOT NULL
canonical_unit VARCHAR NULL
value_classifications JSONB NOT NULL
condition_schema JSONB NOT NULL
comparison_policy JSONB NOT NULL
hard_constraint_eligible BOOLEAN NOT NULL
objective_eligible BOOLEAN NOT NULL
display_order INT NULL
schema_version VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(category_id, parameter_key, schema_version)
```

## 85.11 `component_parameter_aliases`

```text
id UUID PK
parameter_definition_id UUID NOT NULL
alias_name VARCHAR NOT NULL
language VARCHAR NULL
manufacturer_scope UUID NULL
document_context VARCHAR NULL
confidence NUMERIC NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.12 `component_parameter_values`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
parameter_definition_id UUID NOT NULL
value_type VARCHAR NOT NULL
exact_value NUMERIC NULL
minimum_value NUMERIC NULL
typical_value NUMERIC NULL
maximum_value NUMERIC NULL
text_value TEXT NULL
enum_value JSONB NULL
unit VARCHAR NULL
tolerance JSONB NULL
conditions JSONB NOT NULL
test_method JSONB NULL
guaranteed BOOLEAN NOT NULL
value_classification VARCHAR NOT NULL
source_document_id UUID NULL
evidence_anchor_id UUID NULL
source_reference JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
approval_status VARCHAR NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 85.13 `component_source_documents`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
document_type VARCHAR NOT NULL
title VARCHAR NOT NULL
document_version VARCHAR NULL
publication_date DATE NULL
source_uri TEXT NOT NULL
source_hash CHAR(64) NOT NULL
language VARCHAR NULL
manufacturer_official BOOLEAN NOT NULL
parse_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.14 `component_evidence_anchors`

```text
id UUID PK
source_document_id UUID NOT NULL
anchor_type VARCHAR NOT NULL
page_number INT NULL
table_reference JSONB NULL
text_span JSONB NULL
figure_reference JSONB NULL
bounding_box JSONB NULL
quoted_value TEXT NULL
anchor_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 85.15 `component_lifecycle_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
lifecycle_status VARCHAR NOT NULL
recommended_for_new_design VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
effective_date DATE NULL
last_checked_at TIMESTAMPTZ NOT NULL
pcn_pdn_refs JSONB NOT NULL
longevity_program JSONB NOT NULL
estimated_horizon JSONB NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.16 `component_pcn_pdn_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_ids JSONB NOT NULL
notice_type VARCHAR NOT NULL
notice_number VARCHAR NULL
title VARCHAR NOT NULL
effective_date DATE NULL
last_order_date DATE NULL
last_ship_date DATE NULL
affected_changes JSONB NOT NULL
source_uri TEXT NOT NULL
source_hash CHAR(64) NOT NULL
impact_summary JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.17 `component_supply_snapshots`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NOT NULL
provider_id UUID NOT NULL
provider_type VARCHAR NOT NULL
region VARCHAR NOT NULL
currency VARCHAR NOT NULL
query_time TIMESTAMPTZ NOT NULL
available_stock NUMERIC NULL
factory_stock NUMERIC NULL
on_order_quantity NUMERIC NULL
reported_lead_time JSONB NULL
moq NUMERIC NULL
spq NUMERIC NULL
packaging VARCHAR NULL
price_breaks JSONB NOT NULL
valid_until TIMESTAMPTZ NULL
authorized_channel BOOLEAN NOT NULL
source_reference JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 85.18 `component_enterprise_inventory_snapshots`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NOT NULL
inventory_location_id UUID NOT NULL
query_time TIMESTAMPTZ NOT NULL
on_hand NUMERIC NOT NULL
available NUMERIC NOT NULL
reserved NUMERIC NOT NULL
quality_status VARCHAR NOT NULL
lot_summary JSONB NOT NULL
date_code_summary JSONB NOT NULL
shelf_life_summary JSONB NOT NULL
moisture_status JSONB NOT NULL
project_ownership JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 85.19 `component_price_history`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NOT NULL
provider_id UUID NOT NULL
region VARCHAR NOT NULL
currency VARCHAR NOT NULL
quantity NUMERIC NOT NULL
unit_price NUMERIC NOT NULL
price_type VARCHAR NOT NULL
packaging VARCHAR NULL
tax_context JSONB NOT NULL
shipping_context JSONB NOT NULL
quoted_at TIMESTAMPTZ NOT NULL
valid_until TIMESTAMPTZ NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.20 `component_brand_policies`

```text
id UUID PK
tenant_id UUID NULL
policy_key VARCHAR NOT NULL
manufacturer_id UUID NULL
brand_group VARCHAR NULL
role_scope JSONB NOT NULL
product_scope JSONB NOT NULL
region_scope JSONB NOT NULL
policy_status VARCHAR NOT NULL
rationale TEXT NULL
exception_policy JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, policy_key)
```

## 85.21 `component_supplier_policies`

```text
id UUID PK
tenant_id UUID NULL
policy_key VARCHAR NOT NULL
provider_id UUID NULL
provider_type VARCHAR NULL
region_scope JSONB NOT NULL
authorized_only BOOLEAN NOT NULL
approved_vendor_list JSONB NOT NULL
broker_policy VARCHAR NOT NULL
multi_distributor_policy JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, policy_key)
```

## 85.22 `component_quality_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
quality_record_type VARCHAR NOT NULL
source_type VARCHAR NOT NULL
period_start DATE NULL
period_end DATE NULL
sample_context JSONB NOT NULL
metrics JSONB NOT NULL
defect_summary JSONB NOT NULL
corrective_actions JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
security_classification VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.23 `component_compliance_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
compliance_type VARCHAR NOT NULL
compliance_status VARCHAR NOT NULL
market_scope JSONB NOT NULL
certificate_or_declaration JSONB NOT NULL
source_reference JSONB NOT NULL
effective_from DATE NULL
effective_to DATE NULL
last_checked_at TIMESTAMPTZ NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.24 `component_errata_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_ids JSONB NOT NULL
affected_revisions JSONB NOT NULL
errata_key VARCHAR NOT NULL
severity VARCHAR NOT NULL
description TEXT NOT NULL
conditions JSONB NOT NULL
hardware_impact JSONB NOT NULL
firmware_impact JSONB NOT NULL
manufacturing_impact JSONB NOT NULL
workaround JSONB NULL
source_document_id UUID NOT NULL
effective_date DATE NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(component_id, errata_key)
```

## 85.25 `component_eda_asset_records`

```text
id UUID PK
component_id UUID NOT NULL
ordering_code_id UUID NULL
asset_type VARCHAR NOT NULL
asset_reference JSONB NOT NULL
asset_version VARCHAR NULL
asset_hash CHAR(64) NULL
source_type VARCHAR NOT NULL
license_context JSONB NOT NULL
verification_status VARCHAR NOT NULL
pin_pad_mapping_status VARCHAR NOT NULL
agent20_validation_ref JSONB NULL
created_at TIMESTAMPTZ
```

## 85.26 `component_firmware_support_records`

```text
id UUID PK
component_id UUID NOT NULL
support_type VARCHAR NOT NULL
platform_scope JSONB NOT NULL
sdk_or_tool_version JSONB NOT NULL
repository_reference JSONB NULL
commit_or_release JSONB NULL
license_context JSONB NOT NULL
maintenance_status VARCHAR NOT NULL
known_issues JSONB NOT NULL
verification_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.27 `component_reference_design_links`

```text
id UUID PK
component_id UUID NOT NULL
reference_asset_version_id UUID NOT NULL
role_in_design JSONB NOT NULL
operating_conditions JSONB NOT NULL
verification_quality VARCHAR NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(component_id, reference_asset_version_id)
```

## 85.28 `component_candidate_retrieval_runs`

```text
id UUID PK
job_id UUID NOT NULL
selection_contract_id UUID NOT NULL
provider_name VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
retrieval_type VARCHAR NOT NULL
query_ir JSONB NOT NULL
index_snapshot_hash CHAR(64) NOT NULL
candidate_count INT NOT NULL
duration_ms BIGINT NOT NULL
status VARCHAR NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 85.29 `component_candidates`

```text
id UUID PK
job_id UUID NOT NULL
selection_contract_id UUID NOT NULL
component_id UUID NOT NULL
ordering_code_id UUID NULL
candidate_key VARCHAR NOT NULL
source_types JSONB NOT NULL
retrieval_run_ids JSONB NOT NULL
retrieval_scores JSONB NOT NULL
retrieval_explanation JSONB NOT NULL
admission_status VARCHAR NOT NULL
current_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, candidate_key)
```

## 85.30 `component_candidate_admission_runs`

```text
id UUID PK
candidate_id UUID NOT NULL
profile_version VARCHAR NOT NULL
identity_status VARCHAR NOT NULL
evidence_status VARCHAR NOT NULL
policy_status VARCHAR NOT NULL
package_status VARCHAR NOT NULL
lifecycle_status VARCHAR NOT NULL
security_status VARCHAR NOT NULL
findings JSONB NOT NULL
result VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.31 `component_constraint_evaluation_runs`

```text
id UUID PK
candidate_id UUID NOT NULL
selection_contract_id UUID NOT NULL
evaluation_version INT NOT NULL
profile_version VARCHAR NOT NULL
parameter_snapshot_hash CHAR(64) NOT NULL
result_summary JSONB NOT NULL
hard_fail_count INT NOT NULL
critical_unknown_count INT NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(candidate_id, evaluation_version)
```

## 85.32 `component_constraint_results`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
constraint_definition_id UUID NOT NULL
result VARCHAR NOT NULL
target_value JSONB NOT NULL
candidate_value JSONB NULL
normalized_comparison JSONB NOT NULL
condition_comparison JSONB NOT NULL
evidence_ids JSONB NOT NULL
rule_version VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.33 `component_domain_evaluations`

```text
id UUID PK
candidate_id UUID NOT NULL
domain VARCHAR NOT NULL
evaluation_version INT NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
result VARCHAR NOT NULL
metrics JSONB NOT NULL
findings JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(candidate_id, domain, evaluation_version)
```

## 85.34 `component_effective_cost_runs`

```text
id UUID PK
candidate_id UUID NOT NULL
quantity_context JSONB NOT NULL
region_context JSONB NOT NULL
currency VARCHAR NOT NULL
price_snapshot_ids JSONB NOT NULL
enterprise_inventory_snapshot_ids JSONB NOT NULL
calculation_policy_version VARCHAR NOT NULL
unit_price JSONB NOT NULL
moq_overbuy JSONB NOT NULL
spq_overbuy JSONB NOT NULL
shipping_candidate JSONB NOT NULL
tax_tariff_candidate JSONB NOT NULL
programming_cost JSONB NOT NULL
eda_creation_cost JSONB NOT NULL
firmware_port_cost JSONB NOT NULL
pcb_thermal_effect JSONB NOT NULL
quality_risk_cost JSONB NOT NULL
total_effective_cost JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.35 `component_lead_time_evaluations`

```text
id UUID PK
candidate_id UUID NOT NULL
need_by_context JSONB NOT NULL
supply_snapshot_ids JSONB NOT NULL
reported_lead_time JSONB NULL
stock_coverage JSONB NOT NULL
supplier_confirmation JSONB NULL
buffer_policy_version VARCHAR NOT NULL
fit_result VARCHAR NOT NULL
freshness_status VARCHAR NOT NULL
risk_summary JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 85.36 `component_combination_graph_versions`

```text
id UUID PK
job_id UUID NOT NULL
graph_version VARCHAR NOT NULL
candidate_set_hash CHAR(64) NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, graph_version)
```

## 85.37 `component_combination_nodes`

```text
id UUID PK
graph_version_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
component_candidate_id UUID NULL
architecture_object_ref JSONB NULL
resource_attributes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, node_key)
```

## 85.38 `component_combination_edges`

```text
id UUID PK
graph_version_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
compatibility_status VARCHAR NOT NULL
constraints JSONB NOT NULL
evidence_ids JSONB NOT NULL
repair_candidates JSONB NOT NULL
severity VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.39 `component_candidate_score_runs`

```text
id UUID PK
job_id UUID NOT NULL
selection_contract_id UUID NOT NULL
scenario_key VARCHAR NOT NULL
scoring_policy_version VARCHAR NOT NULL
candidate_snapshot_hash CHAR(64) NOT NULL
normalization_trace JSONB NOT NULL
weight_trace JSONB NOT NULL
status VARCHAR NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 85.40 `component_candidate_scores`

```text
id UUID PK
score_run_id UUID NOT NULL
candidate_id UUID NOT NULL
hard_violation_count INT NOT NULL
critical_unknown_count INT NOT NULL
score_vector JSONB NOT NULL
aggregate_score NUMERIC NULL
pareto_rank INT NULL
robustness_vector JSONB NOT NULL
explanation_trace JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(score_run_id, candidate_id)
```

## 85.41 `component_ranking_sensitivity_runs`

```text
id UUID PK
score_run_id UUID NOT NULL
sensitivity_type VARCHAR NOT NULL
perturbation_policy JSONB NOT NULL
scenario_count INT NOT NULL
ranking_stability JSONB NOT NULL
fragile_candidates JSONB NOT NULL
switch_points JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 85.42 `component_alternate_strategies`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
selection_contract_id UUID NOT NULL
strategy_key VARCHAR NOT NULL
strategy_type VARCHAR NOT NULL
primary_candidate_id UUID NOT NULL
alternate_candidate_ids JSONB NOT NULL
design_requirements JSONB NOT NULL
switching_cost JSONB NOT NULL
firmware_effect JSONB NOT NULL
pcb_effect JSONB NOT NULL
bom_effect JSONB NOT NULL
verification_effect JSONB NOT NULL
supply_benefit JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, strategy_key)
```

## 85.43 `component_validation_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
selection_contract_id UUID NOT NULL
candidate_ids JSONB NOT NULL
sample_plan JSONB NOT NULL
supplier_requirements JSONB NOT NULL
bench_tests JSONB NOT NULL
corner_tests JSONB NOT NULL
firmware_tests JSONB NOT NULL
thermal_tests JSONB NOT NULL
mechanical_tests JSONB NOT NULL
comparison_criteria JSONB NOT NULL
required_evidence JSONB NOT NULL
owner_roles JSONB NOT NULL
required_before_gate VARCHAR NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.44 `component_design_impact_graph_versions`

```text
id UUID PK
job_id UUID NOT NULL
candidate_or_strategy_ref JSONB NOT NULL
graph_version VARCHAR NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.45 `component_adaptation_work_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
selection_contract_id UUID NOT NULL
candidate_ids JSONB NOT NULL
work_package_key VARCHAR NOT NULL
work_package_type VARCHAR NOT NULL
title VARCHAR NOT NULL
scope JSONB NOT NULL
affected_objects JSONB NOT NULL
dependencies JSONB NOT NULL
owner_role VARCHAR NOT NULL
estimate_candidate JSONB NULL
target_agent VARCHAR NULL
input_gate JSONB NOT NULL
expected_outputs JSONB NOT NULL
verification_plan JSONB NOT NULL
rollback_plan JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, work_package_key)
```

## 85.46 `component_selection_review_packages`

```text
id UUID PK
job_id UUID NOT NULL
package_version INT NOT NULL
contract_summary JSONB NOT NULL
candidate_summary JSONB NOT NULL
hard_constraint_summary JSONB NOT NULL
technical_summary JSONB NOT NULL
supply_cost_summary JSONB NOT NULL
lifecycle_quality_summary JSONB NOT NULL
score_pareto_summary JSONB NOT NULL
alternate_summary JSONB NOT NULL
validation_summary JSONB NOT NULL
risk_summary JSONB NOT NULL
decision_questions JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, package_version)
```

## 85.47 `component_selection_decisions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
decision_key VARCHAR NOT NULL
job_id UUID NOT NULL
selection_contract_id UUID NOT NULL
primary_candidate_id UUID NOT NULL
alternate_strategy_id UUID NULL
experimental_candidate_ids JSONB NOT NULL
rejected_candidate_ids JSONB NOT NULL
criteria JSONB NOT NULL
hard_constraint_summary JSONB NOT NULL
score_scenarios JSONB NOT NULL
tradeoffs JSONB NOT NULL
accepted_risks JSONB NOT NULL
required_validations JSONB NOT NULL
design_impact JSONB NOT NULL
approval_manifest JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 85.48 `component_selection_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
reuse_baseline_id UUID NULL
project_baseline_id UUID NULL
selection_profile_id UUID NOT NULL
selection_contract_manifest JSONB NOT NULL
decision_manifest JSONB NOT NULL
primary_component_manifest JSONB NOT NULL
alternate_strategy_manifest JSONB NOT NULL
ordering_code_manifest JSONB NOT NULL
parameter_evidence_manifest JSONB NOT NULL
price_inventory_snapshot_manifest JSONB NOT NULL
lifecycle_snapshot_manifest JSONB NOT NULL
policy_snapshot_manifest JSONB NOT NULL
validation_plan_manifest JSONB NOT NULL
accepted_risk_manifest JSONB NOT NULL
open_question_manifest JSONB NOT NULL
approval_manifest JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, baseline_version)
```

## 85.49 `component_selection_downstream_packages`

```text
id UUID PK
selection_baseline_id UUID NOT NULL
package_type VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
target_agent VARCHAR NULL
content_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
requirement_trace JSONB NOT NULL
architecture_trace JSONB NOT NULL
component_trace JSONB NOT NULL
input_gate JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(selection_baseline_id, package_type, target_agent)
```

## 85.50 `component_selection_change_impact_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_selection_baseline_id UUID NOT NULL
requirement_change_request_id UUID NULL
architecture_change_impact_id UUID NULL
reuse_change_impact_id UUID NULL
supply_change_event JSONB NULL
lifecycle_change_event JSONB NULL
changed_contracts JSONB NOT NULL
invalidated_candidates JSONB NOT NULL
affected_decisions JSONB NOT NULL
affected_alternate_strategies JSONB NOT NULL
affected_design_objects JSONB NOT NULL
required_retrieval_scope JSONB NOT NULL
required_reverification JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_uri TEXT NOT NULL
impact_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 85.51 `component_selection_feedback_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
selection_baseline_id UUID NOT NULL
selection_contract_id UUID NOT NULL
selected_component_id UUID NOT NULL
ordering_code_id UUID NULL
feedback_type VARCHAR NOT NULL
actual_performance JSONB NOT NULL
actual_power_thermal JSONB NOT NULL
actual_firmware_effort JSONB NOT NULL
actual_eda_effort JSONB NOT NULL
actual_procurement JSONB NOT NULL
actual_quality JSONB NOT NULL
actual_manufacturing JSONB NOT NULL
field_summary JSONB NOT NULL
recommendation_quality JSONB NOT NULL
data_quality VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

---

# 86. 对象存储

```text
derived/component-selection/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          requirement-baseline.json
          architecture-baseline.json
          reuse-baseline.json
          project-baseline.json
          selection-profile.json
          input-snapshot.json
          component-catalog-snapshot.json
          parameter-schema-snapshot.json
          lifecycle-snapshot.json
          supply-snapshot.json
          quality-snapshot.json
          policy.json
        contracts/
          component-roles.jsonl.zst
          selection-contracts.jsonl.zst
          constraints.jsonl.zst
          objectives.jsonl.zst
        retrieval/
          exact/
          taxonomy/
          parametric/
          interface-graph/
          reference-design/
          semantic/
          candidate-union.parquet
          traces/
        candidates/
          admitted/
          rejected/
          needs-data/
          ordering-codes/
        parameters/
          normalized-values.parquet
          comparison-matrices/
          evidence/
          condition-comparisons/
        evaluation/
          hard-constraints/
          electrical/
          functional/
          interfaces/
          power/
          thermal/
          package/
          firmware/
          eda/
          lifecycle/
          supply/
          cost/
          compliance/
          quality/
          errata/
        combination/
          graph/
          conflicts/
          repair-candidates/
        scoring/
          scenarios/
          score-vectors.parquet
          pareto/
          sensitivity/
          robustness/
          explanations/
        alternates/
          strategies/
          switching-impact/
          dual-footprint/
          variant-bom/
        validation/
          sample-plans/
          bench-tests/
          corner-tests/
          evidence-requirements/
        design-impact/
          graphs/
          work-packages.jsonl.zst
          downstream-routes/
        review/
          review-package.html
          review-package.pdf
          candidate-comparison.csv
          hard-constraints.csv
          parameter-matrix.csv
          price-inventory.csv
          lifecycle.csv
          risks.csv
          decisions/
          approvals/
        baseline/
          component-selection-baseline.json
          release-manifest.json
          downstream-packages/
        changes/
          impact/
          reruns/
          baseline-diffs/
        feedback/
          prototype/
          production/
          field/
        debug/
          retrieval-trace.jsonl.zst
          normalization-trace.jsonl.zst
          rule-trace.jsonl.zst
          scoring-trace.jsonl.zst
          model-trace.jsonl.zst
          resource-usage.json
```

全局参数和索引：

```text
assets/component-catalog/
  taxonomy/
  parameter-schemas/
  normalized-values/
  datasheets/
  evidence/
  lifecycle/
  supply/
  eda/
  firmware/
  quality/
  compliance/
  indexes/
```

---

# 87. API 设计

## 87.1 Jobs

```text
POST /api/v1/component-selection/jobs
POST /api/v1/component-selection/jobs/batch
GET  /api/v1/component-selection/jobs/{id}
GET  /api/v1/component-selection/jobs/{id}/events
POST /api/v1/component-selection/jobs/{id}/cancel
POST /api/v1/component-selection/jobs/{id}/retry
POST /api/v1/component-selection/jobs/{id}/rerun
```

## 87.2 Readiness and Snapshot

```text
POST /api/v1/component-selection/jobs/{id}/validate-readiness
GET  /api/v1/component-selection/jobs/{id}/readiness
POST /api/v1/component-selection/jobs/{id}/freeze-input
GET  /api/v1/component-selection/jobs/{id}/input-snapshot
```

## 87.3 Profiles and Policies

```text
POST /api/v1/component-selection/profiles
GET  /api/v1/component-selection/profiles
GET  /api/v1/component-selection/profiles/{id}
POST /api/v1/component-selection/profiles/{id}/validate
POST /api/v1/component-selection/profiles/{id}/approve
POST /api/v1/component-selection/profiles/{id}/deprecate
GET  /api/v1/component-selection/policies
```

## 87.4 Roles and Contracts

```text
POST /api/v1/component-selection/jobs/{id}/build-roles
GET  /api/v1/component-selection/jobs/{id}/roles
POST /api/v1/component-selection/jobs/{id}/build-contracts
GET  /api/v1/component-selection/jobs/{id}/contracts
GET  /api/v1/component-selection/contracts/{id}
PATCH /api/v1/component-selection/contracts/{id}
POST /api/v1/component-selection/contracts/{id}/approve
POST /api/v1/component-selection/contracts/{id}/validate
```

## 87.5 Catalog and Parameters

```text
GET  /api/v1/components/{id}
GET  /api/v1/components/{id}/ordering-codes
GET  /api/v1/components/{id}/parameters
GET  /api/v1/components/{id}/documents
GET  /api/v1/components/{id}/evidence
GET  /api/v1/component-categories
GET  /api/v1/component-parameter-schemas/{category_id}
POST /api/v1/component-parameters/normalize
POST /api/v1/component-parameters/review
```

## 87.6 Retrieval

```text
POST /api/v1/component-selection/contracts/{id}/retrieve
GET  /api/v1/component-selection/contracts/{id}/retrieval-runs
GET  /api/v1/component-selection/contracts/{id}/candidates
POST /api/v1/component-selection/contracts/{id}/rerank
```

## 87.7 Admission and Evidence

```text
POST /api/v1/component-selection/candidates/{id}/validate-admission
POST /api/v1/component-selection/candidates/{id}/admit
POST /api/v1/component-selection/candidates/{id}/reject
GET  /api/v1/component-selection/candidates/{id}/admission-findings
POST /api/v1/component-selection/candidates/{id}/request-data
```

## 87.8 Constraint Evaluation

```text
POST /api/v1/component-selection/candidates/{id}/evaluate-hard-constraints
GET  /api/v1/component-selection/candidates/{id}/constraint-results
POST /api/v1/component-selection/contracts/{id}/evaluate-all
GET  /api/v1/component-selection/contracts/{id}/hard-constraint-matrix
```

## 87.9 Domain Evaluation

```text
POST /api/v1/component-selection/candidates/{id}/evaluate-electrical
POST /api/v1/component-selection/candidates/{id}/evaluate-functional
POST /api/v1/component-selection/candidates/{id}/evaluate-interface
POST /api/v1/component-selection/candidates/{id}/evaluate-power
POST /api/v1/component-selection/candidates/{id}/evaluate-thermal
POST /api/v1/component-selection/candidates/{id}/evaluate-package
POST /api/v1/component-selection/candidates/{id}/evaluate-firmware
POST /api/v1/component-selection/candidates/{id}/evaluate-eda
POST /api/v1/component-selection/candidates/{id}/evaluate-lifecycle
POST /api/v1/component-selection/candidates/{id}/evaluate-supply
POST /api/v1/component-selection/candidates/{id}/evaluate-compliance
POST /api/v1/component-selection/candidates/{id}/evaluate-quality
GET  /api/v1/component-selection/candidates/{id}/evaluations
```

## 87.10 Price, Inventory and Lead Time

```text
POST /api/v1/components/{id}/refresh-supply
GET  /api/v1/components/{id}/supply-snapshots
GET  /api/v1/components/{id}/price-history
GET  /api/v1/components/{id}/enterprise-inventory
POST /api/v1/component-selection/candidates/{id}/calculate-effective-cost
POST /api/v1/component-selection/candidates/{id}/evaluate-lead-time
```

## 87.11 Lifecycle and Errata

```text
POST /api/v1/components/{id}/refresh-lifecycle
GET  /api/v1/components/{id}/lifecycle
GET  /api/v1/components/{id}/pcn-pdn
GET  /api/v1/components/{id}/errata
POST /api/v1/component-selection/candidates/{id}/review-errata
```

## 87.12 Combination Evaluation

```text
POST /api/v1/component-selection/jobs/{id}/build-combination-graph
GET  /api/v1/component-selection/jobs/{id}/combination-graph
POST /api/v1/component-selection/jobs/{id}/validate-combinations
GET  /api/v1/component-selection/jobs/{id}/combination-conflicts
POST /api/v1/component-selection/jobs/{id}/combination-repair-candidates
```

## 87.13 Scoring, Pareto and Sensitivity

```text
POST /api/v1/component-selection/contracts/{id}/score
GET  /api/v1/component-selection/contracts/{id}/scores
POST /api/v1/component-selection/contracts/{id}/build-pareto
GET  /api/v1/component-selection/contracts/{id}/pareto
POST /api/v1/component-selection/contracts/{id}/sensitivity
GET  /api/v1/component-selection/contracts/{id}/sensitivity
GET  /api/v1/component-selection/contracts/{id}/comparison
```

## 87.14 Alternate Strategy

```text
POST /api/v1/component-selection/contracts/{id}/alternate-strategies
GET  /api/v1/component-selection/contracts/{id}/alternate-strategies
GET  /api/v1/component-selection/alternate-strategies/{id}
POST /api/v1/component-selection/alternate-strategies/{id}/approve
```

## 87.15 Validation and Work Packages

```text
POST /api/v1/component-selection/contracts/{id}/validation-plan
GET  /api/v1/component-selection/contracts/{id}/validation-plan
POST /api/v1/component-selection/jobs/{id}/build-design-impact
GET  /api/v1/component-selection/jobs/{id}/design-impact
POST /api/v1/component-selection/jobs/{id}/generate-work-packages
GET  /api/v1/component-selection/jobs/{id}/work-packages
```

## 87.16 Review and Decision

```text
POST /api/v1/component-selection/jobs/{id}/review-package
GET  /api/v1/component-selection/jobs/{id}/review-package
POST /api/v1/component-selection/jobs/{id}/submit-review
POST /api/v1/component-selection/contracts/{id}/decision
GET  /api/v1/component-selection/contracts/{id}/decision
POST /api/v1/component-selection/decisions/{id}/approve
```

## 87.17 Baseline and Downstream

```text
POST /api/v1/component-selection/jobs/{id}/baseline-candidates
GET  /api/v1/projects/{project_id}/component-selection-baselines
GET  /api/v1/component-selection/baselines/{id}
POST /api/v1/component-selection/baselines/{id}/approve
POST /api/v1/component-selection/baselines/{id}/freeze
GET  /api/v1/component-selection/baselines/{id}/manifest
POST /api/v1/component-selection/baselines/{id}/generate-downstream-packages
GET  /api/v1/component-selection/baselines/{id}/downstream-packages
```

## 87.18 Changes and Feedback

```text
POST /api/v1/component-selection/baselines/{id}/analyze-change
GET  /api/v1/component-selection/change-impacts/{id}
POST /api/v1/component-selection/baselines/{id}/feedback
GET  /api/v1/component-selection/jobs/{id}/report
GET  /api/v1/component-selection/jobs/{id}/candidate-comparison.csv
GET  /api/v1/component-selection/jobs/{id}/parameter-matrix.csv
GET  /api/v1/component-selection/jobs/{id}/price-inventory.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 88. 输入事件

```text
requirements.baseline-frozen
requirements.change-impact-ready
architecture.baseline-frozen
architecture.change-impact-ready
reuse.baseline-frozen
project-planning.component-selection-task-ready
component-catalog.updated
component-parameters.updated
component-lifecycle.updated
component-pcn-pdn.updated
component-supply.updated
enterprise-inventory.updated
quality-data.updated
brand-policy.updated
component-selection.requested
```

---

# 89. 输出事件

```text
component-selection.input-blocked
component-selection.contracts-ready
component-selection.no-candidate-found
component-selection.data-required
component-selection.hard-constraint-blocked
component-selection.lifecycle-review-required
component-selection.supply-confirmation-required
component-selection.validation-required
component-selection.candidates-ready
component-selection.review-required
component-selection.decision-required
component-selection.baseline-candidate-ready
component-selection.baseline-frozen
component-selection.change-impact-ready
component-selection.downstream-packages-ready
component-selection.completed
component-selection.failed
```

---

# 90. 下游事件

```text
project-planning.component-work-packages-ready
architecture.component-candidate-ready
reference-reuse.component-impact-ready
schematic.component-package-ready
firmware.platform-package-ready
eda.library-package-ready
simulation.component-model-package-ready
pcb.component-constraint-package-ready
bom.component-selection-baseline-ready
procurement.sample-plan-ready
```

---

# 91. Policy 组织

```text
policies/
├── component-selection-1.0.0.yaml
├── readiness-gates.yaml
├── profiles/
│   ├── product-categories.yaml
│   ├── project-phases.yaml
│   ├── component-roles.yaml
│   └── criticality.yaml
├── contracts/
│   ├── role-to-constraints.yaml
│   ├── architecture-mapping.yaml
│   ├── hard-constraints.yaml
│   ├── objectives.yaml
│   └── unknowns.yaml
├── parameters/
│   ├── canonical-names.yaml
│   ├── aliases.yaml
│   ├── units.yaml
│   ├── conditions.yaml
│   ├── value-classification.yaml
│   └── comparison.yaml
├── retrieval/
│   ├── identity.yaml
│   ├── taxonomy.yaml
│   ├── parametric.yaml
│   ├── interface-graph.yaml
│   ├── reference-design.yaml
│   ├── semantic.yaml
│   ├── candidate-union.yaml
│   └── rerank.yaml
├── evaluation/
│   ├── electrical.yaml
│   ├── functional.yaml
│   ├── interfaces.yaml
│   ├── power.yaml
│   ├── thermal.yaml
│   ├── package.yaml
│   ├── firmware.yaml
│   ├── eda.yaml
│   ├── lifecycle.yaml
│   ├── supply.yaml
│   ├── compliance.yaml
│   ├── quality.yaml
│   └── errata.yaml
├── category-specific/
│   ├── processor.yaml
│   ├── adc-dac.yaml
│   ├── analog.yaml
│   ├── power.yaml
│   ├── clock.yaml
│   ├── memory.yaml
│   ├── connector.yaml
│   ├── protection.yaml
│   └── passive.yaml
├── derating/
│   ├── voltage.yaml
│   ├── current.yaml
│   ├── power.yaml
│   ├── thermal.yaml
│   └── passives.yaml
├── supply/
│   ├── providers.yaml
│   ├── freshness.yaml
│   ├── authorized-channels.yaml
│   ├── effective-cost.yaml
│   ├── lead-time.yaml
│   └── enterprise-inventory.yaml
├── lifecycle/
│   ├── statuses.yaml
│   ├── product-horizon.yaml
│   ├── pcn-pdn.yaml
│   └── unknowns.yaml
├── brands/
│   ├── preferences.yaml
│   ├── restrictions.yaml
│   └── exceptions.yaml
├── combinations/
│   ├── voltage.yaml
│   ├── protocols.yaml
│   ├── clocks.yaml
│   ├── power-sequence.yaml
│   ├── resources.yaml
│   └── thermal-placement.yaml
├── scoring/
│   ├── scenarios.yaml
│   ├── normalization.yaml
│   ├── weights.yaml
│   ├── penalties.yaml
│   ├── pareto.yaml
│   ├── sensitivity.yaml
│   └── robustness.yaml
├── alternates/
│   ├── strategies.yaml
│   ├── drop-in.yaml
│   ├── dual-footprint.yaml
│   ├── variant-bom.yaml
│   └── switching-cost.yaml
├── validation.yaml
├── baseline.yaml
├── changes.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 92. Parameter Provider 接口

```python
class ComponentParameterProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def get_identity(self, component_ref) -> ComponentIdentity: ...
    async def get_parameters(self, component_ref, schema) -> ParameterSet: ...
    async def get_evidence(self, parameter_value) -> EvidenceSet: ...
    async def explain(self, result) -> ParameterTrace: ...
```

Provider：

```text
normalized_enterprise_database
manufacturer_structured_data
manufacturer_document
authorized_distributor
deterministic_datasheet_parser
model_assisted_extraction
manual
```

---

# 93. Candidate Retrieval Provider

```python
class ComponentCandidateRetrievalProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def retrieve(self, selection_contract, snapshot) -> CandidateSet: ...
    async def explain(self, candidate) -> RetrievalTrace: ...
```

Provider：

```text
identity
taxonomy
parametric
interface_graph
reference_design
module_relation
semantic
historical_approved
```

---

# 94. Evaluation Provider

```python
class ComponentEvaluationProvider:
    async def validate_input(self, contract, candidate) -> ValidationResult: ...
    async def evaluate(self, contract, candidate) -> DomainEvaluation: ...
    async def explain(self, evaluation) -> EvaluationTrace: ...
```

领域：

```text
hard_constraints
electrical
functional
interface
power
thermal
package
firmware
eda
lifecycle
supply
cost
compliance
quality
errata
```

---

# 95. Supply Provider

```python
class ComponentSupplyProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def fetch_stock(self, ordering_code, region) -> SupplySnapshot: ...
    async def fetch_prices(self, ordering_code, region, quantities) -> PriceSnapshot: ...
    async def fetch_lead_time(self, ordering_code, region) -> LeadTimeSnapshot: ...
```

所有响应必须保存：

```text
provider
authorization class
query time
region
currency
ordering code
packaging
validity
raw response hash
```

---

# 96. Ranking Engine

```python
class ComponentRankingProvider:
    async def filter_hard_constraints(self, request) -> FilterResult: ...
    async def calculate_scores(self, request) -> ScoreResult: ...
    async def build_pareto(self, request) -> ParetoResult: ...
    async def run_sensitivity(self, request) -> SensitivityResult: ...
    async def explain(self, result) -> RankingTrace: ...
```

---

# 97. Candidate Review Workbench

界面建议：

```text
左：Roles / Contracts / Filters / Saved Scenarios
中：Candidate Table / Parallel Coordinates / Pareto / Combination Graph
右：Parameters / Evidence / Package / Firmware / Supply / Risk
下：Hard Constraints / Sensitivity / Alternates / Validation / Decision / Baseline
```

---

# 98. Review 操作

```text
查看 Selection Contract
切换 Hard/Soft
修改批准范围内的权重
比较 Min/Typ/Max 和条件
打开 Datasheet Evidence
查看 Package/Pin/EDA
刷新价格和库存
查看 Lifecycle/PCN/Errata
比较 Ranking Scenario
运行 Sensitivity
创建 Alternate Strategy
创建 Sample Validation
批准或拒绝候选
冻结 Selection Baseline
```

---

# 99. 可观测性

```text
component_selection_jobs_total{status,profile}
component_selection_job_duration_seconds{step}
component_selection_contracts_total{role,status}
component_candidates_total{role,status}
component_hard_constraint_results_total{result,constraint}
component_parameter_unknown_ratio{category,parameter}
component_supply_snapshot_age_seconds{provider}
component_lifecycle_unknown_total{category}
component_price_snapshot_total{provider,region}
component_candidate_scores_distribution{scenario,criterion}
component_pareto_candidates_total{role}
component_ranking_fragility_total{role}
component_alternate_strategies_total{type,status}
component_validation_plans_total{status}
component_selection_baselines_total{status}
component_external_model_calls_total{provider,status}
```

---

# 100. Dashboard

```text
Projects
Selection Readiness
Component Roles
Selection Contracts
Candidate Funnel
Hard Constraint Failures
Parameter Coverage
Price and Inventory Freshness
Lifecycle and PCN
Brand/Supplier Policy
Package and EDA Readiness
Firmware Ecosystem
Quality and Errata
Combination Conflicts
Pareto
Sensitivity
Alternates
Validation
Decisions
Baselines
Actual Feedback
```

---

# 101. 安全与权限

- 企业 BOM、采购价格、供应商协议、库存、质量和客户用途按租户/项目隔离；
- Datasheet、参数和公开目录可共享，企业价格和质量不可跨租户；
- 价格库存接口凭证只在 Connector/Worker 内使用，不进入 Prompt 和普通日志；
- 外部模型只接收最小化、脱敏后的参数语义，不接收完整 BOM 和供应商数据；
- Component Search Query 防止用户文本覆盖系统硬约束；
- Datasheet、HTML、CSV、API 响应和压缩包视为不可信输入；
- 防止 Spreadsheet Formula Injection、HTML Script、Archive Path Traversal 和 XML Entity Expansion；
- 参数表达式采用受限 IR，不执行任意代码；
- Ranking Policy、Brand Policy、Supplier Policy 和 Exception 需要权限；
- Engineer、Supply Chain、Quality、Legal 和 Approver 权限分开；
- Candidate Review 和 Selection Baseline Approval 分开；
- Sample Procurement、Purchase Order 和 Agent 19 EDA 写入需要独立审批；
- Lifecycle、Price、Supply、Quality 和 Parameter 记录不可硬删除；
- 每个 Selection Baseline 保存完整 Policy、Snapshot、Evidence 和 Hash；
- 公开 Fixture 仅使用开源、合成、脱敏或授权数据；
- 不将企业历史价格、质量缺陷或供应商评分用于公开 Benchmark。

---

# 102. 推荐技术栈

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

数据和检索：

```text
Polars
PyArrow
DuckDB
PostgreSQL range indexes
full-text search
pgvector or approved vector store
typed graph in PostgreSQL first
```

数值：

```text
Decimal
Pint or controlled unit registry
safe condition expression evaluator
```

优化：

```text
deterministic filters
Pareto algorithms
OR-Tools optional for component-set optimization
sensitivity engine
```

前端：

```text
React
TypeScript
Candidate Comparison Grid
Evidence Viewer
Pareto Plot
Sensitivity View
Supply Snapshot
Combination Graph
```

---

# 103. 推荐仓库结构

```text
component-selection-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── component-selection-agent-spec.md
│   ├── input-and-selection-contracts.md
│   ├── component-identity-and-ordering-codes.md
│   ├── parameter-and-condition-model.md
│   ├── candidate-retrieval.md
│   ├── hard-constraint-evaluation.md
│   ├── category-specific-evaluation.md
│   ├── package-eda-and-firmware.md
│   ├── lifecycle-and-pcn.md
│   ├── price-inventory-and-lead-time.md
│   ├── brand-supplier-and-quality-policy.md
│   ├── combination-compatibility.md
│   ├── scoring-pareto-and-sensitivity.md
│   ├── alternate-strategy.md
│   ├── validation-and-design-impact.md
│   ├── baselines-and-changes.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-selection-contract-drives-search.md
│       ├── 0002-hard-constraints-precede-ranking.md
│       ├── 0003-conditions-and-evidence-are-first-class.md
│       ├── 0004-ordering-code-binds-supply.md
│       ├── 0005-current-stock-is-not-lifecycle.md
│       ├── 0006-ai-proposes-but-does-not-select.md
│       └── 0007-selection-baselines-are-immutable.md
├── src/
│   └── component_selection/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent10.py
│       │   ├── agent11.py
│       │   ├── agent12.py
│       │   ├── agent13.py
│       │   ├── components.py
│       │   ├── eda.py
│       │   ├── firmware.py
│       │   ├── supply.py
│       │   ├── inventory.py
│       │   ├── quality.py
│       │   └── downstream.py
│       ├── intake/
│       │   ├── readiness.py
│       │   ├── snapshots.py
│       │   ├── roles.py
│       │   └── contracts.py
│       ├── catalog/
│       │   ├── identity.py
│       │   ├── ordering_codes.py
│       │   ├── taxonomy.py
│       │   ├── documents.py
│       │   └── evidence.py
│       ├── parameters/
│       │   ├── schemas.py
│       │   ├── aliases.py
│       │   ├── normalize.py
│       │   ├── conditions.py
│       │   ├── classify.py
│       │   ├── compare.py
│       │   └── extraction.py
│       ├── retrieval/
│       │   ├── providers.py
│       │   ├── identity.py
│       │   ├── taxonomy.py
│       │   ├── parametric.py
│       │   ├── interface_graph.py
│       │   ├── references.py
│       │   ├── semantic.py
│       │   ├── union.py
│       │   └── rerank.py
│       ├── admission/
│       │   ├── identity.py
│       │   ├── evidence.py
│       │   ├── policies.py
│       │   └── findings.py
│       ├── evaluation/
│       │   ├── hard_constraints.py
│       │   ├── electrical.py
│       │   ├── functional.py
│       │   ├── interfaces.py
│       │   ├── power.py
│       │   ├── thermal.py
│       │   ├── package.py
│       │   ├── firmware.py
│       │   ├── eda.py
│       │   ├── lifecycle.py
│       │   ├── supply.py
│       │   ├── compliance.py
│       │   ├── quality.py
│       │   └── errata.py
│       ├── categories/
│       │   ├── processor.py
│       │   ├── adc_dac.py
│       │   ├── analog.py
│       │   ├── power.py
│       │   ├── clock.py
│       │   ├── memory.py
│       │   ├── connector.py
│       │   ├── protection.py
│       │   └── passive.py
│       ├── supply/
│       │   ├── providers.py
│       │   ├── snapshots.py
│       │   ├── prices.py
│       │   ├── lead_time.py
│       │   ├── enterprise_inventory.py
│       │   └── effective_cost.py
│       ├── lifecycle/
│       │   ├── registry.py
│       │   ├── pcn_pdn.py
│       │   ├── horizons.py
│       │   └── freshness.py
│       ├── combinations/
│       │   ├── graph.py
│       │   ├── voltage.py
│       │   ├── protocols.py
│       │   ├── clocks.py
│       │   ├── power_sequence.py
│       │   ├── resources.py
│       │   └── thermal.py
│       ├── scoring/
│       │   ├── scenarios.py
│       │   ├── normalize.py
│       │   ├── weights.py
│       │   ├── penalties.py
│       │   ├── pareto.py
│       │   ├── sensitivity.py
│       │   ├── robustness.py
│       │   └── explain.py
│       ├── alternates/
│       │   ├── strategies.py
│       │   ├── drop_in.py
│       │   ├── dual_footprint.py
│       │   ├── variant_bom.py
│       │   └── switching_cost.py
│       ├── validation/
│       ├── impact/
│       ├── decisions/
│       ├── baselines/
│       ├── changes/
│       ├── feedback/
│       ├── downstream/
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── selection-profiles/
├── category-schemas/
├── indexes/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_component_selection_readiness.py
    ├── build_selection_contracts.py
    ├── retrieve_component_candidates.py
    ├── evaluate_component_candidate.py
    ├── refresh_component_supply.py
    ├── rank_component_candidates.py
    ├── build_alternate_strategies.py
    ├── freeze_component_selection_baseline.py
    ├── analyze_component_selection_change.py
    └── run_component_selection_benchmark.py
```


---

# 104. Codex 分阶段实施

不要让 Codex 一次实现 110 万器件参数归一化、搜索、价格库存、生命周期、热评估、组合兼容、Pareto、备选策略和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 10 Requirement Baseline、Constraint、Goal、Variant、Acceptance Criteria 和 Change；
2. Agent 11 Component Selection Work Package、Gate、Budget、Schedule、Risk 和 Project Baseline；
3. Agent 12 Function、Block、Port、Interface、Power、Mode、Budget 和 Architecture Baseline；
4. Agent 13 Reuse Baseline、Source Components、Modification Scope 和 Verification Evidence；
5. 当前约 110 万型号的元器件数据库结构、分类、参数、Datasheet 和厂商链接；
6. 当前 Category/Subcategory/Taxonomy 和每类参数模板；
7. 当前 MPN、Base Part、Ordering Code、Package Variant 和 Manufacturer Identity；
8. 当前 PDF/HTML/厂商结构化参数抽取和 Evidence Anchor；
9. 当前 Symbol、Footprint、3D、Pin-Pad、IBIS、SPICE 和 STEP 数据；
10. 当前 Lifecycle、PCN/PDN、NRND/EOL 和 Product Longevity 数据；
11. 当前授权分销商价格、库存、MOQ、SPQ、区域、货币和交期接口；
12. 当前企业库存、采购历史、合同价、供应商、Lot 和质量数据；
13. 当前 Brand Preference、AVL、禁用厂商、授权渠道和地区 Policy；
14. 当前 Firmware SDK、BSP、Driver、Toolchain、RTOS 和 Ecosystem 数据；
15. 当前 Reference Design、Module、Historical Selection 和实际使用反馈；
16. 当前 Compliance、Quality、Errata、来料、生产和 Field Return 数据；
17. 当前参数检索、全文检索、向量检索、图谱和范围索引；
18. 当前器件比较、评分、推荐、替代和多目标优化逻辑；
19. 当前单位、范围、条件、Min/Typ/Max 和 Absolute Maximum 表达；
20. 当前价格、库存、生命周期和参数数据 Freshness；
21. 当前主选、备选、Dual Footprint、Variant BOM 和切换成本；
22. 当前 Component Combination、Power、Clock、Pin、Firmware 和 Package 兼容；
23. 当前 Agent 20/21/22/23/24/25/27/28/29/30/31–45 契约；
24. 当前 Review UI、Comparison、Evidence Viewer、Pareto 和 Sensitivity；
25. 当前 API、Queue、Worker、Database、Object Storage 和 Security；
26. 当前开源、合成、脱敏或授权 Fixture；
27. 统计各分类参数覆盖率、单位覆盖率和 Evidence 覆盖率；
28. 统计 Lifecycle Unknown、Ordering Code 缺失和 Supply Snapshot 过期；
29. 统计推荐采纳率、误推荐、被退回原因和实际设计返工；
30. 统计价格排名与总成本、交期、质量和生命周期之间的偏差；
31. 统计 Pin/Footprint/SDK/热问题导致的选型变更；
32. 只运行只读扫描、安全查询和公开 Fixture；
33. 不修改元器件主数据；
34. 不刷新生产价格库存接口；
35. 不创建真实样品或采购请求；
36. 不修改 EDA 工程；
37. 不冻结 Selection Baseline；
38. 不创建 Migration；
39. 不安装搜索、单位、优化或模型组件；
40. 不调用生产外部模型；
41. 不读取或打印 API Key、合同价、客户 BOM 和供应商协议。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Selection Job；
- Input Snapshot；
- Profile；
- Role；
- Contract；
- Constraint；
- Objective；
- Component/Ordering Code；
- Parameter Definition/Alias/Value；
- Source Document/Evidence；
- Lifecycle/PCN-PDN；
- Supply/Inventory/Price；
- Brand/Supplier Policy；
- Quality/Compliance/Errata；
- EDA/Firmware/Reference Links；
- Retrieval Run/Candidate；
- Admission；
- Constraint Evaluation；
- Domain Evaluation；
- Effective Cost；
- Lead-time；
- Combination Graph；
- Score/Sensitivity；
- Alternate Strategy；
- Validation Plan；
- Design Impact；
- Work Package；
- Review/Decision；
- Baseline；
- Downstream Package；
- Change Impact；
- Feedback；
- JSON Schema。

## Phase 2：Selection Input Gate

实现：

- Agent 10 Baseline；
- Agent 12 Baseline；
- Agent 11 Task/Gate；
- Agent 13 Reuse Context optional；
- Project/Variant；
- Product Horizon；
- Quantity/Cost Context；
- Region/Market；
- Enterprise Policy；
- Catalog/Parameter/Lifecycle/Supply Freshness；
- Immutable Snapshot；
- Draft-only/Review-ready；
- Diagnostics。

## Phase 3：Selection Profile Registry

实现：

- Product Category；
- Project Phase；
- Component Roles；
- Required Evaluations；
- Hard Constraint Policy；
- Objective Scenarios；
- Unknown Policy；
- Supply/Lifecycle/Brand/Quality；
- Approval；
- Version/Effective Date；
- Validation/Deprecation。

## Phase 4：Component Role Builder

实现：

- Architecture Block-to-Role；
- Interface-to-Role；
- Power Node-to-Role；
- Criticality；
- Variant；
- Shared Component；
- Fixed Component；
- Reused Component；
- New Selection；
- Stable Role Keys；
- Requirement Trace。

## Phase 5：Selection Contract Builder

实现：

- Required Functions；
- Hard Constraints；
- Soft Objectives；
- Interfaces；
- Power/Thermal；
- Package/Mechanical；
- Firmware/EDA；
- Lifecycle/Supply/Cost；
- Brand/Compliance/Quality；
- Verification；
- Evidence；
- Candidate Status；
- Human Review。

## Phase 6：Component Identity and Ordering Codes

实现：

- Manufacturer；
- Base Part；
- Ordering Code；
- Package/Temperature/Speed/Quality；
- Packing；
- Lead Finish；
- Revision；
- Aliases；
- MPN Normalization；
- Duplicate Detection；
- Family Relations；
- Tests。

## Phase 7：Taxonomy Registry

实现：

- Category/Subcategory；
- Function/Application/Interface；
- Technology；
- Package；
- Quality Grade；
- Multi-label；
- Version；
- Mapping；
- Unknown/Other；
- Migration Plan；
- No Silent Reclassification。

## Phase 8：Parameter Schema Registry

实现：

- Category-specific Parameters；
- Canonical Names；
- Data Types；
- Units；
- Value Classes；
- Conditions；
- Comparison Policy；
- Hard/Objective Eligibility；
- Version；
- Approval；
- Schema Tests。

## Phase 9：Parameter Alias and Terminology

实现：

- Manufacturer-specific Names；
- Abbreviations；
- Languages；
- Document Context；
- Approved Aliases；
- Candidate Alias；
- Conflict；
- Lookup；
- No Unreviewed Auto-merge。

## Phase 10：Unit and Quantity Normalization

实现：

- Decimal；
- Canonical Units；
- Original Units；
- Conversion Trace；
- Prefixes；
- Temperature；
- Frequency；
- Data Rate；
- Power/Energy；
- Noise Units；
- Logarithmic Units；
- Missing Unit；
- Property Tests。

## Phase 11：Value Classification and Conditions

实现：

- Absolute Maximum；
- Recommended；
- Guaranteed；
- Typical；
- Characterization；
- Derived；
- Marketing；
- Condition IR；
- Test Method；
- Min/Typ/Max；
- No Cross-condition Direct Comparison。

## Phase 12：Deterministic Parameter Ingestion

实现：

- Existing Structured Data；
- Manufacturer Tables；
- CSV/API；
- Datasheet Tables；
- Evidence Anchors；
- Version Binding；
- Effective Dates；
- Validation；
- Reject Invalid Units；
- Golden Fixtures。

## Phase 13：Model-assisted Parameter Extraction

实现：

- Source-bounded Context；
- Category Schema；
- Structured Output；
- Evidence IDs；
- Value Classification；
- Conditions；
- Confidence；
- No Unsupported Values；
- Candidate-only；
- Review Queue；
- Cost/Provider Metrics。

## Phase 14：Parameter Review and Merge

实现：

- Source Precedence；
- Same-condition Merge；
- Condition Conflict；
- Datasheet Version；
- Product Page Diff；
- Manual Override；
- Supersession；
- Audit；
- No Destructive Overwrite。

## Phase 15：Lifecycle and PCN/PDN Registry

实现：

- Status；
- RNDF/New Design；
- Effective Date；
- PCN/PDN；
- Last Order/Ship；
- Product Longevity；
- Sources；
- Freshness；
- Conflict；
- Unknown；
- Events。

## Phase 16：Supply Snapshot Adapters

实现：

- Provider Abstraction；
- Ordering Code；
- Region/Currency；
- Stock；
- Factory Stock；
- On-order；
- Lead-time；
- MOQ/SPQ；
- Packaging；
- Price Breaks；
- Query Time；
- Raw Hash；
- Error/Rate Limit；
- No Cross-code Merge。

## Phase 17：Enterprise Inventory and Procurement History

实现：

- Location；
- Available/Reserved；
- Lot/Date Code；
- Quality；
- Shelf Life/MSL；
- Ownership；
- Historical Prices；
- Approved Suppliers；
- Access Control；
- Snapshot；
- No Auto Consumption。

## Phase 18：Brand and Supplier Policy

实现：

- Preferred/Approved/Restricted/Prohibited；
- Role/Product/Region Scope；
- Strategic Partner；
- Authorized-only；
- AVL；
- Broker Policy；
- Exceptions；
- Approval；
- Effective Dates；
- Audit。

## Phase 19：Compliance, Quality and Errata

实现：

- Compliance Records；
- Market Scope；
- Certificates/Declarations；
- Enterprise Quality；
- Sample Context；
- Defects/Returns；
- Errata；
- Affected Revisions；
- Workarounds；
- Critical Gate；
- Confidence。

## Phase 20：EDA Asset Registry Integration

实现：

- Symbol；
- Footprint；
- 3D；
- Pin-Pad；
- IBIS/SPICE/STEP；
- Source/Version/Hash；
- Verification；
- License；
- Agent 20 Contract；
- Missing Asset Finding；
- No Auto Creation。

## Phase 21：Firmware Ecosystem Registry

实现：

- SDK；
- Driver；
- BSP；
- Toolchain；
- RTOS/Linux；
- Examples；
- Repository/Release；
- Maintenance；
- Known Issues；
- License；
- Agent 21 Contract；
- Evidence。

## Phase 22：Identity and Taxonomy Retrieval

实现：

- Exact MPN；
- Family；
- Alias；
- Category；
- Function Tags；
- Manufacturer；
- Approved/Preferred；
- Stable Results；
- ACL；
- Trace；
- Pagination。

## Phase 23：Parametric Range Retrieval

实现：

- Boolean Capabilities；
- Numeric Ranges；
- Enumeration；
- Conditions；
- Unit Conversion；
- Min/Max/Guaranteed；
- Unknown Policy；
- Range Index；
- Query Explain；
- Performance Tests。

## Phase 24：Interface and Reference Graph Retrieval

实现：

- Required Protocols；
- Roles；
- Voltage；
- Reference Designs；
- Modules；
- Historical Approved；
- Component Family；
- Graph Query；
- Candidate Evidence；
- No Compatibility Pass Yet。

## Phase 25：Semantic Candidate Retrieval

实现：

- Bounded Summaries；
- Application Descriptions；
- Functional Language；
- Local/Private Embeddings；
- Evidence IDs；
- ACL；
- Candidate-only；
- No Numeric Decision；
- Model Version/Rollback。

## Phase 26：Candidate Union and Deduplication

实现：

- Component/Ordering Code Identity；
- Family Expansion；
- Duplicate Sources；
- Source Diversity；
- Retrieval Trace；
- Stable Candidate Key；
- Limits；
- Time Budget；
- Partial Results。

## Phase 27：Candidate Admission

实现：

- Identity；
- Ordering Code；
- Datasheet/Evidence；
- Policy；
- Package；
- Lifecycle；
- Security；
- Basic Function；
- Admit/Reject/Needs Data；
- Findings；
- Review Workflow。

## Phase 28：Hard Constraint Engine

实现：

- Typed Constraints；
- Operators；
- Conditions；
- Guaranteed/Recommended；
- Evidence Requirement；
- Pass/Fail/Unknown；
- Hard Block；
- Batch Matrix；
- Rule Trace；
- Deterministic Replay。

## Phase 29：Functional and Interface Evaluation

实现：

- Function/Mode；
- Channel/Resolution；
- Protocol/Version；
- Role/Direction；
- Voltage/Speed；
- Timing/Data Format；
- Error/Reset/Interrupt；
- Adapter Candidate；
- Hard Conflicts；
- Evidence。

## Phase 30：Category-specific Evaluators

实现优先顺序：

```text
processor
adc_dac
power
analog
memory
clock
connector
protection
passive
```

每类：

- Schema；
- Hard Rules；
- Soft Objectives；
- Conditions；
- Derived Metrics；
- Warnings；
- Verification Needs；
- Golden Tests。

## Phase 31：Derating and Reliability Evaluation

实现：

- Voltage/Current/Power；
- Thermal；
- Capacitor Bias；
- Inductor Saturation；
- Connector Margin；
- Product Grade；
- Enterprise Policy；
- Calculation Trace；
- Unknown；
- No Universal Defaults。

## Phase 32：Power and Thermal Evaluation

实现：

- Operating/Sleep/Peak/Inrush；
- Efficiency；
- Rail Compatibility；
- Thermal Inputs；
- θ Values and Conditions；
- Board/Airflow Assumptions；
- Junction Candidate；
- Margin；
- Agent 23 Handoff；
- No False Precision。

## Phase 33：Package, Pin and Manufacturing Fit

实现：

- Body/Pitch/Height；
- Pad/Ball Count；
- EPAD；
- MSL；
- Inspection/Rework；
- Factory Capability；
- Footprint Candidate；
- Pin Compatibility Level；
- Agent 20/28/30 Handoff；
- Formal Verification Gate。

## Phase 34：Firmware and EDA Fit

实现：

- SDK/Driver/RTOS；
- Maintenance；
- Pin/Clock/DMA Impact；
- Toolchain；
- Symbol/Footprint/Models；
- Creation/Migration Effort Candidate；
- Known Issues；
- License；
- Readiness Vector。

## Phase 35：Lifecycle Horizon Evaluation

实现：

- Development；
- Certification；
- Production；
- Service；
- Current Status；
- Longevity Program；
- PCN/PDN；
- Alternate Availability；
- Qualification Cost；
- Confidence；
- Risk；
- Gate。

## Phase 36：Supply and Lead-time Evaluation

实现：

- Authorized Supply；
- Stock Coverage；
- Lead-time；
- Need-by Dates；
- Samples/Prototype/Production；
- MOQ/SPQ；
- Multi-region；
- Freshness；
- Supplier Confirmation；
- Risk；
- No Future Guarantee。

## Phase 37：Effective Cost Model

实现：

- Quantity/Region/Currency；
- Price Break；
- MOQ/SPQ Overbuy；
- Enterprise Stock；
- Shipping/Tax Candidate；
- Programming；
- EDA/Firmware/PCB/Thermal Adaptation；
- Quality Risk Candidate；
- Confidence；
- Trace；
- Agent 39 Handoff。

## Phase 38：Combination Compatibility Graph

实现：

- Candidate Nodes；
- Power/Clock/Interface/Memory；
- Voltage/Role/Protocol；
- Pin/Address/Chip Select；
- Sequence；
- Peak Power/Thermal；
- Firmware Dependencies；
- Conflicts；
- Repair Candidates；
- Graph Hash。

## Phase 39：Scoring Scenarios

实现：

- Balanced；
- Cost；
- Power；
- Performance；
- Size；
- Supply；
- Lifecycle；
- Fast Prototype；
- Existing Inventory；
- Preferred Brand；
- Low Change；
- Profile-specific Weights；
- Explain Trace。

## Phase 40：Normalization and Unknown Penalties

实现：

- Bounds；
- Target Distance；
- Piecewise；
- Ordinal；
- Risk Penalty；
- Unknown Policy；
- Outlier Handling；
- Snapshot；
- Reproducibility；
- Tests。

## Phase 41：Pareto and Ranking

实现：

- Hard-filtered Set；
- Multi-dimensional Vector；
- Dominance；
- Pareto Front；
- Aggregate Optional；
- Lexicographic；
- Stable Tie-breaking；
- Candidate Labels；
- No Auto Final Selection。

## Phase 42：Sensitivity and Robustness

实现：

- Weight Perturbation；
- Price/Stock/Lead-time；
- Quantity；
- Requirement Margin；
- Package；
- Lifecycle；
- Ranking Stability；
- Switch Points；
- Fragile Decision Finding；
- Robustness Vector。

## Phase 43：Alternate Strategy Generator

实现：

- Drop-in Candidate；
- Same Footprint；
- Dual Footprint；
- Stuffing Option；
- Variant BOM；
- Daughterboard；
- Firmware Abstraction；
- Switching Cost；
- Verification；
- No Practical Alternate；
- Human Review。

## Phase 44：Sample and Validation Planner

实现：

- Sample Quantity；
- Authorized Source；
- Lot/Date Code；
- Evaluation Board；
- Bench/Corner/Thermal/Firmware；
- Comparison Criteria；
- Evidence；
- Owner；
- Gate；
- Agent 11 Task；
- Procurement Approval。

## Phase 45：Design Impact Graph

实现：

- Power；
- Clock/Reset；
- Pin；
- Peripherals；
- Analog；
- Firmware；
- Footprint；
- Placement/Routing；
- Thermal/Mechanical；
- Test；
- BOM/Manufacturing；
- Must Change/Reverify/Regenerate；
- Visualization。

## Phase 46：Adaptation Work Packages

实现：

- Sample；
- EDA Library；
- Pin Verification；
- Reference Adaptation；
- Firmware Driver；
- Simulation；
- Thermal；
- PCB Constraints；
- Mechanical；
- Supplier/Quality；
- Agent Routing；
- Estimate Candidate；
- Input Gate；
- Rollback。

## Phase 47：Review Workbench

实现：

- Roles/Contracts；
- Candidate Funnel；
- Parameter Matrix；
- Evidence；
- Hard Constraints；
- Supply/Lifecycle；
- Package/Firmware/EDA；
- Combination；
- Pareto/Sensitivity；
- Alternates；
- Validation；
- Decision/Baseline。

## Phase 48：Selection Decision Record

实现：

- Primary；
- Alternates；
- Experimental；
- Rejected；
- Hard Results；
- Scenarios；
- Trade-offs；
- Accepted Risks；
- Validation；
- Design Impact；
- Approval；
- Architecture/Project Link；
- Audit。

## Phase 49：Selection Baseline

实现：

- Contracts；
- Ordering Codes；
- Primary/Alternate；
- Evidence；
- Supply/Price/Lifecycle Snapshots；
- Policies；
- Validation；
- Risks/Questions；
- Approvals；
- Manifest；
- Hash；
- Immutability；
- Events。

## Phase 50：Downstream Packages

实现：

- Schematic；
- Firmware；
- EDA；
- Simulation；
- PCB；
- Mechanical/Thermal；
- BOM/Supply；
- Sample Procurement；
- Verification；
- Schema/Hash/Baseline/Gates；
- Contract Tests。

## Phase 51：Change Impact and Reselection

实现：

- Requirement/Architecture/Reuse Change；
- Lifecycle/PCN；
- Supply/Price；
- Brand Policy；
- Quality/Errata；
- Invalidated Candidates；
- Targeted Retrieval；
- Re-score；
- Alternate Activation Candidate；
- Design Reverification；
- Agent 11 Replan；
- New Baseline Candidate。

## Phase 52：Actual Selection Feedback

实现：

- Prototype Performance；
- Power/Thermal；
- EDA/Firmware Effort；
- Procurement；
- Quality；
- Manufacturing；
- Field；
- Recommendation Quality；
- Parameter Corrections；
- Calibration Data；
- No Automatic Policy Promotion。

## Phase 53：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Pagination；
- ACL；
- Audit；
- Metrics；
- Event Idempotency；
- Retention；
- Data Freshness；
- Connector Health。

## Phase 54：Benchmark、监控和生产发布

实现：

- Retrieval Recall/Precision；
- Hard Constraint Accuracy；
- Parameter/Evidence；
- Ranking Adoption；
- Lifecycle/Supply；
- Alternate Quality；
- Combination Conflicts；
- Selection Feedback；
- Security；
- Performance；
- Feature Flags；
- Index/Provider Rollback；
- Disaster Recovery。

## Phase 55：高级能力，可选

稳定后：

- Component-set Global Optimization；
- Design-for-substitution；
- Automatic Dual-footprint Candidate Geometry；
- Product-line Component Platform；
- Supplier Allocation Optimization；
- Cost/Performance Frontier Across Architectures；
- Field Reliability Feedback Models；
- Tindie Seller Core Component Recommendation；
- 仍不自动批准器件、替代或采购下单。

---

# 105. Codex 工作纪律

Codex 必须：

1. Agent 10/12 Baseline 驱动选型；
2. Agent 11 Gate 控制执行；
3. Agent 13复用上下文显式；
4. Input Snapshot 不可变；
5. Role 和 Component 分开；
6. Selection Contract 是搜索真值；
7. Hard Constraint 与 Soft Objective 分开；
8. Hard Constraint 不被评分抵消；
9. Component Identity 与 Ordering Code 分开；
10. Supply 绑定 Ordering Code；
11. Parameter Schema 按分类；
12. 原始参数名保留；
13. Canonical Unit 显式；
14. Decimal 数值；
15. Min/Typ/Max 分开；
16. Absolute Maximum 不用于正常工作；
17. Guaranteed 与 Typical 分开；
18. Conditions 是一级对象；
19. 不跨条件直接比较；
20. 每个关键参数有 Evidence；
21. AI 提取只进入 Candidate；
22. 无 Evidence 不自动接受；
23. Unknown 不等于 Pass；
24. Category Match 不等于 Functional Fit；
25. Similarity 不等于 Compatibility；
26. Interface Role/Voltage/Timing 显式；
27. Power Peak/Inrush/Sleep 分开；
28. Thermal 有板和环境假设；
29. Package Name 不等于 Footprint Compatible；
30. Pin-to-Pin 需 Agent 20；
31. Firmware Ecosystem 有版本和维护状态；
32. EDA Readiness 与技术适配分开；
33. Lifecycle Unknown 需 Review；
34. Lifecycle 覆盖产品时间线；
35. PCN/PDN 是一级对象；
36. Price 有 Quantity/Region/Currency/Date；
37. Stock 有 Query Time；
38. 当前库存不代表量产保证；
39. Lead-time 有 Need-by；
40. Brand Preference 来自 Policy；
41. Supplier Authorization 显式；
42. 企业库存有质量和 Lot 状态；
43. Quality 数据有样本和时间；
44. Errata 绑定 Revision；
45. Compliance 绑定 Market；
46. Combination Compatibility 必须检查；
47. Ranking Scenario 显式；
48. Weight 来源显式；
49. Normalization 版本化；
50. Unknown Penalty 显式；
51. Pareto 不自动选择；
52. Sensitivity 报告脆弱决策；
53. 主选与备选策略分开；
54. 第二名不自动成为备选；
55. Alternate 切换成本显式；
56. Sample Validation 有 Gate；
57. Effort Estimate 是 Candidate；
58. Agent 11审核任务和工期；
59. Selection Decision 需人工批准；
60. Baseline 不可覆盖；
61. Downstream Package 绑定 Baseline；
62. Agent 19写入需 Preview/Approval/Readback；
63. Agent 22–30重新验证；
64. Agent 31–45使用正式 Ordering Code；
65. Change 触发影响分析；
66. 不自动下样品或采购订单；
67. 不发送私有价格/BOM给未批准模型；
68. 不用客户 BOM 做公开 Fixture；
69. 不伪造参数、库存、Lifecycle、质量或 Benchmark；
70. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Parameter/Policy/Provider 变化；
    - 测试命令和真实结果；
    - Contracts；
    - Retrieval；
    - Hard Constraints；
    - Domain Evaluations；
    - Supply/Lifecycle/Cost；
    - Scoring/Pareto/Sensitivity；
    - Alternates；
    - Validation/Impact；
    - Baseline/Downstream；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 106. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input and Contract

1. Approved Requirement Baseline；
2. Unapproved Baseline；
3. Architecture Baseline；
4. Reuse Context；
5. Missing Profile；
6. ADC Role；
7. MCU Role；
8. Power Role；
9. Connector Role；
10. Shared Component；
11. Fixed Component；
12. Variant Role；
13. Criticality；
14. Hard Constraint；
15. Soft Objective；
16. Unknown Policy；
17. Cost Context；
18. Brand Policy；
19. Verification Requirement；
20. Contract Hash。

## Identity and Parameters

21. Base Part；
22. Ordering Code；
23. Package Variant；
24. Temperature Grade；
25. Speed Grade；
26. Packing Option；
27. Duplicate MPN；
28. Manufacturer Alias；
29. Parameter Alias；
30. Unit Conversion；
31. Min/Typ/Max；
32. Absolute Maximum；
33. Guaranteed Value；
34. Typical Value；
35. Condition Match；
36. Condition Mismatch；
37. Missing Unit；
38. Missing Evidence；
39. Datasheet Revision；
40. Product Page Conflict；
41. AI Extraction Candidate；
42. Evidence Anchor；
43. Parameter Supersession；
44. Unknown Parameter；
45. Decimal Precision。

## Retrieval and Admission

46. Exact MPN；
47. Family Lookup；
48. Taxonomy；
49. Parametric Range；
50. Boolean Capability；
51. Interface Graph；
52. Reference Design；
53. Module Relation；
54. Semantic Candidate；
55. Candidate Union；
56. Dedup Ordering Code；
57. ACL Filter；
58. Prohibited Brand；
59. Missing Datasheet；
60. Lifecycle Unknown；
61. Package Missing；
62. Quarantined Data；
63. Admission Pass；
64. Admission Needs Data；
65. No Candidate。

## Hard Constraints

66. Minimum Pass；
67. Maximum Pass；
68. Range Pass；
69. Exact Enum；
70. Conditional Pass；
71. Hard Fail；
72. Unknown Block；
73. Evidence Insufficient；
74. Absolute Max Misuse；
75. Typical Not Guaranteed；
76. Temperature Mismatch；
77. Voltage Mismatch；
78. Protocol Missing；
79. Required Isolation Missing；
80. Package Height Fail；
81. Forbidden Technology；
82. Critical Hard Matrix；
83. Rule Version Replay；
84. Batch Evaluation；
85. Invalid Operator。

## Category Evaluations

86. MCU Memory；
87. MCU Pin Mux；
88. MCU DMA；
89. MCU SDK；
90. FPGA Logic/Memory；
91. ADC Sample Rate；
92. ADC Input Bandwidth；
93. ADC SNR/ENOB；
94. ADC Interface Throughput；
95. Op-amp Common-mode；
96. Op-amp Output Swing；
97. Op-amp Stability；
98. Buck Input Range；
99. Buck Thermal；
100. Buck Minimum On-time；
101. LDO Dropout；
102. Clock Jitter；
103. Memory Endurance；
104. Connector Mating Cycles；
105. TVS Capacitance；
106. Capacitor DC Bias；
107. Inductor Saturation；
108. Resistor Power Derating；
109. Category Unknown；
110. Errata Impact。

## Package, EDA and Firmware

111. Same Package Name Different Pads；
112. Same Footprint Different Pin Function；
113. EPAD Difference；
114. Height Constraint；
115. MSL；
116. Symbol Available；
117. Footprint Verified；
118. Pin-Pad Unknown；
119. 3D Missing；
120. IBIS Available；
121. SPICE Missing；
122. Official SDK；
123. Community Driver；
124. SDK Deprecated；
125. RTOS Unsupported；
126. Toolchain Conflict；
127. Known Firmware Issue；
128. EDA Readiness Vector；
129. Firmware Port Required；
130. Agent 20 Gate。

## Lifecycle, Supply and Cost

131. Active；
132. Recommended New Design；
133. NRND；
134. Last Time Buy；
135. Obsolete；
136. Conflicting Lifecycle Sources；
137. PCN；
138. PDN；
139. Product Horizon；
140. Authorized Distributor Stock；
141. Enterprise Inventory；
142. Broker Stock Rejected；
143. Stale Supply Snapshot；
144. Multiple Regions；
145. Quantity Price Break；
146. MOQ Overbuy；
147. SPQ Overbuy；
148. Currency Context；
149. Missing Price Context；
150. Need-by Lead-time；
151. Supplier Confirmation；
152. No Production Coverage；
153. Existing Inventory Quality Hold；
154. Effective Cost；
155. Price Sensitivity。

## Policies, Quality and Compliance

156. Preferred Brand；
157. Restricted Brand；
158. Prohibited Brand；
159. Customer Mandated；
160. Policy Exception；
161. Authorized-only；
162. Multi-distributor；
163. RoHS Evidence；
164. Compliance Market Mismatch；
165. Quality Good Sample；
166. Quality Small Sample；
167. Field Return；
168. Counterfeit Finding；
169. Lot Traceability；
170. Critical Errata；
171. Quality Block；
172. Brand Soft Preference；
173. Brand Hard Policy；
174. Supplier Region；
175. Policy Effective Date。

## Combination and Ranking

176. Voltage Compatible；
177. Logic Level Conflict；
178. Protocol Role Conflict；
179. Clock Conflict；
180. Reset Sequence；
181. Memory Bus Conflict；
182. I2C Address Conflict；
183. Pin Mux Conflict；
184. Peak Power Overflow；
185. Thermal Concentration；
186. Firmware Version Conflict；
187. Combination Repair；
188. Balanced Scenario；
189. Lowest Cost；
190. Lowest Power；
191. Best Lifecycle；
192. Fast Prototype；
193. Preferred Brand；
194. Pareto Dominance；
195. Lexicographic；
196. Unknown Penalty；
197. Stable Tie；
198. Weight Sensitivity；
199. Price Sensitivity；
200. Fragile Ranking；
201. Robust Candidate；
202. No Auto Selection；
203. Hard Fail Excluded；
204. Scenario Diff；
205. Ranking Replay。

## Alternates, Validation and Baseline

206. Drop-in Alternate Candidate；
207. Same Footprint Alternate；
208. Firmware Change Alternate；
209. PCB Change Alternate；
210. Dual Footprint；
211. Variant BOM；
212. Daughterboard；
213. No Practical Alternate；
214. Switching Cost；
215. Sample Plan；
216. Authorized Sample Source；
217. Corner Test；
218. Thermal Test；
219. Firmware Bring-up；
220. Design Impact Graph；
221. MCU Change Ripple；
222. Power Change Ripple；
223. Work Package；
224. Review Package；
225. Decision Approval；
226. Baseline Approval Missing；
227. Immutable Baseline；
228. Downstream Schematic Package；
229. Downstream Firmware Package；
230. BOM Ordering Code；
231. Requirement Change；
232. Lifecycle Change；
233. Supply Change；
234. Targeted Reselection；
235. Preserve Old Baseline；
236. Actual Feedback；
237. Unauthorized Purchase；
238. External Model Data Policy；
239. Tenant Isolation；
240. Audit Replay；
241. One Million Components；
242. Ten Thousand Candidates；
243. Worker Cancellation；
244. Partial Provider Failure；
245. Index Rollback。

---

# 107. 初始质量目标

```text
Approved Primary Component Critical Hard Constraint Pass = 100%
Approved Primary Component Critical Unknown Count = 0
Approved Candidate Ordering Code Coverage = 100%
Approved Critical Parameter Evidence Coverage = 100%
Absolute Maximum Used as Operating Requirement = 0
Typical Value Misrepresented as Guaranteed = 0
Unknown Condition Silent Compatibility Pass = 0
Formal Pin-to-Pin Claim without Agent 20 Validation = 0
Price Snapshot without Quantity/Region/Currency/Time = 0
Supply Snapshot without Query Time = 0
Unknown Lifecycle Direct Primary Selection = 0
Prohibited Manufacturer Selection = 0
Hard Constraint Scored Away = 0
Second-ranked Candidate Automatic Alternate = 0
Approved Alternate Switching Impact Coverage = 100%
Selection Baseline Overwrite = 0
Requirement/Lifecycle/Supply Change without Impact Analysis = 0
Private BOM/Price Sent to Unapproved External Model = 0
Tenant/Project/Data Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 108. 性能要求

目标规模：

```text
1,100,000+ Component Records
Millions of Parameter Values
Hundreds of Parameter Schemas
Multiple Supply Providers and Regions
```

常规单 Role：

```text
10–100 Constraints/Objectives
100–100,000 Initial Catalog Candidates
100–5,000 Pre-filtered Candidates
10–200 Deep Evaluations
5–50 Shortlisted Candidates
```

目标：

```text
Readiness P95 < 15 s
Identity/Taxonomy Retrieval P95 < 1 s
Parametric Retrieval P95 < 5 s
Hard Constraint Filter P95 < 10 s for 10k candidates
Deep Rule Evaluation P95 < 5 s per candidate excluding external models
Supply Refresh P95 determined by provider but async
Scoring/Pareto P95 < 10 s for 5k candidates
Sensitivity P95 < 30 s for 1k scenarios
Interactive Comparison P95 < 300 ms
Change Impact P95 < 30 s for 100k trace edges
```

大型数据要求：

- 参数列式存储或 Parquet；
- 范围索引；
- 分类分区；
- 增量参数更新；
- Supply Snapshot TTL；
- Provider Rate Limit；
- Batch 请求；
- Cache；
- Backpressure；
- Partial Results；
- Candidate Budget；
- 不把数万个 Datasheet 送入单次模型调用。

---

# 109. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/component-selection-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第14个 Agent：

Electronic Component Selection, Multi-objective Optimization
& Design Admission Agent /
元器件选型优化 Agent。

本 Agent 接收：

- Agent 10 Requirement Baseline、Constraint、Goal、Variant 和 Change；
- Agent 11 Component Selection Work Package、Gate、Budget 和 Schedule；
- Agent 12 Function、Block、Port、Interface、Power、Mode、Budget 和 Architecture Baseline；
- Agent 13 Reuse Baseline、Source Components 和 Modification Scope；
- 企业 110 万型号元器件数据库；
- Datasheet/Manufacturer Product Data；
- Symbol/Footprint/3D/IBIS/SPICE/STEP；
- Firmware SDK/Driver/Toolchain；
- Lifecycle/PCN/PDN；
- Authorized Distributor Price/Stock/Lead-time；
- Enterprise Inventory/Procurement/Quality；
- Brand/Supplier/Compliance Policies；

输出：

- Component Roles；
- Selection Contracts；
- Candidate Retrieval；
- Hard Constraint Results；
- Parameter/Evidence Matrix；
- Electrical/Functional/Interface Evaluation；
- Power/Thermal/Package/Firmware/EDA Evaluation；
- Lifecycle/Supply/Cost/Quality/Compliance；
- Component Combination Graph；
- Score Scenarios/Pareto/Sensitivity；
- Primary/Alternate/Experimental Sets；
- Sample Validation Plan；
- Design Impact/Work Packages；
- Selection Decision/Baseline；
- Agent 11/12/13/16–45 Downstream Packages。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10–14 和 Agent 16–45 规格；
3. docs/component-selection-agent-spec.md；
4. 当前 Requirement/Project/Architecture/Reuse Baselines；
5. 当前 Component Catalog/Identity/Ordering Codes；
6. 当前 Taxonomy/Parameter Schemas/Aliases；
7. 当前 Parameter Values/Conditions/Evidence；
8. 当前 Datasheet/Product Page Parsers；
9. 当前 Lifecycle/PCN/PDN；
10. 当前 Distributor Supply/Price APIs；
11. 当前 Enterprise Inventory/Procurement/Quality；
12. 当前 Brand/Supplier/Compliance Policies；
13. 当前 EDA Asset/Agent 20；
14. 当前 Firmware Ecosystem/Agent 21；
15. 当前 Retrieval/Scoring/Pareto；
16. 当前 Alternate Strategies；
17. 当前 Combination Compatibility；
18. 当前 Validation/Design Impact；
19. 当前 UI/API/Worker/Storage/Security；
20. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Requirement and Architecture Baselines Drive Selection；
- One Job = One Immutable Input Snapshot；
- Component Role != Component；
- Selection Contract Is Search Truth；
- Hard Constraints != Soft Objectives；
- Hard Constraints Cannot Be Scored Away；
- Component Identity != Ordering Code；
- Supply Binds Ordering Code；
- Category-specific Parameter Schemas；
- Decimal and Explicit Units；
- Original/Canonical Parameter Names；
- Min/Typ/Max/Absolute/Guaranteed Separated；
- Conditions and Test Methods First-class；
- No Cross-condition Silent Comparison；
- Critical Parameters Require Evidence；
- AI Extraction Is Candidate-only；
- Unknown != Pass；
- Similarity != Compatibility；
- Category Match != Functional Fit；
- Package Name != Footprint Compatibility；
- Pin Compatibility Requires Agent 20；
- Typical Stock != Production Availability；
- Price Has Quantity/Region/Currency/Time；
- Lifecycle Covers Product Horizon；
- PCN/PDN/Errata First-class；
- Brand/Supplier Rules Come from Policy；
- Quality Has Sample/Time Context；
- Combination Compatibility Required；
- Scenario/Weights/Normalization Versioned；
- Pareto Does Not Auto-select；
- Sensitivity Reports Fragility；
- Alternate Is a Strategy, Not the Second Rank；
- Sample/Validation Has Gate；
- Human Selection Decision；
- Immutable Selection Baseline；
- Downstream Packages Bind Baseline；
- Agent 19 Controlled EDA Write；
- Agent 22–30 Regression；
- Change Requires Reselection Impact；
- No Automatic Sample/PO；
- No External Private BOM/Price Data；
- 不用客户 BOM 做公开 Fixture；
- 不伪造参数、库存、Lifecycle、质量或 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改主数据：

1. 侦察当前仓库；
2. 查找 Agent 10/11/12/13 Baselines 和 Contracts；
3. 查找 Component Catalog；
4. 查找 Identity/Ordering Code；
5. 查找 Taxonomy；
6. 查找 Parameter Schemas/Aliases/Units/Conditions；
7. 查找 Datasheet/Product Parsers/Evidence；
8. 查找 Lifecycle/PCN/PDN；
9. 查找 Supply/Price/Stock/Lead-time Providers；
10. 查找 Enterprise Inventory/Procurement/Quality；
11. 查找 Brand/Supplier/Compliance Policies；
12. 查找 EDA Asset/Agent 20；
13. 查找 Firmware Ecosystem/Agent 21；
14. 查找 Reference Design/Module Relations；
15. 查找 Retrieval/Parametric/Graph/Semantic；
16. 查找 Hard Constraint Evaluation；
17. 查找 Scoring/Pareto/Sensitivity；
18. 查找 Alternate Strategy；
19. 查找 Combination Compatibility；
20. 查找 Validation/Design Impact/Baseline；
21. 查找 Agent 22–45 Downstream；
22. 查找 UI/API/Worker/Storage/Security；
23. 统计分类与参数覆盖；
24. 统计 Evidence/Unit/Condition 覆盖；
25. 统计 Ordering Code/Lifecycle/Supply Freshness；
26. 统计推荐采纳、退回和实际返工；
27. 统计价格/库存/生命周期数据冲突；
28. 抽样分析开源、合成、脱敏或授权 Fixture；
29. 在 docs/component-selection-implementation-plan.md 中生成实施计划；
30. 在 docs/input-and-selection-contracts.md 中定义输入；
31. 在 docs/component-identity-and-ordering-codes.md 中定义型号；
32. 在 docs/parameter-and-condition-model.md 中定义参数；
33. 在 docs/candidate-retrieval.md 中定义检索；
34. 在 docs/hard-constraint-evaluation.md 中定义硬约束；
35. 在 docs/category-specific-evaluation.md 中定义分类评估；
36. 在 docs/package-eda-and-firmware.md 中定义封装和生态；
37. 在 docs/lifecycle-and-pcn.md 中定义生命周期；
38. 在 docs/price-inventory-and-lead-time.md 中定义供应；
39. 在 docs/brand-supplier-and-quality-policy.md 中定义策略；
40. 在 docs/combination-compatibility.md 中定义组合；
41. 在 docs/scoring-pareto-and-sensitivity.md 中定义排序；
42. 在 docs/alternate-strategy.md 中定义备选；
43. 在 docs/validation-and-design-impact.md 中定义验证；
44. 在 docs/baselines-and-changes.md 中定义 Baseline；
45. 在 docs/downstream-agent-contracts.md 中定义下游；
46. 在 docs/ai-boundaries.md 中定义 AI；
47. 在 docs/security.md 中定义安全；
48. 在 docs/component-selection-migration-plan.md 中定义迁移；
49. 在 docs/component-selection-benchmark-plan.md 中定义 Benchmark；
50. 给出拟新增、拟修改和拟复用文件；
51. 给出 Phase 1 精确范围；
52. 不修改业务代码；
53. 不创建 Migration；
54. 不安装 Search/Unit/Optimization/模型组件；
55. 不修改 Component Master Data；
56. 不刷新生产 Supply API；
57. 不创建采购请求；
58. 不修改 EDA；
59. 不冻结 Selection Baseline；
60. 不调用生产外部模型；
61. 不读取或打印 Secret/合同价/客户 BOM；
62. 运行仓库已有 lint、type check、test、build 和 security scan；
63. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10–13 和下游 Contracts；
- Input Gate；
- Component Roles/Contracts；
- Identity/Ordering Code；
- Taxonomy/Parameter Schemas；
- Units/Conditions/Evidence；
- Lifecycle/PCN/PDN；
- Supply/Price/Inventory；
- Brand/Supplier/Quality；
- EDA/Firmware；
- Retrieval；
- Hard Constraints；
- Category Evaluators；
- Combination Compatibility；
- Scoring/Pareto/Sensitivity；
- Alternate Strategy；
- Validation/Design Impact；
- Decision/Baseline；
- Change/Feedback；
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

# 110. 后续 Phase 提示词模板

```text
继续实现 Component Selection Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10–14 和相关下游 Agent 规格；
3. 阅读 Component Selection Implementation Plan；
4. 阅读 Contracts、Identity、Parameters、Retrieval、Evaluation、Supply、Scoring、Alternates、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Baseline-driven Selection；
- Typed Contracts and Parameters；
- Hard Constraints First；
- Evidence and Conditions；
- Ordering-code-bound Supply；
- Human Decision；
- Immutable Baseline；
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
9. parameter/unit/condition tests；
10. retrieval/hard-constraint tests；
11. supply/lifecycle tests；
12. scoring/alternate tests；
13. downstream/baseline tests；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Parameter/Policy/Provider 变化；
- 测试命令和真实结果；
- Contracts；
- Retrieval；
- Hard Constraints；
- Domain Evaluations；
- Supply/Lifecycle/Cost；
- Scoring/Pareto/Sensitivity；
- Alternates；
- Validation/Impact；
- Baseline/Downstream；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 111. MVP 演示流程

1. 使用“便携式双通道测量仪”Requirement Baseline；
2. Agent 12已冻结 ADC + FPGA + MCU 架构；
3. Agent 13建议复用一个双通道高速采集核心；
4. Agent 14创建 Roles：
5. ADC；
6. FPGA；
7. MCU；
8. AFE Op Amp；
9. Voltage Reference；
10. USB Interface；
11. Buck/LDO；
12. SDRAM；
13. Clock Oscillator；
14. USB-C Connector；
15. TVS；
16. 对 ADC 建立 Selection Contract：
17. 双通道；
18. 采样率不低于 45 MSPS；
19. 分辨率不低于 8 bit；
20. 输入带宽满足目标；
21. 数字接口能被 FPGA 接收；
22. 功耗和封装满足便携设计；
23. 工业温度候选；
24. 生命周期覆盖项目计划；
25. 建立 Candidate Retrieval；
26. 精确命中 Agent 13来源设计中的 ADC；
27. 参数检索命中 20 个候选；
28. Reference Graph 命中 8 个有官方参考设计的候选；
29. EDA/Firmware 关系命中 6 个有 IBIS 或 FPGA 示例的候选；
30. 合并后 27 个候选；
31. Candidate Admission 淘汰：
32. 3 个无 Datasheet；
33. 2 个 Lifecycle Unknown 且数据不足；
34. 4 个仅 Broker 库存且企业禁止；
35. 剩余 18 个；
36. Hard Constraint 淘汰：
37. 5 个采样率不足；
38. 2 个输入带宽不足；
39. 3 个接口吞吐不兼容；
40. 剩余 8 个；
41. 对参数执行条件比较；
42. 发现候选 A 的 65 MSPS 是保证最小值；
43. 候选 B 的 80 MSPS 只在较高电压和商业温度下；
44. B 在目标条件下标记 `condition_mismatch`；
45. 评估功耗；
46. 候选 C 性能最好，但功耗是候选 A 的约 2 倍；
47. 评估封装；
48. 候选 D 封装小，但 Pitch 超出当前 SMT 工厂稳定能力；
49. 评估生命周期；
50. 候选 E Active，但不在厂商长期供货计划；
51. 评估库存和价格；
52. 所有数据绑定 Quantity=500、Region、Currency、Query Time 和 Ordering Code；
53. 候选 A 现货充足但单价高；
54. 候选 F 单价低但工厂交期长；
55. 候选 G 企业仓库有库存，但 Lot 较旧，需要质量确认；
56. 评估 EDA；
57. A 有验证过的 Symbol/Footprint/IBIS；
58. F 没有 Footprint；
59. 评估参考设计；
60. A 与 Agent 13来源项目一致；
61. 可保留关键模拟和 FPGA 接口；
62. 运行 Balanced Ranking；
63. A 排名第一；
64. 运行 Lowest Cost；
65. F 排名第一；
66. 运行 Lowest Power；
67. G 排名第一；
68. 运行 Best Lifecycle；
69. A 排名第一；
70. 输出 Pareto Set，而不是单一赢家；
71. 运行 Sensitivity；
72. 当数量从 500 增加到 5000 时，F 成本优势扩大；
73. 当 Prototype Need-by 缩短时，A 优势明显；
74. 选择 A 为 Primary Candidate；
75. 不能直接把 F 设为 Alternate；
76. 分析 A 与 F：
77. 封装不同；
78. Pinout 不同；
79. 参考电压要求不同；
80. FPGA 接口时序不同；
81. F 被标记为 `alternate_with_pcb_change`；
82. 搜索同封装器件 H；
83. H 性能略低但满足硬约束；
84. Agent 20验证同 Footprint 但部分 Pin 功能不同；
85. H 被标记为 `alternate_with_bom_and_firmware_change`；
86. 创建 Alternate Strategy：
87. Primary A；
88. Alternate H；
89. 原理图预留 Stuffing Option；
90. Firmware 抽象 ADC Driver；
91. 生产时按 Variant BOM；
92. 创建 Sample Plan：
93. A 样品 10 片；
94. H 样品 10 片；
95. 使用授权渠道；
96. 对比输入带宽、SNR、时钟容差、功耗和温升；
97. 对 MCU 角色运行相同流程；
98. 发现 MCU 候选外设数量都满足，但一个候选 DMA 通道冲突；
99. 通过 Combination Graph 发现 ADC + FPGA + MCU 的电压、电平、时钟和存储接口组合问题；
100. 创建 Level Translator 和 Clock Adapter Candidate；
101. Agent 12更新 Power 和 Clock Architecture；
102. Agent 11接收样品、验证、Footprint 和 Firmware Work Packages；
103. 工程师审核参数 Evidence、供货快照和 Ranking；
104. 记录 Selection Decision；
105. 冻结 Component Selection Baseline 1.0；
106. 向 Agent 20输出正式 Ordering Code 和 Package；
107. 向 Agent 21输出 MCU/FPGA/ADC 平台和 SDK；
108. 向 Agent 22/23输出额定值和模型；
109. 向 Agent 24–28输出封装、功率、热和接口约束；
110. 向 BOM/采购 Agent 输出 Primary/Alternate Strategy；
111. Prototype 测试后回传：
112. A 实际功耗高于典型值但仍满足；
113. H Firmware Port 比预估多两天；
114. 反馈进入 Calibration，但不自动改变 Policy；
115. 后续 A 出现 PCN；
116. Agent 14触发 Change Impact；
117. 重新评估 H 和其他候选；
118. Agent 11生成 Replan Candidate；
119. 新决策冻结 Baseline 1.1；
120. 保留 1.0。

---

# 112. 生产上线顺序

第一阶段：

```text
Component Roles
Selection Contracts
Identity/Ordering Code
Category Parameter Schemas
Deterministic Parametric Search
Hard Constraint Evaluation
Manual Candidate Comparison
```

第二阶段：

```text
Lifecycle/PCN
Supply/Price/Inventory
Package/EDA/Firmware
Category-specific Evaluators
Pareto/Sensitivity
Alternate Strategy
Selection Baseline
```

第三阶段：

```text
Combination Optimization
Effective Total Cost
Automated Sample Workflow
Actual Feedback Calibration
Design-for-substitution
Product-line Component Platforms
```

上线优先确保：

```text
筛选条件是否来自需求和架构，而不是搜索框里的几个关键词
参数是否区分保证值、典型值、极限值和工作条件
价格、库存和交期是否绑定准确 Ordering Code 与查询时间
排名是否先通过硬约束，再考虑成本、品牌和供应链偏好
主选和备选是否有真实切换策略，而不是简单取前两名
器件冻结后，原理图、固件、PCB、BOM 和采购是否绑定同一 Baseline
```

一个靠谱的元器件选型 Agent，不应该只说“推荐这颗芯片，综合得分 92”。它应该让工程师一眼看明白：92 分来自哪里、哪些参数只是典型值、库存能撑到哪个阶段、封装会不会让工厂抓狂、换成备选需要改哪些地方，以及三年后这颗器件还会不会让团队重新做一遍设计。
