import type { Issue, IssueRow } from './types';

/**
 * Flatten issues into tree rows.
 *
 * In `full` mode every loaded ancestor gets its own row, so a subtask sits
 * under its story under its epic even when those levels are someone else's
 * work. Otherwise only the user's own issues are rendered, re-parented onto
 * their nearest own ancestor — an epic of mine with a foreign story in between
 * still adopts my subtask directly.
 *
 * Order follows the JQL result: each issue appears as soon as its branch does.
 */
export function buildIssueTree(issues: Issue[], full: boolean): IssueRow[] {
  const byKey = new Map(issues.map((issue) => [issue.key, issue]));
  const visible = full ? issues : issues.filter((issue) => issue.mine);
  const visibleKeys = new Set(visible.map((issue) => issue.key));

  /** Nearest ancestor that is itself rendered, or null for a root. */
  const parentOf = (issue: Issue): string | null => {
    let key = issue.parent?.key ?? null;
    const seen = new Set<string>([issue.key]);
    while (key && !seen.has(key)) {
      seen.add(key);
      if (visibleKeys.has(key)) return key;
      key = byKey.get(key)?.parent?.key ?? null;
    }
    return null;
  };

  const roots: Issue[] = [];
  const children = new Map<string, Issue[]>();

  for (const issue of visible) {
    const parent = parentOf(issue);
    if (parent === null) {
      roots.push(issue);
      continue;
    }
    const siblings = children.get(parent);
    if (siblings) siblings.push(issue);
    else children.set(parent, [issue]);
  }

  const rows: IssueRow[] = [];

  const walk = (issue: Issue, guides: boolean[], last: boolean): void => {
    const kids = children.get(issue.key) ?? [];
    rows.push({ issue, guides, last, hasChildren: kids.length > 0 });
    kids.forEach((kid, index) => {
      // One guide per ancestor edge: the column stays open while that ancestor
      // still has siblings queued below it.
      walk(kid, [...guides, !last], index === kids.length - 1);
    });
  };

  // Roots hang off a virtual trunk, so they carry branch marks of their own.
  roots.forEach((root, index) => {
    walk(root, [], index === roots.length - 1);
  });

  return rows;
}

/** The `│  ├─ ` gutter for a row, one level of indent per ancestor. */
export function treePrefix(row: IssueRow): string {
  const stem = row.guides.map((continues) => (continues ? '│  ' : '   ')).join('');
  return `${stem}${row.last ? '└─ ' : '├─ '}`;
}

/** Folder marker: filled for a row with children, blank for a leaf. */
export function folderMark(row: IssueRow): string {
  return row.hasChildren ? '▾' : ' ';
}
