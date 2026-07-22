# MPN 精准匹配 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：32  
> Agent 名称：Manufacturer Part Number Resolution Agent  
> 中文名称：MPN 精准匹配 Agent  
> 版本：V1.0  
> 定位：根据描述、规格、封装、品牌、客户料号、内部料号、供应商料号和疑似型号，匹配标准制造商型号及器件主实体  
>
> 上游：
> - Agent 31：BOM 接入与标准化 Agent
> - ezPLM BOM、物料、客户料号、内部料号和供应商料号
> - 元器件主数据、参数库、封装库、Datasheet、Symbol、Footprint 和 3D 映射
>
> 下游：
> - 生命周期和停产风险分析
> - 替代料与 Pin-to-Pin 兼容分析
> - DigiKey、Mouser、Arrow、Element14 等价格库存查询
> - BOM 成本与交期分析
> - AVL、采购、库存、SMT 备料和生产管理
>
> 目标读者：产品负责人、数据工程师、搜索工程师、后端工程师、算法工程师、审核运营人员、Codex

---

# 1. 建设目标

建设一个独立、可复用、可测试、可版本化的 MPN 精准匹配 Agent。

Agent 接收第31个 Agent 输出的 Canonical BOM Line，并综合使用：

- Manufacturer / Brand；
- 疑似 Manufacturer Part Number；
- Base Part Number；
- 客户料号；
- 内部料号；
- ERP/PLM 料号；
- Supplier SKU；
- 描述；
- Value；
- Tolerance；
- Voltage / Current / Power；
- 频率、容量、通道、接口等规格；
- Package；
- Footprint；
- Pin Count；
- Datasheet URL；
- OCR 候选；
- 历史采购记录；
- 已批准 Crosswalk；
- 客户、项目和企业上下文。

输出：

```text
标准 Manufacturer Entity
标准 Manufacturer Part Number
标准 Component Part Entity
Base Part
Package Variant
Ordering Variant
候选列表
匹配证据
匹配特征
冲突
置信度
审核任务
```

系统必须支持：

1. 精确 MPN 匹配；
2. Manufacturer + MPN 联合匹配；
3. 缺 Manufacturer 时的全局唯一匹配；
4. 内部料号、客户料号和供应商 SKU Crosswalk；
5. Base Part 与完整 Ordering Code 区分；
6. 厂商后缀、封装、温度、精度、速度和包装差异；
7. 描述、参数、封装和类别辅助匹配；
8. OCR 的 O/0、I/1、S/5、B/8 等受限候选生成；
9. 同一输入多个候选的召回和精排；
10. Top1 与 Top2 Margin 决策；
11. Hard Constraint 冲突阻断；
12. 高置信度自动批准；
13. 低置信度和高风险结果进入审核；
14. 人工确认形成租户级或客户级 Crosswalk；
15. 无合格候选时明确输出 unresolved；
16. Generic Passive 无具体 MPN 时输出规格实体，不强行编造型号；
17. 110 万型号规模的批量高性能处理；
18. 所有匹配均可追溯、可重放、可重新排序。

---

# 2. 与 Agent 31 的职责边界

## 2.1 Agent 31 负责

```text
原始 BOM 文件
→ 表格识别
→ 列映射
→ 位号和数量
→ MPN/Manufacturer 原始字段
→ Canonical BOM Line
```

Agent 31 可以完成：

- Unicode 和空格清洗；
- 原始字段保留；
- 表头映射；
- MPN 文本标准显示；
- Manufacturer 原始文本标准化候选；
- Package 文本标准化；
- Evidence Anchor。

但它不应最终判断：

```text
这条 BOM 行对应器件数据库中的哪一个标准 Part
```

## 2.2 Agent 32 负责

```text
Canonical BOM Line
→ 候选召回
→ 候选特征计算
→ 规格和封装约束
→ 候选排序
→ 结果分级
→ 审核和 Crosswalk
```

---

# 3. 关键设计原则

## 3.1 原始输入不可变

保存：

```text
manufacturer_raw
mpn_raw
description_raw
package_raw
internal_part_number_raw
customer_part_number_raw
supplier_sku_raw
```

匹配结果另存：

```text
resolved_manufacturer_id
resolved_part_id
resolved_mpn
resolved_package_variant_id
resolved_ordering_variant_id
```

不得静默覆盖原值。

## 3.2 候选召回与候选排序分离

```text
Candidate Retrieval
→ Feature Extraction
→ Ranking
→ Decision
```

召回目标是正确候选进入 Top-K；排序目标是正确候选排到第一。

## 3.3 不强制匹配

没有合格候选时：

```text
status = unresolved
```

不能为了让每行都有结果，返回一个“最相似但错误”的型号。

## 3.4 Base Part 与 Ordering Variant 分离

例如：

```text
ADS1115
ADS1115IDGSR
ADS1115IDGST
```

必须分别建模：

```text
base_part_id
package_variant_id
ordering_variant_id
```

## 3.5 Supplier SKU 不等于 MPN

例如：

```text
296-TPS62160DSGRCT-ND
```

是 DigiKey SKU，不是制造商型号。

## 3.6 Replacement 不等于 Exact Match

必须区分：

```text
exact_identity
renamed_part
historical_alias
superseded_by
recommended_replacement
functional_alternative
```

## 3.7 Hard Constraint 优先

当封装、Pin Count、类别或明确规格冲突时，高文本相似度不能覆盖冲突。

## 3.8 Crosswalk 必须有作用域

```text
global
tenant
customer
project
supplier
```

某个客户的内部料号映射不能自动污染全局主数据。

## 3.9 规则和搜索优先，模型辅助

V1 使用：

```text
Exact Search
Crosswalk
Hybrid Retrieval
Rule Ranker
```

LLM 仅用于：

- 从描述中提取结构化特征；
- 解释 Top-K 冲突；
- 生成审核摘要。

LLM 不得从 110 万型号中自由挑一个答案。

---

# 4. 解析层级

结果必须声明解析到哪个层级：

```text
exact_part_resolved
ordering_variant_resolved
package_variant_resolved
base_part_resolved
family_resolved
generic_specification
multiple_approved_parts
unresolved
rejected
```

## 4.1 Exact Part Resolved

制造商和完整 MPN 唯一且无冲突。

## 4.2 Ordering Variant Resolved

完整订货型号、封装和包装差异已确定。

## 4.3 Base Part Resolved

只能确定基础器件，例如：

```text
LM358
```

但无法确定：

- SOIC/DIP/TSSOP；
- 温度等级；
- Tape and Reel / Tube。

## 4.4 Generic Specification

例如 BOM 只有：

```text
10 kΩ, 1%, 0402
```

输出一个通用规格，不虚构某一颗 Yageo 或 Murata 型号。

## 4.5 Multiple Approved Parts

一行本身表示 AVL，可输出多个批准 MPN。

---

# 5. 标准输入数据结构

```json
{
  "resolution_request_id": "uuid",
  "bom_id": "uuid",
  "bom_line_id": "uuid",

  "identifiers": {
    "manufacturer_raw": "TI",
    "mpn_raw": "TPS62I60DSGR",
    "internal_part_number_raw": "IC-PWR-00451",
    "customer_part_number_raw": "CUST-88901",
    "supplier_raw": "DigiKey",
    "supplier_sku_raw": "296-TPS62160DSGRCT-ND"
  },

  "engineering": {
    "description_raw": "3-17V 1A synchronous buck converter",
    "category": "power.dc-dc.buck",
    "value": null,
    "tolerance": null,
    "voltage_rating": "17 V",
    "current_rating": "1 A",
    "power_rating": null,
    "frequency": null,
    "package_raw": "WSON-8",
    "footprint_raw": "WSON8 2x2",
    "pin_count": 8
  },

  "context": {
    "tenant_id": "uuid",
    "customer_id": "uuid",
    "project_id": "uuid",
    "approved_vendor_list_id": null,
    "preferred_manufacturers": []
  },

  "evidence": {
    "bom_line_observation_id": "uuid",
    "field_evidence_ids": []
  }
}
```

