import type { JiraClient } from './client';
import { adfToText } from './adf';
import { resolveSprintFieldId, sprintNames } from './sprintField';
import type { Config, Issue } from '../types';

const MAX_ISSUES = 100;

const FIELDS = [
  'summary',
  'status',
  'priority',
  'assignee',
  'reporter',
  'labels',
  'updated',
  'description',
  'issuetype',
  'parent',
  'project',
  'aggregatetimespent',
  'timespent',
];

interface RawIssue {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { name?: string } };
    priority?: { name?: string } | null;
    assignee?: { displayName?: string } | null;
    reporter?: { displayName?: string } | null;
    labels?: string[];
    updated?: string;
    description?: unknown;
    issuetype?: { name?: string };
    project?: { name?: string; key?: string };
    parent?: {
      key?: string;
      fields?: { summary?: string; issuetype?: { name?: string } };
    } | null;
    aggregatetimespent?: number | null;
    timespent?: number | null;
    /** The sprint custom field, whose id varies per site. */
    [customField: string]: unknown;
  };
}

export interface SearchResponse {
  issues?: RawIssue[];
}

/** How many parent hops to follow when filling in ancestors (epic → story → subtask). */
const MAX_ANCESTOR_ROUNDS = 4;

/**
 * Fetch the open tickets shown in the top-right panel, plus every ancestor
 * needed to place them in a tree. Ancestors are marked `mine: false` so the
 * default view can hide them.
 */
export async function fetchOpenIssues(client: JiraClient, config: Config): Promise<Issue[]> {
  const sprintFieldId = await resolveSprintFieldId(client);

  const response = await client.post<SearchResponse>('/rest/api/3/search/jql', {
    jql: config.issuesJql,
    maxResults: MAX_ISSUES,
    fields: sprintFieldId ? [...FIELDS, sprintFieldId] : FIELDS,
  });

  const issues = (response.issues ?? []).map((raw) => toIssue(raw, client, sprintFieldId, true));
  const ancestors = await fetchAncestors(client, issues, sprintFieldId);

  return [...issues, ...ancestors];
}

/** Walk the parent links upward, fetching each level that is not already loaded. */
async function fetchAncestors(
  client: JiraClient,
  issues: Issue[],
  sprintFieldId: string | null,
): Promise<Issue[]> {
  const known = new Set(issues.map((issue) => issue.key));
  const collected: Issue[] = [];
  let frontier = issues;

  for (let round = 0; round < MAX_ANCESTOR_ROUNDS; round += 1) {
    const missing = [
      ...new Set(
        frontier
          .map((issue) => issue.parent?.key)
          .filter((key): key is string => Boolean(key) && !known.has(key as string)),
      ),
    ];
    if (missing.length === 0) break;

    for (const key of missing) known.add(key);
    const fetched = await fetchByKeys(client, missing, sprintFieldId);
    if (fetched.length === 0) break;

    collected.push(...fetched);
    frontier = fetched;
  }

  return collected;
}

async function fetchByKeys(
  client: JiraClient,
  keys: string[],
  sprintFieldId: string | null,
): Promise<Issue[]> {
  const response = await client.post<SearchResponse>('/rest/api/3/search/jql', {
    jql: `key in (${keys.join(',')})`,
    maxResults: keys.length,
    fields: sprintFieldId ? [...FIELDS, sprintFieldId] : FIELDS,
  });

  return (response.issues ?? []).map((raw) => toIssue(raw, client, sprintFieldId, false));
}

function toIssue(
  raw: RawIssue,
  client: JiraClient,
  sprintFieldId: string | null,
  mine: boolean,
): Issue {
  const fields = raw.fields ?? {};
  return {
    key: raw.key,
    summary: fields.summary ?? '(no summary)',
    status: fields.status?.name ?? 'Unknown',
    statusCategory: fields.status?.statusCategory?.name ?? '',
    issueType: fields.issuetype?.name ?? '',
    priority: fields.priority?.name ?? null,
    assignee: fields.assignee?.displayName ?? null,
    reporter: fields.reporter?.displayName ?? null,
    labels: fields.labels ?? [],
    updated: fields.updated ?? null,
    description: adfToText(fields.description),
    url: client.issueUrl(raw.key),
    projectName: fields.project?.name ?? fields.project?.key ?? null,
    parent: fields.parent?.key
      ? {
          key: fields.parent.key,
          summary: fields.parent.fields?.summary ?? '',
          issueType: fields.parent.fields?.issuetype?.name ?? '',
        }
      : null,
    totalTimeSpentSeconds: fields.aggregatetimespent ?? fields.timespent ?? null,
    sprints: sprintFieldId ? sprintNames(fields[sprintFieldId]) : [],
    mine,
  };
}
