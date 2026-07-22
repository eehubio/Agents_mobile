# KiCad 原理图符号生成 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：KiCad Schematic Symbol Generation Agent  
> 中文名：KiCad 原理图符号生成 Agent  
> 版本：V1.0  
> 输出目标：KiCad 9.x 与 KiCad 10.x `.kicad_sym`  
> 定位：确定性规则优先、证据可追溯、可验证和可人工修订的 EDA 资产生成 Agent  
>
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent
> - Datasheet Structure & Visual Asset Locator Agent
> - Parameter Extraction & Unit Normalization Agent
> - Pin, Package & Ordering Variant Extraction Agent
> - Evidence Anchoring & Human Review Agent
>
> 下游：
> - KiCad Symbol Library
> - KiCad Footprint / 3D Mapping Agent
> - KiCad Schematic Generation Agent
> - Symbol–Footprint Pin/Pad Cross Validation
> - ezPLM KiCad Viewer
> - Tindie Engineering File Preview
> - Component Library Download Service
>
> 目标读者：产品负责人、EDA 工程师、后端工程师、数据工程师、测试工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的 KiCad 原理图符号生成 Agent。

该 Agent 接收已经审核或达到生产阈值的：

- Logical Pin；
- Package Pin Instance；
- Pin Number；
- Pin Name；
- Pin Type；
- Pin Description；
- Alternate Function；
- Power Domain；
- Differential Pair；
- Exposed Pad；
- Package Variant；
- Ordering Variant；
- Datasheet Evidence；
- Footprint Mapping 候选。

完成：

1. 建立与 KiCad 文件格式无关的 Symbol Generation IR；
2. 根据器件类别选择符号模板；
3. 判断生成单单元还是多单元符号；
4. 决定共享电源单元；
5. 将上游 Pin Type 映射为 KiCad Electrical Type；
6. 生成 Active-low、Clock、Inverted 等 Pin Graphic Style；
7. 处理 Alternate Pin Functions；
8. 处理多个物理脚对应一个逻辑网络的 Pin Stack；
9. 处理 NC、DNC、Reserved、EP 和隐藏 Pin；
10. 对管脚进行功能分组和布局；
11. 生成符号 Body、Field、Pin 和 Unit；
12. 生成 KiCad 9 兼容版；
13. 生成 KiCad 10 原生版；
14. 生成 `.kicad_sym`；
15. 用 KiCad 9/10 实际程序解析、重存和渲染验证；
16. 校验 Symbol Pin 与 Footprint Pad Number；
17. 生成 SVG/PNG 预览、质量报告和证据清单；
18. 低置信度或 ERC 风险结果进入人工审核；
19. 人工调整以 Layout Patch 保存，不覆盖机器原始结果；
20. 发布可供下载和后续设计 Agent 使用的符号资产。

---

# 2. KiCad 版本策略

## 2.1 当前支持目标

V1 支持：

```text
KiCad 9.x compatibility profile
KiCad 10.x native profile
```

具体 CI 基准版本必须配置化，例如：

```text
KiCad 9.0.9
KiCad 10.0.4
```

不得在代码中只判断主版本号后假设所有小版本行为完全相同。

## 2.2 文件格式基础

KiCad 6 及以后使用 S-expression Symbol Library 格式：

```text
.kicad_sym
```

文件顶层：

```scheme
(kicad_symbol_lib
  (version YYYYMMDD)
  (generator eehub_symbol_agent)
  ...
)
```

生成器标识不得使用：

```text
kicad_symbol_editor
```

第三方程序必须使用自己的 generator 名称。

## 2.3 兼容输出原则

默认生成两个文件：

```text
<ComponentLibrary>-kicad9.kicad_sym
<ComponentLibrary>-kicad10.kicad_sym
```

以及一个兼容清单：

```json
{
  "kicad9": {
    "file": "...-kicad9.kicad_sym",
    "native_features_disabled": [
      "compact_pin_stack"
    ]
  },
  "kicad10": {
    "file": "...-kicad10.kicad_sym",
    "native_features": [
      "compact_pin_stack"
    ]
  }
}
```

## 2.4 禁止伪兼容

不能生成使用 KiCad 10 专属结构的文件，然后仅修改 version token 声称其兼容 KiCad 9。

每个目标文件必须由目标版本的 KiCad CLI 实际解析和渲染验证。

---

# 3. Agent 的边界

## 3.1 第六个 Agent 负责

- Logical Pin；
- Package Pin Instance；
- Pin Type；
- Alternate Functions；
- Package Variant；
- Ordering Variant；
- Pin/Package Applicability；
- Pin Table 与 Pinout 图交叉验证；
- 数据证据与置信度。

## 3.2 第七个 Agent 负责

- Evidence Anchor；
- Review Task；
- Machine Result；
- Human Patch；
- Approved Record。

## 3.3 本 Agent 负责

- Symbol Generation IR；
- KiCad Electrical Type 映射；
- Unit Planning；
- Pin Stack Planning；
- Symbol Layout；
- S-expression Serialization；
- KiCad 9/10 Target Rendering；
- ERC 风险检查；
- Symbol–Footprint Pin/Pad 校验；
- KiCad 资产版本管理。

## 3.4 本 Agent 不负责

V1 不负责：

- 从 PDF 重新识别 Pin；
- 创建 Footprint 几何；
- 创建 3D STEP 模型；
- 自动生成完整原理图；
- 自动连接网络；
- 修改上游 Pin 数据；
- 用大模型自由绘制 Symbol；
- 猜测缺失 Pin Number；
- 把低置信度 Pin Type 当作最终 ERC 类型；
- 在没有 Package Variant 的情况下编造 Footprint；
- 直接向 KiCad 官方库提交内容；
- 绕过 KiCad 实际解析验证。

---

# 4. 核心设计原则

## 4.1 先生成 Symbol IR，再序列化

不得从 Pin 数据直接拼接 S-expression 字符串。

流程：

```text
Approved Pin Data
    ↓
Symbol Generation IR
    ↓
Layout Plan
    ↓
KiCad Target Adapter
    ↓
S-expression AST
    ↓
.kicad_sym
```

## 4.2 业务逻辑与文件格式分离

以下模块必须分开：

```text
Pin Semantic Mapping
Unit Planning
Layout Engine
KiCad 9 Adapter
KiCad 10 Adapter
S-expression Serializer
Validation
```

## 4.3 确定性布局

相同输入、相同策略和相同版本必须生成字节稳定或语义稳定的结果。

不得使用随机位置。

UUID 如必须生成，应使用稳定的 namespace-based UUID 或明确排除在字节稳定比较之外。

## 4.4 上游事实不可变

本 Agent 不修改：

- Pin Number；
- Pin Name；
- Package；
- Ordering Code。

发现问题时生成 Review Task。

## 4.5 Pin Number 是电气映射的权威键

KiCad Symbol Pin 与 Footprint Pad 通过 Number 匹配。

因此：

```text
symbol pin number == footprint pad number
```

是阻断性校验。

## 4.6 Pin 应按功能布局，而不是封装物理顺序

默认：

- 输入和控制在左；
- 输出在右；
- 正电源在上；
- Ground/负电源在下；
- 总线和同类接口连续；
- Differential Pair 相邻；
- Port 按数字顺序；
- Power Converter 的输入电源在左、输出电源在右；
- NC/DNC 默认不占主要视觉空间。

## 4.7 隐藏 Pin 极度保守

隐藏 Pin 默认不允许。

允许的主要情况：

- 明确为 `no_connect`，且策略要求隐藏；
- KiCad 9 兼容 Pin Stack 中的非主显示重叠 Pin；
- 经审核批准的特殊库策略。

Power Input Pin 不得仅为了“好看”设为隐藏。

隐藏 Power Input 可能产生隐式全局网络行为，因此必须禁止。

## 4.8 多单元设计必须可解释

Agent 必须输出：

```text
为什么分为多单元
每个 Unit 包含哪些 Pin
哪些 Pin 是所有 Unit 公共
为什么创建 Power Unit
```

## 4.9 KiCad 9 与 10 功能差异显式处理

重点：

```text
KiCad 10 native compact pin stacks
KiCad 9 exploded overlapping pin stacks
```

不能将两者混淆。

## 4.10 所有自动布局可人工 Patch

人工可以：

- 移动 Pin；
- 换 Side；
- 调整顺序；
- 调整 Unit；
- 调整 Body 大小；
- 切换 Pin Stack；
- 修改可见性；
- 调整 Field。

修改保存为 Layout Patch。

---

# 5. Symbol Generation IR

## 5.1 顶层结构

