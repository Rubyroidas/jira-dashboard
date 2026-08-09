import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { JiraError, type Config } from '../types';

/** Everything the dashboard persists — config, caches, hand-edited lists — lives here. */
export const CONFIG_DIR = join(
  process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'),
  'jira-dashboard',
);

export const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

const TOKEN_URL = 'https://id.atlassian.com/manage-profile/security/api-tokens';

export const DEFAULT_ISSUES_JQL = [
  'assignee = currentUser()',
  'AND statusCategory != Done',
  'AND status NOT IN ("Cancelled", "Closed", "Backlog")',
  'ORDER BY updated DESC',
].join(' ');

const DEFAULT_WORKLOG_DAYS = 14;

interface FileConfig {
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  issuesJql?: string;
  worklogDays?: number;
  holidayCountry?: string;
  holidayRegion?: string;
}

/** Trim and upper-case a code, collapsing blank/absent values to `null`. */
function normalizeCode(value: string | undefined): string | null {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function readConfigFile(): FileConfig {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('expected a JSON object');
    }
    return parsed;
  } catch (cause) {
    throw new JiraError(`Config file at ${CONFIG_PATH} is not valid JSON.`, [
      cause instanceof Error ? cause.message : String(cause),
      'Fix the file, or delete it and use environment variables instead.',
    ]);
  }
}

/** Strip a trailing slash so path joining stays predictable. */
function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(trimmed)) {
    throw new JiraError(`JIRA_BASE_URL must start with https:// (got "${trimmed}")`, [
      'Example: https://your-team.atlassian.net',
    ]);
  }
  return trimmed;
}

/**
 * Resolve credentials from the environment first, then the config file.
 * Throws a JiraError carrying setup instructions when anything is missing.
 */
export function loadConfig(): Config {
  const file = readConfigFile();

  const baseUrl = process.env['JIRA_BASE_URL'] ?? file.baseUrl;
  const email = process.env['JIRA_EMAIL'] ?? file.email;
  const apiToken = process.env['JIRA_API_TOKEN'] ?? file.apiToken;

  const missing: string[] = [];
  if (!baseUrl) missing.push('JIRA_BASE_URL');
  if (!email) missing.push('JIRA_EMAIL');
  if (!apiToken) missing.push('JIRA_API_TOKEN');

  if (missing.length > 0 || !baseUrl || !email || !apiToken) {
    throw new JiraError(`Missing Jira credentials: ${missing.join(', ')}`, [
      'Set them in your shell:',
      '  export JIRA_BASE_URL="https://your-team.atlassian.net"',
      '  export JIRA_EMAIL="you@example.com"',
      '  export JIRA_API_TOKEN="..."',
      '',
      `Or write them to ${CONFIG_PATH}:`,
      '  { "baseUrl": "...", "email": "...", "apiToken": "..." }',
      '',
      `Create an API token at ${TOKEN_URL}`,
    ]);
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    email: email.trim(),
    apiToken: apiToken.trim(),
    issuesJql: file.issuesJql?.trim() || DEFAULT_ISSUES_JQL,
    worklogDays:
      typeof file.worklogDays === 'number' && file.worklogDays > 0
        ? Math.floor(file.worklogDays)
        : DEFAULT_WORKLOG_DAYS,
    holidayCountry: normalizeCode(process.env['JIRA_HOLIDAY_COUNTRY'] ?? file.holidayCountry),
    holidayRegion: normalizeCode(process.env['JIRA_HOLIDAY_REGION'] ?? file.holidayRegion),
  };
}
