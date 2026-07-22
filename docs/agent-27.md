# DRC、SI、PI 与 EMC 审查 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：27  
> Agent 名称：PCB DRC, Signal Integrity, Power Integrity & EMC Review Agent  
> 中文名称：DRC、SI、PI 与 EMC 审查 Agent  
> 类型：程序＋混合型  
> 版本：V1.0  
>
> 定位：基于 Agent 16–26 输出的结构化 EDA 工程、Reviewed Netlist、库与 Pin-Pad 校验、固件接口配置、原理图审查、仿真结果、PCB Constraint IR、Placement IR 和 Routing IR，执行 EDA 原生 DRC、PCB 几何与拓扑审查、回流路径与平面分割检查、差分与时序完整性检查、串扰和阻抗突变风险评估、DC Power Path 与 PDN 审查、去耦有效性与电源回路分析、接口保护和 EMI 风险审查；在模型充分时生成 IBIS、Touchstone、SPICE、PDN 或外部 SI/PI/EMC 求解任务，并输出证据化 Finding、修复候选、仿真包、Waiver 和 Release Gate。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Footprint/Pad/Track/Via/Zone/Stack-up/Net IR、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、网络连接置信度和 Release Level
> - Agent 20：Footprint、Padstack、Pin-Pad、库版本、模型映射和实例一致性
> - Agent 21：PinMux、Peripheral、Clock、Bus Speed、Memory、PWM、ADC、Drive Strength、Slew Rate 和 Firmware Configuration
> - Agent 22：ERC、去耦、电源、复位、保护、晶振、额定值和典型应用 Finding
> - Agent 23：SPICE Simulation IR、边沿、带宽、负载、稳定性、噪声、应力和工作条件
> - Agent 24：PCB Constraint IR、Stack-up、阻抗、线宽、Gap、Via、Length、Delay、Skew、Return Path、Clearance/Creepage、Keepout 和 Rule Area
> - Agent 25：Placement IR、功能分区、关键回路、Routing Corridor、热和拥塞信息
> - Agent 26：Routing IR、Route Graph、Track/Via/Zone、Length/Delay/Skew、未布网络、回流候选和 Router Verification
> - Agent 19：KiCad MCP/IPC/CLI、Workspace、Change Plan、Readback、DRC 和 Rollback
> - 器件数据手册、IBIS、IBIS-AMI、SPICE、S-parameter/Touchstone、封装寄生和连接器模型
> - PCB Stack-up、材料参数、铜厚、粗糙度、阻焊、Via 工艺和制造商能力
> - 电源负载 Profile、工作模式、启动时序、脉冲负载、环境和热条件
> - 外壳、线缆、连接器、屏蔽、机壳地、接地和认证目标
> - 企业 PCB 规范、产品类别规范、客户规范、历史失效和实验室测试结果
>
> 下游：
> - Agent 24：补充或修正阻抗、间距、回流、高压、Via、层和 EMC 约束
> - Agent 25：局部移动器件、调整分区、缩小关键回路、改善接口保护和热布局
> - Agent 26：局部重布、换层、增加回流 Via、调整间距、减少 Stub 和修改调长区域
> - Agent 23：运行 SPICE、IBIS 或其他可执行仿真任务
> - Agent 19：在受控 Workspace 中执行批准修复
> - Agent 43：NPI、设计冻结和制造发布
> - Agent 45：测试点、EMI/ESD 测试要求和失效追溯
> - CI、Review Workbench、质量门禁、设计评审和合规证据包
>
> 核心输出：
> - PCB Review Input Snapshot
> - Analysis Readiness and Fidelity Report
> - Native DRC Run and Normalized DRC Finding
> - Schematic-to-PCB Parity Report
> - Constraint Resolution and Coverage Report
> - Connectivity / Short / Open / Unconnected Report
> - Return-path Graph and Plane Continuity Report
> - Plane Split Crossing Finding
> - Loop Area and Current Path Finding
> - Differential Pair and High-speed Route Finding
> - Impedance Profile and Discontinuity Finding
> - Crosstalk Coupling Window and Risk Finding
> - Stub, Via Transition and Resonance Risk Finding
> - Topology and Termination Placement Finding
> - DC Power Path and Voltage-drop Report
> - Via/Neck/Connector Current Bottleneck Finding
> - PDN Graph and Target Impedance Review
> - Decoupling Assignment and Frequency-band Coverage
> - Plane Resonance and Anti-resonance Candidate
> - Ground/Power Island and Copper Sliver Finding
> - EMI Aggressor/Victim Map
> - Common-mode Conversion and Cable Excitation Risk
> - Interface Protection Chain Review
> - ESD/TVS/CMC/Filter Placement Finding
> - Chassis/Shield/Seam/Board-edge Risk Finding
> - SI/PI/EMC Simulation Package
> - Unified Review Finding IR
> - Review Evidence Package
> - Repair Candidate and Agent Feedback
> - Waiver, Baseline and Release Gate
>
> 重要边界：
> - 本 Agent 不是 EMC、安规或产品认证机构，不能把规则、仿真或风险评分描述为实验室认证通过。
> - 原生 DRC、几何规则、解析公式、近似模型、IBIS/Touchstone 仿真和全波仿真必须分层报告，不能混成一个“AI 结论”。
> - DRC 通过只表示当前配置的规则没有发现问题，不表示 SI、PI、EMC、热、可靠性或安全满足要求。
> - SI/PI/EMC 结论必须绑定 Stack-up、材料、模型、工作模式、边沿、负载、连接器、线缆和环境。
> - 未知 Dk、铜厚、参考层、IBIS 模型、S-parameter、负载 Profile 或外壳信息时，相关分析必须降级或返回 `indeterminate`。
> - 不把网络名 `CLK`、`USB`、`GND`、`HV` 当作唯一事实。
> - 不把“附近有 GND 铜”自动判定为连续回流路径。
> - 不把平面分割线附近的几何距离直接等同回流阻抗；必须报告所用近似或求解模型。
> - 不把平行走线长度和间距直接转化为确定的串扰电压，除非驱动、终端、层叠和模型充分。
> - 不根据图片或 3D 渲染估算精确电磁结果。
> - 不把 PCB 总 GND 面积当作低阻抗接地保证。
> - 不把去耦电容数量当作 PDN 有效性；必须考虑值、ESR/ESL、封装、Via、位置、平面和频带。
> - 不把所有地强制合并，也不把所有地分割视为正确；应按回流路径和系统接口判断。
> - AI 只用于证据提取、Finding 解释、风险归类和修复说明，不生成虚假数值、波形、场图或认证结论。
> - 不自动修改生产 PCB；修复通过 Agent 19 的 Workspace、Preview、Approval、Readback 和 Rollback。
> - 不把客户 PCB、IBIS/S 参数、外壳、线缆和实验室数据发送给外部通用模型。

---

# 1. Agent 27 的系统位置

```text
Reviewed PCB / Constraint / Placement / Routing
                         ↓
Input, Model and Fidelity Gate
                         ↓
Native DRC and Connectivity Verification
                         ↓
Geometry and Return-path Analysis
                         ↓
SI Structural / Analytical / Simulation Review
                         ↓
PI DC / PDN / Decoupling Review
                         ↓
EMC Topology / Common-mode / Interface Risk Review
                         ↓
Unified Finding and Evidence Correlation
                         ↓
Repair Candidate and Upstream Feedback
                         ↓
Agent 19 Controlled Execution
                         ↓
Reparse / DRC / SI / PI / EMC Regression
```

---

# 2. 审查分层

## Level 0：原生规则和确定性检查

```text
KiCad DRC
Short/Open
Clearance/Creepage
Track/Via/Pad/Zone
Board Edge
Unconnected
Rule Syntax
Rule Coverage
Schematic-PCB Parity
```

## Level 1：几何与拓扑审查

```text
Plane Split Crossing
Reference Plane Continuity
Loop Area Proxy
Stub Geometry
Parallel Coupling Window
Via Transition
Differential Uncoupled Segment
Interface Protection Order
Power Path Bottleneck
```

## Level 2：解析和网络模型

```text
Transmission-line Approximation
Impedance Profile
Crosstalk Estimate
DC Voltage Drop
PDN Lumped Network
Decoupling Frequency Coverage
Plane Resonance Candidate
```

## Level 3：模型驱动仿真

```text
SPICE
IBIS
Touchstone/S-parameter
PDN Frequency Sweep
Channel Simulation
Optional 2D/2.5D Solver
```

## Level 4：实验关联

```text
TDR
VNA
Oscilloscope
Current Probe
Near-field Scan
Conducted/Radiated EMI
ESD/EFT/Surge Test
```

每个 Finding 必须记录 `analysis_level`。

---

# 3. Fidelity 等级

```text
F0 rule_only
F1 geometry_aware
F2 stackup_analytical
F3 model_driven
F4 solver_validated
F5 measurement_correlated
```

Fidelity 不足时：

```text
pass → prohibited
fail → risk finding only
result → indeterminate or candidate
```

---

# 4. 建设目标

系统必须能够：

