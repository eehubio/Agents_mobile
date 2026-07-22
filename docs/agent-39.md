# 成本、报价与利润 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：39  
> Agent 名称：Costing, Quotation & Profit Intelligence Agent  
> 中文名称：成本、报价与利润 Agent  
> 类型：规则＋算法型  
> 版本：V1.0  
>
> 定位：基于 BOM、采购包装优化、制造工艺、损耗、汇率、物流、关税、税费、平台费、支付费、销售费用、固定费用和目标利润，分别计算样机、试产和量产成本，生成可解释、可版本化、可审批的数量阶梯报价单。
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
> - ezPLM 项目、BOM、工艺路线、工时、设备、库存、采购、生产、物流、客户、合同和财务主数据
>
> 下游：
> - 客户报价单
> - 内部成本核算
> - 销售审批和利润审批
> - 采购预算
> - 样机、试产和量产决策
> - 数量阶梯价格
> - 项目盈亏分析
> - 订单、合同和发票 Agent
> - Tindie Listing 定价和平台佣金分析
>
> 重要边界：
> - 本 Agent 生成成本模型、报价草稿和利润分析，不自动签署合同、不自动确认订单、不自动开票或收款。
> - 税率、关税、汇率、运费、平台费和支付费必须绑定来源、地区、日期和版本。
> - 报价是特定客户、数量、交付条件、币种、付款条件和有效期下的商业提案，不能保存为产品永久售价。
> - 成本、售价、毛利率、加价率和净利润率必须分开。
> - 外部公开报价、客户合同价、内部标准成本和真实采购成本必须分层隔离。
> - 所有金额使用 Decimal 或最小货币单位整数，禁止使用二进制浮点数进行财务计算。

---

# 1. 建设目标

系统必须能够：

1. 对样机、试产和量产分别建立成本模型；
2. 根据不同生产数量生成数量阶梯；
3. 读取 Agent 38 选定的采购包装方案和实际采购数量；
4. 区分理论 BOM 成本、采购现金支出、实际消耗成本和剩余库存资产；
5. 读取制造、装配、测试、编程、包装和质量成本；
6. 计算 NRE、工程设计、治具、钢网、模具、认证和一次性费用；
7. 支持固定费用一次性收取、分摊或内部承担；
8. 支持元器件损耗、PCB 损耗、生产良率和返工成本；
9. 支持人工、设备、工位、产线和工厂 Overhead；
10. 支持汇率转换和汇率缓冲；
11. 支持国内和跨境运费、保险、仓储和配送；
12. 支持关税、附加税、进口税费和报关费用；
13. 支持销项税、销售税、VAT/GST 等税务处理模式；
14. 支持平台佣金、支付手续费、提现费和固定交易费；
15. 支持销售佣金、渠道返利、代理费和售后准备；
16. 支持折扣、优惠券、Rebate、Credit 和价格保护；
17. 支持目标毛利率、目标加价率和目标净利润率；
18. 能解决“费用按售价比例收取”导致的反向定价方程；
19. 支持最低价格、目标价格、建议价格和审批价格；
20. 支持按单件、批次、项目和生命周期查看盈利；
21. 支持不同客户、地区、币种、Incoterm、付款条件和交期；
22. 支持阶梯报价和 Break-even 分析；
23. 支持多种报价策略；
24. 支持风险准备金、汇率缓冲和材料价格波动缓冲；
25. 支持成本不确定性和区间报价；
26. 支持敏感性分析和 Scenario；
27. 生成正式报价单 PDF/HTML/JSON 数据；
28. 支持内部版和客户版报价单；
29. 客户版不泄露内部成本和利润；
30. 支持报价审批、版本、修订、撤回、过期和接受；
31. 支持报价转订单或合同的后续接口；
32. 支持价格刷新后重新核算；
33. 支持多租户、客户合同价和权限隔离；
34. 保存全部输入快照、规则版本和计算 Trace；
35. 不因缺失税率或运费而默认为 0；
36. 不因采购多余库存而全部计入本订单消耗成本；
37. 不将可退税、代收税和企业实际成本混为一谈；
38. 不把毛利率与加价率混淆；
39. 不把平台费和支付费遗漏在利润计算之外；
40. 不用“目标毛利率 × 成本”直接算报价；
41. 支持百万级历史报价和批量数量阶梯计算；
42. 支持 Tindie、直销、经销商、项目制和 OEM/ODM 等渠道模型。

---

# 2. 与 Agent 31–38 的边界

## 2.1 Agent 31

提供标准 BOM 和数量。

## 2.2 Agent 32

提供精确 Part、Package Variant 和 Ordering Variant。

## 2.3 Agent 33

提供已批准替代。Agent 39 不验证替代，只可比较已批准方案的商业成本。

## 2.4 Agent 34

提供生命周期、EOL、LTB 和 PCN。影响材料风险准备、库存摊销和报价有效期。

## 2.5 Agent 35

提供：

```text
关税分类候选
原产地
合规限制
进口税费规则
贸易条件
```

Agent 39 不自行做原产地法律判断。

## 2.6 Agent 36

提供实时价格、库存、币种和时间戳。

## 2.7 Agent 37

提供供应风险、价格波动和区域风险。用于风险缓冲和审批门槛。

## 2.8 Agent 38

提供：

```text
采购包装方案
采购数量
实际 Price Tier
MOQ/SPQ
包装费
剩余库存
TCO
供应商分配
```

Agent 39 应同时读取：

```text
cash purchase cost
consumed material cost
ending inventory asset
expected writeoff
```

不能简单把 Agent 38 的全部采购支出都计入本订单单位成本。

---

# 3. 核心原则

## 3.1 成本对象必须明确

支持：

```text
prototype build
pilot build
mass production lot
sales order
project
product variant
customer quote
lifetime program
```

没有成本对象和数量，就没有唯一“产品成本”。

## 3.2 成本、现金支出和资产分开

例如为了生产 1000 台购买 3000 颗 Reel：

```text
采购现金支出 = 3000 × 单价
本批消耗成本 = 实际使用数量 × 单价
剩余 2000 颗 = 库存资产或潜在呆滞
```

报价可按企业策略选择：

```text
只摊实际消耗
按项目专用库存全部回收
按未来需求概率部分摊销
单列 MOQ/SPQ 采购差额
```

必须明确展示。

## 3.3 固定成本和变动成本分开

固定成本：

```text
NRE
工程设计
程序开发
治具
钢网
模具
认证
首件
产线设置
项目管理
```

变动成本：

```text
BOM
PCB
SMT
DIP
组装
测试
包装
物流
平台和支付费
```

## 3.4 毛利率与加价率分开

```text
毛利率 =
(售价 - 销售成本) / 售价

加价率 =
(售价 - 销售成本) / 销售成本
```

成本 100：

```text
加价 30% → 售价 130 → 毛利率约 23.08%
目标毛利率 30% → 售价约 142.86
```

字段必须分别命名：

```text
gross_margin_rate
markup_rate
net_profit_margin_rate
```

## 3.5 税费的承担者和计价方式必须明确

税费可能：

```text
包含在报价中
报价外另计
由卖方承担
由买方承担
可抵扣
不可抵扣
代收代缴
```

不能一律加到成本。

## 3.6 售价相关费用需要反向求解

若平台费、支付费、销售佣金按售价百分比收取，目标毛利报价不是：

```text
成本 / (1 - 毛利率)
```

而是需要把所有按售价比例收费项目放入方程。

## 3.7 报价必须绑定上下文

```text
customer
channel
quantity
currency
destination
Incoterm
payment terms
delivery date
validity period
tax treatment
warranty
```

## 3.8 Unknown 不默认为 0

缺失：

```text
freight
tax
duty
exchange rate
processing fee
yield
```

必须：

```text
pending
estimate_required
excluded_with_disclaimer
```

## 3.9 客户版和内部版分开

客户版可显示：

```text
产品单价
NRE
运费
税费
交期
付款条件
有效期
```

内部版显示：

```text
完整成本
利润
风险准备
费用来源
审批轨迹
```

## 3.10 报价结果必须可重放

保存：

```text
BOM/cost snapshot
market snapshot
FX snapshot
tax/duty rule version
freight quote
fee rules
pricing policy
calculation trace
approval version
```

---

# 4. 成本阶段

## 4.1 样机 Prototype

典型特征：

```text
数量小
Cut Tape 或样品采购
工程工时高
手工焊接/返修多
一次性物流占比高
NRE 占比高
```

应支持：

```text
prototype service fee
engineering minimum charge
small-order fee
manual assembly
expedite
debug allowance
```

## 4.2 试产 Pilot

典型特征：

```text
钢网和治具
产线设置
首件确认
低产量导致固定费用摊销高
良率尚未稳定
额外测试和质量检查
```

## 4.3 量产 Mass Production

典型特征：

```text
完整 Reel/Tray
标准工艺时间
成熟良率
采购阶梯价
批量物流
售后准备
渠道费用
```

阶段必须使用不同：

```text
cost profile
yield profile
labor rate
overhead rate
risk buffer
minimum margin
```

---

# 5. 成本结构

```text
Direct Material
Direct Labor
Manufacturing
Quality & Test
Packaging
Logistics
Duty & Tax
Commercial Fees
NRE & Tooling
Overhead
Warranty & Service
Risk Reserve
Finance Cost
```

---

# 6. Direct Material

包括：

```text
electronic components
PCB
mechanical parts
cables
connectors
battery
display
enclosure
labels
fasteners
consumables
packaging materials
```

读取 Agent 38：

```text
selected source
effective purchase quantity
consumed quantity
unit material cost
fees
excess allocation
```

---

# 7. 材料损耗

```text
material_usage =
  theoretical_usage
  + setup_loss
  + process_loss
  + rework_loss
  + sampling
```

损耗 Profile 按：

```text
component category
package
production stage
factory
line
volume
```

版本化。

---

# 8. PCB 成本

支持：

```text
board area
layer count
quantity
panelization
material
copper weight
surface finish
impedance
HDI
blind/buried vias
test
tooling
freight
yield
```

PCB 报价可来自未来 PCB Quote Agent，也可人工输入。

保存：