---

# 6. 标准输出数据结构

```json
{
  "resolution_result_id": "uuid",
  "status": "review_required",

  "resolved": {
    "resolution_level": "ordering_variant_resolved",
    "manufacturer_id": "mfr-ti",
    "manufacturer_name": "Texas Instruments",
    "part_id": "part-tps62160",
    "base_part_number": "TPS62160",
    "manufacturer_part_number": "TPS62160DSGR",
    "package_variant_id": "pkg-wson8-2x2",
    "ordering_variant_id": "ov-tps62160dsgr"
  },

  "confidence": {
    "identifier": 0.96,
    "manufacturer": 0.99,
    "description": 0.92,
    "category": 0.99,
    "package": 0.95,
    "specification": 0.90,
    "crosswalk": 0.00,
    "overall": 0.96
  },

  "decision": {
    "tier": "ocr_variant_exact",
    "auto_approved": false,
    "review_required": true,
    "reason_codes": [
      "ocr_i_one_ambiguity"
    ]
  },

  "candidates": [],
  "evidence_bundle_id": "uuid",
  "provenance": {
    "search_index_version": "parts-2026-07",
    "manufacturer_registry_version": "manufacturer-1.0.0",
    "package_registry_version": "package-1.0.0",
    "ranker_version": "rule-ranker-1.0.0",
    "policy_version": "mpn-resolution-1.0.0"
  }
}
```

---

# 7. 核心领域对象

必须区分：

```text
InputIdentifier
ManufacturerCandidate
PartCandidate
OrderingVariantCandidate
MatchFeature
MatchConflict
MatchHypothesis
ResolutionDecision
Crosswalk
ReviewDecision
```

## 7.1 Match Hypothesis

表示：

```text
输入为什么可能对应某个候选
```

保存：

- 召回通道；
- 标准化过程；
- OCR 变换；
- 特征值；
- 约束冲突；
- 排名；
- 评分；
- 证据。

---

# 8. Manufacturer Registry

## 8.1 Manufacturer Entity

字段：

```text
manufacturer_id
canonical_name
short_name
legal_name
brands
divisions
former_names
acquired_names
website_domains
country
active_status
```

## 8.2 Alias

例如：

```text
TI
Texas Instruments
Texas Instrument
T.I.
德州仪器
```

都可映射到同一 Manufacturer Entity。

## 8.3 品牌和法律制造商分离

保存：

```text
brand
legal_manufacturer
current_owner
historical_manufacturer
```

不能因为企业收购，直接改写历史 Datasheet 上的制造商品牌。

## 8.4 Manufacturer Resolution 信号

- Manufacturer 列；
- MPN 前缀；
- Supplier 数据；
- Datasheet URL Domain；
- Description；
- Crosswalk；
- 历史采购；
- 同 BOM 上下文。

---

# 9. 输入标识符类型识别

首先判断输入属于：

```text
manufacturer_part_number
base_part_number
internal_part_number
customer_part_number
supplier_sku
generic_description
multiple_part_numbers
unknown_identifier
```

使用：

- 上游列语义；
- 企业 Profile；
- 字符模式；
- Manufacturer 是否存在；
- Supplier 是否存在；
- 数据库命中；
- 同列样本；
- Prefix 规则。

不能只凭正则认定：

```text
ABC-12345
```

是 MPN。

---

# 10. MPN 标准化模型

必须保留五种形式：

```text
raw
normalized_display
strict_key
loose_search_keys
tokens
```

## 10.1 Safe Normalization

允许：

- Trim；
- Unicode NFKC；
- 删除零宽字符；
- 全角转半角；
- 标准化破折号；
- 合并明显换行；
- 大小写 Search Key；
- 标准化空格。

## 10.2 Strict Key

用于精确匹配：

- 保留有意义的 `/ - . + #`；
- 保留所有后缀；
- 按厂商 Profile 决定大小写敏感性。

## 10.3 Loose Search Key

用于召回：

- 可生成删除常见分隔符的形式；
- 可生成前缀和后缀 Token；
- 不得写回正式 MPN。

## 10.4 禁止的静默变换

- O→0；
- I→1；
- S→5；
- B→8；
- 删除包装后缀；
- 截断型号；
- 自动添加制造商前缀；
- 删除所有符号后覆盖正式值。

---

# 11. OCR 歧义候选生成

## 11.1 常见字符

```text
O ↔ 0
I ↔ 1 ↔ l
S ↔ 5
B ↔ 8
Z ↔ 2
G ↔ 6
Q ↔ 0
rn ↔ m
- ↔ –
```

## 11.2 生成限制

防止候选爆炸：

- 只处理 OCR 低置信度字符；
- 只处理疑似 MPN 区域；
- 最大变换位置数；
- 最大候选数；
- Manufacturer Prefix 约束；
- 数据库前缀约束；
- 严格超时。

## 11.3 输出

```json
{
  "input": "TPS62I60DSGR",
  "candidate": "TPS62160DSGR",
  "transforms": [
    {
      "position": 5,
      "from": "I",
      "to": "1",
      "reason": "ocr_low_confidence"
    }
  ]
}
```

默认进入审核，除非后续基准数据证明某些受控场景可安全自动批准。

---

# 12. Base Part、后缀和 Ordering Code

## 12.1 分层

```text
family
base_part
device_variant
performance_grade
speed_grade
voltage_grade
package_code
temperature_grade
quality_grade
packing_code
environmental_code
revision_code
```

## 12.2 Manufacturer Profile

每个厂商独立 Profile：

```text
ordering-profiles/
├── texas-instruments.yaml
├── analog-devices.yaml
├── stmicroelectronics.yaml
├── nxp.yaml
├── infineon.yaml
├── microchip.yaml
├── onsemi.yaml
├── renesas.yaml
├── rohm.yaml
├── mps.yaml
├── lattice.yaml
├── amd-xilinx.yaml
└── intel-psg.yaml
```

## 12.3 禁止跨厂商解释后缀

`D`、`R`、`P`、`T` 在不同厂商中的意义不同。

## 12.4 缺少后缀

输入：

```text
TPS62160
```

输出：

```text
base_part_resolved
ordering_variant_unresolved
```

再使用 Package、Footprint、Supplier SKU 和 Variant 信息消歧。

---

# 13. Crosswalk 模型

## 13.1 支持类型

```text
internal_part_number
customer_part_number
supplier_sku
erp_material_number
plm_material_number
historical_part_number
legacy_brand_number
project_alias
```

## 13.2 作用域

```text
global
tenant
customer
project
supplier
```

## 13.3 优先级

```text
approved tenant mapping
approved customer mapping
approved enterprise mapping
verified supplier SKU mapping
historical mapping
machine-proposed mapping
```

## 13.4 有效性

保存：

```text
valid_from
valid_to
assembly_revision
project_revision
status
approved_by
evidence
```

## 13.5 防止污染

客户 A 的料号映射不能用于客户 B。

---

# 14. 候选召回总架构

采用多通道召回：

