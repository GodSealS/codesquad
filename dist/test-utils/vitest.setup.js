import { beforeEach, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const testRoot = mkdtempSync(join(tmpdir(), 'codesquad-vitest-'));
const testHome = join(testRoot, 'home');
const testProjectRoot = join(testRoot, 'project');
const originalHome = process.env.CODESQUAD_HOME;
const originalProjectRoot = process.env.CODESQUAD_PROJECT_ROOT;
function applyTestRuntime() {
    process.env.CODESQUAD_HOME = testHome;
    process.env.CODESQUAD_PROJECT_ROOT = testProjectRoot;
}
mkdirSync(testHome, { recursive: true });
mkdirSync(testProjectRoot, { recursive: true });
applyTestRuntime();
beforeEach(() => applyTestRuntime());
afterAll(() => {
    if (originalHome === undefined)
        delete process.env.CODESQUAD_HOME;
    else
        process.env.CODESQUAD_HOME = originalHome;
    if (originalProjectRoot === undefined)
        delete process.env.CODESQUAD_PROJECT_ROOT;
    else
        process.env.CODESQUAD_PROJECT_ROOT = originalProjectRoot;
    rmSync(testRoot, { recursive: true, force: true });
});
//# sourceMappingURL=vitest.setup.js.map