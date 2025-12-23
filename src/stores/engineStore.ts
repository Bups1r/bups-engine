import { create } from 'zustand'
import { Engine } from '../engine'
import { Entity } from '../engine/ecs/Entity'

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

  setEngine: (engine: Engine) => void
  selectEntity: (entity: Entity | null) => void
  setPlaying: (playing: boolean) => void
  updateStats: () => void
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

  setEngine: (engine) => set({ engine }),

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
  }
}))
