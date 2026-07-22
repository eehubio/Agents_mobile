# PCB 自动布线 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：26  
> Agent 名称：PCB Constraint-Driven Automatic Routing & Candidate Optimization Agent  
> 中文名称：PCB 自动布线 Agent  
> 类型：优化算法型  
> 版本：V1.0  
>
> 定位：基于 Agent 16–25 输出的 PCB、Reviewed Netlist、Footprint/Pad、器件与接口配置、原理图审查、仿真结果、Canonical PCB Constraint IR 和 Legalized Placement IR，完成布线准备度检查、网络分类和优先级、层分配、通道规划、BGA/连接器逃线、差分对、高速/时钟、电源、模拟和普通网络的分阶段初步自动布线；通过协商拥塞、Rip-up and Reroute、局部搜索、长度/时延/Skew 调整和 Via 优化生成多个 Routing Candidate，输出 DRC、约束覆盖、未布通网络、拥塞、可制造性和可解释评分，并通过 Agent 19 在受控工程副本中写入。
>
> 上游：
> - Agent 16：Project IR、PCB IR、Footprint IR、Pad IR、Track/Via/Zone IR、Net IR、Board Geometry、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、网络连接置信度和 Release Level
> - Agent 20：Footprint、Padstack、Pin-Pad、Courtyard、库版本和实例一致性
> - Agent 21：Peripheral、Clock、Bus Speed、Memory、PWM、ADC 和 Firmware Configuration
> - Agent 22：电源、保护、晶振、模拟、高压和敏感网络 Finding
> - Agent 23：边沿、带宽、负载、稳定性、噪声、应力和关键节点仿真结果
> - Agent 24：Canonical PCB Constraint IR、Stack-up、Net/Component Class、Tuning Profile、阻抗、线宽、间距、长度、Delay、Skew、Via、Allowed Layers、Return Path、Keepout 和高压规则
> - Agent 25：Legalized Placement IR、Fixed Objects、Functional Blocks、Routing Corridors、Congestion Map、Escape Pressure 和 Pareto Candidate
> - Agent 19：KiCad MCP/CLI/IPC、Workspace、Change Plan、Readback、DRC 和 Rollback
> - PCB 工厂能力、Via 工艺、层叠、铜厚、阻抗能力和装配要求
>
> 下游：
> - Agent 19：写入 Track、Arc、Via、Tuning Pattern、Zone、Stitching Via、Teardrop 和 Lock Patch
> - Agent 23：使用候选走线长度、层、Via 和寄生参数进行再仿真
> - Agent 24：回算实际 Delay、Skew、阻抗几何、回流和约束覆盖
> - Agent 25：对拥塞失败区域进行局部重布局
> - Agent 43：NPI 布线冻结和制造资料发布
> - Agent 44：层数、HDI、Via、阻抗和制造报价
> - Agent 45：测试点、测试通道和可测试性
>
> 核心输出：
> - PCB Routing Input Snapshot
> - Routing Readiness Report
> - Existing Copper Preservation Plan
> - Routable Object and Obstacle Model
> - Net Priority and Criticality Plan
> - Layer Assignment Plan
> - Routing Topology Plan
> - Routing Corridor Plan
> - Escape Routing Plan
> - Differential Pair Routing Plan
> - Critical Net Routing Plan
> - Power Routing and Plane Candidate
> - Return-path and Stitching Plan
> - Route Graph IR
> - Routing Candidate Set
> - Routed Track/Via/Tuning Pattern IR
> - Length/Delay/Skew Result
> - Congestion and Overflow Result
> - DRC and Constraint Coverage Report
> - Unrouted/Partially Routed Net Report
> - Rip-up and Reroute Trace
> - Candidate Score and Pareto Set
> - Agent 19 Canonical Change Plan
> - Post-write Readback and Regression Report
>
> 重要边界：
> - “所有飞线消失”不是唯一目标；违反阻抗、回流、高压、Via、长度和制造规则的 100% 布通应被拒绝。
> - 本 Agent 生成初步或工程候选布线，不替代专业工程师最终 SI/PI、EMC、安全、热、制造和可靠性审核。
> - 不在 Agent 24 的 Stack-up、Tuning Profile 或阻抗几何未确定时擅自推导生产线宽。
> - 不把差分对拆成两条独立网络后分别最短路径布线。
> - 不将物理长度直接等同传播时延；多层、Via、封装和调长应使用 Agent 24 的 Delay Model。
> - 不为了布通而跨越参考平面分割、天线 Keepout、高压隔离区或机械禁布区。
> - 不把 Ground/Power Zone 自动视为有效回流路径，必须检查参考层连续性和跨层回流。
> - 不静默移动 Agent 25 已批准或锁定的器件；需要移动时生成 Placement Feedback，而不是直接修改。
> - 已有人工锁定走线、Via、Zone 和 Tuning Pattern 必须保留。
> - 自动删除既有人工铜对象默认禁止；Rip-up 仅作用于 Agent 生成对象或明确批准的可修改对象。
> - 不把 Router 返回成功码等同 DRC、约束或布线质量通过。
> - 不把外部 Autorouter 的 SES 直接导入生产分支；必须转换为 Canonical Routing IR 并验证。
> - AI 不生成精确 Track 坐标，不决定 Hard Constraint，也不直接写入 EDA。
> - 所有候选必须保存 Router、版本、Seed、配置、输入 Hash、运行时间和完整违反项。
> - 所有写入通过 Agent 19 的 Workspace、Snapshot、Preview、Approval、Readback 和 Rollback。
> - 不把私有 PCB、Stack-up、网络和制造约束发送给外部通用模型。

---

# 1. Agent 26 的系统位置

```text
Reviewed PCB + Constraint IR + Legalized Placement
                         ↓
Routing Readiness Gate
                         ↓
Obstacle / Pad / Existing Copper Model
                         ↓
Net Priority / Topology / Layer Assignment
                         ↓
Escape and Corridor Planning
                         ↓
Critical Staged Routing
                         ↓
Negotiated Congestion and Rip-up/Reroute
                         ↓
Length / Delay / Skew / Via Optimization
                         ↓
Cleanup / Return Path / Manufacturability
                         ↓
Multiple Routing Candidates
                         ↓
DRC / Coverage / Unrouted / Pareto Review
                         ↓
Agent 19 Controlled Write
                         ↓
Readback / DRC / Constraint / Simulation Regression
```

---

# 2. 工具体系定位

KiCad PCB Editor 提供遵守设计规则的交互式 Push-and-Shove Router、差分对布线、长度和差分 Skew 调整，以及基于 Stack-up 的 Tuning Profile；其定位主要是手动和引导式布线，而不是完整的批量自动布线引擎。

KiCad 可通过 Specctra DSN 导出板级布线问题，再导入外部 Autorouter 产生的 SES Session。Freerouting 提供 DSN/SES、CLI、Docker 和自动布线能力。因此 Agent 26 应采用：

```text
Canonical Routing IR
+ Internal Router Providers
+ KiCad Interactive/Tool Adapter
+ External DSN/SES Router Adapter
```

---

# 3. 设计原则

1. **约束优先于布通率**：Hard Constraint 失败时，候选不进入发布集合。
2. **分阶段布线**：逃线、差分、高速、电源、模拟和普通信号分开。
3. **全局规划先于详细布线**：先分配层和通道，再生成 Track。
4. **差分对是一个耦合对象**：共享路径、Via、层转换和 Skew 策略。
5. **已有人工铜默认保留**：除非明确授权，不做 Rip-up。
6. **多 Provider**：内部算法、Freerouting 和 KiCad Tool Adapter 可组合。
7. **独立验证**：不信任 Router 自己的“成功”结论。
8. **多候选 Pareto**：最高布通率、最少 Via、最佳关键网络和最佳制造性。
9. **可重放**：保存版本、Seed、参数、输入 Hash 和每轮 Rip-up。
10. **闭环反馈**：拥塞失败反馈 Agent 25，约束冲突反馈 Agent 24，关键寄生反馈 Agent 23。

---

# 4. Routing Readiness Gate

## Blocked

```text
Agent 18 Netlist Release 太低
Agent 20 Pad/Footprint Critical
Agent 24 Constraint IR 缺失
Agent 25 Placement 未合法化
Board Outline 无效
Stack-up 缺失
关键 Net Class/Tuning Profile 未发布
高压边界冲突
未解析 Padstack
```

## Candidate-only

```text
制造 Via 能力未冻结
外部 Router 规则映射部分支持
部分普通网络缺少优化偏好
```

## Release-capable

```text
Reviewed Netlist
Legalized Placement
Approved Stack-up
Approved Critical Constraints
Router-independent DRC available
```

---

