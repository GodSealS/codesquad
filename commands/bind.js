/**
 * Bind Command
 *
 * codesquad bind --add <tool> | --remove <tool> | --list
 * Manages AI tool bindings (add/remove AI tools to/from project).
 */
import { addBinding, removeBinding, listBindings } from '../core/bindings.js';
export async function handleBind(targetPath, options) {
    if (options.add) {
        await addBinding({ targetPath, tool: options.add });
    }
    else if (options.remove) {
        await removeBinding({ targetPath, tool: options.remove });
    }
    else {
        // Default: list
        await listBindings({ targetPath });
    }
}
//# sourceMappingURL=bind.js.map