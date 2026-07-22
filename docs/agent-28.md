# 3D 与机械干涉 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：28  
> Agent 名称：3D Mechanical Interference, Assembly Clearance & Accessibility Agent  
> 中文名称：3D 与机械干涉 Agent  
> 类型：程序型  
> 版本：V1.0  
>
> 定位：基于 Agent 16–27 输出的结构化 EDA 工程、Footprint/3D 模型、库映射、PCB 约束、Placement IR、Routing IR 和 DRC/SI/PI/EMC Findings，以及外壳、结构件、螺丝、屏蔽罩、散热器、连接器配对件、线束、FPC、按钮、旋钮和装配工艺数据，建立统一机械装配坐标系和 3D Assembly IR，执行静态实体碰撞、最小间距、板边/高度、连接器方向与插拔包络、螺丝和工具可达性、FPC/线束弯曲、按钮行程、屏蔽罩与散热器空间、装配顺序、返修空间和公差叠加分析，生成证据化 Finding、修复候选、ECAD/MCAD 变更反馈和 Release Gate。
>
> 上游：
> - Agent 16：Project IR、PCB IR、Board Outline、Cutout、Hole、Footprint、Pad、Zone、Track、Via、Source Map
> - Agent 18：Reviewed Netlist，用于理解连接器、FPC、按键、传感器和功能链
> - Agent 20：Symbol/Footprint/3D Model、模型路径、模型映射、Pin-Pad、Courtyard、高度和库版本校验
> - Agent 21：接口、外设、显示、摄像头、按键、FPC 和连接器功能配置
> - Agent 22：接口保护、额定值、机械敏感器件和典型应用审查
> - Agent 23：器件功耗、温升候选、散热需求和工作模式
> - Agent 24：Placement、Keepout、Height、Board-edge、HV 和 Rule Area 约束
> - Agent 25：Legalized Placement IR、固定器件、功能分区、Mechanical Profile、Board Outline Candidate
> - Agent 26：Routing IR、铜皮、Via、Zone 和可能影响结构空间的对象
> - Agent 27：热、EMC、屏蔽、外壳、线缆和接口保护相关 Finding
> - Agent 19：KiCad MCP/IPC/CLI、Workspace、Placement/Keepout/Board Outline Change Plan、Readback 和 Rollback
> - MCAD：外壳、上盖、下壳、支架、面板、屏蔽罩、散热器、螺柱、紧固件和配对连接器模型
> - 供应商：STEP、BREP、Parasolid 导出、STL、OBJ、3MF、VRML、DXF、IDF 或其他受支持机械资料
> - 工艺：装配顺序、扭矩、工具尺寸、返修空间、连接器插拔方向、线缆/FPC 弯曲半径和测试夹具
>
> 下游：
> - Agent 20：缺失/错误/错位 3D 模型、封装与模型映射、模型版本和坐标修复
> - Agent 24：高度区、连接器插拔区、工具区、FPC 区、风道区和机械 Keepout
> - Agent 25：移动、旋转、翻面器件，调整板框、固定件和功能分区
> - Agent 26：避免铜与螺丝、金属屏蔽、板边和开槽区域冲突
> - Agent 27：散热、屏蔽、机壳地、EMC 开孔和热机械风险回归
> - Agent 19：在受控 Workspace 中执行批准的 ECAD 变更
> - MCAD Change Package：输出结构侧修改建议，不直接改写外部生产 CAD
> - Agent 43：NPI 装配冻结、结构版次和制造发布
> - Agent 44：机械加工、外壳、散热器、屏蔽罩和装配报价
> - Agent 45：治具、探针、按键、接口和维修可达性
>
> 核心输出：
> - Mechanical Review Input Snapshot
> - Coordinate Frame Registry
> - Unit and Handedness Validation
> - Mechanical Model Registry and Binding
> - Model Fidelity and Readiness Report
> - Canonical Mechanical Assembly IR
> - Board Assembly Model
> - Component Envelope Model
> - Static Collision Result
> - Minimum Clearance Result
> - Height and Enclosure Zone Result
> - Connector Orientation and Mating Result
> - Connector Insertion/Removal Sweep Result
> - Screw, Standoff and Hole Alignment Result
> - Tool Access Result
> - Shield Can and Heatsink Result
> - FPC/Cable Bend and Sweep Result
> - Button/Knob/Switch Travel Result
> - Assembly Sequence Result
> - Service and Rework Accessibility Result
> - Tolerance Stack-up Result
> - Thermal Expansion Candidate
> - Unified Mechanical Finding IR
> - ECAD Repair Candidate
> - MCAD Repair Candidate
> - Agent Feedback Package
> - Agent 19 Change Plan
> - Post-write Mechanical Regression
> - Mechanical Release Manifest
>
> 重要边界：
> - 本 Agent 检查机械可装配性和空间风险，不替代结构工程师签核、有限元、跌落、振动、疲劳、材料、注塑、可靠性和法规认证。
> - 3D 模型“看起来没碰”不等于满足公差、插拔、工具、返修和动态运动要求。
> - STEP/B-Rep、网格模型、外接框、Courtyard 和高度字段属于不同精度等级，不能混成同一种“实体真值”。
> - 缺失精确模型时，只能做包络或高度级审查，不能宣称精确无干涉。
> - 不从 3D 渲染截图估算尺寸。
> - 不根据模型文件名猜测单位、坐标轴、原点和正反面。
> - 不把 PCB 原点、Footprint 原点、模型局部原点和外壳装配原点默认视为相同。
> - 不忽略左手/右手坐标系、轴方向、角度单位和镜像。
> - 不把零距离接触自动判定为有效装配；应根据允许接触、压配、导热垫、胶、泡棉和公差策略判断。
> - 不把软性线束、FPC 和弹性件当刚体直线。
> - 不将 FPC 最小弯曲半径简化为二维折线距离。
> - 不把连接器本体无碰撞判定为“可以插拔”；必须检查配对件和运动扫掠体。
> - 不把螺丝孔对齐判定为“可以拧紧”；必须检查螺丝头、垫圈、螺母、螺柱、工具轴线和扳手/批头空间。
> - 不把按钮本体位置正确判定为“能按”；必须检查帽、柱、行程、倾斜和外壳开口。
> - 不自动移动固定连接器、安装孔、屏蔽罩、散热器或外壳基准件。
> - 不直接修改唯一生产 ECAD/MCAD 文件；所有 ECAD 变更通过 Agent 19，MCAD 变更以 Patch/Change Request 形式输出。
> - 不将客户结构、外壳、机械 CAD 和供应商模型发送给外部通用模型。

---

# 1. Agent 28 的系统位置

```text
ECAD + 3D Models + MCAD + Assembly Process
                         ↓
Input / Model / Coordinate Readiness Gate
                         ↓
Coordinate Frame and Unit Normalization
                         ↓
Canonical Mechanical Assembly IR
                         ↓
Broad-phase Collision and Distance Search
                         ↓
Narrow-phase Exact / Mesh / Envelope Analysis
                         ↓
Dynamic Sweep / Cable / FPC / Button / Connector Analysis
                         ↓
Tolerance / Tool / Assembly Sequence / Rework Analysis
                         ↓
Unified Finding and Repair Candidates
                         ↓
Agent 20 / 24 / 25 / 26 / 27 Feedback
                         ↓
Agent 19 Controlled ECAD Write
                         ↓
Reparse / Rebuild Assembly / Mechanical Regression
```

---

# 2. 为什么需要独立 Agent 28

常见机械问题包括：

1. 连接器朝向正确，但配对插头插入时碰上外壳加强筋；
2. USB-C 本体没撞壳，但插拔线缆头需要的空间不足；
3. 板上器件高度低于上盖，但装配公差叠加后压到壳体；
4. 安装孔位置正确，但螺丝头撞上连接器或屏蔽罩；
5. 螺丝可以放进去，但批头无法垂直进入；
6. FPC 连接器位置正确，但翻盖打开时撞到屏蔽罩；
7. FPC 长度足够，但实际弯曲半径小于供应商限制；
8. 按钮对准外壳开孔，但行程中卡住或侧向偏压；
9. 散热器不碰元件，但压紧结构与电容 Courtyard 冲突；
10. 屏蔽罩盖得上，却无法在 SMT 后返修内部器件；
11. 板框与外壳吻合，但铜皮、Via 或焊盘离金属螺柱过近；
12. 3D 模型坐标轴错了 90°，视觉上仍可能被误认为正确；
13. STEP 模型单位是毫米，导入链错误地当作英寸；
14. 网格模型过度简化，漏掉卡扣、凸台和加强筋；
15. 两个零件无静态碰撞，但装配过程中路径互相阻挡；
16. 所有零件最终位置可行，但装配顺序不存在；
17. 高器件避开上盖，却挡住风道；
18. 连接器外壳与屏蔽罩形成意外导电接触；
19. 螺丝、垫圈和螺柱组合高度不匹配；
20. 外壳更新了 Revision，ECAD 仍绑定旧结构模型。

Agent 28 的职责是：

```text
Mechanical Truth
→ Coordinate and Model Fidelity
→ Static and Dynamic Interference
→ Assembly Accessibility
→ Tolerance and Sequence
→ Evidence-grounded Repair
```

---

# 3. 审查层级

## Level 0：二维和字段级

```text
Board outline
Mounting hole
Board-edge
Footprint courtyard
Height field
Keepout
Connector side/orientation
```

## Level 1：3D 包络级

```text
AABB / OBB
Extruded courtyard
Height envelope
Connector insertion envelope
Tool envelope
```

## Level 2：网格级

```text
Triangle mesh collision
Mesh distance
Swept mesh
Simplified cable/FPC volume
```

## Level 3：精确 B-Rep 级

```text
STEP/BREP solid collision
Exact minimum distance
Face/edge contact
Boolean intersection
Precise section
```

## Level 4：公差与装配级

```text
Tolerance stack-up
Motion sweep
Assembly sequence
Tool access
Service/rework
```

## Level 5：测量和实物关联

```text
CMM
3D scan
Photogrammetry
Fit check
Assembly trial
Torque/tool test
```

每个 Finding 必须记录 `analysis_level` 和 `model_fidelity`。

---

# 4. Model Fidelity

```text
M0 metadata_only
M1 height_or_bbox
M2 extruded_2d_envelope
M3 mesh_approximation
M4 exact_brep
M5 tolerance_qualified
M6 measurement_correlated
```

Fidelity 不足时：

```text
exact_clearance_pass → prohibited
no_collision → qualified as envelope-only
dynamic_fit → indeterminate
```

---

# 5. 建设目标

系统必须能够：

