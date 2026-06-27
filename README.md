<p align="center">
  <img src="https://img.shields.io/badge/CodeSquad-v1.0.1-7c3aed?style=for-the-badge&logo=node.js&logoColor=white" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT License">
  <img src="https://img.shields.io/badge/node-%3E%3D20.19.0-brightgreen?style=for-the-badge&logo=node.js&logoColor=white" alt="Node">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/agents-49-blueviolet?style=flat-square" alt="49 Agents">
  <img src="https://img.shields.io/badge/skills-72-green?style=flat-square" alt="72 Skills">
  <img src="https://img.shields.io/badge/hooks-12-orange?style=flat-square" alt="12 Hooks">
  <img src="https://img.shields.io/badge/rules-11-red?style=flat-square" alt="11 Rules">
  <img src="https://img.shields.io/badge/templates-39-lightgrey?style=flat-square" alt="39 Templates">
</p>


<h1 align="center">CodeSquad</h1>
<p align="center"><strong>AI 原生的游戏开发 CLI —— 多工具代理与技能绑定框架</strong></p>
<p align="center">
  将单一 AI 会话转变为一个完整的游戏开发工作室。<br>
  一个协调的 AI 团队，包含 <strong>49 个代理</strong> 和 <strong>72 个技能</strong>，覆盖设计、编程、美术、音频、叙事、QA 和生产全流程。
</p>

<p align="center">
  <a href="https://github.com/GodSealS/codesquad"><strong>GitHub</strong></a> ·
  <a href="#-快速安装"><strong>快速安装</strong></a> ·
  <a href="#-使用手册"><strong>使用手册</strong></a> ·
  <a href="#-本地知识库集成"><strong>知识库集成</strong></a>
</p>

