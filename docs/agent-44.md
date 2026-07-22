# PCB/SMT 制造询价与下单 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：44  
> Agent 名称：PCB/SMT Manufacturing RFQ, Comparison & Order Orchestration Agent  
> 中文名称：PCB/SMT 制造询价与下单 Agent  
> 类型：编排型  
> 版本：V1.0  
> 资料基线日期：2026-07-20  
>
> 定位：将已经发布或待试产的 PCB、PCBA、Stencil、BOM、CPL、装配、烧录、测试、包装和质量要求，转换成统一的制造询价包，通过 Seeed Fusion、NextPCB、PCBWay、JLCPCB 及后续其他制造服务商的正式 API、合作伙伴接口或受控人工提交流程获取报价、交期、能力、工程审核结果和订单状态，并形成可解释的多供应商比较、工艺风险、下单草稿和制造订单生命周期跟踪。
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
> - Agent 41：库存复用与呆滞料
> - Agent 42：物料与批次追溯
> - Agent 43：EBOM、MBOM 与 NPI 转换
> - ezPLM 项目、产品、工程文件、质量、供应商、采购、付款、物流和审批数据
>
> 下游：
> - PCB/PCBA/Stencil 制造询价
> - 多供应商报价比较
> - 制造能力和工艺风险报告
> - 文件缺失与 DFM/DFT Review
> - 制造商工程问题和澄清任务
> - 下单草稿、购物车或合作伙伴订单
> - 采购申请、采购订单和付款审批
> - 生产进度、物流和收货状态
> - Agent 39 实际制造成本
> - Agent 40 交期和在途
> - Agent 42 Lot、工单、成品和客户追溯
> - Agent 45 及后续质量、供应商绩效和闭环 Agent
>
> 重要边界：
> - 本 Agent 默认不自动付款、不自动提交不可撤销订单、不自动接受制造商的工程修改、不自动确认替代料、不自动承诺客户交期。
> - 正式下单、付款、DFM 修改、材料替换、交期承诺和报价选定必须经过明确权限和审批。
> - Provider 网站、字段、价格、能力和 API 会变化，所有 Provider Adapter、Capability Profile、字段映射和规则必须版本化。
> - 对没有正式公开 API 或尚未获得合作伙伴权限的服务商，使用“受控人工辅助提交”或“合作伙伴接口占位”，不得通过未经授权的浏览器抓取、Cookie 复用或脆弱 RPA 冒充官方集成。
> - 报价不是正式生产承诺。自动报价、工程审核后报价、支付后生效价格和最终制造可行性必须分开。
> - 各服务商的价格口径、Build Time、工程审核、元器件采购、物流和税费定义不一致，必须标准化后再比较。

---

# 1. 当前官方集成基线

## 1.1 JLCPCB

截至资料基线日期，JLCPCB 已提供官方 API 平台，官方资料说明其 PCB API 支持 Gerber 上传、自动报价、创建订单和生产进度跟踪；还提供 Stencil、3D Printing 和 Components API。API 权限需要申请和审核。

因此 Adapter 模式：

```text
official_api
```

但必须检查账户是否已获批、产品范围、Sandbox/Production、限流和品牌使用限制。

## 1.2 PCBWay

PCBWay 公开 Partner API 帮助页面提供：

```text
PCB Quotation
SMT Quotation
Place Order
Confirm Order / Payment
Freight
Order Detail
Cancel
Production Process
Account Balance
```

因此 Adapter 模式：

```text
official_partner_api
```

支付和订单确认仍必须受审批策略控制。

## 1.3 Seeed Fusion

公开资料显示 Seeed Fusion 支持上传 Gerber 获得在线报价，PCBA 需要 BOM，并建议同时提供 CPL/Pick-and-Place、装配和测试资料；其公开资料还说明 BOM 会匹配 OPL 以及 DigiKey、Mouser、Arrow、Element14 等来源。

目前本设计不假设存在可公开直接使用的完整订单 API。

Adapter 模式：

```text
partner_api_when_approved
assisted_submission
manual_review
```

## 1.4 NextPCB

公开资料显示 NextPCB 的网页流程支持上传 Gerber、自动解析部分参数、选择数量、Build Time 和物流，然后加入购物车、支付并进入工程文件审核。

目前本设计不假设存在可公开直接使用的完整订单 API。

Adapter 模式：

```text
partner_api_when_approved
assisted_submission
manual_review
```

## 1.5 适配原则

```text
Provider Capability Registry
→ Adapter Capability Negotiation
→ Supported Workflow
```

系统不能因为某家 Provider 支持“报价”，就假设也支持：

```text
文件上传
PCBA BOM 匹配
自动下单
支付
取消
生产进度
工程问题
退款
```

---

# 2. 建设目标

系统必须能够：

1. 接收 PCB、PCBA、Stencil 和 Box Build 制造请求；
2. 读取 Agent 43 发布的 Manufacturing Release Package；
3. 读取 Gerber、Drill、IPC-356、ODB++、IPC-2581、KiCad、Altium 和装配资料；
4. 生成受控的 Provider-neutral Manufacturing Request Package；
5. 检查 PCB 文件层、钻孔、外形、版本和文件完整性；
6. 检查 BOM、CPL、Assembly Drawing 和 Gerber 是否来自同一设计版本；
7. 检查位号、数量、DNP、Side、Rotation、Polarity 和 Footprint；
8. 检查 Board Size、Layer Count、Material、Thickness、Copper、Finish 和 Solder Mask；
9. 检查 Impedance、Stack-up、Via、HDI、Blind/Buried Via、Via-in-pad 和 Filled Via；
10. 检查 Gold Finger、Castellated Hole、Edge Plating、Countersink、Controlled Depth 和特殊外形；
11. 检查 Panelization、V-cut、Mouse Bite、Rail、Fiducial、Tooling Hole 和 X-out；
12. 检查 Flex、Rigid-flex、Aluminum、High-Tg、Rogers 和特殊材料；
13. 检查 Min Trace/Space、Min Hole、Annular Ring、Aspect Ratio 和公差；
14. 将工程要求映射成各 Provider 支持的字段；
15. 识别 Provider 不支持、需要人工审核或超出在线报价范围的参数；
16. 支持 PCB Only、PCB + Stencil、PCBA、Turnkey PCBA、Consigned PCBA 和 Box Build；
17. 支持样机、EVT、DVT、PVT、Pilot、Mass Production 和 Service Build；
18. 支持 Top、Bottom 和双面装配；
19. 支持 SMT、THT、手焊、压接、插件、Selective Solder 和 Wave Solder；
20. 支持 BOM 元器件来源策略；
21. 支持制造商自有料库、公共料库、预购料、客户寄料和全球采购；
22. 支持替代料和 DNP 的明确授权；
23. 支持 Agent 41 可复用库存和客户寄料；
24. 支持烧录、测试、校准和序列号要求；
25. 支持 ICT、FCT、AOI、SPI、X-ray、Burn-in 和包装；
26. 支持供应商上传字段和文件格式差异；
27. 支持一次询价多个数量阶梯；
28. 支持一次询价多个 Build Time；
29. 支持一次询价多个目的地和物流方式；
30. 支持货币、税费、优惠券、平台补贴和账号级合同价格；
31. 支持自动报价与人工报价；
32. 支持报价有效期；
33. 支持制造商工程审核后的改价；
34. 支持元器件短缺、未匹配和代采审核；
35. 支持制造能力匹配；
36. 支持 DFM 风险评分；
37. 支持工艺风险、质量风险、交期风险和数据风险；
38. 支持总价、单位价、固定费用和变动费用拆分；
39. 支持 PCB、Stencil、元器件、装配、测试、包装、物流和税费拆分；
40. 支持制造周期、采购周期、审核周期、物流周期和可用日期拆分；
41. 支持多 Provider 横向比较；
42. 支持同一 Provider 不同服务等级比较；
43. 支持 Pareto Front；
44. 支持 Cost、Lead Time、Capability、Quality、Risk 和 Carbon/Region 可选权重；
45. 支持供应商历史 OTD、质量和沟通绩效；
46. 支持工程文件安全上传；
47. 支持文件 Hash、版本、加密和访问审计；
48. 支持 Provider 直传或短期签名 URL；
49. 支持制造商 Engineering Question；
50. 支持澄清、回复、补文件和重新报价；
51. 支持 Quote Revision；
52. 支持用户批准制造商修改后的生产文件；
53. 支持 Add to Cart、Place Order Draft、Confirm Order 和 Payment Gate；
54. 支持 PO Number 和采购审批；
55. 支持付款前和付款后状态；
56. 支持生产进度同步；
57. 支持制造工序状态；
58. 支持 Shipment、Tracking 和 ETA；
59. 支持收货和 IQC Hook；
60. 支持异常、取消、退款和重做 Case；
61. 支持 Reorder；
62. 支持储存 Stencil/Fixture 的复用判断；
63. 支持订单、工程文件和报价不可变快照；
64. 支持多租户、多账户和 Provider Credential；
65. 支持 Provider 限流、重试和熔断；
66. 支持部分 Provider 失败时继续比较；
67. 支持幂等下单；
68. 支持 Saga 和补偿；
69. 支持人工提交任务；
70. 支持 Provider Portal Deep Link；
71. 支持事件驱动和增量刷新；
72. 支持模拟报价和真实报价分开；
73. 支持审计和合规；
74. 支持 Benchmark；
75. 不因报价最低就自动推荐；
76. 不因在线报价成功就认为工程文件已通过审核；
77. 不因“Build Time 3 days”就认为三天后客户可以收到；
78. 不把制造商估算交期当作保证交期；
79. 不自动接受材料、Stack-up、铜厚、表面处理或元器件替代；
80. 不自动支付或发送生产授权；
81. 不把账号 Cookie 存入普通数据库；
82. 不将工程文件公开暴露给 Provider 之外的第三方。

---

# 3. 与 Agent 31–43 的边界

## 3.1 Agent 31/32

提供标准 BOM、精确 MPN、Manufacturer、Ordering Variant 和位号。

Agent 44 不重新做模糊 MPN 解析。

## 3.2 Agent 33

提供已批准替代。

制造商提出替代时，Agent 44创建：

```text
substitution_review
```

不自动确认。

## 3.3 Agent 34/35

提供：

```text
lifecycle
PCN
compliance
COO
trade restrictions
customer conditions
```

用于工厂、目的地、材料和元器件采购限制。

## 3.4 Agent 36

提供独立分销市场价格和库存，用于检查制造商元器件报价和短缺，不覆盖制造商实际采购报价。

## 3.5 Agent 37

提供：

```text
supplier risk
regional risk
single source
lead-time risk
```

用于 Provider 比较和风险权重。

## 3.6 Agent 38

提供合法采购包装和数量。

对于 Turnkey PCBA，制造商 BOM 报价可与 Agent 38 外部采购方案比较。

## 3.7 Agent 39

消费：

```text
制造报价
物流
税费
NRE
固定费用
```

计算项目成本和利润。

## 3.8 Agent 40

消费：

```text
confirmed order
production status
shipment ETA
```

用于计划和在途。

## 3.9 Agent 41

提供：

```text
customer consigned parts
reuse inventory
transfer availability
```

实际寄料必须经过物流、所有权和 Provider 收货确认。

## 3.10 Agent 42

记录：

```text
PO
Provider
Manufacturer Lot
Receipt
Production Lot
FG Lot
Shipment
```

## 3.11 Agent 43

提供：

```text
MBOM
Routing
RefDes/CPL
Firmware
Test
Packaging
Traceability Plan
Release Package
```

Agent 44只接受受控 Revision 或明确标记为 Prototype Draft 的数据包。

---

# 4. 核心原则

## 4.1 统一询价，不统一制造能力

统一的是：

```text
Canonical Manufacturing Request
Canonical Quote
Canonical Order Status
```

不是强迫所有 Provider 支持相同工艺。

## 4.2 能力注册表先于字段映射

```text
Provider Capability Registry
→ Request Feasibility
→ Field Mapping
→ Quote
```

## 4.3 自动报价与工程审核报价分开

```text
instant_estimate
system_quote
engineering_review_quote
order_confirmed_price
final_adjusted_price
```

## 4.4 文件包是一等对象

保存：

```text
file
revision
hash
role
source
approval
provider upload id
```

## 4.5 Build Time 分解

```text
file_review
engineering_confirmation
component_sourcing
PCB fabrication
assembly
test
QC
packing
shipping
customs
```

## 4.6 价格拆解

```text
PCB
engineering/tooling
stencil
components
assembly
test
programming
packaging
shipping
tax/duty
discount
payment fee
```

