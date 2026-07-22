# 替代料推荐 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：33  
> Agent 名称：Component Alternative Recommendation Agent  
> 中文名称：替代料推荐 Agent  
> 版本：V1.0  
> 定位：基于 Form-Fit-Function、Pin-to-Pin、封装、电气参数、环境与认证要求，为已解析的标准制造商型号推荐可解释、可分级、可审核的替代料，并明确差异、限制和设计风险  
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - 元器件主数据库与参数知识库
> - Datasheet 结构化知识、Pin、Package、Ordering Variant
> - KiCad Symbol、Footprint 和 3D 模型
> - 生命周期、认证、质量等级和供应商数据
> - 企业 AVL、历史采购、历史替代和生产验证数据
>
> 下游：
> - BOM 成本优化
> - 生命周期与停产风险分析
> - 多渠道价格库存与交期
> - 采购建议与 AVL 管理
> - SMT 制造、试产和变更流程
> - 设计变更、ECN/ECR 和工程审核
> - Tindie / ezPLM 选型与推荐
>
> 目标读者：产品负责人、硬件工程师、采购工程师、质量工程师、数据工程师、搜索工程师、后端工程师、测试工程师、Codex

---

# 1. 建设目标

建设一个独立、可复用、可测试、可版本化的替代料推荐 Agent。

Agent 接收已经由 Agent 32 解析为标准器件实体的源器件，并结合：

- 器件类别；
- 功能；
- Pin Number；
- Pin Name；
- Pin Type；
- Pin-to-Pin 映射；
- Package；
- Footprint；
- Body Size；
- Pin Count；
- Exposed Pad；
- 3D 高度；
- 电气参数；
- Min/Typ/Max；
- 测试条件；
- 温度条件；
- 工作模式；
- 供电范围；
- 时序；
- 热性能；
- 环境等级；
- 汽车级、工业级、医疗或安规要求；
- 生命周期；
- 厂商推荐替代；
- 企业 AVL；
- 历史量产记录；
- 供应链价格库存；
- 项目使用场景。

输出：

```text
替代候选列表
替代等级
Form 兼容性
Fit 兼容性
Function 兼容性
Pin-to-Pin 映射
参数差异
封装与机械差异
认证差异
固件/软件影响
测试与验证要求
风险等级
推荐理由
不推荐理由
证据与置信度
```

系统必须支持：

1. 识别完全相同或重新包装的同一器件；
2. 识别同厂商推荐 Replacement；
3. 识别真正的 Pin-to-Pin Drop-in Replacement；
4. 识别封装相同但 Pin Function 不同的危险候选；
5. 识别功能相同但需要改板的 Design Alternative；
6. 比较参数时考虑“越大越好、越小越好、范围包含、必须相等、模式兼容”等方向；
7. 比较 Min/Typ/Max 和测试条件，而不是只比较典型值；
8. 比较全温区能力，而不是只比较室温数据；
9. 比较 Absolute Maximum 与 Recommended Operating Condition；
10. 比较 Package、Footprint、Pin 1、EP、Thermal Pad、Height 和 3D 机械约束；
11. 比较 Pin-to-Pin、Power Pin、NC、Reserved、Boot、Reset 和 Alternate Function；
12. 比较认证、质量等级和环境状态；
13. 区分技术替代、采购替代、AVL 替代和紧急缺料替代；
14. 对每个差异输出风险和验证建议；
15. 无法证明兼容时不宣称“可直接替代”；
16. 将低置信度和高风险结果进入工程审核；
17. 人工确认后形成有方向、有作用域、有版本的替代关系；
18. 通过历史验证数据持续提高推荐质量；
19. 支持 110 万型号数据库的高性能召回和批量 BOM 分析。

---

# 2. 与 Agent 32 的边界

## 2.1 Agent 32 负责

```text
BOM 行
→ 标准 Manufacturer
→ 标准 MPN
→ Part
→ Package Variant
→ Ordering Variant
```

## 2.2 Agent 33 负责

```text
已解析源 Part
→ 替代候选召回
→ Form-Fit-Function 比较
→ 风险评估
→ 替代等级
→ 验证建议
```

Agent 33 不应重新猜测源器件身份。

如果 Agent 32 只解析到：

```text
base_part_resolved
generic_specification
unresolved
```

Agent 33 必须根据解析层级选择不同工作模式，不能把模糊源器件当成精确 Part。

---

# 3. 替代关系是有方向的

必须建模：

```text
candidate_part CAN_REPLACE source_part
```

而不是无方向的：

```text
source_part EQUIVALENT_TO candidate_part
```

例如：

- 5.5 V 额定器件可能替代 3.6 V 额定器件；
- 3.6 V 额定器件不一定能反向替代；
- 更高精度器件通常可替代低精度器件；
- 低精度器件不能反向替代；
- 更宽温度范围可替代较窄温度范围；
- 反向不成立；
- 更高输出电流也可能因为稳定性、封装、热阻不同而不能直接替代。

因此每条关系保存：

```text
source_part_id
candidate_part_id
direction
application_context
validation_status
effective_revision
```

---

# 4. 替代等级

推荐至少分为七级。

## Level 0：Identical Identity

```text
同一 Part / 同一 Die / 同一规格
仅包装数量、卷盘方式、环保后缀或供应渠道不同
```

示例：

```text
同一个器件的 Reel、Cut Tape、Tube Ordering Variant
```

这类通常是采购层面的等价，不一定需要工程变更。

## Level 1：Verified Drop-in Replacement

满足：

```text
Form Compatible
Fit Compatible
Function Compatible
Pin-to-Pin Compatible
关键参数满足源器件应用要求
认证和质量等级满足
已有厂商、企业或量产验证
```

可作为强推荐，但仍需遵守企业审批策略。

## Level 2：High-confidence Pin-compatible Alternative

满足：

- Footprint 和 Pad 一致；
- Pin Map 一致或安全兼容；
- 关键电气参数满足；
- 存在少量非关键差异；
- 尚无企业量产验证，或需要有限测试。

## Level 3：Conditional Pin-compatible Alternative

Pin-to-Pin 基本兼容，但有条件：

- 需要修改外围参数；
- 需要改变补偿网络；
- 需要改变 Startup/Enable 配置；
- 需要固件修改；
- 需要检查稳定性；
- 需要重新验证 EMC、热和时序。

不能标记为直接替换。

## Level 4：Footprint-compatible, Not Pin-compatible

封装和 Footprint 相同，但：

- Pin Function 不同；
- Power/NC/Reserved 不同；
- Alternate Function 不同；
- Pin 1 或 EP 连接不同。

属于高风险，不得直接替代。

## Level 5：Function-compatible Design Alternative

功能接近，但需要：

- 改原理图；
- 改 PCB；
- 改 BOM；
- 改固件；
- 改机械结构。

适合重新设计，不适合缺料直接换料。

## Level 6：Not Recommended / Incompatible

存在硬冲突或无法满足应用要求。

---

# 5. Form-Fit-Function 定义

## 5.1 Form

机械和外形兼容性：

```text
Package Family
Body Length / Width / Height
Pin Count
Pitch
Lead Span
Lead Style
Footprint
Pad Geometry
Exposed Pad
Thermal Pad
Mounting Hole
Pin 1
Orientation
Keepout
3D Envelope
Weight
Coplanarity
```

## 5.2 Fit

装配和连接兼容性：

```text
Pin-to-Pin
Pad-to-Pin
Power Pin
Ground Pin
Signal Direction
NC / DNC / Reserved
Exposed Pad Connection
Boot / Strap
Reset
Enable
Clock
Differential Pair
Alternate Function
Solder Process
Reflow Profile
Mounting Technology
```

## 5.3 Function

功能与性能兼容性：

```text
器件类别
核心功能
工作模式
供电范围
输入/输出能力
精度
速度
带宽
噪声
功耗
时序
稳定性
热性能
保护功能
通信协议
寄存器和软件接口
环境与可靠性
认证与质量等级
```

---

# 6. 技术替代和采购替代分离

必须区分：

```text
technical_substitute
procurement_equivalent
approved_vendor_alternative
emergency_shortage_alternative
design_alternative
```

## 6.1 Technical Substitute

关注技术兼容性。

## 6.2 Procurement Equivalent

同一器件不同包装、渠道或 SKU。

## 6.3 AVL Alternative

企业已批准多个型号。

## 6.4 Emergency Alternative

可能存在较高风险，只用于缺料应急，必须带：

- 限定批次；
- 限定项目；
- 临时有效期；
- 验证要求；
- ECN/ECR。

## 6.5 Design Alternative

需要设计修改。

---

# 7. 标准输入结构

