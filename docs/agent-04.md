# 章节、表格与图片定位 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Datasheet Structure & Visual Asset Locator Agent  
> 中文名：Datasheet 章节、表格与图片定位 Agent  
> 版本：V1.0  
> 定位：规则优先、结构分析与轻量视觉模型辅助的基础 Agent  
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent（可选但推荐）
>
> 下游：
> - 参数抽取与单位归一 Agent
> - 引脚、封装与订货型号 Agent
> - 框图与应用电路理解 Agent
> - KiCad 原理图符号生成 Agent
> - 封装与 3D 模型映射 Agent
> - Datasheet 证据锚定与人工审核 Agent
>
> 目标读者：产品负责人、后端工程师、文档解析工程师、算法工程师、数据工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的 Datasheet 文档结构定位 Agent。

该 Agent 不重新完成整本 PDF 解析，而是消费第二个 Agent 输出的 Canonical Document IR，在器件分类和 Schema 提示的辅助下，定位 Datasheet 中的关键章节、表格和视觉资产。

V1 重点定位：

## 1.1 关键章节

- Features；
- General Description / Description；
- Applications；
- Functional Block Diagram；
- Absolute Maximum Ratings；
- Recommended Operating Conditions；
- Electrical Characteristics；
- Typical Performance Characteristics；
- Pin Configuration；
- Pin Description / Pin Functions；
- Detailed Description；
- Application Information；
- Typical Application；
- Power Supply Recommendations；
- Layout Guidelines；
- Device and Documentation Support；
- Package Information；
- Mechanical Data / Package Dimensions；
- Ordering Information；
- Package Option Addendum；
- Revision History。

## 1.2 关键表格

- Electrical Characteristics；
- Recommended Operating Conditions；
- Absolute Maximum Ratings；
- Pin Description / Pin Functions；
- Ordering Information；
- Package / Mechanical Dimensions；
- Thermal Characteristics；
- Timing Characteristics；
- Switching Characteristics；
- Register Map；
- Device Comparison；
- Feature Comparison；
- Package Variant / Orderable Part Number；
- Typical Characteristics 数据表；
- Revision History。

## 1.3 关键视觉资产

V1 必须识别并提取：

- Functional Block Diagram；
- Application Example / Typical Application Schematic；
- Package Outline / Mechanical Drawing；
- Package Top View / Bottom View；
- Pinout / Pin Configuration Diagram。

建议同时保留可扩展分类：

- Internal Block Diagram；
- System Block Diagram；
- Reference Design；
- Timing Diagram；
- State Diagram；
- Flow Chart；
- PCB Layout Example；
- Recommended Layout；
- Thermal Diagram；
- Typical Characteristic Plot；
- Waveform；
- Test Circuit；
- Package Marking；
- Land Pattern；
- Tape and Reel Drawing；
- Product Photo；
- Logo / Decoration / Irrelevant Image。

最终输出：

```text
SectionMap
TableCatalog
FigureCatalog
ExtractionArtifacts
EvidenceAnchors
QualityReport
```

供后续参数、引脚、封装、图片理解和人工审核 Agent 直接消费。

---

# 2. Agent 的核心职责

本 Agent 包含五个子能力：

```text
章节候选生成
    ↓
章节规范化与边界定位
    ↓
表格分类与跨页合并
    ↓
图片/图形区域分类与提取
    ↓
证据、质量与人工审核
```

## 2.1 章节定位

识别标题、章节层级、章节起止页和起止区块，并将不同厂商的标题归一化到统一章节类型。

例如：

```text
ELECTRICAL CHARACTERISTICS
Electrical Specifications
Electrical Characteristics at TA = 25°C
DC Electrical Characteristics
AC Characteristics
```

统一映射为：

```text
section_type = electrical_characteristics
```

## 2.2 表格定位

识别目标表格类型、表题、所属章节、页码范围、bbox、表头、跨页关系以及与器件型号/封装的适用关系。

## 2.3 图片定位

识别视觉区域类型，并正确提取完整图像。

必须处理：

- PDF 内嵌栅格图片；
- 矢量图；
- 多个矢量与文字对象组成的组合图；
- 同一图片被解析器切成多个碎片；
- 图片跨越多个布局区块；
- 图注与图片分离；
- 图中带文字；
- 页面旋转；
- 图形靠近页边；
- 图形上方或下方紧邻正文；
- 多图并列；
- 单页包含多个封装视图；
- 一个 Package Drawing 跨多页。

## 2.4 证据锚定

每个定位结果必须保留：

- page number；
- bbox；
- block_id；
- source parser；
- source parser run；
- heading text；
- caption text；
- table title；
- surrounding text；
- 匹配规则；
- 置信度；
- 原始 Canonical IR 引用；
- 原始 PDF 截图；
- 裁剪图；
- 分类模型版本。

## 2.5 输出给下游的执行计划

例如 Electrical Characteristics 定位完成后，输出：

```json
{
  "target": "electrical_characteristics",
  "section_ids": ["sec-17"],
  "table_ids": ["tbl-22", "tbl-23"],
  "page_ranges": ["8-13"],
  "preferred_sources": ["structured_table", "native_text"],
  "quality": 0.94
}
```

后续参数抽取 Agent 无需再次扫描整本 Datasheet。

---

# 3. 与前三个 Agent 的边界

## 3.1 Datasheet Asset Ingestion Agent

负责：

- PDF 下载和上传；
- SHA256；
- 去重；
- 文档版本；
- 文件来源；
- Part 与 Datasheet 初步关联。

本 Agent不得重新下载 PDF，不建立第二套文档版本体系。

## 3.2 PDF Parsing & OCR Routing Agent

负责：

- Docling、MinerU、PaddleOCR 等解析；
- Canonical Document IR；
- 页面、区块、表格、图片、标题、bbox；
- 原始引擎产物；
- PDF 坐标统一；
- 解析质量。

本 Agent优先使用 Canonical IR，不直接绑定 Docling 或 MinerU 专有对象。

仅在需要生成视觉裁剪时读取原始 PDF 或页面图像。

## 3.3 Component Classification & Schema Routing Agent

可提供：

- primary_category；
- schema；
- section_hints；
- table_hints；
- parameter signatures；
- package rules；
- pin role rules。

本 Agent即使没有分类结果，也应能以通用 Datasheet 规则运行。

有分类结果时，可提升定位精度。

例如：

```text
MOSFET
→ 优先查找 Static Characteristics、Dynamic Characteristics、Typical Characteristics

MCU
→ 优先查找 Memory Map、Pinout、Alternate Functions、Electrical Characteristics

运放
→ 优先查找 Electrical Characteristics、Typical Performance Characteristics、Application Information
```

## 3.4 本 Agent 不负责

V1 不负责：

- 抽取参数最终数值；
- 参数单位归一；
- 推断引脚电气属性；
- 理解框图中各功能块的工程语义；
- 把应用原理图转换成 Netlist；
- 识别封装尺寸数值并生成 Footprint；
- 生成 KiCad 文件；
- 使用大模型重画图片；
- 修改原始 PDF；
- 用 OCR 猜测页面上不存在的内容。

---

# 4. 设计原则

## 4.1 Canonical IR 优先

定位流程应优先使用：

- document tree；
- heading blocks；
- table blocks；
- figure blocks；
- captions；
- reading order；
- bbox；
- page dimensions；
- parser provenance。

不得为了定位章节再次对整本 PDF 做完整 OCR 或完整解析。

## 4.2 规则优先，模型辅助

建议优先顺序：

1. Canonical IR 的结构标签；
2. 目录 TOC；
3. 标题层级；
4. 标题词典和正则；
5. 表题和图题；
6. 章节上下文；
7. 表头/列签名；
8. 图片周边文字；
9. 局部 OCR；
10. 轻量文本分类；
11. 轻量视觉分类；
12. 人工审核。

V1 默认不依赖外部通用大模型。

## 4.3 章节、表格、图片是三个不同对象

不得把：

```text
Electrical Characteristics 章节
```

和：

```text
Electrical Characteristics 表格
```

混为同一条记录。

一个章节可以包含多个表格和图片。

一个表格可以跨页。

一个图片可以属于章节，也可以位于附录。

## 4.4 标题定位与章节边界分离

标题识别回答：

