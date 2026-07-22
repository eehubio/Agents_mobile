# 工程需求结构化 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：10  
> Agent 名称：Engineering Requirements Structuring, Constraint Extraction & Traceability Agent  
> 中文名称：工程需求结构化 Agent  
> 类型：混合型  
> 版本：V1.0  
>
> 定位：将自然语言、PRD、客户邮件、会议纪要、表格、图片、草图、框图、竞品资料、规格书、合同条款和历史项目要求，转换为可计算、可追溯、可审查、可版本化的工程 Requirement IR；覆盖电源、接口、性能、尺寸、成本、环境、合规、制造、质量、测试、维护、生命周期和交付约束，并明确区分客户原始要求、已确认约束、设计目标、假设、推断、建议、冲突、缺失信息和待确认问题。
>
> 上游：
> - 用户自然语言输入
> - PRD、MRD、SOW、RFQ、RFP、合同附件、客户规格书
> - 邮件、会议纪要、聊天记录和评审意见
> - 图片、手绘草图、框图、接口示意、尺寸图、产品效果图
> - Excel/CSV 参数表、测试表、成本表和合规矩阵
> - 竞品和历史产品资料
> - 企业需求模板、行业模板、法规模板和产品分类模板
> - PLM/CRM/项目管理系统中的客户、项目、版本和变更信息
>
> 下游：
> - 系统架构与方案生成 Agent
> - 元器件选型和模块推荐 Agent
> - Agent 16：EDA 工程解析，用于核对设计是否覆盖需求
> - Agent 17：PDF/图片原理图识别，用于从客户资料补充设计背景
> - Agent 18：Netlist 重建，用于接口和连接需求验证
> - Agent 21：固件与驱动框架生成，用于接口、协议、时序和资源约束
> - Agent 22：ERC 与 AI 原理图审查，用于需求覆盖和电气合规
> - Agent 23：电路仿真与结果解读，用于性能和边界条件验收
> - Agent 24：PCB 约束提取，用于线宽、阻抗、长度、间距、禁布和高压要求
> - Agent 25：PCB 初步布局，用于尺寸、接口位置、机械和功能分区
> - Agent 26：PCB 自动布线，用于网络优先级、差分、长度和层叠约束
> - Agent 27：DRC、SI、PI 与 EMC 审查，用于电气性能和风险验证
> - Agent 28：3D 与机械干涉，用于尺寸、安装、外壳和动态空间验证
> - Agent 29：生产文件生成，用于发布资料和版本一致性
> - Agent 30：DFM/DFA 制造可行性，用于制造、装配和供应商能力匹配
> - Agent 31–45：BOM、供应链、NPI、制造、质量和追溯
>
> 核心输出：
> - Requirement Intake Snapshot
> - Source Document Registry
> - Source Evidence Anchors
> - Requirement Canonical IR
> - Requirement Classification
> - Constraint Set
> - Goal and Preference Set
> - Assumption Register
> - Ambiguity Register
> - Conflict Register
> - Missing Information Register
> - Clarification Question Set
> - Requirement Dependency Graph
> - Requirement-to-Design Traceability Matrix
> - Requirement-to-Test Traceability Matrix
> - Requirement Coverage Report
> - Acceptance Criteria
> - Verification Method Plan
> - Change Impact Package
> - Requirement Baseline
> - Requirement Release Manifest
>
> 重要边界：
> - 客户明确要求、企业规则、法规要求、设计建议和模型推断必须分开保存。
> - 不将“希望”“最好”“尽可能”“大约”“类似”“低成本”等模糊表达自动转成未经确认的硬阈值。
> - 不将模型推测值写成客户要求。
> - 不将缺失参数自动补全为行业常见值；只能提出候选和问题。
> - 不把竞品参数自动继承为本项目需求。
> - 不把示意图中的视觉比例直接当成精确尺寸。
> - 不从图片像素推断真实毫米尺寸，除非存在可靠标尺、标注或可验证参考。
> - 不将法规名称出现视为已经满足合规要求。
> - 不把“支持 USB”自动解释为 USB 2.0、USB-C、Host、Device、PD 或某个速率。
> - 不把“低功耗”自动解释为某个电流值。
> - 不把“工业级”自动解释为固定温度范围或等级。
> - 不把成本目标和绝对成本上限混为一类。
> - 不把产品级要求、板级要求、模块级要求和器件级要求混为同一层级。
> - 不让 AI 直接关闭冲突、批准假设或冻结需求基线。
> - 不将客户文件、合同、图片和商业数据发送给未经批准的外部模型。
> - 所有结论必须能回到原始来源、页码、段落、表格单元格、图片区域或会议记录。

---

# 1. Agent 10 的系统位置

```text
客户需求 / PRD / 图片 / 表格 / 邮件 / 历史项目
                              ↓
                  Source Intake and Snapshot
                              ↓
          Evidence Anchoring and Content Normalization
                              ↓
          Requirement / Constraint / Goal Separation
                              ↓
         Quantity / Unit / Range / Tolerance Normalization
                              ↓
    Completeness / Conflict / Ambiguity / Feasibility Pre-check
                              ↓
              Canonical Requirement IR and Graph
                              ↓
        Clarification / Review / Approval / Baseline
                              ↓
  Architecture / Schematic / Firmware / PCB / Mechanical / Manufacturing
                              ↓
              Verification and Change Traceability
```

---

# 2. 为什么需要独立 Agent 10

常见问题包括：

1. PRD 中写“USB 接口”，工程师理解成 USB-C Device，客户实际要 Host；
2. 客户说“电池供电一天”，但没有定义工作占空比；
3. 成本目标没有说明数量、币种、税费和时间点；
4. 尺寸要求只出现在一张草图中，正文没有提及；
5. 同一 PRD 前面写 5V 输入，后面表格写 9–24V；
6. 一个版本要求 IP65，另一个会议纪要说室内使用即可；
7. “工业级”在不同人员口中代表不同内容；
8. “支持蓝牙”没有版本、角色、距离、认证和功耗要求；
9. “高精度”没有量程、分辨率、误差、温漂和校准条件；
10. “低成本”没有 BOM 成本、制造成本还是销售价定义；
11. 图片中的连接器位置与文字描述冲突；
12. 客户要求通过某认证，但没有目标市场和产品类别；
13. 环境温度写了 -40°C，但选用电池只支持 0°C 充电；
14. 需求已经修改，但原理图和 PCB 仍在使用旧版本；
15. 测试人员无法判断某条需求怎样才算通过。

Agent 10 的职责是：

```text
Source Truth
→ Structured Meaning
→ Explicit Uncertainty
→ Traceable Constraints
→ Verifiable Acceptance
```

---

# 3. 需求对象分类

必须区分：

```text
requirement
constraint
goal
preference
assumption
decision
recommendation
risk
issue
question
conflict
exclusion
acceptance_criterion
verification_method
```

---

# 4. 需求强度

```text
shall
must
should
may
target
preference
informational
prohibited
unknown
```

映射规则不能只靠关键词，应结合语境和来源类型。

---

# 5. 需求来源类型

```text
customer_explicit
contractual
regulatory
enterprise_policy
product_strategy
engineering_decision
derived_constraint
historical_reference
competitive_reference
ai_candidate
```

`ai_candidate` 永远不能直接进入 Approved Baseline。

---

# 6. 需求状态

```text
draft
extracted
normalized
needs_clarification
conflicted
under_review
approved
rejected
deferred
superseded
baselined
verified
failed_verification
waived
```

---

# 7. 需求优先级

建议支持：

```text
critical
high
medium
low
optional
```

以及：

```text
must_have
should_have
could_have
wont_have_current_release
```

优先级来源必须显式，不能由模型独断。

---

# 8. Requirement Scope

```text
product
system
subsystem
board
module
component
firmware
mechanical
manufacturing
test
service
packaging
documentation
```

---

# 9. Requirement Domain

核心分类：

```text
power
battery
charging
interfaces
communications
protocols
performance
timing
accuracy
analog
digital
rf
audio
display
sensors
processing
memory
storage
security
firmware
software
mechanical
dimensions
weight
mounting
thermal
environment
reliability
safety
emc
esd
compliance
materials
manufacturing
assembly
testability
maintainability
service
cost
volume
schedule
supply_chain
lifecycle
packaging
documentation
user_experience
```

---

# 10. 电源需求结构

字段：

```text
input source
input voltage nominal
input voltage range
input current
power budget
peak power
idle power
sleep power
startup inrush
brownout behavior
reverse polarity
surge
transient
isolation
power sequencing
rails
efficiency
battery type
battery capacity
runtime
charging method
charging time
connector
protection
```

---

# 11. 接口需求结构

```text
interface type
physical connector
electrical standard
protocol
role
direction
channel count
data rate
voltage level
termination
isolation
cable length
hot plug
ESD level
pin assignment
mechanical position
compatibility
certification
```

示例中必须区分：

```text
USB connector
USB electrical interface
USB protocol
USB role
USB data rate
USB power delivery
```

---

# 12. 性能需求结构

```text
metric
nominal
minimum
maximum
target
tolerance
accuracy
precision
resolution
bandwidth
sample rate
latency
throughput
noise
drift
stability
repeatability
operating condition
measurement method
```

---

# 13. 尺寸与机械需求

```text
maximum width
maximum length
maximum height
board thickness
weight
mounting holes
hole positions
connector positions
button positions
display opening
keepout
service clearance
enclosure
ingress protection
shock
vibration
drop
cable bend
assembly sequence
```

---

# 14. 成本需求

必须拆分：

```text
target BOM cost
maximum BOM cost
fabrication cost
assembly cost
tooling cost
test cost
packaging cost
shipping cost
landed cost
NRE
target selling price
target margin
currency
quantity tier
region
quote date
tax/duty inclusion
```

---

# 15. 环境需求

```text
operating temperature
storage temperature
charging temperature
humidity
altitude
condensation
dust
water
salt fog
chemical exposure
UV
indoor/outdoor
shock
vibration
drop
pressure
radiation optional
```

---

# 16. 合规需求

```text
target market
product category
standard or directive
mandatory/advisory
certification body
test scope
evidence required
declaration required
marking
documentation
material restriction
radio approval
EMC
safety
environmental
recycling
```

法规条款和标准版本必须由合规数据库或人工确认，本 Agent 不自行判定适用性。

---

# 17. 制造需求

```text
target quantity
prototype quantity
pilot quantity
mass production quantity
board technology
layer count limit
materials
surface finish
minimum process class
assembly sides
special process
panelization
test fixture
AOI
X-ray
ICT
FCT
traceability
factory region
approved suppliers
```

---

# 18. 质量和可靠性需求

```text
design life
duty cycle
MTBF target
failure rate
warranty
burn-in
screening
derating
redundancy
fault handling
self test
calibration interval
maintenance interval
field replaceability
```

---

# 19. 时间和项目约束

```text
prototype date
design freeze
pilot date
certification date
mass production date
dependencies
customer review date
long-lead deadline
budget approval
resource constraint
```

---

# 20. Quantity Value Model

所有数值字段使用统一对象：

