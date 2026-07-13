# CodeSquad 用户使用手册

> **版本**：v1.1.2
> **生成来源**：知识图谱 `.understand-anything/knowledge-graph.json`（提交 `a33aabf`）
> **生成日期**：2026-07-03

---

## 目录

1. [快速开始](#1-快速开始)
2. [CLI 命令参考](#2-cli-命令参考)
3. [REPL 交互模式](#3-repl-交互模式)
4. [Web 控制台](#4-web-控制台)
5. [API 接口文档](#5-api-接口文档)
6. [Agent 系统](#6-agent-系统)
7. [Skill 系统](#7-skill-系统)
8. [权限模式](#8-权限模式)
9. [模型配置](#9-模型配置)
10. [钩子系统](#10-钩子系统)
11. [常见问题](#11-常见问题)
12. [集成推荐](#12-集成推荐)


[:arrow_up: 返回目录](#目录)


---

## 1. 快速开始

### 安装

```bash
npm install -g @GodSealS/codesquad
```

要求：Node.js >= 20.19.0

### 初始化项目

```bash
codesquad init                    # 标准初始化
codesquad init --tools            # 含工具链初始化
codesquad init --engine unreal    # 指定引擎初始化
```

初始化会在项目根目录创建：
- `CODESQUAD.md` — 项目引导文件
- `.codesquad/` — Agent/Skill/配置目录
- `design/` — 设计文档目录

### 启动引擎设置向导

```bash
codesquad start       # 启动引导流程（首次使用推荐）
codesquad setup-engine --engine godot    # 设置引擎
```


[:arrow_up: 返回目录](#目录)


---

## 2. CLI 命令参考

### 核心命令

| 命令 | 说明 |
|------|------|
| `codesquad` | 启动交互式 REPL |
| `codesquad init [--tools] [--engine <name>]` | 初始化项目 |
| `codesquad serve [--port <port>]` | 启动 API 服务器（默认 9090） |
| `codesquad repl` | 直接进入 REPL 模式 |
| `codesquad build` | AI 自主编译项目 |
| `codesquad test` | AI 自主运行测试 |
| `codesquad mcp` | 启动 MCP 服务器 |

### 管理命令

| 命令 | 说明 |
|------|------|
| `codesquad validate [agent-name]` | 验证 Agent/Skill 定义完整性 |
| `codesquad check` | 检查 Skill 定义合规性 |
| `codesquad check-stubs` | 检查 stub 文件 |
| `codesquad backup` | 备份项目配置 |
| `codesquad update` | 更新 .codesquad 到最新版本 |
| `codesquad version` | 显示版本信息 |
| `codesquad create <type>` | 创建新 Agent/Skill |
| `codesquad bind` | 绑定 AI 工具适配器 |
| `codesquad config` | 管理项目配置 |
| `codesquad register` | 注册 Agent/Skill 到项目 |

### 引擎命令

| 命令 | 说明 |
|------|------|
| `codesquad engine detect` | 检测项目引擎 |
| `codesquad engine unreal` | Unreal Engine 构建/测试 |
| `codesquad engine unity` | Unity 构建/测试 |
| `codesquad engine godot` | Godot 构建/测试 |
| `codesquad engine cocos` | Cocos Creator 构建/测试 |


[:arrow_up: 返回目录](#目录)


---

## 3. REPL 交互模式

启动 REPL 后，可以输入自然语言与 AI 团队交互。

### 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/mode [ask\|craft\|plan]` | 切换权限模式 |
| `/tasks [list\|<id>\|stop <id>]` | 任务管理 |
| `/team [list\|create\|delete\|members\|inbox]` | 团队管理 |
| `/usage [cache]` | 显示 Token 用量统计 |
| `/stream` | 切换流式/非流式模式 |
| `/reset` | 重置项目配置文件 |
| `/delete` / `/del` | 删除会话 |
| `Ctrl+C` | 中断当前操作（2 秒窗口） |
| `Tab` | 自动补全命令 |
| `Shift+Tab` | 反向选择 |

### 权限模式

- **ask**（默认）：每个操作需要用户确认
- **plan**：只读分析，不执行写操作
- **craft**：自动执行，需首次确认（持久化）

### 上下文管理

- 状态栏实时显示 token 使用率（窗口 ≥ 200K 时显示小数 + 绝对 token 数）
- 自动上下文压缩（超过窗口 50% 触发）
- 语义过滤（CLI 智能增强开启后，第 5 条消息起启用）
- 跨会话记忆（MEMORY.md）


[:arrow_up: 返回目录](#目录)


---

## 4. Web 控制台

### 启动

```bash
# 后端 API 服务器
codesquad serve --port 9090

# 前端开发服务器（另一个终端）
cd UI/web-console-src
npm install
npm run dev
```

### 功能

- **聊天面板**：流式对话，支持 tool-call 可视化（ThinkingCard + ToolCallCard）
- **MCP 面板**：管理 MCP 服务器连接和工具发现
- **配置面板**：模型配置、API Key 管理
- **设置面板**：上下文窗口百分比、语义匹配度、CLI 智能增强
- **文件浏览器**：浏览项目文件结构
- **权限对话框**：ask 模式下确认工具调用

### 认证

Web 控制台使用 Bearer Token 认证：
1. 访问 `http://localhost:9090/login`
2. 输入 API Token
3. 浏览器自动设置 `codesquad_token` cookie
4. 所有后续请求自动携带 cookie


[:arrow_up: 返回目录](#目录)


---

## 5. API 接口文档

### 基础信息

- **基路径**：`http://localhost:9090/api`
- **认证**：Bearer Token（`Authorization: Bearer <token>` 或 cookie）
- **格式**：JSON

### Agent 接口

#### GET /api/agents
获取所有可用 Agent 列表。

```json
// 响应
{
  "agents": [
    {
      "name": "game-designer",
      "description": "游戏设计师，负责核心玩法设计",
      "description_cn": "游戏设计师，负责核心玩法设计",
      "model": "Kimi-K2.6",
      "category": "design"
    }
  ]
}
```

查询参数：`?lang=zh`（返回中文描述）

#### GET /api/agents/:name
获取指定 Agent 详情。

---

### Skill 接口

#### GET /api/skills
获取所有可用 Skill 列表。

```json
// 响应
{
  "skills": [
    {
      "name": "brainstorm",
      "description": "Generate creative ideas and concepts",
      "description_cn": "生成创意和概念",
      "category": "creation",
      "user_invocable": true,
      "model": "Deepseek-V4-Flash"
    }
  ]
}
```

查询参数：`?lang=zh`

---

### 聊天接口

#### POST /api/chat
发送消息并获取 AI 响应（非流式）。

```json
// 请求
{
  "message": "设计一个战斗系统",
  "skillId": "brainstorm",
  "agentName": "game-designer",
  "sessionId": "optional-session-id"
}

// 响应
{
  "reply": "AI 响应内容...",
  "sessionId": "01J...",
  "toolCalls": [],
  "usage": { "inputTokens": 500, "outputTokens": 200 }
}
```

#### POST /api/chat/stream
流式聊天接口（Server-Sent Events）。

```json
// 请求（同上）
// 响应：SSE 事件流
event: text
data: {"delta": "部分响应文本..."}

event: tool_call
data: {"tool": "Bash", "args": {...}}

event: done
data: {"sessionId": "...", "usage": {...}}
```

---

### 会话管理

#### GET /api/sessions
获取会话列表。

#### GET /api/sessions/:id
获取指定会话详情。

#### DELETE /api/sessions/:id
删除会话。

---

### 模型配置

#### GET /api/models
获取模型配置列表。

```json
// 响应
{
  "models": [
    {
      "id": "deepseek-v4-pro",
      "name": "DeepSeek V4 Pro",
      "contextWindow": 1000000,
      "maxTokens": 32768
    }
  ]
}
```

#### POST /api/models/verify
验证模型连通性。

```json
// 请求
{ "modelId": "deepseek-v4-pro", "apiKey": "sk-..." }
```

---

### MCP 管理

#### GET /api/mcp/status
获取 MCP 服务器连接状态。

#### POST /api/mcp/tools/list
列出 MCP 服务器的工具。

#### POST /api/mcp/tools/call
调用 MCP 工具。

---

### 设置

#### GET /api/settings
获取全局设置。

#### POST /api/settings
更新全局设置。

```json
// 请求
{
  "contextWindowPercent": 50,
  "similarityThresholdPercent": 35,
  "cliSmartEnhancement": false
}
```

#### GET /api/semantic-settings
获取语义检索设置。

#### POST /api/semantic-settings
更新语义检索设置。

#### GET /api/settings/cli-smart
获取 CLI 智能增强状态。

#### POST /api/settings/cli-smart
设置 CLI 智能增强开关。

```json
// 请求
{ "enabled": true }
```

---

### 文件相关

#### GET /api/workspace-files
获取工作区文件列表。

#### GET /api/files?path=<path>
读取文件内容。

---

### Prompt 优化

#### POST /api/optimize-prompt
优化 System Prompt。


[:arrow_up: 返回目录](#目录)


---

## 6. Agent 系统

### Agent 角色分类

| 类别 | 数量 | 示例 |
|------|------|------|
| **设计** | game-designer, systems-designer, level-designer, economy-designer |
| **编程** | lead-programmer, gameplay-programmer, engine-programmer, network-programmer, ai-programmer, tools-programmer, ui-programmer |
| **美术** | art-director, technical-artist, world-builder |
| **音频** | audio-director, sound-designer |
| **叙事** | narrative-director, writer |
| **QA** | qa-lead, qa-tester, performance-analyst, security-engineer |
| **运维** | devops-engineer, build-specialist, release-manager |
| **管理** | producer, creative-director, technical-director |
| **引擎** | unreal-specialist, unity-specialist, godot-specialist, cocos-specialist |

### Agent 加载策略

三层优先级：
1. `.codesquad/agents/`（项目级，优先级最高）
2. `~/.codesquad/agents/`（用户级）
3. `AICore/agents/`（系统级，默认）

### Team 模式

支持异步并行多 Agent 协作：
- `team create <name>` — 创建团队
- `team delete <name>` — 删除团队
- `team members <name>` — 查看成员
- `team inbox [name]` — 查看邮箱

Agent 通过 `send_message` 工具进行团队通信。


[:arrow_up: 返回目录](#目录)


---

## 7. Skill 系统

### Skill 分类

| 类别 | 示例 |
|------|------|
| **流水线** | brainstorm, quick-design, create-stories, sprint-plan |
| **创作** | art-bible, design-system, asset-spec |
| **评审** | code-review, design-review, architecture-review, security-audit |
| **分析** | scope-check, consistency-check, balance-check, diagnose |
| **冲刺** | sprint-plan, sprint-status, story-done, story-readiness |
| **测试** | test-runner, test-setup, smoke-check, regression-suite |
| **团队** | team-combat, team-level, team-qa, team-ui, team-narrative |
| **发布** | release-checklist, launch-checklist, hotfix, day-one-patch |
| **引擎** | ue-blueprint, ue-gas, unity-addressables, godot-gdscript |

### Skill 调用

```bash
# REPL 中
/onboard                      # 调用 onboard skill
/brainstorm                   # 调用 brainstorm skill

# Web 控制台
POST /api/chat  { "skillId": "brainstorm", "message": "..." }
```

### Skill 模型覆盖

Skill 可以在 frontmatter 中指定模型：
```yaml
model: Deepseek-V4-Flash
```
调用时优先使用 Skill 指定的模型，而非 Agent 默认模型。


[:arrow_up: 返回目录](#目录)


---

## 8. 权限模式

### 权限管道（5 层）

```
工具调用 → 白名单检查 → 命令分类器 → 自定义规则 → 模式检查 → 默认询问
```

### 三种模式

| 模式 | 行为 | 持久化 |
|------|------|--------|
| **ask** | 每个工具调用需确认 | 默认 |
| **plan** | 只读操作，不允许写文件 | 退出时通知 LLM |
| **craft** | 自动执行所有操作 | 首次确认后持久化 |

### 命令危险分类

`command-classifier.ts` 将 Bash 命令分为：
- **安全**：ls, cat, echo, git status 等
- **中等**：npm install, git commit 等
- **危险**：rm -rf, git push --force 等


[:arrow_up: 返回目录](#目录)


---

## 9. 模型配置

### 配置文件

`models.config.yaml` 定义可用模型：

```yaml
models:
  - id: deepseek-v4-pro-202606
    name: DeepSeek V4 Pro
    provider: deepseek
    contextWindow: 1000000
    maxTokens: 32768

  - id: kimi-k2.6
    name: Kimi K2.6
    provider: moonshot
    contextWindow: 131072

  - id: glm-5.1
    name: GLM 5.1
    provider: zhipu
    contextWindow: 131072
```

### Fallback 链

LLM 调用失败时自动 fallback：
```
primary → fallback_chain[0] → fallback_chain[1] → ... → Ollama
```

502/503 错误自动重试 3 次后触发 fallback。


[:arrow_up: 返回目录](#目录)


---

## 10. 钩子系统

### 支持的事件类型（12+）

| 事件 | 触发时机 |
|------|----------|
| `pre-tool-use` | 工具调用前 |
| `post-tool-use` | 工具调用后 |
| `session-start` | 会话开始时 |
| `session-stop` | 会话结束时 |
| `pre-compact` | 上下文压缩前 |
| `post-compact` | 上下文压缩后 |
| `subagent-start` | 子 Agent 启动时 |
| `subagent-stop` | 子 Agent 停止时 |
| `permission-request` | 权限请求时 |
| `notification` | 通知事件 |
| `stop` | 停止事件 |
| `resume` | 恢复事件 |

### Hook 脚本位置

- 项目级：`.codesquad/hooks/`
- 用户级：`~/.codesquad/hooks/`
- 系统级：`AICore/hooks/`

### 示例

```bash
# .codesquad/hooks/pre-commit-code-quality.sh
echo "Running pre-commit code check..."
npx tsc --noEmit
```


[:arrow_up: 返回目录](#目录)


---

## 11. 常见问题

### Q: 如何切换 AI 模型？

在 REPL 中使用 `/config` 或通过 Web 控制台的配置面板修改 `models.config.yaml`。

### Q: Agent 嵌套调用限制？

Agent 跨会话调用上限为 5 次（`MAX_AGENT_SPAWNS=5`），防止无限递归。

### Q: 如何查看 Token 用量？

REPL 状态栏实时显示，或使用 `/usage` 命令查看详细统计。

### Q: 上下文溢出怎么办？

系统自动触发 7 阶段压缩算法。可在设置中调整上下文窗口百分比（默认 50%）。

### Q: MCP 工具如何注册？

在 Web 控制台 MCP 面板添加 MCP 服务器 URL，工具会自动发现并注册。

### Q: 如何备份项目配置？

```bash
codesquad backup
```

配置备份到 `~/.codesquad/backups/`。

### Q: 发布版和开发版有什么区别？

发布版使用 Bun 编译为单文件二进制（`codesquad.exe`），AICore 内容嵌入在二进制内，不依赖外部文件。

---

*文档基于知识图谱自动生成（提交 `a33aabf`）。源文件路径和数据来源于项目源码分析。*

## 12. 集成推荐
### Cocos MCP 

- [DaxianLee/cocos-mcp-server](https://github.com/DaxianLee/cocos-mcp-server)
- [Spaydo/cocos-mcp-extension](https://github.com/Spaydo/cocos-mcp-extension)

### Godot MCP 

- [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp)
- [youichi-uda/godot-mcp-pro](https://github.com/youichi-uda/godot-mcp-pro)
- [tugcantopaloglu/godot-mcp](https://github.com/tugcantopaloglu/godot-mcp)
- [yurineko73/Godot-MCP-Native](https://github.com/yurineko73/Godot-MCP-Native)

### Unreal MCP 

- [db-lyon/ue-mcp](https://github.com/db-lyon/ue-mcp)
- [VedantRGosavi/UE5-MCP](https://github.com/VedantRGosavi/UE5-MCP)
- [yangskin/UEEditorMCP](https://github.com/yangskin/UEEditorMCP)

### Unity MCP 

- [IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP)
- [CoplayDev/unity-mcp](https://github.com/CoplayDev/unity-mcp)
- [AnkleBreaker-Studio/unity-mcp-server](https://github.com/AnkleBreaker-Studio/unity-mcp-server)

### Blender MCP 

- [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp)
- [PatrykIti/blender-ai-mcp](https://github.com/PatrykIti/blender-ai-mcp)

---

[:arrow_up: 返回目录](#目录)