```text
supplier quote
validity
quantity tier
tooling/non-recurring
unit cost
freight allocation
```

---

# 9. 制造和加工成本

## 9.1 SMT

```text
setup fee
stencil
placement count
component type
fine-pitch surcharge
BGA/QFN surcharge
double-sided
AOI
X-ray
SPI
reflow
panel handling
minimum lot fee
```

## 9.2 DIP / THT

```text
insertion count
wave solder
selective solder
manual solder
fixture
```

## 9.3 组装

```text
mechanical assembly
screw fastening
adhesive
cable assembly
enclosure
labeling
cleaning
```

## 9.4 编程和烧录

```text
firmware loading
serial number
certificate
secure key injection
programming fixture
cycle time
```

---

# 10. 测试和质量成本

```text
incoming inspection
first article
ICT
FCT
boundary scan
burn-in
calibration
visual inspection
AOI
X-ray
sampling plan
reliability test
certificate
traceability
```

测试成本可以：

```text
fixed setup
per-unit cycle
sampling quantity
failure retest
```

---

# 11. 良率和返工

## 11.1 Good Units

报价数量通常指合格交付数量：

```text
required_start_quantity =
ceil(deliverable_quantity / expected_yield)
```

多工序：

```text
total_yield =
pcb_yield
× smt_yield
× assembly_yield
× test_yield
```

需要保存每阶段良率，不只一个总数。

## 11.2 返工

```text
expected_rework_units
rework_success_rate
rework_cost
scrap_cost
```

## 11.3 良率不确定性

样机和试产可使用：

```text
base
optimistic
pessimistic
```

---

# 12. 人工成本

```text
role
standard hourly rate
loaded hourly rate
estimated hours
actual hours
overtime
region
currency
```

Loaded Rate 可包含：

```text
工资
福利
管理
办公
设备
```

必须说明是否与 Overhead 重复。

---

# 13. 设备和工位成本

方法：

```text
machine hourly rate
cycle time
setup time
utilization
maintenance allocation
depreciation allocation
energy
```

避免设备折旧在 Machine Rate 和 Overhead 中重复计算。

---

# 14. NRE 与一次性费用

```text
hardware design
firmware
mechanical design
layout
DFM
prototype bring-up
test fixture
programming fixture
stencil
mold/tooling
certification
documentation
project management
```

处理模式：

```text
separate_line_item
fully_amortized_in_quote
amortized_over_forecast
absorbed_by_seller
customer_creditable
```

---

# 15. Overhead

支持：

```text
percentage_of_direct_labor
percentage_of_conversion_cost
machine_hour_rate
activity_based_costing
fixed_project_charge
```

不允许多个 Overhead Profile 重复叠加而无提示。

---

# 16. 汇率

每次报价保存：

```text
source currency
quote currency
FX rate
FX source
observed_at
valid_until
buffer rate
rounding policy
```

支持：

```text
spot
daily reference
contract rate
hedged rate
manual approved rate
```

转换：

```text
converted_amount =
source_amount × fx_rate × (1 + fx_buffer)
```

汇率缓冲必须作为单独成本/风险显示。

---

# 17. 运费与物流

包括：

```text
inbound component freight
PCB freight
factory transfer
outbound freight
insurance
fuel surcharge
remote area
warehouse handling
customs brokerage
last-mile
```

分摊方式：

```text
per shipment
per line
by weight
by volume
by value
by unit
```

必须保存：

```text
carrier/service
origin
destination
chargeable weight
quote time
validity
Incoterm
```

---

# 18. 税费与关税

消费 Agent 35，并区分：

```text
customs duty
additional duty
import VAT/GST
sales tax
broker fee
clearance fee
environmental fee
recoverable tax
nonrecoverable tax
pass-through tax
```

每项保存：

```text
payer
recoverability
included/excluded
calculation base
rate
fixed amount
source
jurisdiction
effective date
```

---

# 19. 平台费和支付费

支持：

```text
platform percentage fee
platform fixed fee
listing fee
payment processor percentage fee
payment fixed fee
cross-border fee
currency conversion fee
payout fee
refund reserve
chargeback reserve
affiliate fee
sales commission
```

例如 Tindie、Stripe、Wise 或其他渠道规则都必须进入版本化 `Commercial Fee Profile`，不能硬编码。

---

# 20. 售后、质保和退货准备

```text
warranty reserve
return rate
replacement cost
support labor
shipping reserve
repair cost
chargeback reserve
```

可按：

```text
percentage of revenue
percentage of cost
expected value
per unit
```

---

# 21. 风险准备

读取 Agent 37：

```text
price volatility
lead-time risk
single source
regional risk
lifecycle risk
```

风险准备可表现为：

```text
cost contingency
quote validity shortening
material escalation clause
customer-supplied-material condition
reprice trigger
```

不能把风险准备隐藏在无解释的“其他费用”里。

---

# 22. 成本层级

```text
material_cost
conversion_cost
manufacturing_cost
landed_cost
cost_of_goods_sold
fully_loaded_cost
commercial_cost
expected_total_cost
```

推荐定义：

```text
manufacturing_cost =
material + direct labor + manufacturing + quality

landed_cost =
manufacturing_cost + inbound/outbound logistics + nonrecoverable duty/tax

fully_loaded_cost =
landed_cost + allocated NRE + overhead + warranty + risk reserve

commercial_cost =
platform/payment/sales fees

expected_total_cost =
fully_loaded_cost + commercial_cost
```

---

# 23. 利润指标

```text
contribution_margin
gross_profit
gross_margin_rate
markup_rate
operating_profit
operating_margin_rate
net_profit
net_profit_margin_rate
```

必须保存口径定义和费用层级。

---

# 24. 目标售价方程

若费用按售价比例收取：

```text
P = 售价
C = 不随售价变化的总成本
r = 平台、支付、佣金等售价比例费用之和
m = 目标利润率（以售价为分母）
f = 每单固定销售费用
```

则：

```text
P - rP - C - f = mP
```

所以：

```text
P = (C + f) / (1 - r - m)
```

前提：

```text
1 - r - m > 0
```

若税费包含在售价中、阶梯费率、最低手续费或封顶费存在，则使用分段规则或数值求解。

---

# 25. Markup 定价

若目标是成本加价率：

```text
P = C × (1 + markup_rate)
```

但此售价未必满足目标净利润率，因为平台费和支付费按售价扣除。

系统必须同时显示：

```text
requested markup
resulting gross margin
resulting net margin
```

---

# 26. 报价策略

至少支持：

```text
target_gross_margin
target_net_margin
cost_plus_markup
competitive_price_cap
customer_budget_cap
strategic_entry_price
prototype_service_price
mass-production_floor_price
channel-specific_price
```

每个策略保存：

```text
policy version
target
minimum floor
approval threshold
rounding
```

---

# 27. Price Floor

最低报价不能只等于成本。

```text
price_floor =
max(
  cash_cost_floor,
  fully_loaded_cost_floor,
  margin_policy_floor,
  channel_fee_floor,
  contractual_floor
)
```

战略报价低于 Fully Loaded Cost 时：

```text
exception_required = true
```

---

# 28. 数量阶梯报价

每个报价 Break 需独立重算：

```text
10
50
100
500
1000
5000
```

因为以下成本会变化：

```text
采购阶梯价
MOQ/SPQ
生产固定费摊销
良率
运费
包装
平台费
NRE 摊销
```

不能用单一成本乘一个折扣系数生成全部阶梯。

---

# 29. Break-even

对固定成本和单位贡献：

```text
break_even_quantity =
fixed_cost / unit_contribution_margin
```

需要明确：

```text
fixed cost scope
selling price
variable cost
channel fees
```

若数量阶梯导致单位价格变化，Break-even 使用分段计算。

---

# 30. 报价有效期

有效期由以下最短项决定：

```text
component price validity
inventory reservation
FX validity
freight quote validity
tax/duty rule validity
manufacturing quote validity
customer contract
```

系统生成：

```text
recommended_valid_until
```

人工可缩短，延长需审批。

---

# 31. 报价上下文

```json
{
  "quote_request_id": "uuid",

  "customer": {
    "customer_id": "uuid",
    "customer_profile_id": "uuid",
    "channel": "direct_b2b",
    "destination_country": "US"
  },

  "product": {
    "product_id": "uuid",
    "bom_id": "uuid",
    "bom_revision": "RevC",
    "variant": "Standard"
  },

  "quantities": [10, 100, 500, 1000],

  "stage": "pilot",

  "commercial": {
    "quote_currency": "USD",
    "incoterm": "DAP",
    "payment_terms": "50_percent_deposit",
    "tax_display_mode": "excluded",
    "nre_mode": "separate_line_item",
    "target_margin_type": "net_margin",
    "target_margin_rate": "0.20"
  },

  "delivery": {
    "requested_date": "2026-10-01",
    "ship_to_postal_code": "98101"
  },

  "versions": {
    "pricing_policy": "quote-policy-1.0.0",
    "cost_profile": "pilot-cost-v3",
    "commercial_fee_profile": "direct-b2b-us-v2"
  }
}
```

---

# 32. 标准成本结果

```json
{
  "cost_result_id": "uuid",
  "quantity": 500,

  "costs": {
    "direct_material": "8200.00",
    "direct_labor": "850.00",
    "manufacturing": "1500.00",
    "quality_test": "600.00",
    "packaging": "350.00",
    "logistics": "420.00",
    "nonrecoverable_tax_duty": "210.00",
    "allocated_nre": "1000.00",
    "overhead": "900.00",
    "warranty_reserve": "300.00",
    "risk_reserve": "400.00",
    "fully_loaded_cost": "14730.00"
  },

  "unit": {
    "fully_loaded_cost": "29.46"
  },

  "quality": {
    "status": "complete_with_estimates",
    "estimated_fields": [
      "outbound_freight"
    ]
  }
}
```

---

# 33. 标准报价结果