1. 接收 Agent 16 PCB IR；
2. 接收 Agent 20 3D Model Binding；
3. 接收 Agent 24 Mechanical Constraint；
4. 接收 Agent 25 Placement IR；
5. 接收 Agent 26 Copper/Zone/Routing IR；
6. 接收 Agent 27 Thermal/Shield/EMC Finding；
7. 接收 Board Outline；
8. 接收 Board Thickness；
9. 接收 Cutout；
10. 接收 Slot；
11. 接收 Mounting Hole；
12. 接收 NPTH/PTH；
13. 接收 Footprint Position；
14. 接收 Footprint Rotation；
15. 接收 Footprint Side；
16. 接收 3D Model Position；
17. 接收 3D Model Rotation；
18. 接收 3D Model Scale；
19. 接收 Courtyard；
20. 接收 Component Height；
21. 接收 STEP/BREP；
22. 接收 STL/OBJ/3MF；
23. 接收 VRML；
24. 接收 DXF/IDF；
25. 接收 Enclosure；
26. 接收 Top/Bottom Cover；
27. 接收 Bezel；
28. 接收 Bracket；
29. 接收 Standoff；
30. 接收 Screw；
31. 接收 Nut；
32. 接收 Washer；
33. 接收 Heat Sink；
34. 接收 Thermal Pad；
35. 接收 Shield Can；
36. 接收 Spring Finger；
37. 接收 Connector Mate；
38. 接收 Cable Plug；
39. 接收 FPC；
40. 接收 Wire Harness；
41. 接收 Button Cap；
42. 接收 Light Pipe；
43. 接收 Knob；
44. 接收 Switch Travel；
45. 接收 Fan；
46. 接收 Air Duct；
47. 接收 Battery；
48. 接收 Adhesive/Foam；
49. 接收 Test Fixture；
50. 接收 Tool；
51. 接收 Assembly Sequence；
52. 接收 Tolerance；
53. 接收 Material Expansion Candidate；
54. 建立不可变 Input Snapshot；
55. 建立 Model Registry Snapshot；
56. 建立 Coordinate Frame Registry；
57. 建立 Assembly Revision；
58. 建立 Unit Registry；
59. 建立 Handedness；
60. 建立 Axis Convention；
61. 建立 Board Frame；
62. 建立 Footprint Frame；
63. 建立 Model Local Frame；
64. 建立 MCAD Assembly Frame；
65. 建立 Fixture Frame；
66. 建立 Transform Chain；
67. 验证 Transform；
68. 验证单位；
69. 验证比例；
70. 验证镜像；
71. 验证 Top/Bottom；
72. 验证 Rotation；
73. 验证 Origin；
74. 建立 Mechanical Part；
75. 建立 Mechanical Instance；
76. 建立 Solid Body；
77. 建立 Mesh Body；
78. 建立 Envelope；
79. 建立 Contact Surface；
80. 建立 Mounting Interface；
81. 建立 Mating Interface；
82. 建立 Motion Joint；
83. 建立 Flexible Body；
84. 建立 Tool Envelope；
85. 建立 Service Envelope；
86. 建立 Thermal Envelope；
87. 建立 Electrical Clearance Envelope；
88. 建立 Height Zone；
89. 建立 Keepout Volume；
90. 建立 Allowed Contact；
91. 建立 Intentional Compression；
92. 建立 Adhesive Bond；
93. 建立 Conductive Contact；
94. 建立 Insulating Contact；
95. 构建 Broad-phase Index；
96. 构建 AABB；
97. 构建 OBB；
98. 构建 BVH；
99. 构建 Spatial Hash；
100. 执行 Board-to-enclosure Collision；
101. 执行 Component-to-enclosure Collision；
102. 执行 Component-to-component Collision；
103. 执行 Shield-to-component Collision；
104. 执行 Heat-sink Collision；
105. 执行 Screw/Nut/Washer Collision；
106. 执行 Standoff Collision；
107. 执行 Tool Collision；
108. 执行 Cable/FPC Collision；
109. 执行 Button/Knob Collision；
110. 执行 Fixture Collision；
111. 计算 Minimum Distance；
112. 计算 Vertical Clearance；
113. 计算 Lateral Clearance；
114. 计算 Board-edge Clearance；
115. 计算 Hole Alignment；
116. 计算 Connector Opening Alignment；
117. 计算 Display Window Alignment；
118. 计算 Button Axis Alignment；
119. 计算 LED/Light-pipe Alignment；
120. 计算 Camera/Lens Field Opening；
121. 计算 Fan/Air Duct Alignment；
122. 计算 Antenna/Enclosure Clearance；
123. 识别 Static Hard Collision；
124. 识别 Allowed Contact；
125. 识别 Intentional Compression；
126. 识别 Clearance Violation；
127. 识别 Near-miss；
128. 识别 Model Ambiguity；
129. 识别 Missing Model；
130. 识别 Stale Model Revision；
131. 识别 Scale Error；
132. 识别 Coordinate Error；
133. 识别 Mirrored Model；
134. 识别 Wrong-side Model；
135. 识别 Duplicate Body；
136. 识别 Non-manifold Mesh；
137. 识别 Open Shell；
138. 识别 Self-intersection；
139. 识别 Degenerate Triangle；
140. 识别 Invalid B-Rep；
141. 识别 Board Thickness Conflict；
142. 识别 Solder/Pin Protrusion Conflict；
143. 识别 Through-hole Lead Conflict；
144. 识别 Connector Orientation；
145. 识别 Connector Mating Direction；
146. 识别 Connector Keying；
147. 识别 Latch Motion；
148. 识别 Flip-lock Motion；
149. 识别 Insertion Depth；
150. 识别 Extraction Distance；
151. 生成 Mating Sweep；
152. 生成 Cable Plug Sweep；
153. 生成 Latch Sweep；
154. 生成 Button Travel Sweep；
155. 生成 Knob Rotation Sweep；
156. 生成 Switch Toggle Sweep；
157. 生成 Shield Can Install Sweep；
158. 生成 Heat-sink Install Sweep；
159. 生成 Screw Insertion Sweep；
160. 生成 Tool Access Sweep；
161. 生成 FPC Centerline；
162. 生成 FPC Neutral Surface；
163. 生成 FPC Bend Region；
164. 检查 FPC Minimum Bend Radius；
165. 检查 FPC Twist；
166. 检查 FPC Fold；
167. 检查 FPC Connector Strain；
168. 检查 FPC Length Slack；
169. 检查 FPC Dynamic Cycle；
170. 生成 Wire Harness Centerline；
171. 检查 Cable Bend Radius；
172. 检查 Cable Exit Direction；
173. 检查 Cable Clamp；
174. 检查 Cable Pull Relief；
175. 检查 Cable Service Loop；
176. 检查 Cable-to-fan；
177. 检查 Cable-to-sharp-edge；
178. 检查 Button Cap；
179. 检查 Plunger；
180. 检查 Actuation Axis；
181. 检查 Travel；
182. 检查 Preload；
183. 检查 Side Load；
184. 检查 Panel Opening；
185. 检查 Knob Shaft；
186. 检查 Encoder Nut；
187. 检查 Screw Hole；
188. 检查 Screw Head；
189. 检查 Washer；
190. 检查 Nut；
191. 检查 Thread Engagement；
192. 检查 Standoff Height；
193. 检查 Screw Length；
194. 检查 Tool Bit Axis；
195. 检查 Driver Diameter；
196. 检查 Wrench Swing；
197. 检查 Torque Access；
198. 检查 Fastener Sequence；
199. 检查 Shield Can Height；
200. 检查 Shield Can Wall；
201. 检查 Shield Can Clip；
202. 检查 Shield Can Solder Fence；
203. 检查 Shield Can Removal；
204. 检查 Internal Rework Access；
205. 检查 Heat-sink Footprint；
206. 检查 Heat-sink Clip；
207. 检查 Screw/Push-pin；
208. 检查 Thermal Pad Compression；
209. 检查 Heat Pipe；
210. 检查 Fan Clearance；
211. 检查 Airflow Keepout；
212. 检查 Enclosure Vent；
213. 检查 Heat-source-to-plastic；
214. 检查 Battery Swelling Envelope；
215. 检查 Foam Compression；
216. 检查 Spring Finger Compression；
217. 检查 EMI Gasket Compression；
218. 检查 Ground Contact；
219. 检查 Metal-to-copper Clearance；
220. 检查 Screw-to-copper Clearance；
221. 检查 Standoff-to-copper Clearance；
222. 检查 Shield-to-copper Clearance；
223. 检查 Board Flex Reserve；
224. 检查 Assembly Sequence；
225. 检查 Precedence Constraint；
226. 检查 Subassembly；
227. 检查 Captive Part；
228. 检查 Inaccessible Fastener；
229. 检查 Impossible Insertion；
230. 检查 Tool Sequence；
231. 检查 Service Removal；
232. 检查 Replaceable Module；
233. 检查 Rework Clearance；
234. 检查 Soldering Iron Access；
235. 检查 Hot-air Nozzle Access；
236. 检查 Probe Access；
237. 检查 Connector Finger Access；
238. 检查 Label/Marking Visibility；
239. 建立 Nominal Analysis；
240. 建立 Worst-case Tolerance；
241. 建立 Interval Analysis；
242. 建立 Statistical Monte Carlo；
243. 建立 Manufacturing Distribution；
244. 建立 Assembly Distribution；
245. 建立 Temperature Expansion Candidate；
246. 计算 Probability of Interference；
247. 计算 Clearance Margin Distribution；
248. 识别 Tolerance-sensitive Pair；
249. 识别 Datum Conflict；
250. 识别 Over-constrained Assembly；
251. 生成 Unified Mechanical Finding；
252. 生成 Severity；
253. 生成 Confidence；
254. 生成 Model Fidelity；
255. 生成 Evidence；
256. 生成 Collision Geometry；
257. 生成 Section View；
258. 生成 Closest Points；
259. 生成 Motion Trace；
260. 生成 Tolerance Trace；
261. 生成 ECAD Repair；
262. 生成 MCAD Repair；
263. 生成 Model Repair；
264. 生成 Assembly Process Repair；
265. 生成 Tooling Repair；
266. 反馈 Agent 20；
267. 反馈 Agent 24；
268. 反馈 Agent 25；
269. 反馈 Agent 26；
270. 反馈 Agent 27；
271. 生成 Agent 19 Change Plan；
272. 支持 Review；
273. 支持 Accept/Reject；
274. 支持 Waiver；
275. 支持 Baseline；
276. 支持 Diff；
277. 支持 Regression；
278. 支持 CI；
279. 支持 Release Gate；
280. 支持多租户；
281. 支持批量工程；
282. 支持私有部署；
283. 不用 Bounding Box 宣称精确无碰撞；
284. 不用网格近似宣称公差签核；
285. 不忽略装配运动；
286. 不忽略工具和返修空间；
287. 不自动移动固定件；
288. 不修改生产 MCAD；
289. 不伪造模型、尺寸、公差、碰撞或测量；
290. 不发送私有机械模型给外部模型。

---

# 6. Coordinate Frame Registry

## 6.1 Frame 类型

```text
world
assembly
enclosure
board
board_top
board_bottom
footprint
model_local
connector_mate
tool
fixture
measurement
```

## 6.2 Frame 字段

```json
{
  "frame_id": "uuid",
  "frame_type": "board",
  "parent_frame_id": "uuid",
  "unit": "mm",
  "handedness": "right",
  "axis_convention": {
    "x": "+right",
    "y": "+up",
    "z": "+out_of_board"
  },
  "transform_to_parent": {},
  "source": {},
  "confidence": {}
}
```

## 6.3 Transform Chain

```text
Model Local
→ Footprint
→ Board Side Transform
→ Board
→ Subassembly
→ Enclosure Assembly
→ World
```

每一级保存：

```text
translation
rotation
scale
mirror
unit conversion
source
hash
```

---

# 7. Unit 和 Handedness Gate

阻断条件：

```text
unit unknown
non-uniform scale unexplained
left/right handedness conflict
mirror not approved
rotation ambiguity
board side ambiguity
```

不得用“模型看起来差不多大”自动选择单位。

---

# 8. Mechanical Model Registry

每个模型保存：

```text
model type
format
source
supplier
part number
revision
hash
license
unit
frame
geometry status
fidelity
tolerance metadata
approval
```

状态：

```text
approved
candidate
stale
missing
invalid
license_blocked
binding_ambiguous
```

---

# 9. Model Binding

绑定对象：

```text
Footprint
Part
Mechanical Part
Connector Mate
Fastener
Tool
Enclosure Feature
```

必须显式保存：

```text
target id
model id
transform
scale
variant/effectivity
binding method
review status
```

---

# 10. Geometry Representation

```text
B-Rep solid
B-Rep shell
triangle mesh
convex hull
OBB
AABB
extruded 2D envelope
height prism
sweep volume
contact surface
```

不同表示不得静默互换。

---

# 11. Geometry Readiness

```text
exact_ready
mesh_ready
envelope_only
height_only
metadata_only
invalid
missing
```

---

# 12. Canonical Mechanical Assembly IR

```json
{
  "mechanical_ir_version": "1.0.0",
  "assembly_revision": "string",
  "frames": [],
  "parts": [],
  "instances": [],
  "bodies": [],
  "joints": [],
  "contacts": [],
  "keepout_volumes": [],
  "motions": [],
  "tools": [],
  "sequences": [],
  "tolerances": [],
  "findings": [],
  "provenance": {}
}
```

---

# 13. Mechanical Part

```text
part id
part number
revision
part type
material
model bindings
mass optional
thermal expansion optional
tolerance schema
effectivity
```

---

# 14. Mechanical Instance

```text
instance id
part id
parent assembly
frame
transform
fixed/movable
motion joint
allowed contact
service status
```

---

# 15. Mechanical Part 类型

```text
pcb
component
connector
connector_mate
enclosure
cover
bezel
bracket
standoff
fastener
shield_can
heatsink
fan
fpc
cable
button
knob
switch
battery
foam
gasket
fixture
tool
```

---

# 16. Broad-phase 检测

推荐：

```text
AABB tree
OBB tree
BVH
spatial hash
layer/region filters
collision masks
```

目标：

```text
快速淘汰不可能相交对象
避免 O(n²) 全对全
支持增量更新
```

---

# 17. Narrow-phase 检测

按 Fidelity：

```text
B-Rep boolean intersection
B-Rep minimum distance
mesh triangle intersection
mesh signed/unsigned distance
convex decomposition
envelope overlap
```

输出必须记录使用的算法和误差界。

---

# 18. Contact 分类

```text
hard_interference
clearance_violation
near_miss
allowed_contact
intentional_compression
press_fit
thermal_contact
electrical_contact
adhesive_contact
unknown_contact
```

---

# 19. Clearance

类型：

```text
vertical
lateral
radial
board_edge
tool
service
electrical_to_metal
thermal
airflow
```

每个 Clearance 保存：

```text
actual
required
tolerance
margin
closest points
analysis level
fidelity
```

---

# 20. Height Zone

```text
top/bottom
region geometry
maximum/minimum height
soft/hard
source
enclosure reference
```

支持：

```text
stepped enclosure
display pocket
battery cavity
connector opening
shield area
heatsink area
```

---

# 21. Connector Review

检查：

```text
body orientation
pin orientation
key orientation
opening alignment
mate compatibility
insertion axis
insertion depth
extraction distance
latch motion
cable bend
finger access
```

---

# 22. Mating Sweep

```text
start pose
end pose
path
orientation law
mating body
cable/plug body
clearance envelope
latch state
```

静态终点无碰撞，但 Sweep 碰撞仍为 Fail。

---

# 23. Fastener Assembly

对象：

```text
screw
washer
nut
insert
standoff
threaded boss
push pin
clip
```

检查：

```text
hole diameter
coaxiality
head clearance
length
thread engagement
washer seating
nut clearance
tool axis
wrench swing
assembly order
```

---

# 24. Tool Access

Tool Envelope：

```text
driver bit
screwdriver body
torque tool
wrench
pliers
soldering iron
hot-air nozzle
probe
connector extraction tool
```

检查：

```text
approach axis
minimum insertion length
body sweep
rotation sweep
hand clearance optional
```

---

# 25. Shield Can

检查：

```text
wall/component collision
lid clearance
clip engagement
solder fence
ground contact
removal path
internal rework
thermal interaction
antenna interaction
```

---

# 26. Heat Sink

检查：

```text
base contact
TIM compression
clip/screw
keepout
fin clearance
fan/airflow
plastic distance
neighbor heating
removal path
```

热性能本身由 Agent 27/热分析处理，本 Agent 负责几何和装配。

---

# 27. FPC 模型

字段：

```text
width
thickness
layer count
neutral axis
minimum static bend radius
minimum dynamic bend radius
maximum twist
connector clamp length
available length
service cycles
```

---

# 28. FPC 检查

```text
centerline length
bend radius
twist
fold
edge contact
connector strain
moving sweep
cover closing interference
latch access
```

不能仅用端点直线距离判断。

---

# 29. Cable/Wire Harness

字段：