## 4.7 Provider Quote 不可直接比较原始总价

必须统一：

```text
currency
quantity
service scope
shipping
tax mode
component sourcing
test scope
yield assumptions
```

## 4.8 工艺风险是 Hard Gate + Score

不支持的能力直接淘汰；可制造但高风险的方案参与比较并明确提示。

## 4.9 正式下单是受控 Saga

```text
approve quote
→ create provider cart/order
→ verify price and files
→ internal PO
→ payment approval
→ confirm production
```

## 4.10 Provider 修改必须人工确认

例如：

```text
stack-up change
material substitution
surface finish change
component substitution
polarity correction
panelization change
```

## 4.11 Credential 最小权限

每个 Provider Account 独立：

```text
sandbox
production
quote only
order
payment
tracking
```

## 4.12 不做未经授权的网页自动化

无 API 时：

```text
生成完整提交包
生成字段映射清单
生成 Provider Deep Link
人工上传并回填 Quote/Order
```

## 4.13 幂等是硬要求

重复重试不能：

```text
创建重复订单
重复支付
重复提交购物车
重复发送生产授权
```

## 4.14 证据和时间戳

所有 Provider Response 保存：

```text
raw response
request hash
response hash
requested_at
quoted_at
valid_until
```

---

# 5. 产品范围

```text
pcb_fabrication
pcb_assembly
stencil
pcb_plus_stencil
turnkey_pcba
consigned_pcba
mixed_sourcing_pcba
box_build
reorder
```

---

# 6. Provider Integration Mode

```text
official_api
official_partner_api
private_partner_api
assisted_submission
manual_quote
email_rfq
unsupported
```

每个 Workflow Action 独立标记支持情况。

---

# 7. Provider Capability Registry

```json
{
  "provider_id": "jlcpcb",
  "profile_version": "2026-07-20",

  "integration": {
    "quote": "official_api",
    "file_upload": "official_api",
    "order_create": "official_api",
    "payment": "approval_required",
    "tracking": "official_api"
  },

  "products": {
    "pcb": true,
    "pcba": true,
    "stencil": true,
    "box_build": false
  },

  "capabilities": {
    "rigid": true,
    "flex": true,
    "rigid_flex": "manual_review",
    "impedance": true,
    "hdi": "service_dependent"
  },

  "valid_from": "2026-07-20",
  "source_evidence_ids": []
}
```

Registry 不得依赖硬编码散落在 Adapter 中。

---

# 8. Capability 值

```text
supported
unsupported
conditional
manual_review
service_dependent
account_dependent
unknown
```

Unknown 不得视为 Supported。

---

# 9. 制造请求层级

```text
Manufacturing RFQ
→ Product Option
→ Quantity Break
→ Destination
→ Provider Request
→ Provider Quote Revision
```

---

# 10. Manufacturing Request Package

包含：

```text
PCB fabrication specification
Assembly specification
BOM
CPL
Assembly Drawing
Schematic optional
Firmware/Test
Packaging
Quality
Traceability
Shipping
Commercial
Files
```

---

# 11. 文件角色

```text
gerber
drill
netlist
ipc356
ipc2581
odbpp
native_pcb
bom
cpl
assembly_drawing
schematic
stackup
impedance_table
fabrication_drawing
panel_drawing
stencil_data
firmware
programming_guide
test_program
test_guide
packaging_guide
quality_plan
traceability_plan
special_requirements
```

---

# 12. 文件 Manifest

```json
{
  "package_id": "uuid",
  "product_id": "uuid",
  "release_package_id": "uuid",
  "revision": "MRP-1",

  "files": [
    {
      "role": "gerber",
      "file_name": "product-rev-c-gerber.zip",
      "uri": "s3://private/...",
      "sha256": "...",
      "approved": true
    }
  ],

  "content_hash": "sha256",
  "status": "approved_for_rfq"
}
```

---

# 13. 文件一致性

检查：

```text
product id
revision
export timestamp
board dimensions
layer count
refdes count
BOM count
CPL count
assembly drawing
firmware/test version
```

BOM、CPL 和 Gerber Revision 不一致时阻断 PCBA 自动提交。

---

# 14. PCB Fabrication Specification

```text
board type
single/panel
dimensions
quantity
layer count
material
Tg
board thickness
outer/inner copper
surface finish
ENIG thickness
solder mask
silkscreen
min trace/space
min hole
controlled impedance
stack-up
via type
plug/fill/cap
gold fingers
edge plating
castellated holes
counterbore/countersink
routing/V-cut
electrical test
warpage
tolerance
UL marking
date code/lot marking
```

---

# 15. Board Type

```text
single_board
panel_as_design
provider_panelization
array
coupon_panel
```

Provider Panelization 需要保存：

```text
boards per panel
rail
fiducial
tooling
X-out
panel fee
```

---

# 16. Material

```text
FR4
high_tg_FR4
aluminum
copper_core
flex_PI
rigid_flex
Rogers
PTFE
ceramic
special
```

Provider 支持和牌号必须版本化。

---

# 17. Stack-up

保存：

```text
layer sequence
copper thickness
dielectric material
dielectric thickness
impedance target
tolerance
provider standard/custom
```

制造商建议 Stack-up 必须经工程确认。

---

# 18. Impedance

```text
single-ended
differential
target ohm
tolerance
layer
trace geometry
coupon
test report
```

---

# 19. Via

```text
through
blind
buried
microvia
via_in_pad
filled
capped
resin_plugged
copper_filled
backdrill
```

---

# 20. Surface Finish

```text
HASL
lead_free_HASL
ENIG
ENEPIG
OSP
immersion_silver
immersion_tin
hard_gold
selective_finish
```

---

# 21. 特殊工艺

```text
gold_finger
bevel
castellated
edge_plating
carbon_ink
peelable_mask
controlled_depth
countersink
press_fit
heavy_copper
embedded_copper
```

---

# 22. Panelization

检查：

```text
array dimensions
rail width
fiducials
tooling holes
V-cut
mouse bite
tab route
component-to-edge
copper-to-edge
X-out
depanel stress
```

---

# 23. Stencil Specification

```text
top/bottom
framed/frameless
size
thickness
nano coating
step stencil
fiducials
polishing
paste layer source
```

---

# 24. PCBA Specification

```text
quantity
assembly sides
SMT count
THT count
BGA/QFN
fine pitch
0402/0201
bottom-side heavy parts
manual soldering
selective solder
wave solder
conformal coating
cleaning
depanel
programming
test
final inspection
```

---

# 25. BOM 规范

每行：

```text
RefDes
Manufacturer
MPN
Internal PN
Description
Package
Quantity
DNP
Approved Alternative
Sourcing Mode
Customer Supplied
Provider Library SKU
```

---

# 26. CPL 规范

```text
RefDes
X
Y
Rotation
Side
Package
Board Instance
Panel Position
```

---

# 27. BOM/CPL 对账

```text
all placed refdes in BOM
all BOM placed refdes in CPL
DNP excluded
quantity equals refdes count
side valid
rotation valid
package consistent
```

---

# 28. 元器件 Sourcing Mode

```text
provider_public_stock
provider_private_stock
provider_preorder
provider_global_sourcing
customer_consignment
customer_ship_direct
external_authorized_distribution
mixed
do_not_place
```

---

# 29. Provider Library Mapping

保存：

```text
provider part number
MPN
manufacturer
package
inventory
price
selected
mapping confidence
manual confirmation
```

Provider 内部 SKU 不能替代标准 MPN。

---

# 30. Shortfall 和 Unmatched

状态：

```text
matched
shortfall
unmatched
alternative_required
customer_supply_required
manual_quote
do_not_place
```

未匹配位号默认不能悄悄继续装配。

---

# 31. 替代料

制造商提议替代时：

```text
provider suggested part
reason
availability
price delta
technical data
affected refdes
```

进入 Agent 33 Review。

---

# 32. 客户寄料

要求：

```text
owner
quantity
shipping plan
provider receiving address
provider receipt confirmation
lot/date code
COC
customs
remaining stock
return policy
```

---

# 33. 烧录和序列号

```text
artifact hash
target refdes
programmer
parameters
serial source
MAC/IMEI
key injection
verification
record return
```

Provider 能力不明时进入人工审核。

---

# 34. 测试

```text
AOI
SPI
X-ray
ICT
FCT
boundary scan
burn-in
calibration
custom test
```

报价中明确：

```text
included
optional
customer fixture
provider fixture
manual quote
unsupported
```

---

# 35. Packaging

```text
individual ESD bag
panel packing
vacuum
desiccant
HIC
tray
inner box
carton
custom label
serial label
customer label
```

---

# 36. Quality Requirement

```text
IPC class
AQL
first article
FAI report
COC
COA
electrical test
impedance report
microsection
X-ray report
test record
material certification
```

---

# 37. Traceability Requirement

来自 Agent 43：

```text
PCB lot
component lot
date code
work order
firmware version
test result
finished serial
shipment
```

Provider 无法提供时标记 Capability Gap。

---

# 38. Shipping Request

```text
ship-to
country
postal code
city
incoterm
service level
carrier preference
insurance
consolidation
customs requirements
```

---

# 39. Quantity Break

例如：

```text
5
10
50
100
500
1000
5000
```

每档独立报价，不能按单位价格线性外推。

---

# 40. Build Time Option

```text
economy
standard
expedited
provider-specific
```

保存原始 Provider Label 和标准化工作日。

---

# 41. Canonical RFQ

```json
{
  "rfq_id": "uuid",
  "product_id": "uuid",
  "release_package_id": "uuid",

  "service": {
    "pcb": true,
    "stencil": true,
    "assembly": true,
    "box_build": false
  },

  "quantities": [10, 100, 500],

  "pcb_specification": {},
  "assembly_specification": {},
  "component_sourcing": {},
  "test_packaging": {},

  "destination": {
    "country_code": "US",
    "postal_code": "98101",
    "city": "Seattle"
  },

  "required_by": "2026-09-15",
  "currency": "USD",
  "status": "ready_for_provider_quote"
}
```

---

# 42. Preflight 检查

分为：

```text
file completeness
cross-file consistency
manufacturing feasibility
provider compatibility
commercial completeness
security
```

---

# 43. DFM 风险类型

```text
trace_space_near_limit
hole_near_limit
aspect_ratio_high
annular_ring_low
copper_to_edge_low
solder_mask_sliver
silkscreen_over_pad
panelization_risk
impedance_stackup_missing
via_process_complex
special_finish
warpage_risk
flex_bend_risk
component_spacing
polarity_ambiguous
BGA_Xray_required
thermal_profile_risk
```

---

# 44. 风险等级

```text
blocking
critical
high
medium
low
informational
unknown
```

---

# 45. Provider Compatibility

输出：

```text
supported
supported_with_standard_option
manual_engineering_review
requires_custom_quote
unsupported
unknown
```

---

# 46. 自动修正边界

允许自动修正：

```text
字段格式
单位
国家代码
颜色枚举
布尔映射
```

禁止自动修改：

```text
工程文件
Stack-up
Impedance
Surface Finish
Material
Copper
Component
Rotation
Polarity
Panelization
```

---

# 47. Provider Request Mapping

每次保存：

```text
canonical field
provider field
provider enum
conversion rule
source value
submitted value
mapping version
```

---

# 48. Raw Provider Payload

保存：

```text
request payload
response payload
HTTP status
provider request id
provider quote id
timestamp
hash
```

敏感字段脱敏。

---

# 49. Quote Status

```text
draft
submitted
instant_quote_received
engineering_review_pending
clarification_required
requoted
valid
expired
rejected
unsupported
cancelled
```

---

# 50. Canonical Quote

```json
{
  "provider_quote_id": "uuid",
  "provider": "pcbway",
  "provider_quote_number": "Q-123",
  "revision": 1,

  "scope": {
    "quantity": 100,
    "service": "turnkey_pcba",
    "build_option": "standard"
  },

  "cost": {
    "pcb": "120.00",
    "stencil": "35.00",
    "components": "780.00",
    "assembly": "240.00",
    "test": "50.00",
    "packaging": "20.00",
    "shipping": "72.00",
    "tax_duty": null,
    "discount": "-10.00",
    "total_before_tax": "1307.00",
    "currency": "USD"
  },

  "lead_time": {
    "file_review_days": 1,
    "component_sourcing_days": 7,
    "fabrication_days": 4,
    "assembly_days": 3,
    "test_days": 1,
    "shipping_days": 4,
    "available_date": "2026-08-15",
    "confidence": "medium"
  },

  "capability": {
    "status": "manual_engineering_review",
    "risks": []
  },

  "valid_until": "2026-07-27",
  "status": "valid"
}
```

