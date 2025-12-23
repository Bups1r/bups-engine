import { create } from 'zustand'
import { Engine } from '../engine'
import { Entity } from '../engine/ecs/Entity'
import { GizmoMode, GizmoSpace } from '../engine/editor'

interface EngineState {
  engine: Engine | null
  selectedEntity: Entity | null
  isPlaying: boolean
  stats: {
    fps: number
    entities: number
    drawCalls: number
    triangles: number
  }

  // Gizmo state
  gizmoMode: GizmoMode
  gizmoSpace: GizmoSpace
  gizmoEnabled: boolean

  setEngine: (engine: Engine) => void
  clearEngine: () => void
  selectEntity: (entity: Entity | null) => void
  setPlaying: (playing: boolean) => void
  updateStats: () => void
  setGizmoMode: (mode: GizmoMode) => void
  setGizmoSpace: (space: GizmoSpace) => void
  setGizmoEnabled: (enabled: boolean) => void
  toggleGizmoSpace: () => void
}

export const useEngineStore = create<EngineState>((set, get) => ({
  engine: null,
  selectedEntity: null,
  isPlaying: false,
  stats: {
    fps: 0,
    entities: 0,
    drawCalls: 0,
    triangles: 0
  },

  // Gizmo state
  gizmoMode: 'translate',
  gizmoSpace: 'world',
  gizmoEnabled: true,

  setEngine: (engine) => set({ engine }),
  clearEngine: () => set({ engine: null, selectedEntity: null }),

  selectEntity: (entity) => set({ selectedEntity: entity }),

  setPlaying: (playing) => {
    const { engine } = get()
    if (!engine) return

    if (playing) {
      engine.start()
    } else {
      engine.stop()
    }
    set({ isPlaying: playing })
  },

  updateStats: () => {
    const { engine } = get()
    if (!engine) return

    const stats = engine.getStats()
    set({
      stats: {
        fps: stats.fps,
        entities: stats.entities,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles
      }
    })
  },

  setGizmoMode: (mode) => set({ gizmoMode: mode }),
  setGizmoSpace: (space) => set({ gizmoSpace: space }),
  setGizmoEnabled: (enabled) => set({ gizmoEnabled: enabled }),
  toggleGizmoSpace: () => set((state) => ({
    gizmoSpace: state.gizmoSpace === 'world' ? 'local' : 'world'
  }))
}))