```json
{
  "value_type": "range",
  "nominal": null,
  "minimum": "9",
  "maximum": "24",
  "unit": "V",
  "tolerance": null,
  "condition": {
    "temperature": "25 degC",
    "mode": "normal_operation"
  },
  "source_evidence_ids": [],
  "confidence": {},
  "status": "explicit"
}
```

---

# 21. 值状态

```text
explicit
derived
assumed
inferred
recommended
default_candidate
unknown
not_applicable
```

只有 `explicit`、已批准 `derived` 和已批准 `assumed` 可以进入冻结约束。

---

# 22. 范围表达

支持：

```text
exact
minimum
maximum
range
target
nominal_with_tolerance
enumeration
boolean
formula
conditional
piecewise
```

---

# 23. 条件需求

示例：

```text
当 Wi-Fi 发射时，峰值电流不得超过 800 mA
在 25°C、1 kHz 条件下，测量误差小于 0.5%
当使用外部电源时，允许同时给电池充电
若产品销往欧盟，则需要满足目标合规集合
```

条件必须结构化，不得只保存在说明文字中。

---

# 24. Requirement IR

```json
{
  "requirement_ir_version": "1.0.0",
  "project_id": "uuid",
  "baseline_candidate_id": "uuid",
  "requirements": [],
  "constraints": [],
  "goals": [],
  "preferences": [],
  "assumptions": [],
  "questions": [],
  "conflicts": [],
  "dependencies": [],
  "acceptance_criteria": [],
  "verification_methods": [],
  "traceability": [],
  "provenance": {}
}
```

---

# 25. 单条 Requirement

```json
{
  "requirement_id": "REQ-PWR-001",
  "title": "输入电压范围",
  "statement_original": "设备应支持 9V 到 24V 直流输入",
  "statement_normalized": "The product shall operate from a 9–24 VDC input.",
  "object_type": "requirement",
  "domain": "power",
  "scope": "product",
  "strength": "shall",
  "priority": "critical",
  "value": {},
  "conditions": [],
  "source_type": "customer_explicit",
  "evidence_ids": [],
  "confidence": {},
  "status": "under_review",
  "owner": null,
  "verification_method_ids": [],
  "acceptance_criterion_ids": [],
  "tags": []
}
```

---

# 26. Constraint IR

约束与需求分开：

```text
requirement：产品需要实现什么
constraint：设计必须在什么边界内实现
```

示例：

```text
需求：支持 100 Mbps 以太网
约束：只能使用现有 RJ45 外壳开孔
```

---

# 27. Goal 与 Hard Constraint

必须区分：

```text
hard constraint
soft constraint
optimization goal
preference
trade-off variable
```

例如：

```text
最大高度 12 mm → hard constraint
尽可能降低功耗 → optimization goal
优先使用 USB-C → preference
```

---

# 28. Assumption Register

每条假设保存：

```text
assumption statement
reason
source
owner
impact
validation method
expiry
approval
affected requirements
```

未经批准的假设不能悄悄进入设计输入。

---

# 29. Ambiguity Register

模糊类型：

```text
undefined_term
missing_unit
missing_condition
missing_threshold
unclear_scope
unclear_role
unclear_priority
unclear_market
unclear_variant
pronoun_reference
visual_text_conflict
```

---

# 30. Conflict Register

冲突类型：

```text
direct_numeric_conflict
range_overlap_conflict
interface_role_conflict
variant_conflict
source_priority_conflict
schedule_cost_conflict
performance_power_conflict
mechanical_interface_conflict
compliance_market_conflict
```

---

# 31. Conflict Resolution

处理流程：

```text
detect
→ collect evidence
→ identify source authority
→ propose options
→ request decision
→ record decision
→ supersede affected statements
```

AI 不能自动选择最终版本。

---

# 32. Missing Information Register

缺失项：

```text
required for architecture
required for schematic
required for PCB
required for mechanical
required for simulation
required for compliance
required for manufacturing
required for test
required for cost
```

---

# 33. Clarification Question

结构：

```text
question
reason
affected requirements
impact if unanswered
suggested options
default candidate optional
must answer before phase
owner
due date
```

---

# 34. Evidence Anchor

支持：

```text
document page and text span
table row/column/cell
spreadsheet sheet/cell/range
image bounding box
diagram object
email message/paragraph
meeting timestamp/speaker
manual user entry
external rule record
```

---

# 35. Evidence Object

```json
{
  "evidence_id": "uuid",
  "source_document_id": "uuid",
  "evidence_type": "table_cell",
  "locator": {
    "sheet": "Requirements",
    "cell": "D12"
  },
  "content_hash": "sha256",
  "extracted_text": "Maximum height: 12 mm",
  "artifact_uri": "object-storage-uri"
}
```

---

# 36. Source Authority

建议等级：

```text
signed_contract
approved_customer_spec
approved_prd
approved_change_request
customer_email
meeting_decision
engineering_spec
historical_reference
competitive_reference
informal_chat
ai_candidate
```

冲突解决时使用 Authority，但最终仍需授权人员确认。

---

# 37. Requirement Dependency Graph

节点：

```text
requirement
constraint
assumption
decision
design object
test
risk
compliance item
manufacturing process
```

边：

```text
depends_on
derived_from
conflicts_with
satisfies
partially_satisfies
verified_by
allocated_to
supersedes
constrains
impacts
```

---

# 38. Derived Requirement

示例：

```text
原始要求：
支持 24 V 输入

已批准派生：
所有直接连接输入端的器件额定电压需满足企业 Derating Policy
```

必须保存：

```text
derivation rule
input requirement ids
policy version
calculation trace
approval
```

---

# 39. Requirement Allocation

分配到：

```text
system
board
power subsystem
MCU
FPGA
firmware
mechanical
manufacturing
test
supplier
```

---

# 40. Acceptance Criteria

每条可验证需求建议生成：

```text
preconditions
setup
input
procedure
measurement
expected result
tolerance
pass/fail logic
evidence
```

AI 可以生成草稿，但必须由工程师批准。

---

# 41. Verification Method

```text
inspection
analysis
calculation
simulation
test
demonstration
review
supplier certificate
compliance lab
field trial
```

---

# 42. Requirement Verifiability

状态：

```text
verifiable
partially_verifiable
not_verifiable
ambiguous
missing_method
missing_threshold
missing_condition
```

---

# 43. Completeness Check

按产品类别检查模板：

```text
power
interfaces
performance
mechanical
environment
compliance
cost
manufacturing
test
service
schedule
```

输出：

```text
covered
partially_covered
missing
not_applicable
unknown
```

---

# 44. Consistency Check

检查：

```text
unit consistency
range consistency
variant consistency
market consistency
interface role consistency
power budget consistency
schedule consistency
cost quantity consistency
environment component compatibility
compliance target market compatibility
```

---

# 45. Feasibility Pre-check

只做预检查：

```text
obviously contradictory
physically suspicious
cost/performance tension
power/runtime tension
size/thermal tension
schedule/certification tension
supply/lifecycle tension
```

不替代后续专业 Agent。

---

# 46. Product Template

可按类别加载模板：

```text
IoT sensor
industrial controller
portable instrument
USB device
battery product
RF product
audio product
motor controller
FPGA board
education kit
medical candidate
automotive candidate
```

模板只用于完整性提醒，不自动生成硬需求。

---

# 47. Variant Model

支持：

```text
base requirement
variant override
market override
customer override
prototype override
mass-production override
```

---

# 48. Requirement Baseline

Baseline 包含：

```text
project
baseline name
version
approved requirements
approved constraints
approved assumptions
open questions
accepted conflicts
applicable variants
source snapshot
policy snapshot
approvals
hash
```

---

# 49. Change Request

```text
change reason
source
affected requirements
old/new values
variants
impact
required re-verification
approval
effective revision
```

---

# 50. Change Impact

传播到：

```text
architecture
schematic
BOM
firmware
PCB constraints
placement
routing
simulation
mechanical
manufacturing files
DFM/DFA
test
cost
schedule
compliance
```

---

# 51. Coverage Matrix

典型映射：

```text
Requirement → Architecture Block
Requirement → Schematic Block
Requirement → Net / Interface
Requirement → Firmware Feature
Requirement → PCB Constraint
Requirement → Mechanical Object
Requirement → Manufacturing Artifact
Requirement → Test Case
Requirement → Compliance Evidence
```

---

# 52. AI 允许职责

```text
识别需求候选
分类需求
提取数值和单位候选
识别模糊和冲突
生成澄清问题
生成验收标准草稿
生成结构化摘要
解释变更影响
```

---

# 53. AI 禁止职责

```text
将推断伪装为客户要求
自动批准假设
自动解决冲突
自动修改来源文本
自动冻结 Baseline
自动生成法规适用结论
自动编造数值
自动关闭待确认问题
```

---

# 54. 状态机

```text
RECEIVED
→ VALIDATING_SOURCES
→ SNAPSHOTTING_INPUT
→ EXTRACTING_CONTENT
→ ANCHORING_EVIDENCE
→ DETECTING_REQUIREMENT_CANDIDATES
→ CLASSIFYING
→ NORMALIZING_VALUES
→ BUILDING_DEPENDENCIES
→ CHECKING_COMPLETENESS
→ CHECKING_CONFLICTS
→ GENERATING_QUESTIONS
→ GENERATING_ACCEPTANCE_CRITERIA
→ REVIEW_REQUIRED
→ APPROVING
→ BASELINING
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_OPEN_QUESTIONS
COMPLETED_DRAFT_ONLY
INPUT_BLOCKED
SOURCE_PARSE_FAILED
EVIDENCE_INCOMPLETE
CONFLICT_BLOCKED
APPROVAL_REQUIRED
BASELINE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 55. 错误码

```text
PROJECT_NOT_FOUND
SOURCE_NOT_FOUND
SOURCE_FORMAT_UNSUPPORTED
SOURCE_PARSE_FAILED
SOURCE_PASSWORD_PROTECTED
SOURCE_CORRUPTED
SOURCE_VERSION_MISMATCH
SOURCE_HASH_MISMATCH
IMAGE_RESOLUTION_INSUFFICIENT
TABLE_EXTRACTION_FAILED
EVIDENCE_ANCHOR_FAILED
LANGUAGE_UNSUPPORTED
UNIT_UNKNOWN
UNIT_CONVERSION_AMBIGUOUS
VALUE_RANGE_INVALID
REQUIREMENT_SCOPE_AMBIGUOUS
REQUIREMENT_SOURCE_AMBIGUOUS
CONFLICT_UNRESOLVED
MISSING_CRITICAL_REQUIREMENT
ASSUMPTION_UNAPPROVED
COMPLIANCE_SCOPE_UNKNOWN
VARIANT_CONFLICT
BASELINE_ALREADY_EXISTS
BASELINE_APPROVAL_MISSING
CHANGE_REQUEST_INVALID
TRACEABILITY_BROKEN
JOB_CANCELLED
INTERNAL_ERROR


---

# 56. 数据库设计

## 56.1 `requirement_intake_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NULL
job_type VARCHAR NOT NULL
language_policy JSONB NOT NULL
extraction_profile VARCHAR NOT NULL
policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 56.2 `requirement_input_snapshots`

