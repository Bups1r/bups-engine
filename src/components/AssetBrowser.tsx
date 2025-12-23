import { useRef, useState } from 'react'
import { useAssetStore, Asset, AssetType } from '../stores/assetStore'

const assetTypeIcons: Record<AssetType, string> = {
  texture: '🖼️',
  model: '🎮',
  audio: '🔊',
  script: '📜',
  scene: '🌍',
  material: '🎨',
  unknown: '📄'
}

const assetTypeColors: Record<AssetType, string> = {
  texture: '#22c55e',
  model: '#6366f1',
  audio: '#f59e0b',
  script: '#3b82f6',
  scene: '#8b5cf6',
  material: '#ec4899',
  unknown: '#6b7280'
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AssetCardProps {
  asset: Asset
  isSelected: boolean
  size: 'small' | 'medium' | 'large'
  onSelect: (id: string, multi: boolean) => void
  onDoubleClick: (asset: Asset) => void
}

function AssetCard({ asset, isSelected, size, onSelect, onDoubleClick }: AssetCardProps) {
  const sizeMap = { small: 80, medium: 100, large: 140 }
  const dimension = sizeMap[size]

  return (
    <div
      className={`asset-card ${isSelected ? 'selected' : ''}`}
      style={{ width: dimension }}
      onClick={(e) => onSelect(asset.id, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onDoubleClick(asset)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-bups-asset', JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div
        className="asset-thumbnail"
        style={{
          width: dimension,
          height: dimension,
          borderColor: isSelected ? assetTypeColors[asset.type] : 'transparent'
        }}
      >
        {asset.thumbnail ? (
          <img src={asset.thumbnail} alt={asset.name} />
        ) : (
          <div className="asset-icon">{assetTypeIcons[asset.type]}</div>
        )}
        <div
          className="asset-type-badge"
          style={{ background: assetTypeColors[asset.type] }}
        >
          {asset.type.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="asset-name" title={asset.name}>
        {asset.name}
      </div>
    </div>
  )
}

function AssetListItem({ asset, isSelected, onSelect, onDoubleClick }: Omit<AssetCardProps, 'size'>) {
  return (
    <div
      className={`asset-list-item ${isSelected ? 'selected' : ''}`}
      onClick={(e) => onSelect(asset.id, e.ctrlKey || e.metaKey)}
      onDoubleClick={() => onDoubleClick(asset)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-bups-asset', JSON.stringify(asset))
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <span className="asset-list-icon" style={{ color: assetTypeColors[asset.type] }}>
        {assetTypeIcons[asset.type]}
      </span>
      <span className="asset-list-name">{asset.name}</span>
      <span className="asset-list-type">{asset.type}</span>
      <span className="asset-list-size">{formatFileSize(asset.size)}</span>
    </div>
  )
}

export default function AssetBrowser() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null)

  const {
    selectedAssets,
    viewMode,
    thumbnailSize,
    searchQuery,
    filterType,
    selectAsset,
    clearSelection,
    setViewMode,
    setThumbnailSize,
    setSearchQuery,
    setFilterType,
    getFilteredAssets,
    importAssets,
    removeAsset
  } = useAssetStore()

  const assets = getFilteredAssets()

  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importAssets(e.target.files)
      e.target.value = ''
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length > 0) {
      await importAssets(e.dataTransfer.files)
    }
  }

  const handleDoubleClick = (asset: Asset) => {
    setPreviewAsset(asset)
  }

  const handleDelete = () => {
    selectedAssets.forEach(id => removeAsset(id))
  }

  const typeFilters: (AssetType | 'all')[] = ['all', 'texture', 'model', 'audio', 'script', 'scene', 'material']

  return (
    <div className="asset-browser">
      {/* Toolbar */}
      <div className="asset-toolbar">
        <button className="asset-btn" onClick={handleImport} title="Import Assets">
          + Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept="image/*,.glb,.gltf,.obj,.fbx,.mp3,.wav,.ogg,.ts,.js"
        />

        <div className="toolbar-separator" />

        <input
          type="text"
          className="asset-search"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="toolbar-separator" />

        <select
          className="asset-filter"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as AssetType | 'all')}
        >
          {typeFilters.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        <button
          className={`asset-btn icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode('grid')}
          title="Grid View"
        >
          ▦
        </button>
        <button
          className={`asset-btn icon-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          title="List View"
        >
          ☰
        </button>

        {viewMode === 'grid' && (
          <>
            <div className="toolbar-separator" />
            <select
              className="asset-filter"
              value={thumbnailSize}
              onChange={(e) => setThumbnailSize(e.target.value as 'small' | 'medium' | 'large')}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </>
        )}

        {selectedAssets.length > 0 && (
          <>
            <div className="toolbar-separator" />
            <button className="asset-btn delete-btn" onClick={handleDelete}>
              Delete ({selectedAssets.length})
            </button>
          </>
        )}
      </div>

      {/* Asset Grid/List */}
      <div
        className="asset-content"
        onClick={(e) => {
          if (e.target === e.currentTarget) clearSelection()
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {assets.length === 0 ? (
          <div className="asset-empty">
            <div className="empty-icon">📁</div>
            <div>No assets found</div>
            <div className="empty-hint">
              Drag and drop files here or click Import
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="asset-grid">
            {assets.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                isSelected={selectedAssets.includes(asset.id)}
                size={thumbnailSize}
                onSelect={selectAsset}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </div>
        ) : (
          <div className="asset-list">
            <div className="asset-list-header">
              <span className="asset-list-icon"></span>
              <span className="asset-list-name">Name</span>
              <span className="asset-list-type">Type</span>
              <span className="asset-list-size">Size</span>
            </div>
            {assets.map(asset => (
              <AssetListItem
                key={asset.id}
                asset={asset}
                isSelected={selectedAssets.includes(asset.id)}
                onSelect={selectAsset}
                onDoubleClick={handleDoubleClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <div className="asset-preview-modal" onClick={() => setPreviewAsset(null)}>
          <div className="asset-preview-content" onClick={(e) => e.stopPropagation()}>
            <div className="preview-header">
              <span>{previewAsset.name}</span>
              <button onClick={() => setPreviewAsset(null)}>×</button>
            </div>
            <div className="preview-body">
              {previewAsset.type === 'texture' && previewAsset.thumbnail && (
                <img src={previewAsset.thumbnail} alt={previewAsset.name} />
              )}
              {previewAsset.type !== 'texture' && (
                <div className="preview-icon">{assetTypeIcons[previewAsset.type]}</div>
              )}
            </div>
            <div className="preview-info">
              <div><strong>Type:</strong> {previewAsset.type}</div>
              <div><strong>Path:</strong> {previewAsset.path}</div>
              {previewAsset.size && <div><strong>Size:</strong> {formatFileSize(previewAsset.size)}</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .asset-browser {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .asset-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          flex-wrap: wrap;
        }

        .asset-btn {
          padding: 6px 12px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 12px;
        }

        .asset-btn:hover {
          background: var(--accent);
        }

        .asset-btn.icon-btn {
          padding: 6px 10px;
        }

        .asset-btn.active {
          background: var(--accent);
        }

        .asset-btn.delete-btn:hover {
          background: #dc2626;
          border-color: #dc2626;
        }

        .toolbar-separator {
          width: 1px;
          height: 20px;
          background: var(--border-color);
        }

        .asset-search {
          padding: 6px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 12px;
          width: 150px;
        }

        .asset-filter {
          padding: 6px 10px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 12px;
        }

        .asset-content {
          flex: 1;
          overflow: auto;
          padding: 12px;
        }

        .asset-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-secondary);
          gap: 8px;
        }

        .empty-icon {
          font-size: 48px;
          opacity: 0.5;
        }

        .empty-hint {
          font-size: 12px;
          opacity: 0.7;
        }

        .asset-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .asset-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .asset-card:hover {
          transform: translateY(-2px);
        }

        .asset-card.selected .asset-thumbnail {
          border-width: 2px;
        }

        .asset-thumbnail {
          position: relative;
          background: var(--bg-tertiary);
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .asset-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .asset-icon {
          font-size: 32px;
        }

        .asset-type-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          width: 18px;
          height: 18px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: bold;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .asset-name {
          margin-top: 6px;
          font-size: 11px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
          color: var(--text-primary);
        }

        .asset-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .asset-list-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: bold;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--border-color);
          text-transform: uppercase;
        }

        .asset-list-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
        }

        .asset-list-item:hover {
          background: var(--bg-tertiary);
        }

        .asset-list-item.selected {
          background: var(--accent);
          color: white;
        }

        .asset-list-icon {
          width: 24px;
          font-size: 14px;
        }

        .asset-list-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .asset-list-type {
          width: 80px;
          color: var(--text-secondary);
        }

        .asset-list-item.selected .asset-list-type {
          color: rgba(255, 255, 255, 0.7);
        }

        .asset-list-size {
          width: 80px;
          text-align: right;
          color: var(--text-secondary);
        }

        .asset-list-item.selected .asset-list-size {
          color: rgba(255, 255, 255, 0.7);
        }

        .asset-preview-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .asset-preview-content {
          background: var(--bg-primary);
          border-radius: 8px;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          font-weight: bold;
        }

        .preview-header button {
          background: none;
          border: none;
          color: var(--text-primary);
          font-size: 20px;
          cursor: pointer;
        }

        .preview-body {
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .preview-body img {
          max-width: 100%;
          max-height: 400px;
          border-radius: 4px;
        }

        .preview-icon {
          font-size: 80px;
        }

        .preview-info {
          padding: 16px;
          background: var(--bg-secondary);
          font-size: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `}</style>
    </div>
  )
}