> 这个标题是什么？

章节边界回答：

> 从哪个区块开始，到哪个区块结束？

即使标题分类正确，也必须单独计算章节结束位置。

## 4.5 图片提取采用“双通道”

### 通道 A：原始对象提取

适用于：

- 单一完整的内嵌 PNG/JPEG；
- 未被切片；
- 分辨率足够；
- 不需要周围矢量和文字。

### 通道 B：区域渲染提取

适用于：

- 矢量框图；
- 原理图；
- 封装图；
- 多对象组合图；
- 图片中含 PDF 文字对象；
- 解析器将图切成碎片；
- 原始对象缺少标注。

最终可同时保存：

```text
raw_embedded_asset
rendered_composite_asset
```

下游默认使用质量更高且完整的版本。

## 4.6 裁剪完整性优先于“紧贴边缘”

对工程图，错误裁剪比多留少量白边更危险。

默认策略：

1. 根据布局区域生成初始 bbox；
2. 合并附近的图形、矢量、文本标签；
3. 按页面尺寸增加安全 margin；
4. 检查边界是否切过线条、文字或图形；
5. 必要时逐步扩展；
6. 避免吸入上方标题或下方正文；
7. 保存原始 bbox、扩展 bbox 和裁剪决策。

## 4.7 不把 Typical Characteristics 曲线误判为框图

必须区分：

- block diagram；
- application schematic；
- package drawing；
- characteristic plot；
- timing diagram；
- decorative image。

不能因为图片含大量线条就判为应用原理图。

## 4.8 所有规则与词典版本化

以下内容必须版本化：

- section taxonomy；
- section aliases；
- table signatures；
- figure taxonomy；
- caption rules；
- crop rules；
- manufacturer profiles；
- category-specific hints；
- visual model。

## 4.9 不确定时保留候选

低置信度不自动删除。

输出：

```text
candidate_types
confidence
review_required
```

---

# 5. 标准章节分类体系

建议建立 `DatasheetSectionTaxonomy`。

## 5.1 文档前置信息

```text
cover
title
product_summary
features
applications
description
table_of_contents
revision_summary
```

## 5.2 规格与限制

```text
absolute_maximum_ratings
recommended_operating_conditions
electrical_characteristics
dc_characteristics
ac_characteristics
switching_characteristics
timing_characteristics
thermal_characteristics
typical_characteristics
performance_curves
```

## 5.3 器件结构

```text
functional_block_diagram
internal_block_diagram
pin_configuration
pin_description
pin_functions
signal_description
functional_description
detailed_description
register_description
memory_map
```

## 5.4 应用与设计

```text
application_information
typical_application
application_circuit
design_requirements
design_procedure
power_supply_recommendations
layout_guidelines
pcb_layout_example
reference_design
test_circuit
```

## 5.5 订货与封装

```text
ordering_information
device_comparison
package_information
package_dimensions
mechanical_data
land_pattern
package_marking
tape_and_reel
thermal_pad
package_option_addendum
```

## 5.6 合规与支持

```text
quality
reliability
compliance
environmental
documentation_support
related_products
legal_notice
revision_history
```

## 5.7 未知

```text
unknown_section
```

---

# 6. 厂商标题别名

不同厂商的标题体系不同，必须支持厂商 Profile。

示例：

```yaml
manufacturer: texas_instruments
aliases:
  electrical_characteristics:
    - Electrical Characteristics
    - Electrical Characteristics:*
  pin_description:
    - Pin Functions
    - Terminal Functions
  package_dimensions:
    - Mechanical, Packaging, and Orderable Information
    - Package Option Addendum
```

```yaml
manufacturer: analog_devices
aliases:
  features:
    - Features
  description:
    - General Description
  pin_description:
    - Pin Configuration and Function Descriptions
  electrical_characteristics:
    - Specifications
  typical_characteristics:
    - Typical Performance Characteristics
  package_dimensions:
    - Outline Dimensions
  ordering_information:
    - Ordering Guide
```

```yaml
manufacturer: stmicroelectronics
aliases:
  features:
    - Features
  description:
    - Description
  pin_description:
    - Pinouts and pin description
  electrical_characteristics:
    - Electrical characteristics
  package_dimensions:
    - Package information
  ordering_information:
    - Ordering information
```

所有厂商规则必须允许：

- 通用规则继承；
- 厂商特定 override；
- 文档系列特定 override；
- 规则优先级；
- 生效版本。

---

# 7. 章节定位流程

```text
加载 Canonical IR
    ↓
过滤页眉页脚和噪声
    ↓
提取标题候选
    ↓
读取 TOC 候选
    ↓
标题标准化
    ↓
词典/正则分类
    ↓
上下文分类
    ↓
轻量模型补充（可选）
    ↓
层级修复
    ↓
章节边界计算
    ↓
重叠/嵌套处理
    ↓
质量评分
```

---

# 8. 标题候选生成

标题候选来源：

- Canonical IR 中 `heading`；
- `title`；
- 粗体、大字号短文本；
- 编号标题；
- TOC 条目；
- 页顶重复但非页眉的章节名；
- 全大写短文本；
- 独占一行文本；
- 位于表格或图片上方的标题。

## 8.1 特征

```text
block_type
font_size
font_weight
text_length
uppercase_ratio
numbering_pattern
left_indent
vertical_spacing_before
vertical_spacing_after
page_position
toc_match
neighbor_block_types
heading_level
```

## 8.2 编号格式

支持：

```text
1
1.1
1.1.1
2-
A.
Appendix A
Section 5
5 Electrical Characteristics
5.1 DC Characteristics
```

## 8.3 噪声过滤

过滤：

- 页眉；
- 页脚；
- 页码；
- 文档编号；
- 版权；
- 网站地址；
- 公司 Logo；
- 重复免责声明；
- 表格重复列头；
- 图片内部文本；
- 水印。

---

# 9. 章节标题分类

## 9.1 标准化

```text
Unicode normalize
→ 去除编号
→ 去除多余标点
→ 合并空格
→ 大小写统一
→ 保留必要缩写
```

## 9.2 规则优先级

1. 厂商精确标题映射；
2. 通用精确标题；
3. 厂商正则；
4. 通用正则；
5. 关键词组合；
6. 上下文；
7. 文本分类模型；
8. unknown。

## 9.3 负面规则

例如：

```text
“Features” 出现在产品对比表的一列
```

不能作为章节标题。

```text
“Electrical Characteristics” 出现在 TOC
```

TOC 条目本身不是实际章节起点，但可作为定位辅助。

```text
“Package” 出现在正文句子
```

不能判为 Package 章节。

---

# 10. 章节边界算法

## 10.1 基本规则

一个章节从标题区块开始，到以下位置结束：

- 下一个同级或更高级标题之前；
- 文档结束；
- 附录切换；
- 厂商定义的章节终止标记。

## 10.2 嵌套章节

例如：

```text
6 Electrical Characteristics
6.1 Absolute Maximum Ratings
6.2 Recommended Operating Conditions
6.3 Electrical Characteristics
6.4 Typical Characteristics
```

应输出：

```text
Electrical Characteristics 父章节
├── Absolute Maximum Ratings
├── Recommended Operating Conditions
├── Electrical Characteristics
└── Typical Characteristics
```

## 10.3 标题层级修复

解析器可能把所有标题都识别为同一级。

可根据以下信息修复：

- 编号深度；
- 字号；
- 粗体；
- 缩进；
- TOC 层级；
- 文档上下文；
- 厂商格式模板。

## 10.4 章节跨页

保存：

```text
start_page
start_block_id
start_bbox
end_page
end_block_id
end_bbox
contained_block_ids
contained_table_ids
contained_figure_ids
```

默认不把整段正文复制进数据库，只保存 IR 引用与对象存储 URI。

---

# 11. 表格分类体系

建议 `DatasheetTableTaxonomy`：

```text
electrical_characteristics
absolute_maximum_ratings
recommended_operating_conditions
dc_characteristics
ac_characteristics
switching_characteristics
timing_characteristics
thermal_characteristics
pin_description
pin_alternate_function
ordering_information
package_dimensions
package_variants
device_comparison
feature_comparison
register_map
memory_map
typical_characteristics
revision_history
truth_table
state_table
unknown_table
```

---

