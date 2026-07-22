# 固件与驱动框架生成 Agent：设计方案与 Codex 实施规格

> 项目：ezPLM / EEAgent  
> Agent 编号：21  
> Agent 名称：Firmware, BSP, Driver & Protocol Framework Generation Agent  
> 中文名称：固件与驱动框架生成 Agent  
> 类型：混合型（规则与约束求解 + 模板生成 + 平台工具编排 + 可选 AI 辅助）  
> 版本：V1.0  
> 技术资料基线日期：2026-07-20  
>
> 定位：根据 MCU/MPU、板级原理图、Pin-to-Net、PinMux、时钟树、外设实例、接口器件、通信协议、RTOS 与工具链要求，生成可追溯、可重复构建的 BSP、HAL/LL 适配层、驱动模板、初始化代码、任务框架、通信协议框架、示例程序、测试桩和工程配置；通过官方配置工具、SDK、编译器、静态分析和可选板级测试验证生成结果。
>
> 上游：
> - Agent 16：Project IR、Schematic IR、PCB IR、Part IR、Net IR
> - Agent 18：Reviewed Netlist、Pin-to-Net
> - Agent 20：库依赖与 Pin-Pad 校验结果
> - Agent 19：KiCad 工程修改、设计版本和执行结果
> - MCU/MPU 数据库、器件数据手册、SVD、CMSIS-Pack、厂商 SDK 和 Board Definition
> - 用户的软件需求、协议需求、实时性、功耗、安全和工具链约束
> - ezPLM 项目、BOM、版本、测试计划和企业代码规范
>
> 下游：
> - 固件仓库、CI、制品仓库和设备烧录流程
> - 后续代码审核、静态分析、单元测试、HIL、调试和发布 Agent
> - Agent 31/32：软件依赖与硬件型号关联
> - Agent 43：NPI、烧录、测试和生产配置
> - Agent 45：ICT/FCT、固件测试点和测试协议
> - Agent 42：批次、固件版本和成品追溯
>
> 核心输出：
> - Hardware-to-Firmware Input Snapshot
> - MCU Capability Snapshot
> - Board IR
> - PinMux IR
> - Clock IR
> - Peripheral IR
> - Interrupt/DMA/Timer Resource Plan
> - Firmware Project IR
> - BSP
> - Driver Interface and Driver Skeleton
> - Initialization Graph
> - RTOS Task/Event Plan
> - Protocol Framework
> - Example Applications
> - Build System and Toolchain Files
> - Dependency Manifest and Lockfile
> - Generated-code Manifest
> - Compile/Test/Static-analysis Report
> - Optional Flash/HIL Report
> - Repair/Regeneration Patch
>
> 重要边界：
> - 本 Agent 不凭自然语言猜 MCU PinMux、时钟、DMA 或中断能力；必须来自批准的 Device Metadata、官方工具输出或人工确认。
> - 原理图 Net 名称不自动等于软件功能；`SCL`、`TX`、`PWM` 等名称只能形成候选，需要 Pin、外设实例和用户意图共同确认。
> - V1 默认生成“可编译、可审查的框架与初始化代码”，不承诺自动完成产品级全部业务逻辑。
> - 通用 LLM 可辅助生成注释、示例业务逻辑和协议处理草稿，但不能覆盖 PinMux、Clock、DMA、IRQ、Memory Map 和安全配置。
> - 生成代码与人工代码必须分区；再生成不能覆盖用户代码。
> - 所有生成结果必须绑定 MCU 完整型号、封装、SDK/Toolchain 版本、模板版本、输入硬件 Revision 和配置 Hash。
> - 不自动下载未批准 SDK、编译器、Pack 或组件。
> - 不自动执行工程内脚本、Post-build 命令或任意 Shell。
> - 烧录、Fuse、Option Byte、Secure Boot、Flash Encryption 和量产密钥操作必须独立授权。
> - 不把私有原理图、源代码、协议密钥和生产凭据发送给外部通用模型。

---

# 1. Agent 21 的系统位置

```text
EDA / Netlist / MCU / Requirements
              ↓
Hardware-to-Firmware Normalization
              ↓
Board + PinMux + Clock + Peripheral IR
              ↓
Resource Validation and Planning
              ↓
Firmware Project IR
              ↓
Platform/SDK Adapter
              ↓
Code + Build + Tests
              ↓
Compile / Static Analysis / Optional HIL
              ↓
Review / Commit / Release Handoff
```

## 1.1 与 Agent 16、18、20 的关系

Agent 16/18/20提供：

```text
MCU Part
Package
RefDes
Pin Number
Pin Name
Pin-to-Net
Connected Peripheral Parts
Validated Pin-Pad
Hardware Revision
```

Agent 21将其转换为：

```text
software signal
MCU alternate function
peripheral instance
driver binding
initialization dependency
runtime API
```

## 1.2 与 Agent 19 的关系

Agent 21发现硬件需求与 EDA 不一致时，不直接修改 KiCad，而生成：

```text
hardware change request
pin reassignment candidate
missing pull-up warning
missing transceiver warning
clock-source conflict
```

由 Agent 19在受控流程中修改工程。

---

# 2. 当前生态技术基线

## 2.1 CMSIS 与 CMSIS-Pack

对于 Arm Cortex-M 生态，CMSIS 可提供：

```text
Core headers
Device headers
startup/system files
SVD
RTOS APIs
DSP/NN optional
Pack metadata
```

CMSIS-Pack 可作为设备、组件、示例和依赖元数据来源之一，但必须锁定：

```text
vendor
pack name
pack version
artifact hash
license
```

## 2.2 厂商配置和代码生成工具

可能包括：

```text
STM32CubeMX / CubeMX CLI
MCUXpresso Config Tools
MPLAB Code Configurator
TI SysConfig
Renesas Smart Configurator
Nordic Devicetree/Kconfig tooling
Silicon Labs Configurator
```

它们属于版本化 Backend，不是统一业务 API。

## 2.3 RTOS 与 Devicetree

Zephyr 等系统通过：

```text
Board Definition
Devicetree
Binding
Kconfig
West/CMake
```

描述硬件和组件。

本 Agent 应生成或修改结构化配置，而不是仅生成散落的 C 文件。

## 2.4 厂商 SDK

重点适配范围建议：

```text
STM32 HAL/LL + FreeRTOS
ESP-IDF
Raspberry Pi Pico SDK for RP2040/RP2350
Zephyr
CMSIS bare-metal
NXP MCUXpresso SDK
Nordic nRF Connect SDK
```

后续再增加：

```text
Arduino Core
Mbed-compatible legacy projects
MicroPython board port
Linux Device Tree / U-Boot
FPGA soft-core SDK
```

## 2.5 组件管理

不同平台依赖形式不同：

```text
CMSIS-Pack
West Modules
ESP-IDF Component Manager
CMake Fetch/Package
Git Submodule
Vendor SDK Components
Conan/vcpkg only where appropriate
```

必须统一映射到 Dependency Manifest 和 Lockfile。

---

# 3. 建设目标

系统必须能够：

1. 接收 MCU 完整型号；
2. 接收 MCU 封装；
3. 接收 MCU Revision/Variant；
4. 接收 Board Revision；
5. 接收 Agent 16 Part/Net IR；
6. 接收 Agent 18 Pin-to-Net；
7. 接收 Agent 20 Pin-Pad 校验；
8. 接收 MCU Pin Definition；
9. 接收 Alternate Function 表；
10. 接收 Clock Tree；
11. 接收 Reset/Boot 配置；
12. 接收 Memory Map；
13. 接收 DMA Request Mapping；
14. 接收 Interrupt Vector；
15. 接收 Timer/Channel Mapping；
16. 接收 ADC Channel；
17. 接收 Comparator/Opamp/DAC 资源；
18. 接收 TrustZone/Security Domain 能力；
19. 接收低功耗和 Wakeup 能力；
20. 接收板载晶振和时钟源；
21. 接收电源域和电压；
22. 接收外接 Flash/PSRAM/EEPROM；
23. 接收调试接口；
24. 接收 Bootloader 接口；
25. 接收接口器件；
26. 接收传感器和执行器；
27. 接收用户需求；
28. 接收目标语言；
29. 接收目标 SDK；
30. 接收 RTOS；
31. 接收编译器；
32. 接收 IDE/构建系统；
33. 接收代码规范；
34. 接收安全配置；
35. 建立不可变输入快照；
36. 建立 MCU Capability Snapshot；
37. 建立 Board IR；
38. 建立 Signal IR；
39. 建立 Pin Assignment；
40. 建立 PinMux IR；
41. 建立 Clock IR；
42. 建立 Peripheral IR；
43. 建立 DMA Plan；
44. 建立 IRQ Plan；
45. 建立 Timer Resource Plan；
46. 建立 Memory Plan；
47. 建立 Power Plan；
48. 建立 Debug/Boot Plan；
49. 建立 Driver Binding；
50. 建立 Initialization Graph；
51. 建立 Runtime Ownership；
52. 建立 Concurrency Model；
53. 建立 RTOS Task Plan；
54. 建立 Event/Queue/Semaphore Plan；
55. 建立 Protocol IR；
56. 建立 Configuration IR；
57. 识别 PinMux 冲突；
58. 识别同 Pin 多功能冲突；
59. 识别同 Peripheral 多实例冲突；
60. 识别非法 Alternate Function；
61. 识别封装不可用 Pin；
62. 识别电气不兼容；
63. 识别 Open-drain 需求；
64. 识别 Pull-up/Pull-down 需求；
65. 识别 5V Tolerance；
66. 识别模拟/数字冲突；
67. 识别 Boot Strap 冲突；
68. 识别 Debug Pin 占用；
69. 识别晶振 Pin 占用；
70. 识别 USB 专用 Pin；
71. 识别高速接口专用 Pin；
72. 识别时钟源缺失；
73. 识别 PLL 参数非法；
74. 识别总线时钟超限；
75. 识别外设时钟缺失；
76. 识别 Flash Wait State 要求；
77. 识别 DMA Request 冲突；
78. 识别 DMA Channel/Stream 冲突；
79. 识别 IRQ Priority 冲突；
80. 识别 RTOS API 优先级限制；
81. 识别 Timer Channel 冲突；
82. 识别 PWM Frequency/Resolution 不可达；
83. 识别 ADC Sampling Time 不足；
84. 识别 ADC Source Impedance 风险；
85. 识别 Memory 溢出；
86. 识别 Stack/Heap 不足；
87. 识别 Cache/DMA 一致性要求；
88. 识别低功耗 Wakeup 冲突；
89. 识别 Peripheral Ownership 冲突；
90. 识别多任务并发访问；
91. 识别 ISR 中非法阻塞操作；
92. 识别协议缓冲区不足；
93. 识别带宽不满足；
94. 识别 UART Baud 误差；
95. 识别 I2C 地址冲突；
96. 识别 SPI Mode/Clock 冲突；
97. 识别 CAN Bit Timing 冲突；
98. 识别 USB Role/Endpoint 冲突；
99. 识别网络接口 PHY 配置缺失；
100. 识别外部器件驱动缺失；
101. 生成 BSP；
102. 生成 Board Header；
103. 生成 Pin Alias；
104. 生成 Clock Init；
105. 生成 GPIO Init；
106. 生成 DMA Init；
107. 生成 NVIC/Interrupt Init；
108. 生成 Cache/MPU Init；
109. 生成 External Memory Init；
110. 生成 Peripheral Init；
111. 生成 Driver Interface；
112. 生成 Driver Skeleton；
113. 生成 HAL Adapter；
114. 生成 Mock Driver；
115. 生成 Unit Test；
116. 生成 Integration Test；
117. 生成 Example；
118. 生成 CLI/Shell Example；
119. 生成 Logging Framework；
120. 生成 Error Code；
121. 生成 Diagnostics；
122. 生成 Watchdog；
123. 生成 Reset Reason；
124. 生成 Boot Sequence；
125. 生成 RTOS Tasks；
126. 生成 Queue/Event；
127. 生成 Thread-safe Wrapper；
128. 生成 Protocol Encoder；
129. 生成 Protocol Decoder；
130. 生成 State Machine；
131. 生成 Timeout/Retry；
132. 生成 CRC/Checksum；
133. 生成 Framing；
134. 生成 Version Negotiation；
135. 生成 Configuration Storage；
136. 生成 OTA Skeleton；
137. 生成 Bootloader Handoff；
138. 生成 Sample Telemetry；
139. 生成 Build Files；
140. 生成 Linker Script Hook；
141. 生成 Partition Table；
142. 生成 Kconfig；
143. 生成 Devicetree Overlay；
144. 生成 CMake；
145. 生成 Ninja/Make Hook；
146. 生成 IDE Metadata；
147. 生成 SDK Configuration；
148. 生成 Dependency Manifest；
149. 生成 Lockfile；
150. 生成 SBOM；
151. 生成 README；
152. 生成 Pin Map 文档；
153. 生成 Peripheral Map 文档；
154. 生成 Memory Map 文档；
155. 生成 Protocol 文档；
156. 生成 API 文档；
157. 生成 Doxygen；
158. 生成 Change Manifest；
159. 生成 Traceability Matrix；
160. 支持 C；
161. 支持 C++；
162. 支持 Rust Adapter 预留；
163. 支持裸机；
164. 支持 FreeRTOS；
165. 支持 Zephyr；
166. 支持 ESP-IDF；
167. 支持 Pico SDK；
168. 支持 CMSIS；
169. 支持厂商 HAL/LL；
170. 支持多核 MCU；
171. 支持安全/非安全工程；
172. 支持 Bootloader/Application 分区；
173. 支持生成代码与用户代码分区；
174. 支持增量再生成；
175. 支持 Three-way Merge；
176. 支持 Patch；
177. 支持用户保护区；
178. 支持模板版本；
179. 支持 Platform Adapter；
180. 支持 Capability Discovery；
181. 支持官方工具编排；
182. 支持 Dry Run；
183. 支持 Preview；
184. 支持编译；
185. 支持静态分析；
186. 支持格式检查；
187. 支持单元测试；
188. 支持仿真测试；
189. 支持 QEMU/renode Hook；
190. 支持可选烧录；
191. 支持串口 Smoke Test；
192. 支持 HIL；
193. 支持逻辑分析仪/示波器验证 Hook；
194. 支持生成结果回读；
195. 支持制品 Hash；
196. 支持 Git Branch；
197. 支持审批；
198. 支持回滚；
199. 支持多租户；
200. 支持私有 Worker；
201. 不凭 Net 名自动决定外设；
202. 不凭 MCU 系列名称代替完整型号；
203. 不忽略封装差异；
204. 不硬编码未验证 Alternate Function；
205. 不自动解决高风险 PinMux 冲突；
206. 不自动改硬件；
207. 不自动更改 Fuse/Option Byte；
208. 不自动启用 Secure Boot/Flash Encryption；
209. 不自动生成或保存生产密钥；
210. 不自动烧录生产设备；
211. 不覆盖用户代码；
212. 不将编译成功等同功能正确；
213. 不伪造工具链、SDK、编译或测试结果；
214. 不在未锁定依赖时宣称可复现；
215. 不执行任意 Shell；
216. 不下载未批准组件；
217. 不发送私有代码和硬件资料给外部模型。

