import { spawn } from 'node:child_process';

/** Platform command that hands a URL to the user's default browser. */
function opener(): { command: string; args: string[] } {
  switch (process.platform) {
    case 'darwin':
      return { command: 'open', args: [] };
    case 'win32':
      // `start` is a cmd builtin; the empty string is the (ignored) window title.
      return { command: 'cmd', args: ['/c', 'start', ''] };
    default:
      return { command: 'xdg-open', args: [] };
  }
}

/**
 * Open `url` in the default browser.
 *
 * The child is detached and its streams are discarded, so a browser writing to
 * stderr cannot corrupt the TUI. Resolves once the process has been spawned;
 * rejects if the opener is missing or exits non-zero straight away.
 */
export async function openUrl(url: string): Promise<void> {
  const { command, args } = opener();

  return new Promise((resolve, reject) => {
    // Arguments are passed as an array, so the URL is never shell-interpreted.
    const child = spawn(command, [...args, url], {
      detached: true,
      stdio: 'ignore',
    });

    child.once('error', (cause: NodeJS.ErrnoException) => {
      reject(
        new Error(
          cause.code === 'ENOENT'
            ? `${command} is not installed, so the browser could not be opened.`
            : `${command} failed: ${cause.message}`,
        ),
      );
    });

    child.once('spawn', () => {
      child.unref(); // Let jdb exit without waiting for the browser.
      resolve();
    });
  });
}