# 12. 表格候选和分类

表格候选来自 Canonical IR 的 table blocks。

若解析器漏表，可使用：

- 对齐文本；
- 横竖线；
- 密集数值；
- 重复列模式；
- 表题；
- 单元格区域；
- OCR table detection。

但 V1 不应重新对所有页面运行完整表格模型，只对高价值漏检候选页局部回退。

## 12.1 表格分类证据

- 所属章节；
- 表题；
- 表格上方文本；
- 表头；
- 第一列参数名；
- 单位列；
- 行列数；
- 数值密度；
- 合并单元格；
- 周边标题；
- Schema table hints；
- 厂商 Profile。

## 12.2 参数表列签名

Electrical Characteristics 常见表头：

```text
PARAMETER
SYMBOL
TEST CONDITIONS
MIN
TYP
MAX
UNIT
```

Pin Description 常见表头：

```text
PIN
NAME
NUMBER
TYPE
DESCRIPTION
```

Ordering Information 常见表头：

```text
ORDERABLE PART NUMBER
PACKAGE
PACKAGE MARKING
PINS
QUANTITY
TEMPERATURE RANGE
STATUS
```

Package Dimensions 常见表头：

```text
SYMBOL
MIN
NOM
MAX
MILLIMETERS
INCHES
```

## 12.3 表格分类评分

```text
table_score =
  section_context_score
  + caption_score
  + header_signature_score
  + first_column_signature_score
  + numeric_pattern_score
  + schema_hint_score
  - negative_penalty
```

---

# 13. 跨页表格处理

## 13.1 跨页判断

连续页面的表格满足以下特征时，可视为同一逻辑表格：

- 列数一致；
- 列 x 坐标近似一致；
- 表头重复；
- 上一页末尾无完整终止；
- 下一页出现 continued；
- 标题相同；
- 所属章节相同；
- 参数行语义连续。

## 13.2 输出方式

不强制物理合并原始单元格对象。

建议输出：

```json
{
  "logical_table_id": "lt-12",
  "fragments": [
    "p8-table-1",
    "p9-table-1"
  ],
  "page_range": "8-9",
  "header_strategy": "first_header_plus_repeated_headers",
  "continuation_confidence": 0.96
}
```

后续参数抽取 Agent 可按逻辑表格读取。

## 13.3 禁止错误合并

不同表格即使列结构相同，也不能仅凭列数合并。

必须结合：

- 标题；
- 参数连续性；
- 页面距离；
- 章节；
- continued 标记。

---

# 14. 视觉资产分类体系

建议 `DatasheetFigureTaxonomy`：

```text
functional_block_diagram
internal_block_diagram
system_block_diagram
application_schematic
typical_application
test_circuit
reference_design
pinout_diagram
package_top_view
package_bottom_view
package_outline
package_dimensions
land_pattern
pcb_layout_example
recommended_layout
tape_and_reel
package_marking
timing_diagram
waveform
state_diagram
flow_chart
thermal_diagram
characteristic_plot
chart
product_photo
logo
decoration
unknown_figure
```

---

# 15. 图片/图形候选生成

候选来源：

- Canonical IR `figure`；
- `picture`；
- `chart`；
- 大型矢量图形区域；
- 多个相邻小图组合；
- 图片＋图注；
- 图形＋PDF 文本对象；
- 章节下唯一大型视觉区域；
- 表格解析器误判的图形区域。

## 15.1 候选聚合

一个完整框图可能由：

- 多个矩形；
- 箭头；
- 连接线；
- 文本标签；
- 少量栅格图标。

这些对象应通过空间聚类形成一个候选区域。

聚合考虑：

```text
bbox 距离
重叠
共同 caption
共同背景
线条连接
阅读顺序
同一章节
空白边界
```

---

# 16. 视觉资产分类方法

## 16.1 文本证据

图题或附近文本：

```text
Functional Block Diagram
Block Diagram
Typical Application
Application Circuit
Simplified Schematic
Package Outline
Outline Dimensions
Pin Configuration
Top View
Bottom View
Recommended Land Pattern
```

## 16.2 上下文证据

- 所属章节；
- 前后标题；
- 图注；
- 页码位置；
- 同页表格；
- 章节类型；
- Schema hints。

## 16.3 视觉结构特征

### 框图

- 多个矩形块；
- 箭头或连接线；
- 文本标签；
- 层级或信号流；
- 较少电子符号。

### 应用原理图

- 电阻、电容、二极管、晶体管、IC 符号；
- 网络连接线；
- 电源符号；
- 位号；
- 元件值；
- 输入/输出标签。

### 封装图

- 尺寸标注；
- 箭头；
- 公差；
- Top/Side/Bottom View；
- A、A1、D、E、e 等机械符号；
- mm/inch；
- 引脚编号；
- JEDEC/EIAJ 标记。

### Pinout 图

- 中央器件矩形或封装轮廓；
- 四周引脚；
- Pin 1 标记；
- Top View / Bottom View；
- 引脚名和编号。

### 特性曲线

- x/y 坐标轴；
- 网格；
- 多条曲线；
- 图例；
- 单位刻度。

## 16.4 模型策略

V1 可先采用：

- caption/heading 规则；
- OCR 文本；
- 图像结构特征；
- 轻量分类器。

V1.1 可训练：

- CLIP embedding + 线性分类器；
- MobileNet/EfficientNet；
- 视觉 Transformer 小模型；
- 目标检测模型区分图、图注、子图。

外部通用 VLM 默认不进入生产路径。

---

# 17. 局部 OCR

即使原 PDF 为原生数字 PDF，图内部文字也可能是：

- 栅格化；
- 矢量轮廓；
- 无 ToUnicode；
- 与图分离的文字对象。

对候选视觉区域可执行局部 OCR。

局部 OCR 用途：

- 图分类；
- 图注关联；
- 完整性检查；
- 封装图关键词检测；
- 原理图元件标签检测。

局部 OCR 结果必须与正文文本分离：

```text
source = figure_region_ocr
```

不能直接混入正文 Canonical IR。

---

# 18. 图片提取策略

## 18.1 原始对象提取

保存：

```text
object_id
image_format
pixel_size
color_space
original_bbox
source_page
source_parser
image_sha256
```

若同一图片对象被重复引用，使用哈希去重。

## 18.2 区域渲染

默认：

- 200–300 DPI；
- 工程细节图建议 300 DPI；
- 大图根据像素上限自适应；
- PNG；
- 不使用 JPEG 破坏细线和文字。

配置：

```yaml
render:
  default_dpi: 240
  engineering_diagram_dpi: 300
  max_pixels: 40000000
  format: png
  alpha: false
```

## 18.3 初始 bbox

初始 bbox 来源：

- parser figure bbox；
- 聚合后的图形区域；
- caption 关联区域；
- 章节内视觉候选区域。

## 18.4 安全扩边

```yaml
crop:
  base_margin_pt: 6
  relative_margin: 0.01
  max_expand_iterations: 4
  expand_step_pt: 4
  include_caption: false
  save_caption_separately: true
```

框图、应用图、封装图默认：

- 图像主体单独保存；
- 图注单独保存；
- 可额外保存带图注版本；
- 不把上方章节正文纳入主图。

## 18.5 边界切割检测

检查 bbox 边缘是否存在：

- 黑色线段穿过边界；
- 文本 glyph 被截断；
- 连线延伸到边界外；
- 箭头被截断；
- 尺寸标注被截断；
- 图像对象被裁半；
- OCR 字符靠近边界。

若命中，逐步扩展。

## 18.6 正文污染检测

检查扩展区域是否吸入：

- 连续多行正文；
- 下一个章节标题；
- 页眉；
- 页脚；
- 另一幅图；
- 表格。

若正文污染明显，回退到较小 bbox 或切分。

## 18.7 多图并列

一行存在 A/B/C 多个子图时：

- 保留整组图；
- 若有独立子图标记，可额外输出子图；
- 保存 parent_figure_id；
- 不默认只截第一幅。

---

# 19. 图注关联

## 19.1 图注候选

支持：

```text
Figure 1.
Fig. 2.
Figure 3-1.
Typical Application
Functional Block Diagram
```

有些厂商无 `Figure` 前缀，只有标题。

## 19.2 图注与图关联

评分依据：

