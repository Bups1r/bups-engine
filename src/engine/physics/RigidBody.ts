import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'

export type RigidBodyType = 'dynamic' | 'static' | 'kinematic'
export type ColliderShape = 'box' | 'sphere' | 'capsule' | 'mesh'

export interface ColliderConfig {
  shape: ColliderShape
  size?: THREE.Vector3
  radius?: number
  height?: number
  isTrigger?: boolean
  offset?: THREE.Vector3
}

export class RigidBody extends Component {
  public bodyType: RigidBodyType = 'dynamic'
  public mass: number = 1
  public drag: number = 0
  public angularDrag: number = 0.05
  public useGravity: boolean = true
  public isKinematic: boolean = false
  public freezeRotation: boolean = false
  public freezePosition: boolean = false

  public colliders: ColliderConfig[] = []

  // Physics state
  private velocity: THREE.Vector3 = new THREE.Vector3()
  private angularVelocity: THREE.Vector3 = new THREE.Vector3()
  private forces: THREE.Vector3 = new THREE.Vector3()
  private torques: THREE.Vector3 = new THREE.Vector3()

  // Constraints
  public constraints = {
    freezePositionX: false,
    freezePositionY: false,
    freezePositionZ: false,
    freezeRotationX: false,
    freezeRotationY: false,
    freezeRotationZ: false
  }

  constructor(entity: Entity, type: RigidBodyType = 'dynamic') {
    super(entity)
    this.bodyType = type
    if (type === 'static') {
      this.mass = 0
      this.useGravity = false
    }
  }

  addCollider(config: ColliderConfig): this {
    this.colliders.push({
      isTrigger: false,
      offset: new THREE.Vector3(),
      ...config
    })
    return this
  }

  addBoxCollider(size: THREE.Vector3, offset?: THREE.Vector3, isTrigger = false): this {
    return this.addCollider({ shape: 'box', size, offset, isTrigger })
  }

  addSphereCollider(radius: number, offset?: THREE.Vector3, isTrigger = false): this {
    return this.addCollider({ shape: 'sphere', radius, offset, isTrigger })
  }

  addCapsuleCollider(radius: number, height: number, offset?: THREE.Vector3, isTrigger = false): this {
    return this.addCollider({ shape: 'capsule', radius, height, offset, isTrigger })
  }

  getVelocity(): THREE.Vector3 {
    return this.velocity.clone()
  }

  setVelocity(velocity: THREE.Vector3): void {
    this.velocity.copy(velocity)
  }

  getAngularVelocity(): THREE.Vector3 {
    return this.angularVelocity.clone()
  }

  setAngularVelocity(angularVelocity: THREE.Vector3): void {
    this.angularVelocity.copy(angularVelocity)
  }

  addForce(force: THREE.Vector3, mode: 'force' | 'impulse' | 'acceleration' = 'force'): void {
    if (this.bodyType === 'static') return

    switch (mode) {
      case 'force':
        this.forces.add(force)
        break
      case 'impulse':
        this.velocity.add(force.clone().divideScalar(this.mass))
        break
      case 'acceleration':
        this.forces.add(force.clone().multiplyScalar(this.mass))
        break
    }
  }

  addForceAtPosition(force: THREE.Vector3, position: THREE.Vector3, mode: 'force' | 'impulse' = 'force'): void {
    if (this.bodyType === 'static') return

    const transform = this.entity.getComponent(Transform)
    if (!transform) return

    // Apply linear force
    this.addForce(force, mode)

    // Calculate torque
    const relativePos = position.clone().sub(transform.position)
    const torque = new THREE.Vector3().crossVectors(relativePos, force)
    this.addTorque(torque, mode)
  }

  addTorque(torque: THREE.Vector3, mode: 'force' | 'impulse' = 'force'): void {
    if (this.bodyType === 'static' || this.freezeRotation) return

    switch (mode) {
      case 'force':
        this.torques.add(torque)
        break
      case 'impulse':
        this.angularVelocity.add(torque)
        break
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    if (this.bodyType === 'static' || !this.enabled) return

    const transform = this.entity.getComponent(Transform)
    if (!transform) return

    // Apply gravity
    if (this.useGravity) {
      this.forces.add(new THREE.Vector3(0, -9.81 * this.mass, 0))
    }

    // Calculate acceleration
    const acceleration = this.forces.clone().divideScalar(this.mass)

    // Update velocity
    this.velocity.add(acceleration.multiplyScalar(fixedDeltaTime))

    // Apply drag
    this.velocity.multiplyScalar(1 - this.drag * fixedDeltaTime)

    // Apply constraints
    if (this.constraints.freezePositionX) this.velocity.x = 0
    if (this.constraints.freezePositionY) this.velocity.y = 0
    if (this.constraints.freezePositionZ) this.velocity.z = 0

    // Update position
    if (!this.freezePosition) {
      transform.translate(
        this.velocity.x * fixedDeltaTime,
        this.velocity.y * fixedDeltaTime,
        this.velocity.z * fixedDeltaTime
      )
    }

    // Update angular velocity
    if (!this.freezeRotation) {
      this.angularVelocity.add(this.torques.clone().multiplyScalar(fixedDeltaTime))
      this.angularVelocity.multiplyScalar(1 - this.angularDrag * fixedDeltaTime)

      if (this.constraints.freezeRotationX) this.angularVelocity.x = 0
      if (this.constraints.freezeRotationY) this.angularVelocity.y = 0
      if (this.constraints.freezeRotationZ) this.angularVelocity.z = 0

      transform.rotate(
        this.angularVelocity.x * fixedDeltaTime,
        this.angularVelocity.y * fixedDeltaTime,
        this.angularVelocity.z * fixedDeltaTime
      )
    }

    // Clear forces
    this.forces.set(0, 0, 0)
    this.torques.set(0, 0, 0)
  }

  clone(newEntity: Entity): RigidBody {
    const clone = new RigidBody(newEntity, this.bodyType)
    clone.mass = this.mass
    clone.drag = this.drag
    clone.angularDrag = this.angularDrag
    clone.useGravity = this.useGravity
    clone.isKinematic = this.isKinematic
    clone.freezeRotation = this.freezeRotation
    clone.freezePosition = this.freezePosition
    clone.colliders = this.colliders.map(c => ({ ...c }))
    clone.constraints = { ...this.constraints }
    return clone
  }

  serialize(): object {
    return {
      bodyType: this.bodyType,
      mass: this.mass,
      drag: this.drag,
      angularDrag: this.angularDrag,
      useGravity: this.useGravity,
      isKinematic: this.isKinematic,
      freezeRotation: this.freezeRotation,
      freezePosition: this.freezePosition,
      colliders: this.colliders,
      constraints: this.constraints
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.bodyType) this.bodyType = data.bodyType as RigidBodyType
    if (data.mass !== undefined) this.mass = data.mass as number
    if (data.drag !== undefined) this.drag = data.drag as number
    if (data.angularDrag !== undefined) this.angularDrag = data.angularDrag as number
    if (data.useGravity !== undefined) this.useGravity = data.useGravity as boolean
    if (data.isKinematic !== undefined) this.isKinematic = data.isKinematic as boolean
    if (data.freezeRotation !== undefined) this.freezeRotation = data.freezeRotation as boolean
    if (data.freezePosition !== undefined) this.freezePosition = data.freezePosition as boolean
    if (data.colliders) this.colliders = data.colliders as ColliderConfig[]
    if (data.constraints) this.constraints = data.constraints as typeof this.constraints
  }
}
