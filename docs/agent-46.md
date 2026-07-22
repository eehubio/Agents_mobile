# LabSight 现场调试 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent / LabSight  
> Agent 编号：46  
> Agent 名称：LabSight Multimodal Field Debugging, Instrument Orchestration & Fault Evidence Agent  
> 中文名称：LabSight 现场调试 Agent  
> 类型：多模态混合型  
> 版本：V1.0  
>
> 定位：结合 LabSight 摄像头、麦克风、语音交互、示波器、逻辑分析仪、万用表、可编程电源、电子负载、频谱仪、串口日志、JTAG/SWD 调试、网络日志和项目设计数据，对现场接线、探头位置、焊点、器件方向、仪器设置、波形、协议、供电、启动过程、固件日志和故障现象进行同步采集、结构化、关联和分析；建立可回放的 Multimodal Debug Session、Evidence Timeline、Hypothesis Graph、Test Plan、Safety Gate 和 Repair Candidate；指导工程师执行低风险验证步骤，并将结论、证据、修复任务和回归结果回写 ezPLM。
>
> 本 Agent 不是“看到一张照片就直接报故障”的视觉问答工具，也不是只会读示波器截图的波形助手。它必须把：
>
> ```text
> 设计意图
> + 实际装配
> + 接线状态
> + 仪器配置
> + 测量结果
> + 固件状态
> + 时间顺序
> + 人工操作
> ```
>
> 组织成统一、可审计、可重复的工程证据链。
>
> 上游：
> - Agent 10：Requirement Baseline、Acceptance Criteria、Safety Constraint 和 Change
> - Agent 11：Debug Work Package、Owner、Priority、Milestone、Risk 和 Project Baseline
> - Agent 12：System Architecture、Block、Interface、Power Tree、Clock/Reset、Mode 和 Expected Behavior
> - Agent 13：Reference Design、Module Composition、Known-good Asset 和 Reuse Baseline
> - Agent 14：Component Selection、Ordering Code、Electrical Limits、Package、Errata 和 Selection Baseline
> - Agent 15：Interface、Voltage、Protocol、Pin Mux、Power、Connector、Compatibility Baseline 和 Known Risk
> - Agent 16：KiCad/EDA Canonical IR、Schematic、PCB、BOM、Net、Footprint、Pad、Test Point、Layer、3D 和 Source Map
> - Agent 18：Reviewed Netlist、Connectivity Graph、Interface Path 和 Ambiguity
> - Agent 20：Symbol、Footprint、Pin-Pad、3D、Pin Type、Package Variant 和 Library Validation
> - Agent 21：Firmware、BSP、Driver、Protocol、Logging、Debug Symbols、Pin Mux 和 Build Manifest
> - Agent 22：ERC Findings、Design Review Findings、Protection、Decoupling、Ratings 和 Open Questions
> - Agent 23：Expected Waveform、Simulation Result、Tolerance Envelope、Power-up Sequence 和 Fault Signature
> - Agent 24：PCB Constraints、Critical Nets、Test Access、Isolation、Creepage、High-speed 和 Measurement Constraints
> - Agent 25–28：Placement、Routing、DRC/SI/PI/EMC、3D/Mechanical/Assembly Findings
> - Agent 29：Manufacturing Release、BOM、CPL、Assembly Drawing、Revision 和 Build Variant
> - Agent 30：DFM/DFA、Assembly Risk、Solderability、Orientation、Panel 和 Process Findings
> - Agent 31–45：BOM、Supply、Lot、Traceability、NPI、Incoming/Production Test 和 Quality History
> - Lab Instruments：Camera、Microphone、Oscilloscope、Logic Analyzer、DMM、Power Supply、Electronic Load、Frequency Counter、Spectrum Analyzer、Protocol Analyzer、Thermal Camera、JTAG/SWD、Serial、Network Capture
> - Human Operator：现场工程师、技术员、测试员、远程专家
>
> 下游：
> - Agent 11：Debug Task、Owner、Priority、Dependency、ETA Candidate 和 Risk Update
> - Agent 12：Architecture Assumption、Mode、Interface 和 Fault Containment Change Candidate
> - Agent 13：Reference Design Gap、Module Fit 和 Reuse Risk Feedback
> - Agent 14：Component Reselection、Errata、Alternate Strategy 和 Sample Validation
> - Agent 15：Compatibility Recheck、Pin/Power/Protocol/Connector Repair
> - Agent 16/18/20：EDA Readback、Net/Pin/Library Correction
> - Agent 19：受控原理图、PCB、Library 或 Annotation 修改
> - Agent 21：Firmware Instrumentation、Logging、Pin Mux、Driver、Timing 和 Build Change
> - Agent 22/23/27：Review、Simulation、SI/PI/EMC 和 Waveform Correlation
> - Agent 28/30：Assembly、Mechanical、Solder、Connector 和 Process Correction
> - Agent 29：从修复后的正式工程重新生成生产文件
> - Agent 31–45：Lot/Material/Process/Quality/Traceability Closure
> - ezPLM：Issue、Evidence、Debug Session、Action Item、Change Request、Test Record、Knowledge Base 和 Release Gate
>
> 核心输出：
> - Debug Session Input Snapshot
> - Safety Context and Hazard Classification
> - Device and Instrument Capability Snapshot
> - Camera Calibration and Workbench Scene Model
> - Board/Assembly Identity and Revision Confirmation
> - Multimodal Evidence Timeline
> - Board-to-Schematic Spatial Registration
> - Visual Assembly Inspection Findings
> - Wiring and Connector Mapping Findings
> - Probe Placement and Measurement Context
> - Instrument Configuration Validation
> - Waveform and Measurement Evidence
> - Serial/JTAG/Network Log Evidence
> - Expected-vs-Observed Comparison
> - Symptom Normalization
> - Fault Signature Match Set
> - Hypothesis Graph
> - Test Plan and Step-by-step Guidance
> - Human Confirmation Requests
> - Repair Candidate Set
> - Verification and Regression Plan
> - Debug Decision Record
> - Debug Session Report
> - Root-cause Candidate and Confidence Dimensions
> - Knowledge Base Candidate
> - Downstream Work Packages
>
> 重要边界：
> - 不把单张图像、单段波形或单条日志当作根因证明。
> - 不把视觉识别到的器件丝印自动等同于 BOM 中的精确 Ordering Code。
> - 不在板卡身份、版本和 Variant 未确认前下结论。
> - 不把示波器截图中的刻度 OCR 结果视为可信数值来源；优先读取仪器原始元数据和波形。
> - 不把屏幕图像中的 Channel、Probe Ratio、Coupling、Bandwidth Limit、Trigger 和 Timebase 当作已知，必须从仪器 API 或人工确认。
> - 不把探头“看起来接在某点”当作已确认 Net，需结合 PCB 坐标、Test Point、视角和人工确认。
> - 不把万用表显示值脱离量程、模式、参考点、极性和测量时刻解释。
> - 不把串口乱码直接归因于波特率，必须考虑电平、接地、时钟、供电、复位和 Boot Mode。
> - 不把“板子不启动”直接归因于固件，必须先排除电源、复位、时钟、焊接、短路、装配和连接问题。
> - 不把波形异常直接归因于 PCB，必须考虑探头、接地弹簧、带宽限制、终端、负载和仪器设置。
> - 不自动改变电源电压、电流限值、电子负载、信号发生器幅度或输出状态。
> - 不自动建议或执行跨接电源、短接保护、移除保险丝、旁路隔离或关闭安全联锁。
> - 对市电、高压、储能、电池、激光、加热器、运动机构和大电流系统，必须进入强化 Safety Gate。
> - 不指导未授权人员测量危险节点。
> - 不自动焊接、返修、加电、改线、插拔或操作机械装置。
> - 仪器写操作必须经过设备能力确认、范围检查和人工批准。
> - AI 只能生成 Hypothesis、Explanation、Question 和 Test Candidate，不能伪造测量、波形、仪器配置或根因。
> - 根因状态必须区分：suspected、supported、verified、rejected、unknown。
> - 每条结论必须绑定 Evidence、Time、Instrument、Configuration、Operator、Board Revision、Firmware Build 和 Test Condition。
> - 私有原理图、BOM、固件、串口日志、客户产品画面和现场音视频不得发送到未批准的外部模型。
> - 所有摄像头、麦克风和日志采集必须遵循现场隐私、权限和留存策略。

---

# 1. Agent 46 的系统位置

```text
Design Baselines and Manufacturing History
                 ↓
LabSight Session Initialization
                 ↓
Board / Revision / Variant / Firmware Identity
                 ↓
Safety Gate and Instrument Capability Discovery
                 ↓
Camera + Audio + Instrument + Logs Synchronization
                 ↓
Scene / Board / Probe / Connector Registration
                 ↓
Observed Symptom and Evidence Timeline
                 ↓
Expected Behavior from Design and Simulation
                 ↓
Hypothesis Graph
                 ↓
Safe Test Plan
                 ↓
Human-guided Measurement and Intervention
                 ↓
Evidence Update and Hypothesis Ranking
                 ↓
Root-cause Decision / Repair Candidate
                 ↓
Regression / PLM Closure / Knowledge Reuse
```

---

# 2. 为什么需要独立 Agent 46

现场调试常见问题：

1. 工程师看到了异常，但没有记录仪器设置；
2. 示波器波形截图没有原始数据；
3. 探头接错测试点，导致错误判断；
4. 地线夹太长，制造了并不存在的振铃；
5. 万用表量程或模式错误；
6. 串口电平是 1.8V，却接到 3.3V USB-UART；
7. RX/TX、GND 或 Connector Pinout 接反；
8. 逻辑分析仪阈值设置不匹配；
9. 仪器通道 Probe Ratio 错误，幅值显示差十倍；
10. 电源电流限值太低，设备反复启动；
11. 板卡 Revision 和固件 Build 不匹配；
12. 焊点虚焊或器件反向，肉眼未注意；
13. 某个故障只在特定温度、姿态、负载或启动顺序出现；
14. 多个人调试，但操作和结论没有统一时间线；
15. 修复后没有执行回归；
16. 同类问题反复出现，却没有沉淀为可检索知识；
17. 远程专家只看到一张照片，无法理解现场上下文；
18. AI 根据一句“没有波形”就开始自由发挥；
19. 现场为了“先试一下”绕过保护，带来安全和二次损坏；
20. 设计数据、装配数据、测试数据和日志互相割裂。

Agent 46 的职责是：

```text
Capture
→ Align
→ Validate
→ Compare
→ Hypothesize
→ Test Safely
→ Verify
→ Close
```

---

# 3. 调试对象类型

```text
bare_pcb
assembled_pcb
module
multi_board_system
cable_harness
fixture
instrument
power_system
embedded_device
robotic_system
sensor_node
wireless_device
analog_frontend
digital_system
mixed_signal_system
```

---

# 4. Debug Session 类型

```text
bring_up
no_power
overcurrent
boot_failure
intermittent
communication_failure
analog_performance
timing_failure
emi_noise
thermal_failure
mechanical_connection
manufacturing_defect
field_return
production_escape
regression
remote_assistance
```

---

# 5. Session 生命周期

```text
CREATED
→ IDENTITY_PENDING
→ SAFETY_REVIEW
→ DEVICE_DISCOVERY
→ CALIBRATION
→ BASELINE_CAPTURE
→ OBSERVATION
→ HYPOTHESIS
→ TEST_PLANNING
→ HUMAN_APPROVAL
→ TEST_EXECUTION
→ EVIDENCE_REVIEW
→ ROOT_CAUSE_REVIEW
→ REPAIR_PLANNING
→ REGRESSION
→ CLOSURE_REVIEW
→ CLOSED
```

分支：

```text
BLOCKED_IDENTITY
BLOCKED_SAFETY
BLOCKED_DEVICE
BLOCKED_PERMISSION
BLOCKED_CALIBRATION
NEEDS_REMOTE_EXPERT
NEEDS_DESIGN_CHANGE
NEEDS_FIRMWARE_CHANGE
NEEDS_REWORK
NEEDS_MANUFACTURING_REVIEW
NEEDS_COMPONENT_RESELECTION
CANCELLED
FAILED
```

---

# 6. Board Identity

必须确认：

```text
project
product
board name
board revision
assembly revision
variant
serial number
lot
date code
manufacturing order
firmware build
bootloader version
configuration
calibration status
```

---

# 7. Identity Evidence

来源：

```text
QR/barcode
board silkscreen
EEPROM identity
firmware command
USB descriptor
serial log
manufacturing label
PLM lookup
manual confirmation
```

不同来源冲突时必须阻断自动推理。

---

# 8. Safety Context

```text
voltage class
available current
stored energy
battery chemistry
mains connected
isolation status
hot surface
moving mechanism
laser/radiation
chemical exposure
ESD sensitivity
flammability
operator qualification
PPE
emergency disconnect
```

---

# 9. Safety Level

```text
S0_low_energy_bench
S1_controlled_low_voltage
S2_high_current_or_battery
S3_high_voltage_or_mains
S4_special_hazard
```

---

# 10. Safety Gate

至少检查：

```text
operator authorization
DUT isolation
earth/reference strategy
current limit
fuse/protection
probe voltage rating
CAT rating
differential probe requirement
stored energy discharge
battery condition
thermal/moving hazard
emergency stop
instrument ground risk
```

---

# 11. 禁止自动化动作

```text
enable mains
increase hazardous voltage
disable current limit
short fuse
bypass isolation
bridge high-current path
remove safety cover
operate moving system near person
touch live conductor
connect grounded scope to floating high-side node
force firmware write without approval
```

---

# 12. Device Capability Discovery

每个设备发现：

```text
device id
vendor/model
connection
firmware version
driver version
supported channels
ranges
sample rates
memory depth
trigger modes
input impedance
grounding
write capabilities
streaming
timestamp support
calibration status
```

---

# 13. Device 类型

```text
rgb_camera
macro_camera
thermal_camera
depth_camera
microphone
oscilloscope
logic_analyzer
multimeter
power_supply
electronic_load
signal_generator
frequency_counter
spectrum_analyzer
protocol_analyzer
jtag_swd
serial_adapter
network_capture
programmable_fixture
```

---

# 14. Capability Contract

```json
{
  "device_id": "SCOPE-001",
  "device_type": "oscilloscope",
  "capabilities": {
    "channels": 4,
    "max_sample_rate": {},
    "input_ranges": [],
    "trigger_modes": [],
    "waveform_streaming": true,
    "hardware_timestamp": true
  },
  "write_policy": "human_approval_required",
  "calibration_status": "valid"
}
```

---

# 15. 时间同步

所有证据统一：

```text
session monotonic time
wall clock
device clock
capture start/end
latency estimate
clock offset
drift
synchronization quality
```

---

# 16. 同步方法

```text
hardware trigger
shared clock
PTP/NTP
serial marker
GPIO marker
audio/visual clap marker
software timestamp
manual event
```

---

# 17. Evidence Timeline

事件：

```text
operator_action
power_state_change
instrument_setting_change
camera_frame
audio_note
waveform_capture
logic_capture
dmm_reading
serial_line
debug_event
network_packet
thermal_frame
fault_event
repair_action
```

---

# 18. Evidence IR

```json
{
  "evidence_id": "EVID-001",
  "session_time": "12.384 s",
  "source_device_id": "SCOPE-001",
  "evidence_type": "waveform_capture",
  "configuration_snapshot_id": "CFG-001",
  "board_state": "booting",
  "mode": "active",
  "artifact_uri": "...",
  "artifact_hash": "...",
  "quality": {},
  "provenance": {},
  "status": "captured"
}
```

---

# 19. Camera Calibration

```text
intrinsics
distortion
focus range
working distance
field of view
color calibration
scale
lighting
camera pose
board plane
```

---

# 20. Board Registration

来源：

```text
board outline
fiducials
mounting holes
connectors
silkscreen references
test point positions
component courtyards
3D model
manual anchors
```

---

# 21. Spatial Registration 输出

```text
image pixel ↔ board XY
image region ↔ component/footprint
probe tip ↔ test point/net candidate
connector pin ↔ physical location
solder joint ↔ pad
```

---

# 22. Spatial Confidence

```text
board pose confidence
component localization confidence
probe tip confidence
occlusion
focus quality
lighting quality
scale confidence
manual confirmation
```

---

# 23. Visual Inspection

检查候选：

```text
missing component
wrong component candidate
wrong orientation
tombstone
skew
lifted pin
solder bridge
insufficient solder
excess solder
cold joint candidate
void candidate
damaged package
burn mark
contamination
connector not seated
cable reversed
jumper mismatch
test probe slip
foreign object
```

---

# 24. 视觉边界

- 2D RGB 无法可靠确认隐藏焊点、BGA 焊球和内部裂纹；
- 反光、助焊剂、阴影可能造成误判；
- 丝印识别不等于型号确认；
- 视觉检测结果必须标记 candidate；
- 关键焊接问题可要求显微镜、X-ray、AOI 或电气测量。

---

# 25. Wiring Model

```text
DUT connector
fixture connector
cable
adapter
instrument lead
probe
ground clip
power lead
load lead
serial adapter
debug probe
```

---

# 26. Wiring Check