---
| ![Chat 界面](https://raw.githubusercontent.com/GodSealS/codesquad/main/docs/translations/CN/chat.jpg) | ![模型配置](https://raw.githubusercontent.com/GodSealS/codesquad/main/docs/translations/CN/Model.jpg) |
|:--:|:--:|
| ![MCP 集成](https://raw.githubusercontent.com/GodSealS/codesquad/main/docs/translations/CN/MCP.jpg) | |

---
## 📖 项目简介

**CodeSquad** 是一个 AI 原生的游戏开发命令行工具，为 **CodeBuddy Game Studios** 提供完整的多工具代理绑定和技能编排框架。它将单一的 AI 会话组织成真实工作室的层级结构：

```
总监（DeepSeek-V4-Flash）→ 部门主管（Kimi-K2.6/GLM-5.1）→ 专员（GLM-5v-Turbo/MiniMax-M3）
```

每位代理都拥有明确定义的职责、升级路径和质量门禁。你始终掌握决策权，但 AI 团队会提出正确的问题、及早发现错误，并从最初构思到发布全程保持项目井井有条。

### 技术栈

| 组件 | 技术 |
|------|------|
| **CLI 框架** | TypeScript + Commander + Node.js ≥20.19 |
| **Web 控制台** | React + Vite + Express |
| **LLM 集成** | Anthropic / OpenAI / OpenAI 兼容协议 |
| **MCP 协议** | Model Context Protocol (stdio + HTTP) |
| **包管理** | npm / Bun (可选) |

### 为什么选择 CodeSquad

| 优势 | 说明 |
|------|------|
| 🧩 **多 Agent 协作** | 38 个专业 Agent 分 4 层架构，垂直委派 + 横向咨询 + 冲突升级 + Coordinator 并行编排，每个 Agent 拥有独立领域知识，避免"一个人全干"的质量下降 |
| 🔀 **跨供应商模型路由** | 原生支持 DeepSeek / GLM / Kimi / MiniMax 四家模型，通过批次映射无缝切换 Claude / GPT / Gemini；30+ AI 工具适配器，一套 Agent/Skill 定义适配所有平台，不绑定单一工具 |
| ⚡ **极致 Token 节省** | 增量分段写入（节省 ~85% 上下文）+ Subagent 隔离上下文 + DiskCache 磁盘二级缓存（跨会话零 token 成本理解项目）+ 主动 Compaction 策略，让长会话不再爆炸 |
| 🎮 **完整游戏开发管线** | 101 个标准化 Skill 覆盖 brainstorm → GDD → 架构 → 冲刺 → 实现 → 审查 → QA → 发布全流程，Team Skills 自动协调多 Agent 并行工作 |
| 🛡️ **用户主导，非自主执行** | Question → Options → Decision → Draft → Approval 五步协作协议，Agent 必须先展示草案并获得明确批准才能写入文件，你始终掌握决策权 |
| 📦 **离线可用 · 质量门禁** | 核心命令完全离线，零网络依赖；7 项 CI 静态质量检查确保 Skill 合规；Open Core 架构保护知识产权 |

---

## 🚀 快速安装

> **前置要求**：[Git](https://git-scm.com/) · [Node.js](https://nodejs.org/) ≥ 20.19.0 · npm ≥ 10

### 方法一：全局安装（推荐）

```bash
# 克隆仓库
git clone https://github.com/GodSealS/codesquad.git
cd codesquad

# 全局安装
npm install
```

安装后即可在任意目录使用 `codesquad` 命令。

### 方法二：自定义目录安装

```bash
# 克隆仓库
git clone https://github.com/GodSealS/codesquad.git
cd codesquad

# 安装到自定义目录（生成独立可执行文件）
node scripts/install.js --exe --bin-dir C:\tools\codesquad
```

### 注册环境变量

**Windows (PowerShell 管理员)**：
```powershell
[Environment]::SetEnvironmentVariable('PATH', $env:PATH + ';' + $env:USERPROFILE + '\.codesquad\bin', 'User')
```

**macOS / Linux**：
```bash
echo 'export PATH="$HOME/.codesquad/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 验证安装

```bash
codesquad --version
# 输出: CodeSquad v1.0.1
```

---

## 📚 使用手册

> 快速入门见 [docs/translations/CN/Quick-Start.md](docs/translations/CN/Quick-Start.md)

> 工作流 [docs/translations/CN/Workflow-Guide.md](docs/translations/CN/Workflow-Guide.md)

> 游戏开发指南 [docs/translations/CN/Workflow-Guide.md](docs/translations/CN/Workflow-Guide.md)

### 1. 理解代理层级

CodeSquad 内置三级代理架构，对应真实游戏工作室：

| 层级 | 模型 | 角色 |
|------|------|------|
| **Tier 1** | DeepSeek-V4-Flash / GLM-5.1 | 总监：`creative-director` `technical-director` `producer` |
| **Tier 2** | Kimi-K2.6 / GLM-5.1 | 部门主管：`game-designer` `lead-programmer` `art-director` `audio-director` `narrative-director` `qa-lead` `release-manager` `localization-lead` |
| **Tier 3** | GLM-5v-Turbo / MiniMax-M3 | 专员：设计师、程序员、美术、编剧、测试、工程师等 |

### 2. 按需选择代理

| 我需要…… | 使用代理 |
|----------|---------|
| 设计新机制 | `game-designer` |
| 编写战斗代码 | `gameplay-programmer` |
| 创建着色器 | `technical-artist` |
| 编写对话 | `writer` |
| 规划下一轮冲刺 | `producer` |
| 审查代码质量 | `lead-programmer` |
| 编写测试用例 | `qa-tester` |
| 设计关卡 | `level-designer` |
| 修复性能问题 | `performance-analyst` |
| 搭建 CI/CD | `devops-engineer` |
| 获取 Unreal 建议 | `unreal-specialist` |
| 获取 Unity 建议 | `unity-specialist` |
| 获取 Godot 建议 | `godot-specialist` |
| 获取 Cocos Creator 建议 | `cocos-specialist` |

### 3. 常用命令

| 命令 | 用途 |
|------|------|
| `codesquad init` | 初始化新项目 |
| `codesquad serve` | 启动 MCP 服务器（IDE 集成） |
| `codesquad web` | 启动 Web 控制台 |
| `codesquad repl` | 交互式命令行对话 |
| `codesquad mcp status` | 查看 MCP 服务状态 |
| `codesquad build` | 委托 AI 执行构建 |
| `codesquad test` | 委托 AI 运行测试 |
| `codesquad update` | 更新 AICore 资源 |

### 4. 新项目第一步
先确定自己用什么引擎
免费开源
cocos 适合 web游戏
Godot 开源适合 2D 游戏
商业引擎
unity 适合 移动端游戏
Unreal 适合 大型AAA游戏

下载引擎，创建项目，
在项目目录下运行 `codesquad init` 初始化项目
再运行 `codesquad web` 启动 Web 控制台

不知道从哪里开始？运行 `/start`（在 Web 控制台或 REPL 中），系统会询问你的当前状态并引导到正确的工作流。

**路径 A：我还不确定做什么**
1. `/start` → 引导式创意探索
2. `/setup-engine` → 配置游戏引擎
3. `/design-review` → 验证游戏概念
4. `/map-systems` → 分解系统模块
5. `/design-system [name]` → 编写 GDD
6. `/sprint-plan new` → 规划冲刺

**路径 B：我有明确想法**
1. `/setup-engine [engine] [version]` → 配置引擎
2. 委托 `creative-director` → 设定游戏支柱
3. `/map-systems` → 分解系统
4. `/design-system [name]` → 编写设计文档
5. `/architecture-decision` → 架构决策
6. `/sprint-plan new` → 规划冲刺

**路径 C：我有现成项目**
1. `/start` 或 `/project-stage-detect` → 分析当前阶段
2. `/adopt` → 审查并迁移现有文档
3. `/setup-engine` → 如未配置引擎
4. `/gate-check` → 验证阶段就绪状态

### 5. 代理协调规则

1. 工作流自上而下：**总监 → 主管 → 专员**
2. 冲突向上级升级
3. 跨部门工作由 `producer` 协调
4. 代理不得未经授权修改其领域外的文件
5. 所有决策均需文档化记录

### 6. 文件结构

```
CODESQUAD.md                    # 主配置文件
AICore/
  agents/                        # 49 个代理定义
  skills/                        # 72 个技能定义
  hooks/                         # 12 个钩子脚本
  rules/                         # 11 个路径级编码规范
  docs/
    quick-start.md               # 快速入门指南
    templates/                   # 39 个文档模板
src/                             # CLI 源代码
UI/                              # Web 控制台前端
```

---

## 🧠 本地知识库集成

CodeSquad 支持集成本地知识图谱，为代理提供项目架构的深度上下文理解。

### Graphify — 代码知识图谱

将代码库构建为可查询的交互式知识图谱：

```bash
# 方式 A：使用 uv
uv tool install "graphifyy @ git+https://github.com/safishamsi/graphify@v8"

# 方式 B：使用 pipx
pipx install "graphifyy @ git+https://github.com/safishamsi/graphify@v8"
```

安装后在项目目录运行 `graphify` 即可生成知识图谱。


### Understand-Anything — 架构可视化

一键安装并自动分析项目架构：

```powershell
# PowerShell（Windows）
iwr -useb https://raw.githubusercontent.com/GodSealS/Understand-Anything/main/install.ps1 | iex
. .\install.ps1 codesquad
```

安装后运行 `/understand` 即可生成交互式架构图，支持图层分析、导览游览和社区检测。

---

### qmd — 本地混合搜索引擎

基于 BM25 + 向量 + LLM 重排的本地搜索引擎，已通过 MCP 桥接原生集成到 CLI：

```bash
# 安装
npm install -g qmd

# 启动 MCP 服务（CodeSquad 自动检测并连接）
qmd mcp
```

```powershell
# PowerShell 环境变量（可选）
[Environment]::SetEnvironmentVariable('QMD_API_KEY', 'your-key', 'User')
```

> qmd 使用 SQLite FTS5 (BM25) + sqlite-vec (向量) + node-llama-cpp 本地模型，完全离线运行。CodeSquad CLI 自动通过 MCP bridge 发现并连接 qmd，Agent 可直接调用本地搜索能力。


## 👤 作者

- **房超** — [ttb475c@hotmail.com](mailto:ttb475c@hotmail.com)


## 📄 许可证

[MIT License](LICENSE)

---

<p align="center">
  <sub>Built with ❤️ for game developers who want structure without losing creativity.</sub>
</p>
