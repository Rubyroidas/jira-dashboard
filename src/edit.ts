import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

import { DAYS_OFF_PATH, HOLIDAY_CACHE_PATH } from './data/calendar';
import { CONFIG_DIR, CONFIG_PATH } from './data/config';
import { JiraError } from './types';

/** What `jdb edit <target>` accepts, and the file each one opens. */
export const EDIT_TARGETS = {
  config: CONFIG_PATH,
  holidays: HOLIDAY_CACHE_PATH,
  'days-off': DAYS_OFF_PATH,
} as const;

export type EditTarget = keyof typeof EDIT_TARGETS;

/**
 * The editor rule on its own, free of the environment so it can be tested
 * directly: `$VISUAL`, then `$EDITOR`, then a platform fallback. The variable
 * may carry flags (`code --wait`), which become separate arguments.
 */
export function resolveEditor(
  env: Record<string, string | undefined>,
  platform: string,
): { command: string; args: string[] } {
  for (const value of [env['VISUAL'], env['EDITOR']]) {
    const [command, ...args] = (value ?? '').split(/\s+/).filter(Boolean);
    if (command) return { command, args };
  }
  return { command: platform === 'win32' ? 'notepad' : 'vi', args: [] };
}

/**
 * Open `path` in the user's editor and wait for it to close.
 *
 * The editor inherits the terminal, so vim and friends work. Resolves with the
 * editor's exit code; rejects if it could not be started.
 */
export async function runEditor(path: string): Promise<number> {
  const { command, args } = resolveEditor(process.env, process.platform);

  // The editor can create the file, but not the directory it lives in.
  mkdirSync(CONFIG_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    // Arguments are passed as an array, so the path is never shell-interpreted.
    const child = spawn(command, [...args, path], { stdio: 'inherit' });

    child.once('error', (cause: NodeJS.ErrnoException) => {
      reject(
        cause.code === 'ENOENT'
          ? new JiraError(`\`${command}\` is not installed, so ${path} could not be opened.`, [
              'Set $VISUAL or $EDITOR to the editor you want to use.',
            ])
          : new JiraError(`${command} failed: ${cause.message}`),
      );
    });

    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}