```text
connector identity
mating compatibility
pin mapping
polarity
ground/reference
TX/RX
power source/sink
current path
cable direction
FPC contact side
jumper state
termination
shield
probe ground
```

---

# 27. Probe Placement

每个探头保存：

```text
instrument channel
probe type
probe ratio
tip location
ground location
net candidate
test point
maximum rating
bandwidth
loading
differential/single-ended
orientation
operator confirmation
```

---

# 28. Probe Placement Gate

检查：

```text
correct test point
safe voltage
safe common mode
ground loop risk
loading risk
bandwidth
probe ratio
tip stability
adjacent short risk
```

---

# 29. Oscilloscope Configuration

```text
channel enabled
probe ratio
coupling
input impedance
bandwidth limit
vertical scale
offset
timebase
sample rate
memory depth
acquisition mode
trigger source
trigger level
trigger type
averaging
math channels
reference waveform
```

---

# 30. Oscilloscope Setting Findings

```text
probe_ratio_mismatch
channel_clipped
sample_rate_too_low
memory_too_short
aliasing_risk
trigger_wrong_source
trigger_level_invalid
ac_coupling_hides_dc
bandwidth_limit_hides_edge
grounding_risk
vertical_scale_poor
timebase_poor
```

---

# 31. Waveform Evidence

保存：

```text
raw samples
time axis
voltage/current axis
channel metadata
probe metadata
trigger metadata
measurement functions
instrument state
capture hash
```

---

# 32. Waveform Features

```text
dc level
rms
peak
frequency
period
duty cycle
rise/fall
overshoot
undershoot
ringing
ripple
jitter
startup delay
pulse width
settling
dropout
glitch
```

---

# 33. Expected Waveform Envelope

来源：

```text
Agent 23 simulation
datasheet timing
reference design
known-good capture
acceptance criteria
manual engineering definition
```

---

# 34. Expected-vs-Observed

比较：

```text
value
tolerance
condition
mode
load
temperature
firmware build
measurement bandwidth
probe loading
time alignment
```

---

# 35. Logic Analyzer Configuration

```text
channels
threshold
sample rate
memory
pre/post trigger
trigger condition
protocol decoder
channel mapping
glitch filter
clock source
```

---

# 36. Logic Check

```text
channel mapping
logic threshold
sample rate
aliasing
setup/hold candidate
protocol decode
address
framing
CRC
retry
timeout
bus contention
idle level
boot sequence
```

---

# 37. Multimeter Context

```text
mode
range
auto/manual
input terminal
reference point
polarity
settling time
measurement time
device state
```

---

# 38. DMM Measurement 类型

```text
dc_voltage
ac_voltage
resistance
continuity
diode
current
capacitance
frequency
temperature
```

---

# 39. Power Supply Context

```text
output state
set voltage
current limit
measured voltage
measured current
OVP/OCP
ramp
remote sense
channel coupling
series/parallel mode
logging
```

---

# 40. Power-up Analysis

```text
input ramp
current profile
rail sequence
reset release
clock startup
boot log
interface activity
thermal response
fault shutdown
```

---

# 41. Current Signature

典型阶段：

```text
off
inrush
regulator startup
processor reset
bootloader
firmware initialization
active
sleep
fault/retry
```

---

# 42. Serial Log Context

```text
port
adapter
logic level
baud
data bits
parity
stop bits
flow control
timestamp
encoding
line ending
firmware build
boot mode
```

---

# 43. Log Parsing

支持：

```text
plain text
structured JSON
CSV
binary frames
syslog
RTT
SWO
JTAG console
bootloader output
kernel log
application trace
```

---

# 44. Log Evidence

提取：

```text
event
severity
module
code
timestamp
state transition
error stack
reset reason
watchdog
brownout
assert
protocol error
memory error
sensor fault
```

---

# 45. Audio and Voice

用途：

```text
operator narration
symptom description
action confirmation
remote expert conversation
acoustic fault
relay click
coil whine
motor noise
fan noise
alarm tone
```

---

# 46. Voice Command Boundary

语音可以：

```text
标记事件
请求截图
请求读取当前值
创建备注
开始/停止低风险采集
导航调试步骤
```

语音不能无确认执行：

```text
加电
升压
改变电流限值
启动负载
修改固件
切换危险继电器
```

---

# 47. Symptom IR

```json
{
  "symptom_id": "SYM-001",
  "symptom_type": "boot_loop",
  "observed_modes": ["startup"],
  "first_seen_time": "2.1 s",
  "frequency": "repeating",
  "conditions": {},
  "affected_functions": [],
  "evidence_ids": [],
  "operator_description": "...",
  "status": "observed"
}
```

---

# 48. Symptom Taxonomy

```text
no_power
overcurrent
rail_low
rail_noisy
rail_sequence
no_clock
reset_loop
boot_loop
firmware_crash
communication_timeout
protocol_error
analog_offset
noise
distortion
thermal_rise
intermittent_connection
mechanical_contact
solder_defect
wrong_component
wrong_orientation
configuration_error
instrument_error
unknown
```

---

# 49. Fault Signature

来源：

```text
historical debug sessions
production failures
reference design issues
datasheet errata
Agent 22 findings
Agent 23 simulation
supplier quality reports
field returns
manual expert knowledge
```

---

# 50. Hypothesis

```text
hypothesis statement
affected block/net/component
mechanism
supporting evidence
contradicting evidence
missing evidence
prior probability candidate
confidence dimensions
test candidates
status
```

---

# 51. Hypothesis 状态

```text
candidate
supported
weakly_supported
contradicted
rejected
verified
unknown
```

---

# 52. Hypothesis Graph

节点：

```text
symptom
hypothesis
fault mechanism
component
net
rail
clock
reset
firmware module
assembly defect
instrument issue
evidence
test
repair
```

边：

```text
supports
contradicts
causes
may_cause
observed_on
tests
rules_out
repaired_by
depends_on
```

---

# 53. 根因边界

只有满足：

```text
mechanism identified
evidence reproducible
alternative hypotheses sufficiently rejected
repair or controlled perturbation changes symptom
regression passes
```

才能标记 `verified`。

---

# 54. Test Candidate

```text
goal
hypothesis targeted
setup
instruments
probe points
safe ranges
procedure
expected outcomes
decision branches
evidence to capture
rollback
operator role
approval
```

---

# 55. Test Ranking

优先：

```text
safe
non-invasive
high information gain
low setup cost
fast
reversible
minimal state change
```

---

# 56. Test 类型

```text
visual_reinspection
continuity
resistance_unpowered
diode_check
current_limited_powerup
rail_measurement
clock_check
reset_check
serial_capture
logic_capture
waveform_capture
thermal_observation
connector_reseat
controlled_load
firmware_instrumentation
component_substitution
rework
```

---

# 57. Action Risk

```text
low
moderate
high
prohibited
```

---

# 58. Human Confirmation

必须确认：

```text
board identity
probe point
instrument ground
power limit
expected action
hazard
state-changing operation
repair
firmware flash
component replacement
```

---

# 59. Instrument Command Policy

```text
read_only_auto
low_risk_capture_auto
write_with_confirmation
high_risk_manual_only
prohibited
```

---

# 60. Repair Candidate

```text
rewire
reseat
clean
reflow_candidate
resolder_candidate
replace_component
correct_orientation
change_pull
change_termination
change_power_limit
change_instrument_setting
change_firmware_config
change_pinmux
change_driver
change_clock
change_reset
design_change
process_change
```

---

# 61. Repair Verification

```text
symptom no longer present
target measurement passes
no new fault introduced
regression tests pass
thermal/current normal
interface stable
restart repeatable
multiple samples optional
```

---

# 62. Debug Knowledge Candidate

```text
problem signature
board/revision scope
root cause
evidence pattern
test sequence
repair
prevention
affected lots
design/process links
confidence
approval
```

---

# 63. Privacy Model

可能采集：

```text
people
voices
workbench
customer product
screen
serial logs
network data
location
labels
credentials
```

必须支持：

```text
recording indicator
consent
face/background masking
audio redaction
secret redaction
retention policy
export control
project ACL
```

---

# 64. AI 允许职责

```text
识别视觉候选
理解语音和自然语言症状
总结波形和日志
生成 Hypothesis Candidate
生成 Test Candidate
解释 Evidence
生成远程协作摘要
生成 Debug Report 草稿
```

---

# 65. AI 禁止职责

```text
伪造测量
编造仪器设置
自动判定危险操作安全
自动执行高风险命令
自动确认探头位置
自动批准返修
自动宣布根因 verified
隐藏矛盾证据
```

---

# 66. Finding 类型

```text
identity_mismatch
variant_mismatch
firmware_mismatch
unsafe_setup
instrument_ground_risk
probe_location_uncertain
probe_ratio_mismatch
instrument_range_invalid
instrument_configuration_invalid
wiring_mismatch
connector_mapping_mismatch
component_missing_candidate
component_orientation_candidate
solder_bridge_candidate
solder_joint_candidate
rail_missing
rail_out_of_range
overcurrent
power_sequence_mismatch
clock_missing
clock_out_of_spec
reset_abnormal
waveform_out_of_envelope
protocol_decode_error
serial_configuration_mismatch
log_fault
thermal_anomaly
intermittent_candidate
evidence_conflict
root_cause_unverified
```

---

# 67. Severity

```text
critical
high
medium
low
info
```

---

# 68. Confidence Dimensions

```text
identity confidence
spatial confidence
instrument metadata confidence
measurement quality
time synchronization
design-data freshness
model confidence
human confirmation
repeatability
alternative-hypothesis coverage
```

---

# 69. Session Gate

## Ready to Observe

```text
identity confirmed
safety gate passed
devices discovered
camera calibrated or manual mode
time synchronization sufficient
```

## Ready to Execute Test

```text
test procedure defined
risk classified
instrument ranges valid
probe points confirmed
operator approved
rollback available
```

## Ready to Close Root Cause

```text
root cause verified or explicitly unresolved
repair evidence captured
regression passed
findings dispositioned
knowledge candidate reviewed
```

---

# 70. 错误码

```text
PROJECT_NOT_FOUND
BOARD_IDENTITY_UNRESOLVED
BOARD_REVISION_CONFLICT
VARIANT_CONFLICT
FIRMWARE_BUILD_UNRESOLVED
SAFETY_CONTEXT_INCOMPLETE
SAFETY_GATE_BLOCKED
OPERATOR_NOT_AUTHORIZED
DEVICE_NOT_FOUND
DEVICE_CAPABILITY_UNKNOWN
DEVICE_CALIBRATION_INVALID
DEVICE_PERMISSION_DENIED
TIME_SYNC_INSUFFICIENT
CAMERA_CALIBRATION_FAILED
BOARD_REGISTRATION_FAILED
PROBE_LOCATION_UNRESOLVED
PROBE_RATING_INSUFFICIENT
INSTRUMENT_GROUND_RISK
INSTRUMENT_CONFIGURATION_INVALID
WAVEFORM_METADATA_MISSING
LOG_CONFIGURATION_MISSING
WIRING_MAPPING_UNRESOLVED
CONNECTOR_IDENTITY_UNRESOLVED
EVIDENCE_CONFLICT
EXPECTED_BEHAVIOR_MISSING
HYPOTHESIS_NOT_SUPPORTED
TEST_PLAN_INCOMPLETE
HUMAN_CONFIRMATION_REQUIRED
ACTION_RISK_BLOCKED
REPAIR_APPROVAL_REQUIRED
REGRESSION_INCOMPLETE
ROOT_CAUSE_UNVERIFIED
PRIVACY_POLICY_BLOCKED
EXTERNAL_MODEL_POLICY_BLOCKED
SESSION_CANCELLED
INTERNAL_ERROR


---

# 71. 数据库设计

## 71.1 `labsight_debug_sessions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
work_package_id UUID NULL
board_id UUID NULL
board_revision_id UUID NULL
assembly_revision_id UUID NULL
variant_id UUID NULL
serial_number VARCHAR NULL
manufacturing_lot_id UUID NULL
firmware_build_id UUID NULL
session_type VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
safety_level VARCHAR NOT NULL
operator_id UUID NOT NULL
remote_expert_ids JSONB NOT NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
closed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 71.2 `labsight_input_snapshots`

```text
id UUID PK
session_id UUID NOT NULL
requirement_baseline_hash CHAR(64) NULL
architecture_baseline_hash CHAR(64) NULL
reuse_baseline_hash CHAR(64) NULL
selection_baseline_hash CHAR(64) NULL
compatibility_baseline_hash CHAR(64) NULL
eda_revision_hash CHAR(64) NULL
firmware_build_hash CHAR(64) NULL
manufacturing_release_hash CHAR(64) NULL
quality_history_hash CHAR(64) NULL
instrument_registry_hash CHAR(64) NOT NULL
safety_policy_hash CHAR(64) NOT NULL
debug_profile_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, snapshot_hash)
```

## 71.3 `labsight_debug_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
session_type_scope JSONB NOT NULL
required_identity_sources JSONB NOT NULL
required_safety_checks JSONB NOT NULL
required_devices JSONB NOT NULL
evidence_policy JSONB NOT NULL
hypothesis_policy JSONB NOT NULL
test_policy JSONB NOT NULL
instrument_command_policy JSONB NOT NULL
privacy_policy JSONB NOT NULL
retention_policy JSONB NOT NULL
approval_policy JSONB NOT NULL
effective_from DATE NOT NULL
effective_to DATE NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 71.4 `labsight_board_identity_observations`

```text
id UUID PK
session_id UUID NOT NULL
observation_key VARCHAR NOT NULL
identity_source VARCHAR NOT NULL
observed_project_ref JSONB NULL
observed_board_name VARCHAR NULL
observed_board_revision VARCHAR NULL
observed_assembly_revision VARCHAR NULL
observed_variant VARCHAR NULL
observed_serial_number VARCHAR NULL
observed_lot VARCHAR NULL
observed_firmware_build JSONB NULL
artifact_id UUID NULL
source_location JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, observation_key)
```

## 71.5 `labsight_identity_resolutions`

```text
id UUID PK
session_id UUID NOT NULL
resolution_version INT NOT NULL
resolved_identity JSONB NOT NULL
source_observation_ids JSONB NOT NULL
conflicts JSONB NOT NULL
manual_confirmation JSONB NULL
resolution_status VARCHAR NOT NULL
resolution_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, resolution_version)
```

## 71.6 `labsight_safety_contexts`

```text
id UUID PK
session_id UUID NOT NULL
voltage_class VARCHAR NOT NULL
maximum_voltage JSONB NULL
available_current JSONB NULL
stored_energy JSONB NULL
battery_context JSONB NOT NULL
mains_context JSONB NOT NULL
isolation_context JSONB NOT NULL
thermal_context JSONB NOT NULL
motion_context JSONB NOT NULL
optical_context JSONB NOT NULL
chemical_context JSONB NOT NULL
esd_context JSONB NOT NULL
operator_qualification JSONB NOT NULL
ppe_context JSONB NOT NULL
emergency_disconnect JSONB NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id)
```

## 71.7 `labsight_safety_gate_runs`

```text
id UUID PK
session_id UUID NOT NULL
gate_version INT NOT NULL
policy_version VARCHAR NOT NULL
check_results JSONB NOT NULL
blocked_actions JSONB NOT NULL
allowed_action_classes JSONB NOT NULL
required_confirmations JSONB NOT NULL
required_operator_roles JSONB NOT NULL
result VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, gate_version)
```

## 71.8 `labsight_device_registry`

```text
id UUID PK
tenant_id UUID NOT NULL
device_key VARCHAR NOT NULL
device_type VARCHAR NOT NULL
vendor VARCHAR NULL
model VARCHAR NULL
serial_number VARCHAR NULL
connection_type VARCHAR NOT NULL
connection_reference JSONB NOT NULL
firmware_version VARCHAR NULL
driver_version VARCHAR NULL
security_classification VARCHAR NOT NULL
ownership_scope VARCHAR NOT NULL
calibration_status VARCHAR NOT NULL
calibration_due_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(tenant_id, device_key)
```

## 71.9 `labsight_device_capability_snapshots`

```text
id UUID PK
session_id UUID NOT NULL
device_id UUID NOT NULL
discovery_provider VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
connection_state VARCHAR NOT NULL
capabilities JSONB NOT NULL
limits JSONB NOT NULL
write_capabilities JSONB NOT NULL
timestamp_capabilities JSONB NOT NULL
streaming_capabilities JSONB NOT NULL
calibration_context JSONB NOT NULL
raw_snapshot_uri TEXT NOT NULL
raw_snapshot_hash CHAR(64) NOT NULL
captured_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
UNIQUE(session_id, device_id)
```

## 71.10 `labsight_device_permissions`

```text
id UUID PK
session_id UUID NOT NULL
device_id UUID NOT NULL
operator_id UUID NOT NULL
read_permission BOOLEAN NOT NULL
capture_permission BOOLEAN NOT NULL
write_permission BOOLEAN NOT NULL
high_risk_permission BOOLEAN NOT NULL
allowed_command_classes JSONB NOT NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NULL
approval_reference JSONB NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, device_id, operator_id)
```

## 71.11 `labsight_time_sync_runs`

