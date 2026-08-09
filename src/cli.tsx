#!/usr/bin/env node
import { render } from 'ink';
import { createRequire } from 'node:module';

import { App } from './app';
import { DAYS_OFF_PATH } from './data/calendar';
import { JiraClient } from './data/client';
import { CONFIG_PATH, DEFAULT_ISSUES_JQL, loadConfig } from './data/config';
import { JiraError } from './types';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

/**
 * Built from a char code on purpose: a literal escape byte in source is
 * invisible and easy to lose to an editor or a copy-paste.
 */
const ESC = String.fromCharCode(27);
const ALT_SCREEN_ON = `${ESC}[?1049h`;
const ALT_SCREEN_OFF = `${ESC}[?1049l`;
const CURSOR_SHOW = `${ESC}[?25h`;

const HELP = `
  jdb — Jira dashboard in your terminal

  Usage
    $ jdb

  Options
    -h, --help       Show this help
    -v, --version    Show the version

  Configuration (environment variables take precedence)
    JIRA_BASE_URL    https://your-team.atlassian.net
    JIRA_EMAIL       your Atlassian account email
    JIRA_API_TOKEN   https://id.atlassian.com/manage-profile/security/api-tokens
    JIRA_HOLIDAY_COUNTRY  ISO country code for statutory holidays, e.g. UA
    JIRA_HOLIDAY_REGION   your subdivision, e.g. CA-ON — regional holidays are
                          shown either way, but only count as days off with it

    Or ${CONFIG_PATH}:
      {
        "baseUrl": "https://your-team.atlassian.net",
        "email": "you@example.com",
        "apiToken": "...",
        "issuesJql": ${JSON.stringify(DEFAULT_ISSUES_JQL)},
        "worklogDays": 14,
        "holidayCountry": "UA"
      }

    Personal leave goes in ${DAYS_OFF_PATH}:
      ["2026-08-10", { "date": "2026-08-11", "label": "moving day" }]

    Holidays are fetched from date.nager.at and cached next to the config;
    changing the country invalidates the cache.

  Keys
    ↑ ↓ / j k    move within the focused panel
    home / end   jump to the first / last item
    enter        open the selected ticket in your browser
    tab          cycle panels (worklogs → tickets → preview)
    click/wheel  select and scroll
    r            reload
    q / esc      quit
`;

/** Print an error the way clig.dev recommends: what broke, then how to fix it. */
function reportError(error: unknown): void {
  const jiraError = error instanceof JiraError ? error : null;
  process.stderr.write(`\njdb: ${jiraError?.message ?? String(error)}\n`);
  for (const hint of jiraError?.hints ?? []) {
    process.stderr.write(`  ${hint}\n`);
  }
  process.stderr.write('\n');
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(`${HELP}\n`);
    return 0;
  }
  if (args.includes('-v') || args.includes('--version')) {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  if (!process.stdout.isTTY) {
    process.stderr.write('jdb: needs an interactive terminal (stdout is not a TTY).\n');
    return 1;
  }

  const config = loadConfig();
  const client = new JiraClient(config);
  const me = await client.myself();

  // The alternate screen keeps the user's scrollback intact: everything jdb
  // draws goes to a separate buffer that the terminal discards on the way out.
  let restored = false;
  const restoreScreen = (): void => {
    if (restored) return;
    restored = true;
    process.stdout.write(ALT_SCREEN_OFF + CURSOR_SHOW);
  };

  process.stdout.write(ALT_SCREEN_ON);
  // Cover every way the process can end, including a crash or a signal.
  process.on('exit', restoreScreen);
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.once(signal, () => {
      restoreScreen();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  }

  try {
    const { waitUntilExit } = render(<App config={config} client={client} me={me} />, {
      exitOnCtrlC: true,
    });
    await waitUntilExit();
  } finally {
    restoreScreen();
  }

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    reportError(error);
    process.exitCode = 1;
  });
