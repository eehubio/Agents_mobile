# 工程变更与问题闭环 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：47  
> Agent 名称：Engineering Change, Configuration Impact, Problem Closure & Knowledge Feedback Orchestration Agent  
> 中文名称：工程变更与问题闭环 Agent  
> 类型：编排型  
> 版本：V1.0  
>
> 定位：统一编排 ECR、ECN、ECO、Deviation、Waiver、NCR、CAPA、CAR、SCAR、MRB、8D、PDCA 和工程问题闭环；接收来自需求、架构、元器件、EDA、Firmware、PCB、制造、采购、库存、质量、现场调试和客户反馈的变更或问题信号；冻结问题与变更输入快照，复现问题、组织证据、建立 Root Cause Graph，生成版本差异和配置项影响图，分析库存、在制品、在途、已交付产品、供应商、治具、测试程序、固件、文档和认证影响；生成处置方案、Effectivity、实施计划、审批矩阵、验证与回归计划；驱动各专业 Agent 执行受控变更并回读结果；完成 PDCA/8D、发布、通知、旧版本封存、知识回写和效果追踪。
>
> 本 Agent 的本质不是“自动填 ECN 表”，而是：
>
> ```text
> Problem / Change Signal
> → Evidence and Reproduction
> → Root Cause
> → Controlled Change
> → Impact and Disposition
> → Implementation
> → Verification
> → Effectiveness
> → Institutional Knowledge
> ```
>
> 系统边界：
> - Agent 47 是编排与配置控制中枢，不直接修改 EDA、Firmware、BOM、工艺或库存；
> - 专业分析由对应 Agent 执行，Agent 47 负责发起、约束、聚合、Gate、审批、状态和审计；
> - 实际系统写入必须走对应受控执行器、PLM/ERP/MES/WMS/QMS API 或 Agent 19；
> - 任何工程变更必须绑定 Baseline、Effectivity、受影响对象、审批和验证；
> - 任何问题关闭必须绑定复现证据、根因状态、纠正措施、预防措施和效果验证。
>
> 上游：
> - Agent 10：Requirement Baseline、需求变更、客户需求偏差、合规与验收条件
> - Agent 11：项目任务、负责人、依赖、里程碑、风险、资源和重排计划
> - Agent 12：系统架构、功能、接口、电源、数据流、控制流和 ADR
> - Agent 13：参考设计、模块复用、来源资产、许可证和复用变更范围
> - Agent 14：器件选型、主选/备选、Ordering Code、生命周期和供应风险
> - Agent 15：接口、电源、电平、协议、Pin Mux、连接器和兼容性 Baseline
> - Agent 16：EDA Canonical IR、原理图、PCB、BOM、Net、Footprint、3D 和 Source Map
> - Agent 17：PDF/图片原理图识别结果和证据
> - Agent 18：Reviewed Netlist、连接关系和歧义
> - Agent 19：KiCad MCP/CLI 受控执行、Preview、Approval、Readback 和 Rollback
> - Agent 20：Symbol、Footprint、Pin-Pad、3D 和 EDA Library 验证
> - Agent 21：Firmware/BSP/Driver/Protocol、Build、配置和日志
> - Agent 22：ERC、原理图审查、额定值、保护、去耦和设计问题
> - Agent 23：仿真、Expected Behavior、Margin、故障签名和结果解释
> - Agent 24–28：PCB 约束、布局、布线、DRC/SI/PI/EMC、机械和装配审查
> - Agent 29：Manufacturing Release、Gerber、Drill、BOM、CPL、装配图和 Release Manifest
> - Agent 30：DFM/DFA、工厂能力、拼板、焊接、贴装和制造可行性
> - Agent 31–40：BOM、MPN、替代、生命周期、合规、价格库存、风险和采购计划
> - Agent 41–45：库存、Lot Traceability、EBOM/MBOM、制造询价下单、来料/生产测试和质量
> - Agent 46：LabSight Debug Session、现场证据、Hypothesis、Root Cause Candidate、Repair 和 Regression
> - ezPLM：项目、文档、物料、BOM、版本、变更、任务、审批、知识和权限
> - ERP：采购、订单、成本、供应商、在途和财务影响
> - WMS：库存、库位、Lot、序列号、冻结和处置
> - MES：工单、在制品、工艺路线、站点、测试、返工和报废
> - QMS：NCR、CAPA、8D、SCAR、MRB、质量指标和审核
> - CRM/售后：客户投诉、RMA、现场故障、批次和通知
> - 供应商：PCN、PDN、8D、纠正措施、替代料和过程变更
>
> 下游：
> - Agent 10：需求 Baseline 变更候选和验收条件更新
> - Agent 11：变更任务、负责人、依赖、资源、工期和风险
> - Agent 12：架构、接口、Power、Mode 和 ADR 变更
> - Agent 13：复用资产更新、模块版本、License 和来源范围
> - Agent 14：器件重选、备选激活和供应策略
> - Agent 15：兼容性重新检查
> - Agent 16/18/20：EDA、Netlist 和 Library 重新解析、校验
> - Agent 19：受控 EDA 修改
> - Agent 21：Firmware 分支、Build、配置和回归
> - Agent 22/23/24–30：专业审查、仿真、PCB、机械、制造和生产文件重新生成
> - Agent 31–45：BOM、采购、库存、Lot、MBOM、制造、来料和质量处置
> - Agent 46：问题复现、现场验证、修复和回归
> - PLM/ERP/WMS/MES/QMS/CRM：正式变更和处置写入
>
> 核心输出：
> - Change/Issue Intake Snapshot
> - Change Classification and Workflow Selection
> - Problem Statement and Reproduction Contract
> - Containment Action Plan
> - Multisource Evidence Package
> - Root Cause Analysis Graph
> - 5 Why / Fishbone / Fault Tree Candidate
> - PDCA Record
> - 8D Record
> - Configuration Item Registry Snapshot
> - Baseline-to-Baseline Diff
> - Semantic Change Set
> - Impact Graph
> - Affected Item, Document and Process Matrix
> - Inventory/WIP/In-transit/Delivered Impact Report
> - Lot/Serial/Date/Revision Trace
> - Effectivity Plan
> - Disposition Plan
> - Cost/Schedule/Risk Impact
> - Change Alternatives and Decision Record
> - ECR / ECN / ECO Package
> - Approval Matrix and Sign-off
> - Implementation Work Packages
> - Verification and Validation Plan
> - Release and Rollout Plan
> - Supplier/Customer/Factory Notification Plan
> - Closure Gate and Effectiveness Review
> - Knowledge Base Candidate
> - Prevention Rule/Checklist/Test Candidate
> - Change Metrics and Recurrence Monitoring
>
> 重要边界：
> - 不把问题单关闭等同于问题已经解决。
> - 不把修复现象等同于确认根因。
> - 不把一次通过等同于长期有效。
> - 不把 ECR、ECN、ECO、Deviation、Waiver、NCR、CAPA 和 8D 混为同一种流程。
> - 不允许没有 Effectivity 的正式工程变更。
> - 不允许用文件名或修改日期代替正式 Baseline 和 Revision。
> - 不允许只比较 PDF 或截图而忽略结构化 EDA、BOM、Firmware、工艺和测试差异。
> - 不把“BOM 没变化”视为制造和质量无影响。
> - 不把“设计改了”视为库存、WIP、在途和客户产品会自动同步。
> - 不允许库存和在制品处置留成自然语言备注而无可执行 Disposition。
> - 不自动报废、冻结、返工、放行或替换实际库存。
> - 不自动创建采购取消、供应商索赔、客户召回或财务冲销。
> - 不自动发布 ECN/ECO，不自动生效新版本。
> - 不自动批准 Critical Deviation、Waiver 或根因。
> - 不允许软件版本、硬件版本、BOM 版本和制造版本没有兼容矩阵。
> - 不允许旧版本被覆盖或删除。
> - 不允许变更后不重新生成相关生产文件、测试程序和操作文档。
> - 不允许只验证修改点而不做受影响范围回归。
> - 不把 AI 总结作为工程证据或审批记录。
> - AI 可以生成候选、摘要和问题，但不能编造差异、库存、Lot、成本、审批或验证结果。
> - 私有 BOM、设计、供应商、客户、库存和质量数据不得发送给未批准外部模型。
> - 所有影响、结论、审批、执行和关闭必须绑定来源、时间、版本、人员和 Artifact Hash。

---

# 1. Agent 47 的系统位置

```text
Issue / Change Signal
        ↓
Intake and Classification
        ↓
Containment / Reproduction / Evidence
        ↓
Root Cause and Change Need
        ↓
Configuration Baselines and Semantic Diff
        ↓
Impact Graph
        ↓
Inventory / WIP / Supplier / Customer Disposition
        ↓
Alternative and Approval
        ↓
Implementation Work Packages
        ↓
Controlled Execution and Readback
        ↓
Verification / Validation / Regression
        ↓
Effectivity / Release / Notification
        ↓
PDCA / 8D Closure
        ↓
Knowledge / Rule / Prevention Feedback
```

---

# 2. 为什么需要独立 Agent 47

典型问题：

1. ECN 只写“更换 R37”，没有说明为什么、影响哪些板和哪些批次；
2. 原理图改了，PCB、BOM、Firmware 和测试程序没同步；
3. 新版本已经发布，仓库仍在发旧版本物料；
4. WIP 已经贴片一半，却没人决定继续、返工还是报废；
5. 供应商发来 PCN，只被采购邮箱看过；
6. 现场问题修复了，但没有更新设计规则和测试；
7. 8D 文档完成了，措施却没有落实到产品配置；
8. Deviation 到期后仍被持续使用；
9. 工厂临时返工没有进入正式产品记录；
10. Hardware B 只能配 Firmware 2.x，但 MES 仍能刷入 1.x；
11. 客户投诉只记录症状，没有关联 Serial、Lot 和生产记录；
12. 根因分析只写“操作不当”，没有机制和证据；
13. 同样问题半年后再次发生；
14. ECO 被审批后没有验证旧库存和在途订单；
15. 同一个问题存在多个工单、NCR、RMA 和 Debug Session，彼此不关联；
16. Change Impact 靠人工会议记忆；
17. 修改评审只看当前项目，不看复用模块和其他产品；
18. 工程师改了 KiCad 文件，但 PLM 仍指向旧 Release；
19. BOM 中型号不变，但封装、厂商 Revision 或 Firmware 配置变化；
20. 问题关闭后没有衡量措施是否真正降低复发率。

Agent 47 的职责：

```text
Signal
→ Structured Change/Problem Contract
→ Cross-system Trace
→ Controlled Closure
```

---

# 3. 对象分类

## 3.1 Change 对象

```text
engineering_change_request
engineering_change_notice
engineering_change_order
temporary_deviation
permanent_deviation
waiver
supplier_change
process_change
software_change
documentation_change
test_change
tooling_change
regulatory_change
cost_reduction_change
obsolescence_change
field_corrective_change
```

## 3.2 Problem 对象

```text
engineering_issue
design_defect
manufacturing_defect
supplier_defect
incoming_nonconformance
production_nonconformance
test_failure
field_failure
customer_complaint
rma
audit_finding
safety_issue
compliance_issue
data_quality_issue
configuration_mismatch
recurring_issue
```

## 3.3 Quality 对象

```text
ncr
mrb_case
capa
car
scar
8d
pdca
containment
corrective_action
preventive_action
effectiveness_review
```

---

# 4. ECR、ECN、ECO 边界

## ECR

```text
提出为什么要变
问题、机会、范围、约束和候选方案
尚未批准实施
```

## ECN

```text
通知哪些对象将发生变化
包含差异、影响、Effectivity、处置和通知
可用于组织评审和发布沟通
```

## ECO

```text
批准并控制实际执行
包含正式 Baseline、任务、发布、验证和生效状态
```

企业可配置命名，但系统内部语义必须分开。

---

# 5. Deviation 与 Waiver

## Deviation

```text
在产品或过程实施前，批准临时偏离要求
必须有范围、数量、时间、Lot、Serial 和到期条件
```

## Waiver

```text
对已发生或已生产的不符合项进行有限接受
必须有风险、处置、客户/质量批准和追溯范围
```

Deviation/Waiver 不得被当作永久设计变更。

---

# 6. Change Class

```text
class_0_document_only
class_1_form_fit_function_unchanged
class_2_internal_compatibility_change
class_3_customer_visible_change
class_4_safety_or_regulatory_change
class_5_emergency_change
```

分类由 Policy 决定，不由 AI 自由判断。

---

# 7. Urgency

```text
routine
expedited
emergency
stop_ship
stop_build
field_action
```

---

# 8. Trigger Source

```text
requirement_change
design_review
test_failure
debug_session
manufacturing_issue
supplier_pcn
supplier_pdn
component_eol
inventory_shortage
quality_escape
field_return
customer_request
regulatory_update
cost_reduction
process_improvement
security_issue
audit
manual
```

---

# 9. Change/Issue Intake Contract

```json
{
  "intake_id": "CHG-2026-001",
  "intake_type": "engineering_issue",
  "title": "USB 枚举不稳定",
  "trigger_source": "labsight_debug_session",
  "affected_product_candidates": [],
  "affected_revision_candidates": [],
  "symptom_ids": [],
  "evidence_ids": [],
  "urgency": "expedited",
  "safety_candidate": false,
  "customer_impact_candidate": true,
  "status": "received"
}
```

---

# 10. Intake Gate

必须具备：

```text
问题/变更标题
来源
发现时间
发现对象
初步范围
提交人
证据候选
紧急程度
安全和客户影响候选
```

信息不足可进入 Triage，但不能进入正式 ECO。

---

# 11. Triage

输出：

```text
problem vs change
workflow type
owner role
priority
containment need
reproduction need
safety/compliance escalation
stop ship/build candidate
supplier/customer involvement
required agents
```

---

# 12. Containment

目的：

```text
在根因未确认前控制风险扩散
```

可能措施：

```text
inventory hold candidate
WIP hold candidate
stop build candidate
stop ship candidate
enhanced inspection
temporary test
firmware block
lot segregation
supplier containment
customer advisory candidate
```

所有措施必须有范围、开始时间、Owner、退出条件。

---

# 13. Containment 边界

Agent 47 只生成和编排：

```text
hold request
inspection request
stop candidate
segregation plan
notification draft
```

实际冻结、停线、停发和通知需授权系统执行。

---

# 14. Reproduction Contract

```text
affected configuration
setup
inputs
environment
firmware
instruments
steps
expected
observed
frequency
sample count
evidence
```

---

# 15. Reproduction Status

```text
not_attempted
not_reproducible
intermittent
reproduced_once
reproduced_consistently
environment_dependent
configuration_dependent
unknown
```

---

# 16. Root Cause Analysis

支持：

```text
5 Why
Fishbone/Ishikawa
Fault Tree
Causal Graph
Is/Is Not
Process Map
Change Point Analysis
Barrier Analysis
Failure Mode Review
```

---

# 17. Root Cause 层级

```text
physical_root_cause
technical_root_cause
process_root_cause
systemic_root_cause
escape_point
```

例如：

```text
Physical：R37 虚焊
Technical：焊盘热容量和回流窗口不足
Process：钢网开口和炉温未验证
Systemic：封装变更未触发 DFA 和工艺再验证
Escape Point：AOI/Test 未覆盖该失效模式
```

---

# 18. Root Cause 状态

```text
candidate
supported
contradicted
rejected
verified
unknown
```

Verified 必须有：

```text
机制
复现
证据
替代原因排除
纠正措施改变结果
回归通过
```

---

# 19. Escape Point

必须分析：

```text
为什么问题发生
为什么没有被前一道检查发现
为什么流出到下一阶段或客户
```

---

# 20. Corrective vs Preventive

## Correction

```text
处理当前具体问题或产品
```

## Corrective Action

```text
消除已发生问题根因
```

## Preventive Action

```text
防止类似问题在其他产品或流程发生
```

---

# 21. PDCA

## Plan

```text
problem
target
root cause
action plan
metrics
```

## Do

```text
implementation
training
pilot
records
```

## Check

```text
verification
effectiveness
trend
side effects
```

## Act

```text
standardize
rollout
update rules
knowledge
next cycle
```

---

# 22. 8D

```text
D0 Prepare
D1 Team
D2 Problem Description
D3 Interim Containment
D4 Root Cause and Escape Point
D5 Permanent Corrective Action
D6 Implement and Validate
D7 Prevent Recurrence
D8 Recognize and Close
```

系统支持企业裁剪，但每一阶段有 Gate。

---

# 23. Configuration Item

类型：

```text
requirement
architecture
reference_asset
component
ordering_code
symbol
footprint
3d_model
schematic
pcb
netlist
firmware_source
firmware_binary
bootloader
configuration
bom
ebom
mbom
routing
work_instruction
test_spec
test_program
fixture
tooling
gerber
drill
cpl
assembly_drawing
stencil
datasheet
certificate
supplier_process
manufacturing_process
packaging
label
user_document
service_document
```

