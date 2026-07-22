# 功能架构与框图 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：12  
> Agent 名称：Functional Architecture, System Block Diagram & Interface Flow Synthesis Agent  
> 中文名称：功能架构与框图 Agent  
> 类型：混合型  
> 版本：V1.0  
>
> 定位：接收 Agent 10 冻结或待审的 Requirement Baseline、Agent 11 项目阶段与架构 Gate、产品类别模板、企业架构规范、模块库、参考设计、器件能力、机械边界和制造约束，将需求分配为功能、逻辑和物理架构；生成系统功能框图、电源树、数据流、控制流、时钟/复位树、状态与故障路径、模块端口和接口控制关系；输出可计算的 Architecture IR、多个候选方案、预算分析、接口矩阵、风险、验证计划和可继续驱动原理图、固件、PCB、机械及测试 Agent 的 Architecture Baseline。
>
> 上游：
> - Agent 10：Requirement Baseline、Requirement IR、Constraint、Goal、Assumption、Conflict、Open Question、Acceptance Criteria 和 Change Impact
> - Agent 11：Project Profile、Architecture Work Package、Milestone、Gate、Owner Role、Risk、Decision 和 Schedule
> - 产品战略：产品定位、Variant、目标市场、复用策略和 Make/Buy 决策
> - 企业架构模板：便携仪器、IoT、工业控制器、FPGA、音频、RF、教学平台、模块化设备等
> - 模块数据库：功能模块、接口、参数、参考设计、验证状态、KiCad 工程和固件支持
> - 元器件数据库：功能能力、接口、工作电压、功耗、性能、封装、生命周期和供应链属性
> - 历史项目：已批准架构、接口问题、Bring-up 缺陷、成本和风险
> - 机械输入：尺寸、连接器位置、外壳、安装、散热、显示、按键和线缆边界
> - 制造输入：板数、层数、工艺、成本级别、测试和装配要求
> - 合规与安全输入：隔离、安全域、认证范围、数据安全和故障策略
>
> 下游：
> - Agent 11：架构任务状态、里程碑、Gate、风险和变更回传
> - 原理图生成与电路方案 Agent：功能块到电路块和器件级实现
> - 元器件选型与模块推荐 Agent：Block Capability 和 Interface Contract
> - Agent 16：EDA 工程解析后的架构覆盖核对
> - Agent 18：Netlist 与 Architecture Interface 的连接核对
> - Agent 20：封装、Pin-Pad、库和模块实现校验
> - Agent 21：Firmware/BSP/Driver/API/Protocol/Task Framework
> - Agent 22：原理图需求覆盖、保护、去耦和接口审查
> - Agent 23：功能块、电源、模拟链路和性能预算仿真
> - Agent 24：电源域、接口、差分、阻抗、长度、隔离、高压和布局约束
> - Agent 25：功能分区、固定接口、器件组、电源流和信号流布局
> - Agent 26：网络优先级、数据通道、时钟、差分和电源布线
> - Agent 27：SI、PI、EMC、回流、地平面和接口保护验证
> - Agent 28：模块位置、连接器方向、散热和机械干涉验证
> - Agent 29：Architecture Revision、Variant 和接口说明进入生产发布
> - Agent 30：架构导致的工艺、板数、拼板、装配和测试可行性
> - Agent 31–45：BOM、供应链、采购、NPI、制造、质量和追溯
>
> 核心输出：
> - Architecture Input Snapshot
> - Architecture Context and Product Boundary
> - Functional Decomposition IR
> - Logical Architecture IR
> - Physical Architecture Candidate IR
> - System Block Diagram
> - Power Tree and Power Domain IR
> - Data Flow Graph
> - Control Flow Graph
> - Clock and Reset Tree
> - State, Mode and Sequence Model
> - Fault, Safety and Security Flow
> - Module and Interface Control Matrix
> - Port and Interface Contract Set
> - Requirement Allocation Matrix
> - Function-to-Block-to-Module Traceability
> - Performance, Bandwidth and Latency Budget
> - Power and Energy Budget
> - Processing, Memory and Storage Budget
> - I/O and Pin Resource Budget
> - Thermal and Mechanical Allocation
> - Cost and Complexity Budget
> - Architecture Candidate Set and Pareto Comparison
> - Architecture Findings, Risks and Open Questions
> - Verification and Integration Plan
> - Architecture Decision Record Set
> - Architecture Baseline and Release Manifest
> - Downstream Agent Input Packages
>
> 重要边界：
> - 本 Agent 生成架构和候选，不替代专业工程师批准系统方案。
> - 系统框图的图形只是 Architecture IR 的视图，不是数据真值。
> - 不把功能块自动等同于芯片、模块或 PCB；功能、逻辑和物理架构必须分层。
> - 不把框图上的箭头视为完整接口；接口必须具有方向、类型、角色、电平、速率、时序、带宽、连接器和验证信息。
> - 不将 Agent 10 中的 Goal、Preference、Assumption 或 AI Candidate 自动升级为硬架构约束。
> - 不将“USB”“无线”“传感器”“AI”“云端”等宽泛词语自动解释为具体版本和实现。
> - 不自动决定单板、多板、模块、SoC、MCU、FPGA 或专用芯片实现，除非约束或批准决策已明确。
> - 不从参考设计复制未经验证的电源树、接口定义或保护方案。
> - 不把平均功耗当作峰值功耗，不把典型带宽当作最坏情况吞吐量。
> - 不忽略启动、睡眠、故障、升级、校准、制造测试和维护模式。
> - 不以“总带宽大于数据率”简单判定系统可行；还需考虑协议开销、并发、缓存、突发、调度和最坏时延。
> - 不把功能安全、隔离、冗余、安全启动和网络安全要求自动简化成一个方框。
> - 不把成本目标自动分摊为未经批准的模块成本上限。
> - 不将架构候选直接写入原理图、固件或 PCB；必须先经过 Architecture Review 和 Baseline。
> - 不让 AI 自动关闭架构冲突、风险、假设和开放问题。
> - 不将客户需求、架构、成本和安全信息发送给未经批准的外部模型。
> - 每个 Block、Port、Flow、Budget、Decision 和 Constraint 必须可追溯到 Requirement、规则、模板、参考设计或人工决策。

---

# 1. Agent 12 的系统位置

```text
Agent 10 Requirement Baseline
              ↓
Agent 11 Architecture Work Package and Gate
              ↓
Product Boundary and Context
              ↓
Functional Decomposition
              ↓
Logical Blocks and Interfaces
              ↓
Physical Architecture Candidates
              ↓
Power / Data / Control / Clock / Reset / Fault Flows
              ↓
Budgets and Constraint Analysis
              ↓
Candidate Comparison and Architecture Review
              ↓
Architecture Baseline
              ↓
Schematic / Firmware / PCB / Mechanical / Test / Manufacturing
```

---

# 2. 为什么需要独立 Agent 12

常见问题包括：

1. PRD 已经明确，但没有统一的系统边界；
2. 功能框图只画“MCU、传感器、电源”，接口细节全靠口头理解；
3. 同一功能既分给 MCU，又分给 FPGA，职责重叠；
4. 数据路径看似连通，但吞吐量、缓存和时延不满足要求；
5. 平均功耗满足，但启动或无线发射峰值导致系统掉电；
6. 多个电源域之间的使能、时序和反向供电未定义；
7. 固件团队和硬件团队对接口角色理解不同；
8. 连接器定义了协议，却没有定义电平、Pin、保护和热插拔；
9. 架构只描述正常模式，没有升级、校准、测试和故障模式；
10. 单板还是多板没有形成正式 Decision；
11. 模块复用时，没有确认性能、尺寸、成本和生命周期；
12. 需求变更后，框图被手工改了，但接口和预算没有同步；
13. 原理图、固件和 PCB 分别维护自己的系统图，逐渐漂移；
14. 架构评审只有 PPT，没有机器可读 Baseline；
15. 后续 Agent 无法判断某条需求应该由哪个 Block 负责。

Agent 12 的职责是：

```text
Requirement Intent
→ Functional Responsibility
→ Explicit Interfaces
→ Quantified Budgets
→ Candidate Architecture
→ Reviewable Baseline
```

---

# 3. 架构层级

必须区分：

```text
context architecture
functional architecture
logical architecture
physical architecture
deployment architecture
integration architecture
verification architecture
```

---

# 4. Context Architecture

描述：

```text
product boundary
users
external systems
power sources
networks
sensors
actuators
cloud/services
manufacturing/test systems
maintenance tools
environment
trust boundaries
```

---

# 5. Functional Architecture

只表达“系统需要做什么”：

```text
acquire
condition
convert
process
store
communicate
display
control
protect
diagnose
update
calibrate
test
```

不绑定具体芯片或 PCB。

---

# 6. Logical Architecture

表达职责和接口：

```text
power management
analog front end
data acquisition
processing
memory
communication
user interface
security
diagnostics
control
```

可以映射到一个或多个物理模块。

---

# 7. Physical Architecture

表达实现载体：

```text
chip
module
board
cable
connector
mechanical assembly
external device
cloud service
test fixture
```

---

# 8. Deployment Architecture

描述：

```text
which function runs where
firmware task
MCU core
FPGA region
accelerator
host application
cloud service
manufacturing tool
```

---

# 9. Product Boundary

边界必须定义：

```text
inside product
included accessory
external dependency
customer-supplied
factory-only
service-only
optional
variant-specific
out of scope
```

---

# 10. Architecture Scope

```text
product
system
subsystem
board
module
firmware subsystem
external interface
manufacturing/test system
```

---

# 11. Functional Decomposition

分解规则：

```text
parent function
child functions
input flows
output flows
control flows
resource needs
performance allocation
failure behavior
verification
```

---

# 12. Function IR

```json
{
  "function_id": "FUNC-DAQ-001",
  "title": "采集双通道模拟信号",
  "parent_function_id": null,
  "requirement_ids": [],
  "inputs": [],
  "outputs": [],
  "controls": [],
  "modes": [],
  "performance_allocations": [],
  "resource_needs": [],
  "failure_behaviors": [],
  "verification_method_ids": [],
  "status": "candidate"
}
```

---

# 13. Block 类型

```text
functional_block
logical_block
physical_module
external_actor
power_source
power_converter
storage
processor
sensor
actuator
interface_bridge
security_boundary
test_fixture
cloud_service
```

---

# 14. Block IR

```json
{
  "block_id": "BLK-PROC-001",
  "title": "主处理与控制",
  "architecture_level": "logical",
  "block_type": "processor",
  "responsibilities": [],
  "allocated_function_ids": [],
  "requirement_ids": [],
  "port_ids": [],
  "resource_budgets": {},
  "modes": [],
  "failure_behavior": {},
  "candidate_implementations": [],
  "status": "candidate"
}
```

---

# 15. Port 类型

```text
power_input
power_output
analog_input
analog_output
digital_input
digital_output
bidirectional
clock_input
clock_output
reset
interrupt
debug
programming
mechanical
thermal
wireless
service
test
```

---

# 16. Port IR

```json
{
  "port_id": "PORT-MCU-USB-001",
  "block_id": "BLK-PROC-001",
  "name": "USB Device",
  "port_type": "bidirectional",
  "role": "device",
  "interface_contract_id": "IF-USB-001",
  "multiplicity": 1,
  "optional": false,
  "variant_scope": [],
  "status": "candidate"
}
```

---

# 17. Interface Contract

必须包含：

```text
logical purpose
source block/port
destination block/port
direction
role
physical medium
connector
electrical standard
voltage levels
protocol
data format
data rate
bandwidth
latency
timing
clocking
reset behavior
error handling
hot plug
isolation
protection
security
test method
variant
```

---

# 18. Interface IR

```json
{
  "interface_id": "IF-SPI-ADC-001",
  "title": "ADC 数据接口",
  "source_port_id": "PORT-ADC-DATA",
  "destination_port_id": "PORT-MCU-SPI",
  "direction": "source_to_destination",
  "interface_family": "SPI",
  "roles": {},
  "electrical": {},
  "protocol": {},
  "timing": {},
  "throughput": {},
  "error_handling": {},
  "security": {},
  "verification": {},
  "requirement_ids": [],
  "status": "candidate"
}
```

---

# 19. 接口完整性状态

```text
complete
partially_defined
ambiguous
conflicted
missing_electrical
missing_protocol
missing_timing
missing_role
missing_connector
missing_verification
```

---

# 20. Flow 类型

```text
power_flow
energy_flow
analog_signal
digital_data
control_command
status_feedback
clock
reset
interrupt
event
fault
thermal
mechanical
security_credential
test_stimulus
test_response
```

---

# 21. Flow IR

```json
{
  "flow_id": "FLOW-DATA-001",
  "flow_type": "digital_data",
  "source_port_id": "PORT-ADC-DATA",
  "destination_port_ids": ["PORT-MCU-SPI"],
  "payload": {},
  "rate_model": {},
  "latency_requirement": {},
  "burst_model": {},
  "priority": "high",
  "mode_scope": [],
  "requirement_ids": [],
  "status": "candidate"
}
```

---

# 22. Data Flow Graph

保存：

```text
producer
consumer
payload
sample/event model
average rate
peak rate
burst size
buffer
protocol overhead
latency
jitter
loss/error policy
backpressure
priority
mode
```

---

# 23. Control Flow Graph

保存：

```text
command source
command destination
state precondition
command
acknowledgement
timeout
retry
priority
ownership
safety interlock
failure action
```

---

# 24. Feedback Loop

控制闭环必须表达：

```text
plant
sensor
measurement
controller
actuator
sample period
latency
update rate
saturation
fail-safe action
```

本 Agent 只建模，不替代 Agent 23 控制仿真。

---

# 25. Power Tree

层级：

```text
external source
input protection
power path
charger
battery
intermediate bus
converter
load switch
LDO
power domain
consumer rail
```

---

# 26. Power Node IR

```json
{
  "power_node_id": "PWR-RAIL-3V3",
  "node_type": "consumer_rail",
  "nominal_voltage": {},
  "voltage_range": {},
  "current_budget": {},
  "peak_current": {},
  "startup_current": {},
  "efficiency": {},
  "enabled_by": [],
  "feeds_block_ids": [],
  "protection": {},
  "modes": [],
  "status": "candidate"
}
```

---

# 27. Power Edge IR

