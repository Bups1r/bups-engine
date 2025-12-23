import { Engine } from '../Engine'
import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'

export interface EngineContext {
  selectedEntity: {
    name: string
    id: number
    components: string[]
    transform: {
      position: { x: number; y: number; z: number }
      rotation: { x: number; y: number; z: number }
      scale: { x: number; y: number; z: number }
    } | null
    parent: string | null
    childCount: number
    tags: string[]
  } | null
  scene: {
    name: string
    totalEntities: number
    rootEntities: Array<{
      name: string
      id: number
      childCount: number
    }>
    stats: {
      entities: number
      components: number
      systems: number
    }
  }
  errors: Array<{
    message: string
    timestamp: Date
  }>
  warnings: Array<{
    message: string
    timestamp: Date
  }>
  project: {
    engine: string
    isPlaying: boolean
    fps: number
  }
}

export class ContextBuilder {
  private engine: Engine | null = null
  private selectedEntity: Entity | null = null
  private errors: Array<{ message: string; timestamp: Date }> = []
  private warnings: Array<{ message: string; timestamp: Date }> = []
  private maxLogSize: number = 10

  constructor() {
    // Initialize console interceptors for error tracking
    this.interceptConsole()
  }

  setEngine(engine: Engine | null): void {
    this.engine = engine
  }

  setSelectedEntity(entity: Entity | null): void {
    this.selectedEntity = entity
  }

  addError(message: string): void {
    this.errors.unshift({ message, timestamp: new Date() })
    if (this.errors.length > this.maxLogSize) {
      this.errors.pop()
    }
  }

  addWarning(message: string): void {
    this.warnings.unshift({ message, timestamp: new Date() })
    if (this.warnings.length > this.maxLogSize) {
      this.warnings.pop()
    }
  }

  clearErrors(): void {
    this.errors = []
  }

  clearWarnings(): void {
    this.warnings = []
  }

  private interceptConsole(): void {
    const originalError = console.error
    const originalWarn = console.warn

    console.error = (...args: unknown[]) => {
      const message = args.map(arg => String(arg)).join(' ')
      this.addError(message)
      originalError.apply(console, args)
    }

    console.warn = (...args: unknown[]) => {
      const message = args.map(arg => String(arg)).join(' ')
      this.addWarning(message)
      originalWarn.apply(console, args)
    }
  }

  buildContext(): EngineContext {
    const context: EngineContext = {
      selectedEntity: null,
      scene: {
        name: 'Unknown',
        totalEntities: 0,
        rootEntities: [],
        stats: {
          entities: 0,
          components: 0,
          systems: 0
        }
      },
      errors: [...this.errors],
      warnings: [...this.warnings],
      project: {
        engine: 'Bups Game Engine',
        isPlaying: false,
        fps: 0
      }
    }

    // Build selected entity context
    if (this.selectedEntity) {
      const entity = this.selectedEntity
      const transform = entity.getComponent(Transform)

      context.selectedEntity = {
        name: entity.name,
        id: entity.id,
        components: entity.getAllComponents().map(c => c.constructor.name),
        transform: transform ? {
          position: {
            x: transform.position.x,
            y: transform.position.y,
            z: transform.position.z
          },
          rotation: {
            x: transform.rotation.x,
            y: transform.rotation.y,
            z: transform.rotation.z
          },
          scale: {
            x: transform.scale.x,
            y: transform.scale.y,
            z: transform.scale.z
          }
        } : null,
        parent: entity.parent?.name || null,
        childCount: entity.children.length,
        tags: entity.getTags()
      }
    }

    // Build scene context
    if (this.engine) {
      const world = this.engine.world
      const stats = world.getStats()
      const rootEntities = world.getRootEntities()
      const engineStats = this.engine.getStats()

      context.scene = {
        name: world.name,
        totalEntities: stats.entities,
        rootEntities: rootEntities.slice(0, 20).map(e => ({
          name: e.name,
          id: e.id,
          childCount: e.children.length
        })),
        stats
      }

      context.project.isPlaying = this.engine ? true : false
      context.project.fps = engineStats.fps
    }

    return context
  }

