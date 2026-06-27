/**
 * OS Keyring integration for secure API key storage.
 *
 * Uses Windows Credential Manager, macOS Keychain, or Linux libsecret.
 * Falls back gracefully when keytar is unavailable.
 * Phase 1.4 — Step 1.4.3.
 */
import { successResult, errorResult } from '../core/task-result.js';
const SERVICE_NAME = 'codesquad-cli';
let keytarModule = null;
async function getKeytar() {
    if (keytarModule)
        return keytarModule;
    try {
        keytarModule = await import('keytar');
        return keytarModule;
    }
    catch {
        return null;
    }
}
/**
 * Check if OS keyring is available on this platform.
 */
export async function isKeyringAvailable() {
    const keytar = await getKeytar();
    return keytar !== null;
}
/**
 * Store an API key in the OS keyring.
 */
export async function storeKey(providerId, apiKey) {
    const keytar = await getKeytar();
    if (!keytar) {
        throw new Error('OS Keyring 不可用。请设置环境变量替代：export CODESQUAD_API_KEY=...');
    }
    await keytar.setPassword(SERVICE_NAME, providerId, apiKey);
}
/**
 * Retrieve an API key from the OS keyring.
 */
export async function getKey(providerId) {
    const keytar = await getKeytar();
    if (!keytar)
        return null;
    try {
        return await keytar.getPassword(SERVICE_NAME, providerId);
    }
    catch {
        return null;
    }
}
/**
 * Delete an API key from the OS keyring.
 */
export async function deleteKey(providerId) {
    const keytar = await getKeytar();
    if (!keytar)
        return;
    try {
        await keytar.deletePassword(SERVICE_NAME, providerId);
    }
    catch {
        // Ignore errors on delete
    }
}
// ── P3: TaskResult-wrapped versions ──
/**
 * Store an API key and return a TaskResult instead of throwing.
 * Use this for new code; original storeKey() remains for backward compat.
 */
export async function storeKeyWithResult(providerId, apiKey) {
    const startMs = Date.now();
    try {
        await storeKey(providerId, apiKey);
        return successResult(null, { taskId: providerId, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId: providerId,
            errorCode: 'AUTH_FAILED',
            message: err.message,
            durationMs: Date.now() - startMs,
        });
    }
}
/**
 * Delete an API key and return a TaskResult.
 * Use this for new code; original deleteKey() remains for backward compat.
 */
export async function deleteKeyWithResult(providerId) {
    const startMs = Date.now();
    try {
        await deleteKey(providerId);
        return successResult(null, { taskId: providerId, durationMs: Date.now() - startMs });
    }
    catch (err) {
        return errorResult({
            taskId: providerId,
            errorCode: 'AUTH_FAILED',
            message: `Failed to delete key: ${err.message}`,
            durationMs: Date.now() - startMs,
        });
    }
}
//# sourceMappingURL=keyring.js.map