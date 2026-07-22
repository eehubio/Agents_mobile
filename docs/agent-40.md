# 采购计划与缺料协同 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：40  
> Agent 名称：Procurement Planning & Shortage Collaboration Orchestrator  
> 中文名称：采购计划与缺料协同 Agent  
> 类型：编排型  
> 版本：V1.0  
>
> 定位：综合 BOM、库存、在途、工单、生产计划、销售订单、OPO（Open Purchase Order，未结采购订单）、ETA、供应商承诺、采购包装、成本、风险和业务优先级，建立时间分段的供需计划与 Pegging，生成采购申请草稿、供应商分配建议、催交清单、缺料表、Call 料表和跨部门协同任务。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规、原产地与关税
> - Agent 36：实时价格与库存
> - Agent 37：BOM 风险与多源供应
> - Agent 38：MOQ、SPQ 与采购包装优化
> - Agent 39：成本、报价与利润
> - ezPLM 项目、BOM、物料、库存、采购、生产、工单、销售订单、预测、供应商和物流数据
>
> 下游：
> - 采购申请 PR 草稿
> - 供应商和渠道分配建议
> - OPO 催交清单
> - 缺料表和停线风险
> - Blanket Order / Framework Agreement Call-off 表
> - 工单齐套率和生产排程建议
> - 采购预算和现金需求
> - Supplier Portal 协同
> - PO、Call-off、Expedite、Reschedule 和 Cancel 建议
> - 管理层缺料与交付驾驶舱
>
> 重要边界：
> - 本 Agent 是编排和计划 Agent，不自动签发正式 PO、不自动修改已批准 PO、不自动承诺客户交期、不自动取消工单。
> - 输出默认为草稿、建议和协同任务；正式采购、Call-off、催交函、工单变更和客户承诺必须经过明确权限和审批。
> - 所有计划必须绑定 Planning Run、时间点、BOM Revision、需求版本、库存快照、OPO 快照、ETA 版本和策略版本。
> - Unknown ETA、过期库存、未确认 OPO 和预计库存不得静默当作可靠供给。
> - Agent 40 不重复实现 Agent 33–39 的专业判断，只编排其结果并执行供需计划规则。

---

# 1. 建设目标

系统必须能够：

1. 汇总销售订单、预测、工单、维修、样机、试产、量产和安全库存需求；
2. 按日、周或月建立时间分段需求；
3. 展开多层 BOM 和工单需求；
4. 识别 BOM Revision、Variant、Effectivity 和 DNP；
5. 结合良率、损耗、返工和报废计算实际需求；
6. 汇总可用库存、在途、OPO、供应商确认、寄售、委外和 WIP 供给；
7. 区分 On-hand、Allocated、Reserved、Quarantine、Expired 和 Customer-owned 库存；
8. 区分 Confirmed OPO、Unconfirmed OPO、Scheduled Receipt、Expected Stock 和采购建议；
9. 建立 Demand-to-Supply Pegging；
10. 计算每个时间桶的 Projected Available Balance；
11. 识别缺料日期、缺口数量和影响对象；
12. 识别工单齐套率和最早可开工时间；
13. 识别客户订单、工单和项目之间的物料争用；
14. 基于优先级分配稀缺库存和在途；
15. 支持冻结区、确认区和规划区；
16. 生成采购申请草稿；
17. 基于 Agent 36–38 生成供应商、渠道、包装和采购数量建议；
18. 基于 Agent 37 限制高风险单一来源分配；
19. 基于 Agent 39 检查预算、成本和现金影响；
20. 生成 OPO 催交、提前、推迟、取消和分批建议；
21. 生成 Blanket Order、VMI、寄售或框架订单的 Call 料表；
22. 识别 ETA 不可信、承诺反复变化和长期无确认的订单；
23. 识别短缺是否可由替代料、库存调拨、包装转换、拆单或改期缓解；
24. 识别是否可从其他项目释放或借用库存；
25. 生成采购、计划、生产、工程、质量和供应商协同任务；
26. 支持缺料 War Room；
27. 支持人工锁定、优先级调整和风险接受；
28. 支持滚动计划和增量重算；
29. 支持多工厂、多仓库、多法人和多租户；
30. 支持供应商工作日、运输日历、工厂日历和节假日；
31. 支持部分到货、分批生产和分批交付；
32. 支持批次、Date Code、MSL、Lot、客户归属和合规限制；
33. 支持采购提前期、内部处理期、检验期和上线准备期；
34. 支持“有库存但不可用”的原因解释；
35. 支持 Shortage、At Risk、Covered、Excess 和 Reschedule 状态；
36. 支持采购计划版本、模拟和审批；
37. 支持事件驱动触发和定时 Planning Run；
38. 支持失败恢复、幂等、Saga 和补偿；
39. 保存全部输入快照、Pegging、规则和执行 Trace；
40. 不因数据缺失而默认为供给充足；
41. 不把预计库存、未确认订单和供应商口头承诺混成确定 ETA；
42. 不把替代料候选自动分配到工单；
43. 不自动使用客户专用、质量隔离或过期库存；
44. 不因某个客户优先级高就无审计地抢占其他已承诺订单；
45. 支持百万级需求和物料组合的分块运行。

---

# 2. 与 Agent 31–39 的边界

## 2.1 Agent 31：BOM 标准化

提供：

```text
BOM Line
Quantity per
Reference Designator
DNP
Variant
原始客户字段
```

Agent 40 不重新解析 Excel、CSV、PDF 或截图。

## 2.2 Agent 32：身份解析

提供：

```text
Part
Manufacturer
MPN
Package Variant
Ordering Variant
Internal Part Number
Customer Part Number
```

未精确解析的物料进入：

```text
planning_blocked
identity_review_required
```

## 2.3 Agent 33：替代料

提供已评估的：

```text
replacement level
FFF
Pin-to-Pin
approval status
customer approval
validation scope
```

Agent 40 只能使用已批准且适用当前项目、工厂和客户的替代。

## 2.4 Agent 34：生命周期

提供：

```text
Active / NRND / EOL / Obsolete
PCN
LTB/LTS
料号和厂商变化
```

用于新采购限制、LTB 和长期供给策略。

## 2.5 Agent 35：合规和原产地

提供：

```text
合规状态
客户限制
COO
关税和贸易条件
```

不满足当前客户或目的地要求的供给不能分配。

## 2.6 Agent 36：市场价格和库存

提供：

```text
授权 Offer
Available Stock
Expected Stock
Lead Time
Price Tier
Packaging
Freshness
```

Expected Stock 只能作为潜在供给，不得当作确认收货。

## 2.7 Agent 37：风险

提供：

```text
单一来源
库存深度
交期风险
供应商风险
区域风险
Hard Trigger
```

用于供应商分配、缓冲和审批。

## 2.8 Agent 38：采购包装

提供：

```text
采购数量
MOQ/SPQ
包装
供应商分单
现金支出
剩余库存
```

Agent 40 用它生成 PR Line 和 Call-off 数量。

## 2.9 Agent 39：成本和预算

提供：

```text
采购预算
成本影响
现金流
价格 Floor/Approval
项目利润影响
```

Agent 40 不重新计算报价利润，只消费预算和成本限制。

---

# 3. 核心原则

## 3.1 需求、供给和建议分开

```text
Demand
Confirmed Supply
Planned Supply
Suggested Action
```

采购申请和建议不能提前计入确认供给。

## 3.2 OPO 不是一个总数

OPO 必须保存：

```text
PO
Line
Schedule
Ordered Quantity
Received Quantity
Open Quantity
Supplier Confirmed Quantity
Promise Date
Requested Date
ETA
Ship Status
Inspection Status
```

一张 PO 可以多行、多 Schedule、多次到货。

## 3.3 ETA 有来源和可信度

区分：

```text
supplier confirmed date
ASN ship date
carrier ETA
internal calculated ETA
historical estimate
manual estimate
unknown
```

供应商 Promise Date 不等于仓库可用日期。

## 3.4 到货不等于可用

```text
dock arrival
customs clearance
receiving
IQC
putaway
production release
```

供给日期应使用：

```text
available_to_use_date
```

## 3.5 时间分段是核心

不能只计算“总需求减总库存”。

例如：

```text
现有库存 1000
第 1 周需求 800
第 2 周需求 800
第 4 周 OPO 到货 1000
```

第 2 周仍然会缺 600。

## 3.6 Pegging 必须可解释

每个需求必须知道由什么供给满足：

```text
Demand → Inventory Lot / OPO Schedule / Planned PR / Call-off
```

每个供给也要知道分配给哪些需求。

## 3.7 优先级必须版本化

优先级可来自：

```text
客户等级
订单承诺日期
工单状态
产品关键性
项目阶段
收入影响
停线成本
售后义务
人工锁定
```

不能使用隐藏规则。

## 3.8 已承诺分配不可随意抢占

支持：

```text
soft allocation
firm allocation
frozen allocation
customer-reserved
```

重新分配必须记录原因和审批。

## 3.9 缺料状态必须区分

```text
covered
covered_by_unconfirmed_supply
at_risk
shortage
critical_shortage
blocked
excess
reschedule_in
reschedule_out
cancel_candidate
```

## 3.10 编排不等于复制业务逻辑

Agent 40 应通过 Adapter 调用上游专业 Agent，而不是把价格、替代、风险、包装和利润算法复制进来。

## 3.11 所有动作默认是草稿

```text
PR Draft
Supplier Allocation Suggestion
Expedite Draft
Call-off Draft
Reschedule Suggestion
Cancel Suggestion
```

只有显式审批后才写回执行系统。

## 3.12 Unknown 不是 Confirmed

缺失 Promise Date、ETA、供应商确认或数量时：

```text
supply_reliability = unknown
```

不能视为已覆盖。

## 3.13 计划结果必须可重放

保存：

```text
planning run
input snapshot hashes
planning calendar
policy version
priority version
pegging trace
action generation trace
```

---

# 4. 计划对象

```text
Demand Order
Supply Order
Inventory Lot
Planning Item
Planning Location
Planning Organization
Planning Bucket
Pegging Link
Shortage
Procurement Action
Collaboration Task
```

---

# 5. 需求来源

支持：

```text
sales order
forecast
work order
planned work order
prototype request
pilot build
engineering sample
service/repair
safety stock
intercompany demand
subcontract demand
manual demand
```

每条 Demand 保存：

```text
demand_id
source_type
source_id
part_id
quantity
need_date
priority
organization
site
warehouse
customer
project
product
bom revision
status
firmness
```

---

# 6. 供给来源

```text
on-hand inventory
available inventory lot
confirmed OPO
unconfirmed OPO
ASN
in-transit
supplier consignment
VMI
blanket order call-off capacity
subcontract WIP
internal work order receipt
intercompany transfer
planned purchase requisition
market available stock
```

