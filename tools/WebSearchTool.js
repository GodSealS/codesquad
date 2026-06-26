/**
 * WebSearchTool — search the web for up-to-date information.
 *
 * Uses Brave Search API (free tier) as primary, falls back to DuckDuckGo HTML scraping.
 *
 * References:
 *   Claude Code src/tools/WebSearchTool/
 *
 * Feature 2 — P5 Vibe Coding
 */
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildTool } from './types.js';
// ── Input Schema ──
const InputSchema = z.object({
    query: z.string().min(1).max(400).describe('Search query string'),
    maxResults: z.number().min(1).max(10).optional().default(5).describe('Maximum number of results (1-10)'),
});
// ── Brave Search ──
const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1/web/search';
async function searchBrave(query, maxResults) {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey)
        throw new Error('BRAVE_API_KEY not set');
    const url = `${BRAVE_API_BASE}?q=${encodeURIComponent(query)}&count=${maxResults}`;
    const response = await fetchWithTimeout(url, {
        headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
        },
    });
    if (!response.ok)
        throw new Error(`Brave API returned ${response.status}`);
    const data = (await response.json());
    return (data.web?.results || []).slice(0, maxResults).map((r) => ({
        title: r.title || 'Untitled',
        url: r.url,
        snippet: r.description || '',
    }));
}
// ── DuckDuckGo fallbacks ──
const DDG_MOBILE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 12_000; // 12s timeout for web search
function getSearchProvider() {
    return (process.env.SEARCH_PROVIDER || 'auto').toLowerCase();
}
async function fetchWithTimeout(url, init, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        return response;
    }
    finally {
        clearTimeout(timer);
    }
}
/** Parse HTML for HTTP links — shared across DDG variants. */
function extractLinksFromHtml(html, maxCount) {
    // Title patterns (DDG regular + Lite)
    const titlePatterns = [
        /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi,
        /<a[^>]*class="result-link"[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi, // Lite variant
        /<h2[^>]*class="result__title"[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi,
    ];
    let links = [];
    for (const pattern of titlePatterns) {
        let m;
        while ((m = pattern.exec(html)) !== null) {
            const url = m[1];
            const title = m[m.length - 1].replace(/<[^>]+>/g, '').trim();
            if (url && url.startsWith('http') && !url.includes('duckduckgo.com')) {
                links.push({ url, title: title || 'Untitled' });
            }
        }
        if (links.length > 0)
            break;
    }
    // Generic fallback
    if (links.length === 0) {
        const genericRegex = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi;
        let m;
        while ((m = genericRegex.exec(html)) !== null) {
            const url = m[1];
            const title = m[2].replace(/<[^>]+>/g, '').trim();
            if (title && !url.includes('duckduckgo.com') && !url.includes('localhost')) {
                links.push({ url, title });
            }
        }
    }
    return links.slice(0, maxCount);
}
/** DuckDuckGo HTML (regular) — https://html.duckduckgo.com */
async function searchDuckDuckGo(query, maxResults) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    let response;
    try {
        response = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': DDG_MOBILE_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`DuckDuckGo timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
        }
        throw new Error(`DuckDuckGo unreachable: ${err.message || 'network error'}`);
    }
    if (!response.ok)
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
    const html = await response.text();
    const links = extractLinksFromHtml(html, maxResults);
    const results = [];
    for (let i = 0; i < links.length; i++) {
        results.push({ title: links[i]?.title || 'Untitled', url: links[i]?.url || '', snippet: '' });
    }
    return results;
}
/** DuckDuckGo Lite — https://lite.duckduckgo.com (minimal HTML, less likely blocked) */
async function searchDuckDuckGoLite(query, maxResults) {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    let response;
    try {
        response = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': DDG_MOBILE_UA,
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
    }
    catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`DuckDuckGo Lite timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
        }
        throw new Error(`DuckDuckGo Lite unreachable: ${err.message || 'network error'}`);
    }
    if (!response.ok)
        throw new Error(`DuckDuckGo Lite returned HTTP ${response.status}`);
    const html = await response.text();
    const links = extractLinksFromHtml(html, maxResults);
    const results = [];
    for (let i = 0; i < links.length; i++) {
        results.push({ title: links[i]?.title || 'Untitled', url: links[i]?.url || '', snippet: '' });
    }
    return results;
}
// ── Tool ──
export const WebSearchTool = buildTool({
    name: 'WebSearch',
    description: 'Search the web for current information, documentation, and references.',
    searchHint: 'search web internet google',
    inputSchema: InputSchema,
    prompt() {
        return `Searches the web for up-to-date information.

Parameters:
- query: Search query string (max 400 chars)
- maxResults: Max results to return (1-10, default 5)

Returns: Array of {title, url, snippet} for each result.

Use this tool when you need:
- Latest API documentation
- Current best practices
- Solutions to technical problems (StackOverflow, GitHub Issues)
- Information beyond your training data cutoff

After searching, use WebFetch to retrieve full content from interesting URLs.`;
    },
    descriptionFor(input) {
        return `Search web: "${input.query.slice(0, 60)}${input.query.length > 60 ? '...' : ''}"`;
    },
    isEnabled() { return true; },
    isReadOnly() { return true; },
    isConcurrencySafe() { return true; },
    isDestructive() { return false; },
    validateInput(input, _ctx) {
        if (!input.query.trim())
            return { valid: false, message: 'Search query is required' };
        if (input.maxResults < 1 || input.maxResults > 10) {
            return { valid: false, message: 'maxResults must be 1-10' };
        }
        return { valid: true };
    },
    checkPermissions() { return { behavior: 'allow' }; },
    async call(input, _context) {
        const toolCallId = randomUUID();
        const provider = getSearchProvider();
        try {
            let results;
            let usedEngine = '';
            if (provider === 'brave') {
                // Brave only
                try {
                    results = await searchBrave(input.query, input.maxResults);
                    usedEngine = 'Brave';
                }
                catch (err) {
                    return {
                        toolCallId,
                        output: [],
                        content: `❌ Brave Search failed: ${err.message}\n\nSet BRAVE_API_KEY in .env file, or switch to duckduckgo in Settings → Search Provider.`,
                        isError: true,
                    };
                }
            }
            else if (provider === 'duckduckgo') {
                // DuckDuckGo only — try regular first, then Lite
                try {
                    results = await searchDuckDuckGo(input.query, input.maxResults);
                    usedEngine = 'DuckDuckGo';
                }
                catch (ddgErr) {
                    try {
                        results = await searchDuckDuckGoLite(input.query, input.maxResults);
                        usedEngine = 'DuckDuckGo Lite';
                    }
                    catch (liteErr) {
                        return {
                            toolCallId,
                            output: [],
                            content: `❌ DuckDuckGo search unavailable.\n\n` +
                                `Regular: ${ddgErr.message}\n` +
                                `Lite: ${liteErr.message}\n\n` +
                                `Switch to Brave in Settings → Search Provider (requires BRAVE_API_KEY).`,
                            isError: true,
                        };
                    }
                }
            }
            else {
                // 'auto' (default): try Brave → DDG regular → DDG Lite
                const errors = [];
                try {
                    results = await searchBrave(input.query, input.maxResults);
                    usedEngine = 'Brave';
                }
                catch (braveErr) {
                    errors.push(`Brave: ${braveErr.message}`);
                    try {
                        results = await searchDuckDuckGo(input.query, input.maxResults);
                        usedEngine = 'DuckDuckGo';
                    }
                    catch (ddgErr) {
                        errors.push(`DuckDuckGo: ${ddgErr.message}`);
                        try {
                            results = await searchDuckDuckGoLite(input.query, input.maxResults);
                            usedEngine = 'DuckDuckGo Lite';
                        }
                        catch (liteErr) {
                            errors.push(`DuckDuckGo Lite: ${liteErr.message}`);
                            return {
                                toolCallId,
                                output: [],
                                content: `❌ All search providers failed:\n${errors.map(e => `  - ${e}`).join('\n')}\n\n` +
                                    `Set BRAVE_API_KEY for Brave, or check network access to duckduckgo.com.`,
                                isError: true,
                            };
                        }
                    }
                }
            }
            if (results.length === 0) {
                return {
                    toolCallId,
                    output: [],
                    content: `🔍 No results found for: "${input.query}"`,
                };
            }
            const footer = usedEngine !== 'Brave'
                ? `\n_🔎 Searched via ${usedEngine} (free, no API key). Set SEARCH_PROVIDER=brave + BRAVE_API_KEY for better results._`
                : '';
            const content = [
                `🔍 Search results for: "${input.query}"`,
                '',
                ...results.map((r, i) => `**${i + 1}. ${r.title}**\n` +
                    `   URL: ${r.url}\n` +
                    `   ${r.snippet.slice(0, 300)}`),
                footer,
            ].filter(Boolean).join('\n');
            return { toolCallId, output: results, content };
        }
        catch (err) {
            return {
                toolCallId,
                output: [],
                content: `❌ Unexpected search error: ${err.message}`,
                isError: true,
            };
        }
    },
    maxResultSizeChars: 5000,
});
//# sourceMappingURL=WebSearchTool.js.map