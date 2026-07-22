# KiCad MCP 执行 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：19  
> Agent 名称：KiCad MCP Execution, Transaction & Verification Agent  
> 中文名称：KiCad MCP 执行 Agent  
> 类型：编排型  
> 版本：V1.0  
> 技术资料基线日期：2026-07-20  
>
> 定位：把用户指令、Agent 16 Canonical EDA IR、Agent 18 Reviewed Netlist 或其他设计 Agent 输出，转换为版本化、可审计的 Canonical EDA Change Plan；根据当前 KiCad 版本、MCP Server、官方 IPC API、`kicad-cli` 和受控文件编辑能力选择执行后端，在隔离工作区中创建或修改 KiCad 工程，并通过回读、结构 Diff、ERC、DRC、文件 Hash 和预期后置条件确认真实执行结果。
>
> 主要能力：
> - 创建 KiCad 工程和文件结构
> - 创建或修改原理图 Sheet
> - 放置、移动、旋转、镜像和删除符号
> - 设置 Reference、Value、Footprint、Datasheet、MPN 和自定义属性
> - 放置 Wire、Label、Global Label、Power Symbol、Junction、Bus 和 Port
> - 连接 Pin-to-Net
> - 创建或修改 PCB
> - 放置和移动 Footprint
> - 创建 Board Outline
> - 绘制 Track、Via、Zone、Keepout 和 Rule Area
> - 设置 Net Class、规则、层和工艺属性
> - 从原理图更新 PCB
> - 运行 ERC、DRC、网表和导出
> - 读取执行前后状态
> - 生成结构化 Change Diff、Validation Report 和 Execution Report
> - Commit、Undo、Rollback 和恢复
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Part IR、Net IR、Source Map
> - Agent 17：PDF/图片原理图识别结果
> - Agent 18：Reviewed Netlist、Pin-to-Net 和待确认连接
> - 后续设计分析、器件推荐、自动布局和规则生成 Agent
> - 用户自然语言指令
> - ezPLM 项目、文档、物料、符号、封装和 3D 模型库
>
> 下游：
> - Agent 16：重新解析执行后的 KiCad 工程
> - Agent 31/32：BOM 和器件身份
> - Agent 43：EBOM/MBOM/NPI
> - Agent 44：PCB/SMT 制造询价
> - Agent 45：AOI、ICT、FCT 的设计基准
> - KiCad GUI、Git、CI、Review UI 和制造发布流程
>
> 重要边界：
> - 本 Agent 是编排器，不把某一个社区 KiCad MCP Server 的工具名当成永久 API。
> - Canonical Operation 和 Provider-specific MCP Tool 必须分开。
> - MCP 返回成功不等于工程修改成功；必须回读并验证后置条件。
> - V1 默认在工程副本或受控分支中执行，不直接修改唯一生产工程。
> - 高风险写操作必须先生成 Change Plan 和 Preview。
> - 删除、覆盖、跨页网络合并、Net 重命名、Footprint 替换、PCB 重布线、Zone 重建、制造输出和生产分支合并需要更高审批等级。
> - 不允许通用 LLM 直接自由拼接文件文本或执行任意 shell。
> - 不执行 MCP Server 未声明、未审核或不在 Allowlist 中的工具。
> - 不把 KiCad IPC Token、MCP Credential、私有工程或本机路径发送给外部模型。
> - 所有写操作必须有 Idempotency Key、前置条件、后置条件和可回滚点。
> - 自动修改不能掩盖未解决 ERC/DRC 或结构冲突。
> - 原始工程、执行前 Snapshot、执行后 Snapshot 和每个 Change Revision 永久分开。

---

# 1. 当前 KiCad 自动化技术基线

## 1.1 KiCad 版本基线

截至资料基线日期：

```text
KiCad 10 已于 2026-03 发布
10.0.4 为 2026-06 的稳定修复版本
```

系统仍建议支持：

```text
KiCad 9
KiCad 10
未来 KiCad 11 Adapter
```

所有能力必须按：

```text
KiCad major/minor
IPC API version
kicad-python version
kicad-cli version
MCP server/version
```

动态发现，不能把“KiCad MCP 支持某操作”写成全局事实。

## 1.2 官方 IPC API

KiCad 官方 IPC API：

```text
Protocol Buffers
NNG IPC transport
running KiCad instance as server
external process/plugin as client
```

官方 `kicad-python` 是 IPC API 的 Python Binding。

重要版本边界：

```text
KiCad 9/10 IPC API 需要运行中的 KiCad GUI
KiCad 9 初始 IPC 重点是 PCB Editor
KiCad 10 仍需按实际 API Capability 检查
未来版本继续扩展 Schematic 和 Headless 能力
```

因此本 Agent 必须同时支持：

```text
Official IPC Backend
kicad-cli Validation/Export Backend
Trusted MCP Backend
Controlled File Backend
```

不能把所有操作都假设为官方 IPC 已支持。

## 1.3 `kicad-cli`

KiCad 10 的官方 CLI 可用于：

```text
schematic ERC
PCB DRC
schematic netlist export
schematic PDF/SVG/DXF export
PCB Gerber/Drill/PDF/STEP/3D/统计导出
Jobset
版本查询
```

CLI 更适合作为：

```text
validation
export
independent readback
CI verification
```

而不是通用交互式编辑器。

## 1.4 社区 KiCad MCP

当前存在多个社区实现，例如：

```text
Seeed-Studio/kicad-mcp-server
mixelpixx/KiCAD-MCP-Server
lamaalrajih/kicad-mcp
circuit-synth/mcp-kicad-sch-api
kicad-mcp-pro
```

这些项目的能力、Tool Name、实现方式和稳定性不同。

本 Agent 不直接绑定其中一个实现，而建立：

```text
MCP Provider Adapter
Capability Registry
Tool Mapping Manifest
Contract Test
```

## 1.5 MCP 协议

MCP Server 可公开：

```text
Tools
Resources
Prompts
```

本 Agent 主要使用：

```text
Tools：执行操作
Resources：读取项目状态、日志和文件
```

MCP Tool 是模型可调用的，因此写操作必须：

```text
Allowlist
Risk Annotation
Approval Gate
Argument Schema Validation
Result Validation
Audit
```

---

# 2. 为什么需要独立的第19个 Agent

直接让模型调用 KiCad MCP 容易发生：

1. 工具名字随 MCP 实现变化；
2. 不知道 KiCad 当前打开哪个工程；
3. 不知道修改的是哪个 Sheet；
4. 通过 RefDes 选错重复实例；
5. 用屏幕坐标代替稳定对象 ID；
6. 多次重试导致重复放置；
7. Symbol 放置成功但属性设置失败；
8. Wire 画出来但没有真正吸附到 Pin；
9. Label 放在旁边但没有连接到 Net；
10. MCP 返回成功但工程未保存；
11. 修改后 ERC/DRC 变差；
12. 工程文件版本发生并发变化；
13. KiCad GUI Busy 或用户正在交互；
14. 插件崩溃后留下半完成工程；
15. 直接覆盖生产文件；
16. Retry 创建重复 Track、Via 或 Symbol；
17. 文件 Patch 与打开中的 KiCad 内存状态冲突；
18. 不同 KiCad 版本格式和 API 能力不同；
19. 社区 MCP Tool 参数不一致；
20. 工具调用日志无法还原设计变化。

Agent 19 的职责是把这些风险收敛到：

```text
Plan
→ Capability
→ Transaction
→ Execute
→ Readback
→ Validate
→ Commit/Rollback
```

---

# 3. 建设目标

系统必须能够：

1. 接收用户自然语言设计指令；
2. 接收 Agent 16 IR-based Change Request；
3. 接收 Agent 18 Reviewed Netlist；
4. 接收结构化 Design Patch；
5. 将意图转换为 Canonical Change Plan；
6. 将计划拆成原子 Operation；
7. 定义 Operation 依赖；
8. 定义前置条件；
9. 定义后置条件；
10. 定义风险等级；
11. 定义审批要求；
12. 定义执行 Backend；
13. 发现本机 KiCad；
14. 发现 KiCad 版本；
15. 发现 `kicad-cli`；
16. 发现运行中的 KiCad Instance；
17. 发现 IPC Socket；
18. 发现 IPC API Token Reference；
19. 发现官方 `kicad-python`；
20. 发现已配置 MCP Server；
21. 调用 MCP `tools/list`；
22. 调用 MCP `resources/list`；
23. 保存 MCP Server Identity；
24. 保存 MCP Tool Schema；
25. 对工具做 Allowlist；
26. 建立 Canonical Operation 到 Tool 的映射；
27. 验证 Tool Schema；
28. 检测 Tool Schema Drift；
29. 检测 KiCad API Capability；
30. 建立 Capability Matrix；
31. 支持 Read-only Mode；
32. 支持 Preview Mode；
33. 支持 Interactive GUI Mode；
34. 支持 Sandboxed File Mode；
35. 支持 Headless Validation Mode；
36. 支持 Hybrid Mode；
37. 创建 Workspace；
38. 复制或 Checkout 工程；
39. 建立 Git Branch 或 Snapshot；
40. 建立 Project Lock；
41. 建立 KiCad Session；
42. 打开工程；
43. 选择 Active Project；
44. 选择 Active Document；
45. 防止多实例选错；
46. 创建新 KiCad Project；
47. 创建 `.kicad_pro`；
48. 创建 Root Schematic；
49. 创建 PCB；
50. 创建 Local Symbol/Footprint Library；
51. 创建或打开 Sheet；
52. 放置 Symbol；
53. 指定 Library ID；
54. 指定坐标、旋转和镜像；
55. 设置 Reference；
56. 设置 Value；
57. 设置 Footprint；
58. 设置 Datasheet；
59. 设置 Manufacturer；
60. 设置 MPN；
61. 设置 Supplier SKU；
62. 设置 DNP；
63. 设置 BOM/Board Exclusion；
64. 设置自定义 Property；
65. 移动 Symbol；
66. 旋转 Symbol；
67. 镜像 Symbol；
68. 删除 Symbol；
69. 添加 Junction；
70. 添加 Wire；
71. 连接两个 Pin；
72. 连接 Pin 到 Label；
73. 放置 Local Label；
74. 放置 Global Label；
75. 放置 Hierarchical Label；
76. 放置 Power Symbol；
77. 放置 No Connect；
78. 创建 Bus；
79. 创建 Bus Entry；
80. 创建 Hierarchical Sheet；
81. 创建 Sheet Pin；
82. 更新 Annotation；
83. 检测 Duplicate RefDes；
84. 指定 RefDes Policy；
85. 指定 Net Name；
86. 修改 Net Name；
87. 拆分或合并网络；
88. 修改 Pin-to-Net；
89. 导入 Agent 18 Netlist；
90. 生成原理图草稿；
91. 从原理图更新 PCB；
92. 添加 Footprint；
93. 移动 Footprint；
94. 旋转 Footprint；
95. 翻转 Footprint；
96. 锁定 Footprint；
97. 替换 Footprint；
98. 删除 Footprint；
99. 设置 Footprint Property；
100. 创建 Board Outline；
101. 修改 Board Outline；
102. 添加 Track；
103. 修改 Track；
104. 删除 Track；
105. 添加 Via；
106. 修改 Via；
107. 删除 Via；
108. 创建 Differential Pair Track；
109. 创建 Zone；
110. 修改 Zone；
111. Refill Zone；
112. 创建 Keepout；
113. 创建 Rule Area；
114. 创建 Net Class；
115. 设置 Track Width；
116. 设置 Clearance；
117. 设置 Via Rule；
118. 设置 Differential Pair Rule；
119. 设置 Length Rule；
120. 设置 Layer Stack-up；
121. 设置 Board Property；
122. 设置 Drill/Place Origin；
123. 导入 Netlist；
124. 同步 Schematic 和 PCB；
125. 运行 ERC；
126. 运行 DRC；
127. 导出 Netlist；
128. 导出 BOM；
129. 导出 PDF/SVG；
130. 导出 Gerber；
131. 导出 Drill；
132. 导出 Pick-and-Place；
133. 导出 STEP；
134. 导出 IPC/Manufacturing Artifact；
135. 读取 Symbol；
136. 读取 Wire；
137. 读取 Net；
138. 读取 Footprint；
139. 读取 Track/Via/Zone；
140. 读取 Rule；
141. 读取当前 Selection；
142. 读取执行前状态；
143. 读取执行后状态；
144. 重新调用 Agent 16 Parser；
145. 生成 Semantic Diff；
146. 验证前置条件；
147. 验证后置条件；
148. 验证对象数量；
149. 验证对象属性；
150. 验证 Pin-to-Net；
151. 验证 Schematic-PCB 一致性；
152. 验证文件保存；
153. 验证文件 Hash；
154. 验证 ERC；
155. 验证 DRC；
156. 验证无 Critical Regression；
157. 支持事务；
158. 支持 IPC Commit；
159. 支持 Drop Commit；
160. 支持 KiCad Undo；
161. 支持 Git Commit；
162. 支持文件级 Rollback；
163. 支持 Saga；
164. 支持操作重试；
165. 支持 Idempotency；
166. 支持操作超时；
167. 支持 Busy；
168. 支持用户中断；
169. 支持 MCP Server 崩溃；
170. 支持 KiCad 崩溃；
171. 支持部分成功；
172. 支持 Compensation；
173. 支持恢复执行；
174. 支持 Dry Run；
175. 支持执行影响预览；
176. 支持 Change Plan 审批；
177. 支持高风险操作二次确认；
178. 支持只读审查；
179. 支持操作日志；
180. 支持命令和结果脱敏；
181. 支持执行截图，可选；
182. 支持 Resource Snapshot；
183. 支持 Tool Call Trace；
184. 支持每个步骤的 Before/After；
185. 支持 Execution Report；
186. 支持 Machine-readable Result；
187. 支持多租户；
188. 支持项目权限；
189. 支持本地 Agent Worker；
190. 支持远程私有 Worker；
191. 支持 Windows；
192. 支持 macOS；
193. 支持 Linux；
194. 支持 KiCad 9；
195. 支持 KiCad 10；
196. 为 KiCad 11 预留；
197. 不假设所有版本支持同一 API；
198. 不假设所有 MCP Server 支持同一工具；
199. 不使用 GUI 像素点击作为默认执行方式；
200. 不执行任意 Shell；
201. 不通过文本正则直接修改完整 KiCad 文件；
202. 不在未验证 Serializer 时直接覆盖工程；
203. 不把 MCP `success=true` 当作真实成功；
204. 不在验证失败后自动合并到生产分支；
205. 不因 Retry 重复放置对象；
206. 不在用户正在交互时并发修改同一文档；
207. 不自动接受破坏性操作；
208. 不自动清除 ERC/DRC Exclusion；
209. 不自动修改供应商制造文件；
210. 不在无回滚点时执行高风险写操作。