仅以下默认属于 Confirmed Supply：

```text
usable on-hand
released WIP receipt
supplier-confirmed OPO schedule
ASN/in-transit with valid quantity
approved intercompany transfer
```

具体策略版本化。

---

# 7. 库存状态

```text
available
allocated
reserved
customer_owned
consigned
quality_hold
quarantine
blocked
expired
engineering_only
opened
rework
scrap
in_transit
```

可用量：

```text
usable_inventory =
on_hand
- allocated
- reserved
- quarantine
- quality_hold
- expired
- incompatible
```

## 7.1 Lot 属性

```text
lot
serial
date code
expiry
MSL
customer scope
country of origin
compliance
warehouse
bin
packaging
quality status
```

---

# 8. OPO 数据模型

OPO 解释为 Open Purchase Order。

层级：

```text
Purchase Order
→ PO Line
→ Delivery Schedule
→ Receipt
```

每个 Schedule 保存：

```text
ordered quantity
received quantity
cancelled quantity
open quantity
requested date
supplier promise date
confirmed date
ship date
carrier ETA
warehouse ETA
available-to-use ETA
confirmation status
expedite status
```

## 8.1 OPO Reliability

输入：

```text
supplier confirmation
ASN
carrier tracking
historical on-time delivery
promise changes
partial receipts
```

输出：

```text
confirmed
probable
at_risk
unconfirmed
late
unknown
```

---

# 9. ETA 层级

```text
requested_delivery_date
supplier_promise_date
planned_ship_date
actual_ship_date
carrier_eta
customs_clearance_eta
warehouse_receipt_eta
quality_release_eta
available_to_use_eta
```

真正用于计划的是：

```text
available_to_use_eta
```

---

# 10. 工单需求

工单保存：

```text
work_order_id
product
BOM revision
variant
planned start
planned completion
quantity
site
line
status
priority
freeze status
```

组件需求：

```text
component_need_date =
work_order_start
- kitting lead time
- inspection/repack/bake lead time
```

不能默认等于工单开工日。

---

# 11. BOM 展开

支持：

```text
multi-level BOM
phantom assembly
subassembly
make/buy
effectivity date
revision
variant
DNP
alternate BOM
scrap factor
yield
```

需要防止：

```text
circular BOM
duplicate explosion
wrong revision
```

---

# 12. 净需求计算

对每个 Part、Location 和 Bucket：

```text
projected_available[t] =
projected_available[t-1]
+ confirmed_receipts[t]
+ released_internal_supply[t]
- gross_demand[t]
- safety_stock_requirement[t]
```

若小于 0：

```text
net_requirement[t] = abs(projected_available[t])
```

Planned Supply 不能在生成后直接算作 Confirmed。

---

# 13. 时间桶

支持：

```text
daily
weekly
monthly
hybrid
```

推荐：

```text
0–30 days: daily
31–90 days: weekly
91–365 days: monthly
```

Bucket 配置版本化。

---

# 14. 计划区间

```text
frozen zone
firm zone
planning zone
```

## Frozen Zone

禁止自动改变已确认工单和采购，仅生成异常和审批。

## Firm Zone

允许有限调整，需要批准。

## Planning Zone

可自动生成建议。

---

# 15. Pegging

Pegging 类型：

```text
inventory_to_demand
opo_to_demand
work_order_receipt_to_demand
transfer_to_demand
planned_pr_to_demand
calloff_to_demand
```

字段：

```text
demand_id
supply_id
quantity
need_date
supply_date
allocation_status
firmness
priority reason
```

支持：

```text
single-level pegging
full pegging
where-used impact
```

---

# 16. 稀缺物料分配

分配优先级可综合：

```text
frozen work order
customer committed date
customer priority
line-stop impact
product criticality
revenue impact
service obligation
manual lock
```

建议使用 Lexicographic Priority：

```text
1. 法律/安全/售后硬义务
2. 已冻结工单
3. 客户承诺
4. 停线影响
5. 商业优先级
6. 普通预测
```

同级再按：

```text
need date
shortage severity
fair allocation
```

---

# 17. 抢占和重分配

支持：

```text
no preemption
soft preemption
approved preemption
emergency preemption
```

重分配输出：

```text
from demand
to demand
quantity
reason
impact
approval required
```

不可静默修改。

---

# 18. 齐套率

工单齐套率：

```text
kitting_completeness =
ready component lines / required component lines
```

还需数量齐套：

```text
quantity_completeness =
sum(min(available, required)) / total required
```

Critical Component 缺失时，即使总体齐套率 99%，也可能不可开工。

---

# 19. 最早可开工日期

```text
earliest_start =
max(
  all critical component available-to-use dates,
  material preparation completion,
  quality release,
  line availability
)
```

Agent 40 可输出建议，不直接修改排程。

---

# 20. 缺料分类

```text
identity_blocked
no_supply
supply_late
supply_unconfirmed
quantity_short
quality_hold
compliance_blocked
packaging_blocked
date_code_blocked
allocation_conflict
supplier_risk
regional_risk
budget_blocked
approval_blocked
```

---

# 21. 缺料严重度

```text
critical
high
medium
low
watch
unknown
```

输入：

```text
days_to_need
shortage quantity
work order frozen
line-stop impact
customer commitment
alternative availability
expedite possibility
```

Hard Trigger：

```text
frozen_work_order_shortage
line_stop_within_3_days
no_approved_source
critical_component_quality_hold
only_supply_late_beyond_commitment
```

---

# 22. 缺料表

字段：

```text
part
description
internal part number
MPN
shortage quantity
need date
available date
days late
affected work orders
affected sales orders
current allocation
OPO status
supplier
ETA reliability
approved alternative
recommended action
owner
status
```

---

# 23. 采购申请 PR 草稿

PR Line：

```text
part
ordering variant
request quantity
need-by date
ship-to
preferred supplier
preferred distributor SKU
packaging
estimated unit price
budget
project/account
reason
pegged demand
approval
```

数量来自 Agent 38，不直接用净需求原数。

---

# 24. 供应商分配

输入：

```text
Agent 36 Offer
Agent 37 Risk
Agent 38 Packaging Plan
Agent 39 Budget
Supplier Performance
Contract/Blanket Capacity
```

约束：

```text
authorized
approved vendor
compliance
delivery
packaging
MOQ/SPQ
budget
max allocation
regional limit
supplier capacity
```

输出：

```text
supplier
SKU
quantity
price
packaging
need date
delivery confidence
risk
reason
```

---

# 25. OPO 催交清单

动作：

```text
expedite
confirm
pull-in
split shipment
ship partial
upgrade freight
reschedule-out
cancel
close residual
```

催交项：

```text
PO
line
schedule
supplier
open quantity
original promise
current promise
need date
days gap
affected demands
suggested action
priority
owner
contact
last follow-up
next follow-up
```

---

# 26. Promise Date 变化

保存历史：

```text
promise_date_history
change count
cumulative delay
last change
reason
```

供应商反复推迟时提高 Reliability Risk。

---

# 27. Call 料定义

Call 料适用于：

```text
Blanket Purchase Order
Framework Agreement
Schedule Agreement
VMI
Consignment
Reserved Supplier Stock
```

Call-off 不是新价格询价，而是从已存在合同或额度中释放数量和交期。

Call-off 必须验证：

```text
agreement active
remaining commitment
part/SKU covered
price valid
minimum call quantity
call multiple
lead time
delivery window
site
currency
```

---

# 28. Call 料表

字段：

```text
agreement
supplier
part
SKU
call quantity
need date
requested delivery
remaining agreement quantity
price
currency
minimum call
call multiple
ship-to
pegged demand
priority
approval
```

---

# 29. Blanket Order 余额

```text
committed quantity
called quantity
received quantity
cancelled quantity
remaining callable quantity
minimum commitment
expiration
```

不得超量 Call-off 或使用过期协议。

---

# 30. 采购与 Call-off 决策

优先顺序可配置：

```text
usable inventory
confirmed inbound
existing OPO
blanket call-off
intercompany transfer
new PR
market purchase
approved substitute
```

不是固定规则，需按租户和物料类别配置。

---

# 31. Reschedule-In

当 OPO 晚于需求：

```text
pull-in date
partial quantity
expedite mode
cost impact
supplier feasibility
```

---

# 32. Reschedule-Out

当供给过早或库存过量：

```text
push-out date
reduce quantity
cancel residual
cash release
inventory reduction
supplier penalty
```

必须考虑合同和取消条款。

---

# 33. Cancel Candidate

仅生成建议：

```text
excess supply
demand cancelled
duplicate PO
alternative selected
product sunset
```

正式取消需采购审批和供应商确认。

---

# 34. 库存调拨

支持：

```text
warehouse transfer
site transfer
intercompany transfer
project reallocation
```

检查：

```text
ownership
customer scope
tax/customs
transfer lead time
packaging
quality
cost
```

---

# 35. 替代料缓解

只有 Agent 33 已批准替代进入：

```text
substitution candidate
```

仍需检查：

```text
current project approval
customer
site
BOM revision
stock
packaging
compliance
```

Agent 40 生成：

```text
engineering change task
temporary deviation request
allocation suggestion
```

不自动改 BOM。

---

# 36. 分批生产

当物料只能部分满足时：

```text
available build quantity
remaining shortage
first batch date
second batch date
```

计算：

```text
buildable_units =
min_over_components(
  available_component_quantity / quantity_per
)
```

考虑关键组件、损耗和共享物料。

---

# 37. 生产优先级调整

Agent 可建议：

```text
swap work order sequence
split work order
delay lower priority order
advance build with available materials
```

但不直接改 APS/MES 排程。

---

# 38. 协同任务

任务类型：

```text
procurement_confirm
supplier_expedite
supplier_calloff
engineering_substitute_review
quality_release
warehouse_transfer
planning_reschedule
sales_customer_communication
finance_budget_approval
management_escalation
```

每项保存：

```text
owner
due date
priority
linked shortage
linked PO/work order
required evidence
status
```

---

# 39. War Room

支持按：

```text
critical shortage
customer
product
factory
week
supplier
```

建立协同空间。

视图：

```text
Shortage Board
Work Order Impact
OPO/ETA
Supplier Actions
Alternatives
Decisions
Timeline
Audit
```

---

# 40. 标准请求

