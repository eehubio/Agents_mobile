# 项目拆解与里程碑 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：11  
> Agent 名称：Engineering Project Decomposition, Milestone Planning & Execution Orchestration Agent  
> 中文名称：项目拆解与里程碑 Agent  
> 类型：编排型  
> 版本：V1.0  
>
> 定位：接收 Agent 10 冻结或待审的 Requirement Baseline、产品架构、企业流程模板、团队能力、资源日历、历史项目、采购交期和 Agent 16–45 的能力契约，将项目拆解为硬件、固件、FPGA、结构、仿真、测试、合规、采购、供应链、PCB、SMT、制造、质量、文档、认证和发布工作包；建立 WBS、Deliverable、Task、Dependency DAG、RACI、Milestone、Gate、Risk、Issue、Decision、Assumption 和 Change Impact；在执行阶段依据真实状态、产物、审批、资源和风险动态更新计划，并以受控方式触发或等待下游 Agent。
>
> 上游：
> - Agent 10：Requirement Baseline、Requirement IR、约束、目标、假设、问题、冲突、验收标准和变更影响
> - 产品/系统架构：Subsystem、Block、Interface、Allocation、技术路线和 Make/Buy 决策
> - 项目模板：EVT/DVT/PVT、NPI、教育产品、仪器、开发板、IoT、工业控制器等
> - 企业流程：设计评审、ECO/ECN、采购、认证、制造、质量和发布流程
> - 团队数据：角色、技能、区域、工作日历、容量、负责人和审批权限
> - 历史项目：实际工期、返工、缺陷、采购交期、风险和里程碑偏差
> - 供应链：长交期物料、MOQ、替代料、样品、打样和认证周期
> - PLM/PM/CRM/ERP/MES：项目、任务、客户承诺、预算、库存、订单和生产状态
> - Agent 16–45：能力、输入 Gate、输出 Artifact、预估运行时间和失败模式
>
> 下游：
> - 系统架构、器件选型、原理图、PCB、固件、机械、制造和测试工作流
> - Agent 16：EDA 工程解析任务
> - Agent 17：PDF/图片原理图识别任务
> - Agent 18：Netlist 重建任务
> - Agent 19：KiCad MCP 受控执行任务
> - Agent 20：EDA 库和 Pin-Pad 校验任务
> - Agent 21：固件与驱动框架生成任务
> - Agent 22：ERC 与 AI 原理图审查任务
> - Agent 23：电路仿真任务
> - Agent 24：PCB 约束提取任务
> - Agent 25：PCB 初步布局任务
> - Agent 26：PCB 自动布线任务
> - Agent 27：DRC/SI/PI/EMC 审查任务
> - Agent 28：3D 与机械干涉任务
> - Agent 29：生产文件生成任务
> - Agent 30：DFM/DFA 制造可行性任务
> - Agent 31–40：BOM、供应链、报价和采购任务
> - Agent 41–45：库存、追溯、NPI、制造订单和质量任务
> - 人工工程师、项目经理、采购、制造、质量、客户和审批人
>
> 核心输出：
> - Project Planning Input Snapshot
> - Project Execution Profile
> - Work Breakdown Structure IR
> - Work Package Set
> - Task and Subtask IR
> - Deliverable Register
> - Dependency DAG
> - Requirement-to-Task Traceability
> - Artifact-to-Task Traceability
> - RACI and Ownership Matrix
> - Resource and Capacity Plan
> - Duration Estimate Register
> - Project Calendar and Scheduling Model
> - Milestone and Gate Plan
> - Critical Path and Near-critical Path
> - Risk Register
> - Issue Register
> - Decision Register
> - Assumption Register Link
> - Long-lead Procurement Plan
> - Verification and Review Plan
> - Agent Execution Plan
> - Project Baseline
> - Progress and Forecast Snapshot
> - Schedule Variance and Recovery Plan
> - Change Impact and Replan Package
> - Project Release Manifest
>
> 重要边界：
> - 本 Agent 负责拆解、计划、依赖、协调和状态编排，不替代各专业负责人做工程判断。
> - 不把 AI 自动生成的任务、工期、负责人或风险直接写入批准计划。
> - 不将所有任务都估成固定天数；工期必须带来源、假设、范围、置信度和估算方法。
> - 不把 Agent 运行时间等同于完整工程工期；人工评审、等待、采购、制造和返工必须独立建模。
> - 不自动给具体人员分配任务，除非角色、技能、容量、权限和组织 Policy 均满足。
> - 不通过“压缩工期”自动删除评审、测试、认证、质量和生产 Gate。
> - 不把任务完成百分比当成真实进度；优先使用 Artifact、验收条件和 Gate 状态。
> - 不允许循环依赖进入批准计划。
> - 不把所有依赖都视为 Finish-to-Start；支持 SS、FF、SF、Lag、Lead 和条件依赖。
> - 不将 Requirement Baseline 之外的 AI 推断当作项目范围。
> - 不自动关闭风险、问题、阻塞和待确认问题。
> - 不在需求变更后只改甘特图日期；必须重新计算范围、依赖、资源、采购、验证和发布影响。
> - 不自动承诺客户交付日期。
> - 不把最早完成日期当作承诺日期；需要考虑风险储备、审批、供应链和外部依赖。
> - 不直接执行高风险 Agent 写入、采购下单、生产下单或发布动作；仅创建受控计划和待批准执行请求。
> - 不发送客户项目、人员绩效、成本和供应链机密给未经批准的外部模型。
> - 所有 Task、Milestone、Gate、Owner、Estimate 和状态必须可追溯到来源、模板、历史数据、负责人承诺或批准决策。

---

# 1. Agent 11 的系统位置

```text
Agent 10 Requirement Baseline
              ↓
Project Scope and Product Breakdown
              ↓
WBS / Work Packages / Deliverables
              ↓
Dependencies / RACI / Resources / Estimates
              ↓
Schedule / Critical Path / Milestones / Gates
              ↓
Risks / Issues / Decisions / Long-lead Items
              ↓
Human and Agent Execution Orchestration
              ↓
Artifact-based Progress and Forecast
              ↓
Change Impact / Replan / Recovery
              ↓
Project Baseline and Release
```

---

# 2. 为什么需要独立 Agent 11

常见项目问题包括：

1. 需求已经结构化，但没有转成可执行工作；
2. 原理图、PCB、结构和固件并行启动，却没有接口冻结点；
3. PCB 布局开始后，连接器位置还没确认；
4. 固件工程师等待硬件样机，没有提前建立仿真和 Stub；
5. 长交期器件到 DVT 才开始采购；
6. 测试任务只在最后阶段出现；
7. 认证、治具、包装和文档被遗漏；
8. 项目计划只有任务，没有 Deliverable 和验收条件；
9. “原理图完成 90%”无法判断剩余风险；
10. 任务负责人被分配，但没有审批人和协作角色；
11. 供应商交期改变后，计划没有传播影响；
12. 客户新增一个接口，只改了需求，不重排 PCB、结构、测试和制造；
13. 自动化 Agent 执行失败后，没有人工接管路径；
14. 项目里程碑看似按时，但关键 Artifact 没有通过 Gate；
15. 项目经理依赖手工更新 Excel，计划与 PLM/EDA/ERP 状态脱节。

Agent 11 的职责是：

```text
Approved Scope
→ Executable Work
→ Observable Deliverables
→ Explicit Dependencies
→ Controlled Execution
→ Evidence-based Forecast
```

---

# 3. 项目对象层次

```text
program
project
phase
workstream
work_breakdown_element
work_package
task
subtask
checklist_item
deliverable
milestone
gate
```

推荐关系：

```text
Project
├── Phase
│   ├── Workstream
│   │   ├── Work Package
│   │   │   ├── Task
│   │   │   ├── Deliverable
│   │   │   └── Gate
│   │   └── Milestone
│   └── Phase Gate
└── Project Release
```

---

# 4. Project Phase

支持：

```text
discovery
requirements
architecture
feasibility
concept
schematic
prototype
pcb_design
mechanical_design
firmware
verification
evt
dvt
pvt
certification
npi
mass_production
service
closure
```

企业可定义自己的 Phase Model。

---

# 5. Workstream

典型工作流：

```text
product_management
system_architecture
hardware
analog
digital
rf
fpga
firmware
software
mechanical
industrial_design
simulation
test
compliance
procurement
supply_chain
pcb_fabrication
smt_assembly
manufacturing_engineering
quality
documentation
packaging
customer_review
```

---

# 6. Work Package

Work Package 是可管理的最小交付单元，必须包含：

```text
scope
inputs
outputs
owner role
contributors
approver
dependencies
estimate
acceptance criteria
required evidence
risk class
execution mode
```

---

# 7. Task 类型

```text
analysis
design
implementation
review
approval
simulation
test
prototype
procurement
supplier_confirmation
manufacturing
inspection
documentation
customer_decision
agent_execution
manual_intervention
waiting
handoff
```

---

# 8. Execution Mode

```text
human
agent
human_with_agent
external_supplier
automated_system
approval_only
waiting
```

---

# 9. Task 状态

```text
draft
proposed
ready
blocked
scheduled
in_progress
waiting_external
waiting_approval
review
completed
failed
cancelled
deferred
superseded
```

---

# 10. Deliverable

每个 Deliverable 保存：

```text
deliverable type
artifact schema
required format
source system
version
revision
owner
reviewer
approver
acceptance criteria
required evidence
release status
```

---

# 11. Deliverable 类型

```text
requirement_baseline
architecture_spec
block_diagram
interface_control_document
schematic
netlist
bom
simulation_report
firmware_repository
bsp
driver
pcb_constraint_ir
placement_ir
routing_ir
drc_report
mechanical_model
test_plan
test_report
gerber_package
assembly_package
dfm_report
supplier_quote
purchase_order
prototype_unit
inspection_report
certification_report
manufacturing_release
user_documentation
```

---

# 12. Milestone

Milestone 是零工期的状态点，但必须有完成条件：

```text
name
target date
forecast date
actual date
required deliverables
required gates
required approvals
customer commitment
confidence
```

---

# 13. Gate

Gate 与 Milestone 分开：

```text
Milestone：计划和沟通节点
Gate：进入下一阶段所需的批准条件
```

Gate 类型：

```text
requirements_ready
architecture_ready
schematic_ready
pcb_layout_ready
design_review_ready
prototype_release_ready
evt_ready
dvt_ready
pvt_ready
certification_ready
mass_production_ready
project_close
```

---

# 14. Gate Condition

支持：

```text
artifact_exists
artifact_verified
review_passed
approval_received
finding_count_threshold
coverage_threshold
test_passed
supplier_confirmed
inventory_available
budget_approved
risk_accepted
question_resolved
```

---

# 15. WBS IR

```json
{
  "wbs_ir_version": "1.0.0",
  "project_id": "uuid",
  "planning_baseline_candidate_id": "uuid",
  "phases": [],
  "workstreams": [],
  "wbs_elements": [],
  "work_packages": [],
  "tasks": [],
  "deliverables": [],
  "milestones": [],
  "gates": [],
  "dependencies": [],
  "resources": [],
  "risks": [],
  "provenance": {}
}
```

---

# 16. Work Package IR

```json
{
  "work_package_id": "WP-HW-POWER-001",
  "title": "电源架构与原理图设计",
  "workstream": "hardware",
  "scope": {},
  "requirement_ids": [],
  "input_deliverable_ids": [],
  "output_deliverable_ids": [],
  "task_ids": [],
  "owner_role": "power_hardware_engineer",
  "approval_role": "hardware_lead",
  "estimate": {},
  "risk_class": "high",
  "execution_mode": "human_with_agent",
  "acceptance_criteria": [],
  "status": "proposed"
}
```

---

# 17. Task IR

```json
{
  "task_id": "TASK-HW-PWR-010",
  "title": "建立输入电源保护方案",
  "task_type": "design",
  "execution_mode": "human_with_agent",
  "requirement_ids": ["REQ-PWR-001"],
  "input_artifacts": [],
  "output_artifacts": [],
  "preconditions": [],
  "dependency_ids": [],
  "owner_role": "power_hardware_engineer",
  "candidate_owner_ids": [],
  "estimate": {},
  "calendar_id": "engineering-cn",
  "acceptance_criteria": [],
  "agent_invocation": null,
  "status": "proposed"
}
```

---

# 18. Task 来源

```text
requirement_derived
template_derived
architecture_derived
agent_contract_derived
risk_derived
compliance_derived
manufacturing_derived
historical_pattern
manual
ai_candidate
```

`ai_candidate` Task 不能自动进入批准 Baseline。

---

# 19. 需求到任务的拆解

流程：

```text
Requirement
→ Allocation
→ Workstream
→ Work Package
→ Task
→ Deliverable
→ Verification
→ Gate
```

每条 Critical Requirement 必须至少映射到：

```text
一个实现任务
一个审查或验证任务
一个可追溯 Deliverable
```

---

# 20. Product Breakdown Structure

除 WBS 外，建立 PBS：

```text
product
subsystem
module
board
mechanical assembly
firmware component
test fixture
manufacturing package
```

WBS 与 PBS 通过 Allocation 关联。

---

# 21. Dependency 类型

```text
finish_to_start
start_to_start
finish_to_finish
start_to_finish
artifact_dependency
approval_dependency
resource_dependency
supplier_dependency
conditional_dependency
```

---

# 22. Dependency IR

```json
{
  "dependency_id": "DEP-001",
  "predecessor_task_id": "TASK-A",
  "successor_task_id": "TASK-B",
  "dependency_type": "finish_to_start",
  "lag": {"value": "2", "unit": "working_day"},
  "condition": {},
  "required_artifact_ids": [],
  "source": {},
  "status": "proposed"
}
```

---

# 23. 依赖 DAG Gate

必须检查：

```text
cycle
orphan task
missing predecessor
missing required artifact
invalid negative lag
incompatible calendars
dependency to superseded task
conditional dependency without resolution
```

有循环依赖时不能冻结计划。

---

# 24. 并行任务

允许：

```text
硬件架构和器件预选并行
原理图设计和固件接口定义并行
PCB 初步布局和结构外壳初步设计并行
测试计划在设计阶段提前启动
采购长交期器件与设计并行
```

但需通过接口冻结和 Artifact Gate 控制。

---

# 25. Interface Freeze

典型冻结点：

