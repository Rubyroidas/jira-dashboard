import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import { PanelError, Spinner, spinnerChar } from './PanelStatus';
import type { Loadable, WorklogSummary } from '../types';

interface WorklogPanelProps {
  state: Loadable<WorklogSummary>;
  focused: boolean;
  height: number;
  width: number;
  offset: number;
  spinnerFrame: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `Mon 28 Jul` from a `YYYY-MM-DD` key, parsed as a local date. */
function formatDate(key: string): string {
  const [year = '1970', month = '01', day = '01'] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return `${WEEKDAYS[date.getDay()]} ${day} ${MONTHS[date.getMonth()]}`;
}

function isWeekend(key: string): boolean {
  const [year = '1970', month = '01', day = '01'] = key.split('-');
  const weekday = new Date(Number(year), Number(month) - 1, Number(day)).getDay();
  return weekday === 0 || weekday === 6;
}

/** Colour hours by how close the day is to a full working day. */
function hoursColor(hours: number, weekend: boolean): string {
  if (hours === 0) return weekend ? 'gray' : 'red';
  if (hours < 6) return 'yellow';
  return 'green';
}

export function WorklogPanel({
  state,
  focused,
  height,
  width,
  offset,
  spinnerFrame,
}: WorklogPanelProps): ReactElement {
  const days = state.data?.days ?? [];
  const visibleRows = Math.max(1, height - PANEL_CHROME_ROWS);
  const total = days.reduce((sum, day) => sum + day.hours, 0);
  // Panel width minus borders, padding, date column and hours column.
  const keysWidth = Math.max(6, width - 4 - 12 - 7);

  const base =
    days.length > 0
      ? `last ${days.length} days · ${total.toFixed(1)}h total`
      : `last ${days.length || 14} days`;
  // Reloading keeps the old rows on screen, so the spinner moves into the title.
  const title = state.loading && days.length > 0 ? `${spinnerChar(spinnerFrame)} ${base}` : base;

  return (
    <PanelFrame title={title} focused={focused} height={height} width={width}>
      {state.loading && days.length === 0 ? (
        <Spinner label="loading worklogs…" frame={spinnerFrame} />
      ) : state.error ? (
        <PanelError error={state.error} />
      ) : (
        <Box flexDirection="column">
          {days.slice(offset, offset + visibleRows).map((day) => {
            const weekend = isWeekend(day.date);
            const keys = day.issueKeys.length > 0 ? day.issueKeys.join(', ') : '—';
            return (
              <Box key={day.date}>
                <Box width={12} flexShrink={0}>
                  <Text color={weekend ? 'gray' : 'white'}>{formatDate(day.date)}</Text>
                </Box>
                <Box width={7} flexShrink={0}>
                  <Text color={hoursColor(day.hours, weekend)}>
                    {`${day.hours.toFixed(1)}h`.padStart(6)}
                  </Text>
                </Box>
                <Box width={keysWidth} flexShrink={1}>
                  <Text color="gray" wrap="truncate-end">
                    {keys}
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