```text
id UUID PK
session_id UUID NOT NULL
sync_version INT NOT NULL
method VARCHAR NOT NULL
reference_clock VARCHAR NOT NULL
device_offsets JSONB NOT NULL
drift_estimates JSONB NOT NULL
latency_estimates JSONB NOT NULL
quality_vector JSONB NOT NULL
marker_evidence_ids JSONB NOT NULL
result VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, sync_version)
```

## 71.12 `labsight_camera_calibrations`

```text
id UUID PK
session_id UUID NOT NULL
device_id UUID NOT NULL
calibration_version INT NOT NULL
intrinsics JSONB NOT NULL
distortion JSONB NOT NULL
focus_context JSONB NOT NULL
working_distance JSONB NOT NULL
field_of_view JSONB NOT NULL
color_context JSONB NOT NULL
lighting_context JSONB NOT NULL
camera_pose JSONB NOT NULL
calibration_artifacts JSONB NOT NULL
quality_vector JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, device_id, calibration_version)
```

## 71.13 `labsight_board_registrations`

```text
id UUID PK
session_id UUID NOT NULL
camera_device_id UUID NOT NULL
registration_version INT NOT NULL
board_revision_id UUID NOT NULL
board_plane JSONB NOT NULL
image_to_board_transform JSONB NOT NULL
anchor_points JSONB NOT NULL
fiducial_matches JSONB NOT NULL
component_matches JSONB NOT NULL
occlusion_map JSONB NOT NULL
quality_vector JSONB NOT NULL
manual_adjustments JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, camera_device_id, registration_version)
```

## 71.14 `labsight_scene_objects`

```text
id UUID PK
session_id UUID NOT NULL
scene_object_key VARCHAR NOT NULL
object_type VARCHAR NOT NULL
object_identity JSONB NOT NULL
board_object_ref JSONB NULL
image_region JSONB NOT NULL
board_region JSONB NULL
pose JSONB NULL
visibility JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
source_evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, scene_object_key)
```

## 71.15 `labsight_probe_placements`

```text
id UUID PK
session_id UUID NOT NULL
placement_key VARCHAR NOT NULL
instrument_device_id UUID NOT NULL
instrument_channel VARCHAR NOT NULL
probe_type VARCHAR NOT NULL
probe_ratio JSONB NOT NULL
probe_rating JSONB NOT NULL
tip_scene_object_id UUID NULL
ground_scene_object_id UUID NULL
tip_board_location JSONB NULL
ground_board_location JSONB NULL
net_candidates JSONB NOT NULL
test_point_candidates JSONB NOT NULL
loading_model JSONB NOT NULL
operator_confirmation JSONB NULL
safety_status VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, placement_key)
```

## 71.16 `labsight_wiring_elements`

```text
id UUID PK
session_id UUID NOT NULL
wiring_key VARCHAR NOT NULL
wiring_type VARCHAR NOT NULL
source_endpoint_ref JSONB NULL
destination_endpoint_ref JSONB NULL
connector_refs JSONB NOT NULL
pin_mapping JSONB NOT NULL
polarity JSONB NOT NULL
reference_ground JSONB NULL
cable_attributes JSONB NOT NULL
instrument_channel JSONB NULL
visual_evidence_ids JSONB NOT NULL
manual_confirmation JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, wiring_key)
```

## 71.17 `labsight_instrument_configuration_snapshots`

```text
id UUID PK
session_id UUID NOT NULL
device_id UUID NOT NULL
configuration_version INT NOT NULL
configuration JSONB NOT NULL
read_method VARCHAR NOT NULL
raw_response_uri TEXT NULL
raw_response_hash CHAR(64) NULL
operator_confirmation JSONB NULL
validity_start_session_time NUMERIC NOT NULL
validity_end_session_time NUMERIC NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, device_id, configuration_version)
```

## 71.18 `labsight_instrument_command_requests`

```text
id UUID PK
session_id UUID NOT NULL
device_id UUID NOT NULL
request_key VARCHAR NOT NULL
command_class VARCHAR NOT NULL
command_ir JSONB NOT NULL
risk_level VARCHAR NOT NULL
preconditions JSONB NOT NULL
expected_effect JSONB NOT NULL
rollback JSONB NOT NULL
requested_by UUID NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
execution_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, request_key)
```

## 71.19 `labsight_instrument_command_executions`

```text
id UUID PK
command_request_id UUID NOT NULL
provider_name VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
pre_configuration_snapshot_id UUID NULL
post_configuration_snapshot_id UUID NULL
raw_request_hash CHAR(64) NOT NULL
raw_response_hash CHAR(64) NULL
execution_result JSONB NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 71.20 `labsight_evidence_artifacts`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
session_id UUID NOT NULL
artifact_key VARCHAR NOT NULL
evidence_type VARCHAR NOT NULL
source_device_id UUID NULL
media_type VARCHAR NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
size_bytes BIGINT NOT NULL
capture_start_session_time NUMERIC NOT NULL
capture_end_session_time NUMERIC NULL
configuration_snapshot_id UUID NULL
board_state JSONB NOT NULL
conditions JSONB NOT NULL
quality_vector JSONB NOT NULL
privacy_classification VARCHAR NOT NULL
redaction_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, artifact_key)
```

## 71.21 `labsight_timeline_events`

```text
id UUID PK
session_id UUID NOT NULL
event_key VARCHAR NOT NULL
event_type VARCHAR NOT NULL
session_time NUMERIC NOT NULL
wall_time TIMESTAMPTZ NULL
duration JSONB NULL
source_device_id UUID NULL
operator_id UUID NULL
artifact_ids JSONB NOT NULL
related_object_refs JSONB NOT NULL
event_payload JSONB NOT NULL
time_sync_quality JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, event_key)
```

## 71.22 `labsight_visual_findings`

```text
id UUID PK
session_id UUID NOT NULL
finding_key VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
scene_object_ids JSONB NOT NULL
board_object_refs JSONB NOT NULL
image_region JSONB NOT NULL
observed_attributes JSONB NOT NULL
expected_attributes JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
human_review_status VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, finding_key)
```

## 71.23 `labsight_measurement_records`

```text
id UUID PK
session_id UUID NOT NULL
measurement_key VARCHAR NOT NULL
measurement_type VARCHAR NOT NULL
source_device_id UUID NOT NULL
channel_or_terminal JSONB NOT NULL
probe_placement_id UUID NULL
configuration_snapshot_id UUID NOT NULL
value JSONB NULL
statistics JSONB NOT NULL
conditions JSONB NOT NULL
session_time NUMERIC NOT NULL
evidence_artifact_ids JSONB NOT NULL
quality_vector JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, measurement_key)
```

## 71.24 `labsight_waveform_records`

```text
id UUID PK
session_id UUID NOT NULL
waveform_key VARCHAR NOT NULL
source_device_id UUID NOT NULL
channel_map JSONB NOT NULL
configuration_snapshot_id UUID NOT NULL
probe_placement_ids JSONB NOT NULL
sample_metadata JSONB NOT NULL
trigger_context JSONB NOT NULL
raw_artifact_id UUID NOT NULL
derived_feature_artifact_id UUID NULL
feature_summary JSONB NOT NULL
quality_vector JSONB NOT NULL
session_time_range JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, waveform_key)
```

## 71.25 `labsight_logic_capture_records`

```text
id UUID PK
session_id UUID NOT NULL
capture_key VARCHAR NOT NULL
source_device_id UUID NOT NULL
channel_map JSONB NOT NULL
configuration_snapshot_id UUID NOT NULL
threshold_context JSONB NOT NULL
sample_metadata JSONB NOT NULL
trigger_context JSONB NOT NULL
decoder_context JSONB NOT NULL
raw_artifact_id UUID NOT NULL
decoded_artifact_id UUID NULL
decode_summary JSONB NOT NULL
quality_vector JSONB NOT NULL
session_time_range JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, capture_key)
```

## 71.26 `labsight_log_sources`

```text
id UUID PK
session_id UUID NOT NULL
log_source_key VARCHAR NOT NULL
source_type VARCHAR NOT NULL
device_id UUID NULL
port_or_endpoint JSONB NOT NULL
transport_context JSONB NOT NULL
format_context JSONB NOT NULL
firmware_build_id UUID NULL
time_sync_context JSONB NOT NULL
redaction_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, log_source_key)
```

## 71.27 `labsight_log_events`

```text
id UUID PK
session_id UUID NOT NULL
log_source_id UUID NOT NULL
event_key VARCHAR NOT NULL
session_time NUMERIC NULL
source_time JSONB NULL
severity VARCHAR NULL
module VARCHAR NULL
event_code VARCHAR NULL
event_type VARCHAR NOT NULL
message_redacted TEXT NULL
structured_payload JSONB NOT NULL
raw_artifact_id UUID NULL
related_object_refs JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, event_key)
```

## 71.28 `labsight_audio_transcripts`

```text
id UUID PK
session_id UUID NOT NULL
artifact_id UUID NOT NULL
language VARCHAR NOT NULL
speaker_segments JSONB NOT NULL
transcript_redacted TEXT NOT NULL
action_markers JSONB NOT NULL
technical_terms JSONB NOT NULL
privacy_redactions JSONB NOT NULL
model_context JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.29 `labsight_symptoms`

```text
id UUID PK
session_id UUID NOT NULL
symptom_key VARCHAR NOT NULL
symptom_type VARCHAR NOT NULL
description TEXT NOT NULL
first_seen_session_time NUMERIC NULL
last_seen_session_time NUMERIC NULL
frequency_context JSONB NOT NULL
mode_scope JSONB NOT NULL
condition_context JSONB NOT NULL
affected_function_refs JSONB NOT NULL
affected_object_refs JSONB NOT NULL
evidence_ids JSONB NOT NULL
operator_statement_refs JSONB NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, symptom_key)
```

## 71.30 `labsight_expected_behavior_records`

```text
id UUID PK
session_id UUID NOT NULL
behavior_key VARCHAR NOT NULL
behavior_type VARCHAR NOT NULL
target_object_refs JSONB NOT NULL
expected_value_or_pattern JSONB NOT NULL
tolerance_envelope JSONB NOT NULL
conditions JSONB NOT NULL
mode_scope JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
evidence_quality JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, behavior_key)
```

## 71.31 `labsight_observation_comparisons`

```text
id UUID PK
session_id UUID NOT NULL
comparison_key VARCHAR NOT NULL
expected_behavior_id UUID NOT NULL
observed_evidence_ids JSONB NOT NULL
alignment_context JSONB NOT NULL
condition_comparison JSONB NOT NULL
result VARCHAR NOT NULL
difference_metrics JSONB NOT NULL
uncertainty JSONB NOT NULL
explanation_trace JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, comparison_key)
```

## 71.32 `labsight_fault_signatures`

```text
id UUID PK
tenant_id UUID NULL
signature_key VARCHAR NOT NULL
signature_version VARCHAR NOT NULL
product_scope JSONB NOT NULL
board_scope JSONB NOT NULL
symptom_patterns JSONB NOT NULL
measurement_patterns JSONB NOT NULL
log_patterns JSONB NOT NULL
visual_patterns JSONB NOT NULL
condition_scope JSONB NOT NULL
root_cause_candidates JSONB NOT NULL
recommended_tests JSONB NOT NULL
evidence_quality JSONB NOT NULL
source_references JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(signature_key, signature_version)
```

## 71.33 `labsight_signature_match_runs`

```text
id UUID PK
session_id UUID NOT NULL
run_version INT NOT NULL
signature_registry_hash CHAR(64) NOT NULL
input_symptom_ids JSONB NOT NULL
input_evidence_ids JSONB NOT NULL
matches JSONB NOT NULL
negative_matches JSONB NOT NULL
explanation_trace JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, run_version)
```

## 71.34 `labsight_hypotheses`

```text
id UUID PK
session_id UUID NOT NULL
hypothesis_key VARCHAR NOT NULL
statement TEXT NOT NULL
mechanism TEXT NOT NULL
affected_object_refs JSONB NOT NULL
supporting_evidence_ids JSONB NOT NULL
contradicting_evidence_ids JSONB NOT NULL
missing_evidence JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
prior_context JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, hypothesis_key)
```

## 71.35 `labsight_hypothesis_edges`

```text
id UUID PK
session_id UUID NOT NULL
source_hypothesis_id UUID NOT NULL
target_object_ref JSONB NOT NULL
edge_type VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
strength JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 71.36 `labsight_test_plans`

```text
id UUID PK
session_id UUID NOT NULL
plan_key VARCHAR NOT NULL
plan_version INT NOT NULL
goal TEXT NOT NULL
target_hypothesis_ids JSONB NOT NULL
ordered_test_step_ids JSONB NOT NULL
risk_summary JSONB NOT NULL
required_devices JSONB NOT NULL
required_operator_roles JSONB NOT NULL
expected_information_gain JSONB NOT NULL
rollback_strategy JSONB NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, plan_key, plan_version)
```

## 71.37 `labsight_test_steps`

```text
id UUID PK
test_plan_id UUID NOT NULL
step_key VARCHAR NOT NULL
step_order INT NOT NULL
step_type VARCHAR NOT NULL
instruction TEXT NOT NULL
setup JSONB NOT NULL
instrument_commands JSONB NOT NULL
probe_requirements JSONB NOT NULL
safe_ranges JSONB NOT NULL
preconditions JSONB NOT NULL
expected_outcomes JSONB NOT NULL
decision_branches JSONB NOT NULL
evidence_requirements JSONB NOT NULL
rollback JSONB NOT NULL
risk_level VARCHAR NOT NULL
confirmation_required BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(test_plan_id, step_key)
```

## 71.38 `labsight_test_step_executions`

```text
id UUID PK
test_step_id UUID NOT NULL
session_id UUID NOT NULL
execution_version INT NOT NULL
operator_id UUID NOT NULL
confirmation_record JSONB NULL
pre_state JSONB NOT NULL
actions JSONB NOT NULL
evidence_ids JSONB NOT NULL
observed_outcome JSONB NOT NULL
decision_branch_taken JSONB NULL
post_state JSONB NOT NULL
result VARCHAR NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 71.39 `labsight_human_confirmations`

```text
id UUID PK
session_id UUID NOT NULL
confirmation_key VARCHAR NOT NULL
confirmation_type VARCHAR NOT NULL
prompt TEXT NOT NULL
context JSONB NOT NULL
risk_level VARCHAR NOT NULL
requested_from UUID NOT NULL
response VARCHAR NULL
response_payload JSONB NULL
responded_at TIMESTAMPTZ NULL
expires_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, confirmation_key)
```

## 71.40 `labsight_debug_findings`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
session_id UUID NOT NULL
finding_key VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
affected_object_refs JSONB NOT NULL
symptom_ids JSONB NOT NULL
evidence_ids JSONB NOT NULL
actual JSONB NOT NULL
expected JSONB NOT NULL
condition_context JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
owner_role VARCHAR NULL
required_before_gate VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, finding_key)
```

## 71.41 `labsight_repair_candidates`

```text
id UUID PK
session_id UUID NOT NULL
repair_key VARCHAR NOT NULL
repair_type VARCHAR NOT NULL
finding_ids JSONB NOT NULL
hypothesis_ids JSONB NOT NULL
affected_objects JSONB NOT NULL
proposed_change JSONB NOT NULL
technical_rationale TEXT NOT NULL
risk_level VARCHAR NOT NULL
required_agents JSONB NOT NULL
required_operator_roles JSONB NOT NULL
verification_plan JSONB NOT NULL
rollback_plan JSONB NOT NULL
cost_schedule_candidate JSONB NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, repair_key)
```

## 71.42 `labsight_repair_executions`

```text
id UUID PK
repair_candidate_id UUID NOT NULL
session_id UUID NOT NULL
operator_id UUID NOT NULL
execution_method VARCHAR NOT NULL
pre_state JSONB NOT NULL
action_record JSONB NOT NULL
evidence_ids JSONB NOT NULL
post_state JSONB NOT NULL
result VARCHAR NOT NULL
approved_by UUID NOT NULL
executed_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 71.43 `labsight_regression_plans`

```text
id UUID PK
session_id UUID NOT NULL
plan_version INT NOT NULL
repair_candidate_ids JSONB NOT NULL
affected_requirement_ids JSONB NOT NULL
affected_function_ids JSONB NOT NULL
test_case_refs JSONB NOT NULL
power_checks JSONB NOT NULL
interface_checks JSONB NOT NULL
firmware_checks JSONB NOT NULL
thermal_checks JSONB NOT NULL
manufacturing_checks JSONB NOT NULL
repeatability_requirements JSONB NOT NULL
sample_requirements JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, plan_version)
```

## 71.44 `labsight_regression_runs`

```text
id UUID PK
regression_plan_id UUID NOT NULL
run_version INT NOT NULL
board_identity_snapshot JSONB NOT NULL
firmware_build_id UUID NULL
test_results JSONB NOT NULL
evidence_ids JSONB NOT NULL
repeatability_result JSONB NOT NULL
new_findings JSONB NOT NULL
result VARCHAR NOT NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 71.45 `labsight_root_cause_records`