---

# 51. 价格口径

```text
subtotal manufacturing
shipping
tax/duty
payment fee
coupon
account credit
grand total
```

Provider 不返回税费时：

```text
tax_duty_status = unknown
```

不能默认为零。

---

# 52. 固定和变动费用

```text
fixed:
  engineering
  stencil
  fixture
  setup
  programming setup
  test setup

variable:
  board
  components
  placement
  test per unit
  packaging
```

---

# 53. 元器件价格

保存：

```text
provider line price
provider quantity
provider loss
shortfall
private stock
consignment
sourcing fee
```

与 Agent 36/38 比较时保持服务范围一致。

---

# 54. Lead Time 标准化

```text
calendar basis
working day calendar
start condition
file review
payment
material ready
fabrication
assembly
test
packing
shipping
customs
```

---

# 55. Start Condition

```text
quote accepted
payment received
files approved
components ready
engineering questions closed
customer production file confirmed
```

Build Time 起点必须明确。

---

# 56. Available Date

```text
available_at_customer =
production_ready
+ packing
+ carrier
+ customs
+ destination handling
```

---

# 57. Quote Confidence

```text
high
medium
low
unknown
```

输入：

```text
instant vs engineering
component availability
special process
provider history
file completeness
quote freshness
```

---

# 58. Comparison Dimensions

```text
total landed cost
unit cost
cash timing
available date
capability fit
DFM risk
component sourcing risk
quality capability
traceability
historical OTD
communication
region
commercial terms
```

---

# 59. Hard Gate

```text
unsupported process
required certification missing
traceability cannot be met
customer restriction
delivery after hard deadline
unapproved component substitution
unresolved file conflict
```

---

# 60. Scoring

仅对通过 Hard Gate 的方案评分：

```text
cost score
lead-time score
capability score
quality score
risk score
historical performance score
commercial score
```

所有权重版本化。

---

# 61. Pareto Front

显示不可同时支配方案：

```text
lowest cost
fastest
lowest technical risk
best quality/history
best turnkey scope
```

---

# 62. 推荐解释

```text
recommended for prototype
recommended for pilot
recommended for mass production
recommended as backup
not recommended
```

必须列出理由和关键差异。

---

# 63. 历史供应商绩效

```text
quote accuracy
engineering response time
file review cycle
on-time delivery
quality ppm
rework/refund
communication
price change frequency
```

新 Provider 状态：

```text
insufficient_history
```

不能给默认满分。

---

# 64. 工艺风险评估

例如：

```text
Provider A 在线支持但历史风险高
Provider B 需要人工报价但能力更匹配
Provider C 成本低但 Traceability 不满足
```

系统不能只按报价排序。

---

# 65. Clarification

问题类型：

```text
file
stackup
impedance
panel
material
component
rotation
polarity
test
packaging
shipping
commercial
```

---

# 66. Engineering Question

```json
{
  "question_id": "uuid",
  "provider": "seeed",
  "provider_order_or_quote_id": "id",
  "category": "polarity",
  "affected_objects": ["D1", "C35"],
  "question": "Provider message",
  "requested_action": "confirm_orientation",
  "due_at": "ISO-8601",
  "status": "open"
}
```

---

# 67. 回复

回复必须保存：

```text
answer
attachment
approved_by
revision
timestamp
provider acknowledgement
```

---

# 68. Provider Production File

制造商可能生成或修改：

```text
working gerber
panel file
assembly preview
BOM match
CPL rotation
stencil file
```

必须与原始文件分开并人工批准。

---

# 69. Quote Revision

任何变化生成新 Revision：

```text
price
lead time
material
component
quantity
shipping
engineering conclusion
```

旧 Revision 不覆盖。

---

# 70. Order Draft

包含：

```text
provider
quote revision
file package
quantity
build option
shipping
billing
PO number
buyer
payment mode
approval status
```

---

# 71. 下单状态

```text
draft
internal_review
approved_to_create
provider_cart_created
provider_order_created
awaiting_engineering_review
awaiting_customer_confirmation
awaiting_payment
payment_approved
paid
in_production
completed
shipped
received
cancelled
refunded
rework
```

---

# 72. 付款边界

支付方式：

```text
provider_balance
credit_card
paypal
bank_transfer
account_credit
invoice_terms
```

V1 默认：

```text
payment_action = human_confirmed
```

不得保存信用卡明文。

---

# 73. Order Confirmation Gate

确认前重新校验：

```text
quote valid
price unchanged
file hash unchanged
provider files approved
shipping address
tax mode
PO approval
budget
payment approval
```

---

# 74. 幂等下单

Idempotency Key：

```text
tenant
provider
quote revision
file package hash
quantity
destination
order attempt version
```

---

# 75. Saga

```text
Create Provider Order
→ Link Internal PO
→ Approve Payment
→ Confirm Provider Order
→ Register Tracking
```

失败补偿：

```text
provider order created but internal link failed
→ retry link
→ do not create second order
```

---

# 76. 取消

检查：

```text
current provider status
production started
cancellation fee
component purchase committed
stencil/tooling completed
refund mode
```

只生成受控请求。

---

# 77. Reorder

检查：

```text
same file hash
same manufacturing revision
same component selection
same test
same packaging
stored stencil/fixture validity
```

有变化时作为新订单，不直接 Reorder。

---

# 78. Order Tracking

标准状态：

```text
engineering_review
material_preparation
PCB_fabrication
solder_mask
surface_finish
electrical_test
assembly
AOI
Xray
test
quality_check
packing
shipped
```

Provider 原始状态和标准状态同时保存。

---

# 79. Shipment

```text
carrier
tracking number
ship date
ETA
packages
weight
customs documents
delivery
```

---

# 80. 收货 Hook

```text
receipt
quantity
damage
IQC
lot
date code
certificate
nonconformance
```

进入 Agent 42。

---

# 81. Provider Adapter 接口

```python
class ManufacturingProviderAdapter:
    async def capabilities(self) -> ProviderCapabilityProfile: ...
    async def upload_files(self, package: FilePackage) -> UploadResult: ...
    async def quote(self, request: ProviderQuoteRequest) -> ProviderQuoteResult: ...
    async def quote_status(self, quote_id: str) -> ProviderQuoteStatus: ...
    async def create_order(self, request: ProviderOrderRequest) -> ProviderOrderResult: ...
    async def confirm_order(self, order_id: str) -> ProviderActionResult: ...
    async def cancel_order(self, order_id: str) -> ProviderActionResult: ...
    async def order_detail(self, order_id: str) -> ProviderOrderDetail: ...
    async def production_status(self, order_id: str) -> ProviderProductionStatus: ...
    async def shipment(self, order_id: str) -> ProviderShipmentStatus: ...
```

未支持方法返回：

```text
UNSUPPORTED_OPERATION
```

---

# 82. Assisted Submission Adapter

输出：

```text
provider portal link
field checklist
file bundle
submission instructions
manual task
expected response schema
```

人工回填 Quote 时保存证据。

---

# 83. Provider Credential

```text
tenant
provider
account
environment
scope
secret reference
status
last verified
```

Secret 存 Vault/KMS，不存数据库明文。

---

# 84. 限流和熔断

每 Provider：

```text
rate limit
concurrency
retry policy
timeout
circuit breaker
maintenance
```

---

# 85. 失败隔离

一家 Provider 失败：

```text
partial_results
```

其他 Provider 继续。

---

# 86. 标准请求状态机

```text
RECEIVED
→ VALIDATING_RELEASE_PACKAGE
→ BUILDING_FILE_PACKAGE
→ RUNNING_PREFLIGHT
→ LOADING_PROVIDER_CAPABILITIES
→ BUILDING_PROVIDER_REQUESTS
→ SUBMITTING_QUOTES
→ WAITING_PROVIDER_RESPONSES
→ NORMALIZING_QUOTES
→ RUNNING_CAPABILITY_GATES
→ CALCULATING_RISK
→ COMPARING_QUOTES
→ GENERATING_RECOMMENDATION
→ REVIEW_REQUIRED_OR_COMPLETED
```

---

# 87. 下单状态机

```text
QUOTE_SELECTED
→ ORDER_DRAFT
→ INTERNAL_APPROVAL
→ PROVIDER_ORDER_CREATE
→ ENGINEERING_REVIEW
→ CLARIFICATION
→ PRODUCTION_FILE_CONFIRMATION
→ PAYMENT_APPROVAL
→ PAYMENT_OR_CONFIRMATION
→ IN_PRODUCTION
→ TRACKING
→ SHIPPED
→ RECEIVED
→ IQC
→ CLOSED
```

---

# 88. 分支状态

```text
PARTIAL_QUOTE
MANUAL_QUOTE_REQUIRED
ENGINEERING_REVIEW_REQUIRED
SUBSTITUTION_REVIEW_REQUIRED
FILE_CORRECTION_REQUIRED
CAPABILITY_BLOCKED
BUDGET_BLOCKED
PAYMENT_BLOCKED
ORDER_FAILED_TEMPORARY
ORDER_FAILED_PERMANENT
CANCELLED
REFUNDED
```

---

# 89. 错误码

```text
RELEASE_PACKAGE_NOT_FOUND
RELEASE_PACKAGE_NOT_APPROVED
FILE_PACKAGE_INCOMPLETE
FILE_REVISION_MISMATCH
GERBER_INVALID
DRILL_FILE_MISSING
BOARD_OUTLINE_MISSING
BOM_INVALID
CPL_INVALID
BOM_CPL_MISMATCH
REFDES_MISMATCH
DNP_CONFLICT
STACKUP_MISSING
IMPEDANCE_TABLE_MISSING
PANELIZATION_INVALID
PROVIDER_PROFILE_MISSING
PROVIDER_CAPABILITY_UNKNOWN
PROVIDER_CAPABILITY_UNSUPPORTED
PROVIDER_AUTH_FAILED
PROVIDER_RATE_LIMITED
PROVIDER_API_UNAVAILABLE
PROVIDER_MANUAL_SUBMISSION_REQUIRED
FILE_UPLOAD_FAILED
QUOTE_SUBMISSION_FAILED
QUOTE_TIMEOUT
QUOTE_EXPIRED
QUOTE_SCOPE_MISMATCH
QUOTE_PRICE_CHANGED
ENGINEERING_REVIEW_REQUIRED
PROVIDER_CLARIFICATION_REQUIRED
COMPONENT_UNMATCHED
COMPONENT_SHORTFALL
SUBSTITUTION_NOT_APPROVED
CUSTOMER_CONSIGNED_PART_NOT_RECEIVED
TEST_CAPABILITY_UNSUPPORTED
TRACEABILITY_CAPABILITY_UNSUPPORTED
SHIPPING_QUOTE_MISSING
TAX_DUTY_UNKNOWN
BUDGET_BLOCKED
ORDER_APPROVAL_REQUIRED
ORDER_CREATE_FAILED
DUPLICATE_ORDER_PREVENTED
PAYMENT_APPROVAL_REQUIRED
PAYMENT_FAILED
ORDER_CONFIRMATION_FAILED
CANCEL_NOT_ALLOWED
TRACKING_UNAVAILABLE
JOB_CANCELLED
INTERNAL_ERROR


---

# 90. 数据库设计

## 90.1 `manufacturing_rfq_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
release_package_id UUID NOT NULL
request_mode VARCHAR NOT NULL
provider_ids JSONB NOT NULL
quantity_breaks JSONB NOT NULL
destination_context JSONB NOT NULL
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

## 90.2 `manufacturing_request_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NOT NULL
release_package_id UUID NOT NULL
package_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
service_scope JSONB NOT NULL
pcb_specification_uri TEXT NOT NULL
assembly_specification_uri TEXT NULL
component_sourcing_uri TEXT NULL
test_packaging_uri TEXT NULL
shipping_context_uri TEXT NOT NULL
manifest_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
approved_for_rfq_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, package_number, revision)
```

## 90.3 `manufacturing_package_files`

```text
id UUID PK
request_package_id UUID NOT NULL
file_role VARCHAR NOT NULL
file_name VARCHAR NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
mime_type VARCHAR NULL
size_bytes BIGINT NOT NULL
source_revision VARCHAR NULL
source_system VARCHAR NULL
approved BOOLEAN NOT NULL
approval_reference_id UUID NULL
confidentiality_level VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(request_package_id, file_role, sha256)
```

## 90.4 `manufacturing_preflight_runs`

```text
id UUID PK
request_package_id UUID NOT NULL
rule_bundle_version VARCHAR NOT NULL
status VARCHAR NOT NULL
file_completeness_status VARCHAR NOT NULL
cross_file_consistency_status VARCHAR NOT NULL
manufacturability_status VARCHAR NOT NULL
commercial_completeness_status VARCHAR NOT NULL
security_status VARCHAR NOT NULL
blocking_issue_count INT NOT NULL
review_issue_count INT NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 90.5 `manufacturing_preflight_issues`

