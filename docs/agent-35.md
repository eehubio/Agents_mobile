# 合规与原产地 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：35  
> Agent 名称：Compliance, Origin & Tariff Intelligence Agent  
> 中文名称：合规与原产地 Agent  
> 版本：V1.0  
> 适用基线日期：2026-07-19  
>
> 定位：面向电子元器件、模块、PCBA 和整机，收集并验证 RoHS、REACH、无卤、PFAS、TSCA、冲突矿产、原产国、海关归类、关税和客户指定合规条件，建立按司法辖区、产品范围和时间版本化的合规结论，并评估 BOM、产品、采购和库存影响。
>
> 上游：
> - Agent 31：BOM 接入与标准化
> - Agent 32：MPN 精准匹配
> - Agent 33：替代料推荐
> - Agent 34：生命周期、EOL 与 PCN
> - 元器件、Ordering Variant、Package、Manufacturer、Supplier 和 Material 主数据
> - Datasheet、FMD、CoC、SDS、测试报告、IPC-1752A、CMRT/EMRT、原产地证明
> - ezPLM BOM、产品、客户、采购、库存、制造地点、销售地区和订单
>
> 下游：
> - BOM 合规审查
> - 客户交付与供应商准入
> - 出口、进口、报关和关税成本
> - 替代料合规过滤
> - 采购、库存和供应链风险
> - 产品声明、材料声明和审计包
> - PCN/变更后的重新合规判断
>
> 重要说明：
> - 本 Agent 是证据管理、规则执行和风险辅助系统，不替代律师、报关行、认证机构或主管机关的正式法律判断。
> - 所有规则必须版本化，禁止把法规阈值、豁免、关税税率和国家规则硬编码为永久常量。

---

# 1. 建设目标

系统必须能够：

1. 接入制造商和供应商的合规声明、材料声明、SDS、测试报告和证书；
2. 识别文件适用的 Manufacturer、MPN、Base Part、Package Variant 和 Ordering Variant；
3. 将不同供应商的“Compliant / Green / Lead Free / Halogen Free”术语标准化；
4. 对 RoHS 限制物质、阈值、Homogeneous Material 和 Exemption 进行判断；
5. 对 REACH Candidate List、SVHC 含量和 Article/Product Scope 建立版本化判断；
6. 跟踪 PFAS 在不同国家、州、省和客户规则下的范围；
7. 跟踪 TSCA Inventory、特定规则、Reporting、Restriction 和 Importer Responsibility；
8. 处理无卤、低卤和客户自定义卤素限值；
9. 处理冲突矿产、3TG、Smelter/Refiner、CMRT、EMRT 和客户扩展矿物；
10. 保存制造、晶圆、封装、测试、最终组装和发货国家；
11. 区分“制造地点”“供应商声明原产国”“海关原产国”“优惠原产资格”；
12. 为美国及其他市场保存 HS/HTS、关税版本、附加税和优惠税率；
13. 将法规、产品、原产地、贸易路线、日期和客户条件结合后再判定；
14. 支持 Customer Compliance Profile；
15. 对 BOM、PCBA 和整机做合规 Roll-up；
16. 对证据缺失、过期、冲突和适用范围不明进入审核；
17. 在 PCN、供应商、封装、制造地点和法规更新后增量重算；
18. 输出合规结论、差距、风险、整改动作和审计包；
19. 支持百万级器件、多租户和多市场；
20. 保留全部原始证据和机器判断过程。

---

# 2. 与 Agent 31–34 的边界

## Agent 31

负责把 BOM 和原始客户字段标准化，例如：

```text
RoHS
Reach
Country
HS Code
Customer Compliance Note
```

但不做最终法规判断。

## Agent 32

负责把声明或证书中的料号映射到标准 Part/Ordering Variant。

## Agent 33

使用 Agent 35 的合规结论过滤替代料：

```text
技术兼容但客户合规不满足
→ 不能作为该项目的替代
```

## Agent 34

在 PCN、制造地点、材料、封装、厂商和料号发生变化时触发 Agent 35 重评。

## Agent 35

负责：

```text
合规事实
+ 法规规则
+ 原产地事实
+ 贸易路线
+ 客户条件
→ 合规与贸易决策
```

---

# 3. 核心原则

## 3.1 合规不是单一布尔字段

错误：

```text
part.rohs = true
part.reach = true
```

正确：

```text
Evidence
→ Observation
→ Claim
→ Rule Evaluation
→ Compliance Assessment
→ Enterprise/Customer Decision
```

同一 Part 可能：

- 某个 Ordering Variant RoHS 合规；
- 旧 Date Code 使用某项豁免；
- 新 Package 无卤，旧 Package 未声明；
- REACH 结论基于 2025 Candidate List；
- 某客户要求更严格；
- 美国合规但欧盟市场不满足；
- 证书已经过期或适用范围不明。

## 3.2 司法辖区、市场和日期是必填上下文

判定必须包含：

```text
destination_market
jurisdiction
product_scope
evaluation_date
placing_on_market_date
import_date
customer_profile
```

没有这些上下文，只能输出：

```text
evidence_summary
not_final_assessment
```

## 3.3 法规事实和客户规则分开

```text
regulatory_requirement
customer_requirement
enterprise_policy
```

客户可以要求：

- 禁止任何 RoHS Exemption；
- SVHC 低于法定信息披露阈值；
- 禁止所有含氟材料；
- 仅接受指定原产国；
- 禁止特定冶炼厂；
- 要求 IEC/IPC 格式声明；
- 要求证书不超过一年。

客户规则不能改写法规事实。

## 3.4 声明不等于验证

证据等级：

```text
self_declared
supplier_declared
manufacturer_declared
full_material_declaration
third_party_tested
certification_body_verified
authority_record
customs_ruling
enterprise_validated
```

`Compliant` 必须附证据等级和适用范围。

## 3.5 Part、Variant、材料和产品层级分开

```text
Substance
→ Material
→ Homogeneous Material
→ Component Part
→ Package Variant
→ Ordering Variant
→ BOM Line
→ Assembly
→ Product
```

一个器件中的不同材料可能有不同阈值和证据。

## 3.6 Unknown 不是 Compliant

证据缺失、过期或不适用：

```text
status = unknown
```

不能因供应商网页有绿色图标就判定合规。

## 3.7 原产地不是一个 Country 字段

必须区分：

```text
wafer_fab_country
die_country
assembly_country
test_country
package_country
final_manufacturing_country
supplier_declared_country
customs_country_of_origin
preferential_origin_country
ship_from_country
seller_country
```

## 3.8 关税归类、原产地和税率分开

```text
classification
+ origin
+ destination
+ valuation
+ trade_program
+ import_date
→ tariff treatment
```

HS/HTS Code 本身不能唯一决定实际税率。

---

# 4. 合规统一状态

```text
compliant
non_compliant
conditionally_compliant
compliant_with_exemption
declaration_only
pending_verification
unknown
out_of_scope
not_applicable
expired
conflicting
blocked_by_customer
```

## `compliant`

证据和规则均满足。

## `compliant_with_exemption`

满足法规，但依赖有效豁免。

## `conditionally_compliant`

仅在特定市场、日期、数量、用途或客户批准下满足。

## `declaration_only`

只有供应商/制造商声明，尚无更强证据。

## `unknown`

数据不足。

## `blocked_by_customer`

法律可能允许，但客户规则禁止。

---

# 5. 证据与事实分层

```text
Source Asset
→ Parsed Evidence
→ Compliance Observation
→ Compliance Claim
→ Rule Evaluation
→ Assessment
→ Decision
```

## 5.1 Source Asset

- PDF；
- XLSX/CSV；
- HTML Snapshot；
- Email；
- API Response；
- XML；
- IPC-1752A；
- IEC 62474 Exchange；
- CMRT/EMRT；
- Test Report；
- Certificate；
- Customs Ruling。

## 5.2 Observation

忠实保存文档原文，例如：

```text
RoHS Compliant
RoHS Exemption 7(c)-I
REACH SVHC < 0.1%
Country of Origin: Malaysia
```

## 5.3 Claim

机器将 Observation 结构化，但不直接认定法律结论。

## 5.4 Assessment

将 Claim 与版本化规则、市场、日期和客户条件结合。

---

# 6. 标准请求结构

```json
{
  "assessment_request_id": "uuid",

  "subject": {
    "subject_type": "bom",
    "subject_id": "uuid",
    "revision": "RevC"
  },

  "market_context": {
    "destination_country": "US",
    "destination_region": "WA",
    "placing_on_market_date": "2026-10-01",
    "import_date": "2026-09-20",
    "customer_profile_id": "uuid"
  },

  "trade_context": {
    "importer_of_record_id": "uuid",
    "export_country": "CN",
    "ship_from_country": "CN",
    "customs_value": "1200.00",
    "currency": "USD",
    "incoterm": "DAP"
  },

  "requested_domains": [
    "rohs",
    "reach",
    "halogen_free",
    "pfas",
    "tsca",
    "conflict_minerals",
    "country_of_origin",
    "tariff",
    "customer_requirements"
  ],

  "versions": {
    "rule_bundle": "compliance-us-eu-2026-07-19",
    "substance_registry": "substances-2026-07",
    "tariff_schedule": "us-hts-2026-r11",
    "customer_profile": "customer-profile-v3"
  }
}
```

