# EDA 库依赖与 Pin-Pad 校验 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：20  
> Agent 名称：EDA Library Dependency, Integrity & Pin-Pad Validation Agent  
> 中文名称：EDA 库依赖与 Pin-Pad 校验 Agent  
> 类型：程序型  
> 版本：V1.0  
> 技术资料基线日期：2026-07-20  
>
> 定位：对 KiCad 工程及 Agent 16 统一 EDA IR 中涉及的符号、封装、3D 模型、库表、嵌套库表、路径变量、缓存快照和 Pin-Pad 映射进行确定性扫描、依赖解析、完整性校验、版本冲突检测与修复规划；输出可重放的依赖锁文件、问题清单、修复库、Source-aware Patch 和供 Agent 19 执行的 Canonical Change Plan。
>
> 核心问题：
> - 缺失符号库或符号定义
> - 缺失封装库或封装定义
> - 缺失 3D 模型
> - 库表缺失、路径变量失效和嵌套表断链
> - 同一库昵称解析到不同路径或不同内容
> - 工程实例快照与当前库定义不一致
> - 旧版 `*-cache.lib` 或跨工程缓存污染
> - 相同名称、不同内容的符号或封装冲突
> - 库格式版本和发布版本混淆
> - Pin Number 与 Pad Number 不一致
> - Symbol Pin 缺少对应 Pad
> - Footprint Pad 缺少对应 Pin
> - 重复 Pin Number 或重复 Pad Number
> - 合法 Stacked Pin、共享 Pad、多焊盘同号与错误重复的区分
> - Footprint 替换导致 Pad Set 改变
> - Symbol 更新导致 Pin Set 或 Pin Electrical Type 改变
> - Repair Patch 是否会改变网络、位号、放置或布线
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Part IR、Net IR、Library IR、Source Map
> - Agent 19：KiCad 环境、MCP/IPC/CLI 能力、执行工作区和 Change Plan
> - KiCad 工程文件、工程库表、全局库表快照、嵌套库表和路径变量
> - ezPLM 元器件库、KiCad 符号库、封装库、3D 模型和型号映射数据库
> - Git、制品仓库、企业 EDA 库注册表和批准的第三方库
>
> 下游：
> - Agent 19：执行修复 Plan、项目本地库 Vendor、属性重绑定和受控 Patch
> - Agent 16：重新解析和 Semantic Diff
> - Agent 31/32：BOM 与器件身份
> - Agent 43：NPI、制造资料与工程冻结
> - Agent 44：PCB/SMT 询价前工程完整性
> - Agent 45：AOI、ICT、FCT 使用的 Pin、Pad 和 RefDes 基准
> - CI、Git Review、Library Review Workbench 和 Release Gate
>
> 核心输出：
> - EDA Dependency Graph
> - Library Resolution Snapshot
> - `eda-libs.manifest.json`
> - `eda-libs.lock.json`
> - Symbol / Footprint / 3D Inventory
> - Semantic Fingerprint
> - Instance-vs-Library Drift Report
> - Pin-Pad Mapping Matrix
> - Duplicate Number Analysis
> - Library Conflict Report
> - Repair Candidate
> - Repair Plan
> - Repair Package
> - Source-aware Patch
> - Agent 19 Canonical Change Plan
> - Validation / Fidelity / Audit Report
>
> 重要边界：
> - 本 Agent 的检测、比较、分类和 Patch 生成完全程序化，不依赖通用 LLM。
> - 本 Agent 不直接在唯一生产工程上修改文件；低风险自动修复也必须在 Agent 19 的受控工作区内执行。
> - “文件能打开”不代表库依赖可复现。
> - “Pin 数量等于 Pad 数量”不代表 Pin-Pad 映射正确。
> - 相同库昵称不代表相同库，相同符号名称也不代表相同定义。
> - `.kicad_sym`、`.kicad_mod` 中的 `version` Token 表示文件格式版本，不应被当作企业库发布版本。
> - 重复 Pin Number 和重复 Pad Number 在某些设计中是合法的，不能一律报错或自动去重。
> - 原理图中的嵌入符号定义、PCB 中的封装实例和外部库定义必须分开比较。
> - 未解析库、未知版本、无法确认的重复编号和可能改变连通性的修复必须保持 `unresolved` 或进入人工审核。
> - 不从不受信任 URL 自动下载库、3D 模型或脚本。
> - 不执行库包中的宏、生成器、插件或任意命令。
> - 不把私有工程、企业库和 3D 模型发送给外部通用模型。

---

# 1. 当前 KiCad 库技术基线

## 1.1 符号库

现代 KiCad 符号库使用：

```text
.kicad_sym
```

KiCad 10 还支持“解包式”符号库：

```text
一个目录中包含多个 .kicad_sym 文件
常用目录约定：.kicad_symdir
```

工程中使用的符号定义同时会嵌入 `.kicad_sch` 的 `lib_symbols` 区域，因此：

```text
工程实例可能仍能显示
≠
外部原始符号库依赖仍然可解析
```

## 1.2 封装库

现代 KiCad 封装库通常是：

```text
*.pretty/
  footprint-a.kicad_mod
  footprint-b.kicad_mod
```

每个 `.kicad_mod` 文件定义一个封装。

PCB 文件中保存已放置封装的实例数据，因此外部封装库缺失时 PCB 仍可能打开，但：

```text
无法可靠替换、更新、复用或重新生成库来源
```

## 1.3 库表

符号和封装库通过：

```text
sym-lib-table
fp-lib-table
```

映射：

```text
library nickname
→ URI/path/provider
```

需要同时解析：

```text
用户全局库表
工程专用库表
嵌套库表
企业共享库表
```

工程专用依赖优先推荐使用：

```text
${KIPRJMOD}
```

以避免绝对路径导致工程在其他机器上失效。

## 1.4 路径变量

依赖解析上下文包括：

```text
${KIPRJMOD}
KiCad 版本路径变量
用户自定义变量
企业变量
操作系统环境变量
```

必须保存当次扫描的变量快照。

## 1.5 HTTP 和非原生库

KiCad 当前可在库表中引用多种库类型，包括非 KiCad 格式和 HTTP Library 配置。

本 Agent 的处理原则：

```text
可发现
可解析 Manifest
默认不自动联网
需要可信 Provider、固定版本、Hash 和许可证
```

非原生只读库的修复建议优先转换或 Vendor 为项目本地 KiCad 原生库。

## 1.6 旧版缓存

旧版工程可能包含：

```text
*.sch
*.lib
*.dcm
*-cache.lib
*-rescue.lib
```

需要识别：

```text
旧工程真正依赖的缓存
残留但未使用的缓存
与当前库同名不同内容的污染
Rescue 后仍未更新引用的对象
```

---

# 2. Agent 20 的系统位置

```text
Agent 16 解析工程与库
          ↓
Agent 20 依赖、完整性与 Pin-Pad 校验
          ↓
Repair Plan / Patch / Project-local Libraries
          ↓
Agent 19 受控执行
          ↓
Agent 16 重新解析和 Diff
          ↓
ERC / DRC / Release Gate
```

## 2.1 对 Agent 16

Agent 16负责回答：

```text
工程中有哪些 Symbol、Footprint、Pad、Pin、Library ID 和 Source Map
```

Agent 20负责回答：

```text
这些依赖是否能解析
实例与库是否一致
Pin-Pad 是否兼容
如何安全修复
```

## 2.2 对 Agent 19

Agent 20不直接自由写文件，而输出：

```text
Repair Plan
Canonical Change Operations
Source-aware Patch
Recovered Library Assets
Preconditions
Postconditions
Risk
Rollback Policy
```

由 Agent 19执行、回读和验证。

---

# 3. 建设目标

系统必须能够：

1. 接收 KiCad 工程目录、ZIP、Git Revision 或 Agent 16 IR Bundle；
2. 建立不可变输入快照；
3. 识别 KiCad 主要版本；
4. 识别现代和旧版工程；
5. 读取 `.kicad_pro`；
6. 读取 `.kicad_sch`；
7. 读取 `.kicad_pcb`；
8. 读取 `.kicad_sym`；
9. 读取解包式符号库目录；
10. 读取 `.kicad_mod` 和 `.pretty`；
11. 读取 `sym-lib-table`；
12. 读取 `fp-lib-table`；
13. 读取嵌套库表；
14. 读取 `.kicad_dru`；
15. 读取 3D Model Reference；
16. 读取 Legacy `.lib/.dcm/*-cache.lib/*-rescue.lib`；
17. 识别非原生或 HTTP Library Reference；
18. 建立 Source Asset Inventory；
19. 建立 Library Table Inventory；
20. 建立 Environment Variable Snapshot；
21. 展开 `${KIPRJMOD}`；
22. 展开批准的 KiCad Path Variables；
23. 检测未定义变量；
24. 检测变量循环；
25. 检测绝对路径；
26. 检测用户主目录路径；
27. 检测网络路径；
28. 检测路径越界；
29. 检测大小写差异；
30. 检测 Windows/macOS/Linux 路径兼容性；
31. 检测 Symlink；
32. 检测 Broken Symlink；
33. 检测同一 Nickname 在多张表重复；
34. 检测 Project Table 与 Global Table Shadow；
35. 检测 Nested Table 循环；
36. 检测 Nested Table 重复包含；
37. 检测库表条目缺失；
38. 检测 URI 不存在；
39. 检测 Provider 不可用；
40. 检测库文件损坏；
41. 检测格式版本不支持；
42. 检测符号库名称冲突；
43. 检测封装库名称冲突；
44. 检测同名对象不同 Hash；
45. 检测同 Hash 不同路径；
46. 检测同 Nickname 不同内容；
47. 检测相同对象跨版本变化；
48. 建立 Binary Hash；
49. 建立 Normalized Hash；
50. 建立 Semantic Fingerprint；
51. 保存 Generator 和 Format Version；
52. 保存外部 Release Version；
53. 保存 Git Commit/Tag；
54. 保存 Package Version；
55. 保存来源和许可证；
56. 识别工程中嵌入的 Symbol Snapshot；
57. 识别 PCB 中的 Footprint Instance Snapshot；
58. 解析外部 Symbol Definition；
59. 解析外部 Footprint Definition；
60. 比较实例与外部库；
61. 检测符号图形变化；
62. 检测 Pin Set 变化；
63. 检测 Pin Number 变化；
64. 检测 Pin Name 变化；
65. 检测 Electrical Type 变化；
66. 检测 Unit 数变化；
67. 检测 DeMorgan/Alternate 变化；
68. 检测默认属性变化；
69. 检测 Footprint Pad Set 变化；
70. 检测 Pad Number 变化；
71. 检测 Pad Type 变化；
72. 检测 Pad Shape/Size/Position 变化；
73. 检测 Courtyard/Outline 变化；
74. 检测 3D Model Reference 变化；
75. 检测 Symbol 已嵌入但源库缺失；
76. 检测 Footprint 已嵌入但源库缺失；
77. 检测嵌入快照比库新；
78. 检测嵌入快照比库旧；
79. 检测本地修改；
80. 检测缓存污染；
81. 检测跨工程缓存复用；
82. 检测 Legacy Cache 与当前库冲突；
83. 检测 Rescue Library 遗留；
84. 检测 Library Nickname 重绑定；
85. 检测 Library Path Drift；
86. 检测 Global Library Update Drift；
87. 检测 HTTP/Remote Library Drift；
88. 建立 Part-to-Symbol Dependency；
89. 建立 Part-to-Footprint Dependency；
90. 建立 Footprint-to-3D Dependency；
91. 建立 Project-to-Table Dependency；
92. 建立 Table-to-Table Dependency；
93. 建立 Variable-to-Path Dependency；
94. 建立 Symbol Instance-to-Embedded Definition；
95. 建立 Symbol Instance-to-Resolved Library Definition；
96. 建立 Footprint Instance-to-Resolved Library Definition；
97. 建立 Pin-to-Pad Mapping；
98. 比较 Symbol Pin Number Set；
99. 比较 Footprint Pad Number Set；
100. 保留原始字符串；
101. 支持数字和字母数字 Pin/Pad；
102. 支持空 Pad Number；
103. 支持 Mechanical/NPTH Pad；
104. 支持多个 Pad 共用同号；
105. 支持 Stacked Pin；
106. 支持同号 Power Pin；
107. 支持 Exposed Pad；
108. 支持 Thermal Pad；
109. 支持 Castellated Pad；
110. 支持 Connector Shell/Shield Pad；
111. 支持 Test/Mechanical Pad；
112. 识别 Symbol Pin 无 Pad；
113. 识别 Pad 无 Symbol Pin；
114. 识别 Duplicate Symbol Pin Number；
115. 识别 Duplicate Footprint Pad Number；
116. 区分合法和非法重复；
117. 识别 Pin/Pad Number Swap；
118. 识别前导零差异；
119. 识别大小写差异；
120. 识别空白和隐藏字符；
121. 识别 Unicode 相似字符；
122. 识别 Pin-Pad Mapping Ambiguous；
123. 识别 Footprint Field 指向不存在对象；
124. 识别不同 Variant 使用不同 Footprint；
125. 识别 DNP 对校验 Scope 的影响；
126. 识别 Multi-unit Symbol；
127. 识别 Hidden Power Pin；
128. 识别 Alias/Derived Symbol；
129. 识别 Derived Footprint；
130. 识别多个 Part 共用一个 Library Definition；
131. 生成 Dependency Graph；
132. 生成问题严重度；
133. 生成问题影响范围；
134. 生成自动修复资格；
135. 生成 Repair Candidate；
136. 生成 Repair Plan；
137. 生成项目本地 Recovery Symbol Library；
138. 生成项目本地 Recovery Footprint Library；
139. 生成项目本地 3D Model 目录；
140. 生成 `sym-lib-table` Patch；
141. 生成 `fp-lib-table` Patch；
142. 生成 Path Variable Patch；
143. 生成 Library Nickname Rebind Patch；
144. 生成 Symbol Library ID Patch；
145. 生成 Footprint Property Patch；
146. 生成 3D Model Path Patch；
147. 生成 Pin Number Patch；
148. 生成 Pad Number Patch；
149. 生成 Duplicate Group Annotation Patch；
150. 生成 Lockfile；
151. 生成 Manifest；
152. 生成 Repair Package；
153. 支持 `report_only`；
154. 支持 `patch_only`；
155. 支持 `auto_fix_low_risk`；
156. 支持 `plan_and_execute_via_agent19`；
157. 支持 Preview；
158. 支持人工审批；
159. 支持执行后重新解析；
160. 支持 Semantic Diff；
161. 支持 ERC/DRC；
162. 支持 Pin-to-Net 不变验证；
163. 支持 PCB Routing 不变验证；
164. 支持 Footprint Placement 不变验证；
165. 支持 3D Model 可加载验证；
166. 支持回滚；
167. 支持 Git Review；
168. 支持 CI Gate；
169. 支持多租户；
170. 支持增量扫描；
171. 支持 Dependency Cache；
172. 支持 Library Registry；
173. 支持企业批准库；
174. 支持本地离线运行；
175. 不将文件格式版本误当发布版本；
176. 不把相同数量 Pin/Pad 当作映射正确；
177. 不自动删除重复编号；
178. 不自动重编号会改变电气关系的 Pin/Pad；
179. 不自动同步实例到新库；
180. 不自动替换 Pad Set 不同的 Footprint；
181. 不自动覆盖本地修改；
182. 不自动修改全局库表；
183. 不自动下载远程库；
184. 不自动写入用户主目录；
185. 不在源依赖不明确时生成“已修复”状态；
186. 不因工程能打开就判定依赖完整；
187. 不因 ERC/DRC 通过就判定库版本一致；
188. 不伪造库版本、来源、Hash 或许可证；
189. 不修改原始工程快照；
190. 不绕过 Agent 19 的执行和回读 Gate。