```text
id UUID PK
job_id UUID NOT NULL
source_document_ids JSONB NOT NULL
source_hashes JSONB NOT NULL
project_context_hash CHAR(64) NULL
template_snapshot_hash CHAR(64) NOT NULL
policy_snapshot_hash CHAR(64) NOT NULL
terminology_snapshot_hash CHAR(64) NOT NULL
model_snapshot JSONB NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, snapshot_hash)
```

## 56.3 `requirement_source_documents`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
source_type VARCHAR NOT NULL
title VARCHAR NOT NULL
filename VARCHAR NULL
media_type VARCHAR NOT NULL
language VARCHAR NULL
source_reference JSONB NOT NULL
artifact_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
source_authority VARCHAR NOT NULL
document_version VARCHAR NULL
effective_date DATE NULL
supersedes_document_id UUID NULL
parse_status VARCHAR NOT NULL
security_classification VARCHAR NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
```

## 56.4 `requirement_source_parse_runs`

```text
id UUID PK
source_document_id UUID NOT NULL
parser_name VARCHAR NOT NULL
parser_version VARCHAR NOT NULL
status VARCHAR NOT NULL
page_count INT NULL
sheet_count INT NULL
image_count INT NULL
table_count INT NULL
paragraph_count INT NULL
detected_languages JSONB NOT NULL
warnings JSONB NOT NULL
errors JSONB NOT NULL
parsed_content_uri TEXT NULL
parsed_content_hash CHAR(64) NULL
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

## 56.5 `requirement_evidence_anchors`

```text
id UUID PK
source_document_id UUID NOT NULL
evidence_type VARCHAR NOT NULL
locator JSONB NOT NULL
content_text TEXT NULL
content_hash CHAR(64) NOT NULL
bounding_geometry JSONB NULL
normalized_content JSONB NULL
artifact_uri TEXT NULL
parser_run_id UUID NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 56.6 `requirement_candidates`

```text
id UUID PK
job_id UUID NOT NULL
candidate_key VARCHAR NOT NULL
candidate_text TEXT NOT NULL
normalized_candidate_text TEXT NULL
object_type_candidate VARCHAR NOT NULL
domain_candidate VARCHAR NULL
scope_candidate VARCHAR NULL
strength_candidate VARCHAR NULL
value_candidate JSONB NULL
condition_candidate JSONB NULL
source_type_candidate VARCHAR NULL
evidence_ids JSONB NOT NULL
extraction_method VARCHAR NOT NULL
model_or_rule_version VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, candidate_key)
```

## 56.7 `requirements`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_key VARCHAR NOT NULL
title VARCHAR NOT NULL
statement_original TEXT NOT NULL
statement_normalized TEXT NOT NULL
object_type VARCHAR NOT NULL
domain VARCHAR NOT NULL
scope VARCHAR NOT NULL
strength VARCHAR NOT NULL
priority VARCHAR NOT NULL
source_type VARCHAR NOT NULL
value_object JSONB NULL
conditions JSONB NOT NULL
evidence_ids JSONB NOT NULL
owner_id UUID NULL
variant_scope JSONB NOT NULL
effectivity JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
current_version INT NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(project_id, requirement_key)
```

## 56.8 `requirement_versions`

```text
id UUID PK
requirement_id UUID NOT NULL
version_number INT NOT NULL
statement_normalized TEXT NOT NULL
object_type VARCHAR NOT NULL
domain VARCHAR NOT NULL
scope VARCHAR NOT NULL
strength VARCHAR NOT NULL
priority VARCHAR NOT NULL
source_type VARCHAR NOT NULL
value_object JSONB NULL
conditions JSONB NOT NULL
evidence_ids JSONB NOT NULL
variant_scope JSONB NOT NULL
effectivity JSONB NOT NULL
change_reason TEXT NULL
change_request_id UUID NULL
version_hash CHAR(64) NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
UNIQUE(requirement_id, version_number)
```

## 56.9 `requirement_value_objects`

```text
id UUID PK
requirement_id UUID NOT NULL
value_type VARCHAR NOT NULL
nominal_value NUMERIC NULL
minimum_value NUMERIC NULL
maximum_value NUMERIC NULL
unit VARCHAR NULL
tolerance JSONB NULL
enumeration_values JSONB NULL
formula TEXT NULL
conditions JSONB NOT NULL
value_status VARCHAR NOT NULL
derivation_trace JSONB NULL
source_evidence_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.10 `requirement_conditions`

```text
id UUID PK
requirement_id UUID NOT NULL
condition_key VARCHAR NOT NULL
condition_type VARCHAR NOT NULL
expression_ir JSONB NOT NULL
human_readable TEXT NOT NULL
evidence_ids JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(requirement_id, condition_key)
```

## 56.11 `requirement_assumptions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
assumption_key VARCHAR NOT NULL
statement TEXT NOT NULL
reason TEXT NOT NULL
source_reference JSONB NOT NULL
affected_requirement_ids JSONB NOT NULL
impact_summary JSONB NOT NULL
validation_method JSONB NULL
owner_id UUID NULL
expires_at TIMESTAMPTZ NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, assumption_key)
```

## 56.12 `requirement_ambiguities`

```text
id UUID PK
job_id UUID NOT NULL
ambiguity_type VARCHAR NOT NULL
statement_reference JSONB NOT NULL
description TEXT NOT NULL
affected_requirement_ids JSONB NOT NULL
evidence_ids JSONB NOT NULL
impact_summary JSONB NOT NULL
suggested_resolution JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.13 `requirement_conflicts`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
conflict_key VARCHAR NOT NULL
conflict_type VARCHAR NOT NULL
requirement_ids JSONB NOT NULL
source_document_ids JSONB NOT NULL
evidence_ids JSONB NOT NULL
authority_analysis JSONB NOT NULL
conflict_description TEXT NOT NULL
resolution_options JSONB NOT NULL
resolution_decision JSONB NULL
resolved_by UUID NULL
resolved_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, conflict_key)
```

## 56.14 `requirement_missing_items`

```text
id UUID PK
job_id UUID NOT NULL
domain VARCHAR NOT NULL
scope VARCHAR NOT NULL
missing_item_key VARCHAR NOT NULL
reason TEXT NOT NULL
required_before_phase VARCHAR NULL
affected_workflows JSONB NOT NULL
impact_summary JSONB NOT NULL
template_rule_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, missing_item_key)
```

## 56.15 `requirement_clarification_questions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
question_key VARCHAR NOT NULL
question_text TEXT NOT NULL
reason TEXT NOT NULL
affected_requirement_ids JSONB NOT NULL
affected_workflows JSONB NOT NULL
impact_if_unanswered JSONB NOT NULL
suggested_options JSONB NOT NULL
default_candidate JSONB NULL
owner_id UUID NULL
due_at TIMESTAMPTZ NULL
answer JSONB NULL
answered_by UUID NULL
answered_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, question_key)
```

## 56.16 `requirement_graph_versions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
graph_version VARCHAR NOT NULL
node_count INT NOT NULL
edge_count INT NOT NULL
graph_uri TEXT NOT NULL
graph_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, graph_version)
```

## 56.17 `requirement_graph_nodes`

```text
id UUID PK
graph_version_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
object_reference JSONB NOT NULL
attributes JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, node_key)
```

## 56.18 `requirement_graph_edges`

```text
id UUID PK
graph_version_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_type VARCHAR NOT NULL
attributes JSONB NOT NULL
evidence_ids JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(graph_version_id, source_node_id, target_node_id, edge_type)
```

## 56.19 `requirement_derivations`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
derived_requirement_id UUID NOT NULL
input_requirement_ids JSONB NOT NULL
derivation_rule_id VARCHAR NOT NULL
policy_version VARCHAR NOT NULL
calculation_trace JSONB NOT NULL
evidence_ids JSONB NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
```

## 56.20 `requirement_allocations`

```text
id UUID PK
requirement_id UUID NOT NULL
allocation_target_type VARCHAR NOT NULL
allocation_target_reference JSONB NOT NULL
allocation_role VARCHAR NOT NULL
allocation_percentage NUMERIC NULL
rationale TEXT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.21 `requirement_acceptance_criteria`

```text
id UUID PK
requirement_id UUID NOT NULL
criterion_key VARCHAR NOT NULL
preconditions JSONB NOT NULL
setup JSONB NOT NULL
inputs JSONB NOT NULL
procedure_steps JSONB NOT NULL
measurements JSONB NOT NULL
expected_result JSONB NOT NULL
pass_fail_logic JSONB NOT NULL
evidence_requirements JSONB NOT NULL
draft_method VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(requirement_id, criterion_key)
```

## 56.22 `requirement_verification_methods`

```text
id UUID PK
requirement_id UUID NOT NULL
method_type VARCHAR NOT NULL
method_reference JSONB NULL
responsible_role VARCHAR NULL
verification_phase VARCHAR NULL
required_equipment JSONB NOT NULL
required_environment JSONB NOT NULL
evidence_output JSONB NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.23 `requirement_completeness_runs`

```text
id UUID PK
job_id UUID NOT NULL
template_id UUID NOT NULL
template_version VARCHAR NOT NULL
domain_results JSONB NOT NULL
covered_count INT NOT NULL
partial_count INT NOT NULL
missing_count INT NOT NULL
not_applicable_count INT NOT NULL
unknown_count INT NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 56.24 `requirement_consistency_runs`

```text
id UUID PK
job_id UUID NOT NULL
rule_set_version VARCHAR NOT NULL
unit_findings JSONB NOT NULL
range_findings JSONB NOT NULL
variant_findings JSONB NOT NULL
interface_findings JSONB NOT NULL
power_findings JSONB NOT NULL
cost_findings JSONB NOT NULL
schedule_findings JSONB NOT NULL
environment_findings JSONB NOT NULL
status VARCHAR NOT NULL
report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 56.25 `requirement_feasibility_prechecks`

```text
id UUID PK
job_id UUID NOT NULL
check_type VARCHAR NOT NULL
requirement_ids JSONB NOT NULL
input_context JSONB NOT NULL
result_type VARCHAR NOT NULL
risk_level VARCHAR NOT NULL
confidence_dimensions JSONB NOT NULL
evidence_ids JSONB NOT NULL
downstream_agent_recommendations JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.26 `requirement_trace_links`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
requirement_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_reference JSONB NOT NULL
link_type VARCHAR NOT NULL
coverage_status VARCHAR NOT NULL
evidence_ids JSONB NOT NULL
source_agent VARCHAR NULL
source_revision VARCHAR NULL
confidence_dimensions JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.27 `requirement_coverage_runs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_id UUID NOT NULL
target_revision VARCHAR NOT NULL
coverage_scope JSONB NOT NULL
fully_covered_count INT NOT NULL
partially_covered_count INT NOT NULL
not_covered_count INT NOT NULL
unknown_count INT NOT NULL
coverage_matrix_uri TEXT NOT NULL
coverage_matrix_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.28 `requirement_baselines`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
baseline_name VARCHAR NOT NULL
baseline_version VARCHAR NOT NULL
requirement_ids JSONB NOT NULL
constraint_ids JSONB NOT NULL
goal_ids JSONB NOT NULL
approved_assumption_ids JSONB NOT NULL
open_question_ids JSONB NOT NULL
accepted_conflict_ids JSONB NOT NULL
variant_scope JSONB NOT NULL
source_snapshot_hash CHAR(64) NOT NULL
policy_snapshot_hash CHAR(64) NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, baseline_name, baseline_version)
```

## 56.29 `requirement_change_requests`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
change_key VARCHAR NOT NULL
change_type VARCHAR NOT NULL
reason TEXT NOT NULL
source_reference JSONB NOT NULL
affected_requirement_ids JSONB NOT NULL
proposed_changes JSONB NOT NULL
variant_scope JSONB NOT NULL
impact_summary JSONB NULL
required_reverification JSONB NOT NULL
effective_revision VARCHAR NULL
status VARCHAR NOT NULL
requested_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(project_id, change_key)
```