---

# 7. 标准结果结构

```json
{
  "assessment_result_id": "uuid",
  "subject_type": "bom",
  "subject_id": "uuid",

  "overall": {
    "status": "conditionally_compliant",
    "risk": "high",
    "blocking_domains": [
      "pfas_customer_rule",
      "country_of_origin_unknown"
    ],
    "review_required": true
  },

  "domains": {
    "rohs": {
      "status": "compliant_with_exemption",
      "applicable_rule_id": "eu-rohs-2011-65-eu-v2026",
      "exemptions": [
        {
          "code": "example",
          "validity_status": "valid_on_evaluation_date"
        }
      ],
      "evidence_ids": []
    },

    "reach": {
      "status": "pending_verification",
      "candidate_list_version": "2026-02-04",
      "svhc_findings": [],
      "evidence_ids": []
    },

    "country_of_origin": {
      "status": "unknown",
      "supplier_declared": "MY",
      "customs_origin": null,
      "reason_codes": [
        "manufacturing_process_incomplete"
      ]
    }
  },

  "actions": [],
  "evidence_bundle_id": "uuid",
  "rule_trace_uri": "s3://...",
  "quality": {}
}
```

---

# 8. 核心领域对象

```text
Regulation
RuleBundle
RuleVersion
Jurisdiction
MarketContext
Substance
SubstanceGroup
Material
HomogeneousMaterial
ComplianceEvidence
ComplianceObservation
ComplianceClaim
Exemption
Assessment
CustomerRequirement
OriginFact
ManufacturingStep
OriginDetermination
TariffClassification
TariffMeasure
ConflictMineralDeclaration
SmelterRefiner
ReviewDecision
```

---

# 9. 法规与规则 Registry

每条规则保存：

```text
rule_id
domain
jurisdiction
authority
legal_instrument
version
published_at
effective_from
effective_to
product_scope
substance_scope
threshold
unit
calculation_basis
exemptions
reporting_obligations
evidence_requirements
source_snapshot
status
```

所有规则使用不可变版本。

新规则生效：

```text
create new RuleVersion
→ identify affected Assessments
→ incremental re-evaluation
```

不得直接覆盖旧规则。

---

# 10. 法规来源优先级

```text
1. 法律、法规、主管机关正式数据库
2. 主管机关指南和官方 FAQ
3. 海关税则、裁定和官方通知
4. 官方标准或标准组织数据
5. 制造商正式声明和 FMD
6. 授权供应商正式声明
7. 第三方测试和认证
8. 聚合数据库
9. 非授权市场描述
```

聚合数据库可用于召回，不能成为唯一合规依据。

---

# 11. RoHS 模型

## 11.1 评估对象

RoHS 评估不能只对整颗器件总重量做平均。

需要：

```text
component
homogeneous_material
substance
concentration
threshold
exemption
product_scope
market_date
```

## 11.2 受限物质 Registry

保存：

```text
substance_id
CAS/EC identifiers
rule version
maximum concentration
calculation basis
applicable product scope
```

具体阈值从 RuleBundle 读取，不硬编码在 Comparator。

## 11.3 Homogeneous Material

示例：

- 引脚镀层；
- 塑封材料；
- 焊球；
- 芯片粘接材料；
- 基板；
- 油墨；
- 电缆绝缘层。

## 11.4 Exemption

```json
{
  "exemption_id": "uuid",
  "jurisdiction": "EU",
  "code": "raw-code",
  "scope": "text",
  "valid_from": "date",
  "valid_to": "date",
  "renewal_status": "under_review",
  "product_categories": [],
  "evidence_ids": []
}
```

豁免必须结合：

```text
evaluation date
product category
application
material
renewal status
transition period
```

## 11.5 RoHS 判断流程

```text
Determine Product Scope
→ Load Homogeneous Materials
→ Evaluate Restricted Substances
→ Apply Valid Exemptions
→ Check Evidence Completeness
→ Apply Customer No-exemption Rule
→ Result
```

## 11.6 Lead-free 与 RoHS 分开

`Lead Free` 不等于完整 RoHS 合规。

---

# 12. REACH / SVHC 模型

## 12.1 Candidate List 版本

保存：

```text
candidate_list_version
publication_date
substance entries
CAS/EC
group scope
reason for inclusion
```

评估必须绑定 Candidate List 版本。

## 12.2 Article 和产品层级

支持：

```text
component article
complex object
sub-article
assembly
product
```

Roll-up 不能简单按整机总重量平均后掩盖子部件中的 SVHC。

## 12.3 Claim

```json
{
  "substance_id": "uuid",
  "concentration": "0.12",
  "unit": "percent_w_w",
  "calculation_basis": "article",
  "source_scope": "package_variant",
  "evidence_ids": []
}
```

## 12.4 输出

```text
no_svhc_declared
svhc_below_threshold
svhc_above_threshold
substance_unknown
article_scope_unknown
declaration_outdated
```

## 12.5 Communication / Reporting

将义务建模为：

```text
information_required
customer_declaration_required
authority_submission_candidate
supply_chain_communication_required
```

系统不应直接替用户提交监管申报，除非未来另建受控 Submission 模块。

---

# 13. 无卤与低卤

“Halogen Free”不是全球统一、永久的一个定义。

建立 Profile：

```text
standard_id
standard_version
chlorine_threshold
bromine_threshold
total_halogen_threshold
material_basis
product_scope
evidence_required
```

支持：

```text
industry_standard_profile
manufacturer_definition
customer_definition
enterprise_definition
```

输出：

```text
halogen_free
low_halogen
not_halogen_free
definition_mismatch
unknown
```

同一 Part 可能满足制造商定义，但不满足客户定义。

---

# 14. PFAS

## 14.1 PFAS 不是一个固定物质清单

Registry 支持：

```text
jurisdiction-specific definition
substance list
structural definition
use category
intentional use
concentration threshold
reporting obligation
restriction status
effective date
exemption/derogation
```

## 14.2 评估维度

```text
contains_listed_pfas
contains_structurally_defined_pfas
intentionally_added
process_aid
impurity
unknown
```

## 14.3 证据

- Full Material Declaration；
- Supplier PFAS Declaration；
- SDS；
- Process Material；
- Plating/Lubricant/Sealant 数据；
- Packaging Materials；
- Test Method；
- Customer Questionnaire。

## 14.4 状态

```text
pfas_free_declared
no_intentionally_added_pfas_declared
contains_pfas
definition_scope_unknown
evidence_insufficient
jurisdiction_pending_rule
customer_blocked
```

“PFAS Free”和“无有意添加 PFAS”必须分开。

## 14.5 动态规则

PFAS RuleBundle 必须支持：

```text
proposed
adopted_not_effective
effective
amended
withdrawn
```

拟议规则不能直接当成当前禁令，但可生成未来风险。

---

# 15. TSCA

TSCA Domain 不能压缩为“TSCA Compliant”。

拆分：

```text
inventory_status
significant_new_use_rule
risk_management_rule
section_8_reporting
pfas_reporting
import_certification
recordkeeping
customer_requirement
```

## 15.1 化学品与制品

保存：

```text
chemical substance
mixture
article
component
importer
manufacturer
use
volume
reporting period
exemption
```

## 15.2 输出

```text
inventory_listed
inventory_exempt
reporting_may_apply
restriction_applies
importer_review_required
article_exclusion_candidate
unknown
```

## 15.3 责任主体

TSCA 判断必须绑定：

```text
manufacturer
importer
processor
article importer
reporting entity
```

同一个产品对供应商和美国进口商可能有不同义务。

---

# 16. 冲突矿产和负责任矿产

## 16.1 基础范围

支持：

```text
3TG
cobalt
mica
other_customer_defined_minerals
```

具体范围按法规和客户 Profile 版本化。

## 16.2 数据层

```text
product declaration
supplier declaration
smelter/refiner list
smelter status
country of origin inquiry
due diligence status
reporting period
template version
```

## 16.3 模板

支持：

```text
CMRT
EMRT
custom questionnaire
supplier letter
Form SD support package
```

## 16.4 状态

```text
not_in_scope
no_3tg
3tg_present
origin_known
origin_unknown
covered_country_risk
smelter_conformant
smelter_nonconformant
smelter_unknown
due_diligence_incomplete
customer_blocked
```

## 16.5 Roll-up

不能只看 Tier-1 Supplier 的“Conflict Free”结论。

应保留：

```text
supplier response rate
smelter coverage
unknown smelters
nonconformant smelters
country risk
reporting period
```

---

# 17. 原产地数据模型

## 17.1 Origin Fact

```json
{
  "fact_id": "uuid",
  "entity_type": "ordering_variant",
  "entity_id": "uuid",
  "origin_type": "assembly_country",
  "country_code": "MY",
  "site_id": "uuid",
  "valid_from": "date",
  "valid_to": null,
  "source_type": "manufacturer_declaration",
  "evidence_ids": [],
  "confidence": 0.95
}
```

## 17.2 Origin Types

```text
design_country
wafer_fab_country
die_manufacturing_country
substrate_country
package_assembly_country
final_test_country
final_manufacturing_country
supplier_declared_origin
customs_origin
preferential_origin
ship_from_country
seller_country
```

