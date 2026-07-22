# 物料与批次追溯 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：42  
> Agent 名称：Material, Lot & Product Genealogy Traceability Agent  
> 中文名称：物料与批次追溯 Agent  
> 类型：程序型  
> 版本：V1.0  
>
> 定位：建立元器件、制造商批次、Date Code、供应商 Lot、采购 PO、收货、IQC、库存、拆包、换包、领料、退料、工单、工序、半成品、成品批次、成品序列号、出货、客户订单、返修、RMA 和召回之间的双向可验证追溯关系。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规、原产地与客户条件
> - Agent 36：实时价格与库存
> - Agent 37：BOM 风险与多源供应
> - Agent 38：MOQ、SPQ 与采购包装优化
> - Agent 39：成本、报价与利润
> - Agent 40：采购计划与缺料协同
> - Agent 41：库存复用与呆滞料
> - ezPLM 物料、采购、库存、质量、生产、销售、售后和文档数据
>
> 下游：
> - 批次追溯报告
> - 成品 Genealogy
> - 客诉、RMA 和失效分析
> - PCN/EOL/质量事件影响分析
> - 供应商 Lot 质量隔离
> - 产品召回范围计算
> - 合规和客户审计
> - 库存复用与客户范围校验
> - 不合格品、返工和报废闭环
> - 质量成本和供应商质量分析
>
> 重要边界：
> - 本 Agent 负责追溯事实、谱系、影响范围和证据，不自动判定器件失效原因，不自动启动召回，不自动报废，不自动修改 BOM 或工单。
> - 追溯关系只能来自事务、扫描、设备记录、人工签署或已验证导入；不能由 LLM 猜测。
> - Lot、Date Code、Serial Number、内部库存批次和供应商批次必须分开。
> - 物料拆分、合并、换包、返工、替代、退料和混批必须建立显式 Genealogy Event。
> - 所有追溯结果必须可重放、可审计、可验证数量守恒。
> - 对于数据缺失，系统必须输出 Trace Gap，而不是伪造完整链路。

---

# 1. 建设目标

系统必须能够：

1. 建立物料主数据、制造商 MPN、内部料号和客户料号映射；
2. 建立 Manufacturer Lot、Supplier Lot、Inventory Lot 和 Date Code；
3. 建立 PO、PO Line、ASN、收货、IQC 和入库关系；
4. 建立库存 Lot 在仓库、库位和状态之间的移动；
5. 建立拆盘、分盘、合盘、换管、换 Tray、Re-reel、烘烤和重新包装关系；
6. 建立领料、退料、补料、超领、报废和退仓关系；
7. 建立工单、工序、工位、产线、班次和设备关系；
8. 建立物料 Lot 到工单和工序的消耗关系；
9. 建立半成品 Lot、在制品 Lot 和返工 Lot；
10. 建立成品批次和成品序列号；
11. 建立成品序列号与内部物料 Lot 的 Genealogy；
12. 建立包装箱、托盘、Shipment 和客户订单关系；
13. 建立客户订单、Ship-to、最终客户和渠道关系；
14. 建立返修、退货、RMA、拆解和重新出货关系；
15. 支持从来料 Lot 向前追踪到成品和客户；
16. 支持从成品序列号向后追踪到全部元器件 Lot、PO 和供应商；
17. 支持从供应商、Manufacturer Lot、Date Code、PO 或 Receipt 追踪；
18. 支持从客户订单、出货批次或成品序列号反向追踪；
19. 支持按 PCN、质量事件、供应商告警和 Date Code 计算受影响范围；
20. 支持产品召回候选范围；
21. 支持最小召回范围和保守召回范围；
22. 支持质量隔离影响传播；
23. 支持多级 BOM 和多级制造 Genealogy；
24. 支持 Phantom Assembly、委外、跨工厂和跨法人制造；
25. 支持客户所有料、寄售料、VMI 和保税料；
26. 支持替代料和临时偏差追溯；
27. 支持混批、混料和 Unknown Lot 的风险标记；
28. 支持数量守恒检查；
29. 支持单位转换；
30. 支持按件、卷、盘、Tray、Tube、Panel、Board 和 Weight 追踪；
31. 支持序列号级、批次级和订单级三种粒度；
32. 支持扫码枪、PDA、MES、ERP、WMS 和设备日志接入；
33. 支持离线采集和补传；
34. 支持事务幂等；
35. 支持事件乱序和迟到数据；
36. 支持 Trace Gap 和 Data Quality；
37. 支持人工补录和审核；
38. 支持证据附件、照片、COC、COA、IQC 和测试记录；
39. 支持追溯图、时间线和表格；
40. 支持审计导出；
41. 支持客户版和内部版追溯报告；
42. 支持多租户、客户、项目、工厂和权限隔离；
43. 支持百万级 Lot 和十亿级 Trace Edge；
44. 支持事件驱动增量更新；
45. 支持快照和历史状态查询；
46. 支持指定时间点的 As-of Trace；
47. 支持追溯链版本；
48. 支持删除限制和不可篡改审计；
49. 支持召回演练；
50. 不因同一 Date Code 就默认同一 Lot；
51. 不因同一 PO 就默认全部物料做进同一成品；
52. 不因工单领料就默认全部领料均被实际消耗；
53. 不因入库就默认质量已放行；
54. 不因退料就丢失原始 Genealogy；
55. 不因重工重新编号而丢失原产品谱系；
56. 不因数据缺失而返回“全部可追溯”。

---

# 2. 与 Agent 31–41 的边界

## 2.1 Agent 31

提供标准 BOM、Reference Designator、Quantity per、Variant 和 DNP。

Agent 42 使用 BOM 作为“预期结构”，但实际追溯以生产事务为准。

## 2.2 Agent 32

提供：

```text
Manufacturer
MPN
Part
Package Variant
Ordering Variant
Internal Part Number
Customer Part Number
```

Agent 42 不自行做模糊型号匹配。

## 2.3 Agent 33

提供已批准替代和适用范围。

Agent 42记录：

```text
original BOM part
actual consumed substitute
alternative relationship
approval/deviation
```

## 2.4 Agent 34

提供 PCN、生命周期、料号变更和厂商关系。

Agent 42用于 PCN 影响范围追踪。

## 2.5 Agent 35

提供合规、COO、客户限制和证据。

Agent 42把合规证据挂接到 Lot、Receipt 和 Shipment。

## 2.6 Agent 36

提供 Provider 和 Distributor SKU。

用于采购来源和授权渠道追溯，不用于推测实际 Lot。

## 2.7 Agent 37

提供供应风险、供应商风险和区域风险。

Agent 42输出受影响产品和客户范围。

## 2.8 Agent 38

提供包装、Re-reel、拆分和转换计划。

实际执行后，Agent 42记录包装转换 Genealogy。

## 2.9 Agent 39

提供成本和报价。

Agent 42可输出质量事件和召回的数量/产品范围，供 Agent 39计算成本，但不自行计算利润。

## 2.10 Agent 40

提供工单、需求、Pegging、PO、ETA 和计划关系。

Agent 42记录实际发生事实，并可与计划关系对比。

## 2.11 Agent 41

提供库存复用、跨项目共享、替代库存和调拨建议。

正式执行后，Agent 42记录库存来源、所有权和需求去向。

---

# 3. 核心原则

## 3.1 追溯事实与预期结构分开

```text
Expected BOM
Actual Material Genealogy
```

两者必须同时保存。

## 3.2 Lot 类型分开

```text
manufacturer_lot
supplier_lot
receipt_lot
inventory_lot
production_lot
finished_goods_lot
return_lot
rework_lot
```

## 3.3 Date Code 不是 Lot

同一 Date Code 可包含多个 Manufacturer Lot；同一 Manufacturer Lot 也可能被供应商拆成多个 Supplier Lot。

## 3.4 领料不等于消耗

```text
material_issue
material_load
material_consumption
material_return
scrap
```

必须分开。

## 3.5 工单批次与成品序列号分开

```text
work_order
production_lot
finished_good_lot
serial_number
```

## 3.6 拆分与合并必须显式

```text
split
merge
repack
re_reel
mix
blend
rework
```

不能只更新库存数量。

## 3.7 数量必须守恒

每个转换事件必须验证：

```text
input quantity
= output quantity
+ scrap
+ process loss
+ sample
```

考虑单位转换和精度。

## 3.8 Trace Gap 必须显式

```text
unknown lot
missing receipt
unlinked issue
unrecorded split
missing consumption
serial genealogy incomplete
```

## 3.9 不可篡改事件

已发布追溯事件不能覆盖，只能：

```text
reverse
correct
supersede
```

## 3.10 As-of 查询

支持查询某个历史时间点的谱系和库存状态。

## 3.11 粒度必须声明

```text
serial-level
lot-level
work-order-level
shipment-level
statistical
unknown
```

不能把 Lot 级追溯显示成 Serial 级精度。

## 3.12 证据链

每个 Edge 保存：

```text
source system
transaction id
operator/device
timestamp
document
confidence
```

## 3.13 追溯关系是图，不是单表

推荐：

```text
Entity Node
Transformation/Event Node
Directed Edge
```

## 3.14 程序优先

核心追溯、数量守恒、影响范围和召回计算全部使用程序和图算法，不使用 LLM。

