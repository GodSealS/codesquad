# Game Development Guide

This document details how to use this prompt engineering system to develop a game with CodeSquad.

---

## Prerequisites

### System Requirements

- **CodeSquad IDE** (VS Code extension or JetBrains plugin)
- **Git** (version control)
- **Game Engine** (Godot 4 / Unity / Unreal Engine 5)

### Project Initialization

1. **Clone or create project**
   ```bash
   git clone [your-repo] my-game
   cd my-game
   ```

2. **Ensure CODESQUAD.md exists**

   This is the project entry point file.

3. **Start a CodeSquad session**

   Open the project in your IDE and launch CodeSquad.

---

## Scenario 1: Starting from Scratch (No Game Concept)

### Step 1: Start the Onboarding Flow

```
/start
```

**What happens**:
- CodeSquad detects project state (empty project)
- Asks about your starting point:
  - A) No idea
  - B) Vague idea
  - C) Clear concept
  - D) Existing work

**Choose A: No idea**

### Step 2: Brainstorm

```
/brainstorm open
```

**Flow**:
1. **Creative Exploration** — Answer questions about games you enjoy, what excites you, your constraints
2. **Concept Generation** — System generates 3 game concepts
3. **Concept Selection** — Pick the most appealing concept
4. **Core Loop Definition** — Define the game's core loop
5. **Design Pillars** — Establish 3-5 design pillars

**Outputs**:
- `design/gdd/game-concept.md` — Game concept document
- `design/game-pillars.md` — Design pillars

### Step 3: Engine Configuration

```
/setup-engine
```

**Interactive selection**:
- Engine recommendation (based on concept)
- Version selection
- Naming convention configuration

**Outputs**:
- Updated `CODESQUAD.md` tech stack
- Created `.codesquad/docs/technical-preferences.md`
- Populated engine reference docs

### Step 4: System Decomposition

```
/map-systems
```

**Functionality**:
- Enumerate all game systems
- Map dependencies
- Determine design priority

**Output**:
- `design/systems-index.md`

### Step 5: System Design

For each system (in dependency order):

```
/design-system [system-name]
```

**Examples**:
```
/design-system combat
/design-system inventory
/design-system progression
/design-system ai
```

**Output**:
- `design/gdd/[system-name].md`

### Step 6: Prototype Validation

```
/prototype [core-mechanic]
```

**Example**:
```
/prototype combat
```

**Output**:
- `prototypes/combat/` — Disposable prototype

### Step 7: Playtesting

```
/playtest-report
```

**Output**:
- Playtest report

### Step 8: First Sprint Plan

```
/sprint-plan new
```

**Output**:
- `production/sprints/sprint-1.md`

---

## Scenario 2: Clear Concept Already

### Step 1: Engine Configuration

```
/setup-engine [engine] [version]
```

**Example**:
```
/setup-engine godot 4.6
```

### Step 2: Write Design Pillars

Delegate to `creative-director`:

```
Please help me define the game's design pillars
```

**Output**:
- `design/game-pillars.md`

### Steps 3-8: Same as Above

Continue from Scenario 1, Step 4.

---

## Scenario 3: Existing Project (Migrating to This Architecture)

### Step 1: Project Stage Detection

```
/project-stage-detect
```

**Output**:
- Current stage report
- Existing artifacts inventory
- Missing critical artifacts

### Step 2: Migration Audit

```
/adopt
```

**Functionality**:
- Check existing GDD/ADR/Story format compliance
- Generate numbered migration plan

### Step 3: Engine Configuration (If Needed)

```
/setup-engine
```

### Step 4: Gate Check

```
/gate-check [phase]
```

**Determine current phase**:
- `concept` — Concept phase
- `pre-production` — Pre-Production
- `production-alpha` — Production Alpha
- `production-beta` — Production Beta
- `polish` — Polish

---

## Daily Development Workflow

### Sprint Planning

**At the start of each sprint**:

```
/sprint-plan new
```

Or update an existing sprint:

```
/sprint-plan sprint-3
```

### Implementing Features

**Method 1: Using /dev-story (Recommended)**

```
/dev-story production/stories/combat/basic-attack.md
```

**Flow**:
1. Read the Story file
2. Validate readiness (`/story-readiness`)
3. Route to appropriate programmer Agent
4. Implement code and tests
5. Verify acceptance criteria
6. Mark complete (`/story-done`)

**Method 2: Direct Agent Delegation**

