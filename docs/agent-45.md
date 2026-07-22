# 来料、生产与测试质量 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：45  
> Agent 名称：Incoming, In-Process & Test Quality Intelligence Agent  
> 中文名称：来料、生产与测试质量 Agent  
> 类型：混合型（确定性规则 + 统计过程控制 + 计算机视觉/异常检测 + 人工审核）  
> 版本：V1.0  
> 标准资料基线日期：2026-07-20  
>
> 定位：统一接入 IQC、SPI、AOI、X-Ray、ICT、FCT、OQC、人工检验、设备测量和供应商质量数据，将检验计划、原始证据、缺陷检测、统计判定、批次隔离、返工复检、NCR、CAPA、8D 和供应商质量闭环关联到 Part、Lot、Date Code、RefDes、工单、工序、设备、成品序列号和客户订单。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - Agent 35：合规、原产地和客户条件
> - Agent 36：实时价格与库存
> - Agent 37：BOM 风险与多源供应
> - Agent 38：MOQ、SPQ 与采购包装优化
> - Agent 39：成本、报价与利润
> - Agent 40：采购计划与缺料协同
> - Agent 41：库存复用与呆滞料
> - Agent 42：物料与批次追溯
> - Agent 43：EBOM、MBOM 与 NPI 转换
> - Agent 44：PCB/SMT 制造询价与下单
> - ezPLM QMS、WMS、MES、ERP、PLM、测试设备、视觉设备和供应商数据
>
> 下游：
> - 来料批次放行、隔离、退货和让步接收建议
> - SPI、AOI、X-Ray、ICT、FCT、OQC 结果
> - 错料、漏件、反向、偏移、立碑、虚焊、桥连、少锡、多锡、开路、短路和测试异常
> - 可疑假料和来源风险调查
> - NCR、MRB、返工、复检、报废和偏差
> - CAPA、8D、供应商纠正措施和验证
> - 质量隔离传播和影响范围
> - Agent 37 供应商质量风险
> - Agent 39 质量成本、返工成本和保修风险
> - Agent 40 工单 Hold、缺料和补料
> - Agent 42 Lot/Serial Genealogy、召回与客户影响
> - Agent 43 工艺、检验计划和测试限值优化
> - Agent 44 PCB/SMT 制造商绩效和异常闭环
>
> 重要边界：
> - 本 Agent 识别、分类、量化和编排质量问题，不自动做最终失效根因结论，不自动释放质量隔离，不自动报废，不自动召回，不自动修改测试限值。
> - 计算机视觉和异常检测输出是 Evidence/Observation，不是不可质疑的质量判决。
> - Critical 缺陷、可疑假料、客户安全问题、测试限值变更和批次放行必须经过授权人员审核。
> - “没有检测到缺陷”不等于产品无缺陷；检验覆盖率、设备能力、抽样方案和模型漏检风险必须显式。
> - 假料识别使用来源、文件、外观、尺寸、材料、X-Ray、XRF、电性和必要时破坏性分析的证据组合，不使用单一图片分类器直接作法律或商业定性。
> - 标准条文、图例和抽样表受版权保护。系统保存标准编号、版本、许可和内部规则映射，不复制未经许可的完整标准表格或图例。

---

# 1. 当前标准基线

## 1.1 电子装联质量

系统应支持版本化标准 Profile，例如：

```text
IPC-A-610
电子组件可接受性

IPC J-STD-001
焊接电子组件的材料、工艺和验收要求
```

截至资料基线日期，IPC 已发布 IPC-A-610J 与 IPC J-STD-001J。系统不得把 `J` 永久硬编码为“最新”，而应通过 Standards Registry 管理版本、生效日期、产品等级、客户附录和许可状态。

## 1.2 来料抽样

支持基于：

```text
ISO 2859-1
AQL indexed lot-by-lot attribute sampling
```

截至资料基线日期，ISO 2859-1:2026 已发布并替代旧版。系统仅实现企业授权的抽样策略、切换规则和可审计计算，不在代码仓库复制受版权保护的完整抽样表。

## 1.3 可疑假料检测

支持风险导向的：

```text
SAE AS6171 family
Suspect/Counterfeit EEE Parts Detection
```

系统以：

```text
suspect
anomalous
nonconforming
verified_against_reference
inconclusive
```

表示技术结果，不擅自作“欺诈”或法律结论。

## 1.4 标准 Profile 原则

每个质量计划保存：

```text
standard
revision
product class
customer addendum
site interpretation
effective date
licensed rule source
```

---

# 2. 建设目标

系统必须能够：

1. 建立统一 Quality Plan；
2. 将 Agent 43 的检验、测试和追溯要求转换为可执行检验计划；
3. 支持 Prototype、EVT、DVT、PVT、Pilot、Mass Production 和 Service；
4. 支持 IPC Class、客户等级、产品安全等级和企业规则；
5. 支持 IQC、IPQC、SPI、AOI、X-Ray、ICT、FCT、Burn-in、Calibration 和 OQC；
6. 支持人工目检、尺寸检验、功能检查和文件审核；
7. 支持按 Part、Lot、Date Code、供应商、PO 和 Receipt 建立 IQC；
8. 支持包装、标签、数量、MPN、Manufacturer、Lot、Date Code 和 COC 检查；
9. 支持尺寸、外观、引脚、共面度、可焊性和材料检查；
10. 支持来源、授权链和可疑假料风险；
11. 支持 X-Ray、XRF、电性能和第三方实验室结果；
12. 支持按 AQL、固定样本、100% 检验和风险抽样；
13. 支持正常、加严、放宽和停止抽样；
14. 支持 SPI 高度、面积、体积、偏移、桥连和少锡风险；
15. 支持 AOI 错料、漏件、多件、偏移、旋转、反向、极性、立碑和焊点异常；
16. 支持 X-Ray BGA/QFN/LGA、隐藏焊点、空洞、桥连、开路、Head-in-Pillow、少锡和孔填充；
17. 支持 ICT 开路、短路、器件值、二极管、晶体管、网络和边界扫描；
18. 支持 FCT 电源、电流、通信、IO、模拟、射频、传感器、显示、音频和系统功能；
19. 支持固件版本、配置、序列号、MAC 和校准检查；
20. 支持 OQC 外观、功能、标签、配件、数量、包装和客户要求；
21. 支持按 RefDes 定位缺陷；
22. 支持按 Pin、Pad、Solder Joint、Net 和 Test Step 定位；
23. 支持将缺陷关联到设备、程序、治具、工位、班次、操作员和环境；
24. 支持缺陷图片、X-Ray、热图、波形、测试日志和测量值；
25. 支持人工标注和复核；
26. 支持模型预测、规则判定和人工结论分开；
27. 支持错误物料和错误位号检测；
28. 支持极性和方向检测；
29. 支持虚焊、少锡、多锡、桥连、锡珠和焊点裂纹；
30. 支持缺件、立碑、侧立、偏移、翘脚、浮高和损伤；
31. 支持测试开路、短路、过流、欠压、通信失败和性能漂移；
32. 支持测试限值、Guard Band 和不确定度；
33. 支持 Golden Unit、Golden Image 和 Reference Lot；
34. 支持设备校准、程序版本和治具版本；
35. 支持测量系统分析和 GR&R 数据；
36. 支持 FPY、RTY、DPU、DPMO、PPM 和 Escape Rate；
37. 支持 X-bar/R、I-MR、p、np、c 和 u 等控制图；
38. 支持 Cp、Cpk、Pp 和 Ppk；
39. 支持趋势、漂移、突变、周期性和批次异常；
40. 支持质量告警和 Andon；
41. 支持自动 Hold 建议；
42. 支持批次隔离影响传播；
43. 支持返工、复检、重测和恢复；
44. 支持 NCR；
45. 支持 MRB；
46. 支持 Use-as-is、Rework、Repair、Return、Scrap 和 Deviation；
47. 支持 CAPA；
48. 支持 8D；
49. 支持 5 Why、Fishbone 和 Root Cause Evidence；
50. 支持原因、措施和效果验证分开；
51. 支持供应商 SCAR；
52. 支持制造商工程问题；
53. 支持 Agent 44 外部制造订单质量反馈；
54. 支持供应商 PPM、Lot Reject Rate、Response Time 和 Repeat Defect；
55. 支持客户投诉、RMA 和现场失效；
56. 支持召回候选范围；
57. 支持质量成本；
58. 支持报废、返工、停线、筛选、重测和保修成本；
59. 支持多租户、客户、工厂、产线和产品隔离；
60. 支持图像和测试数据大规模对象存储；
61. 支持边缘设备离线采集；
62. 支持事件迟到和重复；
63. 支持模型版本和漂移监控；
64. 支持 Shadow Mode；
65. 支持人工反馈回流训练；
66. 支持审核包；
67. 支持客户版质量报告；
68. 支持隐私和脱敏；
69. 支持不可变证据和审计；
70. 支持历史规则重放；
71. 支持 As-of 质量状态；
72. 支持与 Agent 42 双向追溯；
73. 支持与 Agent 43 质量计划闭环；
74. 支持与 Agent 44 制造商绩效闭环；
75. 不因模型 Confidence 高就自动释放；
76. 不因 AOI Pass 就跳过 FCT；
77. 不因 ICT Pass 就证明所有功能正常；
78. 不因一个样品通过就放行整批；
79. 不因来源为授权渠道就跳过所有质量要求；
80. 不把可疑假料和已确认假料混为一谈；
81. 不自动修改标准、AQL 或测试上下限；
82. 不删除原始失败结果；
83. 不把 Retest Pass 覆盖 First Fail；
84. 不将人为维修后通过算作原始一次良率；
85. 不把返工后的良品掩盖在总 Pass Rate 中。

---

# 3. 与 Agent 31–44 的边界

## 3.1 Agent 31/32

提供标准 BOM、Part、MPN、Manufacturer、Package、RefDes 和 Ordering Variant。

Agent 45 不重新做模糊物料解析。

## 3.2 Agent 33

提供已批准替代。

质量结果必须记录：

```text
expected part
actual part
alternative relationship
approval scope
```

## 3.3 Agent 34/35

提供：

```text
PCN
lifecycle
compliance
COO
customer requirements
```

用于检验要求和影响分析。

## 3.4 Agent 36/37

提供采购来源、授权渠道和供应风险。

用于 IQC 和假料风险分层，但不替代物理检验。

## 3.5 Agent 38/39

提供包装、损耗和质量成本。

Agent 45 输出实际损耗、返工和报废成本数据。

## 3.6 Agent 40/41

提供工单、优先级、库存 Lot 和复用计划。

被 Quality Hold 的库存不得进入复用或工单分配。

## 3.7 Agent 42

提供实际：

```text
PO
Receipt
Lot
Date Code
Issue
Work Order
Operation
RefDes
Serial
Shipment
Customer
```

Agent 45 的每个质量结果尽可能绑定这些对象。

## 3.8 Agent 43

提供计划：

```text
Quality Plan
Inspection Point
Acceptance Criteria
Test Program
Limit Set
Fixture
Sampling
Traceability
```

Agent 45执行并反馈实际结果。

## 3.9 Agent 44

提供外部 PCB/SMT 制造商、订单、工程文件、生产状态和 Shipment。

Agent 45将制造缺陷和供应商绩效回写 Agent 44。

---

# 4. 核心原则

## 4.1 计划、观察、判定和处置分开

```text
Quality Requirement
→ Inspection Observation
→ Rule/Model Evaluation
→ Authorized Disposition
```

## 4.2 原始数据不可变

保存：

```text
original image
raw measurement
raw test log
device metadata
timestamp
hash
```

## 4.3 模型预测不是最终结论

```text
model_prediction
rule_evaluation
human_review
final_disposition
```

分别保存。

## 4.4 First Pass 和 Retest 分开

```text
first_test_result
retest_result
after_rework_result
```

FPY 只使用首次结果。

## 4.5 漏检和误报都要监控

视觉模型不能只展示 Accuracy，需要：

```text
per-defect precision
recall
false escape
false call
confidence calibration
```

## 4.6 检验覆盖率必须显式

```text
inspected features
uninspected features
blind areas
sampling fraction
test coverage
```

## 4.7 缺陷定位到物料谱系

优先定位：

```text
Lot
RefDes
Pin/Pad
Operation
Equipment
Serial
```

## 4.8 Critical 缺陷使用 Hard Gate

安全、反向、短路、错料、可疑假料和关键功能失败不能被总分平均掉。

