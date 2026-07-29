import { useEffect, useRef } from 'react';
import { useStdin } from 'ink';

/**
 * Built from a char code on purpose: a literal escape byte in source is
 * invisible and easy to lose to an editor or a copy-paste.
 */
const ESC = String.fromCharCode(27);

/**
 * Home and End have no single encoding — xterm, VT and rxvt families each pick
 * a different one, and terminals vary in application vs normal cursor mode.
 */
const HOME_SEQUENCES = [`${ESC}[H`, `${ESC}[1~`, `${ESC}[7~`, `${ESC}OH`];
const END_SEQUENCES = [`${ESC}[F`, `${ESC}[4~`, `${ESC}[8~`, `${ESC}OF`];

/**
 * Report Home and End key presses.
 *
 * Ink's `useInput` cannot help here: it parses all of these into an empty input
 * with no key flags set, making Home and End indistinguishable. Reading stdin
 * directly is the only way to tell them apart. Ink still sees the same bytes and
 * emits its own (harmless) empty events.
 */
export function useHomeEndKeys(onHome: () => void, onEnd: () => void): void {
  const { stdin, isRawModeSupported } = useStdin();

  // Handlers change on nearly every render; a ref keeps the listener stable.
  const handlers = useRef({ onHome, onEnd });
  handlers.current = { onHome, onEnd };

  useEffect(() => {
    if (!isRawModeSupported) return;

    const onData = (data: Buffer | string): void => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      if (HOME_SEQUENCES.some((sequence) => text.includes(sequence))) {
        handlers.current.onHome();
      } else if (END_SEQUENCES.some((sequence) => text.includes(sequence))) {
        handlers.current.onEnd();
      }
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
    };
  }, [stdin, isRawModeSupported]);
}