# 5. Routing Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "project_revision": "sha",
  "agent16_pcb_ir_hash": "sha256",
  "agent18_release_hash": "sha256",
  "agent20_report_hash": "sha256",
  "agent24_constraint_hash": "sha256",
  "agent25_placement_hash": "sha256",
  "stackup_hash": "sha256",
  "existing_copper_hash": "sha256",
  "routing_policy_hash": "sha256"
}
```

---

# 6. Routable Board Model

保存：

```text
board boundary
cutouts
copper layers
plane layers
layer direction
track obstacles
via obstacles
pad obstacles
zone obstacles
rule areas
keepouts
locked copper
modifiable copper
routing corridors
tuning regions
```

---

# 7. Terminal 和 Pad Access

每个 Terminal 保存：

```text
pad id
net id
layer set
pad geometry
access points
preferred escape direction
allowed via
clearance envelope
component side
fanout status
```

支持：

```text
through-hole
SMD
BGA
QFN exposed pad
fine-pitch connector
castellated hole
edge connector
```

---

# 8. Existing Copper Ownership

```text
manual_locked
manual_preserve
manual_modifiable_with_approval
agent_generated_locked
agent_generated_modifiable
temporary
zone
```

默认 Rip-up 仅允许：

```text
agent_generated_modifiable
temporary
```

---

# 9. 网络分类与优先级

推荐字典序：

```text
Safety / Isolation
→ Fixed Topology / Critical Clock
→ Differential High-speed
→ Memory/Strobe
→ Power and High Current
→ Analog/Reference/Feedback
→ External Interfaces
→ Remaining Signals
→ Test/Low-priority
```

Criticality 维度：

```text
safety
timing
edge rate
impedance
current
analog sensitivity
external exposure
return path
topology rigidity
length/skew
simulation sensitivity
user priority
```

---

# 10. Routing Stage

```text
stage_0_preserve
stage_1_escape
stage_2_safety_and_isolation
stage_3_diff_clock_memory
stage_4_power_and_analog
stage_5_general
stage_6_negotiated_cleanup
stage_7_tuning
stage_8_return_path_and_manufacturing
```

---

# 11. Layer Assignment Plan

每个 Net/Chain 保存：

```text
allowed layers
preferred layers
forbidden layers
reference layer
preferred direction
transition count
via style
entry/exit layer
impedance profile
```

---

# 12. Global Routing

输出：

```text
coarse route corridors
layer demand
region capacity
net ordering
via transition regions
overflow
```

Global Router 不生成最终 Track 几何。

---

# 13. Detailed Routing

输入 Global Route 和局部几何，生成：

```text
segments
arcs optional
vias
layer transitions
tuning patterns
```

---

# 14. Multi-terminal Net

```text
terminal grouping
topology constraint
Steiner/tree candidate
branch ordering
detailed route
stub validation
```

不能默认所有多端网络使用最短 Steiner Tree。

---

# 15. 差分对布线

要求：

```text
coupled route
P/N polarity
width/gap profile
pair entry/exit
via symmetry
same layer transitions
intra-pair skew
maximum uncoupled length
return-path continuity
```

状态：

```text
unrouted
escape_routed
coupled_routed
partially_uncoupled
tuned
constraint_failed
review_required
```

---

# 16. 时钟和存储器网络

支持：

```text
point-to-point
source series terminated
fly-by
daisy chain
matched group
clock/strobe/data relation
```

Topology 由 Agent 24 输入，Router 不得自行更改。

---

# 17. 电源和高电流

处理：

```text
track
parallel track
plane/zone
neck-down
via array
current bottleneck
thermal connection
Kelvin sense separation
```

Zone 候选必须检查：

```text
island
minimum neck
thermal relief
source/consumer path
return path
refill result
```

---

# 18. 模拟、反馈与 RF

专用成本：

```text
short sensitive path
distance from aggressor
minimum layer transitions
continuous reference
guard candidate
no test stub
feedback separation
Kelvin pairing
controlled impedance
antenna keepout
```

---

# 19. Return Path

检查：

```text
reference plane continuity
split crossing
layer transition
return via availability
connector/chassis transition
diff/common-mode return
```

需要时生成 Stitching Via Candidate。

---

# 20. Routing Corridor

来源：

```text
Agent 25
Agent 24 Rule Area
Global Router
人工指定
```

状态：

```text
hard
preferred
avoid
tuning_only
escape_only
```

---

# 21. Routing Provider

```python
class RoutingProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_problem(self, problem) -> ValidationResult: ...
    async def route(self, problem, seed, time_budget) -> CandidateSet: ...
    async def resume(self, checkpoint) -> CandidateSet: ...
    async def explain(self, candidate) -> RouterTrace: ...
```

---

# 22. 算法组合

## Global

```text
grid capacity graph
multi-commodity approximation
negotiated congestion
layer assignment
```

## Detailed

```text
A*
Lee
Hadlock
visibility graph
pattern routing
line search
push-and-shove adapter
```

## Optimization

```text
rip-up and reroute
local search
simulated annealing for ordering
large-neighborhood search
multi-start
```

---

# 23. Negotiated Congestion

每轮更新：

```text
present congestion cost
historical congestion cost
net criticality
via cost
bend cost
layer cost
return-path cost
```

保存：

```text
overflow
unrouted nets
rip-up set
new paths
objective delta
```

---

# 24. Rip-up Policy

允许：

```text
低优先级 Agent 生成走线
导致拥塞的可修改走线
局部受影响区域
```

禁止：

```text
manual_locked
critical approved route
safety/isolation route
explicitly preserved zone
```

---

# 25. Tuning

类型：

```text
single track length
differential pair length
differential pair skew
time-domain chain delay
```

约束：

```text
allowed region
pitch
amplitude
minimum spacing
maximum density
maximum added delay
crosstalk proxy
```

---

# 26. Route Graph IR

```json
{
  "route_graph_version": "1.0.0",
  "net_id": "uuid",
  "terminals": [],
  "nodes": [],
  "edges": [],
  "vias": [],
  "topology": {},
  "measurements": {},
  "provenance": {}
}
```

---

# 27. Routing Candidate IR

```json
{
  "routing_candidate_version": "1.0.0",
  "project": {},
  "router": {},
  "routes": [],
  "zones": [],
  "stitching_vias": [],
  "tuning_patterns": [],
  "unrouted": [],
  "violations": [],
  "metrics": {},
  "provenance": {}
}
```

---

# 28. Candidate Metrics

```text
completion ratio
fully routed nets
partially routed nets
unrouted nets
total length
critical weighted length
total delay
via count
microvia count
layer transitions
bend count
diff-pair skew
matched-group skew
constraint violations
DRC violations
return-path violations
high-voltage violations
congestion overflow
manufacturing risk
```

---

# 29. Hard Gate 与评分

Hard Gate：

```text
connectivity
short/open
safety/high-voltage
locked copper preservation
hard keepout
minimum manufacturing rule
critical topology
approved diff-pair polarity
```

评分：

```text
completion
critical quality
signal-integrity proxy
via count
length/delay
congestion
return path
manufacturability
change from baseline
```

---

# 30. Pareto Candidate

至少输出：

```text
最高布通率
最少 Via
最佳关键网络
最佳可制造性
平衡方案
```

违反 Hard Gate 的候选不进入 Pareto 集。

---

# 31. Router-independent Verification

必须独立验证：

```text
Net connectivity
Short/Open
DRC
Constraint IR
Width/Gap
Allowed Layers
Via Styles
Length/Delay/Skew
Topology/Stub
Return Path
High Voltage
Existing Copper Preservation
```

---

# 32. 外部 Router Adapter

```text
Canonical Problem IR
→ DSN Export
→ Router Sandbox
→ SES Output
→ SES Parse
→ Canonical Routing Candidate IR
→ Independent Verification
```

保存映射损失：

```text
unsupported constraint
downgraded constraint
lost metadata
ambiguous layer/via
```

---

# 33. Agent 19 操作

```text
add_track_segment
add_track_arc
add_via
add_tuning_pattern
add_stitching_via
add_zone
update_zone
lock_track
lock_via
remove_agent_generated_track
remove_agent_generated_via
refill_zones
```

---

# 34. 写入前置条件

```text
project revision
routing candidate hash
placement IR hash
constraint IR hash
stackup hash
existing copper hash
router verification pass
no unresolved hard violation
```

---

# 35. 写入后置条件

```text
all generated objects read back
fixed/locked copper unchanged
net connectivity matches
track/via geometry matches
zone refill succeeds
DRC executes
Agent 16 reparse passes
Agent 20 geometry remains valid
Agent 24 constraints remain effective
Agent 23 critical simulations not invalidated or are queued
```

---

# 36. Release Gate

## Routing Draft

允许部分普通网络未布。

## Critical Routing Review

要求安全、高压、差分、时钟、Memory、电源和模拟关键网络完成，Hard Constraint 与 Return Path 通过。

## Routing Complete

要求：

```text
目标布通率满足项目 Profile
未布网络有批准列表
DRC Error = 0
Constraint Coverage 通过
Length/Delay/Skew 通过
Manufacturing Rule 通过
```

## NPI Freeze

要求人工批准、仿真/SI 回归完成、制造规则和 Routing Manifest 冻结。

---

# 37. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ BUILDING_ROUTING_MODEL
→ CLASSIFYING_NETS
→ PLANNING_LAYERS
→ PLANNING_CORRIDORS
→ ROUTING_ESCAPE
→ ROUTING_CRITICAL
→ ROUTING_POWER_ANALOG
→ ROUTING_GENERAL
→ NEGOTIATING_CONGESTION
→ TUNING_LENGTH_DELAY_SKEW
→ REPAIRING_RETURN_PATH
→ CLEANING_ROUTES
→ VERIFYING_CANDIDATES
→ RANKING_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_UNROUTED
COMPLETED_WITH_CANDIDATES
REVIEW_REQUIRED
INPUT_BLOCKED
NO_FEASIBLE_LAYER_ASSIGNMENT
NO_FEASIBLE_ESCAPE
NO_FEASIBLE_CRITICAL_ROUTE
CONGESTION_BLOCKED
TUNING_REGION_REQUIRED
ROUTER_CAPABILITY_BLOCKED
VERIFICATION_FAILED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 38. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_PCB_IR_NOT_FOUND
AGENT18_RELEASE_TOO_LOW
AGENT18_CONNECTIVITY_BLOCKED
AGENT20_PADSTACK_BLOCKED
AGENT24_CONSTRAINT_IR_MISSING
AGENT25_PLACEMENT_NOT_LEGAL
BOARD_OUTLINE_INVALID
STACKUP_MISSING
ROUTING_LAYER_MISSING
VIA_TECHNOLOGY_MISSING
TUNING_PROFILE_MISSING
EXISTING_COPPER_CONFLICT
LOCKED_COPPER_MODIFICATION_ATTEMPT
PAD_ACCESS_UNRESOLVED
NET_CLASSIFICATION_AMBIGUOUS
DIFFERENTIAL_PAIR_AMBIGUOUS
LAYER_ASSIGNMENT_CONFLICT
TOPOLOGY_CONFLICT
ROUTING_CORRIDOR_CONFLICT
NO_FEASIBLE_ESCAPE
BGA_ESCAPE_INFEASIBLE
DIFFERENTIAL_ROUTE_INFEASIBLE
CRITICAL_ROUTE_INFEASIBLE
POWER_ROUTE_INFEASIBLE
HIGH_VOLTAGE_ROUTE_INFEASIBLE
RETURN_PATH_UNRESOLVED
CONGESTION_THRESHOLD_EXCEEDED
UNROUTED_CRITICAL_NET
VIA_COUNT_EXCEEDED
STUB_LENGTH_EXCEEDED
LENGTH_CONSTRAINT_FAILED
DELAY_CONSTRAINT_FAILED
SKEW_CONSTRAINT_FAILED
TUNING_REGION_MISSING
ROUTER_NOT_FOUND
ROUTER_VERSION_UNAPPROVED
ROUTER_CAPABILITY_MISSING
ROUTER_TIMEOUT
ROUTER_CRASHED
DSN_EXPORT_FAILED
SES_IMPORT_FAILED
ROUTER_METADATA_LOSS
ROUTING_CANDIDATE_INVALID
CONNECTIVITY_VERIFICATION_FAILED
SHORT_DETECTED
OPEN_DETECTED
DRC_FAILED
CONSTRAINT_COVERAGE_FAILED
AGENT19_EXECUTION_FAILED
POST_WRITE_ROUTE_MISMATCH
POST_WRITE_LOCKED_COPPER_CHANGED
POST_WRITE_DRC_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR


---

# 39. 数据库设计

## 39.1 `pcb_routing_jobs`

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
routing_profile VARCHAR NOT NULL
routing_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
selected_candidate_id UUID NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 39.2 `pcb_routing_input_snapshots`

```text
id UUID PK
routing_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_pcb_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent21_ir_hash CHAR(64) NULL
agent22_review_hash CHAR(64) NULL
agent23_result_hash CHAR(64) NULL
agent24_constraint_hash CHAR(64) NOT NULL
agent25_placement_hash CHAR(64) NOT NULL
stackup_hash CHAR(64) NOT NULL
existing_copper_hash CHAR(64) NOT NULL
routing_policy_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, snapshot_hash)
```

## 39.3 `pcb_router_registry_entries`

```text
id UUID PK
tenant_id UUID NULL
router_name VARCHAR NOT NULL
router_version VARCHAR NOT NULL
provider_type VARCHAR NOT NULL
platform VARCHAR NOT NULL
artifact_reference TEXT NULL
artifact_hash CHAR(64) NULL
license_status VARCHAR NOT NULL
capabilities JSONB NOT NULL
supported_formats JSONB NOT NULL
supported_constraints JSONB NOT NULL
resource_profile JSONB NOT NULL
deterministic_seed BOOLEAN NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
last_health_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(router_name, router_version, platform)
```

## 39.4 `pcb_router_capability_tests`

```text
id UUID PK
router_registry_entry_id UUID NOT NULL
capability_key VARCHAR NOT NULL
capability_status VARCHAR NOT NULL
fixture_reference JSONB NOT NULL
test_result JSONB NOT NULL
evidence_uri TEXT NOT NULL
verified_at TIMESTAMPTZ NOT NULL
created_at TIMESTAMPTZ
UNIQUE(router_registry_entry_id, capability_key)
```

## 39.5 `pcb_routing_board_models`

```text
id UUID PK
routing_job_id UUID NOT NULL
model_version VARCHAR NOT NULL
boundary_hash CHAR(64) NOT NULL
layer_count INT NOT NULL
terminal_count INT NOT NULL
net_count INT NOT NULL
obstacle_count INT NOT NULL
existing_track_count INT NOT NULL
existing_via_count INT NOT NULL
model_uri TEXT NOT NULL
model_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, model_version)
```

## 39.6 `pcb_routing_terminals`

```text
id UUID PK
board_model_id UUID NOT NULL
terminal_key VARCHAR NOT NULL
pad_id UUID NOT NULL
net_id UUID NOT NULL
layer_scope JSONB NOT NULL
geometry JSONB NOT NULL
access_points JSONB NOT NULL
preferred_escape JSONB NULL
allowed_vias JSONB NOT NULL
clearance_envelope JSONB NOT NULL
fanout_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(board_model_id, terminal_key)
```

## 39.7 `pcb_routing_obstacles`

```text
id UUID PK
board_model_id UUID NOT NULL
obstacle_type VARCHAR NOT NULL
source_entity JSONB NOT NULL
geometry JSONB NOT NULL
layer_scope JSONB NOT NULL
hard_or_soft VARCHAR NOT NULL
cost_multiplier NUMERIC NULL
modifiable BOOLEAN NOT NULL
created_at TIMESTAMPTZ
```

## 39.8 `pcb_existing_copper_objects`

```text
id UUID PK
routing_job_id UUID NOT NULL
source_entity_id UUID NOT NULL
copper_type VARCHAR NOT NULL
net_id UUID NULL
ownership_status VARCHAR NOT NULL
lock_status VARCHAR NOT NULL
modifiable_policy VARCHAR NOT NULL
geometry_hash CHAR(64) NOT NULL
source_reference JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 39.9 `pcb_routing_net_profiles`

