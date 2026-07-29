import type { JiraClient } from './client';

/** Jira's schema id for the Scrum board sprint field, stable across sites. */
const SPRINT_SCHEMA = 'com.pyxis.greenhopper.jira:gh-sprint';

interface FieldMeta {
  id?: string;
  schema?: { custom?: string };
}

/** `undefined` = not looked up yet, `null` = looked up and unavailable. */
let cached: string | null | undefined;

/**
 * Resolve the site's sprint custom-field id (e.g. `customfield_10020`).
 *
 * The id differs per Jira site, so it has to be discovered rather than
 * hard-coded. Resolved once per process; a failure is not fatal — the preview
 * just shows "None" rather than breaking the whole ticket list.
 */
export async function resolveSprintFieldId(client: JiraClient): Promise<string | null> {
  if (cached !== undefined) return cached;

  try {
    const fields = await client.get<FieldMeta[]>('/rest/api/3/field');
    cached = fields.find((field) => field.schema?.custom === SPRINT_SCHEMA)?.id ?? null;
  } catch {
    cached = null;
  }

  return cached;
}

interface RawSprint {
  name?: string;
  state?: string;
}

/**
 * Sprint names for display, active ones first.
 *
 * The field is an array because an issue can span sprints. Older Jira versions
 * return stringified Java objects instead of JSON, so both shapes are handled.
 */
export function sprintNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const sprints = value
    .map((entry): RawSprint | null => {
      if (typeof entry === 'string') return parseLegacySprint(entry);
      if (typeof entry === 'object' && entry !== null) return entry as RawSprint;
      return null;
    })
    .filter((sprint): sprint is RawSprint => Boolean(sprint?.name));

  // Active first, then future, then closed — the order a person cares about.
  const rank = (state?: string): number => {
    switch (state?.toLowerCase()) {
      case 'active':
        return 0;
      case 'future':
        return 1;
      default:
        return 2;
    }
  };

  return sprints
    .sort((a, b) => rank(a.state) - rank(b.state))
    .map((sprint) =>
      sprint.state && sprint.state.toLowerCase() !== 'active'
        ? `${sprint.name ?? ''} (${sprint.state.toLowerCase()})`
        : (sprint.name ?? ''),
    );
}

/** `...Sprint@1a2b[id=5,name=Sprint 7,state=ACTIVE,...]` → `{ name, state }`. */
function parseLegacySprint(raw: string): RawSprint | null {
  const name = /\bname=([^,\]]+)/.exec(raw)?.[1];
  const state = /\bstate=([^,\]]+)/.exec(raw)?.[1];
  return name ? { name, state } : null;
}
