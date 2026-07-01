/**
 * 代码分块器 — 分层 chunking for embedding
 *
 * 支持三种分块策略：
 * 1. tree-sitter (TypeScript/Python) — AST 感知，不切断函数体
 * 2. 正则 (Shell/Bash) — 函数名匹配
 * 3. key-split (YAML/JSON/Markdown) — 按顶级键分割
 *
 * Step 10 / 18 执行步骤
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';
const DEFAULT_OPTIONS = {
    maxLines: 50,
    maxChars: 2000,
    minLines: 3,
};
// ── 文件扩展名 → 分块策略 ──
const TREE_SITTER_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.pyi']);
const REGEX_EXTENSIONS = new Set(['.sh', '.bash', '.zsh', '.fish']);
const KEY_SPLIT_EXTENSIONS = new Set(['.yaml', '.yml', '.json', '.md', '.mdx']);
const SUPPORTED_EXTENSIONS = new Set([
    ...TREE_SITTER_EXTENSIONS,
    ...REGEX_EXTENSIONS,
    ...KEY_SPLIT_EXTENSIONS,
    '.css', '.html', '.sql', '.graphql', '.proto', '.toml',
]);
// ── 忽略目录 ──
const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
    '.codebuddy', '.codesquad', 'coverage', 'UI',
]);
// ── 主入口 ──
/**
 * 扫描目录并分块所有支持的文件。
 */
export function scanAndChunk(rootDir, options) {
    const chunks = [];
    scanDir(rootDir, rootDir, chunks, options);
    return chunks;
}
function scanDir(rootDir, currentDir, chunks, options) {
    let entries;
    try {
        entries = readdirSync(currentDir);
    }
    catch {
        return;
    }
    for (const entry of entries) {
        const fullPath = join(currentDir, entry);
        try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                if (!IGNORE_DIRS.has(entry) && !entry.startsWith('.')) {
                    // 限制深度为 5 层
                    const depth = relative(rootDir, fullPath).split(/[\\/]/).length;
                    if (depth <= 5) {
                        scanDir(rootDir, fullPath, chunks, options);
                    }
                }
            }
            else if (stat.isFile()) {
                const ext = extname(entry).toLowerCase();
                if (SUPPORTED_EXTENSIONS.has(ext)) {
                    try {
                        const fileChunks = chunkFile(fullPath, rootDir, options);
                        chunks.push(...fileChunks);
                    }
                    catch {
                        // 跳过不可读文件
                    }
                }
            }
        }
        catch {
            // 跳过不可访问路径
        }
    }
}
/**
 * 对单个文件分块。
 */
export function chunkFile(filePath, rootDir, options) {
    const content = readFileSync(filePath, 'utf-8');
    if (!content.trim())
        return [];
    const ext = extname(filePath).toLowerCase();
    const relativePath = relative(rootDir, filePath);
    const opts = { ...DEFAULT_OPTIONS, ...options };
    if (TREE_SITTER_EXTENSIONS.has(ext)) {
        return treeSitterChunk(content, relativePath, opts);
    }
    if (REGEX_EXTENSIONS.has(ext)) {
        return regexChunk(content, relativePath, opts);
    }
    if (KEY_SPLIT_EXTENSIONS.has(ext)) {
        return keySplitChunk(content, relativePath, opts);
    }
    // 默认：按行数分块
    return lineChunk(content, relativePath, opts);
}
// ── 分块策略 ──
/**
 * Tree-sitter 风格分块（暂用启发式实现，避免 native 依赖）。
 *
 * 策略：
 * 1. 按函数/类定义边界分块（正则匹配 `function`/`class`/`def`）
 * 2. 每个 chunk 不超过 maxLines 行
 * 3. 大函数自动拆分（按逻辑块）
 */