```text
id UUID PK
routing_job_id UUID NOT NULL
net_id UUID NOT NULL
net_role VARCHAR NOT NULL
criticality_dimensions JSONB NOT NULL
priority_rank INT NOT NULL
routing_stage VARCHAR NOT NULL
topology_requirement JSONB NOT NULL
layer_assignment JSONB NOT NULL
geometry_profile JSONB NOT NULL
via_profile JSONB NOT NULL
length_delay_skew JSONB NOT NULL
return_path_requirement JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, net_id)
```

## 39.10 `pcb_routing_diff_pair_profiles`

```text
id UUID PK
routing_job_id UUID NOT NULL
pair_key VARCHAR NOT NULL
positive_net_id UUID NOT NULL
negative_net_id UUID NOT NULL
width_gap_profile JSONB NOT NULL
layer_assignment JSONB NOT NULL
via_symmetry JSONB NOT NULL
maximum_uncoupled JSONB NULL
skew_requirement JSONB NOT NULL
entry_exit_requirement JSONB NOT NULL
return_path_requirement JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, pair_key)
```

## 39.11 `pcb_routing_group_profiles`

```text
id UUID PK
routing_job_id UUID NOT NULL
group_key VARCHAR NOT NULL
group_type VARCHAR NOT NULL
member_net_ids JSONB NOT NULL
topology JSONB NOT NULL
reference_member JSONB NULL
matching_requirement JSONB NOT NULL
routing_order JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, group_key)
```

## 39.12 `pcb_layer_assignment_plans`

```text
id UUID PK
routing_job_id UUID NOT NULL
plan_version INT NOT NULL
net_assignments JSONB NOT NULL
pair_assignments JSONB NOT NULL
group_assignments JSONB NOT NULL
layer_demand JSONB NOT NULL
via_transition_regions JSONB NOT NULL
conflicts JSONB NOT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, plan_version)
```

## 39.13 `pcb_routing_corridor_plans`

```text
id UUID PK
routing_job_id UUID NOT NULL
corridor_key VARCHAR NOT NULL
corridor_type VARCHAR NOT NULL
geometry JSONB NOT NULL
layer_scope JSONB NOT NULL
net_scope JSONB NOT NULL
capacity JSONB NOT NULL
hard_or_soft VARCHAR NOT NULL
source_reference JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, corridor_key)
```

## 39.14 `pcb_escape_routing_plans`

```text
id UUID PK
routing_job_id UUID NOT NULL
component_id UUID NOT NULL
component_type VARCHAR NOT NULL
escape_strategy VARCHAR NOT NULL
pad_access_plan JSONB NOT NULL
fanout_plan JSONB NOT NULL
via_plan JSONB NOT NULL
layer_targets JSONB NOT NULL
conflicts JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 39.15 `pcb_routing_run_plans`

```text
id UUID PK
routing_job_id UUID NOT NULL
run_plan_version INT NOT NULL
router_registry_entry_id UUID NOT NULL
routing_stages JSONB NOT NULL
selected_net_scope JSONB NOT NULL
seed BIGINT NOT NULL
time_budget_ms BIGINT NOT NULL
resource_policy JSONB NOT NULL
routing_parameters JSONB NOT NULL
fallback_policy JSONB NOT NULL
run_plan_uri TEXT NOT NULL
run_plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, run_plan_version)
```

## 39.16 `pcb_routing_runs`

```text
id UUID PK
routing_job_id UUID NOT NULL
run_plan_id UUID NOT NULL
router_registry_entry_id UUID NOT NULL
run_attempt INT NOT NULL
stage VARCHAR NOT NULL
seed BIGINT NOT NULL
status VARCHAR NOT NULL
checkpoint_uri TEXT NULL
stdout_uri TEXT NULL
stderr_uri TEXT NULL
router_input_uri TEXT NOT NULL
router_output_uri TEXT NULL
runtime_ms BIGINT NULL
peak_memory_bytes BIGINT NULL
exit_code INT NULL
error_code VARCHAR NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(run_plan_id, stage, run_attempt)
```

## 39.17 `pcb_ripup_reroute_iterations`

```text
id UUID PK
routing_run_id UUID NOT NULL
iteration_number INT NOT NULL
overflow_before JSONB NOT NULL
ripup_route_ids JSONB NOT NULL
rerouted_net_ids JSONB NOT NULL
present_cost JSONB NOT NULL
historical_cost JSONB NOT NULL
overflow_after JSONB NOT NULL
objective_delta JSONB NOT NULL
checkpoint_uri TEXT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_run_id, iteration_number)
```

## 39.18 `pcb_routing_candidates`

```text
id UUID PK
routing_job_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
run_plan_id UUID NOT NULL
router_name VARCHAR NOT NULL
router_version VARCHAR NOT NULL
seed BIGINT NOT NULL
candidate_uri TEXT NOT NULL
candidate_hash CHAR(64) NOT NULL
completion_ratio NUMERIC(7,6) NOT NULL
fully_routed_net_count INT NOT NULL
partially_routed_net_count INT NOT NULL
unrouted_net_count INT NOT NULL
hard_violation_count INT NOT NULL
verification_status VARCHAR NOT NULL
pareto_rank INT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, candidate_key)
```

## 39.19 `pcb_route_graphs`

```text
id UUID PK
routing_candidate_id UUID NOT NULL
net_id UUID NOT NULL
route_status VARCHAR NOT NULL
topology JSONB NOT NULL
terminal_mapping JSONB NOT NULL
route_graph_uri TEXT NOT NULL
route_graph_hash CHAR(64) NOT NULL
length_metrics JSONB NOT NULL
delay_metrics JSONB NOT NULL
via_metrics JSONB NOT NULL
constraint_status JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_candidate_id, net_id)
```

## 39.20 `pcb_routed_segments`

```text
id UUID PK
route_graph_id UUID NOT NULL
segment_key VARCHAR NOT NULL
segment_type VARCHAR NOT NULL
layer_name VARCHAR NOT NULL
start_point JSONB NOT NULL
end_point JSONB NOT NULL
width JSONB NOT NULL
geometry JSONB NOT NULL
ownership_status VARCHAR NOT NULL
source_stage VARCHAR NOT NULL
source_trace JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(route_graph_id, segment_key)
```

## 39.21 `pcb_routed_vias`

```text
id UUID PK
route_graph_id UUID NOT NULL
via_key VARCHAR NOT NULL
via_type VARCHAR NOT NULL
position JSONB NOT NULL
start_layer VARCHAR NOT NULL
end_layer VARCHAR NOT NULL
diameter JSONB NOT NULL
drill JSONB NOT NULL
padstack_reference JSONB NOT NULL
return_via_group VARCHAR NULL
source_trace JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(route_graph_id, via_key)
```

## 39.22 `pcb_tuning_patterns`

```text
id UUID PK
route_graph_id UUID NOT NULL
tuning_key VARCHAR NOT NULL
tuning_type VARCHAR NOT NULL
geometry JSONB NOT NULL
layer_name VARCHAR NOT NULL
target_metric JSONB NOT NULL
achieved_metric JSONB NOT NULL
pattern_parameters JSONB NOT NULL
tuning_region_id UUID NULL
constraint_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(route_graph_id, tuning_key)
```

## 39.23 `pcb_routing_unrouted_items`

```text
id UUID PK
routing_candidate_id UUID NOT NULL
net_id UUID NOT NULL
terminal_scope JSONB NOT NULL
unrouted_type VARCHAR NOT NULL
blocking_reason VARCHAR NOT NULL
conflicting_constraints JSONB NOT NULL
recommended_actions JSONB NOT NULL
critical BOOLEAN NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 39.24 `pcb_routing_verification_runs`

