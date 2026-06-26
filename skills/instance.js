/**
 * SkillInstance — represents a single running skill execution.
 *
 * Each skill invocation (whether from REPL /skill-name or Web API skillId)
 * creates a SkillInstance. Instances support:
 *   - Unique ID for tracking
 *   - Step-by-step execution with decision checkpoints
 *   - Pause/resume when user input is needed (AskUserQuestion)
 *   - Multiple concurrent instances per skill
 *   - Error propagation with diagnostic info
 */
import { randomUUID } from 'crypto';
import { addMessage, createSession } from '../chat/session.js';
import { chatModeToPermissionMode } from '../permissions/mode.js';
import { getModeSystemPrompt } from '../repl/mode-prompts.js';
import { getSessionCache } from '../tools/file-state.js';
import { assembleToolPool } from '../tools/registry.js';
import { toolsToNativeSchemas } from '../tools/schema-converter.js';
import { runToolUse, findTool } from '../tools/registry.js';
import { callLLM, LlmError } from '../llm/client.js';
import { calculateCost } from '../llm/usage-tracker.js';
import { matchSubFiles, loadSubFileContent } from '../repl/skill-registry.js';
import { parseToolCalls as parseToolCallsXml } from '../tools/response-parser.js';
// ── SkillInstance ──
export class SkillInstance {
    id;
    skillName;
    skill;
    session;
    status = 'idle';
    config;
    messages = [];
    turn = 0;
    consecutiveTruncations = 0;
    lastCompletionTokens = 0;
    emptyToolCallCount = 0;
    finalContent = '';
    runtimeConfig;
    pool;
    nativeTools;
    toolContext;
    systemMessages;
    abortController;
    // Accumulated token usage (Session doesn't have a usage field)
    _totalPromptTokens = 0;
    _totalCompletionTokens = 0;
    _totalCost = 0;
    /** Total prompt tokens used across all turns. */
    get totalPromptTokens() { return this._totalPromptTokens; }
    /** Total completion tokens used across all turns. */
    get totalCompletionTokens() { return this._totalCompletionTokens; }
    /** Total cost in USD. */
    get totalCost() { return this._totalCost; }
    // Paused state
    _pendingQuestion = null;
    _resolveResume = null;
    /** The current execution promise (used for re-await on resume). */
    _executionPromise = null;
    error = null;
    /** Assembled skill body — main SKILL.md + matched sub-files based on user context. */
    assembledBody;
    constructor(config) {
        this.id = randomUUID();
        this.skillName = config.skill.dirName;
        this.skill = config.skill;
        this.config = config;
        this.runtimeConfig = config.runtimeConfig;
        this.abortController = new AbortController();
        // Create isolated session for this skill instance
        this.session = createSession(`skill:${this.skillName}#${this.id.slice(0, 8)}`, {
            provider: config.providerId,
            model: config.model,
            maxTokens: config.maxTokensOverride ?? config.skill.maxTokens ?? 4096,
        });
        // Assemble skill body: main SKILL.md + auto-matched sub-files
        this.assembledBody = this._assembleBody(config.skill, config.skillArgs);
        // Build system messages
        this.systemMessages = [];
        // Skill body as system instruction (includes matched sub-files)
        this.systemMessages.push({
            role: 'system',
            content: this.assembledBody,
            timestamp: new Date().toISOString(),
        });
        // Mode prompt
        this.systemMessages.push({
            role: 'system',
            content: getModeSystemPrompt(config.mode),
            timestamp: new Date().toISOString(),
        });
        // Build tool context
        this.toolContext = {
            session: this.session,
            cwd: config.cwd || config.projectRoot,
            projectRoot: config.projectRoot,
            abortSignal: this.abortController.signal,
            permissionMode: chatModeToPermissionMode(config.mode),
            readFileState: getSessionCache(),
            headless: true, // Skills don't prompt for file permissions
        };
        // Filter tools by allowed-tools
        const rawPool = assembleToolPool();
        const allowedToolSet = config.skill.allowedTools.length > 0
            ? new Set(config.skill.allowedTools)
            : null;
        this.pool = allowedToolSet
            ? rawPool.filter((t) => allowedToolSet.has(t.name))
            : rawPool;
        this.nativeTools = toolsToNativeSchemas(this.pool);
    }
    // ── Public API ──
    /** Start execution. Returns when done or paused for user input. */
    async execute() {
        // If there's an existing execution promise (first run or resumed), just wait for it.
        // Covers: initial idle→running, and resume→running after await_user.
        if (this._executionPromise) {
            const s = this.status;
            if (s === 'running' || s === 'awaiting_user') {
                try {
                    await this._executionPromise;
                }
                catch { /* error in instance.error */ }
                return;
            }
        }
        if (this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled') {
            return;
        }
        if (this.status !== 'idle') {
            throw new Error(`Cannot execute instance in status: ${this.status}`);
        }
        this.status = 'running';
        // Initialize messages
        this.messages = [
            ...this.systemMessages,
            { role: 'user', content: this.config.skillArgs || 'execute', timestamp: new Date().toISOString() },
        ];
        // Store the execution promise so resume() can re-await it
        this._executionPromise = this._runLoop();
        try {
            await this._executionPromise;
        }
        catch {
            // Error already captured in instance.error via _emit
        }
    }
    /**
     * Resume execution after user answers a question.
     * Sets status back to 'running' so the suspended _runLoop's while condition passes.
     * @param answer - User's text answer (comma-separated option indices or text).
     */
    resume(answer) {
        if (this.status !== 'awaiting_user' || !this._resolveResume) {
            throw new Error('Instance is not awaiting user input');
        }
        this._pendingQuestion = null;
        // Must set status to running BEFORE resolving — _runLoop's while condition checks it
        this.status = 'running';
        this._resolveResume(answer);
        this._resolveResume = null;
    }
    /** Cancel execution. */
    cancel() {
        this.abortController.abort();
        this.status = 'cancelled';
        if (this._resolveResume) {
            this._resolveResume('');
            this._resolveResume = null;
        }
    }
    /** Get current pending question (for UI to display). */
    get pendingQuestion() {
        return this._pendingQuestion;
    }
    // ── Internal execution ──
    async _runLoop() {
        const MAX_TURNS = this.config.maxTurns ?? 20;
        const skillMaxTokens = this.config.skill.maxTokens ?? 4096;
        try {
            while (this.turn < MAX_TURNS && this.status === 'running') {
                this.turn++;
                // Call LLM
                const response = await callLLM(this.runtimeConfig, {
                    model: this.config.model,
                    messages: this.messages,
                    maxTokens: skillMaxTokens,
                    tools: this.nativeTools.length > 0 ? this.nativeTools : undefined,
                    tool_choice: this.nativeTools.length > 0 ? { type: 'auto' } : undefined,
                });
                // Parse tool calls — prefer native tool_use, fallback to XML for non-native providers
                const validToolNames = new Set(this.pool.map((t) => t.name));
                const toolCalls = response.toolCalls && response.toolCalls.length > 0
                    ? response.toolCalls.filter((tc) => findTool(tc.name) !== undefined)
                    : parseToolCallsXml(null, response.content, validToolNames);
                // B6 fix: empty tool_calls detection
                if (response.toolCalls && response.toolCalls.length === 0 && toolCalls.length === 0) {
                    this.emptyToolCallCount++;
                    if (this.emptyToolCallCount >= 3) {
                        this._emit({ type: 'error', error: { message: '连续 3 轮返回空工具调用，已终止。', isLlmError: true } });
                        this.status = 'failed';
                        return;
                    }
                    if (this.emptyToolCallCount === 1) {
                        this.messages.push({
                            role: 'user',
                            content: '[System] 你返回了空的 tool_calls 数组。如任务已完成，请给出最终回复。',
                            timestamp: new Date().toISOString(),
                        });
                    }
                    continue;
                }
                if (toolCalls.length > 0) {
                    this.emptyToolCallCount = 0;
                }
                if (toolCalls.length > 0) {
                    // Emit text before tool calls
                    this._emit({ type: 'text', text: response.content });
                    // Add assistant message
                    this.messages.push({ role: 'assistant', content: response.content, timestamp: new Date().toISOString() });
                    for (const tc of toolCalls) {
                        this._emit({ type: 'tool_call', toolName: tc.name, toolInput: tc.input });
                        const result = await runToolUse({
                            toolName: tc.name,
                            rawInput: tc.input,
                            context: this.toolContext,
                        });
                        this._emit({
                            type: 'tool_result',
                            toolName: tc.name,
                            toolResult: result.content,
                            toolIsError: !!result.isError,
                        });
                        // Check for AskUserQuestion — pause and await user answer
                        if (tc.name === 'AskUserQuestion' && this.toolContext.__needsUserInput) {
                            const pending = this.toolContext.__needsUserInput;
                            delete this.toolContext.__needsUserInput;
                            this._pendingQuestion = pending;
                            this.status = 'awaiting_user';
                            this._emit({ type: 'question', question: pending });
                            // Wait for user to call resume()
                            const answer = await new Promise((resolve) => {
                                this._resolveResume = resolve;
                            });
                            // status may have been changed to 'cancelled' by cancel() during the await
                            if (this.status === 'cancelled')
                                return;
                            // Inject user answer as tool result
                            this.messages.push({
                                role: 'user',
                                content: `[Tool Result: AskUserQuestion]\nUser answer: ${answer}`,
                                timestamp: new Date().toISOString(),
                            });
                            continue;
                        }
                        // Add tool result
                        this.messages.push({
                            role: 'user',
                            content: `[Tool Result: ${tc.name}]\n${result.content}`,
                            timestamp: new Date().toISOString(),
                        });
                    }
                    continue; // Next turn
                }
                // ── No tool calls — check truncation, then final ──
                const content = response.content;
                this.finalContent = content || '';
                const completionTokens = response.usage?.completionTokens ?? 0;
                const pct = Math.round((completionTokens / skillMaxTokens) * 100);
                const truncatedByTokenLimit = completionTokens >= skillMaxTokens * 0.9;
                const endsAbruptly = content && !/[。！？.!?)\]」』"\n]+$/.test(content.trim());
                const deltaSinceLast = completionTokens - this.lastCompletionTokens;
                const isDiminishing = this.consecutiveTruncations >= 3 && deltaSinceLast < 500 && this.lastCompletionTokens > 0;
                if (truncatedByTokenLimit && endsAbruptly && !isDiminishing && this.consecutiveTruncations < 5) {
                    this.consecutiveTruncations++;
                    this.lastCompletionTokens = completionTokens;
                    const nudge = `Stopped at ${pct}% of token limit (${completionTokens.toLocaleString()} / ${skillMaxTokens.toLocaleString()}). Keep working — do not summarize.`;
                    this._emit({ type: 'text', text: content });
                    this.messages.push({ role: 'assistant', content, timestamp: new Date().toISOString() });
                    this.messages.push({ role: 'user', content: nudge, timestamp: new Date().toISOString() });
                    continue;
                }
                // Natural end
                this._emit({ type: 'text', text: content });
                this._emit({ type: 'done', finalContent: this.finalContent, totalTurns: this.turn });
                // Save to session
                addMessage(this.session, 'user', `/${this.skillName} ${this.config.skillArgs || ''}`);
                addMessage(this.session, 'assistant', content);
                // Record usage (Session doesn't have a top-level usage field)
                if (response.usage) {
                    const cost = calculateCost(response.model, response.usage.promptTokens, response.usage.completionTokens);
                    this._totalPromptTokens += response.usage.promptTokens;
                    this._totalCompletionTokens += response.usage.completionTokens;
                    this._totalCost += cost;
                }
                this.status = 'completed';
                return;
            }
            // Max turns reached
            if (this.turn >= MAX_TURNS) {
                this._emit({ type: 'error', error: { message: `已达到最大轮次 (${MAX_TURNS})，Skill 停止处理。`, isLlmError: false } });
                this.status = 'failed';
                return;
            }
        }
        catch (err) {
            const isLlm = err instanceof LlmError;
            this.error = {
                message: isLlm ? err.message : `Skill 执行失败: ${err.message}`,
                stack: err.stack,
                isLlmError: isLlm,
                statusCode: isLlm ? err.status : undefined,
            };
            this._emit({ type: 'error', error: this.error });
            this.status = 'failed';
        }
    }
    /**
     * Assemble the full skill body by matching sub-files against user context.
     *
     * For multi-file skills like cocos_editor:
     *   User says "create a player character" → auto-loads workflow-character.md
     *   User says "build the UI" → auto-loads workflow-ui.md
     *
     * The matching uses trigger keywords from the SKILL.md's Workflow Routing table.
     */
    _assembleBody(skill, userContext) {
        let body = skill.body;
        if (!userContext || userContext === 'execute' || skill.subFiles.length === 0) {
            return body;
        }
        const matched = matchSubFiles(skill.dirName, userContext);
        if (matched.length === 0)
            return body;
        for (const sfName of matched) {
            const sfContent = loadSubFileContent(skill.dirName, sfName);
            if (sfContent) {
                body += `\n\n---\n## Sub-Workflow: ${sfName}\n${sfContent}`;
            }
        }
        return body;
    }
    _emit(event) {
        const full = {
            ...event,
            instanceId: this.id,
            skillName: this.skillName,
            turn: this.turn,
        };
        this.config.onStep?.(full);
    }
}
//# sourceMappingURL=instance.js.map