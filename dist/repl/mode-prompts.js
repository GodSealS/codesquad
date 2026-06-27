/**
 * Mode-specific system prompts injected into agent conversations.
 *
 * References Claude Code's approach of injecting mode instructions
 * via attachment/system messages.
 *
 * v4 (P1): Prompts accurately describe the Agent's real capability boundaries —
 * CodeSquad's callLLM returns plain text; Agents cannot actually write files
 * or execute commands. All operations are performed by the user in the terminal.
 */
/**
 * Get the system prompt that describes the current mode's capabilities
 * and constraints. Injected as a system message before each agent call.
 */
export function getModeSystemPrompt(mode) {
    switch (mode) {
        case 'ask':
            return `## 当前模式: Ask（只读分析，对应 Claude Code 的 default）
- 你只能输出分析、建议和代码片段作为文本。
- 所有文件操作和命令由用户在终端自行执行。
- 需要修改时，输出具体建议并提醒用户可切换到 Craft 模式获得更直接的实现指导。
- 以问答/分析形式输出。`;
        case 'craft':
            return `## 当前模式: Craft（实现指导，对应 Claude Code 的 bypassPermissions）
- 你输出完整的代码修改建议和实现方案。
- 用户评估后会自行在终端执行。
- 修改前先输出差异对比，让用户确认。
- 任务完成后简要总结修改内容。`;
        case 'plan':
            return `## 当前模式: Plan（方案设计，对应 Claude Code 的 plan）
- 先探索代码库，深入理解相关模块。
- 只输出结构化实现方案，不提供具体代码实现。
- 分析完成后展示: 1.问题分析 2.涉及模块/文件 3.修改步骤 4.风险考量
- 等待用户批准后再切换到 Craft 模式获得实现指导。`;
    }
}
//# sourceMappingURL=mode-prompts.js.map