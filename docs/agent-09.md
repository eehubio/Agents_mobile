# 封装与 3D 模型映射 Agent 设计与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent：KiCad Footprint & 3D Model Mapping Agent  
> 中文名：封装与 3D 模型映射 Agent  
> 版本：V1.0  
> 输出目标：KiCad 9.x / 10.x `.kicad_mod`、STEP、VRML、映射清单与验证报告  
> 定位：匹配优先、生成兜底、证据可追溯、几何可验证的 EDA 资产 Agent  
>
> 上游：
> - Datasheet Asset Ingestion Agent
> - PDF Parsing & OCR Routing Agent
> - Component Classification & Schema Routing Agent
> - Datasheet Structure & Visual Asset Locator Agent
> - Parameter Extraction & Unit Normalization Agent
> - Pin, Package & Ordering Variant Extraction Agent
> - Evidence Anchoring & Human Review Agent
> - KiCad Schematic Symbol Generation Agent
>
> 下游：
> - KiCad PCB / Footprint Library
> - KiCad Symbol–Footprint Assignment
> - KiCad PCB 初步布局 Agent
> - Symbol–Pin / Footprint–Pad 一致性校验
> - 3D Viewer 与工程文件预览
> - STEP 机械协同和外壳干涉检查
> - BOM、MPN、Ordering Variant 精确映射
> - Tindie 工程资产展示与下载
>
> 目标读者：产品负责人、EDA 工程师、机械工程师、后端工程师、数据工程师、测试工程师、Codex

---

# 1. 项目目标

建设一个独立、可复用、可测试、可版本化的 KiCad Footprint 与 3D 模型映射 Agent。

该 Agent 接收经过审核或达到生产阈值的：

- Package Variant；
- Package Family；
- Manufacturer Package Code；
- Pin / Ball / Pad 数量；
- Package Pin Instance；
- Ordering Variant；
- Body Size；
- Pitch；
- Lead Span；
- Lead Width；
- Lead Length；
- Exposed Pad；
- Thermal Pad；
- Package Drawing；
- Land Pattern；
- Datasheet Evidence；
- 已有 Footprint；
- 已有 STEP / VRML；
- KiCad Symbol Pin Number；
- 内部 90 万型号封装映射；
- 内部约 2 万 Footprint 和 3D 模型。

完成：

1. 建立标准 Package Geometry IR；
2. 对已有 Footprint 候选进行检索和评分；
3. 对已有 STEP / VRML 候选进行检索和评分；
4. 优先复用已验证的内部或官方资产；
5. 验证 Footprint Pad Number 与 Symbol Pin Number；
6. 验证 Pin 1 位置、方向和标记；
7. 验证 Pad 形状、Pitch、间距和封装尺寸；
8. 验证 Exposed Pad、Shield Pad、Mechanical Pad；
9. 验证 F.Fab、F.SilkS、F.CrtYd、F.Paste、F.Mask；
10. 生成缺失的标准 Footprint；
11. 必要时根据 Package Geometry 生成 STEP；
12. 必要时由 STEP 生成或关联 VRML；
13. 计算或验证 3D Model Offset、Rotation、Scale；
14. 将可修正的第三方模型归一到 Footprint 坐标；
15. 使用 KiCad 9/10 实际程序加载和验证；
16. 创建最小测试 PCB 并导出 STEP/GLB；
17. 检查 3D Body 与 Footprint Pad、F.Fab 和 Board Plane 的关系；
18. 生成 2D、3D 预览和几何差异报告；
19. 低置信度、尺寸冲突、Pin 1 冲突进入人工审核；
20. 人工修订以 Patch 保存；
21. 发布可供 KiCad Symbol、PCB 和 3D Viewer 使用的正式资产。

---

# 2. 核心策略：匹配优先，生成兜底

处理优先级：

```text
已审核的 Part → Footprint 精确映射
    ↓
已审核的 Package Variant → Footprint 精确映射
    ↓
内部 Footprint 几何匹配
    ↓
KiCad 官方库 / 授权库精确匹配
    ↓
参数化 Footprint 生成
    ↓
人工审核
```

3D 模型优先级：

```text
已审核 Part/Package → STEP 精确映射
    ↓
内部模型库哈希与几何匹配
    ↓
KiCad 官方或厂商授权 STEP
    ↓
授权第三方模型
    ↓
根据 Package Geometry 参数化生成 STEP
    ↓
占位模型 / 人工审核
```

## 2.1 为什么不能默认重新生成

现有资产中可能已经包含：

- 厂商特殊 Land Pattern；
- 非标准 Thermal Pad；
- 特殊引脚长度；
- Mounting Boss；
- Shield；
- Connector Key；
- Keepout；
- Courtyard；
- 厂商推荐 Paste Window。

重新生成通用封装可能反而降低准确度。

## 2.2 为什么不能只按封装名匹配

例如：

```text
QFN-32
```

不足以唯一确定：

- Body Size；
- Pitch；
- Exposed Pad Size；
- Pad Length；
- Pin 1 位置；
- Wettable Flank；
- Thermal Via；
- Paste Pattern。

匹配键必须包含几何和适用关系。

---

# 3. 与前八个 Agent 的边界

## 3.1 第六个 Agent 提供

- Package Variant；
- Manufacturer Package Code；
- Package Pin Instance；
- Ordering Variant；
- Pin Count；
- Body Size；
- Pitch；
- Package Drawing；
- Land Pattern；
- Exposed Pad；
- Applicability。

## 3.2 第七个 Agent 提供

- Evidence Anchor；
- Approved Record；
- Review Patch；
- Source Version；
- Provenance。

## 3.3 第八个 Agent 提供

- KiCad Symbol Pin Number；
- Symbol Asset；
- Package-specific Symbol；
- Footprint Filter 候选；
- Symbol–Footprint Validation 请求。

## 3.4 本 Agent 负责

- Footprint Matching；
- Footprint Generation；
- Pad Geometry；
- Footprint Layers；
- Footprint Origin；
- Pin 1 Orientation；
- STEP / VRML Mapping；
- 3D Transform；
- Footprint–Model Alignment；
- Footprint–Symbol Pad Mapping；
- KiCad 文件输出与实际验证。

## 3.5 本 Agent 不负责

V1 不负责：

- 从 PDF 重新 OCR Package Drawing；
- 修改上游 Package Variant；
- 生成复杂产品外壳；
- 生成完整 PCB；
- 生成内部 Die、Bond Wire；
- 生成高精度螺纹；
- 复制无授权第三方 STEP；
- 通过图像猜测所有机械尺寸；
- 在关键尺寸缺失时静默生成生产封装；
- 自动提交 KiCad 官方库；
- 用大模型自由生成几何；
- 绕过真实 KiCad 验证。

---

# 4. 核心对象必须分层

```text
Package Variant
    ↓
Package Geometry IR
    ↓
Footprint Candidate / Generated Footprint
    ↓
Pad Map
    ↓
3D Model Candidate / Generated Model
    ↓
3D Transform
    ↓
Validated Footprint Asset
```

## 4.1 Package Variant

表示 Datasheet 中的封装变体。

## 4.2 Package Geometry IR

与 KiCad 文件格式无关的标准几何定义。

## 4.3 Footprint Candidate

已有库中可能匹配的 `.kicad_mod`。

## 4.4 Generated Footprint

由参数化生成器产生的 `.kicad_mod`。

## 4.5 3D Model Candidate

已有 STEP / VRML 模型。

## 4.6 3D Transform

模型相对于 Footprint 的：

```text
offset xyz
rotation xyz
scale xyz
```

## 4.7 Validated Asset

通过静态、KiCad、2D、3D 和 Pin/Pad 校验的资产。

---

# 5. KiCad 文件策略

## 5.1 Footprint 文件

Footprint Library：

```text
<Library>.pretty/
  <Footprint>.kicad_mod
```

一个 `.kicad_mod` 文件定义一个 Footprint。

## 5.2 3D 模型目录

建议：

```text
<Library>.3dshapes/
  <Footprint>.step
  <Footprint>.wrl
```

## 5.3 路径变量

内部库建议使用独立变量：

```text
${EEHUB_3DMODEL_DIR}/Package_QFN.3dshapes/QFN-32.step
```

不要将内部库绑定到固定的：

```text
${KICAD9_3DMODEL_DIR}
${KICAD10_3DMODEL_DIR}
```

如果引用 KiCad 官方模型，再使用对应 Target 的官方路径变量。

## 5.4 KiCad 9/10 Target

Footprint 的业务几何通常可以共享 IR，但仍要分别：

- 在 KiCad 9 中加载；
- 在 KiCad 10 中加载；
- Round-trip；
- 生成测试 PCB；
- 导出 3D。

输出可为同一个兼容文件，前提是两个目标均通过实际验证。

若格式或属性存在差异，则生成：

```text
kicad9/
kicad10/
```

两个 Target 文件。

---

# 6. Package Geometry IR

