import { Entity } from './Entity'
import { Component, ComponentClass } from './Component'
import { World } from './World'

export abstract class System {
  public readonly world: World
  public enabled: boolean = true
  public priority: number = 0

  protected requiredComponents: ComponentClass[] = []

  constructor(world: World) {
    this.world = world
  }

  abstract update(deltaTime: number): void

  fixedUpdate(_fixedDeltaTime: number): void {}
  lateUpdate(_deltaTime: number): void {}

  onStart(): void {}
  onStop(): void {}

  protected getEntities(): Entity[] {
    if (this.requiredComponents.length === 0) {
      return this.world.getEntities()
    }
    return this.world.getEntitiesWithComponents(...this.requiredComponents)
  }

  protected getEntitiesWithTag(tag: string): Entity[] {
    return this.world.getEntitiesWithTag(tag)
  }
}

export class SystemManager {
  private systems: System[] = []
  private systemsByType: Map<string, System> = new Map()

  addSystem<T extends System>(system: T): T {
    const typeName = system.constructor.name

    if (this.systemsByType.has(typeName)) {
      console.warn(`System ${typeName} already exists`)
      return this.systemsByType.get(typeName) as T
    }

    this.systems.push(system)
    this.systemsByType.set(typeName, system)

    // Sort by priority
    this.systems.sort((a, b) => a.priority - b.priority)

    system.onStart()
    return system
  }

  removeSystem<T extends System>(SystemType: new (...args: unknown[]) => T): boolean {
    const typeName = SystemType.name
    const system = this.systemsByType.get(typeName)

    if (system) {
      system.onStop()
      this.systems = this.systems.filter(s => s !== system)
      this.systemsByType.delete(typeName)
      return true
    }
    return false
  }

  getSystem<T extends System>(SystemType: new (...args: unknown[]) => T): T | undefined {
    return this.systemsByType.get(SystemType.name) as T | undefined
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      if (system.enabled) {
        system.update(deltaTime)
      }
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    for (const system of this.systems) {
      if (system.enabled) {
        system.fixedUpdate(fixedDeltaTime)
      }
    }
  }

  lateUpdate(deltaTime: number): void {
    for (const system of this.systems) {
      if (system.enabled) {
        system.lateUpdate(deltaTime)
      }
    }
  }

  getSystems(): System[] {
    return [...this.systems]
  }
}