```text
A. Exact Identifier
B. Crosswalk
C. Manufacturer + Strict MPN
D. Loose MPN Search
E. Base Part / Family
F. Supplier SKU
G. OCR Variants
H. Description + Category
I. Specification + Package
J. Historical Alias
```

各通道统一输出 `PartCandidate`。

---

# 15. Channel A：精确匹配

索引：

```text
manufacturer_id + full_mpn
full_mpn
strict_key
base_part
ordering_code
```

规则：

- Manufacturer+MPN 唯一命中优先；
- 同一 MPN 跨 Manufacturer 出现时必须结合 Manufacturer；
- 无 Manufacturer 且多条精确命中时进入审核。

---

# 16. Channel B：Crosswalk

查询：

```text
scope + identifier_type + identifier_normalized
```

匹配后仍要检查：

- BOM 显式 MPN 是否冲突；
- Package 是否冲突；
- 描述和类别是否严重冲突；
- Crosswalk 是否过期。

---

# 17. Channel C/D：文本搜索

推荐索引：

```text
keyword exact
normalized keyword
prefix
edge n-gram
character n-gram
trigram
suffix token
manufacturer filter
```

编辑距离仅用于召回。

对短型号必须更严格：

```text
NE555
LM358
```

一个字符差异可能是完全不同器件。

---

# 18. Channel E：Base Part 和 Family

用于：

- 缺少后缀；
- 型号被截断；
- 描述只有系列名；
- Package 信息足以继续消歧。

Family Candidate 不得直接当 Exact Part。

---

# 19. Channel F：Supplier SKU

示例：

```text
296-TPS62160DSGRCT-ND
→ TPS62160DSGR
```

保存：

- Supplier；
- SKU；
- Source Snapshot；
- Mapping Time；
- 数据版本；
- 授权状态。

Supplier SKU 不能覆盖 BOM 中显式且冲突的 MPN。

---

# 20. Channel H：描述语义召回

## 20.1 先结构化

从描述中提取：

```text
category
function
value
tolerance
voltage
current
power
frequency
memory
channel count
interface
package
pin count
temperature grade
```

## 20.2 Hybrid Search

```text
lexical search
+ structured filters
+ vector recall
```

Vector 只做召回和辅助排序。

## 20.3 Description-only 限制

只有描述、没有型号时，默认不能自动精确匹配到唯一 MPN，除非企业 Crosswalk 或其他强证据支持。

---

# 21. Channel I：规格和封装召回

## 21.1 被动器件

比较：

```text
resistance/capacitance/inductance
tolerance
voltage
power
temperature coefficient
dielectric
package
```

## 21.2 IC

比较：

```text
category
supply voltage
channel count
interface
memory
speed
package
pin count
temperature grade
```

## 21.3 Package

比较：

```text
package family
pin count
body size
pitch
manufacturer package code
footprint
```

---

# 22. Hard Constraint 与 Soft Constraint

## 22.1 Hard Constraint

明确冲突时阻断自动批准：

- Manufacturer 明确冲突；
- 类别明确冲突；
- Pin Count 明确冲突；
- Package 明确冲突；
- Value 明确冲突；
- Channel Count 明确冲突；
- Memory/Speed Grade 明确冲突；
- Temperature/Quality Grade 明确冲突。

## 22.2 Soft Constraint

用于评分：

- Description 相似度；
- Manufacturer 缺失；
- Package 别名；
- 部分规格缺失；
- Datasheet 相似性；
- 历史使用频率。

---

# 23. Candidate 数据结构

```json
{
  "candidate_id": "uuid",
  "manufacturer_id": "mfr-ti",
  "part_id": "part-tps62160",
  "ordering_variant_id": "ov-tps62160dsgr",
  "manufacturer_part_number": "TPS62160DSGR",
  "base_part_number": "TPS62160",

  "retrieval": {
    "channels": [
      "ocr_variant_exact",
      "description",
      "package"
    ],
    "channel_ranks": {
      "ocr_variant_exact": 1,
      "description": 2
    }
  },

  "features": {
    "manufacturer_exact": 1.0,
    "mpn_exact": 0.0,
    "mpn_ocr_variant": 1.0,
    "mpn_similarity": 0.96,
    "description_similarity": 0.92,
    "category_match": 1.0,
    "package_match": 0.95,
    "pin_count_match": 1.0,
    "specification_match": 0.90,
    "crosswalk_match": 0.0
  },

  "conflicts": [],
  "score": 0.96
}
```

---

# 24. 特征体系

## 24.1 Identifier 特征

```text
raw exact
strict exact
loose exact
prefix
suffix
character n-gram
edit distance
OCR transform count
token overlap
base part match
```

## 24.2 Manufacturer 特征

```text
exact
alias
brand
historical manufacturer
MPN prefix consistency
supplier confirmation
datasheet domain
```

## 24.3 Description 特征

```text
lexical similarity
semantic similarity
category
function
interface
channel count
```

## 24.4 Specification 特征

```text
value
tolerance
voltage
current
power
frequency
memory
speed
temperature
```

## 24.5 Package 特征

```text
family
pin count
body size
pitch
footprint
manufacturer package code
```

## 24.6 企业上下文特征

```text
internal PN Crosswalk
customer PN Crosswalk
AVL
historical purchase
project history
tenant frequency
approved manufacturer
```

## 24.7 数据质量特征

```text
OCR confidence
column mapping confidence
source type
evidence completeness
```

---

# 25. 候选精排

## 25.1 V1：可解释规则 Ranker

使用：

```text
weighted feature score
+ hard constraint filters
+ conflict penalties
+ source trust
```

## 25.2 V2：Learning-to-Rank

可使用：

- LightGBM Ranker；
- LambdaMART；
- XGBoost Pairwise Ranker。

训练数据来自人工审核。

## 25.3 不建议端到端生成式模型

原因：

- 无法稳定处理后缀；
- 难解释；
- 难校准；
- 110 万候选成本高；
- 容易“看起来合理但实际错误”。

---

# 26. 决策策略

结果分为：

```text
auto_approved_exact
auto_approved_high_confidence
review_required
base_part_only
generic_specification
multiple_approved_parts
unresolved
rejected
```

## 26.1 Auto Approved Exact

要求：

- Manufacturer 精确；
- Full MPN 精确；
- 数据库唯一；
- 无 Hard Conflict；
- 记录状态可信；
- Evidence 完整。

## 26.2 High Confidence

要求：

- Top1 高于阈值；
- Top1-Top2 Margin 高于阈值；
- 无 Hard Conflict；
- Package/Spec 一致；
- Candidate 数据完整。

## 26.3 Review Required

触发：

- OCR 字符变换；
- Manufacturer 不确定；
- Top1 和 Top2 接近；
- Base Part 多个 Package；
- Crosswalk 未批准；
- Package 冲突；
- Supplier SKU 与显式 MPN 冲突；
- Description 与 MPN 冲突；
- 历史型号和新型号混淆。

## 26.4 Unresolved

没有合格候选，或候选均有严重冲突。

---

# 27. Top1 与 Top2 Margin

不能只看 Top1。

例如：

```text
Top1 = 0.94
Top2 = 0.93
```

必须审核。

决策条件：

```text
top1_score >= threshold
AND top1_top2_margin >= margin_threshold
AND no_hard_conflict
```

---

# 28. 典型冲突类型

```text
manufacturer_conflict
manufacturer_unknown
mpn_not_found
multiple_exact_records
ocr_ambiguity
base_part_only
suffix_unknown
package_conflict
pin_count_conflict
category_conflict
description_conflict
value_conflict
tolerance_conflict
voltage_conflict
current_conflict
power_conflict
temperature_grade_conflict
supplier_sku_conflict
internal_crosswalk_conflict
customer_crosswalk_conflict
historical_mapping_conflict
candidate_tie
obsolete_replacement_confusion
```