```text
system architecture freeze
power tree freeze
connector type freeze
connector position freeze
pin assignment freeze
protocol freeze
mechanical envelope freeze
board outline freeze
firmware API freeze
manufacturing profile freeze
```

---

# 26. RACI

角色：

```text
responsible
accountable
consulted
informed
reviewer
approver
observer
```

每个 Work Package 必须有：

```text
至少一个 Responsible
恰好一个 Accountable，或按组织 Policy
明确 Approver
```

---

# 27. Owner Assignment

自动候选匹配输入：

```text
role
skills
certifications
project permissions
location/timezone
availability
capacity
conflict of interest
historical experience
task sensitivity
```

最终分配策略：

```text
manual_only
recommend_and_confirm
auto_assign_low_risk
```

默认使用 `recommend_and_confirm`。

---

# 28. Resource 类型

```text
person
role_pool
agent
machine
lab_equipment
software_license
test_fixture
supplier
manufacturing_line
budget
room
```

---

# 29. Resource Calendar

支持：

```text
working days
working hours
timezone
holiday
leave
maintenance
shared capacity
booking
overtime policy
```

---

# 30. Capacity Model

```text
nominal_capacity
committed_capacity
available_capacity
focus_factor
context_switch_penalty
maximum_parallel_tasks
skill_match
```

不把一个人一天 8 小时全部视为可计划产能。

---

# 31. Duration Estimate

统一结构：

```json
{
  "estimate_type": "three_point",
  "optimistic": "3",
  "most_likely": "5",
  "pessimistic": "9",
  "unit": "working_day",
  "method": "historical_analogy",
  "source_references": [],
  "assumptions": [],
  "confidence": {},
  "approval_status": "candidate"
}
```

---

# 32. Estimate 来源

```text
responsible_commitment
historical_actual
template
parametric
supplier_quote
agent_runtime_history
expert_judgment
ai_candidate
```

优先级由企业 Policy 决定。

---

# 33. 估算方法

```text
expert_judgment
analogous
parametric
three_point
bottom_up
supplier_commitment
agent_runtime_statistic
fixed_calendar_event
```

---

# 34. 工期和等待时间分离

```text
active_work_duration
elapsed_duration
waiting_duration
approval_duration
supplier_lead_time
manufacturing_cycle_time
shipping_time
buffer
```

---

# 35. Agent Task Duration

Agent 任务应保存：

```text
queue time
compute time
human review time
retry allowance
failure probability candidate
required upstream artifact wait
```

不能只使用模型调用耗时。

---

# 36. Project Calendar

项目日历由以下组成：

```text
team calendars
supplier calendars
factory calendars
shipping calendars
certification lab calendars
customer review windows
fixed events
```

---

# 37. Schedule Engine

输入：

```text
DAG
durations
calendars
resources
capacity
constraints
fixed dates
milestones
buffers
```

输出：

```text
earliest start/finish
latest start/finish
float
critical path
near-critical paths
resource conflicts
forecast dates
```

---

# 38. Scheduling Constraint

```text
as_soon_as_possible
as_late_as_possible
start_no_earlier_than
finish_no_later_than
must_start_on
must_finish_on
fixed_window
resource_window
supplier_window
```

---

# 39. Critical Path

要求：

```text
计算方法可回放
任务日历生效
Lag/Lead 生效
资源约束单独报告
固定日期和外部依赖生效
```

不将零 Float 自动解释为“最重要任务”；业务重要性和时间关键性分开。

---

# 40. Near-critical Path

保存：

```text
float threshold
path tasks
risk exposure
resource concentration
external dependency
```

---

# 41. Buffer

支持：

```text
project buffer
feeding buffer
supplier buffer
approval buffer
certification buffer
manufacturing buffer
```

Buffer 必须有 Policy 和依据，不能随意加百分比。

---

# 42. Milestone 计划

典型硬件项目：

```text
Requirements Baseline
Architecture Freeze
Critical Component Selection
Schematic Freeze
PCB Constraints Freeze
PCB Placement Review
PCB Routing Complete
Design Review Complete
Prototype Manufacturing Release
Prototype Boards Received
Bring-up Complete
EVT Complete
DVT Complete
Certification Complete
PVT Complete
Mass Production Release
```

---

# 43. Agent 10–30 映射

```text
Agent 10 Requirement Baseline
→ Agent 11 项目计划和 Gate

Agent 16/17/18
→ 设计输入解析和重建任务

Agent 20/21/22/23
→ 库、固件、原理图审查和仿真任务

Agent 24/25/26/27/28
→ PCB 约束、布局、布线、审查和机械任务

Agent 29/30
→ 生产文件和 DFM/DFA 任务
```

---

# 44. Agent Invocation Plan

每个 Agent Task 保存：

```text
agent number
capability
input artifact requirements
input gate
prompt/template version
execution policy
retry policy
timeout
human review requirement
expected outputs
success criteria
failure route
```

---

# 45. Agent 执行状态

```text
not_requested
queued
running
waiting_input
waiting_review
completed
completed_with_findings
failed_retryable
failed_permanent
cancelled
superseded
```

---

# 46. Agent 执行边界

高风险动作：

```text
EDA 写入
采购下单
生产下单
供应商发布
需求基线冻结
生产 Release 发布
```

必须创建 Approval Task，不直接执行。

---

# 47. Risk Register

风险字段：

```text
risk statement
cause
event
impact
probability
severity
exposure
affected tasks
affected milestones
trigger
mitigation
contingency
owner
review date
status
```

---

# 48. Risk Category

```text
requirements
technical
architecture
component
firmware
pcb
mechanical
simulation
test
compliance
supply_chain
procurement
supplier
manufacturing
quality
schedule
cost
resource
customer
security
```

---

# 49. 风险状态

```text
identified
assessed
mitigating
monitoring
triggered
converted_to_issue
closed
accepted
transferred
```

---

# 50. Risk 量化

支持：

```text
qualitative matrix
three-point schedule impact
cost range
milestone probability candidate
```

没有真实数据时不生成伪精确概率。

---

# 51. Issue Register

Issue 是已经发生的事件：

```text
description
detected date
severity
blocking tasks
affected deliverables
owner
resolution plan
target date
escalation
status
```

---

# 52. Decision Register

```text
decision
options
criteria
evidence
decision owner
decision date
affected requirements
affected tasks
effective revision
```

---

# 53. Open Question Register

Agent 10 的问题进入项目计划时，需要：

```text
owner
due date
required before milestone
affected work packages
default action if unanswered
escalation
```

默认行动不能自动改变硬需求。

---

# 54. Long-lead Procurement

识别：

```text
long lead component
sample lead time
MOQ
NRND/EOL
single source
custom mechanical part
tooling
certification lab slot
test equipment
factory capacity
```

---

# 55. Procurement Milestone

```text
supplier approved
sample ordered
sample received
qualification complete
production PO released
material available
incoming inspection complete
```

---

# 56. Make/Buy Task

```text
make
buy
reuse
modify_existing
outsource
unknown
```

`unknown` 需要 Decision Task。

---

# 57. Review Plan

评审类型：

```text
requirements review
architecture review
schematic review
pcb placement review
pcb routing review
design review
firmware review
mechanical review
test readiness review
manufacturing readiness review
npi review
quality review
release review
```

---

# 58. Review 输入

每个 Review Task 必须声明：

```text
required artifacts
required reviewers
agenda
checklist
pre-read duration
decision outputs
finding ownership
closure criteria
```

---

# 59. Progress Measurement

优先级：

```text
accepted deliverable
passed gate
verified artifact
completed task
reported percent complete
```

---

# 60. Physical Percent Complete

Task 可以按加权 Checklist 计算：

```text
analysis complete
implementation complete
self review
peer review
findings closed
deliverable approved
```

禁止仅由负责人输入“90%”覆盖证据状态。

---

# 61. Earned Progress

可选支持：

```text
planned value
earned value
actual cost
schedule performance candidate
cost performance candidate
```

没有可靠预算和工时数据时不启用。

---

# 62. Status Snapshot

保存：

```text
data cutoff time
task states
deliverable states
milestone forecast
critical path
resource conflicts
risks/issues
blocked tasks
approval queues
source system freshness
```

---

# 63. Forecast

输出：

```text
current forecast
best case
most likely
risk-adjusted candidate
committed date
confidence dimensions
```

Agent 不自行更新承诺日期。

---

# 64. Schedule Variance

区分：

```text
start variance
finish variance
duration variance
waiting variance
resource variance
supplier variance
scope variance
approval variance
```

---

# 65. Recovery Plan

候选措施：

```text
resequence
parallelize
split task
add resource
change resource
reduce waiting
expedite supplier
prototype with alternate
defer optional scope
increase review frequency
create temporary interface stub
```

不能自动删除硬需求或 Gate。

---

# 66. Change Impact

当 Agent 10 Requirement Change 到达：

```text
identify changed requirements
→ traverse requirement-task-artifact graph
→ identify obsolete or affected tasks
→ recalculate deliverables
→ recalculate dependencies
→ recalculate estimates and resources
→ recalculate milestones
→ identify re-verification
→ create replan candidate
→ request approval
```

---

# 67. Scope Change 类型

```text
add
remove
modify
clarify
variant_override
priority_change
schedule_change
cost_change
compliance_change
```

---

# 68. Replan 状态

```text
candidate
under_review
approved
rejected
partially_applied
applied
superseded
```

---

# 69. Project Baseline

包含：

```text
requirement baseline id
wbs
tasks
deliverables
dependencies
owners
estimates
calendars
resources
milestones
gates
risks
assumptions
approvals
manifest
hash
```

Baseline 不可覆盖。

---

# 70. Planning Release 类型

```text
concept_plan
execution_plan
prototype_plan
evt_plan
dvt_plan
pvt_plan
mass_production_plan
recovery_plan
change_plan
```

---

# 71. AI 允许职责

```text
生成 WBS 和 Task 候选
根据模板建议遗漏工作
解释依赖和风险
生成估算问题
生成 RACI 候选
生成恢复方案候选
总结进度和偏差
```

---

# 72. AI 禁止职责

```text
自动承诺工期
自动给人员分配高风险任务
编造工期、容量或供应商交期
删除测试和审批 Gate
自动关闭风险和 Issue
自动冻结项目 Baseline
自动执行采购、生产或 EDA 写入
将推断范围写成批准范围
```

---

# 73. 状态机

```text
RECEIVED
→ VALIDATING_REQUIREMENT_BASELINE
→ SNAPSHOTTING_INPUT
→ SELECTING_PROJECT_PROFILE
→ BUILDING_PRODUCT_BREAKDOWN
→ BUILDING_WBS
→ GENERATING_WORK_PACKAGES
→ GENERATING_TASKS
→ BUILDING_DELIVERABLES
→ BUILDING_DEPENDENCIES
→ VALIDATING_DAG
→ ASSIGNING_ROLE_CANDIDATES
→ ESTIMATING
→ RESOURCE_LOADING
→ SCHEDULING
→ CALCULATING_CRITICAL_PATH
→ GENERATING_MILESTONES_AND_GATES
→ BUILDING_RISK_REGISTER
→ REVIEW_REQUIRED
→ BASELINING
→ EXECUTION_READY
```

执行期：

```text
MONITORING
→ INGESTING_STATUS
→ DETECTING_VARIANCE
→ UPDATING_FORECAST
→ REPLANNING_REQUIRED
→ REPLAN_REVIEW
→ REBASELINING
→ MONITORING
```

分支：

```text
COMPLETED_DRAFT_ONLY
COMPLETED_WITH_OPEN_QUESTIONS
INPUT_BLOCKED
DEPENDENCY_CYCLE_BLOCKED
RESOURCE_CONFLICT_BLOCKED
ESTIMATE_REQUIRED
OWNER_REQUIRED
APPROVAL_REQUIRED
MILESTONE_AT_RISK
BASELINE_BLOCKED
CANCELLED
FAILED_TEMPORARY
FAILED_PERMANENT
```

---

# 74. 错误码

```text
PROJECT_NOT_FOUND
REQUIREMENT_BASELINE_NOT_FOUND
REQUIREMENT_BASELINE_NOT_APPROVED
REQUIREMENT_BASELINE_HASH_MISMATCH
PROJECT_PROFILE_NOT_FOUND
PROJECT_PROFILE_UNAPPROVED
WBS_TEMPLATE_NOT_FOUND
WORKSTREAM_UNMAPPED
REQUIREMENT_NOT_ALLOCATED
CRITICAL_REQUIREMENT_WITHOUT_TASK
TASK_WITHOUT_DELIVERABLE
TASK_WITHOUT_OWNER_ROLE
TASK_WITHOUT_ACCEPTANCE_CRITERIA
DEPENDENCY_TARGET_NOT_FOUND
DEPENDENCY_CYCLE_DETECTED
DEPENDENCY_CONDITION_UNRESOLVED
RESOURCE_NOT_FOUND
RESOURCE_CALENDAR_MISSING
RESOURCE_CAPACITY_EXCEEDED
SKILL_MISMATCH
ESTIMATE_MISSING
ESTIMATE_UNAPPROVED
FIXED_DATE_CONFLICT
MILESTONE_CONDITION_INVALID
GATE_CONDITION_INVALID
AGENT_CONTRACT_NOT_FOUND
AGENT_INPUT_GATE_UNSATISFIED
AGENT_EXECUTION_FAILED
SUPPLIER_LEAD_TIME_UNKNOWN
LONG_LEAD_ITEM_UNPLANNED
CRITICAL_RISK_WITHOUT_OWNER
OPEN_QUESTION_MISSED_DEADLINE
BASELINE_ALREADY_EXISTS
BASELINE_APPROVAL_MISSING
CHANGE_IMPACT_INCOMPLETE
REPLAN_APPROVAL_MISSING
CUSTOMER_COMMITMENT_CONFLICT
JOB_CANCELLED
INTERNAL_ERROR


---

# 75. 数据库设计

## 75.1 `project_planning_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
planning_profile_id UUID NULL
planning_mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 75.2 `project_planning_input_snapshots`

```text
id UUID PK
planning_job_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
project_context_hash CHAR(64) NOT NULL
architecture_snapshot_hash CHAR(64) NULL
project_profile_hash CHAR(64) NOT NULL
template_snapshot_hash CHAR(64) NOT NULL
agent_contract_snapshot_hash CHAR(64) NOT NULL
resource_snapshot_hash CHAR(64) NOT NULL
calendar_snapshot_hash CHAR(64) NOT NULL
historical_estimate_snapshot_hash CHAR(64) NULL
supplier_snapshot_hash CHAR(64) NULL
policy_snapshot_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_job_id, snapshot_hash)
```

