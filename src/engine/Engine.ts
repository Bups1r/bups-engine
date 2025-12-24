import * as THREE from 'three'
import { World } from './ecs/World'
import { Entity } from './ecs/Entity'
import { Transform } from './core/Transform'
import { Camera } from './core/Camera'
import { MeshRenderer } from './core/MeshRenderer'
import { Light } from './core/Light'
import { RenderSystem } from './rendering/RenderSystem'
import { PhysicsSystem } from './physics/PhysicsSystem'
import { AudioSystem } from './audio/AudioSystem'
import { InputManager } from './input/InputManager'
import { AssetManager } from './assets/AssetManager'
import { SceneSerializer, SerializedScene } from './serialization/SceneSerializer'

export interface EngineConfig {
  canvas: HTMLCanvasElement
  width?: number
  height?: number
  antialias?: boolean
  shadows?: boolean
  pixelRatio?: number
}

export class Engine {
  public readonly world: World
  public readonly renderSystem: RenderSystem
  public readonly physicsSystem: PhysicsSystem
  public readonly audioSystem: AudioSystem

  private canvas: HTMLCanvasElement
  private running: boolean = false
  private lastTime: number = 0
  private deltaTime: number = 0
  private frameId: number = 0

  private onUpdateCallbacks: ((dt: number) => void)[] = []
  private onFixedUpdateCallbacks: ((dt: number) => void)[] = []

  constructor(config: EngineConfig) {
    this.canvas = config.canvas
    this.world = new World('MainWorld')

    // Initialize input
    InputManager.initialize(this.canvas)

    // Create systems
    this.renderSystem = new RenderSystem(this.world, this.canvas, {
      antialias: config.antialias ?? true,
      shadows: config.shadows ?? true,
      pixelRatio: config.pixelRatio ?? window.devicePixelRatio
    })

    this.physicsSystem = new PhysicsSystem(this.world)
    this.audioSystem = new AudioSystem(this.world)

    // Add systems to world
    this.world.addSystem(this.physicsSystem)
    this.world.addSystem(this.audioSystem)
    this.world.addSystem(this.renderSystem)

    // Set initial size
    const width = config.width ?? this.canvas.clientWidth
    const height = config.height ?? this.canvas.clientHeight
    this.setSize(width, height)

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this))
  }

  setSize(width: number, height: number): void {
    this.renderSystem.setSize(width, height)
  }

  private onResize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    this.setSize(width, height)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.loop()
  }

  stop(): void {
    this.running = false
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
    }
  }

  private loop(): void {
    if (!this.running) return

    const currentTime = performance.now()
    this.deltaTime = (currentTime - this.lastTime) / 1000
    this.lastTime = currentTime

    // Cap delta time to prevent spiral of death
    if (this.deltaTime > 0.1) {
      this.deltaTime = 0.1
    }

    // Update input
    InputManager.update()

    // Call update callbacks
    for (const callback of this.onUpdateCallbacks) {
      callback(this.deltaTime)
    }

    // Update world (all systems)
    this.world.update(this.deltaTime)

    // Request next frame
    this.frameId = requestAnimationFrame(this.loop.bind(this))
  }

  onUpdate(callback: (dt: number) => void): void {
    this.onUpdateCallbacks.push(callback)
  }

  offUpdate(callback: (dt: number) => void): void {
    const index = this.onUpdateCallbacks.indexOf(callback)
    if (index !== -1) {
      this.onUpdateCallbacks.splice(index, 1)
    }
  }

  onFixedUpdate(callback: (dt: number) => void): void {
    this.onFixedUpdateCallbacks.push(callback)
  }

  // Entity creation helpers
  createEntity(name?: string): Entity {
    const entity = this.world.createEntity(name)
    entity.addComponent(Transform)
    return entity
  }

  createCamera(name: string = 'Camera', isMain: boolean = true): Entity {
    const entity = this.createEntity(name)
    const camera = entity.addComponent(Camera, 'perspective')
    camera.isMain = isMain
    return entity
  }

  createMesh(
    name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material
  ): Entity {
    const entity = this.createEntity(name)
    entity.addComponent(MeshRenderer, geometry, material)
    return entity
  }

  createBox(name: string = 'Box', size: THREE.Vector3 = new THREE.Vector3(1, 1, 1)): Entity {
    const entity = this.createEntity(name)
    const geometry = new THREE.BoxGeometry(size.x, size.y, size.z)
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 })
    entity.addComponent(MeshRenderer, geometry, material)
    return entity
  }

  createSphere(name: string = 'Sphere', radius: number = 0.5): Entity {
    const entity = this.createEntity(name)
    const geometry = new THREE.SphereGeometry(radius, 32, 32)
    const material = new THREE.MeshStandardMaterial({ color: 0x888888 })
    entity.addComponent(MeshRenderer, geometry, material)
    return entity
  }

  createPlane(name: string = 'Plane', width: number = 10, height: number = 10): Entity {
    const entity = this.createEntity(name)
    const geometry = new THREE.PlaneGeometry(width, height)
    const material = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide })
    entity.addComponent(MeshRenderer, geometry, material)
    const transform = entity.getComponent(Transform)
    transform?.setRotation(-Math.PI / 2, 0, 0)
    return entity
  }

  createLight(name: string = 'Light', type: 'directional' | 'point' | 'spot' | 'ambient' = 'point'): Entity {
    const entity = this.createEntity(name)
    entity.addComponent(Light, type)
    return entity
  }

  // Scene management
  loadScene(sceneData: SerializedScene | object): void {
    // Stop the engine while loading to prevent issues
    const wasRunning = this.running
    if (wasRunning) {
      this.stop()
    }

    // Validate and deserialize the scene data
    if (SceneSerializer.validateSceneData(sceneData)) {
      SceneSerializer.deserializeScene(this.world, sceneData)
      console.log('[Engine] Scene loaded successfully:', this.world.name)
    } else {
      console.error('[Engine] Invalid scene data format')
      throw new Error('Invalid scene data format')
    }

    // Restart if it was running
    if (wasRunning) {
      this.start()
    }
  }

  saveScene(): SerializedScene {
    return SceneSerializer.serializeWorld(this.world)
  }

  // Clear the current scene
  clearScene(): void {
    this.world.clear()
  }

  // Get serialized scene as JSON string
  exportSceneToJSON(): string {
    return JSON.stringify(this.saveScene(), null, 2)
  }

  // Import scene from JSON string
  importSceneFromJSON(jsonString: string): void {
    try {
      const sceneData = JSON.parse(jsonString)
      this.loadScene(sceneData)
    } catch (error) {
      console.error('[Engine] Failed to parse scene JSON:', error)
      throw new Error('Failed to parse scene JSON')
    }
  }

  // Asset management
  get assets(): typeof AssetManager {
    return AssetManager
  }

  // Input management
  get input(): typeof InputManager {
    return InputManager
  }

  // Stats
  getStats(): {
    fps: number
    entities: number
    components: number
    drawCalls: number
    triangles: number
  } {
    const worldStats = this.world.getStats()
    const renderer = this.renderSystem.getRenderer()
    const info = renderer.info

    return {
      fps: Math.round(1 / this.deltaTime),
      entities: worldStats.entities,
      components: worldStats.components,
      drawCalls: info.render.calls,
      triangles: info.render.triangles
    }
  }

  dispose(): void {
    this.stop()
    window.removeEventListener('resize', this.onResize.bind(this))
    InputManager.dispose()
    this.renderSystem.dispose()
    this.world.clear()
  }
}
