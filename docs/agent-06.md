# 引脚、封装与订货型号 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Pin, Package & Ordering Variant Extraction Agent  
> 中文名：引脚、封装与订货型号抽取 Agent  
> 版本：V1.0  
> 定位：规则优先、证据可追溯、面向 EDA 与采购数据的结构化抽取 Agent  
>
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent
> - Datasheet Structure & Visual Asset Locator Agent
> - Parameter Extraction & Unit Normalization Agent（可选辅助）
>
> 下游：
> - KiCad 原理图符号生成 Agent
> - 封装与 3D 模型映射 Agent
> - EDA 库依赖与 Pin-Pad 校验 Agent
> - 器件替代料与 Pin-to-Pin 兼容分析
> - BOM 标准化与 MPN 精准匹配
> - Ordering Code/包装方式/温度等级解析
> - 器件详情页、引脚表和封装页展示
>
> 目标读者：产品负责人、后端工程师、EDA 工程师、数据工程师、算法工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的引脚、封装与订货型号抽取 Agent。

该 Agent 接收已解析和已定位的 Datasheet 结构结果，从以下内容中抽取：

- Pin Number；
- Pin Name；
- Pin Type；
- Pin Description；
- Pin Direction；
- Power Domain；
- Alternate Function；
- Pin Group；
- Differential Pair；
- Reserved / NC / DNC；
- Exposed Pad / Thermal Pad；
- Package Variant；
- Package Name；
- Package Code；
- Pin Count；
- Body Size；
- Pitch；
- Ordering Code；
- Base Part Number；
- Package Suffix；
- Temperature Grade；
- Packing Type；
- RoHS/Green/Lead-Free 后缀；
- Reel/Tray/Tube 等包装后缀；
- Automotive/Industrial/Commercial 等等级；
- 器件后缀差异；
- 不同封装之间的 Pin Mapping；
- Family Datasheet 内不同型号/封装的适用关系。

最终输出：

```text
PinCatalog
PackageCatalog
OrderingVariantCatalog
PinPackageApplicabilityMap
SuffixRuleEvidence
QualityReport
```

并向下游提供稳定、可验证的标准数据。

---

# 2. 核心对象必须分层

本 Agent 不能把“引脚表”简单存成一张二维表。

必须区分：

```text
Logical Pin
    ↓
Package Pin Instance
    ↓
Alternate Function / Role
    ↓
Package Variant
    ↓
Ordering Variant
```

---

# 3. 核心数据层

## 3.1 Logical Pin

代表逻辑信号或电气角色，例如：

```text
VDD
GND
PA0
SCL
IN+
OUT
RESET
```

Logical Pin 不一定直接对应唯一物理脚。

例如 MCU 的 `PA0` 在不同封装中可能：

- 存在；
- 不存在；
- 对应不同 Pin Number；
- 同时支持多个复用功能。

## 3.2 Package Pin Instance

代表某个具体封装中的物理引脚：

```text
LQFP48 pin 10
QFN32 pin 6
BGA ball A3
Exposed Pad
```

Package Pin Instance 必须绑定：

- package_variant_id；
- pin_number_raw；
- pin_number_normalized；
- ball_coordinate；
- pad_number；
- logical_pin_id；
- pin_name；
- pin_type；
- description；
- applicability。

## 3.3 Alternate Function

例如：

```text
PA9
USART1_TX
TIM1_CH2
I2C1_SCL
```

一个物理引脚可以有：

- primary function；
- alternate functions；
- analog function；
- debug function；
- boot/config function。

这些不能全部塞进 `pin_name` 字符串中。

## 3.4 Package Variant

例如：

```text
LQFP48
QFN32
TSSOP8
SOIC8
WLCSP25
BGA144
```

必须包含：

- 标准名称；
- 厂商 Package Code；
- Pin Count；
- Pitch；
- Body Size；
- Lead Style；
- Exposed Pad；
- JEDEC/IEC 标准候选；
- Datasheet 图和表；
- 适用型号。

## 3.5 Ordering Variant

例如：

```text
STM32G431CBT6
LM358DR
ADS1115IDGSR
TPS7A2033PDBVR
```

Ordering Variant 必须拆分为：

```text
base_part_number
device_variant
performance_grade
package_code
temperature_grade
quality_grade
packing_code
environmental_code
suffix_raw
```

不能假设所有厂商的后缀规则相同。

---

# 4. 与前五个 Agent 的边界

## 4.1 Asset Ingestion Agent

负责：

- 原始 PDF；
- 版本；
- SHA256；
- 来源；
- Part 初步关联。

本 Agent 不重新下载 PDF。

## 4.2 PDF Parsing Agent

负责：

- Canonical IR；
- 表格；
- 文本；
- bbox；
- OCR；
- 图片；
- reading order。

本 Agent 不重新做整本 OCR。

## 4.3 Classification & Schema Agent

提供：

- 器件类别；
- pin_role_rules；
- package_rules；
- ordering_variant_rules；
- 目标章节/表格提示。

## 4.4 Structure & Visual Locator Agent

提供：

- Pin Description；
- Pin Functions；
- Pin Configuration；
- Package Information；
- Mechanical Data；
- Ordering Information；
- Package Outline；
- Pinout Figure；
- TableCatalog；
- FigureCatalog。

本 Agent 优先消费定位结果，不扫描整本 Datasheet。

## 4.5 Parameter Extraction Agent

可提供：

- Operating Temperature；
- Package Thermal Characteristics；
- Package-dependent 参数；
- Ordering Information 中的等级或电压字段。

但本 Agent 不依赖参数 Agent 才能运行。

## 4.6 本 Agent 不负责

V1 不负责：

- 生成最终 KiCad Symbol；
- 生成 Footprint；
- 生成 STEP/VRML；
- 从封装图中完整读取所有机械尺寸；
- 计算自动布线约束；
- 自动判断所有管脚的最终 EDA electrical type；
- 从图片中推断不存在的 Pin Description；
- 用大模型猜测缺失 Pin；
- 把不同封装的引脚表强行合并；
- 依据字符串前缀机械生成 Ordering Code；
- 覆盖人工审核结果。

---

# 5. 设计原则

## 5.1 Logical Pin 与 Physical Pin 分离

同一逻辑信号在不同封装中的物理位置不同。

因此：

```text
logical_pin
package_pin_instance
```

必须分开。

## 5.2 原始名称与标准名称分离

保存：

```text
pin_name_raw
pin_name_normalized
```

例如：

```text
VSS
GND
DGND
AGND
VSSA
```

不能全部归一成 `GND` 并丢失原始名称。

## 5.3 Pin Type 与 Pin Function 分离

例如：

```text
Pin Name: PA9/USART1_TX
Pin Type: I/O
Functions:
- GPIO
- UART TX
```

`I/O` 是电气类型，`USART1_TX` 是功能。

## 5.4 Datasheet 声明优先

Pin Type 优先来源：

1. Pin Description 表；
2. Pin Function 表；
3. Pinout legend；
4. Device-specific manual；
5. 类别规则；
6. 推断；
7. 人工审核。