```
@gameplay-programmer Please implement the basic attack system
```

### Code Review

**Self-review**:
```
/code-review src/gameplay/combat/attack.gd
```

**Review others' code**:
```
@lead-programmer Please review this implementation
```

### Design Review

```
/design-review design/gdd/combat.md
```

### Scope Check

```
/scope-check
```

Detect if work exceeds planned scope.

### Consistency Check

```
/consistency-check
```

Detect cross-document inconsistencies.

---

## Team Collaboration Workflow

### Combat System Development

```
/team-combat
```

**Coordinated roles**:
- game-designer — Design combat mechanics
- gameplay-programmer — Implement combat code
- ai-programmer — Implement enemy AI
- technical-artist — Combat VFX
- sound-designer — Combat audio
- qa-tester — Test combat

### Level Creation

```
/team-level forest-level
```

**Coordinated roles**:
- level-designer — Level layout
- narrative-director — Level narrative
- world-builder — World elements
- art-director — Visual direction
- systems-designer — Level-specific mechanics
- qa-tester — Level testing

### UI Development

```
/team-ui
```

**Coordinated roles**:
- ux-designer — UX design
- ui-programmer — UI implementation
- art-director — Visual style
- accessibility-specialist — Accessibility

---

## QA and Testing Workflow

### QA Plan

```
/qa-plan sprint-3
```

### Smoke Test

```
/smoke-check
```

### Regression Suite

```
/regression-suite
```

### Bug Report

```
/bug-report
```

**Interactive bug report creation**.

### Bug Triage

```
/bug-triage
```

---

## Release Workflow

### Release Checklist

```
/release-checklist
```

### Launch Checklist

```
/launch-checklist
```

### Generate Changelog

```
/changelog
```

### Generate Patch Notes

```
/patch-notes
```

### Release Team Orchestration

```
/team-release
```

---

## Live Ops Workflow (Post-Launch)

### Live Ops Team Orchestration

```
/team-live-ops
```

### Emergency Hotfix

```
/hotfix [bug-id]
```

**Bypasses normal sprint process**.

---

## Best Practices

### 1. Always Start with Documentation

```
❌ Wrong: Jump straight into code
✅ Right: Write GDD first, then code
```

### 2. Frequent Checkpoints

```
/gate-check [phase]   # At the end of each phase
/consistency-check     # Weekly
/scope-check           # Per sprint
```

### 3. Small Iterations

```
❌ Wrong: One story takes a week
✅ Right: Stories completable in 1-2 days
```

### 4. Parallel Workflows

```
Use /team-* skills to coordinate multiple Agents working in parallel
```

### 5. Version Control

```
❌ Wrong: Long gaps between commits
✅ Right: Commit on each story completion
```

### 6. Review Culture

```
/design-review   # Design review
/code-review     # Code review
```

### 7. Record Decisions

```
/architecture-decision   # Document architecture decisions
```

---

## FAQ

### Q: Not sure which Agent to use?

**A**: Run `/help` or ask `producer`.

### Q: Engine issues during implementation?

**A**: Consult engine-specific specialists:
- Godot: `@godot-specialist`
- Unity: `@unity-specialist`
- Unreal: `@unreal-specialist`

### Q: Design decision conflicts?

**A**: Escalate to `creative-director` for adjudication.

### Q: Technical decision conflicts?

**A**: Escalate to `technical-director` for adjudication.

### Q: Scope creep?

**A**: Run `/scope-check`, then consult `producer`.

---

## Sample Project Timeline

### Weeks 1-2: Concept & Pre-Production

```
Week 1:
- /start
- /brainstorm open
- /setup-engine
- /map-systems

Week 2:
- /design-system combat
- /design-system inventory
- /create-architecture
```

### Weeks 3-4: Production Starts

```
Week 3:
- /create-epics
- /create-stories combat-epic
- /sprint-plan new

Week 4:
- /dev-story (multiple stories)
```

### Weeks 5-8: Iterative Development

```
Every 2 weeks:
- /sprint-plan new
- /dev-story (implement stories)
- /code-review
- /story-done
- /sprint-status
- /retrospective
```

### Weeks 9-10: Polish & Release

```
Week 9:
- /team-polish
- /bug-triage
- /perf-profile

Week 10:
- /release-checklist
- /team-release
- /launch-checklist
```

---

> **Tip**: This architecture is flexible and can be adjusted to project needs. The key is keeping documentation and code in sync, along with frequent communication and review.