---

# 4. 核心架构

```text
Hardware/Requirements Intake
        ↓
Device Metadata & SDK Snapshot
        ↓
Board/Signal/PinMux/Clock/Peripheral IR
        ↓
Constraint Validation & Resource Planner
        ↓
Firmware Project IR
        ↓
Framework Profile Selection
        ↓
Platform Adapter + Template Engine
        ↓
Generated/Protected/User Code Layout
        ↓
Dependency Resolution & Lock
        ↓
Build / Static Analysis / Tests
        ↓
Optional Flash/HIL
        ↓
Review / Manifest / Commit
```

---

# 5. 数据分层

## 5.1 Hardware Facts

来自 EDA 和批准元数据：

```text
MCU model/package
pin number
pin electrical capability
net
connected device
oscillator
power
reset
boot
debug
```

## 5.2 Software Intent

来自用户或上游 Agent：

```text
UART console
I2C sensor bus
PWM motor
ADC acquisition
USB device
CAN protocol
RTOS
sampling rate
latency
power mode
```

## 5.3 Resolved Configuration

约束求解结果：

```text
PinMux
Clock
DMA
IRQ
Timer
Memory
Task
Driver
```

## 5.4 Generated Artifacts

```text
BSP
drivers
protocol
examples
build
tests
docs
```

这四层不能混为一个不可解释的 Prompt 输出。

---

# 6. Hardware-to-Firmware Input Snapshot

```json
{
  "snapshot_version": "1.0.0",
  "project_id": "uuid",
  "hardware_revision": "rev-b",
  "agent16_ir_hash": "sha256",
  "agent18_release_id": "uuid",
  "agent20_scan_id": "uuid",
  "mcu": {
    "manufacturer": "STMicroelectronics",
    "mpn": "STM32G4...",
    "package": "LQFP64"
  },
  "requirements": [],
  "device_metadata_snapshot": {},
  "requested_framework": "stm32-hal-freertos"
}
```

---

# 7. Device Metadata Snapshot

必须保存：

```text
device exact identity
package
core(s)
memory
pin list
alternate functions
electrical capability
clock tree
peripheral instances
DMA mapping
interrupt vectors
timer channels
ADC channels
boot/reset/security
SVD/Pack/SDK source
artifact hashes
versions
licenses
```

---

# 8. Device Metadata 来源优先级

```text
批准的厂商 Machine-readable Metadata
批准的 CMSIS Device Family Pack
官方 SDK/Headers/SVD
官方配置工具输出
ezPLM 结构化器件数据库
人工审核补丁
PDF 抽取候选
```

PDF 抽取结果未经审核不能作为自动 PinMux 真值。

---

# 9. Board IR

```json
{
  "board_ir_version": "1.0.0",
  "board_name": "openscope-rp2350b",
  "board_revision": "rev-a",
  "mcu_instances": [],
  "signals": [],
  "interfaces": [],
  "external_devices": [],
  "clocks": [],
  "power_domains": [],
  "debug_interfaces": [],
  "boot_configuration": [],
  "constraints": []
}
```

---

# 10. Signal IR

```text
signal id
net id/name
source/target endpoints
logical role candidates
voltage domain
direction
active level
pull requirement
drive/slew requirement
open-drain
interrupt capability
timing requirement
confidence
evidence
review status
```

---

# 11. Pin Assignment IR

```text
MCU refdes
package pin
port/pin
selected alternate function
peripheral instance
signal
mode
pull
speed/slew
drive
initial level
ownership
low-power state
source
confidence
```

---

# 12. Pin Assignment 状态

```text
explicit_user
explicit_hardware_label
device_tool_resolved
rule_resolved
reviewed
candidate
ambiguous
conflicting
unsupported
```

只有前五类可以进入自动代码生成。

---

# 13. PinMux Constraint

约束包括：

```text
one physical pin one active function
function available on exact package
peripheral instance consistency
debug/boot reservation
oscillator reservation
USB/high-speed dedicated pins
analog capability
voltage tolerance
open-drain
wake-up
board connection
user reservation
```

---

# 14. PinMux 求解

输入：

```text
required signals
allowed functions
preferred pins
reserved pins
package
peripheral grouping
routing/hardware facts
```

输出：

```text
resolved assignment
alternative solutions
unsatisfied constraints
cost/explanation
```

V1 推荐使用：

```text
规则过滤
+ constraint solver / SAT/CP-SAT optional
```

不得用 LLM 直接挑 Pin。

---

# 15. PinMux 优化目标

按优先级：

```text
遵守硬件现有连接
保持 Debug/Boot
保持同一 Peripheral Instance
满足高速/模拟要求
减少冲突
保持用户指定
减少软件复杂度
保留扩展资源
```

对于已有 PCB：

```text
不能为了软件便利改变实际连接
```

---

# 16. Clock IR

```text
clock source
frequency
tolerance
startup time
PLL/divider/mux
core clock
bus clocks
peripheral clocks
USB/CAN/audio accuracy
low-power clock
source evidence
```

---

# 17. Clock Validation

检测：

```text
source missing
frequency out of range
PLL VCO invalid
divider invalid
bus maximum exceeded
Flash latency mismatch
USB 48 MHz tolerance
CAN timing source
ADC clock limit
timer clock multiplication
low-power wake clock missing
```

---

# 18. Peripheral IR

```text
peripheral type
instance
mode
pins
clock
DMA
IRQ
configuration
connected device
driver binding
ownership
initialization dependencies
```

---

# 19. 外设范围

```text
GPIO
EXTI
UART/USART
SPI
I2C/I3C
CAN/FDCAN
USB
ADC
DAC
PWM/Timer
Input Capture
Encoder
RTC
Watchdog
RNG
CRC
DMA
SDIO/SDMMC
QSPI/OSPI
Ethernet
I2S/SAI
Camera
Display
Touch
Comparator
Opamp
Crypto
```

按 MCU 能力动态限制。

---

# 20. DMA Plan

```text
request source
controller
channel/stream
direction
priority
data width
circular/double buffer
memory region
cache policy
interrupt
owner
```

---

# 21. IRQ Plan

```text
interrupt vector
source
priority
subpriority
RTOS-safe threshold
handler ownership
deferred processing
shared vector
```

---

# 22. Timer Resource Plan

```text
timer instance
channel
base frequency
prescaler
period
mode
trigger
DMA/IRQ
master/slave relation
consumer
```

---

# 23. Memory Plan

```text
Flash regions
RAM banks
DMA-safe memory
cacheable/non-cacheable
stack
heap
RTOS objects
protocol buffers
frame buffers
external memory
bootloader/app
OTA slots
persistent storage
```

---

# 24. Firmware Project IR

```json
{
  "firmware_project_ir_version": "1.0.0",
  "target": {},
  "framework_profile": "zephyr",
  "toolchain": {},
  "board": {},
  "pinmux": [],
  "clocks": [],
  "peripherals": [],
  "drivers": [],
  "tasks": [],
  "protocols": [],
  "memory": {},
  "dependencies": [],
  "generation_regions": [],
  "validation_plan": []
}
```

---

# 25. Framework Profile

```text
cmsis-baremetal
vendor-hal-baremetal
vendor-hal-freertos
zephyr
esp-idf
pico-sdk-baremetal
pico-sdk-freertos
nrf-connect
mcuxpresso
custom-enterprise
```

---

# 26. Framework Profile 内容

```text
supported device families
SDK adapter
project layout
build system
configuration files
driver model
RTOS model
logging
error handling
test framework
dependency manager
generated/user code policy
validation backend
```

---

# 27. Platform Adapter

```python
class FirmwarePlatformAdapter:
    async def discover(self) -> CapabilitySnapshot: ...
    async def validate_device(self, device) -> ValidationResult: ...
    async def resolve_configuration(self, project_ir) -> ResolvedConfig: ...
    async def generate(self, project_ir, workspace) -> GeneratedManifest: ...
    async def build(self, workspace) -> BuildResult: ...
    async def test(self, workspace) -> TestResult: ...
    async def inspect(self, workspace) -> ReadbackResult: ...
```

---

# 28. Adapter Capability 状态

```text
supported
supported_with_conditions
generation_only
build_only
manual_tool_required
unsupported
unknown
disabled
```

`unknown` 不视为支持。

---

# 29. STM32 Adapter

可编排：

```text
STM32CubeMX project/config
CubeMX CLI
HAL/LL selection
FreeRTOS integration
startup/system/linker
Cube firmware package
STM32CubeIDE/CMake project
```

系统必须锁定：

```text
CubeMX version
firmware package version
toolchain
configuration file hash
generated file manifest
```

---

# 30. ESP-IDF Adapter

生成：

```text
CMake project
sdkconfig defaults
partition table
components
idf_component.yml
managed component lock
FreeRTOS tasks
drivers
examples
```

不得手工复制组件而绕过依赖 Manifest。

---

# 31. Pico SDK Adapter

支持：

```text
RP2040
RP2350 family
CMake
Pico SDK version
PIO programs
DMA
multicore
TinyUSB
board header
```

具体 Pin/PIO/DMA 能力来自锁定的 SDK 和设备元数据。

---

# 32. Zephyr Adapter

生成：

```text
board/board revision
devicetree
overlay
bindings only where custom hardware requires
Kconfig
prj.conf
CMake
west manifest
drivers or sensor wrappers
samples
```

优先复用已有 Binding/Driver，不重复造轮子。

---

# 33. CMSIS Bare-metal Adapter

生成：

```text
Device headers
startup
system init
vector table
linker
BSP
peripheral wrappers
main loop
interrupt dispatch
```

依赖 CMSIS-Pack 或批准 SDK Snapshot。

---

# 34. BSP 范围

```text
board identity
pin aliases
clock init
power init
reset/boot reason
debug console
LED/button
external memory
board revision
device registry
board-level init/deinit
```

---

# 35. Driver 分层

```text
Application
Protocol/Service
Device Driver Interface
Device Driver Implementation
Bus Driver
HAL Adapter
BSP/MCU SDK
```

避免业务代码直接散落调用厂商 HAL。

---

# 36. Driver Interface 示例

```c
typedef struct {
    int (*init)(void *ctx);
    int (*read)(void *ctx, void *buf, size_t len);
    int (*write)(void *ctx, const void *buf, size_t len);
    int (*ioctl)(void *ctx, unsigned long request, void *arg);
    int (*deinit)(void *ctx);
} ee_driver_api_t;
```

具体接口根据设备类型生成，不要求所有设备使用同一万能接口。

---

# 37. Driver Skeleton

包含：

```text
context/config
init/deinit
sync/async API
timeout
error mapping
thread safety
ISR callback
DMA completion
mock hooks
diagnostics
```

不自动实现未经验证的复杂器件算法。

---

# 38. 外设器件绑定

根据：

```text
外设 Part MPN
接口 Net
地址/Chip Select
Interrupt/Reset/Enable
Power Domain
数据手册驱动元数据
```

绑定 Driver Candidate。

最终选择需要：

```text
compatible device
approved driver version
license
framework compatibility
```

---

# 39. Initialization Graph

节点：

```text
clock
power domain
GPIO
bus
DMA
interrupt
external device
storage
protocol
application service
```

边：

```text
requires
must_initialize_before
shares_resource
owns
optional_dependency
```

必须检测循环。

---

# 40. 初始化阶段

```text
early_boot
system_clock
memory
board_power
core_peripherals
communication_buses
external_devices
storage
network
services
application
late_diagnostics
```

---

# 41. RTOS Task Plan

```text
task name
responsibility
priority
period/event
stack
core affinity
watchdog
owned peripherals
input/output queues
latency budget
```

---

# 42. 并发模型

```text
single-thread main loop
interrupt + main loop
cooperative tasks
preemptive RTOS
multi-core partition
```

驱动需要明确：

```text
single-owner
mutex-protected
message-passing
ISR-safe
```

---

# 43. Protocol IR

```text
transport
framing
message types
field schema
endianness
version
CRC
timeouts
retry
sequence
acknowledgement
state machine
security hooks
diagnostics
```

---

# 44. 协议范围

```text
UART binary/text
Modbus RTU/TCP skeleton
CAN/CANopen custom frame skeleton
USB CDC/HID vendor skeleton
BLE GATT skeleton
TCP/UDP
MQTT client skeleton
I2C/SPI device-side protocol
custom framed protocol
```

涉及认证或安全协议时，必须使用批准库，不自行实现密码算法。

---

# 45. Protocol Framework 输出

