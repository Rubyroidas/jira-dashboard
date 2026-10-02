import { describe, expect, jest, test } from '@jest/globals';
import { type Command, CommanderError } from 'commander';

import { type CompletionShell, completionScript } from './completion';
import { DAYS_OFF_PATH, HOLIDAY_CACHE_PATH } from './data/calendar';
import { CONFIG_PATH } from './data/config';
import { buildProgram } from './program';

/** A program wired to stubs, made to throw instead of exiting or printing. */
function setup() {
  const runUi = jest.fn<() => Promise<number>>().mockResolvedValue(0);
  const runEdit = jest.fn<(path: string) => Promise<number>>().mockResolvedValue(0);
  const print = jest.fn<(text: string) => void>();
  const installCompletion = jest.fn<(shell: CompletionShell) => string>(() => 'installed\n');
  const program = buildProgram({
    version: '1.2.3',
    helpAfter: '',
    runUi,
    runEdit,
    installCompletion,
    print,
  });
  const silence = (command: Command): void => {
    command.exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
    command.commands.forEach(silence);
  };
  silence(program);
  const run = (...args: string[]) => program.parseAsync(args, { from: 'user' });
  return { runUi, runEdit, installCompletion, print, run };
}

describe('buildProgram', () => {
  test('no arguments launches the UI', async () => {
    const { runUi, runEdit, run } = setup();
    await run();
    expect(runUi).toHaveBeenCalledTimes(1);
    expect(runEdit).not.toHaveBeenCalled();
  });

  test.each([
    ['config', CONFIG_PATH],
    ['holidays', HOLIDAY_CACHE_PATH],
    ['days-off', DAYS_OFF_PATH],
  ])('edit %s opens its file instead of the UI', async (target, path) => {
    const { runUi, runEdit, run } = setup();
    await run('edit', target);
    expect(runEdit).toHaveBeenCalledWith(path);
    expect(runUi).not.toHaveBeenCalled();
  });

  test('edit without a target is an error', async () => {
    const { runUi, runEdit, run } = setup();
    await expect(run('edit')).rejects.toBeInstanceOf(CommanderError);
    expect(runEdit).not.toHaveBeenCalled();
    expect(runUi).not.toHaveBeenCalled();
  });

  test('edit with an unknown target is an error', async () => {
    const { runUi, runEdit, run } = setup();
    await expect(run('edit', 'nope')).rejects.toBeInstanceOf(CommanderError);
    expect(runEdit).not.toHaveBeenCalled();
    expect(runUi).not.toHaveBeenCalled();
  });

  test('completion show prints the script without installing or launching the UI', async () => {
    const { runUi, installCompletion, print, run } = setup();
    await run('completion', 'show', 'bash');
    expect(print).toHaveBeenCalledWith(completionScript('bash'));
    expect(installCompletion).not.toHaveBeenCalled();
    expect(runUi).not.toHaveBeenCalled();
  });

  test('completion install installs for the shell and prints the report', async () => {
    const { runUi, installCompletion, print, run } = setup();
    await run('completion', 'install', 'zsh');
    expect(installCompletion).toHaveBeenCalledWith('zsh');
    expect(print).toHaveBeenCalledWith('installed\n');
    expect(runUi).not.toHaveBeenCalled();
  });

  test.each(['show', 'install'])('completion %s for an unknown shell is an error', async (action) => {
    const { installCompletion, print, run } = setup();
    await expect(run('completion', action, 'tcsh')).rejects.toBeInstanceOf(CommanderError);
    expect(installCompletion).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  test('completion without an action is an error', async () => {
    const { installCompletion, print, run } = setup();
    await expect(run('completion')).rejects.toBeInstanceOf(CommanderError);
    expect(installCompletion).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  test('an unknown command does not fall through to the UI', async () => {
    const { runUi, run } = setup();
    await expect(run('bogus')).rejects.toBeInstanceOf(CommanderError);
    expect(runUi).not.toHaveBeenCalled();
  });
});

describe('completion help', () => {
  test.each(['show', 'install'])('lists the supported shells next to %s', (action) => {
    const program = buildProgram({
      version: '1.2.3',
      helpAfter: '',
      runUi: () => Promise.resolve(0),
      runEdit: () => Promise.resolve(0),
      installCompletion: () => '',
      print: () => {},
    });
    const completion = program.commands.find((command) => command.name() === 'completion');
    // Whitespace is collapsed so the check holds however the help wraps.
    const help = completion?.helpInformation().replace(/\s+/g, ' ');
    expect(help).toMatch(new RegExp(`${action} <shell> [^()]*\\(bash, zsh, fish\\)`));
  });
});