## 5.5 推断必须标记

例如：

```text
VDD → power_in
GND → power_in
OUT → output
```

若不是 Datasheet 明确声明，必须记录：

```text
source = inferred_rule
confidence < explicit_source
```

## 5.6 不同封装分别建模

同一 Part Family 的：

```text
SOIC8
TSSOP8
VSSOP8
QFN8
```

必须分别拥有 Package Pin Map。

## 5.7 Family Datasheet 不机械复制

一本 Family Datasheet 可能包含：

- 单运放；
- 双运放；
- 四运放；
- 不同 Pin Count；
- 不同封装；
- 不同电源脚；
- 不同 NC 脚。

必须按 part/package applicability 解析。

## 5.8 Exposed Pad 是一等对象

EP、DAP、PowerPAD、Thermal Pad、Die Pad 必须显式建模：

```text
pin_role = exposed_pad
electrical_connection = ground / supply / no_connect / thermal_only / unknown
```

不能简单忽略。

## 5.9 所有结果带证据

保存：

- page；
- bbox；
- table_id；
- row；
- figure_id；
- caption；
- source block；
- parser provenance；
- rule_id；
- confidence。

## 5.10 规则与厂商后缀 Profile 版本化

必须版本化：

- pin name rules；
- pin type rules；
- package name aliases；
- manufacturer package code；
- ordering suffix parser；
- applicability rules；
- variant parser；
- temperature grade mappings；
- packing code mappings。

---

# 6. Pin Type 体系

建议定义统一 Pin Electrical Type Taxonomy：

```text
input
output
bidirectional
tri_state
open_drain
open_collector
analog_input
analog_output
power_input
power_output
ground
reference_input
reference_output
clock_input
clock_output
reset
configuration
debug
nc
dnc
reserved
exposed_pad
passive
unknown
```

## 6.1 允许多个限定标签

例如：

```json
{
  "electrical_type": "bidirectional",
  "qualifiers": [
    "open_drain",
    "5v_tolerant",
    "schmitt_trigger"
  ]
}
```

## 6.2 EDA 映射

下游 KiCad Agent 可映射为：

```text
input
output
bidirectional
tri_state
passive
power_in
power_out
open_collector
open_emitter
no_connect
unspecified
```

本 Agent 不直接写 KiCad 类型，但可输出推荐映射。

---

# 7. Pin Function 体系

```text
gpio
power
ground
analog
adc_input
dac_output
clock
reset
boot
debug
jtag
swd
uart
spi
i2c
can
usb
ethernet
pwm
timer
oscillator
reference
interrupt
chip_select
enable
shutdown
sense
feedback
gate_drive
source
drain
collector
emitter
anode
cathode
reserved
unknown
```

一个 Pin 可有多个功能。

---

# 8. Pin Number 规范化

## 8.1 支持类型

```text
numeric
alphanumeric
ball_grid
named_pad
range
multiple_numbers
not_applicable
```

## 8.2 示例

```text
1
01
A3
AA12
EP
PAD
DAP
TAB
1, 2
1-4
A1/B2
```

## 8.3 BGA Ball

结构化为：

```json
{
  "raw": "A3",
  "kind": "ball_grid",
  "row": "A",
  "column": 3
}
```

## 8.4 多脚同名

例如：

```text
VDD: pins 1, 10, 20
GND: pins 5, 15
```

生成多个 Package Pin Instance，共享同一 Logical Pin。

## 8.5 Range

例如：

```text
NC: 20-24
```

必须展开前验证封装 Pin Count。

---

# 9. Pin Name 解析

## 9.1 规范化

处理：

- Unicode；
- 上下标；
- overbar；
- 反相信号；
- `/RESET`；
- `nRESET`；
- `RESET#`；
- `~RESET`；
- `RESET_N`；
- 括号；
- 空格；
- 斜线复用；
- 连字符；
- 希腊字母。

## 9.2 Active Low

统一结构：

```json
{
  "base_name": "RESET",
  "active_level": "low",
  "raw_name": "/RESET"
}
```

## 9.3 Differential Pair

例如：

```text
USB_DP / USB_DM
IN+ / IN-
TXP / TXN
```

保存：

```text
pair_id
polarity = positive / negative
```

## 9.4 多功能 Pin

例如：

```text
PA9/USART1_TX/TIM1_CH2
```

保存：

```text
primary_name = PA9
alternate_functions = [...]
```

不能只存整个字符串。

---

# 10. Pin Description 解析

## 10.1 目标字段

```text
raw_description
normalized_description
electrical_characteristics
special_notes
reset_state
default_state
internal_pull
tolerance
drive_strength
boot_behavior
power_domain
```

## 10.2 描述中的语义

例如：

```text
5-V tolerant I/O
Open-drain output
Must be tied to GND
Leave floating
Do not connect
Connect to exposed pad
Internal pull-up
High impedance at reset
```

应提取为结构化 qualifier。

## 10.3 DNC 与 NC 区分

```text
NC = No internal connection，通常可不接
DNC = Do Not Connect，必须悬空
```

必须分开。

---

# 11. Pin 表格处理

## 11.1 常见列

```text
PIN
PIN NUMBER
NAME
SYMBOL
TYPE
I/O
DESCRIPTION
FUNCTION
RESET STATE
POWER DOMAIN
PACKAGE
```

## 11.2 多封装列

例如：

```text
PIN NAME | SOIC | TSSOP | QFN | TYPE | DESCRIPTION
```

一行生成多个 Package Pin Instance。

## 11.3 多行继承

例如：

```text
PA0
  GPIO
  ADC_IN0
  TIM2_CH1
```

需要继承 Pin Name。

## 11.4 合并单元格

Package Header 可能跨多列。

必须使用 Canonical Table 的 merged cell 信息。

## 11.5 跨页 Pin 表

使用 logical_table_id，保留 repeated header。

---

# 12. Pinout 图交叉验证

Pinout Figure 不应作为唯一来源，但可用于验证：

- Pin Number；
- Pin Name；
- Pin 1；
- Top/Bottom View；
- Package orientation；
- Missing Pin；
- EP；
- Ball coordinates。

## 12.1 图表一致性检查

比较：

```text
Pin Description table
vs
Pinout diagram
```

发现：

- 数量不一致；
- 名称冲突；
- Pin Number 冲突；
- View orientation 不一致；
- EP 缺失。

## 12.2 Top View / Bottom View

必须保存 view_type，避免左右镜像错误。

---

# 13. Package 体系

## 13.1 Package 基础字段

```text
package_name_raw
package_name_normalized
package_family
manufacturer_package_code
standard_package_code
pin_count
ball_count
lead_count
pitch
body_length
body_width
body_height
mounting_type
lead_style
exposed_pad
thermal_pad
package_drawing_id
land_pattern_id
```

## 13.2 Package Family

```text
DIP
SOIC
SOP
SSOP
TSSOP
VSSOP
MSOP
QFN
DFN
LQFP
TQFP
BGA
WLCSP
SOT
TO
SC70
CSP
Module
Bare Die
Unknown
```

