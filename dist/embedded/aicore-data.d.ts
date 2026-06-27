/** Whether EMBEDDED_FILES values are Base64-encoded (true=PROD) or plaintext (false=DEV). */
export declare const IS_BASE64_ENCODED = false;
export interface EmbeddedFile {
    path: string;
    content: string;
}
export interface EmbeddedDir {
    path: string;
    entries: string[];
}
export declare const EMBEDDED_FILES: Record<string, string>;
export declare const EMBEDDED_DIRS: Record<string, string[]>;
export declare const EMBEDDED_FILE_SET: Set<string>;
export declare const EMBEDDED_STATS: {
    totalFiles: number;
    totalDirs: number;
    totalSizeBytes: number;
    generatedAt: string;
};
//# sourceMappingURL=aicore-data.d.ts.map