## 56.30 `requirement_change_impact_runs`

```text
id UUID PK
change_request_id UUID NOT NULL
baseline_id UUID NOT NULL
graph_version_id UUID NOT NULL
impacted_requirements JSONB NOT NULL
impacted_design_objects JSONB NOT NULL
impacted_agents JSONB NOT NULL
impacted_tests JSONB NOT NULL
impacted_artifacts JSONB NOT NULL
risk_summary JSONB NOT NULL
impact_report_uri TEXT NOT NULL
impact_report_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 56.31 `requirement_review_decisions`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
object_type VARCHAR NOT NULL
object_id UUID NOT NULL
decision VARCHAR NOT NULL
comment TEXT NULL
decision_scope JSONB NOT NULL
decided_by UUID NOT NULL
decided_at TIMESTAMPTZ NOT NULL
```

## 56.32 `requirement_release_manifests`

```text
id UUID PK
baseline_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
project_identity JSONB NOT NULL
source_documents JSONB NOT NULL
requirements JSONB NOT NULL
constraints JSONB NOT NULL
goals JSONB NOT NULL
assumptions JSONB NOT NULL
questions JSONB NOT NULL
conflicts JSONB NOT NULL
traceability_summary JSONB NOT NULL
verification_summary JSONB NOT NULL
approvals JSONB NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(baseline_id)
```

---

# 57. 对象存储

```text
derived/requirements/
  {tenant_id}/{project_id}/
    jobs/
      {job_id}/
        input/
          source-manifest.json
          input-snapshot.json
          project-context.json
          template-snapshot.json
          terminology-snapshot.json
          policy-snapshot.json
        source/
          originals/
          previews/
          parsed/
          tables/
          images/
        evidence/
          anchors.jsonl.zst
          text-spans/
          table-cells/
          image-regions/
          meeting-segments/
        candidates/
          requirement-candidates.jsonl.zst
          extracted-values.jsonl.zst
          classifications.jsonl.zst
        normalized/
          requirement-ir.json
          requirements.jsonl.zst
          constraints.jsonl.zst
          goals.jsonl.zst
          assumptions.jsonl.zst
          conditions.jsonl.zst
        analysis/
          ambiguities.jsonl.zst
          conflicts.jsonl.zst
          missing-items.jsonl.zst
          consistency.json
          completeness.json
          feasibility-precheck.json
        questions/
          clarification-questions.jsonl.zst
          answer-packages/
        graph/
          requirement-graph.json
          traceability.jsonl.zst
          allocations.jsonl.zst
          derivations.jsonl.zst
        verification/
          acceptance-criteria.jsonl.zst
          verification-methods.jsonl.zst
          test-traceability.csv
        review/
          decisions.jsonl.zst
          comments.jsonl.zst
          approvals.json
        baselines/
          candidates/
          manifests/
        changes/
          change-requests/
          impact/
          diffs/
        reports/
          requirement-report.html
          requirement-report.pdf
          requirement-matrix.csv
          constraints.csv
          assumptions.csv
          open-questions.csv
          conflicts.csv
          coverage.csv
          traceability.csv
        debug/
          extraction-trace.jsonl.zst
          rule-trace.jsonl.zst
          model-trace.jsonl.zst
          resource-usage.json
```

---

# 58. API 设计

## 58.1 Intake Jobs

```text
POST /api/v1/requirements/jobs
POST /api/v1/requirements/jobs/batch
GET  /api/v1/requirements/jobs/{id}
GET  /api/v1/requirements/jobs/{id}/events
POST /api/v1/requirements/jobs/{id}/cancel
POST /api/v1/requirements/jobs/{id}/retry
POST /api/v1/requirements/jobs/{id}/rerun
```

## 58.2 Sources

```text
POST /api/v1/requirements/sources
GET  /api/v1/requirements/sources
GET  /api/v1/requirements/sources/{id}
POST /api/v1/requirements/sources/{id}/parse
POST /api/v1/requirements/sources/{id}/supersede
GET  /api/v1/requirements/sources/{id}/evidence
```

## 58.3 Extraction

```text
POST /api/v1/requirements/jobs/{id}/extract
GET  /api/v1/requirements/jobs/{id}/candidates
POST /api/v1/requirements/candidates/{id}/accept
POST /api/v1/requirements/candidates/{id}/reject
POST /api/v1/requirements/candidates/{id}/edit
```

## 58.4 Requirements

```text
GET  /api/v1/requirements/projects/{project_id}/requirements
POST /api/v1/requirements/projects/{project_id}/requirements
GET  /api/v1/requirements/{id}
PATCH /api/v1/requirements/{id}
GET  /api/v1/requirements/{id}/versions
POST /api/v1/requirements/{id}/supersede
POST /api/v1/requirements/{id}/allocate
```

## 58.5 Normalization

```text
POST /api/v1/requirements/jobs/{id}/normalize
POST /api/v1/requirements/jobs/{id}/normalize-units
POST /api/v1/requirements/jobs/{id}/resolve-terms
GET  /api/v1/requirements/jobs/{id}/normalization-report
```

## 58.6 Ambiguity, Conflicts and Questions

```text
POST /api/v1/requirements/jobs/{id}/detect-ambiguities
POST /api/v1/requirements/jobs/{id}/detect-conflicts
POST /api/v1/requirements/jobs/{id}/generate-questions
GET  /api/v1/requirements/projects/{project_id}/ambiguities
GET  /api/v1/requirements/projects/{project_id}/conflicts
GET  /api/v1/requirements/projects/{project_id}/questions
POST /api/v1/requirements/questions/{id}/answer
POST /api/v1/requirements/conflicts/{id}/resolve
```

## 58.7 Assumptions

```text
GET  /api/v1/requirements/projects/{project_id}/assumptions
POST /api/v1/requirements/projects/{project_id}/assumptions
POST /api/v1/requirements/assumptions/{id}/approve
POST /api/v1/requirements/assumptions/{id}/reject
```

## 58.8 Graph and Traceability

```text
POST /api/v1/requirements/projects/{project_id}/build-graph
GET  /api/v1/requirements/projects/{project_id}/graph
POST /api/v1/requirements/{id}/trace-links
GET  /api/v1/requirements/{id}/trace-links
POST /api/v1/requirements/projects/{project_id}/coverage
GET  /api/v1/requirements/projects/{project_id}/coverage
```

## 58.9 Completeness and Consistency

```text
POST /api/v1/requirements/jobs/{id}/check-completeness
POST /api/v1/requirements/jobs/{id}/check-consistency
POST /api/v1/requirements/jobs/{id}/feasibility-precheck
GET  /api/v1/requirements/jobs/{id}/analysis
```

## 58.10 Acceptance and Verification

```text
POST /api/v1/requirements/{id}/acceptance-criteria
GET  /api/v1/requirements/{id}/acceptance-criteria
POST /api/v1/requirements/{id}/verification-methods
GET  /api/v1/requirements/{id}/verification-methods
POST /api/v1/requirements/projects/{project_id}/verification-plan
```

## 58.11 Baseline

```text
POST /api/v1/requirements/projects/{project_id}/baseline-candidates
GET  /api/v1/requirements/projects/{project_id}/baselines
GET  /api/v1/requirements/baselines/{id}
POST /api/v1/requirements/baselines/{id}/approve
POST /api/v1/requirements/baselines/{id}/freeze
GET  /api/v1/requirements/baselines/{id}/manifest
```

## 58.12 Changes

```text
POST /api/v1/requirements/projects/{project_id}/change-requests
GET  /api/v1/requirements/projects/{project_id}/change-requests
GET  /api/v1/requirements/change-requests/{id}
POST /api/v1/requirements/change-requests/{id}/analyze-impact
POST /api/v1/requirements/change-requests/{id}/approve
POST /api/v1/requirements/change-requests/{id}/apply
GET  /api/v1/requirements/change-impact/{id}
```

## 58.13 Reports

```text
GET  /api/v1/requirements/jobs/{id}/report
GET  /api/v1/requirements/projects/{project_id}/requirement-matrix.csv
GET  /api/v1/requirements/projects/{project_id}/traceability.csv
GET  /api/v1/requirements/projects/{project_id}/open-questions.csv
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 59. 输入事件

```text
project.created
project.context.updated
requirement.source.uploaded
requirement.source.updated
customer.feedback.received
meeting.decision.recorded
product.variant.created
compliance.target.updated
requirement.intake.requested
```

---

# 60. 输出事件

```text
requirements.source-parse-failed
requirements.candidates-ready
requirements.ambiguity-detected
requirements.conflict-detected
requirements.critical-information-missing
requirements.clarification-required
requirements.draft-ready
requirements.review-required
requirements.baseline-candidate-ready
requirements.baseline-approved
requirements.baseline-frozen
requirements.change-impact-ready
requirements.traceability-gap-detected
requirements.completed
requirements.failed
```

---

# 61. 下游事件

```text
requirements.architecture-input-ready
requirements.firmware-input-ready
requirements.schematic-input-ready
requirements.pcb-constraint-input-ready
requirements.mechanical-input-ready
requirements.manufacturing-input-ready
requirements.verification-plan-ready
```

---

# 62. Policy 组织

```text
policies/
├── requirement-structuring-1.0.0.yaml
├── source-authority.yaml
├── extraction/
│   ├── object-types.yaml
│   ├── strength.yaml
│   ├── priority.yaml
│   ├── domains.yaml
│   └── scopes.yaml
├── normalization/
│   ├── units.yaml
│   ├── terminology.yaml
│   ├── ranges.yaml
│   ├── tolerances.yaml
│   └── conditions.yaml
├── ambiguity/
│   ├── vague-terms.yaml
│   ├── missing-context.yaml
│   └── question-generation.yaml
├── conflicts/
│   ├── authority.yaml
│   ├── numeric.yaml
│   ├── variant.yaml
│   └── resolution.yaml
├── completeness/
│   ├── common.yaml
│   ├── power.yaml
│   ├── interfaces.yaml
│   ├── mechanical.yaml
│   ├── environment.yaml
│   ├── compliance.yaml
│   ├── manufacturing.yaml
│   └── product-templates/
├── derivation/
│   ├── enterprise-rules.yaml
│   ├── power.yaml
│   ├── derating.yaml
│   └── verification.yaml
├── acceptance/
│   ├── methods.yaml
│   ├── pass-fail.yaml
│   └── evidence.yaml
├── baseline.yaml
├── changes.yaml
├── ai-boundaries.yaml
├── security.yaml
└── enterprise/
```

---

# 63. Extractor Provider 接口

```python
class RequirementExtractorProvider:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_input(self, source) -> ValidationResult: ...
    async def extract_candidates(self, request) -> CandidateSet: ...
    async def explain(self, candidate) -> ExtractionTrace: ...
