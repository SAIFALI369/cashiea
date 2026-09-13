import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, MessageSquare } from 'lucide-react'
import { captureError } from '../lib/errorTracking'
import { log } from '../lib/logger'

/**
 * ErrorBoundary — catches any unhandled exception in the React tree and
 * shows a recovery UI instead of crashing to a white screen.
 *
 * Wrap the entire app (or any subtree) to prevent "one bad API response
 * kills the whole app" scenarios.
 */
interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack?: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Structured report (deduped, rate-limited, flushed to client_errors)
    // + console line with the correlation request id for local debugging.
    captureError(error, 'boundary', { componentStack: errorInfo.componentStack })
    log.error('ErrorBoundary caught a render crash', {
      message: error.message,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/app'
  }

  handleReport = () => {
    const errorText = this.state.error
      ? `${this.state.error.name}: ${this.state.error.message}`
      : 'Unknown error'
    // Copy to clipboard for easy reporting
    navigator.clipboard?.writeText(errorText).then(() => {
      // Show a toast (using the global toast if available)
      import('react-hot-toast').then(({ default: toast }) => {
        toast.success('Error copied — paste it to support')
      })
    }).catch(() => {})
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-warning/10 border-2 border-warning/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-warning" />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-fg mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-fg-muted mb-6">
              The app hit an unexpected error. Your data is safe — try reloading,
              or go back to the dashboard.
            </p>

            {/* Error details — ALWAYS visible, exact break location */}
            {this.state.error && (
              <details className="mb-6 text-left" open>
                <summary className="text-xs font-semibold text-fg-subtle cursor-pointer hover:text-fg-muted transition-colors">
                  Technical details — exact location of the break
                </summary>
                <pre className="mt-2 p-3 rounded-control bg-surface-2 text-[10px] leading-relaxed text-fg-muted overflow-x-auto whitespace-pre-wrap break-all">
                  {`${this.state.error.name}: ${this.state.error.message}`}

{'\nWHERE IT BROKE — component trail (top = closest to the bug):\n'}
{this.state.componentStack || 'trail not captured'}
                </pre>
                <p className="mt-1 text-[10px] text-fg-subtle">
                  Screenshot or copy this box — the trail names the exact component and code position.
                </p>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="btn-primary w-full h-11 text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Reload app
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn-secondary w-full h-11 text-sm font-semibold"
              >
                <Home className="w-4 h-4" /> Go to dashboard
              </button>
              <button
                onClick={this.handleReport}
                className="btn-ghost w-full h-11 text-sm font-semibold text-fg-muted"
              >
                <MessageSquare className="w-4 h-4" /> Copy error for support
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
