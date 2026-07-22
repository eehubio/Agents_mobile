# 库存复用与呆滞料 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：41  
> Agent 名称：Inventory Reuse, Excess & Obsolescence Intelligence Agent  
> 中文名称：库存复用与呆滞料 Agent  
> 类型：规则＋算法型  
> 版本：V1.0  
>
> 定位：在新采购、Call-off 或库存补充之前，对企业库存进行 Lot 级复用分析，识别可直接复用库存、跨项目共享库存、经审批可跨客户共享库存、已批准替代库存、包装转换库存、超储、慢动和呆滞料，并生成可解释、可审批的消耗、调拨、替代、换包、退供应商、转售、返工、报废和风险接受建议。
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
> - Agent 40：采购计划与缺料协同
> - ezPLM 物料、库存、批次、序列号、客户库存、寄售、项目、工单、采购、质量、生产、财务和销售数据
>
> 下游：
> - Agent 38：减少净采购需求并优化包装
> - Agent 39：更新消耗成本、库存资产和呆滞准备
> - Agent 40：在生成 PR、Call-off 前优先复用库存
> - 库存调拨、项目借料、客户共享和替代使用草稿
> - FEFO/FIFO、Date Code、MSL 和包装消耗计划
> - 退供应商、转售、返工、重检、换包和报废建议
> - 库存健康、呆滞资金和可回收价值驾驶舱
>
> 重要边界：
> - 本 Agent 只生成库存复用和处置建议，不自动转移库存所有权、不自动修改客户归属、不自动将替代料写入 BOM、不自动报废、不自动转售。
> - “物理上存在”不等于“业务上可用”。所有权、合同、客户范围、质量状态、合规、Date Code、MSL、包装、地点和需求优先级必须同时校验。
> - 客户所有、寄售、保税、政府项目、军工、医疗、汽车或客户专用库存默认不可跨范围共享。
> - 跨客户共享必须经过合同、客户、质量、财务、税务和审计规则，不得只因为型号相同就自动调拨。
> - 替代库存必须引用 Agent 33 已批准且适用当前产品、BOM Revision、工厂和客户的替代关系。
> - 呆滞判定必须结合未来需求、生命周期、可替代性、保质期、处置渠道和项目承诺，不得仅按库龄一刀切。

---

# 1. 建设目标

系统必须能够：

1. 在 Agent 38 生成新采购建议前查询内部可复用库存；
2. 在 Agent 40 创建采购申请前执行库存复用 Gate；
3. 对库存进行 Lot、Serial、包装、地点和所有权级建模；
4. 区分企业自有、客户所有、寄售、VMI、保税、项目专用和供应商保留库存；
5. 区分可用、已分配、预留、质量隔离、过期、返工、报废和工程样品；
6. 查找同一内部料号的直接可用库存；
7. 查找同一标准 MPN 的跨编码可复用库存；
8. 查找同一 Part 不同 Ordering Variant 的可接受库存；
9. 查找 Agent 33 已批准替代料库存；
10. 查找可通过 Re-reel、换管、换盘、烘烤、重检或重新标识后使用的库存；
11. 检查 Date Code、MSL、Floor Life、保质期和客户限制；
12. 检查包装是否适合当前生产工艺；
13. 检查 Traceability、COC、Lot、原产地和合规证据；
14. 检查库存是否已分配给更高优先级需求；
15. 建立库存 Lot 到需求的复用候选关系；
16. 支持仓库、工厂、法人、项目和客户间库存调拨；
17. 支持同一客户不同项目之间共享；
18. 支持企业公共库存池；
19. 支持经审批的跨客户库存共享或所有权转换；
20. 支持库存借用、归还、转售、成本转移和客户结算；
21. 计算调拨时间、换包时间、重检时间、税费和处理成本；
22. 比较复用库存与新采购的现金、时间、风险和总成本；
23. 优先消耗即将过期、已开封、慢动和高呆滞风险库存；
24. 避免为了消耗呆滞库存而引入技术、质量或客户风险；
25. 识别超储库存；
26. 识别慢动库存；
27. 识别无需求库存；
28. 识别生命周期导致的呆滞库存；
29. 识别客户项目结束后的剩余库存；
30. 识别 MOQ/SPQ 造成的剩余库存；
31. 识别包装不适配造成的“账面库存可用、生产不可用”；
32. 计算库存覆盖天数、未来需求概率和预计消耗日期；
33. 计算库存账面价值、重置价值、可回收价值和潜在减值；
34. 计算呆滞准备建议，但不自动进行会计记账；
35. 生成消耗、调拨、借用、替代、换包、重检、退货、转售和报废建议；
36. 生成跨部门审核任务；
37. 支持项目、客户、产品、工厂和企业组合级库存健康分析；
38. 支持多周期和多需求优先级优化；
39. 支持增量重算；
40. 支持 What-if 场景；
41. 支持人工锁定和排除库存 Lot；
42. 支持风险接受和临时偏差；
43. 支持库存复用建议转为 Agent 40 的调拨或分配草稿；
44. 保存原始库存快照、候选、规则、优化模型和 Trace；
45. 不因 MPN 相同而忽略 Date Code、Lot、质量和客户归属；
46. 不因库存账面价值低而绕过工程批准；
47. 不把预计需求当成确定消耗；
48. 不自动将客户库存转为企业库存；
49. 不自动冲销或调整财务库存；
50. 支持百万级库存 Lot 和需求组合。

---

# 2. 与 Agent 31–40 的边界

## 2.1 Agent 31

提供标准 BOM Line 和原始字段。Agent 41 不重新解析 BOM 文件。

## 2.2 Agent 32

提供：

```text
Internal Part Number
Customer Part Number
Manufacturer
MPN
Part
Package Variant
Ordering Variant
```

库存复用必须先解决身份。

## 2.3 Agent 33

提供：

```text
approved alternative
replacement level
FFF
Pin-to-Pin
validation scope
customer approval
site approval
```

未批准替代不能进入自动可行解。

## 2.4 Agent 34

提供：

```text
Active / NRND / EOL / Obsolete
PCN
LTB/LTS
Part Renaming
Manufacturer Acquisition
```

用于呆滞风险和未来可用性。

## 2.5 Agent 35

提供：

```text
RoHS/REACH/客户合规
原产地
关税
贸易限制
证据有效期
```

不满足当前需求范围的库存不得复用。

## 2.6 Agent 36

提供外部市场价格、库存和交期，用于比较：

```text
reuse internal inventory
vs
buy new inventory
```

## 2.7 Agent 37

提供：

```text
单一来源
库存深度
生命周期风险
区域风险
供应商风险
```

用于决定是否保留部分库存作为风险缓冲，而不是全部消耗。

## 2.8 Agent 38

提供：

```text
净采购需求
MOQ/SPQ
包装
生产适配
剩余库存
TCO
```

Agent 41 应在 Agent 38 前后都可运行：

```text
前置：减少净需求
后置：分析采购方案产生的剩余库存
```

## 2.9 Agent 39

提供：

```text
库存资产
采购现金支出
消耗成本
预期报废成本
项目利润影响
```

Agent 41 不进行正式会计记账。

## 2.10 Agent 40

提供：

```text
需求
工单
优先级
Pegging
缺料
PR Draft
调拨和 Call-off
```

Agent 41 输出可复用库存和调拨建议供 Agent 40 编排。

---

# 3. 核心原则

## 3.1 物理库存不等于可复用库存

可复用库存必须通过：

```text
identity
ownership
contract/customer scope
allocation
quality
compliance
date code
shelf life/MSL
packaging
location/time
priority
```

## 3.2 所有权和使用权分开

库存可能：

```text
enterprise owned
customer owned
supplier consigned
VMI
bonded
project funded
loaned
government/customer restricted
```

企业可管理物理库存，但未必拥有使用权。

## 3.3 精确复用和替代复用分开

```text
exact reuse
same MPN different internal code
same Part different ordering variant
approved substitute reuse
rework/repack enabled reuse
```

风险和审批不同。

## 3.4 已分配库存不能静默复用

支持：

```text
unallocated
soft allocated
firm allocated
frozen allocated
customer reserved
```

只有允许的 Allocation 才可释放。

## 3.5 共享必须有 Scope

共享层级：

```text
same work order
same project
same customer
same legal entity
same tenant
cross customer
cross legal entity
```

跨层级越高，审批越严格。

## 3.6 呆滞不是单一库龄阈值

需要综合：

```text
days since last movement
future demand
forecast confidence
lifecycle
expiry
customer/project status
alternative adoption
market recoverability
```

## 3.7 高风险物料不一定应优先消耗全部库存

Agent 37 可能建议保留：

```text
strategic buffer
service reserve
LTB stock
single-source reserve
```

## 3.8 FEFO/FIFO 是策略，不是绝对规则

高风险、客户要求、Lot 一致性和 MSL 可能改变消耗顺序。

## 3.9 复用建议必须比较总成本

内部调拨并非零成本：

```text
transport
inspection
repack
bake
handling
tax/intercompany
documentation
production delay
```

## 3.10 Unknown 不是可用

缺少：

```text
ownership
quality
date code
MSL
compliance
traceability
```

必须阻断或进入审核。

## 3.11 建议和正式动作分开

输出：

```text
reuse suggestion
transfer draft
substitution request
repack request
quality review
disposition proposal
```

不自动执行。

## 3.12 结果必须可重放

保存：

```text
inventory snapshot
demand snapshot
identity/alternative versions
rules
costs
optimization model
decision trace
```

---

# 4. 库存 Lot 统一模型

```json
{
  "inventory_lot_id": "uuid",
  "part_id": "uuid",
  "ordering_variant_id": "uuid",
  "internal_part_number": "IPN-001",

  "ownership": {
    "owner_type": "enterprise",
    "owner_id": "uuid",
    "legal_entity_id": "uuid",
    "customer_id": null,
    "project_id": null,
    "consignment_agreement_id": null,
    "bonded_status": "non_bonded"
  },

  "location": {
    "site_id": "uuid",
    "warehouse_id": "uuid",
    "bin_id": "uuid"
  },

  "quantity": {
    "on_hand": 3000,
    "allocated": 500,
    "reserved": 200,
    "quarantine": 0,
    "quality_hold": 0,
    "usable": 2300
  },

  "condition": {
    "quality_status": "released",
    "opened": true,
    "repacked": false,
    "date_code": "2440",
    "expiry_date": null,
    "msl_level": "3",
    "floor_life_remaining_hours": 48
  },

  "packaging": {
    "type": "tape_and_reel",
    "remaining_quantity": 2300,
    "machine_compatibility": "compatible"
  },

  "compliance": {
    "status": "pass",
    "customer_scope": [],
    "country_of_origin": "MY"
  },

  "financial": {
    "book_unit_cost": "1.12",
    "currency": "USD",
    "book_value": "3360.00"
  }
}
```

