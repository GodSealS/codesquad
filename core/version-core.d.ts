/**
 * version-core — CLI version info & npm registry check
 *
 * Phase 7.1: Reads package.json for version, counts agents/skills/templates,
 * optionally checks npm registry for newer versions.
 */
export interface VersionInfo {
    /** Installed CLI version from package.json */
    cliVersion: string;
    /** Number of agent definition files */
    agentCount: number;
    /** Number of skill directories */
    skillCount: number;
    /** Number of template files */
    templateCount: number;
    /** Node.js version */
    nodeVersion: string;
}
export interface VersionCheckResult {
    current: string;
    latest: string | null;
    updateAvailable: boolean;
    error?: string;
}
/**
 * Get version info about the installed CLI.
 */
export declare function getVersionInfo(): VersionInfo;
/**
 * Check the npm registry for a newer version of codesquad.
 * Uses a simple HTTP request to the npm registry API.
 */
export declare function checkLatestVersion(): Promise<VersionCheckResult>;
//# sourceMappingURL=version-core.d.ts.map