# BOM 接入与标准化 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：31  
> Agent：BOM Intake & Normalization Agent  
> 中文名：BOM 接入与标准化 Agent  
> 版本：V1.0  
> 定位：面向电子研发、采购和制造流程的多格式 BOM 接入、结构识别、字段标准化与证据保留 Agent

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的 BOM 接入与标准化 Agent。

输入包括：

- Excel：XLSX、XLSM、XLS、XLSB；
- CSV、TSV、TXT、Markdown Table、HTML Table；
- 原生 PDF 表格；
- 扫描 PDF；
- 截图、手机照片、扫描图片；
- 粘贴的非标准表格和文本；
- 多 Sheet、多表、多级 BOM、Variant BOM。

输出包括：

- Canonical BOM Schema；
- 原始文件、工作表、表格、行、列和单元格；
- 标准化 BOM 行；
- 列语义映射；
- RefDes、Qty、DNP、Variant 和层级结构；
- 原始字段字典；
- Evidence、Confidence、Conflict 和 Review Task；
- `bom.normalized.ready` 下游事件。

系统必须做到：

1. 自动识别 BOM 所在 Sheet、页码和表格区域；
2. 自动识别单行、多行和合并表头；
3. 将非标准列名映射到统一字段；
4. 保留全部原始字段和原始单元格；
5. 解析位号、数量、型号、厂商、描述、封装、内部料号和 DNP；
6. 处理 Variant、多级 BOM、替代料和子装配；
7. 检查数量与位号、重复位号和行项目冲突；
8. 为每个标准字段保存来源证据；
9. 低置信度和高风险冲突自动进入审核台；
10. 人工修改以 Patch 保存，不覆盖机器原始结果；
11. 为下游 MPN 匹配、价格库存、替代料和制造分析提供稳定输入。

---

# 2. Agent 边界

本 Agent 负责：

```text
“这个文件中的 BOM 表格是什么结构，每一列、每一行表达什么”
```

本 Agent 不负责最终判断：

```text
“这个字符串一定对应 ezPLM 中哪一个元器件实体”
```

推荐链路：

```text
BOM 文件
  ↓
BOM 接入与标准化 Agent
  ↓
Canonical BOM
  ↓
MPN Resolution / Part Matching Agent
  ↓
Lifecycle / Price / Stock / Alternative / Procurement
```

本 Agent 不应：

- 直接调用分销商实时价格；
- 自动决定最终替代料；
- 自动覆盖企业内部物料主数据；
- 将 OCR 猜测结果直接当成正式 MPN；
- 将所有未知列丢弃；
- 直接执行 Excel 宏或外部链接；
- 用通用大模型处理整份客户 BOM 并直接输出最终结果。

---

# 3. 核心数据分层

必须区分：

```text
Source Asset
  ↓
Source Sheet / PDF Page / Image
  ↓
Detected Table
  ↓
Raw Row / Raw Cell
  ↓
BOM Line Observation
  ↓
Canonical BOM Line
  ↓
Resolved Component（下游）
```

## 3.1 Source Asset

保存：

- asset_id；
- 原始文件名；
- MIME；
- SHA256；
- 文件大小；
- 上传来源；
- 项目、租户和用户；
- 文档版本；
- 是否加密；
- 是否含宏；
- Sheet 数、页数、图片尺寸；
- 原始对象存储 URI。

## 3.2 Detected Table

保存：

- table_id；
- Sheet/Page/Image；
- bbox；
- header rows；
- data range；
- repeated header；
- merged cells；
- hidden rows/columns；
- table type；
- confidence；
- parser/adapter version。

## 3.3 Raw Cell

每个单元格必须保存：

```text
sheet/page
row/column
cell address
raw value
displayed value
formula
data type
number format
style
comment
merged range
hidden status
bbox
OCR text
OCR confidence
```

## 3.4 BOM Line Observation

机器对某一行或行组的结构化理解。

## 3.5 Canonical BOM Line

经过字段选择、标准化、校验和必要人工审核后的正式行项目。

---

# 4. 原始数据不可变

任何标准化操作不得覆盖原值。

例如 Excel 单元格：

```json
{
  "sheet": "BOM",
  "address": "F17",
  "raw_value": "  STM32G431CBT6 ",
  "display_value": "STM32G431CBT6",
  "formula": null,
  "data_type": "string"
}
```

标准化结果另存：

```json
{
  "manufacturer_part_number": {
    "raw": "  STM32G431CBT6 ",
    "normalized": "STM32G431CBT6",
    "search_key": "STM32G431CBT6"
  }
}
```

人工修改也不得覆盖机器结果，必须形成：

```text
machine_record
+ approved_patch
= resolved_view
```

---

# 5. Canonical BOM Schema

## 5.1 BOM Header

```json
{
  "bom_id": "uuid",
  "schema_version": "1.0.0",
  "identity": {
    "bom_name": "Main Control Board",
    "project_id": "uuid",
    "assembly_part_number": "PCBA-001",
    "assembly_revision": "RevC",
    "bom_revision": "3.2",
    "variant": "EU",
    "bom_type": "engineering"
  },
  "build": {
    "assembly_quantity": "1000",
    "unit": "board"
  },
  "source": {
    "asset_id": "uuid",
    "source_sha256": "hex",
    "original_filename": "BOM RevC.xlsx"
  },
  "lines": [],
  "raw_metadata": {},
  "quality": {}
}
```

## 5.2 BOM Type

```text
engineering
manufacturing
assembly
procurement
costed
approved_vendor_list
variant
multi_level
service
unknown
```

## 5.3 Canonical BOM Line

```json
{
  "line_id": "uuid",
  "line_number": "10",
  "line_type": "component",

  "hierarchy": {
    "level": 0,
    "parent_line_id": null,
    "is_phantom": false
  },

  "reference_designators": {
    "raw": "R1-R4, R8",
    "normalized": ["R1", "R2", "R3", "R4", "R8"],
    "physical_count": 5,
    "logical_units": []
  },

  "quantity": {
    "raw": "5",
    "per_assembly": "5",
    "total": null,
    "unit": "pcs",
    "source": "explicit"
  },

  "part": {
    "internal_part_number": {
      "raw": "RES-10K-0402",
      "normalized": "RES-10K-0402"
    },
    "customer_part_number": null,
    "manufacturer": {
      "raw": "Yageo",
      "normalized": "Yageo"
    },
    "manufacturer_part_number": {
      "raw": "RC0402FR-0710KL",
      "normalized": "RC0402FR-0710KL",
      "search_key": "RC0402FR0710KL"
    }
  },

  "engineering": {
    "description": {
      "raw": "RES 10K 1% 0402",
      "normalized": "RES 10K 1% 0402"
    },
    "value": {
      "raw": "10K",
      "normalized": "10000",
      "unit": "ohm"
    },
    "tolerance": {
      "raw": "1%",
      "normalized": "1",
      "unit": "%"
    },
    "voltage_rating": null,
    "current_rating": null,
    "power_rating": null,
    "package": {
      "raw": "0402",
      "normalized": "0402"
    },
    "footprint": {
      "raw": "Resistor_SMD:R_0402_1005Metric",
      "normalized": "Resistor_SMD:R_0402_1005Metric"
    },
    "category": "passive.resistor"
  },

  "sourcing": {
    "supplier": null,
    "supplier_sku": null,
    "approved_manufacturers": [],
    "approved_parts": [],
    "alternates": []
  },

  "assembly": {
    "dnp": false,
    "dnp_reason": null,
    "variant_rules": [],
    "placement_side": null,
    "process_notes": []
  },

  "commercial": {
    "unit_price": null,
    "currency": null,
    "moq": null,
    "lead_time_days": null
  },

  "notes": [],
  "raw_fields": {},
  "evidence": {},
  "confidence": {},
  "review_status": "auto_approved"
}
```

