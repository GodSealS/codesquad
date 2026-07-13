# CodeSquad Skill 使用参考

> **版本**：v1.2.0
> **Skill 总数**：76（不含 engine/team 专属 skill）
> **生成日期**：2026-07-07
> **来源**：`.codesquad/skills/*/SKILL.md`

---

## 目录

1. [创作类 (authoring)](#1-创作类-authoring)
2. [流水线类 (pipeline)](#2-流水线类-pipeline)
3. [审查类 (review)](#3-审查类-review)
4. [分析类 (analysis)](#4-分析类-analysis)
5. [Sprint 类 (sprint)](#5-sprint-类-sprint)
6. [工具类 (utility)](#6-工具类-utility)
7. [就绪类 (readiness)](#7-就绪类-readiness)
8. [门禁类 (gate)](#8-门禁类-gate)

---

## 1. 创作类 (authoring)

### architecture-decision
- **描述**：创建架构决策记录（ADR），记录重大技术决策及其上下文、考虑的替代方案和后果。每个重大技术选择都应有 ADR。
- **使用场景**：
  - 为重大技术选择（如事件系统架构、物理引擎选择）创建正式决策记录
  - 已有 ADR 缺少关键章节（Status、ADR Dependencies、Engine Compatibility），需要 retrofit 补全
  - 在编写代码之前，将架构决策文档化并经引擎专家和技术总监审查
  - 两个 ADR 之间存在冲突，需要记录替代或废弃关系
- **示例**：`/architecture-decision event-system-architecture --review full`

### art-bible
- **描述**：引导式逐节美术圣经编写。创建作为所有资产生产门槛的视觉识别规范。在 `/brainstorm` 获批后、`/map-systems` 或任何 GDD 编写开始前运行。
- **使用场景**：
  - 游戏概念获批后，在编写 GDD 之前建立完整的视觉识别规范
  - 为外包团队提供足够具体的美术方向
  - 补充缺失章节（retrofit 模式）
- **示例**：`/art-bible --review full`

### brainstorm
- **描述**：引导式游戏概念构思——从零想法到结构化的游戏概念文档。使用专业工作室构思技术、玩家心理学框架和结构化的创意探索。
- **使用场景**：
  - 从零开始构思新游戏，需要结构化创意引导
  - 将模糊想法发展为完整概念
  - 验证概念的目标玩家类型和市场可行性
- **示例**：`/brainstorm cozy farming --review full`

### create-architecture
- **描述**：引导式逐节编写游戏的主架构文档。读取所有 GDD、系统索引、现有 ADR 和引擎参考库，生成完整的架构蓝图。
- **使用场景**：
  - 所有 GDD 获批后，将设计文档转化为技术架构蓝图
  - 定义模块间的 API 边界和接口契约
  - 审计现有 ADR 质量
- **示例**：`/create-architecture full --review full`

### design-system
- **描述**：引导式逐节 GDD 编写，针对单个游戏系统。从现有文档收集上下文，逐节协作推进，交叉引用依赖关系。
- **使用场景**：
  - 从头开始为游戏系统编写完整设计文档
  - 为已有 GDD 补充缺失章节（retrofit 模式）
  - 通过专家 Agent 协作确保设计质量
- **示例**：`/design-system combat-system --review full`

### design-with-kb
- **描述**：在实现前搜索知识库匹配的设计模式和技术。按领域/标签/引擎匹配，读取候选章节，输出适用性评估。
- **使用场景**：
  - 搜索知识库中已有的设计模式
  - 按引擎、领域、标签匹配技术方案
  - 评估候选技术的适用度
- **示例**：`/design-with-kb 大量物体近邻查询 unreal`

### prototype
- **描述**：引导式原型工作流，编写代码创建快速游戏原型或垂直切片。从概念/设计输入创建可玩实现以验证核心机制。
- **使用场景**：
  - 快速验证核心玩法是否有趣
  - 在编写 GDD 之前通过可玩原型验证假设
  - 生产中以 spike 模式快速测试特定技术问题
- **示例**：`/prototype "grappling hook traversal" --path html`

### quick-design
- **描述**：轻量级设计规范，适用于小改动——调优调整、小机制修改、平衡微调。跳过完整 GDD 编写，生成直接嵌入 Story 文件的快速设计规范。
- **使用场景**：
  - 需要做调优/微调但不需要完整 GDD
  - 改动约 4 小时以内实现量
  - 系统 GDD 已存在只需小修改
- **示例**：`/quick-design "increase jump height from 5 to 6 units"`

### spec-driven
- **描述**：创建结构化技术规格说明（6 区域）：概述、架构、接口契约、数据模型、约束和验收标准。
- **使用场景**：
  - 在 `/brainstorm` 之前建立结构化技术基础
  - 为功能或组件创建完整技术规格
  - 与架构师、性能分析师、安全工程师审查规格
- **示例**：`/spec-driven combat-system`

### ux-design
- **描述**：引导式逐节 UX 规范编写，针对屏幕、流程或 HUD。读取游戏概念、玩家旅程和相关 GDD。
- **使用场景**：
  - 为特定屏幕或流程编写 UX 规范
  - 设计游戏 HUD
  - 创建和维护交互模式库
- **示例**：`/ux-design main-menu`

---

## 2. 流水线类 (pipeline)

### adopt
- **描述**：棕地项目接入——审查现有项目产物与模板格式的合规性，按影响程度分类差距，生成编号化的迁移计划。
- **使用场景**：
  - 加入已有产物的进行中项目
  - 从旧版模板升级到新版
  - 验证现有 GDD/ADR/Story 能否被管道技能正确读取
- **示例**：`/adopt full`

### asset-audit
- **描述**：审查游戏资产是否符合命名规范、文件大小预算、格式标准和管道要求。识别孤立资产、缺失引用和标准违规。
- **使用场景**：
  - 全面检查命名规范合规性和文件大小
  - 识别孤立资产以清理项目
  - 交付前最终资产健康检查
- **示例**：`/asset-audit all`

### asset-spec
- **描述**：从 GDD、关卡文档或角色设定生成逐资产的视觉规范和 AI 生成提示。
- **使用场景**：
  - GDD 获批后，为视觉资产生成具体制作规范
  - 为 AI 图像生成工具准备提示
  - 建立资产清单并检查可复用资产
- **示例**：`/asset-spec system:combat --review full`

### create-control-manifest
- **描述**：从所有 Accepted ADR、技术偏好和引擎参考中生成扁平化、可执行的规则清单。
- **使用场景**：
  - 架构审查通过后，为程序员生成可直接查阅的规则清单
  - 新 ADR 被接受后重新生成
  - 快速了解所在层级的"必须做"和"绝不能做"
- **示例**：`/create-control-manifest update`

### day-one-patch
- **描述**：为游戏发布准备首日补丁。范围界定、优先级排序、实施并在黄金大师之后进行聚焦修复。
- **使用场景**：
  - 黄金大师版本锁定后存在已知 Bug
  - 认证反馈要求小幅修复
  - 发布前试玩暴露出必须修复的问题
- **示例**：`/day-one-patch known-bugs`

### git-workflow
- **描述**：游戏开发 Git 工作流管理：一任务一提交、主干开发、分支策略和合并冲突处理。
- **使用场景**：
  - 在 `/dev-story` 中自动执行 Implement→Test→Verify→Commit 循环
  - 手动检查 Git 状态
  - 处理合并冲突
- **示例**：`/git-workflow status`

### hotfix
- **描述**：绕过正常 Sprint 流程的紧急修复工作流，保留完整审计追踪。
- **使用场景**：
  - S1/S2 级别线上 Bug 紧急修复
  - 需要 lead-programmer、qa-tester、producer 三方审批
  - 部署后 48 小时内事后复盘
- **示例**：`/hotfix BUG-001`

### localize
- **描述**：完整的本地化管道：扫描硬编码字符串、提取和管理字符串表、验证翻译、文化敏感度审查等。
- **使用场景**：
  - 扫描源码中的硬编码字符串
  - 提取字符串并生成翻译就绪的字符串表
  - 验证翻译完整性、占位符一致性和长度限制
  - RTL 语言布局适配检查
- **示例**：`/localize scan`

### map-systems
- **描述**：将游戏概念分解为独立系统，映射依赖关系，优先排序设计顺序，并创建系统索引。
- **使用场景**：
  - 将游戏概念分解为多个系统
  - 确定系统间的依赖关系和设计顺序
  - 创建或更新系统索引
- **示例**：`/map-systems next`

### planning
- **描述**：工程任务分解：依赖图→垂直切片→验收标准→tasks/plan.md。与 Epic/Story 拆分不同——这是"如何构建"，而非"构建什么"。
- **使用场景**：
  - Sprint 规划后将 Story 分解为可实施的工程任务
  - 构建依赖图和垂直切片
  - 为任务分配规模和验收标准
- **示例**：`/planning combat-system`

### qa-plan
- **描述**：为 Sprint 或功能生成 QA 测试计划。按测试类型分类 Story，生成自动化测试需求、手动测试用例、冒烟测试范围和试玩签收要求。
- **使用场景**：
  - Sprint 开始前生成测试计划
  - 按测试类型分类 Story
  - 定义冒烟测试范围和试玩签收要求
- **示例**：`/qa-plan sprint`

### release-checklist
- **描述**：根据项目阶段生成发布清单。按所需产物分类，支持里程碑追踪和证据收集。
- **使用场景**：
  - 准备发布时生成全面检查清单
  - 按平台（PC/主机/移动端）生成特定检查项
  - 验证代码健康、构建质量、内容完整性
- **示例**：`/release-checklist pc`

### scope-check
- **描述**：分析功能或 Sprint 的范围蔓延。标记新增项、量化膨胀程度、建议削减。
- **使用场景**：
  - 检测功能或 Sprint 是否存在范围蔓延
  - 量化范围膨胀程度
  - 里程碑前重新验证范围是否受控
- **示例**：`/scope-check sprint-3`

### tdd
- **描述**：测试驱动开发工作流：先写失败测试，再实现最小代码通过测试，然后重构。严格遵循 Red-Green-Refactor 循环。
- **使用场景**：
  - 以测试优先的方式构建功能
  - 修复 Bug 时使用 Prove-It Bug Fix 工作流
  - 确保每个验收标准都有测试覆盖
- **示例**：`/tdd production/epics/core/story-damage-calculator.md`

### vertical-slice
- **描述**：引导式垂直切片工作流，从端到端设计到可玩实现。选择功能子集贯穿所有系统层以验证核心游戏循环。
- **使用场景**：
  - Pre-Production 后期验证核心游戏循环
  - PIVOT 判定后重新验证修订方向
  - 收集真实生产速率数据用于 Sprint 规划
- **示例**：`/vertical-slice --review full`

---

## 3. 审查类 (review)

### architecture-review
- **描述**：构建可追溯性矩阵，将每个 GDD 技术需求映射到 ADR，识别覆盖缺口，检测跨 ADR 冲突，验证引擎兼容性一致性。输出 PASS/CONCERNS/FAIL 判定。
- **使用场景**：
  - Pre-Production 门禁前验证 GDD 需求的 ADR 覆盖
  - 检测跨 ADR 冲突
  - 验证引擎 API 版本兼容性
  - 生成需求可追溯性矩阵（RTM 模式）
- **示例**：`/architecture-review full`

### code-review
- **描述**：对指定文件执行架构和质量代码审查。检查编码规范、架构模式遵循、SOLID 原则、模块深度、接缝设计和性能问题。
- **使用场景**：
  - 开发者提交代码后进行架构级和质量级审查
  - 检查 ADR 遵循情况
  - 评估模块深度、接缝质量和可测试性
  - 引擎专家对特定语言/着色器/UI 代码进行专项审查
- **示例**：`/code-review src/combat/attack.gd`

### design-review
- **描述**：审查游戏设计文档的完整性、内部一致性、可实现性和项目设计标准遵循。在将设计文档交给程序员之前运行。
- **使用场景**：
  - GDD 交给程序员前验证文档完备性
  - 检查 8 个必需章节是否完整
  - 在 full 模式下通过多个专家 Agent 进行对抗性审查
- **示例**：`/design-review design/gdd/combat-system.md --depth full`

### milestone-review
- **描述**：生成全面的里程碑进度审查，包括功能完成度、质量指标、风险评估和 Go/No-Go 建议。
- **使用场景**：
  - 里程碑检查点评估整体进度
  - 生成功能完成度和风险评估报告
  - Go/No-Go 决策建议
- **示例**：`/milestone-review current`

### review-all-gdds
- **描述**：全面的跨 GDD 一致性和游戏设计审查。检查矛盾、过时引用、所有权冲突、公式不兼容和游戏设计理论违规。
- **使用场景**：
  - 所有 MVP GDD 编写完成后跨文档一致性审查
  - 从游戏设计理论角度发现主导策略和经济失衡
  - 架构开始前确保 GDD 之间没有矛盾
- **示例**：`/review-all-gdds full`

### test-evidence-review
- **描述**：测试文件和手动证据文档的质量审查。评估断言覆盖率、边界情况处理、命名规范和证据完整性。生成 ADEQUATE/INCOMPLETE/MISSING 判定。
- **使用场景**：
  - QA 签收前的测试质量评估
  - 里程碑审查中对 Logic/Integration Story 进行质量审计
  - 评估断言覆盖率和证据完整性
- **示例**：`/test-evidence-review sprint`

### ux-review
- **描述**：验证 UX 规范、HUD 设计或交互模式库的完整性、无障碍合规性、GDD 一致性和实现就绪度。生成 APPROVED/NEEDS REVISION/MAJOR REVISION NEEDED 判定。
- **使用场景**：
  - `/ux-design` 完成后验证 UX 规范
  - 移交给 ui-programmer 或 art-director 前
  - Pre-Production→Production 关卡检查前
- **示例**：`/ux-review all`

---

## 4. 分析类 (analysis)

### balance-check
- **描述**：分析游戏平衡数据文件、公式和配置，识别异常值、断裂的成长曲线、退化策略和经济失衡。
- **使用场景**：
  - 修改武器/技能数值后检查 DPS 和击杀时间
  - 调整经济系统后检查无限资源循环
  - 设计升级曲线后检查死区和能力跳跃点
  - 配置掉落系统后验证稀有度分布
- **示例**：`/balance-check combat`

### bug-report
- **描述**：从描述创建结构化 Bug 报告，或分析代码识别潜在 Bug。确保每个 Bug 报告包含完整的复现步骤、严重程度评估和上下文。
- **使用场景**：
  - 将口头或文字描述的 Bug 整理为结构化报告
  - 审查代码文件时系统化分析潜在 Bug
  - Bug 修复后验证是否真正生效
  - Bug 验证通过后正式关闭
- **示例**：`/bug-report analyze src/combat/damage.gd`

### consistency-check
- **描述**：扫描所有 GDD 与实体注册表，检测跨文档不一致：同一实体不同属性、同一物品不同数值、同一公式不同变量。
- **使用场景**：
  - 新 GDD 写完后检查数值冲突
  - 在 `/review-all-gdds` 之前进行快速不一致性扫描
  - 在 `/create-architecture` 之前确保跨文档数据一致
- **示例**：`/consistency-check full`

### content-audit
- **描述**：审查 GDD 指定的内容数量与已实现内容的对比。识别计划与实际的差距。
- **使用场景**：
  - 了解每个系统计划了多少内容、实际实现了多少
  - MVP/Vertical Slice 内容完成度不足时识别高优先级项
  - 快速生成内容差距摘要
- **示例**：`/content-audit combat`

### diagnose
- **描述**：针对顽固 Bug 和性能回退的纪律性诊断循环。复现故障，假设根本原因，通过插桩隔离，修复并进行回归测试。
- **使用场景**：
  - 遇到顽固 Bug 需要结构化诊断
  - 性能回退且原因不明
  - 生成多个可证伪假设并逐个验证
  - 修复后回归测试并清理调试插桩
- **示例**：`/diagnose BUG-042`

### estimate
- **描述**：通过分析复杂度、依赖关系、历史速度和风险因素来估算任务工作量。生成具有置信度级别的结构化估算。
- **使用场景**：
  - 评估功能或 Bug 修复所需工作量
  - 需要乐观/预期/悲观三种情景的估算范围
  - 识别风险因素和依赖关系对工期的影响
- **示例**：`/estimate 实现玩家技能树系统`

### perf-profile
- **描述**：对游戏运行时性能进行分析，收集帧时间、内存分配和 CPU/GPU 使用率数据。生成包含可操作发现和优化建议的结构化报告。
- **使用场景**：
  - 对特定系统或整个游戏进行性能分析
  - 识别 CPU/内存/渲染/I/O 热点
  - 生成优化建议和快速修复方案
- **示例**：`/perf-profile combat`

### playtest-report
- **描述**：生成结构化的试玩报告模板或将现有试玩笔记分析为结构化格式。
- **使用场景**：
  - 生成空白试玩报告模板
  - 将原始试玩笔记分析整理为结构化报告
  - 将发现分类为设计变更/平衡调整/Bug/润色项
- **示例**：`/playtest-report analyze production/qa/raw-notes.md`

### regression-suite
- **描述**：将测试覆盖率映射到 GDD 关键路径，识别缺失回归测试的已修复 Bug，标记覆盖漂移，维护回归测试套件。
- **使用场景**：
  - Bug 修复后确认是否有对应回归测试
  - 发布关卡前验证回归测试套件完整性
  - Sprint 结束时检测测试覆盖漂移
- **示例**：`/regression-suite audit`

### retrospective
- **描述**：通过分析已完成的工作、速度、阻碍项和模式，生成 Sprint 或里程碑回顾。为下一迭代生成可操作的洞察。
- **使用场景**：
  - Sprint 结束时生成回顾分析
  - 评估完成率、速度趋势和估算准确性
  - 提取可操作的改进建议
- **示例**：`/retrospective sprint-5`

### security-audit
- **描述**：审查游戏的安全漏洞：存档篡改、作弊向量、网络漏洞、数据暴露和输入验证缺口。
- **使用场景**：
  - 任何公开发布前
  - 启用在线/多人功能前
  - 实现从磁盘或网络读取的系统后
- **示例**：`/security-audit full`

### tech-debt
- **描述**：追踪、分类和优先排序代码库中的技术债务。扫描债务指标、维护债务登记册、推荐偿还计划。
- **使用场景**：
  - 扫描 TODO/FIXME/HACK 等债务指标
  - 手动添加新技术债务条目
  - 按 (影响×频率)/修复成本 排序债务优先级
- **示例**：`/tech-debt scan`

### test-flakiness
- **描述**：通过读取 CI 运行日志或测试结果历史检测非确定性（不稳定）测试。维护不稳定测试注册表。
- **使用场景**：
  - Polish 阶段检测不稳定测试
  - 扫描 CI 日志识别间歇性失败
  - 维护回归套件的隔离测试部分
- **示例**：`/test-flakiness scan`

---

## 5. Sprint 类 (sprint)

### bug-triage
- **描述**：读取所有未关闭 Bug，重新评估优先级与严重程度，分配到 Sprint，发现系统性趋势，生成分类报告。
- **使用场景**：
  - Sprint 开始时将未关闭 Bug 分配到当前 Sprint 或 Backlog
  - Bug 数量超过 10 个后重新评估优先级
  - 识别系统性质量问题的趋势
- **示例**：`/bug-triage sprint`

### create-epics
- **描述**：将获批的 GDD+架构转化为 Epic——每个架构模块对应一个 Epic。定义范围、管治 ADR、引擎风险和无跟踪需求。
- **使用场景**：
  - 架构文档就绪后按层级创建 Epic
  - 确认每个系统的 GDD 需求都有 ADR 覆盖
  - 按 Foundation→Core→Feature→Presentation 顺序处理
- **示例**：`/create-epics layer:foundation --review full`

### create-stories
- **描述**：将单个 Epic 分解为可实现的 Story 文件。每个 Story 嵌入其 GDD 需求 TR-ID、ADR 指导、验收标准和测试证据路径。
- **使用场景**：
  - Epic 创建后分解为开发者可逐个实现的 Story
  - QA Lead 审查验收标准的可测试性
  - 按依赖顺序排列 Story
- **示例**：`/create-stories combat --review full`

### dev-story
- **描述**：读取 Story 文件并实现它。加载完整上下文，路由到对应系统和引擎的程序员 Agent，实现代码和测试，确认每个验收标准。核心实现 skill。
- **使用场景**：
  - 将准备好的 Story 转化为实际代码实现
  - Logic/Integration Story 要求同时编写测试
  - Config/Data Story 直接编辑数据文件
- **示例**：`/dev-story production/epics/core/combat-system/STORY-001.md`

### sprint-plan
- **描述**：基于当前里程碑、已完成工作和可用容量生成新的 Sprint 计划或更新现有计划。
- **使用场景**：
  - 开始新 Sprint 时生成计划
  - 更新现有 Sprint 计划
  - 生成 Sprint 状态报告
- **示例**：`/sprint-plan new --review lean`

### sprint-status
- **描述**：快速 Sprint 状态检查。读取当前 Sprint 计划，扫描 Story 文件状态，生成包含燃尽评估和新兴风险的简洁进度快照。
- **使用场景**：
  - Sprint 中随时快速查看进度
  - 检测哪些 Must Have 故事有风险
  - 识别停滞（STALE）超过 4 天的故事
- **示例**：`/sprint-status`

---

## 6. 工具类 (utility)

### changelog
- **描述**：从 git 提交、Sprint 数据和设计文档自动生成变更日志。生成内部版本和面向玩家的版本。
- **使用场景**：
  - 发布新版本时自动生成变更日志
  - Sprint 结束时汇总变更
  - 检查提交信息中是否有缺少任务引用的提交
- **示例**：`/changelog v1.2.0`

### deprecation
- **描述**：管理游戏系统、API 和功能的废弃与迁移。五阶段生命周期：公告→警告→迁移→阻断→移除。
- **使用场景**：
  - 替换旧的玩法系统为新实现
  - 合并重复的工具函数或子系统
  - 清理不再需要的引擎版本兼容方案
  - `/simplify` 识别出需要正式移除的大型死代码块之后
- **示例**：`/deprecation old-combat-system`

### doubt-driven
- **描述**：在非平凡决策落定前进行对抗性审查。CLAIM→EXTRACT→DOUBT→RECONCILE→STOP 五步循环。
- **使用场景**：
  - 即将在不完全确定的条件下做出架构决策
  - 编写或修订 ADR 时
  - 设计系统间耦合关系时
  - 在 `/code-review` 之前先验证假设的正确性
- **示例**：`/doubt-driven "使用ECS架构实现战斗系统"`

### graphify-reader
- **描述**：控制 graphify 知识图谱工具——构建项目知识图谱、查询代码结构、分析模块关系。
- **使用场景**：
  - 构建项目知识图谱
  - 查询代码库中的概念或依赖关系
  - 追踪组件间的最短依赖路径
  - 导出交互式架构图
- **示例**：`/graphify-reader build .`

### handoff
- **描述**：将当前对话压缩成交接文档，使另一个 Agent（或未来的会话）可以接手工作而无需重新阅读完整历史。
- **使用场景**：
  - 当前会话即将结束，需要传递工作状态
  - 记录已完成的工作和未完成的任务
  - 为下一个会话推荐应使用的 Skill
- **示例**：`/handoff "继续实现战斗系统的剩余Story"`

### help
- **描述**：分析已完成的工作和用户查询，提供下一步建议。
- **使用场景**：
  - 不确定当前处于哪个开发阶段
  - 完成一个步骤后不确定下一步该做什么
  - 在开发流程中卡住或感到困惑
- **示例**：`/help "刚完成 design-review"`

### onboard
- **描述**：根据现有项目文档生成新团队成员的上下文文档，总结关键决策和现状。
- **使用场景**：
  - 新团队成员需要快速了解项目
  - 按角色生成定制化入职文档
  - 总结项目关键决策和当前状态
- **示例**：`/onboard programmer`

### patch-notes
- **描述**：从 git 历史、Sprint 数据和内部变更日志生成面向玩家的补丁说明。将开发者语言转化为清晰、吸引人的玩家沟通。
- **使用场景**：
  - 发布新版本需要生成玩家可读的补丁说明
  - 将技术性变更转化为玩家友好的语言
  - 按类别（新内容/玩法变更/修复/性能）整理变更
- **示例**：`/patch-notes 1.2.0 --style detailed`

### project-stage-detect
- **描述**：自动分析项目状态、检测所处阶段、识别差距并基于现有产物推荐下一步。
- **使用场景**：
  - 接手现有项目需要了解开发阶段
  - 检查里程碑前缺少哪些产物
  - 按角色筛选差距和建议
- **示例**：`/project-stage-detect designer`

### propagate-design-change
- **描述**：当 GDD 修订后，扫描所有 ADR 和可追溯性索引，识别哪些架构决策可能已经过时。生成变更影响报告。
- **使用场景**：
  - GDD 修订后找出受影响的 ADR
  - 评估架构决策是否仍然有效
  - 更新 ADR 状态和可追溯性索引
- **示例**：`/propagate-design-change design/gdd/combat-system.md`

### reverse-document
- **描述**：从现有实现生成设计或架构文档。从代码/原型反向工作，创建缺失的规划文档。
- **使用场景**：
  - 已有实现代码但缺少设计文档
  - 接手无文档的代码库需要补文档
  - 原型完成后形式化为设计文档
- **示例**：`/reverse-document design src/gameplay/combat`

### setup-engine
- **描述**：交互式工作流，为项目选择和配置游戏引擎。设置版本、安装模板文件、初始化引擎特定目录结构和文档。
- **使用场景**：
  - 项目初始化时选择和配置游戏引擎
  - 刷新引擎参考文档
  - 将引擎升级到新版本（含迁移审计）
- **示例**：`/setup-engine godot 4.6`

### simplify
- **描述**：代码简化工作流：识别简化机会、增量变更并测试验证、尊重 simplify-ignore 标记。
- **使用场景**：
  - 完成功能实现后进行代码清理
  - 代码审查后的跟进改进
  - 对频繁修改的文件进行定期维护
- **示例**：`/simplify src/gameplay/player_controller.gd`

### start
- **描述**：首次接入引导——询问你的位置，然后引导你到正确的工作流。不做假设。
- **使用场景**：
  - 新用户首次进入项目时的引导流程
  - 检测项目当前状态
  - 设置审查模式
- **示例**：`/start`

### test-helpers
- **描述**：为项目的测试套件生成引擎特定的测试辅助库。包含断言工具、工厂函数和模拟对象。
- **使用场景**：
  - `/test-setup` 搭建框架后生成测试辅助库
  - 多个测试文件出现重复 setup 样板代码时
  - 开始为新系统编写测试前
- **示例**：`/test-helpers combat`

### test-runner
- **描述**：跨语言测试运行器。支持 pytest、jest、mocha、dotnet test、go test、cargo test 等框架。
- **使用场景**：
  - 自动检测项目测试框架并运行测试
  - 解释测试输出
  - 按名称筛选运行特定测试
  - 生成覆盖率报告
- **示例**：`/test-runner --coverage`

### test-setup
- **描述**：为项目引擎搭建测试框架和 CI/CD 管道。创建 tests/ 目录结构、引擎特定测试运行配置和 GitHub Actions 工作流。
- **使用场景**：
  - 技术设置阶段第一个 Sprint 开始前
  - 搭建自动化测试基础设施
  - 创建 CI/CD 工作流
- **示例**：`/test-setup`

### to-prd
- **描述**：将当前对话上下文转化为 PRD（产品需求文档）。综合已讨论的内容生成结构化文档。
- **使用场景**：
  - 对话已充分探讨某个功能，需要写成正式文档
  - 综合现有讨论生成结构化 PRD
  - 将 PRD 保存并可选转换为 Story
- **示例**：`/to-prd inventory-system`

### zoom-out
- **描述**：后退一步，以更高视角审视当前工作。审查范围、差距、风险、过时假设和与原始愿景的一致性。
- **使用场景**：
  - 迷失在细节中需要高层面架构视图
  - 理解某个模块在系统中的角色
  - 识别调用者、被调用者和架构层归属
- **示例**：`/zoom-out src/gameplay/player_controller.gd`

---

## 7. 就绪类 (readiness)

### launch-checklist
- **描述**：生成发布清单并按所需产物分类。支持里程碑追踪和证据收集。
- **使用场景**：
  - 发布前全面检查代码就绪度和内容完整性
  - 扫描 TODO/FIXME/HACK 注释和调试输出
  - 验证商店页面、法律合规和社区营销准备
  - 支持 dry-run 模式（仅生成清单不写入文件）
- **示例**：`/launch-checklist 2025-06-01`

### smoke-check
- **描述**：在 QA 交付前运行关键路径冒烟测试。执行自动化测试套件，验证核心功能，生成 PASS/FAIL 报告。
- **使用场景**：
  - Sprint 的 Story 实现完成后、QA 交付前
  - 快速重新检查修复特定故障后
  - 按平台验证特定检查项
- **示例**：`/smoke-check sprint`

### soak-test
- **描述**：为延长游戏会话生成压力测试协议。发现只有持续游戏才会出现的缓慢泄漏、疲劳效应和边缘情况。
- **使用场景**：
  - Polish 阶段在 `/gate-check release` 之前
  - 修复内存或稳定性问题后的回归浸泡测试
  - 验证长时间游戏不会出现内存泄漏或性能退化
- **示例**：`/soak-test 2h all`

### story-done
- **描述**：Story 完成后的收尾审查。对照实现验证每个验收标准，检查 GDD/ADR 偏差，将 Story 状态更新为 Complete。
- **使用场景**：
  - 完成任何 Story 实现后进行收尾验证
  - 验证每个验收标准
  - 检查 GDD/ADR 偏差并记录
  - 标记 Story 为 Complete 并推荐下一个 Story
- **示例**：`/story-done production/epics/core/story-damage-calculator.md`

### story-readiness
- **描述**：验证 Story 文件是否已准备好实现。检查嵌入的 GDD 需求、ADR 引用、清晰验收标准和无开放设计问题。生成 READY/NEEDS WORK/BLOCKED 判定。
- **使用场景**：
  - 分配 Story 前验证实现就绪度
  - Sprint 开始前批量验证所有 Story
  - 发现缺失引用或模糊验收标准
- **示例**：`/story-readiness sprint`

---

## 8. 门禁类 (gate)

### gate-check
- **描述**：验证是否准备好在开发阶段之间推进。生成 PASS/CONCERNS/FAIL 判定，列出具体阻碍项和所需产物。
- **使用场景**：
  - 从一个开发阶段推进到下一个阶段前进行正式验证
  - 检查必需产物是否存在且内容完整
  - 通过导演组并行评估
  - 自动检测当前阶段并确认要运行的门禁
- **示例**：`/gate-check production --review full`

---

## 附录：按工作流阶段索引

### 概念阶段
`/brainstorm` → `/design-with-kb` → `/spec-driven` → `/art-bible`

### 系统设计
`/map-systems` → `/design-system` → `/consistency-check` → `/design-review` → `/review-all-gdds` → `/propagate-design-change`

### 技术设置
`/setup-engine` → `/create-architecture` → `/architecture-decision` → `/architecture-review` → `/create-control-manifest` → `/doubt-driven`

### Pre-Production
`/prototype` → `/vertical-slice` → `/gate-check pre-production`

### Production
`/create-epics` → `/create-stories` → `/story-readiness` → `/dev-story` → `/code-review` → `/story-done` → `/simplify` → `/deprecation`

### Sprint 管理
`/sprint-plan` → `/sprint-status` → `/scope-check` → `/estimate` → `/bug-triage`

### QA 与测试
`/test-setup` → `/test-helpers` → `/test-runner` → `/test-flakiness` → `/test-evidence-review` → `/regression-suite`

### 发布
`/launch-checklist` → `/release-checklist` → `/security-audit` → `/smoke-check` → `/soak-test` → `/gate-check release` → `/day-one-patch`

### 运维
`/bug-report` → `/diagnose` → `/hotfix` → `/retrospective` → `/changelog` → `/patch-notes` → `/onboard` → `/reverse-document`
