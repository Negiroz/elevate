import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    constructor(props: Props) {
        super(props);
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-center text-red-500 bg-surface-dark min-h-screen flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-6xl mb-4">error</span>
                    <h1 className="text-2xl font-bold text-white mb-2">Algo salió mal</h1>
                    <p className="mb-4">Se ha producido un error al cargar esta pantalla.</p>
                    <pre className="bg-black/30 p-4 rounded text-xs text-left overflow-auto max-w-lg">
                        {this.state.error?.toString()}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600"
                    >
                        Recargar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
