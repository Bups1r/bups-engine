import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass'
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass'
import { System } from '../ecs/System'
import { World } from '../ecs/World'
import { Camera } from '../core/Camera'
import { MeshRenderer } from '../core/MeshRenderer'
import { Light } from '../core/Light'

export interface RenderSettings {
  antialias: boolean
  shadows: boolean
  shadowMapType: THREE.ShadowMapType
  toneMapping: THREE.ToneMapping
  toneMappingExposure: number
  outputColorSpace: THREE.ColorSpace
  pixelRatio: number
}

export interface PostProcessingSettings {
  enabled: boolean
  bloom: {
    enabled: boolean
    strength: number
    radius: number
    threshold: number
  }
  ssao: {
    enabled: boolean
    kernelRadius: number
    minDistance: number
    maxDistance: number
  }
}

export class RenderSystem extends System {
  public priority = 1000 // Render last

  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private composer: EffectComposer | null = null
  private renderPass: RenderPass | null = null
  private bloomPass: UnrealBloomPass | null = null
  private ssaoPass: SSAOPass | null = null

  private renderSettings: RenderSettings
  private postProcessingSettings: PostProcessingSettings

  private mainCamera: Camera | null = null
  private meshObjects: Map<number, THREE.Mesh> = new Map()
  private lightObjects: Map<number, THREE.Light> = new Map()

  constructor(world: World, canvas: HTMLCanvasElement, settings?: Partial<RenderSettings>) {
    super(world)

    this.renderSettings = {
      antialias: true,
      shadows: true,
      shadowMapType: THREE.PCFSoftShadowMap,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1,
      outputColorSpace: THREE.SRGBColorSpace,
      pixelRatio: window.devicePixelRatio,
      ...settings
    }

    this.postProcessingSettings = {
      enabled: false,
      bloom: { enabled: false, strength: 0.5, radius: 0.4, threshold: 0.8 },
      ssao: { enabled: false, kernelRadius: 8, minDistance: 0.005, maxDistance: 0.1 }
    }

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.renderSettings.antialias,
      powerPreference: 'high-performance'
    })

    this.applyRenderSettings()

    // Create scene
    this.scene = new THREE.Scene()
  }

  private applyRenderSettings(): void {
    this.renderer.shadowMap.enabled = this.renderSettings.shadows
    this.renderer.shadowMap.type = this.renderSettings.shadowMapType
    this.renderer.toneMapping = this.renderSettings.toneMapping
    this.renderer.toneMappingExposure = this.renderSettings.toneMappingExposure
    this.renderer.outputColorSpace = this.renderSettings.outputColorSpace
    this.renderer.setPixelRatio(this.renderSettings.pixelRatio)
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height)

    if (this.mainCamera) {
      this.mainCamera.setAspect(width, height)
    }

    if (this.composer) {
      this.composer.setSize(width, height)
    }

    if (this.ssaoPass) {
      this.ssaoPass.setSize(width, height)
    }
  }

  setupPostProcessing(camera: THREE.Camera): void {
    const size = this.renderer.getSize(new THREE.Vector2())

    this.composer = new EffectComposer(this.renderer)

    this.renderPass = new RenderPass(this.scene, camera)
    this.composer.addPass(this.renderPass)

    // SSAO
    this.ssaoPass = new SSAOPass(this.scene, camera, size.x, size.y)
    this.ssaoPass.kernelRadius = this.postProcessingSettings.ssao.kernelRadius
    this.ssaoPass.minDistance = this.postProcessingSettings.ssao.minDistance
    this.ssaoPass.maxDistance = this.postProcessingSettings.ssao.maxDistance
    this.ssaoPass.enabled = this.postProcessingSettings.ssao.enabled
    this.composer.addPass(this.ssaoPass)

    // Bloom
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      this.postProcessingSettings.bloom.strength,
      this.postProcessingSettings.bloom.radius,
      this.postProcessingSettings.bloom.threshold
    )
    this.bloomPass.enabled = this.postProcessingSettings.bloom.enabled
    this.composer.addPass(this.bloomPass)

    // Output
    const outputPass = new OutputPass()
    this.composer.addPass(outputPass)
  }

  setPostProcessing(settings: Partial<PostProcessingSettings>): void {
    this.postProcessingSettings = { ...this.postProcessingSettings, ...settings }

    if (this.bloomPass && settings.bloom) {
      this.bloomPass.enabled = settings.bloom.enabled ?? this.bloomPass.enabled
      this.bloomPass.strength = settings.bloom.strength ?? this.bloomPass.strength
      this.bloomPass.radius = settings.bloom.radius ?? this.bloomPass.radius
      this.bloomPass.threshold = settings.bloom.threshold ?? this.bloomPass.threshold
    }

    if (this.ssaoPass && settings.ssao) {
      this.ssaoPass.enabled = settings.ssao.enabled ?? this.ssaoPass.enabled
      this.ssaoPass.kernelRadius = settings.ssao.kernelRadius ?? this.ssaoPass.kernelRadius
      this.ssaoPass.minDistance = settings.ssao.minDistance ?? this.ssaoPass.minDistance
      this.ssaoPass.maxDistance = settings.ssao.maxDistance ?? this.ssaoPass.maxDistance
    }
  }

  update(_deltaTime: number): void {
    // Find main camera
    const cameras = this.world.getEntitiesWithComponents(Camera)
    for (const entity of cameras) {
      const camera = entity.getComponent(Camera)
      if (camera?.isMain) {
        this.mainCamera = camera
        break
      }
    }

    if (!this.mainCamera) return

    // Sync meshes
    const meshEntities = this.world.getEntitiesWithComponents(MeshRenderer)
    const currentMeshIds = new Set<number>()

    for (const entity of meshEntities) {
      const meshRenderer = entity.getComponent(MeshRenderer)
      if (!meshRenderer?.mesh) continue

      currentMeshIds.add(entity.id)
      meshRenderer.update(0)

      if (!this.meshObjects.has(entity.id)) {
        this.scene.add(meshRenderer.mesh)
        this.meshObjects.set(entity.id, meshRenderer.mesh)
      }
    }

    // Remove old meshes
    for (const [id, mesh] of this.meshObjects) {
      if (!currentMeshIds.has(id)) {
        this.scene.remove(mesh)
        this.meshObjects.delete(id)
      }
    }

    // Sync lights
    const lightEntities = this.world.getEntitiesWithComponents(Light)
    const currentLightIds = new Set<number>()

    for (const entity of lightEntities) {
      const light = entity.getComponent(Light)
      if (!light?.threeLight) continue

      currentLightIds.add(entity.id)
      light.update(0)

      if (!this.lightObjects.has(entity.id)) {
        this.scene.add(light.threeLight)
        this.lightObjects.set(entity.id, light.threeLight)
      }
    }

    // Remove old lights
    for (const [id, light] of this.lightObjects) {
      if (!currentLightIds.has(id)) {
        this.scene.remove(light)
        this.lightObjects.delete(id)
      }
    }

    // Update camera
    this.mainCamera.update(0)

    // Render
    if (this.postProcessingSettings.enabled && this.composer) {
      this.renderPass!.camera = this.mainCamera.threeCamera
      this.composer.render()
    } else {
      this.renderer.render(this.scene, this.mainCamera.threeCamera)
    }
  }

  getScene(): THREE.Scene {
    return this.scene
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  dispose(): void {
    this.renderer.dispose()
    this.composer?.dispose()

    for (const mesh of this.meshObjects.values()) {
      mesh.geometry?.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    }

    for (const light of this.lightObjects.values()) {
      light.dispose()
    }
  }
}
