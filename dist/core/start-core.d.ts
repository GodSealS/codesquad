/**
 * Start Core
 *
 * Equivalent of the /start skill for the CLI.
 * Detects project state, guides user through onboarding (A/B/C/D paths),
 * sets review mode, writes stage file, and copies templates.
 */
export type StartPath = 'A' | 'B' | 'C' | 'D';
export type ReviewMode = 'full' | 'lean' | 'solo';
export interface ProjectState {
    engineConfigured: boolean;
    engineName: string;
    hasGameConcept: boolean;
    sourceFileCount: number;
    designDocCount: number;
    hasProductionArtifacts: boolean;
    hasGDDs: boolean;
    hasArchitectureDocs: boolean;
    reviewModePath: string | null;
    reviewMode: ReviewMode | null;
}
export interface StartOptions {
    targetPath?: string;
    ci?: boolean;
}
export declare function detectProjectState(targetPath: string): ProjectState;
export declare function runStart(options?: StartOptions): Promise<void>;
//# sourceMappingURL=start-core.d.ts.map