```json
{
  "schema_version": "1.0.0",

  "identity": {
    "package_variant_id": "uuid",
    "package_name_raw": "VQFN-32",
    "package_name_normalized": "QFN-32-1EP",
    "package_family": "QFN",
    "manufacturer": "Texas Instruments",
    "manufacturer_package_code": "RHB",
    "pin_count": 32
  },

  "dimensions": {
    "body": {
      "length": {"nominal": "5.0", "unit": "mm"},
      "width": {"nominal": "5.0", "unit": "mm"},
      "height": {"max": "1.0", "unit": "mm"}
    },
    "pitch": {"nominal": "0.5", "unit": "mm"},
    "lead": {
      "width": {"min": "0.18", "max": "0.30", "unit": "mm"},
      "length": {"min": "0.30", "max": "0.50", "unit": "mm"}
    },
    "lead_span": null,
    "standoff": {"min": "0.0", "max": "0.05", "unit": "mm"}
  },

  "pin_numbering": {
    "scheme": "counter_clockwise",
    "pin1_location": "top_left",
    "view": "top",
    "pin1_marking": "dot_or_bevel"
  },

  "exposed_pads": [
    {
      "pad_number": "33",
      "shape": "rect",
      "length": "3.45",
      "width": "3.45",
      "electrical_role": "ground",
      "paste_strategy": "windowed"
    }
  ],

  "package_features": {
    "wettable_flank": false,
    "thermal_vias_recommended": false,
    "mounting_bosses": [],
    "mechanical_pads": [],
    "shield_pads": []
  },

  "source": {
    "approved_record_ids": [],
    "evidence_bundle_ids": [],
    "package_drawing_figure_id": "fig-1",
    "land_pattern_figure_id": "fig-2"
  },

  "quality": {
    "required_dimensions_complete": true,
    "confidence": 0.97
  }
}
```

---

# 7. Footprint Generation IR

```json
{
  "schema_version": "1.0.0",

  "identity": {
    "footprint_asset_id": "uuid",
    "library_name": "Package_DFN_QFN",
    "footprint_name": "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm"
  },

  "source": {
    "package_geometry_id": "uuid",
    "generation_policy_version": "footprint-1.0.0",
    "land_pattern_policy_version": "land-pattern-1.0.0"
  },

  "attributes": {
    "mounting_type": "smd",
    "description": "...",
    "tags": ["QFN", "32", "0.5mm"]
  },

  "origin": {
    "x": "0",
    "y": "0",
    "strategy": "body_center"
  },

  "pads": [],
  "graphics": {
    "fab": [],
    "silk": [],
    "courtyard": [],
    "user": []
  },

  "texts": [],
  "keepouts": [],
  "zones": [],
  "models": [],
  "validation_expectations": {}
}
```

---

# 8. Package Geometry 完整性要求

## 8.1 匹配 Footprint 的最低字段

至少需要：

```text
package_family
pin_count
pitch
body_length
body_width
pin_numbering
exposed_pad
```

## 8.2 自动生成 Footprint 的最低字段

根据 Package Family 不同，要求不同。

### QFN / DFN

```text
body length/width
pin count
pitch
lead width
lead length or terminal span
exposed pad size if present
pin 1 orientation
```

### QFP / SOP / TSSOP / MSOP

```text
body length/width
lead count
pitch
lead width
lead span
lead length
pin 1 orientation
```

### BGA / WLCSP

```text
row/column grid
ball coordinates
pitch
ball diameter or pad recommendation
body size
missing balls
orientation
```

### SOT / TO

```text
body size
lead positions
lead width
lead length
mounting/tab geometry
pin 1 orientation
```

## 8.3 缺失关键尺寸

输出：

```text
generation_status = blocked
review_required = true
```

不生成可用于生产的 Footprint。

允许生成：

```text
preview_only
```

但必须带醒目标记。

---

# 9. Footprint Candidate 检索

## 9.1 数据源

按优先级：

1. 内部已审核 Part Mapping；
2. 内部已审核 Package Mapping；
3. 内部 Footprint Library；
4. KiCad 官方 Footprint Library；
5. 厂商授权 EDA Library；
6. 经法律和质量审核的第三方库；
7. 参数化生成器。

## 9.2 检索键

```text
manufacturer
manufacturer_package_code
package_family
pin_count
pitch
body size
lead span
exposed pad size
ball map
mounting type
orientation
```

## 9.3 名称不是权威键

Footprint Name 仅作为候选生成特征，不能作为最终决定。

---

# 10. Footprint Match Score

```text
match_score =
  authoritative_mapping
  + package_code_match
  + family_match
  + pin_count_match
  + pad_number_set_match
  + pitch_match
  + body_size_match
  + exposed_pad_match
  + lead_span_match
  + pin1_orientation_match
  + land_pattern_match
  - conflict_penalty
```

## 10.1 阻断条件

以下任意一个不匹配，默认不能自动批准：

- Pin Count；
- Pad Number Set；
- Ball Map；
- Exposed Pad Number；
- Pitch；
- Package Family；
- Pin 1 Orientation。

## 10.2 尺寸容差

不同来源可能存在：

- Nominal；
- Min/Max；
- Recommended Land Pattern；
- 实际 Component Body。

匹配比较必须区分：

```text
package body geometry
terminal geometry
land pattern geometry
```

不能将 Body Size 与 Pad Span 直接比较。

---

# 11. Pad Map

## 11.1 Pad 对象

```json
{
  "pad_id": "pad-1",
  "number": "1",
  "type": "smd",
  "shape": "roundrect",
  "at": {"x": "-2.625", "y": "-1.75", "rotation": "0"},
  "size": {"x": "0.8", "y": "0.3"},
  "layers": ["F.Cu", "F.Paste", "F.Mask"],
  "roundrect_ratio": "0.25",
  "electrical_role": "signal",
  "package_pin_instance_ids": ["uuid"],
  "pin1": true
}
```

## 11.2 Pad Number 分类

```text
electrical
exposed_pad
shield
mechanical_pad
non_plated_hole
mounting_hole
test_pad
unknown
```

## 11.3 特殊编号

建议遵循库策略：

```text
EP：通常为正常 Pin Count + 1
SH：Shield
MP：Mechanical Pad
NPTH：不编号
```

若 Datasheet 明确给出其他编号，以 Datasheet 为准。

## 11.4 Connected Copper

同一个电气连接的多个铜 Pad 应使用相同 Pad Number。

但以下对象不得误合并：

- 多个独立 NC；
- 不同 Power Domain；
- 多个机械 Pad；
- 可选择连接的 Solder Jumper。

---

# 12. Symbol Pin 与 Footprint Pad 校验

## 12.1 集合校验

```text
symbol_electrical_pin_numbers
vs
footprint_electrical_pad_numbers
```

## 12.2 允许差异

- Symbol 省略的 NC Pad；
- Footprint 的 MP；
- NPTH；
- Shield；
- Fabrication-only feature；
- 明确的 stacked Pin。

## 12.3 阻断差异

- Symbol Pin 无对应 Electrical Pad；
- Footprint Electrical Pad 无 Symbol Pin 且不是已批准的省略；
- EP 编号不同；
- BGA Ball 不一致；
- Pad Number 重复且非合法连接；
- Pin 1 不一致。

## 12.4 适用关系

校验必须限定：

```text
part_id
package_variant_id
ordering_variant_id
```

不能跨封装比较。

---

# 13. Pin 1 规则

## 13.1 默认方向

Footprint 默认定位：

```text
Pin 1 在左上角或左上象限
```

单排器件：

```text
Pin 1 在左侧
```

某些 PLCC/QFN 中 Pin 1 位于一边中间：

```text
Pin 1 应朝上侧
```

## 13.2 数据来源优先级

1. Datasheet Package Drawing；
2. Pinout Figure；
3. Manufacturer Land Pattern；
4. Package Registry；
5. KLC 默认；
6. 人工审核。

## 13.3 Pin 1 标记

至少在：

```text
F.SilkS
F.Fab
```

显示。

常见标记：

- Dot；
- Triangle；
- Bevel；
- Notch；
- Number `1`。

## 13.4 Pin 1 校验

比较：

```text
Package Drawing
Pinout View
Footprint Pad 1
F.SilkS Marker
F.Fab Bevel
3D Model Marking
```

任意冲突进入审核。

---

# 14. Footprint Origin

## 14.1 SMD

默认：

```text
Component Body Center
```

## 14.2 THT

可根据库策略：

```text
Pin 1
```

或已批准的标准原点。

## 14.3 Connector / Mechanical

根据：

- Pick-and-place；
- Mechanical Datum；
- Manufacturer Drawing；
- Existing Library Convention。

## 14.4 Origin 影响

影响：

- Footprint Placement；
- 3D Model Offset；
- Pick-and-place；
- Rotation；
- STEP Export；
- 机械协同。

必须显式记录 `origin_strategy`。

---

# 15. Land Pattern Generation

## 15.1 数据来源优先级

1. Manufacturer Recommended Land Pattern；
2. 已审核 Footprint；
3. 授权标准库；
4. 参数化生成策略；
5. 人工设计。

## 15.2 Manufacturer 优先

若 Datasheet 给出：

- Pad Size；
- Solder Mask；
- Paste Aperture；
- Thermal Via；
- Courtyard / Keepout；

应优先使用厂商推荐。

## 15.3 参数化生成

参数化生成器按 Package Family 实现：

```text
qfn_generator
dfn_generator
qfp_generator
soic_generator
tssop_generator
bga_generator
sot_generator
chip_generator
connector_generator
```

## 15.4 标准来源

如果使用 IPC 等标准的公式或表格：

- 只使用有权实现的资料；
- 记录标准版本；
- 不在代码仓库复制受版权保护表格；
- 将参数保存为配置；
- 标明来源和授权。

---

# 16. Pad Geometry

## 16.1 SMD Pad

保存：

```text
shape
size
position
rotation
roundrect ratio
chamfer
mask expansion
paste expansion
layers
```

## 16.2 THT Pad

保存：

```text
pad shape
drill shape
drill diameter
slot dimensions
annular ring
plating
```

## 16.3 Custom Pad

只在标准形状不能表示时使用。

必须：

- 有 Primitive；
- 有 Anchor；
- 通过 KiCad Round-trip；
- 有视觉测试。

## 16.4 Exposed Pad

支持：

- 单一大 Pad；
- Windowed Paste；
- Thermal Via；
- Paste-only Subpad；
- Same-number Copper Subpads。

需区分：

