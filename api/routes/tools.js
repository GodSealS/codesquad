/**
 * Tool routes — list and execute CodeSquad tools over HTTP.
 *
 * POST /api/tools/list  → all registered tools (with metadata)
 * POST /api/tools/run   → execute a single tool
 *
 * Delegates to src/tools/registry.ts.
 */
import { getToolPool, findTool, runToolUse, assembleToolPool } from '../../tools/registry.js';
import { getSessionCache } from '../../tools/file-state.js';
export function registerToolRoutes(app, config) {
    // List all registered tools
    app.post('/api/tools/list', (_req, res) => {
        try {
            const pool = assembleToolPool();
            const tools = pool.map((t) => ({
                name: t.name,
                description: t.description,
                isReadOnly: t.isReadOnly(),
                isDestructive: t.isDestructive(),
                prompt: t.prompt(),
            }));
            res.json({
                tools,
                count: tools.length,
                readOnly: tools.filter((t) => t.isReadOnly).length,
                destructive: tools.filter((t) => t.isDestructive).length,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to list tools', code: 500 });
        }
    });
    // Execute a single tool
    app.post('/api/tools/run', async (req, res) => {
        try {
            const { toolName, input, permissionMode = 'default' } = req.body;
            if (!toolName) {
                res.status(400).json({ error: 'Missing required field: toolName', code: 400 });
                return;
            }
            const tool = findTool(toolName);
            if (!tool) {
                res.status(404).json({
                    error: `Unknown tool: "${toolName}"`,
                    code: 404,
                    availableTools: getToolPool().map((t) => t.name),
                });
                return;
            }
            const context = {
                session: undefined, // headless execution
                cwd: config.projectRoot,
                projectRoot: config.projectRoot,
                abortSignal: new AbortController().signal,
                permissionMode: permissionMode,
                readFileState: getSessionCache(),
                headless: true,
            };
            const result = await runToolUse({
                toolName,
                rawInput: input || {},
                context,
            });
            res.json({
                toolCallId: result.toolCallId,
                content: result.content,
                isError: !!result.isError,
            });
        }
        catch (err) {
            res.status(500).json({ error: `Tool execution failed: ${err.message}`, code: 500 });
        }
    });
}
//# sourceMappingURL=tools.js.map