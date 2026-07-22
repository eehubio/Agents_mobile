# 证据锚定与人工审核 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Evidence Anchoring & Human Review Agent  
> 中文名：证据锚定与人工审核 Agent  
> 版本：V1.0  
> 定位：跨 Agent 的统一证据、质量、审核和人工修订基础设施  
>
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent
> - Datasheet Structure & Visual Asset Locator Agent
> - Parameter Extraction & Unit Normalization Agent
> - Pin, Package & Ordering Variant Extraction Agent
>
> 下游：
> - 元器件知识库
> - 参数检索与对比
> - KiCad Symbol / Footprint / 3D 生成
> - 替代料与 Pin-to-Pin 兼容分析
> - Datasheet 版本差异
> - BOM 风险分析
> - 审核工作台与质量运营
> - 规则、Schema、模型和词典改进闭环
>
> 目标读者：产品负责人、后端工程师、数据工程师、前端工程师、算法工程师、审核运营人员、Codex

---

# 1. 项目目标

建设一个独立、可复用、可版本化的证据锚定与人工审核 Agent，为所有自动抽取和推理结果提供统一的证据结构、置信度评估、审核队列、人工修订和审计能力。

该 Agent 必须支持：

1. 为每个参数、分类、章节、表格、图片、引脚、封装和订货型号结果保存完整证据；
2. 保存 PDF 页码、bbox、block_id、table_id、row/column、原文、截图和对象存储 URI；
3. 保存解析器、规则、Schema、模型和 Agent 版本；
4. 保存字段级、证据级和结果级置信度；
5. 根据置信度、冲突、必填缺失和业务风险自动生成审核任务；
6. 将审核任务按对象、严重程度、类别、厂商和批次路由到审核台；
7. 支持人工接受、拒绝、修改、重定位、合并、拆分和重新抽取；
8. 人工修订以 Patch 形式保存，不覆盖机器原始结果；
9. 审核结果可回写知识库，同时保留完整历史；
10. 审核结果可形成规则、Alias、Schema、Unit Registry 和模型训练数据；
11. 支持批量审核、双人复核、抽样质检和审核 SLA；
12. 支持在原 PDF 上高亮证据区域；
13. 支持 Datasheet 新版本后判断原证据是否仍然有效；
14. 支持 110 万器件规模下的高效索引、队列和增量处理。

---

# 2. 核心定位

该 Agent 不是另一个业务抽取器。

它是横跨所有 Agent 的公共基础设施：

```text
Machine Result
    ↓
Evidence Bundle
    ↓
Confidence & Policy Evaluation
    ↓
Review Task
    ↓
Human Decision / Patch
    ↓
Approved Knowledge Fact
    ↓
Feedback Dataset
```

---

# 3. 核心对象必须分离

必须区分：

```text
Source Document
Evidence Anchor
Evidence Bundle
Machine Result
Review Task
Review Decision
Patch
Approved Record
Feedback Example
```

## 3.1 Source Document

表示：

- document_id；
- version_id；
- binary_object_id；
- source_sha256；
- parse_result_id；
- locator_result_id。

## 3.2 Evidence Anchor

指向一个具体证据位置，例如：

- 某页某个 bbox；
- 某个文本 block；
- 某个表格单元格；
- 某个表格行；
- 某个图片区域；
- 某个脚注；
- 某个 Pinout 图；
- 某个 Ordering Information 行。

## 3.3 Evidence Bundle

一个业务结果可能由多个 Evidence Anchor 支撑。

例如：

```text
LDO 输出电流 = 300 mA
```

可能同时由：

- Features；
- Electrical Characteristics；
- Ordering Information；
- 产品描述。

Evidence Bundle 应保存：

- primary evidence；
- supporting evidence；
- conflicting evidence；
- negative evidence。

## 3.4 Machine Result

来自各上游 Agent 的原始机器结果，必须不可变。

## 3.5 Review Task

表示需要人工处理的问题，不等同于机器结果。

## 3.6 Review Decision

表示人工做出的：

- accept；
- reject；
- modify；
- defer；
- escalate；
- mark_not_applicable；
- request_reparse。

## 3.7 Patch

对机器结果的人工修改，采用路径化操作保存。

## 3.8 Approved Record

可供下游正式消费的审核后结果。

---

# 4. 证据覆盖范围

V1 至少支持以下对象：

```text
component_classification
schema_route
section
table
figure
parameter_observation
parameter_fact
condition
unit_normalization
logical_pin
package_pin_instance
package_variant
ordering_variant
suffix_segment
applicability
conflict
```

---

# 5. 设计原则

## 5.1 原始结果不可变

上游 Agent 输出的机器结果不得被人工审核直接覆盖。

数据层必须区分：

```text
machine_record
review_patch
resolved_view
```

## 5.2 证据是一等对象

不能只在结果 JSON 中放一个 `page: 8`。

必须有统一 Evidence Anchor ID。

## 5.3 bbox 必须基于统一坐标系

使用第二个 Agent 的 Canonical IR 坐标：

```text
PDF points
origin = bottom-left
rotation normalized
```

必须保存：

- page_number；
- bbox；
- coordinate_system；
- page_width；
- page_height；
- transform；
- source parser bbox。

## 5.4 原文、结构和截图同时保留

每个 Evidence Anchor 可包含：

```text
raw_text
normalized_text
table_cells
image_crop
page_snapshot
overlay_snapshot
```

不能只保存 OCR 文本，因为审核人员需要看原始版式。

## 5.5 置信度分层

至少区分：

```text
extraction_confidence
evidence_confidence
normalization_confidence
applicability_confidence
selection_confidence
overall_confidence
```

## 5.6 低置信度不是唯一审核触发条件

即使 confidence 很高，以下情况也要审核：

- 多来源冲突；
- 必填字段缺失；
- 量纲错误；
- Family applicability 不清；
- Pin Count 不一致；
- Absolute Max 与 Recommended 混淆；
- OCR 质量过低；
- 新 Datasheet 版本导致证据失效；
- 高业务风险字段。

## 5.7 人工审核必须可追溯

保存：

- reviewer；
- timestamp；
- decision；
- reason；
- patch；
- before；
- after；
- evidence viewed；
- elapsed time；
- second reviewer；
- approval level。

## 5.8 审核结果不得静默改变规则

人工修改只修正当前对象。

若要改 Alias、Schema、Unit Registry 或规则，必须进入独立 Proposal 流程。

