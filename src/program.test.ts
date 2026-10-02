import { describe, expect, jest, test } from '@jest/globals';
import { CommanderError } from 'commander';

import { DAYS_OFF_PATH, HOLIDAY_CACHE_PATH } from './data/calendar';
import { CONFIG_PATH } from './data/config';
import { buildProgram } from './program';

/** A program wired to stubs, made to throw instead of exiting or printing. */
function setup() {
  const runUi = jest.fn<() => Promise<number>>().mockResolvedValue(0);
  const runEdit = jest.fn<(path: string) => Promise<number>>().mockResolvedValue(0);
  const program = buildProgram({ version: '1.2.3', helpAfter: '', runUi, runEdit });
  for (const command of [program, ...program.commands]) {
    command.exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} });
  }
  const run = (...args: string[]) => program.parseAsync(args, { from: 'user' });
  return { runUi, runEdit, run };
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

  test('an unknown command does not fall through to the UI', async () => {
    const { runUi, run } = setup();
    await expect(run('bogus')).rejects.toBeInstanceOf(CommanderError);
    expect(runUi).not.toHaveBeenCalled();
  });
});