```json
{
  "quote_id": "uuid",
  "quote_version": 1,
  "currency": "USD",
  "status": "draft",

  "lines": [
    {
      "quantity": 500,
      "unit_price": "39.95",
      "extended_price": "19975.00",
      "nre": "2500.00",
      "freight": "420.00",
      "tax": null,
      "total_before_tax": "22895.00"
    }
  ],

  "internal_metrics": {
    "fully_loaded_cost": "14730.00",
    "commercial_fees": "1398.25",
    "expected_profit": "4866.75",
    "gross_margin_rate": "0.2626",
    "net_profit_margin_rate": "0.2126"
  },

  "valid_until": "2026-08-15",
  "approval_status": "margin_approval_required"
}
```

---

# 34. 成本不确定性

每个 Cost Element 保存：

```text
value
low
base
high
confidence
source_type
```

报价可输出：

```text
base price
risk-adjusted price
confidence band
```

客户报价通常给确定价格，但内部显示不确定性和缓冲。

---

# 35. Scenario

至少支持：

```text
base
component_price_plus_10
component_price_plus_25
fx_minus_5
fx_plus_5
yield_minus_3
freight_double
duty_plus_10
platform_fee_change
demand_lower_than_forecast
demand_higher_than_forecast
```

输出：

```text
profit impact
margin impact
break-even shift
quote floor change
approval status
```

---

# 36. 敏感性分析

对关键变量计算：

```text
component price
FX
yield
labor rate
freight
platform fee
sales discount
volume
```

输出 Top Drivers，帮助销售理解为什么价格不能再降。

---

# 37. 折扣审批

折扣类型：

```text
percentage
fixed amount
volume discount
coupon
rebate
channel discount
strategic discount
```

折扣后必须重新计算：

```text
gross margin
net margin
price floor
approval threshold
```

---

# 38. Round 与心理定价

支持：

```text
currency precision
round half up
round to 0.01
round to 0.05
round to 1
ending .99
customer contract increment
```

Round 后必须重新校验 Margin，不允许 Round 后低于 Floor。

---

# 39. 最小订单金额

支持：

```text
minimum order value
minimum line value
small-order surcharge
prototype minimum charge
```

这些可作为 Quote Line 或费用，不应偷偷修改单价而无说明。

---

# 40. 报价状态机

```text
DRAFT
→ CALCULATING_COST
→ VALIDATING_INPUTS
→ GENERATING_PRICE_TIERS
→ RUNNING_SCENARIOS
→ INTERNAL_REVIEW
→ MARGIN_APPROVAL
→ TAX_TRADE_REVIEW
→ SALES_APPROVAL
→ READY_TO_SEND
→ SENT
→ VIEWED
→ CUSTOMER_REVISION_REQUESTED
→ REVISED
→ ACCEPTED
→ EXPIRED
→ WITHDRAWN
→ REJECTED
```

---

# 41. 报价版本

任何以下变化生成新版本：

```text
BOM Revision
Quantity
Price
Currency
Incoterm
Payment Terms
Delivery
Tax Treatment
NRE
Discount
Validity
```

旧版本不可覆盖。

---

# 42. 客户版报价单

应包含：

```text
Quote Number
Customer
Product/Description
Revision
Quantity Breaks
Unit Price
NRE/Tooling
Freight
Tax Treatment
Lead Time
Delivery Terms
Payment Terms
Validity
Warranty
Exclusions
Assumptions
Acceptance Method
```

不得包含：

```text
BOM 成本
供应商合同价
目标利润率
内部风险分
内部审批意见
```

---

# 43. 内部报价单

额外包含：

```text
完整成本树
成本来源
利润
Margin
Markup
费用
风险准备
不确定性
Floor
Scenario
审批
```

---

# 44. 报价条款

条款模板版本化：

```text
price validity
material escalation
FX adjustment
customer-supplied material
MOQ/SPQ excess
engineering change
cancellation
reschedule
warranty
payment
tax
shipping
IP
confidentiality
```

Agent 只组合已批准模板，不自行生成法律条款。

---

# 45. 审批规则

例如：

```text
net margin >= 25% → 销售经理自动通过
15%–25% → 财务审批
5%–15% → 高管审批
<5% → 默认阻断
negative margin → 战略例外
```

真实阈值由租户策略配置。

还可基于：

```text
quote value
customer credit risk
payment terms
currency risk
NRE waiver
discount
uncertain cost
```

触发审批。

---

# 46. 人工覆盖

用户可覆盖：

```text
cost estimate
margin target
discount
NRE treatment
FX buffer
freight
tax display
validity
```

所有覆盖保存：

```text
old value
new value
reason
reviewer
timestamp
evidence
```

---

# 47. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "quote_version",
  "target_id": "uuid",
  "base_version": 1,

  "operations": [
    {
      "op": "replace",
      "path": "/commercial/target_margin_rate",
      "old_value": "0.25",
      "value": "0.20"
    }
  ],

  "reason_code": "strategic_customer_discount",
  "reviewer_id": "uuid"
}
```

Patch 后必须重算。

---

# 48. API 设计

创建：

```text
POST /api/v1/costing/cost-jobs
POST /api/v1/quotes
POST /api/v1/quotes/batches
```

读取：

```text
GET /api/v1/costing/jobs/{id}
GET /api/v1/costing/jobs/{id}/breakdown
GET /api/v1/costing/jobs/{id}/trace
GET /api/v1/quotes/{id}
GET /api/v1/quotes/{id}/versions
GET /api/v1/quotes/{id}/internal
GET /api/v1/quotes/{id}/customer-view
GET /api/v1/quotes/{id}/scenarios
GET /api/v1/quotes/{id}/approvals
GET /api/v1/quotes/{id}/document
GET /health/live
GET /health/ready
GET /metrics
```

操作：

```text
POST /api/v1/quotes/{id}/recalculate
POST /api/v1/quotes/{id}/revise
POST /api/v1/quotes/{id}/submit-for-approval
POST /api/v1/quotes/{id}/approve
POST /api/v1/quotes/{id}/reject
POST /api/v1/quotes/{id}/send
POST /api/v1/quotes/{id}/withdraw
POST /api/v1/quotes/{id}/accept
POST /api/v1/quotes/{id}/create-order-draft
```

`send` 需要显式权限和最终审批；`create-order-draft` 不自动确认订单。

---

# 49. 成本计算状态机

```text
RECEIVED
→ LOADING_PRODUCT_AND_BOM
→ LOADING_PURCHASE_PLAN
→ LOADING_MANUFACTURING_ROUTE
→ LOADING_COST_PROFILES
→ LOADING_FX
→ LOADING_LOGISTICS
→ LOADING_TAX_AND_DUTY
→ LOADING_COMMERCIAL_FEES
→ CALCULATING_MATERIAL_COST
→ CALCULATING_CONVERSION_COST
→ CALCULATING_YIELD_AND_REWORK
→ ALLOCATING_NRE
→ CALCULATING_LANDED_COST
→ CALCULATING_FULLY_LOADED_COST
→ CALCULATING_COMMERCIAL_COST
→ GENERATING_PRICE_TIERS
→ CHECKING_MARGIN_FLOOR
→ RUNNING_SCENARIOS
→ CREATING_APPROVALS
→ RENDERING_DOCUMENTS
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_ESTIMATES
REVIEW_REQUIRED
MISSING_COST_INPUT
MARGIN_BELOW_FLOOR
TAX_REVIEW_REQUIRED
FX_STALE
OFFER_STALE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 50. 错误码

```text
PRODUCT_NOT_FOUND
BOM_NOT_FOUND
BOM_REVISION_NOT_FOUND
PURCHASE_PLAN_MISSING
PURCHASE_PLAN_STALE
MANUFACTURING_ROUTE_MISSING
COST_PROFILE_MISSING
YIELD_PROFILE_MISSING
LABOR_RATE_MISSING
MACHINE_RATE_MISSING
NRE_POLICY_MISSING
FX_RATE_MISSING
FX_RATE_STALE
FREIGHT_ESTIMATE_MISSING
DUTY_RULE_MISSING
TAX_RULE_MISSING
COMMERCIAL_FEE_PROFILE_MISSING
PAYMENT_FEE_MISSING
PLATFORM_FEE_MISSING
WARRANTY_PROFILE_MISSING
RISK_RESERVE_PROFILE_MISSING
PRICE_POLICY_MISSING
TARGET_MARGIN_INVALID
PRICE_EQUATION_INFEASIBLE
PRICE_BELOW_FLOOR
NEGATIVE_MARGIN
QUOTE_VALIDITY_INDETERMINATE
APPROVAL_REQUIRED
DOCUMENT_RENDER_FAILED
JOB_CANCELLED
INTERNAL_ERROR
```


---

# 51. 数据库设计

## 51.1 `costing_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
bom_revision VARCHAR NULL
stage VARCHAR NOT NULL
quantity_breaks JSONB NOT NULL
customer_context JSONB NULL
commercial_context JSONB NOT NULL
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

## 51.2 `cost_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
bom_snapshot_uri TEXT NOT NULL
purchase_plan_snapshot_uri TEXT NOT NULL
manufacturing_route_snapshot_uri TEXT NULL
inventory_snapshot_uri TEXT NULL
forecast_snapshot_uri TEXT NULL
market_snapshot_uri TEXT NULL
fx_snapshot_uri TEXT NULL
tax_duty_snapshot_uri TEXT NULL
logistics_snapshot_uri TEXT NULL
commercial_fee_snapshot_uri TEXT NULL
policy_snapshot_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

## 51.3 `cost_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
name VARCHAR NOT NULL
version VARCHAR NOT NULL
stage VARCHAR NOT NULL
site_id UUID NULL
currency CHAR(3) NOT NULL
profile_uri TEXT NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, name, version)
```

## 51.4 `cost_elements`

```text
id UUID PK
cost_result_id UUID NOT NULL
cost_category VARCHAR NOT NULL
cost_subcategory VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
quantity_break NUMERIC NOT NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
unit_amount NUMERIC NULL
fixed_or_variable VARCHAR NOT NULL
recoverability VARCHAR NULL
payer VARCHAR NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NULL
confidence NUMERIC(5,4) NOT NULL
estimate_status VARCHAR NOT NULL
calculation_rule_id VARCHAR NOT NULL
calculation_trace JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 51.5 `cost_results`

