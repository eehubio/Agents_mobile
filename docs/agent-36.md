# 实时价格与库存 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：36  
> Agent 名称：Authorized Distributor Pricing & Availability Agent  
> 中文名称：实时价格与库存 Agent  
> 版本：V1.0  
> 外部接口基线日期：2026-07-20  
>
> 定位：通过 DigiKey、Mouser、Arrow、Element14/Farnell/Newark 等授权分销商官方 API，按标准制造商型号、供应商 SKU、地区、币种、包装、客户账号和采购数量，获取并标准化阶梯价、可用库存、预计库存、交期、MOQ、订购倍数、包装方式和更新时间。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规与原产地
>
> 下游：
> - BOM 成本和供应风险
> - 采购渠道推荐
> - 替代料商业排序
> - 询价、购物车和订单 Agent
> - 库存预警、价格监控和 LTB
>
> 重要边界：
> - 本 Agent 是只读市场数据 Agent，不自动下单、不自动创建购物车、不锁定报价。
> - API 返回的是某一时刻、某一地区、某一币种和某一账号条件下的数据。
> - 合同价格、客户价格和公开价格必须严格分离。
> - Marketplace、Vendor Direct 和第三方库存必须明确标识并可排除。

---

# 1. 建设目标

系统必须能够：

1. 接入 DigiKey Product Information V4；
2. 接入 Mouser Search API；
3. 接入 Arrow Pricing & Availability API；
4. 接入 Element14/Farnell/Newark Product Search API；
5. 后续扩展 Avnet、RS、TME、Future、Rochester、Chip1Stop 和制造商直销；
6. 根据 Agent 32 的标准 MPN 和 Manufacturer 精确查询；
7. 有 Ordering Variant 时优先查询完整订货型号；
8. 区分 Manufacturer Part Number 和 Distributor SKU；
9. 区分 Cut Tape、Reel、Tray、Tube、Bulk、Ammo Pack、Re-reel；
10. 保存 MOQ、Order Multiple、Standard Pack 和 Price Break；
11. 保存公开价格、客户价格、合同价格和报价价格类型；
12. 保存地区、站点、币种、税前/税后和账号上下文；
13. 保存即时库存、预计库存、Backorder 和工厂交期；
14. 保存仓库、库存池和来源类型；
15. 默认排除或标记 Marketplace、Broker 和未知第三方库存；
16. 记录 Fetch Time、Source Time、TTL 和 Freshness；
17. API 不可用时返回有时间戳的缓存，不伪装为实时；
18. 处理 Rate Limit、Quota、Token Refresh、Retry 和 Circuit Breaker；
19. 支持单器件交互查询和数万行 BOM 批量查询；
20. 将不同 Provider 响应标准化为统一 Offer Schema；
21. 不合并不同包装、地区、账号或库存池；
22. 按需求数量计算合法采购量和阶梯单价；
23. 输出数据完整度、授权状态和新鲜度；
24. 保留原始 API 响应和映射过程；
25. 遵守 Provider 数据缓存、展示和再分发条款；
26. 支持多租户合同价格隔离；
27. 支持未来 Quote、Cart、Order API，但当前不执行写操作。

---

# 2. 与 Agent 32–35 的边界

## Agent 32

负责：

```text
原始料号
→ Manufacturer
→ 标准 MPN
→ Part
→ Package Variant
→ Ordering Variant
```

Agent 36 不应对模糊字符串自由搜索并自动选择器件。

若仅解析到：

```text
family_resolved
generic_specification
unresolved
```

默认返回：

```text
resolution_required
```

## Agent 33

负责技术替代。Agent 36只提供价格、库存、包装、交期和商业排序特征。低价不能覆盖技术冲突。

## Agent 34

Agent 36可保存 Distributor 返回的 Product Status，但不改写官方生命周期结论。

## Agent 35

Agent 36可保存 API 返回的 RoHS、Country 等字段作为 Observation，但不做最终合规和原产地判断。

---

# 3. 核心原则

## 3.1 “实时”必须带时间戳

每条 Offer 保存：

```text
requested_at
received_at
source_updated_at
expires_at
freshness_status
```

UI 必须显示：

```text
刚刚更新
8 分钟前更新
缓存数据
已过期
来源未返回更新时间
```

## 3.2 价格不是 Part 的固定属性

价格绑定：

```text
distributor
distributor_sku
manufacturer_part_number
packaging
quantity_break
currency
region/store
customer account
price type
tax treatment
effective time
```

## 3.3 库存不是一个总数

区分：

```text
available_now
expected_stock
factory_stock
vendor_direct
warehouse_stock
marketplace_stock
backorderable
```

预计库存不能加到即时库存后显示为“现货”。

## 3.4 包装不能被抹平

以下 Offer 必须分开：

```text
Cut Tape
Tape & Reel
Digi-Reel / Re-reel
Tray
Tube
Bulk
Box
Ammo Pack
```

## 3.5 公开价格与合同价格分开

```text
standard/list price
customer-specific price
contract price
quoted price
promotional price
unknown
```

合同价格绑定：

```text
tenant_id
provider_account_id
customer_account_reference
region
currency
```

不得进入跨租户公共缓存。

## 3.6 Supplier SKU 与 MPN 分开

```text
Manufacturer Part Number
Distributor Part Number
Supplier SKU
Packaging SKU
Marketplace Offer SKU
```

## 3.7 授权来源模式

```text
authorized_only
authorized_and_vendor_direct
include_marketplace
all_sources
```

默认：

```text
authorized_only
```

## 3.8 原始响应不可变

```text
Raw Provider Response
→ Provider Observation
→ Canonical Offer Snapshot
→ Market View
```

## 3.9 不用网页抓取冒充 API

API 失败时允许缓存、Unavailable、用户上传 Quote 或受控 Feed；默认禁止自动切换网页爬虫。

## 3.10 下单前必须再次确认

```text
refresh exact offer
→ validate quantity/account/region/currency
→ validate availability
→ quote/cart/order
```

---

# 4. 官方接口能力基线

能力、版本、额度和认证方式必须进入 Connector Capability Manifest，不得散落在业务代码中。

## 4.1 DigiKey

使用：

```text
Product Information V4
- ProductPricing
- ProductDetails
- KeywordSearch 仅用于召回
```

认证：

```text
OAuth 2.0
X-DIGIKEY-Client-Id
Account/Locale Headers
```

设计要点：

- ProductPricing/ProductDetails 用于价格和可用性；
- Locale 影响站点、语言、币种和地区；
- MyPricing 依赖账户上下文；
- `authorized_only` 模式开启 Marketplace 排除能力；
- Keyword Search 不作为最终实时价格依据；
- Rate Limit 从响应 Header 动态读取；
- Token 自动刷新且不得写入日志。

## 4.2 Mouser

使用：

```text
Search by Part Number
Search by Part Number and Manufacturer
Keyword Search 仅用于召回
```

可映射：

```text
Availability
Mouser Part Number
Manufacturer Part Number
Manufacturer
Packaging
MOQ
Order Multiple
Standard Pack
Lead Time
Lifecycle
RoHS
Suggested Replacement
Price Breaks
```

设计要点：

- 首选 Part Number + Manufacturer；
- 结果数量和调用额度由 Capability Manifest 管理；
- Price Break 数量有限时标记不完整；
- Suggested Replacement 不直接当技术替代。

## 4.3 Arrow

使用：

```text
Pricing & Availability API
- search/token
- search/list
- manufacturer lookup
```

认证：

```text
login + API key
```

设计要点：

- 当前官方文档为 v4；
- API Key 可配置 Inventory Pool；
- 返回池可能含 Arrow 区域库存、Division、Vendor 或 Marketplace；
- 必须保存 inventory source/pool；
- `authorized_only` 模式过滤第三方 Marketplace；
- Pricing Key 与 Order Key 分开管理。

## 4.4 Element14 / Farnell / Newark

使用：

```text
Product Search API REST
- MPN Search
- Product Number Search
- Keyword Search
- Prices Response Group
- Inventory Response Group
```

认证：

```text
Generic: API Key
Contract:
- API Key
- Customer ID
- Signature
- Timestamp
```

设计要点：

