# 生命周期、EOL 与 PCN Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：34  
> Agent 名称：Component Lifecycle, EOL & PCN Intelligence Agent  
> 中文名称：生命周期、EOL 与 PCN Agent  
> 版本：V1.0  
> 定位：持续跟踪元器件生命周期状态、EOL/PDN/PCN、厂商并购、品牌迁移和料号变更，建立可追溯事件时间线，并评估对产品、BOM、采购、库存和制造的影响  
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - 元器件主数据库、Manufacturer Registry、Ordering Variant、Package Variant
> - Datasheet、产品页面、官方通知、授权分销商和企业历史记录
> - ezPLM 项目、BOM、物料、采购、库存、供应商、生产和变更数据
>
> 下游：
> - BOM 生命周期风险分析
> - 替代料推荐与 AVL 更新
> - Last-Time-Buy 决策
> - 库存消耗、呆滞和缺料风险分析
> - ECR/ECN、工程变更和重新认证
> - 采购计划、供应商协同和成本预测
> - 产品维护、售后和长期供应策略

---

# 1. 建设目标

建设一个独立、可复用、可测试、可版本化的生命周期、EOL 与 PCN Agent。

该 Agent 接收并标准化：

- Active、Preferred、Mature、NRND；
- EOL、Last-Time-Buy、Last-Time-Ship、Discontinued、Obsolete；
- Product Change Notice、Product Discontinuation Notice；
- Fab、Assembly、Test Site、Material、Process、Die Revision 变更；
- Package、Lead Finish、Marking、Country of Origin 变更；
- Datasheet 和 Electrical Specification 变更；
- 厂商并购、品牌迁移、业务出售和产品线转移；
- Part Number Rename、Split、Merge、Superseded、Replacement；
- 授权分销商和企业供应商的生命周期状态；
- 企业内部 Approved、Blocked、Service-only 和 LTB Decision。

输出：

```text
当前生命周期结论
完整状态历史
PCN/EOL 事件时间线
厂商与品牌关系变化
料号变化关系
受影响 Part / Variant / BOM / Product
库存与采购暴露
LTB 数量和资金风险
替代料可用性
工程、采购、质量和库存处置建议
告警、审核、证据和置信度
```

系统必须做到：

1. 聚合制造商官网、官方通知、授权分销商和企业内部来源；
2. 将不同来源术语映射为统一生命周期状态；
3. 保存状态历史，不能只覆盖当前值；
4. 分开保存发布日期、生效日期、LTB 和 LTS；
5. 解析 PCN/PDN/EOL 文档中的受影响料号；
6. 处理大型 MPN 附件和通配符；
7. 区分 Base Part、Package Variant、Ordering Variant 和 Packing；
8. 识别厂商并购、品牌迁移、网站迁移和料号改名；
9. 区分 Rename、Superseded、Replacement 和 Alternative；
10. 识别 PCN 对 Form、Fit、Function、Quality、Supply 的影响；
11. 将事件映射到全部产品、BOM Revision、库存和采购订单；
12. 计算库存覆盖、短缺、过量和 LTB；
13. 联动 Agent 33 评估替代可用性；
14. 生成 ECR/ECN、验证、采购和库存任务；
15. 对来源冲突、料号不明和高风险事件进入审核；
16. 支持增量刷新、批量处理和百万级 Part。

---

# 2. 核心原则

## 2.1 生命周期不是一个字段

错误：

```text
part.lifecycle_status = EOL
```

正确：

```text
Lifecycle Observations
→ Lifecycle Events
→ Resolved Current State
→ Enterprise Decision
```

同一器件可能同时出现：

- 厂商产品页：NRND；
- 某分销商：Active；
- 另一分销商：Obsolete；
- 企业内部：Approved for Existing Products；
- 一个 Reel Ordering Code：EOL；
- 同 Base Part 的 Tube Variant：Active。

因此每条状态必须保存：

```text
source
raw status
normalized status
entity scope
observed time
effective range
evidence
confidence
parser version
```

## 2.2 Part 与 Ordering Variant 分开

常见情况：

```text
Base Part Active
Package Variant NRND
Packing Variant Discontinued
```

不能因为某个卷盘包装停产，把整个器件系列标成 EOL。

## 2.3 官方事实与企业决策分开

```text
manufacturer_lifecycle_state
enterprise_usage_state
```

例如厂商 NRND，企业可设置：

```text
blocked_for_new_design
approved_for_existing_products
```

两者互不覆盖。

## 2.4 日期字段分开

```text
notice_publication_date
effective_date
last_time_buy_date
last_order_date
last_time_ship_date
sample_availability_date
implementation_date
```

不能只保存一个 `date`。

## 2.5 Unknown 不是 Active

没有新鲜、可信的官方状态时：

```text
status = unknown
risk = stale_or_missing_data
```

不能默认 Active。

## 2.6 Replacement 不等于 Drop-in

厂商“Recommended Replacement”只表示迁移方向，技术兼容性必须交给 Agent 33。

---

# 3. 与 Agent 31、32、33 的边界

## Agent 31

负责 BOM 文件标准化和原始字段证据。

## Agent 32

负责将 PCN/EOL 附件中的原始料号解析为标准：

```text
Manufacturer
Part
Package Variant
Ordering Variant
```

## Agent 33

负责验证官方 Replacement 或企业候选是否：

```text
Form-Fit-Function
Pin-to-Pin
电气参数
认证
```

## Agent 34

负责：

```text
生命周期和事件情报
→ 企业暴露面
→ 风险、告警和处置
```

---

# 4. 生命周期统一状态

```text
new_product
active
preferred
mature
nrnd
eol_announced
last_time_buy
discontinued
obsolete
unknown
not_applicable
```

说明：

- `nrnd` 不等于 EOL；
- `eol_announced` 表示正式停产通知已发布；
- `last_time_buy` 表示处于最后购买窗口；
- `discontinued` 表示停止常规生产或接单；
- `obsolete` 表示长期停产；
- `unknown` 可能有较高风险；
- Distributor 状态可表示渠道状态，不等于制造商状态。

---

# 5. Lifecycle Observation

```json
{
  "observation_id": "uuid",
  "entity_type": "ordering_variant",
  "entity_id": "uuid",

  "source": {
    "source_type": "manufacturer_product_page",
    "source_id": "uuid",
    "source_url": "https://...",
    "publisher": "Example Semiconductor",
    "retrieved_at": "ISO-8601",
    "document_sha256": "hex"
  },

  "raw": {
    "status_text": "Not Recommended for New Designs",
    "status_code": "NRND",
    "language": "en"
  },

  "normalized": {
    "lifecycle_status": "nrnd",
    "effective_from": null,
    "effective_to": null
  },

  "applicability": {
    "base_part_id": "uuid",
    "package_variant_id": "uuid",
    "ordering_variant_id": "uuid"
  },

  "confidence": 0.99,
  "evidence_anchor_ids": [],
  "parser_version": "lifecycle-page-1.0.0",
  "review_status": "auto_approved"
}
```

---

# 6. Current State Resolution

当前状态不能简单选“最后一条”。

需要考虑：

```text
source authority
event type
entity applicability
freshness
publication/effective date
status conflict
manual decision
```

```json
{
  "entity_type": "ordering_variant",
  "entity_id": "uuid",
  "resolved_status": "eol_announced",
  "as_of": "ISO-8601",
  "selected_observation_ids": [],
  "conflicting_observation_ids": [],
  "resolution_policy_version": "lifecycle-resolution-1.0.0",
  "confidence": 0.98,
  "review_required": false
}
```

---

# 7. 来源优先级

默认：

