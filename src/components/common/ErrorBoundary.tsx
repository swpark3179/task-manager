import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// 렌더 도중 던져진 예외를 잡아 앱 전체가 빈(다크 테마에서는 검은) 화면으로
// 무너지는 것을 막는다. 폴백 UI에서 새로고침으로 앱을 복구할 수 있다.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Render crashed:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <h1 className="error-boundary-title">문제가 발생했어요</h1>
          <p className="error-boundary-desc">
            화면을 표시하는 중 오류가 발생했습니다. 새로고침하면 다시 시도할 수 있어요.
          </p>
          <button
            type="button"
            className="error-boundary-btn"
            onClick={this.handleReload}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }
}