- `storeInfo.id` 决定地区 Store；
- Generic Price 和 Contract Price 分开；
- Available Stock 和 Expected Stock 分开；
- 保存 Warehouse、Least Lead Time、Pack Size、MOQ、UOM、Packaging Option 和 Re-reel Charge；
- Product Status、Inventory Status、Release Status 分开。

---

# 5. Provider Capability Manifest

```yaml
provider: digikey
connector_version: 1.0.0
verified_at: 2026-07-20

authentication:
  type: oauth2
  modes: [two_legged, three_legged]

capabilities:
  exact_mpn_search: true
  manufacturer_filter: true
  supplier_sku_lookup: true
  batch_search: false
  standard_pricing: true
  customer_pricing: true
  price_breaks: true
  inventory: true
  expected_stock: false
  lead_time: true
  marketplace_filter: true
  quote: separate_api
  order: separate_api

freshness:
  pricing_ttl_seconds: 900
  inventory_ttl_seconds: 300

rate_limit:
  source: response_headers
```

Manifest 保存：

```text
provider
API product/version
endpoint version
last verified date
authentication mode
locale model
batch support
price/inventory support
marketplace support
quota model
terms profile
```

---

# 6. 标准输入

```json
{
  "request_id": "uuid",
  "subject": {
    "part_id": "uuid",
    "manufacturer_id": "uuid",
    "manufacturer_name": "Texas Instruments",
    "manufacturer_part_number": "TPS62160DSGR",
    "package_variant_id": "uuid",
    "ordering_variant_id": "uuid"
  },
  "purchase_context": {
    "requested_quantity": 1250,
    "destination_country": "US",
    "destination_postal_code": "98101",
    "currency": "USD",
    "required_packaging": ["cut_tape", "tape_and_reel"],
    "authorized_source_mode": "authorized_only",
    "include_expected_stock": true,
    "customer_pricing": true,
    "tenant_id": "uuid"
  },
  "providers": ["digikey", "mouser", "arrow", "element14"],
  "freshness": {
    "max_age_seconds": 300,
    "allow_stale_cache": true,
    "force_refresh": false
  }
}
```

---

# 7. 标准输出

```json
{
  "request_id": "uuid",
  "part_id": "uuid",
  "status": "completed_with_partial_failures",
  "market_view": {
    "requested_quantity": 1250,
    "currency": "USD",
    "destination_country": "US",
    "generated_at": "ISO-8601",
    "best_authorized_offer": {
      "offer_snapshot_id": "uuid",
      "provider": "mouser",
      "distributor_sku": "595-TPS62160DSGR",
      "packaging": "cut_tape",
      "buy_quantity": 1250,
      "unit_price": "1.25",
      "extended_price": "1562.50",
      "available_now": 8000,
      "freshness": "live",
      "fetched_at": "ISO-8601"
    }
  },
  "offers": [],
  "provider_status": [],
  "quality": {
    "providers_requested": 4,
    "providers_succeeded": 3,
    "authorized_offers": 8,
    "marketplace_offers_filtered": 2,
    "fresh_offer_ratio": 0.75
  }
}
```

---

# 8. 数据分层

```text
Provider Raw Response
→ Provider Offer Observation
→ Canonical Offer Snapshot
→ Quantity Purchase Evaluation
→ Aggregated Market View
→ Procurement Decision
```

Procurement Decision 不属于 Agent 36。

---

# 9. Offer 唯一身份

```text
provider
provider_account_scope
regional_store
distributor_sku
manufacturer_part_number
packaging
inventory_pool
currency
price_type
```

同一 SKU 在不同账号下是不同 Offer Context。

---

# 10. 来源类型

```text
authorized_distributor_inventory
authorized_distributor_regional_inventory
manufacturer_direct
vendor_direct_authorized
authorized_division_inventory
marketplace_authorized_seller
marketplace_unverified_seller
broker_inventory
consigned_inventory
customer_bonded_inventory
unknown
```

默认推荐来源：

```text
authorized_distributor_inventory
authorized_distributor_regional_inventory
manufacturer_direct
vendor_direct_authorized
authorized_division_inventory
```


---

# 11. Canonical Offer Schema

```json
{
  "offer_snapshot_id": "uuid",
  "identity": {
    "provider": "digikey",
    "distributor_sku": "296-TPS62160DSGRCT-ND",
    "manufacturer_part_number": "TPS62160DSGR",
    "manufacturer_id": "uuid",
    "part_id": "uuid",
    "ordering_variant_id": "uuid"
  },
  "source": {
    "source_type": "authorized_distributor_inventory",
    "inventory_pool": "digikey_us",
    "marketplace": false,
    "vendor_direct": false,
    "authorized_status": "verified_by_provider_scope"
  },
  "market": {
    "store": "US",
    "region": "US",
    "language": "en",
    "currency": "USD",
    "customer_account_scope": "tenant-account-uuid",
    "price_type": "customer_price",
    "tax_included": false
  },
  "packaging": {
    "canonical_type": "cut_tape",
    "raw_type": "Cut Tape",
    "unit_of_measure": "EA",
    "standard_pack_quantity": 1,
    "minimum_order_quantity": 1,
    "order_multiple": 1,
    "reel_quantity": null,
    "re_reel_available": false,
    "re_reel_charge": null
  },
  "inventory": {
    "available_now": 8250,
    "expected": [],
    "backorderable": true,
    "warehouses": [],
    "lead_time_days": 56,
    "manufacturer_lead_time_days": null
  },
  "pricing": {
    "tiers": [
      {
        "minimum_quantity": 1,
        "maximum_quantity": 9,
        "unit_price": "2.10"
      },
      {
        "minimum_quantity": 10,
        "maximum_quantity": 99,
        "unit_price": "1.80"
      }
    ],
    "price_basis": "per_each",
    "list_price": null,
    "fees": []
  },
  "freshness": {
    "requested_at": "ISO-8601",
    "received_at": "ISO-8601",
    "source_updated_at": null,
    "expires_at": "ISO-8601",
    "freshness_status": "live",
    "cache_hit": false
  },
  "provenance": {
    "connector_version": "digikey-1.0.0",
    "provider_api_version": "product-information-v4",
    "endpoint": "productpricing",
    "request_hash": "hex",
    "response_hash": "hex",
    "raw_response_uri": "s3://..."
  }
}
```

---

# 12. 精确查询策略

查询顺序：

```text
1. Distributor SKU Exact
2. Full Ordering Variant + Manufacturer
3. Full MPN + Manufacturer
4. Full MPN Exact
5. Base Part + Package Constraint
6. Keyword Search，仅用于候选召回
```

结果必须通过：

```text
Manufacturer Match
MPN Strict Match
Ordering Variant Match
Packaging Match
Agent 32 Identity Validation
```

多结果全部保留，不得因为价格最低、库存最多或编辑距离最小而自动选第一条。

---

# 13. Connector 接口

```python
class DistributorConnector(Protocol):
    provider: str

    async def capabilities(self) -> ProviderCapabilities:
        ...

    async def search_exact(
        self,
        request: ExactPartRequest,
        context: ProviderRequestContext,
    ) -> ProviderSearchResult:
        ...

    async def get_offer(
        self,
        provider_sku: str,
        context: ProviderRequestContext,
    ) -> ProviderOfferResult:
        ...

    async def batch_get_offers(
        self,
        requests: list[ExactPartRequest],
        context: ProviderRequestContext,
    ) -> ProviderBatchResult:
        ...

    async def quota_status(self) -> ProviderQuotaStatus:
        ...

    async def health_check(self) -> ProviderHealth:
        ...
```

Connector 负责：

```text
认证
请求格式
Provider 限速
响应解析
字段映射
Provider 错误分类
Marketplace 标识
Locale/Account 上下文
```

Aggregator 不得包含 Provider 特定字段判断。

---

# 14. DigiKey Adapter

查询：

```text
Full MPN / DigiKey SKU
→ ProductPricing
→ 必要时 ProductDetails
```

Keyword Search 只用于用户搜索或候选召回。

保存 Header Context：

```text
Site
Language
Currency
Ship-to Country
Account ID
Client ID
OAuth Mode
```

Marketplace：

