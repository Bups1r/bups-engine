import * as THREE from 'three'
import { Entity } from '../ecs/Entity'
import { World } from '../ecs/World'
import { Transform } from '../core/Transform'
import { Camera } from '../core/Camera'
import { MeshRenderer } from '../core/MeshRenderer'
import { Light } from '../core/Light'
import { RigidBody } from '../physics/RigidBody'
import { ScriptComponent } from '../scripting/ScriptComponent'
import { AudioListener, AudioSource } from '../audio/AudioSystem'
import { Component, ComponentClass } from '../ecs/Component'

// Component type registry for deserialization
const componentRegistry: Record<string, ComponentClass> = {
  Transform,
  Camera,
  MeshRenderer,
  Light,
  RigidBody,
  ScriptComponent,
  AudioListener,
  AudioSource
}

// Register custom geometry types for serialization
type GeometryType = 'BoxGeometry' | 'SphereGeometry' | 'PlaneGeometry' | 'CylinderGeometry' | 'ConeGeometry' | 'TorusGeometry' | 'BufferGeometry'
type MaterialType = 'MeshStandardMaterial' | 'MeshBasicMaterial' | 'MeshPhongMaterial' | 'MeshLambertMaterial'

interface GeometryData {
  type: GeometryType
  parameters: Record<string, number>
}

interface MaterialData {
  type: MaterialType
  color: number
  properties: Record<string, unknown>
}

interface MeshRendererData {
  castShadow: boolean
  receiveShadow: boolean
  visible: boolean
  renderOrder: number
  geometry?: GeometryData
  material?: MaterialData
}

export interface SerializedComponent {
  type: string
  data: Record<string, unknown>
}

export interface SerializedEntity {
  id: number
  name: string
  active: boolean
  tags: string[]
  components: SerializedComponent[]
  children: SerializedEntity[]
}

export interface SerializedScene {
  version: string
  name: string
  createdAt: string
  modifiedAt: string
  entities: SerializedEntity[]
  metadata?: Record<string, unknown>
}

export interface SceneData {
  name: string
  entities: SerializedEntity[]
}

export class SceneSerializer {
  private static readonly VERSION = '1.0.0'

  /**
   * Serialize a World to a scene data object
   */
  static serializeWorld(world: World): SerializedScene {
    const now = new Date().toISOString()
    return {
      version: this.VERSION,
      name: world.name,
      createdAt: now,
      modifiedAt: now,
      entities: world.getRootEntities().map(entity => this.serializeEntity(entity))
    }
  }

  /**
   * Serialize a single entity and its children
   */
  static serializeEntity(entity: Entity): SerializedEntity {
    return {
      id: entity.id,
      name: entity.name,
      active: entity.active,
      tags: entity.getTags(),
      components: entity.getAllComponents().map(comp => this.serializeComponent(comp)),
      children: entity.children.map(child => this.serializeEntity(child))
    }
  }

  /**
   * Serialize a component with enhanced data for mesh renderers
   */
  static serializeComponent(component: Component): SerializedComponent {
    const type = component.constructor.name
    const baseData = component.serialize() as Record<string, unknown>

    // Enhanced serialization for MeshRenderer to include geometry and material details
    if (component instanceof MeshRenderer) {
      const meshData = baseData as unknown as MeshRendererData
      const geometry = component.geometry
      const material = component.material

      if (geometry) {
        meshData.geometry = this.serializeGeometry(geometry)
      }
      if (material) {
        meshData.material = this.serializeMaterial(material)
      }
    }

    return { type, data: baseData }
  }

  /**
   * Serialize a Three.js geometry
   */
  private static serializeGeometry(geometry: THREE.BufferGeometry): GeometryData {
    const type = geometry.type as GeometryType
    const parameters: Record<string, number> = {}

    // Extract parameters based on geometry type
    // @ts-expect-error - accessing internal parameters
    const params = geometry.parameters || {}

    switch (type) {
      case 'BoxGeometry':
        parameters.width = params.width ?? 1
        parameters.height = params.height ?? 1
        parameters.depth = params.depth ?? 1
        break
      case 'SphereGeometry':
        parameters.radius = params.radius ?? 0.5
        parameters.widthSegments = params.widthSegments ?? 32
        parameters.heightSegments = params.heightSegments ?? 32
        break
      case 'PlaneGeometry':
        parameters.width = params.width ?? 1
        parameters.height = params.height ?? 1
        break
      case 'CylinderGeometry':
        parameters.radiusTop = params.radiusTop ?? 0.5
        parameters.radiusBottom = params.radiusBottom ?? 0.5
        parameters.height = params.height ?? 1
        parameters.radialSegments = params.radialSegments ?? 32
        break
      case 'ConeGeometry':
        parameters.radius = params.radius ?? 0.5
        parameters.height = params.height ?? 1
        parameters.radialSegments = params.radialSegments ?? 32
        break
      case 'TorusGeometry':
        parameters.radius = params.radius ?? 1
        parameters.tube = params.tube ?? 0.4
        parameters.radialSegments = params.radialSegments ?? 16
        parameters.tubularSegments = params.tubularSegments ?? 100
        break
    }

    return { type, parameters }
  }

