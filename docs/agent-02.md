# PDF 解析与 OCR 路由 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：PDF Parsing & OCR Routing Agent  
> 版本：V1.0  
> 定位：程序型/模型型基础设施 Agent，不调用外部通用大模型  
> 上游：Datasheet Asset Ingestion Agent  
> 下游：章节识别、参数抽取、引脚抽取、表格抽取、图片提取、Evidence Anchoring、KiCad 库生成等 Agent  
> 目标读者：产品负责人、后端工程师、算法工程师、数据工程师、Codex

---

## 1. 项目目标

建设一个独立、可复用、可测量、可替换解析引擎的 PDF 解析路由服务。

该 Agent 接收由 `Datasheet Asset Ingestion Agent` 已完成验证、去重和版本管理的 PDF 资产，对文档进行低成本预检，识别：

- 原生数字 PDF；
- 扫描 PDF；
- 混合型 PDF；
- 存在损坏或乱码文本层的 PDF；
- 单栏文档；
- 多栏文档；
- 表格密集文档；
- 图像密集文档；
- 公式密集文档；
- 版式复杂文档；
- 页面方向错误、倾斜、低分辨率等问题。

随后根据可版本化的路由策略，将文档分配给：

- Docling；
- MinerU；
- PaddleOCR / PP-StructureV3；
- OCRmyPDF 预处理；
- 原生快速文本提取器；
- 人工审核或失败队列。

最终输出统一的 `Canonical Document IR`，使后续 Agent 不需要了解 Docling、MinerU、PaddleOCR 等工具各自的输出格式。

---

## 2. 与第一个 Agent 的边界

### 2.1 上游 Agent 负责

`Datasheet Asset Ingestion Agent` 负责：

- URL 下载；
- 本地上传；
- PDF 文件真实性验证；
- SHA256 去重；
- 原始文件不可变存储；
- Datasheet 文档、版本和来源管理；
- Family Datasheet 与型号初步关联；
- 输出 `datasheet.asset.ready` 事件。

### 2.2 本 Agent 负责

本 Agent 负责：

- 对已接入 PDF 做页面级结构体检；
- 生成文档与页面画像；
- 选择解析路线；
- 调用解析引擎；
- 统一解析结果；
- 评估解析质量；
- 对失败页面或低质量页面执行有限回退；
- 保存原始解析结果、标准 IR、Markdown、图片和调试文件；
- 输出 `datasheet.parse.ready` 事件。

### 2.3 本 Agent 不负责

V1 不负责：

- 从内容中抽取具体电气参数；
- 判断参数语义；
- 识别器件引脚含义；
- 理解原理图、框图和应用图的工程语义；
- 建立元器件知识图谱；
- 将表格内容映射到业务 Schema；
- 使用外部通用 LLM API 修复解析结果；
- 使用 LLM/VLM 对整份文档进行自由生成；
- 替代后续的人工证据审核；
- 对所有页面同时运行所有解析器。

本 Agent 的职责是“把 PDF 转换为可靠、带坐标和证据的机器可读文档结构”，而不是完成业务知识抽取。

---

## 3. 核心设计原则

### 3.1 先诊断，后解析

不得默认将全部 PDF 直接交给最重的模型。

所有文档必须先通过轻量预检，计算页面特征，再选择路线。预检应在 CPU 上运行，且目标成本远低于完整解析。

### 3.2 页面级画像，文档级主路由，页面级回退

不能只把整份 PDF 粗暴分类为“扫描”或“非扫描”。

推荐策略：

1. 每页生成独立画像；
2. 根据全局分布选择一个文档级主解析器；
3. 主解析器按整本或连续页段处理，保留阅读顺序和跨页表格能力；
4. 解析后识别低质量页面或区块；
5. 仅对失败页面执行回退；
6. 涉及跨页表格时，回退范围包含前后相邻页；
7. 合并时保留每个区块来自哪个解析器的证据。

### 3.3 原始 PDF 永远不可修改

OCRmyPDF、页面旋转、纠偏、清洗等输出必须作为派生资产保存，不得覆盖上游保存的原始 PDF。

### 3.4 解析引擎必须可插拔

Docling、MinerU、PaddleOCR 和 OCRmyPDF 必须通过统一 Adapter 调用。

业务代码不得直接依赖某个引擎的内部对象。

### 3.5 不把所有模型装进同一运行环境

Docling、MinerU、PaddleOCR 及其模型依赖可能冲突，并且对 CPU、GPU、CUDA 和内存要求不同。

推荐部署方式：

- Router/API：独立轻量 Python 服务；
- Docling Worker：独立容器；
- MinerU Worker：独立容器；
- PaddleOCR Worker：独立容器；
- OCRmyPDF Worker：独立容器；
- 所有 Worker 通过统一内部 API 或任务队列接收请求。

### 3.6 路由策略必须版本化

所有阈值、模型版本、解析器版本、参数和回退规则必须形成 `routing_policy_version`。

同一 PDF 在相同输入哈希、路由策略版本和解析器版本下应得到可复现结果。

### 3.7 原始输出与标准输出都要保留

必须同时保存：

- 引擎原始 JSON；
- 引擎原始 Markdown；
- 引擎调试图；
- Canonical Document IR；
- 归一化 Markdown；
- 提取图片；
- 表格结构；
- 页面质量报告；
- 解析日志和版本清单。

不能只保留最终 Markdown，因为 Markdown 会丢失坐标、表格结构、层级和证据信息。

### 3.8 自动判断必须可解释

文档类型、路由选择、回退决策必须保存：

- 特征值；
- 使用规则；
- 阈值；
- 评分；
- 候选路线；
- 最终路线；
- 质量结果；
- 是否需要人工复核。

---

## 4. 工具角色划分

### 4.1 原生快速提取器

建议基于：

- PyMuPDF；
- pypdf；
- pikepdf；
- 可选 pdfium。

用途：

- 页数和页面尺寸；
- 文本对象数量；
- 字符数量；
- 字体和编码信息；
- 图片数量和面积；
- 绘图对象数量；
- 页面渲染；
- 页面旋转；
- 原生文本快速抽样；
- 坐标与阅读顺序初步分析。

它是预检器，不是复杂版式的最终解析器。

### 4.2 Docling

建议作为 V1 的默认主解析器之一。

适合：

- 原生数字 PDF；
- 常规混合版式；
- 多栏技术文档；
- 表格；
- 需要统一文档结构、层级、坐标和 provenance 的场景；
- CPU 或普通 GPU 环境；
- 对下游需要统一 JSON 表示的场景。

Docling 提供统一的 `DoclingDocument` 表示，可表达文本、表格、图片、层级、页眉页脚、坐标和来源信息，并能导出 JSON、Markdown 等格式。

### 4.3 MinerU

建议作为复杂版式和高精度回退解析器之一。

适合：

- 多栏和复杂阅读顺序；
- 图片、公式和表格混合；
- 扫描版或乱码文本层；
- 跨页表格；
- 需要丰富调试结果和中间结构；
- Docling 解析质量不足的页面或文档。

MinerU 可生成 Markdown、`middle.json`、`content_list.json`、布局调试 PDF 和 span 调试 PDF，适合作为复杂文档解析器与质量诊断工具。

### 4.4 PaddleOCR / PP-StructureV3

建议作为 OCR 与扫描页面结构解析器。

适合：

- 中文、英文和多语言扫描页；
- 文字方向识别；
- 页面纠偏；
- 表格识别；
- 公式识别；
- 图表和复杂文档图片；
- 原生文本不可用或严重乱码的页面。

V1 不要求启用所有 PP-StructureV3 功能。应通过配置选择 OCR、版面、表格和公式模块，避免不必要的模型成本。

### 4.5 OCRmyPDF

OCRmyPDF 在本系统中定位为“PDF 图像预处理和搜索文本层生成器”，不是最终结构解析器。

用途：

- 页面旋转；
- deskew；
- clean；
- 对已有文本页跳过 OCR；
- 对损坏 OCR 层执行 redo；
- 必要时生成可搜索的派生 PDF；
- 保留原 PDF 页面的视觉形态。

OCRmyPDF 的输出仍应进入 Docling、MinerU 或 PaddleOCR 进行结构解析。

### 4.6 VLM 路线

V1 默认不启用外部通用 VLM。

若 MinerU 或 Docling 的本地 VLM 后端需要评估，必须满足：

- 作为实验性 Adapter；
- 默认关闭；
- 单独记录模型、版本和推理参数；
- 不允许自由生成未在页面中出现的内容；
- 只在基准测试证明收益后进入正式路由；
- 通过许可证、隐私和成本评审。

