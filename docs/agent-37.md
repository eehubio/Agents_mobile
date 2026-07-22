# BOM 风险与多源供应 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：37  
> Agent 名称：BOM Supply Risk & Multi-Sourcing Intelligence Agent  
> 中文名称：BOM 风险与多源供应 Agent  
> 版本：V1.0  
>
> 定位：对 BOM 中每一行、每个 BOM Revision、每个产品和企业物料组合，评估单一来源、库存深度、价格波动、交期风险、制造商集中度、制造地点集中度、区域与路线风险，并生成可解释、可审核的缓解方案。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规与原产地
> - Agent 36：实时价格与库存
> - ezPLM 项目、BOM、库存、采购、生产、需求预测和供应商绩效
>
> 下游：
> - BOM 成本与采购决策
> - AVL 与第二来源认证
> - 安全库存和采购计划
> - 缺料与交期预警
> - NPI/量产风险门禁
> - ECR/ECN、LTB 和产品改版
>
> 边界：
> - 本 Agent 不自动批准替代、不自动下单、不自动修改 BOM。
> - 所有风险结论必须绑定 BOM Revision、产品阶段、需求窗口、市场数据时间和策略版本。
> - “多家分销商有货”不等于真正多源。

---

# 1. 建设目标

系统必须能够：

1. 对每个 BOM Line 生成风险评估；
2. 对 BOM、产品、产品族和企业组合生成聚合风险；
3. 区分渠道多源、制造商多源、技术多源和制造地点多源；
4. 识别单一制造商、单一授权渠道、单一封装和单一工厂依赖；
5. 识别多个分销商实际共享同一制造商或同一生产地点；
6. 识别未验证、仅原型验证或已量产批准的替代料；
7. 使用 Agent 36 的价格、库存、包装、交期和新鲜度；
8. 使用历史价格/库存/交期序列评估波动；
9. 结合预测、BOM 用量、库存和在途计算库存深度；
10. 计算制造商、供应商、仓库、地区和路线集中度；
11. 融合生命周期、PCN、合规、原产地和关税风险；
12. 结合产品阶段、功能关键度和重新设计难度；
13. 支持 30/90/180/365 天风险窗口；
14. 支持需求增长、渠道中断、制造商中断、区域中断和价格冲击 Scenario；
15. 输出风险原因、证据、置信度、缓解动作和负责人；
16. 支持人工审核、风险接受、Waiver 和 Patch；
17. 支持增量重算和百万级 BOM Line。

---

# 2. Agent 边界

## Agent 31

负责：

```text
原始 BOM
→ 标准 BOM Schema
→ 行号、数量、原始字段和证据
```

## Agent 32

负责：

```text
BOM Line
→ 标准 Part / Package Variant / Ordering Variant
```

未精确解析的行必须输出：

```text
identity_risk = high_or_unknown
resolution_required = true
```

## Agent 33

提供：

```text
replacement_level
validation_scope
approval_status
FFF risk
```

未验证候选不能计入有效第二来源。

## Agent 34

提供：

```text
Active / NRND / EOL / Obsolete
PCN
LTB/LTS
厂商并购和料号变化
```

## Agent 35

提供：

```text
合规状态
客户限制
原产地事实
制造路线
关税和贸易约束
```

## Agent 36

提供：

```text
Authorized Offer
Inventory Pool
Available/Expected Stock
Price Tier
Packaging
Lead Time
Freshness
```

Agent 37 不能使用无时间戳市场数据。

---

# 3. 核心原则

## 3.1 多渠道不等于真正多源

必须区分：

```text
Channel Multi-sourcing
Manufacturer Multi-sourcing
Technical Multi-sourcing
Manufacturing-site Multi-sourcing
Regional Multi-sourcing
```

## 3.2 不同包装不等于设计多源

Cut Tape、Reel、Tray、Tube 可改善采购灵活性，但不降低设计单一来源风险。

## 3.3 未批准替代不计为有效来源

候选状态：

```text
discovered
technically_screened
engineering_reviewed
prototype_validated
pilot_validated
mass_production_approved
customer_approved
```

## 3.4 风险与需求和时间相关

同一颗器件在 100 件/月和 100,000 件/月下风险完全不同。

## 3.5 Unknown 不是 Low Risk

地点、交期或历史数据缺失时必须提高数据质量风险。

## 3.6 技术与商业风险分开

库存多不能消除技术单一来源；有替代也不能保证当前可采购。

## 3.7 Hard Trigger 优先

EOL 无替代、库存覆盖低于有效交期、唯一工厂中断等情况不得被平均成中风险。

## 3.8 Line、BOM、Product、Portfolio 分开

```text
BOM Line
→ Functional Group
→ BOM Revision
→ Product
→ Product Family
→ Tenant Portfolio
```

---

# 4. 多源供应层级

```text
S0  无有效来源
S1  单渠道、单制造商
S2  多渠道、单制造商
S3  同器件多包装/订货型号
S4  同制造商已验证替代
S5  不同制造商已验证替代
S6  不同制造商且关键制造地点独立
```

每个 BOM Line 保存：

```text
current_source_level
target_source_level
validation_scope
evidence
```

---

# 5. 风险维度

```text
identity_risk
source_count_risk
technical_alternative_risk
channel_concentration_risk
manufacturer_concentration_risk
manufacturing_site_risk
regional_risk
inventory_depth_risk
stock_concentration_risk
lead_time_risk
lead_time_volatility_risk
price_level_risk
price_volatility_risk
lifecycle_risk
pcn_change_risk
compliance_risk
origin_trade_risk
supplier_performance_risk
demand_uncertainty_risk
design_criticality_risk
switching_cost_risk
data_quality_risk
```

---

# 6. 标准请求

```json
{
  "risk_request_id": "uuid",
  "subject": {
    "subject_type": "bom",
    "bom_id": "uuid",
    "bom_revision": "RevC",
    "product_id": "uuid",
    "product_phase": "mass_production"
  },
  "demand_context": {
    "forecast_version": "2026-Q3-v4",
    "horizons_days": [30, 90, 180, 365],
    "build_quantity": 5000,
    "service_years": 5,
    "scenario_ids": [
      "base",
      "demand_plus_30",
      "primary_region_disruption"
    ]
  },
  "market_context": {
    "destination_country": "US",
    "currency": "USD",
    "authorized_source_mode": "authorized_only",
    "market_data_max_age_seconds": 3600
  },
  "policy_context": {
    "tenant_id": "uuid",
    "risk_policy_version": "bom-risk-1.0.0",
    "criticality_profile": "industrial-controller-v2"
  }
}
```

---

# 7. 标准结果

```json
{
  "risk_result_id": "uuid",
  "bom_id": "uuid",
  "bom_revision": "RevC",
  "overall": {
    "risk_level": "high",
    "risk_score": 78,
    "confidence": 0.91,
    "hard_triggers": [
      "eol_without_verified_alternative",
      "inventory_coverage_below_lead_time"
    ],
    "review_required": true
  },
  "summary": {
    "lines": 385,
    "critical_lines": 8,
    "high_risk_lines": 31,
    "single_manufacturer_lines": 112,
    "no_verified_alternative_lines": 76,
    "stockout_horizon_90d_lines": 14
  },
  "line_results_uri": "s3://.../line-results.json.zst",
  "concentration_report_uri": "s3://.../concentration.json",
  "scenario_report_uri": "s3://.../scenarios.json",
  "mitigation_plan_uri": "s3://.../mitigation-plan.json"
}
```

---

# 8. BOM Line 结果

