# 电路仿真与结果解读 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：23  
> Agent 名称：Circuit Simulation, Testbench Generation & Result Interpretation Agent  
> 中文名称：电路仿真与结果解读 Agent  
> 类型：混合型（程序化网表/模型/仿真/测量 + 受控 AI 解读）  
> 版本：V1.0  
>
> 定位：基于 Agent 16/18 输出的结构化原理图和已审核网表、Agent 20 的库与 Pin-Pad 校验、Agent 22 的审查发现、器件 SPICE 模型、工作条件和设计规格，自动生成 Simulation IR、Testbench IR、Measurement IR 和 Simulator-specific Netlist；调用受控仿真后端执行 Operating Point、DC、AC、Transient、Noise、Parameter Sweep、Temperature/Corner 等分析，检查模型和数值健康，提取波形特征与测量值，对照规格判断，并输出可追溯的结果解释、问题定位、修复候选和回归测试。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、Part IR、Pin IR、Net IR、PCB IR、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、Release Level、未决连接
> - Agent 20：EDA 库、Pin-Pad、器件身份和工程可复现性校验
> - Agent 22：ERC、器件级原理图审查 Finding、工作条件和修复建议
> - Agent 21：固件时序、PWM、采样率、总线和外设配置，可选
> - Agent 19：KiCad 工程修改、受控执行、回读和回滚
> - 器件模型库、厂商模型、IBIS、S-parameter、Behavioral Model 和企业批准模型
> - 用户仿真目标、输入条件、负载、容差、温度、规格和验收标准
>
> 下游：
> - Agent 22：仿真证据、边界条件和问题验证
> - Agent 19：执行元件值、连接和模型属性的结构化修复候选
> - Agent 21：模拟前端、PWM、ADC、滤波和时序配置联动
> - Agent 43：NPI 设计验证记录
> - Agent 44：制造前风险和设计成熟度
> - Agent 45：测试激励、测量点、ICT/FCT 限值和黄金波形
> - CI、设计评审、参数优化、仿真报告和验证数据库
>
> 核心输出：
> - Simulation Input Snapshot
> - Simulation Scope and Fidelity Report
> - Model Resolution Manifest
> - Model Binding Matrix
> - Simulation IR
> - Testbench IR
> - Stimulus IR
> - Measurement IR
> - Simulator Capability Resolution
> - Simulator-specific Netlist
> - Simulation Run Manifest
> - Raw Waveform Artifact
> - Normalized Waveform Dataset
> - Measurement Results
> - Specification Evaluation
> - Numerical Health and Convergence Report
> - Result Interpretation
> - Root-cause Candidate
> - Repair/Optimization Candidate
> - Regression Test Package
> - Simulation Release Gate
>
> 重要边界：
> - “原理图可连接”不等于“可仿真”；每个参与仿真的器件必须有可解释的模型或明确的替代策略。
> - 不以模型名称相同作为模型兼容证据，必须检查模型引脚顺序、参数、适用电压、温度和分析类型。
> - 不将理想模型结果描述成硬件实际性能。
> - 不将模型缺失、模型不收敛、测量表达式失效或分析范围错误包装为“仿真通过”。
> - AI 不生成或修改 Net Graph，不伪造模型参数，不替代仿真器计算，不决定收敛设置的最终正确性。
> - AI 只对真实、已验证、结构化的仿真和测量结果做解释、总结、对比和候选推理。
> - V1 优先支持模拟与混合的 SPICE 类分析；复杂数字时序、HDL 协同仿真、EM 场求解和完整 SI/PI 需独立后端。
> - 所有模型、激励、参数、仿真器版本、命令、随机种子、结果和解释必须版本化和可重放。
> - 不自动使用来源不明、许可证不清或包含任意代码执行的模型。
> - 不自动修改唯一生产工程；修复通过 Agent 19 的 Workspace、Preview、审批和回滚。
> - 不把私有电路、模型、波形和设计规格发送给外部通用模型。

---

# 1. Agent 23 的系统位置

```text
Reviewed EDA / Device Models / Design Specs
                    ↓
Simulation Readiness Gate
                    ↓
Model Resolution and Pin Mapping
                    ↓
Simulation IR and Testbench Generation
                    ↓
Simulator Backend Selection
                    ↓
Netlist Compile and Preflight
                    ↓
DC / AC / Transient / Noise / Sweeps
                    ↓
Convergence and Numerical Health
                    ↓
Waveform Normalization and Measurements
                    ↓
Spec Evaluation and Interpretation
                    ↓
Repair / Optimization / Regression
```

---

# 2. 为什么要独立建设 Agent 23

直接把原理图转换成 SPICE 并运行，常见问题包括：

1. 器件没有模型；
2. 模型来自错误封装或错误型号；
3. Subcircuit Pin 顺序与原理图符号 Pin 不一致；
4. Power Pin、Enable Pin 或 Thermal Pin 未映射；
5. 模型只适用于某一种分析；
6. 厂商加密模型只能在特定仿真器运行；
7. 理想源造成数值奇异；
8. 浮空节点导致矩阵奇异；
9. 电感回路和电压源回路导致收敛问题；
10. 缺少 Ground Reference；
11. 初始条件不合理；
12. 时间步长太大，漏掉尖峰或振荡；
13. AC 小信号分析的偏置点不成立；
14. Noise 分析的输入/输出定义错误；
15. 测量表达式找不到边沿；
16. 仿真结束但波形包含 NaN、Inf 或截断；
17. 自动解释忽略了模型局限；
18. 参数扫描在每个点使用不同非预期初始状态；
19. Monte Carlo 未锁定随机种子；
20. 仿真器返回码为 0，但测量并未产生有效结果。

Agent 23 的核心职责是：

```text
Model Truth
→ Testbench Truth
→ Simulator Truth
→ Measurement Truth
→ Interpretation Truth
```

---

# 3. 审查和执行层级

## 3.1 Input Readiness

确认：

```text
网表 Release Level
连接冲突
器件身份
Pin-Pad 和库状态
分析目标
工作条件
```

## 3.2 Model Readiness

确认：

```text
模型存在
模型来源
模型版本
许可证
Pin Mapping
参数范围
适用分析
仿真器兼容性
```

## 3.3 Testbench Readiness

确认：

```text
输入源
负载
偏置
初始条件
温度
分析范围
测量点
测量表达式
```

## 3.4 Numerical Readiness

确认：

```text
Ground
浮空节点
理想回路
节点命名
单位
时间步长
容差
积分方法
收敛策略
```

## 3.5 Result Readiness

确认：

```text
仿真完成
数据完整
无 NaN/Inf
时间/频率范围完整
测量有效
规格条件一致
```

---

# 4. 建设目标

系统必须能够：

1. 接收 Agent 16 Project/Schematic/Part/Pin/Net IR；
2. 接收 Agent 18 Reviewed Netlist；
3. 接收 Agent 20 Library/Pin-Pad 状态；
4. 接收 Agent 22 Finding 和工作条件；
5. 接收 Agent 21 PWM、采样、协议和时序信息；
6. 接收仿真目标；
7. 接收规格和验收标准；
8. 接收输入源条件；
9. 接收负载条件；
10. 接收温度；
11. 接收元件容差；
12. 接收电源变化；
13. 接收初始条件；
14. 建立不可变 Input Snapshot；
15. 建立 Simulation Scope；
16. 建立 Fidelity Level；
17. 建立 Device Model Inventory；
18. 建立 Model Source Registry；
19. 建立 Model License Registry；
20. 建立 Model Version；
21. 建立 Model Artifact Hash；
22. 解析 `.model`；
23. 解析 `.subckt`；
24. 解析 Include；
25. 解析 Library Section；
26. 解析 Parameter；
27. 解析 Behavioral Source；
28. 识别加密模型；
29. 识别仿真器专用语法；
30. 识别外部文件依赖；
31. 识别模型 Pin List；
32. 识别模型 Default Parameters；
33. 识别模型支持的温度；
34. 识别模型适用分析；
35. 建立 Part-to-Model Binding；
36. 建立 Symbol Pin-to-Model Pin Mapping；
37. 建立 Package/Variant Scope；
38. 检测 Pin Count 不一致；
39. 检测 Pin Name/Number 冲突；
40. 检测电源和控制 Pin 缺失；
41. 检测模型顺序错误；
42. 检测参数覆盖冲突；
43. 检测同名 Subcircuit 冲突；
44. 检测 Include 路径失效；
45. 检测模型循环依赖；
46. 检测模型来源不可信；
47. 检测许可证不允许；
48. 检测分析不兼容；
49. 支持厂商模型；
50. 支持企业模型；
51. 支持标准器件模型；
52. 支持理想模型；
53. 支持行为模型；
54. 支持黑盒占位模型；
55. 支持模型降级策略；
56. 支持模型替代候选；
57. 建立 Simulation IR；
58. 建立 Circuit Element IR；
59. 建立 Node IR；
60. 建立 Parameter IR；
61. 建立 Model Binding IR；
62. 建立 Testbench IR；
63. 建立 Stimulus IR；
64. 建立 Load IR；
65. 建立 Probe IR；
66. 建立 Measurement IR；
67. 建立 Analysis IR；
68. 建立 Sweep IR；
69. 建立 Corner IR；
70. 建立 Monte Carlo IR；
71. 建立 Output Dataset Schema；
72. 支持 Operating Point；
73. 支持 DC Sweep；
74. 支持 DC Transfer；
75. 支持 AC Sweep；
76. 支持 Transient；
77. 支持 Noise；
78. 支持 Parameter Sweep；
79. 支持 Temperature Sweep；
80. 支持 Process/Model Corner；
81. 支持 Monte Carlo；
82. 支持 Sensitivity，可选；
83. 支持 Pole-Zero，可选；
84. 支持 Distortion，可选；
85. 支持 Transfer Function；
86. 生成电源激励；
87. 生成正弦激励；
88. 生成脉冲激励；
89. 生成 PWL；
90. 生成阶跃；
91. 生成扫频；
92. 生成数字边沿近似；
93. 生成 PWM；
94. 生成差分激励；
95. 生成共模激励；
96. 生成噪声源；
97. 生成负载电阻；
98. 生成负载电容；
99. 生成电流负载；
100. 生成动态负载；
101. 生成开关负载；
102. 生成电源扰动；
103. 生成温度条件；
104. 生成初始条件；
105. 生成启动序列；
106. 生成测试开关；
107. 生成模型参数覆盖；
108. 生成可重复随机种子；
109. 自动识别输入节点；
110. 自动识别输出节点；
111. 自动识别反馈节点；
112. 自动识别供电节点；
113. 自动识别地节点；
114. 自动识别差分节点；
115. 自动识别关键中间节点；
116. 支持用户指定 Probe；
117. 生成增益测量；
118. 生成相位测量；
119. 生成带宽测量；
120. 生成截止频率；
121. 生成峰值；
122. 生成谐振频率；
123. 生成 Q 值；
124. 生成稳定裕量候选；
125. 生成上升/下降时间；
126. 生成延迟；
127. 生成过冲；
128. 生成下冲；
129. 生成稳定时间；
130. 生成纹波；
131. 生成峰峰值；
132. 生成 RMS；
133. 生成平均值；
134. 生成占空比；
135. 生成频率；
136. 生成周期；
137. 生成启动时间；
138. 生成静态电流；
139. 生成浪涌电流；
140. 生成功耗；
141. 生成效率；
142. 生成输入/输出阻抗；
143. 生成噪声谱密度；
144. 生成积分噪声；
145. 生成 SNR 候选；
146. 生成 PSRR；
147. 生成 CMRR；
148. 生成 THD 候选；
149. 生成最大/最小节点电压；
150. 生成器件应力；
151. 生成参数容差测量；
152. 生成规格表达式；
153. 支持表达式依赖；
154. 支持单位；
155. 支持范围；
156. 支持条件；
157. 支持多次边沿；
158. 支持测量窗口；
159. 支持失败原因；
160. 建立 Simulator Registry；
161. 建立 Capability Matrix；
162. 支持 ngspice Adapter；
163. 支持 Xyce Adapter；
164. 支持 LTspice Adapter，可选且遵守许可；
165. 支持厂商专用仿真器 Adapter；
166. 支持 WebAssembly ngspice，可选；
167. 支持本地 Worker；
168. 支持容器化；
169. 支持无网络执行；
170. 选择兼容仿真器；
171. 生成 Simulator-specific Netlist；
172. 生成 Include Manifest；
173. 生成 Run Command Manifest；
174. 生成 Environment Snapshot；
175. 运行 Netlist Compile；
176. 检测语法错误；
177. 检测模型缺失；
178. 检测参数未定义；
179. 检测重复定义；
180. 检测浮空节点；
181. 检测 Ground 缺失；
182. 检测理想电压源回路；
183. 检测理想电流源切割集；
184. 检测零电阻/零电感病态；
185. 检测极端参数；
186. 检测单位错误；
187. 检测时间步长风险；
188. 检测输出点不存在；
189. 检测分析不适用；
190. 支持自动收敛策略；
191. 支持 Gmin Step；
192. 支持 Source Step；
193. 支持 Initial Condition；
194. 支持 UIC，可配置；
195. 支持容差调整；
196. 支持积分方法选择；
197. 支持最大时间步长；
198. 支持迭代限制；
199. 支持失败重试；
200. 保存每次收敛策略；
201. 不隐藏重试；
202. 不用极端容差伪造收敛；
203. 运行仿真；
204. 捕获退出码；
205. 捕获 stdout/stderr；
206. 捕获 Raw Waveform；
207. 捕获 Measure Output；
208. 捕获运行时间；
209. 捕获内存；
210. 捕获仿真器版本；
211. 归一化波形；
212. 统一节点名称；
213. 统一单位；
214. 统一复数数据；
215. 统一频率轴；
216. 统一时间轴；
217. 保存数字/模拟类型；
218. 检测 NaN；
219. 检测 Inf；
220. 检测空向量；
221. 检测截断；
222. 检测未达到 Stop Time；
223. 检测频率点不足；
224. 检测别名错误；
225. 检测插值误差；
226. 检测边沿不足；
227. 计算 Measurement；
228. 验证 Measurement；
229. 生成规格判定；
230. 生成 Pass/Fail/Indeterminate；
231. 生成 Margin；
232. 生成 Worst Case；
233. 生成 Corner Summary；
234. 生成 Monte Carlo Distribution；
235. 生成 Yield Estimate；
236. 生成敏感参数排序；
237. 生成波形特征；
238. 生成振荡候选；
239. 生成饱和候选；
240. 生成削顶候选；
241. 生成不稳定候选；
242. 生成启动失败候选；
243. 生成偏置异常候选；
244. 生成噪声主导源候选；
245. 生成应力超限候选；
246. 生成模型适用性警告；
247. 生成结果解释；
248. 生成设计规格对照；
249. 生成仿真假设；
250. 生成不确定项；
251. 生成模型局限；
252. 生成 Root-cause Candidate；
253. 生成修复候选；
254. 生成元件值候选；
255. 生成参数扫描建议；
256. 生成模型替换建议；
257. 生成工作条件补充请求；
258. 生成 Agent 19 Change Plan；
259. 支持修复后重跑；
260. 支持仿真回归；
261. 支持 Golden Waveform；
262. 支持 Golden Measurement；
263. 支持 CI；
264. 支持 Baseline；
265. 支持 Waiver；
266. 支持 Review；
267. 支持批量仿真；
268. 支持任务取消；
269. 支持任务恢复；
270. 支持缓存；
271. 支持多租户；
272. 支持权限；
273. 支持审计；
274. 支持结果报告；
275. 不把理想模型结果当硬件保证；
276. 不把仿真器收敛当电路正确；
277. 不把单一 Corner 当全范围；
278. 不自动放宽规格；
279. 不自动更改模型数据；
280. 不在测量失败时给出 Pass；
281. 不在波形不完整时给出确定性结论；
282. 不伪造模型、运行、波形、测量或结果；
283. 不执行任意 Shell；
284. 不执行模型包中的任意脚本；
285. 不访问未批准远程模型；
286. 不发送私有电路和波形给外部模型。