---

## 5. 推荐技术栈

如果现有 ezPLM / EEAgent 已有统一基础设施，优先复用。

若新建独立服务，默认采用：

### Router 与 API

- Python 3.12；
- FastAPI；
- Pydantic 2；
- SQLAlchemy 2；
- Alembic；
- PostgreSQL；
- Redis；
- Celery、Dramatiq 或现有任务队列；
- S3 兼容对象存储；
- MinIO 用于开发；
- PyMuPDF；
- pypdf；
- pikepdf；
- OpenCV；
- NumPy；
- scikit-image，可选；
- fastText 或轻量语言识别器，可选；
- pytest；
- Ruff；
- mypy；
- Docker Compose。

### 独立解析 Worker

- Docling Worker；
- MinerU Worker；
- PaddleOCR Worker；
- OCRmyPDF Worker；
- 可选 Native Parser Worker。

### 可观测性

- OpenTelemetry；
- Prometheus；
- Grafana；
- 结构化日志；
- Sentry 或现有错误追踪系统。

### 许可证注意

- Docling 使用 MIT License；
- PaddleOCR 使用 Apache 2.0；
- OCRmyPDF 使用 MPL 2.0；
- MinerU 当前使用基于 Apache 2.0、带附加条件的 MinerU Open Source License。

MinerU 在商业部署前必须由法务或负责人检查当时仓库中的实际许可证文本，不得只根据名称判断兼容性。

---

## 6. 总体架构

```text
┌─────────────────────────────────────────────┐
│ Datasheet Asset Ingestion Agent             │
│ datasheet.asset.ready                       │
└──────────────────────┬──────────────────────┘
                       │
              ┌────────▼────────┐
              │ Parsing API     │
              │ Job Controller  │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Preflight       │
              │ Page Profiler   │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Document        │
              │ Classifier      │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Routing Planner │
              └────────┬────────┘
                       │
      ┌────────────────┼───────────────────────┐
      │                │                       │
┌─────▼──────┐  ┌──────▼──────┐       ┌────────▼────────┐
│ Docling    │  │ MinerU      │       │ OCR Preprocess │
│ Worker     │  │ Worker      │       │ Worker         │
└─────┬──────┘  └──────┬──────┘       └────────┬────────┘
      │                │                       │
      │                │            ┌──────────▼─────────┐
      │                │            │ PaddleOCR Worker  │
      │                │            └──────────┬─────────┘
      └────────────────┼───────────────────────┘
                       │
              ┌────────▼────────┐
              │ Engine Output   │
              │ Normalizers     │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │ Quality Scorer  │
              │ Fallback Judge  │
              └────────┬────────┘
                       │
            ┌──────────▼──────────┐
            │ Selective Re-parse  │
            │ Page/Region Merge   │
            └──────────┬──────────┘
                       │
              ┌────────▼────────┐
              │ Canonical       │
              │ Document IR     │
              └────────┬────────┘
                       │
            ┌──────────▼──────────┐
            │ S3 + PostgreSQL     │
            │ Artifacts + Index   │
            └──────────┬──────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ datasheet.parse.ready                      │
│ Downstream Extraction Agents               │
└─────────────────────────────────────────────┘
```

---

## 7. Agent 输入

### 7.1 事件输入

订阅上游事件：

