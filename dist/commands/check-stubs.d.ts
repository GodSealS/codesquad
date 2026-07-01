/**
 * Check Stubs Command — Phase 9.3
 *
 * codesquad check --stubs
 *
 * Validates consistency between .codesquad MCP stubs (.aicore-mcp-stubs/)
 * and .codesquad/ implementations. Ensures every stub has a matching
 * implementation and vice versa.
 */
interface StubCheckResult {
    ok: boolean;
    agentCount: number;
    skillCount: number;
    issues: Array<{
        type: 'error' | 'warning' | 'info';
        file: string;
        message: string;
    }>;
}
type CheckMode = 'stubs' | 'stubs-strict';
export declare function handleCheckStubs(mode?: CheckMode, projectRoot?: string): Promise<void>;
export declare function runStubCheck(projectRoot: string, mode: CheckMode): StubCheckResult;
export {};
//# sourceMappingURL=check-stubs.d.ts.map