1. 接收 Agent 16 PCB IR；
2. 接收 Agent 18 Reviewed Netlist；
3. 接收 Agent 20 Library/Padstack 状态；
4. 接收 Agent 21 Firmware 和 Slew 配置；
5. 接收 Agent 22 ERC Finding；
6. 接收 Agent 23 Simulation Result；
7. 接收 Agent 24 Constraint IR；
8. 接收 Agent 25 Placement IR；
9. 接收 Agent 26 Routing IR；
10. 接收 Project Revision；
11. 接收 Board File；
12. 接收 Rule File；
13. 接收 Stack-up；
14. 接收 Material；
15. 接收 Copper Thickness；
16. 接收 Dk/Df；
17. 接收 Roughness；
18. 接收 Mask；
19. 接收 Via；
20. 接收 Connector；
21. 接收 Cable；
22. 接收 Enclosure；
23. 接收 Chassis；
24. 接收 Shield；
25. 接收 Grounding；
26. 接收 Operating Mode；
27. 接收 Edge Rate；
28. 接收 Drive Strength；
29. 接收 Load；
30. 接收 Power Profile；
31. 接收 Current Profile；
32. 接收 IBIS；
33. 接收 IBIS-AMI；
34. 接收 Touchstone；
35. 接收 SPICE；
36. 接收 Package Model；
37. 接收 Measurement；
38. 建立不可变 Input Snapshot；
39. 建立 Model Snapshot；
40. 建立 Rule Snapshot；
41. 建立 Analysis Policy Snapshot；
42. 建立 Analysis Capability Snapshot；
43. 运行 KiCad DRC；
44. 支持 Refill Zones；
45. 支持 Schematic Parity；
46. 支持 Error/Warning/Exclusion；
47. 解析 DRC JSON/Report；
48. 归一化 Violation；
49. 关联 Board Object；
50. 关联 Canonical Constraint；
51. 关联 Source Evidence；
52. 识别 Short；
53. 识别 Open；
54. 识别 Unconnected；
55. 识别 Dangling Track；
56. 识别 One-layer Via；
57. 识别 Zone Island；
58. 识别 Thermal Relief；
59. 识别 Copper Sliver；
60. 识别 Board-edge Risk；
61. 识别 Drill/Via/Annular Ring；
62. 识别 Physical Clearance；
63. 识别 Creepage；
64. 识别 Rule Zero-match；
65. 识别 Shadowed Rule；
66. 识别 Excluded Violation；
67. 识别 Ignored Test；
68. 建立 Effective Rule Trace；
69. 建立 Layer Reference Map；
70. 建立 Signal-to-reference Relationship；
71. 建立 Return-path Graph；
72. 识别 Reference Plane；
73. 识别 Plane Split；
74. 识别 Void；
75. 识别 Plane Neck；
76. 识别 Plane Island；
77. 识别 Reference Change；
78. 识别 Missing Return Via；
79. 识别 Stitching Via；
80. 识别 Chassis Transition；
81. 识别 Connector Return Pins；
82. 识别 Cable Return；
83. 识别 Return Detour；
84. 计算 Return-path Detour Proxy；
85. 计算 Loop Area Proxy；
86. 识别 High di/dt Loop；
87. 识别 High dv/dt Node；
88. 识别 Switch Node；
89. 识别 Gate Drive Loop；
90. 识别 Decoupling Loop；
91. 识别 Crystal Loop；
92. 识别 Interface Loop；
93. 识别 Differential Pair；
94. 识别 Pair Width/Gap；
95. 识别 Pair Skew；
96. 识别 Uncoupled Length；
97. 识别 Pair Via Asymmetry；
98. 识别 Pair Layer Asymmetry；
99. 识别 Pair Reference Change；
100. 识别 Common-mode Conversion Candidate；
101. 识别 Single-ended High-speed；
102. 识别 Clock；
103. 识别 Strobe；
104. 识别 Memory Group；
105. 识别 Stub；
106. 识别 Branch；
107. 识别 Topology；
108. 识别 Termination；
109. 识别 Termination Placement；
110. 识别 Source/Load；
111. 识别 Via Transition；
112. 识别 Neck-down；
113. 识别 Pad Discontinuity；
114. 识别 Connector Discontinuity；
115. 识别 Layer Transition；
116. 生成 Impedance Profile；
117. 生成 Discontinuity Candidate；
118. 生成 Reflection Risk；
119. 生成 TDR Simulation Package；
120. 识别平行耦合走线；
121. 计算 Coupling Window；
122. 计算 Spacing/Height Ratio；
123. 识别 Aggressor；
124. 识别 Victim；
125. 识别 Same-layer Coupling；
126. 识别 Broadside Coupling；
127. 识别 Coupled Via Candidate；
128. 生成 Crosstalk Risk；
129. 生成 Near-end/Far-end Candidate；
130. 生成 IBIS Channel Package；
131. 建立 DC Power Graph；
132. 识别 Source；
133. 识别 Load；
134. 识别 Rail；
135. 识别 Track/Via/Plane Segment；
136. 识别 Connector/Fuse/Switch；
137. 计算 Segment Resistance；
138. 计算 DC Voltage Drop；
139. 计算 Current Density Proxy；
140. 识别 Neck Bottleneck；
141. 识别 Via Bottleneck；
142. 识别 Connector Pin Bottleneck；
143. 识别 Thermal Relief Bottleneck；
144. 识别 Zone Island；
145. 建立 PDN Graph；
146. 建立 Capacitor Model；
147. 关联 Capacitor ESR/ESL；
148. 关联 Mounting Inductance；
149. 关联 Plane Inductance；
150. 关联 VRM Output Model；
151. 关联 Load Dynamic Profile；
152. 建立 Target Impedance；
153. 执行 PDN Frequency Sweep；
154. 识别 Anti-resonance；
155. 识别 Resonance Peak；
156. 识别 Frequency Coverage Gap；
157. 识别 Decoupling Assignment；
158. 识别 Missing Local Decoupling；
159. 识别 Shared Decoupling Risk；
160. 识别 Long Via Path；
161. 识别 Plane Pair Candidate；
162. 识别 Plane Resonance Candidate；
163. 生成 PI Simulation Package；
164. 建立 EMC Aggressor Map；
165. 识别 Clock Harmonic Candidate；
166. 识别 Fast Edge；
167. 识别 High-current Switching；
168. 识别 Large Loop；
169. 识别 Board-edge Parallel Route；
170. 识别 Long External Cable Interface；
171. 识别 Common-mode Excitation；
172. 识别 Chassis Coupling；
173. 识别 Shield Discontinuity；
174. 识别 Seam/Slot Candidate；
175. 识别 Plane Aperture；
176. 识别 Connector Return Imbalance；
177. 识别 Cable Shield Termination；
178. 识别 Ground Stitching Gap；
179. 识别 RF Antenna Coupling；
180. 识别 Crystal/Clock Leakage；
181. 识别 PWM/Motor Aggressor；
182. 识别 DC/DC Switch Node Radiation Risk；
183. 识别 ESD Entry Point；
184. 识别 TVS；
185. 识别 CMC；
186. 识别 Filter；
187. 识别 Series Resistor；
188. 识别 Protection Placement Order；
189. 识别 Protection Return Path；
190. 识别 TVS-to-chassis/GND Path；
191. 识别 Connector-to-protection Distance；
192. 识别 Unprotected Branch；
193. 识别 Test Stub；
194. 生成 EMI Risk Map；
195. 生成 Conducted Emission Candidate；
196. 生成 Radiated Emission Candidate；
197. 生成 Susceptibility Candidate；
198. 生成 ESD/EFT/Surge Risk Candidate；
199. 生成 Near-field Scan Plan；
200. 生成 Lab Test Plan；
201. 生成 SI/PI/EMC Finding；
202. 生成 Severity；
203. 生成 Confidence；
204. 生成 Fidelity；
205. 生成 Evidence；
206. 生成 Affected Objects；
207. 生成 Causal Chain；
208. 生成 Repair Candidate；
209. 区分 Rule/Geometry/Model/Test Finding；
210. 区分 Design/Constraint/Model/Measurement Repair；
211. 生成 Agent 24 Feedback；
212. 生成 Agent 25 Feedback；
213. 生成 Agent 26 Feedback；
214. 生成 Agent 23 Simulation Request；
215. 生成 Agent 19 Change Plan Candidate；
216. 支持 Review；
217. 支持 Accept/Reject；
218. 支持 Waiver；
219. 支持 Baseline；
220. 支持 Diff；
221. 支持 Regression；
222. 支持 CI；
223. 支持 Release Gate；
224. 支持多租户；
225. 支持批量工程；
226. 支持私有部署；
227. 不把启发式风险判定为确定 Fail；
228. 不把模型缺失判定 Pass；
229. 不把 DRC Pass 判定 EMC Pass；
230. 不伪造模型、场图、波形、测试和认证结果；
231. 不自动降低规则；
232. 不静默接受 Exclusion；
233. 不发送私有设计和模型到外部模型。

---

# 5. 核心架构

```text
Input Snapshot
→ Native DRC
→ Geometry/Topology Graphs
→ SI Review
→ PI Review
→ EMC Review
→ Finding Correlation
→ Repair/Simulation Feedback
→ Controlled Write
→ Regression
```

---

# 6. Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "agent16_pcb_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_report_hash": "sha256",
  "agent21_ir_hash": "sha256",
  "agent22_review_hash": "sha256",
  "agent23_result_hash": "sha256",
  "agent24_constraint_hash": "sha256",
  "agent25_placement_hash": "sha256",
  "agent26_routing_hash": "sha256",
  "model_snapshot_hash": "sha256",
  "analysis_policy_hash": "sha256"
}
```

---

# 7. Analysis Readiness Gate

## Blocked

```text
Agent 18 Release 太低
Agent 20 Padstack Critical
Agent 24 Stack-up 缺失
Agent 26 Routing IR 不一致
Board File 无法解析
DRC Rule 语法错误
关键模型来源不可追溯
```

## Geometry-only

```text
无 IBIS
无 S 参数
无动态负载
无外壳/线缆
```

## Model-driven

```text
Stack-up 完整
端点和模型映射明确
IBIS/SPICE/Touchstone 批准
工作条件明确
```

## Measurement-correlated

```text
测试板 Revision 一致
仪器设置和校准可追溯
测量点与 Net/Pad 对齐
```

---

# 8. Native DRC Adapter

支持：

```text
kicad-cli pcb drc
zone refill
schematic parity
error/warning/exclusion
machine-readable report
board object mapping
```

不依赖 GUI 截图判断 DRC。

---

# 9. DRC Finding Normalization

```json
{
  "finding_type": "clearance_violation",
  "native_rule_id": "string",
  "severity": "error",
  "objects": [],
  "location": {},
  "actual": {},
  "required": {},
  "excluded": false,
  "source_run_id": "uuid"
}
```

---

# 10. Exclusion 和 Ignore

状态：

```text
active
excluded_with_reason
excluded_without_reason
ignored_by_policy
waived
expired
```

`excluded_without_reason` 不允许通过 Release Gate。

---

# 11. Effective Rule Trace

每个违规或检查对象保存：

```text
global rule
net class
component class
rule area
custom rules
priority
selected effective rule
shadowed rules
text variable values
```

---

# 12. PCB Connectivity

独立检查：

```text
short
open
dangling track
unconnected via
zone connectivity
thermal connection
net tie
jumpered pins
schematic parity
```

---

# 13. Return-path Graph

节点：

```text
signal segment
reference plane region
via transition
return via
connector return pin
chassis connection
cable shield
ground bridge
```

边：

```text
referenced_by
connected_to
transition_via
chassis_transition
shield_transition
possible_return
blocked_by_split
```

---

# 14. Reference Plane Determination

证据：

```text
adjacent layer
Stack-up
local plane geometry
Net Class
Rule
signal layer
trace width/height
power plane AC reference policy
```

`adjacent GND layer` 不是唯一判定。

---

# 15. Plane Split Crossing

检查：

```text
trace projection
reference plane polygon
void/slot/split
crossing length
nearest return bridge
alternative reference
frequency/edge context
```

结果：

```text
definite_geometric_crossing
likely_return_detour
reference_ambiguous
model_required
reviewed_ok
```

---

# 16. Loop Area

区分：

```text
geometric loop proxy
current-path loop
switching hot loop
signal-return loop
cable/common-mode loop
```

没有明确回流路径时只输出 Proxy。

---

# 17. Impedance Profile

沿 Route Chain 分段保存：

```text
layer
width
gap
reference plane
dielectric
copper
mask
via
pad
neck-down
connector
estimated impedance
solver/model
confidence
```

---

# 18. Impedance Discontinuity

类型：

```text
width step
gap step
reference change
via
pad
stub
connector
plane aperture
neck-down
branch
test point
```

输出：

```text
location
before/after geometry
estimated severity
frequency relevance
model requirement
repair candidates
```

---

# 19. Crosstalk Coupling Window

保存：

```text
aggressor
victim
same/broadside layer
parallel length
spacing
height to reference
direction
edge-rate context
termination context
coupled vias
```

---

# 20. Crosstalk 分析等级

```text
geometry_ratio
analytical_estimate
IBIS channel
S-parameter channel
field_solver
measurement
```

没有模型时不输出伪精确毫伏值。

---

# 21. Differential Pair Review

检查：

```text
polarity
width/gap
skew
uncoupled length
via symmetry
layer symmetry
reference continuity
pair-to-aggressor spacing
common-mode conversion
connector pin mapping
```

---

# 22. Stub 和 Topology

检查：

```text
max stub
branch point
test point
via stub
connector stub
termination position
source/receiver order
fly-by/daisy/star
```

---

# 23. IBIS/Touchstone 模型

Model Registry 保存：

```text
source
version
hash
license
component/package/pin mapping
corner
voltage
temperature
supported analysis
validation status
```

模型和端口映射不明确时阻断模型驱动仿真。

---

# 24. DC Power Graph

节点：

```text
source
connector
fuse
switch
protection
regulator
plane region
track
via
load
return
```

边保存：

```text
resistance
current
voltage drop
power loss
temperature assumption
confidence
```

---

# 25. Current Bottleneck

检查：

```text
track neck
via count
via plating
thermal relief
connector pin
fuse
switch
plane neck
zone island
pad transition
```

---

# 26. PDN Graph

包含：

```text
VRM
bulk capacitor
local capacitor
plane pair
trace/via inductance
package
load current
ground return
```

---

# 27. Target Impedance

必须来自：

```text
允许纹波
瞬态电流
频率范围
工作模式
Rail 电压
Margin
```

不能凭经验自动生成最终目标。

---

# 28. Decoupling Review

检查：

```text
assignment to power pins
value distribution
ESR/ESL
mounting inductance
via count
same-side
plane access
frequency-band coverage
anti-resonance
shared capacitor
bulk/local hierarchy
```

---

# 29. PDN 结果状态

```text
geometry_only
lumped_estimate
frequency_sweep
solver_validated
measurement_correlated
indeterminate
```

---

# 30. EMC Aggressor Map

Aggressor 类型：

```text
clock
PWM
switch node
motor drive
memory bus
high-current pulse
RF transmitter
external cable driver
ESD entry
```

属性：

```text
edge rate
frequency
harmonic candidates
current
loop proxy
board location
nearby victims
external coupling path
```

---

# 31. EMC Victim Map

```text
ADC/reference
crystal
reset
high-impedance input
RF receiver
sensor
external cable
chassis seam
antenna
power rail
```

---

# 32. Common-mode Conversion Risk

来源：

```text
diff-pair asymmetry
unequal vias
unequal reference
connector imbalance
return discontinuity
ESD/CMC asymmetry
cable shield termination
plane split
```

---

# 33. Interface Protection Chain

期望顺序和关系：

```text
connector
ESD/TVS
filter/CMC
termination
transceiver/MCU
return/chassis path
```

检查：

```text
unprotected branch
distance
return path
component orientation
symmetry
rated voltage/capacitance
chassis/GND destination
```

额定值由 Agent 22 和器件数据提供。

---

# 34. EMI Risk 类型

```text
radiated_emission_candidate
conducted_emission_candidate
common_mode_cable_candidate
immunity_candidate
esd_entry_candidate
eft_surge_candidate
clock_leakage_candidate
switching_node_candidate
shield_discontinuity_candidate
```

“Candidate” 不能直接写成“超标”。

---

# 35. Unified Finding IR

```json
{
  "finding_id": "uuid",
  "domain": "si",
  "finding_type": "reference_plane_split_crossing",
  "analysis_level": "geometry_aware",
  "fidelity": "F1",
  "severity": "high",
  "confidence": {},
  "affected_objects": [],
  "evidence_ids": [],
  "measurements": {},
  "causal_chain": [],
  "repair_candidates": [],
  "status": "open"
}
```

---

# 36. Finding Severity

```text
critical
high
medium
low
info
```

Severity 综合：

```text
safety impact
functional impact
performance margin
external exposure
production risk
evidence confidence
```

Confidence 与 Severity 分开。

---

# 37. Finding 状态

```text
open
needs_information
needs_model
needs_simulation
needs_measurement
accepted
rejected
fixed
verified
waived
false_positive
superseded
```

---

# 38. Repair 分类

```text
constraint_repair → Agent 24
placement_repair → Agent 25
routing_repair → Agent 26
simulation_request → Agent 23
eda_change → Agent 19
model_request
measurement_request
documentation_only
```

---

# 39. AI 允许职责

```text
从已批准资料提取 SI/PI/EMC 条件
总结 Finding
生成因果链候选
解释风险和局限
整理修复选项
生成实验计划草稿
```

---

# 40. AI 禁止职责

```text
伪造 DRC 结果
伪造场图或波形
推测认证通过
修改规则或阈值
编造 IBIS/S 参数
直接修改 PCB
把启发式分数说成测量结果
```

---

# 41. Release Gate

## DRC Ready

```text
Rule Syntax Pass
Zone Refill
Connectivity Pass
Critical DRC Error = 0
Unexplained Exclusion = 0
```

## SI Review Ready

```text
关键接口识别
Stack-up 完整
Return-path Geometry 完成
Critical Diff/Clock/Memory Finding 关闭或批准
```

## PI Review Ready

```text
Power Graph 完整
关键 Rail Current Profile 明确
Bottleneck Finding 关闭
Decoupling Assignment 完成
```

## EMC Pre-compliance Ready

```text
接口保护完成
Common-mode 高风险 Finding 关闭
外部线缆和机壳 Profile 明确
实验计划和测试点完成
```

## NPI Freeze

```text
DRC Error = 0
Critical/High Finding = 0 或批准 Waiver
模型和 Fidelity 已声明
关键仿真/测量回归完成
Review Manifest 冻结
```

---

# 42. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RUNNING_NATIVE_DRC
→ NORMALIZING_DRC
→ BUILDING_GEOMETRY_GRAPHS
→ REVIEWING_RETURN_PATH
→ REVIEWING_SIGNAL_INTEGRITY
→ REVIEWING_POWER_INTEGRITY
→ REVIEWING_EMC
→ CORRELATING_FINDINGS
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_FINDINGS
COMPLETED_GEOMETRY_ONLY
REVIEW_REQUIRED
INPUT_BLOCKED
MODEL_REQUIRED
SIMULATION_REQUIRED
MEASUREMENT_REQUIRED
DRC_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 43. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_PCB_IR_NOT_FOUND
AGENT18_RELEASE_TOO_LOW
AGENT20_PADSTACK_BLOCKED
AGENT24_STACKUP_MISSING
AGENT24_CONSTRAINT_IR_MISSING
AGENT25_PLACEMENT_IR_MISSING
AGENT26_ROUTING_IR_MISSING
BOARD_PARSE_FAILED
RULE_FILE_PARSE_FAILED
RULE_SYNTAX_INVALID
DRC_EXECUTION_FAILED
DRC_REPORT_PARSE_FAILED
ZONE_REFILL_FAILED
SCHEMATIC_PARITY_FAILED
CONNECTIVITY_FAILED
SHORT_DETECTED
OPEN_DETECTED
UNEXPLAINED_EXCLUSION
REFERENCE_PLANE_UNKNOWN
PLANE_SPLIT_GEOMETRY_UNRESOLVED
RETURN_PATH_UNRESOLVED
STACKUP_PARAMETERS_INCOMPLETE
IMPEDANCE_PROFILE_UNRESOLVED
DIFF_PAIR_MAPPING_AMBIGUOUS
IBIS_MODEL_MISSING
IBIS_PIN_MAPPING_AMBIGUOUS
TOUCHSTONE_MODEL_MISSING
TOUCHSTONE_PORT_MAPPING_AMBIGUOUS
CROSSTALK_MODEL_INCOMPLETE
POWER_LOAD_PROFILE_MISSING
POWER_GRAPH_INCOMPLETE
DECOUPLING_MODEL_INCOMPLETE
PDN_ANALYSIS_UNAVAILABLE
ENCLOSURE_PROFILE_MISSING
CABLE_PROFILE_MISSING
EMC_CONTEXT_INCOMPLETE
EXTERNAL_SOLVER_UNAVAILABLE
EXTERNAL_SOLVER_TIMEOUT
MEASUREMENT_REVISION_MISMATCH
FINDING_IR_INVALID
AGENT19_EXECUTION_FAILED
POST_WRITE_DRC_REGRESSION
POST_WRITE_SI_REGRESSION
POST_WRITE_PI_REGRESSION
POST_WRITE_EMC_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR


---

# 44. 数据库设计

## 44.1 `pcb_review_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_pcb_ir_id UUID NOT NULL
agent18_release_id UUID NOT NULL
agent20_scan_id UUID NOT NULL
agent21_ir_id UUID NULL
agent22_review_id UUID NULL
agent23_result_id UUID NULL
agent24_constraint_ir_id UUID NOT NULL
agent25_placement_ir_id UUID NOT NULL
agent26_routing_ir_id UUID NOT NULL
analysis_profile VARCHAR NOT NULL
analysis_policy_version VARCHAR NOT NULL
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