```

Provider 类型：

```text
deterministic_text
table_extractor
document_layout
image_understanding
rule_based
language_model
enterprise_template
```

---

# 64. Provider 使用原则

推荐顺序：

```text
结构化字段和表格解析
→ 确定性正则、词典、单位和模板规则
→ 文档布局与图像语义
→ 大模型语义候选
→ 人工审核
```

能由程序确定的内容，不交给大模型决定。

---

# 65. 大模型输出约束

大模型只能返回 Schema 约束的候选对象：

```text
candidate text
object type
domain
scope
strength
value candidate
condition candidate
evidence reference
ambiguity
confidence dimensions
```

禁止自由文本直接写入 Approved Requirement。

---

# 66. Confidence Dimensions

不要只保存一个分数：

```text
source_quality
text_extraction_quality
semantic_classification_quality
value_extraction_quality
unit_quality
scope_quality
condition_quality
evidence_alignment_quality
```

---

# 67. Terminology Registry

保存企业术语：

```text
term
canonical term
domain
definition
abbreviations
forbidden interpretation
project-specific meaning
source
version
approval
```

例如：

```text
“工业级” → 不允许默认映射温度范围
“低功耗” → 必须追问工作模式和数值
“USB” → 必须分解物理、协议、角色和电源
```

---

# 68. Unit Registry

支持：

```text
voltage
current
power
energy
resistance
capacitance
inductance
frequency
time
temperature
length
area
volume
mass
force
pressure
humidity
speed
data rate
cost
quantity
percentage
```

要求：

- 内部标准单位；
- Decimal；
- 原始表示保留；
- 单位缺失不自动猜；
- 温度单位明确；
- 币种、数量和日期条件绑定；
- dB、dBm、ppm、百分比等语义单独处理。

---

# 69. Expression IR

条件和公式使用受限表达式：

```text
comparison
boolean
range
membership
arithmetic
conditional
reference
```

禁止执行任意代码。

---

# 70. Source Intake 安全

- 文件按租户和项目隔离；
- MIME 由内容识别，不只依赖扩展名；
- 压缩包防 Zip Bomb、Path Traversal 和 Symlink；
- PDF、Office、HTML、CSV 和图片在隔离 Worker 中解析；
- 不执行宏、脚本、外部链接和嵌入对象；
- 限制文件大小、页数、图片像素、Sheet 数、表格数和解析时间；
- 对 CSV 防 Formula Injection；
- 对 HTML 清理活动内容；
- 密码保护文件进入人工处理；
- 原始文件不可覆盖；
- Parser 版本和 Hash 进入 Snapshot。

---

# 71. 隐私和权限

- 客户需求、合同、报价和图片按项目权限隔离；
- Source Authority 修改需要权限；
- 合同要求和客户批准需求不能由普通工程师静默降级；
- AI 只接收最小必要内容；
- 外部模型使用必须按租户 Policy；
- 机密来源可要求本地模型或私有部署；
- Baseline Approval、Conflict Resolution 和 Assumption Approval 分权；
- Requirement、Evidence、Decision、Baseline 和 Change 不可硬删除；
- 导出报告按权限脱敏客户名、成本和合同条款。

---

# 72. Review Workbench

界面建议：

```text
左：Sources / Domains / Status / Priority / Variant
中：原文、表格、图片和 Evidence 高亮
右：结构化 Requirement、数值、单位、条件和 Trace
下：Ambiguities、Conflicts、Questions、Coverage、Graph、Changes
```

---

# 73. Review 操作

```text
接受/拒绝候选
修改分类
修正数值和单位
查看原始证据
合并/拆分需求
标记假设
创建澄清问题
解决冲突
分配到子系统
生成验收标准
批准 Baseline
比较版本
查看影响传播
```

---

# 74. 可观测性

```text
requirement_jobs_total{status,profile}
requirement_job_duration_seconds{step}
requirement_sources_total{type,parse_status}
requirement_candidates_total{object_type,review_status}
requirements_total{domain,status,strength}
requirement_ambiguities_total{type}
requirement_conflicts_total{type,status}
requirement_missing_items_total{domain}
requirement_questions_total{status}
requirement_assumptions_total{approval_status}
requirement_traceability_coverage_ratio{target_type}
requirement_baselines_total{status}
requirement_change_requests_total{status}
requirement_external_model_calls_total{provider,status}
```

---

# 75. Dashboard

```text
Projects
Source Intake
Extraction Progress
Requirement Domains
Critical Missing Items
Ambiguities
Conflicts
Questions
Assumptions
Acceptance Criteria
Traceability
Coverage
Baselines
Changes
Downstream Impact
```

---

# 76. 推荐技术栈

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

文档和数据：

```text
PyMuPDF or equivalent PDF text/layout adapter
python-docx adapter
openpyxl for spreadsheet intake
HTML parser
Polars
PyArrow
DuckDB
Decimal
```

图与检索：

```text
PostgreSQL relational graph first
optional graph database adapter
full-text search
vector retrieval only for candidate retrieval
```

前端：

```text
React
TypeScript
PDF/Image Evidence Viewer
Spreadsheet Cell Viewer
Requirement Matrix
Dependency Graph
Diff Viewer
```

模型：

```text
provider abstraction
structured output
local/private model option
prompt and model version registry
```

---

# 77. 推荐仓库结构

```text
requirements-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docs/
│   ├── requirements-agent-spec.md
│   ├── source-intake-and-evidence.md
│   ├── requirement-ir.md
│   ├── classification-and-normalization.md
│   ├── quantity-unit-condition-model.md
│   ├── ambiguity-and-questions.md
│   ├── conflicts-and-authority.md
│   ├── completeness-templates.md
│   ├── dependency-and-traceability.md
│   ├── acceptance-and-verification.md
│   ├── baselines-and-changes.md
│   ├── downstream-agent-contracts.md
│   ├── ai-boundaries.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-source-evidence-is-first-class.md
│       ├── 0002-requirements-and-assumptions-are-separate.md
│       ├── 0003-unknown-is-not-a-default.md
│       ├── 0004-ai-produces-candidates-not-approved-truth.md
│       ├── 0005-requirements-must-be-verifiable.md
│       ├── 0006-baselines-are-immutable.md
│       └── 0007-change-impact-uses-traceability.md
├── src/
│   └── requirements_agent/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── intake/
│       │   ├── registry.py
│       │   ├── snapshots.py
│       │   ├── file_types.py
│       │   └── security.py
│       ├── parsers/
│       │   ├── pdf.py
│       │   ├── docx.py
│       │   ├── spreadsheet.py
│       │   ├── html.py
│       │   ├── email.py
│       │   ├── image.py
│       │   └── meeting.py
│       ├── evidence/
│       │   ├── anchors.py
│       │   ├── text_spans.py
│       │   ├── tables.py
│       │   ├── image_regions.py
│       │   └── hashes.py
│       ├── extraction/
│       │   ├── providers.py
│       │   ├── deterministic.py
│       │   ├── tables.py
│       │   ├── multimodal.py
│       │   ├── language_model.py
│       │   └── candidates.py
│       ├── classification/
│       │   ├── object_types.py
│       │   ├── domains.py
│       │   ├── scopes.py
│       │   ├── strength.py
│       │   └── priority.py
│       ├── normalization/
│       │   ├── terminology.py
│       │   ├── units.py
│       │   ├── quantities.py
│       │   ├── ranges.py
│       │   ├── tolerances.py
│       │   └── conditions.py
│       ├── analysis/
│       │   ├── ambiguity.py
│       │   ├── conflicts.py
│       │   ├── completeness.py
│       │   ├── consistency.py
│       │   └── feasibility.py
│       ├── questions/
│       │   ├── generator.py
│       │   ├── ranking.py
│       │   └── answers.py
│       ├── assumptions/
│       ├── graph/
│       │   ├── builder.py
│       │   ├── dependencies.py
│       │   ├── allocations.py
│       │   ├── derivations.py
│       │   └── coverage.py
│       ├── verification/
│       │   ├── acceptance.py
│       │   ├── methods.py
│       │   ├── test_trace.py
│       │   └── evidence.py
│       ├── baselines/
│       │   ├── candidates.py
│       │   ├── approvals.py
│       │   ├── manifests.py
│       │   └── diffs.py
│       ├── changes/
│       │   ├── requests.py
│       │   ├── impact.py
│       │   ├── propagation.py
│       │   └── application.py
│       ├── downstream/
│       │   ├── architecture.py
│       │   ├── firmware.py
│       │   ├── schematic.py
│       │   ├── pcb_constraints.py
│       │   ├── mechanical.py
│       │   ├── manufacturing.py
│       │   └── verification.py
│       ├── review/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── terminology/
├── templates/
├── prompts/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_requirement_readiness.py
    ├── parse_requirement_sources.py
    ├── extract_requirement_candidates.py
    ├── build_requirement_ir.py
    ├── run_requirement_analysis.py
    ├── build_traceability.py
    ├── generate_acceptance_criteria.py
    ├── freeze_requirement_baseline.py
    ├── analyze_requirement_change.py
    └── run_requirements_benchmark.py