```text
1. 制造商正式 PCN/PDN/EOL 通知
2. 制造商产品页面
3. 制造商官方 API/生命周期文件
4. 授权分销商数据
5. 企业供应商正式通知
6. 企业采购历史和内部记录
7. 其他聚合数据
8. 非授权市场数据
```

规则：

- LTB/LTS 日期以正式通知为准；
- Distributor Obsolete 不能覆盖 Manufacturer Active；
- 企业供应商通知可影响租户决策，但不改写全球事实；
- 来源冲突全部保留。

---

# 8. Source Registry

```text
source_id
source_type
publisher
domain
authority_level
authentication_method
collection_method
terms_and_license
update_frequency
parser_profile
language
time_zone
freshness_ttl
last_success_at
last_failure_at
health_status
```

支持：

```text
manufacturer_web
manufacturer_api
manufacturer_rss
manufacturer_email
manufacturer_pdf
distributor_api
distributor_feed
supplier_email
manual_upload
enterprise_record
```

采集保存：

```text
ETag
Last-Modified
Content Hash
Raw Snapshot
Document Version
```

内容未变化时不重复深度解析。

---

# 9. PCN、PDN 与 EOL 事件类型

```text
product_change_notice
product_discontinuation_notice
end_of_life_notice
last_time_buy_notice
last_time_ship_notice
material_change
manufacturing_site_change
assembly_site_change
test_site_change
fab_process_change
die_revision_change
mask_revision_change
package_change
lead_finish_change
marking_change
label_change
datasheet_change
specification_change
quality_change
qualification_change
country_of_origin_change
supply_chain_change
part_number_change
brand_change
company_acquisition
business_unit_sale
product_line_transfer
replacement_announcement
unknown_notice
```

---

# 10. PCN 影响维度

```text
form
fit
function
quality
reliability
manufacturing
regulatory
documentation
supply
commercial
identity
```

例子：

- Package 尺寸：Form；
- Pin/Footprint/Reflow：Fit；
- 电气规格和时序：Function；
- Fab/Process/Qualification：Quality/Reliability；
- Country、Capacity、Site：Supply；
- Marking：Manufacturing/Inspection；
- Rename：Identity。

---

# 11. PCN 风险等级

```text
critical
high
medium
low
informational
unknown
```

Critical 示例：

- Pinout 改变；
- Package 尺寸改变；
- Electrical Limits 改变；
- Die Revision 改变寄存器行为；
- 认证失效；
- EOL 且无替代。

High 示例：

- MSL/Reflow 变化；
- 关键材料变化；
- Automotive Qualification 变化；
- LTB 窗口短于采购周期。

缺少足够信息时：

```text
risk = unknown
review_required = true
```

---

# 12. Lifecycle Event Schema

```json
{
  "event_id": "uuid",
  "event_type": "product_discontinuation_notice",
  "event_number": "PCN-2026-00123",
  "title": "Product Discontinuation Notice",

  "publisher": {
    "manufacturer_id": "uuid",
    "publisher_name": "Example Semiconductor"
  },

  "dates": {
    "published_at": "2026-04-01",
    "effective_at": "2026-07-01",
    "last_time_buy_at": "2026-10-31",
    "last_time_ship_at": "2027-04-30"
  },

  "scope": {
    "affected_part_count": 240,
    "affected_entities_uri": "s3://..."
  },

  "change": {
    "categories": ["lifecycle", "supply"],
    "summary": "...",
    "before": {},
    "after": {}
  },

  "replacement": {
    "manufacturer_recommended_identifiers": [],
    "relationship_type": "recommended_replacement"
  },

  "evidence": {
    "source_document_id": "uuid",
    "document_sha256": "hex",
    "anchors": []
  },

  "quality": {
    "parse_confidence": 0.98,
    "part_mapping_coverage": 0.97,
    "review_required": true
  }
}
```

---

# 13. 受影响料号清单

通知可能通过：

- PDF 表格；
- XLSX/CSV 附件；
- HTML 表格；
- 邮件正文；
- Base Part；
- 完整 Ordering Code；
- 通配符；
- “all packages”；
- “selected packages”。

处理：

```text
Raw Notice
→ Affected Identifier Extraction
→ Raw Identifier Preservation
→ Agent 32 Resolution
→ Applicability
→ Affected Entity Set
```

未解析料号进入：

```text
unresolved_affected_identifiers
```

不能丢弃。

通配符必须受 Manufacturer、Family、Package 和 Notice Scope 限制，不能无边界展开。

---

# 14. Event Timeline

每个实体展示：

```text
2019 New Product
2020 Active
2024 Mature
2026 NRND
2027 EOL Announced
2027 Last-Time-Buy
2028 Last-Time-Ship
2029 Obsolete
```

每个节点显示：

- 来源；
- 文档；
- 适用 Variant；
- 生效日期；
- 证据；
- 企业处置；
- 置信度。

---

# 15. 厂商并购与品牌迁移

Manufacturer Graph 支持：

```text
acquired_by
merged_into
spun_off_as
business_unit_sold_to
brand_retained_by
product_line_transferred_to
website_migrated_to
publishes_pcn_for
```

每条关系保存：

```text
effective_from
effective_to
product_line_scope
evidence
status
```

历史 Datasheet 和历史 Manufacturer 不覆盖。

如果 MPN 不变，仅品牌/Owner 改变：

```text
identity_continuity = unknown/probable/verified
```

必须有证据才能合并主实体。

---

# 16. 料号变化关系

支持：

```text
renamed_to
rebranded_as
superseded_by
split_into
merged_into
package_code_changed
packing_code_changed
environmental_suffix_changed
customer_specific_code_changed
```

区别：

- Rename：身份通常连续；
- Superseded：被新器件取代，不一定兼容；
- Split：一个旧型号拆成多个；
- Merge：多个旧型号并入一个；
- Package/Packing Code Change：可能只影响 Ordering Variant；
- Replacement：必须由 Agent 33 验证兼容等级。

---

# 17. 产品暴露图

```text
Lifecycle Event
→ Part / Ordering Variant
→ Material
→ BOM Line
→ BOM Revision
→ Assembly
→ Product
→ Customer
→ Inventory
→ Purchase Order
→ Work Order
```

系统应回答：

- 哪些产品受影响；
- 哪些仍在开发、量产或售后；
- 哪些 BOM Revision 使用该料；
- 哪些库存和 PO 可用；
- 哪些产品已有批准替代；
- 哪些必须 LTB 或改版。

---

# 18. 产品阶段

```text
concept
development
prototype
pilot
mass_production
maintenance
service_only
end_of_support
archived
```

默认处置：

- Development：优先重新选型；
- Mass Production：替代验证或 LTB；
- Maintenance：结合剩余产量；
- Service-only：计算备件责任；
- Archived：记录，不主动采购。

---

# 19. 企业影响维度

## 设计

- 原理图/BOM；
- PCB/Footprint；
- Firmware；
- 认证；
- ECR/ECN。

## 采购

- Open PO；
- NCNR；
- Lead Time；
- MOQ；
- Supplier Confirmation；
- LTB。

## 库存

- On-hand；
- Available；
- Allocated；
- Quarantine；
- In-transit；
- Expiry/Date Code；
- Safety Stock。

## 生产

- Work Order；
- WIP；
- Planned Build；
- Alternate Approval；
- Qualification Lot。

---

# 20. 风险维度

```text
lifecycle_risk
supply_risk
design_risk
inventory_risk
financial_risk
customer_risk
data_quality_risk
```

使用：

```text
Hard Triggers
→ Risk Class
→ Dimension Scores
→ Enterprise Policy
```

Hard Trigger 示例：

