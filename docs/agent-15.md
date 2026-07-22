# 接口、电源与兼容性检查 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：15  
> Agent 名称：Interface, Power, Signal-Level, Timing, Resource & Physical Interconnect Compatibility Agent  
> 中文名称：接口、电源与兼容性检查 Agent  
> 类型：混合型  
> 版本：V1.0  
>
> 定位：接收 Agent 10 的 Requirement Baseline、Agent 11 的项目 Gate 和任务、Agent 12 的功能架构与 Interface Contract、Agent 13 的参考设计和模块组合、Agent 14 的器件选型 Baseline，以及后续 Agent 16/18/20/21 解析出的真实原理图、Netlist、Pin、Footprint 和 Firmware Resource；建立从逻辑接口、协议角色、电气电平、供电域、时钟复位、驱动负载、上拉下拉、Pin Mux、连接器、线缆和机械方向到验证证据的统一 Compatibility IR；通过确定性规则、条件推理、拓扑图分析、负载预算、带宽预算、时序检查和受控 AI 辅助，生成兼容性结论、问题、修复候选、设计影响和可下发到原理图、固件、PCB、机械与测试 Agent 的兼容性 Baseline。
>
> 上游：
> - Agent 10：Requirement Baseline、Constraint、Goal、Variant、Assumption、Acceptance Criteria 和 Change Impact
> - Agent 11：Compatibility Work Package、Milestone、Gate、Owner、Risk、Schedule 和 Project Baseline
> - Agent 12：Block、Port、Interface Contract、Power Tree、Clock/Reset、Data/Control Flow、Mode、Budget 和 Architecture Baseline
> - Agent 13：Reference Design、Module Candidate、Module Composition、Adapter Candidate、Modification Scope 和 Reuse Baseline
> - Agent 14：Primary/Alternate Component、Ordering Code、Selection Contract、Package、Voltage、Interface、Firmware、EDA 和 Selection Baseline
> - Agent 16：KiCad/EDA Project Canonical IR、Schematic、PCB、Net、Net Class、Sheet、Source Map 和 Artifact Hash
> - Agent 18：Reviewed Netlist、Connectivity Graph、Ambiguity、Pin-to-Net 关系和 Interface Candidate
> - Agent 20：Symbol、Footprint、Pin-Pad、Pin Electrical Type、Package Variant、3D、Library Revision 和验证状态
> - Agent 21：MCU/MPU/FPGA Pin Mux、Peripheral、DMA、Interrupt、Clock、Driver、BSP、Protocol Stack 和 Firmware Mode
> - 企业规则：电气设计规范、接口规范、设计降额、上拉下拉、终端、ESD、连接器、线缆、测试和安全规则
> - 厂商资料：Datasheet、Reference Manual、Hardware Design Guide、Errata、IBIS、SPICE、Application Note、Connector Drawing
>
> 下游：
> - Agent 11：兼容性修复任务、验证任务、风险、依赖和 Gate 状态
> - Agent 12：Interface Contract、Power Domain、Clock/Reset、Mode 和架构变更候选
> - Agent 13：模块组合适配、Adapter、修改范围和复用比例更新
> - Agent 14：器件重新选型、备选策略和组合冲突回传
> - Agent 16：兼容性修复后的工程重新解析
> - Agent 18：修复后的 Netlist 重建和接口追踪
> - Agent 19：受控 EDA 修改、Preview、Approval、Readback 和 Rollback
> - Agent 20：Pin、Footprint、Pin-Pad 和库修复
> - Agent 21：Pin Mux、Driver、Protocol、Clock、Interrupt 和 Firmware 配置修复
> - Agent 22：原理图 ERC、保护、去耦、额定值和使用条件复审
> - Agent 23：驱动、负载、时序、模拟、电源和接口仿真
> - Agent 24：高速、差分、阻抗、长度、时钟、电源域和隔离 PCB 约束
> - Agent 25：接口器件、Level Shifter、Connector、Termination 和固定模块布局
> - Agent 26：差分、时钟、总线、关键网络和回流布线
> - Agent 27：SI、PI、EMC、串扰、回流、终端和电源完整性验证
> - Agent 28：连接器方向、线缆、FPC、插拔空间、键位和机械兼容
> - Agent 29：BOM、CPL、装配图和版本说明中的接口/连接器一致性
> - Agent 30：连接器、FPC、贴装方向和装配风险 DFM/DFA
> - Agent 31–45：BOM、替代、供应链、NPI、制造和质量
>
> 核心输出：
> - Compatibility Input Snapshot
> - Compatibility Profile and Rule Snapshot
> - Canonical Interface Endpoint IR
> - Canonical Electrical Domain IR
> - Canonical Physical Interconnect IR
> - Interface Compatibility Graph
> - Power Domain Compatibility Graph
> - Protocol and Role Compatibility Matrix
> - Voltage and Logic-level Compatibility Matrix
> - Clock, Reset and Timing Compatibility Report
> - Bandwidth and Throughput Compatibility Report
> - Driver, Fan-out and Load Budget Report
> - Pull-up, Pull-down and Default-state Report
> - Termination and Biasing Report
> - Open-drain/Open-collector Shared-bus Report
> - Pin Mux and Peripheral Resource Conflict Report
> - Boot Strap, Debug and Reserved Pin Report
> - Interrupt and DMA Resource Report
> - Connector, Cable and FPC Mapping Report
> - Mechanical Orientation and Keying Report
> - Hot-plug, Back-power and Power-off Interaction Report
> - Isolation, Ground and Reference Compatibility Report
> - Mode-dependent Compatibility Report
> - Variant Compatibility Report
> - Compatibility Findings and Evidence
> - Adapter and Repair Candidate Set
> - Design Impact Graph
> - Verification and Bench-test Plan
> - Compatibility Decision Record
> - Compatibility Baseline
> - Downstream Agent Packages
>
> 重要边界：
> - 本 Agent 检查兼容性，不替代电气、安全、功能安全、EMC 或认证签署。
> - 不把网络连通等同于接口兼容。
> - 不把协议名称相同等同于协议版本、角色、速率、时序和电气层兼容。
> - 不把“3.3V 器件”理解为所有 I/O 都能接受 3.3V。
> - 不把绝对最大额定值作为正常电平兼容范围。
> - 不把高电平典型值与输入保证阈值直接比较。
> - 不把未定义的输入阈值、输出能力和漏电流静默填成行业常见值。
> - 不把 Open-drain、Push-pull、Tri-state、Analog 和 Differential 混为通用数字口。
> - 不把 MCU 内部上拉视为适用于所有总线速率和负载。
> - 不把上拉电阻“存在”视为其阻值、功耗和上升时间正确。
> - 不把总线标称速率视为有效吞吐量。
> - 不把一个主设备和多个从设备能接在同一总线上视为地址、Chip Select、终端和负载已满足。
> - 不把引脚具有某个复用功能视为项目中可以同时使用。
> - 不把 Boot Strap、调试、晶振、USB 和高速专用脚当作普通 GPIO。
> - 不把 Connector Pin Count 相同视为 Pinout、键位、方向和机械兼容。
> - 不把 FPC 间距、Pin 数相同视为同面/反面、Top/Bottom Contact、序号方向和锁扣一致。
> - 不把电源关闭后的接口钳位、反向灌电和 Back-power 忽略。
> - 不把不同地之间直接连接视为天然安全或无噪声风险。
> - 不把 Level Shifter 的电压范围匹配视为方向、带宽、边沿、上电和隔离均合适。
> - 不自动修改原理图、Firmware 或 PCB；写入统一交给 Agent 19。
> - 不自动批准 Adapter、Pin Remap、协议降速或电源域改变。
> - AI 只用于提取、归类、解释和候选生成，不得编造电气阈值、时序、带宽和 Pin 功能。
> - 所有检查必须绑定来源器件、Ordering Code、Datasheet/Manual 版本、架构 Baseline、Selection Baseline、EDA Revision 和规则版本。
> - 私有电路、BOM、Pin 分配和协议不得发送给未批准的外部模型。

---

# 1. Agent 15 的系统位置

```text
Agent 10 Requirements
        ↓
Agent 12 Interface / Power / Clock / Mode Contracts
        ↓
Agent 13 Module Composition
        ↓
Agent 14 Component Selection
        ↓
Agent 15 Compatibility Contracts and Checks
        ↓
Architecture / Component / Adapter / Pin Decisions
        ↓
Agent 16–21 Real Design Readback
        ↓
Agent 15 Re-check against Actual Schematic/Firmware
        ↓
Agent 22–30 Detailed Review and Implementation
```

---

# 2. 为什么需要独立 Agent 15

常见问题包括：

1. 两个模块都写着 UART，但一个是 1.8V、另一个是 3.3V；
2. I²C 总线有多个上拉，等效阻值过低；
3. I²C 模块默认地址相同；
4. SPI 从设备的 MISO 在未选中时不进入高阻；
5. MCU 的两个外设功能占用同一组 Pin；
6. 一个 Pin 同时被 Boot Strap 和用户按键使用；
7. USB 数据角色和供电角色理解不一致；
8. CAN Transceiver 和 Controller 的待机、使能和故障脚未连接；
9. ADC 数据接口带宽理论满足，但 MCU DMA 和缓存不够；
10. 差分接口一端带终端，另一端也带，导致过度终端；
11. FPGA 的 I/O Bank 电压与外设电平不匹配；
12. Level Shifter 方向固定，但设计需要双向；
13. GPIO 驱动多个 LED、MOSFET Gate 和连接器，超出单 Pin 或 Bank 电流；
14. 连接器 Pinout 在机械图和原理图中的序号方向相反；
15. FPC 连接器同面/反面弄错；
16. 关闭主电源后，外部模块通过信号线反向供电；
17. 复位默认状态下，电机、继电器或电源使能被错误拉高；
18. 外部模块上电早于主控，输入钳位导致异常；
19. 选定备选器件后，Pin Mux 和驱动能力发生变化；
20. 架构框图正确，但实际原理图和 Firmware 配置已经漂移。

Agent 15 的职责是：

```text
Interface Contract
→ Endpoint Facts
→ Compatibility Rules
→ Mode and Condition Evaluation
→ Explicit Findings
→ Controlled Repair
→ Verified Baseline
```

---

# 3. 兼容性层级

必须分层：

```text
logical_compatibility
protocol_compatibility
role_compatibility
electrical_compatibility
timing_compatibility
bandwidth_compatibility
power_domain_compatibility
resource_compatibility
physical_interconnect_compatibility
mechanical_compatibility
mode_compatibility
verification_compatibility
```

---

# 4. Interface Endpoint

每个端点必须包含：

```text
owner block
owner component
owner ordering code
port name
pin or pin group
direction
driver type
receiver type
role
voltage domain
reference ground
protocol
clocking
data format
timing
load
mode
physical connector
```

---

# 5. Endpoint IR

```json
{
  "endpoint_id": "EP-MCU-I2C1-SDA",
  "owner_type": "component",
  "owner_id": "uuid",
  "port_id": "PORT-MCU-I2C1",
  "pin_refs": ["PB7"],
  "direction": "bidirectional",
  "driver_type": "open_drain",
  "receiver_type": "digital_input",
  "role": "controller",
  "voltage_domain_id": "VD-3V3",
  "reference_domain_id": "GND-DIGITAL",
  "protocol_contract_id": "PROTO-I2C-001",
  "mode_scope": ["active", "sleep"],
  "source_evidence_ids": [],
  "status": "candidate"
}
```

---

# 6. Driver Type

```text
push_pull
open_drain
open_collector
tri_state
current_source
current_sink
analog_voltage
analog_current
differential
passive
power_output
unknown
```

---

# 7. Receiver Type

```text
cmos
ttl
schmitt
analog_voltage
analog_current
differential
clock
reset
interrupt
power_input
high_impedance
unknown
```

---

# 8. Electrical Domain

包括：

```text
nominal voltage
minimum voltage
maximum voltage
power state
reference ground
isolation domain
tolerance
startup
shutdown
brownout
back-power policy
```

---

# 9. Electrical Domain IR

```json
{
  "domain_id": "VD-3V3",
  "domain_type": "digital_io",
  "nominal_voltage": {"value": "3.3", "unit": "V"},
  "operating_range": {},
  "power_states": [],
  "reference_domain_id": "GND-DIGITAL",
  "isolation_domain_id": null,
  "back_power_policy": {},
  "status": "approved"
}
```

---

# 10. Signal Type

```text
single_ended_digital
differential_digital
analog_single_ended
analog_differential
clock
reset
interrupt
power
ground
shield
sense
control
test
reserved
no_connect
```

---

# 11. Voltage Compatibility

检查：

```text
VOH minimum vs VIH minimum
VOL maximum vs VIL maximum
input absolute max
output operating range
input leakage
output leakage
clamp current
source/sink current
pull-up voltage
bank voltage
tolerance
power-off condition
```

---

# 12. Logic-level Margin

```text
high_margin = VOH_min - VIH_min
low_margin = VIL_max - VOL_max
```

保存：

```text
condition
temperature
supply
load current
process grade
evidence
```

不能用 Typical VOH/VOL 代替保证值。

---

# 13. Input Tolerance

区分：

```text
native_voltage
tolerant_input
fail_safe_input
overvoltage_tolerant_only_when_powered
not_tolerant
unknown
```

“5V tolerant”必须绑定 Pin、模式和供电条件。

---

# 14. Output Drive

保存：

```text
source current
sink current
VOH/VOL under load
edge rate
slew control
bank current limit
total device limit
simultaneous switching limit
```

---

# 15. Load Model

```text
input leakage
input capacitance
termination
pull-up/pull-down
LED current
MOS gate charge
connector/cable capacitance
fan-out
analog load
```

---

# 16. Fan-out

数字 Fan-out 不能只按输入数量：

```text
DC current
AC capacitance
edge rate
timing
bank limit
simultaneous switching
```

---

# 17. Open-drain Shared Bus

检查：

```text
all active drivers are open-drain/open-collector
no push-pull conflict
pull-up domain
equivalent resistance
bus capacitance
rise time
low-level sink current
power-off behavior
clock stretching
multi-controller
```

---

# 18. Pull-up / Pull-down

每个 Bias 元件保存：

```text
location
value
tolerance
voltage domain
internal/external
always present
mode
population option
purpose
```

---

# 19. Equivalent Pull Resistance

并联上拉：

```text
R_eq = 1 / Σ(1/R_i)
```

但系统实现应使用 Decimal 和单位库，不使用浮点近似作为正式规则。

---

# 20. Pull-up Check

检查：

```text
rise time
sink current
static power
noise immunity
leakage dominance
startup default
power-off backfeed
multiple modules
```

---

# 21. Default State

端点默认状态来源：

```text
internal pull
external pull
boot ROM
reset state
firmware initialization
level shifter state
power sequencing
external module
```

---

# 22. Safe Default

对以下信号重点检查：

```text
power enable
motor enable
relay drive
heater
laser
high-voltage enable
chip select
reset
boot mode
write protect
flash hold
amplifier shutdown
```

---

# 23. Protocol Contract

```text
protocol family
version
profile
role
topology
addressing
framing
data format
speed
duplex
error handling
timeout
retry
flow control
clocking
termination
hot plug
```

---

# 24. Role Compatibility

示例：

```text
USB host ↔ USB device
SPI controller ↔ SPI peripheral
I2C controller ↔ target
CAN controller ↔ transceiver
Ethernet MAC ↔ PHY
MIPI DSI host ↔ display peripheral
UART TX ↔ RX
```

两个 Host、两个 Controller 或两个 Power Source 不能自动连接。

---

# 25. Protocol Version

检查：

```text
major/minor version
mandatory features
optional features
negotiation
backward compatibility
profile
vendor extension
firmware support
```

---

# 26. SPI Compatibility

检查：

```text
controller/peripheral role
CPOL
CPHA
bit order
word length
chip select polarity
chip select timing
maximum clock
minimum clock
MISO tri-state
voltage
multiple peripherals
DMA
throughput
```

---

# 27. I²C / SMBus Compatibility

检查：

```text
address width
address conflict
speed mode
voltage
pull-up
capacitance
rise/fall
sink current
clock stretching
timeout
multi-controller
PEC
alert
hot-swap
```

---

# 28. UART Compatibility

检查：