---

# 24. Configuration Identity

```text
item id
item type
name
revision
version
variant
status
baseline
hash
effective range
owner
source system
```

---

# 25. Baseline 类型

```text
requirement_baseline
architecture_baseline
selection_baseline
compatibility_baseline
design_baseline
firmware_baseline
manufacturing_baseline
quality_baseline
release_baseline
service_baseline
```

---

# 26. Version Diff

必须同时支持：

```text
file diff
metadata diff
semantic object diff
graph diff
geometry diff
parameter diff
bom diff
firmware config diff
process diff
test coverage diff
```

---

# 27. Diff 状态

```text
added
removed
modified
renamed
moved
split
merged
relinked
reconfigured
replaced
unchanged
unknown
```

---

# 28. Semantic Diff

示例：

```text
R37 value: 10k → 4.7k
U5 ordering code changed
U5 package unchanged
U5 pin function changed
Net USB_D+ rerouted
Board outline unchanged
Firmware clock source changed
Test limit changed
Work instruction step added
```

---

# 29. Diff 证据

每个差异必须保存：

```text
source baseline
target baseline
source object
target object
change type
before
after
source location
tool/version
confidence
review status
```

---

# 30. Change Set

```text
intent
changed objects
added objects
removed objects
derived artifacts
affected variants
compatibility implications
verification requirements
```

---

# 31. Impact Graph

节点：

```text
requirement
function
block
interface
component
library
schematic
net
pcb region
firmware module
configuration
bom item
inventory item
lot
serial
purchase order
supplier
work order
wip unit
process step
fixture
test
document
customer unit
certificate
```

边：

```text
depends_on
implements
uses
contains
mapped_to
built_from
supplied_by
tested_by
configured_by
released_as
installed_in
affected_by
must_change
must_reverify
must_regenerate
must_notify
```

---

# 32. Impact 类型

```text
design
firmware
mechanical
manufacturing
test
supply
inventory
wip
in_transit
field
customer
regulatory
documentation
training
cost
schedule
quality
service
```

---

# 33. Impact Level

```text
direct
derived
potential
unknown
not_affected
```

---

# 34. Impact Finding

```json
{
  "impact_id": "IMP-001",
  "source_change_object_id": "CHOBJ-001",
  "affected_object_ref": {},
  "impact_type": "wip",
  "impact_level": "direct",
  "required_action": "disposition_required",
  "evidence_ids": [],
  "status": "open"
}
```

---

# 35. Configuration Compatibility Matrix

检查：

```text
hardware revision
assembly revision
firmware version
bootloader
configuration
BOM variant
test program
fixture revision
manufacturing route
service tool
```

---

# 36. Inventory Scope

```text
raw_material
component
subassembly
finished_goods
spare
consigned
customer_owned
supplier_owned
quarantine
mrp_reserved
```

---

# 37. Inventory Impact

分析：

```text
on hand
available
reserved
allocated
quality hold
shelf life
lot/date code
location
cost
project ownership
replacement possibility
rework possibility
return possibility
```

---

# 38. WIP Scope

```text
work order
quantity started
current operation
completed operations
installed materials
serialized units
test status
rework history
scrap status
```

---

# 39. In-transit Scope

```text
purchase orders
supplier shipments
inter-site transfer
customer shipment
return shipment
```

---

# 40. Delivered Product Scope

```text
customer
order
serial
lot
ship date
region
firmware
service history
warranty
contact status
```

---

# 41. Traceability Query

支持：

```text
which products used lot X
which WIP contains part Y
which serials use firmware Z
which customers received revision A
which work orders used test program T
which supplier batches are affected
```

---

# 42. Disposition

```text
use_as_is
rework
repair
retest
relabel
reprogram
replace
return_to_supplier
scrap
sort_and_screen
hold
release
consume_before_effectivity
transfer_to_other_project
customer_concession
unknown
```

---

# 43. Disposition Contract

```text
scope
quantity
lot/serial/range
current location/state
action
instruction
owner
approval
cost
deadline
verification
record destination
```

---

# 44. Effectivity

支持：

```text
date_effectivity
lot_effectivity
serial_effectivity
work_order_effectivity
purchase_order_effectivity
shipment_effectivity
revision_effectivity
site_effectivity
customer_effectivity
quantity_effectivity
```

---

# 45. Effectivity 边界

必须定义：

```text
old configuration valid through
new configuration valid from
transition period
mixed build allowed
interchangeability
firmware compatibility
labeling
traceability
```

---

# 46. Interchangeability

```text
fully_interchangeable
forward_compatible
backward_compatible
conditionally_interchangeable
not_interchangeable
unknown
```

---

# 47. Change Alternative

```text
no_change
temporary_containment
component_substitution
firmware_only
design_change
process_change
test_change
supplier_change
dual_source
rework_existing
scrap_and_replace
field_update
recall_candidate
```

---

# 48. Alternative Evaluation

维度：

```text
technical effectiveness
risk
implementation time
cost
inventory loss
wip disruption
supplier impact
customer impact
regulatory impact
verification burden
reversibility
long-term prevention
```

---

# 49. Change Decision

```text
selected alternative
rejected alternatives
trade-offs
accepted risks
effectivity
disposition
required validations
approvers
```

---

# 50. Approval Matrix

角色候选：

```text
requester
design owner
firmware owner
mechanical owner
manufacturing engineer
test engineer
quality
supply chain
procurement
inventory
service
product manager
finance
regulatory
customer representative
executive approver
```

---

# 51. Approval 规则

基于：

```text
change class
safety
customer visibility
inventory value
wip quantity
field impact
regulatory impact
cost threshold
schedule impact
site scope
```

---

# 52. Approval 状态

```text
not_required
pending
approved
approved_with_conditions
rejected
expired
revoked
```

---

# 53. Implementation Work Package

```text
target object
target agent/system
change instruction
source baseline
target baseline candidate
dependencies
owner
estimate candidate
input gate
expected output
verification
rollback
```

---

# 54. Controlled Implementation

流程：

```text
approved ECO
→ isolated workspace / system transaction
→ preview
→ execute
→ readback
→ diff
→ professional validation
→ release candidate
```

---

# 55. Implementation Status

```text
planned
ready
blocked
in_progress
implemented
readback_failed
verification_failed
rolled_back
accepted
```

---

# 56. Verification

检查：

```text
change implemented as approved
intended effect achieved
requirements met
no adverse side effects
affected interfaces pass
manufacturing feasible
test coverage updated
inventory disposition executed
documentation synchronized
```

---

# 57. Validation

面向实际用途：

```text
customer scenario
system use
environment
long-duration behavior
field compatibility
user workflow
serviceability
```

---

# 58. Regression Scope

由 Impact Graph 自动生成候选：

```text
unit
integration
system
hardware
firmware
interface
power
performance
mechanical
manufacturing
test
supply
quality
service
```

---

# 59. Closure Gate

问题关闭至少需要：

```text
problem statement approved
containment dispositioned
reproduction status documented
root cause verified or explicitly unresolved
change/correction completed
inventory/WIP disposition completed
verification and regression passed
effectivity released
notifications completed
documents synchronized
effectiveness review scheduled or completed
knowledge candidate dispositioned
```

---

# 60. Effectiveness Review

时间窗口：

```text
immediate
after pilot
after N units
after N lots
after 30/60/90 days
after field exposure
```

指标：

```text
recurrence rate
defect ppm
yield
test failure
RMA
customer complaint
rework
scrap
cycle time
cost
```

---

# 61. Recurrence Monitoring

如果同类问题重现：

```text
reopen
create linked issue
escalate systemic root cause
invalidate effectiveness
expand scope
trigger new CAPA/8D
```

---

# 62. Knowledge Writeback

候选类型：

```text
known issue
fault signature
debug playbook
design rule
selection rule
compatibility rule
EDA library note
DFM rule
test case
inspection rule
supplier risk
process control
training material
FAQ
checklist
```

---

# 63. Knowledge Gate

必须确认：

```text
适用范围
版本
证据
根因
验证
隐私
客户信息
供应商信息
知识 Owner
复审日期
```

---

# 64. Prevention Feedback

示例：

```text
Agent 14：选型规则增加 Lifecycle/Errata 条件
Agent 15：兼容性规则增加 Power-off Tolerance
Agent 20：Footprint 校验增加 EPAD 规则
Agent 22：ERC 规则增加缺失上拉
Agent 30：DFA 增加连接器方向检查
Agent 45：生产测试增加 Board/Firmware Identity
Agent 46：Debug Playbook 增加当前故障签名
```

---

# 65. AI 允许职责

```text
将自然语言问题归类
生成 Triage Candidate
总结 Evidence
生成 Root Cause Candidate
生成 5 Why/Fishbone 草稿
生成 Impact Question
解释 Diff
生成 8D/PDCA 草稿
生成通知和报告草稿
生成知识候选
```

---

# 66. AI 禁止职责

```text
编造库存和 WIP 数量
编造版本差异
编造根因和验证结果
自动批准 ECO
自动决定报废/召回
自动冻结库存
自动关闭问题
自动签署 8D
自动通知客户
自动发布知识
```

---

# 67. 状态机

```text
RECEIVED
→ TRIAGE
→ CONTAINMENT
→ REPRODUCTION
→ ROOT_CAUSE_ANALYSIS
→ CHANGE_REQUIRED_DECISION
→ BASELINE_CAPTURE
→ DIFF
→ IMPACT_ANALYSIS
→ ALTERNATIVE_REVIEW
→ APPROVAL
→ IMPLEMENTATION_PLANNING
→ IMPLEMENTATION
→ READBACK
→ VERIFICATION
→ EFFECTIVITY_RELEASE
→ DISPOSITION_EXECUTION
→ NOTIFICATION
→ EFFECTIVENESS_REVIEW
→ KNOWLEDGE_REVIEW
→ CLOSURE
→ CLOSED
```

分支：

```text
CLOSED_NO_CHANGE
CLOSED_DUPLICATE
CLOSED_NOT_REPRODUCIBLE
CLOSED_ACCEPTED_RISK
BLOCKED_INFORMATION
BLOCKED_SAFETY
BLOCKED_APPROVAL
BLOCKED_INVENTORY
BLOCKED_WIP
BLOCKED_SUPPLIER
BLOCKED_CUSTOMER
EMERGENCY_CONTAINMENT
ROLLBACK_REQUIRED
REOPENED
CANCELLED
FAILED
```

---

# 68. 错误码

```text
PROJECT_NOT_FOUND
INTAKE_TYPE_UNRESOLVED
WORKFLOW_POLICY_NOT_FOUND
CHANGE_CLASS_UNRESOLVED
PROBLEM_STATEMENT_INCOMPLETE
CONTAINMENT_REQUIRED
CONTAINMENT_SCOPE_UNRESOLVED
REPRODUCTION_CONTRACT_INCOMPLETE
ROOT_CAUSE_UNVERIFIED
BASELINE_NOT_FOUND
BASELINE_HASH_MISMATCH
CONFIGURATION_ITEM_UNRESOLVED
DIFF_PROVIDER_UNAVAILABLE
SEMANTIC_DIFF_INCOMPLETE
IMPACT_GRAPH_INCOMPLETE
INVENTORY_DATA_STALE
WIP_DATA_STALE
TRACEABILITY_GAP
AFFECTED_LOT_UNRESOLVED
AFFECTED_SERIAL_UNRESOLVED
DISPOSITION_REQUIRED
DISPOSITION_APPROVAL_MISSING
EFFECTIVITY_INCOMPLETE
INTERCHANGEABILITY_UNKNOWN
FIRMWARE_HARDWARE_MATRIX_INCOMPLETE
SUPPLIER_IMPACT_UNRESOLVED
CUSTOMER_IMPACT_UNRESOLVED
REGULATORY_REVIEW_REQUIRED
APPROVAL_MATRIX_INCOMPLETE
APPROVAL_REJECTED
IMPLEMENTATION_BLOCKED
READBACK_FAILED
VERIFICATION_FAILED
REGRESSION_INCOMPLETE
RELEASE_BLOCKED
NOTIFICATION_INCOMPLETE
EFFECTIVENESS_REVIEW_INCOMPLETE
KNOWLEDGE_REVIEW_REQUIRED
CLOSURE_GATE_BLOCKED
CHANGE_ALREADY_RELEASED
REVISION_ALREADY_EXISTS
SESSION_CANCELLED
INTERNAL_ERROR


---

# 69. 数据库设计

## 69.1 `change_issue_cases`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
case_key VARCHAR NOT NULL
case_type VARCHAR NOT NULL
title VARCHAR NOT NULL
description TEXT NOT NULL
trigger_source VARCHAR NOT NULL
trigger_reference JSONB NOT NULL
urgency VARCHAR NOT NULL
change_class VARCHAR NULL
safety_candidate BOOLEAN NOT NULL
customer_impact_candidate BOOLEAN NOT NULL
regulatory_candidate BOOLEAN NOT NULL
status VARCHAR NOT NULL
current_stage VARCHAR NULL
owner_role VARCHAR NULL
owner_id UUID NULL
parent_case_id UUID NULL
duplicate_of_case_id UUID NULL
idempotency_key VARCHAR NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, case_key)
UNIQUE(idempotency_key)
```

## 69.2 `change_issue_intake_snapshots`

```text
id UUID PK
case_id UUID NOT NULL
input_version INT NOT NULL
intake_payload JSONB NOT NULL
source_artifact_refs JSONB NOT NULL
source_event_refs JSONB NOT NULL
model_snapshot JSONB NOT NULL
policy_snapshot_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, input_version)
```

## 69.3 `change_workflow_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
case_type_scope JSONB NOT NULL
product_scope JSONB NOT NULL
site_scope JSONB NOT NULL
triage_rules JSONB NOT NULL
containment_rules JSONB NOT NULL
root_cause_rules JSONB NOT NULL
change_class_rules JSONB NOT NULL
impact_rules JSONB NOT NULL
approval_rules JSONB NOT NULL
effectivity_rules JSONB NOT NULL
closure_rules JSONB NOT NULL
knowledge_rules JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 69.4 `change_case_classifications`

```text
id UUID PK
case_id UUID NOT NULL
classification_version INT NOT NULL
problem_or_change VARCHAR NOT NULL
recommended_workflow VARCHAR NOT NULL
recommended_change_class VARCHAR NULL
recommended_urgency VARCHAR NOT NULL
required_agents JSONB NOT NULL
required_systems JSONB NOT NULL
required_roles JSONB NOT NULL
containment_required BOOLEAN NOT NULL
reproduction_required BOOLEAN NOT NULL
supplier_involvement BOOLEAN NOT NULL
customer_involvement BOOLEAN NOT NULL
safety_escalation BOOLEAN NOT NULL
regulatory_escalation BOOLEAN NOT NULL
evidence_refs JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, classification_version)
```

## 69.5 `problem_statements`

```text
id UUID PK
case_id UUID NOT NULL
statement_version INT NOT NULL
what JSONB NOT NULL
where_context JSONB NOT NULL
when_context JSONB NOT NULL
who_or_population JSONB NOT NULL
how_many JSONB NOT NULL
severity_context JSONB NOT NULL
is_is_not JSONB NOT NULL
affected_functions JSONB NOT NULL
expected_behavior_refs JSONB NOT NULL
observed_behavior_refs JSONB NOT NULL
evidence_refs JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, statement_version)
```

## 69.6 `containment_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
scope JSONB NOT NULL
action_candidates JSONB NOT NULL
selected_actions JSONB NOT NULL
start_condition JSONB NOT NULL
exit_condition JSONB NOT NULL
owner_roles JSONB NOT NULL
deadline_context JSONB NOT NULL
notification_context JSONB NOT NULL
risk_context JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.7 `containment_action_requests`

```text
id UUID PK
containment_plan_id UUID NOT NULL
action_key VARCHAR NOT NULL
action_type VARCHAR NOT NULL
target_system VARCHAR NOT NULL
target_scope JSONB NOT NULL
requested_action JSONB NOT NULL
preconditions JSONB NOT NULL
rollback_or_release JSONB NOT NULL
requested_by UUID NOT NULL
approval_status VARCHAR NOT NULL
execution_status VARCHAR NOT NULL
external_transaction_ref JSONB NULL
created_at TIMESTAMPTZ
UNIQUE(containment_plan_id, action_key)
```

## 69.8 `reproduction_contracts`

```text
id UUID PK
case_id UUID NOT NULL
contract_version INT NOT NULL
affected_configuration JSONB NOT NULL
setup JSONB NOT NULL
inputs JSONB NOT NULL
environment JSONB NOT NULL
firmware_context JSONB NOT NULL
instrument_context JSONB NOT NULL
ordered_steps JSONB NOT NULL
expected_result JSONB NOT NULL
observed_result_template JSONB NOT NULL
frequency_requirement JSONB NOT NULL
sample_requirement JSONB NOT NULL
evidence_requirement JSONB NOT NULL
safety_requirement JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, contract_version)
```