---

# 4. 追溯对象模型

## 4.1 Entity Node

```text
part
manufacturer_part
supplier_sku
manufacturer_lot
supplier_lot
receipt_lot
inventory_lot
container
reel
tray
tube
work_order
operation
production_lot
wip_lot
finished_good_lot
serial_number
shipment
customer_order
rma
rework_order
```

## 4.2 Event Node

```text
purchase
asn
receipt
iqc
putaway
move
split
merge
repack
re_reel
bake
issue
load
consume
return
scrap
produce
assemble
test
rework
pack
ship
receive_return
disassemble
dispose
```

## 4.3 Edge

```text
source entity
event
target entity
quantity
unit
time
site
evidence
```

---

# 5. 标识体系

每种标识保存：

```text
identifier_type
identifier_value
issuer
scope
valid_from
valid_to
```

支持：

```text
MPN
IPN
Customer PN
Supplier SKU
Manufacturer Lot
Supplier Lot
Date Code
PO Number
Receipt Number
Inventory Lot
Work Order
Production Lot
Serial Number
Shipment Number
Customer Order
RMA Number
```

---

# 6. Lot 标识

Lot 必须有内部全局唯一 ID：

```text
lot_id UUID
```

业务标签可重复：

```text
lot_number
```

唯一性范围：

```text
issuer
part
site
date
```

不能假设字符串 Lot Number 全局唯一。

---

# 7. Date Code

保存：

```text
raw_value
normalized_value
format
year
week/month/day
source
confidence
```

示例：

```text
2440 → 2024 week 40
```

但必须保留 Raw Value。

Date Code 解析失败时：

```text
date_code_status = unknown
```

---

# 8. Manufacturer Lot 和 Supplier Lot

关系可能：

```text
Manufacturer Lot
→ Supplier Lot
→ Receipt Lot
→ Inventory Lot
```

供应商可能混合或拆分多个 Manufacturer Lot，需要显式记录。

---

# 9. PO 与收货

层级：

```text
PO
→ PO Line
→ ASN
→ Receipt
→ Receipt Line
→ Receipt Lot
→ IQC
→ Inventory Lot
```

每层保存：

```text
quantity
unit
supplier
part
date
site
document
status
```

---

# 10. IQC 和质量状态

```text
received
pending inspection
sampled
released
conditional release
quality hold
rejected
returned
reworked
scrapped
```

质量放行事件决定库存可用性，但不删除收货事实。

---

# 11. 库存移动

```text
putaway
bin move
warehouse transfer
site transfer
intercompany transfer
customer ownership transfer
```

每次移动建立事件，不覆盖原始位置历史。

---

# 12. 包装容器

容器类型：

```text
reel
tray
tube
bag
box
carton
pallet
moisture barrier bag
custom container
```

支持父子容器：

```text
component lot
→ reel
→ carton
→ pallet
```

---

# 13. 拆分

输入：

```text
source lot/container
```

输出：

```text
child lots/containers
```

字段：

```text
input quantity
output quantities
scrap
operator
equipment
reason
```

---

# 14. 合并和混批

合并多个 Lot 必须创建：

```text
merge event
new mixed lot
```

保存所有父 Lot 和数量比例。

Mixed Lot 应降低追溯精度：

```text
trace_precision = proportional_or_unknown
```

---

# 15. Re-reel 和换包

记录：

```text
source reel/lot
target reel/container
quantity
leader/trailer
orientation
service provider
loss
new label
original trace link
```

不得因换包生成新的“无来源 Lot”。

---

# 16. 烘烤和重新封装

记录：

```text
bake profile
temperature
duration
equipment
operator
before/after MSL status
reseal
desiccant
humidity indicator
```

---

# 17. 领料

领料关系：

```text
inventory lot
→ material issue
→ work order
```

保存：

```text
requested
issued
actual loaded
returned
scrapped
```

---

# 18. 上料和 Feeder

可选高精度追溯：

```text
inventory lot/reel
→ feeder load
→ machine
→ operation
→ time range
```

这允许将设备 Placement Log 映射到成品序列号。

---

# 19. 实际消耗

消耗来源优先级：

```text
machine placement log
barcode scan
MES issue confirmation
backflush
manual declaration
```

每种来源保存 Precision 和 Confidence。

---

# 20. Backflush

Backflush 是推算，不是直接扫描事实。

保存：

```text
trace_method = backflush
precision = work_order_or_lot_level
```

不能显示为序列号级确定关系。

---

# 21. 工序

```text
operation_id
routing step
work center
equipment
start/end
operator
input lots
output lots
yield
scrap
test
```

---

# 22. 半成品

```text
wip lot
subassembly lot
panel lot
board lot
module lot
```

多层装配关系：

```text
component lots
→ PCB assembly lot
→ module lot
→ finished product
```

---

# 23. Panel 和 Board

支持：

```text
PCB panel serial
board position
depanelization
board serial
```

关系：

```text
panel
→ board positions
→ board serials
```

---

# 24. 成品序列号

支持：

```text
unit serial
IMEI/MAC/UUID
security certificate id
customer serial
```

序列号关系必须版本化，避免返修后丢失历史。

---

# 25. 成品批次

对于无序列号产品：

```text
finished_goods_lot
quantity
production date
work orders
input lot proportions
```

---

# 26. 包装与出货

```text
serial/finished lot
→ inner box
→ carton
→ pallet
→ shipment
→ customer order
```

支持拆箱、重装和部分出货。

---

# 27. 客户订单

保存：

```text
sales order
sales order line
customer
ship-to
channel
shipment
quantity
serial/lot list
```

客户信息按权限隔离。

---

# 28. 返修和 RMA

```text
customer shipment
→ RMA
→ returned serial/lot
→ diagnosis
→ disassembly
→ replacement parts
→ rework
→ re-test
→ re-ship
```

返修后保留原始 Genealogy 和新增 Genealogy。

---

# 29. 报废

报废事件记录：

```text
entity
quantity
reason
approval
disposal method
evidence
```

报废不删除上游追溯。

---

# 30. 双向追溯

## 30.1 Forward Trace

从：

```text
supplier
PO
manufacturer lot
supplier lot
date code
receipt lot
inventory lot
```

追踪到：

```text
work orders
production lots
serial numbers
shipments
customers
RMA
```

## 30.2 Backward Trace

从：

```text
serial number
finished goods lot
shipment
customer order
RMA
```

追踪到：

```text
operations
work order
inventory lots
receipt
PO
supplier
manufacturer lot
date code
```

---

# 31. 影响范围

输入：

```text
affected entity
time window
quantity/lot subset
event type
```

输出：

```text
affected inventory
affected WIP
affected finished goods
affected shipments
affected customers
affected RMAs
untraceable quantity
```

---

# 32. 召回范围

## 32.1 Minimum Confirmed Scope

只包含有明确 Edge 的产品。

## 32.2 Conservative Scope

包含：

```text
confirmed
probable
unknown allocation within time window
mixed lot exposure
backflush exposure
```

两者都要输出。

---

# 33. PCN 影响分析

输入 Agent 34：

```text
affected MPN
lot/date range
manufacturing site
effective date
```

映射到实际库存、工单、产品和客户。

---

# 34. 质量事件

支持：

```text
supplier quality alert
incoming inspection failure
field failure
test drift
counterfeit concern
storage excursion
MSL violation
```

---

# 35. Trace Gap

类型：

```text
missing_identity
missing_lot
missing_receipt
missing_issue
missing_consumption
missing_output
missing_serial
missing_shipment_link
quantity_mismatch
unit_conversion_unknown
late_event
conflicting_event
```

---

# 36. Trace Completeness

输出：

```text
identity completeness
lot completeness
receipt completeness
consumption completeness
serial completeness
shipment completeness
quantity conservation
evidence completeness
overall trace completeness
```

---

# 37. Trace Precision

```text
serial_exact
lot_exact
work_order_exact
time_window_inferred
backflush_estimated
mixed_lot_proportional
unknown
```

---

# 38. 数量守恒

每个 Event：

```text
input quantity
= output quantity
+ scrap
+ sample
+ process loss
```

允许：

```text
measurement tolerance
unit conversion
rounding tolerance
```

所有例外显式记录。

---

# 39. 单位

支持：

```text
each
piece
reel
tray
tube
panel
board
meter
gram
kilogram
milliliter
```

单位转换必须来自版本化 Conversion Rule。

---

# 40. 标准追溯事件

```json
{
  "trace_event_id": "uuid",
  "event_type": "consume",
  "occurred_at": "2026-07-20T10:15:00Z",
  "recorded_at": "2026-07-20T10:15:03Z",

  "source_system": "MES",
  "source_transaction_id": "MES-12345",
  "site_id": "uuid",
  "operator_id": "uuid",
  "equipment_id": "uuid",

  "inputs": [
    {
      "entity_type": "inventory_lot",
      "entity_id": "uuid",
      "quantity": "100",
      "unit": "each"
    }
  ],

  "outputs": [
    {
      "entity_type": "production_lot",
      "entity_id": "uuid",
      "quantity": "100",
      "unit": "each"
    }
  ],

  "losses": [],
  "evidence_ids": [],
  "trace_method": "barcode_scan",
  "precision": "lot_exact"
}
```