```text
message definitions
encoder/decoder
stream parser
state machine
timeout/retry
transport abstraction
unit tests
fuzz target
example
documentation
```

---

# 46. 示例程序

至少包括：

```text
board bring-up
GPIO blink/button
console
each enabled peripheral smoke test
external device ID read
loopback where possible
protocol echo/demo
low-power wake demo optional
```

---

# 47. 生成代码分区

推荐：

```text
generated/
  自动生成，不手工修改

adapters/
  平台和 HAL 适配，可再生成

app/
  用户业务代码，不覆盖

user/
  用户扩展和 Hook

tests/
  自动生成测试与用户测试
```

---

# 48. Protected Region

不优先依赖脆弱的注释保护区。

优先：

```text
文件级分区
接口/Hook
weak function only where platform appropriate
partial config
generated manifest
```

必须使用注释保护区时：

```text
稳定 Marker
Parser-based preservation
Nested marker rejection
Unclosed marker error
```

---

# 49. 增量再生成

输入变化：

```text
PinMux
Clock
Peripheral
Driver
Protocol
Template
SDK
User Config
```

输出：

```text
planned added files
modified generated files
preserved user files
deleted obsolete generated files
conflicts
```

---

# 50. Three-way Merge

比较：

```text
previous generated base
current workspace
new generated output
```

仅对允许合并的配置或生成文件使用。

冲突进入人工审核，不覆盖。

---

# 51. Generated Manifest

保存：

```text
file path
file role
generated/user/protected
template id/version
input hash
content hash
generator version
regeneration policy
```

---

# 52. Dependency Manifest

统一保存：

```text
SDK
Pack
toolchain
RTOS
component/module
driver
test library
code generator
artifact hash
source
license
```

---

# 53. Firmware Lockfile

```json
{
  "lock_version": "1.0.0",
  "target": "exact-mcu-package",
  "framework": "esp-idf",
  "dependencies": [],
  "toolchain": {},
  "generators": [],
  "templates": []
}
```

---

# 54. 构建环境

推荐使用：

```text
Container image digest
or private reproducible worker image
```

保存：

```text
OS
compiler
linker
SDK
Python/Java runtime for vendor tool
CMake/Ninja
environment variables
license references
```

---

# 55. Build Gate

必须检查：

```text
configuration generation success
compile success
link success
memory usage
warnings policy
undefined symbols
duplicate symbols
generated files match manifest
dependency lock valid
```

---

# 56. 编译成功不是最终成功

还需要按项目选择：

```text
unit tests
static analysis
host tests
emulation
flash
serial smoke
HIL
timing measurement
power measurement
```

---

# 57. 静态分析

可集成：

```text
compiler warnings
clang-tidy
cppcheck
MISRA tool optional
include-what-you-use optional
stack analysis
cyclomatic complexity
```

工具必须版本化，结果不能伪造。

---

# 58. 单元测试

生成：

```text
driver mock
protocol encode/decode
state machine
timeout/retry
configuration validation
CRC vectors
ring buffer
```

硬件寄存器访问通过 Adapter 隔离。

---

# 59. Fuzz 测试

优先目标：

```text
protocol decoder
stream parser
configuration parser
command shell
file/network input
```

不对真实硬件寄存器直接 Fuzz。

---

# 60. HIL

可选流程：

```text
reserve test board
flash debug image
reset
capture serial
exercise interface
measure expected response
collect logs
restore board
```

---

# 61. HIL 安全

- 默认实验板，不是生产设备；
- Board ID 和 Revision 明确；
- 烧录前验证 MCU；
- 禁止生产密钥；
- Fuse/Option Byte 默认只读；
- 供电、电流和执行器安全限制；
- 超时断电；
- 完整审计。

---

# 62. Code Generation Request

```json
{
  "generation_request_id": "uuid",
  "project_id": "uuid",
  "hardware_revision": "rev-a",
  "target": {
    "mcu_mpn": "RP2350B",
    "package": "QFN-80"
  },
  "framework_profile": "pico-sdk-freertos",
  "features": [
    "usb_cdc",
    "dual_adc_capture",
    "pwm",
    "i2c_sensors"
  ],
  "validation": [
    "build",
    "unit_test",
    "static_analysis"
  ]
}
```

---

# 63. Generation Result

```json
{
  "generation_job_id": "uuid",
  "status": "completed_with_warnings",
  "summary": {
    "generated_files": 68,
    "drivers": 9,
    "tasks": 5,
    "protocols": 2,
    "build_warnings": 3,
    "tests_passed": 74,
    "tests_failed": 0
  },
  "artifacts": {
    "source_bundle_uri": "s3://...",
    "manifest_uri": "s3://...",
    "build_report_uri": "s3://..."
  }
}
```

---

# 64. 状态机

```text
RECEIVED
→ VALIDATING_INPUT
→ RESOLVING_DEVICE_METADATA
→ SNAPSHOTTING_TOOLCHAIN
→ BUILDING_BOARD_IR
→ RESOLVING_PINMUX
→ RESOLVING_CLOCKS
→ PLANNING_RESOURCES
→ VALIDATING_CONFIGURATION
→ BUILDING_FIRMWARE_PROJECT_IR
→ SELECTING_PLATFORM_ADAPTER
→ GENERATING_CONFIGURATION
→ GENERATING_CODE
→ RESOLVING_DEPENDENCIES
→ BUILDING
→ STATIC_ANALYSIS
→ UNIT_TESTING
→ OPTIONAL_FLASH
→ OPTIONAL_HIL
→ GENERATING_REPORT
→ COMPLETED
```

分支：

```text
COMPLETED_WITH_WARNINGS
REVIEW_REQUIRED
PARTIAL
INPUT_INVALID
DEVICE_METADATA_MISSING
PINMUX_CONFLICT
CLOCK_CONFLICT
DMA_CONFLICT
IRQ_CONFLICT
MEMORY_CONFLICT
SDK_UNAVAILABLE
TOOLCHAIN_UNAVAILABLE
GENERATION_CONFLICT
USER_CODE_CONFLICT
BUILD_FAILED
TEST_FAILED
FLASH_BLOCKED
HIL_FAILED
FAILED_TEMPORARY
FAILED_PERMANENT
CANCELLED
```

---

# 65. 错误码

```text
PROJECT_NOT_FOUND
HARDWARE_REVISION_MISMATCH
AGENT16_IR_NOT_FOUND
AGENT18_NETLIST_NOT_READY
AGENT20_PIN_PAD_BLOCKED
MCU_MPN_MISSING
MCU_PACKAGE_MISSING
DEVICE_METADATA_NOT_FOUND
DEVICE_METADATA_VERSION_UNAPPROVED
PIN_NOT_FOUND
PIN_NOT_AVAILABLE_IN_PACKAGE
ALTERNATE_FUNCTION_INVALID
PINMUX_CONFLICT
DEBUG_PIN_CONFLICT
BOOT_PIN_CONFLICT
OSCILLATOR_PIN_CONFLICT
ELECTRICAL_CAPABILITY_CONFLICT
CLOCK_SOURCE_MISSING
PLL_CONFIGURATION_INVALID
BUS_CLOCK_EXCEEDED
PERIPHERAL_CLOCK_INVALID
DMA_REQUEST_UNAVAILABLE
DMA_RESOURCE_CONFLICT
IRQ_VECTOR_CONFLICT
IRQ_PRIORITY_INVALID
TIMER_RESOURCE_CONFLICT
ADC_CONFIGURATION_INVALID
UART_BAUD_ERROR_EXCEEDED
I2C_ADDRESS_CONFLICT
SPI_CONFIGURATION_CONFLICT
CAN_TIMING_INVALID
USB_CONFIGURATION_CONFLICT
MEMORY_REGION_CONFLICT
FLASH_OVERFLOW
RAM_OVERFLOW
STACK_BUDGET_INVALID
CACHE_DMA_POLICY_MISSING
DRIVER_NOT_FOUND
DRIVER_LICENSE_BLOCKED
DRIVER_FRAMEWORK_INCOMPATIBLE
SDK_NOT_FOUND
SDK_VERSION_UNAPPROVED
TOOLCHAIN_NOT_FOUND
TOOLCHAIN_VERSION_UNAPPROVED
FRAMEWORK_PROFILE_UNSUPPORTED
DEPENDENCY_RESOLUTION_FAILED
LOCKFILE_INVALID
TEMPLATE_NOT_FOUND
TEMPLATE_VERSION_UNAPPROVED
GENERATED_REGION_CONFLICT
USER_CODE_MODIFIED_GENERATED_FILE
THREE_WAY_MERGE_CONFLICT
CONFIG_GENERATION_FAILED
COMPILE_FAILED
LINK_FAILED
STATIC_ANALYSIS_FAILED
UNIT_TEST_FAILED
FLASH_PERMISSION_REQUIRED
TARGET_IDENTITY_MISMATCH
HIL_RESOURCE_UNAVAILABLE
HIL_TEST_FAILED
ARTIFACT_VALIDATION_FAILED
JOB_CANCELLED
INTERNAL_ERROR


---

# 66. 数据库设计

## 66.1 `firmware_generation_jobs`

```text
id UUID PK
tenant_id UUID NOT NULL
project_id UUID NOT NULL
hardware_revision VARCHAR NOT NULL
agent16_ir_bundle_id UUID NOT NULL
agent18_release_id UUID NULL
agent20_scan_id UUID NULL
framework_profile VARCHAR NOT NULL
requested_features JSONB NOT NULL
requested_validations JSONB NOT NULL
generation_policy_version VARCHAR NOT NULL
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

## 66.2 `firmware_input_snapshots`

```text
id UUID PK
generation_job_id UUID NOT NULL
hardware_revision VARCHAR NOT NULL
agent16_ir_hash CHAR(64) NOT NULL
agent18_release_hash CHAR(64) NULL
agent20_report_hash CHAR(64) NULL
requirements_uri TEXT NOT NULL
requirements_hash CHAR(64) NOT NULL
device_metadata_snapshot_id UUID NOT NULL
toolchain_snapshot_id UUID NULL
framework_profile_version VARCHAR NOT NULL
template_bundle_version VARCHAR NOT NULL
snapshot_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, snapshot_hash)
```

## 66.3 `device_metadata_snapshots`

```text
id UUID PK
tenant_id UUID NULL
manufacturer VARCHAR NOT NULL
mcu_mpn VARCHAR NOT NULL
package VARCHAR NOT NULL
silicon_revision VARCHAR NULL
metadata_schema_version VARCHAR NOT NULL
source_type VARCHAR NOT NULL
source_reference JSONB NOT NULL
artifact_hash CHAR(64) NOT NULL
pin_count INT NOT NULL
peripheral_count INT NOT NULL
clock_model_version VARCHAR NOT NULL
dma_model_version VARCHAR NULL
irq_model_version VARCHAR NOT NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(manufacturer, mcu_mpn, package, metadata_schema_version, artifact_hash)
```

## 66.4 `device_pins`

```text
id UUID PK
device_metadata_snapshot_id UUID NOT NULL
package_pin VARCHAR NOT NULL
port_name VARCHAR NULL
pin_name VARCHAR NOT NULL
electrical_capabilities JSONB NOT NULL
alternate_functions JSONB NOT NULL
analog_channels JSONB NOT NULL
wakeup_capabilities JSONB NOT NULL
reserved_roles JSONB NOT NULL
voltage_tolerance JSONB NOT NULL
source_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(device_metadata_snapshot_id, package_pin)
```

## 66.5 `device_peripherals`

```text
id UUID PK
device_metadata_snapshot_id UUID NOT NULL
peripheral_type VARCHAR NOT NULL
instance_name VARCHAR NOT NULL
capabilities JSONB NOT NULL
clock_sources JSONB NOT NULL
pin_groups JSONB NOT NULL
dma_requests JSONB NOT NULL
interrupt_vectors JSONB NOT NULL
security_domains JSONB NOT NULL
source_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(device_metadata_snapshot_id, instance_name)
```

## 66.6 `device_clock_nodes`

```text
id UUID PK
device_metadata_snapshot_id UUID NOT NULL
clock_node_key VARCHAR NOT NULL
clock_type VARCHAR NOT NULL
parent_candidates JSONB NOT NULL
frequency_constraints JSONB NOT NULL
divider_constraints JSONB NOT NULL
multiplier_constraints JSONB NOT NULL
consumers JSONB NOT NULL
source_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(device_metadata_snapshot_id, clock_node_key)
```

## 66.7 `firmware_board_ir_versions`

```text
id UUID PK
generation_job_id UUID NOT NULL
ir_version VARCHAR NOT NULL
board_name VARCHAR NOT NULL
board_revision VARCHAR NOT NULL
mcu_instances JSONB NOT NULL
signals JSONB NOT NULL
interfaces JSONB NOT NULL
external_devices JSONB NOT NULL
clocks JSONB NOT NULL
power_domains JSONB NOT NULL
debug_boot JSONB NOT NULL
constraints JSONB NOT NULL
board_ir_uri TEXT NOT NULL
board_ir_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, ir_version)
```

## 66.8 `firmware_signal_bindings`

```text
id UUID PK
generation_job_id UUID NOT NULL
signal_key VARCHAR NOT NULL
agent16_net_id UUID NULL
raw_net_name VARCHAR NULL
logical_role VARCHAR NULL
role_candidates JSONB NOT NULL
voltage_domain VARCHAR NULL
direction VARCHAR NULL
active_level VARCHAR NULL
electrical_requirements JSONB NOT NULL
timing_requirements JSONB NOT NULL
confidence_dimensions JSONB NOT NULL
review_status VARCHAR NOT NULL
source_evidence JSONB NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, signal_key)
```

## 66.9 `firmware_pin_assignments`