## 13.3 名称别名

例如：

```text
SO-8
SOIC-8
8-SOIC
D package
```

可指向同一标准封装候选，但必须保留厂商 code。

## 13.4 厂商 Package Code

例如 TI：

```text
D
DGK
DBV
P
RUG
```

ADI、ST、NXP 各有自己的代码。

不能跨厂商直接解释。

## 13.5 标准映射

可保存：

```text
JEDEC candidate
IPC package family
KiCad footprint family candidate
```

但未经审核不得宣称完全等价。

---

# 14. Package Variant 与器件关系

一个 Part 可支持多个 Package Variant。

一个 Package Variant 可服务多个 Ordering Code。

结构：

```text
Base Part
├── Package Variant A
│   ├── Ordering Code 1
│   └── Ordering Code 2
└── Package Variant B
    ├── Ordering Code 3
    └── Ordering Code 4
```

---

# 15. Ordering Code 体系

## 15.1 数据结构

```text
ordering_code_raw
ordering_code_normalized
base_part_number
family_part_number
die_variant
performance_grade
speed_grade
voltage_grade
package_code
pin_count
temperature_grade
quality_grade
packing_code
environmental_code
revision_code
custom_code
suffix_raw
parse_status
```

## 15.2 来源

优先：

1. Ordering Information 表；
2. Package Option Addendum；
3. Product Selection Guide；
4. Datasheet title/list；
5. Manufacturer product page metadata；
6. Distributor listing；
7. 后缀规则推断。

## 15.3 厂商 Profile

每个制造商有独立 parser：

```text
Texas Instruments
Analog Devices
STMicroelectronics
NXP
Infineon
Microchip
onsemi
Renesas
ROHM
MPS
Lattice
AMD/Xilinx
Intel PSG
```

## 15.4 规则示例

```yaml
manufacturer: texas_instruments
profile_version: ti-ordering-1.0.0

segments:
  package_code:
    source_priority:
      - ordering_table
      - package_addendum
  packing_code:
    mappings:
      R: tape_and_reel
      T: small_reel
```

规则不能假定固定长度，必须由证据驱动。

---

# 16. 后缀差异

后缀差异可能表示：

```text
package
temperature
speed
accuracy
memory size
voltage
automotive grade
AEC-Q100
RoHS/Green
packing type
reel quantity
revision
custom programming
```

## 16.1 差异输出

```json
{
  "base_part_number": "LM358",
  "ordering_variants": [
    {
      "ordering_code": "LM358D",
      "differences": {
        "package": "SOIC-8"
      }
    },
    {
      "ordering_code": "LM358DR",
      "differences": {
        "package": "SOIC-8",
        "packing": "tape_and_reel"
      }
    }
  ]
}
```

## 16.2 不确定后缀

输出：

```text
unknown_suffix_segment
review_required
```

不能自行赋义。

---

# 17. 温度与质量等级

## 17.1 温度等级

```text
commercial
industrial
extended_industrial
automotive
military
custom
unknown
```

保存：

```text
grade_name
temperature_range
source
```

## 17.2 质量等级

```text
standard
automotive
aec_q100
space
military
medical
high_reliability
unknown
```

## 17.3 环保与材料

```text
lead_free
rohs
green
halogen_free
pb_free
unknown
```

这些通常来自 Ordering Table 或 Package Addendum。

---

# 18. 包装方式

```text
tube
tray
tape_and_reel
cut_tape
small_reel
bulk
waffle_pack
bare_die_tray
unknown
```

保存：

```text
packing_type
standard_pack_quantity
reel_diameter
tape_width
packing_code
```

V1 可只抽取 packing_type 和 quantity。

---

# 19. Applicability 模型

每个 Pin/Package/Ordering 记录必须知道适用范围。

```text
document_default
family_group
part
part_variant
package_variant
ordering_code
temperature_grade
quality_grade
unknown
```

## 19.1 示例

某 Pin 表只适用于：

```text
STM32G431CBT6 in LQFP48
```

不能复制给 QFN32。

## 19.2 条件来源

- 表头；
- 子章节标题；
- 图注；
- Ordering Table；
- Package 标题；
- 型号列；
- 脚注；
- 文档范围说明。

---

# 20. Extraction Pipeline

```text
接收 locator.ready + schema.ready
    ↓
加载 Pin/Package/Ordering 目标
    ↓
加载 Pin 表和 Pinout 图
    ↓
识别 Package Variants
    ↓
解释多封装列
    ↓
构建 Package Pin Instances
    ↓
归并 Logical Pins
    ↓
解析 Pin Type / Alternate Functions
    ↓
图表交叉验证
    ↓
解析 Ordering Information
    ↓
应用厂商后缀 Profile
    ↓
绑定 Package / Temperature / Packing
    ↓
检测冲突与缺失
    ↓
生成 Catalog
    ↓
质量评分
    ↓
自动批准 / 人工审核
```

---

# 21. Agent 输入

## 21.1 事件

订阅：

```json
{
  "event_type": "datasheet.locator.ready",
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "section_map_uri": "s3://...",
  "table_catalog_uri": "s3://...",
  "figure_catalog_uri": "s3://...",
  "review_status": "approved"
}
```

关联：

```text
component.schema.ready
datasheet.parse.ready
component.parameters.ready（可选）
```

## 21.2 REST

`POST /api/v1/pin-package-ordering/jobs`

```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "parse_result_id": "uuid",
  "locator_result_id": "uuid",

  "canonical_ir_uri": "s3://...",
  "section_map_uri": "s3://...",
  "table_catalog_uri": "s3://...",
  "figure_catalog_uri": "s3://...",

  "component_category": "ic.processing.microcontroller",
  "schema_id": "component.mcu.arm-cortex-m.v2",

  "mode": "auto",
  "targets": [
    "pins",
    "packages",
    "ordering_variants"
  ],

  "policy": {
    "pin_policy_version": "pins-1.0.0",
    "package_registry_version": "packages-1.0.0",
    "ordering_profile_version": "ordering-1.0.0"
  },

  "idempotency_key": "uuid"
}
```

---

# 22. Agent 输出

```json
{
  "agent_id": "pin-package-ordering-extractor",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",

  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "part_ids": ["uuid"]
  },

  "results": {
    "pin_catalog_uri": "s3://.../pin_catalog.json.zst",
    "package_catalog_uri": "s3://.../package_catalog.json",
    "ordering_catalog_uri": "s3://.../ordering_catalog.json",
    "applicability_map_uri": "s3://.../applicability_map.json",
    "conflicts_uri": "s3://.../conflicts.json",
    "quality_report_uri": "s3://.../quality_report.json"
  },

  "summary": {
    "logical_pins": 48,
    "package_pin_instances": 80,
    "package_variants": 2,
    "ordering_variants": 8,
    "unknown_pin_types": 1,
    "unresolved_suffixes": 0,
    "conflicts": 2
  },

  "quality": {
    "pin_table_coverage": 0.98,
    "pinout_consistency": 0.96,
    "package_mapping_score": 0.95,
    "ordering_parse_score": 0.93,
    "overall_score": 0.95,
    "review_required": true,
    "review_reasons": [
      "pinout_table_conflict"
    ]
  }
}
```