## 4.9 测试程序和限值版本化

```text
test program
limit set
fixture
equipment
firmware
calibration
```

## 4.10 抽样方案版本化

AQL、Inspection Level、Sampling Mode、Switching Rule 和 Lot Definition 必须保存。

## 4.11 标准和客户规则分开

```text
industry standard
customer addendum
enterprise rule
temporary deviation
```

## 4.12 假料是风险调查，不是图片分类

证据链：

```text
pedigree
documentation
label/marking
package/dimensions
X-ray/XRF
electrical
destructive analysis if approved
```

## 4.13 SPC 不自动证明根因

控制图异常是 Signal，根因需要调查和证据。

## 4.14 质量放行必须有权限

模型或设备只能建议：

```text
pass_candidate
hold_candidate
review_required
```

## 4.15 AI 失败时系统仍可运行

规则、设备判定、人工检验和质量工作流不依赖大模型。

---

# 5. 质量对象

```text
Quality Plan
Inspection Plan
Inspection Characteristic
Sampling Plan
Inspection Lot
Inspection Unit
Inspection Event
Measurement
Image/Signal Evidence
Defect Observation
Model Prediction
Rule Evaluation
Review
Disposition
NCR
MRB
Rework
Retest
CAPA
8D
Supplier Corrective Action
Quality Alert
SPC Series
Control Limit
Capability Study
Model Registry
Dataset Version
```

---

# 6. Quality Plan

绑定：

```text
product
product revision
MBOM revision
routing revision
site
line
stage
customer
standard profile
effectivity
```

---

# 7. Inspection Plan

```json
{
  "inspection_plan_id": "uuid",
  "inspection_type": "AOI",
  "operation_id": "smt-top-aoi",
  "product_id": "uuid",
  "revision": "AOI-7",
  "sampling_mode": "100_percent",
  "criteria_profile_id": "uuid",
  "program_version": "program-12",
  "status": "released"
}
```

---

# 8. Inspection Characteristic

示例：

```text
component_present
correct_part
orientation
polarity
x/y_offset
rotation
solder_height
solder_area
solder_volume
void_ratio
pin_open
bridge
resistance
voltage
current
frequency
communication
label
package
```

---

# 9. 质量阶段

```text
IQC
IPQC
SPI
AOI
X_RAY
ICT
FCT
BURN_IN
CALIBRATION
OQC
CUSTOMER_RETURN
```

---

# 10. 检验单位

```text
part
piece
lot
reel
tray
panel
board
refdes
solder_joint
net
test_step
serial_number
carton
shipment
```

---

# 11. 标准检验事件

```json
{
  "inspection_event_id": "uuid",
  "inspection_type": "AOI",
  "occurred_at": "2026-07-20T10:00:00Z",

  "context": {
    "site_id": "uuid",
    "line_id": "uuid",
    "equipment_id": "uuid",
    "program_version": "AOI-P12",
    "work_order_id": "uuid",
    "production_lot_id": "uuid",
    "serial_number": "SN001"
  },

  "observations": [],
  "raw_evidence_ids": [],
  "status": "completed"
}
```

---

# 12. IQC 范围

```text
purchase source
PO and receipt
supplier and manufacturer
MPN
quantity
packaging
label
manufacturer lot
supplier lot
date code
COC/COA
COO/compliance
appearance
dimensions
pin condition
moisture packaging
electrical sample
counterfeit-risk tests
```

---

# 13. IQC 风险分层

维度：

```text
authorized pedigree
supplier history
part criticality
market shortage
price anomaly
lifecycle/EOL
visual anomaly
document anomaly
customer requirement
application class
```

输出：

```text
low
medium
high
critical
unknown
```

风险决定检验深度，不直接决定合格。

---

# 14. IQC Lot Definition

Lot 必须明确：

```text
supplier
manufacturer
MPN
manufacturer lot
date code
receipt
packaging condition
```

不得把不同 Date Code 或 Manufacturer Lot 任意合并抽样。

---

# 15. 抽样模式

```text
100_percent
fixed_sample
AQL_single
AQL_double
AQL_multiple
sequential
skip_lot
risk_adaptive
customer_defined
```

---

# 16. AQL 参数

```text
lot size
inspection level
AQL
normal/tightened/reduced
sample size code
accept number
reject number
standard revision
policy source
```

禁止在开源仓库复制未获许可的完整标准表。

---

# 17. IQC 文件检查

```text
PO
Packing List
COC
COA
Manufacturer Label
Authorized Channel Evidence
MSDS/SDS if applicable
Compliance Declaration
Test Report
```

文档缺失和物理不合格分开。

---

# 18. 可疑假料状态

```text
no_anomaly_detected
suspect
high_risk_suspect
inconclusive
verified_against_reference
nonconforming
confirmed_by_authorized_lab
```

不使用单一 `counterfeit=true/false`。

---

# 19. 假料证据维度

```text
chain_of_custody
supplier authorization
price anomaly
label typography
date-code consistency
marking permanence
package dimensions
lead finish
surface resurfacing
X-ray die/wirebond
XRF material
electrical signature
decapsulation
manufacturer verification
```

---

# 20. 外观与 Marking

识别：

```text
logo
font
character spacing
laser/ink consistency
top mark
bottom mark
date code
country code
pin-1 mark
surface texture
blacktop/resurfacing signs
```

OCR 结果保留图像坐标和置信度。

---

# 21. 尺寸和外形

```text
package length/width/height
lead pitch
lead width
coplanarity
mold cavity
ejector marks
pin geometry
```

与厂家资料和 Golden Sample 对比。

---

# 22. X-Ray/XRF

X-Ray：

```text
die size/location
wire-bond count
lead frame
internal structure
void/damage
```

XRF：

```text
elemental composition
lead finish
material anomaly
```

这些证据需由适用标准、实验室能力和授权流程管理。

---

# 23. 电性能和破坏性分析

```text
curve trace
leakage
functional signature
parametric test
burn-in
decapsulation
die marking
```

破坏性分析必须明确样本数量、授权和处置。

---

# 24. SPI

测量：

```text
paste height
area
volume
x/y offset
shape
bridge
insufficient
excess
smear
missing deposit
```

---

# 25. SPI 判定

按：

```text
pad
aperture
component class
paste type
stencil revision
board side
process window
```

避免全板统一阈值。

---

# 26. SPI 与印刷参数

关联：

```text
printer
stencil
squeegee
pressure
speed
separation
paste lot
paste age
temperature
humidity
cleaning cycle
```

---

# 27. AOI

识别：

```text
missing
wrong component
extra component
offset
rotation
polarity
tombstone
billboard
lifted lead
damaged component
solder bridge
insufficient solder
excess solder
solder ball
contamination
silkscreen/label issue
```

---

# 28. 错料识别

证据组合：

```text
expected part/refdes
feeder scan
reel label
OCR marking
package/shape
color and geometry
electrical test
```

图像看起来相似的阻容不能仅凭外观确定精确料号。

---

# 29. 方向和极性

来源：

```text
Agent 43 placement/polarity
CAD pin-1
package mark
AOI image
X-ray optional
```

支持：

```text
IC pin-1
diode cathode
electrolytic polarity
LED polarity
connector orientation
crystal orientation if applicable
```

---

# 30. AOI Golden Image

Golden Image 必须绑定：

```text
product revision
MBOM revision
placement revision
line
camera
lighting
program
```

不能跨版本随意复用。

---

# 31. X-Ray 装联缺陷

```text
BGA open
bridge
head_in_pillow
void
missing ball
ball size anomaly
QFN thermal-pad void
LGA wetting anomaly
THT barrel fill
hidden solder joint
internal damage
```

---

# 32. Void 判定

保存：

```text
void area ratio
largest void
distribution
location
joint type
criteria profile
```

不以单一全局百分比适用于所有器件和产品。

---

# 33. ICT

测试：

```text
open
short
resistance
capacitance
inductance
diode
transistor
network
power rail
boundary scan
programming verification
```

---

# 34. ICT 覆盖

保存：

```text
nets covered
components covered
test points
guarded measurements
untestable items
coverage reason
```

---

# 35. FCT

支持：

```text
power-up
current profile
rail voltage
clock
communication
GPIO
ADC/DAC
sensor
RF
audio
display
motor
storage
network
thermal
system scenario
```

---

# 36. 测试 Step

```json
{
  "step_code": "POWER_3V3",
  "method": "measure_voltage",
  "lower_limit": "3.20",
  "upper_limit": "3.40",
  "unit": "V",
  "guard_band": "0.02",
  "criticality": "critical"
}
```

---

# 37. Limit Set

必须绑定：

```text
product
revision
stage
site
fixture
equipment
firmware
environment
effective date
approval
```

---

# 38. Guard Band

用于考虑：

```text
measurement uncertainty
equipment drift
environment
fixture loss
customer margin
```

Guard Band 策略版本化，不能随意放宽。

---

# 39. Calibration

测试设备和治具保存：

```text
calibration status
due date
reference standard
uncertainty
maintenance
self-test
golden unit verification
```

过期设备结果进入 Hold 或 Review。

---

# 40. Golden Unit

保存：

```text
golden unit serial
product revision
known-good evidence
validity
calibration relation
usage count
storage
last verification
```

---

# 41. OQC

检查：

```text
appearance
function
serial
label
firmware
accessories
quantity
packaging
carton
customer mark
shipping documents
```

---

# 42. 缺陷分类

一级：

```text
material
placement
solder
mechanical
electrical
firmware
test
label
packaging
documentation
process
traceability
counterfeit_suspect
```

---

# 43. 缺陷代码

示例：

```text
WRONG_PART
MISSING_PART
EXTRA_PART
REVERSED
POLARITY_ERROR
OFFSET
ROTATION
TOMBSTONE
LIFTED_LEAD
OPEN
SHORT
BRIDGE
INSUFFICIENT_SOLDER
EXCESS_SOLDER
VOID
HEAD_IN_PILLOW
SOLDER_BALL
DAMAGE
CONTAMINATION
TEST_LIMIT_FAIL
COMMUNICATION_FAIL
OVER_CURRENT
UNDER_VOLTAGE
FIRMWARE_MISMATCH
LABEL_MISMATCH
PACKAGING_MISSING
SUSPECT_MARKING
SUSPECT_INTERNAL_STRUCTURE
```

---

# 44. 缺陷严重度

```text
critical
major
minor
cosmetic
informational
unknown
```

严重度由标准、客户、产品类别和使用场景决定。

---

# 45. Observation

```json
{
  "observation_id": "uuid",
  "inspection_event_id": "uuid",
  "target": {
    "serial_id": "uuid",
    "refdes": "U1",
    "pin_or_pad": "12"
  },
  "characteristic": "polarity",
  "measured_value": "reversed",
  "evidence_ids": ["uuid"],
  "source": "AOI",
  "status": "observed"
}
```

---

# 46. Model Prediction

```json
{
  "prediction_id": "uuid",
  "observation_id": "uuid",
  "model_id": "aoi-defect-detector",
  "model_version": "3.2.1",
  "predicted_class": "solder_bridge",
  "confidence": 0.93,
  "bounding_box": [0.1, 0.2, 0.3, 0.4],
  "status": "review_required"
}
```

---

# 47. Rule Evaluation

```text
rule id
rule version
input
threshold
result
reason
standard/customer source
```

---

# 48. 最终判定

```text
pass
fail
conditional_pass
hold
review_required
not_tested
invalid_result
```

只有授权角色可完成 Lot/Order Release。

---

# 49. Retest 和 Rework

链路：

```text
First Fail
→ Diagnosis
→ Rework/Repair
→ Retest
→ Final Disposition
```

首次失败永久保留。

---

# 50. False Call 和 False Escape

```text
false_call
设备/模型报缺陷，人工确认良品

false_escape
设备/模型判定良品，后续发现缺陷
```

用于设备和模型改进。

---

# 51. Inspection Coverage

```text
features planned
features inspected
features valid
features invalid
blind areas
sampled quantity
total quantity
```

---

# 52. Quality Hold

Scope：

```text
inventory lot
receipt lot
work order
operation
WIP lot
finished lot
serial range
shipment
customer
```

Agent 45生成 Hold 建议或授权 Hold 动作。

---

# 53. NCR

包含：

```text
nonconformance
affected scope
evidence
containment
disposition
owner
due date
approval
```

---

# 54. MRB

决策：

```text
use_as_is
rework
repair
return_to_supplier
scrap
sort_and_screen
deviation
```

每种决策有权限、数量和 Effectivity。

