import chalk from 'chalk';

export function displayBanner() {
    console.log(`
╔════════════════════════════════════════════════════╗
║ ░█▀▄░█░░░█▀▀░█▀▀░█▀▀░░░█▀█░█▀▀░▀█▀░█░█░█▀█░█▀▄░█░█ ║ ${chalk.green('Bot successfully running!')}
║ ░█▀▄░█░░░█▀▀░▀▀█░▀▀█░░░█░█░█▀▀░░█░░█▄█░█░█░█▀▄░█▀▄ ║ Engine: ${chalk.yellow(`Node.js v${process.versions.node}!`)} 
║ ░▀▀░░▀▀▀░▀▀▀░▀▀▀░▀▀▀░░░▀░▀░▀▀▀░░▀░░▀░▀░▀▀▀░▀░▀░▀░▀ ║ Channel: t.me/dropvaulthq
╚════════════════════════════════════════════════════╝
`);
}