```text
id UUID PK
session_id UUID NOT NULL
root_cause_key VARCHAR NOT NULL
root_cause_type VARCHAR NOT NULL
statement TEXT NOT NULL
mechanism TEXT NOT NULL
verified_hypothesis_ids JSONB NOT NULL
rejected_hypothesis_ids JSONB NOT NULL
supporting_evidence_ids JSONB NOT NULL
repair_execution_ids JSONB NOT NULL
regression_run_ids JSONB NOT NULL
alternative_coverage JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
verification_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, root_cause_key)
```

## 71.46 `labsight_debug_decision_records`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
session_id UUID NOT NULL
decision_key VARCHAR NOT NULL
selected_root_cause_ids JSONB NOT NULL
accepted_repair_ids JSONB NOT NULL
rejected_repair_ids JSONB NOT NULL
accepted_risk_ids JSONB NOT NULL
unresolved_questions JSONB NOT NULL
required_design_changes JSONB NOT NULL
required_firmware_changes JSONB NOT NULL
required_process_changes JSONB NOT NULL
required_quality_actions JSONB NOT NULL
approval_manifest JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, decision_key)
```

## 71.47 `labsight_debug_reports`

```text
id UUID PK
session_id UUID NOT NULL
report_version INT NOT NULL
identity_summary JSONB NOT NULL
safety_summary JSONB NOT NULL
setup_summary JSONB NOT NULL
timeline_summary JSONB NOT NULL
symptom_summary JSONB NOT NULL
evidence_summary JSONB NOT NULL
hypothesis_summary JSONB NOT NULL
test_summary JSONB NOT NULL
repair_summary JSONB NOT NULL
regression_summary JSONB NOT NULL
root_cause_summary JSONB NOT NULL
unresolved_summary JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, report_version)
```

## 71.48 `labsight_knowledge_candidates`

```text
id UUID PK
tenant_id UUID NOT NULL
session_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
problem_signature JSONB NOT NULL
product_scope JSONB NOT NULL
board_scope JSONB NOT NULL
root_cause_summary JSONB NOT NULL
evidence_pattern JSONB NOT NULL
recommended_test_sequence JSONB NOT NULL
repair_summary JSONB NOT NULL
prevention_summary JSONB NOT NULL
lot_scope JSONB NOT NULL
design_process_links JSONB NOT NULL
privacy_review JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(session_id, candidate_key)
```

## 71.49 `labsight_downstream_work_packages`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
session_id UUID NOT NULL
work_package_key VARCHAR NOT NULL
work_package_type VARCHAR NOT NULL
target_agent VARCHAR NULL
title VARCHAR NOT NULL
scope JSONB NOT NULL
affected_objects JSONB NOT NULL
dependencies JSONB NOT NULL
owner_role VARCHAR NOT NULL
priority VARCHAR NOT NULL
estimate_candidate JSONB NULL
input_gate JSONB NOT NULL
expected_outputs JSONB NOT NULL
verification_requirements JSONB NOT NULL
artifact_refs JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, work_package_key)
```

## 71.50 `labsight_privacy_redactions`

```text
id UUID PK
session_id UUID NOT NULL
artifact_id UUID NOT NULL
redaction_type VARCHAR NOT NULL
source_region_or_span JSONB NOT NULL
redacted_artifact_uri TEXT NOT NULL
redacted_artifact_hash CHAR(64) NOT NULL
policy_version VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 71.51 `labsight_session_audit_events`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
session_id UUID NOT NULL
actor_id UUID NULL
actor_type VARCHAR NOT NULL
action VARCHAR NOT NULL
object_type VARCHAR NOT NULL
object_id UUID NULL
before_hash CHAR(64) NULL
after_hash CHAR(64) NULL
metadata JSONB NOT NULL
created_at TIMESTAMPTZ
```

---

# 72. 对象存储

```text
derived/labsight/
  {tenant_id}/{project_id}/
    sessions/
      {session_id}/
        input/
          requirement-baseline.json
          architecture-baseline.json
          selection-baseline.json
          compatibility-baseline.json
          eda-revision.json
          firmware-build.json
          manufacturing-release.json
          quality-history.json
          debug-profile.json
          safety-policy.json
          input-snapshot.json
        identity/
          qr/
          labels/
          firmware/
          resolution.json
        safety/
          context.json
          gate-runs/
          approvals/
        devices/
          registry-snapshot.json
          capabilities/
          permissions/
          configurations/
          commands/
        synchronization/
          clock-offsets.json
          markers/
          sync-report.json
        camera/
          raw/
          calibrated/
          registration/
          scene-objects/
          visual-findings/
        audio/
          raw/
          transcripts/
          redacted/
        wiring/
          scene/
          connector-maps/
          cable-maps/
          probe-placements/
        measurements/
          oscilloscope/
            raw/
            waveforms/
            features/
            screenshots/
          logic/
            raw/
            decoded/
          dmm/
          power-supply/
          load/
          spectrum/
          thermal/
          debug/
        logs/
          serial/
          rtt/
          swo/
          jtag/
          network/
          parsed/
          redacted/
        timeline/
          events.parquet
          aligned-evidence.parquet
          timeline.json
        expected/
          waveforms/
          sequences/
          limits/
          known-good/
        comparisons/
          waveform/
          logic/
          power/
          logs/
          visual/
        symptoms/
          symptoms.jsonl.zst
        signatures/
          matches.jsonl.zst
        hypotheses/
          graph.json
          nodes.jsonl.zst
          edges.jsonl.zst
        tests/
          plans/
          steps/
          executions/
          confirmations/
        findings/
          findings.jsonl.zst
          evidence-links/
        repairs/
          candidates/
          executions/
          approvals/
        regression/
          plans/
          runs/
          evidence/
        root-cause/
          records/
          decisions/
        report/
          debug-report.html
          debug-report.pdf
          timeline.csv
          findings.csv
          hypothesis-matrix.csv
          measurements.csv
        knowledge/
          candidates/
          review/
        downstream/
          work-packages/
          agent-packages/
        privacy/
          redactions/
          consent/
          retention/
        debug/
          device-traces/
          parser-traces/
          model-traces/
          resource-usage.json
```

---

# 73. API 设计

## 73.1 Sessions

```text
POST /api/v1/labsight/sessions
GET  /api/v1/labsight/sessions
GET  /api/v1/labsight/sessions/{id}
POST /api/v1/labsight/sessions/{id}/start
POST /api/v1/labsight/sessions/{id}/pause
POST /api/v1/labsight/sessions/{id}/resume
POST /api/v1/labsight/sessions/{id}/cancel
POST /api/v1/labsight/sessions/{id}/close
GET  /api/v1/labsight/sessions/{id}/events
```

## 73.2 Identity

```text
POST /api/v1/labsight/sessions/{id}/identity/observe
GET  /api/v1/labsight/sessions/{id}/identity/observations
POST /api/v1/labsight/sessions/{id}/identity/resolve
POST /api/v1/labsight/sessions/{id}/identity/confirm
GET  /api/v1/labsight/sessions/{id}/identity
```

## 73.3 Safety

```text
POST /api/v1/labsight/sessions/{id}/safety/context
GET  /api/v1/labsight/sessions/{id}/safety/context
POST /api/v1/labsight/sessions/{id}/safety/evaluate
GET  /api/v1/labsight/sessions/{id}/safety/gate
POST /api/v1/labsight/sessions/{id}/safety/approve
GET  /api/v1/labsight/sessions/{id}/safety/blocked-actions
```

## 73.4 Devices

```text
POST /api/v1/labsight/devices/register
GET  /api/v1/labsight/devices
GET  /api/v1/labsight/devices/{id}
POST /api/v1/labsight/sessions/{id}/devices/discover
GET  /api/v1/labsight/sessions/{id}/devices
POST /api/v1/labsight/sessions/{id}/devices/{device_id}/permissions
POST /api/v1/labsight/sessions/{id}/devices/{device_id}/read-configuration
```

## 73.5 Instrument Commands

```text
POST /api/v1/labsight/sessions/{id}/devices/{device_id}/command-requests
GET  /api/v1/labsight/sessions/{id}/command-requests
POST /api/v1/labsight/command-requests/{id}/approve
POST /api/v1/labsight/command-requests/{id}/reject
POST /api/v1/labsight/command-requests/{id}/execute
GET  /api/v1/labsight/command-requests/{id}/result
```

## 73.6 Synchronization

```text
POST /api/v1/labsight/sessions/{id}/time-sync
GET  /api/v1/labsight/sessions/{id}/time-sync
POST /api/v1/labsight/sessions/{id}/markers
```

## 73.7 Camera and Scene

```text
POST /api/v1/labsight/sessions/{id}/camera/calibrate
POST /api/v1/labsight/sessions/{id}/board/register
GET  /api/v1/labsight/sessions/{id}/board/registration
POST /api/v1/labsight/sessions/{id}/scene/detect
GET  /api/v1/labsight/sessions/{id}/scene/objects
POST /api/v1/labsight/scene-objects/{id}/confirm
```

## 73.8 Wiring and Probe Placement

```text
POST /api/v1/labsight/sessions/{id}/wiring/observe
GET  /api/v1/labsight/sessions/{id}/wiring
POST /api/v1/labsight/sessions/{id}/wiring/validate
POST /api/v1/labsight/sessions/{id}/probes/observe
GET  /api/v1/labsight/sessions/{id}/probes
POST /api/v1/labsight/probes/{id}/confirm
POST /api/v1/labsight/probes/{id}/validate-safety
```

## 73.9 Evidence Capture

```text
POST /api/v1/labsight/sessions/{id}/capture/camera
POST /api/v1/labsight/sessions/{id}/capture/audio
POST /api/v1/labsight/sessions/{id}/capture/waveform
POST /api/v1/labsight/sessions/{id}/capture/logic
POST /api/v1/labsight/sessions/{id}/capture/dmm
POST /api/v1/labsight/sessions/{id}/capture/power
POST /api/v1/labsight/sessions/{id}/capture/thermal
POST /api/v1/labsight/sessions/{id}/capture/log
GET  /api/v1/labsight/sessions/{id}/evidence
GET  /api/v1/labsight/evidence/{id}
```

## 73.10 Timeline

```text
POST /api/v1/labsight/sessions/{id}/timeline/rebuild
GET  /api/v1/labsight/sessions/{id}/timeline
POST /api/v1/labsight/sessions/{id}/timeline/markers
GET  /api/v1/labsight/sessions/{id}/timeline/export
```

## 73.11 Visual Inspection

```text
POST /api/v1/labsight/sessions/{id}/visual-inspection
GET  /api/v1/labsight/sessions/{id}/visual-findings
POST /api/v1/labsight/visual-findings/{id}/confirm
POST /api/v1/labsight/visual-findings/{id}/reject
```

## 73.12 Waveform and Logic Analysis

```text
POST /api/v1/labsight/waveforms/{id}/extract-features
POST /api/v1/labsight/waveforms/{id}/compare-expected
GET  /api/v1/labsight/waveforms/{id}/analysis
POST /api/v1/labsight/logic-captures/{id}/decode
POST /api/v1/labsight/logic-captures/{id}/compare-protocol
GET  /api/v1/labsight/logic-captures/{id}/analysis
```

## 73.13 Logs

```text
POST /api/v1/labsight/sessions/{id}/log-sources
POST /api/v1/labsight/log-sources/{id}/ingest
POST /api/v1/labsight/log-sources/{id}/parse
GET  /api/v1/labsight/sessions/{id}/log-events
POST /api/v1/labsight/sessions/{id}/logs/correlate
```

## 73.14 Symptoms and Expected Behavior

```text
POST /api/v1/labsight/sessions/{id}/symptoms
GET  /api/v1/labsight/sessions/{id}/symptoms
POST /api/v1/labsight/sessions/{id}/expected-behavior/load
GET  /api/v1/labsight/sessions/{id}/expected-behavior
POST /api/v1/labsight/sessions/{id}/compare-observations
GET  /api/v1/labsight/sessions/{id}/comparisons
```

## 73.15 Fault Signatures and Hypotheses

```text
POST /api/v1/labsight/sessions/{id}/match-signatures
GET  /api/v1/labsight/sessions/{id}/signature-matches
POST /api/v1/labsight/sessions/{id}/hypotheses/generate
GET  /api/v1/labsight/sessions/{id}/hypotheses
GET  /api/v1/labsight/sessions/{id}/hypothesis-graph
POST /api/v1/labsight/hypotheses/{id}/support
POST /api/v1/labsight/hypotheses/{id}/reject
POST /api/v1/labsight/hypotheses/{id}/verify
```

## 73.16 Test Planning

```text
POST /api/v1/labsight/sessions/{id}/test-plans
GET  /api/v1/labsight/sessions/{id}/test-plans
GET  /api/v1/labsight/test-plans/{id}
POST /api/v1/labsight/test-plans/{id}/approve
POST /api/v1/labsight/test-steps/{id}/confirm
POST /api/v1/labsight/test-steps/{id}/execute
POST /api/v1/labsight/test-steps/{id}/complete
```

## 73.17 Findings and Repairs

```text
GET  /api/v1/labsight/sessions/{id}/findings
GET  /api/v1/labsight/findings/{id}
POST /api/v1/labsight/findings/{id}/accept
POST /api/v1/labsight/findings/{id}/reject
POST /api/v1/labsight/findings/{id}/waive
POST /api/v1/labsight/sessions/{id}/repair-candidates
GET  /api/v1/labsight/sessions/{id}/repair-candidates
POST /api/v1/labsight/repair-candidates/{id}/approve
POST /api/v1/labsight/repair-candidates/{id}/execute
```

## 73.18 Regression and Root Cause

```text
POST /api/v1/labsight/sessions/{id}/regression-plans
GET  /api/v1/labsight/sessions/{id}/regression-plans
POST /api/v1/labsight/regression-plans/{id}/run
GET  /api/v1/labsight/regression-runs/{id}
POST /api/v1/labsight/sessions/{id}/root-causes
GET  /api/v1/labsight/sessions/{id}/root-causes
POST /api/v1/labsight/root-causes/{id}/approve
```

## 73.19 Reports and Knowledge

```text
POST /api/v1/labsight/sessions/{id}/reports
GET  /api/v1/labsight/sessions/{id}/reports
GET  /api/v1/labsight/reports/{id}
POST /api/v1/labsight/sessions/{id}/knowledge-candidates
GET  /api/v1/labsight/sessions/{id}/knowledge-candidates
POST /api/v1/labsight/knowledge-candidates/{id}/approve
```

## 73.20 Downstream and Privacy

```text
POST /api/v1/labsight/sessions/{id}/work-packages
GET  /api/v1/labsight/sessions/{id}/work-packages
POST /api/v1/labsight/sessions/{id}/privacy/redact
GET  /api/v1/labsight/sessions/{id}/privacy/status
POST /api/v1/labsight/sessions/{id}/retention/apply
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 74. 输入事件

```text
project-planning.debug-work-package-ready
requirements.baseline-frozen
architecture.baseline-frozen
component-selection.baseline-frozen
compatibility.baseline-frozen
eda.canonical-ir-ready
firmware.build-released
manufacturing.release-published
quality.issue-opened
production-test.failure-detected
field-return.received
labsight.session-requested
```

---

# 75. 输出事件

```text
labsight.identity-conflict
labsight.safety-blocked
labsight.device-unavailable
labsight.calibration-required
labsight.observation-ready
labsight.critical-finding-detected
labsight.hypothesis-ready
labsight.test-plan-ready
labsight.human-confirmation-required
labsight.repair-candidate-ready
labsight.design-change-required
labsight.firmware-change-required
labsight.rework-required
labsight.manufacturing-review-required
labsight.regression-required
labsight.root-cause-candidate-ready
labsight.root-cause-verified
labsight.knowledge-candidate-ready
labsight.session-closed
labsight.session-failed
```

---

# 76. 下游事件

```text
project-planning.debug-work-packages-ready
architecture.fault-feedback-ready
reference-reuse.failure-feedback-ready
component-selection.failure-feedback-ready
compatibility.recheck-required
eda.fix-package-ready
firmware.debug-fix-package-ready
simulation.correlation-requested
pcb.review-requested
mechanical.review-requested
manufacturing.process-review-requested
quality.corrective-action-requested
knowledge.debug-pattern-ready
```

---

# 77. Policy 组织

```text
policies/
├── labsight-debug-1.0.0.yaml
├── readiness-gates.yaml
├── safety/
│   ├── levels.yaml
│   ├── mains.yaml
│   ├── batteries.yaml
│   ├── high-current.yaml
│   ├── stored-energy.yaml
│   ├── thermal.yaml
│   ├── motion.yaml
│   ├── optical.yaml
│   ├── esd.yaml
│   └── prohibited-actions.yaml
├── identity/
│   ├── sources.yaml
│   ├── conflicts.yaml
│   └── confirmation.yaml
├── devices/
│   ├── discovery.yaml
│   ├── capabilities.yaml
│   ├── calibration.yaml
│   ├── permissions.yaml
│   └── commands.yaml
├── synchronization/
│   ├── methods.yaml
│   ├── quality.yaml
│   └── drift.yaml
├── camera/
│   ├── calibration.yaml
│   ├── board-registration.yaml
│   ├── object-detection.yaml
│   ├── probe-tracking.yaml
│   └── visual-findings.yaml
├── instruments/
│   ├── oscilloscope.yaml
│   ├── logic-analyzer.yaml
│   ├── dmm.yaml
│   ├── power-supply.yaml
│   ├── load.yaml
│   ├── thermal-camera.yaml
│   ├── spectrum-analyzer.yaml
│   ├── jtag-swd.yaml
│   └── serial.yaml
├── evidence/
│   ├── artifacts.yaml
│   ├── quality.yaml
│   ├── provenance.yaml
│   ├── timeline.yaml
│   └── retention.yaml
├── analysis/
│   ├── waveform.yaml
│   ├── logic.yaml
│   ├── logs.yaml
│   ├── power-up.yaml
│   ├── thermal.yaml
│   └── expected-vs-observed.yaml
├── hypotheses/
│   ├── generation.yaml
│   ├── ranking.yaml
│   ├── contradiction.yaml
│   └── verification.yaml
├── tests/
│   ├── risk.yaml
│   ├── information-gain.yaml
│   ├── approvals.yaml
│   └── rollback.yaml
├── repairs/
│   ├── categories.yaml
│   ├── approvals.yaml
│   ├── execution.yaml
│   └── regression.yaml
├── privacy/
│   ├── recording.yaml
│   ├── faces.yaml
│   ├── audio.yaml
│   ├── logs.yaml
│   ├── secrets.yaml
│   └── retention.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 78. Device Adapter 接口