  /**
   * Serialize a Three.js material
   */
  private static serializeMaterial(material: THREE.Material): MaterialData {
    const type = material.type as MaterialType
    const properties: Record<string, unknown> = {}
    let color = 0x888888

    if (material instanceof THREE.MeshStandardMaterial) {
      color = material.color.getHex()
      properties.metalness = material.metalness
      properties.roughness = material.roughness
      properties.emissive = material.emissive.getHex()
      properties.emissiveIntensity = material.emissiveIntensity
    } else if (material instanceof THREE.MeshBasicMaterial) {
      color = material.color.getHex()
    } else if (material instanceof THREE.MeshPhongMaterial) {
      color = material.color.getHex()
      properties.shininess = material.shininess
      properties.specular = material.specular.getHex()
    } else if (material instanceof THREE.MeshLambertMaterial) {
      color = material.color.getHex()
      properties.emissive = material.emissive.getHex()
    }

    properties.transparent = material.transparent
    properties.opacity = material.opacity
    properties.side = material.side
    properties.wireframe = (material as THREE.MeshBasicMaterial).wireframe ?? false

    return { type, color, properties }
  }

  /**
   * Deserialize scene data into a World
   */
  static deserializeScene(world: World, sceneData: SerializedScene | SceneData): void {
    // Clear existing entities
    world.clear()

    // Update world name if available
    if ('name' in sceneData && sceneData.name) {
      world.name = sceneData.name
    }

    // Deserialize all root entities
    for (const entityData of sceneData.entities) {
      const entity = this.deserializeEntity(world, entityData, null)
      if (entity) {
        world.addEntity(entity)
      }
    }
  }

  /**
   * Deserialize a single entity and its children
   */
  static deserializeEntity(world: World, data: SerializedEntity, parent: Entity | null): Entity {
    const entity = new Entity(data.name)
    entity.active = data.active

    // Set parent relationship
    if (parent) {
      parent.addChild(entity)
    }

    // Add tags
    for (const tag of data.tags) {
      entity.addTag(tag)
    }

    // Deserialize components
    for (const compData of data.components) {
      this.deserializeComponent(entity, compData)
    }

    // Deserialize children recursively
    for (const childData of data.children) {
      this.deserializeEntity(world, childData, entity)
    }

    return entity
  }

  /**
   * Deserialize a component and attach it to an entity
   */
  static deserializeComponent(entity: Entity, data: SerializedComponent): Component | null {
    const ComponentClass = componentRegistry[data.type]
    if (!ComponentClass) {
      console.warn(`Unknown component type: ${data.type}`)
      return null
    }

    try {
      // Handle special cases for components that need constructor args
      let component: Component

      if (data.type === 'MeshRenderer') {
        const meshData = data.data as unknown as MeshRendererData
        const geometry = meshData.geometry ? this.deserializeGeometry(meshData.geometry) : undefined
        const material = meshData.material ? this.deserializeMaterial(meshData.material) : undefined
        component = entity.addComponent(MeshRenderer, geometry, material)
      } else if (data.type === 'Camera') {
        const cameraType = (data.data.cameraType as 'perspective' | 'orthographic') || 'perspective'
        component = entity.addComponent(Camera, cameraType)
      } else if (data.type === 'Light') {
        const lightType = (data.data.lightType as 'directional' | 'point' | 'spot' | 'ambient') || 'point'
        component = entity.addComponent(Light, lightType)
      } else if (data.type === 'RigidBody') {
        const bodyType = (data.data.bodyType as 'dynamic' | 'static' | 'kinematic') || 'dynamic'
        component = entity.addComponent(RigidBody, bodyType)
      } else if (data.type === 'ScriptComponent') {
        const scriptName = (data.data.scriptName as string) || 'NewScript'
        const sourceCode = (data.data.sourceCode as string) || ''
        component = entity.addComponent(ScriptComponent, scriptName, sourceCode)
      } else {
        component = entity.addComponent(ComponentClass)
      }

      // Deserialize component data
      component.deserialize(data.data)

      return component
    } catch (error) {
      console.error(`Failed to deserialize component ${data.type}:`, error)
      return null
    }
  }

