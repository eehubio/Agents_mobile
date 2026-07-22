# ERC 与 AI 原理图审查 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：22  
> Agent 名称：ERC, Device-Aware Schematic Review & Design Rule Agent  
> 中文名称：ERC 与 AI 原理图审查 Agent  
> 类型：程序＋混合型  
> 版本：V1.0  
>
> 定位：在 KiCad/EDA 原生 ERC 基础上，对结构化原理图、Pin-to-Net、器件参数、数据手册、参考设计、企业规范和可选 PCB 几何进行多层审查，发现传统 ERC 难以覆盖的电源去耦、悬空输入、接口保护、晶振网络、复位、启动配置、器件额定值、时序、电源域、模拟偏置和典型应用偏差；输出可解释 Finding、证据链、严重度、置信度、影响范围、修复建议和供 Agent 19 执行的结构化补丁计划。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Part IR、Pin IR、Net IR、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、未决连接和 Release Level
> - Agent 20：符号/封装/Pin-Pad、库来源和实例漂移校验
> - Agent 21：PinMux、Clock、Peripheral、Boot、Firmware Project IR，可选
> - Agent 19：KiCad 执行环境、Change Plan、Readback、ERC/DRC 和回滚
> - 元器件数据库、器件参数、引脚定义、数据手册、应用笔记、参考设计和典型应用拓扑
> - 企业设计规范、客户规范、产品类别规则和历史问题库
>
> 下游：
> - Agent 19：执行低风险修复或人工批准的 Change Plan
> - Agent 16：重新解析修复后的工程并生成 Semantic Diff
> - Agent 21：把硬件审查结果用于固件 PinMux、Boot、Clock 和外围初始化
> - Agent 31/32：器件身份、参数和 BOM 关联
> - Agent 43：NPI、工程冻结和制造资料发布 Gate
> - Agent 44：制造询价前的设计成熟度和风险摘要
> - Agent 45：测试点、ICT/FCT 规则和故障模式
> - Review Workbench、CI、Git Review、设计评审和质量报告
>
> 核心输出：
> - Native ERC Import
> - Normalized ERC Finding
> - Advanced Schematic Review Finding
> - Rule Evaluation Trace
> - Device Evidence Package
> - Reference Topology Match
> - Typical Application Deviation
> - Rating / Derating Assessment
> - Power Integrity Review
> - Interface Protection Review
> - Clock / Crystal Review
> - Reset / Boot Review
> - Analog Review
> - Review Queue
> - Waiver / Decision / Patch
> - Agent 19 Canonical Change Plan
> - Post-fix Regression Report
> - Schematic Review Release Gate
>
> 重要边界：
> - 本 Agent 不把“与典型应用不同”自动判定为错误；偏差必须结合用途、器件版本和工程约束解释。
> - 本 Agent 不把器件数据手册中的 Absolute Maximum 当作正常设计目标，推荐工作范围和降额规则必须分开。
> - 本 Agent 不根据模糊 OCR 或未审核的 Pin-to-Net 生成确定性错误。
> - Agent 18 未达到允许的 Release Level 时，只能输出候选或阻断项。
> - Agent 20 存在 Pin-Pad、库身份或器件来源阻断时，不允许做高置信度器件级审查。
> - 通用 LLM 不负责建立 Net Graph、不决定电气连接、不修改额定值、不覆盖规则结果。
> - AI 可以辅助解释、归类、检索相关证据、生成审核摘要和候选修复说明。
> - 所有 Finding 必须有规则、数据源、证据、版本、置信度和可复现输入。
> - 所有自动修复必须通过 Agent 19 的 Workspace、Snapshot、Preview、Readback 和 Rollback。
> - 不把“没有发现问题”描述为设计已经安全、可靠或满足认证。
> - 不把私有工程、客户规范、原理图和器件数据发送给外部通用模型。

---

# 1. Agent 22 的系统位置

```text
EDA Project / Netlist / Device Data / Requirements
                     ↓
Agent 16 / 18 / 20 Input Gate
                     ↓
Native ERC Import and Normalization
                     ↓
Structural Connectivity Review
                     ↓
Device-aware Semantic Review
                     ↓
Parameter / Rating / Topology Review
                     ↓
Evidence Fusion and Confidence
                     ↓
Review Queue / Waiver / Repair Candidate
                     ↓
Agent 19 Controlled Fix
                     ↓
Reparse / ERC / Semantic Diff / Regression
```

---

# 2. 为什么不能只依赖原生 ERC

传统 ERC 通常擅长发现：

```text
未连接引脚
输出对输出
电源输入无驱动
引脚类型冲突
重复位号
错误 No Connect
标签或层级连接问题
```

但通常不能完整判断：

```text
每个电源 Pin 是否有合适的本地去耦
去耦值和电压等级是否合理
I2C 是否缺少上拉
USB、CAN、RS-485 是否缺少保护
晶振负载电容是否与器件和晶体匹配
复位和 Boot Strap 是否有稳定默认状态
模拟输入是否有直流偏置回路
运放输入共模和输出摆幅是否满足
MOSFET、稳压器、电阻和电容是否有足够额定值
参考设计中的关键保护或补偿网络是否遗漏
```

Agent 22 的价值是把这些“工程经验”变成版本化、可执行、可解释的规则。

---

# 3. 审查层级

## 3.1 Level 0：输入可信度 Gate

检查：

```text
Agent 16 IR Schema
Agent 18 Release Level
Agent 20 Library/Pin-Pad Status
器件身份置信度
数据手册和参数版本
工程 Revision
```

## 3.2 Level 1：Native ERC

导入：

```text
KiCad ERC
其他 EDA ERC
Agent 16 结构验证
Agent 18 Connectivity Conflict
```

## 3.3 Level 2：通用结构规则

例如：

```text
悬空输入
无偏置的模拟输入
多输出冲突
无回路网络
未使用功能单元
电源域错误连接
```

## 3.4 Level 3：器件类别规则

例如：

```text
MCU 去耦和 Boot
LDO 输入输出电容
Op Amp 输入偏置
MOSFET Gate 和保护
接口收发器终端和保护
```

## 3.5 Level 4：具体型号规则

来自：

```text
数据手册
Errata
应用笔记
参考设计
批准的企业经验规则
```

## 3.6 Level 5：系统上下文规则

结合：

```text
板卡用途
电源输入
接口暴露程度
工作环境
成本等级
测试要求
安全等级
Firmware 配置
```

---

# 4. 建设目标

系统必须能够：

1. 接收 Agent 16 Schematic/Part/Pin/Net IR；
2. 接收 Agent 18 Reviewed Netlist；
3. 接收 Agent 20 Library/Pin-Pad 状态；
4. 接收 Agent 21 PinMux/Clock/Boot 信息，可选；
5. 导入 KiCad ERC 结果；
6. 导入其他 EDA ERC；
7. 标准化 ERC Finding；
8. 去重相同问题；
9. 保留原始 ERC 文本和对象引用；
10. 建立 Rule Context；
11. 建立 Part Role；
12. 建立 Net Role；
13. 建立 Power Rail；
14. 建立 Power Domain；
15. 建立 Interface；
16. 建立 Functional Block；
17. 建立 Signal Class；
18. 建立 Device Capability Snapshot；
19. 建立 Parameter Snapshot；
20. 建立 Datasheet Evidence；
21. 建立 Reference Design Evidence；
22. 建立 Typical Application Graph；
23. 建立 Enterprise Rule Bundle；
24. 识别所有电源 Pin；
25. 识别地 Pin；
26. 识别模拟电源；
27. 识别数字电源；
28. 识别参考电压；
29. 识别内部稳压器电容 Pin；
30. 识别去耦电容；
31. 识别 Bulk Capacitor；
32. 识别旁路网络；
33. 识别滤波电感/磁珠；
34. 识别电源树；
35. 识别稳压器；
36. 识别 Enable/Power Good；
37. 识别上电时序；
38. 检查每个电源 Pin 的去耦覆盖；
39. 检查共享去耦是否合理；
40. 检查去耦值；
41. 检查去耦电压额定值；
42. 检查电容介质和降额，可选；
43. 检查 Bulk 容量；
44. 检查稳压器输入电容；
45. 检查稳压器输出电容；
46. 检查 ESR/稳定性要求；
47. 检查反向电流保护；
48. 检查 Enable 默认状态；
49. 检查 Power Good 上拉；
50. 检查电源域短接；
51. 检查 AGND/DGND/PGND；
52. 检查参考电压滤波；
53. 检查内部 LDO/VCAP 电容；
54. 检查悬空数字输入；
55. 检查悬空模拟输入；
56. 检查 CMOS 输入默认状态；
57. 检查未使用门输入；
58. 检查未使用运放；
59. 检查未使用比较器；
60. 检查未使用 ADC 输入；
61. 检查未使用 MCU Pin；
62. 检查 Open-drain 上拉；
63. 检查 I2C 上拉；
64. 检查中断输入偏置；
65. 检查 Chip Select 默认状态；
66. 检查 Enable/Shutdown 默认状态；
67. 检查 MOSFET Gate 下拉/上拉；
68. 检查 BJT Base 偏置；
69. 检查继电器/线圈续流；
70. 检查 USB D+/D-；
71. 检查 USB CC；
72. 检查 USB VBUS；
73. 检查 USB ESD；
74. 检查 USB 串联电阻；
75. 检查 USB Role；
76. 检查 CAN 终端；
77. 检查 CAN 共模电感，可选；
78. 检查 CAN TVS；
79. 检查 CAN 收发器电源和待机；
80. 检查 RS-485 终端；
81. 检查 RS-485 Fail-safe；
82. 检查 RS-485 TVS；
83. 检查 UART 电平兼容；
84. 检查 SPI CS 偏置；
85. 检查 SPI 电平和电压域；
86. 检查 I2C 地址冲突；
87. 检查 I2C 电压域；
88. 检查 Ethernet PHY 终端；
89. 检查 Magnetics/Center Tap；
90. 检查 HDMI/高速接口保护候选；
91. 检查外部连接器 ESD；
92. 检查反接保护；
93. 检查浪涌和过压保护；
94. 检查保险丝/PTC；
95. 检查晶振连接；
96. 检查负载电容；
97. 检查晶体频率；
98. 检查晶体 ESR；
99. 检查 MCU Drive Level；
100. 检查外部时钟输入模式；
101. 检查晶振偏置电阻；
102. 检查晶振 Pin 误用；
103. 检查复位上拉/下拉；
104. 检查复位电容；
105. 检查复位 Supervisor；
106. 检查复位开关；
107. 检查 Open-drain 复位源；
108. 检查 Boot Strap；
109. 检查 Boot 默认状态；
110. 检查 Boot 与运行时复用；
111. 检查 Debug 接口；
112. 检查 SWD/JTAG 上拉/下拉；
113. 检查启动 Flash 配置；
114. 检查外部存储 Boot；
115. 检查器件绝对最大值；
116. 检查推荐工作范围；
117. 检查电压额定值；
118. 检查电流额定值；
119. 检查功率额定值；
120. 检查温度额定值；
121. 检查降额；
122. 检查电阻功耗；
123. 检查电容耐压；
124. 检查二极管反向电压；
125. 检查 MOSFET VDS/VGS/ID；
126. 检查稳压器 Vin/Vout/Dropout；
127. 检查电感饱和电流；
128. 检查 TVS 工作/击穿电压；
129. 检查连接器电流；
130. 检查运放供电；
131. 检查输入共模；
132. 检查输出摆幅；
133. 检查增益带宽；
134. 检查压摆率；
135. 检查输入偏置回路；
136. 检查稳定性和容性负载候选；
137. 检查比较器迟滞；
138. 检查 ADC 输入范围；
139. 检查 ADC 驱动和 RC；
140. 检查 DAC 输出负载；
141. 检查参考电压去耦；
142. 检查开关电源反馈；
143. 检查补偿网络；
144. 检查 Bootstrap 电容；
145. 检查 Catch Diode；
146. 检查 Gate Driver 去耦；
147. 检查电流采样；
148. 检查 Kelvin Connection 候选；
149. 检查典型应用关键节点；
150. 建立 Reference Topology Graph；
151. 匹配设计子图；
152. 识别缺失元件；
153. 识别多余元件；
154. 识别连接偏差；
155. 识别参数偏差；
156. 识别功能等价实现；
157. 识别设计意图不同；
158. 不把所有偏差判为错误；
159. 为每个偏差生成解释；
160. 生成 Finding；
161. 生成 Severity；
162. 生成 Confidence；
163. 生成 Evidence；
164. 生成 Impact；
165. 生成 Affected Parts/Nets；
166. 生成 Review Priority；
167. 生成 Repair Candidate；
168. 生成 Component Value Candidate；
169. 生成 Connection Patch Candidate；
170. 生成 Property Patch Candidate；
171. 生成 No-connect/Pull-up Candidate；
172. 生成保护器件 Candidate；
173. 生成 Agent 19 Change Plan；
174. 支持 Dry Run；
175. 支持 Review；
176. 支持 Waiver；
177. 支持 Waiver Scope；
178. 支持 Waiver Expiry；
179. 支持 Rule Suppression；
180. 支持 Baseline；
181. 支持增量复审；
182. 支持 Git Diff Review；
183. 支持工程 Revision 比较；
184. 支持修复前后比较；
185. 支持 ERC Regression；
186. 支持 Finding Closure；
187. 支持 Finding Reopen；
188. 支持 Release Gate；
189. 支持 CI；
190. 支持多租户；
191. 支持离线部署；
192. 支持 API 和事件；
193. 支持大规模批量审查；
194. 支持企业规则；
195. 支持客户规则；
196. 支持产品类别规则；
197. 支持规则版本；
198. 支持证据版本；
199. 支持模型版本；
200. 不凭空推断电源电压；
201. 不凭位号名称判断器件全部角色；
202. 不把 Net 名当作唯一事实；
203. 不把典型应用当强制电路；
204. 不把 Abs Max 当推荐值；
205. 不自动更改器件额定值；
206. 不自动修改高风险电源或时钟网络；
207. 不在参数缺失时伪造计算；
208. 不在输入置信度不足时生成高置信度 Finding；
209. 不把 ERC Warning 一律升级为 Error；
210. 不把“通过审查”描述成认证通过。

