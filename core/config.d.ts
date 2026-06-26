/**
 * CodeSquad Core Configuration
 *
 * Central constants: supported AI tools list, default paths, and config markers.
 * Pattern: mirrors OpenSpec's config.ts for tool interoperability.
 */
export declare const CODESQUAD_DIR_NAME = ".codesquad";
export declare const CODESQUAD_MARKERS: {
    start: string;
    end: string;
};
/** Available AI tool options */
export interface AIToolOption {
    /** Display name */
    name: string;
    /** Value used in --tools flag */
    value: string;
    /** Whether this tool adapter is available */
    available: boolean;
    /** Label shown on success */
    successLabel?: string;
    /** Default directory where skills/commands live */
    skillsDir?: string;
    /** Paths for auto-detection */
    detectionPaths?: string[];
}
/** All supported AI tools with their directory conventions */
export declare const AI_TOOLS: AIToolOption[];
/** Look up a tool by its value ID */
export declare function getToolByValue(value: string): AIToolOption | undefined;
/** Get tool-specific skills directory */
export declare function getToolDir(toolValue: string): string;
//# sourceMappingURL=config.d.ts.map