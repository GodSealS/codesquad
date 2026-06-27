
## First Steps for a New Project

**Don't know where to begin?** Run `/start`. It asks where you are and routes
you to the right workflow. No assumptions about your game, engine, or experience level.

If you already know what you need, jump directly to the relevant path:

### Path A: "I have no idea what to build"

> 1. **Run `/start`** (or `/brainstorm open`) — guided creative exploration:
>    what excites you, what you've played, your constraints
>    - Generates 3 concepts, helps you pick one, defines core loop and pillars
>    - Produces a game concept document and recommends an engine
> 2. **Set up the engine** — Run `/setup-engine` (uses the brainstorm recommendation)
>    - Configures CODEBUDDY.md, detects knowledge gaps, populates reference docs
>    - Creates `.codebuddy/docs/technical-preferences.md` with naming conventions,
>      performance budgets, and engine-specific defaults
>    - If the engine version is newer than the LLM's training data, it fetches
>      current docs from the web so agents suggest correct APIs
> 3. **Validate the concept** — Run `/design-review design/gdd/game-concept.md`
> 4. **Decompose into systems** — Run `/map-systems` to map all systems and dependencies
> 5. **Design each system** — Run `/design-system [system-name]` (or `/map-systems next`)
>    to write GDDs in dependency order
> 6. **Test the core loop** — Run `/prototype [core-mechanic]`
> 7. **Playtest validation** — Run `/playtest-report` to validate assumptions
> 8. **Plan the first sprint** — Run `/sprint-plan new`
> 9. Start building

### Path B: "I know what I want to build"

If you already have a game concept and engine choice:

> 1. **Set up the engine** — Run `/setup-engine [engine] [version]`
>    (e.g., `/setup-engine godot 4.6`) — also creates technical preferences
> 2. **Write the Game Pillars** — delegate to `creative-director`
> 3. **Decompose into systems** — Run `/map-systems` to enumerate systems and dependencies
> 4. **Design each system** — Run `/design-system [system-name]` for GDDs in dependency order
> 5. **Create the initial ADR** — Run `/architecture-decision`
> 6. **Create the first milestone** in `production/milestones/`
> 7. **Plan the first sprint** — Run `/sprint-plan new`
> 8. Start building

### Path C: "I know the game but not the engine"

If you have a concept but don't know which engine fits:

> 1. **Run `/setup-engine`** with no arguments — it will ask about your game's
>    needs (2D/3D, platforms, team size, language preferences) and recommend
>    an engine based on your answers
> 2. Follow Path B from step 2 onward

### Path D: "I have an existing project"

If you have design docs, prototypes, or code already:

> 1. **Run `/start`** (or `/project-stage-detect`) — analyzes what exists,
>    identifies gaps, and recommends next steps
> 2. **Run `/adopt`** if you have existing GDDs, ADRs, or stories — audits
>    internal format compliance and builds a numbered migration plan to fill gaps
>    without overwriting your existing work
> 3. **Configure engine if needed** — Run `/setup-engine` if not yet configured
> 4. **Validate phase readiness** — Run `/gate-check` to see where you stand
> 5. **Plan the next sprint** — Run `/sprint-plan new`