---

# 5. 核心架构

```text
Input Gate
→ ERC Import
→ Circuit Context Builder
→ Device Knowledge Resolution
→ Rule Evaluation
→ Topology Matching
→ Parameter and Rating Analysis
→ Evidence Fusion
→ Finding Deduplication
→ Severity / Confidence / Impact
→ Review Queue
→ Repair Plan
→ Agent 19 Execution
→ Reparse and Regression
```

---

# 6. 输入可信度模型

每次审查保存：

```text
project revision
Agent 16 IR hash
Agent 18 release id/hash
Agent 20 scan id/hash
Agent 21 firmware IR hash optional
component identity snapshot
parameter snapshot
datasheet snapshot
reference design snapshot
rule bundle versions
```

---

# 7. Input Gate

## 7.1 Blocked

```text
Agent 16 IR invalid
Agent 18 observation_only
Critical Pin-to-Net conflict
Agent 20 Critical Pin-Pad conflict
MCU exact identity missing for device-specific rules
```

## 7.2 Candidate-only

```text
Agent 18 candidate_netlist
器件 MPN 低置信度
参数来自未审核 PDF 抽取
典型应用版本不确定
```

## 7.3 Deterministic Review Allowed

```text
Reviewed/Ready Netlist
Library/Pin-Pad pass
Device Identity resolved
Rule Evidence approved
```

---

# 8. Circuit Context Builder

将原理图组织为：

```text
parts
pins
nets
power rails
power domains
interfaces
functional blocks
signal classes
external connectors
test points
reference topology candidates
```

---

# 9. Part Role

一个器件可有多个角色：

```text
MCU
processor
power regulator
power switch
reference
oscillator
memory
sensor
interface transceiver
connector
protection
filter
bias
feedback
termination
decoupling
bulk storage
pull-up/down
test
```

角色来源：

```text
器件分类
MPN
Pin Names
连接拓扑
属性
BOM Category
人工确认
```

---

# 10. Net Role

```text
power
ground
reference
clock
reset
boot
debug
digital signal
analog signal
differential pair
open-drain bus
high-speed interface
external exposed
feedback
sense
gate drive
unknown
```

Net Role 是候选和证据组合，不仅来自名称。

---

# 11. Functional Block

```text
power input
DC/DC
LDO
MCU core
analog front end
USB
CAN
RS-485
Ethernet
sensor interface
motor driver
display
storage
wireless
programming/debug
```

功能块用于限定规则 Scope。

---

# 12. Native ERC Finding

标准化字段：

```text
source EDA
source rule id
severity
message
object references
sheet/page
location
waiver/exclusion
raw payload
```

---

# 13. Finding Taxonomy

```text
erc_native
connectivity
power_integrity
decoupling
floating_input
bias
interface_protection
termination
clock_crystal
reset
boot_strap
debug
rating
derating
analog
power_converter
reference_topology
manufacturability_related
testability_related
data_quality
```

---

# 14. Finding Severity

## Info

建议、优化和可选最佳实践。

## Warning

设计可能工作，但存在可靠性、兼容性或环境风险。

## Error

高概率导致功能失败、不可启动、器件不稳定或接口不可靠。

## Critical

可能导致器件损坏、过压、过流、总线冲突、电源短路或不可恢复的启动问题。

严重度必须由规则给出，AI 不能任意提高或降低。

---

# 15. Confidence 维度

```text
connectivity_confidence
device_identity_confidence
parameter_confidence
rule_applicability_confidence
topology_match_confidence
calculation_confidence
evidence_confidence
review_confidence
```

---

# 16. Evidence 类型

```text
EDA IR
Pin-to-Net
Library Definition
Device Parameter
Datasheet Table
Datasheet Pin Description
Typical Application Figure
Application Note
Reference Design
Errata
Vendor Tool Output
Enterprise Rule
Historical Verified Issue
User Requirement
PCB Geometry
Firmware Configuration
```

---

# 17. 规则适用条件

每条规则至少定义：

```text
device category
device family/MPN optional
package optional
functional block
pin role
net role
operating condition
product profile
hardware revision
evidence minimum
```

---

# 18. Rule DSL

```yaml
rule_id: MCU.DECOUPLING.PER_SUPPLY_PIN.001
version: 1.0.0
scope:
  part_category: microcontroller
  pin_role: supply
preconditions:
  - netlist_release_at_least: reviewed
  - device_identity_confidence_at_least: 0.95
checks:
  - type: local_decoupling_coverage
    capacitor_roles: [decoupling]
    allowed_values:
      min: 10nF
      max: 1uF
severity:
  missing: error
  uncertain: warning
repair:
  type: add_decoupling_candidate
```

DSL 禁止任意代码执行。

---

# 19. Rule Evaluation Trace

每个 Finding 保存：

```text
rule id/version
input facts
matched scope
failed predicates
calculated values
selected evidence
alternative interpretation
severity mapping
confidence calculation
```

---

# 20. 电源轨模型

```text
rail id
nominal voltage
min/max
source
consumers
power domain
sequence
current estimate optional
confidence
```

没有明确电压时：

```text
unknown
```

不能从 Net Name `3V3` 单独当作确定值，除非企业策略允许并有其他证据。

---

# 21. 去耦审查

对每个供电 Pin/Pin Group 检查：

```text
是否存在电容
电容连接的 Rail 和 Ground
电容角色
容量范围
耐压
共享范围
器件类别要求
数据手册特别要求
```

---

# 22. 去耦覆盖模型

```text
pin-specific
pin-group
rail-local
device-bulk
board-bulk
```

不能把板边一个大电容算作所有高速 IC 的本地去耦。

---

# 23. PCB 几何增强

如果有 PCB IR，可进一步检查：

```text
去耦电容与 Power/Ground Pin 距离
回路面积
Via 数量
连接层
是否跨分割
```

没有 PCB 时只做原理图覆盖审查，不虚构位置结果。

---

# 24. 稳压器稳定性

对 LDO/DC-DC：

```text
输入电容
输出电容
容量范围
ESR 范围
电感
二极管
反馈网络
补偿网络
Soft-start
Bootstrap
```

具体型号规则优先于通用规则。

---

# 25. 悬空输入

分类：

```text
digital CMOS input
open-drain input
analog input
comparator input
op-amp input
enable
chip select
interrupt
boot strap
```

每类规则不同。

---

# 26. 未使用逻辑单元

例如多门逻辑器件：

```text
unused gate input
unused gate output
unused unit power pins
```

检查未使用输入是否固定到安全电平。

---

# 27. 未使用运放/比较器

审查：

```text
输入是否有定义
输出是否进入饱和并引入电流
是否按厂商推荐方式终止
供电和去耦是否完整
```

不能用一条通用“输入接地”规则覆盖所有型号和供电方式。

---

# 28. Open-drain 总线

检查：

```text
是否有 Pull-up
Pull-up 电压域
总电容
目标速度
并联 Pull-up
多个电压域冲突
```

V1 可基于已知或用户输入的总线速度和估计电容进行候选计算。

---

# 29. I2C 审查

```text
SCL/SDA 上拉
地址冲突
电压域
Level Shifter
总线隔离
Connector Exposure
ESD
Clock Stretch Support note
```

地址冲突需要具体器件地址、可配置脚和软件配置证据。

---

# 30. SPI 审查

```text
CS 默认态
共享 MISO
电压域
串联阻尼候选
高频连接器保护
多个设备 Mode 冲突
```

Mode 冲突需结合 Agent 21 Firmware Configuration 或用户需求。

---

# 31. UART 审查

```text
TTL/CMOS vs RS-232/RS-485
电压域
TX/RX 交叉
Connector ESD
Boot Console Conflict
```

---

# 32. USB 审查

按角色和版本：

```text
USB 2.0 device/host/OTG
Type-C source/sink/dual-role
```

检查：

```text
D+/D- Pin
串联电阻
ESD
VBUS 监测
VBUS 电源路径
CC 电阻
Shield/Chassis
ID Pin legacy
差分连接
```

具体阻值和拓扑来自器件与接口规则，不硬编码一套全球通用值。

---

# 33. CAN 审查

```text
Transceiver
TX/RX
终端电阻
Split Termination optional
TVS
共模电感 optional
Standby/Enable
VIO
Connector Ground/Shield
```

终端是否必需取决于节点位置和系统拓扑，因此可以是 Warning 或 System-level Review，而不是一律 Error。

---

# 34. RS-485 审查

```text
终端
Fail-safe Bias
DE/RE 默认态
TVS
共模范围
隔离
Connector
```

---

# 35. 外部连接器保护

根据暴露等级：

```text
internal board-to-board
user-accessible
field cable
automotive/industrial
```

决定：

```text
ESD
surge
reverse polarity
current limiting
filtering
shield/chassis
```

产品 Profile 是必要输入。

---

# 36. 晶振网络

建立：

```text
oscillator pins
crystal/resonator
load capacitors
bias resistor
series resistor optional
ground return
frequency
```

---

# 37. 负载电容候选计算

使用：

```text
晶体标称负载电容
Pin/PCB 寄生电容估计
两侧电容
```

结果是候选范围，不在寄生参数未知时假装精确。

---

# 38. 晶振检查

```text
晶体频率是否在器件支持范围
模式是否匹配
两端是否误接其他网络
负载电容是否缺失
电容是否明显偏离
ESR 是否可能超限
Drive Level 是否可能超限
外部时钟模式是否误配
```

---

# 39. Reset 审查

```text
内部 Pull
外部 Pull
RC
Supervisor
Button
Open-drain sources
Debug Probe
Reset Pulse Width
Power Good relation
```

---

# 40. Boot Strap 审查

```text
Boot Pin
默认电平
内部 Pull
外部 Pull
运行时复用
外部器件上电状态
量产编程模式
Debug Recovery
```