## 75.3 `project_execution_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
project_type VARCHAR NOT NULL
phase_model JSONB NOT NULL
workstream_model JSONB NOT NULL
required_milestones JSONB NOT NULL
required_gates JSONB NOT NULL
approval_policy JSONB NOT NULL
risk_policy JSONB NOT NULL
schedule_policy JSONB NOT NULL
resource_policy JSONB NOT NULL
agent_orchestration_policy JSONB NOT NULL
applicable_conditions JSONB NOT NULL
source_reference JSONB NOT NULL
approval_status VARCHAR NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 75.4 `project_phase_instances`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
phase_key VARCHAR NOT NULL
phase_type VARCHAR NOT NULL
title VARCHAR NOT NULL
sequence_rank INT NULL
start_constraint JSONB NULL
finish_constraint JSONB NULL
entry_gate_id UUID NULL
exit_gate_id UUID NULL
status VARCHAR NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, phase_key)
```

## 75.5 `project_workstreams`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
workstream_key VARCHAR NOT NULL
workstream_type VARCHAR NOT NULL
title VARCHAR NOT NULL
lead_role VARCHAR NULL
lead_person_id UUID NULL
phase_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, workstream_key)
```

## 75.6 `project_wbs_versions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
wbs_version VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
planning_job_id UUID NOT NULL
node_count INT NOT NULL
work_package_count INT NOT NULL
task_count INT NOT NULL
deliverable_count INT NOT NULL
wbs_uri TEXT NOT NULL
wbs_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, wbs_version)
```

## 75.7 `project_wbs_nodes`

```text
id UUID PK
wbs_version_id UUID NOT NULL
node_key VARCHAR NOT NULL
parent_node_id UUID NULL
node_type VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
phase_id UUID NULL
workstream_id UUID NULL
sequence_rank INT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
requirement_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(wbs_version_id, node_key)
```

## 75.8 `project_work_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
wbs_node_id UUID NOT NULL
work_package_key VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
scope JSONB NOT NULL
requirement_ids JSONB NOT NULL
input_deliverable_ids JSONB NOT NULL
output_deliverable_ids JSONB NOT NULL
owner_role VARCHAR NOT NULL
accountable_role VARCHAR NULL
approval_role VARCHAR NULL
execution_mode VARCHAR NOT NULL
risk_class VARCHAR NOT NULL
estimate_id UUID NULL
acceptance_criteria JSONB NOT NULL
required_evidence JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, work_package_key)
```

## 75.9 `project_tasks`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
task_key VARCHAR NOT NULL
parent_task_id UUID NULL
work_package_id UUID NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
task_type VARCHAR NOT NULL
execution_mode VARCHAR NOT NULL
priority VARCHAR NOT NULL
criticality VARCHAR NOT NULL
requirement_ids JSONB NOT NULL
input_artifact_refs JSONB NOT NULL
output_artifact_specs JSONB NOT NULL
preconditions JSONB NOT NULL
owner_role VARCHAR NOT NULL
owner_person_id UUID NULL
accountable_role VARCHAR NULL
reviewer_ids JSONB NOT NULL
approver_ids JSONB NOT NULL
estimate_id UUID NULL
calendar_id UUID NULL
schedule_constraint JSONB NULL
agent_invocation_id UUID NULL
acceptance_criteria JSONB NOT NULL
required_evidence JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
progress_method VARCHAR NOT NULL
reported_progress NUMERIC NULL
evidence_progress NUMERIC NULL
planned_start TIMESTAMPTZ NULL
planned_finish TIMESTAMPTZ NULL
forecast_start TIMESTAMPTZ NULL
forecast_finish TIMESTAMPTZ NULL
actual_start TIMESTAMPTZ NULL
actual_finish TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(project_id, task_key)
```

## 75.10 `project_task_checklist_items`

```text
id UUID PK
task_id UUID NOT NULL
checklist_key VARCHAR NOT NULL
title VARCHAR NOT NULL
weight NUMERIC NOT NULL
required BOOLEAN NOT NULL
evidence_requirement JSONB NULL
status VARCHAR NOT NULL
completed_by UUID NULL
completed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(task_id, checklist_key)
```

## 75.11 `project_deliverables`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
deliverable_key VARCHAR NOT NULL
deliverable_type VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NULL
producing_task_ids JSONB NOT NULL
consuming_task_ids JSONB NOT NULL
artifact_schema VARCHAR NULL
required_formats JSONB NOT NULL
source_system VARCHAR NULL
artifact_reference JSONB NULL
revision VARCHAR NULL
artifact_hash CHAR(64) NULL
owner_role VARCHAR NOT NULL
reviewer_roles JSONB NOT NULL
approver_roles JSONB NOT NULL
acceptance_criteria JSONB NOT NULL
required_evidence JSONB NOT NULL
verification_status VARCHAR NOT NULL
release_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(project_id, deliverable_key)
```

## 75.12 `project_task_dependencies`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
dependency_key VARCHAR NOT NULL
predecessor_task_id UUID NOT NULL
successor_task_id UUID NOT NULL
dependency_type VARCHAR NOT NULL
lag_value NUMERIC NULL
lag_unit VARCHAR NULL
lead_value NUMERIC NULL
lead_unit VARCHAR NULL
condition_ir JSONB NULL
required_artifact_ids JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, dependency_key)
```

## 75.13 `project_dependency_validation_runs`

```text
id UUID PK
project_id UUID NOT NULL
wbs_version_id UUID NOT NULL
task_count INT NOT NULL
dependency_count INT NOT NULL
cycle_count INT NOT NULL
orphan_task_count INT NOT NULL
missing_artifact_dependency_count INT NOT NULL
invalid_constraint_count INT NOT NULL
cycle_paths JSONB NOT NULL
findings JSONB NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.14 `project_requirement_task_links`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_id UUID NOT NULL
task_id UUID NULL
work_package_id UUID NULL
deliverable_id UUID NULL
link_type VARCHAR NOT NULL
coverage_role VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.15 `project_raci_assignments`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
raci_role VARCHAR NOT NULL
person_id UUID NULL
role_key VARCHAR NULL
team_id UUID NULL
assignment_method VARCHAR NOT NULL
assignment_evidence JSONB NOT NULL
approval_status VARCHAR NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 75.16 `project_resources`

```text
id UUID PK
tenant_id UUID NOT NULL
resource_key VARCHAR NOT NULL
resource_type VARCHAR NOT NULL
title VARCHAR NOT NULL
person_id UUID NULL
role_key VARCHAR NULL
agent_number INT NULL
machine_reference JSONB NULL
supplier_reference JSONB NULL
skill_profile JSONB NOT NULL
permission_profile JSONB NOT NULL
capacity_profile JSONB NOT NULL
cost_profile JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, resource_key)
```

## 75.17 `project_resource_calendars`

```text
id UUID PK
tenant_id UUID NOT NULL
calendar_key VARCHAR NOT NULL
title VARCHAR NOT NULL
timezone VARCHAR NOT NULL
working_pattern JSONB NOT NULL
holidays JSONB NOT NULL
exceptions JSONB NOT NULL
maintenance_windows JSONB NOT NULL
overtime_policy JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, calendar_key)
```

## 75.18 `project_resource_assignments`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
task_id UUID NOT NULL
resource_id UUID NOT NULL
assignment_type VARCHAR NOT NULL
allocation_percentage NUMERIC NULL
planned_effort_hours NUMERIC NULL
planned_start TIMESTAMPTZ NULL
planned_finish TIMESTAMPTZ NULL
skill_match JSONB NOT NULL
capacity_check JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.19 `project_duration_estimates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
estimate_type VARCHAR NOT NULL
optimistic_value NUMERIC NULL
most_likely_value NUMERIC NULL
pessimistic_value NUMERIC NULL
single_value NUMERIC NULL
unit VARCHAR NOT NULL
active_work_value NUMERIC NULL
waiting_value NUMERIC NULL
approval_value NUMERIC NULL
buffer_value NUMERIC NULL
method VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_references JSONB NOT NULL
assumptions JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 75.20 `project_historical_estimate_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_category VARCHAR NOT NULL
work_package_type VARCHAR NOT NULL
task_type VARCHAR NOT NULL
complexity_vector JSONB NOT NULL
resource_skill_vector JSONB NOT NULL
planned_duration JSONB NULL
actual_duration JSONB NOT NULL
waiting_breakdown JSONB NOT NULL
rework_count INT NOT NULL
source_project_id UUID NULL
data_quality VARCHAR NOT NULL
anonymization_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.21 `project_schedule_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
wbs_version_id UUID NOT NULL
schedule_version INT NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
scheduling_mode VARCHAR NOT NULL
resource_constrained BOOLEAN NOT NULL
calendar_snapshot_hash CHAR(64) NOT NULL
resource_snapshot_hash CHAR(64) NOT NULL
fixed_constraints JSONB NOT NULL
seed BIGINT NULL
status VARCHAR NOT NULL
project_start TIMESTAMPTZ NULL
forecast_finish TIMESTAMPTZ NULL
critical_path_task_ids JSONB NOT NULL
near_critical_paths JSONB NOT NULL
resource_conflicts JSONB NOT NULL
schedule_uri TEXT NOT NULL
schedule_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, schedule_version)
```

## 75.22 `project_schedule_task_results`

```text
id UUID PK
schedule_run_id UUID NOT NULL
task_id UUID NOT NULL
early_start TIMESTAMPTZ NULL
early_finish TIMESTAMPTZ NULL
late_start TIMESTAMPTZ NULL
late_finish TIMESTAMPTZ NULL
total_float JSONB NULL
free_float JSONB NULL
critical BOOLEAN NOT NULL
near_critical BOOLEAN NOT NULL
resource_delayed BOOLEAN NOT NULL
constraint_delayed BOOLEAN NOT NULL
calendar_trace JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(schedule_run_id, task_id)
```

## 75.23 `project_milestones`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
milestone_key VARCHAR NOT NULL
milestone_type VARCHAR NOT NULL
title VARCHAR NOT NULL
required_deliverable_ids JSONB NOT NULL
required_gate_ids JSONB NOT NULL
target_date TIMESTAMPTZ NULL
forecast_date TIMESTAMPTZ NULL
committed_date TIMESTAMPTZ NULL
actual_date TIMESTAMPTZ NULL
customer_commitment BOOLEAN NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, milestone_key)
```

## 75.24 `project_gates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
gate_key VARCHAR NOT NULL
gate_type VARCHAR NOT NULL
title VARCHAR NOT NULL
entry_or_exit VARCHAR NOT NULL
phase_id UUID NULL
condition_policy JSONB NOT NULL
required_deliverable_ids JSONB NOT NULL
required_review_ids JSONB NOT NULL
required_approval_roles JSONB NOT NULL
waiver_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, gate_key)
```

## 75.25 `project_gate_runs`

```text
id UUID PK
gate_id UUID NOT NULL
project_baseline_id UUID NULL
status VARCHAR NOT NULL
condition_results JSONB NOT NULL
missing_deliverables JSONB NOT NULL
failed_reviews JSONB NOT NULL
missing_approvals JSONB NOT NULL
open_findings JSONB NOT NULL
open_risks JSONB NOT NULL
waiver_ids JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
run_by UUID NOT NULL
created_at TIMESTAMPTZ
```

## 75.26 `project_reviews`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
review_key VARCHAR NOT NULL
review_type VARCHAR NOT NULL
title VARCHAR NOT NULL
task_id UUID NULL
milestone_id UUID NULL
required_artifact_ids JSONB NOT NULL
required_reviewer_roles JSONB NOT NULL
agenda JSONB NOT NULL
checklist JSONB NOT NULL
pre_read_duration JSONB NULL
scheduled_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
decision_summary JSONB NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, review_key)
```

## 75.27 `project_review_findings`

```text
id UUID PK
review_id UUID NOT NULL
finding_key VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
severity VARCHAR NOT NULL
owner_id UUID NULL
owner_role VARCHAR NULL
affected_task_ids JSONB NOT NULL
affected_deliverable_ids JSONB NOT NULL
closure_criteria JSONB NOT NULL
target_date TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_id, finding_key)
```

## 75.28 `project_risks`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
risk_key VARCHAR NOT NULL
category VARCHAR NOT NULL
risk_statement TEXT NOT NULL
cause TEXT NULL
event TEXT NULL
impact TEXT NOT NULL
probability_class VARCHAR NOT NULL
severity VARCHAR NOT NULL
exposure JSONB NOT NULL
affected_task_ids JSONB NOT NULL
affected_milestone_ids JSONB NOT NULL
trigger_conditions JSONB NOT NULL
mitigation_plan JSONB NOT NULL
contingency_plan JSONB NOT NULL
owner_id UUID NULL
owner_role VARCHAR NULL
next_review_at TIMESTAMPTZ NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(project_id, risk_key)
```

## 75.29 `project_risk_assessments`

```text
id UUID PK
risk_id UUID NOT NULL
assessment_version INT NOT NULL
probability_class VARCHAR NOT NULL
severity VARCHAR NOT NULL
schedule_impact JSONB NULL
cost_impact JSONB NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
assessed_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(risk_id, assessment_version)
```

## 75.30 `project_issues`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
issue_key VARCHAR NOT NULL
category VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
detected_at TIMESTAMPTZ NOT NULL
severity VARCHAR NOT NULL
blocking_task_ids JSONB NOT NULL
affected_deliverable_ids JSONB NOT NULL
owner_id UUID NULL
owner_role VARCHAR NULL
resolution_plan JSONB NOT NULL
target_date TIMESTAMPTZ NULL
escalation_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, issue_key)
```

## 75.31 `project_decisions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
decision_key VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
options JSONB NOT NULL
criteria JSONB NOT NULL
evidence_ids JSONB NOT NULL
decision_value JSONB NULL
decision_owner_id UUID NULL
decision_owner_role VARCHAR NULL
decided_at TIMESTAMPTZ NULL
affected_requirement_ids JSONB NOT NULL
affected_task_ids JSONB NOT NULL
effective_revision VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 75.32 `project_open_questions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_question_id UUID NULL
question_key VARCHAR NOT NULL
question_text TEXT NOT NULL
owner_id UUID NULL
owner_role VARCHAR NULL
due_at TIMESTAMPTZ NULL
required_before_milestone_id UUID NULL
affected_task_ids JSONB NOT NULL
default_action JSONB NULL
escalation_policy JSONB NOT NULL
answer JSONB NULL
answered_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, question_key)
```