## 5.9 审核任务去重

同一个根因不能生成大量重复任务。

例如同一表格列角色错误导致 20 个参数错误，应允许生成：

```text
root_cause_review_task
```

并关联多个受影响对象。

## 5.10 审核应支持风险分级

高风险：

- 供电电压；
- 绝对最大值；
- 引脚电源类型；
- Package Pin Map；
- Ordering Code；
- 温度等级；
- 安全相关参数。

低风险：

- Marketing Description；
- Optional Tag；
- 图片分类。

---

# 6. Evidence Anchor 类型

```text
document
page
text_block
heading
section
table
table_fragment
table_row
table_column
table_cell
figure
figure_caption
image_region
footnote
pinout_region
package_drawing_region
ordering_row
external_source
derived_rule
human_annotation
```

---

# 7. Evidence Anchor 数据结构

```json
{
  "evidence_anchor_id": "uuid",
  "anchor_type": "table_cell",

  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "binary_object_id": "uuid",
    "source_sha256": "hex",
    "parse_result_id": "uuid",
    "locator_result_id": "uuid"
  },

  "location": {
    "page_number": 8,
    "page_width": 612,
    "page_height": 792,
    "coordinate_system": "pdf_points_bottom_left",
    "bbox": [210.4, 320.1, 260.2, 342.5],
    "block_id": "p8-table-1-cell-r12-c4",
    "section_id": "sec-17",
    "table_id": "tbl-22",
    "logical_table_id": "lt-7",
    "row_index": 12,
    "column_index": 4,
    "figure_id": null
  },

  "content": {
    "raw_text": "0.5",
    "normalized_text": "0.5",
    "context_before": "Input Offset Voltage",
    "context_after": "3 mV",
    "raw_cells": {
      "parameter": "Input Offset Voltage",
      "typ": "0.5",
      "max": "3",
      "unit": "mV"
    }
  },

  "artifacts": {
    "crop_uri": "s3://.../anchor.png",
    "overlay_uri": "s3://.../page-overlay.png",
    "page_render_uri": "s3://.../page-8.png"
  },

  "provenance": {
    "parser_engine": "docling",
    "parser_version": "x.y.z",
    "parser_run_id": "uuid",
    "canonical_ir_version": "1.0.0"
  },

  "quality": {
    "text_confidence": 0.99,
    "bbox_confidence": 0.98,
    "ocr_confidence": null,
    "anchor_confidence": 0.98
  }
}
```

---

# 8. Evidence Bundle

```json
{
  "evidence_bundle_id": "uuid",
  "target_type": "parameter_observation",
  "target_id": "uuid",

  "primary_anchors": [
    "anchor-id-1"
  ],

  "supporting_anchors": [
    "anchor-id-2"
  ],

  "conflicting_anchors": [
    "anchor-id-3"
  ],

  "negative_anchors": [],

  "derived_evidence": [
    {
      "type": "unit_conversion",
      "rule_id": "unit.millivolt.to.volt",
      "input": "0.5 mV",
      "output": "0.0005 V",
      "registry_version": "units-1.0.0"
    }
  ],

  "completeness": {
    "has_page": true,
    "has_bbox": true,
    "has_raw_text": true,
    "has_snapshot": true,
    "has_parser_version": true
  },

  "evidence_score": 0.97
}
```

---

# 9. Provenance 链

每个审核对象应能追溯：

```text
PDF binary SHA256
→ PDF parse run
→ Canonical IR block
→ Locator object
→ Extraction rule
→ Schema version
→ Unit/Package/Profile version
→ Machine result
→ Review task
→ Human patch
→ Approved record
```

建议使用有向无环图：

```text
Provenance Graph
```

每个节点保存：

- node_type；
- object_id；
- version；
- hash；
- created_at；
- parent_edges。

---

# 10. 版本信息

每个结果至少保存：

```text
agent_id
agent_version
source_sha256
document_version_id
parser_engine
parser_version
model_version
canonical_ir_version
locator_policy_version
taxonomy_version
schema_version
rule_version
unit_registry_version
package_registry_version
ordering_profile_version
review_policy_version
```

---

# 11. 置信度模型

## 11.1 字段级置信度

例如参数：

```text
parameter_match_confidence
numeric_parse_confidence
unit_confidence
condition_confidence
applicability_confidence
source_quality_confidence
```

## 11.2 Evidence Confidence

由：

```text
parser quality
bbox quality
text quality
table structure quality
caption link quality
OCR quality
source authority
```

组成。

## 11.3 Overall Confidence

不能只做简单平均。

示例：

```text
overall =
  required_component_minimum
  × conflict_penalty
  × evidence_completeness
```

可采用：

```text
weighted geometric mean
```

避免某一关键维度极低却被其他高分掩盖。

## 11.4 Calibration

置信度必须经过基准集校准。

例如：

```text
confidence >= 0.95
```

应尽量对应接近 95% 的真实正确率，而不是随意分数。

可使用：

- reliability diagram；
- expected calibration error；
- isotonic regression；
- Platt scaling。

V1 可先规则分数，V2 做校准。

---

# 12. Review Trigger Policy

审核触发器分为：

```text
confidence_trigger
conflict_trigger
completeness_trigger
business_risk_trigger
version_trigger
sampling_trigger
manual_trigger
```

## 12.1 置信度触发

```yaml
if overall_confidence < 0.75:
  review: required
```

## 12.2 冲突触发

例如：

- Features 与 Electrical Characteristics 冲突；
- Pin Table 与 Pinout 冲突；
- Package Code 与 Pin Count 冲突；
- 两个高置信度分类冲突。

## 12.3 完整性触发

- 缺 page；
- 缺 bbox；
- 缺 raw text；
- 缺 source version；
- 必填参数缺失。

## 12.4 业务风险触发

例如：

```text
absolute_maximum_voltage
recommended_supply_voltage
pin_type_power
package_pin_map
ordering_code
temperature_grade
```

即使 confidence 0.9，也可要求抽样或双人审核。

## 12.5 版本触发

新 Datasheet 版本出现：

- 原证据 page/bbox 失效；
- 文档编号和 revision 改变；
- 关键值变化。

## 12.6 抽样审核

高置信度结果仍需按比例抽样：

```text
1% normal
5% new manufacturer
10% new rule/model version
```

---

# 13. Review Severity

```text
critical
high
medium
low
informational
```

## 13.1 Critical