```text
voltage standard
baud rate
data bits
parity
stop bits
polarity
flow control
RS-232/TTL/RS-485 level
duplex
termination
failsafe bias
ground reference
```

---

# 29. CAN Compatibility

检查：

```text
controller/transceiver
CAN/CAN FD
bit rate
sample point candidate
termination
stub length candidate
common-mode range
standby/silent
TXD/RXD levels
wake-up
ESD/surge
grounding
connector pinout
```

---

# 30. USB Compatibility

检查：

```text
host/device/dual-role
USB version
speed
connector type
CC resistors
VBUS source/sink
current advertisement
PD support
ESD
D+/D- or superspeed lanes
orientation mux
power role swap
data role swap
shield
```

---

# 31. Ethernet Compatibility

检查：

```text
MAC/PHY
MII/RMII/RGMII/SGMII
clock direction
clock frequency
voltage
delay mode
MDIO role
magnetics
termination
connector
PoE
link speed
firmware driver
```

---

# 32. Differential Interface Compatibility

检查：

```text
standard
common-mode
differential swing
termination
polarity
lane count
lane mapping
AC coupling
biasing
clock/data relationship
skew
cable/connector impedance
```

---

# 33. Analog Interface Compatibility

检查：

```text
input/output range
common-mode
source impedance
load impedance
bias
offset
bandwidth
noise
settling
clamp/protection
single-ended/differential
reference
ground
```

---

# 34. Clock Compatibility

检查：

```text
source/sink
frequency range
accuracy
jitter
phase noise
duty cycle
logic standard
amplitude
load
termination
startup
enable
spread spectrum
clock domain
```

---

# 35. Reset Compatibility

检查：

```text
active high/low
open drain/push pull
minimum pulse width
assert/deassert threshold
power domain
supervisor
synchronization
startup
external pull
shared reset
firmware behavior
```

---

# 36. Timing Contract

```text
setup
hold
clock-to-output
propagation delay
rise/fall
pulse width
turnaround
enable/disable
chip select timing
reset timing
power sequence timing
latency
jitter
```

---

# 37. Timing Result

```text
pass
fail
unknown
needs_simulation
needs_measurement
condition_mismatch
```

---

# 38. Bandwidth Compatibility

数据链路必须计算：

```text
payload rate
encoding overhead
framing overhead
protocol overhead
retry
burst
concurrency
buffer
effective utilization
headroom
```

---

# 39. Throughput Path

```text
producer
interface
bridge
buffer
processor
storage
consumer
```

最慢节点决定端到端吞吐。

---

# 40. Buffer Compatibility

检查：

```text
producer burst
consumer service rate
FIFO depth
DMA latency
interrupt latency
memory bandwidth
overflow behavior
backpressure
data loss policy
```

---

# 41. Clock Domain Crossing

识别：

```text
synchronous
mesochronous
plesiochronous
asynchronous
```

检查：

```text
synchronizer
async FIFO
handshake
gray counter
reset crossing
data coherence
```

本 Agent 只做设计存在性和契约检查，不替代 CDC 工具。

---

# 42. Pin Mux

每个 Pin 保存：

```text
physical pin
bank
alternate functions
selected function
mode
boot state
voltage domain
drive
pull
speed
reserved
variant
```

---

# 43. Pin Resource Conflict

检查：

```text
same pin selected twice
alternate function conflict
peripheral instance conflict
bank voltage conflict
debug conflict
boot strap conflict
oscillator conflict
USB dedicated pin conflict
analog/digital conflict
variant conflict
```

---

# 44. Peripheral Resource

```text
UART
SPI
I2C
CAN
USB
Ethernet
Timer
PWM
ADC
DAC
DMA
Interrupt
PIO
SERCOM
FPGA bank
memory controller
```

---

# 45. DMA and Interrupt

检查：

```text
channel/request conflict
priority
shared interrupt
latency
burst
memory destination
cache coherency
firmware ownership
```

---

# 46. Boot Strap

保存：

```text
pin
sample time
required level
internal pull
external pull
connected load
button/connector sharing
production programming effect
```

---

# 47. Debug and Programming

检查：

```text
SWD/JTAG
UART boot
USB DFU
ISP
FPGA configuration
flash programming
test pads
shared pins
access in enclosure
production fixture
security lock
```

---

# 48. Power Compatibility

检查：

```text
source voltage range
load voltage range
continuous current
peak current
inrush
startup
enable
power-good
reverse current
back-power
sequence
ground
isolation
fault
```

---

# 49. Power Source Role

```text
source
sink
dual_role
pass_through
load_switch
ideal_diode
charger
unknown
```

---

# 50. Multiple Power Sources

检查：

```text
ORing
priority
ideal diode
reverse blocking
source contention
current sharing
USB/battery interaction
external supply
hot plug
```

---

# 51. Power-off Interaction

检查：

```text
signal high while device unpowered
input clamp current
fail-safe pin
level shifter power state
pull-up to always-on rail
shared reset
bus isolation
```

---

# 52. Back-power Finding

例如：

```text
External Module 3V3
→ I2C Pull-up
→ MCU SDA Clamp
→ MCU VDD rail
```

需保存传播路径和模式。

---

# 53. Isolation Compatibility

检查：

```text
required isolation
actual isolation
working voltage
transient rating
creepage/clearance candidate
isolator direction
default state
isolated power
ground domains
shield/chassis
```

详细几何交给 Agent 24/27/28/30。

---

# 54. Ground and Reference

区分：

```text
digital ground
analog ground
power ground
chassis
earth
isolated ground
shield
sense return
```

检查不允许错误短接或缺少回流路径。

---

# 55. Physical Connector IR

```text
connector family
manufacturer
ordering code
mating part
pin count
pitch
orientation
gender
keying
latch
shield
current rating
voltage rating
contact resistance
mating cycles
position
```

---

# 56. Pin Mapping

每个连接器 Pin：

```text
pin number
signal name
signal type
direction
voltage domain
ground/reference
reserved
no connect
mechanical key side
source evidence
```

---

# 57. Cable and Harness

```text
wire count
wire gauge
twist
shield
impedance
length
current
voltage
connector A/B
pin mapping
cross-over
polarity
ground
temperature
flex
```

---

# 58. FPC/FFC

检查：

```text
pin count
pitch
contact side
top/bottom contact
same-side/opposite-side
pin 1 orientation
cable length
bend
locking
current
impedance
shield
stiffener
```

---

# 59. Mechanical Orientation

检查：

```text
connector direction
mating direction
keying
board side
rotation
mirror
cable exit
access
service
```

几何碰撞交给 Agent 28，但 Agent 15检查语义和 Mapping 一致性。

---

# 60. Mode-dependent Compatibility

同一接口在不同模式下可能不同：

```text
boot
active
sleep
shutdown
charging
firmware update
factory test
fault
service
```

---

# 61. Variant Compatibility

检查：

```text
variant component
variant pinout
variant connector
variant firmware
variant voltage
variant population
variant BOM
variant mechanical
```

---

# 62. Compatibility Finding

```json
{
  "finding_id": "COMPAT-FIND-001",
  "finding_type": "logic_level_margin_negative",
  "severity": "high",
  "source_endpoint_id": "EP-A",
  "destination_endpoint_id": "EP-B",
  "mode_scope": ["active"],
  "actual": {},
  "required": {},
  "evidence_ids": [],
  "repair_candidates": [],
  "status": "open"
}
```

---

# 63. Finding 类型

```text
endpoint_missing
direction_conflict
role_conflict
protocol_conflict
protocol_version_conflict
voltage_range_conflict
logic_high_margin_negative
logic_low_margin_negative
input_tolerance_conflict
drive_current_insufficient
fanout_exceeded
bank_current_exceeded
pullup_missing
pullup_too_strong
pullup_too_weak
multiple_pullups_conflict
default_state_unsafe
termination_missing
termination_duplicate
address_conflict
chip_select_conflict
pin_mux_conflict
boot_strap_conflict
debug_conflict
clock_conflict
reset_conflict
timing_violation
bandwidth_insufficient
buffer_insufficient
dma_conflict
interrupt_conflict
back_power_risk
power_sequence_conflict
ground_reference_conflict
isolation_gap
connector_pinout_mismatch
fpc_orientation_mismatch
cable_mapping_conflict
variant_conflict
evidence_missing
```

---

# 64. Severity

```text
critical
high
medium
low
info
```

Critical 示例：

```text
可能损坏器件
安全输出默认激活
电源源冲突
关键协议角色错误
负电平裕量
隔离域被短接
```

---

# 65. Confidence

维度：

```text
source quality
parameter completeness
condition match
pin mapping confidence
mode coverage
rule maturity
simulation coverage
measurement coverage
```

---

# 66. Repair Candidate

```text
change pin assignment
change component
add level shifter
add buffer
add bus switch
add isolation
change pull-up
change termination
change connector mapping
change protocol speed
change clock source
add reset supervisor
add power isolation
add series resistor
add adapter board
change firmware configuration
```

---

# 67. Repair 边界

修复候选必须包括：

```text
affected objects
technical rationale
design impact
required agents
verification
cost/schedule candidate
risk
approval
```

不自动写入。

---

# 68. Design Impact Graph

节点：

```text
requirement
architecture interface
component
pin
net
power rail
clock
reset
firmware peripheral
driver
connector
cable
pcb constraint
test case
manufacturing artifact
```

边：

```text
must_change
may_change
must_reverify
must_regenerate
depends_on
conflicts_with
```

---

# 69. Verification Plan

支持：

```text
datasheet evidence check
schematic rule check
firmware pin mux readback
logic analyzer
oscilloscope
protocol analyzer
power sequence capture
current measurement
thermal check
cable continuity
connector mating
fault injection
power-off backfeed measurement
```

---

# 70. Compatibility Gate

## Architecture Compatibility Ready

```text
all critical interfaces have endpoints
no critical role/protocol conflict
no unresolved power source conflict
critical unknowns assigned
```

## Schematic Compatibility Ready

```text
actual pins and nets mapped
logic level margins pass
pull/termination defined
pin mux candidate available
power-off interaction reviewed
```

## Prototype Compatibility Ready

```text
firmware configuration verified
bandwidth and buffers validated
critical timing measured or simulated
physical connector mapping verified
critical findings closed
```

---

# 71. AI 允许职责

```text
从文档中提取接口和 Pin 候选
解释协议和角色冲突
生成 Open Question
生成 Repair Candidate 草稿
总结 Findings
识别自然语言中的接口同义词
```

---

# 72. AI 禁止职责

```text
编造电压阈值
编造 Pin 功能
编造协议版本
假设内部上拉阻值
自动判断安全默认状态
自动修改 Pin Mux
自动批准 Level Shifter
自动关闭 Finding
```

---

# 73. 状态机

```text
RECEIVED
→ VALIDATING_BASELINES
→ SNAPSHOTTING_INPUT
→ BUILDING_ENDPOINTS
→ BUILDING_DOMAINS
→ BUILDING_COMPATIBILITY_GRAPH
→ EVALUATING_ROLES_AND_PROTOCOLS
→ EVALUATING_VOLTAGE_AND_DRIVE
→ EVALUATING_PULLS_AND_TERMINATION
→ EVALUATING_CLOCK_TIMING_AND_BANDWIDTH
→ EVALUATING_PINMUX_AND_RESOURCES
→ EVALUATING_POWER_AND_BACKPOWER
→ EVALUATING_PHYSICAL_INTERCONNECT
→ EVALUATING_MODES_AND_VARIANTS
→ GENERATING_FINDINGS
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_VERIFICATION_PLAN
→ GENERATING_REVIEW_PACKAGE
→ REVIEW_REQUIRED
→ BASELINING
→ COMPLETED
```

分支：

```text
COMPLETED_DRAFT_ONLY
COMPLETED_WITH_OPEN_QUESTIONS
INPUT_BLOCKED
ENDPOINT_DATA_MISSING
CRITICAL_COMPATIBILITY_BLOCKED
PINMUX_REVIEW_REQUIRED
FIRMWARE_READBACK_REQUIRED
SIMULATION_REQUIRED
MEASUREMENT_REQUIRED
DECISION_REQUIRED
APPROVAL_REQUIRED
BASELINE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 74. 错误码

```text
PROJECT_NOT_FOUND
REQUIREMENT_BASELINE_NOT_FOUND
ARCHITECTURE_BASELINE_NOT_FOUND
SELECTION_BASELINE_NOT_FOUND
BASELINE_HASH_MISMATCH
COMPATIBILITY_PROFILE_NOT_FOUND
INTERFACE_CONTRACT_NOT_FOUND
ENDPOINT_UNRESOLVED
COMPONENT_PIN_DATA_MISSING
PIN_ELECTRICAL_TYPE_UNKNOWN
VOLTAGE_DOMAIN_UNRESOLVED
REFERENCE_GROUND_UNRESOLVED
ROLE_CONFLICT
PROTOCOL_CONFLICT
PROTOCOL_VERSION_UNRESOLVED
LOGIC_THRESHOLD_DATA_MISSING
LOGIC_LEVEL_MARGIN_NEGATIVE
INPUT_TOLERANCE_CONFLICT
DRIVE_CURRENT_INSUFFICIENT
FANOUT_EXCEEDED
BANK_CURRENT_EXCEEDED
PULLUP_REQUIRED
PULLUP_CONFLICT
DEFAULT_STATE_UNSAFE
TERMINATION_CONFLICT
ADDRESS_CONFLICT
CHIP_SELECT_CONFLICT
PINMUX_CONFLICT
BOOT_STRAP_CONFLICT
DEBUG_PIN_CONFLICT
CLOCK_CONFLICT
RESET_CONFLICT
TIMING_CONTRACT_INCOMPLETE
TIMING_VIOLATION
BANDWIDTH_INSUFFICIENT
BUFFER_INSUFFICIENT
DMA_CONFLICT
INTERRUPT_CONFLICT
POWER_SOURCE_CONFLICT
BACK_POWER_RISK
POWER_SEQUENCE_CONFLICT
GROUND_REFERENCE_CONFLICT
ISOLATION_GAP
CONNECTOR_MAPPING_MISMATCH
FPC_ORIENTATION_MISMATCH
CABLE_MAPPING_CONFLICT
VARIANT_CONFLICT
VERIFICATION_PLAN_INCOMPLETE
BASELINE_APPROVAL_MISSING
BASELINE_ALREADY_EXISTS
JOB_CANCELLED
INTERNAL_ERROR


---

# 75. 数据库设计

## 75.1 `compatibility_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
reuse_baseline_id UUID NULL
selection_baseline_id UUID NOT NULL
eda_revision_id UUID NULL
firmware_revision_id UUID NULL
project_baseline_id UUID NULL
compatibility_profile_id UUID NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
selected_baseline_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 75.2 `compatibility_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NOT NULL
architecture_baseline_hash CHAR(64) NOT NULL
reuse_baseline_hash CHAR(64) NULL
selection_baseline_hash CHAR(64) NOT NULL
eda_revision_hash CHAR(64) NULL
firmware_revision_hash CHAR(64) NULL
component_pin_snapshot_hash CHAR(64) NOT NULL
protocol_registry_snapshot_hash CHAR(64) NOT NULL
connector_registry_snapshot_hash CHAR(64) NULL
rule_snapshot_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, snapshot_hash)
```

## 75.3 `compatibility_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
project_phase VARCHAR NULL
required_checks JSONB NOT NULL
critical_interface_policy JSONB NOT NULL
unknown_policy JSONB NOT NULL
mode_policy JSONB NOT NULL
variant_policy JSONB NOT NULL
repair_policy JSONB NOT NULL
verification_policy JSONB NOT NULL
approval_policy JSONB NOT NULL
source_reference JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 75.4 `compatibility_endpoints`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
endpoint_key VARCHAR NOT NULL
owner_type VARCHAR NOT NULL
owner_id UUID NOT NULL
owner_revision JSONB NOT NULL
block_id UUID NULL
port_id UUID NULL
component_id UUID NULL
ordering_code_id UUID NULL
pin_group_id UUID NULL
direction VARCHAR NOT NULL
driver_type VARCHAR NOT NULL
receiver_type VARCHAR NOT NULL
role VARCHAR NULL
signal_type VARCHAR NOT NULL
voltage_domain_id UUID NULL
reference_domain_id UUID NULL
protocol_contract_id UUID NULL
physical_connector_id UUID NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
source_evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, endpoint_key)
```

## 75.5 `compatibility_pin_groups`

```text
id UUID PK
job_id UUID NOT NULL
pin_group_key VARCHAR NOT NULL
owner_component_id UUID NULL
owner_module_id UUID NULL
group_type VARCHAR NOT NULL
pin_refs JSONB NOT NULL
bank_reference JSONB NULL
alternate_functions JSONB NOT NULL
selected_function JSONB NULL
electrical_capabilities JSONB NOT NULL
timing_capabilities JSONB NOT NULL
boot_behavior JSONB NOT NULL
firmware_binding JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, pin_group_key)
```

## 75.6 `compatibility_electrical_domains`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
domain_key VARCHAR NOT NULL
domain_type VARCHAR NOT NULL
title VARCHAR NOT NULL
nominal_voltage JSONB NULL
operating_range JSONB NOT NULL
power_states JSONB NOT NULL
reference_domain_id UUID NULL
isolation_domain_id UUID NULL
source_power_node_ids JSONB NOT NULL
back_power_policy JSONB NOT NULL
startup_behavior JSONB NOT NULL
shutdown_behavior JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, domain_key)
```