```json
{
  "schema_version": "1.0.0",

  "identity": {
    "symbol_id": "uuid",
    "library_name": "EEHUB_MCU",
    "symbol_name": "STM32G431CBTx",
    "manufacturer": "STMicroelectronics",
    "base_part_number": "STM32G431CB",
    "package_variant_id": "pkg-lqfp48",
    "ordering_variant_ids": []
  },

  "source": {
    "pin_catalog_id": "uuid",
    "package_catalog_id": "uuid",
    "approved_record_ids": [],
    "evidence_bundle_ids": []
  },

  "metadata": {
    "reference_prefix": "U",
    "value": "STM32G431CBTx",
    "description": "Arm Cortex-M4 microcontroller...",
    "keywords": [
      "MCU",
      "ARM",
      "Cortex-M4"
    ],
    "datasheet": "https://...",
    "default_footprint": null,
    "footprint_filters": []
  },

  "generation": {
    "template": "mcu_split",
    "unit_strategy": "functional_split",
    "layout_policy_version": "symbol-layout-1.0.0",
    "kicad_profiles": [
      "kicad9",
      "kicad10"
    ]
  },

  "units": [],
  "pins": [],
  "graphics": [],
  "fields": [],
  "validation_expectations": {}
}
```

---

# 6. Pin IR

```json
{
  "symbol_pin_id": "sp-1",
  "logical_pin_id": "lp-pa9",

  "physical_numbers": [
    "30"
  ],

  "display": {
    "name": "PA9",
    "raw_name": "PA9/USART1_TX/TIM1_CH2",
    "number_text": "30",
    "active_level": "high",
    "visible": true
  },

  "electrical": {
    "source_type": "bidirectional",
    "kicad_type": "bidirectional",
    "type_confidence": 0.97
  },

  "graphic": {
    "style": "line",
    "length_mm": "2.54"
  },

  "functions": {
    "primary": "PA9",
    "alternates": [
      {
        "name": "USART1_TX",
        "kicad_type": "output",
        "graphic_style": "line"
      },
      {
        "name": "TIM1_CH2",
        "kicad_type": "bidirectional",
        "graphic_style": "line"
      }
    ]
  },

  "layout": {
    "unit_id": "A",
    "group": "GPIOA",
    "side": "left",
    "order_key": "PA09",
    "x_mm": "-10.16",
    "y_mm": "5.08",
    "rotation": 0
  },

  "evidence": {
    "approved_record_id": "uuid",
    "evidence_bundle_id": "uuid"
  }
}
```

---

# 7. KiCad Electrical Type 映射

## 7.1 直接映射

| 上游类型 | KiCad 类型 |
|---|---|
| input | input |
| output | output |
| bidirectional | bidirectional |
| tri_state | tri_state |
| passive | passive |
| power_input | power_in |
| power_output | power_out |
| open_collector | open_collector |
| open_emitter | open_emitter |
| nc/dnc | no_connect |
| unknown | unspecified |

## 7.2 上游没有直接 KiCad 类型的映射

```text
analog_input → input 或 passive，由类别策略决定
analog_output → output 或 passive
ground → power_in
reference_input → input 或 power_in
reference_output → output 或 power_out
clock_input → input + clock graphic style
clock_output → output
reset → input
configuration → input
debug → bidirectional/input/output，按证据
exposed_pad → power_in/passive/no_connect，按 Datasheet
```

## 7.3 低置信度类型

若 Pin Type 低于阈值：

```text
kicad_type = unspecified
review_required = true
```

不能为了通过 ERC 自动猜成 passive。

## 7.4 Free 与 No Connect

KiCad：

```text
free
no_connect
```

语义不同。

上游 NC/DNC 通常映射为 `no_connect`。

仅当 Datasheet 明确表示内部不连接但外部可用作机械/自由 Pad 时，才考虑 `free`，并要求审核。

---

# 8. Pin Graphic Style

支持：

```text
line
inverted
clock
inverted_clock
input_low
clock_low
output_low
edge_clock_high
non_logic
```

## 8.1 默认规则

```text
普通 Pin → line
Clock Input → clock
Active-low Input → line + overbar name，默认不双重添加 bubble
Inverting Analog Input → line，名称使用 IN-
Digital Inverted Output → inverted 或 overbar，按策略
Non-logic Mechanical/Shield → non_logic
```

## 8.2 禁止双重反相

不能同时：

- 名称加 overbar；
- Graphic Style 再使用 inverted；

除非器件符号标准明确要求，且经过审核。

## 8.3 Active-low 名称

将上游：

```text
/RESET
RESET#
RESET_N
nRESET
```

统一显示为 KiCad overbar 语法：

```text
~{RESET}
```

原始名称保存在 Sidecar Manifest，不写入显示名。

---

# 9. Alternate Pin Functions

## 9.1 使用范围

适合：

- MCU；
- FPGA；
- CPLD；
- SoC；
- Interface Multiplexer；
- Configurable GPIO。

## 9.2 主显示名称

默认只显示：

- GPIO 主名；
- 最重要的 Boot/Strap 功能；
- 最常用接口中的一个功能。

其余放入 Alternate Pin Functions。

## 9.3 可读性限制

主 Pin Name 不建议展示超过两个功能，例如：

```text
PA9/USART1_TX
```

而不是：

```text
PA9/USART1_TX/TIM1_CH2/I2C1_SCL/EVENTOUT
```

## 9.4 序列化策略

Alternate Pin Function 的精确 S-expression 结构可能随目标版本变化。

Codex 不得凭记忆自行发明 token。

必须：

1. 用 KiCad 9 Symbol Editor 创建最小 Fixture；
2. 保存 `.kicad_sym`；
3. 用 KiCad 10 创建等价 Fixture；
4. 保存文件；
5. 将 Fixture 纳入测试；
6. Target Adapter 以 Fixture 为协议基准；
7. 每次升级 KiCad 版本重新生成和比较。

---

# 10. Pin Stack

## 10.1 使用场景

当多个物理 Pad：

- 在器件内部永久连接；
- 应始终属于同一网络；
- 用户无需单独连线。

常见：

- 多个 GND；
- 多个 VDD；
- 同一输出的多个物理脚；
- 大电流并联 Pin。

## 10.2 不可 Stack

禁止：

- NC；
- DNC；
- 可独立供电的不同 Domain；
- AVDD 与 DVDD；
- AGND 与 DGND，除非 Datasheet 明确内部短接；
- 可选择连接的 Pin；
- 同名但电气上不永久连接的 Pin。

## 10.3 KiCad 10 Native Stack

KiCad 10 支持单个 Pin 使用多编号表达，例如：

```text
[1-3]
[1,2,3]
[1-2,4]
```

`kicad10` profile 可生成 Native Stack。

保存：

```json
{
  "stack_type": "native_compact",
  "numbers": ["1", "2", "3"],
  "display_number": "[1-3]"
}
```

## 10.4 KiCad 9 Compatibility Stack

KiCad 9 使用多个 Pin 重叠在相同位置：

- 一个主 Pin 可见；
- 其他 Pin 隐藏；
- 隐藏重叠 Pin 通常设为 passive；
- 不得把隐藏 Pin 设为 power_in；
- 每个物理 Pad 仍有独立 Number。

输出必须标记：

```text
compatibility_workaround = exploded_overlapping_stack
```

## 10.5 9/10 双输出

同一 Symbol IR：

```text
KiCad 9 Adapter → exploded stack
KiCad 10 Adapter → native compact stack
```

## 10.6 Stack Evidence

必须保存：

- 哪些物理 Pin 被合并；
- 数据来源；
- 为什么判断永久连接；
- 是否人工批准。

低置信度禁止自动 Stack。

---

# 11. Hidden Pins

## 11.1 默认政策

```text
hidden = false
```

## 11.2 允许隐藏

- `no_connect` Pin，且布局策略要求不显示；
- KiCad 9 Exploded Stack 的辅助 Pin；
- 经人工批准的特殊符号。

## 11.3 禁止隐藏

- power_in；
- power_out；
- 可连接信号；
- Boot/Strap；
- EP 需要外部连接；
- Reset；
- Reference；
- Analog Supply；
- Ground。

## 11.4 Hidden NC 位置

隐藏 NC Pin 的端点必须位于 Body 内部或边界上，避免用户意外连接。

## 11.5 Hidden Pin Manifest

即使隐藏，也必须在：

```text
symbol_manifest.json
```

中完整列出。

---

# 12. Unit Planning

## 12.1 单单元

适合：

- MCU 小封装；
- LDO；
- ADC；
- Sensor；
- MOSFET；
- 单运放；
- 普通 Interface IC。

## 12.2 多单元重复功能

适合：

- Dual/Quad Op Amp；
- Comparator Array；
- Logic Gate；
- Resistor Array；
- Buffer Array；
- Multi-channel Isolator。

示例 LM358：

```text
Unit A：Amplifier 1
Unit B：Amplifier 2
Unit C：Power
```

## 12.3 功能拆分

适合高 Pin Count MCU/FPGA：

```text
Unit A：Power
Unit B：GPIO Port A/B
Unit C：GPIO Port C/D
Unit D：Analog
Unit E：USB/CAN/Communication
Unit F：Debug/Clock/Reset
```

是否默认拆分必须配置化。

## 12.4 Power Unit

对于分离的多单元符号，共享 Power Pin 可放到独立 Unit。