- 垂直距离；
- 水平重叠；
- 同页；
- reading order；
- 无其他图阻隔；
- 图号顺序；
- 标题关键词；
- 所属章节；
- 字体风格。

## 19.3 多图共享图注

支持：

```text
Figure 10. (a) Top View, (b) Side View, (c) Bottom View
```

---

# 20. 封装图专项规则

Package 信息通常最容易提取错位，必须单独设计。

## 20.1 类型

```text
package_outline
mechanical_dimensions
top_view
bottom_view
side_view
land_pattern
thermal_pad
package_marking
tape_and_reel
```

## 20.2 适用型号与封装关联

记录：

```text
package_name
package_code
pin_count
ordering_codes
applicable_part_ids
evidence
```

V1 不要求抽取全部尺寸值，但必须保留图、表和适用关系候选。

## 20.3 一页多封装

若一页包含多个封装：

- 先识别封装标题；
- 按白边和标题切分；
- 每个封装生成独立 Figure；
- 页面整体作为 parent asset 保留；
- 低置信度进入审核。

## 20.4 Package Drawing 跨页

例如：

```text
第一页：Package Outline
第二页：Land Pattern
第三页：Tape and Reel
```

建立：

```text
package_asset_group
```

而不是拼成一张超长图。

---

# 21. 应用示例图专项规则

## 21.1 分类

```text
typical_application_schematic
simplified_schematic
test_circuit
reference_design
application_block_diagram
pcb_layout_example
```

## 21.2 避免误判

以下不应判为应用原理图：

- 内部功能框图；
- 等效电路；
- 测试夹具；
- 时序图；
- 曲线图；
- 封装图；
- Pinout；
- 外部网页截图。

## 21.3 应用图完整性

应用图常与以下内容相连：

- 元件值；
- 设计公式；
- 条件说明；
- 图注；
- 输入输出标签。

主图应保留图内元件值和标签，但不必将下方长篇设计说明全部裁入。

---

# 22. 框图专项规则

## 22.1 类型

```text
functional_block_diagram
internal_block_diagram
system_block_diagram
application_block_diagram
signal_chain_diagram
power_tree
```

## 22.2 组合图形

框图经常全部由 PDF vector primitives 构成。

因此：

- 不能只依赖 `PictureItem`；
- 必须允许从页面绘图对象建立候选；
- 必须将图内文字一起渲染；
- 必须检查箭头和连接线完整性。

---

# 23. 定位结果数据结构

## 23.1 SectionMap

```json
{
  "section_id": "sec-17",
  "section_type": "electrical_characteristics",
  "title": "Electrical Characteristics",
  "normalized_title": "electrical characteristics",
  "level": 2,
  "parent_section_id": "sec-15",
  "start": {
    "page": 8,
    "block_id": "p8-h2-1",
    "bbox": [50, 720, 560, 760]
  },
  "end": {
    "page": 13,
    "block_id": "p13-b44",
    "bbox": [50, 80, 560, 110]
  },
  "page_range": "8-13",
  "contained_table_ids": ["tbl-22", "tbl-23"],
  "contained_figure_ids": [],
  "classification": {
    "confidence": 0.98,
    "rule_ids": ["ti.section.electrical.001"],
    "evidence": []
  }
}
```

## 23.2 TableCatalog

```json
{
  "table_id": "tbl-22",
  "logical_table_id": "lt-7",
  "table_type": "electrical_characteristics",
  "section_id": "sec-17",
  "title": "Electrical Characteristics",
  "page": 8,
  "page_range": "8-10",
  "bbox": [40, 70, 570, 690],
  "fragment_ids": [
    "p8-table-1",
    "p9-table-1",
    "p10-table-1"
  ],
  "header_signature": [
    "PARAMETER",
    "TEST CONDITIONS",
    "MIN",
    "TYP",
    "MAX",
    "UNIT"
  ],
  "classification": {
    "confidence": 0.96,
    "rule_ids": ["table.electrical.signature.001"]
  },
  "quality": {
    "structure_score": 0.92,
    "continuation_score": 0.95
  }
}
```

## 23.3 FigureCatalog

```json
{
  "figure_id": "fig-14",
  "figure_type": "application_schematic",
  "section_id": "sec-29",
  "page": 18,
  "source_bbox": [62, 180, 548, 620],
  "expanded_bbox": [56, 174, 554, 626],
  "caption": {
    "text": "Figure 23. Typical Application Circuit",
    "block_id": "p18-cap-2",
    "bbox": [110, 150, 500, 172]
  },
  "classification": {
    "confidence": 0.94,
    "candidate_types": [
      {
        "type": "application_schematic",
        "score": 0.94
      },
      {
        "type": "test_circuit",
        "score": 0.31
      }
    ],
    "rule_ids": [
      "caption.typical_application.001",
      "vision.schematic.structure.001"
    ]
  },
  "assets": {
    "rendered_uri": "s3://.../fig-14.png",
    "rendered_with_caption_uri": "s3://.../fig-14-caption.png",
    "raw_object_uris": [],
    "thumbnail_uri": "s3://.../fig-14-thumb.png"
  },
  "crop_quality": {
    "score": 0.97,
    "clipped_edge_detected": false,
    "body_text_contamination": false,
    "expansion_iterations": 1
  },
  "ocr_uri": "s3://.../fig-14-ocr.json"
}
```

---

# 24. Agent 输入

## 24.1 事件输入

首选订阅：

```json
{
  "event_type": "component.schema.ready",
  "event_version": "1.0",
  "part_id": "uuid",
  "document_id": "uuid",
  "version_id": "uuid",
  "primary_category": "ic.analog.opamp.general",
  "primary_schema": {
    "schema_id": "component.opamp.general.v1",
    "schema_version": "1.0.0"
  },
  "extraction_plan_uri": "s3://...",
  "review_status": "approved"
}
```

同时读取对应的：

```text
datasheet.parse.ready
```

若分类 Agent 尚未完成，也允许以 `datasheet.parse.ready` 单独触发通用定位。

## 24.2 REST 输入

`POST /api/v1/datasheet-locator/jobs`

```json
{
  "document_id": "uuid",
  "version_id": "uuid",
  "part_ids": ["uuid"],
  "parse_result_id": "uuid",
  "canonical_ir_uri": "s3://...",
  "source_pdf_uri": "s3://...",
  "component_category": "ic.analog.opamp.general",
  "schema_id": "component.opamp.general.v1",
  "extraction_plan_uri": "s3://...",
  "mode": "auto",
  "targets": [
    "sections",
    "tables",
    "figures"
  ],
  "required_section_types": [
    "features",
    "electrical_characteristics",
    "pin_description",
    "package_information",
    "ordering_information"
  ],
  "required_figure_types": [
    "functional_block_diagram",
    "application_schematic",
    "package_outline"
  ],
  "locator_policy_version": "locator-1.0.0",
  "idempotency_key": "uuid"
}
```

`mode`：

```text
auto
sections_only
tables_only
figures_only
targeted
review_only
benchmark
```

---

# 25. Agent 输出

```json
{
  "agent_id": "datasheet-structure-visual-locator",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",
  "source": {
    "document_id": "uuid",
    "version_id": "uuid",
    "parse_result_id": "uuid",
    "part_ids": ["uuid"]
  },
  "policy": {
    "locator_policy_version": "locator-1.0.0",
    "section_taxonomy_version": "section-taxonomy-1.0.0",
    "table_taxonomy_version": "table-taxonomy-1.0.0",
    "figure_taxonomy_version": "figure-taxonomy-1.0.0",
    "manufacturer_profile_version": "manufacturer-profile-1.0.0"
  },
  "results": {
    "section_map_uri": "s3://.../section_map.json",
    "table_catalog_uri": "s3://.../table_catalog.json",
    "figure_catalog_uri": "s3://.../figure_catalog.json",
    "artifact_manifest_uri": "s3://.../artifact_manifest.json",
    "quality_report_uri": "s3://.../quality_report.json"
  },
  "summary": {
    "sections_found": 24,
    "tables_found": 37,
    "figures_found": 42,
    "required_sections_found": 5,
    "required_sections_missing": [],
    "required_figures_found": 3,
    "required_figures_missing": []
  },
  "quality": {
    "section_score": 0.96,
    "table_score": 0.92,
    "figure_score": 0.90,
    "crop_score": 0.95,
    "overall_score": 0.93,
    "review_required": false,
    "review_reasons": []
  },
  "issues": [],
  "created_at": "ISO-8601"
}
```

