/**
 * 多语言对齐检测 — embedding 检测翻译文件对齐质量
 *
 * CLI: codesquad i18n check --source en --target zh-CN
 *
 * Step 14 / 18 执行步骤
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { getEmbeddingProvider } from './provider.js';
import { cosineSimilarity } from './store.js';
// ── 主入口 ──
/**
 * 扫描目录对并检测翻译对齐质量。
 */
export async function checkTranslations(sourceDir, targetDir, sourceLang, targetLang) {
    const provider = await getEmbeddingProvider();
    if (!provider) {
        throw new Error('[i18n-check] no embedding provider available');
    }
    const pairs = findTranslationPairs(sourceDir, targetDir, sourceLang, targetLang);
    const results = [];
    for (const pair of pairs) {
        try {
            const sourceContent = readFileSync(pair.sourcePath, 'utf-8');
            const targetContent = readFileSync(pair.targetPath, 'utf-8');
            // 计算整体相似度
            const sourceEmb = await provider.embed(sourceContent.slice(0, 2000));
            const targetEmb = await provider.embed(targetContent.slice(0, 2000));
            const similarity = cosineSimilarity(sourceEmb, targetEmb);
            // 检查缺失章节
            const missingSections = findMissingSections(sourceContent, targetContent);
            let status;
            if (similarity >= 0.85) {
                status = 'ok';
            }
            else if (similarity >= 0.6) {
                status = 'drift';
            }
            else {
                status = 'missing';
            }
            results.push({
                pair,
                similarity,
                status,
                missingSections,
            });
        }
        catch (e) {
            console.warn(`[i18n-check] failed for ${pair.sourcePath}: ${e.message}`);
        }
    }
    // 按相似度排序（差的排前面）
    results.sort((a, b) => a.similarity - b.similarity);
    return results;
}
// ── 格式化输出 ──
export function formatResults(results) {
    if (results.length === 0)
        return 'No translation files found.';
    const lines = [];
    let okCount = 0;
    let driftCount = 0;
    let missingCount = 0;
    for (const r of results) {
        const icon = r.status === 'ok' ? '✅' : r.status === 'drift' ? '⚠️' : '❌';
        const percent = (r.similarity * 100).toFixed(0);
        const sourceName = basename(r.pair.sourcePath);
        const targetName = basename(r.pair.targetPath);
        lines.push(`${icon} ${r.pair.sourceLang}/${sourceName} → ${r.pair.targetLang}/${targetName}: ${r.status.toUpperCase()} (${percent}%)`);
        if (r.missingSections.length > 0) {
            for (const section of r.missingSections) {
                lines.push(`   Missing section: "${section}"`);
            }
        }
        if (r.status === 'ok')
            okCount++;
        else if (r.status === 'drift')
            driftCount++;
        else
            missingCount++;
    }
    lines.push('');
    lines.push(`Summary: ${okCount} OK, ${driftCount} drift, ${missingCount} missing`);
    return lines.join('\n');
}
// ── 内部 ──
function findTranslationPairs(sourceDir, targetDir, sourceLang, targetLang) {
    const pairs = [];
    if (!existsSync(sourceDir) || !existsSync(targetDir))
        return pairs;
    const sourceFiles = listMarkdownFiles(sourceDir);
    for (const sourceFile of sourceFiles) {
        const relPath = sourceFile.slice(sourceDir.length + 1);
        const targetPath = join(targetDir, relPath);
        if (existsSync(targetPath)) {
            pairs.push({
                sourcePath: sourceFile,
                targetPath,
                sourceLang,
                targetLang,
            });
        }
    }
    return pairs;
}
function listMarkdownFiles(dir) {
    const results = [];
    try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                results.push(...listMarkdownFiles(fullPath));
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                results.push(fullPath);
            }
        }
    }
    catch {
        // 目录不存在或无权限
    }
    return results;
}
/**
 * 检测目标文件中缺失的源文件章节。
 * 通过匹配 Markdown 标题来检测。
 */
function findMissingSections(sourceContent, targetContent) {
    const sourceHeadings = extractHeadings(sourceContent);
    const targetHeadings = new Set(extractHeadings(targetContent));
    return sourceHeadings.filter(h => !targetHeadings.has(h));
}
function extractHeadings(content) {
    const headings = [];
    const headingRegex = /^#{1,3}\s+(.+)$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
        headings.push(match[1].trim());
    }
    return headings;
}
//# sourceMappingURL=i18n-check.js.map