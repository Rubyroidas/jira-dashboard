export interface Config {
  baseUrl: string;
  email: string;
  apiToken: string;
  /** Overridable JQL for the open-tickets panel. */
  issuesJql: string;
  /** How many days of worklog history the left panel covers. */
  worklogDays: number;
  /** ISO-3166 alpha-2 country whose statutory holidays count as non-working days. */
  holidayCountry: string | null;
  /** Optional Nager subdivision code (e.g. "US-CA") to narrow regional holidays. */
  holidayRegion: string | null;
}

export interface Issue {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  issueType: string;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  labels: string[];
  updated: string | null;
  description: string;
  url: string;
  projectName: string | null;
  /** Immediate parent (epic for a story, story for a subtask), if any. */
  parent: { key: string; summary: string; issueType: string } | null;
  /** Total time logged on the issue by everyone, per Jira's aggregate. */
  totalTimeSpentSeconds: number | null;
  /** Sprint names the issue belongs to, active ones first; empty if none. */
  sprints: string[];
  /** True when the issue came from the user's own JQL, false for a pulled-in ancestor. */
  mine: boolean;
}

/** One rendered line of the issue tree. */
export interface IssueRow {
  issue: Issue;
  /**
   * Ancestor guides, outermost first: `true` where that ancestor still has
   * siblings below it (draw `│`), `false` where it was the last child.
   */
  guides: boolean[];
  /** Whether this node is the last child of its parent, for `└` vs `├`. */
  last: boolean;
  /** Whether the row has rows nested under it, for the folder marker. */
  hasChildren: boolean;
}

export interface WorklogDay {
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  hours: number;
  issueKeys: string[];
}

/** One day's worth of the current user's work on a single issue. */
export interface IssueWorklogEntry {
  date: string;
  hours: number;
}

export interface WorklogSummary {
  /** One row per day in the window, oldest first. */
  days: WorklogDay[];
  /** Per-issue breakdown within the same window, keyed by issue key. */
  byIssue: Record<string, IssueWorklogEntry[]>;
  /** How many days the window covers, for labelling. */
  windowDays: number;
}

export interface CurrentUser {
  accountId: string;
  displayName: string;
}

/** An error carrying user-facing remediation advice. */
export class JiraError extends Error {
  readonly hints: string[];

  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = 'JiraError';
    this.hints = hints;
  }
}

/** Async resource with independent loading/error state per panel. */
export interface Loadable<T> {
  data: T | null;
  loading: boolean;
  error: JiraError | null;
}