```text
id UUID PK
preflight_run_id UUID NOT NULL
issue_type VARCHAR NOT NULL
category VARCHAR NOT NULL
severity VARCHAR NOT NULL
affected_file_ids JSONB NOT NULL
affected_objects JSONB NOT NULL
rule_id VARCHAR NOT NULL
message TEXT NOT NULL
evidence JSONB NOT NULL
suggested_action JSONB NULL
auto_fix_allowed BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 90.6 `provider_accounts`

```text
id UUID PK
tenant_id UUID NOT NULL
provider_id VARCHAR NOT NULL
account_name VARCHAR NOT NULL
environment VARCHAR NOT NULL
integration_mode VARCHAR NOT NULL
credential_secret_reference TEXT NULL
scope JSONB NOT NULL
billing_profile_id UUID NULL
shipping_profile_id UUID NULL
status VARCHAR NOT NULL
last_verified_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, provider_id, account_name, environment)
```

## 90.7 `provider_capability_profiles`

```text
id UUID PK
provider_id VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
source_type VARCHAR NOT NULL
integration_capabilities JSONB NOT NULL
product_capabilities JSONB NOT NULL
pcb_capabilities JSONB NOT NULL
assembly_capabilities JSONB NOT NULL
test_capabilities JSONB NOT NULL
traceability_capabilities JSONB NOT NULL
shipping_capabilities JSONB NOT NULL
commercial_capabilities JSONB NOT NULL
valid_from TIMESTAMPTZ NOT NULL
valid_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_id, profile_version)
```

## 90.8 `provider_field_mappings`

```text
id UUID PK
provider_id VARCHAR NOT NULL
adapter_version VARCHAR NOT NULL
canonical_field_path VARCHAR NOT NULL
provider_field_path VARCHAR NOT NULL
provider_enum_mapping JSONB NOT NULL
conversion_rule_id VARCHAR NULL
required_condition JSONB NULL
default_policy VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_id, adapter_version, canonical_field_path)
```

## 90.9 `provider_quote_requests`

```text
id UUID PK
rfq_job_id UUID NOT NULL
provider_account_id UUID NULL
provider_id VARCHAR NOT NULL
provider_request_version INT NOT NULL
request_package_id UUID NOT NULL
quantity_break NUMERIC NOT NULL
build_option VARCHAR NOT NULL
destination_context JSONB NOT NULL
provider_payload_uri TEXT NOT NULL
request_hash CHAR(64) NOT NULL
submission_mode VARCHAR NOT NULL
provider_request_id VARCHAR NULL
status VARCHAR NOT NULL
submitted_at TIMESTAMPTZ NULL
last_polled_at TIMESTAMPTZ NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
UNIQUE(rfq_job_id, provider_id, quantity_break, build_option, provider_request_version)
```

## 90.10 `provider_file_uploads`

```text
id UUID PK
provider_quote_request_id UUID NOT NULL
manufacturing_package_file_id UUID NOT NULL
provider_upload_id VARCHAR NULL
provider_file_name VARCHAR NULL
upload_mode VARCHAR NOT NULL
upload_status VARCHAR NOT NULL
provider_checksum VARCHAR NULL
uploaded_at TIMESTAMPTZ NULL
expires_at TIMESTAMPTZ NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_quote_request_id, manufacturing_package_file_id)
```

## 90.11 `provider_quote_revisions`

```text
id UUID PK
provider_quote_request_id UUID NOT NULL
provider_quote_number VARCHAR NULL
revision_number INT NOT NULL
quote_type VARCHAR NOT NULL
scope JSONB NOT NULL
raw_response_uri TEXT NOT NULL
response_hash CHAR(64) NOT NULL
currency CHAR(3) NOT NULL
cost_breakdown_uri TEXT NOT NULL
lead_time_breakdown_uri TEXT NOT NULL
capability_result_uri TEXT NOT NULL
engineering_review_status VARCHAR NOT NULL
component_match_status VARCHAR NULL
quoted_at TIMESTAMPTZ NOT NULL
valid_until TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_quote_request_id, revision_number)
```

## 90.12 `provider_quote_cost_items`

```text
id UUID PK
provider_quote_revision_id UUID NOT NULL
cost_category VARCHAR NOT NULL
cost_subcategory VARCHAR NOT NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
quantity_basis NUMERIC NULL
unit_amount NUMERIC NULL
fixed_or_variable VARCHAR NOT NULL
included_in_total BOOLEAN NOT NULL
tax_included BOOLEAN NULL
refundable BOOLEAN NULL
source_field_path VARCHAR NULL
estimate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 90.13 `provider_quote_lead_time_items`

```text
id UUID PK
provider_quote_revision_id UUID NOT NULL
stage VARCHAR NOT NULL
duration_value NUMERIC NULL
duration_unit VARCHAR NULL
calendar_basis VARCHAR NULL
start_condition VARCHAR NULL
start_at TIMESTAMPTZ NULL
end_at TIMESTAMPTZ NULL
confidence VARCHAR NOT NULL
source_field_path VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 90.14 `provider_component_matches`

```text
id UUID PK
provider_quote_revision_id UUID NOT NULL
mbom_line_id UUID NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
provider_part_number VARCHAR NULL
manufacturer VARCHAR NULL
mpn VARCHAR NULL
affected_refdes JSONB NOT NULL
required_quantity NUMERIC NOT NULL
matched_quantity NUMERIC NOT NULL
shortfall_quantity NUMERIC NOT NULL
sourcing_mode VARCHAR NOT NULL
match_status VARCHAR NOT NULL
mapping_confidence NUMERIC(5,4) NOT NULL
manual_confirmation_required BOOLEAN NOT NULL
substitution_candidate_id UUID NULL
unit_price NUMERIC NULL
currency CHAR(3) NULL
created_at TIMESTAMPTZ
```

## 90.15 `provider_capability_assessments`

```text
id UUID PK
provider_quote_revision_id UUID NOT NULL
request_requirement_path VARCHAR NOT NULL
provider_capability_path VARCHAR NOT NULL
assessment_status VARCHAR NOT NULL
hard_gate BOOLEAN NOT NULL
risk_level VARCHAR NOT NULL
provider_value JSONB NULL
requested_value JSONB NULL
reason_codes JSONB NOT NULL
review_required BOOLEAN NOT NULL
created_at TIMESTAMPTZ
```

## 90.16 `manufacturing_quote_comparisons`

```text
id UUID PK
rfq_job_id UUID NOT NULL
comparison_version INT NOT NULL
comparison_policy_version VARCHAR NOT NULL
currency CHAR(3) NOT NULL
destination_context JSONB NOT NULL
included_quote_revision_ids JSONB NOT NULL
excluded_quote_revision_ids JSONB NOT NULL
pareto_quote_revision_ids JSONB NOT NULL
recommended_quote_revision_id UUID NULL
recommendation_status VARCHAR NOT NULL
summary_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(rfq_job_id, comparison_version)
```

## 90.17 `manufacturing_quote_scores`

```text
id UUID PK
comparison_id UUID NOT NULL
provider_quote_revision_id UUID NOT NULL
hard_gate_status VARCHAR NOT NULL
cost_score NUMERIC NULL
lead_time_score NUMERIC NULL
capability_score NUMERIC NULL
quality_score NUMERIC NULL
risk_score NUMERIC NULL
historical_performance_score NUMERIC NULL
commercial_score NUMERIC NULL
weighted_total NUMERIC NULL
rank INT NULL
pareto BOOLEAN NOT NULL
reason_codes JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 90.18 `provider_engineering_questions`

```text
id UUID PK
tenant_id UUID NOT NULL
provider_id VARCHAR NOT NULL
provider_quote_revision_id UUID NULL
provider_order_id UUID NULL
provider_question_id VARCHAR NULL
category VARCHAR NOT NULL
affected_objects JSONB NOT NULL
question_text TEXT NOT NULL
requested_action VARCHAR NOT NULL
due_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
```

## 90.19 `provider_engineering_answers`

```text
id UUID PK
engineering_question_id UUID NOT NULL
answer_version INT NOT NULL
answer_text TEXT NOT NULL
attachment_file_ids JSONB NOT NULL
approved_by UUID NOT NULL
submitted_to_provider_at TIMESTAMPTZ NULL
provider_acknowledgement JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(engineering_question_id, answer_version)
```

## 90.20 `provider_production_file_revisions`

```text
id UUID PK
provider_id VARCHAR NOT NULL
provider_quote_revision_id UUID NULL
provider_order_id UUID NULL
file_role VARCHAR NOT NULL
revision_number INT NOT NULL
provider_file_id VARCHAR NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
change_summary JSONB NOT NULL
requires_customer_approval BOOLEAN NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 90.21 `manufacturing_order_drafts`

```text
id UUID PK
tenant_id UUID NOT NULL
comparison_id UUID NOT NULL
selected_quote_revision_id UUID NOT NULL
provider_account_id UUID NOT NULL
draft_number VARCHAR NOT NULL
quantity NUMERIC NOT NULL
build_option VARCHAR NOT NULL
shipping_profile_id UUID NOT NULL
billing_profile_id UUID NULL
internal_po_number VARCHAR NULL
currency CHAR(3) NOT NULL
expected_total NUMERIC NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
order_payload_uri TEXT NOT NULL
idempotency_key VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(idempotency_key)
```

## 90.22 `manufacturing_order_approvals`

```text
id UUID PK
order_draft_id UUID NOT NULL
approval_type VARCHAR NOT NULL
approval_level VARCHAR NOT NULL
status VARCHAR NOT NULL
conditions JSONB NOT NULL
assigned_to UUID NULL
requested_at TIMESTAMPTZ NOT NULL
decided_by UUID NULL
decided_at TIMESTAMPTZ NULL
decision_note TEXT NULL
```

## 90.23 `provider_orders`

```text
id UUID PK
tenant_id UUID NOT NULL
order_draft_id UUID NOT NULL
provider_id VARCHAR NOT NULL
provider_account_id UUID NOT NULL
provider_order_number VARCHAR NOT NULL
provider_group_number VARCHAR NULL
internal_purchase_order_id UUID NULL
provider_quote_revision_id UUID NOT NULL
file_package_hash CHAR(64) NOT NULL
quantity NUMERIC NOT NULL
currency CHAR(3) NOT NULL
order_total NUMERIC NOT NULL
payment_status VARCHAR NOT NULL
engineering_status VARCHAR NOT NULL
production_status VARCHAR NOT NULL
shipment_status VARCHAR NOT NULL
status VARCHAR NOT NULL
raw_order_uri TEXT NOT NULL
created_at TIMESTAMPTZ
confirmed_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(provider_id, provider_order_number)
```

## 90.24 `provider_order_status_history`

```text
id UUID PK
provider_order_id UUID NOT NULL
provider_raw_status VARCHAR NOT NULL
canonical_status VARCHAR NOT NULL
process_name VARCHAR NULL
status_time TIMESTAMPTZ NOT NULL
source_type VARCHAR NOT NULL
raw_payload_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 90.25 `provider_payment_actions`

```text
id UUID PK
provider_order_id UUID NOT NULL
payment_method VARCHAR NOT NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
approval_id UUID NOT NULL
provider_payment_reference VARCHAR NULL
status VARCHAR NOT NULL
initiated_by UUID NOT NULL
initiated_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
failure_reason TEXT NULL
```

## 90.26 `provider_shipments`

```text
id UUID PK
provider_order_id UUID NOT NULL
shipment_number VARCHAR NULL
carrier VARCHAR NULL
tracking_number VARCHAR NULL
package_count INT NULL
weight NUMERIC NULL
weight_unit VARCHAR NULL
shipped_at TIMESTAMPTZ NULL
estimated_delivery_at TIMESTAMPTZ NULL
delivered_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
raw_payload_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 90.27 `manufacturing_order_exceptions`

```text
id UUID PK
provider_order_id UUID NOT NULL
exception_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
provider_message TEXT NULL
affected_objects JSONB NOT NULL
financial_impact NUMERIC NULL
currency CHAR(3) NULL
delivery_impact_days INT NULL
recommended_actions JSONB NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 90.28 `provider_performance_snapshots`

