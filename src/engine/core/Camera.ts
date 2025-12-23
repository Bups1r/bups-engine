import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from './Transform'

export type CameraType = 'perspective' | 'orthographic'

export class Camera extends Component {
  public cameraType: CameraType = 'perspective'
  public fov: number = 75
  public near: number = 0.1
  public far: number = 1000
  public aspect: number = 16 / 9
  public orthoSize: number = 10

  public isMain: boolean = false
  public clearColor: THREE.Color = new THREE.Color(0x000000)
  public clearAlpha: number = 1
  public depth: number = 0

  private _threeCamera: THREE.Camera | null = null

  constructor(entity: Entity, type: CameraType = 'perspective') {
    super(entity)
    this.cameraType = type
    this.createThreeCamera()
  }

  private createThreeCamera(): void {
    if (this.cameraType === 'perspective') {
      this._threeCamera = new THREE.PerspectiveCamera(this.fov, this.aspect, this.near, this.far)
    } else {
      const halfSize = this.orthoSize / 2
      this._threeCamera = new THREE.OrthographicCamera(
        -halfSize * this.aspect,
        halfSize * this.aspect,
        halfSize,
        -halfSize,
        this.near,
        this.far
      )
    }
  }

  get threeCamera(): THREE.Camera {
    if (!this._threeCamera) {
      this.createThreeCamera()
    }
    return this._threeCamera!
  }

  updateProjectionMatrix(): void {
    if (this._threeCamera instanceof THREE.PerspectiveCamera) {
      this._threeCamera.fov = this.fov
      this._threeCamera.aspect = this.aspect
      this._threeCamera.near = this.near
      this._threeCamera.far = this.far
      this._threeCamera.updateProjectionMatrix()
    } else if (this._threeCamera instanceof THREE.OrthographicCamera) {
      const halfSize = this.orthoSize / 2
      this._threeCamera.left = -halfSize * this.aspect
      this._threeCamera.right = halfSize * this.aspect
      this._threeCamera.top = halfSize
      this._threeCamera.bottom = -halfSize
      this._threeCamera.near = this.near
      this._threeCamera.far = this.far
      this._threeCamera.updateProjectionMatrix()
    }
  }

  setAspect(width: number, height: number): void {
    this.aspect = width / height
    this.updateProjectionMatrix()
  }

  update(_deltaTime: number): void {
    const transform = this.entity.getComponent(Transform)
    if (transform && this._threeCamera) {
      this._threeCamera.position.copy(transform.position)
      this._threeCamera.quaternion.copy(transform.quaternion)
    }
  }

  worldToScreen(worldPos: THREE.Vector3, screenWidth: number, screenHeight: number): THREE.Vector2 {
    const pos = worldPos.clone()
    pos.project(this.threeCamera)

    return new THREE.Vector2(
      (pos.x + 1) / 2 * screenWidth,
      (-pos.y + 1) / 2 * screenHeight
    )
  }

  screenToWorld(screenPos: THREE.Vector2, screenWidth: number, screenHeight: number, depth: number = 0.5): THREE.Vector3 {
    const pos = new THREE.Vector3(
      (screenPos.x / screenWidth) * 2 - 1,
      -(screenPos.y / screenHeight) * 2 + 1,
      depth
    )
    pos.unproject(this.threeCamera)
    return pos
  }

  getViewMatrix(): THREE.Matrix4 {
    return this.threeCamera.matrixWorldInverse
  }

  getProjectionMatrix(): THREE.Matrix4 {
    if (this._threeCamera instanceof THREE.PerspectiveCamera ||
        this._threeCamera instanceof THREE.OrthographicCamera) {
      return this._threeCamera.projectionMatrix
    }
    return new THREE.Matrix4()
  }

  clone(newEntity: Entity): Camera {
    const clone = new Camera(newEntity, this.cameraType)
    clone.fov = this.fov
    clone.near = this.near
    clone.far = this.far
    clone.aspect = this.aspect
    clone.orthoSize = this.orthoSize
    clone.isMain = false // Cloned cameras shouldn't be main by default
    clone.clearColor.copy(this.clearColor)
    clone.clearAlpha = this.clearAlpha
    clone.depth = this.depth
    return clone
  }

  serialize(): object {
    return {
      cameraType: this.cameraType,
      fov: this.fov,
      near: this.near,
      far: this.far,
      aspect: this.aspect,
      orthoSize: this.orthoSize,
      isMain: this.isMain,
      clearColor: this.clearColor.getHex(),
      clearAlpha: this.clearAlpha,
      depth: this.depth
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.cameraType) this.cameraType = data.cameraType as CameraType
    if (data.fov !== undefined) this.fov = data.fov as number
    if (data.near !== undefined) this.near = data.near as number
    if (data.far !== undefined) this.far = data.far as number
    if (data.aspect !== undefined) this.aspect = data.aspect as number
    if (data.orthoSize !== undefined) this.orthoSize = data.orthoSize as number
    if (data.isMain !== undefined) this.isMain = data.isMain as boolean
    if (data.clearColor !== undefined) this.clearColor.setHex(data.clearColor as number)
    if (data.clearAlpha !== undefined) this.clearAlpha = data.clearAlpha as number
    if (data.depth !== undefined) this.depth = data.depth as number
    this.createThreeCamera()
    this.updateProjectionMatrix()
  }
}