```text
id UUID PK
job_id UUID NOT NULL
quantity_break NUMERIC NOT NULL
stage VARCHAR NOT NULL
cost_currency CHAR(3) NOT NULL
direct_material NUMERIC NOT NULL
direct_labor NUMERIC NOT NULL
manufacturing NUMERIC NOT NULL
quality_test NUMERIC NOT NULL
packaging NUMERIC NOT NULL
logistics NUMERIC NOT NULL
nonrecoverable_tax_duty NUMERIC NOT NULL
allocated_nre NUMERIC NOT NULL
overhead NUMERIC NOT NULL
warranty_reserve NUMERIC NOT NULL
risk_reserve NUMERIC NOT NULL
finance_cost NUMERIC NOT NULL
fully_loaded_cost NUMERIC NOT NULL
unit_fully_loaded_cost NUMERIC NOT NULL
cash_outlay NUMERIC NULL
inventory_asset_created NUMERIC NULL
expected_writeoff NUMERIC NULL
confidence NUMERIC(5,4) NOT NULL
quality_status VARCHAR NOT NULL
breakdown_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, quantity_break)
```

## 51.6 `fx_rate_snapshots`

```text
id UUID PK
tenant_id UUID NULL
source_currency CHAR(3) NOT NULL
target_currency CHAR(3) NOT NULL
rate NUMERIC(24,12) NOT NULL
rate_type VARCHAR NOT NULL
source VARCHAR NOT NULL
observed_at TIMESTAMPTZ NOT NULL
valid_until TIMESTAMPTZ NULL
buffer_rate NUMERIC(9,6) NOT NULL
status VARCHAR NOT NULL
source_reference TEXT NULL
created_at TIMESTAMPTZ
```

## 51.7 `logistics_cost_quotes`

```text
id UUID PK
tenant_id UUID NOT NULL
provider_id UUID NULL
service_level VARCHAR NULL
origin JSONB NOT NULL
destination JSONB NOT NULL
incoterm VARCHAR NULL
chargeable_weight NUMERIC NULL
weight_unit VARCHAR NULL
volume NUMERIC NULL
volume_unit VARCHAR NULL
currency CHAR(3) NOT NULL
base_charge NUMERIC NOT NULL
fuel_surcharge NUMERIC NULL
insurance NUMERIC NULL
remote_area_fee NUMERIC NULL
brokerage_fee NUMERIC NULL
other_fees JSONB NOT NULL
quoted_at TIMESTAMPTZ NOT NULL
valid_until TIMESTAMPTZ NULL
status VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NULL
created_at TIMESTAMPTZ
```

## 51.8 `tax_duty_cost_items`

```text
id UUID PK
cost_result_id UUID NOT NULL
tax_type VARCHAR NOT NULL
jurisdiction VARCHAR NOT NULL
calculation_base NUMERIC NOT NULL
rate NUMERIC NULL
fixed_amount NUMERIC NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
payer VARCHAR NOT NULL
recoverability VARCHAR NOT NULL
display_mode VARCHAR NOT NULL
included_in_price BOOLEAN NOT NULL
rule_version_id VARCHAR NOT NULL
source_reference_id UUID NULL
created_at TIMESTAMPTZ
```

## 51.9 `commercial_fee_profiles`

```text
id UUID PK
tenant_id UUID NOT NULL
name VARCHAR NOT NULL
channel VARCHAR NOT NULL
region VARCHAR NULL
currency CHAR(3) NULL
version VARCHAR NOT NULL
fee_rules_uri TEXT NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, name, version)
```

## 51.10 `commercial_fee_results`

```text
id UUID PK
quote_version_id UUID NOT NULL
fee_type VARCHAR NOT NULL
calculation_basis VARCHAR NOT NULL
rate NUMERIC NULL
fixed_amount NUMERIC NULL
minimum_amount NUMERIC NULL
maximum_amount NUMERIC NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
payer VARCHAR NOT NULL
profile_rule_id VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.11 `pricing_policies`

```text
id UUID PK
tenant_id UUID NOT NULL
name VARCHAR NOT NULL
channel VARCHAR NOT NULL
stage VARCHAR NULL
customer_segment VARCHAR NULL
version VARCHAR NOT NULL
policy_uri TEXT NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, name, version)
```

## 51.12 `quotes`

```text
id UUID PK
tenant_id UUID NOT NULL
quote_number VARCHAR NOT NULL
customer_id UUID NOT NULL
product_id UUID NOT NULL
bom_id UUID NOT NULL
status VARCHAR NOT NULL
current_version INT NOT NULL
owner_id UUID NOT NULL
channel VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(tenant_id, quote_number)
```

## 51.13 `quote_versions`

```text
id UUID PK
quote_id UUID NOT NULL
version_number INT NOT NULL
costing_job_id UUID NOT NULL
currency CHAR(3) NOT NULL
stage VARCHAR NOT NULL
incoterm VARCHAR NULL
payment_terms VARCHAR NULL
tax_display_mode VARCHAR NOT NULL
nre_mode VARCHAR NOT NULL
pricing_strategy VARCHAR NOT NULL
target_margin_type VARCHAR NOT NULL
target_margin_rate NUMERIC(9,6) NULL
valid_from TIMESTAMPTZ NOT NULL
valid_until TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
customer_view_uri TEXT NOT NULL
internal_view_uri TEXT NOT NULL
calculation_trace_uri TEXT NOT NULL
terms_template_version VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(quote_id, version_number)
```

## 51.14 `quote_quantity_breaks`

```text
id UUID PK
quote_version_id UUID NOT NULL
quantity NUMERIC NOT NULL
unit_price NUMERIC NOT NULL
extended_product_price NUMERIC NOT NULL
nre_amount NUMERIC NOT NULL
freight_amount NUMERIC NULL
tax_amount NUMERIC NULL
discount_amount NUMERIC NOT NULL
total_before_tax NUMERIC NOT NULL
total_after_tax NUMERIC NULL
currency CHAR(3) NOT NULL
fully_loaded_cost NUMERIC NOT NULL
commercial_fee NUMERIC NOT NULL
expected_profit NUMERIC NOT NULL
gross_margin_rate NUMERIC NOT NULL
net_profit_margin_rate NUMERIC NOT NULL
markup_rate NUMERIC NOT NULL
price_floor NUMERIC NOT NULL
approval_status VARCHAR NOT NULL
UNIQUE(quote_version_id, quantity)
```

## 51.15 `quote_discounts`

```text
id UUID PK
quote_version_id UUID NOT NULL
quantity_break_id UUID NULL
discount_type VARCHAR NOT NULL
rate NUMERIC NULL
fixed_amount NUMERIC NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
reason_code VARCHAR NOT NULL
approval_required BOOLEAN NOT NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
```

## 51.16 `quote_scenarios`

```text
id UUID PK
quote_version_id UUID NOT NULL
scenario_id VARCHAR NOT NULL
scenario_version VARCHAR NOT NULL
parameters JSONB NOT NULL
status VARCHAR NOT NULL
cost_delta NUMERIC NULL
profit_delta NUMERIC NULL
margin_delta NUMERIC NULL
new_price_floor NUMERIC NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(quote_version_id, scenario_id, scenario_version)
```

## 51.17 `quote_approvals`

```text
id UUID PK
quote_version_id UUID NOT NULL
approval_type VARCHAR NOT NULL
approval_level VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
conditions JSONB NOT NULL
assigned_to UUID NULL
requested_at TIMESTAMPTZ NOT NULL
decided_at TIMESTAMPTZ NULL
decided_by UUID NULL
decision_note TEXT NULL
```

## 51.18 `quote_delivery_events`

```text
id UUID PK
quote_version_id UUID NOT NULL
event_type VARCHAR NOT NULL
channel VARCHAR NOT NULL
recipient JSONB NOT NULL
status VARCHAR NOT NULL
provider_message_id VARCHAR NULL
occurred_at TIMESTAMPTZ NOT NULL
metadata JSONB NOT NULL
```

## 51.19 `quote_acceptances`

```text
id UUID PK
quote_version_id UUID NOT NULL
acceptance_method VARCHAR NOT NULL
accepted_by_name VARCHAR NULL
accepted_by_email VARCHAR NULL
accepted_at TIMESTAMPTZ NOT NULL
customer_reference VARCHAR NULL
evidence_uri TEXT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.20 `quote_review_patches`

```text
id UUID PK
quote_version_id UUID NOT NULL
base_calculation_hash CHAR(64) NOT NULL
operations JSONB NOT NULL
reason_code VARCHAR NOT NULL
reviewer_id UUID NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

---

# 52. 对象存储

```text
derived/costing-quotes/
  {tenant_id}/{product_id}/
    costing/
      {job_id}/
        input/
          bom-snapshot.json.zst
          purchase-plan.json.zst
          manufacturing-route.json
          cost-profiles.json
          fx.json
          logistics.json
          tax-duty.json
          commercial-fees.json
        quantities/
          qty-10/
            cost-breakdown.json
            cost-elements.json.zst
            price-calculation.json
          qty-100/
          qty-1000/
        scenarios/
        reports/
          cost-summary.json
          uncertainty-report.json
          sensitivity.json
          quality-report.json
        debug/
          calculation-trace.json.zst
          rule-evaluation-log.json
    quotes/
      {quote_id}/
        v{version}/
          internal/
            quote-internal.json
            quote-internal.html
            quote-internal.pdf
          customer/
            quote.json
            quote.html
            quote.pdf
          attachments/
          scenarios/
          approvals/
          audit/
