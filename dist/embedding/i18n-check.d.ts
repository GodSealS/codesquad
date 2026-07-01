/**
 * 多语言对齐检测 — embedding 检测翻译文件对齐质量
 *
 * CLI: codesquad i18n check --source en --target zh-CN
 *
 * Step 14 / 18 执行步骤
 */
export interface TranslationPair {
    sourcePath: string;
    targetPath: string;
    sourceLang: string;
    targetLang: string;
}
export interface AlignmentResult {
    pair: TranslationPair;
    similarity: number;
    status: 'ok' | 'drift' | 'missing';
    missingSections: string[];
}
/**
 * 扫描目录对并检测翻译对齐质量。
 */
export declare function checkTranslations(sourceDir: string, targetDir: string, sourceLang: string, targetLang: string): Promise<AlignmentResult[]>;
export declare function formatResults(results: AlignmentResult[]): string;
//# sourceMappingURL=i18n-check.d.ts.map