```text
id UUID PK
generation_job_id UUID NOT NULL
mcu_instance_key VARCHAR NOT NULL
device_pin_id UUID NOT NULL
signal_binding_id UUID NULL
selected_alternate_function VARCHAR NULL
peripheral_instance VARCHAR NULL
mode VARCHAR NOT NULL
pull VARCHAR NULL
drive_strength VARCHAR NULL
slew_rate VARCHAR NULL
initial_level VARCHAR NULL
low_power_state JSONB NULL
ownership VARCHAR NULL
resolution_status VARCHAR NOT NULL
resolution_method VARCHAR NOT NULL
confidence NUMERIC(5,4) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, mcu_instance_key, device_pin_id)
```

## 66.10 `firmware_pinmux_candidates`

```text
id UUID PK
generation_job_id UUID NOT NULL
candidate_rank INT NOT NULL
assignment_set JSONB NOT NULL
satisfied_constraints JSONB NOT NULL
unsatisfied_constraints JSONB NOT NULL
cost_breakdown JSONB NOT NULL
candidate_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, candidate_rank)
```

## 66.11 `firmware_clock_plans`

```text
id UUID PK
generation_job_id UUID NOT NULL
plan_version INT NOT NULL
source_configuration JSONB NOT NULL
node_configuration JSONB NOT NULL
core_frequency_hz BIGINT NULL
bus_frequencies JSONB NOT NULL
peripheral_frequencies JSONB NOT NULL
flash_latency JSONB NULL
constraint_results JSONB NOT NULL
plan_hash CHAR(64) NOT NULL
status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, plan_version)
```

## 66.12 `firmware_peripheral_configs`

```text
id UUID PK
generation_job_id UUID NOT NULL
peripheral_type VARCHAR NOT NULL
instance_name VARCHAR NOT NULL
mode VARCHAR NOT NULL
pin_assignment_ids JSONB NOT NULL
clock_plan_id UUID NOT NULL
configuration JSONB NOT NULL
connected_device_refs JSONB NOT NULL
driver_binding_id UUID NULL
ownership VARCHAR NOT NULL
initialization_phase VARCHAR NOT NULL
validation_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, instance_name)
```

## 66.13 `firmware_dma_allocations`

```text
id UUID PK
generation_job_id UUID NOT NULL
consumer_type VARCHAR NOT NULL
consumer_reference VARCHAR NOT NULL
request_name VARCHAR NOT NULL
controller VARCHAR NOT NULL
channel_or_stream VARCHAR NOT NULL
direction VARCHAR NOT NULL
mode VARCHAR NOT NULL
priority VARCHAR NULL
data_width JSONB NOT NULL
memory_policy JSONB NOT NULL
irq_reference VARCHAR NULL
allocation_status VARCHAR NOT NULL
conflict_group VARCHAR NULL
created_at TIMESTAMPTZ
```

## 66.14 `firmware_irq_allocations`

```text
id UUID PK
generation_job_id UUID NOT NULL
vector_name VARCHAR NOT NULL
source_references JSONB NOT NULL
priority INT NULL
subpriority INT NULL
rtos_safe BOOLEAN NOT NULL
handler_owner VARCHAR NOT NULL
deferred_processing JSONB NULL
allocation_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.15 `firmware_timer_allocations`

```text
id UUID PK
generation_job_id UUID NOT NULL
timer_instance VARCHAR NOT NULL
channel VARCHAR NULL
consumer_reference VARCHAR NOT NULL
mode VARCHAR NOT NULL
target_frequency_hz NUMERIC NULL
target_resolution_bits INT NULL
resolved_configuration JSONB NOT NULL
dma_allocation_id UUID NULL
irq_allocation_id UUID NULL
allocation_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.16 `firmware_memory_plans`

```text
id UUID PK
generation_job_id UUID NOT NULL
plan_version INT NOT NULL
flash_regions JSONB NOT NULL
ram_regions JSONB NOT NULL
dma_regions JSONB NOT NULL
stack_budgets JSONB NOT NULL
heap_budget JSONB NOT NULL
buffers JSONB NOT NULL
external_memory JSONB NOT NULL
boot_partitions JSONB NOT NULL
constraint_results JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, plan_version)
```

## 66.17 `firmware_driver_catalog`

```text
id UUID PK
tenant_id UUID NULL
driver_name VARCHAR NOT NULL
driver_version VARCHAR NOT NULL
device_match JSONB NOT NULL
framework_profiles JSONB NOT NULL
interface_types JSONB NOT NULL
source_reference JSONB NOT NULL
artifact_hash CHAR(64) NOT NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
api_schema_version VARCHAR NOT NULL
test_report_uri TEXT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(driver_name, driver_version, artifact_hash)
```

## 66.18 `firmware_driver_bindings`

```text
id UUID PK
generation_job_id UUID NOT NULL
external_device_ref VARCHAR NOT NULL
driver_catalog_id UUID NULL
binding_type VARCHAR NOT NULL
interface_instance VARCHAR NOT NULL
address_or_select JSONB NULL
control_signals JSONB NOT NULL
configuration JSONB NOT NULL
compatibility_status VARCHAR NOT NULL
license_status VARCHAR NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.19 `firmware_initialization_nodes`

```text
id UUID PK
generation_job_id UUID NOT NULL
node_key VARCHAR NOT NULL
node_type VARCHAR NOT NULL
initialization_phase VARCHAR NOT NULL
owner_module VARCHAR NOT NULL
arguments JSONB NOT NULL
failure_policy VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, node_key)
```

## 66.20 `firmware_initialization_edges`

```text
id UUID PK
generation_job_id UUID NOT NULL
source_node_id UUID NOT NULL
target_node_id UUID NOT NULL
dependency_type VARCHAR NOT NULL
reason VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(source_node_id, target_node_id, dependency_type)
```

## 66.21 `firmware_task_plans`

```text
id UUID PK
generation_job_id UUID NOT NULL
task_name VARCHAR NOT NULL
responsibility TEXT NOT NULL
priority INT NULL
period_ms NUMERIC NULL
event_sources JSONB NOT NULL
stack_bytes INT NULL
core_affinity JSONB NULL
watchdog_policy JSONB NULL
owned_resources JSONB NOT NULL
queues_and_events JSONB NOT NULL
latency_budget_us BIGINT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, task_name)
```

## 66.22 `firmware_protocol_definitions`

```text
id UUID PK
generation_job_id UUID NOT NULL
protocol_name VARCHAR NOT NULL
transport VARCHAR NOT NULL
schema_version VARCHAR NOT NULL
message_definitions JSONB NOT NULL
framing JSONB NOT NULL
endianness VARCHAR NULL
checksum JSONB NULL
timeouts JSONB NOT NULL
retry_policy JSONB NOT NULL
state_machine JSONB NOT NULL
security_hooks JSONB NOT NULL
protocol_ir_uri TEXT NOT NULL
protocol_ir_hash CHAR(64) NOT NULL
review_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, protocol_name)
```

## 66.23 `firmware_framework_profiles`

```text
id UUID PK
profile_name VARCHAR NOT NULL
profile_version VARCHAR NOT NULL
supported_devices JSONB NOT NULL
platform_adapter VARCHAR NOT NULL
project_layout JSONB NOT NULL
build_system VARCHAR NOT NULL
dependency_manager VARCHAR NOT NULL
driver_model VARCHAR NOT NULL
rtos_model VARCHAR NULL
generated_code_policy JSONB NOT NULL
validation_backends JSONB NOT NULL
template_bundle_id UUID NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(profile_name, profile_version)
```

## 66.24 `firmware_toolchain_snapshots`

```text
id UUID PK
tenant_id UUID NULL
environment_name VARCHAR NOT NULL
container_digest VARCHAR NULL
platform VARCHAR NOT NULL
compiler_name VARCHAR NOT NULL
compiler_version VARCHAR NOT NULL
linker_version VARCHAR NULL
cmake_version VARCHAR NULL
ninja_version VARCHAR NULL
sdk_versions JSONB NOT NULL
vendor_tool_versions JSONB NOT NULL
runtime_versions JSONB NOT NULL
environment_hash CHAR(64) NOT NULL
approval_status VARCHAR NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.25 `firmware_dependencies`

```text
id UUID PK
generation_job_id UUID NOT NULL
dependency_type VARCHAR NOT NULL
name VARCHAR NOT NULL
version_constraint VARCHAR NULL
resolved_version VARCHAR NULL
source_reference JSONB NOT NULL
artifact_hash CHAR(64) NULL
license_status VARCHAR NOT NULL
approval_status VARCHAR NOT NULL
transitive BOOLEAN NOT NULL
resolution_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.26 `firmware_generation_manifests`

```text
id UUID PK
generation_job_id UUID NOT NULL
manifest_version VARCHAR NOT NULL
generator_version VARCHAR NOT NULL
template_bundle_version VARCHAR NOT NULL
input_snapshot_hash CHAR(64) NOT NULL
file_count INT NOT NULL
manifest_uri TEXT NOT NULL
manifest_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, manifest_version)
```

## 66.27 `firmware_generated_files`

```text
id UUID PK
generation_manifest_id UUID NOT NULL
relative_path TEXT NOT NULL
file_role VARCHAR NOT NULL
ownership_type VARCHAR NOT NULL
template_id VARCHAR NULL
template_version VARCHAR NULL
input_hash CHAR(64) NOT NULL
content_hash CHAR(64) NOT NULL
regeneration_policy VARCHAR NOT NULL
protected_region_metadata JSONB NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_manifest_id, relative_path)
```

## 66.28 `firmware_dependency_lockfiles`

```text
id UUID PK
generation_job_id UUID NOT NULL
lock_version VARCHAR NOT NULL
framework_profile VARCHAR NOT NULL
target_identity JSONB NOT NULL
toolchain_snapshot_id UUID NOT NULL
dependency_count INT NOT NULL
lockfile_uri TEXT NOT NULL
lockfile_hash CHAR(64) NOT NULL
replay_status VARCHAR NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, lock_version)
```

## 66.29 `firmware_build_runs`

```text
id UUID PK
generation_job_id UUID NOT NULL
workspace_id UUID NOT NULL
toolchain_snapshot_id UUID NOT NULL
build_configuration VARCHAR NOT NULL
status VARCHAR NOT NULL
command_manifest_uri TEXT NOT NULL
stdout_uri TEXT NULL
stderr_uri TEXT NULL
artifact_manifest_uri TEXT NULL
flash_bytes BIGINT NULL
ram_bytes BIGINT NULL
warning_count INT NOT NULL
error_count INT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 66.30 `firmware_validation_runs`

```text
id UUID PK
generation_job_id UUID NOT NULL
validation_type VARCHAR NOT NULL
validator_name VARCHAR NOT NULL
validator_version VARCHAR NOT NULL
status VARCHAR NOT NULL
finding_count INT NOT NULL
metrics JSONB NOT NULL
result_uri TEXT NOT NULL
trace_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 66.31 `firmware_flash_runs`

```text
id UUID PK
generation_job_id UUID NOT NULL
target_board_id UUID NOT NULL
firmware_artifact_hash CHAR(64) NOT NULL
probe_reference VARCHAR NULL
flash_backend VARCHAR NOT NULL
target_identity_before JSONB NOT NULL
permission_snapshot JSONB NOT NULL
status VARCHAR NOT NULL
result_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 66.32 `firmware_hil_runs`

```text
id UUID PK
generation_job_id UUID NOT NULL
test_board_id UUID NOT NULL
test_suite_version VARCHAR NOT NULL
reservation_id UUID NOT NULL
status VARCHAR NOT NULL
test_count INT NOT NULL
passed_count INT NOT NULL
failed_count INT NOT NULL
measurement_summary JSONB NOT NULL
result_uri TEXT NOT NULL
started_at TIMESTAMPTZ NOT NULL
completed_at TIMESTAMPTZ NULL
```

## 66.33 `firmware_regeneration_runs`

```text
id UUID PK
project_id UUID NOT NULL
base_generation_job_id UUID NOT NULL
new_generation_job_id UUID NOT NULL
previous_manifest_hash CHAR(64) NOT NULL
workspace_hash CHAR(64) NOT NULL
new_manifest_hash CHAR(64) NOT NULL
added_files JSONB NOT NULL
modified_generated_files JSONB NOT NULL
preserved_user_files JSONB NOT NULL
deleted_obsolete_files JSONB NOT NULL
merge_conflicts JSONB NOT NULL
status VARCHAR NOT NULL
created_at TIMESTAMPTZ
```

## 66.34 `firmware_generation_reports`

```text
id UUID PK
generation_job_id UUID NOT NULL
report_version INT NOT NULL
overall_status VARCHAR NOT NULL
configuration_status VARCHAR NOT NULL
build_status VARCHAR NULL
test_status VARCHAR NULL
static_analysis_status VARCHAR NULL
hil_status VARCHAR NULL
unresolved_issue_count INT NOT NULL
report_uri TEXT NOT NULL
report_hash CHAR(64) NOT NULL
created_at TIMESTAMPTZ
UNIQUE(generation_job_id, report_version)
```

---

# 67. 对象存储

```text
derived/firmware-generation/
  {tenant_id}/{project_id}/
    jobs/
      {generation_job_id}/
        input/
          hardware-snapshot.json
          requirements.json
          device-metadata.json.zst
          toolchain-snapshot.json
        ir/
          board-ir.json
          signal-ir.jsonl.zst
          pinmux-ir.json
          clock-ir.json
          peripheral-ir.jsonl.zst
          dma-plan.json
          irq-plan.json
          timer-plan.json
          memory-plan.json
          firmware-project-ir.json
          protocol-ir/
        planning/
          pinmux-candidates.json
          constraint-results.json
          initialization-graph.json
          driver-bindings.json
          task-plan.json
        generation/
          workspace-manifest.json
          generated-files.jsonl.zst
          generation-manifest.json
          dependency-manifest.json
          firmware.lock.json
          source-bundle/
        validation/
          build/
          static-analysis/
          unit-tests/
          host-tests/
          emulation/
          flash/
          hil/
        reports/
          generation-report.html
          generation-report.pdf
          pin-map.csv
          peripheral-map.csv
          memory-map.json
          traceability-matrix.csv
        debug/
          resolution-trace.jsonl.zst
          template-trace.jsonl.zst
          dependency-trace.jsonl.zst
          resource-usage.json
```

