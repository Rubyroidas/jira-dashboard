import { describe, expect, test } from '@jest/globals';

import { resolveEditor } from './edit';

describe('resolveEditor', () => {
  test('$VISUAL wins over $EDITOR', () => {
    expect(resolveEditor({ VISUAL: 'nvim', EDITOR: 'nano' }, 'linux')).toEqual({
      command: 'nvim',
      args: [],
    });
  });

  test('$EDITOR is used when $VISUAL is unset', () => {
    expect(resolveEditor({ EDITOR: 'nano' }, 'linux')).toEqual({ command: 'nano', args: [] });
  });

  test('a blank $VISUAL is skipped rather than spawned', () => {
    expect(resolveEditor({ VISUAL: '  ', EDITOR: 'nano' }, 'linux')).toEqual({
      command: 'nano',
      args: [],
    });
  });

  test('flags in the variable become separate arguments', () => {
    expect(resolveEditor({ EDITOR: 'code --wait  --new-window' }, 'linux')).toEqual({
      command: 'code',
      args: ['--wait', '--new-window'],
    });
  });

  test('falls back to vi when neither variable is set', () => {
    expect(resolveEditor({}, 'linux')).toEqual({ command: 'vi', args: [] });
    expect(resolveEditor({}, 'darwin')).toEqual({ command: 'vi', args: [] });
  });

  test('falls back to notepad on Windows', () => {
    expect(resolveEditor({}, 'win32')).toEqual({ command: 'notepad', args: [] });
  });
});
