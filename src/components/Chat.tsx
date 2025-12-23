import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useEngineStore } from '../stores/engineStore'
import { invoke } from '@tauri-apps/api/tauri'
import { listen } from '@tauri-apps/api/event'
import { contextBuilder } from '../engine/ai/ContextBuilder'

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

  // Set up streaming event listeners
  useEffect(() => {
    const unlistenChunk = listen<string>('claude-stream-chunk', (event) => {
      if (streamingMessageId) {
        const currentMessage = messages.find(m => m.id === streamingMessageId)
        const newContent = currentMessage
          ? currentMessage.content + event.payload + '\n'
          : event.payload + '\n'
        updateStreamingMessage(streamingMessageId, newContent)
      }
    })

    const unlistenComplete = listen<string>('claude-stream-complete', () => {
      if (streamingMessageId) {
        completeStreamingMessage(streamingMessageId)
      }
      setIsGenerating(false)
      setLoading(false)
    })

    const unlistenError = listen<string>('claude-stream-error', (event) => {
      if (streamingMessageId) {
        const currentMessage = messages.find(m => m.id === streamingMessageId)
        const errorContent = currentMessage
          ? currentMessage.content + `\n\nError: ${event.payload}`
          : `Error: ${event.payload}`
        updateStreamingMessage(streamingMessageId, errorContent)
        completeStreamingMessage(streamingMessageId)
      }
      setIsGenerating(false)
      setLoading(false)
    })

    const unlistenCancelled = listen('claude-stream-cancelled', () => {
      if (streamingMessageId) {
        const currentMessage = messages.find(m => m.id === streamingMessageId)
        const cancelledContent = currentMessage
          ? currentMessage.content + '\n\n[Generation cancelled by user]'
          : '[Generation cancelled by user]'
        updateStreamingMessage(streamingMessageId, cancelledContent)
        completeStreamingMessage(streamingMessageId)
      }
      setIsGenerating(false)
      setLoading(false)
    })

    return () => {
      unlistenChunk.then(fn => fn())
      unlistenComplete.then(fn => fn())
      unlistenError.then(fn => fn())
      unlistenCancelled.then(fn => fn())
    }
  }, [streamingMessageId, messages, updateStreamingMessage, completeStreamingMessage])

  const handleSubmit = async () => {
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
  }

  const handleCancel = async () => {
    if (!isGenerating) return

    try {
      await invoke('cancel_stream')
    } catch (error) {
      console.error('Failed to cancel stream:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

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
          borderBottom: '1px solid #2563eb'
        }}>
          <strong>Claude CLI not found.</strong> AI Chat requires the Claude CLI.
          <br />
          <span style={{ opacity: 0.8, fontSize: '12px' }}>
            Install from: https://claude.ai/download
          </span>
        </div>
      )}
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.hasContext && msg.role === 'user' && (
              <div style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              onClick={() => setShowContextDetails(showContextDetails === msg.id ? null : msg.id)}
              >
                <span style={{ color: '#10b981' }}>●</span>
                Context included
                <span style={{ fontSize: '0.7rem' }}>
                  {showContextDetails === msg.id ? '▼' : '▶'}
                </span>
              </div>
            )}
            {showContextDetails === msg.id && msg.context && (
              <pre style={{
                fontSize: '0.7rem',
                background: '#1f2937',
                padding: '8px',
                borderRadius: '4px',
                marginBottom: '8px',
                overflow: 'auto',
                maxHeight: '200px',
                whiteSpace: 'pre-wrap'
              }}>
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
