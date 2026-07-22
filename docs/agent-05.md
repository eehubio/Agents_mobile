# 参数抽取与单位归一 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Parameter Extraction & Unit Normalization Agent  
> 中文名：参数抽取与单位归一 Agent  
> 版本：V1.0  
> 定位：规则优先、Schema 驱动、证据可追溯的结构化参数抽取 Agent  
>
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent
> - Datasheet Structure & Visual Asset Locator Agent
>
> 下游：
> - 参数知识库与检索
> - 器件对比
> - 替代料推荐
> - BOM 风险与采购
> - 电路设计约束生成
> - 引脚、封装与订货型号 Agent
> - Datasheet 版本差异分析
> - Evidence Anchoring 与人工审核
>
> 目标读者：产品负责人、后端工程师、数据工程师、算法工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的 Datasheet 参数抽取与单位归一 Agent。

该 Agent 接收：

- 已确认的器件分类；
- 已选择的参数 Schema；
- Extraction Plan；
- 已定位的章节和表格；
- Canonical Document IR；
- Part、Family、Package 和 Ordering Variant 上下文。

完成：

1. 根据 Schema 生成目标参数任务；
2. 从 Features、Recommended Operating Conditions、Electrical Characteristics、Absolute Maximum Ratings、Typical Characteristics 等来源抽取参数候选；
3. 解析参数名称、符号、Min、Typ、Max、单位和测试条件；
4. 解析温度、供电、电流、负载、频率、增益、模式、封装、通道等条件；
5. 解析脚注、表头继承、合并单元格和跨页表格；
6. 处理 Family Datasheet 中不同型号和不同后缀的适用关系；
7. 识别 Guaranteed、Typical、Maximum Rating、Recommended、Derived 等规格性质；
8. 完成单位识别、量纲校验和规范化；
9. 保留原始字符串和原始单位，不覆盖证据；
10. 从多个观测值中选择用于检索和比较的标准参数；
11. 识别冲突、异常、缺失和低置信度结果；
12. 输出带证据、条件和版本信息的参数结果；
13. 低置信度或关键冲突进入人工审核；
14. 为批量处理 110 万器件提供幂等、缓存和增量更新能力。

---

# 2. 核心输出不是一个数值，而是三层数据

参数系统必须区分：

```text
Raw Evidence
    ↓
Parameter Observation
    ↓
Canonical Parameter Fact
```

## 2.1 Raw Evidence

来自 PDF 的原始内容，例如：

```text
Parameter: Input Offset Voltage
Symbol: VOS
Condition: VCM = 0 V, TA = 25°C
Min: —
Typ: 0.5
Max: 3
Unit: mV
Footnote: 1
```

必须保存：

- 原始文字；
- 原始表格单元格；
- 页码；
- bbox；
- table_id；
- row/column；
- block_id；
- 脚注；
- 解析器来源。

## 2.2 Parameter Observation

将原始内容转换成结构化观测：

```json
{
  "field_id": "input_offset_voltage",
  "value_shape": "min_typ_max",
  "raw": {
    "min": null,
    "typ": "0.5",
    "max": "3",
    "unit": "mV"
  },
  "normalized": {
    "min": null,
    "typ": "0.0005",
    "max": "0.003",
    "unit": "V"
  },
  "conditions": [
    {
      "field": "ambient_temperature",
      "operator": "eq",
      "value": "25",
      "unit": "Cel"
    }
  ]
}
```

一行表格可以生成一个或多个 Observation。

## 2.3 Canonical Parameter Fact

根据 Schema、来源优先级、条件和冲突规则，从多个 Observation 中选出的标准参数事实。

例如：

```json
{
  "field_id": "input_offset_voltage",
  "selected_observation_id": "uuid",
  "selection_context": "default_comparison",
  "canonical_value": {
    "typ": "0.0005",
    "max": "0.003",
    "unit": "V"
  },
  "confidence": 0.96
}
```

同一字段可以有多个 Fact：

```text
default
at_25c
full_temperature_range
low_voltage_mode
package_specific
channel_specific
variant_specific
```

不能强行将所有条件压缩成一个值。

---

# 3. 与前四个 Agent 的边界

## 3.1 Asset Ingestion Agent

负责：

- 原始 PDF；
- SHA256；
- 文档版本；
- 来源；
- Part 关联。

本 Agent 不重新下载和版本化 PDF。

## 3.2 PDF Parsing & OCR Routing Agent

负责：

- Canonical Document IR；
- 表格单元格；
- 文本；
- bbox；
- reading order；
- OCR 和解析质量。

本 Agent 不重新做整本 OCR。

## 3.3 Classification & Schema Routing Agent

负责：

- primary category；
- parameter Schema；
- required/recommended/optional fields；
- canonical units；
- aliases；
- validation rules；
- source preference；
- Extraction Plan。

本 Agent 必须由 Schema 驱动，不可在代码中写死“运放固定抽 10 个参数”。

## 3.4 Structure & Visual Locator Agent

负责：

- SectionMap；
- TableCatalog；
- FigureCatalog；
- Electrical Characteristics；
- Recommended Operating Conditions；
- Pin、Package、Ordering 等定位；
- logical cross-page tables。

本 Agent 应优先读取定位结果，不扫描整本文档。

## 3.5 本 Agent 不负责

V1 不负责：

- 创建新的正式器件类别；
- 创建未经审核的新 Schema；
- OCR 整本 PDF；
- 识别引脚表的全部业务语义；
- 生成 KiCad；
- 从曲线图自动读取高精度曲线数据；
- 从应用原理图推导电气参数；
- 用大模型猜测缺失数据；
- 把 Typical 值冒充 Guaranteed 值；
- 把 Absolute Maximum 当作推荐工作参数；
- 用分销商网页值覆盖原厂 Datasheet；
- 丢弃原始单位和原始文本。

---

# 4. 设计原则

## 4.1 Schema 驱动

每个抽取任务必须来自版本化 Schema：

```text
field_id
aliases
symbols
dimension
canonical_unit
value_shape
requiredness
preferred_sections
preferred_tables
source_priority
condition_rules
validation_rules
selection_policy
```

## 4.2 先抽取全部观测，再选择标准结果

禁止在识别阶段直接“只取一个值”。

流程：

```text
候选生成
→ Observation 结构化
→ 单位归一
→ 条件绑定
→ 质量校验
→ 冲突分析
→ Fact 选择
```

## 4.3 原始值不可变

必须同时保存：

```text
raw_text
raw_numeric
raw_unit
normalized_value
canonical_unit
conversion_rule
```

任何修正都形成新版本或 Review Patch，不覆盖原始 Observation。

## 4.4 Decimal 优先

电子器件参数可能跨越：

```text
fA → pA → nA → µA → mA → A
```

数值归一应优先使用十进制精确表示，而不是二进制浮点。

建议：

- Python `Decimal`；
- 数据库存 `NUMERIC` 或规范化十进制字符串；
- JSON 中数值优先保存为字符串；
- 仅在计算和排序时转换为 Decimal；
- 不以 JavaScript Number 作为权威存储。

## 4.5 单位归一不等于只换前缀

需要处理：

- SI 前缀；
- 复合单位；
- 温度偏移；
- 对数单位；
- 比率；
- 百分比；
- ppm；
- 每单位；
- 根号频率；
- RMS、peak、peak-to-peak；
- bits、samples/s；
- 无量纲枚举；
- 厂商自定义符号。

## 4.6 条件是参数的一部分

以下两个值不能合并：

```text
VOS = 0.5 mV at TA = 25°C
VOS = 2 mV over -40°C to 125°C
```

Conditions 必须作为结构化对象存储并参与 Fact 选择。

## 4.7 来源语义优先于数值大小

例如：

```text
Absolute Maximum Ratings: VCC = 7 V
Recommended Operating Conditions: VCC = 5.5 V
```

不能因为 7 V 更大，就作为供电电压上限展示。

## 4.8 不确定时不猜

对无法可靠识别的单元格：

```text
parse_status = unresolved
review_required = true
```

而不是自动补零或套用邻行单位。

## 4.9 所有转换可追溯

单位转换必须记录：

```text
unit_registry_version
raw_unit_token
recognized_unit
canonical_unit
scale
offset
conversion_expression
```

## 4.10 规则和模型版本化

必须记录：

- Schema version；
- Extraction policy version；
- Alias dictionary version；
- Unit registry version；
- Condition parser version；
- Table interpreter version；
- Selection policy version；
- 可选模型版本。

---

# 5. 参数值模型

## 5.1 支持的 Value Shape

```text
scalar
min_only
max_only
typ_only
min_max
min_typ_max
nominal_tolerance
range
set
enum
boolean
string
ratio
expression
curve_reference
not_applicable
unknown
```

## 5.2 数值关系

必须支持：

```text
=
<
<=
>
>=
approximately
plus_minus
from_to
up_to
at_least
```

## 5.3 示例

### Min/Typ/Max

```json
{
  "value_shape": "min_typ_max",
  "min": "2.7",
  "typ": "3.3",
  "max": "3.6",
  "unit": "V"
}
```

### Nominal ± tolerance

```json
{
  "value_shape": "nominal_tolerance",
  "nominal": "10",
  "unit": "kOhm",
  "tolerance": {
    "value": "1",
    "unit": "%"
  }
}
```

### Range

```json
{
  "value_shape": "range",
  "lower": "-40",
  "upper": "125",
  "unit": "Cel",
  "lower_inclusive": true,
  "upper_inclusive": true
}
```

