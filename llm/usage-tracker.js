/**
 * LLM usage tracker — records and aggregates API usage and cost.
 *
 * Storage: <projectRoot>/.codesquad/usage/  (project-scoped)
 * Fallback: ~/.codesquad/usage/ (when no project root set)
 *
 * Phase 1.6 — Steps 1.6.1-1.6.3.
 */
import { writeFile, readFile, mkdir } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { CODESQUAD_USER_ROOT } from '../core/paths.js';
import { successResult, errorResult } from '../core/task-result.js';
const writeFileAsync = promisify(writeFile);
const readFileAsync = promisify(readFile);
const mkdirAsync = promisify(mkdir);
// ── Project root injection ──
let _projectRoot = null;
/** Set the project root for usage tracking storage. Call at startup. */
export function setUsageProjectRoot(root) {
    _projectRoot = root;
}
function usageHome() {
    if (process.env.CODESQUAD_HOME)
        return process.env.CODESQUAD_HOME;
    if (_projectRoot)
        return join(_projectRoot, '.codesquad');
    return CODESQUAD_USER_ROOT;
}
// ── Pricing (USD per 1M tokens) ──
const PRICING = {
    'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
    'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
    'claude-haiku-3-5': { input: 0.8, output: 4.0 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4-turbo': { input: 10.0, output: 30.0 },
    'deepseek-chat': { input: 0.27, output: 1.1 },
    'deepseek-coder': { input: 0.27, output: 1.1 },
    'deepseek-reasoner': { input: 0.55, output: 2.2 },
    'kimi-k2.6': { input: 1.0, output: 4.0 },
};
const USAGE_DIR = join(usageHome(), 'usage');
// ── Path helpers ──
function currentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function usageFilePath(monthKey) {
    return join(USAGE_DIR, `${monthKey}.json`);
}
async function ensureUsageDir() {
    await mkdirAsync(USAGE_DIR, { recursive: true });
}
// ── Calculate cost ──
export function calculateCost(model, promptTokens, completionTokens) {
    const pricing = PRICING[model];
    if (!pricing)
        return 0;
    return (promptTokens / 1_000_000) * pricing.input + (completionTokens / 1_000_000) * pricing.output;
}
// ── Record usage ──
export async function recordUsage(record) {
    await ensureUsageDir();
    const monthKey = currentMonthKey();
    const filePath = usageFilePath(monthKey);
    let records = [];
    try {
        const raw = await readFileAsync(filePath, 'utf-8');
        records = JSON.parse(raw);
    }
    catch {
        // File doesn't exist yet
    }
    records.push(record);
    await writeFileAsync(filePath, JSON.stringify(records, null, 2));
}
/**
 * Record usage and return a TaskResult instead of throwing.
 * Use this for new code; original recordUsage() remains for backward compat.
 */
export async function recordUsageWithResult(record) {
    const startMs = Date.now();
    try {
        await recordUsage(record);
        return successResult(null, { taskId: record.agent, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId: record.agent,
            errorCode: 'FILE_WRITE_FAILED',
            message: `Failed to record usage: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
// ── Aggregate ──
export async function getMonthlyUsage(monthKey) {
    const key = monthKey ?? currentMonthKey();
    const filePath = usageFilePath(key);
    let records = [];
    try {
        const raw = await readFileAsync(filePath, 'utf-8');
        records = JSON.parse(raw);
    }
    catch {
        return [];
    }
    // Aggregate by agent + provider + model
    const map = new Map();
    for (const r of records) {
        const aggKey = `${r.agent}|${r.provider}|${r.model}`;
        const existing = map.get(aggKey);
        if (existing) {
            existing.requests++;
            existing.promptTokens += r.promptTokens;
            existing.completionTokens += r.completionTokens;
            existing.cost += r.cost;
        }
        else {
            map.set(aggKey, {
                agent: r.agent,
                provider: r.provider,
                model: r.model,
                requests: 1,
                promptTokens: r.promptTokens,
                completionTokens: r.completionTokens,
                cost: r.cost,
            });
        }
    }
    return Array.from(map.values());
}
/**
 * Get prompt caching statistics.
 * Feature 8 (P4): `/usage cache` command.
 */
export async function getCacheStats(monthKey) {
    const key = monthKey ?? currentMonthKey();
    const filePath = usageFilePath(key);
    let records = [];
    try {
        const raw = await readFileAsync(filePath, 'utf-8');
        records = JSON.parse(raw);
    }
    catch {
        return { totalCacheCreationTokens: 0, totalCacheReadTokens: 0, totalSavedCost: 0, recordCount: 0 };
    }
    let creation = 0;
    let read = 0;
    let withCache = 0;
    for (const r of records) {
        if (r.cacheCreationTokens)
            creation += r.cacheCreationTokens;
        if (r.cacheReadTokens) {
            read += r.cacheReadTokens;
            withCache++;
        }
    }
    // Rough cost savings: cache read tokens are charged at 10% of regular input price
    // Regular input: ~$3/MTok, cached input: ~$0.30/MTok → ~90% savings on cached tokens
    const savedCost = (read * 2.7) / 1_000_000; // $2.70 per MTok saved
    return {
        totalCacheCreationTokens: creation,
        totalCacheReadTokens: read,
        totalSavedCost: Math.round(savedCost * 10000) / 10000,
        recordCount: withCache,
    };
}
export async function getTotalCost(monthKey) {
    const usage = await getMonthlyUsage(monthKey);
    return usage.reduce((sum, u) => sum + u.cost, 0);
}
// ── Budget check ──
let budgetConfig = {
    monthlyBudget: 0, // 0 = disabled
    warnPercent: 0.8,
};
export function setBudget(config) {
    budgetConfig = config;
}
export function getBudget() {
    return { ...budgetConfig };
}
export async function checkBudget() {
    if (budgetConfig.monthlyBudget <= 0) {
        return { exceeded: false, warned: false, totalSpent: 0 };
    }
    const totalSpent = await getTotalCost();
    const ratio = totalSpent / budgetConfig.monthlyBudget;
    return {
        exceeded: ratio >= 1.0,
        warned: ratio >= budgetConfig.warnPercent,
        totalSpent,
    };
}
export function formatBudgetWarning(totalSpent) {
    const budget = budgetConfig.monthlyBudget;
    const percent = ((totalSpent / budget) * 100).toFixed(0);
    return (`⚠️  本月预算已用 ${percent}% ($${totalSpent.toFixed(2)} / $${budget.toFixed(2)})\n` +
        `   继续使用将超出预算。建议:\n` +
        `   1. /usage 查看详情\n` +
        `   2. /model deepseek/deepseek-chat 切换到更便宜的模型\n` +
        `   3. codesquad config usage.budget 20.00 提高预算`);
}
//# sourceMappingURL=usage-tracker.js.map