/**
 * codesquad build — compile/build a game project.
 *
 * Detects engine type (if not specified) and runs the appropriate build command.
 * Lightweight wrapper around BashTool v2 with engine detection.
 *
 * Phase 2.0
 */
import { detectEngine, getBuildCommandSuggestion } from '../engine/detector.js';
/**
 * Handle the `codesquad build` CLI command.
 */
export async function handleBuild(engineArg, options) {
    const projectRoot = process.cwd();
    const engine = engineArg
        ? engineArg.toLowerCase()
        : (await detectEngine(projectRoot)).engine;
    if (engine === 'unknown') {
        console.error('❌ Could not detect game engine in this project.');
        console.error('   Specify engine: codesquad build <engine> (unreal | unity | godot | cocos)');
        console.error('   Or configure engine first: codesquad setup-engine');
        process.exit(1);
    }
    const suggestions = getBuildCommandSuggestion(engine);
    console.log(`\n🔨 Engine detected: ${engine}`);
    console.log(`\n📋 Suggested build commands:`);
    suggestions.forEach((cmd, i) => console.log(`   ${i + 1}. ${cmd}`));
    if (options?.dryRun) {
        return;
    }
    // In REPL/Chat mode, the AI agent will pick a command and run it via BashTool.
    // This CLI is a lightweight dispatcher that tells the user/AI what to build.
    console.log(`\n💡 Run one of the commands above via BashTool or use the REPL chat.`);
    console.log(`   For builds that take >2 minutes, BashTool will auto-background.`);
}
/**
 * Output engine build info as JSON for programmatic use.
 */
export async function getBuildInfoJson(engineArg) {
    const projectRoot = process.cwd();
    const engineInfo = await detectEngine(projectRoot);
    const engine = engineArg
        ? engineArg.toLowerCase()
        : engineInfo.engine;
    const info = {
        detectedEngine: engine,
        suggestions: getBuildCommandSuggestion(engine),
        engineVersion: engineInfo.version,
        confidence: engineInfo.confidence,
        projectFile: engineInfo.projectFile,
    };
    return JSON.stringify(info, null, 2);
}
//# sourceMappingURL=build.js.map