---

# 5. 库存所有权类型

```text
enterprise_owned
customer_owned
supplier_consigned
vmi_supplier_owned
project_owned
intercompany_owned
bonded_inventory
loaned_inventory
government_furnished
unknown
```

每种类型配置：

```text
allowed demand scopes
transfer rules
financial treatment
approval
return obligation
usage reporting
```

---

# 6. 库存使用权

所有权不变，但可以有使用授权：

```text
exclusive
shared_within_customer
shared_within_project_group
shared_within_legal_entity
shared_within_tenant
cross_customer_with_approval
not_shareable
unknown
```

---

# 7. 库存状态

```text
available
soft_allocated
firm_allocated
frozen_allocated
reserved
customer_reserved
quality_hold
quarantine
expired
blocked
engineering_only
rework
scrap
in_transit
returned
unknown
```

---

# 8. 可用数量

```text
base_usable =
on_hand
- firm_allocated
- frozen_allocated
- reserved
- customer_reserved
- quarantine
- quality_hold
- expired
- blocked
```

Soft Allocation 是否可释放由策略决定。

还要应用：

```text
ownership gate
customer scope gate
quality gate
compliance gate
packaging gate
date-code gate
location/time gate
```

---

# 9. 复用层级

## R0：不可复用

原因示例：

```text
identity unresolved
ownership blocked
quality blocked
expired
customer restricted
```

## R1：同一需求直接复用

同工单或同项目已存在可用库存。

## R2：同客户跨项目复用

客户允许、同一客户范围内共享。

## R3：企业公共库存复用

企业自有、无客户限制。

## R4：同 MPN 跨内部编码复用

需要内部料号映射和工程确认。

## R5：同 Part 不同 Ordering Variant 复用

需包装和制造适配确认。

## R6：已批准替代库存复用

引用 Agent 33。

## R7：经换包/返工/重检后复用

需质量和生产批准。

## R8：跨客户或跨法人复用

需要合同、财务、税务、客户和审计批准。

每个候选保存：

```text
reuse_level
approval_required
evidence
risk
estimated_time
estimated_cost
```

---

# 10. 直接精确复用

匹配：

```text
same Part
same Ordering Variant
same customer scope
same quality/compliance
same packaging compatibility
```

优先级通常最高。

---

# 11. 跨内部料号复用

同一制造商 MPN 可能在不同系统或客户中存在多个内部编码。

需要检查：

```text
same MPN
same package
same ordering suffix
same specification revision
same approved manufacturer list
same customer mapping
```

不能只靠文本相似。

---

# 12. 同 Part 不同 Ordering Variant

例如：

```text
Cut Tape SKU
Reel SKU
Tray SKU
Temperature-grade suffix
RoHS suffix
Packing suffix
```

只有当 Agent 32 确认它们属于可兼容 Ordering Variant，且生产与客户规则允许时才复用。

---

# 13. 替代库存

使用 Agent 33：

```text
mass-production approved
site approved
customer approved
current BOM revision applicable
```

建议分为：

```text
automatic eligible
review eligible
not eligible
```

即使技术替代已批准，也需检查库存 Lot 的具体状态。

---

# 14. 包装转换库存

转换：

```text
cut_tape_to_re_reel
bulk_to_tape
tray_repack
tube_repack
bake_and_reseal
relabel
inspection_and_release
```

每个转换保存：

```text
approved service
cost
lead time
yield loss
quality risk
traceability
customer approval
```

---

# 15. Date Code

客户要求可能包括：

```text
not older than 12 months
not older than 24 months
same date code
single lot
mixed date code allowed
manufacturer COC required
```

Date Code Unknown 默认需审核。

---

# 16. MSL 和 Floor Life

检查：

```text
MSL level
opened_at
floor life consumed
dry storage
bake history
rebake count
dry-pack status
humidity indicator
```

可通过烘烤复用时，计入：

```text
bake cost
bake lead time
quality approval
remaining allowable bake cycles
```

---

# 17. 保质期和有效期

适用于：

```text
battery
adhesive
chemical
solder paste
connector seals
display materials
mechanical consumables
```

FEFO 通常优先，但需满足生产和客户条件。

---

# 18. Traceability

库存复用可能要求：

```text
supplier
purchase order
manufacturer lot
date code
COC
COO
inspection record
repack history
storage history
```

Traceability 不完整可能只允许工程样品，不允许量产。

---

# 19. 客户共享库存

跨客户共享必须检查：

```text
ownership
contract
customer consent
pricing settlement
quality requirements
date code
COO/compliance
confidentiality
financial transfer
```

输出默认：

```text
cross_customer_share_proposal
```

而不是直接 Allocation。

---

# 20. 跨法人和跨区域调拨

检查：

```text
legal entity
transfer price
tax
customs
bonded status
export/import restriction
incoterm
transport lead time
ownership transfer
```

Agent 35 提供贸易约束，Agent 39提供成本影响。

---

# 21. 项目借料

支持：

```text
temporary loan
permanent transfer
return-in-kind
financial chargeback
future replenishment
```

保存：

```text
lender project
borrower project
quantity
expected return
replacement obligation
approval
```

---

# 22. 需求输入

来自 Agent 40：

```text
shortage demand
planned demand
work order demand
safety stock
service demand
prototype demand
```

每条需求保存：

```text
part
ordering variant
quantity
need date
site
customer
project
priority
production profile
compliance scope
```

---

# 23. 可复用候选

```json
{
  "candidate_id": "uuid",
  "inventory_lot_id": "uuid",
  "demand_id": "uuid",

  "match": {
    "reuse_level": "R3",
    "identity_match": "exact",
    "alternative_relationship_id": null
  },

  "eligibility": {
    "ownership": "pass",
    "customer_scope": "pass",
    "quality": "pass",
    "compliance": "pass",
    "date_code": "pass",
    "msl": "conditional",
    "packaging": "pass",
    "location_time": "pass"
  },

  "actions": [
    {
      "type": "bake_and_reseal",
      "lead_time_days": 1,
      "cost": "30.00"
    }
  ],

  "economics": {
    "book_value_used": "1120.00",
    "new_purchase_avoided": "1450.00",
    "transfer_cost": "40.00",
    "net_avoidance": "290.00"
  },

  "risk": {
    "level": "medium",
    "review_required": true
  }
}
```

---

# 24. 可复用性硬门槛

顺序：

```text
Exact/Approved Identity
→ Ownership
→ Usage Rights
→ Allocation/Frozen Demand
→ Quality
→ Compliance/Customer
→ Date Code
→ Shelf Life/MSL
→ Traceability
→ Packaging
→ Location/Need Date
→ Strategic Reserve
```

任一 Hard Gate 失败即不可自动分配。

---

# 25. 战略库存保留

Agent 37 可能要求：

```text
minimum strategic reserve
service reserve
single-source buffer
LTB reserve
customer warranty reserve
```

可复用量：

```text
reusable_quantity =
base_usable - protected_reserve
```

---

# 26. 需求优先级

复用分配优先级可继承 Agent 40：

```text
frozen work order
customer commitment
line stop
service obligation
pilot
forecast
```

同时考虑库存过期风险。

---

# 27. FEFO、FIFO 与风险优先

可配置策略：

```text
FEFO
FIFO
opened-first
highest-obsolescence-risk-first
lowest-transfer-cost-first
customer-dedicated-first
strategic-reserve-last
```

使用 Lexicographic 排序，避免单一分数不可解释。

---

# 28. 超储定义

超储库存不是简单的“库存大于 0”。

```text
excess_quantity =
usable_inventory
+ confirmed_inbound
- demand_within_horizon
- safety_stock
- protected_reserve
```

需要多个 Horizon：

```text
30d
90d
180d
365d
lifetime
```

---

# 29. 慢动库存

指标：

```text
days_since_last_issue
issue_frequency
rolling_consumption
forecast coverage
inventory turns
```

分类阈值按物料类别和业务模式配置。

---

# 30. 呆滞库存

综合：

```text
no credible demand
product sunset
customer project closed
part obsolete
alternative replaced
expired/near expiry
excess beyond lifetime demand
market resale weak
```

建议状态：

```text
healthy
overstock
slow_moving
at_risk
obsolete_candidate
writeoff_candidate
disposed
```

---

# 31. 呆滞风险评分

维度：

```text
age
last movement
future demand
forecast confidence
lifecycle
expiry
customer/project status
alternative adoption
market liquidity
reuse eligibility
storage cost
```

Hard Trigger：

```text
expired_and_no_rework
obsolete_no_demand
customer_project_closed_and_nonshareable
quality_blocked_beyond_review_period
```

---

# 32. 需求概率

未来预测不是确定需求。

保存：

```text
firm demand
approved forecast
unapproved forecast
opportunity demand
probability-weighted demand
```

呆滞分析可使用概率权重，但正式可用量不能拿概率需求冲减。

---

# 33. 预计消耗日期

根据未来需求和优先级计算：

```text
expected_depletion_date
pessimistic_depletion_date
optimistic_depletion_date
```

历史不足时输出 Unknown。

---

# 34. 库存价值

区分：

```text
book value
replacement value
market value
recoverable value
scrap value
reuse avoided cost
```

不能用市场最高价替代账面价值。

---

# 35. 减值建议

本 Agent 可生成：

```text
impairment_review_candidate
suggested_provision_range
reason
evidence
```

不自动过账。

建议分层：

```text
0%
25%
50%
75%
100%
```

真实规则由财务策略配置。

---

# 36. 处置路径

```text
consume internally
transfer
borrow/return
use approved substitute
repack/rework
return to supplier
sell to authorized channel
sell on approved marketplace
customer settlement
donate
recycle
scrap
write off
```

每条路径检查权限、合规和收益。

---

# 37. 退供应商

检查：

```text
return window
RMA
restocking fee
original packaging
unopened status
supplier agreement
freight
credit terms
```

---

# 38. 转售

转售需检查：

```text
ownership
traceability
authorization
export control
brand restrictions
customer confidentiality
lot disclosure
platform policy
tax
```

不能把客户所有或保税库存自动上架销售。

---

# 39. 报废和回收

建议保存：

```text
material type
environmental requirement
certified recycler
destruction evidence
data/security risk
financial approval
```

---

# 40. 优化目标

系统至少输出：

## 40.1 Maximize Purchase Avoidance

尽量减少新采购现金支出。

## 40.2 Minimize Expiry/Obsolescence

优先消耗即将过期或高呆滞风险库存。

