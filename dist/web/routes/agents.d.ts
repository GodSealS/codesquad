/**
 * Agents & Skills API — list, detail, search.
 * Scans three layers: Project (.codesquad/) > User (~/.codesquad/) > .codesquad/
 *
 * .codesquad layer uses VirtualFS so it works both from embedded binary and disk.
 */
import type http from 'http';
export declare function handleAgents(req: http.IncomingMessage, res: http.ServerResponse, _services: unknown, path: string): Promise<void>;
export declare function handleSkills(req: http.IncomingMessage, res: http.ServerResponse, _services: unknown, path: string): Promise<void>;
//# sourceMappingURL=agents.d.ts.map