## 69.9 `reproduction_runs`

```text
id UUID PK
reproduction_contract_id UUID NOT NULL
run_version INT NOT NULL
execution_context JSONB NOT NULL
sample_context JSONB NOT NULL
operator_id UUID NOT NULL
agent46_session_id UUID NULL
input_artifact_refs JSONB NOT NULL
observed_result JSONB NOT NULL
evidence_refs JSONB NOT NULL
result VARCHAR NOT NULL
repeatability JSONB NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 69.10 `case_evidence_links`

```text
id UUID PK
case_id UUID NOT NULL
evidence_key VARCHAR NOT NULL
evidence_type VARCHAR NOT NULL
source_system VARCHAR NOT NULL
source_object_ref JSONB NOT NULL
artifact_uri TEXT NULL
artifact_hash CHAR(64) NULL
captured_at TIMESTAMPTZ NULL
configuration_context JSONB NOT NULL
quality_vector JSONB NOT NULL
privacy_classification VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, evidence_key)
```

## 69.11 `root_cause_analysis_runs`

```text
id UUID PK
case_id UUID NOT NULL
analysis_version INT NOT NULL
analysis_methods JSONB NOT NULL
input_evidence_hash CHAR(64) NOT NULL
problem_statement_id UUID NOT NULL
reproduction_run_ids JSONB NOT NULL
analysis_summary JSONB NOT NULL
alternative_coverage JSONB NOT NULL
escape_point_summary JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, analysis_version)
```

## 69.12 `root_cause_nodes`

```text
id UUID PK
analysis_run_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
statement TEXT NOT NULL
cause_level VARCHAR NULL
affected_object_refs JSONB NOT NULL
supporting_evidence_refs JSONB NOT NULL
contradicting_evidence_refs JSONB NOT NULL
missing_evidence JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
verification_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(analysis_run_id, node_key)
```

## 69.13 `root_cause_edges`

```text
id UUID PK
analysis_run_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
mechanism TEXT NULL
evidence_refs JSONB NOT NULL
strength_context JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 69.14 `five_why_records`

```text
id UUID PK
analysis_run_id UUID NOT NULL
chain_key VARCHAR NOT NULL
ordered_questions JSONB NOT NULL
ordered_answers JSONB NOT NULL
evidence_refs JSONB NOT NULL
termination_reason VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(analysis_run_id, chain_key)
```

## 69.15 `fishbone_records`

```text
id UUID PK
analysis_run_id UUID NOT NULL
record_key VARCHAR NOT NULL
categories JSONB NOT NULL
cause_candidates JSONB NOT NULL
evidence_refs JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(analysis_run_id, record_key)
```

## 69.16 `escape_point_records`

```text
id UUID PK
analysis_run_id UUID NOT NULL
escape_key VARCHAR NOT NULL
detection_stage VARCHAR NOT NULL
expected_control JSONB NOT NULL
actual_control JSONB NOT NULL
escape_mechanism TEXT NOT NULL
affected_process_refs JSONB NOT NULL
evidence_refs JSONB NOT NULL
corrective_candidates JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(analysis_run_id, escape_key)
```

## 69.17 `pdca_records`

```text
id UUID PK
case_id UUID NOT NULL
pdca_version INT NOT NULL
plan_payload JSONB NOT NULL
do_payload JSONB NOT NULL
check_payload JSONB NOT NULL
act_payload JSONB NOT NULL
metric_refs JSONB NOT NULL
owner_roles JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, pdca_version)
```

## 69.18 `eight_d_records`

```text
id UUID PK
case_id UUID NOT NULL
eight_d_version INT NOT NULL
d0_prepare JSONB NOT NULL
d1_team JSONB NOT NULL
d2_problem JSONB NOT NULL
d3_containment JSONB NOT NULL
d4_root_cause_escape JSONB NOT NULL
d5_permanent_corrective JSONB NOT NULL
d6_implementation_validation JSONB NOT NULL
d7_prevent_recurrence JSONB NOT NULL
d8_closure_recognition JSONB NOT NULL
customer_format_context JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, eight_d_version)
```

## 69.19 `configuration_item_registry`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NULL
item_key VARCHAR NOT NULL
item_type VARCHAR NOT NULL
name VARCHAR NOT NULL
source_system VARCHAR NOT NULL
source_object_id VARCHAR NOT NULL
owner_role VARCHAR NULL
security_classification VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(tenant_id, source_system, source_object_id)
```

## 69.20 `configuration_item_versions`

```text
id UUID PK
configuration_item_id UUID NOT NULL
revision VARCHAR NULL
version VARCHAR NULL
variant_context JSONB NOT NULL
lifecycle_status VARCHAR NOT NULL
baseline_refs JSONB NOT NULL
artifact_refs JSONB NOT NULL
semantic_snapshot_uri TEXT NULL
semantic_snapshot_hash CHAR(64) NULL
effective_context JSONB NOT NULL
released_by UUID NULL
released_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 69.21 `configuration_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_key VARCHAR NOT NULL
baseline_type VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
item_version_manifest JSONB NOT NULL
variant_manifest JSONB NOT NULL
compatibility_manifest JSONB NOT NULL
effectivity_manifest JSONB NOT NULL
source_system_manifest JSONB NOT NULL
approval_manifest JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
released_at TIMESTAMPTZ NULL
UNIQUE(project_id, baseline_key, baseline_version)
```

## 69.22 `change_baseline_pairs`

```text
id UUID PK
case_id UUID NOT NULL
pair_key VARCHAR NOT NULL
source_baseline_id UUID NOT NULL
target_baseline_id UUID NULL
target_candidate_manifest JSONB NULL
comparison_scope JSONB NOT NULL
provider_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, pair_key)
```

## 69.23 `change_diff_runs`

```text
id UUID PK
baseline_pair_id UUID NOT NULL
diff_version INT NOT NULL
provider_name VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
diff_types JSONB NOT NULL
input_hash CHAR(64) NOT NULL
result_summary JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
mapping_loss JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.24 `change_diff_objects`

```text
id UUID PK
diff_run_id UUID NOT NULL
diff_key VARCHAR NOT NULL
object_type VARCHAR NOT NULL
source_object_ref JSONB NULL
target_object_ref JSONB NULL
change_type VARCHAR NOT NULL
before_value JSONB NULL
after_value JSONB NULL
semantic_meaning JSONB NOT NULL
source_location JSONB NOT NULL
target_location JSONB NOT NULL
evidence_refs JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(diff_run_id, diff_key)
```

## 69.25 `change_sets`

```text
id UUID PK
case_id UUID NOT NULL
change_set_key VARCHAR NOT NULL
change_set_version INT NOT NULL
intent TEXT NOT NULL
changed_object_refs JSONB NOT NULL
added_object_refs JSONB NOT NULL
removed_object_refs JSONB NOT NULL
derived_artifact_refs JSONB NOT NULL
affected_variants JSONB NOT NULL
compatibility_implications JSONB NOT NULL
verification_requirements JSONB NOT NULL
source_diff_run_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, change_set_key, change_set_version)
```

## 69.26 `impact_graph_versions`

```text
id UUID PK
case_id UUID NOT NULL
graph_version VARCHAR NOT NULL
source_change_set_id UUID NOT NULL
configuration_snapshot_hash CHAR(64) NOT NULL
traceability_snapshot_hash CHAR(64) NOT NULL
node_count BIGINT NOT NULL
edge_count BIGINT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, graph_version)
```

## 69.27 `impact_graph_nodes`

```text
id UUID PK
graph_version_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
source_system VARCHAR NULL
source_object_ref JSONB NOT NULL
revision_context JSONB NOT NULL
quantity_context JSONB NULL
state_context JSONB NOT NULL
security_classification VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, node_key)
```

## 69.28 `impact_graph_edges`

```text
id UUID PK
graph_version_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
effectivity_context JSONB NOT NULL
evidence_refs JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 69.29 `impact_findings`

```text
id UUID PK
case_id UUID NOT NULL
graph_version_id UUID NOT NULL
impact_key VARCHAR NOT NULL
source_change_object_refs JSONB NOT NULL
affected_object_refs JSONB NOT NULL
impact_type VARCHAR NOT NULL
impact_level VARCHAR NOT NULL
required_action VARCHAR NOT NULL
quantity_or_scope JSONB NOT NULL
cost_candidate JSONB NULL
schedule_candidate JSONB NULL
risk_context JSONB NOT NULL
evidence_refs JSONB NOT NULL
owner_role VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, impact_key)
```

## 69.30 `configuration_compatibility_matrices`

```text
id UUID PK
case_id UUID NOT NULL
matrix_version INT NOT NULL
hardware_revisions JSONB NOT NULL
assembly_revisions JSONB NOT NULL
firmware_versions JSONB NOT NULL
bootloader_versions JSONB NOT NULL
configuration_versions JSONB NOT NULL
bom_variants JSONB NOT NULL
test_program_versions JSONB NOT NULL
fixture_versions JSONB NOT NULL
route_versions JSONB NOT NULL
compatibility_cells JSONB NOT NULL
unknown_cells JSONB NOT NULL
evidence_refs JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, matrix_version)
```

## 69.31 `inventory_impact_snapshots`

```text
id UUID PK
case_id UUID NOT NULL
snapshot_version INT NOT NULL
source_system VARCHAR NOT NULL
query_context JSONB NOT NULL
query_time TIMESTAMPTZ NOT NULL
inventory_scope JSONB NOT NULL
on_hand_summary JSONB NOT NULL
available_summary JSONB NOT NULL
reserved_summary JSONB NOT NULL
quality_hold_summary JSONB NOT NULL
lot_summary JSONB NOT NULL
location_summary JSONB NOT NULL
cost_summary JSONB NOT NULL
raw_snapshot_uri TEXT NOT NULL
raw_snapshot_hash CHAR(64) NOT NULL
freshness_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.32 `wip_impact_snapshots`

```text
id UUID PK
case_id UUID NOT NULL
snapshot_version INT NOT NULL
source_system VARCHAR NOT NULL
query_time TIMESTAMPTZ NOT NULL
work_order_summary JSONB NOT NULL
operation_summary JSONB NOT NULL
installed_material_summary JSONB NOT NULL
serial_summary JSONB NOT NULL
test_status_summary JSONB NOT NULL
rework_summary JSONB NOT NULL
scrap_summary JSONB NOT NULL
raw_snapshot_uri TEXT NOT NULL
raw_snapshot_hash CHAR(64) NOT NULL
freshness_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.33 `in_transit_impact_snapshots`

```text
id UUID PK
case_id UUID NOT NULL
snapshot_version INT NOT NULL
source_system VARCHAR NOT NULL
query_time TIMESTAMPTZ NOT NULL
purchase_order_summary JSONB NOT NULL
supplier_shipment_summary JSONB NOT NULL
transfer_summary JSONB NOT NULL
customer_shipment_summary JSONB NOT NULL
return_shipment_summary JSONB NOT NULL
raw_snapshot_uri TEXT NOT NULL
raw_snapshot_hash CHAR(64) NOT NULL
freshness_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.34 `delivered_product_impact_snapshots`

```text
id UUID PK
case_id UUID NOT NULL
snapshot_version INT NOT NULL
source_system VARCHAR NOT NULL
query_time TIMESTAMPTZ NOT NULL
customer_summary JSONB NOT NULL
order_summary JSONB NOT NULL
serial_summary JSONB NOT NULL
lot_summary JSONB NOT NULL
region_summary JSONB NOT NULL
firmware_summary JSONB NOT NULL
service_summary JSONB NOT NULL
warranty_summary JSONB NOT NULL
raw_snapshot_uri TEXT NOT NULL
raw_snapshot_hash CHAR(64) NOT NULL
freshness_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 69.35 `traceability_queries`

```text
id UUID PK
case_id UUID NOT NULL
query_key VARCHAR NOT NULL
query_type VARCHAR NOT NULL
query_parameters JSONB NOT NULL
source_systems JSONB NOT NULL
requested_at TIMESTAMPTZ NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
result_summary JSONB NOT NULL
freshness_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, query_key)
```

## 69.36 `disposition_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
inventory_dispositions JSONB NOT NULL
wip_dispositions JSONB NOT NULL
in_transit_dispositions JSONB NOT NULL
delivered_dispositions JSONB NOT NULL
supplier_dispositions JSONB NOT NULL
customer_dispositions JSONB NOT NULL
cost_summary JSONB NOT NULL
schedule_summary JSONB NOT NULL
risk_summary JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.37 `disposition_actions`

```text
id UUID PK
disposition_plan_id UUID NOT NULL
action_key VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_refs JSONB NOT NULL
quantity_context JSONB NOT NULL
current_state JSONB NOT NULL
disposition_type VARCHAR NOT NULL
instruction_ref JSONB NOT NULL
target_system VARCHAR NOT NULL
owner_role VARCHAR NOT NULL
deadline TIMESTAMPTZ NULL
verification_requirement JSONB NOT NULL
approval_status VARCHAR NOT NULL
execution_status VARCHAR NOT NULL
external_transaction_ref JSONB NULL
created_at TIMESTAMPTZ
UNIQUE(disposition_plan_id, action_key)
```

## 69.38 `effectivity_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
effectivity_types JSONB NOT NULL
old_configuration_valid_through JSONB NOT NULL
new_configuration_valid_from JSONB NOT NULL
transition_period JSONB NOT NULL
mixed_build_policy JSONB NOT NULL
interchangeability VARCHAR NOT NULL
firmware_compatibility JSONB NOT NULL
labeling_policy JSONB NOT NULL
traceability_requirement JSONB NOT NULL
site_scope JSONB NOT NULL
customer_scope JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.39 `change_alternatives`

```text
id UUID PK
case_id UUID NOT NULL
alternative_key VARCHAR NOT NULL
alternative_type VARCHAR NOT NULL
description TEXT NOT NULL
technical_effectiveness JSONB NOT NULL
risk_context JSONB NOT NULL
implementation_time JSONB NOT NULL
cost_context JSONB NOT NULL
inventory_loss JSONB NOT NULL
wip_disruption JSONB NOT NULL
supplier_impact JSONB NOT NULL
customer_impact JSONB NOT NULL
regulatory_impact JSONB NOT NULL
verification_burden JSONB NOT NULL
reversibility JSONB NOT NULL
prevention_value JSONB NOT NULL
evidence_refs JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, alternative_key)
```

## 69.40 `change_decision_records`

```text
id UUID PK
case_id UUID NOT NULL
decision_key VARCHAR NOT NULL
selected_alternative_id UUID NOT NULL
rejected_alternative_ids JSONB NOT NULL
tradeoffs JSONB NOT NULL
accepted_risks JSONB NOT NULL
effectivity_plan_id UUID NOT NULL
disposition_plan_id UUID NOT NULL
required_validation_refs JSONB NOT NULL
approval_manifest JSONB NOT NULL
decision_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, decision_key)
```

## 69.41 `change_approval_requirements`

```text
id UUID PK
case_id UUID NOT NULL
approval_key VARCHAR NOT NULL
approval_stage VARCHAR NOT NULL
role VARCHAR NOT NULL
scope_context JSONB NOT NULL
reason JSONB NOT NULL
required BOOLEAN NOT NULL
sequence_or_parallel JSONB NOT NULL
conditions JSONB NOT NULL
deadline TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, approval_key)
```

## 69.42 `change_approvals`

```text
id UUID PK
approval_requirement_id UUID NOT NULL
approver_id UUID NOT NULL
decision VARCHAR NOT NULL
conditions JSONB NOT NULL
comment TEXT NULL
evidence_refs JSONB NOT NULL
signed_payload_hash CHAR(64) NOT NULL
signed_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ NULL
revoked_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 69.43 `change_packages`

```text
id UUID PK
case_id UUID NOT NULL
package_type VARCHAR NOT NULL
package_number VARCHAR NOT NULL
package_version INT NOT NULL
source_baseline_id UUID NOT NULL
target_baseline_candidate_ref JSONB NOT NULL
problem_summary JSONB NOT NULL
change_summary JSONB NOT NULL
diff_summary JSONB NOT NULL
impact_summary JSONB NOT NULL
effectivity_summary JSONB NOT NULL
disposition_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
approval_manifest JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(package_type, package_number, package_version)
```

## 69.44 `change_implementation_work_packages`

```text
id UUID PK
case_id UUID NOT NULL
work_package_key VARCHAR NOT NULL
target_agent VARCHAR NULL
target_system VARCHAR NULL
target_object_refs JSONB NOT NULL
change_instruction JSONB NOT NULL
source_baseline_refs JSONB NOT NULL
target_baseline_candidate_refs JSONB NOT NULL
dependencies JSONB NOT NULL
owner_role VARCHAR NOT NULL
owner_id UUID NULL
estimate_candidate JSONB NULL
input_gate JSONB NOT NULL
expected_output JSONB NOT NULL
verification_requirement JSONB NOT NULL
rollback_plan JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, work_package_key)
```

## 69.45 `change_implementation_runs`

```text
id UUID PK
work_package_id UUID NOT NULL
run_version INT NOT NULL
executor_type VARCHAR NOT NULL
executor_ref JSONB NOT NULL
pre_state_hash CHAR(64) NOT NULL
execution_request JSONB NOT NULL
preview_artifact_refs JSONB NOT NULL
approval_refs JSONB NOT NULL
external_transaction_ref JSONB NULL
post_state_hash CHAR(64) NULL
readback_artifact_refs JSONB NOT NULL
result JSONB NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 69.46 `change_readback_runs`

