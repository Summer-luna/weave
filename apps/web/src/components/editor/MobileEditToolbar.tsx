import { ArrowDown, ArrowUp, Check, Hash, ImagePlus, IndentDecrease, IndentIncrease, ListTodo } from 'lucide-react';
import { PointerEvent, ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { activeEditorRegistry } from './active-editor-registry';
import { insertUploads } from './BlockEditor';
import { caretOf, insertPair, insertText, pickFiles, toggleTodo } from './editor-commands';

function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return inset;
}

export function MobileEditToolbar() {
  const editor = useSyncExternalStore(
    (listener) => activeEditorRegistry.subscribe(listener),
    () => activeEditorRegistry.snapshot(),
  );
  const inset = useKeyboardInset();
  if (!editor) return null;

  const { view } = editor;
  const h = editor.handlers;
  const actions: { key: string; label: string; icon: ReactNode; run(): void }[] = [
    { key: 'outdent', label: '取消缩进', icon: <IndentDecrease size={19} />, run: () => h().onOutdent(caretOf(view)) },
    { key: 'indent', label: '缩进', icon: <IndentIncrease size={19} />, run: () => h().onIndent(caretOf(view)) },
    { key: 'up', label: '上移', icon: <ArrowUp size={19} />, run: () => h().onMoveUp(caretOf(view)) },
    { key: 'down', label: '下移', icon: <ArrowDown size={19} />, run: () => h().onMoveDown(caretOf(view)) },
    { key: 'link', label: '页面链接', icon: <span className="font-mono text-[15px]">[[ ]]</span>, run: () => insertPair(view, '[[', ']]') },
    { key: 'ref', label: '块引用', icon: <span className="font-mono text-[15px]">(( ))</span>, run: () => insertPair(view, '((', '))') },
    { key: 'tag', label: '标签', icon: <Hash size={18} />, run: () => insertText(view, '#') },
    { key: 'todo', label: '待办', icon: <ListTodo size={19} />, run: () => toggleTodo(view, h()) },
    {
      key: 'file',
      label: '图片或文件',
      icon: <ImagePlus size={19} />,
      run: () => void pickFiles().then((files) => (files.length ? insertUploads(view, files, caretOf(view), h) : undefined)),
    },
  ];

  // Keep the editor focused (and the soft keyboard open) while tapping toolbar buttons.
  const keepFocus = (event: PointerEvent) => event.preventDefault();

  return (
    <div className="mobile-toolbar" style={{ bottom: inset }} onPointerDown={keepFocus}>
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]">
        {actions.map((action) => (
          <button key={action.key} type="button" className="mobile-tool" aria-label={action.label} onClick={action.run}>
            {action.icon}
          </button>
        ))}
      </div>
      <button type="button" className="mobile-tool text-accent" aria-label="完成" onClick={() => view.contentDOM.blur()}>
        <Check size={20} />
      </button>
    </div>
  );
}
