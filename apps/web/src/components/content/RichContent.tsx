import { Link } from '@tanstack/react-router';
import { Fragment, MouseEvent, ReactNode } from 'react';
import { useTokenizedContent } from '../../controllers/use-content-view';
import { useLayoutController } from '../../controllers/use-layout-controller';
import type { Token } from '../../services/content-tokenizer';
import { BlockRefInline } from './BlockRefInline';

interface RichContentProps {
  content: string;
  depth?: number;
  onToggleTodo?: () => void;
}

const stop = (event: MouseEvent) => event.stopPropagation();

type OpenInSidebar = (title: string) => void;

export function RichContent({ content, depth = 0, onToggleTodo }: RichContentProps) {
  const { todo, tokens } = useTokenizedContent(content);
  const layout = useLayoutController();
  const openPage: OpenInSidebar = (title) => layout.openInSidebar({ kind: 'page', title });
  return (
    <>
      {todo && (
        <input
          type="checkbox"
          className="todo-box"
          checked={todo === 'done'}
          disabled={!onToggleTodo}
          onClick={stop}
          onChange={() => onToggleTodo?.()}
        />
      )}
      <span className={todo === 'done' ? 'text-muted line-through decoration-1' : undefined}>{renderTokens(tokens, depth, openPage)}</span>
    </>
  );
}

function renderTokens(tokens: Token[], depth: number, openPage: OpenInSidebar): ReactNode {
  return tokens.map((token, index) => <Fragment key={index}>{renderToken(token, depth, openPage)}</Fragment>);
}

function pageClick(title: string, openPage: OpenInSidebar) {
  return (event: MouseEvent) => {
    event.stopPropagation();
    if (!event.shiftKey) return;
    event.preventDefault();
    openPage(title);
  };
}

function renderToken(token: Token, depth: number, openPage: OpenInSidebar): ReactNode {
  switch (token.type) {
    case 'text':
      return token.text;
    case 'lineBreak':
      return <br />;
    case 'pageLink':
      return (
        <Link to="/page/$title" params={{ title: token.title }} className="page-link" onClick={pageClick(token.title, openPage)}>
          <span className="bracket">[[</span>
          {token.title}
          <span className="bracket">]]</span>
        </Link>
      );
    case 'tag':
      return (
        <Link to="/page/$title" params={{ title: token.title }} className="tag-link" onClick={pageClick(token.title, openPage)}>
          #{token.title}
        </Link>
      );
    case 'blockRef':
      return <BlockRefInline id={token.id} depth={depth} />;
    case 'bold':
      return <strong className="font-semibold">{renderTokens(token.children, depth, openPage)}</strong>;
    case 'italic':
      return <em>{renderTokens(token.children, depth, openPage)}</em>;
    case 'highlight':
      return <mark className="highlight">{renderTokens(token.children, depth, openPage)}</mark>;
    case 'code':
      return <code className="inline-code">{token.text}</code>;
    case 'image':
      return (
        <a href={token.src} target="_blank" rel="noreferrer" onClick={stop} className="note-image">
          <img src={token.src} alt={token.alt} loading="lazy" />
        </a>
      );
    case 'link':
      return (
        <a href={token.href} target="_blank" rel="noreferrer" className="url-link" onClick={stop}>
          {token.href.startsWith('/api/files/') && '📎 '}
          {token.text}
        </a>
      );
    case 'url':
      return (
        <a href={token.href} target="_blank" rel="noreferrer" className="url-link" onClick={stop}>
          {token.href}
        </a>
      );
  }
}