## 17.3 制造路线

```text
wafer fab
→ wafer probe
→ die singulation
→ package assembly
→ final test
→ programming
→ module assembly
→ PCBA assembly
→ final product assembly
```

每个 Step 保存国家、工厂、时间和变更记录。

## 17.4 海关原产地

输出：

```text
declared
rule_based_candidate
binding_ruling_supported
legal_review_required
unknown
```

系统只能依据配置的 Origin Rule、事实和证据给出候选结论。

对于复杂跨国制造、软件加载和多步骤组装：

```text
customs_review_required = true
```

## 17.5 优惠原产

优惠贸易协定资格与普通标记原产地分开：

```text
non_preferential_origin
preferential_origin
certificate_of_origin
rule_of_origin
regional_value_content
tariff_shift
```

---

# 18. 海关归类与关税

## 18.1 Tariff Classification

```text
hs_code_6
national_tariff_code
classification_description
classification_version
ruling/reference
confidence
review_status
```

## 18.2 Classification Scope

元器件、PCBA、模块和整机的税号可能不同。

不能把 BOM 中芯片的税号 Roll-up 成整机税号。

## 18.3 Tariff Context

```text
destination_country
origin_country
export_country
import_date
customs_value
currency
trade_program
end_use
quota
additional_duty_program
exclusion
sanction
```

## 18.4 Tariff Measure

```text
base_duty
preferential_duty
additional_duty
antidumping
countervailing
safeguard
quota
fee
tax_not_included
```

## 18.5 版本化

保存：

```text
tariff_schedule_version
effective_from
effective_to
measure_source
calculation_trace
```

税率不得缓存为无日期的 Part 属性。

## 18.6 输出

```text
classification_confirmed
classification_candidate
origin_required
rate_calculated
preference_candidate
additional_duty_applies
exclusion_candidate
broker_review_required
```

---

# 19. 客户指定合规 Profile

```json
{
  "profile_id": "uuid",
  "customer_id": "uuid",
  "version": "3.0",

  "market": {
    "countries": ["US", "DE"]
  },

  "requirements": [
    {
      "domain": "rohs",
      "rule": "no_exemption_allowed",
      "severity": "blocking"
    },
    {
      "domain": "pfas",
      "rule": "no_intentionally_added_pfas",
      "severity": "blocking"
    },
    {
      "domain": "country_of_origin",
      "rule": "country_not_in",
      "values": ["XX"],
      "severity": "blocking"
    }
  ],

  "evidence_policy": {
    "maximum_age_days": 365,
    "manufacturer_declaration_required": true,
    "supplier_declaration_only_accepted": false
  }
}
```

支持：

```text
required
prohibited
maximum
minimum
must_have_evidence
must_be_recent
approved_exception
waiver
```

---

# 20. 客户规则 DSL

使用受控 DSL，不允许任意代码：

```yaml
rule_id: customer-no-rohs-exemption
domain: rohs
subject_scope: component
condition:
  field: assessment.exemptions
  operator: is_empty
decision:
  pass: compliant
  fail: blocked_by_customer
severity: blocking
```

复杂逻辑只能调用预注册函数：

```text
all_lines_compliant
no_svhc_above
origin_in
origin_not_in
evidence_age_less_than
smelter_status_in
tariff_rate_less_than
```

---

# 21. BOM 与产品 Roll-up

## 21.1 结果不是简单 AND

不同 Domain 使用不同 Roll-up：

### RoHS

所有适用部件必须满足，或有有效豁免。

### REACH

需要保留每个 Article/Sub-article 的 SVHC 信息。

### Conflict Minerals

按供应商、Smelter 覆盖和 Reporting Period 汇总。

### COO

整机原产地不能由“最大金额器件的国家”推断。

### Tariff

按进口商品实体判断，不能按 BOM Line 简单累计。

## 21.2 Unknown 传播

Blocking Domain 中任一关键 Line 为 Unknown：

```text
product_status = pending_verification
```

不能当作合规。

## 21.3 DNP 和 Variant

仅 Roll-up 当前：

```text
BOM Revision
Variant
Build Configuration
```

中的已装配物料。

## 21.4 Packaging

客户和 PFAS/REACH 条件可能包含包装材料，需单独纳入 Scope。

---

# 22. 证据类型

支持：

```text
manufacturer_certificate
supplier_certificate
declaration_of_conformity
full_material_declaration
partial_material_declaration
ipc_1752a
iec_62474_exchange
sds
third_party_test_report
laboratory_report
rohs_exemption_statement
reach_svhc_declaration
pfas_declaration
tsca_statement
cmrt
emrt
smelter_list
country_of_origin_certificate
manufacturer_origin_letter
customs_ruling
tariff_classification_ruling
commercial_invoice
packing_list
bill_of_materials
process_route
site_certificate
customer_waiver
```

---

# 23. 证据元数据

```text
document_id
document_type
issuer
issuer_role
issue_date
valid_from
valid_to
reporting_period
scope
part_identifiers
sites
jurisdictions
standards
language
signature
signature_validation
document_hash
parser_version
field_evidence
```

## 23.1 适用范围

一个声明可能适用：

```text
all products
product family
base part
specific package
specific ordering code
specific date code
specific site
```

不得默认扩大范围。

## 23.2 证据过期

按法规、客户和证据类型定义 TTL。

过期后：

```text
status = expired/pending_verification
```

---

# 24. 证据质量评分

```text
source_authority
issuer_identity
document_signature
scope_precision
date_validity
substance_coverage
material_coverage
part_mapping_confidence
test_method_quality
chain_of_custody
```

总体分数不能替代硬性证据要求。

---

# 25. 证据冲突

示例：

```text
Manufacturer FMD: contains Pb under exemption
Distributor page: RoHS compliant
Customer requires no exemption
```

输出：

```text
regulatory = compliant_with_exemption
customer = blocked_by_customer
```

冲突类型：

```text
status_conflict
scope_conflict
date_conflict
substance_value_conflict
origin_conflict
issuer_conflict
part_mapping_conflict
tariff_classification_conflict
```

---

# 26. 规则执行过程

```text
Load Subject
→ Resolve Part/Variant
→ Load Evidence
→ Resolve Evidence Scope
→ Load Jurisdiction RuleBundle
→ Load Customer Profile
→ Evaluate Domain Rules
→ Roll-up BOM/Product
→ Evaluate Origin
→ Evaluate Tariff
→ Generate Gaps/Risks/Actions
→ Review or Publish
```

---

# 27. 合规差距与动作

Action 示例：

```text
request_manufacturer_declaration
request_fmd
request_updated_reach_statement
request_pfas_declaration
request_cmrt
request_emrt
request_country_of_origin
request_manufacturing_route
request_customs_ruling
request_hts_review
replace_component
block_purchase
block_customer_shipment
create_supplier_corrective_action
create_customer_waiver
recalculate_tariff
reassess_after_pcn
```

每项 Action 保存：

```text
owner
due_date
blocking
scope
reason
evidence_required
status
```

---

# 28. 人工审核台

布局：

```text
左侧：原始声明、FMD、证书、报告和网页
中间：结构化物质、原产地、税号和规则
右侧：BOM/产品/客户影响和缺口
底部：证据链、规则 Trace、Patch 和审计
```

视图：

```text
Overview
RoHS
REACH/SVHC
Halogen
PFAS
TSCA
Conflict Minerals
Origin
Tariff
Customer Requirements
Evidence
Rule Trace
Actions
```

操作：

- 修正文档类型；
- 确认适用 MPN/Variant；
- 修正物质和单位；
- 选择 Exemption；
- 确认 Article Scope；
- 确认 PFAS Definition；
- 审核 Smelter；
- 修正制造路线；
- 选择 COO 候选；
- 审核 HTS；
- 添加客户豁免；
- 请求新证据；
- 批准/拒绝结论。

---

# 29. Review Patch

```json
{
  "patch_id": "uuid",
  "target_type": "compliance_assessment",
  "target_id": "uuid",
  "base_version": "machine-v1",

  "operations": [
    {
      "op": "replace",
      "path": "/domains/country_of_origin/customs_origin",
      "old_value": null,
      "value": "MY"
    }
  ],

  "reason_code": "customs_ruling_reviewed",
  "reviewer_id": "uuid",
  "evidence_ids": ["uuid"]
}
```

机器原始 Claim 和 Rule Trace 不可覆盖。

---

# 30. 状态机

```text
RECEIVED
→ LOADING_SUBJECT
→ LOADING_MARKET_CONTEXT
→ COLLECTING_EVIDENCE
→ PARSING_EVIDENCE
→ RESOLVING_PART_SCOPE
→ RESOLVING_MATERIAL_SCOPE
→ LOADING_RULE_BUNDLES
→ EVALUATING_ROHS
→ EVALUATING_REACH
→ EVALUATING_HALOGEN
→ EVALUATING_PFAS
→ EVALUATING_TSCA
→ EVALUATING_CONFLICT_MINERALS
→ RESOLVING_ORIGIN_FACTS
→ DETERMINING_ORIGIN_CANDIDATE
→ RESOLVING_TARIFF_CLASSIFICATION
→ CALCULATING_TARIFF_TREATMENT
→ APPLYING_CUSTOMER_RULES
→ ROLLING_UP_PRODUCT
→ GENERATING_GAPS
→ GENERATING_ACTIONS
→ CREATING_REVIEWS
→ STORING_RESULTS
→ COMPLETED
```

