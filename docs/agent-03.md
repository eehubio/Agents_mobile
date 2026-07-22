# 器件分类与 Schema 路由 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Component Classification & Schema Routing Agent  
> 版本：V1.0  
> 定位：规则优先、模型辅助的基础数据 Agent  
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
>
> 下游：
> - 章节与表格定位 Agent
> - 参数抽取 Agent
> - 引脚与封装抽取 Agent
> - 生命周期与合规 Agent
> - 替代料推荐 Agent
> - KiCad 符号/封装生成 Agent
>
> 目标读者：产品负责人、数据工程师、后端工程师、算法工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的“器件分类与 Schema 路由 Agent”。

该 Agent 接收一个器件或一份 Datasheet 的标准化资产和解析结果，判断器件属于哪个类别，例如：

- MCU；
- MPU；
- FPGA；
- 运算放大器；
- 比较器；
- ADC；
- DAC；
- LDO；
- DC-DC；
- MOSFET；
- IGBT；
- 二极管；
- EEPROM；
- Flash；
- 电流传感器；
- 温度传感器；
- IMU；
- 光传感器；
- 接口收发器；
- 时钟芯片；
- 连接器；
- 无源器件；
- 模块；
- 其他电子器件。

随后基于器件类别选择：

1. 参数 Schema；
2. 参数抽取规则集；
3. 必填参数；
4. 可选参数；
5. 单位体系；
6. 枚举值；
7. 数据校验规则；
8. 章节与表格定位提示；
9. 引脚角色规则；
10. 封装规则；
11. 后续抽取 Agent 的执行计划。

最终输出一个可追溯的 `ClassificationDecision` 与 `SchemaRoutingPlan`。

---

# 2. 核心定位

本 Agent 不是简单地回答“这个器件是什么”。

它必须完成三个独立职责：

```text
器件分类
    ↓
Schema Registry 选择
    ↓
抽取与校验规则路由
```

## 2.1 器件分类

判断：

- 一级类别；
- 二级类别；
- 三级子类；
- 功能标签；
- 多功能角色；
- 是否属于模块、芯片、分立器件或无源器件；
- 是否属于组合器件；
- 是否存在歧义。

例如：

```text
Part: STM32G431CBT6

一级：Integrated Circuit
二级：Microcontroller
三级：ARM Cortex-M MCU
标签：
- mixed_signal
- motor_control
- usb
- adc_integrated
```

又例如：

```text
Part: LM358

一级：Integrated Circuit
二级：Analog
三级：Operational Amplifier
标签：
- dual_channel
- low_power
- general_purpose
```

## 2.2 Schema Registry 选择

分类结果不应直接写死到代码。

必须通过版本化 Schema Registry 路由到：

```text
schema_id
schema_version
parameter_set
unit_rules
enum_rules
validation_rules
requiredness
extraction_hints
```

例如：

```text
component.opamp.general.v1
component.mcu.arm-cortex-m.v2
component.adc.sar.v1
component.regulator.ldo.v1
component.transistor.mosfet.n-channel.v2
component.sensor.temperature.digital.v1
```

## 2.3 抽取规则路由

除了 Schema，还要选择后续抽取策略，例如：

```text
查找章节：
- Features
- Electrical Characteristics
- Recommended Operating Conditions
- Pin Configuration
- Ordering Information

查找表格：
- Electrical Characteristics
- Absolute Maximum Ratings
- Pin Functions

参数抽取优先级：
1. Electrical Characteristics 表
2. Features
3. Product Summary
4. Ordering Information
```

---

# 3. 与前两个 Agent 的边界

## 3.1 第一个 Agent 输出

`Datasheet Asset Ingestion Agent` 已完成：

- PDF 真实性验证；
- SHA256 去重；
- Datasheet 文档和版本管理；
- 制造商和型号初步关联；
- Family Datasheet 初步识别；
- 输出 `datasheet.asset.ready`。

## 3.2 第二个 Agent 输出

`PDF Parsing & OCR Routing Agent` 已完成：

- 原生/扫描/混合 PDF 识别；
- Docling、MinerU、OCR 路由；
- Canonical Document IR；
- 文本、表格、图片、标题、层级、bbox；
- 解析质量报告；
- 输出 `datasheet.parse.ready`。

## 3.3 本 Agent 输入

本 Agent 不直接解析 PDF 二进制。

它应优先读取：

- 元器件主数据；
- 制造商；
- MPN；
- 上游已识别的 Datasheet 类型；
- Canonical Document IR；
- 文档标题；
- 文档前若干页文本；
- Features；
- Product Description；
- Ordering Information；
- 已有分类；
- 厂商官网分类；
- 分销商分类；
- 现有 ezPLM 分类树。

## 3.4 本 Agent 不负责

V1 不负责：

- 抽取所有参数值；
- OCR；
- 表格恢复；
- 引脚表详细提取；
- 封装与 3D 生成；
- 替代料计算；
- 电路功能理解；
- 原理图分析；
- 创建未经确认的正式新类别；
- 自动修改全局分类树；
- 自由生成 Schema；
- 使用 LLM 直接决定最终分类且无证据。

---

# 4. 设计原则

## 4.1 分类树与参数 Schema 分离

分类树回答：

> 这个器件是什么？

Schema 回答：

> 这个器件需要抽取哪些参数，如何校验？

同一个分类可以有多个 Schema 版本。

不同分类也可以共享基础 Schema。

例如：

```text
Operational Amplifier
├── General Purpose Op Amp
├── Precision Op Amp
├── High Speed Op Amp
└── Low Power Op Amp
```

它们可以继承同一个基础 Schema：

```text
component.opamp.base.v1
```

再叠加扩展：

```text
component.opamp.precision.v1
component.opamp.high_speed.v1
```

## 4.2 规则优先，模型辅助

分类优先级：

1. 已审核人工分类；
2. 制造商官方分类映射；
3. 现有 ezPLM 分类；
4. 结构化规则；
5. 型号系列规则；
6. Datasheet 标题和 Features；
7. 文档关键词；
8. 轻量机器学习分类器；
9. 小模型/大模型辅助；
10. 人工审核。

不应一开始就让大模型对 110 万型号逐个分类。

## 4.3 支持层级分类

分类至少支持三级：

```text
Level 1：器件大类
Level 2：功能类别
Level 3：具体子类
```

建议支持最多 5 级，但 V1 的业务逻辑以三级为主。

## 4.4 支持多标签，不支持多主类

一个器件只能有一个 `primary_category`，但可以有多个 `functional_tags`。

例如 MCU 同时含：

- ADC；
- DAC；
- USB；
- CAN；
- motor_control。

这些是标签，不应把 MCU 同时归为 ADC 主类。

## 4.5 支持组合器件

某些器件天然为组合器件：

- PMIC；
- Codec；
- RF Transceiver；
- Sensor Hub；
- MCU + Wireless；
- ADC + PGA；
- USB Hub + PHY；
- Smart Power Stage。

必须支持：

```text
primary_category
secondary_roles
integrated_function_blocks
```

## 4.6 支持 Family Datasheet 内不同子型号

一本 Family Datasheet 中，不同型号可能属于：

- 同一主类；
- 不同通道数；
- 不同性能等级；
- 不同接口；
- 不同封装；
- 甚至不同子类。

分类不能只在 Datasheet 层做一次，然后机械复制给所有型号。

应支持：

```text
document_level_classification
part_level_classification
variant_override
```