---

# 55. CAPA

```text
problem
containment
root cause
corrective action
preventive action
verification
effectiveness
closure
```

---

# 56. 8D

```text
D1 team
D2 problem
D3 containment
D4 root cause
D5 corrective action
D6 validation
D7 prevention
D8 closure
```

生成结构化任务，不把文字报告当作完成证据。

---

# 57. Root Cause

允许方法：

```text
5 Why
Fishbone
Fault Tree
DOE
process correlation
failure analysis
```

模型可推荐候选，不自动认定根因。

---

# 58. Supplier SCAR

绑定：

```text
supplier
part
lot
PO
defect
containment
response deadline
8D
verification
repeat issue
```

---

# 59. Quality Alert

触发：

```text
critical defect
lot reject
SPC out of control
repeat defect
counterfeit suspect
test escape
customer complaint
```

---

# 60. SPC 数据

```text
measurement
timestamp
part/refdes
machine
line
lot
shift
program
environment
```

---

# 61. Control Chart

支持：

```text
Xbar-R
Xbar-S
I-MR
p
np
c
u
```

控制限来源和计算窗口版本化。

---

# 62. SPC 信号

```text
point beyond limit
run on one side
trend
cycle
sudden shift
increased variation
```

信号规则配置化。

---

# 63. Process Capability

```text
Cp
Cpk
Pp
Ppk
```

只有在分布、稳定性和数据条件满足时输出；否则标记：

```text
not_valid_for_capability
```

---

# 64. Yield 指标

```text
FPY
RTY
Final Yield
DPU
DPMO
PPM
Scrap Rate
Rework Rate
Retest Rate
Escape Rate
```

定义和分母必须版本化。

---

# 65. 质量成本

```text
inspection
screening
retest
rework
scrap
line stop
sort
return
freight
warranty
customer compensation
recall
```

---

# 66. 供应商质量

```text
incoming PPM
lot reject rate
SCAR response
repeat defects
containment time
8D quality
recovery cost
```

---

# 67. 标准质量请求

```json
{
  "quality_job_id": "uuid",
  "inspection_plan_id": "uuid",
  "scope": {
    "receipt_lot_id": "uuid",
    "work_order_id": null,
    "production_lot_id": null
  },
  "standards_profile_id": "uuid",
  "sampling_plan_id": "uuid",
  "status": "ready"
}
```

---

# 68. 标准质量结果

```json
{
  "quality_job_id": "uuid",
  "status": "review_required",
  "summary": {
    "inspected": 125,
    "passed_first": 119,
    "failed_first": 6,
    "reworked": 4,
    "scrapped": 1,
    "open_review": 1
  },
  "defect_summary": {},
  "quality_hold_id": "uuid",
  "result_uri": "s3://..."
}
```

---

# 69. 状态机

```text
RECEIVED
→ LOADING_PLAN
→ RESOLVING_SCOPE
→ VALIDATING_EQUIPMENT_AND_PROGRAM
→ INGESTING_RAW_DATA
→ NORMALIZING_MEASUREMENTS
→ RUNNING_RULES
→ RUNNING_MODEL_INFERENCE
→ FUSING_EVIDENCE
→ GENERATING_OBSERVATIONS
→ HUMAN_REVIEW_IF_REQUIRED
→ DETERMINING_LOT_UNIT_STATUS
→ CALCULATING_YIELD_AND_SPC
→ GENERATING_HOLD_NCR_ACTIONS
→ STORING_RESULTS
→ COMPLETED_OR_REVIEW_REQUIRED
```

分支：

```text
COMPLETED
COMPLETED_WITH_DEFECTS
REVIEW_REQUIRED
HOLD_REQUIRED
PLAN_MISSING
EQUIPMENT_CALIBRATION_EXPIRED
PROGRAM_VERSION_MISMATCH
RAW_DATA_INVALID
MODEL_UNAVAILABLE
MODEL_LOW_CONFIDENCE
TRACEABILITY_INCOMPLETE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 70. 错误码

```text
QUALITY_PLAN_NOT_FOUND
QUALITY_PLAN_NOT_RELEASED
INSPECTION_PLAN_NOT_FOUND
STANDARD_PROFILE_MISSING
SAMPLING_PLAN_INVALID
LOT_DEFINITION_INVALID
TRACE_SCOPE_NOT_FOUND
PART_IDENTITY_UNRESOLVED
EQUIPMENT_NOT_FOUND
EQUIPMENT_CALIBRATION_EXPIRED
FIXTURE_REVISION_MISMATCH
PROGRAM_VERSION_MISMATCH
LIMIT_SET_MISSING
LIMIT_SET_NOT_APPROVED
RAW_IMAGE_MISSING
RAW_TEST_LOG_MISSING
IMAGE_FORMAT_INVALID
MEASUREMENT_UNIT_UNKNOWN
MEASUREMENT_OUT_OF_RANGE
MODEL_NOT_FOUND
MODEL_VERSION_NOT_APPROVED
MODEL_INFERENCE_FAILED
MODEL_LOW_CONFIDENCE
RULE_BUNDLE_MISSING
RULE_EVALUATION_FAILED
DEFECT_TAXONOMY_MISSING
COUNTERFEIT_EVIDENCE_INSUFFICIENT
QUANTITY_RECONCILIATION_FAILED
RETEST_LINK_MISSING
HOLD_SCOPE_INVALID
NCR_APPROVAL_REQUIRED
DISPOSITION_APPROVAL_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR


---

# 71. 数据库设计

## 71.1 `quality_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
product_id UUID NULL
product_revision VARCHAR NULL
mbom_revision_id UUID NULL
routing_revision_id UUID NULL
site_id UUID NULL
line_family_id UUID NULL
npi_stage VARCHAR NOT NULL
customer_id UUID NULL
plan_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
standards_profile_id UUID NOT NULL
effectivity JSONB NOT NULL
status VARCHAR NOT NULL
content_hash CHAR(64) NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, plan_number, revision)
```

## 71.2 `inspection_plans`

```text
id UUID PK
quality_plan_id UUID NOT NULL
inspection_type VARCHAR NOT NULL
operation_id UUID NULL
plan_number VARCHAR NOT NULL
revision VARCHAR NOT NULL
sampling_plan_id UUID NULL
criteria_profile_id UUID NOT NULL
equipment_class_id UUID NULL
program_version_requirement VARCHAR NULL
fixture_revision_requirement VARCHAR NULL
traceability_level VARCHAR NOT NULL
inspection_scope JSONB NOT NULL
status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(quality_plan_id, plan_number, revision)
```

## 71.3 `inspection_characteristics`

```text
id UUID PK
inspection_plan_id UUID NOT NULL
characteristic_code VARCHAR NOT NULL
target_type VARCHAR NOT NULL
target_selector JSONB NOT NULL
measurement_type VARCHAR NOT NULL
unit VARCHAR NULL
nominal_value NUMERIC NULL
lower_limit NUMERIC NULL
upper_limit NUMERIC NULL
guard_band_lower NUMERIC NULL
guard_band_upper NUMERIC NULL
severity_on_fail VARCHAR NOT NULL
rule_id VARCHAR NULL
model_required BOOLEAN NOT NULL
human_review_required BOOLEAN NOT NULL
sequence_number INT NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(inspection_plan_id, characteristic_code, sequence_number)
```

## 71.4 `standards_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
version VARCHAR NOT NULL
product_class VARCHAR NULL
customer_id UUID NULL
site_id UUID NULL
standard_references JSONB NOT NULL
licensed_rule_bundle_uri TEXT NULL
rule_bundle_hash CHAR(64) NULL
effective_from TIMESTAMPTZ NOT NULL
effective_to TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, version)
```

## 71.5 `sampling_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
plan_name VARCHAR NOT NULL
version VARCHAR NOT NULL
sampling_mode VARCHAR NOT NULL
standard_reference JSONB NULL
inspection_level VARCHAR NULL
aql_value NUMERIC NULL
switching_rule_profile JSONB NULL
fixed_sample_size INT NULL
risk_policy JSONB NULL
lot_definition_rule JSONB NOT NULL
acceptance_rule JSONB NOT NULL
licensed_table_reference VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, plan_name, version)
```

## 71.6 `inspection_lots`

```text
id UUID PK
tenant_id UUID NOT NULL
inspection_plan_id UUID NOT NULL
inspection_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
part_id UUID NULL
receipt_lot_id UUID NULL
inventory_lot_id UUID NULL
production_lot_id UUID NULL
work_order_id UUID NULL
shipment_id UUID NULL
supplier_id UUID NULL
manufacturer_lot VARCHAR NULL
date_code VARCHAR NULL
lot_size NUMERIC NOT NULL
unit VARCHAR NOT NULL
sample_size NUMERIC NULL
sampling_mode VARCHAR NOT NULL
risk_level VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 71.7 `inspection_units`

```text
id UUID PK
inspection_lot_id UUID NOT NULL
unit_type VARCHAR NOT NULL
entity_id UUID NULL
serial_number VARCHAR NULL
refdes VARCHAR NULL
pin_or_pad VARCHAR NULL
sequence_number BIGINT NOT NULL
selected_for_sample BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(inspection_lot_id, sequence_number)
```

## 71.8 `inspection_events`

```text
id UUID PK
tenant_id UUID NOT NULL
inspection_lot_id UUID NOT NULL
inspection_unit_id UUID NULL
inspection_type VARCHAR NOT NULL
occurred_at TIMESTAMPTZ NOT NULL
recorded_at TIMESTAMPTZ NOT NULL
site_id UUID NULL
line_id UUID NULL
station_id UUID NULL
equipment_id UUID NULL
fixture_id UUID NULL
program_version VARCHAR NULL
limit_set_version VARCHAR NULL
operator_id UUID NULL
source_system VARCHAR NOT NULL
source_transaction_id VARCHAR NOT NULL
event_status VARCHAR NOT NULL
raw_payload_uri TEXT NULL
raw_payload_hash CHAR(64) NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, source_system, source_transaction_id, inspection_type)
```

## 71.9 `quality_measurements`

```text
id UUID PK
inspection_event_id UUID NOT NULL
inspection_characteristic_id UUID NULL
target_type VARCHAR NOT NULL
target_identifier JSONB NOT NULL
measurement_code VARCHAR NOT NULL
numeric_value NUMERIC NULL
text_value TEXT NULL
boolean_value BOOLEAN NULL
unit VARCHAR NULL
lower_limit NUMERIC NULL
upper_limit NUMERIC NULL
guard_band_result VARCHAR NULL
measurement_uncertainty NUMERIC NULL
measurement_method VARCHAR NOT NULL
validity_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.10 `quality_evidence`

```text
id UUID PK
tenant_id UUID NOT NULL
evidence_type VARCHAR NOT NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
mime_type VARCHAR NULL
size_bytes BIGINT NOT NULL
captured_at TIMESTAMPTZ NULL
equipment_id UUID NULL
operator_id UUID NULL
source_system VARCHAR NOT NULL
confidentiality_level VARCHAR NOT NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 71.11 `inspection_event_evidence_links`

```text
id UUID PK
inspection_event_id UUID NOT NULL
evidence_id UUID NOT NULL
relationship VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(inspection_event_id, evidence_id, relationship)
```

## 71.12 `defect_observations`

```text
id UUID PK
inspection_event_id UUID NOT NULL
inspection_unit_id UUID NULL
defect_code VARCHAR NOT NULL
defect_category VARCHAR NOT NULL
severity VARCHAR NOT NULL
target_type VARCHAR NOT NULL
target_identifier JSONB NOT NULL
refdes VARCHAR NULL
pin_or_pad VARCHAR NULL
bounding_geometry JSONB NULL
measured_values JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NULL
observation_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NULL
created_at TIMESTAMPTZ
```

## 71.13 `quality_rule_evaluations`