function treeSitterChunk(content, filePath, opts) {
    const lines = content.split('\n');
    // 检测函数/类边界
    const boundaries = findFunctionBoundaries(lines);
    if (boundaries.length === 0) {
        return lineChunk(content, filePath, opts);
    }
    const chunks = [];
    let chunkStart = 0;
    for (let i = 0; i < boundaries.length; i++) {
        const boundary = boundaries[i];
        const nextBoundary = boundaries[i + 1];
        // 如果当前函数太大，在内部按 maxLines 拆分
        if (boundary.line - chunkStart > opts.maxLines) {
            // 先输出之前的累积
            if (chunkStart < boundary.line) {
                chunks.push(makeChunk(filePath, chunkStart + 1, boundary.line, lines.slice(chunkStart, boundary.line), opts));
            }
            chunkStart = boundary.line;
        }
        // 处理大函数
        const endLine = nextBoundary ? nextBoundary.line : lines.length;
        if (endLine - chunkStart > opts.maxLines * 2) {
            // 函数太大，内部拆分
            for (let j = chunkStart; j < endLine; j += opts.maxLines) {
                const subEnd = Math.min(j + opts.maxLines, endLine);
                if (subEnd - j >= opts.minLines) {
                    chunks.push(makeChunk(filePath, j + 1, subEnd, lines.slice(j, subEnd), opts));
                }
            }
            chunkStart = endLine;
        }
    }
    // 输出剩余部分
    if (chunkStart < lines.length) {
        chunks.push(makeChunk(filePath, chunkStart + 1, lines.length, lines.slice(chunkStart), opts));
    }
    return chunks.length > 0 ? chunks : lineChunk(content, filePath, opts);
}
/** 查找函数/类/接口定义行 */
function findFunctionBoundaries(lines) {
    const boundaries = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // TypeScript/JavaScript
        const tsMatch = line.match(/^(?:export\s+)?(?:async\s+)?(?:function|class|interface|enum|type)\s+(\w+)/);
        if (tsMatch) {
            boundaries.push({ line: i, name: tsMatch[1] });
            continue;
        }
        // Python
        const pyMatch = line.match(/^(?:async\s+)?(?:def|class)\s+(\w+)/);
        if (pyMatch) {
            boundaries.push({ line: i, name: pyMatch[1] });
            continue;
        }
        // 方法定义（TS class 内部）
        const methodMatch = line.match(/^\s+(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(/);
        if (methodMatch && i > 0) {
            boundaries.push({ line: i, name: methodMatch[1] });
        }
    }
    return boundaries;
}
/**
 * 正则分块（Shell/Bash）：按函数定义 `function name()` 分块。
 */
function regexChunk(content, filePath, opts) {
    const lines = content.split('\n');
    const boundaries = [0];
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*(?:function\s+)?\w+\s*\(\s*\)\s*\{?\s*$/.test(lines[i])) {
            boundaries.push(i);
        }
    }
    return chunkByBoundaries(lines, filePath, boundaries, opts);
}
/**
 * Key-split 分块（YAML/JSON/MD）：按顶级键或标题分割。
 */
function keySplitChunk(content, filePath, opts) {
    const lines = content.split('\n');
    const isMarkdown = filePath.endsWith('.md');
    if (isMarkdown) {
        // 按 ###/## 标题分割
        const boundaries = [0];
        for (let i = 0; i < lines.length; i++) {
            if (/^#{2,3}\s/.test(lines[i])) {
                boundaries.push(i);
            }
        }
        return chunkByBoundaries(lines, filePath, boundaries, opts);
    }
    // YAML/JSON：按行分块
    return lineChunk(content, filePath, opts);
}
/**
 * 按行数简单分块（回退策略）。
 */
function lineChunk(content, filePath, opts) {
    const lines = content.split('\n');
    const chunks = [];
    for (let i = 0; i < lines.length; i += opts.maxLines) {
        const end = Math.min(i + opts.maxLines, lines.length);
        if (end - i >= opts.minLines) {
            chunks.push(makeChunk(filePath, i + 1, end, lines.slice(i, end), opts));
        }
    }
    return chunks;
}
// ── 工具函数 ──
function chunkByBoundaries(lines, filePath, boundaries, opts) {
    const chunks = [];
    boundaries.push(lines.length);
    for (let i = 0; i < boundaries.length - 1; i++) {
        const start = boundaries[i];
        const end = boundaries[i + 1];
        if (end - start >= opts.minLines) {
            chunks.push(makeChunk(filePath, start + 1, end, lines.slice(start, end), opts));
        }
    }
    return chunks;
}
function makeChunk(filePath, startLine, endLine, slice, _opts) {
    const content = slice.join('\n');
    const symbols = extractSymbols(slice);
    // 稳定 ID：基于文件路径 + 起止行号
    const hash = createHash('md5')
        .update(`${filePath}:${startLine}:${endLine}`)
        .digest('hex')
        .slice(0, 12);
    return {
        id: `code:${hash}`,
        filePath,
        startLine,
        endLine,
        content,
        summary: content.slice(0, 200).replace(/\n/g, ' '),
        symbols,
    };
}
/** 提取代码块中的符号（函数名、类名、导入） */
function extractSymbols(lines) {
    const symbols = [];
    const seen = new Set();
    for (const line of lines) {
        // import/require
        const importMatch = line.match(/import\s+.*?from\s+['"]([^'"]+)['"]/);
        if (importMatch && !seen.has(importMatch[1])) {
            symbols.push(`import:${importMatch[1]}`);
            seen.add(importMatch[1]);
        }
        // 函数定义
        const funcMatch = line.match(/(?:function|def|class|interface|type|enum)\s+(\w+)/);
        if (funcMatch && !seen.has(funcMatch[1])) {
            symbols.push(funcMatch[1]);
            seen.add(funcMatch[1]);
        }
        // 方法调用
        const callMatch = line.match(/(\w+)\s*\(/g);
        if (callMatch) {
            for (const m of callMatch) {
                const name = m.replace(/[(\s]/g, '');
                if (name.length > 2 && !seen.has(name)) {
                    symbols.push(name);
                    seen.add(name);
                }
            }
        }
    }
    return symbols.slice(0, 20); // 限制符号数
}
/**
 * 增量检测：获取 git diff 变更的文件列表。
 * 需要 git 可用。
 */
export function getChangedFiles(rootDir) {
    try {
        const output = execSync('git diff --name-only HEAD', {
            cwd: rootDir,
            encoding: 'utf-8',
            timeout: 5000,
        });
        return output
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=code-chunker.js.map