---

# 23. PinCatalog 结构

```json
{
  "schema_version": "1.0.0",
  "logical_pins": [
    {
      "logical_pin_id": "lp-pa9",
      "name_raw": "PA9/USART1_TX/TIM1_CH2",
      "primary_name": "PA9",
      "normalized_name": "PA9",
      "active_level": "high",
      "electrical_type": "bidirectional",
      "qualifiers": [
        "5v_tolerant"
      ],
      "alternate_functions": [
        {
          "name": "USART1_TX",
          "function_type": "uart",
          "direction": "output"
        },
        {
          "name": "TIM1_CH2",
          "function_type": "timer",
          "direction": "bidirectional"
        }
      ],
      "description": "General-purpose I/O...",
      "evidence": []
    }
  ],

  "package_pin_instances": [
    {
      "package_pin_id": "pp-lqfp48-30",
      "package_variant_id": "pkg-lqfp48",
      "logical_pin_id": "lp-pa9",
      "pin_number_raw": "30",
      "pin_number_normalized": "30",
      "pad_number": "30",
      "ball_coordinate": null,
      "view_type": "top",
      "evidence": []
    }
  ]
}
```

---

# 24. PackageCatalog 结构

```json
{
  "package_variants": [
    {
      "package_variant_id": "pkg-lqfp48",
      "package_name_raw": "LQFP48",
      "package_name_normalized": "LQFP-48",
      "package_family": "LQFP",
      "manufacturer_package_code": "CB",
      "pin_count": 48,
      "pitch": {
        "value": "0.5",
        "unit": "mm"
      },
      "body_size": {
        "length": "7",
        "width": "7",
        "unit": "mm"
      },
      "exposed_pad": false,
      "package_drawing_figure_id": "fig-12",
      "land_pattern_figure_id": "fig-13",
      "applicable_part_ids": ["uuid"],
      "confidence": 0.96
    }
  ]
}
```

---

# 25. OrderingVariantCatalog 结构

```json
{
  "ordering_variants": [
    {
      "ordering_variant_id": "ov-1",
      "ordering_code_raw": "STM32G431CBT6",
      "ordering_code_normalized": "STM32G431CBT6",
      "base_part_number": "STM32G431",
      "device_variant": "CB",
      "package_variant_id": "pkg-lqfp48",
      "temperature_grade": {
        "code": "6",
        "name": "industrial",
        "range": {
          "lower": "-40",
          "upper": "85",
          "unit": "Cel"
        }
      },
      "packing_type": "tray",
      "quality_grade": "standard",
      "environmental": [],
      "suffix_segments": [
        {
          "raw": "CB",
          "meaning": "package_memory_variant",
          "confidence": 0.94
        },
        {
          "raw": "T",
          "meaning": "package",
          "confidence": 0.95
        },
        {
          "raw": "6",
          "meaning": "temperature_grade",
          "confidence": 0.96
        }
      ],
      "evidence": []
    }
  ]
}
```

---

# 26. 状态机

```text
RECEIVED
  ↓
LOADING_LOCATOR_RESULTS
  ↓
LOADING_SCHEMA_HINTS
  ↓
LOCATING_PIN_SOURCES
  ↓
DETECTING_PACKAGE_VARIANTS
  ↓
INTERPRETING_PIN_TABLES
  ↓
BUILDING_LOGICAL_PINS
  ↓
BUILDING_PACKAGE_PIN_INSTANCES
  ↓
PARSING_PIN_TYPES
  ↓
PARSING_ALTERNATE_FUNCTIONS
  ↓
CROSS_VALIDATING_PINOUTS
  ↓
PARSING_ORDERING_TABLES
  ↓
APPLYING_MANUFACTURER_PROFILES
  ↓
RESOLVING_APPLICABILITY
  ↓
DETECTING_CONFLICTS
  ↓
BUILDING_CATALOGS
  ↓
QUALITY_EVALUATING
  ↓
STORING_RESULTS
  ↓
COMPLETED
```

分支：

```text
REVIEW_REQUIRED
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 27. Pin Type 规则

## 27.1 显式映射

```yaml
rule_id: pin.type.input.001
when:
  source: pin_type_cell
  any_normalized:
    - input
    - in
    - i
target: input
confidence: 0.99
```

## 27.2 组合类型

```text
I/O
IO
bidirectional
input/output
```

映射为 `bidirectional`。

## 27.3 推断规则

```yaml
rule_id: pin.type.power.001
when:
  source: pin_name
  regex: '^(VDD|VCC|AVDD|DVDD)$'
target: power_input
source_type: inferred
confidence: 0.85
```

推断优先级低于显式表格。

---

# 28. Package Registry

必须有受控 Package Registry：

```text
package_id
family
aliases
pin_count
pitch
body_size
lead_style
mounting_type
standard_candidates
kicad_family_candidates
manufacturer_codes
```

## 28.1 Registry 版本化

```text
packages-1.0.0
packages-1.1.0
```

## 28.2 新封装流程

```text
discovered
→ candidate
→ review
→ approved
→ registry version
```

运行时不能直接创建正式封装标准。

---

# 29. 厂商 Ordering Profile

目录：

```text
ordering-profiles/
├── texas-instruments.yaml
├── analog-devices.yaml
├── stmicroelectronics.yaml
├── nxp.yaml
├── infineon.yaml
├── microchip.yaml
├── onsemi.yaml
├── renesas.yaml
├── rohm.yaml
├── mps.yaml
├── lattice.yaml
├── xilinx-amd.yaml
└── intel-psg.yaml
```

每个 Profile 包含：

```text
base part extraction
package code mapping
temperature code mapping
packing code mapping
quality grade mapping
environmental code mapping
suffix precedence
exception patterns
evidence requirements
```

---

# 30. 冲突类型

```text
pin_count_mismatch
pin_number_conflict
pin_name_conflict
pin_type_conflict
pinout_table_conflict
duplicate_pin_number
missing_pin_number
package_pin_count_mismatch
package_code_conflict
ordering_code_conflict
suffix_parse_conflict
temperature_grade_conflict
packing_code_conflict
applicability_conflict
exposed_pad_conflict
top_bottom_view_conflict
```

---

# 31. 校验规则

## 31.1 Pin Count

```text
package_pin_instances + exposed_pad policy
```

必须与 package pin_count 兼容。

## 31.2 唯一性

普通封装中：

```text
package_variant_id + pin_number
```

应唯一。

## 31.3 BGA

Ball coordinate 应唯一。

## 31.4 Duplicates

同一 Pin Name 可以重复，Pin Number 不能无故重复。

## 31.5 EP

若 Package 描述包含 EP，但 Pin 表无 EP，进入审核。

## 31.6 Package/Ordering

Ordering Code 指定的 package code 必须能映射到 Package Variant。

---

# 32. 质量评分

## 32.1 Pin

```text
pin_name_coverage
pin_number_coverage
pin_type_coverage
description_coverage
alternate_function_coverage
pinout_consistency
```

## 32.2 Package

```text
package_name_confidence
pin_count_consistency
package_code_mapping
drawing_linkage
land_pattern_linkage
```

## 32.3 Ordering

```text
ordering_table_coverage
base_part_accuracy
package_suffix_accuracy
temperature_grade_accuracy
packing_code_accuracy
```

## 32.4 强制审核

- Pin Count 不一致；
- Pinout 图与 Pin 表冲突；
- 多封装列无法解析；
- EP 缺失或冲突；
- Top/Bottom View 不明确；
- Package Code 无法映射；
- Ordering Code 后缀歧义；
- 同一后缀出现多个解释；
- Family 型号适用关系不清；
- DNC/NC 不明确；
- Active-low 名称解析冲突；
- BGA Ball 重复；
- 不同封装的 Pin Map 被错误合并。

---

# 33. 数据模型

## 33.1 `pin_package_ordering_jobs`

```text
id UUID PK
document_id UUID NOT NULL
version_id UUID NOT NULL
parse_result_id UUID NOT NULL
locator_result_id UUID NOT NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
pin_policy_version VARCHAR NOT NULL
package_registry_version VARCHAR NOT NULL
ordering_profile_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 33.2 `pin_package_ordering_results`

