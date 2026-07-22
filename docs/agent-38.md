# MOQ、SPQ 与采购包装优化 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：38  
> Agent 名称：MOQ, SPQ & Procurement Packaging Optimization Agent  
> 中文名称：MOQ、SPQ 与采购包装优化 Agent  
> 版本：V1.0  
>
> 定位：根据 BOM 需求、生产批量、损耗、现有库存、在途、授权分销商报价和包装条件，在 Cut Tape、Tape & Reel、Re-reel、Tube、Tray、Bulk、Ammo Pack 等采购方式之间进行约束优化，平衡 MOQ、SPQ、订购倍数、采购金额、生产适配性、剩余库存、呆滞风险和交付风险。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规与原产地
> - Agent 36：实时价格与库存
> - Agent 37：BOM 风险与多源供应
> - ezPLM BOM、产品、库存、采购订单、生产计划、损耗、SMT 工艺和供应商数据
>
> 下游：
> - BOM 采购成本优化
> - 采购申请与询价
> - 供应商分单和采购建议
> - 生产备料和上机包装计划
> - 库存、呆滞和资金占用分析
> - 缺料风险、跨项目合并采购和安全库存
> - Quote、Cart、Order Agent
>
> 重要边界：
> - 本 Agent 只生成采购和包装建议，不自动创建订单、不自动支付、不自动修改 BOM。
> - 本 Agent 不验证技术替代，跨 MPN 合并必须使用 Agent 33 已批准关系。
> - 本 Agent 不把 Distributor 页面上的包装名称直接当作标准事实，必须通过 Agent 36 的 Canonical Packaging。
> - 价格、库存和包装条件必须绑定 Provider、SKU、地区、币种、账号、抓取时间和新鲜度。
> - 生产适配性高于表面单价；不允许为了低价推荐无法安全上机或客户不接受的包装。

---

# 1. 建设目标

系统必须能够：

1. 读取标准 BOM、生产计划和器件用量；
2. 读取 Agent 36 的授权 Offer、Price Tier、MOQ、Order Multiple、SPQ、包装和库存；
3. 读取企业内部库存、在途、已分配、隔离和 Date Code；
4. 计算每个 BOM Line 的毛需求、净需求和采购需求；
5. 支持 Prototype、Pilot、Mass Production、Service 和 LTB 场景；
6. 支持 Cut Tape、Tape & Reel、Re-reel、Tube、Tray、Bulk、Box、Bag 和 Ammo Pack；
7. 区分 MOQ、SPQ、Standard Pack、Order Multiple、Reel Quantity、Tray Capacity 和 Tube Capacity；
8. 处理整卷销售、拆卷销售、散料、Re-reel 和自定义包装；
9. 处理同一 MPN 的多个 Distributor SKU；
10. 处理同一技术 Part 的多个合法 Ordering Variant；
11. 在 Agent 33 批准后支持跨替代料分配；
12. 计算生产损耗、首件、换线、吸嘴丢料、编带尾料、料盘余量和补料缓冲；
13. 计算现有库存的可用量和包装适用性；
14. 优先消耗可用库存，同时遵守 FEFO/FIFO、Date Code、MSL 和客户限制；
15. 计算合法采购数量；
16. 选择对应 Price Break；
17. 计算物料金额、包装费、Re-reel 费、处理费和内部换包成本；
18. 计算剩余库存、库存覆盖天数和潜在呆滞；
19. 计算缺料、延期和停线风险；
20. 支持单行、整 BOM、跨 BOM、跨项目和多周期优化；
21. 支持一个 Offer、多个 Offer 或多个 Provider 分单；
22. 支持 Lowest Cash、Lowest Excess、Production-safe 和 Balanced 多种策略；
23. 使用整数优化，不能靠简单贪心处理所有情况；
24. 输出至少三个可解释方案；
25. 显示每个方案为什么被选中或被淘汰；
26. 支持人工锁定 Provider、SKU、包装、采购量和库存批次；
27. 支持预算上限、供应商数量上限和风险阈值；
28. 支持短缺时的部分采购和分阶段到货；
29. 支持价格、库存、生产计划变化后的增量重算；
30. 支持模拟下单前强制刷新；
31. 支持多租户合同价格和采购策略隔离；
32. 保存全部输入快照、求解参数和 Solver Trace；
33. 支持百万级 BOM 行的批量候选生成和分块求解；
34. 不因缺失 MOQ/SPQ 数据而猜测为 1；
35. 不因整卷单价低就自动推荐整卷；
36. 不把预计库存当成即时可采购库存；
37. 不把不可上机的 Cut Tape 当成量产安全方案；
38. 不把已拆封、过期、隔离或客户不接受的库存当可用库存。

---

# 2. 与 Agent 31–37 的边界

## 2.1 Agent 31

提供：

```text
BOM Line
Quantity per Assembly
Reference Designators
DNP / Variant
原始采购包装字段
```

Agent 38 不重新解析 BOM 文件。

## 2.2 Agent 32

提供精确：

```text
Manufacturer
MPN
Part
Package Variant
Ordering Variant
```

身份未精确解析时：

```text
optimization_status = blocked
reason = identity_unresolved
```

## 2.3 Agent 33

提供：

```text
approved alternatives
replacement level
validation scope
customer approval
```

未批准替代不能自动混入同一优化池。

## 2.4 Agent 34

提供：

```text
生命周期
EOL/LTB/LTS
PCN
```

EOL/NRND 和 LTB 影响过量库存、长期需求和包装策略。

## 2.5 Agent 35

提供：

```text
客户合规
原产地
贸易限制
包装材料限制
```

不合规 Offer 不进入可行解。

## 2.6 Agent 36

提供：

```text
Provider
Distributor SKU
Canonical Packaging
MOQ
Order Multiple
Standard Pack
Price Tiers
Available Stock
Expected Stock
Fees
Freshness
Account Context
```

这是本 Agent 的主要市场数据输入。

## 2.7 Agent 37

提供：

```text
Source Diversity
Single-source Risk
Inventory Risk
Lead-time Risk
Supplier/Region Risk
Hard Triggers
```

Agent 38 可在目标函数和约束中使用风险结果，但不能改写风险事实。

---

# 3. 核心原则

## 3.1 MOQ、SPQ、Order Multiple 和 Reel Quantity 分开

```text
MOQ
Minimum Order Quantity

SPQ
Standard Packaging Quantity

Order Multiple
合法订购增量

Reel Quantity
完整料盘数量
```

例如：

```text
MOQ = 100
Order Multiple = 10
SPQ = 3000
Reel Quantity = 3000
```

需求 125 颗，若允许 Cut Tape，合法采购量可能为 130；若 SKU 只允许整卷，则必须采购 3000。

## 3.2 包装是 Offer 属性，不是 Part 固定属性

同一 MPN 可能有：

```text
DigiKey Cut Tape SKU
DigiKey Reel SKU
Digi-Reel SKU
Mouser Cut Tape SKU
Mouser Reel SKU
Arrow Tray SKU
Element14 Re-reel SKU
```

每个 SKU 有独立价格、MOQ、库存和费用。

## 3.3 采购需求不等于 BOM 理论用量

```text
procurement_need =
  production_need
  + process_loss
  + setup_loss
  + sampling
  + safety_buffer
  + service_need
  - usable_inventory
  - qualified_inbound
```

## 3.4 生产包装适配性是硬约束

量产 SMT 可能要求：

```text
continuous tape
minimum leader/trailer
feeder-compatible reel
approved re-reel quality
orientation consistency
moisture handling
traceability
```

如果 Cut Tape 不能满足生产要求，它不是“价格略高或略低”的问题，而是不可行方案。

## 3.5 剩余库存有成本和风险

多买的器件不是免费资产。

考虑：

```text
cash tied up
carrying cost
expiry/MSL risk
EOL risk
forecast uncertainty
customer-specific inventory
storage/handling
write-off probability
```

## 3.6 多周期优于单批次局部最优

第一批需求 800，第二批两周后需求 2200：

- 单次购买 800 Cut Tape 可能看似便宜；
- 一次购买 3000 Reel 可能总成本更低。

必须支持多周期视图。

## 3.7 Hard Constraint 先于目标函数

先确定可行解：

```text
identity
compliance
source policy
packaging compatibility
quantity legality
stock availability
delivery date
budget hard cap
```

再比较成本、剩余和风险。

## 3.8 Unknown 不默认为 1

缺失：

```text
MOQ
Order Multiple
SPQ
Reel Size
Pack Size
```

必须标记：

```text
unknown_constraint
review_required
```

## 3.9 下单前重新刷新

优化结果引用的 Offer 只能用于计划。

生成 Cart/Order 前：

```text
refresh Offer
revalidate stock
revalidate price
revalidate quantity constraints
rerun or confirm plan
```

## 3.10 优化结果必须可解释和可重放

保存：

```text
input snapshot
candidate set
constraints
objective weights
solver version
solver status
selected variables
rejected candidates
calculation trace
```

---

# 4. 包装类型

Canonical Packaging：

```text
each
cut_tape
tape_and_reel
re_reel
tray
tube
bulk
box
bag
ammo_pack
waffle_pack
strip
custom
unknown
```

## 4.1 Cut Tape

特点：

- 按颗采购；
- MOQ 常较低；
- 单价可能较高；
- 小批量灵活；
- 量产上机可能需要额外编带或人工处理；
- 可能缺少足够 Leader/Trailer。

## 4.2 Tape & Reel

特点：

- 完整料盘；
- SPQ/Reel Quantity 大；
- 单价通常较低；
- 适合 SMT；
- 剩余库存可能较多。

