# 参考设计与功能模块推荐 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：13  
> Agent 名称：Reference Design, KiCad Project & Functional Module Retrieval, Reuse Assessment and Adaptation Planning Agent  
> 中文名称：参考设计与功能模块推荐 Agent  
> 类型：混合型  
> 版本：V1.0  
>
> 定位：接收 Agent 10 的 Requirement Baseline、Agent 11 的项目计划与架构 Gate、Agent 12 的功能架构、Block、Port、Interface、Power Tree、Mode 和 Budget，从企业参考设计库、KiCad 工程库、模块数据库、器件数据库、历史项目、厂商参考设计、开源仓库和受控外部资料中检索可复用方案；对每个候选进行功能覆盖、接口兼容、电源兼容、性能余量、尺寸、热、成本、生命周期、供应链、许可、EDA 完整性、固件支持、验证证据和制造可行性分析；输出可解释的复用比例、修改范围、影响对象、验证计划、风险和多候选组合，供工程师选择并驱动原理图、固件、PCB、机械、BOM、项目计划和制造流程。
>
> 现有企业资产规模假设：
> - 元器件基础数据库约 110 万型号；
> - 原理图符号约 2 万、封装约 2 万；
> - 封装映射约 90 万型号、符号映射约 10 万型号；
> - 参考设计约 2 万，其中 KiCad 工程约 2 千；
> - 开源参考设计约 2 千；
> - 功能模块约 500+；
> - 厂商约 4 千；
> - 模块和参考设计数据未来持续增长。
>
> 上游：
> - Agent 10：Requirement Baseline、Constraint、Goal、Variant、Assumption、Acceptance Criteria 和 Change Impact
> - Agent 11：Project Profile、Architecture Work Package、Milestone、Gate、Owner、Estimate、Long-lead Risk 和 Replan
> - Agent 12：Context、Function、Logical Block、Physical Candidate、Port、Interface Contract、Power Tree、Data/Control Flow、Mode、Budget、Finding 和 Architecture Baseline
> - 企业模块库：模块功能、端口、参数、PCB 尺寸、固件、KiCad 工程、验证和供应状态
> - 企业参考设计库：原理图、PCB、BOM、固件、文档、测试报告、版本和适用条件
> - KiCad 工程库：`.kicad_pro`、`.kicad_sch`、`.kicad_pcb`、库、3D、BOM、仿真和制造文件
> - 元器件数据库：型号、参数、生命周期、供应渠道、封装、符号、3D、价格和库存接口
> - 历史项目：实际复用、修改、缺陷、工期、测试和量产反馈
> - 厂商资料：Reference Design、Evaluation Board、Application Note、Datasheet 和 Design Files
> - 受控开源仓库：Git、Release、License、Issue、Commit、CI 和 Artifact
> - Tindie/企业产品库：模块、开发板、仪器、附件和用户验证数据
>
> 下游：
> - Agent 11：复用任务、修改任务、风险、估算、采购和里程碑
> - Agent 12：候选物理架构、模块组合、Interface/Power/Budget 更新和 ADR
> - 系统方案与原理图生成 Agent：复用电路块、层次原理图和接口定义
> - 元器件选型 Agent：核心器件、替代料和物料约束
> - Agent 16：解析被选 KiCad 工程和生成 Canonical EDA IR
> - Agent 18：重建和核对候选 Netlist
> - Agent 19：在 Workspace 中受控复制、裁剪、重命名和写入
> - Agent 20：符号、封装、Pin-Pad、库依赖和器件映射
> - Agent 21：BSP、Driver、Protocol、Firmware Component 和 API 复用
> - Agent 22：复用原理图的 ERC、保护、去耦和需求覆盖复审
> - Agent 23：模拟链路、电源、控制和性能重新仿真
> - Agent 24：从复用方案继承并重建 PCB 约束
> - Agent 25：复用 Placement、Functional Zone、Fixed Object 和模块区域
> - Agent 26：复用或局部重建 Routing
> - Agent 27：复用后重新执行 DRC、SI、PI 和 EMC
> - Agent 28：复用模块的尺寸、连接器、散热、外壳和安装适配
> - Agent 29：重新生成项目自己的生产文件，不直接发布来源工程生产包
> - Agent 30：按目标制造商重新执行 DFM/DFA
> - Agent 31–45：BOM、供应链、采购、NPI、生产、质量和追溯
>
> 核心输出：
> - Reuse Search Input Snapshot
> - Asset Registry Snapshot
> - Canonical Reference Asset IR
> - Reference Design Candidate Set
> - KiCad Project Candidate Set
> - Functional Module Candidate Set
> - Multi-module Composition Candidate Set
> - Requirement/Function/Block Coverage Matrix
> - Port and Interface Compatibility Matrix
> - Power and Mode Compatibility Matrix
> - Performance and Budget Margin Matrix
> - EDA Asset Completeness Report
> - Firmware Reuse Report
> - Mechanical and Manufacturing Fit Report
> - Lifecycle, Supply and Cost Fit Report
> - License, Attribution and IP Compliance Report
> - Validation Evidence Quality Report
> - Reuse Ratio Vector
> - Modification Scope Graph
> - Adaptation Work Package Set
> - Change and Dependency Impact Package
> - Verification and Regression Plan
> - Candidate Score Vector and Pareto Set
> - Reuse Decision Record
> - Selected Reuse Baseline
> - Downstream Reuse Packages
>
> 重要边界：
> - 本 Agent 推荐和评估候选，不替工程师批准最终复用方案。
> - 不将相似关键词视为可复用证据。
> - 不将“使用同一颗主芯片”视为系统设计高度可复用。
> - 不把 README 中声称的功能视为已经验证。
> - 不把一个能打开的 KiCad 工程视为完整、正确或可生产。
> - 不把已有 Gerber、BOM 或生产文件直接用于新项目发布。
> - 不把参考设计中的工作电压、接口速率、板层、材料和保护方案自动继承到目标项目。
> - 不把来源项目的 Symbol、Footprint、3D、Submodule、Git LFS 和绝对路径依赖悄悄忽略。
> - 不把模块的标称功能与目标工作条件下的有效性能混为一类。
> - 不把板卡可连接视为电气、协议、固件和机械全部兼容。
> - 不把“复用比例”压成单一百分比；必须输出多维 Reuse Vector 和计算依据。
> - 不用文件数量、器件数量或网络数量单独代表复用程度。
> - 不把直接复制、参数调整、接口适配、器件替换、局部重画和完整重设计混为同一等级。
> - 不编造修改工期、成本、良率、验证状态或许可证权利。
> - 不自动接受来源设计中的安全、EMC、合规和制造结论。
> - 不自动执行来源仓库中的代码、脚本、宏、CI、插件和二进制。
> - 不绕过 License、Export Control、Attribution、Third-party Notice 和商业使用限制。
> - 不向外部模型发送企业私有 KiCad 工程、客户架构、BOM、供应商价格和内部缺陷数据。
> - 不直接修改目标工程；所有 EDA 写入通过 Agent 19 的 Workspace、Preview、Approval、Readback 和 Rollback。
> - 所有推荐必须能回到来源资产、版本、Commit、Artifact Hash、Evidence 和匹配规则。

---

# 1. Agent 13 的系统位置

```text
Agent 10 Requirement Baseline
              ↓
Agent 12 Architecture Baseline
              ↓
Search Intent and Reuse Scope
              ↓
Reference / KiCad / Module Asset Retrieval
              ↓
Canonicalization and Evidence Validation
              ↓
Functional / Interface / Power / Performance Matching
              ↓
EDA / Firmware / Mechanical / Manufacturing Fit
              ↓
Reuse Ratio Vector and Modification Scope
              ↓
Candidate Composition and Pareto Comparison
              ↓
Human Review and Reuse Decision
              ↓
Agent 11 Replan + Agent 12 Architecture Update
              ↓
Agent 16–30 Controlled Adaptation and Regression
```

---

# 2. 为什么需要独立 Agent 13

常见问题包括：

1. 企业有大量历史工程，但工程师不知道哪些可复用；
2. 搜索只依赖标题、型号或 README，漏掉真正匹配的方案；
3. 找到相似参考设计后，没有说明哪些部分能直接复用；
4. 同一功能有多个模块，接口、电压和固件支持差异很大；
5. KiCad 工程缺库、缺 3D、缺子模块或依赖本地绝对路径；
6. 参考设计使用了停产器件，但表面功能完全匹配；
7. 开源工程许可证不允许目标商业使用方式；
8. 原理图可复用，但 PCB 尺寸、连接器位置和板层完全不同；
9. PCB 局部可复用，但高速链路和电源必须重新布局布线；
10. 固件仓库有 Driver，却不支持目标 MCU、RTOS 或版本；
11. 模块能运行，但没有测试报告、制造反馈或版本管理；
12. 多模块组合后出现地址冲突、电源冲突、Pin 冲突和机械冲突；
13. 工程师复制旧项目后，旧 Net Name、Reference、Variant 和 BOM 混入新项目；
14. 项目宣称“复用 80%”，实际上验证、认证和制造全部重做；
15. 复用节省的设计时间，被兼容性和清理工作吃掉。

Agent 13 的职责是：

```text
Available Assets
→ Relevant Candidates
→ Verified Fit
→ Explicit Gaps
→ Controlled Adaptation
→ Measurable Reuse
```

---

# 3. Asset 类型

```text
complete_product_design
reference_design
evaluation_board
development_board
functional_module
circuit_block
schematic_sheet
pcb_region
kicad_project
firmware_repository
driver
bsp
fpga_ip
mechanical_part
test_fixture
manufacturing_package
application_note
simulation_model
```

---

# 4. Asset 来源

```text
enterprise_private
enterprise_shared
customer_owned
vendor_official
partner
open_source
public_reference
marketplace
historical_project
generated_candidate
```

---

# 5. Asset 信任等级

```text
production_proven
pilot_validated
prototype_validated
lab_validated
simulation_validated
vendor_claimed
community_reported
unverified
unknown
```

信任等级按证据，而不是来源名气自动判断。

---

# 6. Asset 生命周期状态

```text
active
maintained
frozen
legacy
deprecated
superseded
archived
incomplete
quarantined
```

---

# 7. Asset Canonical IR

```json
{
  "asset_ir_version": "1.0.0",
  "asset_id": "uuid",
  "asset_type": "reference_design",
  "identity": {},
  "source": {},
  "versions": [],
  "functions": [],
  "blocks": [],
  "ports": [],
  "interfaces": [],
  "power": {},
  "performance": {},
  "modes": [],
  "eda_assets": {},
  "firmware_assets": {},
  "mechanical_assets": {},
  "manufacturing_assets": {},
  "verification_evidence": [],
  "license": {},
  "supply": {},
  "provenance": {}
}
```

---

# 8. Asset Identity

```text
title
vendor/owner
product family
asset type
version
revision
release
commit
branch
tag
publication date
last validation date
status
aliases
part numbers
URLs
artifact hashes
```

---

# 9. 功能表示

每个 Asset 必须映射：

```text
capability
function
input
output
control
operating mode
performance
condition
limitations
verification
```

---

# 10. Block 和 Module 表示

```text
logical responsibility
physical realization
major components
ports
power rails
clock/reset
firmware component
mechanical envelope
thermal behavior
test point
manufacturing process
```

---

# 11. Port Contract

模块和参考设计的 Port 至少包含：

```text
port type
direction
role
connector
pinout
voltage
current
logic threshold
protocol
speed
clocking
termination
isolation
protection
hot plug
mechanical orientation
variant
```

---

# 12. EDA Asset Manifest

```text
project files
schematic files
PCB files
symbol libraries
footprint libraries
3D models
simulation models
BOM
netlist
constraints
design rules
stack-up
manufacturing outputs
project settings
plugins
scripts
submodules
external paths
```

---

# 13. Firmware Asset Manifest

```text
repository
commit/tag
target processor
architecture
toolchain
SDK
RTOS
drivers
middleware
protocol stack
bootloader
update path
configuration
license
tests
CI
known issues
```

---

# 14. Mechanical Asset Manifest

```text
STEP
STL
DXF
board outline
height map
connector orientation
mounting holes
enclosure
heatsink
shield
cable
button/display locations
tolerance
```

---

# 15. Manufacturing Asset Manifest

```text
Gerber
Drill
BOM
CPL
Assembly Drawing
Stencil
Panel
Test Instruction
Programming File
Process Note
Supplier Feedback
Yield/Defect Evidence
```

来源生产文件仅作为证据和参考，不作为目标项目正式 Release。

---

# 16. Verification Evidence

```text
test report
simulation report
scope waveform
measurement data
calibration record
EMC report
safety report
DFM report
manufacturing lot
field usage
issue history
bug fixes
customer feedback
```

---

# 17. Evidence 质量

维度：

```text
source authenticity
version binding
test setup completeness
condition completeness
measurement traceability
sample size
repeatability
recency
independent verification
artifact integrity
```

---

# 18. Search Intent

由 Agent 12 生成：

```text
target function
target block
required interfaces
power inputs/outputs
performance
mode
dimensions
cost class
lifecycle
reuse preference
forbidden technology
verification requirement
variant
```

---

# 19. Search Scope

```text
whole product
subsystem
functional block
schematic sheet
PCB region
module
firmware component
reference design
test fixture
```

---

# 20. Retrieval Pipeline

```text
Intent Normalization
→ Metadata Filter
→ Lexical Retrieval
→ Parameter Retrieval
→ Semantic Retrieval
→ Graph Retrieval
→ EDA Structure Retrieval
→ Candidate Union
→ Hard Constraint Filter
→ Deep Compatibility Evaluation
→ Rerank
```

---

# 21. Hybrid Retrieval

至少包含：

```text
exact identifier match
manufacturer part number
title/description lexical match
taxonomy/category match
parameter range match
interface graph match
function/block semantic match
BOM/component overlap
schematic topology match
netlist subgraph match
PCB region/placement pattern match
firmware API/driver match
historical reuse relation
```

---

# 22. 向量检索边界

Embedding 适合：

```text
功能描述
应用描述
限制说明
问题和解决方式
文档摘要
```

不适合单独决定：

```text
电压兼容
Pinout
带宽
尺寸
License
器件生命周期
网络拓扑
```

---

# 23. Graph Retrieval

节点：

```text
asset
function
block
port
interface
power rail
component
firmware component
test evidence
license
supplier
project
```

边：

```text
implements
contains
connects
powered_by
uses_component
verified_by
forked_from
supersedes
reused_in
modified_to
compatible_with
conflicts_with
```

---

# 24. EDA 结构检索

支持：

```text
symbol set similarity
component family similarity
hierarchical sheet similarity
net class similarity
netlist subgraph similarity
power tree similarity
connector/interface topology
placement cluster similarity
PCB outline/region similarity
```

必须先 Canonicalize，不直接比较文本文件。

---

# 25. Candidate Admission Gate

候选进入深度评估前检查：

```text
artifact exists
version resolvable
hash available
license known or flagged
basic function match
required source permission
not quarantined
no malicious content finding
supported parser
```

---

# 26. Hard Constraint Filter

包括：

```text
required function absent
input voltage incompatible
required isolation absent
mandatory interface absent
physical size impossible
forbidden technology used
required market restriction conflict
license incompatible
critical component unavailable
unsupported EDA version without migration path
```

---

# 27. Function Coverage

状态：

```text
fully_covered
partially_covered
covered_with_adaptation
not_covered
conflicted
unknown
```

---

# 28. Requirement Coverage

每条需求映射：

```text
direct evidence
indirect evidence
candidate inference
no evidence
conflict
```

AI 推断不能算作已验证覆盖。

---

# 29. Interface Compatibility

检查：

