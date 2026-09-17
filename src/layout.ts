/** Columns a splitter moves per Alt+←/→ press. */
export const SPLIT_STEP = 2;

/** Neither side of a splitter is shrunk below this by manual resizing. */
export const MIN_PANE_WIDTH = 20;

/**
 * Clamp a left-pane width so both panes keep `MIN_PANE_WIDTH`.
 *
 * A terminal too narrow to honour both minimums is simply split in half.
 */
export function clampSplit(width: number, total: number): number {
  if (total < 2 * MIN_PANE_WIDTH) return Math.max(0, Math.floor(total / 2));
  return Math.max(MIN_PANE_WIDTH, Math.min(width, total - MIN_PANE_WIDTH));
}

/**
 * Nudge a splitter stored as a shift from its default position (`base`).
 *
 * The shift is re-based on the clamped width, so presses past a limit don't pile
 * up an invisible debt that has to be unwound before the splitter moves back.
 * Keeping a shift rather than an absolute width lets the adjustment follow the
 * default when the terminal is resized.
 */
export function nudgeSplit(shift: number, delta: number, base: number, total: number): number {
  return clampSplit(base + shift + delta, total) - base;
}