---

# 26. 状态机

```text
RECEIVED
  ↓
LOADING_CANONICAL_IR
  ↓
LOADING_POLICY
  ↓
LOADING_SCHEMA_HINTS       可选
  ↓
GENERATING_HEADING_CANDIDATES
  ↓
CLASSIFYING_SECTIONS
  ↓
RESOLVING_SECTION_BOUNDARIES
  ↓
CLASSIFYING_TABLES
  ↓
LINKING_CROSS_PAGE_TABLES
  ↓
GENERATING_FIGURE_CANDIDATES
  ↓
CLASSIFYING_FIGURES
  ↓
EXTRACTING_VISUAL_ASSETS
  ↓
VALIDATING_CROPS
  ↓
BUILDING_CATALOGS
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
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 27. 策略文件

建议：

```text
policies/
├── locator-1.0.0.yaml
├── section-taxonomy-1.0.0.yaml
├── table-taxonomy-1.0.0.yaml
├── figure-taxonomy-1.0.0.yaml
├── section-aliases/
│   ├── common.yaml
│   ├── texas-instruments.yaml
│   ├── analog-devices.yaml
│   ├── stmicroelectronics.yaml
│   ├── nxp.yaml
│   ├── infineon.yaml
│   ├── microchip.yaml
│   └── onsemi.yaml
├── table-signatures/
│   ├── electrical.yaml
│   ├── pins.yaml
│   ├── ordering.yaml
│   └── package.yaml
├── figure-rules/
│   ├── block-diagram.yaml
│   ├── schematic.yaml
│   ├── package.yaml
│   └── pinout.yaml
└── category-hints/
    ├── mcu.yaml
    ├── opamp.yaml
    ├── adc.yaml
    ├── ldo.yaml
    ├── mosfet.yaml
    └── sensor.yaml
```

---

# 28. 规则 DSL

## 28.1 章节规则

```yaml
rule_id: section.electrical.common.001
target: electrical_characteristics
priority: 100
weight: 0.70

when:
  source: heading_text
  any_regex:
    - '^electrical characteristics$'
    - '^dc electrical characteristics$'
    - '^ac electrical characteristics$'
    - '^electrical specifications$'

unless:
  any:
    - source: is_toc_entry
      equals: true
    - source: block_type
      equals: table_cell

evidence:
  store_block_id: true
  store_page: true
  store_bbox: true
```

## 28.2 表格签名

```yaml
rule_id: table.pin_description.001
target: pin_description
priority: 100
weight: 0.65

when:
  all:
    - source: header_tokens
      min_match: 2
      terms:
        - pin
        - name
        - number
        - description
        - type
    - source: containing_section
      any_of:
        - pin_description
        - pin_functions
        - pin_configuration
```

## 28.3 图片规则

```yaml
rule_id: figure.package_outline.001
target: package_outline
priority: 100
weight: 0.60

when:
  any:
    - source: caption_text
      regex: '(outline dimensions|package outline|mechanical drawing)'
    - source: region_ocr
      min_match: 3
      terms:
        - top view
        - side view
        - bottom view
        - dimensions
        - millimeters
    - source: containing_section
      any_of:
        - package_dimensions
        - mechanical_data

visual_hints:
  dimension_lines: true
  arrowheads: true
  repeated_dimension_labels: true
```

DSL 不允许执行任意 Python。

---

# 29. 数据模型

## 29.1 `datasheet_locator_jobs`

```text
id UUID PK
document_id UUID NOT NULL
version_id UUID NOT NULL
parse_result_id UUID NOT NULL
mode VARCHAR NOT NULL
targets JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
locator_policy_version VARCHAR NOT NULL
section_taxonomy_version VARCHAR NOT NULL
table_taxonomy_version VARCHAR NOT NULL
figure_taxonomy_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 29.2 `datasheet_locator_results`

```text
id UUID PK
job_id UUID NOT NULL
section_map_uri TEXT NOT NULL
table_catalog_uri TEXT NOT NULL
figure_catalog_uri TEXT NOT NULL
artifact_manifest_uri TEXT NOT NULL
quality_report_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

## 29.3 `datasheet_section_index`

用于快速查询，不保存完整正文：

```text
id UUID PK
result_id UUID NOT NULL
section_id VARCHAR NOT NULL
section_type VARCHAR NOT NULL
title TEXT NULL
level INT NULL
parent_section_id VARCHAR NULL
start_page INT NOT NULL
end_page INT NOT NULL
confidence NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, section_id)
```

## 29.4 `datasheet_table_index`

```text
id UUID PK
result_id UUID NOT NULL
table_id VARCHAR NOT NULL
logical_table_id VARCHAR NULL
table_type VARCHAR NOT NULL
section_id VARCHAR NULL
start_page INT NOT NULL
end_page INT NOT NULL
confidence NUMERIC(5,4)
structure_score NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, table_id)
```

## 29.5 `datasheet_figure_index`

```text
id UUID PK
result_id UUID NOT NULL
figure_id VARCHAR NOT NULL
figure_type VARCHAR NOT NULL
section_id VARCHAR NULL
page_number INT NOT NULL
rendered_uri TEXT NOT NULL
thumbnail_uri TEXT NULL
caption_text TEXT NULL
confidence NUMERIC(5,4)
crop_score NUMERIC(5,4)
review_status VARCHAR NOT NULL
UNIQUE(result_id, figure_id)
```

## 29.6 `datasheet_locator_events`

```text
id BIGSERIAL PK
job_id UUID NOT NULL
event_type VARCHAR NOT NULL
step VARCHAR NOT NULL
payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 29.7 `datasheet_locator_reviews`

```text
id UUID PK
job_id UUID NOT NULL
object_type VARCHAR NOT NULL
object_id VARCHAR NOT NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
assigned_to VARCHAR NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 30. 产物存储

```text
derived/datasheet-locator/
  {source_sha256}/
    {locator_policy_version}/
      sections/
        section_map.json
      tables/
        table_catalog.json
        fragments/
      figures/
        figure_catalog.json
        originals/
        rendered/
        rendered_with_caption/
        thumbnails/
        ocr/
        overlays/
      debug/
        heading_candidates.json
        table_candidates.json
        figure_candidates.json
        crop_decisions.json
        bbox_overlay_pages/
      artifact_manifest.json
      quality_report.json