- LTB 小于内部采购周期；
- 库存覆盖不足；
- 无批准替代；
- Safety Critical 产品；
- Pinout/Package 变化；
- 认证失效；
- PCN 实施日期临近。

---

# 21. LTB 需求计算

输入：

```text
production demand
service demand
yield/scrap
safety stock
risk buffer
usable inventory
confirmed open PO
approved inbound
product sunset
approved alternatives
```

计算：

```text
required =
  production_demand
  + service_demand
  + safety_stock
  + yield_loss
  + risk_buffer

available =
  usable_inventory
  + confirmed_open_po
  + approved_inbound

recommended_ltb =
  max(required - available, 0)
```

必须保存：

- Forecast Version；
- 时间窗口；
- 假设；
- 安全系数；
- Scenario；
- Currency。

输出：

```text
optimistic
base
pessimistic
```

不能只给一个看似精确的数字。

---

# 22. 库存覆盖与过量风险

输出：

```text
months_of_supply
coverage_until
shortfall_quantity
excess_quantity
excess_value
potential_write_off
service_reserve
transferable_quantity
```

不能将以下库存计入可用：

- Quarantine；
- Expired；
- 已分配；
- 不合格 Date Code；
- 不可用 Lot；
- 不符合客户认证的批次。

EOL 既可能导致缺货，也可能因为过度 LTB 导致呆滞库存。

---

# 23. Open PO 影响

检查：

- 可否取消/改量；
- 是否 NCNR；
- 供应商是否确认；
- 到货时间是否晚于 LTS；
- 是否有一次性 MOQ；
- 价格是否变化；
- Date Code 是否满足。

生成任务：

```text
confirm_supplier
expedite
increase_ltb
cancel_or_reduce
negotiate_return
request_date_code
secure_allocation
```

---

# 24. PCN 技术影响

按事件调用：

## Package/Pin/Dimension

- Footprint/3D；
- Pin Map；
- Agent 33 Form/Fit；
- PCB 暴露。

## Electrical Specification

- 参数 Diff；
- Application Context；
- Agent 33 Function。

## Fab/Process/Material

- Quality；
- Reliability；
- Qualification；
- Automotive/Medical 要求。

## Datasheet Revision

- 参数变化；
- Pin 描述变化；
- Recommended/Absolute Max 变化；
- Errata；
- 仅文档澄清。

## Marking

- Incoming Inspection；
- AOI；
- Warehouse Label；
- Counterfeit Detection；
- Work Instruction。

---

# 25. PCN 处置等级

```text
information_only
document_update
supplier_confirmation
engineering_review
quality_review
requalification_required
pcb_change_required
firmware_change_required
customer_notification_required
ltb_action_required
production_hold
```

一个事件可同时触发多个处置。

---

# 26. 企业使用状态

```text
approved_for_new_design
approved_for_existing_products
conditionally_approved
blocked_for_new_design
blocked_for_purchase
ltb_in_progress
service_only
disposition_required
retired
```

作用域：

```text
tenant
customer
project
assembly
revision
```

```json
{
  "decision_id": "uuid",
  "entity_id": "uuid",
  "scope": {
    "type": "assembly_revision",
    "tenant_id": "uuid",
    "assembly_part_number": "PCBA-001",
    "revision": "RevC"
  },
  "enterprise_usage_state": "approved_for_existing_products",
  "actions": [
    "block_new_design",
    "evaluate_alternative",
    "calculate_ltb"
  ],
  "reason_codes": [
    "manufacturer_nrnd",
    "no_verified_drop_in"
  ],
  "approved_by": "uuid",
  "valid_from": "ISO-8601",
  "valid_to": null
}
```

---

# 27. Evidence 与 Provenance

完整链路：

```text
Source URL/Email/File
→ Raw Snapshot
→ Parsed Observation
→ Canonical Event
→ Raw Affected Identifier
→ Agent 32 Part Resolution
→ Lifecycle State Resolution
→ Product Exposure
→ Inventory/PO Exposure
→ LTB/Risk Calculation
→ Enterprise Decision
```

字段级 Evidence：

```text
page
section
table
row
cell
bbox
raw text
attachment
URL
retrieval timestamp
snapshot hash
parser version
```

日期和受影响料号必须有字段级证据。

---

# 28. 来源冲突

示例：

```text
Manufacturer: Active
Distributor A: NRND
Distributor B: Obsolete
```

处理：

- 保留全部 Observation；
- 标记 Distributor-specific；
- 厂商状态优先；
- 供应风险独立评估；
- 严重冲突进入审核。

冲突类型：

```text
source_status_conflict
date_conflict
affected_part_conflict
replacement_conflict
manufacturer_identity_conflict
ordering_variant_scope_conflict
```

---

# 29. 新鲜度

保存：

```text
observed_at
retrieved_at
source_updated_at
freshness_ttl
stale_after
```

过期后：

```text
freshness_status = stale
```

高风险 Part 和 LTB 窗口中的 Part 高频刷新。

V1 不应输出未经校准的“预测 EOL 日期”，只输出：

```text
eol_risk_indicator
```

及其信号来源。

---

# 30. 告警

```text
new_pcn
new_eol
ltb_deadline_approaching
lts_deadline_approaching
status_changed
manufacturer_acquired
part_number_changed
replacement_announced
inventory_shortfall
inventory_excess
unresolved_affected_part
source_conflict
stale_lifecycle_data
```

按：

```text
event_id + entity_id + scope + action_type
```

去重。

LTB 可配置：

```text
90 / 60 / 30 / 7 天
```

升级提醒。

---

# 31. 人工审核台

布局：

```text
左侧：原通知、网页、邮件和附件
中间：事件、日期和受影响料号
右侧：产品、库存、PO、替代和 LTB
底部：证据、来源冲突、决策和任务
```

视图：

```text
Event Summary
Affected Parts
Timeline
PCN Difference
Product Exposure
Inventory Exposure
Open PO
Alternatives
LTB Scenarios
Actions
Evidence
```

操作：

- 修正事件类型和日期；
- 添加/移除受影响料号；
- 指定 Package/Variant；
- 标记重复或 Revision；
- 确认 Manufacturer/Part 关系；
- 调用替代评估；
- 创建 LTB；
- 创建 ECR/ECN；
- 设置企业使用状态；
- 关闭或升级告警。

---