```json
{
  "power_edge_id": "PWR-EDGE-001",
  "source_node_id": "PWR-BUCK-5V",
  "destination_node_id": "PWR-RAIL-3V3",
  "conversion_type": "buck",
  "efficiency_model": {},
  "sequence": {},
  "reverse_current_policy": {},
  "fault_behavior": {},
  "requirement_ids": []
}
```

---

# 28. Power Domain

字段：

```text
domain voltage
always-on
switchable
sleep behavior
isolation
retention
enable owner
power-good
startup
shutdown
brownout
fault containment
back-power prevention
```

---

# 29. Power Budget

区分：

```text
typical
maximum
peak
inrush
sleep
standby
charging
fault
manufacturing_test
```

预算传播：

```text
consumer load
→ rail
→ converter input
→ source
→ battery/runtime
```

---

# 30. Energy Budget

针对电池系统：

```text
mode
duration
duty cycle
average power
transition energy
battery usable energy
conversion loss
reserve
temperature derating candidate
aging reserve candidate
```

未经批准的占空比不能形成硬续航结论。

---

# 31. Clock Tree

包括：

```text
clock source
frequency
accuracy
jitter
startup
distribution
consumers
clock domain
crossing
synchronization
low-power behavior
test mode
```

---

# 32. Reset Tree

包括：

```text
reset source
supervisor
brownout
watchdog
software reset
debug reset
domain scope
assert/deassert sequence
synchronization
safe state
```

---

# 33. Interrupt and Event Model

```text
source
destination
event type
priority
edge/level
rate
maximum burst
latency
masking
shared line
failure handling
```

---

# 34. State and Mode Model

典型模式：

```text
off
shipping
charging
standby
sleep
idle
active
calibration
firmware_update
factory_test
fault
safe_mode
service
```

---

# 35. Mode Transition

```text
source mode
destination mode
trigger
guard
actions
timeout
failure transition
required power domains
required interfaces
verification
```

---

# 36. Sequence Model

用于：

```text
power-up
power-down
boot
pairing
calibration
measurement
data transfer
firmware update
fault recovery
factory test
```

---

# 37. Fault Flow

```text
fault source
detection
propagation
containment
reporting
fallback
safe state
recovery
service action
```

---

# 38. Safety Domain

支持：

```text
high voltage
isolated domain
human accessible
battery protection
motor/actuator
thermal hazard
laser/optical
critical output
```

本 Agent 只建模分区和职责，不独立判定法规合规。

---

# 39. Security Architecture

支持：

```text
trust boundary
identity
authentication
authorization
secure boot
firmware update
key storage
debug access
data at rest
data in transit
factory provisioning
service access
threat candidate
```

---

# 40. Processing Budget

字段：

```text
function
operation rate
worst-case workload candidate
deadline
execution target
parallelism
accelerator candidate
CPU/FPGA/GPU allocation
headroom
```

---

# 41. Memory Budget

```text
code
static data
heap
stack
buffer
frame
model
filesystem
logging
update image
manufacturing data
reserve
```

---

# 42. Storage Budget

```text
capacity
write rate
retention
endurance
filesystem
data integrity
removable/fixed
encryption
update partition
```

---

# 43. Bandwidth Budget

每条链路：

```text
payload rate
protocol overhead
encoding overhead
framing
retries
burst
concurrency
headroom
effective utilization
```

---

# 44. Latency Budget

传播：

```text
sensor acquisition
conversion
transport
buffer
processing
control
output
display
network
```

总预算由子预算组成，但必须保留串行、并行和条件路径。

---

# 45. I/O 和 Pin Budget

```text
GPIO
ADC
DAC
PWM
timer
interrupt
DMA
SPI
I2C
UART
CAN
USB
Ethernet
MIPI
parallel bus
debug
programming
reserved
```

---

# 46. Pin Multiplexing

保存：

```text
candidate pin
alternate function
conflict set
boot strap
debug conflict
variant use
timing
electrical capability
reservation
```

不替代器件级 Pin Mapping，但提前发现资源冲突。

---

# 47. Thermal Allocation

```text
block power
heat source
operating mode
allowable temperature
cooling path
heatsink requirement candidate
airflow
enclosure coupling
sensor placement
thermal shutdown
```

---

# 48. Mechanical Allocation

```text
module envelope
board count
board outline candidate
connector location
display/button
mounting
cable
antenna
shield
heatsink
service access
```

---

# 49. Cost Allocation

```text
system target
subsystem target candidate
module target candidate
NRE
tooling
certification
test
manufacturing
risk reserve
```

成本分配只生成候选，需要审批。

---

# 50. Complexity Budget

维度：

```text
board count
layer count candidate
major IC count
power rail count
interface count
firmware components
FPGA complexity
mechanical parts
special processes
test fixtures
certification scope
```

---

# 51. Requirement Allocation

每条需求可分配到：

```text
function
logical block
physical module
interface
flow
power node
mode
verification
```

---

# 52. Allocation 状态

```text
fully_allocated
partially_allocated
unallocated
conflicted
overallocated
unknown
```

---

# 53. Architecture Traceability

```text
Requirement → Function
Function → Logical Block
Logical Block → Physical Module
Block → Port
Port → Interface
Interface → Flow
Block/Flow → Verification
```

---

# 54. Architecture Pattern Library

模式示例：

```text
single MCU
MCU + FPGA
MCU + Linux MPU
host + USB peripheral
sensor hub
gateway
distributed multi-board
isolated control
battery portable
redundant controller
modular backplane
```

模板用于候选，不自动成为批准架构。

---

# 55. Module Reuse Candidate

每个候选记录：

```text
module id
capabilities
interfaces
performance
power
dimensions
cost
lifecycle
verification status
firmware support
EDA assets
fit gaps
```

---

# 56. Architecture Candidate

```json
{
  "candidate_id": "ARCH-CAND-001",
  "title": "MCU + FPGA 双处理架构",
  "functional_architecture_hash": "sha256",
  "logical_architecture_hash": "sha256",
  "physical_architecture": {},
  "budgets": {},
  "requirement_coverage": {},
  "risks": [],
  "open_questions": [],
  "score_vector": {},
  "status": "candidate"
}
```

---

# 57. Candidate 生成方式

```text
template instantiation
module composition
rule-based synthesis
constraint-driven generation
historical architecture reuse
manual
AI candidate
```

---

# 58. Hard Constraint

```text
mandatory interface
maximum dimensions
maximum power
required isolation
required market/compliance boundary
required reuse
forbidden technology
fixed connector
fixed module
required redundancy
```

Hard Constraint 不能通过权重抵消。

---

# 59. Soft Objective

```text
cost
power
size
performance
reuse
schedule
supply risk
firmware effort
manufacturing complexity
testability
serviceability
```

---

# 60. Pareto Candidate

至少输出：

```text
minimum cost
minimum power
minimum size
maximum performance
maximum reuse
minimum schedule risk
balanced
```

---

# 61. Candidate Score Vector

```text
requirement coverage
hard violation count
performance margin
power margin
interface completeness
reuse ratio
estimated cost class
schedule complexity
supply risk
manufacturing complexity
verification complexity
architecture uncertainty
```

---

# 62. Architecture Consistency Checks

检查：

```text
unallocated requirement
function without owner block
block without responsibility
port without interface
interface endpoint mismatch
direction conflict
role conflict
electrical mismatch
protocol mismatch
rate mismatch
latency budget overflow
power budget overflow
rail voltage mismatch
power sequence cycle
clock domain unresolved
reset domain unresolved
mode transition dead end
fault path missing
test path missing
variant conflict
```

---

# 63. Architecture Completeness Checks

检查是否覆盖：

```text
normal operation
startup
shutdown
sleep
charging
firmware update
calibration
factory test
diagnostics
fault
service
security provisioning
manufacturing programming
```

---

# 64. Architecture Finding

```json
{
  "finding_id": "ARCH-FIND-001",
  "finding_type": "interface_role_conflict",
  "severity": "high",
  "affected_objects": [],
  "requirement_ids": [],
  "actual": {},
  "expected": {},
  "evidence_ids": [],
  "repair_candidates": [],
  "status": "open"
}
```

---

# 65. Finding 类型

```text
coverage_gap
functional_overlap
responsibility_gap
interface_incomplete
interface_conflict
budget_exceeded
resource_conflict
sequence_conflict
single_point_failure
fault_containment_gap
security_boundary_gap
testability_gap
variant_conflict
reference_design_mismatch
module_fit_gap
```

---

# 66. Open Question

问题必须包括：

```text
question
reason
affected architecture objects
affected requirements
decision deadline
required before gate
options
default candidate optional
owner
```

---

# 67. Architecture Decision Record

```text
decision
context
options
criteria
trade-offs
selected option
evidence
approver
effective baseline
superseded decision
```

---

# 68. Architecture Review

评审输入：

```text
Requirement Baseline
Context Diagram
Functional Architecture
Logical Architecture
Physical Candidates
Interfaces
Power Tree
Data/Control Flow
Budgets
Modes/Sequences
Risks
Verification Plan
```

---

# 69. Architecture Gate

## Concept Ready

```text
Product Boundary defined
Critical Requirements allocated
At least one candidate
Critical unknowns explicit
```

## Architecture Review Ready

```text
Hard Violation = 0
Critical Coverage Gap = 0
Key Interfaces defined
Power and Bandwidth budgets available
Modes and fault paths modeled
```

## Architecture Baseline Ready

```text
Selected Candidate approved
All Critical Interfaces approved
Required ADRs complete
Verification allocation complete
Agent 11 Gate passed
```

---

# 70. Architecture Baseline

包含：

```text
requirement baseline id
selected candidate
functional architecture
logical architecture
physical architecture
interfaces
power tree
flows
modes
budgets
allocations
open questions
accepted risks
decisions
approvals
manifest
hash
```

Baseline 不可覆盖。

---

# 71. Downstream Package

分别生成：

```text
schematic architecture package
firmware architecture package
pcb constraint package
mechanical allocation package
simulation package
verification package
manufacturing package
```

---

# 72. AI 允许职责

```text
生成函数和 Block 候选
推荐架构模式
识别接口缺失
总结 Trade-off
生成开放问题
解释架构候选
生成框图标签和说明草稿
```

---

# 73. AI 禁止职责

```text
编造需求、接口速率或电压
自动选择最终架构
自动批准电源预算
自动解决安全和合规边界
自动关闭风险
自动冻结 Architecture Baseline
直接修改原理图、固件或 PCB
```

---

# 74. 状态机

```text
RECEIVED
→ VALIDATING_REQUIREMENT_BASELINE
→ SNAPSHOTTING_INPUT
→ DEFINING_CONTEXT
→ DECOMPOSING_FUNCTIONS
→ BUILDING_LOGICAL_BLOCKS
→ BUILDING_PORTS_AND_INTERFACES
→ BUILDING_POWER_TREE
→ BUILDING_DATA_AND_CONTROL_FLOWS
→ BUILDING_CLOCK_RESET_AND_MODES
→ GENERATING_PHYSICAL_CANDIDATES
→ CALCULATING_BUDGETS
→ CHECKING_COVERAGE_AND_CONSISTENCY
→ COMPARING_CANDIDATES
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
REQUIREMENT_ALLOCATION_BLOCKED
INTERFACE_CONFLICT_BLOCKED
POWER_BUDGET_BLOCKED
PERFORMANCE_BUDGET_BLOCKED
CANDIDATE_REQUIRED
DECISION_REQUIRED
APPROVAL_REQUIRED
BASELINE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 75. 错误码

```text
PROJECT_NOT_FOUND
REQUIREMENT_BASELINE_NOT_FOUND
REQUIREMENT_BASELINE_NOT_APPROVED
REQUIREMENT_BASELINE_HASH_MISMATCH
PROJECT_PROFILE_NOT_FOUND
ARCHITECTURE_TEMPLATE_NOT_FOUND
PRODUCT_BOUNDARY_UNDEFINED
CRITICAL_REQUIREMENT_UNALLOCATED
FUNCTION_DECOMPOSITION_INCOMPLETE
FUNCTION_WITHOUT_BLOCK
BLOCK_WITHOUT_RESPONSIBILITY
PORT_WITHOUT_INTERFACE
INTERFACE_ENDPOINT_MISSING
INTERFACE_DIRECTION_CONFLICT
INTERFACE_ROLE_CONFLICT
INTERFACE_ELECTRICAL_CONFLICT
INTERFACE_PROTOCOL_CONFLICT
INTERFACE_RATE_UNDEFINED
BANDWIDTH_BUDGET_EXCEEDED
LATENCY_BUDGET_EXCEEDED
POWER_SOURCE_UNDEFINED
POWER_RAIL_CONFLICT
POWER_BUDGET_EXCEEDED
POWER_SEQUENCE_CYCLE
CLOCK_SOURCE_UNDEFINED
CLOCK_DOMAIN_CROSSING_UNRESOLVED
RESET_DOMAIN_UNRESOLVED
MODE_TRANSITION_INVALID
FAULT_PATH_INCOMPLETE
SECURITY_BOUNDARY_INCOMPLETE
TEST_PATH_INCOMPLETE
PIN_RESOURCE_EXCEEDED
PROCESSING_BUDGET_EXCEEDED
MEMORY_BUDGET_EXCEEDED
STORAGE_BUDGET_EXCEEDED
MODULE_CAPABILITY_MISMATCH
REFERENCE_DESIGN_UNVERIFIED
PHYSICAL_CANDIDATE_INFEASIBLE
VARIANT_CONFLICT
ARCHITECTURE_DECISION_REQUIRED
ARCHITECTURE_APPROVAL_MISSING
BASELINE_ALREADY_EXISTS
JOB_CANCELLED
INTERNAL_ERROR


---

# 76. 数据库设计

## 76.1 `architecture_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
project_baseline_id UUID NULL
architecture_profile_id UUID NULL
architecture_mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
selected_candidate_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 76.2 `architecture_input_snapshots`

```text
id UUID PK
architecture_job_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
project_context_hash CHAR(64) NOT NULL
project_profile_hash CHAR(64) NOT NULL
architecture_profile_hash CHAR(64) NOT NULL
template_snapshot_hash CHAR(64) NOT NULL
module_library_snapshot_hash CHAR(64) NULL
component_capability_snapshot_hash CHAR(64) NULL
reference_design_snapshot_hash CHAR(64) NULL
mechanical_snapshot_hash CHAR(64) NULL
manufacturing_snapshot_hash CHAR(64) NULL
policy_snapshot_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, snapshot_hash)
```