```text
electrical pad
paste aperture
thermal via
```

---

# 17. Paste、Mask 和 Thermal Via

## 17.1 Paste

Exposed Pad 通常采用 Window Pane。

配置：

```text
aperture count
aperture size
paste coverage
web width
```

## 17.2 Mask

默认根据 Pad 和库策略。

厂商指定时优先。

## 17.3 Thermal Via

V1 默认不自动添加 Thermal Via，除非：

- Datasheet 明确推荐；
- Package Policy 允许；
- Footprint Variant 名称明确包含 ThermalVias；
- 人工批准。

生成两个 Footprint：

```text
QFN-..._EP...
QFN-..._EP..._ThermalVias
```

不要静默改变标准 Footprint。

---

# 18. F.Fab

必须包括：

- Nominal Body Outline；
- Pin 1 Bevel / Marker；
- `${REFERENCE}`；
- Footprint Value；
- 简化 Lead Outline 或标准表示。

F.Fab Body 尺寸用于：

- 3D Alignment；
- Assembly；
- Geometry Validation。

---

# 19. F.SilkS

必须：

- 有 Reference；
- 有 Pin 1 / Polarity Marker；
- 避开暴露铜 Pad；
- 组装后仍尽量可见；
- 不穿过 Pad；
- 线宽符合策略。

对高密度 QFN：

- 可只保留角标；
- 不强行绘制完整 Body Outline。

---

# 20. F.CrtYd

必须：

- 闭合；
- 不自交；
- 包围 Component Body 和必要 Lead；
- 使用策略规定的 Grid 和线宽；
- 与 Package Height 不混淆。

Courtyard 计算来源：

- Manufacturer；
- KLC / Authorized Standard；
- Package Generator Policy。

---

# 21. Keepout 与特殊机械特征

适用：

- Antenna；
- Connector；
- RF Module；
- Bottom Contact；
- Optical Sensor；
- Microphone Port；
- Mounting Boss；
- Mechanical Key；
- Battery Holder。

Keepout 应为独立策略，不根据图片自由猜测。

---

# 22. 3D 模型格式策略

## 22.1 STEP

STEP 是权威机械模型：

- 用于尺寸校验；
- 用于 Board STEP Export；
- 用于外壳和机械协同；
- 必须优先保存。

## 22.2 VRML

VRML 可选：

- 用于兼容旧流程；
- 可带颜色；
- 可由 STEP 或源模型生成；
- 不是权威尺寸模型。

## 22.3 其他格式

内部可生成：

```text
GLB
STL
BREP
```

用于 Web Viewer 或调试，但正式 KiCad Mapping 仍以 STEP / VRML 为主。

---

# 23. 3D Model Source Policy

## 23.1 来源

```text
internal_verified
kicad_official
manufacturer_official
authorized_distributor
authorized_third_party
generated_from_package_geometry
placeholder
```

## 23.2 许可证

每个模型保存：

```text
source_url
license
redistribution_allowed
commercial_use_allowed
attribution
source_sha256
```

不允许将来源不明的模型打包给用户。

## 23.3 去重

使用：

- SHA256；
- STEP Geometry Hash；
- Bounding Box；
- Volume；
- Surface Area；
- Shape Fingerprint。

---

# 24. 3D Model IR

```json
{
  "model_asset_id": "uuid",
  "format": "STEP",
  "source_type": "manufacturer_official",
  "source_uri": "s3://.../raw.step",
  "normalized_uri": "s3://.../normalized.step",

  "geometry": {
    "bbox": {
      "min": ["-2.5", "-2.5", "0"],
      "max": ["2.5", "2.5", "1.0"],
      "unit": "mm"
    },
    "body_height": "1.0",
    "volume": "20.1",
    "center_of_mass": ["0", "0", "0.55"]
  },

  "frame": {
    "origin": "footprint_body_center_board_plane",
    "x_axis": "right",
    "y_axis": "down_or_target_defined",
    "z_axis": "up",
    "pin1_direction": "top_left"
  },

  "mapping": {
    "footprint_asset_id": "uuid",
    "offset": ["0", "0", "0"],
    "scale": ["1", "1", "1"],
    "rotation": ["0", "0", "0"]
  },

  "quality": {
    "dimension_score": 0.98,
    "orientation_score": 0.99,
    "board_plane_score": 1.0,
    "pin1_score": 0.95,
    "review_required": false
  }
}
```

---

# 25. 3D Transform

KiCad Footprint 中 Model Mapping 包含：

```scheme
(model "..."
  (at (xyz X Y Z))
  (scale (xyz X Y Z))
  (rotate (xyz X Y Z))
)
```

## 25.1 Canonical 目标

内部正式生成或归一化模型应满足：

```text
scale = 1,1,1
offset = 0,0,0
rotation = 0,0,0
```

## 25.2 第三方模型兼容

如果无法重写模型文件，可在 Footprint 中保存非零 Transform。

但必须：

- 保存原始模型；
- 保存 Transform；
- 生成归一化候选；
- 标记不符合内部 Canonical；
- 通过实际 3D 验证。

## 25.3 Scale

Scale 不是常规修复手段。

若 Scale ≠ 1：

- 优先判断单位错误；
- STEP 通常应按毫米解释；
- VRML 可能存在单位约定差异；
- 进入审核。

## 25.4 Offset

Offset 常见原因：

- STEP Origin 不在 Body Center；
- Origin 在 Pin 1；
- Origin 在底面边角；
- Footprint Origin 不同；
- Board Plane 高度不对。

## 25.5 Rotation

常见候选：

```text
0
90
180
270
```

X/Y 翻转需要特别谨慎，避免镜像 Pin 1。

---

# 26. 3D Alignment 算法

## 26.1 输入

- Footprint Pad Geometry；
- F.Fab Body；
- Package Body Dimensions；
- Model Bounding Box；
- Model Pin/Lead Geometry；
- Pin 1 Marker；
- Board Plane；
- Package Height。

## 26.2 步骤

```text
读取 STEP
→ 单位和 BBox
→ 识别主 Body
→ 识别底面
→ 识别主要对称轴
→ 枚举旋转候选
→ 平移到 Footprint Origin
→ 比较 Body/F.Fab
→ 比较 Lead/Pad
→ 比较 Pin 1
→ 选择最优 Transform
→ 生成报告
```

## 26.3 匹配评分

```text
alignment_score =
  body_bbox_match
  + body_center_match
  + board_plane_match
  + lead_pad_overlap
  + pin1_match
  + height_match
  - collision_penalty
  - mirror_penalty
```

## 26.4 不适合自动对齐

- 无 Lead Geometry 的简化模型；
- 完全对称且无 Pin 1 标记；
- Connector 复杂模型；
- 模块；
- 非标准机械器件；
- 模型含多个独立组件；
- 模型坐标异常。

进入人工审核。

---

# 27. 3D Model 归一化

## 27.1 归一化目标坐标系

定义：

```text
Footprint Origin = Model XY Origin
Board Top Surface = Z 0
Model Bottom Contact Plane = Z 0
Pin 1 Orientation = Footprint Pin 1
Scale = 1
```

## 27.2 输出

```text
raw.step
normalized.step
normalization_transform.json
```

## 27.3 变换优先级

优先：

```text
重写 STEP 坐标
```

而不是将复杂 Transform 长期保留在 `.kicad_mod`。

## 27.4 可逆性

保存原始 → 归一化变换矩阵和逆矩阵。

---

# 28. 3D 尺寸校验

比较：

```text
STEP Body Length
STEP Body Width
STEP Body Height
vs
Package Geometry
```

## 28.1 容差

配置：

```yaml
body_xy_tolerance_mm: "0.10"
height_tolerance_mm: "0.10"
lead_position_tolerance_mm: "0.10"
board_plane_tolerance_mm: "0.05"
```

具体阈值可按 Package Family 调整。

## 28.2 Model 与 Land Pattern

3D Lead/Terminal 与 Pad 的 XY 投影应：

- 落在对应 Pad 内；
- 或与 Pad 有足够重叠；
- 不落在相邻 Pad；
- 不整体偏移。

## 28.3 Collision

检查：

- Body 穿入 Board；
- Lead 浮空过高；
- Body 与 Pad 不相交；
- Pin 1 镜像；
- 模型旋转 90°；
- 模型尺寸为英寸误当毫米；
- VRML Scale 错误。

---

# 29. Pin 1 的 3D 校验

## 29.1 可用特征

- Dot；
- Chamfer；
- Notch；
- Pin 1 Lead；
- Package Asymmetry。

## 29.2 自动识别限制

CAD 模型可能无颜色或无 Pin 1 标记。

此时：

- 依赖 Lead Geometry；
- Datasheet Drawing；
- 厂商模型说明；
- 人工审核。

不能因为模型完全对称就宣称 Pin 1 已验证。

---

# 30. STEP 生成

## 30.1 适用范围

V1 支持参数化生成：

- QFN / DFN；
- SOIC / SOP；
- TSSOP / MSOP；
- QFP；
- SOT；
- DIP；
- 简单 BGA；
- 简单 Chip Package；
- 简单 TO。

## 30.2 不适合 V1 自动生成

- Connector；
- Switch；
- Transformer；
- Relay；
- Module；
- Complex Sensor Package；
- Mechanical Hardware；
- Custom Housing；
- Flexible Cable。

## 30.3 生成引擎

建议使用独立的 OpenCascade/CadQuery 类几何 Worker。

业务服务只调用：

```text
ModelGeneratorAdapter
```

不耦合具体 CAD 库。

## 30.4 简化程度

模型应包含：

- Body；
- Leads/Balls；
- Pin 1 Indicator；
- Exposed Pad；
- 必要颜色信息。

不需要：