- 电源 Pin 类型冲突；
- Pin Number 冲突；
- Package Pin Count 错误；
- Absolute Max/Recommended 混淆；
- Ordering Code 映射到错误封装；
- 关键参数量纲错误。

## 13.2 High

- 必填参数缺失；
- Family applicability 不清；
- Pinout 图和表冲突；
- Temperature Grade 不确定。

## 13.3 Medium

- 典型值冲突；
- 图片裁剪可能不完整；
- Table Type 不确定。

## 13.4 Low

- Optional Tag；
- 描述文本；
- 图片细分类。

---

# 14. Review Task 类型

```text
classification_review
schema_route_review
section_boundary_review
table_type_review
figure_type_review
figure_crop_review
parameter_mapping_review
numeric_value_review
unit_review
condition_review
fact_selection_review
pin_number_review
pin_name_review
pin_type_review
pinout_conflict_review
package_mapping_review
ordering_code_review
suffix_review
applicability_review
source_version_review
root_cause_review
quality_sampling_review
```

---

# 15. Review Task 数据结构

```json
{
  "review_task_id": "uuid",
  "task_type": "parameter_mapping_review",
  "severity": "high",
  "status": "open",

  "target": {
    "object_type": "parameter_observation",
    "object_id": "uuid",
    "field_id": "input_offset_voltage"
  },

  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "part_ids": ["uuid"]
  },

  "reason_codes": [
    "parameter_match_ambiguous",
    "conflicting_high_confidence_candidates"
  ],

  "confidence": {
    "overall": 0.64,
    "threshold": 0.75
  },

  "candidate_values": [
    {
      "field_id": "input_offset_voltage",
      "score": 0.64
    },
    {
      "field_id": "input_offset_voltage_drift",
      "score": 0.59
    }
  ],

  "evidence_bundle_id": "uuid",
  "root_cause_task_id": null,

  "routing": {
    "queue": "analog-parameters",
    "required_skill": "analog_component_review",
    "priority": 80
  },

  "sla": {
    "due_at": "ISO-8601"
  },

  "created_at": "ISO-8601"
}
```

---

# 16. 审核队列路由

任务可按：

- 器件类别；
- 厂商；
- 语言；
- 任务类型；
- 风险；
- 所需技能；
- 项目；
- 客户；
- 批次。

队列示例：

```text
analog-parameters
mcu-pins
package-review
ordering-code
unit-review
ocr-quality
critical-power
general-review
```

---

# 17. Review Workflow

```text
OPEN
  ↓
ASSIGNED
  ↓
IN_REVIEW
  ↓
DECIDED
  ↓
SECOND_REVIEW       可选
  ↓
APPROVED
  ↓
APPLIED
  ↓
CLOSED
```

分支：

```text
REJECTED
DEFERRED
ESCALATED
REPARSE_REQUESTED
CANCELLED
```

---

# 18. 审核决策

```text
accept_machine_result
reject_machine_result
modify_result
mark_not_applicable
mark_not_found_in_source
request_reparse
request_reclassification
request_schema_change
request_rule_change
request_unit_registry_change
request_package_registry_change
defer
escalate
```

---

# 19. Patch 模型

建议兼容 JSON Patch 思路，但使用受控路径。

```json
{
  "patch_id": "uuid",
  "target_type": "parameter_observation",
  "target_id": "uuid",
  "base_version": "machine-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/value/raw/max",
      "old_value": "8",
      "value": "3"
    },
    {
      "op": "replace",
      "path": "/value/normalized/max",
      "old_value": "0.008",
      "value": "0.003"
    }
  ],
  "reason_code": "ocr_digit_error",
  "comment": "PDF cell clearly shows 3 mV.",
  "evidence_anchor_ids": ["uuid"],
  "reviewer_id": "uuid",
  "created_at": "ISO-8601"
}
```

## 19.1 受控路径

每种对象定义允许修改的路径。

不允许审核 UI 任意修改系统字段：

- source_sha256；
- machine provenance；
- created_at；
- parser version。

## 19.2 Patch 冲突

如果机器结果已重新生成：

```text
base_version mismatch
```

Patch 必须重新验证，不能静默套用。

---

# 20. Resolved View

下游读取时获取：

```text
machine_record
+ approved_patches
= resolved_view
```

Resolved View 必须标记：

```text
machine_only
human_corrected
human_created
machine_rejected
```

---

# 21. Approved Record

```json
{
  "approved_record_id": "uuid",
  "target_type": "parameter_fact",
  "target_id": "uuid",
  "resolved_version": "rv-3",
  "approval_status": "approved",
  "approval_level": "single_reviewer",
  "review_task_ids": ["uuid"],
  "patch_ids": ["uuid"],
  "approved_by": ["reviewer-id"],
  "approved_at": "ISO-8601",
  "content_hash": "hex"
}
```

---

# 22. Evidence Snapshot

为避免后续 Parser 版本变化导致审核画面变化，审核任务创建时可生成 Evidence Snapshot：

```text
page render
bbox overlay
table row crop
figure crop
raw JSON excerpt
```

Snapshot 必须记录：

```text
source_sha256
render_dpi
renderer_version
bbox
snapshot_sha256
```

---

# 23. PDF 页面审核组件要求

后端需支持前端：

- 打开指定页；
- 缩放；
- 高亮一个或多个 bbox；
- 显示表格行；
- 显示邻近上下文；
- 切换机器文本与原图；
- 显示 OCR confidence；
- 显示不同 Parser 结果；
- 点击 Evidence Anchor；
- 拖动 bbox；
- 重新裁剪；
- 绑定新 Anchor。

---

# 24. 表格审核组件

显示：

- 原页面；
- 表格 bbox；
- 结构化 cells；
- row/column；
- merged cells；
- logical table fragments；
- raw parser output；
- 下游解析结果。

支持：

- 修改 row/column role；
- 绑定脚注；
- 调整 table fragment；
- 重新选择 Evidence Cell。

---

# 25. 图片与封装图审核

显示：

- 原页面；
- source bbox；
- expanded bbox；
- crop；
- caption；
- OCR；
- figure type；
- edge clip warning。

支持：

- 调整 bbox；
- 修改 figure type；
- 绑定 caption；
- 绑定 package；
- 重新生成 crop。

---

# 26. 审核权限

角色示例：

```text
viewer
reviewer
senior_reviewer
domain_expert
review_manager
taxonomy_admin
schema_admin
unit_registry_admin
package_registry_admin
system_admin
```

权限：

