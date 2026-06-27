/**
 * ToolSearchTool — Let agents discover available tools at runtime.
 *
 * When the agent needs to find a tool it doesn't know about, it can search
 * by keyword. Returns tool names + descriptions, not full schemas (saves tokens).
 *
 * Phase 6.2 — Chat Feature Gap Fill
 */
import { z } from 'zod';
import { buildTool } from './types.js';
import { getToolPool } from './registry.js';
const inputSchema = z.object({
    query: z.string().describe('Search keyword or "select:toolName" to get details for a specific tool'),
    maxResults: z.number().int().min(1).max(20).default(5).optional().describe('Maximum number of results to return'),
});
export const ToolSearchTool = buildTool({
    name: 'ToolSearch',
    description: 'Search available tools by keyword or select a specific tool to get its details. ' +
        'Use this when you are unsure which tool to use or need to discover what tools are available.',
    searchHint: 'search find discover tools available list',
    inputSchema,
    prompt() {
        return 'ToolSearch(query: string, maxResults?: number) — Search available tools by keyword';
    },
    descriptionFor(input) {
        return `ToolSearch("${input.query}")`;
    },
    isReadOnly() {
        return true;
    },
    isDestructive() {
        return false;
    },
    isConcurrencySafe() {
        return true;
    },
    async call(input, _context) {
        const { query, maxResults = 5 } = input;
        const pool = getToolPool();
        const LC = query.toLowerCase();
        // "select:toolName" — get full details for one tool
        if (LC.startsWith('select:')) {
            const targetName = query.slice(7).trim();
            const tool = pool.find((t) => t.name.toLowerCase() === targetName.toLowerCase());
            if (!tool) {
                return {
                    toolCallId: crypto.randomUUID(),
                    output: null,
                    content: `[Tool Not Found] No tool named "${targetName}". Use a keyword search to discover available tools.`,
                    isError: true,
                };
            }
            return {
                toolCallId: crypto.randomUUID(),
                output: { name: tool.name, description: tool.description },
                content: [
                    `**${tool.name}**`,
                    tool.description,
                    tool.isEnabled(_context) ? '' : '(currently disabled)',
                    tool.isReadOnly() ? '(read-only)' : '',
                    tool.isDestructive() ? '(destructive)' : '',
                ].filter(Boolean).join('\n'),
            };
        }
        // Keyword search — score each tool against query tokens
        const queryTokens = LC.split(/\s+/).filter(Boolean);
        const scored = pool
            .filter((t) => t.isEnabled(_context))
            .map((tool) => {
            let score = 0;
            const nameLc = tool.name.toLowerCase();
            const descLc = tool.description.toLowerCase();
            const hintLc = tool.searchHint.toLowerCase();
            for (const token of queryTokens) {
                if (nameLc === token)
                    score += 50;
                else if (nameLc.includes(token))
                    score += 20;
                if (descLc.includes(token))
                    score += 5;
                if (hintLc.includes(token))
                    score += 3;
            }
            return { name: tool.name, description: tool.description, score };
        })
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
        if (scored.length === 0) {
            return {
                toolCallId: crypto.randomUUID(),
                output: [],
                content: `[No Results] No tools found matching "${query}". Try broader keywords. Available tools: ${pool.map((t) => t.name).join(', ')}`,
            };
        }
        const lines = scored.map((r, i) => `${i + 1}. **${r.name}** — ${r.description.slice(0, 120)}`);
        return {
            toolCallId: crypto.randomUUID(),
            output: scored.map((r) => ({ name: r.name, description: r.description })),
            content: `Found ${scored.length} tool(s) matching "${query}":\n\n${lines.join('\n')}\n\nUse "select:toolName" for full details.`,
        };
    },
});
//# sourceMappingURL=ToolSearchTool.js.map