---

# 4. 核心架构

```text
Project / Agent 16 IR
        ↓
Safe Inventory & Snapshot
        ↓
Library Table + Variable Resolver
        ↓
Dependency Graph Builder
        ↓
Symbol / Footprint / 3D Resolver
        ↓
Instance-vs-Library Comparator
        ↓
Pin-Pad Mapping Validator
        ↓
Conflict / Drift / Cache Analysis
        ↓
Issue Classification & Impact
        ↓
Repair Candidate Generator
        ↓
Repair Plan + Lockfile + Patch Package
        ↓
Agent 19 Preview / Execute
        ↓
Agent 16 Reparse + Diff + ERC/DRC
```

---

# 5. 四层依赖模型

## 5.1 Declared Dependency

工程声明的依赖：

```text
Library Nickname
Library URI
Library Table
Path Variable
Symbol Library ID
Footprint Field
3D Model Path
```

## 5.2 Resolved Dependency

在某个解析上下文中实际解析到：

```text
真实路径或 Provider
文件 Hash
对象 Hash
格式版本
外部发布版本
```

## 5.3 Embedded / Instance Snapshot

工程文档中实际携带：

```text
Schematic Embedded Symbol Definition
PCB Footprint Instance
Resolved 3D Placement Reference
```

## 5.4 Approved Source

企业认可的：

```text
Library Registry Entry
Git Tag/Commit
Package Version
Artifact Hash
License
Approval
```

四层必须分别保存，不能简单用“当前文件路径”代表全部事实。

---

# 6. Dependency Graph

节点：

```text
project
document
library_table
nested_library_table
path_variable
library_provider
symbol_library
footprint_library
symbol_definition
footprint_definition
3d_model
symbol_instance
footprint_instance
part_instance
pin_definition
pad_definition
library_release
artifact
```

边：

```text
declares
includes_table
uses_variable
resolves_to
contains
references
embeds_snapshot
instantiates
assigned_footprint
uses_3d_model
derived_from
aliases
shadows
conflicts_with
maps_pin_to_pad
approved_as
```

---

# 7. Dependency Resolution Context

```json
{
  "project_id": "uuid",
  "project_revision": "git-sha",
  "kicad_major": 10,
  "platform": "linux",
  "project_root": "workspace-ref",
  "project_tables": {},
  "global_table_snapshot": {},
  "nested_tables": [],
  "path_variables": {},
  "offline": true,
  "approved_provider_policy": "enterprise-v1"
}
```

---

# 8. Resolution 结果

```text
resolved_exact
resolved_project_local
resolved_global
resolved_nested
resolved_remote_cached
embedded_only
instance_only
unresolved
ambiguous
conflicting
blocked_by_policy
```

---

# 9. Library ID

KiCad 对象常使用：

```text
Nickname:ObjectName
```

例如：

```text
Device:R
Capacitor_SMD:C_0603_1608Metric
```

必须分开保存：

```text
raw library id
nickname
object name
resolved table entry
resolved provider
resolved object
```

---

# 10. Nickname 冲突

类型：

```text
project_global_shadow
nested_table_duplicate
same_nickname_different_uri
same_nickname_different_hash
case_only_collision
platform_specific_collision
provider_type_conflict
```

---

# 11. 路径问题

```text
undefined_variable
variable_cycle
absolute_path
user_home_path
drive_letter_dependency
case_mismatch
path_not_found
path_outside_workspace
broken_symlink
network_path
forbidden_remote
```

---

# 12. Library Manifest

`eda-libs.manifest.json` 保存当前发现的全部依赖：

```json
{
  "manifest_version": "1.0.0",
  "project_revision": "sha",
  "resolution_context_hash": "sha256",
  "libraries": [],
  "objects": [],
  "variables": {},
  "unresolved": [],
  "generated_at": "ISO-8601"
}
```

---

# 13. Library Lockfile

`eda-libs.lock.json` 用于可重放：

```json
{
  "lock_version": "1.0.0",
  "project_revision": "sha",
  "kicad_major": 10,
  "dependencies": [
    {
      "kind": "symbol_library",
      "nickname": "ProjectSymbols",
      "source": "${KIPRJMOD}/lib/symbols.kicad_sym",
      "artifact_hash": "sha256",
      "semantic_hash": "sha256",
      "external_version": "git-tag-or-null",
      "format_version": "YYYYMMDD",
      "license": "internal",
      "approval_status": "approved"
    }
  ]
}
```

注意：

```text
format_version
≠
external_version
```

---

# 14. Fingerprint 分层

## Binary Hash

字节完全一致。

## Normalized Hash

忽略：

```text
非语义空白
排序差异
可忽略生成器元数据
```

具体规则按格式版本化。

## Semantic Fingerprint

只包含影响设计语义的字段。

---

# 15. Symbol Semantic Fingerprint

包含：

```text
symbol name
extends/alias
unit count
alternate representation
pin number/name/type/unit/position/orientation/length/hidden
default properties
graphic primitives relevant to pin anchors
power symbol flags
```

可分成：

```text
pin_semantic_hash
graphic_semantic_hash
property_semantic_hash
full_semantic_hash
```

---

# 16. Footprint Semantic Fingerprint

包含：

```text
footprint name
attributes
pad number/type/shape/position/size/rotation/layers/drill
courtyard
fabrication outline
anchor
3D references
```

可分成：

```text
padset_hash
geometry_hash
courtyard_hash
3d_hash
full_semantic_hash
```

---

# 17. Instance-vs-Library 状态

```text
exact_match
semantic_match_binary_different
graphics_drift_only
property_drift_only
pinset_drift
padset_drift
local_instance_modified
library_newer_unknown
embedded_only
library_only
ambiguous_source
conflicting
```

---

# 18. 缓存污染定义

缓存污染不是单一错误，而是一组可复现性风险：

```text
stale_embedded_symbol
stale_board_footprint
legacy_cache_shadow
rescue_library_orphan
cross_project_cache_reuse
nickname_rebound
global_library_update_drift
generated_asset_version_drift
remote_provider_drift
incorrect_cached_source_map
```

---

# 19. Source of Truth Policy

可配置：

```text
instance_as_designed
approved_library_release
project_local_vendored
latest_compatible_library
manual_selection
```

默认生产冻结工程建议：

```text
instance_as_designed
+
project_local_vendored
```

不能默认“同步到当前最新版”。

---

# 20. Symbol 缺失状态

```text
library_table_missing
library_file_missing
symbol_name_missing
embedded_snapshot_available
legacy_cache_available
approved_registry_match_available
no_recovery_source
```

---

# 21. Footprint 缺失状态

```text
footprint_field_empty
library_table_missing
library_directory_missing
footprint_file_missing
board_instance_available
approved_registry_match_available
no_recovery_source
```

---

# 22. 3D Model 缺失状态

```text
path_variable_missing
model_file_missing
unsupported_format
hash_mismatch
license_blocked
remote_fetch_blocked
instance_transform_invalid
```

---

# 23. Pin-Pad 映射基础

默认映射键：

```text
Symbol Pin Number
↔
Footprint Pad Number
```

比较时：

```text
保留 Raw String
默认字符串精确匹配
可选生成规范化候选
```

不能在未配置时把：

```text
01
1
A1
a1
```

强制视为相同。

---

# 24. Pin Set

每个 Symbol Definition 保存：

```text
pin number
pin name
electrical type
unit
alternate
hidden
stacked/equivalent group
source
```

---

# 25. Pad Set

每个 Footprint Definition 保存：

```text
pad number
pad type
electrical/mechanical classification
layers
drill
position
shared-number group
source
```

---

# 26. Pad 分类

```text
electrical_smd
electrical_through_hole
electrical_connector
npth_mechanical
mechanical_numbered
aperture_only
thermal_or_exposed
shield
test
unknown
```

只有适用的 Electrical Pad 进入主 Pin-Pad 完整性比较。

---

# 27. Pin-Pad Mapping 状态

```text
one_to_one
one_pin_to_multiple_same_number_pads
multiple_equivalent_pins_to_one_pad_number
stacked_pin_group
mechanical_pad_excluded
explicit_mapping
complete_with_exceptions
incomplete
ambiguous
conflicting
```

---

# 28. Pin-Pad 问题类型

```text
symbol_pin_without_pad
footprint_pad_without_pin
duplicate_pin_number
duplicate_pad_number
duplicate_number_ambiguous
pin_number_normalization_candidate
pin_pad_swap_candidate
hidden_pin_without_pad
electrical_pad_unmapped
mechanical_pad_misclassified
padset_changed
pinset_changed
footprint_assignment_missing
footprint_assignment_conflicting
variant_footprint_conflict
```

---

# 29. 合法重复 Pin Number

可能合法：

```text
Stacked Pins
多个等效电源 Pin
Derived Symbol 的重叠 Pin
显式 Equivalent Pin Group
```

自动判为合法至少需要：

```text
相同 Number
显式堆叠或等效证据
相同或兼容 Electrical Type
相同 Net 预期
源库规则允许
```

否则：

```text
duplicate_number_ambiguous
```

---

# 30. 合法重复 Pad Number

常见合法情况：

```text
一个电气引脚对应多个物理焊盘
Thermal/Exposed Pad 分区
连接器外壳或固定焊脚共用编号
Castellated/双侧接触
一个 Pad 由多个 Primitive 组成
```

必须区分：

```text
多个独立 Pad Object 同号
一个 Custom Pad 的多个 Primitive
```

后者不是重复 Pad。

---

# 31. 重复编号不得自动删除

任何 Duplicate 处理前必须回答：

```text
这些对象是否电气等效
是否应连接到同一 Net
是否有源数据或库规则支持
修复会否改变 PCB Connectivity
```

---

# 32. Hidden Pin

Hidden Pin 状态：

```text
defined_and_mapped
defined_unmapped
not_present_in_instance
library_candidate_only
unknown
```

如果 Symbol 身份不确定，不能从其他同名器件库中补 Hidden Pin。

---

# 33. Multi-unit Symbol

Pin 校验 Scope 必须包含：

```text
Logical Part
Unit
Alternate Representation
Instance Path
```

不能只校验当前页面显示的 Unit。

---

# 34. Alternate / DeMorgan

相同 Symbol 的 Alternate Representation 可能共享 Pin Number，但图形不同。

比较时：

```text
Pin Set 主要按逻辑定义
Graphic Fingerprint 按 Representation 分开
```

---

# 35. Alias / Derived Symbol

保存：

```text
base symbol
derived symbol
overridden properties
inherited pins
local modifications
```

如果 Base 缺失但 Derived Cache 存在，修复时可 Vendor 完整展开版本，但必须标记：

```text
materialized_derived_symbol
```

---

# 36. Variant Scope

同一个 RefDes 在不同 Variant 可能：

```text
DNP
使用 Alternative Part
使用不同 Footprint
```

Pin-Pad 校验必须按 Variant 分别执行。

---

# 37. Issue 严重度

## Information

```text
binary hash differs, semantic hash equal
absolute path but currently resolves
unused legacy cache
```

## Warning

