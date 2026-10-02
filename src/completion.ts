import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { EDIT_TARGETS } from './edit';

export const COMPLETION_SHELLS = ['bash', 'zsh', 'fish'] as const;

export type CompletionShell = (typeof COMPLETION_SHELLS)[number];

const COMMANDS = ['edit', 'completion'];
const OPTIONS = ['--help', '--version'];
const COMPLETION_ACTIONS = ['show', 'install'];

/** How to load the script by hand, per shell: the startup file and the line to add. */
const MANUAL: Record<CompletionShell, { rc: string; line: string }> = {
  bash: { rc: '~/.bashrc', line: 'eval "$(jdb completion show bash)"' },
  zsh: { rc: '~/.zshrc, after compinit', line: 'eval "$(jdb completion show zsh)"' },
  fish: { rc: '~/.config/fish/config.fish', line: 'jdb completion show fish | source' },
};

/**
 * The script that teaches `shell` to complete `jdb`, headed by instructions.
 * Those are comments, so the whole output can still be eval'd or sourced.
 */
export function completionScript(shell: CompletionShell): string {
  const { rc, line } = MANUAL[shell];
  return `# jdb tab completion for ${shell}.
#
# Install it automatically:
#   jdb completion install ${shell}
#
# Or load it by hand, by adding this line to ${rc}:
#   ${line}

${scriptBody(shell)}`;
}

function scriptBody(shell: CompletionShell): string {
  const first = [...COMMANDS, ...OPTIONS].join(' ');
  const targets = Object.keys(EDIT_TARGETS).join(' ');
  const actions = COMPLETION_ACTIONS.join(' ');
  const shells = COMPLETION_SHELLS.join(' ');

  switch (shell) {
    case 'bash':
      return `_jdb() {
  local cur="\${COMP_WORDS[COMP_CWORD]}" words=""
  if [ "$COMP_CWORD" -eq 1 ]; then
    words="${first}"
  elif [ "$COMP_CWORD" -eq 2 ]; then
    case "\${COMP_WORDS[1]}" in
      edit) words="${targets}" ;;
      completion) words="${actions}" ;;
    esac
  elif [ "$COMP_CWORD" -eq 3 ] && [ "\${COMP_WORDS[1]}" = completion ]; then
    words="${shells}"
  fi
  COMPREPLY=($(compgen -W "$words" -- "$cur"))
}
complete -F _jdb jdb
`;
    case 'zsh':
      return `_jdb() {
  if (( CURRENT == 2 )); then
    compadd -- ${first}
  elif (( CURRENT == 3 )); then
    case "\${words[2]}" in
      edit) compadd -- ${targets} ;;
      completion) compadd -- ${actions} ;;
    esac
  elif (( CURRENT == 4 )) && [[ "\${words[2]}" == completion ]]; then
    compadd -- ${shells}
  fi
}
compdef _jdb jdb
`;
    case 'fish':
      return `complete -c jdb -f
complete -c jdb -n __fish_use_subcommand -a "${COMMANDS.join(' ')}"
complete -c jdb -n __fish_use_subcommand -s h -l help -d "Show this help"
complete -c jdb -n __fish_use_subcommand -s v -l version -d "Show the version"
complete -c jdb -n "__fish_seen_subcommand_from edit; and not __fish_seen_subcommand_from ${targets}" -a "${targets}"
complete -c jdb -n "__fish_seen_subcommand_from completion; and not __fish_seen_subcommand_from ${actions}" -a "${actions}"
complete -c jdb -n "__fish_seen_subcommand_from completion; and __fish_seen_subcommand_from ${actions}; and not __fish_seen_subcommand_from ${shells}" -a "${shells}"
`;
  }
}

export interface InstallPlan {
  /** Where the completion script is written. */
  scriptPath: string;
  /** A startup file that must source the script, for shells with no autoload directory. */
  rc: { path: string; line: string } | null;
}

/**
 * Where `shell` expects a completion script, free of the real environment so it
 * can be tested directly. bash-completion and fish load a script by file name
 * from a per-user directory; zsh has no such directory, so its script is
 * sourced from `.zshrc`.
 */
export function installPlan(
  shell: CompletionShell,
  env: Record<string, string | undefined>,
  home: string,
): InstallPlan {
  const configHome = env['XDG_CONFIG_HOME'] ?? join(home, '.config');
  const dataHome = env['XDG_DATA_HOME'] ?? join(home, '.local', 'share');

  switch (shell) {
    case 'bash':
      return { scriptPath: join(dataHome, 'bash-completion', 'completions', 'jdb'), rc: null };
    case 'fish':
      return { scriptPath: join(configHome, 'fish', 'completions', 'jdb.fish'), rc: null };
    case 'zsh': {
      const scriptPath = join(configHome, 'jira-dashboard', 'completion.zsh');
      return {
        scriptPath,
        rc: {
          path: join(env['ZDOTDIR'] ?? home, '.zshrc'),
          line: `[ -f "${scriptPath}" ] && source "${scriptPath}"`,
        },
      };
    }
  }
}

/** `existing` with `line` appended, unless it is already there: installing twice changes nothing. */
export function withRcLine(existing: string, line: string): string {
  if (existing.split('\n').includes(line)) return existing;
  const gap = existing === '' ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  return `${existing}${gap}# jdb tab completion\n${line}\n`;
}

/** Install the completion script for `shell`; returns what was done, for printing. */
export function installCompletion(shell: CompletionShell): string {
  const { scriptPath, rc } = installPlan(shell, process.env, homedir());

  mkdirSync(dirname(scriptPath), { recursive: true });
  writeFileSync(scriptPath, completionScript(shell));
  const done = [`Wrote ${scriptPath}`];

  if (rc) {
    let existing = '';
    try {
      existing = readFileSync(rc.path, 'utf8');
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
    }
    const updated = withRcLine(existing, rc.line);
    if (updated === existing) {
      done.push(`${rc.path} already loads it`);
    } else {
      writeFileSync(rc.path, updated);
      done.push(`Added a line to ${rc.path} that loads it`);
    }
  }

  if (shell === 'bash') {
    done.push('This relies on the bash-completion package, which most distros enable by default.');
  }
  done.push(`Open a new ${shell} session to start using it.`);
  return `${done.join('\n')}\n`;
}
