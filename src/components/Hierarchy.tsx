import { useState, useEffect, useCallback, memo } from 'react'
import { useEngineStore } from '../stores/engineStore'
import { Entity } from '../engine/ecs/Entity'
import { commandHistory, CreateEntityCommand, DeleteEntityCommand } from '../engine/editor'

interface HierarchyItemProps {
  entity: Entity
  depth: number
  selectedEntityId: number | null
  onSelect: (entity: Entity) => void
}

const HierarchyItem = memo(function HierarchyItem({ entity, depth, selectedEntityId, onSelect }: HierarchyItemProps) {
  const [expanded, setExpanded] = useState(true)
  const isSelected = selectedEntityId === entity.id
  const hasChildren = entity.children.length > 0

  const handleToggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => !prev)
  }, [])

  const handleSelect = useCallback(() => {
    onSelect(entity)
  }, [entity, onSelect])

  return (
    <>
      <div
        className={`hierarchy-item ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <span
            className="expand-icon"
            onClick={handleToggleExpand}
          >
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="expand-icon" />}
        <span className="entity-icon">
          {entity.hasTag('camera') ? '📷' : entity.hasTag('light') ? '💡' : '🎮'}
        </span>
        <span className="entity-name">{entity.name}</span>
      </div>
      {expanded && entity.children.map((child) => (
        <HierarchyItem
          key={child.id}
          entity={child}
          depth={depth + 1}
          selectedEntityId={selectedEntityId}
          onSelect={onSelect}
        />
      ))}
    </>
  )
})

export default function Hierarchy() {
  const { engine, selectedEntity, selectEntity } = useEngineStore()
  const [entities, setEntities] = useState<Entity[]>([])
  const [, forceUpdate] = useState(0)

  // Stable callback for selecting entities
  const handleSelectEntity = useCallback((entity: Entity) => {
    selectEntity(entity)
  }, [selectEntity])

  useEffect(() => {
    if (!engine) return

    const updateEntities = () => {
      setEntities(engine.world.getRootEntities())
    }

    // Initial load
    updateEntities()

    // Subscribe to world changes via custom event
    const handleWorldChange = () => {
      updateEntities()
      forceUpdate(n => n + 1)
    }

    // Listen for entity changes
    window.addEventListener('engine:world-changed', handleWorldChange)

    // Fallback: poll less frequently (2 seconds instead of 500ms)
    // This catches any changes not emitted as events
    const interval = setInterval(updateEntities, 2000)

    return () => {
      window.removeEventListener('engine:world-changed', handleWorldChange)
      clearInterval(interval)
    }
  }, [engine])

  const handleAddEntity = (type: string) => {
    if (!engine) return

    let entity: Entity | null = null

    switch (type) {
      case 'empty':
        entity = engine.createEntity('Empty')
        break
      case 'cube':
        entity = engine.createBox('Cube')
        break
      case 'sphere':
        entity = engine.createSphere('Sphere')
        break
      case 'plane':
        entity = engine.createPlane('Plane')
        break
      case 'light':
        entity = engine.createLight('Light', 'point')
        entity.addTag('light')
        break
      case 'camera':
        entity = engine.createCamera('Camera', false)
        entity.addTag('camera')
        break
    }

    if (entity) {
      // Create command for undo support (entity already created, just track it)
      const command = new CreateEntityCommand(engine, entity)
      commandHistory.push(command)
    }

    setEntities(engine.world.getRootEntities())
  }

  const handleDeleteEntity = useCallback((entity: Entity) => {
    if (!engine) return

    const command = new DeleteEntityCommand(engine, entity)
    commandHistory.execute(command)

    // Deselect if deleted entity was selected
    if (selectedEntity?.id === entity.id) {
      selectEntity(null)
    }

    setEntities(engine.world.getRootEntities())
  }, [engine, selectedEntity, selectEntity])

  // Keyboard shortcut for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Delete' && selectedEntity) {
        handleDeleteEntity(selectedEntity)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEntity, handleDeleteEntity])

  return (
    <div className="hierarchy-panel">
      <div className="hierarchy-toolbar">
        <div className="toolbar-group">
          <button onClick={() => handleAddEntity('empty')} title="Add Empty Entity" className="toolbar-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <span className="btn-label">Empty</span>
          </button>
          <button onClick={() => handleAddEntity('cube')} title="Add Cube" className="toolbar-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span className="btn-label">Cube</span>
          </button>
          <button onClick={() => handleAddEntity('sphere')} title="Add Sphere" className="toolbar-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <ellipse cx="12" cy="12" rx="10" ry="4"/>
            </svg>
            <span className="btn-label">Sphere</span>
          </button>
          <button onClick={() => handleAddEntity('light')} title="Add Light" className="toolbar-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <span className="btn-label">Light</span>
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {selectedEntity && (
          <button
            onClick={() => handleDeleteEntity(selectedEntity)}
            title="Delete Selected (Del)"
            className="toolbar-btn delete-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </div>
      <div className="hierarchy-list">
        {entities.map((entity) => (
          <HierarchyItem
            key={entity.id}
            entity={entity}
            depth={0}
            selectedEntityId={selectedEntity?.id ?? null}
            onSelect={handleSelectEntity}
          />
        ))}
        {entities.length === 0 && (
          <div className="hierarchy-empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="empty-title">No objects in scene</div>
            <div className="empty-hint">Click the buttons above to add your first object!</div>
          </div>
        )}
      </div>

      <style>{`
        .hierarchy-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-primary);
        }
        .hierarchy-toolbar {
          padding: var(--spacing-sm);
          display: flex;
          gap: var(--spacing-xs);
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }
        .toolbar-group {
          display: flex;
          gap: 2px;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          padding: 2px;
        }
        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: transparent;
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 11px;
          transition: all var(--transition-fast);
        }
        .toolbar-btn:hover {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .toolbar-btn:hover svg {
          color: var(--accent-light);
        }
        .btn-label {
          font-weight: 500;
        }
        .delete-btn {
          background: transparent;
          padding: 6px;
        }
        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          color: var(--error-light) !important;
        }
        .hierarchy-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-sm) 0;
        }
        .hierarchy-item {
          display: flex;
          align-items: center;
          padding: 6px 8px;
          cursor: pointer;
          font-size: 13px;
          gap: 6px;
          border-radius: var(--radius-sm);
          margin: 1px var(--spacing-sm);
          transition: all var(--transition-fast);
        }
        .hierarchy-item:hover {
          background: var(--bg-tertiary);
        }
        .hierarchy-item.selected {
          background: linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%);
          color: white;
          box-shadow: 0 2px 8px var(--accent-glow);
        }
        .expand-icon {
          width: 16px;
          font-size: 8px;
          text-align: center;
          opacity: 0.5;
          transition: transform var(--transition-fast);
        }
        .hierarchy-item:hover .expand-icon {
          opacity: 1;
        }
        .entity-icon {
          font-size: 14px;
          opacity: 0.8;
        }
        .hierarchy-item.selected .entity-icon {
          opacity: 1;
        }
        .entity-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 400;
        }
        .hierarchy-item.selected .entity-name {
          font-weight: 500;
        }
        .hierarchy-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-xl);
          text-align: center;
          height: 100%;
          min-height: 200px;
        }
        .empty-icon {
          color: var(--text-muted);
          opacity: 0.4;
          margin-bottom: var(--spacing-lg);
        }
        .empty-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: var(--spacing-sm);
        }
        .empty-hint {
          font-size: 12px;
          color: var(--text-muted);
          max-width: 180px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