---

# 6. Line Type

必须区分：

```text
component
subassembly
mechanical
pcb
firmware
consumable
packaging
document
labor
service
group_header
note
subtotal
separator
unknown
```

不能把以下内容误当电子元器件：

```text
PCB FAB
Firmware
Assembly labor
Packaging box
Section header
Subtotal
Revision notes
```

---

# 7. 原始字段保留

## 7.1 未映射列

所有未映射列放入 `raw_fields`：

```json
{
  "raw_fields": {
    "采购备注": {
      "value": "优先国产",
      "source_column": "N",
      "header_raw": "采购备注"
    },
    "测试等级": {
      "value": "A",
      "source_column": "P",
      "header_raw": "测试等级"
    }
  }
}
```

## 7.2 已映射列也保留原始信息

即使下列字段都映射到 MPN：

```text
MPN
Mfr Part Number
Manufacturer Part No.
Mfr P/N
型号
器件型号
原厂料号
```

仍须保存：

- raw header；
- header path；
- source cell；
- mapping rule；
- mapping confidence。

## 7.3 Raw Field Dictionary

输出字段字典：

```text
原始表头
标准字段
出现次数
数据样例
映射规则
映射置信度
未映射原因
```

---

# 8. 输入格式 Adapter

统一接口：

```python
class BOMSourceAdapter(Protocol):
    def can_handle(self, source: SourceAsset) -> bool: ...
    def profile(self, source: SourceAsset) -> SourceProfile: ...
    def extract(self, source: SourceAsset) -> RawDocument: ...
```

## 8.1 XLSX / XLSM

读取：

- Sheet；
- Raw Cell；
- Formula；
- Cached/Displayed Value；
- Merged Cell；
- Hidden Row/Column；
- Comment；
- Named Range；
- Excel Table；
- Filter；
- Freeze Pane；
- Cell Style；
- Number Format。

宏策略：

- 不执行宏；
- 记录 `has_macros=true`；
- 文件隔离保存；
- 只读取允许的数据结构。

## 8.2 XLS / XLSB

独立 Adapter。

如果内部转换为中间格式，必须保存：

- 原文件；
- 转换工具版本；
- Sheet 名；
- 公式和显示值；
- 编码；
- 隐藏状态；
- 转换警告。

## 8.3 CSV / TSV / TXT

处理：

- UTF-8 / UTF-8 BOM；
- GBK / GB18030；
- Big5；
- Latin-1；
- 分隔符推断；
- Quote；
- 多行字段；
- 转义；
- 小数逗号；
- 空行；
- 不规则列数。

编码不确定时进入审核。

## 8.4 PDF 原生表格

优先使用：

- Text Layer；
- bbox；
- 表格线；
- 字体和阅读顺序；
- 页面渲染；
- 重复表头。

不得只用文本 `split()`。

## 8.5 扫描 PDF

逐页判断：

```text
native
scanned
mixed
```

只对需要的页或区域 OCR。

## 8.6 截图和照片

处理：

- 旋转；
- 透视校正；
- 裁边；
- 去阴影；
- 去噪；
- 表格区域检测；
- OCR；
- 行列重建；
- Cell bbox。

原图、预处理图和 OCR 结果必须同时保存。

## 8.7 粘贴文本

支持：

```text
Markdown Table
Tab-separated
Space-aligned text
HTML Table
聊天文本中的 BOM
```

---

# 9. 文件安全

## 9.1 Excel

- 不执行宏；
- 不刷新外部链接；
- 不执行数据连接；
- 不自动计算不可信公式；
- 限制 Sheet、Row、Column、Cell 数；
- 检查 ZIP Bomb；
- 检查异常压缩比。

## 9.2 CSV Injection

原始值可能以 `= + - @` 开头。

系统保留原值，但导出 Excel/CSV 时生成安全导出值，避免公式注入。

## 9.3 PDF / 图片

- MIME 和文件头双验证；
- 页面、像素、对象数和资源大小限制；
- OCR Worker 隔离；
- CPU、内存和超时限制。

## 9.4 URL

- SSRF 防护；
- 禁止 localhost 和内网 IP；
- 禁止云 Metadata Endpoint；
- 限制重定向；
- 限制文件大小；
- 只允许 HTTP/HTTPS；
- Content-Type 和 Header 双验证。

---

# 10. Source Profile

```json
{
  "source_type": "xlsx",
  "sheet_count": 4,
  "candidate_bom_sheets": [
    {"sheet": "BOM", "score": 0.98}
  ],
  "has_formulas": true,
  "has_merged_cells": true,
  "has_hidden_rows": true,
  "has_multiple_tables": false,
  "language_candidates": ["zh-CN", "en"],
  "estimated_rows": 420
}
```

Source Profile 决定后续：

- Adapter；
- OCR；
- Company Profile；
- Sheet 优先级；
- Table Detection 策略。

---

# 11. Sheet、Table 和 Header 检测

## 11.1 Sheet 分类

```text
bom
approved_vendor_list
summary
cost
instructions
change_log
drawing_index
test
unknown
```

## 11.2 一个 Sheet 可包含多个区域

```text
标题和项目元数据
主 BOM
替代料表
价格表
备注
版本记录
```

必须分别建模。

## 11.3 表头可能形式

- 第 1 行；
- 第 5 行；
- 多行表头；
- 合并表头；
- 重复表头；
- 每页重复；
- 没有显式表头；
- 横向/转置表格。

## 11.4 Header Score

```text
header_score =
  known_alias_score
  + text_density
  + data_type_change_below
  + style_change
  + merged_header_structure
  + position_prior
  - data_like_penalty
```

---

# 12. 多行表头

示例：

```text
| 基本信息        | 物料信息                   | 采购信息       |
| 序号 | 位号 | 数量 | 厂商 | 型号 | 描述 | 供应商 | 单价 |
```

列路径保存为：

```text
基本信息/序号
基本信息/位号
物料信息/厂商
物料信息/型号
采购信息/单价
```

列映射同时参考：

- 叶子表头；
- 完整路径；
- 邻近列；
- 数据类型；
- 值模式；
- 公司 Profile。

---

# 13. Column Semantic Mapping

## 13.1 标准字段

```text
line_number
item_number
level
parent
reference_designators
quantity
unit
internal_part_number
customer_part_number
manufacturer
manufacturer_part_number
description
value
tolerance
voltage_rating
current_rating
power_rating
package
footprint
category
supplier
supplier_sku
alternate_part
dnp
variant
notes
unit_price
currency
moq
lead_time
```

## 13.2 Alias Registry

```yaml
manufacturer_part_number:
  aliases:
    - MPN
    - Mfr Part Number
    - Manufacturer Part No.
    - Mfr P/N
    - 原厂料号
    - 厂家型号
    - 器件型号

reference_designators:
  aliases:
    - RefDes
    - Reference
    - Designator
    - Ref
    - 位号
    - 器件位号
```

## 13.3 不能只依赖表头

`Part Number` 可能表示：

- 内部物料编码；
- MPN；
- 客户料号；
- 供应商 SKU。

需要结合：

