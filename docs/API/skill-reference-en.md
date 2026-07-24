# CodeSquad Skill Reference

> **Version**: v1.2.0
> **Total Skills**: 76 (excluding engine/team-specific skills)
> **Generated**: 2026-07-07
> **Source**: `.codesquad/skills/*/SKILL.md`

---

## Table of Contents

1. [Authoring](#1-authoring)
2. [Pipeline](#2-pipeline)
3. [Review](#3-review)
4. [Analysis](#4-analysis)
5. [Sprint](#5-sprint)
6. [Utility](#6-utility)
7. [Readiness](#7-readiness)
8. [Gate](#8-gate)

---

## 1. Authoring

### architecture-decision
- **Description**: Creates Architecture Decision Records documenting significant technical decisions with context, alternatives, and consequences.
- **Usage**:
  - Document major technical choices (event system, physics engine) as formal ADRs
  - Retrofit incomplete ADRs with missing sections
  - Document architectural decisions before coding
  - Record deprecation/replacement relationships between conflicting ADRs
- **Example**: `/architecture-decision event-system-architecture --review full`

### art-bible
- **Description**: Guided art bible authoring — establishes visual identity specs that gate all asset production.
- **Usage**:
  - Create complete visual identity before writing GDDs
  - Provide concrete art direction for outsourced teams
  - Fill in missing sections (retrofit mode)
- **Example**: `/art-bible --review full`

### brainstorm
- **Description**: Guided game concept ideation — from zero to structured game concept document using professional studio techniques and player psychology frameworks.
- **Usage**:
  - Ideate a new game with structured creative guidance
  - Develop a vague idea into a complete concept
  - Validate target player types and market feasibility
- **Example**: `/brainstorm cozy farming --review full`

### create-architecture
- **Description**: Guided section-by-section architecture document authoring. Reads all GDDs, system index, ADRs, and engine references to produce a complete architecture blueprint.
- **Usage**:
  - Transform approved GDDs into technical architecture
  - Define module API boundaries and interface contracts
  - Audit existing ADR quality
- **Example**: `/create-architecture full --review full`

### design-system
- **Description**: Guided GDD authoring for a single game system. Gathers context from existing docs and cross-references dependencies as you write.
- **Usage**:
  - Write a complete GDD for a new game system from scratch
  - Fill in missing sections in existing GDDs (retrofit)
  - Ensure design quality via expert agent collaboration
- **Example**: `/design-system combat-system --review full`

### design-with-kb
- **Description**: Search the knowledge base for matching design patterns and techniques before implementation. Matches by domain, tags, and engine.
- **Usage**:
  - Search for existing design patterns in the knowledge base
  - Match by engine, domain, and tags
  - Evaluate candidate technique applicability
- **Example**: `/design-with-kb spatial querying unreal`

### prototype
- **Description**: Guided prototyping workflow — write code to create a quick game prototype or vertical slice. Validate core mechanics through playable implementation.
- **Usage**:
  - Quickly validate if core gameplay is fun
  - Verify assumptions via a playable prototype before writing GDDs
  - Spike-mode quick testing of specific technical issues during production
- **Example**: `/prototype "grappling hook traversal" --path html`

### quick-design
- **Description**: Lightweight design spec for small changes — tuning adjustments, minor mechanic modifications, balance tweaks. Skips full GDD authoring.
- **Usage**:
  - Make tuning/minor tweaks that don't need a full GDD
  - Changes under ~4 hours of implementation work
  - Small modifications to an already-documented system
- **Example**: `/quick-design "increase jump height from 5 to 6 units"`

### spec-driven
- **Description**: Create a structured 6-area technical specification: overview, architecture, interface contract, data model, constraints, and acceptance criteria.
- **Usage**:
  - Establish structured technical foundation before brainstorming
  - Create complete technical specs for features or components
  - Review specs with architect, performance analyst, and security engineer
- **Example**: `/spec-driven combat-system`

### ux-design
- **Description**: Guided UX spec authoring for screens, flows, or HUD. Reads game concept, player journey, and relevant GDDs for context-aware design guidance.
- **Usage**:
  - Write UX specs for specific screens or flows
  - Design game HUD (information architecture, layout, elements)
  - Create and maintain interaction pattern libraries
- **Example**: `/ux-design main-menu`

---

## 2. Pipeline

### adopt
- **Description**: Brownfield project onboarding — audits existing artifacts against template format compliance, classifies gaps by impact, and generates numbered migration plans.
- **Usage**:
  - Join an in-progress project with existing artifacts
  - Upgrade from an old template version
  - Verify existing GDDs/ADRs/Stories can be read correctly by pipeline skills
- **Example**: `/adopt full`

### asset-audit
- **Description**: Audit game assets for naming conventions, file size budgets, format standards, and pipeline requirements. Identifies orphans, missing references, and violations.
- **Usage**:
  - Check naming convention compliance and file sizes
  - Identify orphan assets for project cleanup
  - Final asset health check before delivery
- **Example**: `/asset-audit all`

### asset-spec
- **Description**: Generate per-asset visual specs and AI generation prompts from GDDs, level docs, or character briefs.
- **Usage**:
  - Generate concrete production specs for visual assets
  - Prepare AI generation prompts for image tools
  - Build asset inventory and check reusable assets
- **Example**: `/asset-spec system:combat --review full`

### create-control-manifest
- **Description**: Generate a flat, executable rule checklist from all Accepted ADRs, technical preferences, and engine references.
- **Usage**:
  - Provide programmers with a directly consultable rule list after architecture review
  - Regenerate when new ADRs are accepted
  - Quickly check "must do" and "must not do" rules for your layer
- **Example**: `/create-control-manifest update`

### day-one-patch
- **Description**: Prepare a day-one patch for game launch. Scope, prioritize, implement, and test focused fixes on known issues after gold master.
- **Usage**:
  - Known bugs remain after gold master lock
  - Certification feedback requires minor post-submission fixes
  - Pre-launch playtesting exposes must-fix issues
- **Example**: `/day-one-patch known-bugs`

### git-workflow
- **Description**: Game dev Git workflow management: one-task-one-commit, trunk-based development, branching strategy, and merge conflict handling.
- **Usage**:
  - Auto-execute Implement→Test→Verify→Commit cycle in `/dev-story`
  - Manual Git status checks
  - Handle merge conflicts with structured resolution
- **Example**: `/git-workflow status`

### hotfix
- **Description**: Emergency fix workflow bypassing normal sprint process, with full audit trail. Requires tri-party approval.
- **Usage**:
  - S1 (critical) or S2 (major) production bugs requiring emergency fix
  - Requires lead-programmer, qa-tester, and producer approval
  - Post-deployment regression verification and 48-hour post-mortem
- **Example**: `/hotfix BUG-001`

### localize
- **Description**: Full localization pipeline: scan hardcoded strings, extract string tables, validate translations, cultural sensitivity review, RTL/platform testing, string freeze, and coverage reporting.
- **Usage**:
  - Scan source for hardcoded strings and localization anti-patterns
  - Extract strings and generate translation-ready string tables
  - Validate translation completeness and placeholder consistency
  - RTL layout adaptation for Arabic, Hebrew, etc.
- **Example**: `/localize scan`

### map-systems
- **Description**: Decompose game concept into independent systems, map dependencies, prioritize design order, and create system index.
- **Usage**:
  - Decompose game concept into multiple systems
  - Determine dependencies and design order between systems
  - Create or update the system index
- **Example**: `/map-systems next`

### planning
- **Description**: Engineering task breakdown: dependency graph → vertical slices → acceptance criteria → tasks/plan.md. "How to build", not "what to build".
- **Usage**:
  - Break Stories into implementable engineering tasks after sprint planning
  - Build dependency graphs and vertical slices
  - Assign size estimates and acceptance criteria to tasks
- **Example**: `/planning combat-system`

### qa-plan
- **Description**: Generate QA test plan for a sprint or feature. Categorizes Stories by test type with automation needs, manual cases, smoke test scope, and playtest sign-off.
- **Usage**:
  - Generate test plan before sprint starts
  - Categorize Stories by test type
  - Define smoke test scope and playtest sign-off requirements
- **Example**: `/qa-plan sprint`

### release-checklist
- **Description**: Generate release checklist by project phase, categorized by required artifact. Supports milestone tracking and evidence collection.
- **Usage**:
  - Generate comprehensive checklist before release
  - Platform-specific checks (PC/console/mobile)
  - Verify code health, build quality, content completeness
- **Example**: `/release-checklist pc`

### scope-check
- **Description**: Analyze feature or sprint for scope creep by comparing current scope against original plan. Flags additions, quantifies bloat, recommends cuts.
- **Usage**:
  - Detect scope creep in features or sprints
  - Quantify scope expansion
  - Re-validate scope control before milestones
- **Example**: `/scope-check sprint-3`

### tdd
- **Description**: Test-driven development workflow: write failing test first, implement minimal code to pass, then refactor. Strict Red-Green-Refactor cycle.
- **Usage**:
  - Build features test-first
  - Fix bugs with Prove-It Bug Fix workflow (reproduce before fixing)
  - Ensure every acceptance criterion has test coverage
- **Example**: `/tdd production/epics/core/story-damage-calculator.md`

### vertical-slice
- **Description**: Guided vertical slice workflow — end-to-end design to playable implementation. Validates core game loop with a feature subset across all system layers.
- **Usage**:
  - Validate core game loop in late Pre-Production
  - Re-validate after PIVOT decision
  - Collect real production velocity data for sprint planning
- **Example**: `/vertical-slice --review full`

---

## 3. Review

### architecture-review
- **Description**: Builds traceability matrix mapping every GDD technical requirement to ADRs, identifies coverage gaps, detects cross-ADR conflicts, verifies engine compatibility. Produces PASS/CONCERNS/FAIL verdict.
- **Usage**:
  - Verify all GDD requirements have ADR coverage before Pre-Production gate
  - Detect cross-ADR conflicts
  - Verify engine API version compatibility
  - Generate Requirements Traceability Matrix (RTM mode)
- **Example**: `/architecture-review full`

### code-review
- **Description**: Architectural and quality code review on specified files. Checks coding standards, architectural patterns, SOLID principles, module depth, seams, testability, and performance.
- **Usage**:
  - Review code after developer submission
  - Check ADR compliance
  - Evaluate module depth, seam quality, and testability
  - Specialist reviews for language/shader/UI code
- **Example**: `/code-review src/combat/attack.gd`

### design-review
- **Description**: Validate game design documents for completeness, internal consistency, implementability, and project design standards. Run before handing off to programmers.
- **Usage**:
  - Validate GDD completeness before handing to programmers
  - Check all 8 required sections are present
  - Run multi-expert adversarial review in full mode
- **Example**: `/design-review design/gdd/combat-system.md --depth full`

### milestone-review
- **Description**: Generate comprehensive milestone progress review with feature completion, quality metrics, risk assessment, and Go/No-Go recommendation.
- **Usage**:
  - Assess overall progress at milestone checkpoints
  - Generate feature completion and risk assessment reports
  - Go/No-Go decision support
- **Example**: `/milestone-review current`

### review-all-gdds
- **Description**: Comprehensive cross-GDD consistency and game design review. Checks for contradictions, stale references, ownership conflicts, formula incompatibility, and design theory violations.
- **Usage**:
  - Cross-document consistency review after all MVP GDDs are written
  - Discover dominant strategies and economic imbalances from design theory perspective
  - Ensure no GDD contradictions before architecture begins
- **Example**: `/review-all-gdds full`

### test-evidence-review
- **Description**: Quality review of test files and manual evidence documents. Evaluates assertion coverage, edge case handling, naming conventions, and evidence completeness. Produces ADEQUATE/INCOMPLETE/MISSING verdict.
- **Usage**:
  - Test quality assessment before QA sign-off
  - Quality audit for Logic/Integration Stories in milestone reviews
  - Evaluate assertion coverage and evidence completeness
- **Example**: `/test-evidence-review sprint`

### ux-review
- **Description**: Validate UX specs, HUD design, or interaction pattern library for completeness, accessibility compliance, GDD alignment, and implementation readiness. APPROVED/NEEDS REVISION/MAJOR REVISION NEEDED verdict.
- **Usage**:
  - Validate UX specs after `/ux-design`
  - Before handoff to ui-programmer or art-director
  - Before Pre-Production→Production gate check
- **Example**: `/ux-review all`

---

## 4. Analysis

### balance-check
- **Description**: Analyze game balance data files, formulas, and configs. Identify outliers, broken growth curves, degenerate strategies, and economic imbalances.
- **Usage**:
  - Check DPS and TTK after modifying weapon/skill values
  - Check for infinite resource cycles after adjusting economy
  - Check for dead zones and power jumps in progression curves
  - Verify rarity distribution in drop systems
- **Example**: `/balance-check combat`

### bug-report
- **Description**: Create structured bug reports from descriptions or analyze code to identify potential bugs. Full repro steps, severity, and context.
- **Usage**:
  - Structure verbal/written bug descriptions into formal reports
  - Systematically analyze code for potential bugs
  - Verify fix effectiveness (verify mode)
  - Formally close bugs (close mode)
- **Example**: `/bug-report analyze src/combat/damage.gd`

### consistency-check
- **Description**: Scan all GDDs and entity registry for cross-document inconsistencies — same entity with different properties, same item with different values, same formula with different variables.
- **Usage**:
  - Check value conflicts after writing new GDDs
  - Quick inconsistency scan before `/review-all-gdds`
  - Ensure cross-document data consistency before `/create-architecture`
- **Example**: `/consistency-check full`

### content-audit
- **Description**: Audit GDD-specified content quantity against what's actually implemented. Identify plan-to-actual gaps.
- **Usage**:
  - Know planned vs. implemented content per system
  - Flag MVP/Vertical Slice content shortfalls as high priority
  - Quick content gap summary generation
- **Example**: `/content-audit combat`

### diagnose
- **Description**: Disciplined diagnosis loop for hard bugs and performance regressions. Reproduce, hypothesize, instrument, fix, and regression-test.
- **Usage**:
  - Structured diagnosis instead of guesswork for stubborn bugs
  - Performance regressions with unclear causes
  - Generate multiple falsifiable hypotheses and test each
  - Regression-test and cleanup debug instrumentation after fix
- **Example**: `/diagnose BUG-042`

### estimate
- **Description**: Estimate task effort by analyzing complexity, dependencies, historical velocity, and risk factors. Structured estimates with confidence levels.
- **Usage**:
  - Estimate effort for features or bug fixes
  - Get optimistic/expected/pessimistic estimation ranges
  - Identify risk factors and dependency impacts
- **Example**: `/estimate "implement player skill tree system"`

### perf-profile
- **Description**: Profile game runtime performance. Collect frame timing, memory allocation, and CPU/GPU utilization data. Generate actionable findings and optimization recommendations.
- **Usage**:
  - Profile specific systems or the entire game
  - Identify CPU/memory/rendering/I/O hotspots
  - Generate optimization suggestions and quick wins
- **Example**: `/perf-profile combat`

### playtest-report
- **Description**: Generate structured playtest report templates or analyze raw playtest notes into structured format.
- **Usage**:
  - Generate blank playtest report template
  - Analyze raw playtest notes into structured reports
  - Categorize findings as design changes/balance/Bugs/polish
- **Example**: `/playtest-report analyze production/qa/raw-notes.md`

### regression-suite
- **Description**: Map test coverage to GDD critical paths, identify fixed bugs missing regression tests, flag coverage drift, maintain regression test suite.
- **Usage**:
  - Confirm regression tests exist after bug fixes
  - Validate regression suite completeness before release gates
  - Detect test coverage drift at end of sprints
- **Example**: `/regression-suite audit`

### retrospective
- **Description**: Generate sprint or milestone retrospectives by analyzing completed work, velocity, blockers, and patterns. Actionable insights for next iteration.
- **Usage**:
  - Generate retrospective analysis at end of sprint
  - Evaluate completion rate, velocity trends, and estimate accuracy
  - Extract actionable improvement suggestions
- **Example**: `/retrospective sprint-5`

### security-audit
- **Description**: Audit game for security vulnerabilities: save tampering, cheat vectors, network exploits, data exposure, and input validation gaps. Prioritized report with fix guidance.
- **Usage**:
  - Before any public release
  - Before enabling online/multiplayer features
  - After implementing systems that read from disk or network
- **Example**: `/security-audit full`

### tech-debt
- **Description**: Track, categorize, and prioritize technical debt in the codebase. Scan debt indicators, maintain debt register, recommend repayment plans.
- **Usage**:
  - Scan for TODO/FIXME/HACK debt indicators
  - Manually add new tech debt entries
  - Prioritize debt by (impact×frequency)/fix-cost
- **Example**: `/tech-debt scan`

### test-flakiness
- **Description**: Detect non-deterministic (flaky) tests by reading CI run logs or test result history. Maintain flaky test registry.
- **Usage**:
  - Detect flaky tests in Polish phase
  - Scan CI logs for intermittent failures
  - Maintain isolated test section of regression suite
- **Example**: `/test-flakiness scan`

---

## 5. Sprint

### bug-triage
- **Description**: Read all unclosed bugs, reassess priority/severity, allocate to sprints, discover systemic trends, generate triage report.
- **Usage**:
  - Allocate unclosed bugs to current sprint or backlog at sprint start
  - Re-prioritize when bug count exceeds 10
  - Identify systemic quality issue trends
- **Example**: `/bug-triage sprint`

### create-epics
- **Description**: Convert approved GDDs + architecture into Epics — one Epic per architecture module. Define scope, governing ADRs, engine risks, and untracked requirements.
- **Usage**:
  - Create Epics by layer after architecture is ready
  - Verify each system's GDD requirements have ADR coverage
  - Process in dependency-safe order: Foundation→Core→Feature→Presentation
- **Example**: `/create-epics layer:foundation --review full`

### create-stories
- **Description**: Break a single epic into implementable story files. Each story embeds its GDD requirement TR-ID, ADR guidance, acceptance criteria, story type, and test evidence path.
- **Usage**:
  - Break Epics into developer-ready Stories (~2-4 hours each)
  - QA Lead reviews acceptance criteria testability
  - Order Stories by dependency (foundational first, edge cases next, UI last)
- **Example**: `/create-stories combat --review full`

### dev-story
- **Description**: Read a story file and implement it. Loads full context, routes to correct programmer agents, implements code and tests, confirms each acceptance criterion. Core implementation skill.
- **Usage**:
  - Convert ready Stories into actual code
  - Logic/Integration Stories require simultaneous test writing
  - Config/Data Stories edit data files directly
- **Example**: `/dev-story production/epics/core/combat-system/STORY-001.md`

### sprint-plan
- **Description**: Generate new or update existing sprint plans based on current milestone, completed work, and available capacity.
- **Usage**:
  - Generate plan when starting new sprint
  - Update existing sprint plan (add/remove/reprioritize stories)
  - Generate sprint status reports
- **Example**: `/sprint-plan new --review lean`

### sprint-status
- **Description**: Quick sprint status check. Reads current sprint plan, scans story file statuses, generates concise progress snapshot with burndown assessment and emerging risks.
- **Usage**:
  - Quick progress check anytime during sprint
  - Detect at-risk Must Have stories
  - Identify STALE stories (>4 days without progress)
- **Example**: `/sprint-status`

---

## 6. Utility

### changelog
- **Description**: Auto-generate changelog from git commits, sprint data, and design documents. Produces both internal and player-facing versions.
- **Usage**:
  - Auto-generate changelog when releasing new versions
  - Summarize changes at end of sprints
  - Check commits for missing task references
- **Example**: `/changelog v1.2.0`

### deprecation
- **Description**: Manage deprecation and migration of game systems, APIs, and features. Five-phase lifecycle: announce→warn→migrate→block→remove.
- **Usage**:
  - Replace old gameplay systems with new implementations
  - Consolidate duplicate utility functions or subsystems
  - Clean up engine-version-specific workarounds no longer needed
  - After `/simplify` identifies large dead-code blocks needing formal removal
- **Example**: `/deprecation old-combat-system`

### doubt-driven
- **Description**: Subjects non-trivial decisions to fresh-context adversarial review before they stand. CLAIM→EXTRACT→DOUBT→RECONCILE→STOP loop.
- **Usage**:
  - Make architectural decisions under uncertainty
  - Write or revise ADRs
  - Design system-to-system couplings
  - Verify assumptions before `/code-review`
- **Example**: `/doubt-driven "use ECS architecture for combat system"`

### graphify-reader
- **Description**: Control the graphify knowledge graph tool — build project knowledge graphs, query code structure, analyze module relationships.
- **Usage**:
  - Build project knowledge graph
  - Query concepts or dependencies in the codebase
  - Trace shortest dependency paths between components
  - Export interactive architecture diagrams
- **Example**: `/graphify-reader build .`

### grill-me
- **Description**: Run a stress test for a plan, design, or decision before commitment. Interactive Q&A with severity-ranked vulnerabilities.
- **Usage**:
  - Stress-test irreversible or high-risk decisions
  - Validate assumptions lacking evidence
  - Risk assessment after major pivots
- **Example**: `/grill-me "our ECS architecture migration plan"`

### handoff
- **Description**: Compact current conversation into a handoff document so another agent (or future session) can pick up work without re-reading the full history.
- **Usage**:
  - Transfer work state at end of session
  - Record completed work files and unfinished tasks
  - Recommend skills for next session
- **Example**: `/handoff "continue implementing remaining combat system stories"`

### help
- **Description**: Analyze completed work and user queries to recommend next steps.
- **Usage**:
  - Unsure which development phase you're in
  - Uncertain what to do after completing a step
  - Stuck or confused in the development workflow
- **Example**: `/help "just finished design-review"`

### onboard
- **Description**: Generate onboarding context documents from existing project docs (GDDs, architecture, ADRs, Stories). Summarizes key decisions and current state.
- **Usage**:
  - New team member needs quick project overview
  - Generate role-specific onboarding docs
  - Summarize key project decisions and current state
- **Example**: `/onboard programmer`

### patch-notes
- **Description**: Generate player-facing patch notes from git history, sprint data, and internal changelog. Translate developer-speak into clear, engaging player communication.
- **Usage**:
  - Generate player-readable patch notes for releases
  - Translate technical changes into player-friendly language
  - Categorize changes (new content/gameplay/fixes/performance)
- **Example**: `/patch-notes 1.2.0 --style detailed`

### project-stage-detect
- **Description**: Auto-analyze project state, detect current phase, identify gaps, and recommend next steps based on existing artifacts.
- **Usage**:
  - Understand development phase when taking over a project
  - Check missing artifacts before milestones
  - Filter gaps and recommendations by role
- **Example**: `/project-stage-detect designer`

### propagate-design-change
- **Description**: When GDDs are revised, scan all ADRs and traceability indexes to identify which architecture decisions may have become stale. Generate change impact report.
- **Usage**:
  - Find affected ADRs after GDD revision
  - Assess if architecture decisions are still valid
  - Update ADR status and traceability indexes
- **Example**: `/propagate-design-change design/gdd/combat-system.md`

### reverse-document
- **Description**: Generate design or architecture documents from existing implementation. Work backwards from code/prototype to create missing planning docs.
- **Usage**:
  - Code exists but design docs are missing
  - Onboard undocumented codebase
  - Formalize prototype into design document
- **Example**: `/reverse-document design src/gameplay/combat`

### setup-engine
- **Description**: Interactive workflow to select and configure game engine for the project. Set version, install template files, initialize engine-specific directories and docs.
- **Usage**:
  - Select and configure game engine during project init
  - Refresh engine reference docs
  - Upgrade engine to new version with migration audit
- **Example**: `/setup-engine godot 4.6`

### simplify
- **Description**: Code simplification workflow: identify opportunities, incremental changes with test verification, respect simplify-ignore markers.
- **Usage**:
  - Clean up code after feature completion
  - Follow-up improvements after code review
  - Periodic maintenance on frequently-touched files
- **Example**: `/simplify src/gameplay/player_controller.gd`

### start
- **Description**: First-contact onboarding — asks where you are, then guides you to the right workflow. Makes no assumptions.
- **Usage**:
  - First-time project entry guided workflow
  - Detect current project state
  - Set review mode
- **Example**: `/start`

### test-helpers
- **Description**: Generate engine-specific test helper libraries for the project's test suite. Assertion utilities, factories, and mock objects to reduce boilerplate in new test files.
- **Usage**:
  - Generate test helpers after `/test-setup` scaffolding
  - When multiple test files show repeated setup boilerplate
  - Before writing tests for a new system
- **Example**: `/test-helpers combat`

### test-runner
- **Description**: Cross-language test runner. Supports pytest, jest, mocha, dotnet test, go test, cargo test, cmake test, and more.
- **Usage**:
  - Auto-detect project test framework and run tests
  - Interpret test output
  - Filter and run specific tests by name
  - Generate coverage reports
- **Example**: `/test-runner --coverage`

### test-setup
- **Description**: Set up test framework and CI/CD pipeline for the project engine. Create tests/ directory, engine-specific test runner config, and GitHub Actions workflow.
- **Usage**:
  - During Technical Setup, before first sprint
  - Scaffold automated test infrastructure
  - Create CI/CD workflow
- **Example**: `/test-setup`

### to-prd
- **Description**: Convert current conversation context into a PRD. Synthesize what's been discussed into a structured document with user stories, implementation decisions, and out-of-scope boundaries.
- **Usage**:
  - Write formal docs after sufficiently exploring a feature in conversation
  - Synthesize existing discussion into structured PRD
  - Save PRD and optionally convert to Stories
- **Example**: `/to-prd inventory-system`

### zoom-out
- **Description**: Step back and look at the current work from a higher perspective. Review scope, gaps, risks, stale assumptions, and alignment with original vision.
- **Usage**:
  - Need high-level architecture view when lost in details
  - Understand a module's role in the system
  - Identify callers, callees, and architectural layer assignment
- **Example**: `/zoom-out src/gameplay/player_controller.gd`

---

## 7. Readiness

### launch-checklist
- **Description**: Generate launch checklist categorized by required artifact. Supports milestone tracking and evidence collection.
- **Usage**:
  - Pre-launch code readiness and content completeness check
  - Scan for TODO/FIXME/HACK comments and debug output
  - Verify store pages, legal compliance, and community marketing
  - Dry-run mode (generate checklist only, no file writes)
- **Example**: `/launch-checklist 2025-06-01`

### smoke-check
- **Description**: Run critical path smoke tests before QA delivery. Execute automated test suite, verify core functionality, generate PASS/FAIL report.
- **Usage**:
  - After sprint Stories implemented, before QA delivery
  - Quick re-check after fixing specific failures
  - Platform-specific checks
- **Example**: `/smoke-check sprint`

### soak-test
- **Description**: Generate stress test protocol for extended game sessions. Discover slow leaks, fatigue effects, and edge cases only visible after sustained play.
- **Usage**:
  - Polish phase, before `/gate-check release`
  - Regression soak after fixing memory/stability issues
  - Verify no memory leaks or performance degradation over time
- **Example**: `/soak-test 2h all`

### story-done
- **Description**: Story completion wrap-up review. Verify each acceptance criterion against implementation, check GDD/ADR deviations, update story status to Complete.
- **Usage**:
  - Wrap up any Story implementation
  - Verify each acceptance criterion
  - Check and document GDD/ADR deviations
  - Mark Story Complete and recommend next ready Story
- **Example**: `/story-done production/epics/core/story-damage-calculator.md`

### story-readiness
- **Description**: Validate story file readiness for implementation. Check embedded GDD requirements, ADR references, clear acceptance criteria, and no open design questions. Produces READY/NEEDS WORK/BLOCKED verdict.
- **Usage**:
  - Verify implementation readiness before assigning Stories
  - Batch verify all Stories before sprint start
  - Detect missing references or vague acceptance criteria
- **Example**: `/story-readiness sprint`

---

## 8. Gate

### gate-check
- **Description**: Validate readiness to advance between development phases. Produces PASS/CONCERNS/FAIL verdict with specific blockers and required artifacts.
- **Usage**:
  - Formal verification before advancing to next phase
  - Check required artifacts exist and are content-complete
  - Parallel director evaluation
  - Auto-detect current phase and confirm gate to run
- **Example**: `/gate-check production --review full`

---

## Appendix: Workflow Phase Index

### Concept Phase
`/brainstorm` → `/design-with-kb` → `/spec-driven` → `/art-bible`

### Systems Design
`/map-systems` → `/design-system` → `/consistency-check` → `/design-review` → `/review-all-gdds` → `/propagate-design-change`

### Technical Setup
`/setup-engine` → `/create-architecture` → `/architecture-decision` → `/architecture-review` → `/create-control-manifest` → `/doubt-driven`

### Pre-Production
`/prototype` → `/vertical-slice` → `/gate-check pre-production`

### Production
`/create-epics` → `/create-stories` → `/story-readiness` → `/dev-story` → `/code-review` → `/story-done` → `/simplify` → `/deprecation`

### Sprint Management
`/sprint-plan` → `/sprint-status` → `/scope-check` → `/estimate` → `/bug-triage`

### QA & Testing
`/test-setup` → `/test-helpers` → `/test-runner` → `/test-flakiness` → `/test-evidence-review` → `/regression-suite`

### Release
`/launch-checklist` → `/release-checklist` → `/security-audit` → `/smoke-check` → `/soak-test` → `/gate-check release` → `/day-one-patch`

### Operations
`/bug-report` → `/diagnose` → `/hotfix` → `/retrospective` → `/changelog` → `/patch-notes` → `/onboard` → `/reverse-document`