- Internal Die；
- Bond Wire；
- Laser Marking 全文字；
- 微小倒角细节。

## 30.5 STEP 质量

- 单位 mm；
- 封闭 Solid；
- 无自交；
- 无零体积；
- 可被 OCCT 读取；
- 可被 KiCad Exporter 使用。

---

# 31. VRML 生成

## 31.1 来源

- 从参数化源模型生成；
- 从 STEP Tessellation 生成；
- 使用授权原始 VRML。

## 31.2 颜色

建议：

- Mold Body；
- Leads；
- Pin 1 Mark；
- Metal Tab。

## 31.3 精度

VRML 只作为显示资产。

尺寸权威仍为 STEP。

---

# 32. Footprint Serializer

## 32.1 AST

不得直接使用字符串模板拼接。

建立：

```text
FootprintAst
PadAst
GraphicAst
TextAst
ZoneAst
ModelAst
```

## 32.2 Generator

第三方生成器使用：

```text
(generator eehub_footprint_agent)
```

不得使用：

```text
pcbnew
```

## 32.3 数值

- 毫米；
- Decimal；
- 最多合理小数位；
- 不使用科学计数法；
- 避免负零；
- 稳定格式。

## 32.4 UUID

使用稳定或可追踪策略。

Library Footprint 的 Round-trip 允许 KiCad 添加或变更非语义 UUID，但 Semantic Hash 必须稳定。

---

# 33. KiCad 9/10 Golden Fixtures

分别由真实 KiCad 创建：

1. SMD Footprint；
2. THT Footprint；
3. QFN EP；
4. Paste Window；
5. Thermal Via；
6. Custom Pad；
7. NPTH；
8. SH；
9. MP；
10. F.Fab；
11. F.SilkS；
12. F.CrtYd；
13. Keepout；
14. STEP Model；
15. VRML Model；
16. Non-zero Offset；
17. Rotation；
18. Multiple Models；
19. Footprint Property；
20. Round-trip。

Codex 不得凭记忆发明未确认 Token。

---

# 34. Footprint 静态校验

## 34.1 文件

- Name 合法；
- Version 合法；
- Generator 合法；
- UTF-8；
- 无路径穿越。

## 34.2 Pad

- Pad Number 合法；
- Electrical Pad Number 唯一或合法复用；
- Pad Size > 0；
- Drill < Pad；
- Layer 合法；
- SMD/THT 类型一致；
- Pin 1 Pad 存在；
- EP 存在；
- Ball Map 一致。

## 34.3 Layer

- Reference；
- Value；
- F.Fab；
- F.CrtYd；
- Pin 1 Marker；
- Silk 不压 Pad；
- Courtyard 闭合；
- Fab Body 完整。

## 34.4 3D

- Model Path 合法；
- Model 存在或明确 placeholder；
- Scale；
- Offset；
- Rotation；
- Model Extension；
- License。

---

# 35. 几何校验

## 35.1 Pitch

按 Pad Center 计算，与 Package Geometry 对比。

## 35.2 Body

F.Fab Body 与 Package Body Nominal 比较。

## 35.3 Pad Span

外侧 Pad Span 与 Recommended Land Pattern 比较。

## 35.4 Pin 1

Pad 1、Fab Bevel、Silk Marker 和 3D Marking 方向一致。

## 35.5 Symmetry

对称 Package 检查中心和 Pitch。

## 35.6 Courtyard

验证：

- 闭合；
- 包围 Body/Leads；
- 无自交；
- Grid；
- Clearance。

---

# 36. KiCad 实际验证

## 36.1 Version

记录：

```bash
kicad-cli version --format about
```

## 36.2 Load / Round-trip

KiCad CLI 对单独 Footprint 的能力可能有限，因此建议构造最小测试 Board：

```text
board.kicad_pcb
└── 放置待测 Footprint
```

然后使用目标 KiCad 打开、保存或通过 Parser Adapter 验证。

如果目标版本提供 Footprint 专用 CLI，优先使用实际支持命令。

## 36.3 DRC

```bash
kicad-cli pcb drc \
  --output drc-report.json \
  --format json \
  test-board.kicad_pcb
```

实际参数以目标版本 CLI 为准。

## 36.4 2D Plot

导出：

- F.Cu；
- F.Mask；
- F.Paste；
- F.SilkS；
- F.Fab；
- F.CrtYd。

用于视觉回归。

## 36.5 STEP Export

```bash
kicad-cli pcb export step \
  --output test-board.step \
  test-board.kicad_pcb
```

要求：

- Exit Code 0；
- Footprint Model 被包含；
- 输出 STEP 可打开；
- Component BBox 正确。

## 36.6 KiCad 10 额外 3D Export

可选：

```text
GLB
BREP
STL
3D PDF
```

用于 Web 预览和调试。

## 36.7 VRML Export

生成调试 VRML Board，确认模型路径和加载。

---

# 37. 3D 验证测试板

## 37.1 Board

创建一个小矩形 Board：

```text
20 mm × 20 mm
```

Footprint 放置于：

```text
0,0
rotation 0
```

## 37.2 多角度测试

另外生成：

```text
rotation 90
rotation 180
rotation 270
bottom side
```

验证：

- Offset；
- Rotation；
- Mirror；
- Pin 1；
- Board Plane。

## 37.3 Board 厚度

固定测试 Board Thickness，例如：

```text
1.6 mm
```

并记录。

---

# 38. 2D/3D Visual Regression

输出：

```text
footprint-editor top view
fab overlay
silk overlay
paste/mask view
3d top
3d isometric
3d side
3d bottom
```

## 38.1 结构检查

- Pad 1；
- Pad Number；
- EP；
- Body；
- Pin 1 Mark；
- 3D Alignment；
- Body Height；
- Lead/Pad Overlap。

## 38.2 图像比较

允许：

- 抗锯齿；
- 光照；
- 小颜色差异。

不允许：

- 模型旋转错误；
- 模型偏移；
- 模型浮空；
- Body 穿板；
- Pin 1 镜像；
- Pad 缺失。

---

# 39. Model–Footprint 1:1 关系

默认一个 Footprint 只关联一个具有相同功能外形的主 3D Model。

如果：

- Footprint 铜几何相同；
- 但器件高度不同；
- 或机械结构不同；

建议生成不同 Footprint Asset 或 Package-specific Footprint Variant，以避免 3D 模型与真实器件不符。

Hand Soldering 等仅 Land Pattern 变化、3D Body 相同的 Footprint，可以共享同一 3D Model。

---

# 40. Footprint Naming

## 40.1 通用

```text
<PackageFamily>-<PinCount>_<Body>_P<Pitch>_[EP]_[Options]
```

例如：

```text
QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm
```

## 40.2 Fully Specified

制造商特殊封装：

```text
<Manufacturer>_<PackageCode>_<MPN_or_Family>
```

具体 Naming Policy 版本化。

## 40.3 非标准 Pad Count

名称应体现：

```text
EP
SH
MP
```

避免只看 Pin Count 产生歧义。

---

# 41. Asset Manifest

```json
{
  "footprint_asset_id": "uuid",
  "library_name": "Package_DFN_QFN",
  "footprint_name": "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm",

  "source": {
    "package_variant_id": "uuid",
    "part_ids": ["uuid"],
    "ordering_variant_ids": ["uuid"],
    "approved_record_ids": [],
    "evidence_bundle_ids": []
  },

  "footprint": {
    "source_type": "matched_internal",
    "uri": "s3://.../footprint.kicad_mod",
    "sha256": "hex",
    "semantic_hash": "hex"
  },

  "models": [
    {
      "format": "STEP",
      "uri": "s3://.../model.step",
      "sha256": "hex",
      "source_type": "manufacturer_official",
      "transform": {
        "offset": ["0", "0", "0"],
        "scale": ["1", "1", "1"],
        "rotation": ["0", "0", "0"]
      }
    }
  ],

  "mapping": {
    "symbol_asset_ids": ["uuid"],
    "pad_number_set": ["1", "2", "3", "33"],
    "pin_pad_match": true
  },

  "validation": {
    "kicad9": {
      "parse": true,
      "step_export": true
    },
    "kicad10": {
      "parse": true,
      "step_export": true,
      "glb_export": true
    },
    "pin1": true,
    "dimensions": true,
    "model_alignment": true
  },

  "quality": {
    "overall_score": 0.98,
    "review_status": "approved"
  }
}
```

---

# 42. Agent 输入

## 42.1 事件

订阅：

```json
{
  "event_type": "component.pin-package-ordering.ready",
  "part_ids": ["uuid"],
  "package_catalog_uri": "s3://...",
  "pin_catalog_uri": "s3://...",
  "ordering_catalog_uri": "s3://...",
  "review_status": "approved"
}
```

并关联：

```text
component.kicad-symbol.ready
knowledge.record.approved
```

## 42.2 REST

`POST /api/v1/kicad-footprint-model/jobs`

```json
{
  "part_id": "uuid",
  "package_variant_id": "uuid",
  "ordering_variant_ids": ["uuid"],

  "package_catalog_uri": "s3://...",
  "pin_catalog_uri": "s3://...",
  "symbol_asset_ids": ["uuid"],

  "targets": [
    "kicad9",
    "kicad10"
  ],

  "mode": "auto",

  "preferences": {
    "match_existing_first": true,
    "allow_generate_footprint": true,
    "allow_generate_step": true,
    "allow_nonzero_model_transform": false,
    "allow_placeholder_model": false
  },

  "policies": {
    "match_policy_version": "footprint-match-1.0.0",
    "generation_policy_version": "footprint-gen-1.0.0",
    "package_registry_version": "packages-1.0.0",
    "model_policy_version": "3d-model-1.0.0",
    "validation_policy_version": "footprint-validation-1.0.0"
  },

  "idempotency_key": "uuid"
}
```