- reviewer 可修正实例；
- domain expert 可处理高风险；
- admin 才能发布 Registry/Schema；
- 单人不能同时提交和批准高风险 Schema 变更。

---

# 27. 双人复核

以下任务建议双人复核：

- Critical；
- 新厂商后缀规则；
- Package Pin Map；
- Power Pin Type；
- 大批量规则变更；
- Schema/Unit/Package Registry 发布。

流程：

```text
Reviewer A 决策
→ Reviewer B 独立确认
→ 一致则批准
→ 不一致则专家仲裁
```

---

# 28. Root Cause Review

一个上游错误可能影响大量对象。

例如：

```text
Electrical Characteristics 表格 Max 列错位
```

应生成一个 Root Cause Task：

```text
root cause: table column role error
affected observations: 200
```

修复后：

```text
re-run affected objects
```

而不是人工改 200 条。

---

# 29. Proposal 闭环

人工审核中发现系统性问题时，生成 Proposal：

```text
alias_proposal
rule_proposal
schema_proposal
unit_proposal
package_alias_proposal
ordering_profile_proposal
parser_issue
locator_issue
```

Proposal 与当前实例 Patch 分离。

---

# 30. Feedback Dataset

审核结果可导出为训练与评估数据：

```text
positive example
negative example
corrected value
candidate ranking
evidence anchors
review reason
reviewer agreement
```

必须过滤：

- 隐私；
- 商业敏感信息；
- 无授权文档截图；
- 不可靠审核结果。

---

# 31. 审核质量控制

## 31.1 Reviewer Agreement

- Cohen’s Kappa；
- Exact Agreement；
- Field-level Agreement；
- Severity Agreement。

## 31.2 Gold Tasks

向审核人员混入已知答案任务，监测审核质量。

## 31.3 抽样复查

- 新审核员；
- 高风险任务；
- 大批量批准；
- 异常快的审核；
- 高频修改。

## 31.4 审核员指标

- 准确率；
- 平均耗时；
- 返工率；
- 与专家一致率；
- 各领域覆盖。

---

# 32. SLA 和优先级

优先级示例：

```text
P0 critical blocking
P1 high
P2 normal
P3 low
```

影响 Priority 的因素：

- severity；
- downstream blocking；
- customer/project；
- batch size；
- age；
- business value；
- risk。

---

# 33. Review Policy

配置化：

```yaml
review_policy_version: review-1.0.0

thresholds:
  default:
    auto_approve: 0.90
    review: 0.70
    unresolved: 0.50

  parameter_fact:
    auto_approve: 0.95

  pin_package_map:
    auto_approve: 0.98

risk_rules:
  - object_type: parameter_fact
    field_ids:
      - recommended_supply_voltage
      - absolute_maximum_voltage
    require_sampling_rate: 0.10

  - object_type: package_pin_instance
    severity: critical
    require_second_review: true
```

---

# 34. 自动批准

自动批准必须满足：

```text
confidence >= threshold
no blocking conflicts
evidence completeness = true
source version valid
schema valid
no mandatory review rule
```

自动批准也要保存：

- policy version；
- threshold；
- reason；
- timestamp。

---

# 35. 自动拒绝

只有明确规则才能自动拒绝：

- Schema 不存在；
- Evidence Anchor 指向错误版本；
- bbox 越界；
- page 不存在；
- unit dimension impossible；
- duplicate exact result。

业务内容一般不应自动删除，只标记 invalid/review。

---

# 36. 数据模型

## 36.1 `evidence_anchors`

```text
id UUID PK
anchor_type VARCHAR NOT NULL
document_id UUID NOT NULL
version_id UUID NOT NULL
binary_object_id UUID NOT NULL
source_sha256 CHAR(64) NOT NULL
parse_result_id UUID NULL
locator_result_id UUID NULL
page_number INT NULL
bbox JSONB NULL
coordinate_system VARCHAR NULL
block_id VARCHAR NULL
section_id VARCHAR NULL
table_id VARCHAR NULL
logical_table_id VARCHAR NULL
row_index INT NULL
column_index INT NULL
figure_id VARCHAR NULL
raw_text TEXT NULL
normalized_text TEXT NULL
content_uri TEXT NULL
crop_uri TEXT NULL
overlay_uri TEXT NULL
provenance JSONB NOT NULL
quality JSONB NOT NULL
anchor_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(anchor_hash)
```

## 36.2 `evidence_bundles`

```text
id UUID PK
target_type VARCHAR NOT NULL
target_id VARCHAR NOT NULL
primary_anchor_ids JSONB NOT NULL
supporting_anchor_ids JSONB NOT NULL
conflicting_anchor_ids JSONB NOT NULL
negative_anchor_ids JSONB NOT NULL
derived_evidence JSONB NOT NULL
evidence_score NUMERIC(5,4)
completeness JSONB NOT NULL
bundle_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(bundle_hash)
```

## 36.3 `review_tasks`

```text
id UUID PK
task_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
target_type VARCHAR NOT NULL
target_id VARCHAR NOT NULL
field_id VARCHAR NULL
document_id UUID NOT NULL
version_id UUID NOT NULL
part_ids JSONB NOT NULL
reason_codes JSONB NOT NULL
confidence JSONB NOT NULL
candidate_data_uri TEXT NULL
evidence_bundle_id UUID NOT NULL
root_cause_task_id UUID NULL
queue_name VARCHAR NOT NULL
required_skill VARCHAR NULL
priority INT NOT NULL
assigned_to UUID NULL
due_at TIMESTAMPTZ NULL
review_policy_version VARCHAR NOT NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
closed_at TIMESTAMPTZ NULL
```

## 36.4 `review_decisions`

```text
id UUID PK
review_task_id UUID NOT NULL
reviewer_id UUID NOT NULL
decision VARCHAR NOT NULL
reason_code VARCHAR NOT NULL
comment TEXT NULL
evidence_viewed JSONB NOT NULL
decision_payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 36.5 `review_patches`

```text
id UUID PK
review_task_id UUID NOT NULL
target_type VARCHAR NOT NULL
target_id VARCHAR NOT NULL
base_version VARCHAR NOT NULL
operations JSONB NOT NULL
reason_code VARCHAR NOT NULL
comment TEXT NULL
evidence_anchor_ids JSONB NOT NULL
created_by UUID NOT NULL
created_at TIMESTAMPTZ
status VARCHAR NOT NULL
applied_at TIMESTAMPTZ NULL
```

## 36.6 `approved_records`

```text
id UUID PK
target_type VARCHAR NOT NULL
target_id VARCHAR NOT NULL
resolved_version VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
approval_level VARCHAR NOT NULL
review_task_ids JSONB NOT NULL
patch_ids JSONB NOT NULL
approved_by JSONB NOT NULL
content_hash CHAR(64) NOT NULL
approved_at TIMESTAMPTZ
UNIQUE(target_type, target_id, resolved_version)
```

## 36.7 `review_events`

```text
id BIGSERIAL PK
review_task_id UUID NOT NULL
event_type VARCHAR NOT NULL
actor_id UUID NULL
payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 36.8 `improvement_proposals`