- Manufacturer 列；
- 值格式；
- ezPLM 内部编码规则；
- 数据库命中候选；
- 其他列；
- Header Path；
- Company Profile。

## 13.4 Column Mapping 结果

```json
{
  "source_column": "F",
  "header_raw": "Part Number",
  "header_path": "Material/Part Number",
  "target_field": "manufacturer_part_number",
  "confidence": 0.82,
  "alternatives": [
    {"field": "internal_part_number", "confidence": 0.68}
  ],
  "evidence": {
    "manufacturer_column_present": true,
    "sample_values": ["STM32G431CBT6", "TPS62160DSGR"]
  }
}
```

低置信度列映射必须先审核，再批量作用于整列。

---

# 14. 行分类

每行先分类，再解析字段。

```text
data
group_header
subassembly
note
subtotal
repeated_header
blank
separator
variant_header
alternate_row
unknown
```

使用特征：

- 是否有 RefDes；
- 是否有 Qty；
- 是否有 MPN；
- 多列是否为空；
- 是否合并单元格；
- Style；
- 是否含 Total/Subtotal；
- 是否类似 Header；
- 序号连续性；
- Level 和缩进；
- 上下行关系。

---

# 15. RefDes 解析

## 15.1 支持格式

```text
R1
R1,R2,R3
R1 R2 R3
R1;R2;R3
R1-R10
R1~R10
R1–R10
C1,C3-C5
U1A/U1B
LED1
TP1
J1.1
N/A
```

## 15.2 范围展开

```text
R1-R4 → R1,R2,R3,R4
```

必须验证：

- 前缀一致；
- 范围长度有上限；
- 不把型号中的连字符当范围；
- 不把 BGA Ball 当 RefDes；
- 不跨异常大范围。

## 15.3 多单元符号

```text
U1A/U1B/U1C
```

默认归并为一个物理器件：

```json
{
  "physical_refdes": ["U1"],
  "logical_units": ["A", "B", "C"],
  "physical_count": 1
}
```

## 15.4 无 RefDes 物料

以下不能因缺少位号而被删除：

- PCB；
- 螺丝；
- 标签；
- 导热垫；
- 线束；
- 包装；
- 胶水；
- 固件；
- 服务。

---

# 16. Quantity 解析

## 16.1 Quantity Type

```text
per_assembly
total_build
minimum
scrap_adjusted
package_quantity
unknown
```

## 16.2 支持格式

```text
5
5.0
1,000
2 pcs
2/board
AR
A/R
As Required
REF
Optional
```

## 16.3 Qty 与 RefDes

对标准电子器件：

```text
refdes_physical_count == quantity_per_assembly
```

不一致时生成冲突，不自动改值。

如果 Qty 空白但 RefDes 明确：

```text
quantity = refdes count
source = inferred_from_refdes
```

必须标记推断。

## 16.4 Qty=0

Qty 0 可能表示：

- DNP；
- 当前 Variant 不装；
- 数据错误；
- 公式结果；
- Build Quantity 为 0。

不能单独决定 DNP。

---

# 17. DNP / DNI / Not Fitted

识别：

```text
DNP
DNI
DNM
NF
NP
Not Fitted
Not Populated
Do Not Place
不装
不贴
空贴
选配
```

来源：

- DNP 列；
- Qty；
- Variant；
- Notes；
- RefDes；
- 删除线或灰色样式。

删除线只能作为候选信号，不能独立决定 DNP。

输出：

```json
{
  "dnp": true,
  "dnp_reason": "variant_exclusion",
  "source": "DNP column",
  "confidence": 0.98
}
```

---

# 18. Variant BOM

Variant 可能表现为：

```text
Variant 列
多个 Qty 列
多个 DNP 列
多个 Sheet
X / 空白矩阵
颜色标记
独立文件
```

推荐输出：

```text
Base BOM + Variant Rules
```

```json
{
  "variant_rules": [
    {"variant": "EU", "included": true, "quantity": "1"},
    {"variant": "US", "included": false, "reason": "DNP"}
  ]
}
```

不要为每个 Variant 无条件复制整份 BOM。

---

# 19. 多级 BOM

层级可能来自：

- Level 列；
- 缩进；
- Item Number `1.2.3`；
- Parent Part；
- Tree-like 合并单元格；
- 子 BOM Sheet；
- 子装配型号。

输出：

```text
level
parent_line_id
subassembly_part_number
phantom
quantity_per_parent
```

不同层级中相同 RefDes 不能直接判断为重复。

---

# 20. Manufacturer 和 MPN 标准化

## 20.1 Manufacturer

只做候选标准化：

- Unicode；
- 空白；
- Alias；
- 公司后缀；
- 大小写。

正式 Manufacturer Entity ID 由下游 Resolver 确定。

## 20.2 MPN 三种表示

```text
raw
normalized_display
search_key
```

## 20.3 允许的基础清洗

- 去首尾空白；
- Unicode Normalize；
- 删除零宽字符；
- 全角转半角；
- 标准化破折号；
- 合并明显换行。

## 20.4 禁止默认执行

- 全部转大写并覆盖显示值；
- 删除所有 `/ - .`；
- 自动修改 O/0、I/1；
- 去掉 Reel/Package 后缀；
- 截断型号。

## 20.5 多型号单元格

```text
TPS62160DSGR / TPS62160DGKR
```

输出：

```text
primary_candidate
alternate_candidates
```

无法判断主次时审核。

---

# 21. Internal PN 与 MPN 区分

判断信号：

- Manufacturer 列；
- 企业内部编码规则；
- ezPLM 内部物料命中；
- 是否对应多个厂商型号；
- Header Path；
- 同列样例。

例如：

```text
RES-0402-10K-1P
```

可能是内部料号，但不能仅凭格式强制判断。

---

# 22. Description、Value 和 Package

## 22.1 Description

保存：

```text
raw_description
normalized_description
```

只做安全、可逆的基础清洗，不自由改写技术含义。

## 22.2 被动器件 Value

支持：

```text
10K
4K7
0R
100n
100nF
1u
1µF
22p
10R0
```

输出 Decimal 字符串和单位。

## 22.3 Package 与 Footprint 分开

```text
Package = QFN-32
Footprint = Package_DFN_QFN:QFN-32-1EP_5x5mm_P0.5mm
```

不得混为一列。

本 Agent 只做文本标准化，不做最终 Footprint 精确匹配。

---

# 23. Supplier、价格和动态字段

可接入：

```text
supplier
supplier_sku
unit_price
currency
moq
lead_time
stock
quote_date
```

必须标记：

- snapshot time；
- source；
- currency；
- quantity break；
- 是否过期。

本 Agent 不刷新实时价格库存。

---

# 24. 重复行和合并候选

重复类型：

```text
exact_duplicate
same_mpn_same_variant
same_mpn_different_refdes
same_internal_pn
same_refdes_conflict
same_description_only
```

默认不自动合并。

只有以下条件全部满足时，才可生成合并候选：

- 同一层级；
- 同一 Variant；
- MPN 相同；
- Package 相同或为空；
- DNP 相同；
- RefDes 不冲突；
- Notes 无关键差异。

合并后必须保留 `source_line_ids`。

---

# 25. 重复 RefDes

检查：

```text
same refdes appears on multiple active component lines
```

排除：

- U1A/U1B；
- 不同 Variant；
- 不同层级；
- DNP 与装配版本；
- 经批准的别名。

重复位号为高风险审核项。

---

# 26. 非标准表格

必须支持：

## 26.1 横向 BOM