---

# 4. 核心架构

```text
Intent / IR / Reviewed Netlist
        ↓
Change Request Normalizer
        ↓
Canonical EDA Change Plan
        ↓
Capability Discovery & Backend Selection
        ↓
Workspace / Lock / Snapshot
        ↓
Precondition Reader
        ↓
Preview & Risk Gate
        ↓
Execution Saga
   ├─ MCP Adapter
   ├─ Official IPC Adapter
   ├─ kicad-cli Adapter
   └─ Controlled File Adapter
        ↓
Readback through Agent 16 + KiCad
        ↓
Semantic Diff + ERC/DRC + Postconditions
        ↓
Commit or Rollback
        ↓
Execution Report / Events
```

---

# 5. 四层执行模型

## 5.1 Intent Layer

```text
“创建一个 STM32 最小系统原理图”
“把 U3 的 Footprint 改为 QFN-32”
“将 USB_D+ 从 U1.12 接到 J1.3”
“把 C1 移到 U1 电源脚附近”
```

## 5.2 Canonical Plan Layer

结构化、Backend-neutral：

```text
create_project
place_symbol
set_property
connect_pins
move_footprint
route_track
run_erc
```

## 5.3 Provider Execution Layer

映射到：

```text
Seeed MCP Tool
Orchis/KiCAD-MCP Tool
circuit-synth MCP Tool
Official IPC API
kicad-cli
Controlled File Patch
```

## 5.4 Verification Layer

通过：

```text
MCP read tool
Official API readback
Agent 16 parse
kicad-cli ERC/DRC/export
file hash
semantic diff
```

确认结果。

---

# 6. Canonical Change Request

```json
{
  "change_request_id": "uuid",
  "project_id": "uuid",
  "base_revision": "git-sha-or-snapshot",
  "source": {
    "type": "agent18_reviewed_netlist",
    "reference_id": "uuid"
  },
  "objective": "Create a reviewed schematic draft",
  "constraints": {
    "target_kicad_major": [9, 10],
    "do_not_modify_pcb": true,
    "allow_new_local_libraries": true
  },
  "requested_validation": [
    "agent16_reparse",
    "erc",
    "semantic_diff"
  ]
}
```

---

# 7. Canonical EDA Change Plan

```json
{
  "change_plan_id": "uuid",
  "plan_version": 1,
  "project_id": "uuid",
  "base_revision": "sha256-or-git-sha",
  "operations": [],
  "dependencies": [],
  "risk_summary": {},
  "required_capabilities": [],
  "approval_policy": "review_before_write",
  "rollback_policy": "snapshot_and_git",
  "expected_postconditions": [],
  "status": "draft"
}
```

---

# 8. Canonical Operation

```json
{
  "operation_id": "op-001",
  "operation_type": "place_symbol",
  "target_document": {
    "document_type": "schematic",
    "sheet_path": "/Power"
  },
  "selector": null,
  "arguments": {
    "library_id": "Device:C",
    "reference": "C12",
    "value": "100nF",
    "position_mm": {"x": "120.65", "y": "84.10"},
    "rotation_deg": 0
  },
  "preconditions": [
    {"type": "reference_not_exists", "value": "C12"}
  ],
  "postconditions": [
    {"type": "symbol_exists", "reference": "C12"},
    {"type": "property_equals", "reference": "C12", "field": "Value", "value": "100nF"}
  ],
  "idempotency_key": "place-C12-plan1",
  "risk_level": "medium",
  "approval_requirement": "plan_approved"
}
```

---

# 9. Operation 分类

```text
project
document
library
schematic_object
schematic_connectivity
annotation
pcb_object
pcb_connectivity
constraint
validation
export
session
version_control
```

---

# 10. Operation 风险等级

## Read-only

```text
inspect project
read symbols
read nets
read PCB
run analysis without save
```

## Low

```text
create snapshot
open document
select object
export preview
```

## Medium

```text
place new symbol
set property
add label
move unlocked footprint
add non-critical graphic
```

## High

```text
delete symbol
replace footprint
rename net
merge/split net
modify board outline
route critical track
change stack-up
change power net
```

## Critical

```text
bulk delete
overwrite project
apply recognized candidate netlist without review
clear routing
change production branch
export manufacturing release as approved
```

---

# 11. Approval Policy

```text
none_for_read
plan_approved
step_approved
two_person_approval
manual_only
```

风险只是默认值，可被企业策略提高，不能被模型降低。

---

# 12. Capability Registry

每个 Backend 保存：

```text
backend id
backend type
provider
version
KiCad versions
platforms
read capabilities
write capabilities
transaction support
headless support
GUI requirement
validation capabilities
known gaps
security profile
last verified
```

---

# 13. Capability 状态

```text
supported
supported_with_conditions
interactive_only
headless_only
file_backend_only
manual_confirmation
unsupported
unknown
disabled
```

`unknown` 不当成 `supported`。

---

# 14. Backend 类型

```text
mcp_server
official_ipc
kicad_cli
controlled_file
manual_gui
```

默认不实现通用 GUI RPA。

---

# 15. Backend 选择原则

优先级不是固定，而按 Operation：

## PCB Read/Write

优先：

```text
Official IPC API
→ Trusted MCP using Official IPC
→ Controlled File Backend
```

## Schematic Read/Write

按当前版本能力：

```text
Trusted MCP/validated schematic backend
→ Agent 16 Serializer + Controlled File Backend
→ future Official Schematic IPC
```

## ERC/DRC/Export

优先：

```text
kicad-cli
```

## Interactive Move

优先：

```text
Official IPC interactive operation
or trusted MCP interactive tool
```

---

# 16. Backend Selection Result

```json
{
  "operation_id": "op-001",
  "selected_backend": "mcp:trusted-kicad-server",
  "selected_tool": "schematic_place_symbol",
  "fallbacks": [
    "controlled-file:kicad-sch-serializer"
  ],
  "capability_evidence": {
    "server_version": "x.y.z",
    "tool_schema_hash": "sha256"
  }
}
```

---

# 17. MCP Provider Adapter

每个 MCP 实现一个 Adapter：

```python
class KicadMcpProviderAdapter:
    async def discover(self) -> ProviderDiscovery: ...
    async def health(self) -> ProviderHealth: ...
    async def map_operation(self, operation) -> ToolInvocationPlan: ...
    async def invoke(self, tool_call) -> ProviderResult: ...
    async def readback(self, read_request) -> ProviderReadback: ...
    async def normalize_error(self, error) -> CanonicalExecutionError: ...
```

---

# 18. MCP Server Admission

MCP Server 必须经过：

```text
server identity verification
executable/package hash
version allowlist
transport policy
tool list snapshot
tool schema validation
write tool allowlist
resource URI allowlist
network egress policy
contract tests
```

未审核 Server 只能进入：

```text
read_only_shadow
```

---

# 19. MCP Transport

支持：

```text
stdio
Streamable HTTP
```

本地 KiCad 控制优先：

```text
stdio
or loopback-only HTTP
```

HTTP 必须防：

```text
DNS rebinding
remote unauthenticated access
origin confusion
credential leak
```

---

# 20. MCP Tool Manifest

```json
{
  "provider_id": "seeed-kicad-mcp",
  "provider_version": "x.y.z",
  "tool_name": "place_symbol",
  "tool_schema_hash": "sha256",
  "canonical_operations": ["place_symbol"],
  "risk_level": "medium",
  "read_only": false,
  "destructive": false,
  "idempotency_supported": false,
  "verified_kicad_versions": [9, 10],
  "last_contract_test": "ISO-8601"
}
```

---

# 21. Tool Schema Drift

检测：

```text
tool removed
tool renamed
argument added/removed
argument type changed
enum changed
result shape changed
risk annotation changed
```

发生 Drift：

```text
disable dangerous write mapping
allow safe health/read tools
create review alert
run contract tests
```

---

# 22. Tool 数量和上层接口

Agent 19 对上游不应公开社区 MCP 的上百个低层 Tool。

推荐公开少量高层能力：

```text
inspect_environment
inspect_project
create_change_plan
preview_change_plan
approve_change_plan
execute_change_plan
read_execution
validate_project
rollback_execution
export_artifacts
```

内部再分派到低层 Tool。

---

# 23. Workspace

每次执行创建：

```text
source revision
working copy
temporary directory
Git branch
file snapshot
artifact directory
KiCad session reference
lock
```

---

# 24. Workspace Mode

```text
ephemeral_preview
persistent_branch
local_user_workspace
remote_private_worker
```

生产默认：

```text
persistent_branch
```

---

# 25. Project Lock

锁范围：

```text
project
schematic document
PCB document
library
release branch
```

锁保存：

```text
owner
execution id
lease expiry
heartbeat
KiCad instance
```

---

# 26. 并发策略

同一文件：

```text
single writer
multiple readers
```

不同文档可否并行，由 KiCad 内存状态和 Backend 能力决定。

默认保守：

```text
one active write transaction per project
```

---

# 27. KiCad Session

```text
session id
platform
KiCad version
process id
IPC socket reference
token secret reference
active project
open documents
active document
GUI/headless
busy state
user interaction state
```

---

# 28. 多实例选择

禁止简单连接默认 `api.sock`。

选择依据：

```text
explicit session id
project path
environment variables
process id
socket path
user confirmation
```

找不到唯一实例：

```text
MULTIPLE_KICAD_INSTANCES_AMBIGUOUS
```

---

# 29. Session Health

检查：

```text
KiCad process alive
socket reachable
token valid
document open
project path match
document revision match
not busy
API version compatible
```

---

# 30. Snapshot

执行前保存：

```text
Git SHA
working tree status
project file hashes
Agent 16 IR bundle hash
open KiCad state
ERC/DRC baseline
```

---

# 31. Change Preview

至少包含：

```text
新增对象
删除对象
移动对象
属性变化
Pin-to-Net 变化
Net 新增/删除/合并/拆分
Footprint 变化
Track/Via/Zone 变化
Rule 变化
预计 ERC/DRC 风险
不可回滚部分
```

---

# 32. Preview 来源

```text
IR-level simulation
temporary workspace execution
Backend dry-run
file diff
```

高风险操作优先在临时副本真实执行一次 Preview。

---

# 33. Selector

优先级：

```text
native KiCad UUID/KIID
Agent 16 canonical id + source map
sheet path + reference + unit
footprint UUID
net UUID
explicit geometry id
coordinate selector last
```

禁止只用：

```text
“第二个 U1”
“左边那个电容”
```

除非已经通过读取结果解析为唯一对象。

---

# 34. Selector Preconditions

```text
exactly one match
object type
document
revision
property snapshot
position tolerance
lock state
```

匹配 0 或多于 1：

```text
SELECTOR_NOT_UNIQUE
```

---

# 35. 原理图 Operation