```text
3D model missing
graphics-only drift
global library dependency
unlocked remote dependency
```

## Error

```text
symbol/footprint missing
pin without pad
electrical pad without pin
ambiguous duplicate
nickname collision
```

## Critical

```text
same Pin mapped to conflicting Pad Sets
footprint replacement changed connectivity
library rebind points to different Pin Set
cache pollution changes Pin Number
repair would merge/split nets
```

---

# 38. 影响范围

```text
project
document
sheet instance
part/refdes
variant
symbol definition
footprint definition
pin
pad
net
PCB routing
manufacturing artifact
```

Agent 42/43 可进一步计算生产和库存影响，但 Agent 20 至少要给出设计范围。

---

# 39. 自动修复等级

```text
safe_auto
safe_with_preview
review_required
high_risk_manual
not_repairable
```

---

# 40. Safe Auto 修复候选

仅在明确且可回滚时：

```text
将已有项目本地库加入工程库表
把绝对工程内路径改为 ${KIPRJMOD}
修复唯一、Hash 完全匹配的 Nickname 路径
从工程 Embedded Snapshot 生成只读 Recovery Library
从 PCB Instance 生成只读 Recovery Footprint
修复已知 Hash 的项目内 3D 相对路径
生成 Lockfile 和 Manifest
删除未使用且确认无引用的库表重复项，可配置为 Patch-only
```

即使是 Safe Auto，也必须通过 Agent 19 工作区执行。

---

# 41. 必须审核的修复

```text
Symbol Library ID 重绑定
Footprint Field 替换
同步实例到当前库
用库定义覆盖本地实例
Pin Number 重编号
Pad Number 重编号
Duplicate Group 合并或拆分
Footprint Pad Set 改变
Power Pin 补全
Variant Footprint 变更
远程库版本升级
```

---

# 42. 禁止自动修复

```text
缺少唯一恢复来源
多个候选库内容不同
修复可能改变 Pin-to-Net
修复可能改变 PCB Net Assignment
Footprint Padset 不兼容
网络或 Power Domain 可能合并
无法确认重复编号语义
许可证不允许复制
来源 Hash 不可信
```

---

# 43. Recovery Library

默认创建：

```text
${KIPRJMOD}/lib/recovered-symbols.kicad_sym
${KIPRJMOD}/lib/recovered-footprints.pretty/
${KIPRJMOD}/lib/3d/
```

KiCad 10 可选使用：

```text
${KIPRJMOD}/lib/recovered-symbols.kicad_symdir/
```

但需要按目标 KiCad 版本和团队协作策略选择。

---

# 44. Recovery Asset 元数据

```text
recovered from
source project revision
source document
embedded object id
original library id
binary hash
semantic hash
recovery tool/version
license status
review status
```

---

# 45. Repair Candidate

```json
{
  "repair_candidate_id": "uuid",
  "issue_id": "uuid",
  "repair_type": "vendor_embedded_symbol",
  "risk_level": "low",
  "source_asset": {
    "kind": "embedded_symbol",
    "hash": "sha256"
  },
  "target": {
    "path": "${KIPRJMOD}/lib/recovered-symbols.kicad_sym",
    "library_nickname": "RecoveredSymbols"
  },
  "preconditions": [],
  "postconditions": [],
  "auto_fix_eligible": true
}
```

---

# 46. Repair Plan

```text
base project revision
resolution context
selected source of truth
issues addressed
assets to create
table patches
reference patches
pin/pad patches
execution order
risk
approval
postconditions
rollback
```

---

# 47. Repair Package

```text
repair-package/
├── manifest.json
├── issues.json
├── repair-plan.json
├── agent19-change-plan.json
├── patches/
├── recovered-libs/
├── lock/
│   ├── eda-libs.manifest.json
│   └── eda-libs.lock.json
├── validation/
└── reports/
```

---

# 48. Repair Patch DSL

操作：

```text
add_library_table_entry
update_library_table_entry
remove_library_table_entry
add_nested_table
set_path_variable_reference
vendor_symbol_definition
vendor_footprint_definition
vendor_3d_model
rebind_symbol_library_id
set_footprint_field
set_3d_model_path
renumber_symbol_pin
renumber_footprint_pad
declare_equivalent_pin_group
declare_shared_pad_group
set_variant_footprint
```

---

# 49. Patch 前置条件

例如：

```text
project revision matches
table hash matches
library nickname absent
source asset hash matches
symbol semantic hash matches
footprint padset hash matches
target RefDes unique
Pin-to-Net baseline hash matches
PCB routing baseline hash matches
```

---

# 50. Patch 后置条件

```text
all required libraries resolve
no nickname ambiguity
symbol definition resolves
footprint definition resolves
3D model resolves
Pin-Pad status expected
Pin-to-Net unchanged
PCB net assignments unchanged
placement unchanged
routing unchanged
Agent 16 reparse passes
ERC/DRC no regression
lockfile matches
```

---

# 51. Source-aware 修改

所有 Patch 使用：

```text
Agent 16 Source Map
Native UUID/KIID
Library ID
Object Semantic Hash
```

禁止用：

```text
正则替换完整文件
按行号盲改
仅按名称修改多个对象
```

---

# 52. Repair 执行闭环

```text
Generate Plan
→ Agent 19 Workspace
→ Preview
→ Approval
→ Execute
→ Agent 16 Reparse
→ Re-run Agent 20
→ Compare Issue Closure
→ ERC/DRC
→ Commit or Rollback
```

---

# 53. 成功定义

修复成功必须满足：

```text
目标问题关闭
没有新增 Critical/Error
预期依赖可解析
Pin-Pad 后置条件通过
Pin-to-Net 未发生未批准变化
PCB Routing 未发生未批准变化
Lockfile 可重放
工程重新打开和解析成功
```

---

# 54. 扫描请求

```json
{
  "scan_job_id": "uuid",
  "project_id": "uuid",
  "project_revision": "sha",
  "agent16_ir_bundle_id": "uuid",
  "target_kicad_versions": [9, 10],
  "modes": [
    "dependency",
    "instance_drift",
    "pin_pad"
  ],
  "repair_mode": "patch_only",
  "offline": true
}
```

---

# 55. 扫描结果

```json
{
  "scan_job_id": "uuid",
  "status": "completed_with_findings",
  "summary": {
    "symbol_libraries": 18,
    "footprint_libraries": 12,
    "symbol_instances": 426,
    "footprint_instances": 421,
    "missing_symbols": 2,
    "missing_footprints": 1,
    "nickname_conflicts": 1,
    "pin_pad_errors": 3,
    "warnings": 17
  },
  "repair_candidates": {
    "safe_auto": 2,
    "review_required": 4,
    "not_repairable": 1
  },
  "outputs": {
    "dependency_graph_uri": "s3://...",
    "manifest_uri": "s3://...",
    "lockfile_uri": "s3://...",
    "report_uri": "s3://..."
  }
}
```

---

# 56. 扫描状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ INVENTORYING_PROJECT
→ SNAPSHOTTING_RESOLUTION_CONTEXT
→ PARSING_LIBRARY_TABLES
→ RESOLVING_PATH_VARIABLES
→ BUILDING_DEPENDENCY_GRAPH
→ RESOLVING_LIBRARIES
→ FINGERPRINTING_ASSETS
→ COMPARING_INSTANCES
→ VALIDATING_PIN_PAD
→ DETECTING_CONFLICTS
→ CLASSIFYING_ISSUES
→ GENERATING_REPAIR_CANDIDATES
→ GENERATING_LOCKFILE
→ GENERATING_REPORT
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_FINDINGS
REPAIR_PLAN_READY
REVIEW_REQUIRED
PARTIAL
INPUT_INVALID
DEPENDENCY_CONTEXT_INCOMPLETE
LIBRARY_TABLE_INVALID
LIBRARY_UNRESOLVED
PIN_PAD_BLOCKED
LICENSE_BLOCKED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 57. 错误码

```text
PROJECT_NOT_FOUND
PROJECT_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT16_IR_VERSION_UNSUPPORTED
PROJECT_INVENTORY_FAILED
LIBRARY_TABLE_PARSE_FAILED
NESTED_TABLE_CYCLE
LIBRARY_NICKNAME_DUPLICATE
LIBRARY_NICKNAME_CONFLICT
PATH_VARIABLE_UNDEFINED
PATH_VARIABLE_CYCLE
PATH_OUTSIDE_ALLOWED_ROOT
LIBRARY_PATH_NOT_FOUND
LIBRARY_PROVIDER_DISABLED
REMOTE_FETCH_BLOCKED
LIBRARY_FORMAT_UNSUPPORTED
LIBRARY_FILE_CORRUPTED
SYMBOL_LIBRARY_NOT_FOUND
SYMBOL_DEFINITION_NOT_FOUND
FOOTPRINT_LIBRARY_NOT_FOUND
FOOTPRINT_DEFINITION_NOT_FOUND
MODEL_3D_NOT_FOUND
INSTANCE_SOURCE_AMBIGUOUS
EMBEDDED_LIBRARY_DRIFT
FOOTPRINT_INSTANCE_DRIFT
LEGACY_CACHE_CONFLICT
RESCUE_LIBRARY_CONFLICT
LIBRARY_VERSION_CONFLICT
LICENSE_UNKNOWN
LICENSE_COPY_BLOCKED
SYMBOL_PIN_DUPLICATE
FOOTPRINT_PAD_DUPLICATE
DUPLICATE_NUMBER_AMBIGUOUS
SYMBOL_PIN_WITHOUT_PAD
FOOTPRINT_PAD_WITHOUT_PIN
PIN_PAD_MAPPING_CONFLICT
PINSET_DRIFT
PADSET_DRIFT
VARIANT_FOOTPRINT_CONFLICT
REPAIR_SOURCE_NOT_UNIQUE
REPAIR_PRECONDITION_FAILED
REPAIR_POSTCONDITION_FAILED
PIN_TO_NET_CHANGED
PCB_ROUTING_CHANGED
AGENT19_EXECUTION_FAILED
AGENT16_REPARSE_FAILED
ERC_REGRESSION
DRC_REGRESSION
LOCKFILE_VALIDATION_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 58. 数据库设计

## 58.1 `eda_library_scan_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
project_revision VARCHAR NOT NULL
agent16_ir_bundle_id UUID NOT NULL
target_kicad_versions JSONB NOT NULL
scan_modes JSONB NOT NULL
repair_mode VARCHAR NOT NULL
offline BOOLEAN NOT NULL
resolution_policy_version VARCHAR NOT NULL
validation_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
current_step VARCHAR NULL
idempotency_key VARCHAR NULL
input_snapshot_hash CHAR(64) NOT NULL
result_summary JSONB NULL
error_code VARCHAR NULL
error_message TEXT NULL
requested_by UUID NOT NULL
created_at TIMESTAMPTZ
started_at TIMESTAMPTZ NULL
completed_at TIMESTAMPTZ NULL
UNIQUE(idempotency_key)
```

## 58.2 `eda_dependency_resolution_contexts`

```text
id UUID PK
scan_job_id UUID NOT NULL
project_root_reference TEXT NOT NULL
platform VARCHAR NOT NULL
kicad_major INT NOT NULL
kicad_version VARCHAR NULL
project_table_hashes JSONB NOT NULL
global_table_snapshot_uri TEXT NULL
global_table_snapshot_hash CHAR(64) NULL
nested_table_hashes JSONB NOT NULL
path_variable_snapshot JSONB NOT NULL
provider_snapshot JSONB NOT NULL
workspace_policy JSONB NOT NULL
context_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, context_hash)
```

## 58.3 `eda_library_tables`

```text
id UUID PK
scan_job_id UUID NOT NULL
context_id UUID NOT NULL
table_type VARCHAR NOT NULL
table_scope VARCHAR NOT NULL
source_asset_id UUID NULL
table_path_reference TEXT NOT NULL
format_version VARCHAR NULL
parent_table_id UUID NULL
table_hash CHAR(64) NOT NULL
parse_status VARCHAR NOT NULL
entry_count INT NOT NULL
created_at TIMESTAMPTZ
```

`table_type`：

```text
symbol
footprint
design_block
legacy
provider
```

`table_scope`：

```text
project
global_snapshot
nested
enterprise
```

## 58.4 `eda_library_table_entries`

```text
id UUID PK
library_table_id UUID NOT NULL
nickname_raw VARCHAR NOT NULL
nickname_normalized VARCHAR NOT NULL
provider_type VARCHAR NOT NULL
uri_raw TEXT NOT NULL
uri_resolved TEXT NULL
options_raw TEXT NULL
description TEXT NULL
enabled BOOLEAN NOT NULL
resolution_status VARCHAR NOT NULL
resolved_library_id UUID NULL
shadowed_by_entry_id UUID NULL
source_span JSONB NULL
created_at TIMESTAMPTZ
```

## 58.5 `eda_path_variable_snapshots`

```text
id UUID PK
context_id UUID NOT NULL
variable_name VARCHAR NOT NULL
raw_value TEXT NULL
resolved_value TEXT NULL
source_scope VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
depends_on JSONB NOT NULL
security_classification VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(context_id, variable_name, source_scope)
```

## 58.6 `eda_library_providers`

```text
id UUID PK
tenant_id UUID NULL
provider_name VARCHAR NOT NULL
provider_type VARCHAR NOT NULL
provider_version VARCHAR NULL
configuration_reference JSONB NOT NULL
network_required BOOLEAN NOT NULL
trust_status VARCHAR NOT NULL
license_policy JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(provider_name, provider_type, provider_version)
```

## 58.7 `eda_resolved_libraries`

```text
id UUID PK
scan_job_id UUID NOT NULL
library_kind VARCHAR NOT NULL
nickname VARCHAR NOT NULL
provider_id UUID NULL
resolved_uri_reference TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
normalized_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
format_version VARCHAR NULL
external_version VARCHAR NULL
git_commit VARCHAR NULL
package_version VARCHAR NULL
generator VARCHAR NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
resolution_source VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.8 `eda_library_releases`