```

PostgreSQL 只保存索引和 URI。

---

# 31. 图片去重与派生关系

同一张图可能：

- 在 Datasheet 中多次出现；
- 被多个解析器重复提取；
- 同时有 raw 与 rendered；
- 裁剪参数不同。

记录：

```text
asset_sha256
perceptual_hash
source_object_id
parent_asset_id
derivation_type
crop_bbox
render_dpi
```

同一图的不同版本不应简单覆盖。

---

# 32. 质量评估

## 32.1 章节质量

```text
required_section_recall
heading_classification_confidence
boundary_consistency
toc_alignment
hierarchy_consistency
overlap_penalty
unknown_heading_ratio
```

## 32.2 表格质量

```text
required_table_recall
table_type_confidence
header_signature_score
structure_score
cross_page_link_score
orphan_table_ratio
duplicate_table_ratio
```

## 32.3 图片质量

```text
required_figure_recall
figure_type_confidence
caption_link_score
crop_completeness
resolution_score
text_legibility
duplicate_ratio
body_text_contamination
edge_clip_penalty
```

## 32.4 综合评分

按目标动态加权。

若用户只请求图像，不能因为缺少某类表格降低总分。

## 32.5 强制审核

以下情况进入审核：

- 必需章节缺失；
- Electrical Characteristics 章节存在但无任何表格；
- Pin Description 定位冲突；
- Ordering Information 多个候选差异明显；
- 框图候选低置信度；
- 应用图与测试电路冲突；
- 封装图疑似被裁切；
- crop edge 检测到线条/文字被截断；
- 一页多个封装无法可靠切分；
- 多个型号的适用关系不清；
- 跨页表格合并低置信度；
- Canonical IR 解析质量过低；
- 输出图片分辨率不足；
- 所有 figure candidate 均来自正文截图而非图形区域。

---

# 33. API

## 33.1 写接口

```text
POST /api/v1/datasheet-locator/jobs
POST /api/v1/datasheet-locator/batches
POST /api/v1/datasheet-locator/jobs/{job_id}/retry
POST /api/v1/datasheet-locator/jobs/{job_id}/cancel
POST /api/v1/datasheet-locator/jobs/{job_id}/rerun-target
POST /api/v1/datasheet-locator/jobs/{job_id}/reextract-figure
POST /api/v1/datasheet-locator/reviews/{review_id}/resolve
POST /api/v1/datasheet-locator/policies/validate
```

## 33.2 读接口

```text
GET /api/v1/datasheet-locator/jobs/{job_id}
GET /api/v1/datasheet-locator/jobs/{job_id}/events
GET /api/v1/datasheet-locator/results/{result_id}
GET /api/v1/datasheet-locator/results/{result_id}/sections
GET /api/v1/datasheet-locator/results/{result_id}/tables
GET /api/v1/datasheet-locator/results/{result_id}/figures
GET /api/v1/datasheet-locator/figures/{figure_id}
GET /api/v1/datasheet-locator/reviews
GET /api/v1/datasheet-locator/policies
GET /health/live
GET /health/ready
GET /metrics
```

---

# 34. 人工审核界面要求

V1 后端应为审核 UI 提供足够数据。

## 34.1 章节审核

显示：

- PDF 页面；
- 标题 bbox；
- 预测章节类型；
- 候选类型；
- 起止边界；
- TOC；
- 上下文；
- 规则命中。

操作：

- 修改章节类型；
- 修改起止区块；
- 合并章节；
- 拆分章节；
- 设为忽略。

## 34.2 表格审核

显示：

- 表格截图；
- 结构化单元格；
- 表题；
- 所属章节；
- 跨页片段；
- 表头签名。

操作：

- 修改类型；
- 合并/拆分逻辑表格；
- 修正所属章节；
- 标记关键表。

## 34.3 图片审核

显示：

- 原页面；
- source bbox；
- expanded bbox；
- 裁剪结果；
- 带图注结果；
- OCR；
- 分类候选；
- 边缘裁切告警。

操作：

- 拖动 bbox；
- 扩展/缩小；
- 修改图类型；
- 绑定图注；
- 绑定封装；
- 标记为无关图片。

---

# 35. 可观测性

## 35.1 Prometheus

```text
datasheet_locator_jobs_total{status,mode}
datasheet_locator_duration_seconds{step}
datasheet_sections_found_total{section_type}
datasheet_required_sections_missing_total{section_type}
datasheet_tables_found_total{table_type}
datasheet_cross_page_tables_total{table_type}
datasheet_figures_found_total{figure_type}
datasheet_figure_crop_failures_total{reason}
datasheet_figure_reextract_total{reason}
datasheet_locator_review_total{object_type,reason}
datasheet_locator_quality_score{dimension}
datasheet_locator_rule_hits_total{rule_id}
datasheet_locator_unknown_total{object_type}
```

## 35.2 Dashboard

展示：

- 每日处理文档数；
- Features 命中率；
- Electrical Characteristics 命中率；
- Pin Description 命中率；
- Ordering Information 命中率；
- Package 命中率；
- 框图提取率；
- 应用图提取率；
- 封装图提取率；
- 裁剪返工率；
- 人工审核率；
- 厂商维度失败率；
- 解析器维度失败率；
- 平均每份文档章节/表格/图片数量；
- 新规则上线前后比较。

---

# 36. 测试数据集

至少覆盖：

## 36.1 章节

1. TI 风格；
2. ADI 风格；
3. ST 风格；
4. NXP 风格；
5. Microchip 风格；
6. Infineon 风格；
7. onsemi 风格；
8. 中文 Datasheet；
9. 无 TOC；
10. TOC 页码不准；
11. 所有标题同一字体；
12. 章节编号缺失；
13. 多级嵌套；
14. 重复章节标题；
15. 页眉与章节标题相同；
16. Family Datasheet；
17. Application Note；
18. Package Addendum。

## 36.2 表格

19. Electrical Characteristics 单页；
20. Electrical Characteristics 跨页；
21. Borderless 表格；
22. 扫描表格；
23. Pin Description；
24. Alternate Function；
25. Ordering Information；
26. Package Dimensions；
27. Thermal Characteristics；
28. Timing Characteristics；
29. 多表格同页；
30. 表格标题缺失；
31. 重复表头；
32. 合并单元格；
33. 不同型号共享/不共享表格。

## 36.3 图片

34. 内嵌 PNG 框图；
35. 纯矢量框图；
36. 矢量＋文字框图；
37. 应用原理图；
38. 测试电路；
39. 曲线图；
40. Pinout；
41. 封装 Top View；
42. Package Outline；
43. Land Pattern；
44. Tape and Reel；
45. 一页多封装；
46. 多图并列；
47. 图注在上方；
48. 图注在下方；
49. 无图注；
50. 图形靠页边；
51. 上方有正文；
52. 下方有正文；
53. 解析器将图切成多个碎片；
54. 裁剪切断连接线；
55. 裁剪切断尺寸箭头；
56. 低分辨率扫描图；
57. 页面旋转；
58. 水印覆盖；
59. 图片重复出现；
60. 图与表格相邻。

公开仓库只使用合成或授权 Fixture。

---

# 37. 评估指标

## 37.1 章节

- Section Type Macro F1；
- Required Section Recall；
- Heading Precision；
- Boundary Start Accuracy；
- Boundary End Accuracy；
- Hierarchy Accuracy；
- TOC Alignment Accuracy。

## 37.2 表格

- Table Type Macro F1；
- Required Table Recall；
- Logical Table Linking Accuracy；
- Cross-page Merge Precision；
- Cross-page Merge Recall；
- Section Association Accuracy。

## 37.3 图片

- Figure Detection Recall；
- Figure Type Macro F1；
- Caption Association Accuracy；
- Crop IoU；
- Edge Clipping Rate；
- Body Text Contamination Rate；
- Required Figure Recall；
- Resolution Pass Rate；
- Human Re-crop Rate。

## 37.4 业务目标

内部基准集初始目标：

```text
Features 定位 Recall >= 98%
Electrical Characteristics 定位 Recall >= 98%
Pin Description 定位 Recall >= 95%
Ordering Information 定位 Recall >= 95%
Package 信息定位 Recall >= 95%

框图检测 Recall >= 95%
应用图检测 Recall >= 90%
封装图检测 Recall >= 95%

