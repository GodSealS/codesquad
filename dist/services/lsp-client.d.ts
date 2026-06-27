/**
 * LSP Client — simplified Language Server Protocol client for diagnostics.
 *
 * Starts a tsserver process, sends didOpen/didChange, and collects
 * publishDiagnostics notifications. Focused on TypeScript diagnostics
 * for post-edit validation in the agent loop.
 *
 * References:
 *   Claude Code src/services/lsp/LSPClient.ts (14KB)
 *   Claude Code src/services/lsp/LSPServerInstance.ts (17KB)
 *   Claude Code src/services/lsp/LSPDiagnosticRegistry.ts (12KB)
 *
 * Phase 6 — P5 Vibe Coding
 */
export interface LspDiagnostic {
    filePath: string;
    line: number;
    character: number;
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    source?: string;
    code?: string;
}
export interface LspClientResult {
    diagnostics: LspDiagnostic[];
    error?: string;
}
export declare function startLspClient(projectRoot: string): Promise<void>;
export declare function openFile(filePath: string, content: string): Promise<void>;
export declare function changeFile(filePath: string, content: string): Promise<void>;
export declare function getDiagnostics(filePath: string): Promise<LspDiagnostic[]>;
export declare function getAllDiagnostics(): LspDiagnostic[];
export declare function clearDiagnostics(filePath?: string): void;
export declare function isLspReady(): boolean;
export declare function stopLspClient(): Promise<void>;
//# sourceMappingURL=lsp-client.d.ts.map