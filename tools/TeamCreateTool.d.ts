/**
 * TeamCreateTool — create a new agent team.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { type Tool } from './types.js';
import type { TeamConfig } from '../teams/types.js';
declare const InputSchema: z.ZodObject<{
    team_name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    members: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        agent: z.ZodString;
        name: z.ZodString;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const TeamCreateTool: Tool<Input, TeamConfig>;
export {};
//# sourceMappingURL=TeamCreateTool.d.ts.map