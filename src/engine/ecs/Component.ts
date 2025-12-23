import { Entity } from './Entity'

export interface ComponentClass<T extends Component = Component> {
  new (entity: Entity, ...args: any[]): T
  readonly name: string
}

export abstract class Component {
  public readonly entity: Entity
  public enabled: boolean = true

  constructor(entity: Entity) {
    this.entity = entity
  }

  onAttach(): void {}
  onDetach(): void {}
  onEnable(): void {}
  onDisable(): void {}

  update(_deltaTime: number): void {}
  fixedUpdate(_fixedDeltaTime: number): void {}
  lateUpdate(_deltaTime: number): void {}

  setEnabled(enabled: boolean): void {
    if (this.enabled !== enabled) {
      this.enabled = enabled
      if (enabled) {
        this.onEnable()
      } else {
        this.onDisable()
      }
    }
  }

  getComponent<T extends Component>(ComponentType: ComponentClass<T>): T | undefined {
    return this.entity.getComponent(ComponentType)
  }

  abstract clone(newEntity: Entity): Component
  abstract serialize(): object
  abstract deserialize(data: object): void
}