```text
id UUID PK
case_id UUID NOT NULL
readback_version INT NOT NULL
implementation_run_ids JSONB NOT NULL
source_baseline_refs JSONB NOT NULL
actual_target_snapshot_refs JSONB NOT NULL
expected_change_set_id UUID NOT NULL
actual_diff_run_id UUID NOT NULL
unplanned_differences JSONB NOT NULL
missing_differences JSONB NOT NULL
result VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 69.47 `change_verification_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
requirement_verification JSONB NOT NULL
design_verification JSONB NOT NULL
firmware_verification JSONB NOT NULL
interface_verification JSONB NOT NULL
manufacturing_verification JSONB NOT NULL
test_program_verification JSONB NOT NULL
inventory_disposition_verification JSONB NOT NULL
documentation_verification JSONB NOT NULL
regression_scope JSONB NOT NULL
sample_plan JSONB NOT NULL
environment_plan JSONB NOT NULL
owner_roles JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.48 `change_verification_runs`

```text
id UUID PK
verification_plan_id UUID NOT NULL
run_version INT NOT NULL
baseline_context JSONB NOT NULL
sample_context JSONB NOT NULL
test_result_refs JSONB NOT NULL
agent_result_refs JSONB NOT NULL
evidence_refs JSONB NOT NULL
new_findings JSONB NOT NULL
result VARCHAR NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 69.49 `change_release_records`

```text
id UUID PK
case_id UUID NOT NULL
release_key VARCHAR NOT NULL
release_type VARCHAR NOT NULL
released_baseline_id UUID NOT NULL
effectivity_plan_id UUID NOT NULL
change_package_ids JSONB NOT NULL
verification_run_ids JSONB NOT NULL
approval_refs JSONB NOT NULL
release_manifest_uri TEXT NOT NULL
release_manifest_hash CHAR(64) NOT NULL
released_by UUID NOT NULL
released_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
UNIQUE(case_id, release_key)
```

## 69.50 `change_notification_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
internal_audiences JSONB NOT NULL
supplier_audiences JSONB NOT NULL
factory_audiences JSONB NOT NULL
customer_audiences JSONB NOT NULL
service_audiences JSONB NOT NULL
regulatory_audiences JSONB NOT NULL
message_templates JSONB NOT NULL
timing_policy JSONB NOT NULL
confidentiality_policy JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.51 `change_notification_records`

```text
id UUID PK
notification_plan_id UUID NOT NULL
notification_key VARCHAR NOT NULL
audience_type VARCHAR NOT NULL
recipient_scope JSONB NOT NULL
channel VARCHAR NOT NULL
message_artifact_ref JSONB NOT NULL
approval_refs JSONB NOT NULL
sent_at TIMESTAMPTZ NULL
delivery_status JSONB NOT NULL
acknowledgement_status JSONB NOT NULL
external_reference JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(notification_plan_id, notification_key)
```

## 69.52 `effectiveness_review_plans`

```text
id UUID PK
case_id UUID NOT NULL
plan_version INT NOT NULL
review_windows JSONB NOT NULL
metric_definitions JSONB NOT NULL
baseline_metrics JSONB NOT NULL
target_metrics JSONB NOT NULL
data_sources JSONB NOT NULL
owner_roles JSONB NOT NULL
reopen_rules JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, plan_version)
```

## 69.53 `effectiveness_review_runs`

```text
id UUID PK
effectiveness_plan_id UUID NOT NULL
run_version INT NOT NULL
review_window JSONB NOT NULL
metric_results JSONB NOT NULL
recurrence_findings JSONB NOT NULL
side_effect_findings JSONB NOT NULL
scope_expansion_candidate JSONB NOT NULL
result VARCHAR NOT NULL
reviewed_by UUID NULL
reviewed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 69.54 `knowledge_writeback_candidates`

```text
id UUID PK
case_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
candidate_type VARCHAR NOT NULL
title VARCHAR NOT NULL
applicability_scope JSONB NOT NULL
source_problem_refs JSONB NOT NULL
root_cause_refs JSONB NOT NULL
evidence_refs JSONB NOT NULL
recommended_content JSONB NOT NULL
target_registry VARCHAR NOT NULL
target_agent VARCHAR NULL
privacy_review JSONB NOT NULL
owner_role VARCHAR NOT NULL
review_date DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, candidate_key)
```

## 69.55 `knowledge_writeback_records`

```text
id UUID PK
candidate_id UUID NOT NULL
target_system VARCHAR NOT NULL
target_object_ref JSONB NOT NULL
published_version JSONB NOT NULL
published_hash CHAR(64) NOT NULL
approval_refs JSONB NOT NULL
published_by UUID NOT NULL
published_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 69.56 `case_closure_records`

```text
id UUID PK
case_id UUID NOT NULL
closure_version INT NOT NULL
problem_disposition JSONB NOT NULL
containment_disposition JSONB NOT NULL
root_cause_disposition JSONB NOT NULL
change_disposition JSONB NOT NULL
inventory_wip_disposition JSONB NOT NULL
verification_disposition JSONB NOT NULL
notification_disposition JSONB NOT NULL
effectiveness_disposition JSONB NOT NULL
knowledge_disposition JSONB NOT NULL
unresolved_items JSONB NOT NULL
accepted_risks JSONB NOT NULL
closure_gate_results JSONB NOT NULL
approval_manifest JSONB NOT NULL
status VARCHAR NOT NULL
closed_by UUID NULL
closed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(case_id, closure_version)
```

## 69.57 `case_recurrence_links`

```text
id UUID PK
source_case_id UUID NOT NULL
recurring_case_id UUID NOT NULL
signature_context JSONB NOT NULL
shared_root_cause_candidates JSONB NOT NULL
shared_configuration_scope JSONB NOT NULL
effectiveness_invalidated BOOLEAN NOT NULL
escalation_action JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(source_case_id, recurring_case_id)
```

## 69.58 `change_case_audit_events`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
case_id UUID NOT NULL
actor_id UUID NULL
actor_type VARCHAR NOT NULL
action VARCHAR NOT NULL
stage VARCHAR NULL
object_type VARCHAR NOT NULL
object_id UUID NULL
before_hash CHAR(64) NULL
after_hash CHAR(64) NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

---

# 70. 对象存储

```text
derived/change-closure/
  {tenant_id}/{project_id}/
    cases/
      {case_id}/
        intake/
          intake-snapshot.json
          source-events.jsonl.zst
          attachments/
          triage/
        problem/
          statements/
          is-is-not/
          evidence/
        containment/
          plans/
          requests/
          executions/
        reproduction/
          contracts/
          runs/
          labsight-links/
        root-cause/
          graphs/
          five-why/
          fishbone/
          fault-tree/
          escape-point/
          evidence/
        pdca/
        8d/
        baselines/
          source/
          target-candidates/
          manifests/
        diff/
          files/
          metadata/
          semantic/
          geometry/
          bom/
          firmware/
          process/
          test/
          mapping-loss/
        impact/
          graph/
          findings/
          compatibility-matrix/
        traceability/
          inventory/
          wip/
          in-transit/
          delivered/
          lots/
          serials/
          queries/
        disposition/
          plans/
          instructions/
          executions/
          evidence/
        alternatives/
          comparisons/
          decision/
        effectivity/
          plans/
          transition/
          labeling/
        change-packages/
          ecr/
          ecn/
          eco/
          deviation/
          waiver/
          capa/
          8d/
        approvals/
          requirements/
          signatures/
          conditions/
        implementation/
          work-packages/
          previews/
          executions/
          readback/
          rollback/
        verification/
          plans/
          runs/
          regression/
          evidence/
        release/
          manifests/
          published-baselines/
        notifications/
          internal/
          supplier/
          factory/
          customer/
          service/
          acknowledgements/
        effectiveness/
          plans/
          metric-snapshots/
          reviews/
          recurrence/
        knowledge/
          candidates/
          reviews/
          publications/
        closure/
          closure-record.json
          final-report.html
          final-report.pdf
          audit-export.jsonl.zst
        privacy/
          redactions/
          exports/
        debug/
          provider-traces/
          rule-traces/
          graph-traces/
          model-traces/
          resource-usage.json
```

---

# 71. API 设计

## 71.1 Cases

```text
POST /api/v1/change-cases
GET  /api/v1/change-cases
GET  /api/v1/change-cases/{id}
PATCH /api/v1/change-cases/{id}
POST /api/v1/change-cases/{id}/cancel
POST /api/v1/change-cases/{id}/reopen
POST /api/v1/change-cases/{id}/link-duplicate
GET  /api/v1/change-cases/{id}/timeline
```

## 71.2 Intake and Triage

```text
POST /api/v1/change-cases/{id}/freeze-intake
GET  /api/v1/change-cases/{id}/intake-snapshot
POST /api/v1/change-cases/{id}/triage
GET  /api/v1/change-cases/{id}/classification
POST /api/v1/change-cases/{id}/classify
POST /api/v1/change-cases/{id}/assign-owner
```

## 71.3 Problem and Evidence

```text
POST /api/v1/change-cases/{id}/problem-statements
GET  /api/v1/change-cases/{id}/problem-statements
POST /api/v1/change-cases/{id}/evidence
GET  /api/v1/change-cases/{id}/evidence
POST /api/v1/change-cases/{id}/evidence/validate
```

## 71.4 Containment

```text
POST /api/v1/change-cases/{id}/containment-plans
GET  /api/v1/change-cases/{id}/containment-plans
POST /api/v1/containment-plans/{id}/approve
POST /api/v1/containment-plans/{id}/action-requests
POST /api/v1/containment-actions/{id}/execute
POST /api/v1/containment-actions/{id}/release
```

## 71.5 Reproduction and LabSight

```text
POST /api/v1/change-cases/{id}/reproduction-contracts
GET  /api/v1/change-cases/{id}/reproduction-contracts
POST /api/v1/reproduction-contracts/{id}/run
POST /api/v1/change-cases/{id}/labsight-session
GET  /api/v1/change-cases/{id}/reproduction-runs
```

## 71.6 Root Cause

```text
POST /api/v1/change-cases/{id}/root-cause-runs
GET  /api/v1/change-cases/{id}/root-cause-runs
GET  /api/v1/root-cause-runs/{id}/graph
POST /api/v1/root-cause-runs/{id}/five-why
POST /api/v1/root-cause-runs/{id}/fishbone
POST /api/v1/root-cause-runs/{id}/escape-points
POST /api/v1/root-cause-nodes/{id}/support
POST /api/v1/root-cause-nodes/{id}/reject
POST /api/v1/root-cause-nodes/{id}/verify
```

## 71.7 PDCA and 8D

```text
POST /api/v1/change-cases/{id}/pdca
GET  /api/v1/change-cases/{id}/pdca
POST /api/v1/change-cases/{id}/8d
GET  /api/v1/change-cases/{id}/8d
POST /api/v1/eight-d/{id}/advance
POST /api/v1/eight-d/{id}/approve-stage
```

## 71.8 Configuration and Baselines

```text
GET  /api/v1/configuration-items
GET  /api/v1/configuration-items/{id}
GET  /api/v1/configuration-items/{id}/versions
POST /api/v1/configuration-baselines
GET  /api/v1/projects/{project_id}/configuration-baselines
GET  /api/v1/configuration-baselines/{id}
POST /api/v1/change-cases/{id}/baseline-pairs
```

## 71.9 Diff

```text
POST /api/v1/change-cases/{id}/diff-runs
GET  /api/v1/change-cases/{id}/diff-runs
GET  /api/v1/change-diffs/{id}
GET  /api/v1/change-diffs/{id}/objects
POST /api/v1/change-diffs/{id}/review
POST /api/v1/change-cases/{id}/change-sets
GET  /api/v1/change-cases/{id}/change-sets
```

## 71.10 Impact Graph

```text
POST /api/v1/change-cases/{id}/impact-graphs
GET  /api/v1/change-cases/{id}/impact-graphs
GET  /api/v1/impact-graphs/{id}
GET  /api/v1/change-cases/{id}/impact-findings
POST /api/v1/change-cases/{id}/compatibility-matrix
GET  /api/v1/change-cases/{id}/compatibility-matrix
```

## 71.11 Inventory, WIP and Traceability

```text
POST /api/v1/change-cases/{id}/impact/inventory/refresh
POST /api/v1/change-cases/{id}/impact/wip/refresh
POST /api/v1/change-cases/{id}/impact/in-transit/refresh
POST /api/v1/change-cases/{id}/impact/delivered/refresh
GET  /api/v1/change-cases/{id}/impact/inventory
GET  /api/v1/change-cases/{id}/impact/wip
GET  /api/v1/change-cases/{id}/impact/in-transit
GET  /api/v1/change-cases/{id}/impact/delivered
POST /api/v1/change-cases/{id}/traceability-queries
GET  /api/v1/change-cases/{id}/traceability-queries
```

## 71.12 Disposition and Effectivity

```text
POST /api/v1/change-cases/{id}/disposition-plans
GET  /api/v1/change-cases/{id}/disposition-plans
POST /api/v1/disposition-plans/{id}/approve
POST /api/v1/disposition-actions/{id}/execute
POST /api/v1/change-cases/{id}/effectivity-plans
GET  /api/v1/change-cases/{id}/effectivity-plans
POST /api/v1/effectivity-plans/{id}/approve
```

## 71.13 Alternatives and Decision

```text
POST /api/v1/change-cases/{id}/alternatives
GET  /api/v1/change-cases/{id}/alternatives
POST /api/v1/change-cases/{id}/decision
GET  /api/v1/change-cases/{id}/decision
```

## 71.14 Approvals

```text
POST /api/v1/change-cases/{id}/approval-requirements
GET  /api/v1/change-cases/{id}/approval-requirements
POST /api/v1/approval-requirements/{id}/approve
POST /api/v1/approval-requirements/{id}/reject
POST /api/v1/approvals/{id}/revoke
GET  /api/v1/change-cases/{id}/approvals
```

## 71.15 Change Packages

```text
POST /api/v1/change-cases/{id}/packages/ecr
POST /api/v1/change-cases/{id}/packages/ecn
POST /api/v1/change-cases/{id}/packages/eco
POST /api/v1/change-cases/{id}/packages/deviation
POST /api/v1/change-cases/{id}/packages/waiver
GET  /api/v1/change-cases/{id}/packages
GET  /api/v1/change-packages/{id}
```

## 71.16 Implementation

```text
POST /api/v1/change-cases/{id}/work-packages
GET  /api/v1/change-cases/{id}/work-packages
POST /api/v1/change-work-packages/{id}/start
POST /api/v1/change-work-packages/{id}/preview
POST /api/v1/change-work-packages/{id}/execute
POST /api/v1/change-work-packages/{id}/readback
POST /api/v1/change-work-packages/{id}/rollback
GET  /api/v1/change-cases/{id}/implementation-status
```

## 71.17 Verification and Release

```text
POST /api/v1/change-cases/{id}/verification-plans
GET  /api/v1/change-cases/{id}/verification-plans
POST /api/v1/change-verification-plans/{id}/run
GET  /api/v1/change-cases/{id}/verification-runs
POST /api/v1/change-cases/{id}/release
GET  /api/v1/change-cases/{id}/release
```

## 71.18 Notifications

```text
POST /api/v1/change-cases/{id}/notification-plans
GET  /api/v1/change-cases/{id}/notification-plans
POST /api/v1/change-notification-plans/{id}/approve
POST /api/v1/change-notification-plans/{id}/send
GET  /api/v1/change-cases/{id}/notifications
```

## 71.19 Effectiveness and Knowledge

```text
POST /api/v1/change-cases/{id}/effectiveness-plans
GET  /api/v1/change-cases/{id}/effectiveness-plans
POST /api/v1/effectiveness-plans/{id}/run
GET  /api/v1/change-cases/{id}/effectiveness-runs
POST /api/v1/change-cases/{id}/knowledge-candidates
GET  /api/v1/change-cases/{id}/knowledge-candidates
POST /api/v1/knowledge-candidates/{id}/approve
POST /api/v1/knowledge-candidates/{id}/publish
```

## 71.20 Closure

