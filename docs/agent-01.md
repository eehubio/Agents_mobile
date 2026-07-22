# Datasheet 资产接入 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：Datasheet Asset Ingestion Agent  
> 版本：V1.0  
> 定位：程序型 Agent，不依赖大模型  
> 目标读者：产品负责人、后端工程师、数据工程师、Codex

---

## 1. 项目目标

建设一个独立、可复用、可测试的 Datasheet 资产接入服务，接收以下来源：

1. 厂商产品页或 Datasheet URL；
2. 分销商产品页或 Datasheet URL；
3. 用户本地上传的 PDF；
4. ezPLM 已有元器件记录绑定的 PDF URL；
5. 后续批量导入任务。

Agent 完成以下工作：

- 安全下载或接收 PDF；
- 验证文件确实是可读取的 PDF；
- 计算 SHA256，执行二进制级去重；
- 保存原始文件及来源；
- 提取基础文档元数据；
- 识别单型号 Datasheet、Family Datasheet 或未知文档；
- 将文档与一个或多个制造商型号关联；
- 判断文档是否是已有 Datasheet 的新版本；
- 保存完整审计信息；
- 将低置信度结果送入人工审核；
- 为后续参数抽取、引脚抽取、图片提取、KiCad 库生成等 Agent 输出统一资产标识。

### 1.1 V1 不做的事情

V1 明确不负责：

- 全文参数抽取；
- 表格识别；
- 引脚表抽取；
- 框图和应用图提取；
- OCR；
- KiCad 符号、封装或 3D 生成；
- 使用大模型判断文档内容；
- 绕过登录、验证码、付费墙或网站访问限制；
- 大规模通用网页爬虫。

这些功能由后续 Agent 完成。V1 只保证资产接入结果真实、唯一、可追溯、可版本化。

---

## 2. 核心设计原则

### 2.1 原始文件不可变

一旦 PDF 按 SHA256 保存，原始二进制文件不可修改。任何清洗、OCR、分页、文本化结果必须作为派生资产保存，不得覆盖原文件。

### 2.2 二进制资产、文档、版本和来源分离

必须区分四个概念：

- `binary_object`：具体 PDF 字节内容，以 SHA256 唯一；
- `datasheet_document`：逻辑上的一份 Datasheet，例如“LM358 Family Datasheet”；
- `datasheet_version`：该逻辑文档的某次版本；
- `datasheet_source`：文件从哪个 URL、上传者或系统记录获得。

同一个 PDF 可以来自多个 URL；同一个逻辑文档可以有多个版本；一个版本只能指向一个原始二进制对象。

### 2.3 所有操作幂等

相同输入被重复提交时，不应重复创建资产、文档版本或关联记录。

### 2.4 程序优先，人工兜底

能用哈希、规则、数据库匹配和文档元数据判断的，不调用大模型。不能可靠判断的，进入人工审核，而不是强行给出结果。

### 2.5 所有自动判断带证据和置信度

型号关联、Family 判断、版本判断必须保存：

- 判断结果；
- 置信度；
- 使用的规则；
- 命中的证据；
- 候选项；
- 是否需要人工确认。

---

## 3. 推荐技术栈

如果现有 ezPLM 仓库已有统一技术栈，优先适配现有架构。若是新建独立服务，默认采用：

- Python 3.12；
- FastAPI；
- PostgreSQL；
- SQLAlchemy 2；
- Alembic；
- Redis；
- Celery；
- S3 兼容对象存储，开发环境使用 MinIO；
- HTTPX；
- PyMuPDF；
- pypdf；
- python-magic；
- BeautifulSoup，仅用于静态 HTML 中查找公开 PDF 链接；
- Pydantic；
- pytest；
- respx；
- Docker Compose；
- Ruff；
- mypy；
- pre-commit。

不得把对象存储替换成数据库 BLOB。数据库只保存路径、哈希、大小和元数据。

---

## 4. 系统架构