```python
class LabSightDeviceAdapter:
    async def discover(self) -> CapabilitySnapshot: ...
    async def connect(self, connection) -> ConnectionResult: ...
    async def read_configuration(self) -> ConfigurationSnapshot: ...
    async def capture(self, request) -> EvidenceArtifact: ...
    async def validate_command(self, command, safety_context) -> ValidationResult: ...
    async def execute_command(self, approved_command) -> CommandResult: ...
    async def disconnect(self) -> None: ...
```

---

# 79. Camera Adapter

```python
class CameraAdapter(LabSightDeviceAdapter):
    async def get_frame(self, request) -> ImageArtifact: ...
    async def get_stream(self, request) -> StreamHandle: ...
    async def set_focus(self, approved_request) -> CommandResult: ...
    async def set_exposure(self, approved_request) -> CommandResult: ...
```

相机写操作仅限低风险成像参数，不控制 DUT。

---

# 80. Oscilloscope Adapter

```python
class OscilloscopeAdapter(LabSightDeviceAdapter):
    async def read_channel_configuration(self) -> ChannelConfigSet: ...
    async def acquire_waveform(self, request) -> WaveformArtifact: ...
    async def read_measurements(self, request) -> MeasurementSet: ...
    async def arm_single(self, approved_request) -> CommandResult: ...
```

适配层支持：

```text
SCPI over USB/LAN
vendor SDK
WebUSB/WebSerial candidate
remote instrument gateway
file import
```

---

# 81. Logic Analyzer Adapter

```python
class LogicAnalyzerAdapter(LabSightDeviceAdapter):
    async def acquire_digital(self, request) -> LogicCaptureArtifact: ...
    async def decode_protocol(self, request) -> DecodeResult: ...
```

---

# 82. DMM Adapter

```python
class DMMAdapter(LabSightDeviceAdapter):
    async def read_measurement(self, request) -> MeasurementRecord: ...
    async def read_terminal_state(self) -> TerminalState: ...
```

---

# 83. Power Supply Adapter

```python
class PowerSupplyAdapter(LabSightDeviceAdapter):
    async def read_output_state(self) -> OutputState: ...
    async def read_measurements(self) -> MeasurementSet: ...
    async def request_setpoint_change(self, request) -> CommandValidation: ...
    async def request_output_change(self, request) -> CommandValidation: ...
```

所有 Setpoint 和 Output 操作需要确认，危险级别由 Safety Policy 决定。

---

# 84. Serial and Debug Adapter

```python
class SerialDebugAdapter(LabSightDeviceAdapter):
    async def read_stream(self, request) -> StreamArtifact: ...
    async def send_read_only_query(self, request) -> QueryResult: ...
```

禁止默认发送会改变设备状态的命令。

---

# 85. Instrument Gateway

推荐架构：

```text
Browser / LabSight UI
        ↓
Lab Gateway on Local Network
        ↓
Device Adapters
        ↓
USB / LAN / Serial / Vendor SDK
```

Gateway 职责：

```text
local device access
credential isolation
streaming
timestamping
rate limiting
command approval enforcement
offline buffering
artifact hashing
```

---

# 86. Multimodal Alignment Engine

输入：

```text
video frames
audio
waveforms
logic captures
DMM samples
power telemetry
logs
operator actions
```

输出：

```text
aligned timeline
time uncertainty
causal-order candidates
event clusters
cross-modal markers
```

---

# 87. Visual Registration Provider

```python
class BoardRegistrationProvider:
    async def register(self, camera_frame, board_ir, calibration) -> RegistrationResult: ...
    async def locate_components(self, frame, registration, board_ir) -> SceneObjectSet: ...
    async def locate_probes(self, frame, registration) -> ProbeCandidateSet: ...
```

视觉结果必须保留：

```text
model/version
crop
transform
confidence
occlusion
manual correction
```

---

# 88. Waveform Analysis Provider

```python
class WaveformAnalysisProvider:
    async def validate_metadata(self, waveform) -> ValidationResult: ...
    async def extract_features(self, waveform) -> FeatureSet: ...
    async def compare(self, observed, expected) -> ComparisonResult: ...
```

确定性算法优先处理：

```text
levels
frequency
period
duty
rise/fall
ripple
overshoot
startup delays
glitches
```

AI 负责解释和候选关联，不负责生成测量值。

---

# 89. Log Analysis Provider

```python
class LogAnalysisProvider:
    async def parse(self, source, schema) -> LogEventSet: ...
    async def detect_patterns(self, events) -> PatternSet: ...
    async def correlate(self, events, timeline) -> CorrelationSet: ...
```

---

# 90. Hypothesis Provider

```python
class DebugHypothesisProvider:
    async def generate(self, context) -> HypothesisSet: ...
    async def update(self, hypotheses, new_evidence) -> HypothesisSet: ...
    async def explain(self, hypothesis) -> HypothesisTrace: ...
```

输入只包含受控、脱敏、带证据 ID 的上下文。

---

# 91. Test Planner

```python
class DebugTestPlanner:
    async def generate_candidates(self, hypotheses, capabilities, safety) -> TestCandidateSet: ...
    async def rank(self, candidates) -> RankedTestSet: ...
    async def materialize(self, selected) -> TestPlan: ...
```

---

# 92. Information Gain

测试优先级可考虑：

```text
hypotheses separated
expected result diversity
measurement reliability
setup effort
risk
reversibility
duration
instrument availability
```

不得只按模型信心排序。

---

# 93. Scene and Instrument Workbench

页面结构：

```text
左侧：
- Session
- Board Identity
- Safety
- Devices
- Findings
- Hypotheses
- Tests

中央：
- Live Camera
- Board Overlay
- Probe/Test Point Overlay
- Timeline
- Waveform/Logic/Logs

右侧：
- Current Step
- Instrument Configuration
- Expected vs Observed
- Evidence
- Human Confirmation
- Remote Expert

底部：
- Measurements
- Hypothesis Matrix
- Repair Candidates
- Regression
- Report
```

---

# 94. Live Overlay

相机画面叠加：

```text
component reference
net/test point
expected voltage
measurement target
probe safety
connector pin
current step
warning region
```

关键数值必须来自设计数据和规则，不由图像模型生成。

---

# 95. Remote Collaboration

支持：

```text
live view
cursor/annotation
voice
session timeline
instrument read-only view
test plan proposal
approval request
evidence bookmark
handoff summary
```

远程专家不能绕过现场 Operator 和 Safety Gate。

---

# 96. 可观测性

```text
labsight_sessions_total{type,status,safety_level}
labsight_session_duration_seconds{step}
labsight_device_discovery_total{type,status}
labsight_device_command_requests_total{risk,status}
labsight_evidence_artifacts_total{type,status}
labsight_time_sync_quality{method}
labsight_board_registration_quality
labsight_probe_confirmation_total{status}
labsight_visual_findings_total{type,severity}
labsight_measurements_total{type,status}
labsight_hypotheses_total{status}
labsight_test_steps_total{risk,result}
labsight_root_causes_total{verification_status}
labsight_regressions_total{result}
labsight_privacy_redactions_total{type}
labsight_external_model_calls_total{provider,status}
```

---

# 97. Dashboard

```text
Open Sessions
Safety Blocks
Connected Devices
Calibration Due
Identity Conflicts
Evidence Timeline
Visual Findings
Power-up Failures
Protocol Failures
Hypotheses
Pending Confirmations
Test Execution
Repair Candidates
Regression
Verified Root Causes
Knowledge Candidates
Recurring Faults
Instrument Utilization
Privacy and Retention
```

---

# 98. 安全与权限

- Device Credential、USB/LAN Token 和 Vendor SDK Secret 只保存在 Gateway Secret Store；
- UI 和模型不可见 Instrument Credential；
- Read、Capture、Write、High-risk 权限分离；
- 高风险操作要求双确认或现场角色确认；
- Safety Gate 不能由普通管理员静默关闭；
- 市电、高压、大电流和电池测试按角色和设备资质限制；
- 示波器接地风险必须作为独立检查；
- Instrument Command 采用类型化 IR 和 Allowlist，不透传任意 SCPI；
- 每条命令保存审批、前后配置、响应 Hash 和执行人；
- 摄像头和麦克风采集必须有显著 Recording Indicator；
- 人脸、背景、屏幕、标签和日志 Secret 支持自动与人工脱敏；
- 串口和网络日志进入模型前做 Credential、Key、Token、Email 和 Identifier Redaction；
- 不将完整原理图、BOM、客户图像、固件、波形和日志发送给未批准服务；
- 视觉模型和语言模型按租户 Policy 选择本地、私有云或外部 Provider；
- Artifact 访问采用项目 ACL、短期签名 URL 和审计；
- Evidence、Safety Gate、Command、Confirmation、Repair、Root Cause 和 Report 不可硬删除；
- 保留策略按项目、客户、隐私和质量体系配置；
- 公开 Fixture 只使用开源、合成、脱敏或授权数据；
- 禁止用真实客户现场音视频训练公共模型。

---

# 99. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
WebSocket / WebRTC
```

本地 Gateway：

```text
Python or Rust
USB/LAN/Serial adapters
SCPI
VISA adapter
WebUSB/WebSerial optional
mDNS/device discovery
local encrypted cache
```

多媒体：

```text
OpenCV
PyAV / FFmpeg
WebRTC
image metadata pipeline
optional depth/thermal adapters
```

数据：

```text
Polars
PyArrow
DuckDB
Decimal
NumPy/SciPy for deterministic signal analysis
```

时序：

```text
monotonic clock
PTP/NTP adapters
hardware trigger markers
```

前端：

```text
React
TypeScript
Live Camera Overlay
Waveform Viewer
Logic Timeline
Log Viewer
Hypothesis Graph
Test Step Runner
Remote Collaboration
```

模型：

```text
provider abstraction
local/private vision model option
local/private language model option
speech-to-text provider
structured outputs
prompt/model/version registry
```

---

# 100. 推荐仓库结构

```text
labsight-debug-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── labsight-debug-agent-spec.md
│   ├── session-and-identity.md
│   ├── safety-and-command-policy.md
│   ├── device-gateway-and-adapters.md
│   ├── time-synchronization.md
│   ├── camera-and-board-registration.md
│   ├── wiring-and-probe-placement.md
│   ├── instrument-configuration.md
│   ├── waveform-and-logic-analysis.md
│   ├── logs-and-audio.md
│   ├── multimodal-timeline.md
│   ├── symptoms-and-fault-signatures.md
│   ├── hypothesis-and-test-planning.md
│   ├── repairs-and-regression.md
│   ├── root-cause-and-knowledge.md
│   ├── privacy-and-retention.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-evidence-timeline-is-truth.md
│       ├── 0002-instrument-metadata-precedes-screen-vision.md
│       ├── 0003-ai-hypotheses-are-not-root-causes.md
│       ├── 0004-safety-gate-precedes-instrument-write.md
│       ├── 0005-probe-placement-requires-confirmation.md
│       ├── 0006-multimodal-evidence-is-version-bound.md
│       └── 0007-session-records-are-immutable.md
├── gateway/
│   ├── README.md
│   ├── src/
│   │   ├── discovery/
│   │   ├── devices/
│   │   ├── scpi/
│   │   ├── serial/
│   │   ├── usb/
│   │   ├── streaming/
│   │   ├── timestamps/
│   │   ├── permissions/
│   │   ├── cache/
│   │   └── security/
│   └── tests/
├── src/
│   └── labsight/
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
│       │   ├── agent15.py
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   ├── agent22_30.py
│       │   ├── quality.py
│       │   └── downstream.py
│       ├── sessions/
│       │   ├── lifecycle.py
│       │   ├── snapshots.py
│       │   ├── identity.py
│       │   └── readiness.py
│       ├── safety/
│       │   ├── context.py
│       │   ├── gates.py
│       │   ├── ranges.py
│       │   ├── commands.py
│       │   ├── confirmations.py
│       │   └── hazards.py
│       ├── devices/
│       │   ├── registry.py
│       │   ├── capabilities.py
│       │   ├── permissions.py
│       │   ├── configurations.py
│       │   └── commands.py
│       ├── synchronization/
│       │   ├── clocks.py
│       │   ├── markers.py
│       │   ├── alignment.py
│       │   └── quality.py
│       ├── vision/
│       │   ├── calibration.py
│       │   ├── registration.py
│       │   ├── scene.py
│       │   ├── components.py
│       │   ├── solder.py
│       │   ├── probes.py
│       │   └── overlays.py
│       ├── wiring/
│       │   ├── connectors.py
│       │   ├── cables.py
│       │   ├── probes.py
│       │   ├── mapping.py
│       │   └── validation.py
│       ├── instruments/
│       │   ├── base.py
│       │   ├── oscilloscope.py
│       │   ├── logic_analyzer.py
│       │   ├── dmm.py
│       │   ├── power_supply.py
│       │   ├── electronic_load.py
│       │   ├── thermal_camera.py
│       │   ├── spectrum.py
│       │   ├── jtag.py
│       │   └── serial.py
│       ├── evidence/
│       │   ├── artifacts.py
│       │   ├── provenance.py
│       │   ├── quality.py
│       │   ├── timeline.py
│       │   └── hashing.py
│       ├── waveforms/
│       │   ├── metadata.py
│       │   ├── features.py
│       │   ├── envelopes.py
│       │   ├── compare.py
│       │   └── quality.py
│       ├── logic/
│       │   ├── captures.py
│       │   ├── decoders.py
│       │   ├── protocol.py
│       │   └── compare.py
│       ├── logs/
│       │   ├── sources.py
│       │   ├── parsers.py
│       │   ├── events.py
│       │   ├── correlate.py
│       │   └── redact.py
│       ├── audio/
│       │   ├── capture.py
│       │   ├── transcript.py
│       │   ├── acoustic.py
│       │   └── privacy.py
│       ├── symptoms/
│       ├── signatures/
│       ├── hypotheses/
│       │   ├── graph.py
│       │   ├── generate.py
│       │   ├── update.py
│       │   ├── contradict.py
│       │   └── explain.py
│       ├── tests/
│       │   ├── candidates.py
│       │   ├── ranking.py
│       │   ├── plans.py
│       │   ├── execution.py
│       │   └── rollback.py
│       ├── findings/
│       ├── repairs/
│       ├── regression/
│       ├── root_cause/
│       ├── reports/
│       ├── knowledge/
│       ├── privacy/
│       ├── downstream/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── device-profiles/
├── instrument-profiles/
├── fault-signatures/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_labsight_readiness.py
    ├── discover_lab_devices.py
    ├── calibrate_labsight_camera.py
    ├── register_board_scene.py
    ├── capture_debug_baseline.py
    ├── build_evidence_timeline.py
    ├── analyze_debug_session.py
    ├── generate_debug_test_plan.py
    ├── freeze_debug_report.py
    └── run_labsight_benchmark.py
