/**
 * create command — Agent/Skill scaffolding
 *
 * Phase 8.1: Creates new agent/skill definitions and test specs from built-in templates.
 * Fully local operation — no remote API needed.
 */
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { CODESQUAD_USER_ROOT, CCGS_AGENTS_SPEC_DIR, CCGS_SKILLS_SPEC_DIR, CCGS_TEMPLATES_DIR } from '../core/paths.js';
/** User-level agents directory (~/.codesquad/agents/) */
const USER_AGENTS_DIR = join(CODESQUAD_USER_ROOT, 'agents');
/** User-level skills directory (~/.codesquad/skills/) */
const USER_SKILLS_DIR = join(CODESQUAD_USER_ROOT, 'skills');
// ── Built-in templates ─────────────────────────────────
const AGENT_TEMPLATE = `---
name: AGENT_NAME
description: "TODO: Describe the agent's role and when to use it."
tools: Read, Glob, Grep
model: Deepseek-V4-Pro
maxTurns: 15
agentMode: agentic
enabled: true
enabledAutoRun: true
---

# TODO: Agent System Prompt

You are the AGENT_NAME. Describe your role, responsibilities, and decision-making authority here.

## Domain

What domain do you own? What decisions can you make independently?

## Coordination

How do you interact with other agents? When do you escalate?

## Output

What format should your output take? What artifacts do you produce?
`;
const SKILL_TEMPLATE = `---
name: SKILL_NAME
description: "TODO: Describe what this skill does and when to invoke it."
argument-hint: "[input]"
user-invocable: true
allowed-tools: Read, Glob, Grep
model: Deepseek-V4-Pro
---

# TODO: Skill Instructions

Describe the workflow this skill should follow.

## Phase 1: Parse Input

Parse the user's arguments and validate them.

## Phase 2: Execute

Perform the core logic of this skill.

Verdict: PASS

## Phase 3: Next Steps

Follow-Up: Describe what the user should do after this skill completes.
`;
// ── Validation ─────────────────────────────────────────
function validateName(name) {
    if (!name || name.trim().length === 0) {
        return 'Name cannot be empty';
    }
    if (!/^[a-z0-9][-a-z0-9_]*$/.test(name)) {
        return 'Name must be lowercase, start with a letter/number, and contain only letters, numbers, hyphens, and underscores';
    }
    return null;
}
// ── Create Agent ────────────────────────────────────────
function createAgent(name) {
    const error = validateName(name);
    if (error) {
        console.log(chalk.red(`\n  ✗ Invalid name: ${error}\n`));
        return false;
    }
    const agentsDir = USER_AGENTS_DIR;
    mkdirSync(agentsDir, { recursive: true });
    const filePath = join(agentsDir, `${name}.md`);
    if (existsSync(filePath)) {
        console.log(chalk.yellow(`\n  ⚠ Agent '${name}' already exists at ~/.codesquad/agents/${name}.md`));
        console.log(chalk.dim('    Use a different name or delete the existing file.\n'));
        return false;
    }
    const content = AGENT_TEMPLATE.replace(/AGENT_NAME/g, name);
    writeFileSync(filePath, content, 'utf-8');
    console.log(chalk.green(`\n  ✔ Created agent: ~/.codesquad/agents/${name}.md`));
    console.log(chalk.dim('    Edit the file to fill in TODO sections.\n'));
    return true;
}
// ── Create Skill ────────────────────────────────────────
function createSkill(name) {
    const error = validateName(name);
    if (error) {
        console.log(chalk.red(`\n  ✗ Invalid name: ${error}\n`));
        return false;
    }
    const skillsDir = join(USER_SKILLS_DIR, name);
    if (existsSync(skillsDir)) {
        console.log(chalk.yellow(`\n  ⚠ Skill '${name}' already exists at ~/.codesquad/skills/${name}/`));
        console.log(chalk.dim('    Use a different name or delete the existing directory.\n'));
        return false;
    }
    mkdirSync(skillsDir, { recursive: true });
    const content = SKILL_TEMPLATE.replace(/SKILL_NAME/g, name);
    const filePath = join(skillsDir, 'SKILL.md');
    writeFileSync(filePath, content, 'utf-8');
    console.log(chalk.green(`\n  ✔ Created skill: ~/.codesquad/skills/${name}/SKILL.md`));
    console.log(chalk.dim('    Edit the file to fill in TODO sections.\n'));
    return true;
}
// ── Create Spec ─────────────────────────────────────────
function createAgentSpec(name) {
    const error = validateName(name);
    if (error) {
        console.log(chalk.red(`\n  ✗ Invalid name: ${error}\n`));
        return false;
    }
    const specDir = CCGS_AGENTS_SPEC_DIR;
    mkdirSync(specDir, { recursive: true });
    const filePath = join(specDir, `${name}.md`);
    if (existsSync(filePath)) {
        console.log(chalk.yellow(`\n  ⚠ Agent spec '${name}' already exists at CCGS Skill Testing Framework/agents/${name}.md`));
        console.log(chalk.dim('    Use a different name or delete the existing file.\n'));
        return false;
    }
    // Use external template if available, otherwise built-in
    const content = readTemplate('agent-test-spec.md', AGENT_SPEC_TEMPLATE).replace(/\[agent-name\]/g, name);
    writeFileSync(filePath, content, 'utf-8');
    console.log(chalk.green(`\n  ✔ Created agent spec: CCGS Skill Testing Framework/agents/${name}.md`));
    console.log(chalk.dim('    Edit the file to customize test cases.\n'));
    return true;
}
function createSkillSpec(name) {
    const error = validateName(name);
    if (error) {
        console.log(chalk.red(`\n  ✗ Invalid name: ${error}\n`));
        return false;
    }
    const specDir = CCGS_SKILLS_SPEC_DIR;
    mkdirSync(specDir, { recursive: true });
    const filePath = join(specDir, `${name}.md`);
    if (existsSync(filePath)) {
        console.log(chalk.yellow(`\n  ⚠ Skill spec '${name}' already exists at CCGS Skill Testing Framework/skills/${name}.md`));
        console.log(chalk.dim('    Use a different name or delete the existing file.\n'));
        return false;
    }
    // Use external template if available, otherwise built-in
    const content = readTemplate('skill-test-spec.md', SKILL_SPEC_TEMPLATE).replace(/\[skill-name\]/g, name);
    writeFileSync(filePath, content, 'utf-8');
    console.log(chalk.green(`\n  ✔ Created skill spec: CCGS Skill Testing Framework/skills/${name}.md`));
    console.log(chalk.dim('    Edit the file to customize test cases.\n'));
    return true;
}
// ── Template loading ────────────────────────────────────
function readTemplate(templateFile, fallback) {
    const templatePath = join(CCGS_TEMPLATES_DIR, templateFile);
    if (existsSync(templatePath)) {
        try {
            return readFileSync(templatePath, 'utf-8');
        }
        catch { /* fall through to built-in */ }
    }
    return fallback;
}
// ── Built-in spec templates (fallbacks) ─────────────────
const AGENT_SPEC_TEMPLATE = `# Agent Spec: [agent-name]

> **Tier**: specialist
> **Category**: specialist
> **Spec written**: ${new Date().toISOString().split('T')[0]}

## Agent Summary

TODO: Describe this agent's domain, what decisions it owns, and what it delegates.

**Domain**: TODO
**Escalates to**: TODO
**Delegates to**: TODO

---

## Static Assertions

- [ ] Agent file exists
- [ ] Frontmatter has required fields
- [ ] Domain clearly stated
- [ ] Escalation path documented

---

## Test Cases

### Case 1: In-Domain Request

**Scenario**: TODO

**Expected behavior**:
1. TODO

**Assertions**:
- [ ] TODO

**Case Verdict**: PENDING

---

## Protocol Compliance

- [ ] Stays within declared domain
- [ ] Escalates conflicts correctly
- [ ] Uses collaborative protocol
`;
const SKILL_SPEC_TEMPLATE = `# Skill Spec: [skill-name]

> **Category**: utility
> **Priority**: medium
> **Spec written**: ${new Date().toISOString().split('T')[0]}

## Skill Summary

TODO: Describe what this skill does, inputs, outputs.

---

## Static Assertions

- [ ] Frontmatter has all required fields
- [ ] 2+ phase headings found
- [ ] Verdict keyword present
- [ ] Collaborative protocol (if Write/Edit tools)
- [ ] Next-step handoff section

---

## Test Cases

### Case 1: Happy Path

**Fixture**:
- TODO

**Expected behavior**:
1. TODO

**Case Verdict**: PENDING

---

### Case 2: Failure / Blocked

**Fixture**:
- TODO

**Expected behavior**:
1. TODO

**Case Verdict**: PENDING

---

## Protocol Compliance

- [ ] Uses "May I write" before writes
- [ ] Presents findings before requesting approval
- [ ] Ends with recommended next step
`;
// ── Main handler ────────────────────────────────────────
export async function handleCreate(type, name) {
    if (!name) {
        console.log(chalk.yellow(`\n  Usage: codesquad create ${type} <name>\n`));
        return;
    }
    switch (type) {
        case 'agent':
            createAgent(name);
            break;
        case 'skill':
            createSkill(name);
            break;
    }
}
/**
 * Handler for `codesquad create spec <subtype> <name>`
 */
export async function handleCreateSpec(subType, name) {
    if (!name) {
        console.log(chalk.yellow(`\n  Usage: codesquad create spec ${subType} <name>\n`));
        return;
    }
    switch (subType) {
        case 'agent':
            createAgentSpec(name);
            break;
        case 'skill':
            createSkillSpec(name);
            break;
    }
}
//# sourceMappingURL=create.js.map