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
export type EngineType = 'unreal' | 'unity' | 'godot' | 'cocos' | 'unknown';
export interface EngineInfo {
    engine: EngineType;
    version?: string;
    confidence: number;
    projectFile?: string;
    details?: Record<string, string>;
}
/**
 * Detect game engine type from project root directory.
 */
export declare function detectEngine(projectRoot: string): Promise<EngineInfo>;
/**
 * Get suggested build commands for a detected engine.
 */
export declare function getBuildCommandSuggestion(engine: EngineType): string[];
/**
 * Get suggested test commands for a detected engine.
 */
export declare function getTestCommandSuggestion(engine: EngineType): string[];
//# sourceMappingURL=detector.d.ts.map