```text
port existence
direction
role
connector
pinout
voltage
logic thresholds
current
protocol
version
speed
clocking
termination
isolation
protection
hot plug
mechanical orientation
firmware support
```

---

# 30. Interface Adaptation 类型

```text
no_change
connector_adapter
pin_mapping
level_translation
protocol_bridge
speed_reduction
termination_change
isolation_addition
protection_addition
firmware_adapter
mechanical_adapter
not_feasible
unknown
```

---

# 31. Power Compatibility

检查：

```text
source range
rail voltages
peak current
inrush
sequence
enable
power-good
reverse current
back-power
sleep behavior
battery/charging
efficiency
thermal load
```

---

# 32. Performance Compatibility

必须在条件下比较：

```text
nominal
minimum
maximum
temperature
voltage
load
frequency
mode
sample rate
data rate
latency
accuracy
noise
drift
```

---

# 33. Performance Margin

```text
positive margin
near boundary
negative margin
unknown
condition mismatch
```

---

# 34. Physical Compatibility

```text
board dimensions
module height
connector position
orientation
mounting
keepout
antenna
shield
heatsink
cable
service access
enclosure
```

---

# 35. Manufacturing Compatibility

```text
layer count
stack-up
board technology
via type
surface finish
assembly sides
special process
component package
test access
panel strategy
factory capability
```

---

# 36. Supply and Lifecycle Compatibility

```text
active/NRND/EOL
single source
stock
lead time
MOQ
price class
approved supplier
regional availability
alternate availability
counterfeit risk
```

实时价格和库存由后续供应链 Agent 提供，Agent 13只保存查询时间和来源。

---

# 37. License Compatibility

检查：

```text
license identified
commercial use
modification
distribution
source disclosure
copyleft scope
attribution
notice
patent clause
trademark
hardware license
documentation license
firmware license
third-party dependencies
export restrictions
```

License 不明确时输出 `legal_review_required`。

---

# 38. Reuse Level

```text
L0_reference_only
L1_concept_reuse
L2_interface_reuse
L3_circuit_block_reuse
L4_schematic_reuse
L5_pcb_region_reuse
L6_module_reuse
L7_complete_design_adaptation
```

Level 不等于质量评分。

---

# 39. Modification Class

```text
none
configuration_only
parameter_change
component_substitution
interface_adaptation
power_adaptation
firmware_port
schematic_local_change
pcb_local_change
mechanical_change
verification_only
major_redesign
not_reusable
unknown
```

---

# 40. Reuse Ratio Vector

不只输出单一百分比：

```json
{
  "functional_coverage": 0.82,
  "requirement_evidence_coverage": 0.63,
  "interface_direct_reuse": 0.55,
  "schematic_direct_reuse": 0.48,
  "pcb_direct_reuse": 0.25,
  "firmware_direct_reuse": 0.70,
  "mechanical_direct_reuse": 0.10,
  "verification_evidence_reuse": 0.35,
  "manufacturing_process_reuse": 0.20,
  "overall_candidate_score": null
}
```

---

# 41. 复用比例计算原则

- 分母是目标架构所需对象，而不是来源工程对象；
- 权重由项目 Policy 和 Requirement Criticality 决定；
- 直接复用、配置修改和重设计使用不同系数；
- 未验证覆盖不能按 100% 计入；
- 硬约束失败不因复用比例高而放行；
- 不将低价值对象数量淹没关键功能；
- 计算过程必须可回放。

---

# 42. Weighted Coverage

示例对象权重：

```text
critical function
critical interface
power safety path
high-speed path
core firmware
mechanical envelope
optional LED
documentation
```

权重来源：

```text
requirement priority
architecture criticality
verification risk
project policy
human approval
```

---

# 43. Direct Reuse Factor

建议：

```text
direct unchanged = 1.0
configuration only = policy-defined candidate
parameter adjustment = policy-defined candidate
local adaptation = policy-defined candidate
major redesign = 0
unknown = 0 until reviewed
```

系数必须版本化，不写死为通用事实。

---

# 44. Modification Scope Graph

节点：

```text
requirement
function
block
port
interface
power node
schematic sheet
component
net
pcb region
firmware component
mechanical object
test case
manufacturing artifact
```

边：

```text
must_change
may_change
must_reverify
must_regenerate
depends_on
conflicts_with
```

---

# 45. Modification Scope

输出：

```text
objects retained
objects copied
objects renamed
objects parameterized
objects substituted
objects redrawn
objects deleted
objects newly added
objects requiring verification
objects requiring legal review
```

---

# 46. Change Ripple

例如更换主 MCU：

```text
processor block
→ power rails
→ clocks/resets
→ pin assignments
→ interface peripherals
→ firmware BSP
→ schematic
→ PCB placement/routing
→ test
→ BOM
→ production files
```

---

# 47. EDA Reuse Categories

```text
whole project fork
hierarchical sheet copy
circuit block extraction
symbol/footprint reuse
placement region reuse
routing pattern reference
constraint reuse
stack-up reuse candidate
manufacturing note reuse
```

---

# 48. KiCad Project Health

检查：

```text
project opens
schema version
missing files
library tables
symbol resolution
footprint resolution
3D resolution
absolute paths
environment variables
plugins
custom fonts
submodules
Git LFS
dangling references
ERC/DRC state
unrouted items
zones
board outline
stack-up
variants
```

---

# 49. KiCad Migration

支持：

```text
same version direct parse
older version parse and migrate candidate
newer unsupported version
legacy symbol/footprint conversion
library rescue
path normalization
```

任何迁移先在隔离 Workspace 执行。

---

# 50. Schematic Reuse Analysis

检查：

```text
sheet hierarchy
block boundaries
ports/hierarchical labels
power flags
net naming
component values
ratings
protection
decoupling
test points
simulation directives
annotation
variant fields
```

---

# 51. PCB Reuse Analysis

检查：

```text
board outline
layer stack
placement clusters
fixed connectors
critical routing
differential pairs
power planes
zones
keepouts
mounting holes
test points
manufacturing rules
3D models
```

PCB 复用比原理图复用更依赖目标机械和层叠条件。

---

# 52. Firmware Reuse Analysis

检查：

```text
target processor
SDK/toolchain
RTOS
HAL/BSP
driver API
protocol version
pin mapping
clock
DMA
interrupt
memory
bootloader
security
license
tests
CI
known defects
```

---

# 53. Module Composition

允许多个模块组合覆盖目标架构：

```text
module selection
port matching
power aggregation
address allocation
pin/resource allocation
mechanical packing
firmware integration
cost
supply
```

---

# 54. Composition Conflict

```text
duplicate bus address
voltage conflict
role conflict
pin conflict
clock conflict
power budget overflow
inrush conflict
connector conflict
mechanical overlap
antenna conflict
firmware dependency conflict
license conflict
supplier concentration
```

---

# 55. Composition Candidate IR

```json
{
  "composition_id": "COMP-001",
  "module_candidate_ids": [],
  "covered_block_ids": [],
  "interface_adapters": [],
  "power_architecture": {},
  "mechanical_arrangement": {},
  "firmware_integration": {},
  "coverage": {},
  "conflicts": [],
  "score_vector": {},
  "status": "candidate"
}
```

---

# 56. Adaptation Work Package

每个修改包包含：

```text
scope
source asset
target block
objects changed
dependencies
owner role
estimate candidate
required agent
input gate
expected output
verification
rollback
license obligations
```

---

# 57. Work Package 类型

```text
asset_import
library_rescue
schematic_extraction
schematic_adaptation
component_substitution
interface_adapter
power_adapter
firmware_port
pcb_region_adaptation
mechanical_adapter
test_reuse
documentation_attribution
license_review
full_reverification
```

---

# 58. Effort Estimate

估算输入：

```text
object count
change class
interface count
criticality
EDA health
firmware portability
test evidence
engineer skill
historical reuse actuals
```

估算输出只能是 Candidate，交给 Agent 11 审核。

---

# 59. Validation Reuse

可以复用：

```text
test method
test fixture design
simulation setup
measurement script
acceptance template
reference waveform
known corner cases
```

不能直接复用：

```text
目标项目的 Pass 结论
认证证书
量产良率
安全批准
```

---

# 60. Candidate Score Vector

```text
hard violation count
functional coverage
critical requirement coverage
interface compatibility
power compatibility
performance margin
EDA health
firmware portability
mechanical fit
manufacturing fit
verification evidence quality
lifecycle/supply risk
license compatibility
adaptation effort
schedule benefit
cost class
architecture uncertainty
```

---

# 61. Pareto Set

至少输出：

```text
highest direct reuse
lowest adaptation effort
lowest technical risk
best validation evidence
lowest supply risk
lowest cost class
fastest schedule candidate
balanced candidate
```

---

# 62. Candidate 选择边界

Agent 不自动选择最终候选。

可自动淘汰：

```text
hard requirement violation
known license incompatibility
quarantined asset
critical artifact missing
known unsafe design
unsupported target with no migration path
```

---

# 63. Explainability

每个推荐回答：

```text
为什么被检索到
覆盖哪些需求和功能
哪些接口直接兼容
哪些条件不匹配
复用比例如何计算
必须修改哪些对象
哪些结论有验证证据
哪些仍是未知
为什么优于或劣于其他候选
```

---

# 64. Negative Evidence

必须保存：

```text
missing file
failed test
open issue
unsupported mode
obsolete component
unresolved DRC
license ambiguity
known field failure
manufacturer rejection
```

不能只保存正向卖点。

---

# 65. Version Binding

所有结论绑定：

```text
asset version
commit/tag
artifact hash
library snapshot
component data snapshot
requirement baseline
architecture baseline
evaluation policy
timestamp
```

---

# 66. Freshness

检查：

```text
last source update
last validation
component lifecycle update
firmware dependency update
EDA version
license change
known issue update
```

旧资产不一定不可用，但必须显示陈旧风险。

---

# 67. Human Review Roles

```text
system architect
hardware engineer
firmware engineer
pcb engineer
mechanical engineer
test engineer
supply chain
manufacturing engineer
legal/license reviewer
project manager
```

---

# 68. Reuse Decision Record

```text
selected candidate
rejected candidates
criteria
trade-offs
accepted gaps
required modifications
validation scope
license obligations
approvers
effective architecture baseline
```

---

# 69. Reuse Baseline

包含：

```text
source asset versions
selected asset/module set
reuse ratio vector
modification graph
adaptation work packages
license obligations
verification plan
accepted risks
open questions
approvals
manifest
hash
```

---

# 70. Downstream Reuse Packages

```text
architecture update package
project replan package
eda import package
schematic reuse package
pcb reuse package
firmware reuse package
mechanical reuse package
verification reuse package
bom/supply package
license attribution package
```

---

# 71. AI 允许职责

```text
理解搜索意图
生成语义候选
总结资产功能
识别说明文档中的限制候选
解释推荐原因
生成修改范围草稿
生成比较摘要
```

---

# 72. AI 禁止职责

```text
决定电压、Pinout 和速率兼容
伪造验证证据
自动解释未知许可证
自动批准复用比例
自动选择最终设计
执行来源仓库代码
直接复制到生产工程
关闭风险和缺陷
```

---

# 73. 状态机

```text
RECEIVED
→ VALIDATING_BASELINES
→ SNAPSHOTTING_INPUT
→ BUILDING_SEARCH_INTENT
→ RETRIEVING_ASSETS
→ ADMITTING_CANDIDATES
→ CANONICALIZING_ASSETS
→ VALIDATING_ARTIFACTS
→ EVALUATING_FUNCTION_COVERAGE
→ EVALUATING_INTERFACE_POWER_PERFORMANCE
→ EVALUATING_EDA_FIRMWARE_MECHANICAL
→ EVALUATING_LICENSE_SUPPLY_VALIDATION
→ CALCULATING_REUSE_VECTOR
→ BUILDING_MODIFICATION_SCOPE
→ GENERATING_COMPOSITIONS
→ RANKING_AND_PARETO
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
ASSET_NOT_FOUND
ASSET_QUARANTINED
LICENSE_REVIEW_REQUIRED
ARTIFACT_INCOMPLETE
COMPATIBILITY_BLOCKED
COMPOSITION_CONFLICTED
DECISION_REQUIRED
APPROVAL_REQUIRED
BASELINE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 74. 错误码

```text
PROJECT_NOT_FOUND
REQUIREMENT_BASELINE_NOT_FOUND
ARCHITECTURE_BASELINE_NOT_FOUND
BASELINE_HASH_MISMATCH
SEARCH_INTENT_INCOMPLETE
ASSET_REGISTRY_UNAVAILABLE
ASSET_NOT_FOUND
ASSET_VERSION_UNRESOLVED
ASSET_HASH_MISMATCH
ASSET_PERMISSION_DENIED
ASSET_QUARANTINED
ASSET_FORMAT_UNSUPPORTED
KICAD_PROJECT_PARSE_FAILED
KICAD_LIBRARY_MISSING
KICAD_EXTERNAL_PATH_UNRESOLVED
FIRMWARE_REPOSITORY_INCOMPLETE
GIT_SUBMODULE_MISSING
GIT_LFS_OBJECT_MISSING
LICENSE_UNKNOWN
LICENSE_INCOMPATIBLE
FUNCTION_COVERAGE_INSUFFICIENT
CRITICAL_REQUIREMENT_NOT_COVERED
INTERFACE_INCOMPATIBLE
POWER_INCOMPATIBLE
PERFORMANCE_MARGIN_NEGATIVE
MECHANICAL_FIT_FAILED
MANUFACTURING_FIT_FAILED
COMPONENT_LIFECYCLE_BLOCKED
COMPOSITION_ADDRESS_CONFLICT
COMPOSITION_PIN_CONFLICT
COMPOSITION_POWER_CONFLICT
COMPOSITION_MECHANICAL_CONFLICT
REUSE_RATIO_UNRESOLVED
MODIFICATION_SCOPE_INCOMPLETE
VERIFICATION_PLAN_INCOMPLETE
DECISION_REQUIRED
BASELINE_APPROVAL_MISSING
BASELINE_ALREADY_EXISTS
JOB_CANCELLED
INTERNAL_ERROR


---

# 75. 数据库设计

## 75.1 `reuse_recommendation_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
project_baseline_id UUID NULL
search_profile_id UUID NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
selected_reuse_baseline_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 75.2 `reuse_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
architecture_baseline_hash CHAR(64) NOT NULL
project_baseline_hash CHAR(64) NULL
asset_registry_snapshot_hash CHAR(64) NOT NULL
module_library_snapshot_hash CHAR(64) NOT NULL
kicad_library_snapshot_hash CHAR(64) NULL
component_snapshot_hash CHAR(64) NULL
firmware_registry_snapshot_hash CHAR(64) NULL
license_registry_snapshot_hash CHAR(64) NOT NULL
supply_snapshot_hash CHAR(64) NULL
policy_snapshot_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, snapshot_hash)
```

## 75.3 `reuse_search_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
asset_type_scope JSONB NOT NULL
source_scope JSONB NOT NULL
required_evaluations JSONB NOT NULL
retrieval_policy JSONB NOT NULL
hard_filter_policy JSONB NOT NULL
scoring_policy JSONB NOT NULL
reuse_ratio_policy JSONB NOT NULL
license_policy JSONB NOT NULL
security_policy JSONB NOT NULL
approval_policy JSONB NOT NULL
source_reference JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 75.4 `reference_assets`

