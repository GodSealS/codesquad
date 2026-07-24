
## First Steps for a New Project

**Not sure where to start?** Run `/start`. It asks about your current state and guides you to the right workflow. No assumptions about your game, engine, or experience level.

If you already know what you need, jump directly to the relevant path:

### Determine Your Target Platform First

Web games and mini-programs → Unity or Cocos Creator

Mobile games → Unity or Godot

High-fidelity AAA-scale games → Unreal Engine or Unity

### Path A: "I Don't Know What to Make"

> 1. **Run `/start`** (or `/brainstorm open`) — guided creative exploration: what excites you, what you've played, your constraints
>    - Generates 3 concepts, helps you pick one, defines a core loop and pillars
>    - Produces a game concept document and recommends an engine
> 2. **Set up the engine** — run `/setup-engine` (using the brainstorm recommendation)
>    - Configures CODEBUDDY.md, detects knowledge gaps, populates reference docs
>    - Creates `.codebuddy/docs/technical-preferences.md` with naming conventions, performance budgets, and engine-specific defaults
>    - If the engine version is newer than the LLM training data, it fetches the latest docs from the web so agents can suggest correct APIs
> 3. **Validate the concept** — run `/design-review design/gdd/game-concept.md`
> 4. **Decompose into systems** — run `/map-systems` to map all systems and dependencies
> 5. **Design each system** — run `/design-system [system-name]` (or `/map-systems next`) to write GDDs in dependency order
> 6. **Test the core loop** — run `/prototype [core mechanic]`
> 7. **Playtest validation** — run `/playtest-report` to verify assumptions
> 8. **Plan the first sprint** — run `/sprint-plan new`
> 9. Start building

### Path B: "I Know What to Make"

If you already have a game concept and engine choice:

> 1. **Set up the engine** — run `/setup-engine [engine] [version]` (e.g., `/setup-engine godot 4.6`) — also creates technical preferences
> 2. **Write game pillars** — delegate to `creative-director`
> 3. **Decompose into systems** — run `/map-systems` to enumerate systems and dependencies
> 4. **Design each system** — run `/design-system [system-name]` to write GDDs in dependency order
> 5. **Create initial ADRs** — run `/architecture-decision`
> 6. **Create the first milestone** in `production/milestones/`
> 7. **Plan the first sprint** — run `/sprint-plan new`
> 8. Start building

### Path C: "I Know the Game, But Not the Engine"

If you have a concept but don't know which engine fits:

> 1. **Run `/setup-engine`** without arguments — it asks about your game needs (2D/3D, platform, team size, language preference) and recommends an engine based on your answers
> 2. Continue from Path B, step 2

### Path D: "I Have an Existing Project"

If you already have design docs, prototypes, or code:

> 1. **Run `/start`** (or `/project-stage-detect`) — analyzes existing content, identifies gaps, recommends next steps
> 2. **Run `/adopt`** if you have existing GDDs, ADRs, or stories — audits internal format compliance and generates a numbered migration plan to fill gaps, without overwriting existing work
> 3. **Configure the engine as needed** — if not configured, run `/setup-engine` (auto-detects existing engine projects)
> 4. **Validate phase readiness** — run `/gate-check` to see the current status
> 5. **Plan the next sprint** — run `/sprint-plan new`

---

## Engine Project Creation Guide

Before running `/setup-engine`, you need to create an engine project locally. Below are the project creation steps and official documentation links for all four engines.

### Unity

**Creating a Project:**