```text
id UUID PK
inspection_event_id UUID NOT NULL
defect_observation_id UUID NULL
rule_id VARCHAR NOT NULL
rule_version VARCHAR NOT NULL
input_snapshot JSONB NOT NULL
threshold_snapshot JSONB NOT NULL
evaluation_result VARCHAR NOT NULL
reason_codes JSONB NOT NULL
standard_source JSONB NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 71.14 `quality_model_registry`

```text
id UUID PK
tenant_id UUID NULL
model_name VARCHAR NOT NULL
model_version VARCHAR NOT NULL
model_type VARCHAR NOT NULL
inspection_types JSONB NOT NULL
defect_classes JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
framework VARCHAR NOT NULL
input_schema_version VARCHAR NOT NULL
output_schema_version VARCHAR NOT NULL
training_dataset_version_id UUID NULL
validation_report_uri TEXT NOT NULL
approval_status VARCHAR NOT NULL
approved_scope JSONB NOT NULL
shadow_mode BOOLEAN NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(model_name, model_version)
```

## 71.15 `quality_model_predictions`

```text
id UUID PK
inspection_event_id UUID NOT NULL
inspection_unit_id UUID NULL
model_registry_id UUID NOT NULL
prediction_type VARCHAR NOT NULL
predicted_class VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
bounding_geometry JSONB NULL
segmentation_uri TEXT NULL
feature_vector_uri TEXT NULL
inference_latency_ms INT NULL
prediction_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.16 `quality_model_reviews`

```text
id UUID PK
model_prediction_id UUID NOT NULL
reviewer_id UUID NOT NULL
review_result VARCHAR NOT NULL
corrected_class VARCHAR NULL
corrected_geometry JSONB NULL
reason_code VARCHAR NOT NULL
review_note TEXT NULL
created_at TIMESTAMPTZ
```

## 71.17 `quality_dataset_versions`

```text
id UUID PK
tenant_id UUID NULL
dataset_name VARCHAR NOT NULL
version VARCHAR NOT NULL
inspection_type VARCHAR NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
label_schema_version VARCHAR NOT NULL
sample_count BIGINT NOT NULL
class_distribution JSONB NOT NULL
site_distribution JSONB NOT NULL
device_distribution JSONB NOT NULL
license_and_consent JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(dataset_name, version)
```

## 71.18 `quality_decisions`

```text
id UUID PK
inspection_lot_id UUID NOT NULL
inspection_unit_id UUID NULL
decision_scope VARCHAR NOT NULL
decision_result VARCHAR NOT NULL
decision_source VARCHAR NOT NULL
rule_summary JSONB NOT NULL
model_summary JSONB NOT NULL
human_review_summary JSONB NOT NULL
authorized_by UUID NULL
authorized_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.19 `quality_holds`

```text
id UUID PK
tenant_id UUID NOT NULL
hold_number VARCHAR NOT NULL
hold_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_ids JSONB NOT NULL
reason_codes JSONB NOT NULL
source_inspection_lot_id UUID NULL
source_ncr_id UUID NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
authorized_by UUID NULL
created_at TIMESTAMPTZ
released_by UUID NULL
released_at TIMESTAMPTZ NULL
release_evidence_ids JSONB NOT NULL
UNIQUE(tenant_id, hold_number)
```

## 71.20 `nonconformance_reports`

```text
id UUID PK
tenant_id UUID NOT NULL
ncr_number VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NOT NULL
defect_summary JSONB NOT NULL
affected_scope JSONB NOT NULL
quantity_nonconforming NUMERIC NOT NULL
containment_action JSONB NOT NULL
severity VARCHAR NOT NULL
owner_role VARCHAR NOT NULL
assigned_to UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, ncr_number)
```

## 71.21 `mrb_decisions`

```text
id UUID PK
ncr_id UUID NOT NULL
decision_version INT NOT NULL
disposition VARCHAR NOT NULL
quantity NUMERIC NOT NULL
effectivity JSONB NOT NULL
conditions JSONB NOT NULL
risk_assessment JSONB NOT NULL
financial_impact JSONB NULL
requested_by UUID NOT NULL
approved_by JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(ncr_id, decision_version)
```

## 71.22 `rework_orders`

```text
id UUID PK
tenant_id UUID NOT NULL
rework_number VARCHAR NOT NULL
ncr_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_ids JSONB NOT NULL
rework_instruction_revision_id UUID NOT NULL
planned_quantity NUMERIC NOT NULL
actual_quantity NUMERIC NULL
scrap_quantity NUMERIC NULL
retest_plan_id UUID NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, rework_number)
```

## 71.23 `retest_links`

```text
id UUID PK
original_inspection_event_id UUID NOT NULL
rework_order_id UUID NULL
retest_inspection_event_id UUID NOT NULL
attempt_number INT NOT NULL
result VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(original_inspection_event_id, attempt_number)
```

## 71.24 `capa_records`

```text
id UUID PK
tenant_id UUID NOT NULL
capa_number VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference_ids JSONB NOT NULL
problem_statement TEXT NOT NULL
containment JSONB NOT NULL
root_cause_status VARCHAR NOT NULL
root_cause_evidence_ids JSONB NOT NULL
corrective_actions JSONB NOT NULL
preventive_actions JSONB NOT NULL
effectiveness_plan JSONB NOT NULL
owner_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, capa_number)
```

## 71.25 `eight_d_reports`

```text
id UUID PK
tenant_id UUID NOT NULL
report_number VARCHAR NOT NULL
supplier_id UUID NULL
customer_id UUID NULL
source_ncr_ids JSONB NOT NULL
d1_team JSONB NOT NULL
d2_problem JSONB NOT NULL
d3_containment JSONB NOT NULL
d4_root_cause JSONB NOT NULL
d5_actions JSONB NOT NULL
d6_validation JSONB NOT NULL
d7_prevention JSONB NOT NULL
d8_closure JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, report_number)
```

## 71.26 `supplier_quality_actions`

```text
id UUID PK
tenant_id UUID NOT NULL
supplier_id UUID NOT NULL
scar_number VARCHAR NOT NULL
part_ids JSONB NOT NULL
affected_lot_ids JSONB NOT NULL
source_ncr_ids JSONB NOT NULL
response_due_at TIMESTAMPTZ NOT NULL
containment_due_at TIMESTAMPTZ NULL
eight_d_report_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
UNIQUE(tenant_id, scar_number)
```

## 71.27 `spc_series`

```text
id UUID PK
tenant_id UUID NOT NULL
series_name VARCHAR NOT NULL
characteristic_code VARCHAR NOT NULL
scope JSONB NOT NULL
chart_type VARCHAR NOT NULL
sampling_interval JSONB NOT NULL
calculation_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.28 `spc_points`

```text
id UUID PK
spc_series_id UUID NOT NULL
inspection_event_id UUID NULL
measured_at TIMESTAMPTZ NOT NULL
sample_id VARCHAR NULL
sample_size INT NULL
value NUMERIC NULL
subgroup_values JSONB NULL
defect_count INT NULL
unit_count INT NULL
context JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 71.29 `spc_control_limits`

```text
id UUID PK
spc_series_id UUID NOT NULL
limit_version INT NOT NULL
calculation_window JSONB NOT NULL
center_line NUMERIC NULL
ucl NUMERIC NULL
lcl NUMERIC NULL
sigma_estimate NUMERIC NULL
calculated_at TIMESTAMPTZ NOT NULL
approved_by UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(spc_series_id, limit_version)
```

## 71.30 `spc_signals`

```text
id UUID PK
spc_series_id UUID NOT NULL
spc_point_id UUID NOT NULL
signal_type VARCHAR NOT NULL
rule_id VARCHAR NOT NULL
rule_version VARCHAR NOT NULL
severity VARCHAR NOT NULL
signal_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 71.31 `process_capability_studies`

```text
id UUID PK
tenant_id UUID NOT NULL
characteristic_code VARCHAR NOT NULL
scope JSONB NOT NULL
period_start TIMESTAMPTZ NOT NULL
period_end TIMESTAMPTZ NOT NULL
sample_count INT NOT NULL
distribution_assessment JSONB NOT NULL
stability_status VARCHAR NOT NULL
cp NUMERIC NULL
cpk NUMERIC NULL
pp NUMERIC NULL
ppk NUMERIC NULL
validity_status VARCHAR NOT NULL
calculation_policy_version VARCHAR NOT NULL
result_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 71.32 `quality_metric_snapshots`

```text
id UUID PK
tenant_id UUID NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
period_start TIMESTAMPTZ NOT NULL
period_end TIMESTAMPTZ NOT NULL
fpy NUMERIC NULL
rty NUMERIC NULL
final_yield NUMERIC NULL
dpu NUMERIC NULL
dpmo NUMERIC NULL
ppm NUMERIC NULL
scrap_rate NUMERIC NULL
rework_rate NUMERIC NULL
retest_rate NUMERIC NULL
escape_rate NUMERIC NULL
metric_definition_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.33 `quality_cost_records`

```text
id UUID PK
tenant_id UUID NOT NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NOT NULL
cost_category VARCHAR NOT NULL
amount NUMERIC NOT NULL
currency CHAR(3) NOT NULL
quantity_basis NUMERIC NULL
cost_date DATE NOT NULL
estimate_status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 71.34 `quality_alerts`

```text
id UUID PK
tenant_id UUID NOT NULL
alert_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
scope JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference_id UUID NOT NULL
message TEXT NOT NULL
recommended_actions JSONB NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
acknowledged_at TIMESTAMPTZ NULL
closed_at TIMESTAMPTZ NULL
```

## 71.35 `quality_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
inspection_plan_id UUID NOT NULL
scope JSONB NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
policy_versions JSONB NOT NULL
model_versions JSONB NOT NULL
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

---

# 72. 对象存储

```text
derived/quality/
  {tenant_id}/
    incoming/
      {inspection_lot_id}/
        documents/
        package-images/
        marking-images/
        dimensional/
        xray/
        xrf/
        electrical/
        counterfeit-risk/
        report/
    production/
      {work_order_id}/{inspection_event_id}/
        spi/
          raw/
          height-map/
          segmentation/
          measurements/
        aoi/
          raw/
          crops/
          annotations/
          predictions/
          reviews/
        xray/
          raw/
          processed/
          void-analysis/
        ict/
          raw-log/
          normalized/
        fct/
          raw-log/
          waveforms/
          normalized/
        oqc/
          images/
          checklist/
    models/
      {model_name}/{model_version}/
        artifact/
        validation/
        model-card/
        drift/
    quality-jobs/
      {quality_job_id}/
        input/
        observations/
        rules/
        predictions/
        reviews/
        decisions/
        trace/
        reports/
    ncr/
      {ncr_id}/
    capa/
      {capa_id}/
    audit/
      {audit_package_id}/
```

---

# 73. 数据接入 Adapter

```text
IQC manual/mobile
SPI equipment
AOI equipment
X-Ray equipment
ICT tester
FCT tester
Burn-in system
Calibration station
OQC mobile
MES
QMS
WMS
ERP
Supplier Portal
Third-party laboratory
```

每个 Adapter 必须定义：

```text
source schema
source version
program version
timestamp semantics
unit mapping
result mapping
image format
idempotency
late event behavior
```

---

# 74. 设备能力 Registry

保存：

```text
equipment class
manufacturer
model
serial
site
inspection type
resolution
field of view
supported measurements
calibration
software version
program format
data export capability
```

---

# 75. Program Registry

```text
SPI program
AOI program
X-Ray recipe
ICT program
FCT sequence
OQC checklist
```

每个 Program 绑定：

```text
product revision
MBOM
routing
equipment class
fixture
limit set
approval
```

---

# 76. Limit Set Registry

限值变更必须：

```text
new revision
reason
risk review
approval
effectivity
comparison
```

禁止直接覆盖历史限值。

---

# 77. Defect Taxonomy Registry

```text
taxonomy version
defect code
category
description
severity defaults
standard mapping
customer mapping
allowed dispositions
```

企业不同工厂使用统一 Canonical Code，同时保留设备原始代码。

---

# 78. 原始设备代码映射

```text
provider/device code
→ canonical defect code
```

保存映射版本和人工审核。

---

# 79. 图像处理流水线

```text
raw image validation
→ calibration/correction
→ board/refdes registration
→ region extraction
→ detection/classification/segmentation
→ rule fusion
→ confidence calibration
→ review routing
→ evidence storage
```

---

# 80. RefDes 图像注册

使用：

```text
CAD placement
fiducials
board outline
camera calibration
panel position
image transform
```

输出坐标变换和误差。

---

# 81. 模型类型

```text
image classification
object detection
semantic segmentation
instance segmentation
anomaly detection
OCR
similarity/reference comparison
time-series anomaly
multivariate test anomaly
```

---

# 82. 模型适用 Scope

每个模型必须声明：

```text
product family
component/package classes
equipment/camera
lighting
site
defect classes
minimum resolution
excluded conditions
```

不能把一个工厂训练的 AOI 模型无验证地部署到另一套相机。

---

# 83. 模型验证

至少包含：