### Set

```json
{
  "value_shape": "set",
  "values": ["1.8", "2.5", "3.3", "5.0"],
  "unit": "V"
}
```

### Expression

```json
{
  "value_shape": "expression",
  "raw_expression": "0.3 × VDD",
  "parsed_expression": {
    "operator": "multiply",
    "left": "0.3",
    "right_reference": "VDD"
  }
}
```

V1 可保存 Expression，但不要求求值。

---

# 6. Specification Nature

每条 Observation 必须判断规格性质：

```text
guaranteed
typical
recommended
absolute_maximum
characterized
derived
calculated
informational
marketing_summary
unknown
```

## 6.1 Guaranteed

通常来自：

- Min/Max 列；
- Electrical Characteristics；
- 明确测试条件；
- 厂商声明 guaranteed by test/design。

## 6.2 Typical

来自：

- Typ 列；
- Typical Performance Characteristics；
- Features 中的典型值；
- “typical” 文案。

## 6.3 Absolute Maximum

只表示不可超过的极限。

不得自动成为：

- operating voltage；
- continuous current；
- recommended temperature。

## 6.4 Recommended

来自：

- Recommended Operating Conditions；
- Recommended Supply Voltage；
- Recommended Input Range。

## 6.5 Characterized

典型曲线或非量产保证数据。

## 6.6 Marketing Summary

Features 中的简化值可能缺少条件。

可用作候选，但通常优先级低于规格表。

---

# 7. 数据来源优先级

默认优先级可由 Schema 覆盖。

```text
1. Recommended Operating Conditions
2. Electrical Characteristics
3. Timing / Switching Characteristics
4. Thermal Characteristics
5. Ordering Information
6. Absolute Maximum Ratings
7. Features
8. General Description
9. Typical Performance Characteristics
10. Application Information
```

注意：

- 对 `absolute_maximum_supply_voltage`，Absolute Maximum 应是最高优先级；
- 对 `recommended_supply_voltage`，Recommended Operating Conditions 优先；
- 对 `typical_noise_density`，Typical Performance 或 Electrical Characteristics 可优先；
- 对 package，Ordering / Package 信息优先。

因此优先级必须按 field_id 配置，不能全局固定。

---

# 8. 参数 Schema 扩展要求

第五个 Agent要求第三个 Agent 的 Schema 至少提供：

```yaml
field_id: gain_bandwidth_product
display_name:
  en: Gain Bandwidth Product
  zh: 增益带宽积

dimension: frequency
canonical_unit: Hz
value_shape:
  allowed:
    - typ_only
    - min_typ_max
    - scalar

aliases:
  names:
    - Gain Bandwidth Product
    - Gain-Bandwidth Product
    - Unity-Gain Bandwidth
    - GBW
  symbols:
    - GBW
    - GBP

source_priority:
  - electrical_characteristics
  - features
  - typical_characteristics

table_hints:
  parameter_columns:
    - PARAMETER
    - Parameter
  condition_columns:
    - TEST CONDITIONS
    - CONDITIONS
  value_columns:
    min:
      - MIN
    typ:
      - TYP
      - TYPICAL
    max:
      - MAX
  unit_columns:
    - UNIT

conditions:
  allowed:
    - supply_voltage
    - load_capacitance
    - ambient_temperature
    - gain
    - test_frequency

validation:
  min_allowed:
    value: 0
    unit: Hz
  monotonic:
    - min_le_typ
    - typ_le_max

selection_policy:
  default_context:
    prefer:
      temperature: 25 Cel
      nature:
        - guaranteed
        - typical
```

---

# 9. Extraction Plan

Classification Agent 输出的 Extraction Plan 应进一步包含：

```json
{
  "schema_id": "component.opamp.general.v1",
  "fields": [
    {
      "field_id": "input_offset_voltage",
      "aliases": [
        "Input Offset Voltage",
        "VOS"
      ],
      "preferred_section_types": [
        "electrical_characteristics"
      ],
      "preferred_table_types": [
        "electrical_characteristics"
      ],
      "allowed_dimensions": [
        "voltage"
      ],
      "canonical_unit": "V",
      "required_conditions": [],
      "allowed_conditions": [
        "ambient_temperature",
        "common_mode_voltage",
        "supply_voltage"
      ]
    }
  ]
}
```

本 Agent 应验证 Extraction Plan 与已激活 Schema 一致。

---

# 10. 抽取流程

```text
接收 schema.ready + locator.ready
    ↓
加载 Schema 与 Extraction Plan
    ↓
加载 SectionMap / TableCatalog
    ↓
为每个 field 生成候选源
    ↓
解释表格结构
    ↓
识别参数名和符号
    ↓
解析 Min/Typ/Max
    ↓
解析单位
    ↓
解析行级条件
    ↓
解析表级条件
    ↓
解析脚注
    ↓
解析型号/封装适用关系
    ↓
生成 Parameter Observations
    ↓
单位归一
    ↓
维度与范围校验
    ↓
冲突分析
    ↓
选择 Canonical Facts
    ↓
完整性评分
    ↓
自动批准 / 人工审核
```

---

# 11. 候选源生成

## 11.1 表格候选

优先使用 TableCatalog：

- table_type；
- logical_table；
- section_id；
- page range；
- table title；
- header signature；
- structured cells。

## 11.2 文本候选

用于：

- Features；
- General Description；
- 章节开头摘要；
- 表格脚注；
- 表格上方的全局条件；
- Ordering Information 注释。

## 11.3 图片 OCR 候选

仅用于：

- 表格是图片；
- 关键数值嵌在图中；
- 图内 Package/Pin 标注；
- 上游定位结果明确要求局部 OCR。

V1 默认不从 Typical Curve 读取曲线点。

## 11.4 候选范围控制

不得对每个字段扫描整本 PDF。

按顺序：

1. Schema preferred sections；
2. preferred tables；
3. fallback sections；
4. limited text search；
5. review。

---

# 12. 表格语义解释

Datasheet 表格解析不能只按固定列序号。

## 12.1 典型列角色

```text
parameter_name
symbol
test_condition
min
typ
max
unit
note
variant
channel
mode
temperature
package
```

## 12.2 列角色识别

依据：

- 表头文本；
- 表头层级；
- 合并单元格；
- 单元格内容分布；
- 数值比例；
- 单位比例；
- Schema hints；
- 厂商 Profile；
- 相邻列关系。

## 12.3 表头继承

例如：

```text
             VCC = 5 V
PARAMETER    CONDITIONS    MIN    TYP    MAX    UNIT
```

`VCC = 5 V` 应作为表级条件继承到所有行。

## 12.4 行组继承

例如：

```text
Input Offset Voltage
  TA = 25°C             0.5   3 mV
  TA = -40°C to 125°C         7 mV
```

第二行参数名为空，应继承上一行的参数名。

## 12.5 单位继承

例如单位只出现在组首行。

只在以下条件下继承：

- 同一参数组；
- 同一数值列；
- 中间没有新单位；
- 量纲与 Schema 一致；
- 没有脚注说明不同单位。

## 12.6 Min/Typ/Max 空白

空白不等于 0。

保存：

```text
null
```

以下符号也视情况处理：

```text
—
–
-
N/A
NA
Not Applicable
```

必须区分真正负号和缺失横线。

## 12.7 跨页表格

使用 `logical_table_id`：

- 统一列角色；
- 移除重复表头；
- 保留每个 fragment；
- 不丢页码和 bbox；
- 脚注可能出现在最后一页。

---

# 13. 参数名称与符号匹配

## 13.1 多来源匹配

```text
Schema field name
aliases
symbol aliases
manufacturer aliases
历史人工修正
参数签名
embedding/轻量模型（可选）
```

## 13.2 匹配评分

```text
field_match_score =
  exact_name_score
  + normalized_name_score
  + symbol_score
  + section_score
  + table_type_score
  + unit_dimension_score
  + neighboring_context_score
  - negative_rule_penalty
```

## 13.3 名称标准化

- Unicode normalize；
- 大小写；
- 空格；
- 破折号；
- 括号；
- 下标；
- 上标；
- HTML/PDF 特殊字符；
- 希腊字母；
- μ/u/µ；
- V_DS、VDS、V(D-S) 等符号变体。

## 13.4 不允许仅凭符号决定

`ID` 可能表示：

- Drain Current；
- Device ID；
- Identification。

必须结合类别、参数名、单位和章节。

---

# 14. 数值解析

## 14.1 支持格式

```text
3.3
-40
+125
1,000
1 000
0.5
.5
5.
1.2e-3
1.2 × 10^-3
10⁻³
±2
2 ± 0.1
2.7 to 5.5
2.7–5.5
≤ 3
< 10
≥ 1
Typ. 5
Max. 10
```

## 14.2 特殊符号

```text
∞
NaN
—
N/A
TBD
See Figure
See Note
```

不可转数值时保留 raw，并设置状态。

## 14.3 小数与千位符

按语言和表格上下文判断：

```text
1,234.5
1.234,5
```

不得简单删除所有逗号。

## 14.4 有效数字

保存：

```text
raw_numeric_text
decimal_value
significant_digits
```

归一时不得人为增加精度。

例如：

```text
500 mV → 0.500 V
```

内部可存 0.5，但显示层应能保留原始精度。

---

# 15. 单位系统

## 15.1 两层单位表示

建议同时使用：

