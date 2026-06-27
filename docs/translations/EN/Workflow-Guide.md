# Workflow Guide

This document details the complete workflow for game development under the CodeSquad Game Studios architecture.

---

## 7-Phase Development Pipeline

```
Concept → Pre-Production → Production (Alpha) → Production (Beta)
    → Polish → Release Prep → Live Ops
```

---

## Phase 1: Concept

**Goal**: Find your game concept, define the core loop and design pillars.

### Entry Points

#### Scenario A: No idea at all
```
/start
# or
/brainstorm open
```

**Flow**:
1. **Creative Exploration** — Use `/brainstorm open` for open-ended exploration
2. **Concept Selection** — Pick the most appealing from generated concepts
3. **Engine Selection** — Choose an engine based on concept recommendations
4. **Engine Configuration** — Run `/setup-engine` to configure the engine

#### Scenario B: Vague idea
```
/brainstorm [theme/genre]
# e.g.: /brainstorm "space exploration" or /brainstorm "roguelike"
```

**Flow**:
1. **Theme Exploration** — Brainstorm based on your theme
2. **Concept Refinement** — Expand and refine the initial idea
3. **Core Loop Definition** — Define the core gameplay loop
4. **Design Pillars** — Establish 3-5 design pillars

#### Scenario C: Clear concept
```
# Create game-concept.md directly in design/gdd/
# Then run design review
/design-review design/gdd/game-concept.md
```

### Phase Deliverables

| Deliverable | Location | Description |
|-------------|----------|-------------|
| Game Concept Doc | `design/gdd/game-concept.md` | MDA, SDT, Flow, Bartle analysis |
| Design Pillars | `design/game-pillars.md` | 3-5 core design principles |
| Technical Preferences | `.codesquad/docs/technical-preferences.md` | Engine config, naming conventions |

### Phase Gate

Run `/gate-check concept` to verify:
- ✅ Core loop defined
- ✅ Design pillars established
- ✅ Target player audience identified
- ✅ Platform and tech choices reasonable

---

## Phase 2: Pre-Production

**Goal**: Decompose the concept into systems, complete all system design documents.

### System Decomposition

```
/map-systems
```

**Functionality**:
- Enumerate all game systems
- Map inter-system dependencies
- Determine system design priority order
- Output systems index document

**Output**: `design/systems-index.md`

### System Design

For each system (in dependency order):

```
/design-system [system-name]
```

**Examples**:
```
/design-system combat
/design-system inventory
/design-system progression
```

**GDD template includes**:
1. System Overview
2. Goals & Experience
3. Mechanics Detail
4. Math Formulas & Values
5. Edge Cases & Error Handling
6. UI/UX Requirements
7. Audio Requirements
8. Relationships with Other Systems

### Architecture Design

```
/create-architecture
```

**Outputs**:
- Master architecture document
- Initial ADRs (Architecture Decision Records)
- Technical risk assessment

### Phase Gate

Run `/gate-check pre-production` to verify:
- ✅ All core system GDDs complete
- ✅ Architecture document complete
- ✅ Key technical risks identified and mitigated
- ✅ First milestone defined

---

## Phase 3: Production Alpha

**Goal**: Implement the core loop, establish a vertical slice.

### Create Epics

```
/create-epics
```

**Functionality**:
- Translate GDDs and ADRs into epics
- One epic per architectural module
- Define inter-epic dependencies

**Output**: Epic files in `production/epics/`

### Create Stories

For each epic:

```
/create-stories [epic-slug]
```

**Story Format**:
```yaml
---
epic: combat-system
status: ready
---
# Story: Implement Basic Attack System

## Acceptance Criteria
- [ ] Player can perform basic attacks
- [ ] Attacks calculate damage
- [ ] Target shows hit feedback

## Technical Tasks
- [ ] Create AttackComponent
- [ ] Implement damage formula
- [ ] Add animation triggers
```

### Develop Stories

```
/dev-story [story-file]
```

**Flow**:
1. Agent reads the story file
2. Validates readiness (`/story-readiness`)
3. Routes to the appropriate programmer Agent
4. Implements code and tests
5. Verifies acceptance criteria
6. Marks complete (`/story-done`)

### Sprint Planning

```
/sprint-plan new
```

**Sprint cadence**: Recommended 2 weeks

**Sprint plan includes**:
- Sprint goal and success criteria
- Story list (prioritized)
- Risk mitigation strategy
- Acceptance checklist

### Phase Gate

Run `/gate-check production-alpha` to verify:
- ✅ Core loop is playable
- ✅ Vertical slice complete
- ✅ Major technical risks resolved
- ✅ Performance budget established

