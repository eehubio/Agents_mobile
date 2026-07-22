# PCB 约束提取 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：24  
> Agent 名称：PCB Constraint Extraction, Resolution & EDA Rule Generation Agent  
> 中文名称：PCB 约束提取 Agent  
> 类型：混合型（确定性结构提取 + 规则/参数求解 + 受控 AI 证据解释）  
> 版本：V1.0  
> 技术资料基线日期：2026-07-20  
>
> 定位：从 Agent 16/18 的结构化 EDA 工程与网表、Agent 20 的库和 Pin-Pad 校验、Agent 21 的接口与时序配置、Agent 22 的电气审查、Agent 23 的仿真结果、器件数据手册、参考设计、用户需求、PCB Stack-up 和制造商工艺能力中，提取并求解差分对、单端阻抗、线宽、电流能力、铜厚、过孔、长度、时延、Skew、拓扑、回流路径、过孔数量、禁布区、器件放置区、高压 Clearance/Creepage、屏蔽和敏感区域等 PCB 约束，生成版本化、可解释、可执行的 Canonical PCB Constraint IR，并输出 KiCad Net Class、Component Class、Rule Area、Tuning Profile、Board Setup 和 `.kicad_dru` 等适配结果。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Part IR、Pin IR、Net IR、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、网络连接置信度和 Release Level
> - Agent 20：Symbol/Footprint/Pin-Pad、库来源、封装尺寸和实例一致性
> - Agent 21：PinMux、Peripheral、Clock、Bus Speed、PWM、ADC、Memory 和 Firmware Configuration
> - Agent 22：ERC、接口保护、额定值、电源域、高压和敏感网络 Finding
> - Agent 23：带宽、边沿、负载、稳定性、敏感节点、仿真工作条件和测量结果
> - Agent 19：KiCad MCP/IPC/CLI、Workspace、Change Plan、Readback、DRC 和 Rollback
> - 器件数据手册、Layout Guidelines、Application Note、Reference Design 和 Evaluation Board
> - 用户产品需求、接口标准、环境、可靠性、安全等级、EMC 目标和认证约束
> - PCB 制造商能力、Stack-up、介质参数、铜厚、最小线宽/间距、阻抗公差和 Via 能力
> - 企业 PCB 规范、客户规范、产品类别规范、历史问题库和审核结果
>
> 下游：
> - Agent 19：把批准约束写入 KiCad 工程、`.kicad_dru`、Net Class、Component Class 和 Rule Area
> - 后续 PCB 自动布局 Agent：器件分区、禁布区、方向和邻近关系
> - 后续 PCB 自动布线 Agent：线宽、阻抗、差分、长度、Skew、过孔和拓扑
> - Agent 22：把布局布线约束用于高级审查
> - Agent 23：把实际或候选走线参数回送仿真
> - Agent 43：NPI、Stack-up 冻结、设计规则发布和制造资料
> - Agent 44：PCB 制造询价、工艺能力匹配和报价条件
> - Agent 45：测试点、探针禁布、测试区域和高压测试要求
> - CI、DRC、设计评审、Constraint Workbench 和 Release Gate
>
> 核心输出：
> - PCB Constraint Input Snapshot
> - Constraint Evidence Package
> - Stack-up Requirement IR
> - Stack-up Candidate and Manufacturer Profile
> - Net Role / Signal Class / Interface Group
> - Differential Pair Candidate and Reviewed Pair
> - Constraint Intent IR
> - Resolved PCB Constraint IR
> - Net Class Plan
> - Component Class Plan
> - Rule Area / Keepout Plan
> - Impedance Requirement
> - Trace Geometry Candidate
> - Current / Temperature-rise Requirement
> - Via Requirement
> - Length / Delay / Skew Requirement
> - Topology Requirement
> - Return-path Requirement
> - High-voltage Insulation Requirement
> - Placement and Routing Constraint
> - EDA Rule Package
> - KiCad `.kicad_dru` Patch
> - Constraint Coverage and Conflict Report
> - Agent 19 Canonical Change Plan
> - Post-write DRC and Semantic Verification
>
> 重要边界：
> - 网络名称只能作为证据之一，不能仅凭 `USB_D+`、`CLK`、`HV` 等名称直接生成确定性约束。
> - 差分对必须结合 Pin Role、器件接口、网络端点和用户/标准信息确认，不能仅按 `P/N` 后缀自动发布。
> - 阻抗不能脱离 Stack-up、介质厚度、Dk、铜厚、阻焊、参考层和制造公差计算。
> - 线宽不能只用电流值决定，还需考虑铜厚、允许温升、环境、走线位置、长度、压降、过孔、脉冲占空比和制造能力。
> - 长度匹配目标应优先来源于时延/Skew 预算；在介质和层未确定前，不把物理长度误当作传播时延。
> - 禁布区、器件邻近和方向约束必须区分“强制”“建议”和“数据手册原文但缺少量化值”。
> - 高压间距没有一张适用于所有产品的固定表；必须结合额定/瞬态电压、过电压类别、污染等级、材料组、海拔、涂覆、绝缘类别和适用标准。
> - `Clearance`、`Creepage`、铜到板边、槽、开窗、器件本体距离和测试距离必须分开。
> - 不把数据手册典型布局当成唯一合法布局。
> - 不根据图片比例直接生成精确毫米约束，除非图中有尺寸、比例或已审核几何锚点。
> - AI 可以辅助从自然语言和图文证据生成 Constraint Candidate 与解释，但不能独立决定最终数值和 Release Gate。
> - 未解决冲突、未知 Stack-up、未知制造能力和证据不足的约束必须保持 Candidate/Unresolved。
> - 本 Agent 不直接修改唯一生产工程，所有写入通过 Agent 19 的工作区、预览、审批、回读和回滚。
> - 不把私有工程、客户规范、Stack-up 和制造商 NDA 数据发送给外部通用模型。

---

# 1. Agent 24 的系统位置

```text
EDA / Netlist / Device Guidelines / Requirements
                         ↓
Input Quality and Evidence Gate
                         ↓
Circuit Context and Interface Recognition
                         ↓
Constraint Intent Extraction
                         ↓
Stack-up / Manufacturing Context Resolution
                         ↓
Electrical / Timing / Geometric Constraint Solver
                         ↓
Conflict Resolution and Review
                         ↓
Canonical PCB Constraint IR
                         ↓
EDA Adapter and Rule Package
                         ↓
Agent 19 Controlled Write
                         ↓
Readback / DRC / Coverage / Regression
```

---

# 2. 为什么需要独立 Agent 24

常见 PCB 约束来源分散在：

```text
原理图网络名
器件 Pin 描述
数据手册 Layout Guidelines
接口标准
Firmware 速率
仿真边沿和带宽
用户口头要求
PCB 工厂 Stack-up
企业设计规范
```

如果直接把这些文本写入 EDA，容易出现：

1. 同一网络同时属于多个冲突 Net Class；
2. 数据手册要求 50Ω，但 Stack-up 尚未确定；
3. USB 被识别成差分对，但 P/N 接错或网络并非同一接口；
4. 电源线宽按 2A 计算，却忽略了过孔和 100mV 压降要求；
5. 数据手册说“尽量短”，系统随意翻译成 10mm；
6. DDR 类接口只做物理长度匹配，没有按层延时匹配；
7. 高压规则只按工作电压，不考虑瞬态、污染、海拔和材料；
8. 禁布区仅存在于 PDF 图片中，没有生成 Board Rule Area；
9. 一条规则被 Net Class 覆盖，另一条被 `.kicad_dru` 的更高优先级规则覆盖；
10. 约束写入成功，但并未匹配到任何 Net、Footprint 或 Area。

Agent 24 的职责是：

```text
Source Evidence
→ Constraint Intent
→ Resolved Numeric Constraint
→ EDA-specific Enforcement
→ Coverage Verification
```

---

# 3. 当前 KiCad 规则基线

Agent 24 的 KiCad Adapter 需要覆盖：

```text
Board Setup Global Constraints
Net Classes
Component Classes
Rule Areas
Keepouts
Tuning Profiles
Graphical Design Rule Editor
Custom Design Rules
.kicad_dru
Board Stack-up
```

KiCad 的规则层级和优先级必须被解析和模拟，不能只生成文件文本。

---

# 4. 建设目标

系统必须能够：

1. 接收 Agent 16 Project/Schematic/PCB/Part/Pin/Net IR；
2. 接收 Agent 18 Reviewed Netlist；
3. 接收 Agent 20 Library/Pin-Pad 状态；
4. 接收 Agent 21 Interface/Clock/Bus/Firmware 配置；
5. 接收 Agent 22 Review Finding；
6. 接收 Agent 23 Simulation Result；
7. 接收用户需求；
8. 接收数据手册；
9. 接收 Layout Guideline；
10. 接收 Reference Design；
11. 接收 Evaluation Board；
12. 接收企业 PCB 规范；
13. 接收客户 PCB 规范；
14. 接收产品 Profile；
15. 接收安全标准 Profile；
16. 接收制造商能力；
17. 接收 Stack-up；
18. 接收 Dk/Df；
19. 接收铜厚；
20. 接收阻焊参数；
21. 接收阻抗公差；
22. 建立不可变 Input Snapshot；
23. 建立 Evidence Snapshot；
24. 建立 Requirement Snapshot；
25. 建立 Manufacturing Profile Snapshot；
26. 建立 Stack-up Snapshot；
27. 建立 Circuit Context；
28. 建立 Part Role；
29. 建立 Pin Role；
30. 建立 Net Role；
31. 建立 Interface Group；
32. 建立 Signal Group；
33. 建立 Power Rail；
34. 建立 Power Domain；
35. 建立 Voltage Domain；
36. 建立 Functional Block；
37. 建立 External Connector；
38. 建立 Sensitive Node；
39. 建立 Aggressor/Victim Candidate；
40. 识别差分网络候选；
41. 识别差分正负极；
42. 识别源和负载；
43. 识别点到点；
44. 识别多点总线；
45. 识别星形；
46. 识别 Daisy Chain；
47. 识别 Fly-by；
48. 识别 Stub；
49. 识别 Clock；
50. 识别 Strobe；
51. 识别 Data Group；
52. 识别 Address/Command Group；
53. 识别 Reset；
54. 识别 Chip Select；
55. 识别 Analog Input；
56. 识别 Analog Output；
57. 识别 Feedback；
58. 识别 Switch Node；
59. 识别 Gate Drive；
60. 识别 Current Sense；
61. 识别 Reference；
62. 识别 High-voltage Net；
63. 识别 Isolation Boundary；
64. 识别 Chassis/Shield；
65. 识别 Test Net；
66. 识别 No-route Net；
67. 识别 No-via Net；
68. 识别 Restricted Layer Net；
69. 识别 Critical Placement Component；
70. 识别 Connector Pin Group；
71. 从 Pin Function 推断接口候选；
72. 从 Net Endpoint 推断接口候选；
73. 从 MPN/器件类别推断接口候选；
74. 从 Firmware 配置推断接口候选；
75. 从数据手册提取接口要求；
76. 从自然语言需求提取约束候选；
77. 从表格提取约束候选；
78. 从图片提取 Rule Area 候选；
79. 从尺寸图提取几何约束；
80. 从 Reference Layout 提取相对关系；
81. 区分 Required/Recommended/Example；
82. 区分 Min/Typ/Max；
83. 区分物理长度和电气时延；
84. 区分线宽、阻抗和电流约束；
85. 区分 Clearance 和 Creepage；
86. 区分铜到铜和器件到器件；
87. 区分 Track/Pad/Via/Zone；
88. 区分层内和跨层；
89. 区分走线和回流路径；
90. 区分原理图约束和 PCB 约束；
91. 建立 Constraint Intent；
92. 建立 Constraint Scope；
93. 建立 Constraint Target；
94. 建立 Constraint Evidence；
95. 建立 Constraint Confidence；
96. 建立 Constraint Severity；
97. 建立 Constraint Priority；
98. 建立 Constraint Source Precedence；
99. 建立 Constraint Effectivity；
100. 建立 Constraint Variant Scope；
101. 建立 Constraint Revision；
102. 建立 Conflict Group；
103. 识别重复约束；
104. 识别兼容约束；
105. 识别数值冲突；
106. 识别 Scope 冲突；
107. 识别 Priority 冲突；
108. 识别标准冲突；
109. 识别制造能力冲突；
110. 识别 Stack-up 冲突；
111. 识别接口配置冲突；
112. 识别 Firmware 配置冲突；
113. 识别 Simulation 结果冲突；
114. 识别 EDA 不可表达约束；
115. 建立 Stack-up Requirement；
116. 建立 Stack-up Candidate；
117. 计算每层传播延时；
118. 计算单端阻抗候选；
119. 计算差分阻抗候选；
120. 计算线宽候选；
121. 计算差分间距候选；
122. 计算参考层要求；
123. 计算阻焊影响候选；
124. 计算铜厚影响；
125. 计算制造公差影响；
126. 计算目标阻抗容差；
127. 计算过孔 Stub 候选；
128. 计算允许换层次数；
129. 计算差分过孔对称性要求；
130. 计算回流过孔要求；
131. 计算电源线电流能力；
132. 计算允许温升；
133. 计算压降；
134. 计算功耗；
135. 计算 Via 电流能力候选；
136. 计算并联 Via 数量候选；
137. 计算铜皮/平面需求；
138. 计算热风险候选；
139. 计算脉冲/占空比影响；
140. 生成 Line-width Range；
141. 生成 Via Style；
142. 生成 Neck-down 限制；
143. 生成 Fuse Trace 候选，可选；
144. 生成最大物理长度；
145. 生成最小物理长度；
146. 生成绝对长度范围；
147. 生成组内长度匹配；
148. 生成差分对内 Skew；
149. 生成组间 Skew；
150. 生成时延范围；
151. 生成 Flight-time Budget；
152. 生成 Tuning Profile；
153. 生成蛇形区限制；
154. 生成调长形态要求；
155. 生成最大 Via 数；
156. 生成最大 Stub；
157. 生成最大 Uncoupled Length；
158. 生成拓扑约束；
159. 生成 Branch Point；
160. 生成终端器件邻近要求；
161. 生成源串联电阻邻近要求；
162. 生成接收端终端邻近要求；
163. 生成 Clock Generator 邻近要求；
164. 生成 Crystal 邻近要求；
165. 生成 Decoupling 邻近要求；
166. 生成 Switch Node 面积限制；
167. 生成 Feedback 远离 Switch Node；
168. 生成 Analog/Digital 分区；
169. 生成 Sensitive Net 与 Aggressor 间距；
170. 生成 Guard Trace 候选；
171. 生成 Ground Stitching 候选；
172. 生成 Return-path Continuity；
173. 生成 Reference Plane 禁止跨分割；
174. 生成 Plane Change Stitching；
175. 生成 Connector Entry Protection 邻近；
176. 生成 ESD 器件邻近；
177. 生成 Common-mode Choke 邻近；
178. 生成 Test Point 约束；
179. 生成 Probe Keepout；
180. 生成 Antenna Keepout；
181. 生成 RF Module Keepout；
182. 生成 Crystal Keepout；
183. 生成 High-current Keepout；
184. 生成 High-voltage Keepout；
185. 生成 Board-edge Clearance；
186. 生成 Mounting-hole Clearance；
187. 生成 Mechanical Keepout；
188. 生成 Enclosure Keepout；
189. 生成 Copper Keepout；
190. 生成 Via Keepout；
191. 生成 Footprint Keepout；
192. 生成 Layer-specific Keepout；
193. 生成 Orientation Constraint；
194. 生成 Side Constraint；
195. 生成 Placement Region；
196. 生成 Grouping Constraint；
197. 生成 Order Constraint；
198. 生成 Relative-placement Constraint；
199. 生成 Minimum/Maximum Distance；
200. 生成 High-voltage Clearance；
201. 生成 High-voltage Creepage；
202. 生成 Coated/Uncoated Variant；
203. 生成 Altitude Correction；
204. 生成 Pollution Degree Scope；
205. 生成 Material Group Scope；
206. 生成 Overvoltage Category Scope；
207. 生成 Basic/Reinforced/Supplementary Insulation；
208. 生成 Slot/Cutout Candidate；
209. 生成 Copper-to-edge Requirement；
210. 生成 Isolation Component Boundary；
211. 生成 Primary/Secondary Keepout；
212. 生成 Chassis Boundary；
213. 生成 Test Voltage Metadata；
214. 生成 Constraint Coverage；
215. 生成 Constraint Match Count；
216. 生成 Unmatched Constraint；
217. 生成 Shadowed Constraint；
218. 生成 Effective Constraint；
219. 生成 Constraint Simulation；
220. 生成 Canonical PCB Constraint IR；
221. 生成 Net Class Plan；
222. 生成 Component Class Plan；
223. 生成 Rule Area Plan；
224. 生成 Tuning Profile Plan；
225. 生成 Stack-up Patch；
226. 生成 Board Setup Patch；
227. 生成 `.kicad_dru`；
228. 生成 KiCad Rule Syntax Validation；
229. 生成 Altium Constraint Adapter；
230. 生成 EasyEDA/JLCEDA Adapter，可选；
231. 生成 Human-readable Constraint Document；
232. 生成 CSV/JSON；
233. 生成 Constraint Diff；
234. 生成 Agent 19 Change Plan；
235. 支持 Preview；
236. 支持审批；
237. 支持 Agent 19执行；
238. 支持 Agent 16重新解析；
239. 支持 DRC；
240. 支持 Coverage 回读；
241. 支持 Rule Match 回读；
242. 支持约束冲突回读；
243. 支持回滚；
244. 支持 Git；
245. 支持 Baseline；
246. 支持 Waiver；
247. 支持 CI；
248. 支持 Release Gate；
249. 支持多租户；
250. 支持批量工程；
251. 支持增量提取；
252. 支持私有部署；
253. 不把候选当最终规则；
254. 不把网络名当唯一接口证据；
255. 不在 Stack-up 未知时发布精确阻抗线宽；
256. 不把物理长度直接当时延；
257. 不把最大电流等同持续电流；
258. 不忽略 Via 和连接器瓶颈；
259. 不硬编码通用高压距离；
260. 不把 Typical Layout 当强制；
261. 不从无比例图片生成精确坐标；
262. 不自动覆盖已有人工规则；
263. 不自动修改高风险 Stack-up；
264. 不自动降低制造规则；
265. 不自动放宽安全间距；
266. 不将 EDA 写入成功等同规则有效；
267. 不伪造标准、参数、Stack-up、计算或 DRC 结果；
268. 不把私有工程和 NDA Stack-up 发给外部模型。