```text
id UUID PK
job_id UUID NOT NULL
pin_catalog_uri TEXT NOT NULL
package_catalog_uri TEXT NOT NULL
ordering_catalog_uri TEXT NOT NULL
applicability_map_uri TEXT NOT NULL
conflicts_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 33.3 `logical_pin_index`

```text
id UUID PK
result_id UUID NOT NULL
logical_pin_id VARCHAR NOT NULL
part_id UUID NULL
primary_name VARCHAR NOT NULL
normalized_name VARCHAR NOT NULL
electrical_type VARCHAR NOT NULL
function_types JSONB NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, logical_pin_id)
```

## 33.4 `package_pin_instance_index`

```text
id UUID PK
result_id UUID NOT NULL
package_pin_id VARCHAR NOT NULL
package_variant_id VARCHAR NOT NULL
logical_pin_id VARCHAR NULL
pin_number_raw VARCHAR NOT NULL
pin_number_normalized VARCHAR NOT NULL
pad_number VARCHAR NULL
ball_coordinate VARCHAR NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, package_pin_id)
```

## 33.5 `package_variant_index`

```text
id UUID PK
result_id UUID NOT NULL
package_variant_id VARCHAR NOT NULL
package_family VARCHAR NOT NULL
package_name_normalized VARCHAR NOT NULL
manufacturer_package_code VARCHAR NULL
pin_count INT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, package_variant_id)
```

## 33.6 `ordering_variant_index`

```text
id UUID PK
result_id UUID NOT NULL
ordering_variant_id VARCHAR NOT NULL
ordering_code_normalized VARCHAR NOT NULL
base_part_number VARCHAR NOT NULL
package_variant_id VARCHAR NULL
temperature_grade VARCHAR NULL
packing_type VARCHAR NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, ordering_variant_id)
```

## 33.7 `pin_package_ordering_reviews`

```text
id UUID PK
job_id UUID NOT NULL
object_type VARCHAR NOT NULL
object_id VARCHAR NOT NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
assigned_to VARCHAR NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 34. 产物存储

```text
derived/pin-package-ordering/
  {source_sha256}/
    {policy_bundle_hash}/
      pins/
        pin_catalog.json.zst
        logical_pins.json
        package_pin_instances.json.zst
      packages/
        package_catalog.json
        package_groups.json
      ordering/
        ordering_catalog.json
        suffix_parse_log.json
      applicability/
        applicability_map.json
      evidence/
        table_rows/
        pinout_overlays/
        ordering_snapshots/
      debug/
        column_roles.json
        pin_name_parse.json
        package_mapping.json
        suffix_candidates.json
      conflicts.json
      quality_report.json
      result_manifest.json
```

---

# 35. API

## 35.1 写接口

```text
POST /api/v1/pin-package-ordering/jobs
POST /api/v1/pin-package-ordering/batches
POST /api/v1/pin-package-ordering/jobs/{job_id}/retry
POST /api/v1/pin-package-ordering/jobs/{job_id}/cancel
POST /api/v1/pin-package-ordering/jobs/{job_id}/rerun-target
POST /api/v1/pin-package-ordering/jobs/{job_id}/reparse-ordering-code
POST /api/v1/pin-package-ordering/reviews/{review_id}/resolve

POST /api/v1/package-registry/validate
POST /api/v1/package-registry/publish
POST /api/v1/ordering-profiles/validate
POST /api/v1/ordering-profiles/publish
```

## 35.2 读接口

```text
GET /api/v1/pin-package-ordering/jobs/{job_id}
GET /api/v1/pin-package-ordering/jobs/{job_id}/events
GET /api/v1/pin-package-ordering/results/{result_id}

GET /api/v1/components/{part_id}/pins
GET /api/v1/components/{part_id}/packages
GET /api/v1/components/{part_id}/ordering-variants

GET /api/v1/packages/{package_variant_id}/pins
GET /api/v1/ordering-variants/{ordering_variant_id}

GET /api/v1/package-registry
GET /api/v1/ordering-profiles
GET /api/v1/pin-package-ordering-reviews

GET /health/live
GET /health/ready
GET /metrics
```

---

# 36. 错误码

