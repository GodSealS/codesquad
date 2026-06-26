/**
 * Setup-Engine Command
 *
 * codesquad setup-engine [engine] [version]
 * Configures the game engine and generates reference docs.
 */
import { runSetupEngine } from '../core/setup-engine-core.js';
export async function handleSetupEngine(engine, version) {
    await runSetupEngine({
        targetPath: '.',
        engine,
        version,
    });
}
//# sourceMappingURL=setup-engine.js.map