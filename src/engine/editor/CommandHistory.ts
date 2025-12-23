import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'
import { Engine } from '../Engine'
import * as THREE from 'three'

// Base command interface
export interface Command {
  readonly name: string
  execute(): void
  undo(): void
}

// Command history manager
export class CommandHistory {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private maxHistorySize: number = 100
  private listeners: Set<() => void> = new Set()

  execute(command: Command): void {
    command.execute()
    this.undoStack.push(command)
    this.redoStack = [] // Clear redo stack on new action

    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }

    this.notifyListeners()
  }

  // Add a command that was already executed (e.g., from gizmo transforms)
  push(command: Command): void {
    this.undoStack.push(command)
    this.redoStack = []

    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift()
    }

    this.notifyListeners()
  }

  undo(): Command | undefined {
    const command = this.undoStack.pop()
    if (command) {
      command.undo()
      this.redoStack.push(command)
      this.notifyListeners()
    }
    return command
  }

  redo(): Command | undefined {
    const command = this.redoStack.pop()
    if (command) {
      command.execute()
      this.undoStack.push(command)
      this.notifyListeners()
    }
    return command
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
    this.notifyListeners()
  }

  getUndoStack(): readonly Command[] {
    return this.undoStack
  }

  getRedoStack(): readonly Command[] {
    return this.redoStack
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener())
  }
}

// Transform change command
export class TransformCommand implements Command {
  readonly name: string
  private entity: Entity
  private oldPosition: THREE.Vector3
  private oldRotation: THREE.Euler
  private oldScale: THREE.Vector3
  private newPosition: THREE.Vector3
  private newRotation: THREE.Euler
  private newScale: THREE.Vector3

  constructor(
    entity: Entity,
    oldTransform: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 },
    newTransform: { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }
  ) {
    this.entity = entity
    this.name = `Transform ${entity.name}`
    this.oldPosition = oldTransform.position.clone()
    this.oldRotation = oldTransform.rotation.clone()
    this.oldScale = oldTransform.scale.clone()
    this.newPosition = newTransform.position.clone()
    this.newRotation = newTransform.rotation.clone()
    this.newScale = newTransform.scale.clone()
  }

  execute(): void {
    const transform = this.entity.getComponent(Transform)
    if (transform) {
      transform.position.copy(this.newPosition)
      transform.rotation.copy(this.newRotation)
      transform.scale.copy(this.newScale)
    }
  }

  undo(): void {
    const transform = this.entity.getComponent(Transform)
    if (transform) {
      transform.position.copy(this.oldPosition)
      transform.rotation.copy(this.oldRotation)
      transform.scale.copy(this.oldScale)
    }
  }
}

// Entity creation command
export class CreateEntityCommand implements Command {
  readonly name: string
  private engine: Engine
  private entity: Entity
  private parentId: number | null
  private wasCreated: boolean = false

  constructor(engine: Engine, entity: Entity, parent?: Entity) {
    this.engine = engine
    this.entity = entity
    this.parentId = parent?.id ?? null
    this.name = `Create ${entity.name}`
  }

  execute(): void {
    if (!this.wasCreated) {
      this.wasCreated = true
    } else {
      // Re-add entity on redo
      this.engine.world.addEntity(this.entity)
      if (this.parentId !== null) {
        const parent = this.engine.world.getEntity(this.parentId)
        if (parent) {
          parent.addChild(this.entity)
        }
      }
    }
  }

  undo(): void {
    this.engine.world.removeEntity(this.entity)
  }

  getEntity(): Entity {
    return this.entity
  }
}

// Entity deletion command
export class DeleteEntityCommand implements Command {
  readonly name: string
  private engine: Engine
  private entity: Entity
  private parentId: number | null

  constructor(engine: Engine, entity: Entity) {
    this.engine = engine
    this.entity = entity
    this.parentId = entity.parent?.id ?? null
    this.name = `Delete ${entity.name}`
  }

  execute(): void {
    this.engine.world.removeEntity(this.entity)
  }

  undo(): void {
    // Re-add entity
    this.engine.world.addEntity(this.entity)
    if (this.parentId !== null) {
      const parent = this.engine.world.getEntity(this.parentId)
      if (parent) {
        parent.addChild(this.entity)
      }
    }
  }
}

// Entity rename command
export class RenameEntityCommand implements Command {
  readonly name: string
  private entity: Entity
  private oldName: string
  private newName: string

  constructor(entity: Entity, newName: string) {
    this.entity = entity
    this.oldName = entity.name
    this.newName = newName
    this.name = `Rename to ${newName}`
  }

  execute(): void {
    this.entity.name = this.newName
  }

  undo(): void {
    this.entity.name = this.oldName
  }
}

// Property change command (generic)
export class PropertyChangeCommand<T> implements Command {
  readonly name: string
  private target: object
  private property: string
  private oldValue: T
  private newValue: T

  constructor(target: object, property: string, oldValue: T, newValue: T, description?: string) {
    this.target = target
    this.property = property
    this.oldValue = oldValue
    this.newValue = newValue
    this.name = description || `Change ${property}`
  }

  execute(): void {
    (this.target as Record<string, T>)[this.property] = this.newValue
  }

  undo(): void {
    (this.target as Record<string, T>)[this.property] = this.oldValue
  }
}

// Batch command for grouping multiple commands
export class BatchCommand implements Command {
  readonly name: string
  private commands: Command[]

  constructor(name: string, commands: Command[]) {
    this.name = name
    this.commands = commands
  }

  execute(): void {
    for (const command of this.commands) {
      command.execute()
    }
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo()
    }
  }
}

// Global command history instance
export const commandHistory = new CommandHistory()