---

# 41. 事件不可变性

更正方式：

```text
original event
→ reversal event
→ corrected event
```

禁止更新原事件数量或实体。

---

# 42. 事件顺序

同时保存：

```text
occurred_at
recorded_at
source_sequence
ingestion_sequence
```

支持迟到和乱序事件。

---

# 43. 幂等

唯一键：

```text
source_system
source_transaction_id
event_type
```

重复导入不能产生重复 Edge。

---

# 44. 标准追溯查询

```json
{
  "query_id": "uuid",
  "direction": "backward",
  "start_entities": [
    {
      "entity_type": "serial_number",
      "identifier": "SN-000123"
    }
  ],
  "as_of": "2026-07-20T23:59:59Z",
  "max_depth": 20,
  "include_probable": true,
  "include_unknown": true,
  "customer_view": false
}
```

---

# 45. 追溯结果

```json
{
  "query_id": "uuid",
  "status": "completed",
  "summary": {
    "nodes": 218,
    "events": 94,
    "edges": 311,
    "trace_completeness": 0.97,
    "untraceable_quantity": "2"
  },
  "graph_uri": "s3://.../graph.json.zst",
  "timeline_uri": "s3://.../timeline.json",
  "gaps_uri": "s3://.../gaps.json",
  "report_uri": "s3://.../trace-report.pdf"
}
```

---

# 46. 权限视图

## 内部视图

显示：

```text
supplier
PO
cost-sensitive identifiers
customer
operator
quality records
```

## 客户视图

可隐藏：

```text
其他客户
供应商合同信息
内部成本
人员敏感信息
内部工艺机密
```

---

# 47. 审计证据

支持：

```text
PO
ASN
Packing List
COC
COA
IQC
Barcode Scan
Machine Log
Test Record
Photo
Shipment Document
RMA
Disposition Certificate
```

---

# 48. 报告类型

```text
material forward trace
finished product backward trace
customer shipment genealogy
PCN impact
quality event impact
recall scope
lot containment
trace completeness
quantity reconciliation
audit package
```

---

# 49. 状态机

```text
RECEIVED
→ RESOLVING_IDENTIFIERS
→ LOADING_GRAPH
→ APPLYING_AS_OF_FILTER
→ TRAVERSING
→ RECONCILING_QUANTITIES
→ CALCULATING_COMPLETENESS
→ IDENTIFYING_GAPS
→ CALCULATING_IMPACT
→ GENERATING_REPORT
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_GAPS
REVIEW_REQUIRED
IDENTIFIER_AMBIGUOUS
GRAPH_INCOMPLETE
QUANTITY_MISMATCH
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 50. 错误码

```text
IDENTIFIER_NOT_FOUND
IDENTIFIER_AMBIGUOUS
PART_IDENTITY_UNRESOLVED
LOT_NOT_FOUND
SERIAL_NOT_FOUND
PO_NOT_FOUND
RECEIPT_NOT_FOUND
WORK_ORDER_NOT_FOUND
SHIPMENT_NOT_FOUND
CUSTOMER_ORDER_NOT_FOUND
TRACE_EVENT_DUPLICATE
TRACE_EVENT_INVALID
TRACE_EVENT_OUT_OF_ORDER
TRACE_EDGE_INVALID
UNIT_CONVERSION_MISSING
QUANTITY_CONSERVATION_FAILED
MIXED_LOT_PRECISION_LIMIT
TRACE_GAP_DETECTED
TRACE_DEPTH_EXCEEDED
AS_OF_TIME_INVALID
CUSTOMER_SCOPE_FORBIDDEN
REPORT_GENERATION_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 51. 数据库设计

## 51.1 `trace_entities`

```text
id UUID PK
tenant_id UUID NOT NULL
entity_type VARCHAR NOT NULL
canonical_identifier VARCHAR NOT NULL
part_id UUID NULL
ordering_variant_id UUID NULL
site_id UUID NULL
organization_id UUID NULL
customer_id UUID NULL
project_id UUID NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ NOT NULL
retired_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, entity_type, canonical_identifier)
```

## 51.2 `trace_entity_identifiers`

```text
id UUID PK
entity_id UUID NOT NULL
identifier_type VARCHAR NOT NULL
identifier_value VARCHAR NOT NULL
issuer VARCHAR NULL
scope JSONB NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
is_primary BOOLEAN NOT NULL
created_at TIMESTAMPTZ
UNIQUE(entity_id, identifier_type, identifier_value, issuer)
```

## 51.3 `trace_lots`

```text
id UUID PK
trace_entity_id UUID NOT NULL
lot_type VARCHAR NOT NULL
lot_number VARCHAR NULL
manufacturer_lot_number VARCHAR NULL
supplier_lot_number VARCHAR NULL
date_code_raw VARCHAR NULL
date_code_normalized VARCHAR NULL
date_code_year INT NULL
date_code_period INT NULL
date_code_format VARCHAR NULL
quantity NUMERIC NULL
unit VARCHAR NULL
quality_status VARCHAR NULL
ownership_type VARCHAR NULL
owner_id UUID NULL
country_of_origin VARCHAR NULL
trace_precision VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.4 `trace_serial_numbers`

```text
id UUID PK
trace_entity_id UUID NOT NULL
serial_type VARCHAR NOT NULL
serial_value VARCHAR NOT NULL
product_id UUID NULL
product_variant_id UUID NULL
manufactured_at TIMESTAMPTZ NULL
current_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(serial_type, serial_value)
```

## 51.5 `trace_containers`

```text
id UUID PK
trace_entity_id UUID NOT NULL
container_type VARCHAR NOT NULL
parent_container_entity_id UUID NULL
label_identifier VARCHAR NULL
capacity NUMERIC NULL
capacity_unit VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.6 `trace_events`

```text
id UUID PK
tenant_id UUID NOT NULL
event_type VARCHAR NOT NULL
occurred_at TIMESTAMPTZ NOT NULL
recorded_at TIMESTAMPTZ NOT NULL
source_system VARCHAR NOT NULL
source_transaction_id VARCHAR NOT NULL
source_sequence VARCHAR NULL
ingestion_sequence BIGSERIAL
site_id UUID NULL
organization_id UUID NULL
operator_id UUID NULL
equipment_id UUID NULL
work_order_id UUID NULL
operation_id UUID NULL
trace_method VARCHAR NOT NULL
trace_precision VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
supersedes_event_id UUID NULL
reverses_event_id UUID NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, source_system, source_transaction_id, event_type)
```

## 51.7 `trace_event_inputs`

```text
id UUID PK
trace_event_id UUID NOT NULL
entity_id UUID NOT NULL
quantity NUMERIC NULL
unit VARCHAR NULL
role VARCHAR NOT NULL
sequence INT NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 51.8 `trace_event_outputs`

```text
id UUID PK
trace_event_id UUID NOT NULL
entity_id UUID NOT NULL
quantity NUMERIC NULL
unit VARCHAR NULL
role VARCHAR NOT NULL
sequence INT NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 51.9 `trace_event_losses`

```text
id UUID PK
trace_event_id UUID NOT NULL
loss_type VARCHAR NOT NULL
quantity NUMERIC NOT NULL
unit VARCHAR NOT NULL
reason_code VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 51.10 `trace_edges`

```text
id UUID PK
tenant_id UUID NOT NULL
source_entity_id UUID NOT NULL
trace_event_id UUID NOT NULL
target_entity_id UUID NOT NULL
quantity NUMERIC NULL
unit VARCHAR NULL
edge_type VARCHAR NOT NULL
trace_precision VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
effective_from TIMESTAMPTZ NOT NULL
effective_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(source_entity_id, trace_event_id, target_entity_id, edge_type)
```

## 51.11 `purchase_trace_links`

```text
id UUID PK
po_id UUID NOT NULL
po_line_id UUID NOT NULL
asn_id UUID NULL
receipt_id UUID NULL
receipt_line_id UUID NULL
receipt_lot_entity_id UUID NOT NULL
supplier_id UUID NOT NULL
supplier_sku VARCHAR NULL
ordered_quantity NUMERIC NULL
received_quantity NUMERIC NOT NULL
unit VARCHAR NOT NULL
received_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
```

## 51.12 `inventory_trace_states`

```text
id UUID PK
inventory_lot_entity_id UUID NOT NULL
warehouse_id UUID NOT NULL
bin_id UUID NULL
quantity NUMERIC NOT NULL
unit VARCHAR NOT NULL
inventory_status VARCHAR NOT NULL
ownership_type VARCHAR NULL
owner_id UUID NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
source_event_id UUID NOT NULL
created_at TIMESTAMPTZ
```

## 51.13 `production_trace_links`

```text
id UUID PK
work_order_id UUID NOT NULL
operation_id UUID NULL
production_lot_entity_id UUID NULL
finished_good_lot_entity_id UUID NULL
serial_entity_id UUID NULL
trace_event_id UUID NOT NULL
actual_bom_revision VARCHAR NULL
product_variant_id UUID NULL
production_line_id UUID NULL
shift_id UUID NULL
created_at TIMESTAMPTZ
```

## 51.14 `material_consumption_records`

```text
id UUID PK
work_order_id UUID NOT NULL
operation_id UUID NULL
input_lot_entity_id UUID NOT NULL
output_entity_id UUID NULL
part_id UUID NOT NULL
planned_quantity NUMERIC NULL
issued_quantity NUMERIC NULL
loaded_quantity NUMERIC NULL
consumed_quantity NUMERIC NULL
returned_quantity NUMERIC NULL
scrapped_quantity NUMERIC NULL
unit VARCHAR NOT NULL
reference_designators JSONB NOT NULL
trace_method VARCHAR NOT NULL
trace_precision VARCHAR NOT NULL
source_event_id UUID NOT NULL
created_at TIMESTAMPTZ
```

## 51.15 `shipment_trace_links`

```text
id UUID PK
shipment_id UUID NOT NULL
shipment_line_id UUID NULL
sales_order_id UUID NOT NULL
sales_order_line_id UUID NULL
customer_id UUID NOT NULL
ship_to_id UUID NULL
container_entity_id UUID NULL
finished_good_lot_entity_id UUID NULL
serial_entity_id UUID NULL
quantity NUMERIC NOT NULL
unit VARCHAR NOT NULL
shipped_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
```

## 51.16 `rma_trace_links`

```text
id UUID PK
rma_id UUID NOT NULL
rma_line_id UUID NULL
original_shipment_id UUID NULL
serial_entity_id UUID NULL
finished_good_lot_entity_id UUID NULL
return_lot_entity_id UUID NULL
rework_order_id UUID NULL
diagnosis_id UUID NULL
received_at TIMESTAMPTZ NULL
re_shipped_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.17 `trace_evidence`