```json
{
  "planning_request_id": "uuid",

  "scope": {
    "tenant_id": "uuid",
    "organizations": ["factory-suzhou"],
    "warehouses": ["main", "iqc"],
    "horizon_start": "2026-07-20",
    "horizon_end": "2027-01-31"
  },

  "demand": {
    "sales_order_version": "so-2026-07-20",
    "forecast_version": "forecast-v12",
    "work_order_snapshot": "wo-v33",
    "include_planned_orders": true
  },

  "supply": {
    "inventory_snapshot": "inventory-2026-07-20T12:00",
    "opo_snapshot": "opo-v41",
    "in_transit_snapshot": "asn-v8",
    "include_unconfirmed_supply": true
  },

  "policy": {
    "planning_policy_version": "procurement-plan-1.0.0",
    "priority_policy_version": "priority-v3",
    "calendar_version": "calendar-2026",
    "authorized_source_mode": "authorized_only"
  },

  "options": {
    "create_pr_drafts": true,
    "create_calloff_drafts": true,
    "create_collaboration_tasks": true,
    "refresh_market_data": false,
    "run_scenarios": true
  }
}
```

---

# 41. 标准结果

```json
{
  "planning_run_id": "uuid",
  "status": "review_required",

  "summary": {
    "planning_items": 12800,
    "demands": 45000,
    "shortage_items": 328,
    "critical_shortages": 21,
    "affected_work_orders": 46,
    "pr_drafts": 190,
    "calloff_drafts": 34,
    "expedite_items": 58
  },

  "outputs": {
    "shortage_report_uri": "s3://.../shortages.json.zst",
    "pegging_uri": "s3://.../pegging.json.zst",
    "pr_drafts_uri": "s3://.../pr-drafts.json",
    "supplier_allocation_uri": "s3://.../supplier-allocation.json",
    "expedite_list_uri": "s3://.../expedite.json",
    "calloff_list_uri": "s3://.../calloff.json",
    "work_order_readiness_uri": "s3://.../wo-readiness.json"
  },

  "created_at": "ISO-8601"
}
```

---

# 42. 状态机

```text
RECEIVED
→ LOADING_SCOPE
→ LOADING_DEMAND
→ LOADING_BOM_AND_ROUTING
→ EXPLODING_REQUIREMENTS
→ LOADING_INVENTORY
→ LOADING_OPO_AND_ASN
→ NORMALIZING_ETA
→ LOADING_ALTERNATIVES
→ LOADING_MARKET_AND_PACKAGING
→ LOADING_RISK_AND_BUDGET
→ BUILDING_TIME_BUCKETS
→ NETTING_SUPPLY_AND_DEMAND
→ BUILDING_PEGGING
→ ALLOCATING_SCARCE_SUPPLY
→ CALCULATING_SHORTAGES
→ CALCULATING_WORK_ORDER_READINESS
→ GENERATING_PR_DRAFTS
→ GENERATING_SUPPLIER_ALLOCATION
→ GENERATING_EXPEDITE_ACTIONS
→ GENERATING_CALLOFF_DRAFTS
→ GENERATING_RESCHEDULE_ACTIONS
→ CREATING_COLLABORATION_TASKS
→ RUNNING_SCENARIOS
→ STORING_RESULTS
→ REVIEW_REQUIRED_OR_COMPLETED
```

分支：

```text
COMPLETED
COMPLETED_WITH_UNCONFIRMED_SUPPLY
COMPLETED_WITH_STALE_INPUTS
REVIEW_REQUIRED
DEMAND_INCOMPLETE
SUPPLY_INCOMPLETE
IDENTITY_BLOCKED
NO_FEASIBLE_SUPPLY
BUDGET_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 43. 错误码

```text
PLANNING_SCOPE_MISSING
PLANNING_HORIZON_INVALID
CALENDAR_MISSING
DEMAND_SNAPSHOT_MISSING
SALES_ORDER_DATA_MISSING
FORECAST_DATA_MISSING
WORK_ORDER_DATA_MISSING
BOM_NOT_FOUND
BOM_REVISION_MISMATCH
BOM_CYCLE_DETECTED
PART_IDENTITY_UNRESOLVED
INVENTORY_SNAPSHOT_MISSING
OPO_SNAPSHOT_MISSING
PO_SCHEDULE_INVALID
ETA_MISSING
ETA_CONFLICT
SUPPLIER_CONFIRMATION_MISSING
IN_TRANSIT_DATA_MISSING
QUALITY_STATUS_UNKNOWN
ALLOCATION_CONFLICT
CUSTOMER_SCOPE_CONFLICT
COMPLIANCE_BLOCKED
ALTERNATIVE_NOT_APPROVED
PACKAGING_PLAN_MISSING
MARKET_DATA_STALE
RISK_DATA_MISSING
BUDGET_BLOCKED
BLANKET_AGREEMENT_NOT_FOUND
BLANKET_AGREEMENT_EXPIRED
CALLOFF_QUANTITY_EXCEEDS_BALANCE
NO_FEASIBLE_SUPPLY
PR_GENERATION_FAILED
PEPPING_INCONSISTENT
PLANNING_RUN_CANCELLED
INTERNAL_ERROR
```

实现时将拼写错误的：

```text
PEPPING_INCONSISTENT
```

修正为：

```text
PEGGING_INCONSISTENT
```


---

# 44. 数据库设计

## 44.1 `procurement_planning_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
scope JSONB NOT NULL
horizon_start DATE NOT NULL
horizon_end DATE NOT NULL
demand_versions JSONB NOT NULL
supply_versions JSONB NOT NULL
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

## 44.2 `planning_input_snapshots`

```text
id UUID PK
planning_run_id UUID NOT NULL
sales_orders_uri TEXT NULL
forecast_uri TEXT NULL
work_orders_uri TEXT NULL
bom_snapshot_uri TEXT NOT NULL
inventory_uri TEXT NOT NULL
opo_uri TEXT NULL
asn_in_transit_uri TEXT NULL
supplier_confirmations_uri TEXT NULL
market_snapshot_uri TEXT NULL
alternative_snapshot_uri TEXT NULL
risk_snapshot_uri TEXT NULL
budget_snapshot_uri TEXT NULL
calendar_snapshot_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id)
```

## 44.3 `planning_demands`

```text
id UUID PK
planning_run_id UUID NOT NULL
demand_key VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_id UUID NULL
source_line_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
organization_id UUID NOT NULL
site_id UUID NULL
warehouse_id UUID NULL
project_id UUID NULL
product_id UUID NULL
customer_id UUID NULL
bom_revision VARCHAR NULL
gross_quantity NUMERIC NOT NULL
remaining_quantity NUMERIC NOT NULL
need_date DATE NOT NULL
priority_class VARCHAR NOT NULL
priority_score NUMERIC NULL
firmness VARCHAR NOT NULL
freeze_status VARCHAR NOT NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, demand_key)
```

## 44.4 `planning_supplies`

```text
id UUID PK
planning_run_id UUID NOT NULL
supply_key VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_id UUID NULL
source_line_id UUID NULL
source_schedule_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
organization_id UUID NOT NULL
site_id UUID NULL
warehouse_id UUID NULL
supplier_id UUID NULL
quantity NUMERIC NOT NULL
remaining_quantity NUMERIC NOT NULL
supply_date DATE NOT NULL
available_to_use_date DATE NOT NULL
confirmation_status VARCHAR NOT NULL
reliability_status VARCHAR NOT NULL
reliability_score NUMERIC NULL
quality_status VARCHAR NULL
compliance_status VARCHAR NULL
packaging_status VARCHAR NULL
firmness VARCHAR NOT NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, supply_key)
```

## 44.5 `inventory_planning_lots`

```text
id UUID PK
planning_run_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
organization_id UUID NOT NULL
warehouse_id UUID NOT NULL
bin_id UUID NULL
quantity_on_hand NUMERIC NOT NULL
quantity_allocated NUMERIC NOT NULL
quantity_reserved NUMERIC NOT NULL
quantity_quarantine NUMERIC NOT NULL
quantity_quality_hold NUMERIC NOT NULL
quantity_expired NUMERIC NOT NULL
quantity_usable NUMERIC NOT NULL
packaging_type VARCHAR NULL
lot_number VARCHAR NULL
date_code VARCHAR NULL
expiry_date DATE NULL
msl_status VARCHAR NULL
customer_scope JSONB NOT NULL
compliance_scope JSONB NOT NULL
quality_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, inventory_lot_id)
```

## 44.6 `open_purchase_order_schedules`

```text
id UUID PK
planning_run_id UUID NOT NULL
purchase_order_id UUID NOT NULL
purchase_order_line_id UUID NOT NULL
schedule_id UUID NOT NULL
supplier_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
ordered_quantity NUMERIC NOT NULL
received_quantity NUMERIC NOT NULL
cancelled_quantity NUMERIC NOT NULL
open_quantity NUMERIC NOT NULL
requested_date DATE NULL
original_promise_date DATE NULL
current_promise_date DATE NULL
planned_ship_date DATE NULL
actual_ship_date DATE NULL
carrier_eta DATE NULL
warehouse_eta DATE NULL
quality_release_eta DATE NULL
available_to_use_eta DATE NULL
confirmation_status VARCHAR NOT NULL
reliability_status VARCHAR NOT NULL
promise_change_count INT NOT NULL
cumulative_delay_days INT NOT NULL
last_followup_at TIMESTAMPTZ NULL
next_followup_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
snapshot_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, schedule_id)
```

## 44.7 `planning_time_buckets`

```text
id UUID PK
planning_run_id UUID NOT NULL
bucket_start DATE NOT NULL
bucket_end DATE NOT NULL
bucket_type VARCHAR NOT NULL
sequence INT NOT NULL
working_days NUMERIC NOT NULL
UNIQUE(planning_run_id, sequence)
```

## 44.8 `planning_item_bucket_balances`

```text
id UUID PK
planning_run_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
organization_id UUID NOT NULL
warehouse_id UUID NULL
bucket_id UUID NOT NULL
beginning_available NUMERIC NOT NULL
gross_demand NUMERIC NOT NULL
confirmed_receipts NUMERIC NOT NULL
unconfirmed_receipts NUMERIC NOT NULL
safety_stock_requirement NUMERIC NOT NULL
projected_available NUMERIC NOT NULL
net_requirement NUMERIC NOT NULL
planned_receipt NUMERIC NOT NULL
planned_release NUMERIC NOT NULL
status VARCHAR NOT NULL
trace_uri TEXT NOT NULL
UNIQUE(planning_run_id, part_id, ordering_variant_id, organization_id, warehouse_id, bucket_id)
```

## 44.9 `planning_pegging_links`