```json
{
  "recommendation_request_id": "uuid",

  "source": {
    "part_id": "uuid",
    "manufacturer_id": "uuid",
    "manufacturer_part_number": "TPS62160DSGR",
    "base_part_id": "uuid",
    "package_variant_id": "uuid",
    "ordering_variant_id": "uuid"
  },

  "application": {
    "project_id": "uuid",
    "bom_id": "uuid",
    "bom_line_id": "uuid",
    "assembly_revision": "RevC",
    "quantity": "1000",
    "use_case": "3.3V rail for MCU",
    "actual_conditions": {
      "input_voltage_min": "5 V",
      "input_voltage_max": "12 V",
      "output_voltage": "3.3 V",
      "output_current_max": "0.65 A",
      "ambient_temperature_min": "-20 degC",
      "ambient_temperature_max": "70 degC",
      "switching_frequency": null
    },
    "required_certifications": [
      "RoHS",
      "REACH"
    ],
    "required_quality_grade": "industrial"
  },

  "requested_level": "pin_compatible_preferred",

  "constraints": {
    "same_footprint_required": true,
    "same_pinout_required": true,
    "firmware_change_allowed": false,
    "passive_change_allowed": false,
    "pcb_change_allowed": false,
    "manufacturer_whitelist": [],
    "manufacturer_blacklist": [],
    "maximum_risk": "medium"
  }
}
```

---

# 8. 标准输出结构

```json
{
  "recommendation_result_id": "uuid",
  "source_part_id": "uuid",
  "status": "completed",

  "recommendations": [
    {
      "rank": 1,
      "candidate_part_id": "uuid",
      "candidate_mpn": "ABC1234XYZ",
      "manufacturer": "Example Semiconductor",

      "replacement_level": "conditional_pin_compatible",
      "recommendation_type": "technical_substitute",

      "compatibility": {
        "form": {
          "status": "compatible",
          "score": 0.99
        },
        "fit": {
          "status": "compatible_with_conditions",
          "score": 0.94
        },
        "function": {
          "status": "compatible_with_conditions",
          "score": 0.91
        },
        "pin_to_pin": {
          "status": "exact",
          "score": 1.0
        }
      },

      "differences": [
        {
          "dimension": "switching_frequency",
          "source": "1 MHz",
          "candidate": "2.25 MHz",
          "assessment": "requires_external_component_review",
          "severity": "medium"
        }
      ],

      "risks": [
        {
          "risk_code": "inductor_reselection_required",
          "severity": "medium",
          "description": "Higher switching frequency may require recalculation of inductor and output capacitor.",
          "verification": [
            "Recalculate power stage",
            "Run transient simulation",
            "Verify thermal performance"
          ]
        }
      ],

      "certification": {
        "status": "compatible",
        "missing": [],
        "different": []
      },

      "confidence": {
        "candidate_identity": 0.99,
        "form": 0.99,
        "fit": 0.95,
        "function": 0.92,
        "certification": 0.98,
        "overall": 0.95
      },

      "decision": {
        "auto_approved": false,
        "review_required": true,
        "reason_codes": [
          "external_component_review_required"
        ]
      },

      "evidence_bundle_id": "uuid"
    }
  ],

  "unresolved_dimensions": [],
  "quality": {}
}
```

---

# 9. 源器件应用上下文

仅比较 Datasheet 最大能力是不够的。

必须区分：

```text
source_part_capability
actual_application_requirement
candidate_part_capability
```

例如源器件输出 1 A，但项目实际只使用 300 mA。候选 600 mA 可能在当前应用中足够，但不能宣称为源器件的全规格替代。

输出应明确：

```text
application-compatible
not full-spec equivalent
```

## 9.1 两种比较模式

### Full-spec Replacement

候选必须覆盖源器件公开规格。

### Application-specific Replacement

候选只需满足当前项目的真实条件和安全裕量。

两者不能混淆。

---

# 10. 候选召回

采用多通道：

```text
A. 已批准替代关系
B. 厂商官方 Replacement
C. 同一 Base Part / Family
D. Pin-to-Pin 索引
E. Package + Pin Map
F. 类别 + 参数搜索
G. Datasheet Reference / Cross Reference
H. 历史量产替代
I. AVL
J. 供应链候选
K. 图关系召回
```

所有通道统一输出 `AlternativeCandidate`。

---

# 11. Channel A：企业已批准替代

优先级最高。

保存：

```text
scope
project
customer
assembly_revision
source_part
candidate_part
direction
approval_status
validation_report
effective_date
expiration_date
approved_by
```

即使已批准，也要检查：

- 当前 Revision；
- 当前 Package；
- 当前认证要求；
- 替代关系是否过期；
- 当前项目条件是否超出原验证范围。

---

# 12. Channel B：厂商官方 Replacement

官方关系可能是：

```text
direct replacement
recommended replacement
newer alternative
similar product
migration path
```

必须区分。

厂商标记“推荐新品”并不等于 Pin-to-Pin。

---

# 13. Channel C：同系列和同 Die

同系列候选可能只差：

- 温度；
- 精度；
- 封装；
- 包装；
- 质量等级；
- 速度等级；
- 内存；
- 功能选项。

同系列并不自动等价。

必须比较具体 Variant。

---

# 14. Channel D/E：Pin-to-Pin 和封装召回

建立：

```text
Pin Signature Index
Package Geometry Index
Footprint Pad Map Index
```

## 14.1 Pin Signature

建议包含：

```text
pin_count
ordered_pin_numbers
canonical_pin_roles
power_domains
ground_pins
nc_pins
reserved_pins
ep_connection
alternate_function_groups
```

## 14.2 Canonical Pin Role

例如：

```text
POWER_INPUT
GROUND
ANALOG_INPUT
ANALOG_OUTPUT
DIGITAL_INPUT
DIGITAL_OUTPUT
BIDIRECTIONAL
ENABLE
RESET
CLOCK
BOOT
FEEDBACK
SWITCH_NODE
REFERENCE
NO_CONNECT
RESERVED
EXPOSED_PAD
```

## 14.3 Pin Map Hash

生成多个 Hash：

```text
exact_pin_map_hash
electrical_role_hash
power_ground_hash
package_pad_hash
```

用于快速召回。

---

# 15. Channel F：类别和参数召回

通过 Component Category Schema 获取关键参数。

例如运放：

```text
channel count
supply voltage
input common-mode
output swing
GBW
slew rate
input offset
input bias
noise
rail-to-rail
package
```

例如 Buck：

```text
input range
output range
current
frequency
topology
synchronous
control mode
feedback voltage
quiescent current
package
```

参数召回只生成候选，不直接证明兼容。

---

# 16. 参数语义注册表

这是 Agent 的核心基础设施。

每个参数必须定义比较语义。

```yaml
parameter_id: output_current
comparison_semantics: candidate_greater_or_equal
condition_dimensions:
  - input_voltage
  - output_voltage
  - temperature
  - package
safety_margin:
  default_percent: 20
hard_constraint: true
```

支持的比较语义：

```text
exact_equal
candidate_greater_or_equal
candidate_less_or_equal
candidate_range_contains_source_range
candidate_range_contains_application_range
source_range_contains_candidate_range
overlap_required
boolean_required_true
enumeration_contains
mode_compatible
curve_comparison
conditional_formula
custom_category_rule
```

---

# 17. 参数方向性

## 17.1 越大通常越好

示例：

```text
Maximum Input Voltage
Output Current Capability
Memory Capacity
ESD Rating
Temperature Range Width
```

但仍需检查副作用。

## 17.2 越小通常越好

示例：

```text
Input Offset
Noise
Quiescent Current
Leakage
Rds(on)
Thermal Resistance
Propagation Delay
```

## 17.3 范围包含

示例：

```text
Supply Voltage Range
Input Common-mode Range
Output Voltage Range
Operating Temperature
Frequency Range
```

## 17.4 必须相等或模式兼容

示例：

```text
Logic Function
Pin Map
Communication Protocol
Memory Interface
Register Addressing
Polarity
Output Type
Control Mode
```

## 17.5 不能简单排序

示例：

```text
Switching Frequency
Compensation Type
Capacitance
Inductance
Gain
Threshold
```

需要应用上下文或公式。

---

# 18. Min/Typ/Max 比较

禁止只比较 Typ。

## 18.1 推荐条件

对于满足性约束，优先比较：

```text
candidate guaranteed minimum
candidate guaranteed maximum
```

例如输出电流不能只看典型值。

## 18.2 条件一致性

比较值必须考虑：

```text
temperature
supply voltage
load
frequency
package
test circuit
measurement bandwidth
operating mode
```

条件不一致时：

```text
comparison_status = not_directly_comparable
```

不能硬算优劣。

## 18.3 数据缺失

缺少 Min/Max 时：

- 降低置信度；
- 标记 Datasheet Gap；
- 进入审核；
- 不用 Typ 冒充 Guarantee。

---

# 19. Recommended 与 Absolute Maximum

必须分开。

候选 Absolute Maximum 更高，不代表 Recommended Operating Range 满足。

比较顺序：

```text
Recommended Operating Conditions
→ Guaranteed Electrical Characteristics
→ Typical Characteristics
→ Absolute Maximum
```

Absolute Maximum 主要用于风险边界，不用于正常替代能力证明。

---

# 20. 安全裕量

应用特定替代需要 Safety Margin。

例如：

