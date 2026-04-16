import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="h-full flex flex-col items-center justify-center bg-white p-8">
          <div className="text-6xl font-black text-red-500 mb-4">⚠️</div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">组件加载失败</h2>
          <p className="text-gray-500 mb-6 text-center max-w-md">
            该组件在加载过程中遇到了错误。请尝试刷新页面或联系技术支持。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-600 transition-colors"
          >
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;