```text
id UUID PK
planning_run_id UUID NOT NULL
demand_id UUID NOT NULL
supply_id UUID NOT NULL
quantity NUMERIC NOT NULL
allocation_type VARCHAR NOT NULL
firmness VARCHAR NOT NULL
priority_rank INT NOT NULL
need_date DATE NOT NULL
supply_date DATE NOT NULL
days_early_late INT NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 44.10 `planning_allocation_conflicts`

```text
id UUID PK
planning_run_id UUID NOT NULL
part_id UUID NOT NULL
supply_id UUID NULL
demand_ids JSONB NOT NULL
available_quantity NUMERIC NOT NULL
requested_quantity NUMERIC NOT NULL
conflict_type VARCHAR NOT NULL
recommended_resolution JSONB NOT NULL
approval_required BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 44.11 `material_shortages`

```text
id UUID PK
planning_run_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
organization_id UUID NOT NULL
warehouse_id UUID NULL
shortage_date DATE NOT NULL
shortage_quantity NUMERIC NOT NULL
shortage_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
days_to_need INT NOT NULL
earliest_available_date DATE NULL
days_late INT NULL
affected_work_order_ids JSONB NOT NULL
affected_sales_order_ids JSONB NOT NULL
affected_project_ids JSONB NOT NULL
approved_alternative_ids JSONB NOT NULL
reason_codes JSONB NOT NULL
recommended_actions JSONB NOT NULL
owner_role VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, part_id, ordering_variant_id, organization_id, warehouse_id, shortage_date)
```

## 44.12 `work_order_readiness_results`

```text
id UUID PK
planning_run_id UUID NOT NULL
work_order_id UUID NOT NULL
planned_start_date DATE NOT NULL
earliest_material_ready_date DATE NULL
line_readiness_date DATE NULL
recommended_start_date DATE NULL
line_count INT NOT NULL
ready_line_count INT NOT NULL
critical_missing_line_count INT NOT NULL
kitting_completeness NUMERIC NOT NULL
quantity_completeness NUMERIC NOT NULL
buildable_quantity NUMERIC NOT NULL
planned_quantity NUMERIC NOT NULL
readiness_status VARCHAR NOT NULL
shortage_ids JSONB NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, work_order_id)
```

## 44.13 `procurement_requisition_drafts`

```text
id UUID PK
planning_run_id UUID NOT NULL
tenant_id UUID NOT NULL
draft_number VARCHAR NOT NULL
organization_id UUID NOT NULL
requesting_site_id UUID NULL
requester_id UUID NULL
currency CHAR(3) NULL
budget_status VARCHAR NOT NULL
status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
source_shortage_ids JSONB NOT NULL
draft_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, draft_number)
```

## 44.14 `procurement_requisition_draft_lines`

```text
id UUID PK
requisition_draft_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
preferred_supplier_id UUID NULL
preferred_distributor_sku VARCHAR NULL
request_quantity NUMERIC NOT NULL
packaging_type VARCHAR NULL
need_by_date DATE NOT NULL
ship_to_site_id UUID NULL
estimated_unit_price NUMERIC NULL
currency CHAR(3) NULL
estimated_total NUMERIC NULL
budget_account_id UUID NULL
project_id UUID NULL
pegged_demand_ids JSONB NOT NULL
source_plan_id UUID NULL
reason_codes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.15 `supplier_allocation_suggestions`

```text
id UUID PK
planning_run_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
supplier_id UUID NOT NULL
offer_snapshot_id UUID NULL
agreement_id UUID NULL
allocation_quantity NUMERIC NOT NULL
packaging_type VARCHAR NULL
requested_delivery_date DATE NOT NULL
expected_available_date DATE NULL
estimated_unit_price NUMERIC NULL
currency CHAR(3) NULL
delivery_confidence NUMERIC NULL
risk_level VARCHAR NULL
allocation_rank INT NOT NULL
reason_codes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.16 `opo_expedite_actions`

```text
id UUID PK
planning_run_id UUID NOT NULL
opo_schedule_id UUID NOT NULL
action_type VARCHAR NOT NULL
priority VARCHAR NOT NULL
requested_quantity NUMERIC NULL
requested_date DATE NULL
current_promise_date DATE NULL
target_promise_date DATE NULL
days_gap INT NULL
affected_shortage_ids JSONB NOT NULL
estimated_cost_impact NUMERIC NULL
currency CHAR(3) NULL
owner_id UUID NULL
supplier_contact_id UUID NULL
draft_message_uri TEXT NULL
status VARCHAR NOT NULL
last_action_at TIMESTAMPTZ NULL
next_action_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 44.17 `blanket_purchase_agreements`

```text
id UUID PK
tenant_id UUID NOT NULL
agreement_number VARCHAR NOT NULL
supplier_id UUID NOT NULL
organization_id UUID NOT NULL
currency CHAR(3) NOT NULL
valid_from DATE NOT NULL
valid_to DATE NOT NULL
status VARCHAR NOT NULL
minimum_commitment NUMERIC NULL
maximum_commitment NUMERIC NULL
terms_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, agreement_number)
```

## 44.18 `blanket_agreement_lines`

```text
id UUID PK
agreement_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
supplier_sku VARCHAR NULL
committed_quantity NUMERIC NOT NULL
called_quantity NUMERIC NOT NULL
received_quantity NUMERIC NOT NULL
cancelled_quantity NUMERIC NOT NULL
remaining_callable_quantity NUMERIC NOT NULL
unit_price NUMERIC NOT NULL
currency CHAR(3) NOT NULL
minimum_call_quantity NUMERIC NULL
call_multiple NUMERIC NULL
lead_time_days INT NULL
ship_to_scope JSONB NOT NULL
status VARCHAR NOT NULL
UNIQUE(agreement_id, part_id, ordering_variant_id, supplier_sku)
```

## 44.19 `calloff_drafts`

```text
id UUID PK
planning_run_id UUID NOT NULL
agreement_id UUID NOT NULL
supplier_id UUID NOT NULL
draft_number VARCHAR NOT NULL
requested_delivery_date DATE NOT NULL
ship_to_site_id UUID NOT NULL
status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
source_shortage_ids JSONB NOT NULL
draft_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(planning_run_id, draft_number)
```

## 44.20 `calloff_draft_lines`

```text
id UUID PK
calloff_draft_id UUID NOT NULL
agreement_line_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
call_quantity NUMERIC NOT NULL
unit_price NUMERIC NOT NULL
currency CHAR(3) NOT NULL
need_by_date DATE NOT NULL
pegged_demand_ids JSONB NOT NULL
remaining_after_call NUMERIC NOT NULL
reason_codes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.21 `planning_collaboration_tasks`

```text
id UUID PK
planning_run_id UUID NOT NULL
task_type VARCHAR NOT NULL
title VARCHAR NOT NULL
linked_object_type VARCHAR NOT NULL
linked_object_id UUID NOT NULL
owner_role VARCHAR NOT NULL
assigned_to UUID NULL
priority VARCHAR NOT NULL
due_at TIMESTAMPTZ NULL
required_evidence JSONB NOT NULL
status VARCHAR NOT NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 44.22 `planning_decisions`

```text
id UUID PK
planning_run_id UUID NOT NULL
decision_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
old_value JSONB NULL
new_value JSONB NOT NULL
reason_code VARCHAR NOT NULL
requested_by UUID NOT NULL
approved_by UUID NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 44.23 `planning_run_reviews`

```text
id UUID PK
planning_run_id UUID NOT NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
assigned_to UUID NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 45. 对象存储

```text
derived/procurement-planning/
  {tenant_id}/{planning_run_id}/
    input/
      scope.json
      sales-orders.json.zst
      forecast.json.zst
      work-orders.json.zst
      bom-snapshot.json.zst
      inventory-lots.json.zst
      opo-schedules.json.zst
      asn-in-transit.json.zst
      supplier-confirmations.json.zst
      alternatives.json.zst
      market-packaging.json.zst
      risk.json.zst
      budget.json
      calendars.json
      policies.json
    explosion/
      demand-explosion.json.zst
      circular-bom-report.json
      requirement-trace.json.zst
    planning/
      time-buckets.json
      item-bucket-balances.json.zst
      pegging.json.zst
      allocation-conflicts.json
      supply-reliability.json.zst
    shortages/
      shortage-lines.json.zst
      critical-shortages.json
      work-order-impact.json.zst
      sales-order-impact.json.zst
    actions/
      pr-drafts.json
      supplier-allocation.json
      expedite-list.json
      calloff-drafts.json
      reschedule-actions.json
      transfer-actions.json
      collaboration-tasks.json
    readiness/
      work-order-readiness.json.zst
      buildable-quantity.json.zst
    scenarios/
      supplier-delay.json
      demand-increase.json
      region-disruption.json
    reports/
      planning-summary.json
      shortage-report.json
      opo-health-report.json
      calloff-balance-report.json
      quality-report.json
      stale-input-report.json
    debug/
      netting-trace.json.zst
      priority-trace.json.zst
      action-generation-trace.json.zst