  /**
   * Deserialize geometry data into a Three.js geometry
   */
  private static deserializeGeometry(data: GeometryData): THREE.BufferGeometry {
    const { type, parameters } = data

    switch (type) {
      case 'BoxGeometry':
        return new THREE.BoxGeometry(
          parameters.width ?? 1,
          parameters.height ?? 1,
          parameters.depth ?? 1
        )
      case 'SphereGeometry':
        return new THREE.SphereGeometry(
          parameters.radius ?? 0.5,
          parameters.widthSegments ?? 32,
          parameters.heightSegments ?? 32
        )
      case 'PlaneGeometry':
        return new THREE.PlaneGeometry(
          parameters.width ?? 1,
          parameters.height ?? 1
        )
      case 'CylinderGeometry':
        return new THREE.CylinderGeometry(
          parameters.radiusTop ?? 0.5,
          parameters.radiusBottom ?? 0.5,
          parameters.height ?? 1,
          parameters.radialSegments ?? 32
        )
      case 'ConeGeometry':
        return new THREE.ConeGeometry(
          parameters.radius ?? 0.5,
          parameters.height ?? 1,
          parameters.radialSegments ?? 32
        )
      case 'TorusGeometry':
        return new THREE.TorusGeometry(
          parameters.radius ?? 1,
          parameters.tube ?? 0.4,
          parameters.radialSegments ?? 16,
          parameters.tubularSegments ?? 100
        )
      default:
        // Default to a unit box for unknown geometry types
        return new THREE.BoxGeometry(1, 1, 1)
    }
  }

  /**
   * Deserialize material data into a Three.js material
   */
  private static deserializeMaterial(data: MaterialData): THREE.Material {
    const { type, color, properties } = data

    const commonOptions = {
      color: color ?? 0x888888,
      transparent: (properties.transparent as boolean) ?? false,
      opacity: (properties.opacity as number) ?? 1,
      side: (properties.side as THREE.Side) ?? THREE.FrontSide,
      wireframe: (properties.wireframe as boolean) ?? false
    }

    switch (type) {
      case 'MeshStandardMaterial':
        return new THREE.MeshStandardMaterial({
          ...commonOptions,
          metalness: (properties.metalness as number) ?? 0,
          roughness: (properties.roughness as number) ?? 1,
          emissive: (properties.emissive as number) ?? 0x000000,
          emissiveIntensity: (properties.emissiveIntensity as number) ?? 1
        })
      case 'MeshBasicMaterial':
        return new THREE.MeshBasicMaterial(commonOptions)
      case 'MeshPhongMaterial':
        return new THREE.MeshPhongMaterial({
          ...commonOptions,
          shininess: (properties.shininess as number) ?? 30,
          specular: (properties.specular as number) ?? 0x111111
        })
      case 'MeshLambertMaterial':
        return new THREE.MeshLambertMaterial({
          ...commonOptions,
          emissive: (properties.emissive as number) ?? 0x000000
        })
      default:
        return new THREE.MeshStandardMaterial(commonOptions)
    }
  }

  /**
   * Validate scene data structure
   */
  static validateSceneData(data: unknown): data is SerializedScene | SceneData {
    if (!data || typeof data !== 'object') {
      return false
    }

    const obj = data as Record<string, unknown>

    // Must have entities array
    if (!Array.isArray(obj.entities)) {
      return false
    }

    // Validate each entity
    for (const entity of obj.entities) {
      if (!this.validateEntityData(entity)) {
        return false
      }
    }

    return true
  }

  /**
   * Validate entity data structure
   */
  private static validateEntityData(data: unknown): data is SerializedEntity {
    if (!data || typeof data !== 'object') {
      return false
    }

    const obj = data as Record<string, unknown>

    // Required fields
    if (typeof obj.name !== 'string') return false
    if (!Array.isArray(obj.components)) return false
    if (!Array.isArray(obj.children)) return false

    // Validate components
    for (const comp of obj.components) {
      if (!this.validateComponentData(comp)) {
        return false
      }
    }

    // Validate children recursively
    for (const child of obj.children) {
      if (!this.validateEntityData(child)) {
        return false
      }
    }

    return true
  }

  /**
   * Validate component data structure
   */
  private static validateComponentData(data: unknown): data is SerializedComponent {
    if (!data || typeof data !== 'object') {
      return false
    }

    const obj = data as Record<string, unknown>

    return typeof obj.type === 'string' && typeof obj.data === 'object'
  }

  /**
   * Register a custom component type for serialization
   */
  static registerComponent(name: string, componentClass: ComponentClass): void {
    componentRegistry[name] = componentClass
  }

  /**
   * Get registered component names
   */
  static getRegisteredComponents(): string[] {
    return Object.keys(componentRegistry)
  }
}