---

# 5. 核心架构

```text
Simulation Request
→ Input Gate
→ Model Resolution
→ Simulation/Testbench/Measurement IR
→ Backend Capability Selection
→ Netlist Generation
→ Preflight and Compile
→ Simulation Execution
→ Waveform Normalization
→ Measurement Evaluation
→ Spec and Numerical Health
→ Interpretation
→ Repair/Regression
```

---

# 6. Simulation Fidelity Levels

## Level 0：Connectivity-only

```text
只验证网表能否形成仿真结构
模型大量理想化
不用于性能结论
```

## Level 1：Functional

```text
功能行为模型
验证极性、基本增益、逻辑和启动
```

## Level 2：Device-aware

```text
主要有源器件使用型号或系列模型
无源器件包含容差和基本寄生
```

## Level 3：Corner-aware

```text
温度、供电、元件容差和模型 Corner
```

## Level 4：Layout-aware

```text
包含 PCB 寄生、IBIS、S 参数或提取网络
```

结果报告必须明确 Fidelity，不能把 Level 0 结果写成量产性能预测。

---

# 7. Simulation Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "agent16_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_report_hash": "sha256",
  "agent22_review_hash": "sha256",
  "simulation_objective": "Evaluate active low-pass response",
  "operating_conditions": {},
  "specification_set_id": "uuid",
  "model_registry_snapshot_hash": "sha256"
}
```

---

# 8. Simulation IR

```json
{
  "simulation_ir_version": "1.0.0",
  "project": {},
  "circuit": {
    "nodes": [],
    "elements": [],
    "models": [],
    "parameters": []
  },
  "testbenches": [],
  "analyses": [],
  "measurements": [],
  "specifications": [],
  "fidelity": {},
  "provenance": {}
}
```

---

# 9. Circuit Element IR

支持：

```text
resistor
capacitor
inductor
mutual inductance
diode
BJT
JFET
MOSFET
subcircuit
voltage source
current source
controlled source
behavioral source
switch
transmission line
S-parameter block
IBIS buffer
black box
```

每个元素保存：

```text
source part id
reference
pin-node mapping
model binding
parameter overrides
temperature
enable status
source map
```

---

# 10. Node IR

```text
stable node id
source net id
raw net name
simulator-safe name
role
domain
ground reference
probe status
confidence
```

---

# 11. Model Registry

每个模型保存：

```text
model id
manufacturer
MPN/family/category
model type
artifact
artifact hash
source
version
license
supported simulators
supported analyses
pin list
parameter list
temperature range
voltage/current scope
approval status
validation report
```

---

# 12. Model Source Priority

```text
批准的厂商型号模型
企业验证模型
批准的系列模型
标准通用模型
行为模型
理想模型
黑盒占位
```

使用降级模型时必须降低 Fidelity 并给出警告。

---

# 13. Model Binding Matrix

```text
RefDes
Part MPN
Symbol Pin
Model Pin
Source Net
Model Source
Model Version
Binding Status
Fidelity
Evidence
```

---

# 14. Model Binding 状态

```text
exact
exact_with_parameter_override
family_compatible
behavioral
idealized
black_box
ambiguous
missing
incompatible
license_blocked
simulator_incompatible
```

---

# 15. Pin Mapping

优先：

```text
批准的显式 Mapping
模型元数据
企业器件库 Mapping
厂商模型说明
人工审核
```

不能只按引脚数量或顺序自动绑定。

---

# 16. Model Validation

模型入库前至少验证：

```text
语法
Include 依赖
Pin Count
Pin Meaning
默认参数
简单 DC Test
简单 AC/Transient Test
目标仿真器
许可证
资源消耗
```

---

# 17. 黑盒与占位

黑盒器件必须声明：

```text
是否开路
是否短路
是否固定负载
是否行为近似
是否排除该功能块
```

不能静默删除器件。

---

# 18. Testbench IR

```text
testbench id
objective
circuit scope
sources
loads
switches
initial conditions
temperature
parameters
analyses
measurements
specifications
fidelity requirements
```

---

# 19. Testbench 来源

```text
用户显式定义
企业模板
器件类别模板
Agent 22 Finding 验证模板
参考设计模板
程序自动候选
AI 说明草稿
```

程序自动候选需经过 Readiness Check。

---

# 20. Stimulus IR

```text
source type
positive/negative node
DC value
AC magnitude/phase
waveform type
timing
frequency
amplitude
offset
rise/fall
duty
PWL points
source impedance
noise
enable sequence
```

---

# 21. Load IR

```text
resistive
capacitive
inductive
current sink/source
dynamic load
piecewise load
controlled load
device model
```

---

# 22. Analysis IR

## Operating Point

```text
bias nodes
device operating regions
currents
power
```

## DC Sweep

```text
source/parameter
start/stop/step
nested sweep
```

## AC

```text
dec/oct/lin
start/stop
input source
output expression
```

## Transient

```text
start
stop
print step
max step
initial condition
startup
```

## Noise

```text
output
input source
frequency range
integration range
```

---

# 23. Measurement IR

```json
{
  "measurement_id": "gain_1khz",
  "analysis_id": "ac_main",
  "expression_type": "magnitude_db",
  "expression": {},
  "window": {},
  "aggregation": "single_point",
  "units": "dB",
  "validity_conditions": [],
  "specification_id": "uuid"
}
```

---

# 24. Measurement 类型

```text
point value
max/min
peak-to-peak
mean
RMS
integral
derivative
crossing
rise/fall
delay
settling
overshoot/undershoot
frequency
period
duty
bandwidth
cutoff
resonance
phase margin candidate
gain margin candidate
integrated noise
power
efficiency
impedance
device stress
custom safe expression
```

---

# 25. Measurement Validity

例如 Rise Time：

```text
至少存在有效低/高稳态
至少存在目标 Crossing
波形无截断
窗口包含完整边沿
```

不满足时：

```text
indeterminate
```

而不是 `0 ns` 或 Pass。

---

# 26. Specification Schema

```text
spec id
metric
operator
limit/range
units
conditions
analysis
corner scope
severity
margin policy
source
```

---

# 27. Specification 结果

```text
pass
fail
indeterminate
not_applicable
not_simulated
model_fidelity_insufficient
```

---

# 28. Simulator Registry

保存：

```text
simulator
version
platform
license
analyses
device/model support
syntax
raw format
batch/headless
parallelism
encrypted model support
limits
validation date
```

---

# 29. Backend Selection

依据：

```text
模型兼容性
分析类型
许可证
平台
规模
性能
精度
企业策略
```

`unknown` 不视为兼容。

---

# 30. Simulator Adapter

```python
class SimulatorAdapter:
    async def discover(self) -> CapabilitySnapshot: ...
    async def compile(self, simulation_ir) -> CompileResult: ...
    async def run(self, run_plan) -> SimulationResult: ...
    async def parse_waveforms(self, artifacts) -> NormalizedWaveforms: ...
    async def parse_measurements(self, artifacts) -> MeasurementResults: ...
    async def normalize_error(self, error) -> SimulationError: ...