```text
LOCATOR_RESULT_NOT_FOUND
PIN_TABLE_NOT_FOUND
PINOUT_FIGURE_NOT_FOUND
PIN_TABLE_STRUCTURE_INVALID
PIN_COLUMN_ROLE_UNRESOLVED
PIN_NUMBER_PARSE_FAILED
PIN_NAME_PARSE_FAILED
PIN_TYPE_UNKNOWN
PIN_TYPE_CONFLICT
PINOUT_TABLE_CONFLICT
PACKAGE_NOT_FOUND
PACKAGE_CODE_UNKNOWN
PACKAGE_PIN_COUNT_MISMATCH
PACKAGE_MAPPING_CONFLICT
ORDERING_TABLE_NOT_FOUND
ORDERING_CODE_PARSE_FAILED
ORDERING_SUFFIX_UNKNOWN
ORDERING_PROFILE_NOT_FOUND
TEMPERATURE_GRADE_UNKNOWN
PACKING_CODE_UNKNOWN
APPLICABILITY_UNRESOLVED
EXPOSED_PAD_CONFLICT
BGA_COORDINATE_INVALID
TOP_BOTTOM_VIEW_AMBIGUOUS
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 37. 人工审核界面

## 37.1 Pin 审核

显示：

- Pin 表；
- Pinout 图；
- Pin Number；
- Pin Name；
- Pin Type；
- Description；
- Alternate Functions；
- Package；
- 图表差异。

操作：

- 修改 Pin Number；
- 修改 Pin Name；
- 选择 Pin Type；
- 添加/删除 Alternate Function；
- 绑定 Package；
- 标记 NC/DNC/Reserved；
- 标记 EP；
- 合并/拆分 Logical Pin。

## 37.2 Package 审核

显示：

- Package Drawing；
- Package 名称；
- 厂商 Code；
- Pin Count；
- Pitch；
- Body Size；
- Land Pattern；
- Ordering Variants。

## 37.3 Ordering 审核

显示：

- Ordering Table；
- 原始型号；
- 分段结果；
- Package；
- Temperature；
- Packing；
- 后缀解释；
- Profile Rule。

操作：

- 修改 segment；
- 标记 unknown；
- 添加 manufacturer exception；
- 绑定 Package Variant。

## 37.4 Patch

所有人工修改使用 Patch，不覆盖原始抽取结果。

---

# 38. 可观测性

## 38.1 Prometheus

```text
pin_package_jobs_total{status,mode}
pin_extracted_total{electrical_type}
pin_unknown_type_total
pin_conflicts_total{type}
package_variants_total{family}
package_mapping_failures_total{manufacturer}
ordering_variants_total{manufacturer}
ordering_suffix_unknown_total{manufacturer,suffix}
ordering_parse_conflicts_total{type}
pin_package_review_total{object_type,reason}
pinout_consistency_score
package_pin_count_mismatch_total
pin_package_cache_hits_total
```

## 38.2 Dashboard

展示：

- 每日处理器件；
- Pin Type 覆盖率；
- Unknown Pin Type 排名；
- Pinout/Table 冲突；
- Package 映射率；
- 未知厂商 Package Code；
- Ordering 后缀解析率；
- 未知后缀排名；
- Family Datasheet 冲突率；
- EP 缺失率；
- 人工修正率；
- 厂商 Profile 质量。

---

# 39. 测试集

公开仓库只使用合成或授权 Fixture。

## 39.1 Pin

1. 8-pin op amp；
2. Dual op amp；
3. Quad op amp；
4. MCU LQFP48；
5. MCU QFN32；
6. BGA；
7. WLCSP；
8. Active-low；
9. Differential pair；
10. Multiple VDD；
11. Multiple GND；
12. NC；
13. DNC；
14. Reserved；
15. EP；
16. Multiple functions；
17. Open-drain；
18. Analog input；
19. 5V tolerant；
20. Reset state；
21. Pin name inherited；
22. Unit 表格跨页；
23. 多封装列；
24. 表格与 pinout 一致；
25. 表格与 pinout 冲突；
26. Top View；
27. Bottom View；
28. BGA ball duplicate；
29. Pin range；
30. Missing pin number。

## 39.2 Package

31. SOIC8；
32. TSSOP8；
33. QFN32 EP；
34. LQFP48；
35. BGA144；
36. WLCSP25；
37. SOT23-5；
38. TO-220；
39. 一页多封装；
40. 厂商 code；
41. JEDEC 候选；
42. Pin Count 冲突；
43. Package 名别名；
44. Land Pattern；
45. Tape and Reel。

## 39.3 Ordering

46. TI；
47. ADI；
48. ST；
49. NXP；
50. Microchip；
51. onsemi；
52. Infineon；
53. Renesas；
54. MPS；
55. FPGA speed grade；
56. Temperature grade；
57. Automotive；
58. Reel；
59. Tray；
60. Tube；
61. RoHS；
62. Green；
63. Unknown suffix；
64. Same base part multiple packages；
65. Same package multiple packing codes；
66. Family table；
67. Package Addendum；
68. Distributor code conflict；
69. Ordering code split ambiguity；
70. Manual override。

---

# 40. Benchmark

## 40.1 Pin 指标

- Pin Number Accuracy；
- Pin Name Accuracy；
- Pin Type Macro F1；
- Pin Description Coverage；
- Alternate Function F1；
- Logical-to-Physical Mapping Accuracy；
- NC/DNC Accuracy；
- EP Detection Recall；
- Pinout Consistency Accuracy。

## 40.2 Package 指标

- Package Family Accuracy；
- Package Code Accuracy；
- Pin Count Accuracy；
- Pitch Accuracy；
- Body Size Accuracy；
- Package-to-Part Mapping Accuracy。

## 40.3 Ordering 指标

- Base Part Accuracy；
- Package Suffix Accuracy；
- Temperature Grade Accuracy；
- Packing Code Accuracy；
- Quality Grade Accuracy；
- Full Ordering Code Parse Accuracy；
- Unknown Suffix Precision/Recall。

## 40.4 分组报告

按：

- 厂商；
- 器件类别；
- 封装类型；
- 文档语言；
- Family/单型号；
- 表格/图片来源；
- 解析器；
- Profile 版本。

---

# 41. 初始质量目标

```text
Pin Number Accuracy >= 99%
Pin Name Accuracy >= 98%
Pin Type Macro F1 >= 95%
Logical-to-Physical Mapping Accuracy >= 98%
EP Detection Recall >= 95%

Package Family Accuracy >= 98%
Package Code Accuracy >= 95%
Pin Count Accuracy >= 99%

