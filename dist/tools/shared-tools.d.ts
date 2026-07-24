/**
 * Shared tool list — single source of truth for tool registration.
 *
 * Both REPL CLI and Web server register the same set of tools.
 * Any tool addition/removal only needs to happen here.
 */
import type { Tool } from './types.js';
/** All built-in tools in registration order. Single source of truth. */
export declare const ALL_BUILTIN_TOOLS: Tool<any, any>[];
//# sourceMappingURL=shared-tools.d.ts.map