```text
diameter
bundle diameter
minimum bend radius
connector exit
clamp points
service loop
strain relief
dynamic/static
```

检查：

```text
sharp edge
fan
heatsink
screw
cover closing
assembly insertion
pull-out
service removal
```

---

# 30. Button、Knob 和 Switch

检查：

```text
axis alignment
panel opening
cap geometry
travel
preload
side load
tilt
return spring
shaft/nut
rotation sweep
finger access
```

---

# 31. Dynamic Sweep

支持：

```text
linear
rotational
hinge
slider
piecewise
sampled pose
swept volume
```

必须保存采样分辨率或精确求解方法。

---

# 32. Assembly Sequence

表示为：

```text
operation
required parts
required tools
preconditions
motion
postconditions
precedence edges
```

检查：

```text
cycle
impossible insertion
captured fastener
inaccessible tool
blocked subassembly
non-removable service part
```

---

# 33. Service and Rework

检查：

```text
connector unplug
module removal
battery replacement
shield removal
soldering iron access
hot-air access
probe access
label visibility
serial-number scan
```

---

# 34. Tolerance Model

来源：

```text
PCB fabrication
component body
connector
hole
standoff
enclosure molding
sheet metal
assembly
adhesive/TIM
```

字段：

```text
nominal
plus/minus
distribution
datum
correlation group
temperature condition
```

---

# 35. Tolerance 分析

模式：

```text
nominal
worst_case
interval
RSS
Monte Carlo
measurement_correlated
```

输出：

```text
clearance distribution
interference probability
sensitive contributors
datum chain
confidence
```

---

# 36. Thermal Expansion Candidate

只有材料、长度和温度范围充分时才计算：

```text
part expansion
differential expansion
preload change
gap change
```

否则只输出 `thermal_context_required`。

---

# 37. Unified Mechanical Finding IR

```json
{
  "finding_id": "uuid",
  "finding_type": "connector_insertion_collision",
  "analysis_level": "dynamic_sweep",
  "model_fidelity": "M4",
  "severity": "high",
  "confidence": {},
  "affected_instances": [],
  "collision_geometry": {},
  "clearance": {},
  "motion": {},
  "tolerance": {},
  "evidence_ids": [],
  "repair_candidates": [],
  "status": "open"
}
```

---

# 38. Finding 类型

```text
static_collision
clearance_violation
height_violation
board_edge_violation
opening_misalignment
connector_orientation_error
mating_collision
insertion_collision
extraction_collision
latch_collision
screw_alignment_error
fastener_length_error
tool_access_failure
shield_collision
heatsink_collision
thermal_pad_compression_error
fpc_bend_violation
fpc_twist_violation
cable_bend_violation
button_travel_collision
knob_rotation_collision
assembly_sequence_failure
service_access_failure
rework_access_failure
tolerance_interference_risk
model_binding_error
coordinate_transform_error
stale_model_revision
```

---

# 39. Severity

```text
critical
high
medium
low
info
```

Critical 示例：

```text
无法装配
连接器无法插入
固定件孔位不匹配
电池被硬性挤压
金属件压到高压铜区
关键散热器无法安装
```

---

# 40. Finding 状态

```text
open
needs_model
needs_dimension
needs_tolerance
needs_process
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

# 41. Repair 分类

```text
model_binding_repair → Agent 20
constraint_repair → Agent 24
placement_repair → Agent 25
routing_or_copper_repair → Agent 26
thermal_emc_review → Agent 27
ecad_change → Agent 19
mcad_change_request
assembly_process_change
tooling_change
supplier_data_request
```

---

# 42. AI 允许职责

```text
从结构资料中提取零件名称、装配步骤和公差候选
总结 Finding
解释碰撞和运动路径
生成结构与 ECAD 修复选项说明
整理装配和测试清单
```

---

# 43. AI 禁止职责

```text
生成虚假尺寸
猜测单位或比例
伪造 STEP/B-Rep 结果
伪造公差分布
直接输出最终坐标并写入
关闭机械 Finding
宣称结构签核完成
```

---

# 44. Release Gate

## Model Ready

```text
Coordinate/Unit Pass
Critical Part Model Coverage
Revision Match
Binding Pass
```

## Static Fit Ready

```text
Critical Static Collision = 0
Height and Opening Pass
Fastener Alignment Pass
Metal-to-copper Critical Finding = 0
```

## Assembly Ready

```text
Connector Mating Sweep Pass
Button/FPC/Cable Motion Pass
Tool Access Pass
Assembly Sequence Pass
```

## Service Ready

```text
Required Replaceable Parts Accessible
Required Debug/Test Access
Shield/Heat-sink Removal Strategy
```

## NPI Freeze

```text
Critical/High Finding = 0 或批准 Waiver
Tolerance Analysis Complete
ECAD/MCAD Revision Frozen
Assembly Process Frozen
Mechanical Manifest Frozen
```

---

# 45. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RESOLVING_MODELS
→ NORMALIZING_COORDINATES
→ BUILDING_ASSEMBLY
→ RUNNING_BROAD_PHASE
→ RUNNING_NARROW_PHASE
→ ANALYZING_CLEARANCE
→ ANALYZING_CONNECTORS
→ ANALYZING_FASTENERS_AND_TOOLS
→ ANALYZING_FPC_AND_CABLES
→ ANALYZING_BUTTONS_AND_MOTIONS
→ ANALYZING_ASSEMBLY_SEQUENCE
→ ANALYZING_TOLERANCES
→ CORRELATING_FINDINGS
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_FINDINGS
COMPLETED_ENVELOPE_ONLY
REVIEW_REQUIRED
INPUT_BLOCKED
MODEL_REQUIRED
COORDINATE_BLOCKED
NO_FEASIBLE_ASSEMBLY
TOLERANCE_DATA_REQUIRED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 46. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_PCB_IR_NOT_FOUND
AGENT20_3D_MODEL_BLOCKED
AGENT24_MECHANICAL_CONSTRAINT_MISSING
AGENT25_PLACEMENT_IR_MISSING
BOARD_GEOMETRY_INVALID
BOARD_THICKNESS_MISSING
MODEL_FILE_MISSING
MODEL_FORMAT_UNSUPPORTED
MODEL_PARSE_FAILED
MODEL_GEOMETRY_INVALID
MODEL_NON_MANIFOLD
MODEL_OPEN_SHELL
MODEL_SELF_INTERSECTION
MODEL_UNIT_UNKNOWN
MODEL_SCALE_CONFLICT
MODEL_AXIS_AMBIGUOUS
MODEL_HANDEDNESS_CONFLICT
MODEL_MIRRORED_UNEXPECTEDLY
MODEL_WRONG_SIDE
MODEL_BINDING_AMBIGUOUS
MODEL_REVISION_STALE
COORDINATE_FRAME_MISSING
TRANSFORM_CHAIN_INVALID
ASSEMBLY_REVISION_MISMATCH
STATIC_COLLISION_DETECTED
CRITICAL_CLEARANCE_VIOLATION
HEIGHT_ZONE_VIOLATION
CONNECTOR_OPENING_MISALIGNED
CONNECTOR_MATING_COLLISION
CONNECTOR_INSERTION_BLOCKED
CONNECTOR_EXTRACTION_BLOCKED
LATCH_MOTION_BLOCKED
SCREW_HOLE_MISALIGNED
FASTENER_LENGTH_INVALID
TOOL_ACCESS_BLOCKED
SHIELD_INSTALLATION_BLOCKED
HEATSINK_INSTALLATION_BLOCKED
FPC_BEND_RADIUS_VIOLATION
FPC_TWIST_VIOLATION
CABLE_BEND_RADIUS_VIOLATION
BUTTON_TRAVEL_BLOCKED
KNOB_ROTATION_BLOCKED
ASSEMBLY_SEQUENCE_CYCLE
ASSEMBLY_OPERATION_INFEASIBLE
SERVICE_ACCESS_BLOCKED
REWORK_ACCESS_BLOCKED
TOLERANCE_DATA_MISSING
TOLERANCE_INTERFERENCE_RISK
AGENT19_EXECUTION_FAILED
POST_WRITE_MECHANICAL_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR


---

# 47. 数据库设计

## 47.1 `mechanical_review_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_pcb_ir_id UUID NOT NULL
agent20_scan_id UUID NOT NULL
agent24_constraint_ir_id UUID NULL
agent25_placement_ir_id UUID NOT NULL
agent26_routing_ir_id UUID NULL
agent27_review_id UUID NULL
mechanical_profile_id UUID NULL
assembly_revision VARCHAR NOT NULL
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

## 47.2 `mechanical_input_snapshots`

```text
id UUID PK
review_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
agent16_pcb_ir_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent24_constraint_hash CHAR(64) NULL
agent25_placement_hash CHAR(64) NOT NULL
agent26_routing_hash CHAR(64) NULL
agent27_review_hash CHAR(64) NULL
mechanical_profile_hash CHAR(64) NULL
model_registry_hash CHAR(64) NOT NULL
coordinate_registry_hash CHAR(64) NOT NULL
analysis_policy_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, snapshot_hash)
```

## 47.3 `mechanical_analysis_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
required_analysis_levels JSONB NOT NULL
required_model_fidelity JSONB NOT NULL
critical_part_classes JSONB NOT NULL
clearance_policy JSONB NOT NULL
tolerance_policy JSONB NOT NULL
tool_policy JSONB NOT NULL
assembly_policy JSONB NOT NULL
release_gate_policy JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 47.4 `mechanical_model_registry_entries`

```text
id UUID PK
tenant_id UUID NULL
model_type VARCHAR NOT NULL
model_format VARCHAR NOT NULL
manufacturer VARCHAR NULL
part_number VARCHAR NULL
model_name VARCHAR NOT NULL
model_revision VARCHAR NOT NULL
source_reference JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
license_status VARCHAR NOT NULL
declared_unit VARCHAR NULL
detected_unit VARCHAR NULL
handedness VARCHAR NULL
axis_convention JSONB NULL
geometry_status VARCHAR NOT NULL
model_fidelity VARCHAR NOT NULL
tolerance_metadata JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(model_name, model_revision, artifact_hash)
```

## 47.5 `mechanical_model_validation_runs`

```text
id UUID PK
model_registry_entry_id UUID NOT NULL
validator_name VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
parse_status VARCHAR NOT NULL
solid_count INT NOT NULL
shell_count INT NOT NULL
mesh_count INT NOT NULL
open_shell_count INT NOT NULL
non_manifold_count INT NOT NULL
self_intersection_count INT NOT NULL
degenerate_element_count INT NOT NULL
bounding_box JSONB NULL
volume JSONB NULL
surface_area JSONB NULL
unit_findings JSONB NOT NULL
axis_findings JSONB NOT NULL
validation_report_uri TEXT NOT NULL
validation_report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 47.6 `mechanical_model_bindings`

```text
id UUID PK
review_job_id UUID NOT NULL
model_registry_entry_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_reference JSONB NOT NULL
variant_scope JSONB NOT NULL
effectivity JSONB NOT NULL
transform JSONB NOT NULL
scale JSONB NOT NULL
mirror_state VARCHAR NOT NULL
binding_method VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.7 `mechanical_coordinate_frames`

```text
id UUID PK
review_job_id UUID NOT NULL
frame_key VARCHAR NOT NULL
frame_type VARCHAR NOT NULL
parent_frame_id UUID NULL
unit VARCHAR NOT NULL
handedness VARCHAR NOT NULL
axis_convention JSONB NOT NULL
transform_to_parent JSONB NOT NULL
source_reference JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, frame_key)
```

## 47.8 `mechanical_transform_chains`

```text
id UUID PK
review_job_id UUID NOT NULL
source_frame_id UUID NOT NULL
target_frame_id UUID NOT NULL
chain_steps JSONB NOT NULL
combined_transform JSONB NOT NULL
unit_conversion JSONB NOT NULL
mirror_count INT NOT NULL
chain_hash CHAR(64) NOT NULL
validation_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, source_frame_id, target_frame_id)
```

## 47.9 `mechanical_parts`

```text
id UUID PK
review_job_id UUID NOT NULL
part_key VARCHAR NOT NULL
part_number VARCHAR NULL
revision VARCHAR NOT NULL
part_type VARCHAR NOT NULL
material_reference JSONB NULL
mass_properties JSONB NULL
thermal_expansion JSONB NULL
tolerance_schema JSONB NOT NULL
effectivity JSONB NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, part_key)
```

## 47.10 `mechanical_instances`

```text
id UUID PK
review_job_id UUID NOT NULL
instance_key VARCHAR NOT NULL
mechanical_part_id UUID NOT NULL
parent_instance_id UUID NULL
frame_id UUID NOT NULL
transform JSONB NOT NULL
mobility_status VARCHAR NOT NULL
motion_joint_id UUID NULL
service_status VARCHAR NOT NULL
fixed_reason TEXT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, instance_key)
```

## 47.11 `mechanical_bodies`

```text
id UUID PK
mechanical_instance_id UUID NOT NULL
body_key VARCHAR NOT NULL
representation_type VARCHAR NOT NULL
model_fidelity VARCHAR NOT NULL
artifact_reference JSONB NULL
geometry_uri TEXT NOT NULL
geometry_hash CHAR(64) NOT NULL
bounding_box JSONB NOT NULL
oriented_bounding_box JSONB NULL
volume JSONB NULL
surface_area JSONB NULL
collision_mask JSONB NOT NULL
geometry_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(mechanical_instance_id, body_key)
```

## 47.12 `mechanical_contact_definitions`