## 4.7 所有判断带证据

分类结果必须保存：

- 命中的来源；
- 文本证据；
- 页码；
- block_id；
- 匹配规则；
- 分类候选；
- 分数；
- 最终决策；
- 审核状态；
- 规则和模型版本。

## 4.8 Schema 必须版本化

任何字段变更都不能直接覆盖旧 Schema。

例如：

```text
component.mcu.arm-cortex-m.v1
component.mcu.arm-cortex-m.v2
```

下游抽取结果必须记录使用了哪个 Schema 版本。

## 4.9 未知优于错误

当证据不足时，输出：

```text
classification_status = unresolved
review_required = true
```

而不是强行归类。

---

# 5. 推荐分类体系

以下为建议的初始分类骨架。它不是最终固定标准，而是 V1 的 Seed Taxonomy。

---

## 5.1 一级类别

```text
01 Integrated Circuit
02 Discrete Semiconductor
03 Passive Component
04 Sensor
05 Electromechanical
06 Connector
07 Power Module
08 RF Module
09 Computing Module
10 Display & Optoelectronics
11 Protection Device
12 Timing & Frequency
13 Memory
14 Development Module
15 Other Electronic Component
16 Unknown
```

说明：

- Memory 可作为 IC 的二级类，也可保留独立一级类；
- Sensor 可含芯片和模块；
- Timing & Frequency 可含晶振、振荡器和时钟芯片；
- 实际落地时应与 ezPLM 已有分类树对齐，避免重复建立第二套分类体系。

---

## 5.2 常用二级/三级类别示例

### 5.2.1 处理器与可编程器件

```text
Integrated Circuit
└── Processing
    ├── Microcontroller
    │   ├── 8-bit MCU
    │   ├── 16-bit MCU
    │   ├── 32-bit MCU
    │   ├── ARM Cortex-M MCU
    │   ├── RISC-V MCU
    │   └── Wireless MCU
    ├── Microprocessor
    ├── DSP
    ├── FPGA
    ├── CPLD
    ├── SoC
    └── AI Accelerator
```

### 5.2.2 模拟器件

```text
Integrated Circuit
└── Analog
    ├── Operational Amplifier
    │   ├── General Purpose
    │   ├── Precision
    │   ├── High Speed
    │   ├── Low Power
    │   ├── Low Noise
    │   ├── Rail-to-Rail
    │   └── Current Sense Amplifier
    ├── Comparator
    ├── Instrumentation Amplifier
    ├── Isolation Amplifier
    ├── PGA
    ├── Analog Switch
    ├── Multiplexer
    ├── Voltage Reference
    └── Analog Front End
```

### 5.2.3 数据转换器

```text
Integrated Circuit
└── Data Converter
    ├── ADC
    │   ├── SAR ADC
    │   ├── Delta-Sigma ADC
    │   ├── Pipeline ADC
    │   ├── Flash ADC
    │   └── Integrating ADC
    ├── DAC
    │   ├── Voltage Output DAC
    │   ├── Current Output DAC
    │   └── Audio DAC
    ├── Codec
    ├── Digital Potentiometer
    └── Touch Controller
```

### 5.2.4 电源管理

```text
Integrated Circuit
└── Power Management
    ├── Linear Regulator
    │   ├── LDO
    │   ├── Adjustable Linear Regulator
    │   └── Shunt Regulator
    ├── Switching Regulator
    │   ├── Buck
    │   ├── Boost
    │   ├── Buck-Boost
    │   ├── Flyback Controller
    │   └── SEPIC Controller
    ├── PMIC
    ├── Battery Charger
    ├── Battery Fuel Gauge
    ├── Power Path Controller
    ├── Hot Swap Controller
    ├── Load Switch
    ├── Gate Driver
    ├── Motor Driver
    ├── LED Driver
    └── Power Monitor
```

### 5.2.5 接口器件

```text
Integrated Circuit
└── Interface
    ├── UART Transceiver
    ├── RS-232 Transceiver
    ├── RS-485/422 Transceiver
    ├── CAN Transceiver
    ├── LIN Transceiver
    ├── USB PHY
    ├── Ethernet PHY
    ├── I2C Buffer
    ├── SPI Bridge
    ├── Level Translator
    ├── Digital Isolator
    ├── SerDes
    └── Interface Bridge
```

### 5.2.6 时钟与频率

```text
Timing & Frequency
├── Crystal
├── Oscillator
├── TCXO
├── VCXO
├── Clock Generator
├── Clock Buffer
├── PLL
├── Frequency Synthesizer
└── RTC
```

### 5.2.7 分立半导体

```text
Discrete Semiconductor
├── Diode
│   ├── Rectifier
│   ├── Schottky
│   ├── Zener
│   ├── TVS
│   └── PIN Diode
├── Transistor
│   ├── BJT
│   ├── N-Channel MOSFET
│   ├── P-Channel MOSFET
│   ├── Dual MOSFET
│   ├── IGBT
│   └── JFET
├── Thyristor
├── Triac
└── Power Stage
```

### 5.2.8 传感器

```text
Sensor
├── Temperature Sensor
│   ├── Analog
│   ├── Digital
│   ├── Thermistor
│   └── Thermocouple Interface
├── Pressure Sensor
├── Humidity Sensor
├── Current Sensor
├── Voltage Sensor
├── Magnetic Sensor
│   ├── Hall Switch
│   ├── Linear Hall
│   └── Magnetometer
├── Motion Sensor
│   ├── Accelerometer
│   ├── Gyroscope
│   ├── IMU
│   └── Vibration Sensor
├── Optical Sensor
│   ├── Ambient Light
│   ├── Proximity
│   ├── Color Sensor
│   └── Time-of-Flight
├── Gas Sensor
├── Audio Sensor
├── Force Sensor
└── Biosensor
```

---

# 6. Schema 设计

## 6.1 Schema 分层

建议使用继承和组合，而不是每个类别复制全部字段。

```text
component.base.v1
├── component.ic.base.v1
│   ├── component.mcu.base.v1
│   ├── component.opamp.base.v1
│   ├── component.adc.base.v1
│   └── component.regulator.base.v1
├── component.discrete.base.v1
├── component.passive.base.v1
└── component.sensor.base.v1
```

例如：

```text
component.opamp.precision.v1
inherits:
- component.base.v1
- component.ic.base.v1
- component.opamp.base.v1
```

## 6.2 Schema 字段类型

```text
string
integer
number
boolean
enum
range
quantity
list
object
table
reference
```

推荐电气参数统一使用 `quantity`：

```json
{
  "value": 5.0,
  "unit": "V",
  "condition": "TA=25°C",
  "min": 4.5,
  "typ": 5.0,
  "max": 5.5
}
```

## 6.3 参数字段定义

```yaml
field_id: supply_voltage
display_name:
  en: Supply Voltage
  zh: 供电电压
data_type: quantity_range
dimension: voltage
canonical_unit: V
allowed_units:
  - V
  - mV
required: true
cardinality: one
value_shape:
  min: number
  typ: number
  max: number
conditions_allowed: true
evidence_required: true
validation:
  min_allowed: 0
  max_allowed: 1000
extraction_hints:
  names:
    - Supply Voltage
    - Operating Voltage
    - VCC
    - VDD
  preferred_sections:
    - Recommended Operating Conditions
    - Electrical Characteristics
```

## 6.4 Schema 必须包含

