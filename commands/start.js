/**
 * Start Command
 *
 * codesquad start --ci
 * Guided onboarding wizard — detects project state and sets up config.
 */
import { runStart } from '../core/start-core.js';
export async function handleStart(targetPath, options) {
    await runStart({
        targetPath: targetPath ?? '.',
        ci: options?.ci ?? false,
    });
}
//# sourceMappingURL=start.js.map