但单单元 Symbol 的 Power Pin 必须在同一 Unit 显示。

## 12.5 Unit 一致性

重复功能 Unit 应尽量：

- Body 尺寸一致；
- Pin 位置一致；
- 输入输出相对位置一致；
- 支持 Gate Swap；
- 对应 Pin 顺序可预测。

## 12.6 Unit ID

Symbol Unit Identifier 需要遵循目标格式：

```text
NAME_UNIT_STYLE
```

例如：

```text
LM358_1_1
LM358_2_1
LM358_3_1
```

Unit 0 表示所有 Unit 共享内容。

---

# 13. Symbol Template 类型

```text
black_box_single
black_box_split
opamp_single
opamp_multi
comparator_single
comparator_multi
logic_gate_multi
transistor
mosfet
diode
regulator
power_converter
adc
dac
sensor
connector
memory
mcu_single
mcu_split
fpga_split
custom_reviewed
```

## 13.1 V1 优先模板

建议先实现：

1. black_box_single；
2. opamp_single；
3. opamp_multi；
4. regulator；
5. adc；
6. sensor；
7. mcu_single；
8. mcu_split；
9. fpga_split。

## 13.2 模板不等于自由绘图

模板负责：

- Body 类型；
- Unit 策略；
- Pin Side；
- 典型 Group；
- Field 布局。

Pin 内容仍来自 PinCatalog。

---

# 14. Layout Engine

## 14.1 网格

Symbol Pin Connection Point 使用：

```text
100 mil / 2.54 mm Grid
```

Body 和文字可使用更细网格，但 Pin 端点必须符合策略。

## 14.2 Pin Length

默认：

```text
2.54 mm
```

根据最长 Pin Number 可提升：

```text
3.81 mm
5.08 mm
```

所有普通 Pin 尽量长度一致。

## 14.3 Pin Name Offset

默认：

```text
0.508 mm
```

允许：

```text
0.508–1.27 mm
```

## 14.4 Side 到 Rotation 映射

需通过 Golden Fixture 验证：

```text
left   → rotation 0
right  → rotation 180
top    → rotation 270
bottom → rotation 90
```

不得只依赖开发者直觉。

## 14.5 Body 尺寸

计算因素：

- 每侧 Pin 数；
- Pin 间距；
- 最长 Pin Name；
- Field 宽度；
- Unit Label；
- 模板最小尺寸；
- Group Gap。

## 14.6 Body Height

```text
height =
  max(left_pin_slots, right_pin_slots)
  × vertical_pitch
  + top_bottom_margin
```

对 Top/Bottom Power Pin 另加宽度需求。

## 14.7 Body Width

```text
width =
  left_name_width
  + core_min_width
  + right_name_width
  + name_offsets
```

限制最大宽度，过宽时触发：

- 多单元拆分；
- 名称缩写；
- 人工审核。

## 14.8 Pin 排序

排序优先：

```text
group priority
port letter
numeric index
differential polarity
pin name
pin number
```

例如：

```text
PA0
PA1
PA2
...
PA15
```

而不是字符串排序：

```text
PA0
PA1
PA10
PA11
PA2
```

## 14.9 Functional Group

示例：

```text
POWER_POSITIVE
POWER_NEGATIVE
GROUND
RESET_BOOT
CLOCK
DEBUG
GPIOA
GPIOB
ADC
DAC
SPI1
I2C1
UART1
USB
CAN
ETHERNET
ANALOG_INPUT
ANALOG_OUTPUT
CONTROL
OUTPUT
NC
EP
```

## 14.10 Group Gap

不同 Group 之间保留一个或多个空 Pin Slot。

## 14.11 Differential Pair

保持：

```text
P 在 N 上方
+ 在 - 上方
```

可配置。

## 14.12 Inputs/Outputs

默认：

```text
Input/Control → Left
Output → Right
Bidirectional → Left，或按 Interface Group
Power Positive → Top
Ground/Negative → Bottom
```

## 14.13 Power Converter 例外

```text
VIN / EN / FB → Left
VOUT / SW / PG → Right
GND / PGND → Bottom
BOOT → Top 或 Right
```

## 14.14 NC Pin

策略：

```text
omit_from_symbol
show_as_no_connect
hide_as_no_connect
```

必须按 Package 与 KLC 策略配置。

如果从 Symbol 中省略 NC，Footprint Filter 必须足够精确，且 Sidecar Manifest 保留省略记录。

---

# 15. Op Amp Layout

## 15.1 单运放

默认三角形：

```text
IN+ Left Lower/Upper
IN- Left Upper/Lower
OUT Right
V+ Top
V- Bottom
Offset/Enable 按 Datasheet
```

## 15.2 Dual/Quad

每个通道独立 Unit：

```text
Unit A/B/C/D
```

共享 Power Pin 放 Power Unit。

## 15.3 Pin 旋转问题防护

过去常见错误：

- Body 旋转；
- Pin 位置旋转；
- Pin 自身方向未旋转；
- Pin 与 Body 脱离。

布局引擎必须一次性输出：

```text
body transform
pin connection position
pin rotation
pin body endpoint
```

并在 Geometry Validator 中检查 Pin Body Endpoint 是否落在 Symbol Outline 上。

禁止仅对 Body 做 180° 变换。

---

# 16. MCU/FPGA Layout

## 16.1 单体模式

适合：

- Pin 数较少；
- 页面可读；
- 用户偏好单 Symbol。

## 16.2 Split 模式

按功能拆分，而不是按封装边顺序：

```text
Power
Clock/Reset/Boot
GPIO Ports
Analog
Communication
High-speed Interface
Memory/Configuration
```

## 16.3 Alternate Functions

默认只使用 Alternate Pin Definitions，不把所有功能都塞在主显示名称中。

## 16.4 FPGA Bank

按：

```text
Bank Number
Power Domain
Differential Pair
Clock Capability
Configuration
JTAG
```

拆 Unit。

Bank Supply 必须与对应 Bank 关联。

---

# 17. Body Graphics

## 17.1 允许对象

- rectangle；
- polyline；
- polygon；
- circle；
- arc；
- text；
- triangle via polyline/polygon。

## 17.2 默认黑盒

大多数 IC 使用：

```text
rectangle
background fill
standard stroke
```

## 17.3 功能图

只对简单、稳定的功能添加简图。

MCU/FPGA 不生成复杂内部框图。

## 17.4 De Morgan

V1 不生成 Alternate De Morgan Body Style。

`STYLE` 默认使用 1。

---

# 18. Symbol Fields

## 18.1 默认字段

生成：

```text
Reference
Value
Footprint
Datasheet
Description
```

## 18.2 Reference Prefix

按类别：

```text
U  IC/Module
Q  Transistor/MOSFET
D  Diode
R  Resistor
C  Capacitor
L  Inductor
J  Connector
Y  Crystal/Oscillator
SW Switch
```

## 18.3 Footprint

### Fully Specified Symbol

若 Package Variant 已唯一映射到经审核的 KiCad Footprint：

```text
Footprint = Library:Footprint
```

### Generic Symbol

若存在多个可能 Footprint：

```text
Footprint = ""
```

并生成准确的 footprint filters。

## 18.4 多封装器件

对 Fully Specified Symbol：

- 每个 Package Variant 生成独立 Symbol；
- Pin-compatible Variant 可使用 Derived Symbol；
- Derived Symbol 必须与 Base Symbol 在同一 Library。

## 18.5 Datasheet

使用：

- 稳定 manufacturer URL；
- 或 ezPLM 资产 URI；
- 不嵌入 PDF 到 Library，除非专门配置。

## 18.6 Description

包括：

- 器件功能；
- 关键识别信息；
- Package；
- Pin Count；
- 不包含长篇参数。

## 18.7 自定义字段

V1 默认不向 `.kicad_sym` 写大量内部字段。

内部数据放：

```text
symbol_manifest.json
```

可选公开字段：

```text
Manufacturer
MPN
Package
```

必须由库策略明确开启。

---

# 19. Symbol Naming

## 19.1 基础原则

名称：

- 稳定；
- 无空格；
- 无非法字符；
- 可搜索；
- 能区分功能差异；
- 能区分不同 Pinout/Package。

## 19.2 Package Variant

Fully Specified Symbol 名称可包含 Package/Pinout 变体。

示例：

```text
LM358D
LM358P
MCP6566R
MCP6566T
```

具体命名由 Manufacturer Profile 与 KiCad Naming Policy 决定。

## 19.3 非功能后缀

包装方式、Reel Quantity 等不应生成不同 Symbol。

Ordering Variant 应映射到同一个 Package Symbol。

---

# 20. KiCad File Serializer

## 20.1 禁止字符串模板拼接

应建立类型化 AST：

```text
SExprNode
Atom
StringAtom
NumberAtom
ListNode
```

## 20.2 转义

必须正确处理：

- 双引号；
- 反斜杠；
- UTF-8；
- 换行；
- KiCad Text Markup；
- Overbar braces；
- 空字符串。

## 20.3 数值格式

