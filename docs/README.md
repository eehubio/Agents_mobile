# EEAgent 智能体与设计方案 Markdown 映射表

| Agent | 智能体 | 分类 | PWA 文档 | 原始 Markdown | 大小 |
|---:|---|---|---|---|---:|
| 1 | Datasheet 资产接入 | 器件与资产 | `docs/agent-01.md` | `datasheet_asset_ingestion_agent_codex_spec.md` | 32.3 KB |
| 2 | PDF 解析与 OCR 路由 | 器件与资产 | `docs/agent-02.md` | `pdf_parsing_ocr_router_agent_codex_spec.md` | 63.7 KB |
| 3 | 器件分类与 Schema 路由 | 器件与资产 | `docs/agent-03.md` | `component_classification_schema_router_agent_codex_spec.md` | 55.2 KB |
| 4 | 管脚、表格与图片定位 | 器件与资产 | `docs/agent-04.md` | `datasheet_structure_visual_locator_agent_codex_spec.md` | 62.5 KB |
| 5 | 参数抽取与单位归一 | 器件与资产 | `docs/agent-05.md` | `parameter_extraction_unit_normalization_agent_codex_spec.md` | 69.2 KB |
| 6 | 引脚、封装与订货型号 | 器件与资产 | `docs/agent-06.md` | `pin_package_ordering_agent_codex_spec.md` | 50.8 KB |
| 7 | 证据锚定与人工审核 | 器件与资产 | `docs/agent-07.md` | `evidence_anchoring_human_review_agent_codex_spec.md` | 47.7 KB |
| 8 | KiCad 原理图符号生成 | 器件与资产 | `docs/agent-08.md` | `kicad_symbol_generation_agent_codex_spec.md` | 61.8 KB |
| 9 | 封装、3D 与库资产生成 | 器件与资产 | `docs/agent-09.md` | `kicad_footprint_3d_mapping_agent_codex_spec.md` | 65.1 KB |
| 10 | 工程需求结构化 | 需求与方案 | `docs/agent-10.md` | `engineering_requirements_structuring_agent_codex_spec.md` | 88.6 KB |
| 11 | 项目拆解与里程碑 | 需求与方案 | `docs/agent-11.md` | `project_decomposition_milestone_orchestration_agent_codex_spec.md` | 113.2 KB |
| 12 | 功能架构与框图 | 需求与方案 | `docs/agent-12.md` | `functional_architecture_block_diagram_agent_codex_spec.md` | 113.8 KB |
| 13 | 参考设计与功能模块推荐 | 需求与方案 | `docs/agent-13.md` | `reference_design_function_module_recommendation_agent_codex_spec.md` | 122.0 KB |
| 14 | 元器件选型优化 | 需求与方案 | `docs/agent-14.md` | `component_selection_optimization_agent_codex_spec.md` | 131.5 KB |
| 15 | 接口、电源与兼容性检查 | 需求与方案 | `docs/agent-15.md` | `interface_power_compatibility_agent_codex_spec.md` | 122.1 KB |
| 16 | KiCad / EDA 工程解析 | EDA 工程 | `docs/agent-16.md` | `kicad_eda_project_parser_agent_codex_spec.md` | 86.0 KB |
| 17 | PDF / 图片原理图识别 | EDA 工程 | `docs/agent-17.md` | `pdf_image_schematic_recognition_agent_codex_spec.md` | 79.7 KB |
| 18 | Netlist 重建 | EDA 工程 | `docs/agent-18.md` | `netlist_reconstruction_agent_codex_spec.md` | 90.4 KB |
| 19 | KiCad MCP 执行 | EDA 工程 | `docs/agent-19.md` | `kicad_mcp_execution_agent_codex_spec.md` | 93.1 KB |
| 20 | EDA 库依赖与 Pin-Pad 校验 | EDA 工程 | `docs/agent-20.md` | `eda_library_dependency_pin_pad_validation_agent_codex_spec.md` | 96.3 KB |
| 21 | 固件与驱动框架生成 | EDA 工程 | `docs/agent-21.md` | `firmware_driver_framework_generation_agent_codex_spec.md` | 96.0 KB |
| 22 | ERC 与 AI 原理图审查 | EDA 工程 | `docs/agent-22.md` | `erc_ai_schematic_review_agent_codex_spec.md` | 91.1 KB |
| 23 | 电路仿真与结果解读 | EDA 工程 | `docs/agent-23.md` | `circuit_simulation_result_interpretation_agent_codex_spec.md` | 93.7 KB |
| 24 | PCB 约束提取 | PCB 设计制造 | `docs/agent-24.md` | `pcb_constraint_extraction_agent_codex_spec.md` | 105.4 KB |
| 25 | PCB 初步布局 | PCB 设计制造 | `docs/agent-25.md` | `pcb_preliminary_layout_agent_codex_spec.md` | 76.4 KB |
| 26 | PCB 自动布线 | PCB 设计制造 | `docs/agent-26.md` | `pcb_automatic_routing_agent_codex_spec.md` | 79.0 KB |
| 27 | DRC / SI / PI / EMC 审查 | PCB 设计制造 | `docs/agent-27.md` | `drc_si_pi_emc_review_agent_codex_spec.md` | 94.2 KB |
| 28 | 3D 与机械干涉 | PCB 设计制造 | `docs/agent-28.md` | `3d_mechanical_interference_agent_codex_spec.md` | 103.4 KB |
| 29 | 生产文件生成 | PCB 设计制造 | `docs/agent-29.md` | `pcb_production_file_generation_agent_codex_spec.md` | 103.9 KB |
| 30 | DFM / DFA 制造可行性 | PCB 设计制造 | `docs/agent-30.md` | `dfm_dfa_manufacturability_agent_codex_spec.md` | 102.7 KB |
| 31 | BOM 接入与标准化 | BOM / 供应链 / 采购 | `docs/agent-31.md` | `bom_intake_normalization_agent_codex_spec.md` | 52.1 KB |
| 32 | MPN 精准匹配 | BOM / 供应链 / 采购 | `docs/agent-32.md` | `mpn_precision_matching_agent_codex_spec.md` | 53.9 KB |
| 33 | 器件替代推荐 | BOM / 供应链 / 采购 | `docs/agent-33.md` | `component_alternative_recommendation_agent_codex_spec.md` | 68.4 KB |
| 34 | 生命周期 / EOL / PCN | BOM / 供应链 / 采购 | `docs/agent-34.md` | `lifecycle_eol_pcn_agent_codex_spec.md` | 56.6 KB |
| 35 | 合规、原产地与关税 | BOM / 供应链 / 采购 | `docs/agent-35.md` | `compliance_origin_tariff_agent_codex_spec.md` | 67.9 KB |
| 36 | 实时价格与库存 | BOM / 供应链 / 采购 | `docs/agent-36.md` | `realtime_pricing_inventory_agent_codex_spec.md` | 60.5 KB |
| 37 | BOM 风险与多源供应 | BOM / 供应链 / 采购 | `docs/agent-37.md` | `bom_risk_multisourcing_agent_codex_spec.md` | 59.3 KB |
| 38 | MOQ / SPQ / 采购包优化 | BOM / 供应链 / 采购 | `docs/agent-38.md` | `moq_spq_packaging_optimization_agent_codex_spec.md` | 71.1 KB |
| 39 | 成本、报价与利润 | BOM / 供应链 / 采购 | `docs/agent-39.md` | `cost_quote_profit_agent_codex_spec.md` | 75.8 KB |
| 40 | 采购计划与缺料协同 | BOM / 供应链 / 采购 | `docs/agent-40.md` | `procurement_planning_shortage_collaboration_agent_codex_spec.md` | 80.8 KB |
| 41 | 库存复用与呆滞料 | BOM / 供应链 / 采购 | `docs/agent-41.md` | `inventory_reuse_excess_obsolete_agent_codex_spec.md` | 81.7 KB |
| 42 | 物料与批次追溯 | BOM / 供应链 / 采购 | `docs/agent-42.md` | `material_lot_traceability_agent_codex_spec.md` | 68.1 KB |
| 43 | EBOM / MBOM 与 NPI 转换 | BOM / 供应链 / 采购 | `docs/agent-43.md` | `ebom_mbom_npi_conversion_agent_codex_spec.md` | 86.7 KB |
| 44 | PCB / SMT 制造询价与下单 | BOM / 供应链 / 采购 | `docs/agent-44.md` | `pcb_smt_manufacturing_rfq_order_agent_codex_spec.md` | 95.9 KB |
| 45 | 来料、生产与测试质量 | BOM / 供应链 / 采购 | `docs/agent-45.md` | `incoming_production_test_quality_agent_codex_spec.md` | 91.9 KB |
| 46 | LabSight 现场调试 | 调试与变更闭环 | `docs/agent-46.md` | `labsight_field_debugging_agent_codex_spec.md` | 130.7 KB |
| 47 | 工程变更与问题闭环 | 调试与变更闭环 | `docs/agent-47.md` | `engineering_change_issue_closure_agent_codex_spec.md` | 128.6 KB |

## 页面行为

- 点击智能体卡片或“查看设计方案”按钮，打开内置 Markdown 阅读器。
- 阅读器支持目录、阅读进度、文内搜索、字号切换、上一篇/下一篇与 Markdown 下载。
- PWA 包会缓存全部 47 份设计方案，可在安装后离线查看。
- 单文件 HTML 版本将 47 份 Markdown 直接嵌入页面，适合不部署时直接打开。

## 更新方法

1. 修改某个 Agent 的原始 Markdown。
2. 将内容同步替换到 PWA 包中的 `docs/agent-XX.md`。
3. 更新 `docs/index.json` 中的文件大小或版本信息。
4. 修改 `sw.js` 的缓存版本号并重新部署。