```text
id UUID PK
tenant_id UUID NOT NULL
provider_id VARCHAR NOT NULL
site_or_service_scope JSONB NOT NULL
period_start DATE NOT NULL
period_end DATE NOT NULL
quote_accuracy NUMERIC NULL
engineering_response_hours NUMERIC NULL
file_review_cycles NUMERIC NULL
on_time_delivery_rate NUMERIC NULL
quality_ppm NUMERIC NULL
complaint_rate NUMERIC NULL
refund_rework_rate NUMERIC NULL
price_change_rate NUMERIC NULL
sample_size INT NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, provider_id, period_start, period_end)
```

## 90.29 `provider_adapter_runs`

```text
id UUID PK
provider_id VARCHAR NOT NULL
adapter_version VARCHAR NOT NULL
operation VARCHAR NOT NULL
request_reference_id UUID NULL
environment VARCHAR NOT NULL
status VARCHAR NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
request_hash CHAR(64) NULL
response_hash CHAR(64) NULL
http_status INT NULL
retry_count INT NOT NULL
error_code VARCHAR NULL
error_message TEXT NULL
metrics JSONB NOT NULL
```

## 90.30 `manufacturing_rfq_review_items`

```text
id UUID PK
rfq_job_id UUID NOT NULL
provider_quote_revision_id UUID NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
affected_objects JSONB NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
assigned_to UUID NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 91. 对象存储

```text
derived/manufacturing-rfq/
  {tenant_id}/{product_id}/
    {rfq_job_id}/
      input/
        release-package-manifest.json
        manufacturing-request.json
        files-manifest.json
        pcb-specification.json
        assembly-specification.json
        component-sourcing.json
        test-packaging.json
        shipping.json
      preflight/
        file-check.json
        cross-file-reconciliation.json
        dfm-risk.json
        blocking-issues.json
        trace.json.zst
      providers/
        seeed/
          request/
          response/
          uploads/
          manual-submission-package/
        nextpcb/
        pcbway/
        jlcpcb/
      quotes/
        canonical-quotes.json.zst
        cost-breakdowns.json.zst
        lead-time-breakdowns.json.zst
        component-matches.json.zst
        capability-assessments.json.zst
      comparison/
        normalized-comparison.json
        pareto-front.json
        score-trace.json
        recommendation.json
      engineering/
        questions.json
        answers.json
        provider-production-files/
      orders/
        drafts/
        approvals/
        provider-orders/
        status-history/
        shipments/
        exceptions/
      reports/
        rfq-summary.html
        rfq-summary.pdf
        technical-risk.html
        technical-risk.pdf
        order-audit-package.json
      debug/
        adapter-trace.json.zst
        mapping-trace.json.zst
        provider-raw-payload-index.json
```

---

# 92. API 设计

## 92.1 RFQ

```text
POST /api/v1/manufacturing-rfqs
POST /api/v1/manufacturing-rfqs/batch
GET  /api/v1/manufacturing-rfqs/{id}
GET  /api/v1/manufacturing-rfqs/{id}/events
POST /api/v1/manufacturing-rfqs/{id}/rerun
POST /api/v1/manufacturing-rfqs/{id}/cancel
POST /api/v1/manufacturing-rfqs/{id}/refresh-quotes
```

## 92.2 Preflight

```text
POST /api/v1/manufacturing-rfqs/{id}/preflight
GET  /api/v1/manufacturing-rfqs/{id}/preflight
GET  /api/v1/manufacturing-rfqs/{id}/preflight/issues
POST /api/v1/manufacturing-preflight/issues/{id}/resolve
```

## 92.3 Provider

```text
GET  /api/v1/manufacturing-providers
GET  /api/v1/manufacturing-providers/{id}/capabilities
GET  /api/v1/manufacturing-providers/{id}/accounts
POST /api/v1/manufacturing-providers/{id}/verify-account
GET  /api/v1/manufacturing-providers/{id}/adapter-health
```

## 92.4 Quote

```text
GET  /api/v1/manufacturing-rfqs/{id}/quotes
GET  /api/v1/manufacturing-quotes/{id}
GET  /api/v1/manufacturing-quotes/{id}/costs
GET  /api/v1/manufacturing-quotes/{id}/lead-time
GET  /api/v1/manufacturing-quotes/{id}/components
GET  /api/v1/manufacturing-quotes/{id}/capability
POST /api/v1/manufacturing-quotes/{id}/refresh
POST /api/v1/manufacturing-quotes/{id}/accept-for-comparison
POST /api/v1/manufacturing-quotes/{id}/exclude
```

## 92.5 Comparison

```text
POST /api/v1/manufacturing-rfqs/{id}/comparisons
GET  /api/v1/manufacturing-comparisons/{id}
GET  /api/v1/manufacturing-comparisons/{id}/pareto
GET  /api/v1/manufacturing-comparisons/{id}/recommendation
POST /api/v1/manufacturing-comparisons/{id}/select-quote
```

## 92.6 Engineering Questions

```text
GET  /api/v1/manufacturing-engineering/questions
GET  /api/v1/manufacturing-engineering/questions/{id}
POST /api/v1/manufacturing-engineering/questions/{id}/answer
POST /api/v1/manufacturing-engineering/questions/{id}/submit
GET  /api/v1/manufacturing-provider-files/{id}
POST /api/v1/manufacturing-provider-files/{id}/approve
POST /api/v1/manufacturing-provider-files/{id}/reject
```

## 92.7 Order

```text
POST /api/v1/manufacturing-orders/drafts
GET  /api/v1/manufacturing-orders/drafts/{id}
POST /api/v1/manufacturing-orders/drafts/{id}/submit
POST /api/v1/manufacturing-orders/drafts/{id}/approve
POST /api/v1/manufacturing-orders/drafts/{id}/create-provider-order
GET  /api/v1/manufacturing-orders/{id}
GET  /api/v1/manufacturing-orders/{id}/status
GET  /api/v1/manufacturing-orders/{id}/process
POST /api/v1/manufacturing-orders/{id}/confirm
POST /api/v1/manufacturing-orders/{id}/request-cancel
POST /api/v1/manufacturing-orders/{id}/reorder-check
```

## 92.8 Payment

```text
POST /api/v1/manufacturing-orders/{id}/payment-approval
POST /api/v1/manufacturing-orders/{id}/pay
GET  /api/v1/manufacturing-orders/{id}/payment
```

`pay` 只在 Provider Adapter、企业策略和用户权限均允许时可用。

## 92.9 Shipment 和 Exception

```text
GET  /api/v1/manufacturing-orders/{id}/shipments
GET  /api/v1/manufacturing-orders/{id}/exceptions
POST /api/v1/manufacturing-order-exceptions/{id}/resolve
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 93. 事件

## 输入事件

```text
manufacturing.release-package.released
mbom.revision.approved
routing.revision.approved
firmware.package.approved
test.specification.approved
packaging.bom.approved
component.alternatives.ready
component.lifecycle.changed
component.compliance.changed
component.market-data.ready
bom.risk.ready
procurement.packaging-plan.ready
costing.result.ready
inventory.reuse-plan.ready
```

## 输出事件

```text
manufacturing.rfq.ready
manufacturing.preflight.blocked
manufacturing.quote.received
manufacturing.quote.engineering-review-required
manufacturing.quote.comparison.ready
manufacturing.quote.selected
manufacturing.engineering-question.created
manufacturing.provider-file.approval-required
manufacturing.order-draft.ready
manufacturing.order.created
manufacturing.order.payment-required
manufacturing.order.in-production
manufacturing.order.process-changed
manufacturing.order.shipped
manufacturing.order.received
manufacturing.order.exception
```

## `manufacturing.quote.comparison.ready`

```json
{
  "event_type": "manufacturing.quote.comparison.ready",
  "event_version": "1.0",
  "rfq_job_id": "uuid",
  "comparison_id": "uuid",
  "summary": {
    "providers_requested": 4,
    "valid_quotes": 3,
    "manual_quotes_pending": 1,
    "hard_gate_passed": 2,
    "pareto_options": 2
  },
  "recommended_quote_revision_id": "uuid",
  "result_uri": "s3://.../recommendation.json",
  "created_at": "ISO-8601"
}
```

---

# 94. 规则和配置

```text
policies/
├── manufacturing-rfq-1.0.0.yaml
├── file-package.yaml
├── gerber-preflight.yaml
├── bom-cpl-reconciliation.yaml
├── pcb-dfm.yaml
├── pcba-dfm.yaml
├── provider-capability-gates.yaml
├── quote-normalization.yaml
├── lead-time-normalization.yaml
├── quote-comparison/
│   ├── prototype.yaml
│   ├── pilot.yaml
│   ├── mass-production.yaml
│   └── strategic.yaml
├── provider-selection.yaml
├── engineering-question.yaml
├── order-approval.yaml
├── payment-approval.yaml
├── cancellation.yaml
├── reorder.yaml
└── providers/
    ├── jlcpcb/
    ├── pcbway/
    ├── seeed/
    ├── nextpcb/
    └── enterprise/
```

---

# 95. Provider Adapter Versioning

```text
provider
adapter version
API version
field mapping version
capability profile
tested environment
released at
deprecated at
```

Provider 字段变化时：

```text
adapter degraded
quote disabled
order disabled
tracking may remain enabled
```

---

# 96. Provider Schema Drift

检测：

```text
unknown response field
missing required field
enum changed
price total mismatch
date format changed
authentication changed
```

触发：

```text
PROVIDER_SCHEMA_DRIFT
```

并自动关闭危险写操作。

---

# 97. Quote Normalization

步骤：

```text
validate raw response
→ preserve raw
→ map currency
→ map cost categories
→ map service scope
→ map lead time
→ map validity
→ map capability
→ reconcile total
→ quality score
```

---

# 98. Quote Total Reconciliation

```text
sum(included cost items)
+ tax if included
+ shipping if included
+ payment fee if included
+ discount
= provider total
```

不一致：

```text
QUOTE_TOTAL_RECONCILIATION_FAILED
```

强制审核。

---

# 99. 汇率

比较使用 Agent 39/统一 FX Snapshot：

```text
provider original currency
comparison currency
rate source
rate time
buffer
```

原始货币金额永久保存。

---

# 100. 税费和关税

来自：

```text
provider
Agent 35
destination
incoterm
historical import
```

输出：

```text
included
excluded
estimated
unknown
```

---

# 101. Quote Validity

推荐有效期不得晚于：

```text
provider quote valid until
component price valid until
component stock reservation
shipping quote valid until
FX policy
```

---

# 102. Provider Capability Evidence

证据来源：

```text
official API response
official capability page
approved partner agreement
provider engineering confirmation
historical accepted order
manual verified profile
```

历史订单成功不代表永久能力，需有效期。

---

# 103. DFM 风险引擎

V1 使用：

```text
deterministic rules
geometry facts
provider capability limits
```

可选接入第三方 DFM 工具，但结果标记来源。

---

# 104. DFM 自动解析边界

可程序提取：

```text
board dimensions
layer count
drill size
trace/space estimate
copper-to-edge
outline
paste layers
component count
BGA/QFN presence
```

无法可靠提取的：

```text
material intent
special tolerance
controlled impedance without table
customer quality expectation
```

必须来源于 Release Package。

---

# 105. Provider Score 规则

推荐先 Hard Gate，再多目标排序。

权重示例：

```text
prototype:
  cost 25
  lead time 35
  capability 15
  risk 15
  history 10

mass production:
  cost 25
  lead time 15
  capability 20
  quality 20
  risk 15
  history 5
```

只是模板，不是固定业务值。

---

# 106. Cost Score

使用归一化：

```text
landed total cost
unit cost
fixed cost burden
component cost uncertainty
```

未知税费降低 Confidence。

---

# 107. Lead-time Score

使用：

```text
available_at_customer
confidence
required-by gap
engineering review uncertainty
component sourcing risk
```

---

# 108. Capability Score

维度：

```text
board process
assembly
test
programming
packaging
traceability
quality report
```

---

# 109. Quality/History Score

数据不足：

```text
insufficient_history
```

不使用虚构默认值。

---

# 110. Risk Score

综合：

```text
DFM risk
component shortfall
unmatched BOM
special process
provider response quality
regional/logistics risk
quote freshness
data completeness
```

---

# 111. 人工报价

支持人工上传：

```text
provider quotation PDF
spreadsheet
email
portal screenshot
```

但核心字段必须结构化录入并关联证据。

PDF/截图解析可以辅助，必须人工确认。

---

# 112. Email RFQ

只有企业批准时：

```text
approved provider contact
approved email template
file package secure link
expiry
audit
```

不通过普通附件无限期暴露工程文件。

---

# 113. 文件安全