```text
POST /api/v1/change-cases/{id}/validate-closure
GET  /api/v1/change-cases/{id}/closure-gate
POST /api/v1/change-cases/{id}/close
GET  /api/v1/change-cases/{id}/closure-record
GET  /api/v1/change-cases/{id}/report
GET  /api/v1/change-cases/{id}/audit-export
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 72. 输入事件

```text
requirements.change-requested
architecture.change-candidate-ready
reference-reuse.change-impact-ready
component-selection.change-impact-ready
compatibility.change-impact-ready
eda.change-detected
firmware.change-detected
design-review.issue-opened
simulation.failure-detected
pcb.review-finding-opened
manufacturing-release.changed
dfm.finding-opened
component.pcn-received
component.pdn-received
inventory.shortage-detected
supplier.nonconformance-opened
incoming-test.failure-detected
production-test.failure-detected
field-return.received
customer-complaint.received
labsight.root-cause-candidate-ready
labsight.root-cause-verified
audit.finding-opened
change-case.requested
```

---

# 73. 输出事件

```text
change-case.created
change-case.triaged
change-case.containment-required
change-case.stop-build-candidate
change-case.stop-ship-candidate
change-case.reproduction-required
change-case.root-cause-review-required
change-case.change-required
change-case.diff-ready
change-case.impact-ready
change-case.disposition-required
change-case.approval-required
change-case.eco-approved
change-case.implementation-ready
change-case.readback-failed
change-case.verification-required
change-case.release-ready
change-case.effectivity-released
change-case.notification-required
change-case.effectiveness-review-required
change-case.knowledge-candidate-ready
change-case.reopened
change-case.closed
change-case.failed
```

---

# 74. 下游事件

```text
project-planning.change-work-packages-ready
requirements.baseline-change-candidate
architecture.change-package-ready
component-selection.reselection-required
compatibility.recheck-required
eda.controlled-change-required
firmware.change-package-ready
design-review.regression-required
pcb.regression-required
manufacturing.release-regeneration-required
inventory.disposition-requested
wip.disposition-requested
supplier.corrective-action-requested
quality.capa-required
customer.notification-candidate
knowledge.rule-update-candidate
```

---

# 75. Policy 组织

```text
policies/
├── engineering-change-1.0.0.yaml
├── issue-closure-1.0.0.yaml
├── readiness-gates.yaml
├── classification/
│   ├── case-types.yaml
│   ├── change-classes.yaml
│   ├── urgency.yaml
│   └── workflow-selection.yaml
├── containment/
│   ├── stop-build.yaml
│   ├── stop-ship.yaml
│   ├── inventory-hold.yaml
│   ├── wip-hold.yaml
│   └── exit-criteria.yaml
├── reproduction/
│   ├── contracts.yaml
│   ├── evidence.yaml
│   └── repeatability.yaml
├── root-cause/
│   ├── five-why.yaml
│   ├── fishbone.yaml
│   ├── fault-tree.yaml
│   ├── verification.yaml
│   └── escape-point.yaml
├── pdca/
├── eight-d/
├── configuration/
│   ├── item-types.yaml
│   ├── baselines.yaml
│   ├── revisions.yaml
│   ├── lifecycle.yaml
│   └── compatibility.yaml
├── diff/
│   ├── file.yaml
│   ├── metadata.yaml
│   ├── semantic.yaml
│   ├── geometry.yaml
│   ├── bom.yaml
│   ├── firmware.yaml
│   ├── process.yaml
│   └── test.yaml
├── impact/
│   ├── graph-rules.yaml
│   ├── design.yaml
│   ├── manufacturing.yaml
│   ├── supply.yaml
│   ├── field.yaml
│   └── regulatory.yaml
├── traceability/
│   ├── inventory.yaml
│   ├── wip.yaml
│   ├── in-transit.yaml
│   ├── delivered.yaml
│   └── freshness.yaml
├── disposition/
│   ├── types.yaml
│   ├── approvals.yaml
│   ├── instructions.yaml
│   └── verification.yaml
├── effectivity/
│   ├── types.yaml
│   ├── transition.yaml
│   ├── mixed-build.yaml
│   └── interchangeability.yaml
├── alternatives/
│   ├── evaluation.yaml
│   ├── cost.yaml
│   └── risk.yaml
├── approvals/
│   ├── matrix.yaml
│   ├── signatures.yaml
│   ├── expiry.yaml
│   └── segregation-of-duties.yaml
├── implementation/
│   ├── work-packages.yaml
│   ├── preview.yaml
│   ├── readback.yaml
│   └── rollback.yaml
├── verification/
│   ├── regression.yaml
│   ├── samples.yaml
│   └── release-gates.yaml
├── notifications/
│   ├── internal.yaml
│   ├── supplier.yaml
│   ├── customer.yaml
│   └── confidentiality.yaml
├── effectiveness/
│   ├── windows.yaml
│   ├── metrics.yaml
│   └── reopen.yaml
├── knowledge/
│   ├── targets.yaml
│   ├── privacy.yaml
│   └── review.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 76. Provider 接口

## 76.1 Configuration Provider

```python
class ConfigurationProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def list_items(self, scope) -> ConfigurationItemSet: ...
    async def get_version(self, item_ref, version_ref) -> ConfigurationItemVersion: ...
    async def freeze_baseline(self, request) -> BaselineSnapshot: ...
    async def compare(self, source, target, diff_types) -> DiffResult: ...
```

## 76.2 Traceability Provider

```python
class TraceabilityProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def query_inventory(self, request) -> InventoryImpactSnapshot: ...
    async def query_wip(self, request) -> WIPImpactSnapshot: ...
    async def query_in_transit(self, request) -> InTransitImpactSnapshot: ...
    async def query_delivered(self, request) -> DeliveredImpactSnapshot: ...
    async def trace(self, request) -> TraceabilityResult: ...
```

## 76.3 Execution Provider

```python
class ChangeExecutionProvider:
    async def validate(self, work_package) -> ValidationResult: ...
    async def preview(self, work_package) -> PreviewResult: ...
    async def execute(self, approved_package) -> ExecutionResult: ...
    async def readback(self, execution) -> ReadbackResult: ...
    async def rollback(self, execution) -> RollbackResult: ...
```

## 76.4 Approval Provider

```python
class ApprovalProvider:
    async def build_requirements(self, case_context) -> ApprovalRequirementSet: ...
    async def record_decision(self, signed_decision) -> ApprovalRecord: ...
    async def validate_gate(self, case_id, gate) -> GateResult: ...
```

## 76.5 Root Cause Provider

```python
class RootCauseProvider:
    async def build_candidates(self, context) -> RootCauseCandidateSet: ...
    async def update_with_evidence(self, graph, evidence) -> RootCauseGraph: ...
    async def validate_verification(self, root_cause) -> VerificationResult: ...
```

AI Provider 仅用于候选和解释，不能改变 Verification Status。

---

# 77. Diff Provider Admission

每个 Diff Provider 必须声明：

```text
supported item types
supported schema versions
semantic coverage
mapping loss behavior
determinism
read-only guarantee
resource limits
security class
```

未通过 Admission 的 Provider 只能用于辅助展示。

---

# 78. Change Orchestrator

核心编排：

```python
class EngineeringChangeOrchestrator:
    async def triage(self, case_id) -> TriageResult: ...
    async def start_containment(self, case_id) -> ContainmentPlan: ...
    async def coordinate_reproduction(self, case_id) -> ReproductionContract: ...
    async def coordinate_root_cause(self, case_id) -> RootCauseAnalysis: ...
    async def build_change_set(self, case_id) -> ChangeSet: ...
    async def build_impact(self, case_id) -> ImpactGraph: ...
    async def build_disposition(self, case_id) -> DispositionPlan: ...
    async def build_approvals(self, case_id) -> ApprovalMatrix: ...
    async def coordinate_implementation(self, case_id) -> ImplementationStatus: ...
    async def coordinate_verification(self, case_id) -> VerificationStatus: ...
    async def release(self, case_id) -> ReleaseRecord: ...
    async def close(self, case_id) -> ClosureRecord: ...
```

---

# 79. Review Workbench

页面结构：

```text
左侧：
- Case
- Workflow
- Problem
- Containment
- Root Cause
- Change Set
- Impact
- Disposition
- Approvals
- Implementation
- Verification
- Closure

中间：
- Evidence Timeline
- Root Cause Graph
- Baseline Diff
- Impact Graph
- Configuration Matrix
- Inventory/WIP Map
- Effectivity Timeline

右侧：
- Current Gate
- Owners
- Risks
- Open Questions
- Approvals
- Notifications
- Knowledge Candidates

底部：
- Work Packages
- Execution Readback
- Regression
- Metrics
- Audit
```

---

# 80. 可观测性

```text
change_cases_total{type,status,class,urgency}
change_case_duration_seconds{stage}
change_containment_actions_total{type,status}
change_reproduction_runs_total{result}
change_root_causes_total{status,level}
change_diff_objects_total{type,change_type}
change_impact_findings_total{type,level,status}
change_inventory_affected_quantity{disposition}
change_wip_affected_quantity{operation,disposition}
change_approval_cycle_seconds{stage,role}
change_implementation_runs_total{target,status}
change_readback_failures_total{target}
change_verification_runs_total{result}
change_effectiveness_reviews_total{result}
change_recurrence_total{signature}
change_knowledge_writebacks_total{type,status}
change_cases_reopened_total{reason}
```

---

# 81. Dashboard

```text
Open Changes
Open Problems
Emergency Containment
Stop-build / Stop-ship Candidates
Root Cause Pending
ECN/ECO Approval
Affected Inventory Value
Affected WIP Quantity
In-transit Exposure
Delivered Product Exposure
Pending Dispositions
Effectivity Timeline
Implementation Progress
Verification Failures
Effectiveness Reviews
Recurring Problems
Supplier Actions
Customer Notifications
Knowledge Writeback
Cycle Time and Bottlenecks
```

---

# 82. 安全、权限与审计

- ECR 提出、ECO 批准、执行、验证和关闭角色分离；
- Critical Change 不允许提交人与最终批准人为同一人；
- Safety/Regulatory/Customer-visible Change 需要专门角色；
- 库存冻结、报废、返工、释放和客户召回必须使用外部系统授权；
- Agent 47 不能直接修改库存数量和 WIP 状态；
- Agent 47 不直接发客户通知，必须经过审批；
- 所有正式 Package 使用不可变 Manifest 和 Hash；
- Approval 使用签名 Payload，后续内容变化使原审批失效；
- Baseline、Revision、Change Package、Disposition 和 Closure 不可硬删除；
- 所有 Diff Provider 在隔离只读环境运行；
- 上传的 EDA、Firmware、Office、压缩包和供应商文件均视为不可信输入；
- 防止 Macro、Script、Formula、XML Entity、Path Traversal 和 Prompt Injection；
- 外部模型只接收最小、脱敏和证据引用上下文；
- 客户、供应商、成本、库存、Lot、Serial 和质量数据按租户与项目隔离；
- Knowledge Writeback 前必须做 Privacy、Confidentiality 和 Applicability Review；
- 公开 Fixture 只使用开源、合成、脱敏或授权数据；
- 审计记录覆盖：创建、分类、审批、执行、回读、发布、通知、关闭和重开。

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

图与数据：

```text
PostgreSQL typed graph first
NetworkX for in-process analysis
Polars
PyArrow
DuckDB
Decimal
```

Diff：

```text
structured JSON diff
EDA semantic adapters
BOM/CSV/Parquet diff
Git diff adapters
binary manifest diff
geometry summary adapters
```

集成：

```text
PLM connector
ERP connector
WMS connector
MES connector
QMS connector
CRM/service connector
supplier portal connector
```

前端：

```text
React
TypeScript
Root Cause Graph
Semantic Diff Viewer
Impact Graph
Inventory/WIP Disposition Grid
Effectivity Timeline
Approval Workbench
Closure Dashboard
```

---

# 84. 推荐仓库结构

```text
engineering-change-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── engineering-change-agent-spec.md
│   ├── intake-and-classification.md
│   ├── containment-and-reproduction.md
│   ├── root-cause-and-escape-point.md
│   ├── pdca-and-eight-d.md
│   ├── configuration-items-and-baselines.md
│   ├── semantic-diff.md
│   ├── impact-graph.md
│   ├── inventory-wip-and-traceability.md
│   ├── disposition-and-effectivity.md
│   ├── approvals-and-change-packages.md
│   ├── implementation-and-readback.md
│   ├── verification-and-release.md
│   ├── effectiveness-and-recurrence.md
│   ├── knowledge-writeback.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-problem-closure-is-not-ticket-closure.md
│       ├── 0002-baselines-and-effectivity-are-mandatory.md
│       ├── 0003-semantic-diff-precedes-impact-analysis.md
│       ├── 0004-disposition-is-an-executable-contract.md
│       ├── 0005-approval-invalidates-on-content-change.md
│       ├── 0006-ai-does-not-approve-or-close.md
│       └── 0007-old-revisions-remain-immutable.md
├── src/
│   └── engineering_change/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── intake/
│       │   ├── snapshots.py
│       │   ├── classification.py
│       │   ├── triage.py
│       │   └── duplicates.py
│       ├── problem/
│       │   ├── statements.py
│       │   ├── is_is_not.py
│       │   └── evidence.py
│       ├── containment/
│       │   ├── plans.py
│       │   ├── actions.py
│       │   ├── gates.py
│       │   └── release.py
│       ├── reproduction/
│       │   ├── contracts.py
│       │   ├── runs.py
│       │   └── labsight.py
│       ├── root_cause/
│       │   ├── graph.py
│       │   ├── five_why.py
│       │   ├── fishbone.py
│       │   ├── fault_tree.py
│       │   ├── change_point.py
│       │   ├── escape_point.py
│       │   └── verification.py
│       ├── pdca/
│       ├── eight_d/
│       ├── configuration/
│       │   ├── registry.py
│       │   ├── versions.py
│       │   ├── baselines.py
│       │   ├── compatibility.py
│       │   └── manifests.py
│       ├── diff/
│       │   ├── providers.py
│       │   ├── files.py
│       │   ├── metadata.py
│       │   ├── semantic.py
│       │   ├── geometry.py
│       │   ├── bom.py
│       │   ├── firmware.py
│       │   ├── process.py
│       │   └── tests.py
│       ├── impact/
│       │   ├── graph.py
│       │   ├── propagation.py
│       │   ├── findings.py
│       │   ├── matrices.py
│       │   └── explain.py
│       ├── traceability/
│       │   ├── providers.py
│       │   ├── inventory.py
│       │   ├── wip.py
│       │   ├── in_transit.py
│       │   ├── delivered.py
│       │   ├── lots.py
│       │   └── serials.py
│       ├── disposition/
│       │   ├── plans.py
│       │   ├── actions.py
│       │   ├── instructions.py
│       │   └── verification.py
│       ├── effectivity/
│       │   ├── plans.py
│       │   ├── transition.py
│       │   ├── interchangeability.py
│       │   └── labeling.py
│       ├── alternatives/
│       │   ├── candidates.py
│       │   ├── evaluation.py
│       │   ├── cost.py
│       │   └── decision.py
│       ├── approvals/
│       │   ├── requirements.py
│       │   ├── matrix.py
│       │   ├── signatures.py
│       │   └── gates.py
│       ├── packages/
│       │   ├── ecr.py
│       │   ├── ecn.py
│       │   ├── eco.py
│       │   ├── deviation.py
│       │   ├── waiver.py
│       │   └── reports.py
│       ├── implementation/
│       │   ├── work_packages.py
│       │   ├── providers.py
│       │   ├── previews.py
│       │   ├── executions.py
│       │   ├── readback.py
│       │   └── rollback.py
│       ├── verification/
│       │   ├── plans.py
│       │   ├── runs.py
│       │   ├── regression.py
│       │   └── gates.py
│       ├── release/
│       ├── notifications/
│       ├── effectiveness/
│       ├── recurrence/
│       ├── knowledge/
│       ├── closure/
│       ├── adapters/
│       │   ├── agent10_15.py
│       │   ├── agent16_30.py
│       │   ├── agent31_45.py
│       │   ├── agent46.py
│       │   ├── plm.py
│       │   ├── erp.py
│       │   ├── wms.py
│       │   ├── mes.py
│       │   ├── qms.py
│       │   └── crm.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── workflow-profiles/
├── diff-profiles/
├── integration-profiles/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_change_management_readiness.py
    ├── build_configuration_baseline.py
    ├── run_semantic_diff.py
    ├── build_change_impact_graph.py
    ├── query_inventory_wip_impact.py
    ├── generate_change_package.py
    ├── validate_change_closure.py
    └── run_change_management_benchmark.py
```


---

# 85. Codex 分阶段实施

