import { describe, expect, it } from '@jest/globals';

import { PRIORITY_GLYPHS, priorityMark } from './priority';

describe('priorityMark', () => {
  it('maps the five standard Jira levels to their arrows', () => {
    expect(priorityMark('Highest')).toEqual({ glyph: '⇈', color: 'red', bold: true });
    expect(priorityMark('High')).toEqual({ glyph: '↑', color: 'red', bold: false });
    expect(priorityMark('Medium')).toEqual({ glyph: '=', color: 'yellow', bold: false });
    expect(priorityMark('Low')).toEqual({ glyph: '↓', color: 'blue', bold: false });
    expect(priorityMark('Lowest')).toEqual({ glyph: '⇊', color: 'blue', bold: false });
  });

  it('gives Critical and Blocker their own mark', () => {
    expect(priorityMark('Critical')).toEqual({ glyph: '‼', color: 'red', bold: true });
    expect(priorityMark('Blocker')?.glyph).toBe('‼');
    expect(priorityMark('Urgent')?.glyph).toBe('‼');
  });

  it('matches aliases from other priority schemes, ignoring case and padding', () => {
    expect(priorityMark('HIGHEST')?.glyph).toBe('⇈');
    expect(priorityMark(' critical ')?.glyph).toBe('‼');
    expect(priorityMark('P3')?.glyph).toBe('=');
    expect(priorityMark('Major')?.glyph).toBe('↑');
    expect(priorityMark('Trivial')?.glyph).toBe('⇊');
  });

  it('returns null for unset and unrecognised priorities', () => {
    expect(priorityMark(null)).toBeNull();
    expect(priorityMark('')).toBeNull();
    expect(priorityMark('Wibble')).toBeNull();
  });

  it('uses only single-column glyphs, so the list columns stay aligned', () => {
    for (const glyph of PRIORITY_GLYPHS) {
      expect(glyph).toHaveLength(1);
    }
  });
});
