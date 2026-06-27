/**
 * Prompt Sandbox — User Content Boundary Wrapping
 *
 * Ensures that user-provided content (context, GDD, code) is cleanly separated
 * from agent prompt templates. Prevents:
 *   - Prompt injection ("ignore previous instructions...")
 *   - Context hijacking via malformed GDD content
 *   - Accidental instruction leakage
 *
 * Strategy:
 *   - Wrap user content in explicit XML boundary markers
 *   - Truncate oversized content with warning
 *   - Sanitize known injection patterns
 */
import { logger } from '../observability/logger.js';
/** Safe content size limits (approximate chars) */
const LIMITS = {
    /** Maximum chars for a single gdd field */
    GDD_MAX_CHARS: 200_000,
    /** Maximum chars for a single code field */
    CODE_MAX_CHARS: 100_000,
    /** Maximum chars for context references combined */
    REFERENCES_MAX_CHARS: 50_000,
    /** Maximum chars for user input */
    USER_INPUT_MAX_CHARS: 10_000,
};
/** Injection patterns to detect and warn about */
const INJECTION_PATTERNS = [
    /ignore (all |previous |above )?instructions/i,
    /you are now/i,
    /system prompt:/i,
    /\[SYSTEM\]/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /forget everything/i,
    /pretend you are/i,
    /new personality:/i,
    /override safety/i,
    /ignore content policy/i,
];
/** Wrapper tags for user content boundaries */
const BOUNDARY_TAGS = {
    gdd: { open: '<user_context type="gdd">', close: '</user_context>' },
    code: { open: '<user_context type="code">', close: '</user_context>' },
    references: { open: '<user_context type="references">', close: '</user_context>' },
    input: { open: '<user_input>', close: '</user_input>' },
    history: { open: '<conversation_history>', close: '</conversation_history>' },
};
/**
 * Scan content for potential prompt injection patterns.
 * Returns detection results; does not block — only warns.
 *
 * @param content - User-provided content to scan
 * @param source  - Description of content source (for log)
 * @returns Array of matched pattern descriptions
 */
export function detectInjection(content, source) {
    const detections = [];
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(content)) {
            const match = content.match(pattern);
            const snippet = match ? match[0] : pattern.source;
            const detection = `Injection pattern detected in ${source}: "${snippet}"`;
            detections.push(detection);
            logger.warn(detection, 'prompt-sandbox', { source, pattern: pattern.source });
        }
    }
    return detections;
}
/**
 * Wrap content in a structured boundary tag.
 * This separates user content from agent prompt instructions,
 * making it harder for injected content to influence the LLM.
 *
 * @param content   - The raw user content
 * @param boundary  - The boundary tag definition (open/close)
 * @returns Wrapped content string
 */
export function wrapContent(content, boundary) {
    return `\n${boundary.open}\n${content}\n${boundary.close}\n`;
}
/**
 * Truncate oversized content with a warning.
 *
 * @param content   - The content to truncate
 * @param maxChars  - Maximum character limit
 * @param label     - Label for truncation warning
 * @returns Truncated content (or original if within limit) with warning prefix if truncated
 */
export function truncateContent(content, maxChars, label) {
    if (content.length <= maxChars)
        return content;
    const truncated = content.slice(0, maxChars);
    const warning = `\n[WARNING: ${label} content truncated from ${content.length.toLocaleString()} to ${maxChars.toLocaleString()} characters]\n`;
    logger.warn(`Content truncated: ${label}`, 'prompt-sandbox', {
        originalSize: content.length,
        maxSize: maxChars,
    });
    return warning + truncated;
}
/**
 * Sandbox the complete set of user-provided context for an agent invocation.
 *
 * This is the main entry point. It:
 *   1. Scans for injection patterns
 *   2. Truncates oversized content
 *   3. Wraps all content in boundary markers
 *
 * @param context - The raw context from the caller
 * @returns Sanitized, wrapped context ready for prompt injection
 */
export function sandboxAgentContext(context) {
    const warnings = [];
    const result = { warnings };
    // Sanitize and wrap GDD
    if (context.gdd) {
        const detections = detectInjection(context.gdd, 'GDD context');
        warnings.push(...detections);
        const truncated = truncateContent(context.gdd, LIMITS.GDD_MAX_CHARS, 'GDD');
        result.gdd = wrapContent(truncated, BOUNDARY_TAGS.gdd);
    }
    // Sanitize and wrap code
    if (context.code) {
        const detections = detectInjection(context.code, 'code context');
        warnings.push(...detections);
        const truncated = truncateContent(context.code, LIMITS.CODE_MAX_CHARS, 'Code');
        result.code = wrapContent(truncated, BOUNDARY_TAGS.code);
    }
    // Sanitize and wrap references
    if (context.references && context.references.length > 0) {
        const refText = context.references.join('\n---\n');
        const detections = detectInjection(refText, 'references');
        warnings.push(...detections);
        const truncated = truncateContent(refText, LIMITS.REFERENCES_MAX_CHARS, 'References');
        result.references = wrapContent(truncated, BOUNDARY_TAGS.references);
    }
    // Sanitize and wrap user input
    if (context.input) {
        const detections = detectInjection(context.input, 'user input');
        warnings.push(...detections);
        const truncated = truncateContent(context.input, LIMITS.USER_INPUT_MAX_CHARS, 'User input');
        result.input = wrapContent(truncated, BOUNDARY_TAGS.input);
    }
    // Wrap conversation history (no injection scan — history is trusted)
    if (context.history) {
        result.history = wrapContent(context.history, BOUNDARY_TAGS.history);
    }
    if (warnings.length > 0) {
        logger.warn(`${warnings.length} injection warning(s) detected in agent context`, 'prompt-sandbox', { warningCount: warnings.length });
    }
    return result;
}
/**
 * Lightweight sandbox for skill invocations (no tool calls, simpler context).
 */
export function sandboxSkillContext(args) {
    const warnings = [];
    const result = { warnings };
    if (args.arguments) {
        const detections = detectInjection(args.arguments, 'skill arguments');
        warnings.push(...detections);
        const truncated = truncateContent(args.arguments, LIMITS.USER_INPUT_MAX_CHARS, 'Skill arguments');
        result.input = wrapContent(truncated, BOUNDARY_TAGS.input);
    }
    if (args.gdd) {
        const truncated = truncateContent(args.gdd, LIMITS.GDD_MAX_CHARS, 'GDD');
        result.gdd = wrapContent(truncated, BOUNDARY_TAGS.gdd);
    }
    if (args.code) {
        const truncated = truncateContent(args.code, LIMITS.CODE_MAX_CHARS, 'Code');
        result.code = wrapContent(truncated, BOUNDARY_TAGS.code);
    }
    return result;
}
//# sourceMappingURL=prompt-sandbox.js.map