不要让 Codex 一次实现 ECR/ECN/ECO、配置管理、EDA/BOM/Firmware Diff、库存和 WIP 追溯、8D、审批、Effectivity、外部系统写入和知识闭环。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. 当前 Agent 10–47 的规格、数据契约、事件和 Baseline；
2. 当前 ezPLM 项目、文档、物料、BOM、版本、审批、问题、任务和知识数据；
3. 当前 ECR、ECN、ECO、Deviation、Waiver、NCR、CAPA、CAR、SCAR、MRB、8D 和 PDCA 流程；
4. 当前产品、板卡、总成、Firmware、BOM、MBOM、工艺、测试和文档版本模型；
5. 当前 Revision、Version、Variant、Status、Baseline、Effectivity 和 Compatibility；
6. 当前 Agent 16/18/20 的 EDA Canonical IR、Netlist、Library 和 Source Map；
7. 当前 Agent 21 Firmware Source、Binary、Build、Config 和 Compatibility；
8. 当前 Agent 29 Manufacturing Release 和 Manifest；
9. 当前 Agent 31–45 的 BOM、Inventory、Lot、WIP、Work Order、Test 和 Quality 数据；
10. 当前 Agent 46 Debug Session、Evidence、Root Cause 和 Regression；
11. 当前 Git、对象存储、文件版本、数据库记录和外部系统版本；
12. 当前 PDF、CSV、XLSX、KiCad、Gerber、BOM、Firmware 和工艺 Diff 能力；
13. 当前 PLM/ERP/WMS/MES/QMS/CRM/供应商 Portal Connector；
14. 当前库存冻结、WIP Hold、返工、报废、放行、采购和通知的权限边界；
15. 当前 Traceability：Lot、Serial、Work Order、Purchase Order、Shipment 和 Customer；
16. 当前 Configuration Compatibility Matrix；
17. 当前 Effectivity 和混线生产规则；
18. 当前 Approval Matrix、电子签名、条件审批、失效和撤销；
19. 当前 Release、通知、培训和服务文档流程；
20. 当前 Knowledge Base、规则库、Checklist、Test Case 和 Fault Signature 回写；
21. 当前 Metrics、Cycle Time、Recurrence 和 Effectiveness Review；
22. 当前 Security、Tenant Isolation、Audit、Retention 和 Privacy；
23. 当前开源、合成、脱敏或授权 Fixture；
24. 统计问题关闭但无 Root Cause 的比例；
25. 统计 ECN/ECO 缺 Effectivity 的比例；
26. 统计变更后 BOM、Firmware、生产文件和测试未同步的比例；
27. 统计受影响库存、WIP、在途和交付产品无法追溯的比例；
28. 统计 Deviation/Waiver 超期情况；
29. 统计变更实施后 Readback 不一致；
30. 统计问题复发、重新打开和 8D 无效果情况；
31. 统计审批周期、等待角色和瓶颈；
32. 只运行只读扫描、安全 API 查询和公开 Fixture；
33. 不修改生产 Baseline；
34. 不创建正式 ECN/ECO；
35. 不冻结库存和 WIP；
36. 不执行报废、返工、释放、召回、采购或客户通知；
37. 不创建数据库 Migration；
38. 不安装 Diff、Graph、Connector 或模型组件；
39. 不调用生产外部模型；
40. 不读取或打印 Secret、客户、供应商、成本、库存和序列数据。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Case；
- Intake Snapshot；
- Workflow Profile；
- Classification；
- Problem Statement；
- Containment；
- Reproduction；
- Evidence；
- Root Cause；
- 5 Why/Fishbone/Escape Point；
- PDCA/8D；
- Configuration Item/Version/Baseline；
- Baseline Pair；
- Diff Run/Object；
- Change Set；
- Impact Graph/Finding；
- Compatibility Matrix；
- Inventory/WIP/In-transit/Delivered Snapshot；
- Traceability Query；
- Disposition；
- Effectivity；
- Alternative/Decision；
- Approval；
- Change Package；
- Work Package/Implementation/Readback；
- Verification/Release；
- Notification；
- Effectiveness；
- Knowledge；
- Closure；
- Recurrence；
- Audit；
- JSON Schema。

## Phase 2：Case Intake and Immutable Snapshot

实现：

- Trigger Sources；
- Case Key；
- Problem/Change Candidate；
- Evidence References；
- Initial Scope；
- Urgency；
- Safety/Customer/Regulatory Candidate；
- Duplicate Candidate；
- Immutable Intake Snapshot；
- Diagnostics；
- ACL。

## Phase 3：Workflow Profile Registry

实现：

- Case Types；
- Product/Site Scope；
- Triage；
- Containment；
- Root Cause；
- Change Class；
- Impact；
- Approval；
- Effectivity；
- Closure；
- Knowledge；
- Version/Effective Date；
- Approval/Deprecation。

## Phase 4：Triage and Classification

实现：

- Problem vs Change；
- Workflow Selection；
- Change Class Candidate；
- Urgency；
- Owner Role；
- Required Agents/Systems/Roles；
- Containment/Reproduction；
- Safety/Regulatory/Customer Escalation；
- Candidate-only AI；
- Human Review；
- Trace。

## Phase 5：Problem Statement

实现：

- What/Where/When/Who/How Many；
- Expected/Observed；
- Is/Is Not；
- Affected Function；
- Evidence；
- Severity；
- Review；
- Version；
- No Root Cause Language in Problem Statement。

## Phase 6：Containment Planning

实现：

- Scope；
- Inventory/WIP/Ship/Build Candidate；
- Inspection；
- Temporary Test；
- Supplier Containment；
- Customer Advisory Candidate；
- Owner；
- Start/Exit Criteria；
- Risk；
- Approval；
- No Direct Execution。

## Phase 7：Containment Connector Requests

实现：

- WMS Hold Request；
- MES Hold Request；
- ERP PO/Shipment Review Candidate；
- QMS Containment；
- Supplier Request；
- Preview；
- Approval；
- Execute via Connector；
- Readback；
- Release；
- Audit。

## Phase 8：Reproduction Contract

实现：

- Configuration；
- Setup；
- Inputs；
- Environment；
- Firmware；
- Instruments；
- Steps；
- Expected/Observed；
- Frequency/Samples；
- Evidence；
- Safety；
- Agent 46 Handoff；
- Approval。

## Phase 9：Reproduction Runs

实现：

- Manual；
- Agent 46；
- Production Test；
- Field；
- Repeatability；
- Intermittent；
- Environment/Configuration Dependency；
- Evidence Links；
- Result；
- No Fake Reproduction。

## Phase 10：Evidence Federation

实现：

- Agent Evidence；
- PLM Documents；
- Test Records；
- Logs；
- Waveforms；
- Photos；
- Supplier Records；
- Customer/RMA；
- Artifact Hash；
- Configuration Context；
- Quality；
- Privacy；
- Dedup；
- Immutable Links。

## Phase 11：Root Cause Graph Foundation

实现：

- Symptom；
- Cause Candidate；
- Mechanism；
- Configuration Object；
- Evidence；
- Test；
- Corrective Action；
- Support/Contradiction；
- Alternative；
- Stable Keys；
- Graph Diff；
- Audit。

## Phase 12：5 Why and Fishbone

实现：

- Structured Chains；
- Evidence per Answer；
- Termination Reason；
- Categories；
- Candidate Causes；
- Review；
- No “operator error” Stop without Systemic Analysis；
- Templates；
- Export。

## Phase 13：Fault Tree and Change Point Analysis

实现：

- Top Event；
- AND/OR Gates；
- Basic Events；
- Change Before/After；
- Process/Material/Tool/Software Differences；
- Evidence；
- Test Candidates；
- Review；
- No Probability Fabrication。

## Phase 14：Escape Point Analysis

实现：

- Detection Stage；
- Expected Control；
- Actual Control；
- Escape Mechanism；
- Test/Inspection Gap；
- Process Links；
- Corrective Candidates；
- Evidence；
- Owner；
- Gate。

## Phase 15：Root Cause Verification

实现：

- Physical/Technical/Process/Systemic；
- Reproduction；
- Mechanism；
- Alternative Rejection；
- Corrective Perturbation；
- Regression；
- Agent 46 Evidence；
- Verified Gate；
- Unresolved Outcome；
- Human Approval。

## Phase 16：PDCA Workflow

实现：

- Plan/Do/Check/Act；
- Goals；
- Actions；
- Metrics；
- Pilot；
- Standardization；
- Status/Gate；
- Owners；
- Evidence；
- Link to ECO/CAPA。

## Phase 17：8D Workflow

实现：

- D0–D8；
- Team；
- Problem；
- Containment；
- Root Cause/Escape；
- Permanent Action；
- Validation；
- Prevention；
- Closure；
- Customer Template Adapter；
- Stage Approval；
- No Auto Signoff。

## Phase 18：Configuration Item Registry

实现：

- Item Types；
- Source Systems；
- Identity；
- Revision/Version/Variant；
- Owner；
- Lifecycle；
- Artifact/Hash；
- Relationships；
- ACL；
- Sync；
- Duplicate/Conflict；
- No Destructive Merge。

## Phase 19：Baseline Registry

实现：

- Requirement；
- Architecture；
- Selection；
- Compatibility；
- Design；
- Firmware；
- Manufacturing；
- Quality；
- Release；
- Service；
- Item Manifest；
- Compatibility；
- Effectivity；
- Approval；
- Hash；
- Immutability。

## Phase 20：Baseline Pair and Target Candidate

实现：

- Source Baseline；
- Target Candidate；
- Scope；
- Missing Target Objects；
- Provider Policy；
- Snapshot；
- Stable Pair；
- Change Intent；
- Gate。

## Phase 21：Generic File and Metadata Diff

实现：

- Add/Remove/Modify/Rename/Move；
- Text；
- JSON/YAML/XML；
- CSV/Parquet；
- Binary Manifest；
- Metadata；
- Hash；
- Stable Output；
- Security Limits；
- Mapping Loss。

## Phase 22：EDA Semantic Diff

实现：

- Schematic Sheets；
- Symbols；
- Pins；
- Nets；
- Values；
- Footprints；
- PCB Outline；
- Placement；
- Tracks/Vias/Zones；
- Stackup；
- Rules；
- Agent 16 IR；
- Geometry Summary；
- Source Map；
- No Screenshot-only Diff。

## Phase 23：BOM and Component Diff

实现：

- Refdes；
- Quantity；
- MPN/Ordering Code；
- Manufacturer；
- Value；
- DNP；
- Alternate；
- Lifecycle；
- Package；
- AML/AVL；
- EBOM/MBOM；
- Aggregation；
- Agent 31–43 Contracts；
- Trace。

## Phase 24：Firmware Semantic Diff

实现：

- Source Commit；
- Build；
- Binary Hash；
- Configuration；
- Pin Mux；
- Clock；
- Driver；
- Protocol；
- Memory Map；
- Bootloader；
- Dependency；
- Generated Files；
- Release Notes；
- Agent 21 Contract；
- No Untrusted Execution。

## Phase 25：Manufacturing and Test Diff

实现：

- Gerber/Drill/CPL；
- Assembly Drawing；
- Stencil；
- Routing；
- Work Instruction；
- Process Parameter；
- Test Limits；
- Test Program；
- Fixture；
- Label/Packaging；
- Agent 29/30/43–45；
- Mapping Loss。

## Phase 26：Change Set Builder

实现：

- Intent；
- Changed/Added/Removed；
- Derived Artifacts；
- Variants；
- Compatibility；
- Verification Requirements；
- Diff Sources；
- Review；
- Hash；
- Candidate vs Approved。

## Phase 27：Impact Graph Foundation

实现：

- Configuration/Traceability Nodes；
- Typed Edges；
- Dependency Propagation；
- Direct/Derived/Potential/Unknown；
- Evidence；
- Confidence；
- Cycle Handling；
- Incremental Rebuild；
- Graph Hash。

## Phase 28：Design and Firmware Impact

实现：

- Requirement；
- Function/Block/Interface；
- Component/Library；
- Schematic/PCB；
- Firmware；
- Configuration；
- Test；
- Docs；
- Must Change/Reverify/Regenerate；
- Agent Routing；
- Findings。

## Phase 29：Manufacturing and Supply Impact

实现：

- BOM/MBOM；
- Process；
- Tooling；
- Fixture；
- Supplier；
- PO；
- Material；
- Special Process；
- Site；
- Quality；
- Training；
- Agent 29–45 Routing；
- Findings。

## Phase 30：Inventory Snapshot

实现：

- On Hand/Available/Reserved/Hold；
- Lot/Date Code；
- Location；
- Cost；
- Ownership；
- Shelf Life；
- Rework/Replacement Candidate；
- Source Query Time；
- Freshness；
- No Mutation。

## Phase 31：WIP Snapshot

实现：

- Work Orders；
- Quantity；
- Current Operation；
- Completed Operations；
- Installed Materials；
- Serial；
- Test；
- Rework/Scrap；
- Site；
- Freshness；
- No Mutation。

## Phase 32：In-transit and Delivered Impact

实现：

- PO/Shipment/Transfer；
- Customer Shipment；
- RMA；
- Serial/Lot；
- Region；
- Firmware；
- Service；
- Warranty；
- Contact Candidate；
- Freshness；
- Privacy。

## Phase 33：Traceability Query Engine

实现：

- Lot→Serial；
- Part→WIP；
- Firmware→Units；
- Revision→Customers；
- Test Program→Work Orders；
- Supplier Batch→Products；
- Multi-hop；
- Evidence；
- Pagination；
- Export；
- Staleness；
- ACL。

## Phase 34：Configuration Compatibility Matrix

实现：

- Hardware；
- Assembly；
- Firmware；
- Bootloader；
- Config；
- BOM Variant；
- Test Program；
- Fixture；
- Route；
- Cells；
- Unknown；
- Evidence；
- Effectivity；
- Gate。

## Phase 35：Disposition Planner

实现：

- Use/Rework/Repair/Retest/Relabel/Reprogram；
- Replace/RTV/Scrap/Sort/Hold/Release；
- Scope/Quantity/Lot/Serial；
- Instruction；
- Cost/Schedule/Risk；
- Verification；
- Owner；
- Approval；
- Candidate-only。

## Phase 36：Effectivity Planner

实现：

- Date/Lot/Serial/WO/PO/Shipment/Revision/Site/Customer/Quantity；
- Old Valid Through；
- New Valid From；
- Transition；
- Mixed Build；
- Interchangeability；
- Firmware；
- Labeling；
- Traceability；
- Approval。

## Phase 37：Change Alternatives

实现：

- No Change；
- Containment；
- Component/Firmware/Design/Process/Test/Supplier；
- Rework/Scrap；
- Field Update/Recall Candidate；
- Technical/Cost/Time/Risk；
- Inventory/WIP/Customer；
- Verification；
- Reversibility；
- Prevention；
- Evidence。

## Phase 38：Decision and Approval Matrix

实现：

- Selected/Rejected；
- Tradeoffs；
- Accepted Risk；
- Effectivity/Disposition；
- Role Matrix；
- Class/Safety/Cost/Field；
- Parallel/Sequential；
- Conditions；
- Expiry；
- Revocation；
- Signature Hash；
- Segregation of Duties。

## Phase 39：ECR Package

实现：

- Need；
- Problem/Opportunity；
- Scope；
- Evidence；
- Alternatives；
- Initial Impact；
- Requested Decision；
- Attachments；
- Review；
- Immutable Version。

## Phase 40：ECN Package

实现：

- Approved Change Summary；
- Semantic Diff；
- Affected Objects；
- Effectivity；
- Disposition；
- Compatibility；
- Notification；
- Validation；
- Revision Table；
- Approved Manifest。

## Phase 41：ECO Package

实现：

- Execution Authority；
- Source/Target Baselines；
- Work Packages；
- Owners；
- Gates；
- Approvals；
- Release；
- Readback；
- Rollback；
- Verification；
- Closure Dependency。

## Phase 42：Deviation and Waiver Packages

实现：

- Temporary/Permanent；
- Scope；
- Quantity/Lot/Serial；
- Risk；
- Expiry；
- Customer/Quality Approval；
- Inspection/Test；
- Exit；
- No Silent Extension；
- Automatic Expiry Alerts。

## Phase 43：Implementation Work Packages

实现：

- Agent/System Routing；
- Target Objects；
- Change Instructions；
- Baselines；
- Dependencies；
- Owner；
- Estimate Candidate；
- Input Gate；
- Expected Output；
- Verification；
- Rollback；
- Agent 11 Sync。

## Phase 44：Controlled Execution

实现：

- Preview；
- Approval；
- Agent 19；
- Firmware Build Pipeline；
- PLM/ERP/WMS/MES/QMS Connectors；
- Idempotency；
- External Transaction；
- Partial Failure；
- Compensation；
- No Direct DB Mutation。

## Phase 45：Readback and Actual Diff

实现：

- Post-state Snapshot；
- Expected vs Actual Change Set；
- Missing Change；
- Unplanned Change；
- Hash；
- Provider；
- Gate；
- Rollback Candidate；
- Audit；
- No “command succeeded” Closure。

## Phase 46：Verification and Regression Planning

实现：