## 4.3 Re-reel / Digi-Reel 类

特点：

- 从大卷拆出指定数量后重新上盘；
- 可能有服务费；
- 需确认最小数量、Leader/Trailer、方向和追溯；
- 不能默认等同制造商原始 Reel。

统一名称使用 `re_reel`，Provider 品牌名称保存为 Raw Service Name。

## 4.4 Tube

约束：

```text
tube_capacity
minimum_tube_count
partial_tube_allowed
end_stop/handling
orientation
```

## 4.5 Tray

约束：

```text
tray_capacity
full_tray_requirement
partial_tray_allowed
JEDEC tray compatibility
stack height
moisture handling
```

## 4.6 Bulk / Bag / Box

可能适合：

- 手工装配；
- THT；
- 连接器；
- 机械件。

不一定适合自动贴片。

---

# 5. 包装能力与生产工艺

每个包装候选保存：

```text
packaging_type
machine_compatible
feeder_type
manual_assembly_compatible
orientation_control
leader_length
trailer_length
pitch
reel_diameter
hub_diameter
tape_width
tray_standard
tube_dimensions
moisture_barrier
desiccant
humidity_indicator
traceability
manufacturer_original_pack
repacked
```

生产策略：

```text
prototype
manual_assembly
small_batch_smt
mass_production_smt
automotive
medical
customer_specific
```

同一个包装在不同工艺下可行性不同。

---

# 6. 需求模型

## 6.1 理论生产需求

```text
theoretical_need =
  build_quantity × quantity_per_assembly
```

## 6.2 DNP 和 Variant

仅统计当前：

```text
BOM Revision
Product Variant
Build Configuration
```

中实际装配行。

## 6.3 损耗模型

```text
process_loss =
  theoretical_need × percentage_loss
  + fixed_setup_loss
  + feeder_loading_loss
  + sampling_quantity
  + rework_buffer
```

## 6.4 多生产批次

```text
batch 1 date
batch 1 quantity
batch 2 date
batch 2 quantity
...
```

每批可有独立：

```text
line/site
yield
setup loss
packaging requirement
delivery date
```

## 6.5 售后和安全库存

```text
service_need
safety_stock
risk_buffer
```

必须区分：

- 生产批量需求；
- 项目安全库存；
- 企业通用安全库存；
- EOL/售后储备。

---

# 7. 损耗 Profile

按器件类别、封装和生产线配置：

```yaml
profile_id: smt-standard-0603
percentage_loss: 0.003
fixed_setup_loss: 10
feeder_loading_loss: 5
rework_buffer_percent: 0.002
minimum_remaining_on_reel: 20
```

复杂器件可单独配置：

```text
BGA
QFN
WLCSP
fine-pitch connector
LED with polarity
moisture-sensitive IC
```

损耗参数来自企业历史数据和人工批准，不由 LLM 猜测。

---

# 8. 可用库存模型

可用库存：

```text
on_hand
- allocated
- quarantine
- expired
- customer_reserved
- packaging_incompatible
- date_code_incompatible
- quality_hold
```

加上：

```text
confirmed inbound
qualified consignment
```

## 8.1 Lot 层级

每个 Lot 保存：

```text
lot_id
quantity
packaging
opened/unopened
date_code
receipt_date
expiry
MSL
floor_life_remaining
customer_scope
location
quality_status
```

## 8.2 包装兼容性

现有库存是散料，而生产要求整盘：

```text
usable_for_production = false
```

除非允许内部 Re-reel，并计入：

```text
internal_repack_cost
yield_loss
quality risk
lead time
```

## 8.3 库存消耗顺序

支持：

```text
FEFO
FIFO
date-code priority
customer-dedicated first/last
opened-package first
```

策略版本化。

---

# 9. Offer Candidate

```json
{
  "candidate_id": "uuid",
  "offer_snapshot_id": "uuid",
  "provider": "digikey",
  "distributor_sku": "296-XXXXCT-ND",
  "part_id": "uuid",
  "ordering_variant_id": "uuid",

  "packaging": {
    "type": "cut_tape",
    "spq": 1,
    "moq": 1,
    "order_multiple": 1,
    "reel_quantity": null,
    "partial_pack_allowed": true,
    "machine_compatibility": "conditional"
  },

  "supply": {
    "available_now": 5000,
    "expected_stock": 10000,
    "lead_time_days": 14,
    "freshness_status": "live"
  },

  "pricing": {
    "currency": "USD",
    "price_type": "contract_price",
    "tiers": [],
    "fees": [
      {
        "type": "re_reel_fee",
        "amount": "7.00"
      }
    ]
  },

  "constraints": {
    "authorized": true,
    "compliance_pass": true,
    "customer_allowed": true,
    "delivery_pass": true
  }
}
```

---

# 10. 合法采购数量

基础：

```text
q >= MOQ
q is multiple of Order Multiple
q <= Available Now
```

整包限制：

```text
q is multiple of SPQ
```

只在 Provider 明确要求整包时启用。

整卷：

```text
q is multiple of Reel Quantity
```

Cut Tape：

```text
q may be per-each or Order Multiple
```

Re-reel：

```text
q >= re_reel_minimum
q <= source reel availability
service fee applies
```

计算函数：

```python
def round_up_to_multiple(
    required: int,
    minimum: int,
    multiple: int,
) -> int:
    base = max(required, minimum)
    if multiple <= 1:
        return base
    return ((base + multiple - 1) // multiple) * multiple
```

但最终结果必须再经过：

```text
packaging-specific constraints
stock constraint
delivery constraint
```

---

# 11. Price Tier 选择

对每个合法数量：

```text
选择 minimum_quantity <= q 的最高阶梯
```

验证：

```text
maximum_quantity
price basis
currency
account context
tier completeness
effective time
```

若高数量超出已返回阶梯：

```text
quote_recommended = true
price_confidence = reduced
```

金额使用 Decimal。

---

# 12. 成本模型

## 12.1 直接采购成本

```text
material_cost =
  sum(purchase_quantity × unit_price)
```

## 12.2 包装与处理费

```text
re_reel_fee
cut_tape_fee
handling_fee
line_fee
small_order_fee
internal_repack_cost
inspection_cost
```

## 12.3 剩余库存成本

```text
excess_quantity =
  purchased + usable_inventory - fulfilled_demand - target_safety_stock
```

```text
inventory_carrying_cost =
  excess_value × annual_carrying_rate × holding_period_fraction
```

## 12.4 呆滞和报废风险

```text
expected_writeoff_cost =
  excess_value × writeoff_probability
```

Write-off Probability 输入：

```text
lifecycle
forecast uncertainty
customer specificity
shelf life
MSL
product sunset
alternative adoption
```

## 12.5 短缺风险成本

```text
shortage_penalty
line_stop_cost
expedite_cost
customer_delay_cost
```

这些成本需要企业 Profile，不能由系统随意猜测。

## 12.6 总拥有成本

```text
TCO =
  material
  + fees
  + internal handling
  + carrying cost
  + expected writeoff
  + shortage penalty
  + risk penalty
```

运费、税费和关税只有输入完整时才加入，且必须标记来源。

---

# 13. 优化目标

系统至少输出四种策略：

## 13.1 Lowest Cash Outlay

最小化当前现金支出。

适合原型和短期项目。

## 13.2 Lowest Excess

最小化剩余数量和库存价值。

## 13.3 Production-safe

优先：

```text
machine-compatible packaging
sufficient leader/trailer
traceability
delivery confidence
authorized source
low shortage risk
```

## 13.4 Balanced

综合：

```text
TCO
excess
production compatibility
supplier risk
delivery risk
source diversity
```

每个策略使用版本化权重。

---

# 14. 硬约束

```text
exact identity
approved ordering variant
approved alternative when cross-MPN
authorized source policy
compliance/customer pass
fresh-enough market data
delivery before need date
machine-compatible packaging
legal purchase quantity
available stock
budget hard cap
supplier/account permission
```

违反任何 Hard Constraint 的候选不得通过增加权重“补回来”。

---

# 15. 软约束与惩罚

```text
prefer original manufacturer packaging
prefer fewer suppliers
prefer existing supplier
prefer lower excess
prefer lower cash
prefer lower carrying cost
prefer lower risk
prefer higher source diversity
prefer unopened inventory
prefer FEFO
prefer consolidated shipments
```

---

# 16. 数学优化模型

使用整数变量：

```text
x_offer = 从某 Offer 采购的数量
y_offer = 是否启用该 Offer
z_lot = 从某库存 Lot 消耗的数量
u_shortage = 未满足需求
e_excess = 剩余库存
```

约束示意：

```text
sum(z_lot) + sum(x_offer) + u_shortage >= required_demand
```

```text
x_offer >= MOQ_offer × y_offer
```

```text
x_offer = OrderMultiple_offer × integer_variable
```

整卷时：

```text
x_offer = ReelQuantity_offer × integer_variable
```

库存：

```text
0 <= x_offer <= available_now_offer
```

供应商数量：

```text
sum(y_offer) <= max_supplier_count
```

目标：

```text
minimize(
  material_cost
  + fee_cost
  + carrying_cost
  + expected_writeoff
  + shortage_penalty
  + risk_penalty
  + supplier_split_penalty
)
```

V1 推荐：

```text
Google OR-Tools CP-SAT
```

涉及 Decimal 金额时，转换为最小货币单位整数。

---

# 17. 单行优化与 BOM 级优化

## 单行

快速比较同一 Part 的包装和 Offer。

## BOM 级

可以处理：