```text
candidate_current_capability >= actual_max_current × 1.2
candidate_voltage_rating >= actual_max_voltage × 1.2
```

具体 Margin 按类别和企业策略配置。

不能全局固定 20%。

```text
power semiconductor
capacitor
inductor
connector
logic
sensor
```

各有不同策略。

---

# 21. Pin-to-Pin 兼容性

## 21.1 Exact

每个 Pad Number：

```text
source canonical role == candidate canonical role
```

并检查：

- Electrical Type；
- Direction；
- Active Level；
- Power Domain；
- Required Connection；
- NC/Reserved；
- EP。

## 21.2 Safe Superset

候选 Pin 可能提供额外功能，但默认功能和源器件一致。

需要检查：

- 默认上电状态；
- 内部 Pull-up/Pull-down；
- 未使用功能是否安全；
- Boot Strap；
- Configuration Pin。

## 21.3 Conditional

Pin Number 相同，但：

- EN Threshold 不同；
- Open-drain vs Push-pull；
- NC 变为功能脚；
- Reserved 变为连接脚；
- EP 要求不同；
- 上电默认不同。

进入条件兼容。

## 21.4 Incompatible

- VCC 对 GND；
- Input 对 Output；
- SW 对 FB；
- NC 对 Power；
- Pin Count 相同但 Pin Map 不同；
- Pin 1 方向不同；
- EP 必须接不同网络。

---

# 22. NC、DNC 和 Reserved 风险

这是替代料最容易踩坑的区域。

必须区分：

```text
NC: internally not connected
DNC: do not connect
Reserved: must follow datasheet rule
No Ball / Missing Ball
Test Pin
Factory Use
```

源器件 NC Pad 在 PCB 上可能被接地、连接或留空。

候选器件同一位置如果变成功能脚，可能造成损坏。

Agent 必须结合：

- 原理图网络；
- PCB Net；
- Source Datasheet；
- Candidate Datasheet；

判断风险。

---

# 23. Power 与 Ground

必须比较：

```text
power pin count
power domain
analog/digital supply
ground segmentation
EP grounding
decoupling requirement
power sequencing
brownout behavior
reverse current
```

AVDD 与 DVDD 不能因同为 Power 就视为等价。

---

# 24. 封装和 Footprint 兼容性

## 24.1 Exact Footprint

比较：

```text
Pad Number
Pad Position
Pad Size
Pitch
Body
EP
Courtyard
Orientation
Pin 1
```

## 24.2 Package Name 不足够

两个都叫：

```text
QFN-32
```

可能 Body、Pitch 和 EP 完全不同。

## 24.3 Height

若机械空间受限，必须检查：

```text
body height
3D envelope
top clearance
bottom clearance
```

## 24.4 Thermal Pad

比较：

```text
size
number
network
paste pattern
thermal via recommendation
power dissipation role
```

## 24.5 Hand-solder / Wettable Flank

对制造流程也可能有影响，需要作为装配差异报告。

---

# 25. Function 兼容性

## 25.1 核心功能

必须相同或明确为可接受 Superset。

## 25.2 模式

例如：

- PWM / PFM；
- Current Mode / Voltage Mode；
- Continuous / Discontinuous；
- Sleep；
- Burst；
- Auto Mode；
- Comparator Output Type。

模式差异可能影响噪声、EMI、效率和稳定性。

## 25.3 默认行为

比较：

```text
power-on default
reset state
enable polarity
startup delay
soft-start
output discharge
watchdog default
address default
```

---

# 26. 软件和固件兼容性

针对 MCU、FPGA、Memory、Sensor、Codec、Interface IC：

```text
register map
device ID
I2C/SPI address
command set
timing
boot mode
firmware driver
API
programming algorithm
bitstream
toolchain
```

## 26.1 分类

```text
firmware_compatible
driver_change_required
register_change_required
recompile_required
bootloader_change_required
not_software_compatible
```

## 26.2 MCU/FPGA

同 Pinout 不代表：

- 外设映射相同；
- 内存相同；
- 时钟树相同；
- 启动方式相同；
- 编程接口相同。

默认必须人工审核。

---

# 27. 类别专用比较 Profile

通用规则不足以支持所有器件。

必须为类别建立 Profile。

## 27.1 运算放大器

比较：

```text
channel count
supply range
input common-mode
output swing
GBW
slew rate
offset
bias current
noise
input type
rail-to-rail
stability
capacitive load
shutdown
package
```

关键风险：

```text
minimum stable gain
phase margin
input common-mode violation
output drive
oscillation
```

## 27.2 Comparator

比较：

```text
input range
propagation delay
hysteresis
output type
open collector/open drain/push-pull
reference
latch
shutdown
```

## 27.3 LDO

比较：

```text
input range
output voltage
output current
dropout
quiescent current
stability capacitor
ESR range
enable polarity
output discharge
reverse current
thermal
pin map
```

## 27.4 Buck / Boost

比较：

```text
topology
input/output range
current
switching frequency
control mode
internal switch
compensation
inductor range
capacitor range
feedback voltage
current limit
soft start
power good
thermal
```

## 27.5 MOSFET

比较：

```text
Vds
Id
Rds(on) at actual Vgs
Vgs(th)
Qg
Ciss/Crss
body diode
SOA
avalanche
package
thermal
```

不能只比较 `Rds(on)`。

## 27.6 Diode

比较：

```text
reverse voltage
forward current
forward voltage
recovery time
leakage
capacitance
surge
package
```

## 27.7 Resistor

比较：

```text
resistance
tolerance
power
voltage
TCR
package
pulse rating
technology
```

## 27.8 Capacitor

比较：

```text
capacitance
tolerance
rated voltage
dielectric
DC bias
ESR
ripple
temperature
package
polarity
```

仅比较名义容值和耐压是不够的。

## 27.9 Inductor

比较：

```text
inductance
tolerance
Isat
Irms
DCR
SRF
core
shielding
package
height
```

## 27.10 Logic

比较：

```text
logic function
channel count
voltage family
VIH/VIL
VOH/VOL
drive
delay
input tolerance
power-off protection
output type
pin map
```

## 27.11 Memory

比较：

```text
type
density
organization
bus
voltage
speed
timing
command set
package
temperature
```

## 27.12 MCU

比较：

```text
architecture
core
flash
RAM
package
pin map
peripheral mapping
clock
ADC/DAC
USB/CAN/Ethernet
boot
debug
security
toolchain
firmware
```

默认不自动批准跨型号 MCU 替代。

## 27.13 FPGA/CPLD

比较：

```text
logic resources
memory
DSP
PLL
IO banks
voltage
package
pinout
speed grade
configuration
toolchain
bitstream
```

默认需要重新综合和完整验证。

## 27.14 Sensor

比较：

```text
measurement type
range
accuracy
resolution
noise
response
interface
address
register map
calibration
package
orientation
```

## 27.15 Connector

比较：

```text
contact count
pitch
orientation
keying
current
voltage
mating cycle
mechanical envelope
mounting
pin numbering
```

---

# 28. 认证和质量等级

## 28.1 认证数据结构

保存：

```text
certification_type
status
certificate_id
scope
standard_version
issuer
valid_from
valid_to
source
last_verified_at
```

## 28.2 常见维度

可能包括：

```text
RoHS
REACH
Halogen Free
AEC-Q100/Q101/Q200
Automotive Grade
Industrial Grade
Medical-related qualification
UL Recognition
Functional Safety Documentation
Radiation Tolerance
Military / Aerospace Grade
Conflict Minerals
Country of Origin
```

## 28.3 不能只看营销标签

例如：

```text
Automotive qualified
Automotive capable
AEC-Q qualified
```

含义不同。

必须保存证据和状态。

## 28.4 认证替代规则

候选必须：

- 满足项目明确要求；
- 或由质量工程师批准豁免。

缺少认证时不能自动批准。

---

# 29. 生命周期与供应链

生命周期不是 Form-Fit-Function 的一部分，但影响推荐排序。

保存独立维度：

```text
active
NRND
obsolete
last_time_buy
unknown
```

供应链维度：

```text
authorized_stock
lead_time
price
multi_source
geographic_risk
counterfeit_risk
```

技术兼容分和供应链分必须分开。

不能因为库存多就提高技术兼容分。

---

# 30. 差异模型

每个候选输出差异列表。

```json
{
  "difference_id": "uuid",
  "dimension_type": "electrical_parameter",
  "parameter_id": "input_offset_voltage",

  "source": {
    "value": "1",
    "unit": "mV",
    "bound": "max",
    "condition": "-40 to 85 degC"
  },

  "candidate": {
    "value": "2",
    "unit": "mV",
    "bound": "max",
    "condition": "-40 to 85 degC"
  },

  "assessment": "candidate_worse",
  "severity": "medium",
  "application_impact": "May reduce DC accuracy.",
  "verification_required": true
}
```

---

# 31. 风险分类

## 31.1 风险等级

```text
critical
high
medium
low
informational
unknown
```

## 31.2 风险类别