```text
internal_unit_id
external_unit_code
```

例如：

```json
{
  "internal_unit_id": "millivolt",
  "symbol": "mV",
  "ucum_code": "mV",
  "dimension": "voltage"
}
```

## 15.2 Unit Registry

Unit Registry 必须版本化，并包含：

- canonical unit；
- aliases；
- symbols；
- SI prefix；
- dimension；
- scale；
- offset；
- conversion type；
- display format；
- UCUM-like code；
- context restrictions。

## 15.3 推荐实现

Python 可使用 Pint 作为基础换算引擎，但不能把业务 Schema 直接等同于 Pint 的默认单位表。

建议：

```text
ezPLM Controlled Unit Registry
    ↓
Pint Conversion Adapter
    ↓
UCUM-compatible external code
```

原因：

- 电子行业存在大量特殊写法；
- 厂商单位符号不统一；
- 某些单位需要上下文；
- dB/dBm、温度和 RMS 需要专项规则；
- 生产数据需要稳定、受控、版本化。

## 15.4 常见基础量纲

```text
voltage
current
resistance
capacitance
inductance
frequency
time
power
energy
temperature
temperature_difference
angle
length
area
mass
charge
conductance
impedance
ratio
dimensionless
data_rate
sample_rate
noise_voltage_density
noise_current_density
slew_rate
thermal_resistance
temperature_coefficient
```

---

# 16. SI 前缀

支持：

```text
Y Z E P T G M k h da
d c m µ u n p f a z y
```

电子行业重点：

```text
M = mega
m = milli
µ/u/μ = micro
n = nano
p = pico
f = femto
k/K = kilo（按单位语境）
```

## 16.1 大小写敏感

```text
mV ≠ MV
MHz ≠ mHz
```

必须严格区分。

## 16.2 micro 字符归一

输入可能为：

```text
µA
μA
uA
```

规范化为同一内部单位，但保留 raw token。

## 16.3 欧姆符号

支持：

```text
Ω
Ohm
ohm
R
kΩ
kohm
MΩ
```

`R` 仅在电阻值上下文中可解释为 ohm，不应全局替换。

---

# 17. 电子行业复合单位

必须支持：

```text
V/us
V/µs
mV/ns
A/us
W/Hz
nV/sqrt(Hz)
nV/√Hz
pA/sqrt(Hz)
ppm/Cel
ppm/°C
Cel/W
°C/W
K/W
V/V
A/V
mA/V
uA/V
dB
dBm
dBc
dBFS
SPS
kSPS
MSPS
bps
kbps
Mbps
baud
rpm
pF
nH
mOhm
uVrms
mVpp
Vpk
```

## 17.1 RMS、Peak、Peak-to-Peak

这些不是简单前缀，应作为 measurement qualifier：

```json
{
  "value": "10",
  "unit": "mV",
  "qualifier": "rms"
}
```

支持：

```text
rms
peak
pk
pp
p-p
peak_to_peak
```

## 17.2 噪声密度

```text
nV/√Hz
pA/√Hz
```

必须有独立量纲，不能转成普通电压或电流。

## 17.3 Slew Rate

```text
V/µs
mV/ns
```

两者可转换，但必须验证量纲为 `voltage/time`。

## 17.4 Thermal Resistance

```text
°C/W
K/W
```

作为温差/功率，不是绝对温度。

---

# 18. 温度处理

## 18.1 区分温度类型

```text
ambient_temperature      TA
junction_temperature     TJ
case_temperature         TC
storage_temperature      TSTG
lead_temperature         TL
operating_temperature
```

## 18.2 绝对温度与温差

```text
25°C
```

是绝对温度。

```text
10°C/W
```

中的 °C 是温差单位。

不得用同一种 offset 规则处理。

## 18.3 范围

```text
TA = -40°C to 125°C
```

结构化为：

```json
{
  "field": "ambient_temperature",
  "operator": "range",
  "lower": "-40",
  "upper": "125",
  "unit": "Cel"
}
```

## 18.4 温度等级

Ordering Information 中：

```text
Industrial
Automotive
Commercial
```

应映射到枚举并保留对应范围证据，不应只保留文字。

---

# 19. 对数和比率单位

## 19.1 dB

dB 是对数比率，不能当作普通线性单位随意换算。

保存：

```text
value
log_reference
quantity_type
```

## 19.2 dBm

dBm 是相对于 1 mW 的功率级。

与 dB 不同。

## 19.3 dBc / dBFS

必须保留参考上下文：

```text
carrier
full_scale
```

## 19.4 百分比与 ppm

```text
1% = 0.01 ratio
100 ppm = 0.0001 ratio
```

内部可同时保存：

```text
display_value
dimensionless_ratio
```

但不得丢失原始表达。

---

# 20. 条件模型

## 20.1 Condition 类型

```text
ambient_temperature
junction_temperature
case_temperature
supply_voltage
input_voltage
output_voltage
common_mode_voltage
load_current
output_current
load_resistance
load_capacitance
source_resistance
test_frequency
sampling_rate
clock_frequency
gain
mode
channel
package
device_variant
process_corner
duty_cycle
pulse_width
measurement_bandwidth
filter
test_circuit
note_reference
```

## 20.2 Condition 结构

```json
{
  "condition_id": "uuid",
  "field": "supply_voltage",
  "symbol": "VCC",
  "operator": "eq",
  "raw_text": "VCC = 5 V",
  "value": {
    "scalar": "5",
    "unit": "V"
  },
  "scope": "table",
  "source": {
    "page": 8,
    "block_id": "p8-b12"
  }
}
```

## 20.3 Scope

```text
document
section
table
column
row_group
row
cell
footnote
```

条件应用优先级：

```text
cell > row > row_group > column > table > section > document
```

低层级覆盖高层级，但必须保留继承链。

## 20.4 复合条件

```text
VCC = 5 V, RL = 10 kΩ, CL = 50 pF, TA = 25°C
```

拆为多个 Condition。

## 20.5 条件中的逻辑

支持：

```text
AND
OR
except
unless
```

V1 至少支持 AND；复杂 OR 可保留 expression 并进入审核。

---

# 21. 脚注解析

脚注可能改变：

- 参数定义；
- 适用型号；
- 测试条件；
- 单位；
- 是否保证；
- 温度范围；
- 封装；
- 通道。

## 21.1 脚注关联

根据：

- 单元格 superscript；
- 行末标记；
- 参数名标记；
- 表题；
- 表后脚注编号；
- page proximity；
- logical table。

## 21.2 脚注结构

```json
{
  "footnote_id": "fn-3",
  "marker": "3",
  "text": "Guaranteed by design, not production tested.",
  "applies_to": [
    {
      "type": "table_row",
      "id": "row-12"
    }
  ],
  "semantic_effects": [
    {
      "type": "specification_nature",
      "value": "guaranteed_by_design"
    }
  ]
}
```

## 21.3 不确定关联

脚注标记丢失时，不得把最后一页所有脚注套给全部参数。

---

# 22. Family Datasheet 与型号适用关系

## 22.1 Applicability Scope

每条 Observation 必须有：

```text
document_default
family_group
base_part
part_variant
ordering_code
package_variant
channel_variant
temperature_grade
unknown
```

## 22.2 表格列中的型号

例如：

```text
PARAMETER | LM358 | LM2904 | UNIT
```

一行可能生成两个 Observation。

## 22.3 型号组标题

例如：

```text
LMV321, LMV358, LMV324
```

应绑定到型号集合。

## 22.4 后缀继承

基础型号的电气参数可能适用于：

```text
LM358
LM358D
LM358DR
LM358P
```

但温度等级和封装可能不同。

必须从上游 Part/Ordering 数据读取后缀规则，不得简单字符串前缀匹配。

## 22.5 不同封装差异

例如：

- Thermal Resistance；
- Power Dissipation；
- Pin Count；
- Package Dimensions。

必须按 package variant 保存，不能聚合为一个值。

---

# 23. Observation 数据结构

```json
{
  "observation_id": "uuid",
  "part_id": "uuid",
  "field_id": "input_offset_voltage",
  "schema_id": "component.opamp.general.v1",
  "schema_version": "1.0.0",

  "parameter_identity": {
    "raw_name": "Input Offset Voltage",
    "normalized_name": "input offset voltage",
    "raw_symbol": "VOS",
    "match_rule_ids": [
      "field.opamp.vos.name.001"
    ],
    "match_confidence": 0.98
  },

  "value": {
    "shape": "min_typ_max",
    "raw": {
      "min": null,
      "typ": "0.5",
      "max": "3",
      "unit": "mV"
    },
    "parsed": {
      "min": null,
      "typ": "0.5",
      "max": "3",
      "unit_id": "millivolt"
    },
    "normalized": {
      "min": null,
      "typ": "0.0005",
      "max": "0.003",
      "unit_id": "volt",
      "unit_code": "V"
    }
  },

  "conditions": [
    {
      "field": "ambient_temperature",
      "operator": "eq",
      "value": "25",
      "unit": "Cel"
    }
  ],

  "applicability": {
    "part_ids": ["uuid"],
    "package_ids": [],
    "ordering_codes": [],
    "channel": null,
    "mode": null
  },

  "specification_nature": "guaranteed",

  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "section_id": "sec-17",
    "logical_table_id": "lt-7",
    "table_fragment_id": "p8-table-1",
    "row": 12,
    "page": 8,
    "bbox": [40, 210, 570, 244],
    "raw_cells": {
      "parameter": "Input Offset Voltage",
      "symbol": "VOS",
      "condition": "VCM = 0 V, TA = 25°C",
      "min": "",
      "typ": "0.5",
      "max": "3",
      "unit": "mV"
    }
  },

  "provenance": {
    "parse_result_id": "uuid",
    "locator_result_id": "uuid",
    "extraction_policy_version": "extractor-1.0.0",
    "unit_registry_version": "units-1.0.0"
  },

  "quality": {
    "extraction_confidence": 0.97,
    "unit_confidence": 0.99,
    "condition_confidence": 0.93,
    "overall_confidence": 0.96,
    "review_required": false
  }
}
```

