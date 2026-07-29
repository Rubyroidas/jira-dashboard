import { useEffect } from 'react';
import { useStdin, useStdout } from 'ink';

/**
 * Built from a char code on purpose: a literal escape byte in source is
 * invisible and easy to lose to an editor or a copy-paste.
 */
const ESC = String.fromCharCode(27);

/** SGR mouse reporting: button presses + wheel, with unbounded coordinates. */
const MOUSE_ON = `${ESC}[?1000h${ESC}[?1006h`;
const MOUSE_OFF = `${ESC}[?1006l${ESC}[?1000l`;

/** `ESC [ < button ; col ; row (M|m)` — M is press, m is release. */
const SGR_MOUSE = new RegExp(`${ESC}\\[<(\\d+);(\\d+);(\\d+)([Mm])`, 'g');
const SGR_PREFIX = `${ESC}[<`;

export type MouseEvent =
  | { type: 'press'; column: number; row: number }
  | { type: 'wheel'; direction: 'up' | 'down'; column: number; row: number };

/**
 * True when `input` is (or contains) an SGR mouse report. Keyboard handlers
 * should ignore these, since Ink's key parser sees the same bytes.
 */
export function isMouseSequence(input: string): boolean {
  return input.includes(SGR_PREFIX);
}

/**
 * Enable SGR mouse reporting for the lifetime of the component and report
 * parsed events. Terminal state is restored on unmount and on abrupt exits.
 */
export function useMouse(onEvent: (event: MouseEvent) => void): void {
  const { stdin, isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  useEffect(() => {
    if (!isRawModeSupported) return;

    stdout.write(MOUSE_ON);
    const disable = (): void => {
      stdout.write(MOUSE_OFF);
    };
    // Ink's own cleanup does not know about mouse mode, so cover hard exits.
    process.on('exit', disable);

    const onData = (data: Buffer | string): void => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      SGR_MOUSE.lastIndex = 0;

      for (let match = SGR_MOUSE.exec(text); match; match = SGR_MOUSE.exec(text)) {
        const [, rawButton = '0', rawColumn = '1', rawRow = '1', kind] = match;
        if (kind !== 'M') continue; // Ignore releases.

        const button = Number(rawButton);
        const column = Number(rawColumn) - 1;
        const row = Number(rawRow) - 1;

        // Bit 6 (64) marks wheel events; the low bit gives the direction.
        if (button & 64) {
          onEvent({ type: 'wheel', direction: (button & 1) === 0 ? 'up' : 'down', column, row });
        } else if ((button & 3) === 0) {
          onEvent({ type: 'press', column, row });
        }
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
      process.off('exit', disable);
      disable();
    };
  }, [stdin, stdout, isRawModeSupported, onEvent]);
}
