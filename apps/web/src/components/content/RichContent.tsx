import clsx from 'clsx';
import { Fragment, MouseEvent } from 'react';
import { useParsedContent } from '../../controllers/use-content-view';
import type { MdBlock } from '../../services/markdown-block-parser';
import { InlineTokens } from './InlineTokens';
import { MarkdownBlocks } from './MarkdownBlocks';

interface RichContentProps {
  content: string;
  depth?: number;
  onToggleTodo?: () => void;
  onToggleTask?: (line: number) => void;
}

const stop = (event: MouseEvent) => event.stopPropagation();

export function RichContent({ content, depth = 0, onToggleTodo, onToggleTask }: RichContentProps) {
  const { todo, blocks } = useParsedContent(content);
  const checkbox = todo && (
    <input
      type="checkbox"
      className="todo-box"
      checked={todo === 'done'}
      disabled={!onToggleTodo}
      onClick={stop}
      onChange={() => onToggleTodo?.()}
    />
  );
  const done = todo === 'done' ? 'text-muted line-through decoration-1' : undefined;
  const plain = blocks.length <= 1 && (!blocks[0] || blocks[0].type === 'paragraph');
  if (plain || depth > 0) {
    return (
      <>
        {checkbox}
        <span className={done}>
          <InlineBlocks blocks={blocks} depth={depth} />
        </span>
      </>
    );
  }
  return (
    <div className={clsx('md-content', done)}>
      <MarkdownBlocks blocks={blocks} depth={depth} lead={checkbox} onToggleTask={onToggleTask} />
    </div>
  );
}

// Block refs render inside running text, so their Markdown blocks collapse to one line.
function InlineBlocks({ blocks, depth }: { blocks: MdBlock[]; depth: number }) {
  return (
    <>
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {index > 0 && ' '}
          {inlineBlock(block, depth)}
        </Fragment>
      ))}
    </>
  );
}

function inlineBlock(block: MdBlock, depth: number) {
  switch (block.type) {
    case 'paragraph':
      return <InlineTokens tokens={block.tokens} depth={depth} />;
    case 'heading':
      return (
        <strong className="font-semibold">
          <InlineTokens tokens={block.tokens} depth={depth} />
        </strong>
      );
    case 'code':
      return <code className="inline-code">{block.text}</code>;
    case 'quote':
      return <InlineBlocks blocks={block.blocks} depth={depth} />;
    case 'hr':
      return '—';
    case 'list':
      return block.items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && ' · '}
          {item.task && (item.task === 'done' ? '☑ ' : '☐ ')}
          <InlineTokens tokens={item.tokens} depth={depth} />
        </Fragment>
      ));
    case 'table':
      return block.header.map((cell, index) => (
        <Fragment key={index}>
          {index > 0 && ' | '}
          <InlineTokens tokens={cell} depth={depth} />
        </Fragment>
      ));
  }
}
