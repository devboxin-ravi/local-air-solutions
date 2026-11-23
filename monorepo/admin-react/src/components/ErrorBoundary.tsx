/**
 * Catches render errors (including failed lazy chunk loads) and offers a reload.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './common';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (this.state.error)
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <ErrorState message="Something went wrong while showing this page." onRetry={() => window.location.reload()} />
        </div>
      );
    return this.props.children;
  }
}
