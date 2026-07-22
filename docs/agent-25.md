# PCB 初步布局 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：25  
> Agent 名称：PCB Preliminary Placement, Floorplanning & Board Area Optimization Agent  
> 中文名称：PCB 初步布局 Agent  
> 类型：程序＋优化算法  
> 版本：V1.0  
>
> 定位：基于 Agent 16–24 输出的结构化 EDA 工程、Reviewed Netlist、Footprint 与 Pin-Pad、功能配置、原理图审查、仿真结果和 Canonical PCB Constraint IR，完成机械边界与连接器锁定、功能聚类、电源/模拟/数字/RF/高压分区、去耦和关键器件邻近、板框面积估算、多候选 Floorplan、初步器件放置、合法化、拥塞评估和受控写入。
>
> 上游：
> - Agent 16：Project/Schematic/PCB/Part/Footprint/Pad/Net IR、Board Geometry、Source Map
> - Agent 18：Reviewed Netlist、Pin-to-Net、连接置信度
> - Agent 20：Footprint、Pin-Pad、Courtyard、3D、库版本和实例一致性
> - Agent 21：PinMux、Peripheral、Clock、Bus Speed、PWM、ADC、Memory 和 Firmware 配置
> - Agent 22：去耦、晶振、复位、电源、高压、保护和敏感网络审查结果
> - Agent 23：边沿、带宽、负载、稳定性和关键节点仿真结果
> - Agent 24：PCB Constraint IR、Net/Component Class、Rule Area、Keepout、阻抗、长度、回流与高压约束
> - Agent 19：KiCad MCP/CLI/IPC、Workspace、Change Plan、Readback、DRC 和 Rollback
> - 用户机械要求、板框、连接器、安装孔、外壳、显示屏、按键、散热器、天线和线束要求
>
> 下游：
> - Agent 19：执行 Footprint Placement、Orientation、Side、Lock、Rule Area、Keepout 和 Board Outline Patch
> - 后续 PCB 自动布线 Agent：接受 Placement IR、Routing Corridor、Congestion Map 和 Critical Net Ordering
> - Agent 24：用候选布局回算约束覆盖和回流路径
> - Agent 23：对关键回路和寄生候选进行再仿真
> - Agent 43：NPI Floorplan 冻结
> - Agent 44：板尺寸、层数、工艺和 SMT 报价
> - Agent 45：测试点、探针通道和可测试性
>
> 核心输出：
> - PCB Placement Input Snapshot
> - Mechanical Constraint Snapshot
> - Footprint Geometry Snapshot
> - Functional Block IR
> - Placement Group IR
> - Fixed/Locked Object Plan
> - Board Area Estimate
> - Board Outline Candidate
> - Placement Region Plan
> - Critical Placement Relation Graph
> - Power/Decoupling/Clock/Interface Placement Plan
> - Analog/RF/High-voltage/Thermal/Testability Partition Plan
> - Routing Demand and Congestion Estimate
> - Multi-candidate Floorplan
> - Preliminary and Legalized Placement
> - Candidate Score and Pareto Set
> - Placement Constraint Coverage Report
> - Agent 19 Canonical Change Plan
> - Post-write Geometry/DRC/Semantic Verification
>
> 重要边界：
> - 本 Agent 负责初步 Floorplan 和可布线布局，不替代最终布局、布线、SI/PI、EMC、热和安全审核。
> - 固定连接器、安装孔、板边器件、显示屏、天线、线束、散热器和外壳干涉属于 Hard Constraint。
> - 原理图排版不等同物理布局，不能拿原理图坐标直接映射 PCB。
> - “靠近”“短”“远离”在未量化前只能形成定性关系。
> - Footprint 本体包围盒不等于 Courtyard、装配、返修、热或线束空间。
> - 不以最短总线长为唯一目标；电源回路、回流路径、模拟隔离、高压、热和装配可能优先。
> - 板面积估算必须包含利用率、布线通道、Keepout、机械保留和不确定度。
> - Hard Constraint 不能被目标函数权重覆盖。
> - 自动优化必须输出多个候选、评分拆解、违反项和移动原因。
> - 未解析 Footprint、未知 Courtyard、缺失板框和未解决高压边界必须阻断相应发布。
> - 不直接修改唯一生产工程；所有写入通过 Agent 19。
> - 不把私有工程、机械结构和客户布局规则发送给外部通用模型。

---

# 1. 系统位置

```text
Reviewed EDA + PCB Constraints + Mechanical Requirements
                         ↓
Input and Geometry Readiness Gate
                         ↓
Fixed Object and Mechanical Locking
                         ↓
Functional Clustering and Partitioning
                         ↓
Critical Relation and Power Placement
                         ↓
Board Area / Outline Candidates
                         ↓
Global Floorplanning
                         ↓
Detailed Preliminary Placement
                         ↓
Legalization and Constraint Repair
                         ↓
Congestion / Thermal / Testability Evaluation
                         ↓
Pareto Candidates and Human Review
                         ↓
Agent 19 Controlled Write
                         ↓
Readback / DRC / Coverage / Routing Feasibility
```

---

# 2. 设计原则

1. **机械事实先于电气优化**：连接器、安装孔、外壳开孔和天线位置先锁定。
2. **Hard Constraint 与 Soft Objective 分离**：安全、机械和不可移动关系不能被“总分更高”覆盖。
3. **先分区、再放组、后放器件**：避免一步优化陷入局部最优。
4. **关键回路优先**：去耦、晶振、反馈、Hot Loop、终端和接口保护先放。
5. **全局线长只是代理指标**：对电源、模拟、RF 和高速网络使用专用成本函数。
6. **输出多个 Pareto 候选**：最小面积、最佳布线、最佳热、最佳关键回路和平衡方案。
7. **合法化不等于可布线**：合法化后必须跑拥塞、逃线、回流和 DRC 评估。
8. **增量稳定性**：小修改优先局部重排，避免整板“洗牌”。
9. **所有坐标可追溯**：保存 Solver、Seed、输入 Hash、关系和移动原因。
10. **工程写入闭环**：Agent 19 写入后重解析、回读、DRC、约束覆盖和回滚。

---

# 3. 布局层级

## 3.1 Mechanical Floorplan

处理：

```text
Board outline
Board cutout
Mounting holes
Connectors
Displays
Buttons/Switches
Antenna
Heatsink
Enclosure
Cable zones
Panel rails
```

## 3.2 Functional Floorplan

处理：

```text
power
digital core
memory
analog
RF
interfaces
motor/power driver
isolation
test
```

## 3.3 Critical Component Placement

处理：

```text
decoupling
crystal
feedback
bootstrap
gate resistor
termination
ESD
common-mode choke
current sense
reference
```

## 3.4 Global Placement

处理全部可移动 Footprint 的区域、相对位置、方向和面。

## 3.5 Legalization

消除：

```text
courtyard overlap
keepout violation
board-edge violation
side/orientation violation
height conflict
assembly spacing violation
```

---

# 4. 输入与对象分类

## 4.1 对象状态

```text
fixed
locked
semi_fixed
movable
optional
dnp
mechanical
virtual_group
rule_area
keepout
```

### Fixed

```text
连接器
安装孔
显示屏
开关/按键/旋钮
天线
摄像头
散热器
外壳定位器件
```

### Semi-fixed

允许在有限区域或板边滑动：

```text
LED
测试接口
调试接口
排针
线束连接器
```

## 4.2 Footprint Geometry Snapshot

保存：

```text
body bounds
pad bounds
courtyard
fabrication bounds
silkscreen bounds
3D envelope
height
rotation origin
allowed rotations
allowed side
assembly clearance
rework clearance
```

状态：

```text
complete
courtyard_missing
height_missing
3d_missing
mechanical_incomplete
footprint_unresolved
conflicting
```

`footprint_unresolved` 阻断自动放置。

---

# 5. Mechanical Constraint IR

```text
board outline
cutout
mounting hole
edge clearance
connector opening
enclosure volume
height zone
cable zone
tool access
airflow
heatsink
display window
button/knob axis
panel rail
fiducial reserve
```

每个固定对象保存：

```text
position
rotation
side
lock reason
source requirement
tolerance
allowed movement
mechanical reference
```

---

# 6. Functional Block IR

```json
{
  "block_id": "uuid",
  "block_type": "power_stage",
  "member_footprint_ids": [],
  "external_interfaces": [],
  "power_domains": [],
  "critical_relations": [],
  "preferred_region": {},
  "orientation_intent": {},
  "confidence": {}
}
```

类型：

```text
power input
power conversion
power distribution
processor
memory
clock
digital interface
analog frontend
sensor
RF
antenna
isolation
motor/actuator
display/UI
storage
debug/programming
test
```

---

# 7. 功能聚类与 Hypergraph

## 7.1 聚类证据

```text
原理图层级
Net Connectivity
Power Domain
Interface
Part Role
Signal Direction
Agent 21 Peripheral
Agent 22 Review
Agent 24 Constraint
用户定义 Block
```

## 7.2 Hypergraph

节点：

```text
Footprint
Virtual Block
Fixed Object
Connector
```

Hyperedge：

```text
Net
Bus
Differential Pair
Power Rail
Critical Relation
```

权重：

```text
criticality
edge rate
current
analog sensitivity
timing
user priority
```

---

# 8. Placement Group 与关系图

## 8.1 Placement Group

```text
group id
members
group type
hard/soft
internal order
orientation
same side
maximum span
region
```

## 8.2 Critical Relation

```text
must_be_near
must_be_far
must_be_between
must_align
must_face
must_be_symmetric
must_share_region
must_not_share_region
must_follow_signal_flow
must_follow_power_flow
```

每条关系保存：

```text
subject
object
hard/soft
numeric limit or qualitative status
source
confidence
priority
```

---

# 9. 关键器件布局模型

## 9.1 去耦分配

必须建立：

```text
power pin
power rail
assigned capacitor
ground return
priority
distance budget
side preference
via budget
shared status
```

不能把所有 100nF 电容视为可任意交换。

去耦成本：