---

# 68. API 设计

## 68.1 Device Metadata

```text
POST /api/v1/firmware-generation/device-metadata/import
GET  /api/v1/firmware-generation/device-metadata
GET  /api/v1/firmware-generation/device-metadata/{id}
POST /api/v1/firmware-generation/device-metadata/{id}/validate
GET  /api/v1/firmware-generation/device-metadata/{id}/pins
GET  /api/v1/firmware-generation/device-metadata/{id}/peripherals
GET  /api/v1/firmware-generation/device-metadata/{id}/clocks
```

## 68.2 Jobs

```text
POST /api/v1/firmware-generation/jobs
POST /api/v1/firmware-generation/jobs/batch
GET  /api/v1/firmware-generation/jobs/{id}
GET  /api/v1/firmware-generation/jobs/{id}/events
POST /api/v1/firmware-generation/jobs/{id}/cancel
POST /api/v1/firmware-generation/jobs/{id}/retry
POST /api/v1/firmware-generation/jobs/{id}/regenerate
```

## 68.3 IR 和 Planning

```text
GET  /api/v1/firmware-generation/jobs/{id}/board-ir
GET  /api/v1/firmware-generation/jobs/{id}/pinmux
GET  /api/v1/firmware-generation/jobs/{id}/clock-plan
GET  /api/v1/firmware-generation/jobs/{id}/peripherals
GET  /api/v1/firmware-generation/jobs/{id}/dma
GET  /api/v1/firmware-generation/jobs/{id}/irq
GET  /api/v1/firmware-generation/jobs/{id}/timers
GET  /api/v1/firmware-generation/jobs/{id}/memory
GET  /api/v1/firmware-generation/jobs/{id}/initialization-graph
GET  /api/v1/firmware-generation/jobs/{id}/task-plan
GET  /api/v1/firmware-generation/jobs/{id}/protocols
POST /api/v1/firmware-generation/jobs/{id}/resolve
POST /api/v1/firmware-generation/jobs/{id}/validate-configuration
```

## 68.4 Profiles、Adapters 和 Drivers

```text
GET  /api/v1/firmware-generation/framework-profiles
GET  /api/v1/firmware-generation/framework-profiles/{id}
GET  /api/v1/firmware-generation/platform-adapters
POST /api/v1/firmware-generation/platform-adapters/{id}/discover
POST /api/v1/firmware-generation/platform-adapters/{id}/contract-test
GET  /api/v1/firmware-generation/drivers
GET  /api/v1/firmware-generation/drivers/{id}
POST /api/v1/firmware-generation/drivers/{id}/validate
```

## 68.5 Generation

```text
POST /api/v1/firmware-generation/jobs/{id}/preview
POST /api/v1/firmware-generation/jobs/{id}/approve
POST /api/v1/firmware-generation/jobs/{id}/generate
GET  /api/v1/firmware-generation/jobs/{id}/manifest
GET  /api/v1/firmware-generation/jobs/{id}/files
GET  /api/v1/firmware-generation/jobs/{id}/lockfile
POST /api/v1/firmware-generation/jobs/{id}/validate-lockfile
```

## 68.6 Build/Test

```text
POST /api/v1/firmware-generation/jobs/{id}/build
POST /api/v1/firmware-generation/jobs/{id}/static-analysis
POST /api/v1/firmware-generation/jobs/{id}/unit-test
POST /api/v1/firmware-generation/jobs/{id}/emulate
GET  /api/v1/firmware-generation/jobs/{id}/validations
```

## 68.7 Flash/HIL

```text
POST /api/v1/firmware-generation/jobs/{id}/flash
POST /api/v1/firmware-generation/jobs/{id}/hil
GET  /api/v1/firmware-generation/flash-runs/{id}
GET  /api/v1/firmware-generation/hil-runs/{id}
```

烧录与 HIL API 必须额外授权。

## 68.8 Export

```text
GET  /api/v1/firmware-generation/jobs/{id}/source-bundle
GET  /api/v1/firmware-generation/jobs/{id}/build-artifacts
GET  /api/v1/firmware-generation/jobs/{id}/report
GET  /api/v1/firmware-generation/jobs/{id}/traceability
POST /api/v1/firmware-generation/jobs/{id}/export-package
GET  /health/live
GET  /health/ready
GET  /metrics
```

---

# 69. 事件

## 输入事件

```text
eda.ir.ready
netlist.pin-to-net.ready
eda-library.scan.completed
kicad.project-revision.ready
component.identity.resolved
device.metadata.approved
driver.release.approved
firmware.generation.requested
hardware.revision.released
```

## 输出事件

```text
firmware.configuration.review-required
firmware.pinmux.conflict-detected
firmware.clock.conflict-detected
firmware.resource-plan.ready
firmware.generation.preview-ready
firmware.source.ready
firmware.build.failed
firmware.build.ready
firmware.tests.failed
firmware.validation.ready
firmware.flash.permission-required
firmware.hil.ready
firmware.generation.completed
firmware.generation.failed
```

## `firmware.source.ready`

```json
{
  "event_type": "firmware.source.ready",
  "event_version": "1.0",
  "generation_job_id": "uuid",
  "project_id": "uuid",
  "hardware_revision": "rev-a",
  "framework_profile": "pico-sdk-freertos",
  "input_snapshot_hash": "sha256",
  "generation_manifest_hash": "sha256",
  "lockfile_hash": "sha256",
  "build_status": "passed",
  "source_bundle_uri": "s3://...",
  "created_at": "ISO-8601"
}
```

---

# 70. Policy 和配置

```text
policies/
├── firmware-generation-1.0.0.yaml
├── device-metadata.yaml
├── signal-role.yaml
├── pinmux/
│   ├── hard-constraints.yaml
│   ├── preferences.yaml
│   ├── debug-boot.yaml
│   └── electrical.yaml
├── clocks/
│   ├── limits.yaml
│   ├── usb-can-audio.yaml
│   └── low-power.yaml
├── resources/
│   ├── dma.yaml
│   ├── irq.yaml
│   ├── timer.yaml
│   ├── memory.yaml
│   └── ownership.yaml
├── generation/
│   ├── code-ownership.yaml
│   ├── protected-regions.yaml
│   ├── regeneration.yaml
│   └── templates.yaml
├── dependencies/
│   ├── approval.yaml
│   ├── licenses.yaml
│   └── lockfile.yaml
├── validation/
│   ├── compiler-warnings.yaml
│   ├── static-analysis.yaml
│   ├── tests.yaml
│   └── hil.yaml
├── flash-security.yaml
└── enterprise/
```

---

# 71. 规则引擎

要求：

- JSON/YAML Schema；
- 受限表达式；
- Rule ID 和 Version；
- Scope；
- Priority；
- Effectivity；
- Conflict Detection；
- Dry Run；
- Explain Trace；
- Rollback；
- 禁止任意代码执行。

---

# 72. PinMux Solver

V1 可以采用：

```text
domain filtering
constraint propagation
backtracking
scored candidate search
```

复杂设备可选：

```text
OR-Tools CP-SAT
```

Solver 输出必须可解释：

```text
为什么选这个 Pin
为什么其他 Pin 被排除
哪些资源被保留
哪些约束无法满足
```

---

# 73. Clock Solver

步骤：

```text
确定外部/内部源
→ 约束目标频率
→ 枚举/求解 PLL 和 Divider
→ 校验 VCO/Bus/Peripheral
→ 校验 Flash/Voltage
→ 计算误差
→ 输出候选
```

厂商官方配置工具可作为独立验证器。

---

# 74. Peripheral Binding

每个需求映射：

```text
logical feature
→ peripheral type
→ instance
→ pins
→ clock
→ DMA/IRQ
→ driver
→ API
```

例如：

```text
“调试串口”
→ UART
→ USART2
→ PA2/PA3
→ APB clock
→ optional DMA
→ console driver
```

每一步有证据和状态。

---

# 75. 初始化图校验

检测：

```text
dependency cycle
missing dependency
multiple owner
late dependency used early
ISR before driver init
task starts before queue creation
protocol starts before transport
storage mounted before memory init
```

---

# 76. 驱动选择

排序：

```text
官方 SDK Driver
框架原生 Driver
企业批准 Driver
ezPLM Driver Catalog
生成 Skeleton
```

只有接口和寄存器定义充分时才生成实现。

---

# 77. 生成策略

## Configuration-first

优先生成：

```text
.ioc / configuration input
devicetree/Kconfig
sdkconfig
CMake configuration
board header
```

再调用官方工具或 Adapter 生成代码。

## Template-only

仅用于平台没有官方生成器或生成自有抽象层。

---

# 78. 模板引擎

要求：

- 模板 ID/Version；
- 强类型上下文；
- 未定义变量报错；
- 禁止模板任意文件读取；
- 禁止任意命令；
- 输出路径 Allowlist；
- Deterministic Rendering；
- Golden Tests；
- 模板许可证和来源。

可选：

```text
Jinja2 sandboxed
```

---

# 79. 用户代码保护

规则：

```text
generated files may be replaced
user files never replaced
adapter files require three-way merge
config files use structured merge
manual edits in generated files cause conflict
```

---

# 80. Regeneration Gate

再生成前：

```text
compare manifest
detect generated file edits
detect user file collision
preview changes
run three-way merge
require approval for deletions
```

---

# 81. Build Command 安全

禁止自由 Shell 字符串。

使用：

```text
executable allowlist
argument array
workspace root
environment allowlist
timeout
resource limits
network policy
```

---

# 82. Vendor Tool 编排

每个 Tool Adapter 保存：

```text
tool name/version
installation hash
supported devices
input format
output contract
headless capability
license requirement
command schema
known limitations
```

---

# 83. 工具输出回读

不能只看退出码。

检查：

```text
expected files
configuration summary
generated manifest
target identity
compile database
build artifacts
warnings/errors
```

---

# 84. SBOM

至少包含：

```text
SDK
RTOS
Drivers
Components
Libraries
Generators
Toolchain
Licenses
Hashes
Source
```

---

# 85. Traceability Matrix

映射：

```text
Hardware Requirement
→ Net/Pin
→ Peripheral Configuration
→ Generated Module
→ Driver
→ Test
→ Build Artifact
```

---

# 86. 版本策略

每次生成绑定：

```text
hardware revision
firmware project IR version
device metadata version
SDK version
toolchain version
template version
dependency lock
generator version
```

---

# 87. Review Workbench

界面：

```text
左：硬件、信号和外设树
中：Pin Map / Clock Tree / Resource Map
右：配置、候选、冲突和证据
下：生成文件、Diff、Build/Test
```

---

# 88. Review 操作

```text
confirm signal role
select alternate pinmux candidate
reserve pin
select clock candidate
resolve DMA conflict
set IRQ priority
select driver
edit task plan
approve protocol
approve generation
review diff
approve flash/HIL
```

---

# 89. 质量指标

```text
Hardware Pin Coverage
Resolved Signal Coverage
PinMux Conflict Count
Clock Constraint Coverage
Peripheral Configuration Coverage
DMA/IRQ/Timer Conflict Count
Driver Binding Coverage
Generated File Determinism
Build Success
Warning Count
Static Analysis Findings
Unit Test Coverage
HIL Pass Rate
Regeneration Conflict Rate
```

---

# 90. 初始质量目标

```text
Hardware Input Preservation = 100%
Exact MCU/Package Binding = 100%
Unsupported Pin Auto-assignment = 0
Unreviewed Ambiguous Signal Auto-generation = 0
PinMux Hard-constraint Violation = 0
Clock Hard-constraint Violation = 0
DMA Double-allocation after Release = 0
IRQ Invalid Priority after Release = 0
Generated User-file Overwrite = 0
Unapproved Dependency Download = 0
Unapproved Shell Execution = 0
Generation Determinism = 100%
Manifest Coverage = 100%
Lockfile Replay Consistency = 100%
Compile Verification Coverage for Released Source = 100%
Faked Build/Test Result = 0
Production Fuse/Key Auto-operation = 0
Tenant/Project Isolation = 100%
```

这些是目标，不是未经验证的保证。

---

# 91. 测试集

公开仓库只使用开源、合成、脱敏或授权 Fixture。

## Device/Input

1. Exact MCU；
2. Wrong Package；
3. Missing Package；
4. Unsupported Revision；
5. Missing Device Metadata；
6. Unapproved Metadata；
7. Agent 18 Not Ready；
8. Agent 20 Blocked；
9. Multiple MCU；
10. Multi-core MCU。

## Signal/PinMux

11. Explicit UART；
12. Net-name Candidate；
13. Multiple AF；
14. Pin unavailable in package；
15. Debug Pin；
16. Boot Pin；
17. Oscillator Pin；
18. USB Pin；
19. Analog Pin；
20. Open-drain；
21. 5V Tolerance；
22. Reserved Pin；
23. Existing PCB immutable；
24. Alternative Candidate；
25. Unsatisfiable PinMux。

## Clock

26. Internal Oscillator；
27. External Crystal；
28. PLL；
29. Invalid VCO；
30. Bus Overclock；
31. Flash Latency；
32. USB Clock；
33. CAN Clock；
34. ADC Clock；
35. Timer Clock；
36. Low-power Clock；
37. Source Missing；
38. Multiple Valid Plans；
39. Tool Cross-check；
40. Clock Regression。

## Resources

41. DMA Valid；
42. DMA Conflict；
43. Shared IRQ；
44. RTOS Priority Invalid；
45. Timer PWM；
46. Timer Conflict；
47. ADC Sampling；
48. Cache/DMA；
49. Flash Overflow；
50. RAM Overflow；
51. Stack Budget；
52. External RAM；
53. Boot Partitions；
54. Core Affinity；
55. Ownership Conflict。

