/**
 * Bind Command
 *
 * codesquad bind --add <tool> | --remove <tool> | --list
 * Manages AI tool bindings (add/remove AI tools to/from project).
 */
export interface BindCommandOptions {
    add?: string;
    remove?: string;
    list?: boolean;
}
export declare function handleBind(targetPath: string, options: BindCommandOptions): Promise<void>;
//# sourceMappingURL=bind.d.ts.map