---

# 24. Fact 选择

## 24.1 为什么需要 Fact

同一参数可能存在：

- Features 典型值；
- Electrical Characteristics 25°C 值；
- 全温区 Max；
- 不同供电电压；
- 不同负载；
- 不同型号；
- 不同封装。

采购检索和产品比较不能直接使用“任意第一条 Observation”。

## 24.2 Fact Context

```text
default_comparison
recommended_operating
absolute_maximum
typical_at_25c
full_temperature_guaranteed
package_specific
variant_specific
mode_specific
```

## 24.3 选择策略

按 Schema 配置：

```yaml
selection_policy:
  default_comparison:
    source_priority:
      - electrical_characteristics
      - recommended_operating_conditions
      - features

    nature_priority:
      - guaranteed
      - recommended
      - typical

    condition_preference:
      ambient_temperature:
        exact: 25
        unit: Cel

    completeness_priority:
      - min_typ_max
      - min_max
      - typ_only
      - scalar
```

## 24.4 不自动合成不存在的 Min/Typ/Max

不能将：

```text
Observation A: Typ = 0.5 mV at 25°C
Observation B: Max = 7 mV over full temperature
```

自动合成同一组：

```text
Typ = 0.5, Max = 7
```

除非明确标记为：

```text
composite_fact
```

并保存两个 Observation 引用。

V1 默认不生成 Composite Fact。

---

# 25. 冲突检测

## 25.1 冲突类型

```text
dimension_conflict
unit_conflict
value_conflict
condition_conflict
source_conflict
variant_conflict
min_typ_max_order_error
schema_range_violation
duplicate_conflict
footnote_conflict
```

## 25.2 Min/Typ/Max 校验

```text
min <= typ <= max
```

仅在：

- 同一 Observation；
- 同一条件；
- 同一适用型号；
- 同一单位；
- 同一统计语义。

## 25.3 正负号

某些参数范围：

```text
Input Offset Voltage: -3 to +3 mV
```

不能简单套用 `min <= typ <= max` 的“幅值越大越坏”逻辑。

Schema 应标记：

```text
signed_range
absolute_limit
magnitude_spec
```

## 25.4 冲突不自动删除

保留所有 Observation，Fact 标记 unresolved 或进入审核。

---

# 26. 校验体系

## 26.1 结构校验

- field_id 存在；
- Schema version 匹配；
- value shape 合法；
- 必填字段存在；
- source evidence 完整。

## 26.2 量纲校验

例如：

```text
gain_bandwidth_product → frequency
input_offset_voltage → voltage
quiescent_current → current
noise_density → voltage/sqrt(frequency)
```

## 26.3 范围校验

Schema 中配置宽松物理边界，避免 OCR 错误：

```text
LDO dropout_voltage 不应为 5000 V
MCU max_frequency 不应为 -100 MHz
MOSFET RDS(on) 不应为负数
```

范围只用于告警，不应轻易自动删除。

## 26.4 跨字段校验

ADC：

```text
ENOB <= resolution_bits
```

LDO：

```text
recommended_output_voltage <= recommended_input_voltage_max
```

MOSFET：

```text
continuous_current <= pulsed_current
```

温度：

```text
lower <= upper
```

## 26.5 来源一致性

Features 和 Electrical Characteristics 差异过大时告警。

---

# 27. 完整性与质量评分

## 27.1 字段级评分

```text
field_quality =
  parameter_match_score
  + table_structure_score
  + numeric_parse_score
  + unit_score
  + condition_score
  + applicability_score
  + source_quality_score
  + evidence_score
  - conflict_penalties
```

## 27.2 文档级评分

```text
required_field_coverage
recommended_field_coverage
valid_unit_ratio
condition_parse_ratio
evidence_completeness
conflict_rate
review_rate
```

## 27.3 强制审核

- 必填参数缺失；
- 单位量纲不匹配；
- Min > Max；
- 关键参数来自 Absolute Maximum 但 Schema 要求 Recommended；
- Family 型号适用关系不清；
- 条件解析失败；
- 脚注改变参数语义但未可靠绑定；
- 同一条件存在显著冲突；
- 数值超出宽松物理范围；
- OCR 置信度低；
- 表格结构质量低；
- 单位未知；
- 对数单位上下文不清；
- 温度是绝对值还是温差不清；
- 参数名只凭符号匹配；
- 选择了 Features 值而规格表存在更权威候选；
- 关键字段只有 marketing summary。

---

# 28. Unit Registry 数据结构

```yaml
unit_registry_version: units-1.0.0

units:
  - unit_id: volt
    symbols:
      - V
      - volt
      - volts
    ucum_code: V
    dimension: voltage
    scale: "1"
    offset: "0"
    conversion_type: linear

  - unit_id: millivolt
    symbols:
      - mV
    ucum_code: mV
    dimension: voltage
    base_unit: volt
    scale: "0.001"
    offset: "0"
    conversion_type: linear

  - unit_id: degree_celsius
    symbols:
      - °C
      - degC
      - Cel
    ucum_code: Cel
    dimension: temperature
    conversion_type: offset

  - unit_id: kelvin_per_watt
    symbols:
      - K/W
      - °C/W
    ucum_code: K/W
    dimension: thermal_resistance
    conversion_type: linear

  - unit_id: nanovolt_per_sqrt_hertz
    symbols:
      - nV/√Hz
      - nV/sqrt(Hz)
    dimension: noise_voltage_density
    canonical_unit: V/sqrt(Hz)
    scale: "1e-9"
```

---

# 29. Unit Parser

## 29.1 处理顺序

```text
Unicode normalize
→ 去除非语义空格
→ 标准化 micro/ohm/degree/root
→ 分离 measurement qualifier
→ 精确 alias 匹配
→ 复合单位解析
→ 量纲检查
→ 上下文消歧
→ 未知单位
```

## 29.2 上下文消歧

```text
m
```

可能是：

- meter；
- milli 前缀；
- 分钟（某些非标准文档）。

必须结合 Schema dimension。

## 29.3 未知单位

输出：

```json
{
  "raw_unit": "LSB rms",
  "status": "unknown_or_contextual",
  "review_required": true
}
```

不得静默丢弃。

## 29.4 自定义单位提交流程

新单位：

```text
discovered
→ review
→ registry proposal
→ tests
→ approved
→ new registry version
```

不能在运行时直接污染全局 Unit Registry。

---

# 30. API 输入

## 30.1 事件输入

建议订阅：

```json
{
  "event_type": "datasheet.locator.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "locator_result_id": "uuid",
  "part_ids": ["uuid"],
  "section_map_uri": "s3://...",
  "table_catalog_uri": "s3://...",
  "figure_catalog_uri": "s3://...",
  "review_status": "approved"
}
```

并关联：

```text
component.schema.ready
datasheet.parse.ready
```

## 30.2 REST 输入

`POST /api/v1/parameter-extractions/jobs`

```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "parse_result_id": "uuid",
  "locator_result_id": "uuid",

  "schema": {
    "schema_id": "component.opamp.general.v1",
    "schema_version": "1.0.0",
    "schema_hash": "hex"
  },

  "extraction_plan_uri": "s3://...",
  "canonical_ir_uri": "s3://...",
  "section_map_uri": "s3://...",
  "table_catalog_uri": "s3://...",

  "mode": "auto",
  "field_ids": null,
  "fact_contexts": [
    "default_comparison",
    "full_temperature_guaranteed"
  ],

  "extraction_policy_version": "extractor-1.0.0",
  "unit_registry_version": "units-1.0.0",
  "selection_policy_version": "selector-1.0.0",
  "idempotency_key": "uuid"
}
```

`mode`：

```text
auto
required_only
selected_fields
observations_only
normalize_only
review_only
benchmark
```

---

# 31. Agent 输出

```json
{
  "agent_id": "parameter-extraction-unit-normalization",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",

  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "part_ids": ["uuid"],
    "parse_result_id": "uuid",
    "locator_result_id": "uuid"
  },

  "schema": {
    "schema_id": "component.opamp.general.v1",
    "schema_version": "1.0.0",
    "schema_hash": "hex"
  },

  "policy": {
    "extraction_policy_version": "extractor-1.0.0",
    "unit_registry_version": "units-1.0.0",
    "condition_parser_version": "conditions-1.0.0",
    "selection_policy_version": "selector-1.0.0"
  },

  "results": {
    "observations_uri": "s3://.../parameter_observations.json.zst",
    "facts_uri": "s3://.../parameter_facts.json",
    "conflicts_uri": "s3://.../parameter_conflicts.json",
    "evidence_manifest_uri": "s3://.../evidence_manifest.json",
    "quality_report_uri": "s3://.../quality_report.json"
  },

  "summary": {
    "required_fields": 12,
    "required_fields_found": 11,
    "recommended_fields": 8,
    "recommended_fields_found": 6,
    "observations_created": 84,
    "facts_selected": 17,
    "conflicts": 2,
    "unknown_units": 0
  },

  "quality": {
    "required_coverage": 0.9167,
    "unit_validity": 1.0,
    "condition_parse_rate": 0.94,
    "evidence_completeness": 1.0,
    "overall_score": 0.94,
    "review_required": true,
    "review_reasons": [
      "required_field_missing"
    ]
  },

  "issues": [],
  "created_at": "ISO-8601"
}
```