- 毫米；
- 不使用科学计数法；
- 最大四位小数；
- 去除不必要尾零；
- 避免 `-0`；
- Decimal。

## 20.4 稳定排序

顶层 Symbol 顺序：

```text
symbol_name
```

Pin 顺序：

```text
unit
side
layout order
pin number natural sort
```

Properties 和 Graphics 使用固定顺序。

## 20.5 Generator

```text
(generator eehub_symbol_agent)
```

## 20.6 Version Token

由 Target Adapter 配置。

不能使用“今天日期”作为没有依据的格式版本。

应从目标 KiCad 保存的 Golden Fixture 获取准确 version token。

---

# 21. Golden Fixture 策略

## 21.1 必须由真实 KiCad 生成

为 KiCad 9 和 10 分别创建最小 Symbol Library Fixture：

1. Single Rectangle；
2. Input/Output/Power Pin；
3. Hidden NC；
4. Multi-unit；
5. Shared Unit Content；
6. Alternate Pin Function；
7. Derived Symbol；
8. Exploded Pin Stack；
9. Native KiCad 10 Pin Stack；
10. Footprint Filter；
11. Active-low Pin；
12. Op Amp Triangle。

## 21.2 Fixture 用途

- 文件协议参考；
- Serializer Regression；
- KiCad 版本差异；
- Golden Diff；
- 新版本升级验证。

## 21.3 禁止手写未知格式

若官方格式文档未描述某项新功能：

```text
真实 KiCad Fixture
→ 解析差异
→ Adapter 实现
```

不是凭猜测写 token。

---

# 22. 输出产物

```text
generated/kicad-symbols/
  {manufacturer}/
    {family}/
      input/
        symbol_ir.json
        layout_plan.json
      kicad9/
        library.kicad_sym
        svg/
        validation_report.json
      kicad10/
        library.kicad_sym
        svg/
        validation_report.json
      common/
        symbol_manifest.json
        evidence_manifest.json
        compatibility_report.json
        preview.png
        review_overlay.json
```

---

# 23. Symbol Manifest

```json
{
  "symbol_asset_id": "uuid",
  "symbol_name": "LM358D",
  "library": "EEHUB_Amplifier_Operational",

  "source": {
    "part_ids": ["uuid"],
    "package_variant_id": "uuid",
    "pin_catalog_id": "uuid",
    "approved_record_ids": []
  },

  "targets": {
    "kicad9": {
      "path": "kicad9/library.kicad_sym",
      "sha256": "hex",
      "validated_with": "9.0.9"
    },
    "kicad10": {
      "path": "kicad10/library.kicad_sym",
      "sha256": "hex",
      "validated_with": "10.0.4"
    }
  },

  "symbol": {
    "units": 3,
    "visible_pins": 7,
    "hidden_pins": 1,
    "pin_stacks": 0,
    "alternate_functions": 0,
    "default_footprint": "Package_SO:SOIC-8_3.9x4.9mm_P1.27mm"
  },

  "quality": {
    "pin_pad_match": 1.0,
    "layout_score": 0.97,
    "kicad9_parse": true,
    "kicad10_parse": true,
    "review_status": "approved"
  }
}
```

---

# 24. Agent 输入

## 24.1 事件输入

订阅：

```json
{
  "event_type": "component.pin-package-ordering.ready",
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "result_id": "uuid",
  "pin_catalog_uri": "s3://...",
  "package_catalog_uri": "s3://...",
  "ordering_catalog_uri": "s3://...",
  "applicability_map_uri": "s3://...",
  "review_status": "approved"
}
```

并查询：

```text
knowledge.record.approved
```

## 24.2 REST 输入

`POST /api/v1/kicad-symbol-generation/jobs`

```json
{
  "part_id": "uuid",
  "package_variant_id": "uuid",
  "ordering_variant_ids": ["uuid"],

  "pin_catalog_uri": "s3://...",
  "package_catalog_uri": "s3://...",

  "targets": [
    "kicad9",
    "kicad10"
  ],

  "generation_mode": "auto",
  "template_override": null,
  "unit_strategy_override": null,

  "policies": {
    "symbol_policy_version": "symbol-1.0.0",
    "layout_policy_version": "layout-1.0.0",
    "kicad9_adapter_version": "kicad9-1.0.0",
    "kicad10_adapter_version": "kicad10-1.0.0"
  },

  "idempotency_key": "uuid"
}
```

`generation_mode`：

```text
auto
single_unit
multi_unit
split_functional
preview_only
validate_existing
regenerate_layout
serialize_only
review_only
```

---

# 25. Agent 输出

```json
{
  "agent_id": "kicad-symbol-generation",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",

  "symbol": {
    "symbol_asset_id": "uuid",
    "library_name": "EEHUB_Amplifier_Operational",
    "symbol_name": "LM358D",
    "package_variant_id": "uuid"
  },

  "artifacts": {
    "symbol_ir_uri": "s3://...",
    "layout_plan_uri": "s3://...",
    "manifest_uri": "s3://...",
    "compatibility_report_uri": "s3://...",

    "kicad9": {
      "library_uri": "s3://.../kicad9/library.kicad_sym",
      "svg_uri": "s3://.../kicad9/svg/LM358D.svg",
      "validation_report_uri": "s3://..."
    },

    "kicad10": {
      "library_uri": "s3://.../kicad10/library.kicad_sym",
      "svg_uri": "s3://.../kicad10/svg/LM358D.svg",
      "validation_report_uri": "s3://..."
    }
  },

  "summary": {
    "units": 3,
    "pins": 8,
    "hidden_pins_kicad9": 0,
    "hidden_pins_kicad10": 0,
    "pin_stacks": 0,
    "alternate_functions": 0
  },

  "quality": {
    "input_data_score": 0.99,
    "layout_score": 0.96,
    "pin_pad_match_score": 1.0,
    "kicad9_validation": 1.0,
    "kicad10_validation": 1.0,
    "overall_score": 0.98,
    "review_required": false,
    "review_reasons": []
  }
}
```

---

# 26. 状态机

```text
RECEIVED
  ↓
LOADING_APPROVED_PIN_DATA
  ↓
LOADING_PACKAGE_MAPPING
  ↓
SELECTING_SYMBOL_TEMPLATE
  ↓
PLANNING_UNITS
  ↓
MAPPING_PIN_TYPES
  ↓
PLANNING_PIN_STACKS
  ↓
GROUPING_PINS
  ↓
COMPUTING_LAYOUT
  ↓
BUILDING_SYMBOL_IR
  ↓
GENERATING_KICAD9_AST
  ↓
SERIALIZING_KICAD9
  ↓
GENERATING_KICAD10_AST
  ↓
SERIALIZING_KICAD10
  ↓
STATIC_VALIDATION
  ↓
KICAD9_PARSE_VALIDATION
  ↓
KICAD10_PARSE_VALIDATION
  ↓
SVG_RENDER_VALIDATION
  ↓
PIN_PAD_CROSS_VALIDATION
  ↓
QUALITY_EVALUATING
  ↓
STORING_ARTIFACTS
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

# 27. Static Validator

必须检查：

## 27.1 Symbol

- Symbol Name 合法；
- Reference 存在；
- 必要 Fields 存在；
- Unit ID 唯一；
- Body 存在；
- Body 尺寸正数；
- Origin 合理。

## 27.2 Pin

- Number 非空；
- Pin Number 唯一，除合法 KiCad 10 Stack；
- Name 无非法空格；
- Electrical Type 合法；
- Graphic Style 合法；
- Rotation 为 0/90/180/270；
- Pin Endpoint 在 Grid；
- Pin Body Endpoint 接触 Body；
- Pin 之间不重叠，除 Stack；
- Hidden Pin 符合政策；
- Power Input 不隐藏；
- NC 不 Stack；
- Alternate Function 格式合法。

## 27.3 Unit

- Pin 只属于合法 Unit；
- 公共 Pin 不重复；
- Power Unit 存在时包含共享 Power；
- 重复 Unit 的形状一致；
- Unit Count 与生成计划一致。

## 27.4 Footprint

- Default Footprint 格式；
- Footprint 存在于当前映射库；
- Symbol Pin Number 与 Footprint Pad Number 对齐；
- EP/SH/MP 处理一致。

---

# 28. KiCad 实际验证

## 28.1 KiCad CLI Version

记录：

```bash
kicad-cli version --format about
```

## 28.2 Parse/Resave 验证

复制输出后运行：

```bash
kicad-cli sym upgrade --force \
  --output normalized.kicad_sym \
  generated.kicad_sym
```

要求：

- Exit Code 0；
- 生成文件；
- Symbol 数一致；
- Pin 数一致；
- Unit 数一致。

## 28.3 SVG Render

```bash
kicad-cli sym export svg \
  --output svg-output \
  generated.kicad_sym
```

另外生成包含 Hidden Pin 的调试 SVG：

```bash
kicad-cli sym export svg \
  --include-hidden-pins \
  --include-hidden-fields \
  --output svg-debug \
  generated.kicad_sym