```


---

# 101. Codex 分阶段实施

不要让 Codex 一次实现相机标定、板卡注册、SCPI、波形分析、日志分析、语音、Hypothesis、测试编排、远程协作和现场安全控制。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. 当前 Agent 10–15 Baseline、Gate、Constraint、Interface 和 Known Risk；
2. 当前 Agent 16/18/20 的 EDA IR、Netlist、Pin、Pad、Test Point、PCB 坐标和 3D；
3. 当前 Agent 21 的 Firmware Build、Pin Mux、日志、Debug Symbol 和 Driver；
4. 当前 Agent 22–30 的 Review、Simulation、PCB、Mechanical、DFM 和 Manufacturing Evidence；
5. 当前 Agent 31–45 的 Lot、Material、Quality、Test 和 Traceability；
6. 当前 LabSight Camera、Mount、Lighting、Focus、Working Distance 和图像采集；
7. 当前显微摄像、热成像、深度相机和扩展设备；
8. 当前示波器、逻辑分析仪、万用表、电源、负载、串口、JTAG/SWD 和网络采集接口；
9. 当前 SCPI、VISA、Vendor SDK、WebUSB/WebSerial 和本地 Gateway；
10. 当前仪器发现、能力读取、配置读取、波形原始数据和截图导入；
11. 当前音频、语音识别、语音指令和远程协作；
12. 当前设备时钟、软件时间戳、硬件 Trigger 和 Timeline；
13. 当前 Camera Calibration、Board Registration、Fiducial、Component Overlay 和 Probe Tracking；
14. 当前 Assembly Inspection、Solder Defect、Connector/Cable/FPC 识别；
15. 当前 Waveform Feature、Expected Envelope、Logic Decode 和 Log Parser；
16. 当前 Debug Issue、Symptom、Hypothesis、Test、Repair、Regression 和 Root Cause 数据；
17. 当前安全规则、设备权限、仪器写操作和人工确认；
18. 当前隐私、录像提示、音视频脱敏、日志 Secret Redaction 和 Retention；
19. 当前 ezPLM Issue、Task、Test Record、Change、Knowledge 和 Release Gate；
20. 当前远程专家、Session Handoff 和 Evidence Bookmark；
21. 当前开源、合成、脱敏或授权 Fixture；
22. 统计目前可连接仪器、协议和元数据完整率；
23. 统计波形只有截图、缺原始数据和缺配置的比例；
24. 统计 Board Revision、Firmware Build 和现场样机身份不一致情况；
25. 统计调试记录缺测点、缺量程、缺时间、缺操作步骤和缺回归情况；
26. 统计故障发现阶段、根因确认时间和重复问题；
27. 统计接线、探头、仪器配置、焊点和 Firmware 配置类问题；
28. 只运行只读扫描、安全设备枚举和公开 Fixture；
29. 不连接真实生产设备进行写操作；
30. 不启动真实 DUT；
31. 不改变电源、负载、信号源或继电器状态；
32. 不执行来源 Firmware；
33. 不上传客户音视频和日志到外部模型；
34. 不创建 Migration；
35. 不安装 Vendor Driver、VISA、FFmpeg、模型或系统服务；
36. 不修改现有 LabSight Hardware；
37. 不冻结 Debug Root Cause；
38. 不触发 Agent 19 或采购/生产动作；
39. 不读取或打印 Device Credential、API Key、客户原理图、BOM 和日志 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Debug Session；
- Input Snapshot；
- Profile；
- Board Identity Observation/Resolution；
- Safety Context/Gate；
- Device/Capability/Permission；
- Time Sync；
- Camera Calibration；
- Board Registration；
- Scene Object；
- Probe Placement；
- Wiring；
- Instrument Configuration/Command；
- Evidence Artifact；
- Timeline Event；
- Visual Finding；
- Measurement/Waveform/Logic Capture；
- Log Source/Event；
- Audio Transcript；
- Symptom；
- Expected Behavior；
- Comparison；
- Fault Signature；
- Hypothesis/Graph；
- Test Plan/Step/Execution；
- Confirmation；
- Finding；
- Repair/Execution；
- Regression；
- Root Cause；
- Decision/Report；
- Knowledge Candidate；
- Work Package；
- Privacy Redaction；
- Audit；
- JSON Schema。

## Phase 2：Session Input Gate

实现：

- Project/Board/Revision；
- Variant；
- Serial/Lot；
- Firmware Build；
- Requirement/Architecture/Selection/Compatibility Baselines；
- EDA/Manufacturing Revision；
- Quality History；
- Debug Profile；
- Instrument Registry；
- Safety Policy；
- Immutable Snapshot；
- Missing-data Diagnostics；
- Draft-only/Ready。

## Phase 3：Board Identity Resolution

实现：

- QR/Barcode；
- Silkscreen；
- Firmware Identity；
- USB Descriptor；
- EEPROM；
- Manufacturing Label；
- PLM Lookup；
- Manual Confirmation；
- Conflict Detection；
- Identity Hash；
- Gate。

## Phase 4：Safety Context and Gate

实现：

- Safety Levels；
- Voltage/Current/Energy；
- Battery/Mains；
- Isolation；
- Thermal/Motion/Optical；
- Operator Qualification；
- PPE/E-stop；
- Probe Rating；
- Instrument Ground；
- Allowed/Blocked Actions；
- Approval；
- Audit。

## Phase 5：Device Registry and Capability Discovery

实现：

- Device Identity；
- Connection；
- Model/Firmware/Driver；
- Capabilities；
- Limits；
- Timestamp；
- Streaming；
- Calibration；
- Write Classes；
- Raw Snapshot；
- Offline Fixture Adapter。

## Phase 6：Device Permission and Command Policy

实现：

- Read/Capture/Write/High-risk；
- Operator Role；
- Expiration；
- Command Allowlist；
- Risk Classification；
- Precondition；
- Approval；
- Execution Audit；
- No Raw Command Passthrough。

## Phase 7：Local Gateway Foundation

实现：

- Gateway Identity；
- Mutual Authentication；
- Local Device Discovery；
- Connection Broker；
- Stream Broker；
- Artifact Buffer；
- Timestamp；
- Credential Store；
- Offline Queue；
- Health；
- No Instrument Business Logic in Browser。

## Phase 8：Time Synchronization

实现：

- Monotonic Session Clock；
- Wall Clock；
- Device Offset；
- Drift；
- Software Marker；
- GPIO/Trigger Marker；
- Audio/Visual Marker；
- Quality Vector；
- Timeline Alignment；
- Tests。

## Phase 9：Camera Capture and Calibration

实现：

- Frame Capture；
- Intrinsics；
- Distortion；
- Focus；
- Working Distance；
- Scale；
- Lighting；
- Color；
- Pose；
- Calibration Target；
- Quality；
- Recalibration Gate。

## Phase 10：Board Registration

实现：

- Board Outline；
- Fiducials；
- Mounting Holes；
- Connectors；
- Silkscreen；
- Component Courtyard；
- Manual Anchors；
- Homography/Pose；
- Image↔Board Transform；
- Quality；
- Overlay Tests。

## Phase 11：Scene Object Model

实现：

- Board；
- Component；
- Pad/Solder Joint；
- Connector；
- Cable；
- Probe；
- Tool；
- Hand/Occlusion；
- Region；
- Pose；
- Confidence；
- Evidence；
- Human Confirmation。

## Phase 12：Component and Assembly Visual Candidates

实现：

- Component Presence；
- Orientation；
- Skew；
- Tombstone；
- Lifted Lead；
- Bridge；
- Insufficient/Excess Solder；
- Burn/Contamination；
- Connector Seating；
- Jumper；
- Candidate-only；
- Manual Review；
- No BGA Claim。

## Phase 13：Wiring and Connector Mapping

实现：

- Connector Identity；
- Pin 1；
- Polarity；
- TX/RX；
- Ground；
- Power Source/Sink；
- Cable Direction；
- FPC Contact Side；
- Adapter；
- Jumper；
- Visual/Design Evidence；
- Findings。

## Phase 14：Probe Placement Detection and Confirmation

实现：

- Probe Tip；
- Ground Clip；
- Channel；
- Probe Type/Ratio；
- Test Point Candidate；
- Net Candidate；
- Board XY；
- Rating；
- Loading；
- Adjacent-short Risk；
- Ground Risk；
- Human Confirmation；
- Gate。

## Phase 15：Instrument Configuration Snapshot

实现：

- Generic Typed Config；
- Device-specific Raw Config；
- Validity Interval；
- Read Method；
- Hash；
- Operator Confirmation；
- Config Diff；
- Timeline Event；
- No Screenshot-only Truth。

## Phase 16：Oscilloscope Adapter Read-only

实现：

- Capability；
- Channel Config；
- Probe Ratio；
- Coupling；
- Impedance；
- Scale/Offset；
- Timebase；
- Sample Rate/Depth；
- Trigger；
- Acquisition；
- Measurements；
- Waveform Read；
- Offline File Fixture。

## Phase 17：Oscilloscope Configuration Validation

实现：

- Clipping；
- Aliasing；
- Insufficient Sample Rate；
- Memory；
- Trigger；
- Coupling；
- Bandwidth Limit；
- Scale；
- Probe Ratio；
- Grounding；
- Measurement Suitability；
- Finding；
- Safe Setting Candidate。

## Phase 18：Waveform Artifact and Feature Engine

实现：

- Raw Samples；
- Axes；
- Metadata；
- Features；
- DC/RMS/Peak；
- Frequency/Period/Duty；
- Rise/Fall；
- Ripple；
- Overshoot/Ringing；
- Startup；
- Glitch；
- Deterministic Tests；
- Quality Vector。

## Phase 19：Expected Waveform and Comparison

实现：

- Agent 23 Simulation Import；
- Datasheet Envelope；
- Known-good Capture；
- Acceptance Criteria；
- Conditions；
- Time Alignment；
- Tolerance；
- Probe Loading；
- Comparison；
- Uncertainty；
- No False Precision。

## Phase 20：Logic Analyzer Adapter

实现：

- Channels；
- Threshold；
- Sample Rate；
- Trigger；
- Pre/Post；
- Raw Capture；
- Channel Map；
- Offline Fixture；
- Capability；
- Configuration Validation。

## Phase 21：Protocol Decode and Logic Analysis

实现：

- UART；
- SPI；
- I²C；
- CAN；
- Custom Decoder Adapter；
- Framing；
- Address；
- CRC；
- Retry；
- Timeout；
- Contention；
- Idle；
- Boot Sequence；
- Threshold/Sample Warnings；
- Evidence。

## Phase 22：DMM Adapter and Measurement Context

实现：

- Mode；
- Range；
- Terminals；
- Auto/Manual；
- Reading；
- Polarity；
- Reference Point；
- Settling；
- Device State；
- Invalid-terminal Warning；
- Measurement Record；
- Offline Fixture。

## Phase 23：Power Supply and Electronic Load Read-only

实现：

- Output State；
- Setpoints；
- Measured V/I；
- OVP/OCP；
- Ramp；
- Remote Sense；
- Channel Mode；
- Load Mode；
- Logging；
- Capability；
- No Write by Default。

## Phase 24：Approved Instrument Write Flow

实现：

- Typed Command；
- Range Check；
- Safety Gate；
- Device Limit；
- Project Policy；
- Human Confirmation；
- Pre/Post Snapshot；
- Execute；
- Verify；
- Rollback Candidate；
- Audit；
- Reject Raw SCPI。

## Phase 25：Power-up Timeline Analysis

实现：

- Input Ramp；
- Inrush；
- Rail Sequence；
- Reset；
- Clock；
- Boot Log；
- Interface Activity；
- Current States；
- Retry Loop；
- Thermal；
- Cross-modal Alignment；
- Expected Comparison。

## Phase 26：Serial and Debug Stream Intake

实现：

- Serial Configuration；
- Logic Level Metadata；
- Baud/Framing；
- RTT/SWO/JTAG；
- Read-only Query；
- Timestamps；
- Raw Artifact；
- Redaction；
- Connection State；
- No Arbitrary Command。

## Phase 27：Log Parsers

实现：

- Plain Text；
- JSON；
- CSV；
- Binary Frame Adapter；
- Bootloader；
- Kernel；
- Application；
- Structured Events；
- Severity；
- Module/Code；
- Reset Reason；
- Assertions；
- Watchdog/Brownout；
- Source Map；
- Parser Tests。

## Phase 28：Audio Capture and Transcript

实现：

- Consent/Indicator；
- Capture；
- Speaker Segmentation；
- Technical Terms；
- Operator Action Marker；
- Redaction；
- Transcript Review；
- Voice Note；
- No Voice-only Risk Approval。

## Phase 29：Acoustic Fault Candidates

实现：

- Relay Click；
- Coil Whine；
- Motor/Fan；
- Alarm Tone；
- Repetition/Frequency Candidate；
- Time Alignment；
- Low-confidence Boundary；
- Human Review；
- No Root Cause Claim。

## Phase 30：Evidence Timeline

实现：

- All Event Types；
- Session Time；
- Device Time；
- Uncertainty；
- Artifact Links；
- Operator Actions；
- Instrument Changes；
- Board State；
- Search/Filter；
- Rebuild；
- Immutable Original Events。

## Phase 31：Symptom Normalization

实现：

- Operator Description；
- Visual；
- Measurement；
- Log；
- Mode；
- Conditions；
- Frequency；
- Severity；
- Affected Functions；
- Dedup；
- Taxonomy；
- Unknown；
- Human Review。

## Phase 32：Expected Behavior Loader

实现：

- Requirements；
- Architecture；
- Compatibility；
- EDA Nets/Test Points；
- Firmware State；
- Simulation；
- Manufacturing Test；
- Known-good；
- Conditions；
- Version/Hash；
- Conflict Detection。

## Phase 33：Expected-vs-Observed Comparison

实现：

- Measurements；
- Waveforms；
- Logic；
- Logs；
- Visual；
- Sequences；
- Conditions；
- Alignment；
- Quality；
- Result；
- Difference Metrics；
- Explanation Trace。

## Phase 34：Fault Signature Registry

实现：

- Product/Board Scope；
- Symptom Patterns；
- Measurements；
- Logs；
- Visual；
- Conditions；
- Root Cause Candidate；
- Tests；
- Evidence Quality；
- Version；
- Approval/Deprecation；
- Negative Signatures。

## Phase 35：Signature Matching

实现：

- Exact Structured Matches；
- Graph/Sequence Matches；
- Numeric Envelope；
- Log Pattern；
- Visual Candidate；
- Condition Scope；
- Negative Match；
- Trace；
- Candidate-only；
- No Root Cause Auto-close。

## Phase 36：Hypothesis Graph

实现：

- Symptom/Hypothesis/Mechanism/Object/Evidence/Test/Repair；
- Support/Contradict/Cause/Test/Rule-out；
- Alternative Hypotheses；
- Missing Evidence；
- Confidence Dimensions；
- Stable Graph；
- Diff；
- Audit。

## Phase 37：Model-assisted Hypothesis Generation

实现：

- Bounded Context；
- Evidence IDs；
- Design Object IDs；
- Contradicting Evidence；
- Unknowns；
- Structured Output；
- Safety Filter；
- No Invented Measurement；
- Candidate-only；
- Provider/Prompt Version；
- Private Provider Policy。

## Phase 38：Hypothesis Update and Contradiction

实现：

- New Evidence；
- Support；
- Contradict；
- Reject；
- Restore Candidate；
- Evidence Conflict；
- Alternative Coverage；
- Status Transition Rules；
- No Probability Fabrication；
- Explanation。

## Phase 39：Test Candidate Generator

实现：

- Visual；
- Unpowered；
- Low-energy；
- Read-only Instrument；
- Firmware Observation；
- Controlled State Change；
- Rework Candidate；
- Hypothesis Target；
- Setup；
- Safe Ranges；
- Outcomes；
- Evidence；
- Rollback；
- Risk。

## Phase 40：Test Ranking

实现：

- Safety First；
- Non-invasive；
- Information Gain；
- Reversibility；
- Duration；
- Setup Cost；
- Device Availability；
- Operator Skill；
- Hypothesis Separation；
- Policy；
- No Auto High-risk Selection。

## Phase 41：Test Plan and Step Runner

实现：

- Ordered Steps；
- Preconditions；
- Confirmation；
- Live Instructions；
- Instrument Config；
- Probe Overlay；
- Evidence Capture；
- Decision Branch；
- Pause/Abort；
- Rollback；
- Execution Record。

## Phase 42：Human Confirmation Service

实现：

- Identity；
- Probe；
- Ground；
- Power Limit；
- Action；
- Hazard；
- Firmware Flash；
- Repair；
- Expiration；
- Role；
- Response；
- Audit；
- Web/Voice UI。

## Phase 43：Finding Correlation

实现：

- Visual/Instrument/Log/Design；
- Duplicate Merge；
- Root Cause Candidate Links；
- Symptom vs Mechanism；
- Severity；
- Confidence；
- Gate；
- Owner；
- No Hidden Suppression；
- Waiver Rules。

## Phase 44：Repair Candidate Generator

实现：

- Instrument Setting；
- Wiring/Reseat；
- Clean；
- Rework；
- Replace；
- Orientation；
- Pull/Termination；
- Firmware Config；
- Pin Mux/Driver；
- Clock/Reset；
- Design；
- Process；
- Evidence/Risk/Agents；
- Candidate-only。

## Phase 45：Repair Approval and Execution Record

实现：

- Operator/Approver Separation；
- Pre-state；
- Action；
- Evidence；
- Post-state；
- Tool/Material；
- Rework Instruction；
- No Robot Control；
- No Auto Solder；
- Result；
- Rollback；
- Audit。

## Phase 46：Regression Planner

实现：

- Requirement Trace；
- Affected Functions；
- Electrical/Protocol/Power；
- Firmware；
- Thermal；
- Mechanical；
- Manufacturing；
- Repeatability；
- Sample Count；
- Baseline；
- Agent Routing；
- Approval。

## Phase 47：Root Cause Verification

实现：

- Mechanism；
- Reproducibility；
- Repair Perturbation；
- Alternative Rejection；
- Regression；
- Evidence Coverage；
- Status；
- Approval；
- Unresolved Outcome；
- No AI-only Verification。

## Phase 48：Debug Report

实现：

- Identity；
- Safety；
- Setup；
- Timeline；
- Symptoms；
- Evidence；
- Hypotheses；
- Tests；
- Repair；
- Regression；
- Root Cause；
- Unknowns；
- Action Items；
- HTML/PDF/CSV；
- Hash；
- Redacted Export。

## Phase 49：Knowledge Candidate

实现：

- Fault Signature；
- Scope；
- Evidence Pattern；
- Tests；
- Repair；
- Prevention；
- Lot/Revision；
- Design/Process Links；
- Privacy；
- Quality Review；
- Approval；
- No Automatic Publication。

## Phase 50：Downstream Work Packages

实现：

- Agent 11 Task；
- Agent 12 Architecture；
- Agent 14 Reselection；
- Agent 15 Recheck；
- Agent 19 EDA；
- Agent 21 Firmware；
- Agent 22/23/27 Review；
- Agent 28/30 Assembly/Process；
- Agent 31–45 Quality/Trace；
- Schema/Hash/Evidence/Gates。

## Phase 51：Remote Collaboration

实现：

- Live Stream；
- Read-only Instrument View；
- Annotation；
- Cursor；
- Audio；
- Evidence Bookmark；
- Test Proposal；
- Approval Request；
- Handoff；
- Role Permissions；
- Network Loss；
- Recording Indicator。

## Phase 52：Privacy and Redaction

实现：

- Faces；
- Background；
- Screen；
- Labels；
- Voice；
- Transcript；
- Serial/Network Secrets；
- Raw/Redacted Artifact；
- Consent；
- Export；
- Retention；
- Access Audit；
- Model Input Filter。

## Phase 53：API、Jobs、Events 和 Storage

实现：

- APIs；
- WebSocket/WebRTC；
- Progress；
- Cancel/Pause；
- Object Storage；
- Stream Lifecycle；
- Pagination；
- ACL；
- Audit；
- Metrics；
- Event Idempotency；
- Retention；
- Gateway Health。

## Phase 54：Benchmark、监控和生产发布

实现：

- Identity；
- Safety；
- Device Discovery；
- Time Sync；
- Registration；
- Probe；
- Instrument Config；
- Waveform/Logic/Log；
- Hypothesis/Test；
- Root Cause；
- Privacy；
- Performance；
- Feature Flags；
- Provider Rollback；
- Gateway Upgrade/Rollback；
- Disaster Recovery。

## Phase 55：高级能力，可选

稳定后：

- Robotic Camera Repositioning under Human Control；
- Motorized Microscope；
- Automated Test Fixture Integration；
- ADALM2000/Scopy Deep Integration；
- Natural-language Instrument Query；
- Multi-board Spatial Graph；
- Thermal-to-Schematic Overlay；
- Automated Golden-board Differential Capture；
- Cross-site Debug Knowledge Graph；
- Production-line LabSight Station；
- 仍不自动执行危险加电、返修、短接或根因批准。

---

# 102. Codex 工作纪律

Codex 必须：

1. Session 绑定项目、板卡、Revision、Variant、Serial 和 Firmware；
2. Identity 未确认不得进入根因分析；
3. Input Snapshot 不可变；
4. Safety Gate 先于设备写操作；
5. 高风险动作人工执行；
6. 仪器凭证只在 Gateway；
7. Device Capability 运行时发现；
8. Device Limits 不写死；
9. 原始仪器元数据优先于屏幕视觉；
10. Screenshot 不是波形真值；
11. Waveform 保存 Raw Samples；
12. Logic Capture 保存 Threshold 和 Channel Map；
13. DMM 保存 Mode/Range/Terminal；
14. Power Supply 保存 Setpoint、Limit 和 Output State；
15. Serial 保存电平、波特率和 Build；
16. 所有 Evidence 有 Hash；
17. 所有 Evidence 有 Session Time；
18. Time Sync Quality 显式；
19. Instrument Config 有有效时间段；
20. Camera Calibration 显式；
21. Board Registration 有质量；
22. 图像区域绑定 Board Object；
23. Probe Tip 和 Ground 分开；
24. Probe Placement 需确认；
25. Probe Rating 和 Common-mode 检查；
26. Scope Ground 风险独立 Gate；
27. Visual Finding 只是 Candidate；
28. 丝印不是 Ordering Code；
29. 隐藏焊点不由 RGB 确认；
30. Wiring 逐 Pin；
31. Connector/FPC 方向显式；
32. Expected Behavior 绑定版本和条件；
33. Observed 数据不脱离仪器配置；
34. Deterministic Signal Analysis 优先；
35. AI 不计算或伪造测量值；
36. AI 只生成 Hypothesis Candidate；
37. Hypothesis 保存支持和矛盾证据；
38. 单证据不验证根因；
39. Alternative Hypothesis 必须覆盖；
40. Test Plan 安全优先；
41. 测试尽量无损、可逆；
42. Test Step 有 Preconditions；
43. Test Step 有 Expected Branches；
44. Test Step 有 Evidence Requirements；
45. State-changing Test 需确认；
46. Raw SCPI 不从用户直接透传；
47. Instrument Command 采用 Typed IR；
48. Command 有 Pre/Post Snapshot；
49. Command 有 Range Validation；
50. 禁止自动绕过保护；
51. 禁止自动高压/市电操作；
52. 禁止自动焊接和返修；
53. Repair 是 Candidate；
54. Repair Execution 有人和审批；
55. Repair 后必须 Regression；
56. Root Cause verified 需要机制、复现、修复和回归；
57. 无法确认时明确 Unresolved；
58. Session Timeline 可回放；
59. 原始 Evidence 不覆盖；
60. Report 有 Redacted Version；
61. Knowledge 发布需审批；
62. 私有数据不进入未批准模型；
63. 摄像头/麦克风有采集提示；
64. 人脸、声音和 Secret 可脱敏；
65. Remote Expert 不绕过现场 Operator；
66. 所有 Waiver、Approval 和 Command 可审计；
67. 不用客户现场数据做公开 Fixture；
68. 不伪造设备、测试、根因或 Benchmark；
69. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Device/Policy/Provider 变化；
    - 测试命令和真实结果；
    - Identity/Safety；
    - Devices/Sync；
    - Camera/Registration；
    - Wiring/Probe；
    - Instrument Configuration；
    - Measurements/Logs；
    - Timeline；
    - Symptoms/Hypotheses；
    - Tests/Confirmations；
    - Repairs/Regression；
    - Root Cause/Report；
    - Privacy/Security；
    - 性能；
    - 已知限制；
    - 下一阶段建议。

---

# 103. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture；危险动作只使用模拟设备。

## Session and Identity

1. Valid Session；
2. Missing Project；
3. Board Revision Confirmed；
4. Board Revision Conflict；
5. Variant Conflict；
6. Serial Number；
7. Manufacturing Lot；
8. Firmware Build Match；
9. Firmware Build Mismatch；
10. QR Identity；
11. Silkscreen Identity；
12. Firmware Identity；
13. USB Descriptor；
14. Manual Confirmation；
15. Identity Hash。

## Safety

16. S0 Bench；
17. S1 Low Voltage；
18. S2 Battery；
19. S3 Mains；
20. Stored Energy；
21. High Current；
22. Hot Surface；
23. Moving Mechanism；
24. Differential Probe Required；
25. Scope Ground Risk；
26. Current Limit Missing；
27. Operator Unauthorized；
28. PPE Required；
29. Emergency Disconnect Missing；
30. Prohibited Bypass；
31. Safety Approval；
32. Safety Gate Replay；
33. High-risk Voice Command Rejected；
34. Typed Command Allowed；
35. Raw SCPI Rejected。

## Devices and Gateway

36. Camera Discovery；
37. Oscilloscope Discovery；
38. Logic Analyzer Discovery；
39. DMM Discovery；
40. Power Supply Discovery；
41. Serial Discovery；
42. Unknown Device；
43. Device Offline；
44. Calibration Valid；
45. Calibration Expired；
46. Capability Snapshot；
47. Read-only Permission；
48. Write Permission Missing；
49. Gateway Authentication；
50. Offline Buffer；
51. Device Reconnect；
52. Command Pre/Post Snapshot；
53. Command Range Fail；
54. Command Approval Expired；
55. Gateway Credential Isolation。

## Synchronization

56. Shared Trigger；
57. Software Timestamp；
58. Serial Marker；
59. Audio Marker；
60. Device Offset；
61. Drift；
62. Low-quality Sync；
63. Timeline Alignment；
64. Event Order Ambiguous；
65. Sync Rebuild。

## Camera and Registration

66. Camera Intrinsics；
67. Focus Poor；
68. Lighting Poor；
69. Board Outline Match；
70. Fiducial Match；
71. Manual Anchor；
72. Wrong Board Registration；
73. Perspective；
74. Occlusion；
75. Component Localization；
76. Test Point Overlay；
77. Probe Tip Candidate；
78. Ground Clip Candidate；
79. Spatial Confidence；
80. Registration Diff。

## Visual Assembly

81. Missing Component Candidate；
82. Wrong Orientation Candidate；
83. Tombstone；
84. Skew；
85. Lifted Pin；
86. Solder Bridge；
87. Insufficient Solder；
88. Flux False Positive；
89. Burn Mark；
90. Connector Not Seated；
91. Cable Reversed；
92. Jumper Mismatch；
93. BGA Hidden Boundary；
94. Manual Confirm；
95. Visual Reject。

## Wiring and Probe

96. Correct Connector；
97. Wrong Connector；
98. Pin 1 Reversed；
99. TX/RX Swapped；
100. Power Polarity；
101. Ground Missing；
102. FPC Contact Side；
103. Jumper State；
104. Probe on Correct Test Point；
105. Probe Location Uncertain；
106. Probe Ratio；
107. Probe Voltage Rating；
108. Ground-loop Risk；
109. Adjacent Short Risk；
110. Probe Confirmation。

## Oscilloscope

111. Raw Waveform；
112. Screenshot Only；
113. Probe Ratio Mismatch；
114. AC Coupling；
115. Clipping；
116. Aliasing；
117. Sample Rate Low；
118. Memory Short；
119. Trigger Wrong；
120. Bandwidth Limit；
121. Vertical Scale Poor；
122. Timebase Poor；
123. DC Level；
124. Frequency；
125. Duty；
126. Rise Time；
127. Ripple；
128. Overshoot；
129. Startup Delay；
130. Glitch；
131. Quality Vector；
132. Known-good Comparison；
133. Simulation Envelope；
134. Condition Mismatch；
135. Probe Loading。

## Logic Analyzer

136. Threshold Correct；
137. Threshold Wrong；
138. Sample Rate Low；
139. Channel Map；
140. UART Decode；
141. SPI Decode；
142. I2C Address；
143. CAN Decode；
144. Framing Error；
145. CRC Error；
146. Retry；
147. Bus Contention；
148. Boot Sequence；
149. Idle Level；
150. Decode Unknown。

## DMM and Power

151. DC Voltage；
152. Resistance Unpowered；
153. Continuity；
154. Current Wrong Terminal；
155. Range Overflow；
156. Reference Point Missing；
157. Power Supply Read-only；
158. Output Off；
159. Current Limit Active；
160. Brownout Loop；
161. Inrush；
162. Rail Sequence；
163. Remote Sense；
164. Electronic Load Read-only；
165. Power Write Confirmation。

## Logs and Audio

166. Serial 115200；
167. Baud Mismatch；
168. Logic Level Mismatch；
169. JSON Log；
170. Binary Log；
171. Bootloader Log；
172. Watchdog Reset；
173. Brownout Reset；
174. Assert；
175. Stack Trace；
176. RTT；
177. SWO；
178. Secret Redaction；
179. Operator Voice Note；
180. Speaker Segmentation；
181. Action Marker；
182. Relay Click Candidate；
183. Coil Whine Candidate；
184. Acoustic Low Confidence；
185. Consent Missing。

## Timeline and Comparison

186. Operator Action；
187. Power Event；
188. Instrument Config Change；
189. Waveform + Log Alignment；
190. Current + Reset Alignment；
191. Visual + Continuity；
192. Expected Behavior；
193. Version Mismatch；
194. Numeric Pass；
195. Numeric Fail；
196. Sequence Mismatch；
197. Evidence Conflict；
198. Missing Conditions；
199. Timeline Export；
200. Timeline Replay。

## Symptoms and Hypotheses

201. No Power；
202. Overcurrent；
203. Boot Loop；
204. Communication Timeout；
205. Analog Noise；
206. Intermittent；
207. Solder Defect Candidate；
208. Instrument Error Symptom；
209. Signature Match；
210. Negative Signature；
211. Hypothesis Generate；
212. Supporting Evidence；
213. Contradicting Evidence；
214. Missing Evidence；
215. Alternative Hypothesis；
216. Hypothesis Rejected；
217. Hypothesis Restored；
218. AI Invented Measurement Rejected；
219. Bounded Context；
220. Private Provider Policy。

## Test Planning

221. Visual Reinspection；
222. Unpowered Continuity；
223. Current-limited Power-up；
224. Rail Measurement；
225. Clock Check；
226. Reset Check；
227. Serial Capture；
228. Logic Capture；
229. Thermal Observation；
230. Controlled Load；
231. Information Gain；
232. Safety Ranking；
233. Reversible Test；
234. High-risk Test Blocked；
235. Test Preconditions；
236. Decision Branch；
237. Evidence Requirement；
238. Abort；
239. Rollback；
240. Human Confirmation。

## Repair and Regression

241. Instrument Setting Repair；
242. Reseat Cable；
243. Clean Board；
244. Reflow Candidate；
245. Replace Component；
246. Correct Orientation；
247. Firmware Config；
248. Clock Change；
249. Reset Change；
250. Design Change；
251. Process Change；
252. Repair Approval；
253. Unauthorized Repair Rejected；
254. Pre/Post Evidence；
255. Regression Plan；
256. Power Regression；
257. Interface Regression；
258. Firmware Regression；
259. Thermal Regression；
260. Manufacturing Regression；
261. Repeatability；
262. Multiple Samples；
263. New Finding；
264. Rollback；
265. Regression Pass。

## Root Cause, Privacy and Scale

266. Root Cause Suspected；
267. Root Cause Supported；
268. Root Cause Verified；
269. Root Cause Unresolved；
270. Alternative Not Rejected；
271. Repair Did Not Change Symptom；
272. Report Generation；
273. Redacted Report；
274. Knowledge Candidate；
275. Knowledge Approval；
276. Face Redaction；
277. Background Redaction；
278. Screen Redaction；
279. Audio Redaction；
280. Log Token Redaction；
281. Retention Apply；
282. Tenant Isolation；
283. Project ACL；
284. Audit Replay；
285. 8-hour Session；
286. 1M Timeline Events；
287. 100 Waveform Captures；
288. 20 Devices；
289. Gateway Network Loss；
290. Partial Device Failure；
291. Model Provider Failure；
292. Stream Backpressure；
293. Worker Cancellation；
294. Artifact Integrity；
295. Disaster Recovery。

---

# 104. 初始质量目标

```text
Session Board/Revision/Variant Identity Coverage = 100%
Safety Gate before State-changing Instrument Command = 100%
Raw Instrument Command Passthrough = 0
Critical Probe Placement Human Confirmation = 100%
Waveform Evidence with Raw Samples and Configuration = 100%
Logic Capture with Threshold/Channel Map/Configuration = 100%
DMM Reading with Mode/Range/Reference Context = 100%
Power Capture with Setpoint/Limit/Output-state Context = 100%
Evidence Artifact Hash Coverage = 100%
Timeline Evidence Time Context Coverage = 100%
AI-generated Measurement Values = 0
Single-evidence Root Cause Verification = 0
Root Cause Verified without Regression = 0
High-risk Action Automatically Executed = 0
Repair Automatically Executed by AI = 0
Private Design/Logs/Video Sent to Unapproved Provider = 0
Recording without Indicator/Policy = 0
Debug Report Source Evidence Trace Coverage = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 105. 性能要求