# 32. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "lifecycle_event",
  "target_id": "uuid",
  "base_version": "machine-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/dates/last_time_buy_at",
      "old_value": "2026-10-31",
      "value": "2026-11-30"
    }
  ],
  "reason_code": "manual_notice_review",
  "reviewer_id": "uuid",
  "evidence_ids": []
}
```

机器原始事件不可变，Patch 生成 Resolved View。

---

# 33. 事件去重和 Revision

同一通知可能来自多个来源。

去重特征：

```text
manufacturer
event_number
title
publication_date
document_hash
affected_part_fingerprint
```

保存：

```text
event_cluster_id
source_instances
canonical_event
```

厂商修订通知：

```text
event_revision
supersedes_event_revision
```

不能覆盖旧版。

---

# 34. API

创建任务：

```text
POST /api/v1/lifecycle-intelligence/jobs
```

```json
{
  "source": {
    "type": "document_asset",
    "asset_id": "uuid"
  },
  "context": {
    "manufacturer_id": "uuid",
    "tenant_id": "uuid"
  },
  "options": {
    "parse_affected_parts": true,
    "resolve_part_numbers": true,
    "calculate_enterprise_impact": true,
    "evaluate_alternatives": true
  },
  "versions": {
    "policy": "lifecycle-1.0.0",
    "source_registry": "sources-1.0.0",
    "manufacturer_registry": "manufacturer-1.0.0",
    "part_index": "parts-2026-07",
    "impact_policy": "impact-1.0.0"
  },
  "idempotency_key": "uuid"
}
```

写接口：

```text
POST /api/v1/lifecycle-intelligence/jobs
POST /api/v1/lifecycle-intelligence/batches
POST /api/v1/lifecycle-intelligence/sources
POST /api/v1/lifecycle-intelligence/sources/{id}/refresh
POST /api/v1/lifecycle-intelligence/events/{id}/reparse
POST /api/v1/lifecycle-intelligence/events/{id}/recalculate-impact
POST /api/v1/lifecycle-intelligence/reviews/{id}/resolve
POST /api/v1/lifecycle-intelligence/decisions
POST /api/v1/lifecycle-intelligence/ltb-scenarios
POST /api/v1/lifecycle-intelligence/alerts/{id}/acknowledge
POST /api/v1/lifecycle-intelligence/alerts/{id}/close
```

读接口：

```text
GET /api/v1/lifecycle-intelligence/jobs/{id}
GET /api/v1/lifecycle-intelligence/jobs/{id}/events
GET /api/v1/lifecycle-intelligence/parts/{part_id}/status
GET /api/v1/lifecycle-intelligence/parts/{part_id}/timeline
GET /api/v1/lifecycle-intelligence/events/{event_id}
GET /api/v1/lifecycle-intelligence/events/{event_id}/affected-parts
GET /api/v1/lifecycle-intelligence/events/{event_id}/impact
GET /api/v1/lifecycle-intelligence/products/{product_id}/exposure
GET /api/v1/lifecycle-intelligence/boms/{bom_id}/risk
GET /api/v1/lifecycle-intelligence/inventory/exposure
GET /api/v1/lifecycle-intelligence/ltb-scenarios/{id}
GET /api/v1/lifecycle-intelligence/alerts
GET /api/v1/lifecycle-intelligence/reviews
GET /health/live
GET /health/ready
GET /metrics
```

---

# 35. 状态机

```text
RECEIVED
→ LOADING_SOURCE
→ VERIFYING_SOURCE
→ EXTRACTING_DOCUMENT
→ CLASSIFYING_NOTICE
→ PARSING_DATES
→ PARSING_CHANGE_DETAILS
→ EXTRACTING_AFFECTED_IDENTIFIERS
→ RESOLVING_PARTS
→ BUILDING_EVENT
→ DEDUPLICATING_EVENT
→ RESOLVING_LIFECYCLE_STATE
→ UPDATING_RELATIONSHIP_GRAPH
→ CALCULATING_PRODUCT_EXPOSURE
→ CALCULATING_INVENTORY_EXPOSURE
→ CALCULATING_PURCHASE_EXPOSURE
→ EVALUATING_ALTERNATIVES
→ GENERATING_RISKS
→ GENERATING_ACTIONS
→ CREATING_ALERTS
→ CREATING_REVIEWS
→ STORING_RESULTS
→ COMPLETED
```

分支：

```text
REVIEW_REQUIRED
SOURCE_UNAVAILABLE
DOCUMENT_UNSUPPORTED
PART_RESOLUTION_INCOMPLETE
IMPACT_DATA_INCOMPLETE
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 36. 错误码

```text
SOURCE_NOT_FOUND
SOURCE_UNAUTHORIZED
SOURCE_DOWNLOAD_FAILED
SOURCE_DOCUMENT_INVALID
NOTICE_TYPE_UNKNOWN
NOTICE_DUPLICATE
NOTICE_REVISION_CONFLICT
DATE_PARSE_FAILED
LTB_DATE_MISSING
LTS_DATE_MISSING
AFFECTED_PARTS_NOT_FOUND
AFFECTED_PART_RESOLUTION_FAILED
AFFECTED_SCOPE_AMBIGUOUS
MANUFACTURER_UNRESOLVED
MANUFACTURER_RELATION_CONFLICT
PART_NUMBER_CHANGE_AMBIGUOUS
REPLACEMENT_RELATION_AMBIGUOUS
LIFECYCLE_SOURCE_CONFLICT
LIFECYCLE_STATE_UNKNOWN
PRODUCT_EXPOSURE_INCOMPLETE
INVENTORY_DATA_INCOMPLETE
FORECAST_DATA_INCOMPLETE
LTB_CALCULATION_FAILED
NO_APPROVED_ALTERNATIVE
PCN_TECHNICAL_REVIEW_REQUIRED
CERTIFICATION_REVIEW_REQUIRED
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 37. 数据库

## `lifecycle_observations`

```text
id UUID PK
entity_type VARCHAR NOT NULL
entity_id UUID NOT NULL
source_id UUID NOT NULL
source_document_id UUID NULL
raw_status_text TEXT NULL
normalized_status VARCHAR NOT NULL
observed_at TIMESTAMPTZ NOT NULL
source_updated_at TIMESTAMPTZ NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
confidence NUMERIC(5,4)
evidence_bundle_id UUID NULL
parser_version VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## `lifecycle_current_states`

```text
entity_type VARCHAR NOT NULL
entity_id UUID NOT NULL
resolved_status VARCHAR NOT NULL
as_of TIMESTAMPTZ NOT NULL
confidence NUMERIC(5,4)
selected_observation_ids JSONB NOT NULL
conflicting_observation_ids JSONB NOT NULL
policy_version VARCHAR NOT NULL
review_required BOOLEAN NOT NULL
updated_at TIMESTAMPTZ
PRIMARY KEY(entity_type, entity_id)
```

## `lifecycle_events`

```text
id UUID PK
event_cluster_id UUID NOT NULL
event_revision INT NOT NULL
event_type VARCHAR NOT NULL
event_number VARCHAR NULL
manufacturer_id UUID NULL
title TEXT NOT NULL
published_at TIMESTAMPTZ NULL
effective_at TIMESTAMPTZ NULL
last_time_buy_at TIMESTAMPTZ NULL
last_time_ship_at TIMESTAMPTZ NULL
source_document_id UUID NOT NULL
document_sha256 CHAR(64) NOT NULL
change_categories JSONB NOT NULL
summary TEXT NULL
parse_confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(event_cluster_id, event_revision)
```

## `lifecycle_event_entities`

```text
id UUID PK
event_id UUID NOT NULL
entity_type VARCHAR NOT NULL
entity_id UUID NULL
raw_identifier TEXT NOT NULL
manufacturer_id UUID NULL
applicability JSONB NOT NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4)
evidence JSONB NOT NULL
```

## `manufacturer_relationships`

```text
id UUID PK
source_manufacturer_id UUID NOT NULL
target_manufacturer_id UUID NOT NULL
relationship_type VARCHAR NOT NULL
product_line_id UUID NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
evidence_bundle_id UUID NULL
created_at TIMESTAMPTZ
```

## `part_number_relationships`

```text
id UUID PK
source_entity_type VARCHAR NOT NULL
source_entity_id UUID NOT NULL
target_entity_type VARCHAR NOT NULL
target_entity_id UUID NOT NULL
relationship_type VARCHAR NOT NULL
direction VARCHAR NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
technical_validation_status VARCHAR NOT NULL
alternative_relationship_id UUID NULL
evidence_bundle_id UUID NULL
created_at TIMESTAMPTZ
```

## `lifecycle_impact_results`