## 75.33 `project_long_lead_items`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
item_key VARCHAR NOT NULL
item_type VARCHAR NOT NULL
part_or_service_reference JSONB NOT NULL
need_by_date TIMESTAMPTZ NOT NULL
estimated_lead_time JSONB NULL
confirmed_lead_time JSONB NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
qualification_required BOOLEAN NOT NULL
alternate_strategy JSONB NOT NULL
procurement_task_ids JSONB NOT NULL
affected_milestone_ids JSONB NOT NULL
risk_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, item_key)
```

## 75.34 `project_agent_invocations`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
task_id UUID NOT NULL
agent_number INT NOT NULL
capability_key VARCHAR NOT NULL
contract_version VARCHAR NOT NULL
input_artifact_requirements JSONB NOT NULL
input_gate_policy JSONB NOT NULL
prompt_template_reference JSONB NULL
execution_policy JSONB NOT NULL
retry_policy JSONB NOT NULL
timeout_policy JSONB NOT NULL
human_review_policy JSONB NOT NULL
expected_outputs JSONB NOT NULL
success_criteria JSONB NOT NULL
failure_route JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.35 `project_agent_execution_runs`

```text
id UUID PK
agent_invocation_id UUID NOT NULL
external_job_reference JSONB NULL
input_snapshot_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
queue_started_at TIMESTAMPTZ NULL
execution_started_at TIMESTAMPTZ NULL
execution_completed_at TIMESTAMPTZ NULL
review_completed_at TIMESTAMPTZ NULL
output_artifacts JSONB NOT NULL
finding_summary JSONB NOT NULL
retry_count INT NOT NULL
failure_code VARCHAR NULL
failure_message TEXT NULL
created_at TIMESTAMPTZ
```

## 75.36 `project_status_snapshots`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_id UUID NOT NULL
data_cutoff_at TIMESTAMPTZ NOT NULL
source_freshness JSONB NOT NULL
task_state_summary JSONB NOT NULL
deliverable_state_summary JSONB NOT NULL
milestone_forecast JSONB NOT NULL
critical_path JSONB NOT NULL
resource_conflicts JSONB NOT NULL
risk_summary JSONB NOT NULL
issue_summary JSONB NOT NULL
approval_queue JSONB NOT NULL
snapshot_uri TEXT NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 75.37 `project_progress_evidence`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
task_id UUID NOT NULL
evidence_type VARCHAR NOT NULL
artifact_reference JSONB NULL
checklist_item_id UUID NULL
gate_run_id UUID NULL
review_id UUID NULL
source_system VARCHAR NOT NULL
source_revision VARCHAR NULL
evidence_hash CHAR(64) NOT NULL
progress_weight NUMERIC NOT NULL
accepted BOOLEAN NOT NULL
accepted_by UUID NULL
accepted_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 75.38 `project_variance_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
snapshot_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
variance_type VARCHAR NOT NULL
planned_value JSONB NOT NULL
actual_or_forecast_value JSONB NOT NULL
variance_value JSONB NOT NULL
root_cause_candidate JSONB NOT NULL
impact_summary JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.39 `project_recovery_candidates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
source_variance_ids JSONB NOT NULL
action_type VARCHAR NOT NULL
affected_task_ids JSONB NOT NULL
proposed_changes JSONB NOT NULL
expected_schedule_effect JSONB NOT NULL
expected_cost_effect JSONB NULL
risk_effect JSONB NOT NULL
requirement_scope_effect JSONB NOT NULL
approval_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, candidate_key)
```

## 75.40 `project_change_impact_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_change_request_id UUID NOT NULL
source_baseline_id UUID NOT NULL
requirement_diff JSONB NOT NULL
affected_work_packages JSONB NOT NULL
affected_tasks JSONB NOT NULL
affected_deliverables JSONB NOT NULL
affected_dependencies JSONB NOT NULL
affected_resources JSONB NOT NULL
affected_long_lead_items JSONB NOT NULL
affected_milestones JSONB NOT NULL
required_reverification JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_uri TEXT NOT NULL
impact_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.41 `project_replan_candidates`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_baseline_id UUID NOT NULL
change_impact_run_id UUID NULL
recovery_source_ids JSONB NOT NULL
candidate_version INT NOT NULL
wbs_changes JSONB NOT NULL
task_changes JSONB NOT NULL
dependency_changes JSONB NOT NULL
resource_changes JSONB NOT NULL
milestone_changes JSONB NOT NULL
risk_changes JSONB NOT NULL
schedule_run_id UUID NOT NULL
customer_commitment_effect JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, source_baseline_id, candidate_version)
```

## 75.42 `project_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
planning_release_type VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
wbs_version_id UUID NOT NULL
schedule_run_id UUID NOT NULL
resource_snapshot_hash CHAR(64) NOT NULL
calendar_snapshot_hash CHAR(64) NOT NULL
task_manifest JSONB NOT NULL
deliverable_manifest JSONB NOT NULL
dependency_manifest JSONB NOT NULL
milestone_manifest JSONB NOT NULL
gate_manifest JSONB NOT NULL
risk_manifest JSONB NOT NULL
assumption_manifest JSONB NOT NULL
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

## 75.43 `project_baseline_approvals`

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

## 75.44 `project_gate_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
gate_id UUID NOT NULL
gate_run_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
risk_acceptance TEXT NOT NULL
mitigations JSONB NOT NULL
effective_until TIMESTAMPTZ NULL
effective_milestone_id UUID NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 75.45 `project_release_manifests`

```text
id UUID PK
baseline_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
project_identity JSONB NOT NULL
requirement_baseline JSONB NOT NULL
wbs JSONB NOT NULL
schedule JSONB NOT NULL
resources JSONB NOT NULL
deliverables JSONB NOT NULL
milestones JSONB NOT NULL
gates JSONB NOT NULL
risks JSONB NOT NULL
agent_plan JSONB NOT NULL
approvals JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(baseline_id)
```

---

# 76. 对象存储

```text
derived/project-orchestration/
  {tenant_id}/{project_id}/
    jobs/
      {planning_job_id}/
        input/
          requirement-baseline.json
          input-snapshot.json
          project-context.json
          project-profile.json
          templates/
          agent-contracts.json
          resources.json
          calendars.json
          historical-estimates.json
          supplier-context.json
          policy.json
        decomposition/
          product-breakdown.json
          wbs-ir.json
          work-packages.jsonl.zst
          tasks.jsonl.zst
          deliverables.jsonl.zst
        dependencies/
          task-dag.json
          dependency-validation.json
          cycle-evidence/
          artifact-dependencies.jsonl.zst
        ownership/
          raci-matrix.csv
          owner-candidates.jsonl.zst
          skill-matches.jsonl.zst
          capacity-checks.jsonl.zst
        estimates/
          duration-estimates.jsonl.zst
          estimate-evidence/
          historical-analogy.jsonl.zst
          supplier-lead-times.jsonl.zst
        schedule/
          schedule.json
          task-schedule.parquet
          critical-path.json
          near-critical-paths.json
          resource-loading.parquet
          resource-conflicts.jsonl.zst
          milestone-forecast.json
        milestones/
          milestones.jsonl.zst
          gates.jsonl.zst
          gate-conditions.jsonl.zst
          review-plan.jsonl.zst
        risks/
          risks.jsonl.zst
          issues.jsonl.zst
          decisions.jsonl.zst
          open-questions.jsonl.zst
          long-lead-items.jsonl.zst
        agents/
          invocation-plan.jsonl.zst
          execution-runs.jsonl.zst
          failure-routes.jsonl.zst
        review/
          candidate-plan/
          decisions.jsonl.zst
          approvals.json
          comments.jsonl.zst
        baseline/
          project-baseline.json
          release-manifest.json
          signatures/
        execution/
          status-snapshots/
          progress-evidence/
          variance/
          forecasts/
        changes/
          requirement-impact/
          replans/
          recovery-candidates/
          baseline-diffs/
        reports/
          project-plan.html
          project-plan.pdf
          wbs.csv
          tasks.csv
          dependencies.csv
          raci.csv
          milestones.csv
          risks.csv
          critical-path.csv
          resource-loading.csv
          agent-plan.csv
          change-impact.csv
        debug/
          decomposition-trace.jsonl.zst
          dependency-trace.jsonl.zst
          schedule-trace.jsonl.zst
          estimate-trace.jsonl.zst
          orchestration-trace.jsonl.zst
          resource-usage.json
```

---

# 77. API 设计

## 77.1 Planning Jobs

```text
POST /api/v1/project-planning/jobs
POST /api/v1/project-planning/jobs/batch
GET  /api/v1/project-planning/jobs/{id}
GET  /api/v1/project-planning/jobs/{id}/events
POST /api/v1/project-planning/jobs/{id}/cancel
POST /api/v1/project-planning/jobs/{id}/retry
POST /api/v1/project-planning/jobs/{id}/rerun
```

## 77.2 Readiness and Snapshot

```text
POST /api/v1/project-planning/jobs/{id}/validate-readiness
GET  /api/v1/project-planning/jobs/{id}/readiness
POST /api/v1/project-planning/jobs/{id}/freeze-input
GET  /api/v1/project-planning/jobs/{id}/input-snapshot
```

## 77.3 Profiles and Templates

```text
POST /api/v1/project-execution-profiles
GET  /api/v1/project-execution-profiles
GET  /api/v1/project-execution-profiles/{id}
POST /api/v1/project-execution-profiles/{id}/validate
POST /api/v1/project-execution-profiles/{id}/approve
POST /api/v1/project-execution-profiles/{id}/deprecate
GET  /api/v1/project-planning/templates
```

## 77.4 WBS and Work Packages

```text
POST /api/v1/project-planning/jobs/{id}/build-pbs
POST /api/v1/project-planning/jobs/{id}/build-wbs
GET  /api/v1/projects/{project_id}/wbs
GET  /api/v1/projects/{project_id}/work-packages
GET  /api/v1/project-work-packages/{id}
POST /api/v1/project-work-packages/{id}/accept
POST /api/v1/project-work-packages/{id}/reject
POST /api/v1/project-work-packages/{id}/split
POST /api/v1/project-work-packages/{id}/merge
```

## 77.5 Tasks and Deliverables

```text
GET  /api/v1/projects/{project_id}/tasks
POST /api/v1/projects/{project_id}/tasks
GET  /api/v1/project-tasks/{id}
PATCH /api/v1/project-tasks/{id}
POST /api/v1/project-tasks/{id}/accept
POST /api/v1/project-tasks/{id}/reject
GET  /api/v1/projects/{project_id}/deliverables
POST /api/v1/projects/{project_id}/deliverables
GET  /api/v1/project-deliverables/{id}
POST /api/v1/project-deliverables/{id}/verify
POST /api/v1/project-deliverables/{id}/approve
```

## 77.6 Dependencies

```text
POST /api/v1/projects/{project_id}/dependencies
GET  /api/v1/projects/{project_id}/dependencies
POST /api/v1/projects/{project_id}/validate-dag
GET  /api/v1/projects/{project_id}/dependency-graph
GET  /api/v1/projects/{project_id}/dependency-findings
```

## 77.7 RACI and Resources

```text
POST /api/v1/projects/{project_id}/build-raci
GET  /api/v1/projects/{project_id}/raci
POST /api/v1/project-tasks/{id}/owner-candidates
POST /api/v1/project-tasks/{id}/assign-owner
GET  /api/v1/project-resources
POST /api/v1/project-resources
GET  /api/v1/project-resources/{id}
GET  /api/v1/project-resource-calendars
POST /api/v1/project-resource-calendars
```

## 77.8 Estimates

```text
POST /api/v1/project-tasks/{id}/estimates
GET  /api/v1/project-tasks/{id}/estimates
POST /api/v1/project-estimates/{id}/approve
POST /api/v1/projects/{project_id}/estimate-missing-tasks
GET  /api/v1/projects/{project_id}/estimate-coverage
```

## 77.9 Scheduling

```text
POST /api/v1/projects/{project_id}/schedule
GET  /api/v1/projects/{project_id}/schedules
GET  /api/v1/project-schedules/{id}
GET  /api/v1/project-schedules/{id}/critical-path
GET  /api/v1/project-schedules/{id}/resource-loading
GET  /api/v1/project-schedules/{id}/conflicts
POST /api/v1/project-schedules/{id}/optimize
```

## 77.10 Milestones and Gates

```text
GET  /api/v1/projects/{project_id}/milestones
POST /api/v1/projects/{project_id}/milestones
GET  /api/v1/projects/{project_id}/gates
POST /api/v1/projects/{project_id}/gates
POST /api/v1/project-gates/{id}/run
GET  /api/v1/project-gates/{id}/runs
POST /api/v1/project-gates/{id}/waive
```

## 77.11 Reviews

```text
POST /api/v1/projects/{project_id}/reviews
GET  /api/v1/projects/{project_id}/reviews
GET  /api/v1/project-reviews/{id}
POST /api/v1/project-reviews/{id}/start
POST /api/v1/project-reviews/{id}/complete
POST /api/v1/project-reviews/{id}/findings
GET  /api/v1/project-reviews/{id}/findings
```

## 77.12 Risks, Issues, Decisions and Questions

```text
GET  /api/v1/projects/{project_id}/risks
POST /api/v1/projects/{project_id}/risks
PATCH /api/v1/project-risks/{id}
GET  /api/v1/projects/{project_id}/issues
POST /api/v1/projects/{project_id}/issues
GET  /api/v1/projects/{project_id}/decisions
POST /api/v1/projects/{project_id}/decisions
POST /api/v1/project-decisions/{id}/resolve
GET  /api/v1/projects/{project_id}/questions
POST /api/v1/project-questions/{id}/answer
```

## 77.13 Long-lead and Procurement

```text
POST /api/v1/projects/{project_id}/identify-long-lead-items
GET  /api/v1/projects/{project_id}/long-lead-items
PATCH /api/v1/project-long-lead-items/{id}
POST /api/v1/project-long-lead-items/{id}/create-procurement-plan
```

## 77.14 Agent Orchestration

