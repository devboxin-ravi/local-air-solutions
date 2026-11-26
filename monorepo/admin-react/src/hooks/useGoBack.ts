/**
 * Back navigation for detail and form pages. Logic only.
 *
 * Returns to the previous page when it was inside the app (so list filters, page and scroll
 * survive); when the page was opened directly — a pasted link, a new tab — it goes to `fallback`.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    // React Router stores the position in its own history stack as `idx`; 0 = first page of this tab.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