```text
id UUID PK
tenant_id UUID NOT NULL
evidence_type VARCHAR NOT NULL
source_system VARCHAR NOT NULL
source_reference VARCHAR NULL
document_uri TEXT NULL
document_hash CHAR(64) NULL
mime_type VARCHAR NULL
captured_at TIMESTAMPTZ NULL
operator_id UUID NULL
equipment_id UUID NULL
status VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 51.18 `trace_event_evidence_links`

```text
id UUID PK
trace_event_id UUID NOT NULL
evidence_id UUID NOT NULL
relationship VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(trace_event_id, evidence_id, relationship)
```

## 51.19 `trace_gaps`

```text
id UUID PK
tenant_id UUID NOT NULL
gap_type VARCHAR NOT NULL
entity_id UUID NULL
trace_event_id UUID NULL
related_entity_ids JSONB NOT NULL
severity VARCHAR NOT NULL
quantity NUMERIC NULL
unit VARCHAR NULL
reason_codes JSONB NOT NULL
detected_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
resolution JSONB NULL
resolved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 51.20 `trace_reconciliation_results`

```text
id UUID PK
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
period_start TIMESTAMPTZ NULL
period_end TIMESTAMPTZ NULL
input_quantity NUMERIC NULL
output_quantity NUMERIC NULL
loss_quantity NUMERIC NULL
unexplained_variance NUMERIC NULL
unit VARCHAR NULL
tolerance NUMERIC NULL
status VARCHAR NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 51.21 `trace_queries`

```text
id UUID PK
tenant_id UUID NOT NULL
direction VARCHAR NOT NULL
start_entities JSONB NOT NULL
as_of TIMESTAMPTZ NULL
max_depth INT NOT NULL
include_probable BOOLEAN NOT NULL
include_unknown BOOLEAN NOT NULL
customer_view BOOLEAN NOT NULL
status VARCHAR NOT NULL
node_count BIGINT NULL
edge_count BIGINT NULL
event_count BIGINT NULL
trace_completeness NUMERIC(5,4) NULL
graph_uri TEXT NULL
timeline_uri TEXT NULL
gaps_uri TEXT NULL
report_uri TEXT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 51.22 `trace_impact_analyses`

```text
id UUID PK
tenant_id UUID NOT NULL
analysis_type VARCHAR NOT NULL
source_entities JSONB NOT NULL
time_window JSONB NULL
scope_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
affected_inventory_count BIGINT NOT NULL
affected_wip_count BIGINT NOT NULL
affected_finished_good_count BIGINT NOT NULL
affected_shipment_count BIGINT NOT NULL
affected_customer_count BIGINT NOT NULL
untraceable_quantity NUMERIC NULL
minimum_scope_uri TEXT NOT NULL
conservative_scope_uri TEXT NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 51.23 `trace_report_versions`

```text
id UUID PK
trace_query_id UUID NULL
impact_analysis_id UUID NULL
report_type VARCHAR NOT NULL
version_number INT NOT NULL
audience VARCHAR NOT NULL
template_version VARCHAR NOT NULL
locale VARCHAR NOT NULL
json_uri TEXT NOT NULL
html_uri TEXT NULL
pdf_uri TEXT NULL
document_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
```

## 51.24 `trace_corrections`

```text
id UUID PK
original_event_id UUID NOT NULL
reversal_event_id UUID NULL
corrected_event_id UUID NULL
reason_code VARCHAR NOT NULL
requested_by UUID NOT NULL
approved_by UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 51.25 `trace_audit_log`

```text
id UUID PK
tenant_id UUID NOT NULL
actor_type VARCHAR NOT NULL
actor_id UUID NULL
action VARCHAR NOT NULL
object_type VARCHAR NOT NULL
object_id UUID NOT NULL
before_hash CHAR(64) NULL
after_hash CHAR(64) NULL
metadata JSONB NOT NULL
occurred_at TIMESTAMPTZ NOT NULL
```

---

# 52. 图存储策略

V1 推荐：

```text
PostgreSQL 事实表
+ 邻接表 trace_edges
+ 分区
+ 物化路径缓存
```

可选：

```text
Neo4j
Amazon Neptune
JanusGraph
TigerGraph
```

原则：

- PostgreSQL 是事务和审计事实源；
- 图数据库可以作为查询索引；
- 图索引可重建；
- 不允许图数据库成为唯一不可恢复事实源。

---

# 53. 分区和索引

按以下字段分区：

```text
tenant_id
occurred_at month
entity_type
site_id
```

关键索引：

```text
trace_edges(source_entity_id)
trace_edges(target_entity_id)
trace_events(source_system, source_transaction_id)
trace_entity_identifiers(identifier_type, identifier_value)
trace_lots(manufacturer_lot_number)
trace_lots(supplier_lot_number)
trace_lots(date_code_normalized)
shipment_trace_links(customer_id, shipped_at)
production_trace_links(work_order_id)
```

---

# 54. 物化路径和缓存

对常用关系缓存：

```text
inventory lot → finished serial
finished serial → component lots
manufacturer lot → shipments
shipment → customers
```

缓存必须绑定：

```text
graph_version
as_of
policy
```

事件更新后增量失效。

---

# 55. 对象存储

```text
derived/traceability/
  {tenant_id}/
    events/
      yyyy/mm/dd/
        events-{partition}.json.zst
    evidence/
      {evidence_id}/
    queries/
      {query_id}/
        request.json
        graph.json.zst
        timeline.json.zst
        gaps.json
        reconciliation.json
        report-internal.html
        report-internal.pdf
        report-customer.html
        report-customer.pdf
    impacts/
      {analysis_id}/
        minimum-scope.json.zst
        conservative-scope.json.zst
        affected-inventory.json.zst
        affected-wip.json.zst
        affected-products.json.zst
        affected-shipments.json.zst
        affected-customers.json.zst
        trace-gaps.json
    audits/
      {audit_package_id}/
        manifest.json
        evidence-index.json
        hashes.json
        report.pdf
```

---

# 56. 事件接入

输入来源：

```text
ERP
WMS
MES
QMS
PLM
Supplier Portal
Barcode/PDA
SMT machine logs
Test equipment
Shipping system
RMA system
```

统一进入：

```text
Trace Event Ingestion API
→ Schema Validation
→ Identity Resolution
→ Idempotency
→ Quantity Validation
→ Persist Event
→ Build Edges
→ Reconcile
→ Publish
```

---

# 57. 事件 Schema 版本

每个事件保存：

```text
event_schema_version
source_adapter_version
normalization_version
```

Adapter 升级不能改变历史事件。

---

# 58. API 设计

## 58.1 事件接入

```text
POST /api/v1/traceability/events
POST /api/v1/traceability/events/batch
POST /api/v1/traceability/events/{id}/reverse
POST /api/v1/traceability/events/{id}/correct
GET  /api/v1/traceability/events/{id}
```

## 58.2 实体

```text
GET /api/v1/traceability/entities/{id}
GET /api/v1/traceability/entities/resolve
GET /api/v1/traceability/lots/{id}
GET /api/v1/traceability/serials/{id}
GET /api/v1/traceability/containers/{id}
```

## 58.3 双向追溯

```text
POST /api/v1/traceability/queries
GET  /api/v1/traceability/queries/{id}
GET  /api/v1/traceability/queries/{id}/graph
GET  /api/v1/traceability/queries/{id}/timeline
GET  /api/v1/traceability/queries/{id}/gaps
GET  /api/v1/traceability/queries/{id}/report
```

## 58.4 快速查询

```text
GET /api/v1/traceability/forward
GET /api/v1/traceability/backward
GET /api/v1/traceability/where-used
GET /api/v1/traceability/where-from
```

