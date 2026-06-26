/**
 * Binding Manager
 *
 * Handles adding and removing AI tool bindings from a project.
 * Reads codesquad.config.yaml, modifies the tools list, and triggers regeneration.
 */
export interface BindOptions {
    targetPath: string;
}
export interface AddBindOptions extends BindOptions {
    tool: string;
}
export interface RemoveBindOptions extends BindOptions {
    tool: string;
}
/**
 * Add a tool binding to the project.
 * Regenerates agent and skill files for the newly added tool.
 */
export declare function addBinding(options: AddBindOptions): Promise<void>;
/**
 * Remove a tool binding from the project.
 * Deletes the generated tool directory and updates config.
 */
export declare function removeBinding(options: RemoveBindOptions): Promise<void>;
/** List all currently bound tools */
export declare function listBindings(options: BindOptions): Promise<void>;
//# sourceMappingURL=bindings.d.ts.map