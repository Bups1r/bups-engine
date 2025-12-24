import * as THREE from 'three'
// @ts-ignore - Three.js examples have limited type support
import { TransformControls } from 'three/examples/jsm/controls/TransformControls'
import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'
import { MeshRenderer } from '../core/MeshRenderer'

export type GizmoMode = 'translate' | 'rotate' | 'scale'
export type GizmoSpace = 'world' | 'local'

export interface TransformGizmoEvents {
  onTransformStart?: (entity: Entity) => void
  onTransformChange?: (entity: Entity) => void
  onTransformEnd?: (entity: Entity) => void
}

export class TransformGizmo {
  private controls: TransformControls
  private domElement: HTMLElement
  private scene: THREE.Scene

  private currentEntity: Entity | null = null
  private currentObject: THREE.Object3D | null = null
  private events: TransformGizmoEvents = {}

  private _mode: GizmoMode = 'translate'
  private _space: GizmoSpace = 'world'
  private _enabled: boolean = true
  private _size: number = 1

  constructor(
    camera: THREE.Camera,
    domElement: HTMLElement,
    scene: THREE.Scene
  ) {
    this.domElement = domElement
    this.scene = scene

    // Create TransformControls
    this.controls = new TransformControls(camera, domElement)
    this.controls.setMode('translate')
    this.controls.setSpace('world')

    // Add to scene (TransformControls itself is the gizmo in modern Three.js)
    this.scene.add(this.controls)

    // Set up event listeners
    this.controls.addEventListener('dragging-changed', (event: { value: boolean }) => {
      // Disable orbit controls while dragging
      const customEvent = new CustomEvent('gizmo-dragging', {
        detail: { dragging: event.value }
      })
      this.domElement.dispatchEvent(customEvent)
    })

    this.controls.addEventListener('mouseDown', () => {
      if (this.currentEntity && this.events.onTransformStart) {
        this.events.onTransformStart(this.currentEntity)
      }
    })

    this.controls.addEventListener('change', () => {
      if (this.currentEntity && this.currentObject) {
        // Sync Three.js object transform back to entity Transform component
        const transform = this.currentEntity.getComponent(Transform)
        if (transform) {
          transform.position.copy(this.currentObject.position)
          transform.rotation.copy(this.currentObject.rotation)
          transform.scale.copy(this.currentObject.scale)
        }

        if (this.events.onTransformChange) {
          this.events.onTransformChange(this.currentEntity)
        }
      }
    })

    this.controls.addEventListener('mouseUp', () => {
      if (this.currentEntity && this.events.onTransformEnd) {
        this.events.onTransformEnd(this.currentEntity)
      }
    })
  }

  attach(entity: Entity | null): void {
    if (!entity) {
      this.detach()
      return
    }

    this.currentEntity = entity

    // Get the mesh from the entity
    const meshRenderer = entity.getComponent(MeshRenderer)
    const transform = entity.getComponent(Transform)

    if (meshRenderer?.mesh) {
      this.currentObject = meshRenderer.mesh
      this.controls.attach(this.currentObject)
    } else if (transform) {
      // Create a helper object for entities without mesh (like cameras, lights)
      const helper = new THREE.Object3D()
      helper.position.copy(transform.position)
      helper.rotation.copy(transform.rotation)
      helper.scale.copy(transform.scale)
      this.scene.add(helper)
      this.currentObject = helper
      this.controls.attach(helper)
    }
  }

  detach(): void {
    this.controls.detach()

    // Clean up helper object if it was created
    if (this.currentObject && !this.currentEntity?.getComponent(MeshRenderer)) {
      this.scene.remove(this.currentObject)
    }

    this.currentEntity = null
    this.currentObject = null
  }

  get mode(): GizmoMode {
    return this._mode
  }

  set mode(value: GizmoMode) {
    this._mode = value
    this.controls.setMode(value)
  }

  get space(): GizmoSpace {
    return this._space
  }

  set space(value: GizmoSpace) {
    this._space = value
    this.controls.setSpace(value)
  }

  get enabled(): boolean {
    return this._enabled
  }

  set enabled(value: boolean) {
    this._enabled = value
    this.controls.enabled = value
    this.controls.visible = value
  }

  get size(): number {
    return this._size
  }

  set size(value: number) {
    this._size = value
    this.controls.setSize(value)
  }

  setEvents(events: TransformGizmoEvents): void {
    this.events = events
  }

  updateCamera(camera: THREE.Camera): void {
    this.controls.camera = camera
  }

  get isDragging(): boolean {
    return this.controls.dragging
  }

  dispose(): void {
    // Fire a final event to ensure orbit controls are re-enabled
    const customEvent = new CustomEvent('gizmo-dragging', {
      detail: { dragging: false }
    })
    this.domElement.dispatchEvent(customEvent)

    this.detach()
    this.scene.remove(this.controls)
    this.controls.dispose()
  }
}