```text
pin-to-pad distance
power path
ground path
loop proxy
same-side
via count
plane access
BGA escape
```

## 9.2 Power Tree

推荐布局流向：

```text
input connector
→ protection
→ filter
→ regulator/switch
→ inductor/diode
→ output capacitors
→ load domains
```

## 9.3 Hot Loop

目标：

```text
loop proxy 最小
switch node area 最小
feedback 隔离
热和铜皮空间保留
```

## 9.4 Clock/Crystal

```text
MCU oscillator pins
crystal
load capacitors
bias/series component
keepout
no-cross corridor
```

## 9.5 Interface Protection Chain

```text
external connector
→ ESD/TVS
→ common-mode choke
→ termination/series resistor
→ transceiver/MCU
```

## 9.6 Analog Chain

```text
sensor/connector
→ protection/filter
→ amplifier
→ ADC/reference
→ processor
```

目标：

```text
敏感节点短
远离高 dv/dt/di/dt
参考路径连续
模拟电源和地关系可解释
```

## 9.7 High-voltage Partition

```text
domain regions
isolation boundary
allowed crossing components
clearance/creepage reserve
slot/cutout reserve
test access
```

属于 Hard Constraint。

## 9.8 RF/Antenna

```text
antenna edge/corner preference
keepout
module orientation
feed path
ground clearance
enclosure interaction
connector relation
```

## 9.9 Thermal

输入：

```text
device power candidate
package thermal data
heatsink
airflow
copper requirement
temperature-sensitive devices
```

目标：

```text
热源分散
热路径可实现
避免温敏器件
避免连接器/塑料件过热
保留散热铜和 Via 空间
```

## 9.10 Testability

```text
test connector accessibility
test point probe pitch
fixture approach direction
keepout
programming access
FCT cable
debug access
```

---

# 10. 板面积估算

板面积不是 Footprint 面积的简单求和。

组成：

```text
effective component area
courtyard area
routing channel area
keepout area
mechanical reserve
thermal reserve
test reserve
manufacturing reserve
uncertainty margin
```

建议输出：

```text
minimum theoretical area
recommended engineering area
low-risk area
utilization range
confidence
main limiting factors
```

利用率指标：

```text
component utilization
routing utilization
keepout utilization
mechanical utilization
regional density
```

---

# 11. Board Outline Candidate

类型：

```text
fixed outline
rectangular candidate
rounded rectangle candidate
mechanical template
connector-driven outline
enclosure-driven outline
custom candidate
```

目标：

```text
满足固定件
满足安装孔
满足连接器
满足 Keepout
满足面积
控制长宽比
制造和 Panel 友好
保留边缘空间
```

自动修改 Board Outline 默认为高风险。

---

# 12. Floorplan 与优化阶段

```text
Stage 1  固定件与机械对象
Stage 2  功能分区和 Hypergraph Partition
Stage 3  Block-level Floorplan
Stage 4  关键器件组
Stage 5  全局器件放置
Stage 6  合法化
Stage 7  局部搜索和修复
Stage 8  路由/热/测试评估
Stage 9  Pareto 排名
```

---

# 13. Hard Constraints

```text
fixed/locked position
board boundary
cutout
keepout
courtyard no-overlap
side
rotation
height
connector opening
mounting hole
isolation boundary
high-voltage reserve
antenna keepout
mechanical envelope
```

---

# 14. Soft Objectives

```text
wirelength
critical length
loop area proxy
decoupling quality
congestion
thermal spread
analog isolation
symmetry
testability
assembly/rework
movement from seed
board area
aspect ratio
```

推荐 Lexicographic 顺序：

```text
Hard violations
→ Mechanical correctness
→ Safety/high-voltage
→ Power/clock/critical loops
→ Routing feasibility
→ Thermal
→ Testability/manufacturing
→ Wirelength
→ Area
```

---

# 15. 求解算法组合

## 15.1 Functional Partition

可使用：

```text
Hypergraph partitioning
Graph community detection
Spectral candidate
Rule-based seeded clustering
```

## 15.2 Block Floorplan

可使用：

```text
B*-tree
Slicing tree
Sequence pair
CP-SAT region assignment
```

## 15.3 Global Placement

可使用：

```text
Analytic placement candidate
Force-directed candidate
Simulated annealing
Multi-start local search
```

## 15.4 Discrete Constraints

可使用：

```text
CP-SAT
MILP adapter
```

适合：

```text
区域
面
方向
顺序
是否靠边
是否同侧
```

## 15.5 Legalization

使用确定性算法：

```text
snap
board containment
overlap removal
keepout avoidance
orientation/side repair
local compaction
```

---

# 16. 多目标评分

总目标不能只用 Weighted HPWL。

建议拆分：

```text
hard_violation_count
mechanical_score
safety_score
critical_relation_score
decoupling_score
power_loop_score
clock_score
routing_score
escape_score
thermal_score
analog_isolation_score
testability_score
manufacturing_score
movement_score
area_score
```

Candidate 先经过：

```text
Hard Gate
Legalization Gate
Constraint Coverage Gate
```

之后才比较 Score。

---

# 17. Routing Demand 与 Congestion

基于：

```text
grid bins
pin density
net demand
available layers
keepouts
BGA escape
preferred direction
routing corridors
```

输出：

```text
global congestion map
regional overflow
pin escape pressure
via pressure
critical corridor
```

BGA Escape 估计考虑：

```text
pad pitch
escape rows
via technology
layer count
fanout direction
nearby blockers
```

只是可行性估计，不替代详细逃线。

---

# 18. Legalization

步骤：

```text
snap to grid
board containment
fixed/locked preservation
overlap removal
courtyard spacing
keepout avoidance
orientation repair
side repair
local compaction
```

状态：

```text
legal
legal_with_warnings
partially_legal
unlegalizable
```

`partially_legal` 不能写入发布分支。

---

# 19. Pareto Candidate

至少输出：

```text
最小面积方案
最佳布线方案
最佳热性能方案
最佳关键回路方案
平衡方案
```

每个候选保存：

```text
solver
seed
time budget
positions
score breakdown
violations
congestion map
movement from baseline
explanation
```

---

# 20. Existing Placement 与增量布局

支持：

```text
preserve approved regions
preserve locked parts
movement penalty
partial re-layout
region-only optimization
new-part insertion
critical-group-only optimization
```

变化来源：

```text
new/removed component
footprint change
board outline change
constraint change
connector move
stackup change
thermal change
```

移动预算：

```text
max component displacement
max group displacement
allowed rotations
locked neighborhood
stable region
```

---

# 21. Canonical Placement IR

```json
{
  "placement_ir_version": "1.0.0",
  "project": {},
  "board": {},
  "fixed_objects": [],
  "functional_blocks": [],
  "groups": [],
  "relations": [],
  "regions": [],
  "keepouts": [],
  "candidates": [],
  "selected_candidate": {},
  "coverage": {},
  "provenance": {}
}
```

Placement Object：

```text
footprint id
reference
position
rotation
side
lock state
group
region
height
courtyard
3D envelope
placement status
```

---

# 22. Agent 19 操作

```text
move_footprint
rotate_footprint
flip_footprint
lock_footprint
unlock_generated_lock
create_rule_area
create_keepout
update_board_outline
add_text_marker
set_footprint_property
```

写入前置条件：

```text
project revision
placement IR hash
selected candidate hash
constraint IR hash
footprint geometry hash
fixed object hash
no unresolved critical violation
```

写入后置条件：

```text
all target footprints exist
positions/rotations/sides match
fixed objects unchanged
board outline matches approved candidate
rule areas and keepouts exist
no unexpected overlaps
DRC executes
Agent 16 reparse passes
Agent 20 footprint identity remains valid
Agent 24 constraints remain effective
```

---

# 23. Release Gate

## Floorplan Draft

允许：

```text
候选板框
候选分区
局部未合法化
```

## Placement Review

要求：

```text
固定件确认
功能分区确认
关键回路和去耦完成
高压/RF/机械区域完成
候选无 Hard Violation
```

## Routing Start

要求：

```text
Legalized Placement
Constraint Coverage
Congestion acceptable
Critical relations pass
Board outline approved
DRC 可执行
```

## NPI Freeze

要求：

```text
布局批准
全部 Critical/High Finding 关闭
机械和高度检查完成
测试和装配要求完成
Placement Manifest 冻结
```

---

