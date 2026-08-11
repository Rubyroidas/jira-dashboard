import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import { PanelError, Spinner, spinnerChar } from './PanelStatus';
import { folderMark, treePrefix } from '../tree';
import type { Issue, IssueRow, Loadable } from '../types';

interface IssueListProps {
  state: Loadable<Issue[]>;
  rows: IssueRow[];
  fullTree: boolean;
  focused: boolean;
  height: number;
  width: number;
  selectedIndex: number;
  offset: number;
  spinnerFrame: number;
}

/** Status colouring keyed on Jira's status category, which is stable per site. */
function statusColor(category: string): string {
  switch (category.toLowerCase()) {
    case 'in progress':
      return 'yellow';
    case 'done':
      return 'green';
    default:
      return 'blue';
  }
}

/** Truncate or pad `text` so a cell always covers exactly `width` columns. */
function fit(text: string, width: number): string {
  if (width <= 0) return '';
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text.padEnd(width);
}

const KEY_WIDTH = 10;
const STATUS_WIDTH = 14;

export function IssueList({
  state,
  rows,
  fullTree,
  focused,
  height,
  width,
  selectedIndex,
  offset,
  spinnerFrame,
}: IssueListProps): ReactElement {
  const issues = state.data ?? [];
  const visibleRows = Math.max(1, height - PANEL_CHROME_ROWS);

  // One gutter width for the whole list keeps the key/status columns aligned,
  // and it is capped so deep trees cannot squeeze the summary off screen.
  // +2 for the folder marker column that follows the branch glyphs.
  const gutterWidth = Math.min(
    Math.max(0, Math.floor(width / 4)),
    rows.reduce((widest, row) => Math.max(widest, treePrefix(row).length + 2), 0),
  );
  const summaryWidth = Math.max(8, width - 4 - 2 - gutterWidth - KEY_WIDTH - STATUS_WIDTH);

  const label = fullTree ? 'my tickets · full tree' : 'my open tickets';
  const base =
    rows.length > visibleRows
      ? `${label} (${selectedIndex + 1}/${rows.length})`
      : `${label} (${rows.length})`;
  // Reloading keeps the old rows on screen, so the spinner moves into the title.
  const title = state.loading && issues.length > 0 ? `${spinnerChar(spinnerFrame)} ${base}` : base;

  return (
    <PanelFrame title={title} focused={focused} height={height} flexGrow={1}>
      {state.loading && issues.length === 0 ? (
        <Spinner label="loading tickets…" frame={spinnerFrame} />
      ) : state.error ? (
        <PanelError error={state.error} />
      ) : issues.length === 0 ? (
        <Text color="gray">No open tickets matched the query.</Text>
      ) : (
        <Box flexDirection="column">
          {rows.slice(offset, offset + visibleRows).map((row, index) => {
            const issue = row.issue;
            const selected = offset + index === selectedIndex;
            // The highlight has to paint the padding too, so every cell is
            // padded to its column width instead of relying on Box layout.
            const background = selected ? (focused ? 'cyan' : 'blue') : undefined;
            const cellColor = (own: string): string => (selected ? 'black' : own);
            return (
              <Box key={issue.key}>
                <Text color={cellColor('cyan')} backgroundColor={background}>
                  {selected ? '▸ ' : '  '}
                </Text>
                {gutterWidth > 0 ? (
                  <Text color={cellColor('gray')} backgroundColor={background}>
                    {fit(`${treePrefix(row)}${folderMark(row)} `, gutterWidth)}
                  </Text>
                ) : null}
                <Text
                  bold={selected}
                  color={cellColor(issue.mine ? 'white' : 'gray')}
                  backgroundColor={background}
                >
                  {fit(issue.key, KEY_WIDTH)}
                </Text>
                <Text
                  color={cellColor(statusColor(issue.statusCategory))}
                  backgroundColor={background}
                >
                  {fit(issue.status, STATUS_WIDTH)}
                </Text>
                <Text
                  color={cellColor('gray')}
                  bold={selected}
                  backgroundColor={background}
                >
                  {fit(issue.summary, summaryWidth)}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </PanelFrame>
  );
}