```json
{
  "event_type": "datasheet.asset.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "binary_object_id": "uuid",
  "storage_uri": "s3://datasheets/sha256/ab/cd/hash.pdf",
  "sha256": "hex",
  "manufacturer_id": "uuid",
  "part_ids": ["uuid"],
  "document_type": "family_datasheet",
  "language": "en",
  "page_count": 42,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

### 7.2 REST 输入

`POST /api/v1/pdf-parsing/jobs`

```json
{
  "version_id": "uuid",
  "binary_object_id": "uuid",
  "source_storage_uri": "s3://...",
  "source_sha256": "hex",
  "mode": "auto",
  "language_hints": ["en", "zh"],
  "page_range": null,
  "priority": "normal",
  "routing_policy_version": "router-1.0.0",
  "force_reparse": false,
  "requested_outputs": [
    "canonical_json",
    "markdown",
    "images",
    "tables",
    "quality_report"
  ],
  "idempotency_key": "uuid"
}
```

`mode`：

- `auto`
- `force_native`
- `force_docling`
- `force_mineru`
- `force_ocr`
- `benchmark_compare`
- `profile_only`

`benchmark_compare` 仅用于受控测试集，不允许在批量生产任务中默认启用。

### 7.3 批量输入

`POST /api/v1/pdf-parsing/batches`

```json
{
  "version_ids": ["uuid-1", "uuid-2"],
  "mode": "auto",
  "routing_policy_version": "router-1.0.0",
  "priority": "low",
  "batch_name": "datasheet-backfill-001"
}
```

---

## 8. Agent 输出

```json
{
  "agent_id": "pdf-parsing-ocr-router",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",
  "source": {
    "version_id": "uuid",
    "binary_object_id": "uuid",
    "sha256": "hex",
    "page_count": 42
  },
  "classification": {
    "origin_type": "mixed",
    "layout_types": [
      "multi_column",
      "table_dense",
      "image_dense"
    ],
    "quality_flags": [
      "scanned_pages_present"
    ],
    "confidence": 0.94,
    "profile_uri": "s3://.../document_profile.json"
  },
  "routing": {
    "policy_version": "router-1.0.0",
    "primary_engine": "docling",
    "preprocessors": [
      {
        "engine": "ocrmypdf",
        "pages": [31, 32],
        "reason": "scanned_pages"
      }
    ],
    "fallback_runs": [
      {
        "engine": "mineru",
        "pages": [12, 13],
        "reason": "table_integrity_below_threshold"
      }
    ],
    "decision_uri": "s3://.../routing_plan.json"
  },
  "parse_result": {
    "canonical_ir_uri": "s3://.../canonical_document_ir.json.zst",
    "markdown_uri": "s3://.../document.md",
    "artifact_manifest_uri": "s3://.../artifact_manifest.json",
    "quality_report_uri": "s3://.../quality_report.json",
    "engine_manifest_uri": "s3://.../engine_manifest.json",
    "canonical_schema_version": "1.0.0"
  },
  "quality": {
    "overall_score": 0.91,
    "text_score": 0.96,
    "layout_score": 0.88,
    "reading_order_score": 0.90,
    "table_score": 0.86,
    "image_extraction_score": 0.97,
    "ocr_score": 0.89,
    "review_required": false,
    "review_reasons": []
  },
  "issues": [],
  "created_at": "ISO-8601",
  "completed_at": "ISO-8601"
}
```

---

## 9. 文档分类体系

分类必须是多标签，不使用单一互斥标签描述所有问题。

### 9.1 文档来源类型 `origin_type`

- `born_digital`
- `scanned`
- `mixed`
- `broken_text_layer`
- `unknown`

### 9.2 版式类型 `layout_types`

- `single_column`
- `multi_column`
- `table_dense`
- `image_dense`
- `formula_dense`
- `diagram_dense`
- `list_dense`
- `mixed_complex`
- `unknown`

### 9.3 质量标志 `quality_flags`

- `rotated_pages`
- `skewed_pages`
- `low_resolution`
- `text_gibberish`
- `missing_unicode_map`
- `duplicate_text_layer`
- `hidden_ocr_layer`
- `full_page_images`
- `tiny_text`
- `oversized_pages`
- `mixed_page_sizes`
- `malformed_objects`
- `encrypted_restrictions`
- `render_failure`
- `possible_redaction`
- `unexpected_blank_pages`

---

## 10. 页面预检与特征

每一页应生成 `PageProfile`。V1 至少计算以下特征。

### 10.1 基础特征

```text
page_number
width_pt
height_pt
rotation
page_area
native_text_char_count
native_word_count
text_block_count
font_count
median_font_size
image_count
image_area_ratio
largest_image_area_ratio
vector_object_count
drawing_line_count
annotation_count
render_success
```

### 10.2 文本质量特征

```text
printable_char_ratio
unicode_replacement_ratio
control_char_ratio
duplicate_span_ratio
overlapping_text_ratio
whitespace_ratio
alphanumeric_ratio
average_token_length
repeated_glyph_ratio
text_entropy
native_text_bbox_coverage
hidden_text_ratio
```

不得仅使用“是否能复制文字”判断 PDF 是否原生。某些扫描 PDF 带低质量隐藏 OCR 层，某些数字 PDF 的 ToUnicode 映射损坏。

### 10.3 图像和扫描特征

```text
full_page_raster_candidate
largest_raster_dpi_estimate
grayscale_ratio
edge_density
background_uniformity
noise_score
blur_score
skew_angle
orientation_candidate
```

### 10.4 布局特征

```text
estimated_column_count
column_confidence
vertical_projection_gaps
horizontal_rule_density
vertical_rule_density
table_candidate_count
table_candidate_area_ratio
figure_candidate_count
figure_candidate_area_ratio
formula_candidate_count
reading_order_complexity
header_footer_repetition_score
```

### 10.5 语言特征

```text
language_candidates
language_confidence
cjk_ratio
latin_ratio
numeric_ratio
symbol_ratio
```

语言识别仅用于选择 OCR 语言和解析配置，不负责文档语义分类。

---

## 11. 默认分类规则

所有阈值必须放在策略配置中，下面只是初始默认值，不能散落在业务代码里。

### 11.1 扫描页候选

页面同时满足以下多数信号时，标记为扫描页候选：

- `native_text_char_count < 30`；
- `largest_image_area_ratio > 0.75`；
- 页面渲染成功；
- 图片分辨率足以覆盖页面；
- 原生文本 bbox 覆盖率低；
- 存在明显文本边缘，但无对应原生文本。

### 11.2 原生数字页候选

- `native_text_char_count >= 100`；
- `printable_char_ratio >= 0.95`；
- `unicode_replacement_ratio <= 0.01`；
- `duplicate_span_ratio <= 0.10`；
- 非整页单一栅格图；
- 原生文本与渲染图中的文本区域大致一致。

### 11.3 损坏文本层候选

以下任一明显成立：

- 有大量文本对象但 `printable_char_ratio < 0.80`；
- `unicode_replacement_ratio > 0.05`；
- 大量字符映射为重复无意义字形；
- 原生文本字符很多，但词序和坐标高度异常；
- 抽样 OCR 与原生文本相似度极低；
- 页面视觉上有正常文字，但原生文本是乱码。

### 11.4 混合文档

以下任一成立：

- 扫描页比例在 10% 到 90%；
- 同一页同时有高质量原生文字和包含文字的栅格区域；
- 不同章节由不同来源拼接；
- 部分页存在损坏文本层。

### 11.5 多栏文档

- 估计列数大于等于 2；
- 至少 25% 的正文页具有稳定列间空白；
- 文本块水平分布支持多栏；
- 排除双页扫描误判。

### 11.6 表格密集文档

满足任一：

- 预估表格区域占正文页面积超过 20%；
- 平均每 5 页有 2 个以上表格候选；
- 横线、竖线和对齐文本形成明显单元格结构；
- 表格标题关键词和网格结构同时出现。

### 11.7 图像密集文档

- 图片和图形区域平均占页面面积超过 35%；
- 或超过 30% 的页面包含大型图、框图、波形图、封装图、曲线图。

图像密集不等于扫描文档。Datasheet 中的原理图、框图和封装图应作为独立图片对象保留。

---

## 12. 路由策略

### 12.1 路由结果结构

```json
{
  "routing_policy_version": "router-1.0.0",
  "profile_version": "profiler-1.0.0",
  "primary_route": {
    "engine": "docling",
    "engine_profile": "digital_technical_standard",
    "page_range": "1-42",
    "reason_codes": [
      "born_digital",
      "multi_column",
      "moderate_tables"
    ],
    "score": 0.88
  },
  "preprocessing_routes": [],
  "fallback_candidates": [
    {
      "engine": "mineru",
      "reason": "complex_tables_or_low_quality"
    }
  ],
  "manual_review_conditions": [
    "all_engines_failed",
    "quality_below_0.65"
  ]
}
```

### 12.2 推荐初始路由矩阵

| 文档画像 | 预处理 | 主解析器 | 失败回退 |
|---|---|---|---|
| 原生、单栏、文本为主 | 无 | Docling standard | Native extractor |
| 原生、多栏、普通表格 | 无 | Docling standard + tables | MinerU |
| 原生、复杂表格/公式/图片 | 无 | MinerU hybrid/pipeline | Docling |
| 扫描、单栏、文字为主 | OCRmyPDF rotate/deskew 可选 | PaddleOCR 或 Docling OCR | MinerU |
| 扫描、复杂版式/表格 | OCR 图像预处理 | PaddleOCR PP-StructureV3 或 MinerU | 另一复杂解析器 |
| 混合文档 | 仅处理扫描页或损坏页 | Docling 或 MinerU 整本解析 | 页面级 OCR + 重解析 |
| 文本层乱码 | OCRmyPDF redo/force 派生版 | MinerU 或 PaddleOCR | Docling OCR |
| 图像密集技术手册 | 无 | MinerU 或 Docling | 另一解析器 |
| 所有引擎失败 | 无 | 无 | 人工审核 |

### 12.3 主路由选择原则

V1 推荐：

- Docling 作为默认常规技术文档解析器；
- MinerU 作为复杂版式、公式、跨页表格和高精度回退；
- PaddleOCR 作为扫描页和多语言 OCR/版面解析器；
- OCRmyPDF 只负责派生 PDF 预处理；
- Native extractor 负责预检、快速基线和故障兜底。

最终选择不能仅靠主观印象，必须用内部 Datasheet 基准集验证。

### 12.4 路由评分示例

每个候选引擎计算：

```text
route_score =
  capability_match
  + historical_quality
  + language_match
  + layout_match
  - estimated_cost
  - expected_latency
  - known_failure_penalty
```

各项权重必须配置化。

历史质量可按以下维度统计：

- 制造商；
- PDF 生成器；
- 文档语言；
- 文档类型；
- 扫描/数字；
- 表格密度；
- 页数区间；
- 解析器和模型版本。

V1 可先使用规则，V2 再根据已审核数据训练轻量路由分类器。

---

## 13. 页面级回退与合并

### 13.1 回退触发条件

主解析完成后，若页面满足任一条件，进入回退候选：

- 未输出任何区块；
- 文本覆盖率明显低于预检结果；
- 文本出现大量乱码；
- OCR 置信度低；
- 表格存在标题但未检测到表格；
- 表格行列结构不完整；
- 阅读顺序明显跳跃；
- 图片对象丢失；
- 页面解析超时；
- 页面与相邻页结构断裂；
- 质量评分低于配置阈值。

### 13.2 回退范围

普通页面：

- 只回退当前页。

表格或跨页结构：

- 当前页；
- 前一页；
- 后一页；
- 或检测出的连续表格页段。

禁止逐页拆分整本文档后完全失去跨页结构。

### 13.3 合并优先级

每个区块必须带：

```text
source_engine
source_engine_version
source_run_id
page_number
bbox
confidence
quality_score
raw_artifact_reference
```

合并规则示例：

1. 同一区域存在高重叠区块时，优先质量分更高者；
2. 原生高质量文本优先于 OCR 文本；
3. OCR 用于补充原生文本缺失区域；
4. 结构化表格优先于纯文本表格；
5. 图片和图注必须分别保留；
6. 不删除无法确定的候选区块，而是标记冲突；
7. 不通过语言模型“补写”缺失文字；
8. 所有覆盖和替换写入 merge log。

---

## 14. 统一 Parser Adapter

所有解析引擎实现统一接口。

```python
from typing import Protocol

class ParserAdapter(Protocol):
    name: str
    version: str

    async def health(self) -> "EngineHealth":
        ...

    async def capabilities(self) -> "EngineCapabilities":
        ...

    async def parse(self, request: "ParseRequest") -> "ParseResponse":
        ...

    async def cancel(self, run_id: str) -> None:
        ...