```text
id UUID PK
tenant_id UUID NULL
asset_key VARCHAR NOT NULL
asset_type VARCHAR NOT NULL
title VARCHAR NOT NULL
owner_or_vendor VARCHAR NULL
source_type VARCHAR NOT NULL
visibility_scope VARCHAR NOT NULL
security_classification VARCHAR NOT NULL
current_version_id UUID NULL
trust_level VARCHAR NOT NULL
lifecycle_status VARCHAR NOT NULL
taxonomy JSONB NOT NULL
aliases JSONB NOT NULL
part_numbers JSONB NOT NULL
source_references JSONB NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(tenant_id, asset_key)
```

## 75.5 `reference_asset_versions`

```text
id UUID PK
asset_id UUID NOT NULL
version_key VARCHAR NOT NULL
version_string VARCHAR NULL
revision VARCHAR NULL
branch VARCHAR NULL
tag VARCHAR NULL
commit_hash VARCHAR NULL
release_date TIMESTAMPTZ NULL
last_validation_at TIMESTAMPTZ NULL
source_snapshot JSONB NOT NULL
artifact_manifest_uri TEXT NOT NULL
artifact_manifest_hash CHAR(64) NOT NULL
canonical_ir_uri TEXT NULL
canonical_ir_hash CHAR(64) NULL
parser_name VARCHAR NULL
parser_version VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_id, version_key)
```

## 75.6 `reference_asset_artifacts`

```text
id UUID PK
asset_version_id UUID NOT NULL
artifact_key VARCHAR NOT NULL
artifact_type VARCHAR NOT NULL
filename VARCHAR NULL
media_type VARCHAR NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
size_bytes BIGINT NOT NULL
source_locator JSONB NOT NULL
required BOOLEAN NOT NULL
parse_status VARCHAR NOT NULL
security_scan_status VARCHAR NOT NULL
license_scope JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, artifact_key)
```

## 75.7 `reference_asset_parse_runs`

```text
id UUID PK
asset_version_id UUID NOT NULL
parser_family VARCHAR NOT NULL
parser_name VARCHAR NOT NULL
parser_version VARCHAR NOT NULL
input_artifact_ids JSONB NOT NULL
status VARCHAR NOT NULL
warning_count INT NOT NULL
error_count INT NOT NULL
warnings JSONB NOT NULL
errors JSONB NOT NULL
output_ir_uri TEXT NULL
output_ir_hash CHAR(64) NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 75.8 `reference_asset_functions`

```text
id UUID PK
asset_version_id UUID NOT NULL
function_key VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
capability_taxonomy JSONB NOT NULL
inputs JSONB NOT NULL
outputs JSONB NOT NULL
controls JSONB NOT NULL
mode_scope JSONB NOT NULL
performance JSONB NOT NULL
conditions JSONB NOT NULL
limitations JSONB NOT NULL
verification_evidence_ids JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, function_key)
```

## 75.9 `reference_asset_blocks`

```text
id UUID PK
asset_version_id UUID NOT NULL
block_key VARCHAR NOT NULL
parent_block_id UUID NULL
block_type VARCHAR NOT NULL
title VARCHAR NOT NULL
responsibilities JSONB NOT NULL
function_ids JSONB NOT NULL
major_component_refs JSONB NOT NULL
power_node_refs JSONB NOT NULL
firmware_component_refs JSONB NOT NULL
mechanical_attributes JSONB NOT NULL
thermal_attributes JSONB NOT NULL
manufacturing_attributes JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, block_key)
```

## 75.10 `reference_asset_ports`

```text
id UUID PK
asset_version_id UUID NOT NULL
block_id UUID NOT NULL
port_key VARCHAR NOT NULL
port_type VARCHAR NOT NULL
direction VARCHAR NOT NULL
role VARCHAR NULL
connector JSONB NULL
pinout JSONB NOT NULL
electrical JSONB NOT NULL
protocol JSONB NOT NULL
timing JSONB NOT NULL
protection JSONB NOT NULL
isolation JSONB NOT NULL
mechanical_orientation JSONB NOT NULL
variant_scope JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, port_key)
```

## 75.11 `reference_asset_interfaces`

```text
id UUID PK
asset_version_id UUID NOT NULL
interface_key VARCHAR NOT NULL
source_port_ids JSONB NOT NULL
destination_port_ids JSONB NOT NULL
interface_family VARCHAR NOT NULL
roles JSONB NOT NULL
electrical JSONB NOT NULL
protocol JSONB NOT NULL
timing JSONB NOT NULL
throughput JSONB NOT NULL
latency JSONB NOT NULL
error_handling JSONB NOT NULL
verification_evidence_ids JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, interface_key)
```

## 75.12 `reference_asset_power_nodes`

```text
id UUID PK
asset_version_id UUID NOT NULL
power_node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
nominal_voltage JSONB NULL
voltage_range JSONB NULL
current JSONB NOT NULL
peak_current JSONB NULL
inrush JSONB NULL
efficiency JSONB NULL
sequence JSONB NOT NULL
mode_scope JSONB NOT NULL
feeds_block_ids JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, power_node_key)
```

## 75.13 `reference_asset_components`

```text
id UUID PK
asset_version_id UUID NOT NULL
component_key VARCHAR NOT NULL
manufacturer VARCHAR NULL
mpn VARCHAR NULL
normalized_part_id UUID NULL
reference_designators JSONB NOT NULL
quantity JSONB NOT NULL
function_roles JSONB NOT NULL
parameters JSONB NOT NULL
package JSONB NULL
lifecycle_snapshot JSONB NOT NULL
supply_snapshot JSONB NOT NULL
alternate_refs JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, component_key)
```

## 75.14 `reference_asset_eda_manifests`

```text
id UUID PK
asset_version_id UUID NOT NULL
eda_family VARCHAR NOT NULL
eda_version VARCHAR NULL
project_files JSONB NOT NULL
schematic_files JSONB NOT NULL
pcb_files JSONB NOT NULL
symbol_libraries JSONB NOT NULL
footprint_libraries JSONB NOT NULL
model_3d_files JSONB NOT NULL
simulation_models JSONB NOT NULL
bom_files JSONB NOT NULL
constraint_files JSONB NOT NULL
manufacturing_files JSONB NOT NULL
project_settings JSONB NOT NULL
plugins JSONB NOT NULL
scripts JSONB NOT NULL
external_paths JSONB NOT NULL
submodules JSONB NOT NULL
git_lfs_objects JSONB NOT NULL
manifest_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id)
```

## 75.15 `reference_asset_eda_health_runs`

```text
id UUID PK
asset_version_id UUID NOT NULL
agent16_job_id UUID NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
status VARCHAR NOT NULL
project_open_status VARCHAR NOT NULL
schema_version_status VARCHAR NOT NULL
symbol_resolution JSONB NOT NULL
footprint_resolution JSONB NOT NULL
model_3d_resolution JSONB NOT NULL
external_path_findings JSONB NOT NULL
dependency_findings JSONB NOT NULL
erc_summary JSONB NOT NULL
drc_summary JSONB NOT NULL
unrouted_summary JSONB NOT NULL
board_summary JSONB NOT NULL
health_score_vector JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 75.16 `reference_asset_firmware_manifests`

```text
id UUID PK
asset_version_id UUID NOT NULL
repository_reference JSONB NOT NULL
commit_hash VARCHAR NULL
target_processors JSONB NOT NULL
architectures JSONB NOT NULL
toolchains JSONB NOT NULL
sdk_versions JSONB NOT NULL
rtos_versions JSONB NOT NULL
drivers JSONB NOT NULL
middleware JSONB NOT NULL
protocol_stacks JSONB NOT NULL
bootloader JSONB NOT NULL
update_path JSONB NOT NULL
configuration JSONB NOT NULL
tests JSONB NOT NULL
ci JSONB NOT NULL
known_issues JSONB NOT NULL
license_components JSONB NOT NULL
manifest_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id)
```

## 75.17 `reference_asset_mechanical_manifests`

```text
id UUID PK
asset_version_id UUID NOT NULL
step_files JSONB NOT NULL
stl_files JSONB NOT NULL
dxf_files JSONB NOT NULL
board_outlines JSONB NOT NULL
height_map JSONB NOT NULL
connector_positions JSONB NOT NULL
mounting JSONB NOT NULL
enclosure JSONB NOT NULL
heatsinks JSONB NOT NULL
shields JSONB NOT NULL
cables JSONB NOT NULL
tolerances JSONB NOT NULL
manifest_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id)
```

## 75.18 `reference_asset_manufacturing_manifests`

```text
id UUID PK
asset_version_id UUID NOT NULL
gerber_files JSONB NOT NULL
drill_files JSONB NOT NULL
bom_files JSONB NOT NULL
cpl_files JSONB NOT NULL
assembly_drawings JSONB NOT NULL
stencil_files JSONB NOT NULL
panel_files JSONB NOT NULL
test_instructions JSONB NOT NULL
programming_files JSONB NOT NULL
process_notes JSONB NOT NULL
supplier_feedback JSONB NOT NULL
yield_evidence JSONB NOT NULL
manifest_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id)
```

## 75.19 `reference_asset_verification_evidence`

```text
id UUID PK
asset_version_id UUID NOT NULL
evidence_key VARCHAR NOT NULL
evidence_type VARCHAR NOT NULL
title VARCHAR NOT NULL
artifact_id UUID NULL
source_reference JSONB NOT NULL
version_binding JSONB NOT NULL
test_setup JSONB NOT NULL
conditions JSONB NOT NULL
measurements JSONB NOT NULL
results JSONB NOT NULL
sample_context JSONB NOT NULL
repeatability JSONB NOT NULL
independence VARCHAR NOT NULL
evidence_quality_vector JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, evidence_key)
```

## 75.20 `reference_asset_licenses`

```text
id UUID PK
asset_version_id UUID NOT NULL
license_key VARCHAR NOT NULL
license_identifier VARCHAR NULL
license_text_hash CHAR(64) NULL
scope_type VARCHAR NOT NULL
commercial_use VARCHAR NOT NULL
modification VARCHAR NOT NULL
distribution VARCHAR NOT NULL
source_disclosure VARCHAR NOT NULL
copyleft_scope JSONB NOT NULL
attribution JSONB NOT NULL
notice_requirements JSONB NOT NULL
patent_clause JSONB NOT NULL
trademark JSONB NOT NULL
export_restrictions JSONB NOT NULL
third_party_dependencies JSONB NOT NULL
review_status VARCHAR NOT NULL
reviewed_by UUID NULL
reviewed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, license_key)
```

## 75.21 `reference_asset_known_issues`

```text
id UUID PK
asset_version_id UUID NOT NULL
issue_key VARCHAR NOT NULL
issue_type VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
severity VARCHAR NOT NULL
affected_objects JSONB NOT NULL
conditions JSONB NOT NULL
workaround JSONB NULL
resolution_version JSONB NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(asset_version_id, issue_key)
```

## 75.22 `reference_asset_security_scans`

```text
id UUID PK
asset_version_id UUID NOT NULL
scan_engine VARCHAR NOT NULL
scan_engine_version VARCHAR NOT NULL
artifact_count INT NOT NULL
script_count INT NOT NULL
binary_count INT NOT NULL
archive_count INT NOT NULL
malware_findings JSONB NOT NULL
secret_findings JSONB NOT NULL
path_findings JSONB NOT NULL
dependency_risk_findings JSONB NOT NULL
quarantine_reasons JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 75.23 `asset_search_intents`

```text
id UUID PK
job_id UUID NOT NULL
intent_version INT NOT NULL
scope_type VARCHAR NOT NULL
target_requirement_ids JSONB NOT NULL
target_function_ids JSONB NOT NULL
target_block_ids JSONB NOT NULL
required_ports JSONB NOT NULL
required_interfaces JSONB NOT NULL
power_requirements JSONB NOT NULL
performance_requirements JSONB NOT NULL
mode_requirements JSONB NOT NULL
mechanical_constraints JSONB NOT NULL
manufacturing_constraints JSONB NOT NULL
cost_constraints JSONB NOT NULL
lifecycle_constraints JSONB NOT NULL
reuse_preferences JSONB NOT NULL
forbidden_technologies JSONB NOT NULL
verification_requirements JSONB NOT NULL
intent_uri TEXT NOT NULL
intent_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, intent_version)
```

## 75.24 `asset_retrieval_runs`

```text
id UUID PK
job_id UUID NOT NULL
search_intent_id UUID NOT NULL
provider_name VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
retrieval_type VARCHAR NOT NULL
query_representation JSONB NOT NULL
index_snapshot_hash CHAR(64) NOT NULL
candidate_count INT NOT NULL
duration_ms BIGINT NOT NULL
status VARCHAR NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 75.25 `asset_retrieval_candidates`

```text
id UUID PK
job_id UUID NOT NULL
asset_version_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
retrieval_run_ids JSONB NOT NULL
lexical_scores JSONB NOT NULL
semantic_scores JSONB NOT NULL
parameter_scores JSONB NOT NULL
graph_scores JSONB NOT NULL
eda_structure_scores JSONB NOT NULL
historical_reuse_scores JSONB NOT NULL
retrieval_explanation JSONB NOT NULL
admission_status VARCHAR NOT NULL
admission_findings JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, candidate_key)
```

## 75.26 `asset_candidate_evaluation_runs`

