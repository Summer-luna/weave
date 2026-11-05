import clsx from 'clsx';
import { MouseEvent, ReactNode } from 'react';
import type { MdBlock } from '../../services/markdown-block-parser';
import { InlineTokens } from './InlineTokens';

interface MarkdownBlocksProps {
  blocks: MdBlock[];
  depth: number;
  lead?: ReactNode;
  onToggleTask?: (line: number) => void;
}

const stop = (event: MouseEvent) => event.stopPropagation();

export function MarkdownBlocks({ blocks, depth, lead, onToggleTask }: MarkdownBlocksProps) {
  const leadsInline = blocks[0]?.type === 'paragraph' || blocks[0]?.type === 'heading';
  return (
    <>
      {!leadsInline && lead}
      {blocks.map((block, index) => (
        <MarkdownBlockView key={index} block={block} depth={depth} lead={index === 0 && leadsInline ? lead : null} onToggleTask={onToggleTask} />
      ))}
    </>
  );
}

function MarkdownBlockView({ block, depth, lead, onToggleTask }: { block: MdBlock; depth: number; lead: ReactNode; onToggleTask?: (line: number) => void }) {
  switch (block.type) {
    case 'paragraph':
      return (
        <div className="md-paragraph">
          {lead}
          <InlineTokens tokens={block.tokens} depth={depth} />
        </div>
      );
    case 'heading': {
      const Tag = `h${Math.min(block.level, 6)}` as 'h1';
      return (
        <Tag className={`md-heading md-h${block.level}`}>
          {lead}
          <InlineTokens tokens={block.tokens} depth={depth} />
        </Tag>
      );
    }
    case 'code':
      return (
        <pre className="md-code" onClick={stop}>
          {block.lang && <span className="md-code-lang">{block.lang}</span>}
          <code>{block.text}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote className="md-quote">
          <MarkdownBlocks blocks={block.blocks} depth={depth} onToggleTask={onToggleTask} />
        </blockquote>
      );
    case 'hr':
      return <hr className="md-hr" />;
    case 'list':
      return (
        <div className="md-list" role="list">
          {block.items.map((item) => (
            <div key={item.line} role="listitem" className={clsx('md-list-item', item.task === 'done' && 'md-task-done')} style={{ paddingLeft: `${item.depth * 1.25}em` }}>
              {item.task ? (
                <input
                  type="checkbox"
                  className="todo-box md-task-box"
                  checked={item.task === 'done'}
                  disabled={!onToggleTask}
                  onClick={stop}
                  onChange={() => onToggleTask?.(item.line)}
                />
              ) : (
                <span className="md-list-marker">{item.marker ?? '•'}</span>
              )}
              <span className="min-w-0 flex-1">
                <InlineTokens tokens={item.tokens} depth={depth} />
              </span>
            </div>
          ))}
        </div>
      );
    case 'table':
      return (
        <div className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index} style={{ textAlign: block.align[index] ?? undefined }}>
                    <InlineTokens tokens={cell} depth={depth} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {block.header.map((_, index) => (
                    <td key={index} style={{ textAlign: block.align[index] ?? undefined }}>
                      <InlineTokens tokens={row[index] ?? []} depth={depth} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
