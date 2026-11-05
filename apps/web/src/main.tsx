import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ApiError } from './repositories/api-client';
import { router } from './router';
import { saveQueue } from './services/save-queue';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: (failures, error) => failures < 5 && (!(error instanceof ApiError) || error.status >= 500),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

window.addEventListener('beforeunload', (event) => {
  saveQueue.flushAll();
  if (saveQueue.hasPendingWork()) event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
