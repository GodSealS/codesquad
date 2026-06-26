/**
 * SendMessageTool — send messages between team members.
 *
 * Feature 3 — P4 Team Collaboration
 */
import { z } from 'zod';
import { type Tool } from './types.js';
declare const InputSchema: z.ZodObject<{
    type: z.ZodEnum<{
        message: "message";
        broadcast: "broadcast";
        shutdown_request: "shutdown_request";
        shutdown_response: "shutdown_response";
    }>;
    recipient: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    summary: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type Input = z.infer<typeof InputSchema>;
export declare const SendMessageTool: Tool<Input, any>;
export {};
//# sourceMappingURL=SendMessageTool.d.ts.map