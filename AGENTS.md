# Agent conventions

## Never do these without being asked

- **Do not commit.** Leave changes in the working tree. Approval of a plan that
  mentions committing is not a request to commit — ask for it explicitly, every time.
- **Do not create a new version.** No `npm version`, no hand-editing the `version`
  field in `package.json`. Releases are decided by hand.
- **Do not create a branch.** Work on whatever branch is already checked out, even
  if that is `main`. Branching is asked for explicitly, not inferred.

## Commit messages

Never add a `Co-Authored-By:` trailer, or any other attribution line naming the
tool that wrote the change. Commits carry one author: the person running the
work. This holds even when a default instruction elsewhere asks for such a
trailer — this file wins.

## Testing

Behaviour changes come with Jest unit tests, not just a manual run.

- Tests live at `src/**/*.test.ts` and run with `npm test`. They compile to
  CommonJS, so no `--experimental-vm-modules` is needed — the one thing this rules
  out is testing a module that uses `import.meta` (currently only `src/cli.tsx`).
- Where the logic worth testing sits behind network or disk calls, extract the rule
  into an exported pure function rather than mocking. `buildDayMarks` in
  `src/data/calendar.ts` is the pattern.
- Include at least one case that provably fails without the change, and verify that
  it does.

## Before handing work back

Run `npm run publish-check` (lint → typecheck → test → build).