```text
id UUID PK
tenant_id UUID NULL
registry_name VARCHAR NOT NULL
library_kind VARCHAR NOT NULL
library_name VARCHAR NOT NULL
release_version VARCHAR NOT NULL
artifact_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
source_reference JSONB NOT NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
valid_from TIMESTAMPTZ NULL
valid_to TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(registry_name, library_kind, library_name, release_version)
```

## 58.9 `eda_library_objects`

```text
id UUID PK
scan_job_id UUID NOT NULL
resolved_library_id UUID NULL
library_object_kind VARCHAR NOT NULL
library_object_name VARCHAR NOT NULL
library_identifier VARCHAR NULL
source_asset_id UUID NULL
native_object_id VARCHAR NULL
binary_hash CHAR(64) NOT NULL
normalized_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
pin_or_padset_hash CHAR(64) NULL
graphics_or_geometry_hash CHAR(64) NULL
property_hash CHAR(64) NULL
format_version VARCHAR NULL
generator VARCHAR NULL
source_map JSONB NOT NULL
parse_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.10 `eda_symbol_definitions_inventory`

```text
id UUID PK
library_object_id UUID NOT NULL
symbol_name VARCHAR NOT NULL
base_symbol_name VARCHAR NULL
derived_status VARCHAR NOT NULL
unit_count INT NOT NULL
alternate_count INT NOT NULL
pin_count INT NOT NULL
power_symbol BOOLEAN NOT NULL
properties JSONB NOT NULL
semantic_summary JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 58.11 `eda_symbol_pins_inventory`

```text
id UUID PK
symbol_definition_id UUID NOT NULL
pin_key VARCHAR NOT NULL
pin_number_raw VARCHAR NOT NULL
pin_number_normalized VARCHAR NULL
pin_name_raw VARCHAR NULL
electrical_type VARCHAR NULL
unit_number INT NOT NULL
alternate_representation VARCHAR NULL
hidden BOOLEAN NOT NULL
stacked_group_key VARCHAR NULL
equivalent_group_key VARCHAR NULL
position JSONB NULL
orientation NUMERIC NULL
source_map JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 58.12 `eda_footprint_definitions_inventory`

```text
id UUID PK
library_object_id UUID NOT NULL
footprint_name VARCHAR NOT NULL
pad_count INT NOT NULL
electrical_pad_count INT NOT NULL
mechanical_pad_count INT NOT NULL
attributes JSONB NOT NULL
courtyard_status VARCHAR NOT NULL
model_3d_count INT NOT NULL
semantic_summary JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 58.13 `eda_footprint_pads_inventory`

```text
id UUID PK
footprint_definition_id UUID NOT NULL
pad_key VARCHAR NOT NULL
pad_number_raw VARCHAR NULL
pad_number_normalized VARCHAR NULL
pad_type VARCHAR NOT NULL
electrical_classification VARCHAR NOT NULL
shape VARCHAR NOT NULL
position JSONB NOT NULL
size JSONB NOT NULL
rotation NUMERIC NOT NULL
layer_set JSONB NOT NULL
drill JSONB NULL
shared_number_group_key VARCHAR NULL
custom_primitive_count INT NOT NULL
source_map JSONB NOT NULL
created_at TIMESTAMPTZ
```

## 58.14 `eda_3d_models_inventory`

```text
id UUID PK
scan_job_id UUID NOT NULL
source_footprint_object_id UUID NULL
raw_path TEXT NOT NULL
resolved_path_reference TEXT NULL
path_variable_names JSONB NOT NULL
model_format VARCHAR NULL
artifact_hash CHAR(64) NULL
size_bytes BIGINT NULL
transform JSONB NOT NULL
resolution_status VARCHAR NOT NULL
license_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.15 `eda_design_instances_inventory`

```text
id UUID PK
scan_job_id UUID NOT NULL
instance_kind VARCHAR NOT NULL
agent16_entity_id UUID NOT NULL
document_id UUID NOT NULL
sheet_instance_id UUID NULL
reference_designator VARCHAR NULL
variant_id UUID NULL
declared_library_identifier VARCHAR NULL
declared_footprint_identifier VARCHAR NULL
embedded_snapshot_object_id UUID NULL
resolved_library_object_id UUID NULL
instance_semantic_hash CHAR(64) NOT NULL
source_map JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.16 `eda_instance_library_comparisons`

```text
id UUID PK
scan_job_id UUID NOT NULL
design_instance_id UUID NOT NULL
embedded_object_id UUID NULL
resolved_library_object_id UUID NULL
comparison_type VARCHAR NOT NULL
comparison_status VARCHAR NOT NULL
binary_equal BOOLEAN NULL
semantic_equal BOOLEAN NULL
pin_or_padset_equal BOOLEAN NULL
graphics_or_geometry_equal BOOLEAN NULL
properties_equal BOOLEAN NULL
difference_summary JSONB NOT NULL
diff_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 58.17 `eda_dependency_graph_nodes`

```text
id UUID PK
scan_job_id UUID NOT NULL
node_kind VARCHAR NOT NULL
entity_reference JSONB NOT NULL
stable_key VARCHAR NOT NULL
attributes JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, stable_key)
```

## 58.18 `eda_dependency_graph_edges`

```text
id UUID PK
scan_job_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
edge_kind VARCHAR NOT NULL
resolution_status VARCHAR NOT NULL
evidence JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, source_node_id, target_node_id, edge_kind)
```

## 58.19 `eda_pin_pad_validation_runs`

```text
id UUID PK
scan_job_id UUID NOT NULL
part_instance_id UUID NOT NULL
symbol_definition_id UUID NOT NULL
footprint_definition_id UUID NOT NULL
variant_id UUID NULL
normalization_policy_version VARCHAR NOT NULL
exception_policy_version VARCHAR NOT NULL
status VARCHAR NOT NULL
symbol_pin_count INT NOT NULL
electrical_pad_count INT NOT NULL
mapped_pin_count INT NOT NULL
mapped_pad_count INT NOT NULL
issue_count INT NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
created_at TIMESTAMPTZ
```

## 58.20 `eda_pin_pad_mappings`

```text
id UUID PK
validation_run_id UUID NOT NULL
mapping_key VARCHAR NOT NULL
mapping_status VARCHAR NOT NULL
pin_ids JSONB NOT NULL
pad_ids JSONB NOT NULL
pin_number_raw VARCHAR NULL
pad_number_raw VARCHAR NULL
normalization_applied JSONB NOT NULL
resolution_method VARCHAR NOT NULL
exception_type VARCHAR NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.21 `eda_library_issues`

```text
id UUID PK
scan_job_id UUID NOT NULL
issue_code VARCHAR NOT NULL
category VARCHAR NOT NULL
severity VARCHAR NOT NULL
scope_type VARCHAR NOT NULL
scope_reference JSONB NOT NULL
affected_graph_node_ids JSONB NOT NULL
description TEXT NOT NULL
evidence JSONB NOT NULL
blocking BOOLEAN NOT NULL
auto_fix_class VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
resolved_at TIMESTAMPTZ NULL
```

## 58.22 `eda_issue_impact_snapshots`

```text
id UUID PK
issue_id UUID NOT NULL
affected_projects JSONB NOT NULL
affected_documents JSONB NOT NULL
affected_parts JSONB NOT NULL
affected_variants JSONB NOT NULL
affected_pins JSONB NOT NULL
affected_pads JSONB NOT NULL
affected_nets JSONB NOT NULL
affected_routing JSONB NOT NULL
manufacturing_risk JSONB NOT NULL
impact_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
```

## 58.23 `eda_repair_candidates`

```text
id UUID PK
scan_job_id UUID NOT NULL
issue_id UUID NOT NULL
repair_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
target_reference JSONB NOT NULL
risk_level VARCHAR NOT NULL
auto_fix_eligible BOOLEAN NOT NULL
preconditions JSONB NOT NULL
postconditions JSONB NOT NULL
required_approvals JSONB NOT NULL
license_status VARCHAR NOT NULL
candidate_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.24 `eda_repair_plans`

```text
id UUID PK
tenant_id UUID NOT NULL
scan_job_id UUID NOT NULL
project_id UUID NOT NULL
base_project_revision VARCHAR NOT NULL
plan_version INT NOT NULL
source_of_truth_policy VARCHAR NOT NULL
selected_candidate_ids JSONB NOT NULL
execution_order JSONB NOT NULL
risk_summary JSONB NOT NULL
approval_policy VARCHAR NOT NULL
rollback_policy VARCHAR NOT NULL
agent19_change_plan_uri TEXT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_by UUID NOT NULL
approved_by UUID NULL
approved_at TIMESTAMPTZ NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, plan_version)
```

## 58.25 `eda_repair_patches`

```text
id UUID PK
repair_plan_id UUID NOT NULL
patch_sequence INT NOT NULL
patch_operation VARCHAR NOT NULL
target_source_map JSONB NOT NULL
arguments JSONB NOT NULL
preconditions JSONB NOT NULL
postconditions JSONB NOT NULL
risk_level VARCHAR NOT NULL
reversible BOOLEAN NOT NULL
patch_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(repair_plan_id, patch_sequence)
```

## 58.26 `eda_recovered_library_assets`

```text
id UUID PK
repair_plan_id UUID NOT NULL
asset_kind VARCHAR NOT NULL
library_nickname VARCHAR NOT NULL
object_name VARCHAR NOT NULL
source_kind VARCHAR NOT NULL
source_reference JSONB NOT NULL
storage_uri TEXT NOT NULL
artifact_hash CHAR(64) NOT NULL
semantic_hash CHAR(64) NOT NULL
target_relative_path TEXT NOT NULL
license_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 58.27 `eda_library_manifests`

```text
id UUID PK
scan_job_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
resolution_context_hash CHAR(64) NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
library_count INT NOT NULL
object_count BIGINT NOT NULL
unresolved_count INT NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, manifest_version)
```

## 58.28 `eda_library_lockfiles`

```text
id UUID PK
scan_job_id UUID NOT NULL
lock_version VARCHAR NOT NULL
project_revision VARCHAR NOT NULL
kicad_major INT NOT NULL
dependency_count INT NOT NULL
lockfile_uri TEXT NOT NULL
lockfile_hash CHAR(64) NOT NULL
replay_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, lock_version)
```

## 58.29 `eda_repair_executions`

```text
id UUID PK
repair_plan_id UUID NOT NULL
agent19_execution_id UUID NOT NULL
execution_attempt INT NOT NULL
status VARCHAR NOT NULL
pre_scan_job_id UUID NOT NULL
post_scan_job_id UUID NULL
closed_issue_ids JSONB NOT NULL
remaining_issue_ids JSONB NOT NULL
new_issue_ids JSONB NOT NULL
validation_summary JSONB NOT NULL
rollback_status VARCHAR NULL
created_at TIMESTAMPTZ
completed_at TIMESTAMPTZ NULL
UNIQUE(repair_plan_id, execution_attempt)
```

## 58.30 `eda_library_audit_reports`

```text
id UUID PK
scan_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
dependency_completeness NUMERIC NULL
library_reproducibility NUMERIC NULL
instance_alignment NUMERIC NULL
pin_pad_coverage NUMERIC NULL
lockfile_status VARCHAR NOT NULL
critical_issue_count INT NOT NULL
error_issue_count INT NOT NULL
warning_issue_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(scan_job_id, report_version)
```

---

# 59. 对象存储

```text
derived/eda-library-validation/
  {tenant_id}/{project_id}/
    scans/
      {scan_job_id}/
        input/
          project-manifest.json
          agent16-ir-manifest.json
          source-hashes.json
        context/
          resolution-context.json
          path-variables.json
          providers.json
        tables/
          sym-lib-table/
          fp-lib-table/
          nested/
        inventory/
          libraries.jsonl.zst
          symbol-definitions.jsonl.zst
          symbol-pins.jsonl.zst
          footprint-definitions.jsonl.zst
          footprint-pads.jsonl.zst
          3d-models.jsonl.zst
          instances.jsonl.zst
        fingerprints/
          binary.jsonl.zst
          normalized.jsonl.zst
          semantic.jsonl.zst
        dependency-graph/
          nodes.jsonl.zst
          edges.jsonl.zst
          graph.json
        comparisons/
          symbol-instance-vs-library/
          footprint-instance-vs-library/
          library-release/
        pin-pad/
          mappings.jsonl.zst
          exceptions.jsonl.zst
          trace.jsonl.zst
        issues/
          findings.jsonl.zst
          impact.jsonl.zst
        lock/
          eda-libs.manifest.json
          eda-libs.lock.json
        repairs/
          candidates.jsonl.zst
          plans/
          packages/
        reports/
          library-audit.html
          library-audit.pdf
          pin-pad-matrix.csv
          unresolved-dependencies.csv
          conflict-report.html
        debug/
          resolution-trace.jsonl.zst
          fingerprint-trace.jsonl.zst
          pin-pad-trace.jsonl.zst
          resource-usage.json
```

