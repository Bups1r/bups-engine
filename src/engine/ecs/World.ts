import { Entity } from './Entity'
import { ComponentClass } from './Component'
import { System, SystemManager } from './System'

export class World {
  public name: string
  private entities: Map<number, Entity> = new Map()
  private entitiesByTag: Map<string, Set<Entity>> = new Map()
  private systemManager: SystemManager
  private rootEntities: Entity[] = []

  constructor(name: string = 'World') {
    this.name = name
    this.systemManager = new SystemManager()
  }

  createEntity(name?: string): Entity {
    const entity = new Entity(name)
    this.addEntity(entity)
    return entity
  }

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity)

    if (!entity.parent) {
      this.rootEntities.push(entity)
    }

    // Index by tags
    for (const tag of entity.getTags()) {
      this.indexEntityTag(entity, tag)
    }
  }

  removeEntity(entity: Entity): void {
    entity.destroy()
    this.entities.delete(entity.id)

    const rootIndex = this.rootEntities.indexOf(entity)
    if (rootIndex !== -1) {
      this.rootEntities.splice(rootIndex, 1)
    }

    // Remove from tag index
    for (const tag of entity.getTags()) {
      this.unindexEntityTag(entity, tag)
    }
  }

  getEntity(id: number): Entity | undefined {
    return this.entities.get(id)
  }

  getEntityByName(name: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.name === name) {
        return entity
      }
    }
    return undefined
  }

  getEntities(): Entity[] {
    return Array.from(this.entities.values()).filter(e => e.active)
  }

  getRootEntities(): Entity[] {
    return this.rootEntities.filter(e => e.active)
  }

  getEntitiesWithComponents(...componentTypes: ComponentClass[]): Entity[] {
    return this.getEntities().filter(entity =>
      componentTypes.every(type => entity.hasComponent(type))
    )
  }

  getEntitiesWithTag(tag: string): Entity[] {
    const tagged = this.entitiesByTag.get(tag)
    if (!tagged) return []
    return Array.from(tagged).filter(e => e.active)
  }

  indexEntityTag(entity: Entity, tag: string): void {
    if (!this.entitiesByTag.has(tag)) {
      this.entitiesByTag.set(tag, new Set())
    }
    this.entitiesByTag.get(tag)!.add(entity)
  }

  unindexEntityTag(entity: Entity, tag: string): void {
    const tagged = this.entitiesByTag.get(tag)
    if (tagged) {
      tagged.delete(entity)
    }
  }

  addSystem<T extends System>(system: T): T {
    return this.systemManager.addSystem(system)
  }

  removeSystem<T extends System>(SystemType: new (...args: unknown[]) => T): boolean {
    return this.systemManager.removeSystem(SystemType)
  }

  getSystem<T extends System>(SystemType: new (...args: unknown[]) => T): T | undefined {
    return this.systemManager.getSystem(SystemType)
  }

  update(deltaTime: number): void {
    this.systemManager.update(deltaTime)
  }

  fixedUpdate(fixedDeltaTime: number): void {
    this.systemManager.fixedUpdate(fixedDeltaTime)
  }

  lateUpdate(deltaTime: number): void {
    this.systemManager.lateUpdate(deltaTime)
  }

  clear(): void {
    for (const entity of [...this.entities.values()]) {
      entity.destroy()
    }
    this.entities.clear()
    this.rootEntities = []
    this.entitiesByTag.clear()
  }

  toJSON(): object {
    return {
      name: this.name,
      entities: this.rootEntities.map(entity => entity.toJSON())
    }
  }

  getStats(): { entities: number; components: number; systems: number } {
    let componentCount = 0
    for (const entity of this.entities.values()) {
      componentCount += entity.getAllComponents().length
    }

    return {
      entities: this.entities.size,
      components: componentCount,
      systems: this.systemManager.getSystems().length
    }
  }
}