## 58.5 影响和召回

```text
POST /api/v1/traceability/impact-analyses
GET  /api/v1/traceability/impact-analyses/{id}
GET  /api/v1/traceability/impact-analyses/{id}/minimum-scope
GET  /api/v1/traceability/impact-analyses/{id}/conservative-scope
POST /api/v1/traceability/recall-drills
```

## 58.6 Gap 和对账

```text
GET  /api/v1/traceability/gaps
GET  /api/v1/traceability/gaps/{id}
POST /api/v1/traceability/gaps/{id}/resolve
POST /api/v1/traceability/reconciliation
GET  /api/v1/traceability/reconciliation/{id}
```

## 58.7 报告和审计

```text
POST /api/v1/traceability/reports
GET  /api/v1/traceability/reports/{id}
POST /api/v1/traceability/audit-packages
GET  /api/v1/traceability/audit-packages/{id}
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 59. 输入事件

```text
purchase-order.created
purchase-order.changed
asn.created
receipt.created
iqc.completed
inventory.putaway
inventory.moved
inventory.split
inventory.merged
inventory.repacked
inventory.re_reel.completed
inventory.baked
inventory.issued
inventory.returned
inventory.scrapped
work-order.released
operation.started
material.loaded
material.consumed
operation.completed
production-lot.created
serial.assigned
test.completed
finished-goods.received
shipment.created
shipment.dispatched
customer-order.fulfilled
rma.created
rma.received
rework.completed
disposition.completed
```

---

# 60. 输出事件

```text
trace.event.accepted
trace.event.rejected
trace.edge.created
trace.gap.detected
trace.quantity-mismatch.detected
trace.forward.ready
trace.backward.ready
trace.impact.ready
trace.recall-scope.ready
trace.audit-package.ready
trace.completeness.changed
```

---

# 61. 事件乱序处理

策略：

```text
accept late event
mark unresolved dependency
retry edge build
reconcile when parent appears
```

例如 Consumption 先于 Receipt 到达：

```text
event accepted
dependency gap created
later receipt resolves gap
```

---

# 62. 冲突处理

冲突示例：

```text
same lot assigned two different parts
same serial assigned two products
quantity consumed beyond available
shipment before production
```

处理：

```text
quarantine conflicting edges
create review
do not silently choose one
```

---

# 63. 追溯图遍历

Forward：

```text
BFS/DFS from source entity
follow event outputs
```

Backward：

```text
BFS/DFS from target entity
follow event inputs
```

支持：

```text
max depth
event type filter
time window
site
customer
precision
confidence
```

---

# 64. 图遍历防护

- 循环检测；
- 最大深度；
- 最大节点数；
- 查询超时；
- 权限过滤；
- 敏感节点脱敏；
- 分页和流式输出。

---

# 65. 混批传播

若 Mixed Lot 包含多个父 Lot：

```text
exact proportional quantity known
```

则按比例传播。

如果比例未知：

```text
all outputs potentially exposed
```

并降低 Precision。

---

# 66. Backflush 传播

Backflush 只能证明：

```text
某 Work Order 时间范围可能使用了某 Lot
```

不能证明具体序列号精确使用。

输出：

```text
probable exposure
```

---

# 67. 序列号映射

高精度场景需要：

```text
machine time window
feeder lot load time
board serial production time
placement log
```

映射算法必须保存窗口和规则版本。

---

# 68. Recall Scope 算法

## Minimum Scope

遍历：

```text
confirmed edges only
```

## Conservative Scope

遍历：

```text
confirmed
+ probable
+ mixed-lot potential
+ backflush time-window
+ unresolved gaps in affected window
```

输出两套结果及差异。

---

# 69. 质量隔离传播

当 Lot 被质量冻结：

```text
unconsumed inventory → block
WIP → hold
finished goods → hold
shipped products → customer impact review
```

Agent 42只生成范围和任务，不自动执行冻结。

---

# 70. 召回演练

定期随机选择：

```text
supplier lot
date code
finished serial
```

测量：

```text
time to trace
completeness
affected quantity
customer identification
gap count
```

---

# 71. Trace SLA

示例目标：

```text
serial backward trace < 5 s
lot forward trace < 10 s
100k affected units impact < 60 s
audit package < 5 min
```

---

# 72. Data Quality 规则

```text
missing manufacturer lot
missing date code
missing PO receipt link
missing issue return
unknown consumption
mixed lot unknown ratio
serial not linked to shipment
```

每个工厂和产品显示 Coverage。

---

# 73. Trace Completeness 评分

推荐分维度，不只一个总分：

```text
identity
supplier
receipt
inventory
production
serial
shipment
customer
return
evidence
```

总分不能掩盖关键维度为零。

---

# 74. 证据哈希

文档和关键事件保存 SHA-256：

```text
document_hash
event_payload_hash
report_hash
```

用于审计完整性，不等于法律区块链。

---

# 75. 数据保留

按：

```text
product life
warranty
customer contract
regulatory requirement
quality policy
```

配置。

删除策略：

```text
legal hold
archive
anonymize customer PII
never hard-delete trace event
```

---

# 76. 权限

角色：

```text
traceability_operator
warehouse
quality
manufacturing
procurement
engineering
customer_support
recall_manager
auditor
administrator
```

客户视图只能看其自身出货和授权数据。

---

# 77. 多租户和客户隔离

所有节点和边都带：

```text
tenant_id
customer_scope
organization_scope
```

查询遍历过程中逐 Edge 做授权过滤，不能只过滤最终结果。

---

# 78. 隐私

客户报告中可隐藏：

```text
其他客户名称
供应商合同编号
操作员身份
内部工艺路线
成本
商业敏感数据
```

---

# 79. 安全

- 事件 API 使用服务身份和签名；
- 设备接入使用证书或短期 Token；
- 批量导入防重放；
- 文件附件病毒扫描；
- 不执行宏；
- HTML/PDF 模板转义；
- 查询限制节点和深度；
- 审计日志不可由普通用户删除；
- PII 字段加密和访问记录；
- 不将追溯数据发送给外部通用模型；
- V1 不需要 LLM。

---

# 80. 可观测性

Metrics：

```text
trace_events_ingested_total{source,type,status}
trace_event_ingestion_latency_seconds{source}
trace_edges_created_total{type}
trace_gaps_total{type,severity}
trace_quantity_mismatch_total{event_type}
trace_queries_total{direction,status}
trace_query_duration_seconds{direction}
trace_query_nodes_total{direction}
trace_impact_analyses_total{type,status}
trace_recall_scope_units_total{scope}
trace_completeness{dimension,site}
trace_late_events_total{source}
trace_conflicts_total{type}
trace_report_generation_total{type,status}
trace_graph_index_lag_seconds
```

---

# 81. Dashboard

```text
Trace Completeness by Site/Product
Missing Lot/Date Code
Receipt-to-Inventory Coverage
Issue-to-Consumption Coverage
Serial Genealogy Coverage
Shipment-to-Customer Coverage
Quantity Mismatch
Late Event
Mixed Lot
Recall Drill Performance
Open Trace Gaps
```

---

# 82. Benchmark

## Identity

```text
identifier resolution
lot uniqueness
date-code normalization
manufacturer/supplier lot separation
```

## Event

```text
idempotency
late event
reversal/correction
event schema validation
```

## Quantity

```text
split conservation
merge conservation
consume/return/scrap
unit conversion
mixed lot
```

## Trace

```text
forward precision/recall
backward precision/recall
serial-level accuracy
lot-level accuracy
gap detection
```

## Impact

```text
minimum recall scope accuracy
conservative scope recall
customer impact
PCN impact
quality containment
```

## Security

```text
tenant isolation
customer isolation
edge traversal permission
document access
audit immutability
```

---

# 83. 初始质量目标

```text
Event Idempotency = 100%
Identifier Resolution Accuracy >= 99.99%
Lot Type Separation Accuracy = 100%
Date Code Raw Preservation = 100%
Split/Merge Quantity Conservation = 100%
Consumption Quantity Conservation >= 99.99%
Forward Trace Recall >= 99.9%
Backward Trace Recall >= 99.9%
Serial Exact Trace Precision >= 99.99% where scan data exists
Trace Gap Detection Recall >= 99%
Minimum Recall Scope Precision >= 99.9%
Conservative Recall Scope Recall >= 99.99%
Tenant/Customer Isolation = 100%
Audit Replay Consistency = 100%
Report Hash Consistency = 100%
```

这些是目标，不是未经测试的保证。

---

# 84. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## Purchase/Receipt

1. PO to Receipt；
2. Multi PO Lines；
3. ASN；
4. Partial Receipt；
5. Manufacturer Lot；
6. Supplier Lot；
7. Multiple Date Codes；
8. IQC Release；
9. IQC Reject；
10. Return to Supplier。

## Inventory

11. Putaway；
12. Bin Move；
13. Warehouse Transfer；
14. Split Reel；
15. Merge Lot；
16. Re-reel；
17. Tray Repack；
18. Bake；
19. Quantity Loss；
20. Customer-owned Lot。

## Production

21. Issue；
22. Return；
23. Over-issue；
24. Scrap；
25. Machine Load；
26. Barcode Consumption；
27. Backflush；
28. Work Order；
29. Operation；
30. WIP Lot；
31. Panel；
32. Depanelization；
33. Board Serial；
34. Module Assembly；
35. Finished Serial。

## Shipment/RMA

36. Pack Serial；
37. Carton；
38. Pallet；
39. Shipment；
40. Partial Shipment；
41. Customer Order；
42. RMA；
43. Repair；
44. Part Replacement；
45. Re-ship。

## Graph

46. Forward Lot；
47. Backward Serial；
48. PO Forward；
49. Customer Backward；
50. Multi-level BOM；
51. Mixed Lot Known Ratio；
52. Mixed Lot Unknown Ratio；
53. Cycle Protection；
54. Max Depth；
55. As-of Query。

## Data Quality

56. Missing Lot；
57. Missing Receipt；
58. Missing Consumption；
59. Missing Serial；
60. Missing Shipment；
61. Duplicate Event；
62. Late Event；
63. Conflicting Part；
64. Quantity Mismatch；
65. Unknown Unit。

## Impact

66. Supplier Alert；
67. Date Code Alert；
68. PCN；
69. Quality Hold；
70. Storage Excursion；
71. Minimum Scope；
72. Conservative Scope；
73. Unshipped Inventory；
74. WIP；
75. Shipped Customers。

## System/Security

76. Batch Ingestion；
77. Idempotent Retry；
78. Reversal；
79. Correction；
80. Graph Rebuild；
81. Index Lag；
82. Tenant Isolation；
83. Customer View；
84. Permission Denied；
85. Evidence Hash；
86. Audit Package；
87. 1M Nodes；
88. 10M Edges；
89. 100M Edges；
90. Query Timeout；
91. Streaming Result；
92. Cancel Query；
93. Partial Failure；
94. Offline Device Sync；
95. Source Sequence Conflict；
96. Retention；
97. Legal Hold；
98. PII Anonymization；
99. Recall Drill；
100. Audit Replay。

---

# 85. 性能要求

基础目标：

```text
单事件写入 P95 < 100 ms
批量 10,000 事件导入 < 10 s
单序列号后向追溯 P95 < 5 s
单 Lot 前向追溯 P95 < 10 s
100,000 受影响产品分析 P95 < 60 s
```

大规模：

```text
100M+ entities
1B+ edges
```

需要：

- 时间和租户分区；
- 图索引；
- 异步物化路径；
- 流式遍历；
- 对象存储；
- 查询预算；
- 冷热分层；
- 增量图更新。

---

# 86. 灾难恢复

必须支持：

```text
event log replay
graph index rebuild
materialized path rebuild
report regeneration
evidence integrity check
```

RPO/RTO 按企业策略配置。

---

# 87. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
```