```

## 28.4 Round-trip Diff

比较：

```text
Generated AST
vs
KiCad normalized output parsed AST
```

忽略：

- 格式化空白；
- KiCad 自动排序；
- 非语义版本字段。

不忽略：

- Pin Number；
- Type；
- Position；
- Unit；
- Visibility；
- Alternate Functions；
- Footprint；
- Body Geometry。

## 28.5 Visual Regression

将 SVG 转换为稳定 PNG，比较：

- Body；
- Pin；
- Field；
- Unit；
- Hidden Pin Debug；
- Active-low；
- Stack。

允许抗锯齿小差异，不允许结构偏移。

---

# 29. Geometry Validator

## 29.1 Pin–Body 接触

计算：

```text
connection_point
pin_length
rotation
body_endpoint
```

验证 Body Endpoint 在：

```text
Body Outline ± tolerance
```

## 29.2 Pin 脱离检测

若：

```text
distance(body_endpoint, body_outline) > tolerance
```

则阻断生成。

## 29.3 Pin 穿过 Body

外部 Connection Point 必须在 Body 外。

## 29.4 旋转一致性

Body 变换时 Pin Position 和 Pin Rotation 必须一起变换。

## 29.5 Text Overlap

检测：

- Pin Name 与 Pin Number；
- Pin 与 Field；
- Pin Group；
- Pin Name 与 Body Label；
- 左右 Pin Name 穿透 Body。

---

# 30. Layout Quality

评分维度：

```text
grid_compliance
pin_body_attachment
side_semantics
grouping_quality
natural_sort
power_placement
differential_pair_adjacency
text_overlap
body_compactness
unit_consistency
field_placement
```

## 30.1 强制审核

- Body 过宽；
- 单 Unit Pin 数超过阈值；
- 同一 Group 被拆散；
- Power Pin 在错误 Side；
- Pin Type 不确定；
- 多单元拆分歧义；
- Pin Stack 低置信度；
- Hidden Pin 非 NC；
- Footprint Pad 不匹配；
- KiCad 9/10 输出语义不同；
- Visual Regression 失败。

---

# 31. Symbol–Footprint Cross Validation

## 31.1 输入

- Package Pin Instance；
- Footprint Pad Index；
- Exposed Pad；
- Pad Number；
- NC Omission Policy。

## 31.2 检查

```text
symbol pin numbers ⊆ footprint pad numbers
required electrical pads represented
no unexpected symbol pin
EP number一致
stack numbers存在
```

## 31.3 NC Omission

如果 Footprint 中存在 NC Pad，但 Symbol 省略：

- 记录 omitted_pad；
- Footprint Filter 包含准确 Pin Count；
- 不允许用户误选其他 Pin Count Footprint。

---

# 32. Derived Symbols

## 32.1 使用条件

Pinout 与 Graphics 完全相同，仅以下不同：

- Value；
- Description；
- Datasheet；
- Footprint；
- Keywords；
- Manufacturer/MPN。

## 32.2 不可使用

- Pin Number 不同；
- Pin Type 不同；
- Unit 不同；
- Body 不同；
- Alternate Function 不同。

## 32.3 同 Library

Base 和 Derived Symbol 必须在同一 `.kicad_sym` Library。

---

# 33. 规则配置

```text
policies/
├── symbol-1.0.0.yaml
├── layout-1.0.0.yaml
├── pin-type-map-1.0.0.yaml
├── pin-graphics-1.0.0.yaml
├── unit-strategy-1.0.0.yaml
├── hidden-pin-1.0.0.yaml
├── pin-stack-1.0.0.yaml
├── footprint-link-1.0.0.yaml
├── naming-1.0.0.yaml
├── templates/
│   ├── black-box.yaml
│   ├── opamp.yaml
│   ├── regulator.yaml
│   ├── adc.yaml
│   ├── mcu.yaml
│   └── fpga.yaml
└── manufacturer/
    ├── texas-instruments.yaml
    ├── analog-devices.yaml
    ├── stmicroelectronics.yaml
    └── nxp.yaml
```

---

# 34. Layout Policy 示例

```yaml
layout_policy_version: layout-1.0.0

grid:
  pin_grid_mm: "2.54"
  body_grid_mm: "1.27"

pins:
  default_length_mm: "2.54"
  max_length_mm: "7.62"
  vertical_pitch_mm: "2.54"
  name_offset_mm: "0.508"
  group_gap_slots: 1

sides:
  input: left
  output: right
  bidirectional: left
  power_positive: top
  ground: bottom

limits:
  max_pins_per_side: 24
  max_symbol_width_mm: "35.56"
  max_symbol_height_mm: "60.96"

fallbacks:
  oversized_symbol: split_functional
  unknown_type: review
```

---

# 35. Data Model

## 35.1 `kicad_symbol_generation_jobs`

```text
id UUID PK
part_id UUID NOT NULL
package_variant_id UUID NOT NULL
pin_catalog_id UUID NOT NULL
generation_mode VARCHAR NOT NULL
targets JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
symbol_policy_version VARCHAR NOT NULL
layout_policy_version VARCHAR NOT NULL
kicad9_adapter_version VARCHAR NOT NULL
kicad10_adapter_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 35.2 `kicad_symbol_assets`

```text
id UUID PK
job_id UUID NOT NULL
part_id UUID NOT NULL
package_variant_id UUID NOT NULL
library_name VARCHAR NOT NULL
symbol_name VARCHAR NOT NULL
symbol_ir_uri TEXT NOT NULL
layout_plan_uri TEXT NOT NULL
manifest_uri TEXT NOT NULL
compatibility_report_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 35.3 `kicad_symbol_target_artifacts`

```text
id UUID PK
symbol_asset_id UUID NOT NULL
target_version VARCHAR NOT NULL
kicad_binary_version VARCHAR NOT NULL
library_uri TEXT NOT NULL
library_sha256 CHAR(64) NOT NULL
normalized_library_uri TEXT NULL
svg_uri TEXT NULL
debug_svg_uri TEXT NULL
validation_report_uri TEXT NOT NULL
parse_success BOOLEAN NOT NULL
render_success BOOLEAN NOT NULL
semantic_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(symbol_asset_id, target_version)
```

## 35.4 `kicad_symbol_reviews`

```text
id UUID PK
job_id UUID NOT NULL
symbol_asset_id UUID NULL
object_type VARCHAR NOT NULL
object_id VARCHAR NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 36. 产物版本与缓存

缓存键：

```text
pin_catalog_hash
+ package_variant_hash
+ approved_patch_hash
+ symbol_policy_version
+ layout_policy_version
+ target_adapter_version
+ target_kicad_version
```

## 36.1 上游 Pin 数据变化

重建整个 Symbol IR。

## 36.2 仅 Layout Policy 变化

保留 Pin Semantic Mapping，只重算 Layout 和序列化。

## 36.3 仅 KiCad Adapter 变化

只重新序列化和验证。

## 36.4 Footprint Mapping 变化

只更新 Footprint Field、Filter 和 Pin/Pad Validation。

---

# 37. API

## 37.1 写接口

```text
POST /api/v1/kicad-symbol-generation/jobs
POST /api/v1/kicad-symbol-generation/batches
POST /api/v1/kicad-symbol-generation/jobs/{job_id}/retry
POST /api/v1/kicad-symbol-generation/jobs/{job_id}/cancel
POST /api/v1/kicad-symbol-generation/jobs/{job_id}/regenerate-layout
POST /api/v1/kicad-symbol-generation/jobs/{job_id}/reserialize
POST /api/v1/kicad-symbol-generation/assets/{asset_id}/validate
POST /api/v1/kicad-symbol-generation/reviews/{review_id}/resolve
```

## 37.2 读接口

```text
GET /api/v1/kicad-symbol-generation/jobs/{job_id}
GET /api/v1/kicad-symbol-generation/jobs/{job_id}/events
GET /api/v1/kicad-symbol-generation/assets/{asset_id}
GET /api/v1/kicad-symbol-generation/assets/{asset_id}/manifest
GET /api/v1/kicad-symbol-generation/assets/{asset_id}/preview
GET /api/v1/kicad-symbol-generation/assets/{asset_id}/download/{target}
GET /api/v1/components/{part_id}/kicad-symbols
GET /api/v1/kicad-symbol-generation/reviews
GET /health/live
GET /health/ready
GET /metrics
```

---

# 38. 错误码