```json
{
  "bom_line_id": "uuid",
  "part_id": "uuid",
  "manufacturer_part_number": "TPS62160DSGR",
  "quantity_per_assembly": 1,
  "criticality": {
    "functional_role": "main_power_converter",
    "criticality_level": "critical",
    "redesign_effort": "high"
  },
  "source_diversity": {
    "level": "S2",
    "authorized_channels": 4,
    "distinct_manufacturers": 1,
    "verified_alternatives": 0,
    "independent_site_groups": 1
  },
  "inventory": {
    "usable_available_quantity": 12000,
    "demand_90d": 15000,
    "coverage_days": 72,
    "coverage_ratio": 0.8,
    "stock_concentration_hhi": 0.61
  },
  "lead_time": {
    "current_days": 84,
    "historical_median_days": 56,
    "p90_days": 98,
    "trend": "worsening"
  },
  "price": {
    "normalized_quantity": 5000,
    "current_unit_price": "1.42",
    "median_180d": "1.11",
    "volatility_180d": 0.22
  },
  "overall": {
    "risk_level": "critical",
    "score": 92,
    "hard_triggers": [
      "critical_function_single_manufacturer"
    ]
  }
}
```

---

# 9. 数据快照

每次评估保存：

```text
BOM Revision Snapshot
Part Resolution Snapshot
Alternative Relationship Snapshot
Lifecycle Snapshot
Compliance Snapshot
Market Offer Snapshot
Internal Inventory Snapshot
Open PO Snapshot
Forecast Snapshot
Supplier Performance Snapshot
Regional Risk Snapshot
Policy Versions
```

市场数据过期时：

```text
assessment_status = stale_input
```

---

# 10. 器件关键等级

```text
critical
high
medium
low
noncritical
unknown
```

输入：

```text
functional role
single point of failure
safety impact
regulatory impact
power tree dependency
boot dependency
repairability
redesign effort
firmware coupling
customer approval requirement
```

---

# 11. 功能组风险

功能组示例：

```text
power_tree
clock_tree
memory_subsystem
wireless_subsystem
safety_chain
connector_set
capacitor_class
resistor_class
mechanical_interface
```

即使单颗去耦电容风险低，全部电容集中于同一制造商和地区仍可能形成组合风险。


---

# 12. 单一来源评估

分别计算：

```text
authorized_channel_count
active_distributor_sku_count
distinct_manufacturer_count
qualified_alternative_count
mass_production_approved_alternative_count
independent_fab_group_count
independent_assembly_group_count
independent_region_count
```

有效来源必须满足：

```text
identity exact
lifecycle acceptable
compliance acceptable
packaging acceptable
authorized source policy pass
market data fresh enough
quantity feasible
```

未验证候选可按策略折算：

```text
mass_production_approved = 1.00
pilot_validated = 0.80
prototype_validated = 0.50
engineering_reviewed = 0.25
technically_screened = 0.10
discovered = 0.00
```

原始来源数量和折算值都要保存。

---

# 13. 库存深度

```text
usable_supply =
  authorized_available_now
  + qualified_internal_inventory
  + confirmed_open_po
  + qualified_in_transit
```

默认不包括：

```text
expected_stock
marketplace_unknown
unconfirmed_po
quarantine
expired
allocated_to_other_product
customer-incompatible_lot
```

需求：

```text
demand_horizon =
  assembly_forecast × quantity_per_assembly
  + service_demand
  + yield_loss
  + safety_stock
```

指标：

```text
coverage_ratio = usable_supply / demand_horizon
coverage_days = usable_supply / average_daily_demand
coverage_until_replenishment =
  usable_supply - demand_during_effective_lead_time
```

多窗口：

```text
30d
90d
180d
365d
```

---

# 14. 库存集中度

库存充足也可能集中在单一渠道或仓库。

计算：

```text
provider concentration
warehouse concentration
region concentration
inventory pool concentration
account concentration
```

使用：

```text
HHI = sum(share_i^2)
```

同时输出：

```text
top1_share
top3_share
source_count
```

---

# 15. 价格波动

只能比较相同上下文：

```text
same Part/Ordering Variant
same Packaging
same Provider/Account Class
same Region/Store
same Currency or normalized FX
same normalized quantity
same price type
```

指标：

```text
current_vs_median
coefficient_of_variation
median_absolute_deviation
max_price_jump
drawup
trend_slope
frequency_of_change
provider_spread
```

区分：

```text
native_price_change
fx_effect
packaging_change
quantity_break_change
provider/account_change
true_market_change
```

历史样本不足：

```text
price_volatility = unknown
data_quality_risk = elevated
```

---

# 16. 交期风险

交期类型：

```text
warehouse_ship_lead_time
supplier_confirmed_lead_time
manufacturer_lead_time
historical_actual_lead_time
expected_stock_date
special_order_lead_time
```

指标：

```text
current lead time
historical median
p75/p90/p95
MAD/standard deviation
trend
late delivery rate
supplier confirmation variance
expected-stock reliability
```

有效交期可按策略定义：

```text
effective_lead_time =
  max(
    current provider lead time,
    supplier historical p90,
    internal procurement cycle
  )
```

触发：

```text
lead_time_spike
lead_time_above_policy
lead_time_longer_than_stock_coverage
expected_stock_repeatedly_delayed
supplier_confirmation_unreliable
```

---

# 17. 制造商集中度

按以下口径分别计算：

```text
line count
annual spend
quantity
criticality-weighted exposure
replacement difficulty
```

输出：

```text
spend_hhi
criticality_hhi
line_count_hhi
top1_share
top3_share
```

利用 Agent 34 Manufacturer Relationship Graph 分析：

```text
brand concentration
legal entity concentration
ultimate parent concentration
product-line concentration
```

品牌不同但母公司相同，不能当成完全独立。

---

# 18. 制造地点与工艺集中度

来源：

```text
Agent 35 Origin Facts
Agent 34 PCN Site Changes
Manufacturer Declarations
Supplier Site Data
```

维度：

```text
wafer fab
package assembly
final test
module assembly
PCBA assembly
warehouse
```

如果两个制造商依赖同一 Foundry 或封装厂：

```text
apparent_multi_source = true
independent_site_source = false
```

地点未知时不得自动判定独立。

---

# 19. 区域风险

区域风险 Observation 必须版本化并有来源：

```text
country/subnational region
risk type
severity
published_at
effective_from
expected_end
source
confidence
version
```

风险类型：

```text
natural hazard
port/logistics disruption
trade restriction
sanction/export control
tariff volatility
power/water stress
labor disruption
political instability
public health disruption
```

映射到：

```text
manufacturing site
warehouse
shipping route
customs route
supplier entity
```

不能因一个区域事件自动影响整个国家全部器件。

---

# 20. 路线集中度

供应商不同，但可能共享：

```text
port
airport
carrier
customs gateway
distribution center
```

保存 Route：

```text
origin site
export gateway
carrier
import gateway
destination warehouse
```

计算：

```text
route_hhi
single_gateway_risk
single_carrier_risk
```

V1 可先做到国家/仓库级。

---

# 21. 生命周期与 PCN 风险

消费 Agent 34：

```text
status
LTB/LTS
PCN category
manufacturer acquisition
part rename
source conflict
freshness
```

Hard Trigger：

```text
obsolete_without_inventory
eol_without_verified_alternative
ltb_deadline_inside_procurement_cycle
critical_pcn_without_review
```

NRND 提高中长期风险，但不等于当前断供。

---

# 22. 合规、原产地和贸易风险

消费 Agent 35：

```text
regulatory status
customer block
evidence expiry
origin facts
tariff measures
trade restrictions
```

风险：

```text
only_alternative_blocked_by_customer
coo_unknown_for_import
additional_duty_exposure
single_origin_country
compliance_evidence_expiring
```

---

# 23. 供应商绩效

企业内部指标：

```text
on-time delivery
quality acceptance
cancellation rate
confirmation accuracy
response time
return rate
claim rate
allocation reliability
```

市场 API 的库存不能替代真实履约表现。

---

# 24. 需求不确定性