```text
id UUID PK
routing_candidate_id UUID NOT NULL
verifier_version VARCHAR NOT NULL
connectivity_status VARCHAR NOT NULL
short_open_status VARCHAR NOT NULL
drc_status VARCHAR NOT NULL
constraint_status VARCHAR NOT NULL
length_delay_status VARCHAR NOT NULL
return_path_status VARCHAR NOT NULL
existing_copper_status VARCHAR NOT NULL
finding_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 39.25 `pcb_routing_candidate_scores`

```text
id UUID PK
routing_candidate_id UUID NOT NULL
hard_gate_status VARCHAR NOT NULL
completion_score NUMERIC NULL
critical_quality_score NUMERIC NULL
signal_integrity_proxy_score NUMERIC NULL
via_score NUMERIC NULL
length_delay_score NUMERIC NULL
congestion_score NUMERIC NULL
return_path_score NUMERIC NULL
manufacturing_score NUMERIC NULL
baseline_change_score NUMERIC NULL
objective_vector JSONB NOT NULL
pareto_rank INT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_candidate_id)
```

## 39.26 `pcb_external_router_exchange_artifacts`

```text
id UUID PK
routing_run_id UUID NOT NULL
exchange_format VARCHAR NOT NULL
input_uri TEXT NOT NULL
input_hash CHAR(64) NOT NULL
output_uri TEXT NULL
output_hash CHAR(64) NULL
mapping_manifest_uri TEXT NOT NULL
mapping_loss JSONB NOT NULL
parse_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 39.27 `pcb_routing_feedback_items`

```text
id UUID PK
routing_job_id UUID NOT NULL
target_agent VARCHAR NOT NULL
feedback_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
summary TEXT NOT NULL
evidence JSONB NOT NULL
blocking BOOLEAN NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 39.28 `pcb_routing_ir_versions`

```text
id UUID PK
routing_job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
selected_candidate_id UUID NULL
route_count INT NOT NULL
segment_count INT NOT NULL
via_count INT NOT NULL
tuning_pattern_count INT NOT NULL
unrouted_count INT NOT NULL
routing_ir_uri TEXT NOT NULL
routing_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, ir_version)
```

## 39.29 `pcb_routing_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
routing_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
plan_version INT NOT NULL
selected_candidate_id UUID NOT NULL
operation_count INT NOT NULL
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
UNIQUE(routing_job_id, plan_version)
```

## 39.30 `pcb_routing_post_write_runs`

```text
id UUID PK
change_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
pre_routing_job_id UUID NOT NULL
post_routing_job_id UUID NULL
route_readback_summary JSONB NOT NULL
locked_copper_regression JSONB NOT NULL
connectivity_summary JSONB NOT NULL
constraint_coverage_summary JSONB NOT NULL
drc_summary JSONB NOT NULL
simulation_impact_summary JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 39.31 `pcb_routing_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
routing_ir_hash CHAR(64) NOT NULL
selected_candidate_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision)
```

## 39.32 `pcb_routing_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
routing_job_id UUID NULL
routing_candidate_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
evidence_ids JSONB NOT NULL
effective_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 39.33 `pcb_routing_release_gate_runs`

```text
id UUID PK
routing_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
completion_ratio NUMERIC(7,6) NOT NULL
unrouted_critical_count INT NOT NULL
hard_violation_count INT NOT NULL
drc_error_count INT NOT NULL
constraint_failure_count INT NOT NULL
return_path_failure_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 39.34 `pcb_routing_reports`

```text
id UUID PK
routing_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
input_quality_status VARCHAR NOT NULL
candidate_count INT NOT NULL
selected_candidate_id UUID NULL
completion_ratio NUMERIC(7,6) NULL
constraint_coverage NUMERIC NULL
drc_status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(routing_job_id, report_version)
```

---

# 40. 对象存储

```text
derived/pcb-routing/
  {tenant_id}/{project_id}/
    jobs/
      {routing_job_id}/
        input/
          input-snapshot.json
          board-model.json
          constraint-manifest.json
          placement-manifest.json
          existing-copper.json
          routing-policy.json
        context/
          terminals.jsonl.zst
          obstacles.jsonl.zst
          net-profiles.jsonl.zst
          diff-pairs.jsonl.zst
          groups.jsonl.zst
          layer-plan.json
          corridors.jsonl.zst
          escape-plans.jsonl.zst
        runs/
          {run_plan_id}/
            plan.json
            router-input/
            router-output/
            checkpoints/
            logs/
            ripup-reroute/
        candidates/
          {candidate_id}/
            routing-ir.json
            route-graphs/
            segments.parquet
            vias.parquet
            tuning-patterns.jsonl.zst
            zones.jsonl.zst
            unrouted.jsonl.zst
            verification/
            scores/
        exchange/
          dsn/
          ses/
          mapping-manifests/
        feedback/
          agent23.jsonl.zst
          agent24.jsonl.zst
          agent25.jsonl.zst
        changes/
          agent19-plan.json
          preview/
          execution/
        validation/
          readback/
          connectivity/
          drc/
          constraints/
          return-path/
          simulation/
        reports/
          routing-report.html
          routing-report.pdf
          candidate-comparison.csv
          unrouted-nets.csv
          via-summary.csv
          length-delay-skew.csv
          constraint-coverage.csv
          release-gate.json
        debug/
          router-trace.jsonl.zst
          congestion-trace.jsonl.zst
          verification-trace.jsonl.zst
          resource-usage.json
```

---

# 41. API 设计

## 41.1 Jobs

```text
POST /api/v1/pcb-routing/jobs
POST /api/v1/pcb-routing/jobs/batch
GET  /api/v1/pcb-routing/jobs/{id}
GET  /api/v1/pcb-routing/jobs/{id}/events
POST /api/v1/pcb-routing/jobs/{id}/cancel
POST /api/v1/pcb-routing/jobs/{id}/retry
POST /api/v1/pcb-routing/jobs/{id}/rerun
```

## 41.2 Readiness and Context

```text
POST /api/v1/pcb-routing/jobs/{id}/validate-readiness
GET  /api/v1/pcb-routing/jobs/{id}/readiness
POST /api/v1/pcb-routing/jobs/{id}/build-board-model
GET  /api/v1/pcb-routing/jobs/{id}/board-model
GET  /api/v1/pcb-routing/jobs/{id}/net-profiles
GET  /api/v1/pcb-routing/jobs/{id}/diff-pairs
GET  /api/v1/pcb-routing/jobs/{id}/existing-copper
```

## 41.3 Plans

```text
POST /api/v1/pcb-routing/jobs/{id}/plan-layers
GET  /api/v1/pcb-routing/jobs/{id}/layer-plan
POST /api/v1/pcb-routing/jobs/{id}/plan-corridors
GET  /api/v1/pcb-routing/jobs/{id}/corridors
POST /api/v1/pcb-routing/jobs/{id}/plan-escape
GET  /api/v1/pcb-routing/jobs/{id}/escape-plans
```

## 41.4 Routers

```text
GET  /api/v1/pcb-routing/routers
GET  /api/v1/pcb-routing/routers/{id}
POST /api/v1/pcb-routing/routers/{id}/health
POST /api/v1/pcb-routing/routers/{id}/contract-test
POST /api/v1/pcb-routing/jobs/{id}/run-plan
GET  /api/v1/pcb-routing/run-plans/{id}
```

## 41.5 Routing

```text
POST /api/v1/pcb-routing/run-plans/{id}/run
GET  /api/v1/pcb-routing/runs/{id}
GET  /api/v1/pcb-routing/runs/{id}/logs
POST /api/v1/pcb-routing/runs/{id}/resume
POST /api/v1/pcb-routing/jobs/{id}/reroute-selected
POST /api/v1/pcb-routing/jobs/{id}/reroute-failed
```

## 41.6 Candidates

```text
GET  /api/v1/pcb-routing/jobs/{id}/candidates
GET  /api/v1/pcb-routing/candidates/{id}
GET  /api/v1/pcb-routing/candidates/{id}/routes
GET  /api/v1/pcb-routing/candidates/{id}/unrouted
GET  /api/v1/pcb-routing/candidates/{id}/metrics
POST /api/v1/pcb-routing/candidates/{id}/verify
POST /api/v1/pcb-routing/jobs/{id}/rank-pareto
POST /api/v1/pcb-routing/jobs/{id}/select-candidate
```

## 41.7 Review Operations

```text
POST /api/v1/pcb-routing/candidates/{id}/lock-routes
POST /api/v1/pcb-routing/candidates/{id}/change-layer-preference
POST /api/v1/pcb-routing/candidates/{id}/change-corridor
POST /api/v1/pcb-routing/candidates/{id}/request-placement-feedback
POST /api/v1/pcb-routing/candidates/{id}/request-constraint-feedback
```

## 41.8 External Router Exchange

```text
POST /api/v1/pcb-routing/jobs/{id}/export-dsn
POST /api/v1/pcb-routing/jobs/{id}/import-ses
GET  /api/v1/pcb-routing/exchange/{id}/mapping-loss
```

## 41.9 Agent 19

```text
POST /api/v1/pcb-routing/jobs/{id}/change-plan
GET  /api/v1/pcb-routing/change-plans/{id}
POST /api/v1/pcb-routing/change-plans/{id}/preview
POST /api/v1/pcb-routing/change-plans/{id}/approve
POST /api/v1/pcb-routing/change-plans/{id}/submit-to-agent19
GET  /api/v1/pcb-routing/post-write-runs/{id}
```

## 41.10 Baseline and Reports

```text
POST /api/v1/pcb-routing/jobs/{id}/baseline
POST /api/v1/pcb-routing/jobs/{id}/compare-baseline
POST /api/v1/pcb-routing/jobs/{id}/run-release-gate
GET  /api/v1/pcb-routing/jobs/{id}/release-gate
GET  /api/v1/pcb-routing/jobs/{id}/report
GET  /api/v1/pcb-routing/jobs/{id}/candidate-comparison.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 42. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.configuration.ready
schematic-review.completed
simulation.completed
pcb-constraints.constraint-ir-ready
pcb-placement.completed
kicad.project-revision.ready
pcb-routing.requested
```

## 输出事件

```text
pcb-routing.input-blocked
pcb-routing.layer-plan-ready
pcb-routing.escape-blocked
pcb-routing.progress
pcb-routing.candidates-ready
pcb-routing.unrouted-critical-net
pcb-routing.congestion-blocked
pcb-routing.verification-failed
pcb-routing.feedback-to-placement
pcb-routing.feedback-to-constraints
pcb-routing.change-plan-ready
pcb-routing.post-write-validated
pcb-routing.release-gate-blocked
pcb-routing.completed
pcb-routing.completed-with-unrouted
pcb-routing.failed
```

---

# 43. Policy 组织

```text
policies/
├── pcb-routing-1.0.0.yaml
├── input-gates.yaml
├── ownership/
│   ├── existing-copper.yaml
│   └── ripup-policy.yaml
├── classification/
│   ├── net-roles.yaml
│   ├── criticality.yaml
│   └── stage-order.yaml
├── layers/
│   ├── assignment.yaml
│   ├── preferred-direction.yaml
│   ├── transitions.yaml
│   └── vias.yaml
├── escape/
│   ├── bga.yaml
│   ├── qfn.yaml
│   ├── connectors.yaml
│   └── fine-pitch.yaml
├── critical/
│   ├── differential.yaml
│   ├── clocks.yaml
│   ├── memory.yaml
│   ├── power.yaml
│   ├── analog.yaml
│   ├── rf.yaml
│   └── high-voltage.yaml
├── global-routing/
│   ├── capacity.yaml
│   └── congestion.yaml
├── detailed-routing/
│   ├── geometry.yaml
│   ├── bends.yaml
│   ├── via-cost.yaml
│   └── return-path.yaml
├── tuning/
│   ├── length.yaml
│   ├── delay.yaml
│   ├── skew.yaml
│   └── patterns.yaml
├── cleanup/
│   ├── teardrops.yaml
│   ├── tiny-segments.yaml
│   └── manufacturing.yaml
├── verification.yaml
├── agent19.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 44. 可观测性