```text
供应商最小订单金额
每家供应商固定处理费
运费门槛
供应商数量上限
同一 Supplier 合并
共享库存
```

## 跨项目

同一 Part 同期出现在多个项目中：

```text
aggregate demand
→ meet reel/SPQ
→ allocate inventory back to projects
```

分配结果必须保留项目归属。

---

# 18. 多周期优化

时间段：

```text
week
month
production batch
```

变量增加：

```text
purchase_quantity[offer, period]
inventory_balance[period]
demand[period]
```

库存平衡：

```text
ending_inventory[t] =
  beginning_inventory[t]
  + inbound[t]
  + purchase[t]
  - demand[t]
  - loss[t]
```

考虑：

```text
lead time
delivery date
holding cost
expiry
forecast uncertainty
price validity
```

---

# 19. 分单策略

允许：

```text
single_offer
single_provider
multi_provider
staged_purchase
```

分单增加：

```text
line fee
freight
administrative cost
incoming inspection
traceability complexity
lot variation
```

因此不能因两家价格略低就无限拆单。

---

# 20. 生产包装转换

内部或第三方转换：

```text
bulk_to_tape
cut_tape_to_re_reel
tray_repack
tube_repack
```

保存：

```text
conversion_service
minimum quantity
cost
lead time
yield loss
quality certification
traceability
orientation control
approved vendor
```

未经批准的内部转换不能进入 Production-safe 方案。

---

# 21. Leader、Trailer 与 Feeder 余量

SMT 编带需求可能包括：

```text
leader components
trailer components
feeder setup quantity
minimum remaining tape
splice loss
```

采购需求可定义：

```text
machine_required_quantity =
  placement_quantity
  + feeder_setup
  + leader/trailer allowance
  + expected placement loss
```

这些参数按生产线和包装 Profile 配置。

---

# 22. Tray 与 Tube 数量优化

Tray：

```text
required_trays =
  ceil(required_quantity / tray_capacity)
```

但需要区分：

```text
full_tray_only
partial_tray_allowed
returnable tray
empty tray handling
```

Tube：

```text
required_tubes =
  ceil(required_quantity / tube_capacity)
```

同样保存是否允许 Partial Tube。

---

# 23. MSL、开封与保质期

器件和包装可能有：

```text
MSL
floor life
bake requirement
dry pack
desiccant
humidity indicator
expiry
opened_at
```

优化时需要：

- 优先消耗已开封、尚可用的包装；
- 避免采购大包装后跨越 Floor Life；
- 计算 Bake/重新包装成本；
- 客户不接受重新烘烤时阻断。

---

# 24. Date Code 和 Lot 约束

支持：

```text
maximum date-code age
same lot requirement
same date-code requirement
multi-lot allowed
customer approval
```

航空、汽车、医疗和客户定制项目可能禁止过多 Lot 混用。

---

# 25. EOL 与 LTB 包装优化

消费 Agent 34：

```text
remaining lifetime demand
LTB deadline
LTS date
alternative availability
product sunset
service obligation
```

目标不再只是最小短期 Excess，而是：

```text
lifetime service coverage
writeoff risk
storage life
approved alternative transition
```

EOL 情况使用独立策略 Profile。

---

# 26. 风险约束

消费 Agent 37：

```text
single-source
supplier risk
region risk
lead-time risk
inventory risk
```

可配置：

```text
禁止全部数量放在单一高风险渠道
至少两个授权 Provider
主渠道最大分配比例
区域最大暴露比例
Marketplace 最大比例 = 0
```

这些策略适用于关键物料，普通小批量可放宽。

---

# 27. 缓存和新鲜度

优化结果引用：

```text
offer_snapshot_id
inventory_snapshot_id
forecast_version
production_plan_version
policy_version
```

市场数据过期：

```text
result_status = stale_inputs
```

下单前强制：

```text
refresh exact selected offers
```

---

# 28. 结果方案

每次至少输出：

```text
recommended_balanced
lowest_cash
lowest_excess
production_safe
```

示例：

```json
{
  "plan_id": "uuid",
  "strategy": "balanced",
  "status": "feasible",

  "purchases": [
    {
      "provider": "digikey",
      "distributor_sku": "XXXXCT-ND",
      "packaging": "cut_tape",
      "quantity": 1300,
      "unit_price": "1.12",
      "fees": "0.00",
      "extended_cost": "1456.00"
    }
  ],

  "inventory_usage": [
    {
      "lot_id": "uuid",
      "quantity": 200
    }
  ],

  "summary": {
    "required_quantity": 1500,
    "fulfilled_quantity": 1500,
    "ending_excess": 0,
    "cash_outlay": "1456.00",
    "estimated_tco": "1489.00",
    "supplier_count": 1,
    "production_compatible": true
  },

  "warnings": [],
  "solver": {
    "status": "optimal",
    "gap": 0
  }
}
```

---

# 29. 方案比较

UI 显示：

| 方案 | 现金支出 | 总拥有成本 | 剩余数量 | 供应商数 | 包装适配 | 风险 |
|---|---:|---:|---:|---:|---|---|
| Lowest Cash | 低 | 中 | 中 | 2 | 条件适配 | 中 |
| Lowest Excess | 中 | 中 | 最低 | 1 | 适配 | 低 |
| Production-safe | 中 | 低 | 中 | 1 | 最佳 | 最低 |
| Full Reel | 最低单价 | 高 | 很高 | 1 | 最佳 | 呆滞高 |

不能只突出“单价最低”。

---

# 30. 不可行结果

若无可行解，输出：

```text
unmet quantity
failed constraints
nearest feasible alternatives
required manual actions
```

例如：

```text
需求 2500
授权即时库存 1800
预计库存 5000 但晚于生产日期
```

输出：

```text
当前可满足 1800
缺口 700
建议延期、加急、评估替代或修改生产批次
```

不得偷偷使用预计库存补足。

---

# 31. 人工锁定和约束

用户可锁定：

```text
provider
distributor SKU
packaging
minimum/maximum quantity
inventory lot
supplier count
budget
delivery date
risk threshold
```

锁定项进入 Hard Constraint，并显示对成本和剩余的影响。

---

# 32. 审核工作台

布局：

```text
左侧：BOM、需求批次和库存
中间：包装候选、数量和成本
右侧：方案比较、风险和剩余库存
底部：约束、求解 Trace 和人工锁定
```

视图：

```text
Demand
Inventory Lots
Offers
Packaging
Production Rules
Plans
Excess Inventory
Multi-period
Constraints
Solver Trace
```

操作：

- 修改损耗；
- 修改生产包装要求；
- 锁定 Provider/SKU；
- 排除某包装；
- 修改安全库存；
- 允许/禁止分单；
- 选择跨项目合并；
- 选择策略；
- 保存采购建议；
- 触发 Agent 36 刷新；
- 创建采购申请。

---

# 33. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "packaging_optimization_plan",
  "target_id": "uuid",
  "base_version": "solver-v1",

  "operations": [
    {
      "op": "replace",
      "path": "/constraints/max_supplier_count",
      "old_value": 2,
      "value": 1
    },
    {
      "op": "add",
      "path": "/locked_offers/-",
      "value": "offer-snapshot-uuid"
    }
  ],

  "reason_code": "procurement_review",
  "reviewer_id": "uuid"
}
```

原始求解结果不可覆盖，Patch 后重新求解。

---

# 34. API 设计

创建优化：

```text
POST /api/v1/procurement-packaging/optimizations
POST /api/v1/procurement-packaging/bom-jobs
POST /api/v1/procurement-packaging/portfolio-jobs
```

读取：

```text
GET /api/v1/procurement-packaging/jobs/{id}
GET /api/v1/procurement-packaging/jobs/{id}/events
GET /api/v1/procurement-packaging/optimizations/{id}
GET /api/v1/procurement-packaging/optimizations/{id}/plans
GET /api/v1/procurement-packaging/optimizations/{id}/candidates
GET /api/v1/procurement-packaging/optimizations/{id}/constraints
GET /api/v1/procurement-packaging/optimizations/{id}/solver-trace
GET /api/v1/procurement-packaging/boms/{bom_id}/summary
GET /api/v1/procurement-packaging/excess-inventory
GET /health/live
GET /health/ready
GET /metrics
```

操作：

```text
POST /api/v1/procurement-packaging/optimizations/{id}/rerun
POST /api/v1/procurement-packaging/optimizations/{id}/refresh-offers
POST /api/v1/procurement-packaging/optimizations/{id}/lock
POST /api/v1/procurement-packaging/optimizations/{id}/approve
POST /api/v1/procurement-packaging/optimizations/{id}/create-requisition
POST /api/v1/procurement-packaging/reviews/{id}/resolve
```

`create-requisition` 只创建采购申请草稿，不下单。

---

# 35. 状态机

```text
RECEIVED
→ LOADING_BOM_AND_DEMAND
→ VALIDATING_PART_IDENTITIES
→ LOADING_PRODUCTION_RULES
→ LOADING_INVENTORY_LOTS
→ LOADING_CONFIRMED_INBOUND
→ LOADING_MARKET_OFFERS
→ FILTERING_INVALID_OFFERS
→ NORMALIZING_PACKAGING
→ CALCULATING_NET_DEMAND
→ GENERATING_QUANTITY_CANDIDATES
→ SELECTING_PRICE_TIERS
→ BUILDING_OPTIMIZATION_MODEL
→ SOLVING_LOWEST_CASH
→ SOLVING_LOWEST_EXCESS
→ SOLVING_PRODUCTION_SAFE
→ SOLVING_BALANCED
→ VALIDATING_PLANS
→ CALCULATING_EXCESS_AND_RISK
→ GENERATING_COMPARISON
→ CREATING_REVIEWS
→ STORING_RESULTS
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_STALE_INPUTS
PARTIALLY_FEASIBLE
INFEASIBLE
REVIEW_REQUIRED
IDENTITY_INCOMPLETE
PACKAGING_DATA_INCOMPLETE
MARKET_DATA_INCOMPLETE
PRODUCTION_RULES_INCOMPLETE
SOLVER_TIMEOUT
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 36. 错误码