事件：

```text
Kafka / Redpanda / RabbitMQ
```

图查询：

```text
PostgreSQL recursive CTE for V1
Neo4j / Neptune optional
```

批量：

```text
Polars
PyArrow
DuckDB
```

报告：

```text
HTML Template
Playwright / WeasyPrint
```

V1 不需要 LLM。

---

# 88. 推荐仓库结构

```text
material-lot-traceability-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── material-lot-traceability-agent-spec.md
│   ├── trace-domain-model.md
│   ├── lot-and-identifier-model.md
│   ├── trace-event-schema.md
│   ├── quantity-conservation.md
│   ├── purchase-receipt-trace.md
│   ├── inventory-transformation-trace.md
│   ├── production-genealogy.md
│   ├── shipment-customer-trace.md
│   ├── rma-rework-trace.md
│   ├── forward-backward-query.md
│   ├── recall-impact-analysis.md
│   ├── data-quality-and-gaps.md
│   ├── graph-storage-design.md
│   ├── security-and-retention.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-date-code-is-not-lot.md
│       ├── 0002-issue-is-not-consumption.md
│       ├── 0003-trace-events-are-immutable.md
│       ├── 0004-expected-bom-and-actual-genealogy-separated.md
│       ├── 0005-postgresql-is-system-of-record.md
│       └── 0006-trace-gaps-are-explicit.md
├── src/
│   └── traceability/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── entity.py
│       │   ├── identifier.py
│       │   ├── lot.py
│       │   ├── serial.py
│       │   ├── container.py
│       │   ├── event.py
│       │   ├── edge.py
│       │   ├── gap.py
│       │   └── impact.py
│       ├── adapters/
│       │   ├── erp.py
│       │   ├── wms.py
│       │   ├── mes.py
│       │   ├── qms.py
│       │   ├── plm.py
│       │   ├── shipping.py
│       │   ├── rma.py
│       │   ├── barcode.py
│       │   └── equipment.py
│       ├── ingestion/
│       │   ├── service.py
│       │   ├── validation.py
│       │   ├── normalization.py
│       │   ├── identity.py
│       │   ├── idempotency.py
│       │   ├── ordering.py
│       │   └── conflicts.py
│       ├── events/
│       │   ├── purchase.py
│       │   ├── receipt.py
│       │   ├── quality.py
│       │   ├── inventory.py
│       │   ├── split_merge.py
│       │   ├── issue_consume.py
│       │   ├── production.py
│       │   ├── shipment.py
│       │   └── rma.py
│       ├── graph/
│       │   ├── builder.py
│       │   ├── repository.py
│       │   ├── adjacency.py
│       │   ├── materialized_paths.py
│       │   ├── rebuild.py
│       │   └── versioning.py
│       ├── queries/
│       │   ├── forward.py
│       │   ├── backward.py
│       │   ├── where_used.py
│       │   ├── where_from.py
│       │   ├── as_of.py
│       │   ├── permissions.py
│       │   └── streaming.py
│       ├── reconciliation/
│       │   ├── quantity.py
│       │   ├── units.py
│       │   ├── tolerances.py
│       │   └── gaps.py
│       ├── impact/
│       │   ├── quality.py
│       │   ├── pcn.py
│       │   ├── recall.py
│       │   ├── minimum_scope.py
│       │   └── conservative_scope.py
│       ├── reports/
│       │   ├── internal.py
│       │   ├── customer.py
│       │   ├── audit.py
│       │   ├── html.py
│       │   └── pdf.py
│       ├── evidence/
│       ├── corrections/
│       ├── jobs/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── migrations/
├── policies/
├── report-templates/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_trace_events.py
    ├── reconcile_quantities.py
    ├── rebuild_trace_graph.py
    ├── replay_trace_events.py
    ├── run_recall_drill.py
    ├── run_trace_benchmark.py
    └── verify_audit_package.py
```


---

# 89. Codex 分阶段实施

不要让 Codex 一次实现全部 ERP/WMS/MES/QMS 接口、图数据库、召回和客户报告。

## Phase 0：仓库侦察和数据盘点

Codex 必须检查：

1. Agent 31–41 的真实完成程度和接口；
2. 当前 Part、MPN、IPN、Customer PN 和 Supplier SKU；
3. 当前 Manufacturer Lot、Supplier Lot、Receipt Lot 和 Inventory Lot；
4. 当前 Date Code 原始值、解析方式和唯一性；
5. 当前 PO、PO Line、ASN、Receipt、IQC 和入库；
6. 当前库存移动、拆分、合并、Re-reel、换包和烘烤；
7. 当前领料、退料、补料、超领和报废；
8. 当前 Work Order、Operation、Routing、Line、Machine 和 Shift；
9. 当前物料实际消耗、Backflush 和设备 Placement Log；
10. 当前 Panel、Board、Module、WIP Lot、FG Lot 和 Serial；
11. 当前 Packaging、Carton、Pallet、Shipment 和 Sales Order；
12. 当前 RMA、返修、拆解、换料和重新出货；
13. 当前 PCN、质量事件、隔离和召回流程；
14. 当前 Traceability、Genealogy、Where-used 和 Where-from 功能；
15. 当前扫码枪、PDA、设备和离线数据；
16. 当前事件幂等、乱序、迟到、纠正和反冲；
17. 当前数量和单位对账；
18. 当前客户、租户、工厂、项目和权限隔离；
19. 当前数据保留、Legal Hold、审计和报告；
20. 统计 Missing Lot、Missing Date Code、Missing Consumption、Missing Shipment Link；
21. 抽样分析合成或脱敏追溯链；
22. 不修改业务代码；
23. 不创建 Migration；
24. 不安装依赖；
25. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Entity；
- Identifier；
- Lot；
- Serial；
- Container；
- Trace Event；
- Input/Output/Loss；
- Edge；
- Gap；
- Query；
- Impact；
- Report；
- JSON Schema。

## Phase 2：Event Ingestion Framework

实现：

- API；
- Batch；
- Schema Version；
- Validation；
- Idempotency；
- Source Sequence；
- Occurred/Recorded Time；
- Reject Queue；
- Audit。

## Phase 3：Identity、Lot 和 Date Code

实现：

- Agent 32 Adapter；
- Lot Type；
- Manufacturer/Supplier/Receipt/Inventory Lot；
- Raw Date Code；
- Normalization；
- Ambiguity；
- Identifier Resolution；
- No Guessing。

## Phase 4：Purchase、ASN、Receipt 和 IQC

实现：

- PO/Line；
- ASN；
- Receipt；
- Receipt Lot；
- IQC；
- Return to Supplier；
- Evidence；
- Quantity Reconciliation。