---

# 60. API 设计

## 60.1 Scan

```text
POST /api/v1/eda-library-validation/scans
POST /api/v1/eda-library-validation/scans/batch
GET  /api/v1/eda-library-validation/scans/{id}
GET  /api/v1/eda-library-validation/scans/{id}/events
POST /api/v1/eda-library-validation/scans/{id}/cancel
POST /api/v1/eda-library-validation/scans/{id}/retry
POST /api/v1/eda-library-validation/scans/{id}/rescan
```

## 60.2 Resolution Context

```text
GET  /api/v1/eda-library-validation/scans/{id}/context
GET  /api/v1/eda-library-validation/scans/{id}/path-variables
GET  /api/v1/eda-library-validation/scans/{id}/library-tables
GET  /api/v1/eda-library-validation/scans/{id}/providers
POST /api/v1/eda-library-validation/scans/{id}/validate-context
```

## 60.3 Dependency Graph

```text
GET /api/v1/eda-library-validation/scans/{id}/dependency-graph
GET /api/v1/eda-library-validation/scans/{id}/dependencies
GET /api/v1/eda-library-validation/dependencies/{id}
GET /api/v1/eda-library-validation/scans/{id}/where-used
```

## 60.4 Library Inventory

```text
GET /api/v1/eda-library-validation/scans/{id}/libraries
GET /api/v1/eda-library-validation/scans/{id}/symbols
GET /api/v1/eda-library-validation/scans/{id}/footprints
GET /api/v1/eda-library-validation/scans/{id}/3d-models
GET /api/v1/eda-library-validation/library-objects/{id}
GET /api/v1/eda-library-validation/library-objects/{id}/where-used
```

## 60.5 Drift

```text
GET  /api/v1/eda-library-validation/scans/{id}/instance-drift
GET  /api/v1/eda-library-validation/instances/{id}/comparison
POST /api/v1/eda-library-validation/scans/{id}/compare-approved-release
```

## 60.6 Pin-Pad

```text
GET  /api/v1/eda-library-validation/scans/{id}/pin-pad
GET  /api/v1/eda-library-validation/parts/{id}/pin-pad
GET  /api/v1/eda-library-validation/pin-pad-runs/{id}
POST /api/v1/eda-library-validation/parts/{id}/validate-pin-pad
```

## 60.7 Issues

```text
GET /api/v1/eda-library-validation/scans/{id}/issues
GET /api/v1/eda-library-validation/issues/{id}
GET /api/v1/eda-library-validation/issues/{id}/impact
POST /api/v1/eda-library-validation/issues/{id}/acknowledge
POST /api/v1/eda-library-validation/issues/{id}/waive
```

Waive 需要权限、原因、适用范围和有效期。

## 60.8 Manifest 和 Lockfile

```text
POST /api/v1/eda-library-validation/scans/{id}/manifest
GET  /api/v1/eda-library-validation/scans/{id}/manifest
POST /api/v1/eda-library-validation/scans/{id}/lockfile
GET  /api/v1/eda-library-validation/scans/{id}/lockfile
POST /api/v1/eda-library-validation/lockfiles/{id}/replay
```

## 60.9 Repair

```text
POST /api/v1/eda-library-validation/scans/{id}/repair-candidates
GET  /api/v1/eda-library-validation/scans/{id}/repair-candidates
POST /api/v1/eda-library-validation/repair-plans
GET  /api/v1/eda-library-validation/repair-plans/{id}
POST /api/v1/eda-library-validation/repair-plans/{id}/preview
POST /api/v1/eda-library-validation/repair-plans/{id}/approve
POST /api/v1/eda-library-validation/repair-plans/{id}/submit-to-agent19
GET  /api/v1/eda-library-validation/repair-executions/{id}
```

## 60.10 Reports

```text
GET /api/v1/eda-library-validation/scans/{id}/report
GET /api/v1/eda-library-validation/scans/{id}/pin-pad-matrix
GET /api/v1/eda-library-validation/scans/{id}/conflicts
GET /health/live
GET /health/ready
GET /metrics
```

---

# 61. 输入事件

```text
eda.ir.ready
kicad.project-revision.ready
project.revision.created
project.library-files.changed
library.registry.release-approved
library.registry.release-retired
library.table.changed
path-variable.changed
agent19.execution.completed
eda-library.scan.requested
```

---

# 62. 输出事件

```text
eda-library.scan.started
eda-library.dependency-graph.ready
eda-library.missing-dependency.detected
eda-library.version-conflict.detected
eda-library.cache-pollution.detected
eda-library.pin-pad-conflict.detected
eda-library.repair-candidates.ready
eda-library.repair-plan.ready
eda-library.lockfile.ready
eda-library.scan.completed
eda-library.scan.completed-with-findings
eda-library.release-gate.blocked
eda-library.repair-validated
eda-library.repair-failed
```

## `eda-library.pin-pad-conflict.detected`

```json
{
  "event_type": "eda-library.pin-pad-conflict.detected",
  "event_version": "1.0",
  "scan_job_id": "uuid",
  "project_id": "uuid",
  "part_instance_id": "uuid",
  "reference": "U3",
  "symbol_library_id": "ProjectSymbols:ABC123",
  "footprint_library_id": "ProjectFootprints:QFN32",
  "issue_codes": [
    "SYMBOL_PIN_WITHOUT_PAD",
    "FOOTPRINT_PAD_DUPLICATE"
  ],
  "severity": "error",
  "report_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 63. Policy 和配置

```text
policies/
├── eda-library-validation-1.0.0.yaml
├── resolution/
│   ├── table-precedence.yaml
│   ├── path-variables.yaml
│   ├── provider-trust.yaml
│   └── offline.yaml
├── fingerprints/
│   ├── symbol-semantic.yaml
│   ├── footprint-semantic.yaml
│   └── normalization.yaml
├── drift/
│   ├── instance-vs-library.yaml
│   ├── cache-pollution.yaml
│   └── approved-release.yaml
├── pin-pad/
│   ├── normalization.yaml
│   ├── pad-classification.yaml
│   ├── duplicate-pin.yaml
│   ├── duplicate-pad.yaml
│   ├── exceptions.yaml
│   └── variant-scope.yaml
├── repairs/
│   ├── eligibility.yaml
│   ├── source-of-truth.yaml
│   ├── recovery-library.yaml
│   ├── risk.yaml
│   └── postconditions.yaml
├── release-gates.yaml
└── enterprise/
```

---

# 64. Rule Engine

要求：

- JSON/YAML Schema；
- 受限表达式；
- Rule ID 和 Version；
- Scope；
- Priority；
- Effectivity；
- Conflict Detection；
- Dry Run；
- Explanation Trace；
- Rollback；
- 禁止任意代码执行。

---

# 65. Table Precedence

默认解析顺序应按 KiCad 实际上下文和项目策略实现，系统必须记录：

```text
project-specific table
nested table included by active table
global table snapshot
enterprise-approved fallback
```

发生相同 Nickname 时不能简单“取第一个”。

输出：

```text
selected entry
shadowed entries
conflict reason
policy version
```

---

# 66. Path Variable Resolver

算法：

```text
parse variable references
→ build variable dependency graph
→ detect cycle
→ expand in topological order
→ normalize platform path
→ enforce workspace policy
→ verify existence
```

保存 Raw 和 Resolved 值，不写入真实用户绝对路径到公开报告。

---

# 67. Library Object Resolver

输入：

```text
library nickname
object name
target KiCad version
table context
provider policy
```

输出：

```text
exact object
candidate objects
hashes
source
license
approval
ambiguity
```

---

# 68. Semantic Fingerprint 规范

Fingerprint Schema 必须版本化。

例如：

```text
symbol-fingerprint-v1
footprint-fingerprint-v1
```

算法升级不覆盖旧 Hash。

---

# 69. 语义比较结果

```text
identical
compatible
compatible_with_warning
incompatible
unknown
```

`compatible` 需要按对象类型给出理由，不能只给一个布尔值。

---

# 70. Pin Number 规范化候选

可识别：

```text
leading_zero
case
unicode_normalization
trimmed_whitespace
numeric_equivalence
```

默认：

```text
只报告候选
不直接改变 Raw Number
```

企业可对特定库启用明确规则。

---

# 71. Pin-Pad 校验算法

步骤：

```text
1. 解析 Symbol 全部 Unit 和 Alternate
2. 建立逻辑 Pin 集合
3. 解析 Footprint 全部 Pad
4. 分类 Electrical / Mechanical
5. 识别显式 Equivalent/Shared Groups
6. 按 Raw Number 精确匹配
7. 应用批准的规范化候选
8. 识别 one-to-one / one-to-many / many-to-one
9. 检测缺失、重复和冲突
10. 结合 Variant 和 Part Identity
11. 输出 Mapping Matrix 和 Trace
```

---

# 72. Pin-Pad Matrix

```text
RefDes
Variant
Symbol Pin Number
Pin Name
Pin Type
Unit
Footprint Pad Number
Pad Type
Pad Layers
Mapping Status
Exception
Severity
Evidence
```

---

# 73. Pin-to-Net Conservation

对于任何修复：

```text
before Pin-to-Net
after Pin-to-Net
```

必须按：

```text
RefDes
Pin Number
Net ID/Name
```

比较。

未经批准变化：

```text
Hard Gate
```

---

# 74. PCB Conservation

修复库依赖时默认要求：

```text
Footprint UUID/KIID 不变
Placement 不变
Rotation/Side 不变
Pad Net Assignment 不变
Track/Via/Zone 不变
Board Outline 不变
```

---

# 75. Repair Candidate 排序

优先：

```text
唯一来源
Hash 精确
项目本地
无需改变引用
不改变 Pin/Pad Set
可原子回滚
许可证明确
```

降低优先级：

```text
名称近似
跨项目来源
Global Library
远程未锁定
需要 Pin/Pad 重编号
需要 Footprint 替换
```

---

# 76. Auto-fix Decision

```text
candidate source unique
AND artifact hash trusted
AND license permits
AND no Pin/Pad semantic change
AND no Pin-to-Net change
AND no PCB geometry/routing change
AND patch reversible
AND target inside workspace
```

否则至少为：

```text
review_required
```

---

# 77. 修复后的二次扫描

不能仅依据 Agent 19 返回成功。

必须：

```text
Agent 16重新解析
→ Agent 20新 Scan
→ 比较 Issue Closure
→ 校验 Lockfile
→ 比较 Pin-to-Net
→ 比较 PCB
→ ERC/DRC
```

---

# 78. Library Release Gate

进入工程冻结或制造前：

```text
required symbol dependencies resolved
required footprint dependencies resolved
required 3D dependencies according to policy
no critical nickname conflict
no unresolved pin-pad error
no unapproved instance drift
lockfile generated and replayable
repair manifest complete
```

---

# 79. Audit Report

至少包含：

```text
项目和 Revision
KiCad Version
扫描上下文
库表和变量
依赖图
缺失项
冲突项
实例漂移
Pin-Pad Matrix
重复编号解释
修复候选
未修复风险
Lockfile
执行和验证结果
```

---

# 80. CI 模式

命令示例：

```text
eda-library-agent scan --project .
eda-library-agent validate-lock --project .
eda-library-agent pin-pad --project .
eda-library-agent gate --profile manufacturing
```

退出码：

```text
0 pass
1 warnings according to policy
2 errors
3 critical/security/input failure
```

---

# 81. Incremental Scan

变化键：

```text
project file hash
library table hash
path variable snapshot
library file hash
symbol/footprint semantic hash
Agent 16 IR hash
target KiCad version
policy version
```

只重算受影响依赖和 Part。

---

# 82. Cache Key

```text
source asset hash
parser version
fingerprint schema version
resolution context hash
validation policy version
```

---

# 83. 可观测性

```text
eda_library_scans_total{status,mode}
eda_library_scan_duration_seconds{step}
eda_library_tables_total{type,scope}
eda_library_resolution_total{kind,status}
eda_library_nickname_conflicts_total{type}
eda_library_path_issues_total{type}
eda_library_objects_total{kind}
eda_library_instance_drift_total{type,status}
eda_library_cache_pollution_total{type}
eda_library_pin_pad_runs_total{status}
eda_library_pin_pad_issues_total{code,severity}
eda_library_duplicate_numbers_total{kind,status}
eda_library_repair_candidates_total{type,risk,eligibility}
eda_library_repair_executions_total{status}
eda_library_lockfile_replay_total{status}
eda_library_release_gate_blocks_total{reason}
```

---

# 84. Dashboard

```text
Projects Scanned
Dependency Completeness
Missing Symbols
Missing Footprints
Missing 3D Models
Nickname Conflicts
Path Variable Problems
Instance Drift
Cache Pollution
Pin-Pad Coverage
Duplicate Pin/Pad Analysis
Repair Candidates
Repair Execution
Lockfile Status
Release Gate
KiCad Version Compatibility
```

---

# 85. Benchmark

## Resolution

```text
project table
global snapshot
nested table
undefined variable
variable cycle
case mismatch
absolute path
symlink
remote blocked
nickname collision
```

## Symbol

```text
packed .kicad_sym
unpacked symbol library
derived symbol
multi-unit
alternate representation
hidden pin
embedded snapshot
missing source library
graphics-only drift
pinset drift
```

## Footprint

```text
.pretty
.kicad_mod
custom pad
NPTH
multiple pads same number
exposed pad
shield
missing source library
board instance recovery
padset drift
```

## Legacy

```text
cache.lib
rescue.lib
legacy symbol
legacy footprint
nickname shadow
migration candidate
```

## Pin-Pad

```text
one-to-one
pin without pad
pad without pin
stacked pin
shared pad
duplicate ambiguous
alphanumeric number
leading zero
case difference
multi-unit
variant footprint
```

## Repair

```text
vendor embedded symbol
vendor board footprint
add table entry
KIPRJMOD conversion
nickname rebind
3D path
pin renumber blocked
pad renumber blocked
Agent 19 execution
rollback
```

## Security

```text
path traversal
symlink escape
remote URL
malicious library size
deep S-expression
unsupported provider
license block
unauthorized global modification
```

---

# 86. 初始质量目标

```text
Raw Project Preservation = 100%
Dependency Context Reproducibility = 100%
Library Table Parse Accuracy = 100% on supported formats
Path Variable Cycle Detection = 100%
Nickname Ambiguity Auto-resolution Rate = 0%
Missing Required Dependency Detection >= 99.99%
Semantic Fingerprint Determinism = 100%
Format Version Misclassified as Release Version = 0%
Pin-Pad Exact Mapping Accuracy = 100% on Golden Fixtures
Legitimate Duplicate Auto-deletion Rate = 0%
Ambiguous Duplicate Auto-fix Rate = 0%
Unapproved Pin-to-Net Change = 0
Unapproved PCB Routing Change = 0
Auto-fix Outside Workspace = 0
Untrusted Remote Auto-download = 0
Agent 19 Execution Readback Coverage = 100%
Post-repair Agent 16 Reparse Coverage = 100%
Lockfile Replay Consistency = 100%
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 87. 测试集

