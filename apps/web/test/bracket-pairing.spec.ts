import { EditorSelection, EditorState, TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { bracketPairing } from '../src/components/editor/editor-extensions';

/** Types `text` over the selection the way CodeMirror would, through the input handlers, without a DOM. */
function type(doc: string, from: number, to: number, ...keys: string[]) {
  let state = EditorState.create({ doc, selection: EditorSelection.single(from, to), extensions: [bracketPairing] });
  const view = {
    get state() {
      return state;
    },
    composing: false,
    dispatch(spec: TransactionSpec) {
      state = state.update(spec).state;
    },
  } as unknown as EditorView;
  for (const key of keys) {
    const { from: a, to: b } = state.selection.main;
    const handled = state.facet(EditorView.inputHandler).some((handler) => handler(view, a, b, key, () => state.update({})));
    if (!handled) state = state.update({ changes: { from: a, to: b, insert: key }, selection: { anchor: a + key.length } }).state;
  }
  const { from: a, to: b } = state.selection.main;
  return { doc: state.doc.toString(), selected: state.sliceDoc(a, b) };
}

describe('bracket pairing over a selection', () => {
  it('turns selected text into a page link with [[ and keeps it selected', () => {
    expect(type('读 深度工作 这本书', 2, 6, '[', '[')).toEqual({ doc: '读 [[深度工作]] 这本书', selected: '深度工作' });
  });

  it('does the same with the Chinese keyboard 【【', () => {
    expect(type('读 深度工作 这本书', 2, 6, '【', '【')).toEqual({ doc: '读 [[深度工作]] 这本书', selected: '深度工作' });
  });

  it('a single [ wraps once', () => {
    expect(type('abc', 0, 3, '[')).toEqual({ doc: '[abc]', selected: 'abc' });
  });

  it('turns 【【 without a selection into an empty link but leaves a lone 【 alone', () => {
    expect(type('', 0, 0, '【', '【').doc).toBe('[[]]');
    expect(type('', 0, 0, '【').doc).toBe('【');
    expect(type('', 0, 0, '[', '[').doc).toBe('[[]]');
  });
});