```text
create_schematic
create_sheet
place_symbol
move_symbol
rotate_symbol
mirror_symbol
delete_symbol
set_symbol_property
set_symbol_footprint
set_symbol_dnp
place_wire
delete_wire
place_junction
place_label
place_global_label
place_hierarchical_label
place_power_symbol
place_no_connect
create_bus
create_bus_entry
create_sheet_pin
connect_pins
disconnect_pin
rename_net
annotate
```

---

# 36. `connect_pins`

不要把“连接 U1.1 和 R1.2”直接解释成一条任意直线。

输入：

```text
source pin selector
target pin/net selector
routing style
label policy
junction policy
avoid object regions
```

输出 Plan：

```text
wire segments
junctions
labels if needed
expected Pin-to-Net
```

---

# 37. Schematic Routing Style

```text
orthogonal
direct
label_based
hierarchical_port
power_symbol
manual_preview
```

长距离连接优先：

```text
label_based
```

避免跨越大量器件。

---

# 38. Wire 连接验证

执行后确认：

```text
Wire Endpoint 与 Pin Anchor 一致
Junction 语义正确
Pin-to-Net 已变化
没有意外 Net Merge
没有新悬空短线
```

只看 Wire 几何存在不够。

---

# 39. Symbol Property

Canonical Field：

```text
Reference
Value
Footprint
Datasheet
Description
Manufacturer
MPN
Supplier
Supplier Part Number
DNP
Exclude from BOM
Exclude from Board
Custom Properties
```

Provider Adapter 映射源字段。

---

# 40. Reference 策略

```text
preserve
explicit
auto_annotate
annotate_new_only
reannotate_scope
```

量产工程默认：

```text
preserve
```

---

# 41. Library Resolution

放置 Symbol 前：

```text
resolve library id
verify symbol definition
verify unit count
verify pins
verify local/global library table
verify footprint link
```

缺失时：

```text
create_project_local_library
```

必须经过受控 Library Builder，不在运行时随意下载。

---

# 42. Custom Symbol/Footprint

来源：

```text
ezPLM library
Agent 16 parsed library
approved generated asset
project local asset
```

需要：

```text
asset hash
library id
version
license
source
pin/pad validation
```

---

# 43. PCB Operation

```text
create_pcb
update_pcb_from_schematic
import_netlist
place_footprint
move_footprint
rotate_footprint
flip_footprint
lock_footprint
replace_footprint
delete_footprint
create_board_outline
modify_board_outline
place_track
modify_track
delete_track
place_via
modify_via
delete_via
create_zone
modify_zone
delete_zone
refill_zones
create_keepout
create_rule_area
set_netclass
set_design_rule
set_stackup
set_origin
```

---

# 44. PCB Transaction

官方 `kicad-python` Board 支持 Commit 概念：

```text
begin_commit
push_commit
drop/cancel behavior
```

Adapter 应尽量把一个逻辑 Plan 分组为单个 Undo Step。

如果 Backend 不支持事务：

```text
workspace snapshot + file rollback
```

---

# 45. Update PCB from Schematic

流程：

```text
validate schematic
export/import netlist or supported API
dry run
show added/removed/updated footprints
preserve locks
preserve approved placement groups
apply
readback
DRC
```

不得默认删除 PCB-only Footprint。

---

# 46. Footprint 替换

检查：

```text
same part/refdes
pad number compatibility
pin-pad mapping
courtyard
orientation
position anchor
3D model
locked status
routing impact
```

高风险：

```text
pad set changed
```

必须阻断自动提交或进入人工审核。

---

# 47. Track Operation

输入：

```text
net
layer
width
polyline
start/end pad/via
clearance profile
```

执行后验证：

```text
track belongs to correct net
endpoints connected
width correct
layer correct
no new DRC
```

---

# 48. Via Operation

```text
position
net
size
drill
layer pair
via type
tenting/fill if supported
```

Blind/Buried/Microvia 必须先验证 Stack-up 和规则。

---

# 49. Zone Operation

```text
net
layer set
outline
priority
clearance
thermal
keepout flags
```

Zone Refill 后：

```text
readback fill status
run DRC
```

---

# 50. Board Outline

修改前：

```text
closed contour
cutout
dimension
origin
existing panelization
```

修改后：

```text
closed
non-self-intersecting
single valid outer contour or explicit multi-board
```

---

# 51. 规则修改

```text
net class
clearance
track width
via size
diff pair
length
skew
impedance
creepage
keepout
```

规则变更默认 High Risk，因为影响全板。

---

# 52. Validation Backend

## Agent 16 Reparse

验证结构事实：

```text
object exists
property
position
Pin-to-Net
Track/Via/Zone
rules
```

## `kicad-cli`

验证：

```text
ERC
DRC
netlist
export
```

## MCP/IPC Readback

验证运行中对象。

三者可互相交叉验证。

---

# 53. Postcondition

类型：

```text
file_exists
file_hash_changed
object_exists
object_absent
property_equals
position_within
pin_connected_to_net
pin_disconnected
net_exists
net_endpoint_count
footprint_exists
track_exists
zone_exists
erc_no_new_errors
drc_no_new_errors
agent16_diff_matches
project_saved
```

---

# 54. Success 定义

一个 Operation 成功必须满足：

```text
provider call accepted
provider result normalized
readback completed
postconditions passed
file persisted if required
no blocking regression
```

否则：

```text
EXECUTION_UNVERIFIED
```

---

# 55. 保存确认

需要确认：

```text
KiCad memory state
file modified time
file hash
close/reopen optional
Agent 16 reparse
```

不能仅依据 MCP 返回：

```text
saved: true
```

---

# 56. Semantic Diff

使用 Agent 16 比较：

```text
Project
Sheet
Symbol
Property
Pin-to-Net
Net
Footprint
Placement
Pad
Track
Via
Zone
Rule
Stack-up
```

---

# 57. Diff 与 Plan 对账

```text
planned change
actual change
unexpected change
missing change
```

任何 Unexpected High-risk Change 阻断 Commit。

---

# 58. ERC/DRC Regression

保存：

```text
baseline findings
after findings
new findings
resolved findings
unchanged findings
excluded findings
```

默认 Gate：

```text
no new error-severity finding
```

Warning 策略可配置。

---

# 59. Execution Saga

```text
Acquire Lock
→ Create Snapshot
→ Start/Open Session
→ Verify Base Revision
→ Execute Operation Group
→ Readback
→ Validate
→ Save
→ Reparse
→ Semantic Diff
→ ERC/DRC
→ Commit
→ Release Lock
```

失败：

```text
Compensate
→ Rollback
→ Reopen/Reparse
→ Verify Restored State
```

---

# 60. Operation Group

推荐：

```text
project initialization
library preparation
schematic placement
schematic connectivity
annotation/properties
PCB synchronization
PCB placement
PCB routing
validation/export
```

每组可形成独立 Checkpoint。

---

# 61. Idempotency

Idempotency Key 至少包括：

```text
project id
base revision
change plan revision
operation id
canonical arguments hash
target document
```

---

# 62. Retry

重试前先读回：

```text
postcondition already true?
object already created?
provider call result uncertain?
```

若已完成：

```text
mark recovered_success
```

不能再次创建。

---

# 63. MCP 超时

超时后状态：

```text
provider_result_unknown
```

必须查询工程状态，不立即重试写操作。

---

# 64. Rollback 层级

```text
IPC drop commit
KiCad undo
file restore
Git reset/worktree restore
workspace discard
```

优先选择最接近操作的回滚。

---

# 65. 不可回滚操作

可能包括：

```text
外部文件导出覆盖
用户同时手工修改
外部脚本副作用
Manufacturing Release 发布
```

执行前明确警告并要求更高审批。

---

# 66. 用户交互检测

如果用户在 KiCad GUI 中：

```text
interactive move
modal dialog
unsaved manual edits
active tool
busy API
```

Agent 应暂停：

```text
WAITING_FOR_USER_INTERACTION
```

---

# 67. Manual Handoff

某操作 Backend 不支持时：

```text
生成定位信息
选择对象
打开对应文档
高亮目标
显示人工步骤
等待用户完成
重新读取验证
```

Manual Handoff 仍需 Audit。

---

# 68. Controlled File Backend

只在：

```text
Agent 16 Parser/Serializer 已验证
目标格式版本受支持
Round-trip Test 通过
工程未在 KiCad 中以未保存状态打开
```

时启用。

---

# 69. File Patch 原则

```text
AST/IR aware
source id aware
path-based
preconditioned
minimal diff
atomic write
temporary file
fsync
rename
reparse
```

禁止：

```text
regex replace whole file
string append S-expression
blind coordinate insertion
```

---

# 70. File Patch Operation

```text
add_entity
update_entity
remove_entity
move_entity
connect_entities
disconnect_entities
update_property
```

映射到 Source-aware Patch DSL。

---

# 71. GUI RPA

默认：

```text
unsupported
```

只有在受控实验环境可作为：

```text
manual-assist
```

不能作为生产主路径，因为像素、窗口、快捷键和弹窗不稳定。

---

# 72. Execution Result

```json
{
  "execution_id": "uuid",
  "change_plan_id": "uuid",
  "status": "completed_with_warnings",
  "base_revision": "sha",
  "result_revision": "sha",
  "operations": [],
  "validation": {
    "agent16_reparse": "passed",
    "erc": "passed_with_warnings",
    "drc": "not_requested",
    "semantic_diff": "matched_with_one_warning"
  },
  "unexpected_changes": [],
  "artifacts": {},
  "rollback_available": true
}
```

---

# 73. Operation Result

```text
operation id
backend
provider tool
tool arguments hash
started/completed
provider status
readback status
postconditions
diff
error
retry count
compensation
```

---

# 74. Execution Status

```text
draft
planned
awaiting_preview
preview_ready
awaiting_approval
approved
queued
acquiring_lock
preparing_workspace
opening_session
executing
waiting_for_user
validating
committing
completed
completed_with_warnings
partially_completed
rollback_pending
rolling_back
rolled_back
blocked
failed
cancelled
```

---

# 75. 错误码

