import chalk from 'chalk';
export const logger = {
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