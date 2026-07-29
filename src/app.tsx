import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';

import { IssueList } from './components/IssueList';
import { IssuePreview } from './components/IssuePreview';
import { PANEL_HEADER_ROWS } from './components/PanelFrame';
import { spinnerChar } from './components/PanelStatus';
import { chartWidthFor, WorkChartPanel } from './components/WorkChartPanel';
import { WorklogPanel } from './components/WorklogPanel';
import type { JiraClient } from './data/client';
import { fetchOpenIssues } from './data/issues';
import { fetchWorklogDays } from './data/worklogs';
import { useHomeEndKeys } from './hooks/useHomeEndKeys';
import { isMouseSequence, useMouse, type MouseEvent } from './hooks/useMouse';
import { useTerminalSize } from './hooks/useTerminalSize';
import { openUrl } from './openUrl';
import { JiraError } from './types';
import type { Config, CurrentUser, Issue, Loadable, WorklogDay, WorklogSummary } from './types';

interface AppProps {
  config: Config;
  client: JiraClient;
  me: CurrentUser;
}

type Panel = 'worklog' | 'issues' | 'preview';
const PANEL_ORDER: Panel[] = ['worklog', 'issues', 'preview'];

const MIN_TOP_HEIGHT = 6;
const MIN_LEFT_WIDTH = 34;
const SPINNER_INTERVAL_MS = 90;
const NOTICE_TIMEOUT_MS = 3000;

const pending = <T,>(previous?: Loadable<T>): Loadable<T> => ({
  data: previous?.data ?? null,
  loading: true,
  error: null,
});

function toJiraError(cause: unknown): JiraError {
  if (cause instanceof JiraError) return cause;
  return new JiraError(cause instanceof Error ? cause.message : String(cause));
}