## Generation

56. CMSIS Bare-metal；
57. STM32 HAL；
58. STM32 LL；
59. FreeRTOS；
60. ESP-IDF；
61. Pico SDK；
62. Zephyr；
63. nRF Connect；
64. MCUXpresso；
65. Unsupported Profile；
66. BSP；
67. Driver Skeleton；
68. Mock；
69. Protocol；
70. Examples；
71. Devicetree；
72. Kconfig；
73. sdkconfig；
74. Partition Table；
75. Lockfile。

## Regeneration

76. No Change；
77. Generated Change；
78. User File Preserved；
79. Generated File Edited；
80. Three-way Merge；
81. Conflict；
82. Obsolete File；
83. Template Upgrade；
84. SDK Upgrade；
85. Hardware Revision Change。

## Validation/Security

86. Compile Pass；
87. Compile Fail；
88. Link Fail；
89. Warning Gate；
90. Static Analysis；
91. Unit Test；
92. Fuzz Test；
93. Emulation；
94. Flash Permission；
95. Target Mismatch；
96. HIL；
97. Fuse Operation Block；
98. Path Escape；
99. Arbitrary Command；
100. Audit Replay。

---

# 92. 性能要求

常规工程：

```text
1 MCU
50-150 signals
10-30 peripherals
5-20 drivers
```

目标：

```text
Input Normalization P95 < 5 s
PinMux Candidate P95 < 5 s
Clock Plan P95 < 5 s
Resource Plan P95 < 5 s
Generation P95 < 30 s excluding vendor tool
Incremental Regeneration P95 < 20 s
```

大型工程：

```text
multi-core MCU/MPU
100+ peripherals/signals
multiple firmware images
```

要求：

- IR 分区；
- Solver 超时与候选上限；
- 并行独立配置；
- Build Cache；
- Dependency Cache；
- Incremental Generation；
- Streaming Logs；
- 可取消和恢复。

---

# 93. 可观测性

```text
firmware_generation_jobs_total{status,profile}
firmware_generation_duration_seconds{step}
firmware_device_metadata_resolution_total{status}
firmware_pinmux_conflicts_total{type}
firmware_clock_conflicts_total{type}
firmware_dma_conflicts_total
firmware_irq_conflicts_total
firmware_timer_conflicts_total
firmware_driver_bindings_total{status}
firmware_generated_files_total{role,ownership}
firmware_regeneration_conflicts_total{type}
firmware_dependency_resolution_total{status,type}
firmware_build_runs_total{status,toolchain}
firmware_build_warning_count{profile}
firmware_static_findings_total{tool,severity}
firmware_unit_tests_total{status}
firmware_flash_runs_total{status}
firmware_hil_runs_total{status}
firmware_lockfile_replay_total{status}
```

---

# 94. Dashboard

```text
Projects and Hardware Revisions
MCU/Package Coverage
Signal and PinMux Coverage
Clock Plans
DMA/IRQ/Timer Resources
Memory Usage
Driver Bindings
Task/Protocol Plans
Generated Files
Regeneration Conflicts
Dependencies/License
Build and Warnings
Static Analysis
Unit Tests
Flash/HIL
Release Readiness
```

---

# 95. 安全与权限

- 硬件、源码、协议和构建制品按租户/项目隔离；
- Device Metadata、SDK 和 Driver Catalog 需要来源、Hash、许可证和批准状态；
- 默认离线或受控依赖代理；
- 禁止任意 URL 下载；
- 禁止任意 Shell；
- Vendor Tool 参数由类型化 Builder 生成；
- Container/Worker 限制 CPU、内存、磁盘和网络；
- 不执行工程内未经批准脚本；
- 不执行任意 Post-build 命令；
- 构建日志脱敏；
- 私有 Registry Credential 使用 Secret Reference；
- 生成代码不含生产密钥；
- Protocol Security 使用批准密码库；
- Flash 权限独立；
- Board Reservation 和 Target Identity 必须验证；
- Fuse/Option Byte 默认只读；
- Secure Boot、Flash Encryption、TrustZone 配置需要高风险审批；
- HIL 控制执行器时设置安全上限和急停；
- 不将代码和硬件资料发送给外部通用模型；
- AI 辅助代码必须标记来源并通过同样测试；
- 公开 Fixture 不使用客户源码和私有驱动；
- Generation Manifest、Lockfile 和 Validation Report 不可硬删除。

---

# 96. 推荐技术栈

核心：

```text
Python 3.12
FastAPI
Pydantic
PostgreSQL
Redis
Temporal
S3 / R2 / MinIO
```

约束和数据：

```text
OR-Tools optional
NetworkX only for small initialization graphs
Polars
PyArrow
DuckDB
```

生成：

```text
Jinja2 SandboxedEnvironment
JSON Schema
YAML/TOML structured emitters
C AST tooling optional
```

构建：

```text
CMake
Ninja
containerized/private toolchains
```

验证：

```text
pytest
Ceedling/Unity/CMock optional
clang-tidy
cppcheck
QEMU/Renode optional
```

---

# 97. 推荐仓库结构

```text
firmware-generation-agent/
├── AGENTS.md
├── README.md
├── pyproject.toml
├── .env.example
├── docs/
│   ├── firmware-generation-agent-spec.md
│   ├── hardware-to-firmware-contract.md
│   ├── device-metadata-model.md
│   ├── board-and-signal-ir.md
│   ├── pinmux-resolution.md
│   ├── clock-resolution.md
│   ├── dma-irq-timer-planning.md
│   ├── memory-and-power-planning.md
│   ├── firmware-project-ir.md
│   ├── framework-profiles.md
│   ├── platform-adapters.md
│   ├── bsp-and-driver-generation.md
│   ├── initialization-and-rtos.md
│   ├── protocol-framework.md
│   ├── generated-code-ownership.md
│   ├── dependencies-and-lockfile.md
│   ├── build-test-hil.md
│   ├── security.md
│   ├── benchmark.md
│   └── adr/
│       ├── 0001-hardware-facts-and-software-intent-separated.md
│       ├── 0002-pinmux-and-clock-are-not-llm-decisions.md
│       ├── 0003-configuration-first-generation.md
│       ├── 0004-generated-and-user-code-separated.md
│       ├── 0005-build-success-is-not-functional-success.md
│       ├── 0006-dependencies-and-tools-are-locked.md
│       └── 0007-flash-and-security-operations-need-separate-approval.md
├── src/
│   └── firmware_generation/
│       ├── main.py
│       ├── config.py
│       ├── api/
│       ├── db/
│       ├── domain/
│       │   ├── input.py
│       │   ├── device.py
│       │   ├── board.py
│       │   ├── signal.py
│       │   ├── pinmux.py
│       │   ├── clock.py
│       │   ├── peripheral.py
│       │   ├── resources.py
│       │   ├── driver.py
│       │   ├── task.py
│       │   ├── protocol.py
│       │   ├── project_ir.py
│       │   └── generation.py
│       ├── adapters/
│       │   ├── agent16.py
│       │   ├── agent18.py
│       │   ├── agent20.py
│       │   └── device_metadata.py
│       ├── metadata/
│       │   ├── registry.py
│       │   ├── cmsis_pack.py
│       │   ├── svd.py
│       │   ├── vendor_sdk.py
│       │   ├── validation.py
│       │   └── snapshots.py
│       ├── hardware/
│       │   ├── board_builder.py
│       │   ├── signal_roles.py
│       │   ├── external_devices.py
│       │   ├── clocks.py
│       │   └── evidence.py
│       ├── pinmux/
│       │   ├── domains.py
│       │   ├── constraints.py
│       │   ├── solver.py
│       │   ├── scoring.py
│       │   └── explain.py
│       ├── clocking/
│       │   ├── graph.py
│       │   ├── solver.py
│       │   ├── limits.py
│       │   ├── candidates.py
│       │   └── validation.py
│       ├── resources/
│       │   ├── dma.py
│       │   ├── irq.py
│       │   ├── timers.py
│       │   ├── memory.py
│       │   ├── power.py
│       │   └── ownership.py
│       ├── planning/
│       │   ├── peripherals.py
│       │   ├── drivers.py
│       │   ├── initialization.py
│       │   ├── tasks.py
│       │   ├── protocols.py
│       │   └── validation.py
│       ├── profiles/
│       │   ├── registry.py
│       │   ├── cmsis.py
│       │   ├── stm32.py
│       │   ├── esp_idf.py
│       │   ├── pico_sdk.py
│       │   ├── zephyr.py
│       │   ├── nrf_connect.py
│       │   └── mcuxpresso.py
│       ├── platform/
│       │   ├── base.py
│       │   ├── discovery.py
│       │   ├── capability.py
│       │   ├── stm32_cube.py
│       │   ├── esp_idf.py
│       │   ├── pico_sdk.py
│       │   ├── zephyr.py
│       │   └── cmsis.py
│       ├── drivers/
│       │   ├── catalog.py
│       │   ├── matcher.py
│       │   ├── interfaces.py
│       │   ├── skeleton.py
│       │   ├── mocks.py
│       │   └── licensing.py
│       ├── protocols/
│       │   ├── schema.py
│       │   ├── framing.py
│       │   ├── codec.py
│       │   ├── state_machine.py
│       │   ├── timeout_retry.py
│       │   └── tests.py
│       ├── generation/
│       │   ├── templates.py
│       │   ├── context.py
│       │   ├── renderer.py
│       │   ├── structured_emitters.py
│       │   ├── ownership.py
│       │   ├── manifest.py
│       │   ├── regeneration.py
│       │   └── merge.py
│       ├── dependencies/
│       │   ├── resolver.py
│       │   ├── cmsis_pack.py
│       │   ├── west.py
│       │   ├── esp_components.py
│       │   ├── sdk.py
│       │   ├── lockfile.py
│       │   ├── sbom.py
│       │   └── licenses.py
│       ├── build/
│       │   ├── workspace.py
│       │   ├── toolchains.py
│       │   ├── command_builder.py
│       │   ├── cmake.py
│       │   ├── logs.py
│       │   └── artifacts.py
│       ├── validation/
│       │   ├── configuration.py
│       │   ├── build.py
│       │   ├── static_analysis.py
│       │   ├── unit_tests.py
│       │   ├── emulation.py
│       │   ├── flash.py
│       │   ├── hil.py
│       │   └── gates.py
│       ├── reports/
│       ├── jobs/
│       ├── events/
│       ├── storage/
│       ├── security/
│       └── observability/
├── schemas/
├── policies/
├── device-metadata/
├── framework-profiles/
├── templates/
├── driver-catalog/
├── toolchain-images/
├── fixtures/
├── migrations/
├── tests/
├── benchmark/
└── scripts/
    ├── inspect_hardware_firmware_input.py
    ├── import_device_metadata.py
    ├── resolve_pinmux.py
    ├── resolve_clock_plan.py
    ├── validate_resource_plan.py
    ├── generate_firmware_project.py
    ├── regenerate_firmware_project.py
    ├── build_firmware_project.py
    ├── validate_firmware_project.py
    ├── run_firmware_hil.py
    └── run_firmware_generation_benchmark.py
```

---

# 98. 技术资料参考

实施前重新核验最新版本、命令和许可证：

```text
CMSIS 6 / CMSIS-Pack
https://arm-software.github.io/CMSIS_6/latest/General/cmsis_pack.html

STM32CubeMX
https://www.st.com/en/development-tools/stm32cubemx.html

STM32CubeMX CLI
https://dev.st.com/stm32cube-docs/stm32cubemx/

Zephyr Devicetree
https://docs.zephyrproject.org/latest/build/dts/index.html

ESP-IDF Component Manager
https://docs.espressif.com/projects/idf-component-manager/en/latest/

Raspberry Pi Pico SDK
https://www.raspberrypi.com/documentation/microcontrollers/c_sdk.html
```


---

# 99. Codex 分阶段实施

不要让 Codex 一次实现所有 MCU、所有 SDK、PinMux/Clock Solver、全部驱动、协议、RTOS、编译器和 HIL。

## Phase 0：仓库侦察与真实能力盘点

Codex 必须检查：

1. Agent 16、18、20、19 的真实实现和数据契约；
2. 当前 MCU/MPU 器件数据库、Pin、Alternate Function、Clock、DMA、IRQ 数据；
3. 当前 SVD、CMSIS-Pack、厂商 SDK 元数据；
4. 当前 STM32、ESP32、RP2040/RP2350、NXP、Nordic 支持；
5. 当前 Board Definition、BSP 和驱动库；
6. 当前 `circuit_canvas` 或 ezPLM 中的原理图到代码功能；
7. 当前 Pin-to-Net、Signal Role 和接口器件识别；
8. 当前 PinMux、Clock、DMA、IRQ、Timer 和 Memory Planner；
9. 当前 STM32CubeMX、ESP-IDF、Pico SDK、Zephyr、CMSIS 工具；
10. 当前 SDK、Compiler、CMake、Ninja 和 Container；
11. 当前生成模板、Code Ownership 和 Protected Region；
12. 当前 Driver Catalog、License 和版本；
13. 当前 Protocol Schema、State Machine 和 Codec；
14. 当前 FreeRTOS/Zephyr Task、Queue、ISR；
15. 当前 Build、Static Analysis、Unit Test、Emulation；
16. 当前 Flash、Probe、Board Farm 和 HIL；
17. 当前 Git、Workspace、Manifest、Lockfile 和 SBOM；
18. 当前 Queue、Worker、Object Storage、Database 和权限；
19. 当前 Fixture、Demo Board 和测试工程；
20. 统计支持 MCU/Framework/Profile 和真实完成度；
21. 统计 PinMux/Clock/Driver/Build 失败类型；
22. 抽样分析开源、合成、脱敏或授权工程；
23. 只运行只读环境探测；
24. 不生成或覆盖业务代码；
25. 不调用烧录；
26. 不操作 Fuse/Option Byte；
27. 不下载依赖；
28. 不安装 SDK/Toolchain；
29. 不创建 Migration；
30. 不读取或打印生产 Secret。