---

# 32. 状态机

```text
RECEIVED
  ↓
LOADING_SCHEMA
  ↓
LOADING_EXTRACTION_PLAN
  ↓
LOADING_LOCATOR_RESULTS
  ↓
GENERATING_FIELD_TASKS
  ↓
INTERPRETING_TABLES
  ↓
MATCHING_PARAMETERS
  ↓
PARSING_VALUES
  ↓
PARSING_UNITS
  ↓
PARSING_CONDITIONS
  ↓
RESOLVING_FOOTNOTES
  ↓
RESOLVING_APPLICABILITY
  ↓
BUILDING_OBSERVATIONS
  ↓
NORMALIZING_UNITS
  ↓
VALIDATING_OBSERVATIONS
  ↓
DETECTING_CONFLICTS
  ↓
SELECTING_FACTS
  ↓
EVALUATING_COMPLETENESS
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

# 33. 数据模型

## 33.1 `parameter_extraction_jobs`

```text
id UUID PK
document_id UUID NOT NULL
version_id UUID NOT NULL
parse_result_id UUID NOT NULL
locator_result_id UUID NOT NULL
schema_id VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
schema_hash CHAR(64) NOT NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
extraction_policy_version VARCHAR NOT NULL
unit_registry_version VARCHAR NOT NULL
selection_policy_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 33.2 `parameter_extraction_results`

```text
id UUID PK
job_id UUID NOT NULL
observations_uri TEXT NOT NULL
facts_uri TEXT NOT NULL
conflicts_uri TEXT NOT NULL
evidence_manifest_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
required_coverage NUMERIC(6,5)
overall_quality NUMERIC(6,5)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

## 33.3 `parameter_observation_index`

只保存便于查询的摘要。

```text
id UUID PK
result_id UUID NOT NULL
observation_id UUID NOT NULL
part_id UUID NOT NULL
field_id VARCHAR NOT NULL
value_shape VARCHAR NOT NULL
normalized_min NUMERIC NULL
normalized_typ NUMERIC NULL
normalized_max NUMERIC NULL
normalized_scalar NUMERIC NULL
canonical_unit_id VARCHAR NULL
specification_nature VARCHAR NOT NULL
condition_hash CHAR(64) NOT NULL
applicability_hash CHAR(64) NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
source_page INT NOT NULL
UNIQUE(result_id, observation_id)
```

大体积 conditions、evidence 和 raw cells 放对象存储。

## 33.4 `parameter_fact_index`

```text
id UUID PK
result_id UUID NOT NULL
fact_id UUID NOT NULL
part_id UUID NOT NULL
field_id VARCHAR NOT NULL
fact_context VARCHAR NOT NULL
selected_observation_id UUID NULL
value_shape VARCHAR NOT NULL
normalized_min NUMERIC NULL
normalized_typ NUMERIC NULL
normalized_max NUMERIC NULL
normalized_scalar NUMERIC NULL
canonical_unit_id VARCHAR NULL
condition_hash CHAR(64) NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, fact_id)
```

## 33.5 `unit_registry_versions`

```text
id UUID PK
version VARCHAR UNIQUE NOT NULL
status VARCHAR NOT NULL
definition_uri TEXT NOT NULL
definition_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
activated_at TIMESTAMPTZ NULL
deprecated_at TIMESTAMPTZ NULL
```

## 33.6 `unit_definitions`

```text
id UUID PK
registry_id UUID NOT NULL
unit_id VARCHAR NOT NULL
dimension VARCHAR NOT NULL
canonical_unit_id VARCHAR NULL
ucum_code VARCHAR NULL
symbols JSONB NOT NULL
scale NUMERIC NULL
offset NUMERIC NULL
conversion_type VARCHAR NOT NULL
qualifiers JSONB NOT NULL
status VARCHAR NOT NULL
UNIQUE(registry_id, unit_id)
```

## 33.7 `parameter_extraction_reviews`

```text
id UUID PK
job_id UUID NOT NULL
object_type VARCHAR NOT NULL
object_id UUID NULL
field_id VARCHAR NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
assigned_to VARCHAR NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 33.8 `parameter_extraction_events`

```text
id BIGSERIAL PK
job_id UUID NOT NULL
event_type VARCHAR NOT NULL
step VARCHAR NOT NULL
payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

---

# 34. 产物存储

```text
derived/parameter-extraction/
  {source_sha256}/
    {schema_id}/
      {schema_version}/
        {extraction_policy_version}/
          observations/
            parameter_observations.json.zst
          facts/
            parameter_facts.json
          conflicts/
            parameter_conflicts.json
          evidence/
            evidence_manifest.json
            row_snapshots/
            table_snapshots/
          debug/
            candidate_matches.json.zst
            table_role_assignments.json
            unit_parse_log.json
            condition_parse_log.json
            selection_log.json
          quality_report.json
          result_manifest.json
```

PostgreSQL 不保存完整 Observation JSON。

---

# 35. 规则与配置目录

```text
policies/
├── extractor-1.0.0.yaml
├── selector-1.0.0.yaml
├── conditions-1.0.0.yaml
├── table-roles-1.0.0.yaml
├── field-aliases/
│   ├── common.yaml
│   ├── mcu.yaml
│   ├── opamp.yaml
│   ├── adc.yaml
│   ├── ldo.yaml
│   ├── mosfet.yaml
│   └── sensor.yaml
├── manufacturer-profiles/
│   ├── texas-instruments.yaml
│   ├── analog-devices.yaml
│   ├── stmicroelectronics.yaml
│   ├── nxp.yaml
│   └── onsemi.yaml
└── source-priority/
    ├── common.yaml
    └── category-overrides.yaml

units/
├── units-1.0.0.yaml
├── aliases.yaml
├── electronic-compound-units.yaml
├── qualifiers.yaml
└── dimensions.yaml
```

---

# 36. Rule DSL 示例

## 36.1 字段匹配规则

```yaml
rule_id: opamp.input_offset_voltage.001
field_id: input_offset_voltage
priority: 100

when:
  any:
    - source: parameter_name
      normalized_equals: input offset voltage
    - source: parameter_symbol
      regex: '^V[_\s]?(OS|IO)$'

require:
  table_type:
    any_of:
      - electrical_characteristics
  unit_dimension:
    equals: voltage

unless:
  any:
    - source: parameter_name
      contains: drift
    - source: parameter_name
      contains: temperature coefficient
```

## 36.2 条件规则

```yaml
rule_id: condition.temperature.001
target: ambient_temperature

patterns:
  - regex: '\bT[Aa]\s*=\s*(?<value>[+-]?\d+(?:\.\d+)?)\s*°?\s*C\b'
  - regex: '\bambient temperature\s*=\s*(?<value>.+)$'
```

## 36.3 单位规则

```yaml
rule_id: unit.microampere.001
unit_id: microampere

symbols:
  - µA
  - μA
  - uA

dimension: current
canonical_unit: ampere
scale: "0.000001"
```

---

# 37. 错误码

```text
SCHEMA_NOT_FOUND
SCHEMA_VERSION_MISMATCH
SCHEMA_HASH_MISMATCH
EXTRACTION_PLAN_INVALID
LOCATOR_RESULT_NOT_FOUND
CANONICAL_IR_NOT_FOUND
TABLE_CATALOG_INVALID
NO_TARGET_SOURCE
TABLE_STRUCTURE_INVALID
COLUMN_ROLE_UNRESOLVED
PARAMETER_MATCH_FAILED
PARAMETER_MATCH_AMBIGUOUS
NUMERIC_PARSE_FAILED
UNIT_UNKNOWN
UNIT_AMBIGUOUS
UNIT_DIMENSION_MISMATCH
UNIT_CONVERSION_FAILED
TEMPERATURE_CONTEXT_AMBIGUOUS
CONDITION_PARSE_FAILED
FOOTNOTE_LINK_FAILED
APPLICABILITY_UNRESOLVED
MIN_TYP_MAX_ORDER_ERROR
VALUE_OUT_OF_SCHEMA_RANGE
OBSERVATION_CONFLICT
FACT_SELECTION_FAILED
REQUIRED_FIELD_MISSING
EVIDENCE_INCOMPLETE
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

每个错误标记：

- 是否可重试；
- 是否只影响某字段；
- 是否阻止 Fact 选择；
- 是否需要人工审核。

---

# 38. API

## 38.1 写接口

```text
POST /api/v1/parameter-extractions/jobs
POST /api/v1/parameter-extractions/batches
POST /api/v1/parameter-extractions/jobs/{job_id}/retry
POST /api/v1/parameter-extractions/jobs/{job_id}/cancel
POST /api/v1/parameter-extractions/jobs/{job_id}/rerun-fields
POST /api/v1/parameter-extractions/jobs/{job_id}/renormalize
POST /api/v1/parameter-extractions/reviews/{review_id}/resolve

POST /api/v1/unit-registry/validate
POST /api/v1/unit-registry/publish
POST /api/v1/unit-registry/compare
```