```text
train/validation/test separation
site split
time split
lot split
device split
per-class metrics
rare critical defect recall
false escape
false call
confidence calibration
out-of-distribution
latency
```

---

# 84. Critical Defect 模型策略

对于：

```text
wrong part
reversed polarity
bridge
short
counterfeit suspect
safety function failure
```

要求：

```text
higher recall target
lower auto-pass authority
mandatory review or redundant test
```

---

# 85. 模型审批状态

```text
development
shadow
limited_release
approved
suspended
retired
```

模型漂移或数据异常可自动降级到 Shadow/Rule/Manual。

---

# 86. Model Drift

监控：

```text
input image statistics
camera/lighting
class distribution
confidence distribution
false call
false escape
review disagreement
site/product shift
```

---

# 87. Human-in-the-loop

Review Queue 优先级：

```text
critical prediction
low confidence
model/rule conflict
new defect
out-of-distribution
counterfeit suspect
customer complaint
```

---

# 88. Evidence Fusion

融合：

```text
device native judgement
deterministic rule
vision model
electrical test
traceability
supplier/document evidence
human review
```

V1 使用可解释规则，不使用不可审计的大模型“综合打分”。

---

# 89. 假料风险引擎

步骤：

```text
pedigree risk
→ document consistency
→ label/marking
→ dimensions
→ package surface
→ X-ray/XRF if required
→ electrical signature
→ lab/destructive analysis if approved
→ technical disposition
```

输出：

```text
evidence completeness
risk score
hard anomalies
recommended next tests
authorized conclusion
```

---

# 90. 可疑假料 Hard Trigger

```text
manufacturer denies lot/marking
internal structure inconsistent with verified reference
multiple independent evidence anomalies
electrical signature incompatible
document/physical identity conflict
```

仍由授权质量人员或实验室完成最终技术结论。

---

# 91. Measurement System Analysis

支持：

```text
bias
linearity
stability
repeatability
reproducibility
GR&R
attribute agreement
```

当测量系统能力不足时，质量判定标记：

```text
measurement_system_not_capable
```

---

# 92. 抽样执行

流程：

```text
define lot
→ select sampling policy
→ deterministic random sample
→ preserve random seed
→ inspect
→ accept/reject
→ update switching history
```

抽样选择可重放。

---

# 93. 抽样切换历史

```text
supplier
part family
inspection plan
consecutive accepted/rejected lots
normal/tightened/reduced
effective date
```

---

# 94. IQC 放行

判定：

```text
document result
physical result
sampling result
counterfeit risk
quality history
customer rule
```

系统生成：

```text
release_candidate
hold_candidate
reject_candidate
conditional_release_candidate
```

授权人完成正式放行。

---

# 95. SPI 闭环

```text
SPI defect
→ printer/stencil/paste correlation
→ cleaning or parameter adjustment proposal
→ reprint/reinspect
→ AOI outcome correlation
```

参数调整需要工程权限。

---

# 96. AOI/X-Ray 闭环

```text
defect observation
→ review
→ repair/rework
→ reinspection
→ downstream ICT/FCT result
→ false call/escape label
```

---

# 97. ICT/FCT 异常诊断

使用确定性故障树和关联：

```text
failed step
→ net/refdes
→ expected signal
→ upstream AOI/X-Ray
→ component lot
→ firmware/config
→ fixture/equipment
```

输出候选原因，不自动认定根因。

---

# 98. 测试异常类型

```text
hard fail
marginal fail
intermittent
timeout
equipment error
fixture error
communication error
invalid result
not tested
```

---

# 99. Marginal/Guard-band

```text
within specification but inside warning band
```

状态：

```text
pass_with_warning
```

可进入趋势分析或加严检验。

---

# 100. Retest Policy

```text
maximum attempts
cooldown
power cycle
fixture reseat
operator approval
rework required before retest
```

禁止无限重测直到通过。

---

# 101. First Pass Yield

只使用：

```text
first valid attempt
```

设备错误或 Invalid Result 按定义单独处理。

---

# 102. Quality Hold 传播

借助 Agent 42：

```text
affected incoming lot
→ inventory
→ issued material
→ WIP
→ finished goods
→ shipments
→ customers
```

输出：

```text
confirmed scope
conservative scope
untraceable quantity
```

---

# 103. 质量隔离动作

```text
block inventory
stop issue
hold work order
hold WIP
hold finished goods
stop shipment
customer impact review
```

本 Agent 默认生成动作建议；正式执行需要授权和系统接口。

---

# 104. NCR/MRB 规则

自动创建 NCR 候选：

```text
critical defect
lot reject
repeat major
SPC special cause
customer escape
counterfeit suspect
```

MRB 不允许模型单独决定。

---

# 105. CAPA Effectiveness

效果验证必须定义：

```text
metric
baseline
target
observation period
sample size
responsible owner
decision rule
```

关闭 CAPA 需要证据。

---

# 106. Supplier Quality Feedback

向 Agent 44/37输出：

```text
incoming PPM
lot reject
defect category
SCAR response time
repeat issue
recovery cost
quality confidence
```

---

# 107. Agent 43 反馈

用于更新：

```text
inspection plan
AOI program
test limits
work instruction
tooling
routing
traceability point
```

所有变更走新 Revision。

---

# 108. Agent 39 反馈

输出：

```text
inspection cost
rework
scrap
line stop
sorting
warranty
supplier recovery
```

---

# 109. API 设计

## 109.1 Quality Plan

```text
POST /api/v1/quality/plans
GET  /api/v1/quality/plans/{id}
GET  /api/v1/quality/plans/{id}/inspection-plans
POST /api/v1/quality/plans/{id}/validate
POST /api/v1/quality/plans/{id}/release
```

## 109.2 Inspection Lots/Jobs

```text
POST /api/v1/quality/inspection-lots
GET  /api/v1/quality/inspection-lots/{id}
POST /api/v1/quality/inspection-lots/{id}/start
POST /api/v1/quality/inspection-lots/{id}/complete
POST /api/v1/quality/jobs
GET  /api/v1/quality/jobs/{id}
GET  /api/v1/quality/jobs/{id}/events
POST /api/v1/quality/jobs/{id}/cancel
```

## 109.3 Data Ingestion

```text
POST /api/v1/quality/inspection-events
POST /api/v1/quality/inspection-events/batch
POST /api/v1/quality/evidence
GET  /api/v1/quality/inspection-events/{id}
GET  /api/v1/quality/inspection-events/{id}/measurements
GET  /api/v1/quality/inspection-events/{id}/defects
```

## 109.4 Review

```text
GET  /api/v1/quality/reviews
GET  /api/v1/quality/reviews/{id}
POST /api/v1/quality/reviews/{id}/confirm
POST /api/v1/quality/reviews/{id}/correct
POST /api/v1/quality/reviews/{id}/dismiss
```

## 109.5 Decision/Hold

```text
POST /api/v1/quality/inspection-lots/{id}/decision
POST /api/v1/quality/holds
GET  /api/v1/quality/holds/{id}
POST /api/v1/quality/holds/{id}/authorize
POST /api/v1/quality/holds/{id}/release
GET  /api/v1/quality/holds/{id}/impact
```

## 109.6 NCR/MRB/Rework

```text
POST /api/v1/quality/ncrs
GET  /api/v1/quality/ncrs/{id}
POST /api/v1/quality/ncrs/{id}/submit-mrb
POST /api/v1/quality/ncrs/{id}/decisions
POST /api/v1/quality/rework-orders
GET  /api/v1/quality/rework-orders/{id}
POST /api/v1/quality/rework-orders/{id}/complete
```

## 109.7 CAPA/8D/SCAR

```text
POST /api/v1/quality/capas
GET  /api/v1/quality/capas/{id}
POST /api/v1/quality/capas/{id}/verify
POST /api/v1/quality/eight-d
GET  /api/v1/quality/eight-d/{id}
POST /api/v1/quality/scars
GET  /api/v1/quality/scars/{id}
```

## 109.8 SPC

```text
POST /api/v1/quality/spc/series
GET  /api/v1/quality/spc/series/{id}
GET  /api/v1/quality/spc/series/{id}/chart
GET  /api/v1/quality/spc/series/{id}/signals
POST /api/v1/quality/capability-studies
GET  /api/v1/quality/capability-studies/{id}
```

## 109.9 Models

```text
POST /api/v1/quality/models
GET  /api/v1/quality/models/{id}
POST /api/v1/quality/models/{id}/validate
POST /api/v1/quality/models/{id}/approve
POST /api/v1/quality/models/{id}/suspend
GET  /api/v1/quality/models/{id}/drift
```

## 109.10 Reports

