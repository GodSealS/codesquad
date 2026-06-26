/**
 * Adapter Registry
 *
 * Central registry of all AI tool adapters (25+ tools).
 * To add a new tool: create its adapter, import it here, and add to the map.
 */
import type { ToolAdapter } from './types.js';
/** Map of tool value ID → adapter instance */
export declare const adapterMap: Map<string, ToolAdapter>;
/** Get adapter for a given tool value */
export declare function getAdapter(toolValue: string): ToolAdapter | undefined;
/** List all available adapter tool IDs */
export declare function getAvailableAdapters(): string[];
//# sourceMappingURL=index.d.ts.map