```text
id UUID PK
proposal_type VARCHAR NOT NULL
source_review_task_ids JSONB NOT NULL
status VARCHAR NOT NULL
target_registry VARCHAR NULL
proposal_payload JSONB NOT NULL
created_by UUID NOT NULL
reviewed_by UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 37. 对象存储

```text
derived/evidence-review/
  {source_sha256}/
    anchors/
      {anchor_id}.json
      crops/
      overlays/
      pages/
    bundles/
      {bundle_id}.json
    review-tasks/
      {task_id}/
        candidates.json
        snapshots/
        decisions/
        patches/
    resolved/
      {target_type}/
        {target_id}/
          {resolved_version}.json
    feedback/
      examples/
    quality/
      reports/
```

PostgreSQL 存索引和状态，不存大图。

---

# 38. API

## 38.1 Evidence API

```text
POST /api/v1/evidence/anchors
POST /api/v1/evidence/bundles
GET /api/v1/evidence/anchors/{anchor_id}
GET /api/v1/evidence/bundles/{bundle_id}
GET /api/v1/evidence/targets/{target_type}/{target_id}
GET /api/v1/evidence/pages/{version_id}/{page_number}
POST /api/v1/evidence/anchors/{anchor_id}/re-render
```

## 38.2 Review API

```text
POST /api/v1/reviews/tasks
POST /api/v1/reviews/tasks/batch
GET /api/v1/reviews/tasks
GET /api/v1/reviews/tasks/{task_id}
POST /api/v1/reviews/tasks/{task_id}/assign
POST /api/v1/reviews/tasks/{task_id}/claim
POST /api/v1/reviews/tasks/{task_id}/decision
POST /api/v1/reviews/tasks/{task_id}/patch
POST /api/v1/reviews/tasks/{task_id}/request-reparse
POST /api/v1/reviews/tasks/{task_id}/escalate
POST /api/v1/reviews/tasks/{task_id}/close
POST /api/v1/reviews/tasks/{task_id}/reopen
```

## 38.3 Resolved View

```text
GET /api/v1/resolved/{target_type}/{target_id}
GET /api/v1/resolved/{target_type}/{target_id}/history
POST /api/v1/resolved/{target_type}/{target_id}/rebuild
```

## 38.4 Proposal

```text
POST /api/v1/improvement-proposals
GET /api/v1/improvement-proposals
POST /api/v1/improvement-proposals/{id}/approve
POST /api/v1/improvement-proposals/{id}/reject
```

---

# 39. 事件

## 39.1 上游事件

```text
component.classification.completed
component.schema.ready
datasheet.locator.ready
component.parameters.ready
component.pin-package-ordering.ready
```

## 39.2 审核事件

```text
review.task.created
review.task.assigned
review.task.decided
review.patch.created
review.patch.applied
review.task.escalated
review.task.closed
```

## 39.3 下游事件

```text
knowledge.record.approved
knowledge.record.corrected
knowledge.record.rejected
knowledge.record.reparse_requested
```

---

# 40. 错误码

```text
EVIDENCE_TARGET_NOT_FOUND
EVIDENCE_SOURCE_VERSION_MISMATCH
EVIDENCE_PAGE_NOT_FOUND
EVIDENCE_BBOX_INVALID
EVIDENCE_BLOCK_NOT_FOUND
EVIDENCE_TABLE_CELL_NOT_FOUND
EVIDENCE_SNAPSHOT_FAILED
EVIDENCE_BUNDLE_INCOMPLETE
REVIEW_POLICY_NOT_FOUND
REVIEW_TASK_DUPLICATE
REVIEW_TASK_NOT_FOUND
REVIEW_TASK_ALREADY_CLOSED
REVIEW_PERMISSION_DENIED
PATCH_PATH_NOT_ALLOWED
PATCH_BASE_VERSION_MISMATCH
PATCH_VALIDATION_FAILED
PATCH_CONFLICT
RESOLVED_VIEW_BUILD_FAILED
SECOND_REVIEW_REQUIRED
APPROVAL_CONFLICT
PROPOSAL_INVALID
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 41. 审核台页面

## 41.1 Dashboard

- 待审核总量；
- Critical/High；
- 超 SLA；
- 按类别；
- 按厂商；
- 按 Agent；
- 按 Root Cause；
- 自动批准率；
- 人工修正率。

## 41.2 Review Workbench

布局建议：

```text
左侧：PDF 页面与 bbox
中间：机器结果和候选
右侧：结构化编辑与决策
底部：证据、版本、规则和历史
```

## 41.3 Batch Review

适合：

- 同一 Alias；
- 同一厂商后缀；
- 同一表格列错误；
- 同一 Unit；
- 相同 Pin Type 规则。

---

# 42. 审核 UI 关键交互

- 键盘快捷键；
- 一键接受；
- 候选选择；
- 原图/文本切换；
- 表格行锁定；
- bbox 拖动；
- 放大镜；
- 显示邻近行；
- 显示上游版本；
- 显示下游影响；
- 保存草稿；
- 提交并下一条。

---

# 43. 影响分析

审核修改前，应显示影响：

```text
影响多少 Part
影响多少 Parameter Fact
是否影响 KiCad Symbol
是否影响 Package Map
是否影响 Ordering Variant
是否触发下游重跑
```

高影响 Patch 需要更高权限。

---

# 44. Patch 后增量重跑

例如：

- 修改 Unit → 重归一和重选 Fact；
- 修改 Table Column Role → 重跑受影响参数；
- 修改 Package Code → 重跑 Ordering Mapping；
- 修改 Pin Type → 重跑 KiCad Symbol 校验；
- 修改 Schema → 不直接处理，由 Proposal 流程发布后批量重跑。

---

# 45. Datasheet 新版本处理