---

# 5. 核心架构

```text
Input Snapshot
→ Circuit and Requirement Context
→ Evidence Extraction
→ Constraint Intent
→ Stack-up / Fab Capability
→ Electrical and Timing Resolution
→ Conflict and Precedence
→ Canonical Constraint IR
→ EDA Adapter
→ Agent 19 Execution
→ DRC / Coverage / Regression
```

---

# 6. 四层约束模型

## 6.1 Constraint Evidence

原始证据：

```text
原理图连接
Pin Function
器件手册原文
接口标准
Firmware 配置
仿真结果
用户需求
制造商能力
```

## 6.2 Constraint Intent

尚未完全量化的意图：

```text
USB 差分对
阻抗控制
保持短
远离开关节点
必须使用连续参考层
高压隔离
```

## 6.3 Resolved Constraint

结合 Stack-up、工艺和工作条件求解后的数值：

```text
90Ω differential ±10%
W/S candidates per layer
skew <= 0.2 mm or delay equivalent
clearance >= X
maximum via count
```

## 6.4 EDA Enforcement

具体写入形式：

```text
Net Class
Component Class
Tuning Profile
Rule Area
Custom Rule
Board Setup
Keepout
```

四层必须分开，不能只保存最终 `.kicad_dru` 文本。

---

# 7. 输入可信度 Gate

## Blocked

```text
Agent 18 Release Level 太低
Pin-to-Net 冲突
Agent 20 Pin-Pad Critical
器件身份无法确定且规则依赖具体型号
Stack-up 缺失但请求精确阻抗
高压 Profile 信息不完整
```

## Candidate-only

```text
接口仅由 Net Name 推断
数据手册 OCR 未审核
图片无比例
用户只说“高速”
制造商能力未锁定
```

## Resolved Allowed

```text
Reviewed Netlist
可信 Pin Role
Stack-up/工艺明确
工作条件明确
规则证据批准
```

---

# 8. PCB Constraint Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "agent16_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_report_hash": "sha256",
  "agent21_ir_hash": "sha256",
  "agent22_review_hash": "sha256",
  "agent23_result_hash": "sha256",
  "requirement_profile_hash": "sha256",
  "stackup_profile_hash": "sha256",
  "fabrication_profile_hash": "sha256"
}
```

---

# 9. Circuit Context

保存：

```text
parts
pins
nets
interfaces
signal groups
power rails
voltage domains
functional blocks
connectors
sensitive nodes
aggressors
isolation domains
```

---

# 10. Net Role

```text
power
ground
clock
strobe
high-speed single-ended
differential positive
differential negative
data
address/command
reset
chip select
open-drain bus
analog input
analog output
reference
feedback
switch node
gate drive
current sense
RF
high voltage
isolation
shield/chassis
test
unknown
```

---

# 11. Interface Group

```text
interface id
type
role
controller
endpoint
nets
pins
configured speed
voltage
topology
external exposure
source evidence
confidence
review status
```

---

# 12. 差分对识别

证据来源：

```text
Pin Function Pair
器件接口定义
原理图 Differential Pair Directive
Network Suffix
Net Endpoint Symmetry
Firmware Peripheral
接口规则库
用户确认
```

---

# 13. 差分对状态

```text
explicit_eda
device_verified
interface_verified
reviewed
candidate
ambiguous
polarity_conflict
endpoint_conflict
unpaired
```

只有前四类可自动发布。

---

# 14. 差分对检查

```text
P/N 极性
同一源接口
同一目标接口
中间器件对称
串联电阻对应
ESD/CMC 对称
连接器 Pin 对应
网络无意外分支
```

---

# 15. 单端阻抗

适用于：

```text
时钟
RF
高速单端数据
存储器接口
高速 ADC/DAC
视频接口
```

需要：

```text
目标阻抗
容差
参考层
层
终端
源/负载阻抗
```

---

# 16. Stack-up Requirement IR

```text
layer count
signal/reference layers
copper thickness
dielectric thickness
Dk/Df frequency conditions
solder mask
plane type
impedance targets
manufacturing limits
cost/availability
```

---

# 17. Stack-up 状态

```text
user_fixed
manufacturer_fixed
candidate
derived
unknown
conflicting
```

---

# 18. Impedance Requirement

```text
single-ended/differential
target
tolerance
frequency band
layer scope
reference plane
coupled geometry
mask condition
source
confidence
```

---

# 19. Impedance 求解

V1 推荐：

```text
调用批准的场求解器或制造商 Calculator Adapter
```

可保留近似解析公式用于：

```text
候选筛选
合理性检查
```

但最终生产几何应由批准 Stack-up 和制造商能力确认。

---

# 20. Trace Geometry Candidate

```text
layer
width
gap
copper thickness
dielectric height
reference plane
mask
predicted impedance
tolerance sensitivity
solver
solver version
```

---

# 21. 阻抗冲突

例如：

```text
50Ω 要求的线宽低于工厂最小线宽
90Ω 差分间距低于工厂能力
目标几何与 BGA Escape 不兼容
同一 Net 在不同层需要不同线宽
```

输出替代：

```text
调整 Stack-up
调整层
调整线宽/间距
局部 Neck-down
改变阻抗容差
升级工艺
人工审核
```

---

# 22. 电流约束输入

```text
continuous current
peak current
pulse width
duty cycle
ambient
allowed temperature rise
allowed voltage drop
trace length
copper thickness
external/internal layer
parallel planes/traces
via transitions
```

---

# 23. 电流约束来源

```text
用户负载需求
电源树
器件最大/典型电流
仿真
Firmware Duty
历史测量
BOM 参数
```

器件额定最大电流不能自动当作设计持续电流。

---

# 24. Current / Width Solver

输出：

```text
minimum thermal width candidate
minimum voltage-drop width candidate
manufacturing minimum
recommended width
zone/plane recommendation
via count candidate
confidence
standard/profile version
```

---

# 25. Current Rule Provider

电流和温升计算必须是可插拔 Provider：

```text
enterprise empirical profile
approved standards-based profile
manufacturer calculator
field solver/thermal solver
```

不把单一经验公式硬编码成全球真理。

---

# 26. Via Requirement

```text
via type
diameter
drill
plating
count
current per via candidate
thermal requirement
high-speed stub
differential symmetry
reference stitching
manufacturer capability
```

---

# 27. Neck-down

BGA/连接器 Escape 可允许局部 Neck-down：

```text
max length
min width
layer
location
affected impedance
review status
```

不能让局部 Escape 宽度覆盖整条 Net 的电流或阻抗要求。

---

# 28. Length Constraint

```text
absolute min/max
matched group
reference net
tolerance
measurement mode
pin-to-pin scope
package delay
via delay
connector delay
```

---

# 29. Length 与 Delay

保存两类值：

```text
physical length
propagation delay
```

当 KiCad Tuning Profile 或层延时数据可用时，优先按 Delay 预算生成约束。

---

# 30. Delay Budget

```text
source device package delay
PCB trace delay
via delay
connector/cable delay
receiver setup/hold
jitter
margin
```

Agent 24 仅处理 PCB 可控制部分，但保留系统预算。

---

# 31. Differential Skew

```text
intra-pair skew
inter-pair/group skew
maximum uncoupled length
maximum via mismatch
layer transition symmetry
```

---

# 32. Matched Group

```text
group id
member nets
reference
matching metric
tolerance
scope
endpoint definition
topology
```

---

# 33. Topology Constraint

```text
point-to-point
multi-drop
star
daisy-chain
fly-by
source-terminated
parallel-terminated
stub-limited
```

---

# 34. Stub Constraint

```text
max stub length
allowed branch count
branch point
test-point exception
connector exception
frequency/edge basis
```

---

# 35. Return-path Requirement

```text
continuous reference plane
no split crossing
stitching via near transition
reference layer
maximum distance to return via
chassis transition
common-mode path
```

---

# 36. Placement Constraint

```text
near
far
inside region
outside region
same side
orientation
sequence
group
between
minimum/maximum distance
```

---

# 37. “靠近”不能直接发布

数据手册写：

```text
place capacitor close to pin
```

系统先生成：

```text
qualitative_near
```

只有企业规则、器件具体 Layout Guide 或人工输入提供数值时，才生成：

```text
maximum_distance
```

---

# 38. Rule Area

用于：

```text
局部线宽/间距
局部 Via 类型
禁止布线
禁止铜皮
禁止过孔
器件区域
高压区域
天线区域
晶振区域
Switch Node 区域
```

---

# 39. Keepout 类型

```text
track
via
copper zone
pad
footprint
component placement
all copper
specific layer
through-hole
test probe
mechanical
```

---

# 40. RF/Antenna Keepout

来源：

```text
模块数据手册
参考布局
天线厂家规范
Enclosure Requirement
```

输出：

```text
区域边界
层范围
禁止铜
禁止器件
禁止 Via
允许例外
```

---

# 41. Switch Node 约束

```text
面积最小化
远离反馈
远离敏感模拟
禁止测试点或长 Stub
特定层或区域
```

原理图无法直接确定面积，输出布局和 Rule Area 意图。

---

# 42. Crystal 约束

```text
器件邻近
回路紧凑
禁止其他高速线穿越
参考地
Guard 候选
对称
无测试 Stub
```

---

# 43. Decoupling 约束

来自 Agent 22：

```text
电容与供电 Pin 关联
最大距离候选
同层优先
Via 数量
回路
参考地
```

---

# 44. Isolation Boundary

保存：

```text
domain A
domain B
isolation components
allowed crossing components
clearance
creepage
slot/cutout
layer scope
coating
test voltage
```

---

# 45. 高压输入参数

```text
working voltage
rated insulation voltage
transient/impulse voltage
AC/DC
frequency
overvoltage category
pollution degree
material group/CTI
altitude
coating
basic/reinforced/supplementary
applicable standard
product category
```

---

# 46. Clearance 与 Creepage

```text
clearance
最短空气距离