---

# 41. 启动冲突

例如：

```text
Boot Pin 同时连接 LED
外部器件上电时强拉
Chip Select 默认态导致外设抢总线
UART Boot 与外部收发器冲突
```

结合 Agent 21 可提升准确度。

---

# 42. 器件额定值模型

参数类型：

```text
absolute maximum
recommended operating
typical
guaranteed limit
thermal
transient
derating rule
```

必须保留类型，不能混用。

---

# 43. 参数值模型

```text
value
unit
min
typ
max
conditions
temperature
source
confidence
```

条件缺失时不做高置信度比较。

---

# 44. 电阻功耗

基于已知：

```text
voltage across
current
resistance
duty cycle
ambient/derating
package rating
```

缺少工作状态时只做 Worst-case Candidate 或要求用户输入。

---

# 45. 电容耐压

检查：

```text
Rail max
transient
DC bias derating optional
temperature
capacitor voltage rating
```

没有具体介质和尺寸时，不计算精确有效电容。

---

# 46. MOSFET 审查

```text
VDS
VGS
Gate Drive
RDS(on) condition
current
power
SOA optional
body diode
gate pull
gate resistor
inductive load protection
```

---

# 47. 运放审查

```text
Supply Range
Input Common-mode
Output Swing
Gain Bandwidth
Slew Rate
Input Bias Path
Noise optional
Capacitive Load
Stability
```

需要工作点或信号范围才能做参数审查。

---

# 48. ADC 审查

```text
input range
reference
source impedance
sampling time
anti-alias filter
protection
bias
negative input risk
```

与 Agent 21 ADC Sampling Configuration 联动。

---

# 49. 开关电源审查

拓扑：

```text
buck
boost
buck-boost
inverting
flyback candidate
```

检查：

```text
input/output range
inductor
diode/synchronous path
feedback
compensation
bootstrap
current sense
soft start
enable
layout-sensitive node marker
```

原理图层只给出拓扑和额定值审查，布局审查需 PCB IR。

---

# 50. Typical Application Graph

将典型应用结构化为：

```text
required nodes
optional nodes
part roles
pin roles
net roles
edge constraints
parameter constraints
alternative branches
conditions
```

---

# 51. 拓扑匹配

步骤：

```text
识别目标器件
→ 提取局部 K-hop 子图
→ 按 Part/Pin/Net Role 匹配
→ 处理等价器件和可交换节点
→ 计算差异
→ 应用适用条件
→ 生成偏差解释
```

---

# 52. 偏差状态

```text
exact_match
functionally_equivalent
acceptable_variant
review_required
likely_error
not_applicable
insufficient_evidence
```

---

# 53. Reference Design 不可当唯一真理

参考设计可能：

```text
面向不同电压
不同封装
不同成本
不同环境
不同性能
包含可选器件
```

因此规则必须保存 Applicable Conditions。

---

# 54. AI 的允许职责

```text
从已检索证据生成可读解释
将 Finding 归类为设计主题
总结多个规则结果
生成评审清单
辅助匹配数据手册章节
辅助把自然语言企业规范转成规则草稿
生成修复说明草稿
生成审查报告摘要
```

---

# 55. AI 的禁止职责

```text
直接修改 Net Graph
凭感觉认定 Pin-to-Net
伪造器件参数
把不确定典型应用当强制规则
独立决定 Severity
独立决定 Release Pass
直接执行 KiCad 修改
```

---

# 56. AI 输出状态

```text
explanation_only
rule_draft
evidence_candidate
repair_description_candidate
```

任何 AI 输出必须经过程序规则或人工审核。

---

# 57. Finding Schema

```json
{
  "finding_id": "uuid",
  "finding_code": "MCU.DECOUPLING.MISSING",
  "category": "decoupling",
  "severity": "error",
  "status": "open",
  "scope": {
    "part_ids": ["uuid"],
    "pin_ids": ["uuid"],
    "net_ids": ["uuid"]
  },
  "summary": "U1 的 VDD3 缺少可识别的本地去耦电容",
  "evidence_ids": [],
  "rule": {
    "id": "MCU.DECOUPLING.PER_SUPPLY_PIN.001",
    "version": "1.0.0"
  },
  "confidence": {},
  "repair_candidates": []
}
```

---

# 58. Finding 状态

```text
open
triaged
reviewing
confirmed
false_positive
accepted_risk
waived
repair_planned
repair_in_progress
resolved
reopened
superseded
```

---

# 59. Finding 去重

Key 参考：

```text
rule family
affected stable entities
root cause
project revision
```

原生 ERC 和高级规则指向同一根因时应建立关联，而非重复轰炸用户。

---

# 60. Root Cause Group

例如：

```text
同一个 VDD Rail 未驱动
```

可能导致：

```text
Native ERC Power Input not driven
MCU Decoupling Context unknown
LDO Output Connection missing
```

显示为一个 Root Cause Group。

---

# 61. Impact

```text
functional failure
startup failure
intermittent reset
EMI/EMC risk
ESD risk
device damage
thermal risk
signal integrity
analog accuracy
field reliability
manufacturing test
firmware dependency
unknown
```

---

# 62. Review Priority

综合：

```text
severity
confidence
impact
number of affected devices
external exposure
power level
repair cost
release stage
```

Severity 不因优先级算法改变。

---

# 63. Repair Candidate

类型：

```text
add_component
add_connection
add_label
add_pull
add_decoupling
add_protection
change_value
change_rating
change_property
connect_unused_input
mark_no_connect
split_power_domain
replace_component
request_hardware_information
request_operating_condition
```

---

# 64. 修复风险

## Low

```text
补充明确缺失的 Property
添加经过审核的 No Connect
添加项目规则中唯一确定的 Pull
```

## Medium

```text
添加去耦
添加 ESD
添加复位 Pull
修改无源值
```

## High

```text
修改电源网络
修改晶振
修改 Boot Strap
替换稳压器
修改反馈或补偿
修改接口终端
```

---

# 65. Repair Preconditions

```text
project revision
finding still open
object ids still exist
Pin-to-Net unchanged
device identity unchanged
rule version unchanged
candidate source unchanged
```

---

# 66. Repair Postconditions

```text
finding resolved
no new Critical/Error
native ERC no regression
Pin-to-Net matches approved change
Agent 20 remains valid
Agent 21 config not invalidated or is flagged
Agent 16 reparse passes
```

---

# 67. Waiver

必须保存：

```text
finding/rule
scope
reason
evidence
approver
effective revision
expiry
product variant
```

不允许永久的无理由全局忽略。

---

# 68. Baseline

适合老项目：

```text
existing findings baseline
new findings fail CI
worsened findings fail CI
resolved findings tracked
```

---

# 69. Release Gate

## Concept Review

允许 Warning 和候选。

## Design Review

阻断 Critical；Error 需处理或批准 Waiver。

## NPI Freeze

阻断 Critical/Error；关键 Warning 需关闭。

## Manufacturing Release

要求：

```text
native ERC policy pass
critical advanced findings = 0
error advanced findings = 0 or approved waiver
input quality gate pass
library/pin-pad gate pass
review manifest complete
```

---

# 70. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ IMPORTING_ERC
→ BUILDING_CIRCUIT_CONTEXT
→ RESOLVING_DEVICE_KNOWLEDGE
→ EVALUATING_STRUCTURAL_RULES
→ EVALUATING_DEVICE_RULES
→ EVALUATING_RATINGS
→ MATCHING_REFERENCE_TOPOLOGIES
→ FUSING_EVIDENCE
→ DEDUPLICATING_FINDINGS
→ CALCULATING_PRIORITY
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_FINDINGS
REVIEW_REQUIRED
INPUT_BLOCKED
PARTIAL
DEVICE_DATA_INCOMPLETE
PARAMETER_DATA_INCOMPLETE
REFERENCE_DATA_INCOMPLETE
RULE_CONFLICT
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 71. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT16_IR_INVALID
AGENT18_RELEASE_TOO_LOW
AGENT18_CONNECTIVITY_BLOCKED
AGENT20_LIBRARY_BLOCKED
AGENT20_PIN_PAD_BLOCKED
DEVICE_IDENTITY_MISSING
DEVICE_IDENTITY_AMBIGUOUS
DEVICE_DATA_NOT_FOUND
DEVICE_DATA_UNAPPROVED
PARAMETER_DATA_MISSING
PARAMETER_UNIT_INVALID
PARAMETER_CONDITION_MISSING
DATASHEET_EVIDENCE_NOT_FOUND
REFERENCE_TOPOLOGY_NOT_FOUND
REFERENCE_TOPOLOGY_AMBIGUOUS
ERC_IMPORT_FAILED
ERC_FORMAT_UNSUPPORTED
CIRCUIT_CONTEXT_INCOMPLETE
POWER_RAIL_UNKNOWN
OPERATING_CONDITION_REQUIRED
RULE_BUNDLE_NOT_FOUND
RULE_SCHEMA_INVALID
RULE_EVALUATION_FAILED
RULE_CONFLICT
TOPOLOGY_MATCH_FAILED
CALCULATION_INPUT_INCOMPLETE
FINDING_DEDUP_FAILED
REPAIR_SOURCE_NOT_UNIQUE
REPAIR_PRECONDITION_FAILED
AGENT19_EXECUTION_FAILED
POST_FIX_REVIEW_FAILED
ERC_REGRESSION
PIN_TO_NET_UNEXPECTED_CHANGE
LIBRARY_REGRESSION
FIRMWARE_CONFIG_INVALIDATED
JOB_CANCELLED
INTERNAL_ERROR


---

# 72. 数据库设计

## 72.1 `schematic_review_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_bundle_id UUID NOT NULL
agent18_release_id UUID NOT NULL
agent20_scan_id UUID NOT NULL
agent21_ir_id UUID NULL
review_profile VARCHAR NOT NULL
rule_bundle_versions JSONB NOT NULL
evidence_snapshot_ids JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 72.2 `schematic_review_input_snapshots`

```text
id UUID PK
review_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent21_ir_hash CHAR(64) NULL
component_identity_snapshot_hash CHAR(64) NOT NULL
parameter_snapshot_hash CHAR(64) NOT NULL
datasheet_snapshot_hash CHAR(64) NOT NULL
reference_snapshot_hash CHAR(64) NULL
rule_bundle_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, snapshot_hash)
```

## 72.3 `schematic_review_native_erc_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
source_eda VARCHAR NOT NULL
source_version VARCHAR NULL
source_project_revision VARCHAR NOT NULL
status VARCHAR NOT NULL
finding_count INT NOT NULL
raw_result_uri TEXT NOT NULL
normalized_result_uri TEXT NOT NULL
source_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 72.4 `schematic_review_native_erc_findings`

```text
id UUID PK
native_erc_run_id UUID NOT NULL
source_rule_id VARCHAR NULL
source_severity VARCHAR NOT NULL
source_message TEXT NOT NULL
normalized_category VARCHAR NOT NULL
normalized_severity VARCHAR NOT NULL
source_object_refs JSONB NOT NULL
source_location JSONB NULL
source_exclusion JSONB NULL
raw_payload JSONB NOT NULL
dedup_group_key VARCHAR NULL
created_at TIMESTAMPTZ
```

## 72.5 `schematic_review_circuit_contexts`

```text
id UUID PK
review_job_id UUID NOT NULL
context_version VARCHAR NOT NULL
parts_count INT NOT NULL
nets_count INT NOT NULL
power_rails_count INT NOT NULL
interfaces_count INT NOT NULL
functional_blocks_count INT NOT NULL
context_uri TEXT NOT NULL
context_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, context_version)
```

## 72.6 `schematic_review_part_roles`

```text
id UUID PK
review_job_id UUID NOT NULL
part_id UUID NOT NULL
role VARCHAR NOT NULL
role_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.7 `schematic_review_net_roles`

```text
id UUID PK
review_job_id UUID NOT NULL
net_id UUID NOT NULL
role VARCHAR NOT NULL
role_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.8 `schematic_review_power_rails`

