/**
 * Check Stubs Command — Phase 9.3
 *
 * codesquad check --stubs
 *
 * Validates consistency between .codesquad MCP stubs (.aicore-mcp-stubs/)
 * and .codesquad/ implementations. Ensures every stub has a matching
 * implementation and vice versa.
 */
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadAgentStubs, loadSkillStubs } from '../mcp/stub-loader.js';
export async function handleCheckStubs(mode = 'stubs', projectRoot) {
    const root = projectRoot ?? process.cwd();
    const result = runStubCheck(root, mode);
    console.log(`\n🔍 Stub Consistency Check (${mode})`);
    console.log(`   Agents: ${result.agentCount} stubs`);
    console.log(`   Skills: ${result.skillCount} stubs`);
    console.log('');
    if (result.issues.length === 0) {
        console.log('✅ All stubs consistent with .codesquad/ implementations.\n');
        return;
    }
    const errors = result.issues.filter(i => i.type === 'error');
    const warnings = result.issues.filter(i => i.type === 'warning');
    const infos = result.issues.filter(i => i.type === 'info');
    if (errors.length > 0) {
        console.log(`❌ ${errors.length} error(s):`);
        for (const e of errors) {
            console.log(`   ✗ ${e.file}: ${e.message}`);
        }
        console.log('');
    }
    if (warnings.length > 0) {
        console.log(`⚠ ${warnings.length} warning(s):`);
        for (const w of warnings) {
            console.log(`   ⚠ ${w.file}: ${w.message}`);
        }
        console.log('');
    }
    if (infos.length > 0 && mode !== 'stubs-strict') {
        console.log(`ℹ ${infos.length} info(s):`);
        for (const i of infos) {
            console.log(`   ℹ ${i.file}: ${i.message}`);
        }
        console.log('');
    }
    const statusIcon = result.ok ? '✅' : '❌';
    console.log(`${statusIcon} Overall: ${errors.length} error(s), ${warnings.length} warning(s)\n`);
    if (!result.ok)
        process.exit(1);
}
// ── Run stub check ──
export function runStubCheck(projectRoot, mode) {
    const issues = [];
    const agents = loadAgentStubs();
    const skills = loadSkillStubs();
    // ── Agent checks ──
    const codebuddyAgentsDir = join(projectRoot, '.codesquad', 'agents');
    for (const stub of agents) {
        const implPath = join(codebuddyAgentsDir, `${stub.name}.md`);
        if (!existsSync(implPath)) {
            issues.push({
                type: mode === 'stubs-strict' ? 'error' : 'warning',
                file: `stub:${stub.name}`,
                message: `.codesquad/agents/${stub.name}.md not found — run 'codesquad init --tools codebuddy'`,
            });
            continue;
        }
        try {
            const raw = readFileSync(implPath, 'utf-8');
            const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (fmMatch) {
                const nameMatch = fmMatch[1]?.match(/^name:\s*(.+)$/m);
                if (nameMatch && nameMatch[1]?.trim() !== stub.name) {
                    issues.push({
                        type: 'error',
                        file: `stub:${stub.name}`,
                        message: `Name mismatch: stub=${stub.name}, implementation=${nameMatch[1]?.trim()}`,
                    });
                }
            }
        }
        catch {
            issues.push({
                type: 'error',
                file: `stub:${stub.name}`,
                message: `Failed to read .codesquad/agents/${stub.name}.md`,
            });
        }
    }
    // ── Skill checks ──
    const codebuddySkillsDir = join(projectRoot, '.codesquad', 'skills');
    for (const stub of skills) {
        if (stub.userInvocable === false)
            continue; // Skip agent-coupled engine skills
        const implPath = join(codebuddySkillsDir, stub.name, 'SKILL.md');
        if (!existsSync(implPath)) {
            issues.push({
                type: mode === 'stubs-strict' ? 'error' : 'warning',
                file: `stub:${stub.name}`,
                message: `.codesquad/skills/${stub.name}/SKILL.md not found — run 'codesquad init --tools codebuddy'`,
            });
            continue;
        }
        try {
            const raw = readFileSync(implPath, 'utf-8');
            const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            if (fmMatch) {
                const nameMatch = fmMatch[1]?.match(/^name:\s*(.+)$/m);
                if (nameMatch && nameMatch[1]?.trim() !== stub.name) {
                    issues.push({
                        type: 'error',
                        file: `stub:${stub.name}`,
                        message: `Name mismatch: stub=${stub.name}, implementation=${nameMatch[1]?.trim()}`,
                    });
                }
            }
        }
        catch {
            issues.push({
                type: 'error',
                file: `stub:${stub.name}`,
                message: `Failed to read .codesquad/skills/${stub.name}/SKILL.md`,
            });
        }
    }
    // ── Reverse check: orphaned .codesquad/ files without stubs ──
    if (existsSync(codebuddyAgentsDir)) {
        const stubNames = new Set(agents.map(a => a.name));
        const implFiles = readdirSync(codebuddyAgentsDir).filter((f) => f.endsWith('.md'));
        for (const file of implFiles) {
            const name = file.replace('.md', '');
            if (!stubNames.has(name)) {
                issues.push({
                    type: 'info',
                    file: `.codesquad/agents/${file}`,
                    message: `No MCP stub found for agent '${name}'`,
                });
            }
        }
    }
    const ok = !issues.some(i => i.type === 'error');
    return {
        ok,
        agentCount: agents.length,
        skillCount: skills.length,
        issues,
    };
}
//# sourceMappingURL=check-stubs.js.map