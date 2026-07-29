import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import { PanelError, Spinner, spinnerChar } from './PanelStatus';
import type { Issue, Loadable } from '../types';

interface IssueListProps {
  state: Loadable<Issue[]>;
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

const KEY_WIDTH = 10;
const STATUS_WIDTH = 14;

export function IssueList({
  state,
  focused,
  height,
  width,
  selectedIndex,
  offset,
  spinnerFrame,
}: IssueListProps): ReactElement {
  const issues = state.data ?? [];
  const visibleRows = Math.max(1, height - PANEL_CHROME_ROWS);
  const summaryWidth = Math.max(8, width - 4 - 2 - KEY_WIDTH - STATUS_WIDTH);

  const base =
    issues.length > visibleRows
      ? `my open tickets (${selectedIndex + 1}/${issues.length})`
      : `my open tickets (${issues.length})`;
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
          {issues.slice(offset, offset + visibleRows).map((issue, index) => {
            const selected = offset + index === selectedIndex;
            return (
              <Box key={issue.key}>
                <Box width={2} flexShrink={0}>
                  <Text color="cyan">{selected ? '▸ ' : '  '}</Text>
                </Box>
                <Box width={KEY_WIDTH} flexShrink={0}>
                  <Text bold={selected} color={selected ? 'cyan' : 'white'} wrap="truncate-end">
                    {issue.key}
                  </Text>
                </Box>
                <Box width={STATUS_WIDTH} flexShrink={0}>
                  <Text color={statusColor(issue.statusCategory)} wrap="truncate-end">
                    {issue.status}
                  </Text>
                </Box>
                <Box width={summaryWidth} flexShrink={1}>
                  <Text
                    color={selected ? 'white' : 'gray'}
                    bold={selected}
                    inverse={selected && focused}
                    wrap="truncate-end"
                  >
                    {issue.summary}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </PanelFrame>
  );
}
