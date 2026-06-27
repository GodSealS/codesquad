/**
 * Lightweight CLI flag parser — zero-dependency argv → typed flags.
 *
 * Supports:
 *   --flag value     → "value"
 *   --flag=value     → "value"
 *   --flag           → boolean true
 *   --no-flag        → boolean false
 *
 * Phase P3.2
 */
export interface CliFlags {
    permissionMode?: string;
    systemPrompt?: string;
    model?: string;
    sandbox?: boolean;
    mcpConfig?: string;
    serve?: number;
    stream?: boolean;
    addDir?: string[];
    bare?: boolean;
    help?: boolean;
    version?: boolean;
}
/**
 * Parse process.argv into typed CliFlags.
 * Skips argv[0] (node) and argv[1] (script path).
 */
export declare function parseFlags(argv: string[]): CliFlags;
//# sourceMappingURL=flags.d.ts.map