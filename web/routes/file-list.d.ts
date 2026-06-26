/**
 * File list API — serve directory tree for FileExplorer
 *
 * GET /api/files/list?dir=/absolute/path → JSON tree
 */
import type http from 'http';
export declare function handleFileList(req: http.IncomingMessage, res: http.ServerResponse, services: {
    projectRoot: string;
}): Promise<void>;
//# sourceMappingURL=file-list.d.ts.map