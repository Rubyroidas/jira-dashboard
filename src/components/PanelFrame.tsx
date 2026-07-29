import { Box, Text } from 'ink';
import type { ReactElement, ReactNode } from 'react';

interface PanelFrameProps {
  title: string;
  focused: boolean;
  height: number;
  width?: number | string;
  flexGrow?: number;
  children: ReactNode;
}

/**
 * Bordered panel with a one-line header.
 *
 * The border and header occupy fixed rows, so callers can map a screen row to
 * their own content: content starts at the panel's top + {@link PANEL_HEADER_ROWS}.
 */
export const PANEL_HEADER_ROWS = 2; // top border + header line
export const PANEL_CHROME_ROWS = 3; // ...plus the bottom border

export function PanelFrame({
  title,
  focused,
  height,
  width,
  flexGrow,
  children,
}: PanelFrameProps): ReactElement {
  return (
    <Box
      flexDirection="column"
      height={height}
      width={width}
      flexGrow={flexGrow}
      // A panel given an explicit width must keep it: shrinking one column makes
      // fixed-width content (chart rows, aligned labels) wrap and fall apart.
      flexShrink={width === undefined ? 1 : 0}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
      overflow="hidden"
    >
      <Text bold color={focused ? 'cyan' : 'white'}>
        {title}
      </Text>
      {children}
    </Box>
  );
}
