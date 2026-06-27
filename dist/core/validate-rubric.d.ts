/**
 * validate-rubric — Quality rubric data layer
 *
 * Phase 6.2: Parses `CCGS Skill Testing Framework/quality-rubric.md`
 * to extract category definitions, metric counts, and pass criteria.
 * Used by both CLI validate and AI /skill-test category.
 */
export interface RubricMetric {
    id: string;
    name: string;
    passCriteria: string;
}
export interface RubricCategory {
    name: string;
    skills: string[];
    description: string;
    metrics: RubricMetric[];
    exceptions?: string;
}
export interface RubricData {
    categories: RubricCategory[];
    categoryMap: Map<string, RubricCategory>;
}
/**
 * Parse the quality-rubric.md into structured rubric data.
 */
export declare function parseRubric(): RubricData;
/**
 * Get rubric category for a skill by name.
 * Uses the skill-to-category mapping from the rubric's **Skills** lines.
 */
export declare function getCategoryForSkill(skillName: string): RubricCategory | undefined;
/**
 * Get the metric count for a skill's category.
 */
export declare function getMetricCountForSkill(skillName: string): number;
/**
 * Get all rubric categories.
 */
export declare function getRubricCategories(): RubricCategory[];
//# sourceMappingURL=validate-rubric.d.ts.map