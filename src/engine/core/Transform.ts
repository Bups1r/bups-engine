import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'

export class Transform extends Component {
  private _position: THREE.Vector3 = new THREE.Vector3()
  private _rotation: THREE.Euler = new THREE.Euler()
  private _quaternion: THREE.Quaternion = new THREE.Quaternion()
  private _scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1)

  private _localMatrix: THREE.Matrix4 = new THREE.Matrix4()
  private _worldMatrix: THREE.Matrix4 = new THREE.Matrix4()
  private _matrixNeedsUpdate: boolean = true

  constructor(entity: Entity) {
    super(entity)
    // @ts-ignore - Three.js internal API for listening to Euler changes
    this._rotation._onChange(() => {
      this._quaternion.setFromEuler(this._rotation)
      this._matrixNeedsUpdate = true
    })
  }

  get position(): THREE.Vector3 {
    return this._position
  }

  set position(value: THREE.Vector3) {
    this._position.copy(value)
    this._matrixNeedsUpdate = true
  }

  get rotation(): THREE.Euler {
    return this._rotation
  }

  set rotation(value: THREE.Euler) {
    this._rotation.copy(value)
    this._matrixNeedsUpdate = true
  }

  get quaternion(): THREE.Quaternion {
    return this._quaternion
  }

  set quaternion(value: THREE.Quaternion) {
    this._quaternion.copy(value)
    this._rotation.setFromQuaternion(value)
    this._matrixNeedsUpdate = true
  }

  get scale(): THREE.Vector3 {
    return this._scale
  }

  set scale(value: THREE.Vector3) {
    this._scale.copy(value)
    this._matrixNeedsUpdate = true
  }

  get localMatrix(): THREE.Matrix4 {
    if (this._matrixNeedsUpdate) {
      this.updateMatrix()
    }
    return this._localMatrix
  }

  get worldMatrix(): THREE.Matrix4 {
    this.updateWorldMatrix()
    return this._worldMatrix
  }

  setPosition(x: number, y: number, z: number): this {
    this._position.set(x, y, z)
    this._matrixNeedsUpdate = true
    return this
  }

  setRotation(x: number, y: number, z: number): this {
    this._rotation.set(x, y, z)
    this._matrixNeedsUpdate = true
    return this
  }

  setRotationFromQuaternion(q: THREE.Quaternion): this {
    this._quaternion.copy(q)
    this._rotation.setFromQuaternion(q)
    this._matrixNeedsUpdate = true
    return this
  }

  setScale(x: number, y: number, z: number): this {
    this._scale.set(x, y, z)
    this._matrixNeedsUpdate = true
    return this
  }

  translate(x: number, y: number, z: number): this {
    this._position.x += x
    this._position.y += y
    this._position.z += z
    this._matrixNeedsUpdate = true
    return this
  }

  translateLocal(x: number, y: number, z: number): this {
    const offset = new THREE.Vector3(x, y, z)
    offset.applyQuaternion(this._quaternion)
    this._position.add(offset)
    this._matrixNeedsUpdate = true
    return this
  }

  rotate(x: number, y: number, z: number): this {
    this._rotation.x += x
    this._rotation.y += y
    this._rotation.z += z
    this._matrixNeedsUpdate = true
    return this
  }

  rotateOnAxis(axis: THREE.Vector3, angle: number): this {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)
    this._quaternion.premultiply(q)
    this._rotation.setFromQuaternion(this._quaternion)
    this._matrixNeedsUpdate = true
    return this
  }

  lookAt(target: THREE.Vector3, up: THREE.Vector3 = new THREE.Vector3(0, 1, 0)): this {
    const matrix = new THREE.Matrix4()
    matrix.lookAt(this._position, target, up)
    this._quaternion.setFromRotationMatrix(matrix)
    this._rotation.setFromQuaternion(this._quaternion)
    this._matrixNeedsUpdate = true
    return this
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this._quaternion)
  }

  get right(): THREE.Vector3 {
    return new THREE.Vector3(1, 0, 0).applyQuaternion(this._quaternion)
  }

  get up(): THREE.Vector3 {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this._quaternion)
  }

  getWorldPosition(): THREE.Vector3 {
    const pos = new THREE.Vector3()
    this.updateWorldMatrix()
    pos.setFromMatrixPosition(this._worldMatrix)
    return pos
  }

  getWorldQuaternion(): THREE.Quaternion {
    const quat = new THREE.Quaternion()
    this.updateWorldMatrix()
    this._worldMatrix.decompose(new THREE.Vector3(), quat, new THREE.Vector3())
    return quat
  }

  getWorldScale(): THREE.Vector3 {
    const scale = new THREE.Vector3()
    this.updateWorldMatrix()
    this._worldMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale)
    return scale
  }

  private updateMatrix(): void {
    this._localMatrix.compose(this._position, this._quaternion, this._scale)
    this._matrixNeedsUpdate = false
  }

  private updateWorldMatrix(): void {
    if (this._matrixNeedsUpdate) {
      this.updateMatrix()
    }

    const parentTransform = this.entity.parent?.getComponent(Transform)
    if (parentTransform) {
      this._worldMatrix.multiplyMatrices(parentTransform.worldMatrix, this._localMatrix)
    } else {
      this._worldMatrix.copy(this._localMatrix)
    }
  }

  clone(newEntity: Entity): Transform {
    const clone = new Transform(newEntity)
    clone._position.copy(this._position)
    clone._rotation.copy(this._rotation)
    clone._quaternion.copy(this._quaternion)
    clone._scale.copy(this._scale)
    return clone
  }

  serialize(): object {
    return {
      position: { x: this._position.x, y: this._position.y, z: this._position.z },
      rotation: { x: this._rotation.x, y: this._rotation.y, z: this._rotation.z },
      scale: { x: this._scale.x, y: this._scale.y, z: this._scale.z }
    }
  }

  deserialize(data: { position?: {x: number, y: number, z: number}, rotation?: {x: number, y: number, z: number}, scale?: {x: number, y: number, z: number} }): void {
    if (data.position) {
      this._position.set(data.position.x, data.position.y, data.position.z)
    }
    if (data.rotation) {
      this._rotation.set(data.rotation.x, data.rotation.y, data.rotation.z)
    }
    if (data.scale) {
      this._scale.set(data.scale.x, data.scale.y, data.scale.z)
    }
    this._matrixNeedsUpdate = true
  }
}
