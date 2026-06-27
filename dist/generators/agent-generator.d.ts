import type { ToolAdapter, AgentDef, ModelsConfig } from '../adapters/types.js';
/** Scan agents/ directory and parse all agent definitions */
export declare function loadAgents(cliAgentsDir: string): Promise<AgentDef[]>;
/**
 * Generate agent files for a single tool adapter.
 */
export declare function generateAgents(adapter: ToolAdapter, agents: AgentDef[], outputDir: string, modelsConfig?: ModelsConfig): {
    count: number;
    errors: string[];
};
//# sourceMappingURL=agent-generator.d.ts.map