```text
GET  /api/v1/projects/{project_id}/agent-plan
POST /api/v1/project-tasks/{id}/agent-invocation
POST /api/v1/project-agent-invocations/{id}/validate-input-gate
POST /api/v1/project-agent-invocations/{id}/request-execution
POST /api/v1/project-agent-invocations/{id}/cancel
GET  /api/v1/project-agent-invocations/{id}/runs
POST /api/v1/project-agent-runs/{id}/accept-output
POST /api/v1/project-agent-runs/{id}/reject-output
```

## 77.15 Status and Forecast

```text
POST /api/v1/projects/{project_id}/ingest-status
POST /api/v1/projects/{project_id}/snapshot-status
GET  /api/v1/projects/{project_id}/status
GET  /api/v1/projects/{project_id}/forecast
GET  /api/v1/projects/{project_id}/variance
GET  /api/v1/projects/{project_id}/blocked-tasks
GET  /api/v1/projects/{project_id}/approval-queue
```

## 77.16 Recovery and Replan

```text
POST /api/v1/projects/{project_id}/recovery-candidates
GET  /api/v1/projects/{project_id}/recovery-candidates
POST /api/v1/projects/{project_id}/analyze-requirement-change
GET  /api/v1/project-change-impacts/{id}
POST /api/v1/projects/{project_id}/replan
GET  /api/v1/project-replans/{id}
POST /api/v1/project-replans/{id}/approve
POST /api/v1/project-replans/{id}/apply
```

## 77.17 Baselines and Reports

```text
POST /api/v1/projects/{project_id}/baseline-candidates
GET  /api/v1/projects/{project_id}/baselines
GET  /api/v1/project-baselines/{id}
POST /api/v1/project-baselines/{id}/approve
POST /api/v1/project-baselines/{id}/freeze
GET  /api/v1/project-baselines/{id}/manifest
POST /api/v1/project-baselines/compare
GET  /api/v1/projects/{project_id}/report
GET  /api/v1/projects/{project_id}/wbs.csv
GET  /api/v1/projects/{project_id}/raci.csv
GET  /api/v1/projects/{project_id}/critical-path.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 78. 输入事件

```text
requirements.baseline-frozen
requirements.change-impact-ready
architecture.baseline-ready
project.created
project.context.updated
project.profile.updated
resource.calendar.updated
resource.capacity.updated
supplier.lead-time.updated
procurement.status.updated
manufacturing.status.updated
agent.contract.updated
project.planning.requested
```

---

# 79. 输出事件

```text
project-planning.input-blocked
project-planning.wbs-candidate-ready
project-planning.dependency-cycle-detected
project-planning.owner-required
project-planning.estimate-required
project-planning.resource-conflict-detected
project-planning.schedule-ready
project-planning.milestone-at-risk
project-planning.long-lead-risk-detected
project-planning.agent-task-ready
project-planning.agent-input-gate-blocked
project-planning.review-required
project-planning.baseline-candidate-ready
project-planning.baseline-frozen
project-planning.replan-required
project-planning.replan-candidate-ready
project-planning.completed
project-planning.failed
```

---

# 80. 执行期输入事件

```text
task.status.updated
deliverable.created
deliverable.verified
review.completed
gate.completed
risk.triggered
issue.created
decision.resolved
question.answered
agent.execution.started
agent.execution.completed
agent.execution.failed
supplier.commitment.changed
customer.commitment.changed
```

---

# 81. 下游触发事件

```text
project-task.agent16-ready
project-task.agent17-ready
project-task.agent18-ready
project-task.agent19-approval-required
project-task.agent20-ready
project-task.agent21-ready
project-task.agent22-ready
project-task.agent23-ready
project-task.agent24-ready
project-task.agent25-ready
project-task.agent26-ready
project-task.agent27-ready
project-task.agent28-ready
project-task.agent29-ready
project-task.agent30-ready
project-task.procurement-ready
project-task.manufacturing-ready
project-task.quality-ready
```

---

# 82. Policy 组织

```text
policies/
├── project-orchestration-1.0.0.yaml
├── readiness-gates.yaml
├── profiles/
│   ├── project-types.yaml
│   ├── phases.yaml
│   ├── workstreams.yaml
│   └── product-categories.yaml
├── decomposition/
│   ├── wbs-rules.yaml
│   ├── task-rules.yaml
│   ├── deliverable-rules.yaml
│   ├── review-rules.yaml
│   └── agent-task-rules.yaml
├── dependencies/
│   ├── relation-types.yaml
│   ├── artifact-dependencies.yaml
│   ├── interface-freezes.yaml
│   └── cycle-validation.yaml
├── ownership/
│   ├── raci.yaml
│   ├── assignment.yaml
│   ├── skill-matching.yaml
│   └── approval-separation.yaml
├── estimates/
│   ├── methods.yaml
│   ├── source-precedence.yaml
│   ├── confidence.yaml
│   ├── three-point.yaml
│   └── historical-analogy.yaml
├── resources/
│   ├── capacity.yaml
│   ├── calendars.yaml
│   ├── focus-factor.yaml
│   └── conflict-resolution.yaml
├── scheduling/
│   ├── constraints.yaml
│   ├── critical-path.yaml
│   ├── near-critical.yaml
│   ├── buffers.yaml
│   └── optimization.yaml
├── milestones/
│   ├── standard-milestones.yaml
│   ├── gates.yaml
│   ├── reviews.yaml
│   └── customer-commitments.yaml
├── risks/
│   ├── categories.yaml
│   ├── scoring.yaml
│   ├── triggers.yaml
│   └── escalation.yaml
├── agents/
│   ├── contracts.yaml
│   ├── input-gates.yaml
│   ├── execution.yaml
│   ├── retries.yaml
│   └── high-risk-actions.yaml
├── progress/
│   ├── evidence.yaml
│   ├── physical-percent.yaml
│   ├── status-freshness.yaml
│   └── forecast.yaml
├── changes/
│   ├── impact.yaml
│   ├── replan.yaml
│   ├── recovery.yaml
│   └── rebaseline.yaml
├── baseline.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 83. Decomposition Provider 接口

```python
class ProjectDecompositionProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_input(self, request) -> ValidationResult: ...
    async def propose_work_packages(self, request) -> WorkPackageCandidateSet: ...
    async def propose_tasks(self, request) -> TaskCandidateSet: ...
    async def explain(self, candidate) -> DecompositionTrace: ...
```

Provider 类型：

```text
deterministic_template
requirement_allocation_rule
agent_contract_rule
historical_pattern
language_model_candidate
manual
```

---

# 84. Schedule Engine 接口

```python
class ProjectScheduleProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_graph(self, request) -> GraphValidationResult: ...
    async def calculate_unconstrained(self, request) -> ScheduleResult: ...
    async def calculate_resource_constrained(self, request) -> ScheduleResult: ...
    async def optimize(self, request) -> ScheduleCandidateSet: ...
    async def explain(self, result) -> ScheduleTrace: ...
```

---

# 85. Schedule Engine 建议实现

基础能力：

```text
Topological Sort
Critical Path Method
Calendar-aware Duration
Lag/Lead
Fixed Date Constraints
Resource Loading
Resource Conflict Detection
```

增强能力：

```text
Resource-constrained Project Scheduling
Constraint Programming / CP-SAT
Pareto Candidate Generation
Monte Carlo Schedule Risk，需真实分布
```

生产实现应先完成确定性 CPM，再增加资源约束优化。

---

# 86. Agent Contract Registry

每个 Agent Contract 包含：

```text
agent number
capability version
supported input schemas
required gates
expected output schemas
typical failure codes
high-risk actions
human review requirement
retry class
resource class
average runtime statistics
```

---

# 87. Agent Task Gate

Agent 任务进入 `ready` 必须满足：

```text
required requirement baseline
required predecessor tasks
required input artifacts
required artifact verification
required approvals
required open questions closed
required resource available
required execution policy
```

---

# 88. Agent Failure Routing

```text
retryable infrastructure failure
→ Retry Task

missing input
→ Blocked and Upstream Task

quality finding
→ Review/Fix Task

unsupported capability
→ Manual or External Supplier Task

high-risk write required
→ Approval Task + Agent 19

permanent failure
→ Issue + Escalation
```

---

# 89. Progress Adapter

来源：

```text
ezPLM task status
Git commit/PR
Agent execution result
EDA artifact release
test result
procurement status
supplier portal
manufacturing/MES
calendar/review decision
manual status
```

各来源保存 freshness 和 trust level。

---

# 90. 状态可信度

```text
verified_artifact
system_event
approved_review
responsible_report
inferred_candidate
stale
unknown
```

---

# 91. Project Planning Workbench

界面建议：

```text
左：Phases / Workstreams / WBS / Filters
中：Timeline / Dependency Graph / Kanban / Deliverables
右：Task / RACI / Estimate / Resources / Acceptance / Risk
下：Milestones / Gates / Critical Path / Agents / Changes / History
```

---

# 92. Workbench 操作

```text
接受/拒绝 WBS 候选
拆分/合并 Work Package
修改依赖
查看 Requirement Trace
查看 Artifact Gate
选择 Owner Candidate
批准 Estimate
切换 Calendar
查看 Critical Path
比较 Schedule Candidate
创建 Risk/Issue/Decision
触发 Agent Task
审批高风险动作
建立 Baseline
比较 Replan
```

---

# 93. 可观测性

```text
project_planning_jobs_total{status,profile}
project_planning_duration_seconds{step}
project_wbs_nodes_total{type,status}
project_tasks_total{type,status,execution_mode}
project_deliverables_total{type,status}
project_dependency_cycles_total
project_requirement_task_coverage_ratio{priority}
project_estimate_coverage_ratio
project_resource_conflicts_total{type}
project_critical_path_tasks_total
project_milestones_total{status}
project_gates_total{status,type}
project_risks_total{category,severity,status}
project_issues_total{category,severity,status}
project_agent_runs_total{agent,status}
project_schedule_variance_total{type}
project_replans_total{status}
project_status_source_staleness_seconds{source}
```

---

# 94. Dashboard

```text
Portfolio
Projects
Requirement Coverage
WBS Completeness
Tasks
Deliverables
Dependencies
RACI
Estimate Coverage
Resource Capacity
Schedule
Critical Path
Milestones
Gates
Risks
Issues
Decisions
Long-lead Items
Agent Runs
Approvals
Forecast
Changes
Replans
```

---

# 95. 安全与权限

- 项目、需求、人员、成本、供应商和计划按租户/项目隔离；
- 人员能力、工时、绩效和容量属于敏感数据；
- Owner 推荐只返回必要理由，不暴露无关人员信息；
- 项目经理、技术负责人、采购、质量、制造和客户审批权限分开；
- Agent 执行权限与计划编辑权限分开；
- EDA 写入、采购下单、生产下单和发布需要独立审批；
- 不允许 AI 自行批准 Baseline、工期承诺或 Gate Waiver；
- 外部模型只接收最小化和脱敏后的任务描述；
- 不将人员绩效、供应商报价、客户承诺和项目成本发给未批准模型；
- 历史项目用于估算前必须脱敏并检查可比性；
- 不用客户项目计划做公开 Fixture；
- Calendar、Estimate、Owner、Risk、Baseline、Approval 和 Change 不可硬删除；
- 执行请求必须有 Idempotency 和 Audit；
- Webhook 输入要签名验证、去重并防重放；
- 不允许用户通过任务描述注入任意 Agent Prompt 或 Shell 命令；
- 所有 Agent Prompt 使用受控模板和类型化参数。

---

# 96. 推荐技术栈

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

图与调度：

```text
NetworkX or custom DAG core
OR-Tools CP-SAT optional
Decimal
dateutil
business-calendar abstraction
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
Timeline/Gantt
Dependency Graph
Kanban
Resource Heatmap
Critical Path Overlay
Requirement Trace Matrix
```

集成：

```text
ezPLM
GitHub/GitLab
Google Calendar optional
Gmail/Slack/Teams optional
ERP/MES/Supplier adapters
Agent event bus
```

---

# 97. 推荐仓库结构

```text
project-orchestration-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── project-orchestration-agent-spec.md
│   ├── planning-input-and-gates.md
│   ├── project-execution-profiles.md
│   ├── wbs-and-work-packages.md
│   ├── task-and-deliverable-ir.md
│   ├── dependency-dag.md
│   ├── raci-and-ownership.md
│   ├── estimates-and-calendars.md
│   ├── scheduling-and-critical-path.md
│   ├── milestones-and-gates.md
│   ├── risk-issue-decision.md
│   ├── agent-orchestration.md
│   ├── progress-and-forecast.md
│   ├── changes-and-replanning.md
│   ├── baselines-and-approvals.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-requirement-baseline-drives-plan.md
│       ├── 0002-deliverables-drive-progress.md
│       ├── 0003-ai-proposes-but-does-not-commit.md
│       ├── 0004-dependencies-are-a-dag.md
│       ├── 0005-estimates-have-provenance.md
│       ├── 0006-high-risk-agent-actions-require-approval.md
│       └── 0007-project-baselines-are-immutable.md
├── src/
│   └── project_orchestration/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent10.py
│       │   ├── agent_registry.py
│       │   ├── ezplm.py
│       │   ├── github.py
│       │   ├── calendar.py
│       │   ├── procurement.py
│       │   ├── erp.py
│       │   └── mes.py
│       ├── intake/
│       │   ├── readiness.py
│       │   ├── snapshots.py
│       │   └── contexts.py
│       ├── profiles/
│       │   ├── registry.py
│       │   ├── phases.py
│       │   ├── workstreams.py
│       │   ├── milestones.py
│       │   └── validation.py
│       ├── decomposition/
│       │   ├── providers.py
│       │   ├── pbs.py
│       │   ├── wbs.py
│       │   ├── work_packages.py
│       │   ├── tasks.py
│       │   ├── deliverables.py
│       │   ├── templates.py
│       │   └── trace.py
│       ├── dependencies/
│       │   ├── graph.py
│       │   ├── types.py
│       │   ├── artifacts.py
│       │   ├── freezes.py
│       │   ├── validation.py
│       │   └── cycles.py
│       ├── ownership/
│       │   ├── raci.py
│       │   ├── candidates.py
│       │   ├── skills.py
│       │   ├── permissions.py
│       │   └── assignment.py
│       ├── estimates/
│       │   ├── model.py
│       │   ├── historical.py
│       │   ├── parametric.py
│       │   ├── three_point.py
│       │   ├── supplier.py
│       │   └── approvals.py
│       ├── resources/
│       │   ├── registry.py
│       │   ├── calendars.py
│       │   ├── capacity.py
│       │   ├── assignments.py
│       │   └── conflicts.py
│       ├── scheduling/
│       │   ├── providers.py
│       │   ├── cpm.py
│       │   ├── calendars.py
│       │   ├── constraints.py
│       │   ├── resources.py
│       │   ├── critical_path.py
│       │   ├── buffers.py
│       │   └── candidates.py
│       ├── milestones/
│       │   ├── model.py
│       │   ├── gates.py
│       │   ├── conditions.py
│       │   ├── reviews.py
│       │   └── forecasts.py
│       ├── risks/
│       │   ├── registry.py
│       │   ├── assessment.py
│       │   ├── triggers.py
│       │   ├── issues.py
│       │   ├── decisions.py
│       │   └── questions.py
│       ├── procurement/
│       │   ├── long_lead.py
│       │   ├── make_buy.py
│       │   └── milestones.py
│       ├── agents/
│       │   ├── contracts.py
│       │   ├── invocations.py
│       │   ├── gates.py
│       │   ├── execution.py
│       │   ├── retries.py
│       │   └── failure_routes.py
│       ├── progress/
│       │   ├── adapters.py
│       │   ├── evidence.py
│       │   ├── physical_percent.py
│       │   ├── snapshots.py
│       │   ├── variance.py
│       │   └── forecast.py
│       ├── changes/
│       │   ├── impact.py
│       │   ├── recovery.py
│       │   ├── replan.py
│       │   ├── rebaseline.py
│       │   └── diffs.py
│       ├── baselines/
│       │   ├── candidates.py
│       │   ├── approvals.py
│       │   ├── manifests.py
│       │   └── immutability.py
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── project-profiles/
├── wbs-templates/
├── milestone-templates/
├── agent-contracts/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_planning_readiness.py
    ├── build_project_wbs.py
    ├── validate_dependency_dag.py
    ├── generate_raci_candidates.py
    ├── estimate_project_tasks.py
    ├── schedule_project.py
    ├── calculate_critical_path.py
    ├── build_risk_register.py
    ├── freeze_project_baseline.py
    ├── ingest_project_status.py
    ├── analyze_project_change.py
    └── run_project_orchestration_benchmark.py
```


