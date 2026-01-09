import React from 'react';
import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom';
import { ROUTES } from '../routes';

/**
 * Error boundary component for route-level errors
 * Catches errors thrown during route component rendering
 */
export const RouteErrorBoundary: React.FC = () => {
    const error = useRouteError();
    const navigate = useNavigate();

    let errorMessage = 'An unexpected error occurred';
    let errorDetails: string | undefined;

    if (isRouteErrorResponse(error)) {
        errorMessage = error.statusText || `Error ${error.status}`;
        errorDetails = error.data as string;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = error.stack;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    const handleGoHome = () => {
        navigate(ROUTES.TODAY, { replace: true });
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                padding: '20px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
        >
            <h1 style={{ color: '#ef4444', marginBottom: '16px' }}>Route Error</h1>
            <p style={{ color: '#6b7280', marginBottom: '24px', textAlign: 'center' }}>{errorMessage}</p>
            {errorDetails && (
                <details
                    style={{
                        width: '100%',
                        maxWidth: '600px',
                        marginBottom: '24px',
                        background: '#f9fafb',
                        padding: '16px',
                        borderRadius: '8px',
                    }}
                >
                    <summary style={{ cursor: 'pointer', color: '#6b7280', marginBottom: '8px' }}>
                        Error Details
                    </summary>
                    <pre
                        style={{
                            overflow: 'auto',
                            fontSize: '12px',
                            color: '#374151',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {errorDetails}
                    </pre>
                </details>
            )}
            <button
                onClick={handleGoHome}
                style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                }}
            >
                Go to Home
            </button>
        </div>
    );
};