输入：

```text
forecast error
demand coefficient of variation
seasonality
new product uncertainty
project spike
customer concentration
```

高需求不确定性与长交期、低库存结合时放大短缺风险。

---

# 25. Switching Cost / Redesign Risk

替代复杂度：

```text
same ordering variant
same part different packaging
pin-compatible verified
pin-compatible conditional
firmware change
passive network change
PCB change
mechanical change
certification change
customer reapproval
```

输出：

```text
switching_time_range
engineering_effort
validation_cost_range
approval_dependency
```

数据不足时输出范围，不伪造精确值。

---

# 26. 风险评分框架

推荐：

```text
Hard Triggers
→ Dimension Classification
→ Criticality Adjustment
→ Time-horizon Adjustment
→ Confidence Adjustment
→ Overall Risk Class
```

每个维度输出：

```text
score 0–100
level
confidence
reason_codes
evidence
```

总体可采用：

```text
base = weighted_percentile(dimension_scores)
overall = max(base, hard_trigger_floor)
```

示例：

```text
critical hard trigger floor = 90
high hard trigger floor = 75
```

关键维度 Unknown 时：

```text
confidence ↓
data_quality_risk ↑
auto_publish disabled
```

---

# 27. 风险等级

```text
critical
high
medium
low
informational
unknown
```

Critical 典型条件：

- 近期缺料且补货交期更长；
- EOL 无替代；
- 关键功能单一制造商且无库存缓冲；
- 区域事件命中唯一工厂；
- 客户或合规阻止唯一替代。

---

# 28. Hard Trigger Registry

```yaml
trigger_id: eol-without-verified-alternative
conditions:
  lifecycle_status:
    in: [eol_announced, last_time_buy, discontinued, obsolete]
  verified_alternative_count:
    equals: 0
severity: critical
score_floor: 92
actions:
  - evaluate_alternative
  - calculate_ltb
  - block_new_design
```

其他 Trigger：

```text
inventory_coverage_below_lead_time
critical_function_single_manufacturer
no_authorized_source
only_source_non_compliant
only_source_marketplace
ltb_deadline_inside_order_cycle
regional_event_hits_only_site
supplier_failure_rate_above_limit
price_jump_above_limit
forecast_growth_exceeds_supply
```

DSL 禁止任意代码。

---

# 29. Scenario 分析

支持：

```text
base
demand_plus_20
demand_plus_50
primary_distributor_unavailable
primary_manufacturer_disruption
primary_region_disruption
lead_time_double
price_plus_30
eol_announced
alternative_validation_delayed
```

输出：

```text
stockout_date
affected_products
additional_spend
lines_crossing_threshold
required_mitigation
recovery_time
```

Scenario 必须作用于正确层级：

```text
channel
manufacturer
site
region
route
part
```

---

# 30. BOM 聚合风险

不能平均全部 Line。

输出：

```text
critical_line_count
high_line_count
criticality_weighted_exposure
maximum_line_risk
top_risk_contributors
risk_adjusted_buildability
manufacturer_concentration
regional_concentration
unresolved_identity_count
unverified_alternative_count
```

一个 Critical Line 可阻断整机生产，因此 Buildability 使用瓶颈逻辑。

财务风险另行输出，避免把“能不能生产”和“会不会涨价”混成一个数。

---

# 31. Portfolio 风险

企业级分析：

```text
common part exposure
common manufacturer exposure
common fab/site exposure
common region exposure
common distributor exposure
shared critical components
```

同一 MPN 出现在多个产品时，应按影响产品数、收入、客户和售后责任放大优先级。

---

# 32. 缓解建议

工程：

```text
qualify_second_manufacturer
validate_pin_compatible_alternative
create_dual_footprint
redesign_for_generic_package
reduce_firmware_coupling
modularize_high_risk_function
```

采购：

```text
add_authorized_distributor
negotiate_supply_agreement
reserve_inventory
increase_safety_stock
split_purchase_allocation
lock_price
request_lead_time_commitment
```

质量与供应链：

```text
approve_second_source
audit_manufacturing_site
diversify_region
diversify_warehouse
change_shipping_route
add_local_buffer
secure_ltb
```

产品：

```text
block_new_design
schedule_bom_revision
notify_customer
update_service_stock
sunset_product
```

每项建议保存：

```text
risk_reduction
effort
lead_time
cost_impact
owner
dependency
due_date
confidence
```

---

# 33. 风险接受

状态：

```text
accepted
accepted_with_conditions
mitigation_in_progress
not_accepted
expired
```

保存：

```text
scope
bom revision
part
risk dimension
reason
conditions
owner
approver
valid_from
valid_to
review_date
```

不得建立永久全局忽略。

---

# 34. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "bom_line_risk",
  "target_id": "uuid",
  "base_version": "machine-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/criticality/criticality_level",
      "old_value": "medium",
      "value": "critical"
    }
  ],
  "reason_code": "engineering_review",
  "reviewer_id": "uuid",
  "evidence_ids": []
}
```

机器原始 Feature 和 Score 不可覆盖。

---

# 35. 审核工作台

```text
左侧：BOM 树、功能组和风险筛选
中间：Line 风险、趋势、供应图和场景
右侧：原因、证据、替代和缓解建议
底部：价格、库存、交期、区域和计算 Trace
```

视图：

```text
Overview
Line Risk
Source Diversity
Inventory Coverage
Price
Lead Time
Manufacturers
Sites & Regions
Lifecycle
Compliance
Scenarios
Mitigation
Evidence
```

操作：

- 修改 Criticality；
- 确认有效来源；
- 排除无效 Offer；
- 确认替代验证范围；
- 调整 Scenario；
- 创建缓解任务；
- 接受风险；
- 请求 Agent 36 刷新；
- 请求 Agent 33 评估；
- 创建 ECN/ECR。

---

# 36. 推荐可视化

```text
BOM Heatmap
Source Graph
Manufacturer Treemap
Region Exposure Map
Inventory Coverage Timeline
Price/Lead-time Trend
Scenario Waterfall
Mitigation Kanban
```

UI 不应只显示一个红色分数。


---

# 37. API 设计

## 创建评估

```text
POST /api/v1/bom-risk/assessments
POST /api/v1/bom-risk/batches
```

## 读取

```text
GET /api/v1/bom-risk/assessments/{id}
GET /api/v1/bom-risk/assessments/{id}/lines
GET /api/v1/bom-risk/assessments/{id}/summary
GET /api/v1/bom-risk/assessments/{id}/concentration
GET /api/v1/bom-risk/assessments/{id}/scenarios
GET /api/v1/bom-risk/assessments/{id}/mitigations
GET /api/v1/bom-risk/parts/{part_id}/exposure
GET /api/v1/bom-risk/products/{product_id}
GET /api/v1/bom-risk/portfolio
GET /health/live
GET /health/ready
GET /metrics
```

## 操作

```text
POST /api/v1/bom-risk/assessments/{id}/rerun
POST /api/v1/bom-risk/assessments/{id}/cancel
POST /api/v1/bom-risk/assessments/{id}/scenarios
POST /api/v1/bom-risk/mitigations
POST /api/v1/bom-risk/mitigations/{id}/approve
POST /api/v1/bom-risk/reviews/{id}/resolve
POST /api/v1/bom-risk/acceptances
```

---

# 38. 状态机

```text
RECEIVED
→ LOADING_BOM
→ VALIDATING_LINE_IDENTITIES
→ LOADING_DEMAND_CONTEXT
→ LOADING_ALTERNATIVES
→ LOADING_LIFECYCLE
→ LOADING_COMPLIANCE
→ LOADING_MARKET_OFFERS
→ LOADING_INTERNAL_INVENTORY
→ LOADING_OPEN_ORDERS
→ LOADING_SUPPLIER_PERFORMANCE
→ LOADING_SITE_AND_REGION_FACTS
→ BUILDING_SOURCE_GRAPH
→ CALCULATING_LINE_FEATURES
→ APPLYING_HARD_TRIGGERS
→ SCORING_DIMENSIONS
→ CALCULATING_CONCENTRATION
→ RUNNING_SCENARIOS
→ AGGREGATING_BOM_RISK
→ AGGREGATING_PORTFOLIO_EXPOSURE
→ GENERATING_MITIGATIONS
→ CREATING_REVIEWS
→ STORING_RESULTS
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_STALE_INPUTS
REVIEW_REQUIRED
IDENTITY_INCOMPLETE
MARKET_DATA_INCOMPLETE
DEMAND_CONTEXT_INCOMPLETE
REGION_DATA_INCOMPLETE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 39. 错误码