---

# 98. Codex 分阶段实施

不要让 Codex 一次实现 WBS、DAG、RACI、资源容量、关键路径、Agent 编排、风险、执行监控、变更重排和完整甘特图。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. 当前 Project、Program、Phase、Task、Milestone、Risk、Issue、Decision 和 Approval 模型；
2. 当前 Agent 10 Requirement Baseline、Requirement Graph、Acceptance Criteria 和 Change Impact；
3. 当前产品架构、Subsystem、Interface 和 Allocation 数据；
4. 当前 WBS、Task Template、Project Template 和 NPI 流程；
5. 当前 Task、Subtask、Checklist、Deliverable 和 Review；
6. 当前 Dependency、Lag/Lead、Artifact Dependency 和 Cycle Check；
7. 当前 Owner、Role、Team、RACI、Skill 和 Permission；
8. 当前 Resource Calendar、Holiday、Leave、Capacity 和 Booking；
9. 当前 Duration Estimate、Historical Actual、Supplier Lead Time 和 Approval；
10. 当前 Scheduling、Critical Path、Gantt、Resource Loading 和 Forecast；
11. 当前 Milestone、Gate、Checklist 和 Waiver；
12. 当前 Risk、Issue、Decision、Open Question 和 Escalation；
13. 当前 Procurement、Long-lead、MOQ、Sample、Tooling 和 Lab Slot；
14. 当前 Agent 16–45 Contract、Job、Event、Input Gate 和 Failure Route；
15. 当前 Agent 19 高风险写入审批；
16. 当前进度来源：PLM、Git、EDA、测试、采购、制造和人工更新；
17. 当前 Baseline、Version、Diff、Change Request 和 Replan；
18. 当前 Google Calendar/Gmail/Slack/GitHub 等集成；
19. 当前 Review UI、Gantt、Kanban、Dependency Graph 和 Resource View；
20. 当前 Queue、Worker、Database、Object Storage 和 Security；
21. 当前开源、合成、脱敏或授权 Fixture；
22. 统计现有项目的任务缺失、循环依赖和无负责人任务；
23. 统计 Estimate Coverage、计划与实际偏差和等待时间；
24. 统计 Requirement-to-Task、Task-to-Deliverable 和 Deliverable-to-Gate 覆盖；
25. 统计 Agent 执行失败、人工接管和审批等待；
26. 只运行只读扫描、安全查询和公开 Fixture；
27. 不修改项目任务；
28. 不分配真实人员；
29. 不冻结项目 Baseline；
30. 不触发 Agent 写入、采购、生产或发布；
31. 不创建 Migration；
32. 不安装调度或优化组件；
33. 不调用生产外部模型；
34. 不读取或打印 Secret、人员绩效、客户承诺和供应商报价。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Planning Job；
- Input Snapshot；
- Execution Profile；
- Phase；
- Workstream；
- WBS Version/Node；
- Work Package；
- Task/Checklist；
- Deliverable；
- Dependency；
- Validation Run；
- Requirement Link；
- RACI；
- Resource/Calendar/Assignment；
- Estimate/Historical Record；
- Schedule Run/Task Result；
- Milestone/Gate/Gate Run；
- Review/Finding；
- Risk/Assessment；
- Issue；
- Decision；
- Question；
- Long-lead；
- Agent Invocation/Run；
- Status Snapshot；
- Progress Evidence；
- Variance；
- Recovery Candidate；
- Change Impact；
- Replan；
- Baseline/Approval/Waiver；
- Release Manifest；
- JSON Schema。

## Phase 2：Planning Input Gate

实现：

- Agent 10 Baseline；
- Baseline Hash；
- Project Context；
- Project Type；
- Variant；
- Architecture Snapshot optional；
- Resource/Calendar Snapshot；
- Agent Contract Snapshot；
- Profile/Template/Policy；
- Readiness Diagnostics；
- Draft-only versus Execution-ready。

## Phase 3：Project Execution Profile Registry

实现：

- Product Category；
- Project Type；
- Phase Model；
- Workstreams；
- Required Milestones；
- Gates；
- Approval；
- Risk；
- Schedule；
- Agent Policy；
- Version/Effective Date；
- Approval/Deprecation；
- Contract Tests。

## Phase 4：Template Registry

实现：

- WBS Templates；
- Task Templates；
- Deliverable Templates；
- Review Templates；
- Milestone Templates；
- NPI Templates；
- Applicability Conditions；
- Template Composition；
- Overrides；
- Version；
- No Auto-baseline。

## Phase 5：Product Breakdown Structure

实现：

- Product；
- Subsystems；
- Boards；
- Modules；
- Mechanical Assemblies；
- Firmware Components；
- Fixtures；
- Manufacturing Packages；
- Requirement Allocation；
- Stable IDs；
- Source Trace。

## Phase 6：Requirement-to-Workstream Allocation

实现：

- Domain Mapping；
- Scope Mapping；
- Verification Mapping；
- Compliance/Manufacturing Mapping；
- Shared Requirements；
- Unallocated Requirements；
- Critical Coverage Gate；
- Explain Trace。

## Phase 7：WBS Candidate Generator

实现：

- Phase；
- Workstream；
- WBS Element；
- Work Package；
- Requirement Links；
- Template/Rule/AI Candidate Source；
- Stable Keys；
- Dedup；
- Candidate Review；
- No Approved State。

## Phase 8：Work Package Engine

实现：

- Scope；
- Inputs/Outputs；
- Owner/Accountable/Approver Roles；
- Execution Mode；
- Risk Class；
- Acceptance；
- Evidence；
- Split/Merge；
- Completeness；
- Traceability。

## Phase 9：Task Candidate Generator

实现：

- Requirement-derived；
- Deliverable-derived；
- Agent Contract-derived；
- Risk-derived；
- Review/Approval；
- Procurement/Waiting；
- Stable Keys；
- Task Types；
- Preconditions；
- Candidate Status。

## Phase 10：Deliverable Registry

实现：

- Artifact Schema；
- Format；
- Source System；
- Producer/Consumer；
- Owner/Reviewer/Approver；
- Acceptance；
- Verification；
- Revision；
- Hash；
- Release Status。

## Phase 11：Requirement-Task-Deliverable Traceability

实现：

- Implements；
- Verifies；
- Reviews；
- Approves；
- Produces；
- Consumes；
- Critical Requirement Coverage；
- Missing Implementation；
- Missing Verification；
- Broken Links；
- Matrix。

## Phase 12：Dependency Model

实现：

- FS/SS/FF/SF；
- Lag/Lead；
- Artifact Dependency；
- Approval Dependency；
- Resource/Supplier；
- Conditional；
- Source；
- Approval；
- Serialization。

## Phase 13：Dependency DAG Validation

实现：

- Topological Sort；
- Cycle Detection；
- Cycle Path Evidence；
- Orphan Task；
- Missing Predecessor；
- Missing Artifact；
- Superseded Task；
- Invalid Lag/Lead；
- Gate；
- Tests。

## Phase 14：Interface Freeze Dependencies

实现：

- Architecture；
- Power Tree；
- Connector Type/Position；
- Pin Assignment；
- Protocol；
- Board Outline；
- Mechanical Envelope；
- Firmware API；
- Manufacturing Profile；
- Freeze Deliverables；
- Change Propagation。

## Phase 15：RACI Model

实现：

- R/A/C/I/Reviewer/Approver；
- Role Pools；
- Person Optional；
- Accountable Uniqueness；
- Missing Responsible；
- Conflict of Interest；
- Approval Separation；
- Matrix Export。

## Phase 16：Resource Registry

实现：

- Person/Role/Agent/Machine/Lab/Supplier/Budget；
- Skills；
- Permissions；
- Capacity；
- Cost optional；
- Status；
- Effective Dates；
- Privacy Boundaries。

## Phase 17：Owner Candidate Matching

实现：

- Role；
- Skills；
- Permission；
- Availability；
- Capacity；
- Timezone；
- Experience；
- Sensitivity；
- Match Trace；
- Recommendation；
- Human Confirmation；
- No Auto High-risk Assignment。

## Phase 18：Calendar Engine

实现：

- Working Pattern；
- Timezone；
- Holiday；
- Leave；
- Maintenance；
- Supplier Calendar；
- Factory Calendar；
- Lab Slot；
- Exceptions；
- Duration Addition/Subtraction；
- Round-trip Tests。

## Phase 19：Capacity and Resource Loading

实现：

- Nominal/Available；
- Existing Commitments；
- Focus Factor；
- Parallel Task Limit；
- Shared Resource；
- Equipment Booking；
- Over-allocation；
- Heatmap；
- Conflict Findings。

## Phase 20：Estimate Model

实现：

- Single/Three-point；
- Active/Waiting/Approval/Buffer；
- Methods；
- Source；
- Assumptions；
- Confidence；
- Approval；
- Missing Estimate Gate；
- No AI Direct Approval。

## Phase 21：Historical Analogy

实现：

- Comparable Task Retrieval；
- Product/Complexity/Skill Vector；
- Actual Duration；
- Waiting/Rework；
- Data Quality；
- Anonymization；
- Candidate Estimate；
- Similarity Trace；
- Human Approval。

## Phase 22：Parametric and Agent Estimate

实现：

- Complexity Drivers；
- Page/Component/Net/Layer Counts；
- Test Case Counts；
- Agent Runtime Statistics；
- Queue/Review/Retry；
- Formula Version；
- Bounds；
- Candidate-only；
- Calibration Tests。

## Phase 23：Supplier and Fixed-event Estimates

实现：

- Quote/Commitment；
- Sample Lead Time；
- Manufacturing Cycle；
- Shipping；
- Certification Lab Slot；
- Customer Review；
- Effective Date；
- Confidence；
- Change Event。

## Phase 24：Unconstrained Schedule Engine

实现：

- Topological Order；
- Calendar-aware Durations；
- FS/SS/FF/SF；
- Lag/Lead；
- Fixed Constraints；
- Early/Late Dates；
- Float；
- Critical Path；
- Deterministic Trace。

## Phase 25：Resource-constrained Scheduling

实现：

- Resource Availability；
- Capacity；
- Skill；
- Equipment；
- Priority；
- Fixed Date；
- Heuristic Baseline；
- CP-SAT Adapter optional；
- Time Budget；
- Candidate Comparison；
- No Silent Task Delay。

## Phase 26：Critical and Near-critical Paths

实现：

- Critical Path；
- Multiple Critical Paths；
- Float Threshold；
- Near-critical；
- External Dependencies；
- Resource Concentration；
- Explain Trace；
- Visualization。

## Phase 27：Schedule Buffers

实现：

- Project；
- Feeding；
- Supplier；
- Approval；
- Certification；
- Manufacturing；
- Policy；
- Source；
- No Arbitrary Percentage；
- Schedule Integration。

## Phase 28：Milestone Generator

实现：

- Template/Requirement/Contract-derived；
- Required Deliverables；
- Required Gates；
- Target/Forecast/Committed/Actual；
- Customer Commitment Flag；
- Confidence；
- Missing Condition Finding。

## Phase 29：Gate Engine

实现：

- Artifact Exists/Verified；
- Review；
- Approval；
- Finding Threshold；
- Coverage；
- Test；
- Supplier；
- Inventory；
- Budget；
- Risk；
- Question；
- Waiver；
- Gate Run Evidence。

## Phase 30：Review Planner

实现：

- Review Types；
- Required Artifacts；
- Reviewers；
- Agenda；
- Checklist；
- Pre-read；
- Findings；
- Decision Outputs；
- Closure；
- Calendar Hook。

## Phase 31：Risk Candidate Generator

实现：

- Requirement Ambiguity；
- Technical Novelty；
- Single Source；
- Long Lead；
- Resource Conflict；
- Compliance；
- Schedule Compression；
- Agent Failure；
- Historical Pattern；
- Candidate-only；
- Evidence。

## Phase 32：Risk, Issue, Decision and Question Registers

实现：

- Risk Lifecycle；
- Trigger；
- Mitigation/Contingency；
- Issue Conversion；
- Decision Workflow；
- Agent 10 Question Link；
- Owner/Due/Escalation；
- Audit。

## Phase 33：Long-lead Planner