常规 Session：

```text
1–8 Cameras/Streams
1–20 Instruments
1–100 Waveform Captures
1–50 Logic Captures
1–10M Log Events
1–1M Timeline Events
1–100 Hypotheses
1–200 Test Steps
```

目标：

```text
Session Readiness P95 < 15 s excluding device connection
Device Discovery P95 < 10 s per gateway
Configuration Read P95 < 5 s per device
Camera Overlay Latency P95 < 250 ms on local network
Timeline Event Ingest P95 < 200 ms
Waveform Metadata Validation P95 < 2 s
Waveform Feature Extraction P95 < 5 s for 10M samples
Log Ingest Sustained > 100k events/s per worker candidate
Timeline Query P95 < 500 ms for 1M events
Hypothesis Update P95 < 15 s excluding model calls
Interactive Finding Query P95 < 300 ms
```

流式要求：

- Camera、waveform、log 分离通道；
- Backpressure；
- 本地缓冲；
- 可恢复上传；
- Chunk Hash；
- 不丢失 Command 和 Confirmation；
- 允许降级为只读和离线；
- 大视频不进入语言模型上下文；
- 视觉分析使用抽帧、ROI 和事件触发；
- 原始波形保存在对象存储，模型只接收受控特征和证据引用。

---

# 106. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/labsight-debug-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第46个 Agent：