```text
CHANGE_REQUEST_INVALID
CHANGE_PLAN_INVALID
BASE_REVISION_MISMATCH
CAPABILITY_NOT_FOUND
CAPABILITY_UNKNOWN
BACKEND_DISABLED
MCP_SERVER_NOT_FOUND
MCP_SERVER_IDENTITY_MISMATCH
MCP_TOOL_NOT_FOUND
MCP_TOOL_SCHEMA_DRIFT
MCP_TOOL_NOT_ALLOWED
MCP_TRANSPORT_FAILED
MCP_CALL_TIMEOUT
MCP_RESULT_INVALID
KICAD_NOT_INSTALLED
KICAD_VERSION_UNSUPPORTED
KICAD_CLI_NOT_FOUND
KICAD_INSTANCE_NOT_FOUND
MULTIPLE_KICAD_INSTANCES_AMBIGUOUS
KICAD_API_DISABLED
KICAD_API_SOCKET_UNREACHABLE
KICAD_API_TOKEN_INVALID
KICAD_BUSY
KICAD_MODAL_DIALOG
PROJECT_NOT_FOUND
PROJECT_LOCKED
PROJECT_PATH_OUTSIDE_WORKSPACE
DOCUMENT_NOT_FOUND
DOCUMENT_NOT_OPEN
DOCUMENT_REVISION_MISMATCH
UNSAVED_USER_CHANGES
SELECTOR_NOT_FOUND
SELECTOR_NOT_UNIQUE
PRECONDITION_FAILED
POSTCONDITION_FAILED
SYMBOL_LIBRARY_NOT_FOUND
SYMBOL_NOT_FOUND
FOOTPRINT_LIBRARY_NOT_FOUND
FOOTPRINT_NOT_FOUND
REFERENCE_DUPLICATE
PIN_NOT_FOUND
PIN_TO_NET_MISMATCH
NET_NOT_FOUND
NET_MERGE_RISK
POWER_DOMAIN_RISK
FOOTPRINT_PADSET_CHANGED
BOARD_OUTLINE_INVALID
TRACK_NOT_CONNECTED
VIA_LAYER_INVALID
ZONE_REFILL_FAILED
RULE_CONFLICT
ERC_REGRESSION
DRC_REGRESSION
UNEXPECTED_SEMANTIC_DIFF
PROJECT_SAVE_UNVERIFIED
FILE_HASH_MISMATCH
AGENT16_REPARSE_FAILED
IDEMPOTENCY_CONFLICT
PROVIDER_RESULT_UNKNOWN
ROLLBACK_FAILED
MANUAL_INTERVENTION_REQUIRED
EXECUTION_UNVERIFIED
JOB_CANCELLED
INTERNAL_ERROR


---

# 76. 数据库设计

## 76.1 `kicad_execution_environments`

```text
id UUID PK
tenant_id UUID NOT NULL
environment_name VARCHAR NOT NULL
environment_type VARCHAR NOT NULL
platform VARCHAR NOT NULL
host_reference VARCHAR NOT NULL
kicad_installations JSONB NOT NULL
kicad_cli_paths JSONB NOT NULL
ipc_capabilities JSONB NOT NULL
mcp_provider_ids JSONB NOT NULL
workspace_roots JSONB NOT NULL
security_profile_id UUID NOT NULL
status VARCHAR NOT NULL
last_health_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(tenant_id, environment_name)
```

## 76.2 `kicad_installation_snapshots`

```text
id UUID PK
environment_id UUID NOT NULL
kicad_version VARCHAR NOT NULL
major_version INT NOT NULL
minor_version INT NOT NULL
patch_version INT NULL
executable_path TEXT NOT NULL
cli_path TEXT NULL
build_metadata JSONB NOT NULL
ipc_api_available BOOLEAN NOT NULL
ipc_api_version VARCHAR NULL
plugin_system_version VARCHAR NULL
capability_probe_uri TEXT NOT NULL
detected_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
```

## 76.3 `kicad_mcp_providers`

```text
id UUID PK
tenant_id UUID NULL
provider_name VARCHAR NOT NULL
provider_type VARCHAR NOT NULL
implementation_reference TEXT NOT NULL
server_version VARCHAR NOT NULL
transport_type VARCHAR NOT NULL
launch_configuration JSONB NOT NULL
executable_or_package_hash CHAR(64) NULL
trust_status VARCHAR NOT NULL
write_enabled BOOLEAN NOT NULL
network_policy JSONB NOT NULL
credential_reference VARCHAR NULL
status VARCHAR NOT NULL
last_discovered_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(provider_name, server_version)
```

## 76.4 `kicad_mcp_tool_snapshots`

```text
id UUID PK
provider_id UUID NOT NULL
discovery_version INT NOT NULL
tool_name VARCHAR NOT NULL
tool_description TEXT NULL
input_schema JSONB NOT NULL
output_schema_hint JSONB NULL
tool_annotations JSONB NOT NULL
schema_hash CHAR(64) NOT NULL
risk_level VARCHAR NOT NULL
allow_status VARCHAR NOT NULL
read_only BOOLEAN NOT NULL
destructive BOOLEAN NOT NULL
idempotency_supported BOOLEAN NOT NULL
discovered_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_id, discovery_version, tool_name)
```

## 76.5 `kicad_backend_capability_profiles`

```text
id UUID PK
backend_type VARCHAR NOT NULL
backend_reference_id UUID NULL
backend_version VARCHAR NOT NULL
kicad_version_range JSONB NOT NULL
platform_scope JSONB NOT NULL
capability_name VARCHAR NOT NULL
capability_status VARCHAR NOT NULL
conditions JSONB NOT NULL
transaction_support VARCHAR NOT NULL
headless_support VARCHAR NOT NULL
gui_requirement VARCHAR NOT NULL
evidence JSONB NOT NULL
last_verified_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(backend_type, backend_reference_id, backend_version, capability_name)
```

## 76.6 `kicad_operation_mappings`

```text
id UUID PK
canonical_operation_type VARCHAR NOT NULL
backend_type VARCHAR NOT NULL
backend_reference_id UUID NULL
backend_version_range JSONB NOT NULL
provider_tool_name VARCHAR NULL
mapping_version VARCHAR NOT NULL
argument_mapping JSONB NOT NULL
result_mapping JSONB NOT NULL
preflight_rules JSONB NOT NULL
postcondition_support JSONB NOT NULL
risk_override VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(canonical_operation_type, backend_type, backend_reference_id, mapping_version)
```

## 76.7 `kicad_change_requests`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
request_source_type VARCHAR NOT NULL
request_source_reference_id UUID NULL
natural_language_objective TEXT NULL
structured_request JSONB NOT NULL
base_revision VARCHAR NOT NULL
target_kicad_versions JSONB NOT NULL
constraints JSONB NOT NULL
requested_validations JSONB NOT NULL
requested_by UUID NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.8 `kicad_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
change_request_id UUID NOT NULL
project_id UUID NOT NULL
plan_version INT NOT NULL
base_revision VARCHAR NOT NULL
plan_hash CHAR(64) NOT NULL
required_capabilities JSONB NOT NULL
risk_summary JSONB NOT NULL
approval_policy VARCHAR NOT NULL
rollback_policy VARCHAR NOT NULL
expected_postconditions JSONB NOT NULL
status VARCHAR NOT NULL
created_by_type VARCHAR NOT NULL
created_by_reference UUID NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(change_request_id, plan_version)
```

## 76.9 `kicad_change_operations`

```text
id UUID PK
change_plan_id UUID NOT NULL
operation_key VARCHAR NOT NULL
sequence_number INT NOT NULL
operation_type VARCHAR NOT NULL
operation_group VARCHAR NOT NULL
target_document JSONB NOT NULL
selector JSONB NULL
arguments JSONB NOT NULL
preconditions JSONB NOT NULL
postconditions JSONB NOT NULL
required_capabilities JSONB NOT NULL
idempotency_key VARCHAR NOT NULL
risk_level VARCHAR NOT NULL
approval_requirement VARCHAR NOT NULL
selected_backend_type VARCHAR NULL
selected_backend_reference_id UUID NULL
selected_mapping_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(change_plan_id, operation_key)
UNIQUE(idempotency_key)
```

## 76.10 `kicad_operation_dependencies`

```text
id UUID PK
change_plan_id UUID NOT NULL
predecessor_operation_id UUID NOT NULL
successor_operation_id UUID NOT NULL
dependency_type VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(predecessor_operation_id, successor_operation_id, dependency_type)
```

## 76.11 `kicad_workspaces`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
environment_id UUID NOT NULL
workspace_mode VARCHAR NOT NULL
source_revision VARCHAR NOT NULL
workspace_path_reference TEXT NOT NULL
git_branch VARCHAR NULL
snapshot_id UUID NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
expires_at TIMESTAMPTZ NULL
closed_at TIMESTAMPTZ NULL
```

## 76.12 `kicad_project_locks`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
workspace_id UUID NOT NULL
lock_scope VARCHAR NOT NULL
document_reference JSONB NULL
owner_execution_id UUID NULL
lease_token_hash CHAR(64) NOT NULL
acquired_at TIMESTAMPTZ NOT NULL
heartbeat_at TIMESTAMPTZ NOT NULL
expires_at TIMESTAMPTZ NOT NULL
released_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 76.13 `kicad_sessions`

```text
id UUID PK
environment_id UUID NOT NULL
workspace_id UUID NOT NULL
session_type VARCHAR NOT NULL
platform VARCHAR NOT NULL
kicad_version VARCHAR NOT NULL
process_id BIGINT NULL
ipc_socket_reference TEXT NULL
ipc_token_secret_reference VARCHAR NULL
active_project_path_reference TEXT NULL
open_documents JSONB NOT NULL
active_document JSONB NULL
busy_status VARCHAR NOT NULL
user_interaction_status VARCHAR NOT NULL
health_status VARCHAR NOT NULL
started_at TIMESTAMPTZ NOT NULL
last_heartbeat_at TIMESTAMPTZ NOT NULL
ended_at TIMESTAMPTZ NULL
```

## 76.14 `kicad_project_snapshots`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
workspace_id UUID NOT NULL
snapshot_type VARCHAR NOT NULL
git_revision VARCHAR NULL
working_tree_status JSONB NOT NULL
file_manifest_uri TEXT NOT NULL
file_manifest_hash CHAR(64) NOT NULL
agent16_ir_bundle_id UUID NULL
agent16_ir_hash CHAR(64) NULL
erc_baseline_uri TEXT NULL
drc_baseline_uri TEXT NULL
created_at TIMESTAMPTZ
```

## 76.15 `kicad_change_previews`

```text
id UUID PK
change_plan_id UUID NOT NULL
workspace_id UUID NOT NULL
preview_mode VARCHAR NOT NULL
status VARCHAR NOT NULL
planned_diff_uri TEXT NOT NULL
semantic_diff_uri TEXT NULL
risk_findings JSONB NOT NULL
unavailable_capabilities JSONB NOT NULL
unexpected_changes JSONB NOT NULL
estimated_validations JSONB NOT NULL
preview_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 76.16 `kicad_executions`

```text
id UUID PK
tenant_id UUID NOT NULL
change_plan_id UUID NOT NULL
workspace_id UUID NOT NULL
session_id UUID NULL
execution_attempt INT NOT NULL
base_revision VARCHAR NOT NULL
status VARCHAR NOT NULL
current_operation_id UUID NULL
approval_snapshot JSONB NOT NULL
result_revision VARCHAR NULL
rollback_available BOOLEAN NOT NULL
rollback_status VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(change_plan_id, execution_attempt)
```

## 76.17 `kicad_operation_executions`

```text
id UUID PK
execution_id UUID NOT NULL
operation_id UUID NOT NULL
attempt_number INT NOT NULL
backend_type VARCHAR NOT NULL
backend_reference_id UUID NULL
provider_tool_name VARCHAR NULL
tool_schema_hash CHAR(64) NULL
arguments_hash CHAR(64) NOT NULL
provider_request_uri TEXT NULL
provider_response_uri TEXT NULL
provider_status VARCHAR NOT NULL
readback_status VARCHAR NOT NULL
postcondition_status VARCHAR NOT NULL
semantic_diff_status VARCHAR NULL
compensation_status VARCHAR NULL
result_summary JSONB NOT NULL
error_code VARCHAR NULL
error_message TEXT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(execution_id, operation_id, attempt_number)
```

## 76.18 `kicad_tool_call_traces`

```text
id UUID PK
operation_execution_id UUID NOT NULL
provider_id UUID NULL
tool_name VARCHAR NOT NULL
call_sequence INT NOT NULL
request_redacted JSONB NOT NULL
response_redacted JSONB NULL
request_hash CHAR(64) NOT NULL
response_hash CHAR(64) NULL
transport_metadata JSONB NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
```

## 76.19 `kicad_precondition_results`

```text
id UUID PK
operation_execution_id UUID NOT NULL
precondition_type VARCHAR NOT NULL
expected_value JSONB NOT NULL
actual_value JSONB NULL
status VARCHAR NOT NULL
evidence_uri TEXT NULL
checked_at TIMESTAMPTZ NOT NULL
```

## 76.20 `kicad_postcondition_results`

```text
id UUID PK
operation_execution_id UUID NOT NULL
postcondition_type VARCHAR NOT NULL
expected_value JSONB NOT NULL
actual_value JSONB NULL
status VARCHAR NOT NULL
evidence_uri TEXT NULL
checked_at TIMESTAMPTZ NOT NULL
```

## 76.21 `kicad_readback_snapshots`

```text
id UUID PK
execution_id UUID NOT NULL
operation_execution_id UUID NULL
readback_source VARCHAR NOT NULL
readback_type VARCHAR NOT NULL
document_reference JSONB NOT NULL
data_uri TEXT NOT NULL
data_hash CHAR(64) NOT NULL
source_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.22 `kicad_semantic_diffs`

```text
id UUID PK
execution_id UUID NOT NULL
left_snapshot_id UUID NOT NULL
right_snapshot_id UUID NOT NULL
agent16_diff_job_id UUID NULL
planned_change_match_status VARCHAR NOT NULL
added_entities JSONB NOT NULL
removed_entities JSONB NOT NULL
modified_entities JSONB NOT NULL
unexpected_changes JSONB NOT NULL
diff_uri TEXT NOT NULL
diff_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 76.23 `kicad_validation_runs`

```text
id UUID PK
execution_id UUID NOT NULL
validation_type VARCHAR NOT NULL
validator_backend VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
baseline_reference JSONB NULL
status VARCHAR NOT NULL
new_findings INT NOT NULL
resolved_findings INT NOT NULL
unchanged_findings INT NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 76.24 `kicad_execution_checkpoints`

```text
id UUID PK
execution_id UUID NOT NULL
checkpoint_number INT NOT NULL
operation_group VARCHAR NOT NULL
snapshot_id UUID NOT NULL
project_revision VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(execution_id, checkpoint_number)
```

## 76.25 `kicad_compensation_actions`

```text
id UUID PK
execution_id UUID NOT NULL
operation_execution_id UUID NULL
compensation_type VARCHAR NOT NULL
arguments JSONB NOT NULL
status VARCHAR NOT NULL
result_uri TEXT NULL
error_code VARCHAR NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 76.26 `kicad_manual_handoffs`