```text
BOM_NOT_FOUND
BOM_REVISION_NOT_FOUND
PART_IDENTITY_UNRESOLVED
ORDERING_VARIANT_UNAPPROVED
ALTERNATIVE_NOT_APPROVED
DEMAND_CONTEXT_MISSING
PRODUCTION_DATE_MISSING
PRODUCTION_PROFILE_MISSING
LOSS_PROFILE_MISSING
INVENTORY_DATA_MISSING
INVENTORY_LOT_INVALID
MARKET_DATA_MISSING
MARKET_DATA_STALE
NO_AUTHORIZED_OFFER
PACKAGING_UNKNOWN
PACKAGING_NOT_MACHINE_COMPATIBLE
MOQ_UNKNOWN
SPQ_UNKNOWN
ORDER_MULTIPLE_UNKNOWN
REEL_QUANTITY_UNKNOWN
TRAY_CAPACITY_UNKNOWN
TUBE_CAPACITY_UNKNOWN
PRICE_TIER_MISSING
PRICE_TIER_INCOMPLETE
AVAILABLE_STOCK_INSUFFICIENT
DELIVERY_DATE_INFEASIBLE
BUDGET_INFEASIBLE
CUSTOMER_RULE_BLOCKED
COMPLIANCE_BLOCKED
NO_FEASIBLE_PLAN
SOLVER_TIMEOUT
SOLVER_ERROR
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```


---

# 37. 数据库设计

## 37.1 `packaging_optimization_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
bom_revision VARCHAR NULL
optimization_scope VARCHAR NOT NULL
demand_context JSONB NOT NULL
production_context JSONB NOT NULL
market_context JSONB NOT NULL
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

## 37.2 `packaging_optimization_inputs`

```text
id UUID PK
job_id UUID NOT NULL
bom_snapshot_uri TEXT NOT NULL
demand_snapshot_uri TEXT NOT NULL
inventory_snapshot_uri TEXT NOT NULL
offer_snapshot_uri TEXT NOT NULL
production_rule_snapshot_uri TEXT NOT NULL
risk_snapshot_uri TEXT NULL
lifecycle_snapshot_uri TEXT NULL
compliance_snapshot_uri TEXT NULL
forecast_version VARCHAR NULL
market_data_as_of TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

## 37.3 `procurement_packaging_candidates`

```text
id UUID PK
job_id UUID NOT NULL
bom_line_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
offer_snapshot_id UUID NULL
provider VARCHAR NULL
distributor_sku VARCHAR NULL
packaging_type VARCHAR NOT NULL
raw_packaging VARCHAR NULL
moq NUMERIC NULL
spq NUMERIC NULL
order_multiple NUMERIC NULL
reel_quantity NUMERIC NULL
tray_capacity NUMERIC NULL
tube_capacity NUMERIC NULL
partial_pack_allowed BOOLEAN NULL
machine_compatibility VARCHAR NOT NULL
authorized_status VARCHAR NOT NULL
compliance_status VARCHAR NOT NULL
freshness_status VARCHAR NOT NULL
available_now NUMERIC NULL
lead_time_days NUMERIC NULL
candidate_status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 37.4 `production_packaging_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
name VARCHAR NOT NULL
version VARCHAR NOT NULL
production_type VARCHAR NOT NULL
site_id UUID NULL
line_id UUID NULL
machine_type VARCHAR NULL
allowed_packaging JSONB NOT NULL
leader_trailer_rules JSONB NOT NULL
loss_rules JSONB NOT NULL
moisture_rules JSONB NOT NULL
traceability_rules JSONB NOT NULL
customer_rules JSONB NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, name, version)
```

## 37.5 `packaging_loss_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
profile_name VARCHAR NOT NULL
version VARCHAR NOT NULL
part_category_id UUID NULL
package_family VARCHAR NULL
production_site_id UUID NULL
production_line_id UUID NULL
percentage_loss NUMERIC NOT NULL
fixed_setup_loss NUMERIC NOT NULL
feeder_loading_loss NUMERIC NOT NULL
sampling_quantity NUMERIC NOT NULL
rework_buffer_percent NUMERIC NOT NULL
minimum_remaining_quantity NUMERIC NULL
source_type VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, profile_name, version)
```

## 37.6 `inventory_lot_packaging_states`

```text
id UUID PK
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
packaging_type VARCHAR NOT NULL
original_packaging_type VARCHAR NULL
original_quantity NUMERIC NULL
remaining_quantity NUMERIC NOT NULL
opened BOOLEAN NOT NULL
opened_at TIMESTAMPTZ NULL
repacked BOOLEAN NOT NULL
repack_service_id UUID NULL
date_code VARCHAR NULL
expiry_date DATE NULL
msl_level VARCHAR NULL
floor_life_remaining_hours NUMERIC NULL
quality_status VARCHAR NOT NULL
customer_scope JSONB NOT NULL
machine_compatibility VARCHAR NOT NULL
updated_at TIMESTAMPTZ
```

## 37.7 `packaging_conversion_services`

```text
id UUID PK
tenant_id UUID NULL
provider_type VARCHAR NOT NULL
provider_id UUID NULL
service_type VARCHAR NOT NULL
source_packaging VARCHAR NOT NULL
target_packaging VARCHAR NOT NULL
minimum_quantity NUMERIC NULL
order_multiple NUMERIC NULL
unit_cost NUMERIC NULL
fixed_cost NUMERIC NULL
currency CHAR(3) NULL
lead_time_days NUMERIC NULL
yield_loss_percent NUMERIC NULL
orientation_control BOOLEAN NULL
traceability_level VARCHAR NULL
quality_approval_status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 37.8 `packaging_optimization_plans`

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
cash_outlay NUMERIC NULL
estimated_tco NUMERIC NULL
currency CHAR(3) NOT NULL
required_quantity NUMERIC NOT NULL
fulfilled_quantity NUMERIC NOT NULL
shortage_quantity NUMERIC NOT NULL
ending_excess_quantity NUMERIC NOT NULL
ending_excess_value NUMERIC NULL
supplier_count INT NOT NULL
production_compatible BOOLEAN NOT NULL
risk_level VARCHAR NULL
plan_uri TEXT NOT NULL
solver_trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, strategy, plan_version)
```

## 37.9 `packaging_plan_purchase_lines`

```text
id UUID PK
plan_id UUID NOT NULL
bom_line_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
offer_snapshot_id UUID NOT NULL
provider VARCHAR NOT NULL
distributor_sku VARCHAR NOT NULL
packaging_type VARCHAR NOT NULL
purchase_quantity NUMERIC NOT NULL
effective_unit_price NUMERIC NOT NULL
material_cost NUMERIC NOT NULL
fee_cost NUMERIC NOT NULL
extended_cost NUMERIC NOT NULL
currency CHAR(3) NOT NULL
expected_delivery_date DATE NULL
allocation JSONB NOT NULL
reason_codes JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 37.10 `packaging_plan_inventory_usage`

```text
id UUID PK
plan_id UUID NOT NULL
inventory_lot_id UUID NOT NULL
part_id UUID NOT NULL
allocated_quantity NUMERIC NOT NULL
allocation_order INT NOT NULL
packaging_compatible BOOLEAN NOT NULL
conversion_required BOOLEAN NOT NULL
conversion_service_id UUID NULL
reason_codes JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 37.11 `packaging_plan_period_balances`

```text
id UUID PK
plan_id UUID NOT NULL
part_id UUID NOT NULL
period_start DATE NOT NULL
period_end DATE NOT NULL
beginning_inventory NUMERIC NOT NULL
scheduled_inbound NUMERIC NOT NULL
planned_purchase NUMERIC NOT NULL
production_demand NUMERIC NOT NULL
process_loss NUMERIC NOT NULL
ending_inventory NUMERIC NOT NULL
shortage_quantity NUMERIC NOT NULL
expiry_loss NUMERIC NOT NULL
created_at TIMESTAMPTZ
UNIQUE(plan_id, part_id, period_start, period_end)
```

## 37.12 `packaging_plan_cost_breakdowns`

```text
id UUID PK
plan_id UUID NOT NULL
cost_type VARCHAR NOT NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
calculation_basis JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
```

成本类型：

```text
material
provider_fee
re_reel
internal_repack
inspection
freight
tax
tariff
carrying
expected_writeoff
shortage
expedite
supplier_split
```

## 37.13 `packaging_optimization_constraints`

```text
id UUID PK
job_id UUID NOT NULL
constraint_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
hard_constraint BOOLEAN NOT NULL
operator VARCHAR NOT NULL
value JSONB NOT NULL
source_type VARCHAR NOT NULL
policy_rule_id VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 37.14 `packaging_optimization_reviews`

```text
id UUID PK
job_id UUID NOT NULL
plan_id UUID NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
resolution JSONB NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 37.15 `packaging_plan_approvals`

```text
id UUID PK
plan_id UUID NOT NULL
approval_type VARCHAR NOT NULL
status VARCHAR NOT NULL
conditions JSONB NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
expires_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