```text
id UUID PK
review_job_id UUID NOT NULL
instance_a_id UUID NOT NULL
instance_b_id UUID NOT NULL
contact_type VARCHAR NOT NULL
allowed_penetration JSONB NULL
required_compression JSONB NULL
electrical_contact_policy JSONB NULL
thermal_contact_policy JSONB NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.13 `mechanical_keepout_volumes`

```text
id UUID PK
review_job_id UUID NOT NULL
keepout_key VARCHAR NOT NULL
keepout_type VARCHAR NOT NULL
frame_id UUID NOT NULL
geometry_uri TEXT NOT NULL
geometry_hash CHAR(64) NOT NULL
applicable_instance_types JSONB NOT NULL
allowed_exceptions JSONB NOT NULL
hard_constraint BOOLEAN NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, keepout_key)
```

## 47.14 `mechanical_motion_joints`

```text
id UUID PK
review_job_id UUID NOT NULL
joint_key VARCHAR NOT NULL
joint_type VARCHAR NOT NULL
parent_instance_id UUID NOT NULL
child_instance_id UUID NOT NULL
axis_or_path JSONB NOT NULL
limits JSONB NOT NULL
orientation_law JSONB NOT NULL
sampling_policy JSONB NOT NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, joint_key)
```

## 47.15 `mechanical_motion_sweeps`

```text
id UUID PK
review_job_id UUID NOT NULL
motion_joint_id UUID NOT NULL
moving_instance_id UUID NOT NULL
sweep_type VARCHAR NOT NULL
start_pose JSONB NOT NULL
end_pose JSONB NOT NULL
sample_count INT NULL
sweep_geometry_uri TEXT NOT NULL
sweep_geometry_hash CHAR(64) NOT NULL
analysis_method VARCHAR NOT NULL
error_bound JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.16 `mechanical_broad_phase_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
index_type VARCHAR NOT NULL
instance_count INT NOT NULL
candidate_pair_count INT NOT NULL
filtered_pair_count INT NOT NULL
runtime_ms BIGINT NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 47.17 `mechanical_collision_checks`

```text
id UUID PK
review_job_id UUID NOT NULL
instance_a_id UUID NOT NULL
instance_b_id UUID NOT NULL
check_type VARCHAR NOT NULL
analysis_method VARCHAR NOT NULL
analysis_level VARCHAR NOT NULL
model_fidelity VARCHAR NOT NULL
collision_status VARCHAR NOT NULL
intersection_volume JSONB NULL
minimum_distance JSONB NULL
closest_points JSONB NULL
contact_classification VARCHAR NOT NULL
geometry_evidence_uri TEXT NOT NULL
geometry_evidence_hash CHAR(64) NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 47.18 `mechanical_clearance_checks`

```text
id UUID PK
review_job_id UUID NOT NULL
clearance_type VARCHAR NOT NULL
subject_reference JSONB NOT NULL
object_reference JSONB NOT NULL
actual_clearance JSONB NULL
required_clearance JSONB NOT NULL
tolerance_margin JSONB NULL
closest_points JSONB NULL
analysis_level VARCHAR NOT NULL
model_fidelity VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.19 `mechanical_alignment_checks`

```text
id UUID PK
review_job_id UUID NOT NULL
alignment_type VARCHAR NOT NULL
subject_reference JSONB NOT NULL
target_reference JSONB NOT NULL
axis_error JSONB NULL
position_error JSONB NULL
angular_error JSONB NULL
allowed_tolerance JSONB NOT NULL
analysis_level VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.20 `mechanical_connector_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
connector_instance_id UUID NOT NULL
mate_instance_id UUID NULL
opening_reference JSONB NULL
orientation_status VARCHAR NOT NULL
keying_status VARCHAR NOT NULL
opening_alignment_status VARCHAR NOT NULL
mating_sweep_id UUID NULL
insertion_status VARCHAR NOT NULL
extraction_status VARCHAR NOT NULL
latch_status VARCHAR NOT NULL
cable_bend_status VARCHAR NOT NULL
finger_access_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.21 `mechanical_fastener_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
fastener_instance_id UUID NOT NULL
hole_reference JSONB NOT NULL
mating_thread_reference JSONB NULL
coaxiality JSONB NULL
length_status VARCHAR NOT NULL
engagement_status VARCHAR NOT NULL
head_clearance_status VARCHAR NOT NULL
washer_status VARCHAR NULL
nut_clearance_status VARCHAR NULL
tool_access_review_id UUID NULL
assembly_order_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.22 `mechanical_tool_definitions`

```text
id UUID PK
tenant_id UUID NULL
tool_key VARCHAR NOT NULL
tool_type VARCHAR NOT NULL
tool_version VARCHAR NOT NULL
geometry_uri TEXT NOT NULL
geometry_hash CHAR(64) NOT NULL
approach_policy JSONB NOT NULL
rotation_policy JSONB NOT NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(tool_key, tool_version)
```

## 47.23 `mechanical_tool_access_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
tool_definition_id UUID NOT NULL
target_reference JSONB NOT NULL
approach_axis JSONB NOT NULL
required_depth JSONB NOT NULL
rotation_sweep JSONB NULL
access_status VARCHAR NOT NULL
blocking_instances JSONB NOT NULL
minimum_margin JSONB NULL
analysis_level VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.24 `mechanical_flexible_body_profiles`

```text
id UUID PK
review_job_id UUID NOT NULL
instance_id UUID NOT NULL
flexible_type VARCHAR NOT NULL
width_or_diameter JSONB NOT NULL
thickness JSONB NULL
minimum_static_bend_radius JSONB NULL
minimum_dynamic_bend_radius JSONB NULL
maximum_twist JSONB NULL
available_length JSONB NOT NULL
clamp_points JSONB NOT NULL
service_cycles JSONB NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 47.25 `mechanical_flexible_body_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
flexible_profile_id UUID NOT NULL
centerline_uri TEXT NOT NULL
centerline_hash CHAR(64) NOT NULL
bend_radius_result JSONB NOT NULL
twist_result JSONB NULL
length_slack_result JSONB NOT NULL
strain_result JSONB NULL
collision_result JSONB NOT NULL
dynamic_cycle_result JSONB NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.26 `mechanical_actuator_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
actuator_instance_id UUID NOT NULL
actuator_type VARCHAR NOT NULL
panel_opening_reference JSONB NOT NULL
axis_alignment JSONB NOT NULL
travel_or_rotation JSONB NOT NULL
preload JSONB NULL
side_load JSONB NULL
motion_sweep_id UUID NOT NULL
finger_access JSONB NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.27 `mechanical_shield_heatsink_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
instance_id UUID NOT NULL
review_type VARCHAR NOT NULL
mounting_status VARCHAR NOT NULL
clearance_status VARCHAR NOT NULL
compression_status VARCHAR NULL
removal_status VARCHAR NOT NULL
rework_status VARCHAR NOT NULL
airflow_status VARCHAR NULL
electrical_contact_status VARCHAR NULL
blocking_instances JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.28 `mechanical_assembly_operations`

```text
id UUID PK
review_job_id UUID NOT NULL
operation_key VARCHAR NOT NULL
operation_type VARCHAR NOT NULL
required_instance_ids JSONB NOT NULL
required_tool_ids JSONB NOT NULL
preconditions JSONB NOT NULL
motion_definition JSONB NOT NULL
postconditions JSONB NOT NULL
sequence_rank INT NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, operation_key)
```

## 47.29 `mechanical_assembly_precedence_edges`

```text
id UUID PK
review_job_id UUID NOT NULL
predecessor_operation_id UUID NOT NULL
successor_operation_id UUID NOT NULL
edge_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(predecessor_operation_id, successor_operation_id)
```

## 47.30 `mechanical_assembly_sequence_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
sequence_version VARCHAR NOT NULL
operation_count INT NOT NULL
cycle_count INT NOT NULL
infeasible_operation_count INT NOT NULL
captured_part_count INT NOT NULL
sequence_uri TEXT NOT NULL
sequence_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.31 `mechanical_service_access_reviews`

```text
id UUID PK
review_job_id UUID NOT NULL
service_target_reference JSONB NOT NULL
service_type VARCHAR NOT NULL
required_tools JSONB NOT NULL
removal_sequence JSONB NOT NULL
access_envelope JSONB NOT NULL
blocking_instances JSONB NOT NULL
service_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.32 `mechanical_tolerance_definitions`

```text
id UUID PK
review_job_id UUID NOT NULL
tolerance_key VARCHAR NOT NULL
target_reference JSONB NOT NULL
dimension_type VARCHAR NOT NULL
nominal JSONB NOT NULL
plus_tolerance JSONB NOT NULL
minus_tolerance JSONB NOT NULL
distribution JSONB NULL
datum_reference JSONB NULL
correlation_group VARCHAR NULL
temperature_condition JSONB NULL
source_reference JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, tolerance_key)
```

## 47.33 `mechanical_tolerance_analysis_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
analysis_type VARCHAR NOT NULL
analysis_version VARCHAR NOT NULL
target_clearance_reference JSONB NOT NULL
sample_count BIGINT NULL
seed BIGINT NULL
input_manifest_uri TEXT NOT NULL
input_manifest_hash CHAR(64) NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
minimum_margin JSONB NULL
maximum_margin JSONB NULL
interference_probability NUMERIC NULL
sensitivity_contributors JSONB NOT NULL
numerical_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.34 `mechanical_findings`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_type VARCHAR NOT NULL
analysis_level VARCHAR NOT NULL
model_fidelity VARCHAR NOT NULL
severity VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
affected_instances JSONB NOT NULL
collision_reference JSONB NULL
clearance_reference JSONB NULL
motion_reference JSONB NULL
tolerance_reference JSONB NULL
evidence_ids JSONB NOT NULL
repair_candidate_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 47.35 `mechanical_repair_candidates`

```text
id UUID PK
review_job_id UUID NOT NULL
finding_id UUID NOT NULL
repair_type VARCHAR NOT NULL
target_agent_or_system VARCHAR NOT NULL
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

## 47.36 `mechanical_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
review_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
plan_version INT NOT NULL
selected_repair_ids JSONB NOT NULL
ecad_operations JSONB NOT NULL
mcad_change_requests JSONB NOT NULL
assembly_process_changes JSONB NOT NULL
risk_summary JSONB NOT NULL
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

## 47.37 `mechanical_post_write_runs`

```text
id UUID PK
change_plan_id UUID NOT NULL
agent19_execution_id UUID NULL
pre_review_job_id UUID NOT NULL
post_review_job_id UUID NULL
coordinate_regression JSONB NOT NULL
model_binding_regression JSONB NOT NULL
collision_regression JSONB NOT NULL
clearance_regression JSONB NOT NULL
motion_regression JSONB NOT NULL
assembly_regression JSONB NOT NULL
new_findings JSONB NOT NULL
resolved_findings JSONB NOT NULL
worsened_findings JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 47.38 `mechanical_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
assembly_revision VARCHAR NOT NULL
mechanical_ir_hash CHAR(64) NOT NULL
finding_set_hash CHAR(64) NOT NULL
model_registry_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision, assembly_revision)
```

## 47.39 `mechanical_waivers`

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
effective_project_revision VARCHAR NULL
effective_assembly_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 47.40 `mechanical_release_gate_runs`

```text
id UUID PK
review_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
critical_collision_count INT NOT NULL
high_finding_count INT NOT NULL
missing_critical_model_count INT NOT NULL
coordinate_block_count INT NOT NULL
assembly_infeasible_count INT NOT NULL
tolerance_block_count INT NOT NULL
unapproved_waiver_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 47.41 `mechanical_reports`

```text
id UUID PK
review_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
model_coverage_summary JSONB NOT NULL
coordinate_status JSONB NOT NULL
collision_summary JSONB NOT NULL
clearance_summary JSONB NOT NULL
motion_summary JSONB NOT NULL
assembly_summary JSONB NOT NULL
tolerance_summary JSONB NOT NULL
finding_counts JSONB NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(review_job_id, report_version)
```

---

# 48. 对象存储

```text
derived/mechanical-review/
  {tenant_id}/{project_id}/
    jobs/
      {review_job_id}/
        input/
          input-snapshot.json
          ecad-manifest.json
          mcad-manifest.json
          model-registry.json
          assembly-profile.json
          analysis-policy.json
        models/
          source/
          normalized/
          meshes/
          brep/
          validation/
          previews/
        coordinates/
          frames.jsonl.zst
          transform-chains.jsonl.zst
          unit-validation.json
        assembly/
          mechanical-ir.json
          instances.jsonl.zst
          bodies.jsonl.zst
          contacts.jsonl.zst
          keepouts.jsonl.zst
          motions.jsonl.zst
          tools.jsonl.zst
          sequences.jsonl.zst
        geometry/
          broad-phase/
          collision/
          clearances/
          closest-points/
          section-views/
          sweeps/
        connectors/
          mating/
          insertion/
          extraction/
          latch/
        fasteners/
          alignment/
          tool-access/
          assembly-order/
        flexible/
          fpc/
          cables/
          harnesses/
        actuators/
          buttons/
          knobs/
          switches/
        shielding-thermal/
          shield-cans/
          heatsinks/
          fans/
          airflow/
        tolerances/
          definitions/
          worst-case/
          monte-carlo/
          sensitivity/
        findings/
          mechanical-findings.jsonl.zst
          evidence/
          repair-candidates.jsonl.zst
        changes/
          agent19-plan.json
          mcad-change-requests.json
          assembly-process-changes.json
          preview/
          execution/
        regression/
          coordinates/
          models/
          collision/
          motion/
          assembly/
          tolerance/
        reports/
          mechanical-review.html
          mechanical-review.pdf
          collision-matrix.csv
          clearance-matrix.csv
          connector-review.csv
          fastener-review.csv
          tool-access.csv
          fpc-cable-review.csv
          assembly-sequence.csv
          tolerance-report.csv
          release-gate.json
        debug/
          geometry-trace.jsonl.zst
          collision-trace.jsonl.zst
          motion-trace.jsonl.zst
          tolerance-trace.jsonl.zst
          resource-usage.json
```

---

# 49. API 设计

## 49.1 Jobs