```text
             ┌────────────────────────────┐
             │ ezPLM / UI / Batch Import  │
             └──────────────┬─────────────┘
                            │
                     REST API / Job
                            │
              ┌─────────────▼─────────────┐
              │   Ingestion API Service   │
              └─────────────┬─────────────┘
                            │
                    PostgreSQL Job
                            │
              ┌─────────────▼─────────────┐
              │ Celery Ingestion Worker   │
              └─────────────┬─────────────┘
                            │
       ┌────────────────────┼─────────────────────┐
       │                    │                     │
┌──────▼───────┐   ┌────────▼────────┐   ┌────────▼────────┐
│ URL Resolver │   │ Upload Receiver │   │ Existing Asset  │
│ + Downloader │   │                 │   │ Import Adapter  │
└──────┬───────┘   └────────┬────────┘   └────────┬────────┘
       └────────────────────┼─────────────────────┘
                            │
                  PDF Validation + SHA256
                            │
                 Binary Deduplication Layer
                            │
                 S3 / MinIO Immutable Storage
                            │
       Metadata → Part Matching → Family Detection
                            │
                 Document Version Resolution
                            │
           Completed / Review Required / Failed
                            │
              Standard Asset Event / Agent Output
```

---

## 5. Agent 输入

### 5.1 URL 接入

`POST /api/v1/datasheet-ingestions/url`

```json
{
  "url": "https://www.example.com/path/device.pdf",
  "manufacturer_hint": "Texas Instruments",
  "mpn_hints": ["LM358", "LM358DR"],
  "source_type": "manufacturer",
  "submitted_by": "user-or-system-id",
  "project_id": "optional-project-id",
  "idempotency_key": "client-generated-key"
}
```

`source_type`：

- `manufacturer`
- `distributor`
- `third_party`
- `legacy_import`
- `unknown`

### 5.2 本地 PDF 上传

`POST /api/v1/datasheet-ingestions/upload`

使用 `multipart/form-data`：

- `file`
- `manufacturer_hint`
- `mpn_hints`
- `source_type`
- `submitted_by`
- `project_id`
- `idempotency_key`

### 5.3 批量接入

`POST /api/v1/datasheet-ingestions/batch`

```json
{
  "items": [
    {
      "url": "https://...",
      "manufacturer_hint": "STMicroelectronics",
      "mpn_hints": ["STM32F103C8T6"]
    }
  ],
  "batch_name": "legacy-pdf-import-2026-07",
  "submitted_by": "system"
}
```

V1 限制单批最大 1,000 条。更大任务由上层分批提交。

---

## 6. Agent 输出

所有成功或需要审核的任务使用统一结构：

```json
{
  "agent_id": "datasheet-asset-ingestion",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",
  "binary_asset": {
    "binary_object_id": "uuid",
    "sha256": "hex",
    "size_bytes": 1234567,
    "mime_type": "application/pdf",
    "page_count": 42,
    "storage_uri": "s3://datasheets/sha256/ab/cd/hash.pdf",
    "is_new_binary": true
  },
  "document": {
    "document_id": "uuid",
    "version_id": "uuid",
    "document_type": "family_datasheet",
    "manufacturer_id": "uuid",
    "title": "LM358 Family Datasheet",
    "document_number": "SNOSBT3",
    "revision": "Rev. P",
    "published_at": "2025-04-01",
    "is_current_version": true,
    "is_new_version": true
  },
  "part_associations": [
    {
      "part_id": "uuid",
      "manufacturer_part_number": "LM358",
      "relationship": "family_member",
      "confidence": 0.99,
      "evidence": [
        {
          "type": "first_page_text",
          "value": "LM358..."
        }
      ]
    }
  ],
  "deduplication": {
    "binary_duplicate": false,
    "existing_binary_object_id": null,
    "matched_document_id": null
  },
  "review": {
    "required": false,
    "reasons": []
  },
  "issues": [],
  "created_at": "ISO-8601"
}
```

---

## 7. 状态机

任务状态必须持久化：

```text
RECEIVED
  ↓
SOURCE_VALIDATING
  ↓
RESOLVING_URL          仅非直接 PDF URL
  ↓
DOWNLOADING            URL 任务
  ↓
FILE_VALIDATING
  ↓
HASHING
  ↓
DEDUPLICATING
  ↓
STORING_BINARY
  ↓
EXTRACTING_METADATA
  ↓
MATCHING_MANUFACTURER
  ↓
MATCHING_PARTS
  ↓
DETECTING_DOCUMENT_TYPE
  ↓
RESOLVING_VERSION
  ↓
COMPLETED
```

分支状态：

- `REVIEW_REQUIRED`
- `RETRY_PENDING`
- `FAILED_PERMANENT`
- `CANCELLED`