```text
pinout
package
power
electrical
timing
thermal
stability
firmware
protocol
mechanical
manufacturing
certification
quality
lifecycle
supply_chain
data_quality
application_unknown
```

## 31.3 Unknown 是风险

如果关键参数缺失：

```text
risk = unknown
```

不能把缺失数据当成兼容。

---

# 32. 验证建议

Agent 不仅输出差异，还生成验证计划。

## 32.1 验证层级

```text
document_review
schematic_review
pcb_review
simulation
bench_test
thermal_test
emc_test
firmware_test
environmental_test
pilot_build
qualification_test
```

## 32.2 验证模板

例如 LDO：

```text
Check output capacitor stability
Measure startup waveform
Measure dropout at maximum load
Check reverse-current behavior
Run thermal test
```

例如 Op Amp：

```text
Check common-mode range
Check output swing
Run step response
Check capacitive-load stability
Measure offset impact
```

---

# 33. 替代候选评分

必须分维度：

```text
identity_score
form_score
fit_score
function_score
pin_to_pin_score
electrical_score
thermal_score
software_score
certification_score
data_quality_score
validation_score
supply_chain_score
commercial_score
```

最终不能简单平均。

## 33.1 Gate + Rank

推荐：

```text
Hard Gate
→ Compatibility Class
→ Technical Rank
→ Supply/Commercial Rank
```

技术不合格的候选不能因为便宜和有库存排到前面。

## 33.2 分层结果

先给出：

```text
technical_compatibility
```

再给出：

```text
procurement_preference
```

---

# 34. Hard Gate

以下默认阻断 Drop-in：

- Pin Count 不同；
- Package/Footprint 不兼容；
- Pin-to-Pin 冲突；
- Power/Ground 冲突；
- Recommended Voltage 不满足；
- 电流能力不足；
- 温度范围不足；
- 必要认证缺失；
- 协议不兼容；
- 软件接口不兼容且不允许改固件；
- 安全关键参数缺失；
- EP 网络不兼容；
- Output Type 冲突；
- NC/Reserved 存在危险连接。

可降级为 Design Alternative，但不能称直接替代。

---

# 35. 置信度

分开保存：

```text
source_data_confidence
candidate_identity_confidence
pin_map_confidence
package_confidence
parameter_confidence
condition_alignment_confidence
certification_confidence
application_context_confidence
overall_confidence
```

## 35.1 评分与概率分开

保存：

```text
raw_score
calibrated_confidence
```

未校准时不能把规则分数宣传为真实概率。

---

# 36. 决策策略

## 自动批准 Level 0

条件：

- 同一 Part；
- 仅包装或供应商 SKU 不同；
- 无项目策略冲突。

## 自动批准 Level 1

只允许在：

- 企业已验证替代；
- 当前作用域和 Revision 有效；
- 当前应用条件落在已验证范围；
- 认证满足；
- 数据完整。

## Level 2 以上

默认至少工程审核。

## Level 4/5

必须明确标记：

```text
not_drop_in
design_change_required
```

---

# 37. 审核触发

以下必须审核：

- Pin-to-Pin 数据不完整；
- 多封装 Variant；
- NC/Reserved 差异；
- Power Pin 差异；
- EP 差异；
- 测试条件不一致；
- 只有 Typ，没有 Guarantee；
- 关键参数缺失；
- Temperature 条件不一致；
- 固件影响；
- 认证证据缺失；
- Top1/Top2 接近；
- 厂商官方只标记 Similar；
- 仅依赖语义相似度；
- Application Context 不完整；
- 跨制造商 MCU/FPGA；
- 电源器件补偿或磁性器件变化；
- Safety Critical 项目；
- 医疗、汽车、航空或高可靠项目。

---

# 38. 替代关系数据模型

```json
{
  "relationship_id": "uuid",
  "source_part_id": "uuid",
  "candidate_part_id": "uuid",

  "direction": "candidate_replaces_source",
  "relationship_type": "conditional_pin_compatible",
  "replacement_level": 3,

  "scope": {
    "type": "project",
    "tenant_id": "uuid",
    "project_id": "uuid",
    "assembly_part_number": "PCBA-001",
    "revision_from": "RevC",
    "revision_to": null
  },

  "conditions": {
    "maximum_input_voltage": "12 V",
    "maximum_output_current": "0.65 A",
    "ambient_temperature": "-20 to 70 degC"
  },

  "validation": {
    "status": "approved",
    "report_ids": [],
    "approved_by": "uuid"
  },

  "effective": {
    "valid_from": "ISO-8601",
    "valid_to": null
  }
}
```

---

# 39. 审核工作台

## 39.1 布局

```text
左侧：源器件和应用条件
中间：候选列表和兼容等级
右侧：差异、风险和验证要求
底部：Datasheet 证据、Pin Map、封装和历史验证
```

## 39.2 视图

```text
Summary
Pin-to-Pin
Electrical Parameters
Package / 3D
Certification
Firmware
Supply Chain
Evidence
```

## 39.3 Pin-to-Pin 视图

逐 Pin 显示：

```text
Pin Number
Source Name/Role
Candidate Name/Role
Compatibility
PCB Net
Risk
```

## 39.4 参数差异

支持：

- 仅显示不同；
- 仅显示关键；
- 显示 Min/Typ/Max；
- 显示测试条件；
- 显示应用裕量；
- 显示缺失值。

## 39.5 审核操作

```text
批准为 Drop-in
批准为 Conditional
批准为 Design Alternative
拒绝
修改应用条件
添加验证结果
上传测试报告
创建 AVL
创建临时缺料替代
设置有效 Revision
```

---

# 40. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "alternative_recommendation",
  "target_id": "uuid",
  "base_version": "machine-v1",

  "operations": [
    {
      "op": "replace",
      "path": "/replacement_level",
      "old_value": 2,
      "value": 3
    },
    {
      "op": "add",
      "path": "/risks/-",
      "value": {
        "risk_code": "thermal_validation_required",
        "severity": "medium"
      }
    }
  ],

  "reason_code": "engineering_review",
  "reviewer_id": "uuid",
  "evidence_ids": []
}
```

---

# 41. 历史验证反馈

保存：

```text
prototype_passed
pilot_build_passed
mass_production_passed
field_return_issue
failed_validation
rejected_by_quality
```

## 41.1 反馈不能全局泛化

一次项目验证只在其条件范围内有效。

## 41.2 Failure 更重要

失败案例必须降低后续推荐或直接加入阻断规则。

---

# 42. Candidate Retrieval Index

## 42.1 Part Attribute Index

```text
category
sub_category
function
key parameters
package
pin_count
temperature
quality grade
certification
```

## 42.2 Pin Signature Index

```text
exact_pin_map_hash
canonical_role_hash
power_ground_hash
ep_hash
```

## 42.3 Package Index

```text
family
body
pitch
pad map
footprint
height
```

## 42.4 Relationship Graph

```text
official_replacement
enterprise_approved
same_family
same_die
historical_alternative
validated_in_project
failed_in_project
```

---

# 43. 数据库设计

## 43.1 `alternative_recommendation_jobs`

```text
id UUID PK
source_part_id UUID NOT NULL
project_id UUID NULL
bom_id UUID NULL
bom_line_id UUID NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
policy_version VARCHAR NOT NULL
parameter_registry_version VARCHAR NOT NULL
pin_registry_version VARCHAR NOT NULL
package_registry_version VARCHAR NOT NULL
certification_registry_version VARCHAR NOT NULL
search_index_version VARCHAR NOT NULL
ranker_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 43.2 `alternative_recommendation_results`

```text
id UUID PK
job_id UUID NOT NULL
source_part_id UUID NOT NULL
application_context_hash CHAR(64) NOT NULL
candidate_set_uri TEXT NOT NULL
comparison_report_uri TEXT NOT NULL
risk_report_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 43.3 `alternative_recommendation_candidates`

```text
id UUID PK
result_id UUID NOT NULL
rank INT NOT NULL
candidate_part_id UUID NOT NULL
candidate_ordering_variant_id UUID NULL
replacement_level INT NOT NULL
relationship_type VARCHAR NOT NULL
form_score NUMERIC(5,4)
fit_score NUMERIC(5,4)
function_score NUMERIC(5,4)
pin_to_pin_score NUMERIC(5,4)
certification_score NUMERIC(5,4)
overall_confidence NUMERIC(5,4)
risk_level VARCHAR NOT NULL
review_required BOOLEAN NOT NULL
reason_codes JSONB NOT NULL
UNIQUE(result_id, rank)
```

## 43.4 `component_alternative_relationships`

```text
id UUID PK
source_part_id UUID NOT NULL
candidate_part_id UUID NOT NULL
direction VARCHAR NOT NULL
relationship_type VARCHAR NOT NULL
replacement_level INT NOT NULL
scope_type VARCHAR NOT NULL
scope_id UUID NULL
conditions JSONB NOT NULL
validation_status VARCHAR NOT NULL
validation_report_ids JSONB NOT NULL
status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_by UUID NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## 43.5 `alternative_validation_records`