## 75.7 `compatibility_reference_domains`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
reference_key VARCHAR NOT NULL
reference_type VARCHAR NOT NULL
title VARCHAR NOT NULL
parent_reference_id UUID NULL
connection_policy JSONB NOT NULL
isolation_attributes JSONB NOT NULL
shield_attributes JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, reference_key)
```

## 75.8 `compatibility_interface_contracts`

```text
id UUID PK
job_id UUID NOT NULL
interface_key VARCHAR NOT NULL
source_architecture_interface_id UUID NULL
interface_family VARCHAR NOT NULL
protocol_version JSONB NOT NULL
profile JSONB NOT NULL
topology VARCHAR NOT NULL
role_contract JSONB NOT NULL
electrical_contract JSONB NOT NULL
timing_contract JSONB NOT NULL
throughput_contract JSONB NOT NULL
error_contract JSONB NOT NULL
power_contract JSONB NOT NULL
physical_contract JSONB NOT NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, interface_key)
```

## 75.9 `compatibility_interface_links`

```text
id UUID PK
job_id UUID NOT NULL
link_key VARCHAR NOT NULL
interface_contract_id UUID NOT NULL
source_endpoint_ids JSONB NOT NULL
destination_endpoint_ids JSONB NOT NULL
intermediate_endpoint_ids JSONB NOT NULL
adapter_ids JSONB NOT NULL
net_or_bus_refs JSONB NOT NULL
physical_path_refs JSONB NOT NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, link_key)
```

## 75.10 `compatibility_endpoint_electrical_specs`

```text
id UUID PK
endpoint_id UUID NOT NULL
spec_version INT NOT NULL
input_thresholds JSONB NOT NULL
output_levels JSONB NOT NULL
absolute_limits JSONB NOT NULL
input_leakage JSONB NOT NULL
output_drive JSONB NOT NULL
input_capacitance JSONB NOT NULL
clamp_behavior JSONB NOT NULL
power_off_tolerance JSONB NOT NULL
slew_rate_options JSONB NOT NULL
pull_capabilities JSONB NOT NULL
conditions JSONB NOT NULL
evidence_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(endpoint_id, spec_version)
```

## 75.11 `compatibility_load_models`

```text
id UUID PK
job_id UUID NOT NULL
load_key VARCHAR NOT NULL
endpoint_id UUID NULL
load_type VARCHAR NOT NULL
dc_load JSONB NOT NULL
ac_load JSONB NOT NULL
capacitance JSONB NOT NULL
gate_charge JSONB NULL
termination JSONB NULL
cable_attributes JSONB NULL
mode_scope JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, load_key)
```

## 75.12 `compatibility_bias_elements`

```text
id UUID PK
job_id UUID NOT NULL
bias_key VARCHAR NOT NULL
bias_type VARCHAR NOT NULL
endpoint_or_net_ref JSONB NOT NULL
resistance JSONB NULL
voltage_domain_id UUID NULL
internal BOOLEAN NOT NULL
population_policy JSONB NOT NULL
tolerance JSONB NOT NULL
mode_scope JSONB NOT NULL
purpose VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, bias_key)
```

## 75.13 `compatibility_termination_elements`

```text
id UUID PK
job_id UUID NOT NULL
termination_key VARCHAR NOT NULL
termination_type VARCHAR NOT NULL
endpoint_or_net_ref JSONB NOT NULL
component_refs JSONB NOT NULL
value_model JSONB NOT NULL
placement_context JSONB NOT NULL
mode_scope JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, termination_key)
```

## 75.14 `compatibility_protocol_registry`

```text
id UUID PK
protocol_key VARCHAR NOT NULL
protocol_family VARCHAR NOT NULL
protocol_version VARCHAR NULL
profile_name VARCHAR NULL
role_types JSONB NOT NULL
topology_rules JSONB NOT NULL
electrical_layer_refs JSONB NOT NULL
timing_schema JSONB NOT NULL
throughput_schema JSONB NOT NULL
addressing_schema JSONB NOT NULL
termination_schema JSONB NOT NULL
error_schema JSONB NOT NULL
hotplug_schema JSONB NOT NULL
rule_version VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(protocol_key, rule_version)
```

## 75.15 `compatibility_clock_contracts`

```text
id UUID PK
job_id UUID NOT NULL
clock_key VARCHAR NOT NULL
source_endpoint_id UUID NULL
sink_endpoint_ids JSONB NOT NULL
frequency_range JSONB NOT NULL
accuracy JSONB NOT NULL
jitter JSONB NOT NULL
phase_noise JSONB NOT NULL
duty_cycle JSONB NOT NULL
logic_standard JSONB NOT NULL
amplitude JSONB NOT NULL
termination JSONB NOT NULL
startup JSONB NOT NULL
enable_behavior JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, clock_key)
```

## 75.16 `compatibility_reset_contracts`

```text
id UUID PK
job_id UUID NOT NULL
reset_key VARCHAR NOT NULL
source_endpoint_ids JSONB NOT NULL
sink_endpoint_ids JSONB NOT NULL
active_polarity VARCHAR NOT NULL
driver_type VARCHAR NOT NULL
minimum_pulse_width JSONB NOT NULL
assertion_conditions JSONB NOT NULL
deassertion_conditions JSONB NOT NULL
synchronization JSONB NOT NULL
external_bias JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, reset_key)
```

## 75.17 `compatibility_timing_contracts`

```text
id UUID PK
job_id UUID NOT NULL
timing_key VARCHAR NOT NULL
interface_link_id UUID NOT NULL
timing_type VARCHAR NOT NULL
source_requirement JSONB NOT NULL
destination_requirement JSONB NOT NULL
path_delay_budget JSONB NOT NULL
mode_scope JSONB NOT NULL
condition_ir JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, timing_key)
```

## 75.18 `compatibility_throughput_paths`

```text
id UUID PK
job_id UUID NOT NULL
path_key VARCHAR NOT NULL
producer_ref JSONB NOT NULL
consumer_ref JSONB NOT NULL
ordered_stage_refs JSONB NOT NULL
payload_model JSONB NOT NULL
rate_model JSONB NOT NULL
overhead_model JSONB NOT NULL
burst_model JSONB NOT NULL
concurrency_model JSONB NOT NULL
buffer_model JSONB NOT NULL
headroom_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, path_key)
```

## 75.19 `compatibility_buffer_models`

```text
id UUID PK
job_id UUID NOT NULL
buffer_key VARCHAR NOT NULL
owner_ref JSONB NOT NULL
capacity JSONB NOT NULL
producer_rate JSONB NOT NULL
consumer_rate JSONB NOT NULL
burst_tolerance JSONB NOT NULL
service_latency JSONB NOT NULL
overflow_behavior JSONB NOT NULL
backpressure_behavior JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, buffer_key)
```

## 75.20 `compatibility_pinmux_assignments`

```text
id UUID PK
job_id UUID NOT NULL
assignment_key VARCHAR NOT NULL
component_id UUID NOT NULL
ordering_code_id UUID NULL
physical_pin VARCHAR NOT NULL
bank_reference JSONB NULL
selected_function VARCHAR NOT NULL
peripheral_instance VARCHAR NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
boot_state JSONB NOT NULL
voltage_domain_id UUID NULL
drive_configuration JSONB NOT NULL
pull_configuration JSONB NOT NULL
firmware_source JSONB NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, assignment_key)
```

## 75.21 `compatibility_peripheral_resources`

```text
id UUID PK
job_id UUID NOT NULL
resource_key VARCHAR NOT NULL
component_id UUID NOT NULL
resource_type VARCHAR NOT NULL
instance_name VARCHAR NOT NULL
capabilities JSONB NOT NULL
allocated_to JSONB NOT NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, resource_key)
```

## 75.22 `compatibility_dma_assignments`

```text
id UUID PK
job_id UUID NOT NULL
assignment_key VARCHAR NOT NULL
component_id UUID NOT NULL
request_source VARCHAR NOT NULL
dma_controller VARCHAR NULL
channel_or_stream VARCHAR NULL
priority JSONB NOT NULL
destination JSONB NOT NULL
burst JSONB NOT NULL
cache_coherency JSONB NOT NULL
owner_firmware_component JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, assignment_key)
```

## 75.23 `compatibility_interrupt_assignments`

```text
id UUID PK
job_id UUID NOT NULL
assignment_key VARCHAR NOT NULL
component_id UUID NOT NULL
source_ref JSONB NOT NULL
interrupt_line VARCHAR NOT NULL
priority JSONB NOT NULL
trigger_type VARCHAR NOT NULL
shared_sources JSONB NOT NULL
latency_requirement JSONB NOT NULL
owner_firmware_component JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, assignment_key)
```

## 75.24 `compatibility_boot_straps`

```text
id UUID PK
job_id UUID NOT NULL
strap_key VARCHAR NOT NULL
component_id UUID NOT NULL
physical_pin VARCHAR NOT NULL
sample_window JSONB NOT NULL
required_level JSONB NOT NULL
internal_bias JSONB NOT NULL
external_bias JSONB NOT NULL
connected_loads JSONB NOT NULL
shared_functions JSONB NOT NULL
production_programming_effect JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, strap_key)
```

## 75.25 `compatibility_debug_interfaces`

```text
id UUID PK
job_id UUID NOT NULL
debug_key VARCHAR NOT NULL
component_id UUID NOT NULL
interface_type VARCHAR NOT NULL
pin_refs JSONB NOT NULL
shared_functions JSONB NOT NULL
accessibility JSONB NOT NULL
security_policy JSONB NOT NULL
factory_use JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, debug_key)
```

## 75.26 `compatibility_power_sources`

```text
id UUID PK
job_id UUID NOT NULL
source_key VARCHAR NOT NULL
owner_ref JSONB NOT NULL
source_role VARCHAR NOT NULL
voltage_range JSONB NOT NULL
continuous_current JSONB NOT NULL
peak_current JSONB NOT NULL
inrush_support JSONB NOT NULL
reverse_blocking JSONB NOT NULL
enable_behavior JSONB NOT NULL
power_good JSONB NOT NULL
priority JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, source_key)
```

## 75.27 `compatibility_power_loads`

```text
id UUID PK
job_id UUID NOT NULL
load_key VARCHAR NOT NULL
owner_ref JSONB NOT NULL
voltage_range JSONB NOT NULL
continuous_current JSONB NOT NULL
peak_current JSONB NOT NULL
inrush JSONB NOT NULL
startup_behavior JSONB NOT NULL
shutdown_behavior JSONB NOT NULL
power_off_pin_behavior JSONB NOT NULL
mode_scope JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, load_key)
```

## 75.28 `compatibility_power_paths`

```text
id UUID PK
job_id UUID NOT NULL
path_key VARCHAR NOT NULL
source_ids JSONB NOT NULL
load_ids JSONB NOT NULL
intermediate_refs JSONB NOT NULL
oring_strategy JSONB NOT NULL
reverse_current_policy JSONB NOT NULL
sequence_contract JSONB NOT NULL
fault_behavior JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, path_key)
```

## 75.29 `compatibility_connectors`

```text
id UUID PK
job_id UUID NOT NULL
connector_key VARCHAR NOT NULL
owner_ref JSONB NOT NULL
manufacturer VARCHAR NULL
ordering_code VARCHAR NULL
family VARCHAR NOT NULL
mating_part JSONB NULL
pin_count INT NOT NULL
pitch JSONB NULL
orientation VARCHAR NOT NULL
gender VARCHAR NULL
keying JSONB NOT NULL
latch JSONB NOT NULL
shield JSONB NOT NULL
electrical_rating JSONB NOT NULL
mechanical_rating JSONB NOT NULL
board_side VARCHAR NULL
rotation JSONB NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, connector_key)
```

## 75.30 `compatibility_connector_pins`

```text
id UUID PK
connector_id UUID NOT NULL
pin_number VARCHAR NOT NULL
signal_name VARCHAR NULL
signal_type VARCHAR NOT NULL
direction VARCHAR NULL
voltage_domain_id UUID NULL
reference_domain_id UUID NULL
endpoint_id UUID NULL
reserved BOOLEAN NOT NULL
no_connect BOOLEAN NOT NULL
mechanical_position JSONB NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(connector_id, pin_number)
```

## 75.31 `compatibility_cables`

```text
id UUID PK
job_id UUID NOT NULL
cable_key VARCHAR NOT NULL
cable_type VARCHAR NOT NULL
connector_a_id UUID NOT NULL
connector_b_id UUID NOT NULL
pin_mapping JSONB NOT NULL
wire_attributes JSONB NOT NULL
shield_attributes JSONB NOT NULL
impedance_attributes JSONB NOT NULL
length JSONB NULL
current_rating JSONB NOT NULL
voltage_rating JSONB NOT NULL
temperature_rating JSONB NOT NULL
flex_attributes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, cable_key)
```

## 75.32 `compatibility_fpc_contracts`

```text
id UUID PK
job_id UUID NOT NULL
fpc_key VARCHAR NOT NULL
connector_a_id UUID NOT NULL
connector_b_id UUID NOT NULL
pin_count INT NOT NULL
pitch JSONB NOT NULL
contact_side_a VARCHAR NOT NULL
contact_side_b VARCHAR NOT NULL
pin1_orientation JSONB NOT NULL
cable_length JSONB NULL
bend_attributes JSONB NOT NULL
locking_attributes JSONB NOT NULL
stiffener_attributes JSONB NOT NULL
impedance_attributes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, fpc_key)
```

## 75.33 `compatibility_evaluation_runs`

```text
id UUID PK
job_id UUID NOT NULL
evaluation_domain VARCHAR NOT NULL
evaluation_version INT NOT NULL
rule_set_version VARCHAR NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
pass_count INT NOT NULL
fail_count INT NOT NULL
unknown_count INT NOT NULL
needs_simulation_count INT NOT NULL
needs_measurement_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 75.34 `compatibility_check_results`

```text
id UUID PK
evaluation_run_id UUID NOT NULL
check_key VARCHAR NOT NULL
check_type VARCHAR NOT NULL
source_object_refs JSONB NOT NULL
destination_object_refs JSONB NOT NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
result VARCHAR NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
calculation_trace JSONB NOT NULL
condition_comparison JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(evaluation_run_id, check_key)
```

## 75.35 `compatibility_findings`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
finding_key VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
source_endpoint_ids JSONB NOT NULL
destination_endpoint_ids JSONB NOT NULL
affected_object_refs JSONB NOT NULL
mode_scope JSONB NOT NULL
variant_scope JSONB NOT NULL
actual JSONB NOT NULL
required JSONB NOT NULL
evidence_ids JSONB NOT NULL
repair_candidate_ids JSONB NOT NULL
owner_role VARCHAR NULL
required_before_gate VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, finding_key)
```

## 75.36 `compatibility_repair_candidates`

```text
id UUID PK
job_id UUID NOT NULL
repair_key VARCHAR NOT NULL
repair_type VARCHAR NOT NULL
finding_ids JSONB NOT NULL
affected_objects JSONB NOT NULL
proposed_change JSONB NOT NULL
technical_rationale TEXT NOT NULL
design_impact_summary JSONB NOT NULL
required_agents JSONB NOT NULL
verification_requirements JSONB NOT NULL
cost_schedule_candidate JSONB NULL
risk_summary JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, repair_key)
```

## 75.37 `compatibility_design_impact_graph_versions`

```text
id UUID PK
job_id UUID NOT NULL
repair_candidate_id UUID NULL
graph_version VARCHAR NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.38 `compatibility_verification_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
plan_version INT NOT NULL
finding_ids JSONB NOT NULL
repair_candidate_ids JSONB NOT NULL
datasheet_checks JSONB NOT NULL
simulation_checks JSONB NOT NULL
firmware_readback_checks JSONB NOT NULL
bench_tests JSONB NOT NULL
fault_injection_tests JSONB NOT NULL
physical_mapping_checks JSONB NOT NULL
required_evidence JSONB NOT NULL
owner_roles JSONB NOT NULL
required_before_gate VARCHAR NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, plan_version)
```