# 24. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RESOLVING_GEOMETRY
→ LOCKING_FIXED_OBJECTS
→ BUILDING_FUNCTIONAL_GRAPH
→ EXTRACTING_CRITICAL_RELATIONS
→ ESTIMATING_BOARD_AREA
→ GENERATING_OUTLINE_CANDIDATES
→ PARTITIONING_FUNCTIONAL_BLOCKS
→ GENERATING_FLOORPLANS
→ PLACING_CRITICAL_GROUPS
→ GLOBAL_PLACEMENT
→ LEGALIZING
→ EVALUATING_CONGESTION
→ EVALUATING_THERMAL
→ EVALUATING_TESTABILITY
→ RANKING_CANDIDATES
→ GENERATING_REVIEW_PACKAGE
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_CANDIDATES
REVIEW_REQUIRED
INPUT_BLOCKED
BOARD_OUTLINE_REQUIRED
FOOTPRINT_GEOMETRY_BLOCKED
MECHANICAL_CONSTRAINT_CONFLICT
NO_LEGAL_FLOORPLAN
NO_LEGAL_PLACEMENT
ROUTING_CONGESTION_BLOCKED
HIGH_VOLTAGE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 25. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT18_RELEASE_TOO_LOW
AGENT18_CONNECTIVITY_BLOCKED
AGENT20_FOOTPRINT_BLOCKED
AGENT20_COURTYARD_BLOCKED
AGENT24_CONSTRAINT_IR_MISSING
BOARD_OUTLINE_MISSING
BOARD_OUTLINE_INVALID
MECHANICAL_PROFILE_MISSING
FIXED_OBJECT_POSITION_MISSING
FIXED_OBJECT_CONFLICT
LOCKED_OBJECT_MOVE_ATTEMPT
FOOTPRINT_GEOMETRY_MISSING
FOOTPRINT_HEIGHT_REQUIRED
COURTYARD_MISSING
KEEP_OUT_CONFLICT
PLACEMENT_REGION_CONFLICT
SIDE_CONSTRAINT_CONFLICT
ORIENTATION_CONSTRAINT_CONFLICT
HEIGHT_CONSTRAINT_CONFLICT
CONNECTOR_OPENING_CONFLICT
MOUNTING_HOLE_CONFLICT
ANTENNA_KEEP_OUT_CONFLICT
HIGH_VOLTAGE_BOUNDARY_CONFLICT
FUNCTIONAL_BLOCK_AMBIGUOUS
CRITICAL_RELATION_CONFLICT
DECOUPLING_ASSIGNMENT_AMBIGUOUS
BOARD_AREA_ESTIMATE_INCOMPLETE
OUTLINE_CANDIDATE_INVALID
SOLVER_UNAVAILABLE
SOLVER_TIMEOUT
NO_FEASIBLE_FLOORPLAN
NO_FEASIBLE_PLACEMENT
LEGALIZATION_FAILED
OVERLAP_REMAINS
COURTYARD_VIOLATION
BOARD_EDGE_VIOLATION
CONGESTION_THRESHOLD_EXCEEDED
BGA_ESCAPE_INFEASIBLE
THERMAL_CONSTRAINT_FAILED
TESTABILITY_CONSTRAINT_FAILED
PLACEMENT_IR_INVALID
AGENT19_EXECUTION_FAILED
POST_WRITE_POSITION_MISMATCH
POST_WRITE_FIXED_OBJECT_MOVED
POST_WRITE_DRC_REGRESSION
JOB_CANCELLED
INTERNAL_ERROR


---

# 26. 数据库设计

## 26.1 `pcb_placement_jobs`

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
agent24_constraint_ir_id UUID NOT NULL
mechanical_profile_id UUID NULL
placement_policy_version VARCHAR NOT NULL
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

## 26.2 `pcb_placement_input_snapshots`

```text
id UUID PK
placement_job_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NOT NULL
agent20_report_hash CHAR(64) NOT NULL
agent21_ir_hash CHAR(64) NULL
agent22_review_hash CHAR(64) NULL
agent23_result_hash CHAR(64) NULL
agent24_constraint_hash CHAR(64) NOT NULL
mechanical_profile_hash CHAR(64) NULL
existing_placement_hash CHAR(64) NOT NULL
placement_policy_hash CHAR(64) NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, snapshot_hash)
```

## 26.3 `pcb_mechanical_profiles`

```text
id UUID PK
tenant_id UUID NULL
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
board_outline JSONB NULL
cutouts JSONB NOT NULL
mounting_features JSONB NOT NULL
connector_openings JSONB NOT NULL
enclosure_volumes JSONB NOT NULL
height_zones JSONB NOT NULL
cable_zones JSONB NOT NULL
airflow JSONB NOT NULL
panel_requirements JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 26.4 `pcb_footprint_geometry_snapshots`

```text
id UUID PK
placement_job_id UUID NOT NULL
footprint_id UUID NOT NULL
reference_designator VARCHAR NOT NULL
footprint_library_id VARCHAR NOT NULL
footprint_hash CHAR(64) NOT NULL
body_bounds JSONB NOT NULL
pad_bounds JSONB NOT NULL
courtyard_bounds JSONB NULL
fabrication_bounds JSONB NULL
silkscreen_bounds JSONB NULL
envelope_3d JSONB NULL
height JSONB NULL
rotation_origin JSONB NOT NULL
allowed_rotations JSONB NOT NULL
allowed_sides JSONB NOT NULL
assembly_clearance JSONB NULL
rework_clearance JSONB NULL
geometry_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, footprint_id)
```

## 26.5 `pcb_placement_objects`

```text
id UUID PK
placement_job_id UUID NOT NULL
object_type VARCHAR NOT NULL
source_entity_id UUID NULL
reference_key VARCHAR NOT NULL
mobility_status VARCHAR NOT NULL
current_position JSONB NULL
current_rotation NUMERIC NULL
current_side VARCHAR NULL
lock_reason VARCHAR NULL
movement_tolerance JSONB NULL
mechanical_reference JSONB NULL
priority INT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, reference_key)
```

## 26.6 `pcb_fixed_object_constraints`

```text
id UUID PK
placement_job_id UUID NOT NULL
placement_object_id UUID NOT NULL
position_constraint JSONB NOT NULL
rotation_constraint JSONB NOT NULL
side_constraint JSONB NOT NULL
tolerance JSONB NOT NULL
source_reference JSONB NOT NULL
hard_constraint BOOLEAN NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.7 `pcb_functional_blocks`

```text
id UUID PK
placement_job_id UUID NOT NULL
block_key VARCHAR NOT NULL
block_type VARCHAR NOT NULL
member_object_ids JSONB NOT NULL
external_interfaces JSONB NOT NULL
power_domains JSONB NOT NULL
preferred_region JSONB NULL
orientation_intent JSONB NULL
resolution_method VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, block_key)
```

## 26.8 `pcb_placement_groups`

```text
id UUID PK
placement_job_id UUID NOT NULL
group_key VARCHAR NOT NULL
group_type VARCHAR NOT NULL
member_object_ids JSONB NOT NULL
hard_or_soft VARCHAR NOT NULL
internal_order JSONB NOT NULL
orientation_constraints JSONB NOT NULL
same_side_constraint JSONB NULL
maximum_span JSONB NULL
region_constraint JSONB NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, group_key)
```

## 26.9 `pcb_placement_relations`

```text
id UUID PK
placement_job_id UUID NOT NULL
relation_type VARCHAR NOT NULL
subject_reference JSONB NOT NULL
object_reference JSONB NOT NULL
numeric_limits JSONB NULL
qualitative_requirement TEXT NULL
hard_constraint BOOLEAN NOT NULL
priority INT NOT NULL
source_reference JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.10 `pcb_placement_regions`

```text
id UUID PK
placement_job_id UUID NOT NULL
region_key VARCHAR NOT NULL
region_type VARCHAR NOT NULL
geometry JSONB NOT NULL
layer_or_side_scope JSONB NOT NULL
allowed_object_types JSONB NOT NULL
disallowed_object_types JSONB NOT NULL
density_limit JSONB NULL
height_limit JSONB NULL
thermal_attributes JSONB NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, region_key)
```

## 26.11 `pcb_placement_keepouts`

```text
id UUID PK
placement_job_id UUID NOT NULL
keepout_key VARCHAR NOT NULL
geometry JSONB NOT NULL
side_or_layer_scope JSONB NOT NULL
disallowed_objects JSONB NOT NULL
allowed_exceptions JSONB NOT NULL
source_reference JSONB NOT NULL
hard_constraint BOOLEAN NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, keepout_key)
```

## 26.12 `pcb_decoupling_assignments`

```text
id UUID PK
placement_job_id UUID NOT NULL
consumer_part_id UUID NOT NULL
power_pin_ids JSONB NOT NULL
power_rail_id UUID NULL
capacitor_part_id UUID NOT NULL
ground_net_id UUID NULL
assignment_priority INT NOT NULL
distance_budget JSONB NULL
side_preference VARCHAR NULL
via_budget JSONB NULL
shared_status VARCHAR NOT NULL
assignment_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.13 `pcb_critical_loops`

```text
id UUID PK
placement_job_id UUID NOT NULL
loop_key VARCHAR NOT NULL
loop_type VARCHAR NOT NULL
member_part_ids JSONB NOT NULL
member_net_ids JSONB NOT NULL
ordered_path JSONB NOT NULL
loop_cost_policy JSONB NOT NULL
region_constraints JSONB NULL
source_reference JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, loop_key)
```

## 26.14 `pcb_board_area_estimates`

```text
id UUID PK
placement_job_id UUID NOT NULL
estimate_version INT NOT NULL
component_area JSONB NOT NULL
courtyard_area JSONB NOT NULL
routing_area JSONB NOT NULL
keepout_area JSONB NOT NULL
mechanical_reserve JSONB NOT NULL
thermal_reserve JSONB NOT NULL
test_reserve JSONB NOT NULL
manufacturing_reserve JSONB NOT NULL
uncertainty_margin JSONB NOT NULL
minimum_area JSONB NOT NULL
recommended_area JSONB NOT NULL
low_risk_area JSONB NOT NULL
utilization_metrics JSONB NOT NULL
limiting_factors JSONB NOT NULL
confidence NUMERIC(5,4) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, estimate_version)
```

## 26.15 `pcb_outline_candidates`

```text
id UUID PK
placement_job_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
outline_type VARCHAR NOT NULL
geometry JSONB NOT NULL
area JSONB NOT NULL
aspect_ratio NUMERIC NOT NULL
fixed_object_compatibility JSONB NOT NULL
panel_compatibility JSONB NOT NULL
mechanical_violations JSONB NOT NULL
risk_level VARCHAR NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, candidate_key)
```

## 26.16 `pcb_floorplan_candidates`

```text
id UUID PK
placement_job_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
outline_candidate_id UUID NOT NULL
solver_name VARCHAR NOT NULL
solver_version VARCHAR NOT NULL
seed BIGINT NOT NULL
time_budget_ms BIGINT NOT NULL
block_regions JSONB NOT NULL
group_centers JSONB NOT NULL
routing_corridors JSONB NOT NULL
thermal_zones JSONB NOT NULL
isolation_zones JSONB NOT NULL
hard_violation_count INT NOT NULL
score_breakdown JSONB NOT NULL
candidate_hash CHAR(64) NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, candidate_key)
```

## 26.17 `pcb_placement_candidates`

```text
id UUID PK
placement_job_id UUID NOT NULL
floorplan_candidate_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
solver_name VARCHAR NOT NULL
solver_version VARCHAR NOT NULL
seed BIGINT NOT NULL
placement_uri TEXT NOT NULL
placement_hash CHAR(64) NOT NULL
hard_violation_count INT NOT NULL
legalization_status VARCHAR NOT NULL
score_breakdown JSONB NOT NULL
pareto_rank INT NULL
movement_summary JSONB NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, candidate_key)
```

