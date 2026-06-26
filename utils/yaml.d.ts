/**
 * YAML Utilities
 *
 * Safe read/write helpers for YAML configuration files.
 * Uses the 'yaml' package for parsing and serialization.
 */
/** Read and parse a YAML file; returns null if missing or invalid */
export declare function readYaml<T = unknown>(filePath: string): T | null;
/** Write an object as YAML to a file (creates parent dirs) */
export declare function writeYaml(filePath: string, data: unknown): void;
/** Read and parse a YAML file, falling back to a default value */
export declare function readYamlOrDefault<T>(filePath: string, defaultVal: T): T;
//# sourceMappingURL=yaml.d.ts.map