1. Download and install [Unity Hub](https://unity.com/download) (Unity version manager)
2. Open Unity Hub → click **"New Project"**
3. Choose a template:
   - **2D Core** — 2D games (Built-in Render Pipeline)
   - **3D Core** — 3D games (Built-in Render Pipeline)
   - **3D URP** — 3D games (Universal Render Pipeline, recommended for mobile/cross-platform)
   - **3D HDRP** — 3D games (High Definition Render Pipeline, recommended for PC/console high-end projects)
4. Enter a project name and storage path
5. Click **"Create Project"** and wait for the Unity Editor to launch

> **Version recommendation**: Prioritize LTS (Long Term Support) versions. Currently recommended: Unity 6 (6000.x) LTS.

**Official Documentation:**

| Resource | Link |
|----------|------|
| Unity Download | https://unity.com/download |
| Unity Documentation | https://docs.unity.com/ |
| Unity Manual | https://docs.unity3d.com/Manual/ |
| Unity Scripting API | https://docs.unity3d.com/ScriptReference/ |
| Unity Learn (Tutorials) | https://learn.unity.com/ |

---

### Cocos Creator

**Creating a Project:**

1. Download and install [Cocos Dashboard](https://www.cocos.com/creator-download) (Cocos version manager)
2. Open Cocos Dashboard → click the **"Editor"** tab → install a Cocos Creator editor version
3. Switch to the **"Project"** tab → click **"New Project"**
4. Choose a template:
   - **Empty (2D)** — Blank 2D project
   - **Empty (3D)** — Blank 3D project
   - **Example Project** — Learning project with complete game logic
5. Enter a project name and storage path
6. Click **"Create"** and wait for the editor to launch

> **Version recommendation**: Use Cocos Creator 3.8 LTS or newer. The 3.x series has a major architecture upgrade over 2.x (data-oriented design, new render pipeline).

**Official Documentation:**

| Resource | Link |
|----------|------|
| Cocos Creator Download | https://www.cocos.com/creator-download |
| Cocos Creator Documentation | https://docs.cocos.com/creator/manual/en/ |
| Cocos Creator API | https://docs.cocos.com/creator/api/en/ |
| Cocos Store (Asset Store) | https://store.cocos.com/ |
| Cocos Forum | https://forum.cocos.org/ |

---

### Unreal Engine

**Creating a Project:**

1. Download and install [Epic Games Launcher](https://store.epicgames.com/en-US/download)
2. Open Epic Games Launcher → switch to the **"Unreal Engine"** tab
3. Click **"Library"** → install an engine version (recommended: 5.4 or 5.5)
4. After installation, click **"Launch"** to open the Unreal Editor
5. Choose a template:
   - **Games → Blank** — Empty project, start from scratch
   - **Games → First Person** — First-person shooter template
   - **Games → Third Person** — Third-person action template
   - **Games → Top Down** — Top-down game template
6. Choose Blueprint or C++ project
7. Enter a project name and storage path → click **"Create"**

> **Version recommendation**: Recommended UE 5.4 or 5.5. UE5 adds core technologies like Nanite (virtualized geometry) and Lumen (dynamic global illumination) over UE4. Blueprint has a low barrier to entry; C++ offers stronger performance.

**Official Documentation:**

| Resource | Link |
|----------|------|
| Epic Games Launcher | https://store.epicgames.com/en-US/download |
| Unreal Engine Documentation | https://docs.unrealengine.com/5.4/en-US/ |
| Unreal Engine API | https://docs.unrealengine.com/5.4/en-US/API/ |
| UE5 Learning Resources | https://dev.epicgames.com/community/unreal-engine/learning |
| Unreal Engine Community | https://dev.epicgames.com/community/ |

---

### Godot

**Creating a Project:**

1. Download and install [Godot Engine](https://godotengine.org/download/) (recommended Godot 4.x)
   - **Standard version** — No .NET required, uses GDScript
   - **.NET version** — Requires .NET SDK 8+, supports C# scripting
2. Open Godot → click **"Create"** or **"New Project"**
3. Enter a project name and storage path
4. Choose a renderer:
   - **Forward+** — Recommended for desktop platforms (PC/console), supports high-end 3D effects
   - **Mobile** — Recommended for mobile and web export
   - **Compatibility** — Compatibility mode, for older hardware / WebGL 2
5. Click **"Create"** and wait for project initialization

> **Version recommendation**: Recommended Godot 4.3 or newer. Godot 4.x was fully rewritten from 3.x (new renderer, improved physics, enhanced editor). Completely free and open source (MIT license), no royalties or revenue thresholds ever.

**Official Documentation:**

| Resource | Link |
|----------|------|
| Godot Download | https://godotengine.org/download/ |
| Godot Documentation | https://docs.godotengine.org/en/stable/ |
| Godot Community Tutorials | https://godotengine.org/community/ |
| Godot Asset Library | https://godotengine.org/asset-library/ |
| Godot Q&A | https://ask.godotengine.org/ |

---

### Engine Comparison Quick Reference

| Feature | Unity | Cocos Creator | Unreal Engine | Godot |
|---------|-------|---------------|---------------|-------|
| **Best for 2D** | ★★★☆ | ★★★★ | ★★☆☆ | ★★★★★ |
| **Best for 3D** | ★★★★ | ★★★☆ | ★★★★★ | ★★★☆ |
| **Mobile** | ★★★★★ | ★★★★★ | ★★☆☆ | ★★★☆ |
| **Web Export** | ★★★☆ | ★★★★★ | ★★☆☆ | ★★★★ |
| **Console Export** | ★★★★ | ★★☆☆ | ★★★★★ | ★★☆☆ |
| **Learning Curve** | Moderate | Moderate | Steep | Gentle |
| **Open Source** | No | Yes (MIT) | No (source-available) | Yes (MIT) |
| **Language** | C# | TypeScript | C++ / Blueprint | GDScript / C# |
| **Free Threshold** | Revenue <$200K | Completely free | Revenue <$1M | Completely free |

> After choosing an engine, run `/setup-engine [engine-name]` to configure it. If you already have a project directory, simply run `/setup-engine` and it will auto-detect the engine type and version. `/setup-engine` will sync CODEBUDDY.md, create technical preferences, install engine reference docs, and set up the directory structure.