- 私有 Bucket；
- Provider-specific 临时链接；
- 过期时间；
- 下载次数；
- IP/账号限制可选；
- 文件 Hash；
- 下载审计；
- 删除 Provider 临时副本策略；
- 不在日志打印文件内容；
- Native Design Files 默认不发送，除非明确需要和批准。

---

# 114. 数据最小化

PCB报价只发送 PCB 所需数据。

PCBA报价才发送：

```text
BOM
CPL
Assembly Drawing
```

Firmware、Schematic、Test 仅在服务范围需要时发送。

---

# 115. Provider Portal Handoff

无 API 时生成：

```text
Submission Package
Provider Field Summary
Copyable Values
File Bundle
Portal Deep Link
Checklist
Manual Task
```

回填：

```text
quote number
price
lead time
validity
evidence
```

---

# 116. 生产文件确认

制造商工程文件审批必须比较：

```text
original package hash
provider working file hash
parameter delta
component delta
orientation delta
panel delta
```

关键变化必须逐项确认。

---

# 117. Order Audit Package

包含：

```text
selected quote
comparison
approvals
file package hash
provider production files
engineering Q&A
payment approval
order response
status history
shipment
exceptions
```

---

# 118. 可观测性

Metrics：

```text
manufacturing_rfq_jobs_total{status}
manufacturing_rfq_duration_seconds{step}
manufacturing_preflight_issues_total{category,severity}
manufacturing_provider_requests_total{provider,operation,status}
manufacturing_provider_latency_seconds{provider,operation}
manufacturing_provider_schema_drift_total{provider}
manufacturing_quotes_total{provider,status,type}
manufacturing_quote_total_reconciliation_failures_total{provider}
manufacturing_quote_component_shortfalls_total{provider}
manufacturing_quote_capability_blocks_total{provider,capability}
manufacturing_quote_comparisons_total{status}
manufacturing_engineering_questions_total{provider,category,status}
manufacturing_orders_total{provider,status}
manufacturing_duplicate_order_prevented_total{provider}
manufacturing_payment_actions_total{provider,status}
manufacturing_order_process_lag_seconds{provider}
manufacturing_order_exceptions_total{provider,type}
manufacturing_shipments_total{provider,status}
```

---

# 119. Dashboard

```text
RFQ Coverage
Provider Adapter Health
Quote Response Time
Quote Expiry
Capability Gaps
DFM Blocking Issues
BOM/CPL Match
Component Shortfall
Cost/Lead-time Pareto
Engineering Questions
Pending Production File Approval
Awaiting Payment
Orders in Production
Process Progress
Shipment ETA
Order Exceptions
Provider OTD/Quality
```

---

# 120. Benchmark

## Files/Preflight

```text
Gerber completeness
layer/drill/outline detection
BOM/CPL reconciliation
DNP and refdes
revision consistency
file hash
```

## Provider Mapping

```text
field mapping accuracy
enum conversion
unsupported detection
schema drift
raw preservation
```

## Quote

```text
cost categorization
total reconciliation
currency conversion
lead-time normalization
validity
service-scope equivalence
```

## Capability/Risk

```text
hard gate recall
DFM risk recall
false unsupported rate
component shortfall
test/traceability capability
```

## Order

```text
idempotent creation
approval enforcement
price recheck
file hash recheck
payment gate
status normalization
cancel/reorder
```

## Security

```text
credential isolation
file access
tenant isolation
payment permission
audit package
```

---

# 121. 初始质量目标

```text
File Manifest Hash Accuracy = 100%
BOM/CPL RefDes Reconciliation Accuracy = 100%
DNP Exclusion Accuracy = 100%
Provider Field Mapping Accuracy >= 99.9%
Unsupported Capability Detection Recall >= 99.5%
Quote Raw Payload Preservation = 100%
Quote Total Reconciliation Accuracy = 100%
Currency Arithmetic Accuracy = 100%
Service Scope Comparison Accuracy >= 99.5%
Hard Gate False-negative Rate <= 0.1%
Duplicate Provider Order Rate = 0%
Unauthorized Payment Rate = 0%
Provider Production File Approval Enforcement = 100%
Order Status Idempotency = 100%
Tenant/Credential/File Isolation = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经验证的保证。

---

# 122. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## PCB 文件

1. 2-layer Gerber；
2. 4-layer；
3. Missing Drill；
4. Missing Outline；
5. Wrong Layer Count；
6. Multiple Board Designs；
7. Panel as Design；
8. Provider Panelization；
9. V-cut；
10. Mouse Bite；
11. Impedance；
12. Custom Stack-up；
13. HDI；
14. Blind/Buried；
15. Via-in-pad；
16. Gold Finger；
17. Castellated；
18. Flex；
19. Aluminum；
20. Special Material。

## PCBA

21. BOM/CPL Match；
22. Missing RefDes；
23. Duplicate RefDes；
24. DNP；
25. Top/Bottom；
26. Rotation；
27. Polarity；
28. BGA；
29. 0201；
30. THT；
31. Customer Consigned；
32. Provider Stock；
33. Preorder；
34. Shortfall；
35. Unmatched；
36. Approved Substitute；
37. Unapproved Substitute；
38. Programming；
39. FCT；
40. Traceability。

## Quote

41. Instant Quote；
42. Engineering Quote；
43. Manual Quote；
44. Multiple Quantity；
45. Multiple Build Time；
46. Shipping Included；
47. Shipping Excluded；
48. Tax Unknown；
49. Coupon；
50. Account Price；
51. Fixed Fee；
52. Stencil；
53. Tooling；
54. Quote Revision；
55. Quote Expired；
56. Price Changed；
57. Total Mismatch；
58. Currency；
59. Partial Provider Failure；
60. Provider Timeout。

## Capability/Comparison

61. Supported；
62. Conditional；
63. Manual Review；
64. Unsupported；
65. Unknown；
66. Hard Deadline；
67. Cheapest Blocked；
68. Fastest Risky；
69. Pareto；
70. Insufficient History；
71. Prototype Policy；
72. Mass Production Policy；
73. Region Risk；
74. Traceability Gap；
75. Test Gap。

## Order

76. Draft；
77. Approval；
78. Provider Cart；
79. Provider Order；
80. Duplicate Retry；
81. Engineering Question；
82. Provider File Approval；
83. Payment Gate；
84. Payment Failed；
85. In Production；
86. Process Status；
87. Shipment；
88. Cancel Before Production；
89. Cancel After Production；
90. Reorder Same Files；
91. Reorder Changed Files；
92. Refund；
93. Rework；
94. Saga Partial Failure；
95. Adapter Schema Drift；
96. Credential Scope；
97. Tenant Isolation；
98. Permission Denied；
99. 1000 Parallel Quotes；
100. Audit Replay。

---

# 123. 性能要求

单项目、4 Provider、6 Quantity Break：

```text
Preflight P95 < 10 s
Canonical Provider Request Build P95 < 2 s
Comparison P95 < 2 s after quotes available
Quote Detail Query P95 < 500 ms
```

Provider 网络调用受外部延迟影响，单独统计。

批量：

```text
1,000 RFQ jobs
```

需要：

- Provider 隔离队列；
- 每 Provider 限流；
- 并行 Quote；
- 异步人工报价；
- 增量刷新；
- 可取消；
- 断点恢复；
- Raw Payload 对象存储。

---

# 124. 缓存和增量

缓存键：

```text
request_package_hash
+ provider_capability_profile
+ adapter_version
+ provider_account
+ quantity
+ build_option
+ destination
+ shipping mode
+ quote policy version
```

刷新条件：

```text
quote expired
component stock changed
price changed
shipping changed
provider profile changed
files changed
quantity changed
```

任何 File Hash 变化都必须生成新 Provider Request。

---

# 125. 安全与权限

- 工程文件、BOM、固件、测试和客户信息严格隔离；
- Provider Account Credential 使用 Vault/KMS；
- 不保存浏览器 Cookie；
- Payment Credential 不进入业务数据库或日志；
- Quote、Order、Payment、Cancel 分别授权；
- 文件上传使用最小范围短期 URL；
- Native Design Files 默认不发送；
- Provider 只接收当前 RFQ 必需文件；
- 人工下载和上传全部审计；
- Provider Production File 必须病毒扫描和 Hash；
- 不执行上传文件中的宏或脚本；
- PDF/HTML 转义；
- Provider 回调验签；
- 防重放；
- API 限流；
- Worker 网络出口限制到批准 Provider；
- 不将工程文件发送给外部通用模型；
- AI 如用于解释风险，只能基于脱敏结构化事实；
- 不允许 AI 发起支付、下单、取消或批准工程修改；
- 公开测试只用合成或授权工程文件；
- 正式订单和审计记录不可硬删除。

---

# 126. 推荐技术栈

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

批量和文件分析：

```text
Polars
PyArrow
DuckDB
Gerber/Excellon parser
KiCad parser
```

HTTP：

```text
httpx
tenacity
circuit breaker
```

Secret：

```text
Vault / Cloud KMS / Secret Manager
```

报告：

```text
Jinja2
Playwright / WeasyPrint
```

V1 不需要 LLM。

---

# 127. 推荐仓库结构

```text
pcb-smt-manufacturing-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── pcb-smt-manufacturing-agent-spec.md
│   ├── manufacturing-request-domain-model.md
│   ├── file-package-and-preflight.md
│   ├── pcb-capability-model.md
│   ├── pcba-bom-cpl-model.md
│   ├── provider-adapter-contract.md
│   ├── provider-capability-registry.md
│   ├── quote-normalization.md
│   ├── lead-time-normalization.md
│   ├── capability-risk-comparison.md
│   ├── engineering-review-workflow.md
│   ├── order-payment-saga.md
│   ├── provider-status-normalization.md
│   ├── security-and-file-protection.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-provider-capabilities-are-versioned.md
│       ├── 0002-instant-quote-is-not-production-approval.md
│       ├── 0003-official-api-or-assisted-submission-only.md
│       ├── 0004-provider-files-require-human-approval.md
│       ├── 0005-payment-is-a-separate-authorized-action.md
│       └── 0006-raw-provider-payloads-are-preserved.md
├── src/
│   └── manufacturing_rfq/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── file_package.py
│       │   ├── pcb_spec.py
│       │   ├── assembly_spec.py
│       │   ├── provider.py
│       │   ├── quote.py
│       │   ├── comparison.py
│       │   ├── engineering.py
│       │   ├── order.py
│       │   └── shipment.py
│       ├── adapters/
│       │   ├── base.py
│       │   ├── jlcpcb/
│       │   │   ├── client.py
│       │   │   ├── auth.py
│       │   │   ├── capabilities.py
│       │   │   ├── upload.py
│       │   │   ├── quote.py
│       │   │   ├── order.py
│       │   │   └── tracking.py
│       │   ├── pcbway/
│       │   ├── seeed/
│       │   │   ├── assisted.py
│       │   │   └── partner_api.py
│       │   ├── nextpcb/
│       │   │   ├── assisted.py
│       │   │   └── partner_api.py
│       │   └── manual/
│       ├── inputs/
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
│       │   ├── agent41_inventory.py
│       │   ├── agent42_traceability.py
│       │   └── agent43_release.py
│       ├── files/
│       │   ├── manifest.py
│       │   ├── hashing.py
│       │   ├── access.py
│       │   ├── bundle.py
│       │   └── malware_scan.py
│       ├── preflight/
│       │   ├── gerber.py
│       │   ├── drill.py
│       │   ├── pcb.py
│       │   ├── bom_cpl.py
│       │   ├── panel.py
│       │   ├── assembly.py
│       │   ├── consistency.py
│       │   └── issues.py
│       ├── capabilities/
│       │   ├── registry.py
│       │   ├── profiles.py
│       │   ├── negotiation.py
│       │   ├── gates.py
│       │   └── evidence.py
│       ├── mapping/
│       │   ├── provider_fields.py
│       │   ├── enums.py
│       │   ├── units.py
│       │   ├── validation.py
│       │   └── trace.py
│       ├── quotes/
│       │   ├── submission.py
│       │   ├── normalization.py
│       │   ├── costs.py
│       │   ├── lead_time.py
│       │   ├── components.py
│       │   ├── validity.py
│       │   └── reconciliation.py
│       ├── risk/
│       │   ├── dfm.py
│       │   ├── capability.py
│       │   ├── supply.py
│       │   ├── quality.py
│       │   └── confidence.py
│       ├── comparison/
│       │   ├── hard_gates.py
│       │   ├── normalization.py
│       │   ├── scoring.py
│       │   ├── pareto.py
│       │   ├── recommendation.py
│       │   └── trace.py
│       ├── engineering/
│       │   ├── questions.py
│       │   ├── answers.py
│       │   ├── provider_files.py
│       │   └── approvals.py
│       ├── orders/
│       │   ├── drafts.py
│       │   ├── approvals.py
│       │   ├── creation.py
│       │   ├── confirmation.py
│       │   ├── payment.py
│       │   ├── cancellation.py
│       │   ├── reorder.py
│       │   ├── saga.py
│       │   └── idempotency.py
│       ├── tracking/
│       │   ├── status_map.py
│       │   ├── polling.py
│       │   ├── webhooks.py
│       │   ├── process.py
│       │   └── shipment.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── provider-profiles/
├── provider-field-mappings/
├── report-templates/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_provider_profiles.py
    ├── validate_field_mappings.py
    ├── inspect_manufacturing_package.py
    ├── run_preflight.py
    ├── replay_provider_quote.py
    ├── reconcile_quote_totals.py
    ├── compare_manufacturing_quotes.py
    ├── verify_order_idempotency.py
    └── run_manufacturing_benchmark.py