每个参数 Schema 至少包括：

- `schema_id`
- `schema_version`
- `category_id`
- `inherits`
- `fields`
- `required_fields`
- `recommended_fields`
- `optional_fields`
- `unit_rules`
- `enum_definitions`
- `validation_rules`
- `cross_field_rules`
- `extraction_hints`
- `section_hints`
- `table_hints`
- `pin_role_rules`
- `ordering_variant_rules`
- `review_policy`
- `status`
- `effective_from`
- `deprecated_at`

## 6.5 典型类别参数示例

### MCU

```text
核心参数：
- architecture
- core
- core_count
- max_clock_frequency
- flash_size
- sram_size
- gpio_count
- adc_resolution
- adc_channel_count
- dac_channel_count
- communication_interfaces
- operating_voltage
- operating_temperature
- package
- pin_count
```

### 运算放大器

```text
核心参数：
- channel_count
- supply_voltage
- input_offset_voltage
- input_bias_current
- input_common_mode_range
- gain_bandwidth_product
- slew_rate
- voltage_noise_density
- output_current
- rail_to_rail_input
- rail_to_rail_output
- quiescent_current
- operating_temperature
- package
```

### ADC

```text
核心参数：
- architecture
- resolution_bits
- channel_count
- sampling_rate
- input_type
- input_range
- reference_type
- snr
- enob
- inl
- dnl
- interface
- supply_voltage
- power_consumption
- package
```

### LDO

```text
核心参数：
- input_voltage_range
- output_voltage
- output_voltage_adjustable
- output_current
- dropout_voltage
- quiescent_current
- shutdown_current
- output_accuracy
- psrr
- noise
- current_limit
- thermal_shutdown
- package
```

### MOSFET

```text
核心参数：
- channel_type
- polarity
- drain_source_voltage
- continuous_drain_current
- pulsed_drain_current
- rds_on
- gate_threshold_voltage
- gate_charge
- input_capacitance
- power_dissipation
- junction_temperature
- package
```

### 温度传感器

```text
核心参数：
- sensor_type
- output_type
- interface
- temperature_range
- accuracy
- resolution
- supply_voltage
- conversion_time
- current_consumption
- package
```

---

# 7. Schema Registry

## 7.1 Registry 职责

Schema Registry 负责：

- 保存 Schema；
- 版本管理；
- 继承解析；
- 字段定义复用；
- Schema 校验；
- Schema 发布；
- Schema 废弃；
- Schema Diff；
- 分类到 Schema 的映射；
- 下游查询；
- 审计。

## 7.2 Schema 状态

```text
draft
review
approved
active
deprecated
retired
```

只有 `active` Schema 能用于生产路由。

## 7.3 Schema 文件格式

建议使用 YAML 作为人工维护格式，编译成 JSON 供系统使用。

目录示例：

```text
schemas/
├── base/
│   ├── component.base.v1.yaml
│   ├── ic.base.v1.yaml
│   └── sensor.base.v1.yaml
├── analog/
│   ├── opamp.base.v1.yaml
│   ├── opamp.precision.v1.yaml
│   └── comparator.v1.yaml
├── converter/
│   ├── adc.base.v1.yaml
│   ├── adc.sar.v1.yaml
│   └── dac.v1.yaml
├── power/
│   ├── regulator.ldo.v1.yaml
│   └── regulator.buck.v1.yaml
└── registry.yaml
```

## 7.4 Schema 编译

发布前执行：

```text
YAML
→ 语法校验
→ 继承解析
→ 字段冲突检查
→ 单位检查
→ 枚举检查
→ 规则校验
→ 生成 compiled JSON
→ 计算 schema hash
→ 发布
```

## 7.5 Schema Diff

Schema 版本差异至少展示：

- 新增字段；
- 删除字段；
- 修改必填性；
- 修改单位；
- 修改枚举；
- 修改校验范围；
- 修改提取提示；
- 修改父 Schema；
- 修改分类映射。

---

# 8. 分类证据来源

每个候选分类可使用以下证据。

## 8.1 主数据证据

- ezPLM 已有分类；
- 人工审核分类；
- 原厂类别；
- 厂商产品系列；
- 厂商产品 URL 路径；
- 分销商分类；
- 已有内部标签。

## 8.2 文档元数据

- Datasheet title；
- subject；
- document number；
- 文件名；
- Family name；
- 第一页标题。

## 8.3 文档结构证据

从 Canonical IR 读取：

- 标题；
- 一级标题；
- Features；
- General Description；
- Applications；
- Functional Block Diagram 标题；
- Ordering Information；
- Pin Functions；
- Electrical Characteristics 表名。

## 8.4 内容关键词

例如运放：

```text
operational amplifier
op amp
gain bandwidth
input offset voltage
slew rate
common-mode
```

ADC：

```text
analog-to-digital converter
resolution
sampling rate
SNR
ENOB
INL
DNL
```

LDO：

```text
low dropout regulator
dropout voltage
output current
quiescent current
PSRR
```

MOSFET：

```text
drain-source voltage
RDS(on)
gate charge
continuous drain current
```

## 8.5 负面证据

分类规则必须支持负面证据。

例如：

```text
“ADC input” 出现在 MCU Datasheet 中
不代表器件主类是 ADC
```

```text
“operational amplifier used in application circuit”
不代表该器件是运放
```

```text
“LDO regulator” 出现在推荐电源说明
不代表器件本身是 LDO
```

负面规则包括：

- 出现在 Applications；
- 出现在参考设计 BOM；
- 出现在 Related Products；
- 出现在外部器件清单；
- 出现在典型应用电路；
- 出现在 Functional Block 内部集成功能；
- 出现在文档引用。

---

# 9. 分类决策流程

```text
接收 Part + Datasheet Parse Result
        ↓
检查已有人工分类
        ↓
检查制造商/ezPLM 映射
        ↓
提取分类证据
        ↓
生成候选类别
        ↓
规则评分
        ↓
轻量模型评分（可选）
        ↓
冲突消解
        ↓
主类与标签决策
        ↓
选择 Schema
        ↓
生成抽取规则计划
        ↓
质量检查
        ↓
自动批准 / 人工审核
```

---

# 10. 候选生成

候选类别来源：

1. 已有分类映射；
2. 制造商 taxonomy mapping；
3. 分销商 taxonomy mapping；
4. Datasheet 标题规则；
5. 型号系列规则；
6. 关键词规则；
7. 参数名称规则；
8. 文档章节规则；
9. 轻量分类模型 Top-K；
10. Family 分类继承。

候选列表建议保留 Top 5。

```json
[
  {
    "category_id": "ic.analog.opamp",
    "score": 0.96
  },
  {
    "category_id": "ic.analog.comparator",
    "score": 0.31
  }
]
```

---

# 11. 规则评分

建议将评分拆开：

```text
classification_score =
  authoritative_score
  + title_score
  + feature_score
  + parameter_signature_score
  + section_score
  + series_score
  + model_score
  - negative_evidence_penalty
  - conflict_penalty
```

## 11.1 权威证据

```text
人工已审核分类                  +1.00
原厂官方分类精确映射            +0.90
ezPLM 已审核历史分类            +0.85
原厂系列规则                    +0.80
分销商一致分类                  +0.60
```

## 11.2 文档标题

```text
标题明确写 Operational Amplifier      +0.55
标题明确写 SAR ADC                    +0.60
标题仅写 Mixed-Signal Device          +0.15
```