新版本到达后：

1. 比较 source_sha256；
2. 尝试通过文本、table row 和相对位置重新定位 Anchor；
3. 计算 anchor migration confidence；
4. 高置信度迁移；
5. 低置信度生成 `source_version_review`；
6. 不直接复用旧 bbox。

---

# 46. Evidence Anchor 迁移

迁移信号：

- document number；
- section type；
- table title；
- parameter name；
- row signature；
- normalized text；
- surrounding text；
- page offset；
- bbox similarity。

输出：

```text
old_anchor_id
new_anchor_id
migration_confidence
migration_method
```

---

# 47. 安全与合规

- 审核员只访问授权项目；
- 对象存储 URI 使用短期签名；
- PDF 不直接暴露永久地址；
- 审核日志不可删除；
- 评论和 Patch 做内容审计；
- 高权限操作要求二次验证；
- 可配置数据驻留；
- 不向外部模型发送文档；
- 前端截图不可被任意下载；
- 导出审核数据需权限。

---

# 48. 可观测性

## 48.1 Prometheus

```text
evidence_anchors_total{anchor_type}
evidence_bundle_completeness
evidence_snapshot_failures_total{reason}
review_tasks_total{type,severity,status}
review_queue_depth{queue}
review_task_age_seconds{queue,severity}
review_decisions_total{decision,type}
review_patch_total{target_type,reason}
review_auto_approval_total{object_type}
review_human_correction_rate{object_type}
review_second_review_disagreement_total{type}
review_sla_breaches_total{queue,severity}
review_root_cause_tasks_total{type}
reviewer_throughput_total{reviewer}
reviewer_agreement_score{domain}
anchor_migration_total{status}
```

## 48.2 Dashboard

- 自动批准率；
- 人工审核率；
- 人工修改率；
- 误报率；
- 各 Agent 质量；
- 各厂商质量；
- Reviewer Agreement；
- SLA；
- Root Cause；
- 新版本 Anchor 迁移成功率；
- 高风险任务积压。

---

# 49. Benchmark

## 49.1 Evidence 指标

- Page Accuracy；
- bbox IoU；
- Text Match Accuracy；
- Table Cell Accuracy；
- Evidence Completeness；
- Snapshot Success Rate；
- Anchor Migration Accuracy。

## 49.2 Review Trigger

- Review Precision；
- Review Recall；
- High-risk Error Recall；
- Auto-approval Accuracy；
- False Review Rate。

## 49.3 Human Review

- Decision Accuracy；
- Reviewer Agreement；
- Mean Review Time；
- Patch Validity；
- Rework Rate；
- Root Cause Fix Coverage。

---

# 50. 初始质量目标

```text
Evidence page accuracy >= 99.5%
Evidence bbox IoU >= 0.90
Evidence completeness >= 99%
Snapshot success rate >= 99%

Critical error review recall >= 99%
High-risk error review recall >= 98%
High-confidence auto-approval accuracy >= 98%
False review rate <= 15%

Patch application success >= 99%
Reviewer agreement >= 0.85
Anchor migration accuracy >= 95%
```

这些是目标，不是未经测试的保证。

---

# 51. 测试集

## 51.1 Evidence

1. Text block；
2. Table cell；
3. Table row；
4. Cross-page table；
5. Figure bbox；
6. Footnote；
7. Pinout；
8. Package Drawing；
9. Rotated page；
10. OCR page；
11. bbox out of range；
12. Missing page；
13. Parser version change；
14. Duplicate anchor；
15. Snapshot render failure。

## 51.2 Review Trigger

16. Low confidence；
17. High confidence conflict；
18. Required field missing；
19. Unit dimension conflict；
20. Pin Count mismatch；
21. Ordering suffix unknown；
22. Family applicability unresolved；
23. New rule version sampling；
24. Critical field sampling；
25. Duplicate root cause。

## 51.3 Patch

26. Replace value；
27. Replace unit；
28. Add condition；
29. Remove condition；
30. Change field mapping；
31. Change Pin Type；
32. Change Package；
33. Patch invalid path；
34. Patch version conflict；
35. Patch after machine rerun。

## 51.4 Workflow

36. Claim task；
37. Reassign；
38. SLA；
39. Escalate；
40. Second review；
41. Reviewer disagreement；
42. Close/reopen；
43. Root cause task；
44. Batch review；
45. Proposal creation。

## 51.5 Version Migration

46. Same text new page；
47. Table row shifted；
48. Section renamed；
49. Evidence removed；
50. New Datasheet revision conflict。

---

# 52. 工程验收标准

## 52.1 功能

- 能创建 Evidence Anchor；
- 能创建 Evidence Bundle；
- 能从所有上游对象接入证据；
- 能生成 page+bbox overlay；
- 能保存 parser/agent/rule/schema versions；
- 能计算置信度；
- 能根据 Policy 创建审核任务；
- 能去重审核任务；
- 能路由队列；
- 能人工接受/拒绝/修改；
- 能保存 Patch；
- 能构建 Resolved View；
- 能双人复核；
- 能 Root Cause Review；
- 能 Proposal；
- 能增量重跑；
- 能 Datasheet 版本 Anchor 迁移；
- 能发布下游事件；
- 所有操作审计化。

## 52.2 工程质量

- 单元测试覆盖率 >= 85%；
- Patch Validator >= 95%；
- Policy Engine >= 95%；
- bbox/coordinate module >= 95%；
- 所有状态机测试；
- 权限测试；
- JSON Schema 通过；
- Migration upgrade/downgrade 通过；
- Ruff 通过；
- mypy 通过；
- 不覆盖机器原始数据；
- 不删除审核历史；
- 不提交真实 Datasheet；
- 不伪造指标。

## 52.3 性能

- Evidence Anchor 查询 P95 < 200 ms；
- Review Task 列表 P95 < 500 ms；
- 页面截图按需生成并缓存；
- 同一 Anchor Snapshot 去重；
- 批量审核支持分页；
- 100 万任务级别可按状态和队列索引；
- 不在 PostgreSQL 存大图；
- Resolved View 可缓存。

---

# 53. 推荐仓库结构