图像严重裁切率 <= 1%
正文污染率 <= 3%
人工重裁率 <= 5%
```

这些是目标，不是未经测试的保证。

---

# 38. 工程验收标准

## 38.1 功能

- 能消费 Canonical IR；
- 可选消费 component.schema.ready；
- 能输出 SectionMap；
- 能输出 TableCatalog；
- 能输出 FigureCatalog；
- 能定位五类核心章节；
- 能分类五类核心表格；
- 能提取框图、应用图和封装图；
- 能处理矢量图；
- 能处理图片＋文字组合；
- 能处理跨页表格；
- 能保存原始和渲染图片；
- 能检测裁剪问题；
- 能进入人工审核；
- 能人工重裁；
- 能发布下游事件；
- 所有写接口幂等。

## 38.2 工程质量

- 单元测试覆盖率不低于 85%；
- bbox 与 crop 模块覆盖率不低于 95%；
- 规则均有回归测试；
- JSON Schema 校验通过；
- Migration upgrade/downgrade 通过；
- Ruff 通过；
- mypy 通过；
- 视觉回归测试可生成对比图；
- 不提交真实受版权保护 Datasheet；
- 不伪造识别指标。

## 38.3 性能

- 纯章节/表格定位不重新渲染整本 PDF；
- 图片只渲染候选区域；
- 50 页普通 Datasheet 的结构定位目标小于 10 秒，不含重型局部 OCR；
- 图片渲染有最大像素限制；
- 同一输入和同一策略命中缓存；
- 批量任务可限制并发；
- 110 万器件批处理时支持按 Datasheet 去重，一份 Family Datasheet 不重复执行完整定位。

---

# 39. 推荐仓库结构

如果前三个 Agent 在同一 monorepo 中，应复用公共基础设施。

```text
datasheet-structure-visual-locator/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── datasheet-structure-visual-locator-agent-spec.md
│   ├── section-taxonomy.md
│   ├── table-taxonomy.md
│   ├── figure-taxonomy.md
│   ├── manufacturer-profiles.md
│   ├── crop-quality.md
│   ├── rule-dsl.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-canonical-ir-first.md
│       ├── 0002-dual-image-extraction.md
│       ├── 0003-sections-tables-figures-separate.md
│       └── 0004-no-external-llm-v1.md
├── src/
│   └── datasheet_locator/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── policy/
│       │   ├── loader.py
│       │   ├── validator.py
│       │   └── models.py
│       ├── sections/
│       │   ├── candidate_generator.py
│       │   ├── normalizer.py
│       │   ├── classifier.py
│       │   ├── hierarchy.py
│       │   ├── boundary_resolver.py
│       │   └── toc.py
│       ├── tables/
│       │   ├── classifier.py
│       │   ├── signatures.py
│       │   ├── continuation.py
│       │   └── catalog.py
│       ├── figures/
│       │   ├── candidate_generator.py
│       │   ├── spatial_cluster.py
│       │   ├── caption_linker.py
│       │   ├── classifier.py
│       │   ├── local_ocr.py
│       │   ├── raw_extractor.py
│       │   ├── renderer.py
│       │   ├── crop_expander.py
│       │   ├── crop_validator.py
│       │   └── asset_group.py
│       ├── evidence/
│       ├── quality/
│       ├── review/
│       ├── storage/
│       └── observability/
├── policies/
├── schemas/
│   ├── section-map.schema.json
│   ├── table-catalog.schema.json
│   ├── figure-catalog.schema.json
│   └── locator-result.schema.json
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── sections/
│   ├── tables/
│   ├── figures/
│   ├── crop/
│   ├── visual_regression/
│   ├── contract/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── generate_synthetic_datasheets.py
    ├── render_locator_overlay.py
    ├── validate_crops.py
    ├── run_locator_benchmark.py
    └── compare_policy_versions.py
```

---

# 40. Codex 分阶段实施

不要让 Codex 一次实现全部功能。

## Phase 0：仓库侦察与接口对齐

Codex 必须：

1. 阅读前三个 Agent 的规格和代码；
2. 找出 Canonical IR 实际 Schema；
3. 找出已有章节、表格和图片相关代码；
4. 找出已有图片裁剪问题和历史修复；
5. 找出对象存储、事件、审核、日志、任务队列；
6. 检查 Docling/MinerU 输出中可复用的 bbox、table、picture 和 caption；
7. 输出实施计划；
8. 输出 Section/Table/Figure Taxonomy 初稿；
9. 输出 Crop Quality 设计；
10. 不修改业务代码；
11. 不创建 Migration；
12. 不安装模型。

## Phase 1：领域模型与契约

实现：

- SectionMap Schema；
- TableCatalog Schema；
- FigureCatalog Schema；
- Job/Result/Event 契约；
- Policy Schema；
- Mock Canonical IR；
- Mock Locator。

验收：

- JSON Schema 通过；
- Contract tests 通过。

## Phase 2：章节候选与标题分类

实现：

- heading candidates；
- heading normalization；
- 通用 alias；
- 厂商 profile 框架；
- TOC 识别；
- 噪声过滤；
- 五类核心章节。

验收：

- 多厂商合成 Fixture 通过；
- TOC 不被误当章节起点。

## Phase 3：章节层级和边界

实现：

- 标题层级；
- 编号层级；
- section tree；
- start/end；
- 嵌套；
- 跨页；
- overlap validation。

验收：

- Electrical Characteristics 父子章节结构正确；
- 边界视觉叠加正确。

## Phase 4：表格分类

实现：

- 表题；
- 表头签名；
- 所属章节；
- Electrical/Pin/Ordering/Package 等核心表格；
- Schema hints；
- TableCatalog。

验收：

- 五类核心表格正确定位。

## Phase 5：跨页表格

实现：

- continuation candidates；
- 列坐标匹配；
- 重复表头；
- continued 标记；
- logical_table；
- 错误合并防护。

验收：

- 跨页参数表和 Ordering 表正确；
- 不同表格不误合并。

## Phase 6：图片候选与图注关联

实现：

- parser figures；
- vector region candidates；
- spatial clustering；
- caption candidates；
- caption linker；
- parent/child figures；
- FigureCatalog 骨架。

验收：

- 栅格、矢量和组合图均能形成候选。

## Phase 7：图片分类

实现：

- caption rules；
- context rules；
- local OCR；
- visual structural features；
- 框图；
- 应用图；
- Pinout；
- 封装图；
- 曲线图负面分类。

验收：

- 框图、应用图和封装图准确区分；
- 特性曲线不误判为框图。

## Phase 8：图片提取与裁剪质量

实现：

- raw embedded extraction；
- region rendering；
- margins；
- edge clipping detection；
- text contamination detection；
- iterative expansion；
- caption-separated asset；
- overlays；
- re-crop API。

验收：

- 不切断线条、箭头、文字；
- 不吸入大段正文；
- 保存原始与渲染版本。

## Phase 9：封装与应用图专项

实现：

- 一页多封装；
- package asset groups；
- Top/Bottom/Side；
- Land Pattern；
- Tape and Reel；
- Typical Application；
- Test Circuit；
- Applicable Part/Package candidates。

验收：

- LM358 多封装类合成 Fixture 能分别输出。

## Phase 10：质量、审核和回写

实现：

- quality scorer；
- required target checks；
- review tasks；
- section/table/figure override；
- bbox 手工修改；
- audit history；
- policy feedback dataset。

验收：

- 人工修正不覆盖历史；
- 可导出训练/规则改进数据。

## Phase 11：API、事件、批处理与缓存

实现：

- 完整 API；
- 事件订阅；
- 下游事件；
- 批量处理；
- Family Datasheet 复用；
- 幂等；
- 缓存；
- retry/cancel。

验收：

- parse.ready/schema.ready 到 locator.ready 端到端通过。

## Phase 12：Benchmark 与生产发布

实现：

- 合成基准；
- 内部受控基准；
- section/table/figure 指标；
- crop 指标；
- 可视化报告；
- Prometheus；
- Dashboard；
- README；
- 运维手册；
- 策略升级和回滚。

---

# 41. Codex 工作纪律

Codex 必须：

1. 先读取实际 Canonical IR；
2. 不重新建立第二套 PDF 解析；
3. 不直接依赖 Docling 内部对象；
4. 不直接依赖 MinerU 内部对象；
5. 只通过 Canonical IR 和 Adapter；
6. 章节、表格和图片分开建模；
7. 所有规则配置化；
8. 所有规则版本化；
9. 所有结果带 bbox 和证据；
10. 不只提取 PDF 内嵌图片；
11. 矢量图必须支持区域渲染；
12. 不把图注强制裁入主图；
13. 不切断图形线条和文字；
14. 不为了完整性把整页正文当图片；
15. 不把曲线图误判为应用原理图；
16. 不把 Application Note 当 Datasheet 主结构处理；
17. 不调用外部通用 LLM；
18. 不用 LLM 补写图中文字；
19. 不覆盖原始 PDF；
20. 不覆盖人工审核结果；
21. 不提交真实受版权保护 Datasheet；
22. 不伪造识别准确率；
23. 每个 Phase 输出：
    - 修改文件；
    - Schema/API 变化；
    - 规则变化；
    - 测试命令；
    - 真实测试结果；
    - 视觉回归结果；
    - 性能结果；
    - 已知问题；
    - 下一阶段建议。

---

# 42. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/datasheet-structure-visual-locator-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发 Datasheet Structure & Visual Asset Locator Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. docs/datasheet-asset-ingestion-agent-spec.md；
3. docs/pdf-parsing-ocr-router-agent-spec.md；
4. docs/component-classification-schema-router-agent-spec.md；
5. docs/datasheet-structure-visual-locator-agent-spec.md；
6. 前三个 Agent 的代码、Schema、事件协议和测试；
7. 当前 Canonical Document IR 定义；
8. 当前对象存储、任务队列、审核、日志、Docker 和 CI；
9. 仓库中已有的章节定位、图片提取、bbox、裁剪和视觉代码。

本 Agent 的职责是：

- 消费 datasheet.parse.ready 和 Canonical IR；
- 可选消费 component.schema.ready；
- 定位 Features、Electrical Characteristics、Pin Description、Package、Ordering Information 等章节；
- 分类和关联 Electrical、Pin、Ordering、Package 等表格；
- 处理跨页表格；
- 定位并提取 Functional Block Diagram；
- 定位并提取 Application / Typical Application Schematic；
- 定位并提取 Package Outline、Mechanical Drawing、Pinout 和 Land Pattern；
- 输出 SectionMap、TableCatalog、FigureCatalog；
- 保存 page、bbox、block_id、caption、rule_id、confidence 和 provenance；
- 检查图片裁剪完整性；
- 低置信度结果进入人工审核；
- 为后续参数、引脚、封装和 KiCad Agent 输出标准定位结果。

硬约束：

- 不重新实现整本 PDF 解析；
- Canonical IR 优先；
- 不直接绑定 Docling/MinerU 专有对象；
- 章节、表格和图片必须分开建模；
- 标题分类与章节边界必须分开；
- 所有规则和 Taxonomy 配置化、版本化；
- 所有结果必须有 page、bbox 和 evidence；
- 不能只提取 PDF 内嵌栅格图片；
- 必须支持矢量图、组合图和区域渲染；
- 主图片与图注分别保存；
- 必须检测线条、箭头、文字和尺寸标注被裁切；
- 不得通过扩大 bbox 把大段正文吸入图片；
- 不把 Typical Characteristics 曲线误判为框图或应用原理图；
- V1 不调用外部通用大模型；
- 不使用 LLM 补写内容；
- 不覆盖原始 PDF；
- PostgreSQL 不存放大图片和完整 Catalog；
- 不覆盖人工审核结果；
- 不提交真实受版权保护 Datasheet；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察仓库结构；
2. 确认前三个 Agent 当前完成程度；
3. 打开并分析 Canonical IR Schema；
4. 识别可复用的 heading、table、figure、caption、bbox 和 provenance 字段；
5. 检查 Docling、MinerU、PaddleOCR 的 Adapter 是否保留了需要的信息；
6. 查找当前图片裁剪逻辑及历史问题；
7. 在 docs/datasheet-locator-implementation-plan.md 中生成详细实施计划；
8. 在 docs/datasheet-section-taxonomy.md 中生成章节分类初稿；
9. 在 docs/datasheet-table-taxonomy.md 中生成表格分类初稿；
10. 在 docs/datasheet-figure-taxonomy.md 中生成图片分类初稿；
11. 在 docs/datasheet-crop-quality-design.md 中生成裁剪完整性设计；
12. 在 docs/datasheet-locator-benchmark-plan.md 中生成基准测试计划；
13. 给出拟新增、拟修改和拟复用的文件清单；
14. 给出 Phase 1 精确修改范围；
15. 不修改业务实现；
16. 不创建数据库 Migration；
17. 不安装模型；
18. 运行当前仓库已有 lint、type check 和测试。

如果环境无法运行测试，记录准确原因，不得编造结果。

最终回复必须包含：

- 仓库现状；
- 与前三个 Agent 的衔接；
- Canonical IR 可复用字段；
- 当前缺失字段；
- Section/Table/Figure Taxonomy；
- 双通道图片提取方案；
- Crop Quality 方案；
- Benchmark 方案；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 43. 后续 Phase 提示词模板

```text
继续实现 Datasheet Structure & Visual Asset Locator Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读四个 Agent 的完整规格；
3. 阅读 docs/datasheet-locator-implementation-plan.md；
4. 阅读 Section/Table/Figure Taxonomy；
5. 阅读 Crop Quality Design；
6. 检查上一阶段代码和测试；
7. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Canonical IR 优先；
- 不重新解析整本 PDF；
- 章节、表格、图片分开；
- 规则配置化和版本化；
- 所有结果带 bbox 和证据；
- 支持矢量和组合图；
- 主图与图注分开；
- 检测裁切与正文污染；
- 不依赖外部通用 LLM；
- 不覆盖原 PDF；
- 不覆盖人工结果；
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
9. 运行视觉回归；
10. 运行必要性能测试；
11. 更新文档；
12. 总结修改。

