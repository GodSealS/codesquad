/** SSRF-resistant HTTP fetch helpers shared by all web-fetching tools. */
export declare function validatePublicHttpUrl(value: string): URL;
export interface SafeFetchOptions {
    timeoutMs?: number;
    headers?: Record<string, string>;
}
/** Fetch an HTTP URL after validating every redirect target against the URL policy. */
export declare function fetchPublicUrl(value: string, options?: SafeFetchOptions): Promise<Response>;
/** Read a response with a hard byte limit to prevent unbounded memory consumption. */
export declare function readTextBody(response: Response, maxBytes: number): Promise<string>;
//# sourceMappingURL=url-policy.d.ts.map