/**
 * Authenticated shell: sticky top header + full-width content with page transitions.
 * Layout/UI only.
 */

import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TopHeader } from './TopHeader';
import { LoadingBlock } from '@/components/common';
import { config } from '@/config';
import { PAGE_CONTAINER } from '@/constants/ui';
import { cn } from '@/lib/utils';

export const AppLayout = () => {
  const location = useLocation();
  const reduce = useReducedMotion();

  // Scroll restoration: new pages start at the top; query-string changes keep position.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopHeader />
      <main className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(PAGE_CONTAINER, 'py-6 lg:py-8')}
          >
            <Suspense fallback={<LoadingBlock rows={6} />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="border-t bg-white">
        <div className={cn(PAGE_CONTAINER, 'flex flex-col items-center justify-between gap-1 py-4 text-xs text-muted-foreground sm:flex-row')}>
          <span>© {new Date().getFullYear()} Local Air Solutions · Cool Comfort Care</span>
          <span>Admin v{config.appVersion}</span>
        </div>
      </footer>
    </div>
  );
};
