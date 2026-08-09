import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import { PANEL_CHROME_ROWS, PanelFrame } from './PanelFrame';
import { PanelError, Spinner } from './PanelStatus';
import type { DayMarks } from '../data/calendar';
import { dayOfMonth, isToday, isWeekend, MONTHS } from '../dates';
import type { Loadable, WorklogDay, WorklogSummary } from '../types';

interface WorkChartPanelProps {
  /** One entry per day in the window, oldest first, already scoped to an issue. */
  days: WorklogDay[];
  /** The issue the bars belong to; `null` when nothing is selected. */
  issueKey: string | null;
  /** Loading/error state of the worklog fetch the days come from. */
  state: Loadable<WorklogSummary>;
  focused: boolean;
  height: number;
  width: number;
  spinnerFrame: number;
  /** Holidays and personal days off, so a bare column can be read as expected. */
  dayMarks: DayMarks;
}

/** One full row of bar equals this many hours; half a row equals half of it. */
export const HOURS_PER_BAR = 4;

/** Rows reserved at the bottom for the day labels. */
const LABEL_ROWS = 1;

/** A full working day is two rows, so never draw a shorter plot than that. */
const MIN_BAR_ROWS = 2;

const FULL_BLOCK = '█';
const HALF_BLOCK = '▄';
/** Anything logged but under half a bar, so a short day still reads as worked. */
const TRACE_BLOCK = '▁';

/** Borders (2) + horizontal padding (2), plus one spare column of slack. */
const PANEL_SIDE_COLUMNS = 5;

/** Marks a non-working day that has no bar, which would otherwise be blank. */
const REST_DOT = '·';

/**
 * Width the chart needs for `dayCount` bars at the given bar width, including a
 * one-column gap between bars. A row that overflows by even one column wraps and
 * destroys the chart, so this has to be exact.
 */
export function chartWidthFor(dayCount: number, barWidth: number): number {
  const bars = dayCount * barWidth + Math.max(0, dayCount - 1);
  return bars + PANEL_SIDE_COLUMNS;
}

/**
 * Vertical bar chart of hours logged per day on one issue.
 *
 * The scale is fixed rather than fitted to the data, so a bar height means the
 * same thing between issues and between reloads: 2h is half a row, 4h one row,
 * 8h two rows.
 */
export function WorkChartPanel({
  days,
  issueKey,
  state,
  focused,
  height,
  width,
  spinnerFrame,
  dayMarks,
}: WorkChartPanelProps): ReactElement {
  if (state.loading && days.length === 0) {
    return (
      <PanelFrame title="logged work" focused={focused} height={height} width={width}>
        <Spinner label="loading…" frame={spinnerFrame} />
      </PanelFrame>
    );
  }
  if (state.error) {
    return (
      <PanelFrame title="logged work" focused={focused} height={height} width={width}>
        <PanelError error={state.error} />
      </PanelFrame>
    );
  }
  if (!issueKey || days.length === 0) {
    return (
      <PanelFrame title="logged work" focused={focused} height={height} width={width}>
        <Text color="gray">Select a ticket to see your work on it.</Text>
      </PanelFrame>
    );
  }

  // Two columns per bar reads better, but fall back to one when space is tight.
  const barWidth = chartWidthFor(days.length, 2) <= width ? 2 : 1;

  const tallest = days.reduce((max, day) => Math.max(max, day.hours), 0);
  const roomForRows = Math.max(1, height - PANEL_CHROME_ROWS - LABEL_ROWS);
  const barRows = Math.min(roomForRows, Math.max(MIN_BAR_ROWS, Math.ceil(tallest / HOURS_PER_BAR)));

  // Drawn top-down, so the first row is the highest and the last is the baseline.
  const rows = Array.from({ length: barRows }, (_, index) => barRows - 1 - index);

  const total = days.reduce((sum, day) => sum + day.hours, 0);
  const clipped = tallest / HOURS_PER_BAR > barRows;
  const title =
    `${issueKey} · ${total.toFixed(1)}h over ${days.length}d · ${HOURS_PER_BAR}h = 1 bar` +
    (clipped ? ` · peak ${tallest.toFixed(1)}h` : '');

  return (
    <PanelFrame title={title} focused={focused} height={height} width={width}>
      {/* Bars grow upward from a baseline pinned to the bottom of the panel. */}
      <Box flexDirection="column" flexGrow={1} justifyContent="flex-end">
        {/* An all-blank plot reads as broken, so say so instead. */}
        {total === 0 && <Text color="gray">no time logged in this window</Text>}
        {total > 0 &&
          rows.map((rowFromBottom) => (
            <Text key={rowFromBottom}>
              {days.map((day, index) => {
                // Only days that are actually off for you get the rest treatment;
                // a holiday observed elsewhere is still a working day here.
                const rest = dayMarks.get(day.date)?.observed === true;
                // A rest day with no bar still gets a baseline dot, so it never
                // reads as an unexplained gap.
                const glyph =
                  rest && day.hours === 0 && rowFromBottom === 0
                    ? REST_DOT
                    : glyphFor(day.hours, rowFromBottom);
                return (
                  <Text key={day.date}>
                    {index > 0 ? ' ' : ''}
                    <Text color={barColor(day, rest)}>{glyph.repeat(barWidth)}</Text>
                  </Text>
                );
              })}
            </Text>
          ))}

        {barWidth >= 2 ? (
          <Text>
            {days.map((day, index) => (
              <Text key={day.date}>
                {index > 0 ? ' ' : ''}
                <Text
                  color={
                    isToday(day.date)
                      ? 'cyan'
                      : dayMarks.get(day.date)?.observed
                        ? 'magenta'
                        : 'gray'
                  }
                  bold={isToday(day.date)}
                >
                  {dayOfMonth(day.date)}
                </Text>
              </Text>
            ))}
          </Text>
        ) : (
          // One column per bar leaves no room for a label per day; a date range
          // reads better than a row of single digits.
          <Text color="gray" wrap="truncate-end">
            {rangeLabel(days)}
          </Text>
        )}
      </Box>
    </PanelFrame>
  );
}

/**
 * Which block character a bar shows on a given row.
 *
 * `rowFromBottom` 0 is the baseline. A row is a full block once the day's hours
 * reach its top and a half block once they reach its middle, so 2h renders as a
 * half block sitting on the baseline. Below that, any logged time still gets a
 * thin mark — an hour of work must not look the same as none.
 */
function glyphFor(hours: number, rowFromBottom: number): string {
  const rowsFilled = hours / HOURS_PER_BAR - rowFromBottom;
  if (rowsFilled >= 1) return FULL_BLOCK;
  if (rowsFilled >= 0.5) return HALF_BLOCK;
  if (rowsFilled > 0) return TRACE_BLOCK;
  return ' ';
}

/** Rest days are tinted differently so an empty column reads as expected. */
function barColor(day: WorklogDay, rest: boolean): string {
  if (rest) return 'magenta';
  if (day.hours === 0) return 'gray';
  return isWeekend(day.date) ? 'blue' : 'green';
}

/** `16 Jul → 29 Jul`, for when per-bar labels do not fit. */
function rangeLabel(days: WorklogDay[]): string {
  const format = (key: string): string => {
    const [, month = '01', day = '01'] = key.split('-');
    return `${day} ${MONTHS[Number(month) - 1] ?? month}`;
  };
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  return first && last ? `${format(first)} → ${format(last)}` : '';
}