## 75.39 `compatibility_review_packages`

```text
id UUID PK
job_id UUID NOT NULL
package_version INT NOT NULL
endpoint_summary JSONB NOT NULL
domain_summary JSONB NOT NULL
protocol_summary JSONB NOT NULL
voltage_drive_summary JSONB NOT NULL
pull_termination_summary JSONB NOT NULL
timing_bandwidth_summary JSONB NOT NULL
pinmux_resource_summary JSONB NOT NULL
power_backpower_summary JSONB NOT NULL
physical_interconnect_summary JSONB NOT NULL
finding_summary JSONB NOT NULL
repair_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
decision_questions JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, package_version)
```

## 75.40 `compatibility_decision_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
decision_key VARCHAR NOT NULL
job_id UUID NOT NULL
accepted_repair_ids JSONB NOT NULL
rejected_repair_ids JSONB NOT NULL
accepted_risk_ids JSONB NOT NULL
required_validations JSONB NOT NULL
architecture_changes JSONB NOT NULL
component_changes JSONB NOT NULL
firmware_changes JSONB NOT NULL
eda_changes JSONB NOT NULL
approvals JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 75.41 `compatibility_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
requirement_baseline_id UUID NOT NULL
architecture_baseline_id UUID NOT NULL
reuse_baseline_id UUID NULL
selection_baseline_id UUID NOT NULL
eda_revision_id UUID NULL
firmware_revision_id UUID NULL
compatibility_profile_id UUID NOT NULL
endpoint_manifest JSONB NOT NULL
domain_manifest JSONB NOT NULL
interface_manifest JSONB NOT NULL
pinmux_manifest JSONB NOT NULL
power_manifest JSONB NOT NULL
physical_interconnect_manifest JSONB NOT NULL
finding_manifest JSONB NOT NULL
repair_manifest JSONB NOT NULL
verification_manifest JSONB NOT NULL
accepted_risk_manifest JSONB NOT NULL
open_question_manifest JSONB NOT NULL
approval_manifest JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, baseline_version)
```

## 75.42 `compatibility_downstream_packages`

```text
id UUID PK
compatibility_baseline_id UUID NOT NULL
package_type VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
target_agent VARCHAR NULL
content_uri TEXT NOT NULL
content_hash CHAR(64) NOT NULL
requirement_trace JSONB NOT NULL
architecture_trace JSONB NOT NULL
selection_trace JSONB NOT NULL
compatibility_trace JSONB NOT NULL
input_gate JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(compatibility_baseline_id, package_type, target_agent)
```

## 75.43 `compatibility_change_impact_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_compatibility_baseline_id UUID NOT NULL
requirement_change_request_id UUID NULL
architecture_change_impact_id UUID NULL
selection_change_impact_id UUID NULL
eda_change_event JSONB NULL
firmware_change_event JSONB NULL
changed_endpoints JSONB NOT NULL
changed_domains JSONB NOT NULL
changed_links JSONB NOT NULL
invalidated_checks JSONB NOT NULL
affected_findings JSONB NOT NULL
affected_repairs JSONB NOT NULL
required_rechecks JSONB NOT NULL
required_reverification JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_uri TEXT NOT NULL
impact_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 75.44 `compatibility_measurement_evidence`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
job_id UUID NOT NULL
evidence_key VARCHAR NOT NULL
evidence_type VARCHAR NOT NULL
test_setup JSONB NOT NULL
instrument_context JSONB NOT NULL
firmware_revision JSONB NOT NULL
eda_revision JSONB NOT NULL
conditions JSONB NOT NULL
measurements JSONB NOT NULL
waveform_or_trace_uri TEXT NULL
artifact_hash CHAR(64) NULL
result VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, evidence_key)
```

## 75.45 `compatibility_feedback_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
compatibility_baseline_id UUID NOT NULL
feedback_type VARCHAR NOT NULL
prototype_findings JSONB NOT NULL
production_findings JSONB NOT NULL
field_findings JSONB NOT NULL
false_positive_findings JSONB NOT NULL
false_negative_findings JSONB NOT NULL
repair_effectiveness JSONB NOT NULL
rule_quality JSONB NOT NULL
data_quality VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

---

# 76. 对象存储

```text
derived/compatibility/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          requirement-baseline.json
          architecture-baseline.json
          reuse-baseline.json
          selection-baseline.json
          eda-revision.json
          firmware-revision.json
          compatibility-profile.json
          input-snapshot.json
          component-pin-snapshot.json
          protocol-registry-snapshot.json
          connector-registry-snapshot.json
          policy.json
        endpoints/
          endpoints.jsonl.zst
          pin-groups.jsonl.zst
          endpoint-evidence/
        domains/
          electrical-domains.jsonl.zst
          reference-domains.jsonl.zst
          power-states.jsonl.zst
        interfaces/
          contracts.jsonl.zst
          links.jsonl.zst
          compatibility-graph.json
          endpoint-matrix.parquet
        electrical/
          threshold-matrix.parquet
          level-margins.parquet
          drive-load-budgets.parquet
          fanout.parquet
          power-off-tolerance.parquet
        bias/
          pulls.jsonl.zst
          equivalent-resistance.parquet
          default-states.parquet
          termination.jsonl.zst
        protocols/
          role-matrix.parquet
          version-matrix.parquet
          addressing.parquet
          bus-topology.json
        timing/
          clock-contracts.jsonl.zst
          reset-contracts.jsonl.zst
          timing-contracts.jsonl.zst
          timing-results.parquet
          cdc-candidates.jsonl.zst
        throughput/
          paths.jsonl.zst
          buffers.jsonl.zst
          bandwidth-results.parquet
          bottlenecks.jsonl.zst
        resources/
          pinmux.jsonl.zst
          peripherals.jsonl.zst
          dma.jsonl.zst
          interrupts.jsonl.zst
          boot-straps.jsonl.zst
          debug-interfaces.jsonl.zst
          conflicts.jsonl.zst
        power/
          sources.jsonl.zst
          loads.jsonl.zst
          paths.jsonl.zst
          sequence-results.parquet
          backpower-paths.jsonl.zst
        physical/
          connectors.jsonl.zst
          connector-pins.jsonl.zst
          cables.jsonl.zst
          fpc.jsonl.zst
          mappings.parquet
          orientation-findings.jsonl.zst
        evaluation/
          protocol/
          voltage/
          drive/
          pulls/
          timing/
          bandwidth/
          pinmux/
          power/
          physical/
          modes/
          variants/
        findings/
          findings.jsonl.zst
          evidence/
          correlations/
        repairs/
          candidates.jsonl.zst
          impact-graphs/
          work-packages/
        verification/
          plans/
          measurements/
          firmware-readback/
          bench-results/
        review/
          review-package.html
          review-package.pdf
          interface-matrix.csv
          level-margins.csv
          pinmux-conflicts.csv
          power-risks.csv
          physical-mapping.csv
          decisions/
          approvals/
        baseline/
          compatibility-baseline.json
          release-manifest.json
          downstream-packages/
        changes/
          impact/
          rechecks/
          baseline-diffs/
        feedback/
          prototype/
          production/
          field/
        debug/
          rule-trace.jsonl.zst
          graph-trace.jsonl.zst
          calculation-trace.jsonl.zst
          model-trace.jsonl.zst
          resource-usage.json
```

---

# 77. API 设计

## 77.1 Jobs

```text
POST /api/v1/compatibility/jobs
POST /api/v1/compatibility/jobs/batch
GET  /api/v1/compatibility/jobs/{id}
GET  /api/v1/compatibility/jobs/{id}/events
POST /api/v1/compatibility/jobs/{id}/cancel
POST /api/v1/compatibility/jobs/{id}/retry
POST /api/v1/compatibility/jobs/{id}/rerun
```

## 77.2 Readiness and Snapshot

```text
POST /api/v1/compatibility/jobs/{id}/validate-readiness
GET  /api/v1/compatibility/jobs/{id}/readiness
POST /api/v1/compatibility/jobs/{id}/freeze-input
GET  /api/v1/compatibility/jobs/{id}/input-snapshot
```

## 77.3 Profiles and Rules

```text
POST /api/v1/compatibility/profiles
GET  /api/v1/compatibility/profiles
GET  /api/v1/compatibility/profiles/{id}
POST /api/v1/compatibility/profiles/{id}/validate
POST /api/v1/compatibility/profiles/{id}/approve
POST /api/v1/compatibility/profiles/{id}/deprecate
GET  /api/v1/compatibility/protocol-registry
GET  /api/v1/compatibility/rules
```

## 77.4 Endpoints and Domains

```text
POST /api/v1/compatibility/jobs/{id}/build-endpoints
GET  /api/v1/compatibility/jobs/{id}/endpoints
GET  /api/v1/compatibility/endpoints/{id}
PATCH /api/v1/compatibility/endpoints/{id}
POST /api/v1/compatibility/jobs/{id}/build-domains
GET  /api/v1/compatibility/jobs/{id}/domains
GET  /api/v1/compatibility/domains/{id}
```

## 77.5 Interface Graph

```text
POST /api/v1/compatibility/jobs/{id}/build-interface-graph
GET  /api/v1/compatibility/jobs/{id}/interface-graph
GET  /api/v1/compatibility/jobs/{id}/interface-links
POST /api/v1/compatibility/interface-links/{id}/validate
```

## 77.6 Protocol and Role Checks

```text
POST /api/v1/compatibility/jobs/{id}/check-protocols
POST /api/v1/compatibility/jobs/{id}/check-roles
GET  /api/v1/compatibility/jobs/{id}/protocol-results
GET  /api/v1/compatibility/jobs/{id}/role-matrix
```

## 77.7 Voltage and Drive Checks

```text
POST /api/v1/compatibility/jobs/{id}/check-voltage-levels
POST /api/v1/compatibility/jobs/{id}/check-input-tolerance
POST /api/v1/compatibility/jobs/{id}/check-drive-load
POST /api/v1/compatibility/jobs/{id}/check-fanout
GET  /api/v1/compatibility/jobs/{id}/level-margins
GET  /api/v1/compatibility/jobs/{id}/drive-load-budgets
```

## 77.8 Bias, Pull and Termination

```text
POST /api/v1/compatibility/jobs/{id}/check-pulls
POST /api/v1/compatibility/jobs/{id}/check-default-states
POST /api/v1/compatibility/jobs/{id}/check-termination
GET  /api/v1/compatibility/jobs/{id}/bias-results
GET  /api/v1/compatibility/jobs/{id}/termination-results
```

## 77.9 Clock, Reset and Timing

```text
POST /api/v1/compatibility/jobs/{id}/check-clocks
POST /api/v1/compatibility/jobs/{id}/check-resets
POST /api/v1/compatibility/jobs/{id}/check-timing
POST /api/v1/compatibility/jobs/{id}/check-cdc-candidates
GET  /api/v1/compatibility/jobs/{id}/timing-results
```

## 77.10 Bandwidth and Buffers

```text
POST /api/v1/compatibility/jobs/{id}/check-bandwidth
POST /api/v1/compatibility/jobs/{id}/check-buffers
GET  /api/v1/compatibility/jobs/{id}/throughput-paths
GET  /api/v1/compatibility/jobs/{id}/bandwidth-results
GET  /api/v1/compatibility/jobs/{id}/bottlenecks
```

## 77.11 Pin Mux and Resources

```text
POST /api/v1/compatibility/jobs/{id}/build-pinmux
POST /api/v1/compatibility/jobs/{id}/check-pinmux
POST /api/v1/compatibility/jobs/{id}/check-peripherals
POST /api/v1/compatibility/jobs/{id}/check-dma
POST /api/v1/compatibility/jobs/{id}/check-interrupts
POST /api/v1/compatibility/jobs/{id}/check-boot-straps
POST /api/v1/compatibility/jobs/{id}/check-debug
GET  /api/v1/compatibility/jobs/{id}/resource-conflicts
```

## 77.12 Power and Back-power

```text
POST /api/v1/compatibility/jobs/{id}/build-power-paths
POST /api/v1/compatibility/jobs/{id}/check-power
POST /api/v1/compatibility/jobs/{id}/check-power-sequence
POST /api/v1/compatibility/jobs/{id}/check-backpower
POST /api/v1/compatibility/jobs/{id}/check-isolation
POST /api/v1/compatibility/jobs/{id}/check-ground-reference
GET  /api/v1/compatibility/jobs/{id}/power-results
GET  /api/v1/compatibility/jobs/{id}/backpower-paths
```

## 77.13 Connectors and Cables

```text
POST /api/v1/compatibility/jobs/{id}/build-connectors
POST /api/v1/compatibility/jobs/{id}/check-connector-mapping
POST /api/v1/compatibility/jobs/{id}/check-cables
POST /api/v1/compatibility/jobs/{id}/check-fpc
POST /api/v1/compatibility/jobs/{id}/check-orientation
GET  /api/v1/compatibility/jobs/{id}/physical-results
```

## 77.14 Findings and Repairs

```text
GET  /api/v1/compatibility/jobs/{id}/findings
GET  /api/v1/compatibility/findings/{id}
POST /api/v1/compatibility/findings/{id}/accept
POST /api/v1/compatibility/findings/{id}/reject
POST /api/v1/compatibility/findings/{id}/waive
POST /api/v1/compatibility/jobs/{id}/generate-repair-candidates
GET  /api/v1/compatibility/jobs/{id}/repair-candidates
POST /api/v1/compatibility/repair-candidates/{id}/approve
POST /api/v1/compatibility/repair-candidates/{id}/reject
```

## 77.15 Verification and Evidence

```text
POST /api/v1/compatibility/jobs/{id}/verification-plan
GET  /api/v1/compatibility/jobs/{id}/verification-plan
POST /api/v1/compatibility/jobs/{id}/measurement-evidence
GET  /api/v1/compatibility/jobs/{id}/measurement-evidence
POST /api/v1/compatibility/jobs/{id}/firmware-readback
```

## 77.16 Review and Decision

```text
POST /api/v1/compatibility/jobs/{id}/review-package
GET  /api/v1/compatibility/jobs/{id}/review-package
POST /api/v1/compatibility/jobs/{id}/submit-review
POST /api/v1/compatibility/jobs/{id}/decision-record
GET  /api/v1/compatibility/jobs/{id}/decision-record
POST /api/v1/compatibility/decisions/{id}/approve
```

## 77.17 Baseline and Downstream

```text
POST /api/v1/compatibility/jobs/{id}/baseline-candidates
GET  /api/v1/projects/{project_id}/compatibility-baselines
GET  /api/v1/compatibility/baselines/{id}
POST /api/v1/compatibility/baselines/{id}/approve
POST /api/v1/compatibility/baselines/{id}/freeze
GET  /api/v1/compatibility/baselines/{id}/manifest
POST /api/v1/compatibility/baselines/{id}/generate-downstream-packages
GET  /api/v1/compatibility/baselines/{id}/downstream-packages
```

## 77.18 Changes and Feedback