分支：

```text
REVIEW_REQUIRED
EVIDENCE_INCOMPLETE
RULE_BUNDLE_MISSING
ORIGIN_UNDETERMINED
TARIFF_CLASSIFICATION_UNDETERMINED
CUSTOMER_WAIVER_REQUIRED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 31. 错误码

```text
SUBJECT_NOT_FOUND
PART_UNRESOLVED
ORDERING_VARIANT_UNRESOLVED
MARKET_CONTEXT_REQUIRED
EVALUATION_DATE_REQUIRED
EVIDENCE_NOT_FOUND
EVIDENCE_EXPIRED
EVIDENCE_SCOPE_AMBIGUOUS
EVIDENCE_SIGNATURE_INVALID
SUBSTANCE_UNRESOLVED
MATERIAL_SCOPE_UNKNOWN
HOMOGENEOUS_MATERIAL_UNKNOWN
ROHS_RULE_MISSING
ROHS_EXEMPTION_AMBIGUOUS
REACH_LIST_VERSION_MISSING
SVHC_ARTICLE_SCOPE_UNKNOWN
HALOGEN_DEFINITION_MISSING
PFAS_DEFINITION_MISSING
TSCA_RESPONSIBLE_ENTITY_UNKNOWN
CONFLICT_MINERAL_SCOPE_UNKNOWN
SMELTER_DATA_INCOMPLETE
ORIGIN_FACTS_INCOMPLETE
ORIGIN_RULE_MISSING
CUSTOMS_ORIGIN_UNDETERMINED
HTS_CODE_UNDETERMINED
TARIFF_SCHEDULE_VERSION_MISSING
TARIFF_MEASURE_CONFLICT
CUSTOMER_PROFILE_MISSING
CUSTOMER_REQUIREMENT_FAILED
ROLLUP_INCOMPLETE
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```


---

# 32. 数据库设计

## 32.1 `compliance_rule_versions`

```text
id UUID PK
rule_id VARCHAR NOT NULL
domain VARCHAR NOT NULL
jurisdiction VARCHAR NOT NULL
authority VARCHAR NOT NULL
legal_instrument VARCHAR NULL
version VARCHAR NOT NULL
status VARCHAR NOT NULL
published_at TIMESTAMPTZ NULL
effective_from TIMESTAMPTZ NOT NULL
effective_to TIMESTAMPTZ NULL
product_scope JSONB NOT NULL
rule_definition_uri TEXT NOT NULL
source_document_id UUID NULL
created_at TIMESTAMPTZ
UNIQUE(rule_id, version)
```

## 32.2 `compliance_evidence_documents`

```text
id UUID PK
asset_id UUID NOT NULL
document_type VARCHAR NOT NULL
issuer_type VARCHAR NOT NULL
issuer_id UUID NULL
issue_date DATE NULL
valid_from DATE NULL
valid_to DATE NULL
reporting_period_from DATE NULL
reporting_period_to DATE NULL
document_sha256 CHAR(64) NOT NULL
signature_status VARCHAR NOT NULL
scope_summary JSONB NOT NULL
parser_version VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(document_sha256)
```

## 32.3 `compliance_evidence_scopes`

```text
id UUID PK
evidence_document_id UUID NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NULL
raw_identifier TEXT NULL
manufacturer_id UUID NULL
base_part_id UUID NULL
package_variant_id UUID NULL
ordering_variant_id UUID NULL
site_id UUID NULL
date_code_range JSONB NULL
scope_type VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
confidence NUMERIC(5,4)
evidence JSONB NOT NULL
```

## 32.4 `compliance_observations`

```text
id UUID PK
evidence_document_id UUID NOT NULL
domain VARCHAR NOT NULL
observation_type VARCHAR NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NULL
raw_value JSONB NOT NULL
normalized_value JSONB NOT NULL
jurisdiction VARCHAR NULL
applicability JSONB NOT NULL
confidence NUMERIC(5,4)
field_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 32.5 `material_compositions`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
material_id UUID NOT NULL
parent_material_id UUID NULL
material_type VARCHAR NOT NULL
homogeneous_material BOOLEAN NOT NULL
mass_value NUMERIC NULL
mass_unit VARCHAR NULL
composition_uri TEXT NOT NULL
source_evidence_id UUID NOT NULL
valid_from DATE NULL
valid_to DATE NULL
confidence NUMERIC(5,4)
created_at TIMESTAMPTZ
```

## 32.6 `substance_composition_index`

```text
id UUID PK
material_composition_id UUID NOT NULL
substance_id UUID NOT NULL
cas_number VARCHAR NULL
ec_number VARCHAR NULL
concentration_value NUMERIC NULL
concentration_unit VARCHAR NULL
bound_type VARCHAR NULL
intentionally_added BOOLEAN NULL
function VARCHAR NULL
confidence NUMERIC(5,4)
```

## 32.7 `compliance_assessment_jobs`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
revision VARCHAR NULL
market_context JSONB NOT NULL
trade_context JSONB NOT NULL
requested_domains JSONB NOT NULL
versions JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 32.8 `compliance_assessment_results`

```text
id UUID PK
job_id UUID NOT NULL
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
overall_status VARCHAR NOT NULL
overall_risk VARCHAR NOT NULL
review_required BOOLEAN NOT NULL
blocking_domains JSONB NOT NULL
domain_results_uri TEXT NOT NULL
rule_trace_uri TEXT NOT NULL
evidence_bundle_id UUID NULL
quality_report_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 32.9 `compliance_domain_results`

```text
id UUID PK
assessment_result_id UUID NOT NULL
domain VARCHAR NOT NULL
status VARCHAR NOT NULL
risk VARCHAR NOT NULL
rule_version_ids JSONB NOT NULL
evidence_document_ids JSONB NOT NULL
reason_codes JSONB NOT NULL
actions JSONB NOT NULL
confidence NUMERIC(5,4)
UNIQUE(assessment_result_id, domain)
```

## 32.10 `origin_facts`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
origin_type VARCHAR NOT NULL
country_code CHAR(2) NOT NULL
site_id UUID NULL
manufacturing_step_id UUID NULL
valid_from DATE NULL
valid_to DATE NULL
source_type VARCHAR NOT NULL
source_evidence_id UUID NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 32.11 `origin_determinations`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
destination_country CHAR(2) NOT NULL
determination_type VARCHAR NOT NULL
country_code CHAR(2) NULL
rule_bundle_version VARCHAR NOT NULL
manufacturing_route_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
confidence NUMERIC(5,4)
legal_review_required BOOLEAN NOT NULL
rule_trace_uri TEXT NOT NULL
evidence_bundle_id UUID NULL
created_at TIMESTAMPTZ
```

## 32.12 `tariff_classifications`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
destination_country CHAR(2) NOT NULL
hs_code_6 VARCHAR NULL
national_tariff_code VARCHAR NULL
classification_version VARCHAR NOT NULL
description TEXT NULL
source_type VARCHAR NOT NULL
ruling_reference VARCHAR NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
valid_from DATE NULL
valid_to DATE NULL
created_at TIMESTAMPTZ
```

## 32.13 `tariff_assessments`

```text
id UUID PK
subject_type VARCHAR NOT NULL
subject_id UUID NOT NULL
destination_country CHAR(2) NOT NULL
origin_country CHAR(2) NULL
import_date DATE NOT NULL
tariff_schedule_version VARCHAR NOT NULL
customs_value NUMERIC NOT NULL
currency VARCHAR NOT NULL
base_duty_rate NUMERIC NULL
preferential_rate NUMERIC NULL
additional_duty_rate NUMERIC NULL
estimated_duty NUMERIC NULL
measure_details JSONB NOT NULL
status VARCHAR NOT NULL
review_required BOOLEAN NOT NULL
calculation_trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 32.14 `customer_compliance_profiles`

```text
id UUID PK
customer_id UUID NOT NULL
name VARCHAR NOT NULL
version VARCHAR NOT NULL
status VARCHAR NOT NULL
market_scope JSONB NOT NULL
requirements_uri TEXT NOT NULL
evidence_policy JSONB NOT NULL
valid_from DATE NOT NULL
valid_to DATE NULL
approved_by UUID NULL
created_at TIMESTAMPTZ
UNIQUE(customer_id, version)
```

## 32.15 `conflict_mineral_declarations`

```text
id UUID PK
supplier_id UUID NOT NULL
reporting_entity_id UUID NULL
template_type VARCHAR NOT NULL
template_version VARCHAR NOT NULL
reporting_period_from DATE NULL
reporting_period_to DATE NULL
declaration_scope VARCHAR NOT NULL
response_status VARCHAR NOT NULL
smelter_list_uri TEXT NULL
evidence_document_id UUID NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 32.16 `smelter_refiner_index`

```text
id UUID PK
smelter_identifier VARCHAR NOT NULL
name VARCHAR NOT NULL
mineral VARCHAR NOT NULL
country_code CHAR(2) NULL
conformance_status VARCHAR NOT NULL
status_source VARCHAR NOT NULL
status_version VARCHAR NOT NULL
valid_from DATE NULL
valid_to DATE NULL
created_at TIMESTAMPTZ
```

