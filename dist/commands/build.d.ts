/**
 * codesquad build — compile/build a game project.
 *
 * Detects engine type (if not specified) and runs the appropriate build command.
 * Lightweight wrapper around BashTool v2 with engine detection.
 *
 * Phase 2.0
 */
import { type EngineType } from '../engine/detector.js';
export interface BuildOptions {
    engine?: EngineType;
    platform?: string;
    config?: string;
    runInBackground?: boolean;
    dryRun?: boolean;
}
/**
 * Handle the `codesquad build` CLI command.
 */
export declare function handleBuild(engineArg?: string, options?: BuildOptions): Promise<void>;
/**
 * Output engine build info as JSON for programmatic use.
 */
export declare function getBuildInfoJson(engineArg?: string): Promise<string>;
//# sourceMappingURL=build.d.ts.map