```text
POST /api/v1/compatibility/baselines/{id}/analyze-change
GET  /api/v1/compatibility/change-impacts/{id}
POST /api/v1/compatibility/baselines/{id}/feedback
GET  /api/v1/compatibility/jobs/{id}/report
GET  /api/v1/compatibility/jobs/{id}/interface-matrix.csv
GET  /api/v1/compatibility/jobs/{id}/level-margins.csv
GET  /api/v1/compatibility/jobs/{id}/pinmux-conflicts.csv
GET  /api/v1/compatibility/jobs/{id}/physical-mapping.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 78. 输入事件

```text
requirements.baseline-frozen
architecture.baseline-frozen
reuse.baseline-frozen
component-selection.baseline-frozen
eda.canonical-ir-ready
netlist.reviewed
eda-library.validation-ready
firmware.pinmux-ready
firmware.driver-config-ready
compatibility.requested
```

---

# 79. 输出事件

```text
compatibility.input-blocked
compatibility.endpoints-ready
compatibility.critical-conflict-detected
compatibility.pinmux-review-required
compatibility.firmware-readback-required
compatibility.simulation-required
compatibility.measurement-required
compatibility.repair-candidates-ready
compatibility.review-required
compatibility.decision-required
compatibility.baseline-candidate-ready
compatibility.baseline-frozen
compatibility.change-impact-ready
compatibility.downstream-packages-ready
compatibility.completed
compatibility.failed
```

---

# 80. 下游事件

```text
project-planning.compatibility-work-packages-ready
architecture.interface-change-candidate-ready
component-selection.reselection-candidate-ready
reference-reuse.adapter-candidate-ready
eda.compatibility-fix-package-ready
firmware.compatibility-fix-package-ready
pcb.compatibility-constraint-package-ready
mechanical.connector-package-ready
verification.compatibility-plan-ready
```

---

# 81. Policy 组织

```text
policies/
├── compatibility-1.0.0.yaml
├── readiness-gates.yaml
├── profiles/
│   ├── project-phases.yaml
│   ├── critical-interfaces.yaml
│   ├── modes.yaml
│   └── variants.yaml
├── endpoints/
│   ├── directions.yaml
│   ├── driver-types.yaml
│   ├── receiver-types.yaml
│   ├── signal-types.yaml
│   └── evidence.yaml
├── electrical/
│   ├── thresholds.yaml
│   ├── voltage-tolerance.yaml
│   ├── drive-current.yaml
│   ├── fanout.yaml
│   ├── bank-current.yaml
│   ├── leakage.yaml
│   └── power-off.yaml
├── bias/
│   ├── pullup.yaml
│   ├── pulldown.yaml
│   ├── open-drain.yaml
│   ├── default-state.yaml
│   └── termination.yaml
├── protocols/
│   ├── spi.yaml
│   ├── i2c.yaml
│   ├── uart.yaml
│   ├── can.yaml
│   ├── usb.yaml
│   ├── ethernet.yaml
│   ├── differential.yaml
│   └── analog.yaml
├── timing/
│   ├── clock.yaml
│   ├── reset.yaml
│   ├── setup-hold.yaml
│   ├── propagation.yaml
│   ├── cdc.yaml
│   └── jitter.yaml
├── throughput/
│   ├── overhead.yaml
│   ├── burst.yaml
│   ├── headroom.yaml
│   ├── buffers.yaml
│   └── backpressure.yaml
├── resources/
│   ├── pinmux.yaml
│   ├── peripherals.yaml
│   ├── dma.yaml
│   ├── interrupts.yaml
│   ├── boot-straps.yaml
│   └── debug.yaml
├── power/
│   ├── sources.yaml
│   ├── loads.yaml
│   ├── sequencing.yaml
│   ├── backpower.yaml
│   ├── isolation.yaml
│   └── grounds.yaml
├── physical/
│   ├── connectors.yaml
│   ├── pin-mapping.yaml
│   ├── cables.yaml
│   ├── fpc.yaml
│   ├── orientation.yaml
│   └── keying.yaml
├── findings.yaml
├── repairs.yaml
├── verification.yaml
├── baseline.yaml
├── changes.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 82. Endpoint Provider

```python
class CompatibilityEndpointProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def build_from_architecture(self, request) -> EndpointSet: ...
    async def build_from_components(self, request) -> EndpointSet: ...
    async def build_from_eda(self, request) -> EndpointSet: ...
    async def build_from_firmware(self, request) -> EndpointSet: ...
    async def explain(self, result) -> EndpointTrace: ...
```

---

# 83. Rule Provider

```python
class CompatibilityRuleProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate(self, request) -> ValidationResult: ...
    async def evaluate(self, request) -> CompatibilityCheckResult: ...
    async def explain(self, result) -> RuleTrace: ...
```

领域：

```text
roles
protocols
voltage
drive_load
bias
termination
clock
reset
timing
bandwidth
pinmux
resources
power
physical
modes
variants
```

---

# 84. Firmware Readback Provider

```python
class FirmwareConfigurationProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def extract_pinmux(self, source) -> PinMuxSnapshot: ...
    async def extract_peripherals(self, source) -> PeripheralSnapshot: ...
    async def extract_dma_interrupts(self, source) -> ResourceSnapshot: ...
    async def extract_clock_tree(self, source) -> ClockSnapshot: ...
    async def compare(self, contract, actual) -> ReadbackResult: ...
```

默认只读，不编译或执行不可信代码。

---

# 85. EDA Readback Provider

```python
class EDACompatibilityProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def extract_pins_nets(self, canonical_ir) -> EndpointNetSnapshot: ...
    async def extract_bias_termination(self, canonical_ir) -> BiasTerminationSnapshot: ...
    async def extract_connectors(self, canonical_ir) -> ConnectorSnapshot: ...
    async def compare(self, contract, actual) -> ReadbackResult: ...
```

---

# 86. Numeric Evaluation

必须使用：

```text
Decimal
explicit units
interval/range comparisons
condition IR
source evidence
rule version
```

禁止：

```text
binary float for formal margin
implicit unit conversion
condition-free typical values
hidden defaults
```

---

# 87. Compatibility Graph

节点：

```text
endpoint
pin
net
bus
protocol
voltage domain
reference domain
clock
reset
power source
power load
connector
cable
firmware resource
```

边：

```text
drives
receives
connected_to
powered_by
referenced_to
clocked_by
reset_by
mapped_to
multiplexed_with
shares_resource
passes_through
isolated_by
terminated_by
biased_by
```

---

# 88. Graph Queries

支持：

```text
find conflicting drivers
find unreferenced receiver
find cross-domain path
find back-power path
find shared pin conflict
find duplicate address
find clock/reset fanout
find connector mapping inversion
find variant-only disconnected path
```

---

# 89. Review Workbench

建议：

```text
左：Interfaces / Endpoints / Domains / Findings / Repairs
中：Compatibility Graph / Matrix / Pin Map / Power Path / Connector Map
右：Evidence / Thresholds / Timing / Firmware Readback / Mode
下：Bandwidth / Pulls / Pinmux / Back-power / Verification / Baseline
```

---

# 90. Review 操作

```text
查看接口端点
确认方向和角色
查看电平裕量
比较 Min/Max 和条件
查看 Pull 等效值
查看默认状态
查看 Pin Mux
查看 DMA/Interrupt
查看带宽瓶颈
查看 Back-power 路径
查看连接器和 FPC Mapping
接受/拒绝 Finding
生成 Repair Candidate
创建 Verification Plan
批准 Compatibility Baseline
```

---

# 91. 可观测性

```text
compatibility_jobs_total{status,profile}
compatibility_job_duration_seconds{step}
compatibility_endpoints_total{type,status}
compatibility_interfaces_total{family,status}
compatibility_checks_total{domain,result}
compatibility_findings_total{type,severity,status}
compatibility_logic_margin_min{interface}
compatibility_drive_budget_margin{interface}
compatibility_bandwidth_margin{path}
compatibility_pinmux_conflicts_total{type}
compatibility_backpower_paths_total{severity}
compatibility_connector_mapping_conflicts_total{type}
compatibility_repair_candidates_total{type,status}
compatibility_baselines_total{status}
compatibility_external_model_calls_total{provider,status}
```

---

# 92. Dashboard

```text
Projects
Compatibility Readiness
Endpoints
Interface Matrix
Voltage Domains
Logic Margins
Drive and Fan-out
Pulls and Termination
Protocol Roles
Clock/Reset
Bandwidth and Buffers
Pin Mux
DMA/Interrupt
Boot/Debug
Power and Back-power
Connectors/Cables/FPC
Findings
Repairs
Verification
Baselines
Feedback
```

---

# 93. 安全与权限

- 原理图、Pin 分配、Firmware 配置、客户协议和连接器定义按租户/项目隔离；
- Datasheet 公共阈值可共享，私有 Pin Mux、协议和 BOM 不跨租户；
- Firmware 仓库默认只读，不执行 Build Script、Generator、Post-build 或外部工具；
- EDA 注释、Net Label、Connector Name 和 Firmware Macro 视为不可信输入；
- 防止 Prompt Injection、Expression Injection、Path Traversal、XML Entity 和恶意压缩包；
- 参数、公式和条件使用受限 IR，不执行任意代码；
- 外部模型只接收最小化、脱敏后的接口描述，不接收完整原理图或 Firmware；
- Repair Candidate、Pin Remap、Level Shifter、Protocol Downgrade 和 Power-domain Change 需要审批；
- Agent 19写入权限与 Compatibility Review 权限分离；
- Critical Finding Waiver 需要指定角色和到期条件；
- Measurement Evidence、Decision、Baseline 和 Waiver 不可硬删除；
- Downstream Package 绑定 Baseline、Hash 和权限；
- 公开 Fixture 仅使用开源、合成、脱敏或授权数据。

---

# 94. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
```

数值和图：

```text
Decimal
Pint or controlled unit registry
NetworkX or typed graph
Polars
PyArrow
DuckDB
```

规则：

```text
versioned YAML/JSON rules
safe expression IR
category/protocol-specific evaluators
property-based tests
```

前端：

```text
React
TypeScript
Interactive Graph
Pin Matrix
Logic Margin Table
Power Path View
Connector/FPC Mapper
Finding/Repair Workbench
```

---

# 95. 推荐仓库结构

```text
compatibility-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── compatibility-agent-spec.md
│   ├── input-and-readiness.md
│   ├── endpoint-and-domain-model.md
│   ├── protocol-and-role-compatibility.md
│   ├── voltage-and-drive-compatibility.md
│   ├── pulls-termination-and-default-state.md
│   ├── clock-reset-and-timing.md
│   ├── bandwidth-and-buffering.md
│   ├── pinmux-and-resources.md
│   ├── power-backpower-and-isolation.md
│   ├── connector-cable-and-fpc.md
│   ├── findings-repairs-and-verification.md
│   ├── baselines-and-changes.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-connectivity-is-not-compatibility.md
│       ├── 0002-endpoints-and-domains-are-first-class.md
│       ├── 0003-conditions-and-modes-drive-electrical-checks.md
│       ├── 0004-firmware-and-eda-readback-are-required.md
│       ├── 0005-repairs-are-candidates-not-writes.md
│       ├── 0006-ai-does-not-invent-electrical-facts.md
│       └── 0007-compatibility-baselines-are-immutable.md
├── src/
│   └── compatibility/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent10.py
│       │   ├── agent11.py
│       │   ├── agent12.py
│       │   ├── agent13.py
│       │   ├── agent14.py
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   └── downstream.py
│       ├── intake/
│       │   ├── readiness.py
│       │   ├── snapshots.py
│       │   └── profiles.py
│       ├── endpoints/
│       │   ├── providers.py
│       │   ├── architecture.py
│       │   ├── components.py
│       │   ├── eda.py
│       │   ├── firmware.py
│       │   └── merge.py
│       ├── domains/
│       │   ├── electrical.py
│       │   ├── references.py
│       │   ├── power_states.py
│       │   └── isolation.py
│       ├── graph/
│       │   ├── model.py
│       │   ├── builder.py
│       │   ├── queries.py
│       │   └── diffs.py
│       ├── protocols/
│       │   ├── registry.py
│       │   ├── roles.py
│       │   ├── spi.py
│       │   ├── i2c.py
│       │   ├── uart.py
│       │   ├── can.py
│       │   ├── usb.py
│       │   ├── ethernet.py
│       │   ├── differential.py
│       │   └── analog.py
│       ├── electrical/
│       │   ├── thresholds.py
│       │   ├── margins.py
│       │   ├── tolerance.py
│       │   ├── drive.py
│       │   ├── loads.py
│       │   ├── fanout.py
│       │   └── power_off.py
│       ├── bias/
│       │   ├── pulls.py
│       │   ├── equivalent.py
│       │   ├── defaults.py
│       │   ├── open_drain.py
│       │   └── termination.py
│       ├── timing/
│       │   ├── clocks.py
│       │   ├── resets.py
│       │   ├── contracts.py
│       │   ├── checks.py
│       │   └── cdc.py
│       ├── throughput/
│       │   ├── paths.py
│       │   ├── overhead.py
│       │   ├── buffers.py
│       │   ├── bottlenecks.py
│       │   └── checks.py
│       ├── resources/
│       │   ├── pinmux.py
│       │   ├── peripherals.py
│       │   ├── dma.py
│       │   ├── interrupts.py
│       │   ├── boot.py
│       │   └── debug.py
│       ├── power/
│       │   ├── sources.py
│       │   ├── loads.py
│       │   ├── paths.py
│       │   ├── sequence.py
│       │   ├── backpower.py
│       │   ├── isolation.py
│       │   └── grounds.py
│       ├── physical/
│       │   ├── connectors.py
│       │   ├── pinmaps.py
│       │   ├── cables.py
│       │   ├── fpc.py
│       │   ├── keying.py
│       │   └── orientation.py
│       ├── evaluation/
│       ├── findings/
│       ├── repairs/
│       ├── verification/
│       ├── decisions/
│       ├── baselines/
│       ├── changes/
│       ├── feedback/
│       ├── downstream/
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── compatibility-profiles/
├── protocol-registry/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_compatibility_readiness.py
    ├── build_compatibility_endpoints.py
    ├── run_protocol_checks.py
    ├── run_electrical_checks.py
    ├── run_pinmux_checks.py
    ├── run_power_backpower_checks.py
    ├── run_physical_mapping_checks.py
    ├── freeze_compatibility_baseline.py
    ├── analyze_compatibility_change.py
    └── run_compatibility_benchmark.py