```text
id UUID PK
review_job_id UUID NOT NULL
rail_key VARCHAR NOT NULL
net_ids JSONB NOT NULL
nominal_voltage NUMERIC NULL
minimum_voltage NUMERIC NULL
maximum_voltage NUMERIC NULL
voltage_unit VARCHAR NOT NULL
source_part_ids JSONB NOT NULL
consumer_part_ids JSONB NOT NULL
power_domain VARCHAR NULL
sequence_group VARCHAR NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, rail_key)
```

## 72.9 `schematic_review_interfaces`

```text
id UUID PK
review_job_id UUID NOT NULL
interface_key VARCHAR NOT NULL
interface_type VARCHAR NOT NULL
role VARCHAR NULL
part_ids JSONB NOT NULL
net_ids JSONB NOT NULL
external_exposure VARCHAR NOT NULL
voltage_domains JSONB NOT NULL
termination_status VARCHAR NULL
protection_status VARCHAR NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, interface_key)
```

## 72.10 `schematic_review_functional_blocks`

```text
id UUID PK
review_job_id UUID NOT NULL
block_key VARCHAR NOT NULL
block_type VARCHAR NOT NULL
part_ids JSONB NOT NULL
net_ids JSONB NOT NULL
parent_block_id UUID NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, block_key)
```

## 72.11 `schematic_review_device_snapshots`

```text
id UUID PK
review_job_id UUID NOT NULL
part_id UUID NOT NULL
manufacturer VARCHAR NULL
mpn VARCHAR NULL
package VARCHAR NULL
device_category VARCHAR NOT NULL
identity_confidence NUMERIC(5,4) NOT NULL
pin_definition_hash CHAR(64) NOT NULL
parameter_snapshot_id UUID NULL
datasheet_snapshot_id UUID NULL
reference_topology_snapshot_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.12 `schematic_review_parameter_snapshots`

```text
id UUID PK
tenant_id UUID NULL
manufacturer VARCHAR NOT NULL
mpn VARCHAR NOT NULL
parameter_schema_version VARCHAR NOT NULL
source_snapshot_id UUID NOT NULL
parameters_uri TEXT NOT NULL
parameters_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.13 `schematic_review_parameter_values`

```text
id UUID PK
parameter_snapshot_id UUID NOT NULL
parameter_key VARCHAR NOT NULL
parameter_type VARCHAR NOT NULL
minimum_value NUMERIC NULL
typical_value NUMERIC NULL
maximum_value NUMERIC NULL
unit VARCHAR NULL
conditions JSONB NOT NULL
temperature_scope JSONB NULL
source_evidence_id UUID NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
```

## 72.14 `schematic_review_evidence_sources`

```text
id UUID PK
tenant_id UUID NULL
evidence_type VARCHAR NOT NULL
title TEXT NOT NULL
source_reference JSONB NOT NULL
source_version VARCHAR NULL
artifact_hash CHAR(64) NOT NULL
manufacturer VARCHAR NULL
mpn_scope JSONB NULL
device_category_scope JSONB NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.15 `schematic_review_evidence_fragments`

```text
id UUID PK
evidence_source_id UUID NOT NULL
fragment_type VARCHAR NOT NULL
locator JSONB NOT NULL
content_hash CHAR(64) NOT NULL
structured_content JSONB NOT NULL
human_summary TEXT NULL
extraction_method VARCHAR NOT NULL
extraction_confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.16 `schematic_review_reference_topologies`

```text
id UUID PK
tenant_id UUID NULL
topology_name VARCHAR NOT NULL
topology_version VARCHAR NOT NULL
device_scope JSONB NOT NULL
functional_block_type VARCHAR NOT NULL
applicability_conditions JSONB NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
source_evidence_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(topology_name, topology_version)
```

## 72.17 `schematic_review_reference_topology_nodes`

```text
id UUID PK
reference_topology_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
role VARCHAR NOT NULL
required_status VARCHAR NOT NULL
attributes JSONB NOT NULL
equivalence_class VARCHAR NULL
created_at TIMESTAMPTZ
UNIQUE(reference_topology_id, node_key)
```

## 72.18 `schematic_review_reference_topology_edges`

```text
id UUID PK
reference_topology_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
required_status VARCHAR NOT NULL
constraints JSONB NOT NULL
alternative_group VARCHAR NULL
created_at TIMESTAMPTZ
```

## 72.19 `schematic_review_topology_matches`

```text
id UUID PK
review_job_id UUID NOT NULL
part_id UUID NOT NULL
reference_topology_id UUID NOT NULL
local_subgraph_hash CHAR(64) NOT NULL
match_status VARCHAR NOT NULL
node_mapping JSONB NOT NULL
edge_mapping JSONB NOT NULL
missing_required JSONB NOT NULL
extra_objects JSONB NOT NULL
parameter_deviations JSONB NOT NULL
applicability_result JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 72.20 `schematic_review_rule_bundles`

```text
id UUID PK
bundle_name VARCHAR NOT NULL
bundle_version VARCHAR NOT NULL
scope JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
schema_version VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
effective_from TIMESTAMPTZ NULL
effective_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(bundle_name, bundle_version)
```

## 72.21 `schematic_review_rule_definitions`

```text
id UUID PK
rule_bundle_id UUID NOT NULL
rule_id VARCHAR NOT NULL
rule_version VARCHAR NOT NULL
category VARCHAR NOT NULL
scope JSONB NOT NULL
preconditions JSONB NOT NULL
checks JSONB NOT NULL
severity_mapping JSONB NOT NULL
confidence_policy JSONB NOT NULL
repair_policy JSONB NOT NULL
evidence_requirements JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(rule_bundle_id, rule_id, rule_version)
```

## 72.22 `schematic_review_rule_evaluations`

```text
id UUID PK
review_job_id UUID NOT NULL
rule_definition_id UUID NOT NULL
scope_reference JSONB NOT NULL
evaluation_status VARCHAR NOT NULL
matched_facts JSONB NOT NULL
failed_predicates JSONB NOT NULL
calculation_results JSONB NOT NULL
evidence_ids JSONB NOT NULL
trace_uri TEXT NOT NULL
duration_ms BIGINT NOT NULL
created_at TIMESTAMPTZ
```

## 72.23 `schematic_review_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_code VARCHAR NOT NULL
category VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
root_cause_group_key VARCHAR NULL
scope_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
summary TEXT NOT NULL
details TEXT NOT NULL
rule_definition_id UUID NULL
native_erc_finding_ids JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
impact_types JSONB NOT NULL
blocking BOOLEAN NOT NULL
dedup_key VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
UNIQUE(review_job_id, dedup_key)
```

## 72.24 `schematic_review_finding_impacts`

```text
id UUID PK
finding_id UUID NOT NULL
affected_part_ids JSONB NOT NULL
affected_pin_ids JSONB NOT NULL
affected_net_ids JSONB NOT NULL
affected_interface_ids JSONB NOT NULL
affected_block_ids JSONB NOT NULL
firmware_impact JSONB NOT NULL
manufacturing_impact JSONB NOT NULL
test_impact JSONB NOT NULL
impact_summary TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 72.25 `schematic_review_repair_candidates`

```text
id UUID PK
finding_id UUID NOT NULL
repair_type VARCHAR NOT NULL
target_entities JSONB NOT NULL
proposed_changes JSONB NOT NULL
source_reference JSONB NOT NULL
risk_level VARCHAR NOT NULL
preconditions JSONB NOT NULL
postconditions JSONB NOT NULL
required_approvals JSONB NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 72.26 `schematic_review_repair_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
review_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
plan_version INT NOT NULL
selected_candidate_ids JSONB NOT NULL
risk_summary JSONB NOT NULL
execution_order JSONB NOT NULL
approval_policy VARCHAR NOT NULL
rollback_policy VARCHAR NOT NULL
agent19_change_plan_uri TEXT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, plan_version)
```

## 72.27 `schematic_review_decisions`

```text
id UUID PK
finding_id UUID NOT NULL
decision VARCHAR NOT NULL
reason_code VARCHAR NOT NULL
reason_text TEXT NULL
evidence_ids JSONB NOT NULL
scope JSONB NOT NULL
decided_by UUID NOT NULL
decided_at TIMESTAMPTZ NOT NULL
```

## 72.28 `schematic_review_waivers`

```text
id UUID PK
finding_id UUID NULL
rule_definition_id UUID NULL
tenant_id UUID NOT NULL
project_id UUID NULL
product_variant_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
evidence_ids JSONB NOT NULL
effective_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 72.29 `schematic_review_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
review_job_id UUID NOT NULL
finding_fingerprints JSONB NOT NULL
baseline_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision)
```

## 72.30 `schematic_review_post_fix_runs`

```text
id UUID PK
repair_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
pre_review_job_id UUID NOT NULL
post_review_job_id UUID NULL
closed_finding_ids JSONB NOT NULL
reopened_finding_ids JSONB NOT NULL
new_finding_ids JSONB NOT NULL
erc_regression_summary JSONB NOT NULL
semantic_diff_summary JSONB NOT NULL
agent20_regression_summary JSONB NOT NULL
agent21_impact_summary JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 72.31 `schematic_review_release_gate_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
critical_count INT NOT NULL
error_count INT NOT NULL
warning_count INT NOT NULL
waived_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 72.32 `schematic_review_reports`

```text
id UUID PK
review_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
native_erc_status VARCHAR NOT NULL
advanced_review_status VARCHAR NOT NULL
input_quality_status VARCHAR NOT NULL
device_evidence_coverage NUMERIC NULL
rule_coverage NUMERIC NULL
critical_count INT NOT NULL
error_count INT NOT NULL
warning_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, report_version)
```

---

# 73. 对象存储

```text
derived/schematic-review/
  {tenant_id}/{project_id}/
    jobs/
      {review_job_id}/
        input/
          input-snapshot.json
          agent16-ir-manifest.json
          agent18-release.json
          agent20-report.json
          agent21-ir.json
          rule-bundles.json
        erc/
          native-raw/
          normalized.jsonl.zst
        context/
          circuit-context.json
          part-roles.jsonl.zst
          net-roles.jsonl.zst
          power-rails.jsonl.zst
          interfaces.jsonl.zst
          functional-blocks.jsonl.zst
        knowledge/
          device-snapshots.jsonl.zst
          parameters.jsonl.zst
          evidence-manifest.json
          reference-topologies/
        evaluation/
          rule-evaluations.jsonl.zst
          topology-matches.jsonl.zst
          calculations.jsonl.zst
          traces/
        findings/
          findings.jsonl.zst
          impacts.jsonl.zst
          root-cause-groups.jsonl.zst
          evidence-packages/
        repairs/
          candidates.jsonl.zst
          plans/
          agent19/
        review/
          decisions.jsonl.zst
          waivers.jsonl.zst
          baselines.jsonl.zst
        validation/
          post-fix/
          erc-regression/
          semantic-diff/
        reports/
          schematic-review.html
          schematic-review.pdf
          findings.csv
          evidence-coverage.json
          release-gate.json
        debug/
          context-trace.jsonl.zst
          rule-trace.jsonl.zst
          topology-trace.jsonl.zst
          resource-usage.json
```

---

# 74. API 设计

## 74.1 Review Jobs

```text
POST /api/v1/schematic-review/jobs
POST /api/v1/schematic-review/jobs/batch
GET  /api/v1/schematic-review/jobs/{id}
GET  /api/v1/schematic-review/jobs/{id}/events
POST /api/v1/schematic-review/jobs/{id}/cancel
POST /api/v1/schematic-review/jobs/{id}/retry
POST /api/v1/schematic-review/jobs/{id}/rerun
```

## 74.2 Context

```text
GET /api/v1/schematic-review/jobs/{id}/context
GET /api/v1/schematic-review/jobs/{id}/parts
GET /api/v1/schematic-review/jobs/{id}/nets
GET /api/v1/schematic-review/jobs/{id}/power-rails
GET /api/v1/schematic-review/jobs/{id}/interfaces
GET /api/v1/schematic-review/jobs/{id}/functional-blocks
```

