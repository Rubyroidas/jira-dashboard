/**
 * Minimal Atlassian Document Format → plain text renderer.
 *
 * Jira returns rich descriptions as an ADF node tree. We only need something
 * readable in a terminal pane, so unknown node types simply recurse into their
 * children rather than failing.
 */

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
}

export function adfToText(doc: unknown): string {
  if (typeof doc === 'string') return doc;
  if (typeof doc !== 'object' || doc === null) return '';
  return renderNodes((doc as AdfNode).content ?? [], 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderNodes(nodes: AdfNode[], depth: number): string[] {
  return nodes.flatMap((node) => renderNode(node, depth));
}

function renderNode(node: AdfNode, depth: number): string[] {
  const indent = '  '.repeat(depth);

  switch (node.type) {
    case 'text':
      return [applyMarks(node)];

    case 'hardBreak':
      return [''];

    case 'paragraph':
      return [indent + inline(node.content ?? []), ''];

    case 'heading': {
      const level = Number(node.attrs?.['level'] ?? 1);
      return [`${'#'.repeat(Math.min(level, 6))} ${inline(node.content ?? [])}`, ''];
    }

    case 'bulletList':
      return [...listItems(node, depth, () => '•'), ''];

    case 'orderedList':
      return [...listItems(node, depth, (i) => `${i + 1}.`), ''];

    case 'codeBlock': {
      const lang = typeof node.attrs?.['language'] === 'string' ? node.attrs['language'] : '';
      const body = inline(node.content ?? []).split('\n');
      return [`${indent}\`\`\`${lang}`, ...body.map((l) => indent + l), `${indent}\`\`\``, ''];
    }

    case 'blockquote':
      return [...renderNodes(node.content ?? [], depth).map((l) => `${indent}> ${l}`), ''];

    case 'rule':
      return ['───', ''];

    case 'mediaSingle':
    case 'mediaGroup':
      return [`${indent}[attachment]`];

    case 'table':
      // Rendering real table borders is out of scope; flatten rows instead.
      return [...renderNodes(node.content ?? [], depth), ''];

    case 'tableRow':
      return [indent + (node.content ?? []).map((cell) => inline(cell.content ?? [])).join(' | ')];

    default:
      return node.content ? renderNodes(node.content, depth) : [];
  }
}

function listItems(node: AdfNode, depth: number, bullet: (index: number) => string): string[] {
  const indent = '  '.repeat(depth);
  return (node.content ?? []).flatMap((item, index) => {
    const lines = renderNodes(item.content ?? [], depth + 1).filter((l) => l.trim() !== '');
    const [first = '', ...rest] = lines;
    return [`${indent}${bullet(index)} ${first.trim()}`, ...rest];
  });
}

/** Flatten a run of inline nodes onto a single line. */
function inline(nodes: AdfNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return applyMarks(node);
        case 'hardBreak':
          return '\n';
        case 'mention':
          return attr(node, 'text') || '@unknown';
        case 'emoji':
          return attr(node, 'text') || attr(node, 'shortName');
        case 'inlineCard':
          return attr(node, 'url');
        case 'date':
          return attr(node, 'timestamp');
        case 'status':
          return `[${attr(node, 'text')}]`;
        default:
          return node.content ? inline(node.content) : '';
      }
    })
    .join('');
}

/** Read a node attribute as a plain string; non-scalar attrs are dropped. */
function attr(node: AdfNode, name: string): string {
  const value = node.attrs?.[name];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** Only links carry information that would be lost in plain text. */
function applyMarks(node: AdfNode): string {
  const text = node.text ?? '';
  const link = node.marks?.find((m) => m.type === 'link');
  const href = link?.attrs?.['href'];
  return typeof href === 'string' && href !== text ? `${text} (${href})` : text;
}