```text
id UUID PK
relationship_id UUID NOT NULL
project_id UUID NULL
assembly_part_number VARCHAR NULL
assembly_revision VARCHAR NULL
validation_type VARCHAR NOT NULL
status VARCHAR NOT NULL
conditions JSONB NOT NULL
report_uri TEXT NULL
issues JSONB NOT NULL
created_by UUID NULL
created_at TIMESTAMPTZ
```

## 43.6 `alternative_reviews`

```text
id UUID PK
job_id UUID NOT NULL
result_id UUID NOT NULL
candidate_part_id UUID NULL
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

# 44. 对象存储

```text
derived/alternative-recommendation/
  {source_part_id}/
    {application_context_hash}/
      {job_id}/
        input/
          source-part.json
          application-context.json
        retrieval/
          query-plan.json
          channel-results/
        candidates/
          candidate-set.json.zst
        comparison/
          form.json
          fit.json
          function.json
          pin-map.json
          electrical.json.zst
          package.json
          certification.json
          firmware.json
        risks/
          risk-report.json
          validation-plan.json
        decisions/
          recommendations.json
        evidence/
          evidence-manifest.json
        reviews/
          review-items.json
        reports/
          quality-report.json
          coverage-report.json
        debug/
          parameter-comparison-log.json
          hard-gate-log.json
          ranker-log.json
```

---

# 45. API 设计

## 45.1 创建任务

```text
POST /api/v1/alternative-recommendations/jobs
```

```json
{
  "source_part_id": "uuid",
  "source_ordering_variant_id": "uuid",

  "application": {
    "project_id": "uuid",
    "bom_id": "uuid",
    "bom_line_id": "uuid",
    "assembly_revision": "RevC",
    "actual_conditions": {},
    "required_certifications": [],
    "required_quality_grade": "industrial"
  },

  "constraints": {
    "same_footprint_required": true,
    "same_pinout_required": true,
    "firmware_change_allowed": false,
    "passive_change_allowed": false,
    "pcb_change_allowed": false,
    "maximum_risk": "medium"
  },

  "options": {
    "include_design_alternatives": true,
    "include_obsolete": false,
    "include_unverified": true,
    "max_candidates": 30,
    "auto_approve": false
  },

  "versions": {
    "policy": "alternatives-1.0.0",
    "parameter_registry": "parameters-1.0.0",
    "pin_registry": "pins-1.0.0",
    "package_registry": "packages-1.0.0",
    "certification_registry": "certifications-1.0.0",
    "search_index": "parts-index-2026-07",
    "ranker": "rule-ranker-1.0.0"
  },

  "idempotency_key": "uuid"
}
```

## 45.2 写接口

```text
POST /api/v1/alternative-recommendations/jobs
POST /api/v1/alternative-recommendations/batches
POST /api/v1/alternative-recommendations/jobs/{job_id}/retry
POST /api/v1/alternative-recommendations/jobs/{job_id}/cancel
POST /api/v1/alternative-recommendations/jobs/{job_id}/rerank
POST /api/v1/alternative-recommendations/results/{result_id}/refresh-candidates
POST /api/v1/alternative-recommendations/reviews/{review_id}/resolve
POST /api/v1/alternative-recommendations/relationships
POST /api/v1/alternative-recommendations/relationships/{id}/approve
POST /api/v1/alternative-recommendations/relationships/{id}/validate
```

## 45.3 读接口

```text
GET /api/v1/alternative-recommendations/jobs/{job_id}
GET /api/v1/alternative-recommendations/jobs/{job_id}/events
GET /api/v1/alternative-recommendations/results/{result_id}
GET /api/v1/alternative-recommendations/results/{result_id}/candidates
GET /api/v1/alternative-recommendations/results/{result_id}/comparison
GET /api/v1/alternative-recommendations/results/{result_id}/risks
GET /api/v1/alternative-recommendations/results/{result_id}/validation-plan
GET /api/v1/alternative-recommendations/relationships
GET /api/v1/alternative-recommendations/reviews
GET /health/live
GET /health/ready
GET /metrics
```

---

# 46. 状态机

```text
RECEIVED
  ↓
LOADING_SOURCE_PART
  ↓
LOADING_APPLICATION_CONTEXT
  ↓
LOADING_APPROVED_RELATIONSHIPS
  ↓
BUILDING_RETRIEVAL_PLAN
  ↓
RETRIEVING_CANDIDATES
  ↓
NORMALIZING_CANDIDATES
  ↓
APPLYING_IDENTITY_FILTERS
  ↓
COMPARING_FORM
  ↓
COMPARING_FIT
  ↓
COMPARING_PIN_MAP
  ↓
COMPARING_FUNCTION
  ↓
COMPARING_ELECTRICAL_PARAMETERS
  ↓
COMPARING_THERMAL
  ↓
COMPARING_FIRMWARE
  ↓
COMPARING_CERTIFICATIONS
  ↓
APPLYING_HARD_GATES
  ↓
CLASSIFYING_REPLACEMENT_LEVEL
  ↓
GENERATING_RISKS
  ↓
GENERATING_VALIDATION_PLAN
  ↓
RANKING_TECHNICAL_CANDIDATES
  ↓
RANKING_PROCUREMENT_PREFERENCE
  ↓
CALIBRATING_CONFIDENCE
  ↓
CREATING_REVIEWS
  ↓
STORING_RESULTS
  ↓
COMPLETED
```

分支：

```text
REVIEW_REQUIRED
SOURCE_DATA_INCOMPLETE
APPLICATION_CONTEXT_INCOMPLETE
NO_COMPATIBLE_CANDIDATE
INDEX_UNAVAILABLE
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 47. 错误码

```text
SOURCE_PART_NOT_FOUND
SOURCE_PART_UNRESOLVED
SOURCE_PACKAGE_UNKNOWN
SOURCE_PIN_DATA_INCOMPLETE
SOURCE_PARAMETER_DATA_INCOMPLETE
APPLICATION_CONTEXT_REQUIRED
APPLICATION_CONDITION_INVALID
CANDIDATE_RETRIEVAL_EMPTY
CANDIDATE_DATA_INCOMPLETE
PIN_MAP_CONFLICT
POWER_PIN_CONFLICT
NC_RESERVED_CONFLICT
PACKAGE_CONFLICT
FOOTPRINT_CONFLICT
EP_CONFLICT
PARAMETER_HARD_CONFLICT
TEMPERATURE_RANGE_CONFLICT
TEST_CONDITION_NOT_COMPARABLE
FIRMWARE_INCOMPATIBLE
PROTOCOL_INCOMPATIBLE
CERTIFICATION_MISSING
QUALITY_GRADE_INSUFFICIENT
LIFECYCLE_POLICY_BLOCKED
MULTIPLE_CANDIDATE_TIE
NO_DROP_IN_REPLACEMENT
NO_COMPATIBLE_CANDIDATE
CONFIDENCE_BELOW_THRESHOLD
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 48. 参数比较结果

每个参数输出：

```text
compatible
candidate_better
candidate_worse_but_acceptable
conditional
not_comparable
missing_source
missing_candidate
hard_conflict
not_applicable
```

并保存：

```text
source value
candidate value
normalized units
bound type
test conditions
temperature
comparison rule
margin
evidence
```

---

# 49. 配置与策略

```text
policies/
├── alternatives-1.0.0.yaml
├── replacement-levels.yaml
├── hard-gates.yaml
├── decision-thresholds.yaml
├── review.yaml
├── safety-margins.yaml
├── certification.yaml
├── lifecycle.yaml
├── category-profiles/
│   ├── opamp.yaml
│   ├── comparator.yaml
│   ├── ldo.yaml
│   ├── buck.yaml
│   ├── boost.yaml
│   ├── mosfet.yaml
│   ├── diode.yaml
│   ├── resistor.yaml
│   ├── capacitor.yaml
│   ├── inductor.yaml
│   ├── logic.yaml
│   ├── memory.yaml
│   ├── mcu.yaml
│   ├── fpga.yaml
│   ├── sensor.yaml
│   └── connector.yaml
└── enterprise/
    └── tenant-specific/
```

所有规则必须版本化。

---

# 50. Parameter Comparison DSL

使用 YAML/JSON DSL，禁止任意 Python。

```yaml
parameter_id: input_voltage_max
source_field: recommended.input_voltage.max
candidate_field: recommended.input_voltage.max
semantics: candidate_greater_or_equal
hard_constraint: true

conditions:
  align:
    - temperature
    - operating_mode

margin:
  mode: application_specific
  default_percent: 20

missing:
  candidate: review
  source: use_application_context