## 32.17 `compliance_reviews`

```text
id UUID PK
job_id UUID NULL
assessment_result_id UUID NULL
object_type VARCHAR NOT NULL
object_id UUID NULL
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

## 32.18 `compliance_waivers`

```text
id UUID PK
scope_type VARCHAR NOT NULL
scope_id UUID NOT NULL
domain VARCHAR NOT NULL
requirement_id VARCHAR NOT NULL
waiver_type VARCHAR NOT NULL
reason TEXT NOT NULL
conditions JSONB NOT NULL
valid_from DATE NOT NULL
valid_to DATE NOT NULL
approved_by UUID NOT NULL
evidence_document_id UUID NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

---

# 33. 对象存储结构

```text
derived/compliance-origin/
  evidence/
    {document_sha256}/
      source/
      parsed/
        document.json
        scopes.json
        claims.json.zst
      evidence/
        evidence-manifest.json
        crops/
      debug/
        parser-log.json

  assessments/
    {subject_type}/{subject_id}/
      {market_context_hash}/
        {rule_bundle_hash}/
          input/
            subject-snapshot.json
            market-context.json
            customer-profile.json
          domains/
            rohs.json
            reach.json
            halogen.json
            pfas.json
            tsca.json
            conflict-minerals.json
            origin.json
            tariff.json
          rollup/
            bom-line-results.json.zst
            product-rollup.json
          traces/
            rule-trace.json.zst
            origin-trace.json
            tariff-trace.json
          reports/
            gap-report.json
            action-plan.json
            quality-report.json
            audit-package.zip
          reviews/
            review-items.json
          debug/
            applicability-log.json
            evidence-selection-log.json
```

---

# 34. API 设计

## 34.1 证据接入

```text
POST /api/v1/compliance/evidence/uploads
POST /api/v1/compliance/evidence
POST /api/v1/compliance/evidence/batches
POST /api/v1/compliance/evidence/{id}/reparse
GET  /api/v1/compliance/evidence/{id}
GET  /api/v1/compliance/evidence/{id}/claims
GET  /api/v1/compliance/evidence/{id}/scope
```

## 34.2 合规评估

```text
POST /api/v1/compliance/assessments
POST /api/v1/compliance/assessments/batches
GET  /api/v1/compliance/assessments/{id}
GET  /api/v1/compliance/assessments/{id}/domains
GET  /api/v1/compliance/assessments/{id}/rule-trace
GET  /api/v1/compliance/assessments/{id}/gaps
GET  /api/v1/compliance/assessments/{id}/actions
POST /api/v1/compliance/assessments/{id}/rerun
POST /api/v1/compliance/assessments/{id}/cancel
```

## 34.3 原产地与关税

```text
POST /api/v1/compliance/origin/determine
GET  /api/v1/compliance/origin/{subject_type}/{subject_id}
POST /api/v1/compliance/tariff/classify
POST /api/v1/compliance/tariff/calculate
GET  /api/v1/compliance/tariff/{assessment_id}
```

## 34.4 规则、Profile 和审核

