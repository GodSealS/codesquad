/**
 * codesquad test — run tests across multiple languages/frameworks.
 *
 * Detects test framework from project config (package.json, pytest.ini, *.csproj, etc.)
 * and runs the appropriate test command.
 *
 * Phase 2.0
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
const FRAMEWORK_PROBES = [
    {
        framework: 'vitest',
        configFiles: ['vitest.config.ts', 'vitest.config.js'],
        command: 'npx vitest run',
        language: 'TypeScript',
        detect: (root) => ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts'].some(f => existsSync(join(root, f))),
        watchFlag: 'npx vitest',
        coverageFlag: 'npx vitest run --coverage',
        filterFlag: '',
    },
    {
        framework: 'jest',
        configFiles: ['jest.config.ts', 'jest.config.js', 'jest.config.json'],
        command: 'npx jest',
        language: 'TypeScript/JavaScript',
        detect: (root) => ['jest.config.ts', 'jest.config.js', 'jest.config.json'].some(f => existsSync(join(root, f))),
        watchFlag: 'npx jest --watch',
        coverageFlag: 'npx jest --coverage',
        filterFlag: '--testNamePattern',
    },
    {
        framework: 'pytest',
        configFiles: ['pytest.ini', 'pyproject.toml', 'setup.cfg'],
        command: 'python -m pytest',
        language: 'Python',
        detect: (root) => ['pytest.ini', 'pyproject.toml', 'setup.cfg'].some(f => existsSync(join(root, f))),
        watchFlag: 'pytest-watch',
        coverageFlag: 'python -m pytest --cov',
        filterFlag: '-k',
    },
    {
        framework: 'dotnet',
        configFiles: ['*.csproj'],
        command: 'dotnet test',
        language: 'C#',
        detect: (root) => {
            try {
                // Use Node fs API instead of shell commands to avoid injection
                const files = readdirSync(root);
                return files.some(f => f.endsWith('.csproj'));
            }
            catch (err) {
                console.warn(`[test] Dotnet detection failed: ${err.message}`);
                return false;
            }
        },
        watchFlag: 'dotnet watch test',
        coverageFlag: 'dotnet test --collect "Code Coverage"',
        filterFlag: '--filter',
    },
    {
        framework: 'cargo',
        configFiles: ['Cargo.toml'],
        command: 'cargo test',
        language: 'Rust',
        detect: (root) => existsSync(join(root, 'Cargo.toml')),
        watchFlag: 'cargo watch -x test',
        coverageFlag: 'cargo tarpaulin',
        filterFlag: '',
    },
    {
        framework: 'go',
        configFiles: ['go.mod'],
        command: 'go test ./...',
        language: 'Go',
        detect: (root) => existsSync(join(root, 'go.mod')),
        watchFlag: '',
        coverageFlag: 'go test -cover ./...',
        filterFlag: '-run',
    },
    {
        framework: 'ctest',
        configFiles: ['CMakeLists.txt'],
        command: 'ctest',
        language: 'C/C++',
        detect: (root) => existsSync(join(root, 'CMakeLists.txt')),
        watchFlag: '',
        coverageFlag: '',
        filterFlag: '-R',
    },
];
// ── Detection ──
/**
 * Detect test framework from project root.
 */
export function detectTestFramework(root = process.cwd()) {
    for (const probe of FRAMEWORK_PROBES) {
        if (probe.detect(root)) {
            return {
                framework: probe.framework,
                command: probe.command,
                language: probe.language,
                configFile: probe.configFiles[0],
                watchSupported: !!probe.watchFlag,
                coverageSupported: !!probe.coverageFlag,
            };
        }
    }
    // Fallback: check package.json for test script
    if (existsSync(join(root, 'package.json'))) {
        try {
            const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
            if (pkg.scripts?.test) {
                // Detect framework from test script content
                const testScript = String(pkg.scripts.test);
                let fw = 'npm';
                if (/\bjest\b/.test(testScript))
                    fw = 'jest';
                else if (/\bvitest\b/.test(testScript))
                    fw = 'vitest';
                else if (/\bmocha\b/.test(testScript))
                    fw = 'mocha';
                return {
                    framework: fw,
                    command: `npm run test`,
                    language: 'JavaScript',
                    configFile: 'package.json',
                    watchSupported: fw === 'jest' || fw === 'vitest',
                    coverageSupported: fw === 'jest' || fw === 'vitest',
                };
            }
        }
        catch { /* ignore */ }
    }
    return {
        framework: 'unknown',
        command: 'npm run test',
        language: 'unknown',
        configFile: '',
        watchSupported: false,
        coverageSupported: false,
    };
}
/**
 * Build the test command to run.
 */
export function buildTestCommand(framework, options) {
    if (options.watch && framework.watchSupported) {
        const probe = FRAMEWORK_PROBES.find(p => p.framework === framework.framework);
        if (probe?.watchFlag)
            return probe.watchFlag;
    }
    if (options.coverage && framework.coverageSupported) {
        const probe = FRAMEWORK_PROBES.find(p => p.framework === framework.framework);
        if (probe?.coverageFlag)
            return probe.coverageFlag;
    }
    let cmd = framework.command;
    if (options.filter) {
        const probe = FRAMEWORK_PROBES.find(p => p.framework === framework.framework);
        if (probe?.filterFlag) {
            const escaped = options.filter.replace(/"/g, '\\"');
            cmd += ` ${probe.filterFlag} "${escaped}"`;
        }
    }
    return cmd;
}
/**
 * Handle the `codesquad test` CLI command.
 */
export async function handleTest(options) {
    const projectRoot = process.cwd();
    const framework = detectTestFramework(projectRoot);
    if (framework.framework === 'unknown') {
        console.error('❌ Could not detect test framework in this project.');
        console.error('   Supported: jest, vitest, pytest, dotnet, cargo, go, ctest');
        console.error('   Specify framework: codesquad test --framework <name>');
        process.exit(1);
    }
    const command = buildTestCommand(framework, options || {});
    if (options?.json) {
        console.log(JSON.stringify({ ...framework, command }, null, 2));
        return;
    }
    console.log(`\n🧪 Framework detected: ${framework.framework} (${framework.language})`);
    console.log(`   Config: ${framework.configFile}`);
    console.log(`   Command: ${command}`);
    if (options?.dryRun) {
        return;
    }
    console.log(`\n💡 Run the command above via BashTool or use the REPL chat.`);
    console.log(`   Test results will be parsed and displayed automatically.`);
}
//# sourceMappingURL=test.js.map