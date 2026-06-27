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
import { SkillInstance } from './instance.js';
// ── Singleton Manager ──
class SkillInstanceManager {
    instances = new Map();
    /** Create and start a new skill instance. Returns the instance (may be running or awaiting_user). */
    async create(config) {
        const instance = new SkillInstance(config);
        this.instances.set(instance.id, instance);
        try {
            await instance.execute();
        }
        catch (err) {
            // Error already captured in instance.error via _emit
            if (instance.status === 'running' || instance.status === 'idle') {
                instance.status = 'failed';
            }
        }
        return instance;
    }
    /** Resume a paused instance with the user's answer. */
    resume(id, answer) {
        const instance = this.instances.get(id);
        if (!instance || instance.status !== 'awaiting_user')
            return undefined;
        instance.resume(answer);
        // Re-execute — this continues the loop from where it paused
        void instance.execute().catch(() => {
            if (instance.status === 'running' || instance.status === 'idle') {
                instance.status = 'failed';
            }
        });
        return instance;
    }
    /** Cancel a running instance. */
    cancel(id) {
        const instance = this.instances.get(id);
        if (!instance)
            return false;
        instance.cancel();
        return true;
    }
    /** Look up an instance by ID. */
    get(id) {
        return this.instances.get(id);
    }
    /** List all instances with summaries. */
    list() {
        const summaries = [];
        for (const [, inst] of this.instances) {
            summaries.push({
                id: inst.id,
                skillName: inst.skillName,
                status: inst.status,
                turn: inst.session.messages.length,
                createdAt: inst.session.createdAt || new Date().toISOString(),
                error: inst.error?.message,
            });
        }
        return summaries;
    }
    /** Clean up completed/failed/cancelled instances older than the given minutes. */
    cleanup(olderThanMinutes = 30) {
        const now = Date.now();
        let removed = 0;
        for (const [id, inst] of this.instances) {
            if (inst.status === 'completed' || inst.status === 'failed' || inst.status === 'cancelled') {
                const created = new Date(inst.session.createdAt || 0).getTime();
                if (now - created > olderThanMinutes * 60 * 1000) {
                    this.instances.delete(id);
                    removed++;
                }
            }
        }
        return removed;
    }
}
// Export singleton
export const skillInstances = new SkillInstanceManager();
//# sourceMappingURL=manager.js.map