/**
 * OS Keyring integration for secure API key storage.
 *
 * Uses Windows Credential Manager, macOS Keychain, or Linux libsecret.
 * Falls back gracefully when keytar is unavailable.
 * Phase 1.4 — Step 1.4.3.
 */
import type { TaskResult } from '../core/task-result.js';
/**
 * Check if OS keyring is available on this platform.
 */
export declare function isKeyringAvailable(): Promise<boolean>;
/**
 * Store an API key in the OS keyring.
 */
export declare function storeKey(providerId: string, apiKey: string): Promise<void>;
/**
 * Retrieve an API key from the OS keyring.
 */
export declare function getKey(providerId: string): Promise<string | null>;
/**
 * Delete an API key from the OS keyring.
 */
export declare function deleteKey(providerId: string): Promise<void>;
/**
 * Store an API key and return a TaskResult instead of throwing.
 * Use this for new code; original storeKey() remains for backward compat.
 */
export declare function storeKeyWithResult(providerId: string, apiKey: string): Promise<TaskResult<null>>;
/**
 * Delete an API key and return a TaskResult.
 * Use this for new code; original deleteKey() remains for backward compat.
 */
export declare function deleteKeyWithResult(providerId: string): Promise<TaskResult<null>>;
//# sourceMappingURL=keyring.d.ts.map