实现：

- Component/Tooling/Lab/Supplier Capacity；
- Need-by Date；
- Estimate/Confirmation；
- Qualification；
- Alternate Strategy；
- Procurement Tasks；
- Milestone Impact；
- Risk Link。

## Phase 34：Agent Contract Registry

实现：

- Agent 16–45；
- Capability Version；
- Input/Output Schema；
- Gates；
- Failure Codes；
- High-risk Actions；
- Review；
- Retry；
- Runtime Statistics；
- Admission Tests。

## Phase 35：Agent Invocation Planner

实现：

- Agent Task；
- Input Artifact Requirements；
- Prompt Template；
- Execution Policy；
- Retry/Timeout；
- Human Review；
- Expected Output；
- Success Criteria；
- Failure Route；
- Idempotency。

## Phase 36：Agent Execution Orchestrator

实现：

- Input Gate；
- Request；
- Status；
- Output Intake；
- Artifact Binding；
- Findings；
- Retry；
- Cancel；
- Manual Fallback；
- Approval for High-risk；
- Events。

## Phase 37：Progress Evidence

实现：

- Artifact；
- Gate；
- Review；
- Checklist；
- Agent Event；
- Test；
- Procurement；
- Manufacturing；
- Trust/Freshness；
- Acceptance；
- Weighted Progress。

## Phase 38：Status Snapshot and Forecast

实现：

- Data Cutoff；
- Freshness；
- Task/Deliverable State；
- Critical Path；
- Resource Conflicts；
- Risk/Issue；
- Approval Queue；
- Forecast；
- Confidence；
- Immutable Snapshot。

## Phase 39：Variance and Root-cause Candidates

实现：

- Start/Finish/Duration；
- Waiting；
- Resource；
- Supplier；
- Scope；
- Approval；
- Root-cause Candidate；
- Impact；
- No Automatic Blame Assignment。

## Phase 40：Recovery Candidate Generator

实现：

- Resequence；
- Parallelize；
- Split；
- Resource；
- Supplier Expedite；
- Alternate Prototype；
- Optional Scope Deferral；
- Stub/Simulation；
- Cost/Risk/Requirement Effects；
- Human Approval。

## Phase 41：Requirement Change Impact

实现：

- Agent 10 Change Request；
- Graph Traversal；
- Work Packages；
- Tasks；
- Deliverables；
- Dependencies；
- Resources；
- Long-lead；
- Milestones；
- Re-verification；
- Risk；
- Impact Package。

## Phase 42：Replan and Rebaseline

实现：

- Candidate Changes；
- New Schedule；
- Resource Conflicts；
- Customer Commitment Effect；
- Review；
- Approval；
- Apply；
- New Immutable Baseline；
- Preserve Old Baseline；
- Diff。

## Phase 43：Planning Workbench

实现：

- WBS；
- Gantt；
- Dependency Graph；
- Kanban；
- Deliverables；
- RACI；
- Resource Heatmap；
- Critical Path；
- Risks；
- Agents；
- Baseline/Change；
- Review Actions。

## Phase 44：API、Jobs、Events 和 Storage

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
- Connector Health。

## Phase 45：Baseline、Manifest 和 Approval

实现：

- Candidate；
- Requirement Baseline Link；
- WBS/Schedule/Resources；
- Milestones/Gates；
- Risks/Assumptions；
- Approval Roles；
- Manifest；
- Hash；
- Immutability；
- Release Events。

## Phase 46：Benchmark、监控和生产发布

实现：

- WBS Coverage；
- Dependency Accuracy；
- Cycle Detection；
- Scheduling；
- Critical Path；
- Resource Conflicts；
- Estimate Calibration；
- Agent Orchestration；
- Change Impact；
- Security；
- Performance；
- Feature Flags；
- Rollback；
- Disaster Recovery。

## Phase 47：高级能力，可选

稳定后：

- Portfolio Resource Optimization；
- Multi-project Critical Chain；
- Probabilistic Schedule Simulation；
- Contract Milestone Tracking；
- Automated Meeting Status Intake；
- Customer Portal；
- Supplier Collaborative Plan；
- Financial/Earned Value；
- Project Similarity and Template Learning；
- 仍不让 AI 自动承诺日期或调整硬需求。

---

# 99. Codex 工作纪律

Codex 必须：

1. Agent 10 Baseline 是范围源；
2. Input Snapshot 不可变；
3. Project Profile 版本化；
4. Template 版本化；
5. AI 产出 Candidate；
6. WBS 与 PBS 分开；
7. Requirement-to-Task Trace；
8. Critical Requirement 有实现和验证任务；
9. Task 有 Deliverable；
10. Deliverable 有 Acceptance；
11. Task Source 显式；
12. Execution Mode 显式；
13. Human 与 Agent 时间分开；
14. Active/Waiting/Approval 分开；
15. Dependency 类型显式；
16. Lag/Lead 有单位；
17. Artifact Dependency 是一级对象；
18. DAG 必须无环；
19. Conditional Dependency 未解决不得忽略；
20. Interface Freeze 显式；
21. RACI 有 Responsible；
22. Accountable 按 Policy 唯一；
23. Approver 与执行人权限分离；
24. Owner 推荐需确认；
25. 不自动分配高风险任务；
26. Resource Calendar 显式；
27. Timezone 显式；
28. Capacity 不是 100% 工时；
29. Focus Factor 有来源；
30. Estimate 有方法；
31. Estimate 有来源；
32. AI Estimate 不直接批准；
33. Historical Estimate 脱敏；
34. Supplier Lead Time 有日期；
35. Agent Runtime 不等于任务工期；
36. Calendar-aware Schedule；
37. Fixed Constraint 不静默覆盖；
38. Critical Path 可回放；
39. Near-critical 单独报告；
40. Buffer 有 Policy；
41. Milestone 有完成条件；
42. Gate 与 Milestone 分开；
43. Customer Commitment 独立字段；
44. Agent Invocation 有输入 Gate；
45. 高风险 Agent Action 有审批；
46. Agent Failure 有路由；
47. Progress 优先使用 Artifact；
48. Reported Percent 不覆盖 Evidence；
49. 状态来源有 Freshness；
50. Forecast 与 Committed Date 分开；
51. Risk 与 Issue 分开；
52. Risk 有 Trigger/Owner；
53. Open Question 有 Due/Milestone；
54. Long-lead 有 Need-by；
55. Change 必须做 Impact；
56. Replan 不覆盖 Baseline；
57. Recovery 不删除硬 Gate；
58. Scope Deferral 需 Requirement Change；
59. 不自动承诺客户日期；
60. 不自动关闭风险、Issue 和 Finding；
61. 不自动下采购/生产订单；
62. 不自动冻结 Requirement 或 Project Baseline；
63. 不发送人员、成本、报价给未批准模型；
64. 不用客户计划做公开 Fixture；
65. 不伪造 Estimate、Status、Approval 或 Benchmark；
66. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Profile/Template/Contract 变化；
    - 测试命令和真实结果；
    - WBS/Task/Deliverable；
    - Dependency/DAG；
    - RACI/Resource；
    - Estimate/Schedule；
    - Milestone/Gate；
    - Risk/Issue；
    - Agent Orchestration；
    - Progress/Forecast；
    - Change/Replan；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 100. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input and WBS

1. Approved Requirement Baseline；
2. Unapproved Baseline；
3. Baseline Hash Mismatch；
4. Product Profile；
5. Missing Profile；
6. Hardware Project Template；
7. Portable Instrument Template；
8. IoT Template；
9. Critical Requirement Allocation；
10. Shared Requirement；
11. Unallocated Requirement；
12. WBS Candidate；
13. Split Work Package；
14. Merge Work Package；
15. Duplicate Task；
16. Task without Deliverable；
17. Deliverable without Acceptance；
18. AI Candidate Not Approved；
19. Variant Scope；
20. Superseded Requirement。

## Dependencies and Traceability

21. Finish-to-start；
22. Start-to-start；
23. Finish-to-finish；
24. Start-to-finish；
25. Lag；
26. Lead；
27. Artifact Dependency；
28. Approval Dependency；
29. Supplier Dependency；
30. Conditional Dependency；
31. Simple Cycle；
32. Multi-node Cycle；
33. Orphan Task；
34. Missing Artifact；
35. Interface Freeze；
36. Requirement Implementation Coverage；
37. Requirement Verification Coverage；
38. Broken Trace；
39. Superseded Task Dependency；
40. Dependency Graph Hash。

## RACI and Resources

41. Complete RACI；
42. Missing Responsible；
43. Multiple Accountable；
44. Reviewer/Approver Conflict；
45. Owner Candidate；
46. Skill Mismatch；
47. Permission Mismatch；
48. Timezone；
49. Holiday；
50. Leave；
51. Shared Lab Equipment；
52. Agent Resource；
53. Supplier Resource；
54. Capacity Overload；
55. Focus Factor；
56. Parallel Task Limit；
57. Manual High-risk Assignment；
58. Low-risk Auto-assignment Policy；
59. Resource Change；
60. Calendar Version Change。

## Estimates and Scheduling

61. Single Estimate；
62. Three-point Estimate；
63. Historical Analogy；
64. Poor Historical Match；
65. Parametric Estimate；
66. Supplier Commitment；
67. Agent Runtime Estimate；
68. Missing Estimate；
69. Unapproved Estimate；
70. Active versus Waiting；
71. Calendar-aware Duration；
72. Fixed Start；
73. Finish Deadline；
74. Critical Path；
75. Multiple Critical Paths；
76. Near-critical Path；
77. Resource-constrained Delay；
78. Impossible Fixed Dates；
79. Project Buffer；
80. Supplier Buffer；
81. Deterministic Schedule；
82. Schedule Diff；
83. Schedule Optimization Candidate；
84. Customer Commitment Conflict；
85. Timezone Boundary。

## Milestones, Gates and Risks

86. Requirement Baseline Milestone；
87. Schematic Freeze；
88. PCB Release；
89. EVT；
90. DVT；
91. Gate Artifact Missing；
92. Gate Review Failed；
93. Gate Approval Missing；
94. Gate Waiver；
95. Waiver Expiry；
96. Review Plan；
97. Review Finding；
98. Technical Risk；
99. Supply Risk；
100. Schedule Risk；
101. Risk Trigger；
102. Risk to Issue；
103. Decision；
104. Open Question Deadline；
105. Long-lead Item；
106. Lab Slot；
107. Tooling；
108. Alternate Strategy；
109. Critical Risk without Owner；
110. Risk Closure Approval。

## Agent Orchestration

111. Agent 16 Input Gate；
112. Agent 20 Task；
113. Agent 23 Simulation；
114. Agent 24 Constraints；
115. Agent 25 Placement；
116. Agent 26 Routing；
117. Agent 27 Review；
118. Agent 28 Mechanical；
119. Agent 29 Release；
120. Agent 30 DFM；
121. Agent 19 Approval；
122. Retryable Agent Failure；
123. Permanent Agent Failure；
124. Missing Input；
125. Human Review Required；
126. Output Artifact Binding；
127. Finding Creates Fix Task；
128. Duplicate Execution Request；
129. Cancellation；
130. Manual Fallback。

## Progress, Change and Security

131. Artifact-based Progress；
132. Checklist Progress；
133. Stale Manual Status；
134. Gate-based Milestone；
135. Forecast Update；
136. Waiting Variance；
137. Supplier Variance；
138. Scope Variance；
139. Recovery Resequence；
140. Recovery Parallelization；
141. Optional Scope Deferral Requires Change；
142. Requirement Change Impact；
143. Replan Candidate；
144. Rebaseline；
145. Preserve Old Baseline；
146. Unauthorized Owner Assignment；
147. Unauthorized Baseline Approval；
148. Prompt Injection in Task；
149. Webhook Replay；
150. Tenant Isolation；
151. Sensitive Personnel Data；
152. External Model Data Policy；
153. Audit Replay；
154. 10,000 Tasks；
155. 100,000 Dependencies；
156. Multi-project Resource Optional Benchmark。

---

# 101. 初始质量目标