---

# 29. 特殊业务场景

## 29.1 无 MPN 的被动器件

输入：

```text
10 kΩ 1% 0402
```

输出：

```text
generic_specification
```

下游采购 Agent 可推荐多个符合型号。

## 29.2 AVL 多型号

一行可以解析为：

```text
primary_part
approved_alternates[]
```

不强制只选一个。

## 29.3 多型号单元格

例如：

```text
TPS62160DSGR / TPS62160DGKR
```

保存两个候选。

如果无法判断主次：

```text
multiple_approved_parts
```

或进入审核。

## 29.4 “LM358 compatible”

不能直接解析为某个具体制造商的 LM358。

## 29.5 历史品牌和收购

保留原品牌和当前所有者关系，不能把历史品牌名当错误数据删除。

## 29.6 停产型号和替代型号

精确身份解析与替代建议必须分开。

---

# 30. 批量上下文

BOM 行之间可以提供辅助信息：

- 同一 BOM Manufacturer 命名习惯；
- 同一客户 Internal PN Prefix；
- 同一项目重复物料；
- 同一 BOM 系列器件；
- 同一 Package 命名方式；
- 相同疑似 MPN 多次出现。

但批量上下文不能覆盖当前行明确证据。

---

# 31. Identifier Graph

可以构建图：

```text
Internal PN
Customer PN
Supplier SKU
Manufacturer
MPN
Base Part
Ordering Variant
Package
Datasheet
```

边：

```text
maps_to
supplied_as
belongs_to
packaged_as
historical_alias_of
superseded_by
approved_alternate_of
```

用于召回、解释和影响分析。

---

# 32. Evidence 与 Provenance

每个匹配结果保存：

```text
BOM 原始单元格
Agent 31 Canonical 字段
Manufacturer Registry
Crosswalk
Candidate Query
Candidate Set
Feature Values
Hard Constraint
Ranker Version
Decision Policy
人工审核
最终 Mapping
```

Evidence Bundle：

```text
primary
supporting
conflicting
derived
```

---

# 33. 人工审核台

## 33.1 页面布局

```text
左侧：原始 BOM 行和证据
中间：Top-K 候选
右侧：规格、封装和品牌差异
底部：Crosswalk、历史、规则和决策日志
```

## 33.2 Candidate 对比字段

- Manufacturer；
- Full MPN；
- Base Part；
- Ordering Variant；
- Description；
- Category；
- Package；
- Pin Count；
- 关键参数；
- Lifecycle；
- Datasheet；
- Symbol/Footprint/3D；
- Score；
- 冲突。

## 33.3 审核操作

```text
选择 Candidate
只解析到 Base Part
选择多个 AVL 型号
标记 Generic Specification
标记 unresolved
修正 Manufacturer
确认 OCR 变换
创建 Crosswalk Proposal
请求新增 Part
请求抓取 Datasheet
```

---

# 34. Mapping Patch

```json
{
  "patch_id": "uuid",
  "target_type": "bom_line_resolution",
  "target_id": "uuid",
  "base_version": "machine-v1",

  "operations": [
    {
      "op": "replace",
      "path": "/resolved/part_id",
      "old_value": null,
      "value": "part-tps62160"
    },
    {
      "op": "replace",
      "path": "/resolved/ordering_variant_id",
      "old_value": null,
      "value": "ov-tps62160dsgr"
    }
  ],

  "reason_code": "ocr_character_confusion_confirmed",
  "evidence_ids": [],
  "reviewer_id": "uuid"
}
```

人工 Patch 不覆盖机器结果。

---

# 35. Crosswalk Proposal

```json
{
  "proposal_type": "internal_part_crosswalk",
  "scope": {
    "type": "tenant",
    "id": "uuid"
  },
  "source_identifier": "IC-PWR-00451",
  "target_part_id": "part-tps62160",
  "target_ordering_variant_id": "ov-tps62160dsgr",
  "status": "pending",
  "evidence_ids": [],
  "effective_revision": "RevC"
}
```

审核通过后才生效。

---

# 36. 搜索索引设计

建议拆分索引。

## 36.1 Exact Index

```text
manufacturer_id
full_mpn
strict_key
base_part
ordering_code
```

## 36.2 Hybrid Text Index

```text
normalized_mpn
loose_keys
description
category
manufacturer_aliases
package_aliases
```

## 36.3 Vector Index

```text
normalized description embedding
structured specification embedding
```

只做辅助召回。

## 36.4 Crosswalk Index

```text
scope
identifier_type
identifier
target
validity
status
```

---

# 37. 数据库设计

## 37.1 `mpn_resolution_jobs`

```text
id UUID PK
bom_id UUID NOT NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
policy_version VARCHAR NOT NULL
index_version VARCHAR NOT NULL
ranker_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 37.2 `mpn_resolution_results`

```text
id UUID PK
job_id UUID NOT NULL
bom_line_id UUID NOT NULL
status VARCHAR NOT NULL
resolution_level VARCHAR NOT NULL
manufacturer_id UUID NULL
part_id UUID NULL
package_variant_id UUID NULL
ordering_variant_id UUID NULL
resolved_mpn VARCHAR NULL
overall_confidence NUMERIC(5,4)
review_required BOOLEAN NOT NULL
reason_codes JSONB NOT NULL
candidate_set_uri TEXT NOT NULL
feature_report_uri TEXT NOT NULL
evidence_bundle_id UUID NULL
created_at TIMESTAMPTZ
UNIQUE(job_id, bom_line_id)
```

## 37.3 `mpn_resolution_candidates`

只在数据库保存 Top-N：

```text
id UUID PK
result_id UUID NOT NULL
rank INT NOT NULL
part_id UUID NOT NULL
ordering_variant_id UUID NULL
score NUMERIC(7,6) NOT NULL
retrieval_channels JSONB NOT NULL
conflicts JSONB NOT NULL
feature_summary JSONB NOT NULL
UNIQUE(result_id, rank)
```

完整 Candidate Set 放对象存储。

## 37.4 `part_identifier_crosswalks`

```text
id UUID PK
scope_type VARCHAR NOT NULL
scope_id UUID NULL
identifier_type VARCHAR NOT NULL
identifier_raw TEXT NOT NULL
identifier_normalized TEXT NOT NULL
manufacturer_id UUID NULL
target_part_id UUID NOT NULL
target_ordering_variant_id UUID NULL
status VARCHAR NOT NULL
confidence NUMERIC(5,4)
source_type VARCHAR NOT NULL
evidence JSONB NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_by UUID NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

## 37.5 `manufacturer_aliases`

```text
id UUID PK
manufacturer_id UUID NOT NULL
alias VARCHAR NOT NULL
alias_normalized VARCHAR NOT NULL
alias_type VARCHAR NOT NULL
language VARCHAR NULL
valid_from DATE NULL
valid_to DATE NULL
status VARCHAR NOT NULL
UNIQUE(alias_normalized, manufacturer_id)
```

## 37.6 `mpn_resolution_reviews`

