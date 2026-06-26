/**
 * YAML Utilities
 *
 * Safe read/write helpers for YAML configuration files.
 * Uses the 'yaml' package for parsing and serialization.
 */
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFileSafe, writeFileSafe } from './fs.js';
/** Read and parse a YAML file; returns null if missing or invalid */
export function readYaml(filePath) {
    const raw = readFileSafe(filePath);
    if (raw === null)
        return null;
    try {
        return parseYaml(raw);
    }
    catch {
        return null;
    }
}
/** Write an object as YAML to a file (creates parent dirs) */
export function writeYaml(filePath, data) {
    const yaml = stringifyYaml(data, {
        lineWidth: 0, // Disable line wrapping
        doubleQuotedAsJSON: false,
        defaultStringType: 'QUOTE_DOUBLE',
        defaultKeyType: 'PLAIN',
        singleQuote: false,
    });
    writeFileSafe(filePath, yaml);
}
/** Read and parse a YAML file, falling back to a default value */
export function readYamlOrDefault(filePath, defaultVal) {
    const result = readYaml(filePath);
    return result !== null ? result : defaultVal;
}
//# sourceMappingURL=yaml.js.map