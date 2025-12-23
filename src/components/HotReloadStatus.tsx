import { useState, useEffect } from 'react'
import { getHotReload, type HotReloadEvent, type HotReloadStatus as HotReloadStatusType } from '../engine/scripting/HotReload'

interface StatusMessage {
  text: string
  type: 'info' | 'success' | 'error'
  timestamp: number
}

export default function HotReloadStatus() {
  const [status, setStatus] = useState<HotReloadStatusType>('idle')
  const [message, setMessage] = useState<StatusMessage | null>(null)
  const [watchedScripts, setWatchedScripts] = useState<string[]>([])

  useEffect(() => {
    const hotReload = getHotReload()

    // Update initial state
    setStatus(hotReload.getStatus())
    setWatchedScripts(hotReload.getWatchedScripts())

    // Listen to hot reload events
    const handleEvent = (event: HotReloadEvent) => {
      setStatus(hotReload.getStatus())

      switch (event.type) {
        case 'reload-start':
          setMessage({
            text: `Reloading ${event.scriptName}...`,
            type: 'info',
            timestamp: event.timestamp
          })
          break

        case 'reload-success':
          setMessage({
            text: `✓ ${event.scriptName} reloaded successfully`,
            type: 'success',
            timestamp: event.timestamp
          })
          // Clear success message after 3 seconds
          setTimeout(() => {
            setMessage(null)
          }, 3000)
          break

        case 'reload-error':
          setMessage({
            text: `✗ ${event.scriptName}: ${event.error}`,
            type: 'error',
            timestamp: event.timestamp
          })
          // Clear error message after 5 seconds
          setTimeout(() => {
            setMessage(null)
          }, 5000)
          break
      }

      // Update watched scripts list
      setWatchedScripts(hotReload.getWatchedScripts())
    }

    hotReload.addEventListener(handleEvent)

    // Poll for updates every second
    const interval = setInterval(() => {
      setStatus(hotReload.getStatus())
      setWatchedScripts(hotReload.getWatchedScripts())
    }, 1000)

    return () => {
      hotReload.removeEventListener(handleEvent)
      clearInterval(interval)
    }
  }, [])

  const getStatusColor = () => {
    switch (status) {
      case 'watching':
        return '#4ade80' // green
      case 'reloading':
        return '#fbbf24' // yellow
      case 'error':
        return '#ef4444' // red
      default:
        return '#6b7280' // gray
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'watching':
        return 'Hot Reload Active'
      case 'reloading':
        return 'Reloading...'
      case 'error':
        return 'Error'
      default:
        return 'Hot Reload Idle'
    }
  }

  return (
    <div className="hot-reload-status-container">
      {/* Status Indicator */}
      <div className="status-indicator" title={getStatusText()}>
        <div
          className="status-dot"
          style={{
            backgroundColor: getStatusColor(),
            animation: status === 'reloading' ? 'pulse 1.5s infinite' : 'none'
          }}
        />
        <span className="status-text">{getStatusText()}</span>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`status-message ${message.type}`}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Watched Scripts Count */}
      {watchedScripts.length > 0 && (
        <div className="watched-scripts" title={watchedScripts.join(', ')}>
          <span className="count">{watchedScripts.length}</span>
          <span className="label">script{watchedScripts.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <style>{`
        .hot-reload-status-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 8px;
          font-size: 12px;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 4px currentColor;
        }

        .status-text {
          color: var(--text-secondary);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .watched-scripts {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          color: var(--text-secondary);
        }

        .watched-scripts .count {
          color: var(--accent);
          font-weight: 600;
        }

        .watched-scripts .label {
          font-size: 10px;
        }

        .status-message {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 16px;
          border-radius: 6px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          font-size: 13px;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        .status-message.info {
          border-left: 3px solid #3b82f6;
        }

        .status-message.success {
          border-left: 3px solid #4ade80;
        }

        .status-message.error {
          border-left: 3px solid #ef4444;
          color: #ef4444;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
