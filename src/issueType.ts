export interface IssueTypeMark {
  glyph: string;
  color: string;
}

/** Column width for the issue-type cell: glyph + one space, like the priority cell. */
export const ISSUE_TYPE_WIDTH = 2;

/**
 * Nerd Font icons per issue type. They sit in the Private Use Area, so each is a
 * single UTF-16 unit and one terminal column wide in a Nerd Font.
 */
const MARKS: { mark: IssueTypeMark; names: string[] }[] = [
  { mark: { glyph: '', color: 'red' }, names: ['bug', 'defect'] },
  { mark: { glyph: '', color: 'blue' }, names: ['task'] },
  { mark: { glyph: '', color: 'green' }, names: ['story', 'user story'] },
  { mark: { glyph: '', color: 'cyan' }, names: ['sub-task', 'subtask', 'sub task'] },
];

const BY_NAME = new Map<string, IssueTypeMark>(
  MARKS.flatMap(({ mark, names }) => names.map((name) => [name, mark] as const)),
);

/** Unknown issue types (Epic, custom ones) render as a blank cell. */
export function issueTypeMark(issueType: string): IssueTypeMark | null {
  return BY_NAME.get(issueType.trim().toLowerCase()) ?? null;
}

/** Exposed so tests can assert the single-column invariant over every glyph. */
export const ISSUE_TYPE_GLYPHS = MARKS.map(({ mark }) => mark.glyph);
