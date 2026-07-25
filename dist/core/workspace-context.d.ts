export interface WorkspaceContext {
    projectRoot: string;
    codesquadDir: string;
}
/** Resolve and validate the workspace once at the application boundary. */
export declare function createWorkspaceContext(projectPath: string): WorkspaceContext;
//# sourceMappingURL=workspace-context.d.ts.map