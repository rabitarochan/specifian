/** Catches runtime errors in user JSX to prevent the entire app from crashing. */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPanel } from './ErrorPanel';

interface Props {
  children: ReactNode;
  /** Key used to reset when children change */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Also log to console as a development hint
    console.error('MDX runtime error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorPanel title="Render Error" error={this.state.error} />;
    }
    return this.props.children;
  }
}