## 40.3 Minimize Transfer/Conversion Cost

减少调拨、烘烤、换包和重检。

## 40.4 Balanced Reuse

综合：

```text
purchase avoidance
inventory risk
transfer cost
production readiness
customer constraints
strategic reserve
```

---

# 41. 数学优化模型

变量：

```text
x_lot_demand = 从 Lot 分配给需求的数量
y_transfer = 是否发生调拨
y_conversion = 是否换包/返工
u_uncovered = 未覆盖需求
e_remaining = 剩余库存
```

约束：

```text
sum_demand(x_lot_demand) <= reusable_quantity_lot
```

```text
sum_lot(x_lot_demand) + u_uncovered >= demand_quantity
```

```text
x_lot_demand = 0 if any hard eligibility gate fails
```

```text
protected_reserve remains untouched
```

目标示例：

```text
minimize(
  new_purchase_cost
  + transfer_cost
  + conversion_cost
  + shortage_penalty
  + expected_obsolescence_cost
  + risk_penalty
)
```

V1 推荐：

```text
OR-Tools CP-SAT
```

数量使用整数，金额使用最小货币单位整数。

---

# 42. Lot 分割和包装约束

有些 Lot 可以部分分配，有些不允许：

```text
partial reel allowed
full tray only
sealed bag minimum
single lot requirement
full package transfer
```

必须与 Agent 38 包装规则一致。

---

# 43. 多需求分配

一个 Lot 可供应多个需求时，要考虑：

```text
need date
customer restriction
lot consistency
transport
priority
expiry
```

---

# 44. 多周期库存平衡

```text
ending_inventory[t] =
beginning_inventory[t]
+ confirmed_receipts[t]
- allocated_reuse[t]
- disposal[t]
```

同时计算：

```text
aging bucket
expiry
future demand
protected reserve
```

---

# 45. 复用与新采购比较

每个建议显示：

```text
reuse lead time
new buy lead time
reuse total cost
new buy total cost
cash avoided
inventory risk reduced
quality/approval cost
```

---

# 46. 结果方案

至少输出：

```text
maximum_reuse
minimum_obsolescence
minimum_operational_cost
balanced
```

示例：

```json
{
  "plan_id": "uuid",
  "strategy": "balanced",
  "status": "review_required",

  "allocations": [
    {
      "inventory_lot_id": "uuid",
      "demand_id": "uuid",
      "quantity": 1000,
      "reuse_level": "R3",
      "actions": ["warehouse_transfer"]
    }
  ],

  "summary": {
    "demand_quantity": 1500,
    "reused_quantity": 1000,
    "new_purchase_remaining": 500,
    "purchase_avoided": "1450.00",
    "transfer_and_conversion_cost": "85.00",
    "net_avoidance": "1365.00",
    "obsolescence_value_reduced": "1120.00"
  }
}
```

---

# 47. 不可行结果

输出：

```text
uncovered demand
blocked lots
failed gates
required approvals
new purchase quantity
```

不能偷偷使用 Restricted Lot。

---

# 48. 人工锁定

可锁定：

```text
inventory lot
project allocation
customer reservation
minimum reserve
do-not-use
preferred lot
disposition path
```

---

# 49. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "inventory_reuse_plan",
  "target_id": "uuid",
  "base_version": "solver-v1",
  "operations": [
    {
      "op": "add",
      "path": "/excluded_lot_ids/-",
      "value": "lot-uuid"
    }
  ],
  "reason_code": "customer_reserved_inventory",
  "reviewer_id": "uuid"
}
```

Patch 后重算，原结果不覆盖。

---

# 50. 审核工作台

布局：

```text
左侧：需求、客户、项目、工单
中间：库存 Lot、匹配等级、老化和位置
右侧：复用方案、成本、审批和处置
底部：证据、规则、Lot Trace 和 Solver Trace
```

视图：

```text
Reuse Opportunities
Exact Inventory
Approved Alternatives
Customer Sharing
Transfers
Repack/Rework
Excess
Slow-moving
Obsolete
Disposition
Financial Impact
Audit
```

---

# 51. 核心输出

```text
可复用库存清单
跨项目共享建议
跨客户共享提案
替代库存建议
库存调拨草稿
包装转换/重检任务
超储和慢动清单
呆滞料清单
减值审核建议
退供应商/转售/报废建议
Agent 38 净需求调整
Agent 40 供给和调拨建议
```

---

# 52. API 设计

创建：

```text
POST /api/v1/inventory-reuse/analyses
POST /api/v1/inventory-reuse/plans
POST /api/v1/inventory-reuse/portfolio-jobs
```

读取：

```text
GET /api/v1/inventory-reuse/jobs/{id}
GET /api/v1/inventory-reuse/jobs/{id}/events
GET /api/v1/inventory-reuse/analyses/{id}
GET /api/v1/inventory-reuse/analyses/{id}/candidates
GET /api/v1/inventory-reuse/analyses/{id}/plans
GET /api/v1/inventory-reuse/analyses/{id}/blocked-lots
GET /api/v1/inventory-reuse/lots/{id}/eligibility
GET /api/v1/inventory-reuse/lots/{id}/demand-outlook
GET /api/v1/inventory-reuse/excess
GET /api/v1/inventory-reuse/slow-moving
GET /api/v1/inventory-reuse/obsolete
GET /api/v1/inventory-reuse/portfolio
GET /health/live
GET /health/ready
GET /metrics
```

操作：

```text
POST /api/v1/inventory-reuse/analyses/{id}/rerun
POST /api/v1/inventory-reuse/plans/{id}/approve
POST /api/v1/inventory-reuse/plans/{id}/create-transfer-draft
POST /api/v1/inventory-reuse/plans/{id}/create-substitution-request
POST /api/v1/inventory-reuse/plans/{id}/create-repack-task
POST /api/v1/inventory-reuse/plans/{id}/create-disposition-review
POST /api/v1/inventory-reuse/reviews/{id}/resolve
```

所有正式动作仍由对应 ERP/WMS/QMS/PLM 流程执行。

---

# 53. 状态机

```text
RECEIVED
→ LOADING_DEMAND
→ LOADING_INVENTORY_LOTS
→ VALIDATING_IDENTITIES
→ LOADING_OWNERSHIP_AND_SCOPE
→ LOADING_ALLOCATIONS
→ LOADING_QUALITY_AND_TRACEABILITY
→ LOADING_COMPLIANCE
→ LOADING_ALTERNATIVES
→ LOADING_PACKAGING_RULES
→ LOADING_LIFECYCLE_AND_RISK
→ LOADING_COST_AND_MARKET
→ CALCULATING_REUSABLE_QUANTITY
→ GENERATING_EXACT_CANDIDATES
→ GENERATING_ALTERNATIVE_CANDIDATES
→ GENERATING_CONVERSION_CANDIDATES
→ CLASSIFYING_EXCESS_AND_OBSOLESCENCE
→ BUILDING_OPTIMIZATION_MODEL
→ SOLVING_STRATEGIES
→ VALIDATING_PLANS
→ GENERATING_TRANSFER_AND_REVIEW_ACTIONS
→ STORING_RESULTS
→ COMPLETED_OR_REVIEW_REQUIRED
```

分支：

```text
COMPLETED
REVIEW_REQUIRED
PARTIALLY_FEASIBLE
NO_REUSE_AVAILABLE
IDENTITY_INCOMPLETE
OWNERSHIP_INCOMPLETE
QUALITY_INCOMPLETE
COMPLIANCE_INCOMPLETE
INVENTORY_SNAPSHOT_STALE
SOLVER_TIMEOUT
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 54. 错误码

```text
DEMAND_NOT_FOUND
PART_IDENTITY_UNRESOLVED
INVENTORY_SNAPSHOT_MISSING
INVENTORY_LOT_NOT_FOUND
OWNERSHIP_UNKNOWN
USAGE_RIGHT_UNKNOWN
CUSTOMER_SCOPE_BLOCKED
PROJECT_SCOPE_BLOCKED
LEGAL_ENTITY_TRANSFER_BLOCKED
ALLOCATION_FROZEN
QUALITY_STATUS_UNKNOWN
QUALITY_BLOCKED
DATE_CODE_UNKNOWN
DATE_CODE_BLOCKED
MSL_STATUS_UNKNOWN
MSL_BLOCKED
EXPIRY_BLOCKED
TRACEABILITY_INCOMPLETE
COMPLIANCE_BLOCKED
COUNTRY_OF_ORIGIN_BLOCKED
PACKAGING_INCOMPATIBLE
CONVERSION_NOT_APPROVED
ALTERNATIVE_NOT_APPROVED
STRATEGIC_RESERVE_BLOCKED
TRANSFER_DATE_INFEASIBLE
TRANSFER_COST_MISSING
NO_REUSE_CANDIDATE
NO_FEASIBLE_REUSE_PLAN
SOLVER_TIMEOUT
DISPOSITION_REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR


---

# 55. 数据库设计

## 55.1 `inventory_reuse_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
demand_context JSONB NOT NULL
inventory_scope JSONB NOT NULL
policy_context JSONB NOT NULL
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

## 55.2 `inventory_reuse_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
demand_snapshot_uri TEXT NOT NULL
inventory_snapshot_uri TEXT NOT NULL
ownership_snapshot_uri TEXT NOT NULL
allocation_snapshot_uri TEXT NOT NULL
quality_snapshot_uri TEXT NULL
compliance_snapshot_uri TEXT NULL
alternative_snapshot_uri TEXT NULL
packaging_snapshot_uri TEXT NULL
lifecycle_snapshot_uri TEXT NULL
risk_snapshot_uri TEXT NULL
market_snapshot_uri TEXT NULL
cost_snapshot_uri TEXT NULL
policy_snapshot_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

## 55.3 `inventory_lot_master`

```text
id UUID PK
tenant_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
internal_part_number VARCHAR NULL
manufacturer_part_number VARCHAR NULL
owner_type VARCHAR NOT NULL
owner_id UUID NULL
legal_entity_id UUID NOT NULL
customer_id UUID NULL
project_id UUID NULL
consignment_agreement_id UUID NULL
bonded_status VARCHAR NOT NULL
site_id UUID NOT NULL
warehouse_id UUID NOT NULL
bin_id UUID NULL
on_hand_quantity NUMERIC NOT NULL
allocated_quantity NUMERIC NOT NULL
reserved_quantity NUMERIC NOT NULL
quarantine_quantity NUMERIC NOT NULL
quality_hold_quantity NUMERIC NOT NULL
expired_quantity NUMERIC NOT NULL
usable_quantity NUMERIC NOT NULL
quality_status VARCHAR NOT NULL
opened BOOLEAN NOT NULL
opened_at TIMESTAMPTZ NULL
repacked BOOLEAN NOT NULL
date_code VARCHAR NULL
expiry_date DATE NULL
msl_level VARCHAR NULL
floor_life_remaining_hours NUMERIC NULL
packaging_type VARCHAR NULL
packaging_quantity NUMERIC NULL
country_of_origin VARCHAR NULL
traceability_status VARCHAR NOT NULL
compliance_status VARCHAR NOT NULL
book_unit_cost NUMERIC NULL
book_currency CHAR(3) NULL
last_movement_at TIMESTAMPTZ NULL
snapshot_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, inventory_lot_id, snapshot_at)
```

