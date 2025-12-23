import { create } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isConnected: boolean

  addMessage: (role: 'user' | 'assistant', content: string) => void
  setLoading: (loading: boolean) => void
  setConnected: (connected: boolean) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI game development assistant. Describe what you want to create and I'll help you build it. For example:\n\n- \"Create a first-person shooter with sci-fi aesthetics\"\n- \"Add a player controller with WASD movement\"\n- \"Create a skybox with stars and nebulas\"",
      timestamp: new Date(),
    }
  ],
  isLoading: false,
  isConnected: true,

  addMessage: (role, content) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
    }]
  })),

  setLoading: (loading) => set({ isLoading: loading }),
  setConnected: (connected) => set({ isConnected: connected }),
  clearMessages: () => set({ messages: [] }),
}))