```

内部版和客户版必须使用不同访问策略。

---

# 53. 事件

## 输入事件

```text
bom.normalized.ready
bom.mpn-resolution.ready
component.market-data.ready
procurement.packaging-plan.ready
bom.risk.ready
component.compliance.changed
component.lifecycle.changed
manufacturing.route.updated
production.yield.updated
fx.rate.updated
logistics.quote.updated
tax.rule.updated
commercial.fee.updated
pricing.policy.updated
```

## 输出事件

```text
costing.result.ready
quote.draft.ready
quote.approval.required
quote.ready_to_send
quote.sent
quote.viewed
quote.revised
quote.accepted
quote.expired
quote.margin_below_floor
quote.cost_input.stale
```

## `quote.draft.ready`

```json
{
  "event_type": "quote.draft.ready",
  "event_version": "1.0",
  "quote_id": "uuid",
  "quote_version": 1,
  "customer_id": "uuid",
  "currency": "USD",
  "customer_document_uri": "s3://.../quote.pdf",
  "internal_document_uri": "s3://.../quote-internal.pdf",
  "summary": {
    "quantity_breaks": 4,
    "minimum_net_margin": "0.183",
    "approval_required": true,
    "valid_until": "2026-08-15"
  },
  "created_at": "ISO-8601"
}
```

---

# 54. 规则和配置

```text
policies/
├── costing-1.0.0.yaml
├── cost-elements.yaml
├── yield-and-rework.yaml
├── nre-allocation.yaml
├── overhead.yaml
├── logistics-allocation.yaml
├── fx.yaml
├── tax-duty.yaml
├── warranty.yaml
├── risk-reserve.yaml
├── commercial-fees/
│   ├── direct-b2b.yaml
│   ├── distributor.yaml
│   ├── tindie.yaml
│   └── marketplace-generic.yaml
├── pricing/
│   ├── prototype.yaml
│   ├── pilot.yaml
│   ├── mass-production.yaml
│   └── strategic.yaml
├── approvals.yaml
├── rounding.yaml
├── quote-validity.yaml
├── document-templates.yaml
└── enterprise/
    └── tenant-specific/
```

所有规则必须版本化并可回滚。

---

# 55. Cost Element 统一结构

```json
{
  "cost_element_id": "uuid",
  "category": "manufacturing",
  "subcategory": "smt_placement",
  "scope": {
    "type": "quantity_break",
    "quantity": 1000
  },
  "amount": "280.00",
  "currency": "USD",
  "fixed_or_variable": "variable",
  "calculation": {
    "basis": "placement_count",
    "rate": "0.0008",
    "quantity": 350000
  },
  "source": {
    "source_type": "factory_rate_card",
    "source_id": "uuid",
    "valid_from": "ISO-8601",
    "valid_to": "ISO-8601"
  },
  "confidence": 0.98,
  "estimate_status": "confirmed"
}
```

---

# 56. 费用防重复

系统必须检测：

```text
labor already included in SMT unit price
machine depreciation already included in machine rate
freight already included in supplier quote
tax already included in price
platform fee already included in sales commission
overhead already loaded into labor rate
```

输出：

```text
possible_double_count
```

强制审核。

---

# 57. NRE 分摊规则

支持：

```text
separate
full_to_first_order
forecast_amortization
committed_quantity_amortization
lifetime_program_amortization
seller_absorbed
conditional_credit
```

示例：

```text
NRE = 20,000
承诺量 = 10,000
单位摊销 = 2
```

若客户实际只购买 2,000，需要显示未回收 NRE 风险。

---

# 58. 样机和试产最小收费

样机成本常有：

```text
minimum engineering charge
minimum SMT lot charge
minimum test setup charge
minimum logistics charge
```

报价不能仅按单位成本 × 数量，否则极小批次可能严重亏损。

---

# 59. 分段费用

支持：

```text
percentage with minimum
percentage with maximum
tiered percentage
fixed plus percentage
per transaction
per payout
per line
```

例如：

```text
fee = max(fixed + price × rate, minimum)
```

需要使用规则引擎或分段求解，不能简单把费率相加。

---

# 60. 含税价反算

若报价为含税价：

```text
tax_inclusive_price
```

应根据税基规则拆分：

```text
net selling price
tax collected
seller revenue
```

代收税不应算作收入或利润。

---

# 61. 可抵扣税

例如输入税可抵扣时：

```text
cash payment
recoverable tax asset
nonrecoverable cost
```

三者分开。

---

# 62. Payment Terms 和资金成本

付款条件：

```text
100 percent advance
deposit and balance
net 30
net 60
milestone
letter of credit
```

资金成本可包括：

```text
working capital
financing rate
days sales outstanding
supplier prepayment
inventory holding period
```

输出：

```text
finance_cost
cash_conversion_cycle
```

---

# 63. 客户信用风险

若系统有客户信用数据，可影响：

```text
deposit requirement
credit surcharge
approval
payment terms
```

但不应将敏感信用细节显示在客户报价单中。

---

# 64. 价格保护和材料浮动条款

对长交期或高波动项目，可生成：

```text
fixed price
price valid until date
material escalation formula
FX adjustment formula
requote threshold
```

Agent 只使用已审批模板。

---

# 65. 报价比较

支持比较：

```text
different BOM revisions
different approved alternatives
different manufacturing sites
different packaging plans
different channels
different Incoterms
```

比较结果必须保持其他变量一致，避免误导。

---

# 66. Target Margin Solver

## 66.1 闭式解

当全部售价相关费率为线性比例：

```text
P = (C + fixed_fees) / (1 - variable_fee_rate - target_margin_rate)
```

## 66.2 数值求解

以下情况使用单调数值求解：

```text
minimum/maximum fee
tiered commission
tax-inclusive price
rounding
coupon cap
payment fee cap
```

推荐：

```text
binary search on price in integer minor units
```

验证：

```text
net_margin(price) >= target
price >= floor
```

## 66.3 不可解

若：

```text
variable_fee_rate + target_margin_rate >= 1
```

或约束冲突，输出：

```text
PRICE_EQUATION_INFEASIBLE
```

---

# 67. 单位经济模型

每个数量阶梯输出：

```text
unit revenue
unit material
unit conversion
unit logistics
unit commercial fee
unit allocated fixed cost
unit profit
gross margin
net margin
```

也显示批次总额，避免只看单位数值。

---

# 68. Contribution Margin

贡献毛益用于订单增量判断：

```text
contribution =
revenue
- variable material
- variable manufacturing
- variable logistics
- variable commercial fees
```

它不能替代 Fully Loaded Profit。

战略订单可在贡献为正但 Fully Loaded Margin 较低时进入审批。

---

# 69. Break-even 与产量阶梯

系统对每个 Quote 输出：

```text
break_even_quantity
NRE recovery quantity
cash break-even
fully-loaded break-even
```

若价格随数量变化，使用分段模型。

---

# 70. Margin Waterfall

内部可视化：

```text
售价
- 折扣
- 平台费
- 支付费
- 税费承担
- 材料
- 制造
- 物流
- NRE
- Overhead
- Warranty
- Risk
= 预计利润
```

---

# 71. 报价质量

每个报价输出：

```text
bom_cost_completeness
purchase_plan_freshness
manufacturing_cost_confidence
yield_confidence
fx_freshness
freight_confidence
tax_rule_confidence
fee_profile_completeness
margin_calculation_confidence
overall_quote_confidence
```

---

# 72. 自动批准与强制审核

## 可自动批准

- 所有关键输入完整；
- 市场、FX 和物流数据新鲜；
- 标准客户、标准渠道；
- Margin 高于自动批准阈值；
- 无人工覆盖；
- 无税务和关税冲突；
- 报价金额低于自动阈值。

## 强制审核

- Negative Margin；
- 低于 Price Floor；
- 战略折扣；
- NRE Waiver；
- 长付款账期；
- 税务/关税 Unknown；
- 关键成本为 Estimate；
- Agent 37 高风险；
- EOL/稀缺器件；
- 汇率风险高；
- 报价金额超过阈值；
- 客户特殊条款；
- 人工 Patch。

---

# 73. 报价文档生成

推荐：

```text
Structured Quote JSON
→ HTML Template
→ PDF Renderer
```

PDF 必须从同一结构化数据生成，避免 HTML 和 PDF 数字不一致。

文档保存：

```text
template version
locale
currency format
generated_at
document hash
```

---

# 74. 多语言与本地化

支持：

```text
中文
英文
客户语言模板
```

本地化：

```text
currency
number format
date format
tax terminology
payment terms
Incoterm display
```

翻译不改变金额和计算。

---

# 75. 报价编号

```text
tenant prefix
year
sequence
revision
```

例如：

```text
EETREE-2026-00125-R2
```

编号策略版本化且不可重复。

---

# 76. 客户查看与接受

可生成受控链接：

```text
view quote
download PDF
request revision
accept
reject
```

接受动作保存：

```text
identity
time
IP/device metadata if allowed
accepted quote hash
```

电子签署若需要，应接入专用签名服务，不自行伪造法律签名。

---

# 77. Quote to Order Draft

接受后生成：

```text
sales order draft
commercial terms snapshot
product and quantity
delivery
price
tax mode
NRE
customer reference
```

不得自动确认订单，必须经过订单流程。

---

# 78. 可观测性

Metrics：

```text
costing_jobs_total{status,stage}
costing_duration_seconds{step}
cost_elements_total{category,estimate_status}
cost_input_missing_total{field}
cost_double_count_warnings_total{type}
quote_versions_total{status,channel}
quote_margin_rate{channel,stage}
quote_below_floor_total{reason}
quote_approvals_total{type,status}
quote_scenarios_total{scenario,status}
quote_documents_generated_total{format,status}
quote_sent_total{channel}
quote_accepted_total{channel}
quote_expired_total
quote_fx_stale_total
quote_tax_review_total
quote_recalculation_total{reason}
```

Dashboard：

- 样机/试产/量产平均成本；
- Material/Manufacturing/Logistics 占比；
- Margin Waterfall；
- 按渠道 Margin；
- 报价成功率；
- 折扣和审批；
- Below Floor；
- 成本估算字段；
- FX/Freight Stale；
- NRE 回收；
- Quote-to-Order；
- 实际成本与报价成本偏差。

---

# 79. Benchmark

## 成本

```text
BOM cost accuracy
purchase-plan allocation accuracy
material consumption vs cash separation
yield calculation
NRE allocation
labor/machine cost
overhead double-count detection
landed-cost calculation
```

## 费用

```text
FX conversion accuracy
freight allocation
tax/duty calculation
recoverability classification
platform/payment fee calculation
tiered fee solver
```

## 价格与利润

```text
gross margin accuracy
markup accuracy
net margin accuracy
target-price solver
price-floor enforcement
rounding
discount recalculation
break-even
```

## 文档与流程

```text
customer/internal separation
quote version immutability
approval routing
PDF/JSON consistency
validity calculation
quote acceptance hash
```

---

# 80. 初始质量目标

```text
Decimal Arithmetic Accuracy = 100%
Cost Element Summation Accuracy = 100%
Cash Cost vs Consumed Cost Separation = 100%
Gross Margin Calculation Accuracy = 100%
Markup Calculation Accuracy = 100%
Net Margin Calculation Accuracy = 100%
Linear Target-price Solver Accuracy = 100%
Piecewise Target-price Solver Accuracy >= 99.99%
Tax Pass-through Separation Accuracy = 100%
Contract Price Tenant Isolation = 100%
Customer/Internal Document Separation = 100%
Quote Version Immutability = 100%
High-confidence Auto Approval Accuracy >= 99%
Document Total Consistency = 100%
Evidence Completeness >= 99%
```

这些是目标，不是未经验证的保证。

---

# 81. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## 成本阶段

1. Prototype 1 unit；
2. Prototype 10 units；
3. Pilot；
4. Mass Production；
5. Service Build；
6. NRE Separate；
7. NRE Amortized；
8. NRE Absorbed；
9. Minimum Lot Charge；
10. Multiple Quantity Breaks。

## 材料和采购

11. Exact Consumption；
12. Full Reel Excess；
13. Shared Future Inventory；
14. Project-specific Excess；
15. Writeoff Allocation；
16. Approved Alternative；
17. Stale Offer；
18. EOL Risk；
19. Contract Price；
20. Currency Conversion。

## 制造和良率

21. SMT Fixed + Variable；
22. THT；
23. Manual Assembly；
24. Programming；
25. ICT/FCT；
26. Yield 100%；
27. Multi-stage Yield；
28. Rework；
29. Scrap；
30. Machine Hour；
31. Loaded Labor；
32. Overhead Included；
33. Double-count Warning；
34. Stencil；
35. Tooling。

## 物流、税和费用

36. Freight Fixed；
37. Freight by Weight；
38. Insurance；
39. Duty；
40. Additional Duty；
41. Recoverable VAT；
42. Nonrecoverable Tax；
43. Tax Excluded；
44. Tax Included；
45. Platform Percentage；
46. Platform Fixed；
47. Payment Percentage + Fixed；
48. Fee Minimum；
49. Fee Maximum；
50. Tiered Fee；
51. Payout Fee；
52. Sales Commission；
53. Warranty Reserve；
54. Chargeback Reserve；
55. FX Buffer。

## 定价

56. Cost Plus Markup；
57. Gross Margin Target；
58. Net Margin Target；
59. Linear Fee Solver；
60. Piecewise Solver；
61. Infeasible Target；
62. Price Floor；
63. Strategic Below Cost；
64. Discount；
65. Coupon Cap；
66. Rounding；
67. .99 Ending；
68. Minimum Order Value；
69. Break-even；
70. Contribution Margin。

## Quote Workflow

71. Draft；
72. Internal Review；
73. Margin Approval；
74. Tax Review；
75. Ready to Send；
76. Send；
77. View；
78. Revision；
79. Accepted；
80. Expired；
81. Withdrawn；
82. Rejected；
83. Version Immutability；
84. Patch and Recalculate；
85. Customer/Internal PDF；
86. Multilingual；
87. Terms Template；
88. Quote to Order Draft；
89. Permission Denied；
90. Tenant Isolation。

## Scenario/System

91. Component +25%；
92. FX +5%；
93. Yield -3%；
94. Freight Double；
95. Duty Change；
96. Platform Fee Change；
97. Stale Input；
98. Idempotency；
99. Replay Same Result；
100. Calculation Trace Audit。

---

# 82. 性能要求

单产品 6 个数量阶梯：

```text
缓存输入下成本计算 P95 < 2 s
报价阶梯与 Scenario P95 < 5 s
HTML 生成 P95 < 1 s
PDF 生成 P95 < 5 s
```

大型 BOM：

```text
10,000 unique Parts
```

需要：

- 复用 Agent 38 汇总；
- 成本元素分块；
- 数量阶梯共享固定输入；
- 并行 Scenario；
- PDF 异步渲染；
- 增量重算。

---

# 83. 缓存和增量

缓存键：

```text
bom_revision_hash
+ purchase_plan_version
+ manufacturing_route_version
+ cost_profile_version
+ yield_profile_version
+ fx_snapshot
+ freight_quote_version
+ tax_duty_rule_version
+ commercial_fee_profile_version
+ pricing_policy_version
+ customer_context_hash
+ quantity_breaks
```

更新策略：

- Material Price 变化：重算材料、价格和 Margin；
- FX 变化：重算涉及外币成本；
- Freight 变化：重算物流；
- Tax/Duty 变化：只重算相关规则；
- Platform Fee 变化：重算商业费和目标售价；
- Quantity 变化：重算采购、制造、NRE 摊销和报价；
- BOM Revision 变化：新建 Quote Version；
- 人工 Patch：新建计算版本，不覆盖旧结果。

---

# 84. 安全与权限

- 客户合同价、BOM 成本、Margin 和政策严格租户隔离；
- 客户版绝不包含内部成本；
- Quote Internal View 需要财务/销售管理权限；
- Platform/Payment Credential 不进入计算快照；
- FX、Tax、Freight 来源可审计；
- 报价发送需要显式权限；
- Margin Override、NRE Waiver 和 Below-floor 需要审批；
- 文档下载使用签名 URL；
- PDF 防止注入和远程资源加载；
- HTML Template 变量转义；
- 不执行客户上传文档中的宏或代码；
- 不将私有 BOM、成本和利润发送给外部通用模型；
- V1 不需要 LLM 参与计算；
- 公开测试不使用真实客户、合同价或 Margin；
- 审批和报价版本记录不可删除，只可作废或归档。

---

# 85. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Decimal
```

