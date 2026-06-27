/**
 * API Key serialization guard.
 *
 * Runtime types include apiKey; persisted types strip it.
 * Prevents accidental key leakage into ~/.codesquad/ or session files.
 * Phase 1.4 — Step 1.4.5.
 */
import type { RuntimeProviderConfig } from './provider.js';
/** Config shape safe for serialization — no apiKey field. */
export type PersistedProviderConfig = Omit<RuntimeProviderConfig, 'apiKey'>;
export type WithApiKey = Required<Pick<RuntimeProviderConfig, 'apiKey'>>;
export type WithoutApiKey<T> = Omit<T, 'apiKey'>;
/**
 * Strip the apiKey field before serialization.
 * Call this before writing any config to disk.
 */
export declare function stripApiKey<T extends {
    apiKey?: string;
}>(config: T): WithoutApiKey<T>;
/**
 * Validate that a serialized object does NOT contain sensitive fields.
 * Returns an array of field names that should not be present.
 */
export declare function findSensitiveFields(obj: unknown): string[];
//# sourceMappingURL=config.d.ts.map