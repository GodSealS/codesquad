/**
 * 语义上下文设置 API
 *
 * GET  /api/settings/semantic-context → 读取当前配置
 * POST /api/settings/semantic-context → 更新配置（body: Partial<SemanticContextConfig>）
 *
 * Step 8 / 18 执行步骤
 */
import type http from 'http';
export declare function handleSemanticSettings(req: http.IncomingMessage, res: http.ServerResponse, method: string): Promise<void>;
//# sourceMappingURL=semantic-settings.d.ts.map