creepage
沿绝缘表面的最短距离
```

二者必须分别建模和验证。

---

# 47. High-voltage Rule Provider

实现为版本化 Provider：

```text
IEC profile
UL/product profile
enterprise profile
customer profile
manual engineering decision
```

Agent 不内置一张无法解释的固定距离表。

---

# 48. Altitude 和环境

高压规则必须支持：

```text
海拔修正
污染等级
涂覆
凝露
导电粉尘
材料组
槽和开孔
```

---

# 49. Constraint Intent Schema

```json
{
  "constraint_intent_id": "uuid",
  "intent_type": "differential_impedance",
  "scope": {
    "interface_id": "uuid",
    "net_ids": ["uuid", "uuid"]
  },
  "qualitative_requirement": "controlled impedance differential pair",
  "numeric_candidates": [],
  "evidence_ids": [],
  "confidence": {},
  "status": "candidate"
}
```

---

# 50. Resolved Constraint Schema

```json
{
  "constraint_id": "uuid",
  "constraint_type": "diff_pair_gap",
  "scope": {},
  "min": "0.12 mm",
  "opt": "0.15 mm",
  "max": "0.18 mm",
  "source_intent_ids": [],
  "stackup_profile_id": "uuid",
  "fabrication_profile_id": "uuid",
  "priority": 800,
  "status": "reviewed"
}
```

---

# 51. Constraint 状态

```text
observed
candidate
needs_information
calculated_candidate
reviewed
approved
released
superseded
waived
conflicting
unexpressible
```

---

# 52. Confidence 维度

```text
connectivity_confidence
interface_identity_confidence
device_evidence_confidence
requirement_confidence
stackup_confidence
manufacturing_confidence
calculation_confidence
eda_mapping_confidence
review_confidence
```

---

# 53. Evidence 类型

```text
EDA Directive
Net/Pin/Part IR
Datasheet Text
Datasheet Table
Layout Figure
Application Note
Reference Design
Interface Standard
Firmware Configuration
Simulation Measurement
User Requirement
Enterprise Rule
Manufacturer Stack-up
Manufacturer Capability
Safety Standard
Historical Verified Issue
```

---

# 54. Evidence Anchoring

保存：

```text
文档 Hash
页码
章节
表格/图号
Bounding Region，可选
结构化内容
审核状态
```

---

# 55. AI 允许职责

```text
从已解析文本提取约束候选
把“保持短”“远离”等语言归类
将图文证据生成相对布局候选
总结冲突
生成工程师可读解释
生成规则草稿
帮助补充 Evidence Query
```

---

# 56. AI 禁止职责

```text
独立识别确定性差分对
独立计算最终阻抗几何
伪造 Dk、铜厚或 Stack-up
决定高压安全距离
覆盖企业/标准规则
自动降低安全或制造约束
直接修改 PCB 工程
```

---

# 57. Constraint Source Precedence

建议：

```text
approved safety/customer mandatory rule
approved product requirement
approved interface/device-specific rule
approved manufacturer stack-up
enterprise rule
device-family recommendation
generic heuristic
AI candidate
```

冲突不能静默覆盖。

---

# 58. Rule Conflict 类型

```text
numeric_range_empty
priority_ambiguity
scope_overlap
stackup_incompatible
fabrication_incompatible
safety_lowered
interface_mismatch
firmware_mismatch
simulation_mismatch
eda_unexpressible
```

---

# 59. Effective Constraint

对于每个对象和规则类型，计算：

```text
all matching constraints
precedence
priority
specificity
effectivity
min/opt/max merge
final effective constraint
shadowed constraints
conflicts
```

---

# 60. Canonical PCB Constraint IR

```json
{
  "pcb_constraint_ir_version": "1.0.0",
  "project": {},
  "context": {},
  "stackup": {},
  "fabrication": {},
  "net_classes": [],
  "component_classes": [],
  "interfaces": [],
  "constraints": [],
  "areas": [],
  "keepouts": [],
  "tuning_profiles": [],
  "conflicts": [],
  "coverage": {},
  "provenance": {}
}
```

---

# 61. Canonical Constraint 类型

```text
clearance
creepage
track_width
track_angle
via_diameter
hole_size
via_count
via_type
diff_pair_width
diff_pair_gap
diff_pair_uncoupled
skew
matched_length
absolute_length
propagation_delay
max_stub
reference_plane
return_via
disallow
allowed_layers
allowed_orientation
placement_region
minimum_distance
maximum_distance
keepout
copper_to_edge
thermal
impedance_intent
current_capacity_intent
assertion
```

---

# 62. KiCad Adapter

生成：

```text
Net Classes
Component Classes
Tuning Profiles
Board Setup Constraints
Rule Areas
Keepouts
Custom Rules
Text Variables
```

---

# 63. KiCad `.kicad_dru`

每条规则保存：

```text
Canonical Constraint ID
Generated Rule Name
Condition
Layer
Severity
Constraint Clauses
Priority Order
Source Comment
```

---

# 64. KiCad Rule Priority

Adapter 必须：

```text
模拟规则求值顺序
把更具体规则放在更高有效优先级
检查 Shadow
检查 Zero Match
检查 Syntax
```

不能只把规则按创建顺序追加。

---

# 65. Net Class 与 Custom Rule

原则：

```text
默认路由几何和常见分类 → Net Class/Tuning Profile
强制 Min/Max、局部规则和复杂 Scope → Custom Rule
区域限制 → Rule Area/Keepout
器件组 → Component Class
```

---

# 66. Rule Coverage

每条生成规则回读：

```text
匹配 Net 数
匹配 Track/Via/Pad 数
匹配 Footprint 数
匹配 Area 数
当前违反数
被 Shadow 数
```

Zero Match 必须 Warning 或 Error。

---

# 67. Constraint Patch

操作：

```text
create_net_class
assign_net_class
create_component_class
assign_component_class
create_tuning_profile
set_stackup
create_rule_area
create_keepout
add_custom_rule
update_custom_rule
remove_generated_rule
set_board_constraint
set_text_variable
```

---

# 68. Patch 前置条件

```text
project revision
constraint IR hash
stackup hash
fabrication profile hash
existing rule hash
target entities exist
no unresolved critical conflict
```

---

# 69. Patch 后置条件

```text
KiCad reopens
rules parse
rules match intended scope
effective constraints equal approved IR
no unexpected existing-rule override
DRC executes
new violations documented
Agent 16 reparse passes
```

---

# 70. Release Gate

## Constraint Draft

允许 Candidate 和未知 Stack-up。

## Layout Start

要求：

```text
关键接口识别完成
差分对确认
电源和高压 Net Class 完成
初始 Stack-up 候选
主要 Keepout 完成
```

## Routing Start

要求：

```text
Stack-up 冻结或受控
阻抗几何完成
长度/Skew 完成
电流线宽和 Via 完成
规则已写入并覆盖验证
```

## NPI Freeze

要求：

```text
Critical/High-risk Conflict = 0
高压规则批准
制造能力匹配
DRC 通过或批准 Waiver
Constraint Manifest 冻结
```

---

# 71. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ BUILDING_CONTEXT
→ RESOLVING_EVIDENCE
→ EXTRACTING_CONSTRAINT_INTENTS
→ IDENTIFYING_INTERFACES
→ IDENTIFYING_SIGNAL_GROUPS
→ RESOLVING_STACKUP
→ RESOLVING_FAB_CAPABILITY
→ CALCULATING_ELECTRICAL_CONSTRAINTS
→ CALCULATING_TIMING_CONSTRAINTS
→ RESOLVING_PLACEMENT_AND_KEEPOUTS
→ RESOLVING_HIGH_VOLTAGE
→ DETECTING_CONFLICTS
→ BUILDING_CONSTRAINT_IR
→ GENERATING_EDA_RULES
→ VALIDATING_RULE_COVERAGE
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_CANDIDATES
COMPLETED_WITH_CONFLICTS
REVIEW_REQUIRED
INPUT_BLOCKED
STACKUP_REQUIRED
FABRICATION_PROFILE_REQUIRED
HIGH_VOLTAGE_CONTEXT_REQUIRED
EDA_MAPPING_PARTIAL
RULE_COVERAGE_FAILED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 72. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT18_RELEASE_TOO_LOW
AGENT18_CONNECTIVITY_BLOCKED
AGENT20_PIN_PAD_BLOCKED
AGENT21_CONFIGURATION_CONFLICT
AGENT22_FINDING_BLOCKED
AGENT23_RESULT_INCOMPATIBLE
REQUIREMENT_PROFILE_MISSING
STACKUP_PROFILE_MISSING
STACKUP_CONFLICT
FABRICATION_PROFILE_MISSING
FABRICATION_CAPABILITY_CONFLICT
INTERFACE_IDENTITY_AMBIGUOUS
DIFFERENTIAL_PAIR_AMBIGUOUS
DIFFERENTIAL_PAIR_POLARITY_CONFLICT
SIGNAL_GROUP_AMBIGUOUS
VOLTAGE_DOMAIN_UNKNOWN
CURRENT_REQUIREMENT_UNKNOWN
TIMING_BUDGET_UNKNOWN
IMPEDANCE_TARGET_UNKNOWN
IMPEDANCE_SOLVER_UNAVAILABLE
IMPEDANCE_GEOMETRY_UNMANUFACTURABLE
TRACE_WIDTH_UNMANUFACTURABLE
VIA_REQUIREMENT_UNMANUFACTURABLE
LENGTH_CONSTRAINT_CONFLICT
SKEW_CONSTRAINT_CONFLICT
TOPOLOGY_CONFLICT
RETURN_PATH_REQUIREMENT_UNRESOLVED
PLACEMENT_CONSTRAINT_UNQUANTIFIED
KEEPOUT_GEOMETRY_UNRESOLVED
HIGH_VOLTAGE_PROFILE_INCOMPLETE
CLEARANCE_RULE_CONFLICT
CREEPAGE_RULE_CONFLICT
ALTITUDE_CONTEXT_MISSING
SAFETY_RULE_CONFLICT
RULE_SCHEMA_INVALID
RULE_PRIORITY_CONFLICT
RULE_ZERO_MATCH
RULE_SHADOWED
EDA_CONSTRAINT_UNEXPRESSIBLE
KICAD_RULE_GENERATION_FAILED
KICAD_RULE_SYNTAX_INVALID
AGENT19_EXECUTION_FAILED
POST_WRITE_RULE_MISMATCH
DRC_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR


---

# 73. 数据库设计

## 73.1 `pcb_constraint_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_bundle_id UUID NOT NULL
agent18_release_id UUID NOT NULL
agent20_scan_id UUID NOT NULL
agent21_ir_id UUID NULL
agent22_review_id UUID NULL
agent23_result_id UUID NULL
requirement_profile_id UUID NULL
stackup_profile_id UUID NULL
fabrication_profile_id UUID NULL
constraint_policy_version VARCHAR NOT NULL
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

## 73.2 `pcb_constraint_input_snapshots`

```text
id UUID PK
constraint_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent21_ir_hash CHAR(64) NULL
agent22_review_hash CHAR(64) NULL
agent23_result_hash CHAR(64) NULL
requirement_profile_hash CHAR(64) NULL
stackup_profile_hash CHAR(64) NULL
fabrication_profile_hash CHAR(64) NULL
evidence_snapshot_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, snapshot_hash)
```

## 73.3 `pcb_constraint_requirement_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
product_category VARCHAR NULL
environment_profile JSONB NOT NULL
safety_profile JSONB NOT NULL
emc_profile JSONB NOT NULL
reliability_profile JSONB NOT NULL
interface_requirements JSONB NOT NULL
power_requirements JSONB NOT NULL
timing_requirements JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 73.4 `pcb_fabrication_profiles`

```text
id UUID PK
tenant_id UUID NULL
manufacturer_name VARCHAR NOT NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
process_family VARCHAR NOT NULL
layer_count_range JSONB NOT NULL
minimum_trace_space JSONB NOT NULL
copper_options JSONB NOT NULL
via_capabilities JSONB NOT NULL
impedance_capabilities JSONB NOT NULL
material_options JSONB NOT NULL
solder_mask_options JSONB NOT NULL
special_processes JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(manufacturer_name, profile_name, profile_version)
```

## 73.5 `pcb_stackup_profiles`

```text
id UUID PK
tenant_id UUID NULL
fabrication_profile_id UUID NULL
stackup_name VARCHAR NOT NULL
stackup_version VARCHAR NOT NULL
layer_count INT NOT NULL
total_thickness JSONB NOT NULL
controlled_impedance BOOLEAN NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
artifact_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(stackup_name, stackup_version, artifact_hash)
```

## 73.6 `pcb_stackup_layers`

```text
id UUID PK
stackup_profile_id UUID NOT NULL
layer_order INT NOT NULL
layer_name VARCHAR NOT NULL
layer_type VARCHAR NOT NULL
material_name VARCHAR NULL
thickness JSONB NOT NULL
copper_thickness JSONB NULL
dielectric_constant JSONB NULL
loss_tangent JSONB NULL
roughness JSONB NULL
reference_role VARCHAR NULL
created_at TIMESTAMPTZ
UNIQUE(stackup_profile_id, layer_order)
```

