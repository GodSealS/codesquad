# CodeSquad Command 使用参考

> **版本**：v1.2.0
> **Command 总数**：20
> **生成日期**：2026-07-08
> **来源**：`.codesquad/commands/*.md`

---

## 目录

1. [设计类 (design)](#1-设计类-design)
2. [架构类 (architecture)](#2-架构类-architecture)
3. [规划类 (planning)](#3-规划类-planning)
4. [开发类 (development)](#4-开发类-development)
5. [质量类 (qa)](#5-质量类-qa)
6. [流水线类 (pipeline)](#6-流水线类-pipeline)
7. [门禁类 (gate)](#7-门禁类-gate)
8. [维护类 (maintenance)](#8-维护类-maintenance)
9. [发布类 (release)](#9-发布类-release)
10. [工具类 (utility)](#10-工具类-utility)

---

## 1. 设计类 (design)

### brainstorm
- **描述**：游戏概念构思→原型验证→试玩反馈循环。从结构化头脑风暴到可玩原型，再到结构化反馈分析。
- **编排流程**：
  1. `brainstorm` — 从零生成结构化游戏概念文档
  2. `prototype` — 快速构建可玩原型验证核心机制
  3. `playtest-report` — 收集并结构化原型试玩反馈
- **使用场景**：
  - 从零开始构思新游戏，需要完整的设计验证闭环
  - 将模糊创意转化为经验证的游戏概念
  - 通过原型快速验证核心玩法是否有趣
- **示例**：`/brainstorm cozy farming` 或 `/brainstorm open`

### design-system
- **描述**：GDD 编写流水线：编写系统 GDD → 单文档审查 → 跨文档一致性检查 → 整体设计审查。完整设计质量链。
- **编排流程**：
  1. `design-system` — 引导式逐节编写单个系统的 GDD
  2. `design-review` — 审查 GDD 完整性、一致性、可实现性
  3. `consistency-check` — 跨 GDD 实体引用一致性扫描
  4. `review-all-gdds` — 全量跨 GDD 矛盾检测 + 设计理论审查
- **使用场景**：
  - 从零编写新游戏系统的完整设计文档
  - 确保 GDD 在交给程序员前经过完整质量审查
  - 检测跨系统的设计矛盾和不一致
- **示例**：`/design-system combat-system`

### ux-design
- **描述**：UX 设计流水线：编写屏幕/流程/HUD 的 UX 规范 → 验证完整性、无障碍合规性、GDD 一致性和实现就绪度。
- **编排流程**：
  1. `ux-design` — 引导式逐节编写 UX 规范
  2. `ux-review` — 验证 UX 规范完整性、无障碍合规性、GDD 一致性
- **使用场景**：
  - 为新屏幕或 UI 流程创建 UX 规范
  - 设计 HUD 布局和交互模式
  - 在交给 UI 程序员前验证 UX 设计质量
- **示例**：`/ux-design inventory-screen` 或 `/ux-design hud`

---

## 2. 架构类 (architecture)

### architecture-decision
- **描述**：创建架构决策记录（ADR），记录重大技术决策及其上下文、考虑的替代方案和后果。支持对已有 ADR 的 retrofit 模式。
- **路由 Skill**：`architecture-decision`
- **使用场景**：
  - 为重大技术选择（如事件系统架构、物理引擎选择）创建正式决策记录
  - 已有 ADR 缺少关键章节需要 retrofit 补全
  - 在编写代码之前文档化架构决策
- **示例**：`/architecture-decision "Use ECS for combat system"`

### create-architecture
- **描述**：架构蓝图流水线：从所有 GDD 生成主架构文档 → 验证覆盖度、ADR 一致性和引擎兼容性。
- **编排流程**：
  1. `create-architecture` — 读取所有 GDD 生成主架构文档
  2. `architecture-review` — 验证架构覆盖度、ADR 一致性、引擎兼容性
- **使用场景**：
  - 所有 GDD 获批后，将设计文档转化为技术架构蓝图
  - 定义模块间的 API 边界和接口契约
  - 审计现有 ADR 质量并验证引擎兼容性
- **示例**：`/create-architecture full` 或 `/create-architecture data-flow`

---

## 3. 规划类 (planning)

### create-epics
- **描述**：Epic→Story 分解流水线：将 GDD+架构转化为 Epic，再将每个 Epic 分解为具有完整可追溯性的可实现 Story 文件。
- **编排流程**：
  1. `create-epics` — 将 GDD+ADR 转化为 Epic（每架构模块一个）
  2. `create-stories` — 将 Epic 分解为可实现的 Story 文件
- **使用场景**：
  - 架构完成后，将设计转化为可规划的 Epic
  - 为每个 Epic 生成可实现的 Story 文件
  - 确保每个 Story 具有完整的 GDD 需求和 ADR 追溯
- **示例**：`/create-epics combat-system` 或 `/create-epics layer:core`

### sprint-plan
- **描述**：Sprint 准备流水线：生成 Sprint 计划 → 工程任务分解 → QA 测试计划。一站式 Sprint 设置。
- **编排流程**：
  1. `sprint-plan` — 生成/更新 Sprint 计划
  2. `planning` — 工程任务分解（依赖图→垂直切片→验收标准）
  3. `qa-plan` — 生成 Sprint 测试计划（自动化+手动+冒烟测试）
- **使用场景**：
  - 新 Sprint 开始时生成完整的 Sprint 计划
  - 将 Epic 分解为可执行的工程任务
  - 在 Sprint 开始前确定测试范围和策略
- **示例**：`/sprint-plan new` 或 `/sprint-plan update`

### milestone-review
- **描述**：里程碑评估流水线：全面进度审查及 Go/No-Go 建议 → 回顾及下一迭代可操作洞察。
- **编排流程**：
  1. `milestone-review` — 生成功能完成度/质量指标/风险评估/Go-NoGo 建议
  2. `retrospective` — 分析完成工作/速度/阻碍/模式，生成下一迭代可操作洞察
- **使用场景**：
  - 里程碑截止日期前进行全面进度评估
  - Sprint 或里程碑结束后进行回顾总结
  - 为下一阶段提取可操作的改进建议
- **示例**：`/milestone-review current` 或 `/milestone-review pre-alpha`

### plan
- **描述**：工程任务分解：依赖图 → 垂直切片 → 验收标准。路由到 planning 技能。
- **路由 Skill**：`planning`
- **使用场景**：
  - 将功能或 Sprint 分解为有序工程任务
  - 分析依赖关系并建立垂直切片
  - 为每个任务定义验收标准和时间估算
- **示例**：`/plan combat-system`

---

## 4. 开发类 (development)

### story-readiness
- **描述**：Story 实现流水线：验证就绪度 → 实现（标准或 TDD）→ 代码审查 → 标记完成。核心开发循环。
- **编排流程**：
  1. `story-readiness` — 验证 Story 是否具备实现条件（READY/NEEDS WORK/BLOCKED）
  2. `dev-story` 或 `tdd` — 实现 Story（标准路由或测试驱动替代方案）
  3. `code-review` — 审查实现代码质量
  4. `story-done` — 验证验收标准、更新状态、提示下一个就绪 Story
- **使用场景**：
  - 开发人员接手新 Story 时的标准实现流程
  - 确保每个 Story 从就绪验证到完成的全流程质量把控
  - 支持标准实现和 TDD 两种开发模式
- **示例**：`/story-readiness production/stories/combat-damage.md`

### spec
- **描述**：在实现前创建结构化技术规格说明。路由到 spec-driven 技能。
- **路由 Skill**：`spec-driven`
- **使用场景**：
  - 在 `/brainstorm` 之前建立结构化技术基础
  - 为功能或组件创建完整技术规格
  - 输出到 `design/specs/` 目录
- **示例**：`/spec combat-system`

---

## 5. 质量类 (qa)

### bug-report
- **描述**：Bug 生命周期流水线：创建结构化 Bug 报告 → 按严重程度/优先级分类 → 使用系统化调试循环诊断根因。
- **编排流程**：
  1. `bug-report` — 创建结构化 Bug 报告 / 分析代码发现潜在 Bug
  2. `bug-triage` — 按严重程度×优先级分类，检测系统性趋势
  3. `diagnose` — 对高优先级 Bug 执行"复现→假设→插桩→修复→回归"诊断循环
- **使用场景**：
  - 发现 Bug 后创建标准化的 Bug 报告
  - Sprint 开始时对 Bug 积压进行分类和优先级排序
  - 对高优先级 Bug 执行系统化根因诊断
- **示例**：`/bug-report "Player falls through floor in Level 3"` 或 `/bug-report analyze src/gameplay/combat/`

---

## 6. 流水线类 (pipeline)

### localize
- **描述**：完整本地化管道：扫描硬编码字符串、提取字符串表、验证翻译、文化/敏感度审查、配音本地化、RTL 测试、字符串冻结执行和覆盖率报告。
- **路由 Skill**：`localize`（10 种子模式）
- **使用场景**：
  - 扫描代码库中的硬编码字符串
  - 提取和管理翻译字符串表
  - 运行文化/敏感度审查
  - 管理配音本地化流程
  - 测试 RTL 布局和平台合规性
- **示例**：`/localize scan` 或 `/localize extract` 或 `/localize qa`

### vertical-slice
- **描述**：引导式垂直切片工作流，从端到端设计到可玩实现。选择功能子集贯穿所有系统层，以接近制作质量验证核心游戏循环。
- **路由 Skill**：`vertical-slice`
- **使用场景**：
  - Pre-Production 后期验证核心游戏循环
  - 以接近制作质量构建端到端可玩切片
  - 验证团队能否按计划交付制作质量的功能
- **示例**：`/vertical-slice`

### release-checklist
- **描述**：发布准备流水线：生成发布清单 → 上架/商店清单 → 首日补丁规划 → 玩家补丁说明 → 变更日志生成。
- **编排流程**：
  1. `release-checklist` — 根据项目阶段生成发布清单
  2. `launch-checklist` — 按产物分类生成上架/商店清单
  3. `day-one-patch` — 范围界定→实施→QA 门控首日补丁
  4. `patch-notes` — 从 git/sprint 数据生成面向玩家的补丁说明
  5. `changelog` — 自动生成开发者和玩家双版本 changelog
- **使用场景**：
  - 发布前生成完整的发布准备清单
  - 规划首日补丁的范围和优先级
  - 自动生成面向玩家的补丁说明和变更日志
- **示例**：`/release-checklist pc` 或 `/release-checklist all`

---

## 7. 门禁类 (gate)

### gate-check
- **描述**：验证是否准备好在开发阶段之间推进（概念→系统设计→技术设置→预制作→制作→打磨→发布）。生成 PASS/CONCERNS/FAIL 判定并列出具体阻碍项。
- **路由 Skill**：`gate-check`（7 阶段关卡验证）
- **使用场景**：
  - 从一个开发阶段推进到下一个阶段前进行正式验证
  - 检查必需产物是否存在且内容完整
  - 自动检测当前阶段并确认要运行的门禁
- **示例**：`/gate-check pre-production` 或 `/gate-check polish`

---

## 8. 维护类 (maintenance)

### deprecation
- **描述**：债务清理流水线：扫描技术债务 → 管理废弃生命周期 → 简化残留复杂度 → 代码审查迁移结果。完整的"发现→管理→清理→审查"链。
- **编排流程**：
  1. `tech-debt` — 扫描技术债务（TODO/FIXME/HACK），建立债务登记册
  2. `deprecation` — 执行五阶段废弃生命周期（ANNOUNCE→WARN→MIGRATE→BLOCK→REMOVE）
  3. `simplify` — 移除后清理残留复杂度、死代码
  4. `code-review` — 审查迁移代码质量
- **使用场景**：
  - 清理代码库中的技术债务
  - 安全地废弃和移除旧系统
  - 替换旧实现后确保代码质量
- **示例**：`/deprecation old-combat-system` 或 `/deprecation scan`

### simplify
- **描述**：代码简化工作流：识别简化机会 → 增量变更 → 测试验证。路由到 simplify 技能。
- **路由 Skill**：`simplify`
- **使用场景**：
  - 功能完成后清理代码
  - 审查时发现代码可简化
  - 周期性维护频繁修改的文件
- **示例**：`/simplify src/gameplay/combat/`

---

## 9. 发布类 (release)

### ship
- **描述**：发布前并行审查风扇：同时委派 lead-programmer、security-engineer 和 qa-tester 进行 go/no-go 评估。
- **编排流程**：
  1. 并行 spawn：lead-programmer（代码审查） + security-engineer（安全审计） + qa-tester（测试覆盖）
  2. 合并三份报告
  3. GO / NO-GO 判定：阻碍项列表 + 推荐修复 + 回滚计划
- **使用场景**：
  - 任何发布或里程碑交付前的最终质量关卡
  - 并行获取代码质量、安全性和测试覆盖的多维度评估
- **示例**：`/ship v1.2.0`

---

## 10. 工具类 (utility)

### adopt
- **描述**：棕地项目接入——审查现有产物与模板格式的合规性，按影响程度分类差距，生成编号化迁移计划。
- **路由 Skill**：`adopt`
- **使用场景**：
  - 加入进行中的项目，需要评估与模板的兼容性
  - 从旧版本模板升级，需要迁移计划
  - 检查已有 GDD/ADR/Story 的格式合规性
- **示例**：`/adopt full` 或 `/adopt gdds`

---

## 附录：按工作流阶段索引

### 概念阶段
`/brainstorm` → `/spec`

### 系统设计
`/design-system` → `/ux-design`

### 技术设置
`/architecture-decision` → `/create-architecture` → `/gate-check technical-setup`

### Pre-Production
`/create-epics` → `/sprint-plan` → `/plan` → `/vertical-slice` → `/gate-check pre-production`

### Production
`/story-readiness` → `/simplify` → `/deprecation`

### Sprint 管理
`/sprint-plan` → `/milestone-review`

### QA 与 Bug
`/bug-report` → `/gate-check production`

### 发布
`/release-checklist` → `/ship` → `/localize` → `/gate-check release`

### 运维
`/adopt` → `/deprecation`