```text
evidence-review-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── evidence-review-agent-spec.md
│   ├── evidence-anchor-model.md
│   ├── provenance-graph.md
│   ├── confidence-calibration.md
│   ├── review-policy.md
│   ├── patch-model.md
│   ├── review-workbench-api.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-machine-results-immutable.md
│       ├── 0002-evidence-first-class.md
│       ├── 0003-patch-not-overwrite.md
│       ├── 0004-review-policy-versioned.md
│       └── 0005-root-cause-review.md
├── src/
│   └── evidence_review/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── evidence/
│       │   ├── anchor.py
│       │   ├── bundle.py
│       │   ├── resolver.py
│       │   ├── snapshot.py
│       │   ├── overlay.py
│       │   ├── migration.py
│       │   └── dedup.py
│       ├── provenance/
│       │   ├── graph.py
│       │   ├── nodes.py
│       │   └── lineage.py
│       ├── confidence/
│       │   ├── scorer.py
│       │   ├── calibration.py
│       │   └── completeness.py
│       ├── policies/
│       │   ├── loader.py
│       │   ├── validator.py
│       │   ├── trigger_engine.py
│       │   └── routing.py
│       ├── reviews/
│       │   ├── task.py
│       │   ├── state_machine.py
│       │   ├── assignment.py
│       │   ├── decision.py
│       │   ├── second_review.py
│       │   ├── root_cause.py
│       │   └── sla.py
│       ├── patches/
│       │   ├── schema.py
│       │   ├── validator.py
│       │   ├── applier.py
│       │   ├── conflicts.py
│       │   └── resolved_view.py
│       ├── proposals/
│       ├── feedback/
│       ├── security/
│       ├── storage/
│       └── observability/
├── policies/
│   ├── review-1.0.0.yaml
│   ├── routing.yaml
│   ├── severity.yaml
│   └── sampling.yaml
├── schemas/
│   ├── evidence-anchor.schema.json
│   ├── evidence-bundle.schema.json
│   ├── review-task.schema.json
│   ├── review-decision.schema.json
│   ├── review-patch.schema.json
│   └── approved-record.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── evidence/
│   ├── confidence/
│   ├── policies/
│   ├── reviews/
│   ├── patches/
│   ├── permissions/
│   ├── migration/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── render_evidence_snapshot.py
    ├── validate_review_policy.py
    ├── run_review_benchmark.py
    ├── migrate_anchors.py
    ├── export_feedback_dataset.py
    └── rebuild_resolved_views.py
```

---

# 54. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察与统一契约

Codex 必须：

1. 阅读前六个 Agent 的规格和代码；
2. 找出每个 Agent 当前 evidence 字段；
3. 找出 Canonical IR 坐标系统；
4. 找出当前 Review/Approval/Audit 数据；
5. 找出 UI 是否已有审核台；
6. 找出当前 Patch 机制；
7. 输出统一 Evidence Anchor 映射；
8. 输出 Review Policy；
9. 输出旧数据迁移方案；
10. 不修改业务代码；
11. 不创建 Migration；
12. 不安装依赖。

## Phase 1：Evidence Anchor 与 Bundle

实现：

- Anchor；
- Bundle；
- JSON Schema；
- hash/dedup；
- PostgreSQL index；
- object storage；
- API；
- 上游 Adapter contract。

## Phase 2：Snapshot 与 Overlay

实现：

- page render；
- bbox overlay；
- table row crop；
- figure crop；
- cache；
- snapshot hash；
- coordinate tests。

## Phase 3：Provenance Graph

实现：

- nodes；
- edges；
- lineage；
- version manifest；
- target trace API。

## Phase 4：Confidence 与 Completeness

实现：

- confidence fields；
- completeness checks；
- weighted/geometric score；
- conflict penalties；
- policy-ready output。

## Phase 5：Review Policy Engine

实现：

- YAML policy；
- confidence trigger；
- conflict；
- completeness；
- business risk；
- sampling；
- version trigger；
- dedup。

## Phase 6：Review Task 与队列

实现：

- task；
- routing；
- severity；
- priority；
- assignment；
- claim；
- SLA；
- state machine。

## Phase 7：Decision 与 Patch

实现：

- decisions；
- controlled paths；
- Patch schema；
- validation；
- conflict；
- audit；
- object-specific adapters。

## Phase 8：Resolved View

实现：

- machine + patches；
- cache；
- history；
- approved record；
- downstream events。

## Phase 9：审核 UI 后端

实现：

- PDF page API；
- overlay；
- table context；
- candidate comparison；
- batch review；
- permissions。

## Phase 10：双人复核与 Root Cause

实现：

- second review；
- disagreement；
- arbitration；
- root cause；
- affected object graph；
- rerun request。

## Phase 11：Proposal 与反馈闭环

实现：

- alias/rule/schema/unit/package/profile proposals；
- feedback export；
- gold tasks；
- reviewer agreement。

## Phase 12：版本迁移

实现：

- new Datasheet anchor migration；
- text/table matching；
- migration confidence；
- stale evidence；
- review tasks。

## Phase 13：完整事件、批处理和安全

实现：

- all upstream events；
- downstream events；
- batch；
- permissions；
- signed URL；
- audit；
- idempotency。

## Phase 14：Benchmark、监控与生产发布

实现：

- benchmark；
- calibration；
- metrics；
- dashboards；
- README；
- ops；
- policy rollback；
- disaster recovery。

---

# 55. Codex 工作纪律

Codex 必须：

1. 不覆盖上游机器结果；
2. Evidence Anchor 是一等对象；
3. 所有 bbox 使用 Canonical 坐标；
4. Evidence Bundle 支持多证据；
5. 证据保存 parser/agent/rule/schema 版本；
6. 置信度分层；
7. Review Policy 配置化、版本化；
8. 不只靠 confidence 触发审核；
9. 高风险字段可强制审核；
10. Patch 不直接覆盖；
11. Patch 路径受控；
12. Patch 有 base version；
13. 审核历史不可删除；
14. Root Cause 优先于大量重复修改；
15. Proposal 与实例 Patch 分离；
16. 不把大图存 PostgreSQL；
17. 不调用外部通用 LLM；
18. 不用 LLM 代替人工审核；
19. 不提交真实 Datasheet；
20. 不伪造审核准确率；
21. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - Policy 变化；
    - 测试命令；
    - 真实测试结果；
    - Benchmark；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 56. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/evidence-review-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第七个基础 Agent：