```text
id UUID PK
event_id UUID NOT NULL
tenant_id UUID NOT NULL
impact_scope_hash CHAR(64) NOT NULL
affected_products INT NOT NULL
affected_boms INT NOT NULL
affected_lines INT NOT NULL
on_hand_quantity NUMERIC NULL
inventory_value NUMERIC NULL
open_po_quantity NUMERIC NULL
forecast_demand NUMERIC NULL
shortfall_quantity NUMERIC NULL
excess_quantity NUMERIC NULL
risk_summary JSONB NOT NULL
action_summary JSONB NOT NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## `lifecycle_decisions`

```text
id UUID PK
entity_type VARCHAR NOT NULL
entity_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
enterprise_usage_state VARCHAR NOT NULL
actions JSONB NOT NULL
reason_codes JSONB NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_by UUID NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
```

## `ltb_scenarios`

```text
id UUID PK
event_id UUID NOT NULL
part_id UUID NOT NULL
tenant_id UUID NOT NULL
scenario_name VARCHAR NOT NULL
forecast_version VARCHAR NOT NULL
assumptions JSONB NOT NULL
production_demand NUMERIC NOT NULL
service_demand NUMERIC NOT NULL
safety_stock NUMERIC NOT NULL
yield_loss NUMERIC NOT NULL
risk_buffer NUMERIC NOT NULL
usable_inventory NUMERIC NOT NULL
confirmed_open_po NUMERIC NOT NULL
recommended_ltb_quantity NUMERIC NOT NULL
estimated_value NUMERIC NULL
currency VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## `lifecycle_alerts`

```text
id UUID PK
tenant_id UUID NOT NULL
alert_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
entity_type VARCHAR NOT NULL
entity_id UUID NOT NULL
event_id UUID NULL
scope JSONB NOT NULL
dedupe_key CHAR(64) NOT NULL
status VARCHAR NOT NULL
due_at TIMESTAMPTZ NULL
payload JSONB NOT NULL
created_at TIMESTAMPTZ
acknowledged_at TIMESTAMPTZ NULL
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, dedupe_key)
```


---

# 38. 对象存储

```text
derived/lifecycle-intelligence/
  {manufacturer_id}/
    sources/
      snapshots/
    events/
      {event_cluster_id}/
        revision-{n}/
          source/
          parsed/
            event.json
            dates.json
            affected-identifiers.json.zst
            change-details.json
          resolution/
            affected-entities.json.zst
            unresolved-identifiers.json
          impact/
            product-exposure.json.zst
            inventory-exposure.json
            purchase-exposure.json
            alternative-status.json
          decisions/
            risk-report.json
            action-plan.json
            ltb-scenarios.json
          evidence/
            evidence-manifest.json
            crops/
          reviews/
            review-items.json
          debug/
            parser-log.json
            state-resolution-log.json
            dedupe-log.json
```

---

# 39. 事件与消息

## 输入事件

```text
asset.uploaded
email.attachment.received
supplier.notice.received
manufacturer.source.changed
part.lifecycle.refresh.requested
```

## 输出事件

```text
component.lifecycle.changed
component.pcn.received
component.eol.announced
component.ltb.deadline
component.part-number.changed
manufacturer.relationship.changed
product.lifecycle-impact.ready
inventory.lifecycle-risk.ready
lifecycle.review.required
```

## `product.lifecycle-impact.ready`

```json
{
  "event_type": "product.lifecycle-impact.ready",
  "event_version": "1.0",
  "lifecycle_event_id": "uuid",
  "tenant_id": "uuid",
  "impact_result_uri": "s3://.../impact.json",

  "summary": {
    "affected_parts": 28,
    "affected_products": 12,
    "affected_boms": 19,
    "affected_bom_lines": 47,
    "inventory_shortfall_parts": 5,
    "inventory_excess_parts": 3,
    "parts_without_approved_alternative": 8,
    "ltb_action_required": 6
  },

  "risk": {
    "overall": "high",
    "critical_products": 2
  },

  "review_status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 40. 配置和策略

```text
policies/
├── lifecycle-1.0.0.yaml
├── source-authority.yaml
├── status-normalization.yaml
├── event-classification.yaml
├── event-deduplication.yaml
├── impact-assessment.yaml
├── ltb-calculation.yaml
├── alerts.yaml
├── review.yaml
├── certification-impact.yaml
├── category-impact/
│   ├── semiconductor.yaml
│   ├── passive.yaml
│   ├── connector.yaml
│   ├── module.yaml
│   └── mechanical.yaml
└── enterprise/
    └── tenant-specific/
```

状态映射按来源配置：

```yaml
source: manufacturer_example

raw_statuses:
  "Active":
    normalized: active

  "NRND":
    normalized: nrnd

  "Not Recommended for New Designs":
    normalized: nrnd

  "Last Time Buy":
    normalized: last_time_buy

  "Discontinued":
    normalized: discontinued