每次状态变化写入 `ingestion_events`，不得只写应用日志。

---

## 8. URL 解析和下载

### 8.1 URL 安全要求

只允许：

- `https://`
- 可配置是否允许 `http://`

必须拒绝：

- `file://`
- `ftp://`
- `data:`
- `javascript:`
- localhost；
- 私网 IP；
- 链路本地地址；
- 云服务 metadata 地址；
- URL 中嵌入用户名和密码；
- 解析后指向私网的 DNS rebinding；
- 超过最大跳转次数的重定向。

默认限制：

- 最大文件 100 MB；
- 下载超时 60 秒；
- 连接超时 10 秒；
- 最多 5 次重定向；
- 流式下载；
- 最大 HTML 页面 5 MB；
- User-Agent 使用明确的 ezPLM 标识；
- 每域名并发数可配置；
- 不绕过网站访问限制。

### 8.2 直接 PDF URL

不能只相信 `Content-Type`。必须同时检查：

- HTTP 状态码；
- 文件头是否以 `%PDF-` 开始；
- PyMuPDF 能否打开；
- 页数大于 0；
- 解析时无致命错误；
- 文件尾和交叉引用异常是否可接受。

HTML 错误页伪装成 `.pdf` 必须拒绝。

### 8.3 产品页或分销商页面

V1 实现轻量 `URLResolver` 插件接口：

```python
class URLResolver(Protocol):
    def supports(self, url: str) -> bool: ...
    async def resolve(self, url: str, context: ResolveContext) -> ResolveResult: ...
```

默认实现：

1. 下载静态 HTML；
2. 查找 `<a href>`、`<link>`、`meta` 中的 PDF 候选；
3. 将相对 URL 转换成绝对 URL；
4. 根据以下信号打分：
   - 链接文本包含 datasheet；
   - URL 以 `.pdf` 结尾；
   - URL 或链接文本包含 MPN hint；
   - URL 与厂商域名一致；
   - `rel=canonical` 或 download 属性；
5. 最高分高于阈值时自动下载；
6. 有多个相近候选时进入审核；
7. 动态 JavaScript 页面、登录页和验证码不使用浏览器自动化强行处理。

为厂商和分销商预留独立 Adapter，但 V1 不要求实现所有站点。

---

## 9. PDF 验证和哈希去重

### 9.1 哈希策略

下载或上传时使用流式 SHA256：

```text
incoming stream
  ├─ calculate sha256
  ├─ calculate size
  ├─ write temporary file
  └─ validate PDF
```

验证通过后再移动到正式对象存储。

对象路径：

```text
datasheets/sha256/{hash[0:2]}/{hash[2:4]}/{sha256}.pdf
```

### 9.2 并发去重

数据库必须对 `binary_objects.sha256` 设置唯一约束。

两个 Worker 同时处理相同文件时：

- 第一个事务创建记录；
- 第二个捕获唯一约束冲突；
- 查询已有记录并复用；
- 不产生重复对象；
- 临时文件安全删除。

### 9.3 两级去重

V1 实现：

1. **强去重**：SHA256 完全相同；
2. **弱重复候选**：文本指纹高度相似，但二进制不同。

弱重复只做候选提示，不自动合并。原因包括 PDF 元数据变化、重新压缩、增加水印等。

文本指纹建议：

- 提取前 5 页和最后 2 页文本；
- 统一空白和大小写；
- 去除 URL、下载时间等高变化字段；
- 计算 SimHash；
- 相似度超过阈值时标记 `possible_duplicate`。

---

## 10. 基础元数据提取

V1 从以下位置提取：

- PDF metadata；
- 文件名；
- URL；
- 第一页；
- 前 5 页；
- 最后 2 页。

目标字段：

- title；
- subject；
- author；
- creator；
- producer；
- creation date；
- modification date；
- page count；
- document number；
- revision；
- publication date；
- copyright year；
- manufacturer name；
- candidate MPNs；
- language；
- encrypted；
- malformed/repaired；
- text available。

每个字段保存：

```json
{
  "value": "Rev. P",
  "source": "first_page_text",
  "confidence": 0.94,
  "evidence": {
    "page": 1,
    "text": "Revision P"
  }
}
```

---

## 11. 制造商和型号匹配

### 11.1 数据库为主

ezPLM 的制造商表和元器件主数据表是权威来源。不得仅根据网页字符串创建正式元器件。