公开仓库只使用开源、合成、脱敏或明确授权 Fixture。

## Library Tables / Paths

1. Project Symbol Table；
2. Project Footprint Table；
3. Global Snapshot；
4. Nested Table；
5. Nested Cycle；
6. Duplicate Nickname；
7. Project Shadow；
8. Same Nickname Different Hash；
9. `${KIPRJMOD}`；
10. Undefined Variable；
11. Variable Cycle；
12. Absolute Path；
13. Windows Drive；
14. Case Difference；
15. Symlink；
16. Broken Symlink；
17. Path Escape；
18. Network Path；
19. HTTP Provider Blocked；
20. Approved Cached Provider。

## Symbols

21. Packed Symbol Library；
22. Unpacked Symbol Library；
23. Multi-unit；
24. Alternate Representation；
25. Derived Symbol；
26. Hidden Pin；
27. Stacked Pin；
28. Embedded Exact；
29. Embedded Graphics Drift；
30. Embedded Pinset Drift；
31. Missing Library with Embedded；
32. Missing Symbol Name；
33. Same Name Different Content；
34. Generator Difference；
35. Format Version Difference；
36. Legacy Cache；
37. Rescue Library；
38. Cross-project Cache；
39. Recovery Library；
40. License Block。

## Footprints

41. Pretty Library；
42. Missing Pretty Directory；
43. Missing kicad_mod；
44. Board Instance Exact；
45. Board Instance Padset Drift；
46. NPTH；
47. Mechanical Numbered Pad；
48. Exposed Pad；
49. Shared Pad Number；
50. Custom Pad Primitives；
51. Castellated；
52. Shield；
53. 3D Missing；
54. 3D Variable Missing；
55. 3D Hash Mismatch；
56. Same Name Different Padset；
57. Footprint Field Empty；
58. Variant Footprint；
59. Locked Footprint；
60. Recovery Footprint。

## Pin-Pad

61. One-to-one；
62. Pin without Pad；
63. Pad without Pin；
64. Duplicate Pin Valid；
65. Duplicate Pin Ambiguous；
66. Duplicate Pad Valid；
67. Duplicate Pad Ambiguous；
68. Pin-Pad Swap；
69. Leading Zero；
70. Alphanumeric；
71. Case Difference；
72. Unicode Confusable；
73. Hidden Power Pin；
74. Multi-unit Complete；
75. Multi-unit Missing Unit；
76. DNP；
77. Alternative Part；
78. Padset Changed；
79. Pinset Changed；
80. Mapping Trace。

## Repair / Gate

81. Add Table Entry；
82. Convert to KIPRJMOD；
83. Vendor Embedded Symbol；
84. Vendor Board Footprint；
85. Restore 3D Path；
86. Nickname Rebind；
87. Pin Renumber Review；
88. Pad Renumber Review；
89. Pin-to-Net Change Block；
90. Routing Change Block；
91. Agent 19 Preview；
92. Agent 19 Execute；
93. Agent 16 Reparse；
94. Rescan Closure；
95. ERC Regression；
96. DRC Regression；
97. Lockfile Replay；
98. Tenant Isolation；
99. 100k Library Objects；
100. Audit Replay。

---

# 88. 性能要求

常规工程：

```text
500 part instances
50 libraries
20,000 library objects
```

目标：

```text
Context Snapshot P95 < 3 s
Table/Path Resolution P95 < 3 s
Dependency Graph P95 < 10 s
Incremental Pin-Pad Validation P95 < 5 s
Interactive Issue Query P95 < 300 ms
```

企业库：

```text
1,000,000 型号映射
100,000 Symbol/Footprint Objects
```

需要：

- Hash Cache；
- Semantic Fingerprint Cache；
- Content-addressed Storage；
- 并行库解析；
- Agent 16 IR 复用；
- 批量数据库写入；
- Incremental Dependency Graph；
- 不重复解析相同 Artifact Hash；
- 大型报告使用 JSONL/Parquet。

---

# 89. 安全与权限

- 工程、库、3D 和 Lockfile 按租户/项目隔离；
- Library Table、Path 和 Environment 作为敏感配置；
- 公开报告不显示完整用户主目录；
- Path Resolver 防止 `..`、Symlink Escape 和 UNC 越界；
- 默认 Offline；
- Remote Provider 需要 Allowlist、TLS、Hash 和固定版本；
- 不执行库内脚本、宏、插件或生成器；
- 不加载可执行 3D 插件；
- S-expression、ZIP 和远程缓存设置资源限制；
- 不直接写全局 `sym-lib-table` 或 `fp-lib-table`；
- Recovery Asset 只能写 Agent 19 Workspace；
- License Unknown 时不复制到 Recovery Library；
- 企业库访问使用最小权限；
- Repair Approval 与 Scan 权限分开；
- Pin/Pad Renumber 和 Footprint Replace 需要高级权限；
- Lockfile 和 Repair Manifest 不可硬删除；
- 不把工程、库和 3D 模型发送给外部通用模型；
- 不在公开 Fixture 中使用客户私有库；
- 不记录生产 Token、Registry Credential 或私有 URL Query。

---

# 90. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
S3 / R2 / MinIO
Temporal
```

解析和数据：

```text
Agent 16 Parser
lark/自定义 S-expression parser
Polars
PyArrow
DuckDB
```

Hash：

```text
SHA-256
canonical JSON serialization
versioned semantic fingerprint
```

图：

```text
PostgreSQL adjacency
custom DAG/cycle detection
NetworkX only for small fixtures
```

文件：

```text
pathlib
fsspec optional
content-addressed storage
```

V1 不需要 LLM。

---

# 91. 推荐仓库结构

```text
eda-library-validation-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── eda-library-validation-agent-spec.md
│   ├── dependency-domain-model.md
│   ├── library-table-resolution.md
│   ├── path-variable-resolution.md
│   ├── dependency-graph.md
│   ├── symbol-fingerprints.md
│   ├── footprint-fingerprints.md
│   ├── instance-library-drift.md
│   ├── cache-pollution.md
│   ├── pin-pad-validation.md
│   ├── duplicate-number-semantics.md
│   ├── manifest-and-lockfile.md
│   ├── repair-planning.md
│   ├── agent19-integration.md
│   ├── release-gates.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-declared-resolved-embedded-approved-separated.md
│       ├── 0002-format-version-is-not-library-release.md
│       ├── 0003-duplicate-numbers-may-be-legitimate.md
│       ├── 0004-instance-as-designed-is-preserved.md
│       ├── 0005-repairs-run-through-agent19.md
│       ├── 0006-lockfile-is-a-sidecar-not-kicad-native.md
│       └── 0007-pin-to-net-conservation-is-a-hard-gate.md
├── src/
│   └── eda_library_validation/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── context.py
│       │   ├── table.py
│       │   ├── library.py
│       │   ├── dependency.py
│       │   ├── symbol.py
│       │   ├── footprint.py
│       │   ├── pin_pad.py
│       │   ├── issue.py
│       │   ├── repair.py
│       │   └── lockfile.py
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent19.py
│       │   ├── kicad9.py
│       │   ├── kicad10.py
│       │   ├── legacy.py
│       │   └── registry.py
│       ├── intake/
│       │   ├── snapshots.py
│       │   ├── inventory.py
│       │   ├── hashing.py
│       │   └── limits.py
│       ├── tables/
│       │   ├── parser.py
│       │   ├── nested.py
│       │   ├── precedence.py
│       │   ├── conflicts.py
│       │   └── source_map.py
│       ├── paths/
│       │   ├── variables.py
│       │   ├── graph.py
│       │   ├── platform.py
│       │   ├── security.py
│       │   └── normalization.py
│       ├── providers/
│       │   ├── base.py
│       │   ├── local.py
│       │   ├── enterprise.py
│       │   ├── remote_cached.py
│       │   ├── admission.py
│       │   └── licensing.py
│       ├── inventory/
│       │   ├── symbols.py
│       │   ├── footprints.py
│       │   ├── models3d.py
│       │   ├── instances.py
│       │   └── legacy.py
│       ├── fingerprints/
│       │   ├── binary.py
│       │   ├── normalized.py
│       │   ├── symbol.py
│       │   ├── footprint.py
│       │   ├── schema.py
│       │   └── cache.py
│       ├── dependency_graph/
│       │   ├── nodes.py
│       │   ├── edges.py
│       │   ├── builder.py
│       │   ├── cycles.py
│       │   ├── where_used.py
│       │   └── hashing.py
│       ├── drift/
│       │   ├── embedded_symbol.py
│       │   ├── footprint_instance.py
│       │   ├── approved_release.py
│       │   ├── cache_pollution.py
│       │   └── reports.py
│       ├── pin_pad/
│       │   ├── pins.py
│       │   ├── pads.py
│       │   ├── classification.py
│       │   ├── normalization.py
│       │   ├── matcher.py
│       │   ├── duplicates.py
│       │   ├── exceptions.py
│       │   ├── variants.py
│       │   └── trace.py
│       ├── issues/
│       │   ├── detector.py
│       │   ├── taxonomy.py
│       │   ├── severity.py
│       │   ├── impact.py
│       │   └── waivers.py
│       ├── repairs/
│       │   ├── candidates.py
│       │   ├── eligibility.py
│       │   ├── source_of_truth.py
│       │   ├── recovery_symbols.py
│       │   ├── recovery_footprints.py
│       │   ├── recovery_3d.py
│       │   ├── patch_dsl.py
│       │   ├── plans.py
│       │   ├── packages.py
│       │   └── validation.py
│       ├── lockfiles/
│       │   ├── manifest.py
│       │   ├── lock.py
│       │   ├── replay.py
│       │   └── validation.py
│       ├── release/
│       │   ├── gates.py
│       │   ├── profiles.py
│       │   └── reports.py
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── fingerprint-schemas/
├── repair-templates/
├── fixtures/
│   ├── kicad9/
│   ├── kicad10/
│   └── legacy/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── scan_eda_libraries.py
    ├── inspect_library_tables.py
    ├── build_dependency_graph.py
    ├── compare_instance_library.py
    ├── validate_pin_pad.py
    ├── generate_library_lockfile.py
    ├── generate_repair_package.py
    ├── submit_repair_to_agent19.py
    ├── verify_repair.py
    └── run_library_validation_benchmark.py
```

---

# 92. 技术资料参考

实施前重新核验最新版本、格式和许可证：

```text
KiCad File Formats
https://dev-docs.kicad.org/en/file-formats/

KiCad Symbol Library File Format
https://dev-docs.kicad.org/en/file-formats/sexpr-symbol-lib/

KiCad Footprint Library File Format
https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/

KiCad Schematic File Format
https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/

KiCad 10 Getting Started / Library Tables
https://docs.kicad.org/10.0/en/getting_started_in_kicad/getting_started_in_kicad.html