```

复杂参数可引用预注册的安全函数：

```text
curve_contains
range_contains
lookup_table_compare
formula_compare
```

不能在配置中执行任意代码。

---

# 51. 可观测性

## 51.1 Prometheus

```text
alternative_jobs_total{status}
alternative_duration_seconds{step}
alternative_candidates_retrieved_total{channel}
alternative_candidates_filtered_total{reason}
alternative_recommendations_total{level,risk}
alternative_pin_map_conflicts_total{type}
alternative_parameter_conflicts_total{parameter}
alternative_certification_conflicts_total{type}
alternative_firmware_conflicts_total{type}
alternative_review_total{reason}
alternative_approved_relationships_total{scope,level}
alternative_validation_records_total{type,status}
alternative_false_positive_total{level}
alternative_cache_hits_total{stage}
```

## 51.2 Dashboard

- 每日替代请求；
- Level 0–6 分布；
- Drop-in 命中率；
- 无替代比例；
- Top Hard Conflict；
- Pin Map 冲突；
- 参数缺失；
- 认证缺失；
- 人工审核率；
- 工程拒绝率；
- 量产验证率；
- 失败替代案例；
- 各器件类别准确率；
- 各企业 AVL 复用率；
- 成本/库存改善与技术风险分布。

---

# 52. Benchmark

## 52.1 Candidate Retrieval

- Top-5 Recall；
- Top-20 Recall；
- Approved Alternative Recall；
- Official Replacement Recall；
- Pin-compatible Recall；
- Design Alternative Recall。

## 52.2 Compatibility Classification

- Replacement Level Accuracy；
- Drop-in Precision；
- Drop-in Recall；
- Conditional Alternative F1；
- Incompatible Precision；
- No Alternative Precision。

## 52.3 Pin / Package

- Exact Pin Map Accuracy；
- Power Pin Conflict Recall；
- NC/Reserved Conflict Recall；
- Package Compatibility Accuracy；
- Footprint Compatibility Accuracy；
- EP Compatibility Accuracy。

## 52.4 Parameters

- Hard Constraint Recall；
- Parameter Direction Accuracy；
- Min/Typ/Max Selection Accuracy；
- Condition Alignment Accuracy；
- Temperature Comparison Accuracy；
- Missing-data Risk Recall。

## 52.5 Risk

- Critical Risk Recall；
- Risk Severity Accuracy；
- Validation Plan Coverage；
- Engineer Acceptance Rate；
- False-safe Recommendation Rate。

## 52.6 业务

- Human Approval Rate；
- Human Downgrade Rate；
- Human Rejection Rate；
- Mass-production Success Rate；
- Field Issue Rate；
- Cost Saving；
- Lead Time Improvement。

---

# 53. 初始质量目标

```text
Approved Alternative Top20 Recall >= 99%
Verified Drop-in Precision >= 99.5%
Pin Map Conflict Recall >= 99.9%
Power/Ground Conflict Recall = 100%
Critical Hard Constraint Recall >= 99.5%
Package Compatibility Accuracy >= 99%
Replacement Level Accuracy >= 97%
High-confidence Auto Approval Accuracy >= 99.5%
False-safe Drop-in Rate <= 0.05%
Critical Risk Recall >= 99%
Evidence Completeness >= 99%
```

MCU、FPGA、复杂电源和安全关键器件必须单独报告，不能和简单被动器件混合。

这些是目标，不是未经测试的保证。

---

# 54. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## 54.1 身份和采购等价

1. 同 Part 不同 Reel；
2. Cut Tape / Reel；
3. Tube；
4. 同 Die 不同品牌；
5. 厂商官方 Direct Replacement；
6. 厂商 Similar Product；
7. Obsolete + Replacement；
8. Supplier SKU；
9. Enterprise AVL；
10. Expired Alternative。

## 54.2 Pin-to-Pin

11. 完全相同；
12. Power Pin 冲突；
13. Ground Pin 冲突；
14. NC 变功能脚；
15. Reserved 差异；
16. Open-drain vs Push-pull；
17. Active-high vs Active-low；
18. EP 编号差异；
19. EP 网络差异；
20. Same Pin Count Different Map；
21. BGA Missing Ball；
22. Alternate Function；
23. Boot Strap；
24. Reset；
25. Differential Pair。

## 54.3 Package

26. Same SOIC；
27. Narrow/Wide SOIC；
28. QFN Same Name Different Body；
29. QFN EP Different；
30. Pitch Different；
31. Height Different；
32. Wettable Flank；
33. Hand-solder Variant；
34. Thermal Via；
35. Pin 1 Rotation；
36. Connector Key；
37. THT Lead Span；
38. BGA Ball Size；
39. Bottom-side Constraint；
40. 3D Collision。

## 54.4 电气参数

41. Supply Range Contains；
42. Supply Range Insufficient；
43. Current Higher；
44. Current Lower；
45. Offset Worse；
46. Noise Worse；
47. Temperature Wider；
48. Temperature Narrower；
49. Typ-only Candidate；
50. Different Test Condition；
51. Absolute Max Confusion；
52. Recommended Range；
53. Curve Comparison；
54. Boolean Feature；
55. Mode Difference；
56. Timing Difference；
57. Threshold Difference；
58. Power Difference；
59. Thermal Difference；
60. Missing Parameter。

## 54.5 类别

61. Dual Op Amp；
62. LDO Capacitor Stability；
63. Buck Compensation；
64. MOSFET Vgs/Rds；
65. Capacitor DC Bias；
66. Inductor Isat；
67. Logic Threshold；
68. Memory Timing；
69. MCU Pin-compatible Firmware-incompatible；
70. FPGA Same Package Different Bank；
71. Sensor Address Conflict；
72. Connector Keying；
73. Comparator Output Type；
74. Diode Recovery；
75. ADC Reference Difference。

## 54.6 认证和业务

76. RoHS；
77. REACH；
78. AEC-Q；
79. Industrial vs Commercial；
80. Certification Missing；
81. Medical Requirement；
82. Temporary Shortage；
83. Project Scope；
84. Revision Scope；
85. Historical Validation；
86. Failed Validation；
87. Pilot Build；
88. Mass Production；
89. Lifecycle Block；
90. No Compatible Candidate。

---

# 55. 性能要求

## 55.1 单器件

```text
Approved Relationship / Exact Index P95 < 100 ms
Pin/Package Candidate Retrieval P95 < 500 ms
Full FFF Comparison Top20 P95 < 5 s
```

不含外部实时 API。

## 55.2 批量 BOM

```text
10,000 lines
```

通过源 Part 去重：

- 相同源型号只计算一次；
- Application Context 相同则复用；
- 不同应用条件单独计算。

## 55.3 并行

- Candidate Retrieval；
- 参数比较；
- 证据加载；
- 外部验证；

可并行，但必须限制资源。

---

# 56. 缓存和增量

缓存键：

```text
source_part_version
+ source_ordering_variant
+ application_context_hash
+ constraints_hash
+ parameter_registry_version
+ pin_registry_version
+ package_registry_version
+ certification_registry_version
+ relationship_graph_version
+ search_index_version
+ ranker_version
+ policy_version
```

## 56.1 参数更新

只重跑受影响参数和候选。

## 56.2 Pin Map 更新

重跑 Fit、Pin-to-Pin 和 Hard Gate。

## 56.3 认证更新

只重跑认证和最终决策。

## 56.4 价格库存更新

只重排 Procurement Preference，不改变技术兼容等级。

## 56.5 Ranker 更新

可使用已保存 Comparison Report 重新排序。

---

# 57. 安全和权限

- 项目应用条件按租户隔离；
- 企业替代关系按作用域授权；
- 测试报告使用签名 URL；
- 外部 API Key 仅服务端；
- 不将私有原理图、BOM 和验证数据发送给外部通用模型；
- LLM 输入最小化；
- 审核和批准日志不可删除；
- Safety Critical 审批支持双人复核；
- 批量批准受权限控制；
- 临时替代必须自动过期或复审；
- 供应商价格不影响技术分。

---

# 58. 推荐技术栈

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
pgvector
LightGBM / XGBoost
Neo4j / PostgreSQL graph tables
```

V1 推荐：

```text
PostgreSQL Approved Relationship
+ OpenSearch Candidate Retrieval
+ Rule-based FFF Comparator
+ Explainable Ranker
```

---

# 59. 推荐仓库结构