## 26.18 `pcb_candidate_object_positions`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
placement_object_id UUID NOT NULL
position_x NUMERIC NOT NULL
position_y NUMERIC NOT NULL
rotation NUMERIC NOT NULL
side VARCHAR NOT NULL
region_id UUID NULL
lock_state VARCHAR NOT NULL
move_reason JSONB NOT NULL
object_score JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_candidate_id, placement_object_id)
```

## 26.19 `pcb_placement_legalization_runs`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
legalizer_name VARCHAR NOT NULL
legalizer_version VARCHAR NOT NULL
status VARCHAR NOT NULL
initial_overlap_count INT NOT NULL
remaining_overlap_count INT NOT NULL
board_edge_violation_count INT NOT NULL
keepout_violation_count INT NOT NULL
courtyard_violation_count INT NOT NULL
repair_moves JSONB NOT NULL
trace_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 26.20 `pcb_congestion_estimates`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
grid_definition JSONB NOT NULL
layer_assumptions JSONB NOT NULL
global_demand JSONB NOT NULL
regional_overflow JSONB NOT NULL
pin_escape_pressure JSONB NOT NULL
via_pressure JSONB NOT NULL
critical_corridors JSONB NOT NULL
congestion_map_uri TEXT NOT NULL
congestion_map_hash CHAR(64) NOT NULL
overall_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.21 `pcb_thermal_placement_estimates`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
power_sources JSONB NOT NULL
temperature_sensitive_objects JSONB NOT NULL
airflow_assumptions JSONB NOT NULL
thermal_spread_metrics JSONB NOT NULL
hotspot_candidates JSONB NOT NULL
thermal_reserve_status VARCHAR NOT NULL
overall_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.22 `pcb_testability_estimates`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
test_connector_access JSONB NOT NULL
probe_access JSONB NOT NULL
fixture_approach JSONB NOT NULL
programming_access JSONB NOT NULL
rework_access JSONB NOT NULL
overall_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 26.23 `pcb_candidate_scores`

```text
id UUID PK
placement_candidate_id UUID NOT NULL
hard_gate_status VARCHAR NOT NULL
mechanical_score NUMERIC NULL
safety_score NUMERIC NULL
critical_relation_score NUMERIC NULL
decoupling_score NUMERIC NULL
power_loop_score NUMERIC NULL
clock_score NUMERIC NULL
routing_score NUMERIC NULL
escape_score NUMERIC NULL
thermal_score NUMERIC NULL
analog_isolation_score NUMERIC NULL
testability_score NUMERIC NULL
manufacturing_score NUMERIC NULL
movement_score NUMERIC NULL
area_score NUMERIC NULL
objective_vector JSONB NOT NULL
pareto_rank INT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_candidate_id)
```

## 26.24 `pcb_placement_ir_versions`

```text
id UUID PK
placement_job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
selected_candidate_id UUID NULL
object_count INT NOT NULL
group_count INT NOT NULL
relation_count INT NOT NULL
region_count INT NOT NULL
keepout_count INT NOT NULL
placement_ir_uri TEXT NOT NULL
placement_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, ir_version)
```

## 26.25 `pcb_placement_change_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
placement_job_id UUID NOT NULL
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
UNIQUE(placement_job_id, plan_version)
```

## 26.26 `pcb_placement_post_write_runs`

```text
id UUID PK
change_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
pre_placement_job_id UUID NOT NULL
post_placement_job_id UUID NULL
position_readback_summary JSONB NOT NULL
fixed_object_regression JSONB NOT NULL
geometry_regression JSONB NOT NULL
constraint_coverage_summary JSONB NOT NULL
drc_summary JSONB NOT NULL
congestion_summary JSONB NOT NULL
rollback_status VARCHAR NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 26.27 `pcb_placement_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
placement_ir_hash CHAR(64) NOT NULL
selected_candidate_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, project_revision)
```

## 26.28 `pcb_placement_waivers`

```text
id UUID PK
tenant_id UUID NOT NULL
placement_job_id UUID NULL
placement_candidate_id UUID NULL
scope JSONB NOT NULL
reason TEXT NOT NULL
evidence_ids JSONB NOT NULL
effective_revision VARCHAR NULL
expires_at TIMESTAMPTZ NULL
approved_by UUID NOT NULL
approved_at TIMESTAMPTZ NOT NULL
status VARCHAR NOT NULL
```

## 26.29 `pcb_placement_release_gate_runs`

```text
id UUID PK
placement_job_id UUID NOT NULL
gate_profile VARCHAR NOT NULL
gate_profile_version VARCHAR NOT NULL
status VARCHAR NOT NULL
hard_violation_count INT NOT NULL
legalization_status VARCHAR NOT NULL
congestion_status VARCHAR NOT NULL
thermal_status VARCHAR NOT NULL
testability_status VARCHAR NOT NULL
drc_violation_count INT NOT NULL
blocking_reasons JSONB NOT NULL
result_uri TEXT NOT NULL
result_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 26.30 `pcb_placement_reports`

```text
id UUID PK
placement_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
input_quality_status VARCHAR NOT NULL
geometry_status VARCHAR NOT NULL
candidate_count INT NOT NULL
selected_candidate_id UUID NULL
constraint_coverage NUMERIC NULL
congestion_score NUMERIC NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(placement_job_id, report_version)
```

---

# 27. 对象存储

```text
derived/pcb-placement/
  {tenant_id}/{project_id}/
    jobs/
      {placement_job_id}/
        input/
          input-snapshot.json
          mechanical-profile.json
          source-ir-manifest.json
          existing-placement.json
          placement-policy.json
        geometry/
          footprint-geometry.jsonl.zst
          3d-envelopes/
          mechanical-envelopes/
        context/
          functional-blocks.jsonl.zst
          placement-groups.jsonl.zst
          critical-relations.jsonl.zst
          decoupling-assignments.jsonl.zst
          critical-loops.jsonl.zst
          regions.jsonl.zst
          keepouts.jsonl.zst
        estimates/
          board-area.json
          outline-candidates.jsonl.zst
          routing-demand.json
          thermal-demand.json
        candidates/
          floorplans/
          placements/
          legalization/
          congestion/
          thermal/
          testability/
          scores/
        ir/
          placement-ir.json
          placement-manifest.json
        changes/
          agent19-plan.json
          preview/
          execution/
        validation/
          readback/
          geometry/
          constraint-coverage/
          drc/
          congestion/
        reports/
          placement-report.html
          placement-report.pdf
          candidate-comparison.csv
          area-estimate.csv
          critical-relations.csv
          placement-diff.csv
          release-gate.json
        debug/
          partition-trace.jsonl.zst
          solver-trace.jsonl.zst
          legalization-trace.jsonl.zst
          scoring-trace.jsonl.zst
          resource-usage.json
```

---

# 28. API 设计

## 28.1 Jobs

```text
POST /api/v1/pcb-placement/jobs
POST /api/v1/pcb-placement/jobs/batch
GET  /api/v1/pcb-placement/jobs/{id}
GET  /api/v1/pcb-placement/jobs/{id}/events
POST /api/v1/pcb-placement/jobs/{id}/cancel
POST /api/v1/pcb-placement/jobs/{id}/retry
POST /api/v1/pcb-placement/jobs/{id}/rerun
```

## 28.2 Geometry and Mechanical

```text
GET  /api/v1/pcb-placement/jobs/{id}/geometry
GET  /api/v1/pcb-placement/jobs/{id}/mechanical
POST /api/v1/pcb-placement/jobs/{id}/validate-geometry
POST /api/v1/pcb-placement/jobs/{id}/lock-fixed-objects
GET  /api/v1/pcb-placement/jobs/{id}/fixed-objects
```

## 28.3 Context

```text
POST /api/v1/pcb-placement/jobs/{id}/build-context
GET  /api/v1/pcb-placement/jobs/{id}/functional-blocks
GET  /api/v1/pcb-placement/jobs/{id}/groups
GET  /api/v1/pcb-placement/jobs/{id}/relations
GET  /api/v1/pcb-placement/jobs/{id}/regions
GET  /api/v1/pcb-placement/jobs/{id}/keepouts
GET  /api/v1/pcb-placement/jobs/{id}/decoupling
```

## 28.4 Area and Floorplan

```text
POST /api/v1/pcb-placement/jobs/{id}/estimate-area
GET  /api/v1/pcb-placement/jobs/{id}/area-estimate
POST /api/v1/pcb-placement/jobs/{id}/generate-outlines
GET  /api/v1/pcb-placement/jobs/{id}/outline-candidates
POST /api/v1/pcb-placement/jobs/{id}/generate-floorplans
GET  /api/v1/pcb-placement/jobs/{id}/floorplans
```

## 28.5 Placement

```text
POST /api/v1/pcb-placement/jobs/{id}/generate-candidates
GET  /api/v1/pcb-placement/jobs/{id}/candidates
GET  /api/v1/pcb-placement/candidates/{id}
POST /api/v1/pcb-placement/candidates/{id}/legalize
POST /api/v1/pcb-placement/candidates/{id}/evaluate
POST /api/v1/pcb-placement/candidates/{id}/pin-object
POST /api/v1/pcb-placement/candidates/{id}/adjust-region
POST /api/v1/pcb-placement/jobs/{id}/reoptimize
```

## 28.6 Evaluation

```text
GET  /api/v1/pcb-placement/candidates/{id}/scores
GET  /api/v1/pcb-placement/candidates/{id}/congestion
GET  /api/v1/pcb-placement/candidates/{id}/thermal
GET  /api/v1/pcb-placement/candidates/{id}/testability
GET  /api/v1/pcb-placement/jobs/{id}/pareto
POST /api/v1/pcb-placement/jobs/{id}/select-candidate
```

## 28.7 Agent 19

```text
POST /api/v1/pcb-placement/jobs/{id}/change-plan
GET  /api/v1/pcb-placement/change-plans/{id}
POST /api/v1/pcb-placement/change-plans/{id}/preview
POST /api/v1/pcb-placement/change-plans/{id}/approve
POST /api/v1/pcb-placement/change-plans/{id}/submit-to-agent19
GET  /api/v1/pcb-placement/post-write-runs/{id}
```

## 28.8 Baseline and Release

```text
POST /api/v1/pcb-placement/jobs/{id}/baseline
POST /api/v1/pcb-placement/jobs/{id}/compare-baseline
POST /api/v1/pcb-placement/jobs/{id}/run-release-gate
GET  /api/v1/pcb-placement/jobs/{id}/release-gate
GET  /api/v1/pcb-placement/jobs/{id}/report
GET  /api/v1/pcb-placement/jobs/{id}/candidate-comparison.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 29. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
firmware.configuration.ready
schematic-review.completed
simulation.completed
pcb-constraints.constraint-ir-ready
kicad.project-revision.ready
mechanical.profile.approved
pcb-placement.requested
```

## 输出事件

```text
pcb-placement.input-blocked
pcb-placement.geometry-review-required
pcb-placement.mechanical-conflict-detected
pcb-placement.area-estimate-ready
pcb-placement.floorplan-candidates-ready
pcb-placement.no-feasible-floorplan
pcb-placement.candidates-ready
pcb-placement.congestion-blocked
pcb-placement.review-required
pcb-placement.change-plan-ready
pcb-placement.post-write-validated
pcb-placement.release-gate-blocked
pcb-placement.completed
pcb-placement.failed
```

---

# 30. Policy 组织

```text
policies/
├── pcb-placement-1.0.0.yaml
├── input-gates.yaml
├── geometry/
│   ├── courtyard.yaml
│   ├── height.yaml
│   ├── envelopes.yaml
│   └── fixed-objects.yaml
├── clustering/
│   ├── functional-blocks.yaml
│   ├── hypergraph-weights.yaml
│   └── group-rules.yaml
├── critical/
│   ├── decoupling.yaml
│   ├── power-loops.yaml
│   ├── crystal.yaml
│   ├── interfaces.yaml
│   ├── analog.yaml
│   ├── rf.yaml
│   └── high-voltage.yaml
├── area/
│   ├── utilization.yaml
│   ├── routing-reserve.yaml
│   ├── mechanical-reserve.yaml
│   └── uncertainty.yaml
├── solvers/
│   ├── partition.yaml
│   ├── floorplan.yaml
│   ├── global-placement.yaml
│   ├── legalization.yaml
│   └── admission.yaml
├── objectives/
│   ├── lexicographic.yaml
│   ├── scores.yaml
│   ├── congestion.yaml
│   ├── thermal.yaml
│   └── testability.yaml
├── incremental.yaml
├── agent19.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 31. Solver Interface