`mode`：

```text
auto
match_only
generate_footprint
generate_model
normalize_model
validate_existing
preview_only
review_only
```

---

# 43. Agent 输出

```json
{
  "agent_id": "kicad-footprint-3d-mapping",
  "agent_version": "1.0.0",
  "job_id": "uuid",
  "status": "completed",

  "asset": {
    "footprint_asset_id": "uuid",
    "library_name": "Package_DFN_QFN",
    "footprint_name": "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm"
  },

  "decision": {
    "footprint_source": "matched_internal",
    "footprint_match_score": 0.99,
    "model_source": "manufacturer_official",
    "model_match_score": 0.96
  },

  "artifacts": {
    "footprint_uri": "s3://.../footprint.kicad_mod",
    "step_uri": "s3://.../model.step",
    "vrml_uri": "s3://.../model.wrl",
    "manifest_uri": "s3://.../manifest.json",
    "mapping_report_uri": "s3://.../mapping.json",
    "validation_report_uri": "s3://.../validation.json",
    "preview_2d_uri": "s3://.../2d.png",
    "preview_3d_uri": "s3://.../3d.png"
  },

  "summary": {
    "electrical_pads": 33,
    "mechanical_pads": 0,
    "npth": 0,
    "models": 2,
    "nonzero_model_transform": false
  },

  "quality": {
    "package_match_score": 0.99,
    "pin_pad_match_score": 1.0,
    "pin1_score": 1.0,
    "dimension_score": 0.98,
    "model_alignment_score": 0.97,
    "kicad9_validation": 1.0,
    "kicad10_validation": 1.0,
    "overall_score": 0.98,
    "review_required": false,
    "review_reasons": []
  }
}
```

---

# 44. 状态机

```text
RECEIVED
  ↓
LOADING_APPROVED_PACKAGE_DATA
  ↓
BUILDING_PACKAGE_GEOMETRY_IR
  ↓
SEARCHING_FOOTPRINT_CANDIDATES
  ↓
SCORING_FOOTPRINTS
  ↓
SELECTING_OR_GENERATING_FOOTPRINT
  ↓
BUILDING_PAD_MAP
  ↓
VALIDATING_PIN_PAD_MAP
  ↓
SEARCHING_3D_MODELS
  ↓
SCORING_3D_MODELS
  ↓
SELECTING_OR_GENERATING_MODEL
  ↓
NORMALIZING_MODEL
  ↓
COMPUTING_MODEL_TRANSFORM
  ↓
SERIALIZING_FOOTPRINT
  ↓
STATIC_VALIDATION
  ↓
GEOMETRY_VALIDATION
  ↓
KICAD9_BOARD_VALIDATION
  ↓
KICAD10_BOARD_VALIDATION
  ↓
STEP_EXPORT_VALIDATION
  ↓
VISUAL_REGRESSION
  ↓
QUALITY_EVALUATING
  ↓
STORING_ARTIFACTS
  ↓
COMPLETED
```

分支：

```text
REVIEW_REQUIRED
MISSING_GEOMETRY
MISSING_MODEL
RETRY_PENDING
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 45. 强制审核条件

- 关键 Package Dimension 缺失；
- 多个 Footprint 高分且无法消歧；
- Package Code 与尺寸冲突；
- Pin Count 不一致；
- Pad Number Set 不一致；
- Pin 1 不一致；
- Pinout 是 Bottom View 且方向不明；
- Exposed Pad 缺失；
- EP Number 冲突；
- BGA Ball Map 冲突；
- Footprint Pitch 不匹配；
- Manufacturer Land Pattern 与通用生成结果差异显著；
- Model Scale 非 1；
- Model Offset/Rotation 非零且策略不允许；
- STEP Body 尺寸不匹配；
- STEP Pin 1 无法验证；
- Model 穿板或浮空；
- Lead 与错误 Pad 对齐；
- Connector/Module 自动生成；
- 模型许可证不明确；
- KiCad 9/10 验证结果不同；
- STEP Export 失败；
- Symbol–Footprint Pin/Pad 不一致。

---

# 46. 数据模型

## 46.1 `kicad_footprint_model_jobs`

```text
id UUID PK
part_id UUID NOT NULL
package_variant_id UUID NOT NULL
mode VARCHAR NOT NULL
targets JSONB NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
match_policy_version VARCHAR NOT NULL
generation_policy_version VARCHAR NOT NULL
package_registry_version VARCHAR NOT NULL
model_policy_version VARCHAR NOT NULL
validation_policy_version VARCHAR NOT NULL
idempotency_key VARCHAR NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 46.2 `kicad_footprint_assets`

```text
id UUID PK
job_id UUID NOT NULL
part_id UUID NOT NULL
package_variant_id UUID NOT NULL
library_name VARCHAR NOT NULL
footprint_name VARCHAR NOT NULL
source_type VARCHAR NOT NULL
footprint_uri TEXT NOT NULL
footprint_sha256 CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
manifest_uri TEXT NOT NULL
overall_quality NUMERIC(5,4)
review_required BOOLEAN NOT NULL
review_reasons JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 46.3 `kicad_3d_model_assets`

```text
id UUID PK
footprint_asset_id UUID NOT NULL
format VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_uri TEXT NOT NULL
normalized_uri TEXT NULL
sha256 CHAR(64) NOT NULL
geometry_hash CHAR(64) NULL
license_data JSONB NOT NULL
bbox JSONB NOT NULL
transform JSONB NOT NULL
alignment_score NUMERIC(5,4)
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 46.4 `kicad_footprint_symbol_links`

```text
id UUID PK
footprint_asset_id UUID NOT NULL
symbol_asset_id UUID NOT NULL
part_id UUID NOT NULL
package_variant_id UUID NOT NULL
pin_pad_report_uri TEXT NOT NULL
match_score NUMERIC(5,4)
blocking_conflicts JSONB NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(footprint_asset_id, symbol_asset_id)
```

## 46.5 `kicad_footprint_reviews`

```text
id UUID PK
job_id UUID NOT NULL
footprint_asset_id UUID NULL
object_type VARCHAR NOT NULL
object_id VARCHAR NULL
review_type VARCHAR NOT NULL
status VARCHAR NOT NULL
reason_codes JSONB NOT NULL
candidate_data JSONB NOT NULL
resolution JSONB NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

---

# 47. 产物存储

```text
generated/kicad-footprints/
  {manufacturer}/
    {package_family}/
      {footprint_name}/
        input/
          package_geometry_ir.json
          candidates.json
        footprint/
          library.pretty/
            footprint.kicad_mod
        models/
          raw/
          normalized/
          library.3dshapes/
            footprint.step
            footprint.wrl
        validation/
          static.json
          geometry.json
          pin-pad.json
          kicad9/
          kicad10/
          step-export/
        previews/
          2d/
          3d/
        manifest.json
        mapping-report.json
        compatibility-report.json