## 76.3 `architecture_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
applicable_conditions JSONB NOT NULL
required_architecture_levels JSONB NOT NULL
required_diagrams JSONB NOT NULL
required_budgets JSONB NOT NULL
required_modes JSONB NOT NULL
required_reviews JSONB NOT NULL
required_gates JSONB NOT NULL
candidate_generation_policy JSONB NOT NULL
scoring_policy JSONB NOT NULL
approval_policy JSONB NOT NULL
source_reference JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 76.4 `architecture_context_versions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
context_version VARCHAR NOT NULL
product_boundary JSONB NOT NULL
external_actors JSONB NOT NULL
external_systems JSONB NOT NULL
power_sources JSONB NOT NULL
environment_context JSONB NOT NULL
trust_boundaries JSONB NOT NULL
in_scope JSONB NOT NULL
out_of_scope JSONB NOT NULL
context_uri TEXT NOT NULL
context_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, context_version)
```

## 76.5 `architecture_functions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
function_key VARCHAR NOT NULL
parent_function_id UUID NULL
title VARCHAR NOT NULL
description TEXT NULL
function_type VARCHAR NOT NULL
requirement_ids JSONB NOT NULL
input_flow_refs JSONB NOT NULL
output_flow_refs JSONB NOT NULL
control_flow_refs JSONB NOT NULL
mode_scope JSONB NOT NULL
performance_allocations JSONB NOT NULL
resource_needs JSONB NOT NULL
failure_behaviors JSONB NOT NULL
verification_method_ids JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, function_key)
```

## 76.6 `architecture_function_decomposition_edges`

```text
id UUID PK
architecture_job_id UUID NOT NULL
parent_function_id UUID NOT NULL
child_function_id UUID NOT NULL
decomposition_type VARCHAR NOT NULL
allocation_ratio JSONB NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, parent_function_id, child_function_id)
```

## 76.7 `architecture_blocks`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
block_key VARCHAR NOT NULL
parent_block_id UUID NULL
architecture_level VARCHAR NOT NULL
block_type VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
responsibilities JSONB NOT NULL
allocated_function_ids JSONB NOT NULL
requirement_ids JSONB NOT NULL
mode_scope JSONB NOT NULL
resource_budgets JSONB NOT NULL
failure_behavior JSONB NOT NULL
security_attributes JSONB NOT NULL
safety_attributes JSONB NOT NULL
candidate_implementation_ids JSONB NOT NULL
variant_scope JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, block_key)
```

## 76.8 `architecture_ports`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
block_id UUID NOT NULL
port_key VARCHAR NOT NULL
name VARCHAR NOT NULL
port_type VARCHAR NOT NULL
direction VARCHAR NOT NULL
role VARCHAR NULL
multiplicity JSONB NOT NULL
optional BOOLEAN NOT NULL
interface_contract_id UUID NULL
electrical_capabilities JSONB NOT NULL
protocol_capabilities JSONB NOT NULL
timing_capabilities JSONB NOT NULL
mechanical_attributes JSONB NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(block_id, port_key)
```

## 76.9 `architecture_interface_contracts`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
interface_key VARCHAR NOT NULL
title VARCHAR NOT NULL
interface_family VARCHAR NOT NULL
logical_purpose TEXT NOT NULL
source_port_ids JSONB NOT NULL
destination_port_ids JSONB NOT NULL
direction_model JSONB NOT NULL
roles JSONB NOT NULL
physical_medium JSONB NOT NULL
connector JSONB NULL
electrical JSONB NOT NULL
protocol JSONB NOT NULL
data_format JSONB NOT NULL
timing JSONB NOT NULL
throughput JSONB NOT NULL
latency JSONB NOT NULL
error_handling JSONB NOT NULL
hotplug_policy JSONB NOT NULL
isolation JSONB NOT NULL
protection JSONB NOT NULL
security JSONB NOT NULL
verification JSONB NOT NULL
requirement_ids JSONB NOT NULL
variant_scope JSONB NOT NULL
completeness_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, interface_key)
```

## 76.10 `architecture_flows`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
flow_key VARCHAR NOT NULL
flow_type VARCHAR NOT NULL
title VARCHAR NOT NULL
source_port_id UUID NOT NULL
destination_port_ids JSONB NOT NULL
payload JSONB NOT NULL
rate_model JSONB NOT NULL
latency_requirement JSONB NOT NULL
burst_model JSONB NOT NULL
priority VARCHAR NOT NULL
buffering JSONB NOT NULL
error_policy JSONB NOT NULL
backpressure_policy JSONB NOT NULL
mode_scope JSONB NOT NULL
requirement_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, flow_key)
```

## 76.11 `architecture_power_nodes`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
power_node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
title VARCHAR NOT NULL
nominal_voltage JSONB NULL
voltage_range JSONB NULL
current_budget JSONB NOT NULL
peak_current JSONB NULL
inrush_current JSONB NULL
efficiency JSONB NULL
always_on BOOLEAN NOT NULL
switchable BOOLEAN NOT NULL
enable_owner_refs JSONB NOT NULL
power_good JSONB NOT NULL
protection JSONB NOT NULL
feeds_block_ids JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, power_node_key)
```

## 76.12 `architecture_power_edges`

```text
id UUID PK
architecture_job_id UUID NOT NULL
power_edge_key VARCHAR NOT NULL
source_power_node_id UUID NOT NULL
destination_power_node_id UUID NOT NULL
conversion_type VARCHAR NOT NULL
efficiency_model JSONB NOT NULL
sequence_model JSONB NOT NULL
enable_model JSONB NOT NULL
reverse_current_policy JSONB NOT NULL
fault_behavior JSONB NOT NULL
requirement_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, power_edge_key)
```

## 76.13 `architecture_clock_nodes`

```text
id UUID PK
architecture_job_id UUID NOT NULL
clock_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
source_block_id UUID NULL
frequency_model JSONB NOT NULL
accuracy JSONB NOT NULL
jitter JSONB NOT NULL
startup JSONB NOT NULL
consumers JSONB NOT NULL
clock_domain VARCHAR NOT NULL
low_power_behavior JSONB NOT NULL
test_behavior JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, clock_key)
```

## 76.14 `architecture_reset_nodes`

```text
id UUID PK
architecture_job_id UUID NOT NULL
reset_key VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_block_id UUID NULL
domain_scope JSONB NOT NULL
assertion_model JSONB NOT NULL
deassertion_model JSONB NOT NULL
synchronization JSONB NOT NULL
safe_state JSONB NOT NULL
consumers JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, reset_key)
```

## 76.15 `architecture_modes`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
mode_key VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
active_block_ids JSONB NOT NULL
active_power_node_ids JSONB NOT NULL
active_interface_ids JSONB NOT NULL
entry_actions JSONB NOT NULL
exit_actions JSONB NOT NULL
resource_budget_overrides JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, mode_key)
```

## 76.16 `architecture_mode_transitions`

```text
id UUID PK
architecture_job_id UUID NOT NULL
transition_key VARCHAR NOT NULL
source_mode_id UUID NOT NULL
destination_mode_id UUID NOT NULL
trigger JSONB NOT NULL
guard_expression JSONB NOT NULL
actions JSONB NOT NULL
timeout JSONB NULL
failure_transition_id UUID NULL
required_power_nodes JSONB NOT NULL
required_interfaces JSONB NOT NULL
verification JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, transition_key)
```

## 76.17 `architecture_sequences`

```text
id UUID PK
architecture_job_id UUID NOT NULL
sequence_key VARCHAR NOT NULL
sequence_type VARCHAR NOT NULL
title VARCHAR NOT NULL
preconditions JSONB NOT NULL
steps JSONB NOT NULL
timeouts JSONB NOT NULL
failure_paths JSONB NOT NULL
postconditions JSONB NOT NULL
requirement_ids JSONB NOT NULL
verification JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, sequence_key)
```

## 76.18 `architecture_fault_paths`

```text
id UUID PK
architecture_job_id UUID NOT NULL
fault_key VARCHAR NOT NULL
fault_source_refs JSONB NOT NULL
detection JSONB NOT NULL
propagation JSONB NOT NULL
containment JSONB NOT NULL
reporting JSONB NOT NULL
fallback JSONB NOT NULL
safe_state JSONB NOT NULL
recovery JSONB NOT NULL
service_action JSONB NOT NULL
requirement_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, fault_key)
```

## 76.19 `architecture_security_boundaries`

```text
id UUID PK
architecture_job_id UUID NOT NULL
boundary_key VARCHAR NOT NULL
title VARCHAR NOT NULL
inside_block_ids JSONB NOT NULL
outside_block_ids JSONB NOT NULL
crossing_interface_ids JSONB NOT NULL
identity_policy JSONB NOT NULL
authentication_policy JSONB NOT NULL
authorization_policy JSONB NOT NULL
key_material_policy JSONB NOT NULL
debug_policy JSONB NOT NULL
provisioning_policy JSONB NOT NULL
threat_candidates JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, boundary_key)
```

## 76.20 `architecture_safety_domains`

```text
id UUID PK
architecture_job_id UUID NOT NULL
domain_key VARCHAR NOT NULL
title VARCHAR NOT NULL
hazard_class VARCHAR NOT NULL
block_ids JSONB NOT NULL
interface_ids JSONB NOT NULL
isolation_requirements JSONB NOT NULL
safe_state JSONB NOT NULL
monitoring JSONB NOT NULL
fault_containment JSONB NOT NULL
requirement_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, domain_key)
```

## 76.21 `architecture_budget_sets`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
candidate_id UUID NULL
budget_version VARCHAR NOT NULL
budget_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
input_values JSONB NOT NULL
calculation_model JSONB NOT NULL
calculation_trace JSONB NOT NULL
result_values JSONB NOT NULL
margin JSONB NOT NULL
assumptions JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.22 `architecture_budget_items`

```text
id UUID PK
budget_set_id UUID NOT NULL
item_key VARCHAR NOT NULL
source_reference JSONB NOT NULL
allocation JSONB NOT NULL
consumption_or_supply JSONB NOT NULL
conditions JSONB NOT NULL
margin JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(budget_set_id, item_key)
```

## 76.23 `architecture_requirement_allocations`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_id UUID NOT NULL
allocation_role VARCHAR NOT NULL
allocation_fraction JSONB NULL
rationale TEXT NULL
verification_reference JSONB NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.24 `architecture_function_block_allocations`

```text
id UUID PK
architecture_job_id UUID NOT NULL
function_id UUID NOT NULL
block_id UUID NOT NULL
allocation_role VARCHAR NOT NULL
allocation_fraction JSONB NULL
rationale TEXT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, function_id, block_id)
```

## 76.25 `architecture_module_candidates`

```text
id UUID PK
architecture_job_id UUID NOT NULL
module_candidate_key VARCHAR NOT NULL
source_module_reference JSONB NOT NULL
target_block_id UUID NOT NULL
capability_match JSONB NOT NULL
interface_match JSONB NOT NULL
performance_match JSONB NOT NULL
power_match JSONB NOT NULL
dimension_match JSONB NOT NULL
cost_match JSONB NOT NULL
lifecycle_match JSONB NOT NULL
firmware_support JSONB NOT NULL
eda_asset_support JSONB NOT NULL
verification_status VARCHAR NOT NULL
fit_gaps JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, module_candidate_key)
```

## 76.26 `architecture_reference_design_candidates`

```text
id UUID PK
architecture_job_id UUID NOT NULL
reference_candidate_key VARCHAR NOT NULL
reference_design_id UUID NOT NULL
applicable_blocks JSONB NOT NULL
matched_requirements JSONB NOT NULL
interface_differences JSONB NOT NULL
power_differences JSONB NOT NULL
performance_differences JSONB NOT NULL
verification_quality VARCHAR NOT NULL
license_context JSONB NOT NULL
fit_gaps JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, reference_candidate_key)
```

## 76.27 `architecture_candidates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
title VARCHAR NOT NULL
generation_method VARCHAR NOT NULL
functional_architecture_hash CHAR(64) NOT NULL
logical_architecture_hash CHAR(64) NOT NULL
physical_architecture_uri TEXT NOT NULL
physical_architecture_hash CHAR(64) NOT NULL
budget_summary JSONB NOT NULL
requirement_coverage JSONB NOT NULL
hard_constraint_results JSONB NOT NULL
risk_summary JSONB NOT NULL
open_questions JSONB NOT NULL
score_vector JSONB NOT NULL
pareto_rank INT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, candidate_key)
```

## 76.28 `architecture_candidate_scores`

```text
id UUID PK
candidate_id UUID NOT NULL
scoring_policy_version VARCHAR NOT NULL
criterion_key VARCHAR NOT NULL
raw_value JSONB NOT NULL
normalized_value NUMERIC NULL
weight NUMERIC NULL
hard_constraint BOOLEAN NOT NULL
explanation_trace JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(candidate_id, criterion_key)
```

## 76.29 `architecture_findings`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
finding_key VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
affected_objects JSONB NOT NULL
requirement_ids JSONB NOT NULL
actual JSONB NOT NULL
expected JSONB NOT NULL
evidence_ids JSONB NOT NULL
repair_candidates JSONB NOT NULL
owner_role VARCHAR NULL
required_before_gate VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, finding_key)
```

## 76.30 `architecture_open_questions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
architecture_job_id UUID NOT NULL
question_key VARCHAR NOT NULL
question_text TEXT NOT NULL
reason TEXT NOT NULL
affected_object_refs JSONB NOT NULL
affected_requirement_ids JSONB NOT NULL
decision_deadline TIMESTAMPTZ NULL
required_before_gate VARCHAR NULL
options JSONB NOT NULL
default_candidate JSONB NULL
owner_id UUID NULL
owner_role VARCHAR NULL
answer JSONB NULL
answered_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, question_key)
```

## 76.31 `architecture_decision_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
decision_key VARCHAR NOT NULL
context TEXT NOT NULL
options JSONB NOT NULL
criteria JSONB NOT NULL
tradeoffs JSONB NOT NULL
selected_option JSONB NULL
evidence_ids JSONB NOT NULL
affected_object_refs JSONB NOT NULL
approver_id UUID NULL
approved_at TIMESTAMPTZ NULL
effective_baseline_id UUID NULL
supersedes_decision_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 76.32 `architecture_diagram_views`