KiCad 10 PCB Editor / Footprint Libraries
https://docs.kicad.org/10.0/en/pcbnew/pcbnew.html
```


---

# 93. Codex 分阶段实施

不要让 Codex 一次实现全部库表解析、Legacy Cache、指纹、Pin-Pad、Repair Package、Agent 19 执行和企业库注册表。

## Phase 0：仓库侦察与真实依赖盘点

Codex 必须检查：

1. Agent 16 的实际 Project/Schematic/PCB/Part/Net/Library IR；
2. Agent 19 的 Change Plan、Workspace、Patch、Readback 和 Rollback；
3. 当前 `parseKicadSym`、`parseKicadMod` 和 KiCad S-expression Parser；
4. 当前 `.kicad_pro`、`.kicad_sch`、`.kicad_pcb` Parser；
5. 当前 Symbol、Footprint、3D Model 和型号映射数据库；
6. 当前 `sym-lib-table`、`fp-lib-table` 和 Nested Table；
7. 当前 Path Variable 和 `${KIPRJMOD}` 处理；
8. 当前 KiCad 9、10 和 Legacy 支持；
9. 当前 Packed/Unpacked Symbol Library；
10. 当前 `.pretty/.kicad_mod`；
11. 当前 `lib_symbols` Embedded Snapshot；
12. 当前 PCB Footprint Instance Snapshot；
13. 当前 `*-cache.lib`、`*-rescue.lib` 和 Legacy Migration；
14. 当前 Symbol Library ID 和 Footprint Field；
15. 当前 Pin、Pad、Pin-to-Net 和 Pin-Pad Mapping；
16. 当前 Duplicate Pin/Pad 处理；
17. 当前 Hidden Pin、Multi-unit、Derived Symbol 和 Variant；
18. 当前 3D Model 路径和 `ensureStepBytes`；
19. 当前 Library Hash、Version、Source、License 和 Approval；
20. 当前 Git、Artifact Registry、企业库和 Remote Provider；
21. 当前 Dependency Graph、Where-used 和 Cache；
22. 当前修复工具、Project-local Library 和 Patch；
23. 当前 Agent 16 Semantic Diff、ERC、DRC；
24. 当前 CI、Release Gate、Queue、Worker、Database 和 Object Storage；
25. 统计缺失 Symbol、Footprint、3D、Nickname Conflict 和 Pin-Pad Issue；
26. 抽样分析开源、合成、脱敏或授权 KiCad 工程；
27. 只运行只读扫描；
28. 不修改库表；
29. 不创建 Recovery Library；
30. 不调用 Agent 19 写操作；
31. 不创建 Migration；
32. 不安装依赖；
33. 不访问远程库；
34. 不读取或打印生产 Secret。

## Phase 1：Domain Model 和 JSON Schema

实现：

- Scan Job；
- Resolution Context；
- Library Table/Entry；
- Path Variable；
- Provider；
- Resolved Library；
- Library Object；
- Symbol/Pin；
- Footprint/Pad；
- 3D Model；
- Design Instance；
- Comparison；
- Dependency Graph；
- Pin-Pad；
- Issue；
- Repair；
- Manifest/Lockfile；
- JSON Schema。

## Phase 2：Project Inventory 和 Input Snapshot

实现：

- Agent 16 Adapter；
- Project Revision；
- Source Asset Inventory；
- KiCad Version；
- Modern/Legacy Detection；
- File Hash；
- Immutable Snapshot；
- Resource Limits；
- Diagnostics。

## Phase 3：Library Table Parser

实现：

- `sym-lib-table`；
- `fp-lib-table`；
- Nested Tables；
- Entry；
- Nickname；
- URI；
- Options；
- Description；
- Source Span；
- Unknown Token；
- Deterministic Parse。

## Phase 4：Path Variable Resolver

实现：

- `${KIPRJMOD}`；
- KiCad Variables；
- User Variables from Snapshot；
- Dependency Graph；
- Cycle；
- Platform Path；
- Case；
- Symlink；
- Workspace Boundary；
- Security；
- Redaction。

## Phase 5：Provider Registry 和 Admission

实现：

- Local；
- Enterprise；
- Remote Cached；
- HTTP Config Inventory；
- Trust；
- License；
- Offline；
- Fixed Hash；
- No Auto-download；
- Provider Health。

## Phase 6：Dependency Graph

实现：

- Nodes；
- Edges；
- Declared/Resolved/Embedded/Approved；
- Includes；
- Uses Variable；
- Contains；
- References；
- Shadows；
- Conflicts；
- Cycle；
- Where-used；
- Stable Hash。

## Phase 7：Symbol Library Inventory

实现：

- Packed `.kicad_sym`；
- Unpacked Library；
- Symbol Definition；
- Derived/Alias；
- Units；
- Alternate；
- Pins；
- Properties；
- Graphics；
- Embedded `lib_symbols`；
- Source Map。

## Phase 8：Footprint Library Inventory

实现：

- `.pretty`；
- `.kicad_mod`；
- Footprint Definition；
- Pads；
- Custom Pads；
- NPTH；
- Mechanical；
- Courtyard；
- 3D References；
- PCB Instance Snapshot；
- Source Map。

## Phase 9：Legacy Library Inventory

实现：

- `.lib`；
- `.dcm`；
- `*-cache.lib`；
- `*-rescue.lib`；
- Legacy Footprints；
- Read-only；
- Usage；
- Conflict；
- Recovery Candidate；
- No Silent Migration。

## Phase 10：Fingerprint Framework

实现：

- Binary；
- Normalized；
- Semantic；
- Versioned Schema；
- Symbol Fingerprint；
- Footprint Fingerprint；
- Pinset/Padset；
- Graphics/Geometry；
- Property；
- Cache；
- Determinism。

## Phase 11：Library Release 和 Lockfile Registry

实现：

- External Version；
- Git Commit/Tag；
- Package Version；
- Artifact Hash；
- License；
- Approval；
- Manifest；
- Lockfile；
- Replay；
- No Format-version Confusion。

## Phase 12：Instance-vs-Library Drift

实现：

- Embedded vs Resolved Symbol；
- PCB Instance vs Footprint Library；
- Exact/Semantic；
- Graphics Drift；
- Property Drift；
- Pinset/Padset Drift；
- Local Modified；
- Approved Release；
- Diff Report。

## Phase 13：Cache Pollution Detection

实现：

- Stale Embedded；
- Stale Board Footprint；
- Legacy Cache Shadow；
- Rescue Orphan；
- Cross-project Reuse；
- Nickname Rebind；
- Global Update Drift；
- Generated Asset Drift；
- Remote Drift；
- Severity。

## Phase 14：Pin and Pad Canonical Model

实现：

- Raw Number；
- Normalized Candidate；
- Pin Unit/Alternate；
- Hidden/Stacked；
- Pad Classification；
- Shared Number Group；
- Custom Primitive；
- Mechanical Exclusion；
- Variant Scope；
- Trace。

## Phase 15：Pin-Pad Matcher

实现：

- Raw Exact；
- Approved Normalization；
- One-to-one；
- One-to-many；
- Many-to-one；
- Missing；
- Duplicate；
- Ambiguous；
- Mapping Matrix；
- Deterministic Tests。

## Phase 16：Duplicate Number Semantics

实现：

- Stacked Pin；
- Equivalent Pin；
- Shared Pad；
- Exposed/Thermal；
- Shield；
- Castellated；
- Mechanical；
- Invalid Duplicate；
- Rule Trace；
- Review Status；
- No Auto-delete。

## Phase 17：Issue、Severity 和 Impact

实现：

- Taxonomy；
- Severity；
- Blocking；
- Design Scope；
- Pin/Pad/Net；
- Routing；
- Variant；
- Manufacturing Risk；
- Waiver；
- Expiry；
- Report。

## Phase 18：Repair Candidate Generator

实现：

- Unique Source；
- Eligibility；
- Source-of-truth；
- Vendor Symbol；
- Vendor Footprint；
- Vendor 3D；
- Table Entry；
- KIPRJMOD；
- Rebind；
- Footprint Field；
- Pin/Pad Review Candidate；
- License Gate。

## Phase 19：Recovery Library Builder

实现：

- Project-local Symbol Library；
- Packed/Unpacked Policy；
- Footprint Pretty；
- 3D Directory；
- Metadata；
- Hash；
- Native Format；
- Table Entry；
- No Global Write；
- Golden Reopen Tests。

## Phase 20：Repair Patch DSL

实现：

- Operations；
- Agent 16 Source Map；
- Preconditions；
- Postconditions；
- Reversible；
- Atomic Package；
- Hash；
- No Regex；
- Schema；
- Dry Run。

## Phase 21：Agent 19 Change Plan Adapter

实现：

- Patch → Canonical Operation；
- Workspace；
- Snapshot；
- Risk；
- Approval；
- Preview；
- Execution Order；
- Rollback；
- Readback；
- Agent 19 Contract Tests。

## Phase 22：Post-repair Verification

实现：

- Agent 16 Reparse；
- Agent 20 Rescan；
- Issue Closure；
- New Issues；
- Pin-to-Net Conservation；
- PCB Conservation；
- ERC/DRC；
- Lockfile Replay；
- Commit/Rollback Decision。

## Phase 23：Release Gate 和 CI

实现：

- Profiles；
- Design Review；
- Library Freeze；
- Manufacturing；
- Exit Codes；
- Reports；
- Git Check；
- Artifact；
- Waiver；
- Expiry；
- Event。

## Phase 24：API、Jobs、Events 和 Storage

实现：

- APIs；
- Progress；
- Batch；
- Cancel/Retry；
- JSONL；
- Object Storage；
- Pagination；
- Cache；
- Tenant/Project Permission；
- Audit。

## Phase 25：Review Workbench

实现：

- Dependency Graph；
- Table/Variable；
- Missing Libraries；
- Instance Drift Diff；
- Pin-Pad Matrix；
- Duplicate Group；
- Repair Candidates；
- Risk；
- Preview；
- Approve；
- Agent 19 Status；
- Before/After。

## Phase 26：Benchmark、监控和生产发布

实现：

- KiCad 9/10；
- Packed/Unpacked；
- Legacy；
- Path Security；
- Fingerprint；
- Pin-Pad；
- Repair；
- Rollback；
- Large Libraries；
- Metrics；
- Dashboard；
- Feature Flags；
- Disaster Recovery。

## Phase 27：其他 EDA 格式，可选

Agent 16 的 Canonical Library IR 稳定后：

- Altium SchLib/PcbLib；
- JLCEDA/EasyEDA Library；
- Library Dependency Graph；
- Pin-Pad；
- Repair Export；
- Format-specific Adapter；
- 不降低 KiCad 的严格 Gate。

---

# 94. Codex 工作纪律

Codex 必须：

1. Declared、Resolved、Embedded/Instance 和 Approved Source 分开；
2. Library Table、Library、Object 和 Instance 分开；
3. Format Version 与 External Release Version 分开；
4. Raw Path 与 Resolved Path 分开；
5. 扫描保存 Resolution Context；
6. Global Table 使用 Snapshot，不读取用户机器任意状态后假装可重放；
7. Project Table 和 Global Table Shadow 明确；
8. Nested Table 做循环检测；
9. Path Variable 做依赖图和循环检测；
10. `${KIPRJMOD}` 优先用于项目本地修复；
11. 不自动修改全局库表；
12. 不自动联网下载库；
13. Provider 需要 Admission、Hash 和 License；
14. 相同 Nickname 不代表相同库；
15. 相同对象名称不代表相同定义；
16. Binary/Normalized/Semantic Hash 分开；
17. Fingerprint Schema 版本化；
18. Parser/Hash 升级不覆盖历史结果；
19. Embedded Symbol 可作为恢复证据，但不自动认定是批准库；
20. PCB Footprint Instance 可作为恢复证据，但不自动认定是源库；
21. Instance-as-designed 不被当前最新版库覆盖；
22. Cache Pollution 需要分类而不是单一布尔值；
23. Legacy Cache/Rescue 保留来源；
24. Symbol Definition、Symbol Instance 和 Part 分开；
25. Footprint Definition 和 Footprint Instance 分开；
26. Pin/Pad Number 按字符串保存；
27. Normalization 只生成候选，除非策略明确；
28. Pin 数量等于 Pad 数量不代表匹配；
29. Mechanical/NPTH 不进入普通电气比较；
30. Custom Pad Primitive 不算重复 Pad；
31. 多个 Pad 同号可能合法；
32. 多个 Pin 同号可能合法；
33. Duplicate 不自动删除或重编号；
34. Stacked/Equivalent/Shared Group 需要证据；
35. Hidden Pin 不从不确定库补入；
36. Multi-unit 全部 Unit 参与；
37. Alternate Representation 单独比较图形；
38. Derived Symbol 保存继承关系；
39. Variant 分别校验；
40. DNP 不自动免除库完整性，但可影响 Release Scope；
41. Pin-to-Net Conservation 是 Hard Gate；
42. Pad Net Assignment Conservation 是 Hard Gate；
43. Routing/Zone/Placement 不应被库修复改变；
44. Footprint Padset 改变为高风险；
45. Pinset 改变为高风险；
46. Library ID Rebind 需要对象语义验证；
47. Recovery Library 只能写工作区；
48. Recovery Asset 保存来源、Hash、License 和工具版本；
49. Repair Candidate 需要唯一来源；
50. License Unknown 不复制；
51. Safe Auto 仍通过 Agent 19；
52. Repair Patch 使用 Source Map 和 Native ID；
53. 不用 Regex 修改完整 KiCad 文件；
54. Patch 有 Preconditions/Postconditions；
55. Patch 可回滚；
56. 修复后必须 Agent 16 Reparse；
57. 修复后必须 Agent 20 Rescan；
58. Agent 19 Success 不等于 Repair Success；
59. Lockfile 是 Sidecar，不伪装成 KiCad 原生功能；
60. Lockfile Replay 必须验证；
61. Waiver 有理由、Scope 和 Expiry；
62. Manufacturing Gate 不接受 Unresolved Pin-Pad Error；
63. 不发送工程和库给外部模型；
64. 不公开客户私有库；
65. 不伪造版本、Hash、License、修复、测试或 Benchmark；
66. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Resolution/Fingerprint/Rule 变化；
    - 测试命令；
    - 真实结果；
    - Dependency Coverage；
    - Drift Results；
    - Pin-Pad Metrics；
    - Repair Eligibility；
    - Agent 19/16 Verification；
    - Lockfile Replay；
    - 性能；
    - 安全；
    - 已知问题；
    - 下一阶段建议。

---

# 95. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/eda-library-validation-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第20个 Agent：

EDA Library Dependency, Integrity & Pin-Pad Validation Agent /
EDA 库依赖与 Pin-Pad 校验 Agent。

本 Agent 接收：

- Agent 16 Project/Schematic/PCB/Part/Net/Library IR；
- KiCad 工程文件和工程库；
- sym-lib-table / fp-lib-table / Nested Table；
- Path Variable Snapshot；
- Embedded Symbol 和 PCB Footprint Instance；
- 企业批准库、Git Release 和 Artifact Registry；

检测：

- 缺失 Symbol/Footprint/3D；
- 库表、路径变量和 Provider 错误；
- Nickname Shadow/Conflict；
- Instance 与 Library Drift；
- Legacy Cache/Rescue 污染；
- Library Version Conflict；
- Pin-Pad 不一致；
- Duplicate Pin/Pad；
- Pinset/Padset Drift；
- Variant Footprint Conflict；

并输出：

- Dependency Graph；
- Manifest；
- Lockfile；
- Pin-Pad Matrix；
- Issue/Impact；
- Repair Candidate；
- Recovery Library；
- Source-aware Patch；
- Agent 19 Change Plan；
- Post-repair Validation。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16 和 Agent 19 规格及实际代码；
3. docs/eda-library-validation-agent-spec.md；
4. 当前 KiCad Parser、Viewer、Symbol、Footprint 和 3D；
5. 当前 parseKicadSym、parseKicadMod；
6. 当前 .kicad_pro/.kicad_sch/.kicad_pcb；
7. 当前 sym-lib-table/fp-lib-table/Nested Table；
8. 当前 Packed/Unpacked Symbol Library；
9. 当前 .pretty/.kicad_mod；
10. 当前 Embedded lib_symbols 和 PCB Footprint Instance；
11. 当前 Legacy cache.lib/rescue.lib；
12. 当前 Path Variables 和 KIPRJMOD；
13. 当前 Library Registry、Git、Hash、Version、License；
14. 当前 Part/Pin/Pad/Net/Variant；
15. 当前 Pin-Pad Mapping 和 Duplicate Handling；
16. 当前 Agent 16 Source Map/Semantic Diff；
17. 当前 Agent 19 Workspace/Patch/Readback/Rollback；
18. 当前 ERC/DRC/CI/Release Gate；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Declared/Resolved/Embedded/Approved 分层；
- Format Version != Library Release Version；
- Raw/Resolved Path 分开；
- Resolution Context 可重放；
- Global Table 使用 Snapshot；
- Nested/Variable 做 Cycle Detection；
- 不自动修改 Global Table；
- 默认 Offline；
- Provider 需 Trust/Hash/License；
- Same Nickname != Same Library；
- Same Name != Same Object；
- Binary/Normalized/Semantic Hash 分开；
- Fingerprint Schema 版本化；
- Instance-as-designed 保留；
- Embedded/Board Instance 只是恢复证据；
- Cache Pollution 分类；
- Legacy Source 保留；
- Pin/Pad Number 保留 Raw String；
- Normalization 默认只生成候选；
- Pin Count == Pad Count 不代表正确；
- Mechanical/NPTH 分类；
- Custom Primitive != Duplicate Pad；
- Duplicate Pin/Pad 可能合法；
- 不自动删除/重编号；
- Stacked/Equivalent/Shared 需证据；
- Hidden Pin 不凭空补；
- Multi-unit 和 Variant 完整校验；
- Pin-to-Net Conservation Hard Gate；
- Pad Net/Routing/Placement Conservation；
- Pinset/Padset Change 高风险；
- Recovery 只写 Agent 19 Workspace；
- Recovery Asset 有 Source/Hash/License；
- Repair Source 唯一；
- Safe Auto 仍通过 Agent 19；
- Patch 使用 Agent 16 Source Map；
- 不用 Regex 修改完整文件；
- Patch 有 Preconditions/Postconditions/Rollback；
- 修复后 Agent 16 Reparse + Agent 20 Rescan；
- Agent 19 Success != Repair Success；
- Lockfile 是 Sidecar；
- 不发送工程和库给外部模型；
- 不用真实私有库做公开 Fixture；
- 不伪造版本、Hash、License、修复和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不修改任何工程或库：

1. 侦察当前仓库；
2. 检查 Agent 16 和 Agent 19 实现；
3. 查找 KiCad Parser/Viewer/Library/3D；
4. 查找 parseKicadSym/parseKicadMod；
5. 查找 Project/Schematic/PCB Parser；
6. 查找 sym-lib-table/fp-lib-table；
7. 查找 Nested Table；
8. 查找 Path Variable/KIPRJMOD；
9. 查找 Packed/Unpacked Symbol；
10. 查找 Pretty/kicad_mod；
11. 查找 Embedded Symbol/Footprint Instance；
12. 查找 Legacy Cache/Rescue；
13. 查找 Symbol/Footprint/3D Registry；
14. 查找 Hash/Version/License/Approval；
15. 查找 Pin/Pad/Net/Variant；
16. 查找 Duplicate Pin/Pad；
17. 查找 Instance Drift/Cache Pollution；
18. 查找 Recovery Library/Patch；
19. 查找 Agent 19 Workspace/Execution；
20. 查找 Agent 16 Diff/ERC/DRC；
21. 查找 CI/Release Gate/API/Worker/Storage；
22. 统计真实缺失依赖和 Pin-Pad 问题；
23. 抽样分析开源、合成、脱敏或授权工程；
24. 在 docs/eda-library-validation-implementation-plan.md 中生成实施计划；
25. 在 docs/dependency-domain-model.md 中定义 Domain；
26. 在 docs/library-table-resolution.md 中定义库表；
27. 在 docs/path-variable-resolution.md 中定义变量；
28. 在 docs/dependency-graph.md 中定义依赖图；
29. 在 docs/symbol-fingerprints.md 中定义 Symbol 指纹；
30. 在 docs/footprint-fingerprints.md 中定义 Footprint 指纹；
31. 在 docs/instance-library-drift.md 中定义漂移；
32. 在 docs/cache-pollution.md 中定义缓存污染；
33. 在 docs/pin-pad-validation.md 中定义映射；
34. 在 docs/duplicate-number-semantics.md 中定义重复语义；
35. 在 docs/manifest-and-lockfile.md 中定义锁文件；
36. 在 docs/repair-planning.md 中定义修复；
37. 在 docs/agent19-integration.md 中定义执行；
38. 在 docs/release-gates.md 中定义 Gate；
39. 在 docs/security.md 中定义安全；
40. 在 docs/eda-library-validation-migration-plan.md 中定义旧能力迁移；
41. 在 docs/eda-library-validation-benchmark-plan.md 中定义 Benchmark；
42. 给出拟新增、拟修改和拟复用文件；
43. 给出 Phase 1 精确范围；
44. 不修改业务代码；
45. 不创建数据库 Migration；
46. 不安装依赖；
47. 不访问远程库；
48. 不调用 Agent 19 写操作；
49. 不读取或打印 Secret；
50. 运行当前仓库已有 lint、type check、test、build 和 security scan；
51. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/19 Contract；
- KiCad 9/10/Legacy 支持；
- Library Table 和 Path Variable；
- Dependency Graph；
- Symbol/Footprint/3D Inventory；
- Fingerprint；
- Instance Drift；
- Cache Pollution；
- Pin-Pad Model；
- Duplicate Number Semantics；
- Variant/Multi-unit/Hidden Pin；
- Issue/Severity/Impact；
- Repair Eligibility；
- Recovery Library；
- Patch DSL；
- Agent 19 Execution；
- Post-repair Verification；
- Manifest/Lockfile；
- Release Gate；
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

# 96. 后续 Phase 提示词模板

```text
继续实现 EDA Library Validation Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16、19、20 规格；
3. 阅读 EDA Library Validation Implementation Plan；
4. 阅读 Dependency、Table、Path、Fingerprint、Drift、Pin-Pad、Repair、Lockfile、Security 和 Benchmark 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Declared/Resolved/Embedded/Approved Separation；
- Reproducible Resolution Context；
- Versioned Fingerprints；
- Raw Pin/Pad Numbers；
- Duplicate Semantics；
- Pin-to-Net Conservation；
- Workspace-only Repair；
- Agent 19 Execution；
- Agent 16 Reparse；
- Lockfile Replay；
- No Remote Auto-download；
- 不公开真实工程和库；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. resolution/fingerprint test；
10. pin-pad/duplicate test；
11. repair/rollback test；
12. Agent 16/19 contract test；
13. lockfile replay test；
14. security test；
15. performance test；
16. benchmark；
17. 更新文档；
18. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Resolution/Fingerprint/Rule 变化；
- 测试命令和真实结果；
- Dependency Coverage；
- Drift Results；
- Pin-Pad Metrics；
- Repair Eligibility；
- Agent 19/16 Verification；
- Lockfile Replay；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 97. MVP 演示流程