## 44.2 `pcb_review_input_snapshots`

```text
id UUID PK
review_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_pcb_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent21_ir_hash CHAR(64) NULL
agent22_review_hash CHAR(64) NULL
agent23_result_hash CHAR(64) NULL
agent24_constraint_hash CHAR(64) NOT NULL
agent25_placement_hash CHAR(64) NOT NULL
agent26_routing_hash CHAR(64) NOT NULL
board_file_hash CHAR(64) NOT NULL
rule_file_hash CHAR(64) NULL
model_snapshot_hash CHAR(64) NOT NULL
measurement_snapshot_hash CHAR(64) NULL
analysis_policy_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, snapshot_hash)
```

## 44.3 `pcb_analysis_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
required_domains JSONB NOT NULL
required_analysis_levels JSONB NOT NULL
required_fidelity JSONB NOT NULL
severity_policy JSONB NOT NULL
release_gate_policy JSONB NOT NULL
solver_policy JSONB NOT NULL
measurement_policy JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 44.4 `pcb_analysis_capability_snapshots`

```text
id UUID PK
review_job_id UUID NOT NULL
native_drc_capabilities JSONB NOT NULL
geometry_capabilities JSONB NOT NULL
si_capabilities JSONB NOT NULL
pi_capabilities JSONB NOT NULL
emc_capabilities JSONB NOT NULL
solver_capabilities JSONB NOT NULL
model_coverage JSONB NOT NULL
measurement_coverage JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, snapshot_hash)
```

## 44.5 `pcb_native_drc_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
eda_type VARCHAR NOT NULL
eda_version VARCHAR NOT NULL
cli_version VARCHAR NOT NULL
board_hash CHAR(64) NOT NULL
rule_hash CHAR(64) NULL
options JSONB NOT NULL
zone_refill_requested BOOLEAN NOT NULL
schematic_parity_requested BOOLEAN NOT NULL
status VARCHAR NOT NULL
exit_code INT NULL
report_uri TEXT NULL
report_hash CHAR(64) NULL
stdout_uri TEXT NULL
stderr_uri TEXT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 44.6 `pcb_native_drc_findings`

```text
id UUID PK
drc_run_id UUID NOT NULL
native_finding_key VARCHAR NOT NULL
native_rule_id VARCHAR NULL
finding_type VARCHAR NOT NULL
native_severity VARCHAR NOT NULL
normalized_severity VARCHAR NOT NULL
object_references JSONB NOT NULL
location JSONB NULL
actual_value JSONB NULL
required_value JSONB NULL
excluded BOOLEAN NOT NULL
exclusion_reason TEXT NULL
ignored BOOLEAN NOT NULL
raw_payload JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(drc_run_id, native_finding_key)
```

## 44.7 `pcb_effective_rule_traces`

```text
id UUID PK
review_job_id UUID NOT NULL
target_reference JSONB NOT NULL
constraint_type VARCHAR NOT NULL
global_rule JSONB NULL
net_class_rules JSONB NOT NULL
component_class_rules JSONB NOT NULL
area_rules JSONB NOT NULL
custom_rules JSONB NOT NULL
selected_rule JSONB NULL
shadowed_rules JSONB NOT NULL
text_variable_values JSONB NOT NULL
trace_uri TEXT NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.8 `pcb_connectivity_verification_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
verifier_name VARCHAR NOT NULL
verifier_version VARCHAR NOT NULL
connectivity_status VARCHAR NOT NULL
short_count INT NOT NULL
open_count INT NOT NULL
dangling_count INT NOT NULL
unconnected_via_count INT NOT NULL
zone_issue_count INT NOT NULL
parity_status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 44.9 `pcb_reference_plane_regions`

```text
id UUID PK
review_job_id UUID NOT NULL
region_key VARCHAR NOT NULL
reference_net_id UUID NULL
layer_name VARCHAR NOT NULL
geometry JSONB NOT NULL
region_type VARCHAR NOT NULL
source_type VARCHAR NOT NULL
geometry_hash CHAR(64) NOT NULL
continuity_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, region_key)
```

## 44.10 `pcb_return_path_graph_versions`

```text
id UUID PK
review_job_id UUID NOT NULL
graph_version VARCHAR NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
signal_path_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, graph_version)
```

## 44.11 `pcb_return_path_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
signal_scope JSONB NOT NULL
finding_type VARCHAR NOT NULL
reference_layer VARCHAR NULL
reference_net_id UUID NULL
crossing_geometry JSONB NULL
detour_metrics JSONB NULL
nearest_return_path JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.12 `pcb_loop_area_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
loop_key VARCHAR NOT NULL
loop_type VARCHAR NOT NULL
member_objects JSONB NOT NULL
signal_path JSONB NOT NULL
return_path JSONB NULL
geometric_proxy JSONB NULL
current_profile JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, loop_key)
```

## 44.13 `pcb_impedance_profiles`

```text
id UUID PK
review_job_id UUID NOT NULL
route_scope JSONB NOT NULL
profile_version VARCHAR NOT NULL
segments JSONB NOT NULL
stackup_profile_id UUID NULL
solver_name VARCHAR NULL
solver_version VARCHAR NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
profile_uri TEXT NOT NULL
profile_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.14 `pcb_impedance_discontinuities`

```text
id UUID PK
review_job_id UUID NOT NULL
impedance_profile_id UUID NOT NULL
discontinuity_type VARCHAR NOT NULL
location JSONB NOT NULL
before_geometry JSONB NOT NULL
after_geometry JSONB NOT NULL
estimated_metrics JSONB NULL
frequency_context JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 44.15 `pcb_coupling_windows`

```text
id UUID PK
review_job_id UUID NOT NULL
aggressor_net_id UUID NOT NULL
victim_net_id UUID NOT NULL
coupling_type VARCHAR NOT NULL
layer_relationship JSONB NOT NULL
geometry JSONB NOT NULL
parallel_length JSONB NOT NULL
minimum_spacing JSONB NOT NULL
height_to_reference JSONB NULL
direction_relationship VARCHAR NOT NULL
edge_context JSONB NOT NULL
termination_context JSONB NULL
risk_metrics JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.16 `pcb_signal_integrity_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_type VARCHAR NOT NULL
net_scope JSONB NOT NULL
interface_scope JSONB NULL
route_scope JSONB NOT NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
measurements JSONB NOT NULL
evidence_ids JSONB NOT NULL
simulation_request_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.17 `pcb_power_graph_versions`