```text
GET  /api/v1/compliance/rules
GET  /api/v1/compliance/rules/{id}/versions
POST /api/v1/compliance/rules/validate
POST /api/v1/compliance/customer-profiles
GET  /api/v1/compliance/customer-profiles
POST /api/v1/compliance/reviews/{id}/resolve
POST /api/v1/compliance/waivers
POST /api/v1/compliance/waivers/{id}/approve
GET  /api/v1/compliance/reviews
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 35. 事件

## 输入事件

```text
bom.normalized.ready
bom.mpn-resolution.ready
component.alternatives.ready
component.pcn.received
component.lifecycle.changed
supplier.document.received
supplier.site.changed
regulation.rule.updated
tariff.schedule.updated
customer.profile.updated
```

## 输出事件

```text
component.compliance.changed
bom.compliance.ready
product.compliance.blocked
compliance.evidence.expiring
compliance.review.required
origin.changed
tariff.classification.changed
tariff.cost.changed
supplier.compliance.gap
customer.compliance.failed
```

## `bom.compliance.ready`

```json
{
  "event_type": "bom.compliance.ready",
  "event_version": "1.0",
  "bom_id": "uuid",
  "bom_revision": "RevC",
  "market_context_hash": "hex",
  "assessment_result_uri": "s3://.../product-rollup.json",

  "summary": {
    "lines": 385,
    "compliant": 340,
    "conditional": 12,
    "unknown": 20,
    "non_compliant": 3,
    "blocked_by_customer": 10
  },

  "overall": {
    "status": "pending_verification",
    "risk": "high",
    "blocking_domains": [
      "pfas",
      "country_of_origin"
    ]
  },

  "review_status": "review_required",
  "created_at": "ISO-8601"
}
```

---

# 36. 规则包目录

```text
rules/
├── registry.yaml
├── jurisdictions/
│   ├── eu/
│   │   ├── rohs/
│   │   ├── reach/
│   │   └── pfas/
│   ├── us/
│   │   ├── tsca/
│   │   ├── conflict-minerals/
│   │   ├── origin/
│   │   └── tariff/
│   ├── cn/
│   ├── ca/
│   ├── uk/
│   └── customer/
├── substances/
├── exemptions/
├── tariff-schedules/
├── origin-rules/
├── evidence-policies/
└── schemas/
```

每个 RuleBundle 包含：

```text
manifest
effective dates
source hashes
dependencies
validation tests
rollback target
```

---

# 37. Rule Bundle 发布流程

```text
draft
→ legal/data review
→ fixture validation
→ shadow evaluation
→ impact preview
→ approved
→ effective
→ superseded
→ archived
```

发布前必须显示：

```text
affected parts
affected BOMs
status changes
new blocking results
new evidence requirements
```

规则更新不得无提示地修改历史审计结论。

历史评估继续引用旧 RuleBundle，新评估使用新版本。

---

# 38. Evidence Parser

V1 规则优先，支持：

```text
PDF text/table
XLSX/CSV
XML
IPC-1752A
HTML snapshot
CMRT/EMRT spreadsheet
SDS
manufacturer declaration templates
```

LLM 只允许：

- 文档分类；
- 字段候选抽取；
- 受控表格解释；
- Top-K Scope 候选说明。

LLM 不得直接输出最终合规结论。

---

# 39. 供应商问卷与证据请求

系统可生成：

```text
missing evidence questionnaire
renewal request
PFAS questionnaire
REACH declaration request
CMRT/EMRT request
COO/manufacturing route request
HTS classification request
```

每次请求保存：

```text
supplier
subject scope
required fields
due date
response
evidence
reminders
escalation
```

---

# 40. 合规审计包

输出 ZIP 或受控报告：

```text
assessment summary
applicable rules
rule versions
part and BOM scope
evidence list
issuer and validity
material/substance findings
exemptions
customer requirements
origin determination
tariff calculation
open gaps
waivers
review decisions
sign-off
```

禁止只输出一张“绿色通过”截图。

---

# 41. 可观测性

## Prometheus

```text
compliance_jobs_total{status,subject_type}
compliance_evidence_total{document_type,issuer_type}
compliance_evidence_parse_total{status}
compliance_evidence_expired_total{domain}
compliance_assessments_total{domain,status}
compliance_rule_evaluations_total{rule_id,result}
compliance_rohs_exemptions_total{code,status}
compliance_svhc_findings_total{substance}
compliance_pfas_findings_total{definition,status}
compliance_tsca_reviews_total{reason}
compliance_conflict_mineral_smelt ers_total{status}
compliance_origin_determinations_total{status,country}
compliance_tariff_classifications_total{status}
compliance_customer_failures_total{requirement}
compliance_reviews_total{reason,severity}
compliance_cache_hits_total{stage}
```

注意实际实现时修正指标名中的空格：

```text
compliance_conflict_mineral_smelters_total
```

## Dashboard

- 各 Domain 通过率；
- Unknown 和过期证据；
- RoHS 豁免分布和到期；
- REACH/SVHC 发现；
- PFAS 数据覆盖；
- TSCA 待审核；
- CMRT/EMRT 响应率；
- Unknown Smelter；
- COO 缺失和冲突；
- HTS 待审核；
- 关税成本变化；
- 客户规则失败；
- 供应商合规缺口；
- 审核积压；
- 规则更新影响。

---

# 42. Benchmark

## 42.1 文档与范围

- Document Type Accuracy；
- Part/Variant Scope Accuracy；
- Evidence Date Accuracy；
- Issuer Accuracy；
- Scope Expansion False-positive Rate；
- Evidence Completeness。

## 42.2 RoHS

- Substance Extraction Accuracy；
- Homogeneous Material Accuracy；
- Threshold Evaluation Accuracy；
- Exemption Applicability Accuracy；
- Lead-free/RoHS Distinction Accuracy。

## 42.3 REACH

- Candidate List Version Accuracy；
- SVHC Extraction Precision/Recall；
- Article Scope Accuracy；
- Threshold Classification Accuracy；
- Outdated Declaration Detection。

## 42.4 PFAS/TSCA

- PFAS Definition Selection Accuracy；
- Intentionally Added Classification；
- Pending/Effective Rule Accuracy；
- TSCA Responsibility Classification；
- Reporting-review Recall。

## 42.5 冲突矿产

- CMRT/EMRT Parsing Accuracy；
- Smelter Identifier Accuracy；
- Smelter Status Accuracy；
- Reporting-period Accuracy；
- Unknown Coverage Accuracy。

## 42.6 原产地与关税

- Manufacturing Route Accuracy；
- Origin Fact Accuracy；
- Customs-origin Candidate Accuracy；
- Legal-review Trigger Recall；
- HS/HTS Top-K Accuracy；
- Tariff Calculation Accuracy；
- Additional-measure Recall。

## 42.7 产品级

- BOM Roll-up Accuracy；
- Blocking Unknown Recall；
- DNP/Variant Scope Accuracy；
- Customer Rule Accuracy；
- False-compliant Rate；
- Audit Reproducibility。

---

# 43. 初始质量目标

```text
Evidence Document Classification >= 98%
Part/Ordering Variant Scope Accuracy >= 99%
Evidence Field Accuracy >= 98%
RoHS Rule Evaluation Accuracy >= 99%
RoHS Exemption Applicability Accuracy >= 98%
REACH SVHC Extraction F1 >= 98%
Customer Requirement Evaluation >= 99%
Blocking Unknown Recall >= 99.5%
CMRT/EMRT Core Field Accuracy >= 98%
Origin Fact Accuracy >= 99%
Customs-origin Legal-review Trigger Recall >= 99.5%
HTS Top5 Recall >= 98%
Tariff Arithmetic Accuracy = 100%
High-confidence Auto Approval Accuracy >= 99%
False-compliant Rate <= 0.1%
Evidence Completeness >= 99%
```

复杂 COO、优惠原产、PFAS 和 TSCA 应单独报告。

这些是目标，不是未经测试的保证。

---

# 44. 测试集

公开仓库只使用合成、脱敏或授权 Fixture。

## 证据

1. Manufacturer RoHS Certificate；
2. Supplier Declaration；
3. FMD；
4. Partial Material Declaration；
5. IPC-1752A；
6. XML；
7. SDS；
8. Test Report；
9. Expired Certificate；
10. Family-wide Scope；
11. Package-only Scope；
12. Date-code Scope；
13. Conflicting Documents；
14. Invalid Signature；
15. Unknown Issuer。

## RoHS

16. All Substances Below；
17. Substance Above；
18. Valid Exemption；
19. Expired Exemption；
20. Renewal Under Review；
21. Customer No-exemption；
22. Lead Free but Incomplete；
23. Homogeneous Material Missing；
24. Package Variant Difference；
25. Old/New Date Code。

## REACH

26. No SVHC；
27. SVHC Below；
28. SVHC Above；
29. Article Scope；
30. Complex Product；
31. Old Candidate List；
32. Group Substance；
33. CAS Alias；
34. Unknown Concentration；
35. Communication Required。

## Halogen/PFAS/TSCA

36. Manufacturer Halogen Definition；
37. Customer Stricter Definition；
38. Chlorine/Bromine Values；
39. PFAS Free；
40. No Intentionally Added；
41. Contains Fluoropolymer；
42. Pending PFAS Rule；
43. Jurisdiction Difference；
44. TSCA Inventory；
45. Reporting Review；
46. Importer Unknown；
47. Article Exclusion Candidate；
48. Restriction Applies；
49. Evidence Insufficient；
50. Customer PFAS Block。

## Conflict Minerals

51. CMRT；
52. EMRT；
53. No 3TG；
54. 3TG Present；
55. Unknown Smelter；
56. Nonconformant Smelter；
57. Expired Reporting Period；
58. Product-level vs Company-level；
59. Cobalt Requirement；
60. Customer Smelter Blocklist。

## Origin

61. Wafer/Assembly/Test Multiple Countries；
62. Supplier Declared Origin；
63. Ship-from Different；
64. Country Change after PCN；
65. Simple Assembly；
66. Complex PCBA Assembly；
67. Packaging-only Operation；
68. Customs Ruling；
69. Preferential Origin；
70. Origin Unknown；
71. Conflicting COO Letters；
72. Multiple Sites；
73. Date-code-specific Site；
74. Manufacturer Acquisition；
75. Broker Review Required。

## Tariff

76. HS6 Candidate；
77. National HTS；
78. Revision Change；
79. Base Duty；
80. Preferential Rate；
81. Additional Duty；
82. Exclusion；
83. Quota；
84. Antidumping Review；
85. Origin-dependent Measure；
86. Import Date Difference；
87. Currency Conversion Snapshot；
88. Component vs Finished Product；
89. Classification Conflict；
90. Duty Recalculation。

## Customer/BOM

91. Customer No Exemption；
92. Country Blocklist；
93. Evidence Age；
94. DNP Line；
95. Variant BOM；
96. Packaging Scope；
97. Unknown Blocking Line；
98. Waiver；
99. Rule Update Re-evaluation；
100. Audit Package Reproduction。

---

# 45. 性能要求

## 单器件

```text
Evidence lookup P95 < 200 ms
Cached domain assessment P95 < 500 ms
Full multi-domain assessment P95 < 5 s
```

不含外部网络。

## 大型 BOM

```text
100,000 BOM lines
```

必须：

- Part/Variant 去重；
- Rule evaluation 批量化；
- Evidence 缓存；
- Domain 并行；
- 分块对象存储；
- 增量 Roll-up。

## 大型 FMD/CMRT

流式解析，不能将所有内容放入单条 JSONB 或一次性 DataFrame。

---

# 46. 缓存和增量

缓存键：

```text
subject_version
+ evidence_set_hash
+ market_context_hash
+ customer_profile_version
+ rule_bundle_hash
+ substance_registry_version
+ origin_rule_version
+ tariff_schedule_version
```

更新策略：

- 新证据：重评对应 Scope；
- 证据过期：重评依赖 Assessment；
- Rule 更新：按 Domain 重评；
- Customer Profile 更新：只重跑客户规则；
- PCN/Origin Fact 更新：只重跑 Origin、Tariff 和受影响合规；
- Tariff 更新：只重算税率，不重做 RoHS；
- Agent 32 映射更新：重做 Evidence Scope；
- Agent 33 替代更新：重做合规替代筛选。

---

# 47. 安全和权限

- 客户 Profile、供应商声明和成本严格租户隔离；
- 证书和 FMD 使用签名 URL；
- 文件做 MIME、宏、压缩炸弹和大小检查；
- 不执行 Excel 宏；
- 不刷新外部链接；
- XML 禁止 XXE；
- HTML 抓取做 SSRF 防护；
- 外部 API Key 服务端保存；
- 商业税率和报关资料按权限访问；
- 审核、Waiver 和规则发布日志不可删除；
- 关键合规批准支持双人复核；
- 不把私有 BOM、配方、供应商和贸易路线发送给外部通用模型；
- LLM 输入只包含必要字段和脱敏内容；
- 规则 DSL 禁止任意代码执行。

---

# 48. 推荐技术栈

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
Temporal / Celery / RQ
RDF/Graph for substances and origin
XML/IPC parser
Digital signature validation
Rules engine implemented with controlled DSL
```

V1 推荐：

```text
PostgreSQL Registry/Assessment
+ Object Storage Evidence
+ Rule-based Domain Evaluators
+ OpenSearch Evidence/Part Search
```

---

# 49. 推荐仓库结构

```text
compliance-origin-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── compliance-origin-agent-spec.md
│   ├── compliance-domain-model.md
│   ├── evidence-model.md
│   ├── rule-bundle-design.md
│   ├── rohs-design.md
│   ├── reach-design.md
│   ├── pfas-tsca-design.md
│   ├── conflict-minerals-design.md
│   ├── origin-design.md
│   ├── tariff-design.md
│   ├── customer-profile-design.md
│   ├── product-rollup.md
│   ├── evidence-review.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-no-global-compliance-boolean.md
│       ├── 0002-jurisdiction-date-context-required.md
│       ├── 0003-evidence-claim-assessment-separated.md
│       ├── 0004-origin-facts-and-origin-determination-separated.md
│       ├── 0005-classification-origin-rate-separated.md
│       └── 0006-unknown-is-not-compliant.md
├── src/
│   └── compliance_origin/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── evidence.py
│       │   ├── observation.py
│       │   ├── claim.py
│       │   ├── assessment.py
│       │   ├── rules.py
│       │   ├── origin.py
│       │   ├── tariff.py
│       │   └── review.py
│       ├── events/
│       ├── jobs/
│       ├── evidence/
│       │   ├── ingestion.py
│       │   ├── classifier.py
│       │   ├── scope.py
│       │   ├── validity.py
│       │   ├── signature.py
│       │   └── parsers/
│       ├── materials/
│       │   ├── substances.py
│       │   ├── compositions.py
│       │   ├── homogeneous.py
│       │   └── units.py
│       ├── rules/
│       │   ├── registry.py
│       │   ├── loader.py
│       │   ├── validator.py
│       │   ├── evaluator.py
│       │   ├── trace.py
│       │   └── impact.py
│       ├── domains/
│       │   ├── rohs/
│       │   ├── reach/
│       │   ├── halogen/
│       │   ├── pfas/
│       │   ├── tsca/
│       │   └── conflict_minerals/
│       ├── origin/
│       │   ├── facts.py
│       │   ├── route.py
│       │   ├── nonpreferential.py
│       │   ├── preferential.py
│       │   ├── rulings.py
│       │   └── review.py
│       ├── tariff/
│       │   ├── classification.py
│       │   ├── schedules.py
│       │   ├── measures.py
│       │   ├── calculator.py
│       │   └── trace.py
│       ├── customer/
│       │   ├── profiles.py
│       │   ├── dsl.py
│       │   ├── waivers.py
│       │   └── evaluator.py
│       ├── rollup/
│       │   ├── bom.py
│       │   ├── articles.py
│       │   ├── product.py
│       │   └── unknowns.py
│       ├── actions/
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── rules/
├── source-profiles/
├── schemas/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── ingest_compliance_evidence.py
    ├── validate_rule_bundle.py
    ├── publish_rule_bundle.py
    ├── rebuild_assessments.py
    ├── import_tariff_schedule.py
    ├── import_substance_registry.py
    ├── validate_customer_profiles.py
    ├── run_compliance_benchmark.py
    └── generate_audit_package.py
```