```text
id UUID PK
job_id UUID NOT NULL
result_id UUID NOT NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data_uri TEXT NOT NULL
resolution JSONB NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 38. 对象存储

```text
derived/mpn-resolution/
  {bom_id}/
    {job_id}/
      input/
        normalized-lines.json.zst
      retrieval/
        query-plans.json
        channel-results/
      candidates/
        candidate-sets.json.zst
      features/
        feature-report.json.zst
        conflict-report.json
      decisions/
        resolution-results.json.zst
      evidence/
        evidence-manifest.json
      reviews/
        review-items.json
      reports/
        quality-report.json
        coverage-report.json
      debug/
        normalization-log.json
        ocr-variants.json
        ranker-log.json
```

---

# 39. API 设计

## 39.1 创建任务

```text
POST /api/v1/mpn-resolution/jobs
```

```json
{
  "bom_id": "uuid",
  "bom_result_id": "uuid",

  "line_filter": {
    "line_ids": null,
    "only_unresolved": true,
    "include_dnp": false
  },

  "context": {
    "tenant_id": "uuid",
    "customer_id": "uuid",
    "project_id": "uuid",
    "preferred_manufacturers": [],
    "approved_vendor_list_id": null
  },

  "options": {
    "allow_supplier_sku_lookup": true,
    "allow_description_search": true,
    "allow_ocr_variants": true,
    "max_candidates": 20,
    "auto_approve": true
  },

  "versions": {
    "policy": "mpn-resolution-1.0.0",
    "manufacturer_registry": "manufacturer-1.0.0",
    "package_registry": "package-1.0.0",
    "search_index": "parts-index-2026-07",
    "ranker": "rule-ranker-1.0.0"
  },

  "idempotency_key": "uuid"
}
```

## 39.2 写接口

```text
POST /api/v1/mpn-resolution/jobs
POST /api/v1/mpn-resolution/batches
POST /api/v1/mpn-resolution/jobs/{job_id}/retry
POST /api/v1/mpn-resolution/jobs/{job_id}/cancel
POST /api/v1/mpn-resolution/jobs/{job_id}/rerank
POST /api/v1/mpn-resolution/results/{result_id}/refresh-candidates
POST /api/v1/mpn-resolution/reviews/{review_id}/resolve
POST /api/v1/mpn-resolution/crosswalk-proposals
POST /api/v1/mpn-resolution/crosswalks/{id}/approve
```

## 39.3 读接口

```text
GET /api/v1/mpn-resolution/jobs/{job_id}
GET /api/v1/mpn-resolution/jobs/{job_id}/events
GET /api/v1/mpn-resolution/results/{result_id}
GET /api/v1/mpn-resolution/results/{result_id}/candidates
GET /api/v1/mpn-resolution/results/{result_id}/features
GET /api/v1/mpn-resolution/boms/{bom_id}/coverage
GET /api/v1/mpn-resolution/crosswalks
GET /api/v1/mpn-resolution/manufacturers
GET /api/v1/mpn-resolution/reviews
GET /health/live
GET /health/ready
GET /metrics
```

---

# 40. 状态机

```text
RECEIVED
  ↓
LOADING_CANONICAL_BOM
  ↓
LOADING_CONTEXT
  ↓
NORMALIZING_IDENTIFIERS
  ↓
RESOLVING_MANUFACTURER
  ↓
QUERYING_CROSSWALKS
  ↓
RETRIEVING_EXACT_CANDIDATES
  ↓
RETRIEVING_FUZZY_CANDIDATES
  ↓
RETRIEVING_DESCRIPTION_CANDIDATES
  ↓
GENERATING_OCR_VARIANTS
  ↓
MERGING_CANDIDATES
  ↓
EXTRACTING_FEATURES
  ↓
VALIDATING_CONSTRAINTS
  ↓
RANKING
  ↓
CALIBRATING_CONFIDENCE
  ↓
APPLYING_DECISION_POLICY
  ↓
BUILDING_RESULTS
  ↓
CREATING_REVIEWS
  ↓
STORING_RESULTS
  ↓
COMPLETED
```

分支：

```text
REVIEW_REQUIRED
PART_DATA_MISSING
INDEX_UNAVAILABLE
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 41. 错误码