```text
POST /api/v1/mechanical-review/jobs
POST /api/v1/mechanical-review/jobs/batch
GET  /api/v1/mechanical-review/jobs/{id}
GET  /api/v1/mechanical-review/jobs/{id}/events
POST /api/v1/mechanical-review/jobs/{id}/cancel
POST /api/v1/mechanical-review/jobs/{id}/retry
POST /api/v1/mechanical-review/jobs/{id}/rerun
```

## 49.2 Readiness

```text
POST /api/v1/mechanical-review/jobs/{id}/validate-readiness
GET  /api/v1/mechanical-review/jobs/{id}/readiness
GET  /api/v1/mechanical-review/jobs/{id}/model-coverage
GET  /api/v1/mechanical-review/jobs/{id}/coordinate-status
```

## 49.3 Models

```text
POST /api/v1/mechanical-review/models
GET  /api/v1/mechanical-review/models
GET  /api/v1/mechanical-review/models/{id}
POST /api/v1/mechanical-review/models/{id}/validate
POST /api/v1/mechanical-review/jobs/{id}/bind-model
GET  /api/v1/mechanical-review/jobs/{id}/model-bindings
POST /api/v1/mechanical-review/jobs/{id}/rebind-model
```

## 49.4 Coordinates and Assembly

```text
POST /api/v1/mechanical-review/jobs/{id}/build-coordinate-registry
GET  /api/v1/mechanical-review/jobs/{id}/frames
GET  /api/v1/mechanical-review/jobs/{id}/transform-chains
POST /api/v1/mechanical-review/jobs/{id}/build-assembly
GET  /api/v1/mechanical-review/jobs/{id}/assembly
GET  /api/v1/mechanical-review/jobs/{id}/instances
```

## 49.5 Collision and Clearance

```text
POST /api/v1/mechanical-review/jobs/{id}/run-broad-phase
POST /api/v1/mechanical-review/jobs/{id}/run-collision
GET  /api/v1/mechanical-review/jobs/{id}/collisions
POST /api/v1/mechanical-review/jobs/{id}/run-clearance
GET  /api/v1/mechanical-review/jobs/{id}/clearances
GET  /api/v1/mechanical-review/collisions/{id}/evidence
```

## 49.6 Connectors and Motions

```text
POST /api/v1/mechanical-review/jobs/{id}/review-connectors
GET  /api/v1/mechanical-review/jobs/{id}/connectors
POST /api/v1/mechanical-review/jobs/{id}/generate-motion-sweep
GET  /api/v1/mechanical-review/jobs/{id}/motion-sweeps
POST /api/v1/mechanical-review/jobs/{id}/review-actuators
```

## 49.7 Fasteners and Tools

```text
POST /api/v1/mechanical-review/jobs/{id}/review-fasteners
GET  /api/v1/mechanical-review/jobs/{id}/fasteners
POST /api/v1/mechanical-review/jobs/{id}/review-tool-access
GET  /api/v1/mechanical-review/jobs/{id}/tool-access
```

## 49.8 FPC and Cables

```text
POST /api/v1/mechanical-review/jobs/{id}/review-flexible-bodies
GET  /api/v1/mechanical-review/jobs/{id}/flexible-bodies
POST /api/v1/mechanical-review/jobs/{id}/generate-fpc-path
POST /api/v1/mechanical-review/jobs/{id}/generate-cable-path
```

## 49.9 Assembly and Service

```text
POST /api/v1/mechanical-review/jobs/{id}/build-assembly-sequence
GET  /api/v1/mechanical-review/jobs/{id}/assembly-sequence
POST /api/v1/mechanical-review/jobs/{id}/review-service-access
GET  /api/v1/mechanical-review/jobs/{id}/service-access
```

## 49.10 Tolerance

```text
POST /api/v1/mechanical-review/jobs/{id}/define-tolerance
GET  /api/v1/mechanical-review/jobs/{id}/tolerances
POST /api/v1/mechanical-review/jobs/{id}/run-worst-case
POST /api/v1/mechanical-review/jobs/{id}/run-monte-carlo
GET  /api/v1/mechanical-review/jobs/{id}/tolerance-runs
```

## 49.11 Findings and Repairs

```text
GET  /api/v1/mechanical-review/jobs/{id}/findings
GET  /api/v1/mechanical-review/findings/{id}
POST /api/v1/mechanical-review/findings/{id}/accept
POST /api/v1/mechanical-review/findings/{id}/reject
POST /api/v1/mechanical-review/findings/{id}/waive
POST /api/v1/mechanical-review/findings/{id}/repair-candidates
GET  /api/v1/mechanical-review/jobs/{id}/repair-candidates
```

## 49.12 Agent Feedback and Change Plans

```text
POST /api/v1/mechanical-review/jobs/{id}/feedback
POST /api/v1/mechanical-review/jobs/{id}/change-plan
GET  /api/v1/mechanical-review/change-plans/{id}
POST /api/v1/mechanical-review/change-plans/{id}/preview
POST /api/v1/mechanical-review/change-plans/{id}/approve
POST /api/v1/mechanical-review/change-plans/{id}/submit-to-agent19
GET  /api/v1/mechanical-review/post-write-runs/{id}
```

## 49.13 Baseline and Reports

```text
POST /api/v1/mechanical-review/jobs/{id}/baseline
POST /api/v1/mechanical-review/jobs/{id}/compare-baseline
POST /api/v1/mechanical-review/jobs/{id}/run-release-gate
GET  /api/v1/mechanical-review/jobs/{id}/release-gate
GET  /api/v1/mechanical-review/jobs/{id}/report
GET  /api/v1/mechanical-review/jobs/{id}/collision-matrix.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 50. 事件

## 输入事件

```text
eda.ir.ready
eda-library.scan.completed
pcb-constraints.constraint-ir-ready
pcb-placement.completed
pcb-routing.completed
pcb-review.completed
mechanical.model.ready
mechanical.assembly-revision.ready
mechanical.review.requested
measurement.package.ready
```

## 输出事件

```text
mechanical-review.input-blocked
mechanical-review.model-required
mechanical-review.coordinate-blocked
mechanical-review.static-collision-detected
mechanical-review.dynamic-collision-detected
mechanical-review.tool-access-blocked
mechanical-review.assembly-infeasible
mechanical-review.tolerance-risk-detected
mechanical-review.finding-created
mechanical-review.feedback-to-library
mechanical-review.feedback-to-constraints
mechanical-review.feedback-to-placement
mechanical-review.feedback-to-routing
mechanical-review.feedback-to-pcb-review
mechanical-review.change-plan-ready
mechanical-review.post-write-validated
mechanical-review.release-gate-blocked
mechanical-review.completed
mechanical-review.completed-with-findings
mechanical-review.failed
```

---

# 51. Policy 组织

```text
policies/
├── mechanical-review-1.0.0.yaml
├── input-gates.yaml
├── coordinates/
│   ├── units.yaml
│   ├── handedness.yaml
│   ├── axes.yaml
│   └── transforms.yaml
├── models/
│   ├── formats.yaml
│   ├── validation.yaml
│   ├── fidelity.yaml
│   ├── binding.yaml
│   └── licensing.yaml
├── collision/
│   ├── masks.yaml
│   ├── broad-phase.yaml
│   ├── narrow-phase.yaml
│   ├── contact-types.yaml
│   └── clearances.yaml
├── connectors/
│   ├── mating.yaml
│   ├── insertion.yaml
│   ├── latch.yaml
│   └── cable-exit.yaml
├── fasteners/
│   ├── screws.yaml
│   ├── standoffs.yaml
│   ├── engagement.yaml
│   └── tool-access.yaml
├── flexible/
│   ├── fpc.yaml
│   ├── cable.yaml
│   └── harness.yaml
├── actuators/
│   ├── buttons.yaml
│   ├── knobs.yaml
│   └── switches.yaml
├── shielding-thermal/
│   ├── shield-can.yaml
│   ├── heatsink.yaml
│   ├── tim.yaml
│   └── airflow.yaml
├── assembly/
│   ├── sequence.yaml
│   ├── service.yaml
│   └── rework.yaml
├── tolerance/
│   ├── worst-case.yaml
│   ├── monte-carlo.yaml
│   └── release.yaml
├── findings/
│   ├── severity.yaml
│   ├── confidence.yaml
│   └── repair-routing.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 52. Geometry Provider 接口

```python
class MechanicalGeometryProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_model(self, model) -> ValidationResult: ...
    async def normalize(self, model, frame, unit) -> NormalizedGeometry: ...
    async def collide(self, request) -> CollisionResult: ...
    async def distance(self, request) -> DistanceResult: ...
    async def sweep(self, request) -> SweepResult: ...
    async def section(self, request) -> SectionResult: ...
```

---

# 53. Geometry Provider 能力

```text
STEP/BREP parse
mesh parse
boolean intersection
exact distance
mesh collision
swept volume
section view
mass properties
healing
tessellation
```

`unknown` 不视为支持。

---

# 54. Geometry Kernel 选择

建议抽象 Provider，不绑定单一内核。

可选实现：

```text
Open CASCADE / pythonOCC / OCP
FreeCAD headless adapter
CGAL-based mesh provider
trimesh for mesh utilities and fixtures
custom BVH/spatial index
```

生产环境中：

- 精确实体用成熟 B-Rep 内核；
- 网格碰撞和快速预览用 Mesh Provider；
- 不用仅适合可视化的库承担最终精确碰撞签核；
- 所有 Provider 都需要版本、能力和 Golden Fixture。

---

# 55. Model Import Pipeline

```text
Raw Artifact
→ Secure Type Detection
→ Parser
→ Unit/Axis/Frame Validation
→ Geometry Validation
→ Healing Candidate
→ Normalized Geometry
→ Tessellation
→ Preview
→ Registry Approval
```

不自动覆盖原始文件。

---

# 56. Model Healing

允许：

```text
sew shells
remove duplicate faces
fix small gaps
orient normals
remove degenerate triangles
```

要求：

```text
保留原模型
记录修改
记录容差
生成前后 Hash
需要批准
```

Healing 后不能宣称等同供应商原模型。

---

# 57. Collision Pair Filtering

过滤条件：

```text
same assembly branch
collision masks
fixed relationship
allowed contact
distance bounding
region
motion phase
variant
effectivity
```

---

# 58. Incremental Analysis

变化来源：

```text
Footprint moved
Model changed
Enclosure revised
Board outline changed
Fastener changed
FPC path changed
Tolerance changed
```

仅重算：

```text
受影响 Transform Chain
受影响 Broad-phase Pair
受影响 Sweep
受影响 Sequence
受影响 Tolerance Chain
```

---

# 59. Finding Evidence

建议自动生成：

```text
3D highlighted collision
closest-points line
cross-section
exploded view
motion frames
sweep volume
dimension annotation
tolerance contribution chart
before/after diff
```

Evidence 必须绑定几何 Hash 和 Revision。

---

# 60. Review Workbench

界面建议：

```text
左：Assembly Tree / Part / Finding / Severity / Fidelity
中：3D Viewer、Section、Explode、Motion、Collision Highlight
右：Model、Frame、Transform、Clearance、Tolerance、Repair
下：Static、Motion、Tools、FPC、Assembly、Tolerance、Diff、Waiver
```

---

# 61. Review 操作

```text
隐藏/隔离零件
切换名义/最坏公差
播放插拔和按钮运动
查看剖面
查看最近点
查看坐标链
重新绑定模型
确认 Allowed Contact
标记固定件
选择修复
创建 MCAD Change Request
生成 Agent 19 Plan
建立 Waiver
比较 Baseline
```

---

# 62. 可观测性

```text
mechanical_review_jobs_total{status,profile}
mechanical_review_duration_seconds{step}
mechanical_model_coverage_ratio{part_type,fidelity}
mechanical_model_validation_failures_total{type}
mechanical_coordinate_blocks_total{type}
mechanical_collision_pairs_total{status}
mechanical_clearance_failures_total{type}
mechanical_motion_failures_total{type}
mechanical_tool_access_failures_total{tool_type}
mechanical_flexible_body_failures_total{type}
mechanical_assembly_failures_total{type}
mechanical_tolerance_runs_total{type,status}
mechanical_findings_total{type,severity,fidelity}
mechanical_post_write_runs_total{status}
mechanical_release_gate_blocks_total{reason}
```

---

# 63. Dashboard

```text
Projects
Model Coverage
Coordinate Health
Assembly Revisions
Static Collision
Clearances
Connectors
Fasteners
Tool Access
FPC/Cables
Buttons/Knobs
Shield/Heatsink
Assembly Sequence
Service/Rework
Tolerance
Findings
Repairs
Regression
Release Readiness
```

---

# 64. 安全与权限

- ECAD、MCAD、供应商模型、外壳和装配资料按租户/项目隔离；
- 商业 CAD、STEP、Parasolid 导出、工具和供应商模型按 License 管控；
- Parser 和 Geometry Worker 在隔离容器运行，默认无公网；
- 限制 CPU、内存、磁盘、线程、文件数、三角形数和运行时间；
- 不执行 CAD 文件、压缩包、宏、脚本和嵌入对象；
- 不允许自由 Shell；
- 文件类型由内容和安全检测确认，不只看扩展名；
- 防止 Zip Bomb、Path Traversal、XML Entity、恶意 Mesh 和几何退化攻击；
- 模型 Healing、单位变更、镜像和缩放需要审计；
- Agent 19 写入权限与机械审查权限分开；
- 移动固定件、修改板框、安装孔、连接器和高压附近铜需要高风险审批；
- MCAD 仅生成 Change Request，不直接覆盖生产 CAD；
- 不把私有机械模型发送给外部通用模型；
- 公开 Fixture 仅使用开源、合成、脱敏或授权模型；
- Baseline、Model Registry、Transform、Finding、Waiver 和 Manifest 不可硬删除；
- 日志脱敏本机路径、供应商文件名和客户结构特征。

---

# 65. 推荐技术栈

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

几何：