```text
BOM_NOT_FOUND
BOM_REVISION_NOT_FOUND
BOM_LINE_UNRESOLVED
PART_IDENTITY_AMBIGUOUS
DEMAND_CONTEXT_MISSING
FORECAST_VERSION_MISSING
PRODUCT_PHASE_MISSING
MARKET_DATA_MISSING
MARKET_DATA_STALE
INTERNAL_INVENTORY_MISSING
OPEN_PO_DATA_MISSING
ALTERNATIVE_DATA_MISSING
LIFECYCLE_DATA_MISSING
COMPLIANCE_DATA_MISSING
SITE_DATA_MISSING
REGIONAL_RISK_FEED_MISSING
SUPPLIER_PERFORMANCE_MISSING
PRICE_HISTORY_INSUFFICIENT
LEAD_TIME_HISTORY_INSUFFICIENT
SOURCE_GRAPH_INCOMPLETE
SCENARIO_INVALID
POLICY_VERSION_MISSING
HARD_TRIGGER_CONFIG_INVALID
RISK_SCORE_INDETERMINATE
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 40. 数据库设计

## `bom_risk_assessment_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
bom_revision VARCHAR NULL
product_phase VARCHAR NULL
demand_context JSONB NOT NULL
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

## `bom_risk_assessment_results`

```text
id UUID PK
job_id UUID NOT NULL
tenant_id UUID NOT NULL
bom_id UUID NOT NULL
bom_revision VARCHAR NOT NULL
overall_risk_level VARCHAR NOT NULL
overall_score NUMERIC(5,2) NULL
overall_confidence NUMERIC(5,4) NULL
review_required BOOLEAN NOT NULL
hard_triggers JSONB NOT NULL
summary JSONB NOT NULL
line_results_uri TEXT NOT NULL
concentration_report_uri TEXT NOT NULL
scenario_report_uri TEXT NULL
mitigation_plan_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
policy_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## `bom_line_risk_results`

```text
id UUID PK
assessment_result_id UUID NOT NULL
bom_line_id UUID NOT NULL
part_id UUID NULL
ordering_variant_id UUID NULL
functional_group_id UUID NULL
criticality_level VARCHAR NOT NULL
source_level VARCHAR NOT NULL
overall_risk_level VARCHAR NOT NULL
overall_score NUMERIC(5,2) NULL
confidence NUMERIC(5,4) NOT NULL
hard_triggers JSONB NOT NULL
reason_codes JSONB NOT NULL
features_uri TEXT NOT NULL
dimension_results_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(assessment_result_id, bom_line_id)
```

## `risk_dimension_results`

```text
id UUID PK
line_risk_result_id UUID NOT NULL
dimension VARCHAR NOT NULL
risk_level VARCHAR NOT NULL
score NUMERIC(5,2) NULL
confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
evidence_ids JSONB NOT NULL
policy_rule_ids JSONB NOT NULL
UNIQUE(line_risk_result_id, dimension)
```

## `source_diversity_snapshots`

```text
id UUID PK
line_risk_result_id UUID NOT NULL
authorized_channel_count INT NOT NULL
distributor_sku_count INT NOT NULL
distinct_manufacturer_count INT NOT NULL
qualified_alternative_count INT NOT NULL
approved_alternative_count INT NOT NULL
independent_fab_group_count INT NULL
independent_assembly_group_count INT NULL
independent_region_count INT NULL
source_level VARCHAR NOT NULL
source_graph_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## `inventory_risk_snapshots`

```text
id UUID PK
line_risk_result_id UUID NOT NULL
horizon_days INT NOT NULL
usable_supply NUMERIC NULL
forecast_demand NUMERIC NULL
safety_stock NUMERIC NULL
coverage_ratio NUMERIC NULL
coverage_days NUMERIC NULL
effective_lead_time_days NUMERIC NULL
stock_concentration_hhi NUMERIC NULL
top1_stock_share NUMERIC NULL
stockout_date DATE NULL
input_snapshot_uri TEXT NOT NULL
UNIQUE(line_risk_result_id, horizon_days)
```

## `price_risk_snapshots`

```text
id UUID PK
line_risk_result_id UUID NOT NULL
analysis_quantity NUMERIC NOT NULL
currency CHAR(3) NOT NULL
window_days INT NOT NULL
current_unit_price NUMERIC NULL
median_unit_price NUMERIC NULL
mad NUMERIC NULL
coefficient_of_variation NUMERIC NULL
max_jump NUMERIC NULL
trend_slope NUMERIC NULL
provider_spread NUMERIC NULL
sample_count INT NOT NULL
status VARCHAR NOT NULL
series_uri TEXT NOT NULL
```

## `lead_time_risk_snapshots`

```text
id UUID PK
line_risk_result_id UUID NOT NULL
current_days NUMERIC NULL
historical_median_days NUMERIC NULL
p90_days NUMERIC NULL
mad_days NUMERIC NULL
late_delivery_rate NUMERIC NULL
trend VARCHAR NULL
sample_count INT NOT NULL
status VARCHAR NOT NULL
series_uri TEXT NOT NULL
```

## `concentration_results`

```text
id UUID PK
assessment_result_id UUID NOT NULL
dimension VARCHAR NOT NULL
weight_basis VARCHAR NOT NULL
hhi NUMERIC NULL
top1_share NUMERIC NULL
top3_share NUMERIC NULL
entity_count INT NOT NULL
details_uri TEXT NOT NULL
UNIQUE(assessment_result_id, dimension, weight_basis)
```

## `regional_risk_observations`

```text
id UUID PK
region_type VARCHAR NOT NULL
region_id VARCHAR NOT NULL
risk_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
published_at TIMESTAMPTZ NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
source_id UUID NOT NULL
source_document_id UUID NULL
confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## `risk_scenario_runs`

```text
id UUID PK
assessment_result_id UUID NOT NULL
scenario_id VARCHAR NOT NULL
scenario_version VARCHAR NOT NULL
parameters JSONB NOT NULL
status VARCHAR NOT NULL
affected_line_count INT NOT NULL
critical_line_count INT NOT NULL
additional_spend NUMERIC NULL
currency CHAR(3) NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(assessment_result_id, scenario_id, scenario_version)
```

## `risk_mitigation_actions`

```text
id UUID PK
tenant_id UUID NOT NULL
assessment_result_id UUID NOT NULL
bom_line_id UUID NULL
part_id UUID NULL
action_type VARCHAR NOT NULL
priority VARCHAR NOT NULL
owner_role VARCHAR NOT NULL
assigned_to UUID NULL
risk_reduction_estimate NUMERIC NULL
effort_level VARCHAR NULL
estimated_lead_time_days INT NULL
cost_impact JSONB NULL
dependencies JSONB NOT NULL
status VARCHAR NOT NULL
due_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## `risk_acceptances`

```text
id UUID PK
tenant_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
risk_dimension VARCHAR NULL
risk_level VARCHAR NOT NULL
reason TEXT NOT NULL
conditions JSONB NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NOT NULL
review_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NOT NULL
created_at TIMESTAMPTZ
```