---

# 38. 对象存储

```text
derived/procurement-packaging/
  {tenant_id}/{subject_type}/{subject_id}/
    {job_id}/
      input/
        bom-snapshot.json.zst
        demand-context.json
        production-context.json
        inventory-lots.json.zst
        inbound.json
        offers.json.zst
        risk-context.json
        policies.json
      candidates/
        normalized-candidates.json.zst
        rejected-candidates.json.zst
        quantity-candidates.json.zst
        price-tier-selections.json.zst
      models/
        lowest-cash-model.json
        lowest-excess-model.json
        production-safe-model.json
        balanced-model.json
      plans/
        lowest-cash.json
        lowest-excess.json
        production-safe.json
        balanced.json
        comparison.json
      periods/
        inventory-balances.json.zst
        purchase-schedule.json
      reports/
        excess-inventory.json
        cost-breakdown.json
        feasibility-report.json
        quality-report.json
        stale-input-report.json
      reviews/
        review-items.json
      debug/
        constraint-trace.json.zst
        solver-log.txt
        rejected-plan-reasons.json
```

Secrets、合同账号和完整 Provider 原始响应不复制到公共结果。

---

# 39. 事件

## 输入事件

```text
bom.normalized.ready
bom.mpn-resolution.ready
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
component.market-data.ready
bom.risk.ready
inventory.changed
purchase-order.changed
production-plan.updated
forecast.updated
packaging-profile.updated
```

## 输出事件

```text
procurement.packaging-plan.ready
procurement.packaging-plan.infeasible
procurement.excess-risk.detected
procurement.shortage-risk.detected
procurement.requisition-draft.ready
packaging.review.required
packaging.offer-refresh.required
```

## `procurement.packaging-plan.ready`

```json
{
  "event_type": "procurement.packaging-plan.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "subject_type": "bom",
  "subject_id": "uuid",
  "recommended_plan_id": "uuid",
  "comparison_uri": "s3://.../comparison.json",
  "summary": {
    "required_quantity": 150000,
    "purchase_quantity": 153200,
    "ending_excess_quantity": 3200,
    "cash_outlay": "18250.00",
    "estimated_tco": "19120.00",
    "shortage_lines": 0,
    "review_lines": 4
  },
  "status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 40. 规则与策略

```text
policies/
├── packaging-optimization-1.0.0.yaml
├── demand-netting.yaml
├── inventory-allocation.yaml
├── packaging-compatibility.yaml
├── moq-spq-order-multiple.yaml
├── production-loss.yaml
├── leader-trailer.yaml
├── msl-date-code.yaml
├── cost-model.yaml
├── objective-profiles/
│   ├── lowest-cash.yaml
│   ├── lowest-excess.yaml
│   ├── production-safe.yaml
│   └── balanced.yaml
├── supplier-split.yaml
├── risk-constraints.yaml
├── review.yaml
└── enterprise/
    └── tenant-specific/
```

所有参数必须版本化。

---

# 41. Candidate Filter 顺序

```text
Exact Identity
→ Ordering Variant Approval
→ Agent 33 Alternative Approval
→ Lifecycle Gate
→ Compliance/Customer Gate
→ Authorized Source Gate
→ Freshness Gate
→ Packaging Data Completeness
→ Machine Compatibility
→ Delivery Feasibility
→ Quantity Feasibility
→ Budget/Policy Gate
```

每次淘汰保存：

```text
candidate_id
failed_gate
reason_code
evidence
```

---

# 42. Solver 选择

V1 推荐：

```text
Google OR-Tools CP-SAT
```

原因：

- 整数变量；
- 包装倍数；
- MOQ；
- 是否选择供应商的布尔变量；
- 多策略求解；
- 可设置时间限制；
- 支持可行解和 Optimality Gap。

可选：

```text
MILP Solver
SCIP
CBC
Gurobi
CPLEX
```

商业 Solver 通过 Adapter 接入，不能成为唯一运行方式。

---

# 43. Solver 安全与稳定性

- 设置最大求解时间；
- 设置候选数量上限；
- 先做 Dominance Pruning；
- 大 BOM 按共享 Part 聚合；
- 支持分块和分层求解；
- 保存随机种子；
- 相同输入和版本应可重放；
- 超时返回 Best Feasible Plan 和 Gap；
- 绝不把 Timeout 伪装为 Optimal。

---

# 44. Candidate Dominance Pruning

候选 A 在以下所有方面不优于 B 时可淘汰：

```text
更高价格
更高 MOQ
更大 Order Multiple
更差包装适配
更少库存
更晚交付
更高风险
```

但以下上下文不同不能直接 Dominance：

```text
不同客户账号
不同地区
不同生命周期
不同来源类型
不同 Lot/Date Code
```

---

# 45. 约束冲突解释

不可行时运行 Constraint Diagnosis：

```text
需求日期早于所有可用 Offer
生产要求整卷但只有 Cut Tape
预算低于最小合法采购金额
客户要求单一 Lot 但库存分散
MOQ 导致超过库存上限
禁止 Marketplace 后无有效来源
```

输出 Minimal Conflict Set 或近似解释。

---

# 46. 多目标求解

推荐使用以下方式之一：

## 46.1 独立策略求解

对每个策略独立运行，输出四套方案。

## 46.2 Lexicographic

Production-safe：

```text
1. Shortage = 0
2. Packaging compatibility maximized
3. Delivery risk minimized
4. TCO minimized
```

## 46.3 Pareto Frontier

后续可输出：

```text
Cash vs Excess
Cash vs Risk
Supplier Count vs TCO
```

V1 不要求完整 Pareto Frontier。

---

# 47. 预算约束

支持：

```text
total budget
per-part budget
per-supplier budget
cash period budget
```

预算不足时：

- 输出 Partial Feasible；
- 显示缺口；
- 不自动降低安全库存或使用不合规来源；
- 可生成需要用户批准的 Relaxation Proposal。

---

# 48. 跨 BOM 合并采购

合并条件：

```text
same exact Part/Ordering Variant
compatible packaging
same customer/compliance scope
overlapping need dates
same tenant
```

替代料不能因技术相似自动合并。

输出分配：

```text
total purchased
allocated to project A
allocated to project B
shared safety stock
remaining common inventory
```

---

# 49. 采购包装与 SMT 备料接口

输出生产侧 Material Preparation Plan：

```text
source lot
packaging
reel/tube/tray count
quantity issued
feeder assignment candidate
conversion requirement
bake requirement
remaining quantity
return-to-stock packaging
```

Agent 38 不负责生成最终 SMT 程序，但为生产 Agent 提供备料数据。

---

# 50. 剩余库存分类

```text
planned_safety_stock
usable_common_inventory
project_specific_excess
customer_specific_excess
service_reserve
slow_moving_candidate
obsolete_candidate
writeoff_candidate
```

剩余不应全部标成“浪费”。

---

# 51. 数据质量

每个计划输出：

```text
identity_completeness
offer_completeness
moq_spq_completeness
packaging_compatibility_confidence
inventory_accuracy
demand_accuracy
loss_profile_confidence
cost_model_completeness
solver_quality
overall_confidence
```

关键数据缺失时：

```text
review_required = true
```

---

# 52. 可观测性

Metrics：

```text
packaging_optimization_jobs_total{status,scope}
packaging_optimization_duration_seconds{step}
packaging_candidates_total{packaging,status}
packaging_candidates_rejected_total{gate,reason}
packaging_solver_runs_total{strategy,status}
packaging_solver_duration_seconds{strategy}
packaging_solver_gap{strategy}
packaging_infeasible_total{reason}
packaging_excess_quantity_total
packaging_shortage_quantity_total
packaging_cash_outlay_total{currency}
packaging_tco_total{currency}
packaging_inventory_lots_used_total
packaging_re_reel_selected_total
packaging_full_reel_selected_total
packaging_cut_tape_selected_total
packaging_stale_offer_total
packaging_reviews_total{reason}
```

Dashboard：

- 各包装选择比例；
- Full Reel 与 Cut Tape 成本差；
- Excess Value；
- Shortage；
- Re-reel 使用量；
- MOQ/SPQ 数据缺失；
- Solver Timeout；
- 各策略节省金额；
- 跨项目合并节省；
- 采购后库存覆盖；
- 呆滞风险；
- 人工修改率。

---

# 53. Benchmark

## 53.1 数量约束

```text
MOQ evaluation accuracy
SPQ evaluation accuracy
Order Multiple accuracy
Reel Quantity accuracy
Tray/Tube capacity accuracy
legal buy quantity accuracy
```

## 53.2 需求

```text
BOM quantity accuracy
DNP/Variant accuracy
loss calculation accuracy
inventory netting accuracy
multi-period balance accuracy
```

## 53.3 价格

```text
price tier selection
price basis conversion
fee calculation
Decimal arithmetic
contract price isolation
```

## 53.4 包装

```text
packaging classification
machine compatibility
re-reel classification
partial pack rule
leader/trailer evaluation
MSL/date-code evaluation
```

## 53.5 优化

```text
feasibility accuracy
objective reproducibility
optimality gap
infeasibility explanation
dominance pruning correctness
strategy differentiation
```

## 53.6 业务

```text
cash saving
excess reduction
line shortage reduction
manual override rate
production rejection rate
writeoff reduction
expedite reduction
```

---

# 54. 初始质量目标

```text
Legal Purchase Quantity Accuracy = 100%
MOQ/SPQ/Order Multiple Separation Accuracy = 100%
Price Tier Selection Accuracy = 100%
Decimal Arithmetic Accuracy = 100%
Available vs Expected Stock Separation = 100%
Inventory Netting Accuracy >= 99.9%
Packaging Compatibility Accuracy >= 99%
Production Hard-constraint Recall >= 99.5%
Feasible Plan Validity = 100%
Infeasible Plan False-positive Rate = 0%
Contract Price Tenant Isolation = 100%
Solver Result Reproducibility >= 99.9%
Evidence Completeness >= 99%
```

这些是目标，不是未经验证的保证。

---

# 55. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## MOQ/SPQ

1. MOQ 1；
2. MOQ 100；
3. Order Multiple 5；
4. MOQ 与 Multiple；
5. SPQ 信息性；
6. SPQ 强制；
7. Reel Quantity；
8. Whole Reel；
9. Partial Pack；
10. Unknown MOQ；
11. Unknown SPQ；
12. Invalid Zero；
13. Conflicting Provider Fields；
14. Quantity Above Stock；
15. Maximum Order Quantity。

## Packaging

16. Cut Tape；
17. Full Reel；
18. Re-reel；
19. Tube；
20. Tray；
21. Bulk；
22. Ammo Pack；
23. Unknown；
24. Multiple Packaging SKU；
25. Manufacturer Original Pack；
26. Repacked；
27. Machine-compatible；
28. Machine-incompatible；
29. Leader Missing；
30. Orientation Unknown。

## Demand/Inventory

31. Simple BOM；
32. DNP；
33. Product Variant；
34. Percentage Loss；
35. Fixed Setup Loss；
36. Feeder Loss；
37. Sampling；
38. Safety Stock；
39. Service Demand；
40. Existing Inventory；
41. Allocated Inventory；
42. Quarantine；
43. Opened Pack；
44. Expired；
45. Confirmed Inbound；
46. Expected Stock；
47. Shared Inventory；
48. Multi-project；
49. Multi-period；
50. Zero Demand。

## Price/Cost

51. One Price Tier；
52. Multiple Tiers；
53. Per Pack；
54. Re-reel Fee；
55. Handling Fee；
56. Contract Price；
57. Currency；
58. Carrying Cost；
59. Writeoff Risk；
60. Shortage Penalty；
61. Budget Cap；
62. Supplier Fixed Fee；
63. Freight Threshold；
64. Tax Missing；
65. Tariff Included。

## Solver

66. Lowest Cash；
67. Lowest Excess；
68. Production-safe；
69. Balanced；
70. Single Offer；
71. Split Offer；
72. Single Supplier Constraint；
73. Two Supplier Constraint；
74. Full Reel vs Cut Tape；
75. Re-reel vs Full Reel；
76. Cross-project Reel；
77. Multi-period Purchase；
78. No Feasible Plan；
79. Partial Feasible；
80. Solver Timeout；
81. Best Feasible Gap；
82. Dominated Candidate；
83. Constraint Conflict；
84. Locked Offer；
85. Locked Inventory Lot。

## Lifecycle/Compliance/Risk

86. EOL；
87. LTB；
88. Customer-blocked Offer；
89. Marketplace-only；
90. Single-source Limit；
91. Regional Risk；
92. Stale Offer；
93. Agent 33 Unapproved Alternative；
94. MSL；
95. Date Code；
96. Customer Single-lot；
97. Risk Acceptance；
98. Review Patch；
99. Idempotency；
100. Replay Same Result。

---

# 56. 性能要求

单行：

```text
候选生成 P95 < 200 ms
四策略求解 P95 < 1 s
```

中型 BOM：

```text
1,000 lines cached P95 < 30 s
```

大型 BOM：

```text
10,000 unique Part
```

需要：

- Part 聚合；
- Candidate Pruning；
- 分组求解；
- 跨项目共享需求先聚合；
- 分块保存；
- 求解超时和 Best Feasible；
- 增量更新。

外部 Agent 36 实时刷新时间单独报告。

---

# 57. 缓存和增量

缓存键：

```text
bom_revision_hash
+ demand_plan_version
+ production_profile_version
+ loss_profile_version
+ inventory_snapshot_hash
+ inbound_snapshot_hash
+ offer_snapshot_hash
+ lifecycle_snapshot
+ compliance_snapshot
+ risk_snapshot
+ optimization_policy_version
+ solver_version
```

更新策略：

- Offer 变化：只重跑受影响 Part；
- Inventory 变化：只重跑相关 Part 和共享分配；
- Production Plan 变化：重跑对应周期；
- Loss Profile 变化：重跑对应类别/产线；
- BOM Revision 变化：处理变更行；
- Agent 33 变化：重新生成替代 Candidate；
- Agent 34/35/37 变化：重新过滤和风险约束。

---

# 58. 安全与权限

- 合同价格、预算、采购策略按租户隔离；
- Provider Account 和 Secret 不进入优化结果；
- 采购计划只显示用户有权限查看的价格；
- 创建 Requisition 需要明确权限；
- Plan Approval 和 Risk Relaxation 全部审计；
- 客户 Date Code、Lot 和合规要求私有；
- 不将 BOM、预测、价格和库存发送给外部通用模型；
- Solver 在受限 Worker 中运行；
- 大型任务限制 CPU、内存和时长；
- 下载使用签名 URL；
- 公开测试使用合成数据；
- 不执行供应商文件中的宏和代码；
- 不允许用户提交任意 Solver Expression。

---

# 59. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Google OR-Tools CP-SAT
```