```text
pcb_routing_jobs_total{status,profile}
pcb_routing_duration_seconds{step}
pcb_routing_router_runs_total{router,status}
pcb_routing_router_duration_seconds{router,stage}
pcb_routing_completion_ratio
pcb_routing_unrouted_nets_total{criticality}
pcb_routing_vias_total{type}
pcb_routing_congestion_overflow_total
pcb_routing_ripup_iterations_total
pcb_routing_constraint_failures_total{type}
pcb_routing_drc_errors_total{type}
pcb_routing_return_path_failures_total
pcb_routing_post_write_runs_total{status}
pcb_routing_release_gate_blocks_total{reason}
```

---

# 45. Dashboard

```text
Routing Jobs
Input Readiness
Net Priority
Layer Demand
Escape Status
Critical Routing
General Routing
Congestion
Rip-up/Reroute
Completion
Unrouted Nets
Via Count
Length/Delay/Skew
Return Path
Constraint Coverage
DRC
Candidate Comparison
Release Readiness
```

---

# 46. 安全与权限

- PCB、Stack-up、网络、走线候选和报告按租户/项目隔离；
- Router、Parser 和 Serializer 需要版本、Hash、License 和批准状态；
- 外部 Router 在隔离容器运行，默认无公网；
- 限制 CPU、内存、磁盘、线程、运行时间和文件数；
- DSN/SES、工程和压缩包不能触发任意脚本；
- 路径限制在 Workspace；
- 禁止自由 Shell；
- Router Command 由类型化 Builder 生成；
- 不接受 AI 原始坐标写入；
- Existing Copper Ownership 不可被 Router 结果覆盖；
- Agent 19 写入和 Routing 审批权限分开；
- 删除人工铜、修改 Zone、高压和 Stack-up 支持双人审批；
- 不发送私有 PCB 给外部模型或云 Autorouter；
- 公开 Fixture 仅使用开源、合成、脱敏或授权工程；
- Baseline、Manifest、Waiver、Verification 和 Release Gate 不可硬删除；
- 日志脱敏本机路径、网络名和 Secret。

---

# 47. 推荐技术栈

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

几何和算法：

```text
Shapely or equivalent robust geometry
NumPy
SciPy
custom grid/visibility graph
OR-Tools optional
C++/Rust routing core optional
```

外部：

```text
Freerouting CLI/Docker Adapter
KiCad DSN/SES Adapter
KiCad PCB parser/serializer
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
Canvas/WebGL
Layer Viewer
Congestion Heatmap
Route Diff
Candidate Comparison
```

---

# 48. 推荐仓库结构

```text
pcb-routing-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── pcb-routing-agent-spec.md
│   ├── input-and-routing-gates.md
│   ├── routing-problem-ir.md
│   ├── existing-copper-ownership.md
│   ├── net-classification-and-priority.md
│   ├── layer-assignment.md
│   ├── global-routing.md
│   ├── escape-routing.md
│   ├── differential-routing.md
│   ├── critical-routing.md
│   ├── power-and-analog-routing.md
│   ├── detailed-routing.md
│   ├── congestion-and-ripup.md
│   ├── tuning-and-delay.md
│   ├── return-path.md
│   ├── external-router-adapters.md
│   ├── routing-ir.md
│   ├── verification.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-completion-is-not-quality.md
│       ├── 0002-routing-is-staged.md
│       ├── 0003-differential-pair-is-one-routing-object.md
│       ├── 0004-existing-manual-copper-is-preserved.md
│       ├── 0005-router-output-is-independently-verified.md
│       ├── 0006-multiple-router-providers.md
│       └── 0007-writes-run-through-agent19.md
├── src/
│   └── pcb_routing/
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
│       │   └── agent25.py
│       ├── geometry/
│       │   ├── board.py
│       │   ├── terminals.py
│       │   ├── obstacles.py
│       │   ├── tracks.py
│       │   ├── vias.py
│       │   └── collision.py
│       ├── ownership/
│       │   ├── existing.py
│       │   ├── locks.py
│       │   └── ripup.py
│       ├── context/
│       │   ├── nets.py
│       │   ├── criticality.py
│       │   ├── pairs.py
│       │   ├── groups.py
│       │   ├── topology.py
│       │   └── return_path.py
│       ├── planning/
│       │   ├── stages.py
│       │   ├── layers.py
│       │   ├── corridors.py
│       │   ├── escape.py
│       │   └── vias.py
│       ├── routers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── grid.py
│       │   ├── astar.py
│       │   ├── hadlock.py
│       │   ├── visibility.py
│       │   ├── pattern.py
│       │   ├── negotiated.py
│       │   ├── ripup.py
│       │   └── local_repair.py
│       ├── critical/
│       │   ├── differential.py
│       │   ├── clocks.py
│       │   ├── memory.py
│       │   ├── power.py
│       │   ├── analog.py
│       │   ├── rf.py
│       │   └── high_voltage.py
│       ├── tuning/
│       │   ├── length.py
│       │   ├── delay.py
│       │   ├── skew.py
│       │   ├── patterns.py
│       │   └── regions.py
│       ├── external/
│       │   ├── dsn.py
│       │   ├── ses.py
│       │   ├── freerouting.py
│       │   └── mapping.py
│       ├── verification/
│       │   ├── connectivity.py
│       │   ├── drc.py
│       │   ├── constraints.py
│       │   ├── length_delay.py
│       │   ├── return_path.py
│       │   └── preservation.py
│       ├── scoring/
│       │   ├── completion.py
│       │   ├── critical.py
│       │   ├── vias.py
│       │   ├── manufacturing.py
│       │   └── pareto.py
│       ├── ir/
│       ├── changes/
│       ├── review/
│       ├── release/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── router-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_routing_readiness.py
    ├── build_routing_problem.py
    ├── plan_layers.py
    ├── route_escape.py
    ├── run_router.py
    ├── verify_routing_candidate.py
    ├── compare_routing_candidates.py
    ├── export_specctra_dsn.py
    ├── import_specctra_ses.py
    ├── submit_routing_to_agent19.py
    └── run_routing_benchmark.py
```


---

# 49. Codex 分阶段实施

不要让 Codex 一次实现 Geometry、Global Router、Detailed Router、差分、Memory、Power、Freerouting、调长、DRC、KiCad 写入和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–25 的真实实现和数据契约；
2. 当前 PCB IR、Track、Arc、Via、Zone、Net、Pad 和 Board Geometry；
3. 当前 Existing Copper、Lock、Ownership 和删除策略；
4. 当前 Stack-up、Net Class、Tuning Profile 和 `.kicad_dru`；
5. 当前 Agent 25 Placement、Routing Corridor、Congestion 和 Escape Pressure；
6. 当前未布线、部分布线和完整布线网络识别；
7. 当前差分对、Clock、Memory、Power、Analog、RF 和 High-voltage 分类；
8. 当前 Layer Assignment、Allowed Layer、Via Style 和 Preferred Direction；
9. 当前 Global Routing、Detailed Routing 和 Maze Router；
10. 当前 Push-and-Shove、A*、Lee、Hadlock、Visibility 和 Pattern Routing；
11. 当前 Negotiated Congestion、Rip-up/Reroute 和 Local Repair；
12. 当前 BGA/QFN/Connector Escape；
13. 当前差分耦合路由、Pair Via、Uncoupled Length；
14. 当前 Length/Delay/Skew 和 Tuning Pattern；
15. 当前 Return-path、Stitching Via 和 Plane Split；
16. 当前 Power Zone、Via Array、Kelvin 和 Guard；
17. 当前 KiCad DSN Export 和 SES Import；
18. 当前 Freerouting、CLI、Docker 和 Python Client；
19. 当前 Router Registry、Capability 和 Contract Tests；
20. 当前 Connectivity、Short/Open、DRC 和 Constraint Verification；
21. 当前 Agent 19 Track/Via/Zone/Tuning Write、Readback 和 Rollback；
22. 当前 Routing UI、Layer Viewer、Heatmap 和 Diff；
23. 当前 Queue、Worker、Database、Object Storage 和 Security；
24. 当前开源、合成、脱敏或授权 Fixture；
25. 统计路由完成率、Via、DRC、约束失败和未布关键网络；
26. 统计 DSN/SES 映射损失；
27. 只运行只读扫描和版本探测；
28. 不运行生产 Autorouter；
29. 不修改 Track/Via/Zone；
30. 不导入 SES 到生产工程；
31. 不安装 Router；
32. 不调用外部模型；
33. 不创建 Migration；
34. 不读取或打印 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Routing Job；
- Input Snapshot；
- Router Registry；
- Board Model；
- Terminal；
- Obstacle；
- Existing Copper；
- Net Profile；
- Diff Pair；
- Group；
- Layer Plan；
- Corridor；
- Escape Plan；
- Run Plan；
- Routing Run；
- Rip-up Iteration；
- Candidate；
- Route Graph；
- Segment/Via；
- Tuning；
- Unrouted；
- Verification；
- Score；
- Feedback；
- Routing IR；
- Change Plan；
- Release Gate；
- JSON Schema。

