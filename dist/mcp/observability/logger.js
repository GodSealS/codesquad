/**
 * Structured Logger
 *
 * JSON-formatted logging for MCP Server operations.
 * Supports log levels: trace | debug | info | warn | error.
 * Outputs to stderr (never stdout — stdout is the MCP protocol channel).
 */
import { isDebugMode } from '../../utils/debug.js';
const LEVEL_ORDER = {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
};
let _config = null;
/** Initialize logger with MCP config (call once at server start) */
export function initLogger(config) {
    _config = config;
}
/** Get current log level threshold — debug mode forces 'debug' level. */
function getThreshold() {
    // Debug mode overrides log_level to capture all trace/debug messages
    if (isDebugMode())
        return 'debug';
    return _config?.observability?.log_level ?? 'info';
}
/** Get log format */
function getFormat() {
    return _config?.observability?.log_format ?? 'json';
}
/** Write a log entry */
function writeLog(entry) {
    if (getFormat() === 'json') {
        process.stderr.write(JSON.stringify(entry) + '\n');
    }
    else {
        const ts = entry.timestamp.slice(11, 19); // HH:MM:SS
        const level = entry.level.toUpperCase().padEnd(5);
        const comp = entry.component ? `[${entry.component}] ` : '';
        const err = entry.error ? ` | ${entry.error}` : '';
        process.stderr.write(`${ts} ${level} ${comp}${entry.message}${err}\n`);
        if (entry.stack && entry.level === 'error') {
            process.stderr.write(`  ${entry.stack}\n`);
        }
    }
}
/** Check if a level passes the configured threshold */
function shouldLog(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[getThreshold()];
}
/** Build a log entry */
function buildEntry(level, message, component, data, error) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
    };
    if (component)
        entry.component = component;
    if (data)
        entry.data = data;
    if (error instanceof Error) {
        entry.error = error.message;
        entry.stack = error.stack;
    }
    else if (error) {
        entry.error = String(error);
    }
    return entry;
}
// ── Public API ──
export const logger = {
    trace(message, component, data) {
        if (!shouldLog('trace'))
            return;
        writeLog(buildEntry('trace', message, component, data));
    },
    debug(message, component, data) {
        if (!shouldLog('debug'))
            return;
        writeLog(buildEntry('debug', message, component, data));
    },
    info(message, component, data) {
        if (!shouldLog('info'))
            return;
        writeLog(buildEntry('info', message, component, data));
    },
    warn(message, component, data) {
        if (!shouldLog('warn'))
            return;
        writeLog(buildEntry('warn', message, component, data));
    },
    error(message, component, error, data) {
        if (!shouldLog('error'))
            return;
        writeLog(buildEntry('error', message, component, data, error));
    },
    /** Log an agent execution start */
    agentStart(agentName, turnLimit) {
        this.info(`Agent start: ${agentName}`, 'agent-runner', { agentName, maxTurns: turnLimit });
    },
    /** Log a tool call */
    toolCall(toolName, args, durationMs, success) {
        const level = success ? 'debug' : 'warn';
        logger[level](`Tool call: ${toolName} (${durationMs}ms)`, 'tool-registry', {
            tool: toolName,
            duration_ms: durationMs,
            success,
            arg_keys: Object.keys(args),
        });
    },
    /** Log an LLM API call */
    llmCall(provider, model, usage) {
        this.debug(`LLM call: ${provider}/${model}`, 'llm-client', {
            provider,
            model,
            ...usage,
        });
    },
    /** Log an MCP external server event */
    externalMcp(serverName, event, detail) {
        const level = event === 'error' ? 'error' : 'info';
        logger[level](`External MCP ${event}: ${serverName}${detail ? ` — ${detail}` : ''}`, 'mcp-client', {
            server: serverName,
            event,
            detail,
        });
    },
};
//# sourceMappingURL=logger.js.map