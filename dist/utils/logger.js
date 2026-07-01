import chalk from 'chalk';
import { isDebugMode } from './debug.js';
export const logger = {
    /** Debug-level console output — only emitted when CODESQUAD_DEBUG=1. */
    debug(msg) {
        if (!isDebugMode())
            return;
        console.log(chalk.gray('🐛'), msg);
    },
    info(msg) {
        console.log(chalk.blue('ℹ'), msg);
    },
    success(msg) {
        console.log(chalk.green('✔'), msg);
    },
    warn(msg) {
        console.log(chalk.yellow('⚠'), msg);
    },
    error(msg) {
        console.error(chalk.red('✖'), msg);
    },
    step(step, msg) {
        console.log(chalk.cyan(`[${step}]`), msg);
    },
    title(msg) {
        console.log();
        console.log(chalk.bold.yellow('═'.repeat(50)));
        console.log(chalk.bold.yellow(`  ${msg}`));
        console.log(chalk.bold.yellow('═'.repeat(50)));
        console.log();
    },
};
//# sourceMappingURL=logger.js.map