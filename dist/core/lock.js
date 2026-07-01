/**
 * .codesquad.lock state file management.
 *
 * Tracks the current REPL/legacy mode and prevents
 * accidental state conflicts between init and bind operations.
 * Phase 1.8 — Step 1.8.2.
 */
import { readFile, readFileSync, writeFile, existsSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const LOCK_FILE = '.codesquad.lock';
// ── Default lock ──
export function createDefaultLock(version, mode = 'repl') {
    return {
        version,
        generatedAt: new Date().toISOString(),
        mode,
        mcpConfigHash: '',
        agents: {},
    };
}
// ── Read/Write ──
export async function readLock(cwd = process.cwd()) {
    const path = join(cwd, LOCK_FILE);
    if (!existsSync(path))
        return null;
    try {
        const raw = await readFileAsync(path, 'utf-8');
        return parseYaml(raw);
    }
    catch (err) {
        console.error(`[lock] Failed to read lock ${path}: ${err.message}`);
        return null;
    }
}
export async function writeLock(lock, cwd = process.cwd()) {
    const path = join(cwd, LOCK_FILE);
    lock.generatedAt = new Date().toISOString();
    const yaml = stringifyYaml(lock);
    await writeFileAsync(path, yaml, 'utf-8');
}
// ── MCP hash ──
export function computeMcpConfigHash(mcpConfigPath) {
    if (!existsSync(mcpConfigPath))
        return '';
    const raw = readFileSync(mcpConfigPath, 'utf-8');
    return createHash('sha256').update(raw).digest('hex').slice(0, 8);
}
// ── BEFORE guards ──
/**
 * Check before running `codesquad init` — warns if REPL mode is active.
 */
export async function beforeInit(cwd) {
    const lock = await readLock(cwd);
    if (lock && lock.mode === 'repl') {
        console.log('⚠️  检测到 REPL 模式锁文件');
        console.log('   REPL 模式下不建议运行 init（可能覆盖状态）。');
        console.log('   使用 --force 跳过此检查。');
    }
}
/**
 * Check before running `codesquad mcp bind` — checks MCP hash.
 */
export async function beforeBind(mcpConfigPath, cwd) {
    const lock = await readLock(cwd);
    if (!lock)
        return true; // No lock → proceed
    const configPath = mcpConfigPath ?? join(cwd ?? process.cwd(), 'mcp.config.yaml');
    const currentHash = computeMcpConfigHash(configPath);
    if (lock.mcpConfigHash === currentHash && currentHash !== '') {
        console.log('ℹ️  MCP 绑定已是最新，无需更新');
        return false;
    }
    return true;
}
// ── Set mode ──
export async function setLockMode(mode, cwd) {
    let lock = await readLock(cwd);
    if (!lock) {
        lock = createDefaultLock('0.1.0', mode);
    }
    lock.mode = mode;
    await writeLock(lock, cwd);
}
//# sourceMappingURL=lock.js.map