允许创建：

- 未确认制造商候选；
- 未确认型号候选；
- 人工审核任务。

### 11.2 型号归一化

需要保留：

- `mpn_raw`
- `mpn_normalized`
- `mpn_search_key`

归一化规则不得简单删除所有符号。建议：

- Unicode 统一；
- 大小写统一；
- 空白标准化；
- 区分有意义的 `/`、`-`、`.`；
- 使用制造商专属规则；
- 订货后缀和基础型号分别保存；
- 将包装、温度、RoHS、卷带后缀解析为属性，但不得擅自丢弃。

### 11.3 匹配优先级

1. API 输入的 `mpn_hints` 精确匹配；
2. URL 和文件名匹配；
3. 第一页标题匹配；
4. 前 5 页文本匹配；
5. 文档编号和已有 Datasheet 记录匹配；
6. 制造商＋型号别名匹配；
7. Family pattern 候选。

### 11.4 关联类型

- `primary_part`
- `family_member`
- `ordering_variant`
- `package_variant`
- `cross_reference`
- `mentioned_only`
- `unconfirmed`

只有前四类可以被后续参数抽取 Agent 默认消费。

---

## 12. Family Datasheet 识别

输出分类：

- `single_part_datasheet`
- `family_datasheet`
- `product_brief`
- `application_note`
- `package_document`
- `errata`
- `unknown`

V1 的 Family 判定规则：

1. 文档标题明确包含多个型号；
2. 第一页列出系列型号；
3. Ordering Information 中出现多个已知兄弟型号；
4. 命中同一制造商、同一系列的多个主数据型号；
5. API 输入包含多个型号且文档证据支持；
6. 标题包含 family、series 等明确表述。

不得仅因文档内提到多个器件就判定为 Family Datasheet。应用电路中出现的外围器件只能标记为 `mentioned_only`。

建议评分：

```text
明确 family/series 文案                 +0.40
标题出现两个以上已知兄弟型号            +0.35
Ordering Information 命中多个型号       +0.30
文件名/URL 命中系列基础型号             +0.15
只在正文或应用电路提到其他器件           +0.00
型号来自不同制造商                      -0.80
```

判定：

- `>= 0.75`：自动判定；
- `0.45–0.74`：进入审核；
- `< 0.45`：不判为 Family。

---

## 13. 版本管理

### 13.1 逻辑文档键

优先使用：

```text
manufacturer_id + document_number
```

若没有 document number，使用：

```text
manufacturer_id + normalized_title + detected_family_key
```

仍不能确定时创建待审核文档，不自动与已有逻辑文档合并。

### 13.2 新版本判断

以下任一成立，可创建新版本候选：

- 相同文档编号，SHA256 不同；
- 相同规范化标题和同一型号集合，SHA256 不同；
- 相同来源 URL 内容发生变化；
- revision 不同；
- published_at 不同；
- 文本指纹高度相似但不是相同二进制。

### 13.3 当前版本选择

排序优先级：

1. 明确 publication date；
2. 可解析 revision；
3. 厂商来源优先于分销商镜像；
4. 首次发现时间；
5. 人工指定。

如果 revision 无法可靠排序，例如 `Rev. A` 与 `Rev. 1.2` 混用，则不自动覆盖当前版本，进入审核。

### 13.4 禁止行为

- 不删除旧版本；
- 不覆盖旧文件；
- 不因为新 URL 出现就认为是新版本；
- 不因为 PDF metadata 的 modification date 较新就直接认定新版本；
- 不把分销商添加水印后的 PDF 自动当作正式新版本。

---

## 14. 数据模型

### 14.1 `binary_objects`

```text
id UUID PK
sha256 CHAR(64) UNIQUE NOT NULL
size_bytes BIGINT NOT NULL
mime_type VARCHAR
storage_key VARCHAR UNIQUE NOT NULL
page_count INT
pdf_version VARCHAR
is_encrypted BOOLEAN
validation_status VARCHAR
created_at TIMESTAMPTZ
```

### 14.2 `datasheet_documents`

```text
id UUID PK
manufacturer_id UUID NULL
document_type VARCHAR NOT NULL
logical_key VARCHAR NULL
normalized_title VARCHAR NULL
document_number VARCHAR NULL
current_version_id UUID NULL
review_status VARCHAR
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
UNIQUE(manufacturer_id, logical_key)
```

