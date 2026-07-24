/**
 * Shared tool list — single source of truth for tool registration.
 *
 * Both REPL CLI and Web server register the same set of tools.
 * Any tool addition/removal only needs to happen here.
 */
import { BashTool } from './BashTool.js';
import { FileReadTool } from './FileReadTool.js';
import { FileWriteTool } from './FileWriteTool.js';
import { FileEditTool } from './FileEditTool.js';
import { GrepTool, GlobTool } from './GrepGlobTool.js';
import { AgentTool } from './AgentTool.js';
import { TodoWriteTool } from './TodoWriteTool.js';
import { TaskCreateTool } from './TaskCreateTool.js';
import { TaskGetTool } from './TaskGetTool.js';
import { TaskListTool } from './TaskListTool.js';
import { TaskStopTool } from './TaskStopTool.js';
import { TeamCreateTool } from './TeamCreateTool.js';
import { TeamDeleteTool } from './TeamDeleteTool.js';
import { SendMessageTool } from './SendMessageTool.js';
import { AskUserQuestionTool } from './AskUserQuestionTool.js';
import { WebSearchTool } from './WebSearchTool.js';
import { WebFetchTool } from './WebFetchTool.js';
import { EnterPlanModeTool } from './EnterPlanModeTool.js';
import { ExitPlanModeTool } from './ExitPlanModeTool.js';
import { LSPTool } from './LSPTool.js';
import { SkillTool } from './SkillTool.js';
import { ToolSearchTool } from './ToolSearchTool.js';
/** All built-in tools in registration order. Single source of truth. */
export const ALL_BUILTIN_TOOLS = [
    // Core I/O
    BashTool, FileReadTool, FileWriteTool, FileEditTool, GrepTool, GlobTool,
    // Agent delegation
    AgentTool, TodoWriteTool,
    // Task system
    TaskCreateTool, TaskGetTool, TaskListTool, TaskStopTool,
    // Team collaboration
    TeamCreateTool, TeamDeleteTool, SendMessageTool,
    // User interaction
    AskUserQuestionTool,
    // Web
    WebSearchTool, WebFetchTool,
    // Plan mode
    EnterPlanModeTool, ExitPlanModeTool,
    // LSP diagnostics
    LSPTool,
    // Meta
    SkillTool, ToolSearchTool,
];
//# sourceMappingURL=shared-tools.js.map