```


---

# 96. Codex 分阶段实施

不要让 Codex 一次实现协议库、电平规则、Pin Mux、Firmware Readback、Back-power 图、连接器映射、仿真和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 10 Requirement Baseline、Constraint、Variant、Acceptance Criteria 和 Change；
2. Agent 11 Compatibility Work Package、Gate、Owner、Risk、Schedule 和 Project Baseline；
3. Agent 12 Block、Port、Interface Contract、Power、Clock、Reset、Mode、Bandwidth 和 Architecture Baseline；
4. Agent 13 Module Composition、Adapter、Connector、Cable 和 Reuse Baseline；
5. Agent 14 Component Selection、Ordering Code、Pin/Package、Electrical/Firmware/EDA 数据和 Selection Baseline；
6. 当前 Interface、Port、Endpoint、Protocol、Role、Direction 和 Topology 数据模型；
7. 当前 Voltage Domain、Power Domain、Ground、Isolation 和 Mode 数据模型；
8. 当前器件 Pin、I/O Bank、Electrical Characteristics、Absolute Maximum、Threshold、Drive 和 Pull 数据；
9. 当前 Datasheet、Reference Manual、Hardware Guide、Errata 和 Evidence Anchor；
10. 当前 SPI、I²C、UART、CAN、USB、Ethernet、MIPI、LVDS、模拟和自定义协议规则；
11. 当前 Clock、Reset、Timing、CDC、Bandwidth、Buffer 和 DMA 模型；
12. 当前 MCU/FPGA Pin Mux、Alternate Function、Boot Strap、Debug 和 Reserved Pin 数据；
13. 当前 Firmware 配置、Device Tree、HAL、CubeMX/配置文件、Pin Map 和 Driver；
14. 当前 Agent 16 Canonical EDA IR、Agent 18 Netlist 和 Agent 20 Pin Electrical Type；
15. 当前上拉、下拉、串联电阻、终端、偏置和 Level Shifter 识别能力；
16. 当前电源源、负载、序列、Enable、Power Good、Back-power 和 Power-off 模型；
17. 当前 Connector、Mating Part、Pin Mapping、Cable、Harness、FPC 和 Orientation 数据；
18. 当前模块数据库的接口和连接器字段；
19. 当前机械模型中连接器方向和线缆出口；
20. 当前兼容性检查、ERC、Lint、Spreadsheet 或人工 Checklist；
21. 当前 Finding、Waiver、Repair、Decision、Baseline 和 Change；
22. 当前 Agent 19、22、23、24、25、26、27、28、29、30 契约；
23. 当前 UI、API、Worker、Database、Object Storage 和 Security；
24. 当前开源、合成、脱敏或授权 Fixture；
25. 统计接口端点完整率；
26. 统计电平阈值、驱动、负载、Pull 和 Timing 数据覆盖率；
27. 统计 Pin Mux、Boot Strap、Debug 和 DMA 冲突；
28. 统计连接器/FPC Pinout 返工问题；
29. 统计 Power-off Back-power 和多电源冲突；
30. 统计兼容性问题在 EVT/DVT/量产阶段被发现的比例；
31. 只运行只读扫描、安全解析和公开 Fixture；
32. 不修改架构、选型、Firmware 或 EDA；
33. 不执行不可信 Firmware Build Script；
34. 不创建真实 Agent 19 写入任务；
35. 不冻结 Compatibility Baseline；
36. 不创建 Migration；
37. 不安装协议分析、仿真、图或模型组件；
38. 不调用生产外部模型；
39. 不读取或打印 Secret、客户原理图、BOM、Pin Map 和私有协议。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Job；
- Input Snapshot；
- Profile；
- Endpoint；
- Pin Group；
- Electrical/Reference Domain；
- Interface Contract/Link；
- Endpoint Electrical Spec；
- Load；
- Bias；
- Termination；
- Protocol Registry；
- Clock/Reset/Timing；
- Throughput/Buffer；
- Pin Mux/Peripheral/DMA/Interrupt；
- Boot/Debug；
- Power Source/Load/Path；
- Connector/Pin；
- Cable/FPC；
- Evaluation Run/Result；
- Finding；
- Repair；
- Design Impact；
- Verification；
- Review/Decision；
- Baseline；
- Downstream；
- Change Impact；
- Measurement Evidence；
- Feedback；
- JSON Schema。

## Phase 2：Compatibility Input Gate

实现：

- Agent 10/12/14 Baselines；
- Agent 13 optional；
- Agent 11 Task/Gate；
- EDA/Firmware Revision optional；
- Component Pin Data；
- Protocol Rules；
- Connector Registry；
- Project Phase；
- Draft/Design/Readback Mode；
- Immutable Snapshot；
- Diagnostics；
- Missing-data Gate。

## Phase 3：Compatibility Profile Registry

实现：

- Product Category；
- Project Phase；
- Required Checks；
- Critical Interfaces；
- Unknown Policy；
- Mode/Variant；
- Repair；
- Verification；
- Approval；
- Version/Effective Date；
- Validation/Deprecation。

## Phase 4：Canonical Endpoint Model

实现：

- Architecture Endpoint；
- Component Endpoint；
- Module Endpoint；
- EDA Pin/Net Endpoint；
- Firmware Peripheral Endpoint；
- Owner/Revision；
- Direction；
- Driver/Receiver；
- Role；
- Signal；
- Domain；
- Mode/Variant；
- Evidence；
- Stable Key。

## Phase 5：Endpoint Merge and Provenance

实现：

- Architecture-to-Component；
- Component-to-Pin；
- Pin-to-Net；
- Net-to-Connector；
- Firmware-to-Pin；
- Source Precedence；
- Conflict；
- Unknown；
- Original Values；
- Provenance Graph；
- No Silent Merge。

## Phase 6：Electrical and Reference Domains

实现：

- Nominal/Range；
- Digital/Analog/Power；
- Ground/Shield/Chassis；
- Isolation；
- Power States；
- Startup/Shutdown；
- Back-power Policy；
- Architecture Mapping；
- EDA Mapping；
- Validation。

## Phase 7：Protocol Registry Foundation

实现：

- Family/Version/Profile；
- Roles；
- Topology；
- Electrical Layer；
- Timing；
- Throughput；
- Addressing；
- Termination；
- Error；
- Hot Plug；
- Rule Version；
- Review Workflow。

## Phase 8：Interface Link Graph

实现：

- Source/Destination；
- Intermediate Adapter；
- Nets/Buses；
- Physical Path；
- Mode/Variant；
- Graph Nodes/Edges；
- Missing Endpoint；
- Multiple Driver；
- Dangling Receiver；
- Stable Hash。

## Phase 9：Role and Direction Checks

实现：

- TX/RX；
- Controller/Peripheral；
- Host/Device；
- Source/Sink；
- MAC/PHY；
- Differential P/N；
- Power Source/Sink；
- Conflict；
- Unknown；
- Repair Candidates；
- Golden Tests。

## Phase 10：Electrical Threshold Model

实现：

- VIH/VIL；
- VOH/VOL；
- Load Conditions；
- Absolute Max；
- Input Tolerance；
- Clamp；
- Leakage；
- Power-off Tolerance；
- Evidence；
- Min/Typ/Max Classification；
- Datasheet Revision。

## Phase 11：Logic-level Margin Engine

实现：

- High/Low Margin；
- Range/Interval；
- Conditions；
- Supply/Temperature/Load；
- Guaranteed Values；
- Negative Margin；
- Unknown；
- Level Shifter Candidate；
- Decimal/Units；
- Trace。

## Phase 12：Drive and Load Engine

实现：

- Source/Sink；
- Pin Current；
- Bank Current；
- Device Current；
- Input Leakage；
- Capacitance；
- Fan-out；
- Edge Rate；
- LED/MOS Gate；
- Cable Load；
- Simultaneous Switching Candidate；
- Findings。

## Phase 13：Open-drain and Shared-bus Checks

实现：

- Driver Types；
- Push-pull Conflict；
- Pull Domain；
- Equivalent Resistance；
- Capacitance；
- Rise Time Candidate；
- Sink Current；
- Static Power；
- Power-off；
- Multi-controller；
- Evidence。

## Phase 14：Pull-up, Pull-down and Default State

实现：

- Internal/External；
- Value/Tolerance；
- Multiple Bias；
- Reset State；
- Firmware Initialization；
- Level Shifter State；
- Mode；
- Safety Signal；
- Missing/Strong/Weak；
- Default State Findings。

## Phase 15：Termination and Biasing

实现：

- Series；
- Parallel；
- Thevenin；
- Differential；
- CAN/RS-485；
- Source/End Termination；
- Duplicate；
- Missing；
- Value Candidate；
- Placement Context；
- Agent 24/27 Handoff。

## Phase 16：SPI Evaluator

实现：

- Role；
- CPOL/CPHA；
- Bit Order；
- Word Length；
- CS Polarity/Timing；
- Clock Limits；
- MISO Tri-state；
- Multi-device；
- DMA；
- Throughput；
- Voltage；
- Findings。

## Phase 17：I²C/SMBus Evaluator

实现：

- Address；
- Address Width；
- Speed；
- Pulls；
- Capacitance；
- Rise/Fall；
- Sink；
- Clock Stretch；
- Timeout；
- Multi-controller；
- Alert/PEC；
- Hot-swap；
- Findings。

## Phase 18：UART/RS-232/RS-485 Evaluator

实现：

- Physical Level；
- Baud；
- Framing；
- Polarity；
- Flow Control；
- Duplex；
- Termination；
- Bias；
- Common Ground；
- Driver/Receiver；
- Connector；
- Findings。

## Phase 19：CAN Evaluator

实现：

- Controller/Transceiver；
- CAN/CAN FD；
- Bit Rate；
- TXD/RXD；
- Standby/Wake；
- Common Mode；
- Termination；
- Connector；
- Ground；
- Protection；
- Agent 24/27 Handoff。

## Phase 20：USB Evaluator

实现：

- Data Role；
- Power Role；
- Version/Speed；
- Connector；
- CC；
- VBUS；
- Current Advertisement；
- PD Candidate；
- Orientation；
- ESD；
- Shield；
- Firmware；
- Findings。

## Phase 21：Ethernet Evaluator

实现：

- MAC/PHY；
- MII/RMII/RGMII/SGMII；
- Clocks；
- Voltage；
- Delay Mode；
- MDIO；
- Magnetics；
- Termination；
- PoE；
- Connector；
- Driver；
- Findings。

## Phase 22：Differential and High-speed Evaluator

实现：

- Standard；
- Common Mode；
- Swing；
- Termination；
- Polarity；
- Lane Mapping；
- AC Coupling；
- Bias；
- Skew Budget Candidate；
- Cable/Connector；
- Agent 24/27 Handoff；
- No SI Signoff。

## Phase 23：Analog Interface Evaluator

实现：

- Range；
- Common Mode；
- Source/Load Impedance；
- Bias；
- Offset；
- Bandwidth；
- Noise；
- Settling；
- Protection；
- Reference/Ground；
- Agent 23 Handoff；
- Unknown Handling。

## Phase 24：Clock Contract Engine

实现：

- Source/Sink；
- Frequency；
- Accuracy；
- Jitter；
- Phase Noise；
- Duty；
- Logic Standard；
- Load；
- Termination；
- Startup；
- Enable；
- Spread Spectrum；
- Mode；
- Findings。

## Phase 25：Reset Contract Engine

实现：

- Polarity；
- Driver；
- Pulse Width；
- Threshold；
- Domain；
- Supervisor；
- Bias；
- Shared Reset；
- Sync；
- Startup；
- Firmware；
- Findings。

## Phase 26：Timing Compatibility

实现：

- Setup/Hold；
- Clock-to-output；
- Propagation；
- Pulse Width；
- Enable/Disable；
- CS；
- Reset；
- Power Sequence；
- Conditions；
- Path Budget；
- Needs Simulation/Measurement；
- No False Closure。

## Phase 27：Bandwidth and Throughput

实现：

- Payload；
- Encoding/Framing；
- Protocol Overhead；
- Retry；
- Burst；
- Concurrency；
- Utilization；
- Headroom；
- Stage Bottleneck；
- Architecture Budget Link；
- Findings。

## Phase 28：Buffer and Backpressure

实现：

- FIFO/Memory；
- Producer/Consumer；
- Service Latency；
- DMA；
- Interrupt；
- Overflow；
- Backpressure；
- Loss Policy；
- Mode；
- Worst-case Candidate；
- Findings。

## Phase 29：Pin Mux Registry

实现：

- Physical Pin；
- Bank；
- Alternate Functions；
- Selected Function；
- Domain；
- Drive/Pull/Speed；
- Boot State；
- Mode/Variant；
- Agent 14/20/21 Sources；
- Conflict Trace；
- Review。

## Phase 30：Peripheral Resource Allocation

实现：

- Instances；
- Channels；
- Timers；
- ADC/DAC；
- PIO/SERCOM；
- Memory Controller；
- FPGA Banks；
- Shared Resources；
- Mode/Variant；
- Over-allocation；
- Findings。

## Phase 31：DMA and Interrupt Allocation

实现：

- Requests；
- Controllers；
- Channels/Streams；
- Priority；
- Burst；
- Destination；
- Cache；
- Shared Interrupt；
- Latency；
- Firmware Owner；
- Conflicts。

## Phase 32：Boot Strap, Debug and Programming

实现：

- Sample Window；
- Required State；
- Bias；
- Shared Load；
- Buttons/Connectors；
- SWD/JTAG/ISP/DFU；
- Production Fixture；
- Security Lock；
- Enclosure Access Candidate；
- Findings。

## Phase 33：Firmware Readback

实现：

- Static Config Parsers；
- Device Tree；
- Generated Config；
- HAL Init；
- Pin Definitions；
- Clock Config；
- DMA/IRQ；
- Driver Modes；
- Baseline Comparison；
- No Code Execution；
- Readback Findings。

## Phase 34：Power Source and Load Model

实现：

- Source/Sink/Dual Role；
- Voltage/Current/Peak；
- Inrush；
- Enable；
- Power Good；
- Priority；
- Load Startup；
- Power-off Pin Behavior；
- Mode；
- Evidence。

## Phase 35：Multiple Source and Power Sequence

实现：

- ORing；
- Ideal Diode；
- Priority；
- Reverse Blocking；
- Source Contention；
- USB/Battery；
- External Supply；
- Sequence Graph；
- Cycle；
- Timing；
- Fault；
- Findings。

## Phase 36：Back-power Path Analysis

实现：

- Powered/Unpowered Modes；
- Signal Path；
- Pull Rails；
- Clamp；
- Level Shifter；
- Shared Reset；
- Bus Switch；
- Graph Traversal；
- Clamp-current Candidate；
- Findings；
- Verification Plan。

## Phase 37：Ground and Isolation

实现：

- Ground Types；
- Reference Requirements；
- Isolation Boundary；
- Isolated Power；
- Shield/Chassis；
- Unintended Short；
- Missing Return；
- Working/Transient Candidate；
- Agent 24/27/28/30 Handoff。

## Phase 38：Connector Registry and Pin Mapping

实现：

- Manufacturer/Ordering Code；
- Mating Part；
- Pin Count/Pitch；
- Gender/Orientation；
- Key/Latch/Shield；
- Board Side/Rotation；
- Pin Signal/Domain；
- Evidence；
- Comparison；
- Findings。

## Phase 39：Cable and Harness Compatibility

实现：

- Connector A/B；
- Cross-over；
- Polarity；
- Gauge；
- Current/Voltage；
- Shield/Twist；
- Impedance；
- Length；
- Temperature/Flex；
- Ground；
- Continuity Plan；
- Findings。

## Phase 40：FPC/FFC Compatibility

实现：

- Pin Count/Pitch；
- Contact Side；
- Same/Opposite Side；
- Pin 1；
- Locking；
- Stiffener；
- Length/Bend；
- Current/Impedance；
- Orientation；
- Agent 28 Handoff；
- Findings。

## Phase 41：Mode and Variant Matrix

实现：

- Boot/Active/Sleep/Off/Update/Test/Fault；
- Variant Population；
- Endpoint Availability；
- Power States；
- Pull/Default；
- Firmware；
- Connector；
- Compatibility Per Cell；
- Missing Coverage；
- Findings。

## Phase 42：Finding Correlation

实现：

- Duplicate Merge；
- Root Cause；
- Symptom Links；
- Architecture/Component/EDA/Firmware；
- Severity；
- Confidence；
- Evidence；
- Gate；
- Stable Keys；
- No Hidden Suppression。

## Phase 43：Repair Candidate Generator

实现：

- Pin Remap；
- Level Shifter；
- Buffer；
- Bus Switch；
- Pull/Termination；
- Protocol Speed；
- Clock；
- Reset；
- Power Isolation；
- Connector Map；
- Adapter Board；
- Firmware Config；
- Technical Rationale；
- Constraints；
- Candidate-only。

## Phase 44：Design Impact Graph

实现：

- Requirements；
- Architecture；
- Components；
- Pins/Nets；
- Firmware；
- PCB；
- Mechanical；
- Test；
- BOM/Manufacturing；
- Must Change/Reverify/Regenerate；
- Graph Diff；
- Agent Routing。

## Phase 45：Verification Planner

实现：

- Evidence Review；
- Firmware Readback；
- Logic Analyzer；
- Scope；
- Protocol Analyzer；
- Power Sequence；
- Backfeed；
- Current/Thermal；
- Connector Continuity；
- Fault Injection；
- Conditions；
- Evidence Capture；
- Owner/Gate。

## Phase 46：Review Workbench

实现：

- Interface Graph；
- Endpoint Matrix；
- Domains；
- Margins；
- Pulls；
- Timing/Bandwidth；
- Pin Mux；
- Power/Back-power；
- Connector/FPC；
- Findings/Repairs；
- Verification；
- Decision/Baseline。

## Phase 47：Compatibility Decision Record

实现：

- Accepted/Rejected Repairs；
- Accepted Risks；
- Architecture Change；
- Component Change；
- Firmware Change；
- EDA Change；
- Verification；
- Approvers；
- Effective Baseline；
- Audit；
- No AI Approval。

## Phase 48：Compatibility Baseline

实现：

- Endpoints；
- Domains；
- Links；
- Pin Mux；
- Power；
- Physical Interconnect；
- Findings；
- Repairs；
- Verification；
- Risks/Questions；
- Approvals；
- Manifest；
- Hash；
- Immutability。

## Phase 49：Downstream Packages

实现：

- Agent 11 Work Packages；
- Agent 12 Interface Changes；
- Agent 14 Reselection；
- Agent 19 EDA Changes；
- Agent 20 Pin/Library；
- Agent 21 Firmware；
- Agent 22/23 Review/Simulation；
- Agent 24–30 Constraints/Manufacturing；
- Schema/Hash/Gates；
- Contract Tests。

## Phase 50：Controlled Fix and Readback

实现：

- Isolated Workspace；
- Approved Repair；
- Agent 19 Preview；
- Agent 20 Validation；
- Agent 21 Config Change；
- EDA/Firmware Readback；
- Agent 16/18 Reparse；
- Re-run All Compatibility Checks；
- Rollback；
- No Partial Closure。

## Phase 51：Change Impact and Recheck

实现：

- Requirement；
- Architecture；
- Module；
- Component；
- EDA；
- Firmware；
- Connector/Cable；
- Rule Update；
- Invalidated Checks；
- Targeted Recheck；
- Full Critical Regression；
- New Baseline Candidate。

## Phase 52：Measurement Correlation and Feedback

实现：

- Bench Evidence；
- Threshold/Timing/Power；
- False Positive/Negative；
- Repair Effectiveness；
- Rule Quality；
- Data Correction Candidate；
- Production/Field；
- No Automatic Rule Approval。

## Phase 53：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Pagination；
- ACL；
- Audit；
- Metrics；
- Event Idempotency；
- Retention；
- Artifact Lifecycle；
- Worker Health。

## Phase 54：Benchmark、监控和生产发布

实现：

- Endpoint Coverage；
- Rule Accuracy；
- Logic Margin；
- Protocol；
- Pinmux；
- Back-power；
- Connector Mapping；
- Change Impact；
- Performance；
- Security；
- Feature Flags；
- Rule/Provider Rollback；
- Disaster Recovery。

## Phase 55：高级能力，可选

稳定后：

- IBIS-assisted Digital Compatibility；
- Formal CDC/RDC Tool Integration；
- Automatic Adapter Circuit Candidate；
- Protocol Analyzer Trace Import；
- FPGA Constraint Readback；
- Harness Netlist Generation；
- Product-line Interface Compatibility；
- Field Connector Misuse Analysis；
- 仍不自动批准电气修复或生产变更。

---

# 97. Codex 工作纪律

Codex 必须：

1. Agent 10/12/14 Baseline 驱动检查；
2. Agent 11 Gate 控制执行；
3. Agent 13模块组合显式；
4. EDA/Firmware Revision 显式；
5. Input Snapshot 不可变；
6. Connectivity != Compatibility；
7. Endpoint 是一级对象；
8. Logical/Protocol/Electrical/Physical 分层；
9. Owner/Ordering Code/Revision 显式；
10. Direction 和 Role 分开；
11. Driver 和 Receiver Type 分开；
12. Voltage Domain 和 Reference Domain 分开；
13. Mode/Variant 是一级维度；
14. Min/Typ/Max 分开；
15. Absolute Maximum 不用于正常兼容；
16. Guaranteed Threshold 优先；
17. Conditions 必须匹配；
18. Unknown != Pass；
19. 逻辑裕量使用 Decimal 和单位；
20. Input Tolerance 绑定 Pin 和供电状态；
21. Drive Current 包含 Load 条件；
22. Fan-out 包含电容和边沿；
23. Bank/Device 电流限制显式；
24. Open-drain 总线检查所有 Driver；
25. Pull-up Domain 显式；
26. 多上拉计算等效值；
27. Internal Pull 不默认足够；
28. Default State 包含 Reset/Firmware/Power；
29. 安全信号默认态必须检查；
30. Termination 位置和值显式；
31. Protocol Family/Version/Profile 分开；
32. USB Data Role/Power Role 分开；
33. UART TTL/RS-232/RS-485 分开；
34. CAN Controller/Transceiver 分开；
35. Ethernet MAC/PHY 分开；
36. Clock Source/Sink 显式；
37. Reset Polarity/Driver/Pulse 显式；
38. Timing 未知不能自动通过；
39. Bandwidth 包含 Overhead/Burst/Concurrency；
40. Buffer/Backpressure 显式；
41. Pin Mux 绑定 Physical Pin；
42. Peripheral/DMA/IRQ 资源显式；
43. Boot Strap/Debug/Crystal/USB 专用脚显式；
44. Firmware Readback 只读；
45. 不执行不可信代码；
46. Power Source/Sink Role 显式；
47. Multiple Source 需要 ORing/Priority；
48. Power-off Interaction 必须检查；
49. Back-power 有路径证据；
50. Ground/Shield/Chassis 分开；
51. Connector 绑定 Ordering Code 和 Mating Part；
52. Pin Mapping 有方向和 Pin 1；
53. FPC Contact Side 显式；
54. Mechanical Geometry 交给 Agent 28；
55. Finding 有 Actual/Required/Evidence；
56. Repair 是 Candidate；
57. Repair 不自动写入；
58. Agent 19负责受控写入；
59. 写入后 EDA/Firmware Readback；
60. Critical Checks 全量回归；
61. Baseline 不可覆盖；
62. Change 触发失效分析；
63. Waiver 有角色、理由和到期条件；
64. AI 不编造电气事实；
65. 私有接口不发送未批准模型；
66. 不用客户工程做公开 Fixture；
67. 不伪造测量、参数或 Benchmark；
68. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Rule/Protocol/Provider 变化；
    - 测试命令和真实结果；
    - Endpoints/Domains；
    - Protocol/Role；
    - Electrical/Drive；
    - Pull/Termination；
    - Timing/Bandwidth；
    - Pinmux/Resources；
    - Power/Back-power；
    - Physical Mapping；
    - Findings/Repairs；
    - Verification/Baseline；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 98. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input and Endpoints

1. Approved Architecture Baseline；
2. Missing Selection Baseline；
3. EDA Revision；
4. Firmware Revision；
5. Architecture Endpoint；
6. Component Endpoint；
7. Module Endpoint；
8. EDA Pin Endpoint；
9. Firmware Peripheral Endpoint；
10. Missing Owner；
11. Direction Unknown；
12. Driver Unknown；
13. Voltage Domain；
14. Reference Ground；
15. Isolation Domain；
16. Mode Scope；
17. Variant Scope；
18. Source Conflict；
19. Merge Precedence；
20. Endpoint Hash。

## Voltage and Drive

21. CMOS 3V3 Compatible；
22. 1V8 to 3V3 Incompatible；
23. 5V-tolerant Pin；
24. Tolerant Only When Powered；
25. Absolute Max Misuse；
26. Typical VOH Not Guaranteed；
27. High Margin Positive；
28. High Margin Negative；
29. Low Margin Positive；
30. Low Margin Negative；
31. Input Leakage；
32. Output Source Current；
33. Output Sink Current；
34. LED Load；
35. MOS Gate Load；
36. Input Capacitance；
37. Fan-out DC；
38. Fan-out AC；
39. Bank Current；
40. Device Current；
41. Simultaneous Switching Candidate；
42. Slew Control；
43. Unknown Threshold；
44. Condition Mismatch；
45. Level Shifter Candidate。

## Pulls, Defaults and Termination

46. Single Pull-up；
47. Multiple Pull-ups；
48. Equivalent Resistance；
49. Pull-up Too Strong；
50. Pull-up Too Weak；
51. Internal Pull Only；
52. Pull to Wrong Domain；
53. Power-off Pull Backfeed；
54. Missing Pull-down；
55. Safe Default；
56. Unsafe Motor Enable；
57. Reset Default；
58. Firmware Init Delay；
59. Open-drain Shared Bus；
60. Push-pull Conflict；
61. Series Termination；
62. End Termination；
63. Duplicate CAN Termination；
64. Missing RS-485 Bias；
65. Thevenin Bias。

## Protocols

66. SPI Mode Match；
67. SPI CPHA Conflict；
68. SPI MISO Non-tristate；
69. SPI CS Polarity；
70. SPI Clock Too Fast；
71. I2C Address Conflict；
72. I2C Speed Conflict；
73. I2C Clock Stretch Unsupported；
74. I2C Bus Capacitance；
75. I2C Multi-controller；
76. UART Framing Match；
77. UART TTL to RS-232 Conflict；
78. UART Flow Control Missing；
79. RS-485 Termination；
80. CAN Controller/Transceiver；
81. CAN FD Version；
82. CAN Standby Pin；
83. USB Host/Device；
84. USB Two Hosts Conflict；
85. USB CC Pull Conflict；
86. USB VBUS Source Conflict；
87. USB PD Unknown；
88. Ethernet MAC/PHY；
89. RMII Clock Direction；
90. RGMII Delay；
91. LVDS Common Mode；
92. Differential Polarity；
93. AC Coupling Placement；
94. Analog Common Mode；
95. Analog Source/Load Impedance。

## Clock, Reset and Timing

96. Clock Frequency Match；
97. Clock Accuracy；
98. Clock Jitter Unknown；
99. Wrong Clock Logic Standard；
100. Clock Load Exceeded；
101. Reset Polarity；
102. Reset Pulse Width；
103. Open-drain Reset；
104. Shared Reset Conflict；
105. Reset Deassert Sync；
106. Setup Pass；
107. Setup Fail；
108. Hold Unknown；
109. CS Timing；
110. Turnaround；
111. Power Sequence Timing；
112. CDC Async Candidate；
113. Async FIFO Present；
114. Missing Synchronizer；
115. Reset Domain Crossing。

## Bandwidth and Resources

116. Raw Rate Only；
117. Protocol Overhead；
118. Encoding Overhead；
119. Retry Overhead；
120. Burst；
121. Concurrent Streams；
122. Headroom；
123. Bottleneck Bridge；
124. FIFO Sufficient；
125. FIFO Overflow；
126. DMA Latency；
127. Interrupt Latency；
128. Backpressure；
129. Data Loss Policy；
130. Pin Mux Pass；
131. Same Pin Conflict；
132. Bank Voltage Conflict；
133. Peripheral Instance Conflict；
134. Timer Conflict；
135. DMA Request Conflict；
136. Shared Interrupt；
137. Priority Conflict；
138. Boot Strap Conflict；
139. SWD Conflict；
140. Crystal Pin Conflict；
141. USB Dedicated Pin；
142. Variant Pin Conflict；
143. Firmware Readback Drift；
144. Firmware Config Missing；
145. Static Parser Security。

## Power and Back-power

146. Single Power Source；
147. Two Sources with ORing；
148. Two Sources Contention；
149. USB/Battery Priority；
150. Continuous Current Pass；
151. Peak Current Fail；
152. Inrush Unsupported；
153. Enable Polarity；
154. Power Good；
155. Sequence Cycle；
156. Reverse Blocking；
157. Signal High into Unpowered MCU；
158. Fail-safe Input；
159. Back-power through I2C Pull-up；
160. Back-power through Reset；
161. Level Shifter Partial Power；
162. Shared Rail Off Mode；
163. Ground Missing；
164. Isolated Ground Short；
165. Shield-to-Ground Policy；
166. Isolated Power Missing；
167. Fault Mode；
168. Hot Plug；
169. Brownout；
170. Power-off Verification Plan。

## Connectors and Physical Mapping

171. Same Connector Exact；
172. Same Pin Count Different Family；
173. Mating Part Missing；
174. Male/Female Conflict；
175. Keying Conflict；
176. Board-side Orientation；
177. Pin 1 Reversed；
178. Connector Mapping Crossed；
179. Power/Ground Swapped；
180. Reserved Pin Used；
181. Cable Straight-through；
182. Cable Cross-over；
183. Wire Gauge Current Fail；
184. Shield Missing；
185. Differential Pair Untwisted Candidate；
186. Cable Length Unknown；
187. FPC Same-side；
188. FPC Opposite-side；
189. FPC Top/Bottom Contact；
190. FPC Pin 1 Reversed；
191. FPC Pitch Conflict；
192. FPC Lock Type；
193. Mechanical Direction Candidate；
194. Agent 28 Handoff；
195. Variant Connector。

## Findings, Repairs and Baseline

196. Finding Dedup；
197. Root Cause Correlation；
198. Severity Critical；
199. Confidence Low；
200. Pin Remap Repair；
201. Level Shifter Repair；
202. Pull Change；
203. Termination Change；
204. Clock Change；
205. Protocol Speed Reduction；
206. Adapter Board；
207. Component Reselection；
208. Firmware Config；
209. Design Impact Graph；
210. Agent 11 Work Package；
211. Agent 12 Interface Change；
212. Agent 14 Reselection；
213. Agent 19 Preview；
214. Agent 20 Pin Validation；
215. Agent 21 Firmware Change；
216. Agent 22 Review；
217. Agent 23 Simulation；
218. Agent 24 Constraint；
219. Agent 27 SI/EMC；
220. Agent 28 Mechanical；
221. Verification Plan；
222. Measurement Evidence；
223. Review Package；
224. Decision Approval；
225. Baseline Approval Missing；
226. Immutable Baseline；
227. Requirement Change；
228. Component Change；
229. Firmware Change；
230. EDA Change；
231. Rule Version Change；
232. Targeted Recheck；
233. Critical Full Regression；
234. Preserve Old Baseline；
235. False Positive Feedback；
236. False Negative Feedback；
237. Prompt Injection in Pin Name；
238. Malicious Firmware Macro；
239. Tenant Isolation；
240. External Model Policy；
241. 100k Endpoints；
242. 1M Graph Edges；
243. Worker Cancellation；
244. Partial Parser Failure；
245. Rule Rollback。

---

# 99. 初始质量目标

```text
Critical Interface Endpoint Coverage = 100%
Approved Critical Endpoint Ordering-code/Revision Binding = 100%
Critical Logic Threshold Evidence Coverage = 100%
Absolute Maximum Used as Operating Compatibility = 0
Typical Threshold Misrepresented as Guaranteed = 0
Unknown Electrical Condition Silent Pass = 0
Critical Negative Logic Margin in Approved Baseline = 0
Critical Role/Protocol Conflict in Approved Baseline = 0
Critical Pin Mux Conflict in Approved Baseline = 0
Critical Back-power Path without Decision = 0
Critical Connector Mapping without Evidence = 0
FPC Contact-side Unknown in Approved Physical Interface = 0
Repair Candidate Direct EDA/Firmware Write = 0
Approved Repair without Readback/Regression = 0
Compatibility Baseline Overwrite = 0
Change without Invalidated-check Analysis = 0
Private Interface Data Sent to Unapproved Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 100. 性能要求