Base Part Accuracy >= 98%
Package Suffix Accuracy >= 95%
Temperature Grade Accuracy >= 95%
Packing Code Accuracy >= 95%
高置信度自动批准准确率 >= 98%
```

这些是目标，不是未经测试的保证。

---

# 42. 工程验收标准

## 42.1 功能

- 能消费 locator.ready；
- 能读取 Pin 表和 Pinout 图；
- 能处理多封装列；
- 能建立 Logical Pin；
- 能建立 Package Pin Instance；
- 能解析 Pin Type；
- 能解析 Alternate Function；
- 能处理 NC/DNC/Reserved；
- 能处理 EP；
- 能处理 BGA；
- 能建立 Package Variant；
- 能解析 Ordering Code；
- 能解析温度/包装后缀；
- 能处理 Family；
- 能图表交叉验证；
- 能输出证据；
- 能进入审核；
- 能 Patch；
- 能发布下游事件；
- 所有写操作幂等。

## 42.2 工程质量

- 单元测试覆盖率 >= 85%；
- Pin Number/Name Parser >= 95%；
- Package Mapping >= 95%；
- Ordering Suffix Parser >= 95%；
- 所有 Profile 有测试；
- JSON Schema 通过；
- Migration upgrade/downgrade 通过；
- Ruff 通过；
- mypy 通过；
- 不提交真实 Datasheet；
- 不伪造准确率。

## 42.3 性能

- 不重新解析整本 PDF；
- 优先处理目标章节；
- Family Datasheet 只解析一次；
- 同一输入和策略命中缓存；
- Ordering Profile 更新只重跑受影响厂商；
- Package Registry 更新只重映射；
- 典型 50 页 Datasheet 目标小于 15 秒，不含上游 PDF 解析。

---

# 43. 缓存与增量更新

缓存键：

```text
source_sha256
+ locator_result_version
+ schema_hash
+ pin_policy_version
+ package_registry_version
+ ordering_profile_version
```

## 43.1 Profile 变化

- package mapping 变化 → 只重映射 package；
- suffix rule 变化 → 只重解析 ordering；
- pin type rule 变化 → 只重分类 pin type；
- applicability rule 变化 → 只重绑定 part/package。

---

# 44. 推荐仓库结构

```text
pin-package-ordering-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── pin-package-ordering-agent-spec.md
│   ├── logical-physical-pin-model.md
│   ├── pin-type-taxonomy.md
│   ├── package-registry.md
│   ├── ordering-profile.md
│   ├── family-applicability.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-logical-physical-pin-separation.md
│       ├── 0002-package-variant-first.md
│       ├── 0003-manufacturer-specific-ordering-profile.md
│       └── 0004-no-external-llm-v1.md
├── src/
│   └── pin_package_ordering/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── pins/
│       │   ├── source_planner.py
│       │   ├── table_interpreter.py
│       │   ├── number_parser.py
│       │   ├── name_parser.py
│       │   ├── type_classifier.py
│       │   ├── function_parser.py
│       │   ├── logical_pin_builder.py
│       │   ├── package_pin_builder.py
│       │   ├── differential_pairs.py
│       │   └── active_low.py
│       ├── pinout/
│       │   ├── validator.py
│       │   ├── orientation.py
│       │   └── overlay.py
│       ├── packages/
│       │   ├── registry.py
│       │   ├── normalizer.py
│       │   ├── mapper.py
│       │   ├── exposed_pad.py
│       │   └── applicability.py
│       ├── ordering/
│       │   ├── source_planner.py
│       │   ├── parser.py
│       │   ├── segmenter.py
│       │   ├── profile_loader.py
│       │   ├── temperature.py
│       │   ├── packing.py
│       │   ├── quality_grade.py
│       │   └── suffix_conflicts.py
│       ├── family/
│       │   ├── groups.py
│       │   ├── variants.py
│       │   └── applicability.py
│       ├── evidence/
│       ├── quality/
│       ├── review/
│       ├── storage/
│       └── observability/
├── policies/
├── package-registry/
├── ordering-profiles/
├── schemas/
│   ├── pin-catalog.schema.json
│   ├── package-catalog.schema.json
│   ├── ordering-catalog.schema.json
│   └── applicability-map.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── pins/
│   ├── pinout/
│   ├── packages/
│   ├── ordering/
│   ├── family/
│   ├── regression/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── compile_package_registry.py
    ├── validate_ordering_profiles.py
    ├── run_pin_package_benchmark.py
    ├── compare_profile_versions.py
    └── export_review_dataset.py