```text
id UUID PK
execution_id UUID NOT NULL
operation_id UUID NOT NULL
handoff_type VARCHAR NOT NULL
instructions_uri TEXT NOT NULL
target_document JSONB NOT NULL
target_selector JSONB NOT NULL
expected_postconditions JSONB NOT NULL
status VARCHAR NOT NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 76.27 `kicad_execution_approvals`

```text
id UUID PK
change_plan_id UUID NOT NULL
execution_id UUID NULL
approval_scope VARCHAR NOT NULL
approval_level VARCHAR NOT NULL
risk_snapshot JSONB NOT NULL
approved_operation_ids JSONB NOT NULL
decision VARCHAR NOT NULL
decided_by UUID NOT NULL
decided_at TIMESTAMPTZ NOT NULL
reason TEXT NULL
```

## 76.28 `kicad_export_artifacts`

```text
id UUID PK
execution_id UUID NOT NULL
artifact_type VARCHAR NOT NULL
source_document_reference JSONB NOT NULL
format_version VARCHAR NULL
storage_uri TEXT NOT NULL
sha256 CHAR(64) NOT NULL
validation_status VARCHAR NOT NULL
release_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 76.29 `kicad_execution_reports`

```text
id UUID PK
execution_id UUID NOT NULL
report_version INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
machine_summary JSONB NOT NULL
human_summary TEXT NULL
created_at TIMESTAMPTZ
UNIQUE(execution_id, report_version)
```

## 76.30 `kicad_adapter_contract_runs`

```text
id UUID PK
backend_type VARCHAR NOT NULL
backend_reference_id UUID NULL
backend_version VARCHAR NOT NULL
kicad_version VARCHAR NOT NULL
contract_suite_version VARCHAR NOT NULL
status VARCHAR NOT NULL
capability_results JSONB NOT NULL
result_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

---

# 77. 对象存储

```text
derived/kicad-execution/
  {tenant_id}/{project_id}/
    requests/
      {change_request_id}/
    plans/
      {change_plan_id}/
        plan.json
        operations.jsonl.zst
        capability-resolution.json
        approval/
    workspaces/
      {workspace_id}/
        source-snapshot/
        working-manifest.json
        locks/
    executions/
      {execution_id}/
        input/
          request.json
          plan.json
          base-file-manifest.json
          base-agent16-ir.json
          capability-snapshot.json
          provider-tool-snapshot.json
        preview/
          planned-diff.json
          preview-report.html
          preview-images/
        operations/
          {operation_id}/
            provider-request.json
            provider-response.json
            readback.json
            preconditions.json
            postconditions.json
            diff.json
            screenshots/
        checkpoints/
        validation/
          agent16/
          erc/
          drc/
          exports/
        semantic-diff/
        rollback/
        reports/
          execution-report.json
          execution-report.html
          execution-report.pdf
        audit/
          tool-calls.jsonl.zst
          events.jsonl.zst
          resource-usage.json
```

---

# 78. API 设计

## 78.1 Environment 和 Capability

```text
POST /api/v1/kicad-execution/environments
GET  /api/v1/kicad-execution/environments
GET  /api/v1/kicad-execution/environments/{id}
POST /api/v1/kicad-execution/environments/{id}/discover
POST /api/v1/kicad-execution/environments/{id}/health
GET  /api/v1/kicad-execution/environments/{id}/capabilities
GET  /api/v1/kicad-execution/providers
GET  /api/v1/kicad-execution/providers/{id}/tools
POST /api/v1/kicad-execution/providers/{id}/contract-test
```

## 78.2 Change Request 和 Plan

```text
POST /api/v1/kicad-execution/change-requests
GET  /api/v1/kicad-execution/change-requests/{id}
POST /api/v1/kicad-execution/change-requests/{id}/plan
GET  /api/v1/kicad-execution/change-plans/{id}
GET  /api/v1/kicad-execution/change-plans/{id}/operations
POST /api/v1/kicad-execution/change-plans/{id}/validate
POST /api/v1/kicad-execution/change-plans/{id}/preview
POST /api/v1/kicad-execution/change-plans/{id}/approve
POST /api/v1/kicad-execution/change-plans/{id}/reject
```

## 78.3 Workspace 和 Session

```text
POST /api/v1/kicad-execution/workspaces
GET  /api/v1/kicad-execution/workspaces/{id}
POST /api/v1/kicad-execution/workspaces/{id}/lock
POST /api/v1/kicad-execution/workspaces/{id}/unlock
POST /api/v1/kicad-execution/workspaces/{id}/snapshot
POST /api/v1/kicad-execution/sessions
GET  /api/v1/kicad-execution/sessions/{id}
POST /api/v1/kicad-execution/sessions/{id}/health
POST /api/v1/kicad-execution/sessions/{id}/close
```

## 78.4 Execution

```text
POST /api/v1/kicad-execution/executions
GET  /api/v1/kicad-execution/executions/{id}
GET  /api/v1/kicad-execution/executions/{id}/events
GET  /api/v1/kicad-execution/executions/{id}/operations
POST /api/v1/kicad-execution/executions/{id}/pause
POST /api/v1/kicad-execution/executions/{id}/resume
POST /api/v1/kicad-execution/executions/{id}/cancel
POST /api/v1/kicad-execution/executions/{id}/retry
POST /api/v1/kicad-execution/executions/{id}/rollback
```

## 78.5 Manual Handoff

```text
GET  /api/v1/kicad-execution/manual-handoffs
GET  /api/v1/kicad-execution/manual-handoffs/{id}
POST /api/v1/kicad-execution/manual-handoffs/{id}/claim
POST /api/v1/kicad-execution/manual-handoffs/{id}/complete
POST /api/v1/kicad-execution/manual-handoffs/{id}/reject
```

## 78.6 Readback、Diff 和 Validation

```text
POST /api/v1/kicad-execution/executions/{id}/readback
POST /api/v1/kicad-execution/executions/{id}/reparse
POST /api/v1/kicad-execution/executions/{id}/semantic-diff
POST /api/v1/kicad-execution/executions/{id}/validate
GET  /api/v1/kicad-execution/executions/{id}/diff
GET  /api/v1/kicad-execution/executions/{id}/validations
GET  /api/v1/kicad-execution/executions/{id}/report
```

## 78.7 Export

```text
POST /api/v1/kicad-execution/executions/{id}/exports
GET  /api/v1/kicad-execution/executions/{id}/artifacts
GET  /api/v1/kicad-execution/artifacts/{id}
```

## 78.8 Read-only Project Inspection

```text
POST /api/v1/kicad-execution/inspect/environment
POST /api/v1/kicad-execution/inspect/project
POST /api/v1/kicad-execution/inspect/document
POST /api/v1/kicad-execution/inspect/selector
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 79. 上层 MCP Tool 设计

Agent 19 自身可以作为 MCP Server，向 Codex 或其他 Agent 暴露少量高层 Tool。

## 79.1 `inspect_kicad_environment`

输入：

```text
environment id
project optional
```

输出：

```text
KiCad installations
running instances
MCP providers
capabilities
health
```

## 79.2 `inspect_kicad_project`

输入：

```text
project id/revision
requested views
```

输出 Agent 16 IR、当前 Session 和验证状态的摘要。

## 79.3 `create_kicad_change_plan`

输入：

```text
objective
structured changes
base revision
constraints
```

输出：

```text
plan
risk
capability gaps
approval need
```

## 79.4 `preview_kicad_change_plan`

只在副本执行或做 IR 级模拟。

## 79.5 `approve_kicad_change_plan`

要求明确用户或工作流身份，不允许模型自批。

## 79.6 `execute_kicad_change_plan`

只接受已批准 Plan ID，不接受自由文本 Shell 或任意 Tool Name。

## 79.7 `read_kicad_execution`

返回进度、结果和验证。

## 79.8 `validate_kicad_project`

运行 Agent 16、ERC、DRC 和一致性检查。

## 79.9 `rollback_kicad_execution`

只回滚指定 Execution/Checkpoint。

## 79.10 `export_kicad_artifacts`

需要已验证工程和独立 Export Policy。

---

# 80. MCP Tool 注解

高层 Tool 应正确标记：

```text
readOnlyHint
destructiveHint
idempotentHint
openWorldHint
```

但服务端不能只依赖客户端尊重注解，仍需服务端权限和 Gate。

---

# 81. 输入 Schema 防护

所有高层 Tool：

- 禁止任意命令字段；
- 禁止绝对路径自由输入；
- Project ID 映射受控路径；
- 数值有范围；
- Layer、Operation 和 Enum 受控；
- Selector Schema 明确；
- JSON 深度和大小限制；
- 不接受 Provider Tool Name 作为用户参数；
- 不接受 MCP Credential。

---

# 82. 输出 Schema

所有 Tool 返回：

```text
status
entity ids
revision
evidence
warnings
approval requirements
next allowed actions
resource links
```

错误使用 Canonical Error，不泄露内部 Stack Trace、Token 或真实本机路径。

---

