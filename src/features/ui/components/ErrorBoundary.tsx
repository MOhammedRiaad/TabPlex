import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div style={{ padding: '20px', color: 'red', fontFamily: 'system-ui' }}>
                        <h1>Application Error</h1>
                        <pre style={{ background: '#f8f8f8', padding: '10px', overflow: 'auto' }}>
                            {this.state.error?.toString()}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            style={{ marginTop: '10px', padding: '8px 16px' }}
                        >
                            Reload
                        </button>
                    </div>
                )
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
