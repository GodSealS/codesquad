/**
 * validate-catalog — Catalog YAML data layer
 *
 * Phase 6.2: Reads and queries `CCGS Skill Testing Framework/catalog.yaml`.
 * Provides unified data access for both CLI validate and AI /skill-test.
 */
export interface SkillCatalogEntry {
    name: string;
    spec: string;
    last_static: string;
    last_static_result: string;
    last_spec: string;
    last_spec_result: string;
    last_category: string;
    last_category_result: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    category: string;
}
export interface AgentCatalogEntry {
    name: string;
    spec: string;
    last_static?: string;
    last_static_result?: string;
    last_spec: string;
    last_spec_result: string;
    last_category?: string;
    last_category_result?: string;
    category: string;
}
export interface Catalog {
    version: number;
    last_updated: string;
    skills: SkillCatalogEntry[];
    agents: AgentCatalogEntry[];
}
/**
 * Read and parse the catalog.yaml file.
 * Results are cached in-process for repeated access.
 */
export declare function readCatalog(): Catalog;
/**
 * Clear the in-process cache (useful for tests).
 */
export declare function clearCatalogCache(): void;
export declare function getSkillEntries(): SkillCatalogEntry[];
export declare function getSkillByName(name: string): SkillCatalogEntry | undefined;
export declare function getSkillsByCategory(category: string): SkillCatalogEntry[];
export declare function getSkillsByPriority(priority: SkillCatalogEntry['priority']): SkillCatalogEntry[];
export declare function getAgentEntries(): AgentCatalogEntry[];
export declare function getAgentByName(name: string): AgentCatalogEntry | undefined;
export declare function getAgentsByCategory(category: string): AgentCatalogEntry[];
export interface CoverageStats {
    totalSkills: number;
    totalAgents: number;
    skillsTested: number;
    agentsTested: number;
    skillsCompliant: number;
    skillsWithWarnings: number;
    skillsNonCompliant: number;
    byCategory: Record<string, {
        total: number;
        tested: number;
    }>;
    byPriority: Record<string, {
        total: number;
        tested: number;
    }>;
}
export declare function getCoverageStats(): CoverageStats;
/**
 * Update the last_static fields for a skill in the catalog.
 * Writes back to the catalog.yaml file.
 */
export declare function updateStaticResult(name: string, date: string, result: string, writeBack?: boolean): void;
/**
 * Write the catalog back to disk.
 * Only used when explicitly requested (e.g., CI update).
 */
export declare function writeCatalog(catalog: Catalog): void;
//# sourceMappingURL=validate-catalog.d.ts.map