```text
Open CASCADE compatible provider
OCP/pythonOCC adapter
trimesh or equivalent mesh utilities
NumPy
SciPy
custom BVH/spatial hash
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
Three.js or equivalent WebGL viewer
Section/Explode/Motion tools
Collision and Clearance overlays
```

可选：

```text
FreeCAD headless adapter
STEP/IDF/DXF adapters
CMM/3D scan import
```

---

# 66. 推荐仓库结构

```text
mechanical-review-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── mechanical-review-agent-spec.md
│   ├── input-model-coordinate-gates.md
│   ├── coordinate-frame-registry.md
│   ├── model-registry-and-bindings.md
│   ├── canonical-mechanical-ir.md
│   ├── geometry-providers.md
│   ├── collision-and-clearance.md
│   ├── connectors-and-mating.md
│   ├── fasteners-and-tool-access.md
│   ├── fpc-cable-analysis.md
│   ├── actuators-and-motion.md
│   ├── shield-heatsink-airflow.md
│   ├── assembly-sequence.md
│   ├── service-and-rework.md
│   ├── tolerance-analysis.md
│   ├── findings-and-repairs.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-coordinate-frames-are-explicit.md
│       ├── 0002-model-fidelity-is-not-hidden.md
│       ├── 0003-static-fit-is-not-assembly-fit.md
│       ├── 0004-tools-and-service-are-first-class.md
│       ├── 0005-tolerance-is-separate-from-nominal.md
│       ├── 0006-mcad-changes-are-change-requests.md
│       └── 0007-ecad-writes-run-through-agent19.md
├── src/
│   └── mechanical_review/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent19.py
│       │   ├── agent20.py
│       │   ├── agent24.py
│       │   ├── agent25.py
│       │   ├── agent26.py
│       │   ├── agent27.py
│       │   ├── step.py
│       │   ├── mesh.py
│       │   ├── vrml.py
│       │   ├── dxf.py
│       │   └── idf.py
│       ├── models/
│       │   ├── registry.py
│       │   ├── validation.py
│       │   ├── bindings.py
│       │   ├── normalization.py
│       │   ├── healing.py
│       │   └── licensing.py
│       ├── coordinates/
│       │   ├── frames.py
│       │   ├── units.py
│       │   ├── handedness.py
│       │   ├── transforms.py
│       │   └── validation.py
│       ├── geometry/
│       │   ├── base.py
│       │   ├── brep.py
│       │   ├── mesh.py
│       │   ├── envelopes.py
│       │   ├── aabb.py
│       │   ├── obb.py
│       │   ├── bvh.py
│       │   ├── distance.py
│       │   ├── collision.py
│       │   ├── sweep.py
│       │   ├── section.py
│       │   └── evidence.py
│       ├── assembly/
│       │   ├── parts.py
│       │   ├── instances.py
│       │   ├── contacts.py
│       │   ├── joints.py
│       │   ├── sequence.py
│       │   └── service.py
│       ├── connectors/
│       │   ├── orientation.py
│       │   ├── openings.py
│       │   ├── mating.py
│       │   ├── insertion.py
│       │   ├── latches.py
│       │   └── cable_exit.py
│       ├── fasteners/
│       │   ├── screws.py
│       │   ├── holes.py
│       │   ├── engagement.py
│       │   ├── standoffs.py
│       │   └── tools.py
│       ├── flexible/
│       │   ├── fpc.py
│       │   ├── cables.py
│       │   ├── harnesses.py
│       │   ├── centerline.py
│       │   └── bends.py
│       ├── actuators/
│       │   ├── buttons.py
│       │   ├── knobs.py
│       │   ├── switches.py
│       │   └── motion.py
│       ├── shielding_thermal/
│       │   ├── shields.py
│       │   ├── heatsinks.py
│       │   ├── tim.py
│       │   ├── fans.py
│       │   └── airflow.py
│       ├── tolerances/
│       │   ├── definitions.py
│       │   ├── chains.py
│       │   ├── worst_case.py
│       │   ├── interval.py
│       │   ├── monte_carlo.py
│       │   └── sensitivity.py
│       ├── findings/
│       │   ├── normalization.py
│       │   ├── severity.py
│       │   ├── confidence.py
│       │   ├── evidence.py
│       │   └── correlation.py
│       ├── repairs/
│       │   ├── candidates.py
│       │   ├── model_repairs.py
│       │   ├── ecad_repairs.py
│       │   ├── mcad_requests.py
│       │   ├── process_repairs.py
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
├── model-profiles/
├── tool-profiles/
├── assembly-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_mechanical_readiness.py
    ├── validate_models.py
    ├── build_coordinate_registry.py
    ├── build_mechanical_assembly.py
    ├── run_collision_review.py
    ├── run_motion_review.py
    ├── run_tool_access_review.py
    ├── run_tolerance_analysis.py
    ├── generate_mechanical_repairs.py
    ├── submit_ecad_repairs_to_agent19.py
    └── run_mechanical_benchmark.py
```


---

# 67. Codex 分阶段实施

不要让 Codex 一次实现 STEP/B-Rep、Mesh、坐标统一、连接器运动、FPC、螺丝工具、公差、装配顺序、Web 3D 和完整自动修复。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–27 的真实实现和数据契约；
2. 当前 PCB、Board Outline、Thickness、Cutout、Hole、Footprint、3D Model IR；
3. 当前 Agent 20 的 3D 模型映射、路径、版本、单位、Transform 和校验；
4. 当前 Agent 24 的 Height、Mechanical Keepout、Board-edge 和 HV 约束；
5. 当前 Agent 25 的 Fixed Objects、Placement、Mechanical Profile 和 Board Outline；
6. 当前 Agent 26 的铜、Zone、Via 和金属对象；
7. 当前 Agent 27 的热、屏蔽、机壳和接口 Finding；
8. 当前 STEP/BREP、STL、OBJ、3MF、VRML、DXF、IDF Parser；
9. 当前 Geometry Kernel、Open CASCADE、FreeCAD、Mesh 工具和许可证；
10. 当前 Board/Footprint/Model/Assembly 坐标系；
11. 当前单位、比例、镜像、Top/Bottom 和轴约定；
12. 当前外壳、面板、支架、螺柱、螺丝、屏蔽罩和散热器模型；
13. 当前连接器配对件、开孔、插拔轴、Latch 和线缆模型；
14. 当前 FPC、线束、按钮、旋钮、开关和动态运动数据；
15. 当前 Broad-phase、BVH、AABB、OBB、Mesh Collision 和 B-Rep Distance；
16. 当前 Clearance、Height、Opening Alignment 和 Hole Alignment；
17. 当前 Tool Envelope、Assembly Sequence、Service 和 Rework；
18. 当前 Tolerance、Worst-case、Monte Carlo 和实物测量；
19. 当前 Agent 19 Placement/Keepout/Board Outline Write、Readback 和 Rollback；
20. 当前 3D Viewer、Section、Explode、Motion 和 Evidence UI；
21. 当前 Queue、Worker、Database、Object Storage 和 Security；
22. 当前开源、合成、脱敏或授权 Fixture；
23. 统计关键器件 3D 模型覆盖；
24. 统计模型 Fidelity、单位、坐标、Revision 和 Binding 问题；
25. 统计 Collision、Clearance、Connector、Tool、FPC 和 Assembly 问题；
26. 只运行只读扫描和安全的模型解析；
27. 不修改 ECAD/MCAD；
28. 不自动 Healing 生产模型；
29. 不创建 Migration；
30. 不安装 Geometry Kernel；
31. 不调用外部模型；
32. 不读取或打印 Secret、NDA 模型和客户结构数据。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Review Job；
- Input Snapshot；
- Analysis Profile；
- Model Registry；
- Model Validation；
- Model Binding；
- Coordinate Frame；
- Transform Chain；
- Mechanical Part；
- Mechanical Instance；
- Body；
- Contact；
- Keepout Volume；
- Joint；
- Motion Sweep；
- Collision；
- Clearance；
- Alignment；
- Connector Review；
- Fastener Review；
- Tool；
- Flexible Body；
- Actuator；
- Shield/Heat-sink；
- Assembly Operation；
- Sequence；
- Service；
- Tolerance；
- Finding；
- Repair；
- Change Plan；
- Baseline；
- Waiver；
- Release Gate；
- JSON Schema。

## Phase 2：Agent 16–27 Input Gate

实现：

- Project Revision；
- Assembly Revision；
- PCB Geometry；
- Model Binding；
- Placement；
- Mechanical Constraint；
- Copper/Zone；
- Thermal/Shield Context；
- Model Coverage；
- Snapshot Hash；
- Blocked/Envelope-only/Exact-ready；
- Diagnostics。

## Phase 3：Secure Model Intake

实现：

- Content-type Detection；
- File Size/Count Limit；
- Archive Safety；
- Path Traversal；
- Macro/Script Rejection；
- Hash；
- License Metadata；
- Raw Artifact Preservation；
- Parser Routing；
- Security Tests。

## Phase 4：Model Registry 和 Validation

实现：

- STEP/BREP/Mesh Metadata；
- Unit；
- Axis；
- Handedness；
- Solid/Shell/Mesh Count；
- Open Shell；
- Non-manifold；
- Self-intersection；
- Degenerate；
- Bounding Box；
- Fidelity；
- Approval。

## Phase 5：Coordinate Frame Registry

实现：

- World/Assembly/Enclosure/Board/Footprint/Model/Tool；
- Parent-child；
- Unit；
- Axis Convention；
- Handedness；
- Transform；
- Stable Frame IDs；
- Source；
- Visualization；
- Contract Tests。

## Phase 6：Transform Chain 和 Unit Gate

实现：

- Translation；
- Rotation；
- Scale；
- Mirror；
- Unit Conversion；
- Board Top/Bottom；
- Combined Transform；
- Chain Hash；
- Round-trip；
- Ambiguity Gate；
- Golden Fixtures。

## Phase 7：Canonical Mechanical Assembly IR

实现：

- Parts；
- Instances；
- Bodies；
- Contacts；
- Keepouts；
- Motions；
- Tools；
- Sequences；
- Tolerances；
- Variants；
- Effectivity；
- Stable Serialization；
- Manifest。

## Phase 8：Geometry Provider Registry

实现：

- Provider Interface；
- Capability Discovery；
- STEP/BREP；
- Mesh；
- Distance；
- Boolean；
- Sweep；
- Section；
- Version；
- License；
- Approval；
- Contract Tests。

## Phase 9：Mesh Provider

实现：

- STL/OBJ/3MF；
- Tessellation；
- Normal；
- BVH；
- Triangle Collision；
- Distance Candidate；
- Simplification；
- Error Metadata；
- No Exact Claim。

## Phase 10：B-Rep Provider

实现：

- STEP/BREP Parse；
- Solid/Shell；
- Boolean Common；
- Exact/Kernel Distance；
- Face/Edge Contact；
- Section；
- Tessellation；
- Healing Candidate；
- Error Handling；
- Provider Tests。

## Phase 11：Model Normalization 和 Healing

实现：

- Normalize Unit/Frame；
- Preserve Raw；
- Sew Candidate；
- Duplicate Face；
- Small Gap；
- Normal Orientation；
- Degenerate Removal；
- Before/After Hash；
- Tolerance；
- Approval；
- No Silent Rewrite。

## Phase 12：Broad-phase Collision

实现：

- AABB；
- OBB；
- BVH；
- Spatial Hash；
- Collision Masks；
- Variant/Effectivity；
- Allowed Contacts；
- Incremental Index；
- Candidate Pair Trace；
- Performance Test。

## Phase 13：Narrow-phase Collision

实现：

- B-Rep/B-Rep；
- Mesh/Mesh；
- B-Rep/Mesh Adapter；
- Envelope；
- Intersection；
- Minimum Distance；
- Closest Points；
- Contact Classification；
- Evidence；
- Fidelity。

## Phase 14：Clearance、Height 和 Board-edge

实现：

- Vertical/Lateral/Radial；
- Height Zones；
- Stepped Enclosure；
- Board Edge；
- Metal-to-copper；
- Screw/Standoff-to-copper；
- Tolerance Margin Hook；
- Findings；
- Heatmap。

## Phase 15：Alignment Checks

实现：

- Hole Coaxiality；
- Connector Opening；
- Display Window；
- Button Axis；
- Light Pipe；
- Camera/Lens；
- Fan/Duct；
- Antenna；
- Position/Angle Error；
- Tolerance；
- Evidence。

## Phase 16：Connector and Mate Model

实现：

- Connector Role；
- Mate Binding；
- Keying；
- Insertion Axis；
- Depth；
- Extraction；
- Cable Exit；
- Opening；
- Latch；
- Finger Access；
- Review Status。

## Phase 17：Motion and Sweep Engine

实现：

- Linear；
- Rotation；
- Hinge；
- Slider；
- Piecewise；
- Sampled Pose；
- Swept Envelope；
- Exact Provider Hook；
- Sampling Error；
- Collision Along Path；
- Motion Trace。

## Phase 18：Connector Insertion/Removal Review

实现：

- Plug Sweep；
- Cable Head；
- Latch；
- Keying；
- Side Load；
- Extraction；
- Enclosure Opening；
- Blocking Instances；
- Closest Pose；
- Repair Candidates。

## Phase 19：Fastener Model

实现：

- Screw/Washer/Nut/Standoff/Insert；
- Hole Diameter；
- Coaxiality；
- Head；
- Length；
- Engagement；
- Seating；
- Captive Part；
- Assembly Direction；
- Findings。

## Phase 20：Tool Access Engine

实现：

- Tool Registry；
- Driver Bit；
- Screwdriver；
- Wrench；
- Pliers；
- Probe；
- Soldering Iron；
- Hot-air Nozzle；
- Approach Axis；
- Rotation Sweep；
- Blocking；
- Margin；
- Review UI。

## Phase 21：Shield Can Review