## 11.3 参数签名

器件类别往往有独特参数集合。

例如运放签名：

```text
input offset voltage
gain bandwidth
slew rate
input bias current
```

命中 3 个以上：

```text
+0.40
```

MOSFET 签名：

```text
RDS(on)
gate charge
drain-source voltage
continuous drain current
```

## 11.4 冲突

例如同时强命中：

```text
opamp
comparator
```

且无明确标题，则进入人工审核。

---

# 12. 轻量模型策略

V1 可以不训练模型，先规则化。

V1.1 可加入轻量分类器：

- TF-IDF + Logistic Regression；
- fastText；
- sentence embedding + linear classifier；
- XGBoost；
- LightGBM。

输入特征：

- 标题；
- Features；
- General Description；
- 一级标题；
- 参数名称集合；
- 表格标题；
- 制造商；
- 型号前缀；
- 厂商分类；
- 分销商分类。

模型输出：

```text
Top-K 分类
概率
模型版本
训练数据版本
```

模型不得直接覆盖权威规则。

建议融合：

```text
final_score =
  0.7 * rule_score
  + 0.3 * model_probability
```

权重可配置。

---

# 13. LLM 使用边界

V1 默认不依赖大模型。

若后续启用大模型，仅用于：

- 对低置信度分类给出候选解释；
- 帮助人工审核；
- 根据已存在 Schema 选择最可能的类别；
- 不允许创建新的正式分类；
- 不允许创建新的正式 Schema；
- 不允许无证据修改主数据；
- 必须输出引用 block_id；
- 必须经过规则和人工确认。

LLM 输出只能作为 `advisory_candidate`。

---

# 14. 多功能器件处理

## 14.1 主类

主类根据：

- 厂商定位；
- 产品标题；
- 主要销售类别；
- 主要功能；
- 关键参数签名。

## 14.2 次级角色

例如 MCU：

```json
{
  "primary_category": "ic.processing.microcontroller",
  "secondary_roles": [
    "data_converter.adc",
    "interface.usb",
    "interface.can",
    "timing.pll"
  ]
}
```

## 14.3 集成功能块

```json
{
  "integrated_function_blocks": [
    {
      "type": "adc",
      "count": 2,
      "evidence": ["block-id"]
    },
    {
      "type": "dac",
      "count": 1,
      "evidence": ["block-id"]
    }
  ]
}
```

次级角色不自动触发完整 ADC Schema。

但下游可根据需要加载：

```text
MCU 主 Schema
+ MCU-ADC Extension Schema
+ MCU-USB Extension Schema
```

---

# 15. Schema 路由策略

## 15.1 单 Schema

普通单功能器件：

```text
primary_schema = component.opamp.general.v1
```

## 15.2 基础 Schema + 扩展 Schema

复杂器件：

```text
base_schema = component.mcu.arm-cortex-m.v2
extensions:
- extension.mcu.usb.v1
- extension.mcu.can.v1
- extension.mcu.adc.v1
```

## 15.3 条件 Schema

例如 LDO：

```text
if adjustable_output = true:
    add extension.regulator.adjustable.v1
```

## 15.4 Family Datasheet

对于 Family Datasheet：

```text
document_schema
part_schema_overrides
variant_discriminator_rules
```

例如：

```json
{
  "document_default_schema": "component.opamp.general.v1",
  "part_overrides": {
    "OPA197": "component.opamp.precision.v1",
    "OPA2197": "component.opamp.precision.dual.v1"
  }
}
```

---

# 16. 抽取规则计划

Schema Routing Plan 应输出后续 Agent 可执行的规则。

```json
{
  "schema_id": "component.opamp.precision.v1",
  "schema_version": "1.0.0",
  "required_fields": [
    "channel_count",
    "supply_voltage",
    "input_offset_voltage",
    "gain_bandwidth_product",
    "slew_rate"
  ],
  "recommended_sections": [
    "Features",
    "Electrical Characteristics",
    "Recommended Operating Conditions"
  ],
  "table_title_patterns": [
    "Electrical Characteristics",
    "Typical Performance Characteristics"
  ],
  "field_rules": {
    "input_offset_voltage": {
      "keywords": ["Input Offset Voltage", "VOS"],
      "preferred_table_columns": ["PARAMETER", "MIN", "TYP", "MAX", "UNIT"],
      "canonical_unit": "uV"
    }
  }
}
```

---

# 17. Agent 输入

## 17.1 事件输入

订阅：

```json
{
  "event_type": "datasheet.parse.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "binary_object_id": "uuid",
  "parse_result_id": "uuid",
  "canonical_ir_uri": "s3://...",
  "quality_report_uri": "s3://...",
  "overall_quality": 0.91,
  "review_status": "approved"
}
```

## 17.2 REST 输入

`POST /api/v1/component-classifications/jobs`

```json
{
  "part_id": "uuid",
  "document_id": "uuid",
  "version_id": "uuid",
  "parse_result_id": "uuid",
  "canonical_ir_uri": "s3://...",
  "manufacturer_id": "uuid",
  "mpn": "LM358DR",
  "existing_category_id": null,
  "mode": "auto",
  "taxonomy_version": "taxonomy-1.0.0",
  "schema_registry_version": "registry-1.0.0",
  "classification_policy_version": "classifier-1.0.0",
  "idempotency_key": "uuid"
}
```

`mode`：

- `auto`
- `rules_only`
- `model_assisted`
- `review_only`
- `force_category`
- `dry_run`

---

# 18. Agent 输出

```json
{
  "agent_id": "component-classification-schema-router",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",
  "part": {
    "part_id": "uuid",
    "manufacturer_id": "uuid",
    "mpn": "LM358DR"
  },
  "classification": {
    "taxonomy_version": "taxonomy-1.0.0",
    "primary_category": {
      "category_id": "ic.analog.opamp.general",
      "path": [
        "Integrated Circuit",
        "Analog",
        "Operational Amplifier",
        "General Purpose"
      ],
      "confidence": 0.97
    },
    "secondary_roles": [],
    "functional_tags": [
      "dual_channel",
      "low_power"
    ],
    "candidates": [
      {
        "category_id": "ic.analog.opamp.general",
        "score": 0.97
      },
      {
        "category_id": "ic.analog.comparator",
        "score": 0.18
      }
    ],
    "evidence": [
      {
        "source": "document_title",
        "block_id": "p1-title-1",
        "page": 1,
        "text": "Dual Operational Amplifiers",
        "rule_id": "title.opamp.001",
        "weight": 0.55
      }
    ],
    "decision_rule": "authoritative_plus_document_rules",
    "classification_status": "approved"
  },
  "schema_routing": {
    "schema_registry_version": "registry-1.0.0",
    "primary_schema": {
      "schema_id": "component.opamp.general.v1",
      "schema_version": "1.0.0",
      "schema_hash": "hex"
    },
    "extension_schemas": [],
    "routing_rule_id": "route.opamp.general.001",
    "extraction_plan_uri": "s3://.../extraction_plan.json"
  },
  "review": {
    "required": false,
    "reasons": []
  },
  "issues": [],
  "created_at": "ISO-8601"
}
```

---

# 19. 状态机