最终回复：

- 修改文件；
- Schema/API 变化；
- 规则和 Taxonomy 变化；
- 测试命令和真实结果；
- 视觉回归结果；
- 性能结果；
- 已知限制；
- 下一阶段建议。
```

---

# 44. MVP 演示流程

完成 V1 后演示：

1. 接收一个已解析的运放 Datasheet；
2. 定位 Features；
3. 定位 Electrical Characteristics；
4. 输出该章节中的多个参数表；
5. 定位 Pin Description；
6. 定位 Ordering Information；
7. 定位 Package Information；
8. 提取 Functional Block Diagram；
9. 提取 Typical Application Schematic；
10. 提取 Package Outline；
11. 在原 PDF 页面显示 bbox overlay；
12. 显示主图与图注分离结果；
13. 显示裁剪边缘检查；
14. 模拟裁剪不足并自动扩边；
15. 验证扩边未吸入上方正文；
16. 导入一个矢量框图；
17. 通过区域渲染完整提取；
18. 导入一个跨页 Electrical Characteristics 表；
19. 生成 logical_table；
20. 导入 Family Datasheet；
21. 将多种封装分别形成 asset group；
22. 低置信度图片进入审核；
23. 人工拖动 bbox 后重裁；
24. 保存审核历史；
25. 发布 `datasheet.locator.ready`。

---

# 45. 下游事件

```json
{
  "event_type": "datasheet.locator.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "parse_result_id": "uuid",
  "locator_result_id": "uuid",
  "part_ids": ["uuid"],
  "locator_policy_version": "locator-1.0.0",
  "section_map_uri": "s3://.../section_map.json",
  "table_catalog_uri": "s3://.../table_catalog.json",
  "figure_catalog_uri": "s3://.../figure_catalog.json",
  "artifact_manifest_uri": "s3://.../artifact_manifest.json",
  "quality_report_uri": "s3://.../quality_report.json",
  "required_targets": {
    "features": "found",
    "electrical_characteristics": "found",
    "pin_description": "found",
    "package_information": "found",
    "ordering_information": "found",
    "functional_block_diagram": "found",
    "application_schematic": "found",
    "package_outline": "found"
  },
  "overall_quality": 0.93,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

建议后续参数和引脚 Agent 只自动处理：

```text
review_status = approved
AND overall_quality >= configured_threshold
AND required target exists
AND source parse quality is acceptable
```

---

# 46. 当前工具能力的设计依据

实施时应重新核对最新官方文档和当前安装版本。

## Docling

DoclingDocument 可表达文档树、表格、图片和 layout provenance，适合从统一结构中读取 headings、tables、pictures 和 bbox。Docling 也支持输出图像和表格图片，但本 Agent 仍应保留自己的工程图裁剪完整性校验。

官方参考：

- https://docling-project.github.io/docling/concepts/docling_document/
- https://docling-project.github.io/docling/reference/docling_document/
- https://docling-project.github.io/docling/_generated/examples/export_figures/
- https://docling-project.github.io/docling/_generated/examples/export_tables/

## MinerU

MinerU 的 `middle.json` 和 `content_list.json` 可提供 text、image、table、chart 等区块、bbox、图片路径和阅读顺序，适合用于复杂布局结果和调试。不过其不同版本的输出结构可能变化，必须通过第二个 Agent 的 Adapter 统一后再消费。

官方参考：

- https://opendatalab.github.io/MinerU/reference/output_files/
- https://opendatalab.github.io/MinerU/usage/cli_tools/
- https://opendatalab.github.io/MinerU/reference/changelog/

## PaddleOCR PP-StructureV3

PP-StructureV3 支持布局区域、表格、公式、图表和多栏阅读顺序，可用于扫描页面、漏检表格和局部图片 OCR 的回退路径。本 Agent 不应绕过第二个 Agent 直接耦合 PaddleOCR。

官方参考：

- https://www.paddleocr.ai/main/en/version3.x/algorithm/PP-StructureV3/PP-StructureV3.html