## 55.4 `inventory_usage_rights`

```text
id UUID PK
tenant_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
usage_scope VARCHAR NOT NULL
allowed_customer_ids JSONB NOT NULL
allowed_project_ids JSONB NOT NULL
allowed_legal_entity_ids JSONB NOT NULL
cross_customer_allowed BOOLEAN NOT NULL
cross_legal_entity_allowed BOOLEAN NOT NULL
approval_profile_id UUID NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.5 `inventory_protected_reserves`

```text
id UUID PK
tenant_id UUID NOT NULL
inventory_lot_id UUID NULL
part_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
reserve_type VARCHAR NOT NULL
reserve_quantity NUMERIC NOT NULL
priority VARCHAR NOT NULL
reason_code VARCHAR NOT NULL
source_agent VARCHAR NULL
source_reference_id UUID NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.6 `inventory_reuse_candidates`

```text
id UUID PK
job_id UUID NOT NULL
demand_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
reuse_level VARCHAR NOT NULL
identity_match_type VARCHAR NOT NULL
alternative_relationship_id UUID NULL
maximum_candidate_quantity NUMERIC NOT NULL
ownership_gate VARCHAR NOT NULL
usage_right_gate VARCHAR NOT NULL
allocation_gate VARCHAR NOT NULL
quality_gate VARCHAR NOT NULL
compliance_gate VARCHAR NOT NULL
date_code_gate VARCHAR NOT NULL
msl_gate VARCHAR NOT NULL
traceability_gate VARCHAR NOT NULL
packaging_gate VARCHAR NOT NULL
location_time_gate VARCHAR NOT NULL
strategic_reserve_gate VARCHAR NOT NULL
candidate_status VARCHAR NOT NULL
approval_required BOOLEAN NOT NULL
risk_level VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
reason_codes JSONB NOT NULL
candidate_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, demand_id, inventory_lot_id)
```

## 55.7 `inventory_conversion_candidates`

```text
id UUID PK
reuse_candidate_id UUID NOT NULL
conversion_type VARCHAR NOT NULL
service_provider_id UUID NULL
minimum_quantity NUMERIC NULL
maximum_quantity NUMERIC NULL
lead_time_days NUMERIC NULL
fixed_cost NUMERIC NULL
unit_cost NUMERIC NULL
currency CHAR(3) NULL
yield_loss_percent NUMERIC NULL
quality_approval_status VARCHAR NOT NULL
customer_approval_required BOOLEAN NOT NULL
traceability_result VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.8 `inventory_reuse_plans`

```text
id UUID PK
job_id UUID NOT NULL
strategy VARCHAR NOT NULL
plan_version INT NOT NULL
status VARCHAR NOT NULL
solver_type VARCHAR NOT NULL
solver_version VARCHAR NOT NULL
solver_status VARCHAR NOT NULL
objective_value NUMERIC NULL
optimality_gap NUMERIC NULL
demand_quantity NUMERIC NOT NULL
reused_quantity NUMERIC NOT NULL
new_purchase_remaining NUMERIC NOT NULL
transfer_quantity NUMERIC NOT NULL
conversion_quantity NUMERIC NOT NULL
purchase_avoided NUMERIC NULL
transfer_conversion_cost NUMERIC NULL
net_avoidance NUMERIC NULL
obsolescence_value_reduced NUMERIC NULL
currency CHAR(3) NULL
risk_level VARCHAR NULL
review_required BOOLEAN NOT NULL
plan_uri TEXT NOT NULL
solver_trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, strategy, plan_version)
```

## 55.9 `inventory_reuse_allocations`

```text
id UUID PK
plan_id UUID NOT NULL
demand_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
reuse_candidate_id UUID NOT NULL
allocated_quantity NUMERIC NOT NULL
reuse_level VARCHAR NOT NULL
source_site_id UUID NOT NULL
destination_site_id UUID NOT NULL
transfer_required BOOLEAN NOT NULL
conversion_required BOOLEAN NOT NULL
conversion_candidate_id UUID NULL
estimated_available_date DATE NULL
allocation_priority INT NOT NULL
approval_status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 55.10 `inventory_transfer_drafts`

```text
id UUID PK
plan_id UUID NOT NULL
tenant_id UUID NOT NULL
draft_number VARCHAR NOT NULL
source_legal_entity_id UUID NOT NULL
destination_legal_entity_id UUID NOT NULL
source_site_id UUID NOT NULL
destination_site_id UUID NOT NULL
transfer_type VARCHAR NOT NULL
tax_trade_review_required BOOLEAN NOT NULL
financial_settlement_required BOOLEAN NOT NULL
status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
draft_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, draft_number)
```

## 55.11 `inventory_transfer_draft_lines`

```text
id UUID PK
transfer_draft_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
quantity NUMERIC NOT NULL
packaging_type VARCHAR NULL
source_bin_id UUID NULL
destination_warehouse_id UUID NOT NULL
need_by_date DATE NULL
project_from_id UUID NULL
project_to_id UUID NULL
customer_from_id UUID NULL
customer_to_id UUID NULL
financial_transfer_value NUMERIC NULL
currency CHAR(3) NULL
reason_codes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.12 `inventory_share_proposals`

```text
id UUID PK
plan_id UUID NOT NULL
share_type VARCHAR NOT NULL
inventory_lot_id UUID NOT NULL
quantity NUMERIC NOT NULL
owner_customer_id UUID NULL
beneficiary_customer_id UUID NULL
owner_project_id UUID NULL
beneficiary_project_id UUID NULL
ownership_transfer_required BOOLEAN NOT NULL
contract_review_required BOOLEAN NOT NULL
customer_approval_required BOOLEAN NOT NULL
financial_settlement JSONB NULL
conditions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.13 `inventory_substitution_requests`

```text
id UUID PK
plan_id UUID NOT NULL
demand_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
alternative_relationship_id UUID NOT NULL
bom_id UUID NULL
bom_revision VARCHAR NULL
product_id UUID NULL
customer_id UUID NULL
site_id UUID NULL
requested_quantity NUMERIC NOT NULL
validation_scope VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
ecr_ecn_reference_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.14 `inventory_excess_classifications`

```text
id UUID PK
tenant_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
classification_date DATE NOT NULL
status VARCHAR NOT NULL
horizon_days INT NULL
usable_quantity NUMERIC NOT NULL
firm_demand_quantity NUMERIC NOT NULL
probability_weighted_demand NUMERIC NULL
protected_reserve NUMERIC NOT NULL
excess_quantity NUMERIC NOT NULL
days_since_last_movement INT NULL
inventory_turns NUMERIC NULL
expected_depletion_date DATE NULL
lifecycle_status VARCHAR NULL
obsolescence_risk_score NUMERIC NULL
confidence NUMERIC(5,4) NOT NULL
reason_codes JSONB NOT NULL
classification_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(inventory_lot_id, classification_date, horizon_days)
```

## 55.15 `inventory_value_assessments`

```text
id UUID PK
inventory_lot_id UUID NOT NULL
assessment_date DATE NOT NULL
book_value NUMERIC NULL
replacement_value NUMERIC NULL
market_value NUMERIC NULL
recoverable_value NUMERIC NULL
scrap_value NUMERIC NULL
currency CHAR(3) NOT NULL
suggested_provision_rate NUMERIC NULL
suggested_provision_amount NUMERIC NULL
confidence NUMERIC(5,4) NOT NULL
valuation_sources JSONB NOT NULL
review_required BOOLEAN NOT NULL
created_at TIMESTAMPTZ
```

## 55.16 `inventory_disposition_proposals`

```text
id UUID PK
tenant_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
proposal_type VARCHAR NOT NULL
quantity NUMERIC NOT NULL
estimated_recovery_value NUMERIC NULL
estimated_cost NUMERIC NULL
currency CHAR(3) NULL
legal_review_required BOOLEAN NOT NULL
compliance_review_required BOOLEAN NOT NULL
financial_review_required BOOLEAN NOT NULL
customer_review_required BOOLEAN NOT NULL
provider_or_channel_id UUID NULL
conditions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.17 `inventory_reuse_reviews`

```text
id UUID PK
job_id UUID NOT NULL
plan_id UUID NULL
inventory_lot_id UUID NULL
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

## 55.18 `inventory_reuse_decisions`

```text
id UUID PK
job_id UUID NOT NULL
decision_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
old_value JSONB NULL
new_value JSONB NOT NULL
reason_code VARCHAR NOT NULL
requested_by UUID NOT NULL
approved_by UUID NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 55.19 `inventory_reuse_action_links`

```text
id UUID PK
plan_id UUID NOT NULL
action_type VARCHAR NOT NULL
external_system VARCHAR NOT NULL
external_object_type VARCHAR NOT NULL
external_object_id VARCHAR NULL
idempotency_key VARCHAR NOT NULL
status VARCHAR NOT NULL
last_error TEXT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(idempotency_key)
```

---

# 56. 对象存储

```text
derived/inventory-reuse/
  {tenant_id}/{job_id}/
    input/
      demand.json.zst
      inventory-lots.json.zst
      ownership-rights.json.zst
      allocations.json.zst
      quality-traceability.json.zst
      compliance.json.zst
      alternatives.json.zst
      packaging-rules.json
      lifecycle-risk.json.zst
      market-cost.json.zst
      policies.json
    candidates/
      exact-reuse.json.zst
      cross-code.json.zst
      alternative-reuse.json.zst
      conversion-reuse.json.zst
      blocked-lots.json.zst
      gate-trace.json.zst
    classification/
      excess.json.zst
      slow-moving.json.zst
      obsolete-candidates.json.zst
      demand-outlook.json.zst
      value-assessment.json.zst
    models/
      maximum-reuse.json
      minimum-obsolescence.json
      minimum-operational-cost.json
      balanced.json
    plans/
      maximum-reuse.json
      minimum-obsolescence.json
      minimum-operational-cost.json
      balanced.json
      comparison.json
    actions/
      transfer-drafts.json
      share-proposals.json
      substitution-requests.json
      repack-rework-tasks.json
      disposition-proposals.json
    reports/
      inventory-health.json
      purchase-avoidance.json
      customer-sharing.json
      financial-impact.json
      quality-report.json
      stale-input-report.json
    debug/
      solver-trace.json.zst
      allocation-trace.json.zst
      classification-trace.json.zst
```