实现：

- Wall/Lid；
- Clip；
- Solder Fence；
- Ground Contact；
- Internal Height；
- Install/Removal Sweep；
- Rework Access；
- Antenna/EMC Context；
- Agent 27 Feedback。

## Phase 22：Heat-sink and Thermal Hardware Review

实现：

- Base Contact；
- TIM；
- Compression；
- Clip/Screw/Push-pin；
- Fin；
- Fan；
- Duct；
- Plastic Clearance；
- Removal；
- Thermal Context Hook；
- No Thermal Performance Claim。

## Phase 23：FPC Model and Path

实现：

- Width/Thickness；
- Neutral Axis；
- Connector Clamp；
- Length；
- Bend Radius；
- Twist；
- Fold；
- Centerline；
- Sweep；
- Cover Closing；
- Strain Candidate；
- Golden Tests。

## Phase 24：Cable and Harness Review

实现：

- Diameter/Bundle；
- Exit Direction；
- Bend Radius；
- Clamp；
- Service Loop；
- Strain Relief；
- Sharp Edge；
- Fan/Heat-sink/Screw；
- Cover Sweep；
- Service Removal。

## Phase 25：Button、Knob and Switch Review

实现：

- Panel Opening；
- Axis；
- Cap；
- Plunger；
- Travel；
- Preload；
- Tilt；
- Rotation；
- Nut；
- Finger Access；
- Motion Collision；
- Findings。

## Phase 26：Assembly Sequence Graph

实现：

- Operation；
- Preconditions；
- Motion；
- Tool；
- Postconditions；
- Precedence；
- Topological Sort；
- Cycle；
- Infeasible Operation；
- Captured Part；
- Sequence Artifact。

## Phase 27：Service and Rework

实现：

- Replaceable Module；
- Connector Unplug；
- Battery；
- Shield Removal；
- Heat-sink Removal；
- Iron/Nozzle；
- Probe；
- Label/Scan；
- Access Envelope；
- Findings。

## Phase 28：Tolerance Definitions

实现：

- Nominal；
- Plus/Minus；
- Distribution；
- Datum；
- Correlation；
- Temperature；
- Source；
- Approval；
- Unit；
- Missing-data Gate。

## Phase 29：Worst-case and Interval Tolerance

实现：

- Datum Chain；
- Interval Propagation；
- Worst-case Clearance；
- Sensitive Contributors；
- Contact/Compression；
- Numerical Trace；
- Findings；
- No Statistical Claim。

## Phase 30：Monte Carlo Tolerance

实现：

- Approved Distribution；
- Correlation；
- Seed；
- Sample Count；
- Convergence；
- Interference Probability；
- Margin Distribution；
- Sensitivity；
- Reproducibility；
- No Invented Distribution。

## Phase 31：Thermal Expansion Candidate

实现：

- Material CTE；
- Temperature Range；
- Length；
- Differential Expansion；
- Gap/Preload Change；
- Missing Context；
- Agent 27 Link；
- Candidate-only。

## Phase 32：Unified Mechanical Finding IR

实现：

- Type；
- Analysis Level；
- Fidelity；
- Severity；
- Confidence；
- Instances；
- Collision/Clearance/Motion/Tolerance；
- Evidence；
- Stable Key；
- Dedup；
- Serialization。

## Phase 33：Finding Correlation and Evidence

实现：

- Same Region/Part/Motion；
- Model/Coordinate Root Cause；
- Cross-domain Correlation；
- Section；
- Closest Points；
- Sweep Frames；
- Tolerance Chart；
- Before/After；
- Revision-safe Trace。

## Phase 34：Repair Candidate Routing

实现：

- Agent 20 Model；
- Agent 24 Constraint；
- Agent 25 Placement；
- Agent 26 Copper；
- Agent 27 Thermal/EMC；
- Agent 19 ECAD；
- MCAD Change Request；
- Process/Tooling；
- Expected Effect；
- Side Effect；
- Verification Plan。

## Phase 35：Agent 19 Integration

实现：

- Move/Rotate/Flip；
- Footprint Property；
- Mechanical Keepout；
- Height Zone；
- Board Outline/Cutout High-risk；
- Workspace；
- Preview；
- Approval；
- Idempotency；
- Rollback；
- No MCAD Direct Write。

## Phase 36：MCAD Change Request Package

实现：

- Target Part/Revision；
- Proposed Geometry Intent；
- Collision/Section Evidence；
- Required Margin；
- Datum；
- Effectivity；
- ECAD Dependency；
- Approval；
- Export Manifest；
- No Production CAD Rewrite。

## Phase 37：Post-write Mechanical Regression

实现：

- Reparse ECAD；
- Rebind Models；
- Rebuild Frames；
- Collision；
- Clearance；
- Motion；
- Tool；
- Assembly；
- Tolerance；
- New/Resolved/Worsened；
- Commit/Rollback Recommendation。

## Phase 38：Review Workbench

实现：

- Assembly Tree；
- 3D Viewer；
- Section；
- Explode；
- Collision；
- Closest Points；
- Motion Playback；
- Tool Access；
- FPC/Cable；
- Tolerance Mode；
- Repairs；
- Diff；
- Waiver；
- Approval。

## Phase 39：Baseline、Waiver、CI 和 Release Gate

实现：

- Project + Assembly Revision Baseline；
- Model Registry Hash；
- Finding Diff；
- Waiver Scope/Expiry；
- CLI；
- Gate Profiles；
- Manifest；
- Git/PLM Link；
- Exit Codes；
- Events。

## Phase 40：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Geometry Artifacts；
- Pagination；
- Permissions；
- Audit；
- Metrics；
- Artifact Lifecycle；
- Cleanup Policy。

## Phase 41：Benchmark、监控和生产发布

实现：

- Model Matrix；
- Coordinate Matrix；
- Static Collision；
- Distance；
- Sweep；
- Connector；
- Tool；
- FPC；
- Sequence；
- Tolerance；
- False Positive/Negative；
- Security；
- Performance；
- Feature Flags；
- Provider Rollback；
- Disaster Recovery。

## Phase 42：高级能力，可选

稳定后：

- IPC-2581/IDF Round-trip；
- Mechanical CAD Connector；
- Rigid-flex Fold State；
- Cable Physics；
- Deformable Foam/Gasket；
- Board Flex/Fastener Preload；
- Thermal-mechanical Solver Handoff；
- 3D Scan Deviation；
- Robot Assembly Feasibility；
- 仍不自动宣称结构签核完成。

---

# 68. Codex 工作纪律

Codex 必须：

1. ECAD、MCAD、Assembly Process 和 Tooling 分层；
2. Input Snapshot 不可变；
3. Project Revision 与 Assembly Revision 同时保存；
4. Coordinate Frame 显式；
5. Unit 显式；
6. Handedness 显式；
7. Axis Convention 显式；
8. Mirror 显式；
9. Transform Chain 可回放；
10. 不按视觉猜单位；
11. 不按文件名猜坐标；
12. Model Source/Revision/Hash/License；
13. Binding 显式；
14. Variant/Effectivity 显式；
15. Fidelity 必填；
16. Height/BBox 不冒充精确实体；
17. Mesh 不冒充公差 B-Rep；
18. Raw Model 永久保留；
19. Healing 有前后 Hash；
20. Healing 不静默；
21. Broad-phase 与 Narrow-phase 分开；
22. Collision Mask 明确；
23. Allowed Contact 明确；
24. Zero-distance 不自动判 Pass；
25. Compression 有目标范围；
26. Contact 与 Clearance 分开；
27. Clearance 有 Actual/Required/Margin；
28. Closest Points 保存；
29. Board-edge 与外壳 Clearance 分开；
30. 金属件与铜单独检查；
31. 连接器检查配对件；
32. 静态终点不代表插拔可行；
33. Sweep 方法和分辨率保存；
34. Latch/Flip-lock 作为运动；
35. FPC 不是刚体；
36. FPC Bend Radius 有来源；
37. Dynamic Bend 与 Static Bend 分开；
38. Cable 有 Clamp/Strain Relief；
39. Button 有 Travel/Axis；
40. Knob 有 Rotation Sweep；
41. Screw 对齐不代表工具可达；
42. Tool Geometry 有版本；
43. Thread Engagement 有来源；
44. Shield 安装和拆卸都检查；
45. Heat-sink TIM Compression 明确；
46. Thermal 性能不由几何碰撞模块冒充；
47. Assembly Sequence 用图；
48. Cycle 是 Hard Gate；
49. Service 与首次装配分开；
50. Rework 与 Service 分开；
51. Tolerance 与 Nominal 分开；
52. Worst-case 与 Statistical 分开；
53. Monte Carlo Distribution 不可猜；
54. Seed/Sample/Convergence 保存；
55. Measurement 必须匹配 Revision；
56. Finding Severity 与 Confidence 分开；
57. Model Fidelity 与 Confidence 分开；
58. AI 不生成尺寸、公差和碰撞真值；
59. AI 不改 Transform；
60. AI 不关闭 Finding；
61. 固定件不自动移动；
62. Board Outline/Hole/Connector 是高风险；
63. Agent 19写入前 Preview；
64. MCAD 只生成 Change Request；
65. 写入后重建整个 Assembly；
66. New/Worsened Finding 是 Gate；
67. Release Pass 不等于结构签核；
68. 不发送私有模型给外部通用模型；
69. 不用客户结构做公开 Fixture；
70. 不伪造模型、碰撞、公差、测量或 Benchmark；
71. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Model/Coordinate/Provider 变化；
    - 测试命令和真实结果；
    - Model Coverage/Fidelity；
    - Coordinate/Transform；
    - Collision/Clearance；
    - Connector/Fastener/Tool；
    - FPC/Cable/Actuator；
    - Assembly/Service；
    - Tolerance；
    - Repair/Regression；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 69. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Model and Coordinate

1. Valid STEP Solid；
2. STEP Open Shell；
3. STL Mesh；
4. Non-manifold Mesh；
5. Self-intersection；
6. Degenerate Triangles；
7. Unknown Unit；
8. Inch-to-mm；
9. Non-uniform Scale；
10. Left-handed；
11. Mirrored Model；
12. Wrong Board Side；
13. 90° Rotation Error；
14. Stale Revision；
15. Ambiguous Binding；
16. Missing Model；
17. Envelope-only；
18. B-Rep Exact；
19. Healing Candidate；
20. License Block。

## Static Collision and Clearance

21. Component-to-cover；
22. Component-to-rib；
23. Component-to-component；
24. Shield-to-component；
25. Heat-sink-to-capacitor；
26. Screw-to-connector；
27. Standoff-to-copper；
28. Metal-to-HV Copper；
29. Board-to-enclosure；
30. Board Thickness；
31. Bottom Lead Protrusion；
32. Allowed Thermal Contact；
33. Foam Compression；
34. Spring Finger Contact；
35. Near-miss；
36. Height Zone；
37. Stepped Cover；
38. Board-edge；
39. Opening Alignment；
40. Hole Coaxiality。

## Connectors and Motion

41. Correct Mate；
42. Wrong Key；
43. Reversed Connector；
44. Opening Misalignment；
45. Insertion Collision；
46. Extraction Collision；
47. Cable Head Collision；
48. Latch Collision；
49. Flip-lock FPC；
50. Finger Access；
51. Linear Sweep；
52. Rotational Sweep；
53. Hinge Sweep；
54. Sparse Sampling Risk；
55. Exact Sweep Provider。

## Fasteners and Tools

56. Screw Length；
57. Thread Engagement；
58. Washer Seating；
59. Nut Clearance；
60. Captive Screw；
61. Driver Access；
62. Wrench Swing；
63. Torque Tool；
64. Blocked Tool Axis；
65. Fastener Sequence。

## FPC/Cable/Actuator

66. FPC Bend Pass；
67. FPC Bend Fail；
68. FPC Twist；
69. FPC Too Short；
70. FPC Cover Closing；
71. Cable Bend；
72. Cable Sharp Edge；
73. Cable Fan Collision；
74. Cable Service Loop；
75. Button Axis；
76. Button Travel；
77. Button Side Load；
78. Knob Rotation；
79. Encoder Nut；
80. Toggle Switch。

## Assembly/Service/Tolerance

81. Valid Sequence；
82. Sequence Cycle；
83. Impossible Subassembly；
84. Captured Part；
85. Shield Removal；
86. Battery Service；
87. Hot-air Access；
88. Probe Access；
89. Worst-case Clearance；
90. Interval Analysis；
91. Monte Carlo Reproducibility；
92. Correlated Tolerances；
93. Missing Distribution；
94. Interference Probability；
95. Thermal Expansion Candidate。

## Workflow and Security

96. Agent 20 Feedback；
97. Agent 24 Feedback；
98. Agent 25 Feedback；
99. Agent 26 Feedback；
100. Agent 27 Feedback；
101. Agent 19 Preview；
102. Agent 19 Execute；
103. Post-write Regression；
104. MCAD Change Request；
105. Baseline；
106. Waiver Expiry；
107. Malicious STEP；
108. Zip Bomb；
109. Path Traversal；
110. Oversized Mesh；
111. Provider Timeout；
112. Unapproved Provider；
113. Tenant Isolation；
114. 10,000 Instances；
115. 1M Triangle Assembly；
116. Audit Replay。

---

# 70. 初始质量目标