## 74.3 Native ERC

```text
POST /api/v1/schematic-review/jobs/{id}/import-erc
GET  /api/v1/schematic-review/jobs/{id}/native-erc
GET  /api/v1/schematic-review/native-erc-findings/{id}
```

## 74.4 Rules and Evidence

```text
GET  /api/v1/schematic-review/rule-bundles
GET  /api/v1/schematic-review/rule-bundles/{id}
GET  /api/v1/schematic-review/rules/{id}
POST /api/v1/schematic-review/rules/validate
POST /api/v1/schematic-review/rules/dry-run
GET  /api/v1/schematic-review/evidence
GET  /api/v1/schematic-review/evidence/{id}
GET  /api/v1/schematic-review/reference-topologies
POST /api/v1/schematic-review/reference-topologies/{id}/match
```

## 74.5 Findings

```text
GET  /api/v1/schematic-review/jobs/{id}/findings
GET  /api/v1/schematic-review/findings/{id}
GET  /api/v1/schematic-review/findings/{id}/evidence
GET  /api/v1/schematic-review/findings/{id}/impact
POST /api/v1/schematic-review/findings/{id}/triage
POST /api/v1/schematic-review/findings/{id}/confirm
POST /api/v1/schematic-review/findings/{id}/false-positive
POST /api/v1/schematic-review/findings/{id}/accept-risk
POST /api/v1/schematic-review/findings/{id}/reopen
```

## 74.6 Waiver and Baseline

```text
POST /api/v1/schematic-review/waivers
GET  /api/v1/schematic-review/waivers
POST /api/v1/schematic-review/waivers/{id}/revoke
POST /api/v1/schematic-review/jobs/{id}/baseline
GET  /api/v1/schematic-review/baselines/{id}
POST /api/v1/schematic-review/jobs/{id}/compare-baseline
```

## 74.7 Repair

```text
POST /api/v1/schematic-review/findings/{id}/repair-candidates
GET  /api/v1/schematic-review/findings/{id}/repair-candidates
POST /api/v1/schematic-review/repair-plans
GET  /api/v1/schematic-review/repair-plans/{id}
POST /api/v1/schematic-review/repair-plans/{id}/preview
POST /api/v1/schematic-review/repair-plans/{id}/approve
POST /api/v1/schematic-review/repair-plans/{id}/submit-to-agent19
GET  /api/v1/schematic-review/post-fix-runs/{id}
```

## 74.8 Release and Reports

```text
POST /api/v1/schematic-review/jobs/{id}/run-release-gate
GET  /api/v1/schematic-review/jobs/{id}/release-gate
GET  /api/v1/schematic-review/jobs/{id}/report
GET  /api/v1/schematic-review/jobs/{id}/findings.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 75. 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.configuration.ready
kicad.project-revision.ready
component.identity.resolved
component.parameters.approved
datasheet.evidence.approved
reference-topology.approved
schematic-review.requested
rule-bundle.approved
```

---

# 76. 输出事件

```text
schematic-review.started
schematic-review.input-blocked
schematic-review.finding-detected
schematic-review.critical-finding-detected
schematic-review.review-required
schematic-review.repair-plan-ready
schematic-review.release-gate-blocked
schematic-review.completed
schematic-review.completed-with-findings
schematic-review.post-fix-validated
schematic-review.failed
```

## `schematic-review.finding-detected`

```json
{
  "event_type": "schematic-review.finding-detected",
  "event_version": "1.0",
  "review_job_id": "uuid",
  "project_id": "uuid",
  "finding_id": "uuid",
  "finding_code": "USB.TYPEC.CC.MISSING",
  "severity": "error",
  "scope": {
    "parts": ["J1"],
    "nets": ["CC1", "CC2"]
  },
  "report_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 77. Rule Bundle 组织

```text
rules/
├── common/
│   ├── connectivity.yaml
│   ├── floating-input.yaml
│   ├── power-domain.yaml
│   └── ratings.yaml
├── power/
│   ├── decoupling.yaml
│   ├── ldo.yaml
│   ├── buck.yaml
│   ├── boost.yaml
│   └── protection.yaml
├── interfaces/
│   ├── i2c.yaml
│   ├── spi.yaml
│   ├── uart.yaml
│   ├── usb.yaml
│   ├── can.yaml
│   ├── rs485.yaml
│   └── ethernet.yaml
├── clocks/
│   ├── crystal.yaml
│   └── external-clock.yaml
├── reset-boot/
│   ├── reset.yaml
│   ├── boot.yaml
│   └── debug.yaml
├── analog/
│   ├── opamp.yaml
│   ├── comparator.yaml
│   ├── adc.yaml
│   ├── dac.yaml
│   └── reference.yaml
├── device-family/
├── device-specific/
├── product-profile/
├── enterprise/
└── customer/
```

---

# 78. Rule Precedence

建议：

```text
device-specific
→ device-family
→ customer
→ product-profile
→ enterprise
→ category
→ common
```

上层规则可：

```text
tighten
specialize
disable with reason
```

不能静默产生冲突。

---

# 79. Rule Conflict

检测：

```text
same scope conflicting severity
same parameter incompatible ranges
same repair incompatible actions
one rule requires, another forbids
expired evidence
```

冲突时：

```text
RULE_CONFLICT
```

不能随意选择一条。

---

# 80. Unit and Calculation Engine

要求：

- 统一单位系统；
- Decimal；
- 电压、电流、电阻、电容、频率、功率、温度；
- 条件和范围；
- 缺失值传播；
- 不确定度；
- 公式版本；
- Calculation Trace；
- 禁止浮点静默截断。

---

# 81. 参数计算示例

## Pull-up

输入：

```text
电压
目标上升时间
估计总线电容
器件 Sink 能力
```

输出范围和限制，不只输出单值。

## 晶振电容

输入：

```text
CL
寄生估计
对称/非对称策略
```

输出候选，并标记寄生不确定度。

## 电阻功耗

输入：

```text
V/I/R
Duty Cycle
Ambient
Rating
Derating
```

---

# 82. Evidence Resolver

输入：

```text
part identity
rule evidence requirements
parameter key
device revision
package
operating conditions
```

输出：

```text
approved evidence
candidate evidence
missing evidence
conflicts
```

---

# 83. Datasheet Evidence Anchoring

保存：

```text
document hash
page
section
table/figure
bounding region optional
extracted structured value
review status
```

不能只保存自然语言摘要。

---

# 84. Reference Topology Builder

来源：

```text
数据手册典型应用
应用笔记
评估板
参考设计
企业批准电路
```

流程：

```text
图像/EDA 解析
→ Part/Pin/Net Role
→ Required/Optional
→ Alternative Branch
→ Applicability
→ 人工审核
→ 发布
```

---

# 85. 历史问题库

可以保存：

```text
问题模式
受影响器件
电路局部图
根因
修复
验证
适用范围
```

历史相似性只作为 Evidence Candidate，不能直接复制 Severity。

---

# 86. Review Workbench

界面建议：

```text
左侧：Finding、Severity、Category、Block
中间：原理图与相关局部拓扑高亮
右侧：规则、证据、参数、典型应用和建议
底部：原生 ERC、历史、决策、Patch、Diff
```

---

# 87. Review 操作

```text
确认 Finding
标记 False Positive
请求更多工作条件
选择证据
选择适用 Profile
创建 Waiver
选择 Repair Candidate
修改 Repair 参数
提交 Agent 19
比较修复前后
```

---

# 88. AI Explanation

AI 生成解释时必须收到：

```text
Finding facts
Rule trace
Approved evidence excerpts
Confidence
Uncertainty
```

输出模板：

```text
发现了什么
为什么重要
证据是什么
不确定点是什么
建议如何确认
可选修复是什么
```

不得添加证据中不存在的事实。

---

# 89. 增量审查

变化来源：

```text
Schematic Revision
Netlist Revision
Device Identity
Library/Pin-Pad
Parameter Snapshot
Rule Bundle
Product Profile
Firmware Configuration
Waiver
```

只重跑：

```text
受影响 Part/Net/Block/Rule
```

---

# 90. Cache Key

```text
local subgraph hash
device snapshot hash
parameter snapshot hash
reference topology hash
rule version
review profile
operating condition hash
```

---

# 91. CI 模式

命令建议：

```text
schematic-review scan --project .
schematic-review gate --profile design-review
schematic-review compare-baseline --baseline main
schematic-review export --format sarif
```

可输出 SARIF 供代码审查界面使用。

退出码：

```text
0 pass
1 warnings
2 errors/gate blocked
3 input/security/internal failure
```

---

# 92. 可观测性

```text
schematic_review_jobs_total{status,profile}
schematic_review_duration_seconds{step}
schematic_review_native_erc_findings_total{source,severity}
schematic_review_findings_total{category,severity,status}
schematic_review_rule_evaluations_total{rule,status}
schematic_review_rule_duration_seconds{rule}
schematic_review_input_blocks_total{reason}
schematic_review_device_evidence_coverage
schematic_review_topology_matches_total{status}
schematic_review_repair_candidates_total{type,risk}
schematic_review_waivers_total{status,scope}
schematic_review_release_gate_blocks_total{reason}
schematic_review_post_fix_runs_total{status}
schematic_review_false_positive_rate{rule}
schematic_review_reopen_rate{rule}
```

---

# 93. Dashboard

```text
Projects Reviewed
Input Quality
Native ERC
Critical/Error/Warning
Power and Decoupling
Floating Inputs
Interfaces and Protection
Clock/Reset/Boot
Ratings and Derating
Analog
Reference Topology Deviations
Evidence Coverage
False Positives
Waivers
Repair Status
Release Readiness
Rule Quality
```

---

# 94. Benchmark

## Native ERC

```text
import
normalization
dedup
source location
waiver mapping
```

## Context

```text
part role
net role
power rail
interface
functional block
external exposure
```

## Power

```text
MCU decoupling
shared decoupling
bulk
LDO stability
VCAP
reference filtering
power-domain conflict
```

## Inputs

```text
floating digital
floating analog
unused gate
unused opamp
open-drain
CS/EN/INT bias
```

## Interfaces

```text
I2C pull-up/address
USB CC/ESD/VBUS
CAN termination/TVS
RS-485 fail-safe
UART level
SPI CS
external connector
```

## Clock/Boot

```text
crystal
load capacitors
frequency
reset
boot strap
debug
runtime reuse
```

## Ratings

```text
capacitor voltage
resistor power
MOSFET
LDO
inductor
TVS
connector
opamp range
ADC range
```

## Topology

```text
exact
equivalent
optional branch
missing required
different conditions
not applicable
```

## Workflow

```text
finding dedup
severity
confidence
waiver
baseline
repair
Agent 19
post-fix
release gate
```

---

# 95. 初始质量目标

```text
Raw ERC Preservation = 100%
Rule Evaluation Determinism = 100%
Unapproved AI-created Finding = 0
Unreviewed Candidate Netlist High-confidence Finding = 0
Absolute Maximum Misused as Recommended Limit = 0
Missing Evidence Faked Value = 0
Critical Finding Auto-waiver = 0
Unapproved High-risk Auto-fix = 0
Agent 19 Readback Coverage = 100%
Post-fix Agent 16 Reparse Coverage = 100%
Post-fix Agent 20 Regression Check = 100%
Unexpected Pin-to-Net Change Auto-commit = 0
New Native ERC Error Auto-commit = 0
Finding Evidence Trace Coverage = 100%
Rule Version Trace Coverage = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 96. 测试集

公开仓库只使用开源、合成、脱敏或授权工程。

## Input/Native ERC

1. Agent 18 Observation-only；
2. Candidate Netlist；
3. Reviewed Netlist；
4. Agent 20 Pin-Pad Block；
5. Device Missing；
6. Parameter Missing；
7. KiCad ERC Import；
8. Duplicate ERC；
9. ERC Waiver；
10. Source Location。

## Power/Decoupling