```text
RECEIVED
  ↓
LOADING_PART_DATA
  ↓
LOADING_DOCUMENT_CONTEXT
  ↓
LOADING_TAXONOMY
  ↓
GENERATING_CANDIDATES
  ↓
APPLYING_RULES
  ↓
MODEL_SCORING          可选
  ↓
RESOLVING_CONFLICTS
  ↓
SELECTING_CATEGORY
  ↓
ROUTING_SCHEMA
  ↓
BUILDING_EXTRACTION_PLAN
  ↓
VALIDATING_DECISION
  ↓
COMPLETED
```

分支状态：

- `REVIEW_REQUIRED`
- `FAILED_TEMPORARY`
- `FAILED_PERMANENT`
- `CANCELLED`

---

# 20. 数据模型

## 20.1 `component_taxonomies`

```text
id UUID PK
taxonomy_version VARCHAR UNIQUE NOT NULL
name VARCHAR NOT NULL
status VARCHAR NOT NULL
definition_uri TEXT NOT NULL
definition_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
activated_at TIMESTAMPTZ NULL
deprecated_at TIMESTAMPTZ NULL
```

## 20.2 `component_categories`

```text
id UUID PK
taxonomy_id UUID NOT NULL
category_key VARCHAR NOT NULL
parent_id UUID NULL
level INT NOT NULL
name_en VARCHAR NOT NULL
name_zh VARCHAR NULL
description TEXT NULL
status VARCHAR NOT NULL
path_cache JSONB NOT NULL
sort_order INT
UNIQUE(taxonomy_id, category_key)
```

## 20.3 `component_category_aliases`

```text
id UUID PK
category_id UUID NOT NULL
alias VARCHAR NOT NULL
alias_type VARCHAR NOT NULL
language VARCHAR NULL
manufacturer_id UUID NULL
source VARCHAR NOT NULL
confidence NUMERIC(5,4)
UNIQUE(category_id, alias, manufacturer_id)
```

## 20.4 `classification_rules`

```text
id UUID PK
policy_version VARCHAR NOT NULL
rule_id VARCHAR NOT NULL
rule_type VARCHAR NOT NULL
target_category_key VARCHAR NOT NULL
priority INT NOT NULL
weight NUMERIC(6,4) NOT NULL
conditions JSONB NOT NULL
negative_conditions JSONB NOT NULL
evidence_requirements JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(policy_version, rule_id)
```

## 20.5 `schema_registry_versions`

```text
id UUID PK
registry_version VARCHAR UNIQUE NOT NULL
status VARCHAR NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
activated_at TIMESTAMPTZ NULL
```

## 20.6 `parameter_schemas`

```text
id UUID PK
registry_id UUID NOT NULL
schema_id VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
category_key VARCHAR NOT NULL
status VARCHAR NOT NULL
source_yaml_uri TEXT NOT NULL
compiled_json_uri TEXT NOT NULL
schema_hash CHAR(64) NOT NULL
inherits JSONB NOT NULL
field_count INT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(registry_id, schema_id, schema_version)
```

## 20.7 `category_schema_routes`

```text
id UUID PK
registry_id UUID NOT NULL
taxonomy_id UUID NOT NULL
category_key VARCHAR NOT NULL
primary_schema_id VARCHAR NOT NULL
primary_schema_version VARCHAR NOT NULL
extension_rules JSONB NOT NULL
priority INT NOT NULL
status VARCHAR NOT NULL
UNIQUE(registry_id, taxonomy_id, category_key, priority)
```

## 20.8 `component_classification_jobs`

```text
id UUID PK
part_id UUID NOT NULL
document_id UUID NULL
version_id UUID NULL
parse_result_id UUID NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
taxonomy_version VARCHAR NOT NULL
schema_registry_version VARCHAR NOT NULL
classification_policy_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_json JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 20.9 `component_classification_results`

```text
id UUID PK
job_id UUID NOT NULL
part_id UUID NOT NULL
primary_category_id UUID NULL
confidence NUMERIC(5,4)
secondary_roles JSONB NOT NULL
functional_tags JSONB NOT NULL
candidate_scores JSONB NOT NULL
evidence_uri TEXT NOT NULL
decision_rule VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 20.10 `component_schema_routing_results`

```text
id UUID PK
classification_result_id UUID NOT NULL
primary_schema_id VARCHAR NOT NULL
primary_schema_version VARCHAR NOT NULL
primary_schema_hash CHAR(64) NOT NULL
extension_schemas JSONB NOT NULL
routing_rule_id VARCHAR NOT NULL
extraction_plan_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 20.11 `component_classification_reviews`

```text
id UUID PK
job_id UUID NOT NULL
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

# 21. 分类与 Schema 文件结构

```text
classification/
├── taxonomy/
│   ├── taxonomy-1.0.0.yaml
│   ├── categories/
│   │   ├── integrated-circuit.yaml
│   │   ├── discrete-semiconductor.yaml
│   │   ├── sensor.yaml
│   │   └── passive.yaml
│   └── aliases/
│       ├── manufacturer-mappings.yaml
│       └── distributor-mappings.yaml
├── rules/
│   ├── classifier-1.0.0/
│   │   ├── authoritative.yaml
│   │   ├── title-keywords.yaml
│   │   ├── parameter-signatures.yaml
│   │   ├── negative-evidence.yaml
│   │   ├── series-rules.yaml
│   │   └── route-rules.yaml
├── schemas/
│   ├── registry-1.0.0/
│   │   ├── base/
│   │   ├── mcu/
│   │   ├── opamp/
│   │   ├── adc/
│   │   ├── regulator/
│   │   ├── mosfet/
│   │   └── sensor/
│   └── registry.yaml
└── compiled/
    ├── taxonomy.json
    ├── rules.json
    └── schemas/
```

---

# 22. 规则 DSL

建议使用简单 YAML DSL，不允许在规则文件中执行任意代码。

```yaml
rule_id: title.opamp.001
rule_type: positive
target_category: ic.analog.opamp
priority: 100
weight: 0.55

when:
  any:
    - source: document_title
      regex: '\boperational amplifier(s)?\b'
    - source: first_page_heading
      regex: '\bop amp\b'

unless:
  any:
    - source: document_type
      equals: application_note

evidence:
  min_hits: 1
  store_text: true
  store_block_id: true
```

参数签名规则：

```yaml
rule_id: signature.opamp.001
rule_type: parameter_signature
target_category: ic.analog.opamp
priority: 80
weight: 0.40

when:
  source: parameter_names
  min_matches: 3
  terms:
    - input offset voltage
    - input bias current
    - gain bandwidth
    - slew rate
    - common-mode rejection
```

---

# 23. 冲突消解

## 23.1 高置信度冲突

如果两个不同主类都超过 0.80：

```text
REVIEW_REQUIRED
reason = conflicting_high_confidence_categories
```

## 23.2 父子类冲突

如果候选为：

```text
Operational Amplifier
Precision Operational Amplifier
```

则优先更具体子类，前提是子类证据达到阈值。

## 23.3 主类与内部功能块冲突

MCU Datasheet 中含 ADC 参数：

```text
主类 = MCU
secondary_role = ADC
```

不进入冲突。

## 23.4 文档类型冲突

如果输入是：

```text
application_note
package_document
errata
```

默认不用于主分类，除非已绑定明确 Part 且存在其他权威证据。

---

# 24. 置信度与审核

建议阈值：

```text
>= 0.90 自动批准
0.75–0.89 自动分类，但标记低风险复核
0.55–0.74 人工审核
< 0.55 unresolved
```

以下情况强制审核：