字段在第一列，物料横向排列。

## 26.2 Key-value BOM

```text
MPN: STM32...
Qty: 1
Ref: U1
```

## 26.3 一物料多行

第一行型号，第二行描述，第三行替代料。

## 26.4 图片混合内容

截图可能同时有工具栏、标题、表格和备注，必须先检测表格区域。

---

# 27. OCR 策略

处理顺序：

```text
原生单元格
→ PDF Text Layer
→ Table Parser
→ 局部 OCR
→ 整页 OCR
```

高风险字符：

```text
O / 0
I / 1 / l
S / 5
B / 8
Z / 2
G / 6
µ / u
- / –
```

不能自动修改 MPN。

示例：

```json
{
  "raw": "TPS62I60",
  "candidates": ["TPS62160"],
  "reason": "OCR I/1 ambiguity",
  "review_required": true
}
```

OCR Evidence 保存：

- 原图；
- bbox；
- OCR 文本；
- 字符置信度；
- 预处理图；
- Engine Version。

---

# 28. Formula

同时保存：

```text
formula
cached/displayed value
```

默认不执行不可信公式。

如果 Cached Value 缺失：

```text
formula_value_unavailable
```

不得伪造计算结果。

---

# 29. Field Evidence

Excel 示例：

```json
{
  "manufacturer_part_number": {
    "source_asset_id": "uuid",
    "sheet": "BOM",
    "table_id": "table-1",
    "row": 17,
    "column": 6,
    "cell_address": "F17",
    "raw_header": "Mfr P/N",
    "raw_value": " STM32G431CBT6 ",
    "adapter": "xlsx",
    "parser_version": "xlsx-1.0.0"
  }
}
```

PDF/图片示例：

```json
{
  "page": 2,
  "bbox": [120, 240, 300, 268],
  "crop_uri": "s3://..."
}
```

---

# 30. BOM Line Observation

```json
{
  "observation_id": "uuid",
  "source_row_id": "uuid",
  "line_type": {
    "value": "component",
    "confidence": 0.98
  },
  "fields": {
    "reference_designators": {
      "raw": "C1-C4",
      "parsed": ["C1", "C2", "C3", "C4"],
      "confidence": 0.99
    },
    "quantity": {
      "raw": "4",
      "parsed": "4",
      "confidence": 0.99
    },
    "manufacturer_part_number": {
      "raw": "GRM155R71C104KA88",
      "normalized": "GRM155R71C104KA88",
      "confidence": 0.94
    }
  },
  "raw_fields": {},
  "issues": [],
  "evidence": {},
  "overall_confidence": 0.96
}
```

---

# 31. Confidence

## 31.1 字段级

```text
header_mapping_confidence
cell_parse_confidence
ocr_confidence
semantic_confidence
normalization_confidence
```

## 31.2 表格级

```text
table_detection_confidence
header_detection_confidence
column_mapping_confidence
row_classification_confidence
```

## 31.3 文档级

```text
bom_sheet_confidence
required_field_coverage
row_success_rate
conflict_rate
review_rate
```

关键字段使用加权几何平均，不使用简单平均掩盖单项低分。

---

# 32. Validation

## 32.1 结构

- 无 BOM 表；
- 多个候选表；
- 无 Header；
- 列数漂移；
- 行错位；
- 合并单元格跨数据区；
- 隐藏数据行；
- 表格裁剪不完整。

## 32.2 行

- Qty 非法；
- RefDes 无法解析；
- Qty/RefDes 不一致；
- 重复 RefDes；
- MPN 多值；
- DNP 与 Qty 冲突；
- Variant 冲突；
- 同一行多个 Manufacturer；
- Package/Footprint 混淆。

## 32.3 文档

- Revision 不明确；
- Sheet 间重复；
- Sheet 间 Variant 冲突；
- BOM 类型不确定。

---

# 33. 强制审核条件

- BOM Sheet 无法确定；
- Header Mapping 冲突；
- Part Number 无法判定内部料号或 MPN；
- MPN 来自低置信度 OCR；
- Qty 与 RefDes 不一致；
- 重复 RefDes；
- 同一 RefDes 对应不同 MPN；
- DNP 冲突；
- Variant 解析失败；
- 多级 BOM 父子关系不清；
- 两个高分表格候选；
- 关键列缺失；
- 大量隐藏行；
- Formula 无 Cached Value；
- 图片裁剪不完整；
- OCR 行列错位；
- 编码不确定；
- 多 MPN 无法判定主次。

---

# 34. 自动批准条件

```text
table confidence >= threshold
column mapping >= threshold
required fields complete
no blocking duplicate refdes
qty validation passed or approved exception
no blocking OCR ambiguity
no unresolved variant conflict
evidence completeness passed
```

---

# 35. 审核台

## 35.1 布局

```text
左侧：原文件 / Sheet / PDF / 图片
中间：识别表格与 Canonical BOM
右侧：列映射、字段候选和冲突
底部：Evidence、Rule、Version 和 History
```

## 35.2 审核模式

```text
Document Review
Table Review
Column Mapping Review
Line Review
Conflict Review
Batch Review
```

## 35.3 操作

- 选择 BOM Sheet；
- 选择表格区域；
- 指定 Header；
- 修改 Column Mapping；
- 转置；
- 合并/拆分行；
- 修改 Line Type；
- 修改 RefDes/Qty；
- 修改 MPN/Internal PN；
- 设置 DNP/Variant；
- 保留 Raw Field；
- Ignore Row；
- 创建 Alias Proposal。

## 35.4 Patch

```json
{
  "target_type": "bom_line",
  "target_id": "uuid",
  "base_version": "machine-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/part/manufacturer_part_number/normalized",
      "old_value": "TPS62I60DSG",
      "value": "TPS62160DSG"
    }
  ],
  "reason_code": "ocr_character_confusion",
  "evidence_ids": ["uuid"]
}
```

---

# 36. Rules 与 Company Profile

```text
policies/
├── intake-1.0.0.yaml
├── table-detection-1.0.0.yaml
├── header-detection-1.0.0.yaml
├── column-mapping-1.0.0.yaml
├── row-classification-1.0.0.yaml
├── refdes-1.0.0.yaml
├── quantity-1.0.0.yaml
├── dnp-1.0.0.yaml
├── variant-1.0.0.yaml
├── duplicate-1.0.0.yaml
├── review-1.0.0.yaml
├── aliases/
└── bom-profiles/
```

Company Profile 可配置：

- 常见 Sheet 名；
- Header 行；
- 企业 Column Alias；
- 内部料号模式；
- Variant 形式；
- DNP 风格；
- 特殊字段；
- 默认币种；
- Revision 位置。

Profile 只能加速，不得覆盖文件证据。

---

# 37. Pipeline

```text
接收文件
  ↓
安全检查和 SHA256
  ↓
选择 Source Adapter
  ↓
生成 Source Profile
  ↓
发现 Sheet / Page / Table
  ↓
识别 Header 和 Data Range
  ↓
Column Semantic Mapping
  ↓
Row Classification
  ↓
Raw Row / Raw Cell
  ↓
RefDes / Qty / DNP / Variant / Hierarchy
  ↓
Manufacturer / MPN / Package / Value 基础标准化
  ↓
BOM Line Observations
  ↓
Duplicate / Conflict / Validation
  ↓
Canonical BOM
  ↓
Quality Evaluation
  ↓
Auto Approve / Human Review
  ↓
发布 bom.normalized.ready
```

---

# 38. API 输入