```text
GET  /api/v1/quality/metrics
GET  /api/v1/quality/supplier-performance
POST /api/v1/quality/reports
GET  /api/v1/quality/reports/{id}
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 110. 输入事件

```text
purchase.receipt.created
iqc.required
inventory.lot.created
inventory.reuse-plan.ready
work-order.released
operation.started
spi.completed
aoi.completed
xray.completed
ict.completed
fct.completed
calibration.completed
oqc.required
shipment.ready
trace.event.accepted
manufacturing.order.received
quality.plan.released
test.specification.approved
firmware.package.approved
customer.complaint.created
rma.created
```

---

# 111. 输出事件

```text
quality.inspection.completed
quality.defect.detected
quality.review.required
quality.hold.requested
quality.hold.authorized
quality.lot.released
quality.lot.rejected
quality.ncr.created
quality.rework.required
quality.retest.completed
quality.spc.signal.detected
quality.capa.created
quality.scar.created
quality.supplier-risk.updated
quality.customer-impact.ready
quality.model.drift.detected
```

---

# 112. `quality.defect.detected`

```json
{
  "event_type": "quality.defect.detected",
  "event_version": "1.0",
  "inspection_event_id": "uuid",
  "defect_observation_id": "uuid",
  "inspection_type": "AOI",
  "defect_code": "REVERSED",
  "severity": "critical",
  "target": {
    "serial_id": "uuid",
    "refdes": "D1"
  },
  "review_status": "confirmed",
  "created_at": "ISO-8601"
}
```

---

# 113. 规则和配置

```text
policies/
├── quality-agent-1.0.0.yaml
├── standards-registry.yaml
├── defect-taxonomy.yaml
├── severity-profiles/
├── sampling/
│   ├── iqc-risk.yaml
│   ├── customer-defined.yaml
│   └── switching-rules.yaml
├── iqc/
│   ├── document-check.yaml
│   ├── visual-dimensional.yaml
│   └── counterfeit-risk.yaml
├── spi/
├── aoi/
├── xray/
├── ict/
├── fct/
├── oqc/
├── spc/
├── capability/
├── hold-and-release.yaml
├── ncr-mrb.yaml
├── capa-eight-d.yaml
├── model-governance.yaml
└── enterprise/
```

---

# 114. 规则引擎

要求：

- JSON/YAML Schema；
- 受限表达式 DSL；
- Rule Version；
- Effectivity；
- Scope；
- Priority；
- Conflict Detection；
- Dry Run；
- Explanation Trace；
- Rollback；
- 禁止任意代码执行。

---

# 115. 模型服务边界

推荐单独服务：

```text
quality-inference-service
```

职责：

```text
image preprocessing
model inference
prediction output
model health
```

业务判定、审核、Hold 和 NCR 留在 Quality Agent。

---

# 116. 边缘推理

支持：

```text
AOI machine-side
factory edge server
central private cloud
```

边缘结果必须上传：

```text
model version
input hash
prediction
latency
device
```

---

# 117. 模型训练边界

训练管线与生产 Agent 分离：

```text
dataset curation
labeling
training
validation
approval
deployment
```

生产数据进入训练集需授权和脱敏。

---

# 118. 数据标注

标签包含：

```text
defect class
geometry
severity
review status
product/part/package
camera/lighting
source
```

多审核者分歧保留。

---

# 119. Active Learning

仅推荐：

```text
uncertain samples
new defect clusters
false calls
false escapes
distribution shift
```

不自动将预测标签当真值。

---

# 120. Benchmark

## IQC

```text
lot definition accuracy
sampling execution
document anomaly
marking OCR
dimension comparison
counterfeit-risk evidence
```

## SPI/AOI/X-Ray

```text
per-defect precision/recall
critical defect recall
false call
false escape
localization IoU
measurement error
```

## ICT/FCT

```text
raw log parsing
limit evaluation
guard-band
fixture/equipment error separation
first-pass/retest linkage
```

## SPC

```text
control limit
signal detection
false alarm
capability validity
```

## Workflow

```text
hold propagation
NCR/MRB authorization
rework/retest
CAPA effectiveness
supplier action
```

## Security

```text
tenant/customer isolation
image access
model artifact integrity
limit-set permission
hold/release permission
audit replay
```

---

# 121. 初始质量目标

```text
Raw Evidence Preservation = 100%
Inspection Event Idempotency = 100%
Part/Lot/RefDes Trace Link Accuracy >= 99.99%
DNP/Wrong-part Critical Rule Enforcement = 100%
First Fail Preservation = 100%
Retest Linkage Accuracy = 100%
Critical Defect Auto-release Rate = 0%
Unapproved Limit Change Rate = 0%
Expired Calibration Auto-release Rate = 0%
AOI Critical Defect Recall Target >= 99.5% on validated scope
AOI False Escape Target <= 0.5% on validated scope
SPI Measurement Mapping Accuracy >= 99.9%
ICT/FCT Limit Evaluation Accuracy = 100%
Quality Hold Scope Conservation = 100%
Counterfeit Single-image Final Decision Rate = 0%
Tenant/Customer Isolation = 100%
Audit Replay Consistency = 100%
```

这些是目标，不是未经验证的保证。

---

# 122. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## IQC

1. Authorized Source；
2. Broker Source；
3. Missing COC；
4. Lot/Date Code Conflict；
5. Label Anomaly；
6. Package Dimension Fail；
7. Bent Lead；
8. Moisture Bag Fail；
9. X-Ray Structure Match；
10. X-Ray Structure Anomaly；
11. XRF Match；
12. Electrical Signature Fail；
13. Suspect Inconclusive；
14. Confirmed Lab Result；
15. AQL Accept；
16. AQL Reject；
17. Tightened Inspection；
18. Reduced Inspection；
19. Mixed Lot Block；
20. Sampling Replay。

## SPI

21. Missing Paste；
22. Insufficient Volume；
23. Excess Volume；
24. Height Fail；
25. Offset；
26. Bridge Risk；
27. Smear；
28. Stencil Revision Mismatch；
29. Paste Lot Correlation；
30. Printer Drift。

## AOI

31. Missing Part；
32. Wrong Part；
33. Extra Part；
34. Reversed IC；
35. Reversed Diode；
36. Polarity Capacitor；
37. Offset；
38. Rotation；
39. Tombstone；
40. Billboard；
41. Lifted Lead；
42. Bridge；
43. Insufficient Solder；
44. Excess Solder；
45. Solder Ball；
46. Damage；
47. False Call；
48. False Escape；
49. Low Confidence；
50. OOD Image。

## X-Ray

51. BGA Open；
52. BGA Bridge；
53. Head-in-Pillow；
54. Missing Ball；
55. Void Ratio；
56. QFN Void；
57. LGA；
58. THT Fill；
59. Internal Damage；
60. Mixed Criteria Profile。

## ICT/FCT

61. Open；
62. Short；
63. Resistance Fail；
64. Capacitance Fail；
65. Rail Under-voltage；
66. Over-current；
67. Communication Fail；
68. Firmware Mismatch；
69. Fixture Error；
70. Equipment Error；
71. Limit Version Mismatch；
72. Guard-band Warning；
73. First Fail Retest Pass；
74. Rework Retest；
75. Infinite Retest Block。

## OQC

76. Label Mismatch；
77. Serial Duplicate；
78. Accessory Missing；
79. Firmware Check；
80. Packaging Damage；
81. Carton Label；
82. Customer Mark；
83. Sampling；
84. Shipment Hold；
85. Release Approval。

## SPC/Workflow

86. Xbar Signal；
87. p-chart Signal；
88. Trend；
89. Shift；
90. Capability Invalid；
91. Quality Hold；
92. Trace Impact；
93. NCR；
94. MRB；
95. Rework；
96. CAPA；
97. SCAR；
98. Tenant Isolation；
99. 1M Images；
100. Audit Replay。

---

# 123. 性能要求

在线设备接入：

```text
单 inspection event 写入 P95 < 100 ms
单测试日志规则判定 P95 < 200 ms
单 AOI 图像推理按模型/硬件 SLA
Critical Alert 发布 P95 < 2 s after result
```

批量：

```text
1,000,000 AOI images/day
100,000 FCT serial results/day
```

需要：

- 异步对象存储；
- Metadata 与图像分离；
- 边缘推理；
- 流式事件；
- 分区；
- 批量写入；
- GPU Worker Pool；
- Backpressure；
- 可降级规则/人工模式；
- 生命周期归档。

---

# 124. 缓存和增量

缓存键：

```text
quality plan revision
inspection plan revision
standard profile
sampling policy
program version
limit set
equipment calibration
model version
input hash
```

变化触发：

```text
new MBOM revision
new test limit
new AOI program
equipment calibration change
model suspension
customer rule change
new defect taxonomy
```

---

# 125. 安全与权限

- 原始图像、X-Ray、测试日志和客户数据严格隔离；
- Model Artifact 使用签名和 Hash；
- 生产 Model 只允许批准版本；
- Limit Set、Sampling Plan 和 Severity Profile 分权；
- Hold、Release、MRB、Scrap、Deviation 分别授权；
- 供应商只能看到与其相关的 NCR/SCAR；
- 客户报告隐藏其他客户、供应商合同和工艺机密；
- 原始失败结果和证据不可删除；
- 上传文件病毒扫描；
- 不执行宏和脚本；
- HTML/PDF 转义；
- Device API 使用证书/短期 Token；
- 离线设备补传防重放；
- PII 和操作员数据按策略保护；
- 不将制造图像、测试日志、客户和供应商数据发送给外部通用模型；
- 使用第三方模型服务必须经过数据处理和部署批准；
- AI 不得批准 Lot、解除 Hold、修改限值或关闭 CAPA；
- 公开测试只使用合成、脱敏或授权数据；
- 训练数据必须记录授权和用途。

---

# 126. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Kafka / Redpanda
```

数据：

```text
Polars
PyArrow
DuckDB
TimescaleDB optional
```

视觉：

```text
OpenCV
ONNX Runtime
PyTorch for training
TensorRT/OpenVINO optional edge inference
```

统计：

```text
NumPy
SciPy
statsmodels
```

工作流：

```text
Temporal
```

报告：

```text
Jinja2
Playwright / WeasyPrint
```

通用 LLM 不是 V1 依赖。

---

# 127. 推荐仓库结构

```text
quality-intelligence-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── quality-intelligence-agent-spec.md
│   ├── quality-plan-domain-model.md
│   ├── standards-and-sampling.md
│   ├── iqc-and-counterfeit-risk.md
│   ├── spi-quality-model.md
│   ├── aoi-quality-model.md
│   ├── xray-quality-model.md
│   ├── ict-fct-test-model.md
│   ├── oqc-model.md
│   ├── defect-taxonomy.md
│   ├── model-governance.md
│   ├── spc-and-capability.md
│   ├── hold-ncr-mrb.md
│   ├── capa-eight-d.md
│   ├── supplier-quality.md
│   ├── integration-agent42-44.md
│   ├── security-and-evidence.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-observation-prediction-decision-separated.md
│       ├── 0002-first-fail-is-immutable.md
│       ├── 0003-counterfeit-is-evidence-based.md
│       ├── 0004-critical-defects-require-hard-gates.md
│       ├── 0005-quality-hold-needs-authorized-release.md
│       └── 0006-standards-rules-are-versioned-and-licensed.md
├── src/
│   └── quality_intelligence/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── plan.py
│       │   ├── inspection.py
│       │   ├── measurement.py
│       │   ├── defect.py
│       │   ├── decision.py
│       │   ├── hold.py
│       │   ├── ncr.py
│       │   ├── capa.py
│       │   └── spc.py
│       ├── adapters/
│       │   ├── agent31_32_bom.py
│       │   ├── agent33_alternatives.py
│       │   ├── agent34_35_compliance.py
│       │   ├── agent36_37_supply.py
│       │   ├── agent39_cost.py
│       │   ├── agent40_41_inventory.py
│       │   ├── agent42_traceability.py
│       │   ├── agent43_quality_plan.py
│       │   ├── agent44_manufacturer.py
│       │   ├── iqc_mobile.py
│       │   ├── spi.py
│       │   ├── aoi.py
│       │   ├── xray.py
│       │   ├── ict.py
│       │   ├── fct.py
│       │   └── oqc.py
│       ├── standards/
│       │   ├── registry.py
│       │   ├── profiles.py
│       │   ├── licensing.py
│       │   └── mapping.py
│       ├── sampling/
│       │   ├── plans.py
│       │   ├── selector.py
│       │   ├── switching.py
│       │   ├── replay.py
│       │   └── risk_adaptive.py
│       ├── ingestion/
│       │   ├── validation.py
│       │   ├── idempotency.py
│       │   ├── normalization.py
│       │   ├── units.py
│       │   └── late_events.py
│       ├── iqc/
│       │   ├── lot_definition.py
│       │   ├── documents.py
│       │   ├── visual.py
│       │   ├── dimensions.py
│       │   ├── pedigree.py
│       │   ├── counterfeit_risk.py
│       │   ├── xray_xrf.py
│       │   └── electrical.py
│       ├── spi/
│       │   ├── measurements.py
│       │   ├── rules.py
│       │   ├── process_correlation.py
│       │   └── alerts.py
│       ├── aoi/
│       │   ├── registration.py
│       │   ├── refdes.py
│       │   ├── predictions.py
│       │   ├── rules.py
│       │   ├── golden_image.py
│       │   └── review.py
│       ├── xray/
│       │   ├── preprocess.py
│       │   ├── bga.py
│       │   ├── qfn.py
│       │   ├── voids.py
│       │   ├── tht_fill.py
│       │   └── review.py
│       ├── testing/
│       │   ├── programs.py
│       │   ├── limits.py
│       │   ├── guard_band.py
│       │   ├── ict.py
│       │   ├── fct.py
│       │   ├── calibration.py
│       │   ├── golden_unit.py
│       │   └── retest.py
│       ├── oqc/
│       ├── models/
│       │   ├── registry.py
│       │   ├── inference.py
│       │   ├── validation.py
│       │   ├── calibration.py
│       │   ├── drift.py
│       │   └── governance.py
│       ├── evidence/
│       │   ├── images.py
│       │   ├── signals.py
│       │   ├── hashing.py
│       │   └── access.py
│       ├── rules/
│       │   ├── engine.py
│       │   ├── fusion.py
│       │   └── trace.py
│       ├── decisions/
│       ├── holds/
│       ├── ncr/
│       ├── rework/
│       ├── capa/
│       ├── supplier_quality/
│       ├── spc/
│       │   ├── charts.py
│       │   ├── signals.py
│       │   ├── capability.py
│       │   └── metrics.py
│       ├── reports/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── standards-profiles/
├── defect-taxonomies/
├── model-registry/
├── label-schemas/
├── report-templates/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── validate_quality_plan.py
    ├── validate_sampling_plan.py
    ├── replay_inspection_event.py
    ├── inspect_model_prediction.py
    ├── calculate_spc.py
    ├── verify_first_pass_yield.py
    ├── trace_quality_hold.py
    ├── run_quality_benchmark.py
    └── verify_quality_audit_package.py
```


---

# 128. Codex 分阶段实施

不要让 Codex 一次实现全部 IQC、视觉模型、测试设备、SPC、NCR、CAPA 和供应商闭环。

## Phase 0：仓库侦察和质量数据盘点

Codex 必须检查：