```text
id UUID PK
job_id UUID NOT NULL
candidate_id UUID NOT NULL
evaluation_profile_version VARCHAR NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
function_status VARCHAR NOT NULL
interface_status VARCHAR NOT NULL
power_status VARCHAR NOT NULL
performance_status VARCHAR NOT NULL
eda_status VARCHAR NOT NULL
firmware_status VARCHAR NOT NULL
mechanical_status VARCHAR NOT NULL
manufacturing_status VARCHAR NOT NULL
supply_status VARCHAR NOT NULL
license_status VARCHAR NOT NULL
verification_status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 75.27 `asset_function_matches`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
target_function_id UUID NOT NULL
source_function_id UUID NULL
coverage_status VARCHAR NOT NULL
adaptation_class VARCHAR NOT NULL
condition_match JSONB NOT NULL
performance_match JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
explanation_trace JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.28 `asset_requirement_matches`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
requirement_id UUID NOT NULL
source_object_refs JSONB NOT NULL
coverage_status VARCHAR NOT NULL
evidence_class VARCHAR NOT NULL
conflicts JSONB NOT NULL
conditions JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.29 `asset_interface_matches`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
target_interface_id UUID NOT NULL
source_interface_id UUID NULL
compatibility_status VARCHAR NOT NULL
port_match JSONB NOT NULL
role_match JSONB NOT NULL
connector_match JSONB NOT NULL
pinout_match JSONB NOT NULL
electrical_match JSONB NOT NULL
protocol_match JSONB NOT NULL
timing_match JSONB NOT NULL
protection_match JSONB NOT NULL
mechanical_match JSONB NOT NULL
adaptation_type VARCHAR NOT NULL
required_changes JSONB NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.30 `asset_power_matches`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
target_power_ref JSONB NOT NULL
source_power_ref JSONB NULL
compatibility_status VARCHAR NOT NULL
voltage_match JSONB NOT NULL
current_match JSONB NOT NULL
peak_inrush_match JSONB NOT NULL
sequence_match JSONB NOT NULL
mode_match JSONB NOT NULL
efficiency_match JSONB NOT NULL
thermal_effect JSONB NOT NULL
required_changes JSONB NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.31 `asset_performance_matches`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
target_metric_ref JSONB NOT NULL
source_metric_ref JSONB NULL
compatibility_status VARCHAR NOT NULL
target_value JSONB NOT NULL
source_value JSONB NULL
condition_comparison JSONB NOT NULL
margin JSONB NULL
adaptation_required JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.32 `asset_fit_assessments`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
fit_domain VARCHAR NOT NULL
fit_status VARCHAR NOT NULL
target_context JSONB NOT NULL
source_context JSONB NOT NULL
fit_gaps JSONB NOT NULL
required_changes JSONB NOT NULL
risk_summary JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 75.33 `asset_reuse_ratio_vectors`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
policy_version VARCHAR NOT NULL
functional_coverage NUMERIC NOT NULL
requirement_evidence_coverage NUMERIC NOT NULL
interface_direct_reuse NUMERIC NOT NULL
schematic_direct_reuse NUMERIC NOT NULL
pcb_direct_reuse NUMERIC NOT NULL
firmware_direct_reuse NUMERIC NOT NULL
mechanical_direct_reuse NUMERIC NOT NULL
verification_evidence_reuse NUMERIC NOT NULL
manufacturing_process_reuse NUMERIC NOT NULL
weighted_components JSONB NOT NULL
calculation_trace JSONB NOT NULL
unknown_weight NUMERIC NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.34 `asset_modification_graph_versions`

```text
id UUID PK
job_id UUID NOT NULL
candidate_id UUID NOT NULL
graph_version VARCHAR NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, candidate_id, graph_version)
```

## 75.35 `asset_modification_nodes`

```text
id UUID PK
graph_version_id UUID NOT NULL
node_key VARCHAR NOT NULL
object_type VARCHAR NOT NULL
source_object_ref JSONB NULL
target_object_ref JSONB NULL
modification_class VARCHAR NOT NULL
reuse_level VARCHAR NOT NULL
criticality VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, node_key)
```

## 75.36 `asset_modification_edges`

```text
id UUID PK
graph_version_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
propagation_reason JSONB NOT NULL
verification_effect JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, source_node_id, target_node_id, edge_type)
```

## 75.37 `module_composition_candidates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
composition_key VARCHAR NOT NULL
module_candidate_ids JSONB NOT NULL
covered_block_ids JSONB NOT NULL
interface_adapters JSONB NOT NULL
power_architecture JSONB NOT NULL
mechanical_arrangement JSONB NOT NULL
firmware_integration JSONB NOT NULL
coverage_summary JSONB NOT NULL
conflict_summary JSONB NOT NULL
score_vector JSONB NOT NULL
pareto_rank INT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, composition_key)
```

## 75.38 `module_composition_conflicts`

```text
id UUID PK
composition_id UUID NOT NULL
conflict_key VARCHAR NOT NULL
conflict_type VARCHAR NOT NULL
affected_modules JSONB NOT NULL
affected_ports JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
repair_candidates JSONB NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(composition_id, conflict_key)
```

## 75.39 `reuse_adaptation_work_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
candidate_id UUID NULL
composition_id UUID NULL
work_package_key VARCHAR NOT NULL
work_package_type VARCHAR NOT NULL
title VARCHAR NOT NULL
scope JSONB NOT NULL
source_asset_refs JSONB NOT NULL
target_object_refs JSONB NOT NULL
modification_node_ids JSONB NOT NULL
dependencies JSONB NOT NULL
owner_role VARCHAR NOT NULL
estimate_candidate JSONB NULL
required_agent VARCHAR NULL
input_gate JSONB NOT NULL
expected_outputs JSONB NOT NULL
verification_plan JSONB NOT NULL
rollback_plan JSONB NOT NULL
license_obligations JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, work_package_key)
```

## 75.40 `reuse_candidate_scores`

```text
id UUID PK
job_id UUID NOT NULL
candidate_type VARCHAR NOT NULL
candidate_ref JSONB NOT NULL
scoring_policy_version VARCHAR NOT NULL
hard_violation_count INT NOT NULL
score_vector JSONB NOT NULL
pareto_rank INT NULL
explanation_trace JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.41 `reuse_review_packages`

```text
id UUID PK
job_id UUID NOT NULL
package_version INT NOT NULL
search_intent_summary JSONB NOT NULL
candidate_summary JSONB NOT NULL
reuse_vector_summary JSONB NOT NULL
modification_summary JSONB NOT NULL
license_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
risk_summary JSONB NOT NULL
composition_summary JSONB NOT NULL
decision_questions JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, package_version)
```

## 75.42 `reuse_decision_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
decision_key VARCHAR NOT NULL
job_id UUID NOT NULL
selected_candidate_refs JSONB NOT NULL
rejected_candidate_refs JSONB NOT NULL
criteria JSONB NOT NULL
tradeoffs JSONB NOT NULL
accepted_gaps JSONB NOT NULL
required_modifications JSONB NOT NULL
verification_scope JSONB NOT NULL
license_obligations JSONB NOT NULL
approvals JSONB NOT NULL
effective_architecture_baseline_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 75.43 `reuse_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
project_baseline_id UUID NULL
decision_record_id UUID NOT NULL
source_asset_versions JSONB NOT NULL
selected_candidate_refs JSONB NOT NULL
reuse_ratio_vectors JSONB NOT NULL
modification_graph_hashes JSONB NOT NULL
adaptation_work_packages JSONB NOT NULL
license_obligations JSONB NOT NULL
verification_plan JSONB NOT NULL
accepted_risks JSONB NOT NULL
open_questions JSONB NOT NULL
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

## 75.44 `reuse_downstream_packages`

```text
id UUID PK
reuse_baseline_id UUID NOT NULL
package_type VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
target_agent VARCHAR NULL
content_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
source_asset_trace JSONB NOT NULL
target_architecture_trace JSONB NOT NULL
input_gate JSONB NOT NULL
license_obligations JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(reuse_baseline_id, package_type, target_agent)
```

## 75.45 `reuse_change_impact_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_reuse_baseline_id UUID NOT NULL
requirement_change_request_id UUID NULL
architecture_change_impact_id UUID NULL
changed_target_objects JSONB NOT NULL
invalidated_candidate_refs JSONB NOT NULL
affected_reuse_vectors JSONB NOT NULL
affected_modification_graphs JSONB NOT NULL
affected_work_packages JSONB NOT NULL
affected_license_obligations JSONB NOT NULL
required_retrieval_scope JSONB NOT NULL
required_reverification JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_uri TEXT NOT NULL
impact_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.46 `reuse_feedback_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
reuse_baseline_id UUID NOT NULL
source_asset_version_id UUID NOT NULL
feedback_type VARCHAR NOT NULL
actual_reuse_results JSONB NOT NULL
actual_modification_scope JSONB NOT NULL
actual_effort JSONB NULL
defect_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
manufacturing_summary JSONB NOT NULL
recommendation_quality JSONB NOT NULL
data_quality VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.47 `asset_index_build_runs`

```text
id UUID PK
index_type VARCHAR NOT NULL
index_version VARCHAR NOT NULL
source_snapshot_hash CHAR(64) NOT NULL
asset_version_count BIGINT NOT NULL
object_count BIGINT NOT NULL
embedding_model JSONB NULL
graph_schema_version VARCHAR NULL
eda_signature_version VARCHAR NULL
status VARCHAR NOT NULL
index_uri TEXT NOT NULL
index_hash CHAR(64) NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

---

# 76. 对象存储

```text
derived/reuse-recommendation/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          requirement-baseline.json
          architecture-baseline.json
          project-baseline.json
          search-profile.json
          input-snapshot.json
          asset-registry-snapshot.json
          module-library-snapshot.json
          component-snapshot.json
          firmware-snapshot.json
          license-snapshot.json
          policy.json
        intent/
          search-intent.json
          target-functions.jsonl.zst
          target-interfaces.jsonl.zst
          target-power.json
          hard-constraints.json
        retrieval/
          exact/
          lexical/
          parameter/
          semantic/
          graph/
          eda-structure/
          firmware/
          candidate-union.parquet
          retrieval-trace.jsonl.zst
        candidates/
          admitted/
          rejected/
          canonical-ir/
          asset-manifests/
          security-scans/
        evaluation/
          function/
          requirements/
          interfaces/
          power/
          performance/
          eda/
          firmware/
          mechanical/
          manufacturing/
          supply/
          license/
          verification/
        reuse/
          reuse-vectors.parquet
          calculation-traces/
          weighted-coverage/
          unknowns.jsonl.zst
        modification/
          graphs/
          node-matrices/
          ripple-analysis/
          adaptation-work-packages.jsonl.zst
        composition/
          plans/
          candidates/
          conflicts/
          pareto-set.json
        ranking/
          score-vectors.parquet
          hard-filter-results.jsonl.zst
          pareto.json
          explanations/
        review/
          review-package.html
          review-package.pdf
          candidate-comparison.csv
          reuse-vectors.csv
          modification-scope.csv
          license-obligations.csv
          decisions/
          approvals/
        baseline/
          reuse-baseline.json
          release-manifest.json
          downstream-packages/
        changes/
          impact/
          reretrieval/
          baseline-diffs/
        feedback/
          actual-reuse/
          effort/
          defects/
          validation/
        debug/
          parser-trace.jsonl.zst
          retrieval-trace.jsonl.zst
          match-trace.jsonl.zst
          scoring-trace.jsonl.zst
          model-trace.jsonl.zst
          resource-usage.json
```

全局资产区：

```text
assets/reference-library/
  {asset_id}/{version_key}/
    originals/
    normalized/
    manifests/
    canonical-ir/
    security/
    licenses/
    verification/
    indexes/
```

---

# 77. API 设计

## 77.1 Jobs

```text
POST /api/v1/reuse/jobs
POST /api/v1/reuse/jobs/batch
GET  /api/v1/reuse/jobs/{id}
GET  /api/v1/reuse/jobs/{id}/events
POST /api/v1/reuse/jobs/{id}/cancel
POST /api/v1/reuse/jobs/{id}/retry
POST /api/v1/reuse/jobs/{id}/rerun
```

## 77.2 Readiness and Snapshot

```text
POST /api/v1/reuse/jobs/{id}/validate-readiness
GET  /api/v1/reuse/jobs/{id}/readiness
POST /api/v1/reuse/jobs/{id}/freeze-input
GET  /api/v1/reuse/jobs/{id}/input-snapshot
```

## 77.3 Search Profiles

```text
POST /api/v1/reuse/search-profiles
GET  /api/v1/reuse/search-profiles
GET  /api/v1/reuse/search-profiles/{id}
POST /api/v1/reuse/search-profiles/{id}/validate
POST /api/v1/reuse/search-profiles/{id}/approve
POST /api/v1/reuse/search-profiles/{id}/deprecate
```

## 77.4 Asset Registry

```text
POST /api/v1/reference-assets
GET  /api/v1/reference-assets
GET  /api/v1/reference-assets/{id}
GET  /api/v1/reference-assets/{id}/versions
POST /api/v1/reference-assets/{id}/versions
POST /api/v1/reference-assets/{id}/archive
POST /api/v1/reference-assets/{id}/quarantine
POST /api/v1/reference-assets/{id}/restore
```

## 77.5 Asset Ingestion

```text
POST /api/v1/reference-assets/ingest
POST /api/v1/reference-assets/import-repository
POST /api/v1/reference-assets/import-kicad
POST /api/v1/reference-assets/import-module
POST /api/v1/reference-assets/versions/{id}/parse
POST /api/v1/reference-assets/versions/{id}/scan-security
POST /api/v1/reference-assets/versions/{id}/build-canonical-ir
GET  /api/v1/reference-assets/versions/{id}/manifest
```

## 77.6 Asset Analysis

```text
POST /api/v1/reference-assets/versions/{id}/analyze-eda-health
POST /api/v1/reference-assets/versions/{id}/analyze-firmware
POST /api/v1/reference-assets/versions/{id}/analyze-mechanical
POST /api/v1/reference-assets/versions/{id}/analyze-manufacturing
POST /api/v1/reference-assets/versions/{id}/analyze-license
GET  /api/v1/reference-assets/versions/{id}/analysis
GET  /api/v1/reference-assets/versions/{id}/known-issues
GET  /api/v1/reference-assets/versions/{id}/verification-evidence
```

## 77.7 Search Intent and Retrieval

```text
POST /api/v1/reuse/jobs/{id}/build-search-intent
GET  /api/v1/reuse/jobs/{id}/search-intent
POST /api/v1/reuse/jobs/{id}/retrieve
GET  /api/v1/reuse/jobs/{id}/retrieval-runs
GET  /api/v1/reuse/jobs/{id}/candidates
POST /api/v1/reuse/jobs/{id}/rerank
```

## 77.8 Candidate Admission

```text
POST /api/v1/reuse/candidates/{id}/validate-admission
POST /api/v1/reuse/candidates/{id}/admit
POST /api/v1/reuse/candidates/{id}/reject
GET  /api/v1/reuse/candidates/{id}/admission-findings
```

## 77.9 Deep Evaluation

```text
POST /api/v1/reuse/candidates/{id}/evaluate
GET  /api/v1/reuse/candidates/{id}/evaluation
GET  /api/v1/reuse/candidates/{id}/function-matches
GET  /api/v1/reuse/candidates/{id}/requirement-matches
GET  /api/v1/reuse/candidates/{id}/interface-matches
GET  /api/v1/reuse/candidates/{id}/power-matches
GET  /api/v1/reuse/candidates/{id}/performance-matches
GET  /api/v1/reuse/candidates/{id}/fit-assessments
```

## 77.10 Reuse Ratio and Modification Scope

```text
POST /api/v1/reuse/candidates/{id}/calculate-reuse-vector
GET  /api/v1/reuse/candidates/{id}/reuse-vector
POST /api/v1/reuse/candidates/{id}/build-modification-graph
GET  /api/v1/reuse/candidates/{id}/modification-graph
POST /api/v1/reuse/candidates/{id}/generate-adaptation-work-packages
GET  /api/v1/reuse/candidates/{id}/adaptation-work-packages
```

## 77.11 Module Composition

```text
POST /api/v1/reuse/jobs/{id}/generate-compositions
GET  /api/v1/reuse/jobs/{id}/compositions
GET  /api/v1/reuse/compositions/{id}
POST /api/v1/reuse/compositions/{id}/evaluate
GET  /api/v1/reuse/compositions/{id}/conflicts
POST /api/v1/reuse/compositions/{id}/repair-candidates
```

## 77.12 Ranking and Pareto

```text
POST /api/v1/reuse/jobs/{id}/score
POST /api/v1/reuse/jobs/{id}/build-pareto
GET  /api/v1/reuse/jobs/{id}/pareto
GET  /api/v1/reuse/jobs/{id}/candidate-comparison
```

## 77.13 Review and Decision

```text
POST /api/v1/reuse/jobs/{id}/review-package
GET  /api/v1/reuse/jobs/{id}/review-package
POST /api/v1/reuse/jobs/{id}/submit-review
POST /api/v1/reuse/jobs/{id}/decision-record
GET  /api/v1/reuse/jobs/{id}/decision-record
POST /api/v1/reuse/decisions/{id}/approve
```

## 77.14 Baseline and Downstream

```text
POST /api/v1/reuse/jobs/{id}/baseline-candidates
GET  /api/v1/projects/{project_id}/reuse-baselines
GET  /api/v1/reuse/baselines/{id}
POST /api/v1/reuse/baselines/{id}/approve
POST /api/v1/reuse/baselines/{id}/freeze
GET  /api/v1/reuse/baselines/{id}/manifest
POST /api/v1/reuse/baselines/{id}/generate-downstream-packages
GET  /api/v1/reuse/baselines/{id}/downstream-packages
```

## 77.15 Changes and Feedback