批量分析可选：

```text
Polars
DuckDB
PyArrow
```

任务调度：

```text
Temporal
Celery
RQ
```

V1 不需要 LLM。

---

# 60. 推荐仓库结构

```text
procurement-packaging-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── procurement-packaging-agent-spec.md
│   ├── demand-netting-model.md
│   ├── packaging-constraint-model.md
│   ├── production-packaging-profile.md
│   ├── inventory-lot-allocation.md
│   ├── cost-and-excess-model.md
│   ├── solver-model.md
│   ├── multi-period-optimization.md
│   ├── cross-project-consolidation.md
│   ├── review-and-approval.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-moq-spq-order-multiple-separated.md
│       ├── 0002-packaging-is-offer-context.md
│       ├── 0003-production-compatibility-is-hard-constraint.md
│       ├── 0004-excess-inventory-has-cost.md
│       ├── 0005-no-order-placement.md
│       └── 0006-optimizer-results-are-replayable.md
├── src/
│   └── procurement_packaging/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── demand.py
│       │   ├── candidate.py
│       │   ├── packaging.py
│       │   ├── inventory.py
│       │   ├── cost.py
│       │   ├── plan.py
│       │   └── review.py
│       ├── inputs/
│       │   ├── bom.py
│       │   ├── parts.py
│       │   ├── alternatives.py
│       │   ├── lifecycle.py
│       │   ├── compliance.py
│       │   ├── market.py
│       │   ├── risk.py
│       │   ├── inventory.py
│       │   ├── inbound.py
│       │   └── production.py
│       ├── demand/
│       │   ├── theoretical.py
│       │   ├── loss.py
│       │   ├── safety.py
│       │   ├── service.py
│       │   └── periods.py
│       ├── packaging/
│       │   ├── registry.py
│       │   ├── compatibility.py
│       │   ├── quantities.py
│       │   ├── reel.py
│       │   ├── re_reel.py
│       │   ├── tray.py
│       │   ├── tube.py
│       │   └── conversion.py
│       ├── inventory/
│       │   ├── lots.py
│       │   ├── availability.py
│       │   ├── allocation.py
│       │   ├── fefo.py
│       │   ├── msl.py
│       │   └── leftovers.py
│       ├── candidates/
│       │   ├── builder.py
│       │   ├── gates.py
│       │   ├── dominance.py
│       │   └── quantity_candidates.py
│       ├── pricing/
│       │   ├── tiers.py
│       │   ├── basis.py
│       │   ├── fees.py
│       │   └── decimal_math.py
│       ├── costs/
│       │   ├── direct.py
│       │   ├── carrying.py
│       │   ├── writeoff.py
│       │   ├── shortage.py
│       │   └── tco.py
│       ├── solver/
│       │   ├── base.py
│       │   ├── cp_sat.py
│       │   ├── variables.py
│       │   ├── constraints.py
│       │   ├── objectives.py
│       │   ├── diagnostics.py
│       │   └── trace.py
│       ├── strategies/
│       │   ├── lowest_cash.py
│       │   ├── lowest_excess.py
│       │   ├── production_safe.py
│       │   └── balanced.py
│       ├── multi_period/
│       ├── consolidation/
│       ├── approvals/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── production-profiles/
├── packaging-registry/
├── loss-profiles/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_packaging_profiles.py
    ├── inspect_offer_constraints.py
    ├── replay_optimization.py
    ├── run_packaging_benchmark.py
    ├── compare_strategy_results.py
    └── export_requisition_draft.py
```


---

# 61. Codex 分阶段实施

不要让 Codex 一次实现全部包装、全部成本模型和全部多周期优化。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–37 的真实完成程度和接口；
2. BOM、Revision、Variant、Build Quantity 和 Production Plan；
3. Part、Package Variant、Ordering Variant 和 Distributor SKU；
4. Agent 36 中 MOQ、SPQ、Order Multiple、Standard Pack、Reel Quantity 和 Fees；
5. 现有库存、Lot、Date Code、MSL、Opened/Unopened 和包装；
6. Open PO、In-transit、Supplier Confirmation 和预计到货；
7. 生产线、Feeder、Tray、Tube、Reel 和损耗规则；
8. 当前采购建议、询价、Requisition、Cart 和 Order 模块；
9. 历史剩余库存、呆滞、损耗和停线数据；
10. 当前成本模型、币种、合同价格和预算；
11. Redis、队列、对象存储、审计、权限和 CI；
12. 数据覆盖、冲突、Unknown、Stale 和租户隔离；
13. 不修改业务代码；
14. 不创建 Migration；
15. 不安装依赖；
16. 不接触生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Optimization Request；
- Demand Context；
- Production Context；
- Packaging Candidate；
- Inventory Lot；
- Quantity Constraint；
- Cost Element；
- Plan；
- Period Balance；
- Review；
- Event；
- JSON Schema。