---

# 50. Codex 分阶段实施

不要一次实现全部功能。

## Phase 0：仓库侦察和合规数据盘点

检查：

- Agent 31–34 接口；
- Part/Variant/Material；
- RoHS、REACH、无卤、PFAS、TSCA 字段；
- FMD、SDS、Certificate、IPC-1752A；
- CMRT/EMRT 和 Smelter；
- COO、工厂、供应商、制造路线；
- HS/HTS、关税和报关；
- 客户合规要求；
- Review、Patch、权限和对象存储；
- 数据覆盖、冲突、过期和作用域。

只输出设计文档，不改业务代码、不迁移、不安装依赖。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Evidence；
- Observation；
- Claim；
- Rule；
- Assessment；
- Material/Substance；
- Origin；
- Tariff；
- Customer Requirement；
- Review；
- Event；
- JSON Schema。

## Phase 2：Evidence Ingestion 和 Scope

实现：

- PDF/XLSX/XML/HTML；
- Document Type；
- Issuer；
- Dates；
- Part/Variant Scope；
- Evidence Anchor；
- Hash；
- Signature Status；
- Expiry。

## Phase 3：Rule Registry 和 DSL

实现：

- Jurisdiction；
- Version；
- Effective Dates；
- Source Snapshot；
- Rule Validator；
- Controlled DSL；
- Trace；
- Publish/Rollback。

## Phase 4：Material 和 Substance Registry

实现：

- CAS/EC；
- Substance Group；
- Alias；
- Material；
- Homogeneous Material；
- Concentration；
- Bound；
- Unit；
- FMD Import。

## Phase 5：RoHS

实现：

- Product Scope；
- Restricted Substance；
- Threshold；
- Homogeneous Material；
- Exemption；
- Lead-free Difference；
- Evidence；
- Customer No-exemption。

## Phase 6：REACH/SVHC

实现：

- Candidate List Version；
- Article/Sub-article；
- SVHC；
- Concentration；
- Communication Flag；
- Old Declaration；
- Roll-up。

## Phase 7：无卤

实现：

- Definition Profiles；
- Chlorine/Bromine/Total；
- Material Scope；
- Customer Definition；
- Mismatch；
- Review。

## Phase 8：PFAS

实现：

- Jurisdiction Definitions；
- Substance/Structural Scope；
- Intentionally Added；
- Pending/Effective Rules；
- Evidence Gap；
- Customer Rules。

## Phase 9：TSCA

实现：

- Responsibility Entity；
- Inventory；
- Reporting/Restriction；
- Article/Mixture；
- Importer Review；
- Evidence；
- Versioning。

## Phase 10：冲突矿产

实现：

- CMRT/EMRT；
- Reporting Period；
- Supplier Scope；
- Smelter；
- Mineral；
- Country Risk；
- Customer Requirements；
- Roll-up。

## Phase 11：Origin Facts 和 Manufacturing Route

实现：

- Wafer/Assembly/Test/Final；
- Site；
- Validity；
- PCN Changes；
- Supplier Declaration；
- Evidence；
- Conflict。

## Phase 12：Customs Origin

实现：

- Destination-specific Rules；
- Non-preferential；
- Preferential；
- Route Facts；
- Rule Candidate；
- Binding Ruling；
- Legal-review Trigger。

## Phase 13：HS/HTS Classification

实现：

- Subject Scope；
- HS6；
- National Code；
- Description；
- Top-K Candidate；
- Ruling；
- Version；
- Review。

## Phase 14：Tariff Calculation

实现：

- Origin；
- Destination；
- Date；
- Customs Value；
- Base/Preferential/Additional Duty；
- Exclusion；
- Measure；
- Trace；
- Decimal Arithmetic。

## Phase 15：Customer Profile 和 Waiver

实现：

- Requirement DSL；
- Version；
- Evidence Policy；
- Blocking/Warning；
- Waiver；
- Approval；
- Expiry。

## Phase 16：BOM/Product Roll-up

实现：

- Revision/Variant/DNP；
- Article Scope；
- Packaging；
- Unknown Propagation；
- Blocking Domain；
- Audit Package。

## Phase 17：Review、Actions 和 Supplier Requests

实现：

- Domain Review；
- Evidence Gap；
- Rule Trace；
- Patch；
- Waiver；
- Supplier Questionnaire；
- Audit。

## Phase 18：API、Events、Batch 和 Cache

实现：

- API；
- Jobs；
- Batch；
- Retry/Cancel；
- Events；
- Incremental；
- Object Storage；
- Idempotency。

## Phase 19：Benchmark、监控和生产发布

实现：

- Benchmark；
- Metrics；
- Dashboard；
- Security；
- Rule Release；
- Disaster Recovery；
- Source Health；
- Compliance Disclaimer。

---

# 51. Codex 工作纪律

Codex 必须：

1. 不创建全局永久的 `rohs=true`；
2. Jurisdiction、Product Scope 和 Date 必须参与判断；
3. Evidence、Claim、Assessment 分开；
4. Manufacturer Declaration 不等于第三方验证；
5. Part/Base/Package/Ordering Variant 分开；
6. Unknown 不得当 Compliant；
7. Lead-free 不等于 RoHS；
8. RoHS 使用 Homogeneous Material；
9. Exemption 有版本、范围和有效期；
10. REACH Candidate List 有版本；
11. SVHC Article Scope 不能按整机总重量掩盖；
12. Halogen Definition 可按客户变化；
13. PFAS Definition 按司法辖区版本化；
14. Proposed Rule 不得当 Effective Rule；
15. PFAS Free 与 No Intentionally Added 分开；
16. TSCA 按责任主体和义务类型拆分；
17. CMRT/EMRT Reporting Period 必须保存；
18. Company-level 声明不得默认覆盖所有 Part；
19. COO Facts 和 Customs Origin 分开；
20. Ship-from 不等于 Origin；
21. Country of Manufacturer 不一定等于 Customs Origin；
22. Preferential Origin 和 Non-preferential Origin 分开；
23. HS Classification、Origin 和 Tariff Rate 分开；
24. Tariff Rate 必须绑定日期和 Schedule Version；
25. Component HTS 不能直接 Roll-up 为整机 HTS；
26. 客户规则不改写法规事实；
27. Waiver 有 Scope、条件和有效期；
28. Rule DSL 禁止任意代码；
29. 人工 Patch 不覆盖机器 Claim/Trace；
30. 法规规则更新不覆盖历史 Assessment；
31. 不把聚合网页当唯一权威证据；
32. LLM 不直接做最终法律结论；
33. 不将私有 BOM、材料配方和贸易路线发给外部模型；
34. 不使用真实客户数据公开测试；
35. 不伪造证书、税率、法律结论或准确率；
36. 每个 Phase 输出修改文件、Schema/API、Rule/Profile、测试、Benchmark、性能、安全、已知问题和下一阶段。

---

# 52. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/compliance-origin-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第35个 Agent：

Compliance, Origin & Tariff Intelligence Agent / 合规与原产地 Agent。

本 Agent 负责：

- 检查 RoHS、REACH/SVHC、无卤、PFAS、TSCA 和冲突矿产；
- 接入 FMD、SDS、CoC、IPC-1752A、CMRT、EMRT、测试报告和客户声明；
- 保存 Manufacturer、Supplier、Material、Homogeneous Material、Substance 和证据；
- 按司法辖区、产品范围、市场日期和客户 Profile 评估；
- 保存 Waiver、Exemption、Evidence Validity 和 Rule Version；
- 跟踪 Wafer Fab、Assembly、Test、Final Manufacturing 和供应商声明 COO；
- 区分 Origin Fact、Customs Origin、Preferential Origin 和 Ship-from；
- 处理 HS/HTS Classification、Tariff Schedule、Additional Duty 和 Exclusion；
- 将结果 Roll-up 到 BOM、PCBA 和整机；
- 对 Unknown、Expired、Conflict 和 Customer Block 创建审核和动作；
- 发布 bom.compliance.ready。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 31、32、33、34 的规格和实际代码；
3. docs/compliance-origin-agent-spec.md；
4. 当前 Part、Base Part、Package Variant、Ordering Variant、Material、Supplier 和 Manufacturer 数据模型；
5. 当前 RoHS、REACH、Halogen、PFAS、TSCA、Conflict Minerals 和 COO 字段；
6. 当前 FMD、SDS、Certificate、IPC-1752A、CMRT、EMRT 和测试报告；
7. 当前 Country、Site、Manufacturing Route、PCN 和 Supplier Site；
8. 当前 HS/HTS、Tariff、Import、Export、Customs Value、Invoice 和 Order；
9. 当前 Customer Requirement、Waiver、Review、Patch、权限和审计；
10. 当前对象存储、队列、搜索、Docker 和 CI；
11. 脱敏或合成 Fixture。