## 38.2 读接口

```text
GET /api/v1/parameter-extractions/jobs/{job_id}
GET /api/v1/parameter-extractions/jobs/{job_id}/events
GET /api/v1/parameter-extractions/results/{result_id}
GET /api/v1/parameter-extractions/results/{result_id}/observations
GET /api/v1/parameter-extractions/results/{result_id}/facts
GET /api/v1/parameter-extractions/results/{result_id}/conflicts

GET /api/v1/components/{part_id}/parameters
GET /api/v1/components/{part_id}/parameters/{field_id}
GET /api/v1/components/{part_id}/parameter-evidence/{field_id}

GET /api/v1/unit-registry
GET /api/v1/unit-registry/{version}
GET /api/v1/unit-registry/{version}/units
GET /api/v1/unit-registry/{version}/units/{unit_id}

GET /api/v1/parameter-extraction-reviews
GET /health/live
GET /health/ready
GET /metrics
```

---

# 39. 人工审核界面要求

## 39.1 参数审核卡

显示：

- Field；
- Schema 定义；
- 原始表格行；
- 参数名；
- Symbol；
- Min/Typ/Max；
- 原始单位；
- 标准单位；
- 条件；
- 脚注；
- 适用型号；
- Specification Nature；
- 候选 Observation；
- Fact 选择原因；
- PDF 页和 bbox。

## 39.2 操作

- 修改 field 映射；
- 修改 Min/Typ/Max；
- 修改原始单位识别；
- 修改标准单位；
- 添加/删除条件；
- 修改适用型号；
- 修改 specification nature；
- 选择 Fact；
- 标记 N/A；
- 标记 Datasheet 未提供；
- 提交新 alias 候选；
- 提交新单位候选；
- 标记上游表格解析错误。

## 39.3 Patch 机制

人工修订必须以 Patch 保存：

```json
{
  "target": "observation-id",
  "operations": [
    {
      "op": "replace",
      "path": "/value/raw/max",
      "value": "3"
    }
  ],
  "reason": "OCR misread 3 as 8",
  "reviewer": "user-id"
}
```

不覆盖原始记录。

---

# 40. 可观测性

## 40.1 Prometheus

```text
parameter_extraction_jobs_total{status,mode}
parameter_extraction_duration_seconds{step}
parameter_observations_total{field_id,category}
parameter_facts_total{field_id,context}
parameter_required_coverage{schema_id}
parameter_unit_parse_total{status,unit_id}
parameter_unit_unknown_total{raw_unit}
parameter_condition_parse_total{status,condition_type}
parameter_conflicts_total{type,field_id}
parameter_review_total{reason,field_id}
parameter_fact_selection_total{source_type,nature}
parameter_schema_range_violations_total{field_id}
parameter_extraction_rule_hits_total{rule_id}
parameter_extraction_cache_hits_total
```

## 40.2 Dashboard

展示：

- 每日处理 Datasheet；
- Required Coverage；
- 各类别字段覆盖率；
- Unit Unknown 排名；
- 条件解析失败排名；
- 高频冲突字段；
- 人工修正率；
- Min/Typ/Max 完整率；
- 规格表与 Features 冲突率；
- 各制造商质量；
- 各解析器质量；
- 各 Schema 版本质量；
- 新旧规则版本对比。

---

# 41. 测试数据集

公开仓库只使用合成或授权数据。

## 41.1 基础数值和单位

1. V → V；
2. mV → V；
3. µV/uV/μV；
4. A/mA/µA/nA/pA；
5. Hz/kHz/MHz/GHz；
6. Ω/kΩ/MΩ/mΩ；
7. pF/nF/µF；
8. nH/µH/mH；
9. ns/µs/ms/s；
10. W/mW/µW；
11. °C/K；
12. °C/W 与 K/W；
13. V/µs；
14. nV/√Hz；
15. pA/√Hz；
16. ppm/°C；
17. %；
18. dB；
19. dBm；
20. MSPS/kSPS/SPS。

## 41.2 数值格式

21. 1.2e-3；
22. 1.2 × 10^-3；
23. ±2；
24. -40 to 125；
25. ≤3；
26. ≥1；
27. 1,000；
28. 1.234,5；
29. 缺失横线；
30. N/A；
31. See Note；
32. 0 与空白区别。

## 41.3 表格

33. 标准 Min/Typ/Max；
34. Min 和 Max；
35. Typ only；
36. 单位只在组首；
37. 参数名只在组首；
38. 表级 VCC 条件；
39. 列级温度；
40. 行级负载；
41. 合并单元格；
42. 跨页表格；
43. 重复表头；
44. 表后脚注；
45. 脚注跨页；
46. 无边框表格；
47. OCR 表格。

## 41.4 业务语义

48. Recommended 与 Absolute Max；
49. Guaranteed 与 Typical；
50. Features 与 Electrical 冲突；
51. 25°C 与全温区；
52. 不同供电电压；
53. 不同增益；
54. 不同负载；
55. 不同通道；
56. 不同工作模式；
57. MCU 内置 ADC 参数；
58. 运放 VOS 与 VOS Drift；
59. MOSFET RDS(on) 多 VGS 条件；
60. LDO dropout 多负载条件；
61. ADC SNR 多采样率；
62. Sensor accuracy 多温区；
63. Thermal Resistance 多封装；
64. Family 不同型号列；
65. 型号后缀与封装；
66. 同一字段多个 Observation；
67. Fact 选择；
68. 高置信度冲突；
69. 未知单位；
70. 单位量纲错误。

---

# 42. Benchmark

## 42.1 标注内容

每个标注 Observation 包含：

- field_id；
- raw parameter name；
- symbol；
- Min/Typ/Max；
- unit；
- canonical value；
- conditions；
- applicability；
- specification nature；
- source page/table/row；
- Fact context。

## 42.2 指标

### 参数识别

- Field Mapping Precision；
- Field Mapping Recall；
- Field Mapping Macro F1；
- Symbol Match Accuracy。

### 数值

- Numeric Cell Accuracy；
- Min/Typ/Max Slot Accuracy；
- Range Parse Accuracy；
- Sign Accuracy；
- Inequality Accuracy。

### 单位

- Unit Recognition Accuracy；
- Dimension Accuracy；
- Normalization Accuracy；
- Unknown Unit Precision/Recall。

### 条件

- Condition Type F1；
- Condition Value Accuracy；
- Condition Scope Accuracy；
- Footnote Association Accuracy。

### 适用关系

- Part Applicability Accuracy；
- Package Applicability Accuracy；
- Variant Applicability Accuracy。

### Fact

- Fact Selection Accuracy；
- Source Nature Accuracy；
- Required Field Coverage；
- False Fact Rate。

## 42.3 分组报告

必须按：

- 器件类别；
- 厂商；
- 文档语言；
- 扫描/原生；
- 单型号/Family；
- 表格类型；
- 参数字段；
- 单位类型；
- 解析器；
- Schema 版本。

不能只报告总体平均。

---

# 43. 初始质量目标

在内部人工标注基准集上：

```text
Field Mapping F1 >= 95%
数值槽位准确率 >= 98%
单位识别准确率 >= 99%
单位归一准确率 >= 99%
条件类型 F1 >= 92%
条件值准确率 >= 95%
Specification Nature 准确率 >= 95%
Fact Selection 准确率 >= 95%
Required Field 自动抽取覆盖率 >= 90%
高置信度自动批准准确率 >= 98%
```

这些是目标，不是未经评测的保证。

---

# 44. 工程验收标准

## 44.1 功能

- 能消费 component.schema.ready；
- 能消费 datasheet.locator.ready；
- 能读取 Canonical IR；
- 能按 Schema 抽取；
- 能生成全部 Observation；
- 能解析 Min/Typ/Max；
- 能解析范围和不等式；
- 能解析表/行/列/脚注条件；
- 能解析温度条件；
- 能处理 Family 型号；
- 能识别 Specification Nature；
- 能归一常见电子单位；
- 能处理复合单位；
- 能处理温度偏移；
- 能处理 dB/dBm；
- 能检测量纲错误；
- 能选择 Fact；
- 能保留证据；
- 能进入人工审核；
- 能人工 Patch；
- 能发布下游事件；
- 所有写操作幂等。

## 44.2 工程质量

- 单元测试覆盖率 >= 85%；
- Numeric Parser 覆盖率 >= 95%；
- Unit Parser 与 Conversion 覆盖率 >= 95%；
- Condition Parser 覆盖率 >= 90%；
- 所有 Rule 有测试；
- JSON Schema 通过；
- Migration upgrade/downgrade 通过；
- Ruff 通过；
- mypy 通过；
- Decimal 全链路测试通过；
- 不使用 float 作为权威数值；
- 不提交真实受版权保护 Datasheet；
- 不伪造指标。

## 44.3 性能

- 只处理目标章节和表格；
- 不重新解析整本 PDF；
- 相同 Datasheet + Schema + Policy 命中缓存；
- Family Datasheet 只解析一次，按 Part 分发结果；
- 典型 50 页 Datasheet 的参数抽取目标小于 15 秒，不含上游 PDF 解析；
- 批量处理支持按字段拆分；
- Unit Normalization 可单独重跑，不必重新抽取；
- Schema 版本变化只重跑受影响字段；
- Unit Registry 变化只重跑受影响单位。

---

# 45. 缓存与增量更新