```text
PIN_CATALOG_NOT_FOUND
PACKAGE_VARIANT_NOT_FOUND
APPROVED_PIN_DATA_REQUIRED
PIN_NUMBER_MISSING
PIN_NUMBER_DUPLICATE
PIN_TYPE_UNRESOLVED
SYMBOL_TEMPLATE_NOT_FOUND
UNIT_PLANNING_FAILED
PIN_STACK_AMBIGUOUS
HIDDEN_POWER_PIN_FORBIDDEN
LAYOUT_OVERFLOW
PIN_OFF_GRID
PIN_BODY_DISCONNECTED
PIN_OVERLAP_INVALID
FIELD_OVERLAP
FOOTPRINT_MAPPING_NOT_FOUND
PIN_PAD_MISMATCH
KICAD9_SERIALIZATION_FAILED
KICAD10_SERIALIZATION_FAILED
KICAD9_PARSE_FAILED
KICAD10_PARSE_FAILED
KICAD9_RENDER_FAILED
KICAD10_RENDER_FAILED
ROUND_TRIP_SEMANTIC_DIFF
VISUAL_REGRESSION_FAILED
PATCH_BASE_VERSION_MISMATCH
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 39. 人工审核工作台

## 39.1 页面布局

```text
左侧：Pin Table / Unit Tree
中间：Symbol SVG Canvas
右侧：Pin/Unit/Layout 属性
底部：Evidence、Validation、KiCad 9/10 Diff
```

## 39.2 操作

- 拖动 Pin；
- 切换 Side；
- 调整 Group；
- 调整 Unit；
- 创建/拆除 Pin Stack；
- 设置 Pin Type；
- 设置 Graphic Style；
- 设置 Hidden；
- 调整 Body；
- 设置 Template；
- 切换 KiCad 9/10 Preview；
- 查看 Pin–Pad Mapping；
- 接受/拒绝生成结果。

## 39.3 Layout Patch

```json
{
  "target": "symbol-asset-id",
  "base_layout_version": "machine-layout-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/pins/sp-12/layout/side",
      "old_value": "left",
      "value": "right"
    },
    {
      "op": "replace",
      "path": "/pins/sp-12/layout/order_key",
      "old_value": "050",
      "value": "010"
    }
  ],
  "reason": "Move open-drain status output to output side."
}
```

---

# 40. Evidence

每个生成 Pin 保存：

```text
source logical_pin_id
source package_pin_instance_id
approved_record_id
evidence_bundle_id
mapping rule_id
layout rule_id
target serializer version
```

每个自动决策可追踪：

- 为什么在左侧；
- 为什么是 `power_in`；
- 为什么隐藏；
- 为什么 Stack；
- 为什么属于 Unit C。

---

# 41. 安全

- 不执行 Datasheet 内嵌脚本；
- 不调用用户提供的 KiCad 插件；
- KiCad 验证进程运行在隔离容器；
- 限制 CPU、内存和时间；
- 输出路径防穿越；
- Symbol Name 和 Library Name 进行清洗；
- 不允许生成任意文件路径；
- `kicad-cli` 输入只来自对象存储；
- 输出 Zip 进行内容白名单；
- 不写入用户系统全局 Symbol Table。

---

# 42. 可观测性

## 42.1 Prometheus

```text
kicad_symbol_jobs_total{status,target}
kicad_symbol_generation_duration_seconds{step,target}
kicad_symbol_templates_total{template}
kicad_symbol_units_total{template}
kicad_symbol_pins_total{type}
kicad_symbol_hidden_pins_total{reason,target}
kicad_symbol_pin_stacks_total{target}
kicad_symbol_layout_failures_total{reason}
kicad_symbol_pin_pad_mismatch_total
kicad_symbol_cli_parse_failures_total{target}
kicad_symbol_cli_render_failures_total{target}
kicad_symbol_visual_regression_failures_total{template,target}
kicad_symbol_review_total{reason}
kicad_symbol_cache_hits_total{target}
```

## 42.2 Dashboard

- 每日 Symbol 数；
- KiCad 9/10 成功率；
- Template 分布；
- 多单元比例；
- Pin Stack 数；
- Hidden Pin 数；
- Pin–Pad 不匹配；
- 人工调整率；
- 各器件类别 Layout Score；
- 各 KiCad 小版本兼容率。

---

# 43. 测试集

公开仓库只使用合成或授权 Fixture。

## 43.1 基础格式

1. 空 Library；
2. 单 Symbol；
3. 多 Symbol；
4. UTF-8；
5. Quote Escape；
6. Active-low；
7. Long Description；
8. Footprint Filter；
9. Derived Symbol；
10. Round-trip。

## 43.2 Pin 类型

11. input；
12. output；
13. bidirectional；
14. tri_state；
15. passive；
16. power_in；
17. power_out；
18. open_collector；
19. open_emitter；
20. no_connect；
21. unspecified；
22. clock；
23. inverted；
24. non_logic。

## 43.3 Layout

25. 8 Pin Black Box；
26. LDO；
27. ADC；
28. Sensor；
29. Single Op Amp；
30. Dual Op Amp；
31. Quad Op Amp；
32. Comparator；
33. MCU 32 Pin；
34. MCU 100 Pin；
35. FPGA Bank；
36. Differential Pair；
37. Long Pin Name；
38. Group Gap；
39. Oversized Symbol；
40. Pin rotation 180°；
41. Pin attachment；
42. Text overlap。

## 43.4 Unit

43. Single Unit；
44. Multi Unit；
45. Power Unit；
46. Common Graphics；
47. Repeated Gate Geometry；
48. Unit-specific Pins；
49. Shared Pins；
50. Gate Swap consistency。

## 43.5 Hidden/Stack

51. Hidden NC；
52. Hidden Power rejected；
53. KiCad 9 exploded stack；
54. KiCad 10 native stack；
55. Stack GND；
56. Stack VDD；
57. NC Stack rejected；
58. AVDD/DVDD Stack rejected；
59. Stack round-trip；
60. Hidden debug SVG。

## 43.6 Footprint

61. Exact mapping；
62. Missing Pad；
63. Extra Pad；
64. EP；
65. SH；
66. MP；
67. NC omitted；
68. Multiple Footprints；
69. Derived Package Symbol；
70. Pin-compatible package。

## 43.7 版本

71. KiCad 9 parse；
72. KiCad 9 SVG；
73. KiCad 10 parse；
74. KiCad 10 SVG；
75. 9 file opened by 10；
76. 10 native file rejected from 9 expectation；
77. Golden Fixture Diff；
78. Target Adapter change；
79. CLI timeout；
80. CLI crash。

---

# 44. Benchmark

## 44.1 数据正确性

- Pin Number Accuracy；
- Pin Name Accuracy；
- Pin Type Accuracy；
- Alternate Function Accuracy；
- Unit Assignment Accuracy；
- Pin Stack Accuracy；
- Hidden Pin Policy Accuracy；
- Footprint Pad Match Accuracy。

## 44.2 Layout

- Pin Side Accuracy；
- Functional Group Accuracy；
- Natural Sort Accuracy；
- Pin–Body Attachment；
- Text Overlap Rate；
- Symbol Area；
- Human Layout Correction Rate。

## 44.3 格式与兼容

- KiCad 9 Parse Success；
- KiCad 10 Parse Success；
- SVG Render Success；
- Round-trip Semantic Equality；
- Visual Regression Pass；
- Target-specific Feature Correctness。

## 44.4 分组报告

按：

- 器件类别；
- Pin Count；
- Template；
- Package；
- 单/多单元；
- 厂商；
- KiCad 版本；
- Pin Stack；
- Alternate Functions。

---

# 45. 初始质量目标

```text
Pin Number preservation = 100%
Pin–Pad Mapping accuracy >= 99.9%
Pin Name accuracy >= 99%
KiCad Electrical Type accuracy >= 97%
Unit Assignment accuracy >= 98%
Pin Stack accuracy >= 99%
Hidden Power Pin violations = 0