# 83. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
design.change-request.created
design.change-plan.approved
project.revision.created
library.asset.approved
kicad.environment.available
kicad.manual-handoff.completed
```

## 输出事件

```text
kicad.capability.discovered
kicad.change-plan.ready
kicad.change-plan.preview-ready
kicad.change-plan.approval-required
kicad.execution.started
kicad.execution.progress
kicad.execution.waiting-for-user
kicad.execution.validation-failed
kicad.execution.completed
kicad.execution.completed-with-warnings
kicad.execution.rollback-started
kicad.execution.rolled-back
kicad.execution.failed
kicad.project-revision.ready
kicad.artifacts.ready
```

## `kicad.project-revision.ready`

```json
{
  "event_type": "kicad.project-revision.ready",
  "event_version": "1.0",
  "project_id": "uuid",
  "execution_id": "uuid",
  "base_revision": "sha",
  "result_revision": "sha",
  "validation": {
    "agent16": "passed",
    "erc": "passed",
    "drc": "not_requested"
  },
  "semantic_diff_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 84. 操作策略文件

```text
policies/
├── kicad-execution-1.0.0.yaml
├── operation-risk.yaml
├── approval.yaml
├── backend-selection.yaml
├── selector.yaml
├── idempotency.yaml
├── retry.yaml
├── validation-gates.yaml
├── erc-drc-regression.yaml
├── workspace-lock.yaml
├── rollback.yaml
├── exports.yaml
├── mcp-server-admission.yaml
├── tool-allowlist.yaml
└── enterprise/
```

---

# 85. Operation Registry

```text
operations/
├── project.yaml
├── schematic.yaml
├── connectivity.yaml
├── annotation.yaml
├── pcb.yaml
├── routing.yaml
├── zones.yaml
├── rules.yaml
├── validation.yaml
└── export.yaml
```

每个 Operation 定义：

```text
JSON Schema
risk
required capabilities
preconditions
postconditions
allowed backends
fallback policy
approval policy
rollback policy
```

---

# 86. Provider Mapping

```text
provider-mappings/
├── official-ipc/
│   ├── kicad9.yaml
│   └── kicad10.yaml
├── kicad-cli/
│   ├── kicad9.yaml
│   └── kicad10.yaml
├── seeed-kicad-mcp/
├── orchis-kicad-mcp/
├── circuit-synth/
└── controlled-file/
```

Provider 名只是示例，必须按实际安装和审核结果创建。

---

# 87. Adapter Contract Tests

每个 Write Capability 至少测试：

1. 创建对象；
2. 重复调用不重复创建；
3. 读取对象；
4. 修改对象；
5. 保存；
6. 关闭并重开；
7. Agent 16 Reparse；
8. Undo/Rollback；
9. 错误 Selector；
10. Tool Timeout；
11. KiCad Busy；
12. Schema Drift；
13. 不支持版本；
14. 并发 Lock；
15. 异常中断。

---

# 88. Golden Project

至少准备：

```text
empty-project
simple-rc
hierarchical-schematic
multi-unit-opamp
mcu-minimum-system
two-layer-board
four-layer-board
zones-and-rules
diff-pair
production-like-project
```

KiCad 9 和 KiCad 10 分别测试。

---

# 89. Benchmark

## Plan

```text
intent to operation accuracy
dependency validity
selector uniqueness
risk classification
capability selection
```

## Execution

```text
operation success
idempotency
transaction
readback
save
rollback
```

## Schematic

```text
symbol placement
properties
wire pin attachment
junction
label
Pin-to-Net
hierarchy
annotation
```

## PCB

```text
footprint placement
track connectivity
via
zone
outline
rule
netlist sync
```

## Validation

```text
semantic diff match
ERC regression
DRC regression
file reopen
Agent 16 parse
```

## Reliability

```text
MCP timeout
KiCad busy
process crash
network failure
schema drift
concurrent user edit
```

## Security

```text
unapproved tool
path traversal
arbitrary command
credential exposure
project escape
unauthorized release
```

---

# 90. 初始质量目标

```text
Unapproved Write Execution = 0
Arbitrary Shell Execution = 0
Project Path Escape = 0
MCP Credential Exposure = 0
Write Tool Allowlist Enforcement = 100%
Base Revision Verification = 100%
Project Lock Enforcement = 100%
Operation Idempotency >= 99.99%
Duplicate Symbol/Track on Retry = 0
Postcondition Verification Coverage = 100%
Agent 16 Reparse Coverage for Committed Writes = 100%
Unexpected High-risk Diff Auto-commit = 0
New ERC Error Auto-commit = 0
New DRC Error Auto-commit = 0
Rollback Verification Coverage = 100%
Tool Schema Drift Dangerous-write Disable = 100%
Selector Ambiguity Auto-execution = 0
Production Branch Direct Write by Default = 0
Audit Tool-call Coverage = 100%
```

这些是目标，不是未经验证的保证。

---

# 91. 测试集

## Environment

1. KiCad 9；
2. KiCad 10；
3. KiCad Missing；
4. CLI Missing；
5. IPC Disabled；
6. Multiple Instances；
7. Invalid Token；
8. Busy；
9. Modal Dialog；
10. Version Mismatch。

## MCP

11. stdio；
12. loopback HTTP；
13. Server Identity；
14. Tool List；
15. Tool Schema；
16. Tool Removed；
17. Argument Changed；
18. Result Changed；
19. Write Tool Disabled；
20. Timeout；
21. Crash；
22. Malformed Result；
23. Unauthorized Tool；
24. Resource URI Escape；
25. Credential Redaction。

## Plan/Workspace

26. Create Plan；
27. Invalid Operation；
28. Dependency Cycle；
29. Risk Gate；
30. Approval；
31. Base Revision Mismatch；
32. Workspace Copy；
33. Git Branch；
34. Lock；
35. Lock Expiry；
36. Concurrent Writer；
37. Snapshot；
38. Dirty Working Tree；
39. Unsaved User Change；
40. Preview。

## Schematic

41. New Project；
42. New Sheet；
43. Place Symbol；
44. Retry Place Symbol；
45. Set Value；
46. Set Footprint；
47. Custom Property；
48. DNP；
49. Move/Rotate；
50. Delete；
51. Add Wire；
52. Pin Attachment；
53. Junction；
54. Local Label；
55. Global Label；
56. Power Symbol；
57. No Connect；
58. Bus；
59. Hierarchical Sheet；
60. Annotation；
61. Duplicate RefDes；
62. Rename Net；
63. Net Merge Risk；
64. Agent 18 Import；
65. Reopen Verification。

## PCB

66. Create PCB；
67. Update from Schematic；
68. Place Footprint；
69. Locked Footprint；
70. Replace Same Padset；
71. Replace Changed Padset；
72. Board Outline；
73. Track；
74. Wrong Net Track；
75. Via；
76. Invalid Layer Via；
77. Zone；
78. Refill；
79. Keepout；
80. Net Class；
81. Diff Pair；
82. Stack-up；
83. DRC Regression；
84. Commit/Undo；
85. Reopen Verification。

## Saga/Export

86. Partial Failure；
87. Provider Unknown；
88. Retry Readback；
89. Checkpoint；
90. Rollback；
91. Rollback Failure；
92. Manual Handoff；
93. ERC；
94. DRC；
95. Netlist Export；
96. Gerber/Drill；
97. STEP；
98. Tenant Isolation；
99. 1000 Operations；
100. Audit Replay。

---

# 92. 性能要求

常规交互：

```text
Environment Health P95 < 2 s
Project Inspection P95 < 5 s
Single Read Operation P95 < 1 s
Single Write + Readback P95 < 3 s excluding KiCad UI delay
Plan Preview P95 < 30 s for medium project
Semantic Diff P95 < 20 s
```

大型执行：

```text
1,000 operations
```

要求：

- Operation Group；
- Batch where backend supports；
- Checkpoint；
- Progress；
- Backpressure；
- Cancel；
- Resume；
- 不在一个巨型 MCP Tool Call 中执行所有修改。

---

# 93. 可观测性

```text
kicad_environments_total{platform,status}
kicad_installations_total{version}
kicad_sessions_total{version,type,status}
kicad_mcp_providers_total{provider,status}
kicad_mcp_tools_total{provider,risk,allow}
kicad_tool_schema_drift_total{provider,type}
kicad_change_plans_total{status,risk}
kicad_executions_total{status,backend}
kicad_operation_duration_seconds{operation,backend}
kicad_operation_retries_total{operation,reason}
kicad_postcondition_failures_total{type}
kicad_unexpected_diffs_total{severity,type}
kicad_erc_regressions_total
kicad_drc_regressions_total
kicad_rollbacks_total{status}
kicad_manual_handoffs_total{status}
kicad_project_lock_wait_seconds
kicad_provider_timeouts_total{provider}
```

---

# 94. Dashboard

```text
Environment and KiCad Versions
Running Sessions
MCP Provider Health
Capability Matrix
Tool Schema Drift
Change Plans
Approval Queue
Execution Progress
Operation Failures
Postcondition Failures
Semantic Diff
ERC/DRC Regression
Rollback
Manual Handoffs
Artifacts
Audit
```

---

# 95. 安全与权限

- Agent 19 Worker 部署在本地或客户私有环境；
- KiCad IPC Token 只存 Secret Reference；
- MCP Server Executable/Package 固定 Hash；
- Write Tool 默认拒绝；
- Provider Tool Name 不由模型自由指定；
- Project 路径由 Project ID 映射；
- Workspace Root Allowlist；
- 阻止 `..`、Symlink Escape 和网络共享越界；
- Worker 不拥有不必要的主目录权限；
- 默认无公网；
- 下载 Library/3D Model 通过独立批准服务；
- 禁止任意 Shell；
- `kicad-cli` 参数从受控 Builder 生成，不拼接自由命令；
- STDOUT/STDERR 脱敏；
- MCP `stdout` 仅允许协议消息；
- HTTP MCP 绑定 Loopback 或受控私网；
- Streamable HTTP 做 Host/Origin/Auth 校验；
- Tool Call 和 Resource URI 审计；
- 工程和 Export Artifact 加密；
- Preview、Write、Release 分权；
- Critical Operation 支持双人审批；
- Agent 不可自己批准自己的 Plan；
- 不清除用户手工修改；
- 不覆盖未保存 GUI 状态；
- 不发送工程到外部 LLM；
- 不在公开 Fixture 使用真实客户工程；
- 不记录完整 IPC Token、API Key 或本地用户名；
- Rollback、Release 和 Artifact 下载均鉴权。

---

# 96. 推荐技术栈

核心编排：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
```

KiCad：

```text
kicad-python official IPC bindings
kicad-cli
Agent 16 parser/serializer
```

MCP：

```text
Official MCP Python SDK
stdio client
Streamable HTTP client
JSON Schema validation
```

Diff/数据：

```text
Polars
PyArrow
DuckDB
```

前端：

```text
React
TypeScript
Zustand
Monaco JSON Diff optional
Canvas/SVG schematic/PCB overlay
```

---

# 97. 推荐仓库结构

```text
kicad-mcp-execution-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── kicad-mcp-execution-agent-spec.md
│   ├── canonical-change-plan.md
│   ├── operation-registry.md
│   ├── capability-and-backend-selection.md
│   ├── mcp-provider-adapters.md
│   ├── official-ipc-adapter.md
│   ├── kicad-cli-adapter.md
│   ├── controlled-file-backend.md
│   ├── workspace-session-lock.md
│   ├── schematic-operations.md
│   ├── pcb-operations.md
│   ├── transactions-and-saga.md
│   ├── readback-and-postconditions.md
│   ├── semantic-diff-and-validation.md
│   ├── approval-and-risk.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-canonical-operations-not-provider-tools.md
│       ├── 0002-tool-success-is-not-design-success.md
│       ├── 0003-every-write-needs-readback.md
│       ├── 0004-workspace-first-production-branch-last.md
│       ├── 0005-provider-capabilities-are-versioned.md
│       ├── 0006-no-free-form-shell.md
│       └── 0007-agent16-is-the-structural-verifier.md
├── src/
│   └── kicad_execution/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── environment.py
│       │   ├── capability.py
│       │   ├── request.py
│       │   ├── plan.py
│       │   ├── operation.py
│       │   ├── workspace.py
│       │   ├── session.py
│       │   ├── execution.py
│       │   ├── validation.py
│       │   └── report.py
│       ├── discovery/
│       │   ├── kicad_installation.py
│       │   ├── cli.py
│       │   ├── ipc.py
│       │   ├── processes.py
│       │   └── platforms.py
│       ├── mcp/
│       │   ├── client.py
│       │   ├── stdio.py
│       │   ├── streamable_http.py
│       │   ├── admission.py
│       │   ├── discovery.py
│       │   ├── schema.py
│       │   ├── allowlist.py
│       │   └── drift.py
│       ├── providers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── seeed_adapter.py
│       │   ├── orchis_adapter.py
│       │   ├── circuit_synth_adapter.py
│       │   └── generic_readonly.py
│       ├── ipc/
│       │   ├── client.py
│       │   ├── sessions.py
│       │   ├── board.py
│       │   ├── commits.py
│       │   ├── readback.py
│       │   └── capabilities.py
│       ├── cli/
│       │   ├── builder.py
│       │   ├── version.py
│       │   ├── erc.py
│       │   ├── drc.py
│       │   ├── netlist.py
│       │   ├── exports.py
│       │   └── jobset.py
│       ├── controlled_file/
│       │   ├── adapter.py
│       │   ├── serializer.py
│       │   ├── patch_dsl.py
│       │   ├── atomic_write.py
│       │   └── roundtrip.py
│       ├── operations/
│       │   ├── registry.py
│       │   ├── validation.py
│       │   ├── mapping.py
│       │   ├── project.py
│       │   ├── schematic.py
│       │   ├── connectivity.py
│       │   ├── pcb.py
│       │   ├── routing.py
│       │   ├── rules.py
│       │   └── export.py
│       ├── planning/
│       │   ├── normalizer.py
│       │   ├── dependencies.py
│       │   ├── selectors.py
│       │   ├── risk.py
│       │   ├── capabilities.py
│       │   └── preview.py
│       ├── workspaces/
│       │   ├── manager.py
│       │   ├── snapshots.py
│       │   ├── git.py
│       │   ├── locks.py
│       │   └── cleanup.py
│       ├── execution/
│       │   ├── saga.py
│       │   ├── groups.py
│       │   ├── idempotency.py
│       │   ├── retry.py
│       │   ├── checkpoints.py
│       │   ├── compensation.py
│       │   └── manual_handoff.py
│       ├── readback/
│       │   ├── provider.py
│       │   ├── ipc.py
│       │   ├── agent16.py
│       │   ├── files.py
│       │   └── reconcile.py
│       ├── validation/
│       │   ├── preconditions.py
│       │   ├── postconditions.py
│       │   ├── semantic_diff.py
│       │   ├── erc_drc.py
│       │   ├── regressions.py
│       │   └── gates.py
│       ├── approvals/
│       ├── reports/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── operations/
├── policies/
├── provider-mappings/
├── adapter-contracts/
├── fixtures/
│   ├── kicad9/
│   └── kicad10/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── discover_kicad_environment.py
    ├── inspect_mcp_provider.py
    ├── probe_kicad_capabilities.py
    ├── validate_change_plan.py
    ├── preview_change_plan.py
    ├── execute_change_plan.py
    ├── verify_execution.py
    ├── rollback_execution.py
    ├── run_adapter_contracts.py
    └── run_kicad_execution_benchmark.py
```

---

# 98. 技术资料参考

实施前重新核验最新版本、Schema 和许可证：

```text
KiCad IPC API
https://dev-docs.kicad.org/en/apis-and-binding/ipc-api/

KiCad Add-on Developer IPC Documentation
https://dev-docs.kicad.org/en/apis-and-binding/ipc-api/for-addon-developers/

Official kicad-python Documentation
https://docs.kicad.org/kicad-python-main/

KiCad 10 Command-Line Interface
https://docs.kicad.org/10.0/en/cli/cli.html

Model Context Protocol Specification
https://modelcontextprotocol.io/specification/

Seeed KiCad MCP
https://github.com/Seeed-Studio/kicad-mcp-server

KiCAD-MCP-Server
https://github.com/mixelpixx/KiCAD-MCP-Server

Circuit Synth Schematic MCP
https://github.com/circuit-synth/mcp-kicad-sch-api
```


---

# 99. Codex 分阶段实施

不要让 Codex 一次实现所有社区 MCP、官方 IPC、原理图和 PCB 编辑、Saga、Review UI 与制造导出。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. `eehubio/circuit_canvas` 的真实目录结构；
2. Agent 16、17、18 的规格和实际完成程度；
3. 当前 KiCad Project/Schematic/PCB Parser；
4. 当前 `parseKicadSym`、`parseKicadMod`、KiCad Viewer 和 3D Viewer；
5. 当前 `registerSymbolOverride`、`registerFootprintOverride`、`ensureStepBytes`；
6. 当前 `/api/ds2kicad` 和工程生成代码；
7. 当前是否已有 KiCad MCP Client/Server；
8. 当前是否集成 Seeed、Orchis、Circuit Synth 或其他 KiCad MCP；
9. 当前 MCP SDK、协议版本和 Transport；
10. 当前 KiCad 9/10 安装、`kicad-cli` 和测试环境；
11. 当前 `kicad-python`、IPC Socket 和 Plugin；
12. 当前 Schematic 写入和 PCB 写入方式；
13. 当前工程创建、Sheet、Symbol、Wire、Label 和 Net 代码；
14. 当前 Footprint、Track、Via、Zone、Board Outline 和 Rule 代码；
15. 当前 Agent 16 Serializer 或 Patch DSL；
16. 当前 Agent 18 Reviewed Netlist 到 KiCad 的转换；
17. 当前 Agent 16 Reparse 和 Semantic Diff；
18. 当前 ERC、DRC、Netlist、Gerber、Drill、STEP 导出；
19. 当前 Git、Workspace、Snapshot 和 Branch；
20. 当前 Lock、Queue、Worker、Retry、Saga、Outbox 和 Idempotency；
21. 当前权限、审批和审计；
22. 当前本地 Worker、远程 Worker 和操作系统支持；
23. 当前 Fixture 和 KiCad 9/10 Golden Project；
24. 统计已支持操作、Backend、版本和失败模式；
25. 抽样运行只读环境探测；
26. 不调用写入 Tool；
27. 不修改业务代码；
28. 不创建 Migration；
29. 不安装依赖；
30. 不启动真实生产工程；
31. 不读取或打印 IPC Token、MCP Credential 或生产 Secret。

## Phase 1：Canonical Change Plan 和 JSON Schema

实现：

- Change Request；
- Change Plan；
- Operation；
- Dependency；
- Selector；
- Precondition；
- Postcondition；
- Risk；
- Approval；
- Rollback；
- Execution Result；
- JSON Schema；
- Versioning。

## Phase 2：Environment Discovery

实现：

- OS；
- KiCad Installations；
- KiCad Version；
- `kicad-cli`；
- Running Instances；
- Process/Socket；
- GUI/Headless；
- Environment Health；
- No Secret Logging。

## Phase 3：MCP Client Core

实现：

- Official MCP SDK；
- stdio；
- Streamable HTTP；
- Initialize；
- `tools/list`；
- `resources/list`；
- Tool Call；
- Timeout；
- Cancellation；
- Logging Rules；
- Transport Security。

## Phase 4：MCP Provider Admission 和 Registry

实现：

- Provider Identity；
- Package/Executable Hash；
- Version；
- Allowlist；
- Tool Snapshot；
- Schema Hash；
- Risk Annotation；
- Network Policy；
- Read-only Shadow；
- Disable/Enable。

## Phase 5：Capability Registry 和 Backend Selection

实现：

- Canonical Capability；
- Provider Mapping；
- Official IPC；
- CLI；
- Controlled File；
- Conditional/Unknown；
- KiCad Version Scope；
- Fallback；
- Explanation；
- Contract Requirement。

## Phase 6：Workspace、Snapshot、Git 和 Lock

实现：

- Ephemeral/Persistent Workspace；
- Project Copy；
- Git Branch；
- File Manifest；
- Agent 16 Baseline；
- ERC/DRC Baseline；
- Lock Lease；
- Heartbeat；
- Cleanup；
- Dirty Tree Detection。

## Phase 7：KiCad Session Manager

实现：

- Launch/Attach；
- Multi-instance；
- IPC Socket；
- Token Secret Reference；
- Active Project；
- Open Documents；
- Busy/Modal/User Interaction；
- Health；
- Close；
- Crash Recovery。

## Phase 8：Official IPC Read Adapter

实现：

- `kicad-python` Client；
- Open Board；
- Read Footprints；
- Read Tracks/Vias/Zones；
- Read Selection；
- Read Properties；
- Session Checks；
- KIID Mapping；
- Contract Tests。

## Phase 9：Official IPC PCB Write Adapter

实现：

- Commit；
- Place/Move/Rotate Footprint；
- Track；
- Via；
- Zone；
- Selection；
- Save/Readback；
- Drop/Rollback；
- Version Capability；
- Golden Tests。

## Phase 10：`kicad-cli` Adapter

实现：

- Safe Argument Builder；
- Version；
- ERC；
- DRC；
- Netlist；
- Schematic PDF/SVG；
- Gerber/Drill；
- Position；
- STEP；
- Jobset；
- JSON Report；
- Timeout；
- No Shell String Concatenation。

## Phase 11：Controlled File Backend Core

实现：

- Agent 16 Serializer Contract；
- AST-aware Patch；
- Path-based Operation；
- Preconditions；
- Atomic Write；
- Backup；
- Reparse；
- Round-trip Gate；
- File-open Conflict Detection。

## Phase 12：Project 和 Library Operations

实现：

- Create Project；
- Project Files；
- Local Symbol Library；
- Local Footprint Library；
- Library Tables；
- Approved Asset Import；
- Hash；
- KiCad 9/10 Format；
- Open/Reparse Verification。

## Phase 13：Schematic Symbol Operations

实现：

- Create Sheet；
- Place Symbol；
- Move/Rotate/Mirror；
- Set Fields；
- DNP/Exclude；
- Delete；
- Multi-unit；
- Reference Policy；
- Symbol Asset Validation；
- Readback。

## Phase 14：Schematic Connectivity Operations

实现：

- Place Wire；
- Connect Pins；
- Junction；
- Local/Global/Hierarchical Label；
- Power Symbol；
- No-connect；
- Bus/Entry；
- Sheet Pin；
- Net Rename；
- Pin-to-Net Postcondition；
- No Accidental Merge。

## Phase 15：Agent 18 Netlist Import

实现：

- Release-level Check；
- Part/Pin/Net Mapping；
- Layout Strategy；
- Sheet Partition；
- Label-based Long Connections；
- Unknown Pins；
- Unresolved Exclusion；
- Preview；
- Schematic Draft；
- Agent 16 Reparse。

## Phase 16：PCB Synchronization 和 Placement

实现：

- Update from Schematic；
- Netlist Dry Run；
- Added/Removed/Changed Footprints；
- Preserve Locks；
- Place/Move/Rotate/Flip；
- Groups；
- Padset Compatibility；
- Readback；
- DRC Baseline。

## Phase 17：PCB Routing Operations

实现：

- Track；
- Via；
- Layer；
- Width；
- Net；
- Endpoint；
- Differential Pair Hook；
- Candidate Route Preview；
- Readback Connectivity；
- DRC；
- No Autorouter Claim。

## Phase 18：Board、Zone、Keepout 和 Rules

实现：

- Board Outline；
- Cutout；
- Zone；
- Refill；
- Keepout；
- Rule Area；
- Net Class；
- Width/Clearance/Via；
- Stack-up Hook；
- High-risk Approval；
- Validation。

## Phase 19：Preconditions、Postconditions 和 Readback

实现：

- Selector Resolution；
- Base Revision；
- Object/Property；
- Pin-to-Net；
- Geometry；
- File Save；
- Provider Readback；
- IPC Readback；
- Agent 16 Readback；
- Reconciliation；
- `EXECUTION_UNVERIFIED`。

## Phase 20：Semantic Diff 和 Regression Gates

实现：

- Planned/Actual；
- Unexpected Change；
- Entity Diff；
- Pin-to-Net Diff；
- PCB Diff；
- Rule Diff；
- ERC Baseline/After；
- DRC Baseline/After；
- Gate；
- Report。

## Phase 21：Execution Saga、Checkpoint 和 Rollback

实现：

- Groups；
- Idempotency；
- Unknown Result Recovery；
- Retry；
- Checkpoint；
- IPC Commit；
- Undo；
- File Restore；
- Git Restore；
- Compensation；
- Rollback Verification。

## Phase 22：Approval 和 Manual Handoff

实现：

- Risk Policy；
- Plan Approval；
- Step Approval；
- Two-person；
- No Self Approval；
- Manual Instructions；
- Open/Highlight Target；
- Wait；
- Readback；
- Audit。

## Phase 23：High-level MCP Server for Codex

实现：

- `inspect_kicad_environment`；
- `inspect_kicad_project`；
- `create_kicad_change_plan`；
- `preview_kicad_change_plan`；
- `approve_kicad_change_plan`；
- `execute_kicad_change_plan`；
- `read_kicad_execution`；
- `validate_kicad_project`；
- `rollback_kicad_execution`；
- `export_kicad_artifacts`；
- Tool Annotations；
- Resources；
- Text-only Fallback。

## Phase 24：Review Frontend

实现：

- Plan；
- Capability；
- Operation Tree；
- Risk；
- Before/After；
- Schematic/PCB Overlay；
- ERC/DRC；
- Approval；
- Execution Progress；
- Pause/Cancel；
- Manual Handoff；
- Rollback。

## Phase 25：Downstream Contracts

实现：

- Agent 16 Reparse；
- Agent 18 Input；
- Agent 31/32 BOM；
- Agent 43 Release Requirement；
- Agent 44 Manufacturing Boundary；
- Agent 45 Design Baseline；
- Event Schema；
- Compatibility Tests。

## Phase 26：Security、Audit 和 Private Worker

实现：

- Tenant/Project；
- Secret Store；
- Tool Admission；
- Path Allowlist；
- No Shell；
- Egress；
- IPC Token；
- Signed Artifact；
- Immutable Audit；
- Retention；
- Remote Worker Registration。

## Phase 27：Benchmark、监控和生产发布

实现：

- KiCad 9/10 Matrix；
- Adapter Contracts；
- Golden Projects；
- Retry/Crash；
- Semantic Diff；
- ERC/DRC；
- Rollback；
- Load；
- Metrics；
- Dashboard；
- Feature Flags；
- Provider Rollback；
- Disaster Recovery。

## Phase 28：高级交互与未来 KiCad 版本，可选

稳定后：

- Future Schematic IPC；
- KiCad CLI API Server；
- Headless Editing where officially supported；
- Interactive Placement；
- Design Blocks；
- Multi-channel；
- Advanced Routing；
- Simulation；
- KiCad 11 Adapter；
- 仍保持 Capability Discovery。

---

# 100. Codex 工作纪律

Codex 必须：

1. Canonical Operation 与 Provider Tool 分开；
2. Tool Name 不进入上层业务契约；
3. Provider Capability 版本化；
4. Unknown 不当 Supported；
5. KiCad 9/10 分别验证；
6. Community MCP 不视为官方稳定 API；
7. MCP Server 必须 Admission；
8. Write Tool 默认 Deny；
9. Model 不指定任意 Provider Tool；
10. `tools/list` Snapshot 保存；
11. Tool Schema Drift 禁用危险写入；
12. MCP Credential 只存 Secret Reference；
13. IPC Token 不进日志；
14. 多 KiCad Instance 必须唯一选择；
15. Active Project 和 Document 明确；
16. 生产工程默认不直接写；
17. 每次执行建立 Workspace；
18. 每次写入前建立 Snapshot；
19. 同一项目默认单写者；
20. Unsaved User Changes 阻断；
21. Base Revision 必须匹配；
22. Selector 必须唯一；
23. 优先 UUID/KIID，不优先坐标；
24. Operation 有 Idempotency Key；
25. Retry 前必须 Readback；
26. Tool Timeout 不直接重试写；
27. Provider Success 不等于 Operation Success；
28. 每个写操作必须 Postcondition；
29. 写后必须保存确认；
30. Committed Write 必须 Agent 16 Reparse；
31. Pin-to-Net 修改必须结构验证；
32. Wire 几何存在不等于真正连接；
33. Label 靠近 Wire 不等于连接；
34. Symbol Property 修改要回读；
35. Duplicate RefDes 阻断；
36. Missing Library 不随意下载；
37. 自定义 Symbol/Footprint 必须有 Hash 和版本；
38. Agent 18 Candidate Netlist 不直接执行；
39. 只接受 Reviewed/Ready Netlist；
40. Unknown Pin 不强行连接；
41. Net Merge/Split 是高风险；
42. Power Domain 修改是高风险；
43. Footprint Padset 变化是高风险；
44. Board Outline 修改是高风险；
45. Rule/Stack-up 修改是高风险；
46. Track 必须验证 Net、端点、层和宽度；
47. Via 必须验证 Layer Pair；
48. Zone 必须 Refill 并验证；
49. Update PCB 不默认删除 PCB-only Footprint；
50. 锁定 Footprint 不自动移动；
51. IPC Commit 尽量形成一个 Undo Step；
52. 不支持 Transaction 时用 Snapshot；
53. Unexpected High-risk Diff 不提交；
54. New ERC Error 不自动提交；
55. New DRC Error 不自动提交；
56. Validation Failure 触发 Rollback 或人工处理；
57. Rollback 后必须验证恢复；
58. GUI Busy/Modal 时暂停；
59. 不使用像素 RPA 作为主路径；
60. Controlled File 必须 AST/IR-aware；
61. 不用 Regex 修改完整 KiCad 文件；
62. Atomic Write；
63. 不覆盖原始工程；
64. Release Manifest 不可变；
65. Export 与 Manufacturing Approval 分开；
66. AI 不可批准自己的 Plan；
67. AI 不可绕过风险等级；
68. AI 不可执行任意 Shell；
69. AI 不可清除 ERC/DRC Exclusion；
70. 不把私有工程发送给外部模型；
71. 公开测试只用开源、合成、脱敏或授权工程；
72. 不伪造能力、执行成功、测试或 Benchmark；
73. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Operation/Provider Mapping 变化；
    - 测试命令；
    - 真实结果；
    - Adapter Contract；
    - Idempotency；
    - Readback/Postcondition；
    - Semantic Diff；
    - ERC/DRC；
    - Rollback；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 101. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/kicad-mcp-execution-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第19个 Agent：

KiCad MCP Execution, Transaction & Verification Agent /
KiCad MCP 执行 Agent。

本 Agent 将：

- 用户指令；
- Agent 16 Canonical EDA IR；
- Agent 18 Reviewed Netlist；
- 其他设计 Agent 的结构化 Patch；

转换为 Canonical EDA Change Plan，并通过：

- 已审核的 KiCad MCP Server；
- KiCad 官方 IPC API / kicad-python；
- kicad-cli；
- Agent 16 受控 Serializer/Patch Backend；

创建或修改 KiCad 工程、原理图和 PCB。

本 Agent必须：

- 先发现能力；
- 先建立 Workspace、Lock 和 Snapshot；
- 先 Preview 和审批；
- 写后 Readback；
- 重新运行 Agent 16；
- 对比 Semantic Diff；
- 运行 ERC/DRC；
- 满足 Postcondition；
- 成功后 Commit；
- 失败时 Rollback。

MCP Tool 返回 success 不代表设计修改成功。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16、17、18 规格和实际代码；
3. docs/kicad-mcp-execution-agent-spec.md；
4. 当前 circuit_canvas 的 KiCad Viewer、Parser、Library 和 3D；
5. 当前 parseKicadSym、parseKicadMod；
6. 当前 registerSymbolOverride、registerFootprintOverride、ensureStepBytes；
7. 当前 /api/ds2kicad；
8. 当前 KiCad Project/Schematic/PCB 生成代码；
9. 当前 Agent 16 IR、Serializer、Diff 和 Source Map；
10. 当前 Agent 18 Reviewed Netlist；
11. 当前 MCP SDK、Client、Server 和 Provider；
12. 当前 KiCad 9/10、kicad-cli、kicad-python 和 IPC；
13. 当前 Symbol/Footprint/3D Asset；
14. 当前 ERC/DRC/Netlist/Gerber/Drill/STEP；
15. 当前 Git/Workspace/Snapshot/Lock；
16. 当前 Queue/Worker/Retry/Saga/Idempotency；
17. 当前 Approval/Permission/Audit；
18. 当前 Agent 31/32/43/44/45 Contracts；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Canonical Operation 与 Provider Tool 分开；
- Tool Name 不进业务契约；
- Capability 按 Provider/KiCad Version 版本化；
- Unknown 不当 Supported；
- Community MCP 不当官方 API；
- MCP Server 需 Admission；
- Write Tool 默认 Deny；
- Provider Tool 不由模型自由指定；
- Tool Schema Drift 禁用危险写入；
- Credential/IPC Token 只存 Secret Reference；
- 多实例唯一选择；
- Active Project/Document 明确；
- Workspace First；
- Snapshot Before Write；
- Single Writer；
- Unsaved User Change 阻断；
- Base Revision Match；
- Selector Unique；
- UUID/KIID 优先；
- 每个 Operation 有 Idempotency；
- Timeout 后 Readback；
- Provider Success != Operation Success；
- 每个 Write 有 Postcondition；
- Save 需确认；
- Commit 前 Agent 16 Reparse；
- Wire Geometry != Pin-to-Net；
- Label Proximity != Connection；
- Duplicate RefDes 阻断；
- Library Asset 有 Hash/Version；
- Agent 18 只接受 Reviewed/Ready；
- Unknown Pin 不连接；
- Net Merge/Split、Power、Padset、Outline、Rule、Stack-up 高风险；
- Track/Via/Zone 结构验证；
- Update PCB 不默认删除 PCB-only；
- Locked Footprint 不移动；
- Unexpected High-risk Diff 不提交；
- New ERC/DRC Error 不提交；
- Failure 可 Rollback 且验证；
- Busy/Modal 暂停；
- 不使用 GUI Pixel RPA 主路径；
- File Backend AST/IR-aware；
- 不用 Regex 修改完整文件；
- 不覆盖原始工程；
- AI 不自批、不绕过风险、不执行 Shell；
- 不把工程发给外部模型；
- 不用真实私有工程做公开 Fixture；
- 不伪造能力、成功、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不调用任何写入 Tool：

1. 侦察当前仓库；
2. 检查 Agent 16/17/18 实现；
3. 查找 KiCad Parser/Viewer/Library/3D；
4. 查找 ds2kicad 和工程生成；
5. 查找 MCP Client/Server/SDK；
6. 查找已配置 KiCad MCP Provider；
7. 查找 KiCad 9/10 和 kicad-cli；
8. 查找 kicad-python/IPC；
9. 查找 Schematic/PCB Write Backend；
10. 查找 Symbol/Wire/Label/Net 操作；
11. 查找 Footprint/Track/Via/Zone/Rule；
12. 查找 Agent 16 Serializer/Patch；
13. 查找 Agent 18 Import；
14. 查找 Readback/Postcondition；
15. 查找 Semantic Diff；
16. 查找 ERC/DRC/Export；
17. 查找 Workspace/Snapshot/Git/Lock；
18. 查找 Retry/Saga/Idempotency/Rollback；
19. 查找 Approval/Permission/Audit；
20. 统计真实 Capability Matrix；
21. 统计 Tool Schema、Version 和 Drift 风险；
22. 抽样运行只读 Environment/Provider Discovery；
23. 在 docs/kicad-execution-implementation-plan.md 中生成实施计划；
24. 在 docs/canonical-change-plan.md 中定义 Plan；
25. 在 docs/operation-registry.md 中定义 Operation；
26. 在 docs/capability-and-backend-selection.md 中定义能力；
27. 在 docs/mcp-provider-adapters.md 中定义 MCP；
28. 在 docs/official-ipc-adapter.md 中定义 IPC；
29. 在 docs/kicad-cli-adapter.md 中定义 CLI；
30. 在 docs/controlled-file-backend.md 中定义文件后端；
31. 在 docs/workspace-session-lock.md 中定义 Workspace；
32. 在 docs/schematic-operations.md 中定义原理图；
33. 在 docs/pcb-operations.md 中定义 PCB；
34. 在 docs/transactions-and-saga.md 中定义事务；
35. 在 docs/readback-and-postconditions.md 中定义回读；
36. 在 docs/semantic-diff-and-validation.md 中定义验证；
37. 在 docs/approval-and-risk.md 中定义审批；
38. 在 docs/security.md 中定义安全；
39. 在 docs/kicad-execution-migration-plan.md 中定义旧能力迁移；
40. 在 docs/kicad-execution-benchmark-plan.md 中定义 Benchmark；
41. 给出拟新增、拟修改和拟复用文件；
42. 给出 Phase 1 精确范围；
43. 不修改业务代码；
44. 不创建 Migration；
45. 不安装依赖；
46. 不启动写入 Session；
47. 不调用 Write Tool；
48. 不读取或打印 Secret；
49. 运行仓库已有 lint、type check、test、build 和 security scan；
50. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/18 Contracts；
- KiCad 9/10 Environment；
- MCP Provider Inventory；
- Tool/Capability Matrix；
- Canonical Change Plan；
- Operation Registry；
- Backend Selection；
- Workspace/Session/Lock；
- Schematic Operations；
- PCB Operations；
- IPC/CLI/File Backend；
- Readback/Postconditions；
- Semantic Diff；
- ERC/DRC；
- Saga/Idempotency/Rollback；
- Approval/Manual Handoff；
- Security；
- API/Events；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 102. 后续 Phase 提示词模板

```text
继续实现 KiCad MCP Execution Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–19 规格；
3. 阅读 KiCad Execution Implementation Plan；
4. 阅读 Plan、Operation、Capability、MCP、IPC、CLI、File Backend、Workspace、Saga、Validation、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Canonical Operation / Provider Tool Separation；
- Capability Versioning；
- Workspace/Snapshot/Lock；
- Selector Uniqueness；
- Idempotency；
- Write Readback；
- Postcondition；
- Agent 16 Reparse；
- Semantic Diff；
- ERC/DRC Regression Gate；
- Rollback Verification；
- MCP Allowlist；
- No Arbitrary Shell；
- 不公开真实工程和 Secret；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Contract/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. MCP/IPC/CLI contract test；
10. idempotency/retry test；
11. readback/postcondition test；
12. rollback test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Operation/Provider Mapping 变化；
- 测试命令和真实结果；
- Adapter Contract；
- Idempotency；
- Readback/Postcondition；
- Semantic Diff；
- ERC/DRC；
- Rollback；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 103. MVP 演示流程

1. 使用 KiCad 10 的受控测试环境；
2. 发现 KiCad 安装、`kicad-cli` 和 MCP Provider；
3. 保存 Provider Tool Snapshot；
4. 选择一个空白 Golden Project；
5. Agent 18提供一份已审核的小型 RC 电路 Netlist；
6. 创建 Change Request；
7. 生成 Canonical Change Plan；
8. 计划包含创建工程、放置 R1、C1、J1 和连接网络；
9. Capability Registry 选择 Schematic Backend；
10. 创建 Workspace 和 Git Branch；
11. 保存 Base File Hash 和 Agent 16 IR；
12. 运行 Preview；
13. 展示新增器件、网络和风险；
14. 用户批准；
15. 创建 Root Schematic；
16. 放置 R1；
17. MCP 第一次调用返回超时；
18. Agent 读取工程，确认 R1 已存在；
19. 标记 `recovered_success`，不重复放置；
20. 放置 C1 和 J1；
21. 设置 Value、Footprint 和 MPN；
22. 连接 J1.1 → R1.1；
23. 连接 R1.2 → C1.1；
24. 放置 GND 并连接 C1.2；
25. 回读 Pin-to-Net；
26. 运行 Agent 16 Reparse；
27. 验证 R1、C1、J1 和三个网络；
28. 运行 ERC；
29. 发现一个未连接 Pin Warning；
30. Plan Policy 允许 Warning 但不允许 Error；
31. 保存工程；
32. 关闭并重新解析；
33. Semantic Diff 与 Plan 对账；
34. Git Commit；
35. 创建第二个 Plan：建立两层 PCB；
36. 从 Schematic 更新 PCB；
37. 放置 Footprint；
38. 一个 Footprint 被标记 Locked，Agent 不移动；
39. 创建矩形 Board Outline；
40. 绘制一条 Track；
41. 回读发现 Track 属于错误 Net；
42. Postcondition 失败；
43. 执行 Rollback 到 PCB Checkpoint；
44. 验证错误 Track 不存在；
45. 修正 Plan 后重试；
46. Track 连接正确；
47. 添加 GND Zone 并 Refill；
48. 运行 DRC；
49. 无新增 Error；
50. Agent 16重新解析 PCB；
51. 生成 Schematic/PCB Semantic Diff；
52. 导出 Gerber、Drill、PDF 和 STEP 到非发布目录；
53. 生成 Execution Report；
54. 发布 `kicad.project-revision.ready`。

---

# 104. 生产上线顺序

第一阶段：

```text
Read-only Environment Discovery
MCP Provider Registry
Canonical Change Plan
Workspace/Snapshot/Lock
kicad-cli Validation
Agent 16 Readback
Controlled Schematic Draft
Preview + Manual Approval
```

第二阶段：

```text
Official IPC PCB Read/Write
Schematic Symbol/Property/Wire
Agent 18 Reviewed Netlist Import
Semantic Diff
ERC/DRC Gates
Idempotency/Rollback
```

第三阶段：

```text
PCB Routing/Zone/Rule
Multiple MCP Providers
Private Remote Worker
High-level MCP Server for Codex
Manufacturing Export Handoff
Future KiCad API
```

上线优先确保：

```text
改的是哪个工程和哪个版本
当前后端到底支持什么
每个对象是否唯一定位
工具返回成功后工程是否真的改变
失败后能否完整恢复
```

这个 Agent 真正的价值不是“会调用多少个 KiCad 工具”，而是让每一次自动修改都像一次可靠的软件变更：有计划、有 Diff、有测试、有审查，也有后悔药。