```text
id UUID PK
review_job_id UUID NOT NULL
graph_type VARCHAR NOT NULL
graph_version VARCHAR NOT NULL
rail_count INT NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, graph_type, graph_version)
```

## 44.18 `pcb_power_path_segments`

```text
id UUID PK
power_graph_version_id UUID NOT NULL
rail_id UUID NOT NULL
segment_key VARCHAR NOT NULL
segment_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
geometry JSONB NULL
resistance JSONB NULL
inductance JSONB NULL
current_profile JSONB NULL
voltage_drop JSONB NULL
power_loss JSONB NULL
temperature_assumption JSONB NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(power_graph_version_id, segment_key)
```

## 44.19 `pcb_power_bottleneck_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
rail_id UUID NOT NULL
bottleneck_type VARCHAR NOT NULL
object_reference JSONB NOT NULL
current_context JSONB NOT NULL
capacity_context JSONB NOT NULL
voltage_drop_context JSONB NULL
thermal_context JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.20 `pcb_decoupling_models`

```text
id UUID PK
review_job_id UUID NOT NULL
capacitor_part_id UUID NOT NULL
rail_id UUID NOT NULL
consumer_pin_ids JSONB NOT NULL
capacitance JSONB NOT NULL
esr_model JSONB NULL
esl_model JSONB NULL
mounting_inductance JSONB NULL
via_configuration JSONB NOT NULL
plane_access JSONB NOT NULL
model_source JSONB NOT NULL
model_hash CHAR(64) NULL
model_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.21 `pcb_pdn_analysis_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
rail_id UUID NOT NULL
analysis_type VARCHAR NOT NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
target_impedance JSONB NULL
frequency_range JSONB NOT NULL
solver_name VARCHAR NULL
solver_version VARCHAR NULL
model_manifest_uri TEXT NOT NULL
model_manifest_hash CHAR(64) NOT NULL
result_uri TEXT NULL
result_hash CHAR(64) NULL
status VARCHAR NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 44.22 `pcb_pdn_findings`

```text
id UUID PK
pdn_analysis_run_id UUID NOT NULL
finding_type VARCHAR NOT NULL
frequency_scope JSONB NULL
affected_objects JSONB NOT NULL
measured_or_estimated JSONB NOT NULL
target JSONB NULL
margin JSONB NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.23 `pcb_emc_aggressors`

```text
id UUID PK
review_job_id UUID NOT NULL
aggressor_key VARCHAR NOT NULL
aggressor_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
frequency_context JSONB NOT NULL
edge_context JSONB NULL
current_context JSONB NULL
loop_context JSONB NULL
location JSONB NOT NULL
external_coupling_paths JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, aggressor_key)
```

## 44.24 `pcb_emc_victims`

```text
id UUID PK
review_job_id UUID NOT NULL
victim_key VARCHAR NOT NULL
victim_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
sensitivity_context JSONB NOT NULL
location JSONB NOT NULL
external_exposure JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, victim_key)
```

## 44.25 `pcb_common_mode_risk_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
source_scope JSONB NOT NULL
conversion_mechanisms JSONB NOT NULL
cable_or_chassis_scope JSONB NULL
geometry_context JSONB NOT NULL
model_context JSONB NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.26 `pcb_interface_protection_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
interface_id UUID NOT NULL
connector_reference JSONB NOT NULL
protection_chain JSONB NOT NULL
expected_order JSONB NOT NULL
actual_order JSONB NOT NULL
return_path JSONB NOT NULL
symmetry_status VARCHAR NULL
rating_status VARCHAR NOT NULL
placement_status VARCHAR NOT NULL
unprotected_branches JSONB NOT NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.27 `pcb_emc_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_type VARCHAR NOT NULL
aggressor_ids JSONB NOT NULL
victim_ids JSONB NOT NULL
affected_objects JSONB NOT NULL
coupling_path JSONB NOT NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
test_recommendations JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.28 `pcb_analysis_models`

```text
id UUID PK
tenant_id UUID NULL
model_type VARCHAR NOT NULL
manufacturer VARCHAR NULL
model_name VARCHAR NOT NULL
model_version VARCHAR NOT NULL
source_reference JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
license_status VARCHAR NOT NULL
supported_conditions JSONB NOT NULL
pin_or_port_mapping_schema JSONB NOT NULL
validation_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(model_type, model_name, model_version, artifact_hash)
```

## 44.29 `pcb_model_bindings`

```text
id UUID PK
review_job_id UUID NOT NULL
model_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_reference JSONB NOT NULL
pin_or_port_mapping JSONB NOT NULL
operating_conditions JSONB NOT NULL
binding_method VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.30 `pcb_simulation_requests`

```text
id UUID PK
review_job_id UUID NOT NULL
target_agent VARCHAR NOT NULL
simulation_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
objective JSONB NOT NULL
input_models JSONB NOT NULL
operating_conditions JSONB NOT NULL
measurements JSONB NOT NULL
acceptance_criteria JSONB NOT NULL
requested_fidelity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.31 `pcb_measurement_packages`

```text
id UUID PK
review_job_id UUID NOT NULL
measurement_type VARCHAR NOT NULL
board_revision VARCHAR NOT NULL
instrument_manifest JSONB NOT NULL
calibration_manifest JSONB NOT NULL
probe_points JSONB NOT NULL
setup JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
correlation_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.32 `pcb_unified_review_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
domain VARCHAR NOT NULL
finding_type VARCHAR NOT NULL
analysis_level VARCHAR NOT NULL
fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
affected_objects JSONB NOT NULL
evidence_ids JSONB NOT NULL
measurements JSONB NOT NULL
causal_chain JSONB NOT NULL
repair_candidate_ids JSONB NOT NULL
source_finding_refs JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.33 `pcb_review_repair_candidates`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_id UUID NOT NULL
repair_type VARCHAR NOT NULL
target_agent VARCHAR NOT NULL
scope_reference JSONB NOT NULL
proposed_change JSONB NOT NULL
expected_effect JSONB NOT NULL
side_effects JSONB NOT NULL
risk_level VARCHAR NOT NULL
verification_plan JSONB NOT NULL
approval_policy VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 44.34 `pcb_review_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
review_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
plan_version INT NOT NULL
selected_repair_ids JSONB NOT NULL
risk_summary JSONB NOT NULL
execution_order JSONB NOT NULL
regression_plan JSONB NOT NULL
agent19_change_plan_uri TEXT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, plan_version)
```

## 44.35 `pcb_review_post_write_runs`

```text
id UUID PK
change_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
pre_review_job_id UUID NOT NULL
post_review_job_id UUID NULL
drc_regression JSONB NOT NULL
si_regression JSONB NOT NULL
pi_regression JSONB NOT NULL
emc_regression JSONB NOT NULL
new_findings JSONB NOT NULL
resolved_findings JSONB NOT NULL
worsened_findings JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 44.36 `pcb_review_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
review_job_id UUID NULL
finding_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
risk_acceptance TEXT NOT NULL
evidence_ids JSONB NOT NULL
mitigations JSONB NOT NULL
effective_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 44.37 `pcb_review_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
review_manifest_hash CHAR(64) NOT NULL
finding_set_hash CHAR(64) NOT NULL
model_snapshot_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision)
```

## 44.38 `pcb_review_release_gate_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
drc_error_count INT NOT NULL
critical_finding_count INT NOT NULL
high_finding_count INT NOT NULL
unexplained_exclusion_count INT NOT NULL
missing_model_count INT NOT NULL
required_simulation_pending_count INT NOT NULL
required_measurement_pending_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 44.39 `pcb_review_reports`

```text
id UUID PK
review_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
analysis_level_summary JSONB NOT NULL
fidelity_summary JSONB NOT NULL
domain_summary JSONB NOT NULL
finding_counts JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, report_version)
```

---

# 45. 对象存储

```text
derived/pcb-review/
  {tenant_id}/{project_id}/
    jobs/
      {review_job_id}/
        input/
          input-snapshot.json
          board-manifest.json
          rule-manifest.json
          stackup.json
          model-manifest.json
          operating-modes.json
          analysis-policy.json
        drc/
          native-report.json
          native-report.txt
          normalized-findings.jsonl.zst
          effective-rule-traces/
          exclusions.json
        connectivity/
          connectivity-report.json
          shorts.jsonl.zst
          opens.jsonl.zst
        geometry/
          reference-regions.jsonl.zst
          return-path-graph.json
          loop-proxies.jsonl.zst
          plane-splits.jsonl.zst
        si/
          impedance-profiles/
          discontinuities.jsonl.zst
          coupling-windows.parquet
          differential-findings.jsonl.zst
          topology-findings.jsonl.zst
          simulation-packages/
        pi/
          dc-power-graphs/
          bottlenecks.jsonl.zst
          decoupling-models.jsonl.zst
          pdn-runs/
          pdn-findings.jsonl.zst
        emc/
          aggressors.jsonl.zst
          victims.jsonl.zst
          common-mode.jsonl.zst
          interface-protection.jsonl.zst
          risk-map/
          test-plans/
        models/
          registry-snapshot.json
          bindings.jsonl.zst
          validation/
        findings/
          unified-findings.jsonl.zst
          causal-chains.jsonl.zst
          repair-candidates.jsonl.zst
          evidence/
        measurements/
          packages/
          correlation/
        changes/
          agent19-plan.json
          preview/
          execution/
        regression/
          drc/
          si/
          pi/
          emc/
        reports/
          pcb-review-report.html
          pcb-review-report.pdf
          finding-matrix.csv
          drc-findings.csv
          si-findings.csv
          pi-findings.csv
          emc-findings.csv
          model-coverage.csv
          release-gate.json
        debug/
          rule-trace.jsonl.zst
          geometry-trace.jsonl.zst
          solver-trace.jsonl.zst
          correlation-trace.jsonl.zst
          resource-usage.json
```

---

# 46. API 设计

## 46.1 Jobs

```text
POST /api/v1/pcb-review/jobs
POST /api/v1/pcb-review/jobs/batch
GET  /api/v1/pcb-review/jobs/{id}
GET  /api/v1/pcb-review/jobs/{id}/events
POST /api/v1/pcb-review/jobs/{id}/cancel
POST /api/v1/pcb-review/jobs/{id}/retry
POST /api/v1/pcb-review/jobs/{id}/rerun
```

## 46.2 Readiness and Capabilities

```text
POST /api/v1/pcb-review/jobs/{id}/validate-readiness
GET  /api/v1/pcb-review/jobs/{id}/readiness
GET  /api/v1/pcb-review/jobs/{id}/capabilities
GET  /api/v1/pcb-review/jobs/{id}/model-coverage
```

## 46.3 Native DRC

```text
POST /api/v1/pcb-review/jobs/{id}/run-drc
GET  /api/v1/pcb-review/jobs/{id}/drc-runs
GET  /api/v1/pcb-review/drc-runs/{id}
GET  /api/v1/pcb-review/drc-runs/{id}/findings
GET  /api/v1/pcb-review/jobs/{id}/rule-traces
POST /api/v1/pcb-review/jobs/{id}/verify-connectivity
```

## 46.4 Geometry and Return Path

```text
POST /api/v1/pcb-review/jobs/{id}/build-return-path-graph
GET  /api/v1/pcb-review/jobs/{id}/return-path
GET  /api/v1/pcb-review/jobs/{id}/plane-splits
GET  /api/v1/pcb-review/jobs/{id}/loop-findings
POST /api/v1/pcb-review/jobs/{id}/review-return-path
```

## 46.5 Signal Integrity

```text
POST /api/v1/pcb-review/jobs/{id}/build-impedance-profiles
GET  /api/v1/pcb-review/jobs/{id}/impedance-profiles
GET  /api/v1/pcb-review/jobs/{id}/discontinuities
POST /api/v1/pcb-review/jobs/{id}/analyze-crosstalk
GET  /api/v1/pcb-review/jobs/{id}/coupling-windows
POST /api/v1/pcb-review/jobs/{id}/review-differential-pairs
POST /api/v1/pcb-review/jobs/{id}/review-topology
GET  /api/v1/pcb-review/jobs/{id}/si-findings
```

## 46.6 Power Integrity