## Phase 1：Hardware-to-Firmware Contract 和 JSON Schema

实现：

- Input Snapshot；
- Device Metadata；
- Board IR；
- Signal IR；
- Pin Assignment；
- PinMux Candidate；
- Clock IR；
- Peripheral IR；
- DMA/IRQ/Timer；
- Memory；
- Driver Binding；
- Initialization Graph；
- Task；
- Protocol；
- Firmware Project IR；
- Manifest/Lockfile；
- JSON Schema。

## Phase 2：Agent 16/18/20 Input Adapters

实现：

- Hardware Revision；
- MCU Part/Package；
- Pin-to-Net；
- Pin-Pad Gate；
- External Device；
- Clock/Reset/Boot Nets；
- Evidence；
- Confidence；
- Unresolved Preservation；
- Snapshot Hash。

## Phase 3：Device Metadata Registry

实现：

- Exact Device/Package；
- Pin；
- Alternate Function；
- Peripheral；
- Clock；
- DMA；
- IRQ；
- Timer；
- ADC；
- Memory；
- Security；
- Source/Hash/License/Approval；
- Versioned Schema。

## Phase 4：CMSIS-Pack/SVD Import

实现：

- Pack Metadata；
- Device/Variant；
- Headers/Startup；
- SVD；
- Component Dependencies；
- Artifact Hash；
- Offline Cache；
- License；
- Validation；
- No Script Execution。

## Phase 5：Board 和 Signal IR

实现：

- MCU Instances；
- Nets；
- Signal Role Candidate；
- Voltage/Direction；
- External Devices；
- Interface Group；
- Debug/Boot；
- Clocks；
- Power；
- Evidence；
- Review Items。

## Phase 6：PinMux Domain 和 Hard Constraints

实现：

- Exact Package Pins；
- AF；
- Reserved Pins；
- Electrical；
- Peripheral Group；
- Debug/Boot/Oscillator；
- Analog/USB/High-speed；
- Existing Hardware Immutability；
- Explain Trace；
- Golden Tests。

## Phase 7：PinMux Solver

实现：

- Candidate Domain；
- Constraint Propagation；
- Backtracking/CP-SAT optional；
- Scoring；
- Alternative Solutions；
- Unsatisfied；
- Timeout；
- Deterministic Seed；
- Review Gate。

## Phase 8：Clock Model 和 Solver

实现：

- Sources；
- Mux/Divider/PLL；
- Core/Bus；
- Peripheral；
- Flash Latency；
- Voltage；
- Accuracy；
- Candidate；
- Official Tool Cross-check；
- Explain Trace。

## Phase 9：Peripheral Configuration Model

实现：

- GPIO/UART/SPI/I2C；
- ADC/DAC；
- Timer/PWM；
- CAN；
- USB；
- Configuration Schema；
- Connected Device；
- Ownership；
- Initialization Phase；
- Validation。

## Phase 10：DMA、IRQ 和 Timer Planner

实现：

- Request Mapping；
- Allocation；
- Conflict；
- Priority；
- RTOS-safe；
- Shared IRQ；
- PWM Frequency/Resolution；
- Input Capture；
- Explain Trace；
- Tests。

## Phase 11：Memory、Cache、Power 和 Boot Planner

实现：

- Flash/RAM；
- Stack/Heap；
- DMA-safe；
- Cache；
- External Memory；
- Partition；
- OTA Hook；
- Low-power；
- Wake；
- Bootloader/Application；
- Constraint Validation。

## Phase 12：Firmware Project IR 和 Profile Registry

实现：

- Project IR；
- Framework Profiles；
- Capability；
- Supported Devices；
- Build/Dependency/Driver Model；
- Code Ownership；
- Validation Backends；
- Profile Versioning。

## Phase 13：Template Engine 和 Generated-code Ownership

实现：

- Sandboxed Template；
- Typed Context；
- Path Allowlist；
- Manifest；
- Generated/User/Adapter；
- Protected Region Parser optional；
- Determinism；
- Golden Tests；
- No Arbitrary Read/Exec。

## Phase 14：BSP Generation Core

实现：

- Board Header；
- Pin Alias；
- Clock/Power；
- GPIO；
- Debug Console；
- Reset Reason；
- Watchdog；
- Board Init/Deinit；
- Revision；
- Diagnostics；
- Mock。

## Phase 15：Driver Interface 和 Skeleton Generator

实现：

- Driver Taxonomy；
- Config/Context；
- Sync/Async；
- Timeout；
- Error Mapping；
- ISR/DMA Callback；
- Thread Safety；
- Mock；
- Unit Test；
- Doxygen。

## Phase 16：Initialization Graph 和 Runtime Ownership

实现：

- Nodes/Edges；
- Phases；
- Cycle；
- Missing Dependency；
- Owner；
- Shared Resource；
- Failure Policy；
- Generated Init；
- Deinit；
- Diagnostics。

## Phase 17：RTOS Task Framework

实现：

- FreeRTOS/Generic Task IR；
- Priority；
- Stack；
- Queue/Event/Semaphore；
- ISR Deferral；
- Watchdog；
- Ownership；
- Static Allocation Hook；
- Unit Tests。

## Phase 18：Protocol Framework Generator

实现：

- Schema；
- Framing；
- Encoder/Decoder；
- Streaming Parser；
- State Machine；
- Timeout/Retry；
- CRC；
- Version；
- Mock Transport；
- Unit/Fuzz Tests；
- No Custom Crypto。

## Phase 19：CMSIS Bare-metal Adapter

实现：

- Pack/SDK；
- Startup/System；
- Linker Hook；
- Vector；
- BSP；
- Build；
- Example；
- Compile；
- Contract Tests。

## Phase 20：STM32Cube Adapter

实现：

- Exact Device/Package；
- `.ioc` or supported config；
- CubeMX CLI；
- HAL/LL；
- FreeRTOS Hook；
- Project Generation；
- Generated/User Separation；
- Re-run；
- Compile；
- Version Lock；
- Contract Tests。

## Phase 21：ESP-IDF Adapter

实现：

- Project Layout；
- `sdkconfig.defaults`；
- Partition；
- Components；
- `idf_component.yml`；
- Dependency Lock；
- GPIO/Peripheral；
- FreeRTOS；
- Example；
- Build；
- Contract Tests。

## Phase 22：Pico SDK Adapter

实现：

- RP2040/RP2350；
- Board Header；
- CMake；
- GPIO/UART/SPI/I2C/ADC/PWM；
- DMA；
- PIO Hook；
- Multicore Hook；
- TinyUSB；
- Build；
- Contract Tests。

## Phase 23：Zephyr Adapter

实现：

- Board/Revision；
- DTS/Overlay；
- Kconfig；
- `prj.conf`；
- West Manifest；
- Existing Binding/Driver Reuse；
- Custom Binding Gate；
- Sample；
- Build；
- Twister Hook；
- Contract Tests。

## Phase 24：NXP/Nordic Adapters，可按优先级拆分

实现：

- MCUXpresso；
- nRF Connect；
- Device Metadata；
- Devicetree/Config；
- SDK Components；
- Build；
- Contract Tests。

## Phase 25：Dependency、Lockfile、SBOM 和 License

实现：

- SDK/Pack/Module/Component；
- Toolchain；
- Driver；
- Template；
- Resolve；
- Lock；
- Replay；
- SBOM；
- License Gate；
- Offline/Proxy；
- No Unapproved Download。

## Phase 26：Regeneration 和 Three-way Merge

实现：

- Previous Manifest；
- Generated File Change；
- User File Preserve；
- Structured Config Merge；
- Three-way；
- Obsolete File；
- Conflict；
- Preview；
- Approval；
- Rollback。

## Phase 27：Build Workspace 和 Toolchain Adapters

实现：

- Container/Private Worker；
- Safe Command Builder；
- CMake/Ninja；
- Vendor Tool；
- Environment；
- Cache；
- Logs；
- Artifacts；
- Timeout；
- Resource Limit；
- No Free Shell。

## Phase 28：Static Analysis 和 Unit Tests

实现：

- Warning Gate；
- clang-tidy/cppcheck；
- Host Unit Tests；
- Mocks；
- Coverage；
- Protocol Fuzz；
- Reports；
- Baseline；
- No Fake Pass。

## Phase 29：Emulation、Flash 和 HIL

实现：

- QEMU/Renode Hook；
- Board Registry；
- Reservation；
- Target Identity；
- Flash Permission；
- Serial Capture；
- Smoke Test；
- Safe Power；
- Result；
- Cleanup；
- No Fuse/Key。

## Phase 30：Review Workbench

实现：

- Board/Signal；
- PinMux Candidate；
- Clock Tree；
- Resource Map；
- Driver Binding；
- Task/Protocol；
- Generated Diff；
- Build/Test；
- Approval；
- Flash/HIL；
- Traceability。

## Phase 31：API、Events、Storage 和 Private Worker

实现：

- APIs；
- Progress；
- Batch；
- Cancel/Retry；
- Object Storage；
- JSONL；
- Permissions；
- Worker Registration；
- Artifact Signing；
- Event Version；
- Audit。

## Phase 32：Benchmark、监控和生产发布

实现：

- MCU/Profile Matrix；
- Golden Boards；
- PinMux/Clock；
- Resource Conflict；
- Generation Determinism；
- Regeneration；
- Build；
- Security；
- HIL；
- Metrics；
- Dashboard；
- Feature Flags；
- Rollback；
- Disaster Recovery。

## Phase 33：AI 辅助业务代码，可选

稳定后：

- Application Skeleton；
- CLI Commands；
- Example Logic；
- Comment/Docs；
- Test Candidate；
- Code Review Suggestion；
- 必须在 User/App 层；
- 不修改 Hardware Configuration Truth；
- 不操作密钥；
- 同样 Build/Test/Review。

---

# 100. Codex 工作纪律

Codex 必须：

1. Hardware Facts、Software Intent、Resolved Configuration 和 Generated Artifacts 分开；
2. Exact MCU 和 Package 是必填；
3. 系列名不能代替完整型号；
4. Device Metadata 需要来源、Hash、版本、许可证和批准状态；
5. PDF 抽取只作为候选；
6. Agent 18必须达到允许的 Release Level；
7. Agent 20 Pin-Pad Block 时不生成确定性固件；
8. Net Name 不直接等于 Signal Role；
9. Signal Role 有证据和审核状态；
10. Existing PCB Pin Connection 不可由 Solver 改变；
11. PinMux 不是 LLM 决策；
12. Clock 不是 LLM 决策；
13. DMA/IRQ/Timer 不是 LLM 决策；
14. Memory/Security 不是 LLM 决策；
15. Hard Constraint 不能被评分覆盖；
16. Candidate 与 Selected 分开；
17. Ambiguous PinMux 不自动发布；
18. 封装不可用 Pin 不得分配；
19. Reserved Debug/Boot/Oscillator Pin 明确；
20. Open-drain、Pull-up、电压容限参与；
21. Clock Plan 保存全部节点和误差；
22. 官方 Tool 可交叉验证但不替代输入快照；
23. Tool Success 不等于配置正确；
24. Peripheral Instance、Pin、Clock、DMA 和 IRQ 一致；
25. Resource 不得重复分配；
26. Shared IRQ 显式；
27. RTOS Priority 规则校验；
28. ISR 不执行阻塞 API；
29. Driver Ownership 明确；
30. 初始化顺序为 DAG；
31. 循环依赖阻断；
32. Driver Catalog 有版本、Hash、许可证；
33. 优先复用官方/框架驱动；
34. 未找到驱动时生成 Skeleton，不伪造完整实现；
35. 不自研密码算法；
36. 生成代码和用户代码分开；
37. User File 不覆盖；
38. Generated File 被人工修改时创建冲突；
39. 再生成使用 Manifest；
40. Three-way Merge 有 Base；
41. 删除旧生成文件需要 Preview；
42. Template 使用 Sandbox；
43. Template 不读取任意文件；
44. 输出路径受控；
45. 依赖不自动下载；
46. Toolchain/SDK/Pack 锁定；
47. Lockfile 是 Sidecar 或平台原生锁的汇总；
48. Build Command 不用自由 Shell；
49. 工程脚本默认不执行；
50. Vendor Tool 参数类型化；
51. Build 结果来自真实命令；
52. 编译成功不等于功能正确；
53. Static/Test/HIL 结果不伪造；
54. Flash 需要独立权限；
55. Target Identity 必须匹配；
56. Fuse/Option Byte/Secure Boot/Encryption 默认禁止；
57. 不生成生产密钥；
58. HIL 有安全限制；
59. Hardware/Firmware Revision 可追溯；
60. Manifest/Lockfile/SBOM 完整；
61. 所有生成文件可追溯到 Template 和 Input Hash；
62. 模板或 SDK 升级不覆盖历史结果；
63. AI 只能辅助 User/App 层；
64. AI 生成代码必须标注来源并测试；
65. 不将私有代码和硬件资料发给外部模型；
66. 公开 Fixture 必须有许可；
67. 不伪造能力、版本、生成、编译、测试或 Benchmark；
68. 每个 Phase 必须输出：
    - 修改文件；
    - Schema/API 变化；
    - Metadata/Profile/Adapter 变化；
    - 测试命令；
    - 真实结果；
    - PinMux/Clock Metrics；
    - Resource Conflicts；
    - Generated Manifest；
    - Build/Test；
    - Regeneration；
    - Security；
    - 性能；
    - 已知问题；
    - 下一阶段建议。

---

# 101. 第一次交给 Codex 的主提示词

