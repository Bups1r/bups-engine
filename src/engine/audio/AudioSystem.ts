import * as THREE from 'three'
import { Component } from '../ecs/Component'
import { Entity } from '../ecs/Entity'
import { Transform } from '../core/Transform'
import { System } from '../ecs/System'
import { World } from '../ecs/World'
import { Camera } from '../core/Camera'

export class AudioListener extends Component {
  private _listener: THREE.AudioListener

  constructor(entity: Entity) {
    super(entity)
    this._listener = new THREE.AudioListener()
  }

  get listener(): THREE.AudioListener {
    return this._listener
  }

  update(_deltaTime: number): void {
    const transform = this.entity.getComponent(Transform)
    if (transform) {
      this._listener.position.copy(transform.position)
      this._listener.quaternion.copy(transform.quaternion)
    }
  }

  clone(newEntity: Entity): AudioListener {
    return new AudioListener(newEntity)
  }

  serialize(): object {
    return {}
  }

  deserialize(_data: object): void {}
}

export class AudioSource extends Component {
  private _sound: THREE.PositionalAudio | THREE.Audio | null = null
  private _listener: THREE.AudioListener | null = null

  public volume: number = 1
  public pitch: number = 1
  public loop: boolean = false
  public playOnAwake: boolean = false
  public spatial: boolean = true
  public minDistance: number = 1
  public maxDistance: number = 100
  public rolloffFactor: number = 1

  private _audioBuffer: AudioBuffer | null = null
  private _isPlaying: boolean = false

  constructor(entity: Entity, listener?: THREE.AudioListener) {
    super(entity)
    if (listener) {
      this.setListener(listener)
    }
  }

  setListener(listener: THREE.AudioListener): void {
    this._listener = listener
    if (this.spatial) {
      this._sound = new THREE.PositionalAudio(listener)
      const positionalSound = this._sound as THREE.PositionalAudio
      positionalSound.setRefDistance(this.minDistance)
      positionalSound.setMaxDistance(this.maxDistance)
      positionalSound.setRolloffFactor(this.rolloffFactor)
    } else {
      this._sound = new THREE.Audio(listener)
    }
    this._sound.setVolume(this.volume)
    this._sound.setLoop(this.loop)
  }

  async loadAudio(url: string): Promise<void> {
    const loader = new THREE.AudioLoader()
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (buffer) => {
          this._audioBuffer = buffer
          if (this._sound) {
            this._sound.setBuffer(buffer)
            if (this.playOnAwake) {
              this.play()
            }
          }
          resolve()
        },
        undefined,
        reject
      )
    })
  }

  setBuffer(buffer: AudioBuffer): void {
    this._audioBuffer = buffer
    if (this._sound) {
      this._sound.setBuffer(buffer)
    }
  }

  play(delay: number = 0): void {
    if (!this._sound || !this._audioBuffer) return
    if (this._isPlaying) {
      this._sound.stop()
    }
    this._sound.play(delay)
    this._isPlaying = true
  }

  pause(): void {
    if (!this._sound || !this._isPlaying) return
    this._sound.pause()
    this._isPlaying = false
  }

  stop(): void {
    if (!this._sound || !this._isPlaying) return
    this._sound.stop()
    this._isPlaying = false
  }

  get isPlaying(): boolean {
    return this._isPlaying && (this._sound?.isPlaying ?? false)
  }

  setVolume(volume: number): void {
    this.volume = volume
    if (this._sound) {
      this._sound.setVolume(volume)
    }
  }

  setLoop(loop: boolean): void {
    this.loop = loop
    if (this._sound) {
      this._sound.setLoop(loop)
    }
  }

  update(_deltaTime: number): void {
    if (!this._sound || !this.spatial) return

    const transform = this.entity.getComponent(Transform)
    if (transform && this._sound instanceof THREE.PositionalAudio) {
      this._sound.position.copy(transform.position)
    }
  }

  clone(newEntity: Entity): AudioSource {
    const clone = new AudioSource(newEntity)
    clone.volume = this.volume
    clone.pitch = this.pitch
    clone.loop = this.loop
    clone.playOnAwake = this.playOnAwake
    clone.spatial = this.spatial
    clone.minDistance = this.minDistance
    clone.maxDistance = this.maxDistance
    clone.rolloffFactor = this.rolloffFactor
    if (this._listener) {
      clone.setListener(this._listener)
    }
    if (this._audioBuffer) {
      clone.setBuffer(this._audioBuffer)
    }
    return clone
  }

  serialize(): object {
    return {
      volume: this.volume,
      pitch: this.pitch,
      loop: this.loop,
      playOnAwake: this.playOnAwake,
      spatial: this.spatial,
      minDistance: this.minDistance,
      maxDistance: this.maxDistance,
      rolloffFactor: this.rolloffFactor
    }
  }

  deserialize(data: Record<string, unknown>): void {
    if (data.volume !== undefined) this.volume = data.volume as number
    if (data.pitch !== undefined) this.pitch = data.pitch as number
    if (data.loop !== undefined) this.loop = data.loop as boolean
    if (data.playOnAwake !== undefined) this.playOnAwake = data.playOnAwake as boolean
    if (data.spatial !== undefined) this.spatial = data.spatial as boolean
    if (data.minDistance !== undefined) this.minDistance = data.minDistance as number
    if (data.maxDistance !== undefined) this.maxDistance = data.maxDistance as number
    if (data.rolloffFactor !== undefined) this.rolloffFactor = data.rolloffFactor as number
  }

  onDetach(): void {
    this.stop()
    if (this._sound) {
      this._sound.disconnect()
    }
  }
}

export class AudioSystem extends System {
  public priority = 500
  private masterVolume: number = 1
  private listener: THREE.AudioListener | null = null
  private audioCache: Map<string, AudioBuffer> = new Map()

  constructor(world: World) {
    super(world)
  }

  initialize(): void {
    // Find or create audio listener
    const cameraEntities = this.world.getEntitiesWithComponents(Camera)
    for (const entity of cameraEntities) {
      const camera = entity.getComponent(Camera)
      if (camera?.isMain) {
        let audioListener = entity.getComponent(AudioListener)
        if (!audioListener) {
          audioListener = entity.addComponent(AudioListener)
        }
        this.listener = audioListener.listener

        // Attach to three.js camera
        camera.threeCamera.add(this.listener)
        break
      }
    }
  }

  getListener(): THREE.AudioListener | null {
    return this.listener
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume))
    if (this.listener) {
      this.listener.setMasterVolume(this.masterVolume)
    }
  }

  getMasterVolume(): number {
    return this.masterVolume
  }

  async loadAudio(url: string): Promise<AudioBuffer> {
    if (this.audioCache.has(url)) {
      return this.audioCache.get(url)!
    }

    const loader = new THREE.AudioLoader()
    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (buffer) => {
          this.audioCache.set(url, buffer)
          resolve(buffer)
        },
        undefined,
        reject
      )
    })
  }

  update(_deltaTime: number): void {
    // Update audio listener position
    const listenerEntities = this.world.getEntitiesWithComponents(AudioListener)
    for (const entity of listenerEntities) {
      const audioListener = entity.getComponent(AudioListener)
      if (audioListener) {
        audioListener.update(0)
      }
    }

    // Update audio sources
    const sourceEntities = this.world.getEntitiesWithComponents(AudioSource)
    for (const entity of sourceEntities) {
      const audioSource = entity.getComponent(AudioSource)
      if (audioSource) {
        audioSource.update(0)
      }
    }
  }

  dispose(): void {
    this.audioCache.clear()
  }
}