```text
POST /api/v1/bom-normalization/jobs
```

```json
{
  "source": {
    "type": "uploaded_asset",
    "asset_id": "uuid"
  },
  "context": {
    "project_id": "uuid",
    "assembly_part_number": "PCBA-001",
    "assembly_revision": "RevC",
    "company_profile_id": null,
    "build_quantity": "1000"
  },
  "options": {
    "preferred_language": "zh-CN",
    "detect_variants": true,
    "detect_multilevel": true,
    "preserve_hidden_rows": true,
    "evaluate_formulas": false,
    "ocr_mode": "auto"
  },
  "policy_versions": {
    "intake": "intake-1.0.0",
    "column_mapping": "column-mapping-1.0.0",
    "normalization": "normalization-1.0.0",
    "review": "review-1.0.0"
  },
  "idempotency_key": "uuid"
}
```

输入类型：

```text
uploaded_asset
file_url
pasted_text
existing_document
ezplm_project_file
```

---

# 39. Agent 输出

```json
{
  "agent_id": "bom-intake-normalization",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",
  "source": {
    "asset_id": "uuid",
    "sha256": "hex",
    "filename": "BOM RevC.xlsx"
  },
  "artifacts": {
    "canonical_bom_uri": "s3://.../canonical-bom.json",
    "raw_document_uri": "s3://.../raw-document.json.zst",
    "line_observations_uri": "s3://.../observations.json.zst",
    "column_mapping_uri": "s3://.../column-mapping.json",
    "raw_field_dictionary_uri": "s3://.../raw-fields.json",
    "evidence_manifest_uri": "s3://.../evidence.json",
    "validation_report_uri": "s3://.../validation.json",
    "quality_report_uri": "s3://.../quality.json"
  },
  "summary": {
    "sheets": 4,
    "detected_tables": 2,
    "selected_bom_tables": 1,
    "source_rows": 420,
    "canonical_lines": 385,
    "component_lines": 360,
    "dnp_lines": 18,
    "unmapped_columns": 2,
    "review_items": 7
  },
  "quality": {
    "table_detection_score": 0.99,
    "column_mapping_score": 0.96,
    "required_field_coverage": 0.98,
    "row_normalization_score": 0.95,
    "overall_score": 0.96,
    "review_required": true,
    "review_reasons": [
      "duplicate_reference_designator",
      "ambiguous_part_number_column"
    ]
  }
}
```

---

# 40. 状态机

```text
RECEIVED
  ↓
SECURITY_SCANNING
  ↓
PROFILING_SOURCE
  ↓
SELECTING_ADAPTER
  ↓
EXTRACTING_RAW_DOCUMENT
  ↓
DETECTING_TABLES
  ↓
DETECTING_HEADERS
  ↓
MAPPING_COLUMNS
  ↓
CLASSIFYING_ROWS
  ↓
PARSING_FIELDS
  ↓
NORMALIZING_LINES
  ↓
DETECTING_VARIANTS
  ↓
DETECTING_HIERARCHY
  ↓
VALIDATING_QUANTITIES
  ↓
DETECTING_DUPLICATES
  ↓
BUILDING_CANONICAL_BOM
  ↓
QUALITY_EVALUATING
  ↓
STORING_RESULTS
  ↓
COMPLETED
```

分支：

```text
REVIEW_REQUIRED
PASSWORD_REQUIRED
UNSUPPORTED_FORMAT
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 41. 数据库

## 41.1 `bom_normalization_jobs`

```text
id UUID PK
asset_id UUID NOT NULL
project_id UUID NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
source_type VARCHAR NOT NULL
source_sha256 CHAR(64) NOT NULL
company_profile_id UUID NULL
options JSONB NOT NULL
policy_versions JSONB NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 41.2 `bom_normalization_results`

```text
id UUID PK
job_id UUID NOT NULL
canonical_bom_uri TEXT NOT NULL
raw_document_uri TEXT NOT NULL
line_observations_uri TEXT NOT NULL
column_mapping_uri TEXT NOT NULL
raw_field_dictionary_uri TEXT NOT NULL
evidence_manifest_uri TEXT NOT NULL
validation_report_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 41.3 `bom_table_index`

```text
id UUID PK
result_id UUID NOT NULL
table_id VARCHAR NOT NULL
source_location JSONB NOT NULL
table_type VARCHAR NOT NULL
header_rows JSONB NOT NULL
data_range JSONB NOT NULL
row_count INT NOT NULL
column_count INT NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, table_id)
```

## 41.4 `bom_line_index`

```text
id UUID PK
result_id UUID NOT NULL
line_id UUID NOT NULL
source_row_id UUID NOT NULL
line_type VARCHAR NOT NULL
level INT NOT NULL
parent_line_id UUID NULL
refdes_count INT NULL
quantity NUMERIC NULL
manufacturer_normalized VARCHAR NULL
mpn_normalized VARCHAR NULL
internal_part_number VARCHAR NULL
package_normalized VARCHAR NULL
dnp BOOLEAN NOT NULL
variant_hash CHAR(64) NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, line_id)
```

完整 Raw Fields、Evidence 和 Observation JSON 放对象存储，不塞进主数据库。

## 41.5 `bom_column_mappings`

```text
id UUID PK
result_id UUID NOT NULL
table_id VARCHAR NOT NULL
source_column VARCHAR NOT NULL
header_raw TEXT NULL
header_path TEXT NULL
target_field VARCHAR NULL
confidence NUMERIC(5,4)
alternatives JSONB NOT NULL
rule_ids JSONB NOT NULL
review_status VARCHAR NOT NULL
```

## 41.6 `bom_normalization_reviews`

```text
id UUID PK
job_id UUID NOT NULL
object_type VARCHAR NOT NULL
object_id VARCHAR NULL
review_type VARCHAR NOT NULL
severity VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
assigned_to UUID NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 42. 对象存储

```text
derived/bom-normalization/
  {source_sha256}/
    {policy_bundle_hash}/
      source/
        source-manifest.json
      raw/
        raw-document.json.zst
        sheets/
        pages/
        images/
      detection/
        source-profile.json
        table-catalog.json
        header-candidates.json
      mapping/
        column-mapping.json
        raw-field-dictionary.json
      observations/
        line-observations.json.zst
      canonical/
        canonical-bom.json
        canonical-bom.csv
      evidence/
        evidence-manifest.json
        crops/
        overlays/
      review/
        review-items.json
      reports/
        validation-report.json
        quality-report.json
      debug/
        adapter-log.json
        ocr-log.json
        row-classification.json
        selection-log.json
```

---

# 43. API

## 43.1 写接口

```text
POST /api/v1/bom-normalization/uploads
POST /api/v1/bom-normalization/jobs
POST /api/v1/bom-normalization/batches
POST /api/v1/bom-normalization/jobs/{job_id}/retry
POST /api/v1/bom-normalization/jobs/{job_id}/cancel
POST /api/v1/bom-normalization/jobs/{job_id}/rerun-table-detection
POST /api/v1/bom-normalization/jobs/{job_id}/rerun-column-mapping
POST /api/v1/bom-normalization/jobs/{job_id}/rerun-normalization
POST /api/v1/bom-normalization/reviews/{review_id}/resolve
POST /api/v1/bom-normalization/profiles
```

## 43.2 读接口

