import { Argument, Command } from 'commander';

import { EDIT_TARGETS, type EditTarget } from './edit';

interface ProgramOptions {
  version: string;
  /** Extra help printed after the generated usage, options and commands. */
  helpAfter: string;
  /** Launch the dashboard; resolves with the exit code. */
  runUi: () => Promise<number>;
  /** Open one file in the editor; resolves with the exit code. */
  runEdit: (path: string) => Promise<number>;
}

/**
 * The command line on its own, with the actions passed in so the routing can be
 * tested without rendering the UI or spawning an editor.
 */
export function buildProgram({ version, helpAfter, runUi, runEdit }: ProgramOptions): Command {
  const program = new Command();

  program
    .name('jdb')
    .description('Jira dashboard in your terminal')
    .version(version, '-v, --version', 'Show the version')
    .helpOption('-h, --help', 'Show this help')
    .addHelpText('after', helpAfter)
    .action(async () => {
      process.exitCode = await runUi();
    });

  program
    .command('edit')
    .description('Open a jdb file in $VISUAL / $EDITOR instead of launching the dashboard')
    .addArgument(new Argument('<target>', 'which file to open').choices(Object.keys(EDIT_TARGETS)))
    .helpOption('-h, --help', 'Show this help')
    .action(async (target: EditTarget) => {
      process.exitCode = await runEdit(EDIT_TARGETS[target]);
    });

  return program;
}