缓存键：

```text
source_sha256
+ parse_result_version
+ locator_result_version
+ schema_hash
+ extraction_policy_version
+ unit_registry_version
+ selection_policy_version
```

## 45.1 Schema 变化

Schema Diff 判断：

- 新增字段 → 只抽新增字段；
- alias 变化 → 重跑受影响字段；
- canonical unit 变化 → 只重归一；
- selection policy 变化 → 只重选 Fact；
- validation 变化 → 只重校验。

## 45.2 Datasheet 新版本

新 PDF 版本必须新建结果，不覆盖旧结果。

后续可由 Version Diff Agent 对比 Observation 和 Fact。

---

# 46. 推荐仓库结构

如果前四个 Agent 位于同一 monorepo，应复用：

- 事件；
- 对象存储；
- Job；
- Review；
- Audit；
- Canonical IR；
- Schema Registry；
- Locator Catalog。

```text
parameter-extraction-unit-normalization/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── parameter-extraction-unit-normalization-agent-spec.md
│   ├── observation-model.md
│   ├── fact-selection.md
│   ├── unit-registry.md
│   ├── condition-model.md
│   ├── table-interpretation.md
│   ├── family-applicability.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-observation-fact-separation.md
│       ├── 0002-decimal-values.md
│       ├── 0003-controlled-unit-registry.md
│       ├── 0004-conditions-first-class.md
│       └── 0005-no-external-llm-v1.md
├── src/
│   └── parameter_extractor/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── schema/
│       │   ├── loader.py
│       │   ├── extraction_plan.py
│       │   └── validator.py
│       ├── candidates/
│       │   ├── source_planner.py
│       │   ├── table_candidates.py
│       │   └── text_candidates.py
│       ├── tables/
│       │   ├── header_analyzer.py
│       │   ├── column_roles.py
│       │   ├── row_groups.py
│       │   ├── inheritance.py
│       │   ├── footnotes.py
│       │   └── logical_table.py
│       ├── matching/
│       │   ├── name_normalizer.py
│       │   ├── symbol_normalizer.py
│       │   ├── alias_matcher.py
│       │   ├── scorer.py
│       │   └── conflict_resolver.py
│       ├── numeric/
│       │   ├── tokenizer.py
│       │   ├── decimal_parser.py
│       │   ├── range_parser.py
│       │   ├── inequality_parser.py
│       │   └── significant_digits.py
│       ├── units/
│       │   ├── registry.py
│       │   ├── normalizer.py
│       │   ├── parser.py
│       │   ├── pint_adapter.py
│       │   ├── dimensionality.py
│       │   ├── logarithmic.py
│       │   ├── temperature.py
│       │   └── qualifiers.py
│       ├── conditions/
│       │   ├── parser.py
│       │   ├── scope.py
│       │   ├── inheritance.py
│       │   ├── temperature.py
│       │   └── symbols.py
│       ├── applicability/
│       │   ├── family.py
│       │   ├── variants.py
│       │   ├── packages.py
│       │   └── channels.py
│       ├── observations/
│       │   ├── builder.py
│       │   ├── normalizer.py
│       │   └── validator.py
│       ├── facts/
│       │   ├── selector.py
│       │   ├── contexts.py
│       │   ├── conflicts.py
│       │   └── selection_log.py
│       ├── evidence/
│       ├── quality/
│       ├── review/
│       ├── storage/
│       └── observability/
├── units/
├── policies/
├── schemas/
│   ├── parameter-observation.schema.json
│   ├── parameter-fact.schema.json
│   ├── condition.schema.json
│   ├── unit-definition.schema.json
│   └── extraction-result.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── numeric/
│   ├── units/
│   ├── conditions/
│   ├── tables/
│   ├── applicability/
│   ├── facts/
│   ├── regression/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── compile_unit_registry.py
    ├── validate_unit_registry.py
    ├── run_parameter_benchmark.py
    ├── compare_policy_versions.py
    ├── export_review_dataset.py
    └── reprocess_affected_fields.py
```

---

# 47. Codex 分阶段实施

不要让 Codex 一次实现全部功能。

## Phase 0：仓库侦察与数据契约对齐

Codex 必须：

1. 阅读前四个 Agent 的规格和代码；
2. 打开实际 Schema Registry；
3. 打开实际 Extraction Plan；
4. 打开 Canonical IR；
5. 打开 SectionMap 和 TableCatalog；
6. 找出现有元器件参数表；
7. 找出现有单位、Min/Typ/Max、测试条件字段；
8. 找出现有 110 万器件数据迁移约束；
9. 输出实施计划；
10. 输出现有数据到 Observation/Fact 的迁移方案；
11. 输出 Unit Registry 方案；
12. 不修改业务代码；
13. 不创建 Migration；
14. 不安装依赖。

## Phase 1：领域模型与 JSON Schema

实现：

- Parameter Observation；
- Parameter Fact；
- Condition；
- Applicability；
- Evidence；
- Conflict；
- Job/Result/Event；
- JSON Schema；
- Mock 数据。

验收：

- Schema 校验通过；
- Decimal 字符串策略测试通过。

## Phase 2：Unit Registry 与基础单位换算

实现：

- Controlled Unit Registry；
- Unit definition；
- aliases；
- SI prefixes；
- Pint Adapter；
- UCUM-compatible code；
- voltage/current/frequency/time/resistance/capacitance/inductance/power；
- Registry compiler；
- Registry validator。

验收：

- V/mV、A/mA/µA、Hz/kHz/MHz 等测试通过；
- 大小写测试通过；
- micro 字符测试通过。

## Phase 3：高级电子单位

实现：

- °C/K；
- temperature difference；
- °C/W；
- V/µs；
- nV/√Hz；
- pA/√Hz；
- ppm/°C；
- %；
- RMS/peak/pp；
- SPS；
- dB/dBm/dBc/dBFS；
- Unknown Unit workflow。

验收：

- 对数和 offset 单位不发生错误线性换算。

## Phase 4：Numeric Parser

实现：

- Decimal；
- 科学计数法；
- ±；
- range；
- inequalities；
- 千位/小数分隔；
- missing tokens；
- significant digits；
- raw preservation。

验收：

- 数值 Fixture 全部通过。

## Phase 5：表格列角色和继承

实现：

- header tree；
- parameter/symbol/condition/min/typ/max/unit；
- table condition；
- row group；
- unit inheritance；
- parameter inheritance；
- logical cross-page table；
- repeated headers。

验收：

- 标准和复杂表格正确生成 Cell Roles。

## Phase 6：参数名称和 Symbol 匹配

实现：

- aliases；
- symbols；
- category context；
- table/section context；
- unit dimension；
- negative rules；
- Top-K；
- Match Evidence。

验收：

- 核心类别字段映射正确；
- VOS 与 VOS Drift 不混淆。

## Phase 7：Condition Parser

实现：

- temperature；
- supply；
- load；
- frequency；
- gain；
- mode；
- channel；
- table/row/column/cell scope；
- inheritance；
- compound conditions。

验收：

- 条件继承和覆盖正确。

## Phase 8：脚注与 Specification Nature

实现：

- footnote linking；
- guaranteed；
- typical；
- recommended；
- absolute maximum；
- characterized；
- marketing summary；
- source priority。

验收：

- Absolute Maximum 不误选为 Recommended。

## Phase 9：Family 与 Applicability

实现：

- part columns；
- family groups；
- ordering variants；
- packages；
- temperature grade；
- channels；
- base part inheritance；
- unresolved review。

验收：

- Family Datasheet 不机械复制错误参数。

## Phase 10：Observation Builder 与校验

实现：

- Observation；
- raw/parsed/normalized；
- evidence；
- Decimal；
- dimensional checks；
- schema range；
- min/typ/max；
- cross-field validation；
- conflict records。

验收：

- 所有 Observation 可追溯。

## Phase 11：Fact Selector

实现：

- contexts；
- source priority；
- nature priority；
- condition preference；
- selection logs；
- unresolved；
- no implicit composite facts。

验收：

- default、25°C、full temperature Facts 正确选择。

## Phase 12：审核、Patch 与回写

实现：

- Review API；
- Observation correction；
- Fact override；
- Unit proposal；
- Alias proposal；
- Patch history；
- feedback dataset。

验收：

- 原始 Observation 不被覆盖。

## Phase 13：完整 API、事件、批处理和缓存

实现：

- API；
- event subscription；
- downstream event；
- batch；
- retry/cancel；
- field rerun；
- renormalize；
- incremental Schema update；
- Family reuse；
- idempotency。

验收：

- schema.ready + locator.ready 到 parameters.ready 端到端通过。

## Phase 14：Benchmark、监控与生产发布

实现：

- 合成测试集；
- 内部标注集；
- 指标；
- 分组报告；
- Prometheus；
- Dashboard；
- README；
- 运维；
- Unit Registry 升级与回滚；
- Schema 变更影响分析。

---

# 48. Codex 工作纪律

Codex 必须：

