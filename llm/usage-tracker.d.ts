/**
 * LLM usage tracker — records and aggregates API usage and cost.
 *
 * Storage: <projectRoot>/.codesquad/usage/  (project-scoped)
 * Fallback: ~/.codesquad/usage/ (when no project root set)
 *
 * Phase 1.6 — Steps 1.6.1-1.6.3.
 */
import type { TaskResult } from '../core/task-result.js';
export interface UsageRecord {
    timestamp: string;
    agent: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    cost: number;
    /** Prompt caching tokens saved (Anthropic). Feature 8 (P4). */
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
}
/** Aggregate cache statistics. */
export interface CacheStats {
    totalCacheCreationTokens: number;
    totalCacheReadTokens: number;
    totalSavedCost: number;
    recordCount: number;
}
export interface UsageSummary {
    agent: string;
    provider: string;
    model: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
}
export interface BudgetConfig {
    monthlyBudget: number;
    warnPercent: number;
}
/** Set the project root for usage tracking storage. Call at startup. */
export declare function setUsageProjectRoot(root: string): void;
export declare function calculateCost(model: string, promptTokens: number, completionTokens: number): number;
export declare function recordUsage(record: UsageRecord): Promise<void>;
/**
 * Record usage and return a TaskResult instead of throwing.
 * Use this for new code; original recordUsage() remains for backward compat.
 */
export declare function recordUsageWithResult(record: UsageRecord): Promise<TaskResult<null>>;
export declare function getMonthlyUsage(monthKey?: string): Promise<UsageSummary[]>;
/**
 * Get prompt caching statistics.
 * Feature 8 (P4): `/usage cache` command.
 */
export declare function getCacheStats(monthKey?: string): Promise<CacheStats>;
export declare function getTotalCost(monthKey?: string): Promise<number>;
export declare function setBudget(config: BudgetConfig): void;
export declare function getBudget(): BudgetConfig;
export declare function checkBudget(): Promise<{
    exceeded: boolean;
    warned: boolean;
    totalSpent: number;
}>;
export declare function formatBudgetWarning(totalSpent: number): string;
//# sourceMappingURL=usage-tracker.d.ts.map