  buildContextString(includeErrors: boolean = true, includeScene: boolean = true): string {
    const context = this.buildContext()
    const parts: string[] = []

    parts.push('=== Engine Context ===')
    parts.push(`Engine: ${context.project.engine}`)
    parts.push(`Playing: ${context.project.isPlaying}`)
    parts.push(`FPS: ${context.project.fps}`)
    parts.push('')

    // Selected entity context
    if (context.selectedEntity) {
      parts.push('=== Selected Entity ===')
      parts.push(`Name: ${context.selectedEntity.name}`)
      parts.push(`ID: ${context.selectedEntity.id}`)

      if (context.selectedEntity.transform) {
        const t = context.selectedEntity.transform
        parts.push(`Position: (${t.position.x.toFixed(2)}, ${t.position.y.toFixed(2)}, ${t.position.z.toFixed(2)})`)
        parts.push(`Rotation: (${t.rotation.x.toFixed(2)}, ${t.rotation.y.toFixed(2)}, ${t.rotation.z.toFixed(2)})`)
        parts.push(`Scale: (${t.scale.x.toFixed(2)}, ${t.scale.y.toFixed(2)}, ${t.scale.z.toFixed(2)})`)
      }

      parts.push(`Components: ${context.selectedEntity.components.join(', ')}`)

      if (context.selectedEntity.parent) {
        parts.push(`Parent: ${context.selectedEntity.parent}`)
      }

      if (context.selectedEntity.childCount > 0) {
        parts.push(`Children: ${context.selectedEntity.childCount}`)
      }

      if (context.selectedEntity.tags.length > 0) {
        parts.push(`Tags: ${context.selectedEntity.tags.join(', ')}`)
      }
      parts.push('')
    }

    // Scene context
    if (includeScene && this.engine) {
      parts.push('=== Scene ===')
      parts.push(`Name: ${context.scene.name}`)
      parts.push(`Entities: ${context.scene.totalEntities}`)
      parts.push(`Components: ${context.scene.stats.components}`)
      parts.push(`Systems: ${context.scene.stats.systems}`)

      if (context.scene.rootEntities.length > 0) {
        parts.push(`Root Entities:`)
        context.scene.rootEntities.forEach(e => {
          parts.push(`  - ${e.name} (${e.childCount} children)`)
        })
      }
      parts.push('')
    }

    // Errors and warnings
    if (includeErrors) {
      if (context.errors.length > 0) {
        parts.push('=== Recent Errors ===')
        context.errors.forEach(err => {
          parts.push(`[${err.timestamp.toLocaleTimeString()}] ${err.message}`)
        })
        parts.push('')
      }

      if (context.warnings.length > 0) {
        parts.push('=== Recent Warnings ===')
        context.warnings.forEach(warn => {
          parts.push(`[${warn.timestamp.toLocaleTimeString()}] ${warn.message}`)
        })
        parts.push('')
      }
    }

    return parts.join('\n')
  }

  getSummary(): string {
    const context = this.buildContext()
    const parts: string[] = []

    if (context.selectedEntity) {
      parts.push(`Selected: ${context.selectedEntity.name}`)
    }

    parts.push(`Scene: ${context.scene.totalEntities} entities`)

    if (context.errors.length > 0) {
      parts.push(`${context.errors.length} errors`)
    }

    if (context.warnings.length > 0) {
      parts.push(`${context.warnings.length} warnings`)
    }

    return parts.join(' | ')
  }

  hasRelevantContext(): boolean {
    return this.selectedEntity !== null ||
           this.errors.length > 0 ||
           this.warnings.length > 0
  }
}

// Global context builder instance
export const contextBuilder = new ContextBuilder()