## 73.7 `pcb_constraint_evidence_sources`

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
interface_scope JSONB NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.8 `pcb_constraint_evidence_fragments`

```text
id UUID PK
evidence_source_id UUID NOT NULL
fragment_type VARCHAR NOT NULL
locator JSONB NOT NULL
structured_content JSONB NOT NULL
content_hash CHAR(64) NOT NULL
extraction_method VARCHAR NOT NULL
extraction_confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.9 `pcb_constraint_context_versions`

```text
id UUID PK
constraint_job_id UUID NOT NULL
context_version VARCHAR NOT NULL
interfaces_count INT NOT NULL
signal_groups_count INT NOT NULL
power_rails_count INT NOT NULL
functional_blocks_count INT NOT NULL
isolation_boundaries_count INT NOT NULL
context_uri TEXT NOT NULL
context_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, context_version)
```

## 73.10 `pcb_constraint_net_roles`

```text
id UUID PK
constraint_job_id UUID NOT NULL
net_id UUID NOT NULL
role VARCHAR NOT NULL
role_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.11 `pcb_constraint_interfaces`

```text
id UUID PK
constraint_job_id UUID NOT NULL
interface_key VARCHAR NOT NULL
interface_type VARCHAR NOT NULL
controller_part_id UUID NULL
endpoint_part_ids JSONB NOT NULL
net_ids JSONB NOT NULL
pin_ids JSONB NOT NULL
configured_speed JSONB NULL
voltage_domains JSONB NOT NULL
topology VARCHAR NULL
external_exposure VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, interface_key)
```

## 73.12 `pcb_constraint_differential_pairs`

```text
id UUID PK
constraint_job_id UUID NOT NULL
interface_id UUID NULL
pair_key VARCHAR NOT NULL
positive_net_id UUID NOT NULL
negative_net_id UUID NOT NULL
source_endpoints JSONB NOT NULL
destination_endpoints JSONB NOT NULL
polarity_status VARCHAR NOT NULL
symmetry_status VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, pair_key)
```

## 73.13 `pcb_constraint_signal_groups`

```text
id UUID PK
constraint_job_id UUID NOT NULL
group_key VARCHAR NOT NULL
group_type VARCHAR NOT NULL
member_net_ids JSONB NOT NULL
reference_net_id UUID NULL
topology VARCHAR NULL
matching_metric VARCHAR NULL
timing_budget JSONB NULL
resolution_status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, group_key)
```

## 73.14 `pcb_constraint_intents`

```text
id UUID PK
constraint_job_id UUID NOT NULL
intent_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
qualitative_requirement TEXT NULL
numeric_candidates JSONB NOT NULL
source_priority INT NOT NULL
effectivity JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.15 `pcb_impedance_requirements`

```text
id UUID PK
constraint_job_id UUID NOT NULL
constraint_intent_id UUID NOT NULL
impedance_type VARCHAR NOT NULL
target_ohms NUMERIC NOT NULL
tolerance JSONB NOT NULL
frequency_scope JSONB NULL
layer_scope JSONB NOT NULL
reference_plane_requirement JSONB NOT NULL
mask_condition VARCHAR NULL
solver_requirement VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.16 `pcb_trace_geometry_candidates`

```text
id UUID PK
impedance_requirement_id UUID NOT NULL
stackup_profile_id UUID NOT NULL
fabrication_profile_id UUID NOT NULL
layer_name VARCHAR NOT NULL
trace_width JSONB NOT NULL
pair_gap JSONB NULL
copper_thickness JSONB NOT NULL
dielectric_height JSONB NOT NULL
mask_configuration JSONB NOT NULL
predicted_impedance JSONB NOT NULL
sensitivity JSONB NOT NULL
solver_name VARCHAR NOT NULL
solver_version VARCHAR NOT NULL
solver_input_hash CHAR(64) NOT NULL
solver_output_hash CHAR(64) NOT NULL
manufacturability_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.17 `pcb_current_requirements`

```text
id UUID PK
constraint_job_id UUID NOT NULL
scope_reference JSONB NOT NULL
continuous_current JSONB NULL
peak_current JSONB NULL
pulse_width JSONB NULL
duty_cycle JSONB NULL
allowed_temperature_rise JSONB NULL
allowed_voltage_drop JSONB NULL
trace_length JSONB NULL
ambient_conditions JSONB NOT NULL
source_type VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
resolution_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.18 `pcb_current_geometry_candidates`

```text
id UUID PK
current_requirement_id UUID NOT NULL
stackup_profile_id UUID NOT NULL
fabrication_profile_id UUID NOT NULL
layer_scope JSONB NOT NULL
minimum_thermal_width JSONB NULL
minimum_voltage_drop_width JSONB NULL
recommended_width JSONB NOT NULL
plane_recommendation JSONB NULL
via_requirement JSONB NULL
calculation_provider VARCHAR NOT NULL
provider_version VARCHAR NOT NULL
input_hash CHAR(64) NOT NULL
output_hash CHAR(64) NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.19 `pcb_timing_requirements`

```text
id UUID PK
constraint_job_id UUID NOT NULL
scope_reference JSONB NOT NULL
timing_type VARCHAR NOT NULL
physical_length_limits JSONB NULL
delay_limits JSONB NULL
skew_limits JSONB NULL
reference_member JSONB NULL
endpoint_definition JSONB NOT NULL
package_delay_policy JSONB NOT NULL
via_delay_policy JSONB NOT NULL
source_budget JSONB NOT NULL
evidence_ids JSONB NOT NULL
resolution_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.20 `pcb_topology_requirements`

```text
id UUID PK
constraint_job_id UUID NOT NULL
scope_reference JSONB NOT NULL
topology_type VARCHAR NOT NULL
source_endpoint JSONB NOT NULL
receiver_endpoints JSONB NOT NULL
branch_constraints JSONB NOT NULL
stub_constraints JSONB NOT NULL
termination_constraints JSONB NOT NULL
via_constraints JSONB NOT NULL
return_path_constraints JSONB NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.21 `pcb_placement_constraints`

```text
id UUID PK
constraint_job_id UUID NOT NULL
constraint_type VARCHAR NOT NULL
subject_reference JSONB NOT NULL
object_reference JSONB NULL
region_reference JSONB NULL
distance_limits JSONB NULL
orientation_limits JSONB NULL
side_limits JSONB NULL
sequence_constraints JSONB NULL
qualitative_only BOOLEAN NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.22 `pcb_rule_areas`

```text
id UUID PK
constraint_job_id UUID NOT NULL
area_key VARCHAR NOT NULL
area_type VARCHAR NOT NULL
geometry_status VARCHAR NOT NULL
geometry JSONB NULL
source_geometry_reference JSONB NULL
layer_scope JSONB NOT NULL
disallowed_objects JSONB NOT NULL
allowed_exceptions JSONB NOT NULL
evidence_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, area_key)
```

## 73.23 `pcb_high_voltage_profiles`

```text
id UUID PK
constraint_job_id UUID NOT NULL
profile_key VARCHAR NOT NULL
working_voltage JSONB NOT NULL
transient_voltage JSONB NULL
voltage_type VARCHAR NOT NULL
frequency_scope JSONB NULL
overvoltage_category VARCHAR NULL
pollution_degree VARCHAR NULL
material_group VARCHAR NULL
altitude JSONB NULL
coating JSONB NULL
insulation_type VARCHAR NOT NULL
applicable_standard JSONB NOT NULL
input_completeness_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, profile_key)
```

## 73.24 `pcb_isolation_boundaries`

```text
id UUID PK
constraint_job_id UUID NOT NULL
boundary_key VARCHAR NOT NULL
domain_a JSONB NOT NULL
domain_b JSONB NOT NULL
allowed_crossing_part_ids JSONB NOT NULL
clearance_requirement JSONB NULL
creepage_requirement JSONB NULL
slot_requirement JSONB NULL
layer_scope JSONB NOT NULL
test_voltage JSONB NULL
high_voltage_profile_id UUID NOT NULL
geometry_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, boundary_key)
```

## 73.25 `pcb_resolved_constraints`

```text
id UUID PK
constraint_job_id UUID NOT NULL
constraint_type VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
minimum_value JSONB NULL
optimal_value JSONB NULL
maximum_value JSONB NULL
qualitative_attributes JSONB NOT NULL
source_intent_ids JSONB NOT NULL
source_priority INT NOT NULL
specificity_score INT NOT NULL
effectivity JSONB NOT NULL
stackup_profile_id UUID NULL
fabrication_profile_id UUID NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.26 `pcb_constraint_conflicts`

```text
id UUID PK
constraint_job_id UUID NOT NULL
conflict_type VARCHAR NOT NULL
constraint_ids JSONB NOT NULL
scope_reference JSONB NOT NULL
description TEXT NOT NULL
conflicting_values JSONB NOT NULL
source_precedence_analysis JSONB NOT NULL
blocking BOOLEAN NOT NULL
resolution_options JSONB NOT NULL
status VARCHAR NOT NULL
resolved_by UUID NULL
resolved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 73.27 `pcb_constraint_effective_results`

```text
id UUID PK
constraint_job_id UUID NOT NULL
target_key VARCHAR NOT NULL
constraint_type VARCHAR NOT NULL
matching_constraint_ids JSONB NOT NULL
selected_constraint_id UUID NULL
shadowed_constraint_ids JSONB NOT NULL
effective_value JSONB NULL
evaluation_trace_uri TEXT NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, target_key, constraint_type)
```

## 73.28 `pcb_constraint_ir_versions`

```text
id UUID PK
constraint_job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
constraint_count INT NOT NULL
area_count INT NOT NULL
net_class_count INT NOT NULL
component_class_count INT NOT NULL
tuning_profile_count INT NOT NULL
conflict_count INT NOT NULL
constraint_ir_uri TEXT NOT NULL
constraint_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, ir_version)
```

## 73.29 `pcb_eda_rule_packages`

```text
id UUID PK
constraint_job_id UUID NOT NULL
constraint_ir_version_id UUID NOT NULL
eda_type VARCHAR NOT NULL
eda_version VARCHAR NOT NULL
adapter_version VARCHAR NOT NULL
base_project_revision VARCHAR NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
rule_count INT NOT NULL
syntax_status VARCHAR NOT NULL
coverage_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.30 `pcb_eda_generated_rules`

```text
id UUID PK
eda_rule_package_id UUID NOT NULL
canonical_constraint_ids JSONB NOT NULL
generated_rule_name VARCHAR NOT NULL
rule_type VARCHAR NOT NULL
rule_text TEXT NULL
structured_rule JSONB NOT NULL
priority_order INT NOT NULL
target_match_count INT NULL
shadow_count INT NULL
violation_count INT NULL
rule_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 73.31 `pcb_constraint_repair_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
constraint_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
plan_version INT NOT NULL
eda_rule_package_id UUID NOT NULL
selected_rule_ids JSONB NOT NULL
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
UNIQUE(constraint_job_id, plan_version)
```

## 73.32 `pcb_constraint_post_write_runs`

```text
id UUID PK
repair_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
pre_constraint_job_id UUID NOT NULL
post_constraint_job_id UUID NULL
rule_parse_status VARCHAR NOT NULL
coverage_summary JSONB NOT NULL
effective_constraint_diff JSONB NOT NULL
drc_summary JSONB NOT NULL
new_conflicts JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 73.33 `pcb_constraint_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
constraint_job_id UUID NULL
constraint_id UUID NULL
conflict_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
evidence_ids JSONB NOT NULL
effective_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 73.34 `pcb_constraint_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
constraint_ir_hash CHAR(64) NOT NULL
effective_result_hash CHAR(64) NOT NULL
eda_rule_package_hash CHAR(64) NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision)
```

## 73.35 `pcb_constraint_release_gate_runs`

```text
id UUID PK
constraint_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
unresolved_critical_count INT NOT NULL
conflict_count INT NOT NULL
zero_match_rule_count INT NOT NULL
drc_violation_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 73.36 `pcb_constraint_reports`

```text
id UUID PK
constraint_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
input_quality_status VARCHAR NOT NULL
stackup_status VARCHAR NOT NULL
fabrication_status VARCHAR NOT NULL
constraint_coverage NUMERIC NULL
eda_rule_coverage NUMERIC NULL
critical_conflict_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(constraint_job_id, report_version)
```

---

# 74. 对象存储

```text
derived/pcb-constraints/
  {tenant_id}/{project_id}/
    jobs/
      {constraint_job_id}/
        input/
          input-snapshot.json
          requirements.json
          source-ir-manifest.json
          fabrication-profile.json
          stackup-profile.json
        evidence/
          evidence-manifest.json
          fragments.jsonl.zst
          layout-figures/
        context/
          circuit-context.json
          net-roles.jsonl.zst
          interfaces.jsonl.zst
          differential-pairs.jsonl.zst
          signal-groups.jsonl.zst
          isolation-boundaries.jsonl.zst
        intents/
          constraint-intents.jsonl.zst
          unresolved.jsonl.zst
        calculations/
          impedance/
          current-width/
          via/
          timing/
          high-voltage/
        resolution/
          resolved-constraints.jsonl.zst
          conflicts.jsonl.zst
          effective-results.jsonl.zst
          traces/
        ir/
          pcb-constraint-ir.json
          constraint-manifest.json
        eda/
          kicad/
            net-classes.json
            component-classes.json
            tuning-profiles.json
            rule-areas.json
            generated.kicad_dru
            patch.json
          altium/
          easyeda/
        validation/
          syntax/
          coverage/
          drc/
          post-write/
        reports/
          pcb-constraint-report.html
          pcb-constraint-report.pdf
          constraint-matrix.csv
          unresolved-constraints.csv
          conflict-report.html
          rule-coverage.csv
          release-gate.json
        debug/
          evidence-trace.jsonl.zst
          calculation-trace.jsonl.zst
          effective-rule-trace.jsonl.zst
          resource-usage.json