```text
POST /api/v1/reuse/baselines/{id}/analyze-change
GET  /api/v1/reuse/change-impacts/{id}
POST /api/v1/reuse/baselines/{id}/feedback
GET  /api/v1/reference-assets/versions/{id}/reuse-history
GET  /api/v1/reuse/jobs/{id}/report
GET  /api/v1/reuse/jobs/{id}/candidate-comparison.csv
GET  /api/v1/reuse/jobs/{id}/reuse-vectors.csv
GET  /api/v1/reuse/jobs/{id}/modification-scope.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 78. 输入事件

```text
requirements.baseline-frozen
architecture.baseline-frozen
architecture.change-impact-ready
project-planning.reuse-task-ready
reference-asset.created
reference-asset.updated
reference-asset.validation-updated
module-library.updated
component-lifecycle.updated
firmware-registry.updated
license-registry.updated
reuse.requested
```

---

# 79. 输出事件

```text
reuse.input-blocked
reuse.search-intent-ready
reuse.no-candidate-found
reuse.candidates-ready
reuse.asset-quarantined
reuse.license-review-required
reuse.hard-incompatibility-detected
reuse.composition-conflict-detected
reuse.review-required
reuse.decision-required
reuse.baseline-candidate-ready
reuse.baseline-frozen
reuse.downstream-packages-ready
reuse.change-impact-ready
reuse.completed
reuse.failed
```

---

# 80. 下游事件

```text
project-planning.reuse-work-packages-ready
architecture.reuse-candidate-ready
eda.reuse-import-package-ready
firmware.reuse-package-ready
pcb.reuse-package-ready
mechanical.reuse-package-ready
verification.reuse-package-ready
supply.reuse-package-ready
```

---

# 81. Policy 组织

```text
policies/
├── reference-reuse-1.0.0.yaml
├── readiness-gates.yaml
├── assets/
│   ├── asset-types.yaml
│   ├── source-types.yaml
│   ├── trust-levels.yaml
│   ├── lifecycle-status.yaml
│   └── admission.yaml
├── ingestion/
│   ├── artifact-types.yaml
│   ├── parsers.yaml
│   ├── security.yaml
│   ├── canonicalization.yaml
│   └── version-binding.yaml
├── retrieval/
│   ├── exact.yaml
│   ├── lexical.yaml
│   ├── parameter.yaml
│   ├── semantic.yaml
│   ├── graph.yaml
│   ├── eda-structure.yaml
│   ├── candidate-union.yaml
│   └── rerank.yaml
├── compatibility/
│   ├── functions.yaml
│   ├── requirements.yaml
│   ├── interfaces.yaml
│   ├── power.yaml
│   ├── performance.yaml
│   ├── eda.yaml
│   ├── firmware.yaml
│   ├── mechanical.yaml
│   ├── manufacturing.yaml
│   └── supply.yaml
├── reuse/
│   ├── levels.yaml
│   ├── modification-classes.yaml
│   ├── weighted-coverage.yaml
│   ├── direct-reuse-factors.yaml
│   └── unknowns.yaml
├── composition/
│   ├── generation.yaml
│   ├── address-conflicts.yaml
│   ├── pin-conflicts.yaml
│   ├── power-conflicts.yaml
│   ├── mechanical-conflicts.yaml
│   └── firmware-conflicts.yaml
├── scoring/
│   ├── hard-constraints.yaml
│   ├── objectives.yaml
│   ├── normalization.yaml
│   ├── pareto.yaml
│   └── explanations.yaml
├── licensing/
│   ├── identification.yaml
│   ├── compatibility.yaml
│   ├── attribution.yaml
│   ├── copyleft.yaml
│   ├── patents.yaml
│   └── legal-review.yaml
├── verification/
│   ├── evidence-quality.yaml
│   ├── reuse.yaml
│   └── regression.yaml
├── work-packages.yaml
├── baseline.yaml
├── changes.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 82. Asset Ingestion Provider

```python
class ReferenceAssetIngestionProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_source(self, source) -> ValidationResult: ...
    async def inventory(self, source) -> ArtifactManifest: ...
    async def parse(self, manifest) -> CanonicalAssetIR: ...
    async def scan_security(self, manifest) -> SecurityScanResult: ...
    async def explain(self, result) -> IngestionTrace: ...
```

Provider 类型：

```text
enterprise_object_storage
git_repository
kicad_project
module_database
vendor_package
document_only
historical_project
marketplace_product
```

---

# 83. Retrieval Provider

```python
class AssetRetrievalProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def retrieve(self, intent, snapshot) -> CandidateSet: ...
    async def explain(self, candidate) -> RetrievalTrace: ...
```

Provider：

```text
exact_identifier
lexical
parameter
semantic
graph
eda_structure
firmware_api
historical_reuse
```

---

# 84. Compatibility Provider

```python
class ReuseCompatibilityProvider:
    async def validate_input(self, target, source) -> ValidationResult: ...
    async def evaluate(self, target, source) -> CompatibilityReport: ...
    async def explain(self, report) -> CompatibilityTrace: ...
```

领域 Provider：

```text
function
interface
power
performance
eda
firmware
mechanical
manufacturing
supply
license
verification
```

---

# 85. Search Indexes

建议：

```text
relational metadata index
full-text index
parameter/range index
vector index
typed graph index
EDA structural signature index
firmware symbol/API index
component/BOM inverted index
```

任何索引结果都必须回到 Canonical Asset IR。

---

# 86. EDA Structural Signature

可包含：

```text
hierarchical sheet signature
component family multiset
normalized net graph
power topology
interface topology
constraint signature
placement cluster signature
critical route signature
```

签名版本化，并允许重新构建。

---

# 87. Semantic Index

只存：

```text
approved or bounded summaries
function descriptions
application descriptions
limitations
known issues
verification summaries
```

不把完整私有工程发送给外部 Embedding Provider。

---

# 88. License Registry

License 结果来源：

```text
SPDX identifier
repository metadata
license file
file headers
vendor terms
manual legal review
third-party dependency manifest
```

自动识别结果保持 Candidate，未知和冲突进入人工审核。

---

# 89. Security Sandbox

导入 Git/KiCad/压缩包时：

```text
no execution
no network by default
read-only mount
resource limits
archive limits
path normalization
symlink rejection or containment
binary inventory
secret scan
malware scan
dependency manifest only
```

---

# 90. Candidate Review Workbench

界面建议：

```text
左：Search Intent / Filters / Sources / Asset Types
中：Candidate Cards / Architecture Coverage / Module Composition
右：Fit / Gaps / Reuse Vector / License / Evidence
下：EDA / Firmware / Mechanical / Supply / Modification Graph / Decision
```

---

# 91. Review 操作

```text
查看推荐原因
查看来源版本和证据
调整检索范围
比较功能覆盖
查看接口矩阵
查看电源和性能 Margin
检查 KiCad Health
检查 Firmware Portability
检查 License
查看 Modification Graph
生成组合候选
批准/拒绝候选
创建 Reuse Decision
生成 Work Packages
冻结 Reuse Baseline
```

---

# 92. 可观测性

```text
reuse_jobs_total{status,profile}
reuse_job_duration_seconds{step}
reference_assets_total{type,trust,status}
reference_asset_parse_runs_total{parser,status}
reference_asset_security_findings_total{type,severity}
reuse_retrieval_candidates_total{provider,admission}
reuse_candidate_evaluations_total{domain,status}
reuse_function_coverage_ratio{priority}
reuse_interface_compatibility_total{status}
reuse_license_results_total{status}
reuse_vectors_distribution{dimension}
reuse_compositions_total{status}
reuse_composition_conflicts_total{type}
reuse_work_packages_total{type,status}
reuse_baselines_total{status}
reuse_feedback_accuracy{dimension}
reuse_external_model_calls_total{provider,status}
```

---

# 93. Dashboard

```text
Asset Registry
Asset Freshness
Asset Trust
KiCad Health
Firmware Health
License Review
Security Quarantine
Search Jobs
Candidate Coverage
Interface Compatibility
Power/Performance Fit
Reuse Vectors
Modification Scope
Module Compositions
Pareto
Decisions
Baselines
Actual Reuse Feedback
```

---

# 94. 安全与权限

- 私有参考设计、客户项目和模块资产按租户、项目和资产权限隔离；
- 来源仓库凭证只用于受控拉取，不进入日志、Prompt 或 Artifact；
- Git、ZIP、KiCad、脚本、插件、二进制和子模块全部视为不可信；
- 默认不执行代码、宏、CI、插件、生成器或安装脚本；
- 外部 URL 只允许白名单和显式 Connector；
- 防止 Zip Slip、Symlink Escape、Path Traversal、Decompression Bomb 和 Git Submodule Escape；
- 导入仓库执行 Secret Scan，但敏感内容不得写入普通报告；
- 许可证、商业条款和出口限制按权限展示；
- Legal Review、Reuse Decision、Agent 19 写入和 Baseline Approval 分权；
- 参考设计中的 Gerber、程序和密钥不能直接进入目标发布包；
- 不向外部模型发送完整 KiCad 工程、Firmware Source、BOM、客户架构和供应商数据；
- Semantic Summary 可在本地生成后再按 Policy 建索引；
- Prompt 使用类型化 Search Intent，来源 README 不能覆盖系统指令；
- Asset、Version、Evidence、License、Decision、Baseline 和 Feedback 不可硬删除；
- 所有 Downstream Package 绑定 Hash、Version、Baseline 和 License Obligations；
- 公开 Fixture 只使用开源、合成、脱敏或授权资产。

---

# 95. 推荐技术栈

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

检索和图：

```text
PostgreSQL full text or OpenSearch adapter
pgvector or approved vector store
typed graph in PostgreSQL first
NetworkX for local graph analysis
optional dedicated graph database adapter
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
Agent 16 Canonical EDA IR
KiCad project inventory adapter
Git object and manifest adapter
structural signature generator
```

安全：

```text
sandboxed workers
read-only filesystem
archive scanner
secret scanner
malware adapter
SBOM/license scanner adapter
```

前端：

```text
React
TypeScript
Candidate Comparison
Graph/Architecture Viewer
KiCad Preview
Reuse Vector
Modification Scope Graph
License/Evidence Panel
```

模型：

```text
provider abstraction
structured output
local/private embeddings
local/private language model option
prompt/model/version registry
```

---

# 96. 推荐仓库结构

```text
reference-reuse-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── reference-reuse-agent-spec.md
│   ├── input-and-search-intent.md
│   ├── asset-registry-and-versioning.md
│   ├── canonical-reference-asset-ir.md
│   ├── asset-ingestion-and-security.md
│   ├── hybrid-retrieval.md
│   ├── eda-structural-retrieval.md
│   ├── compatibility-evaluation.md
│   ├── reuse-ratio-model.md
│   ├── modification-scope-graph.md
│   ├── module-composition.md
│   ├── license-and-ip.md
│   ├── verification-evidence.md
│   ├── adaptation-work-packages.md
│   ├── scoring-and-pareto.md
│   ├── baselines-and-feedback.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-canonical-ir-is-search-truth.md
│       ├── 0002-reuse-is-a-vector-not-one-percentage.md
│       ├── 0003-similarity-is-not-compatibility.md
│       ├── 0004-source-production-files-are-not-target-release.md
│       ├── 0005-license-and-negative-evidence-are-first-class.md
│       ├── 0006-ai-proposes-candidates-only.md
│       └── 0007-reuse-baselines-are-immutable.md
├── src/
│   └── reference_reuse/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent10.py
│       │   ├── agent11.py
│       │   ├── agent12.py
│       │   ├── agent16.py
│       │   ├── asset_storage.py
│       │   ├── git.py
│       │   ├── modules.py
│       │   ├── components.py
│       │   ├── firmware.py
│       │   ├── licenses.py
│       │   └── downstream.py
│       ├── intake/
│       │   ├── readiness.py
│       │   ├── snapshots.py
│       │   ├── search_intent.py
│       │   └── scopes.py
│       ├── registry/
│       │   ├── assets.py
│       │   ├── versions.py
│       │   ├── artifacts.py
│       │   ├── trust.py
│       │   └── freshness.py
│       ├── ingestion/
│       │   ├── providers.py
│       │   ├── inventory.py
│       │   ├── git_repo.py
│       │   ├── kicad.py
│       │   ├── module.py
│       │   ├── firmware.py
│       │   ├── mechanical.py
│       │   ├── manufacturing.py
│       │   ├── canonicalize.py
│       │   └── quarantine.py
│       ├── security/
│       │   ├── sandbox.py
│       │   ├── archives.py
│       │   ├── paths.py
│       │   ├── secrets.py
│       │   ├── malware.py
│       │   └── permissions.py
│       ├── indexes/
│       │   ├── metadata.py
│       │   ├── full_text.py
│       │   ├── parameters.py
│       │   ├── vectors.py
│       │   ├── graph.py
│       │   ├── eda_signatures.py
│       │   ├── firmware_symbols.py
│       │   └── builds.py
│       ├── retrieval/
│       │   ├── providers.py
│       │   ├── exact.py
│       │   ├── lexical.py
│       │   ├── parameter.py
│       │   ├── semantic.py
│       │   ├── graph.py
│       │   ├── eda_structure.py
│       │   ├── historical.py
│       │   ├── union.py
│       │   └── rerank.py
│       ├── compatibility/
│       │   ├── functions.py
│       │   ├── requirements.py
│       │   ├── interfaces.py
│       │   ├── power.py
│       │   ├── performance.py
│       │   ├── eda.py
│       │   ├── firmware.py
│       │   ├── mechanical.py
│       │   ├── manufacturing.py
│       │   ├── supply.py
│       │   ├── license.py
│       │   └── verification.py
│       ├── reuse/
│       │   ├── levels.py
│       │   ├── factors.py
│       │   ├── vectors.py
│       │   ├── weighted_coverage.py
│       │   └── explanations.py
│       ├── modification/
│       │   ├── graph.py
│       │   ├── nodes.py
│       │   ├── propagation.py
│       │   ├── scopes.py
│       │   └── work_packages.py
│       ├── composition/
│       │   ├── generator.py
│       │   ├── interfaces.py
│       │   ├── power.py
│       │   ├── pins.py
│       │   ├── addresses.py
│       │   ├── mechanical.py
│       │   ├── firmware.py
│       │   └── conflicts.py
│       ├── licenses/
│       │   ├── registry.py
│       │   ├── identifiers.py
│       │   ├── obligations.py
│       │   ├── compatibility.py
│       │   └── reviews.py
│       ├── verification/
│       │   ├── evidence.py
│       │   ├── quality.py
│       │   ├── reuse.py
│       │   └── regression.py
│       ├── scoring/
│       │   ├── hard_filters.py
│       │   ├── vectors.py
│       │   ├── normalize.py
│       │   ├── pareto.py
│       │   └── explain.py
│       ├── decisions/
│       ├── baselines/
│       ├── changes/
│       ├── feedback/
│       ├── downstream/
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       └── observability/
├── schemas/
├── policies/
├── search-profiles/
├── asset-schemas/
├── indexes/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_reuse_readiness.py
    ├── ingest_reference_asset.py
    ├── build_asset_indexes.py
    ├── search_reference_assets.py
    ├── evaluate_reuse_candidate.py
    ├── calculate_reuse_vector.py
    ├── build_modification_graph.py
    ├── generate_module_compositions.py
    ├── freeze_reuse_baseline.py
    ├── ingest_reuse_feedback.py
    └── run_reuse_benchmark.py
```


---

# 97. Codex 分阶段实施

