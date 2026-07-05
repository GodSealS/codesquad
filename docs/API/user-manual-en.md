# CodeSquad User Manual

> **Version**: v1.1.2
> **Source**: Knowledge graph `.understand-anything/knowledge-graph.json` (commit `a33aabf`)
> **Generated**: 2026-07-03

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [CLI Command Reference](#2-cli-command-reference)
3. [REPL Interactive Mode](#3-repl-interactive-mode)
4. [Web Console](#4-web-console)
5. [API Documentation](#5-api-documentation)
6. [Agent System](#6-agent-system)
7. [Skill System](#7-skill-system)
8. [Permission Modes](#8-permission-modes)
9. [Model Configuration](#9-model-configuration)
10. [Hook System](#10-hook-system)
11. [FAQ](#11-faq)
12. [Integration Recommendations](#12-integration-recommendations)


[:arrow_up: Back to TOC](#table-of-contents)


---

## 1. Quick Start

### Installation

```bash
npm install -g @GodSealS/codesquad
```

Requires: Node.js >= 20.19.0

### Initialize Project

```bash
codesquad init                    # Standard initialization
codesquad init --tools            # With toolchain
codesquad init --engine unreal    # With engine preset
```

Initialization creates:
- `CODESQUAD.md` — Project guide file
- `.codesquad/` — Agent/Skill/config directory
- `design/` — Design documents directory

### Launch Setup Wizard

```bash
codesquad start       # Guided onboarding (recommended for first use)
codesquad setup-engine --engine godot    # Configure engine
```


[:arrow_up: Back to TOC](#table-of-contents)


---

## 2. CLI Command Reference

### Core Commands

| Command | Description |
|------|------|
| `codesquad` | Start interactive REPL |
| `codesquad init [--tools] [--engine <name>]` | Initialize project |
| `codesquad serve [--port <port>]` | Start API server (default 9090) |
| `codesquad repl` | Enter REPL mode directly |
| `codesquad build` | AI-driven project build |
| `codesquad test` | AI-driven test execution |
| `codesquad mcp` | Start MCP server |

### Management Commands

| Command | Description |
|------|------|
| `codesquad validate [agent-name]` | Validate Agent/Skill definitions |
| `codesquad check` | Check skill compliance |
| `codesquad check-stubs` | Check stub files |
| `codesquad backup` | Backup project configuration |
| `codesquad update` | Update .codesquad to latest |
| `codesquad version` | Show version info |
| `codesquad create <type>` | Create new Agent/Skill |
| `codesquad bind` | Bind AI tool adapters |
| `codesquad config` | Manage project configuration |
| `codesquad register` | Register Agent/Skill to project |

### Engine Commands

| Command | Description |
|------|------|
| `codesquad engine detect` | Detect project engine |
| `codesquad engine unreal` | Unreal Engine build/test |
| `codesquad engine unity` | Unity build/test |
| `codesquad engine godot` | Godot build/test |
| `codesquad engine cocos` | Cocos Creator build/test |


[:arrow_up: Back to TOC](#table-of-contents)


---

## 3. REPL Interactive Mode

After starting REPL, interact with the AI team using natural language.

### Built-in Commands

| Command | Description |
|------|------|
| `/help` | Show help |
| `/mode [ask\|craft\|plan]` | Switch permission mode |
| `/tasks [list\|<id>\|stop <id>]` | Task management |
| `/team [list\|create\|delete\|members\|inbox]` | Team management |
| `/usage [cache]` | Show token usage stats |
| `/stream` | Toggle streaming mode |
| `/reset` | Reset project config files |
| `/delete` / `/del` | Delete session |
| `Ctrl+C` | Interrupt current operation (2s window) |
| `Tab` | Auto-complete commands |
| `Shift+Tab` | Reverse selection |

### Permission Modes

- **ask** (default): Confirmation required for each operation
- **plan**: Read-only analysis, no write operations
- **craft**: Auto-execute, first-time confirmation required (persistent)

### Context Management

- Status bar shows real-time token usage (window >= 200K shows decimals + absolute tokens)
- Automatic context compaction (triggers at 50% window usage)
- Semantic filtering (CLI smart enhancement enabled, from message #5)
- Cross-session memory (MEMORY.md)


[:arrow_up: Back to TOC](#table-of-contents)


---

## 4. Web Console

### Launch

```bash
# Backend API server
codesquad serve --port 9090

# Frontend dev server (another terminal)
cd UI/web-console-src
npm install
npm run dev
```

### Features

- **Chat Panel**: Streaming chat with tool-call visualization (ThinkingCard + ToolCallCard)
- **MCP Panel**: Manage MCP server connections and tool discovery
- **Config Panel**: Model configuration, API Key management
- **Settings Panel**: Context window %, similarity threshold, CLI smart enhancement
- **File Browser**: Browse project file structure
- **Permission Dialog**: Confirm tool calls in ask mode

### Authentication

Web Console uses Bearer Token authentication:
1. Visit `http://localhost:9090/login`
2. Enter API Token
3. Browser automatically sets `codesquad_token` cookie
4. All subsequent requests carry the cookie automatically


[:arrow_up: Back to TOC](#table-of-contents)


---

## 5. API Documentation

### Basics

- **Base Path**: `http://localhost:9090/api`
- **Auth**: Bearer Token (`Authorization: Bearer <token>` or cookie)
- **Format**: JSON

### Agent API

#### GET /api/agents
Get all available agents.

```json
// Response
{
  "agents": [
    {
      "name": "game-designer",
      "description": "Game designer, responsible for core gameplay design",
      "description_cn": "游戏设计师，负责核心玩法设计",
      "model": "Kimi-K2.6",
      "category": "design"
    }
  ]
}
```

Query params: `?lang=zh` (returns Chinese descriptions)

#### GET /api/agents/:name
Get agent details.

---

### Skill API

#### GET /api/skills
Get all available skills.

```json
// Response
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

Query params: `?lang=zh`

---

### Chat API

#### POST /api/chat
Send message and get AI response (non-streaming).

```json
// Request
{
  "message": "Design a combat system",
  "skillId": "brainstorm",
  "agentName": "game-designer",
  "sessionId": "optional-session-id"
}

// Response
{
  "reply": "AI response content...",
  "sessionId": "01J...",
  "toolCalls": [],
  "usage": { "inputTokens": 500, "outputTokens": 200 }
}
```

#### POST /api/chat/stream
Streaming chat (Server-Sent Events).

```json
// Request (same as above)
// Response: SSE event stream
event: text
data: {"delta": "Partial response text..."}

event: tool_call
data: {"tool": "Bash", "args": {...}}

event: done
data: {"sessionId": "...", "usage": {...}}
```

---

### Session Management

#### GET /api/sessions
Get session list.

#### GET /api/sessions/:id
Get session details.

#### DELETE /api/sessions/:id
Delete session.

---

### Model Configuration

#### GET /api/models
Get model configuration list.

```json
// Response
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
Verify model connectivity.

```json
// Request
{ "modelId": "deepseek-v4-pro", "apiKey": "sk-..." }
```

---

### MCP Management

#### GET /api/mcp/status
Get MCP server connection status.

#### POST /api/mcp/tools/list
List MCP server tools.

#### POST /api/mcp/tools/call
Call MCP tool.

---

### Settings

#### GET /api/settings
Get global settings.

#### POST /api/settings
Update global settings.

```json
// Request
{
  "contextWindowPercent": 50,
  "similarityThresholdPercent": 35,
  "cliSmartEnhancement": false
}
```

#### GET /api/semantic-settings
Get semantic search settings.

#### POST /api/semantic-settings
Update semantic search settings.

#### GET /api/settings/cli-smart
Get CLI smart enhancement status.

#### POST /api/settings/cli-smart
Toggle CLI smart enhancement.

```json
// Request
{ "enabled": true }
```

---

### File Operations

#### GET /api/workspace-files
Get workspace file list.

#### GET /api/files?path=<path>
Read file content.

---

### Prompt Optimization

#### POST /api/optimize-prompt
Optimize system prompt.


[:arrow_up: Back to TOC](#table-of-contents)


---

## 6. Agent System

### Agent Role Categories

| Category | Count | Examples |
|------|------|------|
| **Design** | game-designer, systems-designer, level-designer, economy-designer |
| **Programming** | lead-programmer, gameplay-programmer, engine-programmer, network-programmer, ai-programmer, tools-programmer, ui-programmer |
| **Art** | art-director, technical-artist, world-builder |
| **Audio** | audio-director, sound-designer |
| **Narrative** | narrative-director, writer |
| **QA** | qa-lead, qa-tester, performance-analyst, security-engineer |
| **DevOps** | devops-engineer, build-specialist, release-manager |
| **Management** | producer, creative-director, technical-director |
| **Engine** | unreal-specialist, unity-specialist, godot-specialist, cocos-specialist |

### Agent Loading Strategy

Three-layer priority:
1. `.codesquad/agents/` (project-level, highest priority)
2. `~/.codesquad/agents/` (user-level)
3. `AICore/agents/` (system-level, default)

### Team Mode

Supports async parallel multi-agent collaboration:
- `team create <name>` — Create team
- `team delete <name>` — Delete team
- `team members <name>` — View members
- `team inbox [name]` — Check inbox

Agents communicate via the `send_message` tool.


[:arrow_up: Back to TOC](#table-of-contents)


---

## 7. Skill System

### Skill Categories

| Category | Examples |
|------|------|
| **Pipeline** | brainstorm, quick-design, create-stories, sprint-plan |
| **Creation** | art-bible, design-system, asset-spec |
| **Review** | code-review, design-review, architecture-review, security-audit |
| **Analysis** | scope-check, consistency-check, balance-check, diagnose |
| **Sprint** | sprint-plan, sprint-status, story-done, story-readiness |
| **Testing** | test-runner, test-setup, smoke-check, regression-suite |
| **Team** | team-combat, team-level, team-qa, team-ui, team-narrative |
| **Release** | release-checklist, launch-checklist, hotfix, day-one-patch |
| **Engine** | ue-blueprint, ue-gas, unity-addressables, godot-gdscript |

### Skill Invocation

```bash
# In REPL
/onboard                      # Invoke onboard skill
/brainstorm                   # Invoke brainstorm skill

# Web Console
POST /api/chat  { "skillId": "brainstorm", "message": "..." }
```

### Skill Model Override

Skills can specify models in frontmatter:
```yaml
model: Deepseek-V4-Flash
```
Skill-specified model takes priority over Agent default.


[:arrow_up: Back to TOC](#table-of-contents)


---

## 8. Permission Modes

### Permission Pipeline (5 layers)

```
Tool call → Whitelist check → Command classifier → Custom rules → Mode check → Default ask
```

### Three Modes

| Mode | Behavior | Persistent |
|------|------|--------|
| **ask** | Each tool call requires confirmation | Default |
| **plan** | Read-only, no file writes | Notifies LLM on exit |
| **craft** | Auto-execute all operations | First confirmation persists |

### Command Danger Classification

`command-classifier.ts` classifies Bash commands as:
- **Safe**: ls, cat, echo, git status, etc.
- **Medium**: npm install, git commit, etc.
- **Dangerous**: rm -rf, git push --force, etc.


[:arrow_up: Back to TOC](#table-of-contents)


---

## 9. Model Configuration

### Config File

`models.config.yaml` defines available models:

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

### Fallback Chain

LLM call failure triggers automatic fallback:
```
primary → fallback_chain[0] → fallback_chain[1] → ... → Ollama
```

502/503 errors retry 3 times before fallback.


[:arrow_up: Back to TOC](#table-of-contents)


---

## 10. Hook System

### Supported Events (12+)

| Event | Trigger |
|------|----------|
| `pre-tool-use` | Before tool call |
| `post-tool-use` | After tool call |
| `session-start` | Session starts |
| `session-stop` | Session ends |
| `pre-compact` | Before context compaction |
| `post-compact` | After context compaction |
| `subagent-start` | Sub-agent starts |
| `subagent-stop` | Sub-agent stops |
| `permission-request` | Permission requested |
| `notification` | Notification event |
| `stop` | Stop event |
| `resume` | Resume event |

### Hook Script Locations

- Project-level: `.codesquad/hooks/`
- User-level: `~/.codesquad/hooks/`
- System-level: `AICore/hooks/`

### Example

```bash
# .codesquad/hooks/pre-commit-code-quality.sh
echo "Running pre-commit code check..."
npx tsc --noEmit
```


[:arrow_up: Back to TOC](#table-of-contents)


---

## 11. FAQ

### Q: How to switch AI models?

Use `/config` in REPL or modify `models.config.yaml` via Web Console config panel.

### Q: Agent nested call limit?

Cross-session agent call limit is 5 (`MAX_AGENT_SPAWNS=5`) to prevent infinite recursion.

### Q: How to view token usage?

REPL status bar shows real-time display, or use `/usage` for detailed stats.

### Q: What if context overflows?

Automatic 7-stage compaction algorithm triggers. Adjust context window percentage in settings (default 50%).

### Q: How to register MCP tools?

Add MCP server URL in Web Console MCP panel, tools auto-discover and register.

### Q: How to backup project config?

```bash
codesquad backup
```

Backups stored at `~/.codesquad/backups/`.

### Q: Difference between release and dev builds?

Release uses Bun to compile single binary (`codesquad.exe`), AICore content embedded in binary, no external dependencies.

---

*Document auto-generated from knowledge graph (commit `a33aabf`). Content sourced from project code analysis.*

## 12. Integration Recommendations

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

[:arrow_up: Back to TOC](#table-of-contents)
