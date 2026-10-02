import { Argument, Command } from 'commander';

import { COMPLETION_SHELLS, type CompletionShell, completionScript } from './completion';
import { EDIT_TARGETS, type EditTarget } from './edit';

interface ProgramOptions {
  version: string;
  /** Extra help printed after the generated usage, options and commands. */
  helpAfter: string;
  /** Launch the dashboard; resolves with the exit code. */
  runUi: () => Promise<number>;
  /** Open one file in the editor; resolves with the exit code. */
  runEdit: (path: string) => Promise<number>;
  /** Install the completion script for a shell; returns a report of what was done. */
  installCompletion: (shell: CompletionShell) => string;
  /** Write text to stdout. */
  print: (text: string) => void;
}

/**
 * The command line on its own, with the actions passed in so the routing can be
 * tested without rendering the UI or spawning an editor.
 */
export function buildProgram({
  version,
  helpAfter,
  runUi,
  runEdit,
  installCompletion,
  print,
}: ProgramOptions): Command {
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

  const shells = `(${COMPLETION_SHELLS.join(', ')})`;

  const completion = program
    .command('completion')
    .description('Set up tab completion for your shell')
    .helpOption('-h, --help', 'Show this help');

  completion
    .command('show')
    .description(`Print the script and how to load it ${shells}`)
    .addArgument(new Argument('<shell>', 'which shell to target').choices(COMPLETION_SHELLS))
    .helpOption('-h, --help', 'Show this help')
    .action((shell: CompletionShell) => {
      print(completionScript(shell));
    });

  completion
    .command('install')
    .description(`Install the script for your shell ${shells}`)
    .addArgument(new Argument('<shell>', 'which shell to target').choices(COMPLETION_SHELLS))
    .helpOption('-h, --help', 'Show this help')
    .action((shell: CompletionShell) => {
      print(installCompletion(shell));
    });

  return program;
}