```

---

# 48. 错误码

```text
PACKAGE_VARIANT_NOT_FOUND
PACKAGE_GEOMETRY_INCOMPLETE
PACKAGE_CODE_CONFLICT
FOOTPRINT_CANDIDATE_NOT_FOUND
FOOTPRINT_MATCH_AMBIGUOUS
FOOTPRINT_GENERATION_UNSUPPORTED
FOOTPRINT_SERIALIZATION_FAILED
PAD_NUMBER_DUPLICATE
PAD_NUMBER_SET_MISMATCH
PIN_PAD_MISMATCH
PIN1_MISMATCH
PITCH_MISMATCH
BODY_SIZE_MISMATCH
EXPOSED_PAD_MISSING
EXPOSED_PAD_NUMBER_CONFLICT
BGA_MAP_MISMATCH
COURTYARD_INVALID
SILK_PAD_CLEARANCE_FAILED
FAB_OUTLINE_INVALID
MODEL_NOT_FOUND
MODEL_LICENSE_UNKNOWN
MODEL_PARSE_FAILED
MODEL_SCALE_INVALID
MODEL_DIMENSION_MISMATCH
MODEL_ALIGNMENT_FAILED
MODEL_PIN1_UNRESOLVED
MODEL_BOARD_COLLISION
MODEL_FLOATING
KICAD9_VALIDATION_FAILED
KICAD10_VALIDATION_FAILED
STEP_EXPORT_FAILED
VRML_EXPORT_FAILED
VISUAL_REGRESSION_FAILED
PATCH_BASE_VERSION_MISMATCH
REVIEW_REQUIRED
JOB_CANCELLED
INTERNAL_ERROR
```

---

# 49. 人工审核工作台

## 49.1 页面布局

```text
左侧：Package Drawing / Land Pattern / Pinout
中间：2D Footprint Canvas
右侧：3D Viewer
底部：候选、尺寸、Pin–Pad、证据和版本
```

## 49.2 2D 操作

- 选择 Footprint Candidate；
- 查看 Pad Number；
- 修改 Pad Size；
- 修改 Pitch；
- 修改 Origin；
- 修改 Pin 1；
- 修改 Silk；
- 修改 Fab；
- 修改 Courtyard；
- 修改 Paste Window；
- 添加 Thermal Via Variant。

## 49.3 3D 操作

- 选择 Model Candidate；
- 平移；
- 旋转；
- 显示 Board Plane；
- 显示 Pad；
- 显示 F.Fab；
- 显示 Pin 1；
- 切换 Raw / Normalized；
- 保存 Transform；
- 请求重新生成 STEP。

## 49.4 Patch

```json
{
  "target": "footprint-asset-id",
  "base_version": "machine-v1",
  "operations": [
    {
      "op": "replace",
      "path": "/models/0/transform/rotation/2",
      "old_value": "90",
      "value": "0"
    },
    {
      "op": "replace",
      "path": "/models/0/transform/offset/0",
      "old_value": "0.5",
      "value": "0"
    }
  ],
  "reason": "STEP model normalized to footprint center."
}
```

---

# 50. Evidence 与 Provenance

每个 Footprint 保存：

- Package Geometry Evidence；
- Package Drawing；
- Land Pattern；
- Pad Map；
- Generator Policy；
- Existing Asset Source；
- Match Score；
- Human Patch。

每个 Model 保存：

- Source；
- License；
- SHA256；
- Geometry Hash；
- Raw BBox；
- Normalization Transform；
- Footprint Mapping；
- Alignment Report；
- KiCad Export Result。

---

# 51. 安全与许可证

- CAD Worker 隔离运行；
- STEP/VRML 视为不可信输入；
- 限制文件大小、实体数和网格数；
- 防止压缩炸弹；
- 不执行嵌入脚本；
- 模型路径禁止穿越；
- 只输出白名单扩展名；
- 第三方模型必须记录许可证；
- 不重新分发无授权文件；
- 用户私有模型按租户隔离；
- KiCad CLI 在容器中运行；
- 不写用户全局 Footprint Table。

---

# 52. 可观测性

## 52.1 Prometheus

```text
kicad_footprint_jobs_total{status,mode}
kicad_footprint_match_total{source_type,result}
kicad_footprint_generation_total{family,result}
kicad_footprint_pad_mismatch_total{type}
kicad_footprint_pin1_conflict_total{family}
kicad_footprint_dimension_conflict_total{dimension}
kicad_3d_model_match_total{source_type,result}
kicad_3d_model_normalization_total{result}
kicad_3d_model_nonzero_transform_total{axis}
kicad_3d_model_alignment_failures_total{reason}
kicad_3d_model_license_unknown_total{source}
kicad_footprint_kicad_validation_total{target,result}
kicad_footprint_step_export_total{target,result}
kicad_footprint_review_total{reason}
kicad_footprint_cache_hits_total
```

## 52.2 Dashboard

- Footprint 复用率；
- 自动生成率；
- 内部映射命中率；
- 官方库命中率；
- Pin–Pad 冲突率；
- Pin 1 冲突率；
- 未知 Package Code；
- STEP 覆盖率；
- 归一化模型比例；
- 非零 Transform 比例；
- 3D 尺寸冲突；
- KiCad 9/10 通过率；
- 人工修订率；
- 各 Package Family 质量。

---

# 53. 测试集

公开仓库只使用合成、官方许可或自有 Fixture。

## 53.1 Footprint 基础

1. SMD 两脚；
2. THT 两脚；
3. SOIC8；
4. TSSOP8；
5. MSOP10；
6. QFN32 EP；
7. QFN Thermal Vias；
8. LQFP48；
9. BGA64；
10. WLCSP25；
11. SOT23-5；
12. TO-220；
13. DIP8；
14. Connector；
15. Module。

## 53.2 Pad

16. Rect；
17. Roundrect；
18. Oval；
19. Circle；
20. Custom；
21. Slotted THT；
22. NPTH；
23. EP；
24. SH；
25. MP；
26. Same-number Copper；
27. Duplicate illegal；
28. Missing Pad；
29. Ball map；
30. Paste window。

## 53.3 Layers

31. F.SilkS；
32. F.Fab；
33. F.CrtYd；
34. Pin 1 marker；
35. Silk over Pad；
36. Open Courtyard；
37. Keepout；
38. Reference；
39. Value；
40. Bottom Footprint。

## 53.4 Mapping

41. Exact Package Code；
42. Same name different body；
43. Same body different pitch；
44. Same pad geometry different height；
45. Multiple candidate tie；
46. Existing internal mapping；
47. Official mapping；
48. Generated fallback；
49. Family applicability；
50. Ordering Variant mapping。

## 53.5 3D

51. Correct STEP；
52. STEP rotated 90°；
53. STEP shifted；
54. STEP inches/mm mismatch；
55. STEP body too large；
56. STEP height wrong；
57. STEP mirrored；
58. STEP floating；
59. STEP through board；
60. Pin 1 marker conflict；
61. VRML correct；
62. VRML scale wrong；
63. Missing model；
64. License unknown；
65. Model geometry duplicate。

## 53.6 KiCad

66. KiCad 9 load；
67. KiCad 10 load；
68. Test board DRC；
69. STEP export；
70. GLB export；
71. VRML export；
72. Rotation 0/90/180/270；
73. Bottom side；
74. Round-trip；
75. Visual Regression；
76. CLI timeout；
77. CLI crash；
78. Model path variable；
79. Missing environment variable；
80. Batch library。

---

# 54. Benchmark

## 54.1 Footprint 匹配

- Exact Mapping Accuracy；
- Candidate Top-1 Accuracy；
- Candidate Top-3 Recall；
- False Match Rate；
- Generated-vs-Matched Decision Accuracy。

## 54.2 Footprint 几何

- Pad Number Accuracy；
- Pitch Accuracy；
- Pad Position Error；
- Body Size Error；
- EP Size Error；
- Pin 1 Accuracy；
- Courtyard Pass；
- Silk Clearance Pass。

## 54.3 3D

- Model Match Accuracy；
- Body Dimension Error；
- Height Error；
- Alignment Translation Error；
- Alignment Rotation Accuracy；
- Board Plane Error；
- Pin 1 Orientation Accuracy；
- Lead–Pad Overlap；
- STEP Export Success。

## 54.4 分组报告

按：

- Package Family；
- 厂商；
- 资产来源；
- 匹配/生成；
- Pin Count；
- EP；
- BGA；
- STEP/VRML；
- KiCad 版本；
- Ordering Variant。

---

# 55. 初始质量目标

```text
已审核精确映射准确率 >= 99.9%
Footprint Top-1 匹配准确率 >= 98%
Pin–Pad Number Accuracy = 100%
Pin 1 Accuracy >= 99.5%
Pitch Error <= 0.01 mm
Body Dimension Error <= 0.10 mm
EP Mapping Accuracy >= 99%

STEP Match Accuracy >= 97%
3D Board Plane Error <= 0.05 mm
3D XY Alignment Error <= 0.10 mm
3D Rotation Accuracy >= 99%
KiCad 9 Load Success >= 99.5%
KiCad 10 Load Success >= 99.5%
STEP Export Success >= 99%
高置信度自动批准准确率 >= 98%
```

这些是目标，不是未经验证的保证。

---

# 56. 工程验收标准

## 56.1 功能

- 能消费批准 Package 数据；
- 能生成 Package Geometry IR；
- 能检索已有 Footprint；
- 能评分和选择 Footprint；
- 能生成 V1 支持的 Footprint；
- 能生成 Pad Map；
- 能校验 Symbol Pin 与 Pad；
- 能校验 Pin 1；
- 能处理 EP/SH/MP/NPTH；
- 能生成 Fab/Silk/Courtyard；
- 能检索 STEP/VRML；
- 能归一化 STEP；
- 能计算 3D Transform；
- 能生成 STEP；
- 能生成 VRML；
- 能运行 KiCad 9/10；
- 能生成测试 Board；
- 能导出 STEP；
- 能生成 2D/3D Preview；
- 能进入人工审核；
- 能保存 Patch；
- 能发布下游事件。

## 56.2 工程质量

- 单元测试覆盖率 >= 85%；
- Pad Map >= 95%；
- Geometry Validator >= 95%；
- 3D Transform >= 95%；
- Serializer >= 95%；
- JSON Schema 通过；
- Ruff 通过；
- mypy 通过；
- Decimal 几何；
- 不使用 float 作为权威尺寸；
- 不提交无授权 CAD；
- 不伪造 KiCad 结果。

## 56.3 性能

- 已有映射查询 P95 < 200 ms；
- Footprint Candidate Search P95 < 1 s；
- 参数化 Footprint 生成目标 < 3 s；
- STEP 简单模型生成目标 < 10 s；
- KiCad 9/10 Validation 可并行；
- STEP Export P95 < 20 s；
- 相同输入命中缓存；
- 批量任务按 Package Variant 去重。

---

# 57. 缓存与增量更新

缓存键：

```text
package_geometry_hash
+ pin_map_hash
+ symbol_pin_set_hash
+ footprint_match_policy
+ generation_policy
+ package_registry_version
+ model_policy
+ target_kicad_version
```

## 57.1 Package 数据变化

重建匹配和生成。

## 57.2 仅 Symbol Pin 变化

只重跑 Pin–Pad 校验。

## 57.3 仅 3D Model 变化

只重跑 Model Alignment 和 3D Validation。

## 57.4 仅 KiCad 版本变化

只重跑 Target Validation。

## 57.5 仅 Human Transform Patch

只重建 `.kicad_mod` Model Section 和 3D Tests。

---

# 58. 推荐仓库结构

```text
kicad-footprint-3d-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── kicad-footprint-3d-agent-spec.md
│   ├── package-geometry-ir.md
│   ├── footprint-match-engine.md
│   ├── footprint-generation.md
│   ├── pad-map.md
│   ├── pin1-validation.md
│   ├── 3d-model-registry.md
│   ├── 3d-normalization.md
│   ├── kicad-validation.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-match-before-generate.md
│       ├── 0002-package-geometry-ir.md
│       ├── 0003-step-is-authoritative.md
│       ├── 0004-canonical-zero-transform.md
│       └── 0005-real-kicad-board-validation.md
├── src/
│   └── footprint_3d_agent/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       ├── events/
│       ├── jobs/
│       ├── geometry/
│       │   ├── models.py
│       │   ├── builder.py
│       │   ├── dimensions.py
│       │   ├── pin_numbering.py
│       │   └── semantic_hash.py
│       ├── matching/
│       │   ├── index.py
│       │   ├── candidates.py
│       │   ├── scorer.py
│       │   ├── authoritative.py
│       │   └── conflicts.py
│       ├── footprints/
│       │   ├── ir.py
│       │   ├── pad_map.py
│       │   ├── serializer.py
│       │   ├── layers.py
│       │   ├── pin1.py
│       │   ├── courtyard.py
│       │   ├── paste.py
│       │   ├── thermal_vias.py
│       │   └── generators/
│       │       ├── qfn.py
│       │       ├── qfp.py
│       │       ├── soic.py
│       │       ├── bga.py
│       │       ├── sot.py
│       │       └── chip.py
│       ├── models3d/
│       │   ├── registry.py
│       │   ├── loader.py
│       │   ├── geometry_hash.py
│       │   ├── source_policy.py
│       │   ├── normalizer.py
│       │   ├── transform.py
│       │   ├── aligner.py
│       │   ├── step_generator.py
│       │   ├── vrml_generator.py
│       │   └── license.py
│       ├── sexpr/
│       │   ├── ast.py
│       │   ├── parser.py
│       │   └── formatter.py
│       ├── validation/
│       │   ├── static.py
│       │   ├── pad.py
│       │   ├── geometry.py
│       │   ├── pin_pad.py
│       │   ├── pin1.py
│       │   ├── model.py
│       │   ├── test_board.py
│       │   ├── kicad_cli.py
│       │   ├── step_export.py
│       │   └── visual_regression.py
│       ├── review/
│       ├── storage/
│       ├── security/
│       └── observability/
├── policies/
├── package-registry/
├── model-registry/
├── schemas/
│   ├── package-geometry-ir.schema.json
│   ├── footprint-generation-ir.schema.json
│   ├── model-asset.schema.json
│   ├── mapping-report.schema.json
│   └── validation-report.schema.json
├── fixtures/
│   ├── kicad9/
│   ├── kicad10/
│   ├── step/
│   └── vrml/
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── geometry/
│   ├── matching/
│   ├── footprints/
│   ├── models3d/
│   ├── kicad9/
│   ├── kicad10/
│   ├── visual_regression/
│   └── fixtures/
├── benchmark/
│   ├── manifests/
│   ├── expected/
│   ├── evaluators/
│   └── reports/
└── scripts/
    ├── index_existing_footprints.py
    ├── index_existing_models.py
    ├── generate_golden_fixtures.py
    ├── validate_footprint.py
    ├── normalize_step.py
    ├── render_3d_previews.py
    ├── run_footprint_benchmark.py
    └── rebuild_affected_assets.py