```text
BOM_NOT_FOUND
BOM_LINE_NOT_FOUND
CANONICAL_LINE_INVALID
MANUFACTURER_UNRESOLVED
MANUFACTURER_CONFLICT
IDENTIFIER_TYPE_AMBIGUOUS
MPN_EMPTY
MPN_NOT_FOUND
MPN_MULTIPLE_EXACT
MPN_OCR_AMBIGUOUS
MPN_SUFFIX_UNKNOWN
BASE_PART_ONLY
CROSSWALK_CONFLICT
SUPPLIER_SKU_UNRESOLVED
SEARCH_INDEX_UNAVAILABLE
CANDIDATE_RETRIEVAL_EMPTY
CANDIDATE_LIMIT_EXCEEDED
PACKAGE_CONFLICT
PIN_COUNT_CONFLICT
CATEGORY_CONFLICT
SPECIFICATION_CONFLICT
MULTIPLE_CANDIDATE_TIE
CONFIDENCE_BELOW_THRESHOLD
PART_MASTER_DATA_INCOMPLETE
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 42. 自动决策 Tier

## Tier 1：Approved Crosswalk

```text
作用域匹配
+ 已批准
+ 未过期
+ 无 BOM 明确冲突
```

自动批准。

## Tier 2：Manufacturer + Exact MPN

```text
Manufacturer 唯一
+ Full MPN 唯一
+ 无 Hard Conflict
```

自动批准。

## Tier 3：Exact MPN，无 Manufacturer

只有全库唯一且规格/封装一致时自动批准。

## Tier 4：OCR Variant Exact

默认审核。

## Tier 5：Fuzzy Match

默认审核。

## Tier 6：Description-only

只生成候选或 Generic Specification。

---

# 43. 质量评分

## 43.1 Line Level

```text
identifier_quality
manufacturer_quality
candidate_coverage
top1_score
top1_top2_margin
constraint_consistency
evidence_completeness
```

## 43.2 BOM Level

```text
exact_resolution_rate
base_part_resolution_rate
generic_specification_rate
review_rate
unresolved_rate
crosswalk_hit_rate
ocr_ambiguity_rate
package_conflict_rate
```

---

# 44. 置信度校准

规则分数不应直接称为“概率”。

需要评估：

- Reliability Diagram；
- Expected Calibration Error；
- Accuracy by Confidence Bucket；
- Top1 Accuracy；
- Top-K Recall；
- Auto Approval Accuracy。

V1 可以先输出：

```text
raw_score
calibrated_confidence
```

即使 calibration 暂时未上线，也要预留结构。

---

# 45. Benchmark

## 45.1 Candidate Retrieval

- Top-1 Recall；
- Top-5 Recall；
- Top-20 Recall；
- Exact MPN Recall；
- Crosswalk Recall；
- OCR Variant Recall。

## 45.2 Ranking

- Top-1 Accuracy；
- Mean Reciprocal Rank；
- NDCG；
- Pairwise Accuracy；
- Top1/Top2 Margin。

## 45.3 Resolution

- Manufacturer Accuracy；
- Exact Part Accuracy；
- Base Part Accuracy；
- Ordering Variant Accuracy；
- Package Variant Accuracy；
- Generic Specification Accuracy；
- Unresolved Precision。

## 45.4 业务指标

- Auto Approval Accuracy；
- False Match Rate；
- Human Correction Rate；
- Review Time；
- Crosswalk Reuse Rate。

---

# 46. 初始质量目标

```text
Manufacturer + Exact MPN Top1 Accuracy >= 99.8%
Approved Crosswalk Accuracy >= 99.9%
Candidate Top20 Recall >= 99.5%
Candidate Top5 Recall >= 99%
Manufacturer Resolution Accuracy >= 99%
Ordering Variant Accuracy >= 98%
OCR Variant Top5 Recall >= 97%
High-confidence Auto Approval Accuracy >= 99%
False Exact Match Rate <= 0.1%
Unresolved Precision >= 98%
```

描述-only、扫描件和 Generic Passive 必须单独报告。

这些是目标，不是未经测试的保证。

---

# 47. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## 47.1 Exact

1. Manufacturer + Exact MPN；
2. Exact MPN 无 Manufacturer；
3. 同号跨 Manufacturer；
4. 大小写；
5. Unicode Dash；
6. 空格；
7. 换行；
8. 分隔符；
9. 完整 Ordering Code；
10. Base Part。

## 47.2 Crosswalk

11. Internal PN；
12. Customer PN；
13. Supplier SKU；
14. Tenant Scope；
15. Customer Scope；
16. Expired Mapping；
17. Conflicting Mapping；
18. Pending Proposal；
19. Historical Revision；
20. Multi-target AVL。

## 47.3 OCR

21. O/0；
22. I/1；
23. l/1；
24. S/5；
25. B/8；
26. Z/2；
27. G/6；
28. rn/m；
29. Multiple Ambiguities；
30. Candidate Explosion Limit。

## 47.4 Suffix

31. TI；
32. ADI；
33. ST；
34. NXP；
35. Microchip；
36. onsemi；
37. Infineon；
38. Renesas；
39. MPS；
40. FPGA Speed Grade；
41. Missing Suffix；
42. Unknown Suffix；
43. Supplier Packing Suffix；
44. Temperature Grade；
45. Automotive。

## 47.5 Description / Spec

46. Resistor Value；
47. Capacitor Value；
48. Tolerance；
49. Voltage；
50. Power；
51. Package；
52. Pin Count；
53. MCU Memory；
54. ADC Channel；
55. Interface；
56. Category Conflict；
57. Value Conflict；
58. Package Conflict；
59. Description-only；
60. Generic Part。

## 47.6 Complex

61. Multiple MPN Cell；
62. Approved Alternates；
63. Base Part Multiple Packages；
64. Historical Manufacturer；
65. Acquired Brand；
66. Obsolete vs Replacement；
67. Marketplace SKU；
68. Datasheet URL；
69. Part Master Incomplete；
70. Candidate Tie；
71. Wrong Manufacturer；
72. Wrong Package；
73. Crosswalk vs MPN Conflict；
74. Supplier SKU vs MPN Conflict；
75. Manual Resolve；
76. Crosswalk Proposal；
77. Rerank after Data Update；
78. Index Version Change；
79. Batch BOM Context；
80. Unresolved。

---

# 48. 性能要求

## 48.1 单行

```text
Exact/Crosswalk P95 < 100 ms
Hybrid Search P95 < 500 ms
```

## 48.2 批量 BOM

```text
10,000 lines
```

目标：

- Exact/Crosswalk Batch < 30 秒；
- Hybrid Retrieval < 5 分钟；
- 不含外部实时 API。

## 48.3 批量优化

- Identifier 去重；
- 同 MPN 只查询一次；
- 同 Internal PN 只解析一次；
- Bulk Search；
- Candidate Cache；
- Manufacturer Filter；
- 异步 Supplier Validation。

---

# 49. 缓存与增量更新

缓存键：

```text
input_identifier_hash
+ engineering_constraint_hash
+ context_scope_hash
+ manufacturer_registry_version
+ package_registry_version
+ crosswalk_version
+ search_index_version
+ ranker_version
+ policy_version
```

## 49.1 Crosswalk 更新

只重跑受影响 Identifier。

## 49.2 Part 数据更新

重跑：

- unresolved；
- package conflict；
- specification conflict；
- affected candidate records。

## 49.3 Ranker 更新

可直接重排已保存 Candidate Set。

## 49.4 BOM Patch

只重跑当前行和共享 Identifier 的行。

---

# 50. 可观测性

## 50.1 Prometheus

```text
mpn_resolution_jobs_total{status}
mpn_resolution_lines_total{status,level}
mpn_resolution_duration_seconds{step}
mpn_resolution_retrieval_total{channel,result}
mpn_resolution_candidates_count
mpn_resolution_crosswalk_hits_total{scope,type}
mpn_resolution_exact_hits_total{manufacturer_known}
mpn_resolution_ocr_variants_total{result}
mpn_resolution_conflicts_total{type}
mpn_resolution_review_total{reason}
mpn_resolution_auto_approval_total{tier}
mpn_resolution_false_match_total{tier}
mpn_resolution_unresolved_total{category}
mpn_resolution_cache_hits_total{stage}
```

## 50.2 Dashboard

- Exact Match Rate；
- Crosswalk Hit Rate；
- Base Part Rate；
- Ordering Variant Rate；
- Review Rate；
- Unresolved Rate；
- OCR Ambiguity；
- Manufacturer Unknown；
- Package Conflict；
- Auto Approval Accuracy；
- Human Correction Rate；
- 各客户 Crosswalk 复用率；
- 各类别准确率；
- 各索引版本质量。

---

# 51. 安全和权限

- Crosswalk 按租户隔离；
- 客户料号不能跨客户泄露；
- Supplier 合同数据按权限访问；
- 外部 API Key 只保存在服务端；
- 搜索日志脱敏；
- Review UI 遵守项目权限；
- 不把私有 BOM 发送到外部通用模型；
- LLM 只接收必要受控字段；
- Candidate 和 Evidence URI 使用签名 URL；
- 审核日志不可删除。

---

# 52. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
OpenSearch / Elasticsearch
Redis
S3 / R2 / MinIO
```

可选：

```text
pg_trgm
pgvector
LightGBM
XGBoost
```

V1 推荐：

```text
PostgreSQL Exact/Crosswalk
+ OpenSearch Hybrid Retrieval
+ Rule-based Explainable Ranker
```

---

# 53. 推荐仓库结构

```text
mpn-resolution-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── mpn-resolution-agent-spec.md
│   ├── identifier-normalization.md
│   ├── manufacturer-registry.md
│   ├── crosswalk-model.md
│   ├── candidate-retrieval.md
│   ├── ranking-and-confidence.md
│   ├── ordering-code-resolution.md
│   ├── evidence-and-review.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-retrieval-before-ranking.md
│       ├── 0002-no-silent-ocr-correction.md
│       ├── 0003-resolution-levels.md
│       ├── 0004-tenant-scoped-crosswalk.md
│       └── 0005-no-forced-match.md
├── src/
│   └── mpn_resolution/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── request.py
│       │   ├── candidate.py
│       │   ├── result.py
│       │   ├── crosswalk.py
│       │   └── evidence.py
│       ├── events/
│       ├── jobs/
│       ├── normalization/
│       │   ├── identifier_type.py
│       │   ├── mpn.py
│       │   ├── manufacturer.py
│       │   ├── supplier_sku.py
│       │   └── ocr_variants.py
│       ├── registries/
│       │   ├── manufacturer.py
│       │   ├── package.py
│       │   └── ordering_profiles.py
│       ├── crosswalks/
│       │   ├── lookup.py
│       │   ├── scope.py
│       │   ├── validity.py
│       │   └── proposals.py
│       ├── retrieval/
│       │   ├── planner.py
│       │   ├── exact.py
│       │   ├── fuzzy.py
│       │   ├── description.py
│       │   ├── specification.py
│       │   ├── supplier.py
│       │   ├── family.py
│       │   └── merger.py
│       ├── features/
│       │   ├── identifier.py
│       │   ├── manufacturer.py
│       │   ├── description.py
│       │   ├── specification.py
│       │   ├── package.py
│       │   ├── context.py
│       │   └── quality.py
│       ├── ranking/
│       │   ├── rules.py
│       │   ├── scorer.py
│       │   ├── conflicts.py
│       │   ├── margin.py
│       │   ├── calibration.py
│       │   └── decision.py
│       ├── ordering/
│       │   ├── parser.py
│       │   ├── base_part.py
│       │   ├── suffix.py
│       │   └── variant.py
│       ├── evidence/
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
│   ├── mpn-resolution-1.0.0.yaml
│   ├── candidate-retrieval.yaml
│   ├── ranking.yaml
│   ├── decision-thresholds.yaml
│   ├── ocr-ambiguity.yaml
│   └── review.yaml
├── manufacturer-registry/
├── ordering-profiles/
├── schemas/
│   ├── resolution-request.schema.json
│   ├── candidate.schema.json
│   ├── resolution-result.schema.json
│   ├── crosswalk.schema.json
│   └── quality-report.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── normalization/
│   ├── manufacturer/
│   ├── crosswalk/
│   ├── retrieval/
│   ├── ranking/
│   ├── ordering/
│   ├── review/
│   ├── security/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── build_part_search_index.py
    ├── validate_manufacturer_registry.py
    ├── validate_crosswalks.py
    ├── run_resolution_benchmark.py
    ├── calibrate_confidence.py
    ├── compare_ranker_versions.py
    └── export_review_training_data.py
```