### 14.3 `datasheet_versions`

```text
id UUID PK
document_id UUID NOT NULL
binary_object_id UUID NOT NULL
revision_raw VARCHAR NULL
revision_normalized VARCHAR NULL
published_at DATE NULL
language VARCHAR NULL
title_raw VARCHAR NULL
metadata_json JSONB NOT NULL
text_fingerprint VARCHAR NULL
is_current BOOLEAN NOT NULL DEFAULT FALSE
supersedes_version_id UUID NULL
created_at TIMESTAMPTZ
UNIQUE(document_id, binary_object_id)
```

### 14.4 `datasheet_sources`

```text
id UUID PK
version_id UUID NOT NULL
source_type VARCHAR NOT NULL
source_url TEXT NULL
source_domain VARCHAR NULL
submitted_filename VARCHAR NULL
submitted_by VARCHAR NULL
first_seen_at TIMESTAMPTZ
last_seen_at TIMESTAMPTZ
http_etag VARCHAR NULL
http_last_modified VARCHAR NULL
http_status INT NULL
resolver_name VARCHAR NULL
source_metadata JSONB
UNIQUE(version_id, source_url)
```

### 14.5 `datasheet_part_links`

```text
id UUID PK
version_id UUID NOT NULL
part_id UUID NULL
mpn_raw VARCHAR NOT NULL
relationship VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
evidence_json JSONB NOT NULL
match_rule VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(version_id, part_id, relationship)
```

### 14.6 `ingestion_jobs`

```text
id UUID PK
input_type VARCHAR NOT NULL
input_payload JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR
idempotency_key VARCHAR NULL
retry_count INT NOT NULL DEFAULT 0
max_retries INT NOT NULL DEFAULT 3
result_json JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

### 14.7 `ingestion_events`

```text
id BIGSERIAL PK
job_id UUID NOT NULL
event_type VARCHAR NOT NULL
step VARCHAR NOT NULL
event_payload JSONB NOT NULL
created_at TIMESTAMPTZ
```

### 14.8 `review_tasks`

```text
id UUID PK
job_id UUID NOT NULL
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

## 15. API 列表

### 写接口

```text
POST /api/v1/datasheet-ingestions/url
POST /api/v1/datasheet-ingestions/upload
POST /api/v1/datasheet-ingestions/batch
POST /api/v1/datasheet-ingestions/{job_id}/retry
POST /api/v1/datasheet-ingestions/{job_id}/cancel
POST /api/v1/review-tasks/{review_id}/resolve
POST /api/v1/datasheet-versions/{version_id}/set-current
POST /api/v1/datasheet-versions/{version_id}/part-links
```

### 读接口

```text
GET /api/v1/datasheet-ingestions/{job_id}
GET /api/v1/datasheet-ingestions/{job_id}/events
GET /api/v1/datasheets/{document_id}
GET /api/v1/datasheets/{document_id}/versions
GET /api/v1/datasheet-versions/{version_id}
GET /api/v1/parts/{part_id}/datasheets
GET /api/v1/review-tasks
GET /health/live
GET /health/ready
GET /metrics
```

---

## 16. 错误码

至少实现：

```text
INVALID_URL
UNSUPPORTED_SCHEME
SSRF_BLOCKED
DNS_RESOLUTION_FAILED
DOWNLOAD_TIMEOUT
DOWNLOAD_TOO_LARGE
TOO_MANY_REDIRECTS
HTTP_ERROR
HTML_INSTEAD_OF_PDF
INVALID_PDF
ENCRYPTED_PDF
EMPTY_PDF
STORAGE_ERROR
DATABASE_ERROR
MANUFACTURER_NOT_FOUND
PART_NOT_FOUND
AMBIGUOUS_PART_MATCH
AMBIGUOUS_FAMILY_MATCH
AMBIGUOUS_VERSION
RESOLVER_NO_PDF_FOUND
RESOLVER_MULTIPLE_PDFS
JOB_CANCELLED
INTERNAL_ERROR
```

错误必须区分：

- 可重试；
- 不可重试；
- 需人工审核。

---

## 17. 安全与合规

必须实现：