```

### 14.1 `ParseRequest`

```json
{
  "run_id": "uuid",
  "source_uri": "s3://...",
  "source_sha256": "hex",
  "page_ranges": ["1-42"],
  "language_hints": ["en"],
  "profile_name": "digital_technical_standard",
  "options": {
    "ocr": false,
    "tables": true,
    "formulas": false,
    "images": true,
    "reading_order": true
  },
  "output_prefix": "s3://derived/...",
  "deadline_seconds": 600,
  "callback_url": null
}
```

### 14.2 `ParseResponse`

```json
{
  "run_id": "uuid",
  "status": "completed",
  "engine": "docling",
  "engine_version": "x.y.z",
  "model_manifest": {
    "layout_model": "...",
    "table_model": "...",
    "ocr_model": null
  },
  "raw_artifacts": [
    {
      "type": "engine_json",
      "uri": "s3://..."
    },
    {
      "type": "engine_markdown",
      "uri": "s3://..."
    }
  ],
  "summary": {
    "pages_processed": 42,
    "blocks": 512,
    "tables": 31,
    "images": 52,
    "formulas": 0
  },
  "metrics": {
    "duration_ms": 92000,
    "peak_memory_mb": 4800,
    "gpu_seconds": 0
  },
  "warnings": [],
  "errors": []
}
```

---

## 15. Engine Profile

不要在调用代码中散落几十个模型参数。使用命名配置：

```yaml
profiles:
  digital_technical_standard:
    engine: docling
    ocr: false
    tables: true
    formulas: false
    images: true
    picture_classification: false

  scanned_multilingual:
    engine: paddleocr
    orientation: true
    unwarping: true
    layout: true
    tables: true
    formulas: false

  complex_technical_high_accuracy:
    engine: mineru
    backend: hybrid-auto-engine
    effort: high
    ocr: auto
    tables: true
    formulas: true
    images: true
```

每次运行必须保存完整解析后的配置和配置哈希。

---

## 16. Canonical Document IR

### 16.1 设计目标

Canonical IR 必须：

- 与具体引擎无关；
- 能表示文本、表格、图片、公式和层级；
- 保留 PDF 坐标；
- 保留阅读顺序；
- 保留来源和解析器；
- 支持 Evidence Anchoring；
- 支持后续参数抽取；
- 支持页面截图高亮；
- 支持导出 Markdown；
- 支持版本升级。

### 16.2 顶层结构

```json
{
  "schema_version": "1.0.0",
  "document": {
    "document_id": "uuid",
    "version_id": "uuid",
    "binary_object_id": "uuid",
    "source_sha256": "hex",
    "title": null,
    "language_candidates": ["en"],
    "page_count": 42
  },
  "parser": {
    "router_version": "1.0.0",
    "routing_policy_version": "router-1.0.0",
    "primary_engine": "docling",
    "engine_runs": ["uuid-1", "uuid-2"]
  },
  "pages": [],
  "document_tree": [],
  "assets": [],
  "quality": {},
  "provenance": {},
  "warnings": []
}
```

### 16.3 页面结构

```json
{
  "page_number": 1,
  "width": 612,
  "height": 792,
  "coordinate_system": "pdf_points_bottom_left",
  "classification": {
    "origin_type": "born_digital",
    "layout_types": ["multi_column"]
  },
  "route": {
    "selected_engine": "docling",
    "fallback_engine": null
  },
  "blocks": []
}
```

### 16.4 区块结构

```json
{
  "block_id": "p1-b12",
  "type": "paragraph",
  "subtype": "body",
  "page_number": 1,
  "bbox": [72.2, 510.3, 290.1, 720.5],
  "reading_order": 12,
  "parent_id": "section-2",
  "text": "Example text",
  "spans": [
    {
      "text": "Example",
      "bbox": [72.2, 690.1, 110.2, 705.4],
      "font": "Helvetica",
      "font_size": 9.0,
      "source": "native"
    }
  ],
  "confidence": 0.96,
  "quality_score": 0.94,
  "source_engine": "docling",
  "source_run_id": "uuid",
  "raw_reference": {
    "artifact_uri": "s3://...",
    "json_pointer": "/texts/12"
  }
}
```

### 16.5 区块类型

至少支持：

- `title`
- `heading`
- `paragraph`
- `list`
- `list_item`
- `table`
- `table_caption`
- `figure`
- `figure_caption`
- `formula`
- `code`
- `header`
- `footer`
- `page_number`
- `footnote`
- `reference`
- `key_value`
- `unknown`

### 16.6 表格结构

```json
{
  "block_id": "p12-table-1",
  "type": "table",
  "page_number": 12,
  "bbox": [50, 80, 560, 700],
  "rows": 12,
  "columns": 8,
  "cells": [
    {
      "row_start": 0,
      "row_end": 0,
      "col_start": 0,
      "col_end": 1,
      "text": "Electrical Characteristics",
      "bbox": [50, 650, 560, 690],
      "is_header": true,
      "confidence": 0.93
    }
  ],
  "continues_from": null,
  "continues_to": "p13-table-1",
  "source_engine": "mineru"
}
```

### 16.7 图片资产

图片不得只保存为 Markdown 链接。

```json
{
  "asset_id": "img-p8-2",
  "type": "figure",
  "page_number": 8,
  "bbox": [80, 100, 520, 500],
  "image_uri": "s3://.../images/img-p8-2.png",
  "image_sha256": "hex",
  "caption_block_id": "p8-caption-2",
  "source_engine": "mineru",
  "quality": {
    "width_px": 1600,
    "height_px": 1100,
    "clipped": false
  }
}
```

---

## 17. 坐标统一

不同工具可能使用：

- PDF points；
- 像素坐标；
- 左上角原点；
- 左下角原点；
- 归一化坐标。

Canonical IR 必须统一使用：

```text
PDF points
origin = bottom-left
page rotation = normalized to visual orientation
```

同时保存原始坐标与转换矩阵：

```json
{
  "source_coordinate_system": "pixel_top_left",
  "source_dpi": 200,
  "transform_to_canonical": [1, 0, 0, -1, 0, 792]
}
```

必须对坐标转换编写独立的单元测试和可视化回归测试。

---

## 18. 质量评估

质量评估分为两层：

1. 无标注在线质量评分；
2. 有标注离线基准测试。

### 18.1 在线质量维度

```text
text_completeness
text_sanity
layout_coverage
reading_order_consistency
table_integrity
image_extraction_integrity
ocr_confidence
cross_page_consistency
artifact_completeness
engine_warning_penalty
```

### 18.2 示例综合评分

```text
overall_quality =
  0.25 * text_score
  + 0.15 * layout_score
  + 0.15 * reading_order_score
  + 0.20 * table_score
  + 0.10 * image_score
  + 0.10 * ocr_score
  + 0.05 * cross_page_score
  - penalties
```

权重按文档画像动态调整：

- 表格密集文档提高 table 权重；
- 图像密集文档提高 image 权重；
- 扫描文档提高 OCR 权重；
- 无表格文档不应因 table 缺失被扣分。

### 18.3 文本完整性估计

可比较：

- 预检原生字符数量；
- 主解析器输出字符数量；
- OCR 抽样字符数量；
- 页面文本区域覆盖率；
- 标题、页码和表格标题的保留情况。

不能简单认为“输出文字越多越好”，重复 OCR 文本和页眉页脚复制应被惩罚。

### 18.4 表格完整性检查

检查：

- 表格是否有行和列；
- 单元格是否越界；
- 合并单元格是否自洽；
- 页内单元格 bbox 是否重叠异常；
- 表头是否存在；
- 列数是否在相邻行剧烈变化；
- 跨页表格标题和列头是否一致；
- Markdown 表格与结构化 cells 是否一致。

### 18.5 阅读顺序检查

检查：

- reading order 是否唯一、连续；
- 多栏页面是否先读完整一栏再跳到另一栏；
- 标题是否在正文前；
- 图注是否靠近对应图片；
- 表格标题是否在表格附近；
- 页眉页脚是否混入正文。

### 18.6 人工审核条件

- 所有解析器失败；
- 综合质量低于 0.65；
- 两个解析器质量接近但结果冲突严重；
- 关键页为空；
- 表格密集文档没有输出任何表格；
- 页面数与输出页数不一致；
- 坐标无法映射；
- 疑似内容丢失超过阈值；
- PDF 视觉正常但任何解析器都输出乱码。

---

## 19. 离线基准测试体系

### 19.1 内部基准集

应建立 Datasheet 专用测试集，至少覆盖：

1. 原生单栏英文；
2. 原生双栏英文；
3. 中英文混合；
4. 扫描英文；
5. 扫描中文；
6. 原生文字 + 扫描附录；
7. 乱码文本层；
8. 电气参数表密集；
9. Ordering Information 表；
10. Pin Description 表；
11. 跨页表格；
12. 多封装器件；
13. 曲线图密集；
14. 应用电路和框图密集；
15. 公式密集；
16. 页面旋转；
17. 倾斜扫描；
18. 低分辨率；
19. 厂商水印；
20. 旧版 PDF 生成器；
21. 大页数文档；
22. 页面尺寸混合；
23. 图片中文字；
24. 矢量图与文字重叠；
25. 页眉页脚复杂。

公开仓库中只提交合成或授权 Fixture。真实 Datasheet 基准集存放在内部受控对象存储。

### 19.2 标注内容

每类文档选取代表页，标注：

- 正文文本；
- 阅读顺序；
- 区块类别；
- 区块 bbox；
- 表格行列和单元格；
- 图片 bbox；
- 图注关系；
- 公式；
- 页眉页脚；
- 是否需要 OCR；
- 期望主解析器。

### 19.3 评估指标

- 字符错误率 CER；
- 单词错误率 WER；
- 区块检测 Precision / Recall；
- 阅读顺序 Kendall Tau；
- 表格结构相似度或 cell-level F1；
- 图片提取 Recall；
- bbox IoU；
- 页面成功率；
- 文档成功率；
- 平均耗时；
- P95 耗时；
- CPU 秒数；
- GPU 秒数；
- 峰值内存；
- 每千页成本；
- 人工审核率。

### 19.4 路由评估

Router 不只比较最终准确率，还应比较：

```text
固定全部用 Docling
固定全部用 MinerU
固定全部用 OCR
自动路由
自动路由 + 页面回退
```

目标是证明自动路由在质量接近或更好的情况下，降低总体耗时、GPU 使用和失败率。

---

## 20. 产物存储

### 20.1 缓存键

解析结果缓存键：

```text
source_sha256
+ routing_policy_version
+ router_version
+ engine_bundle_hash
+ canonical_schema_version
+ requested_output_profile
```

### 20.2 对象存储路径

```text
derived/pdf-parsing/
  {sha256[0:2]}/
  {sha256[2:4]}/
  {sha256}/
    {routing_policy_version}/
      profile/
        document_profile.json
        page_profiles.json.zst
      routing/
        routing_plan.json
      runs/
        {run_id}/
          request.json
          response.json
          engine_manifest.json
          raw/
          debug/
          logs/
      canonical/
        canonical_document_ir.json.zst
        document.md
        quality_report.json
        artifact_manifest.json
        images/
        tables/
