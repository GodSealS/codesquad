
## 新项目首次步骤

**不知道从哪里开始？** 运行 `/start`。它会询问你当前状态并引导你到正确的工作流。不会对你的游戏、引擎或经验水平做任何假设。

如果你已经知道需要什么，直接跳到相关路径：

### 首先确定游戏平台
网页游戏，小程序选 Unity 或 Cocos Creator

移动端游戏，选 Unity 或 Godot

追求画质的大型游戏，选 Unreal Engine 或 unity

###  A："我不知道要做什么"

> 1. **运行 `/start`**（或 `/brainstorm open`）— 引导式创意探索：什么让你兴奋、你玩过什么、你的约束
>    - 生成3个概念，帮你选择一个，定义核心循环和支柱
>    - 产出游戏概念文档并推荐引擎
> 2. **设置引擎** — 运行 `/setup-engine`（使用brainstorm推荐）
>    - 配置 CODESQUAD.md，检测知识差距，填充参考文档
>    - 创建 `.codesquad/docs/technical-preferences.md`，包含命名约定、性能预算和引擎特定默认值
>    - 如果引擎版本比LLM训练数据新，会从网上获取最新文档以便代理建议正确的API
> 3. **验证概念** — 运行 `/design-review design/gdd/game-concept.md`
> 4. **分解为系统** — 运行 `/map-systems` 映射所有系统和依赖
> 5. **设计每个系统** — 运行 `/design-system [系统名]`（或 `/map-systems next`）按依赖顺序编写GDD
> 6. **测试核心循环** — 运行 `/prototype [核心机制]`
> 7. **试玩验证** — 运行 `/playtest-report` 验证假设
> 8. **规划第一个冲刺** — 运行 `/sprint-plan new`
> 9. 开始构建

### B："我知道要做什么"

如果你已经有游戏概念和引擎选择：

> 1. **设置引擎** — 运行 `/setup-engine [引擎] [版本]`（如 `/setup-engine godot 4.6`）— 也会创建技术偏好
> 2. **编写游戏支柱** — 委派给 `creative-director`
> 3. **分解为系统** — 运行 `/map-systems` 枚举系统和依赖
> 4. **设计每个系统** — 运行 `/design-system [系统名]` 按依赖顺序编写GDD
> 5. **创建初始ADR** — 运行 `/architecture-decision`
> 6. **创建第一个里程碑** 在 `production/milestones/` 中
> 7. **规划第一个冲刺** — 运行 `/sprint-plan new`
> 8. 开始构建

###  C："我知道游戏但不知道选什么引擎"

如果你有概念但不知道哪个引擎合适：

> 1. **运行 `/setup-engine`** 不带参数 — 它会询问你的游戏需求（2D/3D、平台、团队规模、语言偏好）并根据你的回答推荐引擎
> 2. 从路径B的第2步继续

### D："我已有现有项目"

如果你已有设计文档、原型或代码：

> 1. **运行 `/start`**（或 `/project-stage-detect`）— 分析已有内容、识别差距、推荐下一步
> 2. **运行 `/adopt`** 如果你已有GDD、ADR或故事 — 审计内部格式合规性并生成编号的迁移计划来填补差距，不会覆盖已有工作
> 3. **按需配置引擎** — 如未配置则运行 `/setup-engine`（会自动检测现有引擎项目）
> 4. **验证阶段就绪度** — 运行 `/gate-check` 查看当前状态
> 5. **规划下一个冲刺** — 运行 `/sprint-plan new`

---

## 引擎项目创建指南

在运行 `/setup-engine` 之前，你需要先在本地创建一个引擎项目。以下是四种引擎的项目创建步骤和官方文档链接。

### Unity

**创建项目：**