- Requirement；
- Design；
- Firmware；
- Compatibility；
- Manufacturing；
- Test；
- Inventory Disposition；
- Documentation；
- Impact-derived Regression；
- Samples/Environment；
- Owners；
- Approval。

## Phase 47：Verification Runs

实现：

- Agent 15/22/23/24–30；
- Agent 45 Test；
- Agent 46 Field/Bench；
- Manufacturing Pilot；
- Evidence；
- New Findings；
- Result；
- Rework Loop；
- No Auto Pass。

## Phase 48：Release and Effectivity Activation

实现：

- New Baseline；
- Change Package；
- Verification；
- Approvals；
- Effectivity；
- Manifest；
- Publish；
- Old Revision State；
- Transition；
- External Readback；
- Rollback Policy。

## Phase 49：Disposition Execution Tracking

实现：

- WMS/MES/ERP/QMS Requests；
- Quantity Reconciliation；
- Lot/Serial；
- Instruction Version；
- Operator/Approver；
- Verification；
- Cost；
- Partial Completion；
- Exceptions；
- Closure Gate。

## Phase 50：Notification Planning and Delivery

实现：

- Internal/Supplier/Factory/Customer/Service/Regulatory；
- Audience Scope；
- Confidentiality；
- Templates；
- Approval；
- Timing；
- Delivery/Acknowledgement；
- No Auto Customer Send；
- Evidence。

## Phase 51：Effectiveness Review

实现：

- Windows；
- Metrics；
- Baseline/Target；
- Data Sources；
- PPM/Yield/RMA/Rework/Scrap；
- Side Effects；
- Result；
- Reopen；
- Scope Expansion；
- Owner；
- Approval。

## Phase 52：Recurrence Detection

实现：

- Problem Signature；
- Configuration Scope；
- Root Cause Similarity；
- Fault Signature；
- Time Window；
- Link Cases；
- Invalidate Effectiveness；
- Escalate Systemic Cause；
- CAPA/8D Candidate；
- No Auto Merge。

## Phase 53：Knowledge Writeback

实现：

- Known Issue；
- Fault Signature；
- Debug Playbook；
- Design/Selection/Compatibility/DFM Rule；
- Test/Inspection；
- Supplier/Process；
- Applicability；
- Evidence；
- Privacy；
- Owner/Review Date；
- Target Agent；
- Approval；
- Publication Record。

## Phase 54：Closure Gate

实现：

- Problem；
- Containment；
- Reproduction；
- Root Cause；
- Change；
- Disposition；
- Verification；
- Effectivity；
- Notification；
- Effectiveness；
- Knowledge；
- Unknown/Risk；
- Approval；
- Final Report；
- No Ticket-only Closure。

## Phase 55：API、Events、Storage 和 Integrations

实现：

- REST；
- Events；
- Jobs；
- Temporal Workflows；
- Pause/Resume；
- External Connector Transactions；
- Pagination；
- Object Storage；
- ACL；
- Audit；
- Retention；
- Metrics；
- Health；
- Idempotency；
- Recovery。

## Phase 56：Review Workbench

实现：

- Problem/8D；
- Root Cause Graph；
- Baseline Diff；
- Impact Graph；
- Compatibility Matrix；
- Inventory/WIP；
- Disposition；
- Effectivity；
- Approvals；
- Implementation；
- Verification；
- Knowledge；
- Closure；
- Role-based Views。

## Phase 57：Benchmark、监控和生产发布

实现：

- Triage；
- Root Cause；
- Diff；
- Impact；
- Traceability；
- Approval；
- Implementation；
- Readback；
- Verification；
- Effectiveness；
- Recurrence；
- Security；
- Performance；
- Feature Flags；
- Provider/Connector Rollback；
- Disaster Recovery。

## Phase 58：高级能力，可选

稳定后：

- Cross-product Change Propagation；
- Product-line Configuration Governance；
- Supplier PCN Automatic Intake；
- Change Cost Simulation；
- Field Action Population Estimation；
- Digital Thread Graph；
- Regulatory Submission Package Candidate；
- Predictive Recurrence；
- Automated Change Review Meeting Pack；
- 仍不自动批准、发布、报废、召回或关闭问题。

---

# 86. Codex 工作纪律

Codex 必须：

1. Case 与 Change Package 分开；
2. Problem 与 Change 分开；
3. ECR/ECN/ECO 语义分开；
4. Deviation/Waiver 有时效和范围；
5. Intake Snapshot 不可变；
6. Triage 是候选，需 Review；
7. Containment 有退出条件；
8. Agent 47 不直接冻结库存/WIP；
9. Reproduction 有配置和证据；
10. 不可复现必须明确记录；
11. Root Cause 与 Symptom 分开；
12. Correction/Corrective/Preventive 分开；
13. Physical/Technical/Process/Systemic 分层；
14. Escape Point 必须分析；
15. Verified Root Cause 需要机制和回归；
16. 5 Why 每层有证据；
17. AI 不自动签署 8D；
18. Configuration Item 有 Source System；
19. Revision/Version/Variant 分开；
20. Baseline 不可覆盖；
21. File Diff 与 Semantic Diff 分开；
22. Diff Provider 显式版本；
23. Mapping Loss 显式；
24. Change Set 绑定 Baseline Pair；
25. Impact Graph 有证据和置信度；
26. Unknown Impact 不可静默忽略；
27. Compatibility Matrix 覆盖 HW/FW/Test/Fixture；
28. Inventory Snapshot 有 Query Time；
29. WIP Snapshot 有 Operation；
30. Delivered Scope 有权限；
31. Traceability Gap 是 Finding；
32. Disposition 是类型化 Contract；
33. Agent 47 不直接报废或放行；
34. Effectivity 是正式变更必需项；
35. Transition 和 Mixed Build 显式；
36. Interchangeability 显式；
37. Alternatives 有成本/风险/验证；
38. Approval Matrix 由 Policy 生成；
39. Content 变化使 Approval 失效；
40. 提交、批准、执行、验证角色分离；
41. ECO 是执行授权，不是描述文档；
42. Work Package 绑定 Target Agent/System；
43. External Writes 走 Connector；
44. 所有执行支持 Idempotency；
45. Command Success 不等于实现正确；
46. Readback 和 Actual Diff 必需；
47. Unplanned Diff 阻断发布；
48. Verification 从 Impact Graph 派生；
49. 修改点通过不等于回归通过；
50. Release 绑定 Manifest/Hash；
51. 旧 Revision 保留；
52. Inventory/WIP Disposition 完成才可关闭；
53. Notification 有审批和范围；
54. 不自动发客户通知；
55. Effectiveness Review 有指标和窗口；
56. Recurrence 可重开；
57. Knowledge 有适用范围和复审日期；
58. Knowledge 不自动发布；
59. AI 不编造 Diff/Inventory/WIP/Cost；
60. AI 不批准和关闭；
61. 私有数据不进未批准模型；
62. 客户和供应商数据严格 ACL；
63. 公开 Fixture 不使用真实客户数据；
64. 不伪造测试、审批或 Benchmark；
65. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Workflow/Policy/Provider 变化；
    - 测试命令和真实结果；
    - Intake/Triage；
    - Containment/Reproduction；
    - Root Cause/8D；
    - Baseline/Diff；
    - Impact/Traceability；
    - Disposition/Effectivity；
    - Approval/Implementation；
    - Readback/Verification；
    - Release/Notification；
    - Effectiveness/Knowledge；
    - Security/Performance；
    - 已知限制；
    - 下一阶段建议。

---

# 87. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture；外部写操作使用模拟 Connector。

## Intake and Classification

1. Engineering Issue；
2. ECR；
3. Supplier PCN；
4. Component EOL；
5. Customer Complaint；
6. Field Return；
7. Production Failure；
8. Safety Issue；
9. Duplicate Case；
10. Urgency Routine；
11. Emergency；
12. Stop-ship Candidate；
13. Change Class 0；
14. Change Class 4；
15. Workflow Unknown；
16. Owner Assignment；
17. Intake Snapshot；
18. Evidence Missing；
19. Safety Escalation；
20. Regulatory Escalation。

## Problem, Containment and Reproduction

21. Valid Problem Statement；
22. Root Cause Language Rejected；
23. Is/Is Not；
24. Affected Population；
25. Inventory Hold Candidate；
26. WIP Hold Candidate；
27. Stop Build；
28. Stop Ship；
29. Enhanced Inspection；
30. Containment Exit；
31. Unauthorized Hold Rejected；
32. Reproduction Contract；
33. Firmware Context；
34. Environment Context；
35. Intermittent；
36. Not Reproducible；
37. Reproduced Consistently；
38. Agent 46 Link；
39. Evidence Hash；
40. Configuration Mismatch。

## Root Cause and 8D

41. 5 Why Chain；
42. Unsupported Why；
43. Fishbone；
44. Fault Tree；
45. Change Point；
46. Physical Cause；
47. Technical Cause；
48. Process Cause；
49. Systemic Cause；
50. Escape Point；
51. Alternative Cause；
52. Contradicting Evidence；
53. Root Cause Candidate；
54. Root Cause Supported；
55. Root Cause Rejected；
56. Root Cause Verified；
57. No Regression Verification Rejected；
58. Correction；
59. Corrective Action；
60. Preventive Action；
61. PDCA；
62. 8D D0–D8；
63. Stage Approval；
64. AI Signoff Rejected；
65. Unresolved Root Cause。

## Configuration and Diff

66. Requirement Item；
67. Schematic Item；
68. PCB Item；
69. Firmware Item；
70. BOM Item；
71. Process Item；
72. Test Item；
73. Immutable Baseline；
74. Missing Baseline；
75. Baseline Hash Mismatch；
76. Text Diff；
77. JSON Diff；
78. Rename；
79. Semantic Component Value Diff；
80. Net Diff；
81. Footprint Diff；
82. PCB Geometry Diff；
83. BOM MPN Diff；
84. DNP Diff；
85. Firmware Config Diff；
86. Pin Mux Diff；
87. Gerber Manifest Diff；
88. Test Limit Diff；
89. Process Step Diff；
90. Mapping Loss；
91. Unreviewed Diff；
92. Change Set；
93. Variant Scope；
94. Derived Artifact；
95. Diff Replay。

## Impact Graph

96. Requirement→Design；
97. Component→BOM；
98. BOM→Inventory；
99. BOM→WIP；
100. Firmware→Serial；
101. Process→Work Order；
102. Test→Fixture；
103. Supplier→Lot；
104. Direct Impact；
105. Derived Impact；
106. Potential Impact；
107. Unknown Impact；
108. Cycle；
109. Multiple Products；
110. Shared Module；
111. License Impact；
112. Regulatory Impact；
113. Documentation Impact；
114. Training Impact；
115. Impact Explanation；
116. Incremental Rebuild；
117. Graph Hash；
118. Missing Trace；
119. Configuration Matrix；
120. Unknown Compatibility Cell。

## Inventory, WIP and Traceability

121. Raw Material；
122. Component Inventory；
123. Finished Goods；
124. Reserved Stock；
125. Quality Hold；
126. Shelf Life；
127. Lot/Date Code；
128. Cost Summary；
129. Snapshot Stale；
130. WIP at SMT；
131. WIP at Test；
132. Installed Material；
133. Serialized WIP；
134. Rework History；
135. In-transit PO；
136. Customer Shipment；
137. Delivered Serial；
138. Firmware Installed；
139. Lot→Serial Query；
140. Part→WIP Query；
141. Revision→Customer Query；
142. Test Program→WO；
143. Multi-hop Trace；
144. Traceability Gap；
145. Tenant ACL。

## Disposition and Effectivity

146. Use As Is；
147. Rework；
148. Retest；
149. Reprogram；
150. Replace；
151. RTV；
152. Scrap Candidate；
153. Sort/Screen；
154. Hold；
155. Release；
156. Customer Concession；
157. Disposition Scope；
158. Quantity Reconciliation；
159. Unauthorized Scrap Rejected；
160. Date Effectivity；
161. Lot Effectivity；
162. Serial Effectivity；
163. Work Order Effectivity；
164. Site Effectivity；
165. Mixed Build；
166. No Mixed Build；
167. Fully Interchangeable；
168. Conditional Interchangeability；
169. Firmware Compatibility；
170. Label Transition。

## Alternatives and Approvals

171. No Change；
172. Firmware-only；
173. Component Substitution；
174. Design Change；
175. Process Change；
176. Test Change；
177. Rework Existing；
178. Field Update；
179. Recall Candidate；
180. Cost Evaluation；
181. Inventory Loss；
182. WIP Disruption；
183. Reversibility；
184. Prevention Value；
185. Approval Matrix；
186. Safety Approver；
187. Customer Approver；
188. Cost Threshold；
189. Parallel Approval；
190. Sequential Approval；
191. Conditional Approval；
192. Rejection；
193. Approval Expiry；
194. Approval Revocation；
195. Content Change Invalidates Signature。

## Packages and Implementation

196. ECR Package；
197. ECN Package；
198. ECO Package；
199. Deviation；
200. Waiver；
201. Expired Deviation；
202. Work Package Agent 19；
203. Work Package Agent 21；
204. Work Package Agent 29；
205. Work Package ERP；
206. Preview；
207. Approval Missing；
208. Execute；
209. Idempotent Retry；
210. Partial Failure；
211. Compensation；
212. Readback；
213. Missing Approved Change；
214. Unplanned Change；
215. Rollback；
216. External Transaction；
217. Audit；
218. Source Baseline；
219. Target Candidate；
220. Manifest Hash。

## Verification, Release and Closure

221. Requirement Verification；
222. ERC Regression；
223. Simulation Regression；
224. Compatibility Regression；
225. DRC Regression；
226. DFM Regression；
227. Production Test；
228. LabSight Verification；
229. Pilot Build；
230. New Finding；
231. Verification Fail；
232. Verification Pass；
233. Release Blocked；
234. Effectivity Release；
235. Old Revision Retained；
236. Disposition Incomplete；
237. Notification Plan；
238. Customer Notification Approval；
239. Supplier Notification；
240. Delivery Acknowledgement；
241. Effectiveness 30 Days；
242. Effectiveness N Lots；
243. Recurrence；
244. Reopen；
245. Knowledge Candidate；
246. Privacy Review；
247. Rule Writeback；
248. Test Writeback；
249. Closure Gate；
250. Closed No Change；
251. Closed Accepted Risk；
252. Ticket-only Closure Rejected；
253. Audit Export；
254. 100k Configuration Items；
255. 10M Trace Edges；
256. 1M Inventory Rows；
257. Connector Timeout；
258. Worker Cancellation；
259. Disaster Recovery；
260. Provider Rollback。

---

# 88. 初始质量目标