- SSRF 防护；
- 上传文件大小限制；
- MIME sniffing；
- PDF 文件签名检查；
- 临时目录隔离；
- 临时文件自动清理；
- 对象存储服务端加密配置；
- API 身份认证接口占位；
- 审计日志；
- URL 和错误日志中敏感参数脱敏；
- 限流；
- 不记录上传文件的完整正文；
- 可插拔恶意文件扫描接口；
- 不运行 PDF 内嵌脚本；
- 不执行附件；
- 不使用 PDF 中的外部链接。

---

## 18. 可观测性

Prometheus 指标至少包括：

```text
datasheet_ingestion_jobs_total{status,source_type}
datasheet_ingestion_duration_seconds{step}
datasheet_download_bytes_total{domain}
datasheet_download_failures_total{error_code,domain}
datasheet_binary_dedup_hits_total
datasheet_possible_duplicate_total
datasheet_review_required_total{reason}
datasheet_part_match_confidence
datasheet_storage_bytes_total
datasheet_worker_queue_depth
```

结构化日志字段：

```text
request_id
job_id
batch_id
step
source_domain
sha256
document_id
version_id
part_ids
duration_ms
error_code
retry_count
```

不要在日志中输出完整 PDF 内容。

---

## 19. 仓库结构

```text
datasheet-ingestion-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── docker-compose.yml
├── .env.example
├── alembic.ini
├── migrations/
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── api.md
│   ├── security.md
│   ├── matching-rules.md
│   └── adr/
│       ├── 0001-binary-document-version-separation.md
│       └── 0002-no-llm-in-v1.md
├── src/
│   └── datasheet_agent/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── models/
│       ├── schemas/
│       ├── jobs/
│       ├── download/
│       │   ├── client.py
│       │   ├── security.py
│       │   └── resolver/
│       ├── pdf/
│       │   ├── validator.py
│       │   ├── metadata.py
│       │   └── fingerprint.py
│       ├── matching/
│       │   ├── manufacturer.py
│       │   ├── mpn.py
│       │   ├── family.py
│       │   └── version.py
│       ├── storage/
│       ├── review/
│       ├── observability/
│       └── domain/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── security/
│   ├── concurrency/
│   └── fixtures/
└── scripts/
    ├── generate_test_pdfs.py
    ├── import_legacy_records.py
    └── seed_demo_parts.py
```

---

## 20. 测试数据集

测试 Fixtures 至少包含：

1. 正常单型号 Datasheet；
2. 正常 Family Datasheet；
3. 同一 PDF 来自两个不同 URL；
4. 同一 URL 后续返回新 PDF；
5. 内容相同但 PDF metadata 不同；
6. 厂商 PDF 与分销商加水印 PDF；
7. HTML 伪装为 PDF；
8. 损坏 PDF；
9. 加密 PDF；
10. 空白 PDF；
11. 100 MB 边界文件；
12. 多次重定向；
13. 重定向到私网；
14. IPv4 私网；
15. IPv6 私网；
16. 多型号但不是 Family Datasheet 的应用笔记；
17. 相似型号，例如 `LM358`、`LM358A`、`LM358DR`；
18. 型号带斜杠、破折号、封装和温度后缀；
19. 不存在于主数据中的型号；
20. 两个 Worker 同时导入同一文件。

测试 PDF 应由脚本生成，不应把受版权保护的完整真实 Datasheet 提交到公开仓库。

---

## 21. 验收标准

### 21.1 核心功能

- URL 和上传 PDF 均能完成接入；
- 相同 SHA256 永远只创建一个 `binary_object`；
- 同一文件从多个来源接入时保留多个 source；
- 相同文档的新内容能创建新 version；
- 旧版本不会被删除或覆盖；
- Family Datasheet 可以关联多个 part；
- 低置信度关联进入审核；
- 所有任务可查询状态和事件；
- 所有接口有 OpenAPI 文档；
- 所有写接口支持幂等；
- Worker 崩溃后任务可恢复；
- 不使用大模型。

### 21.2 质量指标

- 单元测试覆盖率不低于 85%；
- URL 安全模块覆盖率不低于 95%；
- 所有 Ruff 检查通过；
- mypy 不出现未处理错误；
- Alembic migration 可从空库执行；
- Docker Compose 一条命令启动；
- 100 个并发相同文件任务最终只产生一个 binary object；
- 任一失败任务都有可查询 error code；
- 临时文件不残留；
- 接口响应不泄露服务器内部路径。

