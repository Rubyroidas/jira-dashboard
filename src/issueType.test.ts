import { describe, expect, it } from '@jest/globals';

import { ISSUE_TYPE_GLYPHS, issueTypeMark } from './issueType';

describe('issueTypeMark', () => {
  it('maps the four standard Jira types to their Nerd Font icons', () => {
    expect(issueTypeMark('Bug')).toEqual({ glyph: '', color: 'red' });
    expect(issueTypeMark('Task')).toEqual({ glyph: '', color: 'blue' });
    expect(issueTypeMark('Story')).toEqual({ glyph: '', color: 'green' });
    expect(issueTypeMark('Sub-task')).toEqual({ glyph: '', color: 'cyan' });
  });

  it('matches aliases, ignoring case and padding', () => {
    expect(issueTypeMark(' BUG ')?.glyph).toBe('');
    expect(issueTypeMark('Subtask')?.glyph).toBe('');
    expect(issueTypeMark('User Story')?.glyph).toBe('');
  });

  it('returns null for empty and unrecognised types', () => {
    expect(issueTypeMark('')).toBeNull();
    expect(issueTypeMark('Epic')).toBeNull();
  });

  it('uses only single-column glyphs, so the list columns stay aligned', () => {
    for (const glyph of ISSUE_TYPE_GLYPHS) {
      expect(glyph).toHaveLength(1);
    }
  });
});
