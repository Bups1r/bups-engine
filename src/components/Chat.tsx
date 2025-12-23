import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/chatStore'
import { invoke } from '@tauri-apps/api/tauri'

export default function Chat() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, isLoading, addMessage, setLoading } = useChatStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    addMessage('user', userMessage)
    setLoading(true)

    try {
      // Call Tauri backend to communicate with Claude CLI
      const response = await invoke<string>('send_to_claude', {
        message: userMessage
      })
      addMessage('assistant', response)
    } catch (error) {
      console.error('Failed to communicate with Claude:', error)
      addMessage('assistant', `Error: ${error}. Make sure Claude CLI is installed and accessible.`)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
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
            `}</style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build..."
          rows={3}
          disabled={isLoading}
        />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? 'Generating...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