不要让 Codex 一次实现资产导入、KiCad 解析、混合检索、结构匹配、License、模块组合、复用比例、修改图、Agent 19 写入和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 10 Requirement Baseline、Variant、Acceptance Criteria 和 Change；
2. Agent 11 Reuse/Architecture Work Package、Gate、Estimate、Risk 和 Project Baseline；
3. Agent 12 Function、Block、Port、Interface、Power、Mode、Budget 和 Architecture Baseline；
4. 当前参考设计库、KiCad 工程库、模块库、历史项目和产品库；
5. 当前约 2 万参考设计、约 2 千 KiCad 工程和 500+ 模块的真实存储结构与覆盖；
6. 当前 Asset、Version、Artifact、Source、Owner、License 和权限模型；
7. 当前 KiCad 项目、原理图、PCB、库、3D、BOM、仿真、制造文件解析能力；
8. 当前 Agent 16 Canonical EDA IR 和工程健康检查；
9. 当前模块的 Function、Port、Interface、Power、Performance、Firmware、Mechanical 和 Verification；
10. 当前元器件、BOM、生命周期、价格/库存接口和替代料数据；
11. 当前 Firmware Repository、BSP、Driver、SDK、RTOS、API、Tests 和 License；
12. 当前 Reference Design、Application Note、Evaluation Board、Git 和 Vendor Package 导入；
13. 当前全文、参数、向量、图、BOM 和 EDA 结构索引；
14. 当前搜索 Query、Filter、Rerank、Explanation 和 Feedback；
15. 当前功能覆盖、接口兼容、电源兼容和性能 Margin；
16. 当前复用比例或相似度算法；
17. 当前 PCB Region、Schematic Sheet、Netlist Graph 和 Placement Cluster 比较；
18. 当前模块组合、地址冲突、Pin 冲突、电源冲突和机械冲突；
19. 当前 License/SBOM/Attribution/Export Review；
20. 当前安全沙箱、仓库拉取、压缩包和脚本处理；
21. 当前 Reuse Decision、Baseline、Modification Plan 和 Downstream Packages；
22. 当前 Agent 19、20、21、22、23、24、25、26、27、28、29、30 契约；
23. 当前实际复用工期、缺陷、返工和验证反馈；
24. 当前 UI、API、Worker、Database、Object Storage 和 Security；
25. 当前开源、合成、脱敏或授权 Fixture；
26. 统计资产缺失、版本不明、License 不明和无法解析情况；
27. 统计搜索命中、人工采纳、误推荐和无结果；
28. 统计声明复用率与实际复用率偏差；
29. 统计来源工程缺库、绝对路径、Git LFS 和 Submodule 问题；
30. 只运行只读扫描、安全索引查询和公开 Fixture；
31. 不修改资产；
32. 不执行来源仓库代码；
33. 不拉取未授权私有仓库；
34. 不将真实资产导入新项目；
35. 不触发 Agent 19 或生产 Agent；
36. 不冻结 Reuse Baseline；
37. 不创建 Migration；
38. 不安装搜索、图、解析、License 或模型组件；
39. 不调用生产外部模型；
40. 不读取或打印 Secret、客户工程、BOM、价格和许可证凭证。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Job；
- Input Snapshot；
- Search Profile；
- Asset/Version/Artifact；
- Parse Run；
- Function/Block/Port/Interface/Power/Component；
- EDA/Firmware/Mechanical/Manufacturing Manifest；
- Verification Evidence；
- License；
- Known Issue；
- Security Scan；
- Search Intent；
- Retrieval Run/Candidate；
- Evaluation Run；
- Function/Requirement/Interface/Power/Performance Match；
- Fit Assessment；
- Reuse Ratio Vector；
- Modification Graph；
- Composition/Conflict；
- Adaptation Work Package；
- Score；
- Review Package；
- Decision；
- Baseline；
- Downstream Package；
- Change Impact；
- Feedback；
- Index Build Run；
- JSON Schema。

## Phase 2：Reuse Input Gate

实现：

- Agent 10 Baseline；
- Agent 12 Baseline；
- Agent 11 Task/Gate；
- Project/Variant；
- Search Scope；
- Asset Permissions；
- License Policy；
- Security Policy；
- Registry/Index Freshness；
- Immutable Snapshot；
- Draft-only/Review-ready；
- Diagnostics。

## Phase 3：Search Profile Registry

实现：

- Product Category；
- Asset Types；
- Sources；
- Evaluations；
- Retrieval Policy；
- Hard Filters；
- Scoring；
- Reuse Factors；
- License；
- Security；
- Approval；
- Version/Effective Date；
- Validation/Deprecation。

## Phase 4：Asset Registry Foundation

实现：

- Asset Identity；
- Source；
- Visibility；
- Security Classification；
- Trust；
- Lifecycle；
- Taxonomy；
- Aliases；
- Part Numbers；
- Current Version；
- CRUD；
- Audit；
- No Hard Delete。

## Phase 5：Asset Version and Artifact Manifest

实现：

- Version/Revision；
- Branch/Tag/Commit；
- Release Date；
- Artifact Inventory；
- Hash；
- Required/Optional；
- Source Locator；
- Media Type；
- Parse/Security Status；
- Stable IDs；
- Version Diff。

## Phase 6：Secure Repository and Package Intake

实现：

- Git Clone/Fetch in Sandbox；
- Commit Pinning；
- Submodule Inventory；
- Git LFS Inventory；
- Archive Limits；
- Path/Symlink Containment；
- No Execution；
- Network Allowlist；
- Resource Limits；
- Secret/Malware Candidate；
- Quarantine。

## Phase 7：KiCad Asset Inventory

实现：

- `.kicad_pro`；
- `.kicad_sch`；
- `.kicad_pcb`；
- Symbol/Footprint Tables；
- 3D；
- BOM；
- Simulation；
- Constraints；
- Manufacturing；
- Fonts/Plugins/Scripts；
- External Paths；
- Version；
- Manifest Tests。

## Phase 8：Agent 16 Canonical EDA Import

实现：

- Agent 16 Contract；
- Project Parse；
- Schematic/PCB IR；
- Source Map；
- Library Resolution；
- Netlist；
- Board/Layer；
- Stable Hash；
- Failure Mapping；
- No EDA Mutation；
- Contract Tests。

## Phase 9：KiCad Health Assessment

实现：

- Project Open；
- Schema；
- Missing Files；
- Symbols/Footprints/3D；
- Absolute Paths；
- Environment Variables；
- Plugins；
- Submodules/LFS；
- ERC/DRC；
- Unrouted；
- Zones/Outline/Stack-up；
- Health Vector；
- Evidence。

## Phase 10：Firmware Manifest Ingestion

实现：

- Repository/Commit；
- Target；
- Toolchain/SDK/RTOS；
- BSP/Driver/Middleware；
- Protocol；
- Bootloader/Update；
- Config；
- Tests/CI；
- Known Issues；
- License Components；
- No Build Execution by Default。

## Phase 11：Mechanical and Manufacturing Manifest

实现：

- STEP/STL/DXF；
- Board Outline/Height；
- Connectors/Mounting；
- Enclosure/Thermal；
- Gerber/Drill/BOM/CPL；
- Stencil/Panel/Test；
- Supplier Feedback/Yield Evidence；
- Source-only Marking；
- No Release Reuse。

## Phase 12：Canonical Reference Asset IR

实现：

- Identity；
- Functions；
- Blocks；
- Ports；
- Interfaces；
- Power；
- Performance；
- Modes；
- Components；
- EDA/Firmware/Mechanical/Manufacturing；
- Verification；
- License；
- Provenance；
- Schema Version；
- Stable Hash。

## Phase 13：Function and Capability Extraction

实现：

- Structured Metadata；
- Rule Extraction；
- Document Candidate；
- Module DB；
- README Candidate；
- Function Taxonomy；
- Inputs/Outputs/Controls；
- Conditions/Limitations；
- Evidence；
- AI Candidate-only；
- Human Review。

## Phase 14：Port and Interface Extraction

实现：

- Connector/Pinout；
- Direction/Role；
- Voltage/Logic；
- Protocol/Speed；
- Clock/Termination；
- Isolation/Protection；
- Mechanical Orientation；
- Variant；
- Source Trace；
- Completeness；
- No Guessing。

## Phase 15：Power and Performance Extraction

实现：

- Input/Output Rails；
- Current/Peak/Inrush；
- Sequence；
- Modes；
- Efficiency；
- Metrics；
- Conditions；
- Limits；
- Test Evidence；
- Missing Context；
- Units/Decimal。

## Phase 16：Verification Evidence Registry

实现：

- Test/Simulation/Measurement；
- Setup；
- Conditions；
- Sample；
- Repeatability；
- Version Binding；
- Independence；
- Quality Vector；
- Negative Results；
- Known Issues；
- No Reuse of Pass Conclusion。

## Phase 17：License and Third-party Registry

实现：

- SPDX Candidate；
- License Files/Headers；
- Scope；
- Commercial/Modification/Distribution；
- Copyleft；
- Attribution/Notice；
- Patent/Trademark；
- Firmware/Hardware/Docs；
- Third-party；
- Unknown；
- Legal Review Workflow。

## Phase 18：Metadata and Exact Index

实现：

- Identifier；
- MPN；
- Vendor；
- Product Family；
- Tags/Taxonomy；
- Version；
- Asset Type；
- Source；
- Trust/Lifecycle；
- Permissions；
- Range Filters；
- Deterministic Search。

## Phase 19：Full-text Index

实现：

- Approved Descriptions；
- Functions；
- Applications；
- Limitations；
- Issues；
- Verification Summaries；
- Language；
- Tokenization；
- Field Boost；
- Highlight；
- Snapshot；
- ACL-aware Search。

## Phase 20：Parameter and Range Index

实现：

- Voltage；
- Current；
- Power；
- Frequency；
- Bandwidth；
- Accuracy；
- Dimensions；
- Temperature；
- Cost Class；
- Interface Count；
- Units；
- Range Overlap；
- Conditional Values；
- Unknown Handling。

## Phase 21：Semantic Index

实现：

- Bounded Summary；
- Local/Private Embeddings；
- Chunk IDs；
- Evidence；
- Version；
- ACL；
- No Complete Private Files to External Provider；
- Retrieval Trace；
- Model Rollback。

## Phase 22：Typed Asset Graph

实现：

- Asset/Function/Block/Port/Interface/Power/Component/Firmware/Test/License；
- Implements/Contains/Connects/Uses/Verified/Forked/Supersedes/Reused；
- Version Binding；
- Graph Queries；
- ACL；
- Incremental Update；
- Graph Hash。

## Phase 23：EDA Structural Signatures

实现：

- Sheet Hierarchy；
- Component Family Multiset；
- Normalized Net Graph；
- Power Topology；
- Interface Topology；
- Constraint Signature；
- Placement Cluster；
- Critical Route Candidate；
- Signature Version；
- Golden Tests。

## Phase 24：Search Intent Builder

实现：

- Target Requirements；
- Functions/Blocks；
- Ports/Interfaces；
- Power；
- Performance；
- Modes；
- Mechanical/Manufacturing；
- Lifecycle/Cost；
- Reuse Preference；
- Forbidden Tech；
- Verification；
- Human Review；
- Stable Hash。

## Phase 25：Hybrid Retrieval Orchestrator

实现：

- Exact；
- Lexical；
- Parameter；
- Semantic；
- Graph；
- EDA Structure；
- Firmware API；
- Historical；
- Parallel Runs；
- Candidate Union；
- Provider Trace；
- Time Budget；
- Partial Results。

## Phase 26：Candidate Admission

实现：

- Artifact/Version/Hash；
- Permissions；
- License Known/Flagged；
- Security；
- Basic Function；
- Parser Support；
- Quarantine；
- Hard Rejection；
- Manual Review；
- Audit。

## Phase 27：Function Coverage Evaluation

实现：

- Target-to-Source；
- Full/Partial/Adaptation/None/Conflict/Unknown；
- Conditions；
- Performance；
- Evidence；
- Criticality Weight；
- Function Gaps；
- Explanation；
- No Semantic-only Pass。

## Phase 28：Requirement Evidence Coverage

实现：

- Direct/Indirect/Candidate/None/Conflict；
- Source Evidence；
- Requirement Priority；
- Conditions；
- Verification Quality；
- Unknown；
- Coverage Matrix；
- Gate。

## Phase 29：Interface Compatibility Evaluation

实现：

- Endpoint/Role/Direction；
- Connector/Pinout；
- Electrical/Protocol；
- Timing/Speed；
- Isolation/Protection；
- Firmware/Mechanical；
- Adaptation Types；
- Required Changes；
- Hard Conflict；
- Evidence。

## Phase 30：Power Compatibility Evaluation

实现：

- Input Range；
- Rails；
- Current/Peak/Inrush；
- Sequence；
- Back-power；
- Modes；
- Battery/Charging；
- Efficiency/Thermal；
- Adapter Candidate；
- Hard Conflict；
- Evidence。

## Phase 31：Performance and Budget Evaluation

实现：

- Target/Source Values；
- Conditions；
- Margin；
- Near Boundary；
- Negative；
- Unknown；
- Processing/Memory/Bandwidth/Latency；
- Agent 12 Budget Link；
- No Typical-to-Worst Substitution。

## Phase 32：EDA Reuse Evaluation

实现：

- Whole Project；
- Schematic Sheet；
- Circuit Block；
- PCB Region；
- Libraries；
- Constraints；
- Stack-up；
- Placement/Routing；
- Cleanup；
- Migration；
- Target Compatibility；
- Findings；
- Reuse Classes。

## Phase 33：Firmware Reuse Evaluation

实现：

- Processor；
- Toolchain/SDK/RTOS；
- BSP/Driver/API；
- Pin/Clock/DMA/Interrupt；
- Memory/Boot/Security；
- Tests/CI；
- License；
- Porting Classes；
- Known Issues；
- Evidence。

## Phase 34：Mechanical and Manufacturing Fit

实现：

- Dimensions/Height；
- Connector/Mounting；
- Antenna/Thermal；
- Layer/Stack-up；
- Via/Process；
- Assembly/Test；
- Factory Capability；
- Agent 28/30 Handoff；
- No Manufacturing Pass Reuse。

## Phase 35：Supply, Lifecycle and Cost Fit

实现：

- Lifecycle；
- Single Source；
- Alternate；
- Availability Snapshot；
- MOQ/Lead/Price Class；
- Supplier Region；
- Counterfeit Risk；
- Query Timestamp；
- Agent 31–40 Handoff；
- No Stale Realtime Claims。

## Phase 36：Reuse Ratio Model

实现：

- Vector Dimensions；
- Target-based Denominator；
- Criticality Weights；
- Reuse Level；
- Modification Factor；
- Verification Discount；
- Unknown Weight；
- Calculation Trace；
- Policy Version；
- Human Approval；
- No Single Misleading Number。

## Phase 37：Modification Scope Graph

实现：

- Target/Source Objects；
- Retain/Copy/Rename/Parameterize/Substitute/Redraw/Delete/Add；
- Must Change/May Change/Reverify/Regenerate；
- Ripple；
- Criticality；
- Stable Graph；
- Visualization；
- Diff。

## Phase 38：Adaptation Work Package Generator

实现：

- Import；
- Library Rescue；
- Schematic；
- Component；
- Interface；
- Power；
- Firmware；
- PCB；
- Mechanical；
- Verification；
- License；
- Owner Role；
- Agent Routing；
- Input Gate；
- Estimate Candidate；
- Rollback。

## Phase 39：Module Composition Generator

实现：

- Set Cover Candidate；
- Block Coverage；
- Port Matching；
- Adapter Insertion；
- Power Aggregation；
- Address/Pin Allocation；
- Mechanical Arrangement；
- Firmware Integration；
- Cost/Supply；
- Time Budget；
- Determinism。

## Phase 40：Composition Conflict Detection

实现：

- Bus Address；
- Voltage；
- Role；
- Pin；
- Clock；
- Peak/Inrush；
- Connector；
- Mechanical；
- Antenna；
- Firmware Dependency；
- License；
- Supplier Concentration；
- Repair Candidates；
- Hard Gate。

## Phase 41：Scoring and Pareto

实现：

