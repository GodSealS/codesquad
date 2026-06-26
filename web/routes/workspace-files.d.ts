/**
 * Workspace files API — manage .codesquad/ directory per workspace.
 *
 * POST /api/workspace/init         → run codesquad init at workspace path
 * GET  /api/workspace/sessions?ws= → load sessions from project .codesquad/sessions-{ws}.json
 * POST /api/workspace/sessions?ws= → save sessions to project .codesquad/sessions-{ws}.json
 */
import type http from 'http';
export declare function handleWorkspaceFiles(req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}, reqPath: string, method: string): Promise<void>;
//# sourceMappingURL=workspace-files.d.ts.map