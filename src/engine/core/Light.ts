import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from './Transform'

export type LightType = 'directional' | 'point' | 'spot' | 'ambient'

export class Light extends Component {
  public lightType: LightType = 'point'
  public color: THREE.Color = new THREE.Color(0xffffff)
  public intensity: number = 1
  public castShadow: boolean = true

  // Point/Spot light properties
  public distance: number = 0
  public decay: number = 2

  // Spot light properties
  public angle: number = Math.PI / 4
  public penumbra: number = 0.1

  // Shadow properties
  public shadowMapSize: number = 1024
  public shadowBias: number = -0.0001
  public shadowNear: number = 0.1
  public shadowFar: number = 500

  private _threeLight: THREE.Light | null = null

  constructor(entity: Entity, type: LightType = 'point') {
    super(entity)
    this.lightType = type
    this.createThreeLight()
  }

  private createThreeLight(): void {
    switch (this.lightType) {
      case 'directional':
        this._threeLight = new THREE.DirectionalLight(this.color, this.intensity)
        break
      case 'point':
        this._threeLight = new THREE.PointLight(this.color, this.intensity, this.distance, this.decay)
        break
      case 'spot':
        this._threeLight = new THREE.SpotLight(this.color, this.intensity, this.distance, this.angle, this.penumbra, this.decay)
        break
      case 'ambient':
        this._threeLight = new THREE.AmbientLight(this.color, this.intensity)
        break
    }

    this.updateShadowSettings()
  }

  get threeLight(): THREE.Light | null {
    return this._threeLight
  }

  updateShadowSettings(): void {
    if (!this._threeLight) return

    if (this._threeLight instanceof THREE.DirectionalLight ||
        this._threeLight instanceof THREE.SpotLight ||
        this._threeLight instanceof THREE.PointLight) {
      this._threeLight.castShadow = this.castShadow

      if (this._threeLight.shadow) {
        this._threeLight.shadow.mapSize.width = this.shadowMapSize
        this._threeLight.shadow.mapSize.height = this.shadowMapSize
        this._threeLight.shadow.bias = this.shadowBias

        if (this._threeLight.shadow.camera) {
          this._threeLight.shadow.camera.near = this.shadowNear
          this._threeLight.shadow.camera.far = this.shadowFar
        }
      }
    }
  }

  updateLightProperties(): void {
    if (!this._threeLight) return

    this._threeLight.color.copy(this.color)
    this._threeLight.intensity = this.intensity

    if (this._threeLight instanceof THREE.PointLight) {
      this._threeLight.distance = this.distance
      this._threeLight.decay = this.decay
    }

    if (this._threeLight instanceof THREE.SpotLight) {
      this._threeLight.distance = this.distance
      this._threeLight.decay = this.decay
      this._threeLight.angle = this.angle
      this._threeLight.penumbra = this.penumbra
    }
  }

  update(_deltaTime: number): void {
    if (!this._threeLight) return

    const transform = this.entity.getComponent(Transform)
    if (transform) {
      this._threeLight.position.copy(transform.position)

      if (this._threeLight instanceof THREE.DirectionalLight ||
          this._threeLight instanceof THREE.SpotLight) {
        // For directional/spot lights, set target based on forward direction
        const target = transform.position.clone().add(transform.forward)
        if (this._threeLight.target) {
          this._threeLight.target.position.copy(target)
        }
      }
    }
  }

  clone(newEntity: Entity): Light {
    const clone = new Light(newEntity, this.lightType)
    clone.color.copy(this.color)
    clone.intensity = this.intensity
    clone.castShadow = this.castShadow
    clone.distance = this.distance
    clone.decay = this.decay
    clone.angle = this.angle
    clone.penumbra = this.penumbra
    clone.shadowMapSize = this.shadowMapSize
    clone.shadowBias = this.shadowBias
    clone.shadowNear = this.shadowNear
    clone.shadowFar = this.shadowFar
    clone.updateLightProperties()
    clone.updateShadowSettings()
    return clone
  }

  serialize(): object {
    return {
      lightType: this.lightType,
      color: this.color.getHex(),
      intensity: this.intensity,
      castShadow: this.castShadow,
      distance: this.distance,
      decay: this.decay,
      angle: this.angle,
      penumbra: this.penumbra,
      shadowMapSize: this.shadowMapSize,
      shadowBias: this.shadowBias,
      shadowNear: this.shadowNear,
      shadowFar: this.shadowFar
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.lightType) this.lightType = data.lightType as LightType
    if (data.color !== undefined) this.color.setHex(data.color as number)
    if (data.intensity !== undefined) this.intensity = data.intensity as number
    if (data.castShadow !== undefined) this.castShadow = data.castShadow as boolean
    if (data.distance !== undefined) this.distance = data.distance as number
    if (data.decay !== undefined) this.decay = data.decay as number
    if (data.angle !== undefined) this.angle = data.angle as number
    if (data.penumbra !== undefined) this.penumbra = data.penumbra as number
    if (data.shadowMapSize !== undefined) this.shadowMapSize = data.shadowMapSize as number
    if (data.shadowBias !== undefined) this.shadowBias = data.shadowBias as number
    if (data.shadowNear !== undefined) this.shadowNear = data.shadowNear as number
    if (data.shadowFar !== undefined) this.shadowFar = data.shadowFar as number

    this.createThreeLight()
  }

  onDetach(): void {
    if (this._threeLight) {
      this._threeLight.dispose()
    }
  }
}
