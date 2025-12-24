import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
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
        <div style={{
          background: '#1e3a5f',
          color: '#93c5fd',
          padding: '12px 16px',
          fontSize: '13px',
          borderBottom: '1px solid #2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div>
            <strong>Claude CLI not found.</strong> AI Chat requires the Claude CLI.
          </div>
          <button
            onClick={() => open('https://claude.ai/download')}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap'
            }}
          >
            Install Claude CLI
          </button>
        </div>
      )}
      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            showContextDetails={showContextDetails}
            onToggleContext={handleToggleContext}
          />
        ))}
        {isLoading && !streamingMessageId && (
          <div className="chat-message assistant" style={{ opacity: 0.7 }}>
            <span className="loading-dots">Thinking</span>
            <style>{`
              .loading-dots::after {
                content: '';
                animation: dots 1.5s steps(4, end) infinite;
              }
              @keyframes dots {
                0%, 20% { content: ''; }
                40% { content: '.'; }
                60% { content: '..'; }
                80%, 100% { content: '...'; }
              }
              .streaming-cursor {
                animation: blink 1s steps(2, start) infinite;
                margin-left: 2px;
              }
              @keyframes blink {
                to { visibility: hidden; }
              }
            `}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        {hasContext && includeContext && (
          <div style={{
            fontSize: '0.75rem',
            color: '#10b981',
            marginBottom: '8px',
            padding: '6px 10px',
            background: '#064e3b',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>
              <span style={{ marginRight: '6px' }}>●</span>
              {contextSummary}
            </span>
          </div>
        )}

        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build..."
          rows={3}
          disabled={isLoading}
        />

        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            color: includeContext ? '#10b981' : '#6b7280'
          }}>
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Include context
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            {isGenerating && (
              <button
                className="btn btn-secondary"
                onClick={handleCancel}
                style={{ background: '#d32f2f', borderColor: '#d32f2f' }}
              >
                Cancel
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isLoading || isGenerating || !input.trim()}
            >
              {isGenerating ? 'Generating...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