1. 下载并安装 [Unity Hub](https://unity.com/download)（Unity 版本管理器）
2. 打开 Unity Hub → 点击 **"New Project"**
3. 选择模板：
   - **2D Core** — 2D 游戏（内置渲染管线）
   - **3D Core** — 3D 游戏（内置渲染管线）
   - **3D URP** — 3D 游戏（通用渲染管线，推荐移动端/跨平台）
   - **3D HDRP** — 3D 游戏（高清渲染管线，推荐 PC/主机高端项目）
4. 填写项目名称和存储路径
5. 点击 **"Create Project"**，等待 Unity 编辑器启动

> **版本选择建议**：优先使用 LTS（长期支持）版本。当前推荐 Unity 6 (6000.x) LTS。

**官方文档：**

| 资源 | 链接 |
|------|------|
| Unity 下载 | https://unity.com/download |
| Unity 文档 | https://docs.unity.com/ |
| Unity 手册（中文） | https://docs.unity.cn/cn/current/Manual/ |
| Unity 脚本 API | https://docs.unity.cn/cn/current/ScriptReference/ |
| Unity Learn（教程） | https://learn.unity.com/ |

---

### Cocos Creator

**创建项目：**

1. 下载并安装 [Cocos Dashboard](https://www.cocos.com/creator-download)（Cocos 版本管理器）
2. 打开 Cocos Dashboard → 点击 **"Editor"** 标签页 → 安装 Cocos Creator 编辑器版本
3. 切换到 **"Project"** 标签页 → 点击 **"新建项目"**
4. 选择模板：
   - **Empty (2D)** — 空白 2D 项目
   - **Empty (3D)** — 空白 3D 项目
   - **示例项目** — 包含完整游戏逻辑的学习项目
5. 填写项目名称和存储路径
6. 点击 **"创建"**，等待编辑器启动

> **版本选择建议**：推荐使用 Cocos Creator 3.8 LTS 或更新版本。3.x 系列相比 2.x 有重大架构升级（面向数据、新渲染管线）。

**官方文档：**

| 资源 | 链接 |
|------|------|
| Cocos Creator 下载 | https://www.cocos.com/creator-download |
| Cocos Creator 文档 | https://docs.cocos.com/creator/manual/zh/ |
| Cocos Creator API | https://docs.cocos.com/creator/api/zh/ |
| Cocos Store（资源商店） | https://store.cocos.com/ |
| Cocos 论坛 | https://forum.cocos.org/ |

---

### Unreal Engine

**创建项目：**

1. 下载并安装 [Epic Games Launcher](https://store.epicgames.com/zh-CN/download)
2. 打开 Epic Games Launcher → 切换到 **"虚幻引擎"** 标签页
3. 点击 **"库"** → 安装引擎版本（推荐 5.4 或 5.5）
4. 安装完成后点击 **"启动"** 打开 Unreal Editor
5. 选择模板：
   - **Games → Blank** — 空白项目，从零开始
   - **Games → First Person** — 第一人称射击模板
   - **Games → Third Person** — 第三人称动作模板
   - **Games → Top Down** — 俯视角游戏模板
6. 选择蓝图（Blueprint）或 C++ 项目
7. 填写项目名称和存储路径 → 点击 **"创建"**

> **版本选择建议**：推荐 UE 5.4 或 5.5。UE5 相比 UE4 新增 Nanite（虚拟几何）、Lumen（动态全局光照）等核心技术。蓝图入门门槛低，C++ 性能更强。

**官方文档：**

| 资源 | 链接 |
|------|------|
| Epic Games Launcher | https://store.epicgames.com/zh-CN/download |
| Unreal Engine 文档 | https://docs.unrealengine.com/5.4/zh-CN/ |
| Unreal Engine API | https://docs.unrealengine.com/5.4/en-US/API/ |
| UE5 学习资源 | https://dev.epicgames.com/community/unreal-engine/learning |
| 虚幻引擎社区 | https://dev.epicgames.com/community/ |

---

### Godot

**创建项目：**

1. 下载并安装 [Godot Engine](https://godotengine.org/download/)（推荐 Godot 4.x）
   - **Standard version**（标准版）— 无需 .NET，使用 GDScript
   - **.NET version**（.NET 版）— 需要 .NET SDK 8+，支持 C# 脚本
2. 打开 Godot → 点击 **"创建"** 或 **"新建项目"**
3. 填写项目名称和存储路径
4. 选择渲染器：
   - **Forward+** — 推荐用于桌面平台（PC/主机），支持高端 3D 效果
   - **Mobile** — 推荐用于移动端和 Web 导出
   - **Compatibility** — 兼容模式，用于旧硬件/WebGL 2
5. 点击 **"创建"**，等待项目初始化

> **版本选择建议**：推荐 Godot 4.3 或更新版本。Godot 4.x 相比 3.x 进行了全面重构（新渲染器、改进的物理、增强的编辑器）。全免费开源（MIT 协议），无任何版税或收入门槛。

**官方文档：**

| 资源 | 链接 |
|------|------|
| Godot 下载 | https://godotengine.org/download/ |
| Godot 文档（英文） | https://docs.godotengine.org/en/stable/ |
| Godot 文档（中文） | https://docs.godotengine.org/zh_CN/stable/ |
| Godot 社区教程 | https://godotengine.org/community/ |
| Godot Asset Library | https://godotengine.org/asset-library/ |

---

### 引擎对比速查

| 特性 | Unity | Cocos Creator | Unreal Engine | Godot |
|------|-------|---------------|---------------|-------|
| **最佳 2D** | ★★★☆ | ★★★★ | ★★☆☆ | ★★★★★ |
| **最佳 3D** | ★★★★ | ★★★☆ | ★★★★★ | ★★★☆ |
| **移动端** | ★★★★★ | ★★★★★ | ★★☆☆ | ★★★☆ |
| **Web 导出** | ★★★☆ | ★★★★★ | ★★☆☆ | ★★★★ |
| **主机导出** | ★★★★ | ★★☆☆ | ★★★★★ | ★★☆☆ |
| **学习曲线** | 中等 | 中等 | 陡峭 | 平缓 |
| **开源** | 否 | 是 (MIT) | 否（源码可见） | 是 (MIT) |
| **编程语言** | C# | TypeScript | C++ / Blueprint | GDScript / C# |
| **免费门槛** | 收入<$200K | 完全免费 | 收入<$1M | 完全免费 |

> 选择合适的引擎后，运行 `/setup-engine [引擎名]` 开始配置。如果已有项目目录，直接运行 `/setup-engine` 会自动检测引擎类型和版本。`/setup-engine` 会同步更新 CODESQUAD.md、创建技术偏好、安装引擎参考文档和目录结构。