```text
POST /api/v1/pcb-review/jobs/{id}/build-power-graph
GET  /api/v1/pcb-review/jobs/{id}/power-graphs
POST /api/v1/pcb-review/jobs/{id}/analyze-dc-power
GET  /api/v1/pcb-review/jobs/{id}/power-bottlenecks
POST /api/v1/pcb-review/jobs/{id}/build-pdn
POST /api/v1/pcb-review/jobs/{id}/run-pdn-analysis
GET  /api/v1/pcb-review/jobs/{id}/pdn-runs
GET  /api/v1/pcb-review/jobs/{id}/pi-findings
```

## 46.7 EMC and Protection

```text
POST /api/v1/pcb-review/jobs/{id}/build-emc-map
GET  /api/v1/pcb-review/jobs/{id}/aggressors
GET  /api/v1/pcb-review/jobs/{id}/victims
POST /api/v1/pcb-review/jobs/{id}/analyze-common-mode
POST /api/v1/pcb-review/jobs/{id}/review-interface-protection
GET  /api/v1/pcb-review/jobs/{id}/emc-findings
GET  /api/v1/pcb-review/jobs/{id}/emc-risk-map
POST /api/v1/pcb-review/jobs/{id}/generate-lab-test-plan
```

## 46.8 Models and Simulation

```text
POST /api/v1/pcb-review/models
GET  /api/v1/pcb-review/models
GET  /api/v1/pcb-review/models/{id}
POST /api/v1/pcb-review/models/{id}/validate
POST /api/v1/pcb-review/jobs/{id}/bind-model
GET  /api/v1/pcb-review/jobs/{id}/model-bindings
POST /api/v1/pcb-review/jobs/{id}/simulation-request
GET  /api/v1/pcb-review/jobs/{id}/simulation-requests
```

## 46.9 Findings and Review

```text
GET  /api/v1/pcb-review/jobs/{id}/findings
GET  /api/v1/pcb-review/findings/{id}
POST /api/v1/pcb-review/findings/{id}/accept
POST /api/v1/pcb-review/findings/{id}/reject
POST /api/v1/pcb-review/findings/{id}/waive
POST /api/v1/pcb-review/findings/{id}/request-model
POST /api/v1/pcb-review/findings/{id}/request-simulation
POST /api/v1/pcb-review/findings/{id}/request-measurement
GET  /api/v1/pcb-review/findings/{id}/evidence
```

## 46.10 Repair and Agent 19

```text
POST /api/v1/pcb-review/findings/{id}/repair-candidates
GET  /api/v1/pcb-review/jobs/{id}/repair-candidates
POST /api/v1/pcb-review/jobs/{id}/change-plan
GET  /api/v1/pcb-review/change-plans/{id}
POST /api/v1/pcb-review/change-plans/{id}/preview
POST /api/v1/pcb-review/change-plans/{id}/approve
POST /api/v1/pcb-review/change-plans/{id}/submit-to-agent19
GET  /api/v1/pcb-review/post-write-runs/{id}
```

## 46.11 Baseline and Reports

```text
POST /api/v1/pcb-review/jobs/{id}/baseline
POST /api/v1/pcb-review/jobs/{id}/compare-baseline
POST /api/v1/pcb-review/jobs/{id}/run-release-gate
GET  /api/v1/pcb-review/jobs/{id}/release-gate
GET  /api/v1/pcb-review/jobs/{id}/report
GET  /api/v1/pcb-review/jobs/{id}/finding-matrix.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 47. 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.configuration.ready
schematic-review.completed
simulation.completed
pcb-constraints.constraint-ir-ready
pcb-placement.completed
pcb-routing.completed
kicad.project-revision.ready
pcb-review.requested
measurement.package.ready
```

---

# 48. 输出事件

```text
pcb-review.input-blocked
pcb-review.drc-completed
pcb-review.drc-blocked
pcb-review.return-path-review-required
pcb-review.model-required
pcb-review.simulation-required
pcb-review.measurement-required
pcb-review.finding-created
pcb-review.critical-finding
pcb-review.repair-candidate-ready
pcb-review.feedback-to-constraints
pcb-review.feedback-to-placement
pcb-review.feedback-to-routing
pcb-review.change-plan-ready
pcb-review.post-write-validated
pcb-review.release-gate-blocked
pcb-review.completed
pcb-review.completed-with-findings
pcb-review.failed
```

---

# 49. Policy 组织

```text
policies/
├── pcb-review-1.0.0.yaml
├── input-gates.yaml
├── fidelity.yaml
├── drc/
│   ├── severities.yaml
│   ├── exclusions.yaml
│   ├── parity.yaml
│   └── rule-coverage.yaml
├── geometry/
│   ├── reference-planes.yaml
│   ├── plane-splits.yaml
│   ├── loop-area.yaml
│   └── board-edge.yaml
├── si/
│   ├── differential.yaml
│   ├── impedance.yaml
│   ├── discontinuities.yaml
│   ├── coupling.yaml
│   ├── topology.yaml
│   ├── stubs.yaml
│   └── termination.yaml
├── pi/
│   ├── dc-power.yaml
│   ├── current-bottlenecks.yaml
│   ├── decoupling.yaml
│   ├── target-impedance.yaml
│   ├── resonance.yaml
│   └── plane-pairs.yaml
├── emc/
│   ├── aggressors.yaml
│   ├── victims.yaml
│   ├── common-mode.yaml
│   ├── interface-protection.yaml
│   ├── chassis-shield.yaml
│   ├── board-edge.yaml
│   └── test-plan.yaml
├── models/
│   ├── ibis.yaml
│   ├── touchstone.yaml
│   ├── spice.yaml
│   └── admission.yaml
├── findings/
│   ├── severity.yaml
│   ├── confidence.yaml
│   ├── correlation.yaml
│   └── repair-routing.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 50. Analysis Provider 接口

```python
class PCBAnalysisProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_input(self, request) -> ValidationResult: ...
    async def analyze(self, request) -> AnalysisResult: ...
    async def explain(self, result) -> AnalysisTrace: ...
```

类型：

```text
native_drc
geometry
impedance
crosstalk
channel
dc_power
pdn
emc_risk
field_solver
measurement_correlation
```

---

# 51. Provider Admission

保存：

```text
provider name/version
analysis types
supported geometry/models
units
determinism
validation fixtures
license
resource limits
approval status
```

`unknown` 不视为支持。

---

# 52. Model Registry 纪律

每个模型必须：

```text
source
version
hash
license
target
pin/port mapping
operating conditions
corner
validation
approval
```

禁止：

```text
仅按文件名自动绑定
仅按 Pin 数量绑定
未知端口顺序
未经许可重新分发
```

---

# 53. 单位与数值

支持：

```text
length
area
frequency
time
voltage
current
power
resistance
inductance
capacitance
impedance
permittivity
loss tangent
temperature
```

要求：

- Decimal；
- 显式单位；
- 范围和公差；
- 频率和温度条件；
- 不静默转换；
- 保存计算公式或 Provider Trace。

---

# 54. Finding Correlation

合并条件：

```text
same physical region
same net/interface/rail
same causal mechanism
compatible analysis level
compatible revision
```

例如：

```text
DRC via-count warning
+ SI reference change
+ EMC common-mode risk
→ one correlated layer-transition finding
```

不能简单按文本相似度合并。

---

# 55. Causal Chain

示例：

```text
USB pair asymmetric via
→ local skew and reference discontinuity
→ differential-to-common-mode conversion candidate
→ cable common-mode current risk
→ radiated emission candidate
```

每一步必须有 Evidence 和 Confidence。

---

# 56. Review Workbench

界面建议：

```text
左：Domain / Severity / Interface / Rail / Block
中：PCB Layer Viewer、Route、Plane、Field/Risk Overlay
右：Evidence、Fidelity、Model、Finding、Repair
下：DRC、SI、PI、EMC、Diff、Regression、Waiver
```

---

# 57. Review 操作

```text
确认或拒绝 Finding
查看 Rule Resolution
切换 Layer/Reference Plane
查看 Return-path
查看 Coupling Window
绑定模型
请求仿真
请求测量
选择修复
创建 Waiver
比较 Baseline
批准 Change Plan
```

---

# 58. 可观测性

```text
pcb_review_jobs_total{status,profile}
pcb_review_duration_seconds{step}
pcb_review_drc_findings_total{type,severity}
pcb_review_findings_total{domain,type,severity,fidelity}
pcb_review_return_path_failures_total{type}
pcb_review_impedance_discontinuities_total{type}
pcb_review_coupling_windows_total{risk}
pcb_review_power_bottlenecks_total{type}
pcb_review_pdn_runs_total{status,fidelity}
pcb_review_emc_findings_total{type,severity}
pcb_review_model_coverage_ratio{type}
pcb_review_simulation_requests_total{type,status}
pcb_review_post_write_runs_total{status}
pcb_review_release_gate_blocks_total{reason}
```

---

# 59. Dashboard

```text
Projects
Input Readiness
Native DRC
Rule Coverage
Connectivity
Return Path
Signal Integrity
Power Integrity
EMC
Interface Protection
Model Coverage
Simulation Requests
Measurements
Findings
Repairs
Regression
Release Readiness
```

---

# 60. 安全与权限

- PCB、模型、测量、外壳、线缆和报告按租户/项目隔离；
- IBIS、Touchstone、SPICE 和商业 Solver 文件按 License 控制；
- 外部 Solver 在隔离 Worker 中运行，默认无公网；
- 限制 CPU、内存、磁盘、线程、时间和文件数；
- 不执行模型文件内脚本；
- 不允许自由 Shell；
- 命令由类型化 Builder 生成；
- 不把客户数据发送给外部模型或公共 Solver；
- AI 只能接收最小化、结构化和脱敏上下文；
- Agent 19 写入权限与审查权限分开；
- 降低规则、接受 Critical Waiver 和关闭 High Finding 支持双人审批；
- Exclusion、Waiver、Baseline、Model Snapshot 和 Review Manifest 不可硬删除；
- 日志脱敏网络名、路径、模型许可和实验室数据；
- 公开 Fixture 仅使用开源、合成、脱敏或授权工程。

---

# 61. 推荐技术栈

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

几何和图：

```text
Shapely or equivalent robust geometry
custom spatial index
NetworkX only for fixtures/small graphs
custom graph for production
NumPy
SciPy
```

数据：

```text
Polars
PyArrow
DuckDB
```

模型和仿真：

```text
KiCad CLI DRC Adapter
Agent 23 SPICE Adapter
IBIS parser/checker adapter
Touchstone parser
optional transmission-line/channel provider
optional PDN solver
optional 2D/2.5D field solver
measurement import adapters
```

前端：

```text
React
TypeScript
Canvas/WebGL
Layer/Plane Viewer
Risk Heatmap
Waveform/Impedance Plot
Finding Diff
```

---

# 62. 推荐仓库结构

```text
pcb-review-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── pcb-review-agent-spec.md
│   ├── input-model-fidelity-gates.md
│   ├── native-drc-adapter.md
│   ├── rule-resolution-and-exclusions.md
│   ├── return-path-and-plane-analysis.md
│   ├── signal-integrity-review.md
│   ├── impedance-and-discontinuity.md
│   ├── crosstalk-analysis.md
│   ├── power-integrity-review.md
│   ├── pdn-and-decoupling.md
│   ├── emc-risk-review.md
│   ├── interface-protection.md
│   ├── model-registry.md
│   ├── simulation-and-measurement.md
│   ├── unified-finding-ir.md
│   ├── repair-and-feedback.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-drc-pass-is-not-si-pi-emc-pass.md
│       ├── 0002-analysis-level-and-fidelity-are-explicit.md
│       ├── 0003-return-path-is-a-graph.md
│       ├── 0004-heuristics-do-not-claim-certification.md
│       ├── 0005-model-bindings-are-explicit.md
│       ├── 0006-findings-are-evidence-grounded.md
│       └── 0007-writes-run-through-agent19.md
├── src/
│   └── pcb_review/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   ├── agent22.py
│       │   ├── agent23.py
│       │   ├── agent24.py
│       │   ├── agent25.py
│       │   └── agent26.py
│       ├── drc/
│       │   ├── kicad_cli.py
│       │   ├── parser.py
│       │   ├── normalization.py
│       │   ├── exclusions.py
│       │   ├── rule_trace.py
│       │   └── connectivity.py
│       ├── geometry/
│       │   ├── layers.py
│       │   ├── planes.py
│       │   ├── traces.py
│       │   ├── vias.py
│       │   ├── zones.py
│       │   ├── projection.py
│       │   └── spatial.py
│       ├── return_path/
│       │   ├── graph.py
│       │   ├── references.py
│       │   ├── splits.py
│       │   ├── transitions.py
│       │   ├── loops.py
│       │   └── stitching.py
│       ├── si/
│       │   ├── classification.py
│       │   ├── differential.py
│       │   ├── impedance.py
│       │   ├── discontinuities.py
│       │   ├── coupling.py
│       │   ├── topology.py
│       │   ├── stubs.py
│       │   └── termination.py
│       ├── pi/
│       │   ├── power_graph.py
│       │   ├── dc_drop.py
│       │   ├── bottlenecks.py
│       │   ├── decoupling.py
│       │   ├── pdn.py
│       │   ├── resonance.py
│       │   └── planes.py
│       ├── emc/
│       │   ├── aggressors.py
│       │   ├── victims.py
│       │   ├── common_mode.py
│       │   ├── interfaces.py
│       │   ├── chassis.py
│       │   ├── shielding.py
│       │   ├── board_edge.py
│       │   └── test_plan.py
│       ├── models/
│       │   ├── registry.py
│       │   ├── bindings.py
│       │   ├── ibis.py
│       │   ├── touchstone.py
│       │   ├── spice.py
│       │   ├── validation.py
│       │   └── licensing.py
│       ├── simulation/
│       │   ├── requests.py
│       │   ├── channel.py
│       │   ├── pdn.py
│       │   └── correlation.py
│       ├── findings/
│       │   ├── normalization.py
│       │   ├── severity.py
│       │   ├── confidence.py
│       │   ├── correlation.py
│       │   ├── causal_chain.py
│       │   └── evidence.py
│       ├── repairs/
│       │   ├── candidates.py
│       │   ├── constraints.py
│       │   ├── placement.py
│       │   ├── routing.py
│       │   ├── simulation.py
│       │   └── verification.py
│       ├── review/
│       ├── release/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── analysis-profiles/
├── model-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_review_readiness.py
    ├── run_native_drc.py
    ├── build_return_path_graph.py
    ├── review_signal_integrity.py
    ├── review_power_integrity.py
    ├── review_emc.py
    ├── build_unified_findings.py
    ├── generate_repair_candidates.py
    ├── submit_review_repairs_to_agent19.py
    └── run_pcb_review_benchmark.py