## Phase 5：Inventory Movement 和 Transformation

实现：

- Putaway；
- Move；
- Transfer；
- Split；
- Merge；
- Mixed Lot；
- Repack；
- Re-reel；
- Bake；
- Container Hierarchy；
- Quantity Conservation。

## Phase 6：Material Issue、Load、Consume 和 Return

实现：

- Issue；
- Feeder Load；
- Actual Consumption；
- Backflush；
- Return；
- Scrap；
- Over-issue；
- Precision；
- Gap Detection。

## Phase 7：Production Genealogy

实现：

- Work Order；
- Operation；
- WIP；
- Production Lot；
- Panel/Board；
- Subassembly；
- Finished Lot；
- Serial；
- Actual BOM；
- Agent 33 Substitute Link。

## Phase 8：Machine Log 和 Serial Mapping

实现：

- Feeder Time Window；
- Placement Log；
- Board Serial Time；
- Machine/Line；
- Mapping Rule；
- Precision；
- Confidence；
- Reconciliation。

## Phase 9：Packaging、Shipment 和 Customer

实现：

- Inner Pack；
- Carton；
- Pallet；
- Shipment；
- Sales Order；
- Customer；
- Partial Ship；
- Repack；
- Customer-view Permission。

## Phase 10：RMA、Repair 和 Rework

实现：

- Return；
- Original Shipment；
- Diagnosis；
- Disassembly；
- Replacement Part；
- Rework；
- Re-test；
- Re-ship；
- Historical Genealogy Preservation。

## Phase 11：Graph Repository

实现：

- PostgreSQL Adjacency；
- Directed Edge；
- Version；
- Partition；
- Index；
- Cycle Protection；
- Materialized Path；
- Rebuild；
- Optional Graph Adapter。

## Phase 12：Forward 和 Backward Query

实现：

- BFS/DFS；
- As-of；
- Filters；
- Max Depth；
- Streaming；
- Permissions per Edge；
- Timeline；
- Result Summary。

## Phase 13：Quantity Reconciliation 和 Trace Gap

实现：

- Event Conservation；
- Unit Conversion；
- Tolerance；
- Gap Types；
- Conflict；
- Review；
- Resolution；
- Completeness。

## Phase 14：Quality、PCN 和 Impact

实现：

- Agent 34/35 Adapter；
- Supplier Alert；
- Quality Hold；
- PCN；
- Date Range；
- Site；
- Inventory/WIP/FG/Shipment/Customer Impact。

## Phase 15：Recall Scope

实现：

- Minimum Confirmed Scope；
- Conservative Scope；
- Mixed Lot；
- Backflush；
- Unknown Window；
- Affected Quantity；
- Customer List；
- Trace Gap；
- Recall Drill。

## Phase 16：Reports 和 Audit Package

实现：

- Internal Report；
- Customer Report；
- Trace Graph；
- Timeline；
- Evidence Manifest；
- Hash；
- HTML/PDF；
- Template Version；
- Totals Verification。

## Phase 17：Correction、Reversal 和 Late Event

实现：

- Immutable Event；
- Reversal；
- Corrected Event；
- Supersede；
- Late Dependency；
- Edge Rebuild；
- Audit。

## Phase 18：Adapters 和 Offline Devices

实现：

- ERP；
- WMS；
- MES；
- QMS；
- Shipping；
- RMA；
- Barcode/PDA；
- Offline Queue；
- Sync；
- Adapter Contract；
- Error Isolation。

## Phase 19：API、Events、Jobs 和 Cache

实现：

- Query Jobs；
- Impact Jobs；
- Batch Ingestion；
- Cancel；
- Progress；
- Cache；
- Events；
- Object Storage；
- Access Control。

## Phase 20：Security、Retention 和 Legal Hold

实现：

- Tenant/Customer Isolation；
- PII；
- Evidence；
- Legal Hold；
- Archive；
- Anonymization；
- Signed Download；
- Audit Immutability。

## Phase 21：Benchmark、监控和生产发布

实现：

- Golden Genealogy Tests；
- Conservation Property Tests；
- Forward/Backward Benchmark；
- Recall Drill；
- Load Test；
- Metrics；
- Dashboard；
- Feature Flag；
- Graph Rebuild Drill；
- Disaster Recovery。

## Phase 22：高级设备级追溯，可选

稳定后：

- SMT Placement Detail；
- Reference Designator-level Trace；
- Test Parameter Genealogy；
- Secure Key/Certificate Trace；
- Environmental Sensor Log；
- Statistical Process Correlation；
- 不使用模型替代真实扫描记录。

---

# 90. Codex 工作纪律

Codex 必须：

1. Expected BOM 和 Actual Genealogy 分开；
2. Manufacturer Lot、Supplier Lot、Receipt Lot、Inventory Lot 分开；
3. Date Code 不等于 Lot；
4. Raw Date Code 永久保留；
5. Lot Number 不假设全局唯一；
6. PO、PO Line、ASN、Receipt 和 Receipt Lot 分开；
7. Receipt 不等于 IQC Released；
8. Inventory Move 不覆盖历史位置；
9. Split/Merge/Repack 建立 Event；
10. Re-reel 保留原始 Lot；
11. Issue、Load、Consumption、Return 和 Scrap 分开；
12. Backflush 标为 Estimated；
13. Work Order、Production Lot、FG Lot 和 Serial 分开；
14. 多级装配建立显式 Genealogy；
15. Substitute 必须链接 Agent 33 批准和偏差；
16. Shipment 必须链接具体 Lot/Serial；
17. RMA 保留原出货和原 Genealogy；
18. 已发布 Event 不可覆盖；
19. 纠正使用 Reversal/Correction；
20. Event 必须幂等；
21. Occurred At 和 Recorded At 分开；
22. 支持迟到和乱序；
23. 数量守恒；
24. 单位转换版本化；
25. Mixed Lot 降低 Precision；
26. Unknown Ratio 使用 Conservative Exposure；
27. Trace Gap 显式；
28. Completeness 分维度；
29. Serial-level、Lot-level 和 Backflush Precision 分开；
30. Forward/Backward Query 逐 Edge 做权限；
31. Customer View 不泄露其他客户；
32. Minimum Scope 和 Conservative Scope 同时输出；
33. Agent 不自动召回、报废或冻结；
34. 质量隔离只生成范围和动作；
35. PostgreSQL 是事实源；
36. Graph Index 可重建；
37. 报告从结构化数据生成；
38. 报告和证据保存 Hash；
39. 不使用 LLM 生成追溯 Edge；
40. 不用 LLM 判断实际消耗；
41. 不将客户、序列号、供应商和生产数据发送到外部模型；
42. 公开测试只用合成或脱敏数据；
43. 不伪造 Lot、Date Code、消费、客户影响或 Benchmark；
44. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter Contract；
    - Event Schema；
    - 测试命令；
    - 真实结果；
    - Quantity Conservation；
    - Trace Precision/Recall；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 91. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/material-lot-traceability-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第42个 Agent：

Material, Lot & Product Genealogy Traceability Agent /
物料与批次追溯 Agent。

本 Agent 建立：

- Part、MPN、IPN、Customer PN 和 Supplier SKU；
- Manufacturer Lot、Supplier Lot、Receipt Lot、Inventory Lot 和 Date Code；
- PO、PO Line、ASN、Receipt、IQC 和库存；
- Split、Merge、Repack、Re-reel、Bake 和 Transfer；
- Issue、Load、Consumption、Return、Scrap；
- Work Order、Operation、WIP Lot、Production Lot、FG Lot 和 Serial；
- Package、Carton、Pallet、Shipment、Sales Order 和 Customer；
- RMA、Repair、Rework 和 Re-ship；

之间的不可变、有证据、可重放双向 Genealogy。

核心输出：

- Forward Trace；
- Backward Trace；
- Where-used；
- Where-from；
- Quantity Reconciliation；
- Trace Gap；
- PCN/Quality Impact；
- Minimum Recall Scope；
- Conservative Recall Scope；
- Internal/Customer Trace Report；
- Audit Package。

本 Agent 不自动召回、不自动报废、不自动冻结、不自动修改 BOM，不使用 LLM 猜测追溯关系。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–41 的规格和实际代码；
3. docs/material-lot-traceability-agent-spec.md；
4. 当前 Part、MPN、IPN、Customer PN、Supplier SKU；
5. 当前 Manufacturer Lot、Supplier Lot、Receipt Lot、Inventory Lot；
6. 当前 Date Code Raw/Normalized；
7. 当前 PO、Line、ASN、Receipt、IQC、Return；
8. 当前 Inventory Move、Split、Merge、Re-reel、Repack、Bake；
9. 当前 Issue、Load、Consume、Return、Scrap、Backflush；
10. 当前 Work Order、Operation、Routing、Machine、Line、Shift；
11. 当前 WIP Lot、Panel、Board、Module、FG Lot、Serial；
12. 当前 Package、Carton、Pallet、Shipment、Sales Order、Customer；
13. 当前 RMA、Repair、Replacement、Rework、Re-ship；
14. 当前 PCN、Quality Hold、Supplier Alert、Recall；
15. 当前 ERP/WMS/MES/QMS/PLM/Shipping/RMA/Barcode Adapter；
16. 当前 Event Bus、Outbox、Idempotency、Ordering 和 Offline Sync；
17. 当前 Graph、Where-used、Where-from 和 Genealogy；
18. 当前 Quantity/Unit Reconciliation；
19. 当前 Permission、Retention、Legal Hold、Audit 和 Evidence；
20. 脱敏、合成或授权 Fixture。