```

---

# 31. Netlist Generation

要求：

```text
deterministic ordering
stable node names
safe path references
parameter namespace
model namespace
include manifest
analysis commands
output vectors
measurement expressions
```

---

# 32. Netlist Provenance

每一行或每个语句应能追溯：

```text
Agent 16 entity
Testbench entity
Model artifact
Template/version
Generated rule
```

---

# 33. Preflight

检查：

```text
Ground
floating DC nodes
unconnected model pins
undefined model
undefined parameter
duplicate subcircuit
include cycle
unsupported syntax
analysis-source mismatch
invalid sweep
invalid measure
output vector missing
```

---

# 34. 数值风险

```text
ideal source loop
inductor-only loop
capacitor/current-source cutset
huge dynamic range
zero/negative values
discontinuous behavioral source
hard switch
impossible initial condition
```

---

# 35. 收敛策略

分级：

```text
default
topology-safe preprocessing
gmin stepping
source stepping
initial condition
limited tolerance adjustment
integration-method fallback
manual review
```

所有重试都保留。

---

# 36. 禁止的“假收敛”

```text
无限放宽 reltol/abstol
删除有问题的器件
把所有寄生设为零
强行 UIC 后忽略错误启动
截短仿真范围
取消规格测量
```

---

# 37. Waveform Dataset

推荐：

```text
Arrow/Parquet
```

字段：

```text
run id
analysis id
corner id
sweep point
axis type/value/unit
vector id/name
value real
value imag
value unit
quality flags
```

---

# 38. Waveform Quality Flags

```text
complete
truncated
nan
inf
interpolated
undersampled
edge_missing
alias_suspected
convergence_retried
fidelity_warning
```

---

# 39. 特征提取

程序化提取：

```text
steady-state
startup
edge
peak
oscillation
ripple
settling
saturation
clipping
ringing
frequency content
noise band contribution
```

---

# 40. AI 解释输入

AI 只接收：

```text
Simulation objective
Fidelity
Model warnings
Operating conditions
Measurement results
Spec results
Selected waveform features
Numerical health
Approved evidence
```

不必发送全部原始工程或全波形。

---

# 41. AI 允许职责

```text
将结构化结果转为工程师可读说明
总结 Pass/Fail 和 Margin
解释 Corner 差异
解释模型局限
关联 Agent 22 Finding
生成下一轮仿真建议
生成参数扫描建议
生成修复说明草稿
```

---

# 42. AI 禁止职责

```text
伪造波形
伪造 Measurement
改变规格
选择性隐藏失败 Corner
凭图像估算精确数值
将收敛失败解释成电路失败
将理想模型结果描述为硬件保证
直接改原理图
```

---

# 43. Root-cause Candidate

程序和规则生成候选：

```text
wrong bias
insufficient headroom
missing feedback
unstable loop
load too heavy
component tolerance
model limitation
startup condition
source impedance
saturation
slew-rate limit
bandwidth limit
thermal/rating risk
```

必须标记：

```text
confirmed
strong_candidate
candidate
insufficient_evidence
```

---

# 44. Repair Candidate

```text
change component value
add/remove component
change bias
change compensation
change load
change source impedance
change model
change initial condition
change simulation only
request operating condition
```

区分：

```text
design repair
testbench repair
model repair
simulation setting repair
```

不能把测试平台问题当成设计问题。

---

# 45. 参数优化

V1：

```text
bounded grid sweep
binary search
local search
multi-objective candidate ranking
```

优化目标必须显式：

```text
gain
bandwidth
noise
overshoot
settling
power
component count
robustness
```

---

# 46. 优化边界

```text
元件允许范围
E-series
器件额定值
库存/成本可选
稳定性
工作条件
```

优化结果只是候选，需人工或 Agent 19 审批。

---

# 47. Corner

维度：

```text
supply
temperature
component tolerance
model corner
load
source
process
```

保存每个 Corner 的完整参数。

---

# 48. Monte Carlo

要求：

```text
distribution
correlation
sample count
seed
sampling method
failed sample handling
yield specification
```

不能默认所有元件独立且正态。

---

# 49. Noise

Noise 分析必须明确：

```text
input source
output node/expression
frequency range
source impedance
integration band
```

输出：

```text
output noise density
input-referred noise
integrated noise
source contribution
```

---

# 50. AC

AC 解释前确认：

```text
Operating Point 有效
输入源 AC magnitude 已设置
输出表达式正确
系统在小信号条件下适用
```

---

# 51. Transient

Transient 解释前确认：

```text
Stop Time 足够
Max Step 足够小
激励边沿合理
初始条件有意义
启动过程是否包含
```

---

# 52. DC

DC Sweep 需区分：

```text
source sweep
parameter sweep
transfer curve
operating point progression
```

---

# 53. Regression Package

保存：

```text
Input Snapshot
Model Manifest
Testbench IR
Netlist
Simulator Version
Run Settings
Measurements
Specs
Expected Ranges
Waveform Hash
```

---

# 54. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RESOLVING_MODELS
→ VALIDATING_MODEL_BINDINGS
→ BUILDING_SIMULATION_IR
→ GENERATING_TESTBENCH
→ GENERATING_MEASUREMENTS
→ SELECTING_SIMULATOR
→ GENERATING_NETLIST
→ PREFLIGHT
→ COMPILING_NETLIST
→ RUNNING_SIMULATION
→ NORMALIZING_WAVEFORMS
→ VALIDATING_NUMERICAL_HEALTH
→ EVALUATING_MEASUREMENTS
→ EVALUATING_SPECIFICATIONS
→ INTERPRETING_RESULTS
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_REPORT
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_WARNINGS
COMPLETED_WITH_FAILURES
REVIEW_REQUIRED
INPUT_BLOCKED
MODEL_MISSING
MODEL_AMBIGUOUS
MODEL_INCOMPATIBLE
TESTBENCH_INCOMPLETE
PREFLIGHT_FAILED
NETLIST_COMPILE_FAILED
SIMULATION_NOT_CONVERGED
SIMULATION_PARTIAL
MEASUREMENT_INDETERMINATE
SPECIFICATION_INCOMPLETE
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 55. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT18_RELEASE_TOO_LOW
AGENT18_CONNECTIVITY_BLOCKED
AGENT20_LIBRARY_BLOCKED
AGENT22_CONDITION_REQUIRED
SIMULATION_OBJECTIVE_MISSING
OPERATING_CONDITION_MISSING
SPECIFICATION_SET_MISSING
MODEL_REGISTRY_UNAVAILABLE
MODEL_NOT_FOUND
MODEL_SOURCE_UNAPPROVED
MODEL_LICENSE_BLOCKED
MODEL_ARTIFACT_HASH_MISMATCH
MODEL_FORMAT_UNSUPPORTED
MODEL_INCLUDE_NOT_FOUND
MODEL_INCLUDE_CYCLE
MODEL_PIN_COUNT_MISMATCH
MODEL_PIN_MAPPING_AMBIGUOUS
MODEL_PIN_MAPPING_CONFLICT
MODEL_PARAMETER_CONFLICT
MODEL_SIMULATOR_INCOMPATIBLE
MODEL_ANALYSIS_INCOMPATIBLE
TESTBENCH_NOT_FOUND
STIMULUS_INVALID
LOAD_INVALID
GROUND_MISSING
FLOATING_NODE
IDEAL_SOURCE_LOOP
INVALID_INITIAL_CONDITION
ANALYSIS_INVALID
SWEEP_INVALID
MEASUREMENT_INVALID
MEASUREMENT_VECTOR_NOT_FOUND
SIMULATOR_NOT_FOUND
SIMULATOR_VERSION_UNAPPROVED
SIMULATOR_CAPABILITY_MISSING
NETLIST_GENERATION_FAILED
NETLIST_COMPILE_FAILED
UNDEFINED_MODEL
UNDEFINED_PARAMETER
UNSUPPORTED_SYNTAX
SIMULATION_TIMEOUT
SIMULATION_CRASHED
SIMULATION_NOT_CONVERGED
SIMULATION_RESULT_MISSING
WAVEFORM_PARSE_FAILED
WAVEFORM_TRUNCATED
WAVEFORM_NAN
WAVEFORM_INF
MEASUREMENT_FAILED
MEASUREMENT_INDETERMINATE
SPECIFICATION_UNIT_MISMATCH
SPECIFICATION_CONDITION_MISMATCH
MONTE_CARLO_INVALID
CORNER_SET_INVALID
RESULT_FIDELITY_INSUFFICIENT
AGENT19_EXECUTION_FAILED
REGRESSION_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 56. 数据库设计

## 56.1 `simulation_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_bundle_id UUID NOT NULL
agent18_release_id UUID NOT NULL
agent20_scan_id UUID NOT NULL
agent22_review_id UUID NULL
agent21_ir_id UUID NULL
simulation_objective TEXT NOT NULL
requested_analyses JSONB NOT NULL
requested_fidelity VARCHAR NOT NULL
specification_set_id UUID NULL
simulation_policy_version VARCHAR NOT NULL
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

## 56.2 `simulation_input_snapshots`

```text
id UUID PK
simulation_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent22_review_hash CHAR(64) NULL
agent21_ir_hash CHAR(64) NULL
operating_conditions_uri TEXT NOT NULL
operating_conditions_hash CHAR(64) NOT NULL
model_registry_snapshot_hash CHAR(64) NOT NULL
specification_set_hash CHAR(64) NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, snapshot_hash)
```

## 56.3 `simulation_model_registry_entries`

```text
id UUID PK
tenant_id UUID NULL
model_name VARCHAR NOT NULL
model_version VARCHAR NOT NULL
model_type VARCHAR NOT NULL
manufacturer VARCHAR NULL
mpn_scope JSONB NULL
device_category_scope JSONB NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
source_reference JSONB NOT NULL
supported_simulators JSONB NOT NULL
supported_analyses JSONB NOT NULL
pin_schema JSONB NOT NULL
parameter_schema JSONB NOT NULL
operating_scope JSONB NOT NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
validation_report_uri TEXT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(model_name, model_version, artifact_hash)
```

## 56.4 `simulation_model_artifact_dependencies`

```text
id UUID PK
model_registry_entry_id UUID NOT NULL
dependency_type VARCHAR NOT NULL
dependency_reference JSONB NOT NULL
artifact_hash CHAR(64) NULL
required BOOLEAN NOT NULL
resolution_status VARCHAR NOT NULL
license_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.5 `simulation_model_bindings`

```text
id UUID PK
simulation_job_id UUID NOT NULL
part_id UUID NOT NULL
reference_designator VARCHAR NOT NULL
model_registry_entry_id UUID NULL
binding_status VARCHAR NOT NULL
fidelity_level VARCHAR NOT NULL
pin_mapping JSONB NOT NULL
parameter_overrides JSONB NOT NULL
binding_method VARCHAR NOT NULL
binding_confidence NUMERIC(5,4) NOT NULL
evidence JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.6 `simulation_model_binding_pins`