```

---

# 45. Codex 分阶段实施

不要一次完成全部功能。

## Phase 0：仓库侦察与数据模型对齐

Codex 必须：

1. 阅读前五个 Agent；
2. 打开实际 Canonical IR；
3. 打开 SectionMap/TableCatalog/FigureCatalog；
4. 查找 ezPLM 当前 Pin、Package、Ordering 数据表；
5. 查找 KiCad symbol/footprint 映射数据；
6. 查找现有 20k symbol、20k footprint、90 万 package mapping；
7. 查找现有厂商后缀解析规则；
8. 输出实施计划；
9. 输出旧数据迁移方案；
10. 输出 Package Registry 方案；
11. 输出 Manufacturer Ordering Profile 方案；
12. 不修改业务代码；
13. 不创建 Migration；
14. 不安装依赖。

## Phase 1：领域模型与 JSON Schema

实现：

- Logical Pin；
- Package Pin Instance；
- Alternate Function；
- Package Variant；
- Ordering Variant；
- Applicability；
- Conflict；
- Job/Result/Event；
- JSON Schema。

## Phase 2：Pin Number 与 Pin Name Parser

实现：

- numeric；
- alphanumeric；
- BGA；
- EP；
- ranges；
- active-low；
- differential pair；
- multi-function split；
- raw preservation。

## Phase 3：Pin 表格解释

实现：

- column roles；
- multi-package columns；
- row inheritance；
- merged cells；
- cross-page；
- PinCatalog baseline。

## Phase 4：Pin Type 与 Function

实现：

- explicit type；
- inferred type；
- qualifiers；
- alternate functions；
- NC/DNC；
- reset state；
- power domain。

## Phase 5：Logical/Physical Pin 构建

实现：

- logical pin merge；
- repeated power pins；
- package-specific instances；
- duplicate detection；
- applicability。

## Phase 6：Pinout 图交叉验证

实现：

- pin labels；
- pin number；
- top/bottom view；
- EP；
- consistency checks；
- overlays；
- conflicts。

## Phase 7：Package Registry 与 Package Mapping

实现：

- package family；
- aliases；
- manufacturer code；
- pin count；
- pitch/body size；
- package drawing；
- land pattern；
- registry compiler。

## Phase 8：Ordering Source 与基础解析

实现：

- ordering table；
- package addendum；
- base part；
- package code；
- temperature；
- packing；
- raw segments。

## Phase 9：Manufacturer Profiles

实现：

- TI；
- ADI；
- ST；
- NXP；
- Microchip；
- onsemi；
- MPS；
- exceptions；
- profile tests。

## Phase 10：Family 与后缀差异

实现：

- family groups；
- part/package applicability；
- suffix differences；
- variant compare；
- unresolved review。

## Phase 11：冲突、质量和审核

实现：

- conflict engine；
- quality scorer；
- review API；
- Patch；
- profile proposal；
- registry proposal。

## Phase 12：完整 API、事件、批处理和缓存

实现：

- API；
- events；
- batches；
- retry/cancel；
- rerun target；
- incremental reprocess；
- idempotency。

## Phase 13：Benchmark、监控与生产发布

实现：

- benchmark；
- metrics；
- dashboard；
- README；
- ops；
- profile upgrade；
- registry rollback。

---

# 46. Codex 工作纪律

Codex 必须：

1. 不重新解析整本 PDF；
2. Logical Pin 与 Package Pin 分离；
3. Pin Type 与 Function 分离；
4. 不机械复制 Family Pin Map；
5. 不把不同封装合并；
6. 不忽略 EP；
7. 不混淆 NC 与 DNC；
8. 不把 Top View 当 Bottom View；
9. 不仅凭 Pin Name 推断 Type；
10. 推断必须标记来源；
11. 不仅凭字符串长度解析 Ordering Code；
12. Manufacturer Profile 必须独立；
13. Package Registry 版本化；
14. Ordering Profile 版本化；
15. 所有结果带 evidence；
16. 不调用外部通用 LLM；
17. 不用 LLM 猜缺失 Pin 或后缀；
18. 不覆盖原始结果；
19. 不覆盖人工 Patch；
20. 不提交真实 Datasheet；
21. 不伪造准确率；
22. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Registry/Profile 变化；
    - 测试命令；
    - 真实测试结果；
    - Benchmark；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 47. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pin-package-ordering-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第六个基础 Agent：

Pin, Package & Ordering Variant Extraction Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. 前五个 Agent 的完整规格；
3. docs/pin-package-ordering-agent-spec.md；
4. 前五个 Agent 的实际代码、事件和 Schema；
5. 当前 Canonical IR；
6. 当前 SectionMap、TableCatalog、FigureCatalog；
7. ezPLM 当前物料、Pin、Package、Ordering 数据表；
8. 当前 KiCad symbol、footprint、3D 和 package mapping 数据；
9. 当前数据库、对象存储、任务队列、审核、日志、Docker 和 CI。

本 Agent 的职责是：

- 消费 datasheet.locator.ready；
- 读取 Pin Description、Pin Functions、Pin Configuration、Package、Ordering Information；
- 抽取 Pin Number、Pin Name、Pin Type、Pin Description；
- 抽取 Alternate Functions、Differential Pair、Active-low、NC、DNC、Reserved、EP；
- 建立 Logical Pin 与 Package Pin Instance；
- 处理同一器件不同封装的 Pin Map；
- 处理 BGA Ball；
- 从 Pinout 图交叉验证 Pin 表；
- 抽取 Package Variant、Package Code、Pin Count、Pitch、Body Size；
- 抽取 Ordering Code；
- 拆分 Base Part、Package、Temperature、Packing、Quality、Environmental 后缀；
- 处理 Family Datasheet 和后缀差异；
- 输出 PinCatalog、PackageCatalog、OrderingVariantCatalog 和 ApplicabilityMap；
- 低置信度和冲突进入审核；
- 发布 component.pin-package-ordering.ready。

硬约束：

- Logical Pin 与 Package Pin Instance 必须分离；
- Pin Type 与 Pin Function 必须分离；
- 原始名称与标准名称分离；
- 不同封装必须分别建模；
- Family Datasheet 不得机械复制；
- EP 是一等对象；
- NC 与 DNC 必须区分；
- Top View 与 Bottom View 必须区分；
- BGA Ball 必须结构化；
- 推断 Pin Type 必须标记 inferred；
- 不仅凭 Pin Name 作为最终证据；
- Package Registry 必须受控、版本化；
- Manufacturer Ordering Profile 必须独立、版本化；
- 不允许跨厂商复用后缀意义；
- 不仅凭字符串长度解析 Ordering Code；
- 所有结果必须有 page、bbox、table/figure evidence；
- 不重新做整本 PDF OCR；
- V1 不调用外部通用大模型；
- 不用 LLM 猜缺失 Pin、Package 或后缀；
- PostgreSQL 不存完整 Catalog；
- 不覆盖原始结果；
- 不覆盖人工审核结果；
- 不提交真实受版权保护 Datasheet；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察仓库；
2. 检查前五个 Agent 的实际完成程度；
3. 打开实际 Canonical IR；
4. 打开实际 SectionMap、TableCatalog、FigureCatalog；
5. 查找现有 Pin、Package、Ordering 数据结构；
6. 查找 KiCad symbol、footprint、3D 和 package mapping 数据；
7. 识别现有 Logical/Physical Pin 模型；
8. 识别现有 Package Registry 或别名表；
9. 识别现有 Manufacturer Suffix Rules；
10. 在 docs/pin-package-ordering-implementation-plan.md 中生成实施计划；
11. 在 docs/logical-physical-pin-model.md 中生成模型设计；
12. 在 docs/package-registry-design.md 中生成 Package Registry 方案；
13. 在 docs/manufacturer-ordering-profile-design.md 中生成后缀 Profile 方案；
14. 在 docs/pin-package-ordering-migration-plan.md 中生成旧数据迁移方案；
15. 在 docs/pin-package-ordering-benchmark-plan.md 中生成 Benchmark；
16. 给出拟新增、拟修改和拟复用文件清单；
17. 给出 Phase 1 精确修改范围；
18. 不修改业务代码；
19. 不创建 Migration；
20. 不安装依赖；
21. 运行当前仓库已有 lint、type check 和测试。

最终回复必须包含：

- 仓库现状；
- 与前五个 Agent 的衔接；
- 当前 Pin 数据模型；
- 当前 Package 数据模型；
- 当前 Ordering 数据模型；
- Logical/Physical Pin 方案；
- Package Registry 方案；
- Manufacturer Profile 方案；
- Family/Package Applicability；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 48. 后续 Phase 提示词模板

```text
继续实现 Pin, Package & Ordering Variant Extraction Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读六个 Agent 的规格；
3. 阅读 Implementation Plan；
4. 阅读 Logical/Physical Pin Model；
5. 阅读 Package Registry Design；
6. 阅读 Manufacturer Ordering Profile Design；
7. 检查上一阶段代码和测试；
8. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Logical/Physical Pin 分离；
- Pin Type/Function 分离；
- 不同 Package 分离；
- Family 不机械复制；
- EP、NC、DNC 正确处理；
- Manufacturer Profile 独立；
- 所有结果带 evidence；
- 不依赖外部 LLM；
- 不覆盖原始或人工结果；
- 不提交真实 Datasheet；
- 不重构无关代码。

执行顺序：

1. 列出实施步骤；
2. 编写或更新测试；
3. 实现代码；
4. 运行格式化；
5. 运行 lint；
6. 运行 type check；
7. 运行单元测试；
8. 运行集成测试；
9. 运行回归测试；
10. 运行必要性能测试；
11. 更新文档；
12. 总结修改。

最终回复：

- 修改文件；
- Schema/API 变化；
- Package Registry/Profile 变化；
- 测试命令和真实结果；
- 质量指标；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 49. MVP 演示流程

1. LM358 Family Datasheet；
2. 提取 SOIC8、TSSOP8、DIP8；
3. 提取 Pin Number、Name、Type、Description；
4. 识别 VCC、GND、IN+、IN-、OUT；
5. 生成三个 Package Pin Map；
6. 解析 LM358D、LM358DR、LM358P；
7. 识别 D=SOIC、R=Tape/Reel、P=DIP；
8. STM32 Family Datasheet；
9. 提取 LQFP48 与 QFN32；
10. 识别 PA9/USART1_TX/TIM1_CH2；
11. 分离 Logical Pin 与 Alternate Function；
12. 识别多个 VDD/GND；
13. 识别 EP；
14. 比较 Pin 表与 Pinout 图；
15. 模拟冲突进入审核；
16. BGA 器件解析 A1/B2；
17. MOSFET 解析 Gate/Drain/Source；
18. QFN EP 绑定 GND；
19. Ordering Code 拆分温度与包装；
20. Unknown suffix 进入审核；
21. 人工 Patch；
22. 发布下游事件。

---

# 50. 下游事件

```json
{
  "event_type": "component.pin-package-ordering.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "result_id": "uuid",
  "pin_catalog_uri": "s3://.../pin_catalog.json.zst",
  "package_catalog_uri": "s3://.../package_catalog.json",
  "ordering_catalog_uri": "s3://.../ordering_catalog.json",
  "applicability_map_uri": "s3://.../applicability_map.json",
  "quality_report_uri": "s3://.../quality_report.json",
  "overall_quality": 0.95,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

下游自动消费条件：

```text
review_status = approved
AND no blocking pin/package conflicts
AND package pin count is consistent
AND ordering applicability is resolved
```
