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
/**
 * Parse process.argv into typed CliFlags.
 * Skips argv[0] (node) and argv[1] (script path).
 */
export function parseFlags(argv) {
    const flags = {};
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        // -h, -v shortcuts
        if (arg === '-h') {
            flags.help = true;
            continue;
        }
        if (arg === '-v') {
            flags.version = true;
            continue;
        }
        if (!arg.startsWith('--'))
            continue;
        // --no-flag → boolean false
        if (arg.startsWith('--no-')) {
            setFlag(flags, arg.slice(5), 'false');
            continue;
        }
        const eqIndex = arg.indexOf('=');
        if (eqIndex > 0) {
            // --flag=value
            const key = arg.slice(2, eqIndex);
            const value = arg.slice(eqIndex + 1);
            setFlag(flags, key, value);
        }
        else {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                // --flag value
                setFlag(flags, key, next);
                i++;
            }
            else {
                // --flag (boolean)
                setFlag(flags, key, 'true');
            }
        }
    }
    return flags;
}
function setFlag(flags, key, value) {
    switch (key) {
        case 'permission-mode':
            flags.permissionMode = value;
            break;
        case 'system-prompt':
            flags.systemPrompt = value;
            break;
        case 'model':
            flags.model = value;
            break;
        case 'sandbox':
            flags.sandbox = value === 'true';
            break;
        case 'mcp-config':
            flags.mcpConfig = value;
            break;
        case 'serve':
            flags.serve = parseInt(value, 10);
            break;
        case 'stream':
            flags.stream = value !== 'false';
            break;
        case 'add-dir':
            flags.addDir = [...(flags.addDir || []), value];
            break;
        case 'bare':
            flags.bare = value !== 'false';
            break;
        case 'help':
            flags.help = true;
            break;
        case 'version':
            flags.version = true;
            break;
    }
}
//# sourceMappingURL=flags.js.map