11. MCU Each VDD；
12. Shared Capacitor；
13. Missing VCAP；
14. Wrong Rail Capacitor；
15. Too-low Voltage Rating；
16. LDO Input Capacitor；
17. LDO Output Capacitor；
18. ESR Requirement；
19. Reference Decoupling；
20. AGND/DGND；
21. Power Good Pull-up；
22. Enable Floating；
23. Bulk Missing；
24. Reverse Current；
25. Unknown Rail Voltage。

## Inputs/Logic

26. Floating CMOS Input；
27. Unused Gate；
28. Unused Opamp；
29. Comparator Input；
30. ADC Floating；
31. MCU Unused Pin；
32. Open-drain No Pull-up；
33. Interrupt Floating；
34. CS Default；
35. MOSFET Gate Floating；
36. Relay Flyback；
37. Pin marked NC；
38. Explicit No Connect；
39. Input with Internal Pull；
40. Firmware-configured Pull Candidate。

## Interfaces

41. I2C Pull-up；
42. I2C Wrong Voltage；
43. I2C Address Conflict；
44. USB CC Missing；
45. USB ESD Missing；
46. USB VBUS Risk；
47. USB Series Resistor；
48. CAN Termination；
49. CAN Node not End；
50. CAN TVS；
51. RS-485 Fail-safe；
52. UART RS-232 Mismatch；
53. SPI CS；
54. Ethernet Magnetics；
55. External Connector Exposure。

## Clock/Reset/Boot

56. Crystal Correct；
57. Missing Load Capacitor；
58. Load Candidate；
59. Frequency Unsupported；
60. ESR Unknown；
61. External Clock Mode；
62. Reset Pull-up；
63. Reset Supervisor；
64. Boot Strap；
65. Boot Runtime Conflict；
66. Debug Pin Conflict；
67. SWD Header；
68. Oscillator Pin Misuse；
69. Multiple Reset Sources；
70. Reset Pulse Candidate。

## Ratings/Analog/Power

71. Resistor Power Pass；
72. Resistor Power Fail；
73. Capacitor Rating；
74. MOSFET VGS；
75. MOSFET VDS；
76. Inductor Saturation；
77. TVS Voltage；
78. Opamp Common-mode；
79. Opamp Output Swing；
80. ADC Input Range；
81. ADC Source Impedance；
82. Buck Feedback；
83. Bootstrap Capacitor；
84. Catch Diode；
85. Compensation Unknown。

## Topology/Workflow

86. Exact Typical Application；
87. Optional Branch Missing；
88. Different Voltage Not Applicable；
89. Functionally Equivalent；
90. Ambiguous Match；
91. Rule Conflict；
92. Finding Dedup；
93. Waiver Expiry；
94. Baseline New Finding；
95. Repair Preview；
96. Agent 19 Execute；
97. Post-fix Reparse；
98. ERC Regression；
99. Tenant Isolation；
100. Audit Replay。

---

# 97. 性能要求

常规项目：

```text
500 parts
3,000 pins
200 nets
50 device-specific rules
500 common/category rules
```

目标：

```text
Input Gate P95 < 3 s
Context Build P95 < 10 s
Common Rules P95 < 10 s
Device Rules P95 < 20 s
Interactive Finding Query P95 < 300 ms
Incremental Review P95 < 10 s
```

大型工程：

```text
10,000 parts
multi-board project
thousands of rules
```

要求：

- 按 Functional Block 分区；
- Rule Scope Index；
- Local Subgraph Cache；
- Parameter Cache；
- 并行 Rule Evaluation；
- JSONL/Parquet；
- Incremental Invalidation；
- 可取消和恢复；
- 不把整个工程发给 LLM。

---

# 98. 安全与权限

- 原理图、器件、参数、客户规范和 Finding 按租户/项目隔离；
- 默认本地或私有部署；
- Rule DSL 禁止任意代码；
- 公式引擎禁止任意函数；
- Evidence Source 需要 Hash、版本、许可和批准状态；
- 不自动访问任意 URL；
- 数据手册抓取由独立批准流程完成；
- 不执行 PDF、附件或工程脚本；
- AI 只接收最小必要的结构化上下文；
- 私有工程不发送外部模型；
- Repair Approval 与 Review 权限分开；
- Critical Waiver 支持双人审批；
- 规则发布与规则编写分权；
- Device-specific Rule 必须有证据；
- Waiver、Baseline、Release Gate 和报告不可硬删除；
- 不在日志输出完整私有网络表和参数；
- 报告中的本机路径脱敏；
- Agent 19执行使用最小权限；
- 不在审查 Agent 中存储生产密钥。

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
```

规则与图：

```text
JSON Schema
YAML
受限表达式引擎
Decimal / Pint-like unit engine
custom adjacency graph
NetworkX only for fixtures
OR-Tools optional for selected calculations
```

数据：

```text
Polars
PyArrow
DuckDB
```

前端：

```text
React
TypeScript
Canvas/SVG Schematic Overlay
Zustand
```

AI：

```text
Local/private model optional
RAG over approved evidence
structured output
explanation-only by default
```

---

# 100. 推荐仓库结构

```text
schematic-review-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── schematic-review-agent-spec.md
│   ├── input-and-release-gates.md
│   ├── circuit-context-model.md
│   ├── native-erc-normalization.md
│   ├── rule-dsl.md
│   ├── device-knowledge-and-evidence.md
│   ├── power-and-decoupling-rules.md
│   ├── floating-input-rules.md
│   ├── interface-protection-rules.md
│   ├── clock-reset-boot-rules.md
│   ├── rating-and-derating.md
│   ├── analog-review.md
│   ├── topology-matching.md
│   ├── findings-and-severity.md
│   ├── repair-and-agent19.md
│   ├── waivers-baselines-release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-native-erc-and-advanced-review-separated.md
│       ├── 0002-findings-require-versioned-evidence.md
│       ├── 0003-typical-application-deviation-is-not-automatically-error.md
│       ├── 0004-absolute-maximum-is-not-recommended-operation.md
│       ├── 0005-ai-explains-but-does-not-decide-connectivity.md
│       ├── 0006-repairs-run-through-agent19.md
│       └── 0007-passing-review-is-not-certification.md
├── src/
│   └── schematic_review/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── input.py
│       │   ├── context.py
│       │   ├── evidence.py
│       │   ├── rules.py
│       │   ├── finding.py
│       │   ├── repair.py
│       │   └── release.py
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   └── native_erc.py
│       ├── context/
│       │   ├── parts.py
│       │   ├── nets.py
│       │   ├── roles.py
│       │   ├── power_rails.py
│       │   ├── interfaces.py
│       │   ├── functional_blocks.py
│       │   └── evidence.py
│       ├── knowledge/
│       │   ├── device_registry.py
│       │   ├── parameters.py
│       │   ├── datasheets.py
│       │   ├── application_notes.py
│       │   ├── reference_designs.py
│       │   ├── errata.py
│       │   └── snapshots.py
│       ├── rules/
│       │   ├── schema.py
│       │   ├── loader.py
│       │   ├── precedence.py
│       │   ├── conflicts.py
│       │   ├── evaluator.py
│       │   ├── trace.py
│       │   └── registry.py
│       ├── calculations/
│       │   ├── units.py
│       │   ├── ranges.py
│       │   ├── power.py
│       │   ├── pullups.py
│       │   ├── crystal.py
│       │   ├── ratings.py
│       │   └── uncertainty.py
│       ├── checks/
│       │   ├── connectivity.py
│       │   ├── decoupling.py
│       │   ├── power.py
│       │   ├── floating_inputs.py
│       │   ├── interfaces.py
│       │   ├── crystal.py
│       │   ├── reset_boot.py
│       │   ├── ratings.py
│       │   ├── analog.py
│       │   └── power_converters.py
│       ├── topology/
│       │   ├── graph.py
│       │   ├── local_subgraph.py
│       │   ├── matcher.py
│       │   ├── equivalence.py
│       │   ├── applicability.py
│       │   └── deviations.py
│       ├── findings/
│       │   ├── builder.py
│       │   ├── taxonomy.py
│       │   ├── severity.py
│       │   ├── confidence.py
│       │   ├── dedup.py
│       │   ├── root_cause.py
│       │   └── impact.py
│       ├── review/
│       │   ├── queue.py
│       │   ├── decisions.py
│       │   ├── waivers.py
│       │   ├── baselines.py
│       │   └── audit.py
│       ├── repairs/
│       │   ├── candidates.py
│       │   ├── risk.py
│       │   ├── plans.py
│       │   ├── agent19.py
│       │   └── verification.py
│       ├── ai/
│       │   ├── evidence_rag.py
│       │   ├── explanation.py
│       │   ├── rule_drafts.py
│       │   ├── schemas.py
│       │   └── guardrails.py
│       ├── release/
│       │   ├── gates.py
│       │   ├── profiles.py
│       │   └── reports.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── rules/
├── evidence/
├── reference-topologies/
├── review-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── import_native_erc.py
    ├── build_circuit_context.py
    ├── validate_rule_bundle.py
    ├── run_schematic_review.py
    ├── inspect_finding_trace.py
    ├── build_reference_topology.py
    ├── generate_repair_plan.py
    ├── submit_repair_to_agent19.py
    ├── verify_post_fix.py
    └── run_schematic_review_benchmark.py
