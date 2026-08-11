[![](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner2-direct.svg)](https://github.com/vshymanskyy/StandWithUkraine/blob/main/docs/README.md)

---

# jira-dashboard (`jdb`)

A full-screen terminal dashboard for Jira Cloud, built with [Ink](https://github.com/vadimdemedes/ink).

```
┌─ last 14 days · 41.5h total ──────┬─ my open tickets (3/12) ─────────────────┐
│ Tue 28 Jul   7.5h  MR-4           │ ▸ MR-3   In Review    Fix the flaky test │
│ Wed 29 Jul   6.0h  MR-1, MR-2     │   MR-4   In Progress  Add worklog panel  │
├───────────────────────────────────┴──────────────────────────────────────────┤
│ MR-3 · 5.5h over 14d · 4h = 1 bar │ MR-3 · .../browse/MR-3                   │
│                                   │ Platform › MR-100 Q3 push › MR-3         │
│       ██       ██                 │ Fix the flaky test                       │
│    ▄▄ ██ ▄▄    ██ ██              │ type       Bug                           │
│ 16 17 18 19 20 21 22 …            │ status     In Review                     │
└───────────────────────────────────┴──────────────────────────────────────────┘
```

- **Top left** — hours you logged on each of the last 14 days (oldest first, so today is at the
  bottom), plus the issues you logged against.
- **Top right** — your open tickets (not done, not cancelled/closed, not in the backlog), selectable
  by keyboard or mouse.
- **Bottom left** — bar chart of the hours *you* logged on the **selected** ticket, day by day over
  the same 14 days. The scale is fixed so bars are comparable between tickets and between runs: 2h is
  half a row, 4h one row, 8h two rows; anything logged below 2h gets a thin mark so it stays visible.
- **Bottom right** — preview of the selected ticket: parent breadcrumbs, status, assignee, reporter,
  priority, labels, the hours *you* logged and on which dates, total logged by everyone, and the
  description.

## Install

```sh
npm install -g jira-dashboard
jdb
```

## Configure

Everything comes from the Jira Cloud REST API, authenticated with an
[API token](https://id.atlassian.com/manage-profile/security/api-tokens).

```sh
export JIRA_BASE_URL="https://your-team.atlassian.net"
export JIRA_EMAIL="you@example.com"
export JIRA_API_TOKEN="…"
```

Or write `~/.config/jira-dashboard/config.json` (environment variables win):

```json
{
  "baseUrl": "https://your-team.atlassian.net",
  "email": "you@example.com",
  "apiToken": "…",
  "issuesJql": "assignee = currentUser() AND statusCategory != Done AND status NOT IN (\"Cancelled\", \"Closed\", \"Backlog\") ORDER BY updated DESC",
  "worklogDays": 14,
  "holidayCountry": "UA",
  "holidayRegion": null
}
```

`issuesJql` is worth customising: status names vary per site, and some boards model the backlog
by sprint rather than by status — in that case append `AND sprint IS NOT EMPTY`.

### Non-working days

`holidayCountry` is an ISO-3166 alpha-2 code (`UA`, `PL`, `US`, …). Its statutory holidays are
fetched from [date.nager.at](https://date.nager.at) and cached in
`~/.config/jira-dashboard/holidays.json`; changing the country invalidates that cache, and each
year is refreshed after 30 days. Both keys can be overridden with `JIRA_HOLIDAY_COUNTRY` and
`JIRA_HOLIDAY_REGION`. If the fetch fails the dashboard falls back to the cache and starts
regardless.

Many holidays are provincial or state-level rather than nationwide — Canada's Civic Holiday on
the first Monday of August, for instance. Those are **shown rather than skipped**, but dimmed and
marked `~` instead of `*`, listing the regions that observe them; they do not excuse an empty
timesheet. Set `holidayRegion` (`"CA-ON"`, `"US-CA"`, …) and the ones covering your region become
full days off:

```
 Mon 03 Aug~🎉   0.0h (Civic Holiday / British Columbia Day … · CA-ON, …)   # region unset
 Mon 03 Aug*🎉   0.0h (Civic Holiday)                                       # holidayRegion CA-ON
```

Personal leave goes in `~/.config/jira-dashboard/days-off.json`, which you maintain by hand:

```json
["2026-08-10", { "date": "2026-08-11", "label": "moving day" }]
```

Both kinds of day show up in magenta in the two left panels — holidays marked `*🎉`, days off `·`,
holidays observed only in other regions dimmed and marked `~🎉` — and an empty day off is never
coloured red, so what is left in red is what still needs hours.

## Keys

| Key | Action |
| --- | --- |
| `↑` `↓` / `j` `k` | Move within the focused panel |
| `Enter` | Open the selected ticket in your default browser (tickets panel only) |
| `PgUp` `PgDn` | Page through the focused panel |
| `Home` / `End` | Jump to the first / last item in the focused panel |
| `g` / `G` | Jump to first / last ticket |
| `Tab` / `Shift+Tab` | Cycle panels (worklogs → tickets → preview) |
| Click | Select a ticket / focus a panel |
| Wheel | Scroll the panel under the cursor |
| `t` | Toggle the full ticket tree (show epics/stories that are not assigned to you) |
| `r` | Reload both panels |
| `q` / `Esc` / `Ctrl+C` | Quit |

## Development

```sh
npm install
npm run dev          # run from TypeScript source, no build step
npm run build        # bundle to dist/cli.js with esbuild
npm run typecheck    # tsc --noEmit
npm run check        # lint + typecheck + build; run before publishing
npm run lint
npm run lint:fix
npm run lint:staged  # lint-staged, for a pre-commit hook
```

To run `lint:staged` automatically, add a `pre-commit` hook that calls `npm run lint:staged`.

### Build

`npm run build` bundles `src/cli.tsx` into a single ESM file at `dist/cli.js` and marks it
executable. The shebang from the entry file is preserved, which is what lets `jdb` run directly.

```sh
npm run build
node dist/cli.js --version
```

Two properties of the bundle worth knowing:

- **Relative imports are written without a `.js` extension.** Node's ESM loader would reject that,
  but esbuild resolves the specifiers at build time and `tsx` does the same in dev. `tsc` is
  typecheck-only (`noEmit`), so it can never emit an unresolvable import.
- **Runtime dependencies stay external** (`--packages=external`), so only this project's own source
  is bundled; `ink` and `react` are installed normally from `dependencies`.

`prepublishOnly` runs `npm run check`, so a publish rebuilds `dist/` and aborts on a lint or type
error rather than shipping one.

### Run it locally as a global command

For day-to-day use, symlink the global `jdb` at your working copy:

```sh
npm link              # jdb -> <this repo>/dist/cli.js
npm run build         # after each source change; jdb picks it up immediately
```

To test what users actually get instead — a frozen copy built from the real tarball:

```sh
npm pack
npm install -g ./jira-dashboard-0.1.0.tgz
jdb --version
```

Undo either with `npm uninstall -g jira-dashboard` (or `npm unlink -g jira-dashboard`).

### Debugging

**Never use `console.log`.** Stdout is the UI: writing to it corrupts the frame Ink is drawing.
Log to stderr and redirect it to a file, then watch that file from another terminal:

```sh
# in the code: process.stderr.write(`selected=${key}\n`);
jdb 2> /tmp/jdb.log
tail -f /tmp/jdb.log      # in a second terminal
```

**Readable stack traces.** `dist/cli.js` is a bundle, so traces point at bundle offsets by default.
The build emits a source map; turn it on to get original file and line numbers:

```sh
node --enable-source-maps dist/cli.js
```

**Breakpoints.** Attach a debugger and open `chrome://inspect`, or use your editor's Node attach
config. Run from source so you are stepping through TypeScript rather than the bundle:

```sh
node --inspect-brk --import tsx src/cli.tsx
```

**Develop without hitting real Jira.** The app talks to nothing but the REST API, so pointing it at a
local stub is enough to work offline and to exercise edge cases (no worklogs, a ticket with no
sprint, a 401). Serve JSON for `/rest/api/3/myself`, `/rest/api/3/field`, `/rest/api/3/search/jql`,
and `/rest/api/3/issue/:key/worklog`, then:

```sh
JIRA_BASE_URL=http://localhost:7311 JIRA_EMAIL=a@b.c JIRA_API_TOKEN=t npm run dev
```

**Inspect the rendering non-interactively.** Handy in a script or when a layout bug only appears at a
particular size — `tmux` gives you the finished frame as text:

```sh
tmux new-session -d -s jdb -x 130 -y 40 'jdb'
sleep 4
tmux capture-pane -p -t jdb     # prints the rendered screen
tmux kill-session -t jdb
```

Common failure modes: if the terminal is left in a broken state after a crash, run `reset`. If panel
content wraps or the panel title disappears, a fixed-width panel is being flex-shrunk or its content
is one row taller than its height — see `PanelFrame` and the row-count arithmetic in each panel.

## Publishing to npm

The package publishes as **`jira-dashboard`** and installs the **`jdb`** command. Only `dist/` and
`README.md` ship (`files` in `package.json`); source and configs stay out of the tarball.

```sh
# 1. Authenticate (once per machine)
npm login
npm whoami

# 2. Make sure it is releasable (lint + typecheck + build)
npm run check

# 3. Inspect exactly what will be uploaded — no files are published by this
npm pack --dry-run

# 4. Bump the version (also creates a git tag when this is a git repo;
#    add --no-git-tag-version if it is not, or if you tag separately)
npm version patch      # or: minor | major

# 5. Publish. prepublishOnly rebuilds dist/ first.
npm publish

# 6. Verify the published artifact
npm view jira-dashboard version
npx --yes jira-dashboard@latest --version
```

Notes:

- **The name `jira-dashboard` was unclaimed on the public registry as of this writing**, but that can
  change at any time. If `npm publish` fails with `E403`, the name is taken — publish under a scope
  instead (`@yourname/jira-dashboard`), which additionally requires `npm publish --access public`
  since scoped packages default to private.
- **Publishing is effectively permanent.** Unpublishing is only allowed within 72 hours and a version
  number can never be reused. Prefer `npm deprecate jira-dashboard@1.2.3 "reason"` for a bad release
  and ship a fix as a new version.
- **`engines` requires Node ≥ 20** (the code uses `AbortSignal.timeout` and built-in `fetch`).
- To rehearse the whole flow without touching the public registry, publish to a local registry such
  as [Verdaccio](https://verdaccio.org/): `npm publish --registry http://localhost:4873`.
