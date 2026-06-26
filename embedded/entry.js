/**
 * entry — Bun compile entry point
 *
 * When using `bun build --compile`, this file is the entry point.
 * It preloads embedded AICore data and launches the CLI.
 *
 * The entry ensures that aicore-data.ts and runtime.ts are compiled
 * into the binary so that isBunCompiled === true at runtime.
 */
// Preload embedded data — must be imported first so the module
// is included in the compiled binary
import './aicore-data.js';
import './runtime.js';
// Launch CLI
import { run } from '../cli/index.js';
run();
//# sourceMappingURL=entry.js.map