```

---

# 63. 技术资料基线

实施前应核验目标版本：

```text
KiCad PCB Editor / DRC / Custom Rules / Component Classes
KiCad CLI pcb drc
KiCad Board File Format
IBIS Open Forum specifications
Touchstone specifications
目标 Solver 的官方文档和许可证
适用产品标准、客户规范和实验室测试方法
```

不能把某个版本的规则、模型或命令能力硬编码为永久事实。


---

# 64. Codex 分阶段实施

不要让 Codex 一次实现原生 DRC、返回路径、串扰、IBIS、PDN、EMC 风险、模型注册表、测量关联、自动修复和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–26 的真实实现和数据契约；
2. 当前 PCB、Track、Via、Zone、Pad、Stack-up 和 Rule IR；
3. 当前 KiCad DRC、CLI、Rule Syntax、Exclusion、Parity 和 Zone Refill；
4. 当前 Rule Resolution、Zero-match、Shadow 和 Coverage；
5. 当前 Connectivity、Short、Open、Unconnected 和 Zone Island；
6. 当前 Reference Plane、Plane Split、Void、Return Via 和 Loop Analysis；
7. 当前 Differential Pair、Skew、Uncoupled、Topology、Stub 和 Termination；
8. 当前 Impedance、Transmission Line、TDR、IBIS、Touchstone 和 Channel；
9. 当前 Parallel Coupling、Crosstalk 和 Aggressor/Victim；
10. 当前 Power Tree、DC Drop、Current Density、Via/Neck Bottleneck；
11. 当前 Decoupling、PDN、Target Impedance 和 Resonance；
12. 当前 EMC Aggressor、Common-mode、Cable、Chassis、Shield 和 Interface Protection；
13. 当前 ESD/TVS/CMC/Filter 和 Connector Review；
14. 当前 Agent 23 Simulation Adapter；
15. 当前 External Solver、Container、License 和 Capability；
16. 当前 Measurement Import、TDR、VNA、Scope 和 EMI 数据；
17. 当前 Finding、Evidence、Repair、Waiver 和 Baseline；
18. 当前 Agent 19 Write、Readback 和 Rollback；
19. 当前 Review UI、Layer Viewer、Plane Overlay 和 Risk Map；
20. 当前 Queue、Worker、Database、Object Storage 和 Security；
21. 当前开源、合成、脱敏或授权 Fixture；
22. 统计 DRC、SI、PI、EMC 检查覆盖；
23. 统计 Model Coverage 和 Fidelity；
24. 统计 Exclusion、Critical/High Finding、False Positive 和 Regression；
25. 只运行只读扫描和版本探测；
26. 可以在公开/合成 Fixture 上运行仓库已有 DRC；
27. 不运行生产外部 Solver；
28. 不修改 PCB；
29. 不降低规则；
30. 不调用外部模型；
31. 不创建 Migration；
32. 不安装 Solver；
33. 不读取或打印 Secret、NDA 模型和实验室数据。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Review Job；
- Input Snapshot；
- Analysis Profile；
- Capability Snapshot；
- Native DRC；
- Rule Trace；
- Connectivity；
- Reference Plane；
- Return Path；
- Loop；
- Impedance；
- Discontinuity；
- Coupling；
- SI Finding；
- Power Graph；
- Bottleneck；
- Decoupling；
- PDN；
- EMC Aggressor/Victim；
- Common-mode；
- Interface Protection；
- Model；
- Binding；
- Simulation Request；
- Measurement；
- Unified Finding；
- Repair；
- Waiver；
- Baseline；
- Release Gate；
- JSON Schema。

## Phase 2：Agent 16–26 Input Gate

实现：

- Project Revision；
- Reviewed Netlist；
- Padstack；
- Simulation Context；
- Constraint IR；
- Placement IR；
- Routing IR；
- Board/Rule File；
- Stack-up；
- Model Snapshot；
- Blocked/Geometry-only/Model-driven；
- Diagnostics。

## Phase 3：Native KiCad DRC Adapter

实现：

- Version Discovery；
- Typed CLI Command；
- Zone Refill；
- Schematic Parity；
- Severity；
- Exclusions；
- Report Format；
- Exit Code；
- Timeout；
- Artifact Capture；
- Contract Tests。

## Phase 4：DRC Report Normalization

实现：

- Finding Parser；
- Object Mapping；
- Location；
- Actual/Required；
- Severity；
- Exclusion；
- Raw Payload；
- Stable Finding Key；
- Dedup；
- Golden Tests。

## Phase 5：Rule Resolution 和 Exclusion Governance

实现：

- Global/Net/Component/Area/Custom；
- Priority；
- Text Variable；
- Effective Rule；
- Shadowed；
- Zero-match；
- Exclusion Reason；
- Ignore；
- Waiver；
- Release Gate。

## Phase 6：Independent Connectivity Verification

实现：

- Short；
- Open；
- Dangling Track；
- Unconnected Via；
- Zone Connectivity；
- Thermal；
- Net Tie；
- Jumpered Pin；
- Schematic Parity；
- Router-independent Report。

## Phase 7：Geometry and Layer Kernel

实现：

- Stack-up；
- Plane/Signal Layer；
- Track Projection；
- Via Span；
- Zone Polygon；
- Void/Cutout；
- Spatial Index；
- Distance；
- Intersection；
- Geometry Hash；
- Property Tests。

## Phase 8：Reference Plane Determination

实现：

- Adjacent Layer；
- Local Plane；
- Power-as-reference Policy；
- Rule/Net Class；
- Trace Region；
- Ambiguity；
- Confidence；
- Per-segment Reference；
- Review Overlay。

## Phase 9：Return-path Graph

实现：

- Signal Segment；
- Plane Region；
- Via Transition；
- Return Via；
- Connector Return；
- Chassis/Shield；
- Possible Return；
- Blocked by Split；
- Graph Version；
- Trace。

## Phase 10：Plane Split、Void 和 Loop Review

实现：

- Geometric Crossing；
- Detour Proxy；
- Plane Neck；
- Island；
- Aperture；
- High di/dt Loop；
- Signal-return Loop；
- Switch/Decoupling/Crystal Loop；
- Fidelity；
- Findings。

## Phase 11：Differential Pair Review

实现：

- P/N；
- Width/Gap；
- Skew；
- Uncoupled；
- Via/Layer Symmetry；
- Reference；
- Pair-to-aggressor；
- Common-mode Candidate；
- Connector Mapping；
- Findings。

## Phase 12：Topology、Stub 和 Termination Review

实现：

- Point-to-point；
- Fly-by/Daisy/Star；
- Branch；
- Test Stub；
- Via Stub；
- Connector Stub；
- Source/Load；
- Series/Parallel Termination；
- Placement；
- Agent 24 Contract。

## Phase 13：Impedance Profile Builder

实现：

- Route Segmentation；
- Layer/Width/Gap；
- Stack-up；
- Mask；
- Via/Pad/Neck/Connector；
- Solver Provider；
- Analytical Candidate；
- Profile；
- Trace；
- No Fake Precision。

## Phase 14：Discontinuity 和 Reflection Risk

实现：

- Geometry Change；
- Reference Change；
- Via/Pad/Branch；
- Severity；
- Edge/Frequency Context；
- TDR Package；
- Repair；
- Review。

## Phase 15：Coupling Window Extractor

实现：

- Same-layer；
- Broadside；
- Parallel Length；
- Spacing；
- Height；
- Direction；
- Coupled Via；
- Aggressor/Victim；
- Spatial Scalability；
- Parquet Output。

## Phase 16：Crosstalk Analysis

实现：

- Geometry Ratio；
- Analytical Provider；
- Edge/Termination；
- Near/Far Candidate；
- Confidence；
- IBIS Request；
- Field Solver Request；
- Findings；
- No Millivolt Guess without Model。

## Phase 17：Model Registry and Validation

实现：

- IBIS；
- Touchstone；
- SPICE；
- Package；
- Source/Version/Hash/License；
- Pin/Port Mapping；
- Conditions；
- Parser/Checker；
- Approval；
- Security。

## Phase 18：IBIS/Channel Simulation Adapter

实现：

- Driver/Receiver；
- Package；
- Interconnect；
- Termination；
- Voltage/Temperature Corner；
- Stimulus；
- Eye/Waveform Measurements；
- Agent 23 Request；
- Result Ingestion；
- Fidelity。

## Phase 19：DC Power Graph

实现：

- Source/Rail/Load；
- Track/Via/Plane；
- Connector/Fuse/Switch；
- Resistance；
- Current Profile；
- Voltage Drop；
- Loss；
- Confidence；
- Graph Visualization。

## Phase 20：Current Bottleneck Review

实现：

- Neck；
- Via；
- Thermal Relief；
- Connector Pin；
- Fuse/Switch；
- Plane Neck；
- Zone Island；
- Capacity Profile；
- Severity；
- Repair Feedback。

## Phase 21：Decoupling Model

实现：

- Pin Assignment；
- Value/ESR/ESL；
- Package；
- Mounting Inductance；
- Via；
- Plane Access；
- Bulk/Local；
- Shared；
- Frequency Coverage；
- Model Status。

## Phase 22：PDN Network and Target Impedance

实现：

- VRM；
- Capacitors；
- Plane/Trace/Via；
- Package/Load；
- Target from Ripple/Step；
- Frequency Range；
- Network Serialization；
- Readiness；
- No Invented Target。

## Phase 23：PDN Analysis and Resonance

实现：

- Frequency Sweep；
- Impedance；
- Peak/Anti-resonance；
- Margin；
- Coverage Gap；
- Plane Resonance Candidate；
- Solver Version；
- Numerical Health；
- Findings。

## Phase 24：EMC Aggressor/Victim Map

实现：

- Clock/PWM/Switch/Motor/Memory/RF；
- Edge/Harmonic Candidate；
- Current/Loop；
- Victims；
- Proximity；
- External Coupling；
- Risk Overlay；
- Confidence。

## Phase 25：Common-mode and Cable Risk

实现：

- Pair Asymmetry；
- Return Discontinuity；
- Connector Imbalance；
- Cable/Shield；
- Chassis；
- Plane Split；
- Conversion Mechanism；
- Risk Finding；
- Test Plan。

## Phase 26：Interface Protection Review

实现：

- Connector；
- TVS/ESD；
- CMC/Filter；
- Series/Termination；
- Transceiver；
- Return/Chassis；
- Order；
- Distance；
- Unprotected Branch；
- Symmetry；
- Rating Contract with Agent 22。

## Phase 27：Chassis、Shield、Board-edge 和 EMI Risk

实现：

- Shield Termination；
- Seam/Slot；
- Stitching Gap；
- Board-edge Route；
- Plane Aperture；
- Antenna Coupling；
- Conducted/Radiated Candidate；
- Immunity Candidate；
- Findings；
- Lab Plan。

## Phase 28：Unified Finding IR

实现：

- Domain；
- Analysis Level；
- Fidelity；
- Severity；
- Confidence；
- Objects；
- Evidence；
- Measurements；
- Source Findings；
- Dedup；
- Stable Serialization。

## Phase 29：Finding Correlation and Causal Chains

实现：

- Revision-safe Correlation；
- Region/Net/Rail/Interface；
- Mechanism；
- Compatible Fidelity；
- Causal Edge；
- Confidence Propagation；
- No Text-only Merge；
- Trace。

## Phase 30：Repair Candidate and Feedback

实现：

- Agent 24 Constraint；
- Agent 25 Placement；
- Agent 26 Routing；
- Agent 23 Simulation；
- Agent 19 EDA Change；
- Model/Measurement Request；
- Expected Effect；
- Side Effect；
- Risk；
- Verification Plan。

## Phase 31：Measurement Import and Correlation

实现：

- TDR；
- VNA；
- Scope；
- Current Probe；
- Near-field；
- EMI；
- Instrument/Calibration；
- Board Revision；
- Probe Point Mapping；
- Correlation；
- Fidelity Upgrade；
- No Mismatched Revision。

## Phase 32：Agent 19 Integration

实现：

- Selected Repair → Change Plan；
- Workspace；
- Preview；
- Approval；
- Constraint/Placement/Routing Operations；
- No Direct Solver Write；
- Idempotency；
- Rollback；
- Audit。

## Phase 33：Post-write Regression

实现：

- Native DRC；
- Connectivity；
- Return Path；
- SI；
- PI；
- EMC；
- Model/Simulation Queue；
- New/Resolved/Worsened；
- Commit/Rollback Recommendation。

## Phase 34：Review Workbench

实现：

- DRC；
- Rule Trace；
- Plane/Return Overlay；
- SI/PI/EMC Tabs；
- Coupling；
- Impedance；
- PDN Plot；
- Risk Map；
- Models；
- Evidence；
- Repair；
- Waiver；
- Regression。

## Phase 35：Baseline、Waiver、CI 和 Release Gate

实现：

- Baseline；
- Finding Set Diff；
- Model Snapshot；
- Exclusion Governance；
- Waiver Scope/Expiry；
- CLI；
- Gate Profiles；
- Manifest；
- Exit Codes；
- Events。

## Phase 36：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Parquet；
- Pagination；
- Permissions；
- Audit；
- Metrics；
- Artifact Lifecycle。

## Phase 37：Benchmark、监控和生产发布

实现：

- Golden Boards；
- DRC Matrix；
- Return Path；
- SI；
- PI；
- EMC；
- Model；
- Measurement；
- False Positive/Negative；
- Security；
- Performance；
- Feature Flags；
- Provider Rollback；
- Disaster Recovery。

## Phase 38：高级能力，可选

稳定后：

- 2D/2.5D Field Solver；
- Full-wave Handoff；
- IBIS-AMI；
- Detailed Plane Cavity；
- Power-aware SI；
- Cable/Enclosure Co-simulation；
- Automated Near-field Correlation；
- 仍不自动宣称认证通过。

---

# 65. Codex 工作纪律

Codex 必须：

1. Native DRC、Geometry、Analytical、Simulation、Measurement 分层；
2. Input Snapshot 不可变；
3. Agent 18/20/24/25/26 Gate；
4. DRC Pass 不等于 SI/PI/EMC Pass；
5. Analysis Level 必填；
6. Fidelity 必填；
7. Model Coverage 必填；
8. Stack-up 条件必填；
9. Rule Syntax Error 阻断 DRC；
10. Zone Refill 状态明确；
11. Exclusion 有 Reason；
12. Ignore 有 Policy；
13. Zero-match Rule 报告；
14. Shadow Rule 报告；
15. Connectivity 独立于 DRC Adapter；
16. Short/Open 是 Hard Gate；
17. Reference Plane 按 Route Segment；
18. GND 铜存在不等于回流连续；
19. Plane Split Crossing 保存几何证据；
20. Loop Area 未知回流时只给 Proxy；
21. Diff Pair 按耦合对象；
22. Pair Asymmetry 与 Skew 分开；
23. Physical Length 与 Delay 分开；
24. Stub 与 Topology 分开；
25. Impedance Profile 记录 Solver；
26. 解析公式不冒充场求解；
27. Crosstalk 无模型不输出伪精确值；
28. Aggressor/Victim 有 Edge/Termination Context；
29. Model Source/Hash/License；
30. Pin/Port Mapping 显式；
31. 未批准模型不运行；
32. 未知端口顺序阻断；
33. DC Power Current 有来源；
34. Absolute Maximum 不当工作电流；
35. Via/Connector/Thermal Relief 纳入瓶颈；
36. Target Impedance 有纹波和负载依据；
37. 去耦不按数量判定；
38. ESR/ESL/Mounting/Plane 纳入；
39. PDN 数值健康检查；
40. Resonance Finding 有频带；
41. EMC 是风险评估，不是认证；
42. Clock Harmonic 是候选；
43. Common-mode Mechanism 有证据；
44. Cable/Enclosure 缺失时降级；
45. Interface Protection 检查 Return Path；
46. TVS 靠近不是唯一指标；
47. Agent 22负责额定值来源；
48. Finding Severity 与 Confidence 分开；
49. Finding 合并不能只按文本；
50. Causal Chain 每一步有 Evidence；
51. AI 不伪造数值、波形和场图；
52. AI 不修改规则；
53. AI 不关闭 Finding；
54. Repair 按 Agent 类型路由；
55. Agent 19执行前 Preview；
56. 修复后全域回归；
57. New/Worsened Finding 是 Gate；
58. Measurement 必须匹配 Revision；
59. 仪器和校准可追溯；
60. Release Pass 不等于认证通过；
61. 不发送私有设计给外部模型；
62. 不用客户模型和测试做公开 Fixture；
63. 不伪造 DRC、Solver、Measurement、Certification 和 Benchmark；
64. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Rule/Model/Provider 变化；
    - 测试命令和真实结果；
    - DRC/Connectivity；
    - Return Path；
    - SI；
    - PI；
    - EMC；
    - Model/Fidelity；
    - Repair/Regression；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 66. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input and DRC

1. Reviewed Project；
2. Low Release Block；
3. Missing Stack-up；
4. Rule Syntax Error；
5. Zone Refill；
6. Schematic Parity；
7. Clearance；
8. Creepage；
9. Short；
10. Open；
11. Dangling Track；
12. One-layer Via；
13. Zone Island；
14. Thermal Relief；
15. Board Edge；
16. Exclusion with Reason；
17. Exclusion without Reason；
18. Ignored Test；
19. Zero-match Rule；
20. Shadowed Rule。

## Return Path and SI

21. Continuous Plane；
22. Split Crossing；
23. Void Crossing；
24. Plane Neck；
25. Missing Return Via；
26. Stitching Via；
27. Layer Change；
28. Large Loop；
29. Hot Loop；
30. Crystal Loop；
31. Diff Pair Skew；
32. Diff Via Asymmetry；
33. Uncoupled Segment；
34. Reference Change；
35. Width Step；
36. Pad Discontinuity；
37. Connector Discontinuity；
38. Via Stub；
39. Test Stub；
40. Termination Placement；
41. Same-layer Coupling；
42. Broadside Coupling；
43. Aggressor Missing Edge；
44. IBIS Exact；
45. IBIS Mapping Ambiguous；
46. Touchstone Port Mapping；
47. TDR Package；
48. Channel Simulation；
49. Geometry-only Result；
50. Model-driven Result。

## PI

51. DC Power Path；
52. Track Neck；
53. Via Bottleneck；
54. Connector Bottleneck；
55. Thermal Relief Bottleneck；
56. Plane Island；
57. Voltage Drop；
58. Missing Current Profile；
59. Local Decoupling；
60. Shared Decoupling；
61. ESR/ESL；
62. Long Mounting Path；
63. Target Impedance；
64. Target Missing；
65. PDN Sweep；
66. Anti-resonance；
67. Coverage Gap；
68. Plane Resonance Candidate；
69. Numerical Failure；
70. Measurement Correlation。

## EMC and Protection

71. Fast Clock；
72. PWM/Motor；
73. Switch Node；
74. Board-edge Route；
75. External Cable；
76. Pair Asymmetry Common-mode；
77. Connector Imbalance；
78. Shield Termination；
79. Chassis Transition；
80. Seam/Slot；
81. Ground Stitching Gap；
82. Antenna Coupling；
83. ESD Entry；
84. TVS Placement；
85. Unprotected Branch；
86. CMC Symmetry；
87. Filter Return；
88. Conducted Candidate；
89. Radiated Candidate；
90. Immunity Candidate。

## Workflow and Security

91. Unified Finding；
92. Causal Chain；
93. Agent 24 Feedback；
94. Agent 25 Feedback；
95. Agent 26 Feedback；
96. Agent 23 Request；
97. Agent 19 Preview；
98. Agent 19 Execute；
99. Post-write Regression；
100. Rollback；
101. Baseline；
102. Waiver Expiry；
103. Revision-mismatched Measurement；
104. Malicious IBIS；
105. Malicious Touchstone；
106. Solver Command Injection；
107. Unapproved Model；
108. License Block；
109. Tenant Isolation；
110. Audit Replay。

---

# 67. 初始质量目标

```text
Native DRC Invocation Trace Coverage = 100%
DRC Finding Object Mapping >= 99% on supported fixtures
Unexplained Exclusion Release = 0
Short/Open Silent Acceptance = 0
Analysis Level Disclosure = 100%
Fidelity Disclosure = 100%
Model Source/Hash/Version Coverage = 100%
Unknown Model Auto-use = 0
Unknown Pin/Port Mapping Auto-use = 0
Geometry-only Result Claimed as Certification = 0
DRC Pass Claimed as EMC Pass = 0
Return-path Finding Evidence Coverage = 100%
Crosstalk Numeric Result without Required Context = 0
PDN Target Invented Value = 0
Private Data Sent to External Model = 0
Post-write Full Regression Coverage = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 68. 性能要求