## Phase 2：Agent 16–25 Input Gate

实现：

- Project Revision；
- Reviewed Netlist；
- Padstack/Footprint；
- Constraint IR；
- Legalized Placement；
- Stack-up；
- Existing Copper；
- Snapshot Hash；
- Blocked/Candidate/Ready；
- Diagnostics。

## Phase 3：Routing Geometry Kernel

实现：

- Board/Layer Geometry；
- Segment/Arc；
- Pad/Via；
- Clearance Envelope；
- Collision；
- Distance；
- Offset；
- Intersections；
- Grid；
- Continuous Geometry；
- Unit；
- Property Tests。

## Phase 4：Existing Copper Ownership

实现：

- Track/Via/Zone/Tuning Ownership；
- Manual/Agent；
- Locked/Preserve/Modifiable；
- Hash；
- Rip-up Eligibility；
- Deletion Gate；
- Regression；
- Audit。

## Phase 5：Terminal 和 Pad Access

实现：

- Access Points；
- Escape Direction；
- Layer Scope；
- Clearance；
- Through-hole/SMD；
- QFN/BGA/Connector；
- Fanout Status；
- Unresolved Gate；
- Golden Tests。

## Phase 6：Net Classification 和 Priority

实现：

- Net Role；
- Criticality；
- Routing Stage；
- Safety；
- Timing；
- Edge；
- Current；
- Analog；
- Return Path；
- User Priority；
- Explain Trace；
- No Name-only Truth。

## Phase 7：Differential Pair 和 Group Model

实现：

- P/N；
- Pair Object；
- Width/Gap；
- Layer；
- Via Symmetry；
- Skew；
- Uncoupled；
- Bus/Matched Group；
- Topology；
- Review Gate。

## Phase 8：Layer Assignment Planner

实现：

- Allowed/Preferred/Forbidden；
- Preferred Direction；
- Reference Layer；
- Impedance Profile；
- Via Transition；
- Capacity；
- Conflicts；
- Multiple Plans；
- Trace。

## Phase 9：Routing Corridor Planner

实现：

- Agent 25 Corridors；
- Constraint Areas；
- Capacity Grid；
- Hard/Preferred/Avoid；
- Escape/Tuning Corridor；
- Layer Scope；
- Conflict；
- Visualization。

## Phase 10：Global Router V1

实现：

- Coarse Grid；
- Capacity；
- Demand；
- Net Ordering；
- Multi-terminal Approximation；
- Overflow；
- Layer Transitions；
- Candidate Plan；
- No Detailed Geometry。

## Phase 11：Maze Router V1

实现：

- A*；
- Lee/Hadlock Contract；
- Layer/Via Cost；
- Bend Cost；
- Clearance；
- Obstacles；
- Single Net；
- Deterministic Seed；
- Tests。

## Phase 12：Detailed Router V1

实现：

- Global Guide；
- 45° Geometry；
- Segments；
- Vias；
- Collision；
- Local Repair；
- Route Graph；
- Provenance；
- No Arc Required in MVP。

## Phase 13：Escape Router

实现：

- Connector；
- QFN；
- BGA Candidate；
- Dogbone；
- Via Technology；
- Fanout Direction；
- Layer Target；
- Escape Pressure；
- Failure Feedback to Agent 25。

## Phase 14：Differential Pair Router

实现：

- Coupled Search；
- Pair Geometry；
- Entry/Exit；
- Symmetric Via；
- Layer Transition；
- Uncoupled Limit；
- Intra-pair Skew；
- Collision；
- Golden Tests。

## Phase 15：Clock 和 Critical Single-ended Router

实现：

- Point-to-point；
- Source Termination；
- Allowed Layer；
- Max Via；
- Reference Plane；
- Stub；
- Critical Cost；
- Return Path Hook。

## Phase 16：Memory/Bus Router

实现：

- Group；
- Fly-by/Daisy-chain；
- Clock/Strobe/Data；
- Endpoint Order；
- Via Policy；
- Delay Budget；
- Partial Routing；
- Constraint Trace。

## Phase 17：Power and High-current Router

实现：

- Track/Plane Candidate；
- Width；
- Neck-down；
- Via Array；
- Bottleneck；
- Source-to-load；
- Kelvin；
- Zone Interface；
- Current Rule Verification。

## Phase 18：Analog/RF/Feedback Router

实现：

- Aggressor Avoidance；
- Minimum Via；
- Guard Candidate；
- Feedback；
- Sense；
- RF Controlled Geometry；
- Antenna Keepout；
- Chassis Transition。

## Phase 19：General Signal Router

实现：

- Remaining Nets；
- Priority；
- Corridors；
- Layer Preference；
- Via/Bend Cost；
- Partial Results；
- Candidate Pool。

## Phase 20：Negotiated Congestion

实现：

- Present/Historical Cost；
- Overflow；
- Iteration；
- Criticality Weight；
- Checkpoint；
- Stop Policy；
- Metrics；
- Deterministic Replay。

## Phase 21：Rip-up and Reroute

实现：

- Eligible Route Set；
- Congestion Blame；
- Local/Regional Rip-up；
- Preserve Critical/Manual；
- Reinsert；
- Improvement Gate；
- Trace；
- Rollback Iteration。

## Phase 22：Length/Delay/Skew Measurement

实现：

- Physical Length；
- Per-layer Delay；
- Via Delay；
- Chain Delay；
- Pair Skew；
- Group Skew；
- Endpoint Definition；
- Agent 24 Model；
- Trace。

## Phase 23：Tuning Pattern Generator

实现：

- Single Length；
- Pair Length；
- Pair Skew；
- Time-domain；
- Allowed Region；
- Pitch/Amplitude；
- Collision；
- Density；
- Crosstalk Proxy；
- Candidate/Review。

## Phase 24：Return-path and Stitching

实现：

- Reference Plane；
- Split Crossing；
- Layer Transition；
- Return Via Candidate；
- Stitching Spacing；
- Connector/Chassis；
- Findings；
- Repair Candidate；
- Gate。

## Phase 25：Cleanup and Manufacturability

实现：

- Collinear Merge；
- Tiny Segment；
- Acute Angle；
- Neck-down；
- Teardrop Candidate；
- Via-in-pad Policy；
- Stub；
- Copper-to-edge；
- Manufacturing Profile；
- No Silent Rule Relaxation。

## Phase 26：Router Registry and Capability Matrix

实现：

- Version；
- Platform；
- License；
- Constraint Support；
- Formats；
- Determinism；
- Health；
- Contract Test；
- Approved/Blocked；
- Fallback。

## Phase 27：Freerouting Adapter

实现：

- DSN Export；
- CLI/Docker Runner；
- SES Import；
- Mapping Manifest；
- Rule/Layer/Via Mapping；
- Timeout/Cancellation；
- Sandbox；
- Mapping Loss；
- Independent Verification。

## Phase 28：KiCad Tool/Interactive Adapter

实现：

- Capability Discovery；
- Guided Route Operations；
- Push-and-Shove Hook where available；
- Tuning Profile；
- Track/Via Objects；
- No Full Autorouter Claim；
- Version Contract。

## Phase 29：Routing Candidate IR

实现：

- Route Graph；
- Segments/Vias/Tuning；
- Zones；
- Unrouted；
- Violations；
- Metrics；
- Provenance；
- Stable Serialization；
- Manifest。

## Phase 30：Independent Verification

实现：

- Connectivity；
- Short/Open；
- DRC；
- Constraints；
- Layers/Width/Via；
- Length/Delay/Skew；
- Topology/Stub；
- Return Path；
- Existing Copper；
- Verification Report；
- Hard Gate。

## Phase 31：Scoring and Pareto

实现：

- Completion；
- Critical Quality；
- SI Proxy；
- Via；
- Congestion；
- Return Path；
- Manufacturing；
- Baseline Change；
- Pareto；
- Specialized Candidates；
- Explanation。

## Phase 32：Feedback Loop

实现：

- Placement Feedback；
- Constraint Feedback；
- Simulation Feedback；
- Scope；
- Evidence；
- Blocking；
- Re-run Workflow；
- Event。

## Phase 33：Agent 19 Adapter

实现：

- Candidate → Change Plan；
- Add Track/Arc/Via/Tuning/Zone；
- Remove Agent-generated；
- Lock；
- Refill；
- Workspace；
- Preview；
- Approval；
- Idempotency；
- Rollback。

## Phase 34：Post-write Verification

实现：

- Object Readback；
- Locked Copper Regression；
- Connectivity；
- Zone Refill；
- DRC；
- Agent 16；
- Agent 20；
- Agent 24；
- Agent 23 Impact；
- Commit/Rollback Recommendation。

## Phase 35：Review Workbench

实现：

- Layer Viewer；
- Net Priority；
- Routes；
- Unrouted；
- Corridors；
- Congestion Heatmap；
- Length/Delay；
- Via；
- Return Path；
- Candidate Compare；
- Lock/Reroute；
- Feedback；
- Diff/Approval。

## Phase 36：Baseline、Waiver、CI 和 Release Gate

实现：

- Baseline；
- New/Worsened；
- Approved Unrouted；
- Waiver Scope/Expiry；
- CLI；
- Gate Profiles；
- Immutable Manifest；
- Git Integration；
- Exit Codes；
- Events。

## Phase 37：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Checkpoint；
- Cancel/Resume；
- Object Storage；
- Parquet；
- Pagination；
- Permissions；
- Audit；
- Metrics。

## Phase 38：Benchmark、监控和生产发布

实现：