```

### 20.3 数据库存储原则

考虑到约 110 万器件和数千万页面：

- PostgreSQL 不存放完整引擎 JSON；
- PostgreSQL 不存放大体积 Canonical IR；
- PostgreSQL 不存放页面截图；
- PostgreSQL 只保存任务、状态、摘要、版本、质量分、对象存储 URI 和索引字段；
- 页面级详细画像默认存储为压缩 JSON；
- 若后续需要检索区块，可建立独立文档索引服务，不应直接把所有区块塞入主业务数据库。

---

## 21. 数据模型

### 21.1 `pdf_parse_jobs`

```text
id UUID PK
version_id UUID NOT NULL
binary_object_id UUID NOT NULL
source_sha256 CHAR(64) NOT NULL
source_storage_uri TEXT NOT NULL
mode VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR
routing_policy_version VARCHAR NOT NULL
router_version VARCHAR NOT NULL
canonical_schema_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
force_reparse BOOLEAN NOT NULL DEFAULT FALSE
priority VARCHAR NOT NULL
requested_outputs JSONB NOT NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
retry_count INT NOT NULL DEFAULT 0
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

### 21.2 `pdf_document_profiles`

```text
id UUID PK
job_id UUID NOT NULL
profile_version VARCHAR NOT NULL
origin_type VARCHAR NOT NULL
layout_types JSONB NOT NULL
quality_flags JSONB NOT NULL
page_count INT NOT NULL
summary_metrics JSONB NOT NULL
profile_uri TEXT NOT NULL
confidence NUMERIC(5,4)
created_at TIMESTAMPTZ
```

### 21.3 `pdf_routing_plans`

```text
id UUID PK
job_id UUID NOT NULL
policy_version VARCHAR NOT NULL
primary_engine VARCHAR NOT NULL
primary_profile VARCHAR NOT NULL
preprocessors JSONB NOT NULL
fallback_candidates JSONB NOT NULL
decision_summary JSONB NOT NULL
plan_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

### 21.4 `pdf_parser_runs`

```text
id UUID PK
job_id UUID NOT NULL
engine_name VARCHAR NOT NULL
engine_version VARCHAR NOT NULL
engine_profile VARCHAR NOT NULL
run_type VARCHAR NOT NULL
status VARCHAR NOT NULL
page_ranges JSONB NOT NULL
request_uri TEXT NOT NULL
response_uri TEXT NULL
raw_artifact_prefix TEXT NULL
model_manifest JSONB NOT NULL
config_hash CHAR(64) NOT NULL
duration_ms BIGINT NULL
peak_memory_mb INT NULL
gpu_seconds NUMERIC NULL
quality_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
```

### 21.5 `pdf_parse_results`

```text
id UUID PK
job_id UUID NOT NULL
canonical_schema_version VARCHAR NOT NULL
canonical_ir_uri TEXT NOT NULL
markdown_uri TEXT NULL
quality_report_uri TEXT NOT NULL
artifact_manifest_uri TEXT NOT NULL
engine_manifest_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(job_id)
```

### 21.6 `pdf_parse_events`

```text
id BIGSERIAL PK
job_id UUID NOT NULL
event_type VARCHAR NOT NULL
step VARCHAR NOT NULL
payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

### 21.7 `pdf_parse_reviews`

```text
id UUID PK
job_id UUID NOT NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_results JSONB NOT NULL
resolution JSONB NULL
assigned_to VARCHAR NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

## 22. 状态机

```text
RECEIVED
  ↓
SOURCE_RESOLVING
  ↓
PREFLIGHTING
  ↓
CLASSIFYING
  ↓
ROUTING
  ↓
PREPROCESSING          可选
  ↓
PRIMARY_PARSING
  ↓
NORMALIZING
  ↓
QUALITY_EVALUATING
  ↓
FALLBACK_PLANNING      可选
  ↓
FALLBACK_PARSING       可选
  ↓
MERGING
  ↓
VALIDATING_CANONICAL_IR
  ↓
STORING_RESULTS
  ↓