- Hard Filters；
- Score Vector；
- Functional/Interface/Power/EDA/Firmware/Mechanical；
- Evidence；
- Supply/License；
- Effort/Schedule/Cost；
- Normalization；
- Pareto；
- Explanation；
- No Auto Selection。

## Phase 42：Review Workbench

实现：

- Intent；
- Filters；
- Candidate Cards；
- Architecture Coverage；
- Interface Matrix；
- Reuse Vector；
- Modification Graph；
- EDA/Firmware；
- License/Evidence；
- Composition；
- Decision；
- Baseline。

## Phase 43：Reuse Decision Record

实现：

- Selected/Rejected；
- Criteria；
- Trade-offs；
- Accepted Gaps；
- Modifications；
- Verification；
- License；
- Approvers；
- Architecture Link；
- Audit；
- No AI Approval。

## Phase 44：Reuse Baseline

实现：

- Source Versions；
- Candidate/Composition；
- Reuse Vectors；
- Modification Graphs；
- Work Packages；
- License；
- Verification；
- Risks/Questions；
- Approval；
- Manifest；
- Hash；
- Immutability。

## Phase 45：Downstream Packages

实现：

- Agent 11 Replan；
- Agent 12 Architecture Update；
- Agent 16 Import；
- Agent 19 Workspace；
- Agent 20 Libraries；
- Agent 21 Firmware；
- Agent 22/23 Verification；
- Agent 24–30 PCB/Manufacturing；
- Agent 31–45 Supply/NPI；
- Schema/Hash/Gate/License。

## Phase 46：Controlled EDA Adaptation Integration

实现：

- Isolated Workspace；
- Source Copy with Provenance；
- Reference/Net/Sheet Rename Plan；
- Library Import；
- Agent 19 Preview；
- Approval；
- Readback；
- Agent 16 Reparse；
- Rollback；
- No Direct Production Release。

## Phase 47：Change Impact and Re-retrieval

实现：

- Agent 10/12 Change；
- Invalidated Candidates；
- Reuse Vector Recompute；
- Modification Graph Update；
- Work Package Update；
- License/Supply Freshness；
- Targeted Retrieval；
- Reverification；
- New Baseline Candidate。

## Phase 48：Actual Reuse Feedback

实现：

- Actual Objects Reused；
- Actual Modifications；
- Actual Effort；
- Defects；
- Verification；
- Manufacturing；
- Recommendation Quality；
- Data Quality；
- Historical Calibration；
- No Automatic Trust Promotion。

## Phase 49：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Index Lifecycle；
- Pagination；
- ACL；
- Audit；
- Metrics；
- Event Idempotency；
- Retention。

## Phase 50：Benchmark、监控和生产发布

实现：

- Retrieval Recall/Precision；
- Compatibility Accuracy；
- Reuse Vector Calibration；
- Modification Scope Accuracy；
- License/Security；
- Module Composition；
- EDA/Firmware；
- Change Impact；
- Performance；
- Feature Flags；
- Index Rollback；
- Disaster Recovery。

## Phase 51：高级能力，可选

稳定后：

- Schematic Subgraph Isomorphism at Scale；
- PCB Region Reuse with Constraint-aware Transform；
- Firmware API Semantic/Static Analysis；
- Automatic Harness/Module Composition；
- Product-line Reuse Models；
- Cross-project Proven Reuse Knowledge Graph；
- Supplier-backed Module Recommendation；
- Tindie Product Combination Recommendation；
- 仍不自动批准复用、许可证或正式设计写入。

---

# 98. Codex 工作纪律

Codex 必须：

1. Agent 10/12 Baseline 驱动检索；
2. Agent 11 Gate 控制执行；
3. Input Snapshot 不可变；
4. Asset/Version/Artifact 分开；
5. 所有 Asset 有 Hash；
6. 版本、Commit、Tag 显式；
7. 来源权限先于搜索；
8. Canonical IR 是检索真值；
9. Index 绑定 Snapshot；
10. Embedding 不决定数值兼容；
11. Semantic Similarity != Compatibility；
12. Function Match 有条件；
13. Requirement Coverage 有证据；
14. AI 推断不算已验证覆盖；
15. Port/Interface 是一级对象；
16. Electrical/Protocol/Mechanical 分开；
17. Power Typical/Peak/Inrush 分开；
18. Performance 条件必须比较；
19. Unknown 不视为 Pass；
20. Hard Constraint 先过滤；
21. KiCad 工程先 Inventory 和 Security；
22. 不执行来源脚本；
23. 不执行 CI/Plugin/Macro；
24. Submodule/LFS 显式；
25. Absolute Path 显式；
26. Library Missing 不静默忽略；
27. 来源 Gerber 不作为目标 Release；
28. Firmware Target/SDK/RTOS 显式；
29. License 按 Artifact Scope；
30. License Unknown 进入 Legal Review；
31. Negative Evidence 是一级对象；
32. Known Issue 进入评分；
33. Verification 绑定版本和条件；
34. 认证结论不可直接复用；
35. Reuse 是多维 Vector；
36. 分母以目标对象为准；
37. 权重绑定 Criticality 和 Policy；
38. Unknown Weight 显式；
39. Modification Class 显式；
40. Modification Ripple 有 Graph；
41. 模块组合检查地址/Pin/Power/Mechanical；
42. Adapter 是显式对象；
43. 评分不能抵消 Hard Violation；
44. Pareto 不等于自动选择；
45. Effort Estimate 是 Candidate；
46. Agent 11审核工期和资源；
47. Reuse Decision 需人工批准；
48. Reuse Baseline 不可覆盖；
49. Downstream Package 绑定 Source/Target Baseline；
50. Agent 19仅在 Workspace 执行；
51. 写入前 Preview；
52. 写入后 Agent 16 Readback；
53. 全量 Agent 22–30回归；
54. Change 触发重检索和重评估；
55. Realtime Supply 保存查询时间；
56. 不发送私有资产给未批准模型；
57. 不用客户资产做公开 Fixture；
58. 不伪造测试、License、工期或 Benchmark；
59. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Asset/Index/Policy 变化；
    - 测试命令和真实结果；
    - Ingestion/Security；
    - Retrieval；
    - Compatibility；
    - Reuse Vector；
    - Modification Graph；
    - Composition；
    - License/Evidence；
    - Work Packages；
    - Baseline/Downstream；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 99. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Asset and Ingestion

1. Enterprise Asset；
2. Vendor Reference；
3. Open-source Asset；
4. Historical Project；
5. Asset Version；
6. Commit Binding；
7. Artifact Hash；
8. Missing Artifact；
9. Corrupted ZIP；
10. Zip Slip；
11. Symlink Escape；
12. Decompression Bomb；
13. Secret Candidate；
14. Binary Inventory；
15. Malware Candidate；
16. Quarantine；
17. Git Submodule；
18. Missing Submodule；
19. Git LFS；
20. Missing LFS；
21. Absolute Path；
22. KiCad 8 Project；
23. KiCad 9 Project；
24. KiCad 10 Candidate；
25. Unsupported Newer Schema；
26. Missing Symbol；
27. Missing Footprint；
28. Missing 3D；
29. ERC Findings；
30. DRC Findings。

## Canonical IR and Evidence

31. Function Extraction；
32. Port Extraction；
33. Interface Extraction；
34. Power Extraction；
35. Performance Conditions；
36. Component Normalization；
37. Firmware Manifest；
38. Mechanical Manifest；
39. Manufacturing Manifest；
40. Test Evidence；
41. Simulation Evidence；
42. Evidence Version Mismatch；
43. Vendor Claim Only；
44. Prototype Validated；
45. Production Proven；
46. Negative Evidence；
47. Known Issue；
48. Superseded Asset；
49. Deprecated Asset；
50. Canonical Hash。

## Retrieval

51. Exact MPN；
52. Exact Asset Name；
53. Alias；
54. Lexical Function；
55. Chinese/English Function；
56. Parameter Range；
57. Interface Filter；
58. Power Filter；
59. Dimension Filter；
60. Semantic Candidate；
61. Graph Function Match；
62. Graph Interface Match；
63. BOM Overlap；
64. Schematic Topology；
65. Netlist Subgraph；
66. Placement Cluster；
67. Firmware Driver；
68. Historical Reuse；
69. Candidate Union；
70. Rerank；
71. ACL Filter；
72. Quarantined Exclusion；
73. No Result；
74. Index Staleness；
75. Deterministic Retrieval。

## Function and Requirement Fit

76. Full Function Coverage；
77. Partial Coverage；
78. Adaptation Coverage；
79. Missing Critical Function；
80. Conflicting Function；
81. Direct Requirement Evidence；
82. Indirect Evidence；
83. AI Inference Not Evidence；
84. Condition Mismatch；
85. Variant Mismatch；
86. Critical Requirement Weight；
87. Optional Requirement；
88. Coverage Matrix；
89. Missing Verification；
90. Hard Coverage Gate。

## Interface and Power

91. Direct Compatible Interface；
92. Connector Adapter；
93. Pin Remap；
94. Level Translator；
95. Protocol Bridge；
96. Speed Reduction；
97. Isolation Addition；
98. Protection Addition；
99. Role Conflict；
100. Voltage Conflict；
101. Pinout Conflict；
102. Timing Conflict；
103. Firmware Adapter；
104. Direct Power Fit；
105. Input Range Conflict；
106. Peak Current Conflict；
107. Inrush Conflict；
108. Sequence Conflict；
109. Back-power；
110. Battery Charging Conflict。

## Performance and Artifact Fit

111. Positive Performance Margin；
112. Near Boundary；
113. Negative Margin；
114. Unknown Conditions；
115. Typical versus Worst；
116. Processing Fit；
117. Memory Fit；
118. Bandwidth Fit；
119. Latency Fit；
120. Whole Project Reuse；
121. Schematic Sheet Reuse；
122. PCB Region Reuse；
123. Stack-up Mismatch；
124. Board Outline Mismatch；
125. Critical Routing Mismatch；
126. Firmware Direct Reuse；
127. SDK Port；
128. RTOS Port；
129. BSP Rewrite；
130. Mechanical No-fit。

## License and Supply

131. Permissive License；
132. Attribution；
133. Copyleft Candidate；
134. Hardware License；
135. Firmware Different License；
136. Missing License；
137. Conflicting License Files；
138. Third-party Dependency；
139. Patent Clause；
140. Export Review；
141. Active Component；
142. NRND；
143. EOL；
144. Single Source；
145. Alternate Available；
146. Stale Inventory Snapshot；
147. Price Class；
148. Legal Review Required；
149. License Incompatible；
150. License Obligation Package。

## Reuse Ratio and Modification

151. Target-based Denominator；
152. Direct Reuse Factor；
153. Configuration Change；
154. Parameter Change；
155. Component Substitution；
156. Interface Adaptation；
157. Major Redesign；
158. Unknown Weight；
159. Criticality Weight；
160. Vector Calculation；
161. Calculation Replay；
162. Single Percentage Rejected；
163. Modification Node；
164. Must Change Edge；
165. Must Reverify；
166. Must Regenerate；
167. MCU Change Ripple；
168. Connector Change Ripple；
169. Verification Discount；
170. Policy Version Change。

## Composition and Workflow

171. Two Compatible Modules；
172. I2C Address Conflict；
173. SPI Chip-select Conflict；
174. Pin Conflict；
175. Power Overflow；
176. Inrush Composition；
177. Mechanical Overlap；
178. Antenna Conflict；
179. Firmware Dependency Conflict；
180. License Conflict；
181. Supplier Concentration；
182. Adapter Candidate；
183. Composition Pareto；
184. Adaptation Work Package；
185. Agent 11 Handoff；
186. Agent 12 Update；
187. Agent 16 Import；
188. Agent 19 Preview；
189. Agent 20 Library Rescue；
190. Agent 21 Firmware Port；
191. Agent 22 Review；
192. Agent 23 Simulation；
193. Agent 24 Constraint Rebuild；
194. Agent 25 Placement Rework；
195. Agent 26 Routing Rework；
196. Agent 27 Regression；
197. Agent 28 Mechanical；
198. Agent 29 Regeneration；
199. Agent 30 DFM；
200. Reuse Baseline。

## Change, Feedback and Security

201. Requirement Change；
202. Architecture Change；
203. Candidate Invalidated；
204. Targeted Re-retrieval；
205. Reuse Vector Recompute；
206. Modification Graph Diff；
207. New Baseline；
208. Preserve Old Baseline；
209. Actual Reuse Feedback；
210. Actual Effort Calibration；
211. Recommendation False Positive；
212. Recommendation False Negative；
213. Prompt Injection in README；
214. Malicious KiCad Note；
215. Repository Credential Isolation；
216. External Model Policy；
217. Tenant Isolation；
218. Audit Replay；
219. 20k Assets；
220. 2k KiCad Projects；
221. 1M Component Links；
222. 100k Graph Edges；
223. Index Rollback；
224. Worker Cancellation；
225. Partial Retrieval Failure。

---

# 100. 初始质量目标