```


---

# 78. Codex 分阶段实施

不要让 Codex 一次实现文档解析、多模态提取、需求分类、单位归一化、冲突分析、依赖图、验收标准、基线、变更影响和完整 UI。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. 当前项目、客户、产品、Variant 和权限模型；
2. 当前文件上传、对象存储和文档解析能力；
3. 当前 PDF、DOCX、XLSX、CSV、HTML、邮件、图片和会议记录支持；
4. 当前 Source Registry、版本、Hash 和权限；
5. 当前 OCR、文档布局、表格、图片理解和多语言能力；
6. 当前需求、约束、目标、风险、问题和决策数据模型；
7. 当前单位、数值、范围、公差和条件表达；
8. 当前术语库、缩写和企业词典；
9. 当前需求模板和产品分类模板；
10. 当前冲突、重复、模糊、缺失项和澄清问题；
11. 当前依赖图、追溯矩阵和设计对象链接；
12. 当前验收标准、验证方法和测试用例；
13. 当前 Baseline、版本、审批和 Change Request；
14. 当前 Agent 16–30 的输入输出契约；
15. 当前 PLM、CRM、项目管理、邮件和会议系统接口；
16. 当前大模型 Provider、结构化输出、Prompt、版本和成本统计；
17. 当前本地模型、私有模型和外部模型数据策略；
18. 当前 Review UI、Evidence Viewer、Requirement Matrix 和 Diff；
19. 当前 Queue、Worker、Database、Storage 和 Security；
20. 当前开源、合成、脱敏或授权 Fixture；
21. 统计现有项目中需求缺失、冲突和返工原因；
22. 统计需求到设计、测试和制造的追溯覆盖；
23. 统计 AI 提取准确率、人工修改率和证据对齐率；
24. 只运行只读扫描和安全的公开 Fixture 解析；
25. 不修改已有 Requirement；
26. 不冻结 Baseline；
27. 不调用生产外部模型；
28. 不创建 Migration；
29. 不安装新的文档/OCR/模型组件；
30. 不读取或打印 Secret、合同、客户机密和外部模型凭证。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Intake Job；
- Input Snapshot；
- Source Document；
- Parse Run；
- Evidence Anchor；
- Candidate；
- Requirement；
- Version；
- Value Object；
- Condition；
- Assumption；
- Ambiguity；
- Conflict；
- Missing Item；
- Clarification Question；
- Graph；
- Derivation；
- Allocation；
- Acceptance Criterion；
- Verification Method；
- Completeness；
- Consistency；
- Feasibility Pre-check；
- Trace Link；
- Coverage；
- Baseline；
- Change Request；
- Impact；
- Decision；
- Release Manifest；
- JSON Schema。

## Phase 2：Secure Source Intake

实现：

- MIME Detection；
- Hash；
- Tenant/Project Isolation；
- Size/Page/Sheet/Image Limit；
- Archive Safety；
- Macro/Script Rejection；
- Password-protected Status；
- Original Preservation；
- Source Authority；
- Security Classification；
- Audit。

## Phase 3：Source Registry and Snapshot

实现：

- Source IDs；
- Version；
- Effective Date；
- Supersedes；
- Authority；
- Input Snapshot；
- Parser/Template/Terminology/Policy Hash；
- Idempotency；
- Immutable Snapshot；
- Source Diff。

## Phase 4：Text and Layout Parsing

实现：

- PDF Text/Layout；
- DOCX；
- HTML；
- Plain Text；
- Paragraph/Heading/List；
- Page Anchors；
- Text Span；
- Stable Locators；
- Parser Warnings；
- Golden Tests。

## Phase 5：Spreadsheet and Table Parsing

实现：

- XLSX/CSV；
- Sheets；
- Cells/Ranges；
- Merged Cells；
- Header Detection；
- Units in Headers；
- Row/Column Meaning；
- Formula Result versus Formula；
- Table Evidence；
- Formula Injection Safety。

## Phase 6：Image and Diagram Evidence

实现：

- Image Registry；
- Bounding Boxes；
- Visible Text Candidate；
- Dimension Annotation Candidate；
- Connector/Block Labels；
- Arrow/Relation Candidate；
- Diagram Objects；
- Confidence；
- Human Review；
- No Pixel-to-mm Guess。

## Phase 7：Meeting, Email and Conversation Intake

实现：

- Message/Speaker/Timestamp；
- Decision Candidate；
- Open Question；
- Contradiction；
- Informal versus Approved；
- Thread Context；
- Evidence Anchors；
- Privacy；
- Source Authority。

## Phase 8：Terminology Registry

实现：

- Canonical Terms；
- Abbreviations；
- Synonyms；
- Project-specific Terms；
- Forbidden Interpretation；
- Domain；
- Source/Version；
- Approval；
- Lookup；
- Conflict Detection。

## Phase 9：Unit and Quantity Model

实现：

- Decimal；
- Unit Registry；
- Original Value；
- Normalized Value；
- Exact/Min/Max/Range/Target；
- Tolerance；
- Enumeration；
- Formula；
- Currency/Quantity/Date；
- Missing Unit；
- Conversion Trace；
- Tests。

## Phase 10：Condition Expression IR

实现：

- Comparison；
- Boolean；
- Range；
- Membership；
- Arithmetic；
- Conditional；
- Reference；
- Safe Evaluation；
- Unit Checking；
- Human-readable Serialization；
- No Arbitrary Code。

## Phase 11：Deterministic Requirement Candidate Extraction

实现：

- Shall/Must/Should/May；
- Numeric Patterns；
- Unit Patterns；
- Table Rows；
- Key-value Fields；
- Prohibition；
- Conditional Sentences；
- Source Anchor；
- Stable Candidate Key；
- Rule Trace。

## Phase 12：Model-assisted Semantic Extraction

实现：

- Structured Schema；
- Source-bounded Context；
- Evidence IDs；
- Object Type；
- Domain；
- Scope；
- Strength；
- Value/Condition Candidate；
- Ambiguity Candidate；
- No Unsupported Facts；
- Provider Version；
- Cost/Token Metrics；
- Contract Tests。

## Phase 13：Candidate Deduplication and Segmentation

实现：

- Exact Duplicate；
- Same Evidence；
- Semantic Candidate；
- Split Compound Requirement；
- Merge Repeated Requirement；
- Preserve Source Statements；
- No Text-only Auto-merge；
- Review Trace。

## Phase 14：Object Type Classification

实现：

- Requirement；
- Constraint；
- Goal；
- Preference；
- Assumption；
- Decision；
- Risk；
- Question；
- Recommendation；
- Exclusion；
- Confidence；
- Override Review。

## Phase 15：Domain, Scope and Strength Classification

实现：

- Domains；
- Product/System/Board/Firmware/Mechanical/Manufacturing；
- Shall/Must/Should/Target；
- Source Context；
- Multi-label Support；
- Conflict；
- Classification Trace。

## Phase 16：Requirement Normalization

实现：

- Original Statement；
- Normalized Statement；
- Controlled Subject；
- Action/Metric/Object；
- Value；
- Condition；
- No New Facts；
- Language Preservation；
- Translation as Separate Field；
- Stable IDs。

## Phase 17：Power and Battery Schema

实现：

- Input；
- Rails；
- Budget；
- Peak/Idle/Sleep；
- Startup；
- Sequencing；
- Battery；
- Runtime；
- Charging；
- Protection；
- Missing Context；
- Domain Tests。

## Phase 18：Interface and Protocol Schema

实现：

- Physical；
- Electrical；
- Protocol；
- Role；
- Direction；
- Rate；
- Levels；
- Isolation；
- Connector；
- Cable；
- Pin Assignment；
- Ambiguity；
- Compatibility；
- Tests。

## Phase 19：Performance and Timing Schema

实现：

- Metrics；
- Range；
- Accuracy；
- Resolution；
- Bandwidth；
- Latency；
- Throughput；
- Noise；
- Drift；
- Conditions；
- Measurement Method；
- Verifiability。

## Phase 20：Mechanical and Environmental Schema

实现：

- Dimensions；
- Weight；
- Mounting；
- Openings；
- Keepouts；
- Temperature；
- Humidity；
- Shock/Vibration/Drop；
- Ingress；
- Chemical；
- Storage/Charging Conditions；
- Agent 28 Contract。

## Phase 21：Cost, Volume and Schedule Schema

实现：

- BOM/Fabrication/Assembly/NRE；
- Currency；
- Quantity Tier；
- Date；
- Tax/Duty；
- Prototype/Pilot/Mass；
- Deadlines；
- Dependencies；
- Unknown Context；
- No Price Guess。

## Phase 22：Compliance and Quality Schema

实现：

- Market；
- Product Category；
- Standard Candidate；
- Mandatory/Advisory；
- Evidence；
- Reliability；
- Warranty；
- Calibration；
- Test；
- Human Confirmation；
- No Applicability Decision by AI。

## Phase 23：Manufacturing and Service Schema

实现：

- Board Technology；
- Assembly；
- Special Process；
- Panel；
- Inspection；
- Traceability；
- Repair；
- Replaceability；
- Documentation；
- Packaging；
- Agent 29/30/43/45 Contracts。

## Phase 24：Assumption Register

实现：

- Candidate Assumption；
- Reason；
- Impact；
- Owner；
- Expiry；
- Validation；
- Approval；
- Affected Requirements；
- No Silent Promotion；
- Gate。

## Phase 25：Ambiguity Detection

实现：

- Vague Terms；
- Missing Unit；
- Missing Threshold；
- Missing Condition；
- Scope；
- Role；
- Variant；
- Pronoun；
- Visual/Text Conflict；
- Impact；
- Questions。

## Phase 26：Conflict Detection

实现：

- Numeric；
- Range；
- Interface Role；
- Variant；
- Source Version；
- Cost/Schedule；
- Power/Runtime；
- Mechanical/Interface；
- Compliance/Market；
- Evidence；
- No Auto Resolution。

## Phase 27：Source Authority and Resolution Workflow

实现：

- Authority Levels；
- Effective Dates；
- Superseded Sources；
- Decision Options；
- Human Decision；
- Requirement Supersession；
- Audit；
- Conflict Closure Gate。

## Phase 28：Completeness Templates

实现：

- Common Domains；
- Product Categories；
- Required/Optional/Not Applicable；
- Template Version；
- Missing Items；
- Required Before Phase；
- User-custom Templates；
- No Auto Requirement Creation。

## Phase 29：Consistency Checks

实现：

- Units；
- Ranges；
- Variants；
- Interfaces；
- Power Budget；
- Cost/Quantity；
- Schedule；
- Environment；
- Compliance Scope；
- Deterministic Finding；
- Evidence。

## Phase 30：Feasibility Pre-check

实现：

- Obvious Contradiction；
- Power/Runtime；
- Size/Thermal；
- Performance/Cost；
- Schedule/Certification；
- Lifecycle/Supply；
- Risk Candidate；
- Downstream Agent Routing；
- No Final Feasibility Claim。

## Phase 31：Clarification Question Generator

实现：

- Question Templates；
- Reason；
- Affected Items；
- Impact；
- Options；
- Default Candidate Marked as Candidate；
- Priority；
- Owner；
- Required Before Phase；
- Dedup；
- Review।

## Phase 32：Requirement Dependency Graph

实现：

- Nodes；
- Edges；
- Derived From；
- Depends On；
- Conflicts；
- Supersedes；
- Allocates；
- Verifies；
- Stable Graph；
- Hash；
- Graph Query。

## Phase 33：Derived Requirement Engine

实现：

- Approved Rules；
- Inputs；
- Formula/Policy；
- Trace；
- Candidate Status；
- Approval；
- No Model-only Derivation；
- Recompute on Change；
- Tests。

## Phase 34：Requirement Allocation

实现：

- System/Sub-system/Board/Module/Component/Firmware/Mechanical/Test；
- Allocation Rationale；
- Shared Allocation；
- Partial Allocation；
- Coverage；
- Review UI；
- Downstream Packages。

## Phase 35：Acceptance Criteria Generator

实现：

- Preconditions；
- Setup；
- Inputs；
- Procedure；
- Measurement；
- Expected；
- Tolerance；
- Pass/Fail；
- Evidence；
- Draft Status；
- Human Approval；
- No Invented Threshold。

## Phase 36：Verification Method Planner

实现：

- Inspection/Analysis/Calculation/Simulation/Test/Demonstration；
- Equipment；
- Environment；
- Phase；
- Responsible Role；
- Evidence；
- Agent 23/27/28/30/45 Routing；
- Coverage。

## Phase 37：Traceability Links

实现：

- Requirement-to-Architecture；
- Schematic；
- Net；
- Firmware；
- PCB Constraint；
- Mechanical；
- Manufacturing；
- Test；
- Compliance Evidence；
- Source Agent/Revision；
- Confidence；
- Broken Link Detection。

## Phase 38：Coverage and Gap Analysis

实现：

- Fully/Partially/Not/Unknown；
- Baseline；
- Target Revision；
- Domain/Variant；
- Critical Gap；
- Matrix；
- CI Gate；
- Event。

## Phase 39：Review Workbench

实现：

- Source Viewer；
- Evidence Highlight；
- Candidate Review；
- Requirement Matrix；
- Value/Condition Editor；
- Ambiguities；
- Conflicts；
- Questions；
- Assumptions；
- Graph；
- Acceptance；
- Diff。

## Phase 40：Baseline Candidate

实现：

- Approved Objects；
- Open Questions；
- Accepted Conflicts；
- Assumptions；
- Variants；
- Source/Policy Snapshot；
- Manifest；
- Hash；
- Review Summary；
- Gate。

## Phase 41：Approval and Immutable Baseline

实现：

- Customer/Product/Engineering/System Roles；
- Approval Scope；
- Reject/Revise；
- Baseline Freeze；
- Immutable Manifest；
- No AI Approval；
- Audit；
- Events。

## Phase 42：Change Request and Versioning

实现：

- Change Types；
- Old/New；
- Source；
- Reason；
- Variant；
- Effective Revision；
- Approval；
- Requirement Version；
- Supersession；
- Baseline Link。

## Phase 43：Change Impact Analysis

实现：

- Graph Traversal；
- Design Objects；
- Agents；
- Tests；
- Manufacturing Artifacts；
- Compliance；
- Cost/Schedule；
- Re-verification；
- Risk；
- Impact Package；
- No Auto Change Application。

## Phase 44：Downstream Agent Contracts

实现：

- Architecture Input；
- Firmware Input；
- Schematic Input；
- PCB Constraint Input；
- Mechanical Input；
- Manufacturing Input；
- Verification Plan；
- Schema Version；
- Baseline Reference；
- Evidence；
- Change Events。

## Phase 45：API、Jobs、Events 和 Storage

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
- Artifact Lifecycle；
- Retention；
- Re-indexing。

## Phase 46：Benchmark、监控和生产发布

实现：

- Source Format Matrix；
- Requirement Extraction；
- Value/Unit；
- Evidence Alignment；
- Classification；
- Ambiguity；
- Conflict；
- Completeness；
- Questions；
- Traceability；
- Change Impact；
- Security；
- Performance；
- Provider Rollback；
- Feature Flags；
- Disaster Recovery。

## Phase 47：高级能力，可选

稳定后：

- Customer Portal Requirement Review；
- Live Meeting Requirement Capture；
- Contract Clause Linkage；
- Multilingual Bidirectional Baselines；
- Requirement Similarity Across Projects；
- Requirement Reuse Library；
- Compliance Knowledge Connector；
- Requirement-to-Cost Optimization；
- Formal Constraint Solver；
- 仍不让 AI 自动批准需求或法规适用性。

---

# 79. Codex 工作纪律

Codex 必须：

1. 原始来源不可修改；
2. Input Snapshot 不可变；
3. Evidence Anchor 是一级对象；
4. 每条 Requirement 可回到 Evidence；
5. Customer Explicit 与 AI Candidate 分开；
6. Requirement、Constraint、Goal、Assumption 分开；
7. 原文和归一化文本同时保存；
8. 不在归一化时增加新事实；
9. 数值使用 Decimal；
10. 原始单位保留；
11. 单位缺失不猜；
12. Range/Target/Tolerance 分开；
13. Condition 是结构化对象；
14. Currency 必须带 Quantity/Date Context；
15. Strength 不只按关键词；
16. Priority 不由 AI 独断；
17. Source Authority 版本化；
18. Superseded Source 显式；
19. AI 输出只进入 Candidate；
20. AI 必须返回 Evidence IDs；
21. 无 Evidence 的候选不能自动接受；
22. Confidence 是多维；
23. 术语定义版本化；
24. “工业级”“低功耗”“高精度”等必须触发澄清；
25. 图片比例不等于真实尺寸；
26. OCR/视觉文字只是候选；
27. 表格单元格和表头一起解释；
28. 公式和显示值分开保存；
29. 假设需 Owner、Impact 和 Approval；
30. 未批准假设不进入 Baseline；
31. 冲突不自动解决；
32. Authority 只提供排序，不替代决策；
33. 缺失项不自动补成行业默认；
34. Template 只用于完整性检查；
35. Derived Requirement 有规则和输入；
36. AI 不能独立生成 Derived Hard Constraint；
37. Acceptance Criteria 是草稿直到批准；
38. Pass/Fail 不得出现来源之外的新阈值；
39. Compliance 只生成候选范围；
40. Requirement Allocation 有目标对象；
41. Trace Link 绑定目标 Revision；
42. Broken Trace 必须报告；
43. Baseline 不可覆盖；
44. Baseline 必须有 Manifest 和 Hash；
45. Change 使用 Change Request；
46. Change Impact 基于 Graph；
47. 不自动修改下游设计；
48. 下游 Package 必须绑定 Baseline；
49. 外部模型调用受 Policy；
50. 机密来源支持本地/私有模型；
51. 不发送完整合同给非批准模型；
52. 不在日志打印敏感原文；
53. 不用客户资料做公开 Fixture；
54. 不伪造来源、证据、审批或 Benchmark；
55. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Parser/Model/Rule 变化；
    - 测试命令和真实结果；
    - Source/Evidence；
    - Candidates/Normalization；
    - Ambiguity/Conflict；
    - Completeness/Questions；
    - Graph/Traceability；
    - Acceptance/Verification；
    - Baseline/Change；
    - 性能；
    - 安全；
    - 已知限制；
    - 下一阶段建议。

---

# 80. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Source Intake

1. Plain Text；
2. PDF Text；
3. PDF Table；
4. Scanned PDF Candidate；
5. DOCX Headings；
6. XLSX Requirements；
7. CSV；
8. HTML；
9. Email Thread；
10. Meeting Transcript；
11. Image Annotation；
12. Block Diagram；
13. Password-protected；
14. Corrupted File；
15. Zip Bomb；
16. Path Traversal；
17. Macro Rejection；
18. Oversized Image；
19. Mixed Language；
20. Source Supersession。

## Evidence and Extraction

21. Text Span Anchor；
22. Table Cell Anchor；
23. Image Bounding Box；
24. Meeting Timestamp；
25. Shall Requirement；
26. Should Goal；
27. Prohibition；
28. Conditional Requirement；
29. Numeric Range；
30. Tolerance；
31. Enumeration；
32. Formula；
33. Multi-requirement Sentence；
34. Duplicate Requirement；
35. Same Text Different Variant；
36. Candidate without Evidence；
37. Model Unsupported Fact；
38. Low-confidence OCR；
39. Table Header Unit；
40. Footnote Condition。

## Domain Normalization

41. Input Voltage；
42. Power Budget；
43. Battery Runtime Missing Duty Cycle；
44. USB Ambiguity；
45. CAN Interface；
46. Analog Accuracy；
47. Sample Rate；
48. Latency；
49. Mechanical Size；
50. Connector Position；
51. Operating/Storage Temperature；
52. Charging Temperature；
53. BOM Cost Quantity Tier；
54. Currency Missing；
55. Compliance Market Missing；
56. Manufacturing Quantity；
57. Warranty；
58. Calibration；
59. Prototype Schedule；
60. DNP Variant。

## Ambiguity and Conflict

61. “Low Power”；
62. “Industrial Grade”；
63. “High Accuracy”；
64. Missing Unit；
65. Missing Threshold；
66. Missing Operating Condition；
67. 5V versus 9–24V；
68. USB Host versus Device；
69. IP65 versus Indoor；
70. Rev A versus Rev B；
71. Cost versus Performance；
72. Size versus Thermal；
73. Runtime versus Battery Size；
74. Market/Compliance Conflict；
75. Visual/Text Conflict；
76. Authority Ranking；
77. Human Conflict Resolution；
78. Unresolved Conflict Gate；
79. Assumption Approval；
80. Assumption Expiry。

## Completeness and Verification

81. Common Template；
82. IoT Sensor Template；
83. Portable Instrument；
84. Missing Power；
85. Missing Mechanical；
86. Not Applicable Domain；
87. Acceptance Criterion Draft；
88. No Invented Threshold；
89. Inspection Method；
90. Simulation Method；
91. Lab Test；
92. Compliance Lab Candidate；
93. Missing Verification Method；
94. Non-verifiable Requirement；
95. Test Traceability。

## Baseline and Change

96. Baseline Candidate；
97. Approval Missing；
98. Immutable Baseline；
99. Variant Baseline；
100. Source Hash Change；
101. Change Request；
102. Numeric Change；
103. Requirement Removal；
104. Variant Override；
105. Change Impact Graph；
106. PCB Constraint Impact；
107. Firmware Impact；
108. Mechanical Impact；
109. Manufacturing Release Impact；
110. Test Re-verification；
111. Broken Trace；
112. Baseline Diff；
113. Unauthorized Approval；
114. Tenant Isolation；
115. Audit Replay。

---

# 81. 初始质量目标

```text
Approved Requirement Evidence Coverage = 100%
Approved Numeric Requirement Unit Coverage = 100%
AI Candidate Without Evidence Auto-acceptance = 0
AI Candidate Direct Baseline Entry = 0
Unapproved Assumption Baseline Entry = 0
Unresolved Critical Conflict Baseline Entry = 0
Unknown Unit Silent Conversion = 0
Image Pixel-to-mm Silent Inference = 0
Requirement Original Statement Preservation = 100%
Baseline Manifest and Hash Coverage = 100%
Requirement-to-Test Traceability for Critical Requirements = 100%
Change Request Impact Analysis Coverage = 100%
Private Contract Sent to Unapproved External Model = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 82. 性能要求

