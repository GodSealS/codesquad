/**
 * codesquad web — Start the Web Console.
 *
 * Usage: codesquad web [options]
 */
export interface WebCommandOptions {
    port?: number;
    bind?: string;
    token?: string;
    noAuth?: boolean;
    readonly?: boolean;
}
export declare function handleWeb(options?: WebCommandOptions): Promise<void>;
//# sourceMappingURL=web.d.ts.map