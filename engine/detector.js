/**
 * EngineDetector — automatically detect game engine type from project files.
 *
 * Scans well-known project marker files:
 *   - Unreal Engine:   .uproject
 *   - Unity:           ProjectSettings/ProjectVersion.txt, Assets/ (heuristic)
 *   - Godot:           project.godot
 *   - Cocos Creator:   project.json (with cocos-specific fields)
 *
 * Phase 2.0
 */
import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
const PROBES = [
    // Unreal Engine
    { engine: 'unreal', file: '*.uproject', checkContent: true, confirmPattern: /"FileVersion"/ },
    // Godot
    { engine: 'godot', file: 'project.godot', checkContent: true, extractVersion: extractGodotVersion },
    // Unity
    { engine: 'unity', file: 'ProjectSettings/ProjectVersion.txt', checkContent: true, extractVersion: extractUnityVersion },
    { engine: 'unity', file: 'Packages/manifest.json', checkContent: true, confirmPattern: /com\.unity/i },
    // Cocos Creator
    { engine: 'cocos', file: 'project.json', checkContent: true, confirmPattern: /"engineVersion"|"engine"/ },
];
// ── Version extractors ──
function extractGodotVersion(content) {
    const match = content.match(/config_version\s*=\s*(\d+)/);
    if (match) {
        const v = parseInt(match[1], 10);
        return `config.v${v}`;
    }
    return undefined;
}
function extractUnityVersion(content) {
    // ProjectVersion.txt format: "m_EditorVersion: 2022.3.1f1"
    const match = content.match(/m_EditorVersion:\s*(\S+)/);
    return match ? match[1] : undefined;
}
// ── Glob match helper (single-level wildcard) ──
async function findFileByGlob(root, pattern) {
    if (!pattern.includes('*')) {
        try {
            await access(join(root, pattern), constants.R_OK);
            return join(root, pattern);
        }
        catch {
            return null;
        }
    }
    // Simple single-level wildcard: *.uproject → scan root for any .uproject file
    if (pattern === '*.uproject') {
        const { readdir } = await import('fs/promises');
        try {
            const entries = await readdir(root);
            const match = entries.find(e => e.endsWith('.uproject'));
            return match ? join(root, match) : null;
        }
        catch {
            return null;
        }
    }
    return null;
}
// ── Main detector ──
/**
 * Detect game engine type from project root directory.
 */
export async function detectEngine(projectRoot) {
    for (const probe of PROBES) {
        const filePath = await findFileByGlob(projectRoot, probe.file);
        if (!filePath)
            continue;
        if (!probe.checkContent) {
            return {
                engine: probe.engine,
                confidence: 0.7,
                projectFile: probe.file,
            };
        }
        try {
            const content = await readFile(filePath, 'utf-8');
            // If confirmPattern exists, verify content matches
            if (probe.confirmPattern && !probe.confirmPattern.test(content)) {
                continue;
            }
            const version = probe.extractVersion
                ? probe.extractVersion(content)
                : undefined;
            return {
                engine: probe.engine,
                version,
                confidence: 0.9,
                projectFile: filePath,
                details: version ? { version } : undefined,
            };
        }
        catch {
            // File found but unreadable — still a weak indicator
            return {
                engine: probe.engine,
                confidence: 0.5,
                projectFile: filePath,
            };
        }
    }
    return { engine: 'unknown', confidence: 0 };
}
/**
 * Get suggested build commands for a detected engine.
 */
export function getBuildCommandSuggestion(engine) {
    switch (engine) {
        case 'unreal':
            return [
                'RunUAT.bat BuildCookRun -project="MyProject.uproject" -platform=Win64 -target=Shipping',
                'msbuild MyProject.sln /p:Configuration=Development',
                'UE5> GenerateProjectFiles.bat',
            ];
        case 'unity':
            return [
                'Unity -quit -batchmode -buildTarget Win64 -projectPath .',
                'Unity -quit -batchmode -executeMethod BuildScript.PerformBuild',
                'dotnet build (for C# assemblies inside Unity)',
            ];
        case 'godot':
            return [
                'godot --headless --export-release "Windows Desktop"',
                'godot --headless --export-debug "Windows Desktop"',
                'godot --headless --build-solutions',
            ];
        case 'cocos':
            return [
                'cocos build -p web',
                'cocos build -p native --release',
                'npm run build (if using Cocos Creator with npm)',
            ];
        default:
            return [
                'npm run build',
                'dotnet build',
                'make',
            ];
    }
}
/**
 * Get suggested test commands for a detected engine.
 */
export function getTestCommandSuggestion(engine) {
    switch (engine) {
        case 'unreal':
            return [
                'UE5> Engine/Binaries/DotNET/UnrealBuildTool.exe -Mode=Automation',
                'RunUAT.bat RunTests',
            ];
        case 'unity':
            return [
                'Unity -quit -batchmode -runEditorTests',
                'dotnet test (for C# test projects)',
            ];
        case 'godot':
            return [
                'godot --headless --test',
                'godot -s addons/gut/gut_cmdln.gd (if using GUT)',
            ];
        case 'cocos':
            return [
                'npm test',
                'cocos test',
            ];
        default:
            return [
                'npm test',
                'dotnet test',
                'pytest',
                'go test ./...',
                'cargo test',
            ];
    }
}
//# sourceMappingURL=detector.js.map