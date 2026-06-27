/**
 * SkillInstanceManager — singleton registry for all running skill instances.
 *
 * Provides:
 *   - create(): instantiate and start a new skill
 *   - resume(): continue a paused instance after user answer
 *   - cancel(): abort a running instance
 *   - list(): enumerate all instances with status
 *   - get(): look up a specific instance by ID
 */
import { SkillInstance, type SkillInstanceConfig, type InstanceStatus } from './instance.js';
export interface InstanceSummary {
    id: string;
    skillName: string;
    status: InstanceStatus;
    turn: number;
    createdAt: string;
    error?: string;
}
declare class SkillInstanceManager {
    private instances;
    /** Create and start a new skill instance. Returns the instance (may be running or awaiting_user). */
    create(config: SkillInstanceConfig): Promise<SkillInstance>;
    /** Resume a paused instance with the user's answer. */
    resume(id: string, answer: string): SkillInstance | undefined;
    /** Cancel a running instance. */
    cancel(id: string): boolean;
    /** Look up an instance by ID. */
    get(id: string): SkillInstance | undefined;
    /** List all instances with summaries. */
    list(): InstanceSummary[];
    /** Clean up completed/failed/cancelled instances older than the given minutes. */
    cleanup(olderThanMinutes?: number): number;
}
export declare const skillInstances: SkillInstanceManager;
export {};
//# sourceMappingURL=manager.d.ts.map