1. 先读取实际 Schema 和 Locator 输出；
2. 不重新解析整本 PDF；
3. 不创建第二套 Schema；
4. Observation 与 Fact 分离；
5. Raw 与 Normalized 分离；
6. 使用 Decimal；
7. 不以 float 作为权威数据；
8. 空白不等于 0；
9. 不把 Absolute Maximum 当 Recommended；
10. 不把 Typical 当 Guaranteed；
11. 不将不同条件的值强行合并；
12. 不机械复制 Family 参数；
13. 所有条件结构化；
14. 所有单位转换记录规则；
15. 所有结果保留 evidence；
16. 所有规则配置化；
17. 所有 Registry 和 Policy 版本化；
18. 不调用外部通用 LLM；
19. 不用 LLM 猜缺失参数；
20. 不覆盖原始 Observation；
21. 不覆盖人工审核结果；
22. 不把完整 Observation 写入主数据库；
23. 不提交真实受版权保护 Datasheet；
24. 不伪造准确率；
25. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Unit Registry 变化；
    - Policy 变化；
    - 测试命令；
    - 真实测试结果；
    - Benchmark；
    - 性能结果；
    - 已知问题；
    - 下一阶段建议。

---

# 49. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/parameter-extraction-unit-normalization-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第五个基础 Agent：

Parameter Extraction & Unit Normalization Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. docs/datasheet-asset-ingestion-agent-spec.md；
3. docs/pdf-parsing-ocr-router-agent-spec.md；
4. docs/component-classification-schema-router-agent-spec.md；
5. docs/datasheet-structure-visual-locator-agent-spec.md；
6. docs/parameter-extraction-unit-normalization-agent-spec.md；
7. 前四个 Agent 的实际代码、Schema、事件协议和测试；
8. 当前 ezPLM 物料参数数据表；
9. 当前参数模板、单位字段、Min/Typ/Max 字段和条件字段；
10. 当前数据库、对象存储、任务队列、审核、日志、Docker 和 CI。

本 Agent 的职责是：

- 消费 component.schema.ready；
- 消费 datasheet.locator.ready；
- 根据 Schema 和 Extraction Plan 定位参数来源；
- 从参数表和文本中抽取参数名称、Symbol、Min、Typ、Max、范围和不等式；
- 解析表级、列级、行组、行、单元格和脚注条件；
- 解析 TA/TJ/TC、供电、负载、频率、增益、模式、通道等条件；
- 识别 Guaranteed、Typical、Recommended、Absolute Maximum、Characterized 和 Marketing Summary；
- 处理 Family Datasheet、型号变体、订货后缀和封装适用关系；
- 将 V/mV、A/mA/µA、Hz/kHz/MHz 等单位归一；
- 支持 °C/K、°C/W、V/µs、nV/√Hz、ppm/°C、%、dB/dBm 等电子行业单位；
- 保留 raw value、raw unit、normalized value、conditions、evidence 和版本；
- 先生成全部 Parameter Observation，再根据 Selection Policy 生成 Parameter Fact；
- 冲突和低置信度结果进入人工审核；
- 发布 component.parameters.ready。

硬约束：

- Observation 与 Fact 必须分离；
- Raw 与 Normalized 必须分离；
- 所有权威数值使用 Decimal 或十进制字符串；
- 不使用 float 作为权威存储；
- 空白单元格不等于 0；
- 不把 Absolute Maximum 当作 Recommended Operating；
- 不把 Typical 当作 Guaranteed；
- 不将不同温度、供电、负载或模式下的值自动合并；
- 不自动生成不存在的 Composite Min/Typ/Max；
- Family Datasheet 不得机械复制到所有型号；
- 所有 Condition 是一等数据对象；
- 所有单位转换必须记录 unit registry version 和 conversion；
- dB、dBm、温度 offset 和 temperature difference 必须专项处理；
- Unit Registry 必须受控、版本化；
- 不在运行时自动创建正式单位；
- 不重新做整本 PDF 解析或 OCR；
- 不创建第二套参数 Schema；
- PostgreSQL 不存放完整 Observation JSON；
- V1 不调用外部通用大模型；
- 不用 LLM 猜缺失值；
- 不覆盖原始 Observation；
- 不覆盖人工审核结果；
- 不提交真实受版权保护 Datasheet；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查前四个 Agent 的实际完成程度；
3. 打开并分析实际 Parameter Schema；
4. 打开实际 Extraction Plan；
5. 打开实际 Canonical IR、SectionMap 和 TableCatalog；
6. 查找 ezPLM 当前参数表、单位表、条件字段和历史参数数据；
7. 识别现有数据与 Observation/Fact 模型的差异；
8. 识别 Decimal、NUMERIC、JSON 数值的现有使用方式；
9. 检查当前是否已使用 Pint、UCUM 或其他单位库；
10. 在 docs/parameter-extraction-implementation-plan.md 中生成实施计划；
11. 在 docs/parameter-observation-fact-migration-plan.md 中生成旧数据迁移方案；
12. 在 docs/controlled-unit-registry-design.md 中生成 Unit Registry 方案；
13. 在 docs/parameter-condition-model.md 中生成 Condition 模型；
14. 在 docs/parameter-extraction-benchmark-plan.md 中生成 Benchmark 计划；
15. 给出拟新增、拟修改和拟复用文件清单；
16. 给出 Phase 1 精确修改范围；
17. 不修改业务代码；
18. 不创建数据库 Migration；
19. 不安装新依赖；
20. 运行当前仓库已有 lint、type check 和测试。

如果环境无法运行测试，记录准确原因，不得编造结果。

最终回复必须包含：

- 仓库现状；
- 与前四个 Agent 的衔接；
- 当前参数数据模型；
- Observation/Fact 设计；
- Unit Registry 设计；
- Condition 模型；
- Family Datasheet 处理；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 50. 后续 Phase 提示词模板

```text
继续实现 Parameter Extraction & Unit Normalization Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读五个 Agent 的规格；
3. 阅读 docs/parameter-extraction-implementation-plan.md；
4. 阅读 Observation/Fact Migration Plan；
5. 阅读 Controlled Unit Registry Design；
6. 阅读 Condition Model；
7. 检查上一阶段代码和测试；
8. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Observation 与 Fact 分离；
- Raw 与 Normalized 分离；
- Decimal；
- 条件是一等对象；
- 不混淆 Absolute/Recommended/Typical/Guaranteed；
- 不合并不同条件；
- Family 不机械复制；
- 单位 Registry 版本化；
- 所有结果带 evidence；
- 不依赖外部大模型；
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
9. 运行参数回归测试；
10. 运行必要性能测试；
11. 更新文档；
12. 总结修改。

最终回复：

- 修改文件；
- Schema/API 变化；
- Unit Registry 变化；
- Policy 变化；
- 测试命令和真实结果；
- 参数质量指标；
- 性能结果；
- 已知限制；
- 下一阶段建议。
```

---

# 51. MVP 演示流程

完成 V1 后演示：

1. LM358 被分类为 Op Amp；
2. Locator 定位 Electrical Characteristics；
3. Agent 加载 Op Amp Schema；
4. 识别 Input Offset Voltage；
5. 解析 Typ = 0.5、Max = 3、Unit = mV；
6. 转换为 0.0005 V 和 0.003 V；
7. 解析 TA = 25°C；
8. 保存表格行、bbox 和脚注；
9. 从全温区行生成另一 Observation；
10. 不将两条 Observation 强行合并；
11. 为 default_comparison 选择 Fact；
12. AMS1117 解析 Vin、Vout、Iout、Dropout；
13. AO3400 解析 VDS、ID、RDS(on)、Qg；
14. ADS1115 解析 Resolution、SPS、INL；
15. BME280 解析温度、湿度和压力精度；
16. Family Datasheet 对不同型号分别绑定；
17. 同一 MOSFET RDS(on) 在多个 VGS 条件下保存多条 Observation；
18. Unknown Unit 进入审核；
19. 人工修正 OCR 数值；
20. Patch 保留原始值；
21. Unit Registry 更新后只执行 renormalize；
22. Schema 增加字段后只抽取新增字段；
23. 发布 component.parameters.ready。

---

# 52. 下游事件

```json
{
  "event_type": "component.parameters.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "parameter_result_id": "uuid",
  "schema": {
    "schema_id": "component.opamp.general.v1",
    "schema_version": "1.0.0",
    "schema_hash": "hex"
  },
  "policy": {
    "extraction_policy_version": "extractor-1.0.0",
    "unit_registry_version": "units-1.0.0",
    "selection_policy_version": "selector-1.0.0"
  },
  "observations_uri": "s3://.../parameter_observations.json.zst",
  "facts_uri": "s3://.../parameter_facts.json",
  "quality_report_uri": "s3://.../quality_report.json",
  "required_coverage": 0.92,
  "overall_quality": 0.94,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

建议下游自动消费条件：

```text
review_status = approved
AND required coverage >= configured threshold
AND no blocking dimensional conflicts
AND facts schema valid
```

---

# 53. 官方技术参考

Codex 实施时应重新检查当前版本和许可证。

## UCUM

UCUM 是用于科学、工程和商业计量单位的统一编码体系，可作为外部单位代码和语义参考：

- https://ucum.org/
- https://ucum.org/ucum
- https://ucum.org/docs/common-units

## Pint

Pint 提供 Python Quantity、UnitRegistry 和单位换算能力，可作为受控 Unit Registry 下方的转换适配器：

- https://pint.readthedocs.io/en/stable/
- https://pint.readthedocs.io/en/stable/user/defining-quantities.html
- https://pint.readthedocs.io/en/stable/user/nonmult.html

注意：

- Pint 默认单位定义不能直接替代 ezPLM 业务 Unit Registry；
- 温度 offset、对数单位、RMS/peak qualifier 和电子行业复合单位需要专门测试；
- 正式部署必须固定 Pint 版本和单位定义文件哈希。