常规项目：

```text
100–10,000 Endpoints
50–5,000 Interface Links
10–1,000 Voltage Domains
100–20,000 Pins
10–2,000 Connectors/Cables
```

目标：

```text
Readiness P95 < 15 s
Endpoint Build P95 < 30 s for 10k endpoints
Role/Protocol Check P95 < 10 s
Logic Margin Check P95 < 15 s for 100k endpoint pairs
Pinmux Check P95 < 10 s for 20k assignments
Back-power Graph Query P95 < 30 s for 1M edges
Connector Mapping P95 < 10 s for 10k pins
Interactive Finding Query P95 < 300 ms
Change Impact P95 < 30 s for 100k trace edges
```

大型项目要求：

- Typed graph partition；
- incremental endpoint rebuild；
- rule result cache；
- mode/variant partition；
- columnar result storage；
- batch Decimal calculation；
- cancellation；
- partial diagnostics；
- worker resource limits；
- 不把完整设计一次发送给模型。

---

# 101. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/compatibility-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第15个 Agent：

Interface, Power, Signal-Level, Timing, Resource
& Physical Interconnect Compatibility Agent /
接口、电源与兼容性检查 Agent。

本 Agent 接收：

- Agent 10 Requirement Baseline、Variant 和 Change；
- Agent 11 Compatibility Work Package、Gate 和 Project Baseline；
- Agent 12 Block、Port、Interface、Power、Clock、Reset、Mode、Budget 和 Architecture Baseline；
- Agent 13 Module Composition、Adapter、Connector 和 Reuse Baseline；
- Agent 14 Component Selection、Ordering Code、Electrical/Firmware/EDA 和 Selection Baseline；
- Agent 16 EDA Canonical IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Pin/Footprint/Library Validation；
- Agent 21 Pin Mux/Firmware Configuration；
- Protocol、Connector、Cable 和 Enterprise Rule Registries；

输出：