常规项目：

```text
10–200 Source Files
100–5,000 Requirement Candidates
100–2,000 Approved Requirements
10–100 Variants/Decisions/Changes
```

目标：

```text
Source Registration P95 < 10 s
Text Document Parse P95 < 30 s
Spreadsheet Parse P95 < 30 s
Candidate Retrieval Query P95 < 300 ms
Deterministic Extraction P95 < 60 s per 500 pages equivalent
Graph Query P95 < 500 ms
Coverage Matrix P95 < 30 s
Change Impact P95 < 30 s for 100k graph edges
```

模型辅助提取：

```text
异步
可取消
可分段重试
保存成本和版本
不阻塞确定性结果
```

大型项目要求：

- 分页和分 Sheet；
- 增量解析；
- Evidence 分片；
- Parquet；
- Worker Pool；
- Model Rate Limit；
- Cache；
- Partial Result；
- 不把整个资料库一次发送给模型。

---

# 83. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/requirements-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第10个 Agent：

Engineering Requirements Structuring, Constraint Extraction & Traceability Agent /
工程需求结构化 Agent。

本 Agent 接收：

- 自然语言；
- PRD/MRD/SOW/RFQ/RFP；
- PDF/DOCX/XLSX/CSV/HTML；
- 邮件、会议纪要和聊天记录；
- 图片、尺寸图、框图和草图；
- 项目、客户、产品、Variant 和企业模板；

输出：

