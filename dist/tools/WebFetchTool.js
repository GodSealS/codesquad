/**
 * WebFetchTool — fetch and extract text content from a URL.
 *
 * Downloads the HTML page and extracts readable text content.
 * Does not execute JavaScript.
 *
 * References:
 *   Claude Code src/tools/WebFetchTool/
 *
 * Feature 2 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
import { fetchPublicUrl, readTextBody, validatePublicHttpUrl } from '../security/url-policy.js';
// ── Input Schema ──
const InputSchema = z.object({
    url: z.string().url().describe('URL to fetch content from'),
    maxChars: z.number().min(500).max(50000).optional().default(10000).describe('Maximum characters to return'),
    extractMode: z.enum(['auto', 'text', 'markdown']).optional().default('auto').describe('Content extraction mode'),
});
// ── HTML to text extraction ──
/**
 * Extract readable text from HTML without external dependencies.
 * Removes scripts, styles, and excessive whitespace.
 */
function htmlToText(html, maxChars) {
    // Remove script and style elements
    let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '');
    // Extract title
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';
    // Replace block elements with newlines
    text = text
        .replace(/<\/?(?:div|p|h[1-6]|section|article|header|footer|nav|main|aside|li|tr)[^>]*>/gi, '\n');
    // Replace br with newline
    text = text.replace(/<br\s*\/?>/gi, '\n');
    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
    // Collapse whitespace
    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^\s+$/gm, '');
    // Prepend title
    const header = title ? `# ${title}\n\n` : '';
    // Truncate
    const result = header + text.trim();
    if (result.length > maxChars) {
        return result.slice(0, maxChars) +
            `\n\n... (truncated to ${maxChars} chars, original: ${text.length} chars)`;
    }
    return result;
}
// ── Tool ──
export const WebFetchTool = buildTool({
    name: 'WebFetch',
    description: 'Fetch and extract readable text content from a URL.',
    searchHint: 'fetch url web page download',
    inputSchema: InputSchema,
    prompt() {
        return `Fetches content from a URL and extracts readable text.

Parameters:
- url: Full URL to fetch (must be http/https)
- maxChars: Maximum characters to return (500-50000, default 10000)
- extractMode: 'auto' (default), 'text', or 'markdown'

Use this tool after WebSearch to read full content from interesting search results.
It strips HTML tags, scripts, and styles, returning clean text.
Does NOT execute JavaScript.`;
    },
    descriptionFor(input) {
        const domain = new URL(input.url).hostname;
        return `Fetch: ${domain}${input.url.length > 50 ? '...' : ''}`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        try {
            validatePublicHttpUrl(input.url);
        }
        catch {
            return { valid: false, message: 'Invalid URL format' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const toolCallId = randomUUID();
        try {
            const response = await fetchPublicUrl(input.url, {
                timeoutMs: 15_000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'none',
                },
            });
            if (!response.ok) {
                const hints = {
                    403: 'The server blocked this request (anti-bot protection). Try using WebSearch to find a cached/alternative source.',
                    404: 'Page not found. The URL may have changed or been removed.',
                    429: 'Rate limited. Wait a moment before retrying.',
                };
                const hint = hints[response.status] || '';
                return {
                    toolCallId,
                    output: '',
                    content: `❌ HTTP ${response.status}: ${response.statusText}${hint ? '\n' + hint : ''}`,
                    isError: true,
                };
            }
            const contentType = response.headers.get('content-type') || '';
            if (!/^(text\/|application\/(?:json|xml|xhtml\+xml))/i.test(contentType)) {
                return { toolCallId, output: '', content: `❌ Unsupported content type: ${contentType || 'unknown'}`, isError: true };
            }
            // For plain text, return directly
            if (contentType.includes('text/plain')) {
                const text = await readTextBody(response, 1_000_000);
                const truncated = text.length > input.maxChars
                    ? text.slice(0, input.maxChars) + `\n\n... (truncated, original: ${text.length} chars)`
                    : text;
                return { toolCallId, output: truncated, content: truncated };
            }
            // For HTML (most common), extract readable text
            const html = await readTextBody(response, 1_000_000);
            const text = htmlToText(html, input.maxChars);
            const urlInfo = `📄 Fetched: ${input.url}\nContent-Type: ${contentType}\n\n`;
            return { toolCallId, output: text, content: urlInfo + text };
        }
        catch (err) {
            const msg = err.name === 'AbortError'
                ? '❌ Request timed out (15s)'
                : `❌ Fetch failed: ${err.message}`;
            return { toolCallId, output: '', content: msg, isError: true };
        }
    },
    maxResultSizeChars: 50000,
});
//# sourceMappingURL=WebFetchTool.js.map