常规项目：

```text
100–1,000 Footprints
300–5,000 Nets
10,000–200,000 Copper Objects
4–12 Layers
```

目标：

```text
Input Readiness P95 < 15 s
Native DRC bounded by KiCad CLI
Finding Normalization P95 < 10 s
Return-path Graph P95 < 60 s
Coupling Window Extraction P95 < 90 s
DC Power Graph P95 < 30 s
Interactive Finding Query P95 < 300 ms
```

模型仿真按 Profile：

```text
quick geometry review
balanced analytical review
deep model-driven review
measurement-correlated review
```

大型工程要求：

- Spatial Index；
- 分区；
- 增量缓存；
- Parquet；
- Worker Pool；
- Resource Budget；
- Cancel/Resume；
- 不把完整设计发送给模型。

---

# 69. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pcb-review-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第27个 Agent：

PCB DRC, Signal Integrity, Power Integrity & EMC Review Agent /
DRC、SI、PI 与 EMC 审查 Agent。

本 Agent 接收：

- Agent 16 PCB/Track/Via/Zone/Pad/Stack-up/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Padstack/Pin-Pad/Library 校验；
- Agent 21 Interface/Clock/Drive/Slew/Firmware 配置；
- Agent 22 ERC、保护、额定值和电源审查；
- Agent 23 SPICE 仿真和工作条件；
- Agent 24 PCB Constraint IR；
- Agent 25 Placement IR；
- Agent 26 Routing IR；
- KiCad Board/Rule 文件；
- IBIS、Touchstone、SPICE、Package 和 Measurement 数据；
- Enclosure、Cable、Chassis、Shield 和 Test Profile；

执行：