- Source Registry 和 Evidence Anchors；
- Requirement/Constraint/Goal/Preference；
- Quantity/Unit/Range/Tolerance/Condition；
- Assumption/Ambiguity/Conflict/Missing Item；
- Clarification Questions；
- Requirement Dependency Graph；
- Requirement-to-Design/Test Traceability；
- Acceptance Criteria 和 Verification Methods；
- Baseline、Manifest、Change Request 和 Impact；
- Agent 16–30 及后续 Agent 的结构化输入包。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 10 和 Agent 16–30 的规格；
3. docs/requirements-agent-spec.md；
4. 当前 Project/Customer/Product/Variant 模型；
5. 当前 Source Upload/Object Storage；
6. 当前 PDF/DOCX/XLSX/CSV/Image/Email/Meeting Parser；
7. 当前 Requirement/Constraint/Decision/Risk 数据；
8. 当前 Unit/Terminology/Template；
9. 当前 AI Provider/Prompt/Structured Output；
10. 当前 Evidence/Traceability/Graph；
11. 当前 Test/Verification；
12. 当前 Baseline/Approval/Change；
13. 当前 PLM/CRM/PM 接口；
14. 当前 UI/API/Worker/Storage/Security；
15. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Original Sources Immutable；
- One Job = One Immutable Input Snapshot；
- Evidence Anchors First-class；
- Every Approved Requirement Has Evidence；
- Customer Explicit != AI Candidate；
- Requirement != Constraint != Goal != Assumption；
- Preserve Original and Normalized Statements；
- No New Facts During Normalization；
- Decimal and Explicit Units；
- Missing Unit Is Not Guessed；
- Range/Target/Tolerance Separated；
- Conditions Structured；
- Currency Has Quantity/Date Context；
- Source Authority Versioned；
- Superseded Sources Explicit；
- AI Outputs Candidates Only；
- AI Returns Evidence IDs；
- Multi-dimensional Confidence；
- Ambiguous Terms Trigger Questions；
- Image Ratio Is Not Dimension；
- Tables Preserve Header/Footnote Context；
- Assumptions Require Approval；
- Conflicts Require Human Resolution；
- Templates Do Not Auto-create Requirements；
- Derived Requirements Require Approved Rules；
- Acceptance Criteria Are Drafts Until Approval；
- No Invented Pass/Fail Threshold；
- Compliance Applicability Requires Human/Authoritative Data；
- Trace Links Bind Target Revision；
- Baselines Immutable；
- Changes Use Change Requests；
- Impact Uses Requirement Graph；
- Downstream Inputs Bind Baseline；
- No External Private Data Without Policy；
- 不用客户资料做公开 Fixture；
- 不伪造 Evidence、Approval 或 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改需求和 Baseline：

1. 侦察当前仓库；
2. 查找 Project/Customer/Product/Variant；
3. 查找文件上传和对象存储；
4. 查找 PDF/DOCX/XLSX/CSV/HTML/Email/Image/Meeting Parser；
5. 查找 Evidence Anchor；
6. 查找 Requirement/Constraint/Goal/Assumption；
7. 查找 Unit/Value/Range/Tolerance/Condition；
8. 查找 Terminology；
9. 查找 Templates；
10. 查找 AI Provider 和 Structured Output；
11. 查找 Ambiguity/Conflict/Question；
12. 查找 Graph/Traceability；
13. 查找 Acceptance/Test；
14. 查找 Baseline/Approval/Change；
15. 查找 Agent 16–30 Contracts；
16. 查找 UI/API/Worker/Storage/Security；
17. 统计 Source Format Coverage；
18. 统计 Requirement/Evidence Coverage；
19. 统计 Ambiguity/Conflict/Question；
20. 统计 Traceability 和 Change Impact；
21. 抽样分析开源、合成、脱敏或授权 Fixture；
22. 在 docs/requirements-agent-implementation-plan.md 中生成实施计划；
23. 在 docs/source-intake-and-evidence.md 中定义来源和证据；
24. 在 docs/requirement-ir.md 中定义 IR；
25. 在 docs/classification-and-normalization.md 中定义分类；
26. 在 docs/quantity-unit-condition-model.md 中定义数值；
27. 在 docs/ambiguity-and-questions.md 中定义模糊；
28. 在 docs/conflicts-and-authority.md 中定义冲突；
29. 在 docs/completeness-templates.md 中定义完整性；
30. 在 docs/dependency-and-traceability.md 中定义图和追溯；
31. 在 docs/acceptance-and-verification.md 中定义验收；
32. 在 docs/baselines-and-changes.md 中定义 Baseline/Change；
33. 在 docs/downstream-agent-contracts.md 中定义下游；
34. 在 docs/ai-boundaries.md 中定义 AI；
35. 在 docs/security.md 中定义安全；
36. 在 docs/requirements-agent-migration-plan.md 中定义旧流程迁移；
37. 在 docs/requirements-agent-benchmark-plan.md 中定义 Benchmark；
38. 给出拟新增、拟修改和拟复用文件；
39. 给出 Phase 1 精确范围；
40. 不修改业务代码；
41. 不创建 Migration；
42. 不安装 Parser/OCR/模型；
43. 不修改 Requirement；
44. 不冻结 Baseline；
45. 不调用生产外部模型；
46. 不读取或打印 Secret/合同/客户机密；
47. 运行仓库已有 lint、type check、test、build 和 security scan；
48. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Source Intake；
- Evidence Model；
- Requirement IR；
- Object Type/Domain/Scope/Strength；
- Quantity/Unit/Condition；
- Terminology；
- AI Provider Boundaries；
- Assumptions；
- Ambiguities；
- Conflicts/Authority；
- Completeness；
- Clarification Questions；
- Dependency Graph；
- Derived Requirements；
- Allocation；
- Acceptance/Verification；
- Traceability/Coverage；
- Baseline/Approval；
- Change Impact；
- Downstream Agent Contracts；
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

# 84. 后续 Phase 提示词模板

```text
继续实现 Requirements Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 10 和相关下游 Agent 规格；
3. 阅读 Requirements Agent Implementation Plan；
4. 阅读 Source、Evidence、IR、Normalization、Ambiguity、Conflict、Graph、Acceptance、Baseline、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Evidence-grounded；
- AI Candidate Only；
- Explicit Units and Conditions；
- Human Approval for Assumption/Conflict/Baseline；
- Immutable Sources and Baselines；
- Revision-bound Traceability；
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
9. parser/evidence contract test；
10. extraction/normalization test；
11. ambiguity/conflict test；
12. graph/traceability test；
13. baseline/change test；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Parser/Model/Rule 变化；
- 测试命令和真实结果；
- Source/Evidence；
- Candidate/Normalization；
- Ambiguity/Conflict；
- Completeness/Questions；
- Graph/Traceability；
- Acceptance/Verification；
- Baseline/Change；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 85. MVP 演示流程

1. 新建“便携式双通道测量仪”项目；
2. 上传一份 PRD、一张手绘接口草图、一份 Excel 参数表和一次客户会议纪要；
3. 建立 Source Registry；
4. 为所有来源计算 Hash 并冻结 Input Snapshot；
5. 解析 PRD 段落、标题和表格；
6. 解析 Excel 单元格和表头单位；
7. 在图片中锚定 USB-C、BNC、LCD 和按键区域；
8. 将会议中的客户决定按时间戳锚定；
9. 确定性提取：
10. “应支持 9–24 VDC 输入”；
11. “双通道输入”；
12. “整机尺寸不大于 150 × 90 × 30 mm”；
13. “首批 500 台”；
14. 模型辅助识别“尽可能延长电池续航”为 Goal，不生成数值；
15. 将“USB 接口”标记为 Ambiguous；
16. 生成问题：USB-C 仅供电、Device、Host，还是同时支持数据和 PD；
17. 发现 PRD 写最大功耗 10W，Excel 写 15W；
18. 建立 Numeric Conflict；
19. 发现“工作温度 -20～60°C”，但会议中提出“冬季户外使用”；
20. 生成环境范围澄清问题；
21. 发现“成本小于 30 美元”缺少数量、币种基准和是否含组装；
22. 生成成本上下文问题；
23. 将明确需求分类：
24. Power；
25. Interface；
26. Performance；
27. Dimensions；
28. Environment；
29. Cost；
30. Schedule；
31. Manufacturing；
32. 创建 Assumption Candidate：默认 USB 为 Device；
33. 该假设保持未批准，不能进入 Baseline；
34. 客户回答 USB-C 为 Device + 5V 输入，不需要 PD；
35. 关闭 Ambiguity，更新结构化接口要求；
36. 客户确认最大功耗 15W，PRD 中 10W 被标记 Superseded；
37. 建立 Requirement Dependency Graph；
38. 将尺寸要求分配给 Mechanical 和 PCB Placement；
39. 将输入电压分配给 Power Architecture、Schematic 和 Agent 24；
40. 将双通道带宽分配给模拟前端和 Agent 23；
41. 为关键需求生成 Acceptance Criteria 草稿；
42. 输入电压验收：在 9V、12V、24V 和边界条件下测试；
43. 尺寸验收：机械测量；
44. 带宽验收：频率响应测试；
45. 成本验收：指定 500 台数量的 BOM/制造成本快照；
46. 工程师审核验收方法；
47. 运行 Completeness Template；
48. 发现缺失 Storage Temperature、Charging Temperature、ESD Target 和 Calibration；
49. 将问题按“原理图前”“PCB 前”“认证前”排序；
50. 客户和系统工程师批准 Requirement；
51. 冻结 `Requirements Baseline 1.0`；
52. 生成 Manifest 和 Hash；
53. 发送 Power/Interface Package 给架构和原理图流程；
54. 发送 PCB Constraint Package 给 Agent 24；
55. 发送 Mechanical Package 给 Agent 25/28；
56. 发送 Manufacturing Package 给 Agent 29/30；
57. 设计完成后建立 Requirement-to-Design Trace；
58. 发现 USB ESD 要求没有对应保护设计；
59. Coverage Run 标记 Not Covered；
60. Agent 22创建原理图 Finding；
61. 工程修复后更新 Trace；
62. 客户提出尺寸高度从 30mm 改为 25mm；
63. 创建 Change Request；
64. Change Impact 识别：
65. PCB Placement；
66. 高器件；
67. 连接器；
68. 外壳；
69. 散热；
70. Production Drawing；
71. DFM/DFA；
72. 相关 Agent 重新执行；
73. 通过回归后创建 Baseline 1.1；
74. 保留 Baseline 1.0，不覆盖；
75. 发布 `requirements.baseline-frozen`。

---

# 86. 生产上线顺序

第一阶段：

```text
Source Registry
Text/DOCX/XLSX Parsing
Evidence Anchors
Deterministic Candidate Extraction
Requirement IR
Manual Review
```

第二阶段：

```text
Model-assisted Extraction
Ambiguity/Conflict
Completeness Templates
Questions
Acceptance Criteria
Baseline
```

第三阶段：

```text
Dependency Graph
Traceability
Change Impact
Agent 16–30 Contracts
Customer Portal
Private Model Deployment
```

上线优先确保：

```text
每条结构化需求是否能回到原始证据
客户说的、企业规定的和 AI 推测的是否被严格分开
模糊、冲突和缺失是否在开始设计前暴露
需求是否包含数值、单位、条件和可验证标准
需求变化后，哪些设计和生产结果必须重新执行
```

一个可靠的工程需求结构化 Agent，不是把客户的话翻译成更整齐的句子，而是把一句可能引起三个月返工的话，变成一组可计算、可追溯、可验证、可变更控制的工程事实。