```text
Selected Asset Version/Hash Coverage = 100%
Approved Recommendation Source Trace Coverage = 100%
Critical Requirement Evidence Coverage = 100%
Semantic-only Compatibility Pass = 0
Unknown Electrical/Protocol Compatibility Auto-pass = 0
Quarantined Asset Recommendation = 0
Unknown License Production Baseline Entry = 0
Source Production File Direct Target Release = 0
Reuse Vector Calculation Trace Coverage = 100%
Unknown Reuse Weight Disclosure = 100%
Hard Constraint Violation in Approved Reuse Candidate = 0
Modification Graph Critical Ripple Coverage = 100%
Agent 19 Write without Preview/Approval = 0
Post-adaptation Agent 16 Readback Coverage = 100%
Post-adaptation Agent 22–30 Regression Coverage = 100%
Requirement/Architecture Change without Reuse Impact = 0
Private Asset Sent to Unapproved External Model = 0
Tenant/Asset Permission Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 101. 性能要求

目标规模：

```text
20,000+ Reference Designs
2,000+ KiCad Projects
500+ Functional Modules
1,100,000 Component Records
Millions of Asset-object Links
```

常规单 Job：

```text
10–500 Target Requirements
5–100 Architecture Blocks
10–500 Interfaces
100–10,000 Initial Candidates before filtering
10–100 Deep Evaluations
1–50 Composition Candidates
```

目标：

```text
Readiness P95 < 15 s
Exact/Metadata Retrieval P95 < 1 s
Hybrid Initial Retrieval P95 < 10 s
Candidate Admission P95 < 30 s for 1,000 candidates
Deep Evaluation P95 < 120 s per candidate excluding external agents
Reuse Vector P95 < 10 s
Modification Graph P95 < 30 s for 100k trace edges
Interactive Candidate Query P95 < 300 ms
```

索引构建要求：

- 可增量；
- 可取消；
- 保存 Snapshot 和版本；
- 允许蓝绿切换；
- 失败不破坏当前索引；
- ACL 变更快速生效；
- Embedding 可重建；
- EDA Signature 可重建；
- 大文件使用 Parquet；
- 不把完整工程加载进单一模型 Context。

---

# 102. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/reference-reuse-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第13个 Agent：

Reference Design, KiCad Project & Functional Module Retrieval,
Reuse Assessment and Adaptation Planning Agent /
参考设计与功能模块推荐 Agent。

本 Agent 接收：

- Agent 10 Requirement Baseline、Variant、Acceptance Criteria 和 Change；
- Agent 11 Reuse Work Package、Gate、Risk、Estimate 和 Project Baseline；
- Agent 12 Function、Block、Port、Interface、Power、Mode、Budget 和 Architecture Baseline；
- 企业参考设计库；
- KiCad 工程库；
- 模块数据库；
- 元器件数据库；
- Firmware Repository Registry；
- 历史项目；
- 厂商和受控开源资料；
- License、Supply、Verification 和 Security 数据；

输出：

- Search Intent；
- Canonical Reference Asset IR；
- Reference/KiCad/Module Candidates；
- Hybrid Retrieval Trace；
- Function/Requirement Coverage；
- Interface/Power/Performance Compatibility；
- EDA/Firmware/Mechanical/Manufacturing Fit；
- Supply/Lifecycle/License/Evidence Analysis；
- Reuse Ratio Vector；
- Modification Scope Graph；
- Module Composition Candidates；
- Adaptation Work Packages；
- Pareto Comparison；
- Reuse Decision/Baseline；
- Agent 11/12/16–45 Downstream Packages。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10、11、12、13 和 Agent 16–45 规格；
3. docs/reference-reuse-agent-spec.md；
4. 当前 Requirement/Architecture/Project Baselines；
5. 当前 Asset Registry/Versions/Artifacts；
6. 当前 Reference Design/KiCad/Module Libraries；
7. 当前 Agent 16 EDA IR；
8. 当前 Firmware Registry；
9. 当前 Component/BOM/Lifecycle/Supply；
10. 当前 License/SBOM；
11. 当前 Verification Evidence；
12. 当前 Security Sandbox；
13. 当前 Search Indexes/Retrieval/Rerank；
14. 当前 Reuse Ratio/Modification Scope；
15. 当前 Module Composition；
16. 当前 Agent 19/20/21/22/23/24/25/26/27/28/29/30 Contracts；
17. 当前 Feedback/Historical Reuse；
18. 当前 UI/API/Worker/Storage/Security；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Requirement and Architecture Baselines Drive Search；
- One Job = One Immutable Input Snapshot；
- Asset/Version/Artifact Separation；
- Source/Commit/Hash Binding；
- Permission before Retrieval；
- Canonical IR Is Search Truth；
- Index Snapshot Versioning；
- Similarity != Compatibility；
- Embedding Does Not Decide Numeric Fit；
- Function Coverage Has Conditions and Evidence；
- AI Inference Is Not Verified Coverage；
- Port/Interface/Power Are Typed；
- Unknown != Pass；
- Hard Constraints First；
- KiCad Assets Are Untrusted Inputs；
- No Source Code/Script/Plugin Execution；
- Explicit Submodule/LFS/Absolute Paths；
- Missing Libraries Are Findings；
- Source Gerber Is Not Target Release；
- Firmware Target/SDK/RTOS Explicit；
- License Is First-class；
- Unknown License Requires Review；
- Negative Evidence and Known Issues First-class；
- Verification Binds Version and Conditions；
- Certification Pass Cannot Be Reused；
- Reuse Is a Multi-dimensional Vector；
- Target-based Denominator；
- Criticality-weighted；
- Unknown Weight Disclosed；
- Modification Class and Ripple Graph；
- Composition Checks Address/Pin/Power/Mechanical/Firmware/License；
- Hard Violations Cannot Be Scored Away；
- Pareto Does Not Auto-select；
- Estimates Are Candidates；
- Human Reuse Decision；
- Immutable Reuse Baseline；
- Agent 19 Workspace/Preview/Approval/Readback/Rollback；
- Agent 22–30 Full Regression；
- Change Requires Re-retrieval/Re-evaluation；
- No External Private Asset Data；
- 不用客户工程做公开 Fixture；
- 不伪造 License、Evidence、Effort 和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改资产或目标工程：

1. 侦察当前仓库；
2. 查找 Agent 10/11/12 Baselines 和 Contracts；
3. 查找 Asset/Version/Artifact Registry；
4. 查找 Reference Design Library；
5. 查找 KiCad Project Library；
6. 查找 Module Database；
7. 查找 Agent 16 Canonical EDA IR；
8. 查找 Firmware Registry；
9. 查找 Component/BOM/Lifecycle/Supply；
10. 查找 Verification Evidence；
11. 查找 License/SBOM；
12. 查找 Security Sandbox/Quarantine；
13. 查找 Metadata/Full-text/Parameter/Vector/Graph/EDA Index；
14. 查找 Retrieval/Rerank/Explanation；
15. 查找 Compatibility Evaluation；
16. 查找 Reuse Ratio；
17. 查找 Modification Graph；
18. 查找 Module Composition；
19. 查找 Reuse Decision/Baseline；
20. 查找 Agent 19–30 Downstream；
21. 查找 Feedback/Historical Actuals；
22. 查找 UI/API/Worker/Storage/Security；
23. 统计资产数量、格式、版本和权限；
24. 统计 KiCad Health、缺库和路径问题；
25. 统计 License Unknown/Conflict；
26. 统计 Search Precision/Recall/Adoption；
27. 统计声明复用与实际复用偏差；
28. 抽样分析开源、合成、脱敏或授权 Fixture；
29. 在 docs/reference-reuse-implementation-plan.md 中生成实施计划；
30. 在 docs/input-and-search-intent.md 中定义输入；
31. 在 docs/asset-registry-and-versioning.md 中定义 Registry；
32. 在 docs/canonical-reference-asset-ir.md 中定义 IR；
33. 在 docs/asset-ingestion-and-security.md 中定义导入；
34. 在 docs/hybrid-retrieval.md 中定义检索；
35. 在 docs/eda-structural-retrieval.md 中定义 EDA；
36. 在 docs/compatibility-evaluation.md 中定义兼容；
37. 在 docs/reuse-ratio-model.md 中定义复用比例；
38. 在 docs/modification-scope-graph.md 中定义修改图；
39. 在 docs/module-composition.md 中定义组合；
40. 在 docs/license-and-ip.md 中定义许可；
41. 在 docs/verification-evidence.md 中定义证据；
42. 在 docs/adaptation-work-packages.md 中定义工作包；
43. 在 docs/scoring-and-pareto.md 中定义评分；
44. 在 docs/baselines-and-feedback.md 中定义 Baseline；
45. 在 docs/downstream-agent-contracts.md 中定义下游；
46. 在 docs/ai-boundaries.md 中定义 AI；
47. 在 docs/security.md 中定义安全；
48. 在 docs/reference-reuse-migration-plan.md 中定义旧流程迁移；
49. 在 docs/reference-reuse-benchmark-plan.md 中定义 Benchmark；
50. 给出拟新增、拟修改和拟复用文件；
51. 给出 Phase 1 精确范围；
52. 不修改业务代码；
53. 不创建 Migration；
54. 不安装 Search/Graph/Parser/License/模型组件；
55. 不修改 Asset；
56. 不导入目标工程；
57. 不执行仓库代码；
58. 不触发 Agent 19–45；
59. 不冻结 Reuse Baseline；
60. 不调用生产外部模型；
61. 不读取或打印 Secret/客户工程/BOM/价格；
62. 运行仓库已有 lint、type check、test、build 和 security scan；
63. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10/11/12 和下游 Contracts；
- Input Gate；
- Asset Registry；
- Canonical Asset IR；
- Asset Ingestion/Security；
- KiCad/Firmware/Mechanical/Manufacturing Manifests；
- Search Indexes；
- Hybrid Retrieval；
- Function/Requirement Coverage；
- Interface/Power/Performance Compatibility；
- EDA/Firmware/Mechanical/Supply Fit；
- License/Verification Evidence；
- Reuse Ratio Vector；
- Modification Scope Graph；
- Module Composition；
- Scoring/Pareto；
- Work Packages；
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

# 103. 后续 Phase 提示词模板

```text
继续实现 Reference Reuse Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10–13 和相关下游 Agent 规格；
3. 阅读 Reference Reuse Implementation Plan；
4. 阅读 Input、Asset IR、Ingestion、Retrieval、Compatibility、Reuse Vector、Modification、Composition、License、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Baseline-driven Search；
- Version/Hash/Permission Binding；
- Similarity Is Not Compatibility；
- Evidence-grounded Fit；
- Multi-dimensional Reuse；
- Hard Constraints First；
- Human Decision；
- Controlled EDA Adaptation；
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
9. ingestion/security tests；
10. retrieval/index tests；
11. compatibility/reuse tests；
12. composition/license tests；
13. downstream/baseline tests；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Asset/Index/Policy 变化；
- 测试命令和真实结果；
- Ingestion/Security；
- Retrieval；
- Compatibility；
- Reuse Vector；
- Modification Graph；
- Composition；
- License/Evidence；
- Work Packages；
- Baseline/Downstream；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 104. MVP 演示流程

1. 使用“便携式双通道测量仪”Requirement Baseline；
2. Agent 12 已选择 ADC + FPGA + MCU 架构候选；
3. 目标功能包括双通道模拟输入、45 Msps 采样、LCD、USB、可选电池和工厂校准；
4. Agent 13冻结 Search Input Snapshot；
5. 构建搜索意图：
6. 双通道高速 ADC 模块；
7. 模拟前端参考设计；
8. FPGA 数据缓存和 USB 传输；
9. 电池 Power Path；
10. LCD/UI；
11. 目标输入范围、带宽、采样率、接口和尺寸；
12. 对企业约 2 万参考设计、2 千 KiCad 工程和 500+ 模块执行混合检索；
13. Exact 检索命中使用相同 ADC 的历史项目；
14. Parameter 检索命中 40–80 Msps 双通道采集方案；
15. Graph 检索命中 AFE→ADC→FPGA→MCU 拓扑；
16. EDA 结构检索命中两个相似 KiCad 层次工程；
17. Semantic 检索命中便携示波器和数据采集参考设计；
18. 合并并去重候选；
19. 候选 A：企业内部已完成 EVT 的双通道采集板；
20. 候选 B：厂商 ADC Evaluation Board；
21. 候选 C：开源 FPGA 示波器；
22. 候选 D：三个现成功能模块组合；
23. 对 A 执行 KiCad Health；
24. 工程可打开，但有两个绝对库路径和一个缺失 3D；
25. Symbol/Footprint 可通过企业库恢复；
26. 原理图 ERC 存在两个已知 Waiver；
27. PCB 有完整 Stack-up 和 Critical Route；
28. 对 B 检查：
29. 模拟链路验证充分；
30. 板卡尺寸过大；
31. 接口是 FMC，不适合目标产品；
32. 只能复用模拟电路和测试方法；
33. 对 C 检查：
34. FPGA 数据通路匹配；
35. ADC 工作条件不同；
36. License 允许修改和商业使用，但 Firmware 子目录含另一许可证；
37. 进入 License Review；
38. 对 D 进行组合：
39. ADC 模块；
40. FPGA 模块；
41. MCU/LCD 模块；
42. 发现三者需要 5V、3.3V 和 1.2V；
43. 峰值功耗超过 USB 500mA 约束；
44. 两个模块默认使用同一 I2C 地址；
45. 连接器方向与外壳不匹配；
46. 生成 Power、Address 和 Mechanical Conflict；
47. 计算候选 A Reuse Vector：
48. Functional Coverage 88%；
49. Requirement Evidence Coverage 72%；
50. Interface Direct Reuse 61%；
51. Schematic Direct Reuse 68%；
52. PCB Direct Reuse 42%；
53. Firmware Direct Reuse 35%；
54. Mechanical Direct Reuse 10%；
55. Verification Evidence Reuse 55%；
56. 这些百分比全部带目标对象、权重和计算轨迹；
57. 识别 A 的修改范围：
58. 输入保护从 ±20V 改成目标范围；
59. MCU 替换；
60. USB 接口重做；
61. LCD 和按键新增；
62. PCB 外形和连接器移动；
63. FPGA 数据路径保留；
64. ADC Clock 和 Critical Placement 保留候选；
65. Firmware BSP 重写；
66. ADC Driver 和 FPGA Acquisition Core 可复用；
67. 创建 Modification Scope Graph；
68. MCU 替换传播到电源、时钟、Pin、USB、Firmware、PCB 和测试；
69. 创建 Adaptation Work Packages；
70. Agent 20：恢复库和 Pin-Pad；
71. Agent 21：Firmware Port；
72. Agent 23：AFE 和采样链路重新仿真；
73. Agent 24：重建 PCB 约束；
74. Agent 25：保留 ADC/FPGA Cluster，重做外围布局；
75. Agent 26：保留候选关键路由，重做其余布线；
76. Agent 28：机械重构；
77. Agent 22/27/30：全量复审；
78. 评估候选 B：
79. 设计复用低，但验证证据质量最高；
80. 适合作为模拟链路和测试基准；
81. 评估候选 C：
82. Firmware/FPGA 复用较高；
83. EDA 和 License 风险较高；
84. 评估 D：
85. 开发速度快；
86. 尺寸、功耗和组合冲突严重；
87. 输出 Pareto：
88. 最高直接复用：A；
89. 最佳验证证据：B；
90. 最低前期开发时间：D；
91. 最低长期量产风险：A+B 组合复用；
92. 平衡方案：A 的电路/PCB 核心 + B 的模拟测试方法；
93. 工程师选择平衡方案；
94. 记录：
95. A 作为主要工程来源；
96. B 仅作为模拟参考和验证方法；
97. C 不采用但保留 FPGA 思路参考；
98. D 因尺寸和功耗淘汰；
99. 生成 License/Attribution Package；
100. 冻结 Reuse Baseline 1.0；
101. Agent 11接收 Adaptation Work Packages 和 Estimate Candidate；
102. Agent 12更新 Physical Architecture 和 ADR；
103. Agent 19创建隔离 Workspace；
104. 复制 A 的指定层次原理图和 PCB Cluster；
105. 重命名 Sheet、Net、Reference 和 Project；
106. Agent 20修复库；
107. 工程师 Preview 后批准；
108. Agent 16重新解析目标 Workspace；
109. Agent 22–30执行完整回归；
110. Agent 29只从目标项目重新生成生产文件；
111. Prototype 完成后回传实际复用结果；
112. 记录实际 PCB 直接复用为 31%，低于原候选 42%；
113. 原因是连接器移动导致更多布线重做；
114. 反馈数据用于后续模型校准，但不自动修改资产 Trust；
115. 后续需求增加 Wi-Fi；
116. Agent 13只对受影响 Block、Power、Mechanical、Firmware 和 EMC 重新检索；
117. 旧 Reuse Baseline 1.0保留；
118. 评审后生成 1.1。

---

# 105. 生产上线顺序

第一阶段：

```text
Asset Registry
Version/Artifact Manifest
Secure KiCad Intake
Agent 16 EDA Health
Metadata/Parameter/Full-text Search
Function/Interface/Power Compatibility
Manual Candidate Review
```

第二阶段：

```text
Semantic/Graph/EDA Structural Retrieval
Firmware/Mechanical/License Analysis
Reuse Ratio Vector
Modification Scope Graph
Adaptation Work Packages
Reuse Baseline
```

第三阶段：

```text
Module Composition
Controlled Agent 19 Adaptation
Actual Reuse Feedback
Cross-project Knowledge Graph
Tindie Module/Product Recommendation
Product-line Reuse
```

上线优先确保：

```text
推荐的是同一个版本和同一份工程，而不是同名的另一个文件
相似功能是否真的在目标电压、带宽、尺寸和模式下可用
复用比例是否按目标功能和关键程度计算，而不是按器件数量粉饰
必须修改的原理图、PCB、固件、机械和测试范围是否完整传播
来源设计的 License、缺陷、缺库和验证边界是否透明
复用后是否仍从目标项目重新生成并验证全部设计和生产文件
```

一个靠谱的参考设计推荐 Agent，不应该只说“找到一个 87% 相似的项目”。它应该告诉工程师：哪 87% 是什么、哪 13% 为什么麻烦、改一颗 MCU 会掀翻哪些地方、哪些测试可以借鉴但不能继承结论，以及复制这份工程究竟是在省时间，还是在预订下一轮返工。