```

---

# 75. API 设计

## 75.1 Jobs

```text
POST /api/v1/pcb-constraints/jobs
POST /api/v1/pcb-constraints/jobs/batch
GET  /api/v1/pcb-constraints/jobs/{id}
GET  /api/v1/pcb-constraints/jobs/{id}/events
POST /api/v1/pcb-constraints/jobs/{id}/cancel
POST /api/v1/pcb-constraints/jobs/{id}/retry
POST /api/v1/pcb-constraints/jobs/{id}/rerun
```

## 75.2 Profiles

```text
POST /api/v1/pcb-constraints/requirement-profiles
GET  /api/v1/pcb-constraints/requirement-profiles
GET  /api/v1/pcb-constraints/requirement-profiles/{id}
POST /api/v1/pcb-constraints/fabrication-profiles
GET  /api/v1/pcb-constraints/fabrication-profiles
GET  /api/v1/pcb-constraints/fabrication-profiles/{id}
POST /api/v1/pcb-constraints/stackup-profiles
GET  /api/v1/pcb-constraints/stackup-profiles
GET  /api/v1/pcb-constraints/stackup-profiles/{id}
```

## 75.3 Context

```text
GET /api/v1/pcb-constraints/jobs/{id}/context
GET /api/v1/pcb-constraints/jobs/{id}/interfaces
GET /api/v1/pcb-constraints/jobs/{id}/differential-pairs
GET /api/v1/pcb-constraints/jobs/{id}/signal-groups
GET /api/v1/pcb-constraints/jobs/{id}/power-rails
GET /api/v1/pcb-constraints/jobs/{id}/isolation-boundaries
```

## 75.4 Evidence and Intents

```text
GET  /api/v1/pcb-constraints/jobs/{id}/evidence
GET  /api/v1/pcb-constraints/evidence/{id}
POST /api/v1/pcb-constraints/jobs/{id}/extract-intents
GET  /api/v1/pcb-constraints/jobs/{id}/intents
GET  /api/v1/pcb-constraints/intents/{id}
POST /api/v1/pcb-constraints/intents/{id}/review
```

## 75.5 Solvers

```text
POST /api/v1/pcb-constraints/jobs/{id}/solve-impedance
POST /api/v1/pcb-constraints/jobs/{id}/solve-current-width
POST /api/v1/pcb-constraints/jobs/{id}/solve-timing
POST /api/v1/pcb-constraints/jobs/{id}/solve-high-voltage
GET  /api/v1/pcb-constraints/jobs/{id}/calculations
GET  /api/v1/pcb-constraints/calculations/{id}/trace
```

## 75.6 Resolution

```text
POST /api/v1/pcb-constraints/jobs/{id}/resolve
GET  /api/v1/pcb-constraints/jobs/{id}/resolved
GET  /api/v1/pcb-constraints/jobs/{id}/effective
GET  /api/v1/pcb-constraints/jobs/{id}/conflicts
POST /api/v1/pcb-constraints/conflicts/{id}/resolve
POST /api/v1/pcb-constraints/conflicts/{id}/waive
```

## 75.7 Constraint IR and EDA

```text
POST /api/v1/pcb-constraints/jobs/{id}/build-ir
GET  /api/v1/pcb-constraints/jobs/{id}/constraint-ir
POST /api/v1/pcb-constraints/jobs/{id}/generate-eda-package
GET  /api/v1/pcb-constraints/jobs/{id}/eda-packages
GET  /api/v1/pcb-constraints/eda-packages/{id}
POST /api/v1/pcb-constraints/eda-packages/{id}/validate-syntax
POST /api/v1/pcb-constraints/eda-packages/{id}/validate-coverage
```

## 75.8 Agent 19

```text
POST /api/v1/pcb-constraints/eda-packages/{id}/repair-plan
GET  /api/v1/pcb-constraints/repair-plans/{id}
POST /api/v1/pcb-constraints/repair-plans/{id}/preview
POST /api/v1/pcb-constraints/repair-plans/{id}/approve
POST /api/v1/pcb-constraints/repair-plans/{id}/submit-to-agent19
GET  /api/v1/pcb-constraints/post-write-runs/{id}
```

## 75.9 Baseline、Gate 和 Reports

```text
POST /api/v1/pcb-constraints/jobs/{id}/baseline
POST /api/v1/pcb-constraints/jobs/{id}/compare-baseline
POST /api/v1/pcb-constraints/jobs/{id}/run-release-gate
GET  /api/v1/pcb-constraints/jobs/{id}/release-gate
GET  /api/v1/pcb-constraints/jobs/{id}/report
GET  /api/v1/pcb-constraints/jobs/{id}/constraint-matrix.csv
GET  /api/v1/pcb-constraints/jobs/{id}/rule-coverage.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 76. 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.configuration.ready
schematic-review.completed
simulation.completed
kicad.project-revision.ready
pcb.requirement-profile.approved
pcb.fabrication-profile.approved
pcb.stackup-profile.approved
pcb.constraint-extraction.requested
```

---

# 77. 输出事件

```text
pcb-constraints.input-blocked
pcb-constraints.interface-review-required
pcb-constraints.differential-pair-review-required
pcb-constraints.stackup-required
pcb-constraints.fabrication-profile-required
pcb-constraints.high-voltage-context-required
pcb-constraints.conflict-detected
pcb-constraints.constraint-ir-ready
pcb-constraints.eda-package-ready
pcb-constraints.rule-coverage-failed
pcb-constraints.release-gate-blocked
pcb-constraints.completed
pcb-constraints.completed-with-candidates
pcb-constraints.failed
```

## `pcb-constraints.constraint-ir-ready`

```json
{
  "event_type": "pcb-constraints.constraint-ir-ready",
  "event_version": "1.0",
  "constraint_job_id": "uuid",
  "project_id": "uuid",
  "project_revision": "sha",
  "constraint_ir_hash": "sha256",
  "summary": {
    "differential_pairs": 6,
    "controlled_impedance_nets": 14,
    "matched_groups": 3,
    "high_current_nets": 8,
    "rule_areas": 5,
    "unresolved_conflicts": 2
  },
  "report_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 78. Policy 和配置

```text
policies/
├── pcb-constraint-extraction-1.0.0.yaml
├── input-gates.yaml
├── context/
│   ├── net-roles.yaml
│   ├── interfaces.yaml
│   ├── differential-pairs.yaml
│   └── signal-groups.yaml
├── extraction/
│   ├── language-patterns.yaml
│   ├── tables.yaml
│   ├── figures.yaml
│   ├── required-recommended-example.yaml
│   └── evidence-thresholds.yaml
├── impedance/
│   ├── solver-admission.yaml
│   ├── tolerance.yaml
│   ├── layer-selection.yaml
│   └── manufacturability.yaml
├── current/
│   ├── provider-admission.yaml
│   ├── temperature-rise.yaml
│   ├── voltage-drop.yaml
│   ├── pulses.yaml
│   └── vias.yaml
├── timing/
│   ├── length-delay.yaml
│   ├── skew.yaml
│   ├── topology.yaml
│   ├── stubs.yaml
│   └── return-path.yaml
├── placement/
│   ├── proximity.yaml
│   ├── regions.yaml
│   ├── keepouts.yaml
│   └── layout-guidelines.yaml
├── high-voltage/
│   ├── providers.yaml
│   ├── environment.yaml
│   ├── insulation.yaml
│   └── safety-gates.yaml
├── resolution/
│   ├── source-precedence.yaml
│   ├── specificity.yaml
│   ├── merging.yaml
│   └── conflicts.yaml
├── eda/
│   ├── kicad.yaml
│   ├── altium.yaml
│   └── easyeda.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 79. 规则引擎

要求：

- JSON/YAML Schema；
- Rule ID 和 Version；
- Scope；
- Priority；
- Specificity；
- Effectivity；
- Source Precedence；
- Min/Opt/Max；
- Conflict Detection；
- Dry Run；
- Explanation Trace；
- 禁止任意代码执行。

---

# 80. 单位和计算引擎

支持：

```text
长度
面积
铜厚
阻抗
电压
电流
功率
频率
时间
传播时延
温度
介电常数
损耗角
海拔
```

要求：

- Decimal；
- 显式单位；
- 条件；
- 范围；
- 公差；
- 不确定度；
- Provider Version；
- Calculation Trace；
- 不静默单位转换。

---

# 81. Solver Provider

统一接口：

```python
class ConstraintSolverProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_input(self, request) -> ValidationResult: ...
    async def solve(self, request) -> SolverResult: ...
    async def explain(self, result) -> CalculationTrace: ...
```

类型：

```text
impedance
current_width
via_current
timing_delay
high_voltage
geometry
```

---

# 82. Impedance Solver Admission

需要保存：

```text
solver name/version
supported geometry
frequency model
mask support
copper roughness support
differential support
validation fixtures
license
approval status
```

---

# 83. Manufacturer Adapter

制造商能力 Adapter 提供：

```text
可选 Stack-up
材料
Dk/Df
线宽间距
铜厚
Via
阻抗公差
特殊工艺
标准交期/成本等级
```

它不直接覆盖工程约束，而是参与可制造性求解。

---

# 84. Fabrication Conflict

处理：

```text
保持约束，升级工艺
调整 Stack-up
调整层分配
接受局部 Neck-down
请求制造商工程审核
修改产品要求，需审批
```

禁止自动降低安全或信号完整性约束。

---

# 85. Interface Rule Registry

首批支持：

```text
USB 2.0
USB 3.x candidate
CAN / CAN-FD
RS-485
Ethernet 10/100/1000 candidate
LVDS
I2C
SPI/QSPI/OSPI
SDIO/SDMMC
I2S/SAI
MIPI candidate
HDMI candidate
DDR/SDRAM candidate
ADC/DAC parallel/serial
RF 50Ω
```

“支持”分为：

```text
recognition
intent extraction
numeric rule generation
EDA enforcement
validated benchmark
```

---

# 86. 产品 Profile

例如：

```text
maker prototype
consumer indoor
industrial
automotive candidate
medical candidate
mains-powered
battery low-voltage
RF product
high-speed digital
precision analog
```

Profile 决定规则适用范围，但不能替代具体认证标准。

---

# 87. Constraint Workbench

界面建议：

```text
左：接口、网络组、功能块和约束树
中：原理图/PCB/Stack-up 可视化
右：证据、计算、冲突和 EDA 映射
下：生成规则、覆盖、DRC、Diff 和审批
```

---

# 88. Review 操作

```text
确认接口
配对 P/N
选择 Stack-up
选择制造商
确认电流/温升/压降
确认长度或时延预算
确认拓扑
量化“靠近/远离”
绘制或确认 Rule Area
补充高压环境
解决冲突
批准规则包
```

---

# 89. 增量提取

变化键：

```text
project revision
netlist hash
part/pin identity
firmware config
review finding
simulation result
requirement profile
stackup
fabrication profile
evidence
policy
```

只重跑受影响：

```text
interface
net group
functional block
constraint type
EDA rule
```

---

# 90. Cache Key

```text
local circuit subgraph hash
interface context hash
evidence hash
stackup hash
fabrication profile hash
solver version
policy version
```

---

# 91. CI 模式

命令建议：

```text
pcb-constraints extract --project .
pcb-constraints validate-ir --project .
pcb-constraints validate-kicad-rules --project .
pcb-constraints compare-baseline --baseline main
pcb-constraints gate --profile routing-start
```

退出码：

```text
0 pass
1 candidates/warnings
2 conflicts/gate blocked
3 input/security/internal failure
```

---

# 92. 可观测性

```text
pcb_constraint_jobs_total{status,profile}
pcb_constraint_duration_seconds{step}
pcb_constraint_interfaces_total{type,status}
pcb_constraint_diff_pairs_total{status}
pcb_constraint_intents_total{type,status}
pcb_constraint_resolved_total{type,status}
pcb_constraint_conflicts_total{type,blocking}
pcb_constraint_solver_runs_total{type,provider,status}
pcb_constraint_solver_duration_seconds{type,provider}
pcb_constraint_rule_packages_total{eda,status}
pcb_constraint_rule_zero_match_total{eda}
pcb_constraint_rule_shadow_total{eda}
pcb_constraint_drc_violations_total{type,severity}
pcb_constraint_release_gate_blocks_total{reason}
```

---

# 93. Dashboard

```text
Projects
Input Quality
Interfaces
Differential Pairs
Impedance
Current/Width/Via
Length/Delay/Skew
Topologies
Return Paths
Placement/Keepouts
High Voltage
Stack-up/Fabrication
Conflicts
EDA Rule Coverage
DRC
Release Readiness
```

---

# 94. Benchmark

## Input and Context

```text
Reviewed Netlist
Candidate Netlist
Pin-Pad Block
Firmware Speed
Simulation Edge
Datasheet Evidence
Requirement Profile
```

## Interfaces

```text
USB
CAN
RS-485
Ethernet
LVDS
SPI
SDIO
DDR candidate
RF
unknown high-speed
```

## Differential Pair

```text
explicit
suffix-only candidate
wrong polarity
different endpoints
asymmetric protection
unpaired
```

## Stack-up/Impedance

```text
fixed stackup
candidate stackup
unknown Dk
different layers
mask
manufacturing conflict
solver unavailable
```

## Current/Width

```text
continuous
pulse
voltage drop
internal/external
multiple vias
plane
unknown current
```

## Timing

```text
physical length
delay
skew
matched group
package delay
via delay
stub
topology
```

## Placement/Keepout

```text
decoupling
crystal
switch node
antenna
connector protection
mechanical
qualitative-only
figure with dimensions
```

## High Voltage

```text
clearance
creepage
altitude
pollution
material
coating
basic/reinforced
missing context
```

## EDA

```text
net class
component class
tuning profile
rule area
custom rule
priority
zero match
shadow
DRC
rollback
```

---

# 95. 初始质量目标

```text
Raw Evidence Preservation = 100%
Constraint Source Trace Coverage = 100%
Unreviewed Suffix-only Differential Pair Auto-release = 0
Unknown Stack-up Exact Impedance Geometry Release = 0
Physical Length Misrepresented as Delay = 0
Unknown Current Invented Value = 0
Safety Spacing Auto-reduction = 0
High-voltage Rule without Complete Context Release = 0
Generated EDA Rule Syntax Validation Coverage = 100%
Generated Rule Target Coverage Check = 100%
Zero-match Rule Silent Acceptance = 0
Unexpected Existing-rule Override = 0
Agent 19 Readback Coverage = 100%
Post-write DRC Coverage = 100%
Constraint IR Determinism = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 96. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Inputs

1. Agent 18 Reviewed；
2. Candidate；
3. Agent 20 Block；
4. Agent 21 USB Speed；
5. Agent 22 HV Finding；
6. Agent 23 Edge Rate；
7. Missing Requirement；
8. Missing Stack-up；
9. Missing Fab Profile；
10. Exact Revision。

## Interfaces and Pairs

11. USB Pair；
12. CAN Pair；
13. LVDS Pair；
14. Suffix Candidate；
15. Wrong Polarity；
16. Endpoint Conflict；
17. Asymmetric ESD；
18. Unpaired Net；
19. Clock；
20. RF Net。

## Impedance/Stack-up

21. 50Ω Microstrip；
22. 50Ω Stripline；
23. 90Ω Differential；
24. Different Layers；
25. Mask Effect；
26. Dk Condition；
27. Copper Thickness；
28. Fab Min Conflict；
29. Tolerance；
30. Solver Failure。

## Current/Via

31. 100mA；
32. 2A Continuous；
33. Pulse；
34. Voltage-drop Limited；
35. Internal Layer；
36. External Layer；
37. Parallel Plane；
38. Single Via Bottleneck；
39. Multiple Via；
40. Unknown Ambient。

## Timing/Topology

41. Absolute Length；
42. Pair Skew；
43. Group Match；
44. Delay Profile；
45. Layer Change；
46. Via Delay；
47. Max Via Count；
48. Stub；
49. Fly-by；
50. Star Conflict。

## Placement/Keepout

51. Decoupling Near；
52. Crystal；
53. Switch Node；
54. Feedback Far；
55. Antenna Keepout；
56. ESD Near Connector；
57. Mounting Hole；
58. Rule Area；
59. Qualitative Only；
60. Figure without Scale。

## High Voltage

61. Clearance；
62. Creepage；
63. Working/Transient；
64. Altitude；
65. Pollution；
66. Material Group；
67. Coating；
68. Reinforced；
69. Missing Context；
70. Slot Candidate。

## EDA/Workflow

71. Net Class；
72. Component Class；
73. Tuning Profile；
74. `.kicad_dru`；
75. Rule Priority；
76. Zero Match；
77. Shadow；
78. Syntax Error；
79. Agent 19 Preview；
80. Agent 19 Execute；
81. Readback；
82. DRC Pass；
83. DRC Regression；
84. Rollback；
85. Baseline；
86. Waiver；
87. Constraint Diff；
88. KiCad 9；
89. KiCad 10；
90. Altium Adapter Candidate。

## Security/Scale

91. Path Traversal；
92. Malicious Rule Text；
93. Unapproved Solver；
94. NDA Stack-up Isolation；
95. External Model Block；
96. Tenant Isolation；
97. 10k Nets；
98. 5k Constraints；
99. Batch 100 Projects；
100. Audit Replay。

---

# 97. 性能要求

常规项目：

```text
500 parts
300 nets
20 interfaces/groups
500 constraint intents
```

目标：

```text
Context Build P95 < 10 s
Intent Extraction P95 < 20 s excluding document parsing
Constraint Resolution P95 < 15 s
EDA Rule Generation P95 < 5 s
Interactive Query P95 < 300 ms
Incremental Update P95 < 10 s
```

大型项目：

```text
10,000 parts
10,000 nets
5,000+ constraints
```

要求：

- 按接口和功能块分区；
- Rule Scope Index；
- Constraint Cache；
- Solver Cache；
- 并行独立求解；
- JSONL/Parquet；
- Incremental Invalidation；
- 可取消和恢复；
- 不把完整工程发给模型。

---

# 98. 安全与权限

- 工程、Stack-up、制造能力、客户规范和约束按租户/项目隔离；
- NDA Stack-up 使用最小访问和短期签名 URL；
- Evidence、Solver、Rule Provider 需要 Hash、版本、许可和批准状态；
- Rule DSL 和计算 Provider 禁止任意代码执行；
- EDA Rule Text 由受控 Serializer 生成；
- 不接受 AI 直接输出原始 `.kicad_dru` 后写入；
- Agent 19写入权限与约束审核权限分开；
- 高压、安全、Stack-up 修改支持双人审批；
- 不自动访问任意 URL；
- 不执行 PDF、压缩包、制造商文件中的脚本；
- Solver Worker 限制 CPU、内存、磁盘和网络；
- 私有工程和 Stack-up 不发送外部模型；
- 公开 Fixture 不使用客户工程和 NDA 制造数据；
- Waiver、Baseline、Constraint Manifest、Release Gate 不可硬删除；
- 报告隐藏本机路径、供应商 Credential 和合同价格；
- 不在本 Agent 存储制造商 API Secret。

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

规则和求解：

```text
JSON Schema
YAML
Decimal
Pint-like unit engine
OR-Tools optional
approved impedance solver adapters
approved current/thermal providers
```

数据：

```text
Polars
PyArrow
DuckDB
```

图：

```text
custom adjacency graph
NetworkX only for fixtures/small graphs
```

前端：

```text
React
TypeScript
Canvas/SVG
PCB/Stack-up Viewer
```

AI：

```text
local/private model optional
structured extraction
approved-evidence RAG
candidate-only
```

---

# 100. 推荐仓库结构

```text
pcb-constraint-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── pcb-constraint-agent-spec.md
│   ├── input-and-evidence-gates.md
│   ├── pcb-constraint-ir.md
│   ├── circuit-context-and-net-roles.md
│   ├── interface-and-differential-pair-recognition.md
│   ├── stackup-and-fabrication-profiles.md
│   ├── impedance-resolution.md
│   ├── current-width-via-resolution.md
│   ├── length-delay-skew.md
│   ├── topology-and-return-path.md
│   ├── placement-and-keepouts.md
│   ├── high-voltage-clearance-creepage.md
│   ├── constraint-resolution-and-conflicts.md
│   ├── kicad-rule-generation.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-evidence-intent-resolved-and-eda-rules-separated.md
│       ├── 0002-net-names-are-not-authoritative.md
│       ├── 0003-impedance-requires-stackup.md
│       ├── 0004-delay-and-physical-length-are-separated.md
│       ├── 0005-high-voltage-rules-are-profile-driven.md
│       ├── 0006-generated-rules-require-coverage-readback.md
│       └── 0007-writes-run-through-agent19.md
├── src/
│   └── pcb_constraints/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── input.py
│       │   ├── context.py
│       │   ├── evidence.py
│       │   ├── intent.py
│       │   ├── stackup.py
│       │   ├── fabrication.py
│       │   ├── constraint.py
│       │   ├── conflict.py
│       │   ├── eda.py
│       │   └── release.py
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   ├── agent22.py
│       │   └── agent23.py
│       ├── context/
│       │   ├── parts.py
│       │   ├── pins.py
│       │   ├── nets.py
│       │   ├── roles.py
│       │   ├── interfaces.py
│       │   ├── differential_pairs.py
│       │   ├── signal_groups.py
│       │   ├── power.py
│       │   └── isolation.py
│       ├── evidence/
│       │   ├── registry.py
│       │   ├── datasheets.py
│       │   ├── tables.py
│       │   ├── figures.py
│       │   ├── requirements.py
│       │   ├── references.py
│       │   ├── anchors.py
│       │   └── snapshots.py
│       ├── extraction/
│       │   ├── language.py
│       │   ├── directives.py
│       │   ├── interface_rules.py
│       │   ├── layout_guidelines.py
│       │   ├── intents.py
│       │   └── confidence.py
│       ├── stackup/
│       │   ├── profiles.py
│       │   ├── layers.py
│       │   ├── candidates.py
│       │   ├── delays.py
│       │   ├── validation.py
│       │   └── manufacturers.py
│       ├── solvers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── admission.py
│       │   ├── impedance.py
│       │   ├── current_width.py
│       │   ├── vias.py
│       │   ├── timing.py
│       │   ├── high_voltage.py
│       │   └── trace.py
│       ├── constraints/
│       │   ├── impedance.py
│       │   ├── current.py
│       │   ├── timing.py
│       │   ├── topology.py
│       │   ├── return_path.py
│       │   ├── placement.py
│       │   ├── keepouts.py
│       │   ├── high_voltage.py
│       │   └── assertions.py
│       ├── resolution/
│       │   ├── precedence.py
│       │   ├── specificity.py
│       │   ├── merging.py
│       │   ├── conflicts.py
│       │   ├── effective.py
│       │   └── trace.py
│       ├── ir/
│       │   ├── builder.py
│       │   ├── validation.py
│       │   ├── serialization.py
│       │   └── manifest.py
│       ├── eda/
│       │   ├── base.py
│       │   ├── kicad/
│       │   │   ├── netclasses.py
│       │   │   ├── component_classes.py
│       │   │   ├── tuning_profiles.py
│       │   │   ├── rule_areas.py
│       │   │   ├── custom_rules.py
│       │   │   ├── priority.py
│       │   │   ├── serializer.py
│       │   │   ├── syntax.py
│       │   │   └── coverage.py
│       │   ├── altium.py
│       │   └── easyeda.py
│       ├── repairs/
│       │   ├── plans.py
│       │   ├── risk.py
│       │   ├── agent19.py
│       │   └── verification.py
│       ├── review/
│       │   ├── queue.py
│       │   ├── decisions.py
│       │   ├── waivers.py
│       │   ├── baselines.py
│       │   └── audit.py
│       ├── release/
│       │   ├── gates.py
│       │   ├── profiles.py
│       │   └── reports.py
│       ├── ai/
│       │   ├── extraction.py
│       │   ├── explanation.py
│       │   ├── schemas.py
│       │   └── guardrails.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── interface-rules/
├── requirement-profiles/
├── fabrication-profiles/
├── stackup-profiles/
├── solver-profiles/
├── eda-adapters/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_constraint_readiness.py
    ├── build_pcb_constraint_context.py
    ├── extract_constraint_intents.py
    ├── solve_impedance_constraints.py
    ├── solve_current_constraints.py
    ├── solve_timing_constraints.py
    ├── solve_high_voltage_constraints.py
    ├── build_pcb_constraint_ir.py
    ├── generate_kicad_rules.py
    ├── validate_rule_coverage.py
    ├── submit_rules_to_agent19.py
    └── run_pcb_constraint_benchmark.py
```

---

# 101. 技术资料参考

实施时应重新核验目标版本、规则语法、适用标准和许可证：

```text
KiCad PCB Editor 10.0
https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html

KiCad Board File Format
https://dev-docs.kicad.org/en/file-formats/sexpr-pcb/

KiCad Import Formats
https://dev-docs.kicad.org/en/import-formats/

IEC 60664-1
https://webstore.iec.ch/en/publication/107319
```


---

# 102. Codex 分阶段实施

不要让 Codex 一次实现所有接口标准、阻抗求解器、电流热模型、高压标准、EDA 适配器、图像约束提取和自动写入。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16、18、19、20、21、22、23 的真实实现和数据契约；
2. 当前 Project/Schematic/PCB/Part/Pin/Net IR；
3. 当前 PCB Stack-up、Board Setup、Net Class 和 Component Class；
4. 当前 `.kicad_dru` Parser、Serializer 和 Custom Rule；
5. 当前 Rule Area、Keepout 和 Tuning Profile；
6. 当前 KiCad 9、10 的规则支持差异；
7. 当前 Altium、EasyEDA/JLCEDA 工程约束解析；
8. 当前接口识别、差分对和网络分类；
9. 当前 Firmware Speed、Clock、Bus 和 Memory 配置；
10. 当前 Agent 22 的电源、高压、敏感网络和布局建议；
11. 当前 Agent 23 的边沿、带宽、负载、噪声和敏感节点结果；
12. 当前器件数据手册和 Layout Guideline 提取；
13. 当前 Reference Layout 图像和尺寸解析；
14. 当前 Stack-up 和 PCB 工厂能力数据库；
15. 当前阻抗计算器、场求解器和制造商接口；
16. 当前电流、线宽、温升、压降和 Via 计算；
17. 当前长度、Skew、Delay、Topology 和 Return Path；
18. 当前高压 Clearance/Creepage 规则；
19. 当前 Rule Priority、Coverage、DRC 和 Shadow 检测；
20. 当前 Agent 19 Rule Write、Readback 和 Rollback；
21. 当前 Review UI、Constraint Matrix 和 Stack-up Viewer；
22. 当前 Queue、Worker、Database、Object Storage 和 Security；
23. 当前开源、合成、脱敏或授权 Fixture；
24. 统计已支持约束类型和 EDA 映射；
25. 统计 Zero-match、Shadow、Conflict 和 DRC 回归；
26. 统计接口/Stack-up/制造能力覆盖；
27. 只运行只读扫描和版本探测；
28. 不修改 EDA 工程；
29. 不生成并写入生产 `.kicad_dru`；
30. 不访问 NDA 制造商数据；
31. 不调用外部模型；
32. 不创建 Migration；
33. 不安装求解器；
34. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Constraint Job；
- Input Snapshot；
- Requirement Profile；
- Fabrication Profile；
- Stack-up；
- Evidence；
- Context；
- Net Role；
- Interface；
- Differential Pair；
- Signal Group；
- Intent；
- Impedance；
- Current/Width；
- Timing；
- Topology；
- Placement；
- Rule Area；
- High Voltage；
- Resolved Constraint；
- Conflict；
- Effective Result；
- Constraint IR；
- EDA Package；
- JSON Schema。

## Phase 2：Agent 16/18/20/21/22/23 Input Gate

实现：

- Schema Validation；
- Project Revision；
- Netlist Release；
- Pin-Pad Gate；
- Firmware Configuration；
- Review Findings；
- Simulation Conditions；
- Requirement Profile；
- Stack-up/Fab Snapshot；
- Blocked/Candidate/Resolved；
- Diagnostics。

## Phase 3：Circuit Context 和 Net Role

实现：

- Parts/Pins/Nets；
- Functional Blocks；
- Power Rails；
- Voltage Domains；
- External Connectors；
- Sensitive/Aggressor；
- Isolation Domains；
- Stable Hash；
- Evidence；
- Incremental Invalidation。

## Phase 4：Interface 和 Differential Pair Recognition

实现：

- Pin Function；
- Endpoint；
- EDA Directive；
- Suffix Candidate；
- Firmware Peripheral；
- Rule Registry；
- Polarity；
- Symmetry；
- Pair Status；
- Review Queue；
- Golden Tests。

## Phase 5：Signal Group 和 Topology Recognition

实现：

- Clock/Strobe/Data；
- Address/Command；
- Reset/CS；
- Point-to-point；
- Multi-drop；
- Star；
- Daisy-chain；
- Fly-by；
- Stub Candidate；
- Source/Receiver；
- Group Membership；
- Evidence。

## Phase 6：Evidence Registry 和 Anchoring

实现：

- Datasheet；
- Layout Guide；
- Table/Figure；
- Application Note；
- Reference Design；
- Requirement；
- Standard；
- Manufacturer Profile；
- Hash/Page/Section/Region；
- Approval；
- Snapshot；
- No External Execution。

## Phase 7：Constraint Intent Extractor

实现：

- Required/Recommended/Example；
- Qualitative/Numeric；
- Min/Typ/Max；
- Layer/Net/Part/Area Scope；
- Effectivity；
- Evidence；
- Confidence；
- Candidate-only AI Extraction；
- Human Review。

## Phase 8：Requirement、Fabrication 和 Stack-up Profiles

实现：

- Product/Environment/Safety；
- Manufacturer Capability；
- Stack-up Layers；
- Dk/Df Conditions；
- Copper/Mask；
- Via Capability；
- Impedance Tolerance；
- Profile Hash/Version；
- Approval；
- Validity Period。

## Phase 9：Constraint Rule Engine

实现：

- Rule Schema；
- Source Precedence；
- Priority；
- Specificity；
- Effectivity；
- Min/Opt/Max；
- Merge；
- Shadow；
- Conflict；
- Explain Trace；
- No Arbitrary Code。

## Phase 10：Impedance Requirement 和 Solver Registry

实现：

- Single/Differential；
- Frequency；
- Reference Plane；
- Layer Scope；
- Mask；
- Solver Capability；
- Admission；
- Candidate Geometry；
- Sensitivity；
- Manufacturing Check；
- Trace。

## Phase 11：Current、Width、Voltage-drop 和 Via Planner

实现：

- Continuous/Peak/Pulse；
- Duty；
- Ambient；
- Temperature Rise；
- Voltage Drop；
- Layer/Copper；
- Trace Length；
- Plane；
- Via Count；
- Provider Registry；
- Confidence；
- No Invented Current。

## Phase 12：Length、Delay 和 Skew Model

实现：

- Physical Length；
- Propagation Delay；
- Per-layer Delay；
- Package/Via/Connector Delay；
- Absolute Length；
- Matched Group；
- Intra-pair Skew；
- Group Skew；
- Endpoint Definition；
- Tuning Profile Candidate。

## Phase 13：Topology、Stub 和 Return-path Rules

实现：

- Point-to-point/Multi-drop/Fly-by；
- Branch；
- Max Stub；
- Via Count；
- Uncoupled Length；
- Continuous Plane；
- Split Crossing；
- Return Via；
- Layer Transition；
- Evidence；
- EDA Mapping。

## Phase 14：Placement Constraint Model

实现：

- Near/Far；
- Min/Max Distance；
- Group；
- Orientation；
- Side；
- Sequence；
- Region；
- Qualitative-only；
- Quantification Workflow；
- Source Map；
- Review。

## Phase 15：Keepout 和 Rule Area Geometry

实现：

- Track/Via/Copper/Footprint；
- Layer Scope；
- Antenna；
- Crystal；
- Switch Node；
- ESD/Connector；
- Mechanical；
- Source Figure；
- Dimensions；
- Geometry Confidence；
- No Scale Guessing。

## Phase 16：High-voltage Context 和 Provider

实现：

- Working/Transient Voltage；
- AC/DC/Frequency；
- Overvoltage Category；
- Pollution；
- Material Group；
- Altitude；
- Coating；
- Insulation Type；
- Applicable Standard；
- Context Completeness；
- Provider Version；
- Manual Review。

## Phase 17：Clearance、Creepage 和 Isolation Boundary

实现：

- Separate Clearance/Creepage；
- Domain A/B；
- Allowed Crossing；
- Layer Scope；
- Slot/Cutout；
- Copper-to-edge；
- Board Surface；
- Test Voltage；
- Conflict；
- Safety Gate；
- No Generic Hardcoded Table。

## Phase 18：Constraint Resolution 和 Effective Result

实现：

- All Matching Rules；
- Precedence；
- Specificity；
- Range Intersection；
- Aggregate；
- Selected；
- Shadowed；
- Empty Range Conflict；
- Effective Trace；
- Determinism。

## Phase 19：Canonical PCB Constraint IR

实现：

- Versioned IR；
- Net/Component Classes；
- Constraints；
- Areas；
- Tuning Profiles；
- Stack-up/Fab；
- Conflicts；
- Coverage；
- Provenance；
- Schema Validation；
- Stable Serialization。

## Phase 20：KiCad Net Class 和 Component Class Adapter

实现：

- Net Class Plan；
- Assignments；
- Multiple Classes；
- Priority；
- Component Class；
- Schematic/PCB Scope；
- Existing Class Merge；
- No Silent Overwrite；
- Readback Model。

## Phase 21：KiCad Tuning Profile 和 Board Setup Adapter

实现：

- Per-layer Geometry；
- Delay；
- Via Delay；
- Differential Gap；
- Global Min Constraints；
- Stack-up Patch；
- Text Variables；
- Version Capability；
- Preview。

## Phase 22：KiCad Rule Area 和 Keepout Adapter

实现：

- Area Geometry；
- Layer；
- Disallow；
- Placement；
- Existing Area Merge；
- Stable IDs；
- Source Map；
- Agent 19 Operations；
- Readback。

## Phase 23：KiCad `.kicad_dru` Generator

实现：

- Structured AST；
- Condition Builder；
- Constraint Clauses；
- Layer/Severity；
- Rule Order；
- Comments/Canonical IDs；
- Syntax Validation；
- Deterministic Serializer；
- No AI Raw Text Write。

## Phase 24：Rule Priority、Coverage 和 Shadow Simulator

实现：

- Effective Rule Evaluation；
- Match Count；
- Zero Match；
- Shadow；
- Existing Rule Interaction；
- Text Variable Resolution；
- Versioned Semantics；
- Coverage Report；
- Contract Tests。

## Phase 25：Agent 19 Integration

实现：

- EDA Package → Canonical Change Plan；
- Workspace；
- Snapshot；
- Preview；
- Approval；
- Execution；
- Readback；
- Retry/Idempotency；
- Rollback；
- Audit。

## Phase 26：Post-write Verification 和 DRC

实现：

- Agent 16 Reparse；
- Rule Parse；
- Rule Match；
- Effective Constraint Diff；
- DRC；
- New Violation；
- Existing Rule Regression；
- Stack-up Diff；
- Commit/Rollback Recommendation。

## Phase 27：Altium Adapter

实现：

- Canonical Constraint Mapping；
- Differential Pair；
- Net Class；
- Width/Gap；
- Length/Matched Length；
- Room/Keepout；
- Rule Priority；
- Unsupported Mapping；
- Export-only before Write。

## Phase 28：EasyEDA/JLCEDA Adapter，可选

实现：

- Capability Discovery；
- Supported Constraint Mapping；
- Export；
- Unsupported Preservation；
- No Silent Constraint Loss；
- Contract Tests。

## Phase 29：Review Workbench

实现：

- Interface/Net Group；
- Evidence；
- Stack-up；
- Impedance Geometry；
- Current/Via；
- Length/Delay；
- Placement/Area；
- High Voltage；
- Conflicts；
- Generated Rules；
- Coverage/DRC；
- Approval。

## Phase 30：Baseline、Waiver、CI 和 Release Gate

实现：

- Constraint Baseline；
- New/Worsened/Resolved；
- Waiver Scope/Expiry；
- CLI；
- Gate Profiles；
- Git Integration；
- Immutable Manifest；
- Events；
- Exit Codes。

## Phase 31：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- JSONL/Parquet；
- Pagination；
- Permissions；
- Audit；
- Metrics。

## Phase 32：Benchmark、监控和生产发布

实现：

- KiCad 9/10；
- Interface Matrix；
- Stack-up/Solver；
- Current/Timing；
- High Voltage；
- EDA Rules；
- Coverage；
- DRC；
- Security；
- Performance；
- Feature Flags；
- Provider Rollback；
- Disaster Recovery。

## Phase 33：高级布局相关提取，可选

稳定后：

- Reference Layout Geometric Matching；
- PCB Parasitic Feedback；
- SI/PI Tool Handoff；
- Antenna/EMC Zones；
- Multi-board Connector Timing；
- Flex/Rigid-flex Profiles；
- HDI Escape Constraints；
- 仍不替代专业 SI/PI/安全认证。

---

# 103. Codex 工作纪律

Codex 必须：

1. Evidence、Intent、Resolved Constraint、EDA Enforcement 分开；
2. Input Snapshot 不可变；
3. Agent 18 Release Level 先 Gate；
4. Agent 20 Critical 时不发布；
5. Net Name 不是唯一证据；
6. Differential Pair 后缀只是候选；
7. P/N 必须检查端点和极性；
8. Interface Speed 有来源；
9. Firmware 配置不能覆盖硬件事实；
10. Simulation 结果只能补充边沿和敏感度；
11. Datasheet Required/Recommended/Example 分开；
12. Min/Typ/Max 分开；
13. “Short/Close/Far”默认是定性；
14. 无尺寸或比例不生成精确几何；
15. Stack-up 未知不发布精确阻抗线宽；
16. Dk/Df 保存频率和条件；
17. 阻抗 Solver 有版本和验证；
18. 近似公式不冒充生产场求解结果；
19. Manufacturer Capability 有版本和有效期；
20. 工艺冲突不自动降低约束；
21. 当前最大额定值不当持续工作值；
22. 电流计算包含温升和压降目标；
23. Via 是电流链路的一部分；
24. Pulse/Duty 明确；
25. 物理长度和 Delay 分开；
26. Delay 计算绑定层；
27. Package/Via/Connector Delay 明确是否包含；
28. Matched Group 定义端点；
29. Differential Skew 与组 Skew 分开；
30. Topology 和 Stub 显式；
31. Return Path 不只是一句“铺地”；
32. Layer Change 需要回流路径策略；
33. Placement Constraint 有强制级别；
34. Keepout 类型和层明确；
35. High Voltage Context 完整；
36. Clearance 与 Creepage 分开；
37. Working 与 Transient Voltage 分开；
38. Pollution/Material/Altitude/Coating 分开；
39. 不内置一张通用高压表；
40. 标准 Provider 有版本；
41. Safety Constraint 不能被低优先级覆盖；
42. Rule Priority 有模拟器；
43. Range Merge 为空时必须 Conflict；
44. Existing Manual Rules 保留；
45. Generated Rule 有 Canonical ID；
46. `.kicad_dru` 使用 AST/Serializer；
47. 不让 AI 直接写 Rule Text；
48. KiCad Rule 顺序按实际语义处理；
49. Net Class 默认值与强制 Min/Max 分开；
50. Tuning Profile 与 Custom Rule 分开；
51. Component Class 与 Net Class 分开；
52. Rule Area 和 Keepout 分开建模；
53. EDA 不可表达约束必须保留；
54. Zero Match 不能静默通过；
55. Shadowed Rule 必须报告；
56. Syntax Pass 不等于 Coverage Pass；
57. Write Success 不等于 Rule Effective；
58. Agent 19必须 Workspace/Snapshot；
59. 写入后 Agent 16重新解析；
60. 写入后执行 Rule Coverage；
61. 写入后执行 DRC；
62. Unexpected Existing-rule Override 是 Gate；
63. Stack-up 变化为高风险；
64. 高压规则变化为高风险；
65. Waiver 有 Scope、Reason、Evidence、Expiry；
66. Release Pass 不等于 SI/PI 或安全认证；
67. AI 只生成 Candidate/Explanation；
68. 私有 Stack-up 不发外部模型；
69. 不公开 NDA 制造数据；
70. 不伪造标准、计算、规则、DRC 或 Benchmark；
71. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Evidence/Rule/Solver 变化；
    - 测试命令；
    - 真实结果；
    - Interface/Pair Coverage；
    - Stack-up/Impedance；
    - Current/Via；
    - Timing/Topology；
    - Placement/High Voltage；
    - EDA Rule Coverage；
    - DRC/Post-write；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 104. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pcb-constraint-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第24个 Agent：

PCB Constraint Extraction, Resolution & EDA Rule Generation Agent /
PCB 约束提取 Agent。

本 Agent 接收：

- Agent 16 Project/Schematic/PCB/Part/Pin/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Library/Pin-Pad 校验；
- Agent 21 PinMux、Clock、Bus Speed 和 Firmware Configuration；
- Agent 22 ERC/AI Review 中的电源、高压和敏感网络信息；
- Agent 23 仿真的边沿、带宽、负载和敏感节点；
- 器件数据手册、Layout Guidelines 和 Reference Design；
- 用户、企业、客户和产品需求；
- PCB Stack-up 和制造商工艺能力；

提取并求解：

- Interface 和 Differential Pair；
- Controlled Impedance；
- Trace Width；
- Current/Temperature-rise/Voltage-drop；
- Via；
- Length/Delay/Skew；
- Topology/Stub/Return Path；
- Placement/Keepout/Rule Area；
- High-voltage Clearance/Creepage；
- Net Class/Component Class/Tuning Profile；
- KiCad `.kicad_dru` 和其他 EDA Rule Package。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16、18、19、20、21、22、23 规格和实际代码；
3. docs/pcb-constraint-agent-spec.md；
4. 当前 PCB IR、Stack-up、Board Setup；
5. 当前 Net Class/Component Class/Tuning Profile；
6. 当前 Rule Area/Keepout/`.kicad_dru`；
7. 当前 KiCad 9/10 Rule Parser/Serializer；
8. 当前 Altium/EasyEDA/JLCEDA Constraint；
9. 当前 Interface/Differential Pair/Net Role；
10. 当前 Firmware Speed/Clock/Memory；
11. 当前 Agent 22 Layout/High Voltage；
12. 当前 Agent 23 Edge/Bandwidth/Simulation；
13. 当前 Datasheet/Layout Guideline/Reference Layout；
14. 当前 Manufacturer/Stack-up Database；
15. 当前 Impedance Solver；
16. 当前 Current/Width/Via Solver；
17. 当前 Length/Delay/Skew/Topology；
18. 当前 Clearance/Creepage；
19. 当前 Rule Priority/Coverage/DRC；
20. 当前 Agent 19 Execution/Readback/Rollback；
21. 当前 Review UI；
22. 当前 API/Worker/Storage/Security；
23. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Evidence/Intent/Resolved/EDA Separation；
- Input Snapshot Immutable；
- Agent 18/20 Gate；
- Net Name != Truth；
- Suffix-only Diff Pair is Candidate；
- Endpoint/Polarity/Symmetry Check；
- Required/Recommended/Example Separate；
- Min/Typ/Max Separate；
- Qualitative Stays Qualitative until Quantified；
- No Scale Guessing from Images；
- Impedance Requires Stack-up；
- Dk/Df Conditions；
- Approved Solver and Version；
- Manufacturer Capability Versioned；
- No Auto Constraint Downgrade；
- Current != Device Absolute Maximum；
- Temperature-rise/Voltage-drop/Via Included；
- Length != Delay；
- Layer-specific Delay；
- Endpoint-defined Match；
- Topology/Stub/Return-path Explicit；
- Placement Severity Explicit；
- Keepout Type/Layer Explicit；
- Clearance != Creepage；
- HV Context Complete；
- No Universal Hardcoded HV Table；
- Safety Rule Cannot Be Overridden Downward；
- Rule Precedence/Specificity/Conflict；
- Existing Manual Rules Preserved；
- `.kicad_dru` AST Serializer；
- AI Does Not Write Raw Rules；
- Zero Match and Shadow Detected；
- Syntax != Coverage；
- Agent 19 Workspace/Preview/Approval；
- Post-write Reparse/Coverage/DRC；
- Stack-up/HV Change High-risk；
- Waiver Scope/Expiry；
- Pass != SI/PI/Safety Certification；
- 不发送私有工程和 NDA Stack-up 给外部模型；
- 不用私有制造数据做公开 Fixture；
- 不伪造标准、计算、规则和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改工程：

1. 侦察当前仓库；
2. 检查 Agent 16/18/19/20/21/22/23 Contract；
3. 查找 PCB IR/Stack-up/Board Setup；
4. 查找 Net Class/Component Class；
5. 查找 Tuning Profile；
6. 查找 Rule Area/Keepout；
7. 查找 `.kicad_dru` Parser/Serializer；
8. 查找 Rule Priority/Coverage/DRC；
9. 查找 KiCad 9/10 差异；
10. 查找 Altium/EasyEDA Constraint；
11. 查找 Interface/Differential Pair；
12. 查找 Signal Group/Topology；
13. 查找 Firmware Timing/Speed；
14. 查找 Agent 22/23 输入；
15. 查找 Datasheet/Layout Guideline；
16. 查找 Stack-up/Fabrication Profile；
17. 查找 Impedance Solver；
18. 查找 Current/Width/Via；
19. 查找 Length/Delay/Skew；
20. 查找 Placement/Keepout；
21. 查找 Clearance/Creepage；
22. 查找 Agent 19 Write/Readback；
23. 查找 UI/API/Worker/Storage/Security；
24. 统计真实约束和 EDA 映射覆盖；
25. 统计 Zero Match/Shadow/Conflict/DRC；
26. 抽样分析开源、合成、脱敏或授权工程；
27. 在 docs/pcb-constraint-implementation-plan.md 中生成实施计划；
28. 在 docs/input-and-evidence-gates.md 中定义输入；
29. 在 docs/pcb-constraint-ir.md 中定义 IR；
30. 在 docs/circuit-context-and-net-roles.md 中定义 Context；
31. 在 docs/interface-and-differential-pair-recognition.md 中定义接口；
32. 在 docs/stackup-and-fabrication-profiles.md 中定义 Stack-up；
33. 在 docs/impedance-resolution.md 中定义阻抗；
34. 在 docs/current-width-via-resolution.md 中定义电流；
35. 在 docs/length-delay-skew.md 中定义时延；
36. 在 docs/topology-and-return-path.md 中定义拓扑；
37. 在 docs/placement-and-keepouts.md 中定义区域；
38. 在 docs/high-voltage-clearance-creepage.md 中定义高压；
39. 在 docs/constraint-resolution-and-conflicts.md 中定义求解；
40. 在 docs/kicad-rule-generation.md 中定义 KiCad；
41. 在 docs/agent19-integration.md 中定义执行；
42. 在 docs/release-gates.md 中定义 Gate；
43. 在 docs/ai-boundaries.md 中定义 AI；
44. 在 docs/security.md 中定义安全；
45. 在 docs/pcb-constraint-migration-plan.md 中定义旧能力迁移；
46. 在 docs/pcb-constraint-benchmark-plan.md 中定义 Benchmark；
47. 给出拟新增、拟修改和拟复用文件；
48. 给出 Phase 1 精确范围；
49. 不修改业务代码；
50. 不创建 Migration；
51. 不安装 Solver；
52. 不调用外部模型；
53. 不写 EDA 工程；
54. 不读取 NDA 数据或 Secret；
55. 运行仓库已有 lint、type check、test、build 和 security scan；
56. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–23 Contract；
- Input/Evidence Gate；
- Circuit Context/Net Role；
- Interface/Differential Pair；
- Signal Group/Topology；
- Requirement/Fab/Stack-up；
- Impedance；
- Current/Width/Via；
- Length/Delay/Skew；
- Return Path；
- Placement/Keepout；
- High Voltage；
- Constraint Resolution/Conflict；
- Canonical Constraint IR；
- KiCad Adapter；
- Rule Priority/Coverage/DRC；
- Agent 19 Integration；
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

# 105. 后续 Phase 提示词模板

```text
继续实现 PCB Constraint Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–24 规格；
3. 阅读 PCB Constraint Implementation Plan；
4. 阅读 Input、IR、Context、Interface、Stack-up、Impedance、Current、Timing、Placement、High Voltage、Resolution、KiCad、Agent19、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Evidence/Intent/Resolved/EDA Separation；
- Reviewed Connectivity；
- Versioned Profiles/Solvers；
- No Invented Stack-up/Current/HV Context；
- Length/Delay Separation；
- Rule Conflict and Coverage；
- Agent 19 Controlled Write；
- Post-write DRC；
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
9. solver contract test；
10. constraint resolution test；
11. EDA rule coverage test；
12. Agent 19/post-write test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Evidence/Rule/Solver 变化；
- 测试命令和真实结果；
- Interface/Pair Coverage；
- Stack-up/Impedance；
- Current/Via；
- Timing/Topology；
- Placement/High Voltage；
- EDA Rule Coverage；
- DRC/Post-write；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 106. MVP 演示流程

1. 上传一份带 USB、CAN、ADC、Buck 和 48V 输入的 KiCad 工程；
2. Agent 16解析 Part、Pin、Net 和 PCB；
3. Agent 18提供 Reviewed Netlist；
4. Agent 20确认库和 Pin-Pad；
5. Agent 21提供 USB Full-Speed、CAN 1Mbps、ADC 采样和 PWM 频率；
6. Agent 22标出 Switch Node、模拟参考和 48V 风险；
7. Agent 23提供 Buck 边沿和模拟前端带宽；
8. 建立 Constraint Input Snapshot；
9. 识别 USB D+/D- 的端点和极性；
10. 网络后缀与 Pin Function 一致；
11. 发布 Reviewed Differential Pair；
12. 识别 CANH/CANL；
13. 发现 TVS 和 CMC 两侧网络名称不同；
14. 通过器件 Pin Role 建立整个 CAN Differential Path；
15. 读取 MCU USB Layout Guideline；
16. 提取“差分、连续参考层、减少过孔”；
17. 用户选择某 PCB 工厂四层 Stack-up；
18. 加载铜厚、介质厚度和 Dk；
19. Impedance Solver 生成 USB 90Ω 差分候选；
20. 候选线宽和间距满足制造能力；
21. 生成 Tuning Profile；
22. CAN 使用接口 Profile 的阻抗意图，但标记系统级电缆/终端条件；
23. 从 48V 输入和负载需求解析 3A 持续电流；
24. 结合允许温升、压降、铜厚和长度生成电源线宽候选；
25. 发现输入连接器单 Pin 额定电流低于 PCB 走线能力；
26. 输出系统瓶颈 Warning，而不是仅加宽铜；
27. 计算层间切换需要的 Via 候选；
28. 识别 Buck Switch Node；
29. 生成局部铜面积最小化和敏感网远离约束；
30. 识别 FB 网络；
31. 生成 FB 与 Switch Node 最小间距候选；
32. 识别 ADC 差分输入；
33. 根据 Agent 23 带宽和器件手册生成对称、短 Stub 和远离 PWM 的约束；
34. 识别晶振和两个负载电容；
35. 从数据手册提取定性邻近要求；
36. 企业规则将其量化为最大距离和局部 Keepout；
37. 用户提供工作海拔、污染等级和绝缘类别；
38. High-voltage Provider 生成 Clearance 和 Creepage 要求；
39. 48V 规则与企业默认规则兼容；
40. 创建 Primary-like 高压区域和低压控制区域；
41. 生成 Isolation Boundary；
42. 生成 Net Classes：
43. `USB_FS_DIFF`；
44. `CAN_DIFF`；
45. `POWER_3A`；
46. `ANALOG_SENSITIVE`；
47. `HV_48V`；
48. 生成 Component Classes：
49. `USB_PROTECTION`；
50. `BUCK_HOT_LOOP`；
51. `ANALOG_FRONTEND`；
52. 生成 Rule Areas：
53. `ANTENNA_KEEP_OUT`，如有；
54. `BUCK_SWITCH_AREA`；
55. `CRYSTAL_AREA`；
56. `HV_BOUNDARY`；
57. 生成 `.kicad_dru`；
58. Syntax Validator 通过；
59. Coverage Simulator 发现一条 `CAN_RX_MATCH` 规则匹配 0 个 Net；
60. 回溯发现规则引用了旧网络名；
61. 使用 Stable Net ID 重建；
62. Coverage 通过；
63. 发现已有人工 USB Rule 优先级高于生成规则但数值冲突；
64. 创建 Blocking Conflict，不静默覆盖；
65. 工程师选择保留更严格人工规则；
66. 生成 Agent 19 Change Plan；
67. 在 Workspace 中创建 Net Class、Tuning Profile、Rule Area 和 Custom Rules；
68. KiCad 重新打开；
69. Agent 16重新解析；
70. Rule Coverage 回读；
71. 运行 DRC；
72. DRC 暴露当前布局中的 USB Gap 和 48V Clearance 问题；
73. 这些被记录为“现有板违反新批准约束”，而不是规则生成失败；
74. Constraint Release Gate 允许进入整改状态，不允许 NPI Freeze；
75. 生成 Constraint Matrix、Evidence、Calculation 和 DRC 报告；
76. 发布 `pcb-constraints.constraint-ir-ready`。

---

# 107. 生产上线顺序

第一阶段：

```text
Agent 16/18/20 Input
Net Role
Interface/Differential Pair
Requirement/Fab/Stack-up Profile
Canonical Constraint IR
KiCad Net Class
Basic Custom Rules
Coverage and DRC
Report-only
```

第二阶段：

```text
Impedance Solver
Current/Width/Via
Length/Delay/Skew
Tuning Profile
Placement/Keepout
Agent 19 Write
Post-write Verification
```

第三阶段：

```text
High Voltage
Advanced Topology/Return Path
Altium/EasyEDA Adapter
Reference Layout Geometry
SI/PI Tool Handoff
Manufacturing Provider Integration
```

上线优先确保：

```text
每条约束到底来自哪份证据
当前数字是否依赖某个 Stack-up 和工厂能力
约束作用于哪些 Net、Part、Layer 和 Area
生成规则是否真的匹配目标对象
规则写入后是否成为有效规则并通过 DRC
```

一个可信的 PCB 约束 Agent，不是看到 `USB_D+` 就机械地贴上“90Ω差分”标签。它还必须知道这是哪个 USB 角色、连接到哪里、采用什么 Stack-up、工厂能否加工、规则在 KiCad 中是否真的命中，以及这条约束究竟是硬性标准、器件建议，还是一个仍待工程师确认的候选。