```

不能使用单一全局 Alias 覆盖所有来源。

---

# 41. Manufacturer Parser Profile

按厂商保存：

```text
product status selector
PCN page pattern
event number pattern
date labels
affected part table columns
replacement columns
implementation labels
attachment naming
language
time zone
product-line scope
```

Profile 用于确定性解析，不应把页面结构写死在业务代码中。

---

# 42. PCN 技术影响联动

## 42.1 Package、Pin 和尺寸变化

调用或复用：

- Agent 9 Footprint/3D 数据；
- Agent 33 Form/Fit Comparator；
- PCB/BOM 暴露图。

## 42.2 Electrical Specification 变化

调用：

- Agent 5 参数事实；
- Application Context；
- Agent 33 Function Comparator。

## 42.3 Datasheet Revision

生成结构化 Diff：

```text
added parameter
removed parameter
min/max changed
test condition changed
pin description changed
absolute maximum changed
recommended range changed
errata added
documentation-only
```

## 42.4 Quality/Process

检查：

- Qualification；
- Automotive；
- Reliability；
- PPAP；
- Customer Notification；
- Existing Validation Scope。

---

# 43. 处置建议模型

每项 Action 保存：

```text
action_type
owner_role
severity
due_date
blocking
scope
reason
evidence
status
```

常见 Action：

```text
block_new_design
confirm_supplier
review_pcn
evaluate_alternative
create_ecr
create_ecn
calculate_ltb
place_ltb_order
update_avl
update_bom
update_work_instruction
update_incoming_inspection
run_requalification
notify_customer
hold_production
consume_existing_inventory
reduce_open_po
secure_service_stock
```

---

# 44. 自动批准与强制审核

## 可自动批准

- 官方状态页面明确且唯一；
- 正式通知事件号和日期解析完整；
- 受影响 Ordering Code 全部精确匹配；
- 无来源冲突；
- 仅信息性 Marking/Label 变更；
- 企业策略允许自动记录。

## 强制审核

- EOL/PDN；
- LTB/LTS；
- 受影响料号未完全解析；
- 通配符或 Family Scope；
- Package-only 与 Base Part 范围不明；
- Replacement 关系；
- Pin/Package/Spec 变化；
- 认证或质量变化；
- 厂商并购或产品线转移；
- LTB 金额超过阈值；
- Safety Critical 产品；
- 来源冲突；
- 日期冲突；
- Revision Notice。

---

# 45. 可观测性

## Prometheus

```text
lifecycle_jobs_total{status,source_type}
lifecycle_source_refresh_total{source,result}
lifecycle_observations_total{status,source}
lifecycle_events_total{type,manufacturer}
lifecycle_event_duplicates_total
lifecycle_affected_identifiers_total{resolution_status}
lifecycle_state_changes_total{from,to}
lifecycle_source_conflicts_total{type}
lifecycle_impact_products_total{risk}
lifecycle_inventory_shortfall_total
lifecycle_inventory_excess_total
lifecycle_ltb_scenarios_total{status}
lifecycle_alerts_total{type,severity}
lifecycle_reviews_total{reason}
lifecycle_cache_hits_total{stage}
```

## Dashboard

- Active/NRND/EOL/Obsolete 分布；
- 新增 PCN/EOL；
- 临近 LTB/LTS；
- 未解析料号；
- 受影响产品；
- 无替代产品；
- 库存缺口；
- 库存过量；
- Open PO 风险；
- 来源冲突；
- 过期生命周期数据；
- 厂商并购和料号迁移；
- 企业处置积压。

---

# 46. Benchmark

## 生命周期状态

- Status Mapping Accuracy；
- Current State Resolution Accuracy；
- Status Change Detection Precision/Recall；
- Source Conflict Detection；
- Stale Data Detection。

## 事件解析

- Notice Type Accuracy；
- Event Number Accuracy；
- Publication Date Accuracy；
- Effective Date Accuracy；
- LTB/LTS Date Accuracy；
- Event Deduplication Precision/Recall。

## 受影响料号

- Identifier Extraction Precision/Recall；
- Agent 32 Resolution Coverage；
- Base/Package/Ordering Applicability Accuracy；
- False Expansion Rate；
- Unresolved Recall。

## PCN 影响

- Change Category Macro F1；
- FFF Impact Classification；
- Risk Severity Accuracy；
- Requalification Requirement Accuracy。

## 企业影响

- Product Exposure Recall；
- BOM Line Exposure Accuracy；
- Inventory Quantity Accuracy；
- Open PO Exposure Accuracy；
- Alternative Availability Accuracy；
- Action Recommendation Acceptance。

## LTB

- Demand Aggregation Accuracy；
- Inventory Availability Accuracy；
- Scenario Reproducibility；
- Human Adjustment Rate；
- Excess/Shortfall Accuracy。

---

# 47. 初始质量目标

```text
Official Lifecycle Status Accuracy >= 99%
PCN/EOL Event Type Accuracy >= 98%
Publication/LTB/LTS Date Accuracy >= 99%
Affected Identifier Extraction F1 >= 98%
Affected Entity Resolution Coverage >= 98%
Event Deduplication Precision >= 99%
Product Exposure Recall >= 99%
BOM Line Exposure Accuracy >= 99%
Inventory Exposure Accuracy >= 99%
Critical PCN Risk Recall >= 99%
High-confidence Auto Approval Accuracy >= 99%
Evidence Completeness >= 99%
```

扫描件、邮件和低质量附件必须单独报告。

这些是目标，不是未经测试的保证。

---

# 48. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## 状态

1. Active；
2. Preferred；
3. Mature；
4. NRND；
5. EOL Announced；
6. Last-Time-Buy；
7. Discontinued；
8. Obsolete；
9. Unknown；
10. Distributor Conflict。

## 日期

11. Publication；
12. Effective；
13. LTB；
14. LTS；
15. Missing Date；
16. Multiple Formats；
17. Time Zone；
18. Revised Notice；
19. Date Conflict；
20. Past Deadline。

## 料号

21. Exact MPN；
22. Base Part；
23. Ordering Variant；
24. Packing-only EOL；
25. Package-only EOL；
26. Wildcard；
27. Prefix；
28. Range；
29. XLSX List；
30. PDF List；
31. HTML Table；
32. Unresolved MPN；
33. Multiple Manufacturer；
34. Customer-specific Code；
35. 50,000 Identifiers。

## PCN

36. Fab Change；
37. Assembly Site；
38. Test Site；
39. Material；
40. Lead Finish；
41. Package；
42. Marking；
43. Die Revision；
44. Datasheet Spec；
45. Country of Origin；
46. Qualification；
47. Reflow/MSL；
48. Documentation-only；
49. Multi-category；
50. Unknown Change。

## 公司和料号关系

51. Acquisition；
52. Merger；
53. Spin-off；
54. Business Unit Sale；
55. Brand Retained；
56. Website Migration；
57. Rename；
58. Superseded；
59. Split；
60. Merge；
61. MPN Unchanged；
62. MPN Changed；
63. Official Replacement；
64. Similar Product；
65. Historical Alias。

## 企业影响

66. Development Product；
67. Mass Production；
68. Service-only；
69. Multiple BOM Revisions；
70. DNP Line；
71. Approved Alternative；
72. No Alternative；
73. Open PO；
74. NCNR；
75. In-transit；
76. Quarantine Stock；
77. Date-code Issue；
78. Inventory Shortfall；
79. Inventory Excess；
80. Service Demand；
81. Product Sunset；
82. Critical Customer；
83. Safety Critical；
84. Requalification；
85. Customer Notification。

## 安全和异常

86. Duplicate Notice；
87. Revised Notice；
88. Broken PDF；
89. Password PDF；
90. Email Attachment；
91. SSRF URL；
92. Huge Part List；
93. Source Unavailable；
94. Stale Observation；
95. Conflicting Sources；
96. Manual Patch；
97. Alert Deduplication；
98. LTB Scenario；
99. Event Rollback；
100. Agent 32 Re-resolution。

---

# 49. 性能要求

## 单事件

```text
状态页解析 P95 < 5 s
PCN 文档解析 P95 < 30 s
```

不含外部网络和 OCR。

## 大型通知

```text
50,000 affected identifiers
```

必须：

- 流式处理；
- 批量调用 Agent 32；
- 分块对象存储；
- 不把完整列表放进单条 JSONB。

## 企业暴露

针对百万 BOM Line：

- 建立 Part/Material → BOM Line 反向索引；
- 增量更新；
- 按租户计算；
- 避免每次全表扫描。

---

# 50. 缓存和增量

缓存键：

```text
source_document_hash
+ parser_profile_version
+ event_policy_version
+ manufacturer_registry_version
+ part_index_version
+ impact_policy_version
+ enterprise_data_snapshot
```

更新策略：

- Source 未变化：不重复解析；
- Agent 32 更新：只重跑未解析 Identifier；
- BOM 更新：只重跑相关 Exposure；
- Inventory 更新：只重跑库存和 LTB；
- Agent 33 更新：只重跑 Alternative Availability；
- Policy 更新：重放已保存 Observation/Event，不重新下载。

---

# 51. 安全和权限

- 公共生命周期事实与企业私有影响分开；
- BOM、库存、Forecast、价格严格租户隔离；
- Email/Portal 凭据服务端保存；
- URL 抓取做 SSRF 防护；
- PDF/Excel/ZIP 做大小、宏和压缩炸弹限制；
- 不执行宏和外部链接；
- Evidence 使用签名 URL；
- LTB 金额和 Forecast 按权限访问；
- Safety Critical 支持双人审核；
- 企业 Decision 不改写全局厂商事实；
- 不把私有 BOM、库存和 Forecast 发送给外部通用模型。

---

# 52. 推荐技术栈

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
Neo4j 或 PostgreSQL 关系图
Email Connector
Manufacturer-specific Crawlers
```

V1 推荐：

```text
PostgreSQL 状态和事件
+ OpenSearch 通知与 MPN 索引
+ Object Storage 原文和大型清单
+ Rule-based Event/Impact Engine
```

---

# 53. 推荐仓库结构