```text
alternative-recommendation-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── alternative-recommendation-agent-spec.md
│   ├── replacement-levels.md
│   ├── form-fit-function-model.md
│   ├── pin-to-pin-comparison.md
│   ├── parameter-comparison-semantics.md
│   ├── application-context.md
│   ├── certification-and-quality.md
│   ├── risk-and-validation.md
│   ├── evidence-and-review.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-directional-alternative-relationship.md
│       ├── 0002-hard-gate-before-ranking.md
│       ├── 0003-application-vs-full-spec.md
│       ├── 0004-no-safe-claim-with-missing-data.md
│       └── 0005-technical-and-commercial-scores-separated.md
├── src/
│   └── alternative_recommendation/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── candidate.py
│       │   ├── comparison.py
│       │   ├── recommendation.py
│       │   ├── risk.py
│       │   ├── validation.py
│       │   └── relationship.py
│       ├── events/
│       ├── jobs/
│       ├── context/
│       │   ├── application.py
│       │   ├── constraints.py
│       │   └── safety_margin.py
│       ├── retrieval/
│       │   ├── planner.py
│       │   ├── approved.py
│       │   ├── official.py
│       │   ├── family.py
│       │   ├── pin_signature.py
│       │   ├── package.py
│       │   ├── parameters.py
│       │   ├── history.py
│       │   └── merger.py
│       ├── form/
│       │   ├── package.py
│       │   ├── footprint.py
│       │   ├── geometry.py
│       │   └── model3d.py
│       ├── fit/
│       │   ├── pin_map.py
│       │   ├── canonical_roles.py
│       │   ├── power_domains.py
│       │   ├── nc_reserved.py
│       │   └── ep.py
│       ├── function/
│       │   ├── category.py
│       │   ├── modes.py
│       │   ├── firmware.py
│       │   └── protocol.py
│       ├── parameters/
│       │   ├── registry.py
│       │   ├── semantics.py
│       │   ├── conditions.py
│       │   ├── bounds.py
│       │   ├── ranges.py
│       │   ├── curves.py
│       │   └── comparator.py
│       ├── categories/
│       │   ├── opamp.py
│       │   ├── comparator.py
│       │   ├── ldo.py
│       │   ├── converter.py
│       │   ├── mosfet.py
│       │   ├── passive.py
│       │   ├── logic.py
│       │   ├── memory.py
│       │   ├── mcu.py
│       │   ├── fpga.py
│       │   ├── sensor.py
│       │   └── connector.py
│       ├── certification/
│       │   ├── registry.py
│       │   ├── comparator.py
│       │   └── evidence.py
│       ├── gates/
│       │   ├── hard.py
│       │   ├── category.py
│       │   └── policies.py
│       ├── ranking/
│       │   ├── technical.py
│       │   ├── procurement.py
│       │   ├── scorer.py
│       │   ├── margin.py
│       │   ├── calibration.py
│       │   └── decision.py
│       ├── risks/
│       │   ├── generator.py
│       │   ├── severity.py
│       │   └── validation_plan.py
│       ├── relationships/
│       │   ├── lookup.py
│       │   ├── scope.py
│       │   ├── validity.py
│       │   └── feedback.py
│       ├── evidence/
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── parameter-registry/
├── category-profiles/
├── certification-registry/
├── schemas/
│   ├── recommendation-request.schema.json
│   ├── alternative-candidate.schema.json
│   ├── compatibility-comparison.schema.json
│   ├── risk-report.schema.json
│   ├── validation-plan.schema.json
│   ├── recommendation-result.schema.json
│   └── alternative-relationship.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── retrieval/
│   ├── form/
│   ├── fit/
│   ├── function/
│   ├── parameters/
│   ├── categories/
│   ├── certification/
│   ├── ranking/
│   ├── review/
│   ├── security/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── build_pin_signature_index.py
    ├── build_alternative_search_index.py
    ├── validate_parameter_registry.py
    ├── validate_category_profiles.py
    ├── run_alternative_benchmark.py
    ├── compare_policy_versions.py
    ├── calibrate_confidence.py
    └── export_validation_training_data.py
```

---

# 60. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察和主数据盘点

Codex 必须：

1. 阅读 Agent 31 和 Agent 32；
2. 查找 Part、Parameter、Pin、Package 和 Ordering Variant；
3. 查找现有替代料、AVL 和历史映射；
4. 查找生命周期和认证数据；
5. 查找价格库存和供应商数据；
6. 查找原理图、Footprint、Pin Map 和 3D；
7. 查找现有参数比较规则；
8. 抽样分析脱敏替代案例；
9. 输出数据缺口；
10. 不修改业务代码；
11. 不创建 Migration；
12. 不安装依赖。

## Phase 1：Domain Model 与 JSON Schema

实现：

- Request；
- Application Context；
- Candidate；
- Comparison；
- Difference；
- Risk；
- Validation Plan；
- Recommendation；
- Relationship；
- Event；
- JSON Schema。

## Phase 2：Replacement Levels 和 Policy

实现：

- Level 0–6；
- Direction；
- Scope；
- Full-spec/Application-specific；
- Auto Approval；
- Review；
- No-force。

## Phase 3：Approved Relationship 和 Official Replacement

实现：

- 企业已批准关系；
- 厂商官方关系；
- Scope；
- Validity；
- Revision；
- Historical Feedback；
- Conflict。

## Phase 4：Pin Signature 和 Package Index

实现：

- Canonical Pin Role；
- Pin Map Hash；
- Power/Ground；
- NC/Reserved；
- EP；
- Package Geometry；
- Footprint；
- Candidate Retrieval。

## Phase 5：Form Comparator

实现：

- Package；
- Body；
- Height；
- Pitch；
- Pad；
- Footprint；
- 3D；
- Thermal Pad；
- Pin 1；
- Manufacturing Features。

## Phase 6：Fit 和 Pin-to-Pin Comparator

实现：

- Pin Number；
- Pin Role；
- Direction；
- Active Level；
- Power Domain；
- NC/Reserved；
- Boot/Reset；
- Alternate Function；
- PCB Net Context；
- Hard Conflicts。

## Phase 7：Parameter Registry 和 Comparison Semantics

实现：

- Parameter Semantics；
- Bounds；
- Units；
- Range；
- Condition；
- Temperature；
- Safety Margin；
- Missing-data Policy；
- DSL。

## Phase 8：基础 Function Comparator

实现：

- Category；
- Core Function；
- Mode；
- Protocol；
- Default Behavior；
- Boolean/Enum；
- Application Context。

## Phase 9：类别专用 Profile

首批实现：

- Op Amp；
- Comparator；
- LDO；
- Buck/Boost；
- MOSFET；
- Resistor；
- Capacitor；
- Inductor；
- Logic；
- Memory。

## Phase 10：MCU、FPGA、Sensor 和 Connector

实现：

- Firmware；
- Register Map；
- Toolchain；
- Peripheral；
- FPGA Bank；
- Sensor Address；
- Mechanical Keying；
- 默认强制审核。

## Phase 11：Certification、Quality 和 Lifecycle

实现：

- Certification Registry；
- Quality Grade；
- Validity；
- Evidence；
- Lifecycle Policy；
- Project Requirement；
- Hard Gate。

## Phase 12：Risk 和 Validation Plan

实现：

- Difference；
- Risk Taxonomy；
- Severity；
- Validation Templates；
- Category-specific Plan；
- Unknown Risk。

## Phase 13：Technical Rank 和 Procurement Rank

实现：

- Hard Gate；
- Replacement Level；
- Technical Score；
- Top1/Top2 Margin；
- Commercial/Supply Score 分离；
- Decision。

## Phase 14：Evidence 和人工审核

实现：

- Comparison UI API；
- Pin Map Diff；
- Parameter Diff；
- Risk；
- Patch；
- Relationship Proposal；
- Validation Report；
- Audit。

## Phase 15：Search Index 和批量 BOM

实现：

- Part Attribute Index；
- Pin Signature Index；
- Package Index；
- Relationship Graph；
- Batch Dedup；
- Cache；
- Incremental Rebuild。

## Phase 16：Learning、Calibration 和反馈

实现：

- Approved/Rejected Dataset；
- Failed Validation；
- Learning-to-Rank；
- Calibration；
- Shadow Mode；
- Rollback；
- Scope-aware Learning。

## Phase 17：API、事件、监控和生产发布

实现：

- API；
- Jobs；
- Batch；
- Events；
- Retry/Cancel；
- Metrics；
- Dashboard；
- Security；
- Deployment；
- Disaster Recovery。

---

# 61. Codex 工作纪律

Codex 必须：

1. 替代关系有方向；
2. 不把相似器件称为等价；
3. 不把 Manufacturer Recommended Product 当 Drop-in；
4. 不把 Base Part 当完整 Variant；
5. Form/Fit/Function 分开；
6. 技术分和商业分分开；
7. Candidate Retrieval 在前，Hard Gate 在 Rank 前；
8. Pin-to-Pin 不能只比较 Pin Count；
9. Package 不能只比较名称；
10. NC、DNC、Reserved 分开；
11. EP 必须比较编号、尺寸和网络；
12. Recommended 和 Absolute Maximum 分开；
13. 不只比较 Typ；
14. 条件不一致时标记不可直接比较；
15. 缺失数据是风险，不是兼容；
16. 参数方向由 Registry 定义；
17. Safety Margin 按类别配置；
18. Application-specific 不能冒充 Full-spec；
19. Firmware 影响必须独立；
20. Certification 必须有证据和有效期；
21. Lifecycle 和库存不能提高技术兼容分；
22. 无合格候选时输出 No Compatible Candidate；
23. MCU/FPGA 跨型号默认人工审核；
24. 人工 Patch 不覆盖机器结果；
25. 企业替代关系必须有 Scope 和有效 Revision；
26. 失败验证必须回写；
27. LLM 不得从全库自由挑选；
28. LLM 只能做结构化辅助和 Top-K 解释；
29. 不将私有设计数据发给外部模型；
30. 不使用真实客户数据公开测试；
31. 不伪造准确率和验证；
32. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Registry/Profile/Policy 变化；
    - 测试命令；
    - 真实结果；
    - Benchmark；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 62. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/alternative-recommendation-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第33个 Agent：