```python
class PlacementSolver:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate(self, problem) -> ValidationResult: ...
    async def solve(self, problem, seed, time_budget) -> CandidateSet: ...
    async def explain(self, candidate) -> SolverTrace: ...
```

能力：

```text
partition
floorplan
global placement
critical-group placement
legalization
local search
incremental placement
```

---

# 32. Solver Admission

保存：

```text
solver name/version
problem sizes
supported constraints
determinism
seed support
time limit
license
validation fixtures
approval status
```

`unknown` 不视为支持。

---

# 33. Objective Engine

要求：

- Hard Constraint 独立；
- Lexicographic 和 Weighted Objective 都支持；
- 每个 Cost 有版本；
- 支持归一化；
- 支持约束范围；
- 保存每个对象/关系的贡献；
- 支持权重 Dry Run；
- 禁止用高权重覆盖 Hard Constraint。

---

# 34. 可观测性

```text
pcb_placement_jobs_total{status}
pcb_placement_duration_seconds{step}
pcb_placement_geometry_blocks_total{reason}
pcb_placement_fixed_objects_total{type}
pcb_placement_functional_blocks_total{type}
pcb_placement_relations_total{type,hard}
pcb_placement_candidates_total{solver,status}
pcb_placement_solver_duration_seconds{solver,stage}
pcb_placement_legalization_violations_total{type}
pcb_placement_congestion_overflow_total
pcb_placement_bga_escape_blocks_total
pcb_placement_post_write_runs_total{status}
pcb_placement_release_gate_blocks_total{reason}
```

---

# 35. Dashboard

```text
Projects
Geometry Readiness
Fixed/Locked Objects
Functional Blocks
Critical Relations
Area Estimates
Outline Candidates
Floorplans
Placement Candidates
Pareto Comparison
Congestion
Thermal
Testability
Constraint Coverage
DRC
Release Readiness
```

---

# 36. 安全与权限

- 工程、机械、布局候选和报告按租户/项目隔离；
- 机械 CAD、外壳和客户尺寸使用最小访问；
- Solver、Policy 和 Geometry Parser 需要版本、Hash 和批准状态；
- 不执行机械文件、EDA 文件和压缩包内脚本；
- Solver Worker 限制 CPU、内存、磁盘和网络；
- 不接受 AI 直接输出坐标后写入；
- Agent 19 写入权限与布局审核权限分开；
- Board Outline、固定件、高压区域变更支持双人审批；
- 写入前保存完整工程 Snapshot；
- 不在日志输出私有坐标、机械路径和 Secret；
- 不把工程、布局和机械信息发送给外部模型；
- 公开 Fixture 仅使用开源、合成、脱敏或授权数据；
- Baseline、Manifest、Waiver、Release Gate 不可硬删除。

---

# 37. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
Polars
PyArrow
DuckDB
Shapely or equivalent geometry kernel
OR-Tools CP-SAT
optional MILP backend
optional hypergraph partitioner
NumPy/SciPy
```

前端：

```text
React
TypeScript
Canvas/WebGL
PCB/3D Viewer
Congestion Heatmap
Candidate Comparison
```

---

# 38. 推荐仓库结构

```text
pcb-placement-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── pcb-placement-agent-spec.md
│   ├── input-and-geometry-gates.md
│   ├── mechanical-constraint-model.md
│   ├── footprint-geometry-model.md
│   ├── functional-clustering.md
│   ├── critical-placement-relations.md
│   ├── board-area-estimation.md
│   ├── floorplanning.md
│   ├── placement-optimization.md
│   ├── legalization.md
│   ├── congestion-and-escape.md
│   ├── thermal-and-testability.md
│   ├── incremental-placement.md
│   ├── placement-ir.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-mechanical-facts-precede-electrical-optimization.md
│       ├── 0002-hard-constraints-are-not-objective-weights.md
│       ├── 0003-floorplan-before-component-placement.md
│       ├── 0004-multiple-pareto-candidates.md
│       ├── 0005-legalization-is-not-routability.md
│       ├── 0006-incremental-placement-preserves-stability.md
│       └── 0007-writes-run-through-agent19.md
├── src/
│   └── pcb_placement/
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
│       │   └── agent24.py
│       ├── geometry/
│       │   ├── footprints.py
│       │   ├── courtyards.py
│       │   ├── envelopes.py
│       │   ├── board.py
│       │   ├── keepouts.py
│       │   └── collision.py
│       ├── mechanical/
│       │   ├── profiles.py
│       │   ├── fixed_objects.py
│       │   ├── connectors.py
│       │   ├── enclosure.py
│       │   ├── cables.py
│       │   └── height.py
│       ├── context/
│       │   ├── blocks.py
│       │   ├── hypergraph.py
│       │   ├── groups.py
│       │   ├── relations.py
│       │   ├── decoupling.py
│       │   ├── power.py
│       │   ├── analog.py
│       │   ├── rf.py
│       │   └── high_voltage.py
│       ├── area/
│       │   ├── estimator.py
│       │   ├── utilization.py
│       │   ├── reserves.py
│       │   └── outlines.py
│       ├── solvers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── partition.py
│       │   ├── bstar.py
│       │   ├── sequence_pair.py
│       │   ├── cpsat.py
│       │   ├── annealing.py
│       │   ├── analytic.py
│       │   ├── local_search.py
│       │   └── incremental.py
│       ├── objectives/
│       │   ├── hard.py
│       │   ├── wirelength.py
│       │   ├── critical.py
│       │   ├── congestion.py
│       │   ├── thermal.py
│       │   ├── testability.py
│       │   ├── movement.py
│       │   └── aggregate.py
│       ├── legalization/
│       │   ├── snap.py
│       │   ├── containment.py
│       │   ├── overlaps.py
│       │   ├── keepouts.py
│       │   ├── orientation.py
│       │   └── compaction.py
│       ├── evaluation/
│       │   ├── congestion.py
│       │   ├── escape.py
│       │   ├── thermal.py
│       │   ├── testability.py
│       │   ├── manufacturability.py
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
├── mechanical-profiles/
├── solver-profiles/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_placement_readiness.py
    ├── build_placement_context.py
    ├── estimate_board_area.py
    ├── generate_floorplans.py
    ├── generate_placement_candidates.py
    ├── legalize_placement.py
    ├── evaluate_congestion.py
    ├── compare_candidates.py
    ├── submit_placement_to_agent19.py
    └── run_placement_benchmark.py
