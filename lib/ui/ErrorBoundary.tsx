import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps a render failure from turning the popup or settings page blank. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[winnow] UI error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="stack" style={{ gap: 8, padding: 12 }}>
          <h2>Something went wrong</h2>
          <p className="small muted">{this.state.error.message}</p>
          <button className="btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