COMPLETED
```

分支状态：

- `REVIEW_REQUIRED`
- `RETRY_PENDING`
- `FAILED_TEMPORARY`
- `FAILED_PERMANENT`
- `CANCELLED`

所有状态变化写入 `pdf_parse_events`。

---

## 23. API 列表

### 写接口

```text
POST /api/v1/pdf-parsing/jobs
POST /api/v1/pdf-parsing/batches
POST /api/v1/pdf-parsing/jobs/{job_id}/retry
POST /api/v1/pdf-parsing/jobs/{job_id}/cancel
POST /api/v1/pdf-parsing/jobs/{job_id}/reroute
POST /api/v1/pdf-parsing/jobs/{job_id}/reparse-pages
POST /api/v1/pdf-parsing/reviews/{review_id}/resolve
POST /api/v1/pdf-parsing/policies/validate
```

### 读接口

```text
GET /api/v1/pdf-parsing/jobs/{job_id}
GET /api/v1/pdf-parsing/jobs/{job_id}/events
GET /api/v1/pdf-parsing/jobs/{job_id}/profile
GET /api/v1/pdf-parsing/jobs/{job_id}/routing-plan
GET /api/v1/pdf-parsing/jobs/{job_id}/runs
GET /api/v1/pdf-parsing/results/{result_id}
GET /api/v1/pdf-parsing/reviews
GET /api/v1/pdf-parsing/engines
GET /api/v1/pdf-parsing/engines/{engine}/health
GET /api/v1/pdf-parsing/policies
GET /health/live
GET /health/ready
GET /metrics
```

### 内部 Worker 接口

```text
POST /internal/v1/parse
GET /internal/v1/runs/{run_id}
POST /internal/v1/runs/{run_id}/cancel
GET /internal/v1/capabilities
GET /internal/v1/health
```

内部接口必须通过服务身份认证，不应暴露到公网。

---

## 24. 错误码

至少实现：

```text
SOURCE_NOT_FOUND
SOURCE_HASH_MISMATCH
SOURCE_READ_ERROR
PDF_RENDER_FAILED
PREFLIGHT_FAILED
CLASSIFICATION_FAILED
NO_ROUTE_AVAILABLE
ROUTING_POLICY_INVALID
ENGINE_UNAVAILABLE
ENGINE_VERSION_MISMATCH
ENGINE_TIMEOUT
ENGINE_OUT_OF_MEMORY
ENGINE_OUTPUT_MISSING
ENGINE_OUTPUT_INVALID
OCR_LANGUAGE_UNAVAILABLE
OCR_PREPROCESS_FAILED
DOCLING_PARSE_FAILED
MINERU_PARSE_FAILED
PADDLEOCR_PARSE_FAILED
OCRMYPDF_FAILED
NORMALIZATION_FAILED
COORDINATE_TRANSFORM_FAILED
CANONICAL_IR_INVALID
QUALITY_BELOW_THRESHOLD
FALLBACK_EXHAUSTED
ARTIFACT_STORAGE_FAILED
JOB_CANCELLED
INTERNAL_ERROR
```

每个错误必须标记：

- 是否可重试；
- 推荐重试引擎；
- 是否需要降低并发；
- 是否需要转 CPU/GPU；
- 是否需要人工审核。

---

## 25. 资源隔离与调度

### 25.1 队列

建议至少划分：

```text
pdf-preflight-cpu
pdf-docling-cpu
pdf-docling-gpu
pdf-mineru-gpu
pdf-paddleocr-gpu
pdf-ocrmypdf-cpu
pdf-normalize-cpu
pdf-benchmark-low
```

### 25.2 限制

每个引擎配置：

- 最大页数；
- 最大文件大小；
- 单任务超时；
- 最大内存；
- 最大 GPU 显存；
- 并发数；
- 启动预热；
- 模型缓存目录；
- 每域/每租户配额；
- OOM 后退避；
- Worker 熔断。

### 25.3 超大文档

对于超大 PDF：

- 先生成全局画像；
- 按连续章节或页段拆分；
- 保留前后页重叠窗口；
- 合并时校验页数和阅读顺序；
- 不以单页作为默认拆分单位；
- 记录拆分策略。

---

## 26. 安全

必须实现：

- 只读取上游已验证对象存储资产；
- Worker 使用只读源文件权限；
- 派生产物写入单独前缀；
- 禁止执行 PDF 中的 JavaScript；
- 禁止打开 PDF 内嵌附件；
- 禁止访问 PDF 内部外部链接；
- 解析容器无公网访问或仅允许模型仓库白名单；
- 模型在部署阶段预下载；
- 临时目录隔离；
- 任务结束自动清理；
- 容器资源限制；
- 文件名和日志脱敏；
- 引擎崩溃不得影响 Router；
- 引擎原始输出视为不可信输入，归一化前必须校验；
- 防止压缩炸弹和超大图片解码；
- 对图片像素总量设置上限；
- 对嵌套对象和异常 PDF 设置解析超时。

---

## 27. 可观测性

### 27.1 Prometheus 指标

```text
pdf_parse_jobs_total{status,mode}
pdf_parse_duration_seconds{step,engine}
pdf_parse_pages_total{engine,origin_type}
pdf_route_decisions_total{engine,reason}
pdf_engine_failures_total{engine,error_code}
pdf_engine_timeouts_total{engine}
pdf_engine_oom_total{engine}
pdf_fallback_runs_total{from_engine,to_engine,reason}
pdf_quality_score{engine,document_type}
pdf_review_required_total{reason}
pdf_ocr_pages_total{engine,language}
pdf_gpu_seconds_total{engine}
pdf_cpu_seconds_total{engine}
pdf_output_bytes_total{artifact_type}
pdf_cache_hits_total{policy_version}
pdf_worker_queue_depth{queue}
```

### 27.2 结构化日志

```text
request_id
job_id
version_id
binary_object_id
source_sha256
routing_policy_version
profile_version
engine
engine_version
engine_profile
run_id
page_ranges
step
duration_ms
peak_memory_mb
gpu_seconds
quality_score
error_code
retry_count
```

不得记录整页 OCR 文本。

### 27.3 解析质量看板

至少展示：

- 每日解析文档数；
- 成功率；
- 各引擎占比；
- 各类文档路由占比；
- 回退率；
- 人工审核率；
- 平均和 P95 时间；
- GPU 使用；
- 每千页成本；
- 各制造商平均质量；
- 各 PDF Producer 的失败率；
- 解析器版本升级前后对比。

---

## 28. 仓库结构

如果与第一个 Agent 位于同一仓库，优先共享：

- 公共事件定义；
- 数据库连接；
- 对象存储；
- 任务队列；
- 认证；
- 日志；
- 可观测性；
- 测试基础设施。

推荐结构：

```text
pdf-parsing-router-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── pdf-parsing-ocr-router-spec.md
│   ├── architecture.md
│   ├── canonical-ir.md
│   ├── routing-policy.md
│   ├── engine-adapters.md
│   ├── quality-evaluation.md
│   ├── benchmark.md
│   ├── deployment.md
│   ├── licensing.md
│   └── adr/
│       ├── 0001-page-profile-document-route.md
│       ├── 0002-engine-container-isolation.md
│       ├── 0003-canonical-ir.md
│       └── 0004-no-external-llm-v1.md
├── src/
│   └── pdf_router/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── preflight/
│       │   ├── pdf_inspector.py
│       │   ├── page_profiler.py
│       │   ├── text_quality.py
│       │   ├── image_quality.py
│       │   ├── layout_features.py
│       │   └── language.py
│       ├── routing/
│       │   ├── classifier.py
│       │   ├── policy.py
│       │   ├── planner.py
│       │   └── config/
│       ├── adapters/
│       │   ├── base.py
│       │   ├── docling.py
│       │   ├── mineru.py
│       │   ├── paddleocr.py
│       │   ├── ocrmypdf.py
│       │   └── native.py
│       ├── normalization/
│       │   ├── canonical_models.py
│       │   ├── docling_normalizer.py
│       │   ├── mineru_normalizer.py
│       │   ├── paddleocr_normalizer.py
│       │   ├── coordinate_transform.py
│       │   └── markdown_exporter.py
│       ├── quality/
│       │   ├── scorer.py
│       │   ├── text_checks.py
│       │   ├── table_checks.py
│       │   ├── reading_order.py
│       │   └── fallback.py
│       ├── merge/
│       │   ├── block_matcher.py
│       │   ├── conflict_resolver.py
│       │   └── merge_log.py
│       ├── storage/
│       ├── review/
│       ├── observability/
│       └── security/
├── services/
│   ├── docling-worker/
│   ├── mineru-worker/
│   ├── paddleocr-worker/
│   └── ocrmypdf-worker/
├── schemas/
│   ├── canonical-document-ir.schema.json
│   ├── parser-request.schema.json
│   └── parser-response.schema.json
├── policies/
│   ├── router-1.0.0.yaml
│   └── engine-profiles.yaml
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── routing/
│   ├── normalization/
│   ├── visual_regression/
│   ├── security/
│   ├── concurrency/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── annotations/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── generate_synthetic_pdfs.py
    ├── run_benchmark.py
    ├── compare_engines.py
    ├── validate_canonical_ir.py
    └── render_bbox_overlay.py
