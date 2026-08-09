import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import { PanelError, Spinner, spinnerChar } from './PanelStatus';
import { isNonWorkingDay, type DayMark, type DayMarks } from '../data/calendar';
import { formatDate, isWeekend } from '../dates';
import type { Loadable, WorklogSummary } from '../types';

interface WorklogPanelProps {
  state: Loadable<WorklogSummary>;
  focused: boolean;
  height: number;
  width: number;
  offset: number;
  spinnerFrame: number;
  /** Holidays and personal days off, so empty days can be told apart. */
  dayMarks: DayMarks;
}

/**
 * `Mon 28 Jul` (10) plus a marker glyph and a two-cell emoji badge, and one
 * column of gap before the hours.
 */
const DATE_WIDTH = 14;

/** Colour hours by how close the day is to a full working day. */
function hoursColor(hours: number, nonWorking: boolean): string {
  if (hours === 0) return nonWorking ? 'gray' : 'red';
  if (hours < 6) return 'yellow';
  return 'green';
}

/** A trailing glyph on the date keeps holidays legible without extra columns. */
function markGlyph(mark: DayMark | undefined): string {
  if (!mark) return '';
  if (mark.kind === 'dayoff') return '·';
  // A holiday you do not observe is worth knowing about, but it is not your day off.
  return mark.observed ? '*' : '~';
}

/**
 * Statutory holidays get a badge next to the date; personal leave keeps its
 * plainer `·`, so the emoji stays a reliable "public holiday" signal.
 */
function markBadge(mark: DayMark | undefined): string {
  return mark?.kind === 'holiday' ? '🎉' : '';
}

export function WorklogPanel({
  state,
  focused,
  height,
  width,
  offset,
  spinnerFrame,
  dayMarks,
}: WorklogPanelProps): ReactElement {
  const days = state.data?.days ?? [];
  const visibleRows = Math.max(1, height - PANEL_CHROME_ROWS);
  const total = days.reduce((sum, day) => sum + day.hours, 0);
  // Panel width minus borders, padding, date column and hours column.
  const keysWidth = Math.max(6, width - 4 - DATE_WIDTH - 7);

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
            const mark = dayMarks.get(day.date);
            const weekend = isWeekend(day.date);
            const nonWorking = isNonWorkingDay(day.date, dayMarks);
            // With nothing logged, the reason the day is empty is the useful thing to show.
            const keys =
              day.issueKeys.length > 0 ? day.issueKeys.join(', ') : mark ? `(${mark.label})` : '—';
            return (
              <Box key={day.date}>
                <Box width={DATE_WIDTH} flexShrink={0}>
                  <Text
                    color={mark ? 'magenta' : weekend ? 'gray' : 'white'}
                    dimColor={mark !== undefined && !mark.observed}
                  >
                    {formatDate(day.date) + markGlyph(mark) + markBadge(mark)}
                  </Text>
                </Box>
                <Box width={7} flexShrink={0}>
                  <Text color={hoursColor(day.hours, nonWorking)}>
                    {`${day.hours.toFixed(1)}h`.padStart(6)}
                  </Text>
                </Box>
                <Box width={keysWidth} flexShrink={1}>
                  <Text
                    color={mark && day.issueKeys.length === 0 ? 'magenta' : 'gray'}
                    dimColor={mark !== undefined && !mark.observed}
                    wrap="truncate-end"
                  >
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
