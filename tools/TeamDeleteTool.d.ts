/**
 * TeamDeleteTool — delete a team and cleanup all resources.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    team_name: z.ZodString;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TeamDeleteTool: Tool<Input, boolean>;
export {};
//# sourceMappingURL=TeamDeleteTool.d.ts.map