KiCad 9 parse success >= 99.5%
KiCad 10 parse success >= 99.5%
SVG render success >= 99.5%
Round-trip semantic equality >= 99%
Pin–Body attachment pass = 100%
High-confidence auto-approval accuracy >= 98%
```

这些是目标，不是未经验证的保证。

---

# 46. 工程验收标准

## 46.1 功能

- 能消费批准后的 PinCatalog；
- 能选择 Template；
- 能生成 Symbol IR；
- 能映射 KiCad Pin Type；
- 能生成 Active-low；
- 能生成 Alternate Functions；
- 能生成单单元；
- 能生成多单元；
- 能生成 Power Unit；
- 能处理 Hidden NC；
- 能阻止 Hidden Power；
- 能生成 KiCad 9 Stack；
- 能生成 KiCad 10 Stack；
- 能布局 Pin；
- 能生成 `.kicad_sym`；
- 能运行 KiCad 9/10 CLI；
- 能渲染 SVG；
- 能 Round-trip；
- 能校验 Pin/Pad；
- 能进入人工审核；
- 能保存 Layout Patch；
- 能发布下游事件。

## 46.2 工程质量

- 单元测试覆盖率 >= 85%；
- Serializer >= 95%；
- Geometry Validator >= 95%；
- Pin Type Mapper >= 95%；
- Target Adapter >= 95%；
- JSON Schema 通过；
- Ruff 通过；
- mypy 通过；
- Decimal 坐标；
- 不使用不稳定 float；
- 不提交厂商受版权保护 Symbol；
- 不伪造 KiCad CLI 结果。

## 46.3 性能

- 普通 IC Symbol 生成目标 < 2 秒，不含容器冷启动；
- KiCad CLI 验证 P95 < 10 秒；
- 批量生成支持 Library 聚合；
- 相同输入命中缓存；
- KiCad 9/10 验证可并行；
- 大 Pin Count Symbol 有内存限制。

---

# 47. 推荐仓库结构

```text
kicad-symbol-generation-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── kicad-symbol-generation-agent-spec.md
│   ├── symbol-generation-ir.md
│   ├── kicad9-compatibility.md
│   ├── kicad10-native-features.md
│   ├── layout-engine.md
│   ├── unit-planning.md
│   ├── pin-type-mapping.md
│   ├── validation.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-symbol-ir-before-serialization.md
│       ├── 0002-kicad9-kicad10-separate-targets.md
│       ├── 0003-deterministic-layout.md
│       ├── 0004-hidden-pin-conservative.md
│       └── 0005-real-kicad-round-trip-validation.md
├── src/
│   └── kicad_symbol_agent/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── ir/
│       │   ├── models.py
│       │   ├── builder.py
│       │   ├── schema.py
│       │   └── semantic_hash.py
│       ├── templates/
│       │   ├── base.py
│       │   ├── black_box.py
│       │   ├── opamp.py
│       │   ├── regulator.py
│       │   ├── adc.py
│       │   ├── mcu.py
│       │   └── fpga.py
│       ├── semantics/
│       │   ├── pin_type_mapper.py
│       │   ├── pin_graphic_mapper.py
│       │   ├── active_low.py
│       │   ├── alternate_functions.py
│       │   ├── pin_stack.py
│       │   └── hidden_pin.py
│       ├── units/
│       │   ├── planner.py
│       │   ├── repeated_units.py
│       │   ├── power_unit.py
│       │   └── functional_split.py
│       ├── layout/
│       │   ├── engine.py
│       │   ├── grouping.py
│       │   ├── natural_sort.py
│       │   ├── body_size.py
│       │   ├── pin_position.py
│       │   ├── text_metrics.py
│       │   └── geometry.py
│       ├── sexpr/
│       │   ├── ast.py
│       │   ├── serializer.py
│       │   ├── parser.py
│       │   └── formatter.py
│       ├── targets/
│       │   ├── base.py
│       │   ├── kicad9.py
│       │   ├── kicad10.py
│       │   ├── fixtures.py
│       │   └── compatibility.py
│       ├── validation/
│       │   ├── static.py
│       │   ├── geometry.py
│       │   ├── pin_pad.py
│       │   ├── cli.py
│       │   ├── round_trip.py
│       │   ├── svg.py
│       │   └── visual_regression.py
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── schemas/
│   ├── symbol-generation-ir.schema.json
│   ├── layout-plan.schema.json
│   ├── compatibility-report.schema.json
│   └── validation-report.schema.json
├── fixtures/
│   ├── kicad9/
│   └── kicad10/
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── ir/
│   ├── layout/
│   ├── sexpr/
│   ├── kicad9/
│   ├── kicad10/
│   ├── validation/
│   ├── visual_regression/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── expected/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── generate_golden_fixtures.py
    ├── validate_symbol_library.py
    ├── render_symbol_previews.py
    ├── compare_target_versions.py
    ├── run_symbol_benchmark.py
    └── rebuild_symbol_assets.py
```

---

# 48. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察与 KiCad 版本确认

Codex 必须：

1. 阅读前七个 Agent；
2. 打开实际 PinCatalog；
3. 打开 PackageCatalog；
4. 查找现有 20k Symbol；
5. 查找现有 KiCad 9/10 代码；
6. 查找现有 `.kicad_sym` Serializer；
7. 查找 KiCad CLI 安装；
8. 运行 `kicad-cli version --format about`；
9. 输出 KiCad 9/10 测试环境方案；
10. 输出 Golden Fixture 方案；
11. 输出旧 Symbol 复用和迁移方案；
12. 不修改业务代码；
13. 不创建 Migration；
14. 不安装依赖。

## Phase 1：Symbol Generation IR

实现：

- Symbol IR；
- Pin IR；
- Unit IR；
- Graphics IR；
- Metadata；
- JSON Schema；
- Semantic Hash；
- Mock Input。

## Phase 2：S-expression AST 与基础 Serializer

实现：

- AST；
- quote/escape；
- Decimal；
- stable order；
- basic library；
- simple rectangle；
- simple pins。

## Phase 3：Golden Fixtures 与 Target Contracts

实现：

- KiCad 9 Fixtures；
- KiCad 10 Fixtures；
- target version token；
- generator；
- parser tests；
- normalized AST comparison。

## Phase 4：Pin Type 与 Graphic Mapping

实现：

- electrical types；
- active-low；
- clock；
- inverted；
- unknown/review；
- hidden policy。

## Phase 5：基础 Layout Engine

实现：

- grid；
- body；
- sides；
- grouping；
- natural sort；
- pin length；
- field placement；
- geometry validator。

## Phase 6：单单元模板

实现：

- black box；
- regulator；
- ADC；
- sensor；
- MCU single；
- previews。

## Phase 7：Op Amp 与重复多单元

实现：

- triangle；
- dual/quad；
- power unit；
- repeated geometry；
- orientation validation。

## Phase 8：功能拆分多单元

实现：

- MCU split；
- FPGA split；
- Port/Bank grouping；
- shared power；
- unit consistency。

## Phase 9：Alternate Pin Functions

实现：

- alternate function IR；
- KiCad 9 Adapter；
- KiCad 10 Adapter；
- golden round-trip。

## Phase 10：Pin Stack

实现：

- stack planner；
- eligibility；
- KiCad 9 exploded stack；
- KiCad 10 native stack；
- hidden passive workaround；
- no hidden power；
- stack validation。

## Phase 11：Footprint 与 Derived Symbol

实现：

- default footprint；
- filters；
- package-specific symbols；
- derived symbols；
- Pin–Pad validation；
- EP/SH/MP。

## Phase 12：KiCad CLI 与 Visual Validation

实现：

- sym upgrade；
- sym export svg；
- hidden debug export；
- round-trip；
- semantic diff；
- visual regression；
- timeouts。

## Phase 13：审核与 Layout Patch

实现：

- review API；
- SVG canvas data；
- pin drag；
- unit move；
- patch validation；
- resolved layout。

## Phase 14：API、事件、批量和缓存

实现：

- API；
- events；
- batch library generation；
- retry/cancel；
- regenerate；
- target-specific cache；
- idempotency。

## Phase 15：Benchmark、监控与生产发布

实现：

- benchmark；
- metrics；
- dashboard；
- README；
- deployment；
- KiCad upgrade procedure；
- target rollback；
- download packaging。

---

# 49. Codex 工作纪律

Codex 必须：

1. 先读取实际 PinCatalog；
2. 不重新抽取 Pin；
3. Symbol IR 与 Serializer 分离；
4. KiCad 9 与 10 Target 分离；
5. 不伪造兼容性；
6. 使用真实 KiCad Fixture；
7. 不发明未确认的 S-expression token；
8. generator 不使用 `kicad_symbol_editor`；
9. Pin Number 不得改变；
10. Symbol Pin 与 Footprint Pad 必须校验；
11. Pin Endpoint 使用 Grid；
12. Pin 与 Body 必须接触；
13. Body 旋转时 Pin Rotation 同步；
14. 功能分组优于封装顺序；
15. Power Pin 可见；
16. Hidden Pin 极度保守；
17. Hidden Power Pin 禁止；
18. KiCad 9 Stack 与 KiCad 10 Stack 分开；
19. NC 不 Stack；
20. Alternate Function 不塞满主名称；
21. 不用 LLM 自由绘图；
22. 不用 LLM 猜 Pin Type；
23. 不覆盖人工 Layout Patch；
24. 不提交厂商版权 Symbol；
25. 不伪造 `kicad-cli` 测试结果；
26. 每个 Phase 输出：
    - 修改文件；
    - IR/Schema 变化；
    - Target Adapter 变化；
    - 测试命令；
    - 真实 KiCad 版本；
    - 真实测试结果；
    - SVG/Visual Regression；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 50. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/kicad-symbol-generation-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第八个基础 Agent：

KiCad Schematic Symbol Generation Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. 前七个 Agent 的完整规格；
3. docs/kicad-symbol-generation-agent-spec.md；
4. 前七个 Agent 的实际代码、事件和 Schema；
5. 当前 PinCatalog、PackageCatalog、OrderingCatalog；
6. 当前 Evidence/Approved Record；
7. 当前约 20k KiCad Symbol；
8. 当前约 20k Footprint 和约 90 万 Package Mapping；
9. 当前 KiCad 9/10 相关代码；
10. 当前对象存储、数据库、任务队列、审核、Docker 和 CI。

本 Agent 的职责是：

- 使用已经审核的 Pin 和 Package 数据；
- 建立 Symbol Generation IR；
- 根据器件类别选择 Symbol Template；
- 映射 KiCad Electrical Type；
- 映射 Pin Graphic Style；
- 处理 Active-low；
- 处理 Alternate Pin Functions；
- 处理 Hidden Pin；
- 处理 KiCad 9 和 KiCad 10 Pin Stack；
- 生成单单元和多单元符号；
- 为共享电源创建 Power Unit；
- 按功能对 Pin 布局；
- 生成 Body、Fields 和 Footprint Filter；
- 为每个 Package Variant 生成独立 Fully Specified Symbol；
- 生成 KiCad 9/10 `.kicad_sym`；
- 使用真实 KiCad 9/10 CLI 解析、Round-trip 和 SVG 渲染；
- 校验 Symbol Pin Number 与 Footprint Pad Number；
- 输出 Manifest、Compatibility Report 和 Quality Report；
- 低置信度和布局冲突进入审核。

硬约束：

- 不重新识别 Pin；
- Pin Number 不得修改；
- Symbol IR 与 KiCad Serializer 分离；
- KiCad 9 与 KiCad 10 是独立 Target；
- 不允许使用 KiCad 10 专属结构伪装成 KiCad 9；
- 第三方 generator 不得使用 kicad_symbol_editor；
- 不凭记忆发明 S-expression token；
- 未文档化功能必须以真实 KiCad 保存的 Golden Fixture 为准；
- Pin Connection Point 必须在 100 mil Grid；
- Pin Body Endpoint 必须接触 Symbol Body；
- Body 旋转时 Pin Position 和 Rotation 必须同步；
- Inputs/Control 左，Outputs 右，正电源上，Ground/负电源下；
- Power Converter 使用输入左、输出右例外；
- Power Pin 默认可见；
- Hidden Power Pin 禁止；
- NC/DNC 才可按策略隐藏；
- KiCad 9 使用 exploded overlapping stack；
- KiCad 10 可使用 native compact stack；
- NC 不得 Stack；
- Alternate Functions 不得全部塞进主 Pin Name；
- Symbol Pin 与 Footprint Pad 必须一致；
- V1 不调用外部通用大模型；
- 不使用 LLM 自由绘制 Symbol；
- 不使用 LLM 猜 Pin Type；
- 不覆盖机器原始结果；
- 不覆盖人工 Layout Patch；
- 不提交厂商受版权保护 Symbol；
- 不伪造 KiCad CLI 测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查前七个 Agent 实际完成程度；
3. 打开实际 PinCatalog 和 PackageCatalog；
4. 查找现有 Symbol Generator、S-expression Serializer 和 Layout Engine；
5. 抽样分析现有 20k `.kicad_sym`；
6. 查找现有 KiCad 9 和 KiCad 10 测试环境；
7. 运行所有可用的 `kicad-cli version --format about`；
8. 检查 `kicad-cli sym upgrade` 和 `sym export svg` 是否可用；
9. 分析 KiCad 9 与 KiCad 10 Pin Stack、Alternate Function、多 Unit 文件差异；
10. 在 docs/kicad-symbol-implementation-plan.md 中生成实施计划；
11. 在 docs/kicad-symbol-generation-ir.md 中生成 IR 设计；
12. 在 docs/kicad9-kicad10-compatibility-plan.md 中生成双 Target 方案；
13. 在 docs/kicad-symbol-layout-engine.md 中生成布局方案；
14. 在 docs/kicad-symbol-golden-fixture-plan.md 中生成 Fixture 计划；
15. 在 docs/kicad-symbol-migration-plan.md 中生成现有 Symbol 复用与迁移方案；
16. 在 docs/kicad-symbol-benchmark-plan.md 中生成 Benchmark；
17. 给出拟新增、拟修改和拟复用文件；
18. 给出 Phase 1 精确范围；
19. 不修改业务代码；
20. 不创建 Migration；
21. 不安装依赖；
22. 运行当前仓库已有 lint、type check 和测试。

如果没有 KiCad 9 或 10，明确记录缺失版本和安装建议，不得编造测试结果。

最终回复必须包含：

- 仓库现状；
- 与前七个 Agent 的衔接；
- 当前 Symbol 数据和生成代码；
- KiCad 9/10 实际版本；
- Symbol IR；
- 双 Target 兼容方案；
- Pin Type/Hidden/Stack 方案；
- Multi-unit 方案；
- Layout Engine；
- Golden Fixture；
- CLI/Visual Validation；
- 旧 Symbol 迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 51. 后续 Phase 提示词模板

```text
继续实现 KiCad Schematic Symbol Generation Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读八个 Agent 的规格；
3. 阅读 KiCad Symbol Implementation Plan；
4. 阅读 Symbol Generation IR；
5. 阅读 KiCad 9/10 Compatibility Plan；
6. 阅读 Layout Engine 和 Golden Fixture Plan；
7. 检查上一阶段代码和测试；
8. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Pin Number 不变；
- Symbol IR/Serializer 分离；
- KiCad 9/10 Target 分离；
- 使用真实 Golden Fixture；
- 不发明 token；
- Grid、Pin–Body、Rotation 校验；
- Power Pin 可见；
- Hidden Power 禁止；
- Stack 按版本处理；
- Pin–Pad 校验；
- 不依赖外部 LLM；
- 不覆盖机器和人工结果；
- 不提交版权 Symbol；
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
9. 运行 KiCad 9 CLI；
10. 运行 KiCad 10 CLI；
11. 运行 SVG/Visual Regression；
12. 更新文档；
13. 总结修改。

