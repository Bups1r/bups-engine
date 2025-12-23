import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context?: string
  hasContext?: boolean
  isStreaming?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isConnected: boolean
  includeContext: boolean
  streamingMessageId: string | null

  addMessage: (role: 'user' | 'assistant', content: string, context?: string) => void
  startStreamingMessage: () => string
  updateStreamingMessage: (id: string, content: string) => void
  completeStreamingMessage: (id: string) => void
  setLoading: (loading: boolean) => void
  setConnected: (connected: boolean) => void
  setIncludeContext: (include: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI game development assistant. Describe what you want to create and I'll help you build it. For example:\n\n- \"Create a first-person shooter with sci-fi aesthetics\"\n- \"Add a player controller with WASD movement\"\n- \"Create a skybox with stars and nebulas\"\n\nI'm now context-aware! When you have an entity selected or encounter errors, I'll automatically understand the context to give you better assistance.",
      timestamp: new Date(),
    }
  ],
  isLoading: false,
  isConnected: true,
  includeContext: true,
  streamingMessageId: null,

  addMessage: (role, content, context) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      context,
      hasContext: !!context
    }]
  })),

  startStreamingMessage: () => {
    const id = Date.now().toString()
    set((state) => ({
      messages: [...state.messages, {
        id,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      }],
      streamingMessageId: id,
    }))
    return id
  },

  updateStreamingMessage: (id, content) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === id ? { ...msg, content } : msg
    )
  })),

  completeStreamingMessage: (id) => set((state) => ({
    messages: state.messages.map(msg =>
      msg.id === id ? { ...msg, isStreaming: false } : msg
    ),
    streamingMessageId: null,
  })),

  setLoading: (loading) => set({ isLoading: loading }),
  setConnected: (connected) => set({ isConnected: connected }),
  setIncludeContext: (include) => set({ includeContext: include }),
  clearMessages: () => set({ messages: [] }),
}))
