import { describe, expect, test } from '@jest/globals';

import { COMPLETION_SHELLS, completionScript, installPlan, withRcLine } from './completion';

describe('completionScript', () => {
  test.each(COMPLETION_SHELLS)('the %s script offers every command and edit target', (shell) => {
    const script = completionScript(shell);
    for (const word of ['edit', 'completion', 'config', 'holidays', 'days-off']) {
      expect(script).toContain(word);
    }
  });

  test('the bash script registers itself for jdb', () => {
    expect(completionScript('bash')).toContain('complete -F _jdb jdb');
  });

  test('the zsh script registers itself for jdb', () => {
    expect(completionScript('zsh')).toContain('compdef _jdb jdb');
  });

  // Shell variables must reach the script literally, not be interpolated away.
  test('shell variables survive into the bash script', () => {
    expect(completionScript('bash')).toContain('${COMP_WORDS[COMP_CWORD]}');
  });

  test.each(COMPLETION_SHELLS)('the %s script offers show and install', (shell) => {
    const script = completionScript(shell);
    expect(script).toContain('show');
    expect(script).toContain('install');
  });

  // The instructions travel with the script, so they must not break eval/source.
  test.each(COMPLETION_SHELLS)('the %s instructions are all comments', (shell) => {
    const [header = ''] = completionScript(shell).split('\n\n');
    expect(header).toContain(`jdb completion install ${shell}`);
    for (const line of header.split('\n')) {
      expect(line.startsWith('#')).toBe(true);
    }
  });
});

describe('installPlan', () => {
  test('bash goes to the bash-completion user directory, with no rc edit', () => {
    expect(installPlan('bash', {}, '/home/u')).toEqual({
      scriptPath: '/home/u/.local/share/bash-completion/completions/jdb',
      rc: null,
    });
  });

  test('bash honours $XDG_DATA_HOME', () => {
    expect(installPlan('bash', { XDG_DATA_HOME: '/data' }, '/home/u').scriptPath).toBe(
      '/data/bash-completion/completions/jdb',
    );
  });

  test('fish goes to its completions directory, with no rc edit', () => {
    expect(installPlan('fish', { XDG_CONFIG_HOME: '/cfg' }, '/home/u')).toEqual({
      scriptPath: '/cfg/fish/completions/jdb.fish',
      rc: null,
    });
  });

  test('zsh is sourced from .zshrc', () => {
    expect(installPlan('zsh', {}, '/home/u')).toEqual({
      scriptPath: '/home/u/.config/jira-dashboard/completion.zsh',
      rc: {
        path: '/home/u/.zshrc',
        line: '[ -f "/home/u/.config/jira-dashboard/completion.zsh" ] && source "/home/u/.config/jira-dashboard/completion.zsh"',
      },
    });
  });

  test('zsh honours $ZDOTDIR', () => {
    expect(installPlan('zsh', { ZDOTDIR: '/z' }, '/home/u').rc?.path).toBe('/z/.zshrc');
  });
});

describe('withRcLine', () => {
  test('appends the line to an existing file', () => {
    expect(withRcLine('export A=1\n', 'source x')).toBe(
      'export A=1\n\n# jdb tab completion\nsource x\n',
    );
  });

  test('copes with a file that lacks a trailing newline', () => {
    expect(withRcLine('export A=1', 'source x')).toBe(
      'export A=1\n\n# jdb tab completion\nsource x\n',
    );
  });

  test('starts an empty file cleanly', () => {
    expect(withRcLine('', 'source x')).toBe('# jdb tab completion\nsource x\n');
  });

  test('installing twice does not add the line twice', () => {
    const once = withRcLine('export A=1\n', 'source x');
    expect(withRcLine(once, 'source x')).toBe(once);
  });
});
