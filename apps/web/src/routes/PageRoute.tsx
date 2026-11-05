import { useParams, useSearch } from '@tanstack/react-router';
import { PageView } from '../components/page/PageView';

export function PageRoute() {
  const { title } = useParams({ from: '/page/$title' });
  const { zoom } = useSearch({ from: '/page/$title' });
  return <PageView key={title.toLowerCase()} title={title} zoomId={zoom} />;
}
