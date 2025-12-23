import * as THREE from 'three'
import { System } from '../ecs/System'
import { World } from '../ecs/World'
import { RigidBody } from './RigidBody'
import { Transform } from '../core/Transform'

export interface CollisionInfo {
  entityA: number
  entityB: number
  point: THREE.Vector3
  normal: THREE.Vector3
  depth: number
}

export interface RaycastHit {
  entity: number
  point: THREE.Vector3
  normal: THREE.Vector3
  distance: number
}

export class PhysicsSystem extends System {
  public priority = 100
  public gravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0)
  public fixedTimeStep: number = 1 / 60
  private accumulator: number = 0
  private collisionCallbacks: ((info: CollisionInfo) => void)[] = []

  constructor(world: World) {
    super(world)
  }

  update(deltaTime: number): void {
    this.accumulator += deltaTime

    while (this.accumulator >= this.fixedTimeStep) {
      this.fixedUpdate(this.fixedTimeStep)
      this.accumulator -= this.fixedTimeStep
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    const entities = this.world.getEntitiesWithComponents(RigidBody, Transform)

    // Update physics for each rigid body
    for (const entity of entities) {
      const rigidBody = entity.getComponent(RigidBody)
      if (rigidBody) {
        rigidBody.fixedUpdate(fixedDeltaTime)
      }
    }

    // Simple collision detection
    this.detectCollisions(entities)
  }

  private detectCollisions(entities: import('../ecs/Entity').Entity[]): void {
    // Simple AABB collision detection
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entityA = entities[i]
        const entityB = entities[j]

        const transformA = entityA.getComponent(Transform)
        const transformB = entityB.getComponent(Transform)
        const rigidBodyA = entityA.getComponent(RigidBody)
        const rigidBodyB = entityB.getComponent(RigidBody)

        if (!transformA || !transformB || !rigidBodyA || !rigidBodyB) continue
        if (rigidBodyA.colliders.length === 0 || rigidBodyB.colliders.length === 0) continue

        // Check collision between first colliders (simplified)
        const colliderA = rigidBodyA.colliders[0]
        const colliderB = rigidBodyB.colliders[0]

        const collision = this.checkCollision(
          transformA, colliderA,
          transformB, colliderB
        )

        if (collision) {
          this.resolveCollision(entityA, entityB, collision)

          // Notify listeners
          for (const callback of this.collisionCallbacks) {
            callback({
              entityA: entityA.id,
              entityB: entityB.id,
              point: collision.point,
              normal: collision.normal,
              depth: collision.depth
            })
          }
        }
      }
    }
  }

  private checkCollision(
    transformA: Transform,
    colliderA: import('./RigidBody').ColliderConfig,
    transformB: Transform,
    colliderB: import('./RigidBody').ColliderConfig
  ): { point: THREE.Vector3; normal: THREE.Vector3; depth: number } | null {
    const posA = transformA.position.clone().add(colliderA.offset || new THREE.Vector3())
    const posB = transformB.position.clone().add(colliderB.offset || new THREE.Vector3())

    // Sphere-Sphere collision
    if (colliderA.shape === 'sphere' && colliderB.shape === 'sphere') {
      const radiusA = colliderA.radius || 0.5
      const radiusB = colliderB.radius || 0.5
      const distance = posA.distanceTo(posB)
      const minDistance = radiusA + radiusB

      if (distance < minDistance) {
        const normal = posB.clone().sub(posA).normalize()
        const point = posA.clone().add(normal.clone().multiplyScalar(radiusA))
        return {
          point,
          normal,
          depth: minDistance - distance
        }
      }
    }

    // Box-Box AABB collision
    if (colliderA.shape === 'box' && colliderB.shape === 'box') {
      const sizeA = colliderA.size || new THREE.Vector3(1, 1, 1)
      const sizeB = colliderB.size || new THREE.Vector3(1, 1, 1)
      const halfA = sizeA.clone().multiplyScalar(0.5)
      const halfB = sizeB.clone().multiplyScalar(0.5)

      const minA = posA.clone().sub(halfA)
      const maxA = posA.clone().add(halfA)
      const minB = posB.clone().sub(halfB)
      const maxB = posB.clone().add(halfB)

      if (minA.x <= maxB.x && maxA.x >= minB.x &&
          minA.y <= maxB.y && maxA.y >= minB.y &&
          minA.z <= maxB.z && maxA.z >= minB.z) {
        // Calculate overlap
        const overlapX = Math.min(maxA.x - minB.x, maxB.x - minA.x)
        const overlapY = Math.min(maxA.y - minB.y, maxB.y - minA.y)
        const overlapZ = Math.min(maxA.z - minB.z, maxB.z - minA.z)

        let normal: THREE.Vector3
        let depth: number

        if (overlapX < overlapY && overlapX < overlapZ) {
          normal = new THREE.Vector3(posA.x < posB.x ? -1 : 1, 0, 0)
          depth = overlapX
        } else if (overlapY < overlapZ) {
          normal = new THREE.Vector3(0, posA.y < posB.y ? -1 : 1, 0)
          depth = overlapY
        } else {
          normal = new THREE.Vector3(0, 0, posA.z < posB.z ? -1 : 1)
          depth = overlapZ
        }

        const point = posA.clone().add(posB).multiplyScalar(0.5)
        return { point, normal, depth }
      }
    }

    // Sphere-Box collision
    if ((colliderA.shape === 'sphere' && colliderB.shape === 'box') ||
        (colliderA.shape === 'box' && colliderB.shape === 'sphere')) {
      const [spherePos, sphereCollider, boxPos, boxCollider] =
        colliderA.shape === 'sphere'
          ? [posA, colliderA, posB, colliderB]
          : [posB, colliderB, posA, colliderA]

      const radius = sphereCollider.radius || 0.5
      const size = boxCollider.size || new THREE.Vector3(1, 1, 1)
      const half = size.clone().multiplyScalar(0.5)

      // Find closest point on box to sphere
      const closest = new THREE.Vector3(
        Math.max(boxPos.x - half.x, Math.min(spherePos.x, boxPos.x + half.x)),
        Math.max(boxPos.y - half.y, Math.min(spherePos.y, boxPos.y + half.y)),
        Math.max(boxPos.z - half.z, Math.min(spherePos.z, boxPos.z + half.z))
      )

      const distance = spherePos.distanceTo(closest)
      if (distance < radius) {
        const normal = spherePos.clone().sub(closest).normalize()
        return {
          point: closest,
          normal,
          depth: radius - distance
        }
      }
    }

    return null
  }

  private resolveCollision(
    entityA: import('../ecs/Entity').Entity,
    entityB: import('../ecs/Entity').Entity,
    collision: { point: THREE.Vector3; normal: THREE.Vector3; depth: number }
  ): void {
    const transformA = entityA.getComponent(Transform)
    const transformB = entityB.getComponent(Transform)
    const rigidBodyA = entityA.getComponent(RigidBody)
    const rigidBodyB = entityB.getComponent(RigidBody)

    if (!transformA || !transformB || !rigidBodyA || !rigidBodyB) return

    // Check if either collider is a trigger
    const isATrigger = rigidBodyA.colliders.some(c => c.isTrigger)
    const isBTrigger = rigidBodyB.colliders.some(c => c.isTrigger)
    if (isATrigger || isBTrigger) return // Don't resolve trigger collisions

    const isAStatic = rigidBodyA.bodyType === 'static'
    const isBStatic = rigidBodyB.bodyType === 'static'

    if (isAStatic && isBStatic) return

    // Separate objects
    const totalMass = (isAStatic ? 0 : rigidBodyA.mass) + (isBStatic ? 0 : rigidBodyB.mass)
    const ratioA = isBStatic ? 1 : (isAStatic ? 0 : rigidBodyB.mass / totalMass)
    const ratioB = isAStatic ? 1 : (isBStatic ? 0 : rigidBodyA.mass / totalMass)

    const separation = collision.normal.clone().multiplyScalar(collision.depth)

    if (!isAStatic) {
      transformA.translate(
        -separation.x * ratioA,
        -separation.y * ratioA,
        -separation.z * ratioA
      )
    }

    if (!isBStatic) {
      transformB.translate(
        separation.x * ratioB,
        separation.y * ratioB,
        separation.z * ratioB
      )
    }

    // Apply impulse
    const restitution = 0.3
    const relativeVelocity = rigidBodyA.getVelocity().sub(rigidBodyB.getVelocity())
    const velocityAlongNormal = relativeVelocity.dot(collision.normal)

    if (velocityAlongNormal > 0) return // Objects moving apart

    const j = -(1 + restitution) * velocityAlongNormal / totalMass
    const impulse = collision.normal.clone().multiplyScalar(j)

    if (!isAStatic) {
      const velA = rigidBodyA.getVelocity()
      velA.add(impulse.clone().multiplyScalar(1 / rigidBodyA.mass))
      rigidBodyA.setVelocity(velA)
    }

    if (!isBStatic) {
      const velB = rigidBodyB.getVelocity()
      velB.sub(impulse.clone().multiplyScalar(1 / rigidBodyB.mass))
      rigidBodyB.setVelocity(velB)
    }
  }

  raycast(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number = Infinity): RaycastHit | null {
    const entities = this.world.getEntitiesWithComponents(RigidBody, Transform)
    let closestHit: RaycastHit | null = null

    for (const entity of entities) {
      const transform = entity.getComponent(Transform)
      const rigidBody = entity.getComponent(RigidBody)

      if (!transform || !rigidBody) continue

      for (const collider of rigidBody.colliders) {
        const hit = this.raycastCollider(origin, direction, transform, collider, maxDistance)
        if (hit && (!closestHit || hit.distance < closestHit.distance)) {
          closestHit = { ...hit, entity: entity.id }
        }
      }
    }

    return closestHit
  }

  private raycastCollider(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    transform: Transform,
    collider: import('./RigidBody').ColliderConfig,
    maxDistance: number
  ): Omit<RaycastHit, 'entity'> | null {
    const pos = transform.position.clone().add(collider.offset || new THREE.Vector3())

    if (collider.shape === 'sphere') {
      const radius = collider.radius || 0.5
      const oc = origin.clone().sub(pos)
      const a = direction.dot(direction)
      const b = 2 * oc.dot(direction)
      const c = oc.dot(oc) - radius * radius
      const discriminant = b * b - 4 * a * c

      if (discriminant >= 0) {
        const t = (-b - Math.sqrt(discriminant)) / (2 * a)
        if (t >= 0 && t <= maxDistance) {
          const point = origin.clone().add(direction.clone().multiplyScalar(t))
          const normal = point.clone().sub(pos).normalize()
          return { point, normal, distance: t }
        }
      }
    }

    // Add box raycast if needed
    return null
  }

  onCollision(callback: (info: CollisionInfo) => void): void {
    this.collisionCallbacks.push(callback)
  }

  offCollision(callback: (info: CollisionInfo) => void): void {
    const index = this.collisionCallbacks.indexOf(callback)
    if (index !== -1) {
      this.collisionCallbacks.splice(index, 1)
    }
  }
}