```

---

# 128. 官方资料基线

以下资料只用于确认当前集成模式和公开流程，实际开发前仍需重新核验：

```text
JLCPCB API Platform
JLCPCB Online API Access Application, 2026-03-25
JLCPCB PCBA Ordering and Component Matching Guides
PCBWay Partner API Help
PCBWay PCB Quotation / Place Order / Confirm Order / Process API
Seeed Fusion PCB/PCBA Ordering and File Preparation Guides
NextPCB PCB Ordering Guides
```

Provider Capability Registry 必须保存资料日期和证据，不把本文档中的描述永久硬编码。


---

# 129. Codex 分阶段实施

不要让 Codex 一次实现四家 Provider、文件 DFM、报价比较、支付、生产跟踪和全部写回。

## Phase 0：仓库侦察和 Provider 能力盘点

Codex 必须检查：

1. Agent 31–43 的真实完成程度和接口；
2. 当前 Manufacturing Release Package；
3. 当前 Gerber、Drill、BOM、CPL、Assembly Drawing、Stack-up、Impedance 和 Panel 数据；
4. 当前 PCB/PCBA/Stencil/Box Build 订单数据；
5. 当前 Seeed、NextPCB、PCBWay、JLCPCB 的账户和合作关系；
6. 当前正式 API、Partner API、Sandbox、Production 和审批状态；
7. 当前 Provider 字段、枚举、限流和认证；
8. 当前人工询价、邮件询价、Portal 下单和回填流程；
9. 当前制造商 Capability 和报价字段；
10. 当前 DFM、BOM/CPL 检查和文件 Viewer；
11. 当前供应商选择、质量、OTD 和历史绩效；
12. 当前采购申请、PO、付款和预算审批；
13. 当前订单、工程审核、生产文件确认和进度；
14. 当前物流、Tracking、收货和 IQC；
15. 当前 Credential、Vault、文件权限和签名 URL；
16. 当前 Saga、Outbox、Idempotency、Retry、Circuit Breaker；
17. 当前 Provider Schema Drift 处理；
18. 统计人工报价比例、工程问题、报价改价和交付偏差；
19. 抽样分析合成或脱敏订单；
20. 不修改业务代码；
21. 不创建 Migration；
22. 不安装依赖；
23. 不调用真实下单或付款接口；
24. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Manufacturing Request；
- File Manifest；
- PCB/Assembly Specification；
- Provider Capability；
- Provider Request；
- Canonical Quote；
- Cost/Lead-time；
- Component Match；
- Comparison；
- Engineering Question；
- Order Draft；
- Provider Order；
- Shipment；
- Event；
- JSON Schema。

## Phase 2：File Package 和 Preflight Framework

实现：

- Manifest；
- Hash；
- Revision；
- File Role；
- Private Storage；
- Malware Scan Hook；
- Completeness；
- Cross-file Consistency；
- Review Issues；
- Evidence。

## Phase 3：PCB Fabrication Specification

实现：

- Board；
- Layer；
- Material；
- Thickness；
- Copper；
- Finish；
- Mask/Silkscreen；
- Trace/Space；
- Hole；
- Stack-up；
- Impedance；
- Via；
- Special Process；
- Panelization。

## Phase 4：BOM/CPL/Assembly Preflight

实现：

- BOM；
- CPL；
- RefDes；
- DNP；
- Quantity；
- Side；
- Rotation；
- Package；
- Polarity；
- Assembly Drawing；
- Reconciliation；
- Blocking Issues。

## Phase 5：Provider Capability Registry

实现：

- Provider；
- Profile Version；
- Integration Mode；
- Product/Process Capability；
- Evidence；
- Validity；
- Unknown；
- Manual Review；
- Negotiation API。

## Phase 6：Provider Adapter Contract

实现：

- Base Adapter；
- Authentication Interface；
- Upload；
- Quote；
- Order；
- Tracking；
- Unsupported Operation；
- Raw Payload；
- Retry；
- Circuit Breaker；
- Adapter Health。

## Phase 7：PCBWay Adapter

实现：

- Sandbox/Test Environment；
- PCB Quotation；
- SMT Quotation；
- File/Place Order；
- Freight；
- Order Detail；
- Production Process；
- Contract Tests；
- 禁止默认支付。

## Phase 8：JLCPCB Adapter

实现：

- Approved API Account Boundary；
- PCB API；
- File Upload；
- Quote；
- Order；
- Tracking；
- Stencil/Components Hook；
- Contract Tests；
- 未获批环境仅 Mock/Fixture。

## Phase 9：Seeed Assisted/Partner Adapter

实现：

- Capability Profile；
- Submission Package；
- Gerber/BOM/CPL Checklist；
- Deep Link；
- Manual Task；
- Quote Evidence Import；
- Partner API Interface Placeholder；
- 不使用未授权网页自动化。

## Phase 10：NextPCB Assisted/Partner Adapter

实现：

- Gerber Parameters；
- Build/Shipping Checklist；
- Submission Package；
- Deep Link；
- Manual Task；
- Quote Evidence Import；
- Partner API Placeholder；
- 不使用未授权网页自动化。

## Phase 11：Provider Field Mapping

实现：

- Canonical-to-provider；
- Enum；
- Unit；
- Country；
- Board/Panel；
- Material；
- Finish；
- Build Option；
- Validation；
- Mapping Trace；
- Schema Drift Detection。

## Phase 12：Quote Submission 和 Polling

实现：

- Parallel Submission；
- Provider Queue；
- Rate Limit；
- Timeout；
- Poll；
- Manual Pending；
- Partial Results；
- Cancel；
- Raw Response；
- Events。

## Phase 13：Quote Normalization

实现：

- Service Scope；
- Cost Categories；
- Fixed/Variable；
- Shipping；
- Tax Status；
- Discounts；
- Currency；
- Lead-time Stages；
- Validity；
- Total Reconciliation；
- Confidence。

## Phase 14：Component Matching 和 Sourcing

实现：

- Provider SKU；
- MPN；
- RefDes；
- Required/Matched/Shortfall；
- Provider Stock；
- Private Stock；
- Preorder；
- Consignment；
- Agent 33 Review；
- No Auto DNP。

## Phase 15：Capability 和 DFM Risk

实现：

- Hard Gates；
- Provider Compatibility；
- DFM Rules；
- Test/Programming/Traceability；
- Special Process；
- Unknown；
- Evidence；
- Review。

## Phase 16：Comparison、Pareto 和 Recommendation

实现：

- Scope Equivalence；
- Landed Cost；
- Available Date；
- Capability；
- Risk；
- History；
- Policy by Stage；
- Pareto；
- Explainable Recommendation；
- No Cheapest-only Selection。

## Phase 17：Engineering Questions 和 Provider Files

实现：

- Question；
- Owner；
- SLA；
- Answer；
- Attachments；
- Provider Acknowledgement；
- Provider Working Files；
- Hash/Diff；
- Approval/Rejection；
- Requote。

## Phase 18：Order Draft 和 Approval

实现：

- Selected Quote；
- Quote Validity；
- File Hash；
- Shipping/Billing；
- Internal PO；
- Budget；
- Approval Routing；
- Idempotency Key；
- No Provider Write Yet。

## Phase 19：Provider Order Saga

实现：

- Create Cart/Order；
- Link PO；
- Engineering Review；
- Confirmation；
- Payment Gate；
- Compensation；
- Duplicate Prevention；
- Partial Failure；
- Audit。

## Phase 20：Payment Boundary

实现：

- Human-confirmed Payment；
- Provider Balance；
- External Payment Redirect；
- Payment Approval；
- Amount Recheck；
- No Card Storage；
- Failure；
- Idempotency；
- Audit。

## Phase 21：Production Tracking 和 Shipment

实现：

- Raw Status；
- Canonical Status；
- Process；
- Poll/Webhook；
- ETA；
- Shipment；
- Tracking；
- Exception；
- Agent 40/42 Events。

## Phase 22：Cancel、Refund、Rework 和 Reorder

实现：

- Cancellation Eligibility；
- Cost；
- Request；
- Refund；
- Rework；
- Reorder Hash Check；
- Stored Stencil/Fixture；
- New-order Conversion；
- Approval。

## Phase 23：API、Batch、Cache 和 Security

实现：

- API；
- Batch；
- Jobs；
- Progress；
- Cache；
- Object Storage；
- Permissions；
- Credential Vault；
- Signed URL；
- Network Egress；
- Audit。

## Phase 24：Benchmark、监控和生产发布

实现：

- Golden Provider Fixtures；
- Adapter Contract Tests；
- Preflight Benchmark；
- Quote Reconciliation；
- Order Idempotency；
- Load Test；
- Metrics；
- Dashboard；
- Feature Flag per Provider/Operation；
- Rollback；
- Disaster Recovery。

## Phase 25：高级供应商绩效闭环，可选

稳定后：

- Quote vs Final Price；
- Promised vs Actual Lead Time；
- Engineering Cycles；
- Quality/Return；
- Risk Calibration；
- Provider Recommendation Shadow；
- 不自动封禁或提高交易权限。

---

# 130. Codex 工作纪律

Codex 必须：

1. Provider-neutral Request 和 Provider-specific Payload 分开；
2. Provider Capability Registry 版本化；
3. Unknown Capability 不当 Supported；
4. Instant Quote 不等于 Engineering-approved Quote；
5. Quote 不等于 Order；
6. Order 不等于 Payment；
7. Payment 不等于 Production Start；
8. Build Time 起点必须明确；
9. Production Time 和 Customer Available Date 分开；
10. Gerber、Drill、BOM、CPL 和 Assembly Drawing 版本一致；
11. BOM/CPL RefDes 必须对账；
12. DNP 不得被默认贴装；
13. Provider SKU 不替代 MPN；
14. Unmatched/Shortfall 不得静默略过；
15. Provider Suggested Substitute 必须进入 Agent 33；
16. Customer Consigned Part 必须确认已收货；
17. Agent 43 Release Package 和 File Hash 必须固定；
18. 文件变更后生成新 RFQ；
19. Provider Working File 与原文件分开；
20. Stack-up、Impedance、Material、Finish、Copper 的 Provider 修改必须审批；
21. Rotation/Polarity 变化必须审批；
22. 自动修正仅限格式、单位和枚举；
23. 原始 Provider Payload 永久保留；
24. Canonical Quote 必须可追溯到 Raw Field；
25. Quote Total 必须对账；
26. Shipping Included/Excluded 必须明确；
27. Tax/Duty Unknown 不默认为 0；
28. Currency 使用 Decimal/Minor Units；
29. Quote Validity 必须执行；
30. 多 Provider 比较必须保持 Scope 相同；
31. Hard Gate 在 Score 前；
32. 推荐不能只按最低价；
33. Historical Data 不足不能默认满分；
34. 人工报价必须有证据和人工确认；
35. 无正式 API 不使用未授权 Cookie/RPA；
36. Assisted Submission 明确人工步骤；
37. Credential 只存 Secret Reference；
38. Payment Credential 不进入日志；
39. 真实下单必须显式批准；
40. 真实支付必须显式批准；
41. 创建订单前重新检查价格和 Hash；
42. 下单和支付分别幂等；
43. Retry 不得创建重复订单；
44. Provider Schema Drift 自动禁用危险写操作；
45. 一家 Provider 失败不阻断其他 Provider；
46. Cancel/Reorder 只在 Provider 状态允许时执行；
47. Reorder 前比较完整文件 Hash 和制造版本；
48. Tracking 保存 Raw 和 Canonical Status；
49. Provider Callback 必须验签；
50. Agent 40只消费确认订单和有效 ETA；
51. Agent 42只消费实际收货和生产追溯；
52. AI 不可下单、支付、取消或批准工程修改；
53. 不将私有工程文件发给外部通用模型；
54. 公开测试只用合成或授权文件；
55. 不伪造 Provider API、价格、能力、订单、测试或 Benchmark；
56. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Provider Adapter/Mapping 变化；
    - 测试命令；
    - 真实结果；
    - Preflight Accuracy；
    - Quote Reconciliation；
    - Adapter Contract；
    - Order Idempotency；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 131. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pcb-smt-manufacturing-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第44个 Agent：

PCB/SMT Manufacturing RFQ, Comparison & Order Orchestration Agent /
PCB/SMT 制造询价与下单 Agent。

本 Agent 将 Agent 43 的 Manufacturing Release Package，包括：

- Gerber、Drill、Stack-up、Impedance 和制造要求；
- BOM、CPL、Assembly Drawing 和 DNP；
- MBOM、Routing、RefDes 和替代料范围；
- Firmware、Programming、Test、Calibration；
- Packaging、Quality 和 Traceability；

转换为 Provider-neutral Manufacturing Request Package，并通过：

- JLCPCB 官方 API；
- PCBWay Partner API；
- Seeed Fusion 合作伙伴接口或受控人工提交；
- NextPCB 合作伙伴接口或受控人工提交；

获取和比较：

- PCB、Stencil、PCBA 和可选 Box Build 报价；
- 数量阶梯；
- 元器件匹配、Shortfall 和 Sourcing；
- 制造周期、元器件采购周期和物流；
- 工艺能力、DFM 风险和质量要求；
- 总成本、单位成本、固定费用和税物流口径；
- 工程审核问题和生产文件；
- 下单、支付审批、生产状态和 Shipment。

本 Agent 默认不自动付款、不自动确认不可撤销订单、不自动接受工程修改、不自动确认替代料、不自动承诺客户交期。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–43 的规格和实际代码；
3. docs/pcb-smt-manufacturing-agent-spec.md；
4. 当前 Manufacturing Release Package；
5. 当前 Gerber/Drill/BOM/CPL/Assembly/Stack-up/Impedance；
6. 当前 PCB/PCBA/Stencil/Box Build 询价和订单；
7. 当前 Seeed/NextPCB/PCBWay/JLCPCB Account 和 Partnership；
8. 当前 Provider API、Sandbox、Production、认证和限流；
9. 当前 DFM、Gerber Viewer、BOM/CPL Reconciliation；
10. 当前 Provider Capability 和 Field Mapping；
11. 当前报价 Cost/Lead-time/Validity/Tax/Shipping；
12. 当前 Provider BOM Matching、Private Stock 和 Consignment；
13. 当前 Engineering Question 和 Provider Production File；
14. 当前 PR/PO/Budget/Payment Approval；
15. 当前 Order/Process/Shipment/Receipt；
16. 当前 Vault、Signed URL、File Audit 和 Network Egress；
17. 当前 Retry/Circuit Breaker/Idempotency/Saga/Outbox；
18. 当前 Provider Performance；
19. 脱敏、合成或授权 Fixture。

硬约束：

- Canonical Request 与 Provider Payload 分开；
- Provider Capability 版本化；
- Unknown 不当 Supported；
- Instant Quote 不等于工程审核；
- Quote/Order/Payment/Production 分开；
- Build Time 起点明确；
- Production Time 不等于客户收货时间；
- 文件版本和 Hash 一致；
- BOM/CPL/RefDes/DNP 对账；
- Provider SKU 不替代 MPN；
- Unmatched/Shortfall 不静默忽略；
- Provider Substitute 进入 Agent 33；
- Consigned Part 必须收货确认；
- Provider Working File 与原文件分开；
- 工程参数和 Rotation/Polarity 变化需审批；
- 自动修正仅格式/单位/枚举；
- Raw Payload 永久保存；
- Quote Total 对账；
- Shipping/Tax Included/Excluded/Unknown 明确；
- Decimal/Minor Units；
- Quote Validity；
- 比较 Scope 一致；
- Hard Gate 在 Score 前；
- 不只按最低价推荐；
- History 不足不默认高分；
- 无 API 使用 Assisted Submission；
- 不用未授权 Cookie 或 RPA；
- Credential 使用 Vault Reference；
- Payment Credential 不入日志；
- 下单和支付分别审批、分别幂等；
- 创建订单前重新检查价格和文件 Hash；
- Schema Drift 禁用危险写操作；
- Provider 失败隔离；
- Reorder 比较 Hash 和 Revision；
- Tracking 保存 Raw/Canonical；
- Callback 验签；
- AI 不下单、不付款、不取消、不审批工程变更；
- 不把私有工程文件发送给外部通用模型；
- 不把真实客户和 Provider Credential 放入公开测试；
- 不伪造 API、价格、能力、订单、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不调用真实报价、下单或支付接口：

1. 侦察当前仓库；
2. 检查 Agent 31–43 的真实完成程度和接口；
3. 查找 Release Package 和所有制造文件；
4. 查找 PCB/PCBA/Stencil Request 和历史订单；
5. 查找四家 Provider 的账户、API 权限和环境；
6. 查找 Provider Adapter、HTTP Client、认证和 Secret；
7. 查找 Provider Capability 和 Field Mapping；
8. 查找 Gerber/Drill/Board/Panel 解析；
9. 查找 BOM/CPL/RefDes/DNP 对账；
10. 查找 Stack-up/Impedance/Via/Special Process；
11. 查找 Quote Cost、Lead Time、Validity、Shipping、Tax；
12. 查找 Component Match/Shortfall/Substitute/Consignment；
13. 查找 Comparison/Score/Pareto/History；
14. 查找 Engineering Question/Provider Working Files；
15. 查找 Order Draft/PO/Payment/Cancel/Reorder；
16. 查找 Production Status/Shipment/Receipt；
17. 查找 Idempotency/Saga/Outbox/Retry/Circuit Breaker；
18. 查找 File Security/Vault/Signed URL/Permissions；
19. 统计 Manual Quote、Quote Revision、Schema Drift、Price Change 和 ETA 偏差；
20. 抽样分析合成或脱敏 RFQ；
21. 在 docs/pcb-smt-manufacturing-implementation-plan.md 中生成实施计划；
22. 在 docs/manufacturing-request-domain-model.md 中定义 Domain；
23. 在 docs/file-package-and-preflight.md 中定义文件包和检查；
24. 在 docs/pcb-capability-model.md 中定义 PCB 工艺；
25. 在 docs/pcba-bom-cpl-model.md 中定义 PCBA；
26. 在 docs/provider-adapter-contract.md 中定义 Adapter；
27. 在 docs/provider-capability-registry.md 中定义能力注册表；
28. 在 docs/provider-integration-baseline.md 中定义四家当前模式；
29. 在 docs/quote-normalization.md 中定义报价；
30. 在 docs/lead-time-normalization.md 中定义交期；
31. 在 docs/capability-risk-comparison.md 中定义比较；
32. 在 docs/engineering-review-workflow.md 中定义工程审核；
33. 在 docs/order-payment-saga.md 中定义下单和付款；
34. 在 docs/provider-status-normalization.md 中定义进度；
35. 在 docs/security-and-file-protection.md 中定义安全；
36. 在 docs/manufacturing-rfq-migration-plan.md 中定义旧数据迁移；
37. 在 docs/manufacturing-rfq-benchmark-plan.md 中定义 Benchmark；
38. 给出拟新增、拟修改和拟复用文件；
39. 给出 Phase 1 精确范围；
40. 不修改业务代码；
41. 不创建数据库 Migration；
42. 不安装依赖；
43. 不读取或打印生产 Secret；
44. 不调用真实 Provider API；
45. 运行当前仓库已有 lint、type check、test、build 和 security scan；
46. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–43 输入契约；
- File Package/Preflight；
- PCB/PCBA/Stencil Domain；
- Provider Integration Baseline；
- Capability Registry；
- Adapter Contract；
- Field Mapping；
- Quote Normalization；
- Lead-time；
- Component Matching；
- Capability/DFM Risk；
- Comparison/Pareto；
- Engineering Review；
- Order/Payment/Saga；
- Tracking/Shipment；
- Security；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 132. 后续 Phase 提示词模板

```text
继续实现 PCB/SMT Manufacturing Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–44 规格；
3. 阅读 Manufacturing RFQ Implementation Plan；
4. 阅读 Request、Preflight、Capability、Adapter、Quote、Risk、Engineering、Order、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Canonical/Provider Separation；
- Capability Versioning；
- Raw Payload Preservation；
- File Hash/Revision；
- Quote Total Reconciliation；
- Hard Gate before Score；
- Engineering File Approval；
- Order/Payment Separate；
- Idempotency/Saga；
- Official API or Assisted Submission；
- Evidence/Version/Trace；
- 不公开真实工程文件和 Credential；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Contract Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. provider contract test；
10. idempotency/saga test；
11. security test；
12. performance test；
13. benchmark；
14. 更新文档；
15. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Provider Adapter/Mapping 变化；
- 测试命令和真实结果；
- Preflight Accuracy；
- Quote Reconciliation；
- Capability Gate；
- Order Idempotency；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 133. MVP 演示流程