## Phase 2：Upstream Adapter 和 Input Snapshot

实现：

- Agent 31–37 Adapter；
- BOM Revision Snapshot；
- Offer Snapshot；
- Inventory Snapshot；
- Production Plan；
- Forecast；
- Version Hash；
- Idempotency；
- Freshness。

## Phase 3：Packaging Registry

实现：

- Canonical Packaging；
- Provider Alias；
- MOQ/SPQ/Multiple；
- Reel/Tray/Tube Capacity；
- Partial Pack；
- Original/Repacked；
- Data Quality；
- Registry Version。

## Phase 4：Production Packaging Profile

实现：

- Prototype/SMT/Mass Production；
- Machine Compatibility；
- Feeder；
- Leader/Trailer；
- Orientation；
- Traceability；
- MSL；
- Date Code；
- Customer Requirements。

## Phase 5：Demand Netting

实现：

- BOM Quantity；
- DNP/Variant；
- Build Batch；
- Percentage Loss；
- Fixed Setup Loss；
- Sampling；
- Rework；
- Safety Stock；
- Service Demand；
- Multi-period Demand。

## Phase 6：Inventory Lot Allocation

实现：

- Usable Inventory；
- Allocation；
- FEFO/FIFO；
- Opened Package；
- Packaging Compatibility；
- Date Code；
- MSL/Floor Life；
- Customer Scope；
- Conversion Candidate。

## Phase 7：Offer Candidate Generation

实现：

- Exact Identity；
- Ordering Variant；
- Agent 33 Approval；
- Lifecycle/Compliance/Risk Gate；
- Authorized Source；
- Freshness；
- Delivery；
- Packaging Candidate；
- Rejected Reason。

## Phase 8：Quantity Candidate 与 Price Tier

实现：

- MOQ；
- Order Multiple；
- SPQ；
- Full Reel；
- Re-reel；
- Tray/Tube；
- Available Stock；
- Price Tier；
- Decimal；
- Fees；
- Quote Recommended。

## Phase 9：成本与剩余库存模型

实现：

- Material；
- Fees；
- Repack；
- Carrying；
- Writeoff；
- Shortage；
- Supplier Split；
- Excess Classification；
- TCO；
- Confidence。

## Phase 10：单行 Solver

实现：

- CP-SAT Adapter；
- Variables；
- Hard Constraints；
- Lowest Cash；
- Lowest Excess；
- Production-safe；
- Balanced；
- Solver Trace；
- Timeout；
- Best Feasible。

## Phase 11：BOM 级优化

实现：

- Shared Provider；
- Supplier Fixed Cost；
- Supplier Count；
- Shipping Threshold；
- Shared Inventory；
- Part Dedup；
- Per-line Allocation；
- BOM Summary。

## Phase 12：跨项目合并采购

实现：

- Same Part/Ordering Variant；
- Need-date Compatibility；
- Customer Scope；
- Aggregate Demand；
- Reel/SPQ Benefit；
- Project Allocation；
- Common Inventory。

## Phase 13：多周期优化

实现：

- Period；
- Lead Time；
- Purchase Schedule；
- Inventory Balance；
- Expiry；
- Holding Cost；
- Price Validity；
- Forecast Scenario。

## Phase 14：包装转换和生产备料

实现：

- Re-reel；
- Bulk-to-tape；
- Tray/Tube Repack；
- Approval；
- Cost；
- Loss；
- Traceability；
- Material Preparation Plan。

## Phase 15：Infeasibility Diagnostics

实现：

- Constraint Conflict；
- Minimal/Approximate Conflict Set；
- Nearest Feasible；
- Relaxation Proposal；
- Review Required；
- No Silent Relaxation。

## Phase 16：Review、Approval 和 Requisition Draft

实现：

- Lock；
- Patch；
- Rerun；
- Plan Approval；
- Risk Acceptance；
- Audit；
- Create Requisition Draft；
- 不下单。

## Phase 17：API、Events、Batch 和 Cache

实现：

- API；
- Job；
- Progress；
- Batch；
- Retry/Cancel；
- Incremental；
- Events；
- Object Storage；
- Access Control；
- Cache。

## Phase 18：Benchmark、监控和生产发布

实现：

- Benchmark；
- Solver Load Test；
- Metrics；
- Dashboard；
- Security；
- Feature Flags；
- Policy Rollback；
- Disaster Recovery；
- Audit Replay。

## Phase 19：历史数据校准，可选

在规则和 Solver 稳定后：

- 用实际损耗校准 Loss Profile；
- 用剩余库存校准 Writeoff Probability；
- 用人工选择校准 Balanced 权重；
- 只做参数建议和 Shadow Mode；
- 不允许模型绕过 Hard Constraint。

---

# 62. Codex 工作纪律

Codex 必须：

1. MOQ、SPQ、Order Multiple、Pack Size 和 Reel Quantity 分开；
2. Packaging 是 Offer 属性，不是 Part 固定字段；
3. Part、Ordering Variant、Distributor SKU 分开；
4. 跨 MPN 只能使用 Agent 33 已批准替代；
5. DNP 和非当前 Variant 不计需求；
6. 采购需求包含生产损耗、Setup、Sampling 和 Safety；
7. Expected Stock 不计 Available Now；
8. Quarantine、Expired、Allocated 和 Customer-incompatible 库存不可用；
9. 库存 Lot 必须保留包装、Date Code、MSL 和状态；
10. Cut Tape 不默认适合量产 SMT；
11. Re-reel 不默认等于原厂 Reel；
12. Production Compatibility 是 Hard Constraint；
13. 缺失 MOQ/SPQ 不默认为 1；
14. 缺失 Tray/Tube Capacity 不猜测；
15. SPQ 只有 Provider 明确强制时才作为采购倍数；
16. Standard Pack 不自动等于 MOQ；
17. 金额使用 Decimal 或最小货币单位整数；
18. Price Tier 绑定数量、币种、账号和时间；
19. Stale Offer 必须标记；
20. 下单前必须刷新；
21. 单价最低不等于总成本最低；
22. Excess Inventory 必须计入 Carrying/Writeoff；
23. Shortage 不能因低预算静默接受；
24. 硬约束先于目标函数；
25. 不允许加权分数覆盖不合规或不可上机条件；
26. Solver Timeout 不得标记 Optimal；
27. Infeasible 不得生成伪可行计划；
28. Solver 输入、版本和 Trace 必须保存；
29. 相同输入和版本应可重放；
30. 多策略结果必须真正使用不同目标；
31. Candidate Pruning 不得删除上下文不同的 Offer；
32. 跨项目合并必须同租户、同 Scope、同 Part/Variant；
33. 多供应商分单需要计入固定费和管理成本；
34. Customer Lot/Date Code 约束必须参与；
35. MSL/Floor Life 不能忽略；
36. 风险数据只能约束和加罚，不能改写 Agent 37 事实；
37. Create Requisition 只生成草稿；
38. 不自动 Cart、Order、Payment；
39. 不将合同价格、BOM、库存和预测发送到外部模型；
40. V1 不需要 LLM；
41. 不使用真实客户数据做公开测试；
42. 不伪造 Solver Optimality、节省金额或 Benchmark；
43. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Policy/Profile 变化；
    - 测试命令；
    - 真实结果；
    - Solver Status/Gap；
    - 数据覆盖；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 63. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/procurement-packaging-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第38个 Agent：

MOQ, SPQ & Procurement Packaging Optimization Agent /
MOQ、SPQ 与采购包装优化 Agent。

本 Agent 根据：

- BOM 和生产批量；
- Quantity per Assembly；
- DNP/Variant；
- 生产损耗、Setup、Sampling 和 Safety Stock；
- 内部库存 Lot、包装、Date Code 和 MSL；
- Confirmed Inbound 和 Open PO；
- Agent 36 的 Provider、Distributor SKU、Packaging、MOQ、SPQ、Order Multiple、Price Tier、Available Stock、Lead Time、Fees 和 Freshness；
- Agent 33 已批准替代；
- Agent 34 生命周期；
- Agent 35 合规和客户条件；
- Agent 37 供应风险；

在 Cut Tape、Tape & Reel、Re-reel、Tube、Tray、Bulk、Ammo Pack 等采购方式之间生成：

- Lowest Cash；
- Lowest Excess；
- Production-safe；
- Balanced；

四类可解释采购包装方案。

本 Agent 只生成计划和采购申请草稿，不自动下单。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31、32、33、34、35、36、37 的规格和实际代码；
3. docs/procurement-packaging-agent-spec.md；
4. 当前 BOM、Revision、Variant、Production Plan 和 Build Batch；
5. 当前 Part、Package Variant、Ordering Variant 和 Distributor SKU；
6. 当前 Offer、Price Tier、MOQ、SPQ、Order Multiple、Pack Size、Reel Quantity 和 Fees；
7. 当前 Inventory、Lot、Packaging、Date Code、MSL、Opened、Allocation 和 Quarantine；
8. 当前 Open PO、Confirmed Inbound、Expected Stock 和 Delivery Date；
9. 当前生产线、Feeder、Reel、Tray、Tube、Leader/Trailer 和损耗数据；
10. 当前采购建议、Requisition、Quote、Cart、Order 和 Approval；
11. 当前 Tenant、Contract Price、Budget、Permissions 和 Audit；
12. 当前 Redis、Queue、Object Storage、Docker、CI 和 Tests；
13. 脱敏、合成或授权 Fixture。

