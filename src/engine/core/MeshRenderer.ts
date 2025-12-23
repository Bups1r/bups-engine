import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from './Transform'

export class MeshRenderer extends Component {
  private _mesh: THREE.Mesh | null = null
  private _geometry: THREE.BufferGeometry | null = null
  private _material: THREE.Material | null = null

  public castShadow: boolean = true
  public receiveShadow: boolean = true
  public visible: boolean = true
  public renderOrder: number = 0
  public layers: number = 0

  constructor(entity: Entity, geometry?: THREE.BufferGeometry, material?: THREE.Material) {
    super(entity)
    if (geometry) this._geometry = geometry
    if (material) this._material = material
    this.updateMesh()
  }

  get mesh(): THREE.Mesh | null {
    return this._mesh
  }

  get geometry(): THREE.BufferGeometry | null {
    return this._geometry
  }

  set geometry(value: THREE.BufferGeometry | null) {
    this._geometry = value
    this.updateMesh()
  }

  get material(): THREE.Material | null {
    return this._material
  }

  set material(value: THREE.Material | null) {
    this._material = value
    if (this._mesh) {
      this._mesh.material = value || new THREE.MeshBasicMaterial()
    }
  }

  setGeometry(geometry: THREE.BufferGeometry): this {
    this._geometry = geometry
    this.updateMesh()
    return this
  }

  setMaterial(material: THREE.Material): this {
    this._material = material
    if (this._mesh) {
      this._mesh.material = material
    }
    return this
  }

  private updateMesh(): void {
    if (this._geometry && this._material) {
      this._mesh = new THREE.Mesh(this._geometry, this._material)
      this._mesh.castShadow = this.castShadow
      this._mesh.receiveShadow = this.receiveShadow
      this._mesh.visible = this.visible
      this._mesh.renderOrder = this.renderOrder
    }
  }

  update(_deltaTime: number): void {
    if (!this._mesh) return

    const transform = this.entity.getComponent(Transform)
    if (transform) {
      this._mesh.position.copy(transform.position)
      this._mesh.quaternion.copy(transform.quaternion)
      this._mesh.scale.copy(transform.scale)
    }

    this._mesh.castShadow = this.castShadow
    this._mesh.receiveShadow = this.receiveShadow
    this._mesh.visible = this.visible && this.enabled && this.entity.active
    this._mesh.renderOrder = this.renderOrder
  }

  getBounds(): THREE.Box3 | null {
    if (!this._mesh) return null
    return new THREE.Box3().setFromObject(this._mesh)
  }

  // Helper methods for common geometries
  static createBox(entity: Entity, width = 1, height = 1, depth = 1, material?: THREE.Material): MeshRenderer {
    const geometry = new THREE.BoxGeometry(width, height, depth)
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x888888 })
    return new MeshRenderer(entity, geometry, mat)
  }

  static createSphere(entity: Entity, radius = 0.5, widthSegments = 32, heightSegments = 32, material?: THREE.Material): MeshRenderer {
    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x888888 })
    return new MeshRenderer(entity, geometry, mat)
  }

  static createPlane(entity: Entity, width = 1, height = 1, material?: THREE.Material): MeshRenderer {
    const geometry = new THREE.PlaneGeometry(width, height)
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide })
    return new MeshRenderer(entity, geometry, mat)
  }

  static createCylinder(entity: Entity, radiusTop = 0.5, radiusBottom = 0.5, height = 1, radialSegments = 32, material?: THREE.Material): MeshRenderer {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments)
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x888888 })
    return new MeshRenderer(entity, geometry, mat)
  }

  clone(newEntity: Entity): MeshRenderer {
    const clone = new MeshRenderer(newEntity)
    if (this._geometry) clone._geometry = this._geometry.clone()
    if (this._material) clone._material = this._material.clone()
    clone.castShadow = this.castShadow
    clone.receiveShadow = this.receiveShadow
    clone.visible = this.visible
    clone.renderOrder = this.renderOrder
    clone.updateMesh()
    return clone
  }

  serialize(): object {
    return {
      castShadow: this.castShadow,
      receiveShadow: this.receiveShadow,
      visible: this.visible,
      renderOrder: this.renderOrder,
      geometryType: this._geometry?.type || null,
      materialType: this._material?.type || null
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.castShadow !== undefined) this.castShadow = data.castShadow as boolean
    if (data.receiveShadow !== undefined) this.receiveShadow = data.receiveShadow as boolean
    if (data.visible !== undefined) this.visible = data.visible as boolean
    if (data.renderOrder !== undefined) this.renderOrder = data.renderOrder as number
  }

  onDetach(): void {
    if (this._geometry) {
      this._geometry.dispose()
    }
    if (this._material) {
      this._material.dispose()
    }
  }
}
