/**
 * Root providers: router, query cache, tooltips, toasts.
 */

import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingBlock } from './components/common';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppRoutes } from './routes';
import { TooltipProvider } from './components/ui/overlays';
import { ApiError } from './services/apiClient';
import { HTTP, QUERY } from './constants/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY.STALE_MS,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof ApiError && [HTTP.UNAUTHORIZED, HTTP.FORBIDDEN, 404].includes(error.status)) && count < 2,
    },
  },
});

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingBlock rows={6} className="mx-auto max-w-3xl pt-24" />}>
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
          <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
        </TooltipProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