```text
id UUID PK
architecture_job_id UUID NOT NULL
view_key VARCHAR NOT NULL
view_type VARCHAR NOT NULL
title VARCHAR NOT NULL
source_ir_refs JSONB NOT NULL
layout_engine VARCHAR NOT NULL
layout_engine_version VARCHAR NOT NULL
layout_parameters JSONB NOT NULL
svg_uri TEXT NULL
png_uri TEXT NULL
pdf_uri TEXT NULL
view_json_uri TEXT NOT NULL
view_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, view_key)
```

## 76.33 `architecture_verification_allocations`

```text
id UUID PK
architecture_job_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_id UUID NOT NULL
requirement_ids JSONB NOT NULL
verification_method VARCHAR NOT NULL
verification_phase VARCHAR NOT NULL
downstream_agent VARCHAR NULL
test_or_analysis_reference JSONB NULL
required_evidence JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.34 `architecture_review_packages`

```text
id UUID PK
architecture_job_id UUID NOT NULL
package_version INT NOT NULL
context_summary JSONB NOT NULL
functional_summary JSONB NOT NULL
logical_summary JSONB NOT NULL
candidate_summary JSONB NOT NULL
interface_summary JSONB NOT NULL
power_summary JSONB NOT NULL
flow_summary JSONB NOT NULL
budget_summary JSONB NOT NULL
finding_summary JSONB NOT NULL
risk_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_job_id, package_version)
```

## 76.35 `architecture_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
project_baseline_id UUID NULL
selected_candidate_id UUID NOT NULL
context_version_id UUID NOT NULL
function_manifest JSONB NOT NULL
block_manifest JSONB NOT NULL
port_manifest JSONB NOT NULL
interface_manifest JSONB NOT NULL
flow_manifest JSONB NOT NULL
power_manifest JSONB NOT NULL
clock_reset_manifest JSONB NOT NULL
mode_sequence_manifest JSONB NOT NULL
budget_manifest JSONB NOT NULL
allocation_manifest JSONB NOT NULL
decision_manifest JSONB NOT NULL
open_question_manifest JSONB NOT NULL
accepted_risk_manifest JSONB NOT NULL
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

## 76.36 `architecture_baseline_approvals`

```text
id UUID PK
baseline_id UUID NOT NULL
approval_role VARCHAR NOT NULL
approval_scope JSONB NOT NULL
decision VARCHAR NOT NULL
comment TEXT NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
```

## 76.37 `architecture_change_impact_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_architecture_baseline_id UUID NOT NULL
requirement_change_request_id UUID NULL
architecture_change_request JSONB NULL
changed_requirements JSONB NOT NULL
affected_functions JSONB NOT NULL
affected_blocks JSONB NOT NULL
affected_interfaces JSONB NOT NULL
affected_flows JSONB NOT NULL
affected_power_nodes JSONB NOT NULL
affected_modes JSONB NOT NULL
affected_budgets JSONB NOT NULL
affected_downstream_agents JSONB NOT NULL
required_reverification JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_uri TEXT NOT NULL
impact_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.38 `architecture_downstream_packages`

```text
id UUID PK
architecture_baseline_id UUID NOT NULL
package_type VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
target_agent VARCHAR NULL
content_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
requirement_trace JSONB NOT NULL
architecture_trace JSONB NOT NULL
required_input_gate JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_baseline_id, package_type, target_agent)
```

## 76.39 `architecture_release_manifests`

```text
id UUID PK
architecture_baseline_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
project_identity JSONB NOT NULL
requirement_baseline JSONB NOT NULL
project_baseline JSONB NULL
selected_candidate JSONB NOT NULL
architecture_objects JSONB NOT NULL
diagrams JSONB NOT NULL
budgets JSONB NOT NULL
decisions JSONB NOT NULL
questions JSONB NOT NULL
risks JSONB NOT NULL
downstream_packages JSONB NOT NULL
approvals JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(architecture_baseline_id)
```

---

# 77. 对象存储

```text
derived/functional-architecture/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          requirement-baseline.json
          project-baseline.json
          input-snapshot.json
          architecture-profile.json
          templates/
          module-library-snapshot.json
          component-capabilities.json
          reference-designs.json
          mechanical-context.json
          manufacturing-context.json
          policy.json
        context/
          product-boundary.json
          external-actors.json
          context-diagram.svg
          trust-boundaries.json
        functions/
          functional-decomposition.json
          functions.jsonl.zst
          function-tree.svg
          requirement-allocation.csv
        logical/
          blocks.jsonl.zst
          ports.jsonl.zst
          logical-architecture.json
          logical-block-diagram.svg
        interfaces/
          interface-contracts.jsonl.zst
          interface-matrix.csv
          interface-findings.jsonl.zst
          interface-control-document.html
        flows/
          data-flows.jsonl.zst
          control-flows.jsonl.zst
          event-flows.jsonl.zst
          fault-flows.jsonl.zst
          data-flow-diagram.svg
          control-flow-diagram.svg
        power/
          power-nodes.jsonl.zst
          power-edges.jsonl.zst
          power-domains.jsonl.zst
          power-tree.svg
          power-budget.csv
          energy-budget.csv
        clock-reset/
          clocks.jsonl.zst
          resets.jsonl.zst
          interrupts.jsonl.zst
          clock-tree.svg
          reset-tree.svg
        modes/
          modes.jsonl.zst
          transitions.jsonl.zst
          sequences.jsonl.zst
          mode-state-diagram.svg
          sequence-diagrams/
        security-safety/
          security-boundaries.jsonl.zst
          safety-domains.jsonl.zst
          threat-candidates.jsonl.zst
          fault-containment.svg
        candidates/
          candidate-plans/
          physical-architectures/
          module-matches/
          reference-design-matches/
          score-vectors.parquet
          pareto-set.json
          comparison.html
        budgets/
          processing/
          memory/
          storage/
          bandwidth/
          latency/
          io/
          thermal/
          mechanical/
          cost/
          complexity/
        analysis/
          coverage.json
          consistency.json
          completeness.json
          hard-constraint-results.json
          findings.jsonl.zst
          open-questions.jsonl.zst
          risks.jsonl.zst
        decisions/
          architecture-decisions.jsonl.zst
          reviews/
          approvals/
        verification/
          verification-allocations.jsonl.zst
          integration-plan.json
          downstream-agent-map.json
        baseline/
          architecture-baseline.json
          release-manifest.json
          downstream-packages/
        changes/
          impact/
          candidate-updates/
          baseline-diffs/
        reports/
          architecture-report.html
          architecture-report.pdf
          functional-blocks.csv
          interfaces.csv
          power-budget.csv
          bandwidth-budget.csv
          latency-budget.csv
          requirement-coverage.csv
          findings.csv
          open-questions.csv
          candidate-comparison.csv
        debug/
          synthesis-trace.jsonl.zst
          rule-trace.jsonl.zst
          model-trace.jsonl.zst
          budget-trace.jsonl.zst
          layout-trace.jsonl.zst
          resource-usage.json
```

---

# 78. API 设计

## 78.1 Jobs

```text
POST /api/v1/architectures/jobs
POST /api/v1/architectures/jobs/batch
GET  /api/v1/architectures/jobs/{id}
GET  /api/v1/architectures/jobs/{id}/events
POST /api/v1/architectures/jobs/{id}/cancel
POST /api/v1/architectures/jobs/{id}/retry
POST /api/v1/architectures/jobs/{id}/rerun
```

## 78.2 Readiness and Input

```text
POST /api/v1/architectures/jobs/{id}/validate-readiness
GET  /api/v1/architectures/jobs/{id}/readiness
POST /api/v1/architectures/jobs/{id}/freeze-input
GET  /api/v1/architectures/jobs/{id}/input-snapshot
```

## 78.3 Profiles and Templates

```text
POST /api/v1/architecture-profiles
GET  /api/v1/architecture-profiles
GET  /api/v1/architecture-profiles/{id}
POST /api/v1/architecture-profiles/{id}/validate
POST /api/v1/architecture-profiles/{id}/approve
POST /api/v1/architecture-profiles/{id}/deprecate
GET  /api/v1/architecture-templates
GET  /api/v1/architecture-patterns
```

## 78.4 Context and Functions

```text
POST /api/v1/architectures/jobs/{id}/build-context
GET  /api/v1/architectures/jobs/{id}/context
POST /api/v1/architectures/jobs/{id}/decompose-functions
GET  /api/v1/architectures/jobs/{id}/functions
POST /api/v1/architecture-functions/{id}/accept
POST /api/v1/architecture-functions/{id}/reject
POST /api/v1/architecture-functions/{id}/split
POST /api/v1/architecture-functions/{id}/merge
```

## 78.5 Blocks and Allocations

```text
POST /api/v1/architectures/jobs/{id}/build-logical-blocks
GET  /api/v1/architectures/jobs/{id}/blocks
GET  /api/v1/architecture-blocks/{id}
PATCH /api/v1/architecture-blocks/{id}
POST /api/v1/architecture-blocks/{id}/allocate-functions
GET  /api/v1/architectures/jobs/{id}/allocations
```

## 78.6 Ports and Interfaces

```text
POST /api/v1/architectures/jobs/{id}/build-ports
POST /api/v1/architectures/jobs/{id}/build-interfaces
GET  /api/v1/architectures/jobs/{id}/ports
GET  /api/v1/architectures/jobs/{id}/interfaces
GET  /api/v1/architecture-interfaces/{id}
PATCH /api/v1/architecture-interfaces/{id}
POST /api/v1/architecture-interfaces/{id}/approve
POST /api/v1/architectures/jobs/{id}/validate-interfaces
GET  /api/v1/architectures/jobs/{id}/interface-matrix
```

## 78.7 Flows

```text
POST /api/v1/architectures/jobs/{id}/build-data-flows
POST /api/v1/architectures/jobs/{id}/build-control-flows
POST /api/v1/architectures/jobs/{id}/build-fault-flows
GET  /api/v1/architectures/jobs/{id}/flows
GET  /api/v1/architecture-flows/{id}
```

## 78.8 Power, Clock and Reset

```text
POST /api/v1/architectures/jobs/{id}/build-power-tree
GET  /api/v1/architectures/jobs/{id}/power-tree
POST /api/v1/architectures/jobs/{id}/build-clock-tree
GET  /api/v1/architectures/jobs/{id}/clock-tree
POST /api/v1/architectures/jobs/{id}/build-reset-tree
GET  /api/v1/architectures/jobs/{id}/reset-tree
POST /api/v1/architectures/jobs/{id}/validate-power-sequence
```

## 78.9 Modes and Sequences

```text
POST /api/v1/architectures/jobs/{id}/build-modes
GET  /api/v1/architectures/jobs/{id}/modes
POST /api/v1/architectures/jobs/{id}/build-sequences
GET  /api/v1/architectures/jobs/{id}/sequences
POST /api/v1/architectures/jobs/{id}/validate-state-model
```

## 78.10 Budgets

```text
POST /api/v1/architectures/jobs/{id}/calculate-power-budget
POST /api/v1/architectures/jobs/{id}/calculate-energy-budget
POST /api/v1/architectures/jobs/{id}/calculate-bandwidth-budget
POST /api/v1/architectures/jobs/{id}/calculate-latency-budget
POST /api/v1/architectures/jobs/{id}/calculate-processing-budget
POST /api/v1/architectures/jobs/{id}/calculate-memory-budget
POST /api/v1/architectures/jobs/{id}/calculate-io-budget
POST /api/v1/architectures/jobs/{id}/calculate-cost-complexity-budget
GET  /api/v1/architectures/jobs/{id}/budgets
```

## 78.11 Module and Reference Candidates

```text
POST /api/v1/architectures/jobs/{id}/match-modules
GET  /api/v1/architectures/jobs/{id}/module-candidates
POST /api/v1/architectures/jobs/{id}/match-reference-designs
GET  /api/v1/architectures/jobs/{id}/reference-design-candidates
```

## 78.12 Architecture Candidates

```text
POST /api/v1/architectures/jobs/{id}/generate-candidates
GET  /api/v1/architectures/jobs/{id}/candidates
GET  /api/v1/architecture-candidates/{id}
POST /api/v1/architecture-candidates/{id}/evaluate
POST /api/v1/architecture-candidates/{id}/accept
POST /api/v1/architecture-candidates/{id}/reject
POST /api/v1/architectures/jobs/{id}/compare-candidates
GET  /api/v1/architectures/jobs/{id}/pareto
```

## 78.13 Analysis and Findings

```text
POST /api/v1/architectures/jobs/{id}/check-coverage
POST /api/v1/architectures/jobs/{id}/check-consistency
POST /api/v1/architectures/jobs/{id}/check-completeness
GET  /api/v1/architectures/jobs/{id}/findings
GET  /api/v1/architecture-findings/{id}
POST /api/v1/architecture-findings/{id}/accept
POST /api/v1/architecture-findings/{id}/reject
POST /api/v1/architecture-findings/{id}/waive
GET  /api/v1/architectures/jobs/{id}/open-questions
POST /api/v1/architecture-questions/{id}/answer
```

## 78.14 Diagrams

```text
POST /api/v1/architectures/jobs/{id}/render-context-diagram
POST /api/v1/architectures/jobs/{id}/render-functional-diagram
POST /api/v1/architectures/jobs/{id}/render-logical-diagram
POST /api/v1/architectures/jobs/{id}/render-power-tree
POST /api/v1/architectures/jobs/{id}/render-data-flow
POST /api/v1/architectures/jobs/{id}/render-control-flow
POST /api/v1/architectures/jobs/{id}/render-state-diagram
GET  /api/v1/architectures/jobs/{id}/diagrams
GET  /api/v1/architecture-diagrams/{id}
```

## 78.15 Decisions and Review

```text
POST /api/v1/architectures/jobs/{id}/decision-records
GET  /api/v1/architectures/jobs/{id}/decision-records
POST /api/v1/architecture-decisions/{id}/approve
POST /api/v1/architectures/jobs/{id}/review-package
GET  /api/v1/architectures/jobs/{id}/review-package
POST /api/v1/architectures/jobs/{id}/submit-review
```

## 78.16 Baseline and Downstream

