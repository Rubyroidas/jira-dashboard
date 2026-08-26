export interface PriorityMark {
  glyph: string;
  color: string;
  bold: boolean;
}

/** Column width for the priority cell: glyph + one space, like the caret cell. */
export const PRIORITY_WIDTH = 2;

/**
 * Jira draws priority as a stack of arrows: up for urgent, flat for the middle,
 * down for the rest. Every glyph has to be one terminal column wide, because the
 * list pads cells with `padEnd` and would shear the grid otherwise.
 */
const MARKS: { mark: PriorityMark; names: string[] }[] = [
  { mark: { glyph: '‼', color: 'red', bold: true }, names: ['blocker', 'critical', 'urgent'] },
  { mark: { glyph: '⇈', color: 'red', bold: true }, names: ['highest', 'p1'] },
  { mark: { glyph: '↑', color: 'red', bold: false }, names: ['high', 'major', 'p2'] },
  { mark: { glyph: '=', color: 'yellow', bold: false }, names: ['medium', 'normal', 'p3'] },
  { mark: { glyph: '↓', color: 'blue', bold: false }, names: ['low', 'minor', 'p4'] },
  { mark: { glyph: '⇊', color: 'blue', bold: false }, names: ['lowest', 'trivial', 'p5'] },
];

const BY_NAME = new Map<string, PriorityMark>(
  MARKS.flatMap(({ mark, names }) => names.map((name) => [name, mark] as const)),
);

/**
 * Priority names are configurable per Jira site, so match a known alias rather
 * than guessing. Unknown and unset priorities render as a blank cell.
 */
export function priorityMark(priority: string | null): PriorityMark | null {
  if (!priority) return null;
  return BY_NAME.get(priority.trim().toLowerCase()) ?? null;
}

/** Exposed so tests can assert the single-column invariant over every glyph. */
export const PRIORITY_GLYPHS = MARKS.map(({ mark }) => mark.glyph);