---

# 54. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察与主数据盘点

Codex 必须：

1. 阅读 Agent 31 规格和实际输出；
2. 查找 110 万器件主数据；
3. 查找 Manufacturer 和 Alias；
4. 查找 MPN、Base Part、Ordering Variant；
5. 查找 Internal PN、Customer PN、Supplier SKU；
6. 查找 Package、Parameter 和 Datasheet；
7. 查找搜索索引；
8. 查找历史 BOM 匹配逻辑；
9. 抽样分析脱敏数据；
10. 输出数据质量报告；
11. 不修改业务代码；
12. 不创建 Migration；
13. 不安装依赖。

## Phase 1：Domain Model 与 JSON Schema

实现：

- Resolution Request；
- Candidate；
- Feature；
- Conflict；
- Result；
- Crosswalk；
- Event；
- JSON Schema。

## Phase 2：Manufacturer Registry

实现：

- Canonical Manufacturer；
- Alias；
- Brand；
- Historical Manufacturer；
- Domain；
- Normalization；
- Tests。

## Phase 3：Identifier Normalization

实现：

- Raw/Display/Strict/Loose；
- Identifier Type；
- Supplier SKU；
- Multiple MPN；
- Safe Normalization；
- No Silent Correction。

## Phase 4：Crosswalk

实现：

- Internal PN；
- Customer PN；
- Supplier SKU；
- Scope；
- Validity；
- Approval；
- Conflict；
- Lookup。

## Phase 5：Exact Candidate Retrieval

实现：

- Manufacturer+MPN；
- Exact MPN；
- Base Part；
- Ordering Variant；
- Batch Query；
- Unique/Conflict。

## Phase 6：Fuzzy 与 OCR Candidate

实现：

- Character n-gram；
- Edit Distance；
- Prefix；
- OCR Variant；
- Candidate Limit；
- Manufacturer Constraint。

## Phase 7：Description、Category 和 Spec Retrieval

实现：

- Structured Extraction；
- Lexical Search；
- Optional Vector；
- Package；
- Value；
- Category；
- Top-K Merge。

## Phase 8：Ordering Code Resolution

实现：

- Base Part；
- Package；
- Temperature；
- Quality；
- Packing；
- Manufacturer Profiles；
- Missing/Unknown Suffix。

## Phase 9：Feature Extraction 与 Hard Constraints

实现：

- Identifier；
- Manufacturer；
- Description；
- Specification；
- Package；
- Crosswalk；
- Context；
- Data Quality；
- Conflict Engine。

## Phase 10：Rule Ranker 与 Decision

实现：

- Weighted Score；
- Hard Filter；
- Top1/Top2 Margin；
- Resolution Level；
- Auto Approval；
- Review；
- Unresolved。

## Phase 11：Evidence 与审核

实现：

- Candidate Compare；
- Feature Explain；
- Mapping Patch；
- Generic Specification；
- Multiple AVL；
- Crosswalk Proposal；
- Audit。

## Phase 12：Search Index 和批量处理

实现：

- Exact Index；
- OpenSearch Index；
- Crosswalk Index；
- Version；
- Batch Dedup；
- Cache；
- Rebuild。

## Phase 13：Supplier / Manufacturer Validation

实现：

- Supplier SKU；
- Authorized Source；
- Manufacturer Page；
- Snapshot；
- Rate Limit；
- Async Refresh；
- Provenance。

## Phase 14：Learning-to-Rank 和 Calibration

实现：

- Review Dataset；
- Rule Baseline；
- GBDT Ranker；
- Offline Evaluation；
- Calibration；
- Shadow Mode；
- Rollback。

## Phase 15：API、事件、监控和生产发布

实现：

- API；
- Jobs；
- Batch；
- Events；
- Retry/Cancel；
- Metrics；
- Dashboard；
- Security；
- Deployment；
- Disaster Recovery。

---

# 55. Codex 工作纪律

Codex 必须：

1. 不覆盖 Agent 31 原始字段；
2. 不静默修正 OCR MPN；
3. 不把 Loose Search Key 当正式 MPN；
4. 不把 Base Part 当完整 Ordering Variant；
5. 不跨 Manufacturer 解释后缀；
6. 不把 Supplier SKU 当 MPN；
7. 不把 Replacement 当 Exact Match；
8. 不强行匹配无合格候选的行；
9. Generic Passive 可保持 Generic；
10. Crosswalk 必须有 Scope；
11. 客户映射不能污染全局；
12. 过期 Crosswalk 不自动使用；
13. Candidate Retrieval 与 Ranking 分离；
14. Edit Distance 只做召回；
15. Description Vector 不能独立决定；
16. Hard Constraint 不得被高文本相似度覆盖；
17. Top1 高但 Top2 接近时审核；
18. 保存全部召回路径和特征；
19. 保存 Index/Policy/Ranker Version；
20. 人工 Patch 不覆盖机器结果；
21. LLM 不从全库自由选择；
22. LLM 只处理 Top-K 或结构化提取；
23. 不把私有 BOM 发送给外部模型；
24. 不提交真实客户映射到公开测试；
25. 不伪造准确率；
26. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Registry/Index 变化；
    - 测试命令；
    - 真实结果；
    - Benchmark；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 56. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/mpn-resolution-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第32个 Agent：

Manufacturer Part Number Resolution Agent / MPN 精准匹配 Agent。

本 Agent 接收 Agent 31 输出的 Canonical BOM Line，根据：

- Manufacturer；
- 疑似 MPN；
- Description；
- Category；
- Value；
- Tolerance；
- Voltage / Current / Power；
- Package；
- Footprint；
- Customer Part Number；
- Internal Part Number；
- Supplier SKU；
- OCR 候选；
- 历史 Crosswalk；