1. 选择 Agent 43 已批准的 Pilot Release Package；
2. 加载 Gerber、Drill、BOM、CPL 和 Assembly Drawing；
3. 验证所有文件 SHA-256；
4. 检查 BOM 和 CPL Revision；
5. 检查位号和 DNP；
6. 发现一个 CPL Rotation 异常并阻断；
7. 工程师修复后生成新 File Package Revision；
8. 解析 PCB 尺寸、层数、最小孔和特殊工艺；
9. 加载 100、500、1000 三个数量阶梯；
10. 选择 Seattle 为目的地；
11. 加载四家 Provider Capability Profile；
12. PCBWay 使用 Partner API Fixture；
13. JLCPCB 使用 Approved API Sandbox Fixture；
14. Seeed 生成 Assisted Submission Package；
15. NextPCB 生成 Assisted Submission Package；
16. 并行提交可用 API Quote；
17. 人工回填 Seeed/NextPCB 报价；
18. 保存每家 Raw Quote；
19. 标准化 PCB、Stencil、Components、Assembly、Test、Shipping；
20. 检测一家报价未包含 Shipping；
21. 检测一家 Tax/Duty Unknown；
22. 一家不支持要求的 Component Lot Traceability；
23. Hard Gate 淘汰该方案；
24. 一家组件出现 Shortfall；
25. 触发 Agent 33/36 Review；
26. 获得三套有效报价；
27. 生成 Cost/Lead-time/Risk Pareto；
28. Prototype Policy 推荐交期最快方案；
29. Mass-production Policy 推荐质量和风险更优方案；
30. 用户选择其中一个 Pilot Quote；
31. 创建 Order Draft；
32. 重新检查 Quote Validity 和 File Hash；
33. 创建 Provider Order；
34. 重试时不会重复创建；
35. Provider 提出 Panelization 调整；
36. 下载 Provider Working Gerber；
37. 对比 Hash 和参数；
38. 工程师批准；
39. Provider 报价调整；
40. 生成 Quote Revision 2；
41. 重新走预算审批；
42. Payment 由用户显式确认；
43. 订单进入生产；
44. 同步 PCB Fabrication、Assembly、AOI 和 FCT 状态；
45. 订单发货并获取 Tracking；
46. Agent 40更新 ETA；
47. 收货后 Agent 42建立 PO、Lot 和成品追溯；
48. 发布 `manufacturing.order.received`。

---

# 134. 生产上线顺序

第一阶段：

```text
Agent 43 Release Package
File Manifest/Hash
Gerber/BOM/CPL Preflight
Provider Capability Registry
Assisted Submission
Manual Quote Import
Canonical Comparison
人工选定
```

第二阶段：

```text
PCBWay Quote/Tracking API
JLCPCB Quote/Tracking API
Engineering Questions
Provider File Approval
Order Draft/Approval
```

第三阶段：

```text
Provider Order Creation
Payment Gate
Seeed/NextPCB Partner API
Cancel/Reorder
Provider Performance
Advanced DFM
```

上线优先确保：

```text
文件是否是同一个版本
制造商是否真的支持
报价到底包含什么
交期从什么时候开始算
工程修改是否经过批准
订单和支付是否会重复
```

宁可让某家工厂显示“需要人工报价”，也不要为了追求全自动，把网页上几个不断变化的下拉框包装成所谓稳定 API。制造订单一旦重复创建或拿错版本文件生产，省下来的十分钟自动化，很可能换来几周的返工和一箱漂亮的废板。