```text
Released ECO with Source and Target Baseline = 100%
Released ECO with Effectivity = 100%
Released Change with Impact Analysis = 100%
Released Change with Required Approvals = 100%
Critical Change with Segregation of Duties = 100%
Formal Diff Based Only on Screenshot = 0
Inventory/WIP Quantity Invented by AI = 0
Inventory/WIP Disposition without Approval = 0
Automatic Scrap/Recall/Customer Notification = 0
Implementation without Readback = 0
Release with Unplanned Diff = 0
Problem Closed without Root Cause Disposition = 0
Verified Root Cause without Reproduction/Mechanism/Regression = 0
Problem Closed with Incomplete Inventory/WIP Disposition = 0
Old Baseline Overwrite = 0
Deviation without Scope/Expiry = 0
Change Approval Retained after Package Content Mutation = 0
Effectiveness Failure without Reopen/Escalation = 0
Knowledge Publication without Review = 0
Private Data Sent to Unapproved Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 89. 性能要求

常规 Case：

```text
10–10,000 Configuration Items
10–100,000 Diff Objects
100–1,000,000 Impact Edges
10–1,000,000 Inventory/WIP/Serial Records
10–1,000 Work Packages
```

目标：

```text
Triage P95 < 5 s excluding model calls
Baseline Manifest Query P95 < 5 s
Generic Diff P95 < 30 s for 100k objects
Impact Build P95 < 60 s for 1M edges
Inventory Snapshot P95 depends on connector, async
Interactive Impact Query P95 < 500 ms
Traceability Query P95 < 10 s for indexed multi-hop
Approval Gate P95 < 1 s
Closure Gate P95 < 5 s
```

大型范围要求：

- Snapshot/Query Time；
- 增量 Graph；
- 分区；
- Columnar Storage；
- Async Connector；
- Pagination；
- Cancellation；
- Partial Result；
- Freshness Warning；
- 不将百万级库存和序列记录送入语言模型；
- 模型只接收聚合、脱敏和证据引用。

---

# 90. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/engineering-change-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第47个 Agent：

Engineering Change, Configuration Impact,
Problem Closure & Knowledge Feedback Orchestration Agent /
工程变更与问题闭环 Agent。

本 Agent 接收：

- Agent 10–46 的 Baseline、Findings、Evidence、Change 和 Root Cause；
- ezPLM 项目、文档、物料、BOM、版本、任务、审批和知识；
- ERP/WMS/MES/QMS/CRM；
- Supplier PCN/PDN/8D；
- Inventory、WIP、In-transit、Lot、Serial、Delivered Product；
- EDA/Firmware/BOM/Manufacturing/Test Baselines；

输出：

- Case/Triage；
- Problem/Containment/Reproduction；
- Root Cause/PDCA/8D；
- Configuration Registry/Baselines；
- Semantic Diff/Change Set；
- Impact Graph；
- Inventory/WIP/Delivered Impact；
- Disposition/Effectivity；
- Alternatives/Decision/Approvals；
- ECR/ECN/ECO/Deviation/Waiver；
- Implementation/Readback；
- Verification/Release；
- Notifications；
- Effectiveness/Recurrence；
- Knowledge Writeback；
- Closure/Audit。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10–47 相关规格；
3. docs/engineering-change-agent-spec.md；
4. 当前 Issue/Change/Approval/Version 模型；
5. 当前 Configuration Item/Baseline/Revision/Variant；
6. 当前 EDA/Firmware/BOM/Manufacturing/Test 结构；
7. 当前 Diff Provider；
8. 当前 PLM/ERP/WMS/MES/QMS/CRM Connector；
9. 当前 Inventory/WIP/Lot/Serial Traceability；
10. 当前 ECR/ECN/ECO/Deviation/Waiver；
11. 当前 NCR/CAPA/8D/PDCA；
12. 当前 Root Cause/Evidence/Agent 46；
13. 当前 Effectivity/Disposition；
14. 当前 Approval/Signature；
15. 当前 Release/Notification/Knowledge；
16. 当前 API/Worker/Storage/Security；
17. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Problem Closure != Ticket Closure；
- ECR/ECN/ECO Semantics Separate；
- Deviation/Waiver Have Scope and Expiry；
- One Case = Immutable Intake Snapshot；
- Root Cause != Symptom；
- Verified Root Cause Requires Mechanism/Reproduction/Repair/Regression；
- Escape Point Required；
- Configuration Items and Baselines First-class；
- Revisions Are Immutable；
- File Diff != Semantic Diff；
- Mapping Loss Explicit；
- Change Set Binds Baseline Pair；
- Impact Graph Required；
- Unknown Impact Does Not Silently Pass；
- Hardware/Firmware/BOM/Test Compatibility Matrix；
- Inventory/WIP/In-transit/Delivered Snapshots Have Query Time；
- AI Does Not Invent Quantity/Cost/Traceability；
- Disposition Is Typed and Approved；
- Agent Does Not Scrap/Hold/Release Directly；
- Effectivity Is Mandatory for Formal Change；
- Transition/Mixed-build/Interchangeability Explicit；
- Approval Matrix Comes from Policy；
- Content Mutation Invalidates Approval；
- Segregation of Duties；
- ECO Authorizes Controlled Execution；
- External Writes via Typed Connectors；
- Preview/Execute/Readback/Rollback；
- Command Success != Correct Implementation；
- Actual Diff Required；
- Impact-derived Regression；
- Old Baseline Retained；
- Customer Notification Requires Approval；
- Effectiveness Review and Reopen；
- Knowledge Writeback Requires Scope/Evidence/Review；
- AI Does Not Approve/Close；
- No External Private Change/Inventory/Customer Data；
- 不用客户数据做公开 Fixture；
- 不伪造审批、测试、库存或 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改生产数据：

1. 侦察当前仓库；
2. 查找 Agent 10–46 Contracts；
3. 查找 Issue/Change/Task；
4. 查找 ECR/ECN/ECO/Deviation/Waiver；
5. 查找 NCR/CAPA/8D/PDCA；
6. 查找 Configuration Item/Baseline；
7. 查找 Revision/Version/Variant/Effectivity；
8. 查找 EDA/Firmware/BOM/Manufacturing/Test Diff；
9. 查找 PLM/ERP/WMS/MES/QMS/CRM Connectors；
10. 查找 Inventory/WIP/In-transit/Delivered；
11. 查找 Lot/Serial Traceability；
12. 查找 Disposition；
13. 查找 Approval/Signature；
14. 查找 Implementation/Readback/Rollback；
15. 查找 Verification/Release；
16. 查找 Notification；
17. 查找 Effectiveness/Recurrence；
18. 查找 Knowledge Writeback；
19. 查找 API/Worker/Storage/Security；
20. 统计无根因关闭；
21. 统计无 Effectivity Change；
22. 统计库存/WIP 追溯缺口；
23. 统计版本不同步；
24. 统计重复问题和无效果 8D；
25. 抽样分析开源、合成、脱敏或授权 Fixture；
26. 在 docs/engineering-change-implementation-plan.md 中生成实施计划；
27. 在 docs/intake-and-classification.md 中定义 Intake；
28. 在 docs/containment-and-reproduction.md 中定义控制和复现；
29. 在 docs/root-cause-and-escape-point.md 中定义 RCA；
30. 在 docs/pdca-and-eight-d.md 中定义 PDCA/8D；
31. 在 docs/configuration-items-and-baselines.md 中定义配置；
32. 在 docs/semantic-diff.md 中定义 Diff；
33. 在 docs/impact-graph.md 中定义影响；
34. 在 docs/inventory-wip-and-traceability.md 中定义追溯；
35. 在 docs/disposition-and-effectivity.md 中定义处置；
36. 在 docs/approvals-and-change-packages.md 中定义审批；
37. 在 docs/implementation-and-readback.md 中定义执行；
38. 在 docs/verification-and-release.md 中定义验证；
39. 在 docs/effectiveness-and-recurrence.md 中定义效果；
40. 在 docs/knowledge-writeback.md 中定义知识；
41. 在 docs/downstream-agent-contracts.md 中定义下游；
42. 在 docs/ai-boundaries.md 中定义 AI；
43. 在 docs/security.md 中定义安全；
44. 在 docs/engineering-change-migration-plan.md 中定义迁移；
45. 在 docs/engineering-change-benchmark-plan.md 中定义 Benchmark；
46. 给出拟新增、拟修改和拟复用文件；
47. 给出 Phase 1 精确范围；
48. 不修改业务代码；
49. 不创建 Migration；
50. 不安装 Diff/Graph/Connector/模型组件；
51. 不创建正式 Change Package；
52. 不修改 Baseline；
53. 不冻结库存/WIP；
54. 不执行 ERP/WMS/MES/QMS 写操作；
55. 不发送通知；
56. 不调用生产外部模型；
57. 不读取或打印 Secret/客户/供应商/成本数据；
58. 运行仓库已有 lint、type check、test、build 和 security scan；
59. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10–46 Contracts；
- Intake/Triage；
- Containment/Reproduction；
- Root Cause/Escape Point；
- PDCA/8D；
- Configuration/Baseline；
- Diff；
- Impact Graph；
- Inventory/WIP/Traceability；
- Compatibility Matrix；
- Disposition/Effectivity；
- Alternatives/Approvals；
- ECR/ECN/ECO；
- Implementation/Readback；
- Verification/Release；
- Notification；
- Effectiveness/Recurrence；
- Knowledge/Closure；
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
继续实现 Engineering Change Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10–47 相关规格；
3. 阅读 Engineering Change Implementation Plan；
4. 阅读 Intake、RCA、Configuration、Diff、Impact、Traceability、
   Effectivity、Approval、Implementation、Verification、Knowledge 和 Security 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Immutable Baselines and Revisions；
- Semantic Diff and Impact before Execution；
- Typed Disposition and Effectivity；
- Policy-driven Approvals；
- Preview/Execute/Readback/Rollback；
- Human Approval and Closure；
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
9. diff/impact tests；
10. connector simulation tests；
11. approval/effectivity tests；
12. verification/closure tests；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Workflow/Policy/Provider 变化；
- 测试命令和真实结果；
- Intake/Triage；
- Containment/RCA；
- Baseline/Diff；
- Impact/Traceability；
- Disposition/Effectivity；
- Approval/Implementation；
- Readback/Verification；
- Release/Effectiveness；
- Knowledge/Closure；
- Security/Performance；
- 已知限制；
- 下一阶段建议。
```

---

# 92. MVP 演示流程

演示问题：

```text
某批双通道测量仪在现场出现 USB 枚举不稳定；
Agent 46 已确认：
1. 一部分板刷入错误 Firmware；
2. 某些板 USB-C 附近元件贴装偏移；
3. 生产测试没有校验 Hardware/Firmware 兼容性。
```

1. Agent 46 发出 `labsight.root-cause-verified`；
2. Agent 47 创建 Case `CHG-2026-USB-001`；
3. 冻结：
4. Board Revision B；
5. Assembly Revision B2；
6. Firmware 1.3 和 2.1；
7. Manufacturing Release MR-B2；
8. 受影响 Debug Evidence；
9. Triage：
10. Engineering Issue；
11. Customer-visible；
12. Expedited；
13. 需要 Containment、8D、ECO；
14. 创建 Problem Statement：
15. What：USB 枚举失败或间歇失败；
16. Where：Revision B/B2；
17. When：冷启动和部分 USB Host；
18. How Many：待 Traceability；
19. Is：刷入 Firmware 1.x 或 ESD 元件偏移样机；
20. Is Not：Firmware 2.1 且贴装正常样机；
21. 创建 Interim Containment Candidate：
22. 禁止 Revision B 刷入 Firmware 1.x；
23. 出货前增加 USB 枚举测试；
24. 仓库隔离未确认 Firmware 的成品；
25. MES 工单增加 Identity Check；
26. 这些措施经质量和制造批准后由对应系统执行；
27. Agent 47只保存 Request 和 Readback；
28. 启动 Traceability Query；
29. 查找所有 Revision B/B2；
30. 查找所有 Firmware 1.x 烧录记录；
31. 查找 ESD 器件相关 Lot；
32. 查找 WIP、库存、在途和已交付 Serial；
33. 结果：
34. Finished Goods 120 台；
35. WIP 80 台；
36. 已交付 45 台；
37. 其中 18 台明确刷入 Firmware 1.3；
38. 12 台烧录记录缺失；
39. 标记 Traceability Gap；
40. Root Cause Graph：
41. RC1 Technical：Firmware Clock Config 与 Hardware B 不兼容；
42. RC2 Process：烧录站未验证 Board Revision；
43. RC3 Process Candidate：ESD 器件贴装窗口不足；
44. Escape Point：Final Test 只检测设备能启动，没有执行多次 USB 枚举；
45. 复现和 Agent 46 Evidence 绑定；
46. 创建 8D：
47. D3：固件和库存隔离；
48. D4：硬件/固件不匹配 + Test Escape；
49. D5 永久措施候选：
50. Firmware Build 加 Hardware Compatibility Manifest；
51. MES 烧录前读取 Board Identity；
52. 不兼容 Build 阻断；
53. Final Test 增加 20 次 USB 枚举；
54. AOI 增加 ESD 元件位置规则；
55. D7：
56. 更新 Agent 15 Compatibility；
57. 更新 Agent 21 Build；
58. 更新 Agent 30 DFA/AOI Rule；
59. 更新 Agent 45 Production Test；
60. 冻结 Source Baselines；
61. Hardware B2；
62. Firmware 1.3；
63. Firmware 2.1；
64. Manufacturing Release MR-B2；
65. Test Program TP-4；
66. 构建 Target Candidate；
67. Firmware 2.2；
68. MES Programming Rule v3；
69. Test Program TP-5；
70. Work Instruction WI-USB-3；
71. 运行 Semantic Diff：
72. Firmware Clock Config；
73. Board Compatibility Manifest；
74. MES Rule；
75. Test Sequence；
76. Test Limit；
77. Work Instruction；
78. BOM 和 PCB 本轮不变；
79. Impact Graph 仍发现：
80. Firmware Binary；
81. Programming Station；
82. MES Route；
83. Test Program；
84. Fixture Script；
85. Finished Goods；
86. WIP；
87. Customer Units；
88. Service Tool；
89. User Firmware Update Package；
90. Configuration Matrix：
91. HW A + FW 1.x：Compatible；
92. HW A + FW 2.x：Not Compatible；
93. HW B + FW 1.x：Not Compatible；
94. HW B + FW 2.x：Compatible；
95. 未知烧录记录：Blocked；
96. 建立 Change Alternatives：
97. A：只返工已知 Firmware 1.3；
98. B：所有 Revision B 全量重刷和重测；
99. C：仅增加出货测试；
100. 评估：
101. A 成本低，但无法覆盖记录缺失；
102. C 无法纠正已刷错 Firmware；
103. 选择 B；
104. Disposition：
105. 120 台库存全部读取 Identity、重刷兼容 Firmware、20 次枚举；
106. 80 台 WIP 在烧录工序切换新规则；
107. 45 台已交付：
108. 18 台已知风险，生成客户服务联系候选；
109. 12 台未知记录，扩大检查；
110. 其他样机按风险和日志评估；
111. Agent 47不自动联系客户；
112. Effectivity：
113. Firmware 2.2 从 Serial B200501 生效；
114. Test Program TP-5 从 Work Order WO-9001 生效；
115. MES Rule v3 立即对 Revision B 生效；
116. Mixed Build 不允许；
117. 创建 ECO；
118. 审批角色：
119. Firmware；
120. Hardware；
121. Manufacturing；
122. Test；
123. Quality；
124. Service；
125. Product；
126. 批准后生成 Work Packages：
127. Agent 21：Firmware 2.2；
128. MES Connector：Programming Rule v3；
129. Agent 45：TP-5；
130. Agent 29：更新 Firmware/Programming Release Note；
131. Agent 46：验证测试；
132. Service：客户处置；
133. 所有执行先 Preview；
134. Firmware Build 完成；
135. Readback 发现 Binary Hash 与批准 Manifest 一致；
136. MES Rule Readback 一致；
137. Test Program Diff 一致；
138. 但 Work Instruction 少了一个 Bootloader 版本检查；
139. 标记 Missing Approved Change；
140. 阻断 Release；
141. 修正 Work Instruction；
142. 重新 Readback；
143. 全部一致；
144. Verification：
145. 20 次冷启动；
146. 5 种 USB Host；
147. Firmware Update；
148. Power Cycle；
149. 80 台 WIP Pilot；
150. 结果通过；
151. Inventory Disposition 执行：
152. 120 台中 117 台通过；
153. 3 台仍失败；
154. 3 台进入硬件返修和 Agent 46 新 Session；
155. 不能为了完成 ECO 把这 3 台静默算作通过；
156. 发布 ECN/ECO；
157. Effectivity Activation；
158. 旧 Firmware 1.3 保留但标为不适用于 Hardware B；
159. 更新生产、服务和内部通知；
160. 客户通知由 Service/Quality 审批；
161. 30 天 Effectiveness Review：
162. 新出货 USB 枚举失败为 0；
163. 烧录版本不匹配为 0；
164. 3 台硬件问题单独处理；
165. 8D D8 完成；
166. 知识回写：
167. Agent 15 加入 HW/FW Compatibility Manifest Check；
168. Agent 21 Build Pipeline 加 Board Revision Gate；
169. Agent 45 加多次 USB 枚举；
170. Agent 46 Debug Playbook 加 Power/Firmware Identity 检查；
171. Knowledge Owner 审核后发布；
172. Closure Gate 确认：
173. Root Cause；
174. Containment；
175. ECO；
176. Inventory/WIP；
177. Verification；
178. Effectivity；
179. Notification；
180. Effectiveness；
181. Knowledge；
182. Case Closed；
183. 原始 Case、Baseline、Diff、Approval 和 Evidence 不可覆盖。

---

# 93. 生产上线顺序

第一阶段：

```text
Case Intake
Triage
Problem Statement
Containment
Configuration Baseline
Generic/Semantic Diff
Manual Impact Review
Approval and Change Package
```

第二阶段：

```text
Inventory/WIP/Traceability
Disposition/Effectivity
Controlled Execution/Readback
Verification/Release
PDCA/8D
Closure Gate
```

第三阶段：

```text
Cross-product Impact Graph
Supplier/Customer Workflow
Recurrence Detection
Knowledge Rule Writeback
Change Cost Simulation
Digital Thread
```

上线优先确保：

```text
每个变更是否有明确的 Source Baseline、Target Baseline 和 Effectivity
版本差异是否表达成工程语义，而不只是文件行号
受影响的库存、WIP、在途、已交付产品是否能够被追溯和处置
执行后的实际结果是否与批准的 Change Set 完全一致
问题关闭是否包含根因、纠正措施、回归、效果验证和知识回写
```

一个靠谱的工程变更 Agent，不应该只是把“R37 从 10k 改成 4.7k”写进 ECN。它还应该追问：为什么改、哪些版本受影响、库存里有多少旧板、在制品走到哪一步、Firmware 和测试是否兼容、从哪个 Serial 开始生效、旧版本如何处置、谁批准、谁验证，以及三个月后这个问题到底有没有再次出现。