- 无制造商；
- 无 MPN；
- 文档标题与主数据冲突；
- Family 内型号跨多个主类；
- 高置信度候选冲突；
- 无可用 Schema；
- Schema 已废弃；
- 选择了 fallback generic Schema；
- 只有分销商分类，无原厂或文档证据；
- 文档解析质量低；
- 文档类型非 Datasheet；
- 型号疑似模块而不是 IC；
- 主分类变化会影响已有抽取数据。

---

# 25. 通用兜底 Schema

V1 必须提供通用兜底，但不能滥用。

```text
component.generic.ic.v1
component.generic.discrete.v1
component.generic.sensor.v1
component.generic.passive.v1
component.generic.module.v1
component.unknown.v1
```

使用兜底 Schema 时：

```text
review_required = true
```

后续抽取 Agent只能抽取：

- 型号；
- 厂商；
- 描述；
- 电压；
- 温度；
- 封装；
- 生命周期；
- RoHS；
- 文档证据。

不得假装已具备类别专属参数。

---

# 26. API 设计

## 26.1 写接口

```text
POST /api/v1/component-classifications/jobs
POST /api/v1/component-classifications/batches
POST /api/v1/component-classifications/jobs/{job_id}/retry
POST /api/v1/component-classifications/jobs/{job_id}/cancel
POST /api/v1/component-classifications/jobs/{job_id}/override
POST /api/v1/component-classifications/reviews/{review_id}/resolve

POST /api/v1/taxonomies/validate
POST /api/v1/taxonomies/publish
POST /api/v1/schema-registry/validate
POST /api/v1/schema-registry/publish
POST /api/v1/schema-registry/compare
```

## 26.2 读接口

```text
GET /api/v1/component-classifications/jobs/{job_id}
GET /api/v1/component-classifications/jobs/{job_id}/events
GET /api/v1/components/{part_id}/classification
GET /api/v1/components/{part_id}/schema-route
GET /api/v1/classification-reviews

GET /api/v1/taxonomies
GET /api/v1/taxonomies/{version}
GET /api/v1/taxonomies/{version}/categories
GET /api/v1/taxonomies/{version}/categories/{category_key}

GET /api/v1/schema-registry
GET /api/v1/schema-registry/{version}
GET /api/v1/schema-registry/{version}/schemas
GET /api/v1/schema-registry/{version}/schemas/{schema_id}
GET /api/v1/schema-registry/{version}/routes/{category_key}
```

---

# 27. 错误码

```text
PART_NOT_FOUND
MANUFACTURER_NOT_FOUND
DOCUMENT_NOT_FOUND
PARSE_RESULT_NOT_FOUND
PARSE_QUALITY_TOO_LOW
TAXONOMY_VERSION_NOT_FOUND
TAXONOMY_INVALID
CATEGORY_NOT_FOUND
CLASSIFICATION_RULE_INVALID
NO_CLASSIFICATION_CANDIDATE
CLASSIFICATION_CONFLICT
CLASSIFICATION_LOW_CONFIDENCE
SCHEMA_REGISTRY_NOT_FOUND
SCHEMA_NOT_FOUND
SCHEMA_INVALID
SCHEMA_INHERITANCE_CYCLE
SCHEMA_FIELD_CONFLICT
SCHEMA_UNIT_CONFLICT
NO_SCHEMA_ROUTE
DEPRECATED_SCHEMA_SELECTED
EXTRACTION_PLAN_INVALID
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 28. Schema 校验规则

## 28.1 结构校验

- Schema ID 唯一；
- 版本合法；
- 父 Schema 存在；
- 无循环继承；
- 字段 ID 唯一；
- 必填字段存在；
- 字段类型合法；
- 枚举存在；
- 单位维度一致。

## 28.2 继承冲突

若父 Schema 与子 Schema 定义同一字段：

允许：

- 增加 extraction hints；
- 收紧允许枚举；
- 收紧合理范围；
- 增加别名。

默认禁止：

- 改变数据类型；
- 改变物理维度；
- 把必填字段改成可选；
- 把数量字段改成字符串。

## 28.3 跨字段规则

例如 ADC：

```text
resolution_bits > 0
sampling_rate > 0
enob <= resolution_bits
```

LDO：

```text
output_voltage_max <= input_voltage_max
output_current > 0
dropout_voltage >= 0
```

MOSFET：

```text
rds_on >= 0
gate_charge >= 0
drain_source_voltage > 0
```

---

# 29. 可观测性

## 29.1 Prometheus 指标

```text
component_classification_jobs_total{status,mode}
component_classification_duration_seconds{step}
component_classification_results_total{category,status}
component_classification_confidence{category}
component_classification_review_total{reason}
component_classification_conflicts_total{category_a,category_b}
component_schema_routes_total{schema_id}
component_schema_fallback_total{reason}
component_unknown_total
component_rule_hits_total{rule_id}
component_model_predictions_total{model_version}
component_taxonomy_version_usage_total{version}
component_schema_registry_usage_total{version}
```

## 29.2 质量看板

展示：

- 每日分类量；
- 自动批准率；
- 人工审核率；
- unresolved 率；
- 各类别数量；
- 各类别平均置信度；
- 高频冲突类别；
- 高频 fallback Schema；
- 分类变化率；
- 人工修正率；
- 规则命中分布；
- 制造商分类质量；
- 模型版本对比；
- Schema 覆盖率。

---

# 30. 测试集

测试至少包括：

1. 标准 MCU；
2. Wireless MCU；
3. MPU；
4. FPGA；
5. 通用运放；
6. 精密运放；
7. 比较器；
8. SAR ADC；
9. Delta-Sigma ADC；
10. DAC；
11. LDO；
12. Buck；
13. PMIC；
14. N-MOSFET；
15. P-MOSFET；
16. 双 MOSFET；
17. TVS；
18. 温度传感器；
19. IMU；
20. 电流传感器；
21. USB-UART；
22. CAN Transceiver；
23. EEPROM；
24. Flash；
25. RTC；
26. Oscillator；
27. Connector；
28. 被动器件；
29. 模块；
30. Application Note；
31. Package Document；
32. Family Datasheet；
33. 一份文档多型号；
34. MCU 中内置 ADC；
35. PMIC 多功能；
36. 标题模糊但参数签名明确；
37. 标题明确但分销商分类错误；
38. 原厂分类和 ezPLM 分类冲突；
39. 文档解析质量低；
40. 无 Schema；
41. 已废弃 Schema；
42. 分类树父子冲突；
43. 型号后缀变体；
44. 不同封装同一基础型号；
45. 不同型号同一 Family；
46. unknown；
47. 同一任务重复提交；
48. Taxonomy 版本变化；
49. Schema Registry 版本变化；
50. 人工 override。

公开仓库只放合成文本和合成 Canonical IR Fixture。

---

# 31. 评估指标

## 31.1 分类指标

- Top-1 Accuracy；
- Top-3 Accuracy；
- Macro F1；
- Micro F1；
- Hierarchical Accuracy；
- Parent-level Accuracy；
- Unknown Detection Precision；
- Unknown Detection Recall；
- Calibration Error；
- 自动批准准确率；
- 人工审核率。

## 31.2 路由指标

- 正确 Schema 命中率；
- fallback Schema 比例；
- 无 Schema 比例；
- Schema 版本一致性；
- Extraction Plan 完整率；
- 必填字段覆盖率；
- 人工修正率。

## 31.3 分层报告

不得只给总体准确率。

必须按：

- 类别；
- 制造商；
- 文档语言；
- Family/单型号；
- 解析质量；
- 新旧型号；
- 数据来源；
- 规则/模型模式。

---

# 32. 验收标准

## 32.1 功能验收

- 能接收 `datasheet.parse.ready`；
- 能读取元器件主数据和 Canonical IR；
- 能生成候选分类；
- 能输出层级主分类；
- 能输出多标签；
- 能处理组合器件；
- 能区分主类与集成功能块；
- 能选择 Primary Schema；
- 能选择 Extension Schema；
- 能生成 Extraction Plan；
- 能输出证据和置信度；
- 能处理 Family Datasheet；
- 能进入人工审核；
- 能人工 override；
- 能版本化 Taxonomy；
- 能版本化 Schema Registry；
- 能发布下游事件；
- 所有写操作幂等。

## 32.2 工程质量

- 单元测试覆盖率不低于 85%；
- Schema 编译与校验模块覆盖率不低于 95%；
- 分类规则全部有测试；
- Taxonomy 和 Schema 通过 JSON Schema；
- 无循环继承；
- 无字段 ID 冲突；
- Ruff 通过；
- mypy 通过；
- Migration upgrade/downgrade 通过；
- 不提交真实受版权保护 Datasheet；
- 不伪造分类准确率。

## 32.3 初始质量目标

在内部人工审核测试集上：

```text
一级分类准确率 >= 98%
二级分类准确率 >= 95%
三级分类准确率 >= 90%
自动批准结果准确率 >= 98%
Schema 路由准确率 >= 95%
Unknown 检出 Recall >= 90%
```

这些是目标，不是预先保证。

---

# 33. 推荐仓库结构

```text
component-classification-schema-router/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── component-classification-schema-router-spec.md
│   ├── taxonomy-design.md
│   ├── schema-registry.md
│   ├── rule-dsl.md
│   ├── classification-policy.md
│   ├── extraction-plan.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-taxonomy-schema-separation.md
│       ├── 0002-rules-first.md
│       ├── 0003-schema-versioning.md
│       └── 0004-primary-category-and-tags.md
├── src/
│   └── component_router/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── taxonomy/
│       │   ├── loader.py
│       │   ├── models.py
│       │   ├── validator.py
│       │   └── compiler.py
│       ├── schema_registry/
│       │   ├── loader.py
│       │   ├── compiler.py
│       │   ├── inheritance.py
│       │   ├── validator.py
│       │   ├── diff.py
│       │   └── publisher.py
│       ├── evidence/
│       │   ├── document_evidence.py
│       │   ├── master_data.py
│       │   ├── parameter_signatures.py
│       │   └── negative_evidence.py
│       ├── classification/
│       │   ├── candidate_generator.py
│       │   ├── rule_engine.py
│       │   ├── scorer.py
│       │   ├── conflict_resolver.py
│       │   ├── family_classifier.py
│       │   └── classifier.py
│       ├── model/
│       │   ├── interface.py
│       │   ├── fasttext_adapter.py
│       │   └── training/
│       ├── routing/
│       │   ├── schema_router.py
│       │   ├── extension_router.py
│       │   └── extraction_plan_builder.py
│       ├── review/
│       ├── storage/
│       └── observability/
├── taxonomy/
├── classification/
│   └── rules/
├── schemas/
├── compiled/
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── rules/
│   ├── taxonomy/
│   ├── schemas/
│   ├── routing/
│   ├── regression/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── labels/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── compile_taxonomy.py
    ├── compile_schemas.py
    ├── validate_registry.py
    ├── run_classification_benchmark.py
    ├── compare_taxonomy_versions.py
    └── export_review_dataset.py
