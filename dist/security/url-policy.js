/** SSRF-resistant HTTP fetch helpers shared by all web-fetching tools. */
import { lookup } from 'dns/promises';
import { isIP } from 'net';
const MAX_REDIRECTS = 3;
function isBlockedIpv4(address) {
    const octets = address.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255))
        return true;
    const a = octets[0];
    const b = octets[1];
    return a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168);
}
function isBlockedIpv6(address) {
    const normalized = address.toLowerCase();
    return normalized === '::' || normalized === '::1'
        || normalized.startsWith('fc') || normalized.startsWith('fd')
        || normalized.startsWith('fe80:')
        || normalized.startsWith('::ffff:127.')
        || normalized.startsWith('::ffff:10.')
        || normalized.startsWith('::ffff:192.168.')
        || /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized);
}
export function validatePublicHttpUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Only http and https URLs are allowed');
    }
    if (url.username || url.password) {
        throw new Error('URLs with embedded credentials are not allowed');
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
        throw new Error('Local network URLs are not allowed');
    }
    const family = isIP(hostname);
    if ((family === 4 && isBlockedIpv4(hostname)) || (family === 6 && isBlockedIpv6(hostname))) {
        throw new Error('Private or local network URLs are not allowed');
    }
    return url;
}
async function assertPublicHost(url) {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0 || records.some((record) => (record.family === 4 && isBlockedIpv4(record.address))
        || (record.family === 6 && isBlockedIpv6(record.address)))) {
        throw new Error('Private or local network URLs are not allowed');
    }
}
/** Fetch an HTTP URL after validating every redirect target against the URL policy. */
export async function fetchPublicUrl(value, options = {}) {
    let url = validatePublicHttpUrl(value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
        for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
            await assertPublicHost(url);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: options.headers,
                redirect: 'manual',
            });
            if (![301, 302, 303, 307, 308].includes(response.status))
                return response;
            const location = response.headers.get('location');
            if (!location)
                throw new Error('Redirect response is missing a Location header');
            if (redirects === MAX_REDIRECTS)
                throw new Error('Too many redirects');
            url = validatePublicHttpUrl(new URL(location, url).toString());
        }
        throw new Error('Too many redirects');
    }
    finally {
        clearTimeout(timeout);
    }
}
/** Read a response with a hard byte limit to prevent unbounded memory consumption. */
export async function readTextBody(response, maxBytes) {
    if (!response.body)
        return '';
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error(`Response exceeds the ${maxBytes}-byte limit`);
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel();
                throw new Error(`Response exceeds the ${maxBytes}-byte limit`);
            }
            chunks.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
}
//# sourceMappingURL=url-policy.js.map