硬约束：

- MOQ、SPQ、Order Multiple、Standard Pack、Reel Quantity 分开；
- Packaging 属于 Provider Offer/SKU Context；
- Part、Ordering Variant、Distributor SKU 分开；
- 不将同一 Part 不同包装算技术替代；
- 跨 MPN 只允许 Agent 33 已批准替代；
- Identity 未精确解析时阻断；
- DNP 和非当前 Product Variant 不计需求；
- Net Demand 必须包含 Production Loss、Setup、Sampling、Safety 和 Service；
- Expected Stock 不等于 Available Now；
- Quarantine、Expired、Allocated、Customer-incompatible Lot 不可用；
- Inventory Lot 保存 Packaging、Date Code、MSL 和 Opened Status；
- Cut Tape 不默认适合 Mass Production SMT；
- Re-reel 不默认等于 Manufacturer Original Reel；
- Machine Compatibility、Compliance、Customer、Delivery 是 Hard Constraint；
- 缺失 MOQ/SPQ/Multiple/Reel/Tray/Tube 数据不能猜测；
- Standard Pack 仅在明确强制时参与采购倍数；
- Price Tier 绑定 Quantity、Currency、Account、Region 和 Snapshot Time；
- 金额使用 Decimal 或最小货币单位整数；
- Stale Offer 必须标记；
- 下单或创建 Cart 前必须重新刷新；
- Lowest Unit Price 不等于 Lowest TCO；
- Excess 计算 Carrying 和 Writeoff；
- Shortage 不能静默接受；
- Hard Constraint 先于 Objective；
- Solver Timeout 返回 Best Feasible 和 Gap，不能写 Optimal；
- Infeasible 必须解释约束冲突；
- Solver Input、Version、Seed、Status、Gap 和 Trace 必须保存；
- 多策略必须使用不同目标；
- Candidate Pruning 不能跨 Account/Region/Scope 错误合并；
- 跨项目合并只允许同租户、同 Part/Variant、兼容 Scope 和 Need Date；
- Supplier Split 计入固定费、运费、检验和管理成本；
- MSL、Floor Life、Date Code、Lot 和 Traceability 必须参与；
- Create Requisition 只创建草稿；
- 本 Agent 不下单、不支付、不修改 BOM；
- V1 不需要 LLM；
- 不把私有 BOM、合同价格、库存和预测发送给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造最优解、节省金额、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–37 的真实完成程度和接口；
3. 查找 BOM、Revision、Variant、Build Batch、Production Plan；
4. 查找 Part、Package Variant、Ordering Variant、Distributor SKU；
5. 查找 Offer、Price Tier、MOQ、SPQ、Order Multiple、Standard Pack、Reel Quantity；
6. 查找 Cut Tape、Reel、Re-reel、Tube、Tray、Bulk 等现有枚举和字段；
7. 查找 Inventory Lot、Packaging、Date Code、MSL、Opened、Allocation、Quarantine；
8. 查找 Open PO、Confirmed Inbound、Expected Stock；
9. 查找生产线、Feeder、Leader/Trailer、Tray、Tube 和损耗规则；
10. 查找合同价格、币种、Budget 和 Provider Account；
11. 查找采购建议、Requisition、Quote、Cart、Order 和 Approval；
12. 查找历史 Excess、Writeoff、Loss、Line Stop 和 Expedite；
13. 查找 Solver、OR-Tools、MILP 或已有优化代码；
14. 查找 Cache、Queue、Object Storage、Permissions 和 Audit；
15. 统计 MOQ/SPQ/Packaging 数据覆盖、Unknown、Conflict 和 Stale；
16. 抽样分析脱敏或合成 BOM、Offer 和库存数据；
17. 在 docs/procurement-packaging-implementation-plan.md 中生成实施计划；
18. 在 docs/procurement-packaging-domain-model.md 中定义 Domain Model；
19. 在 docs/moq-spq-order-multiple-model.md 中定义数量约束；
20. 在 docs/production-packaging-profile.md 中定义生产包装规则；
21. 在 docs/demand-netting-model.md 中定义需求和损耗；
22. 在 docs/inventory-lot-allocation.md 中定义库存分配；
23. 在 docs/procurement-packaging-cost-model.md 中定义 TCO 和 Excess；
24. 在 docs/procurement-packaging-solver-design.md 中定义 CP-SAT 模型；
25. 在 docs/procurement-packaging-multi-period.md 中定义多周期；
26. 在 docs/procurement-packaging-consolidation.md 中定义跨项目合并；
27. 在 docs/procurement-packaging-review-design.md 中定义锁定、审核和采购申请草稿；
28. 在 docs/procurement-packaging-migration-plan.md 中定义旧数据迁移；
29. 在 docs/procurement-packaging-benchmark-plan.md 中定义 Benchmark；
30. 给出拟新增、拟修改和拟复用文件；
31. 给出 Phase 1 精确范围；
32. 不修改业务代码；
33. 不创建数据库 Migration；
34. 不安装依赖；
35. 不读取或打印生产 Secret；
36. 运行当前仓库已有 lint、type check、test、build 和 security scan；
37. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–37 输入契约；
- 当前 BOM/Demand/Production 模型；
- 当前 Offer 和 Packaging 数据；
- MOQ/SPQ/Order Multiple 区分；
- Inventory Lot 和 Packaging State；
- Production Packaging Profile；
- Demand Netting；
- Candidate Filter；
- Cost/TCO；
- Solver Model；
- 四种策略；
- Multi-period；
- Cross-project Consolidation；
- Infeasibility Diagnosis；
- Review/Approval/Requisition；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 64. 后续 Phase 提示词模板

```text
继续实现 Procurement Packaging Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–38 规格；
3. 阅读 Procurement Packaging Implementation Plan；
4. 阅读 Domain、MOQ/SPQ、Production、Demand、Inventory、Cost、Solver、Multi-period、Review 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Exact Identity；
- MOQ/SPQ/Multiple/Reel 分离；
- Packaging Offer Context；
- Available/Expected 分离；
- Inventory Lot 状态；
- Production Compatibility Hard Gate；
- Decimal；
- Hard Constraint before Objective；
- Solver Trace/Gap；
- Infeasible 不伪造；
- Requisition Draft Only；
- 不公开真实客户数据；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写测试；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. solver validation；
10. security test；
11. performance test；
12. benchmark；
13. 更新文档；
14. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Policy/Profile 变化；
- 测试命令和真实结果；
- Quantity/Packaging 指标；
- Solver Status/Gap；
- Cost/Excess 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 65. MVP 演示流程

1. 输入一个 50 行 BOM；
2. 指定生产 1000 台，每台主芯片 1 颗；
3. Loss Profile 计算需要 1020 颗；
4. 现有库存 120 颗，其中 20 颗已分配；
5. 可用库存为 100；
6. 净采购需求为 920；
7. Agent 36 返回：
   - Cut Tape MOQ 1；
   - Reel 3000；
   - Re-reel 可指定数量并收服务费；
8. Cut Tape 单价最高但无 Excess；
9. Full Reel 单价最低但剩余 2080；
10. Re-reel 采购 950，含 Feeder 余量和服务费；
11. Production Profile 禁止短 Cut Tape 上机；
12. Lowest Cash 选择 Cut Tape，但标记生产转换；
13. Lowest Excess 选择 Re-reel；
14. Production-safe 选择 Re-reel；
15. Balanced 比较 Carrying 和 Writeoff 后选择 Re-reel；
16. 第二个项目两周后需要 1900 颗；
17. 跨项目合并后 Full Reel 3000 成为最优；
18. 输出项目分配和公共剩余；
19. 现有库存 Lot 按 FEFO 使用；
20. 一个 Lot Date Code 不符合客户要求，被排除；
21. Expected Stock 晚于生产日期，不计入；
22. 模拟 Provider 库存只有 800；
23. 输出 Partially Feasible 和缺口 120；
24. 请求 Agent 36 刷新；
25. 用户锁定单一 Provider；
26. 重新求解并显示增加成本；
27. 保存采购审核 Patch；
28. 创建 Requisition Draft；
29. 不下单；
30. 发布 `procurement.packaging-plan.ready`。

---

# 66. 生产上线顺序

第一阶段：

```text
单 BOM Line
Cut Tape / Full Reel / Re-reel
MOQ / Order Multiple / Reel Quantity
净需求
现有库存
Price Tier
四种策略
人工审核
```

第二阶段：

```text
Tube / Tray / Bulk
生产包装 Profile
Leader/Trailer
MSL / Date Code
BOM 级 Supplier Consolidation
Requisition Draft
```

第三阶段：

```text
跨项目合并
多周期
包装转换服务
呆滞概率
复杂物流和预算
Portfolio 优化
```

上线优先确保：

```text
需求数量算得准
MOQ/SPQ/订购倍数不混淆
现有库存真正可用
包装能够上生产线
下单数量合法
剩余库存看得见
```

宁可输出“包装数据不完整，需要采购确认”，也不要把 SPQ、MOQ 和整卷数量揉成一个神秘数字，然后一本正经地建议多买两万颗。