最终回复：

- 修改文件；
- IR/Schema 变化；
- Target Adapter 变化；
- KiCad 版本；
- 测试命令和真实结果；
- SVG/Visual 结果；
- Pin–Pad 结果；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 52. MVP 演示流程

1. 输入 LM358 SOIC-8 PinCatalog；
2. 识别 Dual Op Amp；
3. 生成 Unit A、B、Power；
4. VCC 在 Power Unit 上方；
5. VEE/GND 在下方；
6. IN+/IN- 左侧；
7. OUT 右侧；
8. Pin 与 Body 正确连接；
9. 输出 KiCad 9；
10. 输出 KiCad 10；
11. CLI Parse 成功；
12. SVG Preview 成功；
13. Pin–Pad 一致；
14. 输入 MCU LQFP48；
15. 生成 Single 与 Split Preview；
16. GPIO 按 Port 排序；
17. Power 上、Ground 下；
18. Alternate Functions 可选；
19. 输入多个 GND Pin；
20. KiCad 9 生成 Exploded Stack；
21. KiCad 10 生成 Native Stack；
22. Hidden Power 检查通过；
23. 输入 QFN EP；
24. EP 与 Footprint Pad 校验；
25. 模拟 Pin Rotation 错误；
26. Geometry Validator 阻断；
27. 人工调整 Pin Side；
28. 保存 Layout Patch；
29. 重新生成；
30. 发布 `component.kicad-symbol.ready`。

---

# 53. 下游事件

```json
{
  "event_type": "component.kicad-symbol.ready",
  "event_version": "1.0",
  "part_id": "uuid",
  "package_variant_id": "uuid",
  "symbol_asset_id": "uuid",
  "library_name": "EEHUB_Amplifier_Operational",
  "symbol_name": "LM358D",

  "targets": {
    "kicad9": {
      "library_uri": "s3://.../kicad9/library.kicad_sym",
      "validated_with": "9.0.9"
    },
    "kicad10": {
      "library_uri": "s3://.../kicad10/library.kicad_sym",
      "validated_with": "10.0.4"
    }
  },

  "manifest_uri": "s3://.../symbol_manifest.json",
  "compatibility_report_uri": "s3://.../compatibility_report.json",
  "quality_report_uri": "s3://.../quality_report.json",

  "overall_quality": 0.98,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

下游自动消费条件：

```text
review_status = approved
AND target parse success = true
AND target render success = true
AND pin-pad match has no blocking error
AND no hidden power pin violation
```

---

# 54. 官方技术参考

Codex 开始实施时必须重新检查当前版本的官方文档。

## KiCad Symbol Library File Format

- https://dev-docs.kicad.org/en/file-formats/sexpr-symbol-lib/
- https://dev-docs.kicad.org/en/file-formats/sexpr-intro/

## KiCad 9 Schematic/Symbol Editor

- https://docs.kicad.org/9.0/en/eeschema/eeschema.html
- https://docs.kicad.org/9.0/en/cli/cli.html

## KiCad 10 Schematic/Symbol Editor

- https://docs.kicad.org/10.0/en/eeschema/eeschema.html
- https://docs.kicad.org/10.0/en/cli/cli.html

## KiCad Library Conventions

- https://klc.kicad.org/
- https://klc.kicad.org/symbol/s3/s3.8/
- https://klc.kicad.org/symbol/s4/s4.1/
- https://klc.kicad.org/symbol/s4/s4.2/
- https://klc.kicad.org/symbol/s4/s4.3/
- https://klc.kicad.org/symbol/s4/s4.6/
- https://klc.kicad.org/symbol/s5/s5.2/
