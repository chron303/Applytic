import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", color: "red", background: "#fee2e2", minHeight: "100vh" }}>
          <h1>Something went wrong.</h1>
          <p style={{ fontWeight: "bold" }}>{this.state.error && this.state.error.toString()}</p>
          <pre style={{ whiteSpace: "pre-wrap", background: "#f87171", color: "white", padding: "1rem", borderRadius: "8px" }}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