Evidence Anchoring & Human Review Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. 前六个 Agent 的完整规格；
3. docs/evidence-review-agent-spec.md；
4. 前六个 Agent 的实际代码、事件、Schema 和测试；
5. 当前 Canonical Document IR；
6. 当前 SectionMap、TableCatalog、FigureCatalog；
7. 当前 Parameter Observation/Fact；
8. 当前 Pin/Package/Ordering Catalog；
9. ezPLM 当前审核、审批、日志、权限和 Patch 数据结构；
10. 当前对象存储、数据库、任务队列、Docker 和 CI。

本 Agent 的职责是：

- 为分类、章节、表格、图片、参数、条件、单位、引脚、封装和订货型号结果建立统一 Evidence Anchor；
- 保存 page、bbox、block_id、table_id、row/column、figure_id、原文、截图和 overlay；
- 保存 parser、agent、rule、schema、registry 和 model version；
- 将多个 Anchor 组合为 Evidence Bundle；
- 计算 evidence completeness 和 confidence；
- 根据低置信度、冲突、缺失、业务风险、版本变化和抽样规则创建审核任务；
- 将任务路由到审核队列；
- 支持人工接受、拒绝、修改、重定位、reparse 和 escalate；
- 人工修改以 Patch 保存，不覆盖机器结果；
- 构建 Resolved View 和 Approved Record；
- 支持双人复核、Root Cause Review 和 Improvement Proposal；
- 支持 Datasheet 新版本 Evidence Anchor 迁移；
- 发布 knowledge.record.approved/corrected/rejected 事件。

硬约束：

- 上游 machine result 不可变；
- Evidence Anchor 是一等对象；
- 所有 bbox 使用 Canonical IR 坐标；
- 必须保存 page、bbox、raw text 和 source version；
- 必须保存 parser/agent/rule/schema/registry version；
- Evidence Bundle 支持 primary/supporting/conflicting/negative evidence；
- 置信度必须分层；
- Review Trigger 不得只依赖 overall confidence；
- 高风险字段可强制审核；
- Review Policy 必须配置化、版本化；
- Patch 不能覆盖机器原始结果；
- Patch 必须有 base version；
- Patch 路径必须受控；
- 审核历史不可删除；
- Proposal 与实例 Patch 分离；
- Root Cause Task 优先于大量重复任务；
- PostgreSQL 不存大图；
- V1 不调用外部通用大模型；
- 不使用 LLM 代替人工审核；
- 不提交真实受版权保护 Datasheet；
- 不伪造测试和审核准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查前六个 Agent 的实际完成程度；
3. 统计每个 Agent 当前 evidence/provenance/confidence 字段；
4. 打开 Canonical IR 坐标和 bbox 定义；
5. 查找现有审核台、审批、权限、日志、Patch 和审计功能；
6. 查找现有 PDF 页面渲染和 bbox overlay；
7. 在 docs/evidence-anchor-unification-plan.md 中生成统一证据映射；
8. 在 docs/review-policy-design.md 中生成审核触发和路由方案；
9. 在 docs/review-patch-model.md 中生成 Patch 与 Resolved View 方案；
10. 在 docs/evidence-review-migration-plan.md 中生成旧数据迁移方案；
11. 在 docs/evidence-review-benchmark-plan.md 中生成 Benchmark；
12. 给出拟新增、拟修改和拟复用文件清单；
13. 给出 Phase 1 精确修改范围；
14. 不修改业务代码；
15. 不创建 Migration；
16. 不安装依赖；
17. 运行当前仓库已有 lint、type check 和测试。

最终回复必须包含：

- 仓库现状；
- 与前六个 Agent 的衔接；
- 当前 Evidence 字段差异；
- 统一 Evidence Anchor；
- Provenance Graph；
- Confidence 模型；
- Review Trigger Policy；
- Review Queue；
- Patch/Resolved View；
- Root Cause/Proposal；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 57. 后续 Phase 提示词模板

```text
继续实现 Evidence Anchoring & Human Review Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读七个 Agent 的规格；
3. 阅读 Evidence Anchor Unification Plan；
4. 阅读 Review Policy Design；
5. 阅读 Review Patch Model；
6. 检查上一阶段代码和测试；
7. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- machine result 不可变；
- Evidence Anchor 一等对象；
- Canonical 坐标；
- 证据和版本完整；
- Review Policy 版本化；
- Patch 不覆盖；
- Patch 路径受控；
- 审核历史不可删除；
- Root Cause 优先；
- 不依赖外部 LLM；
- 不提交真实 Datasheet；
- 不重构无关代码。

执行顺序：

1. 列出实施步骤；
2. 编写或更新测试；
3. 实现代码；
4. 运行格式化；
5. 运行 lint；
6. 运行 type check；
7. 运行单元测试；
8. 运行集成测试；
9. 运行权限/状态机测试；
10. 运行必要性能测试；
11. 更新文档；
12. 总结修改。

最终回复：

- 修改文件；
- Schema/API 变化；
- Policy 变化；
- 测试命令和真实结果；
- 审核质量指标；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 58. MVP 演示流程

1. 参数 Agent 生成 VOS Observation；
2. Evidence Agent 建立表格单元格 Anchor；
3. 保存 page、bbox、raw row 和 parser version；
4. 生成 Evidence Bundle；
5. confidence 0.96 自动批准；
6. 模拟 OCR 将 3 识别为 8；
7. confidence 降低并生成 Review Task；
8. 审核台打开 PDF 第 8 页；
9. 高亮表格行和单元格；
10. 审核员将 8 改为 3；
11. 保存 Patch；
12. 原机器结果仍可查看；
13. Resolved View 显示修正值；
14. 发布 corrected event；
15. Pin Table 与 Pinout 冲突生成 Critical；
16. 双人复核；
17. Root Cause 识别为 table column 错位；
18. 修复后重跑受影响 Pin；
19. 新 Datasheet Revision 到达；
20. Anchor 自动迁移；
21. 低置信度迁移进入审核；
22. 审核结果生成 Alias/Rule Proposal；
23. Dashboard 显示自动批准率和人工修正率。

---

# 59. 下游事件

```json
{
  "event_type": "knowledge.record.approved",
  "event_version": "1.0",
  "target_type": "parameter_fact",
  "target_id": "uuid",
  "resolved_version": "rv-3",
  "approval_status": "approved",
  "approval_level": "single_reviewer",
  "evidence_bundle_id": "uuid",
  "review_task_ids": ["uuid"],
  "patch_ids": ["uuid"],
  "content_hash": "hex",
  "created_at": "ISO-8601"
}
```

下游正式消费条件：

```text
approval_status = approved
AND evidence completeness = true
AND source version valid
AND no blocking review task
```