- Golden Boards；
- Router Matrix；
- Differential；
- Escape；
- Congestion；
- Tuning；
- External Adapter；
- Verification；
- Security；
- Performance；
- Feature Flags；
- Router Rollback；
- Disaster Recovery。

## Phase 39：高级能力，可选

稳定后：

- Any-angle Routing；
- Curved RF Routing；
- HDI/Microvia Optimization；
- Rigid-flex；
- Backdrill；
- Detailed SI/PI Feedback；
- Multi-board Routing；
- RL 仅作为候选排序；
- 仍不自动宣称生产布线完成。

---

# 50. Codex 工作纪律

Codex 必须：

1. Constraint、Planning、Routing、Verification 和 EDA Write 分层；
2. Input Snapshot 不可变；
3. Agent 18/20/24/25 Gate；
4. Existing Copper Ownership 明确；
5. Manual Locked 不可 Rip-up；
6. Agent Generated 与人工对象分开；
7. Router 不能移动 Footprint；
8. Net Priority 有证据；
9. Net Name 不是唯一事实；
10. Safety/Isolation 先于普通网络；
11. Diff Pair 作为耦合对象；
12. Pair P/N、Via 和 Layer 同步；
13. Topology 不可静默改变；
14. Layer Assignment 先于详细布线；
15. Stack-up/Tuning Profile 未知不生成生产几何；
16. Width/Gap 由 Agent 24 输入；
17. Via Style 由制造能力约束；
18. Multi-terminal Net 服从 Topology；
19. Global Route 与 Detailed Route 分开；
20. Router Provider 有版本、Seed 和能力；
21. Unknown Capability 不视为支持；
22. 每个 Run 保存参数和时间预算；
23. Timeout 不伪造最优；
24. Candidate 保存所有未布和违反项；
25. 100% Routed 不等于 Pass；
26. Hard Gate 独立；
27. Via 不可无限增加；
28. Rip-up 仅作用于 Eligible；
29. 每轮 Rip-up 可回放；
30. Congestion 有 Capacity Assumption；
31. BGA Escape 失败反馈 Agent 25；
32. Constraint Conflict 反馈 Agent 24；
33. 寄生敏感变化反馈 Agent 23；
34. Length 和 Delay 分开；
35. Tuning 只能在允许区域；
36. 不塞高密度蛇形掩盖布局问题；
37. Return Path 必须独立检查；
38. Layer Transition 需要回流策略；
39. Zone Refill 后重新验证；
40. External Router Output 先转 Canonical IR；
41. DSN/SES Mapping Loss 显式；
42. 不直接导入未经验证 SES；
43. Router Success != Verification Pass；
44. Independent Verifier 不依赖 Router；
45. Short/Open 是 Hard Gate；
46. DRC Error 是 Hard Gate；
47. 高压降低禁止；
48. 制造最小规则降低禁止；
49. Existing Manual Zone 不静默修改；
50. AI 不生成 Track 坐标；
51. AI 不改变 Hard Constraint；
52. AI 不隐藏未布或失败；
53. Agent 19写入前 Preview；
54. 删除铜对象需额外审批；
55. 写入后回读全部 Agent 对象；
56. 写入后确认 Locked Copper；
57. 写入后 Agent 16重新解析；
58. 写入后 Agent 20/24检查；
59. 关键网络触发 Agent 23回归；
60. Post-write DRC Regression 是 Hard Gate；
61. Approved Unrouted 必须显式；
62. Release Pass 不等于 SI/PI/EMC 认证；
63. 不发送私有 PCB 给外部模型或云 Router；
64. 不用客户工程做公开 Fixture；
65. 不伪造 Router、布通率、DRC、Delay、拥塞或 Benchmark；
66. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Geometry/Policy/Router 变化；
    - 测试命令和真实结果；
    - Net/Pair/Group Coverage；
    - Layer/Escape；
    - Completion/Unrouted；
    - Via/Length/Delay/Skew；
    - Congestion/Rip-up；
    - Verification/DRC；
    - Agent 19/Post-write；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 51. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input/Ownership

1. Reviewed Netlist；
2. Candidate Netlist Block；
3. Padstack Block；
4. Missing Constraint；
5. Illegal Placement；
6. Missing Stack-up；
7. Manual Locked Track；
8. Manual Preserve Zone；
9. Agent Modifiable Route；
10. Existing Partial Route。

## Geometry/Access

11. Through-hole；
12. SMD；
13. QFN；
14. BGA；
15. Fine-pitch Connector；
16. Edge Connector；
17. Pad Access Blocked；
18. Cutout；
19. Multi-layer Keepout；
20. Via Site Conflict。

## Classification/Planning

21. USB Diff；
22. CAN Diff；
23. Clock；
24. Memory Bus；
25. Power 3A；
26. Analog Feedback；
27. RF；
28. High Voltage；
29. Layer Conflict；
30. Corridor Conflict。

## Routing

31. A* Single Net；
32. Multi-layer A*；
33. Multi-terminal；
34. Differential Pair；
35. Pair Via；
36. Pair Uncoupled；
37. Source Terminated；
38. Fly-by；
39. Power Track；
40. Kelvin Sense；
41. Analog Avoid；
42. RF Geometry；
43. General Nets；
44. Partial Route；
45. No Feasible Route。

## Congestion/Tuning

46. Negotiated Congestion；
47. Rip-up Eligible；
48. Locked Route Preserve；
49. Multi-start；
50. Deterministic Seed；
51. Timeout；
52. Length Tune；
53. Pair Skew Tune；
54. Time-domain Tune；
55. Missing Tuning Region；
56. Meander Collision；
57. Excess Via；
58. Stub；
59. Return Via；
60. Plane Split。

## External/Verification

61. DSN Export；
62. SES Import；
63. Freerouting CLI；
64. Router Timeout；
65. Mapping Loss；
66. Unsupported Constraint；
67. Connectivity Pass；
68. Open；
69. Short；
70. DRC；
71. Width/Gap；
72. Allowed Layer；
73. Via Style；
74. Length/Delay；
75. Return Path。

## Workflow/Security

76. Candidate Pareto；
77. Lock Selected Route；
78. Reroute Net；
79. Placement Feedback；
80. Constraint Feedback；
81. Simulation Feedback；
82. Agent 19 Preview；
83. Agent 19 Execute；
84. Readback；
85. Locked Copper Regression；
86. Zone Refill；
87. DRC Regression；
88. Rollback；
89. Baseline；
90. Waiver；
91. Path Traversal；
92. Malicious DSN；
93. Malicious SES；
94. Free Shell Injection；
95. Unapproved Router；
96. Tenant Isolation；
97. 10k Nets；
98. 100k Segments；
99. Batch 100 Boards；
100. Audit Replay。

---

# 52. 初始质量目标