规则和计算：

```text
Versioned YAML/JSON Rules
Deterministic Calculation Engine
Integer Minor-unit Price Solver
```

文档：

```text
Jinja2 or equivalent HTML templates
WeasyPrint / Playwright PDF / approved renderer
```

任务：

```text
Temporal / Celery / RQ
```

V1 不需要 LLM。

---

# 86. 推荐仓库结构

```text
cost-quote-profit-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── cost-quote-profit-agent-spec.md
│   ├── cost-domain-model.md
│   ├── material-cost-model.md
│   ├── manufacturing-cost-model.md
│   ├── yield-and-rework.md
│   ├── nre-and-overhead.md
│   ├── fx-logistics-tax.md
│   ├── commercial-fee-model.md
│   ├── pricing-and-margin.md
│   ├── quote-workflow.md
│   ├── quote-document-model.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-cost-cash-and-inventory-separated.md
│       ├── 0002-margin-and-markup-separated.md
│       ├── 0003-price-is-contextual.md
│       ├── 0004-customer-and-internal-quotes-separated.md
│       ├── 0005-all-financial-math-uses-decimal.md
│       └── 0006-quote-versions-are-immutable.md
├── src/
│   └── cost_quote_profit/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── cost_element.py
│       │   ├── cost_result.py
│       │   ├── pricing.py
│       │   ├── margin.py
│       │   ├── quote.py
│       │   ├── approval.py
│       │   └── document.py
│       ├── inputs/
│       │   ├── bom.py
│       │   ├── purchase_plan.py
│       │   ├── lifecycle.py
│       │   ├── compliance.py
│       │   ├── market.py
│       │   ├── risk.py
│       │   ├── manufacturing.py
│       │   ├── fx.py
│       │   ├── logistics.py
│       │   └── customer.py
│       ├── costing/
│       │   ├── material.py
│       │   ├── pcb.py
│       │   ├── manufacturing.py
│       │   ├── labor.py
│       │   ├── machine.py
│       │   ├── quality.py
│       │   ├── packaging.py
│       │   ├── yield_model.py
│       │   ├── rework.py
│       │   ├── nre.py
│       │   ├── overhead.py
│       │   ├── warranty.py
│       │   ├── risk_reserve.py
│       │   └── totals.py
│       ├── finance/
│       │   ├── decimal_math.py
│       │   ├── fx.py
│       │   ├── working_capital.py
│       │   └── rounding.py
│       ├── trade/
│       │   ├── logistics.py
│       │   ├── duties.py
│       │   ├── taxes.py
│       │   └── recoverability.py
│       ├── commercial/
│       │   ├── fee_profiles.py
│       │   ├── platform_fees.py
│       │   ├── payment_fees.py
│       │   ├── commissions.py
│       │   ├── discounts.py
│       │   └── warranty.py
│       ├── pricing/
│       │   ├── policies.py
│       │   ├── floors.py
│       │   ├── target_solver.py
│       │   ├── quantity_breaks.py
│       │   ├── contribution.py
│       │   ├── break_even.py
│       │   └── sensitivity.py
│       ├── scenarios/
│       ├── approvals/
│       ├── quotes/
│       │   ├── service.py
│       │   ├── versions.py
│       │   ├── validity.py
│       │   ├── acceptance.py
│       │   └── order_draft.py
│       ├── documents/
│       │   ├── customer.py
│       │   ├── internal.py
│       │   ├── html.py
│       │   ├── pdf.py
│       │   └── templates.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── cost-profiles/
├── fee-profiles/
├── pricing-policies/
├── quote-templates/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_cost_profiles.py
    ├── validate_fee_profiles.py
    ├── replay_costing.py
    ├── compare_quote_versions.py
    ├── run_quote_benchmark.py
    ├── verify_document_totals.py
    └── generate_quote_fixture.py
```


---

# 87. Codex 分阶段实施