```

---

# 46. API 设计

## 46.1 Planning Run

```text
POST /api/v1/procurement-planning/runs
POST /api/v1/procurement-planning/runs/batches
GET  /api/v1/procurement-planning/runs/{id}
GET  /api/v1/procurement-planning/runs/{id}/events
POST /api/v1/procurement-planning/runs/{id}/rerun
POST /api/v1/procurement-planning/runs/{id}/cancel
POST /api/v1/procurement-planning/runs/{id}/simulate
```

## 46.2 Shortage

```text
GET /api/v1/procurement-planning/runs/{id}/shortages
GET /api/v1/procurement-planning/shortages/{id}
GET /api/v1/procurement-planning/shortages/{id}/impact
GET /api/v1/procurement-planning/shortages/{id}/pegging
POST /api/v1/procurement-planning/shortages/{id}/assign
POST /api/v1/procurement-planning/shortages/{id}/accept-risk
```

## 46.3 Work Order Readiness

```text
GET /api/v1/procurement-planning/runs/{id}/work-orders
GET /api/v1/procurement-planning/work-orders/{id}/readiness
GET /api/v1/procurement-planning/work-orders/{id}/shortages
```

## 46.4 Procurement Requisition

```text
GET  /api/v1/procurement-planning/runs/{id}/pr-drafts
GET  /api/v1/procurement-planning/pr-drafts/{id}
POST /api/v1/procurement-planning/pr-drafts/{id}/submit
POST /api/v1/procurement-planning/pr-drafts/{id}/revise
POST /api/v1/procurement-planning/pr-drafts/{id}/approve
POST /api/v1/procurement-planning/pr-drafts/{id}/create-pr
```

`create-pr` 创建正式采购申请，不创建 PO。

## 46.5 OPO 和催交

```text
GET  /api/v1/procurement-planning/runs/{id}/expedite-actions
GET  /api/v1/procurement-planning/opo/{schedule_id}
GET  /api/v1/procurement-planning/opo/{schedule_id}/promise-history
POST /api/v1/procurement-planning/expedite-actions/{id}/approve
POST /api/v1/procurement-planning/expedite-actions/{id}/send
POST /api/v1/procurement-planning/expedite-actions/{id}/record-response
```

## 46.6 Call-off

```text
GET  /api/v1/procurement-planning/runs/{id}/calloff-drafts
GET  /api/v1/procurement-planning/calloff-drafts/{id}
POST /api/v1/procurement-planning/calloff-drafts/{id}/submit
POST /api/v1/procurement-planning/calloff-drafts/{id}/approve
POST /api/v1/procurement-planning/calloff-drafts/{id}/create-calloff
```

## 46.7 Collaboration

```text
GET  /api/v1/procurement-planning/runs/{id}/tasks
POST /api/v1/procurement-planning/tasks/{id}/assign
POST /api/v1/procurement-planning/tasks/{id}/complete
POST /api/v1/procurement-planning/reviews/{id}/resolve
```

## 46.8 Pegging 和报表

```text
GET /api/v1/procurement-planning/runs/{id}/pegging
GET /api/v1/procurement-planning/runs/{id}/item-buckets
GET /api/v1/procurement-planning/runs/{id}/opo-health
GET /api/v1/procurement-planning/runs/{id}/calloff-balance
GET /health/live
GET /health/ready
GET /metrics
```

---

# 47. 事件

## 输入事件

```text
bom.normalized.ready
bom.mpn-resolution.ready
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
component.market-data.ready
bom.risk.ready
procurement.packaging-plan.ready
costing.result.ready
inventory.changed
inventory.allocated
inventory.released
purchase-order.created
purchase-order.changed
purchase-order.received
supplier.promise.changed
asn.created
shipment.eta.changed
quality.lot.released
quality.lot.blocked
work-order.created
work-order.changed
production-plan.updated
sales-order.created
sales-order.changed
forecast.updated
blanket-agreement.changed
```

## 输出事件

```text
procurement.plan.ready
procurement.shortage.detected
procurement.shortage.critical
procurement.pr-draft.ready
procurement.calloff-draft.ready
procurement.expedite.required
procurement.reschedule.suggested
work-order.material-readiness.changed
supplier.promise.risk.changed
planning.collaboration-task.created
```

## `procurement.plan.ready`

```json
{
  "event_type": "procurement.plan.ready",
  "event_version": "1.0",
  "planning_run_id": "uuid",
  "scope": {
    "organization": "factory-suzhou",
    "horizon_end": "2027-01-31"
  },
  "summary": {
    "shortage_items": 328,
    "critical_shortages": 21,
    "affected_work_orders": 46,
    "pr_drafts": 190,
    "calloff_drafts": 34,
    "expedite_items": 58
  },
  "result_uri": "s3://.../planning-summary.json",
  "review_status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 48. 编排架构

Agent 40 不应直接耦合所有上游内部表。

推荐：

```text
Planning Orchestrator
├── Demand Adapter
├── Inventory Adapter
├── OPO/ASN Adapter
├── Agent 31–39 Adapters
├── Planning Calendar Service
├── Netting Engine
├── Pegging Engine
├── Allocation Engine
├── Shortage Classifier
├── Procurement Action Generator
├── Collaboration Workflow
└── Write-back Gateways
```

每个 Adapter 输出稳定 Contract。

---

# 49. 编排工作流

```text
Create Planning Run
→ Freeze Input Snapshot
→ Validate Version Compatibility
→ Load/Explode Demand
→ Normalize Supply
→ Calculate Available-to-use Dates
→ Time-phased Netting
→ Peg Supply to Demand
→ Resolve Allocation by Priority
→ Detect Shortages
→ Assess Work-order Readiness
→ Call Agent 38 for Purchase Quantities
→ Call Agent 36 for Selected Offer Refresh when needed
→ Apply Agent 37 Risk Constraints
→ Apply Agent 39 Budget Constraints
→ Generate Draft Actions
→ Human Review
→ Approved Write-back
→ Monitor Execution
```

---

# 50. Saga 和补偿

正式写回动作使用 Saga：

```text
Submit PR Draft
→ Create PR
→ Link PR to Planning Run
→ Publish Event
```

失败补偿：

```text
PR 创建成功但链接失败
→ 重试 Link
→ 不重复创建 PR
```

Call-off、催交发送和任务创建也必须幂等。

---

# 51. 幂等

关键键：

```text
planning_run_id
action_type
source_object
action_version
```

示例：

```text
PR Draft for shortage X and plan version Y
```

重复提交不能产生两个 PR。

---

# 52. Planning Run 类型

```text
full regenerative
net change
event-driven
what-if
manual
nightly
pre-production
```

## Full Regenerative

重建全部需求、供给和 Pegging。

## Net Change

只处理受影响 Part、地点和时间桶。

## What-if

不写回正式系统。

---

# 53. 增量重算

变化影响：

```text
库存变化
→ 对应 Part/Location 的 Pegging 和 Shortage

OPO ETA 变化
→ 对应 Schedule 之后的 Demand

工单数量/日期变化
→ 对应 BOM 展开需求

替代批准
→ 对应 Shortage Candidate

市场 Offer 变化
→ 未覆盖 PR Candidate

预算变化
→ 被预算阻断的 PR
```

---

# 54. 计划日历

需要：

```text
factory working calendar
supplier calendar
warehouse calendar
carrier calendar
customs calendar
holiday calendar
```

Lead Time 使用工作日或自然日必须明确。

---

# 55. Available-to-use Date 计算

```text
available_to_use =
ship date
+ transit
+ customs
+ receiving
+ IQC
+ repack/bake
+ putaway
```

每一步可有：

```text
confirmed
estimated
unknown
```

最终日期带 Confidence。

---

# 56. Supply Reliability Score

可综合：

```text
confirmation status
ASN
carrier tracking
supplier OTD
promise change count
historical delay
current event risk
```

输出：

```text
confirmed
high confidence
medium confidence
low confidence
unknown
```

Score 只辅助，不替代原始状态。

---

# 57. Shortage Horizon

```text
0–3 days
4–7 days
8–14 days
15–30 days
31–90 days
90+ days
```

不同窗口使用不同动作和升级规则。

---

# 58. Procurement Action Priority

建议：

```text
critical frozen shortage
line stop
customer committed shortage
long-lead uncovered demand
LTB/EOL demand
normal planned demand
forecast-only demand
```

---

# 59. PR 合并

PR Lines 可按：

```text
supplier
organization
ship-to
currency
need-date window
project/account
packaging
```

合并。

不能跨以下边界：

```text
tenant
legal entity
customer-owned material
incompatible compliance scope
different currency/account without approval
```

---

# 60. 供应商分配优化

V1 可用规则＋整数分配：

变量：

```text
x_supplier_offer = 分配数量
y_supplier = 是否使用供应商
```

约束：

```text
sum(x) >= purchase requirement
x <= available/contract capacity
MOQ/SPQ from Agent 38
delivery date
budget
risk max allocation
approved vendor
```

目标：

```text
delivery risk
cost
supplier count
source concentration
cash timing
```

正式包装数量仍以 Agent 38 计划为准。

---

# 61. Call-off 优先逻辑

若有效 Blanket Agreement 存在：

```text
agreement remaining quantity
price valid
delivery feasible
```

可优先于新 PR。

但若 Agreement 供应商高风险、交期不满足或余额不足，允许新 PR 方案并列。

---

# 62. 催交通信

Agent 40 可生成结构化催交草稿：

```text
PO/Line/Schedule
open quantity
current promise
required date
business impact
requested action
response deadline
```

默认由批准模板生成，不由 LLM 自由编造承诺或法律语言。

---

# 63. Supplier Response

供应商回复结构化：

```text
confirmed quantity
new promise date
partial shipment
ship method
reason code
confidence
attachment
```

回复后触发增量重算。

---

# 64. 缺料协同 SLA

按严重度：

```text
critical: 2 hours
high: 1 business day
medium: 3 business days
low: 5 business days
```

实际 SLA 由租户配置。

---

# 65. 计划冻结和人工锁定

可锁定：

```text
demand priority
inventory allocation
supplier allocation
OPO schedule
PR quantity
Call-off quantity
work order sequence
```

锁定项进入下一次 Planning Run，直到解除或过期。

---

# 66. 风险接受

支持短期接受：

```text
use unconfirmed supply
use low-confidence ETA
use approved marketplace source
borrow project inventory
build partial quantity
```

必须保存：

```text
scope
quantity
expiry
approver
impact
fallback
```

---

# 67. 审核工作台

布局：

```text
左侧：工厂、产品、工单和时间窗口
中间：供需时间轴、Pegging 和缺料
右侧：PR、OPO、Call-off、催交和协同动作
底部：规则、优先级、决策和审计
```

视图：

```text
Planning Summary
Shortage Table
Work-order Readiness
Supply/Demand Timeline
Pegging
OPO Health
Supplier Allocation
PR Drafts
Call-off
Expedite
Reschedule
Collaboration
Scenario
Audit
```

---

# 68. 缺料时间轴

每个物料显示：

```text
Inventory
Demand
OPO
ASN
Call-off
PR Suggestion
Projected Balance
Shortage Window
```

用户可点击任何节点查看来源。

---

# 69. 关键 Dashboard

```text
Critical Shortage
7/14/30/90 Day Shortage
Work-order Kitting
OPO Late/Unconfirmed
Promise Date Changes
Supplier Expedite
Call-off Balance
PR Pending Approval
Inventory Allocation Conflict
Top Affected Customers
```

---

# 70. Scenario

支持：

```text
supplier_delay_7d
supplier_delay_30d
demand_plus_20
priority_customer_insert
quality_hold
primary_warehouse_unavailable
approved_alternative_enabled
expedite_success
partial_shipment
budget_reduced
```

输出：

```text
new shortage count
affected work orders
new PR amount
expedite count
customer impact
cash impact
```

---

# 71. 数据质量

每个 Planning Run 输出：

```text
identity completeness
BOM revision completeness
inventory freshness
OPO schedule completeness
ETA confidence
supplier confirmation coverage
forecast quality
alternative coverage
packaging plan coverage
budget coverage
calendar coverage
overall planning confidence
```

---

# 72. 可观测性

Metrics：

```text
procurement_planning_runs_total{status,type}
procurement_planning_duration_seconds{step}
procurement_planning_demands_total{source}
procurement_planning_supplies_total{source,reliability}
procurement_planning_shortages_total{severity,type}
procurement_planning_pegging_links_total{type}
procurement_planning_allocation_conflicts_total{type}
procurement_planning_pr_drafts_total{status}
procurement_planning_calloff_drafts_total{status}
procurement_planning_expedite_actions_total{type,status}
procurement_planning_opo_late_total{supplier}
procurement_planning_promise_changes_total{supplier}
procurement_planning_work_order_readiness{status}
procurement_planning_stale_inputs_total{source}
procurement_planning_writeback_failures_total{action}
```

Dashboard：

- Planning Run 健康；
- 需求和供给覆盖；
- 缺料趋势；
- OPO 可靠性；
- 催交闭环；
- PR 转换率；
- Call-off 使用率；
- 工单齐套率；
- ETA 准确率；
- 供应商 Promise 波动；
- 人工抢占和风险接受。

---

# 73. Benchmark

## Demand/BOM

```text
BOM explosion accuracy
revision/effectivity accuracy
DNP/variant accuracy
loss/yield accuracy
work-order need-date accuracy
```

## Supply

```text
usable inventory accuracy
OPO open quantity accuracy
ETA normalization accuracy
available-to-use date accuracy
supply reliability classification
```

## Planning

```text
time-phased balance accuracy
net requirement accuracy
pegging completeness
allocation priority accuracy
shortage date accuracy
shortage quantity accuracy
```

## Actions

```text
PR quantity accuracy
supplier allocation feasibility
expedite classification
call-off balance accuracy
reschedule recommendation
work-order readiness
```

## Workflow

```text
idempotent write-back
approval routing
event replay
incremental recompute
audit reproduction
```

---

# 74. 初始质量目标

```text
BOM Explosion Accuracy >= 99.99%
DNP/Variant Accuracy = 100%
Usable Inventory Accuracy >= 99.9%
OPO Open Quantity Accuracy = 100%
Available-to-use Date Calculation >= 99%
Time-phased Netting Accuracy = 100%
Pegging Quantity Conservation = 100%
Shortage Quantity Accuracy >= 99.9%
Shortage Date Accuracy >= 99%
Frozen Allocation Preservation = 100%
Call-off Remaining Balance Accuracy = 100%
PR Quantity Consistency with Agent 38 = 100%
Write-back Idempotency = 100%
Critical Shortage False-negative Rate <= 0.1%
Audit Replay Consistency = 100%
```

这些是目标，不是未经测试的保证。

---

# 75. 测试集

公开仓库仅使用合成、脱敏或授权 Fixture。

## Demand/BOM

1. Sales Order；
2. Forecast；
3. Work Order；
4. Prototype；
5. Service Demand；
6. Multi-level BOM；
7. Phantom；
8. Alternate BOM；
9. Revision；
10. Effectivity；
11. DNP；
12. Variant；
13. Scrap；
14. Yield；
15. Circular BOM。

## Inventory

16. Available；
17. Allocated；
18. Reserved；
19. Customer-owned；
20. Quarantine；
21. Expired；
22. Quality Hold；
23. Wrong Date Code；
24. Wrong Compliance；
25. Multiple Warehouses；
26. Transfer；
27. Consignment；
28. VMI；
29. Opened Pack；
30. MSL Block。

## OPO/ETA

31. Confirmed OPO；
32. Unconfirmed OPO；
33. Partial Receipt；
34. Cancelled Quantity；
35. Multi Schedule；
36. Supplier Promise；
37. ASN；
38. Carrier ETA；
39. Customs Delay；
40. IQC Delay；
41. Promise Changed；
42. Repeated Delay；
43. Missing ETA；
44. Conflicting ETA；
45. Late OPO。

## Planning/Pegging

46. Inventory to Demand；
47. OPO to Demand；
48. Multiple Demands；
49. Scarce Supply；
50. Frozen Allocation；
51. Soft Reallocation；
52. Priority Customer；
53. Same Priority Fairness；
54. Daily Bucket；
55. Hybrid Bucket；
56. Safety Stock；
57. Negative Projected Balance；
58. Planned PR Not Confirmed；
59. Partial Build；
60. Earliest Start。

## Actions

61. New PR；
62. Agent 38 Quantity；
63. Supplier Split；
64. Budget Block；
65. Expedite；
66. Pull-in；
67. Partial Ship；
68. Upgrade Freight；
69. Reschedule-out；
70. Cancel Candidate；
71. Blanket Call-off；
72. Call Multiple；
73. Agreement Expired；
74. Agreement Insufficient；
75. Transfer Suggestion；
76. Approved Substitute；
77. Unapproved Substitute；
78. Quality Release Task；
79. Sales Communication Task；
80. War Room。

## System

81. Full Regenerative；
82. Net Change；
83. What-if；
84. Inventory Event；
85. ETA Event；
86. Work-order Change；
87. Forecast Change；
88. Partial Upstream Failure；
89. Stale Agent 36 Data；
90. Agent 37 High Risk；
91. Idempotent PR；
92. Idempotent Call-off；
93. Write-back Failure；
94. Saga Compensation；
95. Tenant Isolation；
96. Permission Denied；
97. Cancel Run；
98. Replay；
99. 100k Demands；
100. 1M Pegging Links。

---

# 76. 性能要求

中型工厂：

```text
100,000 Demand Lines
50,000 Supply Lines
500,000 Pegging Links
```

目标：

```text
Net-change P95 < 60 s
Full Run P95 < 10 min
Interactive Shortage Detail P95 < 500 ms
```

大型场景需要：

- Part/Location 分区；
- 时间桶分块；
- 流式 BOM 展开；
- 批量数据库写入；
- 压缩对象存储；
- Pegging 分区；
- 增量运行；
- 可取消；
- 断点恢复。

---

# 77. 缓存和增量

缓存键：

```text
scope
+ demand versions
+ bom revision/effectivity
+ inventory snapshot
+ OPO/ASN snapshot
+ supplier confirmation version
+ alternative version
+ market/package plan version
+ risk version
+ budget version
+ calendar version
+ planning policy version
```

---

# 78. 安全与权限

- 多租户、法人、工厂、仓库和项目隔离；
- 客户专用库存按权限隐藏；
- 合同价格和供应商条款受限；
- PR、Call-off、催交发送和 OPO 变更分别授权；
- Write-back Gateway 使用最小权限；
- 计划人员不能越权批准采购；
- 供应商只能查看分配给自己的协同项；
- 内部优先级和客户收入不暴露给供应商；
- 审批、抢占、风险接受和取消建议全部审计；
- 不将 BOM、库存、采购和客户数据发送给外部通用模型；
- V1 不需要 LLM 参与 Netting、Pegging 或决策；
- 文本催交仅使用受控模板；
- 不执行供应商附件中的宏；
- API 做幂等、重放保护和速率限制；
- 大型 Run 限制资源；
- 下载使用签名 URL。

---

# 79. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
```

工作流：

```text
Temporal 优先
或 Celery / RQ
```

批量计算：

```text
Polars
PyArrow
DuckDB
```

可选优化：

```text
OR-Tools CP-SAT
```

消息：

```text
Kafka / RabbitMQ / Redis Streams
```

V1 不需要 LLM。

---

# 80. 推荐仓库结构

```text
procurement-planning-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── procurement-planning-agent-spec.md
│   ├── demand-supply-domain-model.md
│   ├── opo-eta-model.md
│   ├── time-phased-netting.md
│   ├── pegging-allocation.md
│   ├── shortage-classification.md
│   ├── work-order-readiness.md
│   ├── procurement-action-generation.md
│   ├── blanket-calloff-design.md
│   ├── expedite-collaboration.md
│   ├── orchestration-and-saga.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-planned-supply-is-not-confirmed-supply.md
│       ├── 0002-available-date-is-not-dock-eta.md
│       ├── 0003-pegging-is-first-class.md
│       ├── 0004-actions-are-drafts-before-approval.md
│       ├── 0005-frozen-allocation-is-preserved.md
│       └── 0006-orchestrator-does-not-copy-domain-logic.md
├── src/
│   └── procurement_planning/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── demand.py
│       │   ├── supply.py
│       │   ├── inventory.py
│       │   ├── opo.py
│       │   ├── eta.py
│       │   ├── pegging.py
│       │   ├── shortage.py
│       │   ├── action.py
│       │   └── collaboration.py
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
│       │   ├── inventory.py
│       │   ├── purchasing.py
│       │   ├── production.py
│       │   ├── sales.py
│       │   └── supplier.py
│       ├── orchestration/
│       │   ├── workflow.py
│       │   ├── activities.py
│       │   ├── saga.py
│       │   ├── retries.py
│       │   └── idempotency.py
│       ├── demand/
│       │   ├── loader.py
│       │   ├── explosion.py
│       │   ├── revisions.py
│       │   ├── effectivity.py
│       │   ├── work_orders.py
│       │   └── need_dates.py
│       ├── supply/
│       │   ├── inventory.py
│       │   ├── opo.py
│       │   ├── asn.py
│       │   ├── transfers.py
│       │   ├── calloff_capacity.py
│       │   └── reliability.py
│       ├── calendars/
│       │   ├── factory.py
│       │   ├── supplier.py
│       │   ├── transit.py
│       │   └── working_days.py
│       ├── planning/
│       │   ├── buckets.py
│       │   ├── netting.py
│       │   ├── balances.py
│       │   ├── safety_stock.py
│       │   └── incremental.py
│       ├── pegging/
│       │   ├── builder.py
│       │   ├── priority.py
│       │   ├── allocation.py
│       │   ├── preemption.py
│       │   └── validation.py
│       ├── shortages/
│       │   ├── detector.py
│       │   ├── classifier.py
│       │   ├── severity.py
│       │   ├── impact.py
│       │   └── horizon.py
│       ├── readiness/
│       │   ├── kitting.py
│       │   ├── buildable.py
│       │   └── earliest_start.py
│       ├── actions/
│       │   ├── pr.py
│       │   ├── supplier_allocation.py
│       │   ├── expedite.py
│       │   ├── calloff.py
│       │   ├── reschedule.py
│       │   ├── transfer.py
│       │   └── substitution.py
│       ├── collaboration/
│       │   ├── tasks.py
│       │   ├── war_room.py
│       │   ├── supplier_responses.py
│       │   └── templates.py
│       ├── scenarios/
│       ├── reviews/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── calendars/
├── priority-profiles/
├── collaboration-templates/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_planning_policy.py
    ├── replay_planning_run.py
    ├── validate_pegging_conservation.py
    ├── inspect_opo_health.py
    ├── compare_planning_runs.py
    ├── run_planning_benchmark.py
    └── export_shortage_war_room.py
```


---

# 81. Codex 分阶段实施

不要让 Codex 一次实现全部供需计划、Pegging、采购写回和供应商协同。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–39 的真实完成程度和接口；
2. 当前销售订单、预测、工单和计划订单；
3. 当前 BOM、Revision、Variant、Effectivity 和 Phantom；
4. 当前库存、Lot、Allocation、Reservation、Quarantine、Quality Hold 和 Customer Scope；
5. 当前 PO、PO Line、Delivery Schedule、Receipt、ASN、In-transit 和 ETA；
6. 当前 OPO 是否只存总数量，还是有 Schedule；
7. 当前 Promise Date、ETA、Receipt Date 和 Available Date 的区别；
8. 当前 Blanket Order、Framework Agreement、VMI、寄售和 Call-off；
9. 当前 PR、PO、催交、改期、取消和供应商协同；
10. 当前工厂、供应商、仓库、物流和节假日日历；
11. 当前 MRP、Netting、Pegging、ATP/CTP 和工单齐套；
12. 当前优先级、Allocation、冻结区和抢占规则；
13. 当前缺料表、Call 料表和催交表；
14. 当前 Workflow、Saga、Idempotency、Events、Queue 和 Object Storage；
15. 当前权限、审批、供应商 Portal 和 Audit；
16. 数据覆盖、Unknown、Stale、Conflict、重复和历史 ETA 准确率；
17. 不修改业务代码；
18. 不创建 Migration；
19. 不安装依赖；
20. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Planning Request；
- Demand；
- Supply；
- Inventory Lot；
- OPO Schedule；
- ETA；
- Time Bucket；
- Balance；
- Pegging Link；
- Shortage；
- Work-order Readiness；
- PR Draft；
- Supplier Allocation；
- Expedite；
- Call-off；
- Task；
- Event；
- JSON Schema。

## Phase 2：Upstream Adapter 和 Input Snapshot

实现：

- Agent 31–39 Adapter；
- Sales/Forecast/WO Adapter；
- Inventory Adapter；
- Purchasing/OPO Adapter；
- Supplier Confirmation；
- Calendar；
- Snapshot Hash；
- Version Compatibility；
- Freshness；
- Idempotency。

## Phase 3：Demand 和 BOM Explosion

实现：

- Demand Sources；
- Multi-level BOM；
- Revision；
- Effectivity；
- Variant/DNP；
- Phantom；
- Make/Buy；
- Scrap/Yield；
- Circular Detection；
- Requirement Trace。

## Phase 4：Inventory Availability

实现：

- Lot；
- Available/Allocated/Reserved；
- Quality/Quarantine；
- Expiry/MSL；
- Customer Scope；
- Compliance；
- Packaging；
- Location；
- Usable Quantity。

## Phase 5：OPO、ASN 和 ETA

实现：

- PO/Line/Schedule；
- Open Quantity；
- Partial Receipt；
- Promise Date History；
- ASN；
- Carrier；
- Customs；
- IQC；
- Available-to-use ETA；
- Reliability；
- Conflicts。

## Phase 6：Planning Calendar 和 Time Buckets

实现：

- Daily/Weekly/Monthly；
- Hybrid Horizon；
- Factory/Supplier/Transit Calendar；
- Working Days；
- Frozen/Firm/Planning Zone；
- Need-date Adjustment。

## Phase 7：Time-phased Netting

实现：

- Beginning Balance；
- Gross Demand；
- Confirmed Receipt；
- Safety Stock；
- Projected Available；
- Net Requirement；
- Planned Receipt/Release；
- Conservation Tests；
- Unknown Handling。

## Phase 8：Pegging

实现：

- Inventory-to-demand；
- OPO-to-demand；
- Internal Receipt；
- Transfer；
- Call-off；
- Planned PR；
- Full Pegging；
- Reverse Impact；
- Quantity Conservation。

## Phase 9：Priority 和 Allocation

实现：

- Priority Profile；
- Frozen Allocation；
- Customer Commit；
- Need Date；
- Criticality；
- Fairness；
- Soft/Firm/Frozen；
- Preemption Proposal；
- Conflict Review。

## Phase 10：Shortage 和 Impact

实现：

- Shortage Type；
- Severity；
- Horizon；
- Work Order Impact；
- Sales Order Impact；
- Project Impact；
- Hard Trigger；
- Owner；
- Action Candidate。

## Phase 11：Work-order Readiness

实现：

- Kitting Completeness；
- Quantity Completeness；
- Critical Component；
- Buildable Quantity；
- Material-ready Date；
- Earliest Start；
- Partial Build；
- Suggested Sequence。

## Phase 12：PR Draft 生成

实现：

- Net Requirement；
- Agent 38 Quantity；
- Packaging；
- Need-by；
- Project/Account；
- Budget；
- Draft Merge；
- Approval；
- Idempotency；
- Create Formal PR Gateway。

## Phase 13：Supplier Allocation

实现：

- Agent 36 Offer；
- Agent 37 Risk；
- Agent 38 Packaging；
- Agent 39 Budget；
- Contract Capacity；
- Supplier Performance；
- Rule-based/Integer Allocation；
- Explainable Rank。

## Phase 14：OPO 催交和改期

实现：

- Confirm；
- Pull-in；
- Partial Ship；
- Upgrade Freight；
- Reschedule-out；
- Cancel Candidate；
- Promise History；
- Follow-up SLA；
- Controlled Message Template。

## Phase 15：Blanket Agreement 和 Call-off

实现：

- Agreement；
- Line；
- Remaining Balance；
- Validity；
- Price；
- Minimum Call；
- Call Multiple；
- Lead Time；
- Draft；
- Approval；
- Create Call-off Gateway。

## Phase 16：库存调拨与替代协同

实现：

- Warehouse/Site Transfer；
- Ownership；
- Lead Time；
- Tax/Compliance；
- Agent 33 Approved Substitute；
- Deviation/ECR Task；
- No Auto BOM Change。

## Phase 17：Collaboration 和 War Room

实现：

- Task；
- SLA；
- Owner；
- Supplier Response；
- Shortage Board；
- Decision Timeline；
- Escalation；
- Evidence；
- Audit。

## Phase 18：Scenario 和 What-if

实现：

- Supplier Delay；
- Demand Increase；
- Priority Insert；
- Quality Hold；
- Alternative Enabled；
- Partial Shipment；
- Budget Reduction；
- No Write-back；
- Compare Runs。

## Phase 19：Orchestration、Saga 和 Write-back

实现：

- Temporal Workflow；
- Activities；
- Retry；
- Compensation；
- Idempotency；
- Write-back Gateways；
- Event Outbox；
- Partial Failure；
- Recovery。

## Phase 20：API、Events、Batch 和 Incremental

实现：

- API；
- Events；
- Full/Net-change；
- Batch；
- Cancel；
- Resume；
- Cache；
- Object Storage；
- Access Control；
- Progress。

## Phase 21：Benchmark、监控和生产发布

实现：

- Golden Planning Tests；
- Pegging Conservation；
- ETA Benchmark；
- Load Test；
- Metrics；
- Dashboard；
- Security；
- Feature Flag；
- Policy Rollback；
- Disaster Recovery。

## Phase 22：供应商 Portal 和自动回复结构化，可选

稳定后实现：

- Supplier Confirm；
- Promise Date；
- Partial Ship；
- Reason Code；
- Attachment；
- Reminder；
- Portal Permissions；
- Response-to-Replan；
- 不自动接受商业条款。

---

# 82. Codex 工作纪律

Codex 必须：

1. Demand、Confirmed Supply、Planned Supply 和 Suggested Action 分开；
2. Planned PR 不计入 Confirmed Supply；
3. Expected Stock 不计入确认 OPO；
4. OPO 必须按 PO/Line/Schedule；
5. Ordered、Received、Cancelled、Open Quantity 分开；
6. Promise Date、Carrier ETA、Warehouse ETA、Quality Release 和 Available-to-use Date 分开；
7. 到货不等于可上线；
8. Time-phased Netting，不只算总量；
9. BOM Revision、Effectivity、Variant 和 DNP 必须参与；
10. Circular BOM 必须阻断；
11. Inventory Available、Allocated、Reserved、Quarantine、Expired 分开；
12. Customer-owned/Project-reserved Inventory 不可越权分配；
13. Pegging 是一等对象；
14. 每个 Pegging Link 数量可审计；
15. Demand 和 Supply 数量守恒；
16. Frozen Allocation 不得静默改变；
17. Preemption 只能生成提案和审批；
18. Unknown ETA 不得作为 Confirmed；
19. Supplier Promise 不等于 Available Date；
20. Agent 33 未批准替代不得进入分配；
21. Agent 35 不合规供给不得进入当前客户计划；
22. Agent 36 Stale Offer 必须标记；
23. PR Quantity 必须与 Agent 38 的合法采购数量一致；
24. Agent 37 高风险约束不得被低价覆盖；
25. Agent 39 Budget Block 不得静默忽略；
26. Call-off 只从有效 Agreement 释放；
27. Call-off 不得超过 Remaining Balance；
28. Agreement Price、Validity、Minimum Call 和 Multiple 必须校验；
29. Cancel/Reschedule 只生成建议；
30. Write-back 默认关闭，必须审批；
31. Create PR 不等于 Create PO；
32. 催交发送使用受控模板；
33. 不用 LLM 做 Netting、Pegging、数量分配或 ETA 事实；
34. 编排器不得复制 Agent 33–39 业务逻辑；
35. Adapter Contract 必须版本化；
36. Planning Run 输入快照不可变；
37. Full 和 Net-change 结果可比较；
38. Saga 写回幂等；
39. 重试不得创建重复 PR、Call-off 或 Task；
40. 失败必须记录 Partial Result 和补偿；
41. 风险接受有 Scope、数量、影响和有效期；
42. 供应商不能看到内部客户优先级、收入和利润；
43. 不将 BOM、库存、采购和客户数据发送到外部模型；
44. 公开测试只用合成或脱敏数据；
45. 不伪造 ETA、缺料、供应商承诺、测试或 Benchmark；
46. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter Contract；
    - Policy/Calendar 变化；
    - 测试命令；
    - 真实结果；
    - Planning Accuracy；
    - Pegging Conservation；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 83. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/procurement-planning-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第40个 Agent：

Procurement Planning & Shortage Collaboration Orchestrator /
采购计划与缺料协同 Agent。

本 Agent 是编排型 Agent。它综合：

- 销售订单、Forecast、工单、计划订单和安全库存；
- BOM Revision、Variant、Effectivity、DNP、损耗和良率；
- On-hand、Allocated、Reserved、Quarantine、Expired、Customer-owned Inventory；
- OPO（Open Purchase Order）中的 PO、Line、Delivery Schedule、Open Quantity；
- Supplier Promise、ASN、In-transit、Carrier ETA、Customs、IQC 和 Available-to-use Date；
- Agent 33 已批准替代；
- Agent 34 生命周期；
- Agent 35 合规、原产地和贸易限制；
- Agent 36 价格、库存和交期；
- Agent 37 供应风险；
- Agent 38 MOQ/SPQ 和采购包装方案；
- Agent 39 成本和预算；

执行：

- Multi-level BOM Explosion；
- Time-phased Netting；
- Demand-to-Supply Pegging；
- Scarce Supply Allocation；
- Shortage Detection；
- Work-order Readiness；
- PR Draft；
- Supplier Allocation；
- OPO Expedite/Pull-in/Reschedule/Cancel Suggestion；
- Blanket Order / Framework Agreement Call-off Draft；
- Collaboration Task 和 War Room。

本 Agent 默认只生成草稿和建议，不自动创建 PO、不自动修改工单、不自动取消订单、不自动承诺客户交期。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–39 的规格和实际代码；
3. docs/procurement-planning-agent-spec.md；
4. 当前 Sales Order、Forecast、Work Order、Planned Order；
5. 当前 BOM、Revision、Variant、Effectivity、Phantom、Make/Buy；
6. 当前 Inventory、Lot、Allocation、Reservation、Quarantine、Quality、Expiry、MSL；
7. 当前 PO、PO Line、Delivery Schedule、Receipt、ASN、In-transit；
8. 当前 Requested Date、Promise Date、ETA、Receipt Date、Quality Release 和 Available Date；
9. 当前 Supplier Confirmation、OTD、Promise Change History；
10. 当前 Blanket Order、Framework Agreement、VMI、Consignment 和 Call-off；
11. 当前 PR、PO、Expedite、Reschedule、Cancel 和 Supplier Portal；
12. 当前 MRP、Netting、Pegging、ATP/CTP、Work-order Kitting；
13. 当前 Priority、Allocation、Frozen Zone 和 Preemption；
14. 当前 Factory/Supplier/Warehouse/Carrier Calendar；
15. 当前 Workflow、Saga、Outbox、Idempotency、Queue、Object Storage；
16. 当前 Permission、Approval、Audit 和 Tenant Isolation；
17. 脱敏、合成或授权 Fixture。

硬约束：

- Demand、Confirmed Supply、Planned Supply、Suggestion 分开；
- Planned PR 不算 Confirmed Supply；
- Expected Stock 不算 OPO；
- OPO 按 PO/Line/Schedule；
- Ordered/Received/Cancelled/Open Quantity 分开；
- Promise Date、Carrier ETA、Warehouse ETA、Quality Release、Available-to-use Date 分开；
- Dock Arrival 不等于可用；
- Netting 按时间桶；
- BOM Revision、Effectivity、Variant 和 DNP 必须参与；
- Circular BOM 阻断；
- Inventory Available/Allocated/Reserved/Quarantine/Expired 分开；
- Customer-owned 和 Project-reserved 不可越权分配；
- Pegging 是一等对象；
- Pegging 数量守恒；
- Frozen Allocation 不静默改变；
- Preemption 只生成审批提案；
- Unknown ETA 不得当 Confirmed；
- Agent 33 未批准替代不得使用；
- Agent 35 不合规供给不得使用；
- Agent 36 Stale Data 必须标记；
- PR Quantity 必须引用 Agent 38 合法采购方案；
- Agent 37 高风险限制必须执行；
- Agent 39 Budget Block 不得忽略；
- Call-off 只使用有效 Agreement；
- 不超过 Remaining Callable Quantity；
- Call-off 校验 Minimum/Multiple/Price/Validity；
- Expedite、Reschedule、Cancel 默认是建议；
- Write-back 必须审批和幂等；
- Create PR 不创建 PO；
- 催交使用批准模板；
- 编排器不复制 Agent 33–39 算法；
- V1 不使用 LLM 做 Planning、Pegging 或 Allocation；
- 不把 BOM、库存、采购、客户和供应商私有数据发给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造 ETA、Promise、Shortage、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–39 的真实完成程度和接口；
3. 查找 Demand Sources：SO、Forecast、WO、Planned Order、Service；
4. 查找 BOM Revision、Effectivity、Variant、DNP、Phantom、Make/Buy；
5. 查找 Inventory Lot、Allocation、Reservation、Quality、Expiry、Customer Scope；
6. 查找 PO、Line、Schedule、Receipt、ASN、In-transit；
7. 查找 Requested、Promise、ETA、Receipt、Quality Release、Available Date；
8. 查找 OPO Open Quantity 和 Partial Receipt 逻辑；
9. 查找 Supplier Confirmation、Promise History、OTD；
10. 查找 Blanket Order、Framework Agreement、VMI、Consignment 和 Call-off；
11. 查找 Planning Calendar、Working Days、Frozen/Firm/Planning Zone；
12. 查找 MRP、Netting、Pegging、Allocation 和 Shortage；
13. 查找 Work-order Kitting、Buildable Quantity 和 Earliest Start；
14. 查找 PR、Supplier Allocation、Expedite、Reschedule 和 Cancel；
15. 查找 Workflow、Saga、Idempotency、Write-back 和 Event Outbox；
16. 查找 Collaboration、Supplier Portal、War Room 和 SLA；
17. 统计数据覆盖、Unknown、Conflict、Stale 和 ETA 历史偏差；
18. 抽样分析脱敏或合成缺料案例；
19. 在 docs/procurement-planning-implementation-plan.md 中生成实施计划；
20. 在 docs/demand-supply-domain-model.md 中定义 Domain Model；
21. 在 docs/opo-eta-model.md 中定义 OPO 和 ETA；
22. 在 docs/time-phased-netting.md 中定义时间分段净需求；
23. 在 docs/pegging-allocation.md 中定义 Pegging、Priority 和 Preemption；
24. 在 docs/shortage-classification.md 中定义缺料分类和严重度；
25. 在 docs/work-order-readiness.md 中定义齐套和最早开工；
26. 在 docs/procurement-action-generation.md 中定义 PR、Allocation、Expedite 和 Reschedule；
27. 在 docs/blanket-calloff-design.md 中定义 Call-off；
28. 在 docs/orchestration-saga-writeback.md 中定义编排、Saga 和幂等；
29. 在 docs/procurement-planning-migration-plan.md 中定义旧数据迁移；
30. 在 docs/procurement-planning-benchmark-plan.md 中定义 Benchmark；
31. 给出拟新增、拟修改和拟复用文件；
32. 给出 Phase 1 精确范围；
33. 不修改业务代码；
34. 不创建数据库 Migration；
35. 不安装依赖；
36. 不读取或打印生产 Secret；
37. 运行当前仓库已有 lint、type check、test、build、security scan；
38. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–39 输入契约；
- Demand/Supply/Inventory 数据模型；
- OPO/ETA；
- BOM Explosion；
- Time-phased Netting；
- Pegging；
- Priority/Allocation/Preemption；
- Shortage；
- Work-order Readiness；
- PR Draft；
- Supplier Allocation；
- Expedite/Reschedule/Cancel；
- Blanket/Call-off；
- Collaboration/War Room；
- Orchestration/Saga/Idempotency；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 84. 后续 Phase 提示词模板

```text
继续实现 Procurement Planning Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–40 规格；
3. 阅读 Procurement Planning Implementation Plan；
4. 阅读 Demand/Supply、OPO/ETA、Netting、Pegging、Shortage、Call-off、Saga 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Demand/Confirmed/Planned 分离；
- Time-phased Netting；
- Available-to-use Date；
- Pegging Conservation；
- Frozen Allocation；
- Approved Alternatives Only；
- PR Quantity from Agent 38；
- Call-off Balance；
- Draft before Write-back；
- Idempotency/Saga；
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
9. property/conservation test；
10. saga/idempotency test；
11. security test；
12. performance test；
13. benchmark；
14. 更新文档；
15. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Adapter/Policy/Calendar 变化；
- 测试命令和真实结果；
- Netting Accuracy；
- Pegging Conservation；
- Shortage Accuracy；
- Write-back Idempotency；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 85. MVP 演示流程

1. 输入一个工厂未来 90 天的销售订单、预测和工单；
2. 加载正确 BOM Revision 和 Variant；
3. 展开多层 BOM；
4. 排除 DNP；
5. 加入损耗和齐套提前期；
6. 加载 On-hand；
7. 排除 Allocated、Quarantine 和过期库存；
8. 加载 OPO 的 PO Line 和 Delivery Schedule；
9. 计算 Open Quantity；
10. 加载 Supplier Promise；
11. 加载 ASN 和 Carrier ETA；
12. 加入 IQC 两天，计算 Available-to-use Date；
13. 构建 Daily/Weekly Hybrid Buckets；
14. 执行 Time-phased Netting；
15. 发现总量够但第 2 周缺料；
16. 建立 Inventory/OPO 到 Work Order 的 Pegging；
17. 两个工单争用库存；
18. Frozen Work Order 优先；
19. 低优先级工单形成 Allocation Conflict；
20. 计算每个工单 Kitting Completeness；
21. 识别 Critical Component 缺失；
22. 计算 Buildable Quantity；
23. Agent 38 返回合法采购 3000 Reel；
24. 生成 PR Draft；
25. 检查有效 Blanket Agreement；
26. 其中 1000 可从 Agreement Call-off；
27. 生成 Call-off Draft；
28. 剩余 2000 生成新 PR Draft；
29. 一条 OPO Promise 晚 10 天；
30. 生成 Pull-in 和 Partial Shipment 催交建议；
31. 供应商回复先发 500；
32. 结构化回复触发 Net-change Run；
33. 缺口减少；
34. Agent 33 有已批准替代；
35. 生成工程临时替代协同任务；
36. 不自动修改 BOM；
37. 生成 Shortage Table；
38. 生成 OPO Health；
39. 生成 Call 料表；
40. 采购审批 PR；
41. 正式创建 PR；
42. 重试不重复创建；
43. Call-off 审批并创建；
44. 发布 `procurement.plan.ready`。

---

# 86. 生产上线顺序

第一阶段：

```text
Demand
Inventory
OPO Schedule
ETA
Time-phased Netting
Shortage
Work-order Readiness
PR Draft
人工审核
```

第二阶段：

```text
Pegging
Priority/Allocation
Expedite
Blanket Call-off
Supplier Allocation
Net-change
Collaboration
```

第三阶段：

```text
Supplier Portal
Saga Write-back
Scenario
Multi-site Transfer
Advanced Allocation
Portfolio Planning
```

上线优先确保：

```text
什么时候缺
缺多少
影响哪个工单和客户
现有 OPO 到底何时可用
采购多少才合法
Call-off 余额是否真实
```

宁可把一张没有供应商确认、没有 ETA、没有 ASN 的 OPO 标记为“未确认供给”，也不要让它在计划表里像一列神奇的绿色数字，把即将停线的风险悄悄盖住。
