import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useChatStore, ChatMessage } from '../stores/chatStore'
import { useEngineStore } from '../stores/engineStore'
import { invoke } from '@tauri-apps/api/tauri'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/api/shell'
import { contextBuilder } from '../engine/ai/ContextBuilder'

// Memoized message component to prevent re-renders
interface MessageItemProps {
  msg: ChatMessage
  showContextDetails: string | null
  onToggleContext: (id: string) => void
}

const MessageItem = memo(function MessageItem({ msg, showContextDetails, onToggleContext }: MessageItemProps) {
  const handleContextClick = useCallback(() => {
    onToggleContext(msg.id)
  }, [msg.id, onToggleContext])

  return (
    <div className={`chat-message ${msg.role}`}>
      {msg.hasContext && msg.role === 'user' && (
        <div
          className="chat-context-indicator"
          onClick={handleContextClick}
        >
          <span className="chat-context-dot">●</span>
          Context included
          <span className="chat-context-arrow">
            {showContextDetails === msg.id ? '▼' : '▶'}
          </span>
        </div>
      )}
      {showContextDetails === msg.id && msg.context && (
        <pre className="chat-context-details">
          {msg.context}
        </pre>
      )}
      <div>
        {msg.content}
        {msg.isStreaming && (
          <span className="streaming-cursor">|</span>
        )}
      </div>
    </div>
  )
})