不要让 Codex 一次实现全部成本、税费、报价流程和文档。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–38 的真实完成程度和接口；
2. BOM、Revision、Product、Variant 和 Quantity Break；
3. Agent 38 的采购计划、现金支出、消耗成本和剩余库存；
4. PCB、SMT、DIP、组装、测试、编程和包装成本；
5. 工时、人工费率、设备费率和 Overhead；
6. 良率、返工、报废和损耗；
7. NRE、钢网、治具、模具、认证和工程费用；
8. FX、物流、关税、税费和报关成本；
9. 平台、支付、提现、佣金和渠道费用；
10. Warranty、Return、Chargeback 和风险准备；
11. 客户、渠道、币种、Incoterm 和付款条件；
12. 当前报价单、版本、审批、PDF 和订单接口；
13. 当前价格、Margin、Markup 和利润字段是否混用；
14. 当前 Decimal、Round 和 Currency 实现；
15. Tenant、Contract Price、内部成本和客户视图权限；
16. 数据覆盖、Unknown、Stale、Double Count 和历史偏差；
17. 不修改业务代码；
18. 不创建 Migration；
19. 不安装依赖；
20. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Costing Request；
- Cost Element；
- Cost Snapshot；
- Cost Result；
- Commercial Fee；
- Pricing Policy；
- Quantity Break；
- Quote；
- Quote Version；
- Approval；
- Scenario；
- Document；
- Event；
- JSON Schema。

## Phase 2：Upstream Adapter 和 Input Snapshot

实现：

- Agent 31–38 Adapter；
- BOM/Purchase Plan Snapshot；
- Manufacturing Route；
- Cost Profile；
- Customer/Channel Context；
- Version Hash；
- Freshness；
- Idempotency。

## Phase 3：Decimal、Currency 和 Rounding

实现：

- Decimal；
- Minor Unit；
- Currency Precision；
- Round Half Up；
- FX Conversion；
- Rounding Policy；
- Tests；
- 禁止 Float。

## Phase 4：Direct Material Cost

实现：

- Agent 38 Consumed Cost；
- Cash Purchase Cost；
- Inventory Asset；
- Excess Allocation；
- Material Loss；
- BOM Cost；
- Approved Alternative Compare；
- Trace。

## Phase 5：PCB 与制造成本

实现：

- PCB；
- SMT；
- THT；
- Assembly；
- Programming；
- Packaging；
- Fixed/Variable；
- Minimum Lot；
- Rate Card；
- Quote Input。

## Phase 6：Yield、Rework 和 Scrap

实现：

- Multi-stage Yield；
- Required Start Quantity；
- Rework；
- Scrap；
- Optimistic/Base/Pessimistic；
- Profile Version；
- Confidence。

## Phase 7：Labor、Machine 和 Overhead

实现：

- Loaded Labor；
- Setup/Run Time；
- Machine Rate；
- Activity Cost；
- Overhead；
- Double-count Detection；
- Audit。

## Phase 8：NRE、Tooling 和 Certification

实现：

- Separate；
- First Order；
- Forecast Amortization；
- Committed Quantity；
- Seller Absorbed；
- Conditional Credit；
- Recovery Risk。

## Phase 9：FX 和 Working Capital

实现：

- FX Snapshot；
- Buffer；
- Contract/Hedged Rate；
- Payment Terms；
- DSO；
- Supplier Prepayment；
- Finance Cost；
- Stale Rules。

## Phase 10：Logistics、Duty 和 Tax

实现：

- Freight；
- Insurance；
- Brokerage；
- Duty；
- Additional Duty；
- Recoverable/Nonrecoverable Tax；
- Tax Included/Excluded；
- Pass-through；
- Agent 35 Adapter。

## Phase 11：Commercial Fees

实现：

- Platform；
- Payment；
- Fixed/Percentage；
- Minimum/Maximum；
- Tiered；
- Commission；
- Payout；
- Refund/Chargeback Reserve；
- Fee Profile。

## Phase 12：Warranty 和 Risk Reserve

实现：

- Warranty；
- Return；
- Support；
- Risk Buffer；
- Agent 37；
- Price Validity；
- Escalation Clause Hook。

## Phase 13：Cost Hierarchy 和 Quantity Breaks

实现：

- Manufacturing/Landed/Fully Loaded；
- Fixed/Variable；
- Unit and Batch；
- Independent Recalculation per Break；
- Cost Quality；
- Trace。

## Phase 14：Pricing、Margin 和 Floor Solver

实现：

- Markup；
- Gross Margin；
- Net Margin；
- Contribution；
- Price Floor；
- Linear Closed Form；
- Piecewise Binary Search；
- Rounding Recheck；
- Infeasible Detection。

## Phase 15：Scenario 和 Sensitivity

实现：

- Material；
- FX；
- Yield；
- Freight；
- Duty；
- Fee；
- Volume；
- Margin Drivers；
- Break-even；
- NRE Recovery。

## Phase 16：Quote Version 和 Workflow

实现：

- Quote Number；
- Draft；
- Version；
- Revision；
- Validity；
- Approval Routing；
- Withdraw/Expire；
- Acceptance；
- Audit。

## Phase 17：Customer/Internal Documents

实现：

- Structured JSON；
- Customer HTML/PDF；
- Internal HTML/PDF；
- Template Version；
- Locale；
- Total Verification；
- Access Control。

## Phase 18：Send、View 和 Order Draft Hook

实现：

- Send Permission；
- Delivery Event；
- View；
- Revision Request；
- Accept/Reject；
- Order Draft；
- 不自动确认订单、开票或付款。

## Phase 19：API、Events、Batch 和 Cache

实现：

- API；
- Job；
- Progress；
- Batch；
- Retry/Cancel；
- Incremental；
- Events；
- Object Storage；
- Cache；
- Permissions。

## Phase 20：Benchmark、监控和生产发布

实现：

- Benchmark；
- Calculation Golden Tests；
- PDF Total Test；
- Metrics；
- Dashboard；
- Security；
- Feature Flag；
- Policy Rollback；
- Disaster Recovery。

## Phase 21：Actual-vs-Quoted 闭环，可选

稳定后实现：

- Actual Purchase Cost；
- Actual Yield；
- Actual Labor；
- Actual Freight；
- Actual Fees；
- Quote Variance；
- Margin Leakage；
- Profile Calibration；
- Shadow Suggestions；
- 不自动修改正式策略。

---

# 88. Codex 工作纪律

Codex 必须：

1. 成本对象、数量、阶段和版本明确；
2. Cost、Cash Outlay、Inventory Asset 分开；
3. Fixed 和 Variable Cost 分开；
4. Prototype、Pilot、Mass Production 使用不同 Profile；
5. Material Cost 使用 Agent 38 的实际采购和消耗分配；
6. 多买库存不自动全部计入当前订单成本；
7. Project-specific Excess 可按策略回收，但必须显式；
8. Margin 和 Markup 分开；
9. Gross Margin 和 Net Margin 分开；
10. Target Margin 不能用 `cost × (1 + margin)`；
11. 售价比例费用进入反向定价方程；
12. Minimum/Maximum/Tiered Fee 使用分段或数值求解；
13. 所有金额使用 Decimal/Minor Unit，禁止 Float；
14. Round 后重新校验 Floor 和 Margin；
15. FX 必须有来源、时间、币种和 Buffer；
16. Stale FX 不能静默使用；
17. Freight 有路线、重量、时间和有效期；
18. Tax/Duty 有 Jurisdiction、Payer、Recoverability 和 Rule Version；
19. 代收税不能算 Revenue；
20. Recoverable Tax 不得全部算 Cost；
21. Platform、Payment、Payout 和 Commission 分开；
22. Fee Profile 必须按 Channel、Region、Currency 和时间版本化；
23. Tindie、Stripe、Wise 等费用不能硬编码；
24. Yield 必须按工序并可重放；
25. Rework 和 Scrap 分开；
26. Loaded Labor 与 Overhead 防重复；
27. Machine Rate 与 Depreciation 防重复；
28. NRE 处理方式必须显式；
29. Quantity Break 每档独立计算；
30. 报价不能只把大量报价乘折扣系数；
31. Break-even 使用正确 Variable Cost 和 Contribution；
32. Price Floor 可被战略例外覆盖，但必须审批；
33. Unknown 成本不默认为 0；
34. 关键 Estimate 必须显示 Confidence；
35. Customer Quote 与 Internal Quote 完全分离；
36. 客户版不得显示 BOM、供应商合同价、Margin 和审批；
37. Quote Version 不可覆盖；
38. Patch 后必须重算并生成新 Calculation Hash；
39. Quote Validity 取关键输入有效期的约束；
40. 法律条款只使用批准模板；
41. 报价发送需要显式审批和权限；
42. Quote Acceptance 保存版本 Hash；
43. Create Order Draft 不自动确认；
44. V1 不需要 LLM 参与计算；
45. 不将 BOM、合同价、成本、利润发送到外部模型；
46. 公开测试不用真实客户和 Margin；
47. 不伪造税率、运费、FX、Margin、审批或 Benchmark；
48. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Rule/Profile 变化；
    - 测试命令；
    - 真实结果；
    - Calculation Accuracy；
    - Document Consistency；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 89. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/cost-quote-profit-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第39个 Agent：

Costing, Quotation & Profit Intelligence Agent /
成本、报价与利润 Agent。

本 Agent 根据：

- 标准 BOM 和数量阶梯；
- Agent 38 的采购包装计划、采购支出、消耗成本和剩余库存；
- PCB、SMT、DIP、组装、测试、编程和包装成本；
- Prototype、Pilot、Mass Production 阶段；
- 材料损耗、工序良率、返工和报废；
- 工时、人工、设备和 Overhead；
- NRE、工程、钢网、治具、模具和认证；
- 汇率、运费、保险、仓储和报关；
- Agent 35 的关税、税费和原产地上下文；
- 平台费、支付费、提现费、佣金和渠道费；
- Warranty、Return 和 Risk Reserve；
- 目标 Margin/Markup、折扣、付款条件和报价有效期；

生成：

- 成本明细；
- 样机、试产和量产成本；
- 多数量阶梯；
- Price Floor；
- Target Price；
- Margin/Markup/Net Profit；
- Scenario 和 Sensitivity；
- 客户版和内部版报价单；
- 报价审批和版本；
- Quote-to-Order Draft Hook。

