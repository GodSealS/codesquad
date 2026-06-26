/**
 * Usage API — aggregated LLM usage and cost statistics.
 */
import { getMonthlyUsage, getTotalCost, getBudget } from '../../llm/usage-tracker.js';
export async function handleUsage(req, res, _services) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const period = url.searchParams.get('period');
    const agent = url.searchParams.get('agent');
    let usage = await getMonthlyUsage(period ?? undefined);
    const totalCost = await getTotalCost(period ?? undefined);
    if (agent) {
        usage = usage.filter((u) => u.agent === agent);
    }
    // By-day aggregation from raw records
    // (usage-tracker doesn't have per-day API, so we use per-agent summary)
    const byDay = [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        period: period ?? new Date().toISOString().slice(0, 7),
        byAgent: usage,
        byDay,
        total: {
            calls: usage.reduce((s, u) => s + u.requests, 0),
            promptTokens: usage.reduce((s, u) => s + u.promptTokens, 0),
            completionTokens: usage.reduce((s, u) => s + u.completionTokens, 0),
            cost: totalCost,
        },
        budget: {
            limit: getBudget().monthlyBudget,
            used: totalCost,
            percent: getBudget().monthlyBudget > 0
                ? Math.round((totalCost / getBudget().monthlyBudget) * 1000) / 10
                : 0,
        },
    }));
}
//# sourceMappingURL=usage.js.map