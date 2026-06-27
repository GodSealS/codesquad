/**
 * Skill routes — serves skill list/detail from SkillRegistry.
 *
 * Replaces UI's static /docs/skills.json with live registry data.
 *
 * GET /api/skills        → list all user-invocable skills
 * GET /api/skills/:name  → single skill detail
 */
import { listSkills, loadSkill, filterUserInvocable, buildSkillGuidance, getSkillDescription } from '../../repl/skill-registry.js';
function getLang(req) {
    const q = req.query.lang;
    if (q === 'en' || q === 'zh')
        return q;
    return undefined; // default to zh in getSkillDescription
}
export function registerSkillRoutes(app, config) {
    app.get('/api/skills', (req, res) => {
        try {
            const lang = getLang(req);
            const all = listSkills();
            const userSkills = filterUserInvocable(all);
            const hidden = all.filter((s) => !s.userInvocable);
            res.json({
                skills: userSkills.map((s) => ({
                    id: s.dirName,
                    name: s.name || s.dirName,
                    description: getSkillDescription(s, lang),
                    descriptionCn: s.descriptionCn || '',
                    category: s.category || 'general',
                    argumentHint: s.argumentHint,
                    agent: s.agent,
                    model: s.model,
                    userInvocable: s.userInvocable,
                })),
                count: userSkills.length,
                hiddenCount: hidden.length,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to list skills', code: 500 });
        }
    });
    app.get('/api/skills/:name', (req, res) => {
        try {
            const lang = getLang(req);
            const skill = loadSkill(String(req.params.name));
            if (!skill) {
                res.status(404).json({ error: `Skill not found: ${req.params.name}`, code: 404 });
                return;
            }
            res.json({
                id: skill.dirName,
                name: skill.name || skill.dirName,
                description: getSkillDescription(skill, lang),
                descriptionCn: skill.descriptionCn || '',
                category: skill.category || 'general',
                argumentHint: skill.argumentHint,
                agent: skill.agent,
                model: skill.model,
                userInvocable: skill.userInvocable,
                body: skill.body,
                allowedTools: skill.allowedTools,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to load skill', code: 500 });
        }
    });
    // POST /api/skills/guidance — returns the skill guidance block (for system prompt injection)
    app.post('/api/skills/guidance', (req, res) => {
        try {
            const lang = getLang(req);
            const guidance = buildSkillGuidance(8, lang);
            res.json({ guidance: guidance || '' });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to build skill guidance', code: 500 });
        }
    });
}
//# sourceMappingURL=skills.js.map