本 Agent 不自动签合同、不自动确认订单、不自动开票或收款。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–38 的规格和实际代码；
3. docs/cost-quote-profit-agent-spec.md；
4. 当前 Product、BOM、Revision、Variant 和 Quantity Break；
5. 当前 Agent 38 Purchase Plan、Cash Outlay、Consumed Cost、Excess Inventory；
6. 当前 PCB、SMT、DIP、Assembly、Test、Programming 和 Packaging Cost；
7. 当前 Labor Rate、Machine Rate、Overhead 和 Manufacturing Route；
8. 当前 Yield、Rework、Scrap、Loss 和 Actual Production History；
9. 当前 NRE、Engineering、Stencil、Fixture、Mold 和 Certification；
10. 当前 FX、Freight、Insurance、Brokerage、Duty 和 Tax；
11. 当前 Platform Fee、Payment Fee、Payout Fee、Commission、Discount；
12. 当前 Warranty、Return、Chargeback 和 Risk Reserve；
13. 当前 Customer、Channel、Currency、Incoterm、Payment Terms 和 Credit；
14. 当前 Quote、Version、Approval、PDF、Send、Acceptance 和 Order Draft；
15. 当前 Decimal、Currency、Rounding、Template、Permissions、Audit；
16. 当前 Cache、Queue、Object Storage、Docker、CI 和 Tests；
17. 脱敏、合成或授权 Fixture。

硬约束：

- Cost、Cash Outlay 和 Inventory Asset 分开；
- Fixed 和 Variable Cost 分开；
- Prototype、Pilot、Mass Production 使用独立 Profile；
- Agent 38 的多余采购库存不自动全部计入当前订单；
- Project-specific Excess 若回收必须显式；
- Material、Manufacturing、Landed、Fully Loaded、Commercial Cost 分层；
- Margin、Markup、Gross Margin、Net Margin 分开；
- 目标毛利率不能用 Cost × (1 + Margin)；
- 售价相关费率必须进入反向定价方程；
- Minimum/Maximum/Tiered Fee 使用分段规则或数值求解；
- 所有财务计算使用 Decimal 或 Minor Units，禁止 Float；
- Round 后重新校验 Margin 和 Floor；
- FX 有来源、时间、币种和 Buffer；
- Stale FX 必须标记；
- Freight 有路线、服务、有效期和分摊方式；
- Tax/Duty 有 Jurisdiction、Payer、Recoverability、Included/Excluded 和 Rule Version；
- Pass-through Tax 不算 Revenue；
- Recoverable Tax 不全部算 Cost；
- Platform/Payment/Payout/Commission 分开；
- Fee Profile 按 Channel、Region、Currency 和时间版本化；
- 不硬编码 Tindie、Stripe、Wise 等费用；
- Yield 按工序；
- Rework 和 Scrap 分开；
- Loaded Labor、Machine Rate 和 Overhead 防重复；
- NRE 处理方式显式；
- 每个 Quantity Break 独立重算；
- 不用统一折扣比例生成阶梯报价；
- Unknown Cost 不默认为 0；
- Estimate 显示 Confidence；
- Customer/Internal Quote 完全分离；
- 客户版不显示 BOM、合同价、Margin、Risk 和 Approval；
- Quote Version 不可覆盖；
- Patch 后重算；
- Quote Validity 绑定输入有效期；
- 法律条款只用批准模板；
- Quote Send 需要权限和最终审批；
- Acceptance 保存 Quote Hash；
- Create Order Draft 不自动确认订单；
- V1 不需要 LLM；
- 不将 BOM、合同价、成本和利润发给外部模型；
- 不把真实客户数据和 Margin 放入公开测试；
- 不伪造汇率、税率、运费、利润、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–38 的真实完成程度和接口；
3. 查找 Product、BOM、Revision、Variant、Quantity Break；
4. 查找 Agent 38 的 Purchase Plan、Consumed Cost、Cash Cost、Excess；
5. 查找 PCB、SMT、DIP、Assembly、Test、Programming 和 Packaging Cost；
6. 查找 Labor、Machine、Overhead、Route 和 Cost Profile；
7. 查找 Yield、Rework、Scrap、Loss 和历史实际数据；
8. 查找 NRE、Engineering、Stencil、Fixture、Mold、Certification；
9. 查找 FX、Freight、Insurance、Brokerage、Duty、Tax；
10. 查找 Platform、Payment、Payout、Commission、Discount 和 Warranty；
11. 查找 Margin、Markup、Profit、Price Floor 和 Break-even 字段；
12. 查找 Customer、Channel、Incoterm、Payment Terms 和 Quote Validity；
13. 查找 Quote、Version、Approval、PDF、Send、Acceptance、Order Draft；
14. 查找 Decimal、Rounding 和 Currency 实现；
15. 查找 Tenant、Internal/Customer View 和权限；
16. 查找 Double Count、Unknown、Stale 和历史偏差；
17. 抽样分析脱敏或合成报价数据；
18. 在 docs/cost-quote-profit-implementation-plan.md 中生成实施计划；
19. 在 docs/cost-quote-profit-domain-model.md 中定义 Domain Model；
20. 在 docs/material-manufacturing-cost-model.md 中定义材料和制造成本；
21. 在 docs/yield-rework-cost-model.md 中定义良率和返工；
22. 在 docs/nre-overhead-cost-model.md 中定义 NRE 和 Overhead；
23. 在 docs/fx-logistics-tax-cost-model.md 中定义 FX、物流、税和关税；
24. 在 docs/commercial-fee-model.md 中定义平台、支付和佣金；
25. 在 docs/pricing-margin-solver.md 中定义 Margin、Markup、Floor 和求解器；
26. 在 docs/quote-workflow-and-versioning.md 中定义报价流程和版本；
27. 在 docs/quote-document-design.md 中定义客户版和内部版；
28. 在 docs/cost-quote-migration-plan.md 中定义旧字段迁移；
29. 在 docs/cost-quote-benchmark-plan.md 中定义 Benchmark；
30. 给出拟新增、拟修改和拟复用文件；
31. 给出 Phase 1 精确范围；
32. 不修改业务代码；
33. 不创建数据库 Migration；
34. 不安装依赖；
35. 不读取或打印生产 Secret；
36. 运行当前仓库已有 lint、type check、test、build、security scan；
37. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–38 输入契约；
- 当前 Cost/Quote 数据模型；
- Material/Manufacturing Cost；
- Yield/Rework；
- Labor/Machine/Overhead；
- NRE；
- FX/Logistics/Tax/Duty；
- Commercial Fee；
- Warranty/Risk；
- Cost Hierarchy；
- Margin/Markup/Profit；
- Target Price Solver；
- Quantity Break；
- Break-even；
- Scenario/Sensitivity；
- Quote Workflow/Version；
- Customer/Internal Document；
- Approval；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 90. 后续 Phase 提示词模板

```text
继续实现 Cost, Quote & Profit Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–39 规格；
3. 阅读 Cost Quote Implementation Plan；
4. 阅读 Cost、Yield、NRE、FX/Tax、Fee、Pricing、Quote、Document 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Cost/Cash/Inventory 分离；
- Fixed/Variable 分离；
- Decimal；
- Margin/Markup 分离；
- Target-price Equation；
- Tax Recoverability；
- Fee Version；
- Customer/Internal Separation；
- Quote Version Immutability；
- Evidence/Trace；
- Approval；
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
9. calculation property test；
10. security test；
11. document total consistency test；
12. performance test；
13. benchmark；
14. 更新文档；
15. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Rule/Profile 变化；
- 测试命令和真实结果；
- Cost Accuracy；
- Pricing Solver Accuracy；
- Quote Document Consistency；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 91. MVP 演示流程

1. 输入一个已标准化产品 BOM；
2. 选择数量 10、100、500、1000；
3. 选择 Prototype、Pilot、Mass Production；
4. Agent 38 返回各数量下采购包装和材料成本；
5. 区分采购现金支出和本批消耗成本；
6. 将项目专用 Excess 单列；
7. 加载 PCB 报价；
8. 加载 SMT Setup、Placement、Stencil；
9. 加载 Assembly、Programming 和 FCT；
10. 计算多工序良率；
11. 计算需要投产数量；
12. 加载 Labor、Machine 和 Overhead；
13. 检测 Loaded Labor 与 Overhead 是否重复；
14. 加载 NRE 和治具；
15. Prototype 将 NRE 单列；
16. Mass Production 按承诺量摊销；
17. 加载 FX Snapshot 和 Buffer；
18. 加载 Freight 和 Insurance；
19. 加载 Agent 35 Duty/Tax；
20. 区分可抵扣和不可抵扣税；
21. 选择 Direct B2B Fee Profile；
22. 选择 Tindie Channel Fee Profile 做对比；
23. 输入目标净利润率 20%；
24. 使用反向方程求建议售价；
25. 平台费有最低收费时改用数值求解；
26. Round 到两位小数后重新校验 Margin；
27. 生成 10/100/500/1000 的独立阶梯；
28. 执行材料 +25%、FX +5%、良率 -3% Scenario；
29. 显示 Margin Waterfall；
30. 发现 10 台 Prototype 低于最小工程收费，加入 Minimum Charge；
31. 生成 Internal Quote；
32. 生成 Customer Quote；
33. 验证两个文档总额一致；
34. 客户版不显示成本和利润；
35. 500 台档 Margin 低于自动门槛；
36. 创建 Margin Approval；
37. 财务降低 NRE Waiver；
38. 生成 Quote Version 2；
39. Version 1 保持不可变；
40. 显式发送报价；
41. 客户接受；
42. 生成 Sales Order Draft；
43. 不自动确认订单；
44. 发布 `quote.accepted`。

---

# 92. 生产上线顺序

第一阶段：

```text
Material Cost
Manufacturing Cost
Yield
NRE
Decimal
Markup/Margin
Target Price
Quantity Break
Internal Quote
Customer Quote
审批
```

第二阶段：

```text
FX
Freight
Duty/Tax
Platform/Payment Fee
Scenario
PDF
Send/View/Accept
Order Draft
```

第三阶段：

```text
Working Capital
复杂税费
Tiered Fee
多渠道比较
Actual-vs-Quoted
成本校准
项目生命周期利润
```

上线优先确保：

```text
采购现金支出和本批消耗成本不混
毛利率和加价率不混
平台费和支付费不漏
税费承担和可抵扣性明确
每个数量阶梯独立重算
客户看不到内部利润
```

宁可将某项运费或税费标为“待确认”，也不能默认为零，然后生成一份利润漂亮得像童话的报价单。