```

---

## 29. 测试 Fixture

公开仓库测试 Fixture 应通过脚本生成，至少包含：

1. 原生单栏；
2. 原生双栏；
3. 三栏；
4. 表格；
5. 合并单元格；
6. 跨页表格；
7. 图片和图注；
8. 公式；
9. 中英文混合；
10. 整页扫描；
11. 原生与扫描混合；
12. 隐藏 OCR 层；
13. 乱码 ToUnicode；
14. 重复文本层；
15. 旋转 90 度；
16. 倾斜 3 度；
17. 低 DPI；
18. 模糊；
19. 页面尺寸混合；
20. 超大图片；
21. 空白页；
22. 页眉页脚；
23. 脚注；
24. 列表；
25. 矢量图；
26. 图片中文字；
27. PDF 内嵌附件；
28. PDF JavaScript；
29. 损坏对象；
30. 解析器返回无效 JSON；
31. Worker 超时；
32. Worker OOM；
33. 同一任务并发提交；
34. 同一输入相同策略缓存命中；
35. 策略版本变化触发新解析。

---

## 30. 验收标准

### 30.1 功能验收

- 能接收 `datasheet.asset.ready`；
- 能完成 profile-only；
- 能正确区分原生、扫描、混合和乱码文本层；
- 能识别单栏、多栏、表格密集和图像密集；
- 能生成可解释路由计划；
- 能调用至少 Docling Adapter；
- 能调用至少一个 OCR 路线；
- 能保存引擎原始结果；
- 能生成 Canonical IR；
- 能输出 Markdown；
- 能保存图片和表格；
- 能进行质量评分；
- 能对低质量页执行一次回退；
- 能记录 merge log；
- 能发布 `datasheet.parse.ready`；
- 所有写操作幂等；
- 同一配置可命中缓存；
- 不覆盖原始 PDF。

### 30.2 V1 最低引擎范围

建议 V1 最低可交付范围：

1. Native preflight；
2. Docling Adapter；
3. OCRmyPDF 预处理 Adapter；
4. PaddleOCR 或 Docling OCR 中至少一个 OCR 解析路线；
5. MinerU Adapter 的接口和容器骨架；
6. MinerU 完整解析可在 V1.1 完成。

若你希望 V1 就比较 Docling 与 MinerU，则把 MinerU 完整 Adapter 提升到 V1 必做项。

### 30.3 工程质量

- Router 单元测试覆盖率不低于 85%；
- 坐标转换模块覆盖率不低于 95%；
- 路由规则测试覆盖所有默认路线；
- Adapter 有契约测试；
- Canonical IR 通过 JSON Schema；
- Alembic upgrade/downgrade 成功；
- Ruff 通过；
- mypy 通过；
- Docker Compose 能启动全部启用的服务；
- 解析 Worker 不共享 Python site-packages；
- 所有镜像固定版本；
- 模型版本和校验和可查询；
- 测试不得伪造引擎真实运行结果。

### 30.4 性能基线

预检：

- 50 页原生 PDF，在普通 CPU 环境目标小于 5 秒；
- 预检内存不得随渲染 DPI 无限制增长；
- 默认只渲染缩略图或抽样页，不全页高 DPI 渲染。

解析：

- 按引擎分别记录，不设统一虚假指标；
- 必须报告每页耗时、P95、峰值内存和 GPU 秒；
- 生产路由必须设置最大运行时；
- 100 个相同任务并发提交只产生一个有效结果；
- Worker OOM 后任务可重试到其他队列或进入审核。

### 30.5 质量基线

在内部 Datasheet 基准集上：

- 原生文本正文字符召回率目标不低于 98%；
- 扫描清晰英文页 CER 目标不高于 3%；
- 扫描清晰中文页 CER 目标根据模型基线设定；
- 页面输出完整率不低于 99%；
- 图像提取召回率目标不低于 95%；
- 表格密集测试页必须单独报告 cell-level F1；
- 自动路由相较“全部使用默认解析器”应降低失败率或资源成本；
- 不允许只给综合平均分掩盖复杂表格失败。

上述数值是内部目标，不是对所有现实 PDF 的保证。基准结果必须按文档类别分组展示。

---

## 31. Codex 分阶段实施

不要让 Codex 一次性实现所有功能。

### Phase 0：仓库侦察、现状对齐和实施计划

Codex 必须：

1. 阅读仓库；
2. 阅读第一个 Agent 的规格和实现；
3. 查找现有事件、对象存储、数据库、任务队列、日志、Docker 和 CI；
4. 查找仓库是否已使用 Docling、MinerU、PaddleOCR、OCRmyPDF、PyMuPDF；
5. 明确各引擎是否应本地库调用还是独立服务；
6. 生成 `docs/pdf-parsing-router-implementation-plan.md`；
7. 生成依赖与许可证清单；
8. 生成初步基准测试计划；
9. 不修改业务实现；
10. 不安装模型；
11. 不新增数据库 migration。

### Phase 1：领域模型、契约和服务骨架

实现：

- Parsing Job；
- Profile；
- Routing Plan；
- Parser Run；
- Result；
- Review；
- JSON Schema；
- Adapter protocol；
- Worker API contract；
- health；
- Docker Compose 骨架；
- Mock Parser Worker。

验收：

- Router 可调用 Mock Worker；
- Contract tests 通过；
- Canonical IR 空文档通过 Schema。

### Phase 2：Native Preflight 与 Page Profiler

实现：

- PDF 基础检查；
- 原生文本抽样；
- 图片和对象统计；
- 页面缩略图；
- 文本质量；
- 扫描候选；
- 多栏特征；
- 表格和图像密度特征；
- profile-only API；
- profile artifact。

验收：

- 合成 Fixture 分类结果符合预期；
- 50 页预检性能达到基线；
- 不调用重型模型。

### Phase 3：文档分类与路由策略

实现：

- 多标签分类；
- YAML 策略；
- 路由评分；
- 路由解释；
- 策略 Schema；
- 策略版本；
- 规则测试；
- 人工 override。

验收：

- 每个 Fixture 命中预期路线；
- 路由决策可解释；
- 修改策略不需要改代码。

### Phase 4：Docling Worker 与 Adapter

实现：

- 独立 Docling 容器；
- Worker API；
- model/config manifest；
- 原始 JSON/Markdown 输出；
- Docling → Canonical IR；
- 图片和表格保存；
- 超时和取消；
- Adapter contract tests。

验收：

- 原生、多栏、表格 Fixture 成功；
- 输出坐标可视化叠加正确；
- 引擎版本可追溯。

### Phase 5：OCR 预处理与扫描路线

实现：

- OCRmyPDF Worker；
- rotate、deskew、skip、redo 配置；
- 派生 PDF；
- PaddleOCR 或 Docling OCR 路线；
- OCR 语言选择；
- 扫描页质量评分；
- 原始 PDF 与派生 PDF 关联。

验收：

- 扫描、旋转、倾斜、混合 PDF 测试通过；
- 不覆盖原始 PDF；
- 原生页在 skip 模式下不被无意义栅格化。

### Phase 6：MinerU Worker 与 Adapter

实现：

- 独立 MinerU 容器；
- Worker API；
- pipeline/hybrid 配置；
- 原始 `middle.json`、`content_list.json`；
- 布局和 span 调试文件；
- MinerU → Canonical IR；
- 表格、图片、公式；
- 版本和许可证记录。

验收：

- 复杂多栏、公式和跨页表格 Fixture 通过；
- 原始调试文件可访问；
- 输出与 Canonical IR 对齐。

### Phase 7：质量评分和回退

实现：

- 在线质量评分；
- 页面级异常检测；
- 回退计划；
- 相邻页窗口；
- 最多回退次数；
- 回退成本限制；
- review 条件。

验收：

- 人为制造失败时能自动转到备用引擎；
- 不出现无限回退；
- 每次回退有 reason code。

### Phase 8：结果合并与冲突处理

实现：

- bbox 匹配；
- 文本相似度；
- 区块去重；
- 原生/OCR 优先级；
- 表格优先级；
- 图片和图注关系；
- merge log；
- Canonical IR 最终校验；
- Markdown 导出。

验收：

- 混合页不重复输出两套正文；
- 所有覆盖操作可追溯；
- 坐标叠加回归测试通过。

### Phase 9：完整 API、事件和批处理

实现：

- 第 23 节 API；
- 上游事件订阅；
- 下游事件发布；
- 批处理；
- 幂等；
- 缓存；
- retry/cancel；
- 审核接口；
- 分页和过滤。

验收：

- 从 asset.ready 到 parse.ready 的端到端测试通过；
- 重复事件不重复解析；
- 策略版本变化可触发新结果。

### Phase 10：Benchmark、可观测性和生产部署

实现：

- 合成基准集；
- 内部基准 manifest；
- CER/WER；
- 表格指标；
- reading order；
- 资源成本；
- 引擎比较报告；
- Prometheus；
- Grafana；
- README；
- 运维手册；
- 模型升级流程；
- 回滚流程。

验收：

- 能生成 Docling/MinerU/OCR/自动路由对比报告；
- 新开发者可按 README 启动演示；
- 模型升级前后有可比较报告。

---

## 32. Codex 工作纪律

Codex 必须遵守：

1. 先读仓库，再编码；
2. 优先复用第一个 Agent 的基础设施；
3. 不创建第二套事件协议；
4. 不创建第二套对象存储封装；
5. 不创建第二套认证系统；
6. 不把 Docling、MinerU 和 PaddleOCR 强行装进同一 Python 环境；
7. 所有解析器通过 Adapter；
8. 所有引擎输出先校验再归一化；
9. 所有坐标转换必须有测试；
10. 不覆盖原始 PDF；
11. 不将完整解析结果写入主业务数据库；
12. 不使用外部通用 LLM；
13. 不用 LLM 补写缺失文字；
14. 不默认对每份文档运行全部解析器；
15. 不默认全页高 DPI 渲染；
16. 不在代码中写死路由阈值；
17. 不在代码中写死模型下载 URL；
18. 不提交模型文件；
19. 不提交真实受版权保护 Datasheet；
20. 不伪造 Docling、MinerU 或 OCR 实际测试结果；
21. 每完成一个 Phase，必须输出：
    - 修改文件；
    - 架构决策；
    - API 和 Schema 变化；
    - 测试命令；
    - 真实测试结果；
    - 性能结果；
    - 已知问题；
    - 下一阶段范围。

---

## 33. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/pdf-parsing-ocr-router-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第二个基础 Agent：

PDF Parsing & OCR Routing Agent。

请先完整阅读：

1. 仓库根目录的 AGENTS.md；
2. docs/datasheet-asset-ingestion-agent-spec.md；
3. docs/pdf-parsing-ocr-router-agent-spec.md；
4. 第一个 Datasheet Asset Ingestion Agent 的代码、数据模型、事件协议和测试；
5. 当前仓库 README、数据库、任务队列、对象存储、认证、日志、Docker 和 CI 配置。

本 Agent 的职责是：

- 接收已通过上游 Agent 验证和去重的 PDF；
- 对每一页进行低成本预检；
- 识别原生、扫描、混合和乱码文本层；
- 识别单栏、多栏、表格密集、图像密集和复杂版式；
- 生成可解释、可版本化的路由计划；
- 调用 Docling、MinerU、PaddleOCR 和 OCRmyPDF 等独立 Worker；
- 将不同解析器结果归一化为 Canonical Document IR；
- 进行在线质量评分；
- 对低质量页面执行有限回退；
- 保存原始引擎产物、标准 IR、Markdown、图片、表格和质量报告；
- 发布 datasheet.parse.ready 事件。

硬约束：

- V1 不调用外部通用大模型；
- 不使用 LLM 补写 PDF 中不存在的文字；
- 原始 PDF 不可修改；
- OCR 和旋转输出必须作为派生资产；
- Docling、MinerU、PaddleOCR、OCRmyPDF 使用独立 Worker/容器；
- Router 业务代码不能直接依赖引擎内部对象；
- 所有引擎通过统一 Adapter；
- 所有路由阈值配置化并版本化；
- 所有引擎版本、模型版本和配置必须可追溯；
- 所有自动路由必须保存理由、特征、评分和候选路线；
- PostgreSQL 不存放完整解析 JSON 或页面图片；
- Canonical IR 必须保留页面、bbox、阅读顺序、来源和 provenance；
- 不把所有文档同时送入所有引擎；
- 不提交真实受版权保护 Datasheet 作为 Fixture；
- 不伪造任何引擎测试结果。

现在只执行 Phase 0，不要实现业务代码：

1. 侦察当前仓库结构；
2. 查找第一个 Agent 已有的可复用模块；
3. 查找现有 PDF、OCR、Docling、MinerU、PaddleOCR 或 OCRmyPDF 相关代码；
4. 识别当前部署环境的 CPU、GPU、CUDA、对象存储和任务队列约束；
5. 对比“Python 库内调用”和“独立 Worker/容器”两种方式，并给出选择；
6. 检查各依赖当前许可证，特别是 MinerU；
7. 在 docs/pdf-parsing-router-implementation-plan.md 中生成详细实施计划；
8. 在 docs/pdf-parser-engine-evaluation.md 中生成引擎评估矩阵；
9. 在 docs/pdf-parser-benchmark-plan.md 中生成 Datasheet 基准测试计划；
10. 给出 Canonical Document IR 初稿和 JSON Schema 文件计划；
11. 给出拟新增、拟修改、拟复用文件清单；
12. 给出 Phase 1 精确修改范围；
13. 不安装模型；
14. 不创建数据库 migration；
15. 不修改业务实现；
16. 运行仓库当前已有 lint、type check 和测试。

如果环境无法运行测试，记录准确原因，不得编造结果。

最终回复必须包含：

- 仓库现状；
- 与第一个 Agent 的衔接方式；
- 拟复用模块；
- 引擎隔离方案；
- Canonical IR 方案；
- 路由方案；
- 基准测试方案；
- 许可证风险；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

## 34. 后续 Phase 提示词模板

```text
继续实现 PDF Parsing & OCR Routing Agent 的 Phase {N}。