Component Alternative Recommendation Agent / 替代料推荐 Agent。

本 Agent 接收 Agent 32 已经精准解析的标准 Part，根据：

- Form-Fit-Function；
- Pin-to-Pin；
- Package、Footprint 和 3D；
- Pin Number、Pin Role、Power、Ground、NC、Reserved 和 EP；
- 电气参数、Min/Typ/Max、测试条件和温度；
- 应用实际条件和安全裕量；
- 固件、协议、寄存器和工具链；
- 认证、质量等级和环境要求；
- 企业 AVL、历史替代和量产验证；
- 生命周期、供应链和价格；

推荐替代料，并明确差异、风险、验证要求和替代等级。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31 和 Agent 32 的规格和实际代码；
3. docs/alternative-recommendation-agent-spec.md；
4. 当前 Part、Manufacturer、Ordering Variant、Package、Parameter、Pin 和 Datasheet 数据模型；
5. 当前 Symbol、Footprint、3D 和 Pin Map；
6. 当前替代料、AVL、历史采购和工程变更；
7. 当前认证、质量、生命周期和供应商数据；
8. 当前搜索索引和 Graph；
9. 当前 Evidence、Review、Patch、权限和审计；
10. 脱敏或合成替代案例。

硬约束：

- 替代关系必须有方向；
- 不把 Similar Product、Recommended Product 或 Replacement 自动当 Drop-in；
- Form、Fit、Function 必须分开；
- Pin-to-Pin 不能只比较 Pin Count；
- Package 不能只比较名称；
- Power/Ground、NC/DNC/Reserved、EP 必须精确比较；
- Recommended Operating、Electrical Characteristics、Absolute Maximum 分开；
- 不只比较 Typ；
- Min/Max 和测试条件必须保存；
- 条件不一致时标记 not_directly_comparable；
- 缺失关键数据是风险；
- 参数比较方向由 Parameter Registry 定义；
- Application-specific Replacement 不得冒充 Full-spec Replacement；
- 技术兼容分与价格库存分分开；
- Hard Gate 在 Ranking 前；
- 库存和价格不能覆盖技术冲突；
- Firmware、Register Map、Protocol 和 Toolchain 独立比较；
- Certification 必须有证据、范围和有效期；
- 无合格候选时输出 no_compatible_candidate；
- MCU/FPGA 跨型号默认人工审核；
- 企业替代关系必须有 Scope、Revision、有效期和验证状态；
- 人工 Patch 不覆盖机器结果；
- LLM 不得从全库自由挑选；
- LLM 只可用于受控结构化辅助或 Top-K 解释；
- 不将私有 BOM、原理图和测试数据发送给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造测试和准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 32 的 Part Resolution 输出；
3. 查找 Part、Parameter、Pin、Package、Ordering Variant 和 Datasheet；
4. 查找 Symbol、Footprint、3D 和 Pin Map；
5. 查找已有替代料、AVL 和厂商 Replacement；
6. 查找项目、Revision、ECR/ECN 和历史验证；
7. 查找认证、质量等级、生命周期和供应商数据；
8. 查找参数比较和单位归一规则；
9. 统计关键类别的数据完整度；
10. 抽样分析脱敏/合成替代案例；
11. 在 docs/alternative-recommendation-implementation-plan.md 中生成实施计划；
12. 在 docs/replacement-levels-and-policy.md 中定义 Level 0–6；
13. 在 docs/form-fit-function-model.md 中定义 FFF；
14. 在 docs/pin-to-pin-comparison-design.md 中定义 Pin 比较；
15. 在 docs/parameter-comparison-semantics.md 中定义参数语义和 Safety Margin；
16. 在 docs/category-comparison-profiles.md 中定义类别 Profile；
17. 在 docs/certification-quality-design.md 中定义认证与质量；
18. 在 docs/alternative-risk-validation-design.md 中定义风险和验证计划；
19. 在 docs/alternative-recommendation-migration-plan.md 中定义旧替代关系迁移；
20. 在 docs/alternative-recommendation-benchmark-plan.md 中定义 Benchmark；
21. 给出拟新增、拟修改和拟复用文件；
22. 给出 Phase 1 精确范围；
23. 不修改业务代码；
24. 不创建数据库 Migration；
25. 不安装依赖；
26. 运行当前仓库已有 lint、type check、test 和 build；
27. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 32 输入契约；
- 当前替代料和 AVL 数据；
- Part/Parameter/Pin/Package 数据完整度；
- Replacement Level；
- Form-Fit-Function；
- Pin-to-Pin；
- Parameter Semantics；
- Application Context；
- Category Profiles；
- Certification/Quality；
- Risk/Validation；
- Candidate Retrieval；
- Hard Gate 和 Ranking；
- Evidence/Review；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 63. 后续 Phase 提示词模板

```text
继续实现 Alternative Recommendation Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31、32、33 规格；
3. 阅读 Implementation Plan；
4. 阅读 Replacement Level、FFF、Pin、Parameter、Category、Certification 和 Risk 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Directional Relationship；
- Form/Fit/Function 分离；
- Hard Gate before Ranking；
- 技术/商业分离；
- 不只看 Typ；
- 条件对齐；
- Missing = Risk；
- Pin/Package 精确；
- Application/Full-spec 分离；
- Firmware/Certification 独立；
- No Force Match；
- Evidence/Version 完整；
- 不覆盖人工 Patch；
- LLM 不自由挑选；
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
- Registry/Profile/Policy 变化；
- 测试命令和真实结果；
- Candidate Recall；
- Drop-in Precision；
- Hard Conflict Recall；
- Risk/Validation Coverage；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 64. MVP 演示流程

1. 输入同一器件不同 Reel Ordering Code；
2. 输出 Level 0；
3. 输入厂商官方 Direct Replacement；
4. 验证 Pin/Package/参数；
5. 输出 Level 1；
6. 输入相同 SOIC-8 但 Pin Map 不同器件；
7. Hard Gate 阻断；
8. 输入相同 Pinout 的运放；
9. 比较供电、输入范围、输出摆幅、GBW、Offset、Noise；
10. 输出差异；
11. 输入 LDO；
12. 发现 Output Capacitor ESR 要求不同；
13. 输出 Conditional；
14. 输入 Buck；
15. 发现 Switching Frequency 和补偿方式不同；
16. 生成外围器件重新验证计划；
17. 输入 MOSFET；
18. 按实际 Vgs 比较 Rds(on) 和 Qg；
19. 输入电容；
20. 发现 DC Bias 后有效容值不足；
21. 阻断；
22. 输入 MCU；
23. Pinout 相同但寄存器和固件不同；
24. 标记 Firmware Change Required；
25. 输入 Automotive 项目；
26. 候选无 AEC-Q；
27. Certification Hard Gate 阻断；
28. 输入实际应用条件低于源器件满规格；
29. 输出 Application-compatible、Not Full-spec Equivalent；
30. 人工审核；
31. 上传 Bench Test；
32. 创建项目级替代关系；
33. Pilot Build 通过；
34. 更新验证状态；
35. 发布 `component.alternatives.ready`。

---

# 65. 下游事件

```json
{
  "event_type": "component.alternatives.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "source_part_id": "uuid",
  "application_context_hash": "hex",
  "recommendation_result_uri": "s3://.../recommendations.json",
  "risk_report_uri": "s3://.../risk-report.json",
  "validation_plan_uri": "s3://.../validation-plan.json",

  "summary": {
    "candidates": 20,
    "level_0": 2,
    "level_1": 1,
    "level_2": 3,
    "conditional": 4,
    "design_alternatives": 5,
    "incompatible": 5
  },

  "quality": {
    "overall_confidence": 0.96,
    "review_status": "review_required"
  },

  "created_at": "ISO-8601"
}
```

下游消费规则：

```text
Level 0:
  可作为采购等价候选

Level 1:
  仅在批准关系和有效 Scope 下自动使用

Level 2/3:
  必须工程审核

Level 4/5:
  只能进入设计变更流程

Level 6:
  不推荐
```

---

# 66. 生产上线顺序

第一阶段优先：

```text
企业已批准替代
同器件不同包装
Pin Signature
Package/Footprint
Power/Ground/NC/EP
基础参数方向性
运放、LDO、MOSFET、被动器件
人工审核
```

第二阶段增加：

```text
Buck/Boost
Logic
Memory
Sensor
认证与质量
验证计划
项目 Scope
```

第三阶段增加：

```text
MCU/FPGA
Firmware/寄存器
曲线比较
Learning-to-Rank
置信度校准
历史量产反馈
供应链和商业排序
```

先把“直接替代不能出错”做好，再扩大设计替代覆盖范围。替代推荐最怕的不是少推荐几个，而是把危险候选包装成安全答案。