LabSight Multimodal Field Debugging,
Instrument Orchestration & Fault Evidence Agent /
LabSight 现场调试 Agent。

本 Agent 接收：

- Agent 10–15 Baselines、Requirements、Architecture、Selection、Compatibility；
- Agent 16/18/20 EDA、Netlist、Pin、Pad、Test Point 和 Board Coordinates；
- Agent 21 Firmware Build、Pin Mux、Logs 和 Debug Metadata；
- Agent 22–30 Review、Simulation、PCB、Mechanical、Manufacturing；
- Agent 31–45 Material、Lot、Test、Quality 和 Traceability；
- Camera、Microphone、Oscilloscope、Logic Analyzer、DMM、Power Supply；
- Serial/JTAG/SWD/Network/Other Instrument Streams；
- Human Operator and Remote Expert；

输出：

- Debug Session Snapshot；
- Identity and Safety Gate；
- Device Capability and Configuration；
- Camera Calibration/Board Registration；
- Wiring/Probe Placement；
- Multimodal Evidence Timeline；
- Visual/Measurement/Waveform/Logic/Log Evidence；
- Expected-vs-Observed；
- Symptoms/Fault Signatures；
- Hypothesis Graph；
- Safe Test Plan；
- Human Confirmations；
- Repair Candidates；
- Regression；
- Root Cause/Report；
- Knowledge Candidate；
- Downstream Work Packages。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10–30、Agent 31–46 相关规格；
3. docs/labsight-debug-agent-spec.md；
4. 当前 LabSight Camera/Hardware/Firmware；
5. 当前 Device Gateway 和 Instrument Adapters；
6. 当前 EDA/Netlist/Test Point/3D；
7. 当前 Firmware Build/Logs/Pinmux；
8. 当前 Simulation/Expected Waveform；
9. 当前 Manufacturing/Quality/Traceability；
10. 当前 Session/Issue/Test/Knowledge 模型；
11. 当前 Safety/Permissions/Privacy；
12. 当前 Vision/Waveform/Log/Audio Pipeline；
13. 当前 WebRTC/WebSocket/Object Storage；
14. 当前 AI Provider/Prompt/Structured Output；
15. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Confirm Board/Revision/Variant/Firmware Identity；
- One Session = One Immutable Input Snapshot；
- Safety Gate before Instrument Write；
- Human Executes High-risk Actions；
- Credentials Remain in Local Gateway；
- Runtime Capability Discovery；
- Raw Instrument Metadata Precedes Screen Vision；
- Screenshot Is Not Waveform Truth；
- Raw Samples and Configuration Required；
- Timeline and Time-sync First-class；
- Camera Calibration and Board Registration Explicit；
- Probe Tip/Ground/Rating/Location Explicit；
- Probe Placement Requires Human Confirmation；
- Scope Ground Risk Is a Gate；
- Visual Findings Are Candidates；
- Hidden Joints Are Not RGB Claims；
- Wiring Is Pin-by-pin；
- Expected Behavior Binds Version and Conditions；
- Deterministic Measurement Analysis First；
- AI Does Not Invent Measurements；
- AI Produces Hypotheses, Not Root-cause Approval；
- Supporting and Contradicting Evidence Required；
- Alternative Hypotheses Required；
- Safe/Non-invasive/Reversible Tests First；
- Typed Instrument Command IR；
- No Raw SCPI Passthrough；
- Command Range Validation and Pre/Post Snapshot；
- No Automated Bypass/Short/High-voltage/Rework；
- Repair Is Candidate and Human-approved；
- Regression after Repair；
- Verified Root Cause Requires Mechanism/Reproduction/Repair/Regression；
- Raw Evidence Immutable；
- Redacted Export and Privacy Policy；
- No External Private Design/Video/Logs；
- 不用客户现场数据做公开 Fixture；
- 不伪造仪器、测量、根因或 Benchmark。

现在只执行 Phase 0，不实现业务代码，不连接真实设备做写操作：

1. 侦察当前仓库；
2. 查找 Agent 10–15 Baselines；
3. 查找 Agent 16/18/20 EDA/Netlist/Pin/Test Point；
4. 查找 Agent 21 Firmware/Logs/Pinmux；
5. 查找 Agent 22–30 Review/Simulation/Manufacturing；
6. 查找 Agent 31–45 Quality/Traceability；
7. 查找 LabSight Camera/Lighting/Mount；
8. 查找 Gateway；
9. 查找 Camera/Scope/Logic/DMM/Power/Serial Adapters；
10. 查找 Device Discovery/Capabilities/Configurations；
11. 查找 Time Sync/Timeline；
12. 查找 Camera Calibration/Board Registration；
13. 查找 Visual Inspection/Probe Tracking；
14. 查找 Waveform/Logic/Log/Audio Pipeline；
15. 查找 Symptom/Hypothesis/Test/Repair/Regression；
16. 查找 Safety/Command Approval；
17. 查找 Privacy/Redaction/Retention；
18. 查找 Remote Collaboration；
19. 查找 UI/API/Worker/Storage/Security；
20. 统计仪器连接和元数据完整率；
21. 统计波形截图与原始数据；
22. 统计调试记录完整性；
23. 统计重复故障和根因确认时间；
24. 抽样分析开源、合成、脱敏或授权 Fixture；
25. 在 docs/labsight-debug-implementation-plan.md 中生成实施计划；
26. 在 docs/session-and-identity.md 中定义 Session；
27. 在 docs/safety-and-command-policy.md 中定义安全；
28. 在 docs/device-gateway-and-adapters.md 中定义 Gateway；
29. 在 docs/time-synchronization.md 中定义同步；
30. 在 docs/camera-and-board-registration.md 中定义视觉定位；
31. 在 docs/wiring-and-probe-placement.md 中定义接线和探头；
32. 在 docs/instrument-configuration.md 中定义仪器设置；
33. 在 docs/waveform-and-logic-analysis.md 中定义分析；
34. 在 docs/logs-and-audio.md 中定义日志和语音；
35. 在 docs/multimodal-timeline.md 中定义时间线；
36. 在 docs/symptoms-and-fault-signatures.md 中定义症状；
37. 在 docs/hypothesis-and-test-planning.md 中定义推理和测试；
38. 在 docs/repairs-and-regression.md 中定义修复；
39. 在 docs/root-cause-and-knowledge.md 中定义根因；
40. 在 docs/privacy-and-retention.md 中定义隐私；
41. 在 docs/downstream-agent-contracts.md 中定义下游；
42. 在 docs/ai-boundaries.md 中定义 AI；
43. 在 docs/security.md 中定义安全；
44. 在 docs/labsight-debug-migration-plan.md 中定义迁移；
45. 在 docs/labsight-debug-benchmark-plan.md 中定义 Benchmark；
46. 给出拟新增、拟修改和拟复用文件；
47. 给出 Phase 1 精确范围；
48. 不修改业务代码；
49. 不创建 Migration；
50. 不安装 Driver/VISA/FFmpeg/模型；
51. 不启动真实 DUT；
52. 不改变仪器输出；
53. 不执行 Firmware；
54. 不触发 Agent 19、采购、返修或生产；
55. 不调用生产外部模型；
56. 不读取或打印 Secret/客户工程/日志；
57. 运行仓库已有 lint、type check、test、build 和 security scan；
58. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 10–45 Contracts；
- Session/Input Gate；
- Identity；
- Safety；
- Gateway/Devices；
- Time Sync；
- Camera/Registration；
- Wiring/Probe；
- Instrument Configuration；
- Waveform/Logic/DMM/Power；
- Logs/Audio；
- Timeline；
- Symptoms/Expected Behavior；
- Fault Signatures；
- Hypothesis/Test；
- Confirmation/Command Policy；
- Findings/Repairs；
- Regression/Root Cause；
- Report/Knowledge；
- Privacy/Security；
- API/Events；
- 旧流程迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 107. 后续 Phase 提示词模板

```text
继续实现 LabSight Debug Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10–46 相关规格；
3. 阅读 LabSight Debug Implementation Plan；
4. 阅读 Session、Safety、Gateway、Synchronization、Vision、Instrument、
   Timeline、Hypothesis、Repair、Privacy、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Identity and Safety First；
- Evidence Timeline Is Truth；
- Instrument Metadata First；
- Typed Commands and Human Confirmation；
- Deterministic Measurement Analysis；
- AI Hypotheses Are Candidates；
- Repair Requires Approval and Regression；
- Privacy by Design；
- No External Private Data；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Contract/Safety/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. simulated-device tests；
10. timeline/media tests；
11. signal/log tests；
12. hypothesis/test-planner tests；
13. privacy/security tests；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Device/Policy/Provider 变化；
- 测试命令和真实结果；
- Identity/Safety；
- Devices/Sync；
- Camera/Registration；
- Wiring/Probe；
- Instrument Configuration；
- Measurements/Logs；
- Timeline；
- Symptoms/Hypotheses；
- Tests/Confirmations；
- Repairs/Regression；
- Root Cause/Report；
- Privacy/Security；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 108. MVP 演示流程

演示对象：

```text
便携式双通道测量仪原型板
+ LabSight 顶视摄像头
+ USB 示波器
+ 8 通道逻辑分析仪
+ 台式万用表
+ 可编程电源
+ USB-UART
```

故障场景：板卡上电后反复复位，USB 无法稳定枚举，串口偶尔输出乱码。

1. 从 ezPLM 打开 Debug Work Package；
2. 创建 LabSight Session；
3. 扫描板卡 QR；
4. 摄像头识别 Silkscreen Revision；
5. 串口 Bootloader 返回 Firmware Build；
6. 系统发现：
7. Board Revision 是 B；
8. 制造记录是 Assembly B2；
9. Firmware Build 却是给 Revision A 的；
10. 标记 Firmware/Board Identity Conflict；
11. 工程师确认当前样机确实误刷了 A 版 Firmware；
12. 但不立即宣布这是全部根因；
13. Safety Context：
14. 最高 5V；
15. 电流限制 500mA；
16. 无市电裸露；
17. 无大储能；
18. Safety Level S1；
19. 发现示波器、逻辑分析仪、DMM、电源和串口；
20. 读取设备 Capability；
21. 读取电源输出状态；
22. 当前 Output Off；
23. 读取示波器配置；
24. Channel 1 Probe Ratio 被设为 10X；
25. 实际探头为 1X；
26. 生成 `probe_ratio_mismatch`；
27. 工程师批准改为 1X；
28. 保存修改前后配置；
29. 相机进行标定；
30. 使用板框、安装孔和两个连接器完成 Board Registration；
31. 在画面叠加：
32. TP_5V；
33. TP_3V3；
34. TP_1V2；
35. NRST；
36. MCU Clock；
37. USB D+/D- 区域；
38. 摄像头发现 USB-C 连接器旁 ESD 器件疑似偏移；
39. 标记视觉候选，但不当作根因；
40. 工程师确认探头 CH1 接 TP_3V3；
41. Ground 接 GND Test Point；
42. 系统检查无高侧地风险；
43. 建议第一个测试：只读检查未加电电阻；
44. DMM 设置 Resistance；
45. 工程师确认量程和测点；
46. 3V3 对地阻值正常；
47. 排除明显短路候选；
48. 建议当前限制 150mA 的受控上电；
49. 这是状态改变操作，要求人工确认；
50. 工程师确认后在电源上手工加电；
51. LabSight 记录 Operator Action Marker；
52. 同步采集：
53. 电源电流；
54. 3V3 波形；
55. Reset；
56. 串口日志；
57. 摄像头；
58. 电流曲线显示：
59. 0 → 85mA；
60. 突然升至 145mA；
61. 电源进入 Current Limit；
62. 3V3 降到约 2.7V；
63. Reset 被拉低；
64. Boot 重启；
65. 串口记录 Brownout Reset；
66. Timeline 将电源限流、3V3 下跌、Reset 和 Brownout 对齐；
67. Hypothesis H1：电源电流限值过低；
68. Hypothesis H2：板上存在间歇性高电流故障；
69. Hypothesis H3：Revision A Firmware 错误配置了外设，造成额外负载；
70. Supporting Evidence：
71. 电流触及 Limit；
72. Rail 下跌；
73. Brownout Log；
74. Contradicting/Unknown：
75. 145mA 是否属于正常启动峰值未知；
76. 从 Agent 23/历史 Known-good 加载启动电流包络；
77. Known-good Revision B 启动峰值可达 220mA、持续 12ms；
78. 当前 150mA Limit 明显不足；
79. H1 获得强支持；
80. 生成 Test Candidate：
81. 将 Limit 提高到 300mA；
82. 保持 Voltage 5.0V；
83. 设置 OCP 350mA；
84. 同步捕获；
85. 该操作经 Safety Gate 和工程师确认；
86. 重新上电；
87. 板卡不再 Brownout；
88. 但 USB 仍无法稳定枚举；
89. Root Cause 不能关闭；
90. 串口仍有乱码；
91. 系统读取 USB-UART 配置；
92. Adapter 是 3.3V；
93. 目标 UART 是 1.8V；
94. Agent 15 Baseline 中已有 Level Compatibility Warning；
95. 相机确认 USB-UART 直接接在目标 Header；
96. 标记 Wiring/Voltage Conflict；
97. 建议改用 1.8V Adapter；
98. 工程师手工更换；
99. 串口日志恢复正常；
100. 日志显示 USB PHY Calibration Failed；
101. Hypothesis H3 更新：
102. Revision A Firmware 使用不同的 USB Clock 配置；
103. 加载 Revision A/B Firmware Pin/Clock Diff；
104. 发现 A 版使用外部 12MHz Clock；
105. B 版硬件改为 24MHz Clock；
106. 逻辑/示波器测量确认实际 Clock 24MHz；
107. 当前 Firmware 按 12MHz 配置；
108. H3 获得强支持；
109. 创建 Firmware Test Candidate：
110. 刷入正确 Revision B Build；
111. Firmware Flash 属状态改变操作；
112. 需要确认 Board Identity、Build Hash、Rollback Image 和电源稳定；
113. 工程师批准并通过现有烧录工具手工执行；
114. LabSight 只记录 Build 和操作；
115. 重新上电；
116. USB 成功枚举；
117. 串口正常；
118. 电流启动曲线在 Known-good Envelope 内；
119. 运行 20 次 Power Cycle；
120. 全部通过；
121. 视觉上的 ESD 偏移候选仍存在；
122. 进一步显微检查确认器件焊接正常，只是 Silkscreen 和视角造成错觉；
123. 关闭视觉 Finding；
124. Root Cause 记录拆分为：
125. RC1：现场电源限流设置过低，导致 Brownout Loop；
126. RC2：错误 Firmware Build 与 Board Revision 不匹配，导致 USB Clock 配置错误；
127. Contributing Factor：错误电平 USB-UART 造成乱码，干扰诊断；
128. 创建 Repair/Prevention：
129. LabSight 上电模板默认从制造测试配置读取 Current Limit；
130. Firmware 烧录前校验 Board Revision；
131. USB-UART 适配器增加电平标签和识别；
132. Agent 21创建 Build Compatibility Guard；
133. Agent 29在 Assembly/Programming Note 中增加 Firmware Hash；
134. Agent 45增加生产测试身份校验；
135. Agent 11创建任务和 Owner；
136. 生成 Regression Plan；
137. 20 次启动；
138. USB 枚举；
139. 双通道采集；
140. Sleep/Wake；
141. Firmware Update；
142. 当前测试全部通过；
143. 生成 Debug Report；
144. 原始视频只保存在私有项目；
145. 报告导出时遮挡背景标签和人员；
146. 创建 Knowledge Candidate：
147. “电源限流 + 错版 Firmware 导致的双重启动故障”；
148. 经过工程和质量审核后发布到企业知识库；
149. Session Closed。

---

# 109. 生产上线顺序

第一阶段：

```text
Session / Identity / Safety
Local Gateway
Camera Live View
Device Discovery
Oscilloscope / DMM / Power / Serial Read-only
Evidence Timeline
Manual Hypothesis and Test Records
Debug Report
```

第二阶段：

```text
Board Registration
Probe/Test-point Overlay
Waveform Features and Expected Comparison
Logic Decode
Log Correlation
Structured Hypothesis Graph
Test Planning and Human Confirmations
Regression and Knowledge Candidate
```

第三阶段：

```text
Advanced Visual Inspection
Thermal Overlay
Remote Collaboration
ADALM2000/Scopy Integration
Automated Fixture Integration
Golden-board Differential Debug
Production-line LabSight
```

上线优先确保：

```text
现场调试记录能否完整回答：哪块板、什么版本、谁操作、怎么接、怎么量、何时发生
仪器显示值是否绑定真实量程、探头、配置、参考点和原始数据
摄像头叠加的测点是否来自 KiCad PCB 坐标而不是视觉模型猜测
每个根因是否有支持证据、矛盾证据、验证步骤和回归结果
任何会改变 DUT 状态的动作是否经过安全检查和人工确认
所有现场资料是否在隐私、权限和企业数据边界内
```

一个靠谱的 LabSight Agent，不是对着板子说“看起来像焊接问题”。它应该先确认这是哪一版板、探头到底接在哪、示波器是不是设错十倍、复位发生前电流和电压怎样变化、串口同一时刻说了什么，再设计一个最安全、最省时间、最能区分假设的下一步测试。