- Endpoint/Domain IR；
- Interface Compatibility Graph；
- Role/Protocol Matrix；
- Voltage/Logic Margin；
- Drive/Fan-out/Load；
- Pull/Default/Termination；
- Clock/Reset/Timing；
- Bandwidth/Buffer；
- Pinmux/Peripheral/DMA/Interrupt；
- Boot/Debug；
- Power/Sequence/Back-power；
- Ground/Isolation；
- Connector/Cable/FPC Mapping；
- Mode/Variant Matrix；
- Findings/Repair Candidates；
- Design Impact；
- Verification Plan；
- Compatibility Decision/Baseline；
- Agent 11–45 Downstream Packages。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10–15 和 Agent 16–45 规格；
3. docs/compatibility-agent-spec.md；
4. 当前 Requirement/Project/Architecture/Reuse/Selection Baselines；
5. 当前 Interface/Port/Endpoint 数据模型；
6. 当前 Component Pin/Electrical 数据；
7. 当前 Voltage/Power/Ground/Isolation；
8. 当前 Protocol Registry；
9. 当前 Clock/Reset/Timing；
10. 当前 Bandwidth/Buffer；
11. 当前 Pin Mux/Peripheral/DMA/IRQ；
12. 当前 Boot/Debug；
13. 当前 Agent 16/18/20/21 Contracts；
14. 当前 Pull/Termination/Level Shifter 识别；
15. 当前 Power Source/Load/Sequence/Back-power；
16. 当前 Connector/Cable/FPC；
17. 当前 Finding/Repair/Baseline；
18. 当前 UI/API/Worker/Storage/Security；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Requirement/Architecture/Selection Baseline Driven；
- One Job = One Immutable Input Snapshot；
- Connectivity != Compatibility；
- Endpoints and Domains First-class；
- Logical/Protocol/Electrical/Physical Layers Separate；
- Ordering Code/Revision Binding；
- Direction/Role/Driver/Receiver Explicit；
- Voltage and Reference Domains Separate；
- Mode/Variant First-class；
- Decimal/Units/Conditions；
- Min/Typ/Max/Absolute/Guaranteed Separate；
- Absolute Maximum Is Not Operating Range；
- Unknown != Pass；
- Input Tolerance Binds Pin and Power State；
- Drive Includes Load Conditions；
- Fan-out Includes Capacitance/Edge；
- Open-drain Checks Every Driver；
- Pull Domain/Equivalent Resistance Explicit；
- Internal Pull Is Not Automatically Sufficient；
- Default State Includes Reset/Firmware/Power；
- Protocol Family/Version/Profile Explicit；
- USB Data/Power Roles Separate；
- Clock/Reset/Timing Explicit；
- Bandwidth Includes Overhead/Burst/Concurrency；
- Buffer/Backpressure Explicit；
- Pinmux Binds Physical Pins；
- Peripheral/DMA/IRQ/Boot/Debug Explicit；
- Firmware Readback Is Read-only；
- Multiple Power Sources Require Strategy；
- Power-off/Back-power Required；
- Ground/Shield/Chassis Separate；
- Connector Binds Mating Part and Pin Mapping；
- FPC Contact Side and Pin 1 Explicit；
- Repair Is Candidate, Not Write；
- Agent 19 Controlled Write；
- EDA/Firmware Readback and Critical Regression；
- Immutable Baseline；
- Change Invalidates Checks；
- AI Does Not Invent Electrical Facts；
- No External Private Interface Data；
- 不用客户工程做公开 Fixture；
- 不伪造参数、测量或 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改架构、Firmware 或 EDA：

1. 侦察当前仓库；
2. 查找 Agent 10–14 Baselines 和 Contracts；
3. 查找 Interface/Port/Endpoint；
4. 查找 Component Pin/Electrical Data；
5. 查找 Voltage/Power/Reference/Isolation Domains；
6. 查找 Protocol Registry；
7. 查找 Clock/Reset/Timing；
8. 查找 Bandwidth/Buffer；
9. 查找 Pinmux/Peripheral/DMA/IRQ；
10. 查找 Boot/Debug；
11. 查找 Agent 16/18/20/21；
12. 查找 Pull/Termination/Level Shifter；
13. 查找 Power Sequence/Back-power；
14. 查找 Connector/Cable/FPC；
15. 查找 Findings/Repairs/Waivers；
16. 查找 Baseline/Change；
17. 查找 UI/API/Worker/Storage/Security；
18. 统计 Endpoint Coverage；
19. 统计 Electrical Evidence Coverage；
20. 统计 Protocol/Role Conflicts；
21. 统计 Pinmux/Resource Conflicts；
22. 统计 Back-power Paths；
23. 统计 Connector/FPC Mapping Issues；
24. 抽样分析开源、合成、脱敏或授权 Fixture；
25. 在 docs/compatibility-implementation-plan.md 中生成实施计划；
26. 在 docs/input-and-readiness.md 中定义输入；
27. 在 docs/endpoint-and-domain-model.md 中定义 Endpoint；
28. 在 docs/protocol-and-role-compatibility.md 中定义协议；
29. 在 docs/voltage-and-drive-compatibility.md 中定义电平；
30. 在 docs/pulls-termination-and-default-state.md 中定义 Bias；
31. 在 docs/clock-reset-and-timing.md 中定义时序；
32. 在 docs/bandwidth-and-buffering.md 中定义带宽；
33. 在 docs/pinmux-and-resources.md 中定义资源；
34. 在 docs/power-backpower-and-isolation.md 中定义电源；
35. 在 docs/connector-cable-and-fpc.md 中定义物理连接；
36. 在 docs/findings-repairs-and-verification.md 中定义修复；
37. 在 docs/baselines-and-changes.md 中定义 Baseline；
38. 在 docs/downstream-agent-contracts.md 中定义下游；
39. 在 docs/ai-boundaries.md 中定义 AI；
40. 在 docs/security.md 中定义安全；
41. 在 docs/compatibility-migration-plan.md 中定义迁移；
42. 在 docs/compatibility-benchmark-plan.md 中定义 Benchmark；
43. 给出拟新增、拟修改和拟复用文件；
44. 给出 Phase 1 精确范围；
45. 不修改业务代码；
46. 不创建 Migration；
47. 不安装 Protocol/Graph/Simulation/模型组件；
48. 不修改 Architecture/Firmware/EDA；
49. 不触发 Agent 19–45；
50. 不冻结 Compatibility Baseline；
51. 不调用生产外部模型；
52. 不读取或打印 Secret/客户原理图/Pin Map；
53. 运行仓库已有 lint、type check、test、build 和 security scan；
54. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10–14 和下游 Contracts；
- Input Gate；
- Endpoint/Domain Model；
- Protocol Registry；
- Role/Direction；
- Voltage/Logic Margin；
- Drive/Load/Fan-out；
- Pull/Default/Termination；
- Clock/Reset/Timing；
- Bandwidth/Buffer；
- Pinmux/Resources；
- Firmware/EDA Readback；
- Power/Back-power/Isolation；
- Connector/Cable/FPC；
- Findings/Repairs；
- Verification；
- Decision/Baseline；
- Change/Feedback；
- AI Boundaries；
- Security；
- API/Events；
- 旧流程迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 102. 后续 Phase 提示词模板

```text
继续实现 Compatibility Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10–15 和相关下游 Agent 规格；
3. 阅读 Compatibility Implementation Plan；
4. 阅读 Endpoint、Protocol、Electrical、Bias、Timing、Bandwidth、Pinmux、Power、Physical、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Baseline-driven Compatibility；
- Typed Endpoints and Domains；
- Conditions/Modes/Variants；
- Deterministic Rules First；
- Evidence-grounded Results；
- Repair Candidate before Write；
- Immutable Baseline；
- No External Private Data；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Contract/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. electrical/protocol tests；
10. timing/bandwidth tests；
11. pinmux/power tests；
12. physical mapping tests；
13. downstream/baseline tests；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Rule/Protocol/Provider 变化；
- 测试命令和真实结果；
- Endpoints/Domains；
- Protocol/Role；
- Electrical/Drive；
- Pull/Termination；
- Timing/Bandwidth；
- Pinmux/Resources；
- Power/Back-power；
- Physical Mapping；
- Findings/Repairs；
- Verification/Baseline；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 103. MVP 演示流程

1. 使用便携式双通道测量仪项目；
2. Agent 12冻结 ADC + FPGA + MCU 架构；
3. Agent 13选择一个可复用采集核心；
4. Agent 14冻结 ADC、FPGA、MCU、LCD、USB、Power 和 Connector 主选器件；
5. Agent 15冻结 Input Snapshot；
6. 从 Agent 12建立接口端点：
7. ADC Data → FPGA；
8. MCU SPI → ADC Control；
9. FPGA FIFO → MCU；
10. MCU → LCD；
11. MCU USB → PC；
12. MCU I²C → Power Monitor；
13. USB-C → Power Path；
14. Battery → Charger；
15. Buttons/Encoder → MCU；
16. 从 Agent 14加载每个 Ordering Code 的 Pin、电平和接口数据；
17. 构建 Voltage Domains：
18. 5V USB；
19. Battery；
20. 3.3V Digital；
21. 1.8V FPGA Bank；
22. 1.2V FPGA Core；
23. Analog 5V；
24. 从 Agent 13加载模块连接器和 FPC；
25. 执行角色检查；
26. USB MCU 为 Device，PC 为 Host，通过；
27. SPI MCU 为 Controller，ADC 为 Peripheral，通过；
28. 执行电平检查；
29. MCU SPI 为 3.3V；
30. ADC Control I/O 为 1.8V；
31. 检测到负电平兼容结果；
32. 生成 Level Shifter Candidate；
33. 检查 ADC→FPGA 数据接口；
34. ADC 输出为 1.8V CMOS；
35. FPGA Bank 当前配置为 2.5V；
36. 检测 Bank Voltage Conflict；
37. 修复候选 A：将 FPGA Bank 改为 1.8V；
38. 修复候选 B：增加电平转换；
39. 根据高速时序和器件能力，A 被标记为优先候选但不自动批准；
40. 检查 I²C；
41. MCU 板有 4.7k 上拉；
42. Power Monitor 模块也有 4.7k 上拉；
43. LCD 模块还有 10k 上拉；
44. 计算等效上拉；
45. 检查总线电容、Rise Time 和 Sink Current；
46. 标记上拉过强候选；
47. 生成 Variant Population Candidate：仅保留主板上拉；
48. 检查 I²C 地址；
49. LCD Touch Controller 与 Power Monitor 地址冲突；
50. 修复候选：
51. 修改地址脚；
52. 使用第二个 I²C；
53. 增加 I²C Mux；
54. 检查 SPI MISO；
55. 两个从设备中一个在 CS 无效时不保证高阻；
56. 生成 Bus Switch 或独立 SPI 候选；
57. 检查 GPIO Drive；
58. 一个 Pin 同时驱动状态 LED 和 MOSFET Gate；
59. 直流电流满足，但启动边沿和默认态存在风险；
60. 标记 `default_state_unsafe`；
61. 建议独立 Pin 或 Gate Pulldown；
62. 检查 Boot Strap；
63. FPGA Mode Pin 与按钮共享；
64. 按钮按下上电会进入错误模式；
65. 标记 Critical Boot Strap Conflict；
66. 检查 MCU Pin Mux；
67. USB、晶振和两个 UART 候选产生 Pin 冲突；
68. Agent 21提供 Firmware Pin Map Candidate；
69. Agent 15输出可行 Pin Assignment 约束，但不直接修改 Firmware；
70. 检查 DMA；
71. ADC 数据搬运和 LCD 刷新使用同一 DMA Stream；
72. 标记 Resource Conflict；
73. 生成 DMA Remap 或任务调度候选；
74. 检查带宽；
75. 双通道 45 MSPS 数据进入 FPGA；
76. FPGA 只向 MCU传输抽取和显示数据；
77. 原始链路满足；
78. FPGA→MCU 的 SPI 标称速率看似满足平均值；
79. 加入协议开销、突发和 LCD 并发后余量不足；
80. 标记 Bandwidth Insufficient；
81. 候选：
82. 增加 FIFO；
83. 改用并行/高速接口；
84. 降低传输数据量；
85. 检查 Buffer；
86. 当前 FIFO 深度无法覆盖 USB 中断延迟；
87. 生成 FPGA Buffer Increase Candidate；
88. 检查 Clock；
89. ADC Clock 要求与晶振抖动数据缺失；
90. 标记 `needs_measurement_or_evidence`；
91. 检查 Reset；
92. ADC Reset 为 Active Low；
93. 原理图候选连接到 Active High Supervisor；
94. 标记 Reset Polarity Conflict；
95. 检查 USB-C；
96. Device 端 CC 电阻正确；
97. VBUS 被主板供电路径和调试口同时驱动；
98. 标记 Multiple Power Source Conflict；
99. 检查 Back-power；
100. 设备关机时，PC USB D+ 上拉和 I/O 可能通过 MCU 钳位反向供电；
101. 构建 Back-power Path；
102. 创建 USB Disconnect/Bus Switch Candidate；
103. 检查 FPC；
104. LCD FPC 和连接器 Pin 数、Pitch 相同；
105. 但两端都是 Top Contact，所选 FPC 是 Same-side；
106. 实际需要 Opposite-side；
107. 标记 FPC Orientation Mismatch；
108. 检查 Connector Pin 1；
109. 机械模型视角与原理图序号相反；
110. 输出 Pin Mapping 对比图；
111. Agent 28检查插拔方向和弯折；
112. 汇总 Findings；
113. Critical：
114. FPGA Boot Strap；
115. Multiple Power Source；
116. Reset Polarity；
117. Negative Logic Margin；
118. High：
119. I²C Address；
120. DMA Conflict；
121. Bandwidth；
122. FPC Orientation；
123. 生成 Repair Candidates；
124. Agent 12：调整接口和 Power Architecture；
125. Agent 14：确认 Level Shifter 或器件 Bank 选择；
126. Agent 21：Pin Mux、DMA 和 Driver；
127. Agent 19：原理图修改；
128. Agent 20：Pin 和 Footprint 验证；
129. Agent 23：电平、时序和负载仿真；
130. Agent 24/27：高速、终端和回流；
131. Agent 28：FPC 和 Connector；
132. Agent 11生成修复和验证任务；
133. 工程师批准修复方案；
134. Agent 19在隔离 Workspace 修改；
135. Agent 21更新 Firmware Config；
136. Agent 16/18重新解析；
137. Agent 15重新执行全量检查；
138. Bench Test 使用：
139. 示波器测量 Logic Margin 和上升时间；
140. Logic Analyzer 验证 SPI/I²C；
141. Power Sequence Capture；
142. Power-off Backfeed Current；
143. FPC Continuity；
144. 关键 Findings 关闭；
145. 冻结 Compatibility Baseline 1.0；
146. 下发 Agent 22–30；
147. 后续 MCU 备选切换；
148. Agent 14发出 Selection Change；
149. Agent 15只失效受影响的 Pin、Voltage、Firmware 和 Package Checks；
150. 重新检查后发现 Alternate 的一个 Pin 不具备 5V Tolerance；
151. 激活修复候选并创建 Baseline 1.1；
152. 保留 1.0。

---

# 104. 生产上线顺序

第一阶段：

```text
Endpoint and Domain Model
Protocol Role Checks
Voltage and Logic Margin
Pull-up/Pull-down
Basic Pin Mux
Connector Pin Mapping
Manual Review
```

第二阶段：

```text
Drive/Fan-out
Timing/Bandwidth/Buffer
Firmware Readback
Power Sequence/Back-power
Cable/FPC
Repair and Baseline
```

第三阶段：

```text
IBIS/CDC Integration
Automatic Adapter Candidates
Protocol Trace Import
Harness Generation
Product-line Compatibility
Measurement Correlation
```

上线优先确保：

```text
架构接口、器件 Pin、原理图 Net 和 Firmware 配置是否指向同一件事
电平判断是否使用保证阈值、真实负载、工作条件和供电状态
上拉下拉、默认状态和 Boot Strap 是否在所有模式下安全
带宽判断是否包含协议开销、突发、缓存和 DMA
多电源、关机接口和 Level Shifter 是否会产生反向供电
连接器和 FPC 是否不仅“插得上”，而且 Pin 1、方向和触点面完全一致
```

一个靠谱的兼容性 Agent，不是看到两端都写着 `SPI` 就点一个绿色对勾。它应该继续追问：谁是 Controller、Mode 几、多少伏、谁上拉、MISO 会不会高阻、时钟有多快、DMA 放哪、掉电后会不会反向供电，以及这根线穿过连接器之后 Pin 1 还在不在原来的那一边。
