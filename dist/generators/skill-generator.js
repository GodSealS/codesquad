// Skill Generator
//
// Reads canonical skill definitions from skills/{name}/SKILL.md and generates
// tool-specific files via adapters.
// Also copies companion files (subdirectories, workflow docs, reference files)
// from the canonical .codesquad source directory to the generated output directory.
//
// Supports two modes:
//   Dev mode: reads .md files from .codesquad/skills/ on disk
//   Embedded mode (Bun compile): reads from in-memory string constants
import { readdirSync, mkdirSync, writeFileSync, statSync, copyFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { readSkillMd, parseSkillMd } from '../schemas/skill.schema.js';
import { resolveModel } from './model-resolver.js';
import { isEmbeddedMode, readAicoreFile, readAicoreDir } from '../core/paths.js';
/** Scan skills/ directory and parse all skill definitions */
export async function loadSkills(cliSkillsDir) {
    // ── Embedded mode: read from in-memory constants ──
    if (isEmbeddedMode()) {
        const skills = [];
        const entries = readAicoreDir('skills');
        for (const entry of entries) {
            const content = readAicoreFile(`skills/${entry}/SKILL.md`);
            if (!content)
                continue;
            try {
                const skill = parseSkillMd(content, entry);
                skills.push(skill);
            }
            catch (err) {
                console.error(`Warning: failed to parse skill ${entry}:`, err.message);
            }
        }
        return skills;
    }
    // ── Dev mode: read from disk ──
    const skills = [];
    try {
        const entries = readdirSync(cliSkillsDir);
        for (const entry of entries) {
            const skillDir = join(cliSkillsDir, entry);
            if (!statSync(skillDir).isDirectory())
                continue;
            const skillFile = join(skillDir, 'SKILL.md');
            try {
                const skill = readSkillMd(skillFile);
                skills.push(skill);
            }
            catch (err) {
                console.error(`Warning: failed to parse skill ${skillFile}:`, err.message);
            }
        }
    }
    catch {
        // skills directory might not exist yet
    }
    return skills;
}
/**
 * Generate skill files for a single tool adapter.
 *
 * @param adapter       Tool adapter that formats skills and provides output paths
 * @param skills        Parsed SkillDef array from .codesquad
 * @param outputDir     Target project root (e.g. /path/to/my-project)
 * @param modelsConfig  Optional model resolution config
 * @param sourceSkillsDir  Optional absolute path to .codesquad/skills/ — when provided,
 *                         companion files (subdirectories, workflow docs, reference
 *                         files) are copied alongside each generated SKILL.md.
 */
export function generateSkills(adapter, skills, outputDir, modelsConfig, sourceSkillsDir) {
    const errors = [];
    let count = 0;
    for (const skill of skills) {
        try {
            const effectiveModel = resolveModel(skill.model ?? 'unknown', skill.name, 'skill', modelsConfig);
            const targetPath = join(outputDir, adapter.getSkillPath(skill.name));
            const targetSkillDir = dirname(targetPath);
            const content = adapter.formatSkill(skill, effectiveModel);
            mkdirSync(targetSkillDir, { recursive: true });
            writeFileSync(targetPath, content, 'utf-8');
            count++;
            // Copy companion files from canonical source (e.g. references/, workflow-*.md)
            if (sourceSkillsDir) {
                const srcSkillDir = join(sourceSkillsDir, skill.name);
                if (existsSync(srcSkillDir)) {
                    const companionCount = copyCompanionFiles(srcSkillDir, targetSkillDir);
                    count += companionCount;
                }
            }
        }
        catch (err) {
            errors.push(`Skill ${skill.name}: ${err.message}`);
        }
    }
    return { count, errors };
}
/**
 * Recursively copy all companion files from a canonical skill source directory
 * to the generated output directory, **skipping** SKILL.md (already generated).
 * Preserves subdirectory structure (e.g. references/api-reference.md).
 *
 * Supports both disk-based and embedded mode (Bun compile).
 *
 * @returns Number of files copied
 */
function copyCompanionFiles(srcDir, destDir) {
    // ── Embedded mode: read from in-memory constants, write to disk ──
    if (isEmbeddedMode()) {
        // Extract skill name from srcDir (e.g. ".../skills/adopt" → "adopt")
        const skillName = basename(srcDir);
        const entries = readAicoreDir(`skills/${skillName}`);
        let count = 0;
        for (const entry of entries) {
            if (entry === 'SKILL.md')
                continue;
            const srcPath = `skills/${skillName}/${entry}`;
            const content = readAicoreFile(srcPath);
            if (content === null)
                continue;
            const destPath = join(destDir, entry);
            // Check if entry is a directory (has sub-entries in dir index)
            const subEntries = readAicoreDir(`skills/${skillName}/${entry}`);
            if (subEntries.length > 0) {
                // It's a directory — recurse
                mkdirSync(destPath, { recursive: true });
                count += copyCompanionFilesEmbedded(`skills/${skillName}/${entry}`, destPath);
            }
            else {
                // It's a file
                mkdirSync(dirname(destPath), { recursive: true });
                writeFileSync(destPath, content, 'utf-8');
                count++;
            }
        }
        return count;
    }
    // ── Dev mode: disk to disk copy ──
    let count = 0;
    const entries = readdirSync(srcDir);
    for (const entry of entries) {
        const srcPath = join(srcDir, entry);
        const destPath = join(destDir, entry);
        const stat = statSync(srcPath);
        if (stat.isDirectory()) {
            mkdirSync(destPath, { recursive: true });
            count += copyCompanionFiles(srcPath, destPath);
        }
        else {
            if (entry === 'SKILL.md')
                continue; // already generated by formatSkill()
            copyFileSync(srcPath, destPath);
            count++;
        }
    }
    return count;
}
/**
 * Recursively copy companion files from embedded data.
 * Used only in embedded (Bun compile) mode.
 */
function copyCompanionFilesEmbedded(relativeDir, destDir) {
    const entries = readAicoreDir(relativeDir);
    let count = 0;
    for (const entry of entries) {
        const subPath = `${relativeDir}/${entry}`;
        const subEntries = readAicoreDir(subPath);
        if (subEntries.length > 0) {
            // Directory — recurse
            const destSub = join(destDir, entry);
            mkdirSync(destSub, { recursive: true });
            count += copyCompanionFilesEmbedded(subPath, destSub);
        }
        else {
            // File — read from embedded and write to disk
            const content = readAicoreFile(subPath);
            if (content !== null) {
                mkdirSync(dirname(join(destDir, entry)), { recursive: true });
                writeFileSync(join(destDir, entry), content, 'utf-8');
                count++;
            }
        }
    }
    return count;
}
//# sourceMappingURL=skill-generator.js.map