开始前必须：

1. 阅读 AGENTS.md；
2. 阅读 docs/datasheet-asset-ingestion-agent-spec.md；
3. 阅读 docs/pdf-parsing-ocr-router-agent-spec.md；
4. 阅读 docs/pdf-parsing-router-implementation-plan.md；
5. 阅读上一阶段代码和测试结果；
6. 检查当前分支改动；
7. 只修改本阶段范围。

本阶段目标：

{粘贴本规格中 Phase N 的目标和验收标准}

硬约束：

- 不调用外部通用大模型；
- 不使用 LLM 补写内容；
- 不覆盖原始 PDF；
- 引擎独立容器；
- 所有解析器通过 Adapter；
- 路由阈值配置化；
- 引擎和模型版本可追溯；
- PostgreSQL 不存大体积解析结果；
- Canonical IR 保留 bbox 和 provenance；
- 不默认运行全部引擎；
- 不提交模型；
- 不提交真实 Datasheet；
- 不重构与本阶段无关代码。

执行顺序：

1. 列出实施步骤；
2. 编写或更新测试；
3. 实现代码；
4. 运行格式化；
5. 运行 lint；
6. 运行 type check；
7. 运行单元测试；
8. 运行本阶段集成测试；
9. 运行必要的性能或视觉回归测试；
10. 修复失败；
11. 更新文档；
12. 总结修改。

最终回复：

- 修改文件；
- Schema/API 变化；
- 配置变化；
- 引擎和模型版本；
- 测试命令与真实结果；
- 性能结果；
- 已知限制；
- 下一阶段建议。
```

---

## 35. MVP 演示流程

完成 V1 后，演示应覆盖：

1. 上游 Agent 导入一个原生 Datasheet；
2. 本 Agent 自动接收 `asset.ready`；
3. 生成页面画像；
4. 判定为原生、多栏、表格密集；
5. 路由到 Docling；
6. 输出 Canonical IR 和 Markdown；
7. 可视化 bbox 与原 PDF 对齐；
8. 导入一个扫描 Datasheet；
9. 检测旋转和倾斜；
10. 使用 OCR 预处理；
11. 解析并输出 OCR 置信度；
12. 导入一个混合 PDF；
13. 只对扫描页做 OCR；
14. 主解析器某一页质量不足；
15. 自动用 MinerU 或另一引擎回退；
16. 合并后无重复正文；
17. 展示 merge log；
18. 查询最终质量报告；
19. 重复提交命中缓存；
20. 修改路由策略版本后重新解析；
21. 发布 `datasheet.parse.ready`；
22. 下游 Agent 根据 Canonical IR 读取文本、表格和图片。

---

## 36. 下游事件

```json
{
  "event_type": "datasheet.parse.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "binary_object_id": "uuid",
  "source_sha256": "hex",
  "parse_result_id": "uuid",
  "canonical_schema_version": "1.0.0",
  "canonical_ir_uri": "s3://.../canonical_document_ir.json.zst",
  "markdown_uri": "s3://.../document.md",
  "artifact_manifest_uri": "s3://.../artifact_manifest.json",
  "quality_report_uri": "s3://.../quality_report.json",
  "routing_policy_version": "router-1.0.0",
  "primary_engine": "docling",
  "engine_runs": [
    {
      "engine": "docling",
      "version": "x.y.z",
      "run_id": "uuid"
    }
  ],
  "overall_quality": 0.91,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

建议只有满足以下条件的结果自动进入后续 Agent：

```text
review_status = approved
AND overall_quality >= configured_threshold
AND canonical_ir_schema_valid = true
AND page_count_matches = true
```

---

## 37. 官方参考资料

Codex 实施前应重新核对最新版本、配置和许可证。

### Docling

- Documentation: https://docling-project.github.io/docling/
- DoclingDocument: https://docling-project.github.io/docling/concepts/docling_document/
- Pipeline options: https://docling-project.github.io/docling/reference/pipeline_options/
- GitHub: https://github.com/docling-project/docling
- License: https://github.com/docling-project/docling/blob/main/LICENSE

### MinerU

- Documentation: https://opendatalab.github.io/MinerU/
- Output files: https://opendatalab.github.io/MinerU/reference/output_files/
- GitHub: https://github.com/opendatalab/MinerU
- License: https://github.com/opendatalab/MinerU/blob/master/LICENSE.md

### PaddleOCR

- Documentation: https://www.paddleocr.ai/
- PP-StructureV3: https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/algorithm/PP-StructureV3/PP-StructureV3.html
- GitHub: https://github.com/PaddlePaddle/PaddleOCR

### OCRmyPDF

- Documentation: https://ocrmypdf.readthedocs.io/
- Advanced modes: https://ocrmypdf.readthedocs.io/en/latest/advanced.html
- Cookbook: https://ocrmypdf.readthedocs.io/en/latest/cookbook.html
- GitHub: https://github.com/ocrmypdf/OCRmyPDF
