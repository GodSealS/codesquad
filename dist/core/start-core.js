/**
 * Start Core
 *
 * Equivalent of the /start skill for the CLI.
 * Detects project state, guides user through onboarding (A/B/C/D paths),
 * sets review mode, writes stage file, and copies templates.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse as parseYaml } from 'yaml';
import fastGlob from 'fast-glob';
const { globSync } = fastGlob;
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';
import { copyTemplates, printCopySummary } from '../generators/template-copier.js';
/* ── constants ─────────────────────────────────── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PACKAGE_ROOT = resolve(__dirname, '..', '..');
const SOURCE_GLOB_PATTERNS = ['*.gd', '*.cs', '*.cpp', '*.h', '*.rs', '*.py', '*.js', '*.ts'];
/* ── detect project state ─────────────────────── */
export function detectProjectState(targetPath) {
    const state = {
        engineConfigured: false,
        engineName: 'not configured',
        hasGameConcept: false,
        sourceFileCount: 0,
        designDocCount: 0,
        hasProductionArtifacts: false,
        hasGDDs: false,
        hasArchitectureDocs: false,
        reviewModePath: null,
        reviewMode: null,
    };
    // Read codesquad.config.yaml for engine config
    const configPath = join(targetPath, 'codesquad.config.yaml');
    if (existsSync(configPath)) {
        try {
            const raw = readFileSync(configPath, 'utf-8');
            const config = parseYaml(raw);
            if (config?.engine?.name && config.engine.name !== 'custom') {
                state.engineConfigured = true;
                state.engineName = config.engine.name + (config.engine.version ? ` ${config.engine.version}` : '');
            }
        }
        catch { /* ignore */ }
    }
    // Check game concept
    const conceptPath = join(targetPath, 'design', 'gdd', 'game-concept.md');
    state.hasGameConcept = existsSync(conceptPath);
    // Count source files
    try {
        const srcDir = join(targetPath, 'src');
        if (existsSync(srcDir)) {
            const results = globSync(join(srcDir, '**', '*.{gd,cs,cpp,h,rs,py,js,ts}'));
            state.sourceFileCount = results.length;
        }
    }
    catch { /* ignore */ }
    // Count design docs
    const gddDir = join(targetPath, 'design', 'gdd');
    if (existsSync(gddDir)) {
        try {
            const mdFiles = globSync(join(gddDir, '**', '*.md'));
            state.designDocCount = mdFiles.length;
        }
        catch { /* ignore */ }
    }
    state.hasGDDs = state.designDocCount > 0;
    // Check production artifacts
    const sprintsDir = join(targetPath, 'production', 'sprints');
    const milestonesDir = join(targetPath, 'production', 'milestones');
    state.hasProductionArtifacts = existsSync(sprintsDir) || existsSync(milestonesDir);
    // Check architecture docs
    const architectureDir = join(targetPath, 'docs', 'architecture');
    if (existsSync(architectureDir)) {
        try {
            const files = readdirSync(architectureDir);
            state.hasArchitectureDocs = files.length > 1; // More than just tr-registry.yaml
        }
        catch { /* ignore */ }
    }
    // Check review mode
    const reviewModePath = join(targetPath, 'production', 'review-mode.txt');
    if (existsSync(reviewModePath)) {
        state.reviewModePath = reviewModePath;
        try {
            const mode = readFileSync(reviewModePath, 'utf-8').trim();
            if (mode === 'full' || mode === 'lean' || mode === 'solo') {
                state.reviewMode = mode;
            }
        }
        catch { /* ignore */ }
    }
    return state;
}
/* ── user prompts ──────────────────────────────── */
async function askStartPath(state) {
    console.log();
    logger.title('CodeSquad Start — Onboarding');
    const answer = await select({
        message: 'Welcome to CodeSquad Game Studios! Where are you with your game idea?',
        choices: [
            {
                name: 'A) No idea yet — I want to explore and figure out what to make',
                value: 'A',
                description: 'I don\'t have a game concept at all',
            },
            {
                name: 'B) Vague idea — rough theme, feeling, or genre in mind',
                value: 'B',
                description: 'Something like "a space game" or "cozy farming"',
            },
            {
                name: 'C) Clear concept — genre, basic mechanics, maybe a pitch sentence',
                value: 'C',
                description: 'I know the core idea but haven\'t formalized it',
            },
            {
                name: 'D) Existing work — design docs, prototypes, or code already',
                value: 'D',
                description: 'I have artifacts and want to organize or continue',
            },
        ],
    });
    return answer;
}
async function askReviewMode() {
    console.log();
    const answer = await select({
        message: 'How much design review would you want as you work through the workflow?',
        choices: [
            {
                name: 'Lean (recommended) — Directors only at phase gate transitions. Balanced for solo devs and small teams.',
                value: 'lean',
            },
            {
                name: 'Full — Director specialists review at each key workflow step. Best for teams or learning.',
                value: 'full',
            },
            {
                name: 'Solo — No director reviews. Maximum speed. Best for game jams or prototypes.',
                value: 'solo',
            },
        ],
    });
    return answer;
}
async function confirmNextStep(nextStep) {
    console.log();
    const answer = await select({
        message: `Would you like to start with ${nextStep}?`,
        choices: [
            { name: `Yes, let's start with ${nextStep}`, value: 'yes' },
            { name: "I'd like to do something else first", value: 'no' },
        ],
    });
    return answer === 'yes';
}
/* ── path presentation ─────────────────────────── */
function presentPathA() {
    console.log();
    console.log(chalk.bold.cyan('Recommended Workflow Path — Concept Phase:'));
    console.log(chalk.dim('  brainstorm open          → Discover your game concept'));
    console.log(chalk.dim('  setup-engine             → Configure the engine'));
    console.log(chalk.dim('  art-bible                → Define visual identity'));
    console.log(chalk.dim('  map-systems              → Decompose concept into systems'));
    console.log(chalk.dim('  design-system            → Author GDDs for each system'));
    console.log(chalk.dim('  review-all-gdds          → Cross-system consistency check'));
    console.log(chalk.dim('  gate-check               → Validate readiness'));
    console.log();
    console.log(chalk.bold.cyan('Architecture Phase:'));
    console.log(chalk.dim('  create-architecture      → Master architecture blueprint'));
    console.log(chalk.dim('  architecture-decision    → Record key technical decisions'));
    console.log(chalk.dim('  create-control-manifest  → Actionable rules sheet'));
    console.log(chalk.dim('  architecture-review      → Validate coverage'));
    console.log();
    console.log(chalk.bold.cyan('Pre-Production Phase:'));
    console.log(chalk.dim('  create-epics / create-stories → Map systems to implementable stories'));
    console.log();
    logger.info('Next: Run `codesquad brainstorm` to begin.');
}
function presentPathB() {
    console.log();
    console.log(chalk.bold.cyan('Recommended Workflow Path — Concept Phase:'));
    console.log(chalk.dim('  brainstorm [hint]        → Develop your idea into a full concept'));
    console.log(chalk.dim('  setup-engine             → Configure the engine'));
    console.log(chalk.dim('  art-bible                → Define visual identity'));
    console.log(chalk.dim('  map-systems              → Decompose concept into systems'));
    console.log(chalk.dim('  design-system            → Author GDDs for each system'));
    console.log(chalk.dim('  gate-check               → Validate readiness'));
    console.log();
    console.log(chalk.bold.cyan('Architecture → Pre-Production:'));
    console.log(chalk.dim('  create-architecture → architecture-decision → create-epics → create-stories'));
    console.log();
    logger.info('Next: Run `codesquad brainstorm "your idea hint"` to begin.');
}
function presentPathC() {
    console.log();
    console.log(chalk.bold.cyan('Recommended Workflow Path:'));
    console.log(chalk.dim('  brainstorm [concept]     → Formalize into a structured document'));
    console.log(chalk.dim('    -or-                   → Skip to setup-engine'));
    console.log(chalk.dim('  setup-engine             → Configure the engine'));
    console.log(chalk.dim('  design-review            → Validate the concept doc'));
    console.log(chalk.dim('  map-systems → design-system → gate-check'));
    console.log(chalk.dim('  create-architecture → create-epics → create-stories'));
    console.log();
}
function presentPathD(state) {
    console.log();
    console.log(chalk.bold('Detected Project State:'));
    console.log(`  Source files: ${state.sourceFileCount}`);
    console.log(`  Design docs:  ${state.designDocCount}`);
    console.log(`  Engine:       ${state.engineConfigured ? state.engineName : chalk.yellow('not configured')}`);
    if (!state.engineConfigured || (!state.hasGDDs && !state.hasArchitectureDocs)) {
        // Sub-case D1 — Early stage
        console.log();
        logger.info('Early stage project. Recommended path:');
        if (!state.engineConfigured) {
            console.log(chalk.cyan('  1. setup-engine          → Configure your game engine first'));
        }
        console.log(chalk.dim('  2. project-stage-detect  → Gap inventory'));
        console.log(chalk.dim('  3. adopt                 → Format compliance audit'));
        console.log(chalk.dim('  4. design-system → gate-check → create-architecture'));
    }
    else {
        // Sub-case D2 — Has GDDs, ADRs, or stories
        console.log();
        logger.info('Existing project with artifacts. Recommended path:');
        console.log(chalk.dim('  1. project-stage-detect  → Phase detection + gaps'));
        console.log(chalk.dim('  2. adopt                 → Format compliance audit + migration plan'));
        console.log(chalk.dim('  3. design-system retrofit → Fill missing GDD sections'));
        console.log(chalk.dim('  4. architecture-review   → Bootstrap TR registry'));
        console.log(chalk.dim('  5. gate-check            → Validate readiness'));
    }
    console.log();
}
/* ── write stage & review mode ─────────────────── */
function writeStageFile(targetPath, path, state) {
    let stage;
    if (path === 'A' || path === 'B' || path === 'C') {
        stage = 'Concept';
    }
    else if (path === 'D') {
        if (state.hasArchitectureDocs) {
            stage = 'Technical Setup';
        }
        else if (state.hasGDDs) {
            stage = 'Systems Design';
        }
        else {
            stage = 'Concept';
        }
    }
    else {
        stage = 'Concept';
    }
    const productionDir = join(targetPath, 'production');
    mkdirSync(productionDir, { recursive: true });
    const stagePath = join(productionDir, 'stage.txt');
    writeFileSync(stagePath, stage + '\n', 'utf-8');
    return stage;
}
function writeReviewModeFile(targetPath, mode) {
    const productionDir = join(targetPath, 'production');
    mkdirSync(productionDir, { recursive: true });
    const reviewPath = join(productionDir, 'review-mode.txt');
    writeFileSync(reviewPath, mode + '\n', 'utf-8');
}
/* ── main entry ────────────────────────────────── */
export async function runStart(options = {}) {
    const targetPath = resolve(options.targetPath || '.');
    const state = detectProjectState(targetPath);
    // Check if returning user (engine configured + concept exists)
    if (state.engineConfigured && state.hasGameConcept && !options.ci) {
        logger.title('Welcome Back!');
        logger.info(`Engine:       ${chalk.green(state.engineName)}`);
        logger.info(`Game concept: ${chalk.green('design/gdd/game-concept.md')}`);
        const modeDisplay = state.reviewMode ?? 'lean (default)';
        logger.info(`Review mode:  ${chalk.green(modeDisplay)}`);
        console.log();
        logger.info("It looks like you're already set up! Want to pick up where you left off?");
        console.log(chalk.dim('  Try `codesquad sprint-plan` or just tell me what you\'d like to work on.'));
        return;
    }
    // Phase 2: Ask where the user is
    const path = await askStartPath(state);
    // Edge case: User picks D but project is empty
    if (path === 'D' && state.sourceFileCount === 0 && state.designDocCount === 0 && !state.engineConfigured) {
        console.log();
        logger.warn("It looks like the project is a fresh template with no artifacts yet.");
        logger.info('Path A or B might be a better fit. However, proceeding with D.');
    }
    // Phase 3: Route and present
    if (path === 'A')
        presentPathA();
    else if (path === 'B')
        presentPathB();
    else if (path === 'C')
        presentPathC();
    else
        presentPathD(state);
    // Phase 3b: Set review mode
    const reviewMode = state.reviewMode ?? await askReviewMode();
    if (!state.reviewMode) {
        writeReviewModeFile(targetPath, reviewMode);
        logger.success(`Review mode set to: ${chalk.green(reviewMode)}`);
    }
    else {
        logger.info(`Review mode (existing): ${chalk.green(reviewMode)}`);
    }
    // Phase 3c: Write stage file
    const stage = writeStageFile(targetPath, path, state);
    logger.success(`Stage set to: ${chalk.green(stage)}`);
    // Copy templates if docs/ doesn't have core files yet
    const conceptInDocs = existsSync(join(targetPath, 'docs', 'COLLABORATIVE-DESIGN-PRINCIPLE.md'));
    if (!conceptInDocs) {
        console.log();
        logger.step('templates', 'Copying template files to docs/...');
        const copyResult = copyTemplates(targetPath);
        printCopySummary(copyResult);
    }
    else {
        logger.info('Docs already initialized — skipping template copy.');
    }
    // Phase 4: Confirm next step
    const recommendedFirst = path === 'A' ? 'brainstorm open' :
        path === 'B' ? 'brainstorm [your hint]' :
            path === 'C' ? 'brainstorm [your concept]' :
                !state.engineConfigured ? 'setup-engine' :
                    'project-stage-detect';
    console.log();
    const confirmed = await confirmNextStep(recommendedFirst);
    if (confirmed) {
        console.log(chalk.cyan(`\nType \`codesquad ${recommendedFirst}\` to begin.`));
    }
    else {
        console.log(chalk.dim('\nTry `codesquad --help` to see all available commands.'));
    }
}
//# sourceMappingURL=start-core.js.map