```


---

# 39. Codex 分阶段实施

不要让 Codex 一次实现机械解析、功能聚类、五种求解器、面积估算、拥塞、热、测试、KiCad 写入和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16–24 的真实实现和数据契约；
2. 当前 PCB IR、Footprint、Pad、Board Outline、Cutout 和 Existing Placement；
3. 当前 Footprint Courtyard、3D、Height、Allowed Rotation 和 Side；
4. 当前固定/锁定器件和机械对象；
5. 当前连接器、安装孔、显示屏、按键、天线、外壳和线束数据；
6. 当前功能块、Net Graph、Hypergraph 和器件角色；
7. 当前去耦、电源树、Hot Loop、晶振、反馈和接口保护关系；
8. 当前 Agent 24 Placement/Keepout/High-voltage Constraint；
9. 当前板面积估算和 Outline 生成；
10. 当前器件布局、重叠检测和合法化；
11. 当前 CP-SAT、MILP、退火、局部搜索和 Floorplan 算法；
12. 当前 HPWL、拥塞、BGA Escape、Via Pressure；
13. 当前热和可测试性评估；
14. 当前 KiCad Footprint Move/Rotate/Flip/Lock；
15. 当前 Agent 19 Workspace、Preview、Readback 和 Rollback；
16. 当前 DRC、约束覆盖和布线可行性；
17. 当前 Placement UI、2D/3D Viewer 和 Heatmap；
18. 当前 Queue、Worker、Database、Object Storage 和权限；
19. 当前开源、合成、脱敏或授权 Fixture；
20. 统计 Footprint Geometry、Courtyard 和 Height 覆盖；
21. 统计固定件、功能块和关键关系覆盖；
22. 统计重叠、不可合法化、拥塞和 DRC 问题；
23. 只运行只读扫描和版本探测；
24. 不移动器件；
25. 不修改板框；
26. 不写入生产工程；
27. 不调用外部模型；
28. 不创建 Migration；
29. 不安装 Solver；
30. 不读取或打印 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Placement Job；
- Input Snapshot；
- Mechanical Profile；
- Footprint Geometry；
- Placement Object；
- Fixed Constraint；
- Functional Block；
- Placement Group；
- Relation；
- Region；
- Keepout；
- Decoupling Assignment；
- Critical Loop；
- Area Estimate；
- Outline Candidate；
- Floorplan Candidate；
- Placement Candidate；
- Position；
- Legalization；
- Congestion；
- Thermal；
- Testability；
- Score；
- Placement IR；
- Change Plan；
- Release Gate；
- JSON Schema。

## Phase 2：Agent 16–24 Input Gate

实现：

- Project Revision；
- Reviewed Netlist；
- Footprint/Pin-Pad/Courtyard Gate；
- Agent 21 功能配置；
- Agent 22 关键关系；
- Agent 23 仿真结果；
- Agent 24 Constraint IR；
- Mechanical Profile；
- Existing Placement；
- Snapshot Hash；
- Blocked/Candidate/Ready。

## Phase 3：Geometry Kernel

实现：

- Polygon；
- Bounding Box；
- Transform；
- Rotation；
- Flip；
- Courtyard；
- Board Containment；
- Cutout；
- Keepout；
- Collision；
- Distance；
- Stable Units；
- Property Tests。

## Phase 4：Footprint Geometry Snapshot

实现：

- Body/Pad/Courtyard/Fab/Silk；
- 3D Envelope；
- Height；
- Rotation Origin；
- Allowed Rotation/Side；
- Assembly/Rework Clearance；
- Missing/Conflict；
- Hash；
- Cache。

## Phase 5：Mechanical Profile 和 Fixed Objects

实现：

- Board Outline；
- Cutout；
- Mounting Hole；
- Connector Opening；
- Enclosure；
- Height Zone；
- Cable Zone；
- Tool Access；
- Panel Rail；
- Fixed/Semi-fixed；
- Tolerance；
- Review。

## Phase 6：Circuit Context 和 Functional Blocks

实现：

- Part/Footprint Role；
- Power Domain；
- Interface；
- Signal Direction；
- Functional Block；
- Block Confidence；
- User Override；
- Stable Grouping；
- Incremental Invalidation。

## Phase 7：Hypergraph 和 Placement Group

实现：

- Footprint Nodes；
- Net/Bus/Diff/Power Hyperedges；
- Edge Weights；
- Placement Groups；
- Internal Order；
- Same-side；
- Maximum Span；
- Region；
- Group Review。

## Phase 8：Critical Relation Extraction

实现：

- Near/Far/Between/Align/Face/Symmetric；
- Signal/Power Flow；
- Decoupling；
- Crystal；
- Feedback；
- Hot Loop；
- Interface Protection；
- Analog；
- RF；
- High Voltage；
- Evidence；
- Hard/Soft。

## Phase 9：Decoupling Assignment

实现：

- Power Pin-to-Capacitor；
- Rail；
- Ground Return；
- Priority；
- Shared/Exclusive；
- Same-side；
- Via Budget；
- Ambiguous Assignment；
- Cost；
- Golden Tests。

## Phase 10：Board Area Estimator

实现：

- Effective Block Area；
- Courtyard；
- Routing Reserve；
- Keepout；
- Mechanical；
- Thermal；
- Test；
- Manufacturing；
- Uncertainty；
- Minimum/Recommended/Low-risk；
- Confidence；
- Limiting Factors。

## Phase 11：Outline Candidate Generator

实现：

- Fixed Outline；
- Rectangle/Rounded Rectangle；
- Mechanical Template；
- Connector-driven；
- Mounting-hole；
- Aspect Ratio；
- Edge Reserve；
- Panel Compatibility；
- Risk；
- Approval Gate。

## Phase 12：Functional Partition Solver

实现：

- Rule-seeded Clustering；
- Hypergraph Partitioning Adapter；
- Balance；
- Cut Cost；
- Fixed-region Constraint；
- Power/Analog/RF/HV Separation；
- Multiple Candidates；
- Deterministic Seed。

## Phase 13：Block Floorplan Solver

实现：

- Region Assignment；
- B*-tree/Sequence Pair；
- CP-SAT Candidate；
- Fixed Objects；
- Board Outline；
- Block Area；
- Routing Corridor；
- Hard Constraint；
- Multi-start；
- Trace。

## Phase 14：Critical-group Placement

实现：

- Decoupling；
- Hot Loop；
- Crystal；
- Interface Protection；
- Termination；
- Memory/Processor；
- ADC/Reference；
- RF Feed；
- Isolation Crossing；
- Group Templates；
- Candidate Set。

## Phase 15：Global Placement Solver

实现：

- Analytic/Force Candidate；
- Simulated Annealing；
- Local Search；
- Warm Start；
- Existing Placement Seed；
- Time Budget；
- Deterministic Seed；
- Candidate Pool；
- No Hard Violation Acceptance。

## Phase 16：Objective Engine

实现：

- HPWL/Weighted HPWL；
- Critical Relation；
- Loop Proxy；
- Decoupling；
- Clock；
- Analog Isolation；
- HV；
- Area；
- Movement；
- Normalization；
- Lexicographic；
- Score Trace；
- Weight Dry Run。

## Phase 17：Legalization

实现：

- Snap；
- Containment；
- Fixed Preservation；
- Overlap Removal；
- Courtyard；
- Keepout；
- Side/Rotation；
- Local Compaction；
- Failure Trace；
- Legalization Gate。

## Phase 18：Congestion 和 Routing Demand

实现：

- Grid Bins；
- Pin Demand；
- Net Demand；
- Layer Assumption；
- Keepout；
- Routing Corridor；
- Overflow；
- Heatmap；
- Critical Corridor；
- Threshold Gate。

## Phase 19：BGA/Connector Escape

实现：

- Pad Pitch；
- Escape Rows；
- Via Technology；
- Layer Count；
- Fanout Direction；
- Nearby Blocker；
- Connector Fanout；
- Escape Pressure；
- Candidate Warning；
- No Detailed Routing Claim。

## Phase 20：Thermal Placement Evaluation

实现：

- Power Sources；
- Heat-sensitive Devices；
- Airflow；
- Spreading；
- Heatsink/Copper Reserve；
- Hotspot Candidate；
- Thermal Score；
- Missing-data Status；
- No Fake Temperature。

## Phase 21：Testability/Manufacturability

实现：

- Probe Access；
- Test Connector；
- Programming；
- Fixture Direction；
- Rework；
- Pick-and-Place；
- Courtyard；
- Fiducial/Panel Reserve；
- Score；
- Findings。

## Phase 22：Pareto Ranking 和 Candidate Explanation

实现：

- Hard Gate；
- Objective Vector；
- Dominance；
- Pareto Rank；
- Balanced Candidate；
- Specialized Candidates；
- Move Reasons；
- Candidate Diff；
- Human-readable Summary。

## Phase 23：Incremental Placement

实现：

- New/Removed Part；
- Footprint Change；
- Constraint Change；
- Region Invalidation；
- Movement Budget；
- Preserve Approved Region；
- Partial Re-layout；
- Stable IDs；
- Diff；
- Regression。

## Phase 24：Placement IR

实现：

- Selected Candidate；
- Objects；
- Blocks；
- Relations；
- Regions；
- Keepouts；
- Metrics；
- Provenance；
- Stable Serialization；
- Manifest；
- Schema Validation。

## Phase 25：Agent 19 Adapter

实现：

- Placement IR → Change Plan；
- Move/Rotate/Flip/Lock；
- Rule Area/Keepout；
- Board Outline High-risk Patch；
- Workspace；
- Preview；
- Approval；
- Idempotency；
- Rollback。

## Phase 26：Post-write Verification

实现：

- Position/Rotation/Side Readback；
- Fixed Object Regression；
- Geometry；
- Agent 20；
- Agent 24 Coverage；
- DRC；
- Congestion Re-evaluation；
- Unexpected Move；
- Commit/Rollback Recommendation。

## Phase 27：Review Workbench

实现：

- 2D Board；
- 3D Envelope；
- Fixed/Movable；
- Blocks；
- Relations；
- Area/Outline；
- Candidate Comparison；
- Congestion Heatmap；
- Thermal/Test；
- Violations；
- Pin/Move/Re-optimize；
- Diff/Approval。

## Phase 28：Baseline、Waiver、CI 和 Release Gate

实现：

- Baseline；
- New/Worsened；
- Waiver Scope/Expiry；
- CLI；
- Gate Profiles；
- Immutable Manifest；
- Git Integration；
- Exit Codes；
- Events。

## Phase 29：API、Jobs、Events 和 Storage

实现：

- APIs；
- Batch；
- Progress；
- Cancel/Retry；
- Object Storage；
- Pagination；
- Permissions；
- Audit；
- Metrics；
- Candidate Artifact Lifecycle。

## Phase 30：Benchmark、监控和生产发布

实现：

- Golden Boards；
- Algorithm Matrix；
- Geometry；
- Fixed Objects；
- Critical Loops；
- Floorplan；
- Legalization；
- Congestion；
- Incremental；
- Security；
- Performance；
- Feature Flags；
- Solver Rollback；
- Disaster Recovery。

## Phase 31：高级能力，可选

稳定后：

- Multi-board Floorplan；
- Rigid-flex；
- HDI Escape-aware Placement；
- Shield Can；
- Detailed Thermal Solver Handoff；
- Detailed Router Feedback；
- Mechanical CAD Round-trip；
- Reinforcement Learning 仅作候选；
- 仍不自动宣称生产布局完成。

---

# 40. Codex 工作纪律

Codex 必须：

1. Mechanical Facts、Electrical Relations、Optimization 和 EDA Write 分层；
2. Input Snapshot 不可变；
3. Agent 18/20/24 Gate；
4. 原理图坐标不映射 PCB；
5. Fixed/Locked 不可移动；
6. Semi-fixed 只能在许可域移动；
7. Footprint Geometry 有 Hash；
8. Courtyard 不存在时不假造；
9. 3D/Height 缺失时报告不确定；
10. 连接器方向和外壳开口是 Hard Constraint；
11. Board Outline 修改高风险；
12. 功能聚类有证据；
13. 用户定义 Block 优先保留；
14. 去耦建立显式分配；
15. 不把所有相同值电容互换；
16. Hot Loop 用专用 Cost；
17. Crystal/Feedback/Protection 用专用关系；
18. High Voltage 和 Antenna 区域 Hard Gate；
19. “Near/Far”未量化保持 Qualitative；
20. Board Area 不仅求 Footprint 面积；
21. Area Estimate 给不确定度；
22. Hard Constraint 不进入可被抵消的加权和；
23. Lexicographic 顺序版本化；
24. Solver 有名称、版本、Seed 和时间预算；
25. 同输入和 Seed 应可重放；
26. Solver Timeout 不伪造最优；
27. Candidate 保存完整违反项；
28. Legalization 不移动 Fixed；
29. Legalization Failure 不隐藏；
30. Legal 不等于 Routable；
31. Congestion 有层数和 Via 假设；
32. BGA Escape 只是估算；
33. Thermal 缺数据不输出精确温度；
34. Testability 不只看测试点数量；
35. 多候选用 Pareto，不只输出总分最高；
36. Score 不替代 Gate；
37. Existing Placement 用 Movement Penalty；
38. 小修改优先局部重排；
39. Approved Region 默认冻结；
40. 每次移动有原因；
41. AI 不输出坐标真值；
42. AI 不修改 Hard Constraint；
43. AI 不隐藏违反项；
44. Agent 19写入前 Preview；
45. Board Outline/Fixed/HV 变更双人审批可配置；
46. 写入后回读坐标；
47. 写入后确认 Fixed 未移动；
48. 写入后 Agent 16重新解析；
49. 写入后 Agent 20检查 Footprint；
50. 写入后 Agent 24检查约束；
51. 写入后运行 DRC；
52. 写入后重估拥塞；
53. Unexpected Move 是 Hard Gate；
54. DRC Regression 是 Hard Gate；
55. Release Pass 不等于最终生产布局；
56. 不发送私有工程给外部模型；
57. 不用客户机械数据做公开 Fixture；
58. 不伪造 Solver、Score、DRC、拥塞、热或 Benchmark；
59. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Geometry/Policy/Solver 变化；
    - 测试命令和真实结果；
    - Fixed/Geometry Coverage；
    - Block/Relation Coverage；
    - Area/Outline；
    - Candidate/Legalization；
    - Congestion/Thermal/Testability；
    - Agent 19/Post-write；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 41. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Input/Geometry

1. Reviewed Netlist；
2. Candidate Netlist Block；
3. Footprint Missing；
4. Courtyard Missing；
5. 3D Missing；
6. Height Missing；
7. Invalid Board Outline；
8. Cutout；
9. Existing Placement；
10. Mixed Units。

## Fixed/Mechanical

11. Edge Connector；
12. Mounting Hole；
13. Display Window；
14. Button Axis；
15. Antenna Edge；
16. Cable Zone；
17. Heatsink；
18. Panel Rail；
19. Conflicting Fixed Objects；
20. Locked Move Attempt。

## Functional/Critical

21. MCU Block；
22. Memory Block；
23. Power Block；
24. Analog Block；
25. RF Block；
26. Isolation Block；
27. Decoupling Assignment；
28. Shared Decoupling；
29. Crystal Group；
30. Buck Hot Loop；
31. Feedback；
32. USB Protection Chain；
33. CAN Termination；
34. ADC Chain；
35. High-voltage Boundary。

## Area/Floorplan

36. Fixed Outline；
37. Outline Candidate；
38. Area Estimate；
39. Routing Reserve；
40. Keepout Reserve；
41. Low-risk Area；
42. Aspect Ratio；
43. Connector-driven Outline；
44. No Feasible Outline；
45. Panel Compatibility。

## Optimization

46. Hypergraph Partition；
47. CP-SAT Region；
48. B*-tree；
49. Annealing；
50. Multi-start；
51. Deterministic Seed；
52. Timeout；
53. Hard Constraint；
54. Weight Dry Run；
55. Pareto Ranking；
56. Best Area；
57. Best Routing；
58. Best Thermal；
59. Balanced；
60. Stable Existing Placement。

## Legalization/Evaluation

61. Simple Overlap；
62. Courtyard Overlap；
63. Board Edge；
64. Keepout；
65. Side；
66. Rotation；
67. Unlegalizable；
68. Congestion；
69. BGA Escape；
70. Connector Escape；
71. Thermal Hotspot Candidate；
72. Temperature-sensitive Distance；
73. Probe Access；
74. Rework Access；
75. DRC Candidate。

## Workflow/Security

76. Pin Object；
77. Adjust Region；
78. Re-optimize；
79. Incremental New Part；
80. Incremental Removed Part；
81. Footprint Change；
82. Constraint Change；
83. Agent 19 Preview；
84. Agent 19 Execute；
85. Readback；
86. Fixed Regression；
87. Agent 20 Regression；
88. Agent 24 Coverage；
89. DRC Regression；
90. Rollback；
91. Baseline；
92. Waiver；
93. Tenant Isolation；
94. Malicious Geometry；
95. Path Traversal；
96. Unapproved Solver；
97. 5,000 Footprints；
98. 10,000 Nets；
99. Batch 100 Boards；
100. Audit Replay。

---

# 42. 初始质量目标

```text
Fixed/Locked Object Preservation = 100%
Unresolved Footprint Auto-placement = 0
Hard Constraint Violation in Released Candidate = 0
Board Outline High-risk Auto-change = 0
Generated Candidate Provenance Coverage = 100%
Solver Seed/Version Coverage = 100%
Legalization Trace Coverage = 100%
Unexpected Fixed Object Move after Write = 0
Post-write Position Readback Coverage = 100%
Post-write Agent 20 Check Coverage = 100%
Post-write Agent 24 Coverage Check = 100%
Post-write DRC Coverage = 100%
Incremental Approved-region Preservation = 100%
AI Direct Coordinate Write = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 43. 性能要求