---

# 57. 事件

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
procurement.plan.ready
inventory.changed
inventory.allocated
inventory.released
inventory.quality.changed
inventory.ownership.changed
inventory.customer-scope.changed
inventory.lot.opened
inventory.expiry.changed
project.closed
product.sunset
forecast.updated
work-order.changed
```

## 输出事件

```text
inventory.reuse-plan.ready
inventory.reuse-opportunity.detected
inventory.transfer-draft.ready
inventory.share-proposal.ready
inventory.substitution-request.ready
inventory.repack-task.ready
inventory.excess.detected
inventory.slow-moving.detected
inventory.obsolete-candidate.detected
inventory.disposition-review.required
inventory.purchase-avoidance.updated
```

## `inventory.reuse-plan.ready`

```json
{
  "event_type": "inventory.reuse-plan.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "plan_id": "uuid",
  "strategy": "balanced",
  "summary": {
    "demand_quantity": 15000,
    "reused_quantity": 8300,
    "new_purchase_remaining": 6700,
    "purchase_avoided": "14250.00",
    "obsolescence_value_reduced": "9200.00",
    "review_items": 7
  },
  "result_uri": "s3://.../balanced.json",
  "status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 58. Agent 38/40 前置 Gate

推荐调用顺序：

```text
Agent 40 Net Requirement
→ Agent 41 Inventory Reuse
→ Remaining Requirement
→ Agent 38 Packaging Optimization
→ Agent 40 PR/Call-off Draft
```

Agent 41 输出：

```text
reused_quantity
transfer_in_quantity
conditional_reuse_quantity
blocked_quantity
remaining_purchase_requirement
```

只有批准的复用量才能减少正式采购需求。

---

# 59. 双阶段运行

## Pre-buy Run

在新采购前：

```text
查找可复用库存
减少净采购需求
```

## Post-buy/Portfolio Run

在采购或项目结束后：

```text
识别 Excess/Slow/Obsolete
生成处置和未来复用建议
```

两种 Run 使用不同策略。

---

# 60. 分类策略

```text
policies/
├── inventory-reuse-1.0.0.yaml
├── ownership-rights.yaml
├── customer-sharing.yaml
├── allocation-release.yaml
├── quality-and-traceability.yaml
├── date-code.yaml
├── msl-and-expiry.yaml
├── packaging-compatibility.yaml
├── strategic-reserve.yaml
├── reuse-levels.yaml
├── excess-classification.yaml
├── slow-moving.yaml
├── obsolescence.yaml
├── valuation.yaml
├── disposition.yaml
├── objective-profiles/
│   ├── maximum-reuse.yaml
│   ├── minimum-obsolescence.yaml
│   ├── minimum-operational-cost.yaml
│   └── balanced.yaml
└── enterprise/
    └── tenant-specific/
```

所有规则版本化。

---

# 61. Candidate Gate 顺序

```text
Identity
→ Ownership
→ Usage Right
→ Allocation
→ Quality
→ Compliance
→ Date Code
→ MSL/Expiry
→ Traceability
→ Packaging
→ Location/Time
→ Protected Reserve
→ Priority
```

每个失败 Gate 保存：

```text
inventory_lot_id
demand_id
gate
reason
evidence
review possibility
```

---

# 62. 优化策略

## 62.1 Maximum Reuse

优先减少新采购数量。

## 62.2 Minimum Obsolescence

优先消耗高呆滞风险和临期库存。

## 62.3 Minimum Operational Cost

优先减少调拨、换包、烘烤、检验和审批成本。

## 62.4 Balanced

综合：

```text
new purchase avoided
obsolescence avoided
operational cost
delivery readiness
quality risk
customer/ownership complexity
strategic reserve
```

---

# 63. Solver 设计

V1 推荐：

```text
OR-Tools CP-SAT
```

整数变量：

```text
allocation quantity
transfer selection
conversion selection
disposition quantity
uncovered demand
remaining lot
```

金额转最小货币单位整数。

超时输出：

```text
best_feasible
optimality_gap
```

不得伪装为 Optimal。

---

# 64. Candidate Dominance

候选 A 若在以下全部不优于 B，可淘汰：

```text
更差复用等级
更高操作成本
更晚可用
更高质量风险
更高审批复杂度
更差呆滞改善
```

但不同所有权、客户范围、Lot、Date Code 不能错误合并。

---

# 65. 需求和库存数量守恒

必须满足：

```text
lot beginning quantity
= allocated reuse
+ remaining quantity
+ approved disposition
+ protected reserve
```

同一 Lot 不得被多个 Plan 重复占用。

正式执行前需进行最新 Allocation Check。

---

# 66. 复用预留

优化结果可创建：

```text
reuse reservation draft
```

在审批期间防止其他计划同时使用。

预留有：

```text
expiry
owner
scope
release condition
```

---

# 67. 抢占规则

若 Lot 已 Soft Allocated：

```text
release proposal
```

显示：

```text
原需求
新需求
影响
优先级
补救方案
```

Frozen Allocation 不可自动抢占。

---

# 68. 跨客户共享结算

可选模式：

```text
no charge
book value transfer
replacement cost transfer
contract price
negotiated settlement
return-in-kind
```

需要财务和合同批准。

---

# 69. 跨法人库存转移

正式动作可能需要：

```text
intercompany transfer order
transfer price
tax invoice
customs document
ownership change
inventory receipt
```

Agent 41 只生成草稿和所需条件。

---

# 70. 质量复用任务

任务类型：

```text
reinspection
solderability test
bake
dry pack
X-ray
visual inspection
COC retrieval
traceability reconstruction
relabel
repack
```

---

# 71. 替代库存审核

输出：

```text
alternative relationship
affected BOM
quantity
customer/site approval
test status
temporary deviation
ECN/ECR requirement
```

不自动修改 BOM 或 AVL。

---

# 72. 呆滞处置优先级

建议顺序：

```text
internal exact reuse
approved substitute reuse
cross-project transfer
cross-customer proposal
return to supplier
authorized resale
rework/repack
donation/recycle
scrap/writeoff
```

真实顺序按策略和合同配置。

---

# 73. 市场流动性

可使用 Agent 36 和授权来源数据估计：

```text
current market availability
market price
distributor demand indicator if available
resale channel eligibility
```

不得将非授权 Broker 报价当作确定可回收价值。

---

# 74. 呆滞价值分析

输出：

```text
book value
avoidable new purchase
estimated recovery
expected holding cost
expected writeoff
disposition cost
```

---

# 75. Inventory Health Dashboard

指标：

```text
total inventory value
usable inventory value
allocated value
protected reserve
overstock value
slow-moving value
obsolete candidate value
expired value
reuse opportunity value
purchase avoidance
cross-project sharing
cross-customer pending
disposition recovery
```

---

# 76. 呆滞 Aging Bucket

示例：

```text
0–90 days
91–180 days
181–365 days
366–730 days
730+ days
```

阈值按物料类别可配置。

---

# 77. 项目结束处理

项目关闭时触发：

```text
release unused allocations
classify remaining inventory
check customer ownership
check return obligation
find reuse
create settlement/disposition tasks
```

---

# 78. Product Sunset

产品退市时：

```text
service demand
warranty period
last build
replacement product usage
remaining customer obligation
```

必须先保留售后库存，再判定呆滞。

---

# 79. EOL/LTB 库存

EOL 库存不一定是呆滞。

如果未来售后需求明确：

```text
protected_ltb_reserve
```

若明显超过生命周期需求：

```text
excess_ltb_inventory
```

---

# 80. What-if Scenario

支持：

```text
new_project_uses_inventory
customer_sharing_approved
alternative_approved
forecast_reduced
forecast_increased
project_closed
supplier_return_available
market_price_drop
expiry_in_90_days
strategic_reserve_changed
```

输出：

```text
purchase avoided
excess reduction
cash impact
risk impact
approval impact
```

---

# 81. 审批

强制审批条件：

```text
cross customer
cross legal entity
customer owned
supplier consigned
bonded
alternative use
quality conditional
date code exception
MSL exception
traceability incomplete
strategic reserve release
writeoff/disposal
```

---

# 82. 幂等和写回

正式草稿和动作使用：

```text
job_id
plan_id
action_type
inventory_lot_id
quantity
version
```

避免重复创建调拨、重检或处置任务。

---

# 83. Saga

例如库存调拨：

```text
Approve Transfer Draft
→ Create Transfer Order
→ Reserve Source Lot
→ Link Demand
→ Publish Event
```

失败补偿：

```text
Transfer Order created but reservation failed
→ retry reservation
→ or cancel transfer order via controlled compensation
```

---

# 84. API 权限

建议角色：

```text
inventory_planner
procurement
project_manager
quality
engineering
finance
customer_program_manager
warehouse
administrator
```

每个动作最小权限。

---

# 85. 可观测性

Metrics：

```text
inventory_reuse_jobs_total{status,type}
inventory_reuse_duration_seconds{step}
inventory_reuse_candidates_total{level,status}
inventory_reuse_gate_failures_total{gate,reason}
inventory_reuse_allocated_quantity_total{level}
inventory_reuse_purchase_avoided_total{currency}
inventory_reuse_transfer_cost_total{currency}
inventory_reuse_obsolescence_reduced_total{currency}
inventory_reuse_excess_value_total{status}
inventory_reuse_slow_moving_value_total
inventory_reuse_obsolete_candidate_value_total
inventory_reuse_cross_customer_proposals_total{status}
inventory_reuse_substitution_requests_total{status}
inventory_reuse_disposition_proposals_total{type,status}
inventory_reuse_solver_runs_total{strategy,status}
inventory_reuse_solver_gap{strategy}
inventory_reuse_writeback_failures_total{action}
```

---

# 86. Benchmark

## Identity/Eligibility

```text
exact reuse match accuracy
cross-code match accuracy
ordering-variant compatibility
approved substitute enforcement
ownership gate accuracy
customer scope gate accuracy
quality/compliance gate recall
```

## Quantity

```text
usable quantity accuracy
protected reserve accuracy
allocation conservation
reuse quantity accuracy
remaining purchase quantity
```

## Inventory Health

```text
excess classification
slow-moving classification
obsolete candidate precision/recall
expected depletion accuracy
aging accuracy
```

## Economics

```text
purchase avoidance
transfer/conversion cost
book/replacement/recoverable value separation
provision suggestion reproducibility
```

## Workflow

```text
approval routing
cross-customer isolation
idempotent write-back
saga recovery
audit replay
```

---

# 87. 初始质量目标

```text
Exact Inventory Identity Accuracy >= 99.99%
Ownership Gate Accuracy = 100%
Customer Scope Enforcement = 100%
Frozen Allocation Preservation = 100%
Approved Alternative Enforcement = 100%
Usable Quantity Accuracy >= 99.9%
Protected Reserve Preservation = 100%
Allocation Quantity Conservation = 100%
Purchase Requirement Reduction Consistency with Agent 38/40 = 100%
Expired/Blocked Lot Auto-use Rate = 0%
Cross-customer Auto-allocation Rate = 0%
Obsolete Candidate Precision >= 95%
Critical Obsolescence False-negative Rate <= 1%
Write-back Idempotency = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经验证的保证。

---

# 88. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## Identity

1. Same Internal Part；
2. Same MPN Different IPN；
3. Same Part Different Packaging；
4. Different Suffix；
5. Approved Alternative；
6. Unapproved Alternative；
7. Ambiguous MPN；
8. Customer Part Mapping；
9. Manufacturer Alias；
10. Old/New Part Number。

## Ownership/Scope

11. Enterprise Owned；
12. Customer Owned；
13. Supplier Consigned；
14. VMI；
15. Bonded；
16. Project Owned；
17. Same Customer Share；
18. Cross Customer Proposal；
19. Cross Legal Entity；
20. Unknown Ownership。

## Allocation/Quality

21. Unallocated；
22. Soft Allocated；
23. Firm Allocated；
24. Frozen；
25. Reserved；
26. Quarantine；
27. Quality Hold；
28. Released；
29. Rework；
30. Scrap。

## Date/MSL/Trace

31. Valid Date Code；
32. Old Date Code；
33. Unknown Date Code；
34. MSL Valid；
35. Floor Life Exhausted；
36. Bake Allowed；
37. Bake Count Exceeded；
38. Expired；
39. Near Expiry；
40. Traceability Complete；
41. Missing COC；
42. Mixed Lot；
43. Single Lot Customer；
44. Repacked；
45. Unknown Storage History。

## Packaging/Location

46. Reel Compatible；
47. Cut Tape Incompatible；
48. Re-reel Conversion；
49. Tray；
50. Tube；
51. Bulk；
52. Cross Warehouse；
53. Cross Site；
54. Transfer Late；
55. Intercompany Transfer。

## Demand/Optimization

56. One Lot One Demand；
57. One Lot Multiple Demand；
58. Multiple Lots One Demand；
59. Protected Reserve；
60. FEFO；
61. FIFO；
62. Obsolescence-first；
63. Maximum Reuse；
64. Minimum Operational Cost；
65. Balanced；
66. Partial Reuse；
67. No Reuse；
68. Solver Timeout；
69. Best Feasible；
70. Quantity Conservation。

## Excess/Obsolete

71. Overstock 30d；
72. Overstock 365d；
73. Slow Moving；
74. No Demand；
75. Project Closed；
76. Product Sunset；
77. EOL Service Reserve；
78. Excess LTB；
79. Expired No Rework；
80. Market Recoverable；
81. Supplier Return；
82. Resale；
83. Recycle；
84. Writeoff Candidate；
85. Forecast Uncertain。

## Workflow/System

86. Transfer Draft；
87. Share Proposal；
88. Substitution Request；
89. Repack Task；
90. Disposition Review；
91. Agent 40 Pre-buy Gate；
92. Agent 38 Recalculation；
93. Idempotency；
94. Saga Failure；
95. Permission Denied；
96. Tenant Isolation；
97. Net Change；
98. Snapshot Replay；
99. 1M Lots；
100. Audit Trace。

---

# 89. 性能要求

中型企业：

```text
1,000,000 inventory lots
100,000 active demand lines
```

目标：

```text
Exact candidate lookup P95 < 500 ms
Single-part reuse plan P95 < 2 s
10,000-part batch cached P95 < 5 min
Portfolio classification P95 < 15 min
```

需要：

- Part/Location/Ownership 索引；
- 候选分区；
- 需求去重；
- Lot 聚合但不丢失 Lot 约束；
- Candidate Pruning；
- 分块对象存储；
- 增量运行；
- 可取消；
- Solver 超时；
- 批量写入。

---

# 90. 缓存和增量

缓存键：

```text
demand_version
+ inventory_snapshot
+ ownership_rights_version
+ allocation_version
+ quality_version
+ compliance_version
+ alternative_version
+ packaging_profile_version
+ lifecycle/risk version
+ market/cost version
+ reuse_policy_version
+ solver_version
```

变化影响：

```text
Inventory Changed
→ 相关 Lot/Part 重算

Allocation Changed
→ 可用量和冲突重算

Alternative Approved
→ 新增替代候选

Quality Released
→ 解锁 Candidate

Project Closed
→ 释放并分类库存

Forecast Changed
→ Excess/Obsolete 重算

Agent 40 Demand Changed
→ Reuse Allocation 重算
```

---

# 91. 安全与权限

- 多租户、法人、客户、项目、工厂和仓库隔离；
- Customer-owned Inventory 只对授权角色显示；
- 跨客户共享 Proposal 默认隐藏对方客户敏感信息；
- Supplier Consigned 使用受控权限；
- Bonded Inventory 遵守海关和库区限制；
- 调拨、替代、重检、转售和报废分别审批；
- 财务价值只向有权限角色显示；
- 客户版报告不显示其他客户名称；
- 不将库存、客户、合同和成本数据发送到外部通用模型；
- V1 不需要 LLM 做资格判断、分配或呆滞评分；
- 不执行上传附件中的宏；
- 文件下载使用签名 URL；
- Solver 在受限 Worker；
- 所有正式写回使用幂等和审计；
- 处置证据不可删除，只能归档或作废。

---

# 92. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
OR-Tools CP-SAT
```

批量：

```text
Polars
PyArrow
DuckDB
```

工作流：

```text
Temporal / Celery / RQ
```

搜索：

```text
PostgreSQL indexes
OpenSearch 可选
```

V1 不需要 LLM。

---

# 93. 推荐仓库结构

```text
inventory-reuse-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── inventory-reuse-agent-spec.md
│   ├── inventory-lot-domain-model.md
│   ├── ownership-and-usage-rights.md
│   ├── reuse-eligibility-gates.md
│   ├── cross-customer-sharing.md
│   ├── alternative-inventory-reuse.md
│   ├── excess-slow-obsolete-classification.md
│   ├── valuation-and-disposition.md
│   ├── solver-model.md
│   ├── integration-agent38-agent40.md
│   ├── orchestration-and-writeback.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-physical-stock-is-not-reusable-stock.md
│       ├── 0002-ownership-and-usage-rights-separated.md
│       ├── 0003-cross-customer-sharing-needs-approval.md
│       ├── 0004-approved-alternatives-only.md
│       ├── 0005-obsolescence-is-not-age-only.md
│       └── 0006-recommendations-before-writeback.md
├── src/
│   └── inventory_reuse/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── lot.py
│       │   ├── ownership.py
│       │   ├── demand.py
│       │   ├── candidate.py
│       │   ├── allocation.py
│       │   ├── classification.py
│       │   ├── valuation.py
│       │   ├── disposition.py
│       │   └── review.py
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
│       │   ├── inventory.py
│       │   ├── quality.py
│       │   ├── projects.py
│       │   └── finance.py
│       ├── eligibility/
│       │   ├── identity.py
│       │   ├── ownership.py
│       │   ├── usage_rights.py
│       │   ├── allocation.py
│       │   ├── quality.py
│       │   ├── compliance.py
│       │   ├── date_code.py
│       │   ├── msl_expiry.py
│       │   ├── traceability.py
│       │   ├── packaging.py
│       │   ├── location_time.py
│       │   └── reserve.py
│       ├── candidates/
│       │   ├── exact.py
│       │   ├── cross_code.py
│       │   ├── ordering_variant.py
│       │   ├── alternative.py
│       │   ├── conversion.py
│       │   └── pruning.py
│       ├── inventory/
│       │   ├── usable_quantity.py
│       │   ├── lots.py
│       │   ├── allocations.py
│       │   ├── reserves.py
│       │   ├── movement.py
│       │   └── aging.py
│       ├── classification/
│       │   ├── excess.py
│       │   ├── slow_moving.py
│       │   ├── obsolete.py
│       │   ├── demand_outlook.py
│       │   └── hard_triggers.py
│       ├── economics/
│       │   ├── purchase_avoidance.py
│       │   ├── transfer_cost.py
│       │   ├── conversion_cost.py
│       │   ├── carrying_cost.py
│       │   ├── valuation.py
│       │   └── provision.py
│       ├── solver/
│       │   ├── base.py
│       │   ├── cp_sat.py
│       │   ├── variables.py
│       │   ├── constraints.py
│       │   ├── objectives.py
│       │   ├── diagnostics.py
│       │   └── trace.py
│       ├── strategies/
│       │   ├── maximum_reuse.py
│       │   ├── minimum_obsolescence.py
│       │   ├── minimum_operational_cost.py
│       │   └── balanced.py
│       ├── actions/
│       │   ├── transfer.py
│       │   ├── share.py
│       │   ├── substitution.py
│       │   ├── repack.py
│       │   ├── quality.py
│       │   └── disposition.py
│       ├── orchestration/
│       ├── reviews/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── ownership-profiles/
├── quality-profiles/
├── disposition-profiles/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_reuse_policy.py
    ├── inspect_lot_eligibility.py
    ├── replay_reuse_plan.py
    ├── classify_inventory_health.py
    ├── compare_reuse_strategies.py
    ├── run_inventory_reuse_benchmark.py
    └── export_disposition_review.py
```


---

# 94. Codex 分阶段实施

不要让 Codex 一次实现全部所有权、替代复用、呆滞分类、处置和跨系统写回。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–40 的真实完成程度和接口；
2. 当前物料、Part、Ordering Variant、内部料号和客户料号；
3. 当前库存 Lot、Serial、包装、Date Code、MSL 和开封状态；
4. 当前库存所有权、客户归属、项目归属、寄售、VMI、保税和借料；
5. 当前 Allocation、Reservation、Frozen、Quality Hold、Quarantine 和 Expiry；
6. 当前客户共享、项目借料、跨仓和跨法人调拨；
7. 当前 Agent 33 替代关系和批准范围；
8. 当前 Agent 35 合规、原产地、客户限制和贸易约束；
9. 当前 Agent 37 Protected Reserve 和供应风险；
10. 当前 Agent 38 净需求、采购包装和剩余库存；
11. 当前 Agent 39 账面成本、库存资产、预期报废和项目利润；
12. 当前 Agent 40 需求、Pegging、缺料、PR 和调拨；
13. 当前库龄、移动历史、预测、项目关闭和产品退市；
14. 当前退供应商、转售、返工、重检、报废和财务减值流程；
15. 当前 Warehouse、QMS、ERP、PLM 和 Finance 写回接口；
16. 当前权限、审批、审计、Saga、Idempotency、Queue 和 Object Storage；
17. 统计 Ownership Unknown、Date Code Unknown、MSL Unknown、Traceability Missing 和跨客户限制；
18. 抽样分析合成或脱敏库存；
19. 不修改业务代码；
20. 不创建 Migration；
21. 不安装依赖；
22. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Inventory Lot；
- Ownership；
- Usage Right；
- Allocation；
- Protected Reserve；
- Demand；
- Reuse Candidate；
- Conversion；
- Reuse Plan；
- Excess Classification；
- Valuation；
- Disposition；
- Review；
- Event；
- JSON Schema。

## Phase 2：Upstream Adapter 和 Input Snapshot

实现：

- Agent 31–40 Adapter；
- Inventory/WMS；
- Quality/QMS；
- Ownership/Contract；
- Project/Customer；
- Finance；
- Snapshot Hash；
- Freshness；
- Version Compatibility；
- Idempotency。

## Phase 3：Inventory Lot Normalization

实现：

- Lot/Serial；
- Quantity State；
- Packaging；
- Date Code；
- MSL；
- Opened/Repacked；
- COO；
- Traceability；
- Book Value；
- Movement History；
- Data Quality。

## Phase 4：Ownership 和 Usage Rights

实现：

- Enterprise；
- Customer；
- Consignment；
- VMI；
- Bonded；
- Project；
- Intercompany；
- Usage Scope；
- Cross-customer；
- Cross-entity；
- Approval Profile；
- Unknown Gate。

## Phase 5：Allocation 和 Protected Reserve

实现：

- Soft/Firm/Frozen；
- Customer Reserve；
- Project Reserve；
- Service Reserve；
- LTB Reserve；
- Agent 37 Strategic Reserve；
- Release Proposal；
- Conservation。

## Phase 6：Quality、Date Code、MSL 和 Traceability

实现：

- Released/Hold/Quarantine；
- Expiry；
- Date Code；
- MSL/Floor Life；
- Bake/Repack；
- COC/COO；
- Storage History；
- Customer Rules；
- Review。

## Phase 7：Exact Reuse Candidate

实现：

- Same Part；
- Same Ordering Variant；
- Same Scope；
- Same Customer/Project；
- Location/Time；
- Packaging；
- R1–R3；
- Gate Trace。

## Phase 8：Cross-code 和 Ordering Variant Reuse

实现：

- Same MPN Different IPN；
- Customer Part Mapping；
- Packaging Suffix；
- Ordering Variant；
- Manufacturing Compatibility；
- R4–R5；
- Review。

## Phase 9：Approved Alternative Inventory

实现：

- Agent 33 Adapter；
- Validation Scope；
- Customer/Site/BOM Revision；
- R6；
- Substitution Request；
- No Auto BOM Change。

## Phase 10：Conversion-enabled Reuse

实现：

- Re-reel；
- Bulk-to-tape；
- Tray/Tube Repack；
- Bake/Reseal；
- Reinspection；
- Cost；
- Lead Time；
- Yield Loss；
- Traceability；
- R7。

## Phase 11：Cross-customer 和 Intercompany Proposal

实现：

- R8；
- Customer Consent；
- Ownership Transfer；
- Financial Settlement；
- Tax/Trade；
- Contract Review；
- Privacy；
- Proposal Only。

## Phase 12：Excess 和 Slow-moving Classification

实现：

- Horizons；
- Firm/Forecast Demand；
- Safety/Protected Reserve；
- Days Since Movement；
- Turns；
- Overstock；
- Slow-moving；
- Confidence；
- Reason Codes。

## Phase 13：Obsolescence 和 Lifecycle

实现：

- Project Closed；
- Product Sunset；
- EOL/LTB；
- Service Demand；
- Expiry；
- Alternative Adoption；
- Hard Trigger；
- Obsolete Candidate；
- No Automatic Writeoff。

## Phase 14：Valuation 和 Disposition

实现：

- Book；
- Replacement；
- Market；
- Recoverable；
- Scrap；
- Provision Suggestion；
- Return；
- Resale；
- Rework；
- Recycle；
- Writeoff Review。

## Phase 15：Reuse Optimization Solver

实现：

- CP-SAT；
- Quantity Variables；
- Eligibility Hard Constraints；
- Protected Reserve；
- Transfer/Conversion；
- Four Strategies；
- Timeout；
- Best Feasible；
- Trace；
- Conservation Tests。

## Phase 16：Agent 38/40 Integration

实现：

- Pre-buy Gate；
- Remaining Purchase Requirement；
- Reuse Reservation Draft；
- Transfer Suggestion；
- Recalculate Agent 38；
- Update Agent 40；
- Event Contracts；
- No Premature Deduction Before Approval。

## Phase 17：Review、Approval 和 Action Drafts

实现：

- Lock/Exclude Lot；
- Transfer Draft；
- Share Proposal；
- Substitution Request；
- Repack/Quality Task；
- Disposition Review；
- Patch；
- Approval；
- Audit。

## Phase 18：Orchestration、Saga 和 Write-back

实现：

- Transfer Order Gateway；
- Reservation；
- QMS Task；
- PLM Request；
- Finance Review；
- Idempotency；
- Saga；
- Compensation；
- Partial Failure。

## Phase 19：API、Events、Batch 和 Incremental

实现：

- API；
- Jobs；
- Batch；
- Progress；
- Events；
- Cache；
- Net-change；
- Cancel/Resume；
- Object Storage；
- Permissions。

## Phase 20：Benchmark、监控和生产发布

实现：

- Golden Tests；
- Ownership/Scope Security Tests；
- Quantity Conservation；
- Solver Benchmark；
- Portfolio Load Test；
- Metrics；
- Dashboard；
- Feature Flag；
- Policy Rollback；
- Disaster Recovery。

## Phase 21：历史校准，可选

稳定后：

- 使用实际库存消耗校准 Slow-moving 阈值；
- 使用实际处置结果校准 Recoverable Value；
- 使用人工审核校准 Balanced 权重；
- Shadow Mode；
- 不允许模型绕过 Hard Gate；
- 不自动生成会计分录。

---

# 95. Codex 工作纪律

Codex 必须：

1. Physical Stock 不等于 Reusable Stock；
2. Ownership 与 Usage Rights 分开；
3. Customer-owned、Consigned、VMI、Bonded 和 Project-owned 分开；
4. Unknown Ownership 必须阻断；
5. Part、Ordering Variant、Internal Part Number 和 Customer Part Number 分开；
6. Same MPN 不足以证明可复用；
7. Agent 33 未批准替代不得进入自动方案；
8. Agent 35 不合规库存不得进入当前需求；
9. Agent 37 Protected Reserve 不得被消耗；
10. Agent 40 Frozen Allocation 不得被抢占；
11. Soft Allocation 释放只能生成 Proposal；
12. Quality Hold、Quarantine、Expired 和 Scrap 不可用；
13. Date Code Unknown 不自动通过；
14. MSL/Floor Life 必须参与；
15. Traceability 缺失必须降低可用范围或阻断；
16. Packaging 和生产兼容性必须参与；
17. Cross-customer 只能生成 Proposal，不能自动 Allocation；
18. Cross-legal-entity 需要税务和财务审查；
19. Bonded Inventory 必须检查海关限制；
20. 客户共享不得泄露其他客户敏感信息；
21. 复用调拨不是零成本；
22. Transfer/Repack/Bake/Inspection 计入时间和成本；
23. 复用不可晚于需求日期；
24. FEFO/FIFO 是版本化策略；
25. 高风险战略库存可能需要保留；
26. Excess 不等于 Obsolete；
27. Obsolete 不只按 Aging；
28. Forecast Demand 与 Firm Demand 分开；
29. EOL Service Reserve 不得误判呆滞；
30. Project Closed 先检查客户退还和售后义务；
31. Book Value、Market Value、Recoverable Value 分开；
32. 本 Agent 不自动做会计减值或报废；
33. Resale 需所有权、合规、Traceability 和渠道许可；
34. 不将 Broker 报价当确定回收价值；
35. 所有金额使用 Decimal/Minor Units；
36. Hard Gate 在 Solver 之前；
37. Solver Timeout 不写 Optimal；
38. Infeasible 不伪造可行计划；
39. Lot 数量和分配必须守恒；
40. 正式执行前重新检查最新 Allocation；
41. Agent 38/40 只有批准复用量才能减少采购需求；
42. Reuse Reservation 有过期时间；
43. Action Draft 不等于正式调拨或处置；
44. Write-back 必须幂等和可补偿；
45. 不使用 LLM 做所有权、质量、合规、数量和财务判断；
46. 不把库存、客户、合同和成本数据发送给外部模型；
47. 公开测试只用合成或脱敏数据；
48. 不伪造库存价值、可回收价值、节省金额、测试或 Benchmark；
49. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter/Policy 变化；
    - 测试命令；
    - 真实结果；
    - Eligibility Accuracy；
    - Quantity Conservation；
    - Solver Status/Gap；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 96. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/inventory-reuse-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第41个 Agent：

Inventory Reuse, Excess & Obsolescence Intelligence Agent /
库存复用与呆滞料 Agent。

本 Agent 在新采购、Call-off 和库存补充之前，查找：

- 同一 Part / Ordering Variant 的直接可用库存；
- 同一 MPN 不同内部料号库存；
- 同一客户不同项目共享库存；
- 企业公共库存；
- 经审批可跨客户共享库存；
- Agent 33 已批准替代库存；
- 可通过 Re-reel、换包、烘烤、重检或重新标识后使用的库存；
- 超储、慢动、呆滞和临期库存；

并生成：

- 复用分配方案；
- 调拨草稿；
- 客户共享提案；
- 替代使用申请；
- 换包/烘烤/重检任务；
- Agent 38 净需求调整；
- Agent 40 供给和调拨建议；
- 退供应商、转售、返工、回收和报废审核建议；
- 库存健康、采购避免和呆滞价值报告。

本 Agent 不自动转移库存所有权、不自动修改 BOM、不自动跨客户分配、不自动报废、不自动转售、不自动做财务减值。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–40 的规格和实际代码；
3. docs/inventory-reuse-agent-spec.md；
4. 当前 Material、Part、Ordering Variant、IPN、Customer PN；
5. 当前 Inventory Lot、Serial、Packaging、Date Code、MSL、Opened/Repacked；
6. 当前 Ownership、Usage Rights、Customer/Project Scope、Consignment、VMI、Bonded；
7. 当前 Available、Soft/Firm/Frozen Allocation、Reservation、Quality Hold、Quarantine、Expired；
8. 当前 Quality、COC、COO、Storage History 和 Traceability；
9. 当前 Agent 33 Alternative Approval；
10. 当前 Agent 34 Lifecycle/EOL/LTB；
11. 当前 Agent 35 Compliance/Origin/Trade；
12. 当前 Agent 37 Protected Reserve 和风险；
13. 当前 Agent 38 Net Requirement、Packaging 和 Excess；
14. 当前 Agent 39 Book Cost、Inventory Asset、Writeoff Risk；
15. 当前 Agent 40 Demand、Pegging、Shortage、PR 和 Transfer；
16. 当前 Forecast、Movement、Project Close、Product Sunset；
17. 当前 Return、Resale、Rework、Recycle、Scrap 和 Financial Provision；
18. 当前 WMS、QMS、ERP、PLM、Finance Write-back；
19. 当前 Permission、Approval、Saga、Idempotency、Audit、Queue 和 Object Storage；
20. 脱敏、合成或授权 Fixture。

硬约束：

- Physical Stock 不等于 Reusable Stock；
- Ownership 与 Usage Rights 分开；
- Customer-owned、Consigned、VMI、Bonded、Project-owned 分开；
- Unknown Ownership 阻断；
- Same MPN 不足以自动复用；
- Part、Ordering Variant、IPN、Customer PN 分开；
- Agent 33 未批准替代不得使用；
- Agent 35 不合规库存不得使用；
- Agent 37 Protected Reserve 不得消耗；
- Agent 40 Frozen Allocation 不得抢占；
- Soft Allocation 只能生成释放提案；
- Quality Hold、Quarantine、Expired、Scrap 不可用；
- Date Code Unknown 不自动通过；
- MSL、Floor Life、Bake History 必须参与；
- Traceability 缺失必须阻断或限制为工程用途；
- Packaging 和 Machine Compatibility 必须参与；
- Cross-customer 只生成 Proposal；
- Cross-legal-entity 需要 Tax/Finance Review；
- Bonded Inventory 检查海关；
- 不泄露其他客户名称、数量和成本；
- Transfer/Repack/Bake/Inspection 计入成本和时间；
- 复用必须满足 Need Date；
- FEFO/FIFO 版本化；
- Strategic/Service/LTB Reserve 保留；
- Excess、Slow-moving、Obsolete 分开；
- 呆滞不只按库龄；
- Firm Demand 和 Forecast Demand 分开；
- EOL Service Reserve 不误判；
- Book/Replacement/Market/Recoverable Value 分开；
- 不自动会计减值；
- Resale 需所有权、合规、Traceability 和渠道许可；
- Hard Gate 在 Solver 之前；
- 数量守恒；
- Solver Timeout 返回 Best Feasible 和 Gap；
- Infeasible 不伪造；
- Agent 38/40 只有批准复用量才能减少采购；
- Action Draft 不等于正式执行；
- Write-back 幂等、可补偿；
- V1 不需要 LLM；
- 不把库存、客户、合同和成本发送给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造库存价值、节省金额、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–40 的真实完成程度和接口；
3. 查找 Material、Part、Ordering Variant、IPN、Customer PN；
4. 查找 Inventory Lot、Serial、Packaging、Date Code、MSL、Opened/Repacked；
5. 查找 Ownership、Usage Right、Customer/Project、Consignment、VMI、Bonded；
6. 查找 Allocation、Reservation、Frozen、Quality Hold、Quarantine、Expired；
7. 查找 COC、COO、Storage History 和 Traceability；
8. 查找 Alternative Approval 和 Customer/Site/BOM Scope；
9. 查找 Protected Reserve、Service Reserve 和 LTB Reserve；
10. 查找 Forecast、Firm Demand、Movement、Project Close 和 Product Sunset；
11. 查找 Return、Resale、Rework、Bake、Repack、Recycle、Scrap；
12. 查找 Book Value、Replacement Value、Provision 和 Writeoff；
13. 查找 Agent 38/40 的 Net Requirement、Pegging、PR 和 Transfer；
14. 查找 Cross-customer、Intercompany 和 Project Borrowing 流程；
15. 查找 WMS/QMS/ERP/PLM/Finance Write-back；
16. 查找 Permission、Approval、Saga、Idempotency、Audit；
17. 统计 Ownership Unknown、Date Code Unknown、MSL Unknown、Traceability Missing；
18. 抽样分析脱敏或合成库存；
19. 在 docs/inventory-reuse-implementation-plan.md 中生成实施计划；
20. 在 docs/inventory-lot-domain-model.md 中定义 Lot 和数量状态；
21. 在 docs/ownership-and-usage-rights.md 中定义所有权和使用权；
22. 在 docs/reuse-eligibility-gates.md 中定义硬门槛；
23. 在 docs/cross-customer-sharing.md 中定义跨客户和跨法人；
24. 在 docs/alternative-inventory-reuse.md 中定义替代库存；
25. 在 docs/excess-slow-obsolete-classification.md 中定义分类；
26. 在 docs/inventory-valuation-disposition.md 中定义价值和处置；
27. 在 docs/inventory-reuse-solver-design.md 中定义 CP-SAT；
28. 在 docs/integration-agent38-agent40.md 中定义采购前 Gate；
29. 在 docs/inventory-reuse-writeback.md 中定义动作、Saga 和幂等；
30. 在 docs/inventory-reuse-migration-plan.md 中定义旧数据迁移；
31. 在 docs/inventory-reuse-benchmark-plan.md 中定义 Benchmark；
32. 给出拟新增、拟修改和拟复用文件；
33. 给出 Phase 1 精确范围；
34. 不修改业务代码；
35. 不创建数据库 Migration；
36. 不安装依赖；
37. 不读取或打印生产 Secret；
38. 运行当前仓库已有 lint、type check、test、build 和 security scan；
39. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–40 输入契约；
- Inventory Lot；
- Ownership/Usage Rights；
- Allocation/Reserve；
- Quality/Date Code/MSL/Traceability；
- Exact/Cross-code/Alternative Reuse；
- Cross-customer/Intercompany；
- Excess/Slow/Obsolete；
- Valuation/Disposition；
- Solver；
- Agent 38/40 Integration；
- Review/Approval；
- Saga/Write-back；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 97. 后续 Phase 提示词模板

```text
继续实现 Inventory Reuse Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–41 规格；
3. 阅读 Inventory Reuse Implementation Plan；
4. 阅读 Lot、Ownership、Eligibility、Sharing、Alternative、Classification、Valuation、Solver 和 Write-back 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Ownership/Usage Right 分离；
- Exact/Approved Identity；
- Frozen/Protected Reserve；
- Quality/Date/MSL/Traceability；
- Cross-customer Proposal Only；
- Quantity Conservation；
- Hard Gate before Solver；
- Agent 38/40 Approved Reuse Only；
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
9. eligibility/property test；
10. quantity conservation test；
11. solver validation；
12. security test；
13. performance test；
14. benchmark；
15. 更新文档；
16. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Adapter/Policy 变化；
- 测试命令和真实结果；
- Eligibility Accuracy；
- Quantity Conservation；
- Solver Status/Gap；
- Purchase Avoidance；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 98. MVP 演示流程

1. Agent 40 产生某器件净需求 1500 颗；
2. Agent 41 查询全部库存 Lot；
3. 发现同项目可用库存 200；
4. 发现企业公共库存 600；
5. 发现同 MPN 不同内部编码库存 300；
6. 发现客户专用库存 500；
7. 客户专用库存被 Ownership Gate 阻断；
8. 发现一个已批准替代料库存 700；
9. 替代仅当前工厂批准，可进入候选；
10. 企业公共库存中 100 颗被 Frozen Allocation 占用；
11. 实际可复用为 500；
12. 一批库存 Date Code 超过客户限制，被阻断；
13. 一批库存 MSL Floor Life 用尽；
14. 存在批准烘烤流程，生成 Conditional Candidate；
15. Agent 37 要求保留 100 颗战略库存；
16. 生成 Exact Reuse 200；
17. 生成 Public Pool Reuse 400；
18. 生成 Cross-code Reuse 300；
19. 生成 Approved Substitute Reuse 600；
20. 需求已全部覆盖；
21. 由于替代使用需要客户审批，正式批准前仅扣减 900；
22. Agent 38 先按剩余 600 计算采购方案；
23. 客户批准替代后，Agent 38 重算为无需采购；
24. Agent 40 取消对应 PR Draft 建议；
25. 生成跨仓调拨草稿；
26. 生成烘烤和重新包装任务；
27. 项目 B 关闭，释放剩余库存；
28. 系统识别其中 2000 颗超储；
29. 发现未来 365 天没有 Firm Demand；
30. Agent 34 显示器件 NRND；
31. 分类为 `obsolete_candidate`，不是自动报废；
32. 检查供应商退货窗口；
33. 500 颗可退供应商；
34. 1000 颗可在其他产品通过批准替代消耗；
35. 剩余 500 颗生成转售或减值审核；
36. 显示 Book Value、Recoverable Value 和处置成本；
37. 人工锁定售后 Reserve；
38. 重新分类并减少呆滞数量；
39. 正式创建 Transfer Order 前再次检查 Allocation；
40. 写回失败时 Saga 不重复创建；
41. 发布 `inventory.reuse-plan.ready`。

---

# 99. 生产上线顺序

第一阶段：

```text
同一 Part/Ordering Variant
企业自有库存
Allocation/Reserve
Quality/Date Code
跨仓调拨草稿
Agent 38/40 前置 Gate
人工审核
```

第二阶段：

```text
同 MPN 跨编码
已批准替代库存
MSL/Bake/Repack
同客户跨项目
Excess/Slow-moving
库存健康 Dashboard
```

第三阶段：

```text
跨客户共享
跨法人调拨
价值和减值建议
退供应商/转售/回收
复杂 Solver
Portfolio 级优化
```

上线优先确保：

```text
库存是谁的
有没有被占用
质量和 Date Code 是否合格
是否真正适用于当前需求
批准前不能提前减少采购
```

宁可把一批“看上去型号一样”的库存标记为待确认，也不要为了消耗呆料，顺手把客户专用、质量隔离或无法追溯的料塞进量产工单。那不是库存优化，是把仓库问题变成现场事故。
