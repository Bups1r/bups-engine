import { Component, ComponentClass } from './Component'

let nextEntityId = 0

export class Entity {
  public readonly id: number
  public name: string
  public active: boolean = true
  public parent: Entity | null = null
  public children: Entity[] = []

  private components: Map<string, Component> = new Map()
  private tags: Set<string> = new Set()

  constructor(name: string = `Entity_${nextEntityId}`) {
    this.id = nextEntityId++
    this.name = name
  }

  addComponent<T extends Component>(ComponentType: ComponentClass<T>, ...args: unknown[]): T {
    const component = new ComponentType(this, ...args)
    const typeName = ComponentType.name

    if (this.components.has(typeName)) {
      console.warn(`Entity ${this.name} already has component ${typeName}`)
      return this.components.get(typeName) as T
    }

    this.components.set(typeName, component)
    component.onAttach()
    return component
  }

  getComponent<T extends Component>(ComponentType: ComponentClass<T>): T | undefined {
    return this.components.get(ComponentType.name) as T | undefined
  }

  hasComponent<T extends Component>(ComponentType: ComponentClass<T>): boolean {
    return this.components.has(ComponentType.name)
  }

  removeComponent<T extends Component>(ComponentType: ComponentClass<T>): boolean {
    const typeName = ComponentType.name
    const component = this.components.get(typeName)

    if (component) {
      component.onDetach()
      this.components.delete(typeName)
      return true
    }
    return false
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values())
  }

  addTag(tag: string): void {
    this.tags.add(tag)
  }

  removeTag(tag: string): void {
    this.tags.delete(tag)
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag)
  }

  getTags(): string[] {
    return Array.from(this.tags)
  }

  addChild(child: Entity): void {
    if (child.parent) {
      child.parent.removeChild(child)
    }
    child.parent = this
    this.children.push(child)
  }

  removeChild(child: Entity): void {
    const index = this.children.indexOf(child)
    if (index !== -1) {
      this.children.splice(index, 1)
      child.parent = null
    }
  }

  getRoot(): Entity {
    let current: Entity = this
    while (current.parent) {
      current = current.parent
    }
    return current
  }

  traverse(callback: (entity: Entity) => void): void {
    callback(this)
    for (const child of this.children) {
      child.traverse(callback)
    }
  }

  destroy(): void {
    // Destroy children first
    for (const child of [...this.children]) {
      child.destroy()
    }

    // Detach all components
    for (const component of this.components.values()) {
      component.onDetach()
    }
    this.components.clear()

    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this)
    }

    this.active = false
  }

  clone(deep: boolean = true): Entity {
    const clone = new Entity(`${this.name}_clone`)
    clone.active = this.active

    // Clone tags
    for (const tag of this.tags) {
      clone.addTag(tag)
    }

    // Clone components
    for (const component of this.components.values()) {
      const clonedComponent = component.clone(clone)
      clone.components.set(clonedComponent.constructor.name, clonedComponent)
    }

    // Clone children if deep
    if (deep) {
      for (const child of this.children) {
        const childClone = child.clone(true)
        clone.addChild(childClone)
      }
    }

    return clone
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      active: this.active,
      tags: Array.from(this.tags),
      components: Array.from(this.components.entries()).map(([name, comp]) => ({
        type: name,
        data: comp.serialize()
      })),
      children: this.children.map(child => child.toJSON())
    }
  }
}
