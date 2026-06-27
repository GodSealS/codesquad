/**
 * register command — External CLI registration into AICore/ (user-level).
 *
 * Commands:
 *   codesquad register agent|skill|rule|hook <path> [--source <name>]
 *   codesquad register list [agent|skill|rule|hook]
 *   codesquad register unregister agent|skill|rule|hook <name>
 */
export declare function handleRegister(action: string, args: string[], options?: {
    source?: string;
}): Promise<void>;
//# sourceMappingURL=register.d.ts.map