```


---

# 101. Codex 分阶段实施

不要让 Codex 一次实现全部器件规则、拓扑匹配、参数计算、AI 解释、Review UI 和自动修复。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16、18、19、20、21 的实际实现和数据契约；
2. 当前 KiCad/EDA ERC 导入与执行能力；
3. 当前 Project/Schematic/Part/Pin/Net IR；
4. 当前 Power Rail、Power Domain、Interface 和 Functional Block；
5. 当前器件分类、MPN、Pin Role 和参数数据库；
6. 当前数据手册证据、参数提取和 Reference Design；
7. 当前企业规则和历史设计检查；
8. 当前去耦、悬空输入、I2C、USB、CAN、晶振、复位、Boot 检查；
9. 当前单位、范围、公式和降额引擎；
10. 当前 Typical Application 图和拓扑匹配；
11. 当前 Finding、Severity、Confidence、Waiver 和 Baseline；
12. 当前 Agent 19 Repair Plan 和执行；
13. 当前 Agent 16 Reparse、Semantic Diff、ERC/DRC；
14. 当前 Agent 20/21 回归联动；
15. 当前 AI/RAG、证据索引和私有模型；
16. 当前 Review UI、原理图 Overlay 和证据查看器；
17. 当前 CI、SARIF、Release Gate；
18. 当前 API、Queue、Worker、Database 和 Object Storage；
19. 当前开源、合成、脱敏或授权 Fixture；
20. 统计原生 ERC Finding、规则覆盖、False Positive 和 Waiver；
21. 统计器件参数和证据覆盖；
22. 只执行只读扫描；
23. 不修改原理图；
24. 不创建修复计划并执行；
25. 不调用外部模型；
26. 不创建 Migration；
27. 不安装依赖；
28. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Review Job；
- Input Snapshot；
- Native ERC；
- Circuit Context；
- Part/Net Role；
- Power Rail；
- Interface；
- Functional Block；
- Device Snapshot；
- Parameter；
- Evidence；
- Reference Topology；
- Rule；
- Evaluation；
- Finding；
- Impact；
- Repair；
- Waiver；
- Baseline；
- Release Gate；
- JSON Schema。

## Phase 2：Agent 16/18/20/21 Input Gate

实现：

- Schema Validation；
- Release Level；
- Pin-to-Net Gate；
- Pin-Pad Gate；
- Device Identity；
- Firmware Config optional；
- Snapshot Hash；
- Blocked/Candidate/Deterministic Mode；
- Diagnostics。

## Phase 3：Native ERC Import and Normalization

实现：

- KiCad ERC；
- Existing EDA Formats；
- Source Object Mapping；
- Severity Mapping；
- Waiver/Exclusion；
- Raw Preservation；
- Dedup Candidate；
- Contract Tests。

## Phase 4：Circuit Context Builder

实现：

- Part Role；
- Net Role；
- Power Rail；
- Power Domain；
- Interface；
- External Connector；
- Functional Block；
- Signal Class；
- Evidence；
- Stable Hash。

## Phase 5：Device Knowledge Snapshot

实现：

- Exact MPN/Package；
- Pin Role；
- Device Category；
- Parameters；
- Datasheet；
- Errata；
- Application Note；
- Reference Design；
- Version/Hash/License/Approval；
- Missing Evidence。

## Phase 6：Rule DSL 和 Engine

实现：

- YAML/JSON Schema；
- Scope；
- Preconditions；
- Checks；
- Severity；
- Confidence；
- Repair Policy；
- Evidence Requirements；
- Versioning；
- Precedence；
- Conflict；
- Dry Run；
- Trace；
- No Arbitrary Code。

## Phase 7：Units、Ranges 和 Calculation Engine

实现：

- Decimal；
- Voltage/Current/Resistance/Capacitance/Frequency/Power/Temperature；
- Min/Typ/Max；
- Conditions；
- Missing Propagation；
- Uncertainty；
- Formula Registry；
- Trace；
- Property Tests。

## Phase 8：Connectivity and Floating-input Rules

实现：

- Dangling Input；
- Unused Gate；
- Unused Opamp/Comparator；
- ADC Input；
- Open-drain；
- EN/CS/INT；
- MOSFET Gate；
- No-connect；
- Internal Pull Candidate；
- Review Gate。

## Phase 9：Power Rail and Decoupling Rules

实现：

- Supply Pin；
- Decoupling Role；
- Pin/Group/Rail Coverage；
- VCAP；
- Reference；
- Bulk；
- Voltage Rating；
- Shared Cap；
- Power Domain；
- PCB Geometry Hook；
- Findings。

## Phase 10：Regulator and Power-converter Rules

实现：

- LDO；
- Buck/Boost；
- Input/Output Capacitor；
- ESR；
- Inductor；
- Diode；
- Feedback；
- Compensation；
- Bootstrap；
- Enable；
- Power Good；
- Reverse Current；
- Applicability。

## Phase 11：Interface Rule Pack V1

实现：

- I2C；
- SPI；
- UART；
- External Connector；
- Pull/Default；
- Voltage Domain；
- Address Candidate；
- ESD Candidate；
- Exposure Profile；
- Tests。

## Phase 12：USB、CAN 和 RS-485 Rule Packs

实现：

- USB D+/D-；
- Type-C CC；
- VBUS；
- ESD；
- CAN Termination/TVS/VIO/Standby；
- RS-485 Termination/Fail-safe/DE/RE；
- System Context；
- Optional/Required；
- Findings。

## Phase 13：Clock and Crystal Rules

实现：

- Oscillator Pins；
- Crystal/Resonator；
- Frequency；
- Load Capacitors；
- Parasitic Candidate；
- ESR；
- Drive Level；
- Bias/Series；
- External Clock Mode；
- PCB Geometry Hook；
- Evidence。

## Phase 14：Reset、Boot 和 Debug Rules

实现：

- Reset Pull；
- RC/Supervisor；
- Button/Open-drain；
- Boot Strap；
- Runtime Reuse；
- External Device Influence；
- SWD/JTAG；
- Recovery；
- Agent 21 Cross-check。

## Phase 15：Rating and Derating Framework

实现：

- Parameter Type；
- Absolute Max vs Recommended；
- Voltage；
- Current；
- Power；
- Temperature；
- Capacitor Rating；
- Resistor Power；
- Diode；
- MOSFET；
- Inductor；
- Connector；
- Conditions；
- Unknown Handling。

## Phase 16：Analog Review Framework

实现：

- Opamp Supply/Common-mode/Output；
- Gain Bandwidth/Slew Candidate；
- Bias Path；
- Comparator Hysteresis；
- ADC Range/Source Impedance/RC；
- DAC Load；
- Reference；
- Missing Operating Condition Workflow。

## Phase 17：Reference Topology IR

实现：

- Node/Edge；
- Required/Optional；
- Alternative Branch；
- Equivalence；
- Parameter Constraints；
- Applicability；
- Evidence；
- Approval；
- Versioning。

## Phase 18：Topology Matcher

实现：

- Local K-hop Graph；
- Role-based Mapping；
- Pin/Net Constraints；
- Commutative/Equivalent Parts；
- Optional Branch；
- Match Status；
- Deviations；
- Confidence；
- Trace；
- Golden Tests。

## Phase 19：Finding Builder、Dedup 和 Root Cause

实现：

- Taxonomy；
- Severity；
- Confidence；
- Impact；
- Dedup；
- Native ERC Link；
- Root Cause Group；
- Stable Fingerprint；
- Reopen/Supersede。

## Phase 20：Review、Waiver 和 Baseline

实现：

- Queue；
- Triage；
- Decision；
- False Positive；
- Accepted Risk；
- Waiver Scope/Expiry；
- Baseline；
- New/Worsened/Resolved；
- Permissions；
- Audit。

## Phase 21：Repair Candidate Generator

实现：

- Add Component；
- Add Pull/Decoupling/Protection；
- Change Value/Rating；
- Connect/Disconnect；
- Request Information；
- Risk；
- Preconditions/Postconditions；
- No High-risk Auto-fix；
- Candidate Package。

## Phase 22：Agent 19 Adapter

实现：

- Candidate → Canonical Change Plan；
- Workspace；
- Preview；
- Approval；
- Execution；
- Readback；
- Agent 16 Reparse；
- Native ERC；
- Agent 20/21 Impact；
- Rollback。

## Phase 23：Post-fix Verification

实现：

- Finding Closure；
- New Finding；
- ERC Regression；
- Semantic Diff；
- Pin-to-Net Approved Change；
- Agent 20 Regression；
- Agent 21 Invalidated Config；
- Commit/Rollback Recommendation。

## Phase 24：AI Evidence RAG 和 Explanation

实现：

- Approved Evidence Index；
- Minimal Context；
- Structured Output；
- Citations to Evidence IDs；
- Explanation-only；
- Rule Draft Candidate；
- Hallucination Guard；
- No Severity/Connectivity Decision；
- Local/private Model。

## Phase 25：Review Workbench

实现：

- Finding List；
- Schematic Overlay；
- Local Topology；
- Rule Trace；
- Datasheet Evidence；
- Parameter Table；
- Reference Comparison；
- Repair Preview；
- Decision/Waiver；
- Post-fix Diff。

## Phase 26：Release Gate、CI 和 SARIF

实现：

- Concept/Design/NPI/Manufacturing Profiles；
- CLI；
- SARIF；
- Baseline Compare；
- Waiver；
- Exit Codes；
- Git Integration；
- Immutable Report；
- Event。

## Phase 27：API、Jobs、Events 和 Storage

实现：

- APIs；
- Progress；
- Batch；
- Cancel/Retry；
- Object Storage；
- JSONL；
- Pagination；
- Incremental Cache；
- Permissions；
- Audit；
- Metrics。

## Phase 28：Benchmark、监控和生产发布

实现：

- Golden Designs；
- Device Rule Packs；
- Topology；
- False Positive；
- False Negative；
- Regression；
- Performance；
- Security；
- Metrics；
- Dashboard；
- Feature Flags；
- Rule Rollback；
- Disaster Recovery。

## Phase 29：高级系统审查，可选

稳定后：

- Multi-board Power Sequence；
- EMI/EMC Rule Candidates；
- Safety Isolation Candidates；
- Thermal Network Candidates；
- Automotive/Industrial Profiles；
- Simulation Handoff；
- PCB-aware Loop/Placement；
- 仍不能宣称认证。

---

# 102. Codex 工作纪律

Codex 必须：

1. Native ERC 和 Advanced Review 分开；
2. Raw ERC 不覆盖；
3. Agent 16/18/20 输入质量先 Gate；
4. Candidate Netlist 不生成确定性高置信度 Finding；
5. Device Identity 不明时只用通用规则；
6. Exact MPN 规则需要批准证据；
7. Part Role 和 Net Role 保存证据；
8. Net Name 不作为唯一事实；
9. Power Rail 电压不凭名称伪造；
10. Unknown Operating Condition 保持 Unknown；
11. Rule ID/Version 永久保存；
12. Rule Evaluation 有 Trace；
13. Rule DSL 不执行任意代码；
14. Rule Conflict 不静默选择；
15. Severity 由规则定义；
16. AI 不修改 Severity；
17. AI 不生成独立确定性 Finding；
18. AI 不修改 Connectivity；
19. AI 只引用批准证据；
20. Datasheet Evidence 有 Hash/Page/Section；
21. Parameter 保存 Min/Typ/Max 和 Conditions；
22. Absolute Maximum 与 Recommended Operating 分开；
23. 典型值不当保证值；
24. 缺失条件不做高置信度参数判断；
25. 单位换算版本化；
26. Decimal 和范围计算；
27. 计算有 Formula Trace；
28. 去耦按 Pin/Group/Rail 分层；
29. Board Bulk 不等于 Local Decoupling；
30. 没有 PCB 不做位置结论；
31. Internal Pull 需要器件或 Firmware 证据；
32. I2C Pull-up 要考虑电压域；
33. CAN 终端要考虑系统位置；
34. USB Type-C 规则按角色；
35. 外部保护按 Exposure Profile；
36. 晶振计算保留寄生不确定度；
37. Reset/Boot 要考虑上电外设状态；
38. Firmware 配置只能交叉验证，不覆盖硬件事实；
39. Rating 使用 Worst-case 或明确条件；
40. 不自动推断工作电流；
41. Analog Review 缺工作点时请求输入；
42. Typical Application 不是强制设计；
43. Reference Topology 有 Applicability；
44. Optional Branch 不报必需错误；
45. Functionally Equivalent 允许；
46. Topology Match 保存完整映射；
47. Finding 去重但不丢原始来源；
48. Root Cause Group 保存子 Finding；
49. False Positive 反馈不能直接修改生产规则；
50. Waiver 有 Scope、Reason、Evidence、Expiry；
51. Critical Waiver 可配置双人审批；
52. Baseline 不隐藏新问题；
53. Repair Candidate 不直接执行；
54. 高风险电源/晶振/Boot 修改需人工；
55. Agent 19执行必须 Workspace/Snapshot；
56. 执行后 Agent 16重新解析；
57. 执行后重跑 Native ERC；
58. 执行后 Agent 20回归；
59. 影响 Agent 21 时必须标记；
60. Agent 19 Success 不等于 Finding Resolved；
61. Unexpected Pin-to-Net Change 是 Hard Gate；
62. New ERC Error 是 Hard Gate；
63. Release Pass 不等于认证；
64. 不发送私有工程给外部模型；
65. 不公开客户规则和私有数据；
66. 不伪造 Finding、参数、证据、修复或 Benchmark；
67. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Rule/Evidence/Calculation 变化；
    - 测试命令；
    - 真实结果；
    - Rule Coverage；
    - Finding Metrics；
    - False Positive；
    - Repair/Post-fix；
    - Release Gate；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 103. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/schematic-review-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第22个 Agent：

ERC, Device-Aware Schematic Review & Design Rule Agent /
ERC 与 AI 原理图审查 Agent。

本 Agent 接收：

- Agent 16 Project/Schematic/Part/Pin/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Library/Pin-Pad 校验；
- Agent 21 PinMux/Clock/Boot 配置，可选；
- KiCad/EDA 原生 ERC；
- 器件身份、参数、数据手册、应用笔记和参考设计；
- 企业、客户和产品类别规则；

检查：

- Native ERC；
- 电源和去耦；
- 悬空输入和默认状态；
- USB/I2C/SPI/UART/CAN/RS-485 等接口；
- 外部连接器保护；
- 晶振和外部时钟；
- Reset、Boot Strap 和 Debug；
- 器件电压、电流、功率、温度和降额；
- 运放、比较器、ADC、参考电压；
- LDO、DC/DC、反馈和补偿；
- 与典型应用和参考设计的拓扑偏差；

输出：

- Finding；
- Severity；
- Confidence；
- Evidence；
- Impact；
- Root Cause Group；
- Review Queue；
- Waiver/Baseline；
- Repair Candidate；
- Agent 19 Change Plan；
- Post-fix Regression；
- Release Gate。

本 Agent 不使用 LLM 决定 Connectivity、Severity、参数事实或 Release Pass，不把典型应用差异自动视为错误，不把 Absolute Maximum 当推荐工作范围。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16、18、19、20、21 规格和实际代码；
3. docs/schematic-review-agent-spec.md；
4. 当前 EDA ERC、Agent 16结构验证和 Agent 18冲突；
5. 当前 Part/Pin/Net/Power/Interface/Block IR；
6. 当前器件数据库、Pin Role 和参数；
7. 当前数据手册证据、应用笔记和参考设计；
8. 当前去耦、输入、接口、晶振、Reset/Boot 检查；
9. 当前 Unit/Range/Formula；
10. 当前 Typical Application/Topology；
11. 当前 Finding/Severity/Confidence；
12. 当前 Review/Waiver/Baseline；
13. 当前 Agent 19 Repair；
14. 当前 Agent 16 Reparse/Semantic Diff/ERC；
15. 当前 Agent 20/21 回归；
16. 当前 AI/RAG 和私有模型；
17. 当前 CI/SARIF/Release Gate；
18. 当前 API/Worker/Storage/Permission；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Native ERC/Advanced Review 分开；
- Raw ERC 保留；
- Input Quality First；
- Candidate Netlist 不生成确定性 Finding；
- Device-specific Rule 需要 Exact Identity 和批准证据；
- Net Name 不是唯一事实；
- Unknown Voltage/Condition 保持 Unknown；
- Rule Version/Trace；
- Rule DSL No Arbitrary Code；
- Rule Conflict 不静默选择；
- Severity 由规则；
- AI 不改 Severity/Connectivity；
- AI 只解释和生成规则草稿；
- Evidence 有 Hash/Page/Section；
- Min/Typ/Max/Conditions 分开；
- Abs Max != Recommended；
- Missing Condition 不伪造计算；
- Unit/Decimal/Formula Trace；
- Local Decoupling != Board Bulk；
- 无 PCB 不做位置结论；
- Internal Pull 需要证据；
- Interface Rule 有 Role/Exposure/System Context；
- Crystal 有 Parasitic Uncertainty；
- Reset/Boot 考虑上电状态；
- Typical Application 有 Applicability；
- Difference != Error；
- Optional/Equivalent 分开；
- Finding Dedup 不丢来源；
- Waiver 有 Scope/Reason/Expiry；
- Repair 通过 Agent 19；
- High-risk Change 人工审批；
- Post-fix Agent 16 + Native ERC + Agent 20；
- Agent 21影响需标记；
- Unexpected Pin-to-Net/New ERC Error Hard Gate；
- Review Pass != Certification；
- 不发送私有工程给外部模型；
- 不用私有项目做公开 Fixture；
- 不伪造 Finding、参数、证据和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改工程：

1. 侦察当前仓库；
2. 检查 Agent 16/18/19/20/21 Contract；
3. 查找 Native ERC 和结构验证；
4. 查找 Part/Net Role、Power Rail、Interface、Block；
5. 查找器件身份、Pin Role 和参数；
6. 查找 Datasheet Evidence；
7. 查找 Application Note/Reference Design；
8. 查找 Rule Engine/DSL；
9. 查找 Units/Formula；
10. 查找 Decoupling/Floating Input；
11. 查找 USB/I2C/SPI/UART/CAN/RS-485；
12. 查找 Crystal/Reset/Boot；
13. 查找 Rating/Derating/Analog；
14. 查找 Typical Application/Topology；
15. 查找 Finding/Dedup/Severity/Confidence；
16. 查找 Review/Waiver/Baseline；
17. 查找 Repair/Agent 19；
18. 查找 Post-fix/Agent 20/21；
19. 查找 AI/RAG；
20. 查找 CI/SARIF/Release Gate；
21. 查找 API/Queue/Worker/Storage/Security；
22. 统计真实规则和证据覆盖；
23. 统计 False Positive、Waiver 和回归问题；
24. 抽样分析开源、合成、脱敏或授权工程；
25. 在 docs/schematic-review-implementation-plan.md 中生成实施计划；
26. 在 docs/input-and-release-gates.md 中定义输入 Gate；
27. 在 docs/circuit-context-model.md 中定义 Context；
28. 在 docs/native-erc-normalization.md 中定义 ERC；
29. 在 docs/rule-dsl.md 中定义规则；
30. 在 docs/device-knowledge-and-evidence.md 中定义证据；
31. 在 docs/power-and-decoupling-rules.md 中定义电源；
32. 在 docs/floating-input-rules.md 中定义输入；
33. 在 docs/interface-protection-rules.md 中定义接口；
34. 在 docs/clock-reset-boot-rules.md 中定义时钟/启动；
35. 在 docs/rating-and-derating.md 中定义额定值；
36. 在 docs/analog-review.md 中定义模拟；
37. 在 docs/topology-matching.md 中定义拓扑；
38. 在 docs/findings-and-severity.md 中定义 Finding；
39. 在 docs/repair-and-agent19.md 中定义修复；
40. 在 docs/waivers-baselines-release-gates.md 中定义流程；
41. 在 docs/ai-boundaries.md 中定义 AI 边界；
42. 在 docs/security.md 中定义安全；
43. 在 docs/schematic-review-migration-plan.md 中定义旧能力迁移；
44. 在 docs/schematic-review-benchmark-plan.md 中定义 Benchmark；
45. 给出拟新增、拟修改和拟复用文件；
46. 给出 Phase 1 精确范围；
47. 不修改业务代码；
48. 不创建 Migration；
49. 不安装依赖；
50. 不调用外部模型；
51. 不执行 Agent 19写操作；
52. 不读取或打印 Secret；
53. 运行仓库已有 lint、type check、test、build 和 security scan；
54. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/18/19/20/21 Contract；
- Input Gate；
- Native ERC；
- Circuit Context；
- Device Knowledge/Evidence；
- Rule DSL；
- Unit/Calculation；
- Power/Decoupling；
- Floating Input；
- Interfaces；
- Clock/Reset/Boot；
- Ratings/Derating；
- Analog；
- Typical Application/Topology；
- Finding/Severity/Confidence；
- Review/Waiver/Baseline；
- Repair/Agent 19；
- Post-fix Verification；
- AI Boundaries；
- Release Gate/CI；
- Security；
- API/Events；
- 旧能力迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 104. 后续 Phase 提示词模板

```text
继续实现 Schematic Review Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16、18、19、20、21、22 规格；
3. 阅读 Schematic Review Implementation Plan；
4. 阅读 Input、Context、ERC、Rules、Evidence、Power、Interface、Clock、Ratings、Topology、Finding、Repair、AI、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Input Quality Gate；
- Native ERC Preservation；
- Versioned Rules/Evidence；
- Deterministic Calculations；
- Abs Max != Recommended；
- Difference != Error；
- AI Explanation-only；
- Agent 19 Controlled Repair；
- Post-fix Regression；
- No Private External Model；
- 不公开真实工程；
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
9. rule/evidence test；
10. finding/dedup test；
11. repair/regression test；
12. security test；
13. performance test；
14. benchmark；
15. 更新文档；
16. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Rule/Evidence/Calculation 变化；
- 测试命令和真实结果；
- Rule Coverage；
- Finding Metrics；
- False Positive；
- Repair/Post-fix；
- Release Gate；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 105. MVP 演示流程