```text
POST /api/v1/architectures/jobs/{id}/baseline-candidates
GET  /api/v1/projects/{project_id}/architecture-baselines
GET  /api/v1/architecture-baselines/{id}
POST /api/v1/architecture-baselines/{id}/approve
POST /api/v1/architecture-baselines/{id}/freeze
GET  /api/v1/architecture-baselines/{id}/manifest
POST /api/v1/architecture-baselines/{id}/generate-downstream-packages
GET  /api/v1/architecture-baselines/{id}/downstream-packages
```

## 78.17 Changes and Reports

```text
POST /api/v1/architecture-baselines/{id}/analyze-change
GET  /api/v1/architecture-change-impacts/{id}
POST /api/v1/architectures/jobs/{id}/rebase-candidate
GET  /api/v1/architectures/jobs/{id}/report
GET  /api/v1/architectures/jobs/{id}/interfaces.csv
GET  /api/v1/architectures/jobs/{id}/budgets.csv
GET  /api/v1/architectures/jobs/{id}/requirement-coverage.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 79. 输入事件

```text
requirements.baseline-frozen
requirements.change-impact-ready
project-planning.architecture-task-ready
project-planning.baseline-frozen
product.variant.updated
module-library.updated
reference-design.updated
mechanical.boundary.updated
manufacturing.constraint.updated
architecture.requested
```

---

# 80. 输出事件

```text
architecture.input-blocked
architecture.context-ready
architecture.functions-ready
architecture.interface-conflict-detected
architecture.power-budget-blocked
architecture.performance-budget-blocked
architecture.candidates-ready
architecture.review-required
architecture.open-question-created
architecture.finding-created
architecture.baseline-candidate-ready
architecture.baseline-frozen
architecture.change-impact-ready
architecture.downstream-packages-ready
architecture.completed
architecture.failed
```

---

# 81. 下游事件

```text
architecture.schematic-package-ready
architecture.firmware-package-ready
architecture.pcb-constraint-package-ready
architecture.mechanical-package-ready
architecture.simulation-package-ready
architecture.verification-package-ready
architecture.manufacturing-package-ready
project-planning.architecture-gate-update
```

---

# 82. Policy 组织

```text
policies/
├── functional-architecture-1.0.0.yaml
├── readiness-gates.yaml
├── profiles/
│   ├── product-categories.yaml
│   ├── required-views.yaml
│   ├── required-budgets.yaml
│   └── required-modes.yaml
├── decomposition/
│   ├── function-types.yaml
│   ├── decomposition-rules.yaml
│   ├── responsibilities.yaml
│   └── allocation.yaml
├── blocks/
│   ├── block-types.yaml
│   ├── logical-patterns.yaml
│   ├── physical-patterns.yaml
│   └── deployment-rules.yaml
├── interfaces/
│   ├── port-types.yaml
│   ├── contracts.yaml
│   ├── electrical.yaml
│   ├── protocols.yaml
│   ├── timing.yaml
│   ├── roles.yaml
│   └── completeness.yaml
├── flows/
│   ├── data.yaml
│   ├── control.yaml
│   ├── event.yaml
│   ├── fault.yaml
│   └── priority.yaml
├── power/
│   ├── node-types.yaml
│   ├── domains.yaml
│   ├── sequencing.yaml
│   ├── budgets.yaml
│   └── back-power.yaml
├── clock-reset/
│   ├── clocks.yaml
│   ├── resets.yaml
│   ├── interrupts.yaml
│   └── crossings.yaml
├── modes/
│   ├── standard-modes.yaml
│   ├── transitions.yaml
│   ├── sequences.yaml
│   └── completeness.yaml
├── budgets/
│   ├── power.yaml
│   ├── energy.yaml
│   ├── bandwidth.yaml
│   ├── latency.yaml
│   ├── processing.yaml
│   ├── memory.yaml
│   ├── storage.yaml
│   ├── io.yaml
│   ├── thermal.yaml
│   ├── cost.yaml
│   └── complexity.yaml
├── candidates/
│   ├── generation.yaml
│   ├── hard-constraints.yaml
│   ├── objectives.yaml
│   ├── scoring.yaml
│   └── pareto.yaml
├── safety-security/
│   ├── domains.yaml
│   ├── fault-containment.yaml
│   ├── trust-boundaries.yaml
│   └── provisioning.yaml
├── verification.yaml
├── diagrams.yaml
├── baseline.yaml
├── changes.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 83. Architecture Synthesis Provider

```python
class ArchitectureSynthesisProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_input(self, request) -> ValidationResult: ...
    async def propose_functions(self, request) -> FunctionCandidateSet: ...
    async def propose_blocks(self, request) -> BlockCandidateSet: ...
    async def propose_interfaces(self, request) -> InterfaceCandidateSet: ...
    async def propose_physical_candidates(self, request) -> ArchitectureCandidateSet: ...
    async def explain(self, candidate) -> SynthesisTrace: ...
```

Provider 类型：

```text
deterministic_template
requirement_rule
pattern_library
module_composition
reference_design_reuse
constraint_solver
language_model_candidate
manual
```

---

# 84. Budget Engine 接口

```python
class ArchitectureBudgetProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate(self, request) -> ValidationResult: ...
    async def calculate(self, request) -> BudgetResult: ...
    async def propagate(self, request) -> BudgetResult: ...
    async def explain(self, result) -> BudgetTrace: ...
```

所有预算使用 Decimal、明确单位、条件和假设。

---

# 85. Diagram Renderer

图形只从 IR 生成：

```python
class ArchitectureDiagramRenderer:
    async def render(self, view_spec, architecture_ir) -> DiagramArtifacts: ...
    async def validate(self, artifacts, architecture_ir) -> ViewValidationResult: ...
```

支持：

```text
SVG
PNG preview
PDF
JSON view model
Mermaid optional export
Graphviz optional adapter
```

要求：

- IR 是真值；
- 图形布局参数版本化；
- 图中每个对象可回到 IR ID；
- 图中标签不可覆盖接口关键数据；
- 图片生成模型不得绘制工程真值框图；
- 自动布局失败时输出人工布局候选，不修改 IR。

---

# 86. Candidate Solver

基础：

```text
Rule and Template Candidate Generation
Hard Constraint Filtering
Budget Evaluation
Interface Compatibility
Coverage Evaluation
Pareto Ranking
```

增强：

```text
Constraint Programming
Integer Programming optional
Graph Partitioning
Module Composition Search
```

硬约束优先于评分。

---

# 87. Module Library Contract

模块数据至少包括：

```text
capabilities
functions
ports
interfaces
power input/output
performance
timing
dimensions
thermal
cost class
lifecycle
firmware
EDA assets
reference designs
verification evidence
```

数据不足时只生成 `module_fit_gap`。

---

# 88. Requirement Allocation Gate

Critical Requirement 需要：

```text
至少一个 Function Allocation
至少一个 Block Allocation
至少一个 Verification Allocation
```

安全、合规、成本和机械需求可以分配到 Boundary、Budget 或 Process，而不是强制分配到单一电子 Block。

---

# 89. Interface Validation

检查：

```text
source and destination exist
direction compatible
role compatible
multiplicity compatible
electrical compatible
protocol compatible
clocking compatible
rate compatible
latency compatible
connector compatible
isolation compatible
protection assigned
verification defined
```

---

# 90. Power Tree Validation

检查：

```text
single or intentional multiple source
voltage compatibility
current supply versus load
peak and inrush
converter headroom
efficiency propagation
reverse path
enable ownership
power-good
sequence acyclic
mode availability
fault containment
```

---

# 91. Data and Control Validation

检查：

```text
producer exists
consumer exists
payload defined
rate model defined
buffer policy
backpressure
timeout
retry
priority
ownership
mode availability
fault handling
test path
```

---

# 92. Change Propagation

Requirement、Block 或 Interface 变化传播：

```text
Functions
Blocks
Ports
Interfaces
Flows
Power
Modes
Budgets
Candidates
Verification
Downstream Packages
Agent 11 Plan
```

---

# 93. Review Workbench

界面建议：

```text
左：Requirements / Functions / Blocks / Candidates / Findings
中：Context / Functional / Logical / Physical / Power / Flow Views
右：Selected Object / Interface / Budget / Trace / Decision
下：Modes / Sequences / Risks / Verification / Baselines / Changes
```

---

# 94. Review 操作

```text
接受/拒绝 Function 候选
拆分/合并 Block
分配需求
创建/编辑 Port
完善 Interface Contract
切换 Power Mode
比较 Candidate
查看 Budget Margin
查看 Requirement Trace
创建 ADR
回答 Open Question
批准 Architecture Baseline
生成下游 Package
```

---

# 95. 可观测性

```text
architecture_jobs_total{status,profile}
architecture_job_duration_seconds{step}
architecture_functions_total{status,type}
architecture_blocks_total{level,type,status}
architecture_interfaces_total{family,completeness,status}
architecture_flows_total{type,status}
architecture_power_nodes_total{type,status}
architecture_budget_margin{type,scope}
architecture_requirement_coverage_ratio{priority}
architecture_findings_total{type,severity,status}
architecture_candidates_total{status,generation_method}
architecture_hard_constraint_violations_total
architecture_open_questions_total{status}
architecture_baselines_total{status}
architecture_external_model_calls_total{provider,status}
```

---

# 96. Dashboard

```text
Projects
Architecture Readiness
Requirement Allocation
Functional Decomposition
Logical Blocks
Interfaces
Power Tree
Data/Control Flows
Clock/Reset
Modes/Sequences
Budgets
Module Reuse
Reference Designs
Candidates
Findings
Questions
Decisions
Verification
Baselines
Changes
```

---

# 97. 安全与权限

- Requirement、Architecture、Module Library、成本和安全边界按租户/项目隔离；
- 安全架构、密钥、调试和工厂 Provisioning 信息采用更高权限等级；
- Candidate 生成与 Baseline 审批权限分离；
- Interface Contract、Power Tree 和 Safety Domain 修改需要专业角色；
- 外部模型只接收最小化、脱敏和来源限定内容；
- 不将完整系统架构、客户用途、密钥策略和成本发送给未批准模型；
- Module Library 和 Reference Design 按许可证和企业权限过滤；
- 不执行参考设计包中的脚本、宏和二进制；
- 导入图形、JSON、YAML 和压缩包要防路径穿越、实体扩展和资源耗尽；
- 表达式 IR 不允许任意代码；
- Diagram Label 和 Note 防脚本注入；
- Prompt 使用受控模板，用户文本不能覆盖系统边界；
- Architecture Baseline、Decision、Finding、Question 和 Approval 不可硬删除；
- 下游 Package 有 Hash、Schema、Baseline 和权限；
- 公开 Fixture 只使用开源、合成、脱敏或授权数据。

---

# 98. 推荐技术栈

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

图与约束：

```text
NetworkX or custom typed graph
OR-Tools CP-SAT optional
Graphviz adapter
ELK/Dagre compatible layout adapter
Decimal
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
SVG interactive architecture viewer
Block/Port/Interface editor
Power tree
Flow graph
State/sequence viewer
Candidate comparison
Budget dashboards
```

模型：

```text
provider abstraction
structured output only
local/private model support
prompt/model/version registry
```

---

# 99. 推荐仓库结构

```text
functional-architecture-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── functional-architecture-agent-spec.md
│   ├── architecture-input-and-gates.md
│   ├── context-and-boundary.md
│   ├── functional-decomposition.md
│   ├── logical-and-physical-architecture.md
│   ├── ports-and-interface-contracts.md
│   ├── power-tree-and-domains.md
│   ├── data-control-and-fault-flows.md
│   ├── clock-reset-and-modes.md
│   ├── architecture-budgets.md
│   ├── architecture-candidates.md
│   ├── module-and-reference-reuse.md
│   ├── verification-and-traceability.md
│   ├── diagrams-and-views.md
│   ├── baselines-and-changes.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-ir-is-truth-diagrams-are-views.md
│       ├── 0002-functional-logical-physical-are-separated.md
│       ├── 0003-interface-arrows-require-contracts.md
│       ├── 0004-hard-constraints-precede-scoring.md
│       ├── 0005-ai-proposes-architecture-candidates.md
│       ├── 0006-budgets-have-assumptions-and-trace.md
│       └── 0007-architecture-baselines-are-immutable.md
├── src/
│   └── functional_architecture/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent10.py
│       │   ├── agent11.py
│       │   ├── modules.py
│       │   ├── components.py
│       │   ├── reference_designs.py
│       │   ├── mechanical.py
│       │   ├── manufacturing.py
│       │   └── downstream_agents.py
│       ├── intake/
│       │   ├── readiness.py
│       │   ├── snapshots.py
│       │   └── context.py
│       ├── profiles/
│       │   ├── registry.py
│       │   ├── product_categories.py
│       │   ├── required_views.py
│       │   └── validation.py
│       ├── functions/
│       │   ├── providers.py
│       │   ├── decomposition.py
│       │   ├── classification.py
│       │   ├── ownership.py
│       │   └── trace.py
│       ├── blocks/
│       │   ├── logical.py
│       │   ├── physical.py
│       │   ├── hierarchy.py
│       │   ├── responsibilities.py
│       │   └── allocations.py
│       ├── interfaces/
│       │   ├── ports.py
│       │   ├── contracts.py
│       │   ├── electrical.py
│       │   ├── protocols.py
│       │   ├── timing.py
│       │   ├── compatibility.py
│       │   └── matrices.py
│       ├── flows/
│       │   ├── data.py
│       │   ├── control.py
│       │   ├── events.py
│       │   ├── feedback.py
│       │   ├── faults.py
│       │   └── validation.py
│       ├── power/
│       │   ├── nodes.py
│       │   ├── edges.py
│       │   ├── domains.py
│       │   ├── sequencing.py
│       │   ├── budget.py
│       │   └── validation.py
│       ├── clock_reset/
│       │   ├── clocks.py
│       │   ├── resets.py
│       │   ├── interrupts.py
│       │   └── crossings.py
│       ├── modes/
│       │   ├── states.py
│       │   ├── transitions.py
│       │   ├── sequences.py
│       │   └── validation.py
│       ├── safety_security/
│       │   ├── domains.py
│       │   ├── faults.py
│       │   ├── trust.py
│       │   └── provisioning.py
│       ├── budgets/
│       │   ├── providers.py
│       │   ├── power.py
│       │   ├── energy.py
│       │   ├── bandwidth.py
│       │   ├── latency.py
│       │   ├── processing.py
│       │   ├── memory.py
│       │   ├── storage.py
│       │   ├── io.py
│       │   ├── thermal.py
│       │   ├── cost.py
│       │   └── complexity.py
│       ├── candidates/
│       │   ├── providers.py
│       │   ├── patterns.py
│       │   ├── modules.py
│       │   ├── references.py
│       │   ├── constraints.py
│       │   ├── scoring.py
│       │   └── pareto.py
│       ├── analysis/
│       │   ├── coverage.py
│       │   ├── consistency.py
│       │   ├── completeness.py
│       │   ├── findings.py
│       │   └── questions.py
│       ├── diagrams/
│       │   ├── renderer.py
│       │   ├── layout.py
│       │   ├── svg.py
│       │   ├── graphviz.py
│       │   └── validation.py
│       ├── decisions/
│       ├── verification/
│       ├── baselines/
│       ├── changes/
│       ├── downstream/
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── architecture-profiles/
├── architecture-patterns/
├── module-contracts/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_architecture_readiness.py
    ├── build_functional_architecture.py
    ├── build_interface_matrix.py
    ├── build_power_tree.py
    ├── calculate_architecture_budgets.py
    ├── generate_architecture_candidates.py
    ├── compare_architecture_candidates.py
    ├── render_architecture_views.py
    ├── freeze_architecture_baseline.py
    ├── analyze_architecture_change.py
    └── run_architecture_benchmark.py
```


