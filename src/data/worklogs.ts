import type { JiraClient } from './client';
import type { Config, CurrentUser, IssueWorklogEntry, WorklogSummary } from '../types';
import type { SearchResponse } from './issues';

const WORKLOG_PAGE_SIZE = 1000;
const CONCURRENCY = 5;

interface RawWorklog {
  author?: { accountId?: string };
  started?: string;
  timeSpentSeconds?: number;
}

interface WorklogResponse {
  worklogs?: RawWorklog[];
}

/** Local `YYYY-MM-DD` key — worklog days are calendar days in the user's timezone. */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Midnight local time, `daysAgo` days back from today. */
function startOfDay(daysAgo: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/**
 * Aggregate the current user's worklogs over the last `config.worklogDays` days
 * two ways: one row per day (oldest first, zero-hour days included so the panel
 * shows a complete window) and a per-issue breakdown for the preview panel.
 */
export async function fetchWorklogDays(
  client: JiraClient,
  config: Config,
  me: CurrentUser,
): Promise<WorklogSummary> {
  const days = config.worklogDays;
  const windowStart = startOfDay(days - 1);

  const search = await client.post<SearchResponse>('/rest/api/3/search/jql', {
    jql: `worklogAuthor = currentUser() AND worklogDate >= -${days}d ORDER BY updated DESC`,
    maxResults: 200,
    fields: ['summary'],
  });

  const keys = (search.issues ?? []).map((issue) => issue.key);

  // Pre-seed every day in the window so gaps render as 0.0h.
  const buckets = new Map<string, { seconds: number; keys: Set<string> }>();
  for (let i = 0; i < days; i += 1) {
    buckets.set(localDateKey(startOfDay(i)), { seconds: 0, keys: new Set() });
  }

  // Seconds logged per issue per day: issue key → date → seconds.
  const perIssue = new Map<string, Map<string, number>>();

  const startedAfter = String(windowStart.getTime());
  await forEachLimited(keys, CONCURRENCY, async (key) => {
    const response = await client.get<WorklogResponse>(`/rest/api/3/issue/${key}/worklog`, {
      startedAfter,
      maxResults: String(WORKLOG_PAGE_SIZE),
    });

    for (const entry of response.worklogs ?? []) {
      if (entry.author?.accountId !== me.accountId || !entry.started) continue;

      const started = new Date(entry.started);
      if (Number.isNaN(started.getTime()) || started < windowStart) continue;

      const date = localDateKey(started);
      const bucket = buckets.get(date);
      if (!bucket) continue; // A worklog dated in the future.

      const seconds = entry.timeSpentSeconds ?? 0;
      bucket.seconds += seconds;
      bucket.keys.add(key);

      const issueDays = perIssue.get(key) ?? new Map<string, number>();
      issueDays.set(date, (issueDays.get(date) ?? 0) + seconds);
      perIssue.set(key, issueDays);
    }
  });

  const byIssue: Record<string, IssueWorklogEntry[]> = {};
  for (const [key, issueDays] of perIssue) {
    byIssue[key] = Array.from(issueDays.entries())
      .map(([date, seconds]) => ({ date, hours: seconds / 3600 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    days: Array.from(buckets.entries())
      .map(([date, { seconds, keys: issueKeys }]) => ({
        date,
        hours: seconds / 3600,
        issueKeys: Array.from(issueKeys).sort(compareIssueKeys),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byIssue,
    windowDays: days,
  };
}

/** Sort by project then numeric part, so MR-2 precedes MR-10. */
function compareIssueKeys(a: string, b: string): number {
  const [aProject = a, aNumber = '0'] = a.split('-');
  const [bProject = b, bNumber = '0'] = b.split('-');
  return aProject === bProject
    ? Number(aNumber) - Number(bNumber)
    : aProject.localeCompare(bProject);
}

/** Run `worker` over `items` with at most `limit` requests in flight. */
async function forEachLimited<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (item !== undefined) await worker(item);
    }
  });
  await Promise.all(runners);
}