```text
Critical Requirement Implementation Task Coverage = 100%
Critical Requirement Verification Task Coverage = 100%
Approved Task Source Trace Coverage = 100%
Approved Deliverable Acceptance Criteria Coverage = 100%
Approved Plan Dependency Cycle Count = 0
Approved Task Owner Role Coverage = 100%
High-risk Task Auto-assignment = 0
Unapproved Estimate Baseline Entry = 0
AI Candidate Estimate Direct Commitment = 0
Agent High-risk Action without Approval = 0
Artifact-based Progress Coverage for Critical Tasks = 100%
Customer Committed Date Changed by Agent = 0
Requirement Change without Project Impact Analysis = 0
Project Baseline Overwrite = 0
Private Personnel/Cost Data Sent to Unapproved Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 102. 性能要求

常规项目：

```text
100–5,000 Requirements
100–10,000 Tasks
100–50,000 Dependencies
10–500 Resources
10–100 Milestones/Gates
```

目标：

```text
Readiness P95 < 15 s
WBS Candidate Generation P95 < 60 s excluding model calls
DAG Validation P95 < 5 s for 10k tasks / 50k edges
Unconstrained CPM P95 < 10 s
Resource Loading P95 < 30 s
Status Snapshot P95 < 15 s
Requirement Change Impact P95 < 30 s for 100k trace edges
Interactive Task/Dependency Query P95 < 300 ms
```

资源约束优化：

```text
可配置 Time Budget
可取消
返回当前最佳候选
保存 Solver/Seed/Gap
不阻塞基础 CPM
```

大型项目要求：

- 分区 WBS；
- 增量图更新；
- Parquet；
- 图索引；
- Schedule Cache；
- Event Dedup；
- Worker Pool；
- Backpressure；
- Partial Diagnostics；
- 不把完整人员和项目数据发送给 AI。

---

# 103. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/project-orchestration-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第11个 Agent：

Engineering Project Decomposition, Milestone Planning & Execution Orchestration Agent /
项目拆解与里程碑 Agent。

本 Agent 接收：

- Agent 10 Requirement Baseline、Requirement Graph、Acceptance Criteria 和 Change Impact；
- 产品架构、Subsystem、Interface 和 Allocation；
- 企业 Project/WBS/NPI Templates；
- Team、Role、Skill、Permission、Calendar 和 Capacity；
- 历史项目实际工期和返工；
- 供应商交期、长交期器件、认证实验室和制造周期；
- Agent 16–45 Contract、Input Gate、Output Artifact 和 Failure Route；
- PLM/PM/Git/ERP/MES/Procurement/Calendar 状态；

输出：

- PBS/WBS；
- Work Package；
- Task/Subtask/Checklist；
- Deliverable；
- Dependency DAG；
- Requirement-to-Task/Deliverable Trace；
- RACI/Owner Candidate；
- Estimate/Calendar/Resource Plan；
- Schedule/Critical Path；
- Milestone/Gate/Review Plan；
- Risk/Issue/Decision/Question；
- Long-lead Plan；
- Agent Invocation Plan；
- Status/Forecast/Variance；
- Recovery/Replan；
- Immutable Project Baseline 和 Manifest。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10、11 和 Agent 16–45 的规格；
3. docs/project-orchestration-agent-spec.md；
4. 当前 Project/Program/Phase/Task/Milestone；
5. 当前 Requirement Baseline/Graph/Change；
6. 当前 Product Architecture/Allocation；
7. 当前 WBS/Task/Deliverable/Templates；
8. 当前 Dependency/Graph；
9. 当前 RACI/Role/Team/Skill/Permission；
10. 当前 Resource/Calendar/Capacity；
11. 当前 Estimates/Historical Actual/Supplier Lead Time；
12. 当前 Scheduling/Critical Path/Gantt；
13. 当前 Milestone/Gate/Review；
14. 当前 Risk/Issue/Decision/Question；
15. 当前 Long-lead/Procurement；
16. 当前 Agent Contracts/Jobs/Events；
17. 当前 Progress Sources/Forecast；
18. 当前 Baseline/Approval/Replan；
19. 当前 UI/API/Worker/Storage/Security；
20. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Requirement Baseline Drives Scope；
- One Planning Job = One Immutable Input Snapshot；
- AI Produces Candidates Only；
- PBS != WBS；
- Requirement-to-Task Trace；
- Critical Requirement Has Implementation and Verification；
- Task Has Deliverable；
- Deliverable Has Acceptance Criteria；
- Explicit Execution Mode；
- Human/Agent/Supplier Work Separated；
- Dependency Types Explicit；
- Dependency DAG Must Be Acyclic；
- Artifact Dependencies First-class；
- Interface Freezes Explicit；
- RACI and Approval Separation；
- Owner Recommendations Require Confirmation；
- No High-risk Auto-assignment；
- Explicit Resource Calendars/Timezones；
- Capacity != 100% Work Hours；
- Estimate Method/Source/Assumptions Required；
- AI Estimate Is Not Commitment；
- Agent Runtime != Engineering Duration；
- Active/Waiting/Approval Time Separated；
- Calendar-aware Schedule；
- Reproducible Critical Path；
- Milestone != Gate；
- Customer Commitment Separate；
- Agent Input Gates；
- Agent 19/Procurement/Manufacturing/Release Require Approval；
- Artifact-based Progress；
- Status Freshness；
- Forecast != Committed Date；
- Risk != Issue；
- Long-lead Need-by Date；
- Requirement Change Requires Impact/Replan；
- Replan Creates New Baseline；
- Recovery Cannot Remove Hard Gates；
- No Automatic Customer Date Commitment；
- No External Private Personnel/Cost/Supplier Data；
- 不用客户项目做公开 Fixture；
- 不伪造 Estimate、Status、Approval 和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改项目计划：

1. 侦察当前仓库；
2. 查找 Project/Program/Phase/Task/Milestone；
3. 查找 Agent 10 Baseline/Graph/Change；
4. 查找 Architecture/Allocation；
5. 查找 WBS/Task/Deliverable/Templates；
6. 查找 Dependency/DAG；
7. 查找 RACI/Owner/Skill/Permission；
8. 查找 Resource/Calendar/Capacity；
9. 查找 Estimate/Historical/Supplier Lead Time；
10. 查找 Schedule/Critical Path/Gantt；
11. 查找 Milestone/Gate/Review；
12. 查找 Risk/Issue/Decision/Question；
13. 查找 Long-lead/Procurement；
14. 查找 Agent 16–45 Contracts/Jobs/Events；
15. 查找 Progress/Forecast/Variance；
16. 查找 Baseline/Approval/Replan；
17. 查找 UI/API/Worker/Storage/Security；
18. 统计 Requirement-to-Task Coverage；
19. 统计 Task-to-Deliverable Coverage；
20. 统计依赖循环和孤立任务；
21. 统计 Owner/Estimate/Resource Coverage；
22. 统计计划偏差、等待和审批时间；
23. 统计 Agent Failure/Manual Fallback；
24. 抽样分析开源、合成、脱敏或授权 Fixture；
25. 在 docs/project-orchestration-implementation-plan.md 中生成实施计划；
26. 在 docs/planning-input-and-gates.md 中定义输入；
27. 在 docs/project-execution-profiles.md 中定义 Profile；
28. 在 docs/wbs-and-work-packages.md 中定义 WBS；
29. 在 docs/task-and-deliverable-ir.md 中定义任务和交付物；
30. 在 docs/dependency-dag.md 中定义依赖；
31. 在 docs/raci-and-ownership.md 中定义 RACI；
32. 在 docs/estimates-and-calendars.md 中定义估算；
33. 在 docs/scheduling-and-critical-path.md 中定义调度；
34. 在 docs/milestones-and-gates.md 中定义里程碑；
35. 在 docs/risk-issue-decision.md 中定义风险；
36. 在 docs/agent-orchestration.md 中定义 Agent 编排；
37. 在 docs/progress-and-forecast.md 中定义进度；
38. 在 docs/changes-and-replanning.md 中定义变更；
39. 在 docs/baselines-and-approvals.md 中定义 Baseline；
40. 在 docs/downstream-agent-contracts.md 中定义下游；
41. 在 docs/ai-boundaries.md 中定义 AI；
42. 在 docs/security.md 中定义安全；
43. 在 docs/project-orchestration-migration-plan.md 中定义旧流程迁移；
44. 在 docs/project-orchestration-benchmark-plan.md 中定义 Benchmark；
45. 给出拟新增、拟修改和拟复用文件；
46. 给出 Phase 1 精确范围；
47. 不修改业务代码；
48. 不创建 Migration；
49. 不安装调度/优化组件；
50. 不修改任务或分配人员；
51. 不冻结 Baseline；
52. 不触发 Agent 写入、采购、制造或发布；
53. 不调用生产外部模型；
54. 不读取或打印 Secret/人员绩效/客户承诺/报价；
55. 运行仓库已有 lint、type check、test、build 和 security scan；
56. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10 与 Agent 16–45 Contracts；
- Planning Input Gate；
- Project Profiles/Templates；
- PBS/WBS；
- Work Package/Task/Deliverable；
- Requirement Traceability；
- Dependency DAG；
- RACI/Ownership；
- Resource/Calendar/Capacity；
- Estimate；
- Schedule/Critical Path；
- Milestones/Gates/Reviews；
- Risks/Issues/Decisions/Questions；
- Long-lead；
- Agent Orchestration；
- Progress/Forecast/Variance；
- Change/Replan；
- Baseline/Approval；
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

# 104. 后续 Phase 提示词模板

```text
继续实现 Project Orchestration Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10、11 和相关下游 Agent 规格；
3. 阅读 Project Orchestration Implementation Plan；
4. 阅读 Input、Profile、WBS、Task、Dependency、RACI、Estimate、Schedule、Milestone、Risk、Agent、Progress、Change、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Requirement-baseline-driven；
- Candidate-before-approval；
- Acyclic Dependencies；
- Estimate Provenance；
- Calendar-aware Scheduling；
- Artifact-based Progress；
- Controlled Agent Execution；
- Immutable Baselines；
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
9. graph/dependency test；
10. estimate/calendar/schedule test；
11. agent contract/orchestration test；
12. progress/change/baseline test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Profile/Template/Contract 变化；
- 测试命令和真实结果；
- WBS/Task/Deliverable；
- Dependency/DAG；
- RACI/Resource；
- Estimate/Schedule；
- Milestone/Gate；
- Risk/Issue；
- Agent Orchestration；
- Progress/Forecast；
- Change/Replan；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 105. MVP 演示流程

1. 新建“便携式双通道测量仪”项目；
2. Agent 10冻结 Requirements Baseline 1.0；
3. Baseline 包含电源、双通道模拟输入、显示、USB、尺寸、成本、环境和试产数量；
4. Agent 11建立 Planning Input Snapshot；
5. 选择“便携仪器 EVT/DVT”Project Profile；
6. 生成 Product Breakdown：
7. 电源模块；
8. 模拟前端；
9. ADC/处理器；
10. 显示和人机接口；
11. USB 和通信；
12. 固件；
13. 外壳；
14. 测试治具；
15. 制造发布包；
16. 生成 Workstreams：
17. System；
18. Hardware；
19. Firmware；
20. Mechanical；
21. Test；
22. Procurement；
23. Manufacturing；
24. Quality；
25. 将 Critical Requirement 映射到实现和验证任务；
26. 生成电源架构 Work Package；
27. 生成模拟前端 Work Package；
28. 生成原理图、仿真、PCB、机械和固件 Work Package；
29. 生成 Agent 16–30 对应任务；
30. 建立 Deliverable：
31. Architecture Spec；
32. Interface Control Document；
33. Schematic；
34. Simulation Report；
35. PCB Constraint IR；
36. Placement IR；
37. Routing IR；
38. DRC/Mechanical Report；
39. Manufacturing Release；
40. DFM Report；
41. 建立依赖；
42. Connector Type Freeze 后才能冻结外壳开孔；
43. Pin Assignment Freeze 后才能完成固件 BSP；
44. Board Outline Freeze 后才能完成 PCB Placement；
45. Schematic Review Pass 后才能开始正式 Routing；
46. Mechanical Review Pass 后才能发布生产文件；
47. DFM Pass 后才能下达试产；
48. DAG 检测发现：
49. 结构等待 PCB 板框；
50. PCB 板框又等待结构外壳；
51. 系统将其拆解为“初步机械包络”和“最终板框冻结”，消除循环；
52. 建立 RACI；
53. 硬件负责人 Accountable；
54. 模拟工程师 Responsible；
55. 测试工程师 Consulted；
56. 项目经理 Informed；
57. 读取团队 Calendar 和容量；
58. 不直接分配人员，只输出 Owner Candidate；
59. 采用历史相似项目与负责人承诺生成 Estimate Candidate；
60. 将工作时间、审核时间、采购等待和 PCB 制造时间分开；
61. 识别 ADC 为长交期器件；
62. 创建样品采购和替代料验证任务；
63. 识别认证实验室预约为外部依赖；
64. 运行 Calendar-aware CPM；
65. 输出 Critical Path：
66. 模拟前端设计；
67. 原理图审查；
68. PCB 布局布线；
69. 生产文件；
70. PCB/SMT；
71. Bring-up；
72. EVT；
73. 输出 Near-critical Path：
74. 外壳设计；
75. 模具样件；
76. 装配验证；
77. 生成 Milestones：
78. Requirement Baseline；
79. Architecture Freeze；
80. Schematic Freeze；
81. PCB Release；
82. Prototype Received；
83. Bring-up Complete；
84. EVT Complete；
85. 生成每个 Gate 的 Artifact 和 Approval 条件；
86. 建立风险：
87. ADC 长交期；
88. 模拟带宽可实现性；
89. 双面贴装和器件高度；
90. USB 需求仍有一个开放问题；
91. 未回答问题被绑定在 Architecture Freeze 前；
92. 工程师审核并批准 WBS、Owner、Estimate 和 Gate；
93. 冻结 Project Baseline 1.0；
94. Agent 11检测 Agent 23输入 Gate 满足，创建仿真执行请求；
95. 仿真输出包含 High Finding；
96. 自动创建工程修复任务，而不是标记仿真任务简单失败；
97. 修复后 Agent 23重新执行；
98. Schematic Deliverable 通过 Agent 22 Gate；
99. Agent 24、25、26按依赖启动；
100. Agent 27发现 SI 风险，Milestone Forecast 延迟；
101. Agent 11生成 Recovery Candidate：
102. 并行完成非关键机械任务；
103. 增加一次快速 Layout Review；
104. 提前下单 PCB 原材料；
105. 不删除 SI Review Gate；
106. 项目经理批准恢复方案；
107. 客户将最大高度从 30mm 改为 25mm；
108. Agent 10创建 Requirement Change；
109. Agent 11传播到：
110. 高器件选型；
111. PCB Placement；
112. 机械；
113. 热；
114. 3D；
115. 生产文件；
116. DFM；
117. 重新计算资源、依赖和 Milestone；
118. 创建 Replan Candidate；
119. 客户承诺日期字段保持不变，显示存在冲突；
120. 负责人批准新的执行计划；
121. 冻结 Project Baseline 1.1；
122. 保留 1.0；
123. EVT 完成后根据 Artifact 和 Test Evidence 更新实际状态；
124. 发布 `project-planning.baseline-frozen` 和项目状态报告。

---

# 106. 生产上线顺序

第一阶段：

```text
Agent 10 Baseline Intake
Project Profiles
WBS/Task/Deliverable
Dependency DAG
RACI Roles
Manual Estimate
CPM Schedule
Milestones/Gates
Report-only
```

第二阶段：

```text
Resource Calendars/Capacity
Historical Estimate
Agent Contract Registry
Agent Execution Orchestration
Progress Evidence
Risk/Long-lead
Baseline and Change Impact
```

第三阶段：

```text
Resource-constrained Optimization
Portfolio Capacity
Supplier Collaboration
Probabilistic Forecast
Calendar/Email/Slack/Git Automation
Customer Portal
```

上线优先确保：

```text
每个任务是否源自需求、模板、风险或明确决策
每个关键需求是否同时有实现任务和验证任务
每个任务是否有可验收的交付物，而不是只有完成百分比
所有依赖是否无环，并且接口冻结点是否清楚
工期和负责人是否有来源并经过确认
Agent 自动执行是否被输入 Gate 和审批边界约束
需求变化后是否真正传播到资源、里程碑、采购和验证
```

一个靠谱的项目拆解 Agent，不是把 PRD 变成一张漂亮甘特图。它应该让团队清楚知道：现在为什么能开工、在等谁、交付什么才算完成、哪条路径真的决定日期，以及需求改动以后，哪些看似无关的任务会一起被掀翻。