---

# 100. Codex 分阶段实施

不要让 Codex 一次实现需求分配、功能分解、接口合同、电源树、状态机、预算、模块复用、候选搜索、框图渲染、Baseline 和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. 当前 Agent 10 Requirement Baseline、Allocation、Acceptance Criteria 和 Change Impact；
2. 当前 Agent 11 Architecture Work Package、Milestone、Gate、Risk 和 Project Baseline；
3. 当前 Product、Variant、Subsystem、Module、Board 和 External System 数据模型；
4. 当前功能框图、系统图、接口图、电源树和数据流表达；
5. 当前 Function、Block、Port、Interface、Flow 和 Mode 模型；
6. 当前需求到架构和架构到设计的 Traceability；
7. 当前 Architecture Template、Pattern 和历史 Baseline；
8. 当前模块数据库的 Capability、Port、Interface、Power、Performance、Firmware 和 EDA Asset；
9. 当前参考设计库的 Block、Interface、Power Tree、验证状态和许可证；
10. 当前元器件数据库的处理、接口、电源和资源能力；
11. 当前电源预算、带宽预算、时延预算、资源预算和成本预算；
12. 当前 Power Domain、Sequence、Clock、Reset、Interrupt 和 Mode；
13. 当前 Safety、Isolation、Fault、Security 和 Provisioning；
14. 当前 Diagram Renderer、Graph Layout、SVG 和交互视图；
15. 当前 Candidate Generator、Constraint Solver、Scoring 和 Pareto；
16. 当前 Architecture Review、ADR、Approval、Baseline 和 Change；
17. 当前 Agent 16–45 的下游数据契约；
18. 当前 PLM、项目管理、模块库、参考设计和合规数据接口；
19. 当前 AI Provider、结构化输出、Prompt、模型和数据策略；
20. 当前 UI、API、Worker、Database、Object Storage 和 Security；
21. 当前开源、合成、脱敏或授权 Fixture；
22. 统计现有项目的未分配需求、接口缺失和预算溢出；
23. 统计框图与原理图、固件、PCB 之间的漂移；
24. 统计架构变更导致的返工和接口问题；
25. 只运行只读扫描、安全解析和公开 Fixture；
26. 不修改现有架构；
27. 不生成 Approved Baseline；
28. 不触发下游设计 Agent；
29. 不创建 Migration；
30. 不安装图形、求解器或模型组件；
31. 不调用生产外部模型；
32. 不读取或打印 Secret、客户架构、成本和安全资料。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Architecture Job；
- Input Snapshot；
- Profile；
- Context；
- Function；
- Function Decomposition；
- Block；
- Port；
- Interface Contract；
- Flow；
- Power Node/Edge；
- Clock；
- Reset；
- Mode/Transition；
- Sequence；
- Fault Path；
- Security Boundary；
- Safety Domain；
- Budget Set/Item；
- Requirement Allocation；
- Function-Block Allocation；
- Module Candidate；
- Reference Candidate；
- Architecture Candidate/Score；
- Finding；
- Question；
- ADR；
- Diagram View；
- Verification Allocation；
- Review Package；
- Baseline/Approval；
- Change Impact；
- Downstream Package；
- Release Manifest；
- JSON Schema。

## Phase 2：Architecture Input Gate

实现：

- Agent 10 Baseline；
- Agent 11 Architecture Task/Gate；
- Project/Variant；
- Product Category；
- Mechanical/Manufacturing Context；
- Module/Reference Snapshot；
- Policy/Profile；
- Draft-only/Review-ready；
- Diagnostics；
- Immutable Snapshot。

## Phase 3：Architecture Profile Registry

实现：

- Product Category；
- Required Views；
- Required Budgets；
- Required Modes；
- Required Gates；
- Candidate Policy；
- Scoring Policy；
- Approval Policy；
- Version/Effective Date；
- Validation；
- Approval/Deprecation。

## Phase 4：Context and Product Boundary

实现：

- Product Boundary；
- External Actors；
- External Systems；
- Power Sources；
- Environment；
- Trust Boundaries；
- Included/External/Customer-supplied；
- Variant；
- Out-of-scope；
- Context Diagram；
- Review。

## Phase 5：Requirement Allocation Foundation

实现：

- Requirement Fetch；
- Domain/Scope；
- Allocation Targets；
- Critical Requirement Rules；
- Full/Partial/Unallocated；
- Verification Allocation Stub；
- Evidence；
- Stable IDs；
- Coverage Gate。

## Phase 6：Deterministic Functional Decomposition

实现：

- Product Category Templates；
- Requirement-to-Function Rules；
- Parent/Child；
- Input/Output/Control；
- Modes；
- Performance Allocation；
- Failure Behavior；
- Verification；
- Candidate Source Trace。

## Phase 7：Model-assisted Function Candidates

实现：

- Structured Output；
- Source-bounded Context；
- Requirement IDs；
- No New Facts；
- Function Candidate；
- Decomposition Rationale；
- Confidence；
- Dedup；
- Human Review；
- Provider/Prompt Version。

## Phase 8：Function Review and Normalization

实现：

- Accept/Reject；
- Split/Merge；
- Naming；
- Responsibility；
- Duplicate/Overlap；
- Missing Function；
- Stable Key；
- Original Candidate Trace；
- Function Tree。

## Phase 9：Logical Block Generation

实现：

- Function Clustering；
- Responsibility Boundary；
- Cohesion/Coupling；
- Shared Service；
- Safety/Security Boundary；
- State Ownership；
- Block Candidate；
- Requirement Trace；
- No Physical Binding Yet。

## Phase 10：Function-to-Block Allocation

实现：

- Primary/Shared/Backup；
- Coverage；
- Overlap；
- Responsibility Gap；
- Allocation Fraction optional；
- Rationale；
- Conflict；
- Review Matrix。

## Phase 11：Port Model

实现：

- Port Types；
- Direction；
- Role；
- Multiplicity；
- Optional/Variant；
- Electrical/Protocol Capabilities；
- Mechanical Attributes；
- Stable Port Keys；
- Validation。

## Phase 12：Interface Contract Engine

实现：

- Endpoints；
- Direction；
- Roles；
- Medium/Connector；
- Electrical；
- Protocol；
- Data Format；
- Timing；
- Throughput/Latency；
- Error；
- Hot Plug；
- Isolation/Protection；
- Security；
- Verification；
- Completeness Status。

## Phase 13：Interface Compatibility Validation

实现：

- Endpoint；
- Direction；
- Role；
- Multiplicity；
- Electrical；
- Protocol；
- Clocking；
- Data Rate；
- Latency；
- Connector；
- Isolation；
- Protection；
- Verification；
- Findings。

## Phase 14：Interface Control Matrix

实现：

- Block-by-Block Matrix；
- Ports；
- Interface IDs；
- Role/Direction；
- Electrical/Protocol；
- Rate/Latency；
- Status；
- Variant；
- Approval；
- CSV/HTML；
- Diff。

## Phase 15：Data Flow Graph

实现：

- Producer/Consumer；
- Payload；
- Average/Peak；
- Burst；
- Buffer；
- Overhead；
- Retry；
- Backpressure；
- Priority；
- Mode；
- Requirement Trace；
- Graph Validation。

## Phase 16：Control and Event Flow

实现：

- Command；
- Acknowledgement；
- State Preconditions；
- Timeout；
- Retry；
- Priority；
- Ownership；
- Interlock；
- Interrupt/Event；
- Burst；
- Failure Handling；
- Diagrams。

## Phase 17：Feedback Loop Model

实现：

- Plant；
- Sensor；
- Controller；
- Actuator；
- Sample Period；
- Latency；
- Saturation；
- Safe Action；
- Agent 23 Handoff；
- No Stability Claim。

## Phase 18：Power Tree Foundation

实现：

- Source；
- Protection；
- Battery/Charger；
- Bus；
- Converter；
- Switch/LDO；
- Rails；
- Consumers；
- Domains；
- Modes；
- Stable IDs；
- Diagram。

## Phase 19：Power Domain and Sequencing

实现：

- Always-on/Switchable；
- Enable Owner；
- Power-good；
- Startup/Shutdown；
- Brownout；
- Reverse Current；
- Back-power；
- Retention；
- Fault Containment；
- Cycle Detection；
- Findings。

## Phase 20：Power and Energy Budget

实现：

- Typical/Max/Peak/Inrush/Sleep；
- Consumer-to-Rail；
- Converter Efficiency；
- Source Propagation；
- Mode Duty Cycle；
- Battery Usable Energy；
- Reserve；
- Assumption Trace；
- Margin；
- No Unapproved Runtime Claim。

## Phase 21：Clock Tree

实现：

- Source；
- Frequency；
- Accuracy；
- Jitter；
- Startup；
- Distribution；
- Domains；
- Consumers；
- Low-power；
- Test Mode；
- Crossing Candidate；
- Findings。

## Phase 22：Reset and Interrupt Model

实现：

- POR/Brownout/Watchdog/Software/Debug；
- Domain Scope；
- Assert/Deassert；
- Synchronization；
- Safe State；
- Interrupt Source/Destination；
- Priority/Rate；
- Sharing；
- Failure；
- Diagram。

## Phase 23：Modes and State Machine

实现：

- Standard Modes；
- Active Blocks/Power/Interfaces；
- Entry/Exit；
- Budget Overrides；
- Transition Trigger/Guard/Action；
- Timeout；
- Failure Transition；
- Dead-end/Unreachable；
- Diagram。

## Phase 24：Sequence Models

实现：

- Power-up；
- Boot；
- Pairing；
- Calibration；
- Measurement；
- Transfer；
- Update；
- Factory Test；
- Fault Recovery；
- Preconditions/Postconditions；
- Timeout/Failure；
- Sequence View。

## Phase 25：Fault and Safety Flow

实现：

- Fault Sources；
- Detection；
- Propagation；
- Containment；
- Reporting；
- Fallback；
- Safe State；
- Recovery；
- Safety Domains；
- Isolation；
- Verification；
- Human Review。

## Phase 26：Security Architecture

实现：

- Trust Boundaries；
- Identity；
- Authentication；
- Authorization；
- Secure Boot；
- Firmware Update；
- Key Storage；
- Debug；
- Provisioning；
- Data Security；
- Threat Candidates；
- No Compliance Claim。

## Phase 27：Processing Budget

实现：

- Function Workloads；
- Operation Rate；
- Deadline；
- Execution Target；
- Parallelism；
- Headroom；
- CPU/FPGA/Accelerator Candidate；
- Assumptions；
- Margin；
- Agent 21 Handoff。

## Phase 28：Memory and Storage Budget

实现：

- Code/Data/Heap/Stack；
- Buffers/Frames/Models；
- Logs/Filesystem；
- Update Image；
- Capacity/Write Rate/Endurance；
- Reserve；
- Mode/Variant；
- Margin；
- Findings。

## Phase 29：Bandwidth and Latency Budget

实现：

- Payload；
- Protocol/Encoding Overhead；
- Burst/Retry/Concurrency；
- Effective Utilization；
- Path Composition；
- Serial/Parallel；
- Buffering；
- End-to-end Latency；
- Jitter；
- Margin；
- Findings。

## Phase 30：I/O and Pin Resource Budget

实现：

- GPIO/ADC/DAC/PWM/Timer/DMA；
- Serial Interfaces；
- Debug/Programming；
- Reserved；
- Multiplexing；
- Conflict Set；
- Boot Strap；
- Variant；
- Preliminary Pin Resource Findings；
- Device Selection Handoff。

## Phase 31：Thermal, Mechanical, Cost and Complexity Allocation

实现：

- Block Power；
- Thermal Source；
- Module Envelope；
- Board Count；
- Connector/Display/Button；
- Cost Class；
- Complexity Vector；
- Candidate Allocation；
- Assumptions；
- Agent 28/30/31–39 Handoff。

## Phase 32：Module Library Matching

实现：

- Capability；
- Interface；
- Performance；
- Power；
- Dimensions；
- Cost；
- Lifecycle；
- Firmware；
- EDA Assets；
- Verification；
- Fit Gaps；
- License/Permissions；
- Candidate-only。

## Phase 33：Reference Design Matching

实现：

- Function/Block Match；
- Interface Diff；
- Power Diff；
- Performance Diff；
- Verification Quality；
- License；
- Fit Gap；
- Source Trace；
- No Blind Copy。

## Phase 34：Physical Architecture Candidate Generator

实现：

- Single Board；
- Multi-board；
- MCU/FPGA/MPU；
- Module/Custom；
- Host/Peripheral；
- Reuse；
- Template/Rule/Module/Reference；
- Hard Constraints；
- Candidate Manifest；
- Determinism。

## Phase 35：Candidate Hard Constraint Filter

实现：

- Required Interface；
- Dimensions；
- Power；
- Isolation；
- Market Boundary；
- Fixed Module；
- Forbidden Technology；
- Redundancy；
- Required Reuse；
- Hard Violation；
- No Weight Compensation。

## Phase 36：Candidate Budget Evaluation

实现：