- `authorized_only` 模式启用排除参数；
- 仍返回 Marketplace 时单独分类；
- Marketplace Offer 不进入默认授权现货汇总。

Token：

- Access Token 存内存或短期安全缓存；
- Refresh Token 存 Secrets Manager；
- Token Lock 防止并发刷新；
- 401 只自动刷新一次；
- Authorization Header 不进日志。

Rate Limit：

```text
X-RateLimit-Limit
X-RateLimit-Remaining
```

动态写入 Quota State。

---

# 15. Mouser Adapter

首选：

```text
Part Number + Manufacturer
```

其次：

```text
Part Number
```

映射：

```text
Mouser Part Number
Manufacturer Part Number
Manufacturer
Availability
Price Breaks
Packaging
MOQ
Order Quantity Multiple
Standard Pack
Lead Time
Lifecycle Status
RoHS Status
Reeling Availability
Suggested Replacement
```

Price Break 不完整时：

```text
price_tiers_complete = false
quote_recommended = true
```

需求数量超过最高 Break 时，不假定最后价格无限有效。

Quota：

```text
minute bucket
daily bucket
interactive reserve
batch reserve
```

额度从配置和运行状态读取，不写死在核心代码。

---

# 16. Arrow Adapter

API：

```text
Pricing & Availability v4
search/token
search/list
```

每条结果保存：

```text
pool code
pool name
region
seller/division
marketplace flag
authorization classification
```

不能简单写：

```text
provider = Arrow
authorized = true
```

Batch 请求按 Provider 当前限制分块。

安全：

- Login 和 API Key 分开；
- Pricing Key 和 Order Key 分开；
- Query String Credential 从日志、Tracing 和 APM 中 Redact；
- Debug 日志不得保存完整 URL。

---

# 17. Element14 Adapter

必须提供地区 Store：

```text
storeInfo.id
```

价格模式：

```text
generic
contract
```

Contract 需要：

```text
API Key
Customer ID
Signature
Timestamp
Secret
```

Response Group：

```text
Prices
Inventory
Large
```

库存保存：

```text
available level
expected stock level/date
warehouse
regional breakdown
least lead time
ships from multiple warehouses
stock status
```

包装保存：

```text
packageName
packSize
unitOfMeasure
packagingOptions
reReelingCharge
MOQ
```

---

# 18. 包装标准化

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
unknown
```

Provider Alias Registry：

```yaml
provider: mouser
aliases:
  "Cut Tape":
    canonical: cut_tape
  "MouseReel":
    canonical: re_reel
  "Reel":
    canonical: tape_and_reel