1. Agent 31–44 的真实完成程度和接口；
2. 当前 Quality Plan、Inspection Plan、Control Plan 和 Sampling Plan；
3. 当前标准 Profile、IPC Class、客户附录和内部判定规则；
4. 当前 IQC Lot、AQL、Normal/Tightened/Reduced 和抽样历史；
5. 当前 PO、Receipt、Lot、Date Code、COC、COA、COO 和供应商来源；
6. 当前假料、来源风险、X-Ray、XRF、电性和实验室流程；
7. 当前 SPI 设备、程序、测量字段、Stencil 和 Paste 数据；
8. 当前 AOI 设备、程序、图片、Golden Image、缺陷代码和人工复判；
9. 当前 X-Ray 设备、BGA/QFN/THT 检验和空洞数据；
10. 当前 ICT/FCT 程序、Fixture、Limit、Raw Log、Retest 和 Calibration；
11. 当前 OQC、Label、Accessory、Packaging 和 Shipment Hold；
12. 当前 Defect Taxonomy、Severity 和客户映射；
13. 当前 First Pass、Retest、Rework、Scrap 和 Final Yield；
14. 当前 SPC、Control Chart、Cp/Cpk、PPM 和 Supplier Quality；
15. 当前 NCR、MRB、Rework、CAPA、8D、SCAR；
16. 当前 Hold/Release、WMS/MES/QMS/ERP 写回；
17. 当前 Agent 42 Trace 和影响传播；
18. 当前 Agent 43 Quality/Test/Traceability Contract；
19. 当前 Agent 44 制造商质量和订单数据；
20. 当前模型、数据集、标注、验证、部署、漂移和 Shadow Mode；
21. 当前设备校准、GR&R 和 Golden Unit；
22. 当前证据、对象存储、Hash、权限、审计和保留；
23. 统计 Missing Lot、Missing Program Version、Invalid Calibration、First Fail Overwrite 和 Trace Gap；
24. 抽样分析合成或脱敏质量案例；
25. 不修改业务代码；
26. 不创建 Migration；
27. 不安装依赖；
28. 不读取或打印生产 Secret；
29. 不调用真实 Hold/Release/Scrap/Recall；
30. 不训练或部署生产模型。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Quality Plan；
- Inspection Plan；
- Characteristic；
- Sampling；
- Inspection Lot/Unit/Event；
- Measurement；
- Evidence；
- Defect；
- Prediction；
- Rule Evaluation；
- Decision；
- Hold；
- NCR/MRB；
- Rework/Retest；
- CAPA/8D/SCAR；
- SPC；
- Model；
- Event Schema。

## Phase 2：Standards、Taxonomy 和 Policy Registry

实现：

- Standards Profile；
- Revision；
- Product Class；
- Customer Addendum；
- Licensed Rule Reference；
- Defect Taxonomy；
- Severity；
- Disposition；
- Versioning；
- Effectivity；
- Conflict Detection。

## Phase 3：Inspection Event Ingestion

实现：

- API；
- Batch；
- Source Adapter Contract；
- Idempotency；
- Occurred/Recorded Time；
- Raw Payload；
- Evidence Hash；
- Unit Normalization；
- Late Event；
- Reject Queue。

## Phase 4：Traceability 和 Scope

实现：

- Agent 42 Adapter；
- PO/Receipt/Lot；
- Work Order/Operation；
- RefDes/Serial；
- Shipment/Customer；
- Scope Validation；
- Missing Trace Gap；
- Permission。

## Phase 5：IQC Lot、Sampling 和 Documents

实现：

- Lot Definition；
- Risk Profile；
- AQL/Fixed/100%；
- Deterministic Sampling；
- Random Seed Replay；
- Switching History；
- Document Checklist；
- Receipt Decision Draft。

## Phase 6：IQC Visual、Dimension 和 Package

实现：

- Marking Image；
- OCR；
- Package Dimension；
- Lead/Pin；
- MSL/Packaging；
- Golden Reference；
- Rule Evaluation；
- Review Queue。

## Phase 7：Counterfeit-risk Evidence

实现：

- Pedigree；
- Authorization；
- Price/Lifecycle Risk；
- Label/Marking；
- X-Ray/XRF；
- Electrical；
- Lab/Destructive Hook；
- Evidence Fusion；
- Suspect/Inconclusive；
- No Single-image Final Decision。

## Phase 8：SPI Adapter 和 Rules

实现：

- Raw Measurement；
- Height/Area/Volume；
- Offset；
- Missing/Excess/Bridge Risk；
- Pad/Stencil Mapping；
- Printer/Paste Context；
- SPC Feed；
- Alerts。

## Phase 9：AOI Adapter、Registration 和 Rules

实现：

- Image；
- Board/Panel Registration；
- RefDes Crop；
- Device Code Mapping；
- DNP；
- Orientation/Polarity；
- Native Result；
- Review；
- Evidence。

## Phase 10：AOI Vision Model V1

实现：

- Model Registry；
- Approved Scope；
- Inference Contract；
- Detection/Classification；
- Confidence；
- OOD；
- Shadow Mode；
- Model/Rule Conflict；
- Human Review；
- No Auto Release。

## Phase 11：X-Ray

实现：

- Image/Recipe；
- BGA/QFN/LGA/THT；
- Void Measurement；
- Bridge/Open/HIP；
- Criteria Profile；
- Human Review；
- Trace。

## Phase 12：ICT

实现：

- Program/Fixture；
- Raw Log Parser；
- Open/Short/Value；
- Limit Set；
- Coverage；
- Equipment Error；
- First Attempt；
- Result Trace。

## Phase 13：FCT、Firmware 和 Calibration

实现：

- Test Sequence；
- Power/Current/IO/Communication；
- Firmware；
- Serial/MAC；
- Limit/Guard-band；
- Golden Unit；
- Calibration；
- Invalid Result；
- Waveform Evidence。

## Phase 14：Retest、Rework 和 First-pass Metrics

实现：

- Original Fail；
- Attempt；
- Rework Link；
- Maximum Attempts；
- FPY/RTY；
- Final Yield；
- False Call/Escape；
- No Overwrite。

## Phase 15：OQC

实现：

- Appearance；
- Function；
- Label；
- Serial；
- Firmware；
- Accessory；
- Packaging；
- Sampling；
- Shipment Hold；
- Customer Requirement。

## Phase 16：Quality Decision 和 Hold

实现：

- Rule/Model/Human Separation；
- Unit/Lot Decision；
- Release Candidate；
- Hold Candidate；
- Authorized Hold；
- Agent 42 Impact；
- WMS/MES Hook；
- Release Approval。

## Phase 17：NCR、MRB 和 Rework

实现：

- NCR Trigger；
- Containment；
- Affected Quantity；
- MRB；
- Use-as-is/Rework/Return/Scrap；
- Deviation；
- Rework Order；
- Retest；
- Audit。

## Phase 18：CAPA、8D 和 SCAR

实现：

- CAPA；
- 8D；
- Root Cause Evidence；
- Action；
- Effectiveness；
- Supplier Response；
- SLA；
- Repeat Defect；
- Closure Gate。

## Phase 19：SPC、Yield 和 Capability

实现：

- Xbar/R/I-MR/p/np/c/u；
- Control Limits；
- Signal Rules；
- FPY/RTY/DPU/DPMO/PPM；
- Cp/Cpk/Pp/Ppk Validity；
- Trends；
- Alerts；
- Versioned Definitions。

## Phase 20：Model Governance 和 Drift

实现：

- Dataset；
- Label Schema；
- Validation；
- Per-class Metrics；
- Critical Recall；
- False Escape；
- Confidence Calibration；
- Drift；
- Suspend；
- Rollback；
- Active-learning Queue。

## Phase 21：Supplier、Manufacturer 和 Cost Feedback

实现：

- Agent 37 Risk；
- Agent 39 Cost；
- Agent 44 Provider Quality；
- Incoming PPM；
- Lot Reject；
- SCAR Response；
- Recovery Cost；
- Repeat Issue；
- Evidence Confidence。

## Phase 22：Reports、Customer View 和 Audit

实现：

- Inspection Report；
- First Article；
- NCR/CAPA；
- Supplier Report；
- Customer Quality Report；
- Evidence Manifest；
- Hash；
- Redaction；
- HTML/PDF；
- Totals Verification。

## Phase 23：API、Events、Batch 和 Edge

实现：

- API；
- Jobs；
- Progress；
- Event Bus；
- Batch；
- Offline Devices；
- Backpressure；
- Cancel/Resume；
- Object Storage；
- Access Control。

## Phase 24：Security、Retention 和 Legal Hold

实现：

- Tenant/Customer；
- Device Identity；
- Model Artifact Signing；
- Limit Permission；
- Evidence Retention；
- Legal Hold；
- PII；
- Network Egress；
- Audit Immutability。

## Phase 25：Benchmark、监控和生产发布

实现：

- Golden IQC；
- Synthetic Defects；
- AOI/X-Ray Benchmark；
- Test Parser Benchmark；
- Quantity/Trace；
- Hold Security；
- Load Test；
- Metrics；
- Dashboard；
- Feature Flags；
- Model Rollback；
- Disaster Recovery。

## Phase 26：高级根因和跨工序关联，可选

稳定后：

- SPI → AOI → ICT/FCT 关联；
- Paste/Stencil/Printer 参数相关；
- Component Lot → Defect Cluster；
- Equipment/Shift/Environment Correlation；
- Failure Mode Knowledge Graph；
- 仅推荐 Root Cause Candidate；
- 不自动关闭 CAPA。

---

# 129. Codex 工作纪律

Codex 必须：

1. Quality Requirement、Observation、Prediction、Decision 和 Disposition 分开；
2. Raw Image、Raw Measurement 和 Raw Test Log 不可覆盖；
3. First Fail 不可覆盖；
4. Retest Pass 不改变 FPY；
5. Rework 后结果单独统计；
6. Model Prediction 不等于 Final Decision；
7. Critical Defect 不得模型自动放行；
8. Quality Hold 和 Release 分别授权；
9. Agent 42 Trace Scope 必须参与；
10. Missing Trace 不得假装完整；
11. Agent 43 Plan、Program、Limit 和 Fixture Revision 必须匹配；
12. Equipment Calibration 过期不得自动放行；
13. Device Error、Fixture Error、Product Fail 分开；
14. Invalid Result 不得算 Pass 或 Fail；
15. Sampling Lot 定义必须明确；
16. 不同 Manufacturer Lot/Date Code 不随意合并；
17. 抽样随机过程可重放；
18. AQL 和 Switching Rule 版本化；
19. 不复制未经许可的标准完整表格或图例；
20. 标准、客户、企业和偏差规则分开；
21. Wrong Part 不能只靠颜色或封装判断；
22. Provider SKU 不替代 MPN；
23. OCR Marking 保存 Bounding Box 和 Confidence；
24. Date Code Raw 永久保留；
25. 假料不使用单一二元字段；
26. 单一图像模型不得作假料最终结论；
27. Pedigree、文档、物理和电性证据分开；
28. X-Ray/XRF/Decap 必须记录实验室、方法和版本；
29. 破坏性试验需授权；
30. SPI 阈值按 Pad/Aperture/Profile；
31. AOI Golden Image 绑定版本、相机和光源；
32. DNP 不得报 Missing Part；
33. AOI 设备原始代码和 Canonical Code 分开；
34. X-Ray Void 不使用一套全局阈值；
35. ICT Pass 不代表 FCT Pass；
36. AOI Pass 不代表无隐藏焊点缺陷；
37. FCT 限值不能运行时静默修改；
38. Guard Band 版本化；
39. 无限 Retest 必须阻断；
40. Golden Unit 有效期和使用历史必须记录；
41. SPC Signal 不等于 Root Cause；
42. Capability Index 只有数据条件满足才计算；
43. Metric 分母和定义版本化；
44. False Call 和 False Escape 都必须记录；
45. 模型验证按 Site/Time/Lot/Device 分割；
46. Critical Defect Recall 单独报告；
47. 模型 OOD 和 Drift 可自动降级；
48. Active Learning 不把预测当真值；
49. NCR/MRB/CAPA/8D 是结构化对象；
50. CAPA 关闭需要效果验证；
51. Agent 44 Supplier Quality 只基于实际证据；
52. Agent 39 成本不与判定事实混淆；
53. Hold Scope 和 Release Scope 可审计；
54. Model Artifact、Rule、Limit、Program 保存 Hash/Version；
55. 不使用通用 LLM 判断图像缺陷、测试 Pass 或批次放行；
56. AI 不得修改限值、解除 Hold、报废或召回；
57. 不将生产图像、测试日志、客户和供应商数据发送给外部模型；
58. 公开测试只使用合成、脱敏或授权数据；
59. 不伪造模型指标、缺陷、根因、测试或 Benchmark；
60. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Adapter/Policy/Model 变化；
    - 测试命令；
    - 真实结果；
    - Rule Accuracy；
    - Per-defect Model Metrics；
    - First-pass Integrity；
    - Hold/Release Security；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 130. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/quality-intelligence-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第45个 Agent：

Incoming, In-Process & Test Quality Intelligence Agent /
来料、生产与测试质量 Agent。

本 Agent统一管理：