## `bom_risk_reviews`

```text
id UUID PK
assessment_result_id UUID NOT NULL
bom_line_id UUID NULL
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

---

# 41. 对象存储

```text
derived/bom-risk/
  {tenant_id}/{bom_id}/{revision}/
    {assessment_id}/
      input/
        bom-snapshot.json.zst
        demand-context.json
        policy-context.json
        source-snapshots.json
      features/
        line-features.json.zst
        source-graphs/
        price-series/
        lead-time-series/
        inventory-snapshots/
      assessments/
        line-results.json.zst
        functional-group-results.json
        bom-summary.json
        concentration.json
      scenarios/
        base.json
        demand-plus-30.json
        region-disruption.json
      mitigations/
        mitigation-plan.json
        tasks.json
      evidence/
        evidence-manifest.json
      reports/
        quality-report.json
        stale-input-report.json
      debug/
        hard-trigger-log.json
        scoring-trace.json.zst
        aggregation-trace.json
```

---

# 42. 事件

输入：

```text
bom.normalized.ready
bom.mpn-resolution.ready
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
component.market-data.ready
bom.market-data.ready
inventory.changed
purchase-order.changed
forecast.updated
supplier.performance.updated
regional-risk.updated
```

输出：

```text
bom.risk.ready
bom.risk.changed
bom.line.risk.critical
bom.stockout.predicted
bom.single-source.detected
portfolio.concentration.changed
risk.mitigation.created
risk.review.required
```

`bom.risk.ready`：

```json
{
  "event_type": "bom.risk.ready",
  "event_version": "1.0",
  "assessment_result_id": "uuid",
  "bom_id": "uuid",
  "bom_revision": "RevC",
  "result_uri": "s3://.../bom-summary.json",
  "summary": {
    "risk_level": "high",
    "critical_lines": 8,
    "high_risk_lines": 31,
    "single_manufacturer_lines": 112,
    "stockout_90d_lines": 14
  },
  "review_status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 43. 配置与策略

```text
policies/
├── bom-risk-1.0.0.yaml
├── criticality.yaml
├── source-diversity.yaml
├── inventory-depth.yaml
├── price-volatility.yaml
├── lead-time.yaml
├── concentration.yaml
├── lifecycle.yaml
├── compliance-trade.yaml
├── regional-risk.yaml
├── supplier-performance.yaml
├── hard-triggers.yaml
├── scoring.yaml
├── scenarios/
└── enterprise/
    └── tenant-specific/
```

所有阈值、权重、折算和 Hard Trigger 都必须版本化。

---

# 44. 可观测性

Metrics：

```text
bom_risk_jobs_total{status}
bom_risk_duration_seconds{step}
bom_risk_lines_total{risk_level}
bom_risk_single_source_lines_total{source_level}
bom_risk_stockout_predictions_total{horizon}
bom_risk_market_data_stale_total
bom_risk_price_history_insufficient_total
bom_risk_lead_time_history_insufficient_total
bom_risk_hard_triggers_total{trigger}
bom_risk_concentration_hhi{dimension,basis}
bom_risk_scenarios_total{scenario,status}
bom_risk_mitigations_total{type,status}
bom_risk_reviews_total{reason}
bom_risk_cache_hits_total{stage}
```

Dashboard：

- Critical/High Line；
- 单一制造商；
- 无验证替代；
- 30/90/180 天预计缺料；
- 价格跳涨；
- 交期恶化；
- Manufacturer/Site/Region HHI；
- 数据缺失；
- Top Risk Contributors；
- 缓解任务进度；
- Portfolio 共用高风险 Part。

---

# 45. Benchmark

## Line Risk

```text
single-source classification accuracy
valid-source count accuracy
source-level accuracy
criticality accuracy
hard-trigger precision/recall
overall risk classification
```

## Inventory

```text
usable supply accuracy
coverage accuracy
stockout-date error
inventory concentration accuracy
expected-stock exclusion accuracy
```

## Price

```text
context alignment accuracy
price-tier normalization
volatility metric reproducibility
price-jump detection
FX separation accuracy
```

## Lead Time

```text
lead-time type classification
historical percentile accuracy
spike detection
stock-coverage comparison
```

## Concentration/Region

```text
manufacturer parent grouping
site independence classification
HHI arithmetic
regional exposure mapping
route dependency detection
```

## Business

```text
engineer acceptance rate
procurement acceptance rate
human downgrade/upgrade rate
mitigation completion rate
shortage avoidance
expedite-cost reduction
false-green rate
```

---

# 46. 初始质量目标

```text
Exact BOM Line Identity Usage = 100%
Valid Source Count Accuracy >= 99%
Source Diversity Level Accuracy >= 98%
Hard Trigger Recall >= 99.5%
Critical Line False-green Rate <= 0.1%
Inventory Coverage Accuracy >= 99%
Expected-stock Exclusion Accuracy = 100%
Price Context Alignment >= 99.5%
Price Calculation Reproducibility = 100%
Lead-time Risk Accuracy >= 97%
Manufacturer Parent Group Accuracy >= 99%
HHI Arithmetic Accuracy = 100%
Regional Exposure Mapping >= 97%
High-confidence Auto Publish Accuracy >= 99%
Evidence Completeness >= 99%
```

这些是目标，不是未经测试的保证。

---

# 47. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## Identity/Source

1. Exact Part；
2. Unresolved Line；
3. Single Distributor；
4. Three Distributors Same Manufacturer；
5. Multi Packaging；
6. Same Manufacturer Alternative；
7. Multi-manufacturer Verified；
8. Unverified Alternative；
9. Marketplace-only；
10. Vendor Direct；
11. Obsolete Offer；
12. Customer-blocked Alternative；
13. Same Parent Different Brands；
14. Same Foundry；
15. Unknown Site。

## Inventory

16. Stock Above Demand；
17. Stock Below Demand；
18. Stock Below Lead-time Demand；
19. Expected Stock Only；
20. Quarantine；
21. Allocated；
22. Open PO Confirmed；
23. Open PO Unconfirmed；
24. In-transit；
25. Shared Inventory；
26. Zero Demand；
27. Intermittent Demand；
28. Service Demand；
29. Safety Stock；
30. Multiple Horizons。

## Price

31. Stable；
32. Rising；
33. Price Jump；
34. FX-only Change；
35. Packaging Change；
36. Quantity Break Change；
37. Contract/Public Mixed；
38. Sparse History；
39. Outlier；
40. Provider Spread。

## Lead Time

41. Stable；
42. Spike；
43. Long P90；
44. Supplier Late；
45. Expected Stock Delay；
46. Missing History；
47. Manufacturer vs Warehouse Lead Time；
48. Procurement Cycle Longer；
49. Recovery；
50. Seasonal Lead Time。

## Concentration/Region

51. Manufacturer HHI；
52. Parent HHI；
53. Site HHI；
54. Region HHI；
55. Warehouse HHI；
56. Route HHI；
57. Port Disruption；
58. Factory-specific Event；
59. Country-wide Event；
60. False Broad Match；
61. Multi-region；
62. Unknown Route；
63. Common Part Across Products；
64. Criticality-weighted HHI；
65. Spend HHI。

## Lifecycle/Compliance

66. NRND；
67. EOL No Alternative；
68. LTB；
69. Critical PCN；
70. Compliance Evidence Expired；
71. Origin Unknown；
72. Tariff Increase；
73. Only Alternative Blocked；
74. Acquisition；
75. Part Rename。

## Scenario/System

76. Demand +20；
77. Demand +50；
78. Distributor Down；
79. Manufacturer Down；
80. Region Down；
81. Lead Time Double；
82. Price +30；
83. Alternative Validation Delayed；
84. Stale Market Data；
85. Partial Upstream Failure；
86. Incremental Recompute；
87. Policy Version Change；
88. Risk Acceptance；
89. Expired Acceptance；
90. Review Patch；
91. 10,000 Lines；
92. Duplicate Parts；
93. Multiple Products；
94. Tenant Isolation；
95. Cache Reuse；
96. Idempotency；
97. Cancel；
98. Audit Reproduction；
99. Feature Drift；
100. Policy Rollback。

---

# 48. 性能要求

单 BOM：

```text
1,000 lines cached P95 < 10 s
10,000 lines cached P95 < 60 s
```

不包含 Agent 36 外部实时刷新。

必须：

- Part 去重；
- 共享 Snapshot；
- 时间序列预聚合；
- Source Graph 缓存；
- 分块对象存储；
- 增量重算；
- 场景并行但限流。

---

# 49. 缓存和增量

缓存键：

```text
bom_revision_hash
+ part_resolution_snapshot
+ alternative_snapshot
+ lifecycle_snapshot
+ compliance_snapshot
+ market_snapshot
+ inventory_snapshot
+ forecast_version
+ supplier_performance_version
+ regional_risk_version
+ risk_policy_version
```

更新策略：

- 市场数据变更：重跑库存、价格和交期；
- Agent 33 变更：重跑多源、Switching Cost 和 Scenario；
- Agent 34 变更：重跑生命周期和 Hard Trigger；
- Agent 35 变更：重跑合规、原产地和区域暴露；
- Forecast 变更：重跑 Coverage 和 Scenario；
- BOM Revision 变更：只处理新增/删除/变更行；
- Regional Feed 更新：只重跑匹配地点和路线。

---

# 50. 安全与权限

- BOM、预测、供应商绩效和价格按租户隔离；
- Agent 36 合同价格不得进入公共风险结果；
- 风险结果只显示用户有权限访问的商业字段；
- Region Feed 与公共事件可共享，企业暴露映射私有；
- 风险接受和策略修改需审计；
- Critical Risk Waiver 支持双人批准；
- 不将私有 BOM、客户、供应商和需求发送到外部通用模型；
- LLM 不负责最终评分；
- DSL 禁止任意代码；
- 大型输入限制资源和并发；
- 输出下载使用签名 URL；
- 公开测试数据必须合成或脱敏。

---

# 51. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
OpenSearch / Elasticsearch
Redis
S3 / R2 / MinIO
```

可选：

```text
Temporal / Celery / RQ
Polars / DuckDB for batch analytics
NetworkX / PostgreSQL graph tables
LightGBM for calibrated ranking in later phase
```

V1 推荐：

```text
Rule-based Risk Engine
+ Versioned Policy
+ Deterministic Metrics
+ Explainable Source Graph
```

不需要 LLM 参与评分。


---

# 52. 推荐仓库结构

```text
bom-risk-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── bom-risk-agent-spec.md
│   ├── source-diversity-model.md
│   ├── criticality-model.md
│   ├── inventory-depth-design.md
│   ├── price-volatility-design.md
│   ├── lead-time-risk-design.md
│   ├── concentration-risk-design.md
│   ├── regional-risk-design.md
│   ├── scenario-engine.md
│   ├── scoring-and-hard-triggers.md
│   ├── mitigation-and-review.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-channel-diversity-is-not-technical-diversity.md
│       ├── 0002-hard-trigger-before-weighted-score.md
│       ├── 0003-unknown-is-not-low-risk.md
│       ├── 0004-buildability-and-financial-risk-separated.md
│       ├── 0005-market-context-required-for-price-risk.md
│       └── 0006-risk-results-are-replayable.md
├── src/
│   └── bom_risk/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── feature.py
│       │   ├── dimension.py
│       │   ├── result.py
│       │   ├── scenario.py
│       │   ├── mitigation.py
│       │   └── review.py
│       ├── jobs/
│       ├── events/
│       ├── inputs/
│       │   ├── bom.py
│       │   ├── demand.py
│       │   ├── alternatives.py
│       │   ├── lifecycle.py
│       │   ├── compliance.py
│       │   ├── market.py
│       │   ├── inventory.py
│       │   ├── purchase_orders.py
│       │   ├── suppliers.py
│       │   └── regions.py
│       ├── source_graph/
│       │   ├── builder.py
│       │   ├── channels.py
│       │   ├── manufacturers.py
│       │   ├── sites.py
│       │   ├── regions.py
│       │   └── routes.py
│       ├── criticality/
│       │   ├── classifier.py
│       │   ├── functional_groups.py
│       │   └── profiles.py
│       ├── diversity/
│       │   ├── source_levels.py
│       │   ├── effective_sources.py
│       │   ├── validation_weights.py
│       │   └── independence.py
│       ├── inventory/
│       │   ├── usable_supply.py
│       │   ├── demand.py
│       │   ├── coverage.py
│       │   ├── stockout.py
│       │   └── concentration.py
│       ├── price/
│       │   ├── context.py
│       │   ├── normalization.py
│       │   ├── history.py
│       │   ├── volatility.py
│       │   └── trend.py
│       ├── lead_time/
│       │   ├── normalization.py
│       │   ├── history.py
│       │   ├── reliability.py
│       │   └── risk.py
│       ├── concentration/
│       │   ├── hhi.py
│       │   ├── manufacturer.py
│       │   ├── supplier.py
│       │   ├── site.py
│       │   ├── region.py
│       │   └── route.py
│       ├── dimensions/
│       │   ├── identity.py
│       │   ├── sourcing.py
│       │   ├── lifecycle.py
│       │   ├── compliance.py
│       │   ├── demand.py
│       │   ├── supplier.py
│       │   └── data_quality.py
│       ├── scoring/
│       │   ├── policy.py
│       │   ├── hard_triggers.py
│       │   ├── dimension_scores.py
│       │   ├── confidence.py
│       │   └── aggregation.py
│       ├── scenarios/
│       │   ├── registry.py
│       │   ├── engine.py
│       │   ├── disruptions.py
│       │   └── outputs.py
│       ├── mitigations/
│       │   ├── generator.py
│       │   ├── prioritizer.py
│       │   └── tasks.py
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── scenario-profiles/
├── regional-risk-profiles/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── build_source_graph.py
    ├── validate_risk_policy.py
    ├── calculate_concentration.py
    ├── run_bom_risk_benchmark.py
    ├── compare_policy_versions.py
    ├── replay_assessment.py
    └── export_mitigation_training_data.py
```

---

# 53. Codex 分阶段实施

不要一次实现全部风险维度。

## Phase 0：仓库侦察和数据盘点

必须检查：

1. Agent 31–36 的真实代码和接口；
2. BOM、Revision、Product、Material 和 Functional Group；
3. Part、Ordering Variant 和 Supplier SKU；
4. 替代料、AVL 和验证状态；
5. 生命周期、PCN、合规、原产地和市场数据；
6. 内部库存、在途、Open PO 和分配；
7. Forecast、产品阶段和售后需求；
8. Supplier Performance；
9. Manufacturer、Parent、Site、Region 和 Route；
10. 历史价格、库存和交期；
11. 现有风险字段、Dashboard 和告警；
12. 租户、权限、对象存储、队列和缓存；
13. 当前数据覆盖、冲突、新鲜度和缺失；
14. 只输出文档，不修改业务代码、不创建 Migration、不安装依赖。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Assessment Request；
- Snapshot；
- Line Feature；
- Dimension Result；
- Source Diversity；
- Inventory/Price/Lead-time Snapshot；
- Concentration；
- Scenario；
- Mitigation；
- Acceptance；
- Review；
- Event；
- JSON Schema。

## Phase 2：Input Snapshot 和 Upstream Adapters

实现：

- Agent 31–36 Adapter；
- BOM Revision Snapshot；
- Forecast；
- Inventory；
- Open PO；
- Supplier Performance；
- Freshness；
- Version；
- Idempotency。

## Phase 3：Criticality 和 Functional Groups

实现：

- Criticality Profile；
- Functional Role；
- Single Point of Failure；
- Redesign Effort；
- Product Phase；
- Functional Group。

## Phase 4：Source Graph

实现：

- Distributor；
- Supplier；
- Manufacturer；
- Parent；
- Part；
- Alternative；
- Fab；
- Assembly/Test Site；
- Region；
- Route；
- Graph Evidence。

## Phase 5：Source Diversity

实现：

- S0–S6；
- Effective Source；
- Authorized Channel；
- Validation Weight；
- Site Independence；
- Customer/Compliance Filter；
- Review。

## Phase 6：Inventory Depth

实现：

- Usable Supply；
- Demand Horizon；
- Shared Inventory；
- Safety Stock；
- Coverage；
- Stockout；
- Multi-horizon；
- Concentration。

## Phase 7：Price Risk

实现：

- Comparable Context；
- Quantity Normalization；
- FX Separation；
- Median/MAD/CV；
- Jump；
- Trend；
- Sparse History；
- Provider Spread。

## Phase 8：Lead-time Risk

实现：

- Lead-time Types；
- Historical Percentiles；
- Supplier Reliability；
- Expected Stock Reliability；
- Effective Lead Time；
- Coverage Comparison。

## Phase 9：Manufacturer/Supplier Concentration

实现：

- HHI；
- Top-1/Top-3；
- Spend/Line/Criticality Weight；
- Parent Group；
- Product Line；
- Portfolio。

## Phase 10：Site、Region 和 Route Risk

实现：

- Origin Facts；
- Site Group；
- Region Observation；
- Route；
- Event Mapping；
- HHI；
- Uncertain Match；
- Versioned Feed。

## Phase 11：Lifecycle、Compliance 和 Demand Dimensions

实现：

- EOL/NRND/PCN；
- Compliance/Customer Block；
- Origin/Trade；
- Forecast Error；
- Demand Volatility；
- Switching Cost。

## Phase 12：Hard Trigger 和 Scoring

实现：

- Controlled DSL；
- Hard Trigger；
- Dimension Score；
- Confidence；
- Criticality/Time Adjustment；
- Overall Class；
- Explainable Trace。

## Phase 13：Scenario Engine

实现：

- Demand；
- Channel；
- Manufacturer；
- Site；
- Region；
- Lead Time；
- Price；
- EOL；
- Alternative Delay；
- Recovery/Spend/Stockout。

## Phase 14：BOM 和 Portfolio Aggregation

实现：

- Bottleneck Buildability；
- Financial Exposure；
- Functional Group；
- Product；
- Shared Part；
- Portfolio Concentration；
- Top Contributors。

## Phase 15：Mitigation 和 Review

实现：

- Action Generator；
- Prioritization；
- Owner；
- Task Hook；
- Risk Acceptance；
- Patch；
- Audit；
- Expiry。

## Phase 16：API、Events、Batch 和 Cache

实现：

- API；
- Job；
- Batch；
- Incremental；
- Cache；
- Events；
- Retry/Cancel；
- Object Storage；
- Access Control。

## Phase 17：Benchmark、监控和生产发布

实现：

- Benchmark；
- Metrics；
- Dashboard；
- Replay；
- Security；
- Feature Flag；
- Policy Rollback；
- Disaster Recovery。

## Phase 18：Learning 和 Calibration，可选

在规则引擎稳定后：

- 使用历史短缺和人工审核做校准；
- Learning-to-Rank 仅用于缓解优先级或候选排序；
- 不替代 Hard Trigger；
- Shadow Mode；
- Bias/Drift；
- 可回滚。

---

# 54. Codex 工作纪律

Codex 必须：

1. 多分销商不等于多制造商；
2. 多包装不等于技术多源；
3. 未批准替代不计为有效完整来源；
4. 技术来源、渠道来源、地点来源和区域来源分开；
5. Part、Ordering Variant、Distributor SKU 分开；
6. 价格比较必须对齐数量、包装、币种、地区和账号类型；
7. Expected Stock 不计入即时可用库存；
8. Marketplace 默认不计入授权来源；
9. 内部隔离、过期和已分配库存不计入可用量；
10. Coverage 必须结合 Forecast 和有效交期；
11. 零需求不能导致除零；
12. 历史不足不能输出零波动；
13. Lead-time 类型不能混合；
14. Manufacturer 品牌和 Ultimate Parent 分开；
15. 地点未知不得视为独立；
16. 区域事件必须匹配具体地点或路线；
17. 区域风险 Feed 必须版本化并有证据；
18. HHI 算法使用 Decimal 或稳定数值；
19. Buildability 和 Financial Risk 分开；
20. BOM 风险不能简单平均；
21. Hard Trigger 在加权评分前；
22. Unknown 降低置信度并提高数据质量风险；
23. Agent 33 技术判断不能被商业数据覆盖；
24. Agent 34 生命周期事实不能被库存多覆盖；
25. Agent 35 合规限制必须过滤有效来源；
26. Agent 36 Stale 数据必须显式处理；
27. Scenario 作用于正确依赖层级；
28. Risk Acceptance 有 Scope 和有效期；
29. 人工 Patch 不覆盖机器 Feature 和 Trace；
30. LLM 不直接评分或生成地缘事实；
31. 不将私有 BOM、预测、价格和供应商绩效发送到外部模型；
32. 不使用真实客户数据做公开 Fixture；
33. 不伪造 Risk Accuracy、Benchmark 或数据覆盖；
34. 每个 Phase 必须输出修改文件、Schema/API、Policy、测试、Benchmark、性能、安全、已知限制和下一阶段。

---

# 55. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/bom-risk-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第37个 Agent：

BOM Supply Risk & Multi-Sourcing Intelligence Agent / BOM 风险与多源供应 Agent。

本 Agent 对每一行 BOM、每个 BOM Revision、产品和企业组合评估：

- 单一来源；
- 授权渠道数量；
- 制造商和母公司集中度；
- 技术替代和验证状态；
- Fab、封装测试、仓库和区域集中度；
- 库存深度和预计缺料；
- 价格水平和价格波动；
- 当前交期和交期波动；
- 生命周期、EOL、PCN；
- 合规、原产地、贸易和客户限制；
- Supplier Performance；
- Demand Uncertainty；
- Switching Cost；
- Data Quality。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31、32、33、34、35、36 的规格和实际代码；
3. docs/bom-risk-agent-spec.md；
4. 当前 BOM、Revision、Product、Material、Functional Group 和 Product Phase；
5. 当前 Part、Ordering Variant、Distributor SKU、Manufacturer 和 Parent；
6. 当前 Alternative、AVL、Validation 和 Customer Approval；
7. 当前 Lifecycle、PCN、Compliance、Origin、Tariff 和 Market Offer；
8. 当前 Inventory、Allocation、Quarantine、In-transit、Open PO 和 Supplier Confirmation；
9. 当前 Forecast、Service Demand、Safety Stock 和 Product Sunset；
10. 当前 Supplier Performance、Site、Region、Warehouse 和 Route；
11. 当前风险字段、Dashboard、Review、Patch、权限、对象存储、队列和缓存；
12. 脱敏、合成或授权 Fixture。

硬约束：

- 多分销商不等于多制造商；
- 多包装不等于技术第二来源；
- 未验证替代不能算有效完整来源；
- Channel、Manufacturer、Technical、Site、Region Diversity 分开；
- Part、Ordering Variant 和 Distributor SKU 分开；
- Effective Source 必须通过 Identity、Lifecycle、Compliance、Packaging、Authorized 和 Quantity Gate；
- Marketplace 默认不计入授权来源；
- Expected Stock 不计入 Available Now；
- Quarantine、Expired、Allocated 和 Customer-incompatible 库存不计入 Usable Supply；
- Coverage 绑定 Forecast Version、Horizon 和 Effective Lead Time；
- 价格时间序列必须对齐 Packaging、Quantity、Currency、Region 和 Account Class；
- 历史不足输出 Unknown，不输出零波动；
- Lead-time 类型分开；
- Manufacturer Brand、Legal Entity 和 Ultimate Parent 分开；
- Site Unknown 不得当独立；
- Region Event 必须匹配 Site/Route；
- Region Feed 必须版本化和有来源；
- HHI 同时输出 Top1/Top3；
- Buildability 和 Financial Exposure 分开；
- BOM 风险使用 Bottleneck，不简单平均；
- Hard Trigger 在 Weighted Score 前；
- Unknown 降低 Confidence 并提高 Data Quality Risk；
- Agent 33 技术结论不能被低价覆盖；
- Agent 34 EOL 不能被库存多覆盖；
- Agent 35 Customer Block 必须过滤来源；
- Agent 36 Stale Market Data 必须标记；
- Scenario 必须作用于 Channel/Manufacturer/Site/Region/Route 的正确层级；
- Risk Acceptance 和 Waiver 有 Scope、Revision、条件和有效期；
- 人工 Patch 不覆盖机器 Feature、Score 和 Trace；
- LLM 不直接评分，不生成未经来源验证的区域风险；
- 不把私有 BOM、Forecast、Contract Price 和 Supplier Performance 发给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造风险准确率、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–36 的真实完成程度和接口；
3. 查找 BOM、Revision、Product、Material、Functional Group 和 Product Phase；
4. 查找 Part、Ordering Variant、Distributor SKU、Manufacturer、Brand 和 Parent；
5. 查找 Alternative、AVL、Validation、Customer Approval 和历史替代；
6. 查找 Lifecycle、PCN、Compliance、Origin、Tariff 和 Market Offer；
7. 查找 Internal Inventory、Allocation、Quarantine、In-transit 和 Open PO；
8. 查找 Forecast、Service Demand、Safety Stock、Yield 和 Product Sunset；
9. 查找 Supplier Performance 和实际交付历史；
10. 查找 Price、Inventory 和 Lead-time History；
11. 查找 Fab、Assembly、Test、Warehouse、Region 和 Route；
12. 查找 Regional Risk Feed、来源和版本；
13. 查找风险评分、Dashboard、Alert、Review、Patch 和 Acceptance；
14. 统计数据覆盖、Unknown、Stale、Conflict 和重复；
15. 抽样分析脱敏或合成高风险 BOM；
16. 在 docs/bom-risk-implementation-plan.md 中生成实施计划；
17. 在 docs/source-diversity-model.md 中定义 S0–S6；
18. 在 docs/bom-criticality-model.md 中定义 Criticality 和 Functional Group；
19. 在 docs/inventory-depth-risk-design.md 中定义 Coverage 和 Stockout；
20. 在 docs/price-volatility-risk-design.md 中定义可比较价格序列；
21. 在 docs/lead-time-risk-design.md 中定义交期指标；
22. 在 docs/concentration-risk-design.md 中定义 Manufacturer/Site/Region HHI；
23. 在 docs/regional-risk-source-design.md 中定义 Region Feed；
24. 在 docs/bom-risk-scoring-design.md 中定义 Hard Trigger、Score 和 Confidence；
25. 在 docs/bom-risk-scenario-design.md 中定义 Scenario；
26. 在 docs/bom-risk-mitigation-review.md 中定义动作、审核和风险接受；
27. 在 docs/bom-risk-migration-plan.md 中定义旧风险字段迁移；
28. 在 docs/bom-risk-benchmark-plan.md 中定义 Benchmark；
29. 给出拟新增、拟修改和拟复用文件；
30. 给出 Phase 1 精确范围；
31. 不修改业务代码；
32. 不创建数据库 Migration；
33. 不安装依赖；
34. 运行当前仓库已有 lint、type check、test、build 和 security scan；
35. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–36 输入契约；
- 当前 BOM/Part/Alternative/Market 数据；
- Source Diversity；
- Criticality；
- Inventory Depth；
- Price Volatility；
- Lead-time Risk；
- Manufacturer/Site/Region Concentration；
- Regional Risk Feed；
- Lifecycle/Compliance/Trade；
- Supplier Performance；
- Scoring/Hard Trigger；
- Scenario；
- BOM/Portfolio Aggregation；
- Mitigation/Review/Acceptance；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 56. 后续 Phase 提示词模板

```text
继续实现 BOM Risk Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–37 规格；
3. 阅读 BOM Risk Implementation Plan；
4. 阅读 Diversity、Criticality、Inventory、Price、Lead-time、Concentration、Region、Scenario 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Channel/Manufacturer/Technical/Site/Region 分离；
- Exact Identity；
- Effective Source Gate；
- Available/Expected 分离；
- Market Context 对齐；
- Unknown 非 Low；
- Hard Trigger before Score；
- Buildability/Financial 分离；
- Evidence/Version/Trace 完整；
- Risk Acceptance 有有效期；
- 不覆盖人工 Patch；
- LLM 不直接评分；
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
9. security test；
10. performance test；
11. benchmark；
12. 更新文档；
13. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Policy/Profile 变化；
- 测试命令和真实结果；
- Risk Dimension 指标；
- Hard Trigger 指标；
- Scenario 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 57. MVP 演示流程

1. 输入一个已经由 Agent 31/32 标准化的 100 行 BOM；
2. 加载 Agent 33 替代关系；
3. 加载 Agent 34 生命周期；
4. 加载 Agent 35 合规和制造地点；
5. 加载 Agent 36 四家分销商价格库存；
6. 识别“三家分销商、一个制造商”并标记 S2；
7. 识别同一器件 Cut Tape/Reel，不当作技术多源；
8. 识别一个跨制造商、量产批准替代，升级为 S5；
9. 发现两个制造商共享同一封装厂，不升级为 S6；
10. 计算 30/90/180 天库存覆盖；
11. Expected Stock 不计入 Available；
12. 发现覆盖天数小于有效交期，触发 Hard Trigger；
13. 对齐数量、包装和币种计算价格波动；
14. 历史样本不足输出 Unknown；
15. 计算 Lead-time P90；
16. 计算 Manufacturer HHI 和 Top1 Share；
17. 区域中断只命中相关工厂；
18. EOL 无替代触发 Critical；
19. 客户禁止唯一替代，保持 Critical；
20. 执行 Demand +30% Scenario；
21. 执行 Primary Distributor Down；
22. 执行 Primary Manufacturer Down；
23. 输出 BOM Heatmap 和 Top Contributors；
24. 创建第二来源认证和安全库存建议；
25. 人工修改 Criticality；
26. 保存 Review Patch；
27. 经理接受一项中风险，设置 90 天有效期；
28. 发布 `bom.risk.ready`。

---

# 58. 生产上线顺序

第一阶段：

```text
Exact BOM Line
Source S0–S5
Criticality
Inventory Coverage
Current Lead Time
Lifecycle
Hard Trigger
BOM Heatmap
人工审核
```

第二阶段：

```text
Price History
Lead-time History
Manufacturer/Parent HHI
Site/Region
Scenario
Mitigation Tasks
Portfolio Exposure
```

第三阶段：

```text
Route Risk
Supplier Performance
Forecast Uncertainty
Calibration
更多外部风险 Feed
企业级风险优化
```

上线优先保证：

```text
有效来源到底有几个
库存能不能覆盖有效交期
唯一替代是否真正批准
关键制造地点是否独立
```

宁可将数据不足标为 Unknown，也不要因为“有四家分销商显示库存”就给一个虚假的绿色多源结论。
