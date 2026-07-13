# CodeSquad Command Reference

> **Version**: v1.2.0
> **Total Commands**: 20
> **Generated**: 2026-07-08
> **Source**: `.codesquad/commands/*.md`

---

## Table of Contents

1. [Design](#1-design)
2. [Architecture](#2-architecture)
3. [Planning](#3-planning)
4. [Development](#4-development)
5. [QA](#5-qa)
6. [Pipeline](#6-pipeline)
7. [Gate](#7-gate)
8. [Maintenance](#8-maintenance)
9. [Release](#9-release)
10. [Utility](#10-utility)

---

## 1. Design

### brainstorm
- **Description**: Game concept ideation → prototype validation → playtest feedback loop. From structured brainstorming to playable prototype to structured feedback analysis.
- **Workflow**:
  1. `brainstorm` — Generate a structured game concept document from scratch
  2. `prototype` — Build a quick playable prototype to validate core mechanics
  3. `playtest-report` — Collect and structure prototype playtest feedback
- **Usage**:
  - Ideate a new game with a complete design validation loop
  - Transform vague ideas into validated game concepts
  - Quickly verify if core gameplay is fun through prototyping
- **Example**: `/brainstorm cozy farming` or `/brainstorm open`

### design-system
- **Description**: GDD authoring pipeline: write a system GDD → per-document review → cross-document consistency check → holistic design review. Complete design quality chain.
- **Workflow**:
  1. `design-system` — Guided, section-by-section GDD authoring for a single system
  2. `design-review` — Review GDD completeness, consistency, and implementability
  3. `consistency-check` — Cross-document entity reference consistency scan
  4. `review-all-gdds` — Holistic cross-GDD contradiction detection + design theory review
- **Usage**:
  - Write a complete GDD for a new game system from scratch
  - Ensure GDD passes full quality review before handing to programmers
  - Detect cross-system design contradictions and inconsistencies
- **Example**: `/design-system combat-system`

### ux-design
- **Description**: UX design pipeline: author a UX spec for a screen, flow, or HUD → validate for completeness, accessibility, GDD alignment, and implementation readiness.
- **Workflow**:
  1. `ux-design` — Guided, section-by-section UX spec authoring
  2. `ux-review` — Validate UX spec for completeness, accessibility compliance, GDD alignment
- **Usage**:
  - Create UX specs for new screens or UI flows
  - Design HUD layouts and interaction patterns
  - Validate UX design quality before handing off to UI programmers
- **Example**: `/ux-design inventory-screen` or `/ux-design hud`

---

## 2. Architecture

### architecture-decision
- **Description**: Create an Architecture Decision Record (ADR) documenting a significant technical decision, its context, alternatives considered, and consequences. Supports retrofit mode for existing ADRs.
- **Routes to**: `architecture-decision`
- **Usage**:
  - Document major technical choices (event system, physics engine) as formal ADRs
  - Retrofit incomplete ADRs with missing sections
  - Document architectural decisions before coding
- **Example**: `/architecture-decision "Use ECS for combat system"`

### create-architecture
- **Description**: Architecture blueprint pipeline: generate the master architecture document from all GDDs → validate coverage, ADR consistency, and engine compatibility.
- **Workflow**:
  1. `create-architecture` — Read all GDDs and generate the master architecture document
  2. `architecture-review` — Validate coverage, ADR consistency, and engine compatibility
- **Usage**:
  - Transform approved GDDs into a technical architecture blueprint
  - Define module API boundaries and interface contracts
  - Audit existing ADR quality and verify engine compatibility
- **Example**: `/create-architecture full` or `/create-architecture data-flow`

---

## 3. Planning

### create-epics
- **Description**: Epic → Story decomposition pipeline: translate GDDs + architecture into epics, then break each epic into implementable story files with full traceability.
- **Workflow**:
  1. `create-epics` — Translate GDDs + ADRs into epics (one per architectural module)
  2. `create-stories` — Break each epic into implementable story files
- **Usage**:
  - Transform design into plannable epics after architecture is complete
  - Generate implementable story files for each epic
  - Ensure each story has full GDD requirement and ADR traceability
- **Example**: `/create-epics combat-system` or `/create-epics layer:core`

### sprint-plan
- **Description**: Sprint preparation pipeline: generate sprint plan → engineering task decomposition → QA test plan. One-stop sprint setup.
- **Workflow**:
  1. `sprint-plan` — Generate or update the sprint plan
  2. `planning` — Engineering task decomposition (dependency graph → vertical slices → acceptance criteria)
  3. `qa-plan` — Generate sprint test plan (automation + manual + smoke test)
- **Usage**:
  - Generate a complete sprint plan when starting a new sprint
  - Decompose epics into executable engineering tasks
  - Define test scope and strategy before the sprint begins
- **Example**: `/sprint-plan new` or `/sprint-plan update`

### milestone-review
- **Description**: Milestone assessment pipeline: comprehensive progress review with go/no-go recommendation → retrospective with actionable insights for next iteration.
- **Workflow**:
  1. `milestone-review` — Generate feature completeness, quality metrics, risk assessment, and go/no-go recommendation
  2. `retrospective` — Analyze completed work, velocity, blockers, and patterns; produce actionable insights
- **Usage**:
  - Comprehensive progress assessment before milestone deadlines
  - Post-sprint or post-milestone retrospective review
  - Extract actionable improvements for the next phase
- **Example**: `/milestone-review current` or `/milestone-review pre-alpha`

### plan
- **Description**: Engineering task decomposition: dependency graph → vertical slices → acceptance criteria. Routes to the planning skill.
- **Routes to**: `planning`
- **Usage**:
  - Decompose features or sprints into ordered engineering tasks
  - Analyze dependencies and establish vertical slices
  - Define acceptance criteria and time estimates for each task
- **Example**: `/plan combat-system`

---

## 4. Development

### story-readiness
- **Description**: Story implementation pipeline: validate readiness → implement (standard or TDD) → code review → mark done. The core development loop.
- **Workflow**:
  1. `story-readiness` — Validate story readiness (READY/NEEDS WORK/BLOCKED)
  2. `dev-story` or `tdd` — Implement the story (standard routing or test-driven alternative)
  3. `code-review` — Review implementation code quality
  4. `story-done` — Verify acceptance criteria, update status, surface next ready story
- **Usage**:
  - Standard implementation flow when a developer picks up a new story
  - Ensure quality control throughout the story lifecycle
  - Support both standard implementation and TDD development modes
- **Example**: `/story-readiness production/stories/combat-damage.md`

### spec
- **Description**: Create a structured technical specification before implementation. Routes to the spec-driven skill.
- **Routes to**: `spec-driven`
- **Usage**:
  - Establish structured technical foundation before brainstorming
  - Create complete technical specs for features or components
  - Output to `design/specs/` directory
- **Example**: `/spec combat-system`

---

## 5. QA

### bug-report
- **Description**: Bug lifecycle pipeline: create structured bug report → triage by severity/priority → diagnose root cause with systematic debugging loop.
- **Workflow**:
  1. `bug-report` — Create structured bug report or analyze code for potential bugs
  2. `bug-triage` — Classify by severity × priority, detect systemic trends
  3. `diagnose` — Execute "reproduce → hypothesize → instrument → fix → regression-test" cycle for high-priority bugs
- **Usage**:
  - Create standardized bug reports when bugs are discovered
  - Classify and prioritize the bug backlog at sprint start
  - Execute systematic root-cause diagnosis for high-priority bugs
- **Example**: `/bug-report "Player falls through floor in Level 3"` or `/bug-report analyze src/gameplay/combat/`

---

## 6. Pipeline

### localize
- **Description**: Full localization pipeline: scan for hardcoded strings, extract string tables, validate translations, cultural/sensitivity review, VO localization, RTL testing, string freeze enforcement, and coverage reporting.
- **Routes to**: `localize` (10 sub-modes)
- **Usage**:
  - Scan the codebase for hardcoded strings
  - Extract and manage translation string tables
  - Run cultural/sensitivity reviews
  - Manage voice-over localization workflows
  - Test RTL layout and platform compliance
- **Example**: `/localize scan` or `/localize extract` or `/localize qa`

### vertical-slice
- **Description**: Guided vertical slice workflow from end-to-end design to playable implementation. Choose a feature subset spanning all system layers to validate the core game loop at near-production quality.
- **Routes to**: `vertical-slice`
- **Usage**:
  - Validate the core game loop late in Pre-Production
  - Build an end-to-end playable slice at near-production quality
  - Verify the team can deliver production-quality features on schedule
- **Example**: `/vertical-slice`

### release-checklist
- **Description**: Release preparation pipeline: generate release checklist → launch/store checklist → day-one patch planning → player-facing patch notes → changelog generation.
- **Workflow**:
  1. `release-checklist` — Generate release checklist based on project phase
  2. `launch-checklist` — Generate categorized launch/store checklist
  3. `day-one-patch` — Scope → implement → QA-gate the day-one patch
  4. `patch-notes` — Generate player-facing patch notes from git/sprint data
  5. `changelog` — Auto-generate developer and player-facing changelogs
- **Usage**:
  - Generate a complete release preparation checklist
  - Plan the scope and priority of the day-one patch
  - Auto-generate player-facing patch notes and changelogs
- **Example**: `/release-checklist pc` or `/release-checklist all`

---

## 7. Gate

### gate-check
- **Description**: Validate readiness to advance between development phases (Concept → Systems Design → Technical Setup → Pre-Production → Production → Polish → Release). Produces PASS/CONCERNS/FAIL verdict with specific blockers.
- **Routes to**: `gate-check` (7-stage phase gate validation)
- **Usage**:
  - Formal verification before advancing to the next development phase
  - Check required artifacts exist and are content-complete
  - Auto-detect current phase and confirm the gate to run
- **Example**: `/gate-check pre-production` or `/gate-check polish`

---

## 8. Maintenance

### deprecation
- **Description**: Debt cleanup pipeline: scan for technical debt → manage deprecation lifecycle → simplify residual complexity → code review the migration. Complete "discover → manage → clean → review" chain.
- **Workflow**:
  1. `tech-debt` — Scan for debt indicators (TODO/FIXME/HACK), maintain debt register
  2. `deprecation` — Execute five-phase lifecycle (ANNOUNCE→WARN→MIGRATE→BLOCK→REMOVE)
  3. `simplify` — Clean up residual complexity and dead code after removal
  4. `code-review` — Review migration code quality
- **Usage**:
  - Clean up technical debt in the codebase
  - Safely deprecate and remove old systems
  - Ensure code quality after replacing old implementations
- **Example**: `/deprecation old-combat-system` or `/deprecation scan`

### simplify
- **Description**: Code simplification workflow: identify simplification opportunities → incremental changes → test verification. Routes to the simplify skill.
- **Routes to**: `simplify`
- **Usage**:
  - Clean up code after completing a feature
  - Simplify code identified during review
  - Periodic maintenance on frequently-touched files
- **Example**: `/simplify src/gameplay/combat/`

---

## 9. Release

### ship
- **Description**: Pre-release parallel review fan-out: spawns lead-programmer, security-engineer, and qa-tester concurrently for go/no-go assessment.
- **Workflow**:
  1. Parallel spawn: lead-programmer (code review) + security-engineer (security audit) + qa-tester (test coverage)
  2. Merge all three reports
  3. GO / NO-GO decision: blocking issues list + recommended fixes + rollback plan
- **Usage**:
  - Final quality gate before any release or milestone delivery
  - Multi-dimensional assessment of code quality, security, and test coverage in parallel
- **Example**: `/ship v1.2.0`

---

## 10. Utility

### adopt
- **Description**: Brownfield project onboarding — audits existing artifacts for template format compliance, classifies gaps by impact, and produces a numbered migration plan.
- **Routes to**: `adopt`
- **Usage**:
  - Join an in-progress project and assess template compatibility
  - Upgrade from an older template version, needing a migration plan
  - Check format compliance of existing GDDs, ADRs, and stories
- **Example**: `/adopt full` or `/adopt gdds`

---

## Appendix: Workflow Phase Index

### Concept Phase
`/brainstorm` → `/spec`

### Systems Design
`/design-system` → `/ux-design`

### Technical Setup
`/architecture-decision` → `/create-architecture` → `/gate-check technical-setup`

### Pre-Production
`/create-epics` → `/sprint-plan` → `/plan` → `/vertical-slice` → `/gate-check pre-production`

### Production
`/story-readiness` → `/simplify` → `/deprecation`

### Sprint Management
`/sprint-plan` → `/milestone-review`

### QA & Bugs
`/bug-report` → `/gate-check production`

### Release
`/release-checklist` → `/ship` → `/localize` → `/gate-check release`

### Operations
`/adopt` → `/deprecation`