```text
lifecycle-intelligence-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── lifecycle-intelligence-agent-spec.md
│   ├── lifecycle-state-model.md
│   ├── source-registry.md
│   ├── pcn-eol-event-model.md
│   ├── manufacturer-relationship-model.md
│   ├── part-number-change-model.md
│   ├── product-exposure.md
│   ├── inventory-and-ltb.md
│   ├── evidence-and-review.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-observation-history-not-single-status.md
│       ├── 0002-part-and-ordering-variant-separation.md
│       ├── 0003-official-fact-vs-enterprise-decision.md
│       ├── 0004-event-time-fields-separated.md
│       └── 0005-no-default-active-for-missing-data.md
├── src/
│   └── lifecycle_intelligence/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── observation.py
│       │   ├── state.py
│       │   ├── event.py
│       │   ├── applicability.py
│       │   ├── impact.py
│       │   ├── decision.py
│       │   ├── alert.py
│       │   └── evidence.py
│       ├── events/
│       ├── jobs/
│       ├── sources/
│       │   ├── registry.py
│       │   ├── fetcher.py
│       │   ├── snapshot.py
│       │   ├── health.py
│       │   └── adapters/
│       ├── parsing/
│       │   ├── notice_classifier.py
│       │   ├── dates.py
│       │   ├── affected_parts.py
│       │   ├── changes.py
│       │   ├── replacements.py
│       │   ├── html.py
│       │   ├── pdf.py
│       │   ├── email.py
│       │   └── attachments.py
│       ├── lifecycle/
│       │   ├── normalization.py
│       │   ├── resolver.py
│       │   ├── conflicts.py
│       │   ├── freshness.py
│       │   └── timeline.py
│       ├── relationships/
│       │   ├── manufacturer.py
│       │   ├── part_number.py
│       │   ├── dedupe.py
│       │   └── graph.py
│       ├── applicability/
│       │   ├── resolver.py
│       │   ├── wildcard.py
│       │   ├── variants.py
│       │   └── agent32_adapter.py
│       ├── impact/
│       │   ├── exposure_graph.py
│       │   ├── products.py
│       │   ├── boms.py
│       │   ├── inventory.py
│       │   ├── purchase_orders.py
│       │   ├── production.py
│       │   ├── alternatives.py
│       │   ├── risk.py
│       │   └── actions.py
│       ├── ltb/
│       │   ├── demand.py
│       │   ├── inventory.py
│       │   ├── scenarios.py
│       │   ├── uncertainty.py
│       │   └── recommendations.py
│       ├── alerts/
│       │   ├── policies.py
│       │   ├── dedupe.py
│       │   ├── escalation.py
│       │   └── delivery.py
│       ├── evidence/
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── source-profiles/
├── manufacturer-registry/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
```

---

# 54. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察和数据盘点

- Agent 31/32/33 契约；
- Part、Manufacturer、Ordering Variant；
- Lifecycle 字段；
- PCN/EOL 文档和邮件；
- Manufacturer/Part 关系；
- BOM/Product/Revision；
- Inventory、PO、Forecast；
- ECR/ECN、Alert；
- 数据覆盖、冲突、新鲜度；
- 不改代码、不迁移、不安装依赖。

## Phase 1：Domain Model 和 JSON Schema

实现 Observation、Current State、Event、Dates、Affected Identifier、Applicability、Relationship、Impact、Decision、Alert、LTB Scenario。

## Phase 2：Source Registry 和 Snapshot

实现来源权威、Adapter、Hash、ETag、Freshness、Health、安全和不可变 Snapshot。

## Phase 3：状态标准化

实现来源特定 Alias、Observation、Freshness、Conflict、Current State Resolver、Timeline。

## Phase 4：PCN/EOL 文档解析

实现 Notice Type、Event Number、Dates、Change Category、PDF/HTML/Email、Evidence。

## Phase 5：受影响料号解析

实现表格、附件、Wildcard、Base/Variant、Agent 32 Adapter、Unresolved、Applicability。

## Phase 6：事件去重和 Revision

实现 Cluster、Fingerprint、Source Instances、Revision 和 Supersedes。

## Phase 7：Manufacturer 并购和品牌关系

实现 Acquisition、Merger、Spin-off、Product Line Transfer、Website Migration、时间范围和证据。

## Phase 8：料号变化关系

实现 Rename、Rebrand、Superseded、Split/Merge、Package/Packing Change 和 Agent 33 Hook。

## Phase 9：Product/BOM Exposure

实现 Part → Material → BOM Line → Revision → Product → Customer，并处理 DNP、Variant、Product Phase。

## Phase 10：Inventory 和 PO Exposure

实现 On-hand、Allocated、Quarantine、In-transit、Open PO、NCNR、Shortfall 和 Excess。

## Phase 11：LTB Scenario

实现 Forecast、Service Demand、Yield、Safety Stock、Inventory、PO、三种 Scenario 和推荐量。

## Phase 12：PCN 技术影响

实现 FFF 分类、Package/Pin、Parameter Diff、Qualification、Marking 和 Agent 33 Adapter。

## Phase 13：Risk、Decision 和 Actions

实现 Risk Dimensions、Hard Trigger、Enterprise Usage State、作用域、批准和过期。

## Phase 14：Alerts

实现 PCN/EOL、LTB/LTS、Status Change、Exposure、去重、升级、确认和关闭。

## Phase 15：Review 和 Patch

实现 Event、Date、Affected Part、Manufacturer/Part Relation、Impact、Decision、Patch 和 Audit。

## Phase 16：API、Events、Batch 和 Cache

实现 API、Job、Batch、Retry/Cancel、事件、缓存、幂等和对象存储。

## Phase 17：Benchmark、监控和生产发布

实现 Benchmark、Metrics、Dashboard、Source Health、安全、部署、灾备和策略回滚。

---

# 55. Codex 工作纪律

Codex 必须：

1. 生命周期不是单一字段；
2. Observation History 不可覆盖；
3. Part 与 Ordering Variant 分开；
4. Official Fact 与 Enterprise Decision 分开；
5. Publication/Effective/LTB/LTS 分开；
6. Distributor 不能覆盖 Manufacturer；
7. Unknown 不能默认 Active；
8. Replacement/Rename/Superseded/Alternative 分开；
9. Manufacturer Relation 有时间区间；
10. 历史 Manufacturer 不覆盖；
11. Raw Affected Identifier 不丢；
12. Wildcard 受范围限制；
13. 去重但保留 Source Instances；
14. Revision 不覆盖旧版；
15. PCN 的 FFF/Quality/Supply 分开；
16. 不自行宣称 Drop-in；
17. Exposure 按 BOM Revision 和 Variant；
18. 可用库存排除 Quarantine/Expired；
19. LTB 保留 Scenario、Forecast 和 Assumptions；
20. 同时计算 Shortfall 和 Excess；
21. 价格库存不改变生命周期事实；
22. Enterprise Decision 有 Scope 和有效期；
23. Patch 不覆盖机器事件；
24. Source Snapshot 不可变；
25. LLM 仅受控文档分类和结构化提取；
26. 不发送私有 BOM、库存、Forecast 到外部模型；
27. 不使用客户真实数据公开测试；
28. 不伪造来源、日期和准确率；
29. 每个 Phase 输出修改文件、Schema/API、Policy、测试、Benchmark、性能、安全、已知问题和下一阶段。

---

# 56. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/lifecycle-intelligence-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第34个 Agent：

Component Lifecycle, EOL & PCN Intelligence Agent。

本 Agent 负责：

- 跟踪 Active、Preferred、Mature、NRND、EOL、LTB、Discontinued 和 Obsolete；
- 接入 Manufacturer 产品页、PCN/PDN/EOL 通知、授权分销商和企业供应商通知；
- 保存 Lifecycle Observation 历史；
- 解析 PCN/EOL 事件、日期、变更内容和受影响料号；
- 区分 Base Part、Package Variant、Ordering Variant 和 Supplier SKU；
- 跟踪厂商并购、品牌迁移、产品线转移和料号变更；
- 建立 Part/Manufacturer 关系图；
- 计算受影响 BOM、产品、库存、采购订单和生产计划；
- 计算 LTB、库存缺口、库存过量和资金风险；
- 调用 Agent 33 评估替代可用性；
- 生成工程、采购、质量和库存处置建议；
- 创建告警、审核和企业使用决策；
- 发布 product.lifecycle-impact.ready。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31、32、33 的规格和实际代码；
3. docs/lifecycle-intelligence-agent-spec.md；
4. 当前 Part、Manufacturer、Ordering Variant、Package 和 Lifecycle 数据表；
5. 当前 PCN/EOL/PDN 文档、邮件、附件和来源；
6. 当前 BOM、Product、Project、Material、Inventory、PO、Forecast、Work Order；
7. 当前替代料、AVL、ECR/ECN、认证和质量模块；
8. 当前对象存储、队列、权限、审核、日志、Docker 和 CI；
9. 脱敏或合成 Lifecycle Fixture。