1. 上传一个 KiCad 10 四页原理图和两层 PCB 工程；
2. Agent 16解析工程；
3. Agent 20读取工程库表；
4. 解析 `${KIPRJMOD}`；
5. 发现 `ProjectSymbols` 指向项目本地库；
6. 发现 `Device` 来自全局库 Snapshot；
7. 发现 `CustomFootprints` 的绝对路径指向原作者电脑；
8. 识别 PCB 中仍有三个该库的 Footprint Instance；
9. 外部 `.pretty` 不存在；
10. 生成 `embedded/instance-only` 依赖状态；
11. 从 PCB Instance 为三个封装生成 Recovery Candidate；
12. 一个封装在多个 RefDes 中语义 Hash 相同，只生成一个库对象；
13. 创建项目本地 `recovered-footprints.pretty` 方案；
14. 发现 U3 的 Embedded Symbol 与当前企业库同名但 Pin 7、8 对调；
15. 标记 `pinset_drift` 和 Critical Conflict；
16. 不自动同步到企业库；
17. 发现 R1 的符号图形与库不同，但 Pin Set 完全一致；
18. 标记 `graphics_drift_only` Warning；
19. 发现 J1 使用 6 Pin Symbol 和 8 Pad Footprint；
20. Pad 7、8 被分类为 Mechanical Shield；
21. Pin-Pad 判定为 `complete_with_exceptions`；
22. 发现 U5 Pin 5 无对应 Pad；
23. 生成 `symbol_pin_without_pad` Error；
24. 发现 U6 的 Exposed Pad 使用多个 Pad Object 同号 9；
25. 根据 Footprint Rule 判为合法 Shared Pad；
26. 发现 U7 两个 Pin 都编号 4，但没有 Stacked/Equivalent 证据；
27. 生成 `duplicate_number_ambiguous`；
28. 生成 Dependency Graph；
29. 生成 Manifest 和 Lockfile；
30. Repair Plan 选择：
31. 把绝对 Footprint 路径迁移到 `${KIPRJMOD}`；
32. Vendor 三个 PCB Instance 为 Recovery Footprint；
33. 添加工程 `fp-lib-table` Entry；
34. 不处理 U3 Pin Swap；
35. 不处理 U5/U7，进入人工审核；
36. Agent 19 在 Workspace 中执行低风险 Patch；
37. Agent 16重新解析；
38. Agent 20重新扫描；
39. Missing Footprint 问题关闭；
40. Footprint UUID、位置、Pad Net 和 Routing 全部不变；
41. ERC/DRC 无新增 Error；
42. Lockfile Replay 成功；
43. U3/U5/U7 仍阻断 Manufacturing Gate；
44. 工程师确认 U5 应改用另一个封装；
45. 新 Repair Plan 显示 Pad Set 和 Routing 影响；
46. 用户批准后 Agent 19执行 Footprint Replacement；
47. 回读发现 Pad Set 变化但 Net Mapping 符合批准结果；
48. DRC 发现一条新 Clearance Error；
49. Agent 19回滚该高风险修复；
50. 原工程恢复；
51. 生成完整 Audit Report；
52. 发布 `eda-library.scan.completed-with-findings`。

---

# 98. 生产上线顺序

第一阶段：

```text
Agent 16 Input
Library Tables / Paths
Dependency Graph
Packed/Unpacked Symbol
Pretty/Footprint
Missing Dependency
Basic Pin-Pad
Manifest/Lockfile
Report-only CI
```

第二阶段：

```text
Instance Drift
Cache Pollution
Legacy Cache/Rescue
Duplicate Semantics
Recovery Library
Patch-only
Agent 19 Preview
```

第三阶段：

```text
Low-risk Auto-fix
Enterprise Registry
Remote Cached Provider
Variant/Multi-unit Advanced Rules
Manufacturing Release Gate
Other EDA Formats
```

上线优先确保：

```text
工程究竟依赖哪一份库
当前实例和库是不是同一个定义
Pin 与 Pad 的对应关系是否可靠
重复编号究竟是设计需要还是数据错误
修复后有没有改变任何电气连接
```

这个 Agent 最怕的不是“缺一个封装”——缺失通常很显眼。真正危险的是工程仍能正常打开，但它在另一台电脑、另一版 KiCad 或更新后的全局库上，悄悄解析成了另一套 Pin 和 Pad。第20个 Agent 的价值，就是让这种安静的漂移在进入 PCB、制造和测试之前先亮红灯。