```text
Critical Model Revision Trace Coverage = 100%
Coordinate Frame Disclosure = 100%
Unit/Handedness Disclosure = 100%
Unknown Unit Auto-acceptance = 0
Unknown Mirror Auto-acceptance = 0
Critical Fixed Object Auto-move = 0
Envelope-only Claimed Exact Pass = 0
Static-only Claimed Assembly Pass = 0
Connector Sweep Coverage for Required Interfaces = 100%
Fastener Tool-access Coverage for Required Fasteners = 100%
FPC Bend Source Coverage = 100%
Monte Carlo without Approved Distribution = 0
Mechanical Finding Geometry Evidence Coverage = 100%
MCAD Production File Direct Rewrite = 0
Post-write Mechanical Regression Coverage = 100%
Private Model Sent to External General Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 71. 性能要求

常规项目：

```text
100–2,000 PCB/Mechanical Instances
100k–5M Triangles
10–200 Motion/Tool/Tolerance Checks
```

目标：

```text
Input Readiness P95 < 15 s
Coordinate Registry P95 < 10 s
Assembly Build P95 < 30 s
Broad-phase P95 < 10 s for 2,000 instances
Envelope Collision P95 < 30 s
Interactive Finding Query P95 < 300 ms
Interactive Section/Hide/Explode target 30 FPS on client-ready meshes
```

精确 B-Rep 和 Sweep：

```text
按 Worker Resource Profile
支持 Timeout
支持 Cancel
支持 Partial Result
支持 Per-pair Retry
```

大型工程要求：

- LOD；
- BVH；
- Lazy Load；
- Incremental Transform；
- Candidate Pair 分片；
- Geometry Cache；
- Worker Pool；
- Backpressure；
- Artifact Quota；
- 不把完整模型发送给 AI。

---

# 72. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/mechanical-review-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第28个 Agent：

3D Mechanical Interference, Assembly Clearance & Accessibility Agent /
3D 与机械干涉 Agent。

本 Agent 接收：

- Agent 16 PCB、Board、Hole、Footprint 和 3D IR；
- Agent 20 3D Model Binding、Footprint、Courtyard 和模型校验；
- Agent 24 Height、Mechanical Keepout、Board-edge 和 HV 约束；
- Agent 25 Placement、Fixed Object、Mechanical Profile 和 Board Outline；
- Agent 26 Copper、Zone、Via 和 Routing；
- Agent 27 Thermal、Shield、Chassis 和 Interface Finding；
- STEP/BREP/STL/OBJ/3MF/VRML/DXF/IDF 模型；
- Enclosure、Connector Mate、Fastener、Tool、FPC、Cable、Button、Shield、Heat-sink 和 Assembly Process；

执行：

- Model Registry 和 Validation；
- Unit/Axis/Handedness/Transform；
- Canonical Mechanical Assembly IR；
- Static Collision 和 Minimum Clearance；
- Height/Opening/Hole Alignment；
- Connector Mating/Insertion/Extraction；
- Screw/Fastener/Tool Access；
- Shield/Heat-sink；
- FPC/Cable；
- Button/Knob/Switch Motion；
- Assembly Sequence；
- Service/Rework；
- Tolerance；
- Unified Finding；
- ECAD/MCAD Repair；
- Agent 19 Change Plan；
- Post-write Regression。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–28 规格和 Agent 16–27 实际代码；
3. docs/mechanical-review-agent-spec.md；
4. 当前 PCB/Board/Hole/Footprint/3D IR；
5. 当前 3D Model Registry/Binding；
6. 当前 Unit/Axis/Transform；
7. 当前 STEP/BREP/Mesh Parser；
8. 当前 Geometry Kernel；
9. 当前 Enclosure/Fastener/Connector/FPC/Tool 数据；
10. 当前 Collision/Clearance；
11. 当前 Motion/Sweep；
12. 当前 Assembly/Tolerance；
13. 当前 Agent 19 Write/Readback；
14. 当前 3D UI；
15. 当前 API/Worker/Storage/Security；
16. 开源、合成、脱敏或授权 Fixture。

硬约束：

- ECAD/MCAD/Assembly/Tooling Separation；
- Project and Assembly Revision；
- Explicit Unit/Axis/Handedness/Frame；
- Transform Chain Replay；
- No Visual Unit Guess；
- Model Source/Hash/Revision/License；
- Explicit Binding/Variant/Effectivity；
- Model Fidelity Required；
- Bounding Box != Exact Solid；
- Mesh != Tolerance-qualified B-Rep；
- Preserve Raw Model；
- Healing Audited；
- Broad/Narrow Phase Separation；
- Allowed Contact Explicit；
- Static Fit != Assembly Fit；
- Connector Mate and Sweep；
- FPC/Cable Flexible Model；
- Fastener != Tool Access；
- Assembly != Service/Rework；
- Nominal != Tolerance；
- Approved Distributions Only；
- AI Does Not Fabricate Geometry/Dimensions；
- Fixed Objects Never Auto-move；
- Agent 19 Controlled ECAD Write；
- MCAD Change Request Only；
- Full Mechanical Regression；
- Pass != Structural Signoff；
- 不发送私有模型给外部模型；
- 不用客户结构做公开 Fixture；
- 不伪造碰撞、公差、测量和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改 ECAD/MCAD：

1. 侦察当前仓库；
2. 检查 Agent 16–27 Contract；
3. 查找 PCB/Board/Hole/Footprint/3D；
4. 查找 Agent 20 Model Binding；
5. 查找 Agent 24/25 Mechanical Constraint；
6. 查找 Agent 26 Copper/Zone；
7. 查找 Agent 27 Thermal/Shield；
8. 查找 STEP/BREP/Mesh/VRML/DXF/IDF；
9. 查找 Geometry Kernel/Provider；
10. 查找 Unit/Axis/Frame/Transform；
11. 查找 Enclosure/Connector/Fastener/Tool；
12. 查找 FPC/Cable/Button；
13. 查找 Collision/Clearance；
14. 查找 Motion/Sweep；
15. 查找 Assembly/Service；
16. 查找 Tolerance；
17. 查找 Finding/Repair；
18. 查找 Agent 19 Write/Readback；
19. 查找 3D UI/API/Worker/Storage/Security；
20. 统计模型覆盖、Fidelity 和 Revision；
21. 统计 Coordinate/Unit/Binding 问题；
22. 统计 Collision/Clearance/Motion/Assembly 问题；
23. 抽样分析开源、合成、脱敏或授权 Fixture；
24. 在 docs/mechanical-review-implementation-plan.md 中生成实施计划；
25. 在 docs/input-model-coordinate-gates.md 中定义 Gate；
26. 在 docs/coordinate-frame-registry.md 中定义坐标；
27. 在 docs/model-registry-and-bindings.md 中定义模型；
28. 在 docs/canonical-mechanical-ir.md 中定义 IR；
29. 在 docs/geometry-providers.md 中定义 Provider；
30. 在 docs/collision-and-clearance.md 中定义碰撞；
31. 在 docs/connectors-and-mating.md 中定义连接器；
32. 在 docs/fasteners-and-tool-access.md 中定义紧固件；
33. 在 docs/fpc-cable-analysis.md 中定义柔性体；
34. 在 docs/actuators-and-motion.md 中定义运动；
35. 在 docs/shield-heatsink-airflow.md 中定义屏蔽散热；
36. 在 docs/assembly-sequence.md 中定义装配；
37. 在 docs/service-and-rework.md 中定义维修；
38. 在 docs/tolerance-analysis.md 中定义公差；
39. 在 docs/findings-and-repairs.md 中定义 Finding；
40. 在 docs/agent19-integration.md 中定义写入；
41. 在 docs/release-gates.md 中定义 Gate；
42. 在 docs/ai-boundaries.md 中定义 AI；
43. 在 docs/security.md 中定义安全；
44. 在 docs/mechanical-review-migration-plan.md 中定义旧能力迁移；
45. 在 docs/mechanical-review-benchmark-plan.md 中定义 Benchmark；
46. 给出拟新增、拟修改和拟复用文件；
47. 给出 Phase 1 精确范围；
48. 不修改业务代码；
49. 不创建 Migration；
50. 不安装 Geometry Kernel；
51. 不 Healing 生产模型；
52. 不修改 ECAD/MCAD；
53. 不调用外部模型；
54. 不读取或打印 Secret/NDA Model；
55. 运行仓库已有 lint、type check、test、build 和 security scan；
56. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–27 Contract；
- Input/Model/Coordinate Gate；
- Model Registry/Binding；
- Coordinate/Transform；
- Mechanical IR；
- Geometry Provider；
- Collision/Clearance；
- Height/Alignment；
- Connector/Motion；
- Fastener/Tool；
- FPC/Cable；
- Button/Knob；
- Shield/Heat-sink；
- Assembly/Service；
- Tolerance；
- Finding/Repair；
- Agent 19 Integration；
- MCAD Change Request；
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

# 73. 后续 Phase 提示词模板

```text
继续实现 Mechanical Review Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–28 规格；
3. 阅读 Mechanical Review Implementation Plan；
4. 阅读 Gate、Coordinate、Models、IR、Geometry、Collision、Motion、Assembly、Tolerance、Repair、Agent19、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Explicit Coordinate/Unit/Fidelity；
- Raw Model Preservation；
- Static/Dynamic/Tolerance Separation；
- Fixed Object Preservation；
- MCAD Change Request Only；
- Agent 19 Controlled ECAD Write；
- Full Mechanical Regression；
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
9. geometry provider contract test；
10. coordinate round-trip test；
11. collision/motion/tolerance test；
12. Agent 19/post-write test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Model/Coordinate/Provider 变化；
- 测试命令和真实结果；
- Model Coverage/Fidelity；
- Coordinate/Transform；
- Collision/Clearance；
- Connector/Fastener/Tool；
- FPC/Cable/Actuator；
- Assembly/Service；
- Tolerance；
- Repair/Regression；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 74. MVP 演示流程

1. 选择一块带 USB-C、FPC 显示屏、按键、屏蔽罩、散热器和四个安装孔的 KiCad 工程；
2. Agent 16解析 Board、Hole、Footprint 和 3D；
3. Agent 20提供 3D 模型绑定和 Revision；
4. Agent 24提供 Height、Board-edge、金属件和机械 Keepout；
5. Agent 25提供 Legalized Placement 和固定连接器；
6. Agent 26提供铜、Zone 和 Via；
7. Agent 27提供热和屏蔽相关 Finding；
8. 上传上盖、下壳、螺柱、螺丝、USB 配对插头、FPC、按键帽和散热器 STEP；
9. 建立 Input Snapshot；
10. 校验模型 Hash、Revision 和 License；
11. 建立 Board、Footprint、Model 和 Enclosure Frame；
12. 发现一个连接器模型使用错误旋转；
13. 阻断碰撞分析并要求 Agent 20修复绑定；
14. 修复后重新建立 Assembly；
15. Broad-phase 生成候选对；
16. Narrow-phase 发现电解电容与上盖加强筋相交 0.6mm；
17. 生成剖面和 Intersection Evidence；
18. 检查四个螺丝孔；
19. 三个通过，一个螺柱与安装孔偏心 0.4mm；
20. 检查螺丝头和工具；
21. 螺丝本体可装，但批头被 USB-C 外壳阻挡；
22. 输出 Tool Access Failure；
23. 检查 USB-C 终点位置；
24. 本体和外壳开口对齐；
25. 播放配对插头插入 Sweep；
26. 插头塑胶壳撞到上盖内壁；
27. 输出 Insertion Collision；
28. 检查 FPC 连接器 Flip-lock；
29. Lock 打开时碰到屏蔽罩；
30. FPC 路径最小弯曲半径不足；
31. 检查按键；
32. 按键帽轴线偏移 0.25mm，在最坏公差时有卡滞风险；
33. 检查散热器；
34. TIM 名义压缩通过，但最坏公差压缩过量；
35. 建立装配顺序；
36. 发现屏蔽罩先装后无法插入 FPC；
37. 调整装配顺序为先插 FPC、后装屏蔽罩；
38. 生成修复候选：
39. Agent 25移动电容；
40. MCAD Change Request 调整 USB 开口；
41. Agent 25旋转 FPC 连接器或移动屏蔽罩；
42. MCAD Change Request 移动螺柱；
43. Tooling Change 使用细长批头；
44. Agent 24新增 USB Plug Sweep Keepout；
45. 工程师批准移动电容和新增 Keepout；
46. Agent 19在 Workspace 执行；
47. 回读 PCB；
48. 重建 Transform 和 Assembly；
49. 重新运行 Static、Sweep、Tool、FPC、Sequence 和 Tolerance；
50. 电容碰撞关闭；
51. 新 Keepout 与 USB 插拔空间一致；
52. 没有产生新的铜、屏蔽或热问题；
53. 未批准的外壳和螺柱修改仍保持 Open MCAD Request；
54. Mechanical Assembly Ready Gate 被这些 High Finding 阻断；
55. MCAD 修复 Revision 导入后再次分析；
56. 所有 Critical/High Finding 关闭；
57. 生成 Collision Matrix、Connector、Tool、FPC、Assembly 和 Tolerance 报告；
58. 发布 `mechanical-review.completed`。

---

# 75. 生产上线顺序

第一阶段：

```text
Model Registry
Coordinate Frames
STEP/Mesh Import
Static Collision
Clearance/Height
Hole/Opening Alignment
Report-only
```

第二阶段：

```text
Connector Sweep
Fastener/Tool
FPC/Cable
Button/Knob
Assembly Sequence
Agent 19 ECAD Repairs
Post-write Regression
```

第三阶段：

```text
Tolerance Monte Carlo
Service/Rework
Shield/Heat-sink Advanced Review
MCAD Connector
3D Scan Correlation
Rigid-flex and Cable Physics
```

上线优先确保：

```text
每个模型的单位、坐标、方向和 Revision 是否可信
当前结论是 Bounding Box、Mesh 还是精确 B-Rep
零件最终位置无碰撞时，插入、拆卸和工具是否仍然可行
公差叠加后是否还保留足够空间
ECAD 和 MCAD 修改后，整套装配是否重新验证
```

一个可靠的 3D 与机械干涉 Agent，不能只回答“这两个模型碰没碰”。它还要回答：零件怎么进去、怎么拧紧、线怎么弯、按钮怎么动、坏了怎么拆，以及量产公差稍微不听话时，整机是不是还装得上。