匹配标准 Manufacturer、Manufacturer Part Number、Component Part、Package Variant 和 Ordering Variant。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31 的规格和实际代码；
3. docs/mpn-resolution-agent-spec.md；
4. 当前元器件主数据、Manufacturer、Part、Ordering Variant、Package 和 Parameter 数据表；
5. 当前约 110 万型号数据；
6. 当前 Internal PN、Customer PN、Supplier SKU 和 Crosswalk；
7. 当前搜索、OpenSearch/Elasticsearch、pg_trgm 和 vector index；
8. 当前 BOM 匹配和采购映射代码；
9. 当前 Evidence、Review、Patch 和权限；
10. 脱敏或合成匹配 Fixture。

硬约束：

- 不覆盖 Agent 31 Raw Input；
- 不静默修改 OCR 型号；
- Raw、Normalized Display、Strict Key、Loose Key 分离；
- Loose Key 不能成为正式 MPN；
- Manufacturer Entity 必须独立解析；
- Brand、Historical Manufacturer 和 Current Owner 分开；
- Base Part 和 Ordering Variant 分开；
- 不跨厂商解释后缀；
- Supplier SKU 和 MPN 分开；
- Crosswalk 必须有 scope、validity 和 approval；
- 客户/租户映射不能污染全局；
- Candidate Retrieval 与 Ranking 分开；
- Edit Distance 只做召回；
- Description/Vector 不能作为唯一证据；
- Package、Pin Count、Category 和关键规格冲突是 Hard Constraint；
- Top1 高但 Top2 接近时进入审核；
- 无合格候选时输出 unresolved，不强行匹配；
- Replacement、Alternate 和 Exact Identity 分开；
- Generic Passive 可输出 Generic Specification；
- 所有 Candidate 保存召回路径、Feature、Conflict 和版本；
- 人工 Patch 不覆盖机器结果；
- LLM 不得从 110 万型号中自由挑选答案；
- LLM 只可用于受控结构化提取或 Top-K 解释；
- 不将客户真实 BOM 和 Crosswalk 放入公开测试；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31 的 Canonical BOM Schema；
3. 查找 Manufacturer、Alias、Brand、Historical Manufacturer；
4. 查找 Part、MPN、Base Part、Ordering Variant；
5. 查找 Package、Parameter、Description 和 Datasheet；
6. 查找 Internal PN、Customer PN、Supplier SKU 和 Crosswalk；
7. 查找当前搜索索引和查询代码；
8. 查找当前 BOM 匹配、去重和采购映射逻辑；
9. 统计 MPN 字段的数据质量、重复、空值和多 Manufacturer 同号；
10. 统计 Manufacturer Alias 和未知 Manufacturer；
11. 抽样分析脱敏/合成 BOM 行；
12. 在 docs/mpn-resolution-implementation-plan.md 中生成实施计划；
13. 在 docs/manufacturer-registry-design.md 中生成 Manufacturer Registry；
14. 在 docs/mpn-identifier-normalization.md 中生成标识符标准化方案；
15. 在 docs/part-crosswalk-design.md 中生成 Crosswalk 模型；
16. 在 docs/mpn-candidate-retrieval-design.md 中生成召回设计；
17. 在 docs/mpn-ranking-confidence-design.md 中生成 Ranking、Margin 和 Calibration；
18. 在 docs/mpn-resolution-migration-plan.md 中生成旧映射迁移方案；
19. 在 docs/mpn-resolution-benchmark-plan.md 中生成 Benchmark；
20. 给出拟新增、拟修改和拟复用文件；
21. 给出 Phase 1 精确范围；
22. 不修改业务代码；
23. 不创建数据库 Migration；
24. 不安装依赖；
25. 运行当前仓库已有 lint、type check、test 和 build；
26. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31 输入契约；
- 当前 Part/MPN 数据模型；
- Manufacturer Registry；
- Identifier Normalization；
- Crosswalk；
- Candidate Retrieval；
- Feature 和 Hard Constraints；
- Ranking 和 Decision；
- Resolution Level；
- Evidence/Review；
- Search Index；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 57. 后续 Phase 提示词模板

```text
继续实现 MPN Resolution Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31 和 Agent 32 规格；
3. 阅读 MPN Implementation Plan；
4. 阅读 Manufacturer Registry、Normalization、Crosswalk、Retrieval 和 Ranking 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Raw 不可变；
- 不静默 OCR 修正；
- Base Part/Ordering Variant 分离；
- Supplier SKU/MPN 分离；
- Crosswalk 有 Scope；
- Retrieval/Ranking 分离；
- Hard Constraint 不被相似度覆盖；
- 不强制匹配；
- Evidence/Version 完整；
- 不覆盖人工 Patch；
- LLM 不自由挑选；
- 不公开客户真实数据；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写测试；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. security test；
10. performance test；
11. benchmark；
12. 更新文档；
13. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Registry/Index/Policy 变化；
- 测试命令和真实结果；
- Candidate Recall；
- Ranking 指标；
- Auto Approval 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 58. MVP 演示流程

1. 输入 Manufacturer + 精确 MPN；
2. 自动精确匹配；
3. 输入只有 MPN、无 Manufacturer；
4. 全库唯一时匹配；
5. 输入 Internal PN；
6. 命中租户 Crosswalk；
7. 输入 Customer PN；
8. 命中客户 Scope；
9. 输入 DigiKey SKU；
10. 反查标准 MPN；
11. 输入 `TPS62I60DSGR`；
12. 生成 I/1 OCR Candidate；
13. Description、Package 和 Manufacturer 一致；
14. 进入人工审核；
15. 用户确认；
16. 创建租户 Crosswalk Proposal；
17. 输入 `LM358`；
18. 只解析 Base Part；
19. 根据 SOIC-8 Package 生成 Ordering Variant Candidates；
20. 输入 `10K 1% 0402` 无 MPN；
21. 输出 Generic Specification；
22. 输入两个 Approved MPN；
23. 输出 AVL 多目标；
24. 输入错误 Package；
25. Hard Conflict 阻止自动匹配；
26. 输入 Replacement 型号；
27. 不将 Replacement 当 Exact Match；
28. 生成 BOM Resolution Coverage；
29. 发布 `bom.mpn-resolution.ready`；
30. 下游开始价格、库存、生命周期和替代分析。

---

# 59. 下游事件

```json
{
  "event_type": "bom.mpn-resolution.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "bom_id": "uuid",
  "result_manifest_uri": "s3://.../resolution-results.json.zst",
  "quality_report_uri": "s3://.../quality-report.json",

  "summary": {
    "lines": 385,
    "exact_resolved": 300,
    "base_part_resolved": 25,
    "generic_specification": 20,
    "review_required": 15,
    "unresolved": 25
  },

  "quality": {
    "exact_resolution_rate": 0.779,
    "overall_confidence": 0.96,
    "review_status": "approved"
  },

  "created_at": "ISO-8601"
}
```

下游消费条件：

```text
line resolution status in:
- exact_part_resolved
- ordering_variant_resolved
- package_variant_resolved
- base_part_resolved
- generic_specification
- multiple_approved_parts

AND no blocking review for that line
```

---

# 60. 生产上线顺序

第一阶段优先：

```text
Manufacturer Registry
精确 MPN
Internal/Customer Crosswalk
Supplier SKU
Base Part / Ordering Variant
Package Hard Constraint
人工审核
```

第二阶段增加：

```text
OCR Variant
Fuzzy Retrieval
Description Hybrid Search
Specification Ranking
```

第三阶段增加：

```text
Learning-to-Rank
Confidence Calibration
Manufacturer 官网验证
授权分销商实时验证
Identifier Graph
```

精确匹配和 Crosswalk 通常可以先覆盖企业 BOM 中的大多数高质量数据，同时提供最高可靠性；模糊匹配和语义匹配应建立在审核闭环和标注数据之上。
