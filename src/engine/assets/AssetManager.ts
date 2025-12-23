import * as THREE from 'three'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

export type AssetType = 'texture' | 'model' | 'audio' | 'json' | 'binary'

export interface Asset {
  id: string
  type: AssetType
  url: string
  data: unknown
  loaded: boolean
}

export interface LoadProgress {
  loaded: number
  total: number
  percentage: number
  currentAsset: string
}

class AssetManagerClass {
  private assets: Map<string, Asset> = new Map()
  private textureLoader: THREE.TextureLoader
  private gltfLoader: GLTFLoader
  private dracoLoader: DRACOLoader
  private audioLoader: THREE.AudioLoader
  private fileLoader: THREE.FileLoader

  private loadingQueue: string[] = []
  private isLoading: boolean = false
  private onProgressCallbacks: ((progress: LoadProgress) => void)[] = []

  constructor() {
    this.textureLoader = new THREE.TextureLoader()
    this.gltfLoader = new GLTFLoader()
    this.dracoLoader = new DRACOLoader()
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    this.gltfLoader.setDRACOLoader(this.dracoLoader)
    this.audioLoader = new THREE.AudioLoader()
    this.fileLoader = new THREE.FileLoader()
  }

  async loadTexture(id: string, url: string): Promise<THREE.Texture> {
    if (this.assets.has(id)) {
      return this.assets.get(id)!.data as THREE.Texture
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          this.assets.set(id, { id, type: 'texture', url, data: texture, loaded: true })
          resolve(texture)
        },
        undefined,
        reject
      )
    })
  }

  async loadModel(id: string, url: string): Promise<GLTF> {
    if (this.assets.has(id)) {
      return this.assets.get(id)!.data as GLTF
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.assets.set(id, { id, type: 'model', url, data: gltf, loaded: true })
          resolve(gltf)
        },
        undefined,
        reject
      )
    })
  }

  async loadAudio(id: string, url: string): Promise<AudioBuffer> {
    if (this.assets.has(id)) {
      return this.assets.get(id)!.data as AudioBuffer
    }

    return new Promise((resolve, reject) => {
      this.audioLoader.load(
        url,
        (buffer) => {
          this.assets.set(id, { id, type: 'audio', url, data: buffer, loaded: true })
          resolve(buffer)
        },
        undefined,
        reject
      )
    })
  }

  async loadJSON<T = unknown>(id: string, url: string): Promise<T> {
    if (this.assets.has(id)) {
      return this.assets.get(id)!.data as T
    }

    return new Promise((resolve, reject) => {
      this.fileLoader.setResponseType('json')
      this.fileLoader.load(
        url,
        (data) => {
          this.assets.set(id, { id, type: 'json', url, data, loaded: true })
          resolve(data as T)
        },
        undefined,
        reject
      )
    })
  }

  async loadBinary(id: string, url: string): Promise<ArrayBuffer> {
    if (this.assets.has(id)) {
      return this.assets.get(id)!.data as ArrayBuffer
    }

    return new Promise((resolve, reject) => {
      this.fileLoader.setResponseType('arraybuffer')
      this.fileLoader.load(
        url,
        (data) => {
          this.assets.set(id, { id, type: 'binary', url, data, loaded: true })
          resolve(data as ArrayBuffer)
        },
        undefined,
        reject
      )
    })
  }

  async loadMultiple(manifest: { id: string; type: AssetType; url: string }[]): Promise<void> {
    let loaded = 0
    const total = manifest.length

    for (const item of manifest) {
      this.notifyProgress({
        loaded,
        total,
        percentage: (loaded / total) * 100,
        currentAsset: item.id
      })

      try {
        switch (item.type) {
          case 'texture':
            await this.loadTexture(item.id, item.url)
            break
          case 'model':
            await this.loadModel(item.id, item.url)
            break
          case 'audio':
            await this.loadAudio(item.id, item.url)
            break
          case 'json':
            await this.loadJSON(item.id, item.url)
            break
          case 'binary':
            await this.loadBinary(item.id, item.url)
            break
        }
      } catch (error) {
        console.error(`Failed to load asset ${item.id}:`, error)
      }

      loaded++
    }

    this.notifyProgress({
      loaded: total,
      total,
      percentage: 100,
      currentAsset: ''
    })
  }

  get<T = unknown>(id: string): T | undefined {
    const asset = this.assets.get(id)
    return asset?.data as T | undefined
  }

  getTexture(id: string): THREE.Texture | undefined {
    return this.get<THREE.Texture>(id)
  }

  getModel(id: string): GLTF | undefined {
    return this.get<GLTF>(id)
  }

  getAudio(id: string): AudioBuffer | undefined {
    return this.get<AudioBuffer>(id)
  }

  has(id: string): boolean {
    return this.assets.has(id)
  }

  remove(id: string): boolean {
    const asset = this.assets.get(id)
    if (!asset) return false

    // Dispose resources
    if (asset.type === 'texture' && asset.data instanceof THREE.Texture) {
      asset.data.dispose()
    }

    return this.assets.delete(id)
  }

  clear(): void {
    for (const asset of this.assets.values()) {
      if (asset.type === 'texture' && asset.data instanceof THREE.Texture) {
        asset.data.dispose()
      }
    }
    this.assets.clear()
  }

  onProgress(callback: (progress: LoadProgress) => void): void {
    this.onProgressCallbacks.push(callback)
  }

  offProgress(callback: (progress: LoadProgress) => void): void {
    const index = this.onProgressCallbacks.indexOf(callback)
    if (index !== -1) {
      this.onProgressCallbacks.splice(index, 1)
    }
  }

  private notifyProgress(progress: LoadProgress): void {
    for (const callback of this.onProgressCallbacks) {
      callback(progress)
    }
  }

  getLoadedAssets(): Asset[] {
    return Array.from(this.assets.values())
  }

  getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.type === type)
  }
}

export const AssetManager = new AssetManagerClass()