1. 选择一份 STM32G4 控制板 KiCad 工程；
2. Agent 16解析原理图；
3. Agent 18提供 Reviewed Pin-to-Net；
4. Agent 20确认库和 Pin-Pad 通过；
5. 导入 KiCad ERC；
6. 原生 ERC 发现一个 Power Input not driven；
7. Context Builder 识别 MCU、电源、USB、CAN、晶振和复位块；
8. 解析 3.3V 和 5V Rail；
9. 识别 MCU 的多个 VDD Pin；
10. 发现 VDD1/VDD2 有去耦；
11. 发现 VDDA 只有一个远端 Bulk，缺本地模拟去耦候选；
12. 生成 Warning，并标记“无 PCB 时未检查距离”；
13. 发现 VCAP Pin 没有数据手册要求的电容；
14. 生成 Error；
15. 识别 I2C Sensor；
16. 发现 SDA/SCL 上没有外部上拉；
17. Agent 21显示未启用内部 Pull-up；
18. 生成 Error；
19. 识别 USB Type-C Device；
20. 发现 CC1/CC2 缺少角色所需电阻；
21. 生成 Error；
22. 发现 D+/D- 有 ESD 但 VBUS 无过压保护；
23. 根据“内部 USB、低暴露”Profile 生成 Info 而不是 Error；
24. 识别 CAN 收发器；
25. 发现 120Ω 终端存在；
26. 用户说明该板为中间节点；
27. 将终端问题从 Warning 变为 System Review；
28. 识别 8MHz 晶体；
29. 读取 CL 参数；
30. 计算负载电容候选范围；
31. 当前电容明显偏大，生成 Warning；
32. 识别 NRST；
33. 外部 Pull-up 和按钮正确；
34. 识别 BOOT0；
35. BOOT0 与 LED 共享；
36. LED 驱动网络上电时可能拉高；
37. 生成 Error；
38. 发现一个运放未使用单元输入悬空；
39. 生成 Warning；
40. 读取 LDO 输出电容要求；
41. 当前值在范围内；
42. 读取电容耐压；
43. 发现 5V Rail 使用 6.3V X5R；
44. 根据企业降额规则生成 Warning；
45. 构建 LDO 典型应用拓扑；
46. 设计缺少可选的反向保护；
47. Applicability 不满足，标记 Not Applicable；
48. 合并原生 ERC 和高级规则的同一电源根因；
49. 生成 Review Report；
50. 工程师确认 VCAP、I2C Pull-up 和 BOOT0 三个 Finding；
51. 为 VCAP 和 I2C 生成 Repair Candidate；
52. BOOT0 修改为 High Risk，需人工方案；
53. Agent 19在 Workspace 中添加 VCAP 电容和 I2C 上拉；
54. Agent 16重新解析；
55. 重跑 KiCad ERC；
56. Agent 20检查库和 Pin-Pad；
57. Agent 21检查 I2C 和 Boot 配置；
58. VCAP/I2C Finding 关闭；
59. 新增 ERC Error 为零；
60. BOOT0 仍阻断 NPI Gate；
61. 用户修改硬件方案并批准；
62. 再次执行和复审；
63. 所有 Critical/Error 关闭；
64. 生成带 Rule/Evidence/Revision 的 Release Gate Report；
65. 发布 `schematic-review.completed-with-findings` 或通过事件。

---

# 106. 生产上线顺序

第一阶段：

```text
Native ERC Import
Input Quality Gate
Circuit Context
Common Connectivity
Floating Inputs
Basic Decoupling
I2C/SPI/UART
Reset/Boot
Findings/Review
Report-only CI
```

第二阶段：

```text
USB/CAN/RS-485
Device-specific Power Rules
Crystal
Ratings/Derating
Analog
Repair Candidate
Agent 19 Post-fix
```

第三阶段：

```text
Reference Topology
Advanced Power Converter
PCB-aware Review
AI Evidence Explanation
Enterprise Rule Marketplace
Multi-board/System Review
```

上线优先确保：

```text
这个问题建立在什么电路事实之上
规则适用于哪类器件和什么工作条件
参数来自哪一版数据手册
典型应用差异究竟是错误还是合理变体
修复后有没有引入新的连接或 ERC 问题
```

一个真正可信的 AI 原理图审查 Agent，不应该像“懂很多电子术语的挑错机器人”。它应该更像一位严谨的资深工程师：知道哪些是确定事实，哪些只是经验建议，哪些信息还缺失，也知道什么时候应该停下来问一句“这块板到底工作在什么条件下？”