硬约束：

- Expected BOM 与 Actual Genealogy 分开；
- Manufacturer/Supplier/Receipt/Inventory Lot 分开；
- Date Code 不等于 Lot；
- Raw Date Code 永久保留；
- Lot Number 不假设全局唯一；
- PO/Line/ASN/Receipt/Receipt Lot 分开；
- Receipt 不等于 IQC Release；
- Move 不覆盖位置历史；
- Split/Merge/Repack/Re-reel 建立不可变 Event；
- Re-reel 保留父 Lot；
- Issue/Load/Consumption/Return/Scrap 分开；
- Backflush 标为 Estimated；
- Work Order/Production Lot/FG Lot/Serial 分开；
- 多级装配显式建图；
- 替代料链接 Agent 33 Approval/Deviation；
- Shipment 链接具体 Lot/Serial；
- RMA 保留原始 Genealogy；
- Event 不可覆盖；
- Correction 使用 Reversal/Corrected Event；
- source_system + source_transaction_id 幂等；
- occurred_at/recorded_at 分开；
- 支持 Late/Out-of-order；
- Input = Output + Scrap + Loss + Sample；
- Unit Conversion 版本化；
- Mixed Lot 降低 Precision；
- Unknown Ratio 进入 Conservative Scope；
- Trace Gap 显式；
- Serial/Lot/Work-order/Backflush Precision 分开；
- Query 逐 Edge 权限过滤；
- Customer View 不泄露其他客户；
- Minimum/Conservative Recall Scope 分开；
- PostgreSQL 为事实源；
- Graph Index 可重建；
- 报告由 Structured JSON 生成；
- Evidence 和 Report 保存 Hash；
- V1 不需要 LLM；
- 不将客户、序列号、供应商、生产数据发送到外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造 Lot、消费、客户影响、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–41 的真实完成程度和接口；
3. 查找 Part/MPN/IPN/Customer PN/Supplier SKU；
4. 查找所有 Lot 类型和 Date Code；
5. 查找 PO/Line/ASN/Receipt/IQC/Return；
6. 查找库存 Move/Split/Merge/Re-reel/Repack/Bake；
7. 查找 Issue/Load/Consume/Return/Scrap/Backflush；
8. 查找 Work Order/Operation/WIP/Production Lot/FG Lot/Serial；
9. 查找 Panel/Board/Reference Designator 或 Placement Log；
10. 查找 Packaging/Carton/Pallet/Shipment/Sales Order/Customer；
11. 查找 RMA/Repair/Rework/Re-ship；
12. 查找 PCN/Quality Event/Recall；
13. 查找 Event Idempotency/Ordering/Correction；
14. 查找 Quantity/Unit Reconciliation；
15. 查找 Graph/Where-used/Where-from；
16. 查找 Evidence/Hash/Retention/Legal Hold；
17. 查找 Tenant/Customer/Edge Permission；
18. 统计 Missing Lot、Date Code、Consumption、Serial、Shipment Link；
19. 抽样分析脱敏或合成 Trace Chain；
20. 在 docs/material-lot-traceability-implementation-plan.md 中生成实施计划；
21. 在 docs/trace-domain-model.md 中定义 Node/Event/Edge；
22. 在 docs/lot-and-identifier-model.md 中定义 Lot 和 Date Code；
23. 在 docs/trace-event-schema.md 中定义不可变事件；
24. 在 docs/quantity-conservation.md 中定义数量和单位；
25. 在 docs/purchase-receipt-trace.md 中定义采购收货；
26. 在 docs/inventory-transformation-trace.md 中定义拆分合并；
27. 在 docs/production-genealogy.md 中定义工单和成品；
28. 在 docs/shipment-customer-trace.md 中定义出货客户；
29. 在 docs/rma-rework-trace.md 中定义返修；
30. 在 docs/forward-backward-query.md 中定义图查询；
31. 在 docs/recall-impact-analysis.md 中定义影响和召回范围；
32. 在 docs/data-quality-and-gaps.md 中定义 Trace Gap；
33. 在 docs/graph-storage-design.md 中定义存储与索引；
34. 在 docs/traceability-migration-plan.md 中定义旧数据迁移；
35. 在 docs/traceability-benchmark-plan.md 中定义 Benchmark；
36. 给出拟新增、拟修改和拟复用文件；
37. 给出 Phase 1 精确范围；
38. 不修改业务代码；
39. 不创建数据库 Migration；
40. 不安装依赖；
41. 不读取或打印生产 Secret；
42. 运行当前仓库已有 lint、type check、test、build 和 security scan；
43. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–41 输入契约；
- Entity/Event/Edge 模型；
- Lot/Date Code；
- PO/Receipt/IQC；
- Inventory Transformation；
- Issue/Consumption；
- Production Genealogy；
- Serial/Shipment/Customer；
- RMA/Rework；
- Forward/Backward Trace；
- Quantity Conservation；
- Trace Gap/Completeness；
- PCN/Quality/Recall Impact；
- Graph Storage；
- Security/Retention；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 92. 后续 Phase 提示词模板

```text
继续实现 Material Lot Traceability Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–42 规格；
3. 阅读 Traceability Implementation Plan；
4. 阅读 Domain、Lot、Event、Conservation、Genealogy、Query、Impact、Graph、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Immutable Event；
- Date Code != Lot；
- Issue != Consumption；
- Expected BOM != Actual Genealogy；
- Quantity Conservation；
- Precision Explicit；
- Trace Gap Explicit；
- Edge-level Permission；
- Minimum/Conservative Scope；
- PostgreSQL System of Record；
- Evidence/Hash/Version；
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
10. graph traversal test；
11. tenant/customer security test；
12. performance test；
13. benchmark；
14. 更新文档；
15. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Event/Adapter 变化；
- 测试命令和真实结果；
- Quantity Conservation；
- Trace Precision/Recall；
- Gap Detection；
- 查询性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 93. MVP 演示流程

1. 创建一张 PO 和 PO Line；
2. 供应商 ASN 带 Supplier Lot 和 Date Code；
3. 收货生成 Receipt Lot；
4. IQC 放行；
5. 入库生成 Inventory Lot；
6. 将原厂 Reel 拆成两个子 Reel；
7. 保存父子 Lot 和数量守恒；
8. 一个子 Reel 经 Re-reel；
9. 保存新容器但保留原始 Lot；
10. 向工单领料；
11. 记录 Feeder 上料；
12. SMT 设备日志记录 Placement 时间；
13. Panel 生成四块 Board；
14. 为 Board 分配序列号；
15. 将器件 Lot 映射到四个序列号；
16. 另一颗普通电阻只使用 Backflush；
17. 明确显示其追溯精度为 Work-order Estimated；
18. 成品序列号装箱；
19. Carton 装入 Pallet；
20. Shipment 关联客户订单；
21. 从 Manufacturer Lot 执行 Forward Trace；
22. 找到库存、WIP、四个序列号和客户；
23. 从其中一个序列号执行 Backward Trace；
24. 找到 Board、Panel、工单、Reel、Receipt、PO 和 Supplier Lot；
25. 模拟供应商质量告警；
26. 输出 Minimum Confirmed Scope；
27. 输出 Conservative Scope；
28. Conservative Scope 包含 Backflush 时间窗内的其他成品；
29. 显示一个 Missing Consumption Trace Gap；
30. 人工补录经审核的消费事件；
31. Trace Completeness 提高；
32. 客户退回一个序列号；
33. RMA 关联原 Shipment；
34. 返修更换一颗器件；
35. 保留原器件和新器件谱系；
36. 重新出货；
37. 生成内部追溯报告；
38. 生成客户版报告；
39. 客户版隐藏其他客户和供应商合同信息；
40. 执行 Recall Drill；
41. 验证数量守恒和报告 Hash；
42. 发布 `trace.impact.ready`。

---

# 94. 生产上线顺序

第一阶段：

```text
PO / Receipt / IQC
Inventory Lot
Issue / Return
Work Order / Production Lot
FG Lot / Serial
Shipment / Customer
Forward / Backward Query
人工补 Gap
```

第二阶段：

```text
Split / Merge / Re-reel
Machine Load
Panel / Board
RMA / Rework
PCN / Quality Impact
Recall Scope
Customer Report
```

第三阶段：

```text
Reference Designator-level Placement
跨工厂和委外
高级图索引
设备环境数据
召回演练自动化
大规模审计包
```

上线优先确保：

```text
Lot 不混
Date Code 不冒充 Lot
领料和消耗不混
拆分换包不丢父链
成品真正能追到 PO 和客户
数据缺口明确可见
```

宁可承认某批历史产品只能做到工单级追溯，也不要把 Backflush 推算包装成“序列号级百分之百精确”。追溯系统最怕的不是数据不完整，而是看起来完整、实际上是编出来的。
