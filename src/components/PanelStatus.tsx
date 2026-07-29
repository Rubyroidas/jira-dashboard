import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

import type { JiraError } from '../types';

/** Spinner frames chosen to render on any terminal that supports Braille. */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/** Current spinner glyph, for inlining into a panel title or status bar. */
export function spinnerChar(frame: number): string {
  return FRAMES[frame % FRAMES.length] ?? FRAMES[0] ?? '·';
}

export function Spinner({ label, frame }: { label: string; frame: number }): ReactElement {
  return (
    <Text color="cyan">
      {spinnerChar(frame)} <Text color="gray">{label}</Text>
    </Text>
  );
}

/** Panel-local error: one panel failing must not blank the other. */
export function PanelError({ error }: { error: JiraError }): ReactElement {
  return (
    <Box flexDirection="column">
      <Text color="red" wrap="truncate-end">
        ✖ {error.message}
      </Text>
      {error.hints.slice(0, 3).map((hint, index) => (
        <Text key={index} color="gray" wrap="truncate-end">
          {hint}
        </Text>
      ))}
      <Text color="gray">Press r to retry.</Text>
    </Box>
  );
}