```

---

# 34. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察与数据对齐

Codex 必须：

1. 阅读第一个和第二个 Agent；
2. 阅读 ezPLM 现有物料、制造商、分类和参数表；
3. 找出现有分类树；
4. 找出现有 500+ 模块分类和 110 万器件分类结构；
5. 找出现有参数模板；
6. 对比现有分类与本规格；
7. 输出 `docs/component-classification-implementation-plan.md`；
8. 输出分类迁移风险；
9. 输出 Schema Registry 迁移方案；
10. 不修改业务代码；
11. 不创建 Migration；
12. 不新增依赖。

## Phase 1：Taxonomy 与 Schema Registry 契约

实现：

- Taxonomy 文件结构；
- Schema 文件结构；
- JSON Schema；
- Loader；
- Validator；
- 编译器骨架；
- 版本对象；
- Diff 接口；
- 合成 Seed 数据。

验收：

- Taxonomy 可编译；
- Schema 可编译；
- 循环继承可检测；
- 字段冲突可检测。

## Phase 2：基础数据模型与 API 骨架

实现：

- 数据表；
- Migration；
- Job；
- Result；
- Review；
- Taxonomy API；
- Schema Registry API；
- Mock Classification。

验收：

- Migration 通过；
- API Contract 通过；
- 幂等测试通过。

## Phase 3：证据提取

实现：

- 从 Part 主数据取证；
- 从 Canonical IR 取标题、Features、章节和表名；
- 制造商映射；
- 分销商映射；
- 型号系列规则；
- 负面证据；
- Evidence 对象。

验收：

- 所有证据可追溯到来源；
- block_id 和页码保存正确。

## Phase 4：规则引擎和候选生成

实现：

- YAML Rule DSL；
- Rule Loader；
- 正面规则；
- 负面规则；
- 参数签名；
- 候选 Top-K；
- 权重；
- 规则命中日志。

验收：

- MCU、运放、ADC、LDO、MOSFET、传感器 Fixture 正确；
- Application Note 不误分类。

## Phase 5：冲突消解与 Family 分类

实现：

- 父子冲突；
- 多主类冲突；
- 主类/内部功能块区分；
- Family 默认分类；
- Part override；
- 型号变体；
- Review 条件。

验收：

- MCU 内 ADC 不误判；
- Family 中不同子型号可 override。

## Phase 6：Schema 路由与 Extraction Plan

实现：

- Category → Primary Schema；
- Extension Schema；
- 条件规则；
- Generic fallback；
- Extraction Plan；
- Schema Hash；
- 下游事件。

验收：

- 六个核心类别均能生成正确计划；
- fallback 自动进入审核。

## Phase 7：人工审核与 Override

实现：

- Review API；
- 候选对比；
- 人工分类；
- Schema Override；
- 原因记录；
- 结果回写；
- 审核数据导出。

验收：

- 人工修正可追溯；
- 不覆盖历史结果。

## Phase 8：轻量分类模型

可选实现：

- 训练数据导出；
- fastText 或线性分类器；
- 模型接口；
- Top-K；
- 模型版本；
- 规则与模型融合；
- 离线评估。

验收：

- 模型默认不能覆盖权威规则；
- 模型关闭时系统可完整工作。

## Phase 9：批量处理与可观测性

实现：

- 批量任务；
- 缓存；
- 重试；
- 指标；
- Dashboard 数据；
- 版本迁移；
- 回归测试。

验收：

- 同一输入、同一版本命中缓存；
- Taxonomy 版本变化可重跑。

## Phase 10：Benchmark 与生产发布

实现：

- 内部基准集；
- 分类指标；
- Schema 路由指标；
- 人工审核率；
- 分类版本对比；
- 发布流程；
- 回滚流程；
- README；
- 运维文档。

---

# 35. Codex 工作纪律

Codex 必须：

1. 先读现有 ezPLM 分类结构；
2. 不直接建立第二套分类主数据；
3. 不擅自删除或重命名现有分类；
4. Taxonomy 与 Schema 分离；
5. 规则配置化；
6. Schema 版本化；
7. 所有判断保存证据；
8. 不把多功能 MCU 分类为多个主类；
9. 不因 Application Note 中提到器件而误分类；
10. 不使用 LLM 直接创建正式分类；
11. 不使用 LLM 直接创建正式 Schema；
12. 不覆盖人工审核结果；
13. 不覆盖旧 Schema；
14. 不把规则硬编码在 Controller；
15. 不把完整 Canonical IR 存入数据库；
16. 不提交真实 Datasheet；
17. 不伪造测试准确率；
18. 每个 Phase 输出：
   - 修改文件；
   - 数据模型变化；
   - Taxonomy 变化；
   - Schema 变化；
   - 测试命令；
   - 真实测试结果；
   - 已知问题；
   - 下一阶段计划。

---

# 36. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/component-classification-schema-router-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第三个基础 Agent：

Component Classification & Schema Routing Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. docs/datasheet-asset-ingestion-agent-spec.md；
3. docs/pdf-parsing-ocr-router-agent-spec.md；
4. docs/component-classification-schema-router-agent-spec.md；
5. 第一个和第二个 Agent 的代码、数据模型、事件协议和测试；
6. ezPLM 当前的物料、制造商、分类、参数、模块和模板数据结构；
7. 当前仓库 README、数据库、对象存储、任务队列、日志、Docker 和 CI。

本 Agent 的职责是：

- 接收 Part 主数据和 datasheet.parse.ready；
- 从 Canonical Document IR 提取分类证据；
- 判断器件的一级、二级和三级类别；
- 输出一个主分类；
- 输出多个功能标签和次级角色；
- 处理组合器件和 Family Datasheet；
- 根据分类选择版本化参数 Schema；
- 选择 Extension Schema；
- 生成后续参数抽取 Agent 的 Extraction Plan；
- 保存候选分类、分数、证据、规则和版本；
- 低置信度或冲突结果进入人工审核。

硬约束：

- 分类树与参数 Schema 必须分离；
- 优先复用 ezPLM 现有分类体系；
- 不建立第二套互不兼容的分类主数据；
- 规则优先，模型辅助；
- V1 不依赖大模型；
- 不允许 LLM 创建正式分类；
- 不允许 LLM 创建正式 Schema；
- 一个器件只能有一个 primary_category；
- 多功能通过 secondary_roles、functional_tags 和 extension schemas 表达；
- MCU 内置 ADC 不得误分类为 ADC 主类；
- Application Note 中提到的器件不得作为主分类证据；
- 所有自动判断必须保存 evidence、rule_id、score 和版本；
- Taxonomy、规则、Schema Registry 都必须版本化；
- Schema 使用 YAML 维护、编译成 JSON；
- 必须检测循环继承和字段冲突；
- PostgreSQL 不存放完整 Canonical IR；
- 不覆盖人工审核结果；
- 不覆盖旧 Schema；
- 不提交真实受版权保护 Datasheet；
- 不伪造分类准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 查找已有分类树、物料分类表、参数模板、制造商分类和分销商映射；
3. 查找第一、第二个 Agent 可复用的事件、任务、存储、审核和日志模块；
4. 对比现有分类体系与规格中的建议 Taxonomy；
5. 给出“复用、迁移、兼容、废弃”的处理建议；
6. 识别已有参数模板是否能迁移为 Schema Registry；
7. 在 docs/component-classification-implementation-plan.md 中生成实施计划；
8. 在 docs/component-taxonomy-mapping-plan.md 中生成分类映射计划；
9. 在 docs/component-schema-registry-migration-plan.md 中生成参数模板迁移计划；
10. 在 docs/component-classification-benchmark-plan.md 中生成基准测试计划；
11. 给出拟新增、拟修改和拟复用文件清单；
12. 给出 Phase 1 精确修改范围；
13. 不修改业务实现；
14. 不创建 Migration；
15. 不安装新依赖；
16. 运行当前仓库已有 lint、type check 和测试。

最终回复必须包含：

- 仓库现状；
- 现有分类体系；
- 现有参数模板；
- 与前两个 Agent 的衔接；
- Taxonomy 复用方案；
- Schema Registry 迁移方案；
- 分类规则方案；
- Family Datasheet 处理方案；
- Benchmark 方案；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 37. 后续 Phase 提示词模板

```text
继续实现 Component Classification & Schema Routing Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读三个 Agent 的完整规格；
3. 阅读 docs/component-classification-implementation-plan.md；
4. 阅读 Taxonomy Mapping Plan；
5. 阅读 Schema Registry Migration Plan；
6. 检查上一阶段代码和测试；
7. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- 不建立第二套分类主数据；
- Taxonomy 与 Schema 分离；
- 规则配置化；
- Schema 版本化；
- 一个 primary_category；
- 多功能用标签和扩展 Schema；
- 所有判断带证据；
- 不依赖外部大模型；
- 不覆盖人工结果；
- 不覆盖旧 Schema；
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
9. 运行分类回归测试；
10. 更新文档；
11. 总结修改。

