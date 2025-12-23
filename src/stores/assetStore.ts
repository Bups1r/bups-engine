import { create } from 'zustand'

export type AssetType = 'texture' | 'model' | 'audio' | 'script' | 'scene' | 'material' | 'unknown'

export interface Asset {
  id: string
  name: string
  path: string
  type: AssetType
  thumbnail?: string  // Data URL for preview
  size?: number
  lastModified?: number
  metadata?: Record<string, unknown>
}

export interface AssetFolder {
  name: string
  path: string
  children: (Asset | AssetFolder)[]
}

interface AssetState {
  assets: Map<string, Asset>
  currentFolder: string
  selectedAssets: string[]
  viewMode: 'grid' | 'list'
  thumbnailSize: 'small' | 'medium' | 'large'
  searchQuery: string
  filterType: AssetType | 'all'

  // Actions
  addAsset: (asset: Asset) => void
  removeAsset: (id: string) => void
  updateAsset: (id: string, updates: Partial<Asset>) => void
  selectAsset: (id: string, multi?: boolean) => void
  clearSelection: () => void
  setCurrentFolder: (path: string) => void
  setViewMode: (mode: 'grid' | 'list') => void
  setThumbnailSize: (size: 'small' | 'medium' | 'large') => void
  setSearchQuery: (query: string) => void
  setFilterType: (type: AssetType | 'all') => void
  getFilteredAssets: () => Asset[]
  importAssets: (files: FileList) => Promise<void>
}

// Helper to determine asset type from file extension
function getAssetType(filename: string): AssetType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''

  const textureExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'hdr', 'exr']
  const modelExts = ['glb', 'gltf', 'obj', 'fbx', 'dae', 'stl', '3ds']
  const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
  const scriptExts = ['ts', 'js', 'tsx', 'jsx']
  const sceneExts = ['scene', 'json']
  const materialExts = ['mat', 'material']

  if (textureExts.includes(ext)) return 'texture'
  if (modelExts.includes(ext)) return 'model'
  if (audioExts.includes(ext)) return 'audio'
  if (scriptExts.includes(ext)) return 'script'
  if (sceneExts.includes(ext)) return 'scene'
  if (materialExts.includes(ext)) return 'material'

  return 'unknown'
}

// Generate a unique ID
function generateId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Create thumbnail for image files
async function createImageThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const size = 128
        canvas.width = size
        canvas.height = size

        const ctx = canvas.getContext('2d')!
        const scale = Math.max(size / img.width, size / img.height)
        const x = (size - img.width * scale) / 2
        const y = (size - img.height * scale) / 2

        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)

        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// Generate placeholder thumbnails for non-image assets
function getPlaceholderThumbnail(type: AssetType): string {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, 128, 128)

  // Icon based on type
  ctx.font = '48px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const icons: Record<AssetType, string> = {
    texture: '',
    model: '',
    audio: '',
    script: '',
    scene: '',
    material: '',
    unknown: ''
  }

  ctx.fillText(icons[type] || '', 64, 64)

  return canvas.toDataURL()
}

// Demo assets for testing
const demoAssets: Asset[] = [
  { id: 'demo_1', name: 'player_diffuse.png', path: '/assets/textures/player_diffuse.png', type: 'texture' },
  { id: 'demo_2', name: 'player_normal.png', path: '/assets/textures/player_normal.png', type: 'texture' },
  { id: 'demo_3', name: 'environment.hdr', path: '/assets/textures/environment.hdr', type: 'texture' },
  { id: 'demo_4', name: 'player.glb', path: '/assets/models/player.glb', type: 'model' },
  { id: 'demo_5', name: 'enemy.glb', path: '/assets/models/enemy.glb', type: 'model' },
  { id: 'demo_6', name: 'level.glb', path: '/assets/models/level.glb', type: 'model' },
  { id: 'demo_7', name: 'background.mp3', path: '/assets/audio/background.mp3', type: 'audio' },
  { id: 'demo_8', name: 'jump.wav', path: '/assets/audio/jump.wav', type: 'audio' },
  { id: 'demo_9', name: 'PlayerController.ts', path: '/assets/scripts/PlayerController.ts', type: 'script' },
  { id: 'demo_10', name: 'EnemyAI.ts', path: '/assets/scripts/EnemyAI.ts', type: 'script' },
]

export const useAssetStore = create<AssetState>((set, get) => ({
  assets: new Map(demoAssets.map(a => [a.id, { ...a, thumbnail: getPlaceholderThumbnail(a.type) }])),
  currentFolder: '/assets',
  selectedAssets: [],
  viewMode: 'grid',
  thumbnailSize: 'medium',
  searchQuery: '',
  filterType: 'all',

  addAsset: (asset) => set((state) => {
    const newAssets = new Map(state.assets)
    newAssets.set(asset.id, asset)
    return { assets: newAssets }
  }),

  removeAsset: (id) => set((state) => {
    const newAssets = new Map(state.assets)
    newAssets.delete(id)
    return {
      assets: newAssets,
      selectedAssets: state.selectedAssets.filter(a => a !== id)
    }
  }),

  updateAsset: (id, updates) => set((state) => {
    const asset = state.assets.get(id)
    if (!asset) return state

    const newAssets = new Map(state.assets)
    newAssets.set(id, { ...asset, ...updates })
    return { assets: newAssets }
  }),

  selectAsset: (id, multi = false) => set((state) => {
    if (multi) {
      const isSelected = state.selectedAssets.includes(id)
      return {
        selectedAssets: isSelected
          ? state.selectedAssets.filter(a => a !== id)
          : [...state.selectedAssets, id]
      }
    }
    return { selectedAssets: [id] }
  }),

  clearSelection: () => set({ selectedAssets: [] }),

  setCurrentFolder: (path) => set({ currentFolder: path }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setThumbnailSize: (size) => set({ thumbnailSize: size }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilterType: (type) => set({ filterType: type }),

  getFilteredAssets: () => {
    const state = get()
    let assets = Array.from(state.assets.values())

    // Filter by search query
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase()
      assets = assets.filter(a => a.name.toLowerCase().includes(query))
    }

    // Filter by type
    if (state.filterType !== 'all') {
      assets = assets.filter(a => a.type === state.filterType)
    }

    // Sort by name
    assets.sort((a, b) => a.name.localeCompare(b.name))

    return assets
  },

  importAssets: async (files: FileList) => {
    const state = get()

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const type = getAssetType(file.name)
      const id = generateId()

      let thumbnail: string

      if (type === 'texture' && file.type.startsWith('image/')) {
        thumbnail = await createImageThumbnail(file)
      } else {
        thumbnail = getPlaceholderThumbnail(type)
      }

      const asset: Asset = {
        id,
        name: file.name,
        path: `${state.currentFolder}/${file.name}`,
        type,
        thumbnail,
        size: file.size,
        lastModified: file.lastModified
      }

      state.addAsset(asset)
    }
  }
}))