export function App({ config, client, me }: AppProps): ReactElement {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  const [worklogs, setWorklogs] = useState<Loadable<WorklogSummary>>(() => pending());
  const [issues, setIssues] = useState<Loadable<Issue[]>>(() => pending());
  const [focus, setFocus] = useState<Panel>('issues');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [issueOffset, setIssueOffset] = useState(0);
  const [worklogOffset, setWorklogOffset] = useState(0);
  const [previewOffset, setPreviewOffset] = useState(0);
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  // ---- layout -------------------------------------------------------------
  const topHeight = Math.max(MIN_TOP_HEIGHT, Math.floor((rows - 1) / 2));
  const bottomHeight = Math.max(MIN_TOP_HEIGHT, rows - 1 - topHeight);
  const leftWidth = Math.max(MIN_LEFT_WIDTH, Math.min(52, Math.floor(columns * 0.42)));
  const issueRows = Math.max(1, topHeight - 3);
  const worklogRows = issueRows;

  // The chart takes the width its bars need, but never more than half the screen;
  // the preview gets the rest.
  const dayCount = worklogs.data?.days.length ?? config.worklogDays;
  const chartWidth = Math.min(
    Math.floor(columns / 2),
    Math.max(chartWidthFor(dayCount, 1), Math.min(chartWidthFor(dayCount, 2), columns - 40)),
  );

  // ---- data ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    setIssues(pending);
    fetchOpenIssues(client, config)
      .then((data) => {
        if (!cancelled) setIssues({ data, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setIssues({ data: null, loading: false, error: toJiraError(cause) });
      });

    setWorklogs(pending);
    fetchWorklogDays(client, config, me)
      .then((data) => {
        if (!cancelled) setWorklogs({ data, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) setWorklogs({ data: null, loading: false, error: toJiraError(cause) });
      });

    return () => {
      cancelled = true;
    };
  }, [client, config, me, reloadToken]);

  const loading = worklogs.loading || issues.loading;

  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setSpinnerFrame((frame) => frame + 1);
    }, SPINNER_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [loading]);

  const issueList = issues.data ?? [];
  const selected = issueList[selectedIndex] ?? null;

  // Keep the selection valid when a reload returns a shorter list.
  useEffect(() => {
    setSelectedIndex((index) => Math.min(index, Math.max(0, issueList.length - 1)));
  }, [issueList.length]);

  // Days run oldest-first, so today sits at the bottom — start scrolled there.
  useEffect(() => {
    setWorklogOffset(Math.max(0, (worklogs.data?.days.length ?? 0) - worklogRows));
  }, [worklogs.data, worklogRows]);

  // Reading a new ticket always starts at the top of its description.
  useEffect(() => {
    setPreviewOffset(0);
  }, [selected?.key]);

  // ---- selection ----------------------------------------------------------
  const selectIndex = useCallback(
    (next: number) => {
      if (issueList.length === 0) return;
      const clamped = Math.max(0, Math.min(next, issueList.length - 1));
      setSelectedIndex(clamped);
      setIssueOffset((offset) => {
        if (clamped < offset) return clamped;
        if (clamped >= offset + issueRows) return clamped - issueRows + 1;
        return offset;
      });
    },
    [issueList.length, issueRows],
  );

  const scrollPanel = useCallback(
    (panel: Panel, delta: number) => {
      switch (panel) {
        case 'issues':
          selectIndex(selectedIndex + delta);
          break;
        case 'worklog':
          setWorklogOffset((offset) =>
            Math.max(0, Math.min(offset + delta, (worklogs.data?.days.length ?? 0) - worklogRows)),
          );
          break;
        case 'preview':
          setPreviewOffset((offset) => Math.max(0, offset + delta));
          break;
      }
    },
    [selectIndex, selectedIndex, worklogs.data?.days.length, worklogRows],
  );

  /**
   * The selected issue's hours across the whole window, zero-filled.
   *
   * `byIssue` only holds days that have work, so the days axis comes from the
   * summary to keep every ticket's chart on the same 14-day scale.
   */
  const chartDays = useMemo<WorklogDay[]>(() => {
    const summary = worklogs.data;
    if (!summary || !selected) return [];

    const hoursByDate = new Map(
      (summary.byIssue[selected.key] ?? []).map((entry) => [entry.date, entry.hours]),
    );
    return summary.days.map((day) => ({
      date: day.date,
      hours: hoursByDate.get(day.date) ?? 0,
      issueKeys: [],
    }));
  }, [worklogs.data, selected]);

  // Notices are transient; clearing on a timer keeps the status bar honest.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, NOTICE_TIMEOUT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [notice]);

  const openSelected = useCallback(() => {
    if (!selected) return;
    openUrl(selected.url)
      .then(() => {
        setNotice({ text: `opened ${selected.key} in your browser`, error: false });
      })
      .catch((cause: unknown) => {
        setNotice({
          text: cause instanceof Error ? cause.message : String(cause),
          error: true,
        });
      });
  }, [selected]);

  // Home/End jump to the ends of whichever panel has focus.
  const goToStart = useCallback(() => {
    switch (focus) {
      case 'issues':
        selectIndex(0);
        break;
      case 'worklog':
        setWorklogOffset(0);
        break;
      case 'preview':
        setPreviewOffset(0);
        break;
    }
  }, [focus, selectIndex]);

  const goToEnd = useCallback(() => {
    switch (focus) {
      case 'issues':
        selectIndex(issueList.length - 1);
        break;
      case 'worklog':
        setWorklogOffset(Math.max(0, (worklogs.data?.days.length ?? 0) - worklogRows));
        break;
      case 'preview':
        // The description's total line count lives inside the preview, so there
        // is no "last line" to jump to from here.
        break;
    }
  }, [focus, issueList.length, selectIndex, worklogs.data?.days.length, worklogRows]);

  useHomeEndKeys(goToStart, goToEnd);

  // ---- mouse --------------------------------------------------------------
  const layout = useRef({ leftWidth, topHeight, issueRows, issueOffset });
  layout.current = { leftWidth, topHeight, issueRows, issueOffset };

  const onMouse = useCallback(
    (event: MouseEvent) => {
      const { leftWidth: left, topHeight: top, issueRows: visible, issueOffset: offset } =
        layout.current;

      const panel: Panel =
        event.row >= top ? 'preview' : event.column >= left ? 'issues' : 'worklog';

      if (event.type === 'wheel') {
        setFocus(panel);
        scrollPanel(panel, event.direction === 'up' ? -1 : 1);
        return;
      }

      setFocus(panel);
      if (panel !== 'issues') return;

      const row = event.row - PANEL_HEADER_ROWS;
      if (row >= 0 && row < visible) selectIndex(offset + row);
    },
    [scrollPanel, selectIndex],
  );

  useMouse(onMouse);

  // ---- keyboard -----------------------------------------------------------
  useInput((input, key) => {
    if (isMouseSequence(input)) return; // Ink also sees the raw mouse bytes.

    if (key.ctrl && input === 'c') {
      exit();
      return;
    }
    if (input === 'q' || key.escape) {
      exit();
      return;
    }
    if (input === 'r') {
      setReloadToken((token) => token + 1);
      return;
    }
    if (key.return && focus === 'issues') {
      openSelected();
      return;
    }
    if (key.tab) {
      const step = key.shift ? -1 : 1;
      setFocus((current) => {
        const next = (PANEL_ORDER.indexOf(current) + step + PANEL_ORDER.length) % PANEL_ORDER.length;
        return PANEL_ORDER[next] ?? 'issues';
      });
      return;
    }

    // A held key arrives as one chunk ("jjj"), so count the repeats.
    if (key.downArrow) scrollPanel(focus, 1);
    else if (key.upArrow) scrollPanel(focus, -1);
    else if (key.pageDown) scrollPanel(focus, issueRows);
    else if (key.pageUp) scrollPanel(focus, -issueRows);
    else if (/^j+$/.test(input)) scrollPanel(focus, input.length);
    else if (/^k+$/.test(input)) scrollPanel(focus, -input.length);
    else if (input === 'g') scrollPanel(focus, -Number.MAX_SAFE_INTEGER);
    else if (input === 'G') selectIndex(issueList.length - 1);
  });

  const hint = useMemo(
    () =>
      focus === 'issues'
        ? '↑↓/jk move · home/end first/last · enter open · tab panel · r reload · q quit'
        : '↑↓/jk scroll · home/end top/bottom · tab panel · r reload · q quit',
    [focus],
  );

  return (
    <Box flexDirection="column" width={columns} height={rows}>
      <Box flexDirection="row" height={topHeight} flexShrink={0}>
        <WorklogPanel
          state={worklogs}
          focused={focus === 'worklog'}
          height={topHeight}
          width={leftWidth}
          offset={worklogOffset}
          spinnerFrame={spinnerFrame}
        />
        <IssueList
          state={issues}
          focused={focus === 'issues'}
          height={topHeight}
          width={columns - leftWidth}
          selectedIndex={selectedIndex}
          offset={issueOffset}
          spinnerFrame={spinnerFrame}
        />
      </Box>

      <Box flexDirection="row" height={bottomHeight} flexShrink={0}>
        <WorkChartPanel
          days={chartDays}
          issueKey={selected?.key ?? null}
          state={worklogs}
          focused={false}
          height={bottomHeight}
          width={chartWidth}
          spinnerFrame={spinnerFrame}
        />
        <IssuePreview
          issue={selected}
          worklog={(selected && worklogs.data?.byIssue[selected.key]) || []}
          worklogWindowDays={worklogs.data?.windowDays ?? config.worklogDays}
          focused={focus === 'preview'}
          height={bottomHeight}
          width={columns - chartWidth}
          offset={previewOffset}
        />
      </Box>

      <Box height={1} flexShrink={0} justifyContent="space-between">
        <Text color="gray" wrap="truncate-end">
          {' '}
          {hint}
        </Text>
        {notice ? (
          <Text color={notice.error ? 'red' : 'green'} wrap="truncate-end">
            {notice.error ? '✖' : '✓'} {notice.text}{' '}
          </Text>
        ) : loading ? (
          <Text color="cyan" wrap="truncate-end">
            {spinnerChar(spinnerFrame)} loading…{' '}
          </Text>
        ) : (
          <Text color="gray" wrap="truncate-end">
            {me.displayName}{' '}
          </Text>
        )}
      </Box>
    </Box>
  );
}