---

## Phase 4: Production Beta

**Goal**: Complete all features, fill in content.

### Feature Completion

Continue the `/dev-story` loop until all epics are complete.

### Content Creation

Use team orchestration skills to create content in parallel:

```
/team-level [level-name]      # Level creation
/team-narrative               # Narrative content
/team-audio                   # Audio content
```

### Balance Tuning

```
/balance-check
```

**Analysis Scope**:
- Formula reasonableness
- Progression curve smoothness
- Economy balance
- Difficulty curve

### QA Integration

```
/qa-plan [sprint/feature]
/team-qa
```

### Phase Gate

Run `/gate-check production-beta` to verify:
- ✅ All features implemented
- ✅ Content fill ≥ 80%
- ✅ Zero P0/P1 bugs
- ✅ Performance at target framerate

---

## Phase 5: Polish

**Goal**: Elevate quality, fix bugs, optimize experience.

### Polish Team Orchestration

```
/team-polish
```

**Roles involved**:
- `performance-analyst` — Performance optimization
- `technical-artist` — Visual quality
- `sound-designer` — Audio quality
- `qa-tester` — Bug verification

### Bug Triage

```
/bug-triage
```

**Process**:
1. Read all open bugs
2. Re-evaluate priority vs. severity
3. Assign owners and tags
4. Allocate to sprints or milestones

### Performance Analysis

```
/perf-profile
```

### Content Audit

```
/content-audit
```

Verify all GDD-specified content has been implemented.

### Phase Gate

Run `/gate-check polish` to verify:
- ✅ All P0/P1 bugs fixed
- ✅ Performance is stable
- ✅ Player experience is smooth
- ✅ No blocking issues

---

## Phase 6: Release Prep

**Goal**: Prepare for release, certification, deployment.

### Release Checklist

```
/release-checklist
```

**Check items**:
- Platform certification requirements
- Store metadata
- Version number and build info
- Rollback plan

### Release Team Orchestration

```
/team-release
```

### Smoke Test

```
/smoke-check
```

### Soak Test

```
/soak-test
```

### Generate Release Notes

```
/changelog
/patch-notes
```

### Phase Gate

Run `/gate-check release` to verify:
- ✅ All certification requirements met
- ✅ Release checklist 100% complete
- ✅ Rollback plan ready
- ✅ Monitoring and alerting configured

---

## Phase 7: Live Ops

**Goal**: Post-launch support, updates, events.

### Live Ops Team Orchestration

```
/team-live-ops
```

**Roles involved**:
- `live-ops-designer` — Events and season design
- `economy-designer` — Economy tuning
- `community-manager` — Player communication
- `analytics-engineer` — Data analysis

### Emergency Fixes

```
/hotfix
```

Emergency fix workflow, bypassing the normal sprint process.

### Incident Response

Refer to playbooks in `production/incident-response/`.

### Player Feedback Analysis

```
/playtest-report
```

---

## Cross-Phase General Workflows

### Architecture Decisions

Whenever a technical decision is needed:

```
/architecture-decision
```

### Code Review

```
/code-review [file]
```

### Design Review

```
/design-review [document]
```

### Scope Check

```
/scope-check
```

Detect scope creep.

### Consistency Check

```
/consistency-check
```

Detect cross-document inconsistencies.

---

## Workflow Decision Tree

```
Start
  │
  ├── New project?
  │     └── /start → /brainstorm → /setup-engine
  │
  ├── Have a concept?
  │     └── /map-systems → /design-system
  │
  ├── Start development?
  │     └── /create-architecture → /create-epics → /create-stories
  │
  ├── Implement feature?
  │     └── /dev-story
  │
  ├── Check status?
  │     └── /gate-check [phase]
  │
  ├── Bug fix?
  │     └── /bug-triage → fix → /regression-suite
  │
  └── Release?
        └── /release-checklist → /team-release
```

---

## Best Practices

### 1. Frequent Checkpoints
Run `/gate-check` at the end of every phase. Don't wait until the end to discover problems.

### 2. Documentation First
Ensure relevant GDDs and ADRs are complete and reviewed before implementing code.

### 3. Small Iterations
Stories should be small enough to complete in 1-2 days. Break down large features.

### 4. Parallel Workflows
Use `/team-*` skills to coordinate multiple Agents working in parallel.

### 5. Continuous Validation
Run `/consistency-check` and `/content-audit` regularly to ensure consistency.

---

> **Tip**: Not sure what to do next? Run `/help` for context-aware suggestions.