- IQC：来源、PO、Lot、Date Code、COC、外观、尺寸、X-Ray/XRF、电性和可疑假料证据；
- SPI：焊膏高度、面积、体积、偏移、少锡、多锡和桥连风险；
- AOI：错料、漏件、多件、方向、极性、偏移、立碑、翘脚、桥连和焊点缺陷；
- X-Ray：BGA/QFN/LGA/THT 的开路、桥连、空洞、Head-in-Pillow 和隐藏焊点；
- ICT：开路、短路、器件值、网络和边界扫描；
- FCT：电源、电流、通信、IO、系统功能、固件和校准；
- OQC：外观、功能、标签、序列号、附件和包装；

并输出：

- Inspection Observation；
- Rule Evaluation；
- Model Prediction；
- Human Review；
- Unit/Lot Decision；
- Hold/Release；
- NCR/MRB/Rework/Retest；
- CAPA/8D/SCAR；
- SPC/Yield/Capability；
- Supplier/Manufacturer Quality Feedback；
- Customer/Audit Report。

本 Agent 不自动做最终根因、不自动释放 Hold、不自动报废、不自动召回、不自动修改 Test Limit。Critical 缺陷和可疑假料必须人工授权。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31–44 的规格和实际代码；
3. docs/quality-intelligence-agent-spec.md；
4. 当前 Quality Plan、Inspection Plan、Control Plan 和标准 Profile；
5. 当前 IPC/客户等级、Defect Taxonomy 和 Severity；
6. 当前 IQC Lot、AQL、Sampling、COC/COA、Marking、Dimension 和假料流程；
7. 当前 SPI 设备、程序、Stencil、Paste 和测量；
8. 当前 AOI 设备、程序、图片、Golden Image、缺陷代码和复判；
9. 当前 X-Ray Recipe、BGA/QFN/THT 和 Void；
10. 当前 ICT/FCT Program、Fixture、Limit、Raw Log、Firmware 和 Calibration；
11. 当前 OQC、Label、Accessory、Packaging 和 Shipment；
12. 当前 First Fail、Retest、Rework、Scrap、FPY 和 RTY；
13. 当前 SPC、Capability、PPM 和 Supplier Quality；
14. 当前 Hold/Release、NCR、MRB、CAPA、8D、SCAR；
15. 当前 Agent 42 Trace 和 Impact；
16. 当前 Agent 43 Quality/Test/Traceability Contract；
17. 当前 Agent 44 Provider/Order Quality；
18. 当前模型、Dataset、Label、Validation、Deployment 和 Drift；
19. 当前 Evidence、Object Storage、Hash、Permission、Retention 和 Audit；
20. 脱敏、合成或授权 Fixture。

硬约束：

- Requirement/Observation/Prediction/Decision/Disposition 分开；
- Raw Evidence 不覆盖；
- First Fail 不覆盖；
- Retest Pass 不改变 FPY；
- Model Prediction 不等于 Final Decision；
- Critical Defect 不自动放行；
- Hold/Release 授权分开；
- Agent 42 Trace Scope 必须参与；
- Agent 43 Plan/Program/Limit/Fixture Revision 必须匹配；
- Calibration 过期不自动放行；
- Device/Fixture/Product Fail 分开；
- Invalid Result 不算 Pass；
- Lot Definition 明确；
- Manufacturer Lot/Date Code 不随意混批；
- Sampling 可重放；
- AQL/Switching 版本化；
- 不复制未授权标准完整表格；
- Standard/Customer/Enterprise/Deviation 分开；
- Wrong Part 不仅靠图像颜色；
- MPN 和 Provider SKU 分开；
- 假料是 Evidence-based Risk，不是单图二元分类；
- Destructive Test 需授权；
- SPI 按 Pad/Profile；
- AOI Golden Image 绑定版本和设备；
- DNP 不报 Missing；
- X-Ray Criteria 按 Joint/Profile；
- ICT Pass 不替代 FCT；
- Limit 不静默修改；
- Guard Band 版本化；
- 无限 Retest 阻断；
- Golden Unit 受控；
- SPC Signal 不自动认定 Root Cause；
- Capability 有有效性检查；
- False Call/False Escape 记录；
- Model 需 Site/Time/Lot/Device Validation；
- Critical Recall 单独报告；
- OOD/Drift 降级；
- NCR/MRB/CAPA/8D 结构化；
- CAPA 关闭需效果证据；
- Rule/Model/Limit/Program 保存版本和 Hash；
- V1 不使用通用 LLM 判断缺陷和放行；
- AI 不解除 Hold、不修改限值、不报废、不召回；
- 不把生产图像、测试日志、客户和供应商数据发给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造指标、缺陷、根因、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不调用真实 Hold、Release、Scrap、Recall，不训练或部署模型：

1. 侦察当前仓库；
2. 检查 Agent 31–44 的真实完成程度和接口；
3. 查找 Quality/Inspection/Control Plan；
4. 查找 Standard Profile、Defect Taxonomy 和 Severity；
5. 查找 IQC Lot/Sampling/AQL/Switching；
6. 查找 PO/Receipt/Lot/Date Code/COC/COA；
7. 查找假料、Pedigree、Marking、Dimension、X-Ray/XRF/Electrical；
8. 查找 SPI 设备、程序、字段、图片和 Paste/Stencil；
9. 查找 AOI 设备、程序、Golden、缺陷、复判；
10. 查找 X-Ray Recipe、Void、BGA/QFN/THT；
11. 查找 ICT/FCT Program/Fixture/Limit/Raw Log；
12. 查找 Firmware/Calibration/Golden Unit/Guard Band；
13. 查找 OQC/Label/Accessory/Packaging；
14. 查找 First Fail/Retest/Rework/FPY/RTY；
15. 查找 SPC/Capability/PPM/Supplier Quality；
16. 查找 Hold/Release/NCR/MRB/CAPA/8D/SCAR；
17. 查找 Agent 42 Trace Impact；
18. 查找 Agent 43/44 Contracts；
19. 查找 Model/Dataset/Label/Validation/Drift；
20. 查找 Evidence/Hash/Storage/Permission/Retention；
21. 统计 Trace Gap、Calibration Expired、Limit Mismatch、First Fail Overwrite；
22. 抽样分析合成或脱敏质量案例；
23. 在 docs/quality-intelligence-implementation-plan.md 中生成实施计划；
24. 在 docs/quality-plan-domain-model.md 中定义 Domain；
25. 在 docs/standards-and-sampling.md 中定义 Standards/Sampling；
26. 在 docs/iqc-and-counterfeit-risk.md 中定义 IQC/假料；
27. 在 docs/spi-quality-model.md 中定义 SPI；
28. 在 docs/aoi-quality-model.md 中定义 AOI；
29. 在 docs/xray-quality-model.md 中定义 X-Ray；
30. 在 docs/ict-fct-test-model.md 中定义 ICT/FCT；
31. 在 docs/oqc-model.md 中定义 OQC；
32. 在 docs/defect-taxonomy.md 中定义缺陷；
33. 在 docs/model-governance.md 中定义模型治理；
34. 在 docs/spc-and-capability.md 中定义 SPC；
35. 在 docs/hold-ncr-mrb.md 中定义质量处置；
36. 在 docs/capa-eight-d.md 中定义闭环；
37. 在 docs/integration-agent42-44.md 中定义集成；
38. 在 docs/security-and-evidence.md 中定义安全；
39. 在 docs/quality-migration-plan.md 中定义旧数据迁移；
40. 在 docs/quality-benchmark-plan.md 中定义 Benchmark；
41. 给出拟新增、拟修改和拟复用文件；
42. 给出 Phase 1 精确范围；
43. 不修改业务代码；
44. 不创建数据库 Migration；
45. 不安装依赖；
46. 不读取或打印生产 Secret；
47. 运行当前仓库已有 lint、type check、test、build 和 security scan；
48. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–44 输入契约；
- Quality/Inspection Plan；
- Standards/Sampling；
- IQC/Counterfeit Risk；
- SPI；
- AOI；
- X-Ray；
- ICT/FCT；
- OQC；
- Defect Taxonomy；
- Model Governance；
- First Fail/Retest；
- SPC/Capability/Yield；
- Hold/NCR/MRB；
- CAPA/8D/SCAR；
- Trace Impact；
- Agent 43/44 Feedback；
- Security/Evidence；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 131. 后续 Phase 提示词模板

```text
继续实现 Quality Intelligence Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–45 规格；
3. 阅读 Quality Intelligence Implementation Plan；
4. 阅读 Plan、Standards、IQC、SPI、AOI、X-Ray、ICT/FCT、OQC、Model、SPC、NCR/CAPA、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Raw Evidence Immutable；
- Requirement/Observation/Prediction/Decision Separation；
- First Fail Preservation；
- Critical Hard Gate；
- Versioned Plan/Program/Limit/Model；
- Authorized Hold/Release；
- Traceability Scope；
- No Single-image Counterfeit Decision；
- No Unauthorized Standard Tables；
- Evidence/Hash/Audit；
- 不公开真实生产和客户数据；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. model/rule validation；
10. first-pass/retest test；
11. hold/security test；
12. performance test；
13. benchmark；
14. 更新文档；
15. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Adapter/Policy/Model 变化；
- 测试命令和真实结果；
- Rule Accuracy；
- Per-defect Metrics；
- First-pass Integrity；
- Hold/Release Security；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 132. MVP 演示流程

1. Agent 43发布 Pilot Quality Plan；
2. 创建一批 MCU IQC Lot；
3. Agent 42关联 PO、Supplier Lot、Manufacturer Lot 和 Date Code；
4. 按风险策略选择抽样；
5. 保存随机种子和样本清单；
6. 检查 COC 和原厂标签；
7. OCR 提取 MPN、Lot 和 Date Code；
8. 发现标签 Date Code 与实物 Marking 冲突；
9. 状态进入 `suspect`，不是直接判假；
10. 调用尺寸、X-Ray 和电性能检查；
11. X-Ray 内部结构与 Golden Reference 不一致；
12. 创建 High-risk Review；
13. 质量人员授权第三方实验室分析；
14. Lot 被 Hold；
15. Agent 42计算已领料和潜在影响；
16. 供应商 SCAR 创建；
17. 另一批授权来源器件通过 IQC；
18. SMT 印刷后 SPI 上传高度、面积和体积；
19. 发现某区域连续少锡趋势；
20. SPC 触发 Special Cause Alert；
21. 调整印刷参数前需工程审批；
22. AOI 上传整板图像；
23. CAD 注册到 RefDes；
24. 规则发现 D1 极性错误；
25. 模型发现 U3 附近疑似桥连；
26. 人工复判确认 D1 反向、U3 为 False Call；
27. D1 触发 Critical Hold；
28. X-Ray 检查 BGA U1；
29. 识别空洞分布并按该器件 Profile 判定；
30. ICT 首测发现 3V3 对地短路；
31. 关联 AOI、X-Ray 和 RefDes 候选；
32. 返修 D1 后 Retest Pass；
33. FPY 仍记为 Fail；
34. FCT 检查电流、通信和固件；
35. 一个产品出现 Marginal Current；
36. 标记 `pass_with_warning` 并进入趋势；
37. OQC 检查标签、附件和包装；
38. 一台附件缺失，阻断 Shipment；
39. 修复后重新 OQC；
40. 生成 Lot/Work Order/Serial 质量报告；
41. 生成 NCR、MRB 和 Rework Trace；
42. 更新供应商和制造商质量绩效；
43. 发布 `quality.inspection.completed`。

---

# 133. 生产上线顺序

第一阶段：

```text
Agent 43 Quality/Test Plan
Agent 42 Trace
IQC Manual/Document
ICT/FCT Raw Log
OQC Checklist
First Fail/Retest
Hold/NCR
人工审核
```

第二阶段：

```text
SPI Adapter
AOI Native Result
AOI Image Review
X-Ray
SPC/Yield
Supplier SCAR
CAPA/8D
```

第三阶段：

```text
AOI Vision Model
Counterfeit Evidence Fusion
Advanced X-Ray
Cross-process Correlation
Edge Inference
Predictive Quality
```

上线优先确保：

```text
检验的到底是哪一批、哪一台和哪个位号
使用的是哪版程序、限值和治具
第一次失败有没有被保留
质量隔离有没有真正阻止领料和出货
模型判断能否追溯到原图和证据
```

宁可把一张低置信度 AOI 图片送给工程师复判，也不要让模型为了漂亮的“自动判定率”，把反向器件、桥连或可疑物料悄悄判成通过。质量系统真正值钱的不是它敢不敢说“Pass”，而是出了问题时，它能不能准确告诉你：哪里错了、影响了谁、证据是什么、下一步该做什么。
