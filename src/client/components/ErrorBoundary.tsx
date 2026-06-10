/** ユーザー JSX のランタイムエラーを捕捉してアプリ全体のクラッシュを防ぐ */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorPanel } from './ErrorPanel';

interface Props {
  children: ReactNode;
  /** children が変わったらリセットするためのキー */
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
    // 開発時の手掛かりとしてコンソールへも出す
    console.error('MDX runtime error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorPanel title="描画エラー" error={this.state.error} />;
    }
    return this.props.children;
  }
}