```

必须保存 Raw Packaging 和 Mapping Version。

---

# 19. MOQ、Order Multiple 和 Pack Size

三者分开：

```text
minimum_order_quantity
order_multiple
standard_pack_quantity
```

例子：

```text
MOQ = 10
Order Multiple = 5
Standard Pack = 1000
Requested = 12
```

合法采购量为 15，不自动取整到 1000，除非 Provider 明确要求整包。

```python
def calculate_buy_quantity(
    requested_quantity: int,
    minimum_order_quantity: int,
    order_multiple: int,
) -> int:
    base = max(requested_quantity, minimum_order_quantity)
    if order_multiple <= 1:
        return base
    return ((base + order_multiple - 1) // order_multiple) * order_multiple
```

还必须校验：

- 是否允许拆包；
- 是否整卷销售；
- Re-reel 是否可用；
- 最大订购量；
- Stock 是否覆盖合法采购量。

---

# 20. 阶梯价标准化

字段：

```text
minimum_quantity
maximum_quantity
unit_price
currency
price_basis
price_type
tax_included
effective_from
effective_to
```

要求：

- 价格和金额用 Decimal；
- 选择最高 `minimum_quantity <= buy_quantity` 的 Break；
- 校验 `maximum_quantity`；
- 保存 Break 是否完整；
- 保存账号和币种上下文。

Price Basis：

```text
per_each
per_pack
per_reel
per_hundred
per_thousand
unknown
```

统一到 `per_each` 时保留原始 Basis。

费用单列：

```text
re_reel_fee
handling_fee
line_fee
small_order_fee
unknown_fee
```

本 Agent 不默认计算运费、税和关税的最终 Landed Cost。

---

# 21. Currency

两种视图：

```text
native_currency_view
normalized_currency_view
```

转换时保存：

```text
fx_rate
fx_source
fx_timestamp
conversion_rounding
```

合同价格转换后仍属于原租户私有数据。

---

# 22. 库存模型

```json
{
  "available_now": 1000,
  "available_to_order": 1000,
  "expected_stock": [
    {
      "quantity": 500,
      "date": "2026-08-01",
      "confidence": "provider_reported"
    }
  ],
  "backorderable": true,
  "on_demand": false,
  "direct_ship": false,
  "warehouses": [
    {
      "warehouse": "US",
      "quantity": 1000,
      "lead_time_days": 0
    }
  ],
  "manufacturer_lead_time_days": 84
}
```

禁止：

```text
available_now += expected_stock
```

---

# 23. Lead Time

区分：

```text
warehouse_ship_lead_time
expected_stock_date
manufacturer_lead_time
vendor_direct_lead_time
special_order_lead_time
unknown
```

Provider 字符串：

```text
"10 Weeks"
```

可归一为：

```text
70 days
```

但必须保存 Raw 和 Rule，且不承诺实际到货日。

---

# 24. Freshness

```text
live
fresh_cache
stale_cache
expired
unknown
```

配置示例：

```yaml
provider: digikey
fields:
  inventory:
    live_ttl_seconds: 300
    stale_ttl_seconds: 3600
  pricing:
    live_ttl_seconds: 900
    stale_ttl_seconds: 86400
```

TTL 是运营配置，不是 Provider 永久事实。

支持：

```text
stale-while-revalidate
```

但下单前禁止使用 Stale Offer。

---

# 25. 缓存隔离

公共缓存可在条款允许时保存：

```text
standard list pricing
public availability
public metadata
```

私有缓存按：

```text
tenant
provider account
regional store
currency
account ID
```

隔离：

```text
MyPricing
Contract Pricing
Customer Pricing
Quotes
Bonded Inventory
```

---

# 26. 请求调度

请求类型：

```text
interactive
pre_order_validation
critical_shortage
bom_batch
watchlist_refresh
background_warmup
```

优先级：

```text
pre_order_validation
interactive
critical_shortage
bom_batch
watchlist
background
```

预留交互额度，避免批处理耗尽每日 Quota。

---

# 27. Rate Limit 和 Quota

保存：

```text
limit window
remaining
reset time
daily quota
minute quota
concurrency limit
last 429
```

策略：

```text
Token Bucket
Provider Semaphore
Exponential Backoff
Retry-After
Quota Reservation
Batch Chunking
Request Coalescing
Single-flight
```

多个用户查询同一 MPN 时只发一个 Provider 请求。

---

# 28. Retry 和 Circuit Breaker

可重试：

```text
timeout
connection reset
429
500/502/503/504
temporary provider error
token refresh race
```

不自动重试：

```text
invalid API key
unauthorized account
invalid MPN
terms violation
unsupported locale
schema incompatible
```

Circuit：

```text
closed
open
half_open
```

---

# 29. Schema Drift

每次响应验证：

```text
required fields
types
enum values
nested shape
API version
```

未知非关键字段保存并记录 Drift Metric。

关键字段缺失或类型变化：

```text
schema_incompatible
circuit open
connector review
```

---

# 30. 市场视图聚合

不只按最低单价排序。

维度：

```text
identity exactness
authorized status
freshness
stock coverage
effective buy quantity
extended price
excess quantity
packaging suitability
lead time
customer pricing
provider reliability
```

技术门槛：

```text
exact Part
acceptable Ordering Variant
acceptable Packaging
authorized policy pass
```

排序模式：

```text
price_first
availability_first
balanced
```

`best_offer` 保存：

```text
ranking_policy_version
requested_quantity
calculated_at
```


---

# 31. 数据质量模型

每个 Offer 计算：

```text
identity_confidence
packaging_confidence
price_completeness
inventory_confidence
source_authorization_confidence
freshness_confidence
overall_data_quality
```

缺失字段使用明确状态：

```text
price_missing
inventory_missing
packaging_unknown
moq_unknown
order_multiple_unknown
currency_unknown
source_type_unknown
timestamp_unknown
```

禁止用 0 替代 Unknown。

---

# 32. Provider Terms 和数据使用

每个 Connector 保存 Data Use Profile：

```text
display_allowed
cache_allowed
cache_retention
redistribution_allowed
attribution_required
customer_price_confidential
image_usage
link_back_required
raw_response_retention
audit_log_retention
```

Codex 不得擅自假定：

```text
可永久缓存
可公开再分发
可向 Tindie 全体用户展示合同价格
```

任何公开展示、历史留存和批量再分发都必须经过 Provider 条款和合同确认。

---

# 33. 价格历史

价格历史键：

```text
provider
account scope
regional store
distributor sku
packaging
currency
price type
quantity break
observed time
```

不同地区和客户账号不能混成同一趋势。

历史数据保留期限由 Data Use Profile 决定。

---

# 34. Watchlist

支持：

```text
critical_bom
active_project
mass_production
shortage
ltb
favorite_part
tindie_listing_core_part
```

刷新频率基于：

```text
business risk
provider quota
stock volatility
price volatility
product phase
```

高风险可小时级，普通器件日级或周级。

---

# 35. 数据库设计

## 35.1 `market_data_jobs`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
request_type VARCHAR NOT NULL
purchase_context JSONB NOT NULL
provider_list JSONB NOT NULL
freshness_policy JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 35.2 `provider_accounts`

```text
id UUID PK
tenant_id UUID NULL
provider VARCHAR NOT NULL
account_name VARCHAR NOT NULL
region VARCHAR NULL
store_id VARCHAR NULL
currency VARCHAR NULL
authentication_type VARCHAR NOT NULL
secret_reference TEXT NOT NULL
customer_account_reference VARCHAR NULL
pricing_mode VARCHAR NOT NULL
status VARCHAR NOT NULL
capability_manifest_version VARCHAR NOT NULL
terms_profile_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(tenant_id, provider, account_name)
```

`secret_reference` 指向 Secrets Manager，不保存 Secret 明文。

## 35.3 `provider_query_runs`

```text
id UUID PK
job_id UUID NOT NULL
provider_account_id UUID NOT NULL
provider VARCHAR NOT NULL
endpoint VARCHAR NOT NULL
request_hash CHAR(64) NOT NULL
request_context_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
http_status INT NULL
duration_ms INT NULL
quota_before JSONB NULL
quota_after JSONB NULL
cache_status VARCHAR NOT NULL
raw_response_uri TEXT NULL
response_hash CHAR(64) NULL
error_code VARCHAR NULL
created_at TIMESTAMPTZ
```

## 35.4 `offer_snapshots`

```text
id UUID PK
provider VARCHAR NOT NULL
provider_account_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
manufacturer_id UUID NOT NULL
manufacturer_part_number VARCHAR NOT NULL
distributor_sku VARCHAR NOT NULL
regional_store VARCHAR NULL
inventory_pool VARCHAR NULL
source_type VARCHAR NOT NULL
marketplace BOOLEAN NOT NULL
vendor_direct BOOLEAN NOT NULL
packaging_type VARCHAR NOT NULL
raw_packaging VARCHAR NULL
currency CHAR(3) NOT NULL
price_type VARCHAR NOT NULL
available_now NUMERIC NULL
lead_time_days INT NULL
freshness_status VARCHAR NOT NULL
requested_at TIMESTAMPTZ NOT NULL
received_at TIMESTAMPTZ NOT NULL
source_updated_at TIMESTAMPTZ NULL
expires_at TIMESTAMPTZ NOT NULL
raw_response_uri TEXT NOT NULL
snapshot_uri TEXT NOT NULL
connector_version VARCHAR NOT NULL
provider_api_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 35.5 `offer_price_tiers`

```text
id UUID PK
offer_snapshot_id UUID NOT NULL
minimum_quantity NUMERIC NOT NULL
maximum_quantity NUMERIC NULL
unit_price NUMERIC NOT NULL
currency CHAR(3) NOT NULL
price_basis VARCHAR NOT NULL
tax_included BOOLEAN NULL
tier_order INT NOT NULL
UNIQUE(offer_snapshot_id, tier_order)
```

## 35.6 `offer_inventory_locations`

```text
id UUID PK
offer_snapshot_id UUID NOT NULL
warehouse_code VARCHAR NULL
warehouse_name VARCHAR NULL
region VARCHAR NULL
available_quantity NUMERIC NULL
lead_time_days INT NULL
inventory_status VARCHAR NULL
source_type VARCHAR NOT NULL
```

## 35.7 `offer_expected_stock`

```text
id UUID PK
offer_snapshot_id UUID NOT NULL
expected_quantity NUMERIC NULL
expected_date DATE NULL
status VARCHAR NOT NULL
confidence VARCHAR NULL
```

## 35.8 `offer_packaging`

```text
offer_snapshot_id UUID PRIMARY KEY
canonical_type VARCHAR NOT NULL
raw_type VARCHAR NULL
unit_of_measure VARCHAR NULL
standard_pack_quantity NUMERIC NULL
minimum_order_quantity NUMERIC NULL
order_multiple NUMERIC NULL
reel_quantity NUMERIC NULL
re_reel_available BOOLEAN NULL
re_reel_charge NUMERIC NULL
re_reel_charge_currency CHAR(3) NULL
mapping_version VARCHAR NOT NULL
```

## 35.9 `quantity_purchase_evaluations`

```text
id UUID PK
offer_snapshot_id UUID NOT NULL
requested_quantity NUMERIC NOT NULL
effective_buy_quantity NUMERIC NULL
selected_tier_id UUID NULL
unit_price NUMERIC NULL
extended_price NUMERIC NULL
excess_quantity NUMERIC NULL
fees JSONB NOT NULL
currency CHAR(3) NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
calculated_at TIMESTAMPTZ NOT NULL
policy_version VARCHAR NOT NULL
```

## 35.10 `market_views`

```text
id UUID PK
job_id UUID NOT NULL
part_id UUID NOT NULL
purchase_context_hash CHAR(64) NOT NULL
ranking_policy_version VARCHAR NOT NULL
best_offer_snapshot_id UUID NULL
authorized_offer_count INT NOT NULL
fresh_offer_count INT NOT NULL
provider_status JSONB NOT NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, part_id)
```

## 35.11 `provider_quota_states`

```text
provider_account_id UUID PRIMARY KEY
provider VARCHAR NOT NULL
window_type VARCHAR NOT NULL
limit_value INT NULL
remaining_value INT NULL
reset_at TIMESTAMPTZ NULL
last_429_at TIMESTAMPTZ NULL
circuit_state VARCHAR NOT NULL
updated_at TIMESTAMPTZ
```

## 35.12 `market_watchlists`

```text
id UUID PK
tenant_id UUID NOT NULL
name VARCHAR NOT NULL
watch_type VARCHAR NOT NULL
refresh_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 35.13 `market_watchlist_items`

```text
id UUID PK
watchlist_id UUID NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
purchase_context JSONB NOT NULL
priority VARCHAR NOT NULL
last_refreshed_at TIMESTAMPTZ NULL
next_refresh_at TIMESTAMPTZ NULL
UNIQUE(watchlist_id, part_id, ordering_variant_id)
```

---

# 36. 对象存储

```text
derived/market-data/
  {part_id}/
    {purchase_context_hash}/
      {job_id}/
        input/
          request.json
          resolved-part.json
        providers/
          digikey/
            request.json
            raw-response.json
            normalized-offers.json
            connector-log.json
          mouser/
          arrow/
          element14/
        aggregation/
          all-offers.json.zst
          authorized-offers.json.zst
          quantity-evaluations.json.zst
          market-view.json
        reports/
          quality-report.json
          provider-status.json
        debug/
          identity-match-log.json
          packaging-map-log.json
          price-normalization-log.json
          inventory-normalization-log.json
```

Secrets 和 OAuth Token 不得进入对象存储。

---

# 37. API 设计

## 单器件

```text
POST /api/v1/market-data/offers/query
```

## BOM

```text
POST /api/v1/market-data/bom-jobs
```

## 刷新

```text
POST /api/v1/market-data/parts/{part_id}/refresh
POST /api/v1/market-data/boms/{bom_id}/refresh
POST /api/v1/market-data/providers/{provider}/test-connection
```

## 读取

```text
GET /api/v1/market-data/jobs/{job_id}
GET /api/v1/market-data/jobs/{job_id}/events
GET /api/v1/market-data/parts/{part_id}/offers
GET /api/v1/market-data/parts/{part_id}/market-view
GET /api/v1/market-data/boms/{bom_id}/coverage
GET /api/v1/market-data/providers
GET /api/v1/market-data/providers/{provider}/health
GET /api/v1/market-data/providers/{provider}/quota
GET /api/v1/market-data/offers/{offer_snapshot_id}
```

## Provider Account

```text
POST   /api/v1/market-data/provider-accounts
PATCH  /api/v1/market-data/provider-accounts/{id}
DELETE /api/v1/market-data/provider-accounts/{id}
```

API 永不返回 Secret 明文。

---

# 38. 事件

## 输入

```text
bom.mpn-resolution.ready
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
market-data.refresh.requested
provider.credentials.updated
```

## 输出

```text
component.market-data.ready
bom.market-data.ready
component.stock.changed
component.price.changed
component.stock.below-threshold
provider.rate-limit.warning
provider.connection.failed
market-data.stale
```

## `bom.market-data.ready`

```json
{
  "event_type": "bom.market-data.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "bom_id": "uuid",
  "purchase_context_hash": "hex",
  "result_uri": "s3://.../bom-market-view.json",

  "summary": {
    "lines": 385,
    "resolved_lines": 360,
    "priced_lines": 340,
    "in_stock_lines": 300,
    "shortage_lines": 25,
    "stale_only_lines": 8,
    "unpriced_lines": 20
  },

  "provider_status": {
    "digikey": "success",
    "mouser": "success",
    "arrow": "cached",
    "element14": "rate_limited"
  },

  "created_at": "ISO-8601"
}
```

---

# 39. 状态机

```text
RECEIVED
→ VALIDATING_SUBJECT
→ LOADING_PURCHASE_CONTEXT
→ RESOLVING_PROVIDER_ACCOUNTS
→ CHECKING_CACHE
→ BUILDING_QUERY_PLAN
→ RESERVING_QUOTA
→ AUTHENTICATING_PROVIDERS
→ QUERYING_PROVIDERS
→ VALIDATING_RESPONSES
→ STORING_RAW_RESPONSES
→ NORMALIZING_IDENTITIES
→ NORMALIZING_PACKAGING
→ NORMALIZING_PRICING
→ NORMALIZING_INVENTORY
→ CLASSIFYING_SOURCE_TYPES
→ APPLYING_AUTHORIZED_POLICY
→ EVALUATING_QUANTITY_PRICING
→ AGGREGATING_MARKET_VIEW
→ STORING_RESULTS
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_PARTIAL_FAILURES
CACHE_RETURNED_REFRESH_PENDING
RATE_LIMITED
AUTHENTICATION_REQUIRED
PROVIDER_UNAVAILABLE
SUBJECT_RESOLUTION_REQUIRED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 40. 错误码

```text
PART_NOT_FOUND
PART_NOT_EXACTLY_RESOLVED
ORDERING_VARIANT_AMBIGUOUS
PURCHASE_CONTEXT_MISSING
DESTINATION_COUNTRY_MISSING
CURRENCY_UNSUPPORTED
PROVIDER_NOT_CONFIGURED
PROVIDER_ACCOUNT_NOT_FOUND
PROVIDER_AUTH_FAILED
PROVIDER_TOKEN_REFRESH_FAILED
PROVIDER_RATE_LIMITED
PROVIDER_DAILY_QUOTA_EXHAUSTED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
PROVIDER_SCHEMA_INCOMPATIBLE
PROVIDER_TERMS_BLOCKED
EXACT_PART_NOT_FOUND
MANUFACTURER_MISMATCH
MPN_MISMATCH
DISTRIBUTOR_SKU_MISMATCH
PACKAGING_UNKNOWN
PACKAGING_NOT_ALLOWED
MARKETPLACE_FILTERED
PRICE_NOT_AVAILABLE
PRICE_TIER_INCOMPLETE
INVENTORY_NOT_AVAILABLE
INVENTORY_SOURCE_UNKNOWN
MOQ_UNKNOWN
ORDER_MULTIPLE_UNKNOWN
LEAD_TIME_UNKNOWN
STALE_DATA_ONLY
CACHE_MISS
BATCH_LIMIT_EXCEEDED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 41. 安全

- API Key、Client Secret、Refresh Token 进入 Secrets Manager；
- 不保存在数据库、日志、对象存储或前端；
- Query String Credential 必须 Redact；
- OAuth Token 有最小权限；
- Contract Pricing 按租户和账号隔离；
- Provider Account 操作需管理员权限；
- 生产和 Sandbox Credential 分开；
- Webhook/Callback 校验 State 和 Redirect URI；
- HTTP Client 限定官方 Host；
- 禁止用户传入任意 Base URL；
- 防止 SSRF；
- Raw Response 中可能含客户账号信息，按私有数据处理；
- 测试 Fixture 必须去除 Token、账号、合同价和真实订单；
- 不在公开仓库提交 `.env`、Secret 或真实 Response；
- Provider 条款和合同权限写入 Terms Profile；
- 删除 Provider Account 时撤销 Token 并清理私有缓存引用。

---

# 42. 可观测性

## Metrics

```text
market_data_jobs_total{status,type}
market_data_provider_requests_total{provider,endpoint,status}
market_data_provider_latency_seconds{provider,endpoint}
market_data_provider_rate_limited_total{provider}
market_data_provider_auth_failures_total{provider}
market_data_provider_schema_drift_total{provider,field}
market_data_offers_total{provider,source_type}
market_data_marketplace_filtered_total{provider}
market_data_cache_hits_total{provider,freshness}
market_data_price_tiers_total{provider}
market_data_inventory_available_total{provider}
market_data_stale_offers_total{provider}
market_data_missing_fields_total{provider,field}
market_data_bom_coverage_ratio
market_data_singleflight_coalesced_total{provider}
```

## Dashboard

- Provider Health；
- Rate Limit 和每日 Quota；
- P50/P95/P99 延迟；
- Cache Hit；
- Fresh/Stale 比例；
- MPN Exact Match；
- Marketplace Filter；
- Price Coverage；
- Stock Coverage；
- 包装未知率；
- MOQ/Multiple 缺失率；
- Provider Schema Drift；
- BOM 批量耗时；
- 合同价格访问审计。

---

# 43. Benchmark

## Connector

- Authentication Success；
- Exact MPN Query Accuracy；
- Distributor SKU Accuracy；
- Response Schema Coverage；
- Error Classification Accuracy；
- Token Refresh Reliability。

## Identity

- Manufacturer Match Accuracy；
- MPN Match Accuracy；
- Ordering Variant Accuracy；
- Marketplace Classification；
- Inventory Pool Classification。

## Packaging

- Packaging Type Accuracy；
- MOQ Accuracy；
- Order Multiple Accuracy；
- Pack Size Accuracy；
- Re-reel Fee Accuracy。

## Price

- Price Tier Extraction Accuracy；
- Price Basis Accuracy；
- Quantity Break Selection Accuracy；
- Decimal Calculation Accuracy；
- Contract/Public Isolation；
- Currency Context Accuracy。

## Inventory

- Available Stock Accuracy；
- Expected Stock Separation；
- Warehouse Breakdown Accuracy；
- Lead Time Normalization；
- Backorder Classification。

## System

- Top Provider Success Rate；
- Freshness Accuracy；
- Cache Isolation；
- Rate Limit Compliance；
- Batch Throughput；
- Partial Failure Recovery；
- No-secret-in-log Test。

---

# 44. 初始质量目标

```text
Exact Part Identity Accuracy >= 99.9%
Distributor SKU Mapping Accuracy >= 99.9%
Packaging Mapping Accuracy >= 99%
Price Tier Extraction Accuracy >= 99.9%
Quantity Break Selection Accuracy = 100%
Decimal Arithmetic Accuracy = 100%
MOQ/Order Multiple Evaluation Accuracy >= 99.9%
Available vs Expected Stock Separation Accuracy = 100%
Marketplace Classification Recall >= 99.5%
Contract Price Tenant Isolation = 100%
Freshness Label Accuracy >= 99.9%
Provider Error Classification >= 98%
Secret Leakage Test Pass = 100%
```

这些是目标，不是未经测试的保证。

---

# 45. 测试集

公开仓库只使用合成、Sandbox 或脱敏 Fixture。

## Identity

1. Exact MPN + Manufacturer；
2. Distributor SKU；
3. Same MPN Multiple Manufacturer；
4. Multiple Packaging；
5. Base Part Only；
6. Ordering Variant；
7. Manufacturer Alias；
8. No Result；
9. Marketplace Result；
10. Vendor Direct。

## Price

11. One Tier；
12. Multiple Tiers；
13. Contract Price；
14. Standard Price；
15. Tax Included；
16. Per Pack；
17. Per Hundred；
18. Missing Tier；
19. Highest Break；
20. Quote Recommended；
21. Currency Different；
22. FX Conversion；
23. Re-reel Fee；
24. Promotional Price；
25. Price Zero Invalid。

## Packaging

26. Cut Tape；
27. Reel；
28. Tray；
29. Tube；
30. Bulk；
31. Re-reel；
32. Unknown；
33. MOQ；
34. Order Multiple；
35. Standard Pack；
36. Whole Reel Only；
37. Split Pack；
38. Alternative Packaging SKU；
39. Pack Size Conflict；
40. Provider Alias Update。

## Inventory

41. In Stock；
42. Out of Stock；
43. Expected Stock；
44. Multiple Warehouses；
45. Direct Ship；
46. Marketplace；
47. Factory Lead Time；
48. Backorder；
49. On Demand；
50. No Longer Stocked；
51. Stock Status Conflict；
52. Expected Date Missing；
53. Negative/Invalid Stock；
54. Regional Inventory；
55. Overlapping Pool。

## Provider/System

56. DigiKey OAuth Refresh；
57. DigiKey Locale；
58. Mouser Minute Limit；
59. Mouser Daily Limit；
60. Arrow Pool Filter；
61. Arrow Query Redaction；
62. Element14 Store；
63. Element14 Contract Signature；
64. Timeout；
65. 429；
66. 503；
67. Invalid Key；
68. Schema Drift；
69. Cache Fresh；
70. Cache Stale；
71. Cache Expired；
72. Single-flight；
73. Circuit Open；
74. Partial Failure；
75. Provider Recovery。

## Multi-tenant/BOM

76. Public Cache Shared；
77. Contract Cache Isolated；
78. Different Currency；
79. Different Destination；
80. Different Account；
81. 10,000 BOM Lines；
82. Duplicate MPN Dedup；
83. Multiple Qty Same MPN；
84. DNP Line；
85. Alternate Part；
86. Obsolete Offer；
87. Authorized-only；
88. Include Marketplace；
89. Provider Terms Retention；
90. Audit Trail；
91. Secret Redaction；
92. Token Concurrency；
93. Watchlist；
94. Price Change；
95. Stock Change；
96. Pre-order Refresh；
97. Stale Rejection；
98. Idempotency；
99. Cancel Batch；
100. Connector Version Rollback。

---

# 46. 性能

## 单器件

```text
Fresh Cache P95 < 100 ms
Single Provider Live P95 < 2 s
Four Provider Aggregation P95 < 5 s
```

受 Provider 网络影响，需单独报告内部处理和外部等待。

## 批量 BOM

```text
10,000 unique MPN
```

目标由 Provider Quota 决定，系统必须：

- 按 MPN 去重；
- 按 Provider 批量；
- 单飞合并；
- 分块执行；
- 支持断点续跑；
- 优先缓存；
- 返回增量进度。

不能承诺在 Provider 日配额不足时一次完成全部实时刷新。

---

# 47. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
httpx
PostgreSQL
Redis
S3 / R2 / MinIO
```

推荐组件：

```text
Secrets Manager / Vault
Celery / Temporal / RQ
Prometheus / OpenTelemetry
respx / pytest-httpx
Decimal
```

V1 不需要 LLM。

---

# 48. 推荐仓库结构

```text
market-data-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── market-data-agent-spec.md
│   ├── canonical-offer-model.md
│   ├── provider-capability-manifest.md
│   ├── pricing-normalization.md
│   ├── inventory-normalization.md
│   ├── packaging-normalization.md
│   ├── quota-and-cache.md
│   ├── provider-terms.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-price-is-contextual.md
│       ├── 0002-stock-and-expected-stock-separated.md
│       ├── 0003-packaging-offers-not-merged.md
│       ├── 0004-contract-price-tenant-isolation.md
│       ├── 0005-no-scraping-fallback.md
│       └── 0006-read-only-agent.md
├── src/
│   └── market_data/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── offer.py
│       │   ├── pricing.py
│       │   ├── inventory.py
│       │   ├── packaging.py
│       │   ├── freshness.py
│       │   └── market_view.py
│       ├── providers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── capabilities.py
│       │   ├── digikey/
│       │   ├── mouser/
│       │   ├── arrow/
│       │   └── element14/
│       ├── auth/
│       │   ├── oauth.py
│       │   ├── api_key.py
│       │   ├── signatures.py
│       │   └── secrets.py
│       ├── normalization/
│       │   ├── identity.py
│       │   ├── packaging.py
│       │   ├── pricing.py
│       │   ├── inventory.py
│       │   ├── lead_time.py
│       │   └── currency.py
│       ├── aggregation/
│       │   ├── authorized.py
│       │   ├── quantity.py
│       │   ├── ranking.py
│       │   └── quality.py
│       ├── quota/
│       ├── cache/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── provider-manifests/
├── provider-terms/
├── packaging-registry/
├── policies/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── test_provider_connection.py
    ├── validate_provider_manifest.py
    ├── validate_packaging_registry.py
    ├── run_market_data_benchmark.py
    ├── inspect_schema_drift.py
    └── redact_fixture.py
```


---

# 49. Codex 分阶段实施

不要让 Codex 一次实现全部 Provider 和全部功能。

## Phase 0：仓库侦察和接口盘点

Codex 必须：

1. 阅读 Agent 31–35 的规格和实际代码；
2. 查找 Part、Manufacturer、Ordering Variant 和 Supplier SKU；
3. 查找现有 DigiKey、Mouser、Arrow、Element14 集成；
4. 查找 API Key、OAuth、Secrets Manager 和多租户账号模型；
5. 查找价格、库存、MOQ、包装和币种数据表；
6. 查找 BOM 批量查询、采购和供应商模块；
7. 查找 Redis、队列、对象存储、Metrics 和审计；
8. 检查是否存在网页爬虫和不合规缓存；
9. 检查日志是否可能泄露 Query String Key；
10. 统计历史数据中的 MPN、SKU、包装和价格质量；
11. 输出 Provider 能力和数据缺口；
12. 不修改业务代码；
13. 不创建 Migration；
14. 不安装依赖。

## Phase 1：Domain Model 与 JSON Schema

实现：

- Request；
- Provider Context；
- Raw Observation；
- Offer Snapshot；
- Price Tier；
- Inventory；
- Packaging；
- Quantity Evaluation；
- Market View；
- Provider Status；
- Event；
- JSON Schema。

## Phase 2：Provider Registry 和 Capability Manifest

实现：

- Provider；
- API Product；
- Version；
- Authentication；
- Feature Flags；
- Quota；
- Locale；
- Terms Profile；
- Manifest Validator；
- Versioning。

## Phase 3：Secrets 和 Authentication

实现：

- API Key；
- OAuth 2.0；
- Refresh Lock；
- Signature；
- Token Cache；
- Redaction；
- Provider Account；
- Sandbox/Production Isolation。

## Phase 4：Canonical Normalization

实现：

- Identity；
- Distributor SKU；
- Source Type；
- Packaging Alias；
- MOQ/Multiple；
- Price Tier；
- Inventory；
- Lead Time；
- Currency；
- Freshness。

## Phase 5：DigiKey Connector

实现：

- Product Information V4；
- ProductPricing；
- ProductDetails；
- Locale；
- Account Pricing；
- Marketplace Filter；
- Rate Headers；
- Token；
- Fixtures。

## Phase 6：Mouser Connector

实现：

- Part Number；
- Manufacturer Filter；
- Price Break；
- Availability；
- MOQ；
- Multiple；
- Packaging；
- Lead Time；
- Quota；
- Fixtures。

## Phase 7：Arrow Connector

实现：

- v4 Pricing & Availability；
- Token/List；
- Manufacturer；
- Inventory Pool；
- Marketplace/Verical Classification；
- Query Redaction；
- Batch Chunk；
- Fixtures。

## Phase 8：Element14 Connector

实现：

- Store Context；
- Generic Price；
- Contract Price；
- Signature；
- Prices/Inventory Response Groups；
- Warehouse；
- Expected Stock；
- Packaging；
- Fixtures。

## Phase 9：Quota、Retry 和 Circuit Breaker

实现：

- Rate Buckets；
- Retry-After；
- Exponential Backoff；
- Provider Semaphore；
- Quota Reserve；
- Circuit；
- Single-flight；
- Partial Failure。

## Phase 10：Cache 和 Freshness

实现：

- Public Cache；
- Private Cache；
- Tenant Isolation；
- Field TTL；
- Stale-while-revalidate；
- Force Refresh；
- Pre-order Rule；
- Terms Retention。

## Phase 11：Quantity Pricing

实现：

- MOQ；
- Order Multiple；
- Price Basis；
- Break Selection；
- Decimal；
- Fees；
- Extended Price；
- Excess Quantity；
- Quote Recommended。

## Phase 12：Authorized Source Policy

实现：

- Source Taxonomy；
- Marketplace；
- Vendor Direct；
- Pool Classification；
- Provider-specific Mapping；
- Authorized-only；
- Audit。

## Phase 13：Aggregator 和 Market View

实现：

- Identity Gate；
- Purchase Context；
- Provider Merge；
- Freshness；
- Best Offer；
- Price/Availability/Balanced Policy；
- Quality；
- Provider Status。

## Phase 14：BOM Batch

实现：

- MPN Dedup；
- Multiple Quantity；
- Provider Batch；
- Chunking；
- Resume；
- Progress；
- Cache-first；
- DNP/Variant；
- Coverage Report。

## Phase 15：Watchlist 和 Change Detection

实现：

- Price Change；
- Stock Change；
- Threshold；
- Refresh Schedule；
- Dedupe；
- Events；
- Alert Hook。

## Phase 16：API、UI Backend 和 Audit

实现：

- Query API；
- BOM API；
- Provider Accounts；
- Health/Quota；
- Read Models；
- Access Control；
- Audit；
- Raw Response Permissions。

## Phase 17：Benchmark、监控和生产发布

实现：

- Connector Benchmark；
- Schema Drift；
- Secret Scan；
- Load Test；
- Metrics；
- Dashboard；
- Provider Rollout；
- Feature Flag；
- Disaster Recovery；
- Terms Review。

## Phase 18：Quote/Cart/Order Hooks，仅定义接口

只定义未来接口：

```text
refresh_for_quote
create_quote_request
create_cart_request
place_order_request
```

不得在 Agent 36 中真实下单。

---

# 50. Codex 工作纪律

Codex 必须：

1. 不把价格保存为 Part 固定字段；
2. 价格绑定 Region、Currency、Account、Packaging、Quantity 和 Time；
3. 库存与预计库存分开；
4. 不把 Expected Stock 算作 In Stock；
5. Manufacturer MPN 与 Distributor SKU 分开；
6. 不合并不同 Packaging Offer；
7. MOQ、Order Multiple、Pack Size 分开；
8. 金额使用 Decimal；
9. 不把 0 当 Unknown；
10. Contract Price 必须租户隔离；
11. 公共缓存和私有缓存分开；
12. Marketplace 默认排除或明确标识；
13. Arrow Inventory Pool 必须分类；
14. DigiKey Marketplace Filter 按策略启用；
15. Element14 Store 必须参与 Cache Key；
16. Provider Locale 必须参与请求和缓存；
17. Keyword Search 只做召回；
18. 精确身份验证后才能聚合；
19. Agent 33 技术结果不能被低价覆盖；
20. Agent 34 生命周期事实不能被 Distributor Status 覆盖；
21. Agent 35 合规结论不能由市场字段替代；
22. API 失败不自动网页抓取；
23. Stale 数据必须打标签；
24. 下单前必须 Force Refresh；
25. Rate Limit 不写死在核心代码；
26. Quota 必须给交互请求留预算；
27. Provider 错误允许部分成功；
28. Schema Drift 必须监控；
29. Query String Credential 必须 Redact；
30. Token 和 Secret 不得进入日志、数据库、Fixture 或对象存储；
31. Terms Profile 必须配置缓存和展示策略；
32. 不假定 API 数据可永久保存或公开再分发；
33. 真实合同价格不能进入公开测试；
34. 不伪造实时数据、Provider 成功或 Benchmark；
35. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Provider Manifest/Policy 变化；
    - 测试命令；
    - 真实结果；
    - Provider 覆盖；
    - Benchmark；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 51. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/market-data-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第36个 Agent：

Authorized Distributor Pricing & Availability Agent / 实时价格与库存 Agent。

本 Agent 负责通过 DigiKey、Mouser、Arrow 和 Element14/Farnell/Newark 官方 API，根据 Agent 32 已解析的标准 Manufacturer、MPN、Part 和 Ordering Variant，获取并标准化：

- Distributor SKU；
- Packaging；
- MOQ；
- Order Multiple；
- Standard Pack；
- Price Breaks；
- Standard/List Price；
- Customer/Contract Price；
- Available Inventory；
- Expected Stock；
- Warehouse；
- Lead Time；
- Marketplace/Vendor Direct Source；
- Region；
- Currency；
- Fetch Time 和 Freshness。

本 Agent 是只读数据 Agent，不创建购物车、不锁价、不下单。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31、32、33、34、35 的规格和实际代码；
3. docs/market-data-agent-spec.md；
4. 当前 Part、Manufacturer、Ordering Variant、Supplier SKU 和 Supplier 数据模型；
5. 当前 BOM、采购、库存、供应商和币种模块；
6. 当前 DigiKey、Mouser、Arrow、Element14 集成；
7. 当前 Secrets、OAuth、API Key、Provider Account 和租户权限；
8. 当前 Redis、Job Queue、Object Storage、Metrics 和 Logging；
9. 当前历史价格、库存、包装、MOQ 和 Lead Time 数据；
10. 当前测试、Docker 和 CI；
11. 官方 Provider API 文档；
12. Sandbox、合成或脱敏 Fixture。

硬约束：

- 不把价格保存为 Part 固定字段；
- 每个 Offer 绑定 Provider、Distributor SKU、Region、Currency、Account、Packaging、Quantity 和 Time；
- Manufacturer MPN 与 Distributor SKU 分开；
- Part、Package Variant 和 Ordering Variant 分开；
- 不合并不同 Packaging Offer；
- MOQ、Order Multiple 和 Standard Pack 分开；
- Available Stock 和 Expected Stock 分开；
- Expected Stock 不得显示为 In Stock；
- Marketplace、Vendor Direct、Division 和 Distributor-owned Inventory 分开；
- authorized_only 默认排除未知 Marketplace；
- Arrow Inventory Pool 必须分类；
- DigiKey Locale、Account 和 Marketplace Filter 必须参与请求；
- Mouser Price Break 不完整时标记 quote_recommended；
- Element14 Store、Generic/Contract Pricing 和 Response Group 分开；
- Keyword Search 只做 Candidate Retrieval；
- 所有结果经 Agent 32 Identity Validation；
- 金额使用 Decimal；
- Missing 不得用 0；
- Standard/Public Pricing 和 Contract/MyPricing 分开；
- Contract Pricing 必须 Tenant/Account 隔离；
- Public Cache 和 Private Cache 分开；
- Cache Key 包含 Region、Currency、Account、Packaging 和 API Version；
- 每条 Offer 保存 requested_at、received_at、source_updated_at、expires_at；
- Stale Cache 必须显示 Stale；
- 下单前必须强制刷新；
- Provider 失败时允许 Partial Success；
- 不自动切换网页爬虫；
- Rate Limit、Quota、Retry、Circuit 和 Single-flight 必须实现；
- Quota 不写死在核心代码；
- Query String Credential 和 Token 必须 Redact；
- Secret 不得进入数据库、日志、对象存储、前端和 Fixture；
- Provider Terms Profile 决定缓存、展示和历史留存；
- 不假定 API 数据可永久缓存或公开再分发；
- Agent 33 技术兼容性不能被低价覆盖；
- Agent 34 生命周期不能被 Distributor Status 覆盖；
- Agent 35 合规不能由市场字段替代；
- 不提交真实合同价格、账号和 Token 到公开仓库；
- 不伪造实时数据、Provider 响应、测试或准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–35 的真实完成程度和接口；
3. 查找 Part、Manufacturer、Ordering Variant 和 Supplier SKU；
4. 查找现有 Provider、Supplier 和 Distributor 数据；
5. 查找 DigiKey、Mouser、Arrow、Element14 代码、配置和 Credential；
6. 查找价格、库存、包装、MOQ、Order Multiple、Lead Time 和 Currency 字段；
7. 查找 Public/Contract Pricing 和租户隔离；
8. 查找 Redis Cache Key、TTL 和 Stale 逻辑；
9. 查找 Rate Limit、Retry、Circuit Breaker 和 Job Queue；
10. 查找 Query String 日志和 Secret 泄露风险；
11. 查找 Marketplace、Vendor Direct 和 Inventory Pool；
12. 查找 BOM 批量查询和去重；
13. 查找历史数据和 Provider Terms；
14. 对脱敏或合成 Fixture 做数据质量抽样；
15. 在 docs/market-data-implementation-plan.md 中生成实施计划；
16. 在 docs/canonical-offer-model.md 中定义 Offer Schema；
17. 在 docs/provider-capability-manifest.md 中定义 Provider 能力；
18. 在 docs/provider-account-security.md 中定义 Credential 和租户隔离；
19. 在 docs/pricing-normalization.md 中定义 Price Tier、Decimal 和 Quantity；
20. 在 docs/inventory-normalization.md 中定义 Stock、Expected 和 Lead Time；
21. 在 docs/packaging-normalization.md 中定义 Packaging、MOQ 和 Multiple；
22. 在 docs/authorized-source-policy.md 中定义 Marketplace 和 Inventory Pool；
23. 在 docs/quota-cache-freshness.md 中定义 Rate、Cache 和 Freshness；
24. 在 docs/provider-terms-design.md 中定义缓存和展示策略；
25. 在 docs/market-data-migration-plan.md 中定义旧价格库存迁移；
26. 在 docs/market-data-benchmark-plan.md 中定义 Benchmark；
27. 给出拟新增、拟修改和拟复用文件；
28. 给出 Phase 1 精确范围；
29. 不修改业务代码；
30. 不创建数据库 Migration；
31. 不安装依赖；
32. 不请求或打印生产 Secret；
33. 运行当前仓库已有 lint、type check、test、build 和 secret scan；
34. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–35 输入契约；
- 当前 Part/Supplier/Offer 数据模型；
- 当前四家 Provider 集成状态；
- Provider Capability Matrix；
- Credential 和 Tenant Isolation；
- Canonical Offer；
- Price/Inventory/Packaging；
- Marketplace/Authorized Policy；
- Cache/Freshness；
- Quota/Retry/Circuit；
- BOM Batch；
- Provider Terms；
- 安全风险；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 52. 后续 Phase 提示词模板

```text
继续实现 Market Data Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–36 规格；
3. 阅读 Market Data Implementation Plan；
4. 阅读 Offer、Provider、Security、Pricing、Inventory、Packaging、Quota、Terms 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Exact Identity；
- Contextual Price；
- Stock/Expected 分离；
- Packaging 不合并；
- Decimal；
- Public/Private Cache 分离；
- Contract Tenant Isolation；
- Authorized Source Policy；
- Timestamp/Freshness；
- Provider Partial Failure；
- Rate/Retry/Circuit；
- Secret Redaction；
- Terms Profile；
- Read-only；
- 不覆盖人工数据；
- 不公开真实账号数据；
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
9. provider mock test；
10. security/secret test；
11. performance test；
12. benchmark；
13. 更新文档；
14. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Provider Manifest/Policy 变化；
- 测试命令和真实结果；
- Provider Coverage；
- Identity/Price/Stock/Packaging 指标；
- Cache/Quota 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 53. MVP 演示流程

1. Agent 32 输入 `TPS62160DSGR`；
2. 输入地区 US、USD、数量 1250；
3. 查询 DigiKey ProductPricing；
4. 查询 Mouser Part Number + Manufacturer；
5. 查询 Arrow Pricing & Availability；
6. 查询 Newark Store；
7. 保存四家 Raw Response；
8. 过滤 Manufacturer 或 MPN 不匹配结果；
9. 分离 Cut Tape、Reel 和 Re-reel；
10. 分离 Public、MyPricing 和 Contract Price；
11. 分离 Arrow 自有库存和 Marketplace Pool；
12. 分离 Available 和 Expected Stock；
13. 计算每个 Offer 合法采购量；
14. 选择对应阶梯价；
15. 计算 Extended Price 和 Excess；
16. 显示 Fetch Time 和 Freshness；
17. Arrow 超时但返回其他三家结果；
18. 返回 `completed_with_partial_failures`；
19. 再次查询命中 Fresh Cache；
20. 两个并发用户同 MPN 只发一个请求；
21. 模拟 429 并遵守 Retry-After；
22. 合同账号 A 的价格不被账号 B 看到；
23. `authorized_only` 隐藏 Marketplace；
24. 切换 `include_marketplace` 显示并打标签；
25. BOM 1000 行按 300 个唯一 MPN 去重；
26. 显示 Price Coverage 和 Stock Coverage；
27. 下单前 Force Refresh；
28. 发布 `bom.market-data.ready`。

---

# 54. 生产上线顺序

第一阶段：

```text
Canonical Offer
Credential Security
DigiKey
Mouser
Exact MPN
Price Tier
Available Stock
Packaging
Freshness
单器件 UI
```

第二阶段：

```text
Arrow
Element14
Marketplace/Pool Policy
Contract Pricing
BOM Batch
Quota/Cache
Provider Health
```

第三阶段：

```text
Watchlist
Price/Stock Change Events
更多授权分销商
Quote Hook
Cart/Order Hook
供应链商业排序
```

上线时先确保：

```text
同一个 MPN
+ 同一个包装
+ 同一个地区
+ 同一个账号
+ 同一个数量
```

得到的价格可以被准确解释和重放。市场数据系统最危险的错误不是“某家 API 暂时失败”，而是把不同包装、地区、合同账号或第三方 Marketplace 的数据混成一个看似漂亮的最低价。

---

# 55. 官方资料基线

Codex Phase 0 应重新核对官方文档，以下为本规格建立时使用的基线：

```text
DigiKey API Developer Portal
https://developer.digikey.com/

DigiKey Product Information V4 - ProductPricing
https://developer.digikey.com/products/product-information-v4/productsearch/productpricing

DigiKey Product Information V4 - ProductDetails
https://developer.digikey.com/products/product-information-v4/productsearch/productdetails

DigiKey FAQ - Products, Plans, and APIs
https://developer.digikey.com/faq/products-plans-and-apis

Mouser Search API
https://www.mouser.com/en/apihome/

Mouser API Documentation
https://api.mouser.com/api/docs/ui/index

Arrow Pricing & Availability API
https://developers.arrow.com/api/index.php/site/page?view=Itemservice

Arrow API Documentation
https://developers.arrow.com/api/

Element14 Product Search API Documentation
https://partner.element14.com/docs/read/Home

Element14 Product Search API REST Description
https://partner.element14.com/docs/Product_Search_API_REST__Description
```

Provider 文档、端点、字段、调用额度和条款会变化，因此：

```text
不要只依赖本设计中的文字
每次 Connector 发布前重新验证官方 Swagger/文档
记录 verified_at 和 document hash
```
