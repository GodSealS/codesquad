/**
 * codesquad test — run tests across multiple languages/frameworks.
 *
 * Detects test framework from project config (package.json, pytest.ini, *.csproj, etc.)
 * and runs the appropriate test command.
 *
 * Phase 2.0
 */
export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'pytest' | 'unittest' | 'dotnet' | 'nunit' | 'cargo' | 'go' | 'ctest' | 'maven' | 'gradle' | 'npm' | 'unknown';
export interface TestFrameworkInfo {
    framework: TestFramework;
    command: string;
    language: string;
    configFile: string;
    watchSupported: boolean;
    coverageSupported: boolean;
}
export interface TestOptions {
    watch?: boolean;
    coverage?: boolean;
    filter?: string;
    framework?: TestFramework;
    dryRun?: boolean;
    json?: boolean;
}
/**
 * Detect test framework from project root.
 */
export declare function detectTestFramework(root?: string): TestFrameworkInfo;
/**
 * Build the test command to run.
 */
export declare function buildTestCommand(framework: TestFrameworkInfo, options: TestOptions): string;
/**
 * Handle the `codesquad test` CLI command.
 */
export declare function handleTest(options?: TestOptions): Promise<void>;
//# sourceMappingURL=test.d.ts.map