### 21.3 性能基线

在开发环境中：

- 本地 5 MB PDF 接入，不含排队时间，目标小于 3 秒；
- 已存在 SHA256 的重复文件处理目标小于 1 秒；
- 50 个并发接入任务无数据库死锁；
- 下载过程内存不随文件大小线性增长，必须流式处理。

---

## 22. Codex 分阶段实施任务

不要让 Codex 一次完成全部工作。按以下阶段执行，每个阶段都必须运行测试并形成独立提交。

### Phase 0：仓库侦察和实施计划

Codex 必须：

1. 阅读现有仓库；
2. 查找现有数据库、认证、任务队列、对象存储和日志规范；
3. 输出 `docs/implementation-plan.md`；
4. 明确复用项和新增项；
5. 不修改业务代码；
6. 建立 `AGENTS.md`，只写仓库地图、测试命令和硬约束。

验收：只产生文档和必要的配置说明。

### Phase 1：项目骨架和开发环境

实现：

- FastAPI；
- 配置管理；
- PostgreSQL；
- Redis；
- MinIO；
- Celery；
- Docker Compose；
- health endpoints；
- Ruff、mypy、pytest；
- CI 配置。

验收：一条命令启动，健康检查通过。

### Phase 2：数据模型和 Migration

实现第 14 节数据表、索引和唯一约束。

验收：

- 空库 migration 成功；
- downgrade 成功；
- 并发 SHA256 唯一性测试通过。

### Phase 3：对象存储和 PDF 接入

实现：

- upload streaming；
- URL streaming download；
- 临时文件；
- PDF validation；
- SHA256；
- S3/MinIO storage；
- binary deduplication。

验收：正常、重复、损坏、HTML 伪装和超大文件测试通过。

### Phase 4：安全下载和 URL Resolver

实现：

- SSRF 防护；
- DNS/IP 验证；
- redirect 再验证；
- 静态 HTML PDF 候选解析；
- resolver interface；
- retry/backoff；
- 域名并发限制。

验收：安全测试全部通过。

### Phase 5：元数据、型号和 Family 识别

实现：

- PDF metadata；
- 前后页文本提取；
- manufacturer matching；
- MPN normalization；
- exact matching；
- family scoring；
- evidence 和 confidence；
- review task。

验收：测试数据集中的单型号、Family、歧义型号均符合预期。

### Phase 6：版本管理

实现：

- logical document key；
- document/version/source 分离；
- revision/date parsing；
- text fingerprint；
- current version selection；
- ambiguous version review。

验收：同 URL 更新、分销商水印、metadata 差异等测试通过。

### Phase 7：完整 API 和审核接口

实现：

- 第 15 节接口；
- 分页；
-过滤；
- job events；
- retry/cancel；
- review resolution；
- set current；
- part link correction。

验收：API 集成测试通过。

### Phase 8：可观测性、文档和演示

实现：

- metrics；
- structured logging；
- README；
- API examples；
- architecture docs；
- demo seed；
- curl 演示；
- legacy import script。

验收：新开发者可根据 README 在空环境运行完整演示。

---

## 23. Codex 工作纪律

Codex 必须遵守：

1. 先读仓库，再编码；
2. 优先复用现有 ezPLM 基础设施；
3. 不擅自引入第二套数据库、认证或日志框架；
4. 每个阶段限制改动范围；
5. 每个阶段先写测试或同步补测试；
6. 所有重要判断写入领域服务，不堆在 API Controller；
7. 网络访问封装在 download 模块；
8. S3 操作封装在 storage interface；
9. 不在业务代码中写死域名；
10. 不提交密钥；
11. 不下载真实 Datasheet 作为测试资产；
12. 不用大模型；
13. 不把弱相似结果自动合并；
14. 不覆盖原始文件；
15. 不自动创建未经确认的正式 Part；
16. 每完成一个 Phase，输出：
    - 修改文件；
    - 设计决策；
    - 测试结果；
    - 未解决问题；
    - 下一阶段建议。

---

## 24. 首次交给 Codex 的主提示词

将下面的提示词和本文件一起放入仓库，然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发 Datasheet Asset Ingestion Agent。

先不要直接实现全部功能。请先完整阅读：
1. 仓库根目录的 AGENTS.md；
2. docs/datasheet-asset-ingestion-agent-spec.md；
3. 现有项目 README、数据库模型、认证、任务队列、对象存储、日志和测试配置。