export default function Chat() {
  const [input, setInput] = useState('')
  const [showContextDetails, setShowContextDetails] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [cliMissing, setCliMissing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isLoading,
    includeContext,
    streamingMessageId,
    addMessage,
    setLoading,
    setIncludeContext,
    startStreamingMessage,
    updateStreamingMessage,
    completeStreamingMessage
  } = useChatStore()
  const { engine, selectedEntity } = useEngineStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Update context builder when engine or selected entity changes
  useEffect(() => {
    contextBuilder.setEngine(engine)
  }, [engine])

  useEffect(() => {
    contextBuilder.setSelectedEntity(selectedEntity)
  }, [selectedEntity])

  // Store refs for streaming state to avoid dependency issues
  const streamingIdRef = useRef(streamingMessageId)
  const messagesRef = useRef(messages)

  useEffect(() => {
    streamingIdRef.current = streamingMessageId
  }, [streamingMessageId])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Set up streaming event listeners - only once on mount
  useEffect(() => {
    const unlistenFns: UnlistenFn[] = []
    let mounted = true

    const setupListeners = async () => {
      try {
        const chunkUnlisten = await listen<string>('claude-stream-chunk', (event) => {
          if (!mounted) return
          const id = streamingIdRef.current
          if (id) {
            const currentMessage = messagesRef.current.find(m => m.id === id)
            const newContent = currentMessage
              ? currentMessage.content + event.payload
              : event.payload
            updateStreamingMessage(id, newContent)
          }
        })
        if (mounted) unlistenFns.push(chunkUnlisten)

        const completeUnlisten = await listen<string>('claude-stream-complete', () => {
          if (!mounted) return
          const id = streamingIdRef.current
          if (id) {
            completeStreamingMessage(id)
          }
          setIsGenerating(false)
          setLoading(false)
        })
        if (mounted) unlistenFns.push(completeUnlisten)

        const errorUnlisten = await listen<string>('claude-stream-error', (event) => {
          if (!mounted) return
          const id = streamingIdRef.current
          if (id) {
            const currentMessage = messagesRef.current.find(m => m.id === id)
            const errorContent = currentMessage
              ? currentMessage.content + `\n\nError: ${event.payload}`
              : `Error: ${event.payload}`
            updateStreamingMessage(id, errorContent)
            completeStreamingMessage(id)
          }
          setIsGenerating(false)
          setLoading(false)
        })
        if (mounted) unlistenFns.push(errorUnlisten)

        const cancelledUnlisten = await listen('claude-stream-cancelled', () => {
          if (!mounted) return
          const id = streamingIdRef.current
          if (id) {
            const currentMessage = messagesRef.current.find(m => m.id === id)
            const cancelledContent = currentMessage
              ? currentMessage.content + '\n\n[Generation cancelled by user]'
              : '[Generation cancelled by user]'
            updateStreamingMessage(id, cancelledContent)
            completeStreamingMessage(id)
          }
          setIsGenerating(false)
          setLoading(false)
        })
        if (mounted) unlistenFns.push(cancelledUnlisten)
      } catch (error) {
        console.error('Failed to set up event listeners:', error)
      }
    }

    setupListeners()

    return () => {
      mounted = false
      unlistenFns.forEach(fn => fn())
    }
  }, [updateStreamingMessage, completeStreamingMessage, setLoading])

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading || isGenerating) return

    const userMessage = input.trim()
    setInput('')

    // Build context if enabled
    let contextString: string | undefined
    if (includeContext && contextBuilder.hasRelevantContext()) {
      contextString = contextBuilder.buildContextString()
    }

    addMessage('user', userMessage, contextString)
    setLoading(true)
    setIsGenerating(true)

    // Start a streaming message
    const messageId = startStreamingMessage()

    try {
      // Prepare message with context for Claude
      let fullMessage = userMessage
      if (contextString) {
        fullMessage = `${contextString}\n\n=== User Request ===\n${userMessage}`
      }

      // Call Tauri backend to stream from Claude CLI
      await invoke<string>('stream_to_claude', {
        message: fullMessage
      })
    } catch (error) {
      console.error('Failed to communicate with Claude:', error)

      const errorStr = String(error)

      // Check if Claude CLI is missing
      if (errorStr.includes('program not found') || errorStr.includes('spawn')) {
        setCliMissing(true)
        updateStreamingMessage(messageId, 'Claude CLI is not installed. The AI Chat feature requires the Claude CLI to be installed and in your PATH.')
      } else {
        updateStreamingMessage(messageId, `Error: ${error}`)
      }
      completeStreamingMessage(messageId)

      setIsGenerating(false)
      setLoading(false)
    }
  }, [input, isLoading, isGenerating, includeContext, addMessage, setLoading, startStreamingMessage, updateStreamingMessage, completeStreamingMessage])

  const handleCancel = useCallback(async () => {
    if (!isGenerating) return

    try {
      await invoke('cancel_stream')
    } catch (error) {
      console.error('Failed to cancel stream:', error)
    }
  }, [isGenerating])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleToggleContext = useCallback((id: string) => {
    setShowContextDetails(prev => prev === id ? null : id)
  }, [])

  const contextSummary = contextBuilder.getSummary()
  const hasContext = contextBuilder.hasRelevantContext()

  return (
    <div className="chat-container">
      {cliMissing && (
        <div className="cli-warning">
          <div className="cli-warning-content">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span><strong>Claude CLI not found.</strong> AI Chat requires the Claude CLI.</span>
          </div>
          <button
            onClick={() => open('https://claude.ai/download')}
            className="cli-install-btn"
          >
            Install
          </button>
        </div>
      )}
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            <div className="chat-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div className="chat-empty-title">AI Assistant</div>
            <div className="chat-empty-hint">
              Ask me anything about game development! Try:
            </div>
            <div className="chat-suggestions">
              <button className="suggestion-btn" onClick={() => setInput("How do I make an object rotate?")}>
                How do I make an object rotate?
              </button>
              <button className="suggestion-btn" onClick={() => setInput("Create a simple player controller")}>
                Create a player controller
              </button>
              <button className="suggestion-btn" onClick={() => setInput("Explain how lighting works")}>
                Explain how lighting works
              </button>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            showContextDetails={showContextDetails}
            onToggleContext={handleToggleContext}
          />
        ))}
        {isLoading && !streamingMessageId && (
          <div className="chat-message assistant thinking">
            <div className="thinking-indicator">
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
              <span className="thinking-dot"></span>
            </div>
            <span>Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        {hasContext && includeContext && (
          <div className="context-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="5"/>
            </svg>
            <span>{contextSummary}</span>
          </div>
        )}

        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything about game development..."
          rows={3}
          disabled={isLoading}
        />

        <div className="chat-actions">
          <label className={`context-toggle ${includeContext ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Include context
          </label>

          <div className="chat-buttons">
            {isGenerating && (
              <button
                className="cancel-btn"
                onClick={handleCancel}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                </svg>
                Cancel
              </button>
            )}
            <button
              className="send-btn"
              onClick={handleSubmit}
              disabled={isLoading || isGenerating || !input.trim()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {isGenerating ? 'Generating...' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .cli-warning {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%);
          border-bottom: 1px solid rgba(59, 130, 246, 0.3);
          padding: var(--spacing-md);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-md);
        }
        .cli-warning-content {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          color: var(--info-light);
          font-size: 12px;
        }
        .cli-install-btn {
          background: var(--info);
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all var(--transition-fast);
        }
        .cli-install-btn:hover {
          background: var(--info-light);
        }

        .chat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xl);
          text-align: center;
          height: 100%;
          min-height: 300px;
        }
        .chat-empty-icon {
          color: var(--accent);
          opacity: 0.6;
          margin-bottom: var(--spacing-lg);
        }
        .chat-empty-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: var(--spacing-sm);
        }
        .chat-empty-hint {
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: var(--spacing-lg);
        }
        .chat-suggestions {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
          width: 100%;
          max-width: 280px;
        }
        .suggestion-btn {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: var(--spacing-sm) var(--spacing-md);
          color: var(--text-secondary);
          font-size: 12px;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }
        .suggestion-btn:hover {
          background: var(--bg-tertiary);
          border-color: var(--accent);
          color: var(--accent-light);
        }

        .thinking {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }
        .thinking-indicator {
          display: flex;
          gap: 4px;
        }
        .thinking-dot {
          width: 6px;
          height: 6px;
          background: var(--accent);
          border-radius: 50%;
          animation: thinking-bounce 1.4s ease-in-out infinite;
        }
        .thinking-dot:nth-child(1) { animation-delay: 0s; }
        .thinking-dot:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes thinking-bounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1.2); opacity: 1; }
        }

        .streaming-cursor {
          animation: blink 1s steps(2, start) infinite;
          margin-left: 2px;
          color: var(--accent);
        }
        @keyframes blink {
          to { visibility: hidden; }
        }

        .context-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--success);
          margin-bottom: var(--spacing-sm);
          padding: 6px 10px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: var(--radius-md);
        }

        .chat-actions {
          margin-top: var(--spacing-sm);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .context-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px 10px;
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }
        .context-toggle:hover {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
        }
        .context-toggle.active {
          color: var(--success);
        }
        .context-toggle input {
          display: none;
        }

        .chat-buttons {
          display: flex;
          gap: var(--spacing-sm);
        }
        .cancel-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: var(--radius-md);
          color: var(--error-light);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .cancel-btn:hover {
          background: rgba(239, 68, 68, 0.2);
        }
        .send-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
          border: none;
          border-radius: var(--radius-md);
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          box-shadow: 0 2px 8px var(--accent-glow);
        }
        .send-btn:hover:not(:disabled) {
          box-shadow: 0 4px 12px var(--accent-glow);
          transform: translateY(-1px);
        }
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  )
}