```

---

# 59. Codex 分阶段实施

不要让 Codex 一次完成全部功能。

## Phase 0：仓库侦察与资产盘点

Codex 必须：

1. 阅读前八个 Agent；
2. 打开实际 PackageCatalog；
3. 打开实际 PinCatalog；
4. 打开实际 Symbol Asset；
5. 统计现有约 2 万 Footprint；
6. 统计现有 STEP / VRML；
7. 统计约 90 万 Package Mapping；
8. 查找现有 Footprint Generator；
9. 查找现有 3D Mapping 和 Offset；
10. 查找 KiCad 9/10 环境；
11. 输出资产质量盘点；
12. 输出复用和迁移方案；
13. 不修改业务代码；
14. 不创建 Migration；
15. 不安装依赖。

## Phase 1：Package Geometry IR 与数据契约

实现：

- Geometry IR；
- Dimensions；
- Pin Numbering；
- EP/SH/MP；
- Evidence；
- JSON Schema；
- Semantic Hash。

## Phase 2：Footprint / Model 索引

实现：

- 解析现有 `.kicad_mod`；
- 索引 Pads；
- 索引 Body/Fab/Courtyard；
- 解析 Model Section；
- 索引 STEP/VRML；
- Hash；
- License；
- Mapping。

## Phase 3：Footprint Candidate Match

实现：

- Authoritative Mapping；
- Package Code；
- Family；
- Pin Count；
- Pitch；
- Body；
- EP；
- Candidate Top-K；
- Conflict。

## Phase 4：Pad Map 与 Symbol Cross Validation

实现：

- Electrical Pad；
- EP；
- SH；
- MP；
- NPTH；
- Symbol Pin Set；
- BGA Ball；
- Blocking Conflict。

## Phase 5：Footprint AST 与 Serializer

实现：

- Footprint AST；
- Pad；
- Text；
- Fab；
- Silk；
- Courtyard；
- Model；
- Decimal；
- Stable Output；
- Basic Round-trip。

## Phase 6：基础 Package Generator

实现：

- Chip；
- SOIC；
- TSSOP；
- QFN；
- QFP；
- SOT；
- Generated Footprint Preview。

## Phase 7：高级 Pad/Paste/Thermal

实现：

- Custom Pad；
- EP；
- Paste Window；
- Thermal Via Variant；
- BGA；
- Keepout；
- Courtyard。

## Phase 8：Pin 1 与 Layer Validation

实现：

- Orientation；
- Pin 1 Marker；
- Fab Bevel；
- Silk Clearance；
- Closed Courtyard；
- Origin。

## Phase 9：3D Model Registry 与 Match

实现：

- STEP/VRML Parser；
- Source Policy；
- License；
- Geometry Hash；
- BBox；
- Candidate Scoring；
- Duplicate。

## Phase 10：3D Transform 与 Normalization

实现：

- Unit；
- BBox；
- Board Plane；
- Rotation Candidates；
- Offset；
- Canonical Frame；
- Normalized STEP；
- Inverse Transform。

## Phase 11：参数化 STEP/VRML 生成

实现：

- QFN；
- QFP；
- SOIC；
- SOT；
- BGA；
- STEP Validation；
- VRML Tessellation；
- Color Policy。

## Phase 12：Footprint–Model Alignment

实现：

- Body/Fab；
- Lead/Pad；
- Height；
- Pin 1；
- Collision；
- Alignment Score；
- Review。

## Phase 13：KiCad 9/10 Test Board Validation

实现：

- Golden Fixture；
- Test Board；
- Load；
- DRC；
- Plot；
- STEP Export；
- GLB/VRML；
- Rotation；
- Bottom Side；
- Visual Regression。

## Phase 14：审核与 Patch

实现：

- Candidate Review；
- 2D Editor Data；
- 3D Transform Editor；
- Pad Patch；
- Model Patch；
- Resolved Asset；
- Audit。

## Phase 15：API、事件、批处理和缓存

实现：

- API；
- Events；
- Batch；
- Retry/Cancel；
- Revalidate；
- Remap；
- Renormalize；
- Cache；
- Idempotency。

## Phase 16：Benchmark、监控与生产发布

实现：

- Benchmark；
- Metrics；
- Dashboard；
- README；
- Deployment；
- Library Packaging；
- KiCad Upgrade；
- Registry Rollback；
- License Report。

---

# 60. Codex 工作纪律

Codex 必须：

1. 先盘点已有 90 万映射；
2. 匹配优先于生成；
3. Package Name 不是唯一匹配键；
4. Package Body、Terminal 和 Land Pattern 分开；
5. 使用 Package Geometry IR；
6. Symbol Pin 与 Footprint Pad 阻断校验；
7. Pin 1 必须多源验证；
8. EP/SH/MP/NPTH 分开；
9. 不静默添加 Thermal Via；
10. Manufacturer Land Pattern 优先；
11. STEP 为权威机械模型；
12. VRML 为显示辅助；
13. Scale 默认 1；
14. 正式模型目标 Offset/Rotation 为 0；
15. 非零 Transform 必须有报告；
16. 不用 Scale 修复单位错误；
17. 不凭对称模型宣称 Pin 1 正确；
18. 不用 LLM 自由生成几何；
19. 不用 LLM 猜尺寸；
20. 不生成缺少关键尺寸的生产 Footprint；
21. 不发明 S-expression Token；
22. 使用真实 KiCad 9/10 Fixture；
23. 使用测试 PCB 验证 3D；
24. 不覆盖原始 Footprint/Model；
25. 不覆盖人工 Patch；
26. 不打包无授权 CAD；
27. 不伪造 KiCad/STEP 测试结果；
28. 每个 Phase 输出：
    - 修改文件；
    - IR/Schema 变化；
    - Registry 变化；
    - Candidate Match；
    - 测试命令；
    - 真实 KiCad 版本；
    - 真实测试结果；
    - 2D/3D 结果；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 61. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/kicad-footprint-3d-agent-spec.md
```

然后将以下提示词交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第九个基础 Agent：

KiCad Footprint & 3D Model Mapping Agent。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. 前八个 Agent 的完整规格；
3. docs/kicad-footprint-3d-agent-spec.md；
4. 前八个 Agent 的实际代码、事件和 Schema；
5. 当前 PackageCatalog、PinCatalog 和 OrderingCatalog；
6. 当前 KiCad Symbol Assets；
7. 当前约 2 万 Footprint；
8. 当前 STEP/VRML/3D 模型；
9. 当前约 90 万型号封装映射；
10. 当前 Package Registry 和 Manufacturer Package Code；
11. 当前 KiCad 9/10、对象存储、数据库、任务队列、审核、Docker 和 CI。

本 Agent 的职责是：