将本文件保存为：

```text
docs/firmware-generation-agent-spec.md
```

然后交给 Codex：

```text
你正在为 ezPLM / EEAgent 开发第21个 Agent：

Firmware, BSP, Driver & Protocol Framework Generation Agent /
固件与驱动框架生成 Agent。

本 Agent 接收：

- Agent 16 的 MCU、Part、Pin 和 Net；
- Agent 18 Reviewed Pin-to-Net；
- Agent 20 Pin-Pad 和库校验；
- MCU Exact MPN/Package；
- Device Metadata、CMSIS-Pack、SVD 和批准 SDK；
- 用户的软件功能、接口、实时性、功耗和工具链要求；

生成：

- Board IR；
- Signal IR；
- PinMux IR；
- Clock IR；
- Peripheral IR；
- DMA/IRQ/Timer/Memory Plan；
- Firmware Project IR；
- BSP；
- Driver Interface/Skeleton；
- Initialization Graph；
- RTOS Task Framework；
- Protocol Framework；
- Examples；
- Build/Dependency/Lockfile/SBOM；
- Build/Test/Static-analysis Report；
- Optional Flash/HIL Plan。

本 Agent 不使用 LLM 决定 PinMux、Clock、DMA、IRQ、Memory 和安全配置，不覆盖用户代码，不自动下载依赖，不自动烧录生产设备。

请先完整阅读：

1. 仓库根目录 AGENTS.md；
2. Agent 16、18、19、20 规格和实际代码；
3. docs/firmware-generation-agent-spec.md；
4. 当前 MCU/Pin/AF/Clock/DMA/IRQ 数据库；
5. 当前 CMSIS-Pack、SVD、Vendor SDK；
6. 当前 STM32、ESP32、RP2040/RP2350、NXP、Nordic 支持；
7. 当前 Board/BSP/Driver；
8. 当前 Pin-to-Net、Signal Role 和 External Device；
9. 当前 PinMux/Clock/Resource Planner；
10. 当前 Firmware Template 和 Code Ownership；
11. 当前 STM32CubeMX、ESP-IDF、Pico SDK、Zephyr、CMSIS；
12. 当前 FreeRTOS/Zephyr Task；
13. 当前 Protocol/Codec/State Machine；
14. 当前 Build/Toolchain/Container；
15. 当前 Static Analysis/Unit Test/Emulation；
16. 当前 Flash/HIL/Board Registry；
17. 当前 Manifest/Lockfile/SBOM；
18. 当前 API/Queue/Worker/Storage/Permission；
19. 开源、合成、脱敏或授权 Fixture。

硬约束：

- Hardware Facts/Software Intent/Resolved Config/Artifacts 分层；
- Exact MCU + Package；
- Device Metadata 有 Source/Hash/Version/License/Approval；
- PDF 数据只作候选；
- Agent 18 Release Level Gate；
- Agent 20 Block 时不发布；
- Net Name != Signal Role；
- Existing Hardware Pin 不被 Solver 修改；
- PinMux/Clock/DMA/IRQ/Memory/Security 不由 LLM 决定；
- Hard Constraint 不被 Score 覆盖；
- Ambiguous Candidate 不自动发布；
- AF 必须适用于 Exact Package；
- Debug/Boot/Oscillator/USB/Analog/Electrical Constraint；
- Clock/DMA/IRQ/Timer 有 Explain Trace；
- Resource 不重复分配；
- Initialization 为 DAG；
- Driver 有 Version/Hash/License；
- 优先官方/框架 Driver；
- 缺失 Driver 生成 Skeleton；
- 不自研 Crypto；
- Generated/User Code 分开；
- User File 不覆盖；
- Generated Edit 形成 Conflict；
- Manifest-based Regeneration；
- Three-way Merge 有 Base；
- Template Sandbox；
- Output Path Allowlist；
- 不自动下载依赖；
- SDK/Toolchain/Pack 锁定；
- No Free-form Shell；
- Vendor Tool Typed Args；
- Build/Test 必须真实；
- Compile != Function Correct；
- Flash Separate Permission；
- Target Identity Match；
- Fuse/Option Byte/Secure Boot/Encryption 默认禁止；
- 不生成生产密钥；
- HIL 安全限制；
- 所有文件可追溯到 Input/Template；
- AI 只辅助 User/App 层；
- 不发私有代码给外部模型；
- 不用私有源码做公开 Fixture；
- 不伪造版本、生成、编译、测试和 Benchmark。

现在只执行 Phase 0，不实现业务代码，不生成固件，不烧录：

1. 侦察当前仓库；
2. 检查 Agent 16/18/19/20 Contract；
3. 查找 MCU Device Metadata；
4. 查找 Pin/AF/Clock/DMA/IRQ/Timer/Memory；
5. 查找 CMSIS-Pack/SVD/SDK；
6. 查找 Board/BSP/Driver；
7. 查找 Pin-to-Net/Signal Role；
8. 查找 PinMux/Clock/Resource Solver；
9. 查找 STM32CubeMX/ESP-IDF/Pico SDK/Zephyr/CMSIS；
10. 查找 FreeRTOS/Task/Queue/ISR；
11. 查找 Protocol/Codec/State Machine；
12. 查找 Template/Generated/User Code；
13. 查找 Manifest/Lockfile/SBOM；
14. 查找 Build/Toolchain/Container；
15. 查找 Static Analysis/Test/Emulation；
16. 查找 Flash/HIL；
17. 查找 API/Queue/Worker/Storage/Permission；
18. 统计真实支持的 MCU/Profile/Adapter；
19. 统计 PinMux/Clock/Driver/Build 失败；
20. 抽样分析开源、合成、脱敏或授权工程；
21. 在 docs/firmware-generation-implementation-plan.md 中生成实施计划；
22. 在 docs/hardware-to-firmware-contract.md 中定义输入；
23. 在 docs/device-metadata-model.md 中定义设备元数据；
24. 在 docs/board-and-signal-ir.md 中定义 Board/Signal；
25. 在 docs/pinmux-resolution.md 中定义 PinMux；
26. 在 docs/clock-resolution.md 中定义 Clock；
27. 在 docs/dma-irq-timer-planning.md 中定义资源；
28. 在 docs/memory-and-power-planning.md 中定义 Memory/Power；
29. 在 docs/firmware-project-ir.md 中定义 Project IR；
30. 在 docs/framework-profiles.md 中定义 Profile；
31. 在 docs/platform-adapters.md 中定义 Adapter；
32. 在 docs/bsp-and-driver-generation.md 中定义 BSP/Driver；
33. 在 docs/initialization-and-rtos.md 中定义 Init/RTOS；
34. 在 docs/protocol-framework.md 中定义 Protocol；
35. 在 docs/generated-code-ownership.md 中定义代码边界；
36. 在 docs/dependencies-and-lockfile.md 中定义依赖；
37. 在 docs/build-test-hil.md 中定义验证；
38. 在 docs/security.md 中定义安全；
39. 在 docs/firmware-generation-migration-plan.md 中定义旧能力迁移；
40. 在 docs/firmware-generation-benchmark-plan.md 中定义 Benchmark；
41. 给出拟新增、拟修改和拟复用文件；
42. 给出 Phase 1 精确范围；
43. 不修改业务代码；
44. 不创建 Migration；
45. 不安装 SDK/Toolchain；
46. 不下载依赖；
47. 不生成固件；
48. 不烧录；
49. 不读取或打印 Secret；
50. 运行仓库已有 lint、type check、test、build 和 security scan；
51. 真实记录命令和结果。

最终回复必须包含：

- 仓库现状；
- Agent 16/18/19/20 Contract；
- Device Metadata；
- Board/Signal IR；
- PinMux；
- Clock；
- DMA/IRQ/Timer；
- Memory/Power/Boot；
- Firmware Project IR；
- Framework Profiles；
- Platform Adapters；
- BSP/Driver；
- Initialization/RTOS；
- Protocol；
- Generated/User Code；
- Dependency/Lockfile/SBOM；
- Build/Test/HIL；
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

# 102. 后续 Phase 提示词模板

```text
继续实现 Firmware Generation Agent 的 Phase {N}。

开始前：

1. 阅读 AGENTS.md；
2. 阅读 Agent 16、18、19、20、21 规格；
3. 阅读 Firmware Generation Implementation Plan；
4. 阅读 Metadata、Board、PinMux、Clock、Resource、Project IR、Profile、Adapter、Driver、Protocol、Generation、Dependency、Validation 和 Security 文档；
5. 检查上一阶段代码和测试；
6. 只修改本阶段范围。

本阶段目标：

{粘贴 Phase N 的目标和验收标准}

硬约束：

- Facts/Intent/Resolved/Artifacts Separation；
- Exact Device/Package；
- Versioned Metadata；
- Deterministic PinMux/Clock/Resource；
- Generated/User Separation；
- Manifest-based Regeneration；
- Locked Dependencies/Toolchain；
- Real Build/Test；
- No Arbitrary Shell；
- No Unapproved Flash；
- 不公开真实工程和代码；
- 不重构无关代码。

执行顺序：

1. 列出本阶段文件；
2. 先写 Golden/Property/Contract/Security Tests；
3. 实现；
4. 格式化；
5. lint；
6. typecheck；
7. unit test；
8. integration test；
9. adapter contract test；
10. deterministic generation test；
11. regeneration test；
12. build/static/test；
13. security test；
14. performance test；
15. benchmark；
16. 更新文档；
17. 真实总结。

最终回复：

- 修改文件；
- Schema/API 变化；
- Metadata/Profile/Adapter 变化；
- 测试命令和真实结果；
- PinMux/Clock Metrics；
- Resource Conflicts；
- Generated Manifest；
- Build/Test；
- Regeneration；
- 性能；
- 安全；
- 已知限制；
- 下一阶段建议。
```

---

# 103. MVP 演示流程

1. 选择一个 RP2350B 双通道口袋仪器工程；
2. Agent 16读取 MCU、Pin 和 Net；
3. Agent 18提供 Reviewed Pin-to-Net；
4. Agent 20确认 Pin-Pad 无阻断错误；
5. 加载 RP2350B Exact Package Device Metadata；
6. 识别 USB、ADC、PWM、I2C、SPI、LCD、按键和 LED 信号；
7. `SCL/SDA` 仅形成 I2C 候选；
8. 用户确认使用 I2C0；
9. PinMux 校验现有 PCB 连接；
10. 发现两个信号试图占用同一 PWM Slice；
11. 生成两个资源候选；
12. 用户选择保留示波器触发，调整蜂鸣器 PWM 资源；
13. 解析 12 MHz 外部晶振和系统时钟；
14. 生成 Clock Plan；
15. 分配双 ADC Capture 的 DMA；
16. 建立 USB CDC IRQ；
17. 建立 LCD SPI、Touch I2C 和 SD SPI；
18. 检查 DMA Buffer 对齐；
19. 建立 Memory Plan；
20. 选择 `pico-sdk-freertos` Profile；
21. 生成 Board Header 和 Pin Alias；
22. 生成 Clock/GPIO/DMA/IRQ Init；
23. 生成 ADC Capture Driver Interface；
24. 生成 PWM/AWG Driver Skeleton；
25. 生成 LCD/Touch/SD Adapter；
26. 生成 FreeRTOS Tasks；
27. 生成 Waveform Queue 和 Control Event；
28. 生成 USB CDC 命令协议框架；
29. 生成命令 Encoder/Decoder 和单元测试；
30. 生成 `main` Bring-up Example；
31. 生成 CMake 和 Pico SDK Lock；
32. 编译；
33. 发现一个 RAM Buffer 超出预算；
34. Memory Gate 阻止发布；
35. 调整采样缓冲为分块双缓冲；
36. 重新生成；
37. Build 通过；
38. 协议单元测试通过；
39. 静态分析发现 ISR 中调用阻塞 Queue API；
40. 修复为 FromISR API；
41. 再次验证；
42. 创建 Firmware Manifest、Lockfile 和 SBOM；
43. 用户批准实验板烧录；
44. 验证 Board ID；
45. 烧录 Debug Image；
46. 串口打印 Hardware Revision、Firmware Hash 和 Reset Reason；
47. 运行 LED、Button、I2C Sensor ID、LCD 和 USB Smoke Test；
48. ADC HIL 输入已知波形；
49. 检查采样频率和数据完整性；
50. 生成 HIL Report；
51. 修改 PCB Revision 中一个 Pin；
52. 触发 Incremental Regeneration；
53. 只修改 Board/PinMux/Init 层；
54. 用户业务代码保持不变；
55. 发布 `firmware.source.ready`。

---

# 104. 生产上线顺序

第一阶段：

```text
Agent 16/18/20 Input
Exact MCU/Package Metadata
Board/Signal IR
PinMux/Clock Validation
Firmware Project IR
CMSIS/Pico/ESP-IDF 单一 Profile
BSP/Driver Skeleton
Manifest/Lockfile
Real Build
```

第二阶段：

```text
STM32Cube
Zephyr
FreeRTOS Task
DMA/IRQ/Timer
Protocol Framework
Regeneration
Static/Unit Tests
```

第三阶段：

```text
NXP/Nordic
Multi-core/Security
Flash/HIL
Driver Catalog
AI-assisted App Layer
Production Release Integration
```

上线优先确保：

```text
代码对应的是哪颗 MCU 和哪个封装
每个信号为什么分配到这个引脚和外设
时钟、DMA、中断和内存有没有冲突
哪些文件可以重新生成，哪些绝不能覆盖
编译和测试是否真的执行过
```

固件生成最危险的结果，不是编译报错，而是代码顺利编译、也能下载，却把一个实际接在 `SPI1` 的器件初始化成了 `SPI0`，或者在两个任务里同时驱动同一个外设。第21个 Agent 的价值，就是在写出第一行驱动代码之前，先把这些硬件事实和资源所有权钉死。
