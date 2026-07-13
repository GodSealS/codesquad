/**
 * EverOS Memory Backend — delegates store/retrieve/brief to evermemos MCP.
 *
 * When evermemos-mcp is configured in settings.json, this backend wraps
 * MCP tool calls (mcp__evermemos__remember, recall, briefing, forget)
 * behind the standard MemoryBackend interface.
 *
 * Falls back to LocalMemoryBackend when MCP tools are unavailable.
 *
 * Type mapping:
 *   CodeSquad → EverOS/evermemos
 *   user      → profile
 *   feedback  → cases
 *   project   → cases
 *   reference → cases
 *   store()   → mcp__evermemos__remember
 *   retrieve() → mcp__evermemos__recall
 *   brief()   → mcp__evermemos__briefing
 *   delete()  → mcp__evermemos__forget
 *   list()    → mcp__evermemos__fetch_history
 *
 * References:
 *   Idea/tutrue/memory-system-design.md §Phase 2
 */
// ── Type mapping ──
function mapTypeToEverOS(type) {
    switch (type) {
        case 'user': return 'profile';
        case 'feedback':
        case 'project':
        case 'reference':
        default: return 'cases';
    }
}
// ── EverOSMemoryBackend ──
export class EverOSMemoryBackend {
    mcpCall;
    space;
    available = true;
    constructor(mcpCall, space = 'coding:default') {
        this.mcpCall = mcpCall;
        this.space = space;
    }
    async store(entry) {
        if (!this.available)
            return;
        try {
            await this.mcpCall('evermemos', 'remember', {
                space: this.space,
                type: mapTypeToEverOS(entry.type),
                content: entry.content,
                title: entry.name,
                description: entry.description,
                tags: entry.tags ?? [],
            });
        }
        catch {
            this.available = false;
        }
    }
    async retrieve(query) {
        if (!this.available)
            return [];
        try {
            const result = (await this.mcpCall('evermemos', 'recall', {
                space: this.space,
                query: query.query ?? '',
                type: query.type ? mapTypeToEverOS(query.type) : undefined,
                limit: query.limit ?? 5,
                strategy: 'semantic',
            }));
            return (result.memories ?? []).map((m) => ({
                entry: {
                    name: m.title ?? 'Untitled',
                    description: m.content?.slice(0, 200) ?? '',
                    type: (query.type ?? 'reference'),
                    content: m.content ?? '',
                },
                score: m.score ?? 0,
            }));
        }
        catch {
            this.available = false;
            return [];
        }
    }
    async list(filter) {
        if (!this.available)
            return [];
        try {
            const result = (await this.mcpCall('evermemos', 'fetch_history', {
                space: this.space,
                type: filter?.type ? mapTypeToEverOS(filter.type) : undefined,
                limit: filter?.limit ?? 20,
            }));
            return (result.entries ?? []).map((e) => ({
                name: e.title ?? 'Untitled',
                description: e.content?.slice(0, 200) ?? '',
                type: (filter?.type ?? 'reference'),
                content: e.content ?? '',
            }));
        }
        catch {
            this.available = false;
            return [];
        }
    }
    async delete(id) {
        if (!this.available)
            return;
        try {
            await this.mcpCall('evermemos', 'forget', {
                space: this.space,
                memory_id: id,
            });
        }
        catch {
            this.available = false;
        }
    }
    async brief(sessionId) {
        if (!this.available) {
            return {
                sessionId,
                summary: '',
                keyTopics: [],
                lastActive: new Date(),
                messageCount: 0,
            };
        }
        try {
            const result = (await this.mcpCall('evermemos', 'briefing', {
                space: this.space,
                session_id: sessionId,
            }));
            return {
                sessionId,
                summary: result.summary ?? '',
                keyTopics: result.topics ?? [],
                lastActive: result.last_active ? new Date(result.last_active) : new Date(),
                messageCount: result.message_count ?? 0,
            };
        }
        catch {
            this.available = false;
            return {
                sessionId,
                summary: '',
                keyTopics: [],
                lastActive: new Date(),
                messageCount: 0,
            };
        }
    }
    /** Check if this backend is currently functional. */
    isAvailable() {
        return this.available;
    }
}
//# sourceMappingURL=everos-backend.js.map