硬约束：

- 不创建无作用域、无日期的全局 Compliance Boolean；
- Jurisdiction、Product Scope、Evaluation Date 和 Customer Profile 必须参与评估；
- Evidence、Observation、Claim、Assessment、Decision 分开；
- Raw Evidence 不可变；
- Manufacturer/Supplier Declaration 不等于独立验证；
- Part、Package Variant 和 Ordering Variant 分开；
- Evidence Scope 不能默认扩大；
- Unknown 不得当 Compliant；
- Lead-free 不等于 RoHS；
- RoHS 按 Homogeneous Material 评估；
- Exemption 保存 Scope、Validity 和 Renewal Status；
- REACH Candidate List 必须版本化；
- Article/Sub-article Scope 不能按整机总重量掩盖；
- Halogen-free Definition 可按标准和客户变化；
- PFAS Definition 必须按 Jurisdiction 和 Rule Version；
- Proposed、Adopted、Effective、Withdrawn 状态分开；
- PFAS Free 和 No Intentionally Added 分开；
- TSCA 按 Inventory、Reporting、Restriction、Importer Responsibility 分开；
- CMRT/EMRT 保存 Template Version 和 Reporting Period；
- Company-level Declaration 不自动覆盖全部 Part；
- Origin Facts 与 Customs Origin 分开；
- Ship-from/Seller Country 不等于 Origin；
- Preferential 和 Non-preferential Origin 分开；
- HS/HTS、Origin 和 Tariff Rate 分开；
- Tariff Schedule 和 Rate 绑定 Effective Date；
- Component Classification 不直接成为 Finished Product Classification；
- Customer Rule 不改写 Regulatory Fact；
- Waiver 有 Scope、Conditions、Approval 和 Expiry；
- Rule DSL 禁止任意代码；
- 人工 Patch 不覆盖机器 Claim 和 Rule Trace；
- Rule 更新不覆盖历史 Assessment；
- 聚合数据不能作为唯一权威来源；
- LLM 不得输出最终法律结论；
- LLM 只用于受控文档分类、字段候选和 Top-K 说明；
- 不把私有 BOM、材料配方、客户条件和贸易路线发给外部模型；
- 不把真实客户数据放入公开测试；
- 不伪造证书、税率、来源、法律结论和准确率。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查 Agent 31–34 的真实完成程度和接口；
3. 查找 Part/Variant/Material/Substance 数据；
4. 查找现有 RoHS、REACH、Halogen、PFAS、TSCA 和 Conflict Minerals 字段；
5. 查找 FMD、CoC、SDS、IPC-1752A、CMRT、EMRT 和证据；
6. 查找 Evidence Scope、Validity、Issuer 和 Signature；
7. 查找 Manufacturer/Supplier Site 和 Manufacturing Route；
8. 查找 COO、Ship-from、Seller Country 和 Customs Origin；
9. 查找 HS/HTS、Tariff Schedule、Additional Duty、Exclusion 和 Customs Value；
10. 查找 Customer Compliance Requirement、Waiver 和证据时效策略；
11. 查找 BOM/Product Roll-up、DNP、Variant 和 Packaging；
12. 查找 Review、Patch、Audit、权限和对象存储；
13. 统计数据覆盖、Unknown、Expired、Conflict 和 Scope Ambiguity；
14. 抽样分析脱敏或合成 Fixture；
15. 在 docs/compliance-origin-implementation-plan.md 中生成实施计划；
16. 在 docs/compliance-domain-model.md 中定义 Domain Model；
17. 在 docs/compliance-evidence-model.md 中定义 Evidence/Claim/Scope；
18. 在 docs/compliance-rule-bundle-design.md 中定义 Rule Registry 和 DSL；
19. 在 docs/rohs-reach-material-design.md 中定义材料、RoHS 和 REACH；
20. 在 docs/pfas-tsca-design.md 中定义 PFAS 和 TSCA；
21. 在 docs/conflict-minerals-design.md 中定义 CMRT/EMRT 和 Smelter；
22. 在 docs/country-of-origin-design.md 中定义 Origin Fact、Route 和 Determination；
23. 在 docs/tariff-classification-design.md 中定义 HS/HTS 和 Tariff；
24. 在 docs/customer-compliance-profile-design.md 中定义客户规则和 Waiver；
25. 在 docs/compliance-rollup-design.md 中定义 BOM/Product Roll-up；
26. 在 docs/compliance-migration-plan.md 中定义旧字段迁移；
27. 在 docs/compliance-benchmark-plan.md 中定义 Benchmark；
28. 给出拟新增、拟修改和拟复用文件；
29. 给出 Phase 1 精确范围；
30. 不修改业务代码；
31. 不创建数据库 Migration；
32. 不安装依赖；
33. 运行当前仓库已有 lint、type check、test 和 build；
34. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 31–34 输入契约；
- 当前合规数据模型；
- Evidence/Scope/Validity；
- Rule Registry 和 Version；
- Material/Homogeneous Material；
- RoHS/Exemption；
- REACH/SVHC；
- Halogen/PFAS/TSCA；
- Conflict Minerals；
- Origin Facts 和 Manufacturing Route；
- Customs/Preferential Origin；
- HS/HTS 和 Tariff；
- Customer Profile/Waiver；
- BOM/Product Roll-up；
- Review/Audit；
- 旧数据迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 文件范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 53. 后续 Phase 提示词模板

```text
继续实现 Compliance, Origin & Tariff Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 31–35 规格；
3. 阅读 Implementation Plan；
4. 阅读 Evidence、Rules、Materials、Origin、Tariff、Customer 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Jurisdiction/Date/Scope；
- Raw Evidence 不可变；
- Evidence/Claim/Assessment 分离；
- Unknown 非 Compliant；
- Part/Variant 分离；
- Rule Version；
- Origin Facts/Determination 分离；
- Classification/Origin/Rate 分离；
- Customer/Regulatory 分离；
- Evidence 和 Rule Trace 完整；
- 不覆盖人工 Patch；
- LLM 受控；
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
- Rule/Profile/Registry 变化；
- 测试命令和真实结果；
- Domain 指标；
- Roll-up 指标；
- Origin/Tariff 指标；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 54. MVP 演示流程

1. 上传 Manufacturer RoHS/REACH Declaration；
2. 解析 Issuer、日期、Scope 和 MPN；
3. Agent 32 精确映射 Ordering Variant；
4. 识别 RoHS 合规但使用 Exemption；
5. 客户 Profile 禁止 Exemption；
6. 输出 Regulatory Pass、Customer Block；
7. 上传 FMD；
8. 解析 Homogeneous Material 和 Substance；
9. 重新计算 RoHS；
10. 加载指定版本 REACH Candidate List；
11. 发现 SVHC 并保留 Article Scope；
12. 上传 Halogen Declaration；
13. 制造商定义通过、客户更严格定义失败；
14. 上传 PFAS Questionnaire；
15. 区分 PFAS Free 和 No Intentionally Added；
16. 对未生效拟议规则只生成 Future Risk；
17. 上传 TSCA Statement；
18. 要求指定 Importer 责任主体；
19. 上传 CMRT；
20. 解析 Smelter 和 Reporting Period；
21. 发现 Unknown Smelter；
22. 生成供应商补充任务；
23. 上传 COO Letter；
24. 保存 Wafer、Assembly、Test Country；
25. 不将 Ship-from 当 Customs Origin；
26. 跨国路线进入 Customs Review；
27. 录入 HTS Candidate；
28. 使用指定 2026 Schedule Version 计算税率；
29. 加入 Additional Duty；
30. Product Variant Roll-up；
31. DNP 行不计入；
32. Unknown Blocking Line 阻止客户发货；
33. 添加 Customer Waiver；
34. 生成 Audit Package；
35. 发布 `bom.compliance.ready`。

---

# 55. 生产上线顺序

第一阶段：

```text
证据接入
Part/Variant Scope
RoHS
REACH
客户规则
BOM Roll-up
证据过期和审核
```

第二阶段：

```text
无卤
PFAS
TSCA
CMRT/EMRT
供应商问卷
PCN 增量重评
```

第三阶段：

```text
制造路线
Customs Origin
Preferential Origin
HS/HTS
动态关税
复杂客户审计包
```

优先把“证据适用于哪一个具体 Ordering Variant、哪个市场、哪个时间版本”做准确，再扩展法规数量。合规系统最危险的错误不是显示 Unknown，而是拿一份范围模糊或过期的声明，把整个 BOM 错判为合规。