```text
GET /api/v1/bom-normalization/jobs/{job_id}
GET /api/v1/bom-normalization/jobs/{job_id}/events
GET /api/v1/bom-normalization/results/{result_id}
GET /api/v1/bom-normalization/results/{result_id}/tables
GET /api/v1/bom-normalization/results/{result_id}/columns
GET /api/v1/bom-normalization/results/{result_id}/lines
GET /api/v1/bom-normalization/results/{result_id}/raw-fields
GET /api/v1/bom-normalization/results/{result_id}/validation
GET /api/v1/bom-normalization/reviews
GET /api/v1/bom-normalization/profiles
GET /health/live
GET /health/ready
GET /metrics
```

---

# 44. 错误码

```text
SOURCE_ASSET_NOT_FOUND
SOURCE_FILE_TOO_LARGE
SOURCE_MIME_INVALID
SOURCE_ARCHIVE_BOMB
SOURCE_ENCRYPTED
SOURCE_PASSWORD_REQUIRED
SOURCE_FORMAT_UNSUPPORTED
SOURCE_ENCODING_AMBIGUOUS
SOURCE_URL_BLOCKED
SOURCE_DOWNLOAD_FAILED
WORKBOOK_PARSE_FAILED
SHEET_NOT_FOUND
BOM_TABLE_NOT_FOUND
MULTIPLE_BOM_TABLES_AMBIGUOUS
HEADER_NOT_FOUND
HEADER_MAPPING_AMBIGUOUS
COLUMN_MAPPING_FAILED
ROW_CLASSIFICATION_FAILED
REFDES_PARSE_FAILED
REFDES_RANGE_INVALID
QUANTITY_PARSE_FAILED
QUANTITY_REFDES_MISMATCH
DUPLICATE_REFDES
MPN_AMBIGUOUS
INTERNAL_PN_MPN_AMBIGUOUS
DNP_CONFLICT
VARIANT_PARSE_FAILED
HIERARCHY_PARSE_FAILED
OCR_FAILED
OCR_LOW_CONFIDENCE
FORMULA_VALUE_UNAVAILABLE
EVIDENCE_INCOMPLETE
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 45. 下游事件

```json
{
  "event_type": "bom.normalized.ready",
  "event_version": "1.0",
  "job_id": "uuid",
  "result_id": "uuid",
  "bom_id": "uuid",
  "project_id": "uuid",
  "assembly_part_number": "PCBA-001",
  "canonical_bom_uri": "s3://.../canonical-bom.json",
  "evidence_manifest_uri": "s3://.../evidence.json",
  "quality_report_uri": "s3://.../quality.json",
  "line_count": 385,
  "overall_quality": 0.96,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

下游消费条件：

```text
review_status = approved
AND required_field_coverage >= configured threshold
AND no blocking duplicate refdes
AND canonical schema valid
```

---

# 46. 可观测性

## 46.1 Prometheus

```text
bom_normalization_jobs_total{status,source_type}
bom_normalization_duration_seconds{step,source_type}
bom_source_files_total{format}
bom_detected_tables_total{type}
bom_header_detection_total{status}
bom_column_mapping_total{target_field,status}
bom_lines_total{line_type}
bom_unmapped_columns_total{header}
bom_refdes_parse_total{status}
bom_quantity_conflicts_total{type}
bom_duplicate_refdes_total
bom_dnp_lines_total
bom_variant_lines_total{variant}
bom_ocr_cells_total{status}
bom_review_total{reason,severity}
bom_auto_approval_total{profile}
bom_cache_hits_total{stage}
```

## 46.2 Dashboard

- 文件格式分布；
- 自动识别率；
- 自动批准率；
- 未映射列 Top；
- Header Alias Top；
- Qty/RefDes 冲突；
- 重复位号；
- OCR 使用率和修正率；
- Variant 检测率；
- 各客户 Profile 质量；
- 各格式处理时长；
- 审核积压。

---

# 47. Benchmark

## 47.1 表格

- BOM Sheet Detection Accuracy；
- Table Detection Precision/Recall；
- Header Row Accuracy；
- Data Range IoU；
- Multi-table Accuracy。

## 47.2 列

- Column Mapping Macro F1；
- Required Field Mapping Accuracy；
- Unknown Column Precision；
- Internal PN / MPN Disambiguation Accuracy。

## 47.3 行

- Row Type Macro F1；
- RefDes Parse Accuracy；
- RefDes Expansion Accuracy；
- Qty Accuracy；
- DNP F1；
- Variant F1；
- Hierarchy Accuracy；
- Duplicate Detection F1。

## 47.4 字段

- Manufacturer Accuracy；
- MPN Normalization Accuracy；
- Package Normalization Accuracy；
- Passive Value Accuracy；
- Raw Field Preservation Rate；
- Evidence Completeness。

## 47.5 OCR

- Cell OCR Accuracy；
- Row/Column Reconstruction Accuracy；
- MPN Exact Match Accuracy；
- OCR Ambiguity Recall。

## 47.6 端到端

- Canonical Line Exact Accuracy；
- Required Field Coverage；
- False Merge Rate；
- False Drop Rate；
- High-confidence Auto-approval Accuracy。

---

# 48. 初始质量目标

在内部人工标注集上：

```text
BOM Sheet Detection >= 99%
Table Detection F1 >= 98%
Header Detection Accuracy >= 98%
Core Column Mapping F1 >= 97%
Row Type Macro F1 >= 96%
RefDes Parse Accuracy >= 99%
Qty Parse Accuracy >= 99%
DNP F1 >= 97%
Variant F1 >= 93%
Raw Field Preservation = 100%
Evidence Completeness >= 99%
High-confidence Auto-approval Accuracy >= 98%
False Drop Rate <= 0.1%
```

扫描件、截图和原生 Excel 必须分组报告，不能只给总体平均值。

---

# 49. 测试 Fixture

公开仓库只使用合成、脱敏或授权数据。

## 49.1 Excel

1. 标准 XLSX；
2. 多 Sheet；
3. 两行 Header；
4. Merged Header；
5. Hidden Row；
6. Hidden Column；
7. Formula Qty；
8. Cached Formula；
9. Comment；
10. Named Table；
11. Filter；
12. XLSM；
13. XLS；
14. XLSB；
15. 多表；
16. 横向 BOM；
17. Costed BOM；
18. Variant BOM；
19. Multi-level；
20. Company Template。

## 49.2 CSV / Text

21. UTF-8；
22. UTF-8 BOM；
23. GBK；
24. Big5；
25. TSV；
26. Semicolon；
27. Pipe；
28. 多行字段；
29. 引号；
30. 小数逗号；
31. CSV Injection；
32. 不规则列数；
33. Markdown；
34. HTML；
35. 空格对齐。

## 49.3 PDF / Image

36. 原生 PDF；
37. 多页 PDF；
38. Repeated Header；
39. 扫描 PDF；
40. 手机截图；
41. 旋转；
42. 透视；
43. 阴影；
44. 有表格线；
45. 无表格线；
46. 多栏；
47. 中文 OCR；
48. 英文 OCR；
49. MPN OCR 混淆；
50. 裁剪不完整。

## 49.4 业务

51. RefDes Range；
52. Mixed Range；
53. U1A/U1B；
54. 无位号机械件；
55. Qty 推断；
56. Qty 冲突；
57. AR Qty；
58. DNP；
59. Qty 0 非 DNP；
60. Variant Matrix；
61. Alternate Row；
62. Subtotal；
63. Group Header；
64. Repeated Header；
65. Duplicate RefDes；
66. Same MPN Multiple Rows；
67. Multiple MPN Cell；
68. Internal PN/MPN 歧义；
69. Manufacturer Alias；
70. Package Alias；
71. Footprint；
72. Passive Value；
73. Currency；
74. Unknown Column；
75. Hidden DNP；
76. Strike-through；
77. Subassembly；
78. Raw Field Preservation；
79. Patch；
80. Company Profile。

---

# 50. 性能

## 50.1 XLSX

10,000 行目标：

- Raw Extract < 10 秒；
- Mapping + Normalize < 20 秒；
- 不含 OCR。

## 50.2 CSV

100,000 行必须流式处理，不一次性构建巨大 DataFrame。

## 50.3 PDF/OCR

按页并行，但限制并发、内存和 OCR Worker。

## 50.4 数据库

PostgreSQL 只存索引、状态和摘要，不存完整 Cell Matrix。

---

# 51. 幂等与增量

缓存键：

```text
source_sha256
+ adapter_version
+ table_detection_policy
+ column_mapping_policy
+ normalization_policy
+ company_profile_version
```

增量：

- Alias 更新：只重跑 Column Mapping 和受影响字段；
- DNP 规则更新：只重跑 DNP、Variant 和 Canonical Line；
- Header Patch：不重新读取原文件；
- Company Profile 更新：只重跑关联客户；
- 文件新 Revision：新建 BOM Version，不覆盖旧 BOM。

---

# 52. 推荐技术栈

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
S3 / R2 / MinIO
Redis + RQ/Celery（生产）
```

Adapter：

```text
XLSX/XLSM：openpyxl adapter
XLS/XLSB：独立 adapter
CSV：Python csv + encoding detection
PDF：共享 PDF Parsing Service 或 PyMuPDF/pdfplumber adapter
OCR：局部 OCR Worker
Image：OpenCV/Pillow
```

关键约束：

- Adapter 抽象比具体库更重要；
- pandas DataFrame 不作为权威数据模型；
- Raw Cell 和数据类型必须保留；
- Qty、Price 使用 Decimal；
- JSON 权威数值可使用十进制字符串。

---

# 53. 推荐仓库结构

```text
bom-intake-normalization-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── bom-intake-normalization-agent-spec.md
│   ├── canonical-bom-schema.md
│   ├── raw-document-model.md
│   ├── table-detection.md
│   ├── column-mapping.md
│   ├── refdes-and-quantity.md
│   ├── variant-and-multilevel.md
│   ├── evidence-and-review.md
│   ├── security.md
│   └── benchmark.md
├── src/
│   └── bom_normalizer/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── adapters/
│       │   ├── base.py
│       │   ├── xlsx.py
│       │   ├── xls.py
│       │   ├── xlsb.py
│       │   ├── csv.py
│       │   ├── pdf.py
│       │   ├── image.py
│       │   └── pasted_text.py
│       ├── profiling/
│       ├── detection/
│       ├── mapping/
│       ├── rows/
│       ├── fields/
│       ├── normalization/
│       ├── ocr/
│       ├── evidence/
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── schemas/
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── adapters/
│   ├── detection/
│   ├── mapping/
│   ├── rows/
│   ├── fields/
│   ├── ocr/
│   ├── security/
│   ├── review/
│   └── fixtures/
├── benchmark/
└── scripts/
```

---

# 54. Codex 分阶段实施

不要一次实现全部功能。

## Phase 0：仓库侦察和现有 BOM 模型对齐

只分析，不改业务代码：

1. 阅读 AGENTS.md；
2. 查找 ezPLM BOM、BOM Line、Material、Part、Project 和 File 表；
3. 查找 BOM 上传和导入代码；
4. 查找 Excel、CSV、PDF、OCR 处理代码；
5. 查找字段 Alias；
6. 查找 RefDes、Qty、DNP、Variant 逻辑；
7. 查找 Review/Evidence/Patch；
8. 抽样分析脱敏 BOM；
9. 输出差异和迁移方案；
10. 不创建 Migration；
11. 不安装依赖。

## Phase 1：Domain Model 与 JSON Schema

实现 Source Asset、Raw Document、Raw Cell、Table、Column Mapping、Line Observation、Canonical BOM、Evidence、Result 和 Event。

## Phase 2：CSV / TSV / Pasted Text

实现 Encoding、Delimiter、Quote、Multi-line、Markdown、HTML、Streaming 和 CSV Injection 防护。

## Phase 3：XLSX / XLSM

实现 Sheet、Cell、Formula、Cached Value、Merged、Hidden、Comment、Style、Table、Named Range 和 Macro-safe。

## Phase 4：XLS / XLSB

实现独立 Adapter、转换日志、兼容测试和大文件限制。

## Phase 5：Sheet / Table / Header Detection

实现 Sheet 分类、多表、Header、多行 Header、Data Range、Repeated Header 和 Transpose。

## Phase 6：Column Mapping

实现 Alias Registry、Header Path、Value Pattern、MPN/Internal PN 区分、Top-K 和 Company Profile。

## Phase 7：Row Classification

实现 Data、Group、Note、Subtotal、Alternate、Repeated Header、Row Group 和 Raw Fields。

## Phase 8：RefDes / Qty / DNP

实现 RefDes Range、U1A/U1B、Qty、Qty/RefDes、DNP、Duplicate RefDes 和 Review。

## Phase 9：MPN / Manufacturer / Package / Value

实现 Unicode、Search Key、Manufacturer Alias、Multi-MPN、Package、Footprint 和 Passive Value。

## Phase 10：Variant 和 Multi-level

实现 Variant Matrix、Variant Qty、Level、Parent、Subassembly、Phantom 和 Multi-sheet Link。

## Phase 11：PDF 原生表格

实现 Page、bbox、Table、Repeated Header、Evidence 和 Render。

## Phase 12：扫描件、截图和 OCR

实现 OCR Router、Crop、Rotation、Perspective、Table Reconstruction、Cell Evidence 和 Ambiguity Review。

## Phase 13：Validation、Duplicates 和 Canonical BOM

实现 Required Fields、Duplicate Candidate、Field Selection、Canonical Builder、Quality 和 Auto Approval。

## Phase 14：审核、Patch 与反馈

实现 Review API、Header/Column/Line Review、Patch、Resolved View、Alias Proposal 和 Audit。

## Phase 15：API、事件、批处理和缓存

实现 Upload、Job、Batch、Events、Retry/Cancel、Incremental、Idempotency 和 Object Storage。

## Phase 16：Benchmark、监控与生产发布

实现 Benchmark、Metrics、Dashboard、Security Hardening、Deployment、Profile Rollback 和 Disaster Recovery。

---

# 55. Codex 工作纪律

Codex 必须：

1. 原始文件和 Raw Cell 不可变；
2. 所有标准字段保留 Raw；
3. Unknown Column 不丢弃；
4. DataFrame 不作为唯一权威结构；
5. Column Mapping 不只依赖 Header 字符串；
6. Part Number 不默认等于 MPN；
7. Qty 空白不等于 0；
8. Qty 0 不自动等于 DNP；
9. 删除线不独立决定 DNP；
10. RefDes Range 有安全上限；
11. U1A/U1B 不计算成两个物理器件；
12. 无 RefDes 物料不能丢弃；
13. 不同 Variant 和 Level 不错误合并；
14. OCR 不自动修改 MPN 的 O/0、I/1；
15. 公式默认不执行；
16. 宏不得执行；
17. 文件必须做安全限制；
18. 所有标准字段必须有 Evidence；
19. Human Patch 不覆盖 Machine Result；
20. 本 Agent 不做最终 Part Resolution；
21. 规则优先，模型仅受控 fallback；
22. 不把客户真实 BOM 提交到公开测试；
23. 不伪造测试和 Benchmark；
24. 每个 Phase 输出修改文件、Schema/API、Adapter/Policy、测试、性能、安全、已知问题和下一步。

---

# 56. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/bom-intake-normalization-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第31个 Agent：

BOM Intake & Normalization Agent。

本 Agent 负责：

- 接入 Excel、CSV、PDF、扫描件、截图和粘贴文本；
- 识别 BOM Sheet、表格、表头、数据范围和行类型；
- 将非标准列映射为统一 BOM Schema；
- 保留全部原始列、原始单元格、公式、显示值、页码和 bbox；
- 解析 RefDes、Qty、DNP、Variant、Level、Manufacturer、MPN、Internal PN、Description、Value、Package 和 Footprint；
- 处理多 Sheet、多表、多行表头、重复表头、横向 BOM 和多级 BOM；
- 检查 Qty/RefDes、重复位号、DNP 和 Variant 冲突；
- 输出 BOM Line Observation 和 Canonical BOM；
- 低置信度进入审核；
- 发布 bom.normalized.ready。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. 本规格 docs/bom-intake-normalization-agent-spec.md；
3. 当前 ezPLM BOM、物料、项目、文档和上传模块；
4. 当前 Excel/CSV/PDF/OCR 导入代码；
5. 当前数据库、对象存储、任务队列、审核、权限、日志、Docker 和 CI；
6. 当前 BOM API、字段定义和历史导入模板；
7. 当前自定义字段机制；
8. 当前 Evidence、Review 和 Patch；
9. 脱敏或合成 BOM Fixture。

硬约束：

- 原始文件和 Raw Cell 不可变；
- 标准化结果不能覆盖原值；
- 所有未知列放入 raw_fields；
- 所有映射字段保存原始 header 和 cell；
- Header 语义不能只靠字符串；
- Part Number 不能默认视为 MPN；
- Qty 空白不等于 0；
- Qty 0 不自动等于 DNP；
- RefDes Range 展开必须限制范围；
- U1A/U1B 默认属于一个物理器件；
- 无 RefDes 的机械件、PCB、包装和耗材不能丢弃；
- 不同 Variant 和不同层级不能错误合并；
- OCR 不得自动修改 MPN 字符；
- Formula 默认不执行；
- Excel Macro 不执行；
- CSV 导出防止公式注入；
- 所有文件做大小、压缩比、页数、像素和超时限制；
- 所有标准字段必须有 Evidence；
- Human Patch 不覆盖 Machine Result；
- 本 Agent 不负责最终 Part Resolution；
- V1 规则优先；
- LLM 只能作为受控候选 fallback；
- 不将客户真实 BOM 放入公开测试；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 查找 BOM 上传、导入、解析、映射和保存代码；
3. 查找 BOM、BOM Line、Material、Part、Supplier、Variant 和 Project 数据表；
4. 查找现有 Excel/CSV/PDF/OCR 库及版本；
5. 查找当前字段 Alias 和导入模板；
6. 查找 RefDes、Qty、DNP、Variant 和多级 BOM 处理逻辑；
7. 查找自定义字段和 Raw Data 保存方式；
8. 查找 Evidence、Review、Patch 和 Audit；
9. 抽样分析脱敏/合成 BOM Fixture；
10. 在 docs/bom-normalization-implementation-plan.md 中生成实施计划；
11. 在 docs/canonical-bom-schema.md 中生成 Canonical Schema；
12. 在 docs/bom-raw-document-model.md 中生成 Raw Document/Cell 模型；
13. 在 docs/bom-column-mapping-design.md 中生成列映射方案；
14. 在 docs/bom-refdes-quantity-variant-design.md 中生成 RefDes、Qty、DNP、Variant 和 Multi-level 方案；
15. 在 docs/bom-security-design.md 中生成文件安全方案；
16. 在 docs/bom-normalization-migration-plan.md 中生成旧数据迁移方案；
17. 在 docs/bom-normalization-benchmark-plan.md 中生成 Benchmark；
18. 给出拟新增、拟修改和拟复用文件；
19. 给出 Phase 1 精确范围；
20. 不修改业务代码；
21. 不创建数据库 Migration；
22. 不安装依赖；
23. 运行当前仓库已有 lint、type check、test 和 build；
24. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- 当前 BOM 数据模型；
- 当前导入流程；
- 可复用代码；
- 缺失能力；
- Canonical BOM Schema；
- Raw Document/Cell；
- Format Adapter；
- Table/Header Detection；
- Column Mapping；
- Row Classification；
- RefDes/Qty/DNP/Variant；
- Evidence/Review；
- 文件安全；
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
继续实现 BOM Intake & Normalization Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 规格；
3. 阅读 BOM Implementation Plan；
4. 阅读 Canonical BOM Schema；
5. 阅读 Raw Document Model；
6. 阅读 Column Mapping、Security 和 Benchmark；
7. 检查上一阶段代码和测试；
8. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Raw 不可变；
- 所有标准值保留 raw；
- Unknown Column 不丢；
- Evidence per field；
- Decimal；
- 不执行宏；
- 不默认执行公式；
- 不自动修正 OCR MPN；
- 不错误合并 Variant/Level；
- 不做最终 Part Resolution；
- 不覆盖人工 Patch；
- 不使用客户真实 BOM 公开测试；
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
- Adapter/Policy/Alias 变化；
- 测试命令和真实结果；
- Benchmark；
- 性能；
- 安全结果；
- 已知限制；
- 下一阶段建议。
```

---

# 58. MVP 演示流程

1. 上传标准 XLSX；
2. 找到 BOM Sheet；
3. 识别两行 Header；
4. 映射“位号、用量、厂家、型号、规格、封装”；
5. 展开 `R1-R4,R8`；
6. 检查 Qty=5；
7. 保存原始 Cell；
8. 输出 Canonical BOM；
9. 上传含隐藏 DNP 行的 XLSX；
10. 正确保留并标记；
11. 上传 GBK CSV；
12. 检测编码和分隔符；
13. 上传原生 PDF BOM；
14. 保存 page+bbox；
15. 上传手机截图；
16. OCR 表格；
17. 将 `TPS62I60` 标记为 I/1 歧义；
18. 用户审核修正；
19. 上传 Variant BOM；
20. 生成 Base BOM + Variant Rules；
21. 上传 Multi-level BOM；
22. 建立 Parent/Child；
23. 发现 Duplicate RefDes；
24. 阻止 Auto Approval；
25. 人工解决；
26. 发布 `bom.normalized.ready`；
27. 下游 Part Matching Agent 开始解析型号。

---

# 59. 建议上线顺序

第一阶段：

```text
XLSX
CSV/TSV
标准 RefDes
Qty
DNP
基础 Variant
核心 Column Mapping
Raw Fields
Evidence
Review
```

第二阶段：

```text
原生 PDF
Multi-level BOM
Multi-sheet Variant
Company Profile
```

第三阶段：

```text
扫描 PDF
截图
手机照片
复杂 OCR
横向 BOM
Key-value BOM
```

原因：

- 企业 BOM 主体通常是 Excel/CSV；
- 原生格式准确率高；
- 可以先积累 Column Alias 和 Company Profile；
- OCR 应在 Canonical Schema 和审核流程稳定后接入；
- 避免首版被低质量图片拖垮交付。