- Coverage；
- Power/Energy；
- Processing；
- Memory/Storage；
- Bandwidth/Latency；
- I/O；
- Thermal/Mechanical；
- Cost/Complexity；
- Supply/Verification；
- Margin；
- Findings。

## Phase 37：Scoring and Pareto

实现：

- Score Vector；
- Policy Version；
- Normalization；
- Weights for Soft Objectives；
- Pareto Dominance；
- Min Cost/Power/Size；
- Max Performance/Reuse；
- Balanced；
- Explanation Trace；
- No Auto Selection。

## Phase 38：Architecture Coverage and Consistency

实现：

- Requirement Allocation；
- Function Ownership；
- Block Responsibility；
- Port/Interface；
- Electrical/Protocol；
- Budgets；
- Sequence；
- Modes；
- Fault；
- Security；
- Test；
- Variant；
- Findings；
- Gate。

## Phase 39：Diagram and View Engine

实现：

- Context；
- Functional；
- Logical；
- Physical；
- Interface；
- Power；
- Data；
- Control；
- Clock/Reset；
- State；
- Fault；
- SVG/JSON；
- Object IDs；
- Layout Version；
- Validation；
- Export。

## Phase 40：Architecture Review Package

实现：

- Requirement Summary；
- Context；
- Views；
- Candidates；
- Interfaces；
- Budgets；
- Modes；
- Findings；
- Risks；
- Questions；
- Verification；
- Decision Needs；
- HTML/PDF；
- Hash。

## Phase 41：Architecture Decision Records

实现：

- Context；
- Options；
- Criteria；
- Trade-offs；
- Selected Option；
- Evidence；
- Approver；
- Effectivity；
- Supersession；
- Link to Candidate/Baseline；
- Audit。

## Phase 42：Verification and Integration Plan

实现：

- Requirement-to-Verification；
- Block/Interface/Flow/Power；
- Analysis/Simulation/Test/Inspection；
- Integration Order；
- Stub/Emulator；
- Bring-up；
- Agent 23/27/28/30/45；
- Evidence；
- Coverage。

## Phase 43：Architecture Baseline and Approval

实现：

- Selected Candidate；
- All IR Objects；
- Decisions；
- Open Questions；
- Accepted Risks；
- Downstream Packages；
- Approval Roles；
- Manifest；
- Hash；
- Immutability；
- Events。

## Phase 44：Downstream Agent Packages

实现：

- Schematic；
- Firmware；
- PCB Constraints；
- Mechanical；
- Simulation；
- Verification；
- Manufacturing；
- Schema Version；
- Baseline ID；
- Requirement Trace；
- Input Gates；
- Contract Tests。

## Phase 45：Change Impact and Re-architecture

实现：

- Agent 10 Change；
- Architecture Object Traversal；
- Budgets；
- Candidates；
- Interfaces；
- Modes；
- Downstream Artifacts；
- Agent 11 Replan；
- Reverification；
- New Baseline Candidate；
- Preserve Old Baseline。

## Phase 46：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Pagination；
- Permissions；
- Audit；
- Metrics；
- Retention；
- Event Idempotency；
- Artifact Lifecycle。

## Phase 47：Benchmark、监控和生产发布

实现：

- Requirement Allocation；
- Function Decomposition；
- Interface Completeness；
- Power/Budget；
- State/Sequence；
- Candidate Quality；
- Diagram Fidelity；
- Traceability；
- Change Impact；
- Security；
- Performance；
- Provider Rollback；
- Feature Flags；
- Disaster Recovery。

## Phase 48：高级能力，可选

稳定后：

- Formal Architecture Constraint Solving；
- Architecture Co-simulation Handoff；
- Automatic Interface Control Document Collaboration；
- Cross-project Architecture Reuse；
- Architecture-to-KiCad Hierarchical Sheet Generation；
- Architecture-to-Firmware RTOS Task Partition；
- Multi-board Harness and Cable Architecture；
- Product-line Architecture and Feature Models；
- 仍不让 AI 自动批准架构或修改正式设计。

---

# 101. Codex 工作纪律

Codex 必须：

1. Agent 10 Baseline 是需求源；
2. Agent 11 Gate 是执行上下文；
3. Input Snapshot 不可变；
4. Context/Functional/Logical/Physical 分层；
5. Diagram 是 View，IR 是真值；
6. 图形对象绑定 IR ID；
7. AI 只生成 Candidate；
8. Function 有 Requirement Trace；
9. Function 有 Input/Output/Control；
10. Block 有 Responsibility；
11. Function-to-Block Allocation 显式；
12. Port 是一级对象；
13. 箭头不等于 Interface Contract；
14. Interface 端点存在；
15. Direction 和 Role 显式；
16. Electrical 和 Protocol 分开；
17. Connector 和 Logical Interface 分开；
18. Throughput 和 Latency 分开；
19. Error/Timeout/Retry 显式；
20. Isolation/Protection/Security 显式；
21. Interface Completeness 有状态；
22. Flow 有 Producer/Consumer；
23. Average/Peak/Burst 分开；
24. Buffer/Backpressure 显式；
25. Power Source/Converter/Rail/Load 分开；
26. Typical/Max/Peak/Inrush 分开；
27. Efficiency 有条件；
28. Duty Cycle 有来源；
29. 未批准 Assumption 不形成硬续航；
30. Power Sequence 必须无环；
31. Back-power 显式；
32. Clock Source/Domain/Crossing 显式；
33. Reset Assert/Deassert 显式；
34. Mode 覆盖启动、休眠、升级、测试和故障；
35. Sequence 有 Timeout/Failure；
36. Fault 有 Detection/Containment/Safe State；
37. Security Boundary 不等于认证结论；
38. Processing/Memory/Storage 有 Margin；
39. Bandwidth 包含协议开销；
40. Latency 按路径组成；
41. I/O Multiplex Conflict 显式；
42. Cost Allocation 只是 Candidate；
43. Module Reuse 有 Fit Gap；
44. Reference Design 有 Verification/License；
45. Hard Constraint 不被权重抵消；
46. Candidate Score Vector 完整；
47. 不自动选择最终 Candidate；
48. Critical Requirement 有 Function/Block/Verification；
49. Interface Conflict 阻断 Baseline；
50. Power/Performance Budget Overflow 阻断 Baseline；
51. ADR 记录决策；
52. Open Question 有 Gate；
53. Architecture Review 在 Baseline 前；
54. Baseline 不可覆盖；
55. Downstream Package 绑定 Baseline；
56. Change 做全量影响分析；
57. 不直接修改原理图/固件/PCB；
58. 不调用高风险 Agent；
59. 不发送客户架构给未批准模型；
60. 不用客户资料做公开 Fixture；
61. 不伪造预算、接口、批准或 Benchmark；
62. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Profile/Pattern/Module Contract 变化；
    - 测试命令和真实结果；
    - Functions/Blocks；
    - Ports/Interfaces；
    - Power/Flows；
    - Clock/Reset/Modes；
    - Budgets；
    - Candidates/Pareto；
    - Diagrams；
    - Findings/Questions；
    - Verification/Baseline；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 102. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input and Context

1. Approved Requirement Baseline；
2. Unapproved Baseline；
3. Baseline Hash Mismatch；
4. Agent 11 Architecture Task；
5. Missing Project Profile；
6. Product Boundary；
7. External Actor；
8. Customer-supplied Module；
9. Factory-only Interface；
10. Out-of-scope Cloud；
11. Variant Boundary；
12. Trust Boundary；
13. Power Source Missing；
14. Mechanical Context；
15. Manufacturing Context。

## Functional and Logical

16. Single Function；
17. Function Decomposition；
18. Compound Requirement Split；
19. Duplicate Function；
20. Function Overlap；
21. Missing Function；
22. Function without Requirement；
23. Logical Block；
24. Shared Service Block；
25. Safety Boundary Block；
26. Security Block；
27. Function Allocation；
28. Partial Allocation；
29. Over-allocation；
30. Function without Block；
31. Block without Responsibility；
32. Variant Function；
33. AI Candidate Not Approved；
34. Template Candidate；
35. Historical Pattern Candidate。

## Ports and Interfaces

36. Power Input Port；
37. Analog Input；
38. Bidirectional Digital；
39. Clock；
40. Reset；
41. Interrupt；
42. Debug；
43. Wireless；
44. Port Multiplicity；
45. Optional Variant Port；
46. SPI Contract；
47. USB Role Ambiguity；
48. CAN Electrical/Protocol；
49. LVDS Direction；
50. Voltage Mismatch；
51. Role Conflict；
52. Protocol Conflict；
53. Rate Undefined；
54. Latency Undefined；
55. Connector Missing；
56. Isolation Missing；
57. Protection Missing；
58. Error Handling Missing；
59. Hot-plug；
60. Interface Complete。

## Flows and Modes

61. Data Average Rate；
62. Peak Rate；
63. Burst；
64. Protocol Overhead；
65. Backpressure；
66. Control Command/Ack；
67. Timeout/Retry；
68. Interrupt Burst；
69. Feedback Loop；
70. Off Mode；
71. Sleep Mode；
72. Charging Mode；
73. Firmware Update；
74. Factory Test；
75. Fault Mode；
76. Unreachable Mode；
77. Dead-end Transition；
78. Transition Timeout；
79. Power-up Sequence；
80. Calibration Sequence。

## Power, Clock and Reset

81. External Source；
82. Battery/Charger；
83. Buck/LDO；
84. Switchable Rail；
85. Always-on Rail；
86. Typical/Peak Load；
87. Inrush；
88. Efficiency Propagation；
89. Power Budget Overflow；
90. Duty-cycle Unknown；
91. Runtime Candidate；
92. Reverse Current；
93. Back-power；
94. Power Sequence Cycle；
95. Clock Source；
96. Clock Accuracy；
97. Clock Domain Crossing；
98. POR；
99. Watchdog Reset；
100. Reset Deassert Synchronization。

## Budgets

101. Processing Budget；
102. FPGA Allocation；
103. Memory Stack/Heap；
104. Frame Buffer；
105. Firmware Update Storage；
106. Bandwidth Overhead；
107. Concurrent Streams；
108. Latency Serial Path；
109. Parallel Path；
110. Jitter；
111. GPIO Budget；
112. DMA Conflict；
113. Pin Mux Conflict；
114. Thermal Allocation；
115. Mechanical Envelope；
116. Cost Candidate；
117. Complexity Budget；
118. Missing Margin；
119. Assumption Trace；
120. Budget Diff。

## Candidates and Reuse

121. Single MCU Candidate；
122. MCU+FPGA；
123. MCU+Linux；
124. Multi-board；
125. Module Reuse；
126. Module Interface Gap；
127. Module Power Gap；
128. Unverified Module；
129. Reference Design Match；
130. Reference License Restriction；
131. Hard Dimension Violation；
132. Hard Isolation Violation；
133. Cost Objective；
134. Power Objective；
135. Reuse Objective；
136. Pareto Dominance；
137. Balanced Candidate；
138. No Auto Selection；
139. Candidate Determinism；
140. Candidate Diff。

## Review, Baseline and Security

141. Requirement Coverage；
142. Interface Consistency；
143. Mode Completeness；
144. Fault Path Missing；
145. Test Path Missing；
146. Security Boundary Gap；
147. Open Question Gate；
148. ADR；
149. Review Package；
150. Baseline Approval Missing；
151. Immutable Baseline；
152. Downstream Schematic Package；
153. Firmware Package；
154. PCB Constraint Package；
155. Requirement Change Impact；
156. Preserve Old Baseline；
157. Prompt Injection in Requirement；
158. Malicious Diagram Label；
159. Expression Injection；
160. Tenant Isolation；
161. Private Architecture External Model Policy；
162. Audit Replay；
163. 10k Blocks/Ports；
164. 100k Flows；
165. Diagram Layout Timeout。

---

# 103. 初始质量目标