常规项目：

```text
100–1,000 Footprints
100–3,000 Nets
20–100 Groups/Relations
```

目标：

```text
Geometry Load P95 < 10 s
Context Build P95 < 15 s
Area Estimate P95 < 5 s
Block Floorplan Candidate P95 < 30 s
Legalization P95 < 20 s
Evaluation P95 < 20 s
Interactive Pin/Re-optimize P95 < 10 s for local region
```

Solver 可配置：

```text
quick 10–30 s
balanced 1–5 min
deep 10–30 min
```

大型工程要求：

- 分区求解；
- 候选并行；
- Time Budget；
- Backpressure；
- 可取消；
- Warm Start；
- 增量缓存；
- 不把完整工程发送给模型。

---

# 44. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pcb-placement-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第25个 Agent：

PCB Preliminary Placement, Floorplanning & Board Area Optimization Agent /
PCB 初步布局 Agent。

本 Agent 接收：

- Agent 16 的 Project/Schematic/PCB/Part/Footprint/Pad/Net IR；
- Agent 18 Reviewed Netlist；
- Agent 20 Footprint/Pin-Pad/Courtyard/3D 校验；
- Agent 21 Firmware/Interface/Clock 配置；
- Agent 22 去耦、晶振、电源、高压和敏感网络审查；
- Agent 23 边沿、带宽、负载和关键节点结果；
- Agent 24 Canonical PCB Constraint IR；
- 机械板框、安装孔、连接器、外壳、显示屏、天线、散热和线束要求；

生成：