本 Agent 是纯程序型 Agent。V1 禁止调用任何大模型。它只负责：
- 接收厂商 URL、本地 PDF 和分销商 Datasheet；
- 安全下载和 PDF 验证；
- SHA256 去重；
- 原始文件不可变存储；
- 基础元数据提取；
- 单型号/Family/未知文档识别；
- 型号关联；
- 文档版本管理；
- 低置信度人工审核；
- 标准化结果输出。

请严格区分：
- binary object；
- logical datasheet document；
- datasheet version；
- source；
- part association；
- ingestion job。

现在只执行 Phase 0：
1. 侦察仓库结构和已有技术栈；
2. 找出现有可复用模块；
3. 识别与规格冲突的地方；
4. 在 docs/implementation-plan.md 中给出具体实施计划；
5. 创建或更新简洁的 AGENTS.md，只提供仓库地图、关键约束、常用命令和测试入口；
6. 给出拟新增和拟修改文件清单；
7. 给出风险清单；
8. 不修改业务实现代码；
9. 不创建数据库 migration；
10. 不安装新依赖。

完成后运行当前仓库已有的静态检查和测试。如果环境无法运行，记录准确原因，不要伪造测试结果。

最终回复必须包含：
- 仓库现状总结；
- 拟采用架构；
- 复用与新增模块；
- 分阶段任务；
- Phase 1 的精确修改范围；
- 测试结果；
- 阻塞问题。
```

---

## 25. Phase 1 以后使用的任务提示词模板

```text
继续实现 Datasheet Asset Ingestion Agent 的 Phase {N}。

开始前：
1. 阅读 AGENTS.md；
2. 阅读完整规格；
3. 阅读 docs/implementation-plan.md；
4. 检查上一阶段提交和测试；
5. 只修改本阶段范围。

本阶段目标：
{粘贴对应 Phase 的目标和验收标准}

硬约束：
- 不调用大模型；
- 不覆盖原始 PDF；
- 不绕过网站访问限制；
- 所有网络请求经过安全下载模块；
- 所有写操作幂等；
- 所有自动判断保存 evidence 和 confidence；
- 不确定结果进入 review；
- 不使用真实受版权保护 Datasheet 作为测试 Fixture；
- 不重构与本阶段无关的代码。

执行顺序：
1. 先列出实施步骤；
2. 编写或更新测试；
3. 实现代码；
4. 运行格式化、lint、type check、unit tests 和 integration tests；
5. 修复失败；
6. 更新文档；
7. 总结修改。

最终回复：
- 修改文件；
- 数据库变化；
- API 变化；
- 关键设计决策；
- 测试命令与真实结果；
- 已知限制；
- 下一阶段建议。
```

---

## 26. 建议的 MVP 演示流程

完成 V1 后，演示脚本应覆盖：

1. 上传一个单型号测试 PDF；
2. 返回 SHA256、document、version 和 part link；
3. 再上传相同文件，显示 dedup hit；
4. 通过另一个 URL 导入相同文件，显示新增 source、未新增 binary；
5. 导入一个 Family 测试 PDF，关联三个型号；
6. 导入一个修改 revision 的 PDF，创建新 version；
7. 导入歧义 PDF，生成 review task；
8. 人工确认关联；
9. 查询某个 Part 的全部 Datasheet 和版本；
10. 查看 job events 和 metrics。

---

## 27. 后续 Agent 的标准衔接

本 Agent 完成后应发布事件：

```json
{
  "event_type": "datasheet.asset.ready",
  "event_version": "1.0",
  "document_id": "uuid",
  "version_id": "uuid",
  "binary_object_id": "uuid",
  "storage_uri": "s3://...",
  "sha256": "...",
  "manufacturer_id": "uuid",
  "part_ids": ["uuid"],
  "document_type": "family_datasheet",
  "language": "en",
  "page_count": 42,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

后续可订阅该事件的 Agent：

- PDF 结构解析 Agent；
- 参数抽取 Agent；
- 引脚和封装抽取 Agent；
- 图片提取 Agent；
- KiCad 符号生成 Agent；
- EOL/PCN 比较 Agent；
- Datasheet 新旧版本差异 Agent。

只有 `review_status=approved` 或达到配置阈值的资产，才允许自动进入后续批处理。