```text
id UUID PK
model_binding_id UUID NOT NULL
symbol_pin_id UUID NOT NULL
symbol_pin_number VARCHAR NOT NULL
model_pin_index INT NULL
model_pin_name VARCHAR NULL
source_net_id UUID NULL
mapping_status VARCHAR NOT NULL
mapping_method VARCHAR NOT NULL
evidence JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 56.7 `simulation_ir_versions`

```text
id UUID PK
simulation_job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
fidelity_level VARCHAR NOT NULL
circuit_scope JSONB NOT NULL
node_count INT NOT NULL
element_count INT NOT NULL
model_count INT NOT NULL
testbench_count INT NOT NULL
analysis_count INT NOT NULL
measurement_count INT NOT NULL
simulation_ir_uri TEXT NOT NULL
simulation_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, ir_version)
```

## 56.8 `simulation_nodes`

```text
id UUID PK
simulation_ir_version_id UUID NOT NULL
stable_node_key VARCHAR NOT NULL
source_net_id UUID NULL
raw_net_name VARCHAR NULL
simulator_safe_name VARCHAR NOT NULL
node_role VARCHAR NOT NULL
power_domain VARCHAR NULL
ground_reference BOOLEAN NOT NULL
probe_default BOOLEAN NOT NULL
confidence NUMERIC(5,4) NOT NULL
source_map JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_ir_version_id, stable_node_key)
```

## 56.9 `simulation_elements`

```text
id UUID PK
simulation_ir_version_id UUID NOT NULL
part_id UUID NULL
reference_designator VARCHAR NOT NULL
element_type VARCHAR NOT NULL
node_bindings JSONB NOT NULL
model_binding_id UUID NULL
parameters JSONB NOT NULL
temperature JSONB NULL
enabled BOOLEAN NOT NULL
source_map JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_ir_version_id, reference_designator)
```

## 56.10 `simulation_testbenches`

```text
id UUID PK
simulation_job_id UUID NOT NULL
testbench_key VARCHAR NOT NULL
objective TEXT NOT NULL
circuit_scope JSONB NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
fidelity_requirement VARCHAR NOT NULL
temperature JSONB NULL
global_parameters JSONB NOT NULL
status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
testbench_uri TEXT NOT NULL
testbench_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, testbench_key)
```

## 56.11 `simulation_stimuli`

```text
id UUID PK
testbench_id UUID NOT NULL
stimulus_key VARCHAR NOT NULL
source_type VARCHAR NOT NULL
positive_node_id UUID NOT NULL
negative_node_id UUID NULL
configuration JSONB NOT NULL
source_impedance JSONB NULL
sequence_group VARCHAR NULL
enabled BOOLEAN NOT NULL
source_method VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(testbench_id, stimulus_key)
```

## 56.12 `simulation_loads`

```text
id UUID PK
testbench_id UUID NOT NULL
load_key VARCHAR NOT NULL
load_type VARCHAR NOT NULL
node_bindings JSONB NOT NULL
configuration JSONB NOT NULL
source_method VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(testbench_id, load_key)
```

## 56.13 `simulation_analyses`

```text
id UUID PK
testbench_id UUID NOT NULL
analysis_key VARCHAR NOT NULL
analysis_type VARCHAR NOT NULL
configuration JSONB NOT NULL
dependency_analysis_ids JSONB NOT NULL
required_capabilities JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(testbench_id, analysis_key)
```

## 56.14 `simulation_measurements`

```text
id UUID PK
testbench_id UUID NOT NULL
analysis_id UUID NOT NULL
measurement_key VARCHAR NOT NULL
measurement_type VARCHAR NOT NULL
expression JSONB NOT NULL
window JSONB NOT NULL
aggregation VARCHAR NOT NULL
units VARCHAR NULL
validity_conditions JSONB NOT NULL
specification_id UUID NULL
source_method VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(testbench_id, measurement_key)
```

## 56.15 `simulation_specification_sets`

```text
id UUID PK
tenant_id UUID NULL
specification_set_name VARCHAR NOT NULL
specification_set_version VARCHAR NOT NULL
project_id UUID NULL
product_profile VARCHAR NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(specification_set_name, specification_set_version)
```

## 56.16 `simulation_specifications`

```text
id UUID PK
specification_set_id UUID NOT NULL
specification_key VARCHAR NOT NULL
metric VARCHAR NOT NULL
operator VARCHAR NOT NULL
limits JSONB NOT NULL
units VARCHAR NOT NULL
conditions JSONB NOT NULL
analysis_scope JSONB NOT NULL
corner_scope JSONB NOT NULL
severity VARCHAR NOT NULL
margin_policy JSONB NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(specification_set_id, specification_key)
```

## 56.17 `simulation_corner_sets`

```text
id UUID PK
simulation_job_id UUID NOT NULL
corner_set_name VARCHAR NOT NULL
corner_set_version VARCHAR NOT NULL
dimensions JSONB NOT NULL
generation_policy JSONB NOT NULL
corner_count INT NOT NULL
seed BIGINT NULL
corner_set_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, corner_set_name, corner_set_version)
```

## 56.18 `simulation_corners`

```text
id UUID PK
corner_set_id UUID NOT NULL
corner_key VARCHAR NOT NULL
parameter_values JSONB NOT NULL
model_selections JSONB NOT NULL
temperature JSONB NULL
supply_values JSONB NOT NULL
load_values JSONB NOT NULL
corner_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(corner_set_id, corner_key)
```

## 56.19 `simulation_backends`

```text
id UUID PK
tenant_id UUID NULL
simulator_name VARCHAR NOT NULL
simulator_version VARCHAR NOT NULL
platform VARCHAR NOT NULL
license_type VARCHAR NOT NULL
executable_reference TEXT NOT NULL
executable_hash CHAR(64) NULL
capabilities JSONB NOT NULL
model_support JSONB NOT NULL
raw_output_formats JSONB NOT NULL
headless BOOLEAN NOT NULL
parallelism JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
last_health_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(simulator_name, simulator_version, platform)
```

## 56.20 `simulation_backend_capability_profiles`

```text
id UUID PK
simulation_backend_id UUID NOT NULL
capability_name VARCHAR NOT NULL
capability_status VARCHAR NOT NULL
conditions JSONB NOT NULL
evidence JSONB NOT NULL
last_verified_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_backend_id, capability_name)
```

## 56.21 `simulation_run_plans`

```text
id UUID PK
simulation_job_id UUID NOT NULL
simulation_ir_version_id UUID NOT NULL
simulation_backend_id UUID NOT NULL
testbench_id UUID NOT NULL
corner_set_id UUID NULL
run_plan_version INT NOT NULL
netlist_template_version VARCHAR NOT NULL
execution_policy JSONB NOT NULL
resource_policy JSONB NOT NULL
run_plan_uri TEXT NOT NULL
run_plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, run_plan_version)
```

## 56.22 `simulation_netlist_artifacts`

```text
id UUID PK
run_plan_id UUID NOT NULL
backend_id UUID NOT NULL
netlist_uri TEXT NOT NULL
netlist_hash CHAR(64) NOT NULL
include_manifest_uri TEXT NOT NULL
include_manifest_hash CHAR(64) NOT NULL
provenance_uri TEXT NOT NULL
provenance_hash CHAR(64) NOT NULL
compile_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.23 `simulation_preflight_runs`

```text
id UUID PK
run_plan_id UUID NOT NULL
status VARCHAR NOT NULL
finding_count INT NOT NULL
critical_count INT NOT NULL
findings_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 56.24 `simulation_runs`

```text
id UUID PK
simulation_job_id UUID NOT NULL
run_plan_id UUID NOT NULL
testbench_id UUID NOT NULL
analysis_id UUID NOT NULL
corner_id UUID NULL
run_attempt INT NOT NULL
simulator_backend_id UUID NOT NULL
status VARCHAR NOT NULL
convergence_strategy VARCHAR NOT NULL
command_manifest_uri TEXT NOT NULL
stdout_uri TEXT NULL
stderr_uri TEXT NULL
raw_artifact_uri TEXT NULL
raw_artifact_hash CHAR(64) NULL
exit_code INT NULL
runtime_ms BIGINT NULL
peak_memory_bytes BIGINT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
error_code VARCHAR NULL
UNIQUE(run_plan_id, analysis_id, corner_id, run_attempt)
```

## 56.25 `simulation_convergence_attempts`

```text
id UUID PK
simulation_run_id UUID NOT NULL
attempt_number INT NOT NULL
strategy VARCHAR NOT NULL
settings JSONB NOT NULL
status VARCHAR NOT NULL
diagnostics JSONB NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 56.26 `simulation_waveform_datasets`

```text
id UUID PK
simulation_run_id UUID NOT NULL
dataset_format VARCHAR NOT NULL
dataset_uri TEXT NOT NULL
dataset_hash CHAR(64) NOT NULL
axis_metadata JSONB NOT NULL
vector_manifest JSONB NOT NULL
row_count BIGINT NOT NULL
quality_flags JSONB NOT NULL
normalizer_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.27 `simulation_waveform_vectors`

```text
id UUID PK
waveform_dataset_id UUID NOT NULL
vector_key VARCHAR NOT NULL
source_expression VARCHAR NOT NULL
quantity_type VARCHAR NOT NULL
units VARCHAR NULL
data_type VARCHAR NOT NULL
quality_flags JSONB NOT NULL
source_node_or_element JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(waveform_dataset_id, vector_key)
```

## 56.28 `simulation_measurement_results`

```text
id UUID PK
simulation_run_id UUID NOT NULL
measurement_id UUID NOT NULL
status VARCHAR NOT NULL
numeric_value NUMERIC NULL
complex_value JSONB NULL
units VARCHAR NULL
margin JSONB NULL
validity_results JSONB NOT NULL
quality_flags JSONB NOT NULL
calculation_trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_run_id, measurement_id)
```

## 56.29 `simulation_specification_results`

```text
id UUID PK
simulation_run_id UUID NOT NULL
specification_id UUID NOT NULL
measurement_result_id UUID NULL
status VARCHAR NOT NULL
observed_value JSONB NULL
limit_value JSONB NOT NULL
margin JSONB NULL
condition_match_status VARCHAR NOT NULL
fidelity_status VARCHAR NOT NULL
explanation TEXT NULL
created_at TIMESTAMPTZ
```

## 56.30 `simulation_numerical_health_reports`

```text
id UUID PK
simulation_run_id UUID NOT NULL
overall_status VARCHAR NOT NULL
convergence_status VARCHAR NOT NULL
waveform_completeness VARCHAR NOT NULL
nan_count BIGINT NOT NULL
inf_count BIGINT NOT NULL
truncated BOOLEAN NOT NULL
undersampling_findings JSONB NOT NULL
retry_summary JSONB NOT NULL
warnings JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 56.31 `simulation_feature_results`

```text
id UUID PK
simulation_run_id UUID NOT NULL
feature_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
feature_values JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
quality_flags JSONB NOT NULL
algorithm_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.32 `simulation_interpretations`

```text
id UUID PK
simulation_job_id UUID NOT NULL
interpretation_version INT NOT NULL
interpretation_mode VARCHAR NOT NULL
structured_summary JSONB NOT NULL
human_summary TEXT NOT NULL
evidence_references JSONB NOT NULL
model_reference JSONB NULL
guardrail_status VARCHAR NOT NULL
interpretation_uri TEXT NOT NULL
interpretation_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, interpretation_version)
```

## 56.33 `simulation_root_cause_candidates`

```text
id UUID PK
simulation_job_id UUID NOT NULL
candidate_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
candidate_status VARCHAR NOT NULL
supporting_measurements JSONB NOT NULL
supporting_features JSONB NOT NULL
alternative_explanations JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
```

## 56.34 `simulation_repair_candidates`

```text
id UUID PK
simulation_job_id UUID NOT NULL
candidate_type VARCHAR NOT NULL
repair_scope VARCHAR NOT NULL
target_entities JSONB NOT NULL
proposed_changes JSONB NOT NULL
risk_level VARCHAR NOT NULL
expected_effect JSONB NOT NULL
preconditions JSONB NOT NULL
postconditions JSONB NOT NULL
required_approvals JSONB NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.35 `simulation_regression_packages`

```text
id UUID PK
simulation_job_id UUID NOT NULL
package_version INT NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
model_manifest_hash CHAR(64) NOT NULL
testbench_hash CHAR(64) NOT NULL
netlist_hash CHAR(64) NOT NULL
simulator_snapshot JSONB NOT NULL
expected_measurements JSONB NOT NULL
expected_specifications JSONB NOT NULL
waveform_hashes JSONB NOT NULL
package_uri TEXT NOT NULL
package_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, package_version)
```

## 56.36 `simulation_release_gate_runs`

```text
id UUID PK
simulation_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
model_readiness_status VARCHAR NOT NULL
numerical_health_status VARCHAR NOT NULL
specification_status VARCHAR NOT NULL
failed_spec_count INT NOT NULL
indeterminate_spec_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 56.37 `simulation_reports`

```text
id UUID PK
simulation_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
fidelity_level VARCHAR NOT NULL
model_coverage NUMERIC NULL
analysis_completion NUMERIC NULL
measurement_completion NUMERIC NULL
specification_pass_rate NUMERIC NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(simulation_job_id, report_version)
```

---

# 57. 对象存储

```text
derived/circuit-simulation/
  {tenant_id}/{project_id}/
    jobs/
      {simulation_job_id}/
        input/
          input-snapshot.json
          operating-conditions.json
          specification-set.json
          source-ir-manifest.json
        models/
          registry-snapshot.json
          binding-matrix.jsonl.zst
          includes/
          validation/
        ir/
          simulation-ir.json
          nodes.jsonl.zst
          elements.jsonl.zst
          testbenches/
          measurements/
          corners/
        run-plans/
          {run_plan_id}/
            plan.json
            netlist/
            include-manifest.json
            provenance.json
            preflight/
        runs/
          {simulation_run_id}/
            command-manifest.json
            stdout.log
            stderr.log
            raw/
            convergence/
            waveform/
              dataset.parquet
              vector-manifest.json
            measurements/
            numerical-health/
        interpretation/
          features.jsonl.zst
          spec-results.jsonl.zst
          root-causes.jsonl.zst
          interpretation.json
        repairs/
          candidates.jsonl.zst
          agent19/
        regression/
          packages/
          comparisons/
        reports/
          simulation-report.html
          simulation-report.pdf
          measurements.csv
          specifications.csv
          model-coverage.csv
          waveform-previews/
          release-gate.json
        debug/
          model-resolution-trace.jsonl.zst
          netlist-provenance.jsonl.zst
          measurement-trace.jsonl.zst
          resource-usage.json