- 使用已审核的 Package、Pin 和 Symbol 数据；
- 建立 Package Geometry IR；
- 优先匹配已有 Footprint；
- 在无法匹配时生成支持的标准 Footprint；
- 生成或校验 Pad Map；
- 校验 Symbol Pin Number 与 Footprint Pad Number；
- 校验 Pin 1、EP、SH、MP 和 NPTH；
- 校验 Pitch、Body、Lead Span、Pad Position 和 Package Size；
- 生成 F.Fab、F.SilkS、F.CrtYd、F.Paste 和 F.Mask；
- 优先匹配已有 STEP/VRML；
- 在支持范围内生成 STEP/VRML；
- 校验 Model Scale、Offset 和 Rotation；
- 将模型归一到 Footprint Origin、Board Plane 和 Pin 1；
- 校验 Body/Fab、Lead/Pad、Height 和 Collision；
- 生成 KiCad 9/10 兼容 `.kicad_mod`；
- 使用真实 KiCad 9/10 测试 Board、DRC、STEP Export 和 3D Preview；
- 输出 Manifest、Mapping、License 和 Validation Report；
- 低置信度和冲突进入审核；
- 发布 component.kicad-footprint-3d.ready。

硬约束：

- 先复用现有 90 万映射和 2 万 Footprint；
- 匹配优先，生成兜底；
- 不能仅按 Package Name 匹配；
- Package Body、Terminal Geometry 和 Land Pattern 必须分开；
- Symbol Pin 与 Footprint Pad 是阻断校验；
- Pin 1 必须结合 Drawing、Pinout、Pad、Silk、Fab 和 3D；
- EP、SH、MP、NPTH 必须分开；
- 不静默添加 Thermal Via；
- Manufacturer Recommended Land Pattern 优先；
- 关键尺寸缺失时不得生成生产 Footprint；
- STEP 是权威机械模型；
- VRML 是显示辅助；
- 正式 Canonical Model 目标 Scale=1、Offset=0、Rotation=0；
- 非零 Transform 必须记录证据和验证；
- 不使用 Scale 掩盖单位错误；
- 不因模型对称就宣称 Pin 1 已验证；
- 不凭记忆发明 KiCad Token；
- 第三方 generator 不得使用 pcbnew；
- 必须使用真实 KiCad 9/10 Golden Fixture；
- 必须用测试 PCB 验证 3D；
- V1 不调用外部通用大模型；
- 不用 LLM 自由生成几何或猜尺寸；
- 不覆盖原始 Footprint/Model；
- 不覆盖人工 Patch；
- 不打包许可证不明确的 CAD；
- 不提交厂商受版权保护模型；
- 不伪造测试结果。

现在只执行 Phase 0，不实现业务代码：

1. 侦察当前仓库；
2. 检查前八个 Agent 的实际完成程度；
3. 打开实际 PackageCatalog、PinCatalog 和 Symbol Asset；
4. 统计全部 `.kicad_mod`；
5. 统计 STEP、STP、WRL、VRML；
6. 统计 90 万 Mapping 的字段、来源、重复和冲突；
7. 抽样解析 Footprint Pad、Fab、Silk、Courtyard、Model Section；
8. 抽样解析 STEP BBox、单位和 Origin；
9. 查找现有 Footprint Generator、3D Generator 和 Model Offset 代码；
10. 查找 KiCad 9/10 环境并运行 `kicad-cli version --format about`；
11. 检查 KiCad CLI 的 PCB DRC、STEP Export、GLB/VRML 能力；
12. 在 docs/kicad-footprint-3d-implementation-plan.md 中生成实施计划；
13. 在 docs/package-geometry-ir.md 中生成 Geometry IR；
14. 在 docs/footprint-match-engine-plan.md 中生成候选匹配方案；
15. 在 docs/footprint-generation-plan.md 中生成参数化生成方案；
16. 在 docs/3d-model-registry-and-normalization.md 中生成模型注册和归一化方案；
17. 在 docs/kicad-footprint-3d-validation-plan.md 中生成 KiCad/Test Board/3D 验证方案；
18. 在 docs/kicad-footprint-3d-migration-plan.md 中生成旧资产复用与迁移方案；
19. 在 docs/kicad-footprint-3d-benchmark-plan.md 中生成 Benchmark；
20. 给出拟新增、拟修改和拟复用文件；
21. 给出 Phase 1 精确范围；
22. 不修改业务代码；
23. 不创建 Migration；
24. 不安装依赖；
25. 运行当前仓库已有 lint、type check 和测试。

如果缺少 KiCad、CAD Kernel、STEP Parser 或模型许可证数据，明确记录，不得编造结果。

最终回复必须包含：

- 仓库现状；
- 与前八个 Agent 的衔接；
- 现有 Footprint/3D/Mapping 资产盘点；
- 数据质量与重复；
- Package Geometry IR；
- Footprint Match；
- Footprint Generator；
- Pad/Pin 交叉验证；
- Pin 1；
- STEP/VRML Registry；
- Model Normalization；
- 3D Alignment；
- KiCad 9/10 Test Board 验证；
- 许可证方案；
- 旧资产迁移；
- Benchmark；
- 分阶段实施计划；
- Phase 1 修改范围；
- 测试命令和真实结果；
- 阻塞问题。
```

---

# 62. 后续 Phase 提示词模板

```text
继续实现 KiCad Footprint & 3D Model Mapping Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读九个 Agent 的规格；
3. 阅读 Implementation Plan；
4. 阅读 Package Geometry IR；
5. 阅读 Footprint Match / Generation Plan；
6. 阅读 3D Registry / Normalization；
7. 阅读 Validation Plan；
8. 检查上一阶段代码和测试；
9. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Match before Generate；
- Package Geometry IR；
- Pin–Pad 阻断校验；
- Pin 1 多源验证；
- EP/SH/MP/NPTH 分开；
- Manufacturer Land Pattern 优先；
- STEP 权威；
- Scale 1；
- Canonical Zero Transform；
- 真实 KiCad Test Board；
- 不依赖外部 LLM；
- 不覆盖原始和人工结果；
- 不打包无授权模型；
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
9. 运行 KiCad 9；
10. 运行 KiCad 10；
11. 运行 STEP/VRML/3D Validation；
12. 运行 Visual Regression；
13. 更新文档；
14. 总结修改。

最终回复：

- 修改文件；
- IR/Schema 变化；
- Registry/Policy 变化；
- Candidate Match；
- KiCad 版本；
- 测试命令和真实结果；
- 2D/3D 结果；
- Pin–Pad/Pin 1 结果；
- 性能；
- 已知限制；
- 下一阶段建议。
```

---

# 63. MVP 演示流程

1. 输入 LM358 SOIC-8 Package Variant；
2. 命中内部 Footprint；
3. 校验 Pad 1–8；
4. 校验 Symbol Pin 1–8；
5. 匹配 STEP；
6. 校验 Body Size；
7. 校验 Pin 1 Mark；
8. 输出 `.kicad_mod`；
9. KiCad 9/10 测试 Board 通过；
10. 导出 STEP；
11. 输入 QFN32 + EP；
12. 未命中精确 Footprint；
13. 使用 Manufacturer Land Pattern 生成；
14. 生成 Pad 1–32 和 EP 33；
15. 生成 Paste Window；
16. 不自动添加 Thermal Via；
17. 匹配旋转 90° 的第三方 STEP；
18. 自动识别 Rotation；
19. 归一化 STEP；
20. Transform 变为 0/0/0、1/1/1、0/0/0；
21. 检查 Lead–Pad；
22. 检查 Board Plane；
23. 检查 Pin 1；
24. 模拟镜像模型并阻断；
25. 人工修正；
26. 保存 Patch；
27. 输入 BGA Ball Map；
28. 检查 Missing Ball；
29. 输出 2D/3D Preview；
30. 发布 `component.kicad-footprint-3d.ready`。

---

# 64. 下游事件

```json
{
  "event_type": "component.kicad-footprint-3d.ready",
  "event_version": "1.0",
  "part_id": "uuid",
  "package_variant_id": "uuid",
  "footprint_asset_id": "uuid",

  "footprint": {
    "library_name": "Package_DFN_QFN",
    "footprint_name": "QFN-32-1EP_5x5mm_P0.5mm_EP3.45x3.45mm",
    "uri": "s3://.../footprint.kicad_mod"
  },

  "models": {
    "step_uri": "s3://.../model.step",
    "vrml_uri": "s3://.../model.wrl",
    "transform": {
      "offset": ["0", "0", "0"],
      "scale": ["1", "1", "1"],
      "rotation": ["0", "0", "0"]
    }
  },

  "symbol_links": [
    {
      "symbol_asset_id": "uuid",
      "pin_pad_match": true
    }
  ],

  "manifest_uri": "s3://.../manifest.json",
  "validation_report_uri": "s3://.../validation.json",
  "license_report_uri": "s3://.../license.json",

  "overall_quality": 0.98,
  "review_status": "approved",
  "created_at": "ISO-8601"
}
```

下游自动消费条件：

```text
review_status = approved
AND pin_pad_match = true
AND pin1_validation = true
AND target KiCad validation passed
AND model license is acceptable
AND no blocking dimension/alignment conflict
```

---

# 65. 官方技术参考

Codex 实施时必须重新检查当前目标版本的官方文档和 KLC。

## KiCad Footprint 文件格式

- https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/
- https://dev-docs.kicad.org/en/file-formats/sexpr-intro/

## KiCad 9 / 10 CLI

- https://docs.kicad.org/9.0/en/cli/cli.html
- https://docs.kicad.org/10.0/en/cli/cli.html

## KiCad PCB 与 3D

- https://docs.kicad.org/9.0/en/pcbnew/pcbnew.html
- https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html

## KiCad Library Conventions

- https://klc.kicad.org/
- https://klc.kicad.org/footprint/f4/f4.2.html
- https://klc.kicad.org/footprint/f5/f5.1.html
- https://klc.kicad.org/footprint/f5/f5.2.html
- https://klc.kicad.org/footprint/f9/f9.3.html
