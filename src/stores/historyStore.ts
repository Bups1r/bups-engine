import { create } from 'zustand'
import { commandHistory, Command } from '../engine/editor/CommandHistory'

interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  lastCommand: Command | null

  undo: () => void
  redo: () => void
  refresh: () => void
}

export const useHistoryStore = create<HistoryState>((set) => {
  // Subscribe to command history changes
  commandHistory.subscribe(() => {
    set({
      canUndo: commandHistory.canUndo(),
      canRedo: commandHistory.canRedo(),
      lastCommand: commandHistory.getUndoStack().at(-1) ?? null
    })
  })

  return {
    canUndo: false,
    canRedo: false,
    lastCommand: null,

    undo: () => {
      commandHistory.undo()
    },

    redo: () => {
      commandHistory.redo()
    },

    refresh: () => {
      set({
        canUndo: commandHistory.canUndo(),
        canRedo: commandHistory.canRedo(),
        lastCommand: commandHistory.getUndoStack().at(-1) ?? null
      })
    }
  }
})