- Fixed/Locked Object Plan；
- Functional Block/Placement Group；
- Critical Relation Graph；
- Decoupling/Power/Clock/Interface/Analog/RF/HV Placement Plan；
- Board Area Estimate；
- Board Outline Candidate；
- Multi-candidate Floorplan；
- Preliminary Placement；
- Legalized Placement；
- Congestion/Thermal/Testability Evaluation；
- Pareto Candidate Set；
- Agent 19 Change Plan；
- Post-write Verification。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16–25 规格和 Agent 16–24 实际代码；
3. docs/pcb-placement-agent-spec.md；
4. 当前 PCB/Footprint/Pad/Board Geometry；
5. 当前 Courtyard/3D/Height；
6. 当前 Fixed/Locked/Mechanical Objects；
7. 当前 Functional Block/Net Graph/Hypergraph；
8. 当前 Decoupling/Power/Crystal/Feedback/Protection；
9. 当前 Agent 24 Placement/Keepout/HV Constraint；
10. 当前 Area/Outline/Floorplan；
11. 当前 Placement/Legalization；
12. 当前 CP-SAT/MILP/Annealing/Local Search；
13. 当前 HPWL/Congestion/BGA Escape；
14. 当前 Thermal/Testability；
15. 当前 Agent 19 Move/Rotate/Flip/Lock；
16. 当前 DRC/Constraint Coverage；
17. 当前 2D/3D Review UI；
18. 当前 API/Worker/Storage/Security；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Mechanical Facts First；
- Hard Constraint != Objective Weight；
- Fixed/Locked Never Move；
- Schematic Coordinates != PCB Placement；
- Explicit Footprint Geometry Hash；
- No Invented Courtyard/Height；
- Connector/Opening/Mounting/Antenna/HV Hard Gates；
- Qualitative Near/Far Stays Qualitative；
- Explicit Decoupling Assignment；
- Critical-loop-specific Cost；
- Board Area Includes Routing/Keepout/Mechanical/Uncertainty；
- Floorplan Before Component Placement；
- Multiple Pareto Candidates；
- Solver Version/Seed/Time Budget；
- No Fake Optimality；
- Legalization != Routability；
- Congestion Assumptions Explicit；
- Thermal Missing Data != Precise Temperature；
- Incremental Stability；
- Movement Explanation；
- AI Does Not Write Coordinates；
- Agent 19 Workspace/Preview/Approval；
- Post-write Position/Fixed/Agent20/Agent24/DRC Checks；
- Unexpected Move/DRC Regression Hard Gate；
- Pass != Final Production Placement；
- 不发送私有工程和机械数据给外部模型；
- 不用客户数据做公开 Fixture；
- 不伪造 Solver、Score、DRC 和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改工程：

1. 侦察当前仓库；
2. 检查 Agent 16–24 Contract；
3. 查找 PCB/Footprint/Pad/Board Geometry；
4. 查找 Courtyard/3D/Height；
5. 查找 Mechanical Profile；
6. 查找 Fixed/Locked Objects；
7. 查找 Functional Blocks/Groups；
8. 查找 Hypergraph；
9. 查找 Decoupling/Critical Loops；
10. 查找 Agent 24 Placement/Keepout/HV；
11. 查找 Board Area/Outline；
12. 查找 Partition/Floorplan；
13. 查找 Placement Solvers；
14. 查找 Legalization；
15. 查找 HPWL/Congestion/Escape；
16. 查找 Thermal/Testability；
17. 查找 Existing/Incremental Placement；
18. 查找 Agent 19 Write/Readback；
19. 查找 DRC/Coverage；
20. 查找 UI/API/Worker/Storage/Security；
21. 统计 Geometry/Courtyard/Height 覆盖；
22. 统计固定件、功能块和关键关系覆盖；
23. 统计不可合法化、拥塞和 DRC 问题；
24. 抽样分析开源、合成、脱敏或授权工程；
25. 在 docs/pcb-placement-implementation-plan.md 中生成实施计划；
26. 在 docs/input-and-geometry-gates.md 中定义输入；
27. 在 docs/mechanical-constraint-model.md 中定义机械；
28. 在 docs/footprint-geometry-model.md 中定义几何；
29. 在 docs/functional-clustering.md 中定义聚类；
30. 在 docs/critical-placement-relations.md 中定义关键关系；
31. 在 docs/board-area-estimation.md 中定义面积；
32. 在 docs/floorplanning.md 中定义 Floorplan；
33. 在 docs/placement-optimization.md 中定义优化；
34. 在 docs/legalization.md 中定义合法化；
35. 在 docs/congestion-and-escape.md 中定义拥塞；
36. 在 docs/thermal-and-testability.md 中定义热和测试；
37. 在 docs/incremental-placement.md 中定义增量；
38. 在 docs/placement-ir.md 中定义 IR；
39. 在 docs/agent19-integration.md 中定义写入；
40. 在 docs/release-gates.md 中定义 Gate；
41. 在 docs/ai-boundaries.md 中定义 AI；
42. 在 docs/security.md 中定义安全；
43. 在 docs/pcb-placement-migration-plan.md 中定义旧能力迁移；
44. 在 docs/pcb-placement-benchmark-plan.md 中定义 Benchmark；
45. 给出拟新增、拟修改和拟复用文件；
46. 给出 Phase 1 精确范围；
47. 不修改业务代码；
48. 不创建 Migration；
49. 不安装 Solver；
50. 不调用外部模型；
51. 不写 EDA 工程；
52. 不读取或打印 Secret；
53. 运行仓库已有 lint、type check、test、build 和 security scan；
54. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16–24 Contract；
- Input/Geometry Gate；
- Mechanical/Fixed Objects；
- Functional Blocks/Hypergraph；
- Critical Relations/Decoupling；
- Area/Outline；
- Floorplanning；
- Optimization/Objective；
- Legalization；
- Congestion/Escape；
- Thermal/Testability；
- Pareto Candidates；
- Incremental Placement；
- Placement IR；
- Agent 19 Integration；
- Post-write Verification；
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

# 45. 后续 Phase 提示词模板

```text
继续实现 PCB Placement Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16–25 规格；
3. 阅读 PCB Placement Implementation Plan；
4. 阅读 Geometry、Mechanical、Clustering、Relations、Area、Floorplan、Optimization、Legalization、Congestion、Thermal、IR、Agent19、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Mechanical First；
- Fixed/Locked Preservation；
- Hard/Soft Separation；
- Deterministic Solver Trace；
- Multiple Candidates；
- Legalization and Routability Separate；
- Incremental Stability；
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
9. solver deterministic test；
10. hard-constraint test；
11. legalization/congestion test；
12. incremental test；
13. Agent 19/post-write test；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Geometry/Policy/Solver 变化；
- 测试命令和真实结果；
- Fixed/Geometry Coverage；
- Block/Relation Coverage；
- Area/Outline；
- Candidate/Legalization；
- Congestion/Thermal/Testability；
- Agent 19/Post-write；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 46. MVP 演示流程

1. 选择一块带 USB-C、MCU、Buck、电机驱动、ADC、显示屏和 RF 模块的 KiCad 工程；
2. Agent 16解析 PCB、Footprint、Pad 和 Net；
3. Agent 18提供 Reviewed Netlist；
4. Agent 20确认 Footprint、Pin-Pad 和 Courtyard；
5. Agent 21提供 USB、SPI、ADC、PWM 和 RF 配置；
6. Agent 22提供去耦、晶振、Buck Feedback 和接口保护 Finding；
7. Agent 23提供模拟带宽、Buck 边沿和热功耗候选；
8. Agent 24提供差分、线宽、Keepout、高压和 Placement Constraint；
9. 加载外壳、板框、安装孔和显示屏窗口；
10. 锁定 USB-C、显示屏连接器、按键、天线和安装孔；
11. 将调试接口设为 Semi-fixed，只允许沿左侧板边移动；
12. 构建功能块：Power、MCU、Analog、Motor、Display、RF、Debug；
13. 构建 Hypergraph；
14. 为 MCU 每个 VDD Pin 分配去耦电容；
15. 识别 Buck Hot Loop；
16. 识别 Crystal Group；
17. 识别 USB 保护链；
18. 识别 RF 天线 Keepout；
19. 识别电机驱动热源；
20. 估算理论最小、推荐和低风险板面积；
21. 生成三个长宽比不同的 Outline Candidate；
22. 机械约束淘汰一个候选；
23. Hypergraph Partition 生成两个功能分区方案；
24. B*-tree 生成 Block Floorplan；
25. CP-SAT 确认 RF、Analog 和 Motor 不共享冲突区域；
26. 优先放置 Buck、去耦、晶振、USB 保护和 ADC 链；
27. 全局放置其余器件；
28. Legalizer 消除 Courtyard 重叠；
29. Congestion Map 显示 MCU 与显示连接器之间拥塞；
30. Solver 创建新的 Routing Corridor；
31. BGA/MCU Escape 压力下降；
32. Thermal 评估显示电机驱动与 Buck 过近；
33. 生成热平衡候选；
34. Testability 评估发现编程接口被显示屏遮挡；
35. Semi-fixed 调试接口沿板边移动；
36. 输出五个 Pareto 候选；
37. 工程师选择“平衡方案”；
38. 固定 RF 模块和 Analog Block；
39. 对 Power 区域再做局部优化；
40. 生成 Placement IR 和 Change Plan；
41. Agent 19在 Workspace 中移动、旋转并锁定器件；
42. KiCad 回读所有坐标和方向；
43. 确认固定连接器和安装孔未移动；
44. Agent 20确认 Footprint 身份和 Courtyard；
45. Agent 24确认 Rule Area、Keepout 和高压边界；
46. 运行 DRC；
47. 重估拥塞；
48. 发现一处新 Courtyard Warning；
49. 局部合法化修复；
50. 再次写入并验证；
51. 生成 Candidate Comparison、Congestion、Thermal、Testability 和 Diff 报告；
52. Routing Start Gate 通过；
53. 发布 `pcb-placement.completed`。

---

# 47. 生产上线顺序

第一阶段：

```text
Agent 16/18/20/24 Input
Footprint Geometry
Mechanical/Fixed Objects
Functional Blocks
Critical Relations
Area Estimate
Fixed Outline Floorplan
Basic CP-SAT/Annealing
Legalization
Report-only
```

第二阶段：

```text
Outline Candidates
Hypergraph Partition
Critical-group Templates
Congestion/BGA Escape
Thermal/Testability
Pareto Ranking
Agent 19 Write
Post-write Verification
```

第三阶段：

```text
Incremental Placement
Advanced Floorplan Algorithms
Mechanical CAD Round-trip
Rigid-flex/HDI
Router Feedback
Detailed Thermal/SI Handoff
```

上线优先确保：

```text
哪些器件绝对不能动
每个关键器件为什么放在这里
板面积中为布线、热、测试和机械预留了多少空间
候选布局是否真正合法并具备初步可布线性
写入工程后固定件、约束和 DRC 是否仍然正确
```

一个可靠的初步布局 Agent，不应该追求把器件摆得像俄罗斯方块一样满。真正优秀的 Floorplan 往往会故意留下通道、回流路径、散热铜、探针空间和工程师后续调整的余地——空白并不总是浪费，有时它恰恰是设计能顺利落地的原因。