硬约束：

- 生命周期不能只保存一个当前字段；
- Observation 历史不可覆盖；
- Part 与 Ordering Variant 分开；
- Manufacturer 事实与企业使用状态分开；
- Publication、Effective、LTB、LTS 日期分开；
- Distributor 状态不能覆盖 Manufacturer；
- Unknown 不能默认 Active；
- Manufacturer Official Notice 优先；
- Replacement、Rename、Superseded、Alternative 分开；
- 厂商并购和品牌关系保存时间区间；
- 历史 Manufacturer 和 Datasheet 不覆盖；
- 受影响料号保留原始值和 Evidence；
- 无法解析料号不能丢；
- Wildcard 受 Manufacturer/Family/Scope 限制；
- Event 去重但保留 Source Instances；
- Revised Notice 不覆盖旧 Revision；
- PCN 的 Form/Fit/Function/Quality/Supply 分开；
- Manufacturer Recommended Replacement 不自动当 Drop-in；
- Product Exposure 按 BOM Revision、Variant 和 Product Phase；
- Inventory Available 排除 Quarantine、Expired 和不可用库存；
- LTB 使用 Forecast Version、Scenario 和 Assumptions；
- 计算 Shortfall，也计算 Excess 和 Write-off Risk；
- 供应链价格不能改变生命周期事实；
- Enterprise Decision 有 Scope、Revision 和有效期；
- 人工 Patch 不覆盖机器事件；
- LLM 只允许受控文档分类和结构化提取；
- 不把私有 BOM、库存和 Forecast 发给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造来源、日期、测试和准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31、32、33 的真实完成程度和接口；
3. 查找 Manufacturer、Part、Ordering Variant 和现有 Lifecycle 字段；
4. 查找 PCN/EOL/PDN 文档、邮件和来源；
5. 查找 Manufacturer 并购、Alias、Brand 和历史关系；
6. 查找 Part Rename、Superseded、Replacement 和 Alternate；
7. 查找 BOM、Product、Material 和 Revision 关系；
8. 查找 Inventory、Allocation、Quarantine、In-transit 和 Date Code；
9. 查找 PO、Supplier Confirmation、NCNR 和 Lead Time；
10. 查找 Forecast、Service Demand、Product Phase 和 Sunset；
11. 查找 ECR/ECN、Quality、Certification 和 Alert；
12. 统计当前生命周期数据覆盖、重复、冲突和新鲜度；
13. 抽样分析脱敏或合成 PCN/EOL Fixture；
14. 在 docs/lifecycle-intelligence-implementation-plan.md 中生成实施计划；
15. 在 docs/lifecycle-state-model.md 中定义 Observation/Current State；
16. 在 docs/lifecycle-source-registry.md 中定义来源；
17. 在 docs/pcn-eol-event-model.md 中定义事件、日期和影响；
18. 在 docs/manufacturer-part-relationship-design.md 中定义并购和料号关系；
19. 在 docs/lifecycle-product-exposure-design.md 中定义产品/BOM 影响；
20. 在 docs/lifecycle-inventory-ltb-design.md 中定义库存和 LTB；
21. 在 docs/lifecycle-alert-review-design.md 中定义告警和审核；
22. 在 docs/lifecycle-migration-plan.md 中定义旧数据迁移；
23. 在 docs/lifecycle-benchmark-plan.md 中定义 Benchmark；
24. 给出拟新增、拟修改和拟复用文件；
25. 给出 Phase 1 精确范围；
26. 不修改业务代码；
27. 不创建数据库 Migration；
28. 不安装依赖；
29. 运行当前仓库已有 lint、type check、test 和 build；
30. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31/32/33 输入契约；
- 当前 Lifecycle 数据；
- Source Registry；
- Lifecycle State Model；
- PCN/EOL Event；
- Date Model；
- Affected Part Resolution；
- Manufacturer/Part Relationship；
- Event Deduplication；
- Product/BOM Exposure；
- Inventory/PO Exposure；
- LTB Scenario；
- Risk/Action；
- Alerts/Review；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 57. 后续 Phase 提示词模板

```text
继续实现 Lifecycle Intelligence Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31、32、33、34 规格；
3. 阅读 Lifecycle Implementation Plan；
4. 阅读 State、Source、Event、Relationship、Exposure、LTB 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Observation History；
- Part/Ordering Variant 分离；
- Official Fact/Enterprise Decision 分离；
- Dates 分离；
- Source Authority；
- Unknown 非 Active；
- Event Revision；
- Raw Affected Identifier；
- Exposure 按 Revision/Variant；
- Inventory Availability 准确；
- LTB Scenario 可重放；
- Shortfall/Excess 都计算；
- Evidence/Version 完整；
- 不覆盖人工 Patch；
- LLM 受控使用；
- 不公开客户真实数据；
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
- Source/Profile/Policy 变化；
- 测试命令和真实结果；
- Event/Status 指标；
- Exposure/LTB 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 58. MVP 演示流程

1. 接入 Manufacturer 产品页并保存 Active Observation；
2. 接入 Distributor NRND，保留冲突但不覆盖；
3. 上传 EOL PDF；
4. 识别 Event Number、Publication、LTB 和 LTS；
5. 提取 500 个 Ordering Code；
6. 调用 Agent 32；
7. 10 个未解析进入审核；
8. 建立 EOL Event；
9. 仅更新相关 Ordering Variant；
10. Base Part 其他封装仍 Active；
11. 计算受影响 BOM 和产品阶段；
12. 读取库存、Open PO 和 Forecast；
13. 计算 Shortfall、Excess；
14. 创建三种 LTB Scenario；
15. 检查 Agent 33 替代；
16. 有 Drop-in 的产品生成替代任务；
17. 无替代产品生成 LTB/改版任务；
18. 上传 Assembly Site + Lead Finish PCN；
19. 触发 Quality Review；
20. 上传厂商并购公告；
21. 建立 Manufacturer Relationship；
22. 上传料号 Rename 通知；
23. 建立 Part Number Relationship；
24. 不把 Recommended Replacement 当 Drop-in；
25. 人工审核并发布 `product.lifecycle-impact.ready`。

---

# 59. 生产上线顺序

第一阶段：

```text
Manufacturer 产品状态
PCN/EOL PDF 上传
状态历史
日期解析
受影响 MPN
Agent 32 映射
BOM/Product Exposure
库存和 Open PO
基础告警和审核
```

第二阶段：

```text
自动 Source Refresh
Email 接入
Event 去重
Manufacturer 并购
Part Rename
LTB Scenario
Agent 33 联动
```

第三阶段：

```text
复杂 PCN 技术影响
Forecast 不确定性
企业 Decision Policy
多渠道通知
生命周期风险指标
学习与校准
```

上线时优先解决：

```text
官方停产通知
→ 精确 Ordering Variant
→ 企业正在使用的 BOM 和产品
→ 库存/PO/LTB
```

宁可多进入审核，也不能把包装级停产错误扩大成整个产品系列停产，或漏掉即将到期的 Last-Time-Buy。