最终回复：

- 修改文件；
- Taxonomy 变化；
- Schema 变化；
- API 变化；
- 测试命令和真实结果；
- 分类指标；
- 已知限制；
- 下一阶段建议。
```

---

# 38. MVP 演示流程

完成 V1 后，演示：

1. LM358 Datasheet 解析完成；
2. Agent 读取标题和参数签名；
3. 分类为 Operational Amplifier；
4. 路由到 `component.opamp.general.v1`；
5. 生成运放参数抽取计划；
6. STM32 Datasheet 解析完成；
7. 分类为 MCU；
8. 将 ADC、USB、CAN 标记为次级角色；
9. 加载 MCU Schema 和 Extension Schema；
10. ADS1115 分类为 Delta-Sigma ADC；
11. AMS1117 分类为 LDO；
12. AO3400 分类为 N-Channel MOSFET；
13. BME280 分类为 Environmental Sensor；
14. 一个 Application Note 不被误分类；
15. 一个 Family Datasheet 对多个 Part 分别处理；
16. 一个冲突器件进入人工审核；
17. 人工选择正确分类；
18. 结果和 Schema 路由回写；
19. 重复提交命中缓存；
20. 切换 Schema Registry 版本后重新路由。

---

# 39. 下游事件

```json
{
  "event_type": "component.schema.ready",
  "event_version": "1.0",
  "part_id": "uuid",
  "document_id": "uuid",
  "version_id": "uuid",
  "classification_result_id": "uuid",
  "taxonomy_version": "taxonomy-1.0.0",
  "primary_category": "ic.analog.opamp.general",
  "secondary_roles": [],
  "functional_tags": [
    "dual_channel"
  ],
  "schema_registry_version": "registry-1.0.0",
  "primary_schema": {
    "schema_id": "component.opamp.general.v1",
    "schema_version": "1.0.0",
    "schema_hash": "hex"
  },
  "extension_schemas": [],
  "extraction_plan_uri": "s3://.../extraction_plan.json",
  "classification_confidence": 0.97,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

后续参数抽取 Agent 只处理：

```text
review_status = approved
AND schema exists
AND schema status = active
AND extraction_plan valid
```
