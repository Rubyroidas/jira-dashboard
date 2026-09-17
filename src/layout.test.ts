import { describe, expect, it } from '@jest/globals';

import { clampSplit, MIN_PANE_WIDTH, nudgeSplit } from './layout';

describe('clampSplit', () => {
  it('keeps widths that leave both panes their minimum', () => {
    expect(clampSplit(50, 120)).toBe(50);
  });

  it('stops at either limit', () => {
    expect(clampSplit(5, 120)).toBe(MIN_PANE_WIDTH);
    expect(clampSplit(115, 120)).toBe(120 - MIN_PANE_WIDTH);
  });

  it('halves a terminal too narrow for both minimums', () => {
    expect(clampSplit(30, 30)).toBe(15);
    expect(clampSplit(10, 0)).toBe(0);
  });
});

describe('nudgeSplit', () => {
  it('moves the splitter by the delta', () => {
    expect(nudgeSplit(0, 2, 50, 120)).toBe(2);
    expect(nudgeSplit(2, -4, 50, 120)).toBe(-2);
  });

  it('clamps the shift at the limits', () => {
    expect(50 + nudgeSplit(0, -100, 50, 120)).toBe(MIN_PANE_WIDTH);
    expect(50 + nudgeSplit(0, 100, 50, 120)).toBe(120 - MIN_PANE_WIDTH);
  });

  it('moves back on the first opposite press after hitting a limit', () => {
    let shift = 0;
    for (let i = 0; i < 40; i++) shift = nudgeSplit(shift, -2, 50, 120);
    expect(50 + shift).toBe(MIN_PANE_WIDTH);
    shift = nudgeSplit(shift, 2, 50, 120);
    expect(50 + shift).toBe(MIN_PANE_WIDTH + 2);
  });
});