```text
Critical Requirement Function Allocation Coverage = 100%
Critical Requirement Block Allocation Coverage = 100%
Critical Requirement Verification Allocation Coverage = 100%
Approved Block Responsibility Coverage = 100%
Approved Port Interface Contract Coverage = 100%
Critical Interface Endpoint Coverage = 100%
Critical Interface Electrical/Protocol/Timing Coverage = 100%
Power Consumer-to-Source Trace Coverage = 100%
Unapproved Duty-cycle Used for Runtime Commitment = 0
Power Sequence Cycle in Approved Baseline = 0
Hard Constraint Violation in Approved Candidate = 0
AI Candidate Direct Baseline Entry = 0
Architecture Diagram Object without IR ID = 0
Approved Downstream Package Baseline Binding = 100%
Requirement Change without Architecture Impact Analysis = 0
Architecture Baseline Overwrite = 0
Private Architecture Sent to Unapproved External Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 104. 性能要求

常规项目：

```text
100–5,000 Requirements
20–1,000 Functions
20–1,000 Blocks
50–5,000 Ports
50–10,000 Interfaces/Flows
5–100 Architecture Candidates
```

目标：

```text
Readiness P95 < 15 s
Deterministic Function Decomposition P95 < 30 s
Interface Validation P95 < 10 s for 10k interfaces
Power/Budget Calculation P95 < 15 s
Coverage/Consistency P95 < 30 s
Candidate Evaluation P95 < 60 s excluding solver/model calls
Diagram Render P95 < 10 s per 1k objects
Interactive Object Query P95 < 300 ms
Change Impact P95 < 30 s for 100k trace edges
```

候选搜索：

```text
可配置 Time Budget
可取消
返回当前有效 Pareto 集
保存 Seed/Solver/Gap
基础规则候选不依赖求解器
```

大型项目要求：

- 分层图；
- 图分区；
- 增量重算；
- Spatial/Layout Cache；
- Parquet；
- Worker Pool；
- Model Rate Limit；
- Partial Diagnostics；
- 不把完整架构一次发送给模型。

---

# 105. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/functional-architecture-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第12个 Agent：

Functional Architecture, System Block Diagram & Interface Flow Synthesis Agent /
功能架构与框图 Agent。

本 Agent 接收：

- Agent 10 Requirement Baseline、Constraint、Goal、Assumption、Acceptance Criteria 和 Change；
- Agent 11 Architecture Task、Milestone、Gate、Risk 和 Project Baseline；
- Product/Variant/Mechanical/Manufacturing Context；
- Architecture Templates and Patterns；
- Module Library；
- Component Capability Library；
- Reference Designs；
- Enterprise Policies；

输出：

- Product Context and Boundary；
- Functional Decomposition；
- Logical and Physical Architecture；
- Blocks/Ports/Interfaces；
- Power Tree and Domains；
- Data/Control/Event/Fault Flows；
- Clock/Reset/Interrupt；
- Modes/Transitions/Sequences；
- Processing/Memory/Storage/Bandwidth/Latency/I/O/Power Budgets；
- Module and Reference Design Candidates；
- Multiple Architecture Candidates and Pareto；
- Findings/Questions/ADRs；
- Verification Allocation；
- Architecture Baseline；
- Schematic/Firmware/PCB/Mechanical/Simulation/Manufacturing Packages。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10、11、12 和 Agent 16–45 规格；
3. docs/functional-architecture-agent-spec.md；
4. 当前 Requirement Baseline/Graph/Change；
5. 当前 Project Plan/Milestone/Gate；
6. 当前 Product/Variant/Subsystem/Module；
7. 当前 Function/Block/Port/Interface/Flow；
8. 当前 Architecture Diagram；
9. 当前 Power Tree/Budget；
10. 当前 Data/Control/Clock/Reset/Mode；
11. 当前 Module Library；
12. 当前 Reference Design Library；
13. 当前 Candidate/Constraint/Scoring；
14. 当前 Review/ADR/Baseline；
15. 当前 Downstream Agent Contracts；
16. 当前 AI Provider/Prompt/Structured Output；
17. 当前 UI/API/Worker/Storage/Security；
18. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Agent 10 Baseline Drives Architecture；
- Agent 11 Gate Controls Execution；
- One Job = One Immutable Input Snapshot；
- Context/Functional/Logical/Physical Are Separate；
- Architecture IR Is Truth, Diagrams Are Views；
- AI Produces Candidates Only；
- Every Function Has Requirement Trace；
- Every Block Has Responsibilities；
- Function-to-Block Allocation Explicit；
- Ports Are First-class；
- Arrow != Interface Contract；
- Direction/Role/Electrical/Protocol/Timing Explicit；
- Connector != Logical Interface；
- Data Rate != Effective Throughput；
- Average/Peak/Burst Separated；
- Buffer/Backpressure/Error/Retry Explicit；
- Power Source-to-Consumer Trace；
- Typical/Max/Peak/Inrush Separated；
- Duty Cycle Has Evidence；
- Power Sequence Must Be Acyclic；
- Back-power and Reverse Current Explicit；
- Clock/Reset Domains Explicit；
- Modes Include Startup/Sleep/Update/Test/Fault；
- Fault Detection/Containment/Safe State；
- Security Boundary Does Not Claim Compliance；
- Budgets Use Decimal/Units/Assumptions/Margin；
- Module/Reference Reuse Has Fit Gap and Evidence；
- Hard Constraints Cannot Be Weighted Away；
- Multiple Candidates/Pareto；
- No Automatic Architecture Selection；
- Critical Requirements Have Function/Block/Verification；
- Interface/Power/Budget Blocks Baseline；
- Architecture Review Before Baseline；
- Immutable Baseline；
- Downstream Packages Bind Baseline；
- Change Requires Full Impact；
- No Direct Schematic/Firmware/PCB Mutation；
- No External Private Architecture Data；
- 不用客户架构做公开 Fixture；
- 不伪造接口、预算、批准和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改现有架构：

1. 侦察当前仓库；
2. 查找 Agent 10 Baseline/Allocation/Change；
3. 查找 Agent 11 Architecture Task/Gate；
4. 查找 Product/Variant/Subsystem/Module；
5. 查找 Function/Block/Port/Interface/Flow；
6. 查找 Context/Functional/Logical/Physical Views；
7. 查找 Power Tree/Domain/Budget；
8. 查找 Data/Control/Clock/Reset/Mode/Sequence；
9. 查找 Processing/Memory/Bandwidth/Latency/I/O Budget；
10. 查找 Safety/Security/Fault；
11. 查找 Module Library；
12. 查找 Reference Design；
13. 查找 Candidate Generator/Constraint/Scoring/Pareto；
14. 查找 Diagram Renderer/Layout；
15. 查找 Review/ADR/Baseline/Change；
16. 查找 Downstream Agent Contracts；
17. 查找 AI Provider/Prompt/Structured Output；
18. 查找 UI/API/Worker/Storage/Security；
19. 统计 Requirement Allocation Coverage；
20. 统计 Interface Completeness；
21. 统计 Power/Budget/Mode 缺失；
22. 统计框图与设计 Artifact 漂移；
23. 抽样分析开源、合成、脱敏或授权 Fixture；
24. 在 docs/functional-architecture-implementation-plan.md 中生成实施计划；
25. 在 docs/architecture-input-and-gates.md 中定义输入；
26. 在 docs/context-and-boundary.md 中定义边界；
27. 在 docs/functional-decomposition.md 中定义 Function；
28. 在 docs/logical-and-physical-architecture.md 中定义 Block；
29. 在 docs/ports-and-interface-contracts.md 中定义接口；
30. 在 docs/power-tree-and-domains.md 中定义电源；
31. 在 docs/data-control-and-fault-flows.md 中定义 Flow；
32. 在 docs/clock-reset-and-modes.md 中定义状态；
33. 在 docs/architecture-budgets.md 中定义预算；
34. 在 docs/architecture-candidates.md 中定义候选；
35. 在 docs/module-and-reference-reuse.md 中定义复用；
36. 在 docs/verification-and-traceability.md 中定义验证；
37. 在 docs/diagrams-and-views.md 中定义图形；
38. 在 docs/baselines-and-changes.md 中定义 Baseline；
39. 在 docs/downstream-agent-contracts.md 中定义下游；
40. 在 docs/ai-boundaries.md 中定义 AI；
41. 在 docs/security.md 中定义安全；
42. 在 docs/functional-architecture-migration-plan.md 中定义旧流程迁移；
43. 在 docs/functional-architecture-benchmark-plan.md 中定义 Benchmark；
44. 给出拟新增、拟修改和拟复用文件；
45. 给出 Phase 1 精确范围；
46. 不修改业务代码；
47. 不创建 Migration；
48. 不安装 Renderer/Solver/模型；
49. 不修改 Architecture；
50. 不冻结 Baseline；
51. 不触发下游 Agent；
52. 不调用生产外部模型；
53. 不读取或打印 Secret/客户架构/成本/安全资料；
54. 运行仓库已有 lint、type check、test、build 和 security scan；
55. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10/11 和下游 Contracts；
- Input Gate；
- Architecture Profile；
- Context/Boundary；
- Functions；
- Blocks；
- Ports/Interfaces；
- Power Tree；
- Data/Control/Fault；
- Clock/Reset/Modes；
- Budgets；
- Module/Reference Reuse；
- Candidate/Pareto；
- Diagrams；
- Coverage/Consistency；
- Questions/ADR；
- Verification；
- Baseline/Change；
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

# 106. 后续 Phase 提示词模板

```text
继续实现 Functional Architecture Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10、11、12 和相关下游 Agent 规格；
3. 阅读 Functional Architecture Implementation Plan；
4. 阅读 Input、Context、Function、Block、Interface、Power、Flow、Mode、Budget、Candidate、Diagram、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Requirement-baseline-driven；
- Layered Architecture；
- Interface Contracts First；
- Evidence-grounded Budgets；
- Hard Constraints First；
- Candidate-before-approval；
- IR Is Truth；
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
9. graph/interface/power tests；
10. budget/candidate tests；
11. diagram/baseline tests；
12. downstream contract tests；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Profile/Pattern/Module Contract 变化；
- 测试命令和真实结果；
- Functions/Blocks；
- Ports/Interfaces；
- Power/Flows；
- Clock/Reset/Modes；
- Budgets；
- Candidates/Pareto；
- Diagrams；
- Findings/Questions；
- Verification/Baseline；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 107. MVP 演示流程

1. 使用 Agent 10 冻结的“便携式双通道测量仪”Requirements Baseline 1.0；
2. Agent 11创建 Architecture Work Package 和 Architecture Freeze Gate；
3. Agent 12冻结 Input Snapshot；
4. 定义产品边界：
5. 产品本体；
6. USB-C 电源和数据；
7. 两路 BNC 模拟输入；
8. LCD、按键和旋钮；
9. 可选电池；
10. PC Host；
11. 工厂测试工具；
12. 建立 Context Diagram；
13. 将需求分解为：
14. 输入保护；
15. 模拟调理；
16. 数据采集；
17. 数字处理；
18. 波形显示；
19. USB 通信；
20. 用户控制；
21. 电源管理；
22. 存储；
23. 校准；
24. 自检和升级；
25. 建立 Logical Blocks；
26. Analog Front End；
27. ADC；
28. Processing and Control；
29. Display/UI；
30. USB Interface；
31. Power Management；
32. Battery/Charging；
33. Calibration Reference；
34. Storage；
35. Factory Test/Debug；
36. 建立 Block Responsibilities；
37. 创建 Ports；
38. 为 ADC→Processor 创建数字数据接口；
39. 接口候选为并行 ADC、SPI 和 FPGA 接口；
40. 因 45 Msps 双通道数据量，普通 SPI 候选带宽不足；
41. 生成 `bandwidth_budget_exceeded` Finding；
42. 创建候选 A：高速并行 ADC + MCU PIO/DMA；
43. 创建候选 B：ADC + FPGA + MCU；
44. 创建候选 C：集成高速 ADC 的 MCU/SoC 候选；
45. 建立 USB-C Interface Contract；
46. 明确 Device Role、数据速率、5V 输入、无 PD；
47. 建立电源树：
48. USB-C 5V；
49. 输入保护；
50. Battery Charger/Power Path；
51. 5V Analog；
52. 3.3V Digital；
53. 1.2V Core candidate；
54. 可切换显示背光；
55. 建立 Active、Idle、Sleep、Charging、Update 和 Factory Test 模式；
56. 计算 Typical、Peak、Inrush 和 Sleep Budget；
57. 发现 USB 500mA 输入约束与显示背光、ADC 和处理峰值冲突；
58. 生成两种候选：
59. 限功率模式；
60. USB-C 更高电流输入要求；
61. 电池峰值辅助；
62. 不自动选择；
63. 建立 Data Flow：
64. Analog Input→AFE→ADC→Buffer→Processing→Display/USB；
65. 建立 Control Flow：
66. UI→Processor→AFE Range/Gain；
67. Processor→ADC Trigger；
68. Processor→Display；
69. 建立 Clock Tree；
70. ADC Sample Clock；
71. Processor Clock；
72. USB Clock；
73. 识别时钟准确度和抖动需求缺失；
74. 创建 Open Question；
75. 建立 Reset Tree；
76. POR；
77. Brownout；
78. Watchdog；
79. USB Update Reset；
80. 建立 Measurement Sequence；
81. 建立 Calibration Sequence；
82. 建立 Firmware Update Sequence；
83. 建立 Fault Flow：
84. Overvoltage；
85. ADC Overflow；
86. USB Disconnect；
87. Battery Low；
88. Thermal Shutdown；
89. 计算 Memory Budget：
90. 双通道采样缓冲；
91. LCD Framebuffer；
92. Firmware Update Image；
93. Log；
94. 比较候选；
95. Candidate A 成本低、固件复杂度高；
96. Candidate B 性能余量高、成本和功耗高；
97. Candidate C 集成度高、供应风险待确认；
98. 输出 Pareto 集；
99. 生成 Context、Functional、Logical、Power、Data Flow、State 和 Candidate Diagrams；
100. 所有图对象绑定 IR ID；
101. 架构评审选择 Candidate B：ADC + FPGA + MCU；
102. 记录 ADR；
103. 关闭关键接口和预算问题；
104. 将剩余时钟精度问题绑定在 Schematic Freeze 前；
105. 生成 Verification Allocation；
106. Agent 23负责模拟前端和数据率分析；
107. Agent 21负责 FPGA/MCU/BSP/协议框架；
108. Agent 24负责时钟、差分、电源和接口 PCB 约束；
109. Agent 25负责 AFE、ADC、FPGA、电源和接口布局分区；
110. Agent 27负责 SI/PI/EMC；
111. Agent 28负责显示、连接器、电池和高度；
112. 冻结 Architecture Baseline 1.0；
113. 生成 Schematic/Firmware/PCB/Mechanical/Verification Packages；
114. Agent 11 Architecture Freeze Gate 通过；
115. 客户后续要求增加 Wi-Fi；
116. Agent 10创建 Requirement Change；
117. Agent 12识别受影响：
118. Power Budget；
119. Antenna/Mechanical；
120. Processing；
121. Data Flow；
122. Security；
123. Firmware；
124. EMC；
125. Certification；
126. PCB Placement；
127. 生成 Candidate 更新和 Change Impact；
128. Agent 11重新计算项目任务和里程碑；
129. 评审通过后冻结 Architecture Baseline 1.1；
130. 保留 Baseline 1.0。

---

# 108. 生产上线顺序

第一阶段：

```text
Requirement Baseline Intake
Context/Boundary
Functional Decomposition
Logical Blocks
Ports/Interface Contracts
Power Tree
Manual Candidate Review
SVG Views
```

第二阶段：

```text
Data/Control/Clock/Reset/Modes
Power/Bandwidth/Latency Budgets
Module/Reference Matching
Multiple Candidates/Pareto
Architecture Baseline
Downstream Packages
```

第三阶段：

```text
Formal Constraint Solver
Product-line Architecture
Architecture Co-simulation
Multi-board/Cable Architecture
Automatic Hierarchical Sheet and Firmware Skeleton Handoff
Enterprise Architecture Reuse
```

上线优先确保：

```text
需求是否真正分配到了 Function、Block 和 Verification
图中的每一条线是否有完整 Interface Contract
电源、带宽、时延和资源预算是否有条件、假设和余量
启动、升级、测试、故障和维护模式是否被覆盖
候选方案之间的优劣是否可解释，而不是模型拍脑袋
Architecture Baseline 是否能稳定驱动原理图、固件、PCB 和测试
```

一个靠谱的功能架构 Agent，不是更会画框框和箭头。它应该让每个工程师都能回答：这个模块到底负责什么、这条线到底传什么、谁给谁供电、什么情况下会关闭、最坏情况下够不够用，以及这个结论从哪条需求来的。