- Native DRC；
- Rule Resolution 和 Exclusion Governance；
- Connectivity；
- Return Path、Plane Split 和 Loop；
- Differential、Topology、Stub、Impedance 和 Crosstalk；
- DC Power、Bottleneck、Decoupling 和 PDN；
- EMC Aggressor、Common-mode、Cable、Chassis、Shield 和 Interface Protection；
- Model-driven Simulation Request；
- Unified Finding；
- Repair/Feedback；
- Agent 19 Change Plan；
- Regression 和 Release Gate。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–27 规格和 Agent 16–26 实际代码；
3. docs/pcb-review-agent-spec.md；
4. 当前 PCB/Rule/Stack-up IR；
5. 当前 KiCad DRC/CLI/Report；
6. 当前 Rule Resolution/Exclusion/Coverage；
7. 当前 Connectivity；
8. 当前 Plane/Return/Loop；
9. 当前 Diff/Impedance/Coupling/Topology；
10. 当前 IBIS/Touchstone/SPICE；
11. 当前 Power Graph/DC Drop/PDN；
12. 当前 EMC/Protection/Chassis/Cable；
13. 当前 Simulation/Measurement；
14. 当前 Finding/Repair/Waiver/Baseline；
15. 当前 Agent 19 Write/Readback；
16. 当前 UI/API/Worker/Storage/Security；
17. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Native/Geometry/Analytical/Simulation/Measurement Separation；
- Input Snapshot Immutable；
- Agent 18/20/24/25/26 Gate；
- DRC Pass != SI/PI/EMC Pass；
- Analysis Level and Fidelity Required；
- Rule Syntax and Zone State；
- Exclusion Reason；
- Zero-match/Shadow Reporting；
- Independent Connectivity；
- Short/Open Hard Gate；
- Per-segment Reference Plane；
- GND Copper != Valid Return；
- Geometry Loop != Exact Electromagnetic Loop；
- Diff Pair Coupled Review；
- Length != Delay；
- Analytical != Field Solver；
- Crosstalk Requires Edge/Termination；
- Model Source/Hash/License；
- Explicit Pin/Port Mapping；
- No Unapproved Model；
- Current Profile Required；
- Target Impedance Not Invented；
- Decoupling Includes ESR/ESL/Mounting；
- EMC Risk != Certification；
- Common-mode Mechanism Evidence；
- Interface Protection Return Path；
- Severity != Confidence；
- Finding Correlation Not Text-only；
- AI Does Not Fabricate Numbers/Waveforms/Fields；
- Agent 19 Workspace/Preview/Approval；
- Full Post-write Regression；
- Measurement Revision/Calibration Trace；
- 不发送私有设计给外部模型；
- 不用客户数据做公开 Fixture；
- 不伪造 DRC、Solver、Measurement、Certification 和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改 PCB：

1. 侦察当前仓库；
2. 检查 Agent 16–26 Contract；
3. 查找 PCB/Rule/Stack-up；
4. 查找 KiCad DRC CLI/Parser；
5. 查找 Exclusion/Rule Resolution；
6. 查找 Connectivity；
7. 查找 Plane/Return/Loop；
8. 查找 Diff/Topology/Stub；
9. 查找 Impedance/Coupling；
10. 查找 IBIS/Touchstone/SPICE；
11. 查找 Power Graph/DC Drop；
12. 查找 Decoupling/PDN；
13. 查找 EMC Aggressor/Common-mode；
14. 查找 Interface Protection；
15. 查找 Chassis/Cable/Shield；
16. 查找 Solver Registry；
17. 查找 Measurement Import；
18. 查找 Findings/Repair；
19. 查找 Agent 19 Write/Readback；
20. 查找 UI/API/Worker/Storage/Security；
21. 统计 DRC/SI/PI/EMC Coverage；
22. 统计 Model/Fidelity Coverage；
23. 统计 Exclusion/Critical/False Positive；
24. 抽样分析开源、合成、脱敏或授权 Fixture；
25. 在 docs/pcb-review-implementation-plan.md 中生成实施计划；
26. 在 docs/input-model-fidelity-gates.md 中定义 Gate；
27. 在 docs/native-drc-adapter.md 中定义 DRC；
28. 在 docs/rule-resolution-and-exclusions.md 中定义规则；
29. 在 docs/return-path-and-plane-analysis.md 中定义回流；
30. 在 docs/signal-integrity-review.md 中定义 SI；
31. 在 docs/impedance-and-discontinuity.md 中定义阻抗；
32. 在 docs/crosstalk-analysis.md 中定义串扰；
33. 在 docs/power-integrity-review.md 中定义 PI；
34. 在 docs/pdn-and-decoupling.md 中定义 PDN；
35. 在 docs/emc-risk-review.md 中定义 EMC；
36. 在 docs/interface-protection.md 中定义保护；
37. 在 docs/model-registry.md 中定义模型；
38. 在 docs/simulation-and-measurement.md 中定义仿真测量；
39. 在 docs/unified-finding-ir.md 中定义 Finding；
40. 在 docs/repair-and-feedback.md 中定义修复；
41. 在 docs/agent19-integration.md 中定义写入；
42. 在 docs/release-gates.md 中定义 Gate；
43. 在 docs/ai-boundaries.md 中定义 AI；
44. 在 docs/security.md 中定义安全；
45. 在 docs/pcb-review-migration-plan.md 中定义旧能力迁移；
46. 在 docs/pcb-review-benchmark-plan.md 中定义 Benchmark；
47. 给出拟新增、拟修改和拟复用文件；
48. 给出 Phase 1 精确范围；
49. 不修改业务代码；
50. 不创建 Migration；
51. 不安装 Solver；
52. 不运行生产 Solver；
53. 不修改 PCB；
54. 不调用外部模型；
55. 不读取或打印 Secret/NDA Model/Measurement；
56. 运行仓库已有 lint、type check、test、build 和 security scan；
57. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–26 Contract；
- Input/Model/Fidelity Gate；
- Native DRC；
- Rule Resolution/Exclusion；
- Connectivity；
- Return Path/Plane/Loop；
- Differential/Topology/Stub；
- Impedance/Discontinuity；
- Crosstalk；
- DC Power/Bottleneck；
- Decoupling/PDN；
- EMC/Common-mode；
- Interface Protection；
- Model Registry；
- Simulation/Measurement；
- Unified Finding；
- Repair/Feedback；
- Agent 19 Integration；
- Post-write Regression；
- Baseline/Waiver/Release Gate；
- AI Boundaries；
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

# 70. 后续 Phase 提示词模板

```text
继续实现 PCB Review Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–27 规格；
3. 阅读 PCB Review Implementation Plan；
4. 阅读 Gate、DRC、Rules、Return、SI、PI、EMC、Models、Finding、Repair、Agent19、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Analysis Level/Fidelity；
- Evidence-grounded Findings；
- Model Traceability；
- Independent Verification；
- No Certification Claims；
- Agent 19 Controlled Write；
- Full Regression；
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
9. provider/model contract test；
10. DRC/connectivity test；
11. SI/PI/EMC test；
12. finding/repair/regression test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Rule/Model/Provider 变化；
- 测试命令和真实结果；
- DRC/Connectivity；
- Return Path；
- SI；
- PI；
- EMC；
- Model/Fidelity；
- Repair/Regression；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 71. MVP 演示流程

1. 选择一块四层 MCU 控制板，带 USB-C、CAN、Buck、ADC、晶振、电机驱动和外部线缆；
2. Agent 16解析 PCB、Stack-up、Track、Via、Zone 和 Net；
3. Agent 18提供 Reviewed Netlist；
4. Agent 20确认 Footprint 和 Padstack；
5. Agent 21提供 USB Full-Speed、CAN、QSPI、PWM、ADC 和 Slew 配置；
6. Agent 22提供保护和额定值 Finding；
7. Agent 23提供边沿、负载和电源工作模式；
8. Agent 24提供 Constraint IR；
9. Agent 25提供 Placement IR；
10. Agent 26提供 Routing IR；
11. 建立 Review Input Snapshot；
12. 运行 `kicad-cli pcb drc`，要求 Refill Zones 和 Schematic Parity；
13. 归一化 DRC Finding；
14. 发现一条 Track End 未连接和一处 Thermal Relief 不完整；
15. 读取一条已有 Exclusion；
16. Exclusion 没有原因，Release Gate 标记；
17. 构建 Effective Rule Trace；
18. 构建 Reference Plane Regions；
19. 将 USB 路径按 Segment 映射参考层；
20. 发现 USB 换层处缺 Return Via；
21. 发现一段 USB 跨越 GND Void 边缘；
22. 输出 Return Detour Finding；
23. 检查 USB P/N Via 对称性；
24. 发现 P/N Via 到参考平面的过渡不对称；
25. 输出 Common-mode Conversion Candidate；
26. 构建 USB Impedance Profile；
27. 识别 Connector Pad、Via 和 Neck-down 三处 Discontinuity；
28. 几何级别只输出 Risk，不输出确定反射幅度；
29. 生成 IBIS/TDR Simulation Request；
30. 提取 QSPI Clock 与 ADC 输入的 Coupling Window；
31. 根据边沿、间距和参考层判为 High-risk Candidate；
32. 建议增加间距或换层，不直接宣称串扰超标；
33. 构建 Buck DC Power Graph；
34. 发现输入电源 Via 数和连接器 Pin 是瓶颈；
35. 计算可追溯的 DC Drop Candidate；
36. 建立 3.3V PDN；
37. 绑定 Bulk 和 Local Capacitor 模型；
38. 发现 MCU 某个 VDD Pin 的去耦路径跨两个 Via；
39. 输出 Mounting Inductance Risk；
40. 运行 PDN Sweep；
41. 发现某频段 Anti-resonance Peak 超过 Target；
42. Target 来源于允许纹波和负载阶跃；
43. 构建 EMC Aggressor Map；
44. 标出 Buck SW、PWM Motor、QSPI Clock；
45. 构建 Victim Map；
46. 标出 ADC Reference、Crystal 和外部 CAN Cable；
47. 检查 CAN 保护链；
48. 发现 TVS 返回普通数字 GND，且路径较长；
49. 输出 ESD Return-path Finding；
50. 检查 CANH/CANL CMC 和 TVS 对称性；
51. 输出 Common-mode Risk；
52. 合并 USB Return、Via Asymmetry 和 Cable Risk 为一条 Causal Chain；
53. 生成修复候选：
54. Agent 26 增加 Ground Return Via；
55. Agent 26 调整 USB 换层；
56. Agent 25 移动 TVS；
57. Agent 24 增加接口 Return-path Constraint；
58. Agent 23运行 IBIS Channel；
59. 工程师批准 Return Via 和 TVS Placement 修复；
60. Agent 19在 Workspace 执行；
61. 回读工程；
62. 重新运行 DRC；
63. 重新运行 Return、SI、PI、EMC；
64. DRC Error 清零；
65. USB Return Finding 关闭；
66. CAN ESD Finding 降为 Low；
67. 检查没有新 Crosstalk 或布局回归；
68. 生成 Finding Diff、Model Coverage 和 Fidelity Report；
69. EMC Pre-compliance Gate 通过，但报告明确“非实验室认证”；
70. 发布 `pcb-review.completed-with-findings` 或 `pcb-review.completed`。

---

# 72. 生产上线顺序

第一阶段：

```text
Native DRC
Rule/Exclusion Governance
Independent Connectivity
Return-path Geometry
Differential/Stub/Topology
Unified Finding
Report-only
```

第二阶段：

```text
Impedance Profile
Coupling Windows
DC Power Graph
Decoupling/PDN
Interface Protection
Agent 19 Repair Regression
```

第三阶段：

```text
IBIS/Touchstone
Advanced PDN
Measurement Correlation
EMC Risk Map
2D/2.5D Solver Handoff
Lab Test Integration
```

上线优先确保：

```text
每个 Finding 到底来自 DRC、几何、解析、仿真还是测量
结论依赖哪些 Stack-up、模型、工作模式和边沿条件
哪些是确定违规，哪些只是需要进一步仿真或测试的风险
修复后 DRC、SI、PI 和 EMC 是否整体改善而不是顾此失彼
```

一个可信的 DRC、SI、PI 与 EMC 审查 Agent，最重要的能力不是“发现得多”，而是知道自己到底知道多少：该确定时给出确定证据，该谨慎时明确写出模型缺口，该去实验室时别拿一张漂亮热力图冒充测试报告。
