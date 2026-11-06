import { Completion, CompletionContext, CompletionResult, startCompletion } from '@codemirror/autocomplete';
import { Extension, RangeSetBuilder } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, MatchDecorator, ViewPlugin, ViewUpdate } from '@codemirror/view';
import type { AutocompleteSources } from '../../controllers/use-autocomplete-sources';
import { TAG_SAFE_TITLE } from '../../services/content-tokenizer';

const SYNTAX = new MatchDecorator({
  regexp:
    /(#?\[\[[^[\]\n]*\]\])|(\(\([A-Za-z0-9_-]*\)\))|((?<=^|[\s(（：，、；])#[\p{L}\p{N}_\-/]+)|(\*\*[^*\n]+\*\*)|(`[^`\n]+`)|(~~[^~\n]+~~)|(__[^_\n]+__|(?<![A-Za-z0-9*])\*(?![\s*])[^*\n]+?(?<![\s*])\*(?![A-Za-z0-9*]))|(\^\^[^^\n]+\^\^|==[^=\n]+==)|(^#{1,6}[ \t])/gmu,
  decoration: (match) => {
    if (match[1]) return Decoration.mark({ class: 'cm-wv-link' });
    if (match[2]) return Decoration.mark({ class: 'cm-wv-ref' });
    if (match[3]) return Decoration.mark({ class: 'cm-wv-tag' });
    if (match[4]) return Decoration.mark({ class: 'cm-wv-bold' });
    if (match[5]) return Decoration.mark({ class: 'cm-wv-code' });
    if (match[6]) return Decoration.mark({ class: 'cm-wv-strike' });
    if (match[7]) return Decoration.mark({ class: 'cm-wv-italic' });
    if (match[8]) return Decoration.mark({ class: 'cm-wv-mark' });
    return Decoration.mark({ class: 'cm-wv-hmark' });
  },
});

export const syntaxHighlight = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = SYNTAX.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = SYNTAX.updateDeco(update, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

const HEADING_LINE = /^(#{1,6})[ \t]/;
const QUOTE_LINE = /^[ \t]*>/;
const FENCE_LINE = /^[ \t]*(?:```|~~~)/;

function lineDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  let inFence = false;
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const line = view.state.doc.line(n);
    const fence = FENCE_LINE.test(line.text);
    const heading = HEADING_LINE.exec(line.text);
    let cls: string | null = null;
    if (fence || inFence) cls = 'cm-wv-codeline';
    else if (heading) cls = `cm-wv-h${Math.min(heading[1].length, 4)}`;
    else if (QUOTE_LINE.test(line.text)) cls = 'cm-wv-quote';
    if (fence) inFence = !inFence;
    if (cls) builder.add(line.from, line.from, Decoration.line({ class: cls }));
  }
  return builder.finish();
}

export const markdownLines = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = lineDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) this.decorations = lineDecorations(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);

const PAIRS: Record<string, string> = { '[': ']]', '(': '))' };

// A Chinese keyboard types [ as 【, so 【 opens a link too, but only when it is clearly meant as one:
// over a selection, or as the second of 【【. A lone 【 stays Chinese punctuation.
const OPEN_LINK = new Set(['[', '【']);

/** Selected text + [ wraps it as [text]; a second [ makes it [[text]], a page link, like Roam. */
function wrapSelection(view: EditorView, from: number, to: number): boolean {
  const doc = view.state.doc;
  const selected = doc.sliceString(from, to);
  const insideSingle = doc.sliceString(from - 1, from) === '[' && doc.sliceString(to, to + 1) === ']';
  const start = insideSingle ? from - 1 : from;
  const insert = insideSingle ? `[[${selected}]]` : `[${selected}]`;
  const anchor = start + (insideSingle ? 2 : 1);
  view.dispatch({
    changes: { from: start, to: insideSingle ? to + 1 : to, insert },
    selection: { anchor, head: anchor + selected.length },
    userEvent: 'input.type',
  });
  return true;
}

export const bracketPairing: Extension = EditorView.inputHandler.of((view, from, to, text) => {
  const doc = view.state.doc;
  if (OPEN_LINK.has(text) && from !== to && !doc.sliceString(from, to).includes('\n')) return wrapSelection(view, from, to);
  if (text === '【' && from === to && doc.sliceString(from - 1, from) === '【') {
    view.dispatch({ changes: { from: from - 1, to, insert: '[[]]' }, selection: { anchor: from + 1 }, userEvent: 'input.type' });
    startCompletion(view);
    return true;
  }
  if ((text === ']' || text === ')') && from === to && doc.sliceString(from, from + 1) === text) {
    view.dispatch({ selection: { anchor: from + 1 } });
    return true;
  }
  const closing = PAIRS[text];
  if (!closing || doc.sliceString(from - 1, from) !== text) return false;
  const selected = doc.sliceString(from, to);
  view.dispatch({
    changes: { from, to, insert: `${text}${selected}${closing}` },
    selection: selected ? { anchor: from + 1, head: from + 1 + selected.length } : { anchor: from + 1 },
    userEvent: 'input.type',
  });
  if (!selected) startCompletion(view);
  return true;
});

// A Chinese keyboard types [] as 【】, so both count.
const EMPTY_BOX = /^((?:[ \t]*>[ \t]?)*[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+)?(?:\[\]|【】)$/;

export const todoShortcut: Extension = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== ' ' || from !== to || view.composing) return false;
  const line = view.state.doc.lineAt(from);
  const match = EMPTY_BOX.exec(view.state.doc.sliceString(line.from, from));
  if (!match || (!match[1] && line.number !== 1)) return false;
  const insert = `${match[1] ?? ''}[ ] `;
  view.dispatch({
    changes: { from: line.from, to: from, insert },
    selection: { anchor: line.from + insert.length },
    userEvent: 'input.type',
  });
  return true;
});

function closeWith(view: EditorView, from: number, to: number, insert: string, closing: string) {
  const after = view.state.doc.sliceString(to, to + closing.length);
  const text = after === closing ? insert : insert + closing;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + insert.length + closing.length },
    userEvent: 'input.complete',
  });
}

function pageOption(title: string, label: string, detail: string | undefined, closing: string): Completion {
  return {
    label,
    detail,
    apply: (view, _completion, from, to) => closeWith(view, from, to, title, closing),
  };
}

interface SlashCommand {
  name: string;
  keywords: string;
  detail?: string;
  run(view: EditorView, from: number, to: number): void;
}

function replaceWith(view: EditorView, from: number, to: number, text: string, caretOffset = text.length, complete = false) {
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + caretOffset }, userEvent: 'input.complete' });
  if (complete) startCompletion(view);
}

function slashCommands(sources: AutocompleteSources): SlashCommand[] {
  const wrap = (open: string, close: string) => (view: EditorView, from: number, to: number) => replaceWith(view, from, to, open + close, open.length);
  const linePrefix = (prefix: string) => (view: EditorView, from: number, to: number) => {
    const line = view.state.doc.lineAt(from);
    const existing = /^(?:#{1,6}[ \t]+|>[ \t]?)/.exec(line.text)?.[0] ?? '';
    view.dispatch({
      changes: [
        { from, to, insert: '' },
        { from: line.from, to: line.from + existing.length, insert: prefix },
      ],
      selection: { anchor: from - existing.length + prefix.length },
      userEvent: 'input.complete',
    });
  };
  const dateLink = (offset: number) => (view: EditorView, from: number, to: number) => replaceWith(view, from, to, `[[${sources.dateTitle(offset)}]]`);
  return [
    {
      name: '待办',
      keywords: 'todo daiban db',
      detail: '[ ]',
      run: (view, from, to) => {
        const doc = view.state.doc.toString();
        const rest = doc.slice(0, from) + doc.slice(to);
        const next = /^\[( |x|X)\] /.test(rest) ? rest : `[ ] ${rest}`;
        view.dispatch({ changes: { from: 0, to: doc.length, insert: next }, selection: { anchor: from + (next.length - rest.length) } });
      },
    },
    { name: '今天', keywords: 'today jintian jt', detail: sources.dateTitle(0), run: dateLink(0) },
    { name: '明天', keywords: 'tomorrow mingtian mt', detail: sources.dateTitle(1), run: dateLink(1) },
    { name: '昨天', keywords: 'yesterday zuotian zt', detail: sources.dateTitle(-1), run: dateLink(-1) },
    { name: '当前时间', keywords: 'time shijian sj', run: (view, from, to) => replaceWith(view, from, to, sources.timeNow()) },
    { name: '页面链接', keywords: 'link page yemian lianjie ym lj', detail: '[[ ]]', run: (view, from, to) => replaceWith(view, from, to, '[[]]', 2, true) },
    { name: '块引用', keywords: 'ref block kuaiyinyong kyy', detail: '(( ))', run: (view, from, to) => replaceWith(view, from, to, '(())', 2, true) },
    { name: '标签', keywords: 'tag biaoqian bq', detail: '#', run: (view, from, to) => replaceWith(view, from, to, '#', 1, true) },
    { name: '粗体', keywords: 'bold cuti ct', detail: '**', run: wrap('**', '**') },
    { name: '斜体', keywords: 'italic xieti xt', detail: '__', run: wrap('__', '__') },
    { name: '高亮', keywords: 'highlight gaoliang gl', detail: '^^', run: wrap('^^', '^^') },
    { name: '代码', keywords: 'code daima dm', detail: '`', run: wrap('`', '`') },
    { name: '标题 1', keywords: 'h1 heading biaoti bt', detail: '#', run: linePrefix('# ') },
    { name: '标题 2', keywords: 'h2 heading biaoti bt', detail: '##', run: linePrefix('## ') },
    { name: '标题 3', keywords: 'h3 heading biaoti bt', detail: '###', run: linePrefix('### ') },
    { name: '引用', keywords: 'quote yinyong yy', detail: '>', run: linePrefix('> ') },
    { name: '删除线', keywords: 'strike shanchuxian scx', detail: '~~', run: wrap('~~', '~~') },
    { name: '代码块', keywords: 'codeblock daimakuai dmk', detail: '```', run: (view, from, to) => replaceWith(view, from, to, '```\n\n```', 4) },
    { name: '分割线', keywords: 'divider hr fengexian fgx', detail: '---', run: (view, from, to) => replaceWith(view, from, to, '---') },
    {
      name: '表格',
      keywords: 'table biaoge bg',
      detail: '| |',
      run: (view, from, to) => replaceWith(view, from, to, '| 列 1 | 列 2 |\n| --- | --- |\n|  |  |', 2),
    },
  ];
}

export interface CompletionHooks {
  onTemplate(title: string): void;
  onAttach(view: EditorView, pos: number): void;
}

export function completionSources(sources: AutocompleteSources, hooks: CompletionHooks) {
  const slash = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/(?<=^|\s)\/[^\s/]*/u);
    if (!match) return null;
    const commands: Completion[] = slashCommands(sources).map((command) => ({
      label: `${command.name} ${command.keywords}`,
      displayLabel: command.name,
      detail: command.detail,
      apply: (view, _completion, from, to) => command.run(view, from - 1, to),
    }));
    commands.push({
      label: '文件 图片 附件 file image upload wenjian tupian wj tp',
      displayLabel: '上传图片或文件',
      detail: '最大 25MB',
      apply: (view, _completion, from, to) => {
        view.dispatch({ changes: { from: from - 1, to, insert: '' } });
        hooks.onAttach(view, from - 1);
      },
    });
    const templates: Completion[] = (await sources.listTemplates()).map((title) => ({
      label: `${title} template muban mb`,
      displayLabel: `模板：${title.slice(3)}`,
      detail: '插入模板',
      apply: (view, _completion, from, to) => {
        view.dispatch({ changes: { from: from - 1, to, insert: '' } });
        hooks.onTemplate(title);
      },
    }));
    // CodeMirror's fuzzy filter only matches word starts in order, so pinyin initials like "jt" (今天) need our own matching.
    const query = match.text.slice(1).toLowerCase();
    const options = [...commands, ...templates].filter(
      (option) => !query || option.label.toLowerCase().split(/\s+/).some((word) => word.includes(query)),
    );
    return { from: match.from + 1, options, filter: false };
  };


  const pageLinks = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/\[\[[^[\]\n]*/);
    if (!match) return null;
    const q = match.text.slice(2);
    const pages = await sources.searchPages(q);
    const options = pages.map((p) => pageOption(p.title, p.title, p.refCount ? `${p.refCount} 处引用` : undefined, ']]'));
    if (q.trim() && !pages.some((p) => p.title.toLowerCase() === q.trim().toLowerCase())) {
      options.push(pageOption(q.trim(), q.trim(), '新建页面', ']]'));
    }
    return { from: match.from + 2, options, filter: false };
  };

  const tags = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/(?<=^|[\s(（：，、；])#[\p{L}\p{N}_\-/]*/u);
    if (!match || (match.text.length < 2 && !context.explicit)) return null;
    const q = match.text.slice(1);
    const pages = await sources.searchPages(q);
    const options: Completion[] = pages.map((p) => ({
      label: p.title,
      detail: '标签',
      apply: TAG_SAFE_TITLE.test(p.title) ? p.title : `[[${p.title}]]`,
    }));
    return { from: match.from + 1, options, filter: false };
  };

  const blockRefs = async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = context.matchBefore(/\(\([^()\n]*/);
    if (!match) return null;
    const q = match.text.slice(2);
    if (!q.trim()) return { from: match.from + 2, options: [{ label: '输入文字搜索要引用的块…', apply: () => undefined }], filter: false };
    const blocks = await sources.searchBlocks(q);
    const options: Completion[] = blocks.map((b) => ({
      label: b.content.length > 80 ? `${b.content.slice(0, 80)}…` : b.content,
      detail: b.pageTitle,
      apply: (view, _completion, from, to) => closeWith(view, from, to, b.id, '))'),
    }));
    return { from: match.from + 2, options, filter: false };
  };

  return [slash, pageLinks, blockRefs, tags];
}

export const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: 'inherit' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { padding: '0', fontFamily: 'inherit', lineHeight: 'inherit', caretColor: 'var(--color-ink)' },
  '.cm-line': { padding: '0' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: 'inherit', overflow: 'visible' },
  '.cm-tooltip.cm-tooltip-autocomplete': {
    border: '1px solid var(--color-line)',
    borderRadius: '10px',
    backgroundColor: 'var(--color-panel)',
    boxShadow: '0 12px 32px -12px var(--color-shadow)',
    overflow: 'hidden',
    padding: '4px',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul': { fontFamily: 'inherit', maxHeight: '18rem', minWidth: '16rem' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li': { padding: '6px 10px', borderRadius: '6px', lineHeight: '1.4' },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-ink)' },
  '.cm-completionDetail': { marginLeft: '12px', fontStyle: 'normal', color: 'var(--color-muted)', fontSize: '12px' },
});