```text
Manual Locked Copper Preservation = 100%
Unreviewed Net Auto-route = 0
Unapproved Router Auto-use = 0
Differential Pair Split-routing = 0
Unknown Stack-up Production Geometry = 0
Safety/Manufacturing Rule Auto-relaxation = 0
Router Output Independent Verification = 100%
DSN/SES Mapping Manifest Coverage = 100%
Short/Open Silent Acceptance = 0
DRC Error Released Candidate = 0
Unrouted Critical Net Silent Acceptance = 0
Router Version/Seed/Config Trace Coverage = 100%
Post-write Object Readback Coverage = 100%
Post-write Locked Copper Check = 100%
Post-write Agent 24 Coverage Check = 100%
AI Direct Track Coordinate Write = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 53. 性能要求

常规项目：

```text
100–1,000 Footprints
300–5,000 Nets
4–8 Copper Layers
```

模式：

```text
quick      30 s–2 min
balanced   2–15 min
deep       15–120 min
```

交互目标：

```text
Readiness P95 < 10 s
Board Model P95 < 20 s
Layer Plan P95 < 20 s
Single-net Reroute P95 < 5 s
Candidate Verification P95 < 60 s for medium board
```

大型任务要求：

- Global/Detailed 分离；
- Stage 并行；
- Checkpoint；
- Resume；
- Candidate Worker Pool；
- Backpressure；
- Resource Budget；
- Partial Result；
- 不把完整工程发送给模型。

---

# 54. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pcb-routing-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第26个 Agent：

PCB Constraint-Driven Automatic Routing & Candidate Optimization Agent /
PCB 自动布线 Agent。

本 Agent 接收：

- Agent 16 PCB/Footprint/Pad/Track/Via/Zone/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Padstack/Footprint/Pin-Pad 校验；
- Agent 21 Interface/Clock/Memory/Firmware 配置；
- Agent 22 电源、模拟、高压和敏感网络审查；
- Agent 23 边沿、带宽、负载和关键仿真结果；
- Agent 24 Stack-up、阻抗、线宽、Gap、Layer、Via、Length、Delay、Skew、Return Path 和 Keepout；
- Agent 25 Legalized Placement、Routing Corridor、Congestion 和 Escape Pressure；
- Existing Track/Via/Zone 和 Ownership；

生成：

- Routing Readiness；
- Board/Terminal/Obstacle Model；
- Net Priority；
- Layer Assignment；
- Corridor/Escape Plan；
- Differential/Critical/Power/Analog/General Routing；
- Negotiated Congestion；
- Rip-up and Reroute；
- Length/Delay/Skew Tuning；
- Return-path/Stitching；
- Multiple Routing Candidates；
- Independent Verification；
- Agent 19 Change Plan；
- Post-write Regression。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–26 规格和 Agent 16–25 实际代码；
3. docs/pcb-routing-agent-spec.md；
4. 当前 PCB/Track/Via/Zone/Pad/Board Geometry；
5. 当前 Existing Copper Ownership/Lock；
6. 当前 Stack-up/Net Class/Tuning Profile/Rules；
7. 当前 Agent 25 Placement/Corridor/Congestion；
8. 当前 Net Classification/Diff Pair/Group；
9. 当前 Layer Assignment/Global Routing；
10. 当前 Maze/Detailed Router；
11. 当前 Escape/BGA/Connector；
12. 当前 Negotiated Congestion/Rip-up；
13. 当前 Length/Delay/Skew/Tuning；
14. 当前 Return-path/Stitching；
15. 当前 Power/Zone/Analog/RF；
16. 当前 DSN/SES/Freerouting；
17. 当前 Router Registry/Contract；
18. 当前 Connectivity/DRC/Constraint Verification；
19. 当前 Agent 19 Track/Via/Zone Write；
20. 当前 Review UI；
21. 当前 API/Worker/Storage/Security；
22. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Constraint/Planning/Routing/Verification/Write Separation；
- Input Snapshot Immutable；
- Agent 18/20/24/25 Gate；
- Existing Copper Ownership；
- Manual Locked Never Rip-up；
- Router Cannot Move Footprints；
- Net Name != Truth；
- Safety/Critical Stage First；
- Diff Pair is One Routing Object；
- Topology Preserved；
- Layer Plan Before Detailed Route；
- Stack-up/Tuning Required；
- Width/Gap from Agent 24；
- Via from Fab Capability；
- Global != Detailed；
- Router Version/Seed/Time Budget；
- Unknown Capability != Supported；
- No Fake Optimality；
- Candidate Preserves Failures；
- 100% Routed != Pass；
- Negotiated Congestion Trace；
- Rip-up Eligible Only；
- Length != Delay；
- Tuning Region Required；
- Return Path Check；
- External Router → Canonical IR；
- DSN/SES Mapping Loss；
- Independent Verification；
- Short/Open/DRC Hard Gate；
- No Safety/Manufacturing Relaxation；
- AI Does Not Write Coordinates；
- Agent 19 Workspace/Preview/Approval；
- Post-write Readback/Locked/Agent16/20/24/23/DRC；
- Pass != SI/PI/EMC Certification；
- 不发送私有 PCB 给外部模型或云 Router；
- 不用客户工程做公开 Fixture；
- 不伪造 Router、布通率、DRC 和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不运行生产 Autorouter：

1. 侦察当前仓库；
2. 检查 Agent 16–25 Contract；
3. 查找 PCB/Track/Via/Zone/Pad；
4. 查找 Existing Copper Ownership；
5. 查找 Stack-up/Net Class/Tuning；
6. 查找 Agent 25 Placement/Corridor；
7. 查找 Net Classification/Pairs/Groups；
8. 查找 Layer Assignment；
9. 查找 Global Router；
10. 查找 Maze/Detailed Router；
11. 查找 Escape；
12. 查找 Negotiated Congestion/Rip-up；
13. 查找 Length/Delay/Skew；
14. 查找 Return Path；
15. 查找 Power/Analog/RF；
16. 查找 DSN/SES；
17. 查找 Freerouting；
18. 查找 Router Registry/Contract；
19. 查找 Verification/DRC；
20. 查找 Agent 19 Write/Readback；
21. 查找 UI/API/Worker/Storage/Security；
22. 统计路由、Via、DRC、未布和约束覆盖；
23. 统计 DSN/SES Mapping Loss；
24. 抽样分析开源、合成、脱敏或授权工程；
25. 在 docs/pcb-routing-implementation-plan.md 中生成实施计划；
26. 在 docs/input-and-routing-gates.md 中定义 Gate；
27. 在 docs/routing-problem-ir.md 中定义 IR；
28. 在 docs/existing-copper-ownership.md 中定义 Ownership；
29. 在 docs/net-classification-and-priority.md 中定义分类；
30. 在 docs/layer-assignment.md 中定义层；
31. 在 docs/global-routing.md 中定义全局；
32. 在 docs/escape-routing.md 中定义逃线；
33. 在 docs/differential-routing.md 中定义差分；
34. 在 docs/critical-routing.md 中定义关键网；
35. 在 docs/power-and-analog-routing.md 中定义电源模拟；
36. 在 docs/detailed-routing.md 中定义详细；
37. 在 docs/congestion-and-ripup.md 中定义拥塞；
38. 在 docs/tuning-and-delay.md 中定义调长；
39. 在 docs/return-path.md 中定义回流；
40. 在 docs/external-router-adapters.md 中定义外部 Router；
41. 在 docs/routing-ir.md 中定义 Routing IR；
42. 在 docs/verification.md 中定义独立验证；
43. 在 docs/agent19-integration.md 中定义写入；
44. 在 docs/release-gates.md 中定义 Gate；
45. 在 docs/ai-boundaries.md 中定义 AI；
46. 在 docs/security.md 中定义安全；
47. 在 docs/pcb-routing-migration-plan.md 中定义旧能力迁移；
48. 在 docs/pcb-routing-benchmark-plan.md 中定义 Benchmark；
49. 给出拟新增、拟修改和拟复用文件；
50. 给出 Phase 1 精确范围；
51. 不修改业务代码；
52. 不创建 Migration；
53. 不安装 Router；
54. 不运行生产 Autorouter；
55. 不导入 SES 到工程；
56. 不调用外部模型；
57. 不读取或打印 Secret；
58. 运行仓库已有 lint、type check、test、build 和 security scan；
59. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–25 Contract；
- Input/Ownership Gate；
- Routing Problem IR；
- Net Priority；
- Layer/Corridor；
- Escape；
- Differential；
- Critical/Memory；
- Power/Analog/RF；
- Global/Detailed Router；
- Congestion/Rip-up；
- Length/Delay/Skew；
- Return Path；
- DSN/SES/Freerouting；
- Independent Verification；
- Routing Candidate/Pareto；
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

# 55. 后续 Phase 提示词模板

```text
继续实现 PCB Routing Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–26 规格；
3. 阅读 PCB Routing Implementation Plan；
4. 阅读 Gate、IR、Ownership、Priority、Layer、Global、Escape、Diff、Detailed、Congestion、Tuning、Return Path、External、Verification、Agent19、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Existing Copper Preservation；
- Hard Constraint First；
- Router Traceability；
- Independent Verification；
- Multiple Candidates；
- Agent 19 Controlled Write；
- Post-write Regression；
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
9. router deterministic test；
10. constraint/ownership test；
11. verification/DRC test；
12. Agent 19/post-write test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Geometry/Policy/Router 变化；
- 测试命令和真实结果；
- Net/Pair/Group Coverage；
- Layer/Escape；
- Completion/Unrouted；
- Via/Length/Delay/Skew；
- Congestion/Rip-up；
- Verification/DRC；
- Agent 19/Post-write；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 56. MVP 演示流程

1. 选择一块四层 MCU 控制板，包含 USB-C、CAN、QSPI Flash、Buck、ADC、晶振和电机驱动；
2. Agent 16解析 PCB、Pad、Net、已有铜对象和板框；
3. Agent 18提供 Reviewed Netlist；
4. Agent 20确认 Footprint、Padstack 和 Pin-Pad；
5. Agent 24提供 Stack-up、USB 90Ω、CAN、线宽、层、Via、Skew、高压和回流规则；
6. Agent 25提供 Legalized Placement、通道和拥塞图；
7. 建立 Routing Input Snapshot；
8. 标记已有人工 USB ESD 到连接器的短走线为 `manual_locked`；
9. 标记普通 Agent 试布线为 `agent_generated_modifiable`；
10. 识别 USB、CAN 差分对；
11. 识别 QSPI Clock/Data Group；
12. 识别 Buck Hot Loop、ADC 输入和电机高电流网络；
13. 生成网络优先级；
14. 生成 Layer Assignment；
15. 为 MCU/QSPI/连接器生成 Escape Plan；
16. BGA/QFN Escape 检查通过；
17. 先路由高压隔离边界允许穿越的网络；
18. 路由 USB 差分对并保留已有锁定段；
19. 生成对称 Pair Via；
20. 验证最大 Uncoupled Length；
21. 路由 CAN 差分对；
22. 路由 QSPI Clock、CS 和 Data；
23. 路由 Buck Gate、SW、Feedback 和 Current Sense；
24. 路由 ADC 敏感网络；
25. 路由电源高电流 Track 和 Via Array；
26. 路由普通网络；
27. 初次结果布通率 94%，有 12 个普通网络未布；
28. Negotiated Congestion 识别 MCU 南侧通道溢出；
29. Rip-up 三条低优先级 Agent 走线；
30. 重新布线后达到 98%；
31. 剩余两个网络因连接器通道不足无法布通；
32. 生成 Agent 25 Placement Feedback，建议移动一个 Semi-fixed 调试接口 2mm；
33. Agent 25 局部重布局；
34. Agent 26重新运行受影响区域；
35. 达到 100% 连接；
36. 测量 USB/CAN Pair Skew；
37. QSPI Data Group 进行 Delay 调整；
38. Tuning Pattern 仅放在批准区域；
39. Return-path 检查发现两处换层附近缺少 Ground Stitching Via；
40. 生成并加入 Stitching Via Candidate；
41. Cleanup 删除微小共线段；
42. 生成 Teardrop Candidate，但不作为 MVP Hard Gate；
43. 形成五个候选：
44. 最高布通率；
45. 最少 Via；
46. 最佳关键网络；
47. 最佳制造性；
48. 平衡方案；
49. 独立 Verifier 检查 Connectivity、Short/Open、DRC、Width/Gap、Layer、Via、Delay、Return Path 和 Existing Copper；
50. 一个候选因改动 Manual Locked Track 被淘汰；
51. 一个候选因 USB Pair 局部 Uncoupled 超限被淘汰；
52. 工程师选择平衡方案；
53. Agent 19在 Workspace 中写入 Track、Via、Tuning 和 Stitching Via；
54. 回读全部对象；
55. 确认人工锁定铜未变化；
56. Refill Zones；
57. Agent 16重新解析；
58. Agent 24重新测量 Length/Delay/Skew 和规则覆盖；
59. Agent 23对 USB 和模拟关键网络进行候选回归；
60. 运行 KiCad DRC；
61. DRC Error 为零；
62. 生成 Routing Manifest、Unrouted Report、Via、Delay、DRC 和 Candidate Comparison；
63. Routing Complete Gate 通过；
64. 发布 `pcb-routing.completed`。

---

# 57. 生产上线顺序

第一阶段：

```text
Input/Ownership Gate
Routing Problem IR
Net Priority
Layer Assignment
A* Single-net Router
General Signal Routing
Independent Connectivity/DRC
Report-only
```

第二阶段：

```text
Escape Routing
Differential Pair
Negotiated Congestion
Rip-up/Reroute
Length/Delay/Skew
Freerouting Adapter
Agent 19 Write
```

第三阶段：

```text
Memory/Bus
Power Planes
Return-path Automation
RF/HDI
Incremental Detailed Routing
SI/PI Feedback
Multi-router Portfolio
```

上线优先确保：

```text
哪些走线可以改、哪些绝对不能动
每条网络为什么使用这一层、线宽、Via 和通道
未布通网络究竟是算法失败、布局失败还是约束冲突
Router 输出是否经过独立 Connectivity、DRC 和约束验证
写入工程后人工铜、关键网络和规则是否保持正确
```

一个靠谱的自动布线 Agent，不应该像在迷宫里只求“找到出口”。它更像交通规划师：高速公路先修、危险品路线隔离、重载车辆不能走小巷、换层要有回流通道，最后还得证明整套道路真能通车。
