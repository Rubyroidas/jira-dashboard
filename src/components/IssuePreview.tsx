import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import type { Issue, IssueWorklogEntry } from '../types';

interface IssuePreviewProps {
  issue: Issue | null;
  /** The current user's worklog entries for this issue, within the window. */
  worklog: IssueWorklogEntry[];
  /** How many days that worklog window covers, for labelling. */
  worklogWindowDays: number;
  focused: boolean;
  height: number;
  width: number;
  offset: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FIELD_LABEL_WIDTH = 11;

function formatUpdated(value: string | null): string {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

/** `28 Jul` from a `YYYY-MM-DD` key. */
function formatDay(key: string): string {
  const [, month = '01', day = '01'] = key.split('-');
  return `${day} ${MONTHS[Number(month) - 1] ?? month}`;
}

/** `7.5h`, or `45m` for sub-hour amounts where decimals read badly. */
function formatHours(hours: number): string {
  if (hours === 0) return '0h';
  return hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;
}

/**
 * Parent chain, most general first: project → parent → this issue.
 *
 * Jira's `parent` field only exposes one level, so a subtask shows its story but
 * not the story's epic.
 */
function breadcrumbs(issue: Issue): string {
  const parts = [issue.projectName, issue.parent && `${issue.parent.key} ${issue.parent.summary}`]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim());
  return [...parts, issue.key].join(' › ');
}

/** Hard-wrap description text so we can window it by line for scrolling. */
function wrapLines(text: string, width: number): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    if (line.length <= width) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > width) {
      const cut = rest.lastIndexOf(' ', width);
      const at = cut > width / 2 ? cut : width;
      out.push(rest.slice(0, at));
      rest = rest.slice(at).trimStart();
    }
    out.push(rest);
  }
  return out;
}

function Field({ label, value, color }: { label: string; value: string; color?: string }): ReactElement {
  return (
    <Box>
      <Box width={FIELD_LABEL_WIDTH} flexShrink={0}>
        <Text color="gray">{label}</Text>
      </Box>
      <Text color={color} wrap="truncate-end">
        {value}
      </Text>
    </Box>
  );
}

export function IssuePreview({
  issue,
  worklog,
  worklogWindowDays,
  focused,
  height,
  width,
  offset,
}: IssuePreviewProps): ReactElement {
  if (!issue) {
    return (
      <PanelFrame title="preview" focused={focused} height={height} flexGrow={1}>
        <Text color="gray">Select a ticket above to preview it.</Text>
      </PanelFrame>
    );
  }

  const loggedHours = worklog.reduce((sum, entry) => sum + entry.hours, 0);
  const loggedDates = worklog.map((entry) => `${formatDay(entry.date)} (${formatHours(entry.hours)})`);
  const myWork =
    worklog.length > 0
      ? `${formatHours(loggedHours)} · ${loggedDates.join(', ')}`
      : `nothing in the last ${worklogWindowDays} days`;

  const total =
    issue.totalTimeSpentSeconds !== null && issue.totalTimeSpentSeconds > 0
      ? `${formatHours(issue.totalTimeSpentSeconds / 3600)} logged by everyone`
      : null;

  // Breadcrumbs + summary + type/status/sprint/assignee/reporter/priority/labels/
  // your work/updated. Keep in step with the fields rendered below.
  const fieldRows = 11 + (total ? 1 : 0);
  const lines = wrapLines(issue.description || '(no description)', Math.max(20, width - 4));

  // Fields are fixed-height; the description gets the rest, minus one row for the
  // "more lines" indicator whenever it will be shown. Overshooting here makes Ink
  // clip the panel, which silently eats the title row.
  const available = Math.max(1, height - PANEL_CHROME_ROWS - fieldRows);

  // Clamp so scrolling past the end keeps the last screenful visible instead of
  // sliding into blank space.
  const start = Math.min(offset, Math.max(0, lines.length - available));
  const bodyRows = lines.length - start > available ? Math.max(1, available - 1) : available;

  const visible = lines.slice(start, start + bodyRows);
  const more = lines.length - start - visible.length;

  return (
    <PanelFrame
      title={`${issue.key} · ${issue.url}`}
      focused={focused}
      height={height}
      flexGrow={1}
    >
      <Text color="gray" wrap="truncate-end">
        {breadcrumbs(issue)}
      </Text>
      <Text bold wrap="truncate-end">
        {issue.summary}
      </Text>
      <Field label="type" value={issue.issueType || '—'} />
      <Field label="status" value={issue.status} />
      <Field label="sprint" value={issue.sprints.length > 0 ? issue.sprints.join(', ') : 'None'} />
      <Field label="assignee" value={issue.assignee ?? 'Unassigned'} />
      <Field label="reporter" value={issue.reporter ?? '—'} />
      <Field label="priority" value={issue.priority ?? '—'} />
      <Field label="labels" value={issue.labels.length > 0 ? issue.labels.join(', ') : '—'} />
      <Field
        label="your work"
        value={myWork}
        color={worklog.length > 0 ? 'green' : undefined}
      />
      {total && <Field label="total work" value={total} />}
      <Field label="updated" value={formatUpdated(issue.updated)} />

      <Box flexDirection="column">
        {visible.map((line, index) => (
          <Text key={start + index} color="white" wrap="truncate-end">
            {line || ' '}
          </Text>
        ))}
        {more > 0 && <Text color="gray">… {more} more lines (↓ to scroll)</Text>}
      </Box>
    </PanelFrame>
  );
}