```

---

# 58. API 设计

## 58.1 Simulation Jobs

```text
POST /api/v1/circuit-simulation/jobs
POST /api/v1/circuit-simulation/jobs/batch
GET  /api/v1/circuit-simulation/jobs/{id}
GET  /api/v1/circuit-simulation/jobs/{id}/events
POST /api/v1/circuit-simulation/jobs/{id}/cancel
POST /api/v1/circuit-simulation/jobs/{id}/retry
POST /api/v1/circuit-simulation/jobs/{id}/rerun
```

## 58.2 Model Registry

```text
POST /api/v1/circuit-simulation/models/import
GET  /api/v1/circuit-simulation/models
GET  /api/v1/circuit-simulation/models/{id}
POST /api/v1/circuit-simulation/models/{id}/validate
GET  /api/v1/circuit-simulation/models/{id}/dependencies
GET  /api/v1/circuit-simulation/models/{id}/compatibility
```

## 58.3 Model Binding

```text
POST /api/v1/circuit-simulation/jobs/{id}/resolve-models
GET  /api/v1/circuit-simulation/jobs/{id}/model-bindings
GET  /api/v1/circuit-simulation/model-bindings/{id}
POST /api/v1/circuit-simulation/model-bindings/{id}/review
POST /api/v1/circuit-simulation/model-bindings/{id}/override
```

## 58.4 Simulation IR and Testbench

```text
POST /api/v1/circuit-simulation/jobs/{id}/build-ir
GET  /api/v1/circuit-simulation/jobs/{id}/simulation-ir
POST /api/v1/circuit-simulation/jobs/{id}/testbenches
GET  /api/v1/circuit-simulation/jobs/{id}/testbenches
GET  /api/v1/circuit-simulation/testbenches/{id}
POST /api/v1/circuit-simulation/testbenches/{id}/validate
```

## 58.5 Analyses and Measurements

```text
POST /api/v1/circuit-simulation/testbenches/{id}/analyses
POST /api/v1/circuit-simulation/testbenches/{id}/measurements
GET  /api/v1/circuit-simulation/testbenches/{id}/analyses
GET  /api/v1/circuit-simulation/testbenches/{id}/measurements
POST /api/v1/circuit-simulation/measurements/{id}/validate
```

## 58.6 Backend and Plan

```text
GET  /api/v1/circuit-simulation/backends
GET  /api/v1/circuit-simulation/backends/{id}
POST /api/v1/circuit-simulation/backends/{id}/health
POST /api/v1/circuit-simulation/backends/{id}/contract-test
POST /api/v1/circuit-simulation/jobs/{id}/plan
GET  /api/v1/circuit-simulation/run-plans/{id}
POST /api/v1/circuit-simulation/run-plans/{id}/preflight
POST /api/v1/circuit-simulation/run-plans/{id}/compile
```

## 58.7 Run

```text
POST /api/v1/circuit-simulation/run-plans/{id}/run
GET  /api/v1/circuit-simulation/runs/{id}
GET  /api/v1/circuit-simulation/runs/{id}/logs
GET  /api/v1/circuit-simulation/runs/{id}/waveforms
GET  /api/v1/circuit-simulation/runs/{id}/measurements
GET  /api/v1/circuit-simulation/runs/{id}/numerical-health
POST /api/v1/circuit-simulation/runs/{id}/retry-convergence
```

## 58.8 Interpretation

```text
POST /api/v1/circuit-simulation/jobs/{id}/interpret
GET  /api/v1/circuit-simulation/jobs/{id}/interpretation
GET  /api/v1/circuit-simulation/jobs/{id}/spec-results
GET  /api/v1/circuit-simulation/jobs/{id}/features
GET  /api/v1/circuit-simulation/jobs/{id}/root-causes
```

## 58.9 Repair and Regression

```text
POST /api/v1/circuit-simulation/jobs/{id}/repair-candidates
GET  /api/v1/circuit-simulation/jobs/{id}/repair-candidates
POST /api/v1/circuit-simulation/repair-candidates/{id}/submit-to-agent19
POST /api/v1/circuit-simulation/jobs/{id}/regression-package
POST /api/v1/circuit-simulation/regression-packages/{id}/run
GET  /api/v1/circuit-simulation/regression-runs/{id}
```

## 58.10 Reports and Gate

```text
POST /api/v1/circuit-simulation/jobs/{id}/run-release-gate
GET  /api/v1/circuit-simulation/jobs/{id}/release-gate
GET  /api/v1/circuit-simulation/jobs/{id}/report
GET  /api/v1/circuit-simulation/jobs/{id}/measurements.csv
GET  /api/v1/circuit-simulation/jobs/{id}/specifications.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 59. 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
schematic-review.completed
firmware.configuration.ready
kicad.project-revision.ready
simulation.model.approved
simulation.specification-set.approved
simulation.requested
```

---

# 60. 输出事件

```text
simulation.input-blocked
simulation.model-missing
simulation.model-binding-review-required
simulation.testbench-ready
simulation.preflight-failed
simulation.started
simulation.progress
simulation.not-converged
simulation.completed
simulation.completed-with-warnings
simulation.specification-failed
simulation.interpretation-ready
simulation.repair-candidates-ready
simulation.regression-failed
simulation.release-gate-blocked
simulation.failed
```

## `simulation.completed`

```json
{
  "event_type": "simulation.completed",
  "event_version": "1.0",
  "simulation_job_id": "uuid",
  "project_id": "uuid",
  "project_revision": "sha",
  "fidelity_level": "device-aware",
  "analyses": {
    "dc": "passed",
    "ac": "passed",
    "transient": "passed",
    "noise": "passed_with_warning"
  },
  "specification_summary": {
    "pass": 11,
    "fail": 2,
    "indeterminate": 1
  },
  "report_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 61. Policy 和配置

```text
policies/
├── circuit-simulation-1.0.0.yaml
├── input-gates.yaml
├── model-resolution/
│   ├── source-priority.yaml
│   ├── binding.yaml
│   ├── pin-mapping.yaml
│   ├── licenses.yaml
│   └── fidelity.yaml
├── testbench/
│   ├── stimuli.yaml
│   ├── loads.yaml
│   ├── defaults.yaml
│   └── readiness.yaml
├── analyses/
│   ├── operating-point.yaml
│   ├── dc.yaml
│   ├── ac.yaml
│   ├── transient.yaml
│   ├── noise.yaml
│   ├── corners.yaml
│   └── monte-carlo.yaml
├── numerical/
│   ├── preflight.yaml
│   ├── convergence.yaml
│   ├── tolerances.yaml
│   └── waveform-quality.yaml
├── measurements/
│   ├── expressions.yaml
│   ├── validity.yaml
│   ├── units.yaml
│   └── specifications.yaml
├── interpretation/
│   ├── features.yaml
│   ├── root-causes.yaml
│   └── ai-boundaries.yaml
├── repair.yaml
├── regression.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 62. Rule Engine

用于：

```text
模型适用性
Testbench 默认值
Preflight
Measurement Validity
Specification
Numerical Health
Feature Classification
Repair Eligibility
```

要求：

- JSON/YAML Schema；
- Rule ID/Version；
- Scope；
- Priority；
- Conditions；
- Explain Trace；
- Dry Run；
- 禁止任意代码执行。

---

# 63. Expression Engine

支持受限表达式：

```text
V(node)
V(node1,node2)
I(element)
P(element)
magnitude
phase
db
real
imag
abs
mean
rms
integral
derivative
min/max
crossing
```

禁止：

```text
任意 Python
任意文件读取
任意系统调用
动态 Import
```

---

# 64. 单位系统

支持：

```text
V
A
Ohm
F
H
Hz
s
W
dB
V/sqrt(Hz)
A/sqrt(Hz)
°C
```

使用 Decimal/科学计数和显式 Prefix。

---

# 65. Model Resolution 算法

```text
Exact MPN candidate
→ package/variant filter
→ approved source filter
→ simulator/analysis compatibility
→ pin mapping validation
→ operating scope validation
→ fidelity scoring
→ selected binding or review
```

---

# 66. Testbench Template Registry

模板示例：

```text
rc_low_pass_ac
opamp_closed_loop_ac
opamp_step_transient
ldo_line_load_transient
buck_startup
mosfet_switch
crystal_small_signal_candidate
adc_input_settling
power_supply_noise
interface_edge_integrity
```

模板必须明确：

```text
适用条件
所需输入
默认值来源
测量
规格
局限
```

---

# 67. 自动 Testbench 生成边界

自动生成允许：

```text
用户目标明确
输入/负载条件明确
拓扑识别可信
模型覆盖满足要求
```

否则输出：

```text
testbench_information_required
```

---

# 68. Simulator Contract Tests

每个 Adapter 至少测试：

1. Version discovery；
2. OP；
3. DC；
4. AC；
5. Transient；
6. Noise；
7. Param Sweep；
8. Temperature；
9. Subcircuit；
10. Behavioral Source；
11. Raw waveform；
12. Measurement；
13. Syntax error；
14. Missing model；
15. Non-convergence；
16. Timeout；
17. Cancellation；
18. Parallel runs；
19. Path isolation；
20. Result determinism。

---

# 69. Golden Circuits

```text
voltage-divider
rc-low-pass
rlc-resonance
diode-rectifier
bjt-bias
mosfet-switch
opamp-inverting
opamp-filter
ldo-behavioral
buck-behavioral
crystal-test
noise-amplifier
```

---

# 70. Benchmark

## Model

```text
exact
family
ideal
missing
ambiguous
wrong pin order
include dependency
encrypted/proprietary
analysis incompatibility
```

## Testbench

```text
source/load
ground
bias
initial condition
startup
measurement
spec
```

## Analysis

```text
OP
DC
AC
Transient
Noise
Sweep
Temperature
Corner
Monte Carlo
```

## Numerical

```text
floating node
source loop
non-convergence
retry
undersampling
truncation
NaN/Inf
```

## Measurement

```text
gain
bandwidth
rise/fall
overshoot
settling
ripple
noise
power
efficiency
invalid edge
```

## Interpretation

```text
pass/fail
margin
fidelity warning
model limitation
root cause candidate
repair candidate
```

---

# 71. 初始质量目标

```text
Raw Input Preservation = 100%
Model Artifact Hash Coverage = 100%
Unapproved Model Auto-use = 0
Ambiguous Pin Mapping Auto-run = 0
Unknown Simulator Capability Treated as Supported = 0
Generated Netlist Determinism = 100%
Simulation Command Manifest Coverage = 100%
Convergence Retry Trace Coverage = 100%
Measurement Trace Coverage = 100%
Failed Measurement Reported as Pass = 0
Truncated Waveform Deterministic Conclusion = 0
NaN/Inf Silent Acceptance = 0
Specification Unit Mismatch Silent Acceptance = 0
AI-fabricated Waveform/Measurement = 0
Unapproved High-risk Design Auto-fix = 0
Regression Package Replay Consistency = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 72. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input/Model

1. Reviewed Netlist；
2. Candidate Netlist Block；
3. Agent 20 Block；
4. Exact Model；
5. Family Model；
6. Ideal Model；
7. Missing Model；
8. Ambiguous Model；
9. Wrong Pin Order；
10. Pin Count Mismatch；
11. Include Missing；
12. Include Cycle；
13. Duplicate Subckt；
14. License Block；
15. Simulator Incompatible；
16. Analysis Incompatible；
17. Encrypted Model；
18. Parameter Override；
19. Temperature Scope；
20. Artifact Hash Mismatch。

## Testbench/Preflight

21. OP；
22. DC Sweep；
23. AC；
24. Transient；
25. Noise；
26. Parameter Sweep；
27. Temperature Sweep；
28. Corner；
29. Monte Carlo；
30. Missing Ground；
31. Floating Node；
32. Ideal Voltage Loop；
33. Invalid Source；
34. Invalid Load；
35. Invalid Initial Condition；
36. Missing Probe；
37. Invalid Measurement；
38. Invalid Spec Unit；
39. PWL；
40. PWM。

## Execution/Numerical

41. ngspice Adapter；
42. Xyce Adapter；
43. Timeout；
44. Crash；
45. Non-convergence；
46. Gmin Retry；
47. Source Step；
48. Initial Condition Retry；
49. Invalid Extreme Tolerance Block；
50. Partial Result；
51. NaN；
52. Inf；
53. Truncated Time；
54. Undersampled Edge；
55. Missing Frequency Points；
56. Parallel Corner；
57. Cancellation；
58. Resume；
59. Cache；
60. Determinism。

## Measurement/Spec

61. Gain；
62. Bandwidth；
63. Phase；
64. Rise Time；
65. Fall Time；
66. Delay；
67. Overshoot；
68. Settling；
69. Ripple；
70. RMS；
71. Frequency；
72. Duty；
73. Power；
74. Efficiency；
75. Integrated Noise；
76. Invalid Edge；
77. Pass；
78. Fail；
79. Indeterminate；
80. Fidelity Insufficient。

## Workflow/Security

81. Interpretation；
82. Model Warning；
83. Root Cause Candidate；
84. Testbench Repair；
85. Model Repair；
86. Design Repair；
87. Agent 19 Preview；
88. Agent 19 Execute；
89. Regression Pass；
90. Regression Fail；
91. Baseline；
92. Waiver；
93. Unapproved Model；
94. Arbitrary Include Path；
95. Shell Injection；
96. Malicious Behavioral Expression；
97. Tenant Isolation；
98. 1000 Corners；
99. Large Waveform；
100. Audit Replay。

---

# 73. 性能要求

常规电路：

```text
10-500 elements
1-20 analyses/corners
```

目标：

```text
Input/Model Resolution P95 < 10 s
Simulation IR Generation P95 < 5 s
Netlist Generation P95 < 3 s
Preflight P95 < 5 s
Waveform Normalization P95 < 10 s for 1M points
Measurement P95 < 5 s for 100 metrics
```

仿真执行本身按电路和模型设超时，不承诺固定延迟。

大型任务：

```text
1000+ corners
100M+ waveform points
```

要求：

- 分片；
- Run Queue；
- Parallelism Limit；
- Backpressure；
- 流式结果；
- Parquet；
- Waveform Downsampling Preview；
- 原始数据保留；
- 取消和恢复；
- 预算控制。

---

# 74. 可观测性

```text
simulation_jobs_total{status,fidelity}
simulation_model_bindings_total{status,fidelity}
simulation_model_resolution_duration_seconds
simulation_preflight_findings_total{type,severity}
simulation_runs_total{backend,analysis,status}
simulation_run_duration_seconds{backend,analysis}
simulation_convergence_retries_total{strategy}
simulation_waveform_points_total{analysis}
simulation_waveform_quality_findings_total{type}
simulation_measurements_total{type,status}
simulation_specifications_total{status}
simulation_root_cause_candidates_total{type,status}
simulation_regression_runs_total{status}
simulation_release_gate_blocks_total{reason}
```

---

# 75. Dashboard

```text
Simulation Jobs
Model Coverage
Ambiguous/Missing Models
Testbench Readiness
Backend Health
Analysis Progress
Convergence
Waveform Quality
Measurements
Specification Pass/Fail
Corners/Monte Carlo
Fidelity
Repair Candidates
Regression
Release Readiness
Resource Usage
```

---

# 76. 安全与权限

- 电路、模型、波形、规格和报告按租户/项目隔离；
- 默认本地或私有 Worker；
- 模型必须 Hash、来源、版本、许可和批准；
- 不执行模型包中的脚本和二进制插件；
- Include 路径限制在模型包和工作区；
- 禁止路径穿越、Symlink Escape 和任意绝对路径；
- Behavioral Expression 使用仿真器允许且经规则审核的子集；
- Command 由类型化 Builder 生成；
- 禁止自由 Shell；
- 仿真 Worker 限制 CPU、内存、磁盘、进程和网络；
- 默认无公网；
- Proprietary Model 访问按许可；
- Raw Waveform 和模型下载鉴权；
- AI 只读取最小结构化结果；
- 私有工程和波形不发送外部模型；
- 修复审批与仿真权限分开；
- 高风险电源/补偿/时钟修改需高级审批；
- 报告不得隐藏失败 Corner；
- 日志脱敏本机路径和 Secret；
- Regression、Waiver 和 Release Gate 不可硬删除。

---

# 77. 推荐技术栈

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

仿真：

```text
ngspice
Xyce
optional LTspice adapter
optional ngspice WebAssembly
```

数据：

```text
NumPy
SciPy
Polars
PyArrow
DuckDB
```

解析：

```text
custom SPICE parser / grammar
Lark optional
```

图和规则：

```text
custom adjacency
JSON Schema
YAML
Decimal/unit engine
```

AI：

```text
local/private model optional
structured output
measurement/evidence-grounded
```

---

# 78. 推荐仓库结构

```text
circuit-simulation-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── circuit-simulation-agent-spec.md
│   ├── input-and-readiness-gates.md
│   ├── simulation-ir.md
│   ├── model-registry-and-binding.md
│   ├── spice-model-security.md
│   ├── testbench-ir.md
│   ├── stimulus-and-loads.md
│   ├── analysis-ir.md
│   ├── measurement-ir.md
│   ├── simulator-adapters.md
│   ├── netlist-generation.md
│   ├── preflight-and-convergence.md
│   ├── waveform-data-model.md
│   ├── result-interpretation.md
│   ├── corners-and-monte-carlo.md
│   ├── repair-and-regression.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-schematic-netlist-and-simulation-netlist-separated.md
│       ├── 0002-model-binding-is-explicit.md
│       ├── 0003-convergence-is-not-design-correctness.md
│       ├── 0004-measurement-validity-before-spec-evaluation.md
│       ├── 0005-fidelity-is-always-reported.md
│       ├── 0006-ai-interprets-real-results-only.md
│       └── 0007-repairs-run-through-agent19.md
├── src/
│   └── circuit_simulation/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── input.py
│       │   ├── model.py
│       │   ├── ir.py
│       │   ├── testbench.py
│       │   ├── analysis.py
│       │   ├── measurement.py
│       │   ├── result.py
│       │   └── regression.py
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent21.py
│       │   └── agent22.py
│       ├── models/
│       │   ├── registry.py
│       │   ├── parser.py
│       │   ├── dependencies.py
│       │   ├── licenses.py
│       │   ├── validation.py
│       │   ├── binding.py
│       │   ├── pin_mapping.py
│       │   └── fidelity.py
│       ├── ir/
│       │   ├── builder.py
│       │   ├── nodes.py
│       │   ├── elements.py
│       │   ├── parameters.py
│       │   ├── serialization.py
│       │   └── validation.py
│       ├── testbench/
│       │   ├── registry.py
│       │   ├── generator.py
│       │   ├── stimuli.py
│       │   ├── loads.py
│       │   ├── initial_conditions.py
│       │   └── readiness.py
│       ├── analyses/
│       │   ├── operating_point.py
│       │   ├── dc.py
│       │   ├── ac.py
│       │   ├── transient.py
│       │   ├── noise.py
│       │   ├── sweep.py
│       │   ├── corners.py
│       │   └── monte_carlo.py
│       ├── measurements/
│       │   ├── schema.py
│       │   ├── expression.py
│       │   ├── validity.py
│       │   ├── features.py
│       │   ├── specifications.py
│       │   └── trace.py
│       ├── simulators/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── capabilities.py
│       │   ├── ngspice.py
│       │   ├── xyce.py
│       │   ├── ltspice.py
│       │   └── contract_tests.py
│       ├── netlist/
│       │   ├── generator.py
│       │   ├── namespace.py
│       │   ├── includes.py
│       │   ├── provenance.py
│       │   └── compile.py
│       ├── preflight/
│       │   ├── topology.py
│       │   ├── floating.py
│       │   ├── ideal_loops.py
│       │   ├── units.py
│       │   ├── analyses.py
│       │   └── report.py
│       ├── execution/
│       │   ├── workspace.py
│       │   ├── command_builder.py
│       │   ├── runner.py
│       │   ├── convergence.py
│       │   ├── retry.py
│       │   ├── resources.py
│       │   └── cancellation.py
│       ├── waveforms/
│       │   ├── parsers.py
│       │   ├── normalization.py
│       │   ├── quality.py
│       │   ├── storage.py
│       │   ├── downsample.py
│       │   └── querying.py
│       ├── interpretation/
│       │   ├── features.py
│       │   ├── specs.py
│       │   ├── root_causes.py
│       │   ├── summary.py
│       │   └── limitations.py
│       ├── ai/
│       │   ├── schemas.py
│       │   ├── explanation.py
│       │   ├── guardrails.py
│       │   └── local_model.py
│       ├── repairs/
│       │   ├── candidates.py
│       │   ├── optimization.py
│       │   ├── risk.py
│       │   ├── agent19.py
│       │   └── verification.py
│       ├── regression/
│       │   ├── packages.py
│       │   ├── replay.py
│       │   ├── compare.py
│       │   └── gates.py
│       ├── reports/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── model-registry/
├── testbench-templates/
├── simulator-profiles/
├── specification-sets/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_simulation_readiness.py
    ├── import_spice_model.py
    ├── validate_model.py
    ├── build_simulation_ir.py
    ├── generate_testbench.py
    ├── run_simulation.py
    ├── inspect_waveform.py
    ├── evaluate_measurements.py
    ├── generate_simulation_report.py
    ├── create_regression_package.py
    └── run_simulation_benchmark.py
```


---

# 79. Codex 分阶段实施

不要让 Codex 一次实现全部 SPICE 方言、模型注册表、Testbench、四类分析、Corner、Monte Carlo、AI 解读、自动优化和 HIL 联动。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16、18、19、20、21、22 的真实实现和数据契约；
2. 当前 KiCad SPICE 属性、仿真网表和 Simulator 配置；
3. 当前 ngspice、Xyce、LTspice 或其他仿真器集成；
4. 当前 CircuitJS、ngspice-wasm 和 Web 仿真能力；
5. 当前 `.model`、`.subckt`、Include 和库解析；
6. 当前器件 SPICE 模型数据库和 Part-to-Model 映射；
7. 当前 Symbol Pin-to-Model Pin Mapping；
8. 当前模型来源、Hash、版本、License 和批准状态；
9. 当前 Simulation IR、Testbench、Stimulus、Load 和 Probe；
10. 当前 DC、AC、Transient、Noise、Sweep 和 Temperature；
11. 当前 Measurement、表达式、单位和规格；
12. 当前波形存储、查询、绘图和特征提取；
13. 当前收敛、Retry、Timeout 和资源限制；
14. 当前仿真结果解释、AI/RAG 和报告；
15. 当前修复候选和 Agent 19；
16. 当前 Regression、Golden Waveform 和 CI；
17. 当前 Queue、Worker、Container、Database、Object Storage 和权限；
18. 当前公开、合成、脱敏或授权 Fixture；
19. 统计真实模型覆盖率、Pin Mapping 覆盖率和分析支持；
20. 统计编译失败、收敛失败、测量失败和 Waveform 问题；
21. 统计现有 Testbench Template；
22. 只运行只读环境和版本探测；
23. 不执行生产模型；
24. 不调用外部模型；
25. 不修改原理图；
26. 不创建 Migration；
27. 不安装仿真器；
28. 不下载模型；
29. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Simulation Job；
- Input Snapshot；
- Model Registry；
- Model Binding；
- Pin Mapping；
- Simulation IR；
- Node/Element；
- Testbench；
- Stimulus/Load；
- Analysis；
- Measurement；
- Specification；
- Corner；
- Backend；
- Run Plan；
- Run Result；
- Waveform；
- Numerical Health；
- Interpretation；
- Repair；
- Regression；
- JSON Schema。

## Phase 2：Agent 16/18/20/22 Input Gate

实现：

- Project Revision；
- Netlist Release；
- Connectivity；
- Library/Pin-Pad；
- Review Conditions；
- Circuit Scope；
- Device Identity；
- Snapshot Hash；
- Blocked/Candidate/Ready；
- Diagnostics。

## Phase 3：SPICE Model Parser

实现：

- `.model`；
- `.subckt`；
- Ends；
- Parameters；
- Include/Lib；
- Sections；
- Comments；
- Continuation；
- Behavioral Sources；
- Unknown Syntax；
- Source Span；
- Dependency Graph；
- No Execution。

## Phase 4：Model Registry、Security 和 License

实现：

- Artifact；
- Hash；
- Source；
- Version；
- License；
- Supported Simulator/Analysis；
- Pin Schema；
- Operating Scope；
- Approval；
- Include Boundary；
- Malicious Resource Limits；
- Import Report。

## Phase 5：Model Validation Harness

实现：

- Syntax；
- Dependencies；
- Pin Count；
- Pin Names；
- Default Parameters；
- DC Smoke；
- AC Smoke；
- Transient Smoke；
- Temperature；
- Resource Limit；
- Simulator Contract；
- Validation Report。

## Phase 6：Part-to-Model Resolution

实现：

- Exact MPN；
- Family；
- Category；
- Package；
- Variant；
- Source Priority；
- Compatibility；
- Fidelity；
- Ambiguous/Missing；
- Explain Trace；
- Review Queue。

## Phase 7：Symbol-to-Model Pin Mapping

实现：

- Explicit Mapping；
- Model Metadata；
- Enterprise Mapping；
- Pin Number/Name；
- Power/Control/Thermal；
- Conflict；
- Unknown；
- Mapping Matrix；
- No Order Guessing；
- Golden Tests。

## Phase 8：Simulation IR Builder

实现：

- Node；
- Element；
- Parameter；
- Model Binding；
- Ground；
- Stable Name；
- Provenance；
- Disabled/DNP；
- Scope；
- Fidelity；
- Deterministic Serialization。

## Phase 9：Testbench IR 和 Template Registry

实现：

- Objective；
- Sources；
- Loads；
- Probes；
- Initial Conditions；
- Global Parameters；
- Temperature；
- Template Applicability；
- Required Inputs；
- Readiness；
- Review。

## Phase 10：Stimulus 和 Load Generator

实现：

- DC；
- Sine；
- Pulse；
- PWL；
- Step；
- PWM；
- Differential/Common-mode；
- Source Impedance；
- Resistive/Capacitive/Current/Dynamic Loads；
- Sequence；
- Determinism。

## Phase 11：Analysis IR V1

实现：

- Operating Point；
- DC Sweep；
- AC Sweep；
- Transient；
- Noise；
- Dependency；
- Validation；
- Required Source/Probe；
- Schema；
- Tests。

## Phase 12：Measurement IR 和 Expression Engine

实现：

- Safe AST；
- V/I/P；
- Complex；
- Mean/RMS/Peak；
- Crossing；
- Rise/Fall；
- Delay；
- Overshoot；
- Settling；
- Bandwidth；
- Integrated Noise；
- Validity；
- Unit；
- Trace；
- No Arbitrary Code。

## Phase 13：Specification Engine

实现：

- Set；
- Metric；
- Limit/Range；
- Conditions；
- Corner Scope；
- Units；
- Margin；
- Pass/Fail/Indeterminate；
- Fidelity Requirement；
- Evidence；
- Trace。

## Phase 14：Simulator Registry 和 Capability Selection

实现：

- Backend；
- Version；
- Platform；
- License；
- Analyses；
- Models；
- Raw Formats；
- Headless；
- Health；
- Capability Unknown；
- Selection；
- Fallback；
- Explanation。

## Phase 15：ngspice Adapter

实现：

- Version；
- Netlist；
- Batch Run；
- OP/DC/AC/Transient/Noise；
- Raw Parse；
- Logs；
- Timeout；
- Cancellation；
- Errors；
- Contract Tests；
- Resource Sandbox。

## Phase 16：Xyce Adapter

实现：

- Version；
- Netlist Mapping；
- Parallel Options；
- OP/DC/AC/Transient/Noise where supported；
- Output Parse；
- Errors；
- Contract Tests；
- Capability Differences。

## Phase 17：Optional LTspice/Other Adapter

仅在许可和安装条件明确时：

- Version；
- Headless/Batch；
- Proprietary Models；
- Output Parse；
- Contract Tests；
- No Redistribution；
- Disabled by Default。

## Phase 18：Netlist Generator 和 Provenance

实现：

- Simulator-specific Templates；
- Node Namespace；
- Model Namespace；
- Includes；
- Parameters；
- Analyses；
- Saves；
- Measurements；
- Deterministic Ordering；
- Statement Provenance；
- Hash。

## Phase 19：Preflight Engine

实现：

- Ground；
- Floating DC Nodes；
- Unconnected Model Pins；
- Undefined Models/Parameters；
- Duplicate Subckt；
- Include Cycle；
- Unsupported Syntax；
- Source/Analysis；
- Probe；
- Measurement；
- Ideal Loops/Cutsets；
- Numeric Range；
- Report。

## Phase 20：Execution Worker 和 Sandbox

实现：

- Workspace；
- File Manifest；
- Safe Command Builder；
- CPU/Memory/Disk/Time；
- No Network；
- Logs；
- Artifact Capture；
- Idempotency；
- Cancel；
- Retry；
- Cleanup；
- Audit。

## Phase 21：Convergence Controller

实现：

- Default；
- Topology-safe Preprocessing；
- Gmin；
- Source Step；
- Initial Condition；
- Limited Tolerance；
- Integration Method；
- Attempt Trace；
- Stop Rules；
- Manual Review；
- No Fake Convergence。

## Phase 22：Waveform Parsers 和 Normalized Dataset

实现：

- Backend Raw Formats；
- Time/Frequency/DC Axis；
- Real/Complex；
- Units；
- Stable Vector Names；
- Arrow/Parquet；
- Streaming；
- Hash；
- Quality Flags；
- Large Data Tests。

## Phase 23：Waveform Quality 和 Numerical Health

实现：

- NaN/Inf；
- Empty；
- Truncated；
- Stop-time；
- Point Count；
- Undersampling；
- Missing Edge；
- Alias Candidate；
- Retry Warning；
- Fidelity Warning；
- Gate。

## Phase 24：Measurement Evaluation V1

实现：

- Point/Window；
- Peak/RMS/Mean；
- Rise/Fall；
- Delay；
- Overshoot；
- Settling；
- Frequency/Period/Duty；
- Gain/Bandwidth；
- Noise；
- Power/Efficiency；
- Invalid/Indeterminate；
- Trace。

## Phase 25：Feature Extraction 和 Result Classification

实现：

- Startup；
- Steady-state；
- Ripple；
- Ringing；
- Oscillation Candidate；
- Saturation；
- Clipping；
- Bias；
- Noise Dominance；
- Device Stress；
- Algorithm Version；
- Confidence。

## Phase 26：Corner、Temperature 和 Parameter Sweep

实现：

- Dimension Schema；
- Cartesian/Selected；
- Supply；
- Temperature；
- Load；
- Component；
- Model Corner；
- Run Expansion；
- Parallel Limits；
- Worst Case；
- Summary。

## Phase 27：Monte Carlo

实现：

- Distribution；
- Correlation；
- Seed；
- Sampling；
- Failed Samples；
- Measurement Aggregation；
- Yield；
- Quantiles；
- Trace；
- Determinism with Seed。

## Phase 28：Interpretation Core

实现：

- Structured Summary；
- Objective；
- Fidelity；
- Model Coverage；
- Numerical Health；
- Measurements；
- Specs；
- Corners；
- Limitations；
- Programmatic Explanations；
- No AI Required。

## Phase 29：AI Result Explanation

实现：

- Minimal Structured Context；
- Local/Private Model；
- Grounded Output Schema；
- Evidence IDs；
- No Raw Fabrication；
- No Spec Changes；
- No Hidden Failures；
- Hallucination Guard；
- Explanation-only。

## Phase 30：Root Cause 和 Repair Candidate

实现：

- Design/Testbench/Model/Setting 分类；
- Evidence；
- Alternatives；
- Confidence；
- Value Change；
- Bias/Compensation；
- Model Replacement；
- Information Request；
- Risk；
- No Direct Execution。

## Phase 31：Agent 19 Repair Adapter

实现：

- Design Repair → Change Plan；
- Workspace；
- Preview；
- Approval；
- Agent 16/18/20/22 Regression；
- Simulation Rerun；
- Unexpected Change；
- Rollback。

## Phase 32：Parameter Optimization

实现：

- Bounded Sweep；
- E-series；
- Constraints；
- Multi-objective；
- Candidate Ranking；
- Robustness；
- Human Review；
- Regression；
- No Autonomous High-risk Change。

## Phase 33：Regression Packages 和 CI

实现：

- Package；
- Replay；
- Simulator Snapshot；
- Model Hash；
- Expected Measurements；
- Tolerances；
- Waveform Hash/Feature；
- Baseline；
- New/Worsened；
- CLI；
- Gate；
- SARIF/JUnit optional。

## Phase 34：Review Workbench

实现：

- Model Coverage；
- Binding Matrix；
- Testbench；
- Netlist；
- Run Progress；
- Waveforms；
- Measurements；
- Specs；
- Corners；
- Convergence；
- Interpretation；
- Repair；
- Regression Diff。

## Phase 35：API、Events、Storage 和 Observability

实现：

- APIs；
- Queue；
- Batch；
- Progress；
- Cancel/Resume；
- Object Storage；
- Parquet；
- Pagination；
- Permissions；
- Metrics；
- Dashboard；
- Audit。

## Phase 36：Benchmark、生产发布与灾难恢复

实现：

- Golden Circuits；
- Backend Matrix；
- Model Binding；
- Measurement；
- Non-convergence；
- Security；
- Performance；
- False Interpretation；
- Feature Flags；
- Adapter Rollback；
- Data Recovery；
- Capacity Planning。

## Phase 37：高级仿真，可选

稳定后：

- IBIS；
- S-parameter；
- Mixed-signal Co-simulation；
- Verilog-A where licensed；
- HDL Co-simulation；
- PCB Parasitic Extraction；
- Control-loop advanced analysis；
- Simulation-to-Lab correlation；
- 不把 SPICE 扩展成未经验证的 EM Solver。

---

# 80. Codex 工作纪律

Codex 必须：

1. Schematic Netlist 与 Simulation Netlist 分开；
2. Simulation IR 不覆盖 Agent 16/18；
3. Input Snapshot 不可变；
4. Agent 18 Release Level 先 Gate；
5. Agent 20阻断时不运行器件级确定性仿真；
6. Simulation Objective 必须明确；
7. Operating Conditions 必须显式；
8. Fidelity 永远报告；
9. 理想模型不描述为真实器件精度；
10. Model Source、Hash、Version、License 必填；
11. 未批准模型不自动使用；
12. Model Include 依赖完整；
13. 不执行模型脚本；
14. Pin Mapping 显式；
15. 不按 Pin Count/顺序硬猜；
16. Power/Control/Thermal Pin 不忽略；
17. Ambiguous Mapping 不运行；
18. Family Model 降低 Fidelity；
19. Black Box 行为必须明确；
20. 不静默删除无模型器件；
21. Testbench 与 Design 分开；
22. Stimulus 和 Load 有来源；
23. 自动默认值有规则和证据；
24. Ground 必须显式；
25. 初始条件不随意强加；
26. UIC 使用必须报告；
27. AC 前检查 Operating Point；
28. Noise 明确 Input/Output/Band；
29. Transient 检查 Stop/Max Step；
30. DC 区分 Source/Parameter；
31. Measurement 先检查 Validity；
32. 找不到边沿不得返回 0；
33. 测量失败不得 Pass；
34. Specification 条件和单位匹配；
35. Indeterminate 不当 Pass；
36. Fidelity 不足时不判确定性 Pass；
37. Simulator Capability 按版本；
38. Unknown 不视为 Supported；
39. Command 不用自由 Shell；
40. Workspace 路径受控；
41. 默认无网络；
42. 每次 Run 保存 Simulator Version；
43. 每次 Run 保存 Netlist Hash；
44. 每次 Run 保存随机 Seed；
45. Convergence Retry 全记录；
46. 不无限放宽容差；
47. 不删除器件换取收敛；
48. 收敛不等于电路正确；
49. Exit Code 0 不等于结果有效；
50. Raw Waveform 保留；
51. Normalized Waveform 有 Hash；
52. NaN/Inf/Truncated 是 Gate；
53. Downsample 只用于显示，不替代测量；
54. 测量基于原始/完整数据；
55. Corner 不隐藏失败点；
56. Monte Carlo 分布和相关性明确；
57. 失败样本不能静默删除；
58. AI 只解释真实结构化结果；
59. AI 不改变 Spec；
60. AI 不伪造波形和数值；
61. AI 不隐藏模型局限；
62. Root Cause 是候选而非事实；
63. Design/Testbench/Model/Setting Repair 分开；
64. Agent 19执行前 Preview；
65. 设计修复后完整回归；
66. 参数优化有边界和目标；
67. 优化候选需人工审核；
68. Regression 锁定模型和仿真器；
69. 版本升级不覆盖历史结果；
70. Review Pass 不等于硬件验证完成；
71. 不发送私有电路和波形给外部模型；
72. 公开 Fixture 必须有许可；
73. 不伪造模型、运行、测量、仿真和 Benchmark；
74. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Model/Testbench/Adapter 变化；
    - 测试命令；
    - 真实结果；
    - Model Coverage；
    - Pin Mapping；
    - Compile/Convergence；
    - Waveform Quality；
    - Measurement/Spec；
    - Interpretation；
    - Regression；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 81. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/circuit-simulation-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第23个 Agent：

Circuit Simulation, Testbench Generation & Result Interpretation Agent /
电路仿真与结果解读 Agent。

本 Agent 接收：

- Agent 16 Project/Schematic/Part/Pin/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Library/Pin-Pad 校验；
- Agent 22 ERC/AI Review Finding 和工作条件；
- Agent 21 Firmware 时序和外设配置，可选；
- 器件 SPICE 模型、模型 Pin Mapping 和 Model Registry；
- 用户仿真目标、输入、负载、温度、容差和规格；

生成并执行：

- Simulation IR；
- Testbench IR；
- Stimulus/Load；
- Operating Point；
- DC；
- AC；
- Transient；
- Noise；
- Parameter/Temperature/Corner/Monte Carlo；
- Measurement；
- Specification Evaluation；
- Numerical Health；
- Result Interpretation；
- Repair Candidate；
- Regression Package。

本 Agent 不使用 LLM 建立连接、生成虚假模型或修改测量结果。AI 只解释真实、已验证的结构化仿真输出。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16、18、19、20、21、22 规格和实际代码；
3. docs/circuit-simulation-agent-spec.md；
4. 当前 KiCad SPICE、Simulation Netlist 和模型属性；
5. 当前 CircuitJS、ngspice-wasm、ngspice、Xyce、LTspice；
6. 当前 SPICE Parser、Model Registry 和 Part-to-Model；
7. 当前 Symbol Pin-to-Model Pin Mapping；
8. 当前模型 Source/Hash/Version/License；
9. 当前 Simulation/Testbench/Stimulus/Load/Probe；
10. 当前 OP/DC/AC/Transient/Noise/Sweep；
11. 当前 Measurement/Unit/Specification；
12. 当前 Convergence/Retry/Timeout；
13. 当前 Waveform Storage/Query/Plot；
14. 当前 Feature/Interpretation/AI；
15. 当前 Agent 19 Repair；
16. 当前 Regression/CI；
17. 当前 Worker/Container/Queue/Storage/Permission；
18. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Schematic Netlist != Simulation Netlist；
- Input Snapshot Immutable；
- Agent 18/20 Gate；
- Objective/Operating Conditions Explicit；
- Fidelity Always Reported；
- Model Source/Hash/Version/License；
- No Unapproved Model；
- Model Includes Complete；
- No Model Script Execution；
- Explicit Pin Mapping；
- No Pin-order Guessing；
- Ambiguous Mapping Blocks；
- Family/Ideal/Black-box Fidelity Downgrade；
- No Silent Device Deletion；
- Design/Testbench Separation；
- Ground Explicit；
- AC Requires Valid OP；
- Noise Requires Input/Output/Band；
- Transient Stop/Max Step Validated；
- Measurement Validity First；
- Failed Measurement != Pass；
- Spec Unit/Condition Match；
- Indeterminate != Pass；
- Backend Capability Versioned；
- Unknown != Supported；
- No Free-form Shell；
- Sandbox/No Network；
- Run Saves Version/Hash/Seed；
- Retry Trace；
- No Fake Convergence；
- Exit Code 0 != Valid Result；
- Raw Waveform Preserved；
- NaN/Inf/Truncated Gate；
- Downsample Display Only；
- Failed Corners Not Hidden；
- Monte Carlo Distribution/Correlation Explicit；
- AI Explains Real Results Only；
- AI Does Not Change Specs；
- Root Cause Is Candidate；
- Repair Type Separation；
- Agent 19 Preview/Approval；
- Full Regression After Design Repair；
- Optimization Bounded；
- Regression Locks Model/Simulator；
- Pass != Hardware Validation；
- 不发送私有电路和波形给外部模型；
- 不用私有模型做公开 Fixture；
- 不伪造仿真、测量、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不运行生产电路：

1. 侦察当前仓库；
2. 检查 Agent 16/18/19/20/21/22 Contract；
3. 查找 KiCad SPICE 和 Simulation Netlist；
4. 查找 CircuitJS/ngspice-wasm/ngspice/Xyce/LTspice；
5. 查找 SPICE Model Parser；
6. 查找 Model Registry/Binding；
7. 查找 Pin Mapping；
8. 查找 Model Source/Hash/License；
9. 查找 Simulation IR；
10. 查找 Testbench/Stimulus/Load；
11. 查找 OP/DC/AC/Transient/Noise；
12. 查找 Measurement/Specification；
13. 查找 Netlist Generator/Preflight；
14. 查找 Convergence/Retry；
15. 查找 Waveform Parser/Storage；
16. 查找 Numerical Health；
17. 查找 Feature/Interpretation/AI；
18. 查找 Repair/Agent 19；
19. 查找 Regression/CI；
20. 查找 Worker/Container/Security；
21. 统计模型覆盖、Pin Mapping 和 Adapter 能力；
22. 统计编译、收敛、测量和波形失败；
23. 抽样分析开源、合成、脱敏或授权 Fixture；
24. 在 docs/circuit-simulation-implementation-plan.md 中生成实施计划；
25. 在 docs/input-and-readiness-gates.md 中定义输入；
26. 在 docs/simulation-ir.md 中定义 IR；
27. 在 docs/model-registry-and-binding.md 中定义模型；
28. 在 docs/spice-model-security.md 中定义安全；
29. 在 docs/testbench-ir.md 中定义 Testbench；
30. 在 docs/stimulus-and-loads.md 中定义激励和负载；
31. 在 docs/analysis-ir.md 中定义分析；
32. 在 docs/measurement-ir.md 中定义测量；
33. 在 docs/simulator-adapters.md 中定义 Adapter；
34. 在 docs/netlist-generation.md 中定义网表；
35. 在 docs/preflight-and-convergence.md 中定义收敛；
36. 在 docs/waveform-data-model.md 中定义波形；
37. 在 docs/result-interpretation.md 中定义解读；
38. 在 docs/corners-and-monte-carlo.md 中定义 Corner；
39. 在 docs/repair-and-regression.md 中定义修复；
40. 在 docs/ai-boundaries.md 中定义 AI；
41. 在 docs/security.md 中定义安全；
42. 在 docs/circuit-simulation-migration-plan.md 中定义旧能力迁移；
43. 在 docs/circuit-simulation-benchmark-plan.md 中定义 Benchmark；
44. 给出拟新增、拟修改和拟复用文件；
45. 给出 Phase 1 精确范围；
46. 不修改业务代码；
47. 不创建 Migration；
48. 不安装仿真器；
49. 不下载模型；
50. 不运行生产模型；
51. 不调用外部模型；
52. 不读取或打印 Secret；
53. 运行仓库已有 lint、type check、test、build 和 security scan；
54. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/18/19/20/21/22 Contract；
- Input/Fidelity Gate；
- Model Registry/Binding；
- Pin Mapping；
- Simulation IR；
- Testbench/Stimulus/Load；
- Analysis；
- Measurement/Specification；
- Simulator Adapters；
- Netlist/Preflight；
- Convergence；
- Waveform；
- Numerical Health；
- Interpretation；
- Corner/Monte Carlo；
- Repair/Agent 19；
- Regression；
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

# 82. 后续 Phase 提示词模板

```text
继续实现 Circuit Simulation Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16、18、19、20、21、22、23 规格；
3. 阅读 Circuit Simulation Implementation Plan；
4. 阅读 Input、Model、Simulation IR、Testbench、Analysis、Measurement、Adapters、Convergence、Waveform、Interpretation、Regression、AI、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Input/Model/Testbench/Result Traceability；
- Explicit Pin Mapping；
- Versioned Backend Capabilities；
- Deterministic Netlist；
- Safe Execution；
- Measurement Validity；
- Numerical Health Gate；
- Fidelity Disclosure；
- AI Grounded Interpretation；
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
9. simulator contract test；
10. model/pin mapping test；
11. convergence/waveform test；
12. measurement/spec test；
13. regression test；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Model/Testbench/Adapter 变化；
- 测试命令和真实结果；
- Model Coverage；
- Pin Mapping；
- Compile/Convergence；
- Waveform Quality；
- Measurement/Spec；
- Interpretation；
- Regression；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 83. MVP 演示流程

1. 选择一份二阶有源低通滤波器 KiCad 工程；
2. Agent 16解析器件、Pin 和 Net；
3. Agent 18提供 Reviewed Netlist；
4. Agent 20确认库和 Pin-Pad 通过；
5. Agent 22提供目标：截止频率、通带增益、噪声和阶跃过冲；
6. 建立 Input Snapshot；
7. 解析运放精确型号；
8. Model Registry 找到批准的厂商 Subcircuit；
9. 验证模型适用于 AC、Transient 和 Noise；
10. 检查 Symbol Pin-to-Model Pin Mapping；
11. 发现电源 Pin 顺序与模型说明不同；
12. 使用批准的显式 Mapping；
13. 为电阻、电容绑定通用模型；
14. Fidelity 判为 Device-aware；
15. 建立 Simulation IR；
16. 生成正负电源；
17. 生成 AC 小信号源；
18. 生成 1kΩ 与 20pF 负载；
19. 生成 Operating Point；
20. 生成 AC 10Hz–10MHz；
21. 生成 Transient Step；
22. 生成 Noise 10Hz–100kHz；
23. 生成测量：DC Bias、Passband Gain、-3dB Frequency、Peak、Phase、Rise Time、Overshoot、Settling、Integrated Noise；
24. 生成规格；
25. Backend 选择 ngspice；
26. 生成确定性网表和 Include Manifest；
27. Preflight 发现输出节点名需转义；
28. Generator 修复 Simulator-safe Name；
29. Netlist Compile 通过；
30. Operating Point 通过；
31. AC 运行通过；
32. Transient 第一次未收敛；
33. 保存失败日志；
34. Source Stepping 仍失败；
35. 添加仅用于测试平台的有限源阻抗；
36. 标记 `testbench_repair`，不修改设计；
37. Transient 通过；
38. Noise 通过；
39. Waveform Normalizer 读取原始数据；
40. 检查无 NaN/Inf 和截断；
41. 计算 -3dB 截止频率；
42. 截止频率比目标低 18%；
43. 通带增益通过；
44. 过冲为 14%，规格要求小于 10%，Fail；
45. 积分噪声通过；
46. Corner Sweep 加入 R/C ±5%、供电和温度；
47. Worst Case 过冲达到 21%；
48. 生成 Root Cause Candidate：阻尼不足或运放 GBW/负载交互；
49. 自动参数扫描反馈电阻旁补偿电容；
50. 生成三个候选值；
51. 结果显示一个候选满足截止频率和过冲，但噪声略升；
52. 生成 Multi-objective Candidate Report；
53. 工程师选择候选；
54. Agent 19在 Workspace 中修改电容值；
55. Agent 16/18/20/22 回归；
56. Agent 23重新运行相同 Regression Package；
57. 所有 Corner 中截止频率、过冲和噪声通过；
58. 创建 Golden Measurement；
59. 保存 Model/Simulator/Netlist/Waveform Hash；
60. 发布 `simulation.completed`。

---

# 84. 生产上线顺序

第一阶段：

```text
Reviewed Netlist Input
Model Registry
Explicit Pin Mapping
Simulation IR
OP / DC / AC / Transient
ngspice Adapter
Preflight
Waveform Normalization
Basic Measurements
Report-only
```

第二阶段：

```text
Noise
Xyce Adapter
Corner/Temperature
Convergence Controller
Specification Gate
Repair Candidate
Agent 19 Regression
```

第三阶段：

```text
Monte Carlo
Parameter Optimization
AI Grounded Explanation
IBIS/S-parameter
PCB Parasitics
Simulation-to-Lab Correlation
```

上线优先确保：

```text
究竟使用了哪一份器件模型
模型引脚是否与原理图正确对应
测试激励和负载是否代表真实工作条件
仿真是否真正完成并具备足够数值质量
每个测量值和结论是否可以完整重放
```

一个靠谱的仿真 Agent，不应该只会画出漂亮曲线。它还得敢于说：“这次结果不能下结论——因为模型只是理想模型、Transient 没有完整收敛，或者